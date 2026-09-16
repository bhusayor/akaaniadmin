/* ═══════════════════════════════════════════════════════
   PLATFORM API CLIENT

   The one place that talks to platform-api. Everything else in the admin
   still runs on local fixtures; the screens that use this are the login,
   the Platform tab on Ingredients, the nutrition-database search in the
   ingredient form, and the meal nutrition calculator.

   Base URL comes from vite.config.js: the dev-server proxy in
   development (no CORS), the backend itself in a build.

   Every response is platform-api's envelope,
     { success, status_code, message, data, links }
   and request() returns `data` or throws an ApiError carrying the
   server's own message.
   ═══════════════════════════════════════════════════════ */

import { WAFCT_SOURCE } from './ingredients.js';

export const API_BASE = typeof __API_BASE__ === 'undefined' ? '' : __API_BASE__;

/* ══════════════════════════════════════
   SESSION

   The bearer token from POST /v1/auth/login. sessionStorage, so it goes
   when the tab closes; storage can throw (private mode, blocked site
   data), in which case the session simply lives in memory.
══════════════════════════════════════ */

export const SESSION_KEY = 'akaani.session.v1';

const storage = () => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};

function readStored() {
  try {
    const parsed = JSON.parse(storage()?.getItem(SESSION_KEY) || 'null');
    return parsed && typeof parsed.token === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

let session = readStored();
const listeners = new Set();

export const getSession = () => session;

export function setSession(next) {
  session = next;
  try {
    if (next) storage()?.setItem(SESSION_KEY, JSON.stringify(next));
    else storage()?.removeItem(SESSION_KEY);
  } catch { /* memory-only session */ }
  listeners.forEach((fn) => fn(session));
}

export const clearSession = () => setSession(null);

/** Returns an unsubscribe function. */
export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ══════════════════════════════════════
   REQUESTS
══════════════════════════════════════ */

export class ApiError extends Error {
  constructor(message, { status = 0, name = 'ApiError', data = null } = {}) {
    super(message);
    this.name = name;
    this.status = status;
    this.data = data;
  }
}

/* platform-api answers 401 both for a bad or expired token and for a
   valid user hitting a staff-only route (isAdminOrStaff throws the same
   error). Only the first means the session is dead. */
const EXPIRED_TOKEN = /^Failed to verify request token/i;

export const isExpiredSession = (err) =>
  err instanceof ApiError && err.status === 401 && EXPIRED_TOKEN.test(err.message);

/** A 401/403 on a request that did carry a live token: not allowed, not logged out. */
export const isForbidden = (err) =>
  err instanceof ApiError && (err.status === 403 || (err.status === 401 && !isExpiredSession(err)));

/** Skips undefined, null and '' so optional filters never reach the URL. */
export function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function request(path, {
  method = 'GET',
  query,
  body,
  token = session?.token,
  signal,
  fetchImpl = globalThis.fetch,
} = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetchImpl(`${API_BASE}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the platform API. Check your connection and try again.', {
      name: 'NetworkError',
    });
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch { /* handled below */ }

  if (!res.ok || !json || json.success === false) {
    const message = json?.message
      || (json ? res.statusText : `Unexpected response from the platform API (HTTP ${res.status})`);
    const err = new ApiError(message, { status: res.status, name: json?.name || 'ApiError', data: json?.data ?? null });
    if (token && isExpiredSession(err)) clearSession();
    throw err;
  }
  return json.data;
}

/* ══════════════════════════════════════
   ENDPOINTS
══════════════════════════════════════ */

/** POST /v1/auth/login → { token, user }. The user login, not the staff one. */
export async function login({ email, password }, opts) {
  const data = await request('/v1/auth/login', {
    ...opts, method: 'POST', body: { email: email.trim(), password }, token: null,
  });
  if (typeof data?.token !== 'string' || !data.token) {
    throw new ApiError('Login succeeded but the server sent no token.');
  }
  return { token: data.token, user: data.user || null };
}

export const NUTRITION_SOURCES = ['usda', 'wafct'];

/** GET /v1/nutrition/ingredients → { docs, stats }. Any logged-in user. */
export function searchNutrition({ search = '', source, page = 1, limit = 10 } = {}, opts) {
  return request('/v1/nutrition/ingredients', {
    ...opts, query: { search: search.trim(), source, page, limit },
  });
}

/** POST /v1/nutrition/calculate → { totals, breakdown, completeness, basis }. */
export function calculateNutrition(ingredients, opts) {
  return request('/v1/nutrition/calculate', { ...opts, method: 'POST', body: { ingredients } });
}

/* The ingredient list feeds `search` straight into new RegExp() on the
   backend, so "(" would be a 500 and "." a wildcard. Search literally. */
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** GET /v1/ingredients → { ingredients, page, limit, docs } (docs is the total). */
export function listIngredients({ search = '', page = 1, limit = 20 } = {}, opts) {
  return request('/v1/ingredients', { ...opts, query: { search: escapeRegex(search.trim()), page, limit } });
}

/* Create, update and delete are isAdminOrStaff on the backend. */
export const createIngredient = (body, opts) =>
  request('/v1/ingredients', { ...opts, method: 'POST', body });

export const updateIngredient = (id, body, opts) =>
  request(`/v1/ingredients/${encodeURIComponent(id)}`, { ...opts, method: 'PATCH', body });

export const deleteIngredient = (id, opts) =>
  request(`/v1/ingredients/${encodeURIComponent(id)}`, { ...opts, method: 'DELETE' });

/* Lookups for the ingredient form. Each list endpoint wraps its rows under
   a different key. */
export const listUnits = async (opts) =>
  (await request('/v1/units', { ...opts, query: { limit: 100 } }))?.units ?? [];

export const listProductGroups = async (opts) =>
  (await request('/v1/product_groups', { ...opts, query: { limit: 100 } }))?.groups ?? [];

export const listProductCategories = async (opts) =>
  (await request('/v1/product_categories', { ...opts, query: { limit: 100 } }))?.categories ?? [];

/* ══════════════════════════════════════
   MAPPING
══════════════════════════════════════ */

export const USDA_SOURCE = 'USDA FoodData Central';

const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A nutrition record's per-100g values in the admin's macro keys. Nulls stay null. */
export function nutritionToMacros(record) {
  const n = record?.nutrients_per_100g || {};
  return {
    calories: numOrNull(n.calories),
    protein_g: numOrNull(n.protein),
    carbs_g: numOrNull(n.carbohydrate),
    fat_g: numOrNull(n.fat),
    fibre_g: numOrNull(n.fiber),
  };
}

/** The `source` string the admin stores, so the WAFCT badge keeps working. */
export function nutritionSourceLabel(record) {
  if (record?.source === 'wafct') return WAFCT_SOURCE;
  if (record?.source === 'usda') return USDA_SOURCE;
  return record?.source || null;
}

const ref = (v) => {
  if (!v) return { id: '', name: '' };
  if (typeof v === 'string') return { id: v, name: '' };
  return { id: String(v._id ?? v.id ?? ''), name: v.name || '' };
};

/** A backend ingredient (unit/group/category populated or bare ids) → a table row. */
export function ingredientFromApi(doc) {
  return {
    id: String(doc._id ?? doc.id),
    name: doc.name || '',
    description: doc.description || '',
    unit: ref(doc.unit),
    product_group: ref(doc.product_group),
    product_category: ref(doc.product_category),
    image: doc.image || '',
    product_url: doc.product_url || '',
    updated_at: doc.updated_at || doc.created_at || null,
  };
}

/**
 * Form values → request body. Joi's string() rejects '', so blank optional
 * fields are left out entirely — which also means an update cannot clear
 * one; the backend offers no way to.
 */
export function ingredientToApi(form) {
  const body = {};
  const put = (k, v) => {
    const s = String(v ?? '').trim();
    if (s) body[k] = s;
  };
  put('name', form.name);
  put('description', form.description);
  put('unit', form.unit);
  put('product_group', form.product_group);
  put('product_category', form.product_category);
  put('image', form.image);
  put('product_url', form.product_url);
  return body;
}

/* ── Meal nutrition ── */

/** Units POST /v1/nutrition/calculate converts (platform-api GRAMS_PER_UNIT). */
export const CALC_UNITS = ['g', 'kg', 'oz', 'lb'];

/**
 * Meal ingredient rows → calculate lines. A row is sent only if it is
 * linked to a nutrition record and has a positive quantity in a unit the
 * backend can convert; every other row is returned with the reason, so
 * the total is never quietly short.
 */
export function buildCalculateLines(rows) {
  const lines = [];
  const skipped = [];
  rows.forEach((row, index) => {
    const name = String(row.name || '').trim() || `Row ${index + 1}`;
    if (!String(row.name || '').trim() && !row.nutritionId) return; // blank row
    const unit = String(row.unit || '').trim().toLowerCase();
    const quantity = Number(String(row.quantity ?? '').trim());
    let reason = null;
    if (!row.nutritionId) reason = 'not linked to nutrition data';
    else if (!String(row.quantity ?? '').trim() || !Number.isFinite(quantity) || quantity <= 0) {
      reason = 'needs a numeric quantity';
    } else if (!CALC_UNITS.includes(unit)) {
      reason = unit ? `“${row.unit}” can't be converted to grams — use ${CALC_UNITS.join(', ')}` : 'needs a unit';
    }
    if (reason) skipped.push({ index, name, reason });
    else lines.push({ ingredientId: row.nutritionId, quantity, unit });
  });
  return { lines, skipped };
}
