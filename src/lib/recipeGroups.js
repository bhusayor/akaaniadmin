import { CURRENCIES, currencySymbol, formatPrice, toNum } from './money.js';

export { CURRENCIES, currencySymbol, formatPrice, toNum };

/* ═══════════════════════════════════════════════════════
   RECIPE GROUPS

   A recipe group is a bundle sold on the marketing site: a price, a
   plan, a set of recipes and the benefits it claims. This module owns
   the record shape and the money formatting.
   ═══════════════════════════════════════════════════════ */

export const PLANS = [
  'Balanced Macros', 'Gut Friendly', 'Fat Loss', 'High Protein',
  'Low Carb', 'Vegan', 'Family', 'Quick Meals',
];

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export const GROUP_STATUSES = ['live', 'draft', 'retired'];

let nextId = 900;

export function normalizeGroup(data, id) {
  const recipes = (data.recipes ?? []).map((r) => String(r).trim()).filter(Boolean);
  return {
    id: id ?? nextId++,
    name: String(data.name ?? '').trim(),
    description: String(data.description ?? '').trim(),
    image: data.image ?? null,
    currency: CURRENCIES.some((c) => c.code === data.currency) ? data.currency : 'USD',
    price: toNum(data.price),
    servings: toNum(data.servings),
    plan: data.plan ?? '',
    mealTypes: [...(data.mealTypes ?? [])],
    recipes,
    benefits: (data.benefits ?? []).map((b) => String(b).trim()).filter(Boolean),
    status: GROUP_STATUSES.includes(data.status) ? data.status : 'draft',
    // Derived — the production card shows a stored count, which can drift
    // from the list it is meant to describe.
    get recipeCount() { return this.recipes.length; },
    /* What a buyer pays per recipe. The clearest single signal of whether
       a bundle is priced sensibly against the others. */
    get pricePerRecipe() {
      if (this.price === null || !this.recipes.length) return null;
      return this.price / this.recipes.length;
    },
  };
}

export function validateGroup(form) {
  const problems = [];
  if (!String(form.name ?? '').trim()) problems.push('Name is required');
  if (toNum(form.price) === null) problems.push('Price is required');
  else if (toNum(form.price) < 0) problems.push('Price cannot be negative');
  if (toNum(form.servings) === null) problems.push('Servings is required');
  if (!String(form.plan ?? '').trim()) problems.push('Plan is required');
  if (!(form.mealTypes ?? []).length) problems.push('Pick at least one meal type');
  // Trim before counting — '   ' is truthy, so filter(Boolean) alone would
  // let a bundle save with a benefit made entirely of spaces.
  const nonBlank = (list) => (list ?? []).filter((x) => String(x ?? '').trim()).length;
  if (!nonBlank(form.recipes)) problems.push('Add at least one recipe');
  if (!nonBlank(form.benefits)) problems.push('Add at least one benefit');
  return problems;
}
