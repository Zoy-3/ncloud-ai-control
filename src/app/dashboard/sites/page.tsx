import type { Metadata } from "next";

import { SitesManager } from "@/components/admin/sites-manager";
import { DashboardShell } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sites",
  description: "WordPress sites connected to NCloud.",
};

/**
 * Connected WordPress sites.
 *
 * Site tokens are stored only as SHA-256 hashes. A raw token exists only in the
 * response that issues it and is never read back, so nothing on this page can
 * display an existing token.
 */
export default function SitesPage() {
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
            Each WordPress site authenticates with its own token. Add a site,
            generate its token, then paste that token into the site&rsquo;s
            Settings → NCloud AI screen and use Test Connection.
          </p>
        </header>

        <SitesManager />
      </div>
    </DashboardShell>
  );
}
