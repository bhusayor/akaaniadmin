import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSearch } from '../../hooks/useTopbar.js';
import {
  Badge, Button, Card, CountBadge, EmptyState, FilterSelect, Input, PageToolbar, Spinner, Th, Td, cx,
} from '../../components/ui.jsx';
import { IconRefresh, IconWarning } from '../../components/icons.jsx';
import { NUTRITION_SOURCES, searchNutrition } from '../../lib/api.js';
import { macroValue } from '../../lib/mealNutrition.js';
import usePlatformLookups from './usePlatformLookups.js';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

/* The five per-100g nutrients the collection publishes, under the API's own
   keys. Nothing is renamed on the way through. */
const NUTRIENTS = [
  ['calories', 'kcal'],
  ['protein', 'g'],
  ['carbohydrate', 'g'],
  ['fat', 'g'],
  ['fiber', 'g'],
];

function SourceBadge({ source }) {
  if (source === 'wafct') return <Badge tone="mint">WAFCT</Badge>;
  if (source === 'usda') return <Badge tone="ocean">USDA</Badge>;
  return <Badge>{source || 'unknown'}</Badge>;
}

/** One nutrient cell: a number, or an em dash where the source published none. */
function Nutrient({ value, suffix, estimated }) {
  const n = macroValue(value);
  if (n === null) {
    return <span className="italic text-ink-3" title="Not published by the source">—</span>;
  }
  return (
    <span className={cx('tabular-nums', estimated && 'text-amber-deep')} title={estimated ? 'Bracketed in the source — a lower-confidence figure' : undefined}>
      {n}{suffix}{estimated ? '*' : ''}
    </span>
  );
}

/**
 * The platform's food composition data: 1,028 WAFCT and 363 USDA records,
 * served by GET /v1/nutrition/ingredients.
 *
 * Read-only on purpose — the API publishes this collection, there is no
 * write route for it, and nothing here is held in the browser. Records are
 * rendered in the shape the API returns them.
 */
export default function NutritionLibrary({ tabs }) {
  const [search] = useSearch();
  const lookups = usePlatformLookups();

  const [query, setQuery] = useState(search.trim());
  const [source, setSource] = useState('');
  const [productGroup, setProductGroup] = useState('');
  const [foodGroupCode, setFoodGroupCode] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [waking, setWaking] = useState(false);
  const [state, setState] = useState({ status: 'loading', docs: [], stats: null, error: null });

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [source, productGroup, foodGroupCode]);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    setWaking(false);
    searchNutrition(
      {
        search: query,
        // Omitted entirely when unset — never `source=`.
        source: source || undefined,
        product_group: productGroup || undefined,
        food_group_code: foodGroupCode.trim().toUpperCase() || undefined,
        page,
        limit: PAGE_SIZE,
      },
      { signal: controller.signal, onRetry: () => setWaking(true) },
    ).then(
      (data) => {
        setWaking(false);
        setState({ status: 'ready', docs: data?.docs ?? [], stats: data?.stats ?? null, error: null });
      },
      (error) => {
        if (error.name === 'AbortError') return;
        setWaking(false);
        setState((s) => ({ ...s, status: 'error', error }));
      },
    );
    return () => controller.abort();
  }, [query, source, productGroup, foodGroupCode, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const { status, docs, stats, error } = state;
  const total = stats?.docs ?? 0;
  const bySource = stats?.by_source || {};
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, total);
  /* by_source counts the same search across both sources, ignoring the source
     filter, so it also says how many matches a filter is hiding. */
  const hidden = source ? Object.entries(bySource).filter(([k]) => k !== source) : [];

  return (
    <>
      <PageToolbar
        left={
          <>
            {tabs}
            <FilterSelect value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All sources</option>
              {NUTRITION_SOURCES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </FilterSelect>
            <FilterSelect value={productGroup} onChange={(e) => setProductGroup(e.target.value)}
              disabled={lookups.status !== 'ready'}>
              <option value="">All product groups</option>
              {lookups.groups.map((g) => <option key={g._id} value={String(g._id)}>{g.name}</option>)}
            </FilterSelect>
            {/* Input is w-full by design, so the width lives on a wrapper. */}
            <div className="w-40">
              <Input
                value={foodGroupCode}
                onChange={(e) => setFoodGroupCode(e.target.value)}
                placeholder="Food group code"
                className="py-1.5 text-[12.5px] uppercase"
              />
            </div>
            <CountBadge>
              {status === 'loading' && !docs.length ? '…' : `${total.toLocaleString()} record${total === 1 ? '' : 's'}`}
            </CountBadge>
            {status === 'loading' && docs.length > 0 && <Spinner />}
          </>
        }
        right={
          <Button variant="ghost" onClick={reload} disabled={status === 'loading'}>
            <IconRefresh /> Refresh
          </Button>
        }
      />

      <div className="px-7 py-5 max-md:px-4">
        {/* by_source, so a page dominated by one source says so rather than
            looking like the other one has no data. */}
        {stats && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ink-2">
            <span className="font-medium">Matches by source:</span>
            {NUTRITION_SOURCES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <SourceBadge source={s} />
                <span className="tabular-nums">{(bySource[s] ?? 0).toLocaleString()}</span>
              </span>
            ))}
            {hidden.length > 0 && (
              <span className="text-amber-deep">
                — {hidden.map(([k, v]) => `${v.toLocaleString()} ${k.toUpperCase()}`).join(', ')} hidden by the source filter
              </span>
            )}
            {!source && total > 0 && (bySource.usda === 0 || bySource.wafct === 0) && (
              <span className="text-amber-deep">— every match comes from one source</span>
            )}
          </div>
        )}

        {waking && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber/40 bg-amber-light px-4 py-2.5 text-[12.5px] text-amber-deep">
            <Spinner /> The staging server was asleep — retrying.
          </div>
        )}

        {status === 'error' && (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-chili/30 bg-chili-light px-4 py-3 text-[13px] text-chili-deep">
            <span className="min-w-0 flex-1">
              Could not load nutrition data{error.status ? ` — HTTP ${error.status}` : ''}: {error.message}
            </span>
            <Button variant="ghost" onClick={reload}>Try again</Button>
          </div>
        )}

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse max-md:min-w-[860px]">
              <thead>
                <tr>
                  <Th>Food</Th>
                  <Th>Source</Th>
                  <Th>Published category</Th>
                  {NUTRIENTS.map(([key]) => <Th key={key} className="text-right">{key}</Th>)}
                  <Th />
                </tr>
              </thead>
              <tbody className={cx(status === 'loading' && 'opacity-60')}>
                {docs.map((rec) => {
                  const estimated = rec.estimated_nutrients || [];
                  const open = expanded === rec._id;
                  return (
                    <tr key={rec._id} className="group align-top transition hover:bg-[#FAFBFD]">
                      <Td>
                        <div className="font-medium">{rec.name}</div>
                        {rec.name_fr && <div className="text-[11.5px] italic text-ink-3">{rec.name_fr}</div>}
                        {open && (
                          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px] text-ink-2">
                            {[
                              ['_id', rec._id],
                              ['external_id', rec.external_id],
                              ['food_variant_id', rec.food_variant_id],
                              ['food_id', rec.food_id],
                              ['food_group_id', rec.food_group_id],
                              ['food_group_code', rec.food_group_code],
                              ['product_group', rec.product_group],
                              ['energy_basis', rec.energy_basis],
                              ['estimated_nutrients', estimated.length ? estimated.join(', ') : null],
                            ].map(([k, v]) => (
                              <Fragment key={k}>
                                <dt className="text-ink-3">{k}</dt>
                                <dd className="font-mono break-all">{v === null || v === undefined || v === '' ? '—' : String(v)}</dd>
                              </Fragment>
                            ))}
                          </dl>
                        )}
                      </Td>
                      <Td>
                        <SourceBadge source={rec.source} />
                        <div className="mt-1 font-mono text-[11px] text-ink-3">{rec.external_id}</div>
                      </Td>
                      <Td className="text-[12.5px]">
                        {rec.source_category || <span className="italic text-ink-3">—</span>}
                        {rec.food_group_code && (
                          <div className="mt-0.5 font-mono text-[11px] text-ink-3">{rec.food_group_code}</div>
                        )}
                      </Td>
                      {NUTRIENTS.map(([key, suffix]) => (
                        <Td key={key} className="text-right text-[12.5px]">
                          <Nutrient value={rec.nutrients_per_100g?.[key]} suffix={suffix}
                            estimated={estimated.includes(key)} />
                        </Td>
                      ))}
                      <Td>
                        <button type="button"
                          onClick={() => setExpanded(open ? null : rec._id)}
                          className="cursor-pointer text-[11.5px] text-ink-3 underline-offset-2 hover:text-forest hover:underline">
                          {open ? 'less' : 'more'}
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {status === 'loading' && !docs.length && (
            <div className="grid place-items-center py-16"><Spinner className="size-6" /></div>
          )}
          {status === 'ready' && !docs.length && (
            <EmptyState
              icon="🔍"
              title={query ? `No records match “${query}”` : 'No records match these filters'}
              sub="Values are per 100g of edible portion, from the published tables."
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-ink-3">
            <span className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums">{first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}</span>
              <span className="inline-flex items-center gap-1 text-[11.5px]">
                <IconWarning size={11} /> per 100g · an asterisk marks a figure bracketed by the source
              </span>
            </span>
            {total > PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" disabled={page <= 1 || status === 'loading'} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="tabular-nums">Page {page} of {pages}</span>
                <Button variant="ghost" disabled={page >= pages || status === 'loading'} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
