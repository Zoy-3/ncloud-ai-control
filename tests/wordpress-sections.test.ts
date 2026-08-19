import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../src/lib/api/errors";
import { parseUuid, parseUuidParam } from "../src/lib/api/request";
import { readSiteToken } from "../src/lib/auth/site-token";
import {
  applyHiddenSections,
  mapSectionDetail,
  mapSectionMetadata,
  readSectionPreviewUrl,
  sectionDetailColumns,
  sectionMetadataColumns,
  visibleSectionStatuses,
  type SectionDetailRow,
  type SectionMetadataRow,
} from "../src/lib/sections/models";
import { normalizeStoragePath } from "../src/lib/supabase/storage-path";

const sectionId = "b987c546-b196-4470-b683-d32813afcf44";
const otherSectionId = "1b0c9d3e-5a71-4f28-9c64-8e2d7a1f5b03";

const sectionCss = ".ncloud-about {\n  padding: 40px 0;\n}\n";

/** Stands in for the server-only Storage helper. */
function fakePreviewUrl(path: string | null): string | null {
  const objectPath = normalizeStoragePath(path);

  return objectPath === null
    ? null
    : `https://project.supabase.co/storage/v1/object/public/section-previews/${objectPath}`;
}

function detailRow(
  overrides: Partial<SectionDetailRow> = {},
): SectionDetailRow {
  return {
    id: sectionId,
    name: "Corporate About - Basic",
    category: "Corporate",
    section_type: "about",
    style: "clean",
    preview_screenshot_url: null,
    preview_storage_path: null,
    status: "draft",
    shortcode: "[section][row][col span=\"12\"][ux_text][/ux_text][/col][/row][/section]",
    css_code: null,
    ...overrides,
  };
}

function metadataRow(
  overrides: Partial<SectionMetadataRow> = {},
): SectionMetadataRow {
  return detailRow(overrides);
}

test("a database row maps to the WordPress template metadata contract", () => {
  assert.deepEqual(mapSectionMetadata(detailRow(), fakePreviewUrl, false), {
    id: sectionId,
    name: "Corporate About - Basic",
    category: "Corporate",
    sectionType: "about",
    style: "clean",
    previewScreenshotUrl: null,
    status: "draft",
    hidden: false,
  });
});

test("listing output never carries the stored shortcode or CSS", () => {
  const metadata = mapSectionMetadata(
    detailRow({ css_code: sectionCss }),
    fakePreviewUrl,
    false,
  );

  assert.equal(Object.hasOwn(metadata, "shortcode"), false);
  assert.equal(Object.hasOwn(metadata, "cssCode"), false);
  assert.equal(Object.hasOwn(metadata, "css_code"), false);
  assert.equal(Object.hasOwn(metadata, "original_prompt"), false);
  assert.equal(Object.hasOwn(metadata, "created_at"), false);

  // The listing query must not even ask the database for the payload columns.
  assert.equal(sectionMetadataColumns.includes("shortcode"), false);
  assert.equal(sectionMetadataColumns.includes("css_code"), false);

  const serialized = JSON.stringify(metadata);
  assert.equal(serialized.includes("[section]"), false);
  assert.equal(serialized.includes("ncloud-about"), false);
});

test("detail output adds the shortcode and CSS to the same metadata", () => {
  const row = detailRow({ css_code: sectionCss });
  const detail = mapSectionDetail(row, fakePreviewUrl, false);

  assert.equal(detail.shortcode, row.shortcode);
  assert.equal(detail.cssCode, sectionCss);
  assert.deepEqual(
    { ...detail, shortcode: undefined, cssCode: undefined },
    {
      ...mapSectionMetadata(row, fakePreviewUrl, false),
      shortcode: undefined,
      cssCode: undefined,
    },
  );
  assert.equal(sectionDetailColumns.includes("shortcode"), true);
  assert.equal(sectionDetailColumns.includes("css_code"), true);
});

test("detail CSS is returned byte for byte, so the stylesheet is unaltered", () => {
  const css = "  .a{color:red}\n\n  .b{color:blue}\n";

  assert.equal(
    mapSectionDetail(detailRow({ css_code: css }), fakePreviewUrl, false).cssCode,
    css,
  );
});

test("detail reports cssCode as null when a section stores no CSS", () => {
  for (const stored of [null, "", "   ", "\n\t "]) {
    const detail = mapSectionDetail(
      detailRow({ css_code: stored }),
      fakePreviewUrl,
      false,
    );

    assert.equal(detail.cssCode, null);
    assert.equal(Object.hasOwn(detail, "cssCode"), true);
    assert.equal(detail.shortcode.length > 0, true);
  }
});

test("the shortcode and CSS stay separate fields and are never merged", () => {
  const detail = mapSectionDetail(
    detailRow({ css_code: sectionCss }),
    fakePreviewUrl,
    false,
  );

  assert.equal(detail.shortcode.includes(sectionCss), false);
  assert.equal(detail.cssCode?.includes("[section]"), false);
});

test("a Storage preview wins, and an older URL record still resolves", () => {
  // New records: the object path becomes a public URL.
  assert.equal(
    readSectionPreviewUrl(
      { preview_storage_path: "templates/abc/one.webp", preview_screenshot_url: null },
      fakePreviewUrl,
    ),
    "https://project.supabase.co/storage/v1/object/public/section-previews/templates/abc/one.webp",
  );

  // Older records carry a full URL and keep working untouched.
  assert.equal(
    readSectionPreviewUrl(
      {
        preview_storage_path: null,
        preview_screenshot_url: "https://cdn.example.com/legacy.png",
      },
      fakePreviewUrl,
    ),
    "https://cdn.example.com/legacy.png",
  );

  // A stored path takes precedence over a stale legacy URL.
  assert.equal(
    readSectionPreviewUrl(
      {
        preview_storage_path: "templates/abc/new.webp",
        preview_screenshot_url: "https://cdn.example.com/legacy.png",
      },
      fakePreviewUrl,
    ),
    "https://project.supabase.co/storage/v1/object/public/section-previews/templates/abc/new.webp",
  );

  // Neither present, and an unsafe path, both mean "no preview".
  assert.equal(
    readSectionPreviewUrl(
      { preview_storage_path: null, preview_screenshot_url: null },
      fakePreviewUrl,
    ),
    null,
  );
  assert.equal(
    readSectionPreviewUrl(
      { preview_storage_path: "../../secret.webp", preview_screenshot_url: null },
      fakePreviewUrl,
    ),
    null,
  );
});

test("a template hidden by this site is excluded from the default listing", () => {
  const rows = [metadataRow(), metadataRow({ id: otherSectionId, name: "Other" })];
  const visible = applyHiddenSections(
    rows,
    new Set([sectionId]),
    false,
    fakePreviewUrl,
  );

  assert.deepEqual(
    visible.map((item) => item.id),
    [otherSectionId],
  );
  assert.equal(visible[0].hidden, false);
});

test("includeHidden returns hidden templates flagged so one can be restored", () => {
  const rows = [metadataRow(), metadataRow({ id: otherSectionId, name: "Other" })];
  const all = applyHiddenSections(
    rows,
    new Set([sectionId]),
    true,
    fakePreviewUrl,
  );

  assert.equal(all.length, 2);
  assert.equal(all.find((item) => item.id === sectionId)?.hidden, true);
  assert.equal(all.find((item) => item.id === otherSectionId)?.hidden, false);
});

test("one site's hidden templates never affect another site", () => {
  const rows = [metadataRow(), metadataRow({ id: otherSectionId, name: "Other" })];

  // Site A has hidden the first template.
  const siteA = applyHiddenSections(rows, new Set([sectionId]), false, fakePreviewUrl);
  // Site B has hidden nothing, and is unaffected by site A's preference.
  const siteB = applyHiddenSections(rows, new Set(), false, fakePreviewUrl);

  assert.deepEqual(siteA.map((item) => item.id), [otherSectionId]);
  assert.deepEqual(siteB.map((item) => item.id), [sectionId, otherSectionId]);
  assert.equal(siteB.every((item) => item.hidden === false), true);
});

test("unhiding restores a template to the default listing", () => {
  const rows = [metadataRow()];

  assert.equal(
    applyHiddenSections(rows, new Set([sectionId]), false, fakePreviewUrl).length,
    0,
  );
  // The preference has been removed, so the template is visible again.
  assert.equal(
    applyHiddenSections(rows, new Set(), false, fakePreviewUrl).length,
    1,
  );
});

test("development shows drafts and published templates but never archived", () => {
  const statuses = visibleSectionStatuses("development");

  assert.deepEqual([...statuses].sort(), ["draft", "published"]);
  assert.equal(statuses.includes("archived"), false);
});

test("every non-development environment exposes published templates only", () => {
  for (const environment of ["production", "test", undefined]) {
    const statuses = visibleSectionStatuses(environment);

    assert.deepEqual(statuses, ["published"]);
    assert.equal(statuses.includes("draft"), false);
    assert.equal(statuses.includes("archived"), false);
  }
});

test("a malformed section id is rejected before any database read", () => {
  assert.throws(
    () => parseUuidParam("not-a-uuid", "Section ID"),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "validation_error");
      assert.equal(error.message, "Section ID must be a valid UUID.");
      return true;
    },
  );
  assert.equal(parseUuidParam(sectionId, "Section ID"), sectionId);
  // The job route's existing contract must not change.
  assert.throws(
    () => parseUuid("not-a-uuid"),
    (error: unknown) =>
      error instanceof ApiError && error.message === "Job ID must be a valid UUID.",
  );
});

test("an unavailable template is reported as a plain not-found", () => {
  const notFound = new ApiError(404, "not_found", "Template was not found.");

  assert.equal(notFound.status, 404);
  assert.equal(notFound.code, "not_found");
  assert.equal(notFound.message.includes("draft"), false);
  assert.equal(notFound.message.includes("archived"), false);
});

test("the WordPress template routes require a site bearer token", () => {
  for (const authorization of [null, "", "Bearer ", "Basic abc", "Bearer short"]) {
    assert.throws(
      () => readSiteToken(authorization),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 401);
        assert.equal(error.code, "unauthorized");
        return true;
      },
    );
  }
});
