import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { MEAL_TAG_SEED } from '../data/mealTags.js';
import { normalizeTag, usageByTag, orphanTags } from '../lib/mealTags.js';
import { useMeals } from './MealsProvider.jsx';

const MealTagsContext = createContext(null);

export function MealTagsProvider({ children }) {
  const [tags, setTags] = useState(() => MEAL_TAG_SEED.map((t) => normalizeTag(t, t.id)));
  const { meals, updateMeal } = useMeals();

  /* Counts come from the meals, never from a stored number on the tag —
     a cached count is a count that eventually lies. */
  const usage = useMemo(() => usageByTag(meals), [meals]);
  const orphans = useMemo(() => orphanTags(meals, tags), [meals, tags]);

  const createTag = useCallback((data) => {
    const tag = normalizeTag(data);
    setTags((prev) => [tag, ...prev]);
    return tag;
  }, []);

  /**
   * Renaming a tag has to follow through to every meal carrying it,
   * or the meals keep the old string and quietly fall out of the filter.
   */
  const updateTag = useCallback((id, patch) => {
    const before = tags.find((t) => t.id === id);
    if (!before) return;
    const after = normalizeTag({ ...before, ...patch }, id);

    /* Outside the setTags updater on purpose. Updaters must be pure —
       touching another provider's state from inside one is the
       "cannot update a component while rendering a different component"
       warning, and StrictMode runs the updater twice, so the meal writes
       were unreliable and the rename silently failed to propagate. */
    if (before.name !== after.name) {
      meals.forEach((m) => {
        if (m.tags.includes(before.name)) {
          updateMeal(m.id, { tags: m.tags.map((t) => (t === before.name ? after.name : t)) });
        }
      });
    }

    setTags((prev) => prev.map((t) => (t.id === id ? after : t)));
  }, [tags, meals, updateMeal]);

  /** Detaches the tag from every meal first, so nothing keeps a dead string. */
  const deleteTag = useCallback((id) => {
    const tag = tags.find((t) => t.id === id);
    if (tag) {
      meals.forEach((m) => {
        if (m.tags.includes(tag.name)) {
          updateMeal(m.id, { tags: m.tags.filter((t) => t !== tag.name) });
        }
      });
    }
    setTags((prev) => prev.filter((t) => t.id !== id));
  }, [tags, meals, updateMeal]);

  const deleteTags = useCallback((ids) => ids.forEach((id) => deleteTag(id)), [deleteTag]);

  const recategorize = useCallback((ids, category) => {
    setTags((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, category } : t)));
  }, []);

  /** Replaces the set of meals carrying this tag, in one pass. */
  const setTaggedMeals = useCallback((tagName, mealIds) => {
    const wanted = new Set(mealIds);
    meals.forEach((m) => {
      const has = m.tags.includes(tagName);
      if (wanted.has(m.id) && !has) updateMeal(m.id, { tags: [...m.tags, tagName] });
      else if (!wanted.has(m.id) && has) updateMeal(m.id, { tags: m.tags.filter((t) => t !== tagName) });
    });
  }, [meals, updateMeal]);

  /** Promotes an orphan string into the managed vocabulary. */
  const adoptOrphan = useCallback((name, category) => {
    setTags((prev) => [normalizeTag({ name, category, description: '' }), ...prev]);
  }, []);

  const value = useMemo(() => ({
    tags, usage, orphans, meals,
    createTag, updateTag, deleteTag, deleteTags, recategorize, setTaggedMeals, adoptOrphan,
  }), [tags, usage, orphans, meals, createTag, updateTag, deleteTag, deleteTags, recategorize, setTaggedMeals, adoptOrphan]);

  return <MealTagsContext.Provider value={value}>{children}</MealTagsContext.Provider>;
}

export function useMealTags() {
  const ctx = useContext(MealTagsContext);
  if (!ctx) throw new Error('useMealTags must be used inside <MealTagsProvider>');
  return ctx;
}
