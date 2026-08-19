import "server-only";

import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import type {
  CreateTemplateBody,
  UpdateTemplateBody,
} from "@/lib/api/schemas";
import type { PreviewImage } from "@/lib/previews/upload";
import {
  adminTemplateDetailColumns,
  adminTemplateListColumns,
  buildTemplateInsert,
  buildTemplateUpdate,
  mapAdminTemplateDetail,
  mapAdminTemplateListItem,
  type AdminTemplateDetailDto,
  type AdminTemplateListDto,
} from "@/lib/templates/admin-models";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteSectionPreview,
  resolveSectionPreviewUrl,
  uploadSectionPreview,
} from "@/lib/supabase/storage";
import { buildTemplatePreviewPath } from "@/lib/supabase/storage-path";

const MAXIMUM_TEMPLATES = 500;

const unavailable = "The template library is temporarily unavailable.";

function notFound(): ApiError {
  return new ApiError(404, "not_found", "Template was not found.");
}

/** Every template, in every status. Only an administrator reaches this. */
export async function listAdminTemplates(): Promise<AdminTemplateListDto[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("sections")
    .select(adminTemplateListColumns)
    .order("updated_at", { ascending: false })
    .limit(MAXIMUM_TEMPLATES);

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  return data.map((row) =>
    mapAdminTemplateListItem(row, resolveSectionPreviewUrl),
  );
}

export async function getAdminTemplate(
  sectionId: string,
): Promise<AdminTemplateDetailDto> {
  const { data, error } = await getSupabaseServerClient()
    .from("sections")
    .select(adminTemplateDetailColumns)
    .eq("id", sectionId)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, unavailable);
  }

  if (data === null) {
    throw notFound();
  }

  return mapAdminTemplateDetail(data, resolveSectionPreviewUrl);
}

export async function createAdminTemplate(
  body: CreateTemplateBody,
): Promise<AdminTemplateDetailDto> {
  const { data, error } = await getSupabaseServerClient()
    .from("sections")
    .insert(buildTemplateInsert(body))
    .select(adminTemplateDetailColumns)
    .single();

  if (error) {
    throwDatabaseError(error, "The template could not be created.");
  }

  return mapAdminTemplateDetail(data, resolveSectionPreviewUrl);
}

/**
 * Applies an edit.
 *
 * The patch contains only the fields that were supplied, so unrelated columns
 * keep their values.
 */
export async function updateAdminTemplate(
  sectionId: string,
  body: UpdateTemplateBody,
): Promise<AdminTemplateDetailDto> {
  const { data, error } = await getSupabaseServerClient()
    .from("sections")
    .update(buildTemplateUpdate(body))
    .eq("id", sectionId)
    .select(adminTemplateDetailColumns)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "The template could not be updated.");
  }

  if (data === null) {
    throw notFound();
  }

  return mapAdminTemplateDetail(data, resolveSectionPreviewUrl);
}

/**
 * Attaches or replaces a template's preview image.
 *
 * The row is pointed at the new object before the superseded one is removed, so
 * the database never references a deleted file.
 */
export async function setAdminTemplatePreview(
  sectionId: string,
  image: PreviewImage,
): Promise<AdminTemplateDetailDto> {
  const supabase = getSupabaseServerClient();

  const { data: existing, error: readError } = await supabase
    .from("sections")
    .select("id, preview_storage_path")
    .eq("id", sectionId)
    .maybeSingle();

  if (readError) {
    throwDatabaseError(readError, unavailable);
  }

  if (existing === null) {
    throw notFound();
  }

  const storagePath = buildTemplatePreviewPath(
    sectionId,
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

  const { data, error } = await supabase
    .from("sections")
    .update({ preview_storage_path: storagePath })
    .eq("id", sectionId)
    .select(adminTemplateDetailColumns)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "The preview could not be attached.");
  }

  if (data === null) {
    throw notFound();
  }

  const previous = existing.preview_storage_path;

  if (previous !== null && previous !== storagePath) {
    await deleteSectionPreview(previous);
  }

  return mapAdminTemplateDetail(data, resolveSectionPreviewUrl);
}
