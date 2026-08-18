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

function detailRow(): SectionDetailRow {
  return {
    id: sectionId,
    name: "Corporate About - Basic",
    category: "Corporate",
    section_type: "about",
    style: "clean",
    preview_screenshot_url: null,
    status: "draft",
    shortcode: "[section][row][col span=\"12\"][ux_text][/ux_text][/col][/row][/section]",
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

test("listing output never carries the stored shortcode", () => {
  const metadata = mapSectionMetadata(detailRow());

  assert.equal(Object.hasOwn(metadata, "shortcode"), false);
  assert.equal(Object.hasOwn(metadata, "original_prompt"), false);
  assert.equal(Object.hasOwn(metadata, "created_at"), false);
  assert.equal(sectionMetadataColumns.includes("shortcode"), false);
});

test("detail output adds the shortcode to the same metadata", () => {
  const row = detailRow();
  const detail = mapSectionDetail(row);

  assert.equal(detail.shortcode, row.shortcode);
  assert.deepEqual(
    { ...detail, shortcode: undefined },
    { ...mapSectionMetadata(row), shortcode: undefined },
  );
  assert.equal(sectionDetailColumns.includes("shortcode"), true);
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
