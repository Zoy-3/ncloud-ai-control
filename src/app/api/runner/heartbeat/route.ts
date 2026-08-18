import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import {
  heartbeatBodySchema,
  requestBodyLimits,
} from "@/lib/api/schemas";
import { authenticateRunner } from "@/lib/auth/runner";
import { recordRunnerHeartbeat } from "@/lib/jobs/repository";

export async function POST(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    const runner = await authenticateRunner(request);
    const body = await parseJsonBody(
      request,
      heartbeatBodySchema,
      requestBodyLimits.heartbeat,
    );

    await recordRunnerHeartbeat(runner, body.name);
    return successResponse({ success: true });
  });
}
