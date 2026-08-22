/* ═══════════════════════════════════════════════════════
   FOOD DATABASE

   The two reference sets the ingredient form matches against, merged.

     FAO/INFOODS WAFCT 2019   960 foods — West African coverage
     USDA FoodData Central    174 foods — global staples

   Both are per 100g and both are measured, so they can share one index
   without conversion. Every row keeps its own `food_id` and `source`, so
   a matched ingredient still records which reference it came from.

   WAFCT is listed first: where both describe the same food, the West
   African entry is the better answer for this product.
   ═══════════════════════════════════════════════════════ */

import WAFCT_FOODS from './wafctData.js';
import USDA_FOODS from './usdaData.js';

export const WAFCT_SOURCE_PREFIX = 'FAO/INFOODS';
export const USDA_SOURCE_PREFIX = 'USDA FoodData Central';

/** Which reference a row came from, for badging a match in the UI. */
export function datasetOf(food) {
  const source = String(food?.source ?? '');
  if (source.startsWith(USDA_SOURCE_PREFIX)) return 'usda';
  if (source.startsWith(WAFCT_SOURCE_PREFIX)) return 'wafct';
  return 'unknown';
}

export const DATASET_LABEL = {
  wafct: 'WAFCT',
  usda: 'USDA',
  unknown: 'Reference',
};

/* Each set on its own, so a lookup can ask them one at a time and offer
   the best answer from each rather than whatever wins overall. */
export { WAFCT_FOODS, USDA_FOODS };

const FOOD_DATABASE = [...WAFCT_FOODS, ...USDA_FOODS];

export default FOOD_DATABASE;
