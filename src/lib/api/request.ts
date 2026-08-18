import { z } from "zod";

import { ApiError } from "@/lib/api/errors";

const jsonMediaType = "application/json";

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maximumBytes: number,
): Promise<T> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (mediaType !== jsonMediaType) {
    throw new ApiError(
      415,
      "unsupported_media_type",
      "Content-Type must be application/json.",
    );
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (Number.isFinite(length) && length > maximumBytes) {
      throw new ApiError(413, "payload_too_large", "Request body is too large.");
    }
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new ApiError(413, "payload_too_large", "Request body is too large.");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiError(400, "bad_request", "Request body must be valid JSON.");
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "validation_error",
      "Request body does not match the expected shape.",
    );
  }

  return parsed.data;
}

export function parseUuidParam(value: string, subject: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "validation_error",
      `${subject} must be a valid UUID.`,
    );
  }

  return parsed.data;
}

export function parseUuid(value: string): string {
  return parseUuidParam(value, "Job ID");
}
