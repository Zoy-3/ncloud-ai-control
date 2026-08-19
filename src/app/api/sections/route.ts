/**
 * DEMO ROUTE — in-memory sample data, not the template library.
 *
 * This is not the WordPress-facing API and does not read Supabase. The real
 * library is served by `/api/wordpress/sections` for sites and by
 * `/api/admin/templates` for administrators.
 */
import { sampleSections } from "@/data/sample-sections";

export function GET(request: Request) {
  const requestedCategory = new URL(request.url).searchParams
    .get("category")
    ?.trim()
    .toLowerCase();

  const sections = requestedCategory
    ? sampleSections.filter(
        (section) => section.category.toLowerCase() === requestedCategory,
      )
    : sampleSections;

  return Response.json({
    success: true,
    sections,
  });
}
