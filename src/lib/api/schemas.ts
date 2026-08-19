import { z } from "zod";

export const requestBodyLimits = {
  claim: 16,
  complete: 510_000,
  createJob: 12_000,
  createSavedSection: 320_000,
  fail: 8_000,
  heartbeat: 1_000,
  provisionSiteToken: 500,
} as const;

export const savedSectionLimits = {
  name: 200,
  shortcode: 200_000,
  cssCode: 100_000,
} as const;

export const heartbeatBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
  })
  .strict();

export const claimBodySchema = z.object({}).strict();

export const completeJobBodySchema = z
  .object({
    shortcode: z
      .string()
      .min(1)
      .max(500_000)
      .refine((value) => value.trim().length > 0),
  })
  .strict();

export const failJobBodySchema = z
  .object({
    error: z.string().trim().min(1).max(4_000),
  })
  .strict();

export const createDevJobBodySchema = z
  .object({
    prompt: z.string().trim().min(1).max(10_000),
  })
  .strict();

// The target site is named explicitly by UUID or exact domain, never inferred.
export const provisionSiteTokenBodySchema = z.union([
  z.object({ siteId: z.uuid() }).strict(),
  z
    .object({
      domain: z
        .string()
        .trim()
        .min(1)
        .max(253)
        .transform((value) => value.toLowerCase()),
    })
    .strict(),
]);

/**
 * Body for creating a saved section.
 *
 * `.strict()` is the ownership guard: a body carrying `siteId`, `site_id`, or a
 * preview path is rejected outright rather than quietly ignored. The site comes
 * from the bearer token and can never be chosen by the caller.
 *
 * `shortcode` and `cssCode` are checked for type, emptiness, and length and are
 * otherwise untouched. They are not trimmed, sanitised, or normalised: both are
 * verbatim payloads whose own whitespace is meaningful.
 */
export const createSavedSectionBodySchema = z
  .object({
    name: z.string().trim().min(1).max(savedSectionLimits.name),
    shortcode: z
      .string()
      .min(1)
      .max(savedSectionLimits.shortcode)
      .refine((value) => value.trim().length > 0),
    cssCode: z.string().max(savedSectionLimits.cssCode).nullish(),
  })
  .strict();

export type CreateSavedSectionBody = z.infer<typeof createSavedSectionBodySchema>;
export type HeartbeatBody = z.infer<typeof heartbeatBodySchema>;
export type ProvisionSiteTokenBody = z.infer<typeof provisionSiteTokenBodySchema>;
export type CompleteJobBody = z.infer<typeof completeJobBodySchema>;
export type FailJobBody = z.infer<typeof failJobBodySchema>;
export type CreateDevJobBody = z.infer<typeof createDevJobBodySchema>;
