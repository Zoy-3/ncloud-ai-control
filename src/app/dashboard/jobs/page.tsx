import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import {
  getPrimaryRunnerStatus,
  listRecentJobs,
  type RecentJobDto,
} from "@/lib/dashboard/data";

export const metadata: Metadata = {
  title: "Jobs",
  description: "Inspect the internal NCloud development job queue.",
};

export const dynamic = "force-dynamic";

const statusClasses: Record<RecentJobDto["status"], string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  processing: "bg-blue-50 text-blue-700 ring-blue-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  failed: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

function formatStatus(status: RecentJobDto["status"]): string {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function formatTimestamp(value: string | null): string {
  return value === null ? "—" : new Date(value).toLocaleString();
}

export default async function JobsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const [jobs, runner] = await Promise.all([
    listRecentJobs(100),
    getPrimaryRunnerStatus(),
  ]);
  const runnerState =
    runner?.status === "disabled"
      ? "Disabled"
      : runner?.isOnline
        ? "Online"
        : "Offline";

  return (
    <DashboardShell
      activeItem="Jobs"
      runner={runner ? { name: runner.name, state: runnerState } : null}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Development queue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Jobs
          </h1>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            Recent Supabase jobs and their runner lifecycle. This page is available only
            in development until dashboard authentication is added.
          </p>
        </div>

        <section aria-labelledby="jobs-heading">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="jobs-heading" className="text-lg font-semibold text-slate-900">
              Recent jobs
            </h2>
            <span className="text-sm text-slate-500">{jobs.length} shown</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {jobs.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-500">
                No development jobs have been created yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Job ID</th>
                      <th className="px-5 py-3">Site</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Runner</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3">Started</th>
                      <th className="px-5 py-3">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {jobs.map((job) => (
                      <tr key={job.id} className="align-top hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">
                          {job.id}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          {job.site?.name ?? "Unknown site"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs">
                          {job.type}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses[job.status]}`}
                          >
                            {formatStatus(job.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          {job.runner?.name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-xs">
                          {formatTimestamp(job.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-xs">
                          {formatTimestamp(job.startedAt)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-xs">
                          {formatTimestamp(job.completedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
