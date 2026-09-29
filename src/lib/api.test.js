/* ═══════════════════════════════════════════════════════
   PLATFORM API CLIENT TESTS    run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert, beforeEach } from 'vitest';
import {
  request, login, ApiError, buildQuery, isExpiredSession, isForbidden,
  getSession, setSession, clearSession, onSessionChange,
  nutritionToMacros, ingredientFromApi, ingredientToApi,
  escapeRegex, listIngredients, COLD_START_RETRIES,
  searchNutrition, listNutritionCategories, calculateNutrition, nutritionFromApi,
} from './api.js';

/** A fetch stand-in that records the call and answers with `status` + `json`. */
function fakeFetch(status, json, calls = []) {
  const impl = async (url, init) => {
    calls.push({ url, init });
    const text = typeof json === 'string' ? json : JSON.stringify(json);
    return { ok: status >= 200 && status < 300, status, statusText: 'X', text: async () => text };
  };
  impl.calls = calls;
  return impl;
}

/** Answers with each queued response in turn, so a retry can be observed. */
function scriptedFetch(steps) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const [status, json] = steps[Math.min(calls.length - 1, steps.length - 1)];
    const text = typeof json === 'string' ? json : JSON.stringify(json);
    return { ok: status >= 200 && status < 300, status, statusText: 'X', text: async () => text };
  };
  impl.calls = calls;
  return impl;
}

const noSleep = async () => {};

const ok = (data) => ({ success: true, status_code: 200, message: 'ok', data, links: [] });
const fail = (status, message, name = 'Err') => ({ success: false, status_code: status, message, name, data: {} });

beforeEach(() => clearSession());

// ─── request ───

it('returns the envelope data on success', async () => {
  const data = await request('/v1/x', { fetchImpl: fakeFetch(200, ok({ a: 1 })) });
  assert.deepStrictEqual(data, { a: 1 });
});

it('sends the bearer token and JSON body', async () => {
  const f = fakeFetch(200, ok({}));
  await request('/v1/x', { method: 'POST', body: { a: 1 }, token: 'abc', fetchImpl: f });
  const { init } = f.calls[0];
  assert.strictEqual(init.headers.Authorization, 'Bearer abc');
  assert.strictEqual(init.headers['Content-Type'], 'application/json');
  assert.strictEqual(init.body, '{"a":1}');
});

it('a GET carries no body and no Content-Type', async () => {
  const f = fakeFetch(200, ok({}));
  await request('/v1/x', { token: null, fetchImpl: f });
  assert.strictEqual(f.calls[0].init.body, undefined);
  assert.deepStrictEqual(f.calls[0].init.headers, {});
});

it('uses the stored session token by default', async () => {
  setSession({ token: 'stored', user: null });
  const f = fakeFetch(200, ok({}));
  await request('/v1/x', { fetchImpl: f });
  assert.strictEqual(f.calls[0].init.headers.Authorization, 'Bearer stored');
});

it('throws the server message with status and name', async () => {
  try {
    await request('/v1/x', { fetchImpl: fakeFetch(400, fail(400, 'ValidationError: "name" is required', 'ValidationError')) });
    assert.fail('should throw');
  } catch (err) {
    assert.instanceOf(err, ApiError);
    assert.strictEqual(err.status, 400);
    assert.strictEqual(err.name, 'ValidationError');
    assert.match(err.message, /"name" is required/);
  }
});

it('a non-JSON error body still throws a readable error', async () => {
  try {
    await request('/v1/x', { fetchImpl: fakeFetch(502, '<html>Bad gateway</html>') });
    assert.fail('should throw');
  } catch (err) {
    assert.strictEqual(err.status, 502);
    assert.match(err.message, /HTTP 502/);
  }
});

it('a network failure becomes a NetworkError', async () => {
  const f = async () => { throw new TypeError('Failed to fetch'); };
  try {
    await request('/v1/x', { fetchImpl: f });
    assert.fail('should throw');
  } catch (err) {
    assert.strictEqual(err.name, 'NetworkError');
    assert.strictEqual(err.status, 0);
  }
});

it('an expired token clears the session', async () => {
  setSession({ token: 'old', user: null });
  const f = fakeFetch(401, fail(401, 'Failed to verify request token - jwt expired', 'UnauthorizedError'));
  await request('/v1/x', { fetchImpl: f }).catch(() => {});
  assert.strictEqual(getSession(), null);
});

it('a staff-only 401 keeps the session — the user is logged in, just not allowed', async () => {
  // isAdminOrStaff throws the default UnauthorizedError for a valid non-staff user.
  setSession({ token: 'valid', user: null });
  const f = fakeFetch(401, fail(401, 'Authorization is required to access this API endpoint.', 'UnauthorizedError'));
  const err = await request('/v1/ingredients', { method: 'POST', body: {}, fetchImpl: f }).catch((e) => e);
  assert.strictEqual(getSession()?.token, 'valid');
  assert.isTrue(isForbidden(err));
  assert.isFalse(isExpiredSession(err));
});

it('session changes notify subscribers until unsubscribed', () => {
  const seen = [];
  const off = onSessionChange((s) => seen.push(s?.token ?? null));
  setSession({ token: 't1' });
  off();
  setSession({ token: 't2' });
  assert.deepStrictEqual(seen, ['t1']);
});

// ─── cold starts ───

it('a 503 from a sleeping dyno is retried, not shown as an error', async () => {
  // Heroku answers from the router while the app boots, then serves the retry.
  const f = scriptedFetch([[503, '<html>Application is starting</html>'], [200, ok({ a: 1 })]]);
  const seen = [];
  const data = await request('/v1/x', { fetchImpl: f, sleepImpl: noSleep, onRetry: (n, s) => seen.push([n, s]) });
  assert.deepStrictEqual(data, { a: 1 });
  assert.strictEqual(f.calls.length, 2);
  assert.deepStrictEqual(seen, [[1, 503]]);
});

it('a network failure on a read is retried too', async () => {
  let calls = 0;
  const f = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('Failed to fetch');
    return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify(ok({ b: 2 })) };
  };
  assert.deepStrictEqual(await request('/v1/x', { fetchImpl: f, sleepImpl: noSleep }), { b: 2 });
  assert.strictEqual(calls, 2);
});

it('a dyno that never wakes still surfaces the error, after a bounded number of tries', async () => {
  const f = scriptedFetch([[503, '<html>no</html>']]);
  const err = await request('/v1/x', { fetchImpl: f, sleepImpl: noSleep }).catch((e) => e);
  assert.strictEqual(err.status, 503);
  assert.strictEqual(f.calls.length, COLD_START_RETRIES + 1);
});

it('a write is never replayed — it may already have reached the app', async () => {
  const f = scriptedFetch([[503, '<html>starting</html>'], [200, ok({})]]);
  const err = await request('/v1/ingredients', { method: 'POST', body: {}, fetchImpl: f, sleepImpl: noSleep }).catch((e) => e);
  assert.strictEqual(err.status, 503);
  assert.strictEqual(f.calls.length, 1, 'a POST must be sent exactly once');
});

it('login is retried through a cold start — it is the first request of a session', async () => {
  const f = scriptedFetch([[503, '<html>starting</html>'], [200, ok({ token: 't', user: {} })]]);
  const res = await login({ email: 'a@b.co', password: 'pw' }, { fetchImpl: f, sleepImpl: noSleep });
  assert.strictEqual(res.token, 't');
  assert.strictEqual(f.calls.length, 2);
});

it('a wrong password is not retried', async () => {
  const f = scriptedFetch([[401, fail(401, 'Invalid email/password', 'UnauthorizedError')]]);
  await login({ email: 'a@b.co', password: 'pw' }, { fetchImpl: f, sleepImpl: noSleep }).catch(() => {});
  assert.strictEqual(f.calls.length, 1);
});

it('a real error status is not mistaken for a cold start', async () => {
  const f = scriptedFetch([[404, fail(404, 'Not found', 'ResourceNotFoundError')], [200, ok({})]]);
  const err = await request('/v1/x', { fetchImpl: f, sleepImpl: noSleep }).catch((e) => e);
  assert.strictEqual(err.status, 404);
  assert.strictEqual(f.calls.length, 1);
});

// ─── login ───

it('login posts the user login without any stored token', async () => {
  setSession({ token: 'stale' });
  const f = fakeFetch(200, ok({ token: 'new', user: { email: 'a@b.co' } }));
  const res = await login({ email: ' a@b.co ', password: 'pw' }, { fetchImpl: f });
  assert.strictEqual(f.calls[0].url.endsWith('/v1/auth/login'), true);
  assert.strictEqual(f.calls[0].init.headers.Authorization, undefined);
  assert.deepStrictEqual(JSON.parse(f.calls[0].init.body), { email: 'a@b.co', password: 'pw' });
  assert.strictEqual(res.token, 'new');
});

it('login with no token in the response is an error, not a blank session', async () => {
  const f = fakeFetch(200, ok({ user: {} }));
  const err = await login({ email: 'a@b.co', password: 'pw' }, { fetchImpl: f }).catch((e) => e);
  assert.instanceOf(err, ApiError);
});

// ─── query ───

it('buildQuery drops empty values', () => {
  assert.strictEqual(buildQuery({ search: '', source: undefined, page: 1, x: null }), '?page=1');
  assert.strictEqual(buildQuery({}), '');
  assert.strictEqual(buildQuery({ search: 'rice & beans' }), '?search=rice+%26+beans');
});

it('ingredient search is sent regex-escaped', async () => {
  assert.strictEqual(escapeRegex('a.b(c)*'), 'a\\.b\\(c\\)\\*');
  const f = fakeFetch(200, ok({ ingredients: [] }));
  await listIngredients({ search: ' (rice) ' }, { fetchImpl: f });
  assert.include(f.calls[0].url, 'search=%5C%28rice%5C%29');
});

it('nutrition search sends the group as category and the order as sort', async () => {
  const f = fakeFetch(200, ok({ docs: [], stats: { docs: 0, by_source: { usda: 0, wafct: 0 } } }));
  await searchNutrition(
    { search: ' riz blanc ', source: 'wafct', product_group: 'Cereals and their products', page: 2, limit: 25 },
    { fetchImpl: f },
  );
  const url = new URL(f.calls[0].url, 'http://x');
  assert.strictEqual(url.pathname, '/v1/nutrition/ingredients');
  assert.strictEqual(url.searchParams.get('search'), 'riz blanc');
  assert.strictEqual(url.searchParams.get('source'), 'wafct');
  assert.strictEqual(url.searchParams.get('category'), 'Cereals and their products');
  assert.strictEqual(url.searchParams.get('sort'), 'name');
  assert.strictEqual(url.searchParams.get('page'), '2');
  // The server does the search, so the term goes as typed — no regex escaping.
  assert.isFalse(url.searchParams.has('product_group'));
});

it('an unset nutrition filter never reaches the URL', async () => {
  const f = fakeFetch(200, ok({ docs: [], stats: {} }));
  await searchNutrition({ search: 'fonio', source: '', product_group: '', order: 'relevance' }, { fetchImpl: f });
  const url = new URL(f.calls[0].url, 'http://x');
  assert.isFalse(url.searchParams.has('source'));
  assert.isFalse(url.searchParams.has('category'));
  assert.strictEqual(url.searchParams.get('sort'), 'relevance');
});

it('nutrition records come back in the shape the screens read', async () => {
  const doc = {
    _id: 'n1', name: 'Fonio, white, whole grains, raw', source: 'wafct',
    source_category: 'Cereals and their products', product_group: null, food_id: '1000012',
    local_names: ['Acha'], nutrients_per_100g: { calories: 334, fiber: null }, estimated_nutrients: ['fat'],
  };
  const f = fakeFetch(200, ok({ docs: [doc], stats: { docs: 1, by_source: { usda: 0, wafct: 1 } } }));
  const { docs, stats } = await searchNutrition({ search: 'fonio' }, { fetchImpl: f });
  assert.strictEqual(docs[0].product_group, 'Cereals and their products');
  assert.strictEqual(docs[0].product_group_id, null);
  assert.deepStrictEqual(docs[0].local_names, ['Acha']);
  // A nutrient the source never published stays null.
  assert.strictEqual(docs[0].nutrients_per_100g.fiber, null);
  assert.strictEqual(stats.by_source.wafct, 1);
});

it('a nutrition record with no group or names maps to empty values, not undefined', () => {
  const r = nutritionFromApi({ _id: 'u1', name: 'Hummus', source: 'usda' });
  assert.strictEqual(r.product_group, '');
  assert.deepStrictEqual(r.local_names, []);
  assert.deepStrictEqual(r.estimated_nutrients, []);
});

it('nutrition categories unwrap from the envelope', async () => {
  const categories = [{ name: 'Beef Products', source: 'usda', count: 21 }];
  const f = fakeFetch(200, ok({ categories }));
  assert.deepStrictEqual(await listNutritionCategories({ fetchImpl: f }), categories);
  assert.include(f.calls[0].url, '/v1/nutrition/categories');
});

it('calculate posts the lines as the body', async () => {
  const lines = [{ ingredientId: 'n1', quantity: 150, unit: 'g' }];
  const f = fakeFetch(200, ok({ totals: { calories: 501 }, completeness: { complete: true } }));
  const data = await calculateNutrition(lines, { fetchImpl: f });
  assert.strictEqual(f.calls[0].init.method, 'POST');
  assert.deepStrictEqual(JSON.parse(f.calls[0].init.body), { ingredients: lines });
  assert.strictEqual(data.totals.calories, 501);
});

// ─── mapping ───

it('nutrition values map to macro keys and nulls stay null', () => {
  const m = nutritionToMacros({ nutrients_per_100g: { calories: 229, protein: 7.35, carbohydrate: 0, fat: null } });
  assert.deepStrictEqual(m, { calories: 229, protein_g: 7.35, carbs_g: 0, fat_g: null, fibre_g: null });
});

it('backend ingredients map with populated or bare references', () => {
  const row = ingredientFromApi({
    _id: 'i1', name: 'Mango', unit: { _id: 'u1', name: 'Bags' }, product_group: 'g1', created_at: 'T',
  });
  assert.deepStrictEqual(row.unit, { id: 'u1', name: 'Bags' });
  assert.deepStrictEqual(row.product_group, { id: 'g1', name: '' });
  assert.deepStrictEqual(row.product_category, { id: '', name: '' });
  assert.strictEqual(row.updated_at, 'T');
});

it('blank optional fields are left out of the request body', () => {
  const body = ingredientToApi({
    name: ' Mango ', description: '', unit: 'u1', product_group: 'g1', product_category: 'c1', image: '  ', product_url: undefined,
  });
  assert.deepStrictEqual(body, { name: 'Mango', unit: 'u1', product_group: 'g1', product_category: 'c1' });
});
