import "server-only";

import { z } from "zod";

const serverEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .regex(
      /^sb_publishable_/,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must use the new publishable-key format.",
    ),
  SUPABASE_SECRET_KEY: z
    .string()
    .trim()
    .regex(
      /^sb_secret_/,
      "SUPABASE_SECRET_KEY must use the new secret-key format.",
    ),
  // Development-only credential. A hosted deployment runs no development
  // route, so requiring it there would force a useless secret into production.
  DEV_API_SECRET: z
    .string()
    .trim()
    .min(1, "DEV_API_SECRET is required.")
    .max(512, "DEV_API_SECRET must be at most 512 characters.")
    .regex(/^\S+$/, "DEV_API_SECRET cannot contain whitespace.")
    .optional(),
}).refine(
  (environment) =>
    process.env.NODE_ENV !== "development" ||
    environment.DEV_API_SECRET !== undefined,
  {
    message: "DEV_API_SECRET is required in development.",
    path: ["DEV_API_SECRET"],
  },
);

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

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
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid server environment configuration: ${issues}`);
  }

  cachedEnvironment = result.data;
  return cachedEnvironment;
}
