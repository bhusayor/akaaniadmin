import { useSearchParams } from 'react-router-dom';
import useTopbar from '../hooks/useTopbar.js';
import { cx } from '../components/ui.jsx';
import PlatformCatalogue from '../features/ingredients/PlatformCatalogue.jsx';
import LocalLibrary from '../features/ingredients/LocalLibrary.jsx';

/* Two collections, deliberately kept apart:
   - Platform: platform-api's Ingredient catalogue, the one meals and
     partners use. It stores no nutrition values.
   - Library: this admin's own list with per-100g macros, WAFCT/USDA
     matching and CSV import — data the backend has nowhere to hold yet. */
const TABS = [
  { key: 'platform', label: 'Platform' },
  { key: 'library', label: 'Nutrition library' },
];

export default function Ingredients() {
  useTopbar('Ingredients', 'Search ingredients…');
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'platform';

  const tabs = (
    <div role="tablist" className="flex rounded-lg border border-line bg-canvas p-0.5">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => setParams(t.key === 'platform' ? {} : { tab: t.key }, { replace: true })}
          className={cx(
            'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition',
            tab === t.key ? 'bg-surface text-forest shadow-sm' : 'text-ink-3 hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return tab === 'platform' ? <PlatformCatalogue tabs={tabs} /> : <LocalLibrary tabs={tabs} />;
}
