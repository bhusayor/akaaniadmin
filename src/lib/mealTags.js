/* ═══════════════════════════════════════════════════════
   MEAL TAGS

   The tag vocabulary. The tag→meal relationship itself lives on the
   meal (`meal.tags`), so this never becomes a second source of truth
   about which meals carry which tag.
   ═══════════════════════════════════════════════════════ */

export const TAG_CATEGORIES = [
  'Dietary',
  'Context',
  'Cooking Method',
  'Special Occasion',
  'Cuisine',
];

/* Muted pills, one per category, so the table scans by colour. */
export const CATEGORY_TONE = {
  Dietary: 'bg-mint-light text-mint-deep',
  Context: 'bg-ocean-light text-ocean-deep',
  'Cooking Method': 'bg-grape-light text-grape',
  'Special Occasion': 'bg-amber-light text-amber-deep',
  Cuisine: 'bg-chili-light text-chili-deep',
};

let nextId = 700;

export function normalizeTag(data, id) {
  return {
    id: id ?? nextId++,
    name: String(data.name ?? '').trim(),
    category: String(data.category ?? '').trim(),
    description: String(data.description ?? '').trim(),
  };
}

/**
 * @param existing  the other tags, for the duplicate check
 */
export function validateTag(form, existing = []) {
  const problems = [];
  const name = String(form.name ?? '').trim();
  if (!name) problems.push('Name is required');
  if (!String(form.category ?? '').trim()) problems.push('Category is required');
  // Case-insensitive: "Comfort Food" and "comfort food" are the same tag,
  // and two of them would split a meal's tagging in half.
  if (name && existing.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    problems.push(`A tag called "${name}" already exists`);
  }
  return problems;
}

/** How many meals carry each tag name. */
export function usageByTag(meals) {
  const counts = new Map();
  meals.forEach((m) => (m.tags ?? []).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  return counts;
}

/**
 * Tag names that meals use but the vocabulary does not define.
 *
 * These are the ones that quietly break filtering: a meal carries the
 * tag, but nothing in the tag manager knows it exists.
 */
export function orphanTags(meals, tags) {
  const known = new Set(tags.map((t) => t.name.toLowerCase()));
  const seen = new Map();
  meals.forEach((m) => (m.tags ?? []).forEach((t) => {
    if (!known.has(t.toLowerCase())) seen.set(t, (seen.get(t) ?? 0) + 1);
  }));
  return [...seen].map(([name, count]) => ({ name, count }));
}
