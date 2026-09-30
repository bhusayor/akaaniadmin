/* ═══════════════════════════════════════════════════════
   MEAL NUTRITION

   Turns a meal's ingredient rows into POST /v1/nutrition/calculate lines
   and reads the response back.

   Row shape — on `ingredients_list`:
     ingredient_nutrition   a nutrition record _id from the search
     quantity               the recipe quantity: "200", "1/2", "1 ½"
     unit                   g | kg | oz | lb are counted; cups, pieces
                            etc. are kept for the cook but not counted

   The ingredients are the WHOLE MEAL. The calculation is the meal's
   total; perServingOf() divides it by the number of servings, which is
   what the app shows. suggestServings() proposes a starting number of
   servings from the total calories, and the admin adjusts it.

   Two rules run through everything here:

   - A row that cannot be calculated is EXCLUDED and named, never counted
     as zero. A total assembled from three of eight ingredients is not a
     total, and the UI has to be able to say so.
   - A nutrient the sources never published comes back null with
     completeness.complete false. Null is "unavailable", not 0g, and it
     must never be rendered as a number.
   ═══════════════════════════════════════════════════════ */

/** The only units the calculation converts (GRAMS_PER_UNIT). */
export const MASS_UNITS = ['g', 'kg', 'oz', 'lb'];

const UNIT_ALIASES = { lbs: 'lb', gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', ounce: 'oz', ounces: 'oz' };

/** "LBS" → "lb", "grams" → "g"; anything else lowercased as-is. */
export const normaliseUnit = (unit) => {
  const u = String(unit ?? '').trim().toLowerCase();
  return UNIT_ALIASES[u] || u;
};

const FRACTIONS = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };

/**
 * A recipe quantity as a number: "200", "1.5", "1/3", "1 1/2", "1½".
 * Null for anything else ("a thumb", "2-3", "") — never a guess.
 */
export function parseQuantity(text) {
  let s = String(text ?? '').trim().replace(',', '.');
  if (!s) return null;
  s = s.replace(/([0-9])?\s*([½⅓⅔¼¾⅛])/g, (_, whole, f) => ` ${whole || 0} ${FRACTIONS[f]}`).trim();
  const parts = s.split(/\s+/);
  if (parts.length > 3) return null;
  let total = 0;
  for (const part of parts) {
    let n;
    if (/^\d+\/\d+$/.test(part)) {
      const [a, b] = part.split('/').map(Number);
      n = b ? a / b : NaN;
    } else if (/^\d*\.?\d+$/.test(part)) {
      n = Number(part);
    } else {
      return null;
    }
    if (!Number.isFinite(n)) return null;
    total += n;
  }
  return total;
}

/** Backend nutrient key → the label the meal form uses. */
export const NUTRIENTS = [
  { key: 'calories', label: 'Calories', suffix: ' kcal', field: 'cal' },
  { key: 'protein', label: 'Protein', suffix: 'g', field: 'prot' },
  { key: 'carbohydrate', label: 'Carbs', suffix: 'g', field: 'carb' },
  { key: 'fat', label: 'Fat', suffix: 'g', field: 'fat' },
  { key: 'fiber', label: 'Fibre', suffix: 'g', field: 'fiber' },
];

const trimmed = (v) => String(v ?? '').trim();

/**
 * Splits rows into calculable lines and excluded rows.
 *
 * @returns {{ lines: Array, skipped: Array<{index, name, reason}> }}
 *   `skipped` carries a reason per row so the UI can show why, rather
 *   than quietly dropping it from the total.
 */
export function buildCalculateLines(rows = []) {
  const lines = [];
  const skipped = [];

  rows.forEach((row, index) => {
    const name = trimmed(row.name);
    const id = trimmed(row.ingredient_nutrition);
    // A row with neither a name nor a link is an empty editor row, not an omission.
    if (!name && !id) return;

    const rawQuantity = trimmed(row.quantity);
    const quantity = parseQuantity(rawQuantity);
    const unit = normaliseUnit(row.unit);
    const label = name || 'Unnamed ingredient';

    /* `kind` separates "nothing was chosen" from "something was chosen but is
       not usable yet". They read very differently to someone filling the form
       in: one is work not started, the other is work half done. */
    let reason = null;
    let kind = null;
    if (!id) { kind = 'unlinked'; reason = 'not from the ingredient database'; }
    else if (!rawQuantity) { kind = 'incomplete'; reason = 'no quantity'; }
    else if (quantity === null || quantity <= 0) {
      kind = 'incomplete';
      reason = `quantity "${rawQuantity}" is not a number above zero`;
    } else if (!unit) { kind = 'incomplete'; reason = 'no unit'; }
    else if (!MASS_UNITS.includes(unit)) {
      kind = 'incomplete';
      reason = `"${row.unit}" cannot be weighed — use ${MASS_UNITS.join(', ')}`;
    }

    if (reason) skipped.push({ index, name: label, reason, kind });
    else lines.push({ ingredientId: id, quantity, unit });
  });

  return { lines, skipped };
}

/**
 * Reads one nutrient out of a calculate response.
 *
 * A nutrient is available only when the server returned a number AND did
 * not list it under completeness: a figure that is short by one ingredient
 * is not a total, so it is reported as unavailable with the ingredients
 * that have no data for it.
 *
 * @returns {{ available: boolean, value: number|null, missingFor: string[] }}
 */
export function readNutrient(data, key) {
  const value = data?.totals?.[key];
  const completeness = data?.completeness || {};
  const incomplete = (completeness.incomplete_nutrients || []).includes(key);
  const missingFor = (completeness.missing_by_nutrient?.[key] || [])
    .map((m) => m?.name)
    .filter(Boolean);

  if (typeof value !== 'number' || !Number.isFinite(value) || incomplete) {
    return { available: false, value: null, missingFor };
  }
  return { available: true, value, missingFor: [] };
}

/** "Fibre unavailable for Pork, belly" — the sentence the designer asked for. */
export function unavailableLabel(label, missingFor) {
  if (!missingFor.length) return `${label} unavailable`;
  const names = missingFor.length <= 2
    ? missingFor.join(' and ')
    : `${missingFor.slice(0, 2).join(', ')} and ${missingFor.length - 2} more`;
  return `${label} unavailable for ${names}`;
}

export const round1 = (v) => Math.round(v * 10) / 10;

/**
 * A published per-100g figure, rounded for display, or null where the source
 * published nothing. Callers render the null — as an em dash, as
 * "unavailable" — but never as 0.
 */
export const macroValue = (v) => (typeof v === 'number' && Number.isFinite(v) ? round1(v) : null);

/**
 * What one macro field on the meal form shows.
 *
 * The figures are calculated, never typed, so the field reports which of
 * four things it is looking at rather than printing a number and leaving
 * the reader to guess where it came from:
 *
 *   calculated   this run of the calculation produced it
 *   unavailable  no ingredient published it — NOT 0
 *   saved        nothing is linked yet, so the meal's stored value stands
 *   empty        no calculation and nothing stored
 */
export function macroField(data, form, { key, field, suffix }) {
  if (data) {
    const { available, value, missingFor } = readNutrient(data, key);
    if (available) {
      const rounded = key === 'calories' ? Math.round(value) : round1(value);
      return { state: 'calculated', text: `${rounded}${suffix}`, missingFor: [] };
    }
    return { state: 'unavailable', text: 'unavailable', missingFor };
  }
  const saved = form?.[field];
  const number = saved === '' || saved === null || saved === undefined ? null : Number(saved);
  if (number !== null && Number.isFinite(number)) {
    return { state: 'saved', text: `${round1(number)}${suffix}`, missingFor: [] };
  }
  return { state: 'empty', text: '—', missingFor: [] };
}

/** The number of servings, or 1 when it is blank or not a positive number. */
export function servingCount(servings) {
  const n = Number(String(servings ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * The portion size the suggested number of servings aims for. One
 * number, here, so the team can change it without hunting for it.
 */
export const TARGET_KCAL_PER_SERVING = 500;

/**
 * How many servings a meal of `totalKcal` makes at about `kcalPerServing`
 * each: a whole number, at least 1. Null when there is no calorie total to
 * divide — a meal whose calories are unavailable gets no suggestion rather
 * than a made-up one.
 */
export function suggestServings(totalKcal, kcalPerServing = TARGET_KCAL_PER_SERVING) {
  const total = Number(totalKcal);
  const each = Number(kcalPerServing);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(each) || each <= 0) return null;
  return Math.max(1, Math.round(total / each));
}

/**
 * A whole-meal calculation divided into `servings` portions. Unavailable
 * nutrients stay null — a share of an unknown is still unknown.
 */
export function perServingOf(data, servings) {
  if (!data) return data;
  const n = servingCount(servings);
  const totals = {};
  Object.entries(data.totals || {}).forEach(([k, v]) => {
    totals[k] = typeof v === 'number' && Number.isFinite(v) ? v / n : v;
  });
  return { ...data, totals };
}

/**
 * The meal fields a calculation writes: a number where the nutrient is
 * available, null where it is not. Null means unavailable and is stored as
 * such — never coerced to 0, which would read as a measured zero.
 */
export function totalsToMealFields(data) {
  const fields = {};
  NUTRIENTS.forEach(({ key, field }) => {
    const { available, value } = readNutrient(data, key);
    fields[field] = available ? (key === 'calories' ? Math.round(value) : round1(value)) : null;
  });
  return fields;
}

/** Form field for a nutrient's whole-meal figure: cal → totalCal, prot → totalProt. */
export const totalField = (field) => `total${field.charAt(0).toUpperCase()}${field.slice(1)}`;

/**
 * Everything a whole-meal calculation writes on the meal: the per-serving
 * figures the app shows (cal, prot, carb, fat, fiber) and the whole meal's
 * (totalCal, totalProt, …). Both are rounded from the same unrounded
 * total, so per serving × servings matches the total to within rounding.
 */
export function mealNutritionFields(data, servings) {
  const perServing = totalsToMealFields(perServingOf(data, servings));
  const whole = totalsToMealFields(data);
  const fields = { ...perServing };
  Object.entries(whole).forEach(([field, value]) => { fields[totalField(field)] = value; });
  return fields;
}

/**
 * "3 of 8 ingredients included", and when nothing counts yet, why.
 *
 * A row that is linked but has no amount is not an unlinked row: saying
 * "none are linked" to someone who just linked one is simply wrong.
 */
export function inclusionSummary(lines, skipped) {
  const total = lines.length + skipped.length;
  if (!total) return 'No ingredients added yet';
  if (lines.length) return `${lines.length} of ${total} ingredient${total === 1 ? '' : 's'} included`;

  const incomplete = skipped.filter((s) => s.kind === 'incomplete').length;
  const unlinked = skipped.length - incomplete;
  const why = incomplete && unlinked
    ? `${incomplete} linked but missing an amount, ${unlinked} not linked`
    : incomplete
      ? `${incomplete === 1 ? 'the ingredient needs' : `all ${incomplete} ingredients need`} a quantity in g, kg, oz or lb`
      : 'none come from the ingredient database';
  return `0 of ${total} ingredients included — ${why}`;
}
