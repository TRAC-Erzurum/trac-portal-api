import { ConfigService } from '@nestjs/config';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../auth/types/auth.types';
import { FileStorageService } from '../shared/storage/file-storage.service';
import { Feedback } from './entities/feedback.entity';
import { FeedbackGithubStatus } from './enums/feedback-github-status.enum';
import { FeedbackGithubService } from './feedback-github.service';
import { FeedbackService } from './feedback.service';

// GitHub and file sniffing are mocked at the module boundary.
jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('@octokit/auth-app', () => ({ createAppAuth: jest.fn() }));
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

const issuesCreate = jest.fn();

const USER_ID = '3f1c2b7e-1111-4a2b-9c3d-000000000001';
const OPERATOR_ID = 'operator-7d6c';
const BRANCH_ID = 'branch-9f8e';
const CALL_SIGN = 'TA9XYZ';

const user = {
  id: USER_ID,
  email: 'member@example.org',
  role: 'MEMBER',
  callSign: CALL_SIGN,
  currentBranchId: BRANCH_ID,
  operatorId: OPERATOR_ID,
} as unknown as AuthUser;

const CONFIGURED_ENV: Record<string, string> = {
  GITHUB_APP_ID: '12345',
  GITHUB_APP_INSTALLATION_ID: '67890',
  GITHUB_APP_PRIVATE_KEY: 'placeholder-key-for-tests',
  GITHUB_REPO_WEB_URL: 'https://github.com/example-org/example-repo',
};

function createFeedbackRepository() {
  const rows = new Map<string, Feedback>();
  return {
    rows,
    create: (partial: Partial<Feedback>) =>
      Object.assign(new Feedback(), partial),
    save: jest.fn(async (entity: Feedback) => {
      entity.id ??= randomUUID();
      rows.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(
      async ({ where: { id } }: { where: { id: string } }) =>
        rows.get(id) ?? null,
    ),
  };
}

function build(env: Record<string, string>) {
  const repo = createFeedbackRepository();
  const config = { get: (key: string) => env[key] };
  // Single-connection stand-in: the advisory lock always succeeds.
  const dataSource = {
    transaction: async (work: (manager: unknown) => Promise<unknown>) =>
      work({ query: async () => [{ locked: true }] }),
  };
  const storage = { putBytes: jest.fn(), delete: jest.fn() };
  const github = new FeedbackGithubService(
    config as unknown as ConfigService,
    dataSource as unknown as DataSource,
    repo as unknown as Repository<Feedback>,
  );
  const service = new FeedbackService(
    storage as unknown as FileStorageService,
    repo as unknown as Repository<Feedback>,
    github,
  );
  return { service, repo, storage };
}

function submit(
  service: FeedbackService,
  category = 'bug',
  files: Express.Multer.File[] = [],
) {
  return service.submitFeedback(
    user,
    category,
    'Map does not load',
    'The map stays blank on mobile.',
    files,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(Octokit)
    .mockImplementation(
      () =>
        ({ rest: { issues: { create: issuesCreate } } }) as unknown as Octokit,
    );
  jest.mocked(createAppAuth).mockReturnValue((async () => ({
    token: 'installation-token',
  })) as unknown as ReturnType<typeof createAppAuth>);
  issuesCreate.mockResolvedValue({
    data: {
      number: 42,
      html_url: 'https://github.com/example-org/example-repo/issues/42',
    },
  });
});

describe('feedback submission', () => {
  it('keeps the saved record as failed when GitHub rejects the issue', async () => {
    issuesCreate.mockRejectedValue(
      Object.assign(new Error('Server Error'), { status: 502 }),
    );
    const { service, repo, storage } = build(CONFIGURED_ENV);

    const result = await submit(service);

    expect(result.success).toBe(true);
    const record = repo.rows.get(result.id);
    expect(record?.githubStatus).toBe(FeedbackGithubStatus.FAILED);
    expect(record?.githubError).toContain('HTTP 502');
    expect(record?.githubAttempts).toBe(1);
    expect(result.issueUrl).toBeUndefined();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('never forwards a security report to GitHub', async () => {
    const { service, repo } = build(CONFIGURED_ENV);

    const result = await submit(service, 'security');

    expect(repo.rows.get(result.id)?.githubStatus).toBe(
      FeedbackGithubStatus.SKIPPED,
    );
    expect(createAppAuth).not.toHaveBeenCalled();
    expect(Octokit).not.toHaveBeenCalled();
  });

  it('publishes an issue with no personal identifiers or upload links', async () => {
    jest
      .mocked(fileTypeFromBuffer)
      .mockResolvedValue({ mime: 'image/png', ext: 'png' });
    const file = {
      buffer: Buffer.from('png-bytes'),
      mimetype: 'image/png',
    } as Express.Multer.File;
    const { service } = build(CONFIGURED_ENV);

    await submit(service, 'bug', [file]);

    const payload = issuesCreate.mock.calls[0][0] as {
      title: string;
      body: string;
    };
    const published = `${payload.title}\n${payload.body}`;
    for (const forbidden of [
      USER_ID,
      OPERATOR_ID,
      BRANCH_ID,
      CALL_SIGN,
      '/uploads/',
    ]) {
      expect(published).not.toContain(forbidden);
    }
    expect(payload.title).toBe('[Feedback] Bug: Map does not load');
    expect(payload.body).toContain('1 attachment(s) in the portal record');
  });

  it('saves the record as pending and succeeds when the GitHub App is not configured', async () => {
    const unconfigured = [
      {},
      { ...CONFIGURED_ENV, GITHUB_REPO_WEB_URL: 'https://example.org/x' },
    ];
    for (const env of unconfigured) {
      const { service, repo } = build(env);

      const result = await submit(service);

      expect(result.success).toBe(true);
      expect(repo.rows.get(result.id)?.githubStatus).toBe(
        FeedbackGithubStatus.PENDING,
      );
    }
    expect(Octokit).not.toHaveBeenCalled();
  });
});
