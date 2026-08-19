import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../src/lib/api/errors";
import { parseUuidParam } from "../src/lib/api/request";
import {
  createSavedSectionBodySchema,
  savedSectionLimits,
} from "../src/lib/api/schemas";
import { readSiteToken } from "../src/lib/auth/site-token";
import {
  buildSavedSectionInsert,
  savedSectionDetailColumns,
  savedSectionListColumns,
  type SavedSectionDetailRow,
  type SavedSectionInsert,
  type SavedSectionListRow,
} from "../src/lib/saved-sections/models";
import {
  createSavedSectionForSite,
  getSavedSectionForSite,
  listSavedSectionsForSite,
  type SavedSectionsGateway,
} from "../src/lib/saved-sections/service";
import { normalizeStoragePath } from "../src/lib/supabase/storage-path";

const siteA = "5988ae3e-7177-46aa-8198-c15f87e19d28";
const siteB = "b1f9c0e4-4c53-4f0a-9d2e-0a7c1f5b6d31";

const ownedId = "7c3a1d90-2f4b-4a61-9b8e-2c5d7e1a4f60";
const foreignId = "e2b7d4a1-6c85-4f3d-8a19-9d0c3b7e5a24";

const shortcode = '[section][row][col span="12"][ux_text][/ux_text][/col][/row][/section]';
const cssCode = ".ncloud-saved {\n  padding: 40px 0;\n}\n";

/** Preview URLs are built from a path by the server-only Storage helper. */
function fakePreviewUrl(path: string | null): string | null {
  const objectPath = normalizeStoragePath(path);

  return objectPath === null
    ? null
    : `https://project.supabase.co/storage/v1/object/public/section-previews/${objectPath}`;
}

function detailRow(
  overrides: Partial<SavedSectionDetailRow> = {},
): SavedSectionDetailRow {
  return {
    id: ownedId,
    site_id: siteA,
    name: "Hero with CTA",
    preview_storage_path: null,
    shortcode,
    css_code: null,
    created_at: "2026-08-19T10:00:00.000Z",
    updated_at: "2026-08-19T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * In-memory stand-in for the database, holding rows for two different sites.
 *
 * `listBySite` and `findForSite` filter the way the Supabase implementation
 * does, so a scoping mistake in the service layer shows up as a real failure.
 */
function gatewayWith(rows: SavedSectionDetailRow[]): SavedSectionsGateway & {
  inserted: SavedSectionInsert[];
} {
  const inserted: SavedSectionInsert[] = [];

  return {
    inserted,
    async listBySite(siteId: string): Promise<SavedSectionListRow[]> {
      return rows
        .filter((row) => row.site_id === siteId)
        .sort((first, second) => second.created_at.localeCompare(first.created_at));
    },
    async findForSite(
      savedSectionId: string,
      siteId: string,
    ): Promise<SavedSectionDetailRow | null> {
      return (
        rows.find(
          (row) => row.id === savedSectionId && row.site_id === siteId,
        ) ?? null
      );
    },
    async create(row: SavedSectionInsert): Promise<SavedSectionDetailRow> {
      inserted.push(row);

      return detailRow({
        id: ownedId,
        site_id: row.site_id,
        name: row.name,
        shortcode: row.shortcode,
        css_code: row.css_code ?? null,
        preview_storage_path: row.preview_storage_path ?? null,
      });
    },
  };
}

function bothSites(): SavedSectionDetailRow[] {
  return [
    detailRow({
      id: ownedId,
      site_id: siteA,
      name: "Older own section",
      created_at: "2026-08-19T09:00:00.000Z",
    }),
    detailRow({
      id: "0f5c2a77-8d31-4b6e-9c04-7a2e1f8b3d59",
      site_id: siteA,
      name: "Newer own section",
      created_at: "2026-08-19T12:00:00.000Z",
    }),
    detailRow({
      id: foreignId,
      site_id: siteB,
      name: "Another site's section",
      created_at: "2026-08-19T13:00:00.000Z",
    }),
  ];
}

test("an unauthenticated saved-sections request is rejected", () => {
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

test("a listing returns only the authenticated site's rows, newest first", async () => {
  const sections = await listSavedSectionsForSite(
    gatewayWith(bothSites()),
    siteA,
    fakePreviewUrl,
  );

  assert.deepEqual(
    sections.map((section) => section.name),
    ["Newer own section", "Older own section"],
  );
  assert.equal(
    sections.some((section) => section.id === foreignId),
    false,
  );
});

test("a listing exposes neither shortcode, CSS, nor the owning site", async () => {
  const sections = await listSavedSectionsForSite(
    gatewayWith([detailRow({ css_code: cssCode })]),
    siteA,
    fakePreviewUrl,
  );

  const [section] = sections;

  assert.deepEqual(Object.keys(section).sort(), [
    "createdAt",
    "id",
    "name",
    "previewScreenshotUrl",
    "updatedAt",
  ]);

  // The query must not even ask the database for the payload columns.
  assert.equal(savedSectionListColumns.includes("shortcode"), false);
  assert.equal(savedSectionListColumns.includes("css_code"), false);
  assert.equal(savedSectionListColumns.includes("site_id"), false);

  const serialized = JSON.stringify(sections);
  assert.equal(serialized.includes("[section]"), false);
  assert.equal(serialized.includes("ncloud-saved"), false);
  assert.equal(serialized.includes(siteA), false);
});

test("detail returns the site's own saved section in full", async () => {
  const section = await getSavedSectionForSite(
    gatewayWith([detailRow({ css_code: cssCode })]),
    ownedId,
    siteA,
    fakePreviewUrl,
  );

  assert.equal(section.id, ownedId);
  assert.equal(section.shortcode, shortcode);
  assert.equal(section.cssCode, cssCode);
  assert.equal(Object.hasOwn(section, "site_id"), false);
  assert.equal(Object.hasOwn(section, "siteId"), false);
  assert.equal(savedSectionDetailColumns.includes("shortcode"), true);
  assert.equal(savedSectionDetailColumns.includes("css_code"), true);
});

test("detail cannot read another site's saved section", async () => {
  const gateway = gatewayWith(bothSites());

  // The id exists, but it belongs to site B.
  await assert.rejects(
    () => getSavedSectionForSite(gateway, foreignId, siteA, fakePreviewUrl),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 404);
      assert.equal(error.code, "not_found");
      return true;
    },
  );

  // A row that does not exist at all must fail identically, so the response
  // cannot be used to probe for another site's records.
  const missing = await getSavedSectionForSite(
    gateway,
    "3d6f8b21-5a49-4c72-8e13-6b0d9a2f4c85",
    siteA,
    fakePreviewUrl,
  ).catch((error: unknown) => error);

  assert.ok(missing instanceof ApiError);
  assert.equal(missing.status, 404);
  assert.equal(missing.message, "Saved section was not found.");
});

test("a gateway that ignores scoping still cannot return a foreign row", async () => {
  // Defence in depth: even if the query lost its site filter, the row that came
  // back is re-checked against the authenticated site.
  const leaky: SavedSectionsGateway = {
    async listBySite() {
      return [];
    },
    async findForSite() {
      return detailRow({ id: foreignId, site_id: siteB });
    },
    async create(row) {
      return detailRow({ site_id: row.site_id });
    },
  };

  await assert.rejects(
    () => getSavedSectionForSite(leaky, foreignId, siteA, fakePreviewUrl),
    (error: unknown) => error instanceof ApiError && 404 === error.status,
  );
});

test("create stores the authenticated site as the owner", async () => {
  const gateway = gatewayWith([]);
  const body = createSavedSectionBodySchema.parse({
    name: "  My saved section  ",
    shortcode,
    cssCode,
  });

  const section = await createSavedSectionForSite(
    gateway,
    siteA,
    body,
    fakePreviewUrl,
  );

  assert.equal(gateway.inserted.length, 1);
  assert.equal(gateway.inserted[0].site_id, siteA);
  // A new row never carries a preview path; uploads are a later phase.
  assert.equal(gateway.inserted[0].preview_storage_path, null);
  // The name is trimmed; the payloads are not touched.
  assert.equal(gateway.inserted[0].name, "My saved section");
  assert.equal(gateway.inserted[0].shortcode, shortcode);
  assert.equal(gateway.inserted[0].css_code, cssCode);

  // The create response is metadata only.
  assert.deepEqual(Object.keys(section).sort(), [
    "createdAt",
    "id",
    "name",
    "previewScreenshotUrl",
    "updatedAt",
  ]);
});

test("a body cannot choose which site owns the saved section", () => {
  for (const forged of [
    { siteId: siteB },
    { site_id: siteB },
    { previewScreenshotUrl: "https://example.com/x.webp" },
    { preview_storage_path: "saved/other/x.webp" },
  ]) {
    const result = createSavedSectionBodySchema.safeParse({
      name: "Forged",
      shortcode,
      ...forged,
    });

    assert.equal(result.success, false);
  }

  // Even if an extra key survived a schema change, the row is built from the
  // authenticated site alone.
  const insert = buildSavedSectionInsert(siteA, {
    name: "Owned",
    shortcode,
    cssCode: null,
  });

  assert.equal(insert.site_id, siteA);
  assert.equal(insert.preview_storage_path, null);
});

test("a malformed saved section id is rejected before any database read", () => {
  assert.throws(
    () => parseUuidParam("not-a-uuid", "Saved section ID"),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "validation_error");
      assert.equal(error.message, "Saved section ID must be a valid UUID.");
      return true;
    },
  );
  assert.equal(parseUuidParam(ownedId, "Saved section ID"), ownedId);
});

test("an empty or oversized shortcode is rejected", () => {
  for (const invalid of ["", "   ", "\n\t "]) {
    assert.equal(
      createSavedSectionBodySchema.safeParse({ name: "X", shortcode: invalid })
        .success,
      false,
    );
  }

  assert.equal(
    createSavedSectionBodySchema.safeParse({
      name: "X",
      shortcode: "a".repeat(savedSectionLimits.shortcode + 1),
    }).success,
    false,
  );
  assert.equal(
    createSavedSectionBodySchema.safeParse({
      name: "X",
      shortcode: "a".repeat(savedSectionLimits.shortcode),
    }).success,
    true,
  );
});

test("a name is required and bounded, and CSS is bounded when present", () => {
  assert.equal(
    createSavedSectionBodySchema.safeParse({ name: "   ", shortcode }).success,
    false,
  );
  assert.equal(
    createSavedSectionBodySchema.safeParse({
      name: "a".repeat(savedSectionLimits.name + 1),
      shortcode,
    }).success,
    false,
  );
  assert.equal(
    createSavedSectionBodySchema.safeParse({
      name: "X",
      shortcode,
      cssCode: "a".repeat(savedSectionLimits.cssCode + 1),
    }).success,
    false,
  );
});

test("cssCode may be null, omitted, or blank and is stored as absent", () => {
  for (const body of [
    { name: "X", shortcode, cssCode: null },
    { name: "X", shortcode },
    { name: "X", shortcode, cssCode: "" },
    { name: "X", shortcode, cssCode: "   " },
  ]) {
    const parsed = createSavedSectionBodySchema.safeParse(body);

    assert.equal(parsed.success, true);
    assert.ok(parsed.data);
    assert.equal(buildSavedSectionInsert(siteA, parsed.data).css_code, null);
  }
});

test("the shortcode and CSS are stored exactly as supplied", () => {
  const awkward = '[ux_text]  <b>Bold</b>\n\n  &amp; more  [/ux_text]';
  const awkwardCss = "  .a{color:red}\n\n  .b{color:blue}\n";
  const parsed = createSavedSectionBodySchema.parse({
    name: "Verbatim",
    shortcode: awkward,
    cssCode: awkwardCss,
  });
  const insert = buildSavedSectionInsert(siteA, parsed);

  assert.equal(insert.shortcode, awkward);
  assert.equal(insert.css_code, awkwardCss);
});

test("a missing preview path produces a null preview URL", async () => {
  const sections = await listSavedSectionsForSite(
    gatewayWith([detailRow({ preview_storage_path: null })]),
    siteA,
    fakePreviewUrl,
  );

  assert.equal(sections[0].previewScreenshotUrl, null);

  const withPreview = await listSavedSectionsForSite(
    gatewayWith([
      detailRow({ preview_storage_path: `saved/${siteA}/preview.webp` }),
    ]),
    siteA,
    fakePreviewUrl,
  );

  assert.equal(
    withPreview[0].previewScreenshotUrl,
    `https://project.supabase.co/storage/v1/object/public/section-previews/saved/${siteA}/preview.webp`,
  );
});

test("an unsafe storage path never becomes a URL", () => {
  for (const unsafe of [
    null,
    "",
    "   ",
    "/etc/passwd",
    "saved/../../secret.webp",
    "https://evil.example.com/x.webp",
    "saved/\u0001name.webp",
  ]) {
    assert.equal(normalizeStoragePath(unsafe), null);
  }

  assert.equal(
    normalizeStoragePath("  saved/site/preview.webp  "),
    "saved/site/preview.webp",
  );
});
