/* ═══════════════════════════════════════════════════════
   NUTRITION SEARCH GROUPING

   The endpoint returns one row per *preparation*: fonio comes back as
   "Fonio, white, whole grains, raw", "Fonio, black, whole grains,
   boiled (without salt), drained" and six more. A picker that lists
   those flat makes someone read eight near-identical lines to find the
   one they cooked.

   So rows are grouped by the *food* they are preparations of — across
   both sources. A person looking for pepper wants one "Pepper" with every
   preparation under it, not a WAFCT "Pepper", another WAFCT "Pepper" and
   seven USDA "Peppers", which reads as twelve different foods. Each
   preparation keeps its own source tag, so where a figure came from is
   still visible.

   A row's food name is the model's `food_name` on WAFCT records, else
   the part of its name before the first comma ("Peppers" in "Peppers,
   bell, green, raw"). Names are compared folded — case, accents and a
   plural ignored — so "Pepper" and "Peppers" are one food. WAFCT rows
   sharing a `food_id` stay together even when their names differ.
   ═══════════════════════════════════════════════════════ */

const clean = (v) => String(v ?? '').trim();

/** "Fonio, white, whole grains, raw" → "Fonio" */
const headOf = (name) => clean(name).split(',')[0].trim();

const fold = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');

/** "berries" → "berry", "tomatoes" → "tomato", "peppers" → "pepper"; "hummus" stays. */
function singular(word) {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (/(ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** The comparable form of a food name: folded, last word made singular. */
export function foodKey(name) {
  const words = fold(name).split(' ').filter(Boolean);
  if (!words.length) return '';
  words[words.length - 1] = singular(words[words.length - 1]);
  return words.join(' ');
}

/** The food a row is a preparation of, as a person would name it. */
const foodNameOf = (doc) => clean(doc.food_name) || headOf(doc.name) || clean(doc.name);

/* Within a group, WAFCT's preparations first and then USDA's, each in the
   order the endpoint sent them, so the two sources read as two runs
   rather than interleaved. */
const SOURCE_ORDER = ['wafct', 'usda'];
const sourceRank = (s) => {
  const i = SOURCE_ORDER.indexOf(s);
  return i === -1 ? SOURCE_ORDER.length : i;
};

/**
 * Groups search results by food, across sources. Groups keep the order
 * the endpoint sent them in — it ranks by relevance, and reordering here
 * would quietly override that.
 *
 * @returns {Array<{ key, label, source, sources, counts, docs }>}
 *   `source` is the single source, or 'mixed'; `sources` lists every
 *   source present and `counts` how many preparations each contributed.
 */
export function groupByFood(docs = []) {
  const groups = [];
  const byKey = new Map();
  const byFoodId = new Map();

  docs.forEach((doc) => {
    const foodId = clean(doc.food_id);
    const key = foodKey(foodNameOf(doc)) || `doc:${doc._id}`;
    let group = (foodId && byFoodId.get(foodId)) || byKey.get(key);
    if (!group) {
      group = { key, label: '', docs: [] };
      groups.push(group);
      byKey.set(key, group);
    }
    if (foodId && !byFoodId.has(foodId)) byFoodId.set(foodId, group);
    group.docs.push(doc);
  });

  groups.forEach((group) => {
    group.docs = group.docs
      .map((doc, i) => ({ doc, i }))
      .sort((a, b) => sourceRank(a.doc.source) - sourceRank(b.doc.source) || a.i - b.i)
      .map(({ doc }) => doc);

    /* The data model's food name where there is one — it is the name the
       team chose — else the name the first row goes by. */
    const named = group.docs.find((d) => clean(d.food_name));
    group.label = named ? clean(named.food_name) : foodNameOf(group.docs[0]) || 'Unnamed';

    group.counts = {};
    group.docs.forEach((d) => { group.counts[d.source] = (group.counts[d.source] || 0) + 1; });
    group.sources = Object.keys(group.counts).sort((a, b) => sourceRank(a) - sourceRank(b));
    group.source = group.sources.length === 1 ? group.sources[0] : 'mixed';
  });

  return groups;
}

/**
 * What to print under a group heading.
 *
 * `total` is stats.docs — every match, not just this page. When a page
 * does not hold them all, the count says so rather than implying a food
 * has fewer preparations than it does. A group drawn from both sources
 * says how many came from each.
 */
export function preparationsLabel(group, { shown, total } = {}) {
  const n = group.docs.length;
  const truncated = typeof total === 'number' && typeof shown === 'number' && total > shown;
  const noun = n === 1 ? 'preparation' : 'preparations';
  const split = (group.sources || []).length > 1
    ? ` · ${group.sources.map((s) => `${group.counts[s]} ${s.toUpperCase()}`).join(', ')}`
    : '';
  return `${n} ${noun}${truncated ? ' on this page' : ''}${split} · figures per 100 g`;
}

/**
 * The preparation itself, with the food name stripped off the front:
 * "white, whole grains, raw" under Fonio, and "bell, green, raw" for
 * USDA's "Peppers, bell, green, raw" under Pepper.
 */
export function preparationName(doc, group) {
  const name = clean(doc.name);
  const head = headOf(name);
  if (group?.key && foodKey(head) === group.key) {
    const rest = name.slice(head.length).replace(/^[\s,]+/, '');
    return rest || name;
  }
  const label = clean(group?.label);
  if (!label || !name.toLowerCase().startsWith(label.toLowerCase())) return name;
  const rest = name.slice(label.length).replace(/^[\s,]+/, '');
  return rest || name;
}
