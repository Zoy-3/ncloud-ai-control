import { withApiErrorHandling } from "@/lib/api/errors";
import { parseUuidParam } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin";
import { issueAdminSiteToken } from "@/lib/sites/admin-repository";

export const dynamic = "force-dynamic";

type SiteRouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Issues a site token, replacing any previous one.
 *
 * This is both "generate" and "rotate": only one hash is stored, so writing a
 * new one immediately invalidates whatever came before. The raw token is in
 * this response and nowhere else — it is never stored, logged, or retrievable
 * again.
 */
export async function POST(
  request: Request,
  context: SiteRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const { id } = await context.params;
    const { site, siteToken } = await issueAdminSiteToken(
      parseUuidParam(id, "Site ID"),
    );

    return successResponse({ success: true, site, siteToken });
  });
}
