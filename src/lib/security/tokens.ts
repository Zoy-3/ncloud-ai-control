import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const runnerTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function generateRunnerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isRunnerToken(value: string): boolean {
  return runnerTokenPattern.test(value);
}

export function readBearerToken(authorization: string | null): string | null {
  if (authorization === null) {
    return null;
  }

  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  return match?.[1] ?? null;
}

export function tokensEqual(actual: string, expected: string): boolean {
  const actualHash = Buffer.from(hashToken(actual), "hex");
  const expectedHash = Buffer.from(hashToken(expected), "hex");
  return timingSafeEqual(actualHash, expectedHash);
}
