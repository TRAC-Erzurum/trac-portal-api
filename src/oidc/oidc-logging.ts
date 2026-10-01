import {
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { performance } from 'perf_hooks';
import {
  EventLevel,
  EventLogger,
  safeId,
} from '../shared/logging/event-logger';
import { OidcController } from './controllers/oidc.controller';
import { OidcConsentController } from './controllers/oidc-consent.controller';

/** What a handler knows about the outcome that the response does not show. */
export interface OidcOutcome {
  clientId?: string;
  error?: string;
  step?: string;
}

const OUTCOME = 'oidcOutcome';

/** Adds outcome details to the log line of the current request. */
export function noteOidcOutcome(res: Response, outcome: OidcOutcome): void {
  res.locals[OUTCOME] = { ...(res.locals[OUTCOME] ?? {}), ...outcome };
}

const EVENTS: [RegExp, string][] = [
  [/\/oidc\/\.well-known\/openid-configuration$/, 'oidc.discovery'],
  [/\/oidc\/jwks$/, 'oidc.jwks'],
  [/\/oidc\/authorize$/, 'oidc.authorize'],
  [/\/oidc\/token$/, 'oidc.token'],
  [/\/oidc\/userinfo$/, 'oidc.userinfo'],
  [/\/oidc\/consent\/context$/, 'oidc.consent.context'],
  [/\/oidc\/consent\/approve$/, 'oidc.consent.approve'],
  [/\/oidc\/consent\/deny$/, 'oidc.consent.deny'],
];

function eventFor(req: Request): string | undefined {
  const path = (req.originalUrl ?? req.url).split('?')[0].replace(/\/+$/, '');
  return EVENTS.find(([pattern]) => pattern.test(path))?.[1];
}

const STATUS_ERRORS: Record<number, string> = {
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  429: 'too_many_requests',
};

const I18N_ERRORS: Record<string, string> = {
  'error.oidcInvalidClient': 'invalid_client',
  'error.oidcInvalidRedirectUri': 'invalid_redirect_uri',
};

/**
 * The error code a JSON response carries, and nothing else of it: the OAuth
 * `error` field, the portal's i18n error key, or the `error` parameter of a
 * returned redirect. Tokens and codes in the same body are never read.
 */
function errorOf(status: number, body: unknown): string | undefined {
  const fields = (body ?? {}) as Record<string, unknown>;
  if (typeof fields.error === 'string') return safeId(fields.error);
  if (status >= 400) {
    const message = fields.message;
    if (typeof message === 'string') {
      if (I18N_ERRORS[message]) return I18N_ERRORS[message];
      if (/^error\.[A-Za-z]+$/.test(message)) return message;
    }
    if (status >= 500) return 'server_error';
    return STATUS_ERRORS[status] ?? 'invalid_request';
  }
  if (typeof fields.redirectTo === 'string') {
    try {
      const error = new URL(fields.redirectTo).searchParams.get('error');
      return error ? safeId(error) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function levelFor(status: number, error: string | undefined): EventLevel {
  if (status >= 500) return 'error';
  if (status >= 400 || error) return 'warn';
  return 'info';
}

/**
 * One JSON line per OIDC endpoint call, written when the response is sent,
 * including calls refused by a guard or the rate limiter: event, client,
 * HTTP status, error code, the check that failed, and the duration. Only
 * identifiers and codes are logged; never a header, a body or a URL.
 */
@Injectable()
export class OidcRequestLogger implements NestMiddleware {
  private readonly logger = new EventLogger('Oidc');

  use(req: Request, res: Response, next: NextFunction): void {
    const event = eventFor(req);
    if (!event) return next();
    const started = performance.now();
    let bodyError: string | undefined;

    const json = res.json.bind(res) as Response['json'];
    res.json = (body?: unknown) => {
      bodyError = errorOf(res.statusCode, body);
      return json(body);
    };

    let logged = false;
    const log = () => {
      if (logged) return;
      logged = true;
      const noted = (res.locals[OUTCOME] ?? {}) as OidcOutcome;
      const status = res.statusCode;
      const requested =
        (req.body as { client_id?: unknown } | undefined)?.client_id ??
        req.query?.client_id;
      const error =
        noted.error ??
        bodyError ??
        (status >= 400 ? errorOf(status, null) : undefined);
      this.logger.write(levelFor(status, error), {
        event,
        clientId: noted.clientId ?? safeId(requested),
        status,
        error,
        step: noted.step,
        durationMs: Math.round(performance.now() - started),
      });
    };
    res.once('finish', log);
    res.once('close', log);
    next();
  }
}

/** Applies the OIDC request log to the protocol and consent endpoints. */
@Module({})
export class OidcRequestLogModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(OidcRequestLogger)
      .forRoutes(OidcController, OidcConsentController);
  }
}
