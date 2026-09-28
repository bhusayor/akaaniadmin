/* ═══════════════════════════════════════════════════════
   LOCAL NUTRITION DATA — WAFCT + USDA

   Stands in for the platform API's nutrition endpoints while those are
   switched off (the API calls are commented out at each call site):

     GET  /v1/nutrition/ingredients   → searchNutrition()
     POST /v1/nutrition/calculate     → calculateNutrition()

   Same argument and response shapes, so the screens did not have to
   change their reading of it. The data is src/data/nutritionData.js,
   generated from the Akaani WAFCT data model workbook and the USDA
   FoodData Central Foundation Foods export by
   scripts/build_nutrition_data.py.

   It is loaded on first use, not bundled into the main chunk: 1,391
   records is ~680 KB of source that no page but these needs.
   ═══════════════════════════════════════════════════════ */

export const NUTRITION_SOURCES = ['usda', 'wafct'];

let loading = null;
/** Every record, A → Z. Resolves once; later calls reuse it. */
export function loadRecords() {
  if (!loading) {
    loading = import('../data/nutritionData.js')
      .then((m) => sortByName(m.default))
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** A → Z by name, ignoring case and accents. Returns a new array. */
export function sortByName(rows = [], read = (r) => r?.name) {
  return [...rows].sort((a, b) => collator.compare(String(read(a) ?? ''), String(read(b) ?? '')));
}

/** Lowercase, accents stripped: "Égusi" and "egusi" are the same search. */
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const haystack = (r) => fold([r.name, r.name_fr, r.food_name, r.product_group].join(' | '));

/**
 * Every word of the query must appear somewhere in the name (English or
 * French), the food name or the product group.
 */
export function matches(record, search) {
  const words = fold(search).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = haystack(record);
  return words.every((w) => text.includes(w));
}

/* For the picker: names that start with the query first, then names that
   contain it, then matches only on group — alphabetical within each. */
function rank(record, search) {
  const q = fold(search).trim();
  const name = fold(record.name);
  if (name.startsWith(q) || fold(record.food_name).startsWith(q)) return 0;
  if (name.includes(q)) return 1;
  return 2;
}

/**
 * GET /v1/nutrition/ingredients, locally → { docs, stats }.
 *
 * `stats.docs` is every match; `stats.by_source` counts both sources for
 * the same search regardless of the source filter, as the API did, so a
 * page can say how many matches a filter hides.
 *
 * `order` is 'name' (A → Z, the table) or 'relevance' (the picker).
 */
export async function searchNutrition({
  search = '', source, product_group: productGroup, page = 1, limit = 25, order = 'name',
} = {}) {
  const all = await loadRecords();
  const q = String(search).trim();

  const inGroup = all.filter((r) => (!productGroup || r.product_group === productGroup) && matches(r, q));
  const bySource = Object.fromEntries(NUTRITION_SOURCES.map((s) => [s, 0]));
  inGroup.forEach((r) => { bySource[r.source] = (bySource[r.source] || 0) + 1; });

  let hits = source ? inGroup.filter((r) => r.source === source) : inGroup;
  if (order === 'relevance' && q) {
    hits = [...hits].sort((a, b) => rank(a, q) - rank(b, q) || collator.compare(a.name, b.name));
  }

  const start = (Math.max(1, page) - 1) * limit;
  return {
    docs: hits.slice(start, start + limit),
    stats: { docs: hits.length, by_source: bySource },
  };
}

/** Product groups present in the data, per source: [{ name, source, count }], A → Z. */
export async function listProductGroups() {
  const all = await loadRecords();
  const counts = new Map();
  all.forEach((r) => {
    if (!r.product_group) return;
    const key = `${r.source}|${r.product_group}`;
    const entry = counts.get(key) || { name: r.product_group, source: r.source, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  });
  return sortByName([...counts.values()]);
}

/** One record by id, or null. */
export async function getRecord(id) {
  const all = await loadRecords();
  return all.find((r) => r._id === String(id)) ?? null;
}

/* ══════════════════════════════════════
   CALCULATION
══════════════════════════════════════ */

export const NUTRIENT_KEYS = ['calories', 'protein', 'carbohydrate', 'fat', 'fiber'];

/** The units the API's calculator converted (its GRAMS_PER_UNIT). */
export const GRAMS_PER_UNIT = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };

/**
 * Pure calculation over records already in hand — the part that is tested.
 *
 * A nutrient is complete only if every line's record published it. When
 * one did not, the total for that nutrient is null (unavailable) and the
 * ingredients responsible are listed, exactly as the API reported it: a
 * figure short by one ingredient is not a total.
 */
export function calculateFrom(records, lines = []) {
  const byId = new Map(records.map((r) => [r._id, r]));
  const sums = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0]));
  const missing = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, []]));
  const breakdown = [];

  lines.forEach(({ ingredientId, quantity, unit }) => {
    const record = byId.get(String(ingredientId));
    const factor = GRAMS_PER_UNIT[String(unit).toLowerCase()];
    if (!record || !factor) {
      const name = record?.name || String(ingredientId);
      NUTRIENT_KEYS.forEach((k) => missing[k].push({ id: String(ingredientId), name }));
      breakdown.push({ ingredientId, name, grams: null, nutrients: null });
      return;
    }
    const grams = Number(quantity) * factor;
    const nutrients = {};
    NUTRIENT_KEYS.forEach((k) => {
      const per100 = record.nutrients_per_100g?.[k];
      if (typeof per100 === 'number' && Number.isFinite(per100)) {
        nutrients[k] = (per100 * grams) / 100;
        sums[k] += nutrients[k];
      } else {
        nutrients[k] = null;
        missing[k].push({ id: record._id, name: record.name });
      }
    });
    breakdown.push({ ingredientId, name: record.name, source: record.source, grams, nutrients });
  });

  const incomplete = NUTRIENT_KEYS.filter((k) => missing[k].length);
  const totals = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, missing[k].length ? null : sums[k]]));
  return {
    totals,
    breakdown,
    completeness: {
      complete: incomplete.length === 0,
      incomplete_nutrients: incomplete,
      missing_by_nutrient: Object.fromEntries(incomplete.map((k) => [k, missing[k]])),
    },
    basis: 'per 100 g edible portion',
  };
}

/** POST /v1/nutrition/calculate, locally. */
export async function calculateNutrition(lines) {
  return calculateFrom(await loadRecords(), lines);
}
