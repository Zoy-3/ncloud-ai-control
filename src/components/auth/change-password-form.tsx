"use client";

import { useState } from "react";

const field =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25";

type ChangePasswordFormProps = {
  /** Settings requires the current password; the forced first change does not. */
  requireCurrent: boolean;
  /** Where to go afterwards, or null to stay and show a confirmation. */
  redirectTo: string | null;
};

/**
 * Sets a new administrator password.
 *
 * Passwords live only in component state for the length of the request and are
 * cleared afterwards. Nothing is placed in a URL or in storage.
 */
export function ChangePasswordForm({
  requireCurrent,
  redirectTo,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function clear() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) {
      return;
    }

    // Checked here for immediate feedback; the server enforces both rules again.
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          requireCurrent
            ? { currentPassword, newPassword, confirmPassword }
            : { newPassword, confirmPassword },
        ),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setError(
          payload?.error?.message ?? "The password could not be changed.",
        );
        setBusy(false);
        return;
      }

      clear();

      if (redirectTo === null) {
        setDone(true);
        setBusy(false);
        return;
      }

      window.location.href = redirectTo;
    } catch {
      setError("The password could not be changed.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {requireCurrent ? (
        <>
          <label
            htmlFor="ncloud-current-password"
            className="block text-sm font-medium"
          >
            Current Password
          </label>
          <input
            id="ncloud-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            className={field}
          />
        </>
      ) : null}

      <label
        htmlFor="ncloud-new-password"
        className={`block text-sm font-medium ${requireCurrent ? "mt-4" : ""}`}
      >
        New Password
      </label>
      <input
        id="ncloud-new-password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        required
        className={field}
      />
      <p className="mt-1 text-xs text-slate-500">At least 12 characters.</p>

      <label
        htmlFor="ncloud-confirm-password"
        className="mt-4 block text-sm font-medium"
      >
        Confirm New Password
      </label>
      <input
        id="ncloud-confirm-password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
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

      {done ? (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          Password updated.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Set New Password"}
      </button>
    </form>
  );
}
