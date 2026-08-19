import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeStoragePath,
  SECTION_PREVIEW_BUCKET,
} from "@/lib/supabase/storage-path";

/**
 * Turns a stored object path into its public preview URL.
 *
 * The URL is built by the Supabase client from the configured project URL, so
 * no hostname is written into this repository. Only a path is read; no
 * credential is returned.
 *
 * @param path Object path inside the preview bucket, or null.
 * @returns The public URL, or null when there is no usable path.
 */
export function resolveSectionPreviewUrl(path: string | null): string | null {
  const objectPath = normalizeStoragePath(path);

  if (objectPath === null) {
    return null;
  }

  const { data } = getSupabaseServerClient()
    .storage.from(SECTION_PREVIEW_BUCKET)
    .getPublicUrl(objectPath);

  return typeof data.publicUrl === "string" && data.publicUrl !== ""
    ? data.publicUrl
    : null;
}

/**
 * Stores one preview image.
 *
 * The bucket is public for read only. Every write goes through this function
 * using the server-side secret key, which never leaves the server.
 *
 * @param objectPath  Server-generated path. Never supplied by a caller.
 * @param body        Image bytes.
 * @param contentType Validated image type.
 * @returns Whether the object was written.
 */
export async function uploadSectionPreview(
  objectPath: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<boolean> {
  const safePath = normalizeStoragePath(objectPath);

  if (safePath === null) {
    return false;
  }

  const { error } = await getSupabaseServerClient()
    .storage.from(SECTION_PREVIEW_BUCKET)
    .upload(safePath, body, { contentType, upsert: true });

  return error === null;
}

/**
 * Removes one preview object.
 *
 * The path must already have been read from a row the caller owns; this
 * function does not and cannot check ownership. A failure is reported rather
 * than thrown, because an orphaned image is a smaller problem than a failed
 * delete of the record that referenced it.
 *
 * @param path Object path to remove, or null for nothing to do.
 * @returns Whether there is no longer an object at that path.
 */
export async function deleteSectionPreview(
  path: string | null,
): Promise<boolean> {
  const objectPath = normalizeStoragePath(path);

  if (objectPath === null) {
    return true;
  }

  const { error } = await getSupabaseServerClient()
    .storage.from(SECTION_PREVIEW_BUCKET)
    .remove([objectPath]);

  return error === null;
}
