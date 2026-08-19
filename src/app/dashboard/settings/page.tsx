import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireSignedInAdmin } from "@/lib/auth/guard";
import { SECTION_PREVIEW_BUCKET } from "@/lib/supabase/storage-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  description: "Account and system settings for the NCloud control app.",
};

function formatDate(value: string | null): string {
  if (value === null) {
    return "Never";
  }

  const when = new Date(value);

  return isNaN(when.getTime()) ? "Unknown" : when.toLocaleString();
}

/**
 * Account and system settings.
 *
 * Everything shown here is either the administrator's own account metadata or a
 * statement about how the system is configured. No secret, key, token, token
 * hash, or password hash is read or displayed: the values are described, never
 * printed.
 */
export default async function SettingsPage() {
  const user = await requireSignedInAdmin();

  return (
    <DashboardShell activeItem="Settings">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Configuration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Settings
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Your account and the current state of this NCloud deployment.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">Account</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Username</dt>
              <dd className="text-sm font-medium break-words">{user.username}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Last sign-in</dt>
              <dd className="text-sm font-medium">
                {formatDate(user.lastLoginAt)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold">Change password</h2>
          <ChangePasswordForm requireCurrent redirectTo={null} />
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">System</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Control API</dt>
              <dd className="text-sm font-medium">Online</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Admin authentication</dt>
              <dd className="text-sm font-medium">
                Username and password, session cookie signed server-side
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Preview storage bucket</dt>
              <dd className="text-sm font-medium break-words">
                {SECTION_PREVIEW_BUCKET}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">AI generation</dt>
              <dd className="text-sm font-medium">On hold</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">Security</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              Sessions last 8 hours and are carried in an HttpOnly, SameSite
              cookie that is Secure in production.
            </li>
            <li>
              Passwords are stored only as salted scrypt hashes. No plaintext
              password is ever written to the database or to a log.
            </li>
            <li>
              Repeated failed sign-ins are throttled using shared state in the
              database, so the limit holds across every serverless instance.
            </li>
            <li>
              Site tokens are stored only as SHA-256 hashes and are shown once,
              when generated or rotated.
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            No secret, key, token, or hash is displayed anywhere in this
            application.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
