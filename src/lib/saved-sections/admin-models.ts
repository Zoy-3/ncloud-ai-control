import type { PreviewUrlResolver } from "@/lib/sections/models";

/**
 * Columns the central inspection list needs.
 *
 * `shortcode` is deliberately absent and `css_code` is never selected as a
 * value: the list only needs to know whether CSS exists, which is asked for as
 * a computed flag instead of by fetching the stylesheet for every row.
 */
export const adminSavedSectionListColumns =
  "id, site_id, name, preview_storage_path, created_at, updated_at, css_code";

export const adminSavedSectionDetailColumns = `${adminSavedSectionListColumns}, shortcode`;

/** The joined site, as PostgREST returns an embedded relation. */
export type OwningSiteRow = {
  id: string;
  name: string;
  domain: string;
} | null;

export type AdminSavedSectionListRow = {
  id: string;
  site_id: string;
  name: string;
  preview_storage_path: string | null;
  created_at: string;
  updated_at: string;
  css_code: string | null;
};

export type AdminSavedSectionDetailRow = AdminSavedSectionListRow & {
  shortcode: string;
};

export type AdminSavedSectionListDto = {
  id: string;
  name: string;
  site: { id: string; name: string; domain: string } | null;
  previewScreenshotUrl: string | null;
  hasCss: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminSavedSectionDetailDto = AdminSavedSectionListDto & {
  shortcode: string;
  cssCode: string | null;
};

/** Blank means absent, so a caller only ever has to check for null. */
function optionalText(value: string | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value;
}

/**
 * Describes the owning site.
 *
 * Only the name, domain, and id are published. No token, no token hash, and no
 * other column of `sites` is ever read into this shape.
 */
export function readOwningSite(site: OwningSiteRow) {
  if (site === null) {
    return null;
  }

  return { id: site.id, name: site.name, domain: site.domain };
}

export function mapAdminSavedSectionListItem(
  row: AdminSavedSectionListRow,
  site: OwningSiteRow,
  resolvePreviewUrl: PreviewUrlResolver,
): AdminSavedSectionListDto {
  return {
    id: row.id,
    name: row.name,
    site: readOwningSite(site),
    previewScreenshotUrl: resolvePreviewUrl(row.preview_storage_path),
    // Whether CSS exists, not the CSS itself.
    hasCss: optionalText(row.css_code) !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps one saved section for inspection.
 *
 * The shortcode and CSS are returned byte for byte. They are inspection data
 * only: the dashboard renders them inside read-only code areas as text, never
 * as markup, and never applies the CSS to itself.
 */
export function mapAdminSavedSectionDetail(
  row: AdminSavedSectionDetailRow,
  site: OwningSiteRow,
  resolvePreviewUrl: PreviewUrlResolver,
): AdminSavedSectionDetailDto {
  return {
    ...mapAdminSavedSectionListItem(row, site, resolvePreviewUrl),
    shortcode: row.shortcode,
    cssCode: optionalText(row.css_code),
  };
}
