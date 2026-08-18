import "server-only";

import {
  resolveRunnerAvailability,
  type RunnerAvailability,
} from "@/lib/runners/availability";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Reports whether a runner is currently reachable.
 *
 * This never throws: runner availability is advisory information on a
 * connection screen, so a database problem degrades it to `unknown` instead of
 * failing the caller's status request.
 */
export async function readRunnerAvailability(
  referenceTime = new Date(),
): Promise<RunnerAvailability> {
  try {
    const { data, error } = await getSupabaseServerClient()
      .from("runners")
      .select("status, last_seen_at")
      .neq("status", "disabled")
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(1);

    return resolveRunnerAvailability(error ? null : data, referenceTime);
  } catch {
    return "unknown";
  }
}
