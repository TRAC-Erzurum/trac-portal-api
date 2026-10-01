import { Server } from 'http';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { BranchRole, GlobalRole } from '../auth/enums/role.enum';
import { MembershipStatus } from '../branch/enums/membership-status.enum';
import { User } from '../user/entities/user.entity';
import { LogCapture, LogLine } from '../../test/logging/log-capture';
import { createOidcTestApp, OidcTestApp } from '../../test/oidc/oidc-test-app';
import { pkceS256 } from './utils/secret.util';

const REDIRECT_URI = 'https://afet.example.edu/auth/callback';
const USER_EMAIL = 'ayse.logtest@example.org';
const ADMIN_EMAIL = 'root.logtest@trac.example';
const VERIFIER = 'verifier-logtest-'.padEnd(60, 'x');
const WRONG_SECRET = 'wrong-secret-logtest-value';
const BOGUS_CODE = 'bogus-code-logtest-value';
const BOGUS_TOKEN = 'bogus-access-token-logtest-value';

let t: OidcTestApp;
let http: ReturnType<typeof request>;
let admin: User;
let user: User;
const logs = new LogCapture();

interface Client {
  clientId: string;
  clientSecret: string;
}

beforeEach(async () => {
  t = await createOidcTestApp();
  http = request(t.app.getHttpServer() as Server);
  admin = t.users.add({
    email: ADMIN_EMAIL,
    provider: 'local',
    globalRole: GlobalRole.SUPER_ADMIN,
  });
  user = t.users.add({
    email: USER_EMAIL,
    provider: 'google',
    fullName: 'Ayşe Yılmaz',
    callSign: 'TA9LOG',
    memberships: [
      { status: MembershipStatus.APPROVED, role: BranchRole.MEMBER },
    ],
  });
  logs.install();
});

afterEach(async () => {
  logs.uninstall();
  logs.clear();
  await t.app.close();
});

async function registerClient(): Promise<Client> {
  const res = await http
    .post('/api/oidc/admin/clients')
    .set('Cookie', t.sessionCookie(admin))
    .send({ name: 'Afet Haberleşme Portalı', redirectUris: [REDIRECT_URI] })
    .expect(201);
  return {
    clientId: res.body.client.clientId,
    clientSecret: res.body.clientSecret,
  };
}

function authParams(client: Client, extra: Record<string, string> = {}) {
  return {
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile',
    state: 'st-log',
    nonce: 'n-log',
    ...extra,
  };
}

async function approve(params: Record<string, string>): Promise<string> {
  const res = await http
    .post('/api/oidc/consent/approve')
    .set('Cookie', t.sessionCookie(user))
    .send(params)
    .expect(200);
  const { redirectTo } = res.body as { redirectTo: string };
  return new URL(redirectTo).searchParams.get('code');
}

function basic(clientId: string, secret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`;
}

function redeem(
  client: Client,
  code: string,
  extra: Record<string, string> = {},
) {
  return http
    .post('/api/oidc/token')
    .set('Authorization', basic(client.clientId, client.clientSecret))
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      ...extra,
    });
}

function only(event: string): LogLine {
  const lines = logs.events(event);
  expect(lines).toHaveLength(1);
  return lines[0];
}

describe('a token request', () => {
  it('that succeeds leaves one line with the client, status 200 and the duration', async () => {
    const client = await registerClient();
    const code = await approve(authParams(client));
    logs.clear();

    await redeem(client, code).expect(200);

    const line = only('oidc.token');
    expect(line).toMatchObject({
      level: 'info',
      clientId: client.clientId,
      status: 200,
    });
    expect(line.error).toBeUndefined();
    expect(typeof line.durationMs).toBe('number');
  });

  it('with a wrong client secret leaves one line saying invalid_client', async () => {
    const client = await registerClient();
    const code = await approve(authParams(client));
    logs.clear();

    await redeem({ ...client, clientSecret: WRONG_SECRET }, code).expect(401);

    expect(only('oidc.token')).toMatchObject({
      level: 'warn',
      clientId: client.clientId,
      status: 401,
      error: 'invalid_client',
    });
  });

  it('with an expired code says invalid_grant and that the code expired', async () => {
    const client = await registerClient();
    const code = await approve(authParams(client));
    t.clock.now = new Date(t.clock.now.getTime() + 5 * 60 * 1000);
    logs.clear();

    await redeem(client, code).expect(400);

    expect(only('oidc.token')).toMatchObject({
      clientId: client.clientId,
      status: 400,
      error: 'invalid_grant',
      step: 'code_expired',
    });
  });

  it('names each reason a code is refused', async () => {
    const client = await registerClient();
    const cases: [string, () => Promise<unknown>][] = [
      ['code_unknown', () => redeem(client, BOGUS_CODE).expect(400)],
      [
        'redirect_uri_mismatch',
        async () =>
          redeem(client, await approve(authParams(client)), {
            redirect_uri: 'https://afet.example.edu/other',
          }).expect(400),
      ],
      [
        'pkce_failed',
        async () =>
          redeem(
            client,
            await approve(
              authParams(client, {
                code_challenge: pkceS256(VERIFIER),
                code_challenge_method: 'S256',
              }),
            ),
            { code_verifier: `${VERIFIER}-wrong` },
          ).expect(400),
      ],
      [
        'code_replayed',
        async () => {
          const code = await approve(authParams(client));
          await redeem(client, code).expect(200);
          await redeem(client, code).expect(400);
        },
      ],
    ];
    for (const [step, run] of cases) {
      logs.clear();
      await run();
      const failed = logs.events('oidc.token').filter((l) => l.status === 400);
      expect(failed).toHaveLength(1);
      expect(failed[0]).toMatchObject({ error: 'invalid_grant', step });
    }
  });

  it('with an unsupported grant type says so', async () => {
    const client = await registerClient();
    logs.clear();
    await redeem(client, BOGUS_CODE, { grant_type: 'password' }).expect(400);
    expect(only('oidc.token')).toMatchObject({
      error: 'unsupported_grant_type',
    });
  });
});

describe('the authorize endpoint', () => {
  it('logs an unknown client and an unregistered redirect URI as refusals', async () => {
    const client = await registerClient();
    logs.clear();
    await http
      .get('/api/oidc/authorize')
      .query(authParams(client, { client_id: 'nope' }))
      .expect(400);
    expect(only('oidc.authorize')).toMatchObject({
      level: 'warn',
      clientId: 'nope',
      status: 400,
      error: 'invalid_client',
    });

    logs.clear();
    await http
      .get('/api/oidc/authorize')
      .query(authParams(client, { redirect_uri: 'https://evil.example/cb' }))
      .expect(400);
    expect(only('oidc.authorize')).toMatchObject({
      error: 'invalid_redirect_uri',
    });
  });

  it('logs the error a malformed request is redirected with', async () => {
    const client = await registerClient();
    logs.clear();
    await http
      .get('/api/oidc/authorize')
      .query(authParams(client, { scope: 'email' }))
      .expect(302);
    expect(only('oidc.authorize')).toMatchObject({
      clientId: client.clientId,
      status: 302,
      error: 'invalid_scope',
    });
  });

  it('logs a valid request as sent to consent', async () => {
    const client = await registerClient();
    logs.clear();
    await http.get('/api/oidc/authorize').query(authParams(client)).expect(302);
    const line = only('oidc.authorize');
    expect(line).toMatchObject({
      level: 'info',
      clientId: client.clientId,
      status: 302,
    });
    expect(line.error).toBeUndefined();
  });
});

describe('the consent endpoints', () => {
  it('log context, approve and deny with their outcome', async () => {
    const client = await registerClient();
    logs.clear();
    await http
      .post('/api/oidc/consent/context')
      .set('Cookie', t.sessionCookie(user))
      .send(authParams(client))
      .expect(200);
    expect(only('oidc.consent.context')).toMatchObject({
      clientId: client.clientId,
      status: 200,
    });

    await approve(authParams(client));
    expect(only('oidc.consent.approve')).toMatchObject({ status: 200 });

    await http
      .post('/api/oidc/consent/deny')
      .set('Cookie', t.sessionCookie(user))
      .send(authParams(client))
      .expect(200);
    expect(only('oidc.consent.deny')).toMatchObject({
      clientId: client.clientId,
      error: 'access_denied',
    });

    logs.clear();
    await http
      .post('/api/oidc/consent/approve')
      .set('Cookie', t.sessionCookie(user))
      .send(authParams(client, { client_id: 'nope' }))
      .expect(400);
    expect(only('oidc.consent.approve')).toMatchObject({
      clientId: 'nope',
      status: 400,
      error: 'invalid_client',
    });
  });
});

describe('userinfo, discovery and jwks', () => {
  it('each leave one line, and a bad bearer token says invalid_token', async () => {
    await http.get('/api/oidc/.well-known/openid-configuration').expect(200);
    expect(only('oidc.discovery')).toMatchObject({ status: 200 });

    await http.get('/api/oidc/jwks').expect(200);
    expect(only('oidc.jwks')).toMatchObject({ status: 200 });

    await http
      .get('/api/oidc/userinfo')
      .set('Authorization', `Bearer ${BOGUS_TOKEN}`)
      .expect(401);
    expect(only('oidc.userinfo')).toMatchObject({
      level: 'warn',
      status: 401,
      error: 'invalid_token',
      step: 'token_unknown',
    });
  });

  it('logs a consent call refused for want of a session', async () => {
    await http.post('/api/oidc/consent/context').send({}).expect(401);
    expect(only('oidc.consent.context')).toMatchObject({
      level: 'warn',
      status: 401,
      error: 'unauthenticated',
    });
  });

  it('logs a successful userinfo call with the client it was issued to', async () => {
    const client = await registerClient();
    const token = await redeem(client, await approve(authParams(client)));
    logs.clear();
    await http
      .post('/api/oidc/userinfo')
      .set('Authorization', `Bearer ${token.body.access_token}`)
      .expect(200);
    expect(only('oidc.userinfo')).toMatchObject({
      level: 'info',
      clientId: client.clientId,
      status: 200,
    });
  });
});

describe('no OIDC log line', () => {
  it('contains a secret, token, code, password or email', async () => {
    const client = await registerClient();
    const secrets: string[] = [
      client.clientSecret,
      WRONG_SECRET,
      BOGUS_CODE,
      BOGUS_TOKEN,
      VERIFIER,
      USER_EMAIL,
      ADMIN_EMAIL,
      t.sessionCookie(user).split('=')[1],
      t.sessionCookie(admin).split('=')[1],
    ];
    const add = (...values: (string | undefined | null)[]) =>
      values.forEach((v) => v && secrets.push(v));

    // Success path with PKCE: code, tokens, verifier.
    const params = authParams(client, {
      code_challenge: pkceS256(VERIFIER),
      code_challenge_method: 'S256',
    });
    await http.get('/api/oidc/.well-known/openid-configuration').expect(200);
    await http.get('/api/oidc/jwks').expect(200);
    await http.get('/api/oidc/authorize').query(params).expect(302);
    await http
      .post('/api/oidc/consent/context')
      .set('Cookie', t.sessionCookie(user))
      .send(params)
      .expect(200);
    const code = await approve(params);
    add(code);
    const token = await redeem(client, code, { code_verifier: VERIFIER });
    const tokens = token.body as { access_token: string; id_token: string };
    add(tokens.access_token, tokens.id_token);
    await http
      .get('/api/oidc/userinfo')
      .set('Authorization', `Bearer ${token.body.access_token}`)
      .expect(200);

    // Failure paths.
    await http
      .get('/api/oidc/authorize')
      .query({ ...params, client_id: USER_EMAIL })
      .expect(400);
    await http
      .get('/api/oidc/authorize')
      .query({ ...params, scope: 'email' })
      .expect(302);
    await http.post('/api/oidc/consent/approve').send(params).expect(401);
    await redeem(client, code, { code_verifier: VERIFIER }).expect(400);
    await redeem({ ...client, clientSecret: WRONG_SECRET }, BOGUS_CODE).expect(
      401,
    );
    await http
      .post('/api/oidc/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code: BOGUS_CODE,
        redirect_uri: REDIRECT_URI,
        client_id: client.clientId,
        client_secret: client.clientSecret,
      })
      .expect(400);
    await http
      .post('/api/oidc/token')
      .set('Authorization', basic(client.clientId, client.clientSecret))
      .type('form')
      .send({ code: BOGUS_CODE, client_secret: WRONG_SECRET })
      .expect(400);
    await http
      .get('/api/oidc/userinfo')
      .set('Authorization', `Bearer ${BOGUS_TOKEN}`)
      .expect(401);
    await http
      .post('/api/oidc/consent/deny')
      .set('Cookie', t.sessionCookie(user))
      .send(params)
      .expect(200);
    await http
      .post('/api/oidc/consent/approve')
      .set('Cookie', t.sessionCookie(user))
      .send({ ...params, client_id: USER_EMAIL })
      .expect(400);

    // A server error on a request carrying a session cookie and a body.
    const config = t.app.get(ConfigService);
    const get = config.get.bind(config);
    jest
      .spyOn(config, 'get')
      .mockImplementation((key: string) =>
        key === 'PUBLIC_API_ORIGIN' ? undefined : get(key),
      );
    await http
      .post('/api/oidc/consent/approve')
      .set('Cookie', t.sessionCookie(user))
      .send(params)
      .expect(500);

    const events = new Set(logs.lines.map((l) => l.event));
    for (const event of [
      'oidc.discovery',
      'oidc.jwks',
      'oidc.authorize',
      'oidc.consent.context',
      'oidc.consent.approve',
      'oidc.consent.deny',
      'oidc.token',
      'oidc.userinfo',
    ]) {
      expect(events).toContain(event);
    }
    const output = logs.raw;
    for (const secret of secrets) {
      expect(output).not.toContain(secret);
    }
  });
});
