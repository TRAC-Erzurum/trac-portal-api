import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { DataSource, LessThan, Not, Repository } from 'typeorm';
import {
  buildFeedbackIssueTitle,
  FEEDBACK_LABEL_BY_CATEGORY,
  FEEDBACK_LABEL_PRODUCT,
} from './feedback.constants';
import { Feedback } from './entities/feedback.entity';
import { FeedbackGithubStatus } from './enums/feedback-github-status.enum';
import { FeedbackCategory } from './feedback.types';
import { buildFeedbackIssueBody } from './utils/build-feedback-issue';
import { parseGithubRepoWebUrl } from './utils/parse-github-repo';

/** Failed records stop being retried after this many attempts. */
export const MAX_FEEDBACK_GITHUB_ATTEMPTS = 5;
/** Records forwarded per sync run. */
export const FEEDBACK_SYNC_BATCH_SIZE = 20;
/** Advisory lock key shared by every pm2 instance so one issue is never created twice. */
const FEEDBACK_SYNC_LOCK_KEY = 7144001;
const MAX_GITHUB_ERROR_LENGTH = 500;
/** Bounds each GitHub call so a hung request cannot hold the advisory lock. */
const GITHUB_REQUEST_TIMEOUT_MS = 15000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface GithubAppConfig {
  appId: string;
  installationId: number;
  privateKey: string;
  owner: string;
  repo: string;
}

export interface FeedbackBatchResult {
  processed: number;
  sent: number;
  failed: number;
}

@Injectable()
export class FeedbackGithubService {
  private readonly logger = new Logger(FeedbackGithubService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
  ) {}

  /** The GitHub App settings, or null while any of them is missing or invalid. */
  getConfig(): GithubAppConfig | null {
    const appId = this.configService.get<string>('GITHUB_APP_ID')?.trim();
    const installationId = Number(
      this.configService.get<string>('GITHUB_APP_INSTALLATION_ID')?.trim(),
    );
    const rawKey = this.configService.get<string>('GITHUB_APP_PRIVATE_KEY');
    const parsed = parseGithubRepoWebUrl(
      this.configService.get<string>('GITHUB_REPO_WEB_URL'),
    );
    if (
      !appId ||
      !Number.isInteger(installationId) ||
      installationId <= 0 ||
      !rawKey?.trim() ||
      !parsed
    ) {
      return null;
    }
    return {
      appId,
      installationId,
      // Keys set in one-line env files carry literal \n escapes.
      privateKey: rawKey.replace(/\\n/g, '\n'),
      owner: parsed.owner,
      repo: parsed.repo,
    };
  }

  /**
   * Forwards a record that was just saved. Runs under the sync lock and
   * re-reads the row first, so a record the sync job already sent is not sent
   * again. Does nothing while the GitHub App is not configured. A GitHub
   * failure is stored on the record and never thrown.
   */
  async forwardNewRecord(record: Feedback): Promise<void> {
    const config = this.getConfig();
    if (!config) {
      return;
    }
    await this.withSyncLock(true, async (repo) => {
      const fresh = await repo.findOne({ where: { id: record.id } });
      if (!fresh || fresh.githubStatus !== FeedbackGithubStatus.PENDING) {
        return;
      }
      await this.forward(fresh, config, repo);
      Object.assign(record, fresh);
    });
  }

  /** Admin retry of one record. Throws the errors the admin endpoint documents. */
  async retryRecord(id: string): Promise<Feedback> {
    const result = await this.withSyncLock(true, async (repo) => {
      const record = await repo.findOne({ where: { id } });
      if (!record) {
        throw new NotFoundException('error.notFound');
      }
      if (record.category === 'security') {
        throw new BadRequestException('error.feedbackSecurityNotForwardable');
      }
      if (record.githubStatus === FeedbackGithubStatus.SENT) {
        throw new BadRequestException('error.feedbackAlreadySent');
      }
      const config = this.getConfig();
      if (!config) {
        throw new ServiceUnavailableException('error.feedbackNotConfigured');
      }
      await this.forward(record, config, repo);
      return record;
    });
    if (!result) {
      throw new ServiceUnavailableException('error.feedbackNotConfigured');
    }
    return result;
  }

  /**
   * Forwards the oldest pending records, plus failed records that still have
   * attempts left, at most FEEDBACK_SYNC_BATCH_SIZE per run. Returns null when
   * the GitHub App is not configured, or when `wait` is false and another
   * instance holds the lock.
   */
  async forwardPendingBatch(options: {
    wait: boolean;
  }): Promise<FeedbackBatchResult | null> {
    const config = this.getConfig();
    if (!config) {
      return null;
    }
    return this.withSyncLock(options.wait, async (repo) => {
      const records = await repo.find({
        where: [
          {
            githubStatus: FeedbackGithubStatus.PENDING,
            category: Not<FeedbackCategory>('security'),
          },
          {
            githubStatus: FeedbackGithubStatus.FAILED,
            githubAttempts: LessThan(MAX_FEEDBACK_GITHUB_ATTEMPTS),
            category: Not<FeedbackCategory>('security'),
          },
        ],
        order: { createdAt: 'ASC' },
        take: FEEDBACK_SYNC_BATCH_SIZE,
      });
      let sent = 0;
      let failed = 0;
      for (const record of records) {
        await this.forward(record, config, repo);
        if (record.githubStatus === FeedbackGithubStatus.SENT) {
          sent += 1;
        } else {
          failed += 1;
        }
      }
      return { processed: records.length, sent, failed };
    });
  }

  /**
   * Creates the GitHub issue for one record and stores the outcome. Never
   * throws for a GitHub failure; the record is saved as failed instead.
   */
  private async forward(
    record: Feedback,
    config: GithubAppConfig,
    repo: Repository<Feedback>,
  ) {
    record.githubAttempts += 1;
    try {
      const auth = createAppAuth({
        appId: config.appId,
        privateKey: config.privateKey,
        installationId: config.installationId,
      });
      const { token } = await withTimeout(
        auth({ type: 'installation' }),
        GITHUB_REQUEST_TIMEOUT_MS,
        'GitHub App token request timed out',
      );
      const octokit = new Octokit({
        auth: token,
        request: { signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS) },
      });
      const { data } = await octokit.rest.issues.create({
        owner: config.owner,
        repo: config.repo,
        title: buildFeedbackIssueTitle(record.category, record.summary),
        body: buildFeedbackIssueBody({
          category: record.category,
          body: record.body,
          recordId: record.id,
          attachmentCount: record.attachmentPaths.length,
          origin: this.getPublicOrigin(),
        }),
        labels: [
          FEEDBACK_LABEL_BY_CATEGORY[record.category],
          FEEDBACK_LABEL_PRODUCT,
        ],
      });
      record.githubStatus = FeedbackGithubStatus.SENT;
      record.githubIssueNumber = data.number;
      record.githubIssueUrl = data.html_url;
      record.githubError = null;
    } catch (e) {
      const status = (e as { status?: unknown })?.status;
      const message = e instanceof Error ? e.message : String(e);
      const statusLabel = typeof status === 'number' ? `HTTP ${status}` : null;
      record.githubStatus = FeedbackGithubStatus.FAILED;
      record.githubError = [statusLabel, message]
        .filter(Boolean)
        .join(': ')
        .slice(0, MAX_GITHUB_ERROR_LENGTH);
      this.logger.warn(
        `Feedback GitHub forwarding failed (${statusLabel ?? 'no HTTP status'}): ${message}`,
      );
    }
    await repo.save(record);
  }

  /**
   * Runs `work` while holding a transaction-scoped advisory lock. The lock is
   * released on commit or rollback, so a crashed instance cannot keep it.
   * `work` receives a repository bound to the same transaction, so it uses the
   * one connection that holds the lock instead of a second pooled connection.
   * Returns null without running `work` when `wait` is false and the lock is busy.
   */
  private async withSyncLock<T>(
    wait: boolean,
    work: (repo: Repository<Feedback>) => Promise<T>,
  ): Promise<T | null> {
    return this.dataSource.transaction(async (manager) => {
      if (wait) {
        await manager.query('SELECT pg_advisory_xact_lock($1)', [
          FEEDBACK_SYNC_LOCK_KEY,
        ]);
      } else {
        const [{ locked }] = await manager.query(
          'SELECT pg_try_advisory_xact_lock($1) AS locked',
          [FEEDBACK_SYNC_LOCK_KEY],
        );
        if (!locked) {
          return null;
        }
      }
      return work(manager.getRepository(Feedback));
    });
  }

  private getPublicOrigin(): string {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const domain = this.configService.get<string>('DOMAIN');
    const port = this.configService.get<number>('PORT') || 8000;
    if (nodeEnv === 'production' && domain) {
      return `https://${domain}`;
    }
    return `http://localhost:${port}`;
  }
}
