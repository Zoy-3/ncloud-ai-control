export type ApiErrorCode =
  | "bad_request"
  | "conflict"
  | "database_unavailable"
  | "forbidden"
  | "internal_error"
  | "not_found"
  | "payload_too_large"
  | "unauthorized"
  | "unsupported_media_type"
  | "validation_error";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      {
        status: error.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  // Deliberately omit the original error message: database errors and request
  // objects must never leak credentials or implementation details to logs.
  console.error("Unhandled API error", {
    errorType: error instanceof Error ? error.name : typeof error,
  });

  return Response.json(
    {
      success: false,
      error: {
        code: "internal_error",
        message: "An unexpected server error occurred.",
      },
    },
    {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function withApiErrorHandling(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return apiErrorResponse(error);
  }
}
