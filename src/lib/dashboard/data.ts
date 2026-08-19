import "server-only";

import { DEVELOPMENT_RUNNER } from "@/lib/development/constants";
import { RUNNER_HEARTBEAT_FRESHNESS_MS } from "@/lib/runners/availability";
import type {
  JobStatus,
  JobType,
  RunnerStatus,
  SiteStatus,
} from "@/lib/supabase/database.types";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type RecentJobDto = {
  id: string;
  site: {
    id: string;
    name: string;
    domain: string;
  } | null;
  type: JobType;
  status: JobStatus;
  runner: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type DashboardCountsDto = {
  sites: number;
  pendingJobs: number;
};

export type PrimaryRunnerStatusDto = {
  id: string;
  name: string;
  status: RunnerStatus;
  isOnline: boolean;
  lastSeenAt: string | null;
};

export async function listRecentJobs(limit = 50): Promise<RecentJobDto[]> {
  const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 50;
  const safeLimit = Math.max(1, Math.min(100, normalizedLimit));
  const supabase = getSupabaseServerClient();
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select(
      "id, site_id, type, status, claimed_by_runner_id, created_at, started_at, completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (jobsError) {
    throwDatabaseError(jobsError);
  }

  const siteIds = [...new Set(jobs.map((job) => job.site_id))];
  const runnerIds = [
    ...new Set(
      jobs.flatMap((job) =>
        job.claimed_by_runner_id === null ? [] : [job.claimed_by_runner_id],
      ),
    ),
  ];

  const [sitesResult, runnersResult] = await Promise.all([
    siteIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("sites").select("id, name, domain").in("id", siteIds),
    runnerIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("runners").select("id, name").in("id", runnerIds),
  ]);

  if (sitesResult.error) {
    throwDatabaseError(sitesResult.error);
  }
  if (runnersResult.error) {
    throwDatabaseError(runnersResult.error);
  }

  const sitesById = new Map(sitesResult.data.map((site) => [site.id, site]));
  const runnersById = new Map(
    runnersResult.data.map((runner) => [runner.id, runner]),
  );

  return jobs.map((job) => ({
    id: job.id,
    site: sitesById.get(job.site_id) ?? null,
    type: job.type,
    status: job.status,
    runner:
      job.claimed_by_runner_id === null
        ? null
        : (runnersById.get(job.claimed_by_runner_id) ?? null),
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  }));
}

export async function getDashboardCounts(): Promise<DashboardCountsDto> {
  const supabase = getSupabaseServerClient();
  const [sitesResult, pendingJobsResult] = await Promise.all([
    supabase.from("sites").select("id", { count: "exact", head: true }),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  if (sitesResult.error) {
    throwDatabaseError(sitesResult.error);
  }
  if (pendingJobsResult.error) {
    throwDatabaseError(pendingJobsResult.error);
  }

  return {
    sites: sitesResult.count ?? 0,
    pendingJobs: pendingJobsResult.count ?? 0,
  };
}

export async function getPrimaryRunnerStatus(
  referenceTime = new Date(),
): Promise<PrimaryRunnerStatusDto | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("runners")
    .select("id, name, status, last_seen_at")
    .eq("name", DEVELOPMENT_RUNNER.name)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error);
  }
  if (data === null) {
    return null;
  }

  const lastSeenMilliseconds =
    data.last_seen_at === null ? Number.NaN : Date.parse(data.last_seen_at);
  const isFresh =
    Number.isFinite(lastSeenMilliseconds) &&
    referenceTime.getTime() - lastSeenMilliseconds <=
      RUNNER_HEARTBEAT_FRESHNESS_MS &&
    referenceTime.getTime() >= lastSeenMilliseconds;
  const isOnline = data.status !== "disabled" && isFresh;
  const status: RunnerStatus =
    data.status === "disabled" ? "disabled" : isOnline ? "online" : "offline";

  return {
    id: data.id,
    name: data.name,
    status,
    isOnline,
    lastSeenAt: data.last_seen_at,
  };
}

export type ConnectedSiteDto = {
  id: string;
  name: string;
  domain: string;
  status: SiteStatus;
  createdAt: string;
  updatedAt: string;
  savedSectionCount: number;
};

/**
 * Connected WordPress sites for the Sites page.
 *
 * Only presentable columns are selected. `site_token_hash` is never read here,
 * so no token material can reach a page even by accident.
 */
export async function listConnectedSites(): Promise<ConnectedSiteDto[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("sites")
    .select("id, name, domain, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throwDatabaseError(error, "Connected sites are temporarily unavailable.");
  }

  // Real counts of what each site has saved. Nothing here is an invented
  // usage statistic: it is a plain count of rows that exist.
  const { data: saved, error: savedError } = await supabase
    .from("saved_sections")
    .select("site_id")
    .limit(1000);

  if (savedError) {
    throwDatabaseError(savedError, "Connected sites are temporarily unavailable.");
  }

  const counts = new Map<string, number>();

  for (const row of saved) {
    counts.set(row.site_id, (counts.get(row.site_id) ?? 0) + 1);
  }

  return data.map((site) => ({
    id: site.id,
    name: site.name,
    domain: site.domain,
    status: site.status,
    createdAt: site.created_at,
    updatedAt: site.updated_at,
    savedSectionCount: counts.get(site.id) ?? 0,
  }));
}

export type TemplateCategoryDto = {
  name: string;
  total: number;
  published: number;
  draft: number;
  archived: number;
};

/**
 * Categories present in the central template library.
 *
 * Derived from `sections.category` rather than stored in a table of their own:
 * the column is plain text, and inventing a categories table purely to list
 * values would be a migration with no product benefit. Nothing is hard-coded —
 * a new category appears here as soon as a template uses it.
 */
export async function listTemplateCategories(): Promise<TemplateCategoryDto[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("sections")
    .select("category, status")
    .limit(1000);

  if (error) {
    throwDatabaseError(error, "Template categories are temporarily unavailable.");
  }

  const byName = new Map<string, TemplateCategoryDto>();

  for (const row of data) {
    const name = typeof row.category === "string" ? row.category.trim() : "";

    if (name === "") {
      continue;
    }

    const entry =
      byName.get(name) ??
      { name, total: 0, published: 0, draft: 0, archived: 0 };

    entry.total += 1;

    if (row.status === "published") {
      entry.published += 1;
    } else if (row.status === "draft") {
      entry.draft += 1;
    } else if (row.status === "archived") {
      entry.archived += 1;
    }

    byName.set(name, entry);
  }

  return [...byName.values()].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}
