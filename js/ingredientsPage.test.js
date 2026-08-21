/* ═══════════════════════════════════════════════════════
   AKAANI ADMIN — INGREDIENTS PAGE TESTS

   Exercises the CSV import pipeline and the shared write path in
   pages/ingredients.html, by loading that page's inline script under a
   minimal DOM shim. No jsdom, no npm, no build step. Run it with:

       node js/ingredientsPage.test.js
   ═══════════════════════════════════════════════════════ */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');

function mkEl(id) {
  return {
    id, value: '', innerHTML: '', textContent: '', className: '', src: '',
    style: {}, files: null, dataset: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener() {}, focus() {}, click() {}, appendChild() {}, removeChild() {},
    querySelectorAll: () => [], querySelector: () => null
  };
}

const els = {};
global.document = {
  getElementById(id) { return els[id] || (els[id] = mkEl(id)); },
  createElement(t) { return mkEl('created-' + t); },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  body: { appendChild() {}, removeChild() {}, style: {} }
};
global.window = global;
global.showToast = (m) => { (global.__toasts = global.__toasts || []).push(m); };
global.confirm = () => true;
global.alert = () => {};
global.Blob = class { constructor(p) { this.parts = p; } };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.FileReader = class { readAsText() {} readAsDataURL() {} };
// Fire immediately: makes the estimator's async callbacks land synchronously
// so tests read straight through, and neutralises the input debounce.
global.setTimeout = (fn) => { if (typeof fn === 'function') fn(); return 0; };
global.clearTimeout = () => {};
global.__downloads = [];

require(path.join(REPO, 'js/wafct-data.js'));
global.WAFCT_DATA = module.children.find(m => m.filename.endsWith('wafct-data.js')).exports;
global.WafctMatch = require(path.join(REPO, 'js/wafctMatch.js'));
global.NutritionEstimate = require(path.join(REPO, 'js/nutritionEstimate.js'));

// Load the page's inline script
const html = fs.readFileSync(path.join(REPO, 'pages/ingredients.html'), 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/g).pop().replace(/^<script>|<\/script>$/g, '');
// expose internals for assertions
eval(inline + '\n;global.__api = { createIngredient, toNum, parseCSV, toCSV, buildReview, applyImport, csvRows: () => csvRows, INGREDIENTS: () => INGREDIENTS, lastImport: () => lastImport, hasNutrition, setAllChecked, estimateMissing, isAiSource };');
const A = global.__api;


let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('  PASS  ' + n); } catch (e) { fail++; console.log('  FAIL  ' + n + '\n        ' + e.message); } };

console.log('\ntoNum / null discipline');
t('blank and junk become null, never 0', () => {
  assert.strictEqual(A.toNum(''), null);
  assert.strictEqual(A.toNum('   '), null);
  assert.strictEqual(A.toNum(null), null);
  assert.strictEqual(A.toNum(undefined), null);
  assert.strictEqual(A.toNum('abc'), null);
  assert.strictEqual(A.toNum('0'), 0);      // an explicit 0 IS a real value
  assert.strictEqual(A.toNum('12.5'), 12.5);
});

t('createIngredient keeps missing macros null', () => {
  const r = A.createIngredient({ name: 'Test Thing' });
  ['calories','protein_g','carbs_g','fat_g','fibre_g'].forEach(k =>
    assert.strictEqual(r[k], null, k + ' should be null, got ' + r[k]));
});

console.log('\nCSV parser');
t('handles quotes, embedded commas and CRLF', () => {
  const g = A.parseCSV('name,description\r\n"Yam, white","Peeled, boiled"\r\nEgusi,Ground\r\n');
  assert.strictEqual(g.length, 3);
  assert.deepStrictEqual(g[1], ['Yam, white', 'Peeled, boiled']);
  assert.deepStrictEqual(g[2], ['Egusi', 'Ground']);
});
t('handles escaped double quotes and BOM', () => {
  const g = A.parseCSV('﻿name\n"He said ""hi"""');
  assert.strictEqual(g[1][0], 'He said "hi"');
});
t('skips fully blank lines', () => {
  assert.strictEqual(A.parseCSV('name\nYam\n\n\nEgusi\n').length, 3);
});
t('round-trips through toCSV', () => {
  const rows = [['name','note'],['Yam, white','say "hi"']];
  assert.deepStrictEqual(A.parseCSV(A.toCSV(rows)), rows);
});

console.log('\nCSV review pass');
const CSV = [
  'name,unit,calories,protein_g,carbs_g,fat_g,fibre_g',
  'Olive Oil,ml,884,0,0,100,0',      // CSV macros -> source csv, pre-checked
  'Boiled Yam,g,,,,,',                // strong WAFCT match -> pre-checked
  'Egusi,g,,,,,',                     // alias match
  'Zzzqqq Xyzzy,g,,,,,'               // no match -> not selectable
].join('\n');

t('classifies every row correctly', () => {
  A.buildReview(A.parseCSV(CSV));
  const rows = A.csvRows();
  assert.strictEqual(rows.length, 4, 'got ' + rows.length + ' rows');

  const oil = rows[0];
  assert.strictEqual(oil.source, 'csv');
  assert.strictEqual(oil.checked, true, 'CSV-provided macros must be pre-checked');
  assert.strictEqual(oil.macros.calories, 884, 'CSV values must win over WAFCT');

  const yam = rows[1];
  assert.strictEqual(yam.source, 'WAFCT');
  assert.ok(/boiled/i.test(yam.match.name), 'got ' + yam.match.name);
  assert.ok(!/fried/i.test(yam.match.name), 'REGRESSION: fried yam in bulk path');
  assert.strictEqual(yam.checked, true, '>=88 must be pre-checked');

  const egusi = rows[2];
  assert.ok(/melon seed/i.test(egusi.match.name), 'alias failed in bulk path');

  const junk = rows[3];
  assert.strictEqual(junk.selectable, false, 'sub-70 row must not be selectable');
  assert.strictEqual(junk.checked, false);
  assert.strictEqual(junk.macros.calories, null, 'no-match macros must stay blank');
});

t('WAFCT rows get a source_code stamped', () => {
  const yam = A.csvRows()[1];
  assert.ok(/^WAFCT_/.test(yam.source_code), 'got ' + yam.source_code);
});

t('unmatched group falls back to the mapped product group', () => {
  const yam = A.csvRows()[1];
  assert.ok(yam.product_group, 'expected a suggested group');
  assert.ok(A.INGREDIENTS !== undefined);
});

console.log('\napply + summary');
t('apply writes only checked rows, through createIngredient', () => {
  const before = A.INGREDIENTS().length;
  A.applyImport();
  const s = A.lastImport();
  assert.strictEqual(s.created, 3, 'expected 3 created, got ' + s.created);
  assert.strictEqual(s.noMatch.length, 1, 'expected 1 no-match');
  assert.strictEqual(s.skipped.length, 0);
  assert.strictEqual(A.INGREDIENTS().length, before + 3);
});

t('imported rows carry the right source and null-safe macros', () => {
  const all = A.INGREDIENTS();
  const yam = all.find(r => r.name === 'Boiled Yam');
  assert.ok(yam, 'Boiled Yam not created');
  assert.strictEqual(yam.source, 'FAO/INFOODS WAFCT 2019');
  assert.ok(/^WAFCT_/.test(yam.source_code));
  assert.ok(typeof yam.calories === 'number');

  const oil = all.find(r => r.name === 'Olive Oil');
  assert.strictEqual(oil.source, 'csv');
  assert.strictEqual(oil.calories, 884);
});

t('unchecking a row moves it to skipped, not created', () => {
  A.buildReview(A.parseCSV(CSV));
  A.setAllChecked(false);
  A.applyImport();
  const s = A.lastImport();
  assert.strictEqual(s.created, 0);
  assert.strictEqual(s.skipped.length, 3, 'got ' + s.skipped.length);
  assert.strictEqual(s.noMatch.length, 1);
});

t('CSV rows get BOTH product group and category auto-picked', () => {
  A.buildReview(A.parseCSV('name,unit\nBoiled Yam,g\nCrayfish,g\nPalm Oil,ml'));
  const [yam, crayfish, oil] = A.csvRows();
  assert.strictEqual(yam.product_group, 'Grains & Starches');
  assert.strictEqual(yam.product_category, 'Roots & Tubers');
  assert.strictEqual(crayfish.product_category, 'Fish & Seafood');
  assert.strictEqual(oil.product_category, 'Oils & Fats');
});

t('a group/category supplied in the CSV is never overwritten', () => {
  A.buildReview(A.parseCSV('name,unit,product_group,product_category\nBoiled Yam,g,Prepared Foods,Snacks & Confectionery'));
  const r = A.csvRows()[0];
  assert.strictEqual(r.product_group, 'Prepared Foods');
  assert.strictEqual(r.product_category, 'Snacks & Confectionery');
});

t('rows with no name are dropped', () => {
  A.buildReview(A.parseCSV('name,unit\n,g\nYam,g'));
  assert.strictEqual(A.csvRows().length, 1);
});

t('header aliases are accepted (kcal, protein, fiber, category)', () => {
  A.buildReview(A.parseCSV('ingredient,kcal,protein,carbs,fat,fiber,category\nMy Food,100,5,10,2,1,Fresh Fruits'));
  const r = A.csvRows()[0];
  assert.strictEqual(r.name, 'My Food');
  assert.strictEqual(r.macros.calories, 100);
  assert.strictEqual(r.macros.fibre_g, 1);
  assert.strictEqual(r.product_category, 'Fresh Fruits');
});

console.log('\nunits');
t('an imported unit outside the list is still stored', () => {
  A.buildReview(A.parseCSV('name,unit,calories\nCoconut Milk,ml,230'));
  A.applyImport();
  const r = A.INGREDIENTS().find(x => x.name === 'Coconut Milk');
  assert.strictEqual(r.unit, 'ml', 'CSV unit must not be forced into the dropdown list');
});

console.log('\nproduct_url pass-through');
t('a product_url from a CSV survives onto the record', () => {
  A.buildReview(A.parseCSV('name,unit,calories,product_url\nOlive Oil,ml,884,https://shop.example.com/olive-oil'));
  A.applyImport();
  const oil = A.INGREDIENTS().find(r => r.name === 'Olive Oil');
  assert.strictEqual(oil.product_url, 'https://shop.example.com/olive-oil',
    'CSV-supplied product_url must not be dropped');
});

t('rows without one get an empty string, not undefined', () => {
  A.buildReview(A.parseCSV('name,unit,calories\nGroundnut Oil,ml,900'));
  A.applyImport();
  const r = A.INGREDIENTS().find(x => x.name === 'Groundnut Oil');
  assert.strictEqual(r.product_url, '');
});

console.log('\nAI fallback (bulk)');
t('estimating fills the rows WAFCT could not match', () => {
  A.buildReview(A.parseCSV('name,unit\nBoiled Yam,g\nZzzqqq Xyzzy,g\nQqqzzz Wobble,g'));
  const before = A.csvRows();
  assert.strictEqual(before.filter(r => !r.selectable).length, 2, 'expected 2 unmatched');

  A.estimateMissing();

  const after = A.csvRows();
  assert.strictEqual(after.filter(r => !r.selectable).length, 0, 'all should now be estimable');
  const est = after.filter(r => A.isAiSource(r.source));
  assert.strictEqual(est.length, 2);
  est.forEach(r => {
    assert.strictEqual(r.checked, false, 'an estimate must NEVER be pre-checked');
    assert.strictEqual(r.source_code, null, 'an estimate cites no record');
    assert.ok(typeof r.macros.calories === 'number');
  });
});

t('a WAFCT match is never overwritten by an estimate', () => {
  const yam = A.csvRows().find(r => r.name === 'Boiled Yam');
  assert.strictEqual(yam.source, 'WAFCT');
  assert.ok(/^WAFCT_/.test(yam.source_code));
});

t('estimated rows import with the AI source, not csv', () => {
  A.setAllChecked(true);
  A.applyImport();
  const created = A.INGREDIENTS().find(r => r.name === 'Zzzqqq Xyzzy');
  assert.ok(created, 'estimated row was not created');
  assert.ok(A.isAiSource(created.source), 'got source: ' + created.source);
  assert.strictEqual(created.source_code, null);
  // and the measured row keeps its own provenance
  const yam = A.INGREDIENTS().find(r => r.name === 'Boiled Yam');
  assert.strictEqual(yam.source, 'FAO/INFOODS WAFCT 2019');
});

t('isAiSource never confuses WAFCT with an estimate', () => {
  assert.strictEqual(A.isAiSource('FAO/INFOODS WAFCT 2019'), false);
  assert.strictEqual(A.isAiSource('AI estimate (mock)'), true);
  assert.strictEqual(A.isAiSource('csv'), false);
  assert.strictEqual(A.isAiSource(null), false);
});

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
process.exit(fail ? 1 : 0);
