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
