/* ═══════════════════════════════════════════════════════
   MEAL STUDIO

   Translation between the admin's meal form and the meal shape
   POST /v1/meal-studio/chat drafts against.

   The endpoint never writes to the database: the draft is the whole
   conversation state and round trips on every turn, so a failed turn
   always leaves the form holding exactly what it had.

   Nothing here calls a model. The key lives on the platform API.
   ═══════════════════════════════════════════════════════ */

/* The shape this client was built against. The server rejects a mismatch
   with 409 and names the version it drafts against, rather than rewriting
   a draft the client might not understand. */
export const MEAL_SCHEMA_VERSION = 'meal.v1';

/* The form holds lowercase types; the backend enum is capitalised. */
const TYPES_TO_API = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
  brunch: 'Brunch', desert: 'Desert', universal: 'Universal',
};
const TYPES_FROM_API = Object.fromEntries(
  Object.entries(TYPES_TO_API).map(([form, api]) => [api.toLowerCase(), form]),
);

const num = (v) => {
  const s = String(v ?? '').trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const str = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? undefined : s;
};

/** Drops keys whose value is undefined, so "no value" never reaches the wire as null. */
const defined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/**
 * The admin form → the meal object the endpoint drafts against.
 *
 * Deliberately omits tags, product groups, categories and images: those are
 * ObjectId references and uploaded assets the model may not author anyway
 * (MODEL_RESTRICTED_FIELDS), and the form holds them as names, not ids.
 */
export function toStudioMeal(form) {
  const steps = (form.instructions || []).filter((s) => String(s.text || '').trim());
  return defined({
    name: str(form.name),
    description: str(form.description),
    types: (form.types || []).map((t) => TYPES_TO_API[String(t).toLowerCase()]).filter(Boolean),
    countries: (form.countries || []).filter(Boolean),
    ingredients: (form.ingredients || [])
      .filter((i) => String(i.name || '').trim())
      .map((i) => defined({
        name: str(i.name),
        description: str(i.description),
        quantity: str(i.quantity),
        unit: str(i.unit),
      })),
    instructions: steps.map((s) => String(s.text).trim()),
    instruction_steps: steps.map((s) => defined({
      step: String(s.text).trim(),
      time_estimate: num(s.timeEstimate),
    })),
    nutrients: (form.nutrients || []).filter((n) => String(n.name || '').trim()),
    incompatible_medical_conditions: (form.healthConditions || []).filter(Boolean),
    prep_time: num(form.prep),
    servings: num(form.servings),
    total_calories: num(form.cal),
    calorie_per_serving: num(form.calPerServing),
    fat: num(form.fat),
    carbohydrate: num(form.carb),
    protein: num(form.prot),
    fiber: num(form.fiber),
    portion_per_serving: str(form.portion) ? [str(form.portion)] : undefined,
    notification_message: str(form.notificationMessage),
    lu_tips: str(form.luTips),
  });
}

const numToField = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : undefined);

/**
 * A drafted meal → a patch for the admin form.
 *
 * Only fields the draft actually carries are returned, so applying a draft
 * never blanks something the model had no opinion about. Step images and
 * video URLs are carried over from the current form by position: the model
 * cannot author them, and they would otherwise be lost on apply.
 */
export function fromStudioMeal(meal, form = {}) {
  const patch = {};
  const put = (key, value) => { if (value !== undefined) patch[key] = value; };

  put('name', str(meal.name));
  put('description', str(meal.description));
  put('notificationMessage', str(meal.notification_message));
  put('luTips', str(meal.lu_tips));

  if (Array.isArray(meal.types)) {
    const types = meal.types.map((t) => TYPES_FROM_API[String(t).toLowerCase()]).filter(Boolean);
    if (types.length) patch.types = types;
  }
  if (Array.isArray(meal.countries)) patch.countries = meal.countries.filter(Boolean);
  if (Array.isArray(meal.incompatible_medical_conditions)) {
    patch.healthConditions = meal.incompatible_medical_conditions.filter(Boolean);
  }
  if (Array.isArray(meal.nutrients)) {
    patch.nutrients = meal.nutrients.map((n) => (typeof n === 'string'
      ? { name: n, amount: '', unit: '' }
      : { name: n.name ?? '', amount: n.amount ?? '', unit: n.unit ?? '' }));
  }

  if (Array.isArray(meal.ingredients)) {
    const before = form.ingredients || [];
    patch.ingredients = meal.ingredients.map((row, i) => {
      const base = typeof row === 'string'
        ? { name: row, description: '', quantity: '', unit: '' }
        : {
          name: String(row.name ?? '').trim(),
          description: String(row.description ?? '').trim(),
          quantity: row.quantity === undefined || row.quantity === null ? '' : String(row.quantity),
          unit: String(row.unit ?? '').trim(),
        };
      /* A nutrition link belongs to the ingredient it was attached to, and so
         does the mass it was measured with. Both are kept only where the model
         left that ingredient's name alone. */
      const prev = before[i];
      return prev?.ingredient_nutrition && prev.name?.trim().toLowerCase() === base.name.toLowerCase()
        ? {
          ...base,
          ingredient_nutrition: prev.ingredient_nutrition,
          nutrition_quantity: prev.nutrition_quantity,
          nutrition_unit: prev.nutrition_unit,
          nutrition_name: prev.nutrition_name,
          nutrition_source: prev.nutrition_source,
        }
        : base;
    });
  }

  const steps = Array.isArray(meal.instruction_steps) && meal.instruction_steps.length
    ? meal.instruction_steps.map((s) => ({ text: String(s.step ?? '').trim(), timeEstimate: typeof s.time_estimate === 'number' ? s.time_estimate : null }))
    : Array.isArray(meal.instructions)
      ? meal.instructions.map((s) => ({ text: String(s ?? '').trim(), timeEstimate: null }))
      : null;
  if (steps) {
    const before = form.instructions || [];
    patch.instructions = steps.map((s, i) => ({
      ...s,
      image: before[i]?.image ?? null,
      videoUrl: before[i]?.videoUrl ?? '',
    }));
  }

  put('prep', numToField(meal.prep_time));
  put('servings', numToField(meal.servings));
  /* Calories and macros are deliberately NOT applied. The meal's nutrition
     comes from POST /v1/nutrition/calculate over the linked ingredients, and
     a drafted figure landing in the same fields would put a guess and a
     calculation in competition — the thing having one source is meant to
     prevent. The model still receives them as context. */

  if (Array.isArray(meal.portion_per_serving)) {
    const first = meal.portion_per_serving.find((p) => String(p || '').trim());
    put('portion', str(first));
  } else {
    put('portion', str(meal.portion_per_serving));
  }

  return patch;
}

/** Human labels for what applying a patch would change, for the confirm line. */
export const FIELD_LABELS = {
  name: 'Name', description: 'Description', notificationMessage: 'Notification message',
  luTips: 'LU tips', types: 'Types', countries: 'Countries', healthConditions: 'Medical conditions',
  nutrients: 'Nutrients', ingredients: 'Ingredients', instructions: 'Cooking steps',
  prep: 'Cook time', servings: 'Servings', portion: 'Portion per serving',
};

/** The keys in `patch` whose value differs from what the form already holds. */
export function changedFields(patch, form) {
  return Object.keys(patch).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(form[k]));
}
