"use client";

import { useState } from "react";

const field =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25";

/**
 * Administrator sign-in.
 *
 * The password is held only in component state until the request completes and
 * is never placed in a URL, in storage, or in a log. What comes back is an
 * HttpOnly cookie, so nothing durable is exposed to any script.
 */
export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // A second submit while one is in flight is ignored.
    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setError(payload?.error?.message ?? "Incorrect username or password.");
        setPassword("");
        setBusy(false);
        return;
      }

      setPassword("");
      window.location.href = payload.mustChangePassword
        ? "/change-password"
        : "/dashboard";
    } catch {
      setError("Sign-in could not be completed.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">NCloud administrator access.</p>

      <label htmlFor="ncloud-username" className="mt-5 block text-sm font-medium">
        Username
      </label>
      <input
        id="ncloud-username"
        name="username"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        required
        className={field}
      />

      <label htmlFor="ncloud-password" className="mt-4 block text-sm font-medium">
        Password
      </label>
      <input
        id="ncloud-password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        className={field}
      />

      {error !== "" ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
