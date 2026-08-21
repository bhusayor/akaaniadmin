import { describe, it, expect } from 'vitest';
import {
  MEAL_EXPORT_COLUMNS, mealExportRow, mealExportRows,
  formatIngredient, formatStep, perServing,
} from './mealExport.js';
import { MEALS, BLANK_MEAL } from '../data/meals.js';

describe('formatIngredient', () => {
  it('joins quantity, unit and name', () => {
    expect(formatIngredient({ quantity: '3', unit: 'cups', name: 'rice' })).toBe('3 cups rice');
  });

  it('appends a note when there is one', () => {
    expect(formatIngredient({ quantity: '6', unit: '', name: 'tomatoes', description: 'blended' }))
      .toBe('6 tomatoes — blended');
  });

  it('drops an empty note rather than leaving a dangling dash', () => {
    expect(formatIngredient({ quantity: '1', unit: 'tsp', name: 'salt', description: '   ' }))
      .toBe('1 tsp salt');
  });

  it('keeps a quantity of 0 instead of blanking it', () => {
    expect(formatIngredient({ quantity: 0, unit: 'g', name: 'sugar' })).toBe('0 g sugar');
  });

  it('passes a plain string through', () => {
    expect(formatIngredient('a pinch of salt')).toBe('a pinch of salt');
  });

  it('is empty for nothing', () => {
    expect(formatIngredient(null)).toBe('');
  });
});

describe('formatStep', () => {
  it('numbers the step from one', () => {
    expect(formatStep({ text: 'Rinse the rice' }, 0)).toBe('1. Rinse the rice');
  });

  it('carries the time estimate when present', () => {
    expect(formatStep({ text: 'Simmer', timeEstimate: '20 min' }, 2)).toBe('3. Simmer (20 min)');
  });

  it('accepts a bare string', () => {
    expect(formatStep('Serve hot', 0)).toBe('1. Serve hot');
  });

  it('is empty for a step with no text', () => {
    expect(formatStep({ timeEstimate: '5 min' }, 0)).toBe('');
  });
});

describe('perServing', () => {
  it('divides total calories by servings', () => {
    expect(perServing({ cal: 520, servings: 4 })).toBe(130);
  });

  it('is null when servings is zero — not Infinity', () => {
    // A spreadsheet renders Infinity as a number and nobody questions it.
    expect(perServing({ cal: 520, servings: 0 })).toBe(null);
  });

  it('is null when either figure is missing', () => {
    expect(perServing({ cal: 520 })).toBe(null);
    expect(perServing({ servings: 4 })).toBe(null);
  });
});

describe('mealExportRow', () => {
  const meal = MEALS[0];
  const row = mealExportRow(meal);
  const at = (col) => row[MEAL_EXPORT_COLUMNS.indexOf(col)];

  it('emits one cell per column', () => {
    expect(row).toHaveLength(MEAL_EXPORT_COLUMNS.length);
  });

  it('writes ingredients out in full rather than counting them', () => {
    expect(at('ingredients').split(' | ')).toHaveLength(meal.ingredients.length);
  });

  it('writes every step, numbered', () => {
    const steps = at('instructions').split(' | ');
    expect(steps).toHaveLength(meal.instructions.length);
    expect(steps[0].startsWith('1. ')).toBe(true);
  });

  it('includes fibre alongside the other macros', () => {
    expect(at('fibre_g')).toBe(String(meal.fiber));
  });

  it('renders every cell as a string, so the CSV writer never sees objects', () => {
    row.forEach((c) => expect(typeof c).toBe('string'));
  });

  it('leaves a missing value blank rather than writing "null"', () => {
    const row2 = mealExportRow({ ...BLANK_MEAL, id: 99, name: 'Blank' });
    expect(row2.every((c) => !/^(null|undefined)$/.test(c))).toBe(true);
  });

  it('keeps an explicit zero', () => {
    const row2 = mealExportRow({ ...BLANK_MEAL, id: 1, name: 'Zero', fat: 0 });
    expect(row2[MEAL_EXPORT_COLUMNS.indexOf('fat_g')]).toBe('0');
  });
});

describe('mealExportRows', () => {
  it('leads with the header, then one row per meal', () => {
    const rows = mealExportRows(MEALS);
    expect(rows[0]).toEqual(MEAL_EXPORT_COLUMNS);
    expect(rows).toHaveLength(MEALS.length + 1);
  });

  it('is just the header for an empty selection', () => {
    expect(mealExportRows([])).toEqual([MEAL_EXPORT_COLUMNS]);
  });

  it('covers every meal in the fixture without throwing', () => {
    expect(() => mealExportRows(MEALS)).not.toThrow();
  });
});

describe('the meal fixtures', () => {
  it('gives every meal a fibre figure', () => {
    MEALS.forEach((m) => expect(typeof m.fiber).toBe('number'));
  });

  it('starts a blank meal with its own arrays, not shared ones', () => {
    const a = { ...BLANK_MEAL };
    const b = { ...BLANK_MEAL };
    a.tags.push('x');
    expect(b.tags).toHaveLength(0);
  });

  it('matches the shape of a seeded meal', () => {
    const seeded = new Set(Object.keys(MEALS[0]));
    Object.keys(BLANK_MEAL).forEach((k) => expect(seeded.has(k)).toBe(true));
  });
});
