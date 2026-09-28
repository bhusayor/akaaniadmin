import { useCallback, useEffect, useState } from 'react';
import { useSearch } from '../../hooks/useTopbar.js';
import {
  Button, Card, CountBadge, EmptyState, FilterSelect, Input, PageToolbar, Spinner, cx,
} from '../../components/ui.jsx';
import { IconRefresh } from '../../components/icons.jsx';
import { NUTRITION_SOURCES, listNutritionFoodGroups, searchNutrition } from '../../lib/api.js';
import { groupByFood, preparationName, preparationsLabel } from '../../lib/nutritionGroups.js';
import { MacroChips, SourceTag } from '../nutrition/parts.jsx';
import usePlatformLookups from './usePlatformLookups.js';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

/* Identifiers a record carries beyond its figures. Shown on demand rather
   than in the heading: useful when reconciling with the source tables,
   noise the rest of the time. */
const DETAIL_FIELDS = [
  ['_id', (d) => d._id],
  ['external_id', (d) => d.external_id],
  ['food_variant_id', (d) => d.food_variant_id],
  ['food_id', (d) => d.food_id],
  ['food_group_id', (d) => d.food_group_id],
  ['food_group_code', (d) => d.food_group_code],
  ['source_category', (d) => d.source_category],
  ['product_group', (d) => d.product_group],
  ['energy_basis', (d) => d.energy_basis],
  ['estimated_nutrients', (d) => (d.estimated_nutrients || []).join(', ')],
];

/** "STARCHY_ROOTS_TUBERS" → "Starchy roots tubers". */
const foodGroupLabel = (code) => {
  const words = String(code).toLowerCase().split('_').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/* Fetched once per page load; a failed load is not cached, so the next
   visit to the tab tries again. */
let foodGroupsCache = null;

function loadFoodGroups() {
  if (!foodGroupsCache) {
    foodGroupsCache = listNutritionFoodGroups().catch((err) => {
      foodGroupsCache = null;
      throw err;
    });
  }
  return foodGroupsCache;
}

/**
 * "Acha; acca; findi; hungry rice" → "Acha, acca, findi, hungry rice".
 *
 * The nutrition data model carries these under `local_names`, but the
 * import does not write them yet (see README), so this renders whenever
 * the API starts sending them and stays quiet until then.
 */
function aliasesOf(docs) {
  const raw = docs.map((d) => d.local_names ?? d.aliases).find(Boolean);
  if (!raw) return '';
  const list = Array.isArray(raw) ? raw : String(raw).split(/[;,]/);
  return list.map((s) => String(s).trim()).filter(Boolean).join(', ');
}

/**
 * The platform's food composition data: 1,028 WAFCT and 363 USDA records,
 * served by GET /v1/nutrition/ingredients.
 *
 * Presented the way the collection is shaped — one entry per food, its
 * preparations underneath — because a food like fonio holds eight rows
 * that differ only in their tail, and a flat list of those is unreadable.
 *
 * Read-only: the API publishes this collection and has no write route for
 * it, and nothing here is held in the browser.
 */
export default function NutritionLibrary({ tabs }) {
  const [search] = useSearch();
  const lookups = usePlatformLookups();

  const [query, setQuery] = useState(search.trim());
  const [source, setSource] = useState('');
  const [productGroup, setProductGroup] = useState('');
  const [foodGroupCode, setFoodGroupCode] = useState('');
  const [foodGroups, setFoodGroups] = useState({ status: 'loading', list: [] });
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [details, setDetails] = useState(null);
  const [waking, setWaking] = useState(false);
  const [state, setState] = useState({ status: 'loading', groups: [], docs: 0, stats: null, error: null });

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [source, productGroup, foodGroupCode]);

  useEffect(() => {
    let live = true;
    loadFoodGroups().then(
      (list) => live && setFoodGroups({ status: 'ready', list }),
      () => live && setFoodGroups({ status: 'error', list: [] }),
    );
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    setWaking(false);
    searchNutrition(
      {
        search: query,
        // Every filter is omitted when unset — never `source=`.
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
        const docs = data?.docs ?? [];
        setState({ status: 'ready', groups: groupByFood(docs), docs: docs.length, stats: data?.stats ?? null, error: null });
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

  const { status, groups, docs, stats, error } = state;
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
            {foodGroups.status === 'error' ? (
              /* The list failed to load (or the API predates GET
                 /v1/nutrition/food_groups): the code can still be typed.
                 Input is w-full by design, so the width lives on a wrapper. */
              <div className="w-40">
                <Input
                  value={foodGroupCode}
                  onChange={(e) => setFoodGroupCode(e.target.value)}
                  placeholder="Food group code"
                  className="py-1.5 text-[12.5px] uppercase"
                />
              </div>
            ) : (
              <FilterSelect value={foodGroupCode} onChange={(e) => setFoodGroupCode(e.target.value)}
                disabled={foodGroups.status !== 'ready'}>
                <option value="">All food groups</option>
                {foodGroups.list.map((g) => (
                  <option key={g.code} value={g.code}>
                    {foodGroupLabel(g.code)} ({g.count.toLocaleString()})
                  </option>
                ))}
              </FilterSelect>
            )}
            <CountBadge>
              {status === 'loading' && !groups.length
                ? '…'
                : `${groups.length} ingredient${groups.length === 1 ? '' : 's'} · ${total.toLocaleString()} record${total === 1 ? '' : 's'}`}
            </CountBadge>
            {status === 'loading' && groups.length > 0 && <Spinner />}
          </>
        }
        right={
          <Button variant="ghost" onClick={reload} disabled={status === 'loading'}>
            <IconRefresh /> Refresh
          </Button>
        }
      />

      <div className="px-7 py-5 max-md:px-4">
        {stats && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ink-2">
            <span className="font-medium">Matches by source:</span>
            {NUTRITION_SOURCES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <SourceTag source={s} />
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

        {status === 'loading' && !groups.length && (
          <Card><div className="grid place-items-center py-16"><Spinner className="size-6" /></div></Card>
        )}

        {status === 'ready' && !groups.length && (
          <Card>
            <EmptyState
              icon="🔍"
              title={query ? `No records match “${query}”` : 'No records match these filters'}
              sub="Values are per 100g of edible portion, from the published tables."
            />
          </Card>
        )}

        <div className={cx('flex flex-col gap-4', status === 'loading' && 'opacity-60')}>
          {groups.map((group) => {
            const aliases = aliasesOf(group.docs);
            return (
              <Card key={group.key} className="px-5 py-4 max-md:px-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{group.label}</h2>
                    {aliases && <p className="mt-0.5 text-[12.5px] text-ink-3">also called {aliases}</p>}
                  </div>
                  <SourceTag source={group.source} />
                </div>

                <div className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                  {preparationsLabel(group, { shown: docs, total })}
                </div>

                <ul className="mt-1 flex flex-col">
                  {group.docs.map((doc) => {
                    const open = details === doc._id;
                    return (
                      <li key={doc._id} className="border-t border-line-light py-3 first:border-t-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold leading-snug text-ink">
                              {preparationName(doc, group)}
                            </div>
                            {doc.name_fr && (
                              <div className="mt-0.5 text-[12px] text-ink-3">{doc.name_fr}</div>
                            )}
                            <MacroChips record={doc} className="mt-1.5" />
                          </div>
                          <button
                            type="button"
                            onClick={() => setDetails(open ? null : doc._id)}
                            className="shrink-0 cursor-pointer text-[11.5px] text-ink-3 underline-offset-2 hover:text-forest hover:underline"
                          >
                            {open ? 'less' : 'details'}
                          </button>
                        </div>

                        {open && (
                          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg bg-surface-2 p-2.5 text-[11.5px] text-ink-2">
                            {DETAIL_FIELDS.map(([label, read]) => {
                              const value = read(doc);
                              return (
                                <div key={label} className="contents">
                                  <dt className="text-ink-3">{label}</dt>
                                  <dd className="font-mono break-all">
                                    {value === null || value === undefined || value === '' ? '—' : String(value)}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>

        {total > PAGE_SIZE && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-3">
            <span className="tabular-nums">
              records {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" disabled={page <= 1 || status === 'loading'} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="tabular-nums">Page {page} of {pages}</span>
              <Button variant="ghost" disabled={page >= pages || status === 'loading'} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
