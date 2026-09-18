import { useState } from 'react';
import { Badge, Field, Input, Select, cx } from '../../components/ui.jsx';
import { IconWarning } from '../../components/icons.jsx';
import { RowButtons, UNITS } from './formParts.jsx';
import NutritionDbSearch, { SourceTag } from '../nutrition/NutritionDbSearch.jsx';
import { MASS_UNITS } from '../../lib/mealNutrition.js';

const BLANK = { name: '', description: '', quantity: '', unit: '' };

/* The optional nutrition fields on ingredients_list. `nutrition_name` and
   `nutrition_source` are display-only: the row stores the id, and these
   just save a lookup to show what it points at. */
const clearedLink = {
  ingredient_nutrition: undefined,
  nutrition_quantity: undefined,
  nutrition_unit: undefined,
  nutrition_name: undefined,
  nutrition_source: undefined,
};

/** Why this row cannot be counted, or null when it can. */
function exclusionReason(row) {
  if (!String(row.ingredient_nutrition || '').trim()) return 'Not counted — no nutrition link';
  const q = String(row.nutrition_quantity ?? '').trim();
  const unit = String(row.nutrition_unit || '').trim().toLowerCase();
  if (!q) return 'Not counted — no quantity';
  if (!Number.isFinite(Number(q)) || Number(q) <= 0) return 'Not counted — quantity must be a number above zero';
  if (!unit) return 'Not counted — no unit';
  if (!MASS_UNITS.includes(unit)) return `Not counted — ${row.nutrition_unit} is not a mass unit`;
  return null;
}

/**
 * Structured ingredient rows: name, prep note, quantity, unit.
 *
 * Keeping the prep note in its own field is what stops "1 medium-sized
 * onion, sliced" being torn into two ingredients further down the line.
 *
 * Each row can also carry an optional nutrition link — a record from the
 * platform's food composition data, with its own mass quantity. That pair
 * is deliberately separate from the recipe's `quantity`/`unit`: a cook
 * reads "2 cups", while the calculation needs grams, and forcing one to
 * serve both would either wreck the recipe text or the arithmetic.
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

  const link = (i, rec) => {
    setAt(i, {
      ingredient_nutrition: String(rec._id),
      nutrition_name: rec.name,
      nutrition_source: rec.source,
      // Default the unit but never the amount: a quantity nobody typed
      // would be a number this meal was not measured with.
      nutrition_unit: items[i].nutrition_unit || 'g',
    });
    setLinking(null);
  };

  if (!items.length) {
    return (
      <button type="button" onClick={() => onChange([{ ...BLANK }])}
        className="w-full cursor-pointer rounded-xl border border-dashed border-line py-5 text-[13px] text-ink-3 transition hover:border-mint hover:text-forest">
        + Add the first ingredient
      </button>
    );
  }

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
              <Field label={i === 0 ? 'Qty' : undefined}>
                <Input value={row.quantity} placeholder="2"
                  onChange={(e) => setAt(i, { quantity: e.target.value })} />
              </Field>
              <Field label={i === 0 ? 'Unit' : undefined}>
                <Select value={row.unit} onChange={(e) => setAt(i, { unit: e.target.value })}>
                  <option value="">Select unit</option>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
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
                  <div className="flex items-end gap-2">
                    <Field label="Amount" hint="counted">
                      <Input
                        type="number" step="any" min="0" placeholder="300"
                        className="w-28 px-2.5 py-2 text-[12.5px]"
                        value={row.nutrition_quantity ?? ''}
                        onChange={(e) => setAt(i, { nutrition_quantity: e.target.value })}
                      />
                    </Field>
                    <Field label="Unit">
                      <Select
                        className="w-24 px-2.5 py-2 text-[12.5px]"
                        value={String(row.nutrition_unit || '').toLowerCase()}
                        onChange={(e) => setAt(i, { nutrition_unit: e.target.value })}
                      >
                        <option value="">—</option>
                        {MASS_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        {/* A unit from data outside the four stays visible rather than
                            being silently swapped for one that would change the sum. */}
                        {row.nutrition_unit && !MASS_UNITS.includes(String(row.nutrition_unit).toLowerCase()) && (
                          <option value={row.nutrition_unit}>{row.nutrition_unit} (not counted)</option>
                        )}
                      </Select>
                    </Field>
                  </div>
                </div>
              ) : linking !== i ? (
                <button type="button" onClick={() => setLinking(i)}
                  className="cursor-pointer text-[12px] font-medium text-ocean-deep underline-offset-2 hover:underline">
                  + Link nutrition data
                </button>
              ) : null}

              {linking === i && (
                <NutritionDbSearch
                  initialQuery={row.name}
                  pickLabel="Link"
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
    </div>
  );
}
