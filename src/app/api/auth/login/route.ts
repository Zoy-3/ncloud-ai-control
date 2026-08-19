import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { adminSignInBodySchema, requestBodyLimits } from "@/lib/api/schemas";
import { startAdminSession } from "@/lib/auth/admin";
import { signInAdmin } from "@/lib/auth/sign-in";

export const dynamic = "force-dynamic";

/**
 * Signs an administrator in.
 *
 * Credentials travel in a POST body, never a URL or query string, and are held
 * only for the length of the request. What comes back is an HttpOnly cookie
 * carrying a signed user id and expiry — no password, no hash, and no secret.
 */
export async function POST(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    const body = await parseJsonBody(
      request,
      adminSignInBodySchema,
      requestBodyLimits.adminSignIn,
    );

    const user = await signInAdmin(body.username, body.password);

    await startAdminSession(user.id);

    return successResponse({
      success: true,
      signedIn: true,
      mustChangePassword: user.mustChangePassword,
    });
  });
}
