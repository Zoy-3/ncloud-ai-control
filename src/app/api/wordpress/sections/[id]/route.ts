import { withApiErrorHandling } from "@/lib/api/errors";
import { parseUuidParam } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { authenticateSite } from "@/lib/auth/site";
import { getWordPressSection } from "@/lib/sections/repository";

export const dynamic = "force-dynamic";

type SectionRouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * One template, including the stored Flatsome shortcode the plugin inserts
 * into the UX Block Code editor.
 */
export async function GET(
  request: Request,
  context: SectionRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    const site = await authenticateSite(request);
    const { id: rawSectionId } = await context.params;
    const section = await getWordPressSection(
      parseUuidParam(rawSectionId, "Section ID"),
      site.id,
    );

    return successResponse({ success: true, section });
  });
}
