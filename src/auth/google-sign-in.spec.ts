import * as request from 'supertest';
import * as crypto from 'crypto';
import { User } from '../user/entities/user.entity';
import {
  AuthTestApp,
  createAuthTestApp,
  FAILING_CAPTCHA,
  GOOGLE_PROFILE_HEADER,
} from '../../test/auth/auth-test-app';

const OWNER_EMAIL = 'owner@example.org';
const GOOGLE_ID = 'google-sub-1234567890';
const SQUATTER_PASSWORD = 'squatters-secret';
const OWNER_NEW_PASSWORD = 'owners-new-secret';
const LINK_PAGE = '/login/google-link';

let t: AuthTestApp;
let http: ReturnType<typeof request>;

beforeEach(async () => {
  t = await createAuthTestApp();
  http = request(t.app.getHttpServer());
});

afterEach(async () => {
  await t.app.close();
});

function googleProfile(email = OWNER_EMAIL, id = GOOGLE_ID, verified = true) {
  return Buffer.from(
    JSON.stringify({
      id,
      emails: [{ value: email, verified }],
      name: { givenName: 'Ayşe', familyName: 'Yılmaz' },
      photos: [{ value: 'https://lh3.example/photo.jpg' }],
    }),
  ).toString('base64');
}

/** Someone registers a local account with an address they do not own. */
async function preRegisteredLocalAccount(email = OWNER_EMAIL): Promise<User> {
  return t.users.create(
    {
      email,
      password: SQUATTER_PASSWORD,
      salt: crypto.randomBytes(16).toString('hex'),
      provider: 'local',
      fullName: 'Squatter',
    },
    OWNER_EMAIL,
  );
}

function setCookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw ?? [];
}

function cookieNamed(res: request.Response, name: string): string | undefined {
  const line = setCookies(res).find((c) => c.startsWith(`${name}=`));
  if (!line) return undefined;
  const pair = line.split(';')[0];
  return pair.slice(name.length + 1) ? pair : undefined;
}

function googleSignIn(profile = googleProfile()) {
  return http
    .get('/api/auth/google/callback')
    .set(GOOGLE_PROFILE_HEADER, profile);
}

/** Google sign-in that must stop at the confirmation step; returns its cookie. */
async function startConfirmation(): Promise<string> {
  const res = await googleSignIn().expect(302);
  expect(res.headers.location).toBe(LINK_PAGE);
  const link = cookieNamed(res, 'google_link');
  expect(link).toBeDefined();
  return link;
}

function passwordLogin(password: string) {
  return http
    .post('/api/auth/login')
    .send({ identifier: OWNER_EMAIL, password });
}

async function sessionFromPasswordLogin(password: string): Promise<string> {
  const res = await passwordLogin(password).expect(201);
  return cookieNamed(res, 'auth_token');
}

function check(cookie: string) {
  return http.get('/api/auth/check').set('Cookie', cookie);
}

function advance(ms: number) {
  t.clock.now = new Date(t.clock.now.getTime() + ms);
}

async function storedUser(id: string): Promise<User> {
  return t.userRows.findOne({ where: { id } });
}

describe('nothing about a pre-registered account is reachable through Google before the confirmation step', () => {
  it('sends the Google sign-in to the confirmation screen without a session', async () => {
    const account = await preRegisteredLocalAccount();

    const res = await googleSignIn().expect(302);

    expect(res.headers.location).toBe(LINK_PAGE);
    expect(cookieNamed(res, 'auth_token')).toBeUndefined();
    const link = setCookies(res).find((c) => c.startsWith('google_link='));
    expect(link).toMatch(/HttpOnly/i);
    expect((await storedUser(account.id)).providerId).toBeFalsy();
  });

  it('does not let the confirmation cookie act as a session', async () => {
    await preRegisteredLocalAccount();
    const link = await startConfirmation();

    await check(link).expect(401);
    const token = link.slice('google_link='.length);
    await check(`auth_token=${token}`).expect(401);
  });

  it('shows the confirmation screen only the address Google proved', async () => {
    await preRegisteredLocalAccount();
    const link = await startConfirmation();

    const res = await http
      .get('/api/auth/google-link')
      .set('Cookie', link)
      .expect(200);

    expect(res.body).toEqual({ email: OWNER_EMAIL });
  });

  it('refuses the confirmation without the cookie of the browser that signed in', async () => {
    await preRegisteredLocalAccount();
    await startConfirmation();

    await http.get('/api/auth/google-link').expect(404);
    await http
      .post('/api/auth/google-link/set-password')
      .send({ newPassword: OWNER_NEW_PASSWORD })
      .expect(404);
    await passwordLogin(SQUATTER_PASSWORD).expect(201);
  });

  it('stops at the confirmation when the address was registered in other letter case', async () => {
    const account = await preRegisteredLocalAccount('Owner@Example.org');
    const squatterSession = t.sessionCookie(account, t.clock.now);
    advance(5000);

    const res = await googleSignIn().expect(302);

    expect(res.headers.location).toBe(LINK_PAGE);
    expect(cookieNamed(res, 'auth_token')).toBeUndefined();
    const link = cookieNamed(res, 'google_link');
    await http
      .post('/api/auth/google-link/set-password')
      .set('Cookie', link)
      .send({ newPassword: OWNER_NEW_PASSWORD })
      .expect(201);
    await check(squatterSession).expect(401);
    expect((await storedUser(account.id)).providerId).toBe(GOOGLE_ID);
  });

  it('refuses a Google sign-in whose address Google has not verified', async () => {
    const account = await preRegisteredLocalAccount();

    const res = await googleSignIn(
      googleProfile(OWNER_EMAIL, GOOGLE_ID, false),
    ).expect(403);

    expect(cookieNamed(res, 'google_link')).toBeUndefined();
    expect(cookieNamed(res, 'auth_token')).toBeUndefined();
    expect((await storedUser(account.id)).providerId).toBeFalsy();
  });

  it('expires the confirmation after 10 minutes', async () => {
    await preRegisteredLocalAccount();
    const link = await startConfirmation();

    advance(10 * 60 * 1000 + 1000);

    await http.get('/api/auth/google-link').set('Cookie', link).expect(404);
    await http
      .post('/api/auth/google-link/set-password')
      .set('Cookie', link)
      .send({ newPassword: OWNER_NEW_PASSWORD })
      .expect(404);
    await passwordLogin(SQUATTER_PASSWORD).expect(201);
  });
});

describe('the Google owner confirms the current password', () => {
  it('keeps that password and the earlier sessions, and records the Google identity', async () => {
    const account = await preRegisteredLocalAccount();
    const earlierSession = await sessionFromPasswordLogin(SQUATTER_PASSWORD);
    advance(5000);
    const link = await startConfirmation();

    const res = await http
      .post('/api/auth/google-link/confirm-password')
      .set('Cookie', link)
      .send({ password: SQUATTER_PASSWORD })
      .expect(201);

    const googleSession = cookieNamed(res, 'auth_token');
    expect(googleSession).toBeDefined();
    const me = await check(googleSession).expect(200);
    expect(me.body.user.id).toBe(account.id);
    await check(earlierSession).expect(200);
    await passwordLogin(SQUATTER_PASSWORD).expect(201);
    expect((await storedUser(account.id)).providerId).toBe(GOOGLE_ID);
    expect(t.activities).toEqual([]);
  });

  it('refuses a wrong password and leaves the account as it was', async () => {
    const account = await preRegisteredLocalAccount();
    const link = await startConfirmation();

    const res = await http
      .post('/api/auth/google-link/confirm-password')
      .set('Cookie', link)
      .send({ password: 'a-guess' })
      .expect(401);

    expect(cookieNamed(res, 'auth_token')).toBeUndefined();
    expect((await storedUser(account.id)).providerId).toBeFalsy();
    const again = await googleSignIn().expect(302);
    expect(again.headers.location).toBe(LINK_PAGE);
  });

  it('puts password attempts through the login captcha', async () => {
    const account = await preRegisteredLocalAccount();
    const link = await startConfirmation();

    await http
      .post('/api/auth/google-link/confirm-password')
      .set('Cookie', link)
      .send({ password: SQUATTER_PASSWORD, captchaToken: FAILING_CAPTCHA })
      .expect(400);

    expect((await storedUser(account.id)).providerId).toBeFalsy();
  });
});

describe('the Google owner sets a new password', () => {
  it('stops the old password and every earlier session; the new password and the Google session work', async () => {
    const account = await preRegisteredLocalAccount();
    const earlierSession = await sessionFromPasswordLogin(SQUATTER_PASSWORD);
    const forgedEarlierSession = t.sessionCookie(account, t.clock.now);
    advance(5000);
    const link = await startConfirmation();

    const res = await http
      .post('/api/auth/google-link/set-password')
      .set('Cookie', link)
      .send({ newPassword: OWNER_NEW_PASSWORD })
      .expect(201);

    const googleSession = cookieNamed(res, 'auth_token');
    await check(googleSession).expect(200);
    await check(earlierSession).expect(401);
    await check(forgedEarlierSession).expect(401);
    await passwordLogin(SQUATTER_PASSWORD).expect(401);
    advance(5000);
    const newPasswordSession =
      await sessionFromPasswordLogin(OWNER_NEW_PASSWORD);
    await check(newPasswordSession).expect(200);
    expect((await storedUser(account.id)).providerId).toBe(GOOGLE_ID);
  });

  it('keeps sessions issued in the same second as the new password', async () => {
    await preRegisteredLocalAccount();
    const link = await startConfirmation();
    await http
      .post('/api/auth/google-link/set-password')
      .set('Cookie', link)
      .send({ newPassword: OWNER_NEW_PASSWORD })
      .expect(201);

    const google = await googleSignIn().expect(302);
    await check(cookieNamed(google, 'auth_token')).expect(200);
    await check(await sessionFromPasswordLogin(OWNER_NEW_PASSWORD)).expect(200);
  });

  it('records in the activity log that the password was replaced through a verified Google sign-in', async () => {
    const account = await preRegisteredLocalAccount();
    const link = await startConfirmation();

    await http
      .post('/api/auth/google-link/set-password')
      .set('Cookie', link)
      .send({ newPassword: OWNER_NEW_PASSWORD })
      .expect(201);

    expect(t.activities).toHaveLength(1);
    expect(t.activities[0]).toMatchObject({
      type: 'account.google_password_replaced',
      entityType: 'user',
      entityId: account.id,
      userId: account.id,
    });
  });

  it('accepts the confirmation only once', async () => {
    await preRegisteredLocalAccount();
    const link = await startConfirmation();
    await http
      .post('/api/auth/google-link/set-password')
      .set('Cookie', link)
      .send({ newPassword: OWNER_NEW_PASSWORD })
      .expect(201);

    await http
      .post('/api/auth/google-link/set-password')
      .set('Cookie', link)
      .send({ newPassword: 'yet-another-one' })
      .expect(404);
    await passwordLogin(OWNER_NEW_PASSWORD).expect(201);
  });
});

describe('after the confirmation both sign-in methods work on the same account', () => {
  it.each([
    ['confirm-password', { password: SQUATTER_PASSWORD }, SQUATTER_PASSWORD],
    ['set-password', { newPassword: OWNER_NEW_PASSWORD }, OWNER_NEW_PASSWORD],
  ])(
    'after %s, Google signs straight in and the password still works',
    async (step, body, password) => {
      const account = await preRegisteredLocalAccount();
      const link = await startConfirmation();
      await http
        .post(`/api/auth/google-link/${step}`)
        .set('Cookie', link)
        .send(body)
        .expect(201);
      advance(5000);

      const res = await googleSignIn().expect(302);
      expect(res.headers.location).toBe('/');
      const me = await check(cookieNamed(res, 'auth_token')).expect(200);
      expect(me.body.user.id).toBe(account.id);
      const pw = await check(await sessionFromPasswordLogin(password)).expect(
        200,
      );
      expect(pw.body.user.id).toBe(account.id);
    },
  );
});

describe('accounts that do not need the confirmation behave as before', () => {
  it('a Google-only account signs straight in with Google', async () => {
    const account = await t.users.create(
      { email: OWNER_EMAIL, provider: 'google', providerId: GOOGLE_ID },
      OWNER_EMAIL,
    );
    const earlier = t.sessionCookie(account, t.clock.now);
    advance(5000);

    const res = await googleSignIn().expect(302);

    expect(res.headers.location).toBe('/');
    const me = await check(cookieNamed(res, 'auth_token')).expect(200);
    expect(me.body.user.id).toBe(account.id);
    await check(earlier).expect(200);
  });

  it('an account already using Google and a password keeps both and its sessions', async () => {
    const account = await t.users.create(
      { email: OWNER_EMAIL, provider: 'google', providerId: GOOGLE_ID },
      OWNER_EMAIL,
    );
    await t.users.setPassword(
      account.id,
      { newPassword: SQUATTER_PASSWORD },
      OWNER_EMAIL,
    );
    const earlier = await sessionFromPasswordLogin(SQUATTER_PASSWORD);
    advance(5000);

    const res = await googleSignIn().expect(302);

    expect(res.headers.location).toBe('/');
    await check(cookieNamed(res, 'auth_token')).expect(200);
    await check(earlier).expect(200);
    await passwordLogin(SQUATTER_PASSWORD).expect(201);
  });

  it('a password-only account signs in with its password and keeps its sessions', async () => {
    const account = await preRegisteredLocalAccount();
    const earlier = t.sessionCookie(account, t.clock.now);
    advance(5000);

    const session = await sessionFromPasswordLogin(SQUATTER_PASSWORD);

    await check(session).expect(200);
    await check(earlier).expect(200);
    expect((await storedUser(account.id)).providerId).toBeFalsy();
  });
});
