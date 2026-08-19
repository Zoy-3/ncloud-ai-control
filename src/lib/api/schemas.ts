import { z } from "zod";

export const requestBodyLimits = {
  claim: 16,
  complete: 510_000,
  createJob: 12_000,
  adminSignIn: 1_000,
  createSavedSection: 320_000,
  createTemplate: 320_000,
  updateTemplate: 320_000,
  fail: 8_000,
  heartbeat: 1_000,
  provisionSiteToken: 500,
} as const;

export const savedSectionLimits = {
  name: 200,
  shortcode: 200_000,
  cssCode: 100_000,
} as const;

export const templateLimits = {
  name: 200,
  category: 100,
  sectionType: 100,
  style: 100,
  shortcode: 200_000,
  cssCode: 100_000,
} as const;

/**
 * A verbatim payload: checked for type, emptiness, and length, and otherwise
 * untouched. Shortcode and CSS are never trimmed or normalised, because their
 * own whitespace is part of the content.
 */
const verbatim = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value.trim().length > 0);

export const sectionStatusSchema = z.enum(["draft", "published", "archived"]);

export const adminSignInBodySchema = z
  .object({
    secret: z.string().min(1).max(512),
  })
  .strict();

/**
 * Body for creating a central template.
 *
 * `.strict()` refuses anything else, including a preview path or URL: previews
 * are uploaded through their own endpoint and the storage path is generated on
 * the server.
 */
export const createTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(templateLimits.name),
    category: z.string().trim().min(1).max(templateLimits.category),
    sectionType: z.string().trim().min(1).max(templateLimits.sectionType),
    style: z.string().trim().max(templateLimits.style).nullish(),
    shortcode: verbatim(templateLimits.shortcode),
    cssCode: z.string().max(templateLimits.cssCode).nullish(),
    status: sectionStatusSchema.optional(),
  })
  .strict();

/**
 * Body for editing a central template.
 *
 * Every field is optional and only the fields present are written, so an edit
 * to the name cannot blank the shortcode. At least one field is required.
 */
export const updateTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(templateLimits.name).optional(),
    category: z.string().trim().min(1).max(templateLimits.category).optional(),
    sectionType: z
      .string()
      .trim()
      .min(1)
      .max(templateLimits.sectionType)
      .optional(),
    style: z.string().trim().max(templateLimits.style).nullish(),
    shortcode: verbatim(templateLimits.shortcode).optional(),
    cssCode: z.string().max(templateLimits.cssCode).nullish(),
    status: sectionStatusSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be supplied.",
  });

export type AdminSignInBody = z.infer<typeof adminSignInBodySchema>;
export type CreateTemplateBody = z.infer<typeof createTemplateBodySchema>;
export type UpdateTemplateBody = z.infer<typeof updateTemplateBodySchema>;

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
