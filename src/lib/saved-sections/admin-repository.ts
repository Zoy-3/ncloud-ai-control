import "server-only";

import { ApiError } from "@/lib/api/errors";
import {
  adminSavedSectionDetailColumns,
  adminSavedSectionListColumns,
  mapAdminSavedSectionDetail,
  mapAdminSavedSectionListItem,
  type AdminSavedSectionDetailDto,
  type AdminSavedSectionListDto,
  type OwningSiteRow,
} from "@/lib/saved-sections/admin-models";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSectionPreviewUrl } from "@/lib/supabase/storage";

const MAXIMUM_SAVED_SECTIONS = 500;

const unavailable = "Saved sections are temporarily unavailable.";

/**
 * Names of the sites that own the given saved sections.
 *
 * Read as a separate bounded query rather than an embedded join so the shape
 * stays explicit: exactly three columns of `sites` are selected, and the token
 * hash is never among them.
 */
async function readOwningSites(
  siteIds: readonly string[],
): Promise<Map<string, NonNullable<OwningSiteRow>>> {
  const unique = [...new Set(siteIds)];

  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await getSupabaseServerClient()
    .from("sites")
    .select("id, name, domain")
    .in("id", unique);

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  return new Map(data.map((site) => [site.id, site]));
}

/**
 * Every site's saved sections, newest first.
 *
 * This is central NCloud administration, not a tenant view: it deliberately
 * spans sites, which is why it is reachable only behind an administrator
 * session and never through a site token.
 */
export async function listAdminSavedSections(): Promise<
  AdminSavedSectionListDto[]
> {
  const { data, error } = await getSupabaseServerClient()
    .from("saved_sections")
    .select(adminSavedSectionListColumns)
    .order("created_at", { ascending: false })
    .limit(MAXIMUM_SAVED_SECTIONS);

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  const sites = await readOwningSites(data.map((row) => row.site_id));

  return data.map((row) =>
    mapAdminSavedSectionListItem(
      row,
      sites.get(row.site_id) ?? null,
      resolveSectionPreviewUrl,
    ),
  );
}

/** One saved section with its payload, for inspection. */
export async function getAdminSavedSection(
  savedSectionId: string,
): Promise<AdminSavedSectionDetailDto> {
  const { data, error } = await getSupabaseServerClient()
    .from("saved_sections")
    .select(adminSavedSectionDetailColumns)
    .eq("id", savedSectionId)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  if (data === null) {
    throw new ApiError(404, "not_found", "Saved section was not found.");
  }

  const sites = await readOwningSites([data.site_id]);

  return mapAdminSavedSectionDetail(
    data,
    sites.get(data.site_id) ?? null,
    resolveSectionPreviewUrl,
  );
}
