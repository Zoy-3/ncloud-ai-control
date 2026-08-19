import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CATEGORY_MAX_LENGTH,
  categoryKey,
  collectCategories,
  isUsableCategoryName,
  matchExistingCategory,
  resolveCategoryValue,
} from "../src/lib/sections/categories";
import {
  applyHiddenSections,
  visibleSectionStatuses,
  type SectionMetadataRow,
} from "../src/lib/sections/models";
import { normalizeStoragePath } from "../src/lib/supabase/storage-path";

const sectionsPage = readFileSync("src/app/dashboard/sections/page.tsx", "utf8");
const categoriesPage = readFileSync(
  "src/app/dashboard/categories/page.tsx",
  "utf8",
);
const templateManager = readFileSync(
  "src/components/admin/template-manager.tsx",
  "utf8",
);

function fakePreviewUrl(path: string | null): string | null {
  const objectPath = normalizeStoragePath(path);

  return objectPath === null ? null : `https://cdn.example.com/${objectPath}`;
}

function metadataRow(
  overrides: Partial<SectionMetadataRow> = {},
): SectionMetadataRow {
  return {
    id: "b987c546-b196-4470-b683-d32813afcf44",
    name: "Fly High Promo",
    category: "Tourism",
    section_type: "promo",
    style: null,
    preview_screenshot_url: null,
    preview_storage_path: null,
    status: "published",
    ...overrides,
  };
}

/* The Sections page must read the database, not fixtures
   ------------------------------------------------------------------------ */

test("the Sections page no longer imports the demo fixtures", () => {
  assert.equal(sectionsPage.includes("sampleSections"), false);
  assert.equal(sectionsPage.includes("siteCategories"), false);
  assert.equal(sectionsPage.includes("@/data/sample-sections"), false);
  assert.equal(sectionsPage.includes("@/data/site-categories"), false);

  // The old demo component is no longer what renders the library.
  assert.equal(sectionsPage.includes("<SectionLibrary "), false);
});

test("the Sections page reads the real sections repository", () => {
  assert.equal(
    sectionsPage.includes("@/lib/templates/admin-repository"),
    true,
    "the page must use the production repository",
  );
  assert.equal(sectionsPage.includes("listAdminTemplates()"), true);
  // Rendered per request, so it can never serve a cached demo snapshot.
  assert.equal(sectionsPage.includes('export const dynamic = "force-dynamic"'), true);
});

test("the demo fixtures are labelled so they cannot be reused by accident", () => {
  for (const file of ["src/data/sample-sections.ts", "src/data/site-categories.ts"]) {
    const contents = readFileSync(file, "utf8");

    assert.equal(
      contents.startsWith("/**\n * DEMO FIXTURE"),
      true,
      `${file} must be marked as a demo fixture`,
    );
  }

  // Nothing under the dashboard or the admin area may import them.
  for (const file of [sectionsPage, categoriesPage, templateManager]) {
    assert.equal(file.includes("@/data/sample-sections"), false);
    assert.equal(file.includes("@/data/site-categories"), false);
  }
});

test("the Categories page derives categories from real records", () => {
  assert.equal(categoriesPage.includes("listTemplateCategories"), true);
  assert.equal(categoriesPage.includes("siteCategories"), false);
});

/* Category derivation
   ------------------------------------------------------------------------ */

test("categories come from the records themselves, deduplicated and sorted", () => {
  const categories = collectCategories([
    { category: "Tourism" },
    { category: "Hotel" },
    { category: "Tourism" },
    { category: "Corporate" },
  ]);

  assert.deepEqual(categories, ["Corporate", "Hotel", "Tourism"]);

  // Nothing is hard-coded: an empty library yields no categories, and a new
  // one appears as soon as a record uses it.
  assert.deepEqual(collectCategories([]), []);
  assert.deepEqual(
    collectCategories([{ category: "Restaurant" }]),
    ["Restaurant"],
  );
});

test("categories differing only by case or whitespace are one category", () => {
  const categories = collectCategories([
    { category: "Tourism" },
    { category: "  tourism  " },
    { category: "TOURISM" },
  ]);

  // One entry, keeping the first spelling exactly as stored.
  assert.deepEqual(categories, ["Tourism"]);
  assert.equal(categoryKey("  Tourism "), categoryKey("tourism"));
});

test("genuinely different names stay separate", () => {
  // "Ecommerce" and "E-commerce" are not the same string by anything but a
  // guess, so they are deliberately left alone rather than silently merged.
  assert.deepEqual(
    collectCategories([{ category: "Ecommerce" }, { category: "E-commerce" }]),
    ["E-commerce", "Ecommerce"],
  );
});

test("blank and non-string categories are ignored", () => {
  assert.deepEqual(
    collectCategories([
      { category: "" },
      { category: "   " },
      { category: "Hotel" },
    ]),
    ["Hotel"],
  );
});

/* Adding a category
   ------------------------------------------------------------------------ */

test("a new category equivalent to an existing one reuses the stored spelling", () => {
  const existing = ["Tourism", "Hotel"];

  assert.equal(matchExistingCategory("  tourism ", existing), "Tourism");
  assert.equal(resolveCategoryValue("TOURISM", existing), "Tourism");
  assert.equal(matchExistingCategory("Restaurant", existing), null);
});

test("a genuinely new category is stored trimmed, exactly as typed", () => {
  assert.equal(resolveCategoryValue("  Restaurant  ", ["Tourism"]), "Restaurant");
  assert.equal(resolveCategoryValue("E-commerce", ["Ecommerce"]), "E-commerce");
});

test("an unusable category name is refused", () => {
  for (const value of ["", "   ", "\n\t ", "x".repeat(CATEGORY_MAX_LENGTH + 1)]) {
    assert.equal(isUsableCategoryName(value), false);
    assert.equal(resolveCategoryValue(value, ["Tourism"]), null);
  }

  assert.equal(isUsableCategoryName("x".repeat(CATEGORY_MAX_LENGTH)), true);
});

test("the Template Manager builds its dropdown from the loaded library", () => {
  assert.equal(templateManager.includes("collectCategories(templates)"), true);
  assert.equal(templateManager.includes("resolveCategoryValue"), true);
  assert.equal(templateManager.includes("+ Add new category"), true);
  // No category list is written into the component.
  assert.equal(templateManager.includes('"Corporate"'), false);
  assert.equal(templateManager.includes('"Tourism"'), false);
});

test("the Template Manager preview uploader accepts only the supported images", () => {
  assert.equal(
    templateManager.includes(
      'const PREVIEW_TYPES = ["image/jpeg", "image/png", "image/webp"]',
    ),
    true,
  );
  assert.equal(templateManager.includes("MAX_PREVIEW_BYTES = 5 * 1024 * 1024"), true);
  // SVG must not be offered or accepted anywhere in the manager.
  assert.equal(templateManager.includes("image/svg"), false);
  assert.equal(templateManager.includes(".svg"), false);
  // The existing server-side endpoint does the upload.
  assert.equal(
    templateManager.includes("`/api/admin/templates/${id}/preview`"),
    true,
  );
});

test("a failed preview upload keeps the template and says so", () => {
  assert.equal(
    templateManager.includes(
      "Template created, but the preview image could not be uploaded.",
    ),
    true,
  );
  // Nothing deletes a template because its image failed.
  assert.equal(templateManager.includes('method: "DELETE"'), false);
});

test("the create form is fully reset after a successful create", () => {
  // One reset function clears the draft and the chosen preview together, so no
  // field can be forgotten.
  assert.equal(templateManager.includes("function resetForm()"), true);
  assert.equal(templateManager.includes("setDraft(emptyDraft)"), true);
  assert.equal(templateManager.includes("setPreviewFile(null)"), true);

  // Every field of the empty draft really is empty.
  const emptyDraft = /const emptyDraft: Draft = \{([\s\S]*?)\};/.exec(
    templateManager,
  );

  assert.ok(emptyDraft);
  for (const blank of [
    'name: ""',
    'category: ""',
    'newCategory: ""',
    "addingCategory: false",
    'sectionType: ""',
    'style: ""',
    'shortcode: ""',
    'cssCode: ""',
  ]) {
    assert.equal(
      emptyDraft[1].includes(blank),
      true,
      `emptyDraft must contain ${blank}`,
    );
  }
});

test("card actions cannot be double-submitted", () => {
  // A pending key blocks the other actions on that card, and saving blocks all.
  assert.equal(templateManager.includes("disabled={anyPending || saving}"), true);
  assert.equal(templateManager.includes("if (saving) {\n      return;\n    }"), true);
});

test("every actionable button carries hover, active, focus, and disabled states", () => {
  for (const state of [
    "cursor-pointer",
    "hover:",
    "active:translate-y-px",
    "focus-visible:ring-2",
    "disabled:cursor-not-allowed",
    "disabled:opacity-55",
  ]) {
    assert.equal(
      templateManager.includes(state),
      true,
      `button styling must include ${state}`,
    );
  }
});

/* WordPress filtering must be unchanged
   ------------------------------------------------------------------------ */

test("WordPress still sees published templates only", () => {
  for (const environment of ["production", "test", undefined]) {
    const statuses = visibleSectionStatuses(environment);

    assert.deepEqual(statuses, ["published"]);
    assert.equal(statuses.includes("draft"), false);
    assert.equal(statuses.includes("archived"), false);
  }

  // Development additionally exposes drafts, as before.
  assert.deepEqual([...visibleSectionStatuses("development")].sort(), [
    "draft",
    "published",
  ]);
});

test("hiding a central template remains a per-site preference", () => {
  const rows = [
    metadataRow({ id: "11111111-1111-4111-8111-111111111111", name: "One" }),
    metadataRow({ id: "22222222-2222-4222-8222-222222222222", name: "Two" }),
  ];
  const hiddenForA = new Set(["11111111-1111-4111-8111-111111111111"]);

  assert.deepEqual(
    applyHiddenSections(rows, hiddenForA, false, fakePreviewUrl).map((s) => s.name),
    ["Two"],
  );
  // Another site, hiding nothing, is unaffected.
  assert.deepEqual(
    applyHiddenSections(rows, new Set(), false, fakePreviewUrl).map((s) => s.name),
    ["One", "Two"],
  );
});

test("the dashboard shows every status while WordPress does not", () => {
  // The dashboard page filters client-side over all rows it was given, and the
  // repository it calls does not filter by status at all.
  const adminRepository = readFileSync(
    "src/lib/templates/admin-repository.ts",
    "utf8",
  );

  assert.equal(adminRepository.includes("visibleSectionStatuses"), false);

  // The WordPress repository still does.
  const wordpressRepository = readFileSync(
    "src/lib/sections/repository.ts",
    "utf8",
  );

  assert.equal(wordpressRepository.includes("visibleSectionStatuses()"), true);
});
