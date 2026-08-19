"use client";

import { useState } from "react";

/**
 * Administrator sign-in.
 *
 * The secret is sent in a POST body, never in a URL or a query string, and is
 * held only in local component state until the request completes. What comes
 * back is an HttpOnly cookie, so nothing durable is exposed to any script.
 */
export function AdminSignIn() {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });

      if (!response.ok) {
        setError("Sign-in failed. Check the administrator secret.");
        setBusy(false);
        return;
      }

      setSecret("");
      window.location.reload();
    } catch {
      setError("Sign-in could not be completed.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-base font-semibold">Administrator sign-in</h2>
      <p className="mt-1 text-sm text-slate-600">
        This area manages the shared template library. WordPress site tokens are
        not accepted here.
      </p>

      <label
        htmlFor="ncloud-admin-secret"
        className="mt-5 block text-sm font-medium"
      >
        Administrator secret
      </label>
      <input
        id="ncloud-admin-secret"
        type="password"
        autoComplete="current-password"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        required
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      {error !== "" ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
