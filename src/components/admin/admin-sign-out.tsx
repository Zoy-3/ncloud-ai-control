"use client";

import { useRouter } from "next/navigation";

/**
 * Ends the administrator session.
 *
 * One logout for the whole application: Template Manager no longer has an
 * authentication system of its own. The cookie is cleared server-side, then
 * `refresh()` re-runs the server components so the new signed-out state is what
 * renders.
 */
export function AdminSignOut() {
  const router = useRouter();

  async function signOut() {
    try {
      await fetch("/api/auth/logout", {
        method: "DELETE",
        credentials: "same-origin",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
    >
      Sign Out
    </button>
  );
}
