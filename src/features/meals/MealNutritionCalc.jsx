import { useMemo, useState } from 'react';
import { Button, Spinner } from '../../components/ui.jsx';
import { IconInfo, IconWarning } from '../../components/icons.jsx';
import { MacroLine } from '../nutrition/NutritionDbSearch.jsx';
import { buildCalculateLines, calculateNutrition, CALC_UNITS } from '../../lib/api.js';

const NUTRIENT_LABEL = {
  calories: 'calories', protein: 'protein', carbohydrate: 'carbohydrate', fat: 'fat', fiber: 'fibre',
};

const toMacros = (t = {}) => ({
  calories: t.calories ?? null,
  protein_g: t.protein ?? null,
  carbs_g: t.carbohydrate ?? null,
  fat_g: t.fat ?? null,
  fibre_g: t.fiber ?? null,
});

const perServing = (m, servings) => Object.fromEntries(
  Object.entries(m).map(([k, v]) => [k, v === null ? null : v / servings]),
);

const round1 = (v) => Math.round(v * 10) / 10;

/**
 * Totals a meal's linked ingredient rows with POST /v1/nutrition/calculate
 * and offers to copy the result into the meal's calorie and macro fields.
 *
 * `onApply(patch)` gets only the fields the backend had data for — a
 * nutrient no ingredient published is left as it is, not set to 0.
 */
export default function MealNutritionCalc({ rows, servings, onApply }) {
  const { lines, skipped } = useMemo(() => buildCalculateLines(rows), [rows]);
  const linesKey = JSON.stringify(lines);
  const [state, setState] = useState({ status: 'idle' });

  const run = async () => {
    setState({ status: 'loading' });
    try {
      const data = await calculateNutrition(lines);
      setState({ status: 'done', data, key: linesKey, skipped });
    } catch (error) {
      setState({ status: 'error', error });
    }
  };

  const apply = () => {
    const t = state.data.totals;
    const patch = {};
    if (t.calories !== null) patch.cal = String(Math.round(t.calories));
    if (t.protein !== null) patch.prot = String(round1(t.protein));
    if (t.carbohydrate !== null) patch.carb = String(round1(t.carbohydrate));
    if (t.fat !== null) patch.fat = String(round1(t.fat));
    if (t.fiber !== null) patch.fiber = String(round1(t.fiber));
    onApply(patch);
  };

  const done = state.status === 'done';
  const stale = done && state.key !== linesKey;
  const macros = done ? toMacros(state.data.totals) : null;
  const servingCount = Number(servings);
  const completeness = done ? state.data.completeness : null;

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface-2 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-ink">Calculate from ingredients</div>
          <div className="text-[11.5px] text-ink-3">
            {lines.length} of {lines.length + skipped.length} ingredient{lines.length + skipped.length === 1 ? '' : 's'} ready
            {' '}· link rows below and use {CALC_UNITS.join(', ')}
          </div>
        </div>
        <Button type="button" variant="ghost" onClick={run} disabled={!lines.length || state.status === 'loading'}>
          {state.status === 'loading' ? <><Spinner /> Calculating…</> : done ? 'Recalculate' : 'Calculate'}
        </Button>
      </div>

      {skipped.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-0.5 text-[11.5px] text-amber-deep">
          {skipped.map((s) => (
            <li key={s.index} className="flex gap-1.5">
              <span className="mt-0.5 shrink-0"><IconWarning size={12} /></span>
              <span><b className="font-semibold">{s.name}</b> — {s.reason}; left out of the total</span>
            </li>
          ))}
        </ul>
      )}

      {state.status === 'error' && (
        <div role="alert" className="mt-2.5 text-[12px] font-medium text-chili">{state.error.message}</div>
      )}

      {done && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Recipe total{stale && <span className="ml-1.5 normal-case tracking-normal text-amber-deep">· ingredients changed — recalculate</span>}
          </div>
          <MacroLine macros={macros} className="mt-1 text-[12.5px]" />
          {servingCount > 0 && (
            <div className="mt-1.5 text-[11px] text-ink-3">
              Per serving ({servingCount}):
              <MacroLine macros={perServing(macros, servingCount)} className="mt-0.5" />
            </div>
          )}

          {!completeness.complete && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-light px-2.5 py-1.5 text-[11.5px] text-amber-deep">
              <span className="mt-0.5 shrink-0"><IconWarning size={12} /></span>
              <span>
                Incomplete:{' '}
                {completeness.incomplete_nutrients.map((n) => {
                  const who = (completeness.missing_by_nutrient[n] || []).map((m) => m.name).join(', ');
                  return `${NUTRIENT_LABEL[n] || n}${who ? ` (no data for ${who})` : ''}`;
                }).join('; ')}. Those totals are short and a total with no data at all is left blank.
              </span>
            </div>
          )}

          <details className="mt-2 text-[11.5px] text-ink-2">
            <summary className="cursor-pointer text-ink-3">Breakdown</summary>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {state.data.breakdown.map((b, i) => (
                <li key={`${b.ingredient_id}-${i}`}>
                  <span className="font-medium">{b.name}</span>
                  <span className="text-ink-3"> · {b.quantity} {b.unit} ({b.grams} g)</span>
                  <MacroLine macros={toMacros(b.nutrients)} />
                </li>
              ))}
            </ul>
          </details>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={apply} disabled={stale}>Apply to meal</Button>
            <span className="flex items-center gap-1 text-[11px] text-ink-3">
              <IconInfo /> Fills Total calories, Fat, Carbohydrate, Protein and Fibre with the recipe total.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
