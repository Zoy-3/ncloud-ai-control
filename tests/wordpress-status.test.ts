import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, apiErrorResponse } from "../src/lib/api/errors";
import {
  authorizeSite,
  readSiteToken,
  type AuthenticatedSite,
} from "../src/lib/auth/site-token";
import {
  isHeartbeatFresh,
  resolveRunnerAvailability,
  RUNNER_HEARTBEAT_FRESHNESS_MS,
} from "../src/lib/runners/availability";
import { generateSiteToken, hashToken } from "../src/lib/security/tokens";
import { buildWordPressStatus } from "../src/lib/wordpress/status";

const now = new Date("2026-08-18T18:00:00.000Z");

function activeSite(): AuthenticatedSite {
  return {
    id: "5988ae3e-7177-46aa-8198-c15f87e19d28",
    name: "NCloud Development Site",
    domain: "ncloud-development.local",
    status: "active",
  };
}

function secondsAgo(seconds: number): string {
  return new Date(now.getTime() - seconds * 1000).toISOString();
}

test("an authenticated active site produces a complete status payload", () => {
  const status = buildWordPressStatus(activeSite(), "online", now.toISOString());

  assert.deepEqual(status, {
    connected: true,
    service: {
      name: "NCloud AI Control",
      status: "online",
      timestamp: now.toISOString(),
    },
    site: {
      id: "5988ae3e-7177-46aa-8198-c15f87e19d28",
      name: "NCloud Development Site",
      domain: "ncloud-development.local",
      status: "active",
    },
    runner: { status: "online" },
  });
});

test("the status payload carries no token, hash, or credential material", () => {
  const token = generateSiteToken();
  const site = activeSite();
  const serialized = JSON.stringify(
    buildWordPressStatus(site, "offline", now.toISOString()),
  );

  assert.equal(serialized.includes(token), false);
  assert.equal(serialized.includes(hashToken(token)), false);

  for (const forbidden of [
    "token",
    "hash",
    "secret",
    "apikey",
    "supabase",
    "sb_secret",
    "authorization",
    "site_token_hash",
    "DEV_API_SECRET",
  ]) {
    assert.equal(
      serialized.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `status payload leaked "${forbidden}"`,
    );
  }
});

test("a status request without a token fails safely", async () => {
  let thrown: unknown;
  try {
    readSiteToken(null);
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof ApiError);
  assert.equal(thrown.status, 401);

  const response = apiErrorResponse(thrown);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    success: false,
    error: { code: "unauthorized", message: "Site authentication failed." },
  });
});

test("a status request with an invalid token fails identically", () => {
  const unknownToken = generateSiteToken();

  for (const authorization of [
    `Bearer ${unknownToken.slice(0, 20)}`,
    `Basic ${unknownToken}`,
    "Bearer ",
  ]) {
    assert.throws(
      () => readSiteToken(authorization),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 401 &&
        error.message === "Site authentication failed.",
    );
  }

  // A well-formed token that matches no site row fails the same way.
  assert.throws(
    () => authorizeSite(null),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 401 &&
      error.message === "Site authentication failed.",
  );
});

test("a disabled site cannot reach the status endpoint", () => {
  assert.throws(
    () => authorizeSite({ ...activeSite(), status: "disabled" }),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 403 &&
      error.code === "forbidden",
  );
});

test("runner availability follows the shared heartbeat freshness window", () => {
  assert.equal(isHeartbeatFresh(secondsAgo(5), now), true);
  assert.equal(isHeartbeatFresh(secondsAgo(29), now), true);
  assert.equal(isHeartbeatFresh(secondsAgo(31), now), false);
  assert.equal(isHeartbeatFresh(null, now), false);
  assert.equal(isHeartbeatFresh("not-a-timestamp", now), false);
  // A heartbeat from the future is not evidence of a live runner.
  assert.equal(isHeartbeatFresh(secondsAgo(-10), now), false);
  assert.equal(RUNNER_HEARTBEAT_FRESHNESS_MS, 30_000);
});

test("runner state degrades to offline or unknown instead of failing", () => {
  assert.equal(
    resolveRunnerAvailability(
      [{ status: "online", last_seen_at: secondsAgo(3) }],
      now,
    ),
    "online",
  );
  assert.equal(
    resolveRunnerAvailability(
      [{ status: "online", last_seen_at: secondsAgo(120) }],
      now,
    ),
    "offline",
  );
  assert.equal(
    resolveRunnerAvailability(
      [{ status: "disabled", last_seen_at: secondsAgo(1) }],
      now,
    ),
    "offline",
  );
  assert.equal(resolveRunnerAvailability([], now), "offline");
  // `null` stands for an unreadable runner table, which must not fail status.
  assert.equal(resolveRunnerAvailability(null, now), "unknown");
});
