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
  /** Deletes and returns the removed row, or null when the site owns no such row. */
  deleteForSite(
    savedSectionId: string,
    siteId: string,
  ): Promise<SavedSectionDetailRow | null>;
  /** Points an owned row at a new preview object and returns the previous path. */
  setPreviewPath(
    savedSectionId: string,
    siteId: string,
    storagePath: string,
  ): Promise<SavedSectionDetailRow | null>;
};

/** Removes a preview object. Reports success rather than throwing. */
export type PreviewObjectRemover = (path: string | null) => Promise<boolean>;

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
 * Deletes one saved section owned by the authenticated site.
 *
 * The delete is itself filtered by `site_id`, so a row belonging to another
 * site is never removed, and the returned row is re-checked before its preview
 * object is touched. A saved section that does not exist and one owned by
 * another site both raise the same 404.
 *
 * The preview object is removed after the row is gone. If that removal fails
 * the delete is still reported as successful: the record the caller asked to
 * remove is removed, and a leftover image is a smaller problem than a delete
 * that appears to have failed but did not.
 */
export async function deleteSavedSectionForSite(
  gateway: SavedSectionsGateway,
  savedSectionId: string,
  siteId: string,
  removePreview: PreviewObjectRemover,
): Promise<void> {
  const removed = assertSavedSectionVisible(
    await gateway.deleteForSite(savedSectionId, siteId),
    siteId,
  );

  await removePreview(removed.preview_storage_path);
}

/**
 * Attaches or replaces the preview image of one owned saved section.
 *
 * The row is updated to the new object first and only then is the previous
 * object removed, so the database never points at an object that has already
 * been deleted. A failure to remove the superseded object leaves an unreferenced
 * file behind rather than a broken record.
 *
 * @returns The updated card, including the new preview URL.
 */
export async function setSavedSectionPreviewForSite(
  gateway: SavedSectionsGateway,
  savedSectionId: string,
  siteId: string,
  storagePath: string,
  resolvePreviewUrl: PreviewUrlResolver,
  removePreview: PreviewObjectRemover,
  previousPath: string | null,
): Promise<SavedSectionListDto> {
  const updated = assertSavedSectionVisible(
    await gateway.setPreviewPath(savedSectionId, siteId, storagePath),
    siteId,
  );

  if (previousPath !== null && previousPath !== storagePath) {
    await removePreview(previousPath);
  }

  return mapSavedSectionListItem(updated, resolvePreviewUrl);
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
