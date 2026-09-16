/* ═══════════════════════════════════════════════════════
   AKAANI ADMIN — INGREDIENT RECORD

   The single normalisation path. Both the manual form and the CSV
   importer build records through `normalizeIngredient`, so there is no
   second write path to drift out of sync.
   ═══════════════════════════════════════════════════════ */

export const WAFCT_SOURCE = 'FAO/INFOODS WAFCT 2019';

export const MACRO_KEYS = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'];

/** '' / null / undefined / non-numeric -> null. A missing value is NEVER 0. */
export function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

export function isAiSource(source) {
  return typeof source === 'string' && source.indexOf('AI estimate') === 0;
}

export function hasNutrition(record) {
  return MACRO_KEYS.some((k) => record[k] !== null && record[k] !== undefined);
}

let nextId = 100;

/**
 * Builds a complete ingredient record from loose input.
 * Missing macros stay null — never coerced to 0.
 */
export function normalizeIngredient(data, id) {
  // Seeded rows arrive with their own ids (100+); never hand one out again.
  if (typeof id === 'number' && id >= nextId) nextId = id + 1;
  return {
    id: id ?? nextId++,
    name: String(data.name || '').trim(),
    description: String(data.description || '').trim(),
    unit: data.unit || '',
    product_group: data.product_group || '',
    product_category: data.product_category || '',
    // Not a managed field — nothing in the UI collects or shows it. Kept so
    // a product_url column in an imported CSV round-trips back out on export
    // rather than being silently dropped.
    product_url: data.product_url || '',
    calories: toNum(data.calories),
    protein_g: toNum(data.protein_g),
    carbs_g: toNum(data.carbs_g),
    fat_g: toNum(data.fat_g),
    fibre_g: toNum(data.fibre_g),
    source: data.source || null,
    source_code: data.source_code || null,
    image: data.image || null,
  };
}

/** Formats a macro for display. null reads as an em dash, never as 0. */
export function fmtMacro(v, suffix = '') {
  if (v === null || v === undefined) return '—';
  return `${Math.round(v * 10) / 10}${suffix}`;
}
