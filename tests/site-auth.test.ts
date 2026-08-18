import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, apiErrorResponse } from "../src/lib/api/errors";
import { provisionSiteTokenBodySchema } from "../src/lib/api/schemas";
import {
  authorizeSite,
  readSiteToken,
  type SiteAuthenticationRecord,
} from "../src/lib/auth/site-token";
import {
  generateSiteToken,
  hashToken,
  isSiteToken,
} from "../src/lib/security/tokens";

const validToken = generateSiteToken();

function activeSite(): SiteAuthenticationRecord {
  return {
    id: "0f9b6b4e-1f3a-4c2e-9a1b-7d5c3e8f2a10",
    name: "NCloud Development Site",
    domain: "ncloud-development.local",
    status: "active",
  };
}

function assertUnauthorized(run: () => unknown): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.code, "unauthorized");
    assert.equal(error.message, "Site authentication failed.");
    return true;
  });
}

test("site tokens use the project's 256-bit base64url bearer convention", () => {
  const first = generateSiteToken();
  const second = generateSiteToken();

  assert.equal(first.length, 43);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(isSiteToken(first), true);
  assert.notEqual(first, second);
});

test("site token hashing is SHA-256 and never reversible to the raw token", () => {
  const digest = hashToken(validToken);

  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest, hashToken(validToken));
  assert.notEqual(digest, hashToken(generateSiteToken()));
  assert.equal(digest.includes(validToken), false);
});

test("a missing Authorization header is rejected", () => {
  assertUnauthorized(() => readSiteToken(null));
});

test("a non-Bearer authentication scheme is rejected", () => {
  assertUnauthorized(() => readSiteToken(`Basic ${validToken}`));
  assertUnauthorized(() => readSiteToken(`Token ${validToken}`));
  assertUnauthorized(() => readSiteToken(validToken));
});

test("malformed site tokens are rejected before any database lookup", () => {
  assertUnauthorized(() => readSiteToken("Bearer "));
  assertUnauthorized(() => readSiteToken("Bearer short-token"));
  assertUnauthorized(() => readSiteToken(`Bearer ${validToken}extra`));
  assertUnauthorized(() => readSiteToken(`Bearer ${validToken.slice(0, 42)}`));
  assertUnauthorized(() => readSiteToken(`Bearer ${validToken.slice(0, 42)}$`));
  assertUnauthorized(() => readSiteToken(`Bearer  ${validToken}`));
});

test("a well-formed bearer site token is parsed unchanged", () => {
  assert.equal(readSiteToken(`Bearer ${validToken}`), validToken);
  assert.equal(readSiteToken(`bearer ${validToken}`), validToken);
});

test("an unknown token fails exactly like a malformed one", () => {
  assertUnauthorized(() => authorizeSite(null));
});

test("a disabled site is refused with a distinct forbidden error", () => {
  assert.throws(
    () => authorizeSite({ ...activeSite(), status: "disabled" }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 403);
      assert.equal(error.code, "forbidden");
      assert.equal(error.message, "Site access is disabled.");
      return true;
    },
  );
});

test("an active site returns only safe identity fields", () => {
  const record = activeSite();
  const authenticated = authorizeSite(record);

  assert.deepEqual(authenticated, {
    id: record.id,
    name: record.name,
    domain: record.domain,
    status: "active",
  });
  assert.equal(Object.hasOwn(authenticated, "site_token_hash"), false);
});

test("site authentication failures respond safely and without the token", async () => {
  let thrown: unknown;
  try {
    readSiteToken(`Bearer ${validToken.slice(0, 10)}`);
  } catch (error) {
    thrown = error;
  }

  const response = apiErrorResponse(thrown);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");

  const body = await response.text();
  assert.equal(body.includes(validToken.slice(0, 10)), false);
  assert.deepEqual(JSON.parse(body), {
    success: false,
    error: { code: "unauthorized", message: "Site authentication failed." },
  });
});

test("token provisioning requires exactly one explicit site identifier", () => {
  assert.deepEqual(
    provisionSiteTokenBodySchema.parse({
      siteId: "0f9b6b4e-1f3a-4c2e-9a1b-7d5c3e8f2a10",
    }),
    { siteId: "0f9b6b4e-1f3a-4c2e-9a1b-7d5c3e8f2a10" },
  );
  assert.deepEqual(
    provisionSiteTokenBodySchema.parse({ domain: " NCloud-Development.local " }),
    { domain: "ncloud-development.local" },
  );
  assert.equal(
    provisionSiteTokenBodySchema.safeParse({ siteId: "not-a-uuid" }).success,
    false,
  );
  assert.equal(
    provisionSiteTokenBodySchema.safeParse({
      domain: "ncloud-development.local",
      status: "active",
    }).success,
    false,
  );
  assert.equal(provisionSiteTokenBodySchema.safeParse({}).success, false);
});
