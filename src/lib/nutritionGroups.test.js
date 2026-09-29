/* ═══════════════════════════════════════════════════════
   NUTRITION GROUPING TESTS      run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import { foodKey, groupByFood, preparationsLabel, preparationName } from './nutritionGroups.js';

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

it('two unrelated USDA rows stay apart', () => {
  const groups = groupByFood([usda, { _id: 'u2', name: 'Chicken, raw', source: 'usda' }]);
  assert.strictEqual(groups.length, 2);
});

/* The case from the picker: a search for "pepper" came back as two WAFCT
   "Pepper" foods and a separate "Peppers" entry per USDA food. */
const pepper = [
  { _id: 'w1', name: 'Pepper, sweet, green, raw', source: 'wafct', food_id: '1000201', food_name: 'Pepper' },
  { _id: 'u1', name: 'Peppers, bell, green, raw', source: 'usda' },
  { _id: 'w2', name: 'Pepper, hot, red, raw', source: 'wafct', food_id: '1000202', food_name: 'Pepper' },
  { _id: 'u2', name: 'Peppers, bell, red, raw', source: 'usda' },
  { _id: 'w3', name: 'Pepper, sweet, green, boiled', source: 'wafct', food_id: '1000201', food_name: 'Pepper' },
];

it('WAFCT and USDA preparations of the same food form one group', () => {
  const groups = groupByFood(pepper);
  assert.strictEqual(groups.length, 1);
  const [group] = groups;
  assert.strictEqual(group.label, 'Pepper');
  assert.strictEqual(group.source, 'mixed');
  assert.deepStrictEqual(group.sources, ['wafct', 'usda']);
  assert.deepStrictEqual(group.counts, { wafct: 3, usda: 2 });
  // WAFCT's run first, then USDA's, each in the order the endpoint sent.
  assert.deepStrictEqual(group.docs.map((d) => d._id), ['w1', 'w2', 'w3', 'u1', 'u2']);
});

it('a mixed group says how many preparations each source gave', () => {
  const [group] = groupByFood(pepper);
  assert.strictEqual(
    preparationsLabel(group, { shown: 5, total: 5 }),
    '5 preparations · 3 WAFCT, 2 USDA · figures per 100 g',
  );
});

it('a USDA preparation drops its own plural head under the group name', () => {
  const [group] = groupByFood(pepper);
  assert.strictEqual(preparationName(pepper[1], group), 'bell, green, raw');
  assert.strictEqual(preparationName(pepper[0], group), 'sweet, green, raw');
});

it('food names compare without case, accents or a plural', () => {
  assert.strictEqual(foodKey('Peppers'), 'pepper');
  assert.strictEqual(foodKey('Tomatoes'), 'tomato');
  assert.strictEqual(foodKey('Blackberries'), 'blackberry');
  assert.strictEqual(foodKey('Égusi'), 'egusi');
  // Words that merely end in s are not plurals.
  assert.strictEqual(foodKey('Hummus'), 'hummus');
  assert.strictEqual(foodKey('Couscous'), 'couscous');
});

it('the order the endpoint sent — by relevance — is preserved', () => {
  const groups = groupByFood([usda, ...fonio]);
  assert.deepStrictEqual(groups.map((g) => g.label), ['Rice bran oil', 'Fonio']);
});

it('rows the model files under one food stay together even when their names differ', () => {
  const groups = groupByFood([
    { _id: 'x', name: 'Maize, yellow, dry', source: 'wafct', food_id: '7', food_name: 'Maize' },
    { _id: 'y', name: 'Corn flour', source: 'wafct', food_id: '7', food_name: 'Maize' },
  ]);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].label, 'Maize');
  // Not a "Maize" preparation by name, so it keeps its full name.
  assert.strictEqual(preparationName({ name: 'Corn flour' }, groups[0]), 'Corn flour');
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
