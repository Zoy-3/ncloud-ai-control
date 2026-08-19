import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

// promisify picks the three-argument overload, which cannot carry the cost
// parameters, so the four-argument shape is named explicitly.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/** Minimum and maximum length a chosen password may have. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * scrypt parameters.
 *
 * N=16384, r=8, p=1 is the widely used interactive-login baseline: costly
 * enough to make offline guessing expensive, cheap enough to run inside a
 * serverless request. The values are stored alongside each hash so they can be
 * raised later without invalidating existing passwords.
 */
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

const PREFIX = "scrypt";
const VERSION = "v1";

/** Node's scrypt refuses to allocate beyond this without being told to. */
const MAX_MEMORY = 128 * COST * BLOCK_SIZE * 2;

/**
 * Whether a password is acceptable.
 *
 * Length is the only rule. Composition rules push people towards predictable
 * substitutions and are not required by this project.
 */
export function isAcceptablePassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH
  );
}

/**
 * Derives a storable hash.
 *
 * The result is `scrypt$v1$N,r,p$salt$key`, all base64url. Everything needed to
 * verify it later travels with it, so parameters can change without a
 * migration. The plaintext is never returned, stored, or logged.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: MAX_MEMORY,
  });

  return [
    PREFIX,
    VERSION,
    `${COST},${BLOCK_SIZE},${PARALLELISM}`,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

/**
 * Checks a password against a stored hash.
 *
 * The comparison is constant time. A malformed or unrecognised stored hash
 * fails rather than throwing, so a damaged row cannot be used to distinguish
 * itself from a wrong password.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (typeof password !== "string" || typeof stored !== "string") {
    return false;
  }

  const parts = stored.split("$");

  if (parts.length !== 5 || parts[0] !== PREFIX || parts[1] !== VERSION) {
    return false;
  }

  const [cost, blockSize, parallelism] = parts[2]
    .split(",")
    .map((value) => Number(value));

  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelism) ||
    cost <= 0 ||
    blockSize <= 0 ||
    parallelism <= 0
  ) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;

  try {
    salt = Buffer.from(parts[3], "base64url");
    expected = Buffer.from(parts[4], "base64url");
  } catch {
    return false;
  }

  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  let derived: Buffer;

  try {
    derived = await scryptAsync(password, salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelism,
      maxmem: 128 * cost * blockSize * 2,
    });
  } catch {
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
