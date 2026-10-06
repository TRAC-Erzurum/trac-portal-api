import { timingSafeEqual } from 'crypto';
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
  /** The path the request was made to. */
  path: string;
  /** `Authorization: Bearer <key>` carried the key. */
  authentic: boolean;
  status: number;
}

export interface StoredRecord {
  id: string;
  body: Record<string, any>;
  resolvedBy: string | null;
}

/**
 * In-process implementation of the target's intake contract: the source is
 * named in the address and presents its key as a bearer token, dedup by
 * `externalId`, 422 for a closed incident, and `resolves`.
 */
export class FakeTarget {
  readonly requests: ReceivedRequest[] = [];
  /** Records by `externalId` (new records only, not resolves). */
  readonly records = new Map<string, StoredRecord>();
  private readonly appliedResolves = new Map<string, string>();
  /** The source's incident is closed: new records are refused (422). */
  closed = false;
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
  ) {}

  get url(): string {
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${port}/api/ingest/observations/${this.sourceId}`;
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
      const given = header('authorization') ?? '';
      const expected = `Bearer ${this.secret}`;
      const authentic =
        given.length === expected.length &&
        timingSafeEqual(Buffer.from(given), Buffer.from(expected));
      const path = req.url ?? '';
      let body: Record<string, any> | null;
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = null;
      }
      const [status, payload] = this.decide(
        path.endsWith(`/${this.sourceId}`),
        authentic,
        req.method ?? '',
        body,
      );
      this.requests.push({
        headers: {
          'content-type': header('content-type'),
          authorization: given,
        },
        rawBody,
        body,
        path,
        authentic,
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
    rightSource: boolean,
    authentic: boolean,
    method: string,
    body: Record<string, any> | null,
  ): [number, unknown] {
    if (method !== 'POST') return [405, { error: 'method' }];
    if (!rightSource || !authentic)
      return [401, { error: 'authentication failed' }];
    if (this.tooManyRequests > 0) {
      this.tooManyRequests--;
      return [429, { error: 'too many requests' }];
    }
    if (!body || typeof body !== 'object') return [400, { error: 'json' }];
    const str = (v: unknown) =>
      typeof v === 'string' && v.length > 0 && v.length <= 100;
    if (!str(body.externalId)) return [400, { error: 'ids' }];
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
    if (this.closed && !this.records.has(body.externalId))
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
