import { ApiError, withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { changePasswordBodySchema, requestBodyLimits } from "@/lib/api/schemas";
import { readCurrentAdmin, startAdminSession } from "@/lib/auth/admin";
import {
  findAdminUserForSignIn,
  setAdminPassword,
} from "@/lib/auth/admin-users";
import {
  isAcceptablePassword,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
} from "@/lib/auth/password";

export const dynamic = "force-dynamic";

/**
 * Sets a new password for the signed-in administrator.
 *
 * Reachable while `must_change_password` is set — that is the whole point of
 * the forced change — so it uses `readCurrentAdmin()` rather than the stricter
 * gate the rest of the admin API uses.
 *
 * A voluntary change from Settings must prove the current password. The forced
 * first change does not, because the session itself was just created by the
 * bootstrap credentials and there is no established password to prove.
 */
export async function POST(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    const user = await readCurrentAdmin();

    if (user === null) {
      throw new ApiError(
        401,
        "unauthorized",
        "Administrator sign-in required.",
      );
    }

    const body = await parseJsonBody(
      request,
      changePasswordBodySchema,
      requestBodyLimits.changePassword,
    );

    if (body.newPassword !== body.confirmPassword) {
      throw new ApiError(400, "validation_error", "Passwords do not match.");
    }

    if (!isAcceptablePassword(body.newPassword)) {
      throw new ApiError(
        400,
        "validation_error",
        `Password must contain at least ${PASSWORD_MIN_LENGTH} characters.`,
      );
    }

    if (!user.mustChangePassword) {
      const found = await findAdminUserForSignIn(user.username);
      const correct =
        typeof body.currentPassword === "string" &&
        found !== null &&
        (await verifyPassword(body.currentPassword, found.passwordHash));

      if (!correct) {
        throw new ApiError(
          401,
          "unauthorized",
          "The current password is incorrect.",
        );
      }
    }

    const updated = await setAdminPassword(user.id, body.newPassword);

    // A fresh cookie is issued so the session that existed under the old
    // password does not outlive it.
    await startAdminSession(updated.id);

    return successResponse({ success: true, mustChangePassword: false });
  });
}
