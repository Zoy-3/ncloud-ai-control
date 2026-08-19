import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AdminUserStatus } from "@/lib/supabase/database.types";
import { hashPassword } from "@/lib/auth/password";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * An administrator as the application sees them.
 *
 * `password_hash` is deliberately absent from this shape, so no route, page, or
 * response can include it even by mistake.
 */
export type AdminUser = {
  id: string;
  username: string;
  mustChangePassword: boolean;
  status: AdminUserStatus;
  lastLoginAt: string | null;
};

/** Columns safe to project into `AdminUser`. Never includes the hash. */
const publicColumns = "id, username, must_change_password, status, last_login_at";

const unavailable = "Sign-in is temporarily unavailable.";

function toAdminUser(row: {
  id: string;
  username: string;
  must_change_password: boolean;
  status: AdminUserStatus;
  last_login_at: string | null;
}): AdminUser {
  return {
    id: row.id,
    username: row.username,
    mustChangePassword: row.must_change_password,
    status: row.status,
    lastLoginAt: row.last_login_at,
  };
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Whether any administrator account exists.
 *
 * This is the switch that disables the bootstrap credentials: once one account
 * has been created, the environment password is never consulted again.
 */
export async function adminAccountExists(): Promise<boolean> {
  const { count, error } = await getSupabaseServerClient()
    .from("admin_users")
    .select("id", { count: "exact", head: true });

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  return (count ?? 0) > 0;
}

export async function findAdminUserById(id: string): Promise<AdminUser | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("admin_users")
    .select(publicColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  return data === null ? null : toAdminUser(data);
}

/**
 * Reads one account together with its stored hash, for verification only.
 *
 * The hash is returned to the caller that immediately checks a password against
 * it and is never carried any further.
 */
export async function findAdminUserForSignIn(
  username: string,
): Promise<{ user: AdminUser; passwordHash: string } | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("admin_users")
    .select(`${publicColumns}, password_hash`)
    .eq("username", normalizeUsername(username))
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  if (data === null) {
    return null;
  }

  return { user: toAdminUser(data), passwordHash: data.password_hash };
}

/**
 * Creates the first administrator from the bootstrap credentials.
 *
 * The account is created already needing a password change, so the temporary
 * password cannot survive as a working credential.
 */
export async function createBootstrapAdmin(
  username: string,
  password: string,
): Promise<AdminUser> {
  const { data, error } = await getSupabaseServerClient()
    .from("admin_users")
    .insert({
      username: normalizeUsername(username),
      password_hash: await hashPassword(password),
      must_change_password: true,
      status: "active",
    })
    .select(publicColumns)
    .single();

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  return toAdminUser(data);
}

/** Replaces an account's password and clears the forced-change flag. */
export async function setAdminPassword(
  userId: string,
  password: string,
): Promise<AdminUser> {
  const { data, error } = await getSupabaseServerClient()
    .from("admin_users")
    .update({
      password_hash: await hashPassword(password),
      must_change_password: false,
    })
    .eq("id", userId)
    .select(publicColumns)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "The password could not be changed.");
  }

  if (data === null) {
    throw new ApiError(404, "not_found", "The account no longer exists.");
  }

  return toAdminUser(data);
}

/** Records a successful sign-in. A failure here must not block the sign-in. */
export async function touchAdminLogin(userId: string): Promise<void> {
  await getSupabaseServerClient()
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);
}
