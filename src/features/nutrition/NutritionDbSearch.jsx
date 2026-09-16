import { useEffect, useState } from 'react';
import { Badge, Input, Select, Spinner, cx } from '../../components/ui.jsx';
import { IconSearch } from '../../components/icons.jsx';
import { fmtMacro } from '../../lib/ingredients.js';
import { isExpiredSession, nutritionToMacros, searchNutrition } from '../../lib/api.js';

const DEBOUNCE_MS = 400;
const LIMIT = 8;

export function SourceTag({ source }) {
  return source === 'wafct'
    ? <Badge tone="mint">WAFCT</Badge>
    : source === 'usda' ? <Badge tone="ocean">USDA</Badge> : <Badge>{source}</Badge>;
}

export function MacroLine({ macros, className }) {
  const v = (x, suffix) => (x === null || x === undefined
    ? <span className="italic text-ink-3">—</span>
    : <b className="font-semibold text-ink">{fmtMacro(x)}{suffix}</b>);
  return (
    <div className={cx('flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] tabular-nums text-ink-2', className)}>
      <span>{v(macros.calories, ' kcal')}</span>
      <span>P {v(macros.protein_g, 'g')}</span>
      <span>C {v(macros.carbs_g, 'g')}</span>
      <span>F {v(macros.fat_g, 'g')}</span>
      <span>Fb {v(macros.fibre_g, 'g')}</span>
    </div>
  );
}

/**
 * Searches platform-api's food composition data (GET /v1/nutrition/ingredients).
 * Nothing is applied until `onPick(record)` fires from a click.
 */
export default function NutritionDbSearch({ initialQuery = '', onPick, onClose, pickLabel = 'Use' }) {
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ status: 'idle', docs: [], more: false, error: null });

  useEffect(() => { setPage(1); }, [query, source]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setState({ status: 'idle', docs: [], more: false, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'searching', error: null }));
    const t = setTimeout(() => {
      searchNutrition({ search: q, source: source || undefined, page, limit: LIMIT }, { signal: controller.signal })
        .then(
          (data) => setState({
            status: 'done',
            docs: data?.docs ?? [],
            // stats.docs is this page's count; a full page means there may be more.
            more: (data?.docs?.length ?? 0) === LIMIT,
            error: null,
          }),
          (error) => {
            if (error.name !== 'AbortError') setState({ status: 'error', docs: [], more: false, error });
          },
        );
    }, DEBOUNCE_MS);
    return () => { clearTimeout(t); controller.abort(); };
  }, [query, source, page]);

  const { status, docs, more, error } = state;

  return (
    <div className="mt-2 animate-fade-up rounded-xl border border-ocean/40 bg-ocean-light/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ocean-deep">
          Platform nutrition database
        </span>
        {onClose && (
          <button type="button" onClick={onClose} className="cursor-pointer text-[11px] text-ink-3 hover:text-ink">
            Close
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-2 max-sm:grid-cols-1">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"><IconSearch /></span>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods, e.g. cowpea"
            className="py-2 pl-8 text-[12.5px]"
          />
        </div>
        <Select value={source} onChange={(e) => setSource(e.target.value)} className="py-2 text-[12.5px]">
          <option value="">All sources</option>
          <option value="wafct">WAFCT</option>
          <option value="usda">USDA</option>
        </Select>
      </div>

      <div className="mt-2 flex flex-col">
        {status === 'idle' && (
          <div className="py-2 text-[11.5px] text-ink-3">Type at least two letters.</div>
        )}
        {status === 'searching' && !docs.length && (
          <div className="flex items-center gap-2 py-2 text-[11.5px] text-ink-3"><Spinner /> Searching…</div>
        )}
        {status === 'error' && (
          <div role="alert" className="py-2 text-[11.5px] text-chili">
            {isExpiredSession(error) ? 'Your session has expired — sign in again.' : error.message}
          </div>
        )}
        {status === 'done' && !docs.length && (
          <div className="py-2 text-[11.5px] text-ink-3">
            {page > 1 ? 'No more results.' : `Nothing found for “${query.trim()}”.`}
          </div>
        )}

        {docs.map((rec) => (
          <div key={rec._id}
            className={cx('flex items-start justify-between gap-3 border-t border-line/70 py-2 first:border-t-0',
              status === 'searching' && 'opacity-60')}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12.5px] font-medium leading-snug text-ink">{rec.name}</span>
                <SourceTag source={rec.source} />
                {rec.estimated_nutrients?.length > 0 && (
                  <Badge tone="amber" title={`Estimated: ${rec.estimated_nutrients.join(', ')}`}>Partly estimated</Badge>
                )}
              </div>
              {rec.source_category && <div className="text-[11px] text-ink-3">{rec.source_category}</div>}
              <MacroLine macros={nutritionToMacros(rec)} className="mt-0.5" />
            </div>
            <button type="button" onClick={() => onPick(rec)}
              className="shrink-0 cursor-pointer rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-2 transition hover:border-forest hover:text-forest">
              {pickLabel}
            </button>
          </div>
        ))}

        {(page > 1 || more) && status !== 'error' && (
          <div className="mt-1 flex items-center justify-between border-t border-line/70 pt-2 text-[11px] text-ink-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="cursor-pointer disabled:cursor-default disabled:opacity-40">← Previous</button>
            <span>Page {page} · per 100g</span>
            <button type="button" disabled={!more} onClick={() => setPage(page + 1)}
              className="cursor-pointer disabled:cursor-default disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
