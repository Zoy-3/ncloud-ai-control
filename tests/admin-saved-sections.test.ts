import assert from "node:assert/strict";
import test from "node:test";

import {
  adminSavedSectionDetailColumns,
  adminSavedSectionListColumns,
  mapAdminSavedSectionDetail,
  mapAdminSavedSectionListItem,
  readOwningSite,
  type AdminSavedSectionDetailRow,
} from "../src/lib/saved-sections/admin-models";
import { normalizeStoragePath } from "../src/lib/supabase/storage-path";

const siteA = "5988ae3e-7177-46aa-8198-c15f87e19d28";
const savedId = "7c3a1d90-2f4b-4a61-9b8e-2c5d7e1a4f60";

const shortcode = '[section][row][col span="12"][ux_text]<b>Hi</b>[/ux_text][/col][/row][/section]';
const css = "  .a{color:red}\n\n  .b{color:blue}\n";

function fakePreviewUrl(path: string | null): string | null {
  const objectPath = normalizeStoragePath(path);

  return objectPath === null
    ? null
    : `https://project.supabase.co/storage/v1/object/public/section-previews/${objectPath}`;
}

function detailRow(
  overrides: Partial<AdminSavedSectionDetailRow> = {},
): AdminSavedSectionDetailRow {
  return {
    id: savedId,
    site_id: siteA,
    name: "Hero with CTA",
    preview_storage_path: null,
    created_at: "2026-08-19T10:00:00.000Z",
    updated_at: "2026-08-19T11:00:00.000Z",
    css_code: null,
    shortcode,
    ...overrides,
  };
}

const owner = { id: siteA, name: "NCloud Development Site", domain: "ncloud-development.local" };

test("the owning site is reduced to name, domain, and id", () => {
  assert.deepEqual(readOwningSite(owner), owner);
  assert.equal(readOwningSite(null), null);

  // The query never asks for anything else, so no token material exists to leak.
  assert.equal(adminSavedSectionListColumns.includes("site_token_hash"), false);
  assert.equal(adminSavedSectionDetailColumns.includes("site_token_hash"), false);
});

test("the admin listing reports whether CSS exists, not the CSS itself", () => {
  const withCss = mapAdminSavedSectionListItem(
    detailRow({ css_code: css }),
    owner,
    fakePreviewUrl,
  );
  const withoutCss = mapAdminSavedSectionListItem(
    detailRow({ css_code: null }),
    owner,
    fakePreviewUrl,
  );

  assert.equal(withCss.hasCss, true);
  assert.equal(withoutCss.hasCss, false);

  // A blank stylesheet counts as absent.
  assert.equal(
    mapAdminSavedSectionListItem(detailRow({ css_code: "   " }), owner, fakePreviewUrl)
      .hasCss,
    false,
  );

  // Neither payload appears in a listing.
  const serialized = JSON.stringify(withCss);
  assert.equal(serialized.includes("[section]"), false);
  assert.equal(serialized.includes("color:red"), false);
  assert.equal(Object.hasOwn(withCss, "shortcode"), false);
  assert.equal(Object.hasOwn(withCss, "cssCode"), false);
  assert.equal(Object.hasOwn(withCss, "site_id"), false);
});

test("the admin detail returns the payload byte for byte", () => {
  const detail = mapAdminSavedSectionDetail(
    detailRow({ css_code: css }),
    owner,
    fakePreviewUrl,
  );

  assert.equal(detail.shortcode, shortcode);
  assert.equal(detail.cssCode, css);
  // Inspection must not alter what is stored: the markup inside the shortcode
  // survives intact, unescaped and unstripped.
  assert.equal(detail.shortcode.includes("<b>Hi</b>"), true);
  assert.equal(detail.site?.domain, "ncloud-development.local");
  assert.equal(Object.hasOwn(detail, "site_id"), false);
});

test("an admin saved-section response carries no credential material", () => {
  const serialized = JSON.stringify(
    mapAdminSavedSectionDetail(
      detailRow({
        css_code: css,
        preview_storage_path: `saved/${siteA}/${savedId}/p.webp`,
      }),
      owner,
      fakePreviewUrl,
    ),
  );

  for (const secret of [
    "sb_secret",
    "sb_publishable",
    "service_role",
    "site_token_hash",
    "NCLOUD_ADMIN_SECRET",
    "Authorization",
  ]) {
    assert.equal(serialized.includes(secret), false, `${secret} must not appear`);
  }

  // The raw storage path stays server-side; only the public URL is published.
  assert.equal(serialized.includes("preview_storage_path"), false);
});

test("a missing preview resolves to null rather than a broken link", () => {
  assert.equal(
    mapAdminSavedSectionListItem(detailRow(), owner, fakePreviewUrl)
      .previewScreenshotUrl,
    null,
  );

  // An unsafe path is refused even though it came from the database.
  assert.equal(
    mapAdminSavedSectionListItem(
      detailRow({ preview_storage_path: "../../secret.webp" }),
      owner,
      fakePreviewUrl,
    ).previewScreenshotUrl,
    null,
  );
});
