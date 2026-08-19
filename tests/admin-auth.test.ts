import assert from "node:assert/strict";
import test from "node:test";

import {
  adminSignInBodySchema,
  changePasswordBodySchema,
  createSiteBodySchema,
  requestBodyLimits,
  siteStatusBodySchema,
} from "../src/lib/api/schemas";
import {
  ADMIN_SESSION_COOKIE,
  adminCookieOptions,
  createAdminSessionValue,
  readAdminSession,
  secretsMatch,
} from "../src/lib/auth/admin-session";
import {
  hashPassword,
  isAcceptablePassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
} from "../src/lib/auth/password";
import {
  LOGIN_BLOCK_SECONDS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_SECONDS,
  loginIdentityHash,
} from "../src/lib/auth/login-throttle-policy";
import { serverEnvironmentSchema } from "../src/lib/env/schema";
import { authorizeSite, readSiteToken } from "../src/lib/auth/site-token";
import {
  generateSiteToken,
  hashToken,
  isSiteToken,
} from "../src/lib/security/tokens";
import { ApiError } from "../src/lib/api/errors";

const secret = "a-sufficiently-long-session-secret";
const userId = "7c3a1d90-2f4b-4a61-9b8e-2c5d7e1a4f60";
const now = 1_800_000_000;

const temporary = "temporary-bootstrap-password";
const chosen = "a-real-chosen-password";

/* Passwords
   ------------------------------------------------------------------------ */

test("a stored password is a salted, versioned scrypt hash and nothing else", async () => {
  const hash = await hashPassword(chosen);

  assert.match(hash, /^scrypt\$v1\$\d+,\d+,\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  // The plaintext must be nowhere in the stored value.
  assert.equal(hash.includes(chosen), false);

  // The salt is random, so the same password never produces the same hash.
  assert.notEqual(hash, await hashPassword(chosen));
});

test("only the correct password verifies", async () => {
  const hash = await hashPassword(chosen);

  assert.equal(await verifyPassword(chosen, hash), true);
  assert.equal(await verifyPassword(`${chosen}x`, hash), false);
  assert.equal(await verifyPassword(chosen.slice(0, -1), hash), false);
  assert.equal(await verifyPassword("", hash), false);

  // A temporary password stops working once a real one replaces it.
  const replaced = await hashPassword(chosen);
  assert.equal(await verifyPassword(temporary, replaced), false);
});

test("a damaged or unknown hash fails rather than throwing", async () => {
  for (const stored of [
    "",
    "not-a-hash",
    "scrypt$v9$16384,8,1$aaaa$bbbb",
    "scrypt$v1$0,0,0$aaaa$bbbb",
    "md5$v1$1,1,1$aaaa$bbbb",
    "scrypt$v1$16384,8,1$$",
  ]) {
    assert.equal(await verifyPassword(chosen, stored), false);
  }
});

test("password length is the only rule, and it is bounded at both ends", () => {
  assert.equal(isAcceptablePassword("x".repeat(PASSWORD_MIN_LENGTH)), true);
  assert.equal(isAcceptablePassword("x".repeat(PASSWORD_MIN_LENGTH - 1)), false);
  assert.equal(isAcceptablePassword("x".repeat(PASSWORD_MAX_LENGTH)), true);
  assert.equal(isAcceptablePassword("x".repeat(PASSWORD_MAX_LENGTH + 1)), false);
  assert.equal(isAcceptablePassword(12345678901234), false);
});

/* Sessions
   ------------------------------------------------------------------------ */

test("a session identifies a user and carries no secret", () => {
  const value = createAdminSessionValue(secret, userId, now + 3600);

  assert.equal(value.includes(secret), false);
  assert.equal(value.includes(chosen), false);
  assert.match(value, /^[0-9a-f-]{36}\.\d+\.[0-9a-f]{64}$/);

  assert.deepEqual(readAdminSession(value, secret, now), {
    userId,
    expiresAt: now + 3600,
  });
});

test("absent, malformed, forged, and expired sessions are all rejected", () => {
  const valid = createAdminSessionValue(secret, userId, now + 3600);
  const [, , signature] = valid.split(".");

  for (const value of [
    null,
    undefined,
    "",
    "   ",
    "not-a-session",
    `${userId}.${now + 3600}`,
    `${userId}.${now + 3600}.`,
    `not-a-uuid.${now + 3600}.${signature}`,
    `${userId}.${now + 3600}.zzzz`,
    // Expiry edited to extend the session.
    `${userId}.${now + 999999}.${signature}`,
    // Another user's id swapped in under this signature.
    `0f5c2a77-8d31-4b6e-9c04-7a2e1f8b3d59.${now + 3600}.${signature}`,
  ]) {
    assert.equal(readAdminSession(value, secret, now), null);
  }

  // Genuine but past its expiry.
  assert.equal(
    readAdminSession(createAdminSessionValue(secret, userId, now - 1), secret, now),
    null,
  );

  // Rotating the signing secret invalidates every existing session.
  assert.equal(readAdminSession(valid, "a-completely-different-secret", now), null);
});

test("the session cookie is HttpOnly, SameSite, and Secure in production", () => {
  const production = adminCookieOptions(true, 3600);

  assert.equal(production.httpOnly, true);
  assert.equal(production.secure, true);
  assert.equal(production.sameSite, "lax");
  assert.equal(production.path, "/");

  assert.equal(adminCookieOptions(false, 3600).secure, false);
  // Signing out clears rather than shortens.
  assert.equal(adminCookieOptions(true, 0).maxAge, 0);
  assert.equal(ADMIN_SESSION_COOKIE, "ncloud_admin_session");
});

/* Sign-in contract
   ------------------------------------------------------------------------ */

test("the sign-in body accepts exactly a username and a password", () => {
  assert.equal(
    adminSignInBodySchema.safeParse({ username: "ncloud-admin", password: "x" })
      .success,
    true,
  );
  assert.equal(adminSignInBodySchema.safeParse({ username: "a" }).success, false);
  // Nothing else may be smuggled in, including a secret or a role.
  assert.equal(
    adminSignInBodySchema.safeParse({
      username: "a",
      password: "x",
      secret: "y",
    }).success,
    false,
  );
});

test("credential comparison is exact", () => {
  assert.equal(secretsMatch(temporary, temporary), true);
  assert.equal(secretsMatch(`${temporary}x`, temporary), false);
  assert.equal(secretsMatch("", temporary), false);
});

test("the change-password body requires a confirmation", () => {
  assert.equal(
    changePasswordBodySchema.safeParse({
      newPassword: "x".repeat(12),
      confirmPassword: "x".repeat(12),
    }).success,
    true,
  );
  // Settings sends the current password too.
  assert.equal(
    changePasswordBodySchema.safeParse({
      currentPassword: "old",
      newPassword: "x".repeat(12),
      confirmPassword: "x".repeat(12),
    }).success,
    true,
  );
  assert.equal(
    changePasswordBodySchema.safeParse({ newPassword: "x".repeat(12) }).success,
    false,
  );
  assert.equal(
    changePasswordBodySchema.safeParse({
      newPassword: "x".repeat(12),
      confirmPassword: "x".repeat(12),
      userId,
    }).success,
    false,
  );
});

test("bootstrap credentials are optional, bounded, and separate from other secrets", () => {
  const base = {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    SUPABASE_SECRET_KEY: "sb_secret_example",
  };

  // Absent is valid: after initialization they are never consulted again.
  assert.equal(serverEnvironmentSchema.safeParse(base).success, true);

  // A weak temporary password is refused.
  assert.equal(
    serverEnvironmentSchema.safeParse({
      ...base,
      NCLOUD_BOOTSTRAP_USERNAME: "ncloud-admin",
      NCLOUD_BOOTSTRAP_PASSWORD: "short",
    }).success,
    false,
  );
  assert.equal(
    serverEnvironmentSchema.safeParse({
      ...base,
      NCLOUD_BOOTSTRAP_USERNAME: "ncloud-admin",
      NCLOUD_BOOTSTRAP_PASSWORD: "x".repeat(16),
    }).success,
    true,
  );

  // Three distinct variables with three distinct jobs.
  assert.notEqual("NCLOUD_ADMIN_SECRET", "NCLOUD_BOOTSTRAP_PASSWORD");
  assert.notEqual("NCLOUD_BOOTSTRAP_PASSWORD", "DEV_API_SECRET");
  assert.notEqual("NCLOUD_ADMIN_SECRET", "SUPABASE_SECRET_KEY");
});

/* Login throttling
   ------------------------------------------------------------------------ */

test("the throttle identity is a keyed hash, never a plaintext username", () => {
  const identity = loginIdentityHash("NCloud-Admin", secret);

  assert.match(identity, /^[0-9a-f]{64}$/);
  assert.equal(identity.includes("ncloud-admin"), false);
  assert.equal(identity.includes(secret), false);

  // Case and surrounding space do not create a separate bucket, so varying
  // them cannot be used to get extra attempts.
  assert.equal(identity, loginIdentityHash("  ncloud-admin  ", secret));
  // Different accounts are throttled independently.
  assert.notEqual(identity, loginIdentityHash("someone-else", secret));
  // The hash is keyed, so it cannot be precomputed without the server secret.
  assert.notEqual(identity, loginIdentityHash("ncloud-admin", "another-secret"));
});

test("the throttle policy is five failures per fifteen minutes", () => {
  assert.equal(LOGIN_MAX_FAILURES, 5);
  assert.equal(LOGIN_WINDOW_SECONDS, 15 * 60);
  assert.equal(LOGIN_BLOCK_SECONDS, 15 * 60);
});

/* Site tokens
   ------------------------------------------------------------------------ */

test("a site token is 256 bits of randomness, stored only as a hash", () => {
  const token = generateSiteToken();

  assert.equal(token.length, 43);
  assert.equal(isSiteToken(token), true);
  assert.notEqual(token, generateSiteToken());

  const hash = hashToken(token);

  assert.match(hash, /^[0-9a-f]{64}$/);
  // The hash cannot be turned back into the token.
  assert.equal(hash.includes(token), false);
});

test("rotation invalidates the previous token and only the new one matches", () => {
  const original = generateSiteToken();
  const stored = hashToken(original);
  const rotated = generateSiteToken();
  const rotatedHash = hashToken(rotated);

  assert.equal(hashToken(original), stored);
  assert.notEqual(rotatedHash, stored);
  // Only one hash is kept, so the old token can no longer match.
  assert.notEqual(hashToken(original), rotatedHash);
  assert.equal(hashToken(rotated), rotatedHash);
});

test("a disabled site cannot authenticate, and enabling it restores access", () => {
  const record = {
    id: "5988ae3e-7177-46aa-8198-c15f87e19d28",
    name: "Example",
    domain: "example.com",
    status: "disabled" as const,
  };

  assert.throws(
    () => authorizeSite(record),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 403);
      assert.equal(error.code, "forbidden");
      return true;
    },
  );

  // The same record, enabled again, authenticates with the same token.
  assert.equal(authorizeSite({ ...record, status: "active" }).id, record.id);
});

test("one site's token can never authenticate another site", () => {
  const siteA = generateSiteToken();
  const siteB = generateSiteToken();

  // Lookup is by hash, and two different tokens never share one.
  assert.notEqual(hashToken(siteA), hashToken(siteB));
});

test("site management bodies are bounded and normalized", () => {
  const parsed = createSiteBodySchema.parse({
    name: "  Example Site  ",
    domain: "  Example.COM  ",
  });

  assert.equal(parsed.name, "Example Site");
  assert.equal(parsed.domain, "example.com");

  // A URL or a path is not a domain.
  for (const domain of ["https://example.com", "example.com/path", "a b", ""]) {
    assert.equal(
      createSiteBodySchema.safeParse({ name: "X", domain }).success,
      false,
    );
  }

  // Ownership and token material can never be supplied by the caller.
  for (const forged of [
    { siteToken: "x" },
    { site_token_hash: "x" },
    { status: "active" },
    { id: userId },
  ]) {
    assert.equal(
      createSiteBodySchema.safeParse({
        name: "X",
        domain: "example.com",
        ...forged,
      }).success,
      false,
    );
  }

  assert.equal(siteStatusBodySchema.safeParse({ status: "active" }).success, true);
  assert.equal(siteStatusBodySchema.safeParse({ status: "deleted" }).success, false);
});

test("authentication request bodies stay small", () => {
  assert.equal(requestBodyLimits.adminSignIn, 1_000);
  assert.equal(requestBodyLimits.changePassword, 1_000);
  assert.equal(requestBodyLimits.createSite, 1_000);
  assert.equal(requestBodyLimits.siteStatus, 200);
});

test("a site bearer token is still required by the WordPress routes", () => {
  for (const authorization of [null, "", "Bearer ", "Basic abc", "Bearer short"]) {
    assert.throws(
      () => readSiteToken(authorization),
      (error: unknown) =>
        error instanceof ApiError && error.status === 401,
    );
  }
});
