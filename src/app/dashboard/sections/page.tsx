import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { SectionLibrary } from "@/components/section-library";
import { sampleSections } from "@/data/sample-sections";
import { siteCategories } from "@/data/site-categories";

export const metadata: Metadata = {
  title: "Section Library",
  description: "Browse reusable Flatsome UX Builder layouts.",
};

export default function SectionsPage() {
  return (
    <DashboardShell activeItem="Sections">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Reusable layouts
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Section Library
          </h1>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            Browse reusable Flatsome UX Builder layouts.
          </p>
        </div>

        <SectionLibrary categories={siteCategories} sections={sampleSections} />
      </div>
    </DashboardShell>
  );
}
