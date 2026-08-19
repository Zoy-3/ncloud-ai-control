import { ApiError } from "@/lib/api/errors";
import type { CreateSavedSectionBody } from "@/lib/api/schemas";
import type { Database, TableRow } from "@/lib/supabase/database.types";

type SavedSectionRow = TableRow<"saved_sections">;

export type SavedSectionInsert =
  Database["public"]["Tables"]["saved_sections"]["Insert"];

/**
 * Columns a My Saved card needs. `shortcode` and `css_code` are deliberately
 * absent: a listing describes saved sections, it never carries their payload.
 */
export const savedSectionListColumns =
  "id, name, preview_storage_path, created_at, updated_at";

/**
 * Columns for one saved section.
 *
 * `site_id` is read on purpose. It never reaches a response, but having it lets
 * ownership be re-checked on the row that actually came back rather than
 * trusting the query alone.
 */
export const savedSectionDetailColumns = `${savedSectionListColumns}, site_id, shortcode, css_code`;

export type SavedSectionListRow = Pick<
  SavedSectionRow,
  "id" | "name" | "preview_storage_path" | "created_at" | "updated_at"
>;

export type SavedSectionDetailRow = SavedSectionListRow &
  Pick<SavedSectionRow, "site_id" | "shortcode" | "css_code">;

export type SavedSectionListDto = {
  id: string;
  name: string;
  previewScreenshotUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedSectionDetailDto = SavedSectionListDto & {
  shortcode: string;
  cssCode: string | null;
};

/** Builds the public URL for a stored preview path, or null when there is none. */
export type PreviewUrlResolver = (path: string | null) => string | null;

/**
 * Reduces stored CSS to "present" or "absent".
 *
 * A column that has never been written reads as null, but a blank string means
 * the same thing to a caller. Both map to null so the plugin only has to check
 * one condition. Present CSS is returned byte for byte, since its own
 * whitespace is part of the stylesheet.
 */
export function readCssCode(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value;
}

export function mapSavedSectionListItem(
  row: SavedSectionListRow,
  resolvePreviewUrl: PreviewUrlResolver,
): SavedSectionListDto {
  return {
    id: row.id,
    name: row.name,
    previewScreenshotUrl: resolvePreviewUrl(row.preview_storage_path),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps one saved section for the detail response.
 *
 * The DTO is built key by key, so `site_id` cannot leak into a response even
 * though the row carries it.
 */
export function mapSavedSectionDetail(
  row: SavedSectionDetailRow,
  resolvePreviewUrl: PreviewUrlResolver,
): SavedSectionDetailDto {
  return {
    ...mapSavedSectionListItem(row, resolvePreviewUrl),
    shortcode: row.shortcode,
    cssCode: readCssCode(row.css_code),
  };
}

/**
 * One identical failure for a saved section that does not exist and one that
 * belongs to another site. A caller must not be able to learn which it hit.
 */
export function savedSectionNotFound(): ApiError {
  return new ApiError(404, "not_found", "Saved section was not found.");
}

/**
 * Confirms the row that came back really belongs to the requesting site.
 *
 * The query is already scoped by `site_id`; this re-checks the returned row so
 * a future change to the query cannot silently turn into a cross-tenant read.
 */
export function assertSavedSectionVisible(
  row: SavedSectionDetailRow | null,
  siteId: string,
): SavedSectionDetailRow {
  if (row === null || row.site_id !== siteId) {
    throw savedSectionNotFound();
  }

  return row;
}

/**
 * Builds the row to insert.
 *
 * `site_id` is taken from the authenticated site and from nowhere else, so a
 * request body can never choose an owner. `preview_storage_path` is always null
 * in this phase: uploads arrive later, and a caller may not name an object path.
 *
 * The shortcode and CSS are copied through untouched. They are validated for
 * type, emptiness, and length only; altering them would corrupt valid Flatsome
 * markup or a valid stylesheet.
 */
export function buildSavedSectionInsert(
  siteId: string,
  body: CreateSavedSectionBody,
): SavedSectionInsert {
  return {
    site_id: siteId,
    name: body.name,
    shortcode: body.shortcode,
    css_code: readCssCode(body.cssCode),
    preview_storage_path: null,
  };
}
