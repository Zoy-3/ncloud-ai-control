import { withApiErrorHandling } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin";
import { listAdminSavedSections } from "@/lib/saved-sections/admin-repository";

export const dynamic = "force-dynamic";

/**
 * Saved sections across every connected site, for central inspection.
 *
 * Administrators only. A site token is never accepted here and is never proof
 * of access: this view deliberately spans sites, which the tenant-scoped
 * `/api/wordpress/saved-sections` routes must never do.
 *
 * Metadata only — the stored shortcode travels in the detail response.
 */
export async function GET(): Promise<Response> {
  return withApiErrorHandling(async () => {
    await requireAdminSession();
    const sections = await listAdminSavedSections();

    return successResponse({ success: true, sections });
  });
}
