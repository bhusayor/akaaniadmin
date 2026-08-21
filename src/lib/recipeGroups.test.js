/* ═══════════════════════════════════════════════════════
   RECIPE GROUP TESTS            run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import {
  normalizeGroup, validateGroup, formatPrice, currencySymbol, toNum,
  CURRENCIES, GROUP_STATUSES,
} from './recipeGroups.js';
import { RECIPE_GROUP_SEED } from '../data/recipeGroups.js';

const base = {
  name: 'Test Bundle', price: 4.99, servings: 5, plan: 'Fat Loss',
  mealTypes: ['lunch'], recipes: ['A', 'B'], benefits: ['One'],
};

// ─── money ───

it('formats to two decimals, so a price never reads like a typo', () => {
  assert.strictEqual(formatPrice(5, 'USD'), '$5.00');
  assert.strictEqual(formatPrice(4.9, 'USD'), '$4.90');
  assert.strictEqual(formatPrice(4.999, 'USD'), '$5.00');
});

it('multi-character symbols get a space, single ones do not', () => {
  assert.strictEqual(formatPrice(1200, 'NGN'), '₦1,200.00');
  assert.strictEqual(formatPrice(1200, 'KES'), 'KSh 1,200.00');
});

it('groups thousands, so a large revenue figure stays readable', () => {
  assert.strictEqual(formatPrice(44748000, 'NGN'), '₦44,748,000.00');
  assert.strictEqual(formatPrice(999, 'USD'), '$999.00');
});

it('a missing price reads as a dash, never as zero', () => {
  assert.strictEqual(formatPrice(null, 'USD'), '—');
  assert.strictEqual(formatPrice('', 'USD'), '—');
  assert.strictEqual(formatPrice('abc', 'USD'), '—');
  assert.strictEqual(formatPrice(0, 'USD'), '$0.00', 'an explicit zero is a real price');
});

it('every currency has a symbol', () => {
  CURRENCIES.forEach((c) => assert.ok(currencySymbol(c.code).length > 0));
  assert.strictEqual(currencySymbol('ZZZ'), 'ZZZ');
});

it('toNum keeps a cleared field null rather than 0', () => {
  assert.strictEqual(toNum(''), null);
  assert.strictEqual(toNum('   '), null);
  assert.strictEqual(toNum('nope'), null);
  assert.strictEqual(toNum('0'), 0);
  assert.strictEqual(toNum('4.99'), 4.99);
});

// ─── record ───

it('recipe count is derived, so it cannot disagree with the list', () => {
  const g = normalizeGroup({ ...base, recipes: ['A', 'B', 'C'] });
  assert.strictEqual(g.recipeCount, 3);
  g.recipes.push('D');
  assert.strictEqual(g.recipeCount, 4);
});

it('price per recipe divides the bundle price by its contents', () => {
  assert.strictEqual(normalizeGroup({ ...base, price: 6, recipes: ['A', 'B', 'C'] }).pricePerRecipe, 2);
});

it('price per recipe is null when there is nothing to divide by', () => {
  assert.strictEqual(normalizeGroup({ ...base, recipes: [] }).pricePerRecipe, null);
  assert.strictEqual(normalizeGroup({ ...base, price: null }).pricePerRecipe, null);
});

it('blank and duplicate-ish recipe entries are dropped', () => {
  const g = normalizeGroup({ ...base, recipes: ['  A  ', '', '   ', 'B'] });
  assert.deepStrictEqual(g.recipes, ['A', 'B']);
});

it('new groups default to draft, so nothing sells itself', () => {
  assert.strictEqual(normalizeGroup({ name: 'X' }).status, 'draft');
  assert.strictEqual(normalizeGroup({ name: 'X', status: 'nonsense' }).status, 'draft');
  assert.ok(GROUP_STATUSES.includes('live'));
});

it('an unknown currency falls back to USD rather than breaking the price', () => {
  assert.strictEqual(normalizeGroup({ ...base, currency: 'XYZ' }).currency, 'USD');
});

// ─── validation ───

it('a complete group passes', () => {
  assert.deepStrictEqual(validateGroup(base), []);
});

it('every required field is reported at once, not one at a time', () => {
  const problems = validateGroup({});
  assert.strictEqual(problems.length, 7);
  ['Name', 'Price', 'Servings', 'Plan', 'meal type', 'recipe', 'benefit']
    .forEach((word) => assert.ok(problems.some((p) => p.includes(word)), `missing: ${word}`));
});

it('a negative price is rejected', () => {
  assert.ok(validateGroup({ ...base, price: -1 }).some((p) => /negative/.test(p)));
});

it('a zero price is allowed — free bundles are a real thing', () => {
  assert.deepStrictEqual(validateGroup({ ...base, price: 0 }), []);
});

it('whitespace-only benefits do not count as benefits', () => {
  assert.ok(validateGroup({ ...base, benefits: ['   ', ''] }).some((p) => /benefit/.test(p)));
});

// ─── fixtures ───

it('every seeded group is valid and priced', () => {
  RECIPE_GROUP_SEED.forEach((raw) => {
    const g = normalizeGroup(raw, raw.id);
    assert.deepStrictEqual(validateGroup(g), [], `${g.name} is invalid`);
    assert.ok(g.price > 0, `${g.name} has no price`);
    assert.ok(g.recipeCount > 0, `${g.name} has no recipes`);
  });
});

it('seeded covers all point at recipe-group images', () => {
  RECIPE_GROUP_SEED.forEach((g) => {
    assert.ok(g.image.startsWith('recipe-groups/'), `${g.name}: ${g.image}`);
  });
});
