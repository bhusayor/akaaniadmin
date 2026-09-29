import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { mealFromApi, mealToApi } from '../lib/meals.js';
import { useAuth } from './AuthProvider.jsx';

/* Meals come from platform-api (GET /v1/meals) and are written back to it,
   so a meal created here is on the platform and still there after a
   reload. They live above the router so the list, the detail page and the
   editor all read the same copy.

   The list is fetched whole (paged 100 at a time) because the Meals page
   filters by type, country and tag on the client. */
const MealsContext = createContext(null);

const PAGE_SIZE = 100;
/* A runaway guard: a backend that kept answering full pages would
   otherwise loop forever. 50 pages is 5,000 meals. */
const MAX_PAGES = 50;

const byName = (a, b) => a.name.localeCompare(b.name);

async function fetchAllMeals(opts) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    // eslint-disable-next-line no-await-in-loop
    const data = await api.listMeals({ page, limit: PAGE_SIZE }, opts);
    const batch = data?.meals ?? [];
    all.push(...batch);
    const total = Number(data?.stats?.docs);
    if (batch.length < PAGE_SIZE || (Number.isFinite(total) && all.length >= total)) break;
  }
  return all.map(mealFromApi).sort(byName);
}

/* Tag and product group ids, by lowercased name. Fetched once per session
   when the first meal is written; a failed load is not cached. */
async function fetchLookups() {
  const [tags, groups] = await Promise.all([api.listTags(), api.listProductGroups()]);
  const index = (rows) => new Map(rows.map((r) => [String(r.name).trim().toLowerCase(), String(r._id)]));
  return { tags, tagIds: index(tags), productGroupIds: index(groups) };
}

export function MealsProvider({ children }) {
  const { session } = useAuth();
  const [state, setState] = useState({ status: 'idle', meals: [], error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const lookupsRef = useRef(null);

  useEffect(() => {
    if (!session) {
      setState({ status: 'idle', meals: [], error: null });
      lookupsRef.current = null;
      return undefined;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    fetchAllMeals({ signal: controller.signal }).then(
      (meals) => setState({ status: 'ready', meals, error: null }),
      (error) => {
        if (error.name !== 'AbortError') setState((s) => ({ ...s, status: 'error', error }));
      },
    );
    return () => controller.abort();
  }, [session, reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const lookups = useCallback(() => {
    if (!lookupsRef.current) {
      lookupsRef.current = fetchLookups().catch((err) => {
        lookupsRef.current = null;
        throw err;
      });
    }
    return lookupsRef.current;
  }, []);

  /** Puts one meal into the cache, replacing any copy with the same id. */
  const upsert = useCallback((meal) => {
    setState((s) => ({
      ...s,
      meals: [...s.meals.filter((m) => m.id !== meal.id), meal].sort(byName),
    }));
    return meal;
  }, []);

  /* A write answers with tags and product groups as bare ids; the single
     GET populates them, so the saved meal is read back from there. */
  const readBack = useCallback(async (id, fallback) => {
    try {
      return upsert(mealFromApi(await api.getMeal(id)));
    } catch {
      return upsert(fallback);
    }
  }, [upsert]);

  /** POST /v1/meals. Resolves to the saved meal; rejects with the API's error. */
  const createMeal = useCallback(async (payload) => {
    const body = mealToApi(payload, await lookups());
    const created = await api.createMeal(body);
    const id = String(created?._id ?? created?.id);
    return readBack(id, { ...mealFromApi({ ...created, _id: id }), tags: payload.tags ?? [] });
  }, [lookups, readBack]);

  /** PUT /v1/meals/:id. Resolves to the saved meal. */
  const updateMeal = useCallback(async (id, payload) => {
    const body = mealToApi(payload, await lookups());
    const updated = await api.updateMeal(id, body);
    return readBack(String(id), { ...mealFromApi({ ...updated, _id: id }), tags: payload.tags ?? [] });
  }, [lookups, readBack]);

  /** DELETE /v1/meals/:id. */
  const deleteMeal = useCallback(async (id) => {
    await api.deleteMeal(id);
    setState((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== String(id)) }));
  }, []);

  const getMeal = useCallback(
    (id) => state.meals.find((m) => m.id === String(id)),
    [state.meals],
  );

  /** GET /v1/meals/:id into the cache — for a deep link to a meal the list has not loaded. */
  const fetchMeal = useCallback(async (id) => upsert(mealFromApi(await api.getMeal(id))), [upsert]);

  /**
   * Changes the copy held here without writing to the platform.
   *
   * For the Meal Tags page, whose vocabulary is still local: renaming a
   * local tag must not rewrite platform meals with tag names the API does
   * not know.
   */
  const patchLocal = useCallback((id, patch) => {
    setState((s) => ({ ...s, meals: s.meals.map((m) => (m.id === String(id) ? { ...m, ...patch } : m)) }));
  }, []);

  const value = useMemo(() => ({
    meals: state.meals,
    status: state.status,
    error: state.error,
    reload,
    lookups,
    createMeal,
    updateMeal,
    deleteMeal,
    getMeal,
    fetchMeal,
    patchLocal,
  }), [state, reload, lookups, createMeal, updateMeal, deleteMeal, getMeal, fetchMeal, patchLocal]);

  return <MealsContext.Provider value={value}>{children}</MealsContext.Provider>;
}

export function useMeals() {
  const ctx = useContext(MealsContext);
  if (!ctx) throw new Error('useMeals must be used inside <MealsProvider>');
  return ctx;
}
