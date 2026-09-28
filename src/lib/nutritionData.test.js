/* ═══════════════════════════════════════════════════════
   LOCAL NUTRITION DATA TESTS    run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import {
  calculateFrom, calculateNutrition, getRecord, listProductGroups, loadRecords, searchNutrition, sortByName,
} from './nutritionData.js';

it('holds the whole workbook and the whole USDA export: 1,028 WAFCT + 363 USDA', async () => {
  const all = await loadRecords();
  assert.strictEqual(all.filter((r) => r.source === 'wafct').length, 1028);
  assert.strictEqual(all.filter((r) => r.source === 'usda').length, 363);
  assert.strictEqual(new Set(all.map((r) => r._id)).size, all.length);
});

it('is A → Z', async () => {
  const all = await loadRecords();
  assert.deepStrictEqual(all.map((r) => r._id), sortByName(all).map((r) => r._id));
});

it('carries the workbook figures, food name and group for a WAFCT variant', async () => {
  const r = await getRecord('wafct-2000001');
  assert.strictEqual(r.name, 'Fonio, white, whole grains, raw');
  assert.strictEqual(r.food_name, 'Fonio');
  assert.strictEqual(r.product_group, 'Cereals and their products');
  assert.deepStrictEqual(r.nutrients_per_100g, { calories: 334, protein: 7.1, carbohydrate: 59.7, fat: 3.8, fiber: 16.4 });
});

it('flags a figure WAFCT bracketed as estimated', async () => {
  assert.deepStrictEqual((await getRecord('wafct-2000002')).estimated_nutrients, ['fat']);
});

it('carries USDA Foundation Foods with their category as product group', async () => {
  const r = await getRecord('usda-321358');
  assert.strictEqual(r.name, 'Hummus, commercial');
  assert.strictEqual(r.product_group, 'Legumes and Legume Products');
  assert.strictEqual(r.nutrients_per_100g.protein, 7.35);
});

it('leaves an unpublished nutrient null, never 0', async () => {
  const all = await loadRecords();
  const usdaNoFibre = all.filter((r) => r.source === 'usda' && r.nutrients_per_100g.fiber === null);
  assert.ok(usdaNoFibre.length > 0);
  assert.ok(all.every((r) => Object.values(r.nutrients_per_100g).every((v) => v === null || typeof v === 'number')));
});

it('searches every word, ignoring case, across both sources', async () => {
  const { docs, stats } = await searchNutrition({ search: 'RICE white', limit: 100 });
  assert.ok(docs.length > 0);
  assert.ok(docs.every((d) => /rice/i.test(d.name + d.food_name + d.product_group) && /white/i.test(d.name + d.product_group)));
  assert.ok(stats.by_source.wafct > 0 && stats.by_source.usda > 0);
});

it('source filter narrows docs but by_source still counts both', async () => {
  const all = await searchNutrition({ search: 'rice', limit: 500 });
  const usda = await searchNutrition({ search: 'rice', source: 'usda', limit: 500 });
  assert.ok(usda.docs.every((d) => d.source === 'usda'));
  assert.deepStrictEqual(usda.stats.by_source, all.stats.by_source);
  assert.strictEqual(usda.stats.docs, all.stats.by_source.usda);
});

it('pages without overlap', async () => {
  const p1 = await searchNutrition({ page: 1, limit: 25 });
  const p2 = await searchNutrition({ page: 2, limit: 25 });
  assert.strictEqual(p1.stats.docs, 1391);
  assert.ok(!p1.docs.some((d) => p2.docs.includes(d)));
});

it('relevance order puts names starting with the query first', async () => {
  const { docs } = await searchNutrition({ search: 'yam', order: 'relevance', limit: 5 });
  assert.match(docs[0].name, /^yam/i);
});

it('lists product groups per source with counts', async () => {
  const groups = await listProductGroups();
  assert.ok(groups.some((g) => g.source === 'wafct' && g.name === 'Cereals and their products'));
  assert.strictEqual(groups.filter((g) => g.source === 'wafct').reduce((n, g) => n + g.count, 0), 1028);
});

const records = [
  { _id: 'a', name: 'A', nutrients_per_100g: { calories: 100, protein: 10, carbohydrate: 20, fat: 5, fiber: 2 } },
  { _id: 'b', name: 'B', nutrients_per_100g: { calories: 50, protein: 1, carbohydrate: 10, fat: 0, fiber: null } },
];

it('scales per-100g figures by grams, converting kg, oz and lb', () => {
  const r = calculateFrom(records, [{ ingredientId: 'a', quantity: 0.2, unit: 'kg' }]);
  assert.strictEqual(r.totals.calories, 200);
  assert.strictEqual(r.totals.protein, 20);
  assert.ok(Math.abs(calculateFrom(records, [{ ingredientId: 'a', quantity: 1, unit: 'lb' }]).totals.calories - 453.59237) < 1e-9);
  assert.strictEqual(r.completeness.complete, true);
});

it('a nutrient one ingredient lacks is null with that ingredient named — not a short total', () => {
  const r = calculateFrom(records, [
    { ingredientId: 'a', quantity: 100, unit: 'g' },
    { ingredientId: 'b', quantity: 100, unit: 'g' },
  ]);
  assert.strictEqual(r.totals.calories, 150);
  assert.strictEqual(r.totals.fat, 5);
  assert.strictEqual(r.totals.fiber, null);
  assert.deepStrictEqual(r.completeness.incomplete_nutrients, ['fiber']);
  assert.deepStrictEqual(r.completeness.missing_by_nutrient.fiber.map((m) => m.name), ['B']);
});

it('an unknown record makes every nutrient incomplete', () => {
  const r = calculateFrom(records, [{ ingredientId: 'gone', quantity: 100, unit: 'g' }]);
  assert.strictEqual(r.completeness.complete, false);
  assert.strictEqual(r.totals.calories, null);
});

it('calculates against the real data', async () => {
  const r = await calculateNutrition([{ ingredientId: 'wafct-2000001', quantity: 50, unit: 'g' }]);
  assert.strictEqual(r.totals.calories, 167);
});
