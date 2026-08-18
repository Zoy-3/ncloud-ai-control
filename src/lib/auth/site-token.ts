import { ApiError } from "@/lib/api/errors";
import { isSiteToken, readBearerToken } from "@/lib/security/tokens";
import type { SiteStatus } from "@/lib/supabase/database.types";

export type AuthenticatedSite = {
  id: string;
  name: string;
  domain: string;
  status: SiteStatus;
};

/**
 * The subset of a `sites` row the authentication policy is allowed to see.
 * `site_token_hash` deliberately stays out of this shape so a stored hash can
 * never reach a response, a log, or a caller.
 */
export type SiteAuthenticationRecord = {
  id: string;
  name: string;
  domain: string;
  status: SiteStatus;
};

/**
 * One identical failure for a missing header, a wrong scheme, a malformed
 * token, and an unknown token. A caller must not be able to learn which of
 * those it hit.
 */
export function siteAuthenticationError(): ApiError {
  return new ApiError(401, "unauthorized", "Site authentication failed.");
}

export function readSiteToken(authorization: string | null): string {
  const token = readBearerToken(authorization);

  if (token === null || !isSiteToken(token)) {
    throw siteAuthenticationError();
  }

  return token;
}

export function authorizeSite(
  record: SiteAuthenticationRecord | null,
): AuthenticatedSite {
  if (record === null) {
    throw siteAuthenticationError();
  }

  if (record.status !== "active") {
    throw new ApiError(403, "forbidden", "Site access is disabled.");
  }

  return {
    id: record.id,
    name: record.name,
    domain: record.domain,
    status: record.status,
  };
}
