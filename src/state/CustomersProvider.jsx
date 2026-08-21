import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CUSTOMERS } from '../data/customers.js';

const CustomersContext = createContext(null);

export function CustomersProvider({ children }) {
  const [customers, setCustomers] = useState(CUSTOMERS);

  const getCustomer = useCallback(
    (id) => customers.find((c) => String(c.id) === String(id)) ?? null,
    [customers],
  );

  const updateCustomer = useCallback((id, patch) => {
    setCustomers((prev) => prev.map((c) => (String(c.id) === String(id) ? { ...c, ...patch } : c)));
  }, []);

  /**
   * Flipping a status is not a field edit — an account going quiet is
   * dated, and reactivating it clears that date. Leaving a stale `lapsedOn`
   * on a live account would quietly corrupt the churn count on both
   * overview panels.
   */
  const setStatus = useCallback((id, status, asOf) => {
    setCustomers((prev) => prev.map((c) => {
      if (String(c.id) !== String(id)) return c;
      if (status === 'inactive') {
        const on = asOf ?? new Date().toISOString().slice(0, 10);
        return { ...c, status, lapsedOn: c.lapsedOn ?? (on < c.joined ? c.joined : on) };
      }
      const { lapsedOn, ...rest } = c;
      return { ...rest, status };
    }));
  }, []);

  const deleteCustomers = useCallback((ids) => {
    const drop = new Set(ids.map(String));
    setCustomers((prev) => prev.filter((c) => !drop.has(String(c.id))));
  }, []);

  const value = useMemo(
    () => ({ customers, getCustomer, updateCustomer, setStatus, deleteCustomers }),
    [customers, getCustomer, updateCustomer, setStatus, deleteCustomers],
  );

  return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>;
}

export function useCustomers() {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error('useCustomers must be used inside <CustomersProvider>');
  return ctx;
}
