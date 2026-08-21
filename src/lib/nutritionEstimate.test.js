/* ═══════════════════════════════════════════════════════
   AI NUTRITION ESTIMATOR TESTS         run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert, expect } from 'vitest';
import * as NE from './nutritionEstimate.js';

/* The estimator is callback-based, so async cases resolve a promise
   when their callback fires. Bodies are unchanged from the originals. */
const itAsync = (name, fn) => it(name, () => new Promise((done) => fn(done)));



/* ══════════════════════════════════════
   THE SANITY GATE

   Model output is untrusted. These are the tests that keep a
   hallucinated number out of a meal planner.
══════════════════════════════════════ */
// ─── sanity gate ───

it('an implausible calorie count becomes null, not a stored number', function () {
  // 100g of pure fat is ~900 kcal. Nothing edible beats that.
  assert.strictEqual(NE.clampMacro('calories', 5000), null);
  assert.strictEqual(NE.clampMacro('calories', 901), null);
  assert.strictEqual(NE.clampMacro('calories', 900), 900);
});

it('no macro may exceed 100g per 100g of food', function () {
  assert.strictEqual(NE.clampMacro('protein_g', 150), null);
  assert.strictEqual(NE.clampMacro('fat_g', 100), 100);
});

it('negative values are rejected', function () {
  assert.strictEqual(NE.clampMacro('protein_g', -3), null);
});

it('NaN, Infinity and junk become null', function () {
  assert.strictEqual(NE.clampMacro('carbs_g', NaN), null);
  assert.strictEqual(NE.clampMacro('carbs_g', Infinity), null);
  assert.strictEqual(NE.clampMacro('carbs_g', 'abc'), null);
  assert.strictEqual(NE.clampMacro('carbs_g', {}), null);
});

it('missing values stay null and are never coerced to 0', function () {
  var m = NE.sanitizeMacros({ calories: 100 });
  assert.strictEqual(m.calories, 100);
  ['protein_g', 'carbs_g', 'fat_g', 'fibre_g'].forEach(function (k) {
    assert.strictEqual(m[k], null, k + ' should be null, got ' + m[k]);
  });
});

it('an explicit 0 survives as a real value', function () {
  // Palm oil genuinely has 0g carbs -- that is data, not a gap.
  assert.strictEqual(NE.sanitizeMacros({ carbs_g: 0 }).carbs_g, 0);
});

it('a fully empty response yields five nulls, not five zeroes', function () {
  var m = NE.sanitizeMacros({});
  NE.MACRO_KEYS.forEach(function (k) { assert.strictEqual(m[k], null); });
  assert.deepStrictEqual(NE.sanitizeMacros(null), m);
});

it('values are rounded to one decimal', function () {
  assert.strictEqual(NE.clampMacro('protein_g', 12.3456), 12.3);
});

/* ══════════════════════════════════════
   MOCK PROVIDER
══════════════════════════════════════ */
// ─── mock provider ───

it('is deterministic for the same name', function () {
  assert.deepStrictEqual(NE.mockEstimate('Suya Spice'), NE.mockEstimate('Suya Spice'));
});

it('differs between names', function () {
  expect(NE.mockEstimate('Suya Spice')).not.toEqual(NE.mockEstimate('Ogbono'));
});

it('produces values that survive the sanity gate', function () {
  ['Suya Spice Blend', 'Ogbono', 'Zobo Drink', 'Kuli Kuli'].forEach(function (n) {
    var m = NE.sanitizeMacros(NE.mockEstimate(n));
    NE.MACRO_KEYS.forEach(function (k) {
      assert.ok(m[k] !== null, n + '.' + k + ' was rejected by the gate');
    });
  });
});

/* ══════════════════════════════════════
   ESTIMATE
══════════════════════════════════════ */
// ─── estimate() ───

it('an empty name is an error, not a request', function () {
  var err = null;
  NE.estimate('', function (e) { err = e; });
  assert.ok(err, 'expected an error');
  NE.estimate('   ', function (e) { assert.ok(e); });
});

it('a missing callback throws rather than failing silently', function () {
  assert.throws(function () { NE.estimate('Yam'); });
});

itAsync('returns a result stamped as an estimate, never as measured data', function (done) {
  NE.estimate('Suya Spice Blend', function (err, res) {
    assert.ifError(err);
    assert.strictEqual(res.confidence, 'estimated');
    assert.strictEqual(res.model, 'mock');
    assert.strictEqual(res.source, 'AI estimate (mock)');
    // The source must never be confusable with the WAFCT one.
    assert.ok(res.source.indexOf('WAFCT') === -1);
    assert.ok(res.source.indexOf('AI estimate') === 0, 'source must be identifiable as AI');
    assert.strictEqual(res.name, 'Suya Spice Blend');
    done();
  });
});

itAsync('every returned macro is number|null', function (done) {
  NE.estimate('Ogbono', function (err, res) {
    assert.ifError(err);
    NE.MACRO_KEYS.forEach(function (k) {
      var v = res.macros[k];
      assert.ok(v === null || typeof v === 'number', k + ' must be number|null');
    });
    done();
  });
});

itAsync('unknown provider is reported rather than silently doing nothing', function (done) {
  NE.configure({ provider: 'nope' });
  NE.estimate('Yam', function (err) {
    assert.ok(err && /unknown provider/i.test(err.message), 'got ' + (err && err.message));
    NE.configure({ provider: 'mock' });
    done();
  });
});

itAsync('estimateMany preserves order and reports progress', function (done) {
  var names = ['Kuli Kuli', 'Zobo', 'Nkwobi'];
  var seen = [];
  NE.estimateMany(names, function (n, total) { seen.push(n + '/' + total); }, function (results) {
    assert.strictEqual(results.length, 3);
    assert.deepStrictEqual(results.map(function (r) { return r.name; }), names);
    assert.deepStrictEqual(seen, ['1/3', '2/3', '3/3']);
    results.forEach(function (r) { assert.strictEqual(r.error, null); });
    done();
  });
});

itAsync('estimateMany on an empty list finishes cleanly', function (done) {
  NE.estimateMany([], null, function (results) {
    assert.deepStrictEqual(results, []);
    done();
  });
});
