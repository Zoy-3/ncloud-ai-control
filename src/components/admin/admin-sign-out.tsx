"use client";

/**
 * Ends the administrator session.
 *
 * `DELETE /api/admin/session` clears the HttpOnly cookie server-side; the page
 * then reloads, and the server-rendered gate shows the sign-in form again.
 */
export function AdminSignOut() {
  async function signOut() {
    try {
      await fetch("/api/admin/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
    } finally {
      window.location.reload();
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
