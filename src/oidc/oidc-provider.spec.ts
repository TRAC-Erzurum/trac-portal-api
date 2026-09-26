import { createPublicKey } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { BranchRole, GlobalRole } from '../auth/enums/role.enum';
import { MembershipStatus } from '../branch/enums/membership-status.enum';
import { User } from '../user/entities/user.entity';
import {
  createOidcTestApp,
  ISSUER,
  OidcTestApp,
  PUBLIC_API_ORIGIN,
} from '../../test/oidc/oidc-test-app';
import { pkceS256 } from './utils/secret.util';

const REDIRECT_URI = 'https://afet.example.edu/auth/callback';
const USER_CLAIMS = [
  'sub',
  'email',
  'email_verified',
  'name',
  'call_sign',
  'verified',
];
const ID_TOKEN_STANDARD = ['iss', 'aud', 'iat', 'exp', 'nonce'];

interface RegisteredClient {
  id: string;
  clientId: string;
  clientSecret: string;
}

let t: OidcTestApp;
let admin: User;
let http: ReturnType<typeof request>;

beforeEach(async () => {
  t = await createOidcTestApp();
  http = request(t.app.getHttpServer());
  admin = t.users.add({
    email: 'admin@trac.example',
    provider: 'local',
    globalRole: GlobalRole.SUPER_ADMIN,
  });
});

afterEach(async () => {
  await t.app.close();
});

function operator(
  spec: Partial<Parameters<OidcTestApp['users']['add']>[0]> = {},
): User {
  return t.users.add({
    email: `ta9${Math.random().toString(36).slice(2, 6)}@example.org`,
    provider: 'google',
    fullName: 'Ayşe Yılmaz',
    callSign: 'TA9AAA',
    memberships: [
      { status: MembershipStatus.APPROVED, role: BranchRole.PRESIDENT },
    ],
    ...spec,
  });
}

async function registerClient(
  redirectUris = [REDIRECT_URI],
): Promise<RegisteredClient> {
  const res = await http
    .post('/api/oidc/admin/clients')
    .set('Cookie', t.sessionCookie(admin))
    .send({ name: 'Afet Haberleşme Portalı', redirectUris })
    .expect(201);
  return {
    id: res.body.client.id,
    clientId: res.body.client.clientId,
    clientSecret: res.body.clientSecret,
  };
}

function authParams(
  client: RegisteredClient,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile',
    state: 'st-123',
    nonce: 'n-456',
    ...extra,
  };
}

/** Browser leg: authorize → consent page → approve. Returns the callback URL. */
async function authorizeAndApprove(
  user: User,
  params: Record<string, string>,
): Promise<URL> {
  const authorize = await http
    .get('/api/oidc/authorize')
    .query(params)
    .expect(302);
  const consentPage = new URL(authorize.headers.location);
  expect(consentPage.origin + consentPage.pathname).toBe(
    `${PUBLIC_API_ORIGIN}/oidc/consent`,
  );
  const forwarded = Object.fromEntries(consentPage.searchParams);
  const approve = await http
    .post('/api/oidc/consent/approve')
    .set('Cookie', t.sessionCookie(user))
    .send(forwarded)
    .expect(200);
  return new URL(approve.body.redirectTo);
}

function basic(client: RegisteredClient): string {
  return `Basic ${Buffer.from(
    `${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`,
  ).toString('base64')}`;
}

function redeem(
  client: RegisteredClient,
  code: string,
  extra: Record<string, string> = {},
) {
  return http
    .post('/api/oidc/token')
    .set('Authorization', basic(client))
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      ...extra,
    });
}

async function verifyAgainstJwks(idToken: string, audience: string) {
  const jwks = await http.get('/api/oidc/jwks').expect(200);
  const header = JSON.parse(
    Buffer.from(idToken.split('.')[0], 'base64url').toString(),
  );
  const jwk = jwks.body.keys.find((k: { kid: string }) => k.kid === header.kid);
  if (!jwk) throw new Error(`kid ${header.kid} not in JWKS`);
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' })
    .export({ format: 'pem', type: 'spki' })
    .toString();
  return new JwtService().verify(idToken, {
    publicKey,
    algorithms: ['RS256'],
    issuer: ISSUER,
    audience,
    clockTimestamp: Math.floor(t.clock.now.getTime() / 1000),
  });
}

async function fullFlow(user: User, client: RegisteredClient) {
  const callback = await authorizeAndApprove(user, authParams(client));
  const token = await redeem(client, callback.searchParams.get('code')).expect(
    200,
  );
  const userinfo = await http
    .get('/api/oidc/userinfo')
    .set('Authorization', `Bearer ${token.body.access_token}`)
    .expect(200);
  const idToken = await verifyAgainstJwks(token.body.id_token, client.clientId);
  return { callback, token: token.body, userinfo: userinfo.body, idToken };
}

describe('discovery', () => {
  it('publishes the issuer and endpoints under /api/oidc', async () => {
    const res = await http
      .get('/api/oidc/.well-known/openid-configuration')
      .expect(200);
    expect(res.body).toMatchObject({
      issuer: 'https://portal.example.org/api/oidc',
      authorization_endpoint: 'https://portal.example.org/api/oidc/authorize',
      token_endpoint: 'https://portal.example.org/api/oidc/token',
      userinfo_endpoint: 'https://portal.example.org/api/oidc/userinfo',
      jwks_uri: 'https://portal.example.org/api/oidc/jwks',
      response_types_supported: ['code'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
      ],
      code_challenge_methods_supported: ['S256'],
    });
  });
});

describe('AC1: a registered client completes the code flow and receives user info', () => {
  it('returns code+state to the redirect URI, then tokens, then userinfo', async () => {
    const client = await registerClient();
    const user = operator({ email: 'ayse@example.org' });

    const { callback, token, userinfo, idToken } = await fullFlow(user, client);

    expect(callback.origin + callback.pathname).toBe(REDIRECT_URI);
    expect(callback.searchParams.get('state')).toBe('st-123');
    expect(callback.searchParams.get('iss')).toBe(ISSUER);
    expect(token.token_type).toBe('Bearer');
    expect(token.expires_in).toBe(600);
    expect(userinfo).toEqual({
      sub: user.id,
      email: 'ayse@example.org',
      email_verified: true,
      name: 'Ayşe Yılmaz',
      call_sign: 'TA9AAA',
      verified: true,
    });
    expect(idToken).toMatchObject({
      iss: ISSUER,
      aud: client.clientId,
      sub: user.id,
      nonce: 'n-456',
      call_sign: 'TA9AAA',
    });
    expect(idToken.exp - idToken.iat).toBe(600);
  });

  it('accepts client_secret_post and honours PKCE S256', async () => {
    const client = await registerClient();
    const user = operator();
    const verifier = 'v'.repeat(50);
    const challenge = pkceS256(verifier);

    const callback = await authorizeAndApprove(
      user,
      authParams(client, {
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }),
    );
    const code = callback.searchParams.get('code');

    const body = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    };
    await http
      .post('/api/oidc/token')
      .type('form')
      .send({ ...body, code_verifier: 'w'.repeat(50) })
      .expect(400)
      .expect((r) => expect(r.body.error).toBe('invalid_grant'));
    await http
      .post('/api/oidc/token')
      .type('form')
      .send({ ...body, code_verifier: verifier })
      .expect(200);
  });

  it('skips the consent page on the second sign-in', async () => {
    const client = await registerClient();
    const user = operator();
    await authorizeAndApprove(user, authParams(client));

    const res = await http
      .post('/api/oidc/consent/context')
      .set('Cookie', t.sessionCookie(user))
      .send(authParams(client, { state: 'second' }))
      .expect(200);

    expect(res.body.consentRequired).toBe(false);
    const callback = new URL(res.body.redirectTo);
    expect(callback.searchParams.get('state')).toBe('second');
    await redeem(client, callback.searchParams.get('code')).expect(200);
  });

  it('refuses a wrong client secret with invalid_client', async () => {
    const client = await registerClient();
    const callback = await authorizeAndApprove(operator(), authParams(client));
    await redeem(
      { ...client, clientSecret: 'not-the-secret' },
      callback.searchParams.get('code'),
    )
      .expect(401)
      .expect((r) => expect(r.body.error).toBe('invalid_client'));
  });

  it('refuses a code presented by a different registered client', async () => {
    const client = await registerClient();
    const other = await registerClient();
    const callback = await authorizeAndApprove(operator(), authParams(client));
    await redeem(other, callback.searchParams.get('code'))
      .expect(400)
      .expect((r) => expect(r.body.error).toBe('invalid_grant'));
  });

  it('expires the code after 5 minutes and the access token after 10', async () => {
    const client = await registerClient();
    const user = operator();
    const stale = await authorizeAndApprove(user, authParams(client));
    t.clock.now = new Date(t.clock.now.getTime() + 5 * 60 * 1000);
    await redeem(client, stale.searchParams.get('code'))
      .expect(400)
      .expect((r) => expect(r.body.error).toBe('invalid_grant'));

    const fresh = await authorizeAndApprove(user, authParams(client));
    const token = await redeem(client, fresh.searchParams.get('code')).expect(
      200,
    );
    t.clock.now = new Date(t.clock.now.getTime() + 10 * 60 * 1000);
    await http
      .get('/api/oidc/userinfo')
      .set('Authorization', `Bearer ${token.body.access_token}`)
      .expect(401);
  });
});

describe('AC2: unknown client or unregistered redirect URI is refused without redirect', () => {
  it('shows an error page for an unknown client_id', async () => {
    await registerClient();
    const res = await http
      .get('/api/oidc/authorize')
      .query({
        response_type: 'code',
        client_id: 'nope',
        redirect_uri: REDIRECT_URI,
        scope: 'openid',
      })
      .expect(400);
    expect(res.headers.location).toBeUndefined();
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('shows an error page for a redirect URI that is not registered', async () => {
    const client = await registerClient();
    for (const redirect_uri of [
      'https://evil.example.com/cb',
      `${REDIRECT_URI}/extra`,
      `${REDIRECT_URI}?x=1`,
    ]) {
      const res = await http
        .get('/api/oidc/authorize')
        .query(authParams(client, { redirect_uri }))
        .expect(400);
      expect(res.headers.location).toBeUndefined();
    }
  });

  it('refuses a deactivated client the same way', async () => {
    const client = await registerClient();
    await http
      .post(`/api/oidc/admin/clients/${client.id}/deactivate`)
      .set('Cookie', t.sessionCookie(admin))
      .expect(200);
    const res = await http
      .get('/api/oidc/authorize')
      .query(authParams(client))
      .expect(400);
    expect(res.headers.location).toBeUndefined();
  });

  it('gives the consent API no redirect target for an unregistered redirect URI', async () => {
    const client = await registerClient();
    const user = operator();
    for (const path of ['context', 'approve', 'deny']) {
      const res = await http
        .post(`/api/oidc/consent/${path}`)
        .set('Cookie', t.sessionCookie(user))
        .send(authParams(client, { redirect_uri: 'https://evil.example.com/' }))
        .expect(400);
      expect(res.body.redirectTo).toBeUndefined();
    }
    expect(t.repos.codes.rows).toHaveLength(0);
  });
});

describe('AC3: nothing is shared before approval; deny returns access_denied', () => {
  it('shows the consent page only the client name and field names', async () => {
    const client = await registerClient();
    const user = operator({ email: 'secret@example.org' });

    const authorize = await http
      .get('/api/oidc/authorize')
      .query(authParams(client))
      .expect(302);
    expect(authorize.headers.location).not.toContain(REDIRECT_URI + '?');
    const context = await http
      .post('/api/oidc/consent/context')
      .set('Cookie', t.sessionCookie(user))
      .send(authParams(client))
      .expect(200);

    expect(context.body).toEqual({
      consentRequired: true,
      clientName: 'Afet Haberleşme Portalı',
      claims: USER_CLAIMS,
    });
    expect(t.repos.codes.rows).toHaveLength(0);
    expect(t.repos.consents.rows).toHaveLength(0);
  });

  it('requires a portal session before consent', async () => {
    const client = await registerClient();
    await http
      .post('/api/oidc/consent/approve')
      .send(authParams(client))
      .expect(401);
    expect(t.repos.codes.rows).toHaveLength(0);
  });

  it('deny redirects with error=access_denied and the state, and no code', async () => {
    const client = await registerClient();
    const user = operator();
    const res = await http
      .post('/api/oidc/consent/deny')
      .set('Cookie', t.sessionCookie(user))
      .send(authParams(client))
      .expect(200);
    const callback = new URL(res.body.redirectTo);
    expect(callback.origin + callback.pathname).toBe(REDIRECT_URI);
    expect(callback.searchParams.get('error')).toBe('access_denied');
    expect(callback.searchParams.get('state')).toBe('st-123');
    expect(callback.searchParams.get('code')).toBeNull();
    expect(t.repos.codes.rows).toHaveLength(0);
    expect(t.repos.consents.rows).toHaveLength(0);
  });
});

describe('AC4: email_verified follows how the account was created', () => {
  it('reports true for a Google account and false for a local-password account', async () => {
    const client = await registerClient();
    const google = operator({ provider: 'google' });
    const local = operator({ provider: 'local' });

    const g = await fullFlow(google, client);
    const l = await fullFlow(local, client);

    expect(g.userinfo.email_verified).toBe(true);
    expect(g.idToken.email_verified).toBe(true);
    expect(l.userinfo.email_verified).toBe(false);
    expect(l.idToken.email_verified).toBe(false);
  });
});

describe('AC5: verified needs an approved membership and a call sign', () => {
  it.each([
    [
      'approved membership + call sign',
      {
        callSign: 'TA9BBB',
        memberships: [
          { status: MembershipStatus.APPROVED, role: BranchRole.VOLUNTEER },
        ],
      },
      true,
    ],
    [
      'pending membership + call sign',
      {
        callSign: 'TA9CCC',
        memberships: [
          { status: MembershipStatus.PENDING, role: BranchRole.MEMBER },
        ],
      },
      false,
    ],
    [
      'rejected membership + call sign',
      {
        callSign: 'TA9DDD',
        memberships: [
          { status: MembershipStatus.REJECTED, role: BranchRole.MEMBER },
        ],
      },
      false,
    ],
    [
      'approved membership but empty call sign',
      {
        callSign: '',
        memberships: [
          { status: MembershipStatus.APPROVED, role: BranchRole.MEMBER },
        ],
      },
      false,
    ],
    ['no call sign (and so no membership)', { callSign: null }, false],
  ])('%s → verified %s', async (_label, spec, expected) => {
    const client = await registerClient();
    const { userinfo, idToken } = await fullFlow(operator(spec), client);
    expect(userinfo.verified).toBe(expected);
    expect(idToken.verified).toBe(expected);
  });

  it('reports a user without a call sign with call_sign null', async () => {
    const client = await registerClient();
    const { userinfo } = await fullFlow(operator({ callSign: null }), client);
    expect(userinfo.call_sign).toBeNull();
  });
});

describe('AC6: no branch, membership status or role leaves the portal', () => {
  it('ID token and userinfo carry exactly the agreed claims', async () => {
    const client = await registerClient();
    const leader = operator({
      memberships: [
        { status: MembershipStatus.APPROVED, role: BranchRole.PRESIDENT },
        { status: MembershipStatus.PENDING, role: BranchRole.ADMIN },
      ],
    });

    const { userinfo, idToken } = await fullFlow(leader, client);

    expect(Object.keys(userinfo).sort()).toEqual([...USER_CLAIMS].sort());
    expect(Object.keys(idToken).sort()).toEqual(
      [...USER_CLAIMS, ...ID_TOKEN_STANDARD].sort(),
    );
    const everything = JSON.stringify({ userinfo, idToken });
    for (const internal of [
      'president',
      'admin',
      'pending',
      'approved',
      'Erzurum',
      'branch',
      'role',
      'status',
    ]) {
      expect(everything.toLowerCase()).not.toContain(internal);
    }
  });
});

describe('AC7: an authorization code is single use', () => {
  it('fails the second redemption with invalid_grant and revokes the first tokens', async () => {
    const client = await registerClient();
    const callback = await authorizeAndApprove(operator(), authParams(client));
    const code = callback.searchParams.get('code');

    const first = await redeem(client, code).expect(200);
    const second = await redeem(client, code).expect(400);

    expect(second.body.error).toBe('invalid_grant');
    await http
      .get('/api/oidc/userinfo')
      .set('Authorization', `Bearer ${first.body.access_token}`)
      .expect(401);
  });
});

describe('AC7b: concurrent redemption', () => {
  it('lets exactly one of two simultaneous redemptions succeed', async () => {
    const client = await registerClient();
    const callback = await authorizeAndApprove(operator(), authParams(client));
    const code = callback.searchParams.get('code');

    // Force the race: both requests read the unused code before either writes.
    const codes = t.repos.codes;
    const read = codes.findOne.bind(codes);
    let arrived = 0;
    let release: () => void = () => undefined;
    const bothRead = new Promise<void>((resolve) => (release = resolve));
    codes.findOne = async (options) => {
      const row = await read(options);
      if (++arrived === 2) release();
      await bothRead;
      return row;
    };

    const results = await Promise.all([
      redeem(client, code),
      redeem(client, code),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });
});

describe('AC8: key rotation keeps old ID tokens verifiable', () => {
  it('signs new tokens with the new key while the old key stays in JWKS for 7 days', async () => {
    const client = await registerClient();
    const user = operator();
    const before = await fullFlow(user, client);
    const oldKid = JSON.parse(
      Buffer.from(before.token.id_token.split('.')[0], 'base64url').toString(),
    ).kid;

    const rotated = await http
      .post('/api/oidc/admin/keys/rotate')
      .set('Cookie', t.sessionCookie(admin))
      .expect(200);
    const newKid = rotated.body.kid;
    expect(newKid).not.toBe(oldKid);

    const after = await fullFlow(user, client);
    const afterKid = JSON.parse(
      Buffer.from(after.token.id_token.split('.')[0], 'base64url').toString(),
    ).kid;
    expect(afterKid).toBe(newKid);

    // The token signed before rotation still verifies against JWKS.
    await expect(
      verifyAgainstJwks(before.token.id_token, client.clientId),
    ).resolves.toMatchObject({ sub: user.id });

    const kids = async () =>
      (await http.get('/api/oidc/jwks')).body.keys.map(
        (k: { kid: string }) => k.kid,
      );
    t.clock.now = new Date(t.clock.now.getTime() + 7 * 24 * 3600 * 1000 - 1000);
    expect(await kids()).toEqual(expect.arrayContaining([oldKid, newKid]));
    t.clock.now = new Date(t.clock.now.getTime() + 2000);
    expect(await kids()).toEqual([newKid]);
  });

  it('never publishes private key material in JWKS', async () => {
    const client = await registerClient();
    await fullFlow(operator(), client);
    const jwks = await http.get('/api/oidc/jwks').expect(200);
    for (const key of jwks.body.keys) {
      expect(Object.keys(key).sort()).toEqual(
        ['alg', 'e', 'kid', 'kty', 'n', 'use'].sort(),
      );
    }
  });
});

describe('AC9: only super admins manage clients and rotate keys', () => {
  const adminCalls: [string, string][] = [
    ['get', '/api/oidc/admin/clients'],
    ['post', '/api/oidc/admin/clients'],
    ['post', '/api/oidc/admin/clients/:id/rotate-secret'],
    ['post', '/api/oidc/admin/clients/:id/deactivate'],
    ['post', '/api/oidc/admin/keys/rotate'],
  ];

  it('refuses branch presidents, members, guests and anonymous callers', async () => {
    const client = await registerClient();
    const president = operator();
    const guest = operator({ callSign: 'TA9ZZZ', memberships: [] });
    for (const [method, template] of adminCalls) {
      const path = template.replace(':id', client.id);
      const body = { name: 'x', redirectUris: [REDIRECT_URI] };
      for (const user of [president, guest]) {
        await (http as any)
          [method](path)
          .set('Cookie', t.sessionCookie(user))
          .send(body)
          .expect(403);
      }
      await (http as any)[method](path).send(body).expect(401);
    }
    expect(t.repos.clients.rows).toHaveLength(1);
    expect(t.repos.clients.rows[0].active).toBe(true);
    expect(t.repos.keys.rows).toHaveLength(0);
  });

  it('lets a super admin list, create, rotate a secret and deactivate', async () => {
    const client = await registerClient();
    const list = await http
      .get('/api/oidc/admin/clients')
      .set('Cookie', t.sessionCookie(admin))
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(client.clientSecret);
    expect(list.body[0]).not.toHaveProperty('secretHash');

    const rotated = await http
      .post(`/api/oidc/admin/clients/${client.id}/rotate-secret`)
      .set('Cookie', t.sessionCookie(admin))
      .expect(200);
    expect(rotated.body.clientSecret).not.toBe(client.clientSecret);

    // Old secret stops working, new one works.
    const callback = await authorizeAndApprove(operator(), authParams(client));
    const code = callback.searchParams.get('code');
    await redeem(client, code).expect(401);
    await redeem(
      { ...client, clientSecret: rotated.body.clientSecret },
      code,
    ).expect(200);
  });

  it('stores the client secret hashed, never in clear', async () => {
    const client = await registerClient();
    const stored = t.repos.clients.rows[0];
    expect(JSON.stringify(stored)).not.toContain(client.clientSecret);
  });

  it('rejects redirect URIs that are not absolute https (except loopback http)', async () => {
    for (const bad of [
      'http://afet.example.edu/cb',
      'https://afet.example.edu/cb#frag',
      '/relative',
      'javascript:alert(1)',
    ]) {
      await http
        .post('/api/oidc/admin/clients')
        .set('Cookie', t.sessionCookie(admin))
        .send({ name: 'x', redirectUris: [bad] })
        .expect(400);
    }
    await http
      .post('/api/oidc/admin/clients')
      .set('Cookie', t.sessionCookie(admin))
      .send({ name: 'dev', redirectUris: ['http://localhost:3000/cb'] })
      .expect(201);
  });
});

describe('server-to-server endpoints are not rate limited per IP', () => {
  // Every token and userinfo call comes from the client application's server,
  // so a per-IP limit would cap sign-ins for all of its users together.
  it('serves more than 100 token, userinfo and JWKS calls a minute from one address', async () => {
    const client = await registerClient();
    const callback = await authorizeAndApprove(operator(), authParams(client));
    const token = await redeem(
      client,
      callback.searchParams.get('code'),
    ).expect(200);
    for (let i = 0; i < 101; i++) {
      await redeem(client, 'unknown-code').expect(400);
      await http
        .get('/api/oidc/userinfo')
        .set('Authorization', `Bearer ${token.body.access_token}`)
        .expect(200);
    }
    await http.get('/api/oidc/jwks').expect(200);
    await http.get('/api/oidc/.well-known/openid-configuration').expect(200);
  }, 60000);
});
