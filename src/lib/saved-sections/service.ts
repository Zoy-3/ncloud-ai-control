import type { CreateSavedSectionBody } from "@/lib/api/schemas";
import {
  assertSavedSectionVisible,
  buildSavedSectionInsert,
  mapSavedSectionDetail,
  mapSavedSectionListItem,
  type PreviewUrlResolver,
  type SavedSectionDetailDto,
  type SavedSectionDetailRow,
  type SavedSectionInsert,
  type SavedSectionListDto,
  type SavedSectionListRow,
} from "@/lib/saved-sections/models";

/**
 * The database operations My Saved needs.
 *
 * Every method is site-scoped by signature: there is no way to ask this
 * interface for "all saved sections", so a tenant leak cannot be expressed.
 * The Supabase implementation lives in the repository; tests supply their own.
 */
export type SavedSectionsGateway = {
  listBySite(siteId: string): Promise<SavedSectionListRow[]>;
  findForSite(
    savedSectionId: string,
    siteId: string,
  ): Promise<SavedSectionDetailRow | null>;
  create(row: SavedSectionInsert): Promise<SavedSectionDetailRow>;
};

/** Newest first, and only rows owned by the authenticated site. */
export async function listSavedSectionsForSite(
  gateway: SavedSectionsGateway,
  siteId: string,
  resolvePreviewUrl: PreviewUrlResolver,
): Promise<SavedSectionListDto[]> {
  const rows = await gateway.listBySite(siteId);

  return rows.map((row) => mapSavedSectionListItem(row, resolvePreviewUrl));
}

/**
 * Reads one saved section owned by the authenticated site.
 *
 * A saved section that does not exist and one owned by another site produce the
 * same 404, so a caller cannot probe for the existence of another site's rows.
 */
export async function getSavedSectionForSite(
  gateway: SavedSectionsGateway,
  savedSectionId: string,
  siteId: string,
  resolvePreviewUrl: PreviewUrlResolver,
): Promise<SavedSectionDetailDto> {
  const row = await gateway.findForSite(savedSectionId, siteId);

  return mapSavedSectionDetail(
    assertSavedSectionVisible(row, siteId),
    resolvePreviewUrl,
  );
}

/**
 * Creates a saved section owned by the authenticated site.
 *
 * Ownership comes from `siteId` alone. The request body has no say in it.
 */
export async function createSavedSectionForSite(
  gateway: SavedSectionsGateway,
  siteId: string,
  body: CreateSavedSectionBody,
  resolvePreviewUrl: PreviewUrlResolver,
): Promise<SavedSectionListDto> {
  const created = await gateway.create(buildSavedSectionInsert(siteId, body));

  // The create response is metadata only: the caller already holds the
  // shortcode and CSS it just sent.
  return mapSavedSectionListItem(created, resolvePreviewUrl);
}
