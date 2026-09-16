/* ═══════════════════════════════════════════════════════
   PLATFORM API CLIENT TESTS    run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert, beforeEach } from 'vitest';
import {
  request, login, ApiError, buildQuery, isExpiredSession, isForbidden,
  getSession, setSession, clearSession, onSessionChange,
  nutritionToMacros, nutritionSourceLabel, ingredientFromApi, ingredientToApi,
  buildCalculateLines, USDA_SOURCE, escapeRegex, listIngredients,
} from './api.js';
import { WAFCT_SOURCE } from './ingredients.js';

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

// ─── mapping ───

it('nutrition values map to macro keys and nulls stay null', () => {
  const m = nutritionToMacros({ nutrients_per_100g: { calories: 229, protein: 7.35, carbohydrate: 0, fat: null } });
  assert.deepStrictEqual(m, { calories: 229, protein_g: 7.35, carbs_g: 0, fat_g: null, fibre_g: null });
});

it('source labels keep the WAFCT badge working', () => {
  assert.strictEqual(nutritionSourceLabel({ source: 'wafct' }), WAFCT_SOURCE);
  assert.strictEqual(nutritionSourceLabel({ source: 'usda' }), USDA_SOURCE);
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

// ─── meal nutrition lines ───

it('only linked rows with a convertible quantity are sent', () => {
  const { lines, skipped } = buildCalculateLines([
    { name: 'rice', nutritionId: 'n1', quantity: '300', unit: 'g' },
    { name: 'palm oil', nutritionId: 'n2', quantity: '2', unit: 'tbsp' },
    { name: 'onion', quantity: '1', unit: '' },
    { name: 'beans', nutritionId: 'n3', quantity: 'some', unit: 'kg' },
    { name: 'fish', nutritionId: 'n4', quantity: '0.5', unit: 'LB' },
    { name: '', quantity: '', unit: '' },
  ]);
  assert.deepStrictEqual(lines, [
    { ingredientId: 'n1', quantity: 300, unit: 'g' },
    { ingredientId: 'n4', quantity: 0.5, unit: 'lb' },
  ]);
  assert.deepStrictEqual(skipped.map((s) => s.name), ['palm oil', 'onion', 'beans']);
  assert.match(skipped[0].reason, /can't be converted/);
  assert.match(skipped[1].reason, /not linked/);
  assert.match(skipped[2].reason, /numeric quantity/);
});
