import { ApiError } from "@/lib/api/errors";
import {
  isSupportedPreviewType,
  MAX_PREVIEW_BYTES,
} from "@/lib/supabase/storage-path";

/** A validated preview image, ready to be stored. */
export type PreviewImage = {
  body: ArrayBuffer;
  contentType: string;
  byteLength: number;
};

/** The subset of `File` this module needs, so tests need no DOM. */
export type UploadedFile = {
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

/**
 * Field name the upload must use. Anything else in the form is ignored: a
 * caller cannot supply a site id, a storage path, or a URL, because none of
 * those are ever read.
 */
export const PREVIEW_FIELD = "preview";

function isUploadedFile(value: unknown): value is UploadedFile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<UploadedFile>;

  return (
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

/**
 * Validates one uploaded preview image.
 *
 * Checks the declared type, the declared size, and then the real byte length
 * once the body has been read, so a understated `size` cannot slip a larger
 * file through.
 *
 * @param value The form field's value.
 */
export async function readPreviewUpload(
  value: unknown,
): Promise<PreviewImage> {
  if (!isUploadedFile(value)) {
    throw new ApiError(
      400,
      "bad_request",
      `A ${PREVIEW_FIELD} image file is required.`,
    );
  }

  if (!isSupportedPreviewType(value.type)) {
    throw new ApiError(
      415,
      "unsupported_media_type",
      "A preview must be a JPEG, PNG, or WebP image.",
    );
  }

  if (value.size > MAX_PREVIEW_BYTES) {
    throw new ApiError(413, "payload_too_large", "A preview must be 5 MB or smaller.");
  }

  const body = await value.arrayBuffer();

  // The declared size is a claim; this is the measurement.
  if (body.byteLength > MAX_PREVIEW_BYTES) {
    throw new ApiError(413, "payload_too_large", "A preview must be 5 MB or smaller.");
  }

  if (body.byteLength === 0) {
    throw new ApiError(400, "bad_request", "The preview image was empty.");
  }

  return {
    body,
    contentType: value.type,
    byteLength: body.byteLength,
  };
}
