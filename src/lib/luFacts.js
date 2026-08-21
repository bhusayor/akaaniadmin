/* ═══════════════════════════════════════════════════════
   LU FACTS

   Short facts Lu surfaces next to an ingredient or meal. They render in
   a small in-app card, so length is a real constraint rather than a
   nicety — hence the budget and the preview.
   ═══════════════════════════════════════════════════════ */

export const FACT_CATEGORIES = ['Nutrition', 'Health', 'Storage', 'Preparation', 'Origin'];

export const CATEGORY_TONE = {
  Nutrition: 'bg-mint-light text-mint-deep',
  Health: 'bg-ocean-light text-ocean-deep',
  Storage: 'bg-grape-light text-grape',
  Preparation: 'bg-amber-light text-amber-deep',
  Origin: 'bg-chili-light text-chili-deep',
};

export const FACT_STATUSES = ['published', 'draft'];

/* The in-app card wraps to roughly three lines at this width. Past the
   limit the text is clipped on a phone, so the editor gets told. */
export const BODY_LIMIT = 220;
export const BODY_COMFORTABLE = 160;

let nextId = 800;

export function normalizeFact(data, id) {
  return {
    id: id ?? nextId++,
    title: String(data.title ?? '').trim(),
    body: String(data.body ?? '').trim(),
    emoji: data.emoji || '💡',
    image: data.image ?? null,
    category: FACT_CATEGORIES.includes(data.category) ? data.category : 'Nutrition',
    status: FACT_STATUSES.includes(data.status) ? data.status : 'draft',
    /* Optional link to the ingredient library, so a fact can be shown
       wherever that ingredient appears. */
    ingredient: String(data.ingredient ?? '').trim(),
    createdAt: data.createdAt || new Date().toISOString().slice(0, 10),
    updatedAt: data.updatedAt || data.createdAt || new Date().toISOString().slice(0, 10),
  };
}

/** How full the body is against the comfortable length, 0–1+. */
export function bodyLoad(body) {
  return String(body ?? '').trim().length / BODY_COMFORTABLE;
}

export function validateFact(form, existing = []) {
  const problems = [];
  const title = String(form.title ?? '').trim();
  const body = String(form.body ?? '').trim();

  if (!title) problems.push('Title is required');
  if (!body) problems.push('Fact is required');
  if (body.length > BODY_LIMIT) {
    problems.push(`Fact is ${body.length - BODY_LIMIT} characters over the ${BODY_LIMIT} limit`);
  }
  if (title && existing.some((f) => f.title.toLowerCase() === title.toLowerCase())) {
    problems.push(`A fact titled "${title}" already exists`);
  }
  return problems;
}

/**
 * Facts about the same subject, so near-duplicates are visible before
 * they both ship. Compared on the title, which is the subject here.
 */
export function duplicateTitles(facts) {
  const byTitle = new Map();
  facts.forEach((f) => {
    const key = f.title.toLowerCase();
    byTitle.set(key, [...(byTitle.get(key) ?? []), f]);
  });
  return [...byTitle.values()].filter((group) => group.length > 1);
}

export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
