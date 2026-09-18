/* ═══════════════════════════════════════════════════════
   MEAL NUTRITION

   Turns a meal's ingredient rows into POST /v1/nutrition/calculate lines
   and reads the response back.

   Row shape — the optional nutrition fields on `ingredients_list`:
     ingredient_nutrition   an IngredientNutrition _id from the search
     nutrition_quantity     a number, in
     nutrition_unit         g | kg | oz | lb

   They sit alongside the recipe's own `quantity`/`unit`, which stay free
   text ("2 cups", "a thumb") because that is what a cook reads.

   Two rules run through everything here:

   - A row that cannot be calculated is EXCLUDED and named, never counted
     as zero. A total assembled from three of eight ingredients is not a
     total, and the UI has to be able to say so.
   - A nutrient the sources never published comes back null with
     completeness.complete false. Null is "unavailable", not 0g, and it
     must never be rendered as a number.
   ═══════════════════════════════════════════════════════ */

/** The only units POST /v1/nutrition/calculate converts (its GRAMS_PER_UNIT). */
export const MASS_UNITS = ['g', 'kg', 'oz', 'lb'];

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

    const unit = trimmed(row.nutrition_unit).toLowerCase();
    const rawQuantity = trimmed(row.nutrition_quantity);
    const quantity = Number(rawQuantity);
    const label = name || 'Unnamed ingredient';

    /* `kind` separates "nothing was chosen" from "something was chosen but is
       not usable yet". They read very differently to someone filling the form
       in: one is work not started, the other is work half done. */
    let reason = null;
    let kind = null;
    if (!id) { kind = 'unlinked'; reason = 'no nutrition link'; }
    else if (!rawQuantity) { kind = 'incomplete'; reason = 'no quantity'; }
    else if (!Number.isFinite(quantity) || quantity <= 0) {
      kind = 'incomplete';
      reason = `quantity "${rawQuantity}" is not a number above zero`;
    } else if (!unit) { kind = 'incomplete'; reason = 'no unit'; }
    else if (!MASS_UNITS.includes(unit)) {
      kind = 'incomplete';
      reason = `"${row.nutrition_unit}" is not a mass unit (${MASS_UNITS.join(', ')})`;
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
 * The meal fields a calculated total writes: a number where the nutrient is
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
      ? `${incomplete === 1 ? 'the linked ingredient needs' : `all ${incomplete} linked ingredients need`} an amount`
      : 'none are linked to nutrition data';
  return `0 of ${total} ingredients included — ${why}`;
}
