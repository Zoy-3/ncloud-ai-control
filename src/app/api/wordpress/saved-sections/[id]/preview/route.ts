import { ApiError, withApiErrorHandling } from "@/lib/api/errors";
import { parseUuidParam } from "@/lib/api/request";
import { successResponse } from "@/lib/api/response";
import { authenticateSite } from "@/lib/auth/site";
import { PREVIEW_FIELD, readPreviewUpload } from "@/lib/previews/upload";
import { setSavedSectionPreview } from "@/lib/saved-sections/repository";

export const dynamic = "force-dynamic";

type SavedSectionRouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Attaches or replaces the preview image of one owned saved section.
 *
 * Only the image is read from the request. A site id, a storage path, and a
 * preview URL are all ignored if present: ownership comes from the bearer
 * token and the object path is generated on the server, so one site can never
 * name or overwrite another's object.
 */
export async function POST(
  request: Request,
  context: SavedSectionRouteContext,
): Promise<Response> {
  return withApiErrorHandling(async () => {
    const site = await authenticateSite(request);
    const { id: rawSavedSectionId } = await context.params;
    const savedSectionId = parseUuidParam(rawSavedSectionId, "Saved section ID");

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
    const section = await setSavedSectionPreview(savedSectionId, site.id, image);

    return successResponse({ success: true, section });
  });
}
