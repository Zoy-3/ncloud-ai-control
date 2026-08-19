import Link from "next/link";

import { AdminSignOut } from "@/components/admin/admin-sign-out";

type AdminGateProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

/**
 * Chrome for an administrator page.
 *
 * Authentication is not decided here: the `/admin` and `/dashboard` layouts
 * already refuse the request server-side before any of this renders. This only
 * supplies the shared heading, the way back to the dashboard, and sign-out.
 */
export function AdminGate({ title, description, children }: AdminGateProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              ← Back to dashboard
            </Link>
            <AdminSignOut />
          </div>

          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            NCloud
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-slate-600">{description}</p>
        </header>

        {children}
      </div>
    </main>
  );
}
