"use client";

import { useMemo, useState } from "react";

import { categoryKey, collectCategories } from "@/lib/sections/categories";
import type { SectionStatus } from "@/lib/supabase/database.types";

type LibrarySection = {
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

function formatDate(value: string): string {
  const when = new Date(value);

  return isNaN(when.getTime()) ? "—" : when.toLocaleDateString();
}

/**
 * The central template library, as it actually exists in the database.
 *
 * Every card here is a real `sections` row. Category filters are derived from
 * the records that came back, so a new category appears the moment a template
 * uses one and no list is hard-coded anywhere.
 *
 * Only fields the table really has are shown. Nothing is invented to fill space.
 */
export function SectionLibraryLive({
  sections,
}: {
  sections: readonly LibrarySection[];
}) {
  const [activeCategory, setActiveCategory] = useState("");
  const [activeStatus, setActiveStatus] = useState("");

  const categories = useMemo(() => collectCategories(sections), [sections]);

  const visible = useMemo(
    () =>
      sections.filter((section) => {
        if (
          activeCategory !== "" &&
          categoryKey(section.category) !== categoryKey(activeCategory)
        ) {
          return false;
        }

        return activeStatus === "" || section.status === activeStatus;
      }),
    [sections, activeCategory, activeStatus],
  );

  const filterButton = (selected: boolean) =>
    `cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
      selected
        ? "bg-blue-600 text-white"
        : "border border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
    }`;

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-semibold">No templates yet.</p>
        <p className="mt-1 text-sm text-slate-600">
          Templates created in Template Manager appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <button
          type="button"
          onClick={() => setActiveCategory("")}
          aria-pressed={activeCategory === ""}
          className={filterButton(activeCategory === "")}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            aria-pressed={categoryKey(activeCategory) === categoryKey(category)}
            className={filterButton(
              categoryKey(activeCategory) === categoryKey(category),
            )}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <button
          type="button"
          onClick={() => setActiveStatus("")}
          aria-pressed={activeStatus === ""}
          className={filterButton(activeStatus === "")}
        >
          All statuses
        </button>
        {(["published", "draft", "archived"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveStatus(status)}
            aria-pressed={activeStatus === status}
            className={filterButton(activeStatus === status)}
          >
            {statusLabels[status]}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-600" role="status">
        {visible.length} of {sections.length} template
        {sections.length === 1 ? "" : "s"}
      </p>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold">No templates match this filter.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((section) => (
            <li
              key={section.id}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              {section.previewScreenshotUrl ? (
                /* A plain img keeps the screenshot's natural proportions at
                   width 100% / height auto; sources are Storage URLs. */
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

              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold break-words">
                  {section.name}
                </h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[section.status]}`}
                >
                  {statusLabels[section.status]}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-600 break-words">
                {section.category} · {section.sectionType}
                {section.style ? ` · ${section.style}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Updated {formatDate(section.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
