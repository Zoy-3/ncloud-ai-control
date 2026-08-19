import "server-only";

import { ApiError } from "@/lib/api/errors";
import {
  adminAccountExists,
  createBootstrapAdmin,
  findAdminUserForSignIn,
  normalizeUsername,
  touchAdminLogin,
  type AdminUser,
} from "@/lib/auth/admin-users";
import {
  clearLoginFailures,
  loginBlockedUntil,
  loginIdentityHash,
  recordLoginFailure,
} from "@/lib/auth/login-throttle";
import { secretsMatch } from "@/lib/auth/admin-session";
import { verifyPassword } from "@/lib/auth/password";
import { getServerEnvironment } from "@/lib/env/server";

/**
 * One message for every credential failure.
 *
 * A wrong username, a wrong password, a disabled account, and an account that
 * does not exist all fail identically, so the response cannot be used to learn
 * which usernames are real.
 */
const CREDENTIALS_REJECTED = "Incorrect username or password.";
const THROTTLED = "Too many login attempts. Try again later.";

function rejected(): ApiError {
  return new ApiError(401, "unauthorized", CREDENTIALS_REJECTED);
}

/**
 * Authenticates an administrator.
 *
 * Bootstrap credentials are consulted only while no administrator account
 * exists. The moment one does, the environment password stops being an
 * authentication path entirely, so a temporary password can never become a
 * permanent back door.
 *
 * @returns The signed-in administrator.
 */
export async function signInAdmin(
  username: string,
  password: string,
): Promise<AdminUser> {
  const environment = getServerEnvironment();
  const secret = environment.NCLOUD_ADMIN_SECRET;

  if (secret === undefined) {
    throw rejected();
  }

  const normalized = normalizeUsername(username);
  const identity = loginIdentityHash(normalized, secret);

  if ((await loginBlockedUntil(identity)) !== null) {
    throw new ApiError(429, "forbidden", THROTTLED);
  }

  const existing = await adminAccountExists();
  const user = existing
    ? await verifyStoredCredentials(normalized, password)
    : await verifyBootstrapCredentials(normalized, password);

  if (user === null) {
    const blocked = await recordLoginFailure(identity);

    throw blocked
      ? new ApiError(429, "forbidden", THROTTLED)
      : rejected();
  }

  await clearLoginFailures(identity);
  await touchAdminLogin(user.id);

  return user;
}

/** Normal sign-in against the stored hash. */
async function verifyStoredCredentials(
  username: string,
  password: string,
): Promise<AdminUser | null> {
  const found = await findAdminUserForSignIn(username);

  if (found === null) {
    return null;
  }

  // The password is still verified for a disabled account so the work done —
  // and therefore the time taken — does not reveal the account's state.
  const correct = await verifyPassword(password, found.passwordHash);

  if (!correct || found.user.status !== "active") {
    return null;
  }

  return found.user;
}

/**
 * First sign-in, which creates the administrator account.
 *
 * Reached only while no account exists. The new record is created already
 * needing a password change.
 */
async function verifyBootstrapCredentials(
  username: string,
  password: string,
): Promise<AdminUser | null> {
  const environment = getServerEnvironment();
  const expectedUsername = environment.NCLOUD_BOOTSTRAP_USERNAME;
  const expectedPassword = environment.NCLOUD_BOOTSTRAP_PASSWORD;

  if (expectedUsername === undefined || expectedPassword === undefined) {
    return null;
  }

  const usernameMatches = secretsMatch(
    username,
    normalizeUsername(expectedUsername),
  );
  const passwordMatches = secretsMatch(password, expectedPassword);

  // Both comparisons always run, so the response time does not reveal which
  // half was wrong.
  if (!usernameMatches || !passwordMatches) {
    return null;
  }

  return createBootstrapAdmin(expectedUsername, expectedPassword);
}
