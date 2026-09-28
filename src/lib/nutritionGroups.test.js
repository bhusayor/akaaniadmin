/* ═══════════════════════════════════════════════════════
   NUTRITION GROUPING TESTS      run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import { groupByFood, preparationsLabel, preparationName } from './nutritionGroups.js';

/* Shaped like the real rows: eight fonio preparations share food_id
   1000012, as they do in the nutrition data model. */
const fonio = [
  { _id: 'a', name: 'Fonio, white, whole grains, raw', source: 'wafct', food_id: '1000012' },
  { _id: 'b', name: 'Fonio, black, whole grains, raw', source: 'wafct', food_id: '1000012' },
  { _id: 'c', name: 'Fonio, white, whole grains, boiled (without salt), drained', source: 'wafct', food_id: '1000012' },
];
const usda = { _id: 'u1', name: 'Rice bran oil', source: 'usda', food_id: null };

it('preparations of one food collapse into a single group', () => {
  const groups = groupByFood(fonio);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].label, 'Fonio');
  assert.strictEqual(groups[0].docs.length, 3);
});

it('a row the model does not cover stands on its own', () => {
  const groups = groupByFood([...fonio, usda]);
  assert.strictEqual(groups.length, 2);
  assert.strictEqual(groups[1].label, 'Rice bran oil');
  assert.strictEqual(groups[1].docs.length, 1);
});

it('two USDA rows never merge just because neither has a food_id', () => {
  const groups = groupByFood([usda, { _id: 'u2', name: 'Chicken, raw', source: 'usda' }]);
  assert.strictEqual(groups.length, 2);
});

it('the order the endpoint sent — by relevance — is preserved', () => {
  const groups = groupByFood([usda, ...fonio]);
  assert.deepStrictEqual(groups.map((g) => g.label), ['Rice bran oil', 'Fonio']);
});

it('a group whose rows share no head keeps the shortest full name', () => {
  const groups = groupByFood([
    { _id: 'x', name: 'Maize, yellow, dry', source: 'wafct', food_id: '7' },
    { _id: 'y', name: 'Corn flour', source: 'wafct', food_id: '7' },
  ]);
  assert.strictEqual(groups[0].label, 'Corn flour');
});

it('the count says when a page does not hold every match', () => {
  const [group] = groupByFood(fonio);
  assert.strictEqual(preparationsLabel(group, { shown: 3, total: 3 }), '3 preparations · figures per 100 g');
  assert.strictEqual(preparationsLabel(group, { shown: 3, total: 9 }), '3 preparations on this page · figures per 100 g');
});

it('one preparation is not called "1 preparations"', () => {
  const [group] = groupByFood([usda]);
  assert.strictEqual(preparationsLabel(group, { shown: 1, total: 1 }), '1 preparation · figures per 100 g');
});

it('the food name is not repeated on every preparation', () => {
  const [group] = groupByFood(fonio);
  assert.strictEqual(preparationName(fonio[0], group), 'white, whole grains, raw');
  assert.strictEqual(preparationName(fonio[2], group), 'white, whole grains, boiled (without salt), drained');
});

it('a preparation that is only the food name keeps it rather than going blank', () => {
  const doc = { _id: 'z', name: 'Fonio', source: 'wafct', food_id: '1000012' };
  const [group] = groupByFood([doc]);
  assert.strictEqual(preparationName(doc, group), 'Fonio');
});
