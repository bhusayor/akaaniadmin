/* ═══════════════════════════════════════════════════════
   MEALS ↔ PLATFORM API TESTS    run with: npm test
   ═══════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { ingredientLine, mealFromApi, mealToApi, unresolvedNames } from './meals.js';

const NUTRITION_ID = '66015f2b1f4a2c0012a9b8e0';

/** What MealEdit hands the provider when a meal is saved. */
const payload = {
  name: ' Fonio porridge ',
  description: 'Warm fonio with milk.',
  image: '',
  types: ['breakfast', 'snack'],
  countries: ['Nigeria'],
  prep: 15,
  servings: 2,
  portion: '1 bowl',
  notificationMessage: '',
  luTips: 'Rinse the fonio twice.',
  videoUrl: '',
  cal: 250.6,
  prot: 5.3,
  carb: 44.8,
  fat: null,
  fiber: 12.3,
  tags: ['High Protein', 'Not On Platform'],
  productGroup: 'Grains',
  healthConditions: [],
  nutrients: [{ name: 'Iron', amount: '2', unit: 'mg' }, { name: '', amount: '', unit: '' }],
  ingredients: [
    {
      name: 'Fonio', description: 'white, whole grains, raw', quantity: '75', unit: 'g',
      ingredient_nutrition: NUTRITION_ID, nutrition_name: 'Fonio, white, whole grains, raw', nutrition_source: 'wafct',
    },
    { name: 'Milk', description: '', quantity: '1/2', unit: 'cup' },
    { name: 'Salt', description: '', quantity: 'to taste', unit: '' },
    { name: '  ', description: '', quantity: '', unit: '' },
  ],
  instructions: [
    { text: 'Boil the milk.', timeEstimate: 5, image: 'data:image/png;base64,AAA', videoUrl: '' },
    { text: 'Stir in the fonio.', timeEstimate: null, image: 'https://cdn.example.com/step.jpg', videoUrl: 'https://youtu.be/x' },
    { text: '   ', timeEstimate: null, image: null, videoUrl: '' },
  ],
};

const lookups = {
  tagIds: new Map([['high protein', 't1']]),
  productGroupIds: new Map([['grains', 'g1']]),
};

describe('mealToApi', () => {
  const body = mealToApi(payload, lookups);

  it('sends the fields the API validates, capitalising types', () => {
    expect(body.name).toBe('Fonio porridge');
    expect(body.types).toEqual(['Breakfast', 'Snack']);
    expect(body.prep_time).toBe(15);
    expect(body.servings).toBe(2);
    expect(body.portion_per_serving).toEqual(['1 bowl']);
    expect(body.lu_tips).toBe('Rinse the fonio twice.');
  });

  it('leaves blank text and missing figures off rather than sending "" or null', () => {
    // Joi.string() refuses "", Joi.number() refuses null.
    expect(body).not.toHaveProperty('image');
    expect(body).not.toHaveProperty('notification_message');
    expect(body).not.toHaveProperty('video_url');
    expect(body).not.toHaveProperty('fat');
  });

  it('keeps calories per serving and derives the total from the servings', () => {
    expect(body.calorie_per_serving).toBe(250.6);
    expect(body.total_calories).toBe(501);
    expect(body.protein).toBe(5.3);
    expect(body.carbohydrate).toBe(44.8);
    expect(body.fiber).toBe(12.3);
  });

  it('writes each ingredient as a structured row and as a plain line', () => {
    expect(body.ingredients).toEqual([
      '75 g Fonio, white, whole grains, raw',
      '1/2 cup Milk',
      'to taste Salt',
    ]);
    expect(body.ingredients_list[0]).toEqual({
      name: 'Fonio',
      description: 'white, whole grains, raw',
      quantity: 75,
      quantity_text: '75',
      unit_name: 'g',
      ingredient_nutrition: NUTRITION_ID,
      nutrition_name: 'Fonio, white, whole grains, raw',
      nutrition_source: 'wafct',
    });
    // A cook's fraction is kept as written and as a number.
    expect(body.ingredients_list[1]).toMatchObject({ quantity: 0.5, quantity_text: '1/2', unit_name: 'cup' });
    // An amount that is not a number is kept as text, with no quantity invented.
    expect(body.ingredients_list[2]).toEqual({ name: 'Salt', quantity_text: 'to taste' });
  });

  it('sends only real links for step media', () => {
    expect(body.instructions).toEqual(['Boil the milk.', 'Stir in the fonio.']);
    expect(body.instruction_steps).toEqual([
      { step: 'Boil the milk.', time_estimate: 5 },
      { step: 'Stir in the fonio.', image_url: 'https://cdn.example.com/step.jpg', video_url: 'https://youtu.be/x' },
    ]);
  });

  it('turns tag and product group names into ids, dropping names it cannot resolve', () => {
    expect(body.tags).toEqual(['t1']);
    expect(body.product_groups).toEqual(['g1']);
    expect(unresolvedNames(payload, lookups)).toEqual({ tags: ['Not On Platform'], productGroups: [] });
  });

  it('never sends a source-derived nutrition id, which is not an ObjectId', () => {
    const row = mealToApi({
      ...payload, ingredients: [{ name: 'Fonio', quantity: '75', unit: 'g', ingredient_nutrition: 'wafct-2000001' }],
    }).ingredients_list[0];
    expect(row).not.toHaveProperty('ingredient_nutrition');
    expect(row).not.toHaveProperty('nutrition_name');
  });

  it('normalises a unit to the name the calculator takes', () => {
    const row = mealToApi({ ...payload, ingredients: [{ name: 'Beef', quantity: '1', unit: 'LBS' }] }).ingredients_list[0];
    expect(row.unit_name).toBe('lb');
  });
});

describe('mealFromApi', () => {
  const doc = {
    _id: 'm1',
    name: 'Fonio porridge',
    types: ['Breakfast', 'Snack'],
    countries: ['Nigeria'],
    servings: 2,
    calorie_per_serving: 250.6,
    total_calories: 501,
    protein: 5.3,
    carbohydrate: 44.8,
    fiber: 0,
    prep_time: 15,
    portion_per_serving: ['', '1 bowl'],
    tags: [{ _id: 't1', name: 'High Protein' }],
    product_groups: [{ _id: 'g1', name: 'Grains' }],
    ingredients: ['75 g Fonio'],
    ingredients_list: [{
      name: 'Fonio', quantity: 75, quantity_text: '75', unit_name: 'g',
      ingredient_nutrition: NUTRITION_ID, nutrition_name: 'Fonio, white, whole grains, raw', nutrition_source: 'wafct',
    }],
    instruction_steps: [{ step: 'Boil the milk.', time_estimate: 5, image_url: 'https://x/y.jpg' }],
    instructions: ['Boil the milk.'],
    lu_tips: 'Rinse.',
    hidden: false,
  };
  const meal = mealFromApi(doc);

  it('reads the record the meal screens expect', () => {
    expect(meal).toMatchObject({
      id: 'm1', name: 'Fonio porridge', types: ['breakfast', 'snack'], type: 'breakfast',
      servings: 2, prep: 15, portion: '1 bowl', tags: ['High Protein'], productGroup: 'Grains', luTips: 'Rinse.',
    });
  });

  it('reads calories per serving; a measured 0 stays 0 and an absent figure stays null', () => {
    expect(meal.cal).toBe(251);
    expect(meal.fiber).toBe(0);
    expect(meal.fat).toBe(null);
  });

  it('falls back to total ÷ servings when only the total was recorded', () => {
    expect(mealFromApi({ ...doc, calorie_per_serving: undefined }).cal).toBe(251);
  });

  it('restores each ingredient row with its nutrition link', () => {
    expect(meal.ingredients).toEqual([{
      name: 'Fonio', description: '', quantity: '75', unit: 'g',
      ingredient_nutrition: NUTRITION_ID, nutrition_name: 'Fonio, white, whole grains, raw', nutrition_source: 'wafct',
    }]);
    expect(meal.instructions).toEqual([{ text: 'Boil the milk.', timeEstimate: 5, image: 'https://x/y.jpg', videoUrl: '' }]);
  });

  it('reads a meal another client wrote with only ingredient and step strings', () => {
    const plain = mealFromApi({ _id: 'm2', name: 'Rice', types: ['Lunch'], ingredients: ['2 cups rice', ''], instructions: ['Boil.'] });
    expect(plain.ingredients).toEqual([{ name: '2 cups rice', description: '', quantity: '', unit: '' }]);
    expect(plain.instructions).toEqual([{ text: 'Boil.', timeEstimate: null, image: null, videoUrl: '' }]);
    expect(plain.cal).toBe(null);
    expect(plain.tags).toEqual([]);
  });

  it('round-trips through mealToApi without losing the link or the amounts', () => {
    const again = mealToApi(meal, lookups);
    expect(again.ingredients_list[0]).toMatchObject({
      ingredient_nutrition: NUTRITION_ID, quantity: 75, unit_name: 'g',
    });
    expect(again.tags).toEqual(['t1']);
    expect(again.types).toEqual(['Breakfast', 'Snack']);
  });
});

describe('ingredientLine', () => {
  it('reads like a recipe line', () => {
    expect(ingredientLine({ quantity: '2', unit: 'cups', name: 'rice', description: 'rinsed' })).toBe('2 cups rice, rinsed');
    expect(ingredientLine({ name: 'Salt' })).toBe('Salt');
  });
});
