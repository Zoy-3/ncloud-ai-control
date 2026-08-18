import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, apiErrorResponse } from "../src/lib/api/errors";
import { parseJsonBody } from "../src/lib/api/request";
import { successResponse } from "../src/lib/api/response";
import {
  claimBodySchema,
  completeJobBodySchema,
  createDevJobBodySchema,
  heartbeatBodySchema,
} from "../src/lib/api/schemas";
import { mapClaimedJob, mapJobStatus } from "../src/lib/jobs/models";
import {
  generateRunnerToken,
  hashToken,
  isRunnerToken,
  readBearerToken,
  tokensEqual,
} from "../src/lib/security/tokens";
import { readEnvValue, upsertEnvValue } from "../scripts/lib/env-file";

test("runner tokens are random 256-bit base64url values", () => {
  const first = generateRunnerToken();
  const second = generateRunnerToken();

  assert.equal(first.length, 43);
  assert.equal(isRunnerToken(first), true);
  assert.equal(isRunnerToken(second), true);
  assert.notEqual(first, second);
});

test("token hashing is SHA-256 and comparison is constant-length", () => {
  assert.equal(
    hashToken("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(tokensEqual("same", "same"), true);
  assert.equal(tokensEqual("same", "different"), false);
});

test("bearer parsing is strict and never accepts whitespace in a token", () => {
  assert.equal(readBearerToken("Bearer abc_123"), "abc_123");
  assert.equal(readBearerToken("bearer abc_123"), "abc_123");
  assert.equal(readBearerToken("Bearer  abc_123"), null);
  assert.equal(readBearerToken("Bearer abc 123"), null);
  assert.equal(readBearerToken(null), null);
});

test("runner request schemas enforce their exact wire contracts", () => {
  assert.deepEqual(heartbeatBodySchema.parse({ name: " runner " }), {
    name: "runner",
  });
  assert.equal(
    heartbeatBodySchema.safeParse({ name: "runner", runnerId: "forged" })
      .success,
    false,
  );
  assert.equal(claimBodySchema.safeParse({}).success, true);
  assert.equal(claimBodySchema.safeParse({ runnerId: "forged" }).success, false);
  assert.equal(
    completeJobBodySchema.safeParse({ shortcode: "   " }).success,
    false,
  );
  assert.deepEqual(createDevJobBodySchema.parse({ prompt: " test " }), {
    prompt: "test",
  });
});

test("JSON parsing requires the media type and enforces byte limits", async () => {
  const request = new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: "{}",
  });
  assert.deepEqual(await parseJsonBody(request, claimBodySchema, 16), {});

  const wrongType = new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "{}",
  });
  await assert.rejects(
    () => parseJsonBody(wrongType, claimBodySchema, 16),
    (error: unknown) =>
      error instanceof ApiError && error.status === 415 && error.code === "unsupported_media_type",
  );
});

test("database field names map to the public claim and status contracts", () => {
  assert.deepEqual(
    mapClaimedJob({
      id: "job-id",
      type: "generate_section",
      prompt: "Create a section",
      context_json: { locale: "en" },
    }),
    {
      id: "job-id",
      type: "generate_section",
      prompt: "Create a section",
      context: { locale: "en" },
    },
  );
  assert.deepEqual(
    mapJobStatus({
      id: "job-id",
      status: "completed",
      result_shortcode: "[section][/section]",
    }),
    {
      id: "job-id",
      status: "completed",
      resultShortcode: "[section][/section]",
    },
  );
});

test("all API response helpers disable caching and hide internal errors", async () => {
  const success = successResponse({ success: true }, 201);
  assert.equal(success.status, 201);
  assert.equal(success.headers.get("cache-control"), "no-store");

  const failure = apiErrorResponse(
    new ApiError(401, "unauthorized", "Authentication failed."),
  );
  assert.equal(failure.status, 401);
  assert.equal(failure.headers.get("cache-control"), "no-store");
  assert.deepEqual(await failure.json(), {
    success: false,
    error: { code: "unauthorized", message: "Authentication failed." },
  });
});

test("runner env merge preserves other settings and removes duplicate tokens", () => {
  const original = [
    "NCLOUD_API_URL=http://127.0.0.1:3000",
    "RUNNER_TOKEN=old",
    "POLL_INTERVAL_MS=5000",
    "RUNNER_TOKEN=duplicate",
    "",
  ].join("\n");
  const updated = upsertEnvValue(original, "RUNNER_TOKEN", "replacement");

  assert.equal(readEnvValue(updated, "RUNNER_TOKEN"), "replacement");
  assert.equal((updated.match(/^RUNNER_TOKEN=/gm) ?? []).length, 1);
  assert.match(updated, /^NCLOUD_API_URL=/m);
  assert.match(updated, /^POLL_INTERVAL_MS=/m);
});
