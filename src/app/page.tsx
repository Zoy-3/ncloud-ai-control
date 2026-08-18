import { DashboardShell } from "@/components/dashboard-shell";

const summaryCards = [
  {
    label: "Connected Sites",
    value: "0",
    detail: "WordPress websites",
    accent: "bg-blue-500",
  },
  {
    label: "Saved Sections",
    value: "4",
    detail: "Published layouts",
    accent: "bg-violet-500",
  },
  {
    label: "Pending Jobs",
    value: "0",
    detail: "Waiting for a runner",
    accent: "bg-amber-500",
  },
  {
    label: "AI Runner",
    value: "Offline",
    detail: "No runner connected",
    accent: "bg-slate-400",
  },
] as const;

export default function Home() {
  return (
    <DashboardShell activeItem="Dashboard">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 flex flex-col gap-3 border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            NCloud Flatsome AI
          </h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
            Central control system for Flatsome AI generation, reusable sections,
            connected WordPress websites and Codex runners.
          </p>
        </div>

        <section aria-labelledby="overview-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="overview-heading" className="text-lg font-semibold text-slate-900">
              Overview
            </h2>
            <span className="text-sm text-slate-500">Local development data</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <article
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">{card.label}</p>
                  <span className={`h-2.5 w-2.5 rounded-full ${card.accent}`} />
                </div>
                <p className="text-3xl font-semibold tracking-tight text-slate-950">
                  {card.value}
                </p>
                <p className="mt-2 text-sm text-slate-500">{card.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/70 p-6">
          <p className="text-sm font-semibold text-blue-900">Phase one foundation</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-800/80">
            The local sample library is ready for browsing. Site connections, jobs,
            generation, and runner management remain intentionally inactive in this phase.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
