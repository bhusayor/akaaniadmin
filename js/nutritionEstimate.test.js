/* ═══════════════════════════════════════════════════════
   AKAANI ADMIN — AI NUTRITION ESTIMATOR TESTS

       node js/nutritionEstimate.test.js
   ═══════════════════════════════════════════════════════ */

'use strict';

var assert = require('assert');
var NE = require('./nutritionEstimate.js');

var ESC = String.fromCharCode(27);
var GREEN = ESC + '[32m', RED = ESC + '[31m', DIM = ESC + '[2m', OFF = ESC + '[0m';
var passed = 0, failed = 0, queued = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  ' + GREEN + 'PASS' + OFF + '  ' + name); }
  catch (err) {
    failed++;
    console.log('  ' + RED + 'FAIL' + OFF + '  ' + name);
    console.log('        ' + err.message.split('\n').join('\n        '));
  }
}
function group(name) { console.log('\n' + DIM + name + OFF); }

/* Async tests run in sequence and report at the end. */
var asyncQueue = [];
function atest(name, fn) { asyncQueue.push({ name: name, fn: fn }); queued++; }

/* ══════════════════════════════════════
   THE SANITY GATE

   Model output is untrusted. These are the tests that keep a
   hallucinated number out of a meal planner.
══════════════════════════════════════ */
group('sanity gate');

test('an implausible calorie count becomes null, not a stored number', function () {
  // 100g of pure fat is ~900 kcal. Nothing edible beats that.
  assert.strictEqual(NE.clampMacro('calories', 5000), null);
  assert.strictEqual(NE.clampMacro('calories', 901), null);
  assert.strictEqual(NE.clampMacro('calories', 900), 900);
});

test('no macro may exceed 100g per 100g of food', function () {
  assert.strictEqual(NE.clampMacro('protein_g', 150), null);
  assert.strictEqual(NE.clampMacro('fat_g', 100), 100);
});

test('negative values are rejected', function () {
  assert.strictEqual(NE.clampMacro('protein_g', -3), null);
});

test('NaN, Infinity and junk become null', function () {
  assert.strictEqual(NE.clampMacro('carbs_g', NaN), null);
  assert.strictEqual(NE.clampMacro('carbs_g', Infinity), null);
  assert.strictEqual(NE.clampMacro('carbs_g', 'abc'), null);
  assert.strictEqual(NE.clampMacro('carbs_g', {}), null);
});

test('missing values stay null and are never coerced to 0', function () {
  var m = NE.sanitizeMacros({ calories: 100 });
  assert.strictEqual(m.calories, 100);
  ['protein_g', 'carbs_g', 'fat_g', 'fibre_g'].forEach(function (k) {
    assert.strictEqual(m[k], null, k + ' should be null, got ' + m[k]);
  });
});

test('an explicit 0 survives as a real value', function () {
  // Palm oil genuinely has 0g carbs -- that is data, not a gap.
  assert.strictEqual(NE.sanitizeMacros({ carbs_g: 0 }).carbs_g, 0);
});

test('a fully empty response yields five nulls, not five zeroes', function () {
  var m = NE.sanitizeMacros({});
  NE.MACRO_KEYS.forEach(function (k) { assert.strictEqual(m[k], null); });
  assert.deepStrictEqual(NE.sanitizeMacros(null), m);
});

test('values are rounded to one decimal', function () {
  assert.strictEqual(NE.clampMacro('protein_g', 12.3456), 12.3);
});

/* ══════════════════════════════════════
   MOCK PROVIDER
══════════════════════════════════════ */
group('mock provider');

test('is deterministic for the same name', function () {
  assert.deepStrictEqual(NE.mockEstimate('Suya Spice'), NE.mockEstimate('Suya Spice'));
});

test('differs between names', function () {
  assert.notDeepStrictEqual(NE.mockEstimate('Suya Spice'), NE.mockEstimate('Ogbono'));
});

test('produces values that survive the sanity gate', function () {
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
group('estimate()');

test('an empty name is an error, not a request', function () {
  var err = null;
  NE.estimate('', function (e) { err = e; });
  assert.ok(err, 'expected an error');
  NE.estimate('   ', function (e) { assert.ok(e); });
});

test('a missing callback throws rather than failing silently', function () {
  assert.throws(function () { NE.estimate('Yam'); });
});

atest('returns a result stamped as an estimate, never as measured data', function (done) {
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

atest('every returned macro is number|null', function (done) {
  NE.estimate('Ogbono', function (err, res) {
    assert.ifError(err);
    NE.MACRO_KEYS.forEach(function (k) {
      var v = res.macros[k];
      assert.ok(v === null || typeof v === 'number', k + ' must be number|null');
    });
    done();
  });
});

atest('unknown provider is reported rather than silently doing nothing', function (done) {
  NE.configure({ provider: 'nope' });
  NE.estimate('Yam', function (err) {
    assert.ok(err && /unknown provider/i.test(err.message), 'got ' + (err && err.message));
    NE.configure({ provider: 'mock' });
    done();
  });
});

atest('estimateMany preserves order and reports progress', function (done) {
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

atest('estimateMany on an empty list finishes cleanly', function (done) {
  NE.estimateMany([], null, function (results) {
    assert.deepStrictEqual(results, []);
    done();
  });
});

/* ══════════════════════════════════════
   RUNNER
══════════════════════════════════════ */
function runAsync(i) {
  if (i >= asyncQueue.length) {
    console.log('\n' + (failed === 0
      ? GREEN + passed + ' passed' + OFF
      : GREEN + passed + ' passed' + OFF + ', ' + RED + failed + ' failed' + OFF));
    process.exit(failed === 0 ? 0 : 1);
  }
  var t = asyncQueue[i];
  var finished = false;
  var guard = setTimeout(function () {
    if (finished) return;
    finished = true; failed++;
    console.log('  ' + RED + 'FAIL' + OFF + '  ' + t.name + '\n        timed out');
    runAsync(i + 1);
  }, 5000);

  try {
    t.fn(function () {
      if (finished) return;
      finished = true; clearTimeout(guard); passed++;
      console.log('  ' + GREEN + 'PASS' + OFF + '  ' + t.name);
      runAsync(i + 1);
    });
  } catch (err) {
    if (finished) return;
    finished = true; clearTimeout(guard); failed++;
    console.log('  ' + RED + 'FAIL' + OFF + '  ' + t.name);
    console.log('        ' + err.message);
    runAsync(i + 1);
  }
}
runAsync(0);
