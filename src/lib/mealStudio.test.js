import { describe, it, expect } from 'vitest';
import {
  sanitiseMeal, mergeDraft, emptyDraft, validateDraft, summarise,
  conflictsWith, toFormState, STUDIO_FIELDS, SCHEMA_VERSION,
} from './mealStudio.js';
import {
  parseQuantity, toGrams, resolveIngredient, computeNutrition, CONFIDENCE_NOTE,
} from './mealNutrition.js';
import { mockTurn, sendTurn, applyTurn, configure } from './mealStudioChat.js';
import { isChunkError } from '../components/ChunkBoundary.jsx';

describe('model output is treated as untrusted', () => {
  it('drops keys that are not in the schema', () => {
    const out = sanitiseMeal({ name: 'Jollof', price: 9.99, isPublished: true, id: 7 });
    expect(out.name).toBe('Jollof');
    expect('price' in out).toBe(false);
    expect('isPublished' in out).toBe(false);
    expect('id' in out).toBe(false);
  });

  it('only keeps meal types it recognises', () => {
    expect(sanitiseMeal({ types: ['Lunch', 'brunch', 'DINNER'] }).types).toEqual(['lunch', 'dinner']);
  });

  it('coerces a number and rejects nonsense', () => {
    expect(sanitiseMeal({ servings: '4' }).servings).toBe(4);
    expect(sanitiseMeal({ servings: 'lots' }).servings).toBe(null);
  });

  it('accepts ingredients as objects or bare strings', () => {
    const out = sanitiseMeal({ ingredients: ['salt', { name: 'rice', quantity: 2, unit: 'cups' }] });
    expect(out.ingredients).toEqual([
      { name: 'salt', quantity: '', unit: '', description: '' },
      { name: 'rice', quantity: '2', unit: 'cups', description: '' },
    ]);
  });

  it('drops an ingredient or step with no substance', () => {
    expect(sanitiseMeal({ ingredients: [{ quantity: '2' }] }).ingredients).toEqual([]);
    expect(sanitiseMeal({ instructions: [{ timeEstimate: '5 min' }] }).instructions).toEqual([]);
  });

  it('survives a non-object entirely', () => {
    expect(sanitiseMeal(null)).toEqual({});
    expect(sanitiseMeal('a meal')).toEqual({});
  });
});

describe('a turn only touches what it names', () => {
  const base = mergeDraft(emptyDraft(), {
    name: 'Akara Pockets',
    tags: ['Vegetarian'],
    ingredients: [{ name: 'black-eyed peas', quantity: '2', unit: 'cups' }],
    instructions: [{ text: 'Blend the beans' }],
  });

  it('leaves unmentioned fields alone', () => {
    // The spec is explicit: the model must not silently reset a completed
    // section when asked about a different one.
    const next = mergeDraft(base, { servings: 4 });
    expect(next.servings).toBe(4);
    expect(next.name).toBe('Akara Pockets');
    expect(next.ingredients).toHaveLength(1);
    expect(next.instructions).toHaveLength(1);
  });

  it('still allows an explicit clear', () => {
    expect(mergeDraft(base, { tags: [] }).tags).toEqual([]);
  });

  it('starts from an empty draft when there is none', () => {
    expect(mergeDraft(null, { name: 'X' }).name).toBe('X');
  });

  it('covers every studio field in an empty draft', () => {
    const blank = emptyDraft();
    STUDIO_FIELDS.forEach((f) => expect(f in blank).toBe(true));
  });
});

describe('validation separates blocking from advisory', () => {
  it('blocks on the fields Create Meal requires', () => {
    const v = validateDraft(emptyDraft());
    expect(v.valid).toBe(false);
    expect(v.blocking).toContain('Name');
    expect(v.blocking).toContain('Description');
    expect(v.blocking).toContain('Cook time');
  });

  it('passes once those are present', () => {
    const draft = mergeDraft(emptyDraft(), {
      name: 'Jollof', description: 'Rice in pepper base.',
      types: ['lunch'], tags: ['Family Meals'], countries: ['Nigeria'], prep: 40,
    });
    expect(validateDraft(draft).valid).toBe(true);
  });

  it('treats missing ingredients as advisory, not blocking', () => {
    const draft = mergeDraft(emptyDraft(), {
      name: 'Jollof', description: 'Rice.', types: ['lunch'],
      tags: ['x'], countries: ['Nigeria'], prep: 40,
    });
    const v = validateDraft(draft);
    expect(v.valid).toBe(true);
    expect(v.warnings).toContain('No ingredients yet');
  });

  it('rejects a serving count of zero', () => {
    const draft = mergeDraft(emptyDraft(), {
      name: 'X', description: 'Y', types: ['lunch'], tags: ['t'], countries: ['Nigeria'],
      prep: 10, servings: 0,
    });
    expect(validateDraft(draft).valid).toBe(false);
  });

  it('reports the schema version it validated against', () => {
    expect(validateDraft(emptyDraft()).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('summarises what exists', () => {
    const draft = mergeDraft(emptyDraft(), { servings: 2, prep: 30 });
    expect(summarise(draft)).toBe('2 servings · 30 min');
    expect(summarise(emptyDraft())).toBe('');
  });
});

describe('overwrite detection', () => {
  const draft = mergeDraft(emptyDraft(), { name: 'Studio Name', servings: 4, tags: ['A'] });

  it('flags a filled field that would change', () => {
    const c = conflictsWith(draft, { name: 'My name', servings: '', tags: [] });
    expect(c.map((x) => x.label)).toEqual(['Name']);
  });

  it('does not flag an empty field — overwriting a blank is not a conflict', () => {
    // Warning about blanks trains people to click through the warning that
    // actually matters.
    expect(conflictsWith(draft, { name: '', servings: '', tags: [] })).toEqual([]);
  });

  it('does not flag a field that already matches', () => {
    expect(conflictsWith(draft, { name: 'Studio Name' })).toEqual([]);
  });

  it('is empty with no form to compare against', () => {
    expect(conflictsWith(draft, null)).toEqual([]);
  });
});

describe('form state conversion', () => {
  it('renders numbers as strings so inputs stay controlled', () => {
    const f = toFormState(mergeDraft(emptyDraft(), { servings: 4, prep: 30 }));
    expect(f.servings).toBe('4');
    expect(f.prep).toBe('30');
  });

  it('renders an absent number as empty, not "null"', () => {
    expect(toFormState(emptyDraft()).servings).toBe('');
  });

  it('copies arrays rather than sharing them', () => {
    const draft = mergeDraft(emptyDraft(), { tags: ['A'] });
    const f = toFormState(draft);
    f.tags.push('B');
    expect(draft.tags).toEqual(['A']);
  });
});

describe('quantities and weights', () => {
  it('reads fractions, mixed numbers and ranges', () => {
    expect(parseQuantity('1 1/2')).toBeCloseTo(1.5);
    expect(parseQuantity('½')).toBeCloseTo(0.5);
    expect(parseQuantity('2-3')).toBeCloseTo(2.5);
    expect(parseQuantity('500')).toBe(500);
  });

  it('is null when there is no figure at all', () => {
    expect(parseQuantity('a pinch')).toBe(null);
    expect(parseQuantity('')).toBe(null);
  });

  it('converts mass exactly and volume approximately', () => {
    expect(toGrams('500', 'g')).toEqual({ grams: 500, exact: true });
    expect(toGrams('1', 'kg')).toEqual({ grams: 1000, exact: true });
    // A cup of rice and a cup of spinach do not weigh the same, so this
    // can only ever be approximate.
    expect(toGrams('2', 'cups').exact).toBe(false);
  });

  it('returns null for an unmeasured ingredient', () => {
    expect(toGrams('to taste', '')).toBe(null);
  });
});

describe('nutrition is computed, not generated', () => {
  const byWeight = [
    { name: 'long-grain rice', quantity: '400', unit: 'g' },
    { name: 'palm oil', quantity: '45', unit: 'g' },
  ];

  it('resolves ingredients against the references', () => {
    const hit = resolveIngredient('palm oil');
    expect(hit).toBeTruthy();
    expect(hit.food.source).toMatch(/WAFCT|USDA/);
  });

  it('totals from measured per-100g figures', () => {
    const n = computeNutrition(byWeight, 4);
    expect(n.total.kcal).toBeGreaterThan(0);
    expect(n.perServing.kcal).toBeCloseTo(n.total.kcal / 4, 0);
  });

  it('claims "measured" only when every quantity is a weight', () => {
    expect(computeNutrition(byWeight).confidence).toBe('measured');
    expect(computeNutrition([{ name: 'long-grain rice', quantity: '2', unit: 'cups' }]).confidence)
      .toBe('approximate');
  });

  it('says so when an ingredient could not be counted', () => {
    const n = computeNutrition([
      { name: 'long-grain rice', quantity: '400', unit: 'g' },
      { name: 'zzqq unobtainium', quantity: '2', unit: 'g' },
    ]);
    expect(n.confidence).toBe('partial');
    expect(n.unresolved.map((u) => u.name)).toContain('zzqq unobtainium');
  });

  it('skips a section heading rather than trying to match it', () => {
    const n = computeNutrition([
      { name: 'Egusi Sauce:', quantity: '', unit: '' },
      { name: 'palm oil', quantity: '45', unit: 'g' },
    ]);
    expect(n.resolved).toHaveLength(1);
    expect(n.unresolved).toHaveLength(0);
  });

  it('leaves perServing null without a serving count', () => {
    expect(computeNutrition(byWeight).perServing).toBe(null);
  });

  it('reports nothing for an empty recipe', () => {
    const n = computeNutrition([], 4);
    expect(n.confidence).toBe('none');
    expect(CONFIDENCE_NOTE[n.confidence]).toBeTruthy();
  });

  it('has a note for every confidence level it can report', () => {
    ['measured', 'approximate', 'partial', 'none'].forEach((k) => {
      expect(CONFIDENCE_NOTE[k]).toBeTruthy();
    });
  });
});

describe('the conversation', () => {
  it('drafts a full meal on the first turn', () => {
    const t = mockTurn('Create a vegan Nigerian brunch using akara', null);
    expect(t.meal.name).toBeTruthy();
    expect(t.meal.ingredients.length).toBeGreaterThan(0);
    expect(t.meal.instructions.length).toBeGreaterThan(0);
  });

  it('changes only the field a refinement names', () => {
    const first = mockTurn('a jollof for lunch', null);
    const draft = mergeDraft(emptyDraft(), first.meal);
    const t = mockTurn('make it 4 servings', draft);
    expect(t.meal.servings).toBe(4);
    expect('name' in t.meal).toBe(false);
    expect('ingredients' in t.meal).toBe(false);
  });

  it('returns no change when nothing was asked', () => {
    const draft = mergeDraft(emptyDraft(), mockTurn('a jollof', null).meal);
    expect(mockTurn('what do you think', draft).meal).toBe(null);
  });

  it('refuses an empty message', async () => {
    configure({ provider: 'mock' });
    await expect(sendTurn({ message: '   ' })).rejects.toThrow();
  });

  it('leaves the draft untouched on a no-change turn', () => {
    const draft = mergeDraft(emptyDraft(), { name: 'Kept' });
    expect(applyTurn(draft, { meal: null }).name).toBe('Kept');
  });

  it('sanitises whatever a turn returns before it lands', async () => {
    configure({ provider: 'mock' });
    const t = await sendTurn({ message: 'a vegan jollof' });
    const draft = applyTurn(emptyDraft(), t);
    Object.keys(draft).forEach((k) => expect(STUDIO_FIELDS).toContain(k));
  });
});

describe('chunk-failure detection decides whether to auto-reload', () => {
  it('recognises the failures a stale index.html produces', () => {
    [
      'Failed to fetch dynamically imported module: /assets/Ingredients-abc.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
      'ChunkLoadError: Loading chunk 3 failed',
    ].forEach((m) => expect(isChunkError(new Error(m))).toBe(true));
  });

  it('does not treat a render bug as one', () => {
    // Reloading on a genuine bug would hide it behind an endless refresh.
    expect(isChunkError(new TypeError("Cannot read properties of null (reading 'name')"))).toBe(false);
    expect(isChunkError(new Error('Something went wrong'))).toBe(false);
  });

  it('survives a non-Error being thrown', () => {
    expect(isChunkError('just a string')).toBe(false);
    expect(isChunkError(null)).toBe(false);
    expect(isChunkError(undefined)).toBe(false);
  });
});
