import "server-only";

import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/errors";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  adminCookieOptions,
  createAdminSessionValue,
  readAdminSession,
} from "@/lib/auth/admin-session";
import { findAdminUserById, type AdminUser } from "@/lib/auth/admin-users";
import { getServerEnvironment } from "@/lib/env/server";

/**
 * The server-side session signing secret.
 *
 * Since the authentication patch this is no longer anybody's password: it signs
 * session cookies and nothing else. It is never sent to the browser and never
 * stored in the database.
 */
export function readSessionSecret(): string | null {
  return getServerEnvironment().NCLOUD_ADMIN_SECRET ?? null;
}

export function adminManagerEnabled(): boolean {
  return readSessionSecret() !== null;
}

/** One identical failure however the request failed to authenticate. */
function unauthorized(): ApiError {
  return new ApiError(401, "unauthorized", "Administrator sign-in required.");
}

/**
 * Resolves the administrator this request belongs to.
 *
 * A valid signature is not enough on its own: the account must still exist and
 * still be active, so disabling an account takes effect immediately rather than
 * when its cookie happens to expire.
 */
export async function readCurrentAdmin(): Promise<AdminUser | null> {
  const secret = readSessionSecret();

  if (secret === null) {
    return null;
  }

  const store = await cookies();
  const claims = readAdminSession(
    store.get(ADMIN_SESSION_COOKIE)?.value ?? null,
    secret,
    Math.floor(Date.now() / 1000),
  );

  if (claims === null) {
    return null;
  }

  const user = await findAdminUserById(claims.userId);

  if (user === null || user.status !== "active") {
    return null;
  }

  return user;
}

/**
 * Ends the request unless it carries a session belonging to an active
 * administrator who is not mid-password-change.
 *
 * Every admin API goes through this. Site tokens are not accepted here: a
 * WordPress site can never reach administration.
 */
export async function requireAdminSession(): Promise<AdminUser> {
  const user = await readCurrentAdmin();

  if (user === null) {
    throw unauthorized();
  }

  if (user.mustChangePassword) {
    throw new ApiError(
      403,
      "forbidden",
      "Set a new password before continuing.",
    );
  }

  return user;
}

/** Issues a fresh session cookie for a user. Used on sign-in and after a password change. */
export async function startAdminSession(userId: string): Promise<void> {
  const secret = readSessionSecret();

  if (secret === null) {
    throw unauthorized();
  }

  const expiresAt =
    Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS;
  const store = await cookies();

  store.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionValue(secret, userId, expiresAt),
    adminCookieOptions(
      process.env.NODE_ENV === "production",
      ADMIN_SESSION_MAX_AGE_SECONDS,
    ),
  );
}

/** Clears the session cookie. */
export async function endAdminSession(): Promise<void> {
  const store = await cookies();

  store.set(
    ADMIN_SESSION_COOKIE,
    "",
    adminCookieOptions(process.env.NODE_ENV === "production", 0),
  );
}
