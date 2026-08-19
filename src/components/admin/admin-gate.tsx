import Link from "next/link";

import { AdminSignIn } from "@/components/admin/admin-sign-in";
import { adminManagerEnabled, hasAdminSession } from "@/lib/auth/admin";

type AdminGateProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

/**
 * Wraps an administrator-only page.
 *
 * The session is checked on the server, so an unauthenticated visitor is never
 * sent the page's contents at all. Signing in re-renders the page that was
 * originally requested, which is why no redirect target has to travel in the
 * URL: there is nothing to redirect to and nothing to tamper with.
 */
export async function AdminGate({
  title,
  description,
  children,
}: AdminGateProps) {
  const enabled = adminManagerEnabled();
  const signedIn = enabled && (await hasAdminSession());

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to dashboard
          </Link>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            NCloud
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-slate-600">{description}</p>
        </header>

        {!enabled ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-base font-semibold text-amber-900">
              Administration is switched off
            </h2>
            <p className="mt-2 text-sm text-amber-900">
              Set <code className="font-mono">NCLOUD_ADMIN_SECRET</code> in the
              server environment and redeploy to enable it. No administration
              route will operate until it is set.
            </p>
          </div>
        ) : signedIn ? (
          children
        ) : (
          <AdminSignIn />
        )}
      </div>
    </main>
  );
}
