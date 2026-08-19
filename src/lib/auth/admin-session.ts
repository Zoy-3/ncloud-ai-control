import { createHmac, timingSafeEqual } from "node:crypto";

/** Name of the HttpOnly cookie carrying the admin session. */
export const ADMIN_SESSION_COOKIE = "ncloud_admin_session";

/** How long one admin session stays valid. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** The identity a valid session carries. */
export type AdminSessionClaims = {
  userId: string;
  expiresAt: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Mints a session value.
 *
 * The value is `<userId>.<expiry>.<signature>`, signed with the server-side
 * secret. Nothing secret is stored in the cookie: the signing secret never
 * leaves the server, and no password or password hash is involved. A forged or
 * edited payload fails the signature, and a stale one fails the clock, so no
 * server-side session table is needed.
 */
export function createAdminSessionValue(
  secret: string,
  userId: string,
  expiresAt: number,
): string {
  const payload = `${userId}.${expiresAt}`;

  return `${payload}.${sign(secret, payload)}`;
}

/**
 * Compares a candidate secret with the configured one without leaking the
 * contents through timing. Both sides are hashed first so the comparison is
 * over equal-length buffers, which `timingSafeEqual` requires.
 */
export function secretsMatch(actual: string, expected: string): boolean {
  const actualDigest = createHmac("sha256", expected).update(actual).digest();
  const expectedDigest = createHmac("sha256", expected)
    .update(expected)
    .digest();

  return timingSafeEqual(actualDigest, expectedDigest);
}

/**
 * Reads the claims out of a cookie value, or null when it is not a session
 * this server issued and that is still current.
 *
 * The claims alone are not authorisation: the caller must still confirm the
 * user exists, is active, and is not mid-password-change.
 */
export function readAdminSession(
  value: string | null | undefined,
  secret: string,
  now: number,
): AdminSessionClaims | null {
  if (typeof value !== "string" || value === "") {
    return null;
  }

  const parts = value.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [userId, expiryText, signature] = parts;

  if (
    !UUID.test(userId) ||
    !/^\d{1,15}$/.test(expiryText) ||
    !/^[0-9a-f]{64}$/.test(signature)
  ) {
    return null;
  }

  const expiresAt = Number(expiryText);

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return null;
  }

  const expected = sign(secret, `${userId}.${expiryText}`);

  if (
    !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
  ) {
    return null;
  }

  return { userId, expiresAt };
}

/**
 * Attributes for the session cookie.
 *
 * `httpOnly` keeps it away from any script, `sameSite: lax` means a cross-site
 * POST never carries it, and `secure` is set outside development so it is
 * never sent over plain HTTP in production.
 *
 * @param isProduction Whether the deployment is production.
 * @param maxAge       Lifetime in seconds; zero clears the cookie.
 */
export function adminCookieOptions(isProduction: boolean, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    path: "/",
    maxAge,
  };
}
