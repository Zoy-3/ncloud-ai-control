"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminSignOut } from "@/components/admin/admin-sign-out";
import {
  CATEGORY_MAX_LENGTH,
  collectCategories,
  isUsableCategoryName,
  resolveCategoryValue,
} from "@/lib/sections/categories";
import type { SectionStatus } from "@/lib/supabase/database.types";

type TemplateListItem = {
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

type TemplateDetail = TemplateListItem & {
  shortcode: string;
  cssCode: string | null;
};

type Draft = {
  name: string;
  category: string;
  /** Set while "+ Add new category" is chosen. */
  newCategory: string;
  addingCategory: boolean;
  sectionType: string;
  style: string;
  shortcode: string;
  cssCode: string;
  status: SectionStatus;
};

const emptyDraft: Draft = {
  name: "",
  category: "",
  newCategory: "",
  addingCategory: false,
  sectionType: "",
  style: "",
  shortcode: "",
  cssCode: "",
  status: "draft",
};

const ADD_CATEGORY = "__add__";

/** Preview limits, matching what the upload endpoint enforces server-side. */
const PREVIEW_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;

const statusLabels: Record<SectionStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const statusStyles: Record<SectionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-amber-100 text-amber-900",
};

/**
 * Shared button behaviour.
 *
 * Every actionable control gets a pointer cursor, a hover change, a visible
 * pressed state, an accessible focus ring, and an unmistakable disabled look.
 * Hover and press are suppressed while disabled so a pending button does not
 * look clickable.
 */
const btn =
  "inline-flex cursor-pointer items-center justify-center rounded-lg font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none";

const primary = `${btn} bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md active:translate-y-px active:bg-blue-800 focus-visible:ring-blue-500/50 disabled:hover:bg-blue-600 disabled:active:translate-y-0`;
const neutral = `${btn} border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 active:translate-y-px active:bg-slate-100 focus-visible:ring-blue-500/40 disabled:hover:border-slate-300 disabled:hover:bg-white disabled:active:translate-y-0`;
const success = `${btn} border border-emerald-300 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50 active:translate-y-px active:bg-emerald-100 focus-visible:ring-emerald-500/40 disabled:hover:bg-white disabled:active:translate-y-0`;
const warn = `${btn} border border-amber-300 bg-white text-amber-900 hover:border-amber-400 hover:bg-amber-50 active:translate-y-px active:bg-amber-100 focus-visible:ring-amber-500/40 disabled:hover:bg-white disabled:active:translate-y-0`;

const lg = "px-4 py-2 text-sm";
const sm = "px-3 py-1.5 text-xs";

const field =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25";
const mono = `${field} font-mono`;

type LoadResult =
  | { ok: true; templates: TemplateListItem[] }
  | { ok: false };

async function fetchTemplates(): Promise<LoadResult> {
  try {
    const response = await fetch("/api/admin/templates", {
      credentials: "same-origin",
    });
    const payload = await response.json();

    if (!response.ok || !payload?.success) {
      return { ok: false };
    }

    return { ok: true, templates: payload.templates as TemplateListItem[] };
  } catch {
    return { ok: false };
  }
}

/**
 * The central template manager.
 *
 * Everything here talks to this app's own `/api/admin/*` routes, which re-check
 * the administrator session server-side on every call. No Supabase credential
 * and no admin secret is ever sent to the browser, and preview images are
 * written by the server, never directly by this component.
 */
export function TemplateManager() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");

  const [editing, setEditing] = useState<TemplateDetail | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  // Which card action is in flight, as `${id}:${action}`.
  const [pending, setPending] = useState("");

  const [previewFile, setPreviewFile] = useState<File | null>(null);

  // Derived rather than stored, so choosing a file sets no state from an effect.
  const previewUrl = useMemo(
    () => (previewFile === null ? "" : URL.createObjectURL(previewFile)),
    [previewFile],
  );

  /** Categories offered by the dropdown, taken from the real library. */
  const categories = useMemo(() => collectCategories(templates), [templates]);

  const applyResult = useCallback((result: LoadResult) => {
    if (result.ok) {
      setError("");
      setTemplates(result.templates);
    } else {
      setError("Could not load templates.");
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  const reload = useCallback(async () => {
    applyResult(await fetchTemplates());
  }, [applyResult]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await fetchTemplates();

      if (active) {
        applyResult(result);
      }
    })();

    return () => {
      active = false;
    };
  }, [applyResult]);

  // A local object URL must be released or it leaks for the page's lifetime.
  useEffect(() => {
    if (previewUrl === "") {
      return;
    }

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  /** Clears every field, including the chosen preview and any messages. */
  function resetForm() {
    setEditing(null);
    setDraft(emptyDraft);
    setPreviewFile(null);
  }

  function startCreate() {
    resetForm();
    setNotice("");
    setWarning("");
    setError("");
  }

  async function startEdit(id: string) {
    setNotice("");
    setWarning("");
    setPending(`${id}:edit`);

    try {
      const response = await fetch(`/api/admin/templates/${id}`, {
        credentials: "same-origin",
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setError("That template could not be opened.");
        return;
      }

      const template = payload.template as TemplateDetail;

      setEditing(template);
      setPreviewFile(null);
      setDraft({
        name: template.name,
        category: template.category,
        newCategory: "",
        addingCategory: false,
        sectionType: template.sectionType,
        style: template.style ?? "",
        shortcode: template.shortcode,
        cssCode: template.cssCode ?? "",
        status: template.status,
      });
    } catch {
      setError("That template could not be opened.");
    } finally {
      setPending("");
    }
  }

  /**
   * The category this draft should store.
   *
   * A newly typed name that matches an existing category reuses the stored
   * spelling, so the library does not collect near-duplicates.
   */
  function draftCategory(): string | null {
    if (!draft.addingCategory) {
      return draft.category === "" ? null : draft.category;
    }

    return resolveCategoryValue(draft.newCategory, categories);
  }

  function chooseCategory(value: string) {
    if (value === ADD_CATEGORY) {
      setDraft({ ...draft, addingCategory: true, category: "" });
      return;
    }

    setDraft({ ...draft, addingCategory: false, newCategory: "", category: value });
  }

  /** Validates a chosen preview before anything is uploaded. */
  function choosePreview(file: File | null) {
    setError("");

    if (file === null) {
      setPreviewFile(null);
      return;
    }

    if (!PREVIEW_TYPES.includes(file.type)) {
      setError("Use a JPG, PNG, or WebP image. SVG is not supported.");
      return;
    }

    if (file.size > MAX_PREVIEW_BYTES) {
      setError("The image must be 5 MB or smaller.");
      return;
    }

    setPreviewFile(file);
  }

  /** Uploads a preview through the existing server-side endpoint. */
  async function uploadPreview(id: string, file: File): Promise<boolean> {
    const body = new FormData();
    body.append("preview", file);

    try {
      const response = await fetch(`/api/admin/templates/${id}/preview`, {
        method: "POST",
        credentials: "same-origin",
        body,
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const category = draftCategory();

    if (category === null) {
      setError(
        draft.addingCategory
          ? "Enter a name for the new category."
          : "Choose a category.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    setWarning("");

    const editingId = editing?.id;
    const body = {
      name: draft.name,
      category,
      sectionType: draft.sectionType,
      style: draft.style.trim() === "" ? null : draft.style,
      // Sent exactly as typed; only blanks become null.
      shortcode: draft.shortcode,
      cssCode: draft.cssCode.trim() === "" ? null : draft.cssCode,
      status: draft.status,
    };

    try {
      const response = await fetch(
        editingId ? `/api/admin/templates/${editingId}` : "/api/admin/templates",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setError(
          editingId ? "Could not update template." : "Could not create template.",
        );
        return;
      }

      const saved = payload.template as TemplateDetail;
      const file = previewFile;

      if (file === null) {
        if (editingId) {
          setEditing(saved);
          setNotice("Template updated successfully.");
        } else {
          // The whole form empties, so the next template starts clean.
          resetForm();
          setNotice("Template created successfully.");
        }

        await reload();
        return;
      }

      const uploaded = await uploadPreview(saved.id, file);

      if (editingId) {
        setEditing(saved);
        setPreviewFile(null);
      } else {
        resetForm();
      }

      if (uploaded) {
        setNotice(
          editingId
            ? "Template and preview updated successfully."
            : "Template and preview created successfully.",
        );
      } else {
        // The template exists and must stay: only the image failed.
        setWarning(
          editingId
            ? "Template updated, but the preview image could not be uploaded. You can add it from the template card."
            : "Template created, but the preview image could not be uploaded. You can add the preview from the template card.",
        );
      }

      await reload();
    } catch {
      setError(
        editingId ? "Could not update template." : "Could not create template.",
      );
    } finally {
      setSaving(false);
    }
  }

  /** Publishing, unpublishing, and archiving are one operation on `status`. */
  async function setStatus(id: string, status: SectionStatus, action: string) {
    setError("");
    setNotice("");
    setWarning("");
    setPending(`${id}:${action}`);

    try {
      const response = await fetch(`/api/admin/templates/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        setError("Could not update template.");
        return;
      }

      setNotice(`Template moved to ${statusLabels[status]}.`);
      await reload();
    } catch {
      setError("Could not update template.");
    } finally {
      setPending("");
    }
  }

  async function replacePreview(id: string, file: File) {
    setError("");
    setNotice("");
    setWarning("");

    if (!PREVIEW_TYPES.includes(file.type) || file.size > MAX_PREVIEW_BYTES) {
      setError("Use a JPG, PNG, or WebP image no larger than 5 MB.");
      return;
    }

    setPending(`${id}:preview`);

    if (await uploadPreview(id, file)) {
      setNotice("Preview updated.");
      await reload();
    } else {
      setError("Could not upload preview.");
    }

    setPending("");
  }

  const busy = saving || pending !== "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startCreate}
            disabled={busy}
            className={`${primary} ${lg}`}
          >
            New template
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || busy}
            className={`${neutral} ${lg}`}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <AdminSignOut />
      </div>

      {error !== "" ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {warning !== "" ? (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {warning}
        </p>
      ) : null}
      {notice !== "" ? (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <form
        onSubmit={save}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-base font-semibold">
          {editing ? `Editing: ${editing.name}` : "Create a template"}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tpl-name" className="block text-sm font-medium">
              Name
            </label>
            <input
              id="tpl-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
              maxLength={200}
              className={field}
            />
          </div>

          <div>
            <label htmlFor="tpl-category" className="block text-sm font-medium">
              Category
            </label>
            <select
              id="tpl-category"
              value={draft.addingCategory ? ADD_CATEGORY : draft.category}
              onChange={(e) => chooseCategory(e.target.value)}
              className={field}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              <option value={ADD_CATEGORY}>+ Add new category</option>
            </select>

            {draft.addingCategory ? (
              <div className="mt-2">
                <label
                  htmlFor="tpl-new-category"
                  className="block text-sm font-medium"
                >
                  New category name
                </label>
                <input
                  id="tpl-new-category"
                  value={draft.newCategory}
                  onChange={(e) =>
                    setDraft({ ...draft, newCategory: e.target.value })
                  }
                  maxLength={CATEGORY_MAX_LENGTH}
                  autoFocus
                  className={field}
                />
                {draft.newCategory !== "" &&
                !isUsableCategoryName(draft.newCategory) ? (
                  <p className="mt-1 text-xs text-red-700">
                    Enter a name of 1 to {CATEGORY_MAX_LENGTH} characters.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <label htmlFor="tpl-type" className="block text-sm font-medium">
              Section type
            </label>
            <input
              id="tpl-type"
              value={draft.sectionType}
              onChange={(e) => setDraft({ ...draft, sectionType: e.target.value })}
              required
              maxLength={100}
              className={field}
            />
          </div>

          <div>
            <label htmlFor="tpl-style" className="block text-sm font-medium">
              Style (optional)
            </label>
            <input
              id="tpl-style"
              value={draft.style}
              onChange={(e) => setDraft({ ...draft, style: e.target.value })}
              maxLength={100}
              className={field}
            />
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="block text-sm font-medium">Preview Image</legend>

          {previewUrl === "" ? (
            <label
              htmlFor="tpl-preview"
              className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25"
            >
              <span className="text-sm font-medium text-slate-700">
                Choose an image
              </span>
              <span className="mt-1 text-xs text-slate-500">
                JPG, PNG or WebP · maximum 5 MB
              </span>
              <input
                id="tpl-preview"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  choosePreview(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
          ) : (
            <div className="mt-1 rounded-xl border border-slate-200 p-3">
              {/* Natural proportions: a preview is never cropped. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt=""
                className="block w-full max-w-full rounded-lg border border-slate-200"
              />
              <p className="mt-2 truncate text-xs text-slate-600">
                {previewFile?.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <label className={`${neutral} ${sm}`}>
                  Replace
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      choosePreview(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className={`${neutral} ${sm}`}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </fieldset>

        <div className="mt-4">
          <label htmlFor="tpl-shortcode" className="block text-sm font-medium">
            Flatsome shortcode
          </label>
          <textarea
            id="tpl-shortcode"
            value={draft.shortcode}
            onChange={(e) => setDraft({ ...draft, shortcode: e.target.value })}
            required
            rows={8}
            spellCheck={false}
            className={mono}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="tpl-css" className="block text-sm font-medium">
            CSS (optional)
          </label>
          <textarea
            id="tpl-css"
            value={draft.cssCode}
            onChange={(e) => setDraft({ ...draft, cssCode: e.target.value })}
            rows={6}
            spellCheck={false}
            className={mono}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="tpl-status" className="block text-sm font-medium">
            Status
          </label>
          <select
            id="tpl-status"
            value={draft.status}
            onChange={(e) =>
              setDraft({ ...draft, status: e.target.value as SectionStatus })
            }
            className={field}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className={`${primary} ${lg}`}>
            {saving
              ? editing
                ? "Saving…"
                : "Creating…"
              : editing
                ? "Save changes"
                : "Create Template"}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={startCreate}
              disabled={saving}
              className={`${neutral} ${lg}`}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-base font-semibold">
          Library {loading ? "" : `(${templates.length})`}
        </h2>

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold">No templates yet.</p>
            <p className="mt-1 text-sm text-slate-600">
              Create one with the form above.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {templates.map((template) => {
              const key = (action: string) => pending === `${template.id}:${action}`;
              const anyPending = pending.startsWith(`${template.id}:`);

              return (
                <li
                  key={template.id}
                  className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  {template.previewScreenshotUrl ? (
                    /* Natural proportions: the screenshot sets its own height. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={template.previewScreenshotUrl}
                      alt=""
                      className="mb-3 block w-full max-w-full rounded-lg border border-slate-200"
                    />
                  ) : (
                    <div className="mb-3 flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs uppercase tracking-wide text-slate-400">
                      No preview
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold break-words">
                      {template.name}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[template.status]}`}
                    >
                      {statusLabels[template.status]}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-600 break-words">
                    {template.category} · {template.sectionType}
                    {template.style ? ` · ${template.style}` : ""}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void startEdit(template.id)}
                      disabled={anyPending || saving}
                      className={`${neutral} ${sm}`}
                    >
                      {key("edit") ? "Opening…" : "Edit"}
                    </button>

                    {template.status !== "published" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void setStatus(template.id, "published", "publish")
                        }
                        disabled={anyPending || saving}
                        className={`${success} ${sm}`}
                      >
                        {key("publish") ? "Publishing…" : "Publish"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          void setStatus(template.id, "draft", "unpublish")
                        }
                        disabled={anyPending || saving}
                        className={`${neutral} ${sm}`}
                      >
                        {key("unpublish") ? "Unpublishing…" : "Unpublish"}
                      </button>
                    )}

                    {template.status !== "archived" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void setStatus(template.id, "archived", "archive")
                        }
                        disabled={anyPending || saving}
                        className={`${warn} ${sm}`}
                      >
                        {key("archive") ? "Archiving…" : "Archive"}
                      </button>
                    ) : null}

                    <label
                      className={`${neutral} ${sm} ${
                        anyPending || saving
                          ? "pointer-events-none cursor-not-allowed opacity-55"
                          : ""
                      }`}
                    >
                      {key("preview")
                        ? "Uploading…"
                        : template.previewScreenshotUrl
                          ? "Change preview"
                          : "Add preview"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={anyPending || saving}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";

                          if (file) {
                            void replacePreview(template.id, file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
