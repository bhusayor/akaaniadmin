import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { PLAN_SEED, TRANSACTION_SEED, MONTHS } from '../data/finance.js';

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const [plans, setPlans] = useState(PLAN_SEED);
  const [transactions, setTransactions] = useState(TRANSACTION_SEED);

  /* A retried charge goes to `pending`, not `paid` — the money has not
     arrived yet, and showing it as revenue before the processor confirms
     is the whole reason failed charges get lost in the first place. */
  const retryCharge = useCallback((id) => {
    setTransactions((prev) => prev.map((t) => (
      t.id === id && t.status === 'failed' ? { ...t, status: 'pending' } : t
    )));
  }, []);

  /**
   * Every failed charge at once — the alert is the whole point of the page.
   *
   * Scoped to one currency, because the page only ever shows one at a time:
   * a button reading "Retry all 134" must not quietly touch the 31 charges
   * on the other tab.
   */
  const retryAllFailed = useCallback((currency) => {
    let n = 0;
    setTransactions((prev) => prev.map((t) => {
      if (t.status !== 'failed') return t;
      if (currency && t.currency !== currency) return t;
      n += 1;
      return { ...t, status: 'pending' };
    }));
    return n;
  }, []);

  const refundCharge = useCallback((id) => {
    setTransactions((prev) => prev.map((t) => (
      t.id === id && t.status === 'paid' ? { ...t, status: 'refunded' } : t
    )));
  }, []);

  const updatePlan = useCallback((id, patch) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const value = useMemo(
    () => ({ plans, transactions, months: MONTHS, retryCharge, retryAllFailed, refundCharge, updatePlan }),
    [plans, transactions, retryCharge, retryAllFailed, refundCharge, updatePlan],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside <FinanceProvider>');
  return ctx;
}
