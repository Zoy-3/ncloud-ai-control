import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard-shell";
import { listConnectedSites } from "@/lib/dashboard/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sites",
  description: "WordPress sites connected to NCloud.",
};

const badges: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  disabled: "bg-amber-100 text-amber-900",
};

function formatDate(value: string): string {
  const when = new Date(value);

  return isNaN(when.getTime()) ? "—" : when.toLocaleDateString();
}

/**
 * Connected WordPress sites.
 *
 * Only presentable columns are read. No token, token hash, or other credential
 * material is selected, so none can reach this page.
 */
export default async function SitesPage() {
  const sites = await listConnectedSites();

  return (
    <DashboardShell activeItem="Sites">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Connected
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Sites
          </h1>
          <p className="mt-3 text-base text-slate-600">
            WordPress sites authenticated to the Control API with their own site
            token. Tokens are stored only as hashes and are never displayed.
          </p>
        </header>

        {sites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold">No sites connected yet.</p>
            <p className="mt-1 text-sm text-slate-600">
              A site appears here once it has been provisioned a site token.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {sites.map((site) => (
              <li
                key={site.id}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold break-words">
                    {site.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      badges[site.status] ?? "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {site.status}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-600 break-words">
                  {site.domain}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <dt className="text-slate-500">Connected</dt>
                    <dd className="font-medium text-slate-900">
                      {formatDate(site.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Saved sections</dt>
                    <dd className="font-medium text-slate-900">
                      {site.savedSectionCount}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
