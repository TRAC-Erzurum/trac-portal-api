import { MembershipStatus } from '../../branch/enums/membership-status.enum';
import { User } from '../../user/entities/user.entity';
import { OidcScope, SCOPE_CLAIMS } from '../oidc.constants';

/**
 * Every claim this provider can release. Branch, membership status and role
 * are internal and deliberately absent: `verified` is the only thing derived
 * from them.
 */
export interface OidcUserClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string | null;
  call_sign?: string | null;
  verified?: boolean;
}

/**
 * Verified once a Google identity is recorded on the account: Google proved
 * the address. Password-only accounts never verified theirs.
 */
export function isEmailVerified(user: Pick<User, 'providerId'>): boolean {
  return !!user.providerId;
}

/** Verified means an approved branch membership together with a call sign. */
export function isVerifiedOperator(user: Pick<User, 'operator'>): boolean {
  const operator = user.operator;
  if (!operator?.callSign) return false;
  return (operator.branchMemberships ?? []).some(
    (m) => m.status === MembershipStatus.APPROVED,
  );
}

export function buildClaims(user: User, scopes: OidcScope[]): OidcUserClaims {
  const all: Record<string, unknown> & Required<OidcUserClaims> = {
    sub: user.id,
    email: user.email,
    email_verified: isEmailVerified(user),
    name: user.fullName ?? user.operator?.fullName ?? null,
    call_sign: user.operator?.callSign ?? null,
    verified: isVerifiedOperator(user),
  };
  const released = new Set(scopes.flatMap((s) => SCOPE_CLAIMS[s]));
  const claims: Record<string, unknown> = { sub: all.sub };
  for (const [key, value] of Object.entries(all)) {
    if (released.has(key)) claims[key] = value;
  }
  return claims as unknown as OidcUserClaims;
}
