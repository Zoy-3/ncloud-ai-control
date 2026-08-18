import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import {
  provisionSiteTokenBodySchema,
  requestBodyLimits,
} from "@/lib/api/schemas";
import { authenticateDevelopmentRequest } from "@/lib/auth/development";
import { provisionSiteToken } from "@/lib/sites/repository";

export const dynamic = "force-dynamic";

/**
 * Development-only site-token provisioning. The response is the only place the
 * raw token ever exists after generation: it is not stored, logged, or written
 * to any file by this route.
 */
export async function POST(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    authenticateDevelopmentRequest(request);
    const body = await parseJsonBody(
      request,
      provisionSiteTokenBodySchema,
      requestBodyLimits.provisionSiteToken,
    );

    const provisioned = await provisionSiteToken(body);
    return successResponse(
      {
        success: true,
        site: provisioned.site,
        siteToken: provisioned.siteToken,
      },
      201,
    );
  });
}
