import Link from "next/link";

const navigation = [
  { name: "Dashboard", href: "/dashboard", available: true },
  { name: "Sites", href: "/dashboard/sites", available: true },
  { name: "Sections", href: "/dashboard/sections", available: true },
  { name: "Saved Sections", href: "/dashboard/saved-sections", available: true },
  { name: "Template Manager", href: "/admin/templates", available: true },
  { name: "Categories", href: "/dashboard/categories", available: true },
  { name: "Jobs", href: "/dashboard/jobs", available: true },
  { name: "Runner", href: "/dashboard/runner", available: true },
  { name: "Settings", href: "/dashboard/settings", available: true },
] as const;

export interface DashboardRunnerStatus {
  name: string;
  state: "Online" | "Offline" | "Disabled";
}

interface DashboardShellProps {
  activeItem: (typeof navigation)[number]["name"];
  children: React.ReactNode;
  runner?: DashboardRunnerStatus | null;
}

export function DashboardShell({ activeItem, children, runner }: DashboardShellProps) {
  const runnerDot =
    runner?.state === "Online"
      ? "bg-emerald-400"
      : runner?.state === "Disabled"
        ? "bg-amber-400"
        : "bg-slate-500";

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-slate-800">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-base font-bold shadow-lg shadow-blue-950/30">
              N
            </span>
            <div>
              <p className="font-semibold tracking-tight">NCloud AI</p>
              <p className="text-xs text-slate-400">Flatsome control</p>
            </div>
          </div>

          <nav
            aria-label="Primary navigation"
            className="flex gap-1 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:overflow-visible lg:px-4 lg:pb-0"
          >
            {navigation.map((item) => {
              const isActive = item.name === activeItem;
              const classes = `flex min-w-fit items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-500 text-white"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`;

              if (!item.available) {
                return (
                  <span key={item.name} className={`${classes} cursor-default`} aria-disabled="true">
                    {item.name}
                  </span>
                );
              }

              return (
                <Link key={item.name} href={item.href} className={classes}>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto hidden border-t border-slate-800 px-6 py-5 lg:block">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`h-2 w-2 rounded-full ${runnerDot}`} />
              {runner ? `${runner.name}: ${runner.state.toLowerCase()}` : "Runner unavailable"}
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
