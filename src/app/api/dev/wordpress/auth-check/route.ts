import { withApiErrorHandling } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/response";
import { assertDevelopmentEnvironment } from "@/lib/auth/development";
import { authenticateSite } from "@/lib/auth/site";

export const dynamic = "force-dynamic";

/**
 * Controlled proof that site bearer authentication works end to end. It is not
 * the future product status endpoint: it returns only the safe site identity
 * derived from the presented token.
 */
export async function GET(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    assertDevelopmentEnvironment();
    const site = await authenticateSite(request);

    return successResponse({
      success: true,
      authenticated: true,
      site: {
        id: site.id,
        name: site.name,
        domain: site.domain,
        status: site.status,
      },
    });
  });
}
