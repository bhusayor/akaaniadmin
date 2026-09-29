/* ═══════════════════════════════════════════════════════
   PLATFORM API CLIENT

   The one place that talks to platform-api. The screens that use it are
   the login, both Ingredients tabs (the platform catalogue and the WAFCT +
   USDA nutrition data), the ingredient search and nutrition total on the
   meal form, and Meal Studio. Everything else still runs on local fixtures.

   Base URL comes from vite.config.js: the dev-server proxy in
   development (no CORS), the backend itself in a build.

   Every response is platform-api's envelope,
     { success, status_code, message, data, links }
   and request() returns `data` or throws an ApiError carrying the
   server's own message.
   ═══════════════════════════════════════════════════════ */

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

/* A sleeping Heroku dyno answers the first request with 503 from the router,
   before the app is running, then serves the retry normally. That is a cold
   start, not a failure, so a read is retried rather than shown as an error.
   Only GET and HEAD: a write that may have reached the app must never be
   replayed on a guess. */
const COLD_START_STATUSES = [502, 503, 504];
export const COLD_START_RETRIES = 2;
const COLD_START_BACKOFF_MS = [800, 2000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  /** Called as (attempt, status) while a cold start is being waited out. */
  onRetry,
  retries = COLD_START_RETRIES,
  sleepImpl = sleep,
  /* Opt-in for a write that is safe to repeat. Only login sets it: it
     creates nothing, and a sleeping dyno answers the very first request of
     a session — which is usually the login — from the router. */
  retryWrites = false,
} = {}) {
  const idempotent = method === 'GET' || method === 'HEAD' || retryWrites;

  for (let attempt = 0; ; attempt++) {
    const result = await attemptRequest(path, { method, query, body, token, signal, fetchImpl });

    const retriable = idempotent
      && attempt < retries
      && (result.status === 0 || COLD_START_STATUSES.includes(result.status));

    if (!result.error || !retriable) {
      if (result.error) throw result.error;
      return result.data;
    }

    onRetry?.(attempt + 1, result.status);
    await sleepImpl(COLD_START_BACKOFF_MS[attempt] ?? COLD_START_BACKOFF_MS[COLD_START_BACKOFF_MS.length - 1]);
  }
}

/** One attempt: returns `{ data }` or `{ error, status }` rather than throwing. */
async function attemptRequest(path, { method, query, body, token, signal, fetchImpl }) {
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
    return {
      status: 0,
      error: new ApiError('Could not reach the platform API. Check your connection and try again.', {
        name: 'NetworkError',
      }),
    };
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
    return { status: res.status, error: err };
  }
  return { status: res.status, data: json.data };
}

/* ══════════════════════════════════════
   ENDPOINTS
══════════════════════════════════════ */

/** POST /v1/auth/login → { token, user }. The user login, not the staff one. */
export async function login({ email, password }, opts) {
  const data = await request('/v1/auth/login', {
    ...opts, method: 'POST', body: { email: email.trim(), password }, token: null, retryWrites: true,
  });
  if (typeof data?.token !== 'string' || !data.token) {
    throw new ApiError('Login succeeded but the server sent no token.');
  }
  return { token: data.token, user: data.user || null };
}

export const NUTRITION_SOURCES = ['usda', 'wafct'];

/**
 * A nutrition record from the API in the shape the screens read — the shape
 * the hardcoded WAFCT + USDA data had.
 *
 * The one rename: the API's `product_group` is a ProductGroup id (retail
 * lines, mostly unmapped), while these screens show and filter by the
 * group the source itself published — the WAFCT food group or the USDA
 * food category, which the API calls `source_category`. That is what
 * `product_group` means here; the id is kept as `product_group_id`.
 */
export function nutritionFromApi(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    _id: String(doc._id ?? ''),
    product_group: doc.source_category || '',
    product_group_id: doc.product_group ?? null,
    local_names: Array.isArray(doc.local_names) ? doc.local_names : [],
    estimated_nutrients: Array.isArray(doc.estimated_nutrients) ? doc.estimated_nutrients : [],
  };
}

/**
 * GET /v1/nutrition/ingredients → { docs, stats }. Any logged-in user.
 *
 * Every word of `search` must appear, ignoring case and accents, in the
 * English, French, food or local names or the group: "riz blanc", "foie
 * boeuf" and "acha" all match.
 *
 * `product_group` is a group *name* from listNutritionCategories(), sent as
 * the API's `category`. `order` is 'name' (A → Z, the table) or 'relevance'
 * (best match first, the pickers).
 *
 * Every filter is omitted when unset. The endpoint tolerates "", but an
 * empty filter is not a filter and has no business in the URL.
 */
export async function searchNutrition({
  search = '', source, product_group: category, food_group_code: foodGroupCode,
  page = 1, limit = 25, order = 'name',
} = {}, opts) {
  const data = await request('/v1/nutrition/ingredients', {
    ...opts,
    query: {
      search: String(search).trim(),
      source: source || undefined,
      category: category || undefined,
      food_group_code: foodGroupCode || undefined,
      sort: order === 'relevance' ? 'relevance' : 'name',
      page,
      limit,
    },
  });
  return {
    docs: (data?.docs ?? []).map(nutritionFromApi),
    stats: data?.stats ?? { docs: 0, by_source: {} },
  };
}

/**
 * GET /v1/nutrition/categories → [{ name, source, count }], A → Z.
 *
 * The groups the sources published — WAFCT food groups, USDA food
 * categories — each a valid `product_group` for searchNutrition.
 */
export const listNutritionCategories = async (opts) =>
  (await request('/v1/nutrition/categories', opts))?.categories ?? [];

/**
 * GET /v1/nutrition/food_groups → [{ code, count }], sorted by code.
 *
 * The codes actually present in the nutrition data, each a valid
 * `food_group_code` for searchNutrition. USDA records have no food group.
 */
export const listNutritionFoodGroups = async (opts) =>
  (await request('/v1/nutrition/food_groups', opts))?.groups ?? [];

/**
 * POST /v1/nutrition/calculate → { totals, breakdown, completeness, basis }.
 *
 * `ingredients` is [{ ingredientId, quantity, unit }] with units g, kg, oz or
 * lb — buildCalculateLines() in mealNutrition.js keeps anything else out. A
 * nutrient's total is null unless every line's record published it, and the
 * lines responsible are named under completeness.missing_by_nutrient.
 */
export function calculateNutrition(ingredients, opts) {
  return request('/v1/nutrition/calculate', { ...opts, method: 'POST', body: { ingredients } });
}

/**
 * POST /v1/meal-studio/chat → { assistantMessage, meal, validation, conversationId }.
 *
 * Staff/admin only, and the model call happens on the server — the key never
 * comes near the browser. The endpoint writes nothing: a failed turn leaves
 * the caller holding exactly the draft it sent.
 *
 * `conversationId` is omitted until the server has issued one; it validates
 * as a uuid v4, so an empty string would be rejected outright.
 */
export function mealStudioChat({ message, currentMeal, conversationId, mealSchemaVersion }, opts) {
  return request('/v1/meal-studio/chat', {
    ...opts,
    method: 'POST',
    body: {
      message,
      currentMeal: currentMeal || {},
      mealSchemaVersion,
      ...(conversationId ? { conversationId } : {}),
    },
  });
}

/* The ingredient list feeds `search` straight into new RegExp() on the
   backend, so "(" would be a 500 and "." a wildcard. Search literally. */
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** GET /v1/ingredients → { ingredients, page, limit, docs } (docs is the total). */
export function listIngredients({ search = '', page = 1, limit = 20 } = {}, opts) {
  return request('/v1/ingredients', { ...opts, query: { search: escapeRegex(search.trim()), page, limit } });
}

/**
 * GET /v1/meals → { meals, stats }. Any logged-in user.
 *
 * Same unescaped `new RegExp(search)` on the backend as the ingredient
 * list, so the term is escaped here too and searched literally.
 */
export function listMeals({ search = '', page = 1, limit = 8 } = {}, opts) {
  return request('/v1/meals', {
    ...opts, query: { search: escapeRegex(search.trim()), page, limit },
  });
}

/** GET /v1/meals/:id → the meal document. Any logged-in user. */
export const getMeal = (id, opts) => request(`/v1/meals/${encodeURIComponent(id)}`, opts);

/* Meal writes are isAdminOrStaff on the backend. The body is mealToApi()'s
   output (src/lib/meals.js). */
export const createMeal = (body, opts) => request('/v1/meals', { ...opts, method: 'POST', body });

export const updateMeal = (id, body, opts) =>
  request(`/v1/meals/${encodeURIComponent(id)}`, { ...opts, method: 'PUT', body });

export const deleteMeal = (id, opts) =>
  request(`/v1/meals/${encodeURIComponent(id)}`, { ...opts, method: 'DELETE' });

/**
 * GET /v1/tags → [{ _id, name, category }], flattened.
 *
 * The endpoint groups tags by category ([{ category, tags: [...] }]); a
 * meal refers to them by id, so the meal form needs the plain list.
 */
export async function listTags(opts) {
  const groups = await request('/v1/tags', opts);
  return (Array.isArray(groups) ? groups : [])
    .flatMap((g) => (g?.tags || []).map((t) => ({ ...t, category: t.category ?? g.category ?? '' })))
    .filter((t) => t?._id && t?.name);
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
