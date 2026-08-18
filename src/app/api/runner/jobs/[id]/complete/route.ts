import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody, parseUuid } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import {
  completeJobBodySchema,
  requestBodyLimits,
} from "@/lib/api/schemas";
import { authenticateRunner } from "@/lib/auth/runner";
import { completeRunnerJob } from "@/lib/jobs/repository";

type JobRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  context: JobRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    const runner = await authenticateRunner(request);
    const { id: rawJobId } = await context.params;
    const jobId = parseUuid(rawJobId);
    const body = await parseJsonBody(
      request,
      completeJobBodySchema,
      requestBodyLimits.complete,
    );

    await completeRunnerJob(runner.id, jobId, body.shortcode);
    return successResponse({ success: true });
  });
}
