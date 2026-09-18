/* ═══════════════════════════════════════════════════════
   MEAL NUTRITION TESTS          run with: npm test

   The two rules worth regression-testing: an uncalculable row is named
   rather than counted as zero, and an incomplete nutrient is never
   rendered as a number.
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import {
  buildCalculateLines, readNutrient, unavailableLabel, totalsToMealFields,
  inclusionSummary, MASS_UNITS,
} from './mealNutrition.js';

const rows = [
  { name: 'rice', quantity: '3', unit: 'cups', ingredient_nutrition: 'n1', nutrition_quantity: '300', nutrition_unit: 'g' },
  { name: 'pork belly', quantity: '1', unit: 'slab', ingredient_nutrition: 'n2', nutrition_quantity: '0.5', nutrition_unit: 'LB' },
  { name: 'palm oil', quantity: '2', unit: 'tbsp' },
  { name: 'onion', quantity: '1', unit: '', ingredient_nutrition: 'n3', nutrition_unit: 'g' },
  { name: 'stock', ingredient_nutrition: 'n4', nutrition_quantity: 'some', nutrition_unit: 'g' },
  { name: 'water', ingredient_nutrition: 'n5', nutrition_quantity: '2', nutrition_unit: 'cups' },
  { name: '', description: '', quantity: '', unit: '' },
];

// ─── lines ───

it('only rows with a link, a quantity and a mass unit are sent', () => {
  const { lines } = buildCalculateLines(rows);
  assert.deepStrictEqual(lines, [
    { ingredientId: 'n1', quantity: 300, unit: 'g' },
    { ingredientId: 'n2', quantity: 0.5, unit: 'lb' },
  ]);
});

it('every excluded row is named with a reason, never counted as zero', () => {
  const { skipped } = buildCalculateLines(rows);
  assert.deepStrictEqual(skipped.map((s) => s.name), ['palm oil', 'onion', 'stock', 'water']);
  assert.match(skipped[0].reason, /no nutrition link/);
  assert.match(skipped[1].reason, /no quantity/);
  assert.match(skipped[2].reason, /not a number above zero/);
  assert.match(skipped[3].reason, /not a mass unit/);
});

it('a blank editor row is not reported as skipped', () => {
  const { lines, skipped } = buildCalculateLines([{ name: '', quantity: '', unit: '' }]);
  assert.strictEqual(lines.length, 0);
  assert.strictEqual(skipped.length, 0);
});

it('a zero or negative quantity is excluded rather than sent', () => {
  const { lines, skipped } = buildCalculateLines([
    { name: 'a', ingredient_nutrition: 'n1', nutrition_quantity: '0', nutrition_unit: 'g' },
    { name: 'b', ingredient_nutrition: 'n2', nutrition_quantity: '-5', nutrition_unit: 'g' },
  ]);
  assert.strictEqual(lines.length, 0);
  assert.strictEqual(skipped.length, 2);
});

it('the recipe quantity and unit never reach the calculation', () => {
  // "3 cups" stays on the row for the cook; only nutrition_* is calculated.
  const { lines } = buildCalculateLines([rows[0]]);
  assert.strictEqual(lines[0].quantity, 300);
  assert.strictEqual(lines[0].unit, 'g');
});

it('only the four mass units the endpoint converts are accepted', () => {
  assert.deepStrictEqual(MASS_UNITS, ['g', 'kg', 'oz', 'lb']);
});

// ─── reading the response ───

const response = {
  totals: { calories: 1325.16, protein: 71.4, carbohydrate: 235.8, fat: 7.7, fiber: null },
  completeness: {
    complete: false,
    incomplete_nutrients: ['fiber'],
    missing_by_nutrient: { fiber: [{ ingredient_id: 'n2', name: 'Pork, belly' }] },
  },
};

it('an available nutrient reports its number', () => {
  assert.deepStrictEqual(readNutrient(response, 'calories'), { available: true, value: 1325.16, missingFor: [] });
});

it('an incomplete nutrient is unavailable and names the ingredient', () => {
  const fibre = readNutrient(response, 'fiber');
  assert.isFalse(fibre.available);
  assert.strictEqual(fibre.value, null);
  assert.deepStrictEqual(fibre.missingFor, ['Pork, belly']);
});

it('a nutrient short by one ingredient is never presented as a number', () => {
  // The server still sends a figure for a partially covered nutrient; it is
  // the sum of what it had, which is not the total and must not be shown.
  const partial = {
    totals: { protein: 12 },
    completeness: { complete: false, incomplete_nutrients: ['protein'], missing_by_nutrient: { protein: [{ name: 'Yam' }] } },
  };
  assert.isFalse(readNutrient(partial, 'protein').available);
});

it('unavailable reads as a sentence naming the ingredient', () => {
  assert.strictEqual(unavailableLabel('Fibre', ['Pork, belly']), 'Fibre unavailable for Pork, belly');
  assert.strictEqual(unavailableLabel('Fibre', ['A', 'B']), 'Fibre unavailable for A and B');
  assert.strictEqual(unavailableLabel('Fibre', ['A', 'B', 'C', 'D']), 'Fibre unavailable for A, B and 2 more');
  assert.strictEqual(unavailableLabel('Fibre', []), 'Fibre unavailable');
});

// ─── writing back to the meal ───

it('an unavailable nutrient is stored as null, never as 0', () => {
  const fields = totalsToMealFields(response);
  assert.strictEqual(fields.cal, 1325);
  assert.strictEqual(fields.prot, 71.4);
  assert.strictEqual(fields.fiber, null, 'fibre had no data — 0 would read as a measured zero');
});

it('a complete response writes every nutrient', () => {
  const fields = totalsToMealFields({
    totals: { calories: 100.4, protein: 1.25, carbohydrate: 2, fat: 3, fiber: 4 },
    completeness: { complete: true, incomplete_nutrients: [], missing_by_nutrient: {} },
  });
  assert.deepStrictEqual(fields, { cal: 100, prot: 1.3, carb: 2, fat: 3, fiber: 4 });
});

// ─── the inclusion line ───

it('the summary states how many rows made it in', () => {
  const { lines, skipped } = buildCalculateLines(rows);
  assert.strictEqual(inclusionSummary(lines, skipped), '2 of 6 ingredients included');
  assert.strictEqual(inclusionSummary([], []), 'No ingredients added yet');
});

it('a linked row with no amount is not described as unlinked', () => {
  const { lines, skipped } = buildCalculateLines([
    { name: 'rice', ingredient_nutrition: 'n1', nutrition_unit: 'g' },
  ]);
  assert.strictEqual(inclusionSummary(lines, skipped),
    '0 of 1 ingredients included — the linked ingredient needs an amount');
});

it('several linked rows missing amounts read as such', () => {
  const { lines, skipped } = buildCalculateLines([
    { name: 'rice', ingredient_nutrition: 'n1', nutrition_unit: 'g' },
    { name: 'beans', ingredient_nutrition: 'n2', nutrition_unit: 'g' },
  ]);
  assert.strictEqual(inclusionSummary(lines, skipped),
    '0 of 2 ingredients included — all 2 linked ingredients need an amount');
});

it('a mix of unlinked and half-linked rows counts both', () => {
  const { lines, skipped } = buildCalculateLines([
    { name: 'rice', ingredient_nutrition: 'n1', nutrition_unit: 'g' },
    { name: 'onion' },
  ]);
  assert.strictEqual(inclusionSummary(lines, skipped),
    '0 of 2 ingredients included — 1 linked but missing an amount, 1 not linked');
});

it('nothing linked at all still says exactly that', () => {
  const { lines, skipped } = buildCalculateLines([{ name: 'onion' }, { name: 'rice' }]);
  assert.strictEqual(inclusionSummary(lines, skipped),
    '0 of 2 ingredients included — none are linked to nutrition data');
});
