import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { RECIPE_GROUP_SEED, RECIPE_LIBRARY } from '../data/recipeGroups.js';
import { normalizeGroup } from '../lib/recipeGroups.js';

const RecipeGroupsContext = createContext(null);

export function RecipeGroupsProvider({ children }) {
  const [groups, setGroups] = useState(
    () => RECIPE_GROUP_SEED.map((g) => normalizeGroup(g, g.id)),
  );

  const createGroup = useCallback((data) => {
    const group = normalizeGroup(data);
    setGroups((prev) => [group, ...prev]);
    return group;
  }, []);

  const updateGroup = useCallback((id, patch) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? normalizeGroup({ ...g, ...patch }, g.id) : g)));
  }, []);

  const deleteGroup = useCallback((id) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  /* Everything in the library, plus anything a bundle already references
     — so a recipe added elsewhere never silently drops out of a group. */
  const recipeOptions = useMemo(() => {
    const seen = new Set(RECIPE_LIBRARY);
    groups.forEach((g) => g.recipes.forEach((r) => seen.add(r)));
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [groups]);

  const value = useMemo(
    () => ({ groups, recipeOptions, createGroup, updateGroup, deleteGroup }),
    [groups, recipeOptions, createGroup, updateGroup, deleteGroup],
  );

  return <RecipeGroupsContext.Provider value={value}>{children}</RecipeGroupsContext.Provider>;
}

export function useRecipeGroups() {
  const ctx = useContext(RecipeGroupsContext);
  if (!ctx) throw new Error('useRecipeGroups must be used inside <RecipeGroupsProvider>');
  return ctx;
}
