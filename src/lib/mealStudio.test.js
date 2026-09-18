/* ═══════════════════════════════════════════════════════
   MEAL STUDIO MAPPING TESTS     run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import {
  toStudioMeal, fromStudioMeal, changedFields, MEAL_SCHEMA_VERSION,
} from './mealStudio.js';

const form = {
  name: 'Jollof Rice',
  description: 'Smoky party jollof',
  types: ['lunch', 'dinner'],
  countries: ['Nigeria'],
  prep: '35', servings: '4', cal: '520', calPerServing: '130',
  fat: '12', carb: '55', prot: '38', fiber: '',
  portion: '1 plate',
  notificationMessage: 'Time to cook',
  luTips: 'Do not stir',
  healthConditions: ['High blood pressure'],
  nutrients: [{ name: 'Vitamin A', amount: '12', unit: 'mg' }, { name: '', amount: '', unit: '' }],
  ingredients: [
    { name: 'rice', description: 'washed', quantity: '3', unit: 'cups', ingredient_nutrition: 'n1', nutrition_quantity: '300', nutrition_unit: 'g', nutrition_name: 'Rice, raw', nutrition_source: 'wafct' },
    { name: '', description: '', quantity: '', unit: '' },
  ],
  instructions: [{ text: 'Fry the base', timeEstimate: 15, image: 'data:x', videoUrl: 'v' }],
  tags: ['High Protein'],
  image: 'meals/jollof.jpg',
};

// ─── to the endpoint ───

it('maps form fields onto the backend meal shape', () => {
  const meal = toStudioMeal(form);
  assert.strictEqual(meal.name, 'Jollof Rice');
  assert.deepStrictEqual(meal.types, ['Lunch', 'Dinner']);
  assert.strictEqual(meal.prep_time, 35);
  assert.strictEqual(meal.total_calories, 520);
  assert.strictEqual(meal.carbohydrate, 55);
  assert.strictEqual(meal.protein, 38);
  assert.deepStrictEqual(meal.portion_per_serving, ['1 plate']);
  assert.strictEqual(meal.lu_tips, 'Do not stir');
  assert.strictEqual(meal.notification_message, 'Time to cook');
  assert.deepStrictEqual(meal.incompatible_medical_conditions, ['High blood pressure']);
});

it('numbers go as numbers and blanks are left out entirely', () => {
  const meal = toStudioMeal(form);
  assert.strictEqual(typeof meal.servings, 'number');
  assert.isFalse('fiber' in meal, 'a blank field must not be sent as null or ""');
});

it('blank ingredient and nutrient rows are not sent', () => {
  const meal = toStudioMeal(form);
  assert.strictEqual(meal.ingredients.length, 1);
  assert.deepStrictEqual(meal.ingredients[0], { name: 'rice', description: 'washed', quantity: '3', unit: 'cups' });
  assert.strictEqual(meal.nutrients.length, 1);
});

it('steps go as both plain text and structured steps', () => {
  const meal = toStudioMeal(form);
  assert.deepStrictEqual(meal.instructions, ['Fry the base']);
  assert.deepStrictEqual(meal.instruction_steps, [{ step: 'Fry the base', time_estimate: 15 }]);
});

it('ids and uploaded assets are never sent', () => {
  const meal = toStudioMeal(form);
  ['tags', 'image', 'product_groups', 'categories', '_id', 'video_url'].forEach((k) => {
    assert.isFalse(k in meal, `${k} must not be sent`);
  });
});

it('an empty form produces an empty draft rather than junk', () => {
  const meal = toStudioMeal({});
  assert.deepStrictEqual(meal.types, []);
  assert.deepStrictEqual(meal.ingredients, []);
  assert.isFalse('name' in meal);
});

// ─── back from the endpoint ───

it('a drafted meal maps back onto form fields', () => {
  const patch = fromStudioMeal({
    name: 'Jollof Rice & Chicken',
    types: ['Lunch'],
    total_calories: 610,
    carbohydrate: 60,
    portion_per_serving: ['1 bowl'],
    lu_tips: 'Let it catch',
  }, form);
  assert.strictEqual(patch.name, 'Jollof Rice & Chicken');
  assert.deepStrictEqual(patch.types, ['lunch']);
  assert.strictEqual(patch.portion, '1 bowl');
  assert.strictEqual(patch.luTips, 'Let it catch');
});

it('a drafted calorie or macro figure is never applied to the meal', () => {
  // Nutrition has one source: the calculation over linked ingredients.
  const patch = fromStudioMeal({ total_calories: 610, fat: 9, carbohydrate: 60, protein: 12, fiber: 3 }, form);
  ['cal', 'fat', 'carb', 'prot', 'fiber'].forEach((k) => assert.isFalse(k in patch, `${k} must not be applied`));
});

it('fields the draft does not carry are left out, so applying never blanks them', () => {
  const patch = fromStudioMeal({ name: 'Only a name' }, form);
  assert.deepStrictEqual(Object.keys(patch), ['name']);
});

it('step images and video URLs survive a draft that rewrites the text', () => {
  const patch = fromStudioMeal({ instruction_steps: [{ step: 'Fry the base well', time_estimate: 20 }] }, form);
  assert.deepStrictEqual(patch.instructions, [
    { text: 'Fry the base well', timeEstimate: 20, image: 'data:x', videoUrl: 'v' },
  ]);
});

it('plain string instructions are accepted too', () => {
  const patch = fromStudioMeal({ instructions: ['Boil', 'Serve'] }, form);
  assert.strictEqual(patch.instructions.length, 2);
  assert.strictEqual(patch.instructions[1].text, 'Serve');
});

it('a nutrition link survives only while its ingredient keeps its name', () => {
  const kept = fromStudioMeal({ ingredients: [{ name: 'Rice', quantity: 300, unit: 'g' }] }, form);
  assert.strictEqual(kept.ingredients[0].ingredient_nutrition, 'n1');
  assert.strictEqual(kept.ingredients[0].nutrition_quantity, '300', 'the mass it was measured with travels with the link');
  assert.strictEqual(kept.ingredients[0].quantity, '300', 'numeric quantities become form strings');

  const replaced = fromStudioMeal({ ingredients: [{ name: 'Couscous' }] }, form);
  assert.isUndefined(replaced.ingredients[0].ingredient_nutrition, 'a different ingredient must not inherit the link');
});

it('string ingredients from the model still produce usable rows', () => {
  const patch = fromStudioMeal({ ingredients: ['2 cups rice'] }, form);
  assert.deepStrictEqual(patch.ingredients[0], { name: '2 cups rice', description: '', quantity: '', unit: '' });
});

it('a round trip through both mappings keeps the meal recognisable', () => {
  const patch = fromStudioMeal(toStudioMeal(form), form);
  assert.strictEqual(patch.name, form.name);
  assert.deepStrictEqual(patch.types, form.types);
  assert.strictEqual(patch.portion, form.portion);
  assert.strictEqual(patch.ingredients[0].ingredient_nutrition, 'n1');
  /* The only difference is the blank rows the form keeps for editing and the
     request deliberately leaves out. Nothing filled in is altered. */
  assert.deepStrictEqual(changedFields(patch, form).sort(), ['ingredients', 'nutrients']);
  assert.strictEqual(patch.ingredients.length, 1);
});

it('changedFields lists only what actually differs', () => {
  assert.deepStrictEqual(changedFields({ name: 'X', servings: '4' }, form), ['name']);
});

it('the schema version this client drafts against is pinned', () => {
  assert.strictEqual(MEAL_SCHEMA_VERSION, 'meal.v1');
});
