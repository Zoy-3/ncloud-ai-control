import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody, parseUuid } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { failJobBodySchema, requestBodyLimits } from "@/lib/api/schemas";
import { authenticateRunner } from "@/lib/auth/runner";
import { failRunnerJob } from "@/lib/jobs/repository";

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
      failJobBodySchema,
      requestBodyLimits.fail,
    );

    await failRunnerJob(runner.id, jobId, body.error);
    return successResponse({ success: true });
  });
}
