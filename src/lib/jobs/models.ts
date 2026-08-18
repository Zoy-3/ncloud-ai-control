import type { Json, JobStatus, JobType } from "@/lib/supabase/database.types";

export type ClaimedJobDto = {
  id: string;
  type: JobType;
  prompt: string;
  context: Json;
};

export type JobStatusDto = {
  id: string;
  status: JobStatus;
  resultShortcode: string | null;
};

export function mapClaimedJob(row: {
  id: string;
  type: JobType;
  prompt: string;
  context_json: Json;
}): ClaimedJobDto {
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    context: row.context_json,
  };
}

export function mapJobStatus(row: {
  id: string;
  status: JobStatus;
  result_shortcode: string | null;
}): JobStatusDto {
  return {
    id: row.id,
    status: row.status,
    resultShortcode: row.result_shortcode,
  };
}
