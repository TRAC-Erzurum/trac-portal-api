import { ConsoleLogger, LogLevel } from '@nestjs/common';

/**
 * One diagnostic event. Only these fields are ever written, so a caller
 * cannot pass a request, a body or an error object through by accident.
 * Never put a secret, token, code, password, signature or email in any of
 * them: identifiers, HTTP statuses and error codes only.
 */
export interface LogEvent {
  /** Dotted name, e.g. `oidc.token` or `publishing.delivery`. */
  event: string;
  clientId?: string;
  targetId?: string;
  disasterId?: string;
  observationId?: string;
  /** Which check decided the outcome, e.g. `code_expired`. */
  step?: string;
  /** HTTP status: ours for OIDC, the target's for a delivery (`null`: no answer). */
  status?: number | null;
  /** Delivery outcome: `delivered`, `retry`, `failed`, `authentication-failed`. */
  classification?: string;
  attempt?: number;
  /** ISO time of the next attempt; `null` when there is none. */
  nextAttemptAt?: string | null;
  durationMs?: number;
  /** Error code (`invalid_grant`, `ECONNREFUSED` …), never a message. */
  error?: string;
}

export type EventLevel = 'info' | 'warn' | 'error';

const NEST_LEVEL: Record<EventLevel, LogLevel> = {
  info: 'log',
  warn: 'warn',
  error: 'error',
};
const EVENT_LEVEL: Partial<Record<LogLevel, EventLevel>> = {
  log: 'info',
  warn: 'warn',
  error: 'error',
};

/** Nest's console logger, formatting each event as one JSON line on stdout. */
class JsonLineLogger extends ConsoleLogger {
  protected printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
  ): void {
    for (const message of messages) {
      const fields =
        message && typeof message === 'object' ? message : { message };
      process.stdout.write(
        `${JSON.stringify({
          time: new Date().toISOString(),
          level: EVENT_LEVEL[logLevel] ?? logLevel,
          context,
          ...fields,
        })}\n`,
      );
    }
  }
}

/** Identifiers from requests are logged only when they look like identifiers. */
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/** Keeps a caller-supplied identifier out of the log unless it is plainly one. */
export function safeId(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  return SAFE_ID.test(value) ? value : '[unrecognised]';
}

/** Writes diagnostic events as single JSON lines: `{time, level, context, event, …}`. */
export class EventLogger {
  private readonly logger: ConsoleLogger;

  constructor(context: string) {
    this.logger = new JsonLineLogger(context);
  }

  write(level: EventLevel, entry: LogEvent): void {
    const line: LogEvent = {
      event: entry.event,
      clientId: entry.clientId,
      targetId: entry.targetId,
      disasterId: entry.disasterId,
      observationId: entry.observationId,
      step: entry.step,
      status: entry.status,
      classification: entry.classification,
      attempt: entry.attempt,
      nextAttemptAt: entry.nextAttemptAt,
      durationMs: entry.durationMs,
      error: entry.error,
    };
    this.logger[NEST_LEVEL[level]](line);
  }
}
