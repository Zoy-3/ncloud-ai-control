import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AuthenticatedRunner } from "@/lib/auth/runner";
import { DEVELOPMENT_SITE } from "@/lib/development/constants";
import {
  mapClaimedJob,
  mapJobStatus,
  type ClaimedJobDto,
  type JobStatusDto,
} from "@/lib/jobs/models";
import { throwDatabaseError, throwRpcError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function recordRunnerHeartbeat(
  runner: AuthenticatedRunner,
  requestedName: string,
): Promise<void> {
  if (requestedName !== runner.name) {
    throw new ApiError(
      409,
      "conflict",
      "Runner name does not match the authenticated runner.",
    );
  }

  const { data, error } = await getSupabaseServerClient()
    .from("runners")
    .update({
      status: "online",
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", runner.id)
    .neq("status", "disabled")
    .select("id")
    .maybeSingle();

  if (error) {
    throwDatabaseError(error);
  }

  if (data === null) {
    throw new ApiError(409, "conflict", "Runner cannot send a heartbeat.");
  }
}

export async function claimNextJob(
  runnerId: string,
): Promise<ClaimedJobDto | null> {
  const { data, error } = await getSupabaseServerClient().rpc(
    "claim_next_job",
    { p_runner_id: runnerId },
  );

  if (error) {
    throwRpcError(error);
  }

  if (!data || data.length === 0) {
    return null;
  }

  if (data.length !== 1) {
    throw new ApiError(
      500,
      "internal_error",
      "The database returned an invalid claim result.",
    );
  }

  return mapClaimedJob(data[0]);
}

export async function completeRunnerJob(
  runnerId: string,
  jobId: string,
  shortcode: string,
): Promise<void> {
  const { data, error } = await getSupabaseServerClient().rpc(
    "complete_runner_job",
    {
      p_runner_id: runnerId,
      p_job_id: jobId,
      p_result_shortcode: shortcode,
    },
  );

  if (error) {
    throwRpcError(error);
  }

  if (data !== true) {
    throw new ApiError(409, "conflict", "The job could not be completed.");
  }
}

export async function failRunnerJob(
  runnerId: string,
  jobId: string,
  readableError: string,
): Promise<void> {
  const { data, error } = await getSupabaseServerClient().rpc("fail_runner_job", {
    p_runner_id: runnerId,
    p_job_id: jobId,
    p_error_message: readableError,
  });

  if (error) {
    throwRpcError(error);
  }

  if (data !== true) {
    throw new ApiError(409, "conflict", "The job could not be failed.");
  }
}

export async function createDevelopmentJob(prompt: string): Promise<{
  id: string;
  status: "pending";
}> {
  const supabase = getSupabaseServerClient();
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id")
    .eq("domain", DEVELOPMENT_SITE.domain)
    .eq("status", "active")
    .maybeSingle();

  if (siteError) {
    throwDatabaseError(siteError);
  }

  if (site === null) {
    throw new ApiError(
      409,
      "conflict",
      "The controlled development site has not been configured.",
    );
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      site_id: site.id,
      type: "generate_section",
      prompt,
      context_json: {},
      status: "pending",
    })
    .select("id, status")
    .single();

  if (jobError) {
    throwDatabaseError(jobError);
  }

  if (job.status !== "pending") {
    throw new ApiError(
      500,
      "internal_error",
      "The database returned an invalid new-job state.",
    );
  }

  return { id: job.id, status: job.status };
}

export async function getJobStatus(jobId: string): Promise<JobStatusDto> {
  const { data, error } = await getSupabaseServerClient()
    .from("jobs")
    .select("id, status, result_shortcode")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error);
  }

  if (data === null) {
    throw new ApiError(404, "not_found", "Job was not found.");
  }

  return mapJobStatus(data);
}
