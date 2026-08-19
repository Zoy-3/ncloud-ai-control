import "server-only";

import {
  formatServerEnvironmentIssues,
  serverEnvironmentSchema,
  type ServerEnvironment,
} from "@/lib/env/schema";

export type { ServerEnvironment };

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  const result = serverEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    DEV_API_SECRET: process.env.DEV_API_SECRET,
    NCLOUD_ADMIN_SECRET: process.env.NCLOUD_ADMIN_SECRET,
  });

  if (!result.success) {
    throw new Error(
      `Invalid server environment configuration: ${formatServerEnvironmentIssues(result.error)}`,
    );
  }

  cachedEnvironment = result.data;
  return cachedEnvironment;
}
