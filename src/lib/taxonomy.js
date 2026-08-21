/* ═══════════════════════════════════════════════════════
   AKAANI PRODUCT TAXONOMY

   Split out from wafctMatch.js deliberately: forms that have nothing to
   do with food matching need these constants, and importing them from
   the matcher dragged the 960-food WAFCT dataset into the main bundle
   behind them.
   ═══════════════════════════════════════════════════════ */

export const PRODUCT_GROUPS = [
  'Grains & Starches',
  'Vegetables',
  'Fruits',
  'Legumes, Nuts & Seeds',
  'Proteins',
  'Dairy',
  'Oils, Fats & Condiments',
  'Beverages',
  'Prepared Foods'
];

export const PRODUCT_CATEGORIES = {
  'Grains & Starches':       ['Cereals & Grains', 'Flours & Meals', 'Bread & Baked Goods', 'Pasta & Noodles', 'Roots & Tubers'],
  'Vegetables':              ['Leafy Greens', 'Fruiting Vegetables', 'Root Vegetables', 'Herbs & Aromatics'],
  'Fruits':                  ['Fresh Fruits', 'Dried Fruits'],
  'Legumes, Nuts & Seeds':   ['Beans & Pulses', 'Nuts & Seeds'],
  'Proteins':                ['Meat & Poultry', 'Fish & Seafood', 'Eggs', 'Insects & Other Protein'],
  'Dairy':                   ['Milk & Cream', 'Cheese & Yoghurt'],
  'Oils, Fats & Condiments': ['Oils & Fats', 'Condiments & Seasonings', 'Spices'],
  'Beverages':               ['Juices & Drinks', 'Tea, Coffee & Cocoa', 'Alcoholic Drinks'],
  'Prepared Foods':          ['Soups & Sauces', 'Snacks & Confectionery', 'Baby & Infant Foods']
};

export const UNITS = [
  { value: 'g',   label: 'gram (g)' },
  { value: 'oz',  label: 'ounce (oz)' },
  { value: 'lbs', label: 'pounds (lbs)' }
];
