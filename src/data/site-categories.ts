/**
 * DEMO FIXTURE — NOT A PRODUCTION DATA SOURCE.
 *
 * Sample site categories used by the demo API route.
 *
 * These records are sample content for the in-memory `GET /api/sections`
 * demonstration route only. The real central template library is the Supabase
 * `sections` table, read through `@/lib/templates/admin-repository`.
 *
 * Dashboard → Sections used to render this file, which made it show four
 * templates that did not exist in the database. It no longer does, and it must
 * never do so again: any page or API that represents the real library must read
 * the database.
 */

export const siteCategories = [
  {
    id: "category-corporate",
    name: "Corporate",
    slug: "corporate",
    description:
      "Professional business, technology, consulting and service company websites.",
  },
  {
    id: "category-tourism",
    name: "Tourism",
    slug: "tourism",
    description:
      "Travel agencies, tour operators, destination and tourism websites.",
  },
  {
    id: "category-hotel",
    name: "Hotel",
    slug: "hotel",
    description:
      "Hotels, villas, resorts, guest houses and accommodation websites.",
  },
  {
    id: "category-ecommerce",
    name: "E-commerce",
    slug: "ecommerce",
    description:
      "Online stores, product brands, retail and WooCommerce websites.",
  },
] as const;

export type SiteCategory = (typeof siteCategories)[number];
export type SiteCategorySlug = SiteCategory["slug"];
