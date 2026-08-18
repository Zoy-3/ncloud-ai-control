import { withApiErrorHandling } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/response";
import { authenticateSite } from "@/lib/auth/site";
import { listWordPressSections } from "@/lib/sections/repository";

export const dynamic = "force-dynamic";

/**
 * Template library listing for an authenticated WordPress site. Every current
 * section is a shared global template; site-specific saved sections are a
 * later phase.
 */
export async function GET(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    await authenticateSite(request);
    const sections = await listWordPressSections();

    return successResponse({ success: true, sections });
  });
}
