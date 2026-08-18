import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Runners and WordPress sites share one bearer-token convention: 256 random
// bits encoded as 43 base64url characters, stored only as a SHA-256 hash.
const bearerTokenPattern = /^[A-Za-z0-9_-]{43}$/;

function generateBearerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateRunnerToken(): string {
  return generateBearerToken();
}

export function generateSiteToken(): string {
  return generateBearerToken();
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isRunnerToken(value: string): boolean {
  return bearerTokenPattern.test(value);
}

export function isSiteToken(value: string): boolean {
  return bearerTokenPattern.test(value);
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
