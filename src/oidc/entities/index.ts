import { OidcAccessToken } from './oidc-access-token.entity';
import { OidcAuthorizationCode } from './oidc-authorization-code.entity';
import { OidcClient } from './oidc-client.entity';
import { OidcConsent } from './oidc-consent.entity';
import { OidcSigningKey } from './oidc-signing-key.entity';

export const entities = [
  OidcClient,
  OidcSigningKey,
  OidcConsent,
  OidcAuthorizationCode,
  OidcAccessToken,
];
