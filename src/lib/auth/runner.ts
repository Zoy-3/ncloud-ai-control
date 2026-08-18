import "server-only";

import { ApiError } from "@/lib/api/errors";
import { hashToken, isRunnerToken, readBearerToken } from "@/lib/security/tokens";
import { throwDatabaseError } from "@/lib/supabase/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedRunner = {
  id: string;
  name: string;
};

export async function authenticateRunner(
  request: Request,
): Promise<AuthenticatedRunner> {
  const token = readBearerToken(request.headers.get("authorization"));
  if (token === null || !isRunnerToken(token)) {
    throw new ApiError(401, "unauthorized", "Runner authentication failed.");
  }

  const tokenHash = hashToken(token);
  const { data, error } = await getSupabaseServerClient()
    .from("runners")
    .select("id, name, status")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "Runner authentication is temporarily unavailable.");
  }

  if (data === null) {
    throw new ApiError(401, "unauthorized", "Runner authentication failed.");
  }

  if (data.status === "disabled") {
    throw new ApiError(403, "forbidden", "Runner access is disabled.");
  }

  return { id: data.id, name: data.name };
}
