import Link from "next/link";
import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard-shell";
import { listTemplateCategories } from "@/lib/dashboard/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categories",
  description: "Categories in use across the central template library.",
};

/**
 * Categories in use across the central template library.
 *
 * Derived from the templates themselves, never hard-coded: a category appears
 * here as soon as a template uses it and disappears when none do. The WordPress
 * plugin derives its filter the same way but from published templates only,
 * which is why a category with no published template does not appear there yet.
 */
export default async function CategoriesPage() {
  const categories = await listTemplateCategories();

  return (
    <DashboardShell activeItem="Categories">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Library
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Categories
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Every category currently used by a central template. These are read
            from the templates themselves, so assigning a new category in{" "}
            <Link
              href="/admin/templates"
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Template Manager
            </Link>{" "}
            is all it takes to create one.
          </p>
        </header>

        {categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold">No categories yet.</p>
            <p className="mt-1 text-sm text-slate-600">
              A category appears once a template is assigned to it.
            </p>
          </div>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <li
                  key={category.name}
                  className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h2 className="text-base font-semibold break-words">
                    {category.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {category.total} template{category.total === 1 ? "" : "s"}
                  </p>

                  <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <div className="flex gap-1">
                      <dt className="text-slate-500">Published</dt>
                      <dd className="font-medium text-emerald-700">
                        {category.published}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-slate-500">Draft</dt>
                      <dd className="font-medium text-slate-900">
                        {category.draft}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-slate-500">Archived</dt>
                      <dd className="font-medium text-amber-800">
                        {category.archived}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-sm text-slate-600">
              A connected site&rsquo;s category filter lists only categories that
              have at least one <strong>published</strong> template, because that
              is all a site can see.
            </p>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
