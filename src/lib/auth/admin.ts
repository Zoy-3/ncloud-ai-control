import "server-only";

import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/errors";
import {
  ADMIN_SESSION_COOKIE,
  isValidAdminSession,
} from "@/lib/auth/admin-session";
import { getServerEnvironment } from "@/lib/env/server";

/**
 * The configured admin secret.
 *
 * Absent means the manager is switched off. Every admin route refuses to
 * operate in that state rather than falling open, so a deployment that has not
 * set the secret exposes nothing.
 */
export function readAdminSecret(): string | null {
  return getServerEnvironment().NCLOUD_ADMIN_SECRET ?? null;
}

export function adminManagerEnabled(): boolean {
  return readAdminSecret() !== null;
}

/** One identical failure whether the manager is off, the cookie is missing, or it is invalid. */
function unauthorized(): ApiError {
  return new ApiError(401, "unauthorized", "Administrator sign-in required.");
}

/** Whether the current request carries a valid admin session. */
export async function hasAdminSession(): Promise<boolean> {
  const secret = readAdminSecret();

  if (secret === null) {
    return false;
  }

  const store = await cookies();

  return isValidAdminSession(
    store.get(ADMIN_SESSION_COOKIE)?.value ?? null,
    secret,
    Math.floor(Date.now() / 1000),
  );
}

/**
 * Ends the request unless it carries a valid admin session.
 *
 * Every admin write goes through this. Site tokens are not accepted here: a
 * WordPress site can never reach template administration.
 */
export async function requireAdminSession(): Promise<void> {
  if (!(await hasAdminSession())) {
    throw unauthorized();
  }
}
