import { useEffect, useRef, useState } from 'react';
import { findMatches, REVIEW_THRESHOLD, MATCHED_THRESHOLD } from '../../lib/wafctMatch.js';
import * as NE from '../../lib/nutritionEstimate.js';
import { Badge, Spinner, cx } from '../../components/ui.jsx';
import { IconInfo } from '../../components/icons.jsx';
import { fmtMacro } from '../../lib/ingredients.js';

const DEBOUNCE_MS = 400;

function Macros({ m, kcalKey = 'kcal' }) {
  const val = (v, suffix) =>
    v === null || v === undefined
      ? <span className="italic text-ink-3">—</span>
      : <b className="font-semibold text-ink">{fmtMacro(v)}{suffix}</b>;
  return (
    <div className="my-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-xs tabular-nums text-ink-2">
      <span>{val(m[kcalKey], ' kcal')}</span>
      <span>Protein {val(m.protein_g, 'g')}</span>
      <span>Carbs {val(m.carbs_g, 'g')}</span>
      <span>Fat {val(m.fat_g, 'g')}</span>
      <span>Fibre {val(m.fibre_g, 'g')}</span>
    </div>
  );
}

/**
 * WAFCT lookup on the name field, debounced.
 *
 * A suggestion is only ever *shown* here — nothing is written into the
 * macro fields until someone clicks, a 100% score included.
 */
export default function WafctSuggestion({ name, onApplyWafct, onApplyEstimate }) {
  const [state, setState] = useState({ status: 'idle' });
  const timer = useRef(null);
  const requestedFor = useRef('');

  useEffect(() => {
    clearTimeout(timer.current);
    const trimmed = name.trim();
    if (!trimmed) { setState({ status: 'idle' }); return undefined; }

    setState({ status: 'searching' });
    timer.current = setTimeout(() => {
      const hits = findMatches(trimmed).filter((r) => r.score >= REVIEW_THRESHOLD);
      setState(hits.length ? { status: 'matched', hits } : { status: 'no-match' });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer.current);
  }, [name]);

  const runEstimate = () => {
    const trimmed = name.trim();
    requestedFor.current = trimmed;
    setState({ status: 'estimating' });
    NE.estimate(trimmed, (err, res) => {
      // The name may have moved on while the request was in flight.
      if (requestedFor.current !== trimmed) return;
      setState(err ? { status: 'estimate-error', error: err.message } : { status: 'estimated', result: res });
    });
  };

  if (state.status === 'idle') return null;

  const Shell = ({ tone = 'plain', children }) => (
    <div className={cx('mt-2 animate-fade-up rounded-xl border p-3.5',
      tone === 'wafct' ? 'border-mint bg-[#F4FBF8]'
        : tone === 'ai' ? 'border-amber bg-amber-light'
          : 'border-line bg-surface-2')}>
      {children}
    </div>
  );

  if (state.status === 'searching') {
    return <Shell><div className="flex items-center gap-2 text-xs text-ink-3"><Spinner /> Looking up WAFCT…</div></Shell>;
  }

  if (state.status === 'estimating') {
    return <Shell><div className="flex items-center gap-2 text-xs text-ink-3"><Spinner /> Asking the model about “{name.trim()}”…</div></Shell>;
  }

  if (state.status === 'no-match' || state.status === 'estimate-error') {
    return (
      <Shell>
        <div className="flex items-start gap-2 text-xs text-ink-3">
          <span className="mt-px shrink-0"><IconInfo /></span>
          {state.status === 'estimate-error'
            ? state.error
            : 'Not in WAFCT. Enter the macros manually, leave them blank for now, or ask the model for an estimate.'}
        </div>
        <button onClick={runEstimate}
          className="mt-2.5 cursor-pointer rounded-lg bg-rust px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-85">
          {state.status === 'estimate-error' ? 'Try again' : 'Estimate with AI'}
        </button>
      </Shell>
    );
  }

  if (state.status === 'estimated') {
    const res = state.result;
    return (
      <Shell tone="ai">
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-deep">
              AI estimate · not measured data
            </div>
            <div className="text-[13px] font-semibold leading-snug text-ink">{res.name}</div>
          </div>
          <Badge tone="amber" className="shrink-0 rounded-full px-2 py-1">Estimated</Badge>
        </div>
        <Macros m={res.macros} kcalKey="calories" />
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => onApplyEstimate(res)}
            className="cursor-pointer rounded-lg bg-rust px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-85">
            Use this estimate
          </button>
          <span className="text-[11px] text-ink-3">{res.model}</span>
        </div>
        {res.note && <div className="mt-2 text-[11px] leading-relaxed text-amber-deep">{res.note}</div>}
      </Shell>
    );
  }

  /* WAFCT match */
  const [best, ...rest] = state.hits;
  const alts = rest.filter((r) => best.score - r.score <= 12);

  return (
    <Shell tone="wafct">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-mint-deep">
            WAFCT suggestion
          </div>
          <div className="text-[13px] font-semibold leading-snug text-ink">{best.food.name}</div>
        </div>
        <Badge tone={best.score >= MATCHED_THRESHOLD ? 'mint' : 'amber'} className="shrink-0 rounded-full px-2 py-1">
          {best.score >= MATCHED_THRESHOLD ? 'Matched' : 'Review'} · {Math.round(best.score)}%
        </Badge>
      </div>

      <Macros m={best.food} />

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => onApplyWafct(best.food)}
          className="cursor-pointer rounded-lg bg-forest px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-85">
          Use this
        </button>
        {best.alias && <span className="text-[11px] text-ink-3">matched via alias “{best.alias}”</span>}
      </div>

      {alts.length > 0 && (
        <div className="mt-2.5 border-t border-dashed border-line pt-2.5">
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Other close matches
          </div>
          {alts.map((r) => (
            <div key={r.food.food_id} className="flex items-center justify-between gap-2.5 py-1">
              <span className="text-xs leading-snug text-ink-2">{r.food.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] tabular-nums text-ink-3">{Math.round(r.score)}%</span>
                <button onClick={() => onApplyWafct(r.food)}
                  className="cursor-pointer rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2 transition hover:border-forest hover:bg-white hover:text-forest">
                  Use
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
