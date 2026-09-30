import { cx } from '../../components/ui.jsx';
import { IconInfo, IconWarning } from '../../components/icons.jsx';
import {
  macroField, NUTRIENTS, perServingOf, readNutrient, servingCount, suggestServings, totalField,
  TARGET_KCAL_PER_SERVING, unavailableLabel,
} from '../../lib/mealNutrition.js';

const stepBtn = 'grid size-8 cursor-pointer place-items-center rounded-md border border-line bg-surface text-[15px] '
  + 'font-semibold text-ink-2 transition hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-40';

/** A − value + control. */
function Stepper({ label, onDown, onUp, downDisabled, upDisabled, downLabel, upLabel, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={stepBtn} aria-label={downLabel} title={downLabel}
          disabled={downDisabled} onClick={onDown}>−</button>
        {children}
        <button type="button" className={stepBtn} aria-label={upLabel} title={upLabel}
          disabled={upDisabled} onClick={onUp}>+</button>
      </div>
      {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
    </div>
  );
}

/** One cell of the table: a figure, "unavailable" (never 0), a saved value or a dash. */
function Cell({ state, label, strong }) {
  const tone = {
    calculated: strong ? 'font-semibold text-ink' : 'text-ink',
    unavailable: 'text-amber-deep',
    saved: 'text-ink-2',
    empty: 'text-ink-3',
  }[state.state];
  return (
    <td className={cx('px-3 py-2 text-right text-[13px] tabular-nums', tone)}
      title={state.state === 'unavailable' ? unavailableLabel(label, state.missingFor) : undefined}>
      <span className="inline-flex items-center gap-1">
        {state.state === 'unavailable' && <IconWarning size={11} />}
        {state.text}
      </span>
    </td>
  );
}

/**
 * Servings and the meal's macronutrients.
 *
 * The ingredients are the WHOLE MEAL, so `totals` (POST
 * /v1/nutrition/calculate) is the whole meal's nutrition, or null while
 * nothing is linked — in which case the meal's saved figures are shown,
 * labelled as saved.
 *
 * The meal is then divided into servings. A number is suggested from the
 * total calories (about TARGET_KCAL_PER_SERVING each); the admin can move
 * it directly, or move the calories per serving, which is the same choice
 * seen from the other side: bigger servings are fewer servings.
 *
 * Per serving is what the app shows, and what the meal saves as its
 * calories and macros; the whole meal's figures are saved alongside.
 */
export default function MealServings({ totals, form, servings, onServings, touched }) {
  const count = servingCount(servings);
  const hasServings = String(servings ?? '').trim() !== '';
  const totalKcal = readNutrient(totals, 'calories');
  const suggested = totals && totalKcal.available ? suggestServings(totalKcal.value) : null;
  const perServing = perServingOf(totals, count);
  const kcalEach = totals && totalKcal.available ? Math.round(totalKcal.value / count) : null;

  const set = (n) => onServings(String(Math.max(1, Math.round(n))));

  const rows = NUTRIENTS.map((n) => ({
    ...n,
    whole: macroField(totals, form, { ...n, field: totalField(n.field) }),
    each: macroField(perServing, form, n),
  }));
  const anyUnavailable = rows.some((r) => r.whole.state === 'unavailable');
  const showingSaved = !totals && rows.some((r) => r.each.state === 'saved' || r.whole.state === 'saved');

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <Stepper
          label="Servings in this meal"
          downLabel="One serving fewer" upLabel="One serving more"
          downDisabled={count <= 1} onDown={() => set(count - 1)} onUp={() => set(count + 1)}
          hint={suggested && suggested !== count && hasServings
            ? <>Suggested: {suggested} (about {TARGET_KCAL_PER_SERVING} kcal each){' '}
              <button type="button" onClick={() => set(suggested)}
                className="cursor-pointer text-forest underline underline-offset-2">Use</button></>
            : suggested && !touched
              ? `Suggested from the total, about ${TARGET_KCAL_PER_SERVING} kcal each`
              : undefined}
        >
          <input
            type="number" min="1" value={servings ?? ''} placeholder={suggested ? String(suggested) : '1'}
            aria-label="Number of servings"
            onChange={(e) => onServings(e.target.value)}
            className="h-8 w-16 rounded-md border border-line bg-surface text-center text-[13px] tabular-nums text-ink outline-none focus:border-mint"
          />
        </Stepper>

        <Stepper
          label="Calories per serving"
          /* Smaller servings are more of them, and the other way round. */
          downLabel="Smaller servings — adds a serving" upLabel="Bigger servings — removes a serving"
          downDisabled={kcalEach === null} upDisabled={kcalEach === null || count <= 1}
          onDown={() => set(count + 1)} onUp={() => set(count - 1)}
          hint={kcalEach === null ? 'appears once the calories are calculated' : '− adds a serving, + removes one'}
        >
          <span className="grid h-8 min-w-24 place-items-center rounded-md border border-line bg-surface-2 px-3 text-[13px] font-semibold tabular-nums text-ink">
            {kcalEach === null ? '—' : `${kcalEach} kcal`}
          </span>
        </Stepper>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              <th className="px-3 py-2 text-left">Nutrient</th>
              <th className="px-3 py-2 text-right">Whole meal</th>
              <th className="px-3 py-2 text-right">
                Per serving{hasServings || totals ? ` (÷ ${count})` : ''}
                <span className="ml-1 normal-case tracking-normal text-mint-deep">· shown in the app</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line-light">
                <td className="px-3 py-2 text-[13px] text-ink-2">{r.label}</td>
                <Cell state={r.whole} label={r.label} />
                <Cell state={r.each} label={r.label} strong />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
        <span className="mt-0.5 shrink-0"><IconInfo size={11} /></span>
        <span>
          Calculated from the ingredients above, which are the whole meal — these are not typed in.
          The meal saves both columns; the app shows the per-serving figures.
          {showingSaved && ' Nothing is linked yet, so these are the figures already saved on the meal.'}
          {anyUnavailable && ' “Unavailable” means an ingredient has no published value for it; it is saved as blank, not as 0.'}
        </span>
      </p>
    </div>
  );
}
