export const sectionTypes = [
  {
    id: "section-type-about",
    name: "About",
    slug: "about",
  },
] as const;

export type SectionType = (typeof sectionTypes)[number];
export type SectionTypeSlug = SectionType["slug"];
