import { createHmac } from "node:crypto";

/**
 * Throttling policy for administrator sign-in.
 *
 * Five failures inside fifteen minutes blocks that identity for fifteen
 * minutes. A successful sign-in clears the state.
 */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const LOGIN_BLOCK_SECONDS = 15 * 60;

/**
 * Derives the stored identity.
 *
 * The identity is the **normalized username**, keyed-hashed with the server
 * secret so the table holds no plaintext username, no address, and nothing
 * reversible or precomputable.
 *
 * A client address is deliberately not used. On a serverless platform the only
 * source is a forwarded header, and an attacker can vary that freely, so
 * throttling by it would look like protection while providing none against the
 * attack that matters — guessing one account's password. Throttling by account
 * cannot be evaded that way.
 *
 * The trade-off is accepted knowingly: someone who knows the username can hold
 * it blocked in fifteen-minute stretches. For a single-administrator system a
 * short, self-expiring lockout is preferable to an unthrottled password oracle.
 */
export function loginIdentityHash(username: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`admin-login:${username.trim().toLowerCase()}`)
    .digest("hex");
}
