"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminSignOut } from "@/components/admin/admin-sign-out";
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
  sectionType: string;
  style: string;
  shortcode: string;
  cssCode: string;
  status: SectionStatus;
};

const emptyDraft: Draft = {
  name: "",
  category: "",
  sectionType: "",
  style: "",
  shortcode: "",
  cssCode: "",
  status: "draft",
};

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

const field =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const mono = `${field} font-mono`;

/**
 * The central template manager.
 *
 * Everything here talks to this app's own `/api/admin/*` routes, which re-check
 * the administrator session server-side on every call. No Supabase credential
 * and no admin secret is ever sent to the browser.
 */
export function TemplateManager() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<TemplateDetail | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // Reads the list without touching React state, so both the mount effect and
  // the Refresh button can share it and neither sets state synchronously.
  const applyResult = useCallback((result: LoadResult) => {
    if (result.ok) {
      setError("");
      setTemplates(result.templates);
    } else {
      setError("The template list could not be loaded.");
    }

    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    void fetchTemplates().then(applyResult);
  }, [applyResult]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await fetchTemplates();

      // Every state change happens after the request resolves, and only while
      // the component is still mounted.
      if (active) {
        applyResult(result);
      }
    })();

    return () => {
      active = false;
    };
  }, [applyResult]);

  function startCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setNotice("");
  }

  async function startEdit(id: string) {
    setNotice("");

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
    setDraft({
      name: template.name,
      category: template.category,
      sectionType: template.sectionType,
      style: template.style ?? "",
      shortcode: template.shortcode,
      cssCode: template.cssCode ?? "",
      status: template.status,
    });
  }

  /** Shortcode and CSS are sent exactly as typed; only blanks become null. */
  function draftBody() {
    return {
      name: draft.name,
      category: draft.category,
      sectionType: draft.sectionType,
      style: draft.style.trim() === "" ? null : draft.style,
      shortcode: draft.shortcode,
      cssCode: draft.cssCode.trim() === "" ? null : draft.cssCode,
      status: draft.status,
    };
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const editingId = editing?.id;

    try {
      const response = await fetch(
        editingId ? `/api/admin/templates/${editingId}` : "/api/admin/templates",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftBody()),
        },
      );
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setError(
          editingId
            ? "The template could not be saved."
            : "The template could not be created.",
        );
        return;
      }

      setNotice(editingId ? "Template saved." : "Template created.");
      setEditing(payload.template as TemplateDetail);
      await fetchTemplates().then(applyResult);
    } catch {
      setError("The template could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  /** Publishing, unpublishing, and archiving are one operation on `status`. */
  async function setStatus(id: string, status: SectionStatus) {
    setError("");
    setNotice("");

    const response = await fetch(`/api/admin/templates/${id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setError("The status could not be changed.");
      return;
    }

    setNotice(`Template moved to ${statusLabels[status]}.`);
    await fetchTemplates().then(applyResult);
  }

  async function uploadPreview(id: string, file: File) {
    setError("");
    setNotice("");

    const body = new FormData();
    body.append("preview", file);

    const response = await fetch(`/api/admin/templates/${id}/preview`, {
      method: "POST",
      credentials: "same-origin",
      body,
    });

    if (!response.ok) {
      setError("The preview could not be uploaded. Use a JPG, PNG, or WebP under 5 MB.");
      return;
    }

    setNotice("Preview updated.");
    await fetchTemplates().then(applyResult);
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            New template
          </button>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
          >
            Refresh
          </button>
        </div>
        <AdminSignOut />
      </div>

      {error !== "" ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
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
          <label className="block text-sm font-medium">
            Name
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
              maxLength={200}
              className={field}
            />
          </label>
          <label className="block text-sm font-medium">
            Category
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              required
              maxLength={100}
              className={field}
            />
          </label>
          <label className="block text-sm font-medium">
            Section type
            <input
              value={draft.sectionType}
              onChange={(e) => setDraft({ ...draft, sectionType: e.target.value })}
              required
              maxLength={100}
              className={field}
            />
          </label>
          <label className="block text-sm font-medium">
            Style (optional)
            <input
              value={draft.style}
              onChange={(e) => setDraft({ ...draft, style: e.target.value })}
              maxLength={100}
              className={field}
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium">
          Flatsome shortcode
          <textarea
            value={draft.shortcode}
            onChange={(e) => setDraft({ ...draft, shortcode: e.target.value })}
            required
            rows={8}
            spellCheck={false}
            className={mono}
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          CSS (optional)
          <textarea
            value={draft.cssCode}
            onChange={(e) => setDraft({ ...draft, cssCode: e.target.value })}
            rows={6}
            spellCheck={false}
            className={mono}
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Status
          <select
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
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Create template"}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
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
          <p className="text-sm text-slate-600">No templates yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {templates.map((template) => (
              <li
                key={template.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                {template.previewScreenshotUrl ? (
                  /* A plain img is deliberate: previews must keep their
                     natural proportions at width 100% / height auto, which a
                     fixed-dimension next/image would fight, and the sources
                     are arbitrary Supabase Storage URLs. */
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
                  <h3 className="text-sm font-semibold">{template.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[template.status]}`}
                  >
                    {statusLabels[template.status]}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-600">
                  {template.category} · {template.sectionType}
                  {template.style ? ` · ${template.style}` : ""}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void startEdit(template.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                  >
                    Edit
                  </button>
                  {template.status !== "published" ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(template.id, "published")}
                      className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void setStatus(template.id, "draft")}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                    >
                      Unpublish
                    </button>
                  )}
                  {template.status !== "archived" ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(template.id, "archived")}
                      className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900"
                    >
                      Archive
                    </button>
                  ) : null}
                  <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">
                    {template.previewScreenshotUrl ? "Change preview" : "Add preview"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";

                        if (file) {
                          void uploadPreview(template.id, file);
                        }
                      }}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
