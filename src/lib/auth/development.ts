import "server-only";

import { ApiError } from "@/lib/api/errors";
import { getServerEnvironment } from "@/lib/env/server";
import { tokensEqual } from "@/lib/security/tokens";

/**
 * Development-only routes must be indistinguishable from missing routes
 * everywhere else, including any future hosted deployment.
 */
export function assertDevelopmentEnvironment(): void {
  if (process.env.NODE_ENV !== "development") {
    throw new ApiError(404, "not_found", "Route not found.");
  }
}

export function authenticateDevelopmentRequest(request: Request): void {
  assertDevelopmentEnvironment();

  const token = request.headers.get("x-dev-api-secret");
  const expected = getServerEnvironment().DEV_API_SECRET;

  if (token === null || token.length > 512 || !tokensEqual(token, expected)) {
    throw new ApiError(
      401,
      "unauthorized",
      "Development API authentication failed.",
    );
  }
}
