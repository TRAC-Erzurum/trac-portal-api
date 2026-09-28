import { createHmac, timingSafeEqual } from 'crypto';
import { AddressInfo } from 'net';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';

/** The 14 types the target contract accepts. */
export const TARGET_TYPES = [
  'collapsedBuilding',
  'damagedBuilding',
  'roadBlocked',
  'infrastructureFailure',
  'assemblyArea',
  'medicalPoint',
  'other',
  'fire',
  'gasLeak',
  'electricalHazard',
  'injured',
  'deceased',
  'rescueNeeded',
  'resourceNeed',
];

export interface ReceivedRequest {
  headers: Record<string, string | undefined>;
  rawBody: string;
  body: Record<string, any> | null;
  /** HMAC over `${X-Timestamp}.${rawBody}` matched the shared secret. */
  signatureValid: boolean;
  /** X-Timestamp was within ±300 s of the target's clock. */
  timestampFresh: boolean;
  status: number;
}

export interface StoredRecord {
  id: string;
  body: Record<string, any>;
  resolvedBy: string | null;
}

/**
 * In-process implementation of the target's intake contract: signature and
 * timestamp check, dedup by `externalId`, 409 until the source's disaster is
 * linked to an incident, 422 for a closed incident, and `resolves`.
 */
export class FakeTarget {
  readonly requests: ReceivedRequest[] = [];
  /** Records by `externalId` (new records only, not resolves). */
  readonly records = new Map<string, StoredRecord>();
  private readonly appliedResolves = new Map<string, string>();
  readonly linkedIncidents = new Set<string>();
  readonly closedIncidents = new Set<string>();
  /** `externalId`s the target rejects as invalid (400). */
  readonly invalidExternalIds = new Set<string>();
  /** When true the target drops every connection (network failure). */
  unreachable = false;
  /** The next this-many authentic requests are answered 429 (overloaded). */
  tooManyRequests = 0;
  /** Runs after each request is answered (to act "while" a batch is in flight). */
  afterResponse: (() => Promise<void>) | null = null;
  private server!: Server;
  private nextId = 1;

  constructor(
    readonly sourceId: string,
    public secret: string,
    private readonly now: () => Date,
  ) {}

  get url(): string {
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${port}/api/intake/observations`;
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => this.handle(req, res));
    await new Promise<void>((resolve) =>
      this.server.listen(0, '127.0.0.1', resolve),
    );
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    if (this.unreachable) {
      req.socket.destroy();
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const header = (name: string) => {
        const v = req.headers[name];
        return Array.isArray(v) ? v[0] : v;
      };
      const timestamp = header('x-timestamp') ?? '';
      const expected = `sha256=${createHmac('sha256', this.secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex')}`;
      const given = header('x-signature') ?? '';
      const signatureValid =
        given.length === expected.length &&
        timingSafeEqual(Buffer.from(given), Buffer.from(expected));
      const nowSeconds = Math.floor(this.now().getTime() / 1000);
      const timestampFresh =
        /^\d+$/.test(timestamp) &&
        Math.abs(nowSeconds - Number(timestamp)) <= 300;
      let body: Record<string, any> | null;
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = null;
      }
      const [status, payload] = this.decide(
        header('x-source-id'),
        signatureValid && timestampFresh,
        req.method ?? '',
        body,
      );
      this.requests.push({
        headers: {
          'content-type': header('content-type'),
          'x-source-id': header('x-source-id'),
          'x-timestamp': timestamp,
          'x-signature': given,
        },
        rawBody,
        body,
        signatureValid,
        timestampFresh,
        status,
      });
      const respond = () => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (this.afterResponse) void this.afterResponse().then(respond);
      else respond();
    });
  }

  private decide(
    sourceId: string | undefined,
    authentic: boolean,
    method: string,
    body: Record<string, any> | null,
  ): [number, unknown] {
    if (method !== 'POST') return [405, { error: 'method' }];
    if (sourceId !== this.sourceId || !authentic)
      return [401, { error: 'authentication failed' }];
    if (this.tooManyRequests > 0) {
      this.tooManyRequests--;
      return [429, { error: 'too many requests' }];
    }
    if (!body || typeof body !== 'object') return [400, { error: 'json' }];
    const str = (v: unknown) =>
      typeof v === 'string' && v.length > 0 && v.length <= 100;
    if (!str(body.externalId) || !str(body.externalIncidentId))
      return [400, { error: 'ids' }];
    if (this.invalidExternalIds.has(body.externalId))
      return [400, { error: 'invalid' }];
    if (body.resolves === undefined && !TARGET_TYPES.includes(body.type))
      return [400, { error: 'type' }];
    if (body.resolves !== undefined && body.type !== undefined)
      return [400, { error: 'type with resolves' }];
    if (
      typeof body.observedAt !== 'string' ||
      !/(Z|[+-]\d\d:\d\d)$/.test(body.observedAt) ||
      Number.isNaN(Date.parse(body.observedAt))
    )
      return [400, { error: 'observedAt' }];
    const r = body.reporter;
    if (
      !r ||
      typeof r.email !== 'string' ||
      typeof r.label !== 'string' ||
      typeof r.verified !== 'boolean'
    )
      return [400, { error: 'reporter' }];
    if (!this.linkedIncidents.has(body.externalIncidentId))
      return [409, { error: 'not linked' }];
    if (this.closedIncidents.has(body.externalIncidentId))
      return [422, { error: 'incident closed' }];

    if (body.resolves !== undefined) {
      const target = this.records.get(body.resolves);
      if (!target) return [409, { error: 'resolve target not arrived' }];
      target.resolvedBy = body.externalId;
      this.appliedResolves.set(body.externalId, target.id);
      return [200, { id: target.id }];
    }

    const existing = this.records.get(body.externalId);
    if (existing) return [200, { id: existing.id, duplicate: true }];
    const id = `rec-${this.nextId++}`;
    this.records.set(body.externalId, { id, body, resolvedBy: null });
    return [201, { id }];
  }
}
