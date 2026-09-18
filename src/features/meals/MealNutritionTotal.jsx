import { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner, cx } from '../../components/ui.jsx';
import { IconInfo, IconWarning } from '../../components/icons.jsx';
import { calculateNutrition, isExpiredSession, isForbidden } from '../../lib/api.js';
import {
  buildCalculateLines, inclusionSummary, NUTRIENTS, readNutrient, round1, unavailableLabel,
} from '../../lib/mealNutrition.js';

/* Rows are edited a keystroke at a time; wait for a pause before asking
   the server to add them up again. */
const DEBOUNCE_MS = 500;

function Nutrient({ label, suffix, state, servings }) {
  if (!state.available) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] text-ink-3">{label}</span>
        <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-amber-deep">
          <IconWarning size={11} /> Unavailable
        </span>
      </div>
    );
  }
  const perServing = servings > 0 ? round1(state.value / servings) : null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] text-ink-3">{label}</span>
      <span className="text-[13.5px] font-semibold tabular-nums text-ink">
        {label === 'Calories' ? Math.round(state.value) : round1(state.value)}{suffix}
      </span>
      {perServing !== null && (
        <span className="text-[10.5px] tabular-nums text-ink-3">
          {label === 'Calories' ? Math.round(perServing) : perServing}{suffix} / serving
        </span>
      )}
    </div>
  );
}

/**
 * The meal's running nutrition total, recalculated by the platform API as
 * ingredient rows change.
 *
 * It reports what it could not count as loudly as what it could: a row
 * without a nutrition link, or measured in cups, is listed by name and the
 * total is labelled partial. A nutrient no ingredient published comes back
 * unavailable and is never drawn as a number.
 *
 * `onTotals` hands the parent the calculated figures (or null when there
 * is nothing to calculate), which is what the meal saves — there are no
 * hand-typed macros any more.
 */
export default function MealNutritionTotal({ rows, servings, onTotals, savedFallback }) {
  const { lines, skipped } = useMemo(() => buildCalculateLines(rows), [rows]);
  const linesKey = JSON.stringify(lines);
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const onTotalsRef = useRef(onTotals);
  onTotalsRef.current = onTotals;

  useEffect(() => {
    const current = JSON.parse(linesKey);
    if (!current.length) {
      setState({ status: 'idle', data: null, error: null });
      onTotalsRef.current(null);
      return undefined;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    const timer = setTimeout(() => {
      calculateNutrition(current, { signal: controller.signal }).then(
        (data) => {
          setState({ status: 'done', data, error: null });
          onTotalsRef.current(data);
        },
        (error) => {
          if (error.name === 'AbortError') return;
          setState({ status: 'error', data: null, error });
          // A failed calculation must not leave a stale total attached to the meal.
          onTotalsRef.current(null);
        },
      );
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [linesKey]);

  const { status, data, error } = state;
  const servingCount = Number(servings) > 0 ? Number(servings) : 0;
  const calories = data ? readNutrient(data, 'calories') : null;
  const partial = skipped.length > 0;

  /* While a recalculation is in flight the row count has already moved on,
     so the previous figure belongs to a different set of rows. Showing it
     next to the new count would state a total this meal never had. */
  const headline = status === 'loading'
    ? '…'
    : !lines.length
      ? '0 cal'
      : calories?.available
        ? `${Math.round(calories.value)} cal`
        : 'cal unavailable';

  return (
    <div className={cx('rounded-xl border p-3.5',
      partial && lines.length ? 'border-amber/50 bg-amber-light/40' : 'border-line bg-surface-2')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-ink">
          {inclusionSummary(lines, skipped)}
          <span className="mx-1.5 text-ink-3">·</span>
          <span className={cx(status === 'loading' && 'text-ink-3')}>{headline}</span>
        </span>
        {status === 'loading' && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-3"><Spinner /> Recalculating…</span>
        )}
        {partial && lines.length > 0 && status !== 'loading' && (
          <span className="text-[11.5px] font-medium text-amber-deep">
            Partial total — {skipped.length} ingredient{skipped.length === 1 ? '' : 's'} not counted
          </span>
        )}
      </div>

      {status === 'done' && data && (
        <div className="mt-3 grid grid-cols-5 gap-3 max-sm:grid-cols-3">
          {NUTRIENTS.map(({ key, label, suffix }) => (
            <Nutrient key={key} label={label} suffix={suffix}
              state={readNutrient(data, key)} servings={servingCount} />
          ))}
        </div>
      )}

      {status === 'done' && data?.completeness?.complete === false && (
        <ul className="mt-2.5 flex flex-col gap-0.5">
          {NUTRIENTS.map(({ key, label }) => {
            const n = readNutrient(data, key);
            if (n.available) return null;
            return (
              <li key={key} className="flex items-start gap-1.5 text-[11.5px] text-amber-deep">
                <span className="mt-0.5 shrink-0"><IconWarning size={11} /></span>
                <span>{unavailableLabel(label, n.missingFor)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {skipped.length > 0 && (
        <div className="mt-2.5 border-t border-line-light pt-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-deep">
            Not counted
          </div>
          <ul className="mt-1 flex flex-col gap-0.5">
            {skipped.map((s) => (
              <li key={s.index} className="flex items-start gap-1.5 text-[11.5px] text-ink-2">
                <span className="mt-0.5 shrink-0 text-amber-deep"><IconWarning size={11} /></span>
                <span><b className="font-semibold">{s.name}</b> — {s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="mt-2.5 rounded-lg bg-chili-light px-3 py-2 text-[11.5px] text-chili-deep">
          <b className="font-semibold">Could not calculate{error.status ? ` — HTTP ${error.status}` : ''}:</b>{' '}
          <span className="font-mono">{error.message}</span>
          {isExpiredSession(error) && <> Sign in again.</>}
          {isForbidden(error) && <> This account is not allowed to use the nutrition endpoint.</>}
          <div className="mt-1 text-ink-2">No total is attached to this meal until it calculates.</div>
        </div>
      )}

      {!lines.length && (
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
          <span className="mt-0.5 shrink-0"><IconInfo size={11} /></span>
          <span>
            Nutrition comes from linked ingredients only. Link a row, give it a quantity in g, kg,
            oz or lb, and the total appears here.
            {savedFallback && ' Until then this meal keeps the figures already saved on it.'}
          </span>
        </p>
      )}
    </div>
  );
}
