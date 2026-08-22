/* ═══════════════════════════════════════════════════════
   MEAL NUTRITION

   Macros computed from the reference sets rather than asked of a model.

   The PRD requires estimates to be labelled as such "unless verified by an
   approved deterministic service". This is that service: each ingredient
   name is matched against WAFCT and USDA, its quantity converted to grams,
   and the per-100g figures scaled and summed.

   Two different uncertainties are tracked separately, because collapsing
   them would overstate what is known:

     the reference figures  are measured — FAO/INFOODS and USDA
     the portion conversion is exact only for mass units; a "cup" of rice
                            and a "cup" of spinach do not weigh the same

   So a recipe written in grams reports `measured`, and one written in cups
   reports `approximate` — with the same underlying data behind both.
   ═══════════════════════════════════════════════════════ */

import { findMatches, MATCHED_THRESHOLD, REVIEW_THRESHOLD } from './wafctMatch.js';
import { WAFCT_FOODS, USDA_FOODS, datasetOf } from './foodDatabase.js';

export const MACROS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'];

/** Mass units convert exactly; nothing else does. */
const MASS_G = {
  g: 1, gram: 1, grams: 1, gramme: 1, grammes: 1,
  kg: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
  mg: 0.001,
  oz: 28.35, ounce: 28.35, ounces: 28.35,
  lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6,
};

/**
 * Rough weights for the measures recipes are actually written in.
 *
 * These are averages across foods, not per-ingredient densities, so any
 * total that depends on one is reported as approximate. They exist because
 * refusing to total a recipe written in cups is less useful than totalling
 * it and saying how it was done.
 */
const APPROX_G = {
  cup: 150, cups: 150,
  tbsp: 15, tablespoon: 15, tablespoons: 15, tbs: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  ml: 1, l: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000,
  pinch: 0.5, pinches: 0.5, dash: 0.5,
  clove: 5, cloves: 5,
  slice: 25, slices: 25,
  piece: 80, pieces: 80,
  medium: 110, large: 160, small: 70,
  bunch: 100, bunches: 100, handful: 30, handfuls: 30,
  sprig: 3, sprigs: 3, stick: 60, sticks: 60,
  can: 400, cans: 400, tin: 400, tins: 400,
  sachet: 10, sachets: 10, cube: 4, cubes: 4,
  leaf: 2, leaves: 2, bulb: 60, bulbs: 60,
  head: 500, heads: 500, thumb: 15, thumbs: 15, knob: 15, knobs: 15,
  fillet: 150, fillets: 150, tuber: 400, tubers: 400,
};

/** `1 1/2`, `½`, `2.5` → a number. */
export function parseQuantity(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  const VULGAR = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
  let total = 0;
  let seen = false;

  for (const token of s.split(/\s+/)) {
    if (VULGAR[token] !== undefined) { total += VULGAR[token]; seen = true; continue; }
    const frac = /^(\d+)\/(\d+)$/.exec(token);
    if (frac) { total += Number(frac[1]) / Number(frac[2]); seen = true; continue; }
    /* A range — "2-3 cloves" — takes its midpoint. */
    const range = /^(\d*\.?\d+)\s*[-–]\s*(\d*\.?\d+)$/.exec(token);
    if (range) { total += (Number(range[1]) + Number(range[2])) / 2; seen = true; continue; }
    const n = Number(token);
    if (Number.isFinite(n)) { total += n; seen = true; continue; }
    const lead = /^(\d*\.?\d+)/.exec(token);
    if (lead) { total += Number(lead[1]); seen = true; }
  }
  return seen ? total : null;
}

/**
 * An ingredient's weight in grams.
 *
 * @returns {{grams: number, exact: boolean}|null} null when there is
 *          nothing to convert — an unmeasured "salt to taste".
 */
export function toGrams(quantity, unit) {
  const n = parseQuantity(quantity);
  if (n === null) return null;

  const key = String(unit ?? '').trim().toLowerCase().replace(/[.]/g, '');
  if (!key) {
    /* A bare count — "2 onions". Treated as pieces, so approximate. */
    return { grams: n * APPROX_G.piece, exact: false };
  }
  if (MASS_G[key] !== undefined) return { grams: n * MASS_G[key], exact: true };
  if (APPROX_G[key] !== undefined) return { grams: n * APPROX_G[key], exact: false };

  /* A unit written into the name — "2 cups (300g)". */
  const embedded = /(\d*\.?\d+)\s*(g|kg|ml|oz|lb)\b/i.exec(key);
  if (embedded) {
    const g = MASS_G[embedded[2].toLowerCase()];
    if (g) return { grams: Number(embedded[1]) * g, exact: true };
  }
  return null;
}

/** The best reference row for an ingredient name, or null. */
export function resolveIngredient(name) {
  const clean = String(name ?? '').replace(/\([^)]*\)/g, ' ').trim();
  if (!clean) return null;

  const seen = new Set();
  const hits = [...findMatches(clean, WAFCT_FOODS), ...findMatches(clean, USDA_FOODS)]
    .filter((r) => {
      if (r.score < REVIEW_THRESHOLD || seen.has(r.food.food_id)) return false;
      seen.add(r.food.food_id);
      return true;
    })
    .sort((a, b) => b.score - a.score);

  return hits[0] ?? null;
}

const round = (v, dp = 1) => (v === null ? null : Math.round(v * 10 ** dp) / 10 ** dp);

/**
 * Totals a recipe from its ingredient list.
 *
 * @param ingredients the meal's ingredient rows
 * @param servings    to divide by; omitted leaves perServing null
 */
export function computeNutrition(ingredients = [], servings = null) {
  const total = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 };
  const resolved = [];
  const unresolved = [];
  let anyApproximate = false;
  let contributing = 0;

  ingredients.forEach((ing) => {
    const name = String(ing?.name ?? '').trim();
    /* A section heading is not an ingredient. */
    if (!name || name.endsWith(':')) return;

    const hit = resolveIngredient(name);
    const weight = toGrams(ing.quantity, ing.unit);

    if (!hit || !weight) {
      unresolved.push({
        name,
        reason: !hit ? 'no reference match' : 'quantity could not be converted to grams',
      });
      return;
    }

    if (!weight.exact) anyApproximate = true;
    contributing += 1;

    const factor = weight.grams / 100;
    MACROS.forEach((k) => {
      const v = hit.food[k];
      /* A null nutrient stays out of the sum — adding it as 0 would
         understate the total and read as a measured zero. */
      if (typeof v === 'number') total[k] += v * factor;
    });

    resolved.push({
      name,
      matched: hit.food.name,
      source: datasetOf(hit.food),
      food_id: hit.food.food_id,
      score: Math.round(hit.score),
      confident: hit.score >= MATCHED_THRESHOLD,
      grams: round(weight.grams),
      exact: weight.exact,
    });
  });

  const counted = resolved.length + unresolved.length;
  const coverage = counted ? resolved.length / counted : 0;

  /* `measured` is claimed only when every ingredient resolved and every
     weight was exact. Anything less says so. */
  const confidence = !contributing ? 'none'
    : unresolved.length ? 'partial'
      : anyApproximate ? 'approximate' : 'measured';

  const perServing = servings > 0
    ? Object.fromEntries(MACROS.map((k) => [k, round(total[k] / servings)]))
    : null;

  return {
    total: Object.fromEntries(MACROS.map((k) => [k, round(total[k])])),
    perServing,
    resolved,
    unresolved,
    coverage: round(coverage * 100, 0),
    confidence,
  };
}

export const CONFIDENCE_NOTE = {
  measured: 'Totalled from FAO/INFOODS and USDA figures, with every quantity given by weight.',
  approximate: 'Totalled from FAO/INFOODS and USDA figures. Some quantities are volume or count measures, converted using average weights.',
  partial: 'Totalled from the ingredients that matched a reference. The unmatched ones are not included.',
  none: 'No ingredient could be matched to a reference, so no total is available.',
};
