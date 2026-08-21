import { useMemo } from 'react';
import useTopbar from '../hooks/useTopbar.js';
import RevenueChart from '../features/dashboard/RevenueChart.jsx';
import OverviewPanel from '../features/dashboard/OverviewPanel.jsx';
import Avatar, { MealThumb } from '../components/Avatar.jsx';
import { Card, cx } from '../components/ui.jsx';
import { CUSTOMERS } from '../data/customers.js';
import { MEALS } from '../data/meals.js';
import { platformOverview, formatCount } from '../lib/platform.js';

const REVENUE = [42, 58, 45, 71, 63, 88, 76, 94, 82, 108, 96, 124];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const COUNTRIES = [
  { name: 'Nigeria', flag: '🇳🇬', users: 1284, pct: 62 },
  { name: 'Ghana', flag: '🇬🇭', users: 412, pct: 20 },
  { name: 'Kenya', flag: '🇰🇪', users: 227, pct: 11 },
  { name: 'South Africa', flag: '🇿🇦', users: 139, pct: 7 },
];

export default function Dashboard() {
  useTopbar('Dashboard', 'Search ingredients, meals, dishes…');

  const overview = useMemo(() => platformOverview(CUSTOMERS), []);
  const recentCustomers = CUSTOMERS.slice(0, 5);
  const recentMeals = MEALS.slice(0, 5);

  return (
    <div className="px-7 py-5 max-md:px-4">
      {/* Lu insight banner */}
      <div className="mb-5 flex items-start gap-3 rounded-card border border-mint/20 bg-mint-light px-5 py-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-lg">🌿</div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-mint-deep">Lu noticed something</div>
          <div className="mt-0.5 text-[13px] leading-relaxed text-ink-2">
            Breakfast meals are underrepresented this week — only 14% of new meals were breakfast,
            against 31% of user demand. Consider adding more.
          </div>
        </div>
      </div>

      <OverviewPanel overview={overview} />

      <div className="mb-5 grid grid-cols-3 gap-3.5 max-lg:grid-cols-1">
        {/* Revenue chart */}
        <Card className="col-span-2 max-lg:col-span-1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-light px-5 pt-4 pb-3.5">
            <div>
              <div className="text-sm font-semibold text-ink">Revenue</div>
              <div className="mt-px text-xs text-ink-3">Last 12 months</div>
            </div>
            <div className="flex gap-1 rounded-lg bg-canvas p-1">
              {['₦ NGN', '$ USD'].map((c, i) => (
                <button key={c} className={cx('rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                  i === 0 ? 'bg-surface text-ink shadow-soft' : 'text-ink-3 hover:text-ink')}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <RevenueChart values={REVENUE} months={MONTHS} height={300} />
        </Card>

        {/* Users by country */}
        <Card className="flex flex-col">
          <div className="border-b border-line-light px-5 pt-4 pb-3.5">
            <div className="text-sm font-semibold text-ink">Users by country</div>
            <div className="mt-px text-xs text-ink-3">{formatCount(overview.total)} total</div>
          </div>
          {/* flex-1 + justify-between spreads the rows down the taller card
              instead of leaving a block of dead space under them. */}
          <div className="flex flex-1 flex-col justify-between gap-5 px-5 py-6">
            {COUNTRIES.map((c) => (
              <div key={c.name}>
                <div className="mb-2 flex items-center gap-2 text-[13px]">
                  <span className="text-base">{c.flag}</span>
                  <span className="text-ink">{c.name}</span>
                  <span className="ml-auto font-semibold tabular-nums text-ink-2">{c.users.toLocaleString()}</span>
                  <span className="w-9 text-right text-[11px] tabular-nums text-ink-3">{c.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line-light">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-forest to-mint"
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-2 gap-3.5 max-lg:grid-cols-1">
        <Card>
          <div className="border-b border-line-light px-5 pt-4 pb-3.5 text-sm font-semibold text-ink">
            Recent customers
          </div>
          <div>
            {recentCustomers.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-line-light px-5 py-3 last:border-0">
                <Avatar src={c.avatar} initials={c.initials} bg={c.bg} fg={c.fg} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{c.name}</div>
                  <div className="truncate text-[11.5px] text-ink-3">{c.email}</div>
                </div>
                <div className="text-[11.5px] text-ink-3">{c.country}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-line-light px-5 pt-4 pb-3.5 text-sm font-semibold text-ink">
            Recent meals
          </div>
          <div>
            {recentMeals.map((m) => (
              <div key={m.id} className="flex items-center gap-3 border-b border-line-light px-5 py-3 last:border-0">
                <MealThumb src={m.image} emoji={m.emoji} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{m.name}</div>
                  <div className="text-[11.5px] capitalize text-ink-3">{m.type}</div>
                </div>
                <div className="text-[11.5px] tabular-nums text-ink-3">{m.cal} kcal</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
