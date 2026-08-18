import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { claimBodySchema, requestBodyLimits } from "@/lib/api/schemas";
import { authenticateRunner } from "@/lib/auth/runner";
import { claimNextJob } from "@/lib/jobs/repository";

export async function POST(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    const runner = await authenticateRunner(request);
    await parseJsonBody(request, claimBodySchema, requestBodyLimits.claim);

    const job = await claimNextJob(runner.id);
    return successResponse({ success: true, job });
  });
}
