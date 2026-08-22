import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readXlsx, columnIndex, isSpreadsheet } from './xlsx.js';
import {
  reviewMealRows, mapHeader, cellNum, cellList, cellProseList,
  parseIngredient, parseStep, normalizeType, normalizeImage, completeness, buildMeal,
} from './mealImport.js';
import { mealExportRows } from './mealExport.js';
import { MEALS } from '../data/meals.js';

const fixture = (name) => {
  const buf = fs.readFileSync(path.join(import.meta.dirname, '__fixtures__', name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

describe('xlsx reader', () => {
  it('reads a sheet without any parsing dependency', async () => {
    const rows = await readXlsx(fixture('meals-sample.xlsx'));
    expect(rows[0]).toEqual(['name', 'type', 'countries', 'calories', 'protein_g', 'image', 'tags', 'notes']);
    expect(rows).toHaveLength(4);
  });

  it('keeps an empty cell in place instead of shifting the row left', async () => {
    // Excel omits empty cells entirely; placing by index is what stops
    // every later value sliding one column over.
    const rows = await readXlsx(fixture('meals-sample.xlsx'));
    const moiMoi = rows[2];
    expect(moiMoi[4]).toBe('');                                 // protein, absent
    expect(moiMoi[5]).toBe('https://example.com/moimoi.jpg');   // image, still in column 5
  });

  it('preserves quotes and commas inside a cell', async () => {
    const rows = await readXlsx(fixture('meals-sample.xlsx'));
    expect(rows[1][7]).toBe('Smoky, "party" style');
    expect(rows[3][7]).toBe('Comma, inside a cell');
  });

  it('reads the first worksheet only', async () => {
    const rows = await readXlsx(fixture('two-sheets.xlsx'));
    expect(rows).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('rejects a file that is not a zip', async () => {
    await expect(readXlsx(new TextEncoder().encode('name,type\nJollof,lunch').buffer))
      .rejects.toThrow(/zip/i);
  });

  it('converts spreadsheet column references', () => {
    expect(columnIndex('A1')).toBe(0);
    expect(columnIndex('Z9')).toBe(25);
    expect(columnIndex('AA1')).toBe(26);
    expect(columnIndex('BC12')).toBe(54);
  });

  it('recognises a spreadsheet by extension', () => {
    expect(isSpreadsheet('meals.xlsx')).toBe(true);
    expect(isSpreadsheet('MEALS.XLSX')).toBe(true);
    expect(isSpreadsheet('meals.csv')).toBe(false);
    expect(isSpreadsheet(null)).toBe(false);
  });
});

describe('header mapping', () => {
  it('accepts the exporter\'s own column names', () => {
    expect(mapHeader(['name', 'prep_mins', 'calories', 'fibre_g', 'lu_tips']))
      .toEqual(['name', 'prep', 'cal', 'fiber', 'luTips']);
  });

  it('is forgiving about case, spacing and punctuation', () => {
    expect(mapHeader(['Meal Name', 'COOK TIME', 'K-cal', ' Fibre (g) ']))
      .toEqual(['name', 'prep', 'cal', 'fiber']);
  });

  it('leaves an unknown column unmapped rather than guessing', () => {
    expect(mapHeader(['name', 'supplier_ref'])).toEqual(['name', null]);
  });
});

describe('cell parsing', () => {
  it('treats blanks and placeholders as absent, but keeps a real zero', () => {
    expect(cellNum('')).toBe(null);
    expect(cellNum('—')).toBe(null);
    expect(cellNum('n/a')).toBe(null);
    expect(cellNum('N/A')).toBe(null);
    expect(cellNum(0)).toBe(0);
    expect(cellNum('0')).toBe(0);
  });

  it('tolerates thousands separators', () => {
    expect(cellNum('1,250')).toBe(1250);
  });

  it('splits short lists on any common separator', () => {
    expect(cellList('Nigeria | Ghana')).toEqual(['Nigeria', 'Ghana']);
    expect(cellList('Nigeria; Ghana')).toEqual(['Nigeria', 'Ghana']);
    expect(cellList('Nigeria, Ghana')).toEqual(['Nigeria', 'Ghana']);
  });

  it('splits prose lists on the pipe alone', () => {
    // A step contains semicolons and an ingredient contains slashes;
    // splitting on either tears them in half.
    expect(cellProseList('Season the meat; leave to rest | Fry until golden'))
      .toEqual(['Season the meat; leave to rest', 'Fry until golden']);
    expect(cellProseList('1/2 cup rice')).toEqual(['1/2 cup rice']);
  });

  it('reads an ingredient back into its parts', () => {
    expect(parseIngredient('3 cups long-grain rice')).toEqual({
      quantity: '3', unit: 'cups', name: 'long-grain rice', description: '',
    });
    expect(parseIngredient('6 plum tomatoes — blended')).toEqual({
      quantity: '6', unit: '', name: 'plum tomatoes', description: 'blended',
    });
  });

  it('keeps an ingredient with no quantity whole', () => {
    expect(parseIngredient('salt to taste')).toMatchObject({ name: 'salt to taste', quantity: '' });
  });

  it('reads a step back, dropping its number and keeping its time', () => {
    expect(parseStep('1. Rinse the rice', 0)).toEqual({ text: 'Rinse the rice', timeEstimate: '' });
    expect(parseStep('3. Simmer (20 min)', 2)).toEqual({ text: 'Simmer', timeEstimate: '20 min' });
  });

  it('only accepts a meal type it knows', () => {
    expect(normalizeType('Lunch')).toBe('lunch');
    expect(normalizeType('main course')).toBe('');
    expect(normalizeType('')).toBe('');
  });
});

describe('image links', () => {
  it('passes an absolute url through', () => {
    expect(normalizeImage('https://cdn.example.com/a.jpg').image).toBe('https://cdn.example.com/a.jpg');
  });

  it('passes a data uri through', () => {
    expect(normalizeImage('data:image/png;base64,AAA').image).toBe('data:image/png;base64,AAA');
  });

  it('serves a bare path from public, without a leading slash', () => {
    expect(normalizeImage('/meals/jollof.jpg').image).toBe('meals/jollof.jpg');
    expect(normalizeImage('meals/jollof.jpg').image).toBe('meals/jollof.jpg');
  });

  it('completes a protocol-relative url', () => {
    expect(normalizeImage('//cdn.example.com/a.jpg').image).toBe('https://cdn.example.com/a.jpg');
  });

  it('refuses a local file path and says why', () => {
    // These render as a broken box and nobody can tell what went wrong.
    const win = normalizeImage('C:\\Users\\me\\jollof.jpg');
    expect(win.image).toBe('');
    expect(win.warning).toMatch(/local file path/);
    expect(normalizeImage('file:///Users/me/a.jpg').image).toBe('');
  });

  it('leaves an empty cell empty, with no complaint', () => {
    expect(normalizeImage('')).toEqual({ image: '', warning: null });
  });
});

describe('building a meal from a row', () => {
  const fields = mapHeader(['name', 'type', 'calories']);

  it('requires a name and nothing else', () => {
    expect(buildMeal(['Jollof', 'lunch', '520'], fields).errors).toEqual([]);
    expect(buildMeal(['', 'lunch', '520'], fields).errors).toEqual(['Name is required']);
  });

  it('leaves every unsupplied field empty rather than defaulted', () => {
    const { meal } = buildMeal(['Jollof', '', ''], fields);
    expect(meal.cal).toBe(null);
    expect(meal.prot).toBe(null);
    expect(meal.servings).toBe(null);
    expect(meal.tags).toEqual([]);
    expect(meal.ingredients).toEqual([]);
    expect(meal.description).toBe('');
    expect(meal.type).toBe('');
  });

  it('warns when a meal type is not recognised, and leaves it unset', () => {
    const { meal, warnings } = buildMeal(['Jollof', 'brunch', ''], fields);
    expect(meal.type).toBe('');
    expect(warnings[0]).toMatch(/brunch/);
  });
});

describe('reviewing a sheet', () => {
  it('skips blank lines', () => {
    const r = reviewMealRows([['name'], [''], ['Jollof'], ['   ']]);
    expect(r.rows).toHaveLength(1);
  });

  it('reports columns it could not place', () => {
    const r = reviewMealRows([['name', 'supplier'], ['Jollof', 'X']]);
    expect(r.unmapped).toEqual(['supplier']);
    expect(r.rows[0].include).toBe(true);
  });

  it('marks a nameless row as not importable but keeps it visible', () => {
    const r = reviewMealRows([['name', 'calories'], ['', '300']]);
    expect(r.rows[0].include).toBe(false);
    expect(r.rows).toHaveLength(1);
  });

  it('numbers rows by their line in the file', () => {
    const r = reviewMealRows([['name'], ['A'], ['B']]);
    expect(r.rows.map((x) => x.line)).toEqual([2, 3]);
  });

  it('handles an empty sheet without throwing', () => {
    expect(reviewMealRows([]).rows).toEqual([]);
    expect(reviewMealRows([[]]).rows).toEqual([]);
  });
});

describe('round trip through the exporter', () => {
  // The strongest check available: everything the export writes, the
  // import must read back identically.
  const review = reviewMealRows(mealExportRows(MEALS));

  it('reads back every meal', () => {
    expect(review.rows).toHaveLength(MEALS.length);
    expect(review.rows.every((r) => r.include)).toBe(true);
  });

  it('preserves every scalar field', () => {
    review.rows.forEach((r, i) => {
      const src = MEALS[i];
      expect(r.meal.name).toBe(src.name);
      expect(r.meal.cal).toBe(src.cal);
      expect(r.meal.prot).toBe(src.prot);
      expect(r.meal.carb).toBe(src.carb);
      expect(r.meal.fat).toBe(src.fat);
      expect(r.meal.fiber).toBe(src.fiber);
      expect(r.meal.servings).toBe(src.servings);
      expect(r.meal.prep).toBe(src.prep);
    });
  });

  it('preserves lists, including ingredients and steps', () => {
    review.rows.forEach((r, i) => {
      const src = MEALS[i];
      expect(r.meal.tags).toEqual(src.tags);
      expect(r.meal.countries).toEqual(src.countries);
      expect(r.meal.ingredients).toHaveLength(src.ingredients.length);
      expect(r.meal.instructions).toHaveLength(src.instructions.length);
      /* Names must survive, not just the count — a unit misread as part
         of the name passes a length check and corrupts the recipe. */
      expect(r.meal.ingredients.map((x) => x.name)).toEqual(src.ingredients.map((x) => x.name));
      expect(r.meal.instructions.map((x) => x.text)).toEqual(src.instructions.map((x) => x.text));
    });
  });

  it('keeps a step that contains a semicolon in one piece', () => {
    const step = review.rows[0].meal.instructions[0].text;
    expect(step).toContain(';');
    expect(step).toBe(MEALS[0].instructions[0].text);
  });

  it('only leaves id and the derived per-serving column unmapped', () => {
    expect(review.unmapped).toEqual(['id', 'calories_per_serving']);
  });
});

describe('completeness', () => {
  it('counts what the file actually filled in', () => {
    const full = completeness(MEALS[0]);
    expect(full.filled).toBeGreaterThan(10);
    const bare = completeness({ name: 'X', tags: [], countries: [], ingredients: [], instructions: [] });
    expect(bare.filled).toBe(0);
  });
});
