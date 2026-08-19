import "server-only";

import { ApiError } from "@/lib/api/errors";
import {
  applyHiddenSections,
  mapSectionDetail,
  sectionDetailColumns,
  sectionMetadataColumns,
  visibleSectionStatuses,
  type SectionDetailDto,
  type SectionMetadataDto,
} from "@/lib/sections/models";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSectionPreviewUrl } from "@/lib/supabase/storage";

// Phase 2B serves one shared template library with no pagination, so the read
// stays explicitly bounded instead of growing with the table.
const MAXIMUM_TEMPLATES = 200;

const unavailable = "The template library is temporarily unavailable.";

/**
 * The central template ids this site has hidden from its own library.
 *
 * Hiding is a preference, never a deletion, and it is always scoped to the
 * requesting site.
 */
async function readHiddenSectionIds(siteId: string): Promise<Set<string>> {
  const { data, error } = await getSupabaseServerClient()
    .from("site_hidden_sections")
    .select("section_id")
    .eq("site_id", siteId);

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  return new Set(data.map((row) => row.section_id));
}

/**
 * Lists templates visible to an authenticated WordPress site. Metadata only:
 * neither the stored shortcode nor the stored CSS is part of a listing.
 *
 * Templates the site has hidden are excluded unless `includeHidden` is set, in
 * which case they are returned carrying `hidden: true` so one can be restored.
 */
export async function listWordPressSections(
  siteId: string,
  includeHidden = false,
): Promise<SectionMetadataDto[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("sections")
    .select(sectionMetadataColumns)
    .in("status", visibleSectionStatuses())
    .order("name", { ascending: true })
    .limit(MAXIMUM_TEMPLATES);

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  const hiddenIds = await readHiddenSectionIds(siteId);

  return applyHiddenSections(
    data,
    hiddenIds,
    includeHidden,
    resolveSectionPreviewUrl,
  );
}

/**
 * Reads one visible template, including its shortcode. A section that does not
 * exist and a section the site may not see produce the same 404, so the
 * response never reveals hidden records.
 *
 * A template the site has hidden is still readable by id: hiding removes it
 * from the listing, it does not revoke access to a template the user asks for
 * by name.
 */
export async function getWordPressSection(
  sectionId: string,
  siteId: string,
): Promise<SectionDetailDto> {
  const { data, error } = await getSupabaseServerClient()
    .from("sections")
    .select(sectionDetailColumns)
    .eq("id", sectionId)
    .in("status", visibleSectionStatuses())
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  if (data === null) {
    throw new ApiError(404, "not_found", "Template was not found.");
  }

  const hiddenIds = await readHiddenSectionIds(siteId);

  return mapSectionDetail(data, resolveSectionPreviewUrl, hiddenIds.has(data.id));
}

/**
 * Hides one central template for the authenticated site only.
 *
 * The template must be one this site could otherwise see, so a site cannot
 * record a preference against a template it has no access to, nor use this
 * endpoint to probe for archived or unpublished ids. The insert is idempotent:
 * hiding an already-hidden template succeeds without creating a second row.
 */
export async function hideSectionForSite(
  sectionId: string,
  siteId: string,
): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: section, error: sectionError } = await supabase
    .from("sections")
    .select("id")
    .eq("id", sectionId)
    .in("status", visibleSectionStatuses())
    .maybeSingle();

  if (sectionError) {
    throwDatabaseError(sectionError, unavailable);
  }

  if (section === null) {
    throw new ApiError(404, "not_found", "Template was not found.");
  }

  const { error } = await supabase
    .from("site_hidden_sections")
    .upsert(
      { site_id: siteId, section_id: sectionId },
      { onConflict: "site_id,section_id", ignoreDuplicates: true },
    );

  if (error) {
    throwDatabaseError(error, "The template could not be hidden.");
  }
}

/**
 * Restores one central template to the authenticated site's library.
 *
 * Removing a preference that is not there is not an error: the caller's
 * intent — "this template should be visible" — is satisfied either way.
 */
export async function unhideSectionForSite(
  sectionId: string,
  siteId: string,
): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from("site_hidden_sections")
    .delete()
    .eq("site_id", siteId)
    .eq("section_id", sectionId);

  if (error) {
    throwDatabaseError(error, "The template could not be restored.");
  }
}
