/* ═══════════════════════════════════════════════════════
   LOCAL PLATFORM INGREDIENT CATALOGUE

   Stands in for the platform API's ingredient routes while those are
   switched off (the API calls are commented out at each call site):

     GET/POST /v1/ingredients, PATCH/DELETE /v1/ingredients/:id
     GET /v1/units, /v1/product_groups, /v1/product_categories

   Same response shapes, so ingredientFromApi() still maps the rows.

   Seeded with every ingredient the meal fixtures already use, and kept
   in this browser's localStorage so a created or edited ingredient is
   still there after a reload. Nothing here reaches the platform.
   ═══════════════════════════════════════════════════════ */

import { MEALS } from '../data/meals.js';
import { PRODUCT_CATEGORIES, PRODUCT_GROUPS } from './taxonomy.js';

const STORAGE_KEY = 'akaani.platformIngredients.v1';

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const LOCAL_UNITS = ['g', 'kg', 'ml', 'l', 'piece', 'cup', 'tbsp', 'tsp', 'bunch', 'pack', 'tin']
  .map((u) => ({ _id: `unit-${u}`, name: u }));
export const LOCAL_GROUPS = PRODUCT_GROUPS.map((g) => ({ _id: `group-${slug(g)}`, name: g }));
export const LOCAL_CATEGORIES = Object.values(PRODUCT_CATEGORIES).flat()
  .map((c) => ({ _id: `category-${slug(c)}`, name: c }));

const lookup = (list, id) => {
  const hit = list.find((o) => o._id === id);
  return hit ? { ...hit } : null;
};

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** One entry per distinct ingredient name across the meal fixtures. */
export function seedFromMeals(meals = MEALS) {
  const seen = new Map();
  meals.forEach((meal) => (meal.ingredients || []).forEach((i) => {
    const name = String(i.name || '').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    const unit = LOCAL_UNITS.find((u) => u.name === String(i.unit || '').trim().toLowerCase().replace(/s$/, ''));
    seen.set(key, {
      _id: `seed-${slug(name)}`,
      name: capitalise(name),
      description: '',
      unit: unit ? { ...unit } : null,
      product_group: null,
      product_category: null,
      image: '',
      product_url: '',
      created_at: null,
      updated_at: null,
    });
  }));
  return [...seen.values()];
}

let rows = null;

function read() {
  if (rows) return rows;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    rows = Array.isArray(saved) ? saved : seedFromMeals();
  } catch {
    rows = seedFromMeals();
  }
  return rows;
}

function write(next) {
  rows = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode: keep in memory */ }
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** → { ingredients, page, limit, docs }, A → Z by name. */
export async function listIngredients({ search = '', page = 1, limit = 20 } = {}) {
  const q = String(search).trim().toLowerCase();
  const hits = read()
    .filter((r) => !q || r.name.toLowerCase().includes(q) || String(r.description).toLowerCase().includes(q))
    .sort((a, b) => collator.compare(a.name, b.name));
  const start = (Math.max(1, page) - 1) * limit;
  return { ingredients: hits.slice(start, start + limit), page, limit, docs: hits.length };
}

/** The request body ingredientToApi() builds → a stored record. */
function fromBody(body, base = {}) {
  return {
    ...base,
    name: String(body.name ?? base.name ?? '').trim(),
    description: body.description ?? base.description ?? '',
    unit: body.unit ? lookup(LOCAL_UNITS, body.unit) : base.unit ?? null,
    product_group: body.product_group ? lookup(LOCAL_GROUPS, body.product_group) : base.product_group ?? null,
    product_category: body.product_category
      ? lookup(LOCAL_CATEGORIES, body.product_category) : base.product_category ?? null,
    image: body.image ?? base.image ?? '',
    product_url: body.product_url ?? base.product_url ?? '',
    updated_at: new Date().toISOString(),
  };
}

const duplicate = (name, exceptId) => read().some(
  (r) => r._id !== exceptId && r.name.trim().toLowerCase() === String(name).trim().toLowerCase(),
);

export async function createIngredient(body) {
  if (duplicate(body.name)) throw new Error(`"${body.name}" is already in the catalogue.`);
  const created = fromBody(body, { _id: `local-${Date.now().toString(36)}`, created_at: new Date().toISOString() });
  write([created, ...read()]);
  return created;
}

export async function updateIngredient(id, body) {
  const current = read().find((r) => r._id === id);
  if (!current) throw new Error('That ingredient no longer exists.');
  if (body.name && duplicate(body.name, id)) throw new Error(`"${body.name}" is already in the catalogue.`);
  const updated = fromBody(body, current);
  write(read().map((r) => (r._id === id ? updated : r)));
  return updated;
}

export async function deleteIngredient(id) {
  write(read().filter((r) => r._id !== id));
}

export const listUnits = async () => LOCAL_UNITS;
export const listProductGroups = async () => LOCAL_GROUPS;
export const listProductCategories = async () => LOCAL_CATEGORIES;

/** For tests: forget the in-memory copy. */
export function resetForTests() { rows = null; }
