import { type EffectiveRole, GlobalRole } from '../enums/role.enum';

export interface GoogleProfile {
  id: string;
  emails: Array<{ value: string }>;
  name: {
    givenName: string;
    familyName: string;
  };
  photos: Array<{ value: string }>;
}

/** Passport validate callback receives this when SSO user is not in DB; no JWT, redirect to complete registration. */
export interface PendingSsoRegistration {
  pendingSso: true;
  email: string;
  fullName: string;
  picture: string | null;
  providerId: string | null;
}

/**
 * Google sign-in matched an account that has a password but no Google
 * identity: no session until the confirmation step (confirm the password or
 * set a new one) completes.
 */
export interface PendingGoogleLink {
  pendingGoogleLink: true;
  userId: string;
  email: string;
  providerId: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: EffectiveRole;
  globalRole?: GlobalRole;
  callSign?: string;
  operatorId?: string;
  currentBranchId?: string | null;
  provider: string;
  providerId?: string | null;
  fullName?: string | null;
  picture?: string | null;
  isTemporaryPassword?: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  provider: string;
  role: EffectiveRole;
  callSign?: string;
  /** Issued-at, seconds since the epoch; compared with `User.sessionsValidAfter`. */
  iat?: number;
}
