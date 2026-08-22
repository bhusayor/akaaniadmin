/* ═══════════════════════════════════════════════════════
   MEAL STUDIO

   The draft a conversation builds, and the rules that govern it.

   Model output is untrusted input. Everything here runs over it before it
   can reach form state: unknown keys are dropped, types are coerced or
   rejected, and the result is checked against what the Create Meal form
   actually requires.

   Two rules from the spec shape the merge in particular:

     · a field the model did not mention keeps its current value, so a turn
       about the sauce cannot silently empty the instructions;
     · a field the model explicitly sends as empty is a deletion, so "drop
       the tips" still works.
   ═══════════════════════════════════════════════════════ */

import { MEAL_TYPES } from './mealImport.js';

export const SCHEMA_VERSION = 'meal.v1';

/** Every field the studio may set, and how each is cleaned. */
const FIELDS = {
  name: 'text',
  description: 'text',
  luTips: 'text',
  notificationMessage: 'text',
  portion: 'text',
  category: 'text',
  productGroup: 'text',
  videoUrl: 'text',
  emoji: 'text',
  types: 'types',
  tags: 'list',
  countries: 'list',
  healthConditions: 'list',
  servings: 'number',
  prep: 'number',
  cal: 'number',
  prot: 'number',
  carb: 'number',
  fat: 'number',
  fiber: 'number',
  ingredients: 'ingredients',
  instructions: 'instructions',
};

export const STUDIO_FIELDS = Object.keys(FIELDS);

const text = (v) => (typeof v === 'string' ? v.trim() : '');

const number = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const list = (v) => (Array.isArray(v)
  ? v.map((x) => text(x)).filter(Boolean)
  : text(v) ? [text(v)] : []);

const types = (v) => list(v).map((t) => t.toLowerCase()).filter((t) => MEAL_TYPES.includes(t));

const ingredients = (v) => (Array.isArray(v) ? v : [])
  .map((i) => (typeof i === 'string'
    ? { name: i.trim(), quantity: '', unit: '', description: '' }
    : {
        name: text(i?.name),
        quantity: i?.quantity === null || i?.quantity === undefined ? '' : String(i.quantity).trim(),
        unit: text(i?.unit),
        description: text(i?.description),
      }))
  .filter((i) => i.name);

const instructions = (v) => (Array.isArray(v) ? v : [])
  .map((s) => (typeof s === 'string'
    ? { text: s.trim(), timeEstimate: '' }
    : { text: text(s?.text), timeEstimate: text(s?.timeEstimate) }))
  .filter((s) => s.text);

const CLEAN = { text, number, list, types, ingredients, instructions };

/**
 * Strips model output down to the schema.
 *
 * Anything not named in FIELDS is discarded rather than carried through —
 * a model that invents `price` or `isPublished` must not have it reach the
 * form, let alone the save.
 */
export function sanitiseMeal(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  Object.entries(FIELDS).forEach(([key, kind]) => {
    if (!(key in raw)) return;
    out[key] = CLEAN[kind](raw[key]);
  });
  return out;
}

/** A draft with nothing in it. */
export const emptyDraft = () => ({
  name: '', description: '', luTips: '', notificationMessage: '', portion: '',
  category: '', productGroup: '', videoUrl: '', emoji: '',
  types: [], tags: [], countries: [], healthConditions: [],
  servings: null, prep: null, cal: null, prot: null, carb: null, fat: null, fiber: null,
  ingredients: [], instructions: [],
});

/**
 * Folds a turn's output into the running draft.
 *
 * Only keys the model actually sent are touched. That is what stops a turn
 * about one field from resetting the sections already agreed.
 */
export function mergeDraft(current, patch) {
  const clean = sanitiseMeal(patch);
  return { ...(current ?? emptyDraft()), ...clean };
}

/** Fields the Create Meal form refuses to submit without. */
const REQUIRED = [
  ['name', 'Name'],
  ['description', 'Description'],
  ['types', 'At least one meal type'],
  ['tags', 'At least one tag'],
  ['countries', 'At least one country'],
  ['prep', 'Cook time'],
];

const isEmpty = (v) => v === null || v === undefined || v === ''
  || (Array.isArray(v) && v.length === 0);

/**
 * What still stands between this draft and a submittable meal.
 *
 * Blocking and advisory are kept apart on purpose: a missing name stops
 * Apply, while macros the model guessed at only need saying out loud.
 */
export function validateDraft(draft) {
  const meal = draft ?? emptyDraft();

  const missing = REQUIRED.filter(([key]) => isEmpty(meal[key])).map(([, label]) => label);
  const blocking = [...missing];
  const warnings = [];

  if (meal.servings !== null && meal.servings <= 0) {
    blocking.push('Servings must be greater than zero');
  }
  if (!meal.ingredients.length) warnings.push('No ingredients yet');
  if (!meal.instructions.length) warnings.push('No cooking steps yet');
  if (isEmpty(meal.servings)) warnings.push('Servings not set');

  return {
    valid: blocking.length === 0,
    blocking,
    warnings,
    missing,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** A short line for the panel header. */
export function summarise(draft) {
  const meal = draft ?? emptyDraft();
  const bits = [];
  if (meal.servings) bits.push(`${meal.servings} serving${meal.servings === 1 ? '' : 's'}`);
  if (meal.prep) bits.push(`${meal.prep} min`);
  if (meal.ingredients.length) bits.push(`${meal.ingredients.length} ingredients`);
  if (meal.instructions.length) bits.push(`${meal.instructions.length} steps`);
  return bits.join(' · ');
}

/* Fields the user may have typed into before applying. Comparing these is
   what the overwrite warning is built from. */
const COMPARED = [
  ['name', 'Name'], ['description', 'Description'], ['luTips', 'Lu tips'],
  ['notificationMessage', 'Notification message'], ['portion', 'Portion'],
  ['category', 'Category'], ['types', 'Type'], ['tags', 'Tags'],
  ['countries', 'Countries'], ['servings', 'Servings'], ['prep', 'Cook time'],
  ['cal', 'Calories'], ['prot', 'Protein'], ['carb', 'Carbohydrate'],
  ['fat', 'Fat'], ['fiber', 'Fibre'],
  ['ingredients', 'Ingredients'], ['instructions', 'Instructions'],
];

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Which non-empty form fields applying this draft would replace.
 *
 * Only fields the user has actually filled count — overwriting a blank is
 * not a conflict, and warning about it would train people to click through
 * the warning that matters.
 */
export function conflictsWith(draft, form) {
  if (!form) return [];
  const meal = draft ?? emptyDraft();

  return COMPARED
    .filter(([key]) => {
      const next = meal[key];
      const current = form[key];
      if (isEmpty(current)) return false;
      if (isEmpty(next)) return false;
      return !same(next, current);
    })
    .map(([key, label]) => ({ key, label }));
}

/**
 * The draft as the Create Meal form holds it.
 *
 * The form keeps numbers as strings so its inputs stay controlled, and
 * carries `type` alongside `types`.
 */
export function toFormState(draft) {
  const meal = draft ?? emptyDraft();
  const str = (v) => (v === null || v === undefined ? '' : String(v));

  return {
    name: meal.name,
    description: meal.description,
    luTips: meal.luTips,
    notificationMessage: meal.notificationMessage,
    portion: meal.portion,
    category: meal.category,
    productGroup: meal.productGroup,
    videoUrl: meal.videoUrl,
    types: [...meal.types],
    tags: [...meal.tags],
    countries: [...meal.countries],
    healthConditions: [...meal.healthConditions],
    servings: str(meal.servings),
    prep: str(meal.prep),
    cal: str(meal.cal),
    prot: str(meal.prot),
    carb: str(meal.carb),
    fat: str(meal.fat),
    fiber: str(meal.fiber),
    ingredients: meal.ingredients.map((i) => ({ ...i })),
    instructions: meal.instructions.map((s) => ({ ...s })),
  };
}
