import { withApiErrorHandling } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/response";
import { authenticateSite } from "@/lib/auth/site";
import { readRunnerAvailability } from "@/lib/runners/repository";
import { buildWordPressStatus } from "@/lib/wordpress/status";

export const dynamic = "force-dynamic";

/**
 * Connection check for the WordPress plugin. Available in every environment,
 * unlike the development-only auth-check route, and safe to call from a hosted
 * deployment.
 */
export async function GET(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    const site = await authenticateSite(request);
    const runner = await readRunnerAvailability();

    return successResponse({
      success: true,
      ...buildWordPressStatus(site, runner),
    });
  });
}
