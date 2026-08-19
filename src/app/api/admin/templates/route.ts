import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { createTemplateBodySchema, requestBodyLimits } from "@/lib/api/schemas";
import { requireAdminSession } from "@/lib/auth/admin";
import {
  createAdminTemplate,
  listAdminTemplates,
} from "@/lib/templates/admin-repository";

export const dynamic = "force-dynamic";

/** Every central template, in every status. Administrators only. */
export async function GET(): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const templates = await listAdminTemplates();

    return successResponse({ success: true, templates });
  });
}

/**
 * Creates a central template.
 *
 * New templates default to `draft`, so nothing reaches a WordPress site until
 * it is deliberately published.
 */
export async function POST(request: Request): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const body = await parseJsonBody(
      request,
      createTemplateBodySchema,
      requestBodyLimits.createTemplate,
    );
    const template = await createAdminTemplate(body);

    return successResponse({ success: true, template }, 201);
  });
}
