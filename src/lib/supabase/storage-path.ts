/** Storage bucket holding section preview images. */
export const SECTION_PREVIEW_BUCKET = "section-previews";

/** Largest preview image accepted, in bytes. */
export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;

/**
 * Image types accepted for a preview, mapped to the extension used on disk.
 *
 * SVG is deliberately absent: it is a script-carrying document, and the bucket
 * is public for read.
 */
export const PREVIEW_CONTENT_TYPES: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Control characters have no place in an object key that becomes a URL. */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;

    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }

  return false;
}

/**
 * Reduces a stored object path to one that is safe to turn into a URL.
 *
 * The column is already constrained in the database, but a path becomes part
 * of a URL, so it is checked again here rather than trusted. Anything absolute,
 * traversing, blank, or absent resolves to `null`, which callers render as "no
 * preview" instead of a broken or unexpected link.
 */
export function normalizeStoragePath(path: string | null): string | null {
  if (typeof path !== "string") {
    return null;
  }

  const trimmed = path.trim();

  if (trimmed === "") {
    return null;
  }

  // A leading slash or a scheme would escape the bucket, and `..` would climb
  // out of the site's own folder.
  if (
    trimmed.startsWith("/") ||
    trimmed.includes("..") ||
    trimmed.includes("://") ||
    hasControlCharacter(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

/**
 * Whether a declared image type may be stored as a preview.
 *
 * @param contentType MIME type reported by the upload.
 */
export function isSupportedPreviewType(contentType: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    PREVIEW_CONTENT_TYPES,
    contentType,
  );
}

/**
 * Builds the object path for a saved section's preview.
 *
 * Every component is server-generated. A caller never supplies any part of a
 * Storage path, so one site can neither name nor overwrite another's object.
 *
 * @param siteId         Owning site, from the authenticated token.
 * @param savedSectionId Owning saved section.
 * @param contentType    Validated image type.
 * @param unique         Server-generated unique component.
 */
export function buildSavedPreviewPath(
  siteId: string,
  savedSectionId: string,
  contentType: string,
  unique: string,
): string {
  const extension = PREVIEW_CONTENT_TYPES[contentType];

  return `saved/${siteId}/${savedSectionId}/${unique}.${extension}`;
}

/**
 * Builds the object path for a central template's preview.
 *
 * @param sectionId   Template the preview belongs to.
 * @param contentType Validated image type.
 * @param unique      Server-generated unique component.
 */
export function buildTemplatePreviewPath(
  sectionId: string,
  contentType: string,
  unique: string,
): string {
  const extension = PREVIEW_CONTENT_TYPES[contentType];

  return `templates/${sectionId}/${unique}.${extension}`;
}
