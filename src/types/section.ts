import type { SectionTypeSlug } from "@/data/section-types";
import type { SiteCategorySlug } from "@/data/site-categories";

export type SectionStatus = "draft" | "published" | "archived";

export interface Section {
  id: string;
  name: string;
  slug: string;
  category: SiteCategorySlug;
  sectionType: SectionTypeSlug;
  style: string;
  layout: string;
  description: string;
  tags: string[];
  previewImage: string;
  shortcode: string;
  status: SectionStatus;
}
