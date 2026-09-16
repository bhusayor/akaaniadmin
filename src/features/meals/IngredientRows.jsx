import { useState } from 'react';
import { Field, Input, Select } from '../../components/ui.jsx';
import { RowButtons, UNITS } from './formParts.jsx';
import NutritionDbSearch, { SourceTag } from '../nutrition/NutritionDbSearch.jsx';

const BLANK = { name: '', description: '', quantity: '', unit: '' };

/**
 * Structured ingredient rows: name, prep note, quantity, unit.
 *
 * Keeping the prep note in its own field is what stops "1 medium-sized
 * onion, sliced" being torn into two ingredients further down the line.
 *
 * A row can also be linked to a platform nutrition record (nutritionId,
 * nutritionName, nutritionSource), which is what the meal nutrition
 * calculator totals up.
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
    setAt(i, { nutritionId: String(rec._id), nutritionName: rec.name, nutritionSource: rec.source });
    setLinking(null);
  };
  const unlink = (i) => setAt(i, { nutritionId: undefined, nutritionName: undefined, nutritionSource: undefined });

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
      {items.map((row, i) => (
        <div key={i} className="rounded-xl border border-line-light bg-surface-2 p-3">
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
          {linking === i && (
            <NutritionDbSearch
              initialQuery={row.name}
              pickLabel="Link"
              onPick={(rec) => link(i, rec)}
              onClose={() => setLinking(null)}
            />
          )}
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            {row.nutritionId ? (
              <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11.5px] text-ink-2">
                <span className="text-ink-3">Nutrition:</span>
                <span className="font-medium">{row.nutritionName || row.nutritionId}</span>
                {row.nutritionSource && <SourceTag source={row.nutritionSource} />}
                <button type="button" onClick={() => setLinking(i)}
                  className="cursor-pointer text-ink-3 underline-offset-2 hover:text-forest hover:underline">change</button>
                <button type="button" onClick={() => unlink(i)}
                  className="cursor-pointer text-ink-3 underline-offset-2 hover:text-chili hover:underline">unlink</button>
              </span>
            ) : linking !== i ? (
              <button type="button" onClick={() => setLinking(i)}
                className="cursor-pointer text-[11.5px] font-medium text-ocean-deep underline-offset-2 hover:underline">
                + Link nutrition data
              </button>
            ) : <span />}
            <RowButtons onDelete={() => removeAt(i)} onAdd={() => addAt(i)}
              disableDelete={items.length === 1} />
          </div>
        </div>
      ))}
    </div>
  );
}
