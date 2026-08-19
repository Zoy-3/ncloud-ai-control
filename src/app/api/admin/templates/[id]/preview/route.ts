import { ApiError, withApiErrorHandling } from "@/lib/api/errors";
import { parseUuidParam } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin";
import { PREVIEW_FIELD, readPreviewUpload } from "@/lib/previews/upload";
import { setAdminTemplatePreview } from "@/lib/templates/admin-repository";

export const dynamic = "force-dynamic";

type TemplateRouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Attaches or replaces a central template's preview image.
 *
 * Only the image is read. The Storage path is generated on the server, so no
 * caller can name an object.
 */
export async function POST(
  request: Request,
  context: TemplateRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const { id } = await context.params;
    const sectionId = parseUuidParam(id, "Template ID");

    let form: FormData;

    try {
      form = await request.formData();
    } catch {
      throw new ApiError(
        400,
        "bad_request",
        "The preview upload could not be read.",
      );
    }

    const image = await readPreviewUpload(form.get(PREVIEW_FIELD));
    const template = await setAdminTemplatePreview(sectionId, image);

    return successResponse({ success: true, template });
  });
}
