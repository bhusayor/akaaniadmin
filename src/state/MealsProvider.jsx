import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { MEALS as SEED, BLANK_MEAL } from '../data/meals.js';

/* Meals live above the router so an edit on the detail page is still
   there when you navigate back to the list. */
const MealsContext = createContext(null);

export function MealsProvider({ children }) {
  const [meals, setMeals] = useState(SEED);

  /**
   * A new meal starts from the same shape an existing one has, so the edit
   * form and the detail page never have to guard against half a record.
   * The id is one past the highest in use rather than `length + 1`, which
   * collides the moment anything has been deleted.
   */
  const createMeal = useCallback((data = {}) => {
    let created;
    setMeals((prev) => {
      const id = prev.reduce((max, m) => Math.max(max, m.id), 0) + 1;
      created = { ...BLANK_MEAL, ...data, id };
      return [created, ...prev];
    });
    return created;
  }, []);

  const updateMeal = useCallback((id, patch) => {
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const deleteMeal = useCallback((id) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  /** Clears the list. Returns how many went, so the toast can say. */
  const deleteAllMeals = useCallback(() => {
    let n = 0;
    setMeals((prev) => { n = prev.length; return []; });
    return n;
  }, []);

  const getMeal = useCallback((id) => meals.find((m) => String(m.id) === String(id)), [meals]);

  const value = useMemo(
    () => ({ meals, createMeal, updateMeal, deleteMeal, deleteAllMeals, getMeal }),
    [meals, createMeal, updateMeal, deleteMeal, deleteAllMeals, getMeal],
  );

  return <MealsContext.Provider value={value}>{children}</MealsContext.Provider>;
}

export function useMeals() {
  const ctx = useContext(MealsContext);
  if (!ctx) throw new Error('useMeals must be used inside <MealsProvider>');
  return ctx;
}
