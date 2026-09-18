import { useSearchParams } from 'react-router-dom';
import useTopbar from '../hooks/useTopbar.js';
import { cx } from '../components/ui.jsx';
import PlatformCatalogue from '../features/ingredients/PlatformCatalogue.jsx';
import NutritionLibrary from '../features/ingredients/NutritionLibrary.jsx';

/* Two collections on the platform, deliberately kept apart:
   - Platform: the Ingredient catalogue meals and partners use. It carries
     no nutrition values.
   - Nutrition: the published food composition data (WAFCT + USDA) behind
     GET /v1/nutrition/ingredients, which is what meals are calculated
     against. Read-only: the API has no write route for it. */
const TABS = [
  { key: 'platform', label: 'Platform' },
  { key: 'library', label: 'Nutrition data' },
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

  return tab === 'platform' ? <PlatformCatalogue tabs={tabs} /> : <NutritionLibrary tabs={tabs} />;
}
