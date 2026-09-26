/** Injection token for the clock the OIDC module reads the current time from. */
export const OIDC_CLOCK = 'OIDC_CLOCK';
export type OidcClock = () => Date;

export const OIDC_PATH = '/api/oidc';

export const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;
export const ID_TOKEN_TTL_SECONDS = 10 * 60;
export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
/** Retired signing keys stay in JWKS this long so tokens they signed still verify. */
export const RETIRED_KEY_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export const SUPPORTED_SCOPES = ['openid', 'email', 'profile'] as const;
export type OidcScope = (typeof SUPPORTED_SCOPES)[number];

/** Claims released per scope. `sub` is always released with `openid`. */
export const SCOPE_CLAIMS: Record<OidcScope, string[]> = {
  openid: ['sub'],
  email: ['email', 'email_verified'],
  profile: ['name', 'call_sign', 'verified'],
};
