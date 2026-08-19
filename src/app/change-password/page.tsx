import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { readCurrentAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Choose a permanent password for this administrator account.",
};

/**
 * The forced first password change.
 *
 * Reaching any other page is impossible while `must_change_password` is set, so
 * the temporary password cannot be left in place.
 */
export default async function ChangePasswordPage() {
  const user = await readCurrentAdmin();

  if (user === null) {
    redirect("/login");
  }

  if (!user.mustChangePassword) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            First sign-in
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Set a new password
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The temporary password stops working once you set your own.
          </p>
        </div>

        <ChangePasswordForm requireCurrent={false} redirectTo="/dashboard" />
      </div>
    </main>
  );
}
