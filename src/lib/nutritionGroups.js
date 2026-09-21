/* ═══════════════════════════════════════════════════════
   NUTRITION SEARCH GROUPING

   The endpoint returns one row per *preparation*: fonio comes back as
   "Fonio, white, whole grains, raw", "Fonio, black, whole grains,
   boiled (without salt), drained" and six more. A picker that lists
   those flat makes someone read eight near-identical lines to find the
   one they cooked.

   So rows are grouped by the food they are preparations of. WAFCT rows
   carry `food_id` from the Akaani nutrition data model, which is exactly
   that key. USDA rows have none — the model covers WAFCT only — so each
   stands alone.

   The group's display name is derived from the rows, because the API
   does not expose the model's `food_name_en` (or its `local_names`
   aliases). See the note in README.
   ═══════════════════════════════════════════════════════ */

const clean = (v) => String(v ?? '').trim();

/** "Fonio, white, whole grains, raw" → "Fonio" */
const headOf = (name) => clean(name).split(',')[0].trim();

/**
 * A label every row in the group agrees with: the part before the first
 * comma when they share it, else the shortest full name, which is the
 * least wrong thing to show.
 */
function groupLabel(docs) {
  const heads = docs.map((d) => headOf(d.name)).filter(Boolean);
  const first = heads[0];
  if (first && heads.every((h) => h.toLowerCase() === first.toLowerCase())) return first;
  return docs
    .map((d) => clean(d.name))
    .filter(Boolean)
    .sort((a, b) => a.length - b.length)[0] || 'Unnamed';
}

/**
 * Groups search results by food, preserving the order the endpoint sent
 * them in — it sorts by relevance, and reordering here would quietly
 * override that.
 *
 * @returns {Array<{ key, label, source, docs }>}
 */
export function groupByFood(docs = []) {
  const groups = [];
  const index = new Map();

  docs.forEach((doc) => {
    // No food_id means the model does not cover this row; it is its own group.
    const key = clean(doc.food_id) ? `food:${clean(doc.food_id)}` : `doc:${doc._id}`;
    if (!index.has(key)) {
      const group = { key, label: '', source: doc.source, docs: [] };
      index.set(key, group);
      groups.push(group);
    }
    index.get(key).docs.push(doc);
  });

  groups.forEach((group) => {
    group.label = groupLabel(group.docs);
    // A group is single-source in practice; if it ever is not, say so plainly.
    if (!group.docs.every((d) => d.source === group.source)) group.source = 'mixed';
  });

  return groups;
}

/**
 * What to print under a group heading.
 *
 * `total` is stats.docs — every match, not just this page. When a page
 * does not hold them all, the count says so rather than implying a food
 * has fewer preparations than it does.
 */
export function preparationsLabel(group, { shown, total } = {}) {
  const n = group.docs.length;
  const truncated = typeof total === 'number' && typeof shown === 'number' && total > shown;
  const noun = n === 1 ? 'preparation' : 'preparations';
  return truncated
    ? `${n} ${noun} on this page · figures per 100 g`
    : `${n} ${noun} · figures per 100 g`;
}

/** The preparation itself, with the food name stripped off the front. */
export function preparationName(doc, group) {
  const name = clean(doc.name);
  const head = clean(group?.label);
  if (!head || !name.toLowerCase().startsWith(head.toLowerCase())) return name;
  const rest = name.slice(head.length).replace(/^[\s,]+/, '');
  return rest || name;
}
