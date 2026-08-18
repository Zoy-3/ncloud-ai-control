import "server-only";

import { ApiError } from "@/lib/api/errors";
import {
  mapSectionDetail,
  mapSectionMetadata,
  sectionDetailColumns,
  sectionMetadataColumns,
  visibleSectionStatuses,
  type SectionDetailDto,
  type SectionMetadataDto,
} from "@/lib/sections/models";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Phase 2B serves one shared template library with no pagination, so the read
// stays explicitly bounded instead of growing with the table.
const MAXIMUM_TEMPLATES = 200;

/**
 * Lists templates visible to an authenticated WordPress site. Metadata only:
 * the stored shortcode is never part of a listing response.
 */
export async function listWordPressSections(): Promise<SectionMetadataDto[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("sections")
    .select(sectionMetadataColumns)
    .in("status", visibleSectionStatuses())
    .order("name", { ascending: true })
    .limit(MAXIMUM_TEMPLATES);

  if (error) {
    throwDatabaseError(error, "The template library is temporarily unavailable.");
  }

  return data.map(mapSectionMetadata);
}

/**
 * Reads one visible template, including its shortcode. A section that does not
 * exist and a section the site may not see produce the same 404, so the
 * response never reveals hidden records.
 */
export async function getWordPressSection(
  sectionId: string,
): Promise<SectionDetailDto> {
  const { data, error } = await getSupabaseServerClient()
    .from("sections")
    .select(sectionDetailColumns)
    .eq("id", sectionId)
    .in("status", visibleSectionStatuses())
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "The template library is temporarily unavailable.");
  }

  if (data === null) {
    throw new ApiError(404, "not_found", "Template was not found.");
  }

  return mapSectionDetail(data);
}
