import type { SectionStatus, TableRow } from "@/lib/supabase/database.types";

type SectionRow = TableRow<"sections">;

/**
 * Columns a template card needs. `shortcode` and `css_code` are deliberately
 * absent: a listing describes templates, it never carries their payload.
 */
export const sectionMetadataColumns =
  "id, name, category, section_type, style, preview_screenshot_url, status";

export const sectionDetailColumns = `${sectionMetadataColumns}, shortcode, css_code`;

export type SectionMetadataRow = Pick<
  SectionRow,
  | "id"
  | "name"
  | "category"
  | "style"
  | "section_type"
  | "preview_screenshot_url"
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

export function mapSectionMetadata(row: SectionMetadataRow): SectionMetadataDto {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    sectionType: row.section_type,
    style: row.style,
    previewScreenshotUrl: row.preview_screenshot_url,
    status: row.status,
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

export function mapSectionDetail(row: SectionDetailRow): SectionDetailDto {
  return {
    ...mapSectionMetadata(row),
    shortcode: row.shortcode,
    cssCode: readCssCode(row.css_code),
  };
}
