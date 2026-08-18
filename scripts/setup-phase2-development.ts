import { chmod, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import {
  createClient,
  type WebSocketLikeConstructor,
} from "@supabase/supabase-js";
import WebSocket from "ws";
import { z } from "zod";

import { readEnvValue, upsertEnvValue } from "./lib/env-file";
import {
  DEVELOPMENT_RUNNER,
  DEVELOPMENT_SITE,
} from "../src/lib/development/constants";
import { generateRunnerToken, hashToken, isRunnerToken } from "../src/lib/security/tokens";
import type { Database } from "../src/lib/supabase/database.types";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const controlRoot = resolve(scriptDirectory, "..");
const runnerRoot = resolve(controlRoot, "..", "ncloud-ai-runner");
const runnerEnvPath = resolve(runnerRoot, ".env");
const runnerGitignorePath = resolve(runnerRoot, ".gitignore");
const nodeWebSocketTransport = WebSocket as unknown as WebSocketLikeConstructor;

const secretKeyFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.delete("authorization");
  return fetch(input, { ...init, headers });
};

const setupEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().trim().regex(/^sb_secret_/),
});

async function verifyRunnerEnvIsIgnored(): Promise<void> {
  const gitignore = await readFile(runnerGitignorePath, "utf8");
  const ignoresEnv = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === ".env" || line === ".env*" || line === "*.env");

  if (!ignoresEnv) {
    throw new Error(
      "Runner .env is not explicitly ignored; refusing to write a credential.",
    );
  }
}

async function readRunnerEnvironment(): Promise<{
  contents: string;
  token: string | null;
}> {
  await verifyRunnerEnvIsIgnored();

  let contents = "";
  try {
    contents = await readFile(runnerEnvPath, "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const rawToken = readEnvValue(contents, "RUNNER_TOKEN");
  return {
    contents,
    token: rawToken !== null && isRunnerToken(rawToken) ? rawToken : null,
  };
}

async function writeRunnerToken(contents: string, runnerToken: string): Promise<void> {
  const nextContents = upsertEnvValue(
    contents,
    "RUNNER_TOKEN",
    runnerToken,
  );

  if (nextContents !== contents) {
    await writeFile(runnerEnvPath, nextContents, {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(runnerEnvPath, 0o600);
  }
}

function databaseFailure(operation: string, code?: string): Error {
  const safeCode = code && /^[A-Z0-9]+$/i.test(code) ? ` (${code})` : "";
  return new Error(`${operation} failed${safeCode}.`);
}

async function main(): Promise<void> {
  loadEnvConfig(controlRoot);
  const environment = setupEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });

  if (!environment.success) {
    throw new Error(
      "Required Supabase environment variables are missing or invalid.",
    );
  }

  const runnerEnvironment = await readRunnerEnvironment();
  const supabase = createClient<Database>(
    environment.data.NEXT_PUBLIC_SUPABASE_URL,
    environment.data.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      realtime: {
        transport: nodeWebSocketTransport,
      },
      global: {
        fetch: secretKeyFetch,
      },
    },
  );

  const [siteLookup, runnerLookup] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name, status")
      .eq("domain", DEVELOPMENT_SITE.domain)
      .maybeSingle(),
    supabase
      .from("runners")
      .select("id, token_hash, status, current_job_id")
      .eq("name", DEVELOPMENT_RUNNER.name)
      .maybeSingle(),
  ]);

  const { data: existingSite, error: siteLookupError } = siteLookup;
  const { data: existingRunner, error: runnerLookupError } = runnerLookup;

  if (siteLookupError) {
    throw databaseFailure("Development site lookup", siteLookupError.code);
  }
  if (runnerLookupError) {
    throw databaseFailure("Development runner lookup", runnerLookupError.code);
  }

  if (existingRunner !== null && existingRunner.current_job_id !== null) {
    throw new Error(
      "The development runner has an active job; refusing to change setup state.",
    );
  }

  if (existingRunner?.status === "disabled") {
    throw new Error(
      "The development runner is disabled; re-enable it explicitly before setup.",
    );
  }

  if (existingRunner !== null) {
    if (
      runnerEnvironment.token === null ||
      hashToken(runnerEnvironment.token) !== existingRunner.token_hash
    ) {
      throw new Error(
        "The existing runner token does not match the ignored runner .env; refusing automatic rotation.",
      );
    }
  }

  const runnerToken = runnerEnvironment.token ?? generateRunnerToken();
  const runnerTokenHash = hashToken(runnerToken);
  if (existingRunner === null) {
    await writeRunnerToken(runnerEnvironment.contents, runnerToken);
  }

  if (existingSite === null) {
    const discardedSiteTokenHash = hashToken(generateRunnerToken());
    const { error } = await supabase.from("sites").insert({
      name: DEVELOPMENT_SITE.name,
      domain: DEVELOPMENT_SITE.domain,
      site_token_hash: discardedSiteTokenHash,
      status: "active",
    });
    if (error) {
      throw databaseFailure("Development site creation", error.code);
    }
  } else if (
    existingSite.name !== DEVELOPMENT_SITE.name ||
    existingSite.status !== "active"
  ) {
    const { error } = await supabase
      .from("sites")
      .update({ name: DEVELOPMENT_SITE.name, status: "active" })
      .eq("id", existingSite.id);
    if (error) {
      throw databaseFailure("Development site reconciliation", error.code);
    }
  }

  if (existingRunner === null) {
    const { error } = await supabase.from("runners").insert({
      name: DEVELOPMENT_RUNNER.name,
      token_hash: runnerTokenHash,
      status: "offline",
    });
    if (error) {
      throw databaseFailure("Development runner creation", error.code);
    }
  }

  console.log("Phase 2 development records are configured.");
  console.log(`The raw runner token is stored only in ${runnerEnvPath}.`);
  console.log("No token or environment-variable value was printed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown setup error.";
  console.error(`Phase 2 development setup failed: ${message}`);
  process.exitCode = 1;
});
