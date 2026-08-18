import "server-only";

import { ApiError } from "@/lib/api/errors";
import { generateSiteToken, hashToken } from "@/lib/security/tokens";
import type { SiteStatus } from "@/lib/supabase/database.types";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SiteTokenTarget = { siteId: string } | { domain: string };

export type ProvisionedSiteToken = {
  site: {
    id: string;
    name: string;
    domain: string;
    status: SiteStatus;
  };
  /** Raw token. Returned exactly once and never persisted anywhere. */
  siteToken: string;
};

/**
 * Generates a new raw site token, stores only its SHA-256 hash on the target
 * site, and returns the raw token once. No other site column is written; the
 * caller identifies the site explicitly by UUID or exact domain.
 */
export async function provisionSiteToken(
  target: SiteTokenTarget,
): Promise<ProvisionedSiteToken> {
  const supabase = getSupabaseServerClient();
  const selection = supabase.from("sites").select("id, name, domain, status");

  const { data: site, error: lookupError } = await ("siteId" in target
    ? selection.eq("id", target.siteId)
    : selection.eq("domain", target.domain)
  ).maybeSingle();

  if (lookupError) {
    throwDatabaseError(lookupError);
  }

  if (site === null) {
    throw new ApiError(404, "not_found", "Site was not found.");
  }

  if (site.status !== "active") {
    throw new ApiError(
      409,
      "conflict",
      "A token can only be provisioned for an active site.",
    );
  }

  const siteToken = generateSiteToken();

  const { data: updated, error: updateError } = await supabase
    .from("sites")
    .update({ site_token_hash: hashToken(siteToken) })
    .eq("id", site.id)
    .eq("status", "active")
    .select("id, name, domain, status")
    .maybeSingle();

  if (updateError) {
    throwDatabaseError(updateError);
  }

  if (updated === null) {
    throw new ApiError(409, "conflict", "The site token could not be rotated.");
  }

  return { site: updated, siteToken };
}
