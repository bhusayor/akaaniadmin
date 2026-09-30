import { useState } from 'react';
import { Badge, Field, Input, Select, cx } from '../../components/ui.jsx';
import { IconWarning } from '../../components/icons.jsx';
import { RowButtons, UNITS } from './formParts.jsx';
import NutritionPicker from '../nutrition/NutritionPicker.jsx';
import { SourceTag } from '../nutrition/parts.jsx';
import { buildCalculateLines, MASS_UNITS, normaliseUnit } from '../../lib/mealNutrition.js';
import { preparationName } from '../../lib/nutritionGroups.js';

const BLANK = { name: '', description: '', quantity: '', unit: '' };

/* The nutrition link on ingredients_list. `nutrition_name` and
   `nutrition_source` are display-only: the row stores the id, and these
   just save a lookup to show what it points at. */
const clearedLink = {
  ingredient_nutrition: undefined,
  nutrition_name: undefined,
  nutrition_source: undefined,
};

/* Weighable units first: those are the ones the calculation can count. */
const OTHER_UNITS = UNITS.filter((u) => !MASS_UNITS.includes(u));

/** Why this row cannot be counted, or null when it can — the same rule the total uses. */
function exclusionReason(row) {
  const { skipped } = buildCalculateLines([row]);
  return skipped.length ? `Not counted — ${skipped[0].reason}` : null;
}

/**
 * Structured ingredient rows: name, prep note, quantity, unit.
 *
 * Keeping the prep note in its own field is what stops "1 medium-sized
 * onion, sliced" being torn into two ingredients further down the line.
 *
 * Each row picked from the ingredient database (WAFCT + USDA) is linked to
 * its record, and its Qty and Unit are what the calculation counts. The
 * rows are the WHOLE MEAL; the meal's servings divide the total.
 * Only g, kg, oz and lb can be weighed — a row in cups is kept for the
 * cook but marked as not counted.
 *
 * New ingredients start from a search of that data (WAFCT + USDA): picking
 * a preparation adds a row already named and linked. A row with no data
 * behind it can still be added by hand, and is marked as not counted.
 */
export default function IngredientRows({ items, onChange }) {
  /* Index of the row whose nutrition search is open. Closed whenever rows
     are added or removed, since indexes shift. */
  const [linking, setLinking] = useState(null);

  const setAt = (i, patch) => onChange(items.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const addAt = (i) => {
    setLinking(null);
    onChange([...items.slice(0, i + 1), { ...BLANK }, ...items.slice(i + 1)]);
  };
  const removeAt = (i) => {
    setLinking(null);
    onChange(items.filter((_, n) => n !== i));
  };

  /* The food's name for the cook ("Fonio"), the preparation as the note
     ("white, whole grains, raw"), and the record itself as the link. */
  const fromRecord = (rec, group) => {
    const prep = preparationName(rec, group);
    return {
      ...BLANK,
      name: group?.label || rec.name,
      description: prep === rec.name ? '' : prep,
      ingredient_nutrition: String(rec._id),
      nutrition_name: rec.name,
      nutrition_source: rec.source,
      unit: 'g',
    };
  };
  const addFromSearch = (rec, group) => {
    setLinking(null);
    onChange([...items.filter((x) => String(x.name || '').trim() || x.ingredient_nutrition), fromRecord(rec, group)]);
  };
  const addBlank = () => {
    setLinking(null);
    onChange([...items, { ...BLANK }]);
  };

  const link = (i, rec) => {
    setAt(i, {
      ingredient_nutrition: String(rec._id),
      nutrition_name: rec.name,
      nutrition_source: rec.source,
      // Default the unit but never the quantity: a quantity nobody typed
      // would be a number this meal was not measured with.
      unit: items[i].unit || 'g',
    });
    setLinking(null);
  };

  const addPanel = (
    <div>
      <NutritionPicker
        title={items.length ? 'Add another ingredient · WAFCT & USDA' : 'Add the first ingredient · WAFCT & USDA'}
        autoFocus={false}
        onPick={addFromSearch}
        className="mt-0"
      />
      <button type="button" onClick={addBlank}
        className="mt-1.5 cursor-pointer text-[11.5px] text-ink-3 underline-offset-2 hover:text-forest hover:underline">
        Not in the database? Add it by hand
      </button>
    </div>
  );

  if (!items.length) return addPanel;

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((row, i) => {
        const linked = Boolean(String(row.ingredient_nutrition || '').trim());
        const reason = exclusionReason(row);
        const blank = !String(row.name || '').trim() && !linked;

        return (
          <div key={i} className={cx('rounded-xl border p-3',
            reason && !blank ? 'border-amber/50 bg-amber-light/25' : 'border-line-light bg-surface-2')}>
            <div className="grid grid-cols-[1fr_1fr_90px_120px] gap-2 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <Field label={i === 0 ? 'Ingredient' : undefined}>
                <Input value={row.name} placeholder="Black eyed peas"
                  onChange={(e) => setAt(i, { name: e.target.value })} />
              </Field>
              <Field label={i === 0 ? 'Preparation' : undefined}>
                <Input value={row.description} placeholder="soaked and skins removed"
                  onChange={(e) => setAt(i, { description: e.target.value })} />
              </Field>
              <Field label={i === 0 ? 'Qty' : undefined} hint={i === 0 ? 'whole meal' : undefined}>
                <Input value={row.quantity} placeholder={linked ? '100' : '2'} inputMode="decimal"
                  onChange={(e) => setAt(i, { quantity: e.target.value })} />
              </Field>
              <Field label={i === 0 ? 'Unit' : undefined}>
                <Select value={row.unit} onChange={(e) => setAt(i, { unit: e.target.value })}>
                  <option value="">Select unit</option>
                  <optgroup label="Counted in nutrition">
                    {MASS_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </optgroup>
                  <optgroup label="Not counted">
                    {OTHER_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    {/* A unit from older data stays visible rather than being
                        silently swapped for one that would change the sum. */}
                    {row.unit && !UNITS.includes(row.unit) && !MASS_UNITS.includes(normaliseUnit(row.unit)) && (
                      <option value={row.unit}>{row.unit}</option>
                    )}
                  </optgroup>
                  {row.unit && !UNITS.includes(row.unit) && MASS_UNITS.includes(normaliseUnit(row.unit)) && (
                    <option value={row.unit}>{row.unit}</option>
                  )}
                </Select>
              </Field>
            </div>

            {/* ── Nutrition link ── */}
            <div className="mt-2 rounded-lg border border-line-light bg-surface p-2.5">
              {linked ? (
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                      Nutrition data
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium text-ink">
                        {row.nutrition_name || row.ingredient_nutrition}
                      </span>
                      {row.nutrition_source && <SourceTag source={row.nutrition_source} />}
                      <button type="button" onClick={() => setLinking(i)}
                        className="cursor-pointer text-[11px] text-ink-3 underline-offset-2 hover:text-forest hover:underline">
                        change
                      </button>
                      <button type="button" onClick={() => setAt(i, clearedLink)}
                        className="cursor-pointer text-[11px] text-ink-3 underline-offset-2 hover:text-chili hover:underline">
                        unlink
                      </button>
                    </div>
                  </div>
                </div>
              ) : linking !== i ? (
                <button type="button" onClick={() => setLinking(i)}
                  className="cursor-pointer text-[12px] font-medium text-ocean-deep underline-offset-2 hover:underline">
                  + Find in the ingredient database
                </button>
              ) : null}

              {linking === i && (
                <NutritionPicker
                  initialQuery={row.name}
                  onPick={(rec) => link(i, rec)}
                  onClose={() => setLinking(null)}
                />
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              {reason && !blank ? (
                <Badge tone="amber" className="gap-1"><IconWarning size={10} /> {reason}</Badge>
              ) : <span />}
              <RowButtons onDelete={() => removeAt(i)} onAdd={() => addAt(i)}
                disableDelete={items.length === 1} />
            </div>
          </div>
        );
      })}
      {addPanel}
    </div>
  );
}
