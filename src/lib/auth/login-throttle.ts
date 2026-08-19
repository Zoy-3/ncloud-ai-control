import "server-only";

import {
  LOGIN_BLOCK_SECONDS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_SECONDS,
} from "@/lib/auth/login-throttle-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export {
  LOGIN_BLOCK_SECONDS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_SECONDS,
  loginIdentityHash,
} from "@/lib/auth/login-throttle-policy";

/** When the identity's block lifts, or null when it is not blocked. */
export async function loginBlockedUntil(
  identityHash: string,
): Promise<Date | null> {
  const { data, error } = await getSupabaseServerClient().rpc(
    "admin_login_blocked_until",
    { p_identity_hash: identityHash },
  );

  // A throttling lookup that fails must not lock the owner out of their own
  // system, so the request proceeds to normal credential checking.
  if (error || typeof data !== "string") {
    return null;
  }

  const until = new Date(data);

  return isNaN(until.getTime()) || until <= new Date() ? null : until;
}

/**
 * Records one failed attempt and reports whether the identity is now blocked.
 *
 * The counter lives in Postgres and is updated by a single statement, so every
 * serverless instance shares the same state and concurrent attempts cannot lose
 * each other's increments.
 */
export async function recordLoginFailure(
  identityHash: string,
): Promise<boolean> {
  const { data, error } = await getSupabaseServerClient().rpc(
    "record_admin_login_failure",
    {
      p_identity_hash: identityHash,
      p_window_seconds: LOGIN_WINDOW_SECONDS,
      p_max_failures: LOGIN_MAX_FAILURES,
      p_block_seconds: LOGIN_BLOCK_SECONDS,
    },
  );

  if (error || typeof data !== "string") {
    return false;
  }

  const until = new Date(data);

  return !isNaN(until.getTime()) && until > new Date();
}

/** Clears the failure state after a successful sign-in. */
export async function clearLoginFailures(identityHash: string): Promise<void> {
  await getSupabaseServerClient().rpc("clear_admin_login_failures", {
    p_identity_hash: identityHash,
  });
}
