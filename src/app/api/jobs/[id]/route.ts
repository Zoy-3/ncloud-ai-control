import { withApiErrorHandling } from "@/lib/api/errors";
import { parseUuid } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { authenticateDevelopmentRequest } from "@/lib/auth/development";
import { getJobStatus } from "@/lib/jobs/repository";

export const dynamic = "force-dynamic";

type JobRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  context: JobRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    authenticateDevelopmentRequest(request);
    const { id: rawJobId } = await context.params;
    const job = await getJobStatus(parseUuid(rawJobId));

    return successResponse({ success: true, job });
  });
}
