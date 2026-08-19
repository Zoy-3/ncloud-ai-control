/** Storage bucket holding saved-section preview images. */
export const SECTION_PREVIEW_BUCKET = "section-previews";

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
