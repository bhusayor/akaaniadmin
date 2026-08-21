/* ═══════════════════════════════════════════════════════
   LU FACT TESTS                run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import {
  normalizeFact, validateFact, duplicateTitles, bodyLoad, formatDate,
  BODY_LIMIT, BODY_COMFORTABLE, FACT_CATEGORIES, CATEGORY_TONE, FACT_STATUSES,
} from './luFacts.js';
import { LU_FACT_SEED } from '../data/luFacts.js';

const facts = LU_FACT_SEED.map((f) => normalizeFact(f, f.id));
const base = { title: 'Lemon', body: 'A short true thing.' };

// ─── record ───

it('trims and defaults sensibly', () => {
  const f = normalizeFact({ title: '  Yam  ', body: '  fact  ' });
  assert.strictEqual(f.title, 'Yam');
  assert.strictEqual(f.body, 'fact');
  assert.strictEqual(f.emoji, '💡');
  assert.strictEqual(f.category, 'Nutrition');
});

it('new facts default to draft, so nothing publishes itself', () => {
  assert.strictEqual(normalizeFact(base).status, 'draft');
  assert.strictEqual(normalizeFact({ ...base, status: 'nonsense' }).status, 'draft');
  assert.ok(FACT_STATUSES.includes('published'));
});

it('an unknown category falls back rather than rendering uncoloured', () => {
  assert.strictEqual(normalizeFact({ ...base, category: 'Nope' }).category, 'Nutrition');
});

// ─── length budget ───

it('bodyLoad passes 1 exactly at the comfortable length', () => {
  assert.strictEqual(bodyLoad('x'.repeat(BODY_COMFORTABLE)), 1);
  assert.ok(bodyLoad('x'.repeat(BODY_COMFORTABLE + 40)) > 1);
  assert.ok(bodyLoad('short') < 1);
});

it('an empty body loads zero rather than dividing by nothing', () => {
  assert.strictEqual(bodyLoad(''), 0);
  assert.strictEqual(bodyLoad(null), 0);
});

it('over the hard limit is an error, over comfortable is not', () => {
  assert.deepStrictEqual(validateFact({ ...base, body: 'x'.repeat(BODY_COMFORTABLE + 10) }), []);
  const problems = validateFact({ ...base, body: 'x'.repeat(BODY_LIMIT + 5) });
  assert.ok(problems.some((p) => /5 characters over/.test(p)), problems.join());
});

// ─── validation ───

it('title and body are both required', () => {
  assert.strictEqual(validateFact({}).length, 2);
});

it('whitespace does not count as a body', () => {
  assert.ok(validateFact({ title: 'X', body: '   ' }).some((p) => /Fact is required/.test(p)));
});

it('rejects a duplicate subject regardless of case', () => {
  assert.ok(validateFact({ title: 'lEmOn', body: 'x' }, facts).some((p) => /already exists/.test(p)));
});

it('editing a fact does not collide with itself', () => {
  const target = facts[0];
  const others = facts.filter((f) => f.id !== target.id);
  assert.deepStrictEqual(validateFact(target, others), []);
});

// ─── duplicates ───

it('groups facts that share a subject', () => {
  const groups = duplicateTitles([
    { title: 'Yam', body: 'a' }, { title: 'yam', body: 'b' }, { title: 'Rice', body: 'c' },
  ]);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].length, 2);
});

it('no duplicates in the seeded facts', () => {
  assert.deepStrictEqual(duplicateTitles(facts), []);
});

// ─── dates ───

it('formats dates and tolerates a missing one', () => {
  assert.strictEqual(formatDate('2026-08-14'), '14 Aug 2026');
  assert.strictEqual(formatDate(null), null);
  assert.strictEqual(formatDate('nonsense'), null);
});

// ─── fixtures ───

it('every seeded fact is valid and fits the card', () => {
  facts.forEach((f) => {
    assert.ok(f.title, 'fact with no title');
    assert.ok(f.body, `${f.title} has no body`);
    assert.ok(f.body.length <= BODY_LIMIT, `${f.title} is ${f.body.length} chars`);
  });
});

it('every category has a colour', () => {
  FACT_CATEGORIES.forEach((c) => assert.ok(CATEGORY_TONE[c], `no tone for ${c}`));
});
