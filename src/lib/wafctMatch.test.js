/* ═══════════════════════════════════════════════════════
   WAFCT MATCHER TESTS         run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import * as M from './wafctMatch.js';
import DATA from './wafctData.js';

const top = (name) => M.findMatches(name, DATA)[0];

/* ══════════════════════════════════════
   DATASET INTEGRITY
══════════════════════════════════════ */
// ─── dataset ───

it('loads 960 foods', function () {
  assert.strictEqual(DATA.length, 960);
});

it('every row survives JSON round-trip (no bare NaN left)', function () {
  // The upstream file carries 57 bare `NaN` tokens, which make
  // JSON.parse() throw in both Node and the browser. By the time the
  // data ships they must all be null.
  assert.doesNotThrow(function () { JSON.parse(JSON.stringify(DATA)); });
  assert.strictEqual(DATA.filter(function (r) { return r.category === null; }).length, 57);
});

it('missing nutrients are null, never 0 and never NaN', function () {
  var missingFibre = DATA.filter(function (r) { return r.fibre_g === null; });
  assert.strictEqual(missingFibre.length, 1, 'the one known missing fibre value stays null');
  DATA.forEach(function (r) {
    ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'].forEach(function (k) {
      assert.ok(r[k] === null || typeof r[k] === 'number', r.food_id + '.' + k + ' must be number|null');
      assert.ok(!Number.isNaN(r[k]), r.food_id + '.' + k + ' must not be NaN');
    });
  });
});

it('every row is stamped with the WAFCT source', function () {
  DATA.forEach(function (r) {
    assert.strictEqual(r.source, 'FAO/INFOODS WAFCT 2019');
  });
});

/* ══════════════════════════════════════
   NORMALIZE
══════════════════════════════════════ */
// ─── normalize ───

it('lowercases', function () {
  assert.strictEqual(M.normalize('TOMATO'), 'tomato');
});

it('strips parenthetical notes', function () {
  assert.strictEqual(M.normalize('Yam (any variety)'), 'yam');
  assert.strictEqual(M.normalize('Jute mallow (bush-okra)'), 'jute mallow');
});

it('strips prep words', function () {
  assert.strictEqual(M.normalize('Fresh Chopped Tomato'), 'tomato');
  assert.strictEqual(M.normalize('large ripe plantain'), 'plantain');
  assert.strictEqual(M.normalize('Rice, boiled'), 'rice');
  assert.strictEqual(M.normalize('Ground crayfish'), 'crayfish');
});

it('strips filler words', function () {
  assert.strictEqual(M.normalize('a pinch of salt'), 'pinch salt');
  assert.strictEqual(M.normalize('onion, optional'), 'onion');
});

it('strips punctuation and hyphens', function () {
  assert.strictEqual(M.normalize('black-eyed  beans!!'), 'black eyed beans');
});

it('handles empty and nullish input', function () {
  assert.strictEqual(M.normalize(''), '');
  assert.strictEqual(M.normalize(null), '');
  assert.strictEqual(M.normalize(undefined), '');
});

/* ══════════════════════════════════════
   PROCESSING STATE — THE REGRESSION
══════════════════════════════════════ */
// ─── processing state (regression) ───

it('REGRESSION: "Boiled Yam" matches a BOILED yam, never a fried one', function () {
  // This exact bug shipped once: "Boiled Yam" landed on
  // "Yam, tuber, deep fried in unfortified vegetable oil*" because the
  // matcher treated fried and boiled as interchangeably "cooked".
  // A named processing state must be honoured exactly.
  var name = top('Boiled Yam').food.name;
  assert.ok(/boiled/i.test(name), 'expected a boiled record, got: ' + name);
  assert.ok(!/fried/i.test(name), 'must NOT be a fried record, got: ' + name);
});

it('"Fried Yam" still matches the fried record', function () {
  assert.ok(/fried/i.test(top('Fried Yam').food.name));
});

it('honours "roasted" when the dataset actually has a roasted row', function () {
  // Afzelia africana is the only genuinely roasted record in all 960 rows.
  var name = top('Roasted Afzelia africana').food.name;
  assert.ok(/roasted/i.test(name), 'got: ' + name);
});

it('"Roasted Groundnut" falls back to raw, not to boiled', function () {
  // WAFCT carries no roasted groundnut. The correct behaviour is to fall
  // back to the raw row -- NOT to grab a boiled variant just because it is
  // also "cooked". Groundnut does have boiled rows, so this is a real trap.
  var name = top('Roasted Groundnut').food.name;
  assert.ok(!/boiled|fried/i.test(name), 'grabbed a different cooked state: ' + name);
  assert.ok(/raw/i.test(name), 'expected the raw fallback, got: ' + name);
});

it('a named state never falls back to a DIFFERENT cooked state', function () {
  // WAFCT has no ", steamed" rice row. It must fall back to raw/default,
  // NOT to boiled or fried.
  var name = top('Steamed Rice').food.name;
  assert.ok(!/fried|boiled|roasted|smoked/i.test(name),
    'fell back to another cooked variant: ' + name);
});

it('fresh/raw input prefers the ", raw" row', function () {
  assert.ok(/,\s*raw/i.test(top('Fresh Tomato').food.name));
});

it('with no state named, defaults to raw', function () {
  assert.ok(/,\s*raw/i.test(top('Yam').food.name));
});

it('prefers atomic values over "as part of a recipe"', function () {
  assert.ok(!/as part of a recipe/i.test(top('Boiled Yam').food.name));
});

/* ══════════════════════════════════════
   ALIASES
══════════════════════════════════════ */
// ─── aliases ───

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
  it('"' + pair[0] + '" resolves to ' + pair[1], function () {
    var r = top(pair[0]);
    assert.ok(r, 'no match at all');
    assert.ok(pair[1].test(r.food.name), 'got: ' + r.food.name);
    assert.ok(r.score >= M.REVIEW_THRESHOLD, 'score too low: ' + r.score);
  });
});

/* ══════════════════════════════════════
   MATCHING & SCORING
══════════════════════════════════════ */
// ─── findMatches ───

it('returns at most 3 candidates, best first', function () {
  var r = M.findMatches('Rice', DATA);
  assert.ok(r.length <= 3, 'returned ' + r.length);
  for (var i = 1; i < r.length; i++) {
    assert.ok(r[i - 1].score >= r[i].score, 'not sorted by score');
  }
});

it('exact core name scores 100 and reads as matched', function () {
  var r = top('Tomato');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.confidence, 'matched');
});

it('gibberish scores below the review threshold', function () {
  var r = top('zzzqqq xyzzy');
  assert.ok(!r || r.score < M.REVIEW_THRESHOLD,
    'gibberish should not pass review: ' + (r && r.score));
});

it('empty input returns no candidates', function () {
  assert.deepStrictEqual(M.findMatches('', DATA), []);
  assert.deepStrictEqual(M.findMatches('   ', DATA), []);
  assert.deepStrictEqual(M.findMatches(null, DATA), []);
});

it('confidence bands follow the documented thresholds', function () {
  assert.strictEqual(M.REVIEW_THRESHOLD, 70);
  assert.strictEqual(M.MATCHED_THRESHOLD, 88);
});

it('matched food carries all five macros as number|null', function () {
  var f = top('Rice').food;
  ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'].forEach(function (k) {
    assert.ok(f[k] === null || typeof f[k] === 'number', k + ' must be number|null');
  });
});

it('common West African staples all resolve', function () {
  ['Rice', 'Beans', 'Plantain', 'Cassava', 'Maize', 'Groundnut', 'Palm Oil', 'Okra']
    .forEach(function (n) {
      var r = top(n);
      assert.ok(r && r.score >= M.REVIEW_THRESHOLD,
        n + ' failed to resolve (' + (r && r.score) + ')');
    });
});

it('works against the bundled dataset when none is passed', function () {
  assert.ok(M.findMatches('Tomato').length > 0);
});

/* ══════════════════════════════════════
   CATEGORY MAPPING
══════════════════════════════════════ */
// ─── category mapping ───

it('maps clean WAFCT categories onto product groups', function () {
  assert.strictEqual(M.mapWafctCategory('Grains').group, 'Grains & Starches');
  assert.strictEqual(M.mapWafctCategory('Legumes').group, 'Legumes, Nuts & Seeds');
  assert.strictEqual(M.mapWafctCategory('Oils & Fats').group, 'Oils, Fats & Condiments');
});

it('leaves the category null where the dataset is too coarse', function () {
  assert.strictEqual(M.mapWafctCategory('Grains').category, null);
  assert.strictEqual(M.mapWafctCategory('Proteins').category, null);
});

it('sets a category only where the WAFCT bucket is genuinely clean', function () {
  assert.strictEqual(M.mapWafctCategory('Legumes').category, 'Beans & Pulses');
  assert.strictEqual(M.mapWafctCategory('Oils & Fats').category, 'Oils & Fats');
});

it('unmapped / null category returns nulls rather than guessing', function () {
  assert.deepStrictEqual(M.mapWafctCategory(null), { group: null, category: null });
  assert.deepStrictEqual(M.mapWafctCategory('Soups/sauces'), { group: null, category: null });
});

it('every mapped group and category exists in the taxonomy', function () {
  Object.keys(M.WAFCT_CATEGORY_MAP).forEach(function (k) {
    var m = M.WAFCT_CATEGORY_MAP[k];
    assert.ok(M.PRODUCT_GROUPS.indexOf(m.group) !== -1, m.group + ' missing from PRODUCT_GROUPS');
    if (m.category) {
      assert.ok(M.PRODUCT_CATEGORIES[m.group].indexOf(m.category) !== -1,
        m.category + ' missing from PRODUCT_CATEGORIES[' + m.group + ']');
    }
  });
});

it('every product group has categories defined', function () {
  M.PRODUCT_GROUPS.forEach(function (g) {
    assert.ok(M.PRODUCT_CATEGORIES[g] && M.PRODUCT_CATEGORIES[g].length, g + ' has no categories');
  });
});

it('every WAFCT category present in the data is handled', function () {
  var seen = {};
  DATA.forEach(function (r) { if (r.category) seen[r.category] = true; });
  Object.keys(seen).forEach(function (c) {
    assert.ok(M.WAFCT_CATEGORY_MAP[c], 'unhandled WAFCT category in data: ' + c);
  });
});

/* ══════════════════════════════════════
   CATEGORY INFERENCE
══════════════════════════════════════ */
// ─── category inference ───

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
  it('"' + c[0] + '" -> ' + c[1] + ' / ' + c[2], function () {
    var t = tax(c[0]);
    assert.strictEqual(t.group, c[1], 'group: got ' + t.group);
    assert.strictEqual(t.category, c[2], 'category: got ' + t.category);
  });
});

it('every food in the dataset gets a category', function () {
  var missing = DATA.filter(function (f) { return !M.suggestTaxonomy(f).category; });
  assert.strictEqual(missing.length, 0,
    missing.length + ' uncategorised, e.g. ' + missing.slice(0, 3).map(function (f) { return f.name; }).join(' | '));
});

it('inferred category always belongs to the inferred group', function () {
  DATA.forEach(function (f) {
    var t = M.suggestTaxonomy(f);
    if (!t.category) return;
    assert.ok(M.PRODUCT_CATEGORIES[t.group].indexOf(t.category) !== -1,
      f.name + ' -> ' + t.group + ' / ' + t.category + ' is not a valid pairing');
  });
});

it('rule order: oil beats nut, seed beats fruit', function () {
  assert.strictEqual(M.inferProductCategory('Groundnut oil, unfortified'), 'Oils & Fats');
  assert.strictEqual(M.inferProductCategory('Melon seed, kernel only, dried, raw'), 'Nuts & Seeds');
  assert.strictEqual(M.inferProductCategory('Melon, cantaloupe, orange flesh, raw'), 'Fresh Fruits');
});

it('"eggplant" is never read as an egg', function () {
  assert.strictEqual(M.inferProductCategory('Eggplant, fruit, raw'), 'Fruiting Vegetables');
  assert.strictEqual(M.inferProductCategory('Egg, chicken, whole, raw'), 'Eggs');
});

it('"locust bean" is a legume, not an insect', function () {
  assert.strictEqual(M.inferProductCategory('African locust bean, dry, raw'), 'Beans & Pulses');
});

it('"Water yam" is a tuber, "Water, tap" is a drink', function () {
  assert.strictEqual(M.inferProductCategory('Water yam, tuber, raw'), 'Roots & Tubers');
  assert.strictEqual(M.inferProductCategory('Water, tap'), 'Juices & Drinks');
});

it('dried fruit is distinguished from fresh', function () {
  assert.strictEqual(M.inferProductCategory('Date, dried'), 'Dried Fruits');
});

it('unknown text yields null rather than a guess', function () {
  assert.strictEqual(M.inferProductCategory('zzzqqq xyzzy'), null);
  assert.strictEqual(M.inferProductCategory(''), null);
  assert.strictEqual(M.inferProductCategory(null), null);
});

it('groupForCategory resolves every category in the taxonomy', function () {
  M.PRODUCT_GROUPS.forEach(function (g) {
    M.PRODUCT_CATEGORIES[g].forEach(function (c) {
      assert.strictEqual(M.groupForCategory(c), g, c + ' resolved to the wrong group');
    });
  });
});

it('suggestTaxonomy falls back to the coarse map when the name says nothing', function () {
  var t = M.suggestTaxonomy({ name: 'zzzqqq xyzzy', category: 'Legumes' });
  assert.strictEqual(t.group, 'Legumes, Nuts & Seeds');
  assert.deepStrictEqual(M.suggestTaxonomy(null), { group: null, category: null });
});

/* ══════════════════════════════════════
   UNITS
══════════════════════════════════════ */
// ─── units ───

it('offers gram, ounce and pounds', function () {
  assert.deepStrictEqual(M.UNITS.map(function (u) { return u.value; }), ['g', 'oz', 'lbs']);
  assert.deepStrictEqual(M.UNITS.map(function (u) { return u.label; }),
    ['gram (g)', 'ounce (oz)', 'pounds (lbs)']);
});

it('every unit has both a value and a label', function () {
  M.UNITS.forEach(function (u) {
    assert.ok(u.value && typeof u.value === 'string', 'missing value');
    assert.ok(u.label && typeof u.label === 'string', 'missing label for ' + u.value);
    assert.ok(u.label.indexOf(u.value) !== -1, u.label + ' should show its short form');
  });
});

/* ── Matching across the merged WAFCT + USDA database ── */

/* "Flour, almond" and "Flour, cassava" share a leading segment. Indexing on
   that alone put every flour in one bucket, so any flour query answered
   with whichever row happened to come first. */
[['almond flour', 'Flour, almond'],
 ['cassava flour', 'Flour, cassava'],
 ['rye flour', 'Flour, rye'],
 ['quinoa flour', 'Flour, quinoa'],
 ['coconut flour', 'Flour, coconut'],
 ['brazil nuts', 'Nuts, brazilnuts, raw'],
 ['pine nuts', 'Nuts, pine nuts, raw'],
 ['macadamia nuts', 'Nuts, macadamia nuts, raw'],
].forEach(function (pair) {
  it('inverted USDA name: "' + pair[0] + '" resolves to "' + pair[1] + '"', function () {
    assert.strictEqual(M.findMatches(pair[0])[0].food.name, pair[1]);
  });
});

it('still answers West African foods from WAFCT', function () {
  ['egusi', 'moringa leaves', 'locust bean', 'tilapia'].forEach(function (q) {
    var top = M.findMatches(q)[0];
    assert.notStrictEqual(top.confidence, 'no_match', q);
    assert.ok(top.food.source.indexOf('WAFCT') !== -1, q + ' came from WAFCT');
  });
});

it('answers global staples from USDA', function () {
  ['greek yogurt', 'alaska pollock', 'peanut butter'].forEach(function (q) {
    var top = M.findMatches(q)[0];
    assert.notStrictEqual(top.confidence, 'no_match', q);
    assert.ok(top.food.source.indexOf('USDA') !== -1, q + ' came from USDA');
  });
});

it('ships only aliases whose resolved row was checked', function () {
  [['semo', 'semolina'], ['dawa dawa', 'locust bean'], ['kuli kuli', 'groundnut']]
    .forEach(function (pair) {
      assert.ok(
        M.findMatches(pair[0])[0].food.name.toLowerCase().indexOf(pair[1]) !== -1,
        pair[0] + ' lands on a ' + pair[1] + ' row',
      );
    });
});

it('declines rather than guessing where no alias was verified', function () {
  // `garri` resolved to cassava *leaves*, so the alias was dropped. A
  // confident wrong match is worse than none: the form fills the macros in.
  assert.strictEqual(M.findMatches('garri')[0].confidence, 'no_match');
});
