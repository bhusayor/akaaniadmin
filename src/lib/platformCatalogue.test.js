/* ═══════════════════════════════════════════════════════
   LOCAL PLATFORM CATALOGUE TESTS    run with: npm test
   ═══════════════════════════════════════════════════════ */

import { beforeEach, it, assert } from 'vitest';
import {
  LOCAL_GROUPS, LOCAL_UNITS, createIngredient, deleteIngredient, listIngredients, resetForTests, seedFromMeals,
  updateIngredient,
} from './platformCatalogue.js';

beforeEach(() => resetForTests());

it('seeds one entry per distinct ingredient the meals use', () => {
  const seed = seedFromMeals([
    { ingredients: [{ name: 'eggs', unit: '' }, { name: 'Rice', unit: 'cups' }] },
    { ingredients: [{ name: 'Eggs ' }, { name: '' }] },
  ]);
  assert.deepStrictEqual(seed.map((s) => s.name), ['Eggs', 'Rice']);
  assert.strictEqual(seed[1].unit.name, 'cup');
});

it('lists A → Z with the total', async () => {
  const { ingredients, docs } = await listIngredients({ limit: 500 });
  assert.strictEqual(ingredients.length, docs);
  const names = ingredients.map((i) => i.name);
  assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })));
});

it('creates, updates and deletes, and refuses a duplicate name', async () => {
  const made = await createIngredient({ name: 'Qwerty leaves', unit: LOCAL_UNITS[0]._id, product_group: LOCAL_GROUPS[0]._id });
  assert.strictEqual(made.unit.name, 'g');
  assert.strictEqual(made.product_group.name, LOCAL_GROUPS[0].name);
  let error = null;
  try { await createIngredient({ name: 'qwerty LEAVES' }); } catch (e) { error = e; }
  assert.ok(error);
  const renamed = await updateIngredient(made._id, { name: 'Qwerty (dried)' });
  assert.strictEqual(renamed.unit.name, 'g');
  assert.strictEqual((await listIngredients({ search: 'qwerty' })).docs, 1);
  await deleteIngredient(made._id);
  assert.strictEqual((await listIngredients({ search: 'qwerty' })).docs, 0);
});
