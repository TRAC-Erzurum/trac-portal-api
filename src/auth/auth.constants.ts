export const AUTH_CLOCK = 'AUTH_CLOCK';
export type AuthClock = () => Date;

/**
 * Carries a Google sign-in that matched a password account with no Google
 * identity on it, until the person confirms the account's password or sets a
 * new one. It is never a session.
 */
export const GOOGLE_LINK_COOKIE = 'google_link';
export const GOOGLE_LINK_TTL_SECONDS = 10 * 60;
/** UI route of the one-time confirmation screen. */
export const GOOGLE_LINK_PAGE = '/login/google-link';
