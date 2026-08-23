/* ═══════════════════════════════════════════════════════
   MEAL IMPORT

   Turns spreadsheet rows into meals.

   The column set is the one the meal export writes, so a file exported
   from here re-imports unchanged. Headers are matched loosely — case,
   spacing, punctuation and a handful of common alternatives all resolve —
   because a file that came out of someone else's system will not spell
   them identically.

   A field the file does not carry stays empty rather than being filled
   with a default. The meal detail page shows a gap where the data is
   missing, which is honest; inventing 0 kcal or "lunch" is not.
   ═══════════════════════════════════════════════════════ */

import { MEAL_EXPORT_COLUMNS } from './mealExport.js';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Lower-cased, stripped of everything that is not a letter or digit. */
const key = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Header spellings that map onto each meal field. The export's own names
 * are added automatically, so only genuine alternatives are listed.
 */
const ALIASES = {
  name: ['meal', 'mealname', 'title', 'dish'],
  type: ['mealtype', 'types', 'category', 'course'],
  countries: ['country', 'origin', 'cuisine'],
  category: ['dishcategory', 'mealcategory'],
  productGroup: ['group', 'productgroup'],
  servings: ['serves', 'noofservings', 'servingcount'],
  portion: ['portionsize', 'portionperserving'],
  prep: ['prepmins', 'preptime', 'cooktime', 'cookingtime', 'timemins', 'minutes'],
  cal: ['calories', 'kcal', 'energy', 'totalcalories'],
  prot: ['protein', 'proteing', 'proteins'],
  carb: ['carbs', 'carbsg', 'carbohydrate', 'carbohydrates', 'carbohydrateg'],
  fat: ['fatg', 'fats'],
  fiber: ['fibre', 'fibreg', 'fiberg', 'dietaryfibre'],
  tags: ['tag', 'labels'],
  healthConditions: ['healthconditions', 'conditions'],
  description: ['desc', 'summary', 'about'],
  luTips: ['tips', 'lutips', 'chefnotes', 'notes'],
  notificationMessage: ['notification', 'notificationmessage', 'pushmessage'],
  ingredients: ['ingredient', 'ingredientlist'],
  instructions: ['steps', 'method', 'directions', 'instruction'],
  image: ['imageurl', 'photo', 'picture', 'imagelink'],
  emoji: ['icon'],
  videoUrl: ['video', 'videolink'],
};

/** export column name → meal field. */
const EXPORT_TO_FIELD = {
  id: null, name: 'name', type: 'type', countries: 'countries', category: 'category',
  product_group: 'productGroup', servings: 'servings', portion: 'portion',
  prep_mins: 'prep', calories: 'cal', calories_per_serving: null,
  protein_g: 'prot', carbs_g: 'carb', fat_g: 'fat', fibre_g: 'fiber',
  tags: 'tags', health_conditions: 'healthConditions', description: 'description',
  lu_tips: 'luTips', notification_message: 'notificationMessage',
  ingredients: 'ingredients', instructions: 'instructions',
  image: 'image', emoji: 'emoji', video_url: 'videoUrl',
};

const LOOKUP = (() => {
  const map = new Map();
  MEAL_EXPORT_COLUMNS.forEach((col) => {
    const field = EXPORT_TO_FIELD[col];
    if (field) map.set(key(col), field);
  });
  Object.entries(ALIASES).forEach(([field, names]) => {
    map.set(key(field), field);
    names.forEach((n) => { if (!map.has(key(n))) map.set(key(n), field); });
  });
  return map;
})();

/** Which meal field each column of the header row feeds, or null. */
export function mapHeader(header) {
  return header.map((h) => LOOKUP.get(key(h)) ?? null);
}

/** '' / '-' / 'n/a' all mean absent. An explicit 0 survives. */
export function cellNum(v) {
  const s = String(v ?? '').trim();
  if (!s || /^(-|—|n\/?a|null|none)$/i.test(s)) return null;
  const n = Number(s.replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const cellText = (v) => String(v ?? '').trim();

/**
 * A list of short values — tags, countries, conditions.
 *
 * Accepts the separators people actually use, commas included, because
 * none of these values contain prose.
 */
export function cellList(v) {
  const s = cellText(v);
  if (!s) return [];
  return s.split(/\s*[|;,]\s*/).map((p) => p.trim()).filter(Boolean);
}

/**
 * A list of sentences — ingredients and steps.
 *
 * Split on the pipe alone. A step reads "Season the chicken; leave to
 * marinate", and an ingredient reads "1/2 cup rice", so splitting on
 * semicolons or slashes tears both of them in half — which is exactly
 * what a round-trip through the exporter caught.
 */
export function cellProseList(v) {
  const s = cellText(v);
  if (!s) return [];
  return s.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
}

/** Fractions that begin a quantity just as a digit does. */
const LEADING_QUANTITY = /^[\d½¼¾⅓⅔⅛⅜⅝⅞]/;

/**
 * Splits on commas, but only the ones that separate items.
 *
 * Real ingredient lists use the comma for two different jobs — "Onion
 * (optional, minced), 1 cup Water" separates two items with one comma and
 * qualifies a single item with the other. Two rules tell them apart:
 *
 *   · a comma inside brackets never separates;
 *   · a fragment continues the previous item unless it opens a new one,
 *     which means carrying a colon, a leading quantity, or a capital.
 *
 * That keeps "Avocados: 2 medium-sized, ripe but firm" whole while still
 * splitting "Pinch of salt, 1/4 cup raisins" in two.
 */
export function splitCommaList(text) {
  const s = cellText(text);
  if (!s) return [];

  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; continue; }
    current += ch;
  }
  parts.push(current);

  const out = [];
  parts.map((p) => p.trim()).filter(Boolean).forEach((part) => {
    const opensItem = part.includes(':') || LEADING_QUANTITY.test(part) || /^[A-Z]/.test(part);
    if (opensItem || !out.length) out.push(part);
    else out[out.length - 1] += `, ${part}`;
  });
  return out;
}

/**
 * Splits a numbered run of steps held in one cell.
 *
 * The numbers have to be followed rather than trusted: a step says "cook
 * for 10-12 minutes" and "preheat to 190°C", so any digit could look like
 * a marker. Only a number that continues the sequence starts a new step,
 * which is what stops "1.5 cups" and "8-10 minutes" from splitting one.
 */
export function splitNumberedList(text) {
  const s = cellText(text);
  if (!s) return [];

  const marks = [];
  let expected = 1;
  const re = /(\d{1,2})\.\s+/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const before = m.index === 0 ? '' : s[m.index - 1];
    /* Part of a range or a decimal, not a step number. */
    if (/[-–—/\d.]/.test(before)) continue;
    if (Number(m[1]) !== expected) continue;
    marks.push({ at: m.index, end: m.index + m[0].length });
    expected += 1;
  }

  if (marks.length < 2) return s ? [s] : [];

  return marks
    .map((mark, i) => s.slice(mark.end, marks[i + 1]?.at ?? s.length).trim())
    .filter(Boolean);
}

/** Whether a cell uses the exporter's pipes or a supplier's commas. */
const hasPipes = (v) => cellText(v).includes('|');

/**
 * Measurement words. The word after a quantity is only a unit if it is one
 * of these — "6 plum tomatoes" has no unit, and reading "plum" as one
 * leaves the ingredient named "tomatoes".
 */
const RECIPE_UNITS = new Set([
  'g', 'kg', 'mg', 'gram', 'grams', 'gramme', 'grammes',
  'ml', 'l', 'cl', 'litre', 'litres', 'liter', 'liters',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
  'cup', 'cups', 'tbsp', 'tbs', 'tablespoon', 'tablespoons',
  'tsp', 'teaspoon', 'teaspoons', 'pinch', 'pinches', 'dash',
  'piece', 'pieces', 'slice', 'slices', 'clove', 'cloves',
  'bunch', 'bunches', 'handful', 'handfuls', 'sprig', 'sprigs',
  'stick', 'sticks', 'can', 'cans', 'tin', 'tins', 'sachet', 'sachets',
  'cube', 'cubes', 'leaf', 'leaves', 'bulb', 'bulbs', 'head', 'heads',
  'packet', 'packets', 'pack', 'packs', 'bottle', 'bottles',
  'wrap', 'wraps', 'portion', 'portions', 'serving', 'servings',
  /* Cook's measures that appear in the seeded recipes. */
  'thumb', 'thumbs', 'knob', 'knobs', 'strip', 'strips', 'sheet', 'sheets',
  'ball', 'balls', 'fillet', 'fillets', 'rasher', 'rashers',
]);

/**
 * An ingredient written as a colon pair.
 *
 * Suppliers write it both ways round — "2 cups: Rice" and "Rice: 2 cups" —
 * so the side that starts with a quantity is the quantity, whichever side
 * that is. A line that is only a label, "Egusi Sauce:", is a section
 * heading and keeps its colon so it still reads as one.
 */
function parseColonPair(text) {
  const at = text.indexOf(':');
  const left = text.slice(0, at).trim();
  const right = text.slice(at + 1).trim();

  if (!right) return { name: `${left}:`, quantity: '', unit: '', description: '', heading: true };
  if (!left) return null;

  const [qty, name] = LEADING_QUANTITY.test(left) ? [left, right] : [right, left];

  /* "Water: Enough to submerge the yam" is an instruction, not an amount.
     Anything with no figure and more than two words reads as a note. */
  if (!LEADING_QUANTITY.test(qty) && qty.split(/\s+/).length > 2) {
    return { name, quantity: '', unit: '', description: qty };
  }

  /* The quantity may carry its own unit — "2 cups", "500g", "1 cup (120g)". */
  const m = /^([\d½¼¾⅓⅔⅛⅜⅝⅞][\d\s./½¼¾⅓⅔⅛⅜⅝⅞-]*)\s*(.*)$/.exec(qty.trim());
  return {
    quantity: m ? m[1].trim() : qty,
    unit: m ? m[2].trim() : '',
    name,
    description: '',
  };
}

/** `3 cups rice — rinsed` back into its parts. */
export function parseIngredient(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return { name: '', quantity: '', unit: '', description: '' };
  /* Bracketed notes hold colons of their own, so only a colon outside them
     marks a pair. */
  const outside = raw.replace(/\([^)]*\)/g, (m) => ' '.repeat(m.length));
  if (outside.includes(':')) {
    const pair = parseColonPair(raw);
    if (pair) return pair;
  }

  const [main, ...noteParts] = raw.split(/\s+—\s+|\s+--\s+/);
  const note = noteParts.join(' — ').trim();
  const m = /^([\d.,/]+)\s+(.*)$/.exec(main.trim());
  if (!m) return { name: main.trim(), quantity: '', unit: '', description: note };

  const rest = m[2].trim();
  const [firstWord, ...others] = rest.split(/\s+/);
  if (others.length && RECIPE_UNITS.has(firstWord.toLowerCase())) {
    return { quantity: m[1], unit: firstWord, name: others.join(' '), description: note };
  }
  return { quantity: m[1], unit: '', name: rest, description: note };
}

/** `1. Simmer (20 min)` back into its parts. */
export function parseStep(text) {
  const stripped = String(text).replace(/^\s*\d+[.)]\s*/, '').trim();
  const m = /^(.*?)\s*\(([^()]*(?:min|hour|hr|sec)[^()]*)\)\s*$/i.exec(stripped);
  return m
    ? { text: m[1].trim(), timeEstimate: m[2].trim() }
    : { text: stripped, timeEstimate: '' };
}

/** Every recognised meal type in the cell — "Breakfast, Lunch" is both. */
export function normalizeTypes(v) {
  const s = cellText(v).toLowerCase();
  return MEAL_TYPES.filter((t) => s.includes(t));
}

/** The first recognised type, for the single-value `type` field. */
export function normalizeType(v) {
  return normalizeTypes(v)[0] ?? '';
}

/**
 * An image reference that will actually load.
 *
 * Absolute http(s) URLs and data URIs pass through. A bare path is served
 * from /public, so a leading slash is trimmed. Anything else — a Windows
 * path, a `file://`, a Google Drive share link — cannot resolve in a
 * browser and is rejected rather than left to render as a broken box.
 */
export function normalizeImage(v) {
  const s = cellText(v);
  if (!s) return { image: '', warning: null };
  if (/^data:image\//i.test(s)) return { image: s, warning: null };
  if (/^https?:\/\//i.test(s)) return { image: s, warning: null };
  if (/^(file:|[a-zA-Z]:\\|\\\\)/.test(s)) {
    return { image: '', warning: `Image "${s}" is a local file path and cannot load in a browser` };
  }
  if (/^\/\//.test(s)) return { image: `https:${s}`, warning: null };
  return { image: s.replace(/^\/+/, ''), warning: null };
}

/**
 * Builds one meal from a row.
 *
 * @returns {{meal: object, warnings: string[], errors: string[]}}
 */
export function buildMeal(row, fields) {
  const get = (field) => {
    const at = fields.indexOf(field);
    return at === -1 ? '' : row[at];
  };

  const warnings = [];
  const errors = [];

  const name = cellText(get('name'));
  if (!name) errors.push('Name is required');

  const { image, warning: imageWarning } = normalizeImage(get('image'));
  if (imageWarning) warnings.push(imageWarning);

  const types = normalizeTypes(get('type'));
  const type = types[0] ?? '';
  if (!type && cellText(get('type'))) {
    warnings.push(`Meal type "${cellText(get('type'))}" is not one of ${MEAL_TYPES.join(', ')} — left unset`);
  }

  /* A file from this admin uses pipes; one from anywhere else uses commas
     for ingredients and numbering for steps. */
  const rawIngredients = get('ingredients');
  const rawInstructions = get('instructions');

  const ingredients = (hasPipes(rawIngredients)
    ? cellProseList(rawIngredients)
    : splitCommaList(rawIngredients)
  ).map(parseIngredient);

  const instructions = (hasPipes(rawInstructions)
    ? cellProseList(rawInstructions)
    : splitNumberedList(rawInstructions)
  ).map(parseStep);

  const meal = {
    name,
    /* Every absent field stays empty or null. The detail page renders a
       gap for these; a default would be a claim the file never made. */
    image,
    emoji: cellText(get('emoji')) || '🍽️',
    type,
    types,
    countries: cellList(get('countries')),
    category: cellText(get('category')),
    productGroup: cellText(get('productGroup')),
    cal: cellNum(get('cal')),
    prot: cellNum(get('prot')),
    carb: cellNum(get('carb')),
    fat: cellNum(get('fat')),
    fiber: cellNum(get('fiber')),
    prep: cellNum(get('prep')),
    servings: cellNum(get('servings')),
    portion: cellText(get('portion')),
    tags: cellList(get('tags')),
    healthConditions: cellList(get('healthConditions')),
    description: cellText(get('description')),
    luTips: cellText(get('luTips')),
    notificationMessage: cellText(get('notificationMessage')),
    ingredients,
    instructions,
    videoUrl: cellText(get('videoUrl')),
    nutrients: [],
    foodItems: [],
  };

  return { meal, warnings, errors };
}

/**
 * Reviews a whole sheet without writing anything.
 *
 * @param rows the sheet, header row first
 */
export function reviewMealRows(rows) {
  const clean = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (!clean.length) {
    return { fields: [], unmapped: [], rows: [], mappedCount: 0 };
  }

  const header = clean[0];
  const fields = mapHeader(header);
  const unmapped = header.filter((h, i) => fields[i] === null && String(h ?? '').trim() !== '');

  const reviewed = clean.slice(1).map((row, n) => {
    const { meal, warnings, errors } = buildMeal(row, fields);
    return {
      line: n + 2,
      meal,
      warnings,
      errors,
      /* Rows without a name cannot be imported; everything else can, and
         arrives incomplete rather than not at all. */
      include: errors.length === 0,
    };
  });

  return {
    fields,
    unmapped,
    rows: reviewed,
    mappedCount: fields.filter(Boolean).length,
  };
}

/**
 * Matches an incoming row against meals that already exist.
 *
 * Names are compared loosely — case, spacing and punctuation vary between
 * exports of the same catalogue — but never fuzzily. A near-match silently
 * treated as the same meal would overwrite the wrong recipe, so anything
 * short of the same name normalised is a new meal.
 */
const nameKey = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function findExisting(name, meals = []) {
  const key = nameKey(name);
  if (!key) return null;
  return meals.find((m) => nameKey(m.name) === key) ?? null;
}

/** What to do with a row whose meal already exists. */
export const DUPLICATE_ACTIONS = ['skip', 'replace', 'add'];

/**
 * Tags each reviewed row with the meal it would collide with.
 *
 * `skip` is the default for a duplicate: an import that silently replaced
 * existing recipes would be the most destructive thing on this page, and
 * the safe default is the one a hurried click lands on.
 */
export function markDuplicates(rows, existingMeals = []) {
  return rows.map((row) => {
    const existing = findExisting(row.meal?.name, existingMeals);
    return existing
      ? { ...row, existing: { id: existing.id, name: existing.name }, action: 'skip' }
      : { ...row, existing: null, action: 'add' };
  });
}

/** How much of a meal the file actually filled in. */
export function completeness(meal) {
  const checked = [
    'image', 'type', 'countries', 'cal', 'prot', 'carb', 'fat', 'fiber',
    'prep', 'servings', 'portion', 'tags', 'description', 'ingredients', 'instructions',
  ];
  const filled = checked.filter((k) => {
    const v = meal[k];
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && v !== '';
  });
  return { filled: filled.length, total: checked.length };
}
