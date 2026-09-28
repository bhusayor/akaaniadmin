"""Builds src/data/nutritionData.js — the WAFCT and USDA food composition
data the admin searches, lists and calculates meals against.

    python3 -m pip install openpyxl
    python3 scripts/build_nutrition_data.py

Reads, from the repo root:

- Akaani_West_African_Nutrition_Data_Model.xlsm   WAFCT 2019, via the Akaani
  data model: one record per food variant (1,028), with its food, food
  group and per-100g figures from the Nutrition sheet.
- FoodData_Central_foundation_food_json_*.json    USDA Foundation Foods: one
  record per food (363).

Every record has the same shape (the one GET /v1/nutrition/ingredients
used), and all figures are per 100 g of edible portion. A nutrient the
source did not publish is null, never 0.
"""

import glob
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
WORKBOOK = ROOT / 'Akaani_West_African_Nutrition_Data_Model.xlsm'
OUT = ROOT / 'src' / 'data' / 'nutritionData.js'

NUTRIENTS = ['calories', 'protein', 'carbohydrate', 'fat', 'fiber']


def sheet(wb, name):
    rows = [r for r in wb[name].iter_rows(values_only=True) if r and r[0] is not None]
    return [dict(zip(rows[0], r)) for r in rows[1:]]


def as_id(v):
    return int(v) if v is not None else None


def clean(v):
    return str(v).strip() if v is not None else ''


def num(v):
    if v is None or v == '':
        return None
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None


def wafct_records():
    wb = openpyxl.load_workbook(WORKBOOK, data_only=True)

    groups = {as_id(g['food_group_id']): g for g in sheet(wb, 'Food Groups')}
    foods = {as_id(f['food_id']): f for f in sheet(wb, 'Foods')}
    nutrition = {as_id(n['food_variant_id']): n for n in sheet(wb, 'Nutrition')}
    evidence = {as_id(e['food_variant_id']): e for e in sheet(wb, 'Source Evidence')}

    raw_cols = {
        'calories': 'source_energy_kcal_raw',
        'protein': 'source_protein_raw',
        'carbohydrate': 'source_carbohydrate_raw',
        'fat': 'source_fat_raw',
        'fiber': 'source_fiber_raw',
    }

    records = []
    for v in sheet(wb, 'Food Variants'):
        vid = as_id(v['food_variant_id'])
        food = foods[as_id(v['food_id'])]
        group = groups[as_id(food['food_group_id'])]
        n = nutrition.get(vid, {})
        e = evidence.get(vid, {})
        # WAFCT brackets a lower-quality figure: "[3.0]".
        estimated = [k for k, col in raw_cols.items() if re.match(r'^\s*\[', clean(e.get(col)))]
        records.append({
            '_id': f'wafct-{vid}',
            'name': clean(v['variant_name_en']),
            'name_fr': clean(v['variant_name_fr']),
            'source': 'wafct',
            'food_id': as_id(v['food_id']),
            'food_name': clean(food['food_name_en']),
            'food_variant_id': vid,
            'external_id': clean(v['source_food_id']),
            'food_group_code': group['food_group_code'],
            'product_group': clean(group['food_group_name_en']),
            'local_names': [s.strip() for s in clean(food['local_names']).split(';') if s.strip()],
            'nutrients_per_100g': {
                'calories': num(n.get('energy_kcal_per_100g')),
                'protein': num(n.get('protein_g_per_100g')),
                'carbohydrate': num(n.get('carbohydrate_g_per_100g')),
                'fat': num(n.get('fat_g_per_100g')),
                'fiber': num(n.get('fiber_g_per_100g')),
            },
            'estimated_nutrients': estimated,
            'quality_status': clean(n.get('quality_status')),
        })
    return records


# FoodData Central nutrient numbers, most preferred first. Foundation Foods
# publish energy three ways; plain kcal (208) where it exists, else the
# Atwater specific (958) then general (957) factors.
USDA_NUMBERS = {
    'calories': ['208', '958', '957'],
    'protein': ['203'],
    'carbohydrate': ['205', '205.2'],
    'fat': ['204'],
    'fiber': ['291', '293'],
}


def usda_records():
    paths = sorted(glob.glob(str(ROOT / 'FoodData_Central_foundation_food_json_*.json')))
    if not paths:
        sys.exit('No FoodData_Central_foundation_food_json_*.json at the repo root')
    data = json.load(open(paths[-1], encoding='utf-8'))
    records = []
    for f in data['FoundationFoods']:
        if not f:  # the export carries null entries
            continue
        amounts = {}
        for fn in f.get('foodNutrients') or []:
            nu = (fn or {}).get('nutrient') or {}
            if fn.get('amount') is not None:
                amounts.setdefault(nu.get('number'), fn['amount'])
        per100 = {}
        for key, numbers in USDA_NUMBERS.items():
            per100[key] = next((num(amounts[n]) for n in numbers if n in amounts), None)
        records.append({
            '_id': f"usda-{f['fdcId']}",
            'name': clean(f['description']),
            'name_fr': '',
            'source': 'usda',
            'food_id': None,
            'food_name': '',
            'external_id': str(f['fdcId']),
            'ndb_number': str(f.get('ndbNumber') or ''),
            'food_group_code': None,
            'product_group': clean((f.get('foodCategory') or {}).get('description')),
            'local_names': [],
            'nutrients_per_100g': per100,
            'estimated_nutrients': [],
        })
    return records, Path(paths[-1]).name


def main():
    wafct = wafct_records()
    usda, usda_file = usda_records()
    records = wafct + usda
    ids = [r['_id'] for r in records]
    if len(ids) != len(set(ids)):
        sys.exit('Duplicate record ids')

    body = ',\n'.join(json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in records)
    OUT.write_text(f"""/* ═══════════════════════════════════════════════════════
   NUTRITION DATA — WAFCT + USDA, per 100 g edible portion

   Generated by scripts/build_nutrition_data.py. Do not hand-edit.
     WAFCT: {WORKBOOK.name} ({len(wafct)} variants)
     USDA:  {usda_file} ({len(usda)} foods)

   A nutrient the source did not publish is null, never 0.
   ═══════════════════════════════════════════════════════ */

export default [
{body}
];
""", encoding='utf-8')
    print(f'Wrote {OUT.relative_to(ROOT)}: {len(wafct)} WAFCT + {len(usda)} USDA = {len(records)} records')


if __name__ == '__main__':
    main()
