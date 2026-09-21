import { useEffect, useState } from 'react';
import { Spinner, cx } from '../../components/ui.jsx';
import { IconInfo, IconWarning } from '../../components/icons.jsx';
import { listIngredients, searchNutrition } from '../../lib/api.js';
import { groupByFood } from '../../lib/nutritionGroups.js';
import { SourceTag } from '../nutrition/parts.jsx';

const DEBOUNCE_MS = 350;

/**
 * Suggestions under the ingredient name field, from two places:
 *
 * - `GET /v1/ingredients` — what the catalogue already holds, so a second
 *   "Beans" is caught while it is still being typed rather than found
 *   months later. 174 ingredients is already too many to remember.
 * - `GET /v1/nutrition/ingredients` — the published food names, grouped by
 *   food, so the catalogue ends up spelling things the way the nutrition
 *   data does and the two line up later.
 *
 * Picking a suggestion only fills the name. Nothing else is copied: an
 * entry in the catalogue and a row in the nutrition tables are different
 * records, and the API holds no link between them.
 */
export default function NameSuggest({ value, onPick, excludeId }) {
  const [state, setState] = useState({ status: 'idle', existing: [], foods: [], error: null });
  const [dismissed, setDismissed] = useState('');

  const query = String(value || '').trim();

  useEffect(() => {
    if (query.length < 2) {
      setState({ status: 'idle', existing: [], foods: [], error: null });
      return undefined;
    }
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    setState((s) => ({ ...s, status: 'searching', error: null }));
    const timer = setTimeout(() => {
      Promise.all([
        listIngredients({ search: query, page: 1, limit: 5 }, opts).catch(() => null),
        searchNutrition({ search: query, page: 1, limit: 20 }, opts).catch(() => null),
      ]).then(([catalogue, nutrition]) => {
        setState({
          status: 'done',
          existing: (catalogue?.ingredients ?? [])
            .filter((d) => String(d._id) !== String(excludeId || ''))
            .map((d) => ({ id: String(d._id), name: d.name })),
          foods: groupByFood(nutrition?.docs ?? []).slice(0, 6),
          error: null,
        });
      }, (error) => {
        if (error.name !== 'AbortError') setState((s) => ({ ...s, status: 'error', error }));
      });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, excludeId]);

  const { status, existing, foods } = state;
  if (query.length < 2) return null;
  if (status === 'searching' && !existing.length && !foods.length) {
    return (
      <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink-3">
        <Spinner /> Looking for “{query}”…
      </div>
    );
  }
  if (status !== 'done' || (!existing.length && !foods.length)) return null;

  const showDuplicates = existing.length > 0 && dismissed !== query;

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      {showDuplicates && (
        <div className="rounded-lg border border-amber/40 bg-amber-light px-2.5 py-2 text-[11.5px] text-amber-deep">
          <div className="flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0"><IconWarning size={11} /></span>
            <div className="min-w-0">
              <b className="font-semibold">
                {existing.length === 1 ? 'A matching ingredient is' : `${existing.length} matching ingredients are`} already
                in the catalogue:
              </b>{' '}
              {existing.map((e) => e.name).join(', ')}.
              <button type="button" onClick={() => setDismissed(query)}
                className="ml-1.5 cursor-pointer underline underline-offset-2">Add anyway</button>
            </div>
          </div>
        </div>
      )}

      {foods.length > 0 && (
        <div className="rounded-lg border border-line bg-surface-2 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            <IconInfo size={11} /> Names in the nutrition data
          </div>
          <div className="flex flex-wrap gap-1.5">
            {foods.map((group) => (
              <button
                key={group.key}
                type="button"
                onClick={() => onPick(group.label)}
                title={`${group.docs.length} preparation${group.docs.length === 1 ? '' : 's'}`}
                className={cx(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface',
                  'px-2.5 py-1 text-[11.5px] text-ink-2 transition hover:border-forest hover:text-forest',
                )}
              >
                {group.label}
                <SourceTag source={group.source} />
                <span className="tabular-nums text-ink-3">{group.docs.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
