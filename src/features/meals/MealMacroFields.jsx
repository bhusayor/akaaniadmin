import { Field, cx } from '../../components/ui.jsx';
import { IconInfo, IconWarning } from '../../components/icons.jsx';
import { macroField, NUTRIENTS, readNutrient, round1, unavailableLabel } from '../../lib/mealNutrition.js';

/* Calories heads the section; the four macros sit in the grid below it,
   which is the layout the meal form has always used. */
const GRID = NUTRIENTS.filter((n) => n.key !== 'calories');
const CALORIES = NUTRIENTS.find((n) => n.key === 'calories');

/**
 * One macro, showing where its figure came from.
 *
 * It reads as a field rather than a number on a card, because that is
 * what it replaced — but it is not an input. These values are calculated
 * from the linked ingredients, and a box someone can type into would put
 * a second, quieter source of truth back on the form.
 */
function Macro({ label, state, perServing }) {
  const tone = {
    calculated: 'text-ink',
    unavailable: 'text-amber-deep',
    saved: 'text-ink-2',
    empty: 'text-ink-3',
  }[state.state];

  return (
    <Field
      label={label}
      hint={state.state === 'saved' ? 'saved value' : state.state === 'calculated' ? 'calculated' : undefined}
    >
      <div
        className={cx(
          'flex min-h-[42px] items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5',
          'text-[13px] tabular-nums',
          tone,
        )}
        title={state.state === 'unavailable' ? unavailableLabel(label, state.missingFor) : undefined}
      >
        {state.state === 'unavailable' && <IconWarning size={12} />}
        <span className={state.state === 'calculated' ? 'font-semibold' : undefined}>{state.text}</span>
      </div>
      {perServing && <span className="text-[11px] tabular-nums text-ink-3">{perServing} / serving</span>}
    </Field>
  );
}

/**
 * The meal's macronutrients, calculated rather than typed.
 *
 * `totals` is the calculate response, or null when nothing is linked — in
 * which case the meal's saved figures are shown, labelled as saved, so an
 * older meal does not look empty just because its ingredients have not
 * been linked yet.
 */
export default function MealMacroFields({ totals, form, servings }) {
  const count = Number(servings) > 0 ? Number(servings) : 0;
  const anyUnavailable = NUTRIENTS.some((n) => macroField(totals, form, n).state === 'unavailable');

  /* Per serving is only shown for a calculated figure: dividing a saved
     total by today's serving count would invent a number nobody stored. */
  const perServing = (nutrient, state) => {
    if (!count || state.state !== 'calculated' || !totals) return null;
    const { value } = readNutrient(totals, nutrient.key);
    const each = nutrient.key === 'calories' ? Math.round(value / count) : round1(value / count);
    return `${each}${nutrient.suffix}`;
  };

  return (
    <div className="mt-4">
      <div className="grid grid-cols-5 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2">
        {[CALORIES, ...GRID].map((n) => {
          const state = macroField(totals, form, n);
          return (
            <Macro key={n.key} label={n.label} state={state} perServing={perServing(n, state)} />
          );
        })}
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
        <span className="mt-0.5 shrink-0"><IconInfo size={11} /></span>
        <span>
          Calculated from the linked ingredients above — these are not typed in.
          {anyUnavailable && ' “Unavailable” means no ingredient published that nutrient; it is saved as blank, not as 0.'}
        </span>
      </p>
    </div>
  );
}
