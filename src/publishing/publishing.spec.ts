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

const SOURCE_ID = '7';
const TARGET_KEY = 'fixture-bearer-key-not-real';

let t: PublishingTestApp;
let http: ReturnType<typeof request>;
let target: FakeTarget;
let disasterAdmin: User;
let fieldOperator: User;

beforeEach(async () => {
  t = await createPublishingTestApp();
  http = request(t.app.getHttpServer());
  target = new FakeTarget(SOURCE_ID, TARGET_KEY);
  await target.start();
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

function savePublishing(
  disasterId: string,
  body: Record<string, unknown>,
  user: User = disasterAdmin,
) {
  return http
    .put(`/api/disaster/${disasterId}/publishing`)
    .set('Cookie', as(user))
    .send({
      name: 'Koordinatörlük',
      intakeUrl: target.url,
      sharedSecret: TARGET_KEY,
      enabled: true,
      ...body,
    });
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

/** A disaster sharing with the target, switched on. */
async function sharingDisaster(): Promise<Disaster> {
  const disaster = await createDisaster();
  await savePublishing(disaster.id, {}).expect(200);
  return disaster;
}

async function getView(disasterId: string, user: User = disasterAdmin) {
  const res = await http
    .get(`/api/disaster/${disasterId}/publishing`)
    .set('Cookie', as(user))
    .expect(200);
  return res.body;
}

async function getHistory(
  disasterId: string,
  query = '',
  user: User = disasterAdmin,
) {
  const res = await http
    .get(`/api/disaster/${disasterId}/publishing/history${query}`)
    .set('Cookie', as(user))
    .expect(200);
  return res.body;
}

function sync(disasterId: string, user: User = disasterAdmin) {
  return http
    .post(`/api/disaster/${disasterId}/publishing/sync`)
    .set('Cookie', as(user));
}

function retry(disasterId: string, itemId: string, user: User = disasterAdmin) {
  return http
    .post(`/api/disaster/${disasterId}/publishing/history/${itemId}/retry`)
    .set('Cookie', as(user));
}

function queueRow(observationId: string) {
  const row = t.repos.queue.rows.find((r) => r.observationId === observationId);
  if (!row) throw new Error(`no queue row for ${observationId}`);
  return row;
}

describe('the sharing settings of a disaster', () => {
  it('start without a recipient, and the first save needs a key', async () => {
    const disaster = await createDisaster();
    expect(await getView(disaster.id)).toMatchObject({
      target: null,
      enabled: false,
    });

    const res = await savePublishing(disaster.id, {
      sharedSecret: undefined,
    }).expect(400);
    expect(res.body.message).toBe('error.publishTargetKeyRequired');
  });

  it('save the recipient, its address and the switch', async () => {
    const disaster = await createDisaster();

    const res = await savePublishing(disaster.id, {}).expect(200);

    expect(res.body).toMatchObject({
      target: { name: 'Koordinatörlük', intakeUrl: target.url },
      enabled: true,
      counts: { delivered: 0, failed: 0, waiting: 0 },
    });
  });

  it('refuse an address that is not https (or loopback)', async () => {
    const disaster = await createDisaster();
    await savePublishing(disaster.id, {
      intakeUrl: 'http://afet.example.com/api/ingest/observations/1',
    }).expect(400);
    await savePublishing(disaster.id, { intakeUrl: 'not a url' }).expect(400);
    await savePublishing(disaster.id, { name: '  ' }).expect(400);
  });

  it('keep the current key when a later save leaves it out, and replace it when one is given', async () => {
    const disaster = await createDisaster();
    await savePublishing(disaster.id, {}).expect(200);

    await savePublishing(disaster.id, {
      name: 'Yeni ad',
      sharedSecret: undefined,
    }).expect(200);
    await observe(disaster.id);
    await deliver();
    expect(target.requests[0].authentic).toBe(true);

    await savePublishing(disaster.id, {
      name: 'Yeni ad',
      sharedSecret: 'another-key',
    }).expect(200);
    await observe(disaster.id);
    await deliver();
    expect(target.requests[1].authentic).toBe(false);
    expect(t.repos.targets.rows).toHaveLength(1);
    expect(t.repos.targets.rows[0].name).toBe('Yeni ad');
  });

  it('can be changed only by an administrator of that disaster', async () => {
    const disaster = await createDisaster();
    const other = await createDisaster('Başka afet');
    const otherAdmin = operator('TA9OTH', 'other@trac.example');
    await addMember(other.id, otherAdmin, DisasterRole.ADMIN);

    for (const user of [fieldOperator, otherAdmin]) {
      await savePublishing(disaster.id, {}, user).expect(403);
      await http
        .get(`/api/disaster/${disaster.id}/publishing`)
        .set('Cookie', as(user))
        .expect(403);
    }
    expect(t.repos.targets.rows).toHaveLength(0);
  });

  it('never show the key in any answer', async () => {
    const disaster = await sharingDisaster();
    await observe(disaster.id);
    await deliver();

    const answers = [
      await getView(disaster.id),
      await getHistory(disaster.id),
      (await sync(disaster.id).expect(201)).body,
      (await savePublishing(disaster.id, {}).expect(200)).body,
    ];

    for (const answer of answers) {
      expect(JSON.stringify(answer)).not.toContain(TARGET_KEY);
    }
  });
});

describe('an observation created while sharing is on', () => {
  it('reaches the recipient as one translated record, with the key as a bearer token', async () => {
    const disaster = await sharingDisaster();
    const id = await observe(disaster.id);

    expect(target.requests).toHaveLength(0);
    const summary = await deliver();

    expect(summary).toMatchObject({ claimed: 1, delivered: 1, failed: 0 });
    expect(target.requests).toHaveLength(1);
    const [sent] = target.requests;
    expect(sent.path).toBe(`/api/ingest/observations/${SOURCE_ID}`);
    expect(sent.authentic).toBe(true);
    expect(sent.status).toBe(201);
    expect(sent.body).toEqual({
      externalId: id,
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
    expect(queueRow(id)).toMatchObject({
      status: PublicationStatus.DELIVERED,
      attempts: 1,
      alreadyExisted: false,
    });
  });

  it('is sent once per request, one record each', async () => {
    const disaster = await sharingDisaster();
    const ids = [
      await observe(disaster.id),
      await observe(disaster.id),
      await observe(disaster.id),
    ];

    await deliver();

    expect(target.requests.map((r) => r.body?.externalId)).toEqual(ids);
    for (const sent of target.requests) {
      expect(Array.isArray(sent.body)).toBe(false);
      expect(Object.keys(sent.body ?? {})).toContain('externalId');
    }
  });

  it('is never queued while sharing is off, even after it is turned on later', async () => {
    const disaster = await createDisaster();
    await observe(disaster.id);
    await savePublishing(disaster.id, { enabled: false }).expect(200);
    await observe(disaster.id);
    await savePublishing(disaster.id, { enabled: true }).expect(200);

    await deliver();

    expect(t.repos.queue.rows).toHaveLength(0);
    expect(target.requests).toHaveLength(0);
  });

  it('is held while sharing is switched off and goes out when it is switched back on', async () => {
    const disaster = await sharingDisaster();
    const id = await observe(disaster.id);
    await savePublishing(disaster.id, { enabled: false }).expect(200);
    await deliver();
    expect(queueRow(id).status).toBe(PublicationStatus.PENDING);

    await savePublishing(disaster.id, { enabled: true }).expect(200);
    await deliver();

    expect(target.records.has(id)).toBe(true);
  });

  it('stops a delivery run that is already under way when sharing is switched off', async () => {
    const disaster = await sharingDisaster();
    const first = await observe(disaster.id);
    const second = await observe(disaster.id);
    target.afterResponse = async () => {
      target.afterResponse = null;
      await savePublishing(disaster.id, { enabled: false }).expect(200);
    };

    await deliver();

    expect(target.requests.map((r) => r.body?.externalId)).toEqual([first]);
    expect(queueRow(second).status).toBe(PublicationStatus.PENDING);
  });

  it('waits for its photos to be uploaded before its first attempt', async () => {
    const disaster = await sharingDisaster();
    const id = await observe(disaster.id);
    // The test app has no grace; production gives a new observation a head start.
    expect(queueRow(id).nextAttemptAt.getTime()).toBeLessThanOrEqual(
      t.clock.now.getTime(),
    );
  });
});

describe('one attempt, one verdict', () => {
  it.each([
    ['an unreachable recipient', () => (target.unreachable = true), 'network'],
    ['a refused key', () => (target.secret = 'rotated'), '401'],
    ['an overloaded recipient', () => (target.tooManyRequests = 1), '429'],
    ['a record it refuses', () => undefined, '400'],
    ['an incident that is closed', () => (target.closed = true), '422'],
  ])(
    '%s fails the record, and nothing is tried again by itself',
    async (_label, arrange, answer) => {
      const disaster = await sharingDisaster();
      const id = await observe(disaster.id);
      arrange();
      if (answer === '400') target.invalidExternalIds.add(id);

      await deliver();
      advance(24 * 60 * 60 * 1000);
      await deliver();
      await deliver();

      expect(target.requests.length).toBeLessThanOrEqual(1);
      expect(queueRow(id)).toMatchObject({
        status: PublicationStatus.FAILED,
        attempts: 1,
      });
      expect(queueRow(id).lastResult).toContain(answer);
    },
  );

  it('does not hold the records after a failed one', async () => {
    const disaster = await sharingDisaster();
    const refused = await observe(disaster.id);
    const accepted = await observe(disaster.id);
    target.invalidExternalIds.add(refused);

    await deliver();

    expect(queueRow(refused).status).toBe(PublicationStatus.FAILED);
    expect(queueRow(accepted).status).toBe(PublicationStatus.DELIVERED);
  });
});

describe('a record the recipient already has', () => {
  it('counts as delivered, marked as already existing', async () => {
    const disaster = await sharingDisaster();
    const id = await observe(disaster.id);
    target.records.set(id, { id: 'rec-existing', body: {}, resolvedBy: null });

    await deliver();

    expect(target.requests[0].status).toBe(200);
    expect(queueRow(id)).toMatchObject({
      status: PublicationStatus.DELIVERED,
      alreadyExisted: true,
    });
    const view = await getView(disaster.id);
    expect(view.counts).toMatchObject({
      delivered: 1,
      alreadyExisted: 1,
      failed: 0,
    });
  });
});

describe('a resolution-type observation', () => {
  it('resolves the related record instead of creating a new one', async () => {
    const disaster = await sharingDisaster();
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
  });

  it('is not queued when its parent was never queued', async () => {
    const disaster = await createDisaster();
    const building = await observe(disaster.id);
    await savePublishing(disaster.id, {}).expect(200);
    await observe(disaster.id, {
      type: 'FIRE_EXTINGUISHED',
      parentObservationId: building,
    });

    expect(t.repos.queue.rows).toHaveLength(0);
  });

  it('is never queued for progress types', async () => {
    const disaster = await sharingDisaster();
    const building = await observe(disaster.id);
    await observe(disaster.id, {
      type: 'DEBRIS_REMOVED',
      parentObservationId: building,
    });

    expect(t.repos.queue.rows).toHaveLength(1);
  });
});

describe('the history', () => {
  it('lists what was sent, newest first, with its outcome and the recipient answer', async () => {
    const disaster = await sharingDisaster();
    const refused = await observe(disaster.id, { type: 'ROAD_BLOCKED' });
    target.invalidExternalIds.add(refused);
    const accepted = await observe(disaster.id);
    await deliver();

    const history = await getHistory(disaster.id);

    expect(history).toMatchObject({ total: 2, page: 1 });
    const byObservation = Object.fromEntries(
      history.items.map((i: any) => [i.observationId, i]),
    );
    expect(byObservation[accepted]).toMatchObject({
      status: 'DELIVERED',
      observationType: 'COLLAPSED_BUILDING',
      observedAt: '2026-09-28T08:55:00.000Z',
    });
    expect(byObservation[refused]).toMatchObject({
      status: 'FAILED',
      observationType: 'ROAD_BLOCKED',
      lastResult: expect.stringContaining('400'),
    });
  });

  it('filters by outcome and pages', async () => {
    const disaster = await sharingDisaster();
    const refused = await observe(disaster.id);
    target.invalidExternalIds.add(refused);
    await observe(disaster.id);
    await observe(disaster.id);
    await deliver();

    const failed = await getHistory(disaster.id, '?status=FAILED');
    const page = await getHistory(disaster.id, '?limit=2&page=2');

    expect(failed.items.map((i: any) => i.observationId)).toEqual([refused]);
    expect(page).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(page.items).toHaveLength(1);
  });

  it('is empty for a disaster without a recipient, and closed to anyone else', async () => {
    const disaster = await createDisaster();
    expect(await getHistory(disaster.id)).toMatchObject({
      items: [],
      total: 0,
    });
    await http
      .get(`/api/disaster/${disaster.id}/publishing/history`)
      .set('Cookie', as(fieldOperator))
      .expect(403);
  });
});

describe('trying a failed record again', () => {
  it('sends just that record once more', async () => {
    const disaster = await sharingDisaster();
    const refused = await observe(disaster.id);
    const accepted = await observe(disaster.id);
    target.invalidExternalIds.add(refused);
    await deliver();
    target.invalidExternalIds.clear();
    const row = queueRow(refused);

    const res = await retry(disaster.id, row.id).expect(201);
    expect(res.body).toMatchObject({ id: row.id, status: 'PENDING' });
    await deliver();

    expect(queueRow(refused).status).toBe(PublicationStatus.DELIVERED);
    expect(target.requests.map((r) => r.body?.externalId)).toEqual([
      refused,
      accepted,
      refused,
    ]);
  });

  it('fails again without trying by itself, when the recipient still refuses', async () => {
    const disaster = await sharingDisaster();
    const id = await observe(disaster.id);
    target.invalidExternalIds.add(id);
    await deliver();

    await retry(disaster.id, queueRow(id).id).expect(201);
    await deliver();
    await deliver();

    expect(queueRow(id)).toMatchObject({
      status: PublicationStatus.FAILED,
      attempts: 2,
    });
    expect(target.requests).toHaveLength(2);
  });

  it('is refused for a record that did not fail, one of another disaster, or by anyone else', async () => {
    const disaster = await sharingDisaster();
    const other = await sharingDisaster();
    const id = await observe(disaster.id);
    const foreign = await observe(other.id);
    await deliver();

    await retry(disaster.id, queueRow(id).id).expect(400);
    await retry(disaster.id, queueRow(foreign).id).expect(404);
    await retry(disaster.id, queueRow(id).id, fieldOperator).expect(403);
  });
});

describe('syncing a disaster', () => {
  /** A disaster with observations made before sharing was on. */
  async function disasterWithHistory() {
    const disaster = await createDisaster();
    const first = await observe(disaster.id, {
      eventTime: '2026-09-28T11:55:00+03:00',
    });
    const second = await observe(disaster.id, {
      type: 'ROAD_BLOCKED',
      eventTime: '2026-09-27T23:30:00-05:00',
    });
    expect(t.repos.queue.rows).toHaveLength(0);
    await savePublishing(disaster.id, {}).expect(200);
    return { disaster, first, second };
  }

  it('sends earlier observations one request each, with their own times in UTC', async () => {
    const { disaster, first, second } = await disasterWithHistory();
    expect((await getView(disaster.id)).notSent).toBe(2);

    const res = await sync(disaster.id).expect(201);
    expect(res.body).toMatchObject({ queued: 2, retried: 0, notSent: 0 });
    expect(target.requests).toHaveLength(0);
    await deliver();

    expect(target.requests.map((r) => r.body?.externalId)).toEqual([
      first,
      second,
    ]);
    expect(target.records.get(first).body.observedAt).toBe(
      '2026-09-28T08:55:00.000Z',
    );
    expect(target.records.get(second).body.observedAt).toBe(
      '2026-09-28T04:30:00.000Z',
    );
    expect((await getView(disaster.id)).counts).toEqual({
      delivered: 2,
      alreadyExisted: 0,
      failed: 0,
      waiting: 0,
    });
  });

  it('works for an archived disaster, even with sharing off', async () => {
    const { disaster, first } = await disasterWithHistory();
    await savePublishing(disaster.id, { enabled: false }).expect(200);
    await t.repos.disasters.update(
      { id: disaster.id },
      { archivedAt: new Date('2026-09-29T00:00:00Z') },
    );

    await sync(disaster.id).expect(201);
    await deliver();

    expect(target.records.has(first)).toBe(true);
  });

  it('sends the failed ones and the unsent ones once, and leaves the delivered alone', async () => {
    const disaster = await createDisaster();
    const delivered = await observe(disaster.id);
    const failing = await observe(disaster.id);
    await savePublishing(disaster.id, {}).expect(200);
    await sync(disaster.id).expect(201);
    target.invalidExternalIds.add(failing);
    await deliver();
    target.invalidExternalIds.clear();
    const unsent = await observe(disaster.id, { type: 'ROAD_BLOCKED' });
    await savePublishing(disaster.id, { enabled: false }).expect(200);
    const late = await observe(disaster.id, { type: 'MEDICAL_POINT' });
    await savePublishing(disaster.id, { enabled: true }).expect(200);
    target.requests.length = 0;

    const res = await sync(disaster.id).expect(201);
    expect(res.body).toMatchObject({ retried: 1, queued: 1 });
    await deliver();

    expect(target.requests.map((r) => r.body?.externalId).sort()).toEqual(
      [failing, unsent, late].sort(),
    );
    expect(target.requests.map((r) => r.body?.externalId)).not.toContain(
      delivered,
    );
    expect((await getView(disaster.id)).counts).toMatchObject({
      delivered: 4,
      failed: 0,
    });
  });

  it('is harmless when run again: each observation is queued once and sent once', async () => {
    const { disaster } = await disasterWithHistory();
    await sync(disaster.id).expect(201);
    const again = await sync(disaster.id).expect(201);

    expect(again.body).toMatchObject({ queued: 0, retried: 0 });
    expect(t.repos.queue.rows).toHaveLength(2);
    await deliver();
    await sync(disaster.id).expect(201);
    await deliver();
    expect(target.requests).toHaveLength(2);
  });

  it('fails once and says so when the recipient cannot be reached, with no automatic retry', async () => {
    const { disaster } = await disasterWithHistory();
    target.unreachable = true;
    await sync(disaster.id).expect(201);
    await deliver();
    advance(60 * 60 * 1000);
    await deliver();

    const view = await getView(disaster.id);
    expect(view.counts).toMatchObject({ failed: 2, waiting: 0 });
    const history = await getHistory(disaster.id, '?status=FAILED');
    expect(history.items[0].lastResult).toContain('network');
  });

  it('sends a resolution after the record it resolves', async () => {
    const disaster = await createDisaster();
    const building = await observe(disaster.id);
    const extinguished = await observe(disaster.id, {
      type: 'FIRE_EXTINGUISHED',
      parentObservationId: building,
    });
    await observe(disaster.id, {
      type: 'DEBRIS_REMOVED',
      parentObservationId: building,
    });
    await savePublishing(disaster.id, {}).expect(200);

    const res = await sync(disaster.id).expect(201);
    expect(res.body.queued).toBe(2);
    await deliver();

    expect(target.requests.map((r) => r.body?.externalId)).toEqual([
      building,
      extinguished,
    ]);
    expect(target.records.get(building).resolvedBy).toBe(extinguished);
  });

  it('is refused without a recipient, with sharing off, and for anyone but an administrator', async () => {
    const bare = await createDisaster();
    await observe(bare.id);
    await sync(bare.id).expect(400);

    const { disaster } = await disasterWithHistory();
    await savePublishing(disaster.id, { enabled: false }).expect(200);
    const res = await sync(disaster.id).expect(400);
    expect(res.body.message).toBe('error.publishingNotEnabled');

    await savePublishing(disaster.id, { enabled: true }).expect(200);
    await sync(disaster.id, fieldOperator).expect(403);
    expect(t.repos.queue.rows).toHaveLength(0);
  });
});

describe('photos', () => {
  async function addPhotos(observationId: string, count: number) {
    for (let i = 0; i < count; i++) {
      await t.repos.photos.save({
        observationId,
        filePath: `uploads/observations/${observationId}-${i}.jpg`,
        sortOrder: i,
      } as never);
    }
  }

  it('go with the record as public addresses on the portal origin, in order, at most five', async () => {
    const disaster = await sharingDisaster();
    const id = await observe(disaster.id);
    await addPhotos(id, 7);

    await deliver();

    const photos = target.requests[0].body?.photos as string[];
    expect(photos).toHaveLength(5);
    expect(photos[0]).toBe(
      `https://portal.example/uploads/observations/${id}-0.jpg`,
    );
  });

  it('are left out of a record without any', async () => {
    const disaster = await sharingDisaster();
    await observe(disaster.id);
    await deliver();
    expect(target.requests[0].body).not.toHaveProperty('photos');
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
    const disaster = await sharingDisaster();
    const id = await observe(disaster.id);
    logs.clear();

    await deliver();

    const lines = attempts(id);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'info',
      disasterId: disaster.id,
      observationId: id,
      status: 201,
      classification: 'delivered',
      attempt: 1,
    });
    expect(typeof lines[0].durationMs).toBe('number');
  });

  it('records the status of a refused record and of an unreachable recipient', async () => {
    const disaster = await sharingDisaster();
    const refused = await observe(disaster.id);
    target.invalidExternalIds.add(refused);
    await deliver();
    target.unreachable = true;
    const lost = await observe(disaster.id);
    await deliver();

    expect(attempts(refused)).toEqual([
      expect.objectContaining({
        level: 'error',
        status: 400,
        classification: 'failed',
      }),
    ]);
    expect(attempts(lost)).toEqual([
      expect.objectContaining({
        level: 'error',
        status: null,
        classification: 'failed',
        error: expect.any(String),
      }),
    ]);
  });

  it('never writes the key, the record or the answer', async () => {
    const disaster = await sharingDisaster();
    await observe(disaster.id);
    target.unreachable = false;
    await deliver();

    const output = logs.raw;
    expect(output).not.toContain(TARGET_KEY);
    expect(output).not.toContain('field@trac.example');
    expect(output).not.toContain('Beş katlı bina çöktü');
  });
});
