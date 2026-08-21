import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { LU_FACT_SEED } from '../data/luFacts.js';
import { normalizeFact, duplicateTitles } from '../lib/luFacts.js';

const LuFactsContext = createContext(null);

export function LuFactsProvider({ children }) {
  const [facts, setFacts] = useState(() => LU_FACT_SEED.map((f) => normalizeFact(f, f.id)));

  const createFact = useCallback((data) => {
    const fact = normalizeFact(data);
    setFacts((prev) => [fact, ...prev]);
    return fact;
  }, []);

  const updateFact = useCallback((id, patch) => {
    setFacts((prev) => prev.map((f) => (f.id === id
      // Stamp the edit date so the list reflects when it last changed,
      // not only when it was written.
      ? normalizeFact({ ...f, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }, id)
      : f)));
  }, []);

  const deleteFact = useCallback((id) => setFacts((prev) => prev.filter((f) => f.id !== id)), []);

  const duplicates = useMemo(() => duplicateTitles(facts), [facts]);

  const value = useMemo(
    () => ({ facts, duplicates, createFact, updateFact, deleteFact }),
    [facts, duplicates, createFact, updateFact, deleteFact],
  );

  return <LuFactsContext.Provider value={value}>{children}</LuFactsContext.Provider>;
}

export function useLuFacts() {
  const ctx = useContext(LuFactsContext);
  if (!ctx) throw new Error('useLuFacts must be used inside <LuFactsProvider>');
  return ctx;
}
