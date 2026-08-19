import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { createSiteBodySchema, requestBodyLimits } from "@/lib/api/schemas";
import { requireAdminSession } from "@/lib/auth/admin";
import { createAdminSite, listAdminSites } from "@/lib/sites/admin-repository";

export const dynamic = "force-dynamic";

/** Connected sites. Never includes a token or a token hash. */
export async function GET(): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const sites = await listAdminSites();

    return successResponse({ success: true, sites });
  });
}

/**
 * Registers a site.
 *
 * The new site has no usable token until one is generated for it, so creating a
 * site never implicitly grants access.
 */
export async function POST(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const body = await parseJsonBody(
      request,
      createSiteBodySchema,
      requestBodyLimits.createSite,
    );
    const site = await createAdminSite(body);

    return successResponse({ success: true, site }, 201);
  });
}
