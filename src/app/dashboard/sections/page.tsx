import Link from "next/link";
import type { Metadata } from "next";

import { SectionLibraryLive } from "@/components/admin/section-library-live";
import { DashboardShell } from "@/components/dashboard-shell";
import { listAdminTemplates } from "@/lib/templates/admin-repository";

// Rendered per request so the administrator session is always checked and the
// library always reflects the current database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sections",
  description: "The central NCloud template library.",
};

/**
 * The central template library.
 *
 * Reads the real `sections` table through the same repository the Template
 * Manager uses, so Dashboard → Sections, Template Manager, and the WordPress
 * Templates tab are all views of one set of records. Nothing here is sample
 * data, and only fields the table actually has are displayed.
 *
 * Every status is shown because this is an administrator view. WordPress
 * continues to see published templates only.
 */
export default async function SectionsPage() {
  const sections = await listAdminTemplates();

  return (
    <DashboardShell activeItem="Sections">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Central NCloud library
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Sections
          </h1>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            The shared Flatsome layout library offered to every connected site.
            Sections a site saves for itself live under{" "}
            <Link
              href="/dashboard/saved-sections"
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Saved Sections
            </Link>{" "}
            and are never mixed in here. Connected sites see published templates
            only.
          </p>

          <Link
            href="/admin/templates"
            className="mt-5 inline-flex cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            Manage Templates
          </Link>
        </div>

        <SectionLibraryLive sections={sections} />
      </div>
    </DashboardShell>
  );
}
