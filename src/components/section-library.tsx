"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { SiteCategory } from "@/data/site-categories";
import type { Section } from "@/types/section";

interface SectionLibraryProps {
  categories: readonly SiteCategory[];
  sections: readonly Section[];
}

function displayValue(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function SectionLibrary({ categories, sections }: SectionLibraryProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.slug, category.name])),
    [categories],
  );

  const visibleSections = useMemo(
    () =>
      activeCategory === "all"
        ? sections
        : sections.filter((section) => section.category === activeCategory),
    [activeCategory, sections],
  );

  useEffect(() => {
    if (!selectedSection) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedSection(null);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedSection]);

  return (
    <>
      <div className="mb-7 flex flex-wrap gap-2" aria-label="Filter sections by category">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          aria-pressed={activeCategory === "all"}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            activeCategory === "all"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.slug)}
            aria-pressed={activeCategory === category.slug}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === category.slug
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <p className="mb-4 text-sm text-slate-500" aria-live="polite">
        Showing {visibleSections.length} {visibleSections.length === 1 ? "section" : "sections"}
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        {visibleSections.map((section) => (
          <article
            key={section.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-0.5"
          >
            <div className="relative aspect-video overflow-hidden border-b border-slate-200 bg-slate-100">
              <Image
                src={section.previewImage}
                alt={`${section.name} layout preview`}
                fill
                sizes="(max-width: 1280px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            <div className="p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                    {categoryNames.get(section.category)}
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                    {section.name}
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Published
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-slate-400">Category</dt>
                  <dd className="mt-1 font-medium text-slate-700">
                    {categoryNames.get(section.category)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Section type</dt>
                  <dd className="mt-1 font-medium text-slate-700">
                    {displayValue(section.sectionType)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Style</dt>
                  <dd className="mt-1 font-medium text-slate-700">
                    {displayValue(section.style)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Layout</dt>
                  <dd className="mt-1 font-medium text-slate-700">
                    {displayValue(section.layout)}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex items-center justify-between gap-4">
                <p className="line-clamp-2 text-sm leading-6 text-slate-500">
                  {section.description}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedSection(section)}
                  className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  View Code
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {selectedSection ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="section-code-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setSelectedSection(null)}
            aria-label="Close section code"
          />
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                  Development shortcode preview
                </p>
                <h2
                  id="section-code-title"
                  className="mt-1 text-2xl font-semibold tracking-tight text-slate-950"
                >
                  {selectedSection.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSection(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-slate-400">Category</dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {categoryNames.get(selectedSection.category)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Section Type</dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {displayValue(selectedSection.sectionType)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Style</dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {displayValue(selectedSection.style)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Layout</dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {displayValue(selectedSection.layout)}
                  </dd>
                </div>
              </dl>

              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">Tags</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedSection.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Shortcode</h3>
                <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200 sm:p-5">
                  <code>{selectedSection.shortcode}</code>
                </pre>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  The empty image element is an intentional layout placeholder. Production
                  image syntax will be captured from the installed Flatsome version later.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
