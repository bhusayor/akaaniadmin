import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSearch } from '../../hooks/useTopbar.js';
import {
  Button, Card, CountBadge, EmptyState, FilterSelect, PageToolbar, Spinner, Td, Th,
} from '../../components/ui.jsx';
import { IconRefresh } from '../../components/icons.jsx';
/* API switched off — the local WAFCT + USDA data stands in for it.
import { NUTRITION_SOURCES, listNutritionFoodGroups, searchNutrition } from '../../lib/api.js';
*/
import { NUTRITION_SOURCES, listProductGroups, searchNutrition } from '../../lib/nutritionData.js';
import { macroValue } from '../../lib/mealNutrition.js';
import { SourceTag } from '../nutrition/parts.jsx';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 200;

/* Identifiers a record carries beyond its figures. Shown on demand: useful
   when reconciling with the source tables, noise the rest of the time. */
const DETAIL_FIELDS = [
  ['French name', (d) => d.name_fr],
  ['food', (d) => d.food_name],
  ['source id', (d) => (d.source === 'usda' ? `FDC ${d.external_id}` : `WAFCT ${d.external_id}`)],
  ['food_id', (d) => d.food_id],
  ['food_variant_id', (d) => d.food_variant_id],
  ['food_group_code', (d) => d.food_group_code],
  ['ndb_number', (d) => d.ndb_number],
  ['carbohydrate', (d) => {
    const v = macroValue(d.nutrients_per_100g?.carbohydrate);
    return v === null ? null : `${v} g`;
  }],
  ['quality_status', (d) => d.quality_status],
  ['estimated_nutrients', (d) => (d.estimated_nutrients || []).join(', ')],
];

/**
 * One per-100g figure, right-aligned. A nutrient the source never
 * published is an em dash, not 0; an asterisk marks a figure the source
 * bracketed as lower-confidence.
 */
function MacroCell({ record, nutrient, unit = '' }) {
  const value = macroValue(record?.nutrients_per_100g?.[nutrient]);
  const estimated = (record?.estimated_nutrients || []).includes(nutrient);
  return (
    <Td className="whitespace-nowrap text-right tabular-nums">
      {value === null ? (
        <span className="text-ink-3">—</span>
      ) : (
        <span className={estimated ? 'text-amber-deep' : undefined}
          title={estimated ? 'Bracketed in the source — a lower-confidence figure' : undefined}>
          {value}{unit}{estimated ? '*' : ''}
        </span>
      )}
    </Td>
  );
}

/**
 * The food composition data meals are calculated against: 1,028 WAFCT
 * variants from the Akaani data model workbook and 363 USDA Foundation
 * Foods, all per 100 g.
 *
 * One row per record, A → Z by name, with the columns people scan for:
 * product group, kcal, protein, fat, fibre, and where it came from.
 * Read-only: these are published tables, not something the admin edits.
 */
export default function NutritionLibrary({ tabs }) {
  const [search] = useSearch();

  const [query, setQuery] = useState(search.trim());
  const [source, setSource] = useState('');
  const [productGroup, setProductGroup] = useState('');
  const [groups, setGroups] = useState([]);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [details, setDetails] = useState(null);
  const [state, setState] = useState({ status: 'loading', rows: [], stats: null, error: null });

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [source, productGroup]);

  useEffect(() => {
    let live = true;
    listProductGroups().then((list) => live && setGroups(list), () => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    searchNutrition({
      search: query,
      source: source || undefined,
      product_group: productGroup || undefined,
      page,
      limit: PAGE_SIZE,
    }).then(
      (data) => live && setState({ status: 'ready', rows: data.docs, stats: data.stats, error: null }),
      (error) => live && setState((s) => ({ ...s, status: 'error', error })),
    );
    return () => { live = false; };
  }, [query, source, productGroup, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const { status, rows, stats, error } = state;
  const total = stats?.docs ?? 0;
  const bySource = stats?.by_source || {};
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, total);
  /* by_source counts the same search across both sources, ignoring the source
     filter, so it also says how many matches a filter is hiding. */
  const hidden = source ? Object.entries(bySource).filter(([k, v]) => k !== source && v) : [];
  const shownGroups = groups.filter((g) => !source || g.source === source);

  return (
    <>
      <PageToolbar
        left={
          <>
            {tabs}
            <FilterSelect value={source} onChange={(e) => { setSource(e.target.value); setProductGroup(''); }}>
              <option value="">All sources</option>
              {NUTRITION_SOURCES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </FilterSelect>
            <FilterSelect value={productGroup} onChange={(e) => setProductGroup(e.target.value)}>
              <option value="">All product groups</option>
              {shownGroups.map((g) => (
                <option key={`${g.source}|${g.name}`} value={g.name}>
                  {g.name}{source ? '' : ` · ${g.source.toUpperCase()}`} ({g.count})
                </option>
              ))}
            </FilterSelect>
            <CountBadge>
              {status === 'loading' && !rows.length
                ? '…'
                : `${total.toLocaleString()} ingredient${total === 1 ? '' : 's'}`}
            </CountBadge>
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
            <span className="text-ink-3">· figures per 100 g edible portion</span>
          </div>
        )}

        {status === 'error' && (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-chili/30 bg-chili-light px-4 py-3 text-[13px] text-chili-deep">
            <span className="min-w-0 flex-1">Could not load nutrition data: {error.message}</span>
            <Button variant="ghost" onClick={reload}>Try again</Button>
          </div>
        )}

        {status !== 'error' && (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse max-md:min-w-[760px]">
                <thead>
                  <tr>
                    <Th>Ingredient</Th>
                    <Th>Product group</Th>
                    <Th className="text-right">Kcal</Th>
                    <Th className="text-right">Protein</Th>
                    <Th className="text-right">Fat</Th>
                    <Th className="text-right">Fibre</Th>
                    <Th>Source</Th>
                  </tr>
                </thead>
                <tbody className={status === 'loading' ? 'opacity-60' : undefined}>
                  {rows.map((doc) => {
                    const open = details === doc._id;
                    const aliases = doc.local_names || [];
                    return (
                      <Fragment key={doc._id}>
                        <tr className="group transition hover:bg-[#FAFBFD]">
                          <Td className="max-w-[420px]">
                            <div className="font-medium leading-snug">{doc.name}</div>
                            {aliases.length > 0 && (
                              <div className="truncate text-[11.5px] text-ink-3"
                                title="Local names from the nutrition data model. Not yet confirmed (REVIEW_REQUIRED).">
                                also called {aliases.join(', ')}?
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setDetails(open ? null : doc._id)}
                              className="cursor-pointer text-[11px] text-ink-3 underline-offset-2 hover:text-forest hover:underline"
                            >
                              {open ? 'hide details' : 'details'}
                            </button>
                          </Td>
                          <Td className="text-[12.5px]">
                            {doc.product_group || <span className="italic text-ink-3">—</span>}
                          </Td>
                          <MacroCell record={doc} nutrient="calories" />
                          <MacroCell record={doc} nutrient="protein" unit="g" />
                          <MacroCell record={doc} nutrient="fat" unit="g" />
                          <MacroCell record={doc} nutrient="fiber" unit="g" />
                          <Td><SourceTag source={doc.source} /></Td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={7} className="border-b border-line-light bg-surface-2 px-4 py-2.5">
                              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px] text-ink-2">
                                {DETAIL_FIELDS.map(([label, read]) => {
                                  const value = read(doc);
                                  if (value === null || value === undefined || value === '') return null;
                                  return (
                                    <div key={label} className="contents">
                                      <dt className="text-ink-3">{label}</dt>
                                      <dd className="font-mono break-all">{String(value)}</dd>
                                    </div>
                                  );
                                })}
                              </dl>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {status === 'loading' && !rows.length && (
              <div className="grid place-items-center py-16"><Spinner className="size-6" /></div>
            )}
            {status === 'ready' && !rows.length && (
              <EmptyState
                icon="🔍"
                title={query ? `No records match “${query}”` : 'No records match these filters'}
                sub="Values are per 100g of edible portion, from the published tables."
              />
            )}

            {total > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-ink-3">
                <span className="tabular-nums">
                  {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
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
          </Card>
        )}
      </div>
    </>
  );
}
