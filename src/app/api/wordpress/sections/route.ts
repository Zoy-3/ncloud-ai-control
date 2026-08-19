import { withApiErrorHandling } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/response";
import { authenticateSite } from "@/lib/auth/site";
import { listWordPressSections } from "@/lib/sections/repository";

export const dynamic = "force-dynamic";

/**
 * Template library listing for an authenticated WordPress site.
 *
 * Templates the site has hidden are excluded by default. `?includeHidden=1`
 * returns them as well, each carrying `hidden`, so the plugin can offer to
 * restore one. Hiding is a per-site preference and never affects another site.
 */
export async function GET(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    const site = await authenticateSite(request);
    const includeHidden =
      new URL(request.url).searchParams.get("includeHidden") === "1";
    const sections = await listWordPressSections(site.id, includeHidden);

    return successResponse({ success: true, sections });
  });
}
