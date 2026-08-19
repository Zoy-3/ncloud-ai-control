import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { adminManagerEnabled, readCurrentAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the NCloud control application.",
};

/**
 * The Control App sign-in screen.
 *
 * Somebody already signed in is sent straight on, so the form is never the
 * destination for an authenticated session.
 */
export default async function LoginPage() {
  const user = await readCurrentAdmin();

  if (user !== null) {
    redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-base font-bold text-white shadow-lg shadow-blue-600/25">
            N
          </span>
          <div>
            <p className="font-semibold tracking-tight">NCloud AI</p>
            <p className="text-xs text-slate-500">Flatsome control</p>
          </div>
        </div>

        {adminManagerEnabled() ? (
          <LoginForm />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h1 className="text-base font-semibold text-amber-900">
              Sign-in is not configured
            </h1>
            <p className="mt-2 text-sm text-amber-900">
              Set <code className="font-mono">NCLOUD_ADMIN_SECRET</code> in the
              server environment and redeploy. No sign-in is possible until it
              is set.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
