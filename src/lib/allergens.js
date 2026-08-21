/* ═══════════════════════════════════════════════════════
   ALLERGENS

   Derived from a food's name, but not by substring matching — that is how
   the imported USDA column came to say cassava flour contains gluten,
   butternut squash contains dairy and eggplant contains eggs, while
   leaving brazil nuts, macadamias and Alaska pollock unflagged.

   Two rules make the difference:

     · exclusions are tested before inclusions, so "butternut" never
       reaches the "butter" rule and "oyster mushroom" never reaches the
       mollusc one;
     · patterns match on word boundaries, so "egg" does not fire inside
       "eggplant".

   A false negative here is the dangerous direction. Where a food is
   genuinely contested the note is recorded against the rule rather than
   guessed at.
   ═══════════════════════════════════════════════════════ */

/** The tags this module can produce, in the order they are displayed. */
export const ALLERGENS = [
  'Gluten', 'Dairy', 'Eggs', 'Tree nuts', 'Peanuts', 'Soy', 'Sesame',
  'Fish', 'Crustaceans', 'Molluscs',
];

const rule = (tag, include, exclude = []) => ({ tag, include, exclude });

const RULES = [
  /* Cereals containing gluten, per the EU Annex II list — which includes
     oats, even though pure oats are gluten-free, because the supply chain
     is shared. Buckwheat, quinoa, amaranth, sorghum, millet, teff, fonio,
     rice, maize and cassava are not on it and must not be flagged. */
  rule('Gluten',
    [/\bwheat\b/, /\bwheats\b/, /\bbarley\b/, /\brye\b/, /\bspelt\b/, /\bkhorasan\b/,
     /\bkamut\b/, /\beinkorn\b/, /\bfarro\b/, /\bemmer\b/, /\bsemolina\b/, /\bbulgur\b/,
     /\bdurum\b/, /\btriticale\b/, /\bcouscous\b/, /\bseitan\b/, /\bmalt\b/,
     /\boat\b/, /\boats\b/, /\boatmeal\b/, /\bbread\b/, /\bflour, 00\b/,
     /\bcookies?\b/, /\bpasta\b/, /\bnoodles?\b/],
    [/gluten[- ]free/, /\bbuckwheat\b/]),

  rule('Dairy',
    [/\bmilk\b/, /\bcream\b/, /\bbutter\b/, /\bcheese\b/, /\byogh?urt\b/,
     /\bwhey\b/, /\bcasein\b/, /\bghee\b/, /\bkefir\b/, /\bcustard\b/],
    /* Nut and seed butters, plant milks, and a squash that merely rhymes. */
    [/\bbutternut\b/, /\balmond butter\b/, /\bpeanut butter\b/, /\bsesame butter\b/,
     /\bcashew butter\b/, /\bsunflower butter\b/, /\bcocoa butter\b/, /\bshea butter\b/,
     /\bsoy milk\b/, /\bsoya milk\b/, /\bcoconut milk\b/, /\boat milk\b/,
     /\brice milk\b/, /\balmond milk\b/, /\bnut butter\b/, /\bseed butter\b/,
     /\bmilk thistle\b/, /\bdairy[- ]free\b/]),

  /* `\beggs?\b` and not `egg` — "eggplant" is a vegetable. */
  rule('Eggs',
    [/\beggs?\b/, /\balbumen\b/, /\bmayonnaise\b/, /\bmeringue\b/],
    [/\beggplant\b/, /\bgarden egg\b/, /\begg[- ]free\b/]),

  /* Coconut is a tree nut under US FALCPA but not under EU/UK rules. It is
     an everyday West African ingredient, so flagging it would bury the
     real warnings in noise. Left off, deliberately. */
  rule('Tree nuts',
    [/\balmonds?\b/, /\bbrazil ?nuts?\b/, /\bbrazilnuts?\b/, /\bcashews?\b/,
     /\bchestnuts?\b/, /\bhazelnuts?\b/, /\bfilberts?\b/, /\bmacadamias?\b/,
     /\bpecans?\b/, /\bpine ?nuts?\b/, /\bpistachios?\b/, /\bwalnuts?\b/,
     /\bpraline\b/, /\bmarzipan\b/],
    [/\bwater chestnuts?\b/, /\bnut[- ]free\b/]),

  /* A legume, not a tree nut, and a separate major allergen — someone may
     react to one and not the other. */
  rule('Peanuts',
    [/\bpeanuts?\b/, /\bgroundnuts?\b/, /\barachis\b/],
    []),

  rule('Soy',
    [/\bsoy\b/, /\bsoya\b/, /\bsoybeans?\b/, /\btofu\b/, /\bedamame\b/,
     /\btempeh\b/, /\bmiso\b/],
    [/\bsoy[- ]free\b/]),

  rule('Sesame',
    [/\bsesame\b/, /\btahini\b/, /\bbeniseed\b/, /\bbenne\b/],
    []),

  rule('Fish',
    [/\bfish\b/, /\bpollock\b/, /\btilapia\b/, /\bsalmon\b/, /\btuna\b/,
     /\bmackerel\b/, /\bsardines?\b/, /\banchov(y|ies)\b/, /\bcod\b/,
     /\bcatfish\b/, /\bherring\b/, /\btrout\b/, /\bstockfish\b/],
    [/\bshellfish\b/, /\bfish[- ]free\b/]),

  rule('Crustaceans',
    [/\bshrimps?\b/, /\bprawns?\b/, /\bcrabs?\b/, /\blobsters?\b/,
     /\bcrayfish\b/, /\bcrawfish\b/, /\bkrill\b/],
    []),

  /* "Oyster mushroom" and "oyster sauce" are not molluscs and a fish, in
     that order — the first is a fungus, the second is why the exclusion
     list matters more than the include list. */
  rule('Molluscs',
    [/\boysters?\b/, /\bmussels?\b/, /\bclams?\b/, /\bscallops?\b/,
     /\bsquid\b/, /\bcalamari\b/, /\boctopus\b/, /\bsnails?\b/, /\bperiwinkles?\b/],
    [/\boyster mushrooms?\b/, /\bking oyster\b/, /\bmushroom, oyster\b/,
     /\bmushroom, king oyster\b/]),
];

/**
 * The allergens a food name implies.
 *
 * @param name  the food's name
 * @returns an array of tags from ALLERGENS, in display order
 */
export function allergensFor(name) {
  const text = String(name ?? '').toLowerCase();
  if (!text.trim()) return [];

  return RULES
    .filter(({ include, exclude }) => {
      if (exclude.some((re) => re.test(text))) return false;
      return include.some((re) => re.test(text));
    })
    .map((r) => r.tag);
}

/** `Gluten, Tree nuts` — the CSV and table cell form. */
export const formatAllergens = (tags) => (tags?.length ? tags.join(', ') : '');

/**
 * Whether a supplied tag list disagrees with what the name implies.
 * Used to audit imported data rather than trust it.
 */
export function allergenDiff(name, supplied) {
  const derived = new Set(allergensFor(name));
  const given = new Set(
    String(supplied ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  );
  return {
    /* Claimed by the source but not supported by the name. */
    falsePositives: [...given].filter((t) => !derived.has(t) && t !== 'Nuts'),
    /* Implied by the name but missing from the source — the dangerous half. */
    falseNegatives: [...derived].filter((t) => !given.has(t)),
  };
}
