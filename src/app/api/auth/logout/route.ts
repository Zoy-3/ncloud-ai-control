import { withApiErrorHandling } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/response";
import { endAdminSession } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/**
 * Signs the administrator out.
 *
 * Clearing the cookie is unconditional: a request with no session, or an
 * already-expired one, still ends signed out rather than erroring.
 */
export async function DELETE(): Promise<Response> {
  return withApiErrorHandling(async () => {
    await endAdminSession();

    return successResponse({ success: true, signedIn: false });
  });
}
