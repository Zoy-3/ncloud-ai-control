/**
 * Category handling for the central template library.
 *
 * `sections.category` is plain text by design — there is no categories table
 * and this patch does not add one. These helpers are the single place that
 * decides when two stored strings mean the same category, so the Sections
 * filters, the Template Manager dropdown, and the Categories page all agree.
 */

/** Longest category name accepted when creating one. */
export const CATEGORY_MAX_LENGTH = 100;

/**
 * The comparison key for two category names.
 *
 * Deliberately narrow: surrounding whitespace and letter case only. Names that
 * differ in any other way — "Ecommerce" and "E-commerce" — are genuinely
 * different values and are left alone rather than silently merged.
 */
export function categoryKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The distinct categories present in a set of records.
 *
 * The first spelling encountered wins and is kept exactly as stored, so the
 * display value is never rewritten. Sorting is case-insensitive so the list
 * reads naturally regardless of how each name was capitalised.
 *
 * @param records Anything carrying a category string.
 */
export function collectCategories(
  records: readonly { category: string }[],
): string[] {
  const canonical = new Map<string, string>();

  for (const record of records) {
    if (typeof record.category !== "string") {
      continue;
    }

    const display = record.category.trim();
    const key = categoryKey(display);

    if (display === "" || canonical.has(key)) {
      continue;
    }

    canonical.set(key, display);
  }

  return [...canonical.values()].sort((first, second) =>
    first.toLowerCase().localeCompare(second.toLowerCase()),
  );
}

/**
 * The existing category a proposed name should reuse, if any.
 *
 * Typing "tourism" when "Tourism" already exists must not create a second
 * category, so the stored spelling is returned instead of the typed one.
 *
 * @returns The canonical existing value, or null when the name is genuinely new.
 */
export function matchExistingCategory(
  proposed: string,
  existing: readonly string[],
): string | null {
  const key = categoryKey(proposed);

  if (key === "") {
    return null;
  }

  return existing.find((value) => categoryKey(value) === key) ?? null;
}

/** Whether a proposed new category name is usable. */
export function isUsableCategoryName(value: string): boolean {
  const trimmed = typeof value === "string" ? value.trim() : "";

  return trimmed.length > 0 && trimmed.length <= CATEGORY_MAX_LENGTH;
}

/**
 * Resolves what should actually be stored for a category.
 *
 * An equivalent existing category is reused so the library does not accumulate
 * near-duplicates; anything genuinely new is stored trimmed, exactly as typed.
 *
 * @returns The value to store, or null when the name is unusable.
 */
export function resolveCategoryValue(
  proposed: string,
  existing: readonly string[],
): string | null {
  if (!isUsableCategoryName(proposed)) {
    return null;
  }

  return matchExistingCategory(proposed, existing) ?? proposed.trim();
}
