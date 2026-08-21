# Reference data

The ingredient form matches typed names against two measured references,
merged in `src/lib/foodDatabase.js`. Both are per 100g.

| Set | Rows | Covers | Generated file |
|---|---|---|---|
| FAO/INFOODS WAFCT 2019 | 960 | West African foods | `src/lib/wafctData.js` |
| USDA FoodData Central — Foundation Foods | 174 | Global staples | `src/lib/usdaData.js` |

`usda-foundation-foods.csv` is the source file the USDA set was built from,
kept so the generated module can be rebuilt and diffed.

## What was changed on import

**The allergen column was discarded and re-derived.** As supplied it had
been produced by substring-matching food names, and was wrong in both
directions:

- 15 naturally gluten-free foods tagged `Gluten` — cassava, rice, quinoa,
  corn, coconut, potato, sorghum, buckwheat, amaranth, almond and chestnut
  flours among them.
- 7 plant foods tagged `Dairy`, matching on "butter" or "milk" in the
  name — including butternut squash.
- `Eggplant, raw` tagged `Eggs`.
- Brazil nuts, macadamias, pine nuts and Alaska pollock carried no tag at
  all. False negatives are the dangerous direction.

They are now derived by `src/lib/allergens.js`, which tests exclusions
before inclusions and matches on word boundaries. See its tests for the
specific cases.

**Three fibre figures were dropped to null.** The raw potato rows reported
13.8–14.9 g/100g where references put it near 2. The true value is not
recoverable from the file, so it is absent rather than wrong.

**Six duplicate names were collapsed**, keeping the first of each. They
were the same food under two USDA ids with figures a rounding apart; two
equally good rows give the matcher no way to choose.

Only rows with a complete macro set were imported. `usda_ingredients_import_ready.csv`
carries a further 224 rows with gaps, which are not loaded — a missing
nutrient must stay missing rather than become 0.
