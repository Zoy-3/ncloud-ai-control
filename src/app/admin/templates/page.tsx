import type { Metadata } from "next";

import { AdminSignIn } from "@/components/admin/admin-sign-in";
import { TemplateManager } from "@/components/admin/template-manager";
import { adminManagerEnabled, hasAdminSession } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Template Manager",
  description: "Manage the central NCloud template library.",
};

/**
 * The NCloud template manager.
 *
 * The session is checked on the server, so an unauthenticated visitor is never
 * sent the manager at all. Nothing on this page receives the admin secret or
 * any Supabase credential: the browser only ever calls this app's own admin
 * API, which re-checks the session on every request.
 */
export default async function AdminTemplatesPage() {
  const enabled = adminManagerEnabled();
  const signedIn = enabled && (await hasAdminSession());

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            NCloud
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Template Manager
          </h1>
          <p className="mt-2 text-slate-600">
            The central template library shared by every connected WordPress site.
          </p>
        </header>

        {!enabled ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-base font-semibold text-amber-900">
              The template manager is switched off
            </h2>
            <p className="mt-2 text-sm text-amber-900">
              Set <code className="font-mono">NCLOUD_ADMIN_SECRET</code> in the
              server environment and redeploy to enable it. No administration
              route will operate until it is set.
            </p>
          </div>
        ) : signedIn ? (
          <TemplateManager />
        ) : (
          <AdminSignIn />
        )}
      </div>
    </main>
  );
}
