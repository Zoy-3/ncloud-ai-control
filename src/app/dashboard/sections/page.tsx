import Link from "next/link";
import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { SectionLibrary } from "@/components/section-library";
import { sampleSections } from "@/data/sample-sections";
import { siteCategories } from "@/data/site-categories";

// Rendered per request so the administrator session is always checked.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sections",
  description: "Browse reusable Flatsome UX Builder layouts.",
};

export default function SectionsPage() {
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
            and are never mixed in here.
          </p>

          <Link
            href="/admin/templates"
            className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Manage Templates
          </Link>
        </div>

        <SectionLibrary categories={siteCategories} sections={sampleSections} />
      </div>
    </DashboardShell>
  );
}
