import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { IsNull, Repository } from 'typeorm';
import { UserService } from '../../user/services/user.service';
import { User } from '../../user/entities/user.entity';
import { AuthorizationRequestDto } from '../dto/authorization-request.dto';
import { TokenRequestDto } from '../dto/token-request.dto';
import { OidcClient } from '../entities/oidc-client.entity';
import { OidcConsent } from '../entities/oidc-consent.entity';
import { OidcAuthorizationCode } from '../entities/oidc-authorization-code.entity';
import { OidcAccessToken } from '../entities/oidc-access-token.entity';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTHORIZATION_CODE_TTL_SECONDS,
  ID_TOKEN_TTL_SECONDS,
  OIDC_CLOCK,
  OIDC_PATH,
  OidcClock,
  OidcScope,
  SCOPE_CLAIMS,
  SUPPORTED_SCOPES,
} from '../oidc.constants';
import { buildClaims, OidcUserClaims } from '../utils/claims.util';
import { pkceS256, randomToken, sha256Hex } from '../utils/secret.util';
import { OidcClientService } from './oidc-client.service';
import { OidcKeyService } from './oidc-key.service';

/** A request whose client and redirect URI have been verified. */
export interface ValidatedAuthorizationRequest {
  client: OidcClient;
  redirectUri: string;
  scopes: OidcScope[];
  state?: string;
  nonce?: string;
  codeChallenge?: string;
}

export type AuthorizationValidation =
  /** Client or redirect URI unknown: show an error page, never redirect. */
  | { kind: 'refused'; reason: 'invalid_client' | 'invalid_redirect_uri' }
  /** Redirect URI verified, but the request is malformed. */
  | { kind: 'redirect_error'; redirectTo: string }
  | { kind: 'valid'; request: ValidatedAuthorizationRequest };

export type ConsentContext =
  | { consentRequired: true; clientName: string; claims: string[] }
  | { consentRequired: false; redirectTo: string };

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  id_token: string;
  scope: string;
}

export interface ClientCredentials {
  clientId?: string;
  clientSecret?: string;
  /** Which method carried the credentials; both at once is refused. */
  method: 'client_secret_basic' | 'client_secret_post' | 'both' | 'none';
}

/** OAuth2 error response (RFC 6749 §5.2) carried by a built-in HttpException. */
export function oauthError(
  error: string,
  description: string,
  status: HttpStatus = HttpStatus.BAD_REQUEST,
): HttpException {
  return new HttpException({ error, error_description: description }, status);
}

const AUTHORIZATION_PARAMS: (keyof AuthorizationRequestDto)[] = [
  'response_type',
  'client_id',
  'redirect_uri',
  'scope',
  'state',
  'nonce',
  'code_challenge',
  'code_challenge_method',
];

function appendParams(
  uri: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly clientService: OidcClientService,
    private readonly keyService: OidcKeyService,
    @InjectRepository(OidcConsent)
    private readonly consentRepository: Repository<OidcConsent>,
    @InjectRepository(OidcAuthorizationCode)
    private readonly codeRepository: Repository<OidcAuthorizationCode>,
    @InjectRepository(OidcAccessToken)
    private readonly accessTokenRepository: Repository<OidcAccessToken>,
    @Inject(OIDC_CLOCK) private readonly clock: OidcClock,
  ) {}

  /** `<public API origin>/api/oidc`, from PUBLIC_API_ORIGIN. */
  issuer(): string {
    const origin = this.configService.get<string>('PUBLIC_API_ORIGIN');
    if (!origin) {
      this.logger.error('PUBLIC_API_ORIGIN is not set; OIDC is unavailable');
      throw new InternalServerErrorException('error.oidcNotConfigured');
    }
    return `${origin.replace(/\/+$/, '')}${OIDC_PATH}`;
  }

  /** The UI is served from the API's public origin; consent lives there. */
  consentPageUrl(params: AuthorizationRequestDto): string {
    const url = new URL('/oidc/consent', this.issuer());
    for (const key of AUTHORIZATION_PARAMS) {
      const value = params[key];
      if (typeof value === 'string') url.searchParams.set(key, value);
    }
    return url.toString();
  }

  discovery() {
    const issuer = this.issuer();
    return {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: [...SUPPORTED_SCOPES],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
      ],
      code_challenge_methods_supported: ['S256'],
      authorization_response_iss_parameter_supported: true,
      claims_supported: [
        'iss',
        'aud',
        'exp',
        'iat',
        'nonce',
        ...new Set(Object.values(SCOPE_CLAIMS).flat()),
      ],
    };
  }

  async validateAuthorizationRequest(
    params: AuthorizationRequestDto,
  ): Promise<AuthorizationValidation> {
    const client = await this.clientService.findActiveByClientId(
      params.client_id,
    );
    if (!client) return { kind: 'refused', reason: 'invalid_client' };
    const redirectUri = params.redirect_uri;
    if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
      return { kind: 'refused', reason: 'invalid_redirect_uri' };
    }

    const fail = (error: string, description: string) => ({
      kind: 'redirect_error' as const,
      redirectTo: appendParams(redirectUri, {
        error,
        error_description: description,
        state: params.state,
        iss: this.issuer(),
      }),
    });

    if (params.response_type !== 'code') {
      return fail(
        'unsupported_response_type',
        'Only response_type=code is supported',
      );
    }
    const requested = (params.scope ?? '').split(' ').filter(Boolean);
    if (!requested.includes('openid')) {
      return fail('invalid_scope', 'The openid scope is required');
    }
    // Unknown scopes are ignored (RFC 6749 §3.3 lets the server narrow scope).
    const scopes = SUPPORTED_SCOPES.filter((s) => requested.includes(s));
    if (params.code_challenge !== undefined) {
      if (params.code_challenge_method !== 'S256') {
        return fail(
          'invalid_request',
          'Only the S256 PKCE method is supported',
        );
      }
      if (!/^[A-Za-z0-9_-]{43}$/.test(params.code_challenge)) {
        return fail('invalid_request', 'Malformed code_challenge');
      }
    } else if (params.code_challenge_method !== undefined) {
      return fail('invalid_request', 'code_challenge_method without challenge');
    }

    return {
      kind: 'valid',
      request: {
        client,
        redirectUri,
        scopes,
        state: params.state,
        nonce: params.nonce,
        codeChallenge: params.code_challenge,
      },
    };
  }

  /** Validation for the JSON consent API: refusals become 400 with no redirect target. */
  private async requireRedirectable(
    params: AuthorizationRequestDto,
  ): Promise<Exclude<AuthorizationValidation, { kind: 'refused' }>> {
    const result = await this.validateAuthorizationRequest(params);
    if (result.kind === 'refused') {
      throw new BadRequestException(
        result.reason === 'invalid_client'
          ? 'error.oidcInvalidClient'
          : 'error.oidcInvalidRedirectUri',
      );
    }
    return result;
  }

  private async hasConsent(
    userId: string,
    request: ValidatedAuthorizationRequest,
  ): Promise<boolean> {
    const consent = await this.consentRepository.findOne({
      where: { userId, clientId: request.client.id },
    });
    if (!consent) return false;
    const granted = consent.scope.split(' ');
    return request.scopes.every((s) => granted.includes(s));
  }

  /**
   * What the consent page shows: only the client's name and the names of the
   * fields it asks for; no user data leaves before approval. With a remembered
   * consent covering the request, the code is issued straight away.
   */
  async getConsentContext(
    params: AuthorizationRequestDto,
    userId: string,
  ): Promise<ConsentContext> {
    const result = await this.requireRedirectable(params);
    if (result.kind === 'redirect_error') {
      return { consentRequired: false, redirectTo: result.redirectTo };
    }
    const { request } = result;
    if (await this.hasConsent(userId, request)) {
      return {
        consentRequired: false,
        redirectTo: await this.issueCode(request, userId),
      };
    }
    return {
      consentRequired: true,
      clientName: request.client.name,
      claims: [...new Set(request.scopes.flatMap((s) => SCOPE_CLAIMS[s]))],
    };
  }

  async approve(
    params: AuthorizationRequestDto,
    userId: string,
  ): Promise<{ redirectTo: string }> {
    const result = await this.requireRedirectable(params);
    if (result.kind === 'redirect_error') {
      return { redirectTo: result.redirectTo };
    }
    const { request } = result;
    const existing = await this.consentRepository.findOne({
      where: { userId, clientId: request.client.id },
    });
    const scope = [
      ...new Set([
        ...(existing?.scope.split(' ').filter(Boolean) ?? []),
        ...request.scopes,
      ]),
    ].join(' ');
    if (existing) {
      existing.scope = scope;
      existing.updatedBy = [...(existing.updatedBy ?? []), userId];
      await this.consentRepository.save(existing);
    } else {
      await this.consentRepository.save(
        this.consentRepository.create({
          userId,
          clientId: request.client.id,
          scope,
          createdBy: userId,
          updatedBy: [],
        }),
      );
    }
    return { redirectTo: await this.issueCode(request, userId) };
  }

  async deny(params: AuthorizationRequestDto): Promise<{ redirectTo: string }> {
    const result = await this.requireRedirectable(params);
    if (result.kind === 'redirect_error') {
      return { redirectTo: result.redirectTo };
    }
    return {
      redirectTo: appendParams(result.request.redirectUri, {
        error: 'access_denied',
        error_description: 'The user denied the request',
        state: result.request.state,
        iss: this.issuer(),
      }),
    };
  }

  private async issueCode(
    request: ValidatedAuthorizationRequest,
    userId: string,
  ): Promise<string> {
    const code = randomToken();
    const now = this.clock();
    await this.codeRepository.save(
      this.codeRepository.create({
        codeHash: sha256Hex(code),
        clientId: request.client.id,
        userId,
        redirectUri: request.redirectUri,
        scope: request.scopes.join(' '),
        nonce: request.nonce ?? null,
        codeChallenge: request.codeChallenge ?? null,
        expiresAt: new Date(
          now.getTime() + AUTHORIZATION_CODE_TTL_SECONDS * 1000,
        ),
        usedAt: null,
        createdBy: userId,
        updatedBy: [],
      }),
    );
    return appendParams(request.redirectUri, {
      code,
      state: request.state,
      iss: this.issuer(),
    });
  }

  private async authenticateClient(
    credentials: ClientCredentials,
  ): Promise<OidcClient> {
    if (credentials.method === 'both') {
      throw oauthError(
        'invalid_request',
        'Use exactly one client authentication method',
      );
    }
    const client =
      credentials.method === 'none'
        ? null
        : await this.clientService.authenticate(
            credentials.clientId ?? '',
            credentials.clientSecret ?? '',
          );
    if (!client) {
      throw oauthError(
        'invalid_client',
        'Client authentication failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return client;
  }

  async exchangeCode(
    body: TokenRequestDto,
    credentials: ClientCredentials,
  ): Promise<TokenResponse> {
    const client = await this.authenticateClient(credentials);
    if (body.grant_type !== 'authorization_code') {
      throw oauthError(
        'unsupported_grant_type',
        'Only authorization_code is supported',
      );
    }
    if (!body.code) {
      throw oauthError('invalid_request', 'code is required');
    }

    const now = this.clock();
    const invalidGrant = () =>
      oauthError('invalid_grant', 'Invalid authorization code');
    const record = await this.codeRepository.findOne({
      where: { codeHash: sha256Hex(body.code) },
    });
    if (!record) throw invalidGrant();

    if (record.usedAt) {
      // Replay: revoke what the first redemption produced (RFC 6749 §4.1.2).
      await this.accessTokenRepository.delete({
        authorizationCodeId: record.id,
      });
      throw invalidGrant();
    }
    if (
      record.clientId !== client.id ||
      record.expiresAt.getTime() <= now.getTime() ||
      record.redirectUri !== body.redirect_uri
    ) {
      throw invalidGrant();
    }
    if (record.codeChallenge) {
      if (
        !body.code_verifier ||
        pkceS256(body.code_verifier) !== record.codeChallenge
      ) {
        throw invalidGrant();
      }
    } else if (body.code_verifier) {
      throw invalidGrant();
    }

    // Single use: only the request that flips usedAt from NULL proceeds.
    const consumed = await this.codeRepository.update(
      { id: record.id, usedAt: IsNull() },
      { usedAt: now },
    );
    if (consumed.affected !== 1) throw invalidGrant();

    const user = await this.findUser(record.userId);
    if (!user) throw invalidGrant();

    const scopes = record.scope.split(' ') as OidcScope[];
    const accessToken = randomToken();
    await this.accessTokenRepository.save(
      this.accessTokenRepository.create({
        tokenHash: sha256Hex(accessToken),
        clientId: client.id,
        userId: user.id,
        authorizationCodeId: record.id,
        scope: record.scope,
        expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000),
        createdBy: client.clientId,
        updatedBy: [],
      }),
    );

    const idToken = await this.signIdToken(
      client,
      buildClaims(user, scopes),
      record.nonce,
      now,
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      id_token: idToken,
      scope: record.scope,
    };
  }

  private async signIdToken(
    client: OidcClient,
    claims: OidcUserClaims,
    nonce: string | null,
    now: Date,
  ): Promise<string> {
    const key = await this.keyService.getSigningKey();
    const iat = Math.floor(now.getTime() / 1000);
    return this.jwtService.sign(
      {
        ...claims,
        iss: this.issuer(),
        aud: client.clientId,
        iat,
        exp: iat + ID_TOKEN_TTL_SECONDS,
        ...(nonce ? { nonce } : {}),
      },
      { algorithm: 'RS256', privateKey: key.privateKey, keyid: key.kid },
    );
  }

  private async findUser(userId: string): Promise<User | null> {
    try {
      return await this.userService.findOne(userId);
    } catch {
      return null;
    }
  }

  /** Claims for a bearer access token; null when the token is not valid. */
  async userinfo(
    accessToken: string | undefined,
  ): Promise<OidcUserClaims | null> {
    if (!accessToken) return null;
    const record = await this.accessTokenRepository.findOne({
      where: { tokenHash: sha256Hex(accessToken) },
    });
    if (!record || record.expiresAt.getTime() <= this.clock().getTime()) {
      return null;
    }
    if (!(await this.clientService.findActiveById(record.clientId))) {
      return null;
    }
    const user = await this.findUser(record.userId);
    if (!user) return null;
    return buildClaims(user, record.scope.split(' ') as OidcScope[]);
  }
}
