import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadSettings, saveSettings, endpointFor, mergeSettings, UNITS_BY_SYSTEM } from '../lib/settings.js';
import * as nutritionEstimate from '../lib/nutritionEstimate.js';
import * as blogGenerate from '../lib/blogGenerate.js';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  /* The whole point of this provider: the AI section actually reconfigures
     the libraries. Before this, provider and endpoint could only be changed
     by editing source. */
  useEffect(() => {
    const { provider, baseUrl } = settings.ai;
    nutritionEstimate.configure({ provider, endpoint: endpointFor(baseUrl, '/estimate') });
    blogGenerate.configure({ provider, endpoint: endpointFor(baseUrl, '/generate-blog') });
  }, [settings.ai]);

  useEffect(() => { saveSettings(settings); }, [settings]);

  const update = useCallback((section, patch) => {
    setSettings((prev) => ({
      ...prev,
      // Array sections (team) are replaced, not spread — spreading an array
      // into an object yields {0: …, 1: …} and destroys the list.
      [section]: Array.isArray(patch) ? patch : { ...prev[section], ...patch },
    }));
  }, []);

  /** Back to shipped defaults, section by section. */
  const reset = useCallback((section) => {
    setSettings((prev) => (section
      ? { ...prev, [section]: mergeSettings(null)[section] }
      : mergeSettings(null)));
  }, []);

  /* Derived so callers never have to re-derive it and drift. */
  const units = useMemo(
    () => UNITS_BY_SYSTEM[settings.localization.measurement] ?? UNITS_BY_SYSTEM.metric,
    [settings.localization.measurement],
  );

  const value = useMemo(
    () => ({ settings, update, reset, units }),
    [settings, update, reset, units],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
