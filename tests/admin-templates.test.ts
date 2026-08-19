import assert from "node:assert/strict";
import test from "node:test";

import {
  adminSignInBodySchema,
  createTemplateBodySchema,
  templateLimits,
  updateTemplateBodySchema,
} from "../src/lib/api/schemas";
import {
  ADMIN_SESSION_COOKIE,
  adminCookieOptions,
  createAdminSessionValue,
  isValidAdminSession,
  secretsMatch,
} from "../src/lib/auth/admin-session";
import {
  buildTemplateInsert,
  buildTemplateUpdate,
  mapAdminTemplateDetail,
  type AdminTemplateDetailRow,
} from "../src/lib/templates/admin-models";
import {
  buildTemplatePreviewPath,
  normalizeStoragePath,
} from "../src/lib/supabase/storage-path";

const secret = "a-sufficiently-long-admin-secret";
const sectionId = "b987c546-b196-4470-b683-d32813afcf44";
const now = 1_800_000_000;

const shortcode = '[section][row][col span="12"][ux_text][/ux_text][/col][/row][/section]';
const css = "  .a{color:red}\n\n  .b{color:blue}\n";

function fakePreviewUrl(path: string | null): string | null {
  const objectPath = normalizeStoragePath(path);

  return objectPath === null
    ? null
    : `https://project.supabase.co/storage/v1/object/public/section-previews/${objectPath}`;
}

function detailRow(
  overrides: Partial<AdminTemplateDetailRow> = {},
): AdminTemplateDetailRow {
  return {
    id: sectionId,
    name: "Corporate About",
    category: "Corporate",
    section_type: "about",
    style: "clean",
    preview_screenshot_url: null,
    preview_storage_path: null,
    status: "draft",
    created_at: "2026-08-19T10:00:00.000Z",
    updated_at: "2026-08-19T11:00:00.000Z",
    shortcode,
    css_code: null,
    ...overrides,
  };
}

/* Administrator authentication
   ------------------------------------------------------------------------ */

test("an absent session is rejected", () => {
  for (const value of [null, undefined, "", "   "]) {
    assert.equal(isValidAdminSession(value, secret, now), false);
  }
});

test("an invalid, forged, or expired session is rejected", () => {
  const valid = createAdminSessionValue(secret, now + 3600);

  // Genuine and current.
  assert.equal(isValidAdminSession(valid, secret, now), true);

  // Signed by a different secret.
  assert.equal(
    isValidAdminSession(valid, "another-sufficiently-long-secret", now),
    false,
  );

  // Expiry edited to extend the session; the signature no longer matches.
  const [, signature] = valid.split(".");
  assert.equal(
    isValidAdminSession(`${now + 999999}.${signature}`, secret, now),
    false,
  );

  // Structurally wrong.
  for (const value of [
    "not-a-session",
    `${now + 3600}`,
    `${now + 3600}.`,
    `.${signature}`,
    `${now + 3600}.zzzz`,
  ]) {
    assert.equal(isValidAdminSession(value, secret, now), false);
  }

  // Genuine but past its expiry.
  const expired = createAdminSessionValue(secret, now - 1);
  assert.equal(isValidAdminSession(expired, secret, now), false);
});

test("secret comparison accepts only the exact secret", () => {
  assert.equal(secretsMatch(secret, secret), true);
  assert.equal(secretsMatch("wrong", secret), false);
  assert.equal(secretsMatch(secret + "x", secret), false);
  assert.equal(secretsMatch(secret.slice(0, -1), secret), false);
  assert.equal(secretsMatch("", secret), false);
});

test("the session cookie is HttpOnly, SameSite, and Secure in production", () => {
  const production = adminCookieOptions(true, 3600);

  assert.equal(production.httpOnly, true);
  assert.equal(production.secure, true);
  assert.equal(production.sameSite, "lax");
  assert.equal(production.path, "/");

  // Development is served over plain HTTP, where a Secure cookie never arrives.
  assert.equal(adminCookieOptions(false, 3600).secure, false);
  // Clearing the cookie is the same options with no lifetime.
  assert.equal(adminCookieOptions(true, 0).maxAge, 0);
  assert.equal(ADMIN_SESSION_COOKIE, "ncloud_admin_session");
});

test("a session value never contains the secret itself", () => {
  const value = createAdminSessionValue(secret, now + 3600);

  assert.equal(value.includes(secret), false);
  assert.match(value, /^\d+\.[0-9a-f]{64}$/);
});

test("the sign-in body accepts only a secret field", () => {
  assert.equal(adminSignInBodySchema.safeParse({ secret: "x" }).success, true);
  assert.equal(adminSignInBodySchema.safeParse({}).success, false);
  assert.equal(
    adminSignInBodySchema.safeParse({ secret: "x", role: "admin" }).success,
    false,
  );
});

/* Create and edit
   ------------------------------------------------------------------------ */

test("a created template defaults to draft so nothing publishes itself", () => {
  const body = createTemplateBodySchema.parse({
    name: "  Hero  ",
    category: "Corporate",
    sectionType: "hero",
    shortcode,
  });
  const insert = buildTemplateInsert(body);

  assert.equal(insert.status, "draft");
  assert.equal(insert.name, "Hero");
  assert.equal(insert.shortcode, shortcode);
  assert.equal(insert.css_code, null);
  assert.equal(insert.style, null);
});

test("a create body cannot name a preview path or URL", () => {
  for (const forged of [
    { previewStoragePath: "templates/x/y.webp" },
    { preview_storage_path: "templates/x/y.webp" },
    { previewScreenshotUrl: "https://example.com/x.png" },
    { id: sectionId },
  ]) {
    assert.equal(
      createTemplateBodySchema.safeParse({
        name: "Hero",
        category: "Corporate",
        sectionType: "hero",
        shortcode,
        ...forged,
      }).success,
      false,
    );
  }
});

test("create rejects an empty or oversized shortcode", () => {
  const base = { name: "Hero", category: "Corporate", sectionType: "hero" };

  for (const invalid of ["", "   ", "\n\t "]) {
    assert.equal(
      createTemplateBodySchema.safeParse({ ...base, shortcode: invalid }).success,
      false,
    );
  }

  assert.equal(
    createTemplateBodySchema.safeParse({
      ...base,
      shortcode: "a".repeat(templateLimits.shortcode + 1),
    }).success,
    false,
  );
  assert.equal(
    createTemplateBodySchema.safeParse({
      ...base,
      shortcode,
      cssCode: "a".repeat(templateLimits.cssCode + 1),
    }).success,
    false,
  );
});

test("an edit writes only the fields supplied", () => {
  const patch = buildTemplateUpdate(
    updateTemplateBodySchema.parse({ name: "Renamed" }),
  );

  assert.deepEqual(patch, { name: "Renamed" });
  // Nothing else may be written, so a rename cannot blank the payload.
  assert.equal(Object.hasOwn(patch, "shortcode"), false);
  assert.equal(Object.hasOwn(patch, "css_code"), false);
  assert.equal(Object.hasOwn(patch, "status"), false);
});

test("an empty edit is rejected", () => {
  assert.equal(updateTemplateBodySchema.safeParse({}).success, false);
});

test("publish, unpublish, and archive are one field", () => {
  for (const status of ["published", "draft", "archived"] as const) {
    const patch = buildTemplateUpdate(updateTemplateBodySchema.parse({ status }));

    assert.deepEqual(patch, { status });
  }

  assert.equal(
    updateTemplateBodySchema.safeParse({ status: "deleted" }).success,
    false,
  );
});

test("shortcode and CSS survive create and edit byte for byte", () => {
  const awkward = '[ux_text]  <b>Bold</b>\n\n  &amp; more  [/ux_text]';

  const created = buildTemplateInsert(
    createTemplateBodySchema.parse({
      name: "Verbatim",
      category: "Corporate",
      sectionType: "about",
      shortcode: awkward,
      cssCode: css,
    }),
  );

  assert.equal(created.shortcode, awkward);
  assert.equal(created.css_code, css);

  const edited = buildTemplateUpdate(
    updateTemplateBodySchema.parse({ shortcode: awkward, cssCode: css }),
  );

  assert.equal(edited.shortcode, awkward);
  assert.equal(edited.css_code, css);
});

/* Preview
   ------------------------------------------------------------------------ */

test("a template preview path is generated per template", () => {
  const path = buildTemplatePreviewPath(sectionId, "image/webp", "unique1");

  assert.equal(path, `templates/${sectionId}/unique1.webp`);
  assert.equal(normalizeStoragePath(path), path);
});

test("the admin detail prefers a Storage preview and falls back to the old URL", () => {
  assert.equal(
    mapAdminTemplateDetail(
      detailRow({ preview_storage_path: "templates/a/b.webp" }),
      fakePreviewUrl,
    ).previewScreenshotUrl,
    "https://project.supabase.co/storage/v1/object/public/section-previews/templates/a/b.webp",
  );

  assert.equal(
    mapAdminTemplateDetail(
      detailRow({ preview_screenshot_url: "https://cdn.example.com/old.png" }),
      fakePreviewUrl,
    ).previewScreenshotUrl,
    "https://cdn.example.com/old.png",
  );

  assert.equal(
    mapAdminTemplateDetail(detailRow(), fakePreviewUrl).previewScreenshotUrl,
    null,
  );
});

test("an admin response carries no credential or storage internals", () => {
  const detail = mapAdminTemplateDetail(
    detailRow({
      css_code: css,
      preview_storage_path: "templates/a/b.webp",
    }),
    fakePreviewUrl,
  );
  const serialized = JSON.stringify(detail);

  // The raw storage path stays server-side; only the public URL is published.
  assert.equal(Object.hasOwn(detail, "preview_storage_path"), false);
  assert.equal(serialized.includes("sb_secret"), false);
  assert.equal(serialized.includes("service_role"), false);
  assert.equal(serialized.includes(secret), false);
});
