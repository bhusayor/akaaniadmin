import { useEffect, useState } from 'react';
import { Input, Select, Spinner, cx } from '../../components/ui.jsx';
import { IconPlus, IconSearch } from '../../components/icons.jsx';
import { isExpiredSession, NUTRITION_SOURCES, searchNutrition } from '../../lib/api.js';
import { groupByFood, preparationName, preparationsLabel } from '../../lib/nutritionGroups.js';
import { MacroChips, SourceTag } from './parts.jsx';

const DEBOUNCE_MS = 350;
/* Wide enough that a food's preparations land on one page: fonio alone
   has eight, and a group split across pages would understate itself. */
const LIMIT = 50;

/**
 * Searches the platform's food composition data and presents it the way
 * the data is actually shaped: one entry per *food*, with its
 * preparations underneath.
 *
 * Nothing is chosen until someone clicks +. `onPick(record)` receives the
 * preparation — the row the calculation will use — never the group.
 */
export default function NutritionPicker({ initialQuery = '', onPick, onClose, autoFocus = true }) {
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState('');
  const [open, setOpen] = useState(null);
  const [state, setState] = useState({ status: 'idle', groups: [], shown: 0, total: 0, error: null });

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setState({ status: 'idle', groups: [], shown: 0, total: 0, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'searching', error: null }));
    const timer = setTimeout(() => {
      searchNutrition({ search: q, source: source || undefined, page: 1, limit: LIMIT }, { signal: controller.signal })
        .then(
          (data) => {
            const docs = data?.docs ?? [];
            const groups = groupByFood(docs);
            setState({
              status: 'done',
              groups,
              shown: docs.length,
              total: data?.stats?.docs ?? docs.length,
              error: null,
            });
            // One food found: open it, since there is nothing to choose between.
            setOpen(groups.length === 1 ? groups[0].key : null);
          },
          (error) => {
            if (error.name === 'AbortError') return;
            setState({ status: 'error', groups: [], shown: 0, total: 0, error });
          },
        );
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, source]);

  const { status, groups, shown, total, error } = state;

  return (
    <div className="mt-2 animate-fade-up rounded-xl border border-ocean/40 bg-ocean-light/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ocean-deep">
          Add ingredient · nutrition data
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
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods, e.g. fonio"
            className="py-2 pl-8 text-[12.5px]"
          />
        </div>
        <Select value={source} onChange={(e) => setSource(e.target.value)} className="py-2 text-[12.5px]">
          <option value="">All sources</option>
          {NUTRITION_SOURCES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </Select>
      </div>

      {status === 'done' && groups.length > 0 && (
        <div className="mt-2 text-[11px] uppercase tracking-[0.06em] text-ink-3">
          {groups.length} {groups.length === 1 ? 'ingredient' : 'ingredients'}
          {total > shown && <span className="normal-case tracking-normal"> · {total} matches in total, showing the first {shown}</span>}
        </div>
      )}

      <div className="scroll-thin mt-2 flex max-h-[22rem] flex-col overflow-y-auto">
        {status === 'idle' && <div className="py-2 text-[11.5px] text-ink-3">Type at least two letters.</div>}
        {status === 'searching' && !groups.length && (
          <div className="flex items-center gap-2 py-2 text-[11.5px] text-ink-3"><Spinner /> Searching…</div>
        )}
        {status === 'error' && (
          <div role="alert" className="py-2 text-[11.5px] text-chili">
            {isExpiredSession(error) ? 'Your session has expired — sign in again.' : error.message}
          </div>
        )}
        {status === 'done' && !groups.length && (
          <div className="py-2 text-[11.5px] text-ink-3">Nothing found for “{query.trim()}”.</div>
        )}

        {groups.map((group) => {
          const expanded = open === group.key;
          return (
            <div key={group.key} className="border-t border-line/70 first:border-t-0">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : group.key)}
                aria-expanded={expanded}
                className="flex w-full cursor-pointer items-center justify-between gap-2 py-2 text-left"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-ink">{group.label}</span>
                    <SourceTag source={group.source} />
                  </span>
                  <span className="mt-0.5 block text-[11px] uppercase tracking-[0.06em] text-ink-3">
                    {preparationsLabel(group, { shown, total })}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-ink-3">{expanded ? 'Hide' : 'Show'}</span>
              </button>

              {expanded && (
                <ul className="mb-2 flex flex-col gap-1.5">
                  {group.docs.map((doc) => (
                    <li key={doc._id}
                      className="flex items-start justify-between gap-3 rounded-lg bg-surface px-2.5 py-2">
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium leading-snug text-ink">
                          {preparationName(doc, group)}
                        </div>
                        {doc.name_fr && <div className="text-[11px] italic text-ink-3">{doc.name_fr}</div>}
                        <MacroChips record={doc} className="mt-1" />
                      </div>
                      <button
                        type="button"
                        onClick={() => onPick(doc)}
                        title={`Use ${doc.name}`}
                        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-surface text-rust transition hover:border-rust hover:bg-rust hover:text-white"
                      >
                        <IconPlus size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
