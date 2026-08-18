import "server-only";

import {
  authorizeSite,
  readSiteToken,
  type AuthenticatedSite,
} from "@/lib/auth/site-token";
import { hashToken } from "@/lib/security/tokens";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Authenticates a WordPress site from `Authorization: Bearer <SITE_TOKEN>`.
 *
 * The raw token is hashed before it reaches the database and is never logged,
 * returned, or stored. The site identity always comes from the stored row, so
 * a caller can never assert which site it is.
 */
export async function authenticateSite(
  request: Request,
): Promise<AuthenticatedSite> {
  const token = readSiteToken(request.headers.get("authorization"));
  const tokenHash = hashToken(token);

  const { data, error } = await getSupabaseServerClient()
    .from("sites")
    .select("id, name, domain, status")
    .eq("site_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "Site authentication is temporarily unavailable.");
  }

  return authorizeSite(data);
}
