import { Badge, Button, cx } from '../../components/ui.jsx';
import { IconInfo } from '../../components/icons.jsx';
import { round1 } from '../../lib/mealNutrition.js';

/* The meal's own figures, under the backend's field names. `carbohydrates`
   is accepted alongside `carbohydrate`: the meal schema allows both. */
const MACROS = [
  { label: 'Calories', suffix: ' kcal', read: (m) => m.total_calories, whole: true, dot: 'bg-forest' },
  { label: 'Protein', suffix: 'g', read: (m) => m.protein, dot: 'bg-mint' },
  { label: 'Carbs', suffix: 'g', read: (m) => m.carbohydrate ?? m.carbohydrates, dot: 'bg-amber' },
  { label: 'Fat', suffix: 'g', read: (m) => m.fat, dot: 'bg-rust' },
  { label: 'Fibre', suffix: 'g', read: (m) => m.fiber, dot: 'bg-grape' },
];

const numberOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const listOf = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

/** "3 cups long-grain rice, blended" from whichever shape the row is in. */
function ingredientLine(row) {
  if (typeof row === 'string') return row;
  const amount = [row.quantity, row.unit].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
  const name = String(row.name ?? '').trim();
  const note = String(row.description ?? '').trim();
  return [[amount, name].filter(Boolean).join(' '), note].filter(Boolean).join(' — ');
}

/**
 * What a meal on the platform actually holds: its figures, its nutrients
 * and its ingredients, read straight off the record.
 *
 * A macro the meal has no value for shows an em dash. These are stored
 * figures, and a blank one means nobody recorded it — not that the meal
 * contains none of that nutrient.
 */
export default function MealPreview({ meal, onUse, onBack }) {
  const servings = numberOrNull(meal.servings);
  const ingredients = listOf(meal.ingredients);
  const nutrients = listOf(meal.nutrients);
  const steps = listOf(meal.instruction_steps).length || listOf(meal.instructions).length;

  const facts = [
    listOf(meal.types).join(', '),
    listOf(meal.countries).join(', '),
    numberOrNull(meal.prep_time) !== null ? `${numberOrNull(meal.prep_time)} min` : '',
    servings !== null ? `${servings} servings` : '',
    listOf(meal.portion_per_serving)[0] || '',
  ].filter(Boolean);

  return (
    <div className="mt-2 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold leading-snug text-ink">{meal.name}</div>
          {facts.length > 0 && <div className="mt-0.5 text-[11px] text-ink-3">{facts.join(' · ')}</div>}
        </div>
        <button type="button" onClick={onBack}
          className="shrink-0 cursor-pointer text-[11px] text-ink-3 underline-offset-2 hover:text-forest hover:underline">
          back
        </button>
      </div>

      {meal.image && (
        <img src={meal.image} alt="" className="mt-2 h-28 w-full rounded-lg object-cover" />
      )}

      {meal.description && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-2">{meal.description}</p>
      )}

      {/* ── Macros ── */}
      <div className="mt-2.5 rounded-lg bg-surface-2 p-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
          Macronutrients {servings !== null && <span className="normal-case tracking-normal">· whole meal</span>}
        </div>
        <div className="mt-1.5 flex flex-col gap-1">
          {MACROS.map(({ label, suffix, read, whole, dot }) => {
            const value = numberOrNull(read(meal));
            const each = value !== null && servings ? (whole ? Math.round(value / servings) : round1(value / servings)) : null;
            return (
              <div key={label} className="flex items-baseline justify-between gap-2 text-[11.5px]">
                <span className="inline-flex items-center gap-1.5 text-ink-2">
                  <span className={cx('size-1.5 shrink-0 rounded-full', dot)} />
                  {label}
                </span>
                <span className="tabular-nums">
                  {value === null ? (
                    <span className="italic text-ink-3">not recorded</span>
                  ) : (
                    <>
                      <b className="font-semibold text-ink">{whole ? Math.round(value) : round1(value)}{suffix}</b>
                      {each !== null && <span className="ml-1.5 text-ink-3">{each}{suffix} / serving</span>}
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Nutrients ── */}
      {nutrients.length > 0 && (
        <div className="mt-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Nutrients · {nutrients.length}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {nutrients.map((n, i) => (
              <Badge key={`${n?.name || i}`} tone="neutral">
                {typeof n === 'string' ? n : `${n.name ?? ''} ${n.amount ?? ''}${n.unit ?? ''}`.trim()}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── Ingredients ── */}
      <div className="mt-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
          Ingredients · {ingredients.length}
        </div>
        {ingredients.length ? (
          <ul className="scroll-thin mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto text-[11.5px] text-ink-2">
            {ingredients.map((row, i) => <li key={i}>{ingredientLine(row)}</li>)}
          </ul>
        ) : (
          <div className="mt-1 text-[11.5px] italic text-ink-3">None recorded on this meal.</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={() => onUse(meal)}>Use this meal</Button>
        <span className="flex items-center gap-1 text-[11px] text-ink-3">
          <IconInfo size={11} /> Fills the form{steps ? ` — ${steps} step${steps === 1 ? '' : 's'} included` : ''}
        </span>
      </div>
    </div>
  );
}
