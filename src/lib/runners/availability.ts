import type { RunnerStatus } from "@/lib/supabase/database.types";

/**
 * A runner heartbeat is considered current inside this window. It matches the
 * runner's polling contract, which stays well below 30 seconds per cycle.
 */
export const RUNNER_HEARTBEAT_FRESHNESS_MS = 30_000;

/** `unknown` means the control app could not determine the state, not that no runner exists. */
export type RunnerAvailability = "online" | "offline" | "unknown";

export type RunnerHeartbeatRow = {
  status: RunnerStatus;
  last_seen_at: string | null;
};

export function isHeartbeatFresh(
  lastSeenAt: string | null,
  referenceTime: Date,
): boolean {
  if (lastSeenAt === null) {
    return false;
  }

  const lastSeen = Date.parse(lastSeenAt);
  const now = referenceTime.getTime();

  return (
    Number.isFinite(lastSeen) &&
    now >= lastSeen &&
    now - lastSeen <= RUNNER_HEARTBEAT_FRESHNESS_MS
  );
}

export function resolveRunnerAvailability(
  rows: readonly RunnerHeartbeatRow[] | null,
  referenceTime: Date,
): RunnerAvailability {
  if (rows === null) {
    return "unknown";
  }

  const anyRunnerIsCurrent = rows.some(
    (row) =>
      row.status !== "disabled" && isHeartbeatFresh(row.last_seen_at, referenceTime),
  );

  return anyRunnerIsCurrent ? "online" : "offline";
}
