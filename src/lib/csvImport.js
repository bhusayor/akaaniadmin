/* ═══════════════════════════════════════════════════════
   AKAANI ADMIN — CSV IMPORT

   The review-classification pass. Kept free of React and the DOM so it
   can be tested directly. Parsing itself lives in ./csv.js.
   ═══════════════════════════════════════════════════════ */

import { findMatches, suggestTaxonomy, PRODUCT_CATEGORIES, MATCHED_THRESHOLD, REVIEW_THRESHOLD } from './wafctMatch.js';
import { MACRO_KEYS, toNum, normalizeIngredient, isAiSource, WAFCT_SOURCE } from './ingredients.js';

/* Re-exported so callers have one import for the whole CSV flow. */
export { parseCSV, toCSV, downloadCSV } from './csv.js';

/** Header aliases — tolerate the obvious spellings. */
export const HEADER_MAP = {
  name: 'name', ingredient: 'name', ingredient_name: 'name',
  description: 'description', desc: 'description',
  unit: 'unit', units: 'unit',
  product_group: 'product_group', group: 'product_group',
  product_category: 'product_category', category: 'product_category',
  product_url: 'product_url', url: 'product_url', link: 'product_url',
  calories: 'calories', kcal: 'calories', energy: 'calories', calorie: 'calories',
  protein_g: 'protein_g', protein: 'protein_g',
  carbs_g: 'carbs_g', carbs: 'carbs_g', carbohydrate: 'carbs_g', carbohydrates: 'carbs_g',
  fat_g: 'fat_g', fat: 'fat_g', fats: 'fat_g',
  fibre_g: 'fibre_g', fibre: 'fibre_g', fiber: 'fibre_g', fiber_g: 'fibre_g',
  image_url: 'image_url', image: 'image_url',
};

export const EXPECTED_COLUMNS = [
  'name', 'description', 'unit', 'product_group', 'product_category',
  'calories', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g',
];

/**
 * Classifies every CSV line for the review table.
 *
 * Rows missing calories (or all five macros) are matched against WAFCT.
 * ≥88 is pre-checked, 70–87 is shown unchecked, below 70 has nothing to
 * apply until someone asks for an AI estimate.
 *
 * @returns {{rows: Array, error: string|null}}
 */
export function buildReviewRows(grid) {
  if (!grid.length) return { rows: [], error: 'That CSV looks empty' };

  const headers = grid[0].map(
    (h) => HEADER_MAP[String(h).trim().toLowerCase().replace(/\s+/g, '_')] || null,
  );
  if (!headers.includes('name')) return { rows: [], error: 'CSV needs a "name" column' };

  const rows = [];

  for (const cells of grid.slice(1)) {
    const raw = {};
    headers.forEach((h, i) => { if (h) raw[h] = (cells[i] || '').trim(); });
    if (!raw.name) continue;

    const macros = {
      calories: toNum(raw.calories),
      protein_g: toNum(raw.protein_g),
      carbs_g: toNum(raw.carbs_g),
      fat_g: toNum(raw.fat_g),
      fibre_g: toNum(raw.fibre_g),
    };
    const allNull = MACRO_KEYS.every((k) => macros[k] === null);
    const needsMatch = macros.calories === null || allNull;

    const row = {
      name: raw.name,
      description: raw.description || '',
      unit: raw.unit || '',
      product_group: raw.product_group || '',
      product_category: raw.product_category || '',
      product_url: raw.product_url || '',
      image_url: raw.image_url || '',
      macros,
      source: null,
      source_code: null,
      match: null,
      score: null,
      confidence: null,
      selectable: true,
      checked: false,
    };

    if (!needsMatch) {
      row.source = 'csv';
      row.checked = true;
    } else {
      const best = findMatches(raw.name)[0];
      if (best && best.score >= REVIEW_THRESHOLD) {
        const f = best.food;
        row.match = f;
        row.score = best.score;
        row.confidence = best.confidence;
        row.source = 'WAFCT';
        row.source_code = f.food_id;
        row.macros = {
          calories: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g,
          fat_g: f.fat_g, fibre_g: f.fibre_g,
        };
        row.checked = best.score >= MATCHED_THRESHOLD;

        const tax = suggestTaxonomy(f);
        if (!row.product_group && tax.group) row.product_group = tax.group;
        if (
          !row.product_category && tax.category &&
          (PRODUCT_CATEGORIES[row.product_group] || []).includes(tax.category)
        ) {
          row.product_category = tax.category;
        }
      } else {
        // Below 70: macros stay blank and there is nothing to apply.
        row.selectable = false;
      }
    }
    rows.push(row);
  }

  if (!rows.length) return { rows: [], error: 'No usable rows in that CSV' };
  return { rows, error: null };
}

/**
 * Turns reviewed rows into ingredient records.
 *
 * Everything goes through `normalizeIngredient`, the same path the manual
 * form uses — there is no separate bulk write path.
 *
 * @returns {{created: Array, skipped: Array, noMatch: Array}}
 */
export function applyReviewRows(rows) {
  const created = [];
  const skipped = [];
  const noMatch = [];

  for (const r of rows) {
    if (!r.selectable) { noMatch.push(r); continue; }
    if (!r.checked)    { skipped.push(r); continue; }

    created.push(
      normalizeIngredient({
        name: r.name,
        description: r.description,
        unit: r.unit,
        product_group: r.product_group,
        product_category: r.product_category,
        product_url: r.product_url,
        calories: r.macros.calories,
        protein_g: r.macros.protein_g,
        carbs_g: r.macros.carbs_g,
        fat_g: r.macros.fat_g,
        fibre_g: r.macros.fibre_g,
        // A WAFCT row is stamped with the full citation; an AI row keeps
        // its own source so it can never read as measured data.
        source: r.source === 'WAFCT' ? WAFCT_SOURCE : r.source,
        source_code: r.source_code || null,
        image: r.image_url || null,
      }),
    );
  }
  return { created, skipped, noMatch };
}

/** The rows an import left behind, as CSV, so the gap stays visible. */
export function gapReportRows({ skipped, noMatch }) {
  const head = [...EXPECTED_COLUMNS, 'product_url', 'reason'];
  const out = [head];

  for (const r of noMatch) {
    out.push([r.name, r.description, r.unit, r.product_group, r.product_category,
      '', '', '', '', '', r.product_url,
      `no WAFCT match above ${REVIEW_THRESHOLD}% (not estimated)`]);
  }
  for (const r of skipped) {
    out.push([r.name, r.description, r.unit, r.product_group, r.product_category,
      r.macros.calories, r.macros.protein_g, r.macros.carbs_g, r.macros.fat_g, r.macros.fibre_g,
      r.product_url,
      'unchecked during review' +
        (isAiSource(r.source) ? ' (AI estimate)' : r.score ? ` (WAFCT ${Math.round(r.score)}%)` : '')]);
  }
  return out;
}
