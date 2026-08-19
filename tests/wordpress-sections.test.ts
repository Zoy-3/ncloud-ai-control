import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../src/lib/api/errors";
import { parseUuid, parseUuidParam } from "../src/lib/api/request";
import { readSiteToken } from "../src/lib/auth/site-token";
import {
  mapSectionDetail,
  mapSectionMetadata,
  sectionDetailColumns,
  sectionMetadataColumns,
  visibleSectionStatuses,
  type SectionDetailRow,
} from "../src/lib/sections/models";

const sectionId = "b987c546-b196-4470-b683-d32813afcf44";

const sectionCss = ".ncloud-about {\n  padding: 40px 0;\n}\n";

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
    status: "draft",
    shortcode: "[section][row][col span=\"12\"][ux_text][/ux_text][/col][/row][/section]",
    css_code: null,
    ...overrides,
  };
}

test("a database row maps to the WordPress template metadata contract", () => {
  assert.deepEqual(mapSectionMetadata(detailRow()), {
    id: sectionId,
    name: "Corporate About - Basic",
    category: "Corporate",
    sectionType: "about",
    style: "clean",
    previewScreenshotUrl: null,
    status: "draft",
  });
});

test("listing output never carries the stored shortcode or CSS", () => {
  const metadata = mapSectionMetadata(detailRow({ css_code: sectionCss }));

  assert.equal(Object.hasOwn(metadata, "shortcode"), false);
  assert.equal(Object.hasOwn(metadata, "cssCode"), false);
  assert.equal(Object.hasOwn(metadata, "css_code"), false);
  assert.equal(Object.hasOwn(metadata, "original_prompt"), false);
  assert.equal(Object.hasOwn(metadata, "created_at"), false);

  // The listing query must not even ask the database for the payload columns.
  assert.equal(sectionMetadataColumns.includes("shortcode"), false);
  assert.equal(sectionMetadataColumns.includes("css_code"), false);

  // Nothing that reaches the wire may contain either payload.
  const serialized = JSON.stringify(metadata);
  assert.equal(serialized.includes("[section]"), false);
  assert.equal(serialized.includes("ncloud-about"), false);
});

test("detail output adds the shortcode and CSS to the same metadata", () => {
  const row = detailRow({ css_code: sectionCss });
  const detail = mapSectionDetail(row);

  assert.equal(detail.shortcode, row.shortcode);
  assert.equal(detail.cssCode, sectionCss);
  assert.deepEqual(
    { ...detail, shortcode: undefined, cssCode: undefined },
    { ...mapSectionMetadata(row), shortcode: undefined, cssCode: undefined },
  );
  assert.equal(sectionDetailColumns.includes("shortcode"), true);
  assert.equal(sectionDetailColumns.includes("css_code"), true);
});

test("detail CSS is returned byte for byte, so the stylesheet is unaltered", () => {
  const css = "  .a{color:red}\n\n  .b{color:blue}\n";

  assert.equal(mapSectionDetail(detailRow({ css_code: css })).cssCode, css);
});

test("detail reports cssCode as null when a section stores no CSS", () => {
  // A column never written reads as null; a blank value means the same thing.
  for (const stored of [null, "", "   ", "\n\t "]) {
    const detail = mapSectionDetail(detailRow({ css_code: stored }));

    assert.equal(detail.cssCode, null);
    // The field is always present, so the plugin never has to test for absence.
    assert.equal(Object.hasOwn(detail, "cssCode"), true);
    // Missing CSS must never cost the caller its shortcode.
    assert.equal(detail.shortcode.length > 0, true);
  }
});

test("the shortcode and CSS stay separate fields and are never merged", () => {
  const detail = mapSectionDetail(detailRow({ css_code: sectionCss }));

  assert.equal(detail.shortcode.includes(sectionCss), false);
  assert.equal(detail.shortcode.includes("ncloud-about"), false);
  assert.equal(detail.cssCode?.includes("[section]"), false);
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
