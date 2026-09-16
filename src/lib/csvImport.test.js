/* ═══════════════════════════════════════════════════════
   CSV IMPORT TESTS         run with: npm test

   The vanilla build tested this by eval'ing the page's inline script
   under a hand-written DOM shim. Now that parsing, classification and
   the write path are plain modules, these run against them directly.
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import {
  parseCSV, toCSV, buildReviewRows, applyReviewRows, gapReportRows,
} from './csvImport.js';
import { normalizeIngredient, toNum, isAiSource, MACRO_KEYS, WAFCT_SOURCE } from './ingredients.js';
import * as NE from './nutritionEstimate.js';

const build = (csv) => buildReviewRows(parseCSV(csv)).rows;

// ─── null discipline ───

it('blank and junk become null, never 0', () => {
  assert.strictEqual(toNum(''), null);
  assert.strictEqual(toNum('   '), null);
  assert.strictEqual(toNum(null), null);
  assert.strictEqual(toNum(undefined), null);
  assert.strictEqual(toNum('abc'), null);
  assert.strictEqual(toNum('0'), 0);       // an explicit 0 IS a real value
  assert.strictEqual(toNum('12.5'), 12.5);
});

it('normalizeIngredient never reuses an id already given to a seeded row', () => {
  normalizeIngredient({ name: 'Seeded' }, 5000);
  assert.ok(normalizeIngredient({ name: 'New' }).id > 5000);
});

it('normalizeIngredient keeps missing macros null', () => {
  const r = normalizeIngredient({ name: 'Test Thing' });
  MACRO_KEYS.forEach((k) => assert.strictEqual(r[k], null, `${k} should be null, got ${r[k]}`));
});

// ─── CSV parser ───

it('handles quotes, embedded commas and CRLF', () => {
  const g = parseCSV('name,description\r\n"Yam, white","Peeled, boiled"\r\nEgusi,Ground\r\n');
  assert.strictEqual(g.length, 3);
  assert.deepStrictEqual(g[1], ['Yam, white', 'Peeled, boiled']);
});

it('handles escaped double quotes and a BOM', () => {
  assert.strictEqual(parseCSV('﻿name\n"He said ""hi"""')[1][0], 'He said "hi"');
});

it('skips fully blank lines', () => {
  assert.strictEqual(parseCSV('name\nYam\n\n\nEgusi\n').length, 3);
});

it('round-trips through toCSV', () => {
  const rows = [['name', 'note'], ['Yam, white', 'say "hi"']];
  assert.deepStrictEqual(parseCSV(toCSV(rows)), rows);
});

// ─── review classification ───

const CSV = [
  'name,unit,calories,protein_g,carbs_g,fat_g,fibre_g',
  'Olive Oil,g,884,0,0,100,0',
  'Boiled Yam,g,,,,,',
  'Egusi,g,,,,,',
  'Zzzqqq Xyzzy,g,,,,,',
].join('\n');

it('classifies every row correctly', () => {
  const [oil, yam, egusi, junk] = build(CSV);

  assert.strictEqual(oil.source, 'csv');
  assert.strictEqual(oil.checked, true, 'CSV-provided macros must be pre-checked');
  assert.strictEqual(oil.macros.calories, 884, 'CSV values must win over WAFCT');

  assert.strictEqual(yam.source, 'WAFCT');
  assert.ok(/boiled/i.test(yam.match.name), `got ${yam.match.name}`);
  assert.ok(!/fried/i.test(yam.match.name), 'REGRESSION: fried yam in the bulk path');
  assert.strictEqual(yam.checked, true, '>=88 must be pre-checked');
  assert.ok(/^WAFCT_/.test(yam.source_code));

  assert.ok(/melon seed/i.test(egusi.match.name), 'alias failed in the bulk path');

  assert.strictEqual(junk.selectable, false, 'sub-70 row must not be selectable');
  assert.strictEqual(junk.macros.calories, null, 'no-match macros must stay blank');
});

it('rows get BOTH product group and category auto-picked', () => {
  const [yam, crayfish, oil] = build('name,unit\nBoiled Yam,g\nCrayfish,g\nPalm Oil,g');
  assert.strictEqual(yam.product_group, 'Grains & Starches');
  assert.strictEqual(yam.product_category, 'Roots & Tubers');
  assert.strictEqual(crayfish.product_category, 'Fish & Seafood');
  assert.strictEqual(oil.product_category, 'Oils & Fats');
});

it('a group/category supplied in the CSV is never overwritten', () => {
  const [r] = build('name,unit,product_group,product_category\nBoiled Yam,g,Prepared Foods,Snacks & Confectionery');
  assert.strictEqual(r.product_group, 'Prepared Foods');
  assert.strictEqual(r.product_category, 'Snacks & Confectionery');
});

it('rows with no name are dropped', () => {
  assert.strictEqual(build('name,unit\n,g\nYam,g').length, 1);
});

it('header aliases are accepted (kcal, protein, fiber, category)', () => {
  const [r] = build('ingredient,kcal,protein,carbs,fat,fiber,category\nMy Food,100,5,10,2,1,Fresh Fruits');
  assert.strictEqual(r.name, 'My Food');
  assert.strictEqual(r.macros.calories, 100);
  assert.strictEqual(r.macros.fibre_g, 1);
  assert.strictEqual(r.product_category, 'Fresh Fruits');
});

it('reports a missing name column rather than importing nothing silently', () => {
  const { rows, error } = buildReviewRows(parseCSV('unit,calories\ng,100'));
  assert.strictEqual(rows.length, 0);
  assert.match(error, /name/);
});

// ─── apply ───

it('applies only checked rows, through the shared write path', () => {
  const rows = build(CSV);
  const { created, skipped, noMatch } = applyReviewRows(rows);
  assert.strictEqual(created.length, 3);
  assert.strictEqual(skipped.length, 0);
  assert.strictEqual(noMatch.length, 1);

  const yam = created.find((r) => r.name === 'Boiled Yam');
  assert.strictEqual(yam.source, WAFCT_SOURCE);
  assert.ok(/^WAFCT_/.test(yam.source_code));

  const oil = created.find((r) => r.name === 'Olive Oil');
  assert.strictEqual(oil.source, 'csv');
  assert.strictEqual(oil.calories, 884);
});

it('unchecking a row moves it to skipped, not created', () => {
  const rows = build(CSV).map((r) => ({ ...r, checked: false }));
  const { created, skipped, noMatch } = applyReviewRows(rows);
  assert.strictEqual(created.length, 0);
  assert.strictEqual(skipped.length, 3);
  assert.strictEqual(noMatch.length, 1);
});

// ─── product_url pass-through ───

it('a product_url from a CSV survives onto the record', () => {
  const rows = build('name,unit,calories,product_url\nOlive Oil,g,884,https://shop.example.com/olive-oil');
  const { created } = applyReviewRows(rows);
  assert.strictEqual(created[0].product_url, 'https://shop.example.com/olive-oil');
});

it('rows without one get an empty string, not undefined', () => {
  const { created } = applyReviewRows(build('name,unit,calories\nGroundnut Oil,g,900'));
  assert.strictEqual(created[0].product_url, '');
});

// ─── units ───

it('an imported unit outside the dropdown list is still stored', () => {
  const { created } = applyReviewRows(build('name,unit,calories\nCoconut Milk,ml,230'));
  assert.strictEqual(created[0].unit, 'ml', 'CSV unit must not be forced into the dropdown list');
});

// ─── AI fallback ───

it('an AI estimate imports with its own source, never as measured data', async () => {
  const rows = build('name,unit\nBoiled Yam,g\nZzzqqq Xyzzy,g');
  const unmatched = rows.filter((r) => !r.selectable);
  assert.strictEqual(unmatched.length, 1);

  const res = await new Promise((resolve) => NE.estimate(unmatched[0].name, (e, r) => resolve(r)));
  Object.assign(unmatched[0], {
    macros: res.macros,
    source: res.source,
    source_code: null,
    selectable: true,
    checked: false,     // an estimate is NEVER pre-checked
  });

  assert.strictEqual(unmatched[0].checked, false);

  // Only the WAFCT row imports until the estimate is ticked.
  assert.strictEqual(applyReviewRows(rows).created.length, 1);

  unmatched[0].checked = true;
  const { created } = applyReviewRows(rows);
  const est = created.find((r) => r.name === 'Zzzqqq Xyzzy');
  assert.ok(isAiSource(est.source), `got source: ${est.source}`);
  assert.strictEqual(est.source_code, null, 'an estimate cites no record');

  const yam = created.find((r) => r.name === 'Boiled Yam');
  assert.strictEqual(yam.source, WAFCT_SOURCE, 'a WAFCT match must keep its provenance');
});

it('isAiSource never confuses WAFCT with an estimate', () => {
  assert.strictEqual(isAiSource(WAFCT_SOURCE), false);
  assert.strictEqual(isAiSource('AI estimate (mock)'), true);
  assert.strictEqual(isAiSource('csv'), false);
  assert.strictEqual(isAiSource(null), false);
});

// ─── gap report ───

it('the gap report separates unchecked rows from unmatched ones', () => {
  const rows = build(CSV);
  rows.find((r) => r.name === 'Olive Oil').checked = false;
  const report = gapReportRows(applyReviewRows(rows));

  assert.strictEqual(report.length, 3, 'header + 1 no-match + 1 skipped');
  const reasons = report.slice(1).map((r) => r[r.length - 1]);
  assert.ok(reasons.some((x) => /no WAFCT match/.test(x)));
  assert.ok(reasons.some((x) => /unchecked during review/.test(x)));
});
