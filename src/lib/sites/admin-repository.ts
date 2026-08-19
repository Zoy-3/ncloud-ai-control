import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { CreateSiteBody } from "@/lib/api/schemas";
import { generateSiteToken, hashToken } from "@/lib/security/tokens";
import type { SiteStatus } from "@/lib/supabase/database.types";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A site as an administrator sees it.
 *
 * `site_token_hash` is absent from this shape by construction, so no route or
 * page can return it even by mistake.
 */
export type AdminSiteDto = {
  id: string;
  name: string;
  domain: string;
  status: SiteStatus;
  createdAt: string;
  updatedAt: string;
};

/** Columns safe to project. Never includes the token hash. */
const publicColumns = "id, name, domain, status, created_at, updated_at";

const unavailable = "Sites are temporarily unavailable.";

type SiteRow = {
  id: string;
  name: string;
  domain: string;
  status: SiteStatus;
  created_at: string;
  updated_at: string;
};

function toDto(row: SiteRow): AdminSiteDto {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdminSites(): Promise<AdminSiteDto[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("sites")
    .select(publicColumns)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  return data.map(toDto);
}

/**
 * Registers a site.
 *
 * A site is created with no usable token: the hash column is filled with a
 * value that no token can produce, so the site cannot authenticate until a
 * token is deliberately generated for it.
 */
export async function createAdminSite(
  body: CreateSiteBody,
): Promise<AdminSiteDto> {
  const domain = body.domain.trim().toLowerCase();

  const { data: existing, error: lookupError } = await getSupabaseServerClient()
    .from("sites")
    .select("id")
    .eq("domain", domain)
    .maybeSingle();

  if (lookupError) {
    throwDatabaseError(lookupError, unavailable);
  }

  if (existing !== null) {
    throw new ApiError(
      409,
      "conflict",
      "A site with that domain already exists.",
    );
  }

  // A SHA-256 hash of a value chosen at random and immediately discarded. It
  // satisfies the column's format constraint while matching no token.
  const placeholder = hashToken(generateSiteToken());

  const { data, error } = await getSupabaseServerClient()
    .from("sites")
    .insert({
      name: body.name,
      domain,
      site_token_hash: placeholder,
      status: "active",
    })
    .select(publicColumns)
    .single();

  if (error) {
    throwDatabaseError(error, "The site could not be created.");
  }

  return toDto(data);
}

/**
 * Issues a new site token.
 *
 * The raw token is generated here, hashed, and the hash alone is stored. The
 * raw value is returned to the caller exactly once and is never written to the
 * database or to a log. Any previous token stops working immediately, because
 * only one hash is kept and it has just been replaced.
 */
export async function issueAdminSiteToken(
  siteId: string,
): Promise<{ site: AdminSiteDto; siteToken: string }> {
  const siteToken = generateSiteToken();

  const { data, error } = await getSupabaseServerClient()
    .from("sites")
    .update({ site_token_hash: hashToken(siteToken) })
    .eq("id", siteId)
    .select(publicColumns)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "The site token could not be issued.");
  }

  if (data === null) {
    throw new ApiError(404, "not_found", "Site was not found.");
  }

  return { site: toDto(data), siteToken };
}

/**
 * Enables or disables a site.
 *
 * Nothing is deleted: saved sections, hidden-template preferences, previews,
 * and the token hash all remain. A disabled site simply fails authentication,
 * and re-enabling it restores access with the same token unless it was rotated.
 */
export async function setAdminSiteStatus(
  siteId: string,
  status: SiteStatus,
): Promise<AdminSiteDto> {
  const { data, error } = await getSupabaseServerClient()
    .from("sites")
    .update({ status })
    .eq("id", siteId)
    .select(publicColumns)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "The site status could not be changed.");
  }

  if (data === null) {
    throw new ApiError(404, "not_found", "Site was not found.");
  }

  return toDto(data);
}
