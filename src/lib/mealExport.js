/* ═══════════════════════════════════════════════════════
   MEAL EXPORT

   Every field a meal carries, flattened to CSV.

   The nested parts — ingredients, steps, tips — are the reason anyone
   exports at all, so they are written out in full rather than summarised
   to a count. Each nested list gets one cell, with its rows separated by
   ` | ` so a spreadsheet keeps them in one column.
   ═══════════════════════════════════════════════════════ */

export const MEAL_EXPORT_COLUMNS = [
  'id', 'name', 'type', 'countries', 'category', 'product_group',
  'servings', 'portion', 'prep_mins',
  'calories', 'calories_per_serving', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g',
  'tags', 'health_conditions',
  'description', 'lu_tips', 'notification_message',
  'ingredients', 'instructions',
  'image', 'emoji', 'video_url',
];

/** '' and null both read as blank; an explicit 0 survives. */
const cell = (v) => (v === null || v === undefined ? '' : String(v));

const list = (arr) => (Array.isArray(arr) ? arr.filter(Boolean).join(' | ') : '');

/** `3 cups long-grain parboiled rice — rinsed` */
export function formatIngredient(ing) {
  if (!ing) return '';
  if (typeof ing === 'string') return ing;
  const qty = [ing.quantity, ing.unit].filter((p) => p !== null && p !== undefined && String(p).trim() !== '').join(' ');
  const head = [qty, ing.name].filter(Boolean).join(' ');
  return ing.description?.trim() ? `${head} — ${ing.description.trim()}` : head;
}

/** `1. Season the chicken (30 min)` — the step number matters on reimport. */
export function formatStep(step, i) {
  if (!step) return '';
  const text = typeof step === 'string' ? step : step.text;
  if (!text) return '';
  const mins = typeof step === 'object' ? step.timeEstimate : null;
  return `${i + 1}. ${text}${mins ? ` (${mins})` : ''}`;
}

/**
 * Total calories for the whole recipe, or null when there is no figure.
 *
 * A meal's `cal` is per serving — its ingredients are one serving and the
 * calculation is per serving — so the total is that times the servings.
 * Blank or invalid servings count as one, the same rule the meal form
 * uses; a missing figure stays blank rather than becoming 0.
 */
export function totalCalories(meal) {
  const cal = Number(meal.cal);
  if (meal.cal === null || meal.cal === undefined || meal.cal === '' || !Number.isFinite(cal)) return null;
  const servings = Number(meal.servings);
  return Math.round(cal * (Number.isFinite(servings) && servings > 0 ? servings : 1));
}

export function mealExportRow(meal) {
  return [
    meal.id,
    meal.name,
    list(meal.types ?? [meal.type]),
    list(meal.countries),
    meal.category,
    meal.productGroup,
    meal.servings,
    meal.portion,
    meal.prep,
    totalCalories(meal),
    meal.cal,
    meal.prot,
    meal.carb,
    meal.fat,
    meal.fiber,
    list(meal.tags),
    list(meal.healthConditions),
    meal.description,
    meal.luTips,
    meal.notificationMessage,
    (meal.ingredients ?? []).map(formatIngredient).filter(Boolean).join(' | '),
    (meal.instructions ?? []).map(formatStep).filter(Boolean).join(' | '),
    meal.image,
    meal.emoji,
    meal.videoUrl,
  ].map(cell);
}

export const mealExportRows = (meals) => [MEAL_EXPORT_COLUMNS, ...meals.map(mealExportRow)];
