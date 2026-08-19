import { cookies } from "next/headers";

import { ApiError, withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { adminSignInBodySchema, requestBodyLimits } from "@/lib/api/schemas";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  adminCookieOptions,
  createAdminSessionValue,
  secretsMatch,
} from "@/lib/auth/admin-session";
import { readAdminSecret } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/**
 * Signs an NCloud administrator in.
 *
 * The secret travels in a POST body, never in a URL or a query string, and the
 * comparison is constant-time. What comes back is an HttpOnly cookie holding a
 * signed expiry, so the secret itself is never stored in the browser and never
 * reaches any script.
 */
export async function POST(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    const secret = readAdminSecret();
    const body = await parseJsonBody(
      request,
      adminSignInBodySchema,
      requestBodyLimits.adminSignIn,
    );

    // A missing secret and a wrong secret fail identically, so the response
    // cannot be used to discover whether the manager is configured.
    if (secret === null || !secretsMatch(body.secret, secret)) {
      throw new ApiError(401, "unauthorized", "Administrator sign-in failed.");
    }

    const expiresAt =
      Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS;
    const store = await cookies();

    store.set(
      ADMIN_SESSION_COOKIE,
      createAdminSessionValue(secret, expiresAt),
      adminCookieOptions(
        process.env.NODE_ENV === "production",
        ADMIN_SESSION_MAX_AGE_SECONDS,
      ),
    );

    return successResponse({ success: true, signedIn: true });
  });
}

/** Signs the administrator out by clearing the session cookie. */
export async function DELETE(): Promise<Response> {
  return withApiErrorHandling(async () => {
    const store = await cookies();

    store.set(
      ADMIN_SESSION_COOKIE,
      "",
      adminCookieOptions(process.env.NODE_ENV === "production", 0),
    );

    return successResponse({ success: true, signedIn: false });
  });
}
