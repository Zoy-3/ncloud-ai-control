import type {
  CreateTemplateBody,
  UpdateTemplateBody,
} from "@/lib/api/schemas";
import type {
  PreviewUrlResolver,
  SectionMetadataRow,
} from "@/lib/sections/models";
import { readSectionPreviewUrl } from "@/lib/sections/models";
import type { Database, SectionStatus } from "@/lib/supabase/database.types";

type SectionInsert = Database["public"]["Tables"]["sections"]["Insert"];
type SectionUpdate = Database["public"]["Tables"]["sections"]["Update"];

/** Columns the manager lists. The payload columns are fetched only when editing one. */
export const adminTemplateListColumns =
  "id, name, category, section_type, style, preview_screenshot_url, preview_storage_path, status, created_at, updated_at";

export const adminTemplateDetailColumns = `${adminTemplateListColumns}, shortcode, css_code`;

export type AdminTemplateListRow = SectionMetadataRow & {
  created_at: string;
  updated_at: string;
};

export type AdminTemplateDetailRow = AdminTemplateListRow & {
  shortcode: string;
  css_code: string | null;
};

export type AdminTemplateListDto = {
  id: string;
  name: string;
  category: string;
  sectionType: string;
  style: string | null;
  status: SectionStatus;
  previewScreenshotUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminTemplateDetailDto = AdminTemplateListDto & {
  shortcode: string;
  cssCode: string | null;
};

/** Blank means absent, so a caller only ever has to check for null. */
function optionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value;
}

export function mapAdminTemplateListItem(
  row: AdminTemplateListRow,
  resolvePreviewUrl: PreviewUrlResolver,
): AdminTemplateListDto {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    sectionType: row.section_type,
    style: row.style,
    status: row.status,
    previewScreenshotUrl: readSectionPreviewUrl(row, resolvePreviewUrl),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAdminTemplateDetail(
  row: AdminTemplateDetailRow,
  resolvePreviewUrl: PreviewUrlResolver,
): AdminTemplateDetailDto {
  return {
    ...mapAdminTemplateListItem(row, resolvePreviewUrl),
    shortcode: row.shortcode,
    cssCode: optionalText(row.css_code),
  };
}

/**
 * Builds the row for a new template.
 *
 * A new template is a draft unless the creator says otherwise, so nothing
 * reaches WordPress sites until it is deliberately published. The shortcode and
 * CSS are copied through untouched.
 */
export function buildTemplateInsert(body: CreateTemplateBody): SectionInsert {
  return {
    name: body.name,
    category: body.category,
    section_type: body.sectionType,
    style: optionalText(body.style),
    shortcode: body.shortcode,
    css_code: optionalText(body.cssCode),
    status: body.status ?? "draft",
  };
}

/**
 * Builds the patch for an edit.
 *
 * Only the fields actually supplied are included, so editing one field can
 * never blank another. Shortcode and CSS are written byte for byte.
 */
export function buildTemplateUpdate(body: UpdateTemplateBody): SectionUpdate {
  const patch: SectionUpdate = {};

  if (body.name !== undefined) {
    patch.name = body.name;
  }

  if (body.category !== undefined) {
    patch.category = body.category;
  }

  if (body.sectionType !== undefined) {
    patch.section_type = body.sectionType;
  }

  if (body.style !== undefined) {
    patch.style = optionalText(body.style);
  }

  if (body.shortcode !== undefined) {
    patch.shortcode = body.shortcode;
  }

  if (body.cssCode !== undefined) {
    patch.css_code = optionalText(body.cssCode);
  }

  if (body.status !== undefined) {
    patch.status = body.status;
  }

  return patch;
}
