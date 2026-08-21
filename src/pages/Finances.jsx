import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTopbar, { useSearch } from '../hooks/useTopbar.js';
import Avatar, { MealThumb } from '../components/Avatar.jsx';
import RevenueChart from '../features/dashboard/RevenueChart.jsx';
import { KpiCard, Segmented, ShareBar, SplitBar, SectionHead } from '../features/finances/parts.jsx';
import {
  Button, Card, FilterSelect, PageToolbar, EmptyState, Badge, Th, Td, cx,
} from '../components/ui.jsx';
import {
  IconWallet, IconBookOpen, IconUsers, IconRepeat, IconWarning,
  IconRetry, IconDownload, IconArrowRight,
} from '../components/icons.jsx';
import TransactionDrawer from '../features/finances/TransactionDrawer.jsx';
import { useToast } from '../components/Toast.jsx';
import { useFinance } from '../state/FinanceProvider.jsx';
import { useSettings } from '../state/SettingsProvider.jsx';
import { formatMoney, compactMoney, currencySymbol } from '../lib/money.js';
import { downloadCSV } from '../lib/csv.js';
import {
  TX_TYPES, TX_STATUSES, planMrr, mrrByCurrency, arrByCurrency, activeSubscribers,
  arpu, revenue, atRisk, monthlySeries, monthLabel, growth, bookSales,
  monthToDate, priorMonthToDate,
} from '../lib/finance.js';

const PERIODS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: 'custom', label: 'Custom range' },
];

/** `2026-08` → a month input's value. Clamped to the data that exists. */
const clampMonth = (v, min, max) => (v < min ? min : v > max ? max : v);

const STREAMS = [
  { value: '', label: 'All revenue' },
  { value: 'subscription', label: 'Subscriptions' },
  { value: 'book', label: 'Recipe books' },
];

const first = (map) => (map.size ? [...map.values()][0] : 0);

export default function Finances() {
  useTopbar('Finances', 'Search customer, plan or book…');
  const [search] = useSearch();
  const toast = useToast();
  const navigate = useNavigate();
  const { plans, transactions, months, retryCharge, retryAllFailed, refundCharge } = useFinance();
  const { settings } = useSettings();

  /* Only currencies money has actually moved in — no empty tabs. */
  const currencies = useMemo(() => {
    const seen = new Set(transactions.map((t) => t.currency));
    plans.forEach((p) => seen.add(p.currency));
    const order = [settings.localization.currency, ...seen];
    return [...new Set(order)].filter((c) => seen.has(c));
  }, [transactions, plans, settings.localization.currency]);

  const [currency, setCurrency] = useState(currencies[0]);
  const [period, setPeriod] = useState('12');
  const [range, setRange] = useState(null);
  const [stream, setStream] = useState('');
  const [txType, setTxType] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [shown, setShown] = useState(12);
  const [openTx, setOpenTx] = useState(null);

  const money = (v) => formatMoney(v, currency);
  const compact = (v) => compactMoney(v, currency);

  /* ── Everything below is scoped to one currency. Summing ₦ into $ would
        produce a total that is wrong in a way nobody catches, so the page
        switches between them instead of converting. ── */
  const scopedTx = useMemo(
    () => transactions.filter((t) => t.currency === currency),
    [transactions, currency],
  );
  const scopedPlans = useMemo(
    () => plans.filter((p) => p.currency === currency),
    [plans, currency],
  );

  /* A custom range lets someone look at a previous year or one quarter;
     the preset periods are just the two spans people ask for daily. */
  const chartMonths = useMemo(() => {
    if (period !== 'custom') return months.slice(-Number(period));
    if (!range) return months;
    const [from, to] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from];
    const picked = months.filter((m) => m >= from && m <= to);
    /* Never hand the chart a single point or none — it needs two to draw a
       line, and an empty axis divides by zero. */
    return picked.length >= 2 ? picked : months.slice(-2);
  }, [months, period, range]);
  const thisMonth = months[months.length - 1];

  /* This month is only part-elapsed, so both sides of every month-on-month
     figure cover the same span of days — otherwise the 19th of the month
     always looks like a collapse. */
  const mtd = useMemo(() => monthToDate(thisMonth), [thisMonth]);
  const prior = useMemo(() => priorMonthToDate(thisMonth), [thisMonth]);

  const metrics = useMemo(() => {
    const span = (range, type) => first(revenue(scopedTx, { type, from: range.from, to: range.to }));

    const books = span(mtd, 'book');
    const subsRev = span(mtd, 'subscription');

    return {
      mrr: first(mrrByCurrency(scopedPlans)),
      subsRev,
      arr: first(arrByCurrency(scopedPlans)),
      subs: activeSubscribers(scopedPlans),
      arpu: first(arpu(scopedPlans)),
      books,
      booksDelta: growth(books, span(prior, 'book')),
      subsDelta: growth(subsRev, span(prior, 'subscription')),
      atRisk: first(atRisk(scopedTx)),
      atRiskCount: scopedTx.filter((t) => t.status === 'failed').length,
      /* Period totals, for the split under the chart. */
      periodSubs: first(revenue(scopedTx, { type: 'subscription', from: `${chartMonths[0]}-01` })),
      periodBooks: first(revenue(scopedTx, { type: 'book', from: `${chartMonths[0]}-01` })),
    };
  }, [scopedPlans, scopedTx, mtd, prior, chartMonths]);

  const series = useMemo(
    () => monthlySeries(scopedTx, stream || undefined, chartMonths),
    [scopedTx, stream, chartMonths],
  );

  const planRows = useMemo(() => {
    const rows = scopedPlans
      .map((p) => ({ ...p, mrr: planMrr(p) }))
      .sort((a, b) => b.mrr - a.mrr);
    return { rows, total: rows.reduce((n, r) => n + r.mrr, 0) };
  }, [scopedPlans]);

  const books = useMemo(() => {
    const rows = bookSales(scopedTx);
    return { rows, total: rows.reduce((n, r) => n + r.revenue, 0) };
  }, [scopedTx]);

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedTx.filter((t) => {
      if (txType && t.type !== txType) return false;
      if (txStatus && t.status !== txStatus) return false;
      if (q && !`${t.customer} ${t.item} ${t.method}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scopedTx, txType, txStatus, search]);

  const suffix = currency.toLowerCase();

  const exportTx = () => {
    downloadCSV(`akaani-transactions-${suffix}.csv`, [
      ['Date', 'Customer', 'Country', 'Type', 'Item', 'Method', 'Amount', 'Currency',
        'Status', 'Failure reason', 'Retryable', 'Reference'],
      ...filteredTx.map((t) => [
        t.date, t.customer, t.country, TX_TYPES[t.type].label, t.item,
        t.method, t.amount, t.currency, t.status,
        t.failureLabel ?? '', t.status === 'failed' ? (t.retryable ? 'yes' : 'no') : '', t.id,
      ]),
    ]);
    toast(`Exported ${filteredTx.length} transactions`);
  };

  /* Each stream exports on its own terms: a plan roster is not a list of
     charges, and a book's sales are units and revenue, not line items. */
  const exportSubscribers = () => {
    downloadCSV(`akaani-subscribers-${suffix}.csv`, [
      ['Plan', 'Interval', 'Price', 'Currency', 'Subscribers', 'MRR contribution', 'Status'],
      ...planRows.rows.map((p) => [
        p.name, p.interval, p.price, p.currency, p.subscribers,
        p.active ? Math.round(p.mrr) : 0, p.active ? 'live' : 'closed',
      ]),
      [],
      ['Subscriber', 'Country', 'Plan', 'Interval', 'Last charged', 'Amount', 'Currency', 'Status'],
      ...scopedTx
        .filter((t) => t.type === 'subscription')
        .map((t) => [t.customer, t.country, t.item, t.interval, t.date, t.amount, t.currency, t.status]),
    ]);
    toast(`Exported ${planRows.rows.length} plans and their subscribers`);
  };

  const exportBooks = () => {
    downloadCSV(`akaani-recipe-book-sales-${suffix}.csv`, [
      ['Recipe book', 'Units sold', 'Revenue', 'Currency'],
      ...books.rows.map((b) => [b.item, b.units, Math.round(b.revenue * 100) / 100, currency]),
      [],
      ['Date', 'Customer', 'Country', 'Recipe book', 'Method', 'Amount', 'Currency', 'Status'],
      ...scopedTx
        .filter((t) => t.type === 'book')
        .map((t) => [t.date, t.customer, t.country, t.item, t.method, t.amount, t.currency, t.status]),
    ]);
    toast(`Exported ${books.rows.length} recipe books and their sales`);
  };

  return (
    <>
      <PageToolbar
        left={
          <>
            {currencies.length > 1 && (
              <Segmented
                options={currencies.map((c) => ({ value: c, label: `${currencySymbol(c)} ${c}` }))}
                value={currency}
                onChange={(c) => { setCurrency(c); setShown(12); }}
              />
            )}
            <Segmented
              options={PERIODS}
              value={period}
              onChange={(v) => {
                setPeriod(v);
                /* Seed the custom range with the last six months, so the
                   chart never jumps to the full window on the way in. */
                if (v === 'custom' && !range) {
                  setRange({
                    from: months[Math.max(0, months.length - 6)],
                    to: months[months.length - 1],
                  });
                }
              }}
            />
            {period === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="month"
                  aria-label="From month"
                  value={range?.from ?? ''}
                  min={months[0]}
                  max={months[months.length - 1]}
                  onChange={(e) => setRange((r) => ({
                    ...r, from: clampMonth(e.target.value, months[0], months[months.length - 1]),
                  }))}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] text-ink outline-none transition focus:border-mint"
                />
                <span className="text-[12px] text-ink-3">to</span>
                <input
                  type="month"
                  aria-label="To month"
                  value={range?.to ?? ''}
                  min={months[0]}
                  max={months[months.length - 1]}
                  onChange={(e) => setRange((r) => ({
                    ...r, to: clampMonth(e.target.value, months[0], months[months.length - 1]),
                  }))}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] text-ink outline-none transition focus:border-mint"
                />
              </div>
            )}
          </>
        }
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={exportSubscribers}>
              <IconDownload /> Subscribers
            </Button>
            <Button variant="ghost" onClick={exportBooks}>
              <IconDownload /> Book sales
            </Button>
            <Button variant="ghost" onClick={exportTx}>
              <IconDownload /> Transactions
            </Button>
          </div>
        }
      />

      <div className="space-y-5 px-7 py-5 max-md:px-4">
        {/* ── Headline numbers ── */}
        <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
          {/* MRR and subscriber count are point-in-time figures, so they carry
              no month-on-month delta — a percentage next to them would be
              read as growth in the roster, which is not what it measured.
              The two period figures carry deltas, compared like for like. */}
          <KpiCard
            label="Monthly recurring revenue"
            value={compact(metrics.mrr)}
            sub={`${money(metrics.arr)} annual run rate · today's roster`}
            icon={IconRepeat}
            tone="mint"
          />
          <KpiCard
            label="Subscriptions collected"
            value={compact(metrics.subsRev)}
            sub={`1–${mtd.day} ${monthLabel(thisMonth)} · renewals that cleared`}
            delta={metrics.subsDelta}
            deltaLabel={`vs 1–${mtd.day} ${monthLabel(prior.month)}`}
            icon={IconWallet}
            tone="grape"
          />
          <KpiCard
            label="Recipe book sales"
            value={compact(metrics.books)}
            sub={`1–${mtd.day} ${monthLabel(thisMonth)} · one-off purchases`}
            delta={metrics.booksDelta}
            deltaLabel={`vs 1–${mtd.day} ${monthLabel(prior.month)}`}
            icon={IconBookOpen}
            tone="ocean"
          />
          <KpiCard
            label="Active subscribers"
            value={metrics.subs.toLocaleString()}
            sub={`${money(metrics.arpu)} each per month, across ${scopedPlans.filter((p) => p.active).length} live plans`}
            icon={IconUsers}
            tone="amber"
          />
        </div>

        {/* ── Failed charges. Shown only when there is money to recover, and
              wired to the transaction filter so the fix is one click. ── */}
        {metrics.atRiskCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-chili/25 bg-chili-light px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-chili/12 text-chili-deep">
              <IconWarning />
            </span>
            <div className="min-w-55 flex-1">
              <div className="text-[13px] font-semibold text-chili-deep">
                {money(metrics.atRisk)} in failed charges
              </div>
              <div className="text-[12px] text-chili-deep/75">
                {metrics.atRiskCount} payments did not go through. Retrying them is the
                cheapest revenue on this page.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setTxStatus('failed');
                  setTxType('');
                  document.getElementById('finance-transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                Review one by one
              </Button>
              <Button
                onClick={() => {
                  const n = retryAllFailed(currency);
                  toast(`Retrying ${n} charge${n === 1 ? '' : 's'} — they move to Pending until the processor confirms`);
                }}
              >
                <IconRetry /> Retry all {metrics.atRiskCount}
              </Button>
            </div>
          </div>
        )}

        {/* ── Revenue over time ── */}
        <Card>
          <SectionHead
            title="Revenue over time"
            sub={`${monthLabel(chartMonths[0])} — ${monthLabel(thisMonth)} · collected payments only`}
            right={<Segmented options={STREAMS} value={stream} onChange={setStream} />}
          />
          <RevenueChart
            values={series}
            months={chartMonths.map(monthLabel)}
            height={260}
            format={money}
            tick={compact}
            labelFor={(m) => m}
          />
          <div className="border-t border-line-light px-5 py-4">
            <SplitBar
              subscription={metrics.periodSubs}
              book={metrics.periodBooks}
              format={compact}
            />
          </div>
        </Card>

        {/* ── The two streams, broken down ── */}
        <div className="grid grid-cols-5 gap-5 max-lg:grid-cols-1">
          <Card className="col-span-3 max-lg:col-span-1">
            <SectionHead
              title="Subscription plans"
              sub="Annual plans are spread across twelve months, not counted on renewal day."
            />
            {planRows.rows.length === 0 ? (
              <EmptyState icon="🔁" title="No plans in this currency" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>Plan</Th>
                      <Th className="text-right">Price</Th>
                      <Th className="text-right">Subscribers</Th>
                      <Th className="text-right">MRR</Th>
                      <Th className="w-28">Share of MRR</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {planRows.rows.map((p) => (
                      <tr key={p.id} className={cx('transition hover:bg-surface-2', !p.active && 'opacity-60')}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="font-medium whitespace-nowrap text-ink">{p.name}</span>
                            {!p.active && <Badge>Closed</Badge>}
                          </div>
                          <div className="mt-0.5 max-w-64 text-[11.5px] leading-snug text-ink-3">{p.blurb}</div>
                        </Td>
                        <Td className="text-right whitespace-nowrap tabular-nums">
                          {formatMoney(p.price, p.currency)}
                          <span className="text-ink-3">/{p.interval === 'annual' ? 'yr' : 'mo'}</span>
                        </Td>
                        <Td className="text-right tabular-nums">{p.subscribers.toLocaleString()}</Td>
                        <Td className="text-right font-semibold whitespace-nowrap tabular-nums">
                          {p.active ? compact(p.mrr) : '—'}
                        </Td>
                        <Td><ShareBar value={p.mrr} total={planRows.total} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="col-span-2 max-lg:col-span-1">
            <SectionHead
              title="Recipe books"
              sub="Units sold and revenue, all time. Refunds excluded."
            />
            {books.rows.length === 0 ? (
              <EmptyState icon="📕" title="No book sales in this currency" />
            ) : (
              <div className="divide-y divide-line-light">
                {books.rows.map((b) => {
                  const cover = books.rows.length
                    ? scopedTx.find((t) => t.item === b.item && t.image)?.image
                    : null;
                  return (
                    <div key={b.item} className="flex items-center gap-3 px-5 py-3.5">
                      <MealThumb src={cover} emoji="📕" size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-ink">{b.item}</div>
                        <div className="mt-1 max-w-45">
                          <ShareBar value={b.revenue} total={books.total} tone="bg-ocean" />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[13px] font-semibold text-ink tabular-nums">{compact(b.revenue)}</div>
                        <div className="text-[11.5px] text-ink-3 tabular-nums">{b.units} sold</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ── Transactions ── */}
        <Card>
          <div id="finance-transactions" className="scroll-mt-30">
            <SectionHead
              title="Transactions"
              sub={`${filteredTx.length} of ${scopedTx.length} in ${currency}`}
              right={
                <div className="flex flex-wrap gap-2">
                  <FilterSelect value={txType} onChange={(e) => setTxType(e.target.value)}>
                    <option value="">All types</option>
                    {Object.entries(TX_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </FilterSelect>
                  <FilterSelect value={txStatus} onChange={(e) => setTxStatus(e.target.value)}>
                    <option value="">All statuses</option>
                    {Object.entries(TX_STATUSES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </FilterSelect>
                </div>
              }
            />
          </div>

          {filteredTx.length === 0 ? (
            <EmptyState icon="🧾" title="No transactions match" sub="Try clearing a filter or the search box." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>Customer</Th>
                      <Th>What they paid for</Th>
                      <Th>Method</Th>
                      <Th>Date</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.slice(0, shown).map((t) => (
                      <tr key={t.id} className="transition hover:bg-surface-2">
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <Avatar src={t.avatar} initials={t.initials} bg="#E1F5EE" fg="#0F6E56" size={30} />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-ink">{t.customer}</div>
                              <div className="text-[11.5px] text-ink-3">{t.country}</div>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Badge className={TX_TYPES[t.type].tone}>{TX_TYPES[t.type].label}</Badge>
                            <span className="truncate text-ink-2">{t.item}</span>
                          </div>
                        </Td>
                        <Td className="text-ink-2 whitespace-nowrap">{t.method}</Td>
                        <Td className="text-ink-2 whitespace-nowrap tabular-nums">{t.date}</Td>
                        <Td className={cx(
                          'text-right font-semibold whitespace-nowrap tabular-nums',
                          t.status === 'refunded' ? 'text-chili-deep line-through' : 'text-ink',
                        )}>
                          {formatMoney(t.amount, t.currency)}
                        </Td>
                        <Td>
                          <Badge className={TX_STATUSES[t.status].tone}>{TX_STATUSES[t.status].label}</Badge>
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          {/* One entry point for every charge — what can be
                              done depends on why it is in this state, and
                              that lives in the drawer. */}
                          <button
                            onClick={() => setOpenTx(t)}
                            className={cx(
                              'inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] font-medium transition',
                              t.status === 'failed'
                                ? 'border-chili/40 bg-chili-light text-chili-deep hover:border-chili'
                                : 'border-line bg-surface text-ink-2 hover:border-forest/30 hover:text-forest',
                            )}
                          >
                            {t.status === 'failed' ? <><IconWarning /> Resolve</> : <>Manage <IconArrowRight /></>}
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {shown < filteredTx.length && (
                <div className="border-t border-line-light px-5 py-3.5 text-center">
                  <Button variant="ghost" onClick={() => setShown((n) => n + 20)}>
                    Show 20 more · {filteredTx.length - shown} remaining
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        {currencies.length > 1 && (
          <p className="pb-2 text-center text-[11.5px] text-ink-3">
            Showing {currency} only. Amounts in {currencies.filter((c) => c !== currency).join(', ')} are
            on their own tab — nothing here is converted between currencies.
          </p>
        )}
      </div>

      {/* Re-read from state each render, so an action inside the drawer
          updates the drawer rather than leaving a stale copy on screen. */}
      <TransactionDrawer
        tx={openTx ? transactions.find((t) => t.id === openTx.id) ?? null : null}
        onClose={() => setOpenTx(null)}
        onRetry={(id) => { retryCharge(id); toast('Charge queued for retry'); }}
        onRefund={(id) => {
          const t = transactions.find((x) => x.id === id);
          refundCharge(id);
          toast(`Refunded ${formatMoney(t.amount, t.currency)}`);
        }}
        onOpenCustomer={(customerId) => { setOpenTx(null); navigate(`/customers/${customerId}`); }}
      />
    </>
  );
}
