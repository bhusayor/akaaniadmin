import { describe, it, expect } from 'vitest';
import { ALLERGENS, allergensFor, formatAllergens, allergenDiff } from './allergens.js';
import USDA_FOODS from './usdaData.js';
import FOOD_DATABASE, { datasetOf, WAFCT_FOODS, USDA_FOODS } from './foodDatabase.js';
import { findMatches, REVIEW_THRESHOLD } from './wafctMatch.js';

describe('the traps the imported column fell into', () => {
  // Each of these was wrong in the supplied CSV.
  it.each([
    ['Flour, cassava', 'Gluten'],
    ['Flour, rice, white, unenriched', 'Gluten'],
    ['Flour, quinoa', 'Gluten'],
    ['Flour, corn, yellow, fine meal, enriched', 'Gluten'],
    ['Flour, sorghum', 'Gluten'],
    ['Flour, amaranth', 'Gluten'],
    ['Flour, coconut', 'Gluten'],
    ['Flour, potato', 'Gluten'],
    ['Flour, chestnut', 'Gluten'],
    ['Buckwheat, whole grain', 'Gluten'],
    ['Corn flour, masa harina, white or yellow, dry, raw', 'Gluten'],
  ])('does not call %s gluten', (name, tag) => {
    expect(allergensFor(name)).not.toContain(tag);
  });

  it.each([
    ['Squash, winter, butternut, raw'],
    ['Almond butter, creamy'],
    ['Peanut butter, creamy'],
    ['Sesame butter, creamy'],
    ['Soy milk, unsweetened, plain, shelf stable'],
  ])('does not call %s dairy', (name) => {
    expect(allergensFor(name)).not.toContain('Dairy');
  });

  it('does not read "eggplant" as eggs', () => {
    expect(allergensFor('Eggplant, raw')).toEqual([]);
    expect(allergensFor('Garden egg, raw')).toEqual([]);
  });

  it('does not read an oyster mushroom as a mollusc', () => {
    expect(allergensFor('Mushroom, oyster')).toEqual([]);
    expect(allergensFor('Mushroom, king oyster')).toEqual([]);
  });
});

describe('the allergens the imported column missed', () => {
  // False negatives are the dangerous direction.
  it.each([
    ['Nuts, brazilnuts, raw'],
    ['Nuts, macadamia nuts, raw'],
    ['Nuts, pine nuts, raw'],
    ['Nuts, pecans, halves, raw'],
    ['Nuts, cashew nuts, raw'],
    ['Flour, almond'],
  ])('flags %s as a tree nut', (name) => {
    expect(allergensFor(name)).toContain('Tree nuts');
  });

  it.each([
    ['Oats, whole grain, steel cut'],
    ['Bulgur, dry, raw'],
    ['Farro, pearled, dry, raw'],
    ['Einkorn, grain, dry, raw'],
    ['Khorasan, grain, dry, raw'],
    ['Cookies, oatmeal, soft, with raisins'],
  ])('flags %s as gluten', (name) => {
    expect(allergensFor(name)).toContain('Gluten');
  });

  it('flags fish and crustaceans', () => {
    expect(allergensFor('Alaska Pollock, raw')).toContain('Fish');
    expect(allergensFor('Tilapia, fillet, raw')).toContain('Fish');
    expect(allergensFor('Shrimp (crayfish), whole, dried')).toContain('Crustaceans');
  });

  it('flags sesame, which the column had as dairy', () => {
    expect(allergensFor('Sesame butter, creamy')).toEqual(['Sesame']);
  });
});

describe('peanuts are separate from tree nuts', () => {
  it('tags peanuts without tagging tree nuts', () => {
    // Someone may react to one and not the other.
    const tags = allergensFor('Peanuts, raw');
    expect(tags).toContain('Peanuts');
    expect(tags).not.toContain('Tree nuts');
  });

  it('treats groundnut as peanut', () => {
    expect(allergensFor('Groundnut, shelled, dried, raw')).toContain('Peanuts');
  });
});

describe('genuine positives still fire', () => {
  it.each([
    ['Flour, whole wheat, unenriched', 'Gluten'],
    ['Bread, white, commercially prepared', 'Gluten'],
    ['Flour, rye', 'Gluten'],
    ['Flour, barley', 'Gluten'],
    ['Yogurt, Greek, strawberry, nonfat', 'Dairy'],
    ['Eggs, Grade A, Large, egg whole', 'Eggs'],
    ['Flour, soy, defatted', 'Soy'],
  ])('%s -> %s', (name, tag) => {
    expect(allergensFor(name)).toContain(tag);
  });
});

describe('shape and edges', () => {
  it('returns tags in the declared display order', () => {
    const tags = allergensFor('Almond and wheat cookie with milk');
    expect(tags).toEqual([...tags].sort((a, b) => ALLERGENS.indexOf(a) - ALLERGENS.indexOf(b)));
  });

  it('is empty for a blank or missing name rather than throwing', () => {
    expect(allergensFor('')).toEqual([]);
    expect(allergensFor(null)).toEqual([]);
    expect(allergensFor(undefined)).toEqual([]);
    expect(allergensFor('   ')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(allergensFor('FLOUR, WHOLE WHEAT')).toContain('Gluten');
  });

  it('honours a "free from" phrasing', () => {
    expect(allergensFor('Gluten-free oat flour')).not.toContain('Gluten');
    expect(allergensFor('Dairy-free milk alternative')).not.toContain('Dairy');
  });

  it('formats a list, and a dash-free empty', () => {
    expect(formatAllergens(['Gluten', 'Dairy'])).toBe('Gluten, Dairy');
    expect(formatAllergens([])).toBe('');
  });

  it('only produces tags from the declared set', () => {
    FOOD_DATABASE.forEach((f) => {
      (f.allergens ?? []).forEach((a) => expect(ALLERGENS).toContain(a));
    });
  });
});

describe('allergenDiff', () => {
  it('reports what a source claimed but the food does not support', () => {
    const d = allergenDiff('Flour, cassava', 'Gluten');
    expect(d.falsePositives).toEqual(['Gluten']);
  });

  it('reports what the food implies but the source omitted', () => {
    const d = allergenDiff('Nuts, brazilnuts, raw', '');
    expect(d.falseNegatives).toEqual(['Tree nuts']);
  });

  it('is clean when the two agree', () => {
    const d = allergenDiff('Yogurt, Greek, strawberry, nonfat', 'Dairy');
    expect(d.falsePositives).toEqual([]);
    expect(d.falseNegatives).toEqual([]);
  });
});

describe('the generated USDA dataset', () => {
  it('carries every row per 100g and measured', () => {
    expect(USDA_FOODS.length).toBe(174);
    USDA_FOODS.forEach((f) => expect(f.confidence).toBe('measured'));
  });

  it('has a unique food id and core-bearing name for every row', () => {
    const ids = USDA_FOODS.map((f) => f.food_id);
    expect(new Set(ids).size).toBe(ids.length);
    USDA_FOODS.forEach((f) => expect(f.name.trim().length).toBeGreaterThan(0));
  });

  it('carries no duplicate names — the matcher needs one answer per food', () => {
    const names = USDA_FOODS.map((f) => f.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('drops the implausible potato fibre rather than carrying it through', () => {
    // 13.8-14.9 g/100g was reported where every reference puts it near 2.
    USDA_FOODS.filter((f) => /^Potatoes, (gold|red|russet)/.test(f.name))
      .forEach((f) => expect(f.fibre_g).toBe(null));
  });

  it('leaves no other fibre figure implausibly high', () => {
    USDA_FOODS.filter((f) => f.fibre_g !== null)
      .forEach((f) => expect(f.fibre_g).toBeLessThanOrEqual(40));
  });

  it('maps every row onto a product group the form offers', () => {
    USDA_FOODS.forEach((f) => expect(f.product_group).toBeTruthy());
  });
});

describe('the merged food database', () => {
  it('holds both references', () => {
    const counts = FOOD_DATABASE.reduce((acc, f) => {
      acc[datasetOf(f)] = (acc[datasetOf(f)] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.wafct).toBe(960);
    expect(counts.usda).toBe(174);
    expect(counts.unknown).toBeUndefined();
  });

  it('keeps every row traceable to a source id', () => {
    FOOD_DATABASE.forEach((f) => expect(f.food_id).toBeTruthy());
  });

  it('lists WAFCT first, so West African foods win a tie', () => {
    expect(datasetOf(FOOD_DATABASE[0])).toBe('wafct');
    expect(datasetOf(FOOD_DATABASE[FOOD_DATABASE.length - 1])).toBe('usda');
  });
});

describe('each reference answers on its own', () => {
  // Searching both as one list lets the winner crowd the other set out of
  // the results entirely, and when a food is in both, the second reading
  // is the useful part.
  const lookUp = (name) => {
    const seen = new Set();
    return [...findMatches(name, WAFCT_FOODS), ...findMatches(name, USDA_FOODS)]
      .filter((r) => {
        if (r.score < REVIEW_THRESHOLD || seen.has(r.food.food_id)) return false;
        seen.add(r.food.food_id);
        return true;
      })
      .sort((a, b) => b.score - a.score);
  };

  it.each(['sweet potato', 'spinach', 'tomato', 'onion'])(
    'offers both references for "%s"', (term) => {
      const kinds = new Set(lookUp(term).map((r) => datasetOf(r.food)));
      expect(kinds.has('wafct')).toBe(true);
      expect(kinds.has('usda')).toBe(true);
    },
  );

  it('surfaces a cross-reference the score alone would have hidden', () => {
    // USDA's sweet potato scores 86 against WAFCT's 100 — outside the
    // 12-point window the alternatives list used to apply.
    const hits = lookUp('sweet potato');
    const best = hits[0];
    const cross = hits.find((r) => datasetOf(r.food) !== datasetOf(best.food));
    expect(cross).toBeDefined();
    expect(best.score - cross.score).toBeGreaterThan(12);
  });

  it('never returns the same food twice', () => {
    const ids = lookUp('rice').map((r) => r.food.food_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns nothing for a name in neither reference', () => {
    expect(lookUp('kpomo shaki bespoke')).toEqual([]);
  });
});
