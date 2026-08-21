import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { INGREDIENT_SEED } from '../data/ingredients.js';
import { normalizeIngredient } from '../lib/ingredients.js';

/* Ingredients live above the router, like every other entity — held in the
   page they vanished the moment you navigated away and came back. */
const IngredientsContext = createContext(null);

export function IngredientsProvider({ children }) {
  const [ingredients, setIngredients] = useState(
    () => INGREDIENT_SEED.map((i) => normalizeIngredient(i, i.id)),
  );

  const createIngredient = useCallback((data) => {
    const row = normalizeIngredient(data);
    setIngredients((prev) => [row, ...prev]);
    return row;
  }, []);

  /** Bulk path for the CSV importer — one write, not one per row. */
  const createIngredients = useCallback((list) => {
    const rows = list.map((d) => normalizeIngredient(d));
    setIngredients((prev) => [...rows, ...prev]);
    return rows;
  }, []);

  const updateIngredient = useCallback((id, data) => {
    setIngredients((prev) => prev.map((r) => (r.id === id ? normalizeIngredient(data, id) : r)));
  }, []);

  const deleteIngredient = useCallback((id) => {
    setIngredients((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const value = useMemo(
    () => ({ ingredients, createIngredient, createIngredients, updateIngredient, deleteIngredient }),
    [ingredients, createIngredient, createIngredients, updateIngredient, deleteIngredient],
  );

  return <IngredientsContext.Provider value={value}>{children}</IngredientsContext.Provider>;
}

export function useIngredients() {
  const ctx = useContext(IngredientsContext);
  if (!ctx) throw new Error('useIngredients must be used inside <IngredientsProvider>');
  return ctx;
}
