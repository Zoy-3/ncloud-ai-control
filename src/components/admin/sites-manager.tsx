"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SiteStatus = "active" | "disabled";

type Site = {
  id: string;
  name: string;
  domain: string;
  status: SiteStatus;
  createdAt: string;
  updatedAt: string;
};

type LoadResult = { ok: true; sites: Site[] } | { ok: false };

async function fetchSites(): Promise<LoadResult> {
  try {
    const response = await fetch("/api/admin/sites", {
      credentials: "same-origin",
    });
    const payload = await response.json();

    if (!response.ok || !payload?.success) {
      return { ok: false };
    }

    return { ok: true, sites: payload.sites as Site[] };
  } catch {
    return { ok: false };
  }
}

function formatDate(value: string): string {
  const when = new Date(value);

  return isNaN(when.getTime()) ? "—" : when.toLocaleDateString();
}

const field =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25";

const badges: Record<SiteStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  disabled: "bg-amber-100 text-amber-900",
};

/**
 * Site management.
 *
 * A raw site token exists only in this component's state, only between the
 * response arriving and the dialog being dismissed. It is never written to
 * storage, a cookie, or a URL, and the server never returns it again.
 */
export function SitesManager() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");

  const [issuedToken, setIssuedToken] = useState("");
  const [issuedFor, setIssuedFor] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState<Site | null>(null);

  const tokenDoneRef = useRef<HTMLButtonElement | null>(null);

  const applyResult = useCallback((result: LoadResult) => {
    if (result.ok) {
      setError("");
      setSites(result.sites);
    } else {
      setError("Sites could not be loaded.");
    }

    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    void fetchSites().then(applyResult);
  }, [applyResult]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await fetchSites();

      if (active) {
        applyResult(result);
      }
    })();

    return () => {
      active = false;
    };
  }, [applyResult]);

  useEffect(() => {
    if (issuedToken !== "") {
      tokenDoneRef.current?.focus();
    }
  }, [issuedToken]);

  async function addSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creating) {
      return;
    }

    setCreating(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/sites", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, domain }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setError(payload?.error?.message ?? "The site could not be created.");
        return;
      }

      setName("");
      setDomain("");
      setNotice("Site created. Generate a token to connect it.");
      refresh();
    } catch {
      setError("The site could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function issueToken(site: Site) {
    setBusyId(site.id);
    setError("");
    setNotice("");
    setConfirmRotate(null);

    try {
      const response = await fetch(`/api/admin/sites/${site.id}/token`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setError("The token could not be issued.");
        return;
      }

      setIssuedFor(site.name);
      setIssuedToken(payload.siteToken as string);
      setCopied(false);
      refresh();
    } catch {
      setError("The token could not be issued.");
    } finally {
      setBusyId("");
    }
  }

  async function setStatus(site: Site, status: SiteStatus) {
    setBusyId(site.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/sites/${site.id}/status`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        setError("The site status could not be changed.");
        return;
      }

      setNotice(
        status === "disabled"
          ? "Site disabled. Its token no longer authenticates."
          : "Site enabled.",
      );
      refresh();
    } catch {
      setError("The site status could not be changed.");
    } finally {
      setBusyId("");
    }
  }

  async function copyToken() {
    try {
      if (window.isSecureContext && window.navigator?.clipboard) {
        await window.navigator.clipboard.writeText(issuedToken);
        setCopied(true);
        return;
      }
    } catch {
      // Fall through to the manual field below.
    }

    setCopied(false);
  }

  /** Dismissing the dialog drops the token from memory for good. */
  function dismissToken() {
    setIssuedToken("");
    setIssuedFor("");
    setCopied(false);
  }

  return (
    <div className="space-y-6">
      {issuedToken !== "" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ncloud-token-title"
          className="rounded-xl border border-blue-200 bg-blue-50 p-6"
        >
          <h2 id="ncloud-token-title" className="text-base font-semibold">
            Site token for {issuedFor}
          </h2>
          <p className="mt-1 text-sm text-blue-900">
            This token is shown only once. Save it now.
          </p>

          <label className="mt-4 block text-sm font-medium" htmlFor="ncloud-issued-token">
            Site Token
          </label>
          <input
            id="ncloud-issued-token"
            readOnly
            value={issuedToken}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 w-full rounded-lg border border-blue-300 bg-white px-3 py-2 font-mono text-xs"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyToken()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {copied ? "Copied!" : "Copy Token"}
            </button>
            <button
              ref={tokenDoneRef}
              type="button"
              onClick={dismissToken}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {confirmRotate !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ncloud-rotate-title"
          className="rounded-xl border border-amber-200 bg-amber-50 p-6"
        >
          <h2 id="ncloud-rotate-title" className="text-base font-semibold text-amber-900">
            Rotate token for {confirmRotate.name}?
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            Rotating this token disconnects the WordPress site until the new
            token is saved in Settings → NCloud AI.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void issueToken(confirmRotate)}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Rotate Token
            </button>
            <button
              type="button"
              onClick={() => setConfirmRotate(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error !== "" ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice !== "" ? (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <form
        onSubmit={addSite}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-base font-semibold">Add site</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Site Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={200}
              className={field}
            />
          </label>
          <label className="block text-sm font-medium">
            Domain
            <input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              required
              maxLength={253}
              placeholder="example.com"
              autoCapitalize="none"
              spellCheck={false}
              className={field}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {creating ? "Creating…" : "Add Site"}
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-base font-semibold">
          Connected sites {loading ? "" : `(${sites.length})`}
        </h2>

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : sites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold">No sites yet.</p>
            <p className="mt-1 text-sm text-slate-600">
              Add a site above, then generate its token.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {sites.map((site) => {
              const busy = busyId === site.id;

              return (
                <li
                  key={site.id}
                  className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold break-words">
                      {site.name}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badges[site.status]}`}
                    >
                      {site.status === "active" ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-600 break-words">
                    {site.domain}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Added {formatDate(site.createdAt)}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmRotate(site)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                    >
                      {busy ? "Generating…" : "Generate / Rotate Token"}
                    </button>
                    {site.status === "active" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(site, "disabled")}
                        className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-60"
                      >
                        {busy ? "Disabling…" : "Disable"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(site, "active")}
                        className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-60"
                      >
                        {busy ? "Enabling…" : "Enable"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
