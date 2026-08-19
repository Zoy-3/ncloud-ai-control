import { withApiErrorHandling } from "@/lib/api/errors";
import { parseJsonBody, parseUuidParam } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { requestBodyLimits, updateTemplateBodySchema } from "@/lib/api/schemas";
import { requireAdminSession } from "@/lib/auth/admin";
import {
  getAdminTemplate,
  updateAdminTemplate,
} from "@/lib/templates/admin-repository";

export const dynamic = "force-dynamic";

type TemplateRouteContext = {
  params: Promise<{ id: string }>;
};

/** One template with its shortcode and CSS, for editing. */
export async function GET(
  request: Request,
  context: TemplateRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const { id } = await context.params;
    const template = await getAdminTemplate(
      parseUuidParam(id, "Template ID"),
    );

    return successResponse({ success: true, template });
  });
}

/**
 * Edits one template.
 *
 * Only the supplied fields are written. Publishing, unpublishing, and archiving
 * are all the same operation on `status`.
 */
export async function PATCH(
  request: Request,
  context: TemplateRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const { id } = await context.params;
    const body = await parseJsonBody(
      request,
      updateTemplateBodySchema,
      requestBodyLimits.updateTemplate,
    );
    const template = await updateAdminTemplate(
      parseUuidParam(id, "Template ID"),
      body,
    );

    return successResponse({ success: true, template });
  });
}
