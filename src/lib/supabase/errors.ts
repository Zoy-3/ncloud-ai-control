import type { PostgrestError } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";

export function throwDatabaseError(
  error: PostgrestError,
  publicMessage = "The database operation could not be completed.",
): never {
  throw new ApiError(503, "database_unavailable", publicMessage, {
    cause: error,
  });
}

export function throwRpcError(error: PostgrestError): never {
  if (error.code === "P0001") {
    throw new ApiError(
      409,
      "conflict",
      "The job operation conflicts with the current runner or job state.",
      { cause: error },
    );
  }

  throwDatabaseError(error);
}
