import "server-only";

import type { CreateSavedSectionBody } from "@/lib/api/schemas";
import {
  savedSectionDetailColumns,
  savedSectionListColumns,
  type SavedSectionDetailDto,
  type SavedSectionDetailRow,
  type SavedSectionInsert,
  type SavedSectionListDto,
  type SavedSectionListRow,
} from "@/lib/saved-sections/models";
import {
  createSavedSectionForSite,
  getSavedSectionForSite,
  listSavedSectionsForSite,
  type SavedSectionsGateway,
} from "@/lib/saved-sections/service";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSectionPreviewUrl } from "@/lib/supabase/storage";

// One site's saved library is read whole, with no pagination in this phase, so
// the read stays explicitly bounded instead of growing with the table.
const MAXIMUM_SAVED_SECTIONS = 200;

const unavailable = "Your saved sections are temporarily unavailable.";

/**
 * Supabase implementation of the gateway.
 *
 * Every statement is filtered by `site_id`, and the value always comes from the
 * authenticated site the caller was resolved to.
 */
const supabaseGateway: SavedSectionsGateway = {
  async listBySite(siteId: string): Promise<SavedSectionListRow[]> {
    const { data, error } = await getSupabaseServerClient()
      .from("saved_sections")
      .select(savedSectionListColumns)
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })
      .limit(MAXIMUM_SAVED_SECTIONS);

    if (error) {
      throwDatabaseError(error, unavailable);
    }

    return data;
  },

  async findForSite(
    savedSectionId: string,
    siteId: string,
  ): Promise<SavedSectionDetailRow | null> {
    const { data, error } = await getSupabaseServerClient()
      .from("saved_sections")
      .select(savedSectionDetailColumns)
      .eq("id", savedSectionId)
      .eq("site_id", siteId)
      .maybeSingle();

    if (error) {
      throwDatabaseError(error, unavailable);
    }

    return data;
  },

  async create(row: SavedSectionInsert): Promise<SavedSectionDetailRow> {
    const { data, error } = await getSupabaseServerClient()
      .from("saved_sections")
      .insert(row)
      .select(savedSectionDetailColumns)
      .single();

    if (error) {
      throwDatabaseError(error, "The saved section could not be stored.");
    }

    return data;
  },
};

export async function listSavedSections(
  siteId: string,
): Promise<SavedSectionListDto[]> {
  return listSavedSectionsForSite(
    supabaseGateway,
    siteId,
    resolveSectionPreviewUrl,
  );
}

export async function getSavedSection(
  savedSectionId: string,
  siteId: string,
): Promise<SavedSectionDetailDto> {
  return getSavedSectionForSite(
    supabaseGateway,
    savedSectionId,
    siteId,
    resolveSectionPreviewUrl,
  );
}

export async function createSavedSection(
  siteId: string,
  body: CreateSavedSectionBody,
): Promise<SavedSectionListDto> {
  return createSavedSectionForSite(
    supabaseGateway,
    siteId,
    body,
    resolveSectionPreviewUrl,
  );
}
