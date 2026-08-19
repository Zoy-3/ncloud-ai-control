import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody, parseUuidParam } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { requestBodyLimits, siteStatusBodySchema } from "@/lib/api/schemas";
import { requireAdminSession } from "@/lib/auth/admin";
import { setAdminSiteStatus } from "@/lib/sites/admin-repository";

export const dynamic = "force-dynamic";

type SiteRouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Enables or disables a site.
 *
 * A disabled site keeps everything it owns and simply fails authentication on
 * every `/api/wordpress/*` request until it is enabled again.
 */
export async function PATCH(
  request: Request,
  context: SiteRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const { id } = await context.params;
    const body = await parseJsonBody(
      request,
      siteStatusBodySchema,
      requestBodyLimits.siteStatus,
    );
    const site = await setAdminSiteStatus(
      parseUuidParam(id, "Site ID"),
      body.status,
    );

    return successResponse({ success: true, site });
  });
}
