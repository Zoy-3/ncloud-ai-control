import type { SectionStatus, TableRow } from "@/lib/supabase/database.types";

type SectionRow = TableRow<"sections">;

/**
 * Columns a template card needs. `shortcode` and `css_code` are deliberately
 * absent: a listing describes templates, it never carries their payload.
 */
export const sectionMetadataColumns =
  "id, name, category, section_type, style, preview_screenshot_url, preview_storage_path, status";

export const sectionDetailColumns = `${sectionMetadataColumns}, shortcode, css_code`;

export type SectionMetadataRow = Pick<
  SectionRow,
  | "id"
  | "name"
  | "category"
  | "style"
  | "section_type"
  | "preview_screenshot_url"
  | "preview_storage_path"
  | "status"
>;

export type SectionDetailRow = SectionMetadataRow &
  Pick<SectionRow, "shortcode" | "css_code">;

export type SectionMetadataDto = {
  id: string;
  name: string;
  category: string;
  sectionType: string;
  style: string | null;
  previewScreenshotUrl: string | null;
  status: SectionStatus;
  /** Whether the requesting site has hidden this template from its own library. */
  hidden: boolean;
};

/**
 * One template's payload.
 *
 * `shortcode` and `cssCode` stay separate fields. The plugin inserts the
 * shortcode into the UX Block Code editor and offers the CSS as its own copy
 * action, so the two must never be merged into one string.
 */
export type SectionDetailDto = SectionMetadataDto & {
  shortcode: string;
  cssCode: string | null;
};

/**
 * Statuses a WordPress site may see.
 *
 * Development also exposes drafts so the existing unscreenshotted development
 * records are usable. Every other environment, including any future hosted
 * deployment, exposes published templates only. `archived` is never visible.
 */
export function visibleSectionStatuses(
  nodeEnvironment: string | undefined = process.env.NODE_ENV,
): readonly SectionStatus[] {
  return nodeEnvironment === "development"
    ? ["draft", "published"]
    : ["published"];
}

/** Builds the public URL for a stored preview path, or null when there is none. */
export type PreviewUrlResolver = (path: string | null) => string | null;

/**
 * Resolves a template's preview.
 *
 * A Storage object is preferred when one has been uploaded. Records created
 * before Storage-backed previews existed carry a full URL in
 * `preview_screenshot_url`, and that remains the fallback, so older templates
 * keep working untouched.
 */
export function readSectionPreviewUrl(
  row: Pick<
    SectionMetadataRow,
    "preview_storage_path" | "preview_screenshot_url"
  >,
  resolvePreviewUrl: PreviewUrlResolver,
): string | null {
  return (
    resolvePreviewUrl(row.preview_storage_path) ?? row.preview_screenshot_url
  );
}

export function mapSectionMetadata(
  row: SectionMetadataRow,
  resolvePreviewUrl: PreviewUrlResolver,
  hidden: boolean,
): SectionMetadataDto {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    sectionType: row.section_type,
    style: row.style,
    previewScreenshotUrl: readSectionPreviewUrl(row, resolvePreviewUrl),
    status: row.status,
    hidden,
  };
}

/**
 * Reduces stored CSS to "present" or "absent".
 *
 * A column that has never been written reads as null, but a blank string means
 * the same thing to a caller. Both map to null so the plugin only has to check
 * one condition. Present CSS is returned byte for byte, since its own
 * whitespace is part of the stylesheet.
 */
function readCssCode(value: string | null): string | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  return value;
}

export function mapSectionDetail(
  row: SectionDetailRow,
  resolvePreviewUrl: PreviewUrlResolver,
  hidden: boolean,
): SectionDetailDto {
  return {
    ...mapSectionMetadata(row, resolvePreviewUrl, hidden),
    shortcode: row.shortcode,
    cssCode: readCssCode(row.css_code),
  };
}

/**
 * Splits a listing into what the site should see.
 *
 * Hiding is a per-site preference, so it is applied here rather than in the
 * query: the same rows come back for every site and each site's own preference
 * decides what it sees. `includeHidden` lets the plugin show hidden templates
 * so one can be restored.
 */
export function applyHiddenSections(
  rows: readonly SectionMetadataRow[],
  hiddenIds: ReadonlySet<string>,
  includeHidden: boolean,
  resolvePreviewUrl: PreviewUrlResolver,
): SectionMetadataDto[] {
  const visible = includeHidden
    ? rows
    : rows.filter((row) => !hiddenIds.has(row.id));

  return visible.map((row) =>
    mapSectionMetadata(row, resolvePreviewUrl, hiddenIds.has(row.id)),
  );
}
