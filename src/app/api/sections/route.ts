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
