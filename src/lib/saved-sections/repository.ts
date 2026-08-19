import "server-only";

import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import type { CreateSavedSectionBody } from "@/lib/api/schemas";
import type { PreviewImage } from "@/lib/previews/upload";
import {
  assertSavedSectionVisible,
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
  deleteSavedSectionForSite,
  getSavedSectionForSite,
  listSavedSectionsForSite,
  setSavedSectionPreviewForSite,
  type SavedSectionsGateway,
} from "@/lib/saved-sections/service";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteSectionPreview,
  resolveSectionPreviewUrl,
  uploadSectionPreview,
} from "@/lib/supabase/storage";
import { buildSavedPreviewPath } from "@/lib/supabase/storage-path";

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

  async deleteForSite(
    savedSectionId: string,
    siteId: string,
  ): Promise<SavedSectionDetailRow | null> {
    // The delete itself is site-scoped, and it returns the row it removed, so
    // the preview path cleaned up afterwards can only be one this site owned.
    const { data, error } = await getSupabaseServerClient()
      .from("saved_sections")
      .delete()
      .eq("id", savedSectionId)
      .eq("site_id", siteId)
      .select(savedSectionDetailColumns)
      .maybeSingle();

    if (error) {
      throwDatabaseError(error, "The saved section could not be removed.");
    }

    return data;
  },

  async setPreviewPath(
    savedSectionId: string,
    siteId: string,
    storagePath: string,
  ): Promise<SavedSectionDetailRow | null> {
    const { data, error } = await getSupabaseServerClient()
      .from("saved_sections")
      .update({ preview_storage_path: storagePath })
      .eq("id", savedSectionId)
      .eq("site_id", siteId)
      .select(savedSectionDetailColumns)
      .maybeSingle();

    if (error) {
      throwDatabaseError(error, "The preview could not be attached.");
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

export async function deleteSavedSection(
  savedSectionId: string,
  siteId: string,
): Promise<void> {
  return deleteSavedSectionForSite(
    supabaseGateway,
    savedSectionId,
    siteId,
    deleteSectionPreview,
  );
}

/**
 * Stores an uploaded preview against one owned saved section.
 *
 * Ownership is confirmed by reading the row first; the Storage path is then
 * generated entirely from server-held values, never from the request.
 */
export async function setSavedSectionPreview(
  savedSectionId: string,
  siteId: string,
  image: PreviewImage,
): Promise<SavedSectionListDto> {
  const existing = assertSavedSectionVisible(
    await supabaseGateway.findForSite(savedSectionId, siteId),
    siteId,
  );

  const storagePath = buildSavedPreviewPath(
    siteId,
    savedSectionId,
    image.contentType,
    randomUUID(),
  );

  const stored = await uploadSectionPreview(
    storagePath,
    image.body,
    image.contentType,
  );

  if (!stored) {
    throw new ApiError(
      502,
      "internal_error",
      "The preview image could not be stored.",
    );
  }

  return setSavedSectionPreviewForSite(
    supabaseGateway,
    savedSectionId,
    siteId,
    storagePath,
    resolveSectionPreviewUrl,
    deleteSectionPreview,
    existing.preview_storage_path,
  );
}
