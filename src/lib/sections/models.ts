import type { SectionStatus, TableRow } from "@/lib/supabase/database.types";

type SectionRow = TableRow<"sections">;

/** Columns a template card needs. `shortcode` is deliberately absent. */
export const sectionMetadataColumns =
  "id, name, category, section_type, style, preview_screenshot_url, status";

export const sectionDetailColumns = `${sectionMetadataColumns}, shortcode`;

export type SectionMetadataRow = Pick<
  SectionRow,
  | "id"
  | "name"
  | "category"
  | "section_type"
  | "style"
  | "preview_screenshot_url"
  | "status"
>;

export type SectionDetailRow = SectionMetadataRow & Pick<SectionRow, "shortcode">;

export type SectionMetadataDto = {
  id: string;
  name: string;
  category: string;
  sectionType: string;
  style: string | null;
  previewScreenshotUrl: string | null;
  status: SectionStatus;
};

export type SectionDetailDto = SectionMetadataDto & {
  shortcode: string;
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

export function mapSectionDetail(row: SectionDetailRow): SectionDetailDto {
  return { ...mapSectionMetadata(row), shortcode: row.shortcode };
}
