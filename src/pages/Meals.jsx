import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTopbar, { useSearch } from '../hooks/useTopbar.js';
import {
  Button, Card, FilterSelect, CountBadge, PageToolbar, EmptyState, cx,
} from '../components/ui.jsx';
import { IconDownload, IconPlus } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import MealCard from '../features/meals/MealCard.jsx';
import { useMeals } from '../state/MealsProvider.jsx';
import { downloadCSV } from '../lib/csv.js';
import { mealExportRows } from '../lib/mealExport.js';

const PER_PAGE = 10;

/*
 * One card per meal, sorted by name.
 *
 * The previous build grouped meals under their tags, which meant a meal
 * carrying several tags was drawn once per tag — 21 meals produced 39
 * cards, and editing "Boiled Egg & Yam" under High Protein left a stale
 * copy sitting under Low Carb. Tags are a filter here, never a grouping.
 */
export default function Meals() {
  useTopbar('Meals', 'Search meals…');
  const [search] = useSearch();
  const toast = useToast();
  const navigate = useNavigate();

  const [type, setType] = useState('');
  const [country, setCountry] = useState('');
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(1);
  const { meals } = useMeals();

  /* Derived from the meals themselves, not a static list — otherwise
     renaming a tag in Meal Tags leaves this filter offering a name that
     no longer matches anything. */
  const tagOptions = useMemo(
    () => [...new Set(meals.flatMap((m) => m.tags))].sort((a, b) => a.localeCompare(b)),
    [meals],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return meals
      .filter((m) => {
        const types = m.types ?? [m.type];
        if (q && !m.name.toLowerCase().includes(q)) return false;
        if (type && !types.includes(type)) return false;
        if (country && !m.countries.includes(country)) return false;
        if (tag && !m.tags.includes(tag)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [meals, search, type, country, tag]);

  /* Filtering can shorten the list past the current page. */
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  useEffect(() => { setPage(1); }, [search, type, country, tag]);
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  /* Everything a meal carries, ingredients and steps included — a summary
     export is no use to anyone editing recipes outside the admin. */
  const exportCSV = () => {
    downloadCSV('akaani-meals.csv', mealExportRows(filtered));
    toast(`Exported ${filtered.length} meals with full recipe detail`);
  };

  return (
    <>
      <PageToolbar
        left={
          <>
            <FilterSelect value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All meal types</option>
              {['breakfast', 'lunch', 'dinner', 'snack'].map((t) => (
                <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">All countries</option>
              {['Nigeria', 'Ghana', 'Kenya'].map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
            <FilterSelect value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">All tags</option>
              {tagOptions.map((t) => <option key={t}>{t}</option>)}
            </FilterSelect>
            <CountBadge>{filtered.length} meals</CountBadge>
          </>
        }
        right={
          <>
            <Button variant="ghost" onClick={exportCSV}><IconDownload /> Export</Button>
            <Button onClick={() => navigate('/meals/new')}><IconPlus /> Add Meal</Button>
          </>
        }
      />

      <div className="px-7 py-5 max-md:px-4">
        {!rows.length ? (
          <Card>
            <EmptyState icon="🍲" title="No meals match those filters" sub="Try clearing the search or filters." />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-4 max-[1600px]:grid-cols-4 max-[1200px]:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {rows.map((meal) => (
                <MealCard key={meal.id} meal={meal} onCopyId={(m) => toast(`Copied ID for ${m.name}`)} />
              ))}
            </div>

            {pageCount > 1 && (
              <div className="mt-6 flex items-center justify-end gap-1">
                <button
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                  className="grid size-8 place-items-center rounded-lg text-ink-3 transition hover:bg-surface hover:text-ink disabled:opacity-35"
                >
                  ‹
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cx(
                      'grid size-8 place-items-center rounded-lg text-[13px] font-medium transition',
                      p === current ? 'bg-forest text-white' : 'text-ink-2 hover:bg-surface hover:text-ink',
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={current === pageCount}
                  onClick={() => setPage(current + 1)}
                  className="grid size-8 place-items-center rounded-lg text-ink-3 transition hover:bg-surface hover:text-ink disabled:opacity-35"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
