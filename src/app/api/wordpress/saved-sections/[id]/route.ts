import { withApiErrorHandling } from "@/lib/api/errors";
import { parseUuidParam } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { authenticateSite } from "@/lib/auth/site";
import {
  deleteSavedSection,
  getSavedSection,
} from "@/lib/saved-sections/repository";

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

/**
 * Removes one saved section owned by the authenticated site.
 *
 * The delete is filtered by `site_id`, so another site's row is never removed,
 * and a row that does not exist produces the same 404 as one owned by someone
 * else. Any preview object is removed afterwards using the path read from the
 * row that was actually deleted, never a path supplied by the caller.
 */
export async function DELETE(
  request: Request,
  context: SavedSectionRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    const site = await authenticateSite(request);
    const { id: rawSavedSectionId } = await context.params;

    await deleteSavedSection(
      parseUuidParam(rawSavedSectionId, "Saved section ID"),
      site.id,
    );

    return successResponse({ success: true, deleted: true });
  });
}
