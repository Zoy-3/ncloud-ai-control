import { withApiErrorHandling } from "@/lib/api/errors";
import { parseUuidParam } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { authenticateSite } from "@/lib/auth/site";
import {
  hideSectionForSite,
  unhideSectionForSite,
} from "@/lib/sections/repository";

export const dynamic = "force-dynamic";

type SectionRouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Hides one central template for the authenticated site only.
 *
 * A site may never delete a central template. Hiding records a preference
 * against the site resolved from the bearer token; the `sections` row is
 * untouched and every other site is unaffected.
 */
export async function POST(
  request: Request,
  context: SectionRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    const site = await authenticateSite(request);
    const { id: rawSectionId } = await context.params;

    await hideSectionForSite(
      parseUuidParam(rawSectionId, "Section ID"),
      site.id,
    );

    return successResponse({ success: true, hidden: true });
  });
}

/** Restores one central template to the authenticated site's library. */
export async function DELETE(
  request: Request,
  context: SectionRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    const site = await authenticateSite(request);
    const { id: rawSectionId } = await context.params;

    await unhideSectionForSite(
      parseUuidParam(rawSectionId, "Section ID"),
      site.id,
    );

    return successResponse({ success: true, hidden: false });
  });
}
