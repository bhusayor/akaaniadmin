/* ═══════════════════════════════════════════════════════
   AKAANI ADMIN — WAFCT MATCHER

   Maps a free-text ingredient name onto a FAO/INFOODS WAFCT 2019 food
   record so its per-100g macros can be suggested.

   Used by both the single-ingredient form and the CSV importer — there
   is exactly one copy of this logic.
   ═══════════════════════════════════════════════════════ */

import WAFCT_DATA from './wafctData.js';
import { PRODUCT_GROUPS, PRODUCT_CATEGORIES, UNITS } from './taxonomy.js';

/* ══════════════════════════════════════
   AKAANI PRODUCT TAXONOMY

   This repo had no ingredient flow and therefore no existing
   Product Group / Product Category list to read. These are the
   canonical lists — the form and the CSV importer both read them
   from here, so there is a single place to edit when the real
   taxonomy is settled.
══════════════════════════════════════ */

/* How an ingredient is normally measured or logged. Stored as the short
   `value`; the `label` is what the form shows. Nutrition is always per
   100g regardless of what is selected here. */
/* ══════════════════════════════════════
   WAFCT CATEGORY → PRODUCT GROUP / CATEGORY

   The shipped dataset carries 8 categories, not the 14 broad WAFCT
   ones, and they are noisy — verified against the actual rows:

     Grains (162)      cereals + flours + breads + noodles + cakes
     Vegetables (218)  leaks cassava, cocoyam, fufu, french fries, maize
     Legumes (127)     clean: 18 cores, all beans/pulses
     Fruits (53)       leaks african locust bean, baobab, melon
     Proteins (281)    meat + fish + insects, but also nuts (cashew,
                       coconut, benniseed, cola nut)
     Dairy (27)        6 cores: milk, cheese, cream, yoghurt, formula
     Oils & Fats (35)  clean: 14 cores, all oils/fats/butter/margarine
     null (57)         beverages + spices + sauces mixed together

   So the group is mapped where the bucket supports it, and the
   category is left null wherever the dataset is too coarse or too
   noisy to justify one. An unmapped category is not a failure —
   the macro auto-fill works regardless, and every suggestion needs
   a human confirm anyway.
══════════════════════════════════════ */

var WAFCT_CATEGORY_MAP = {
  'Grains':      { group: 'Grains & Starches',       category: null },
  'Vegetables':  { group: 'Vegetables',              category: null },
  'Legumes':     { group: 'Legumes, Nuts & Seeds',   category: 'Beans & Pulses' },
  'Fruits':      { group: 'Fruits',                  category: null },
  'Proteins':    { group: 'Proteins',                category: null },
  'Dairy':       { group: 'Dairy',                   category: null },
  'Oils & Fats': { group: 'Oils, Fats & Condiments', category: 'Oils & Fats' }
  // null / unrecognised categories are deliberately absent — unmapped.
};

function mapWafctCategory(wafctCategory) {
  var hit = WAFCT_CATEGORY_MAP[wafctCategory];
  return hit ? { group: hit.group, category: hit.category } : { group: null, category: null };
}

/* ══════════════════════════════════════
   PRODUCT CATEGORY INFERENCE

   The WAFCT `category` field is too coarse and too noisy to pick a
   product category from (see the notes above). The food's NAME is far
   more informative, so the category is read off the name instead, and
   the group is then derived from whichever category won — a category
   belongs to exactly one group.

   Rules are ordered: the first match wins. Order carries real weight,
   e.g. the oil rule sits above the nut rule so "Groundnut oil" is an
   oil rather than a nut, and the seed rule sits above the fruit rule
   so "Melon seed" is a seed while "Melon, cantaloupe" is a fruit.
══════════════════════════════════════ */

var CATEGORY_RULES = [
  // Infant food before milk, or formula reads as dairy.
  [/\b(infant formula|weaning|baby food)\b/,                                 'Baby & Infant Foods'],

  // Beverages
  [/\b(beer|wine|spirits?|liqueur|alcoholic)\b/,                             'Alcoholic Drinks'],
  [/\b(coffee|tea|cocoa|ovaltine|milo)\b/,                                   'Tea, Coffee & Cocoa'],
  // `water` only as a standalone item ("Water, tap") -- never "Water yam".
  [/\b(juice|nectar|carbonated|soft drink|coconut water|beverage|sap)\b|\bwater\s*,/, 'Juices & Drinks'],

  // Fats before nuts, so "Groundnut oil" is an oil.
  [/\b(oils?|butter|margarine|lard|shea)\b/,                                 'Oils & Fats'],

  // Prepared dishes
  [/\b(soups?|sauces?|stew)\b/,                                              'Soups & Sauces'],

  // Dairy
  [/\b(cheese|yoghurt|yogurt)\b/,                                            'Cheese & Yoghurt'],
  [/\b(milk|cream|breastmilk|colostrum)\b/,                                   'Milk & Cream'],

  // \begg\b never matches "eggplant" — the boundary requires a non-word char.
  [/\beggs?\b/,                                                              'Eggs'],

  // Fish & seafood
  [/\b(fish|fillet|tilapia|catfish|mackerel|shrimps?|prawns?|crabs?|clams?|lobster|oyster|cod|carp|anchovy|barracuda|snapper|sardine|herring|tuna|croaker|eel|squid|octopus|periwinkle|snails?|bonga|bayad|molluscs?|grouper|mullet|perch|mahi)\b/, 'Fish & Seafood'],

  // Edible insects — "locust bean" is deliberately NOT here, it is a legume.
  [/\b(ants?|crickets?|caterpillars?|termites?|grasshoppers?|larvae?|insects?|worms?|mopane)\b/, 'Insects & Other Protein'],

  // Meat & poultry
  [/\b(beef|goat|mutton|lamb|pork|chicken|turkey|duck|guinea fowl|meat|livers?|kidneys?|tripe|gizzards?|giblets?|camel|rabbit|bushmeat|offal|sausage|poultry)\b/, 'Meat & Poultry'],

  // Bambara groundnut is a pulse; plain groundnut is treated as a nut.
  [/\bbambara\b/,                                                            'Beans & Pulses'],
  [/\b(nuts?|seeds?|kernel|cashew|coconut|sesame|benniseed|groundnut|almond|walnut|cola)\b/, 'Nuts & Seeds'],
  [/\b(beans?|cowpeas?|peas?|lentils?|soya|soybean|pulse|dattock|afzelia)\b/, 'Beans & Pulses'],

  // Grains & starches
  [/\b(bread|cakes?|biscuits?|croissant|rolls?|pastry|doughnut)\b/,          'Bread & Baked Goods'],
  [/\b(macaroni|noodles?|spaghetti|pasta)\b/,                                'Pasta & Noodles'],
  [/\b(flour|dough|meal|semolina|starch|garri|gari)\b/,                      'Flours & Meals'],
  [/\b(yam|cassava|cocoyam|potato|potatoes|taro|tubers?|fufu|plantains?|fries)\b/, 'Roots & Tubers'],
  [/\b(rice|maize|millet|sorghum|wheat|fonio|teff|oats?|corn|cereal|porridge|couscous|barley)\b/, 'Cereals & Grains'],

  // Chilli reads as a spice; plain "pepper" stays a fruiting vegetable.
  [/\b(chilli|chili|cayenne|black pepper)\b/,                                'Spices'],
  [/\b(cinnamon|cumin|nutmeg|allspice|anis|cloves?|curry powder|spice|ginger|garlic|bay|mint|thyme|basil)\b/, 'Spices'],
  [/\b(salt|cube|mustard|jam|marmalade|honey|vinegar|seasoning|baking soda|sugar|yeast|potash|marmite)\b/, 'Condiments & Seasonings'],

  // Vegetables
  [/\b(leaves|leaf|leafy|amaranth|spinach|jute mallow|moringa|cabbage|lettuce|kale|hibiscus|parsley|celery)\b/, 'Leafy Greens'],
  [/\b(tomato|eggplant|peppers?|okra|okro|cucumber|pumpkin|courgette|squash|gourd|baobab)\b/, 'Fruiting Vegetables'],
  [/\b(carrots?|onions?|beet|radish|turnip)\b/,                              'Root Vegetables'],

  // Fruits last — the broadest bucket.
  [/\b(mango|banana|orange|lemon|lime|guava|pawpaw|papaya|pineapple|avocado|apple|grapes?|grapefruit|date|fig|jujube|melon|watermelon|tangerine|clementine|berry|plum|akee|fruits?)\b/, 'Fresh Fruits']
];

/** category -> the single group that owns it */
var GROUP_OF_CATEGORY = {};
Object.keys(PRODUCT_CATEGORIES).forEach(function (g) {
  PRODUCT_CATEGORIES[g].forEach(function (c) { GROUP_OF_CATEGORY[c] = g; });
});

function groupForCategory(category) {
  return GROUP_OF_CATEGORY[category] || null;
}

/** Reads a product category off a food name. Returns null when nothing fits. */
function inferProductCategory(text) {
  var hay = ' ' + String(text === null || text === undefined ? '' : text).toLowerCase() + ' ';
  for (var i = 0; i < CATEGORY_RULES.length; i++) {
    if (CATEGORY_RULES[i][0].test(hay)) {
      var c = CATEGORY_RULES[i][1];
      // "Date, dried" is a dried fruit, not a fresh one.
      if (c === 'Fresh Fruits' && /\bdried\b/.test(hay)) return 'Dried Fruits';
      return c;
    }
  }
  return null;
}

/**
 * Best group + category for a matched WAFCT food.
 * Prefers the name-derived category; falls back to the coarse WAFCT
 * bucket for the group when the name says nothing useful.
 */
function suggestTaxonomy(food) {
  if (!food) return { group: null, category: null };
  var category = inferProductCategory(food.name);
  if (category) return { group: groupForCategory(category), category: category };
  return mapWafctCategory(food.category);
}

/* ══════════════════════════════════════
   NORMALISE
══════════════════════════════════════ */

var PREP_WORDS = [
  'fresh', 'raw', 'dried', 'boiled', 'fried', 'roasted', 'chopped', 'diced',
  'sliced', 'minced', 'ground', 'peeled', 'frozen', 'mashed', 'shredded',
  'ripe', 'unripe', 'grated', 'crushed', 'whole', 'small', 'medium', 'large',
  'baby', 'and', 'or', 'a', 'an', 'the', 'of', 'choice', 'optional'
];

var PREP_SET = {};
PREP_WORDS.forEach(function (w) { PREP_SET[w] = true; });

/**
 * lowercase → drop parenthetical notes → drop punctuation → drop prep words.
 * "Boiled Yam (any kind)" → "yam"
 */
function normalize(name) {
  if (name === null || name === undefined) return '';
  return String(name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')     // parenthetical notes
    .replace(/[^a-z0-9]+/g, ' ')    // punctuation, hyphens, asterisks
    .split(' ')
    .filter(function (t) { return t && !PREP_SET[t]; })
    .join(' ')
    .trim();
}

/** Light clean used for alias lookup — keeps prep words, drops punctuation. */
function aliasKey(name) {
  return String(name === null || name === undefined ? '' : name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ══════════════════════════════════════
   ALIASES — local names → WAFCT vocabulary
══════════════════════════════════════ */

var ALIASES = {
  'egusi': 'melon seed',
  'egusi seed': 'melon seed',
  'crayfish': 'shrimp',
  'ewedu': 'jute mallow',
  'garden egg': 'eggplant',
  'garden eggs': 'eggplant',
  'iru': 'locust bean',
  'locust bean': 'african locust bean',
  'locust beans': 'african locust bean',
  'black eyed beans': 'cowpea',
  'black eyed bean': 'cowpea',
  'black eyed peas': 'cowpea',
  'black eyed pea': 'cowpea',
  'scotch bonnet': 'chilli pepper',
  'scotch bonnet pepper': 'chilli pepper',
  'ugu': 'fluted pumpkin',
  'ogbono': 'bush mango',
  'tatashe': 'sweet pepper',
  'titus': 'mackerel',
  'panla': 'cod'
};

/**
 * Resolves an alias, tolerating leading/trailing prep words:
 * "Dried Crayfish" → "shrimp". Returns null when nothing matches.
 */
function resolveAlias(name) {
  var key = aliasKey(name);
  if (!key) return null;
  if (ALIASES[key]) return ALIASES[key];

  // Try again with prep words stripped ("dried crayfish" → "crayfish")
  var stripped = key.split(' ').filter(function (t) { return !PREP_SET[t]; }).join(' ');
  if (stripped && ALIASES[stripped]) return ALIASES[stripped];

  // Longest multi-word alias appearing inside the name
  var best = null;
  Object.keys(ALIASES).forEach(function (k) {
    if (k.indexOf(' ') === -1) return;                 // multi-word only, avoids false hits
    if ((' ' + key + ' ').indexOf(' ' + k + ' ') === -1) return;
    if (!best || k.length > best.length) best = k;
  });
  return best ? ALIASES[best] : null;
}

/* ══════════════════════════════════════
   SCORING
══════════════════════════════════════ */

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  var prev = [], i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    var cur = [i];
    for (j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

function uniq(arr) {
  var seen = {}, out = [];
  arr.forEach(function (x) { if (!seen[x]) { seen[x] = true; out.push(x); } });
  return out;
}

/** 0–100 similarity between two already-normalised strings. */
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 100;

  var maxLen = Math.max(a.length, b.length);
  var lev = 100 * (1 - levenshtein(a, b) / maxLen);

  var ta = uniq(a.split(' ')), tb = uniq(b.split(' '));
  var shared = ta.filter(function (t) { return tb.indexOf(t) !== -1; }).length;
  var token = 100 * shared / Math.max(ta.length, tb.length);

  // Every token of the shorter side present in the longer one
  // ("yam" in "yam tuber") — strong, but never beats an exact hit.
  var contain = 0;
  if (shared === Math.min(ta.length, tb.length) && shared > 0) {
    contain = 88 + 10 * (Math.min(ta.length, tb.length) / Math.max(ta.length, tb.length));
  }

  return Math.round(Math.max(lev, token, contain) * 100) / 100;
}

/* ══════════════════════════════════════
   CORE INDEX
══════════════════════════════════════ */

var indexCache = (typeof Map === 'function') ? new Map() : null;

/** Groups rows by `core` (the name before the first comma), keyed by normalised core. */
function buildIndex(dataset) {
  if (indexCache && indexCache.has(dataset)) return indexCache.get(dataset);

  var byCore = {};
  dataset.forEach(function (row) {
    var core = row.core || String(row.name || '').split(',')[0];
    var key = normalize(core);
    if (!key) return;
    if (!byCore[key]) byCore[key] = [];
    byCore[key].push(row);
  });

  var index = { byCore: byCore, keys: Object.keys(byCore) };
  if (indexCache) indexCache.set(dataset, index);
  return index;
}

/* ══════════════════════════════════════
   ROW SELECTION WITHIN A MATCHED CORE
══════════════════════════════════════ */

// Specific processing states. If the user names one, only that one will do.
var PROCESSING_WORDS = ['boiled', 'fried', 'roasted', 'steamed', 'smoked', 'dried'];

function mentions(haystack, word) {
  return new RegExp('\\b' + word).test(haystack);
}

/** Prefer atomic values over "as part of a recipe" rows, then the shortest name. */
function preferShortest(rows) {
  var atomic = rows.filter(function (r) { return !/as part of a recipe/i.test(r.name); });
  var pool = atomic.length ? atomic : rows;
  return pool.slice().sort(function (a, b) { return a.name.length - b.name.length; })[0];
}

/**
 * Picks the WAFCT row that matches how the ingredient is actually prepared.
 *
 * A named processing state is honoured exactly — "Boiled Yam" must never
 * land on a *fried* yam record just because both are "cooked". If no row
 * carries that exact state, this falls back to the raw/default row rather
 * than to some other cooked variant.
 */
function pickRow(rows, rawInput) {
  if (rows.length === 1) return rows[0];
  var input = String(rawInput || '').toLowerCase();

  for (var i = 0; i < PROCESSING_WORDS.length; i++) {
    var word = PROCESSING_WORDS[i];
    if (!mentions(input, word)) continue;
    var exact = rows.filter(function (r) { return mentions(r.name.toLowerCase(), word); });
    if (exact.length) return preferShortest(exact);
    break; // named state, none available → fall through to raw. Never another cooked row.
  }

  var rawRows = rows.filter(function (r) { return /,\s*raw\b/i.test(r.name); });
  if (rawRows.length) return preferShortest(rawRows);

  return preferShortest(rows);
}

/* ══════════════════════════════════════
   FIND MATCHES
══════════════════════════════════════ */

var MATCHED_THRESHOLD = 88;
var REVIEW_THRESHOLD = 70;

function confidenceFor(score) {
  if (score >= MATCHED_THRESHOLD) return 'matched';
  if (score >= REVIEW_THRESHOLD) return 'review';
  return 'no_match';
}

/**
 * @returns {Array<{food, score, confidence, alias}>} up to 3, best first.
 */
function findMatches(ingredientName, dataset) {
  dataset = dataset || WAFCT_DATA;
  if (!ingredientName || !String(ingredientName).trim() || !dataset.length) return [];

  var alias = resolveAlias(ingredientName);
  var query = normalize(alias || ingredientName);
  if (!query) return [];

  var index = buildIndex(dataset);

  var scored = index.keys.map(function (key) {
    return { key: key, score: similarity(query, key) };
  });

  scored.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.key.length - b.key.length;   // stable: prefer the tighter core
  });

  return scored.slice(0, 3).map(function (s) {
    return {
      food: pickRow(index.byCore[s.key], ingredientName),
      score: s.score,
      confidence: confidenceFor(s.score),
      alias: alias || null
    };
  });
}

export {
  normalize,
  findMatches,
  resolveAlias,
  similarity,
  mapWafctCategory,
  suggestTaxonomy,
  inferProductCategory,
  groupForCategory,
  PRODUCT_GROUPS,
  PRODUCT_CATEGORIES,
  UNITS,
  ALIASES,
  PREP_WORDS,
  CATEGORY_RULES,
  WAFCT_CATEGORY_MAP,
  MATCHED_THRESHOLD,
  REVIEW_THRESHOLD,
  WAFCT_DATA,
};
