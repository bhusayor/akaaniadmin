/* ═══════════════════════════════════════════════════════
   MEALS ↔ PLATFORM API

   Translation between the admin's meal record (the shape the fixtures
   had, which every meal screen reads) and platform-api's Meal document
   (GET/POST /v1/meals, GET/PUT/DELETE /v1/meals/:id).

   The admin record carries both: `cal`, `prot`, `carb`, `fat`, `fiber` are
   PER SERVING — what the app shows, in the API's calorie_per_serving,
   protein, carbohydrate, fat and fiber — and `totalCal`, `totalProt`, …
   are the WHOLE MEAL, in total_calories, total_protein, and so on. The
   form's ingredients are the whole meal; the servings divide it.

   Tags and product groups are ObjectId references on the API and names
   here, so writing needs the id lookups (`tagIds`, `productGroupIds`,
   name → id). A name with no id is left out rather than sent as text,
   which the API would reject.

   A figure nobody has is left off the request, never sent as 0: the API
   validates numbers with Joi.number(), which refuses null.
   ═══════════════════════════════════════════════════════ */

import { normaliseUnit, parseQuantity, servingCount } from './mealNutrition.js';

const round1 = (v) => Math.round(v * 10) / 10;

/* The form holds lowercase types; the API enum is capitalised. */
const TYPES_TO_API = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
  brunch: 'Brunch', desert: 'Desert', universal: 'Universal',
};

const str = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? undefined : s;
};

const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const num = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Drops keys whose value is undefined, so "no value" never reaches the wire. */
const defined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/* The API validates step media with Joi.string().uri(). A picked image is a
   data URL, and a relative path is not a URI, so only real links are sent. */
const httpUrl = (v) => (/^https?:\/\//i.test(String(v ?? '').trim()) ? String(v).trim() : undefined);

const refName = (v) => (v && typeof v === 'object' ? String(v.name ?? '').trim() : '');
const refId = (v) => (v && typeof v === 'object' ? String(v._id ?? v.id ?? '') : String(v ?? ''));

/* ══════════════════════════════════════
   READ
══════════════════════════════════════ */

/** One API ingredient row → one form row. */
function ingredientFromApi(row) {
  const nutrition = row.ingredient_nutrition;
  const quantity = row.quantity_text ?? (typeof row.quantity === 'number' ? String(row.quantity) : '');
  return defined({
    name: String(row.name ?? refName(row.ingredient) ?? '').trim(),
    description: String(row.description ?? '').trim(),
    quantity: String(quantity ?? ''),
    unit: String(row.unit_name ?? refName(row.unit) ?? '').trim(),
    ingredient_nutrition: nutrition ? refId(nutrition) : undefined,
    nutrition_name: row.nutrition_name || (nutrition && typeof nutrition === 'object' ? nutrition.name : undefined),
    nutrition_source: row.nutrition_source || (nutrition && typeof nutrition === 'object' ? nutrition.source : undefined),
  });
}

/**
 * GET /v1/meals document → the admin meal record.
 *
 * Structured `ingredients_list` rows are preferred; a meal written by
 * another client with only the `ingredients` strings still reads, one
 * string per row.
 */
export function mealFromApi(doc) {
  const servings = numOrNull(doc.servings);
  const perServing = numOrNull(doc.calorie_per_serving);
  const total = numOrNull(doc.total_calories);
  const cal = perServing ?? (total !== null && servings ? total / servings : total);
  /* A whole-meal figure the meal did not store is per serving × servings,
     for a meal written before the totals were kept; with no servings on
     record there is nothing honest to multiply by. */
  const whole = (stored, each, digits) => {
    const value = numOrNull(stored);
    if (value !== null) return digits === 0 ? Math.round(value) : round1(value);
    if (each === null || !servings) return null;
    return digits === 0 ? Math.round(each * servings) : round1(each * servings);
  };
  const prot = numOrNull(doc.protein);
  const carb = numOrNull(doc.carbohydrate ?? doc.carbohydrates);
  const fat = numOrNull(doc.fat);
  const fiber = numOrNull(doc.fiber);

  const types = (doc.types || [])
    .map((t) => String(t).toLowerCase())
    .filter(Boolean);

  const list = Array.isArray(doc.ingredients_list) ? doc.ingredients_list.filter(Boolean) : [];
  const ingredients = list.length
    ? list.map(ingredientFromApi)
    : (doc.ingredients || []).map((line) => ({
      name: String(line ?? '').trim(), description: '', quantity: '', unit: '',
    })).filter((i) => i.name);

  const stepSource = Array.isArray(doc.instruction_steps) && doc.instruction_steps.length
    ? doc.instruction_steps.map((s) => ({
      text: String(s.step ?? '').trim(),
      timeEstimate: numOrNull(s.time_estimate),
      image: s.image_url || null,
      videoUrl: s.video_url || '',
    }))
    : (doc.instructions || []).map((s) => ({
      text: String(typeof s === 'string' ? s : s?.step ?? '').trim(), timeEstimate: null, image: null, videoUrl: '',
    }));

  const tags = (doc.tags || []).filter(Boolean);
  const productGroups = (doc.product_groups || []).filter(Boolean);
  const categories = (doc.categories || []).filter(Boolean);

  return {
    id: String(doc._id ?? doc.id),
    name: String(doc.name ?? ''),
    image: doc.image || '',
    emoji: '🍽️',
    types: types.length ? types : ['lunch'],
    type: types[0] || 'lunch',
    countries: (doc.countries || []).filter(Boolean),
    cal: cal === null ? null : Math.round(cal),
    prot,
    carb,
    fat,
    fiber,
    totalCal: whole(total, cal, 0),
    totalProt: whole(doc.total_protein, prot, 1),
    totalCarb: whole(doc.total_carbohydrate, carb, 1),
    totalFat: whole(doc.total_fat, fat, 1),
    totalFiber: whole(doc.total_fiber, fiber, 1),
    prep: numOrNull(doc.prep_time),
    servings,
    portion: String((doc.portion_per_serving || []).find((p) => String(p || '').trim()) ?? ''),
    tags: tags.map(refName).filter(Boolean),
    description: String(doc.description ?? ''),
    notificationMessage: String(doc.notification_message ?? ''),
    luTips: String(doc.lu_tips ?? ''),
    ingredients,
    instructions: stepSource.filter((s) => s.text),
    healthConditions: (doc.incompatible_medical_conditions || []).filter(Boolean),
    videoUrl: String(doc.video_url ?? ''),
    category: refName(categories[0]),
    productGroup: refName(productGroups[0]),
    nutrients: (doc.nutrients || []).map((n) => (typeof n === 'string'
      ? { name: n, amount: '', unit: '' }
      : { name: n?.name ?? '', amount: n?.amount ?? '', unit: n?.unit ?? '' })),
    foodItems: [],
    hidden: Boolean(doc.hidden),
    createdAt: doc.created_at || null,
    updatedAt: doc.updated_at || null,
  };
}

/* ══════════════════════════════════════
   WRITE
══════════════════════════════════════ */

/** "150 g Fonio, white, whole grains, raw" — the plain-text line other clients read. */
export function ingredientLine(row) {
  const amount = [str(row.quantity), str(row.unit)].filter(Boolean).join(' ');
  const name = [str(row.name), str(row.description)].filter(Boolean).join(', ');
  return [amount, name].filter(Boolean).join(' ');
}

/** One form row → one API ingredient row. */
function ingredientToApi(row) {
  const quantity = parseQuantity(row.quantity);
  const unit = str(row.unit);
  const link = str(row.ingredient_nutrition);
  return defined({
    name: str(row.name),
    description: str(row.description),
    quantity: quantity === null ? undefined : quantity,
    quantity_text: str(row.quantity),
    // Stored normalised ("lbs" → "lb") so it is exactly what the calculator takes.
    unit_name: unit ? normaliseUnit(unit) : undefined,
    // Only a real record id: a source-derived id ("wafct-2000001") is not an ObjectId.
    ingredient_nutrition: link && /^[0-9a-f]{24}$/i.test(link) ? link : undefined,
    nutrition_name: link ? str(row.nutrition_name) : undefined,
    nutrition_source: link && ['usda', 'wafct'].includes(row.nutrition_source) ? row.nutrition_source : undefined,
  });
}

/**
 * The admin meal record (as MealEdit saves it) → the POST / PUT body.
 *
 * @param {Object} meal - the payload MealEdit builds
 * @param {Object} lookups
 * @param {Map<string,string>} lookups.tagIds - lowercased tag name → Tag id
 * @param {Map<string,string>} lookups.productGroupIds - lowercased name → ProductGroup id
 */
export function mealToApi(meal, { tagIds = new Map(), productGroupIds = new Map() } = {}) {
  const rows = (meal.ingredients || []).filter((i) => str(i.name));
  const steps = (meal.instructions || []).filter((s) => str(s.text));
  const cal = num(meal.cal);
  const servings = num(meal.servings);
  const idsFor = (names, map) => [...new Set((names || [])
    .map((n) => map.get(String(n).trim().toLowerCase()))
    .filter(Boolean))];

  return defined({
    name: str(meal.name),
    types: (meal.types?.length ? meal.types : [meal.type])
      .map((t) => TYPES_TO_API[String(t).toLowerCase()])
      .filter(Boolean),
    description: str(meal.description),
    image: str(meal.image),
    countries: (meal.countries || []).filter(Boolean),
    prep_time: num(meal.prep),
    servings,
    portion_per_serving: str(meal.portion) ? [str(meal.portion)] : undefined,
    notification_message: str(meal.notificationMessage),
    lu_tips: str(meal.luTips),
    video_url: httpUrl(meal.videoUrl),

    ingredients: rows.map(ingredientLine),
    ingredients_list: rows.map(ingredientToApi),
    instructions: steps.map((s) => String(s.text).trim()),
    instruction_steps: steps.map((s) => defined({
      step: String(s.text).trim(),
      time_estimate: num(s.timeEstimate),
      image_url: httpUrl(s.image),
      video_url: httpUrl(s.videoUrl),
    })),

    /* Per serving — what the app shows. */
    calorie_per_serving: cal,
    protein: num(meal.prot),
    carbohydrate: num(meal.carb),
    fat: num(meal.fat),
    fiber: num(meal.fiber),
    /* The whole meal, as calculated. A meal without a stored total falls
       back to per serving × servings for calories only, as before; the
       macro totals are sent only when there are real figures for them. */
    total_calories: num(meal.totalCal) ?? (cal === undefined ? undefined : Math.round(cal * servingCount(servings))),
    total_protein: num(meal.totalProt),
    total_carbohydrate: num(meal.totalCarb),
    total_fat: num(meal.totalFat),
    total_fiber: num(meal.totalFiber),

    nutrients: (meal.nutrients || []).filter((n) => str(n.name)),
    incompatible_medical_conditions: (meal.healthConditions || []).filter(Boolean),
    tags: idsFor(meal.tags, tagIds),
    product_groups: idsFor(meal.productGroup ? [meal.productGroup] : [], productGroupIds),
  });
}

/** Tag and product group names the lookups could not resolve, for a warning. */
export function unresolvedNames(meal, { tagIds = new Map(), productGroupIds = new Map() } = {}) {
  const missing = (names, map) => (names || []).filter((n) => str(n) && !map.get(String(n).trim().toLowerCase()));
  return {
    tags: missing(meal.tags, tagIds),
    productGroups: missing(meal.productGroup ? [meal.productGroup] : [], productGroupIds),
  };
}
