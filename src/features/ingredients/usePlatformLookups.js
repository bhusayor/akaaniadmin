import { useCallback, useEffect, useState } from 'react';
import { listProductCategories, listProductGroups, listUnits } from '../../lib/api.js';

/* Units, product groups and categories change rarely, so they are fetched
   once per page load and shared by every form that needs them. A failed
   load is not cached, so "Retry" really retries. */
let cached = null;

function load() {
  if (!cached) {
    cached = Promise.all([listUnits(), listProductGroups(), listProductCategories()])
      .then(([units, groups, categories]) => ({ units, groups, categories }))
      .catch((err) => {
        cached = null;
        throw err;
      });
  }
  return cached;
}

const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));

/** `{ status: 'loading' | 'ready' | 'error', units, groups, categories, error, retry }` */
export default function usePlatformLookups(enabled = true) {
  const [state, setState] = useState({ status: 'loading', units: [], groups: [], categories: [], error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    load().then(
      (data) => live && setState({
        status: 'ready',
        units: [...data.units].sort(byName),
        groups: [...data.groups].sort(byName),
        categories: [...data.categories].sort(byName),
        error: null,
      }),
      (error) => live && setState((s) => ({ ...s, status: 'error', error })),
    );
    return () => { live = false; };
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
