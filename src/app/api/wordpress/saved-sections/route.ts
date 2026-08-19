import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import {
  createSavedSectionBodySchema,
  requestBodyLimits,
} from "@/lib/api/schemas";
import { authenticateSite } from "@/lib/auth/site";
import {
  createSavedSection,
  listSavedSections,
} from "@/lib/saved-sections/repository";

export const dynamic = "force-dynamic";

/**
 * The authenticated site's own saved sections, newest first.
 *
 * Metadata only: neither the stored shortcode nor the stored CSS is part of a
 * listing response, and the owning site id is never returned.
 */
export async function GET(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    const site = await authenticateSite(request);
    const sections = await listSavedSections(site.id);

    return successResponse({ success: true, sections });
  });
}

/**
 * Saves a section to the authenticated site's own library.
 *
 * Ownership is taken from the bearer token. The body cannot name a site, and a
 * body that tries to is rejected by the schema rather than ignored.
 */
export async function POST(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    const site = await authenticateSite(request);
    const body = await parseJsonBody(
      request,
      createSavedSectionBodySchema,
      requestBodyLimits.createSavedSection,
    );
    const section = await createSavedSection(site.id, body);

    return successResponse({ success: true, section }, 201);
  });
}
