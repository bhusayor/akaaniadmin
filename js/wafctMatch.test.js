/* ═══════════════════════════════════════════════════════
   AKAANI ADMIN — WAFCT MATCHER TESTS

   No test framework, no npm, no build step — matching the rest of
   this repo. Run it with:

       node js/wafctMatch.test.js
   ═══════════════════════════════════════════════════════ */

'use strict';

var assert = require('assert');
var M = require('./wafctMatch.js');
var DATA = require('./wafct-data.js');

var ESC = String.fromCharCode(27);
var GREEN = ESC + '[32m', RED = ESC + '[31m', DIM = ESC + '[2m', OFF = ESC + '[0m';
var passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ' + GREEN + 'PASS' + OFF + '  ' + name);
  } catch (err) {
    failed++;
    console.log('  ' + RED + 'FAIL' + OFF + '  ' + name);
    console.log('        ' + err.message.split('\n').join('\n        '));
  }
}

function group(name) { console.log('\n' + DIM + name + OFF); }

function top(name) { return M.findMatches(name, DATA)[0]; }

/* ══════════════════════════════════════
   DATASET INTEGRITY
══════════════════════════════════════ */
group('dataset');

test('loads 960 foods', function () {
  assert.strictEqual(DATA.length, 960);
});

test('every row survives JSON round-trip (no bare NaN left)', function () {
  // The upstream file carries 57 bare `NaN` tokens, which make
  // JSON.parse() throw in both Node and the browser. By the time the
  // data ships they must all be null.
  assert.doesNotThrow(function () { JSON.parse(JSON.stringify(DATA)); });
  assert.strictEqual(DATA.filter(function (r) { return r.category === null; }).length, 57);
});

test('missing nutrients are null, never 0 and never NaN', function () {
  var missingFibre = DATA.filter(function (r) { return r.fibre_g === null; });
  assert.strictEqual(missingFibre.length, 1, 'the one known missing fibre value stays null');
  DATA.forEach(function (r) {
    ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'].forEach(function (k) {
      assert.ok(r[k] === null || typeof r[k] === 'number', r.food_id + '.' + k + ' must be number|null');
      assert.ok(!Number.isNaN(r[k]), r.food_id + '.' + k + ' must not be NaN');
    });
  });
});

test('every row is stamped with the WAFCT source', function () {
  DATA.forEach(function (r) {
    assert.strictEqual(r.source, 'FAO/INFOODS WAFCT 2019');
  });
});

/* ══════════════════════════════════════
   NORMALIZE
══════════════════════════════════════ */
group('normalize');

test('lowercases', function () {
  assert.strictEqual(M.normalize('TOMATO'), 'tomato');
});

test('strips parenthetical notes', function () {
  assert.strictEqual(M.normalize('Yam (any variety)'), 'yam');
  assert.strictEqual(M.normalize('Jute mallow (bush-okra)'), 'jute mallow');
});

test('strips prep words', function () {
  assert.strictEqual(M.normalize('Fresh Chopped Tomato'), 'tomato');
  assert.strictEqual(M.normalize('large ripe plantain'), 'plantain');
  assert.strictEqual(M.normalize('Rice, boiled'), 'rice');
  assert.strictEqual(M.normalize('Ground crayfish'), 'crayfish');
});

test('strips filler words', function () {
  assert.strictEqual(M.normalize('a pinch of salt'), 'pinch salt');
  assert.strictEqual(M.normalize('onion, optional'), 'onion');
});

test('strips punctuation and hyphens', function () {
  assert.strictEqual(M.normalize('black-eyed  beans!!'), 'black eyed beans');
});

test('handles empty and nullish input', function () {
  assert.strictEqual(M.normalize(''), '');
  assert.strictEqual(M.normalize(null), '');
  assert.strictEqual(M.normalize(undefined), '');
});

/* ══════════════════════════════════════
   PROCESSING STATE — THE REGRESSION
══════════════════════════════════════ */
group('processing state (regression)');

test('REGRESSION: "Boiled Yam" matches a BOILED yam, never a fried one', function () {
  // This exact bug shipped once: "Boiled Yam" landed on
  // "Yam, tuber, deep fried in unfortified vegetable oil*" because the
  // matcher treated fried and boiled as interchangeably "cooked".
  // A named processing state must be honoured exactly.
  var name = top('Boiled Yam').food.name;
  assert.ok(/boiled/i.test(name), 'expected a boiled record, got: ' + name);
  assert.ok(!/fried/i.test(name), 'must NOT be a fried record, got: ' + name);
});

test('"Fried Yam" still matches the fried record', function () {
  assert.ok(/fried/i.test(top('Fried Yam').food.name));
});

test('honours "roasted" when the dataset actually has a roasted row', function () {
  // Afzelia africana is the only genuinely roasted record in all 960 rows.
  var name = top('Roasted Afzelia africana').food.name;
  assert.ok(/roasted/i.test(name), 'got: ' + name);
});

test('"Roasted Groundnut" falls back to raw, not to boiled', function () {
  // WAFCT carries no roasted groundnut. The correct behaviour is to fall
  // back to the raw row -- NOT to grab a boiled variant just because it is
  // also "cooked". Groundnut does have boiled rows, so this is a real trap.
  var name = top('Roasted Groundnut').food.name;
  assert.ok(!/boiled|fried/i.test(name), 'grabbed a different cooked state: ' + name);
  assert.ok(/raw/i.test(name), 'expected the raw fallback, got: ' + name);
});

test('a named state never falls back to a DIFFERENT cooked state', function () {
  // WAFCT has no ", steamed" rice row. It must fall back to raw/default,
  // NOT to boiled or fried.
  var name = top('Steamed Rice').food.name;
  assert.ok(!/fried|boiled|roasted|smoked/i.test(name),
    'fell back to another cooked variant: ' + name);
});

test('fresh/raw input prefers the ", raw" row', function () {
  assert.ok(/,\s*raw/i.test(top('Fresh Tomato').food.name));
});

test('with no state named, defaults to raw', function () {
  assert.ok(/,\s*raw/i.test(top('Yam').food.name));
});

test('prefers atomic values over "as part of a recipe"', function () {
  assert.ok(!/as part of a recipe/i.test(top('Boiled Yam').food.name));
});

/* ══════════════════════════════════════
   ALIASES
══════════════════════════════════════ */
group('aliases');

var ALIAS_CASES = [
  ['Egusi',            /melon seed/i],
  ['Crayfish',         /shrimp/i],
  ['Dried Crayfish',   /shrimp/i],
  ['Ewedu',            /jute mallow/i],
  ['Garden Egg',       /eggplant/i],
  ['Garden Eggs',      /eggplant/i],
  ['Iru',              /locust bean/i],
  ['Locust Beans',     /locust bean/i],
  ['Black-eyed beans', /cowpea/i],
  ['Black eyed peas',  /cowpea/i],
  ['Scotch Bonnet',    /chilli pepper/i]
];

ALIAS_CASES.forEach(function (pair) {
  test('"' + pair[0] + '" resolves to ' + pair[1], function () {
    var r = top(pair[0]);
    assert.ok(r, 'no match at all');
    assert.ok(pair[1].test(r.food.name), 'got: ' + r.food.name);
    assert.ok(r.score >= M.REVIEW_THRESHOLD, 'score too low: ' + r.score);
  });
});

/* ══════════════════════════════════════
   MATCHING & SCORING
══════════════════════════════════════ */
group('findMatches');

test('returns at most 3 candidates, best first', function () {
  var r = M.findMatches('Rice', DATA);
  assert.ok(r.length <= 3, 'returned ' + r.length);
  for (var i = 1; i < r.length; i++) {
    assert.ok(r[i - 1].score >= r[i].score, 'not sorted by score');
  }
});

test('exact core name scores 100 and reads as matched', function () {
  var r = top('Tomato');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.confidence, 'matched');
});

test('gibberish scores below the review threshold', function () {
  var r = top('zzzqqq xyzzy');
  assert.ok(!r || r.score < M.REVIEW_THRESHOLD,
    'gibberish should not pass review: ' + (r && r.score));
});

test('empty input returns no candidates', function () {
  assert.deepStrictEqual(M.findMatches('', DATA), []);
  assert.deepStrictEqual(M.findMatches('   ', DATA), []);
  assert.deepStrictEqual(M.findMatches(null, DATA), []);
});

test('confidence bands follow the documented thresholds', function () {
  assert.strictEqual(M.REVIEW_THRESHOLD, 70);
  assert.strictEqual(M.MATCHED_THRESHOLD, 88);
});

test('matched food carries all five macros as number|null', function () {
  var f = top('Rice').food;
  ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'].forEach(function (k) {
    assert.ok(f[k] === null || typeof f[k] === 'number', k + ' must be number|null');
  });
});

test('common West African staples all resolve', function () {
  ['Rice', 'Beans', 'Plantain', 'Cassava', 'Maize', 'Groundnut', 'Palm Oil', 'Okra']
    .forEach(function (n) {
      var r = top(n);
      assert.ok(r && r.score >= M.REVIEW_THRESHOLD,
        n + ' failed to resolve (' + (r && r.score) + ')');
    });
});

test('works against the default global dataset when none is passed', function () {
  global.WAFCT_DATA = DATA;
  assert.ok(M.findMatches('Tomato').length > 0);
  delete global.WAFCT_DATA;
});

/* ══════════════════════════════════════
   CATEGORY MAPPING
══════════════════════════════════════ */
group('category mapping');

test('maps clean WAFCT categories onto product groups', function () {
  assert.strictEqual(M.mapWafctCategory('Grains').group, 'Grains & Starches');
  assert.strictEqual(M.mapWafctCategory('Legumes').group, 'Legumes, Nuts & Seeds');
  assert.strictEqual(M.mapWafctCategory('Oils & Fats').group, 'Oils, Fats & Condiments');
});

test('leaves the category null where the dataset is too coarse', function () {
  assert.strictEqual(M.mapWafctCategory('Grains').category, null);
  assert.strictEqual(M.mapWafctCategory('Proteins').category, null);
});

test('sets a category only where the WAFCT bucket is genuinely clean', function () {
  assert.strictEqual(M.mapWafctCategory('Legumes').category, 'Beans & Pulses');
  assert.strictEqual(M.mapWafctCategory('Oils & Fats').category, 'Oils & Fats');
});

test('unmapped / null category returns nulls rather than guessing', function () {
  assert.deepStrictEqual(M.mapWafctCategory(null), { group: null, category: null });
  assert.deepStrictEqual(M.mapWafctCategory('Soups/sauces'), { group: null, category: null });
});

test('every mapped group and category exists in the taxonomy', function () {
  Object.keys(M.WAFCT_CATEGORY_MAP).forEach(function (k) {
    var m = M.WAFCT_CATEGORY_MAP[k];
    assert.ok(M.PRODUCT_GROUPS.indexOf(m.group) !== -1, m.group + ' missing from PRODUCT_GROUPS');
    if (m.category) {
      assert.ok(M.PRODUCT_CATEGORIES[m.group].indexOf(m.category) !== -1,
        m.category + ' missing from PRODUCT_CATEGORIES[' + m.group + ']');
    }
  });
});

test('every product group has categories defined', function () {
  M.PRODUCT_GROUPS.forEach(function (g) {
    assert.ok(M.PRODUCT_CATEGORIES[g] && M.PRODUCT_CATEGORIES[g].length, g + ' has no categories');
  });
});

test('every WAFCT category present in the data is handled', function () {
  var seen = {};
  DATA.forEach(function (r) { if (r.category) seen[r.category] = true; });
  Object.keys(seen).forEach(function (c) {
    assert.ok(M.WAFCT_CATEGORY_MAP[c], 'unhandled WAFCT category in data: ' + c);
  });
});

/* ══════════════════════════════════════
   CATEGORY INFERENCE
══════════════════════════════════════ */
group('category inference');

function tax(name) { return M.suggestTaxonomy(top(name).food); }

var TAXONOMY_CASES = [
  ['Boiled Yam',    'Grains & Starches',       'Roots & Tubers'],
  ['Rice',          'Grains & Starches',       'Cereals & Grains'],
  ['Bread',         'Grains & Starches',       'Bread & Baked Goods'],
  ['Ewedu',         'Vegetables',              'Leafy Greens'],
  ['Garden Eggs',   'Vegetables',              'Fruiting Vegetables'],
  ['Carrot',        'Vegetables',              'Root Vegetables'],
  ['Mango',         'Fruits',                  'Fresh Fruits'],
  ['Cowpea',        'Legumes, Nuts & Seeds',   'Beans & Pulses'],
  ['Egusi',         'Legumes, Nuts & Seeds',   'Nuts & Seeds'],
  ['Beef',          'Proteins',                'Meat & Poultry'],
  ['Crayfish',      'Proteins',                'Fish & Seafood'],
  ['Milk',          'Dairy',                   'Milk & Cream'],
  ['Palm Oil',      'Oils, Fats & Condiments', 'Oils & Fats'],
  ['Beer',          'Beverages',               'Alcoholic Drinks'],
  ['Coffee',        'Beverages',               'Tea, Coffee & Cocoa']
];

TAXONOMY_CASES.forEach(function (c) {
  test('"' + c[0] + '" -> ' + c[1] + ' / ' + c[2], function () {
    var t = tax(c[0]);
    assert.strictEqual(t.group, c[1], 'group: got ' + t.group);
    assert.strictEqual(t.category, c[2], 'category: got ' + t.category);
  });
});

test('every food in the dataset gets a category', function () {
  var missing = DATA.filter(function (f) { return !M.suggestTaxonomy(f).category; });
  assert.strictEqual(missing.length, 0,
    missing.length + ' uncategorised, e.g. ' + missing.slice(0, 3).map(function (f) { return f.name; }).join(' | '));
});

test('inferred category always belongs to the inferred group', function () {
  DATA.forEach(function (f) {
    var t = M.suggestTaxonomy(f);
    if (!t.category) return;
    assert.ok(M.PRODUCT_CATEGORIES[t.group].indexOf(t.category) !== -1,
      f.name + ' -> ' + t.group + ' / ' + t.category + ' is not a valid pairing');
  });
});

test('rule order: oil beats nut, seed beats fruit', function () {
  assert.strictEqual(M.inferProductCategory('Groundnut oil, unfortified'), 'Oils & Fats');
  assert.strictEqual(M.inferProductCategory('Melon seed, kernel only, dried, raw'), 'Nuts & Seeds');
  assert.strictEqual(M.inferProductCategory('Melon, cantaloupe, orange flesh, raw'), 'Fresh Fruits');
});

test('"eggplant" is never read as an egg', function () {
  assert.strictEqual(M.inferProductCategory('Eggplant, fruit, raw'), 'Fruiting Vegetables');
  assert.strictEqual(M.inferProductCategory('Egg, chicken, whole, raw'), 'Eggs');
});

test('"locust bean" is a legume, not an insect', function () {
  assert.strictEqual(M.inferProductCategory('African locust bean, dry, raw'), 'Beans & Pulses');
});

test('"Water yam" is a tuber, "Water, tap" is a drink', function () {
  assert.strictEqual(M.inferProductCategory('Water yam, tuber, raw'), 'Roots & Tubers');
  assert.strictEqual(M.inferProductCategory('Water, tap'), 'Juices & Drinks');
});

test('dried fruit is distinguished from fresh', function () {
  assert.strictEqual(M.inferProductCategory('Date, dried'), 'Dried Fruits');
});

test('unknown text yields null rather than a guess', function () {
  assert.strictEqual(M.inferProductCategory('zzzqqq xyzzy'), null);
  assert.strictEqual(M.inferProductCategory(''), null);
  assert.strictEqual(M.inferProductCategory(null), null);
});

test('groupForCategory resolves every category in the taxonomy', function () {
  M.PRODUCT_GROUPS.forEach(function (g) {
    M.PRODUCT_CATEGORIES[g].forEach(function (c) {
      assert.strictEqual(M.groupForCategory(c), g, c + ' resolved to the wrong group');
    });
  });
});

test('suggestTaxonomy falls back to the coarse map when the name says nothing', function () {
  var t = M.suggestTaxonomy({ name: 'zzzqqq xyzzy', category: 'Legumes' });
  assert.strictEqual(t.group, 'Legumes, Nuts & Seeds');
  assert.deepStrictEqual(M.suggestTaxonomy(null), { group: null, category: null });
});

/* ══════════════════════════════════════
   UNITS
══════════════════════════════════════ */
group('units');

test('offers gram, ounce and pounds', function () {
  assert.deepStrictEqual(M.UNITS.map(function (u) { return u.value; }), ['g', 'oz', 'lbs']);
  assert.deepStrictEqual(M.UNITS.map(function (u) { return u.label; }),
    ['gram (g)', 'ounce (oz)', 'pounds (lbs)']);
});

test('every unit has both a value and a label', function () {
  M.UNITS.forEach(function (u) {
    assert.ok(u.value && typeof u.value === 'string', 'missing value');
    assert.ok(u.label && typeof u.label === 'string', 'missing label for ' + u.value);
    assert.ok(u.label.indexOf(u.value) !== -1, u.label + ' should show its short form');
  });
});

/* ══════════════════════════════════════
   SUMMARY
══════════════════════════════════════ */
console.log('\n' + (failed === 0
  ? GREEN + passed + ' passed' + OFF
  : GREEN + passed + ' passed' + OFF + ', ' + RED + failed + ' failed' + OFF));

process.exit(failed === 0 ? 0 : 1);
