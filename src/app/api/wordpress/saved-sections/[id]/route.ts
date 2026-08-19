import { withApiErrorHandling } from "@/lib/api/errors";
import { parseUuidParam } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { authenticateSite } from "@/lib/auth/site";
import { getSavedSection } from "@/lib/saved-sections/repository";

export const dynamic = "force-dynamic";

type SavedSectionRouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * One saved section owned by the authenticated site, including its shortcode
 * and CSS.
 *
 * A saved section that does not exist and one owned by another site produce the
 * same 404, so the response never reveals another site's records.
 */
export async function GET(
  request: Request,
  context: SavedSectionRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    const site = await authenticateSite(request);
    const { id: rawSavedSectionId } = await context.params;
    const section = await getSavedSection(
      parseUuidParam(rawSavedSectionId, "Saved section ID"),
      site.id,
    );

    return successResponse({ success: true, section });
  });
}
