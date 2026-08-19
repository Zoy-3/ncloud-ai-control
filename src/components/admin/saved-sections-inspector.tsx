"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminSignOut } from "@/components/admin/admin-sign-out";

type SavedSectionSite = { id: string; name: string; domain: string } | null;

type SavedSectionListItem = {
  id: string;
  name: string;
  site: SavedSectionSite;
  previewScreenshotUrl: string | null;
  hasCss: boolean;
  createdAt: string;
  updatedAt: string;
};

type SavedSectionDetail = SavedSectionListItem & {
  shortcode: string;
  cssCode: string | null;
};

type LoadResult =
  | { ok: true; sections: SavedSectionListItem[] }
  | { ok: false };

async function fetchSavedSections(): Promise<LoadResult> {
  try {
    const response = await fetch("/api/admin/saved-sections", {
      credentials: "same-origin",
    });
    const payload = await response.json();

    if (!response.ok || !payload?.success) {
      return { ok: false };
    }

    return { ok: true, sections: payload.sections as SavedSectionListItem[] };
  } catch {
    return { ok: false };
  }
}

function formatDate(value: string): string {
  const when = new Date(value);

  return isNaN(when.getTime()) ? "—" : when.toLocaleDateString();
}

const codeArea =
  "mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-relaxed";

/**
 * Central inspection of saved sections.
 *
 * The shortcode and CSS are shown inside read-only textareas, so they are
 * displayed as text and never parsed as markup. The stylesheet is never applied
 * to this page: it is inspected, not used.
 */
export function SavedSectionsInspector() {
  const [sections, setSections] = useState<SavedSectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<SavedSectionDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const applyResult = useCallback((result: LoadResult) => {
    if (result.ok) {
      setError("");
      setSections(result.sections);
    } else {
      setError("Saved sections could not be loaded.");
    }

    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    void fetchSavedSections().then(applyResult);
  }, [applyResult]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await fetchSavedSections();

      if (active) {
        applyResult(result);
      }
    })();

    return () => {
      active = false;
    };
  }, [applyResult]);

  async function viewDetails(id: string) {
    setDetailBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/saved-sections/${id}`, {
        credentials: "same-origin",
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setError("That saved section could not be opened.");
        return;
      }

      setDetail(payload.section as SavedSectionDetail);
    } catch {
      setError("That saved section could not be opened.");
    } finally {
      setDetailBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
        >
          Refresh
        </button>
        <AdminSignOut />
      </div>

      {error !== "" ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {detail ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold break-words">{detail.name}</h2>
              <p className="mt-1 text-sm text-slate-600 break-words">
                {detail.site
                  ? `${detail.site.name} · ${detail.site.domain}`
                  : "Owning site unavailable"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Created {formatDate(detail.createdAt)} · Updated{" "}
                {formatDate(detail.updatedAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              Close
            </button>
          </div>

          {detail.previewScreenshotUrl ? (
            /* A plain img keeps the screenshot's natural proportions at
               width 100% / height auto; the sources are Supabase Storage URLs. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detail.previewScreenshotUrl}
              alt=""
              className="mt-4 block w-full max-w-full rounded-lg border border-slate-200"
            />
          ) : null}

          <label className="mt-4 block text-sm font-medium">
            Flatsome shortcode
            <textarea
              readOnly
              value={detail.shortcode}
              rows={10}
              spellCheck={false}
              className={codeArea}
            />
          </label>

          <label className="mt-4 block text-sm font-medium">
            CSS
            <textarea
              readOnly
              value={detail.cssCode ?? "This section stores no CSS."}
              rows={6}
              spellCheck={false}
              className={codeArea}
            />
          </label>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-base font-semibold">
          Saved sections {loading ? "" : `(${sections.length})`}
        </h2>

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold">No saved sections yet.</p>
            <p className="mt-1 text-sm text-slate-600">
              Sections saved from a connected WordPress site appear here.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {sections.map((section) => (
              <li
                key={section.id}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                {section.previewScreenshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={section.previewScreenshotUrl}
                    alt=""
                    className="mb-3 block w-full max-w-full rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="mb-3 flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs uppercase tracking-wide text-slate-400">
                    No preview
                  </div>
                )}

                <h3 className="text-sm font-semibold break-words">{section.name}</h3>
                <p className="mt-1 text-xs text-slate-600 break-words">
                  {section.site
                    ? `${section.site.name} · ${section.site.domain}`
                    : "Owning site unavailable"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Created {formatDate(section.createdAt)} · Updated{" "}
                  {formatDate(section.updatedAt)} ·{" "}
                  {section.hasCss ? "Has CSS" : "No CSS"}
                </p>

                <button
                  type="button"
                  onClick={() => void viewDetails(section.id)}
                  disabled={detailBusy}
                  className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                >
                  View Details
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
