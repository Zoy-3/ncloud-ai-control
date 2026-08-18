import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import {
  createDevJobBodySchema,
  requestBodyLimits,
} from "@/lib/api/schemas";
import { authenticateDevelopmentRequest } from "@/lib/auth/development";
import { createDevelopmentJob } from "@/lib/jobs/repository";

export async function POST(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    authenticateDevelopmentRequest(request);
    const body = await parseJsonBody(
      request,
      createDevJobBodySchema,
      requestBodyLimits.createJob,
    );

    const job = await createDevelopmentJob(body.prompt);
    return successResponse({ success: true, job }, 201);
  });
}
