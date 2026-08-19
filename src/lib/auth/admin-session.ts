import { createHmac, timingSafeEqual } from "node:crypto";

/** Name of the HttpOnly cookie carrying the admin session. */
export const ADMIN_SESSION_COOKIE = "ncloud_admin_session";

/** How long one admin session stays valid. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * Mints a session value.
 *
 * The value is `<expiry>.<signature>`, where the signature is an HMAC of the
 * expiry keyed by the admin secret. Nothing secret is stored in the cookie and
 * no server-side session table is needed: a forged or edited expiry fails the
 * signature, and an expired one fails the clock.
 *
 * @param secret   The configured admin secret.
 * @param expiresAt Unix seconds at which the session stops being valid.
 */
export function createAdminSessionValue(
  secret: string,
  expiresAt: number,
): string {
  return `${expiresAt}.${signExpiry(secret, expiresAt)}`;
}

function signExpiry(secret: string, expiresAt: number): string {
  return createHmac("sha256", secret).update(String(expiresAt)).digest("hex");
}

/**
 * Compares two strings without leaking their contents through timing.
 *
 * Both sides are hashed first so the comparison is over equal-length buffers
 * regardless of the inputs, which `timingSafeEqual` requires.
 */
export function secretsMatch(actual: string, expected: string): boolean {
  const actualDigest = createHmac("sha256", expected).update(actual).digest();
  const expectedDigest = createHmac("sha256", expected)
    .update(expected)
    .digest();

  return timingSafeEqual(actualDigest, expectedDigest);
}

/**
 * Whether a cookie value is a session this server issued and that has not
 * expired.
 *
 * @param value  Raw cookie value, or null when absent.
 * @param secret The configured admin secret.
 * @param now    Unix seconds to compare the expiry against.
 */
export function isValidAdminSession(
  value: string | null | undefined,
  secret: string,
  now: number,
): boolean {
  if (typeof value !== "string" || value === "") {
    return false;
  }

  const separator = value.indexOf(".");

  if (separator <= 0) {
    return false;
  }

  const expiryText = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  if (!/^\d{1,15}$/.test(expiryText) || !/^[0-9a-f]{64}$/.test(signature)) {
    return false;
  }

  const expiresAt = Number(expiryText);

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return false;
  }

  const expected = signExpiry(secret, expiresAt);

  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex"),
  );
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
