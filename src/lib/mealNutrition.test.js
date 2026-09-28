/* ═══════════════════════════════════════════════════════
   MEAL NUTRITION TESTS          run with: npm test

   The two rules worth regression-testing: an uncalculable row is named
   rather than counted as zero, and an incomplete nutrient is never
   rendered as a number.
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import {
  buildCalculateLines, readNutrient, unavailableLabel, totalsToMealFields,
  inclusionSummary, MASS_UNITS, macroField, NUTRIENTS,
  normaliseUnit, parseQuantity, scaleToServings, servingCount,
} from './mealNutrition.js';

const rows = [
  { name: 'rice', quantity: '300', unit: 'g', ingredient_nutrition: 'n1' },
  { name: 'pork belly', quantity: '1/2', unit: 'LB', ingredient_nutrition: 'n2' },
  { name: 'palm oil', quantity: '2', unit: 'tbsp' },
  { name: 'onion', quantity: '', unit: 'g', ingredient_nutrition: 'n3' },
  { name: 'stock', quantity: 'some', unit: 'g', ingredient_nutrition: 'n4' },
  { name: 'water', quantity: '2', unit: 'cups', ingredient_nutrition: 'n5' },
  { name: '', description: '', quantity: '', unit: '' },
];

// ─── lines ───

it('rows from the database with a quantity in a mass unit are calculated, from the recipe Qty and Unit', () => {
  const { lines } = buildCalculateLines(rows);
  assert.deepStrictEqual(lines, [
    { ingredientId: 'n1', quantity: 300, unit: 'g' },
    { ingredientId: 'n2', quantity: 0.5, unit: 'lb' },
  ]);
});

it('every excluded row is named with a reason, never counted as zero', () => {
  const { skipped } = buildCalculateLines(rows);
  assert.deepStrictEqual(skipped.map((s) => s.name), ['palm oil', 'onion', 'stock', 'water']);
  assert.match(skipped[0].reason, /not from the ingredient database/);
  assert.match(skipped[1].reason, /no quantity/);
  assert.match(skipped[2].reason, /not a number above zero/);
  assert.match(skipped[3].reason, /cannot be weighed/);
});

it('a blank editor row is not reported as skipped', () => {
  const { lines, skipped } = buildCalculateLines([{ name: '', quantity: '', unit: '' }]);
  assert.strictEqual(lines.length, 0);
  assert.strictEqual(skipped.length, 0);
});

it('a zero or negative quantity is excluded rather than sent', () => {
  const { lines, skipped } = buildCalculateLines([
    { name: 'a', ingredient_nutrition: 'n1', quantity: '0', unit: 'g' },
    { name: 'b', ingredient_nutrition: 'n2', quantity: '-5', unit: 'g' },
  ]);
  assert.strictEqual(lines.length, 0);
  assert.strictEqual(skipped.length, 2);
});

it('reads recipe quantities as a cook writes them', () => {
  assert.strictEqual(parseQuantity('200'), 200);
  assert.strictEqual(parseQuantity('1 1/2'), 1.5);
  assert.strictEqual(parseQuantity('1½'), 1.5);
  assert.strictEqual(parseQuantity('0,5'), 0.5);
  assert.strictEqual(parseQuantity('a thumb'), null);
  assert.strictEqual(parseQuantity('2-3'), null);
  assert.strictEqual(normaliseUnit('LBS'), 'lb');
});

it('only the four mass units the calculation converts are accepted', () => {
  assert.deepStrictEqual(MASS_UNITS, ['g', 'kg', 'oz', 'lb']);
});

// ─── servings ───

it('ingredients are one serving; more servings multiply the figures', () => {
  const perServing = { totals: { calories: 400, protein: 20, fiber: null } };
  assert.deepStrictEqual(scaleToServings(perServing, 3).totals, { calories: 1200, protein: 60, fiber: null });
  assert.deepStrictEqual(scaleToServings(perServing, '').totals, perServing.totals);
  assert.strictEqual(servingCount('0'), 1);
  assert.strictEqual(servingCount('4'), 4);
  assert.strictEqual(scaleToServings(null, 2), null);
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

// ─── the macro fields on the form ───

const FAT = NUTRIENTS.find((n) => n.key === 'fat');
const FIBRE = NUTRIENTS.find((n) => n.key === 'fiber');
const CALORIES = NUTRIENTS.find((n) => n.key === 'calories');

it('a calculated macro shows its figure', () => {
  assert.deepStrictEqual(macroField(response, {}, FAT), { state: 'calculated', text: '7.7g', missingFor: [] });
  assert.strictEqual(macroField(response, {}, CALORIES).text, '1325 kcal');
});

it('an incomplete macro reads unavailable and names the ingredient — never 0', () => {
  const field = macroField(response, { fiber: 12 }, FIBRE);
  assert.strictEqual(field.state, 'unavailable');
  assert.strictEqual(field.text, 'unavailable');
  assert.deepStrictEqual(field.missingFor, ['Pork, belly']);
});

it('with nothing calculated the meal keeps showing what it has saved', () => {
  assert.deepStrictEqual(macroField(null, { fat: 12.25 }, FAT), { state: 'saved', text: '12.3g', missingFor: [] });
});

it('nothing calculated and nothing saved is an em dash, not a zero', () => {
  assert.strictEqual(macroField(null, { fat: '' }, FAT).text, '—');
  assert.strictEqual(macroField(null, {}, FAT).state, 'empty');
});

it('a saved zero is still a zero — it was measured once', () => {
  assert.deepStrictEqual(macroField(null, { fat: 0 }, FAT), { state: 'saved', text: '0g', missingFor: [] });
});

// ─── the inclusion line ───

it('the summary states how many rows made it in', () => {
  const { lines, skipped } = buildCalculateLines(rows);
  assert.strictEqual(inclusionSummary(lines, skipped), '2 of 6 ingredients included');
  assert.strictEqual(inclusionSummary([], []), 'No ingredients added yet');
});

it('a linked row with no quantity is not described as unlinked', () => {
  const { lines, skipped } = buildCalculateLines([
    { name: 'rice', ingredient_nutrition: 'n1', unit: 'g' },
  ]);
  assert.strictEqual(inclusionSummary(lines, skipped),
    '0 of 1 ingredients included — the ingredient needs a quantity in g, kg, oz or lb');
});

it('several linked rows missing quantities read as such', () => {
  const { lines, skipped } = buildCalculateLines([
    { name: 'rice', ingredient_nutrition: 'n1', unit: 'g' },
    { name: 'beans', ingredient_nutrition: 'n2', unit: 'g' },
  ]);
  assert.strictEqual(inclusionSummary(lines, skipped),
    '0 of 2 ingredients included — all 2 ingredients need a quantity in g, kg, oz or lb');
});

it('a mix of unlinked and half-linked rows counts both', () => {
  const { lines, skipped } = buildCalculateLines([
    { name: 'rice', ingredient_nutrition: 'n1', unit: 'g' },
    { name: 'onion' },
  ]);
  assert.strictEqual(inclusionSummary(lines, skipped),
    '0 of 2 ingredients included — 1 linked but missing an amount, 1 not linked');
});

it('nothing linked at all still says exactly that', () => {
  const { lines, skipped } = buildCalculateLines([{ name: 'onion' }, { name: 'rice' }]);
  assert.strictEqual(inclusionSummary(lines, skipped),
    '0 of 2 ingredients included — none come from the ingredient database');
});
