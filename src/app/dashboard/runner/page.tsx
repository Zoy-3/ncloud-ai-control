import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard-shell";
import { getPrimaryRunnerStatus } from "@/lib/dashboard/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Runner",
  description: "Status of the local AI generation runner.",
};

/**
 * Runner status.
 *
 * Informational only. Nothing here starts, configures, or contacts the runner,
 * and no generation job is created: AI integration is deliberately on hold.
 */
export default async function RunnerPage() {
  const runner = await getPrimaryRunnerStatus();

  return (
    <DashboardShell activeItem="Runner">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Generation
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Runner
          </h1>
          <p className="mt-3 text-base text-slate-600">
            The local worker that will run AI generation once that phase begins.
          </p>
        </header>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-base font-semibold text-amber-900">
            AI generation is currently on hold
          </h2>
          <p className="mt-2 text-sm text-amber-900">
            The template and My Saved libraries do not need the local runner, so
            the whole non-AI product works without it. Create with AI stays a
            placeholder until the generation phase resumes.
          </p>
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">Last known status</h2>

          {runner === null ? (
            <p className="mt-2 text-sm text-slate-600">
              No runner has been registered.
            </p>
          ) : (
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Name</dt>
                <dd className="text-sm font-medium break-words">{runner.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Status</dt>
                <dd className="text-sm font-medium">{runner.status}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Reachable</dt>
                <dd className="text-sm font-medium">
                  {runner.isOnline ? "Online" : "Offline"}
                </dd>
              </div>
            </dl>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
