import * as crypto from 'crypto';

/** Salted SHA-256, the same scheme `UserService` uses for local passwords. */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashSecret(secret: string, salt: string): string {
  return crypto.createHash('sha256').update(`${secret}${salt}`).digest('hex');
}

export function verifySecret(
  secret: string,
  salt: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashSecret(secret, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

/** High-entropy opaque value (codes, access tokens, client secrets). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Unsalted SHA-256 for lookup of high-entropy opaque tokens. */
export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** RFC 7636 S256: BASE64URL(SHA256(code_verifier)). */
export function pkceS256(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}
