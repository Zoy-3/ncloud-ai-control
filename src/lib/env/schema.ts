import { z } from "zod";

/**
 * Normalizes an optional credential read from the process environment.
 *
 * A hosting provider can hold a declared-but-blank variable, and Vercel hands
 * that to the function as an empty string rather than omitting the key. A blank
 * value means the credential is absent, not that it is malformed, so it must
 * normalize to `undefined` instead of failing validation and taking every
 * server route down with it.
 */
function blankAsUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }

  return value;
}

/**
 * Validation for the server environment, kept free of `server-only` so the
 * rules can be exercised directly by tests.
 */
export const serverEnvironmentSchema = z.object({
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
  // Absent and blank both mean "not configured" and are accepted outside
  // development; a present value is still held to the full format rules.
  DEV_API_SECRET: z.preprocess(
    blankAsUndefined,
    z
      .string()
      .trim()
      .min(1, "DEV_API_SECRET is required.")
      .max(512, "DEV_API_SECRET must be at most 512 characters.")
      .regex(/^\S+$/, "DEV_API_SECRET cannot contain whitespace.")
      .optional(),
  ),
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

/**
 * Renders validation issues into one message. Only variable names and rule
 * messages are included, never the value that failed.
 */
export function formatServerEnvironmentIssues(
  error: z.ZodError<ServerEnvironment>,
): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}
