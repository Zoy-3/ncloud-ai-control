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
 * no hostname is written into this repository. Only a path is read; nothing
 * here uploads, replaces, or deletes an object, and no credential is returned.
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
