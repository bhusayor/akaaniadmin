/* ═══════════════════════════════════════════════════════
   MEAL TAG TESTS               run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import { normalizeTag, validateTag, usageByTag, orphanTags, TAG_CATEGORIES, CATEGORY_TONE } from './mealTags.js';
import { MEAL_TAG_SEED } from '../data/mealTags.js';
import { MEALS } from '../data/meals.js';

const tags = MEAL_TAG_SEED.map((t) => normalizeTag(t, t.id));

// ─── record ───

it('trims whitespace off every field', () => {
  const t = normalizeTag({ name: '  Comfort Food  ', category: ' Context ', description: '  x  ' });
  assert.strictEqual(t.name, 'Comfort Food');
  assert.strictEqual(t.category, 'Context');
  assert.strictEqual(t.description, 'x');
});

// ─── validation ───

it('name and category are both required', () => {
  const problems = validateTag({});
  assert.strictEqual(problems.length, 2);
});

it('rejects a duplicate name regardless of case', () => {
  // Two tags differing only in case would split a meal's tagging in half.
  const problems = validateTag({ name: 'comfort FOOD', category: 'Context' }, tags);
  assert.ok(problems.some((p) => /already exists/.test(p)));
});

it('allows a name that is merely similar', () => {
  assert.deepStrictEqual(validateTag({ name: 'Comfort Foods', category: 'Context' }, tags), []);
});

it('editing a tag does not collide with itself', () => {
  const target = tags[0];
  const others = tags.filter((t) => t.id !== target.id);
  assert.deepStrictEqual(validateTag({ ...target, description: 'changed' }, others), []);
});

// ─── usage ───

it('counts how many meals carry each tag', () => {
  const usage = usageByTag(MEALS);
  assert.strictEqual(usage.get('Vegan'), MEALS.filter((m) => m.tags.includes('Vegan')).length);
  assert.ok(usage.get('High Protein') > 0);
});

it('a tag no meal uses counts zero, not undefined-as-zero by accident', () => {
  const usage = usageByTag([{ tags: ['A'] }]);
  assert.strictEqual(usage.get('A'), 1);
  assert.strictEqual(usage.get('B'), undefined);
});

it('tolerates meals with no tags array', () => {
  assert.doesNotThrow(() => usageByTag([{ id: 1 }, { id: 2, tags: ['A'] }]));
});

// ─── orphans ───

it('finds tag strings meals use that the vocabulary does not define', () => {
  // These are the ones that silently drop out of filters.
  const orphans = orphanTags(MEALS, tags);
  assert.ok(orphans.some((o) => o.name === 'Quick Meals'), JSON.stringify(orphans));
});

it('orphan detection is case-insensitive', () => {
  const orphans = orphanTags([{ tags: ['comfort food'] }], [{ name: 'Comfort Food' }]);
  assert.deepStrictEqual(orphans, []);
});

it('reports how many meals each orphan affects', () => {
  const orphans = orphanTags([{ tags: ['Ghost'] }, { tags: ['Ghost'] }], []);
  assert.deepStrictEqual(orphans, [{ name: 'Ghost', count: 2 }]);
});

it('no orphans once every used tag is defined', () => {
  const defined = [...new Set(MEALS.flatMap((m) => m.tags))].map((name) => ({ name }));
  assert.deepStrictEqual(orphanTags(MEALS, defined), []);
});

// ─── fixtures ───

it('every seeded tag has a name and a known category', () => {
  tags.forEach((t) => {
    assert.ok(t.name, 'tag with no name');
    assert.ok(TAG_CATEGORIES.includes(t.category), `${t.name}: ${t.category}`);
  });
});

it('no two seeded tags share a name', () => {
  const names = tags.map((t) => t.name.toLowerCase());
  assert.strictEqual(new Set(names).size, names.length);
});

it('every category has a colour, so none falls back to grey', () => {
  TAG_CATEGORIES.forEach((c) => assert.ok(CATEGORY_TONE[c], `no tone for ${c}`));
});
