import { withApiErrorHandling } from "@/lib/api/errors";
import { parseUuidParam } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin";
import { getAdminSavedSection } from "@/lib/saved-sections/admin-repository";

export const dynamic = "force-dynamic";

type SavedSectionRouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * One saved section with its shortcode and CSS, for inspection.
 *
 * The payload is returned as data. The dashboard shows it inside read-only
 * code areas as text: the shortcode is never rendered as markup and the CSS is
 * never applied to the dashboard.
 */
export async function GET(
  request: Request,
  context: SavedSectionRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const { id } = await context.params;
    const section = await getAdminSavedSection(
      parseUuidParam(id, "Saved section ID"),
    );

    return successResponse({ success: true, section });
  });
}
