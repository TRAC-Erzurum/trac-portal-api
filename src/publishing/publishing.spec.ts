import { createHmac } from 'crypto';
import * as request from 'supertest';
import { BranchRole, GlobalRole } from '../auth/enums/role.enum';
import { MembershipStatus } from '../branch/enums/membership-status.enum';
import { Disaster } from '../disaster/entities';
import { DisasterRole } from '../disaster/enums/disaster-role.enum';
import { DisasterType } from '../disaster/enums/disaster-type.enum';
import { DisasterMembershipStatus } from '../disaster/enums/membership-status.enum';
import { User } from '../user/entities/user.entity';
import { LogCapture, LogLine } from '../../test/logging/log-capture';
import { FakeTarget } from '../../test/publishing/fake-target';
import {
  createPublishingTestApp,
  PublishingTestApp,
} from '../../test/publishing/publishing-test-app';
import { PublicationStatus } from './enums/publication-status.enum';
import { PublicationDeliveryService } from './services/publication-delivery.service';

const SOURCE_ID = 'src-trac-erzurum';
const TARGET_KEY = 'fixture-hmac-key-not-real';
const MINUTE = 60_000;

let t: PublishingTestApp;
let http: ReturnType<typeof request>;
let target: FakeTarget;
let superAdmin: User;
let disasterAdmin: User;
let fieldOperator: User;

beforeEach(async () => {
  t = await createPublishingTestApp();
  http = request(t.app.getHttpServer());
  target = new FakeTarget(SOURCE_ID, TARGET_KEY, () => t.clock.now);
  await target.start();
  superAdmin = t.users.add({
    email: 'root@trac.example',
    provider: 'local',
    globalRole: GlobalRole.SUPER_ADMIN,
  });
  disasterAdmin = operator('TA9ADM', 'admin@trac.example');
  fieldOperator = operator('TA9FLD', 'field@trac.example');
});

afterEach(async () => {
  await target.stop();
  await t.app.close();
});

function operator(callSign: string, email: string): User {
  return t.users.add({
    email,
    provider: 'google',
    fullName: `Operator ${callSign}`,
    callSign,
    memberships: [
      { status: MembershipStatus.APPROVED, role: BranchRole.MEMBER },
    ],
  });
}

function as(user: User) {
  return t.sessionCookie(user);
}

async function deliver() {
  return t.app.get(PublicationDeliveryService).deliverDue();
}

function advance(ms: number) {
  t.clock.now = new Date(t.clock.now.getTime() + ms);
}

async function registerTarget(secret = TARGET_KEY): Promise<string> {
  const res = await http
    .post('/api/publishing/targets')
    .set('Cookie', as(superAdmin))
    .send({
      name: 'Afet Haberleşme Portalı',
      intakeUrl: target.url,
      sourceId: SOURCE_ID,
      sharedSecret: secret,
    })
    .expect(201);
  return res.body.id;
}

async function createDisaster(name = 'Erzurum Tatbikatı'): Promise<Disaster> {
  const disaster = await t.repos.disasters.save({
    name,
    type: DisasterType.EARTHQUAKE_DRILL,
    metadata: null,
    archivedAt: null,
    publishingEnabled: false,
    publishTargetId: null,
  } as unknown as Disaster);
  await addMember(disaster.id, disasterAdmin, DisasterRole.ADMIN);
  await addMember(disaster.id, fieldOperator, DisasterRole.FIELD_OFFICER);
  return disaster;
}

async function addMember(disasterId: string, user: User, role: DisasterRole) {
  await t.repos.memberships.save({
    disasterId,
    userId: user.id,
    role,
    status: DisasterMembershipStatus.APPROVED,
  } as never);
}

function setPublishing(
  disasterId: string,
  body: { enabled?: boolean; targetId?: string | null },
  user: User = disasterAdmin,
) {
  return http
    .patch(`/api/disaster/${disasterId}/publishing`)
    .set('Cookie', as(user))
    .send(body);
}

async function observe(
  disasterId: string,
  body: Record<string, unknown> = {},
  user: User = fieldOperator,
): Promise<string> {
  const res = await http
    .post(`/api/disaster/${disasterId}/observations`)
    .set('Cookie', as(user))
    .send({
      type: 'COLLAPSED_BUILDING',
      lat: 39.9055,
      lng: 41.2658,
      locationLabel: 'Cumhuriyet Cd. 12',
      severity: 'HIGH',
      description: 'Beş katlı bina çöktü',
      eventTime: '2026-09-28T08:55:00.000Z',
      ...body,
    })
    .expect(201);
  return res.body.id;
}

/** A disaster publishing to a registered target the target has linked. */
async function publishingDisaster(): Promise<{
  disaster: Disaster;
  targetId: string;
}> {
  const targetId = await registerTarget();
  const disaster = await createDisaster();
  target.linkedIncidents.add(disaster.id);
  await setPublishing(disaster.id, { enabled: true, targetId }).expect(200);
  return { disaster, targetId };
}

async function queueRow(observationId: string) {
  const row = t.repos.queue.rows.find((r) => r.observationId === observationId);
  if (!row) throw new Error(`no queue row for ${observationId}`);
  return row;
}

describe('an observation created in a disaster with publishing on', () => {
  it('reaches the target as a translated record', async () => {
    const { disaster } = await publishingDisaster();
    const id = await observe(disaster.id);

    await deliver();

    const record = target.records.get(id);
    expect(record).toBeDefined();
    expect(record.body).toEqual({
      externalId: id,
      externalIncidentId: disaster.id,
      type: 'collapsedBuilding',
      severity: 'high',
      description: 'Beş katlı bina çöktü',
      lat: 39.9055,
      lng: 41.2658,
      locationLabel: 'Cumhuriyet Cd. 12',
      observedAt: '2026-09-28T08:55:00.000Z',
      reporter: {
        email: 'field@trac.example',
        label: 'TA9FLD',
        verified: true,
      },
    });
    expect((await queueRow(id)).status).toBe(PublicationStatus.DELIVERED);
  });

  it('labels a reporter without a call sign by full name and as unverified', async () => {
    const { disaster } = await publishingDisaster();
    const guest = t.users.add({
      email: 'misafir@example.org',
      provider: 'local',
      fullName: 'Mehmet Kaya',
      callSign: null,
    });
    await addMember(disaster.id, guest, DisasterRole.FIELD_OFFICER);
    const id = await observe(disaster.id, { severity: undefined }, guest);

    await deliver();

    const body = target.records.get(id).body;
    expect(body.reporter).toEqual({
      email: 'misafir@example.org',
      label: 'Mehmet Kaya',
      verified: false,
    });
    expect(body).not.toHaveProperty('severity');
  });

  it('shows the queue counts in the disaster settings', async () => {
    const { disaster, targetId } = await publishingDisaster();
    await observe(disaster.id);
    await observe(disaster.id);
    let res = await http
      .get(`/api/disaster/${disaster.id}/publishing`)
      .set('Cookie', as(disasterAdmin))
      .expect(200);
    expect(res.body).toMatchObject({
      enabled: true,
      target: { id: targetId, name: 'Afet Haberleşme Portalı' },
      counts: { waiting: 2, delivered: 0, failed: 0 },
    });

    await deliver();

    res = await http
      .get(`/api/disaster/${disaster.id}/publishing`)
      .set('Cookie', as(disasterAdmin))
      .expect(200);
    expect(res.body.counts).toEqual({ waiting: 0, delivered: 2, failed: 0 });
  });
});

describe('creating an observation in a disaster with publishing on', () => {
  it('stores neither the observation nor its queue row when queueing fails', async () => {
    const { disaster } = await publishingDisaster();
    t.repos.queue.save = () => Promise.reject(new Error('queue insert failed'));

    const res = await http
      .post(`/api/disaster/${disaster.id}/observations`)
      .set('Cookie', as(fieldOperator))
      .send({ type: 'COLLAPSED_BUILDING', lat: 39.9, lng: 41.27 });

    expect(res.status).toBe(500);
    expect(t.repos.observations.rows).toHaveLength(0);
    expect(t.repos.queue.rows).toHaveLength(0);
  });
});

describe('a disaster with publishing off', () => {
  it('never sends an observation, even after publishing is turned on later', async () => {
    const targetId = await registerTarget();
    const disaster = await createDisaster();
    target.linkedIncidents.add(disaster.id);
    await observe(disaster.id);
    await setPublishing(disaster.id, { targetId }).expect(200);
    await observe(disaster.id);

    await deliver();
    await setPublishing(disaster.id, { enabled: true }).expect(200);
    advance(MINUTE);
    await deliver();

    expect(target.requests).toHaveLength(0);
    expect(t.repos.queue.rows).toHaveLength(0);
  });

  it('holds already queued observations until it is turned back on', async () => {
    const { disaster } = await publishingDisaster();
    const id = await observe(disaster.id);
    await setPublishing(disaster.id, { enabled: false }).expect(200);

    await deliver();
    advance(60 * MINUTE);
    await deliver();
    expect(target.requests).toHaveLength(0);

    await setPublishing(disaster.id, { enabled: true }).expect(200);
    await deliver();
    expect(target.records.has(id)).toBe(true);
  });
});

describe('turning publishing off', () => {
  it('stops a delivery run that is already under way', async () => {
    const { disaster } = await publishingDisaster();
    const first = await observe(disaster.id);
    const second = await observe(disaster.id);
    // The admin turns publishing off while the first record is being answered.
    target.afterResponse = async () => {
      target.afterResponse = null;
      await setPublishing(disaster.id, { enabled: false }).expect(200);
    };

    await deliver();

    expect(target.requests.map((r) => r.body?.externalId)).toEqual([first]);
    expect((await queueRow(second)).status).toBe(PublicationStatus.PENDING);
  });

  it('does not withdraw records already delivered', async () => {
    const { disaster } = await publishingDisaster();
    const id = await observe(disaster.id);
    await deliver();
    const sent = target.requests.length;

    await setPublishing(disaster.id, { enabled: false }).expect(200);
    advance(60 * MINUTE);
    await deliver();

    expect(target.requests).toHaveLength(sent);
    expect(target.records.get(id)?.resolvedBy).toBeNull();
    expect((await queueRow(id)).status).toBe(PublicationStatus.DELIVERED);
  });
});

describe('the publishing switch', () => {
  it('cannot be changed by anyone but an administrator of that disaster', async () => {
    const targetId = await registerTarget();
    const disaster = await createDisaster();
    const other = await createDisaster('Başka afet');
    const otherAdmin = operator('TA9OTH', 'other@trac.example');
    await addMember(other.id, otherAdmin, DisasterRole.ADMIN);
    const branchPresident = t.users.add({
      email: 'baskan@trac.example',
      provider: 'google',
      callSign: 'TA9PRS',
      memberships: [
        { status: MembershipStatus.APPROVED, role: BranchRole.PRESIDENT },
      ],
    });

    for (const user of [fieldOperator, otherAdmin, branchPresident]) {
      await setPublishing(
        disaster.id,
        { enabled: true, targetId },
        user,
      ).expect(403);
      await http
        .get(`/api/disaster/${disaster.id}/publishing`)
        .set('Cookie', as(user))
        .expect(403);
    }
    const stored = await t.repos.disasters.findOne({
      where: { id: disaster.id },
    });
    expect(stored).toMatchObject({
      publishingEnabled: false,
      publishTargetId: null,
    });

    await setPublishing(disaster.id, { enabled: true, targetId }).expect(200);
    expect(
      await t.repos.disasters.findOne({ where: { id: disaster.id } }),
    ).toMatchObject({ publishingEnabled: true, publishTargetId: targetId });
  });

  it('cannot be turned on without a selected target', async () => {
    const disaster = await createDisaster();
    await setPublishing(disaster.id, { enabled: true }).expect(400);
  });

  it('leaves the target registry to super admins', async () => {
    await http
      .get('/api/publishing/targets')
      .set('Cookie', as(disasterAdmin))
      .expect(403);
    await http
      .post('/api/publishing/targets')
      .set('Cookie', as(disasterAdmin))
      .send({
        name: 'x',
        intakeUrl: target.url,
        sourceId: 's',
        sharedSecret: 'y',
      })
      .expect(403);
  });
});

describe('an unreachable target', () => {
  it('accumulates observations in the queue and receives them when it returns', async () => {
    const { disaster } = await publishingDisaster();
    target.unreachable = true;
    const ids = [
      await observe(disaster.id),
      await observe(disaster.id, { type: 'ROAD_BLOCKED' }),
      await observe(disaster.id, { type: 'MEDICAL_POINT' }),
    ];

    await deliver();
    for (const id of ids) {
      const row = await queueRow(id);
      expect(row.status).toBe(PublicationStatus.PENDING);
      expect(row.attempts).toBe(1);
      expect(row.nextAttemptAt).toEqual(
        new Date(t.clock.now.getTime() + MINUTE),
      );
    }

    advance(MINUTE);
    await deliver();
    for (const id of ids) {
      const row = await queueRow(id);
      expect(row.attempts).toBe(2);
      expect(row.nextAttemptAt).toEqual(
        new Date(t.clock.now.getTime() + 2 * MINUTE),
      );
    }

    target.unreachable = false;
    advance(MINUTE);
    await deliver();
    expect(target.records.size).toBe(0);

    advance(MINUTE);
    await deliver();
    expect([...target.records.keys()].sort()).toEqual([...ids].sort());
  });
});

describe('a record the target refuses', () => {
  it('waits on its own while the others keep flowing', async () => {
    const targetId = await registerTarget();
    const linked = await createDisaster('Bağlı');
    const unlinked = await createDisaster('Bağlanmamış');
    target.linkedIncidents.add(linked.id);
    await setPublishing(linked.id, { enabled: true, targetId }).expect(200);
    await setPublishing(unlinked.id, { enabled: true, targetId }).expect(200);

    const waiting = await observe(unlinked.id);
    const flowing = [await observe(linked.id), await observe(linked.id)];

    await deliver();
    expect([...target.records.keys()].sort()).toEqual([...flowing].sort());
    const row = await queueRow(waiting);
    expect(row.status).toBe(PublicationStatus.PENDING);
    expect(row.nextAttemptAt).toEqual(new Date(t.clock.now.getTime() + MINUTE));

    const later = await observe(linked.id);
    target.linkedIncidents.add(unlinked.id);
    await deliver();
    expect(target.records.has(later)).toBe(true);
    expect(target.records.has(waiting)).toBe(false);

    advance(MINUTE);
    await deliver();
    expect(target.records.has(waiting)).toBe(true);
  });

  it('is retried later when the target is overloaded (429), without holding the others', async () => {
    const { disaster } = await publishingDisaster();
    target.tooManyRequests = 1;
    const busy = await observe(disaster.id);
    const next = await observe(disaster.id);

    await deliver();
    expect(target.requests.map((r) => r.status)).toEqual([429, 201]);
    const row = await queueRow(busy);
    expect(row.status).toBe(PublicationStatus.PENDING);
    expect(row.attempts).toBe(1);
    expect(row.nextAttemptAt).toEqual(new Date(t.clock.now.getTime() + MINUTE));
    expect((await queueRow(next)).status).toBe(PublicationStatus.DELIVERED);

    advance(MINUTE);
    await deliver();
    expect(target.records.has(busy)).toBe(true);
    expect((await queueRow(busy)).status).toBe(PublicationStatus.DELIVERED);
  });

  it('is marked failed for good on 400 and 422, without holding the others', async () => {
    const { disaster, targetId } = await publishingDisaster();
    const closed = await createDisaster('Kapanmış');
    target.linkedIncidents.add(closed.id);
    target.closedIncidents.add(closed.id);
    await setPublishing(closed.id, { enabled: true, targetId }).expect(200);

    const invalid = await observe(disaster.id);
    target.invalidExternalIds.add(invalid);
    const inClosed = await observe(closed.id);
    const fine = await observe(disaster.id);

    await deliver();
    advance(24 * 60 * MINUTE);
    await deliver();

    expect((await queueRow(invalid)).status).toBe(PublicationStatus.FAILED);
    expect((await queueRow(inClosed)).status).toBe(PublicationStatus.FAILED);
    expect((await queueRow(fine)).status).toBe(PublicationStatus.DELIVERED);
    expect(
      target.requests.filter((r) => r.body?.externalId === invalid),
    ).toHaveLength(1);
    expect(
      target.requests.filter((r) => r.body?.externalId === inClosed),
    ).toHaveLength(1);
  });
});

describe('a resolution-type observation', () => {
  it('resolves the related record instead of creating a new one', async () => {
    const { disaster } = await publishingDisaster();
    const building = await observe(disaster.id);
    const extinguished = await observe(disaster.id, {
      type: 'FIRE_EXTINGUISHED',
      parentObservationId: building,
      description: 'Yangın söndürüldü',
    });

    await deliver();

    expect([...target.records.keys()]).toEqual([building]);
    expect(target.records.get(building).resolvedBy).toBe(extinguished);
    const sent = target.requests.find(
      (r) => r.body?.externalId === extinguished,
    );
    expect(sent.body.resolves).toBe(building);
    expect(sent.body).not.toHaveProperty('type');
    expect(sent.status).toBe(200);
    expect((await queueRow(extinguished)).status).toBe(
      PublicationStatus.DELIVERED,
    );
  });

  it('is not queued when its parent was never queued for the target', async () => {
    const targetId = await registerTarget();
    const disaster = await createDisaster();
    target.linkedIncidents.add(disaster.id);
    const building = await observe(disaster.id);
    await setPublishing(disaster.id, { enabled: true, targetId }).expect(200);
    const opened = await observe(disaster.id, {
      type: 'RESCUE_COMPLETED',
      parentObservationId: building,
    });

    await deliver();

    expect(t.repos.queue.rows.find((r) => r.observationId === opened)).toBe(
      undefined,
    );
    expect(target.requests).toHaveLength(0);
  });

  it('never publishes progress types', async () => {
    const { disaster } = await publishingDisaster();
    const building = await observe(disaster.id);
    for (const type of ['DEBRIS_REMOVED', 'STRUCTURE_SECURED']) {
      await observe(disaster.id, { type, parentObservationId: building });
    }

    await deliver();

    expect(target.requests.map((r) => r.body?.externalId)).toEqual([building]);
    expect(t.repos.queue.rows).toHaveLength(1);
  });
});

describe('delivering the same observation twice', () => {
  it('produces one record at the target', async () => {
    const { disaster } = await publishingDisaster();
    const id = await observe(disaster.id);
    await deliver();
    // As if the portal crashed after sending but before recording the result.
    await t.repos.queue.update(
      { observationId: id },
      {
        status: PublicationStatus.PENDING,
        nextAttemptAt: t.clock.now,
      },
    );

    await deliver();

    const sent = target.requests.filter((r) => r.body?.externalId === id);
    expect(sent.map((r) => r.status)).toEqual([201, 200]);
    expect(sent[0].rawBody).toBe(sent[1].rawBody);
    expect(target.records.size).toBe(1);
    expect((await queueRow(id)).status).toBe(PublicationStatus.DELIVERED);
  });
});

describe('the shared secret', () => {
  it('appears in no API response', async () => {
    const responses: unknown[] = [];
    const created = await http
      .post('/api/publishing/targets')
      .set('Cookie', as(superAdmin))
      .send({
        name: 'Hedef',
        intakeUrl: target.url,
        sourceId: SOURCE_ID,
        sharedSecret: TARGET_KEY,
      })
      .expect(201);
    responses.push(created.body);
    const targetId = created.body.id;
    responses.push(
      (
        await http
          .get('/api/publishing/targets')
          .set('Cookie', as(superAdmin))
          .expect(200)
      ).body,
    );
    responses.push(
      (
        await http
          .patch(`/api/publishing/targets/${targetId}`)
          .set('Cookie', as(superAdmin))
          .send({ name: 'Hedef 2', sharedSecret: `${TARGET_KEY}-new` })
          .expect(200)
      ).body,
    );
    const disaster = await createDisaster();
    responses.push(
      (
        await setPublishing(disaster.id, { enabled: true, targetId }).expect(
          200,
        )
      ).body,
    );
    responses.push(
      (
        await http
          .get(`/api/disaster/${disaster.id}/publishing`)
          .set('Cookie', as(disasterAdmin))
          .expect(200)
      ).body,
    );

    const all = JSON.stringify(responses);
    expect(all).not.toContain(TARGET_KEY);
    expect(all).not.toContain('sharedSecret');
    expect(created.body).toMatchObject({
      name: 'Hedef',
      intakeUrl: target.url,
      sourceId: SOURCE_ID,
      active: true,
    });
  });

  it('when wrong, holds every row of the target until it is changed', async () => {
    const targetId = await registerTarget('wrong-secret');
    const disaster = await createDisaster();
    target.linkedIncidents.add(disaster.id);
    await setPublishing(disaster.id, { enabled: true, targetId }).expect(200);
    const first = await observe(disaster.id);
    const second = await observe(disaster.id);

    await deliver();
    expect(target.requests.map((r) => r.status)).toEqual([401]);
    const listed = await http
      .get('/api/publishing/targets')
      .set('Cookie', as(superAdmin))
      .expect(200);
    expect(listed.body[0].authFailing).toBe(true);

    advance(24 * 60 * MINUTE);
    await deliver();
    expect(target.requests).toHaveLength(1);
    expect((await queueRow(first)).status).toBe(PublicationStatus.PENDING);
    expect((await queueRow(second)).status).toBe(PublicationStatus.PENDING);

    await http
      .patch(`/api/publishing/targets/${targetId}`)
      .set('Cookie', as(superAdmin))
      .send({ sharedSecret: TARGET_KEY })
      .expect(200);
    await deliver();
    expect([...target.records.keys()].sort()).toEqual([first, second].sort());
  });
});

describe('every delivery', () => {
  it('carries a valid signature and timestamp per the contract', async () => {
    const { disaster } = await publishingDisaster();
    const building = await observe(disaster.id);
    await observe(disaster.id, {
      type: 'GAS_LEAK_RESOLVED',
      parentObservationId: building,
    });
    target.unreachable = true;
    await observe(disaster.id, { type: 'OTHER' });
    await deliver();
    target.unreachable = false;
    advance(MINUTE);
    await deliver();

    expect(target.requests.length).toBeGreaterThanOrEqual(3);
    for (const req of target.requests) {
      expect(req.signatureValid).toBe(true);
      expect(req.timestampFresh).toBe(true);
      expect(req.headers['x-source-id']).toBe(SOURCE_ID);
      expect(req.headers['content-type']).toMatch(/^application\/json/);
      const ts = req.headers['x-timestamp'];
      expect(req.headers['x-signature']).toBe(
        `sha256=${createHmac('sha256', TARGET_KEY).update(`${ts}.${req.rawBody}`).digest('hex')}`,
      );
    }
    const last = target.requests[target.requests.length - 1];
    expect(last.headers['x-timestamp']).toBe(
      String(Math.floor(t.clock.now.getTime() / 1000)),
    );
  });
});

describe('every delivery attempt', () => {
  const logs = new LogCapture();
  beforeEach(() => logs.install());
  afterEach(() => {
    logs.uninstall();
    logs.clear();
  });

  function attempts(observationId: string): LogLine[] {
    return logs
      .events('publishing.delivery')
      .filter((l) => l.observationId === observationId);
  }

  it('leaves one line for a delivered record', async () => {
    const { disaster, targetId } = await publishingDisaster();
    const id = await observe(disaster.id);
    logs.clear();

    await deliver();

    const lines = attempts(id);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'info',
      targetId,
      disasterId: disaster.id,
      observationId: id,
      status: 201,
      classification: 'delivered',
      attempt: 1,
      nextAttemptAt: null,
    });
    expect(typeof lines[0].durationMs).toBe('number');
  });

  it('says when an unreachable target will be tried again, and how many times it was', async () => {
    const { disaster } = await publishingDisaster();
    target.unreachable = true;
    const id = await observe(disaster.id);

    await deliver();
    advance(MINUTE);
    await deliver();

    const lines = attempts(id);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({
      level: 'warn',
      status: null,
      classification: 'retry',
      attempt: 2,
      nextAttemptAt: new Date(t.clock.now.getTime() + 2 * MINUTE).toISOString(),
    });
    expect(lines[1].error).toEqual(expect.any(String));
  });

  it('records the status of a record refused for good, and of a refused signature', async () => {
    const { disaster } = await publishingDisaster();
    const invalid = await observe(disaster.id);
    target.invalidExternalIds.add(invalid);
    await deliver();
    expect(attempts(invalid)).toEqual([
      expect.objectContaining({
        level: 'error',
        status: 400,
        classification: 'failed',
        attempt: 1,
        nextAttemptAt: null,
      }),
    ]);

    const targetId = await registerTarget('wrong-secret');
    const other = await createDisaster('Yanlış anahtar');
    target.linkedIncidents.add(other.id);
    await setPublishing(other.id, { enabled: true, targetId }).expect(200);
    const held = await observe(other.id);
    await deliver();
    expect(attempts(held)).toEqual([
      expect.objectContaining({
        level: 'error',
        targetId,
        status: 401,
        classification: 'authentication-failed',
        attempt: 1,
      }),
    ]);
  });

  it('logs a resolve dropped because its record was refused', async () => {
    const { disaster } = await publishingDisaster();
    const building = await observe(disaster.id);
    target.invalidExternalIds.add(building);
    const resolve = await observe(disaster.id, {
      type: 'FIRE_EXTINGUISHED',
      parentObservationId: building,
    });

    await deliver();

    expect(attempts(resolve)).toEqual([
      expect.objectContaining({
        level: 'error',
        status: null,
        classification: 'failed',
        error: 'parent_failed',
        attempt: 1,
      }),
    ]);
  });

  it('never writes the shared secret, the signature or a reporter email', async () => {
    const { disaster } = await publishingDisaster();
    await observe(disaster.id);
    const invalid = await observe(disaster.id, { type: 'ROAD_BLOCKED' });
    target.invalidExternalIds.add(invalid);
    const refused = await observe(disaster.id);
    target.invalidExternalIds.add(refused);
    await observe(disaster.id, {
      type: 'FIRE_EXTINGUISHED',
      parentObservationId: refused,
    });
    await deliver();
    target.tooManyRequests = 1;
    await observe(disaster.id, { type: 'MEDICAL_POINT' });
    await deliver();
    target.unreachable = true;
    await observe(disaster.id, { type: 'OTHER' });
    advance(MINUTE);
    await deliver();
    target.unreachable = false;
    const wrongKey = 'wrong-secret-for-log-test';
    const badTarget = await registerTarget(wrongKey);
    const other = await createDisaster('Yanlış anahtar');
    target.linkedIncidents.add(other.id);
    await setPublishing(other.id, {
      enabled: true,
      targetId: badTarget,
    }).expect(200);
    await observe(other.id);
    advance(MINUTE);
    await deliver();

    const lines = logs.events('publishing.delivery');
    expect(new Set(lines.map((l) => l.classification))).toEqual(
      new Set(['delivered', 'retry', 'failed', 'authentication-failed']),
    );
    expect(lines.some((l) => l.error === 'parent_failed')).toBe(true);
    expect(lines.some((l) => l.status === null && l.error)).toBe(true);
    const output = logs.raw;
    const secrets = [
      TARGET_KEY,
      wrongKey,
      'field@trac.example',
      'admin@trac.example',
      'root@trac.example',
      ...target.requests.map((r) => r.headers['x-signature']),
    ];
    for (const secret of secrets) {
      expect(output).not.toContain(secret);
    }
  });
});
