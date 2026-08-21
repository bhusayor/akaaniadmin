import { describe, it, expect } from 'vitest';
import {
  planMrr, mrrByCurrency, arrByCurrency, activeSubscribers, arpu,
  revenue, netRevenue, atRisk, monthlySeries, lastMonths, monthLabel,
  growth, formatPercent, bookSales, isRealised, monthToDate, priorMonthToDate,
  subscriberIds, newSubscriberIds, newSubscriberSeries, firstSubscriptionDates,
  latestChargeDate,
} from './finance.js';
import { compactMoney, totalsByCurrency, formatTotals, formatMoney } from './money.js';
import { PLAN_SEED, TRANSACTION_SEED, MONTHS } from '../data/finance.js';
import { CUSTOMERS } from '../data/customers.js';

const plan = (over = {}) => ({
  interval: 'monthly', price: 1000, currency: 'NGN', subscribers: 10, active: true, ...over,
});

const tx = (over = {}) => ({
  date: '2026-05-10', type: 'subscription', amount: 100, currency: 'NGN', status: 'paid', ...over,
});

describe('planMrr', () => {
  it('is price × subscribers for a monthly plan', () => {
    expect(planMrr(plan({ price: 2500, subscribers: 4 }))).toBe(10000);
  });

  it('spreads an annual plan across twelve months', () => {
    // The whole charge in one month would spike MRR and then collapse it.
    expect(planMrr(plan({ interval: 'annual', price: 24000, subscribers: 5 }))).toBe(10000);
  });

  it('contributes nothing while the plan is closed', () => {
    expect(planMrr(plan({ active: false }))).toBe(0);
  });

  it('treats a missing price as zero rather than NaN', () => {
    expect(planMrr(plan({ price: null }))).toBe(0);
    expect(planMrr(plan({ price: '' }))).toBe(0);
  });

  it('counts a plan with no subscribers as zero', () => {
    expect(planMrr(plan({ subscribers: 0 }))).toBe(0);
    expect(planMrr(plan({ subscribers: undefined }))).toBe(0);
  });
});

describe('mrr and arr by currency', () => {
  const plans = [
    plan({ price: 2500, subscribers: 100 }),
    plan({ interval: 'annual', price: 24000, subscribers: 12 }),
    plan({ currency: 'USD', price: 5, subscribers: 20 }),
  ];

  it('keeps currencies apart instead of summing them', () => {
    const m = mrrByCurrency(plans);
    expect(m.get('NGN')).toBe(250000 + 24000);
    expect(m.get('USD')).toBe(100);
  });

  it('derives ARR from MRR, not from annual plan prices', () => {
    expect(arrByCurrency(plans).get('USD')).toBe(1200);
  });

  it('omits a currency once every plan in it is closed', () => {
    expect(mrrByCurrency([plan({ currency: 'GHS', active: false })]).has('GHS')).toBe(false);
  });
});

describe('activeSubscribers and arpu', () => {
  const plans = [plan({ subscribers: 30 }), plan({ subscribers: 10, active: false })];

  it('excludes closed plans from the headcount', () => {
    expect(activeSubscribers(plans)).toBe(30);
  });

  it('divides MRR by active subscribers only', () => {
    expect(arpu(plans).get('NGN')).toBe(1000);
  });

  it('returns nothing rather than dividing by zero', () => {
    expect(arpu([plan({ subscribers: 0 })]).size).toBe(0);
  });
});

describe('revenue', () => {
  const rows = [
    tx({ amount: 100 }),
    tx({ amount: 50, type: 'book' }),
    tx({ amount: 999, status: 'pending' }),
    tx({ amount: 999, status: 'failed' }),
    tx({ amount: 999, status: 'refunded' }),
    tx({ amount: 7, currency: 'USD' }),
  ];

  it('counts only money actually collected', () => {
    expect(revenue(rows).get('NGN')).toBe(150);
  });

  it('never adds one currency to another', () => {
    expect(revenue(rows).get('USD')).toBe(7);
  });

  it('filters by stream', () => {
    expect(revenue(rows, { type: 'book' }).get('NGN')).toBe(50);
  });

  it('filters by date range on ISO string order', () => {
    const dated = [tx({ date: '2026-04-30' }), tx({ date: '2026-05-01' }), tx({ date: '2026-06-02' })];
    expect(revenue(dated, { from: '2026-05-01', to: '2026-05-31' }).get('NGN')).toBe(100);
  });

  it('subtracts refunds in netRevenue', () => {
    expect(netRevenue(rows).get('NGN')).toBe(150 - 999);
  });
});

describe('isRealised', () => {
  it.each(['pending', 'failed', 'refunded'])('does not count %s as revenue', (status) => {
    expect(isRealised(tx({ status }))).toBe(false);
  });

  it('counts paid', () => {
    expect(isRealised(tx())).toBe(true);
  });
});

describe('atRisk', () => {
  it('totals failed charges only', () => {
    const rows = [tx({ amount: 10, status: 'failed' }), tx({ amount: 5, status: 'failed' }), tx({ amount: 900 })];
    expect(atRisk(rows).get('NGN')).toBe(15);
  });

  it('is empty when nothing failed', () => {
    expect(atRisk([tx()]).size).toBe(0);
  });
});

describe('monthlySeries', () => {
  const rows = [
    tx({ date: '2026-04-03', amount: 10 }),
    tx({ date: '2026-04-28', amount: 5 }),
    tx({ date: '2026-05-02', amount: 20, type: 'book' }),
    tx({ date: '2026-05-09', amount: 99, status: 'failed' }),
  ];

  it('buckets by month', () => {
    expect(monthlySeries(rows, undefined, ['2026-04', '2026-05', '2026-06'])).toEqual([15, 20, 0]);
  });

  it('returns a zero rather than a gap for an empty month', () => {
    expect(monthlySeries([], undefined, ['2026-04'])).toEqual([0]);
  });

  it('honours the stream filter', () => {
    expect(monthlySeries(rows, 'book', ['2026-04', '2026-05'])).toEqual([0, 20]);
  });
});

describe('lastMonths', () => {
  it('ends on the given month and walks backwards', () => {
    expect(lastMonths(3, '2026-01-15')).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('crosses a year boundary correctly', () => {
    expect(lastMonths(2, '2026-01-01')).toEqual(['2025-12', '2026-01']);
  });

  it('labels a month without shifting it across a timezone', () => {
    expect(monthLabel('2026-01')).toBe('Jan');
    expect(monthLabel('2026-12')).toBe('Dec');
  });
});

describe('growth', () => {
  it('reports a rise and a fall', () => {
    expect(growth(150, 100)).toBe(50);
    expect(growth(50, 100)).toBe(-50);
  });

  it('is null with no base — not 0%, which would read as flat', () => {
    expect(growth(150, 0)).toBe(null);
    expect(growth(150, undefined)).toBe(null);
  });

  it('formats with an explicit sign, and a dash when unknown', () => {
    expect(formatPercent(12.34)).toBe('+12.3%');
    expect(formatPercent(-8)).toBe('-8.0%');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('bookSales', () => {
  const rows = [
    tx({ type: 'book', item: 'Cut Season', amount: 5.99, currency: 'USD' }),
    tx({ type: 'book', item: 'Cut Season', amount: 5.99, currency: 'USD' }),
    tx({ type: 'book', item: 'Prep & Go', amount: 3.99, currency: 'USD' }),
    tx({ type: 'book', item: 'Cut Season', amount: 5.99, currency: 'USD', status: 'refunded' }),
    tx({ type: 'subscription', item: 'Lu Plus', amount: 100 }),
  ];

  it('counts units and revenue per book, ignoring refunds', () => {
    const [top] = bookSales(rows);
    expect(top).toMatchObject({ item: 'Cut Season', units: 2 });
    expect(top.revenue).toBeCloseTo(11.98);
  });

  it('sorts by revenue', () => {
    expect(bookSales(rows).map((r) => r.item)).toEqual(['Cut Season', 'Prep & Go']);
  });

  it('leaves subscriptions out entirely', () => {
    expect(bookSales(rows).some((r) => r.item === 'Lu Plus')).toBe(false);
  });
});

describe('money helpers', () => {
  it('keeps mixed currencies visibly separate', () => {
    const t = totalsByCurrency([{ amount: 100, currency: 'NGN' }, { amount: 2, currency: 'USD' }]);
    expect(formatTotals(t)).toBe('₦100.00 + $2.00');
  });

  it('skips rows with no usable amount instead of counting them as zero', () => {
    const t = totalsByCurrency([{ amount: null, currency: 'NGN' }, { amount: 5, currency: 'NGN' }]);
    expect(t.get('NGN')).toBe(5);
  });

  it('shows a dash for an empty total', () => {
    expect(formatTotals(new Map())).toBe('—');
  });

  it('compacts to K and M', () => {
    expect(compactMoney(1234567, 'NGN')).toBe('₦1.2M');
    expect(compactMoney(4300, 'USD')).toBe('$4.3K');
    expect(compactMoney(87, 'USD')).toBe('$87');
    expect(compactMoney(0, 'NGN')).toBe('₦0');
  });

  it('keeps the sign on a negative amount', () => {
    expect(compactMoney(-2500, 'NGN')).toBe('-₦2.5K');
  });
});

describe('fixtures', () => {
  it('never dates a charge in the future', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(TRANSACTION_SEED.every((t) => t.date <= today)).toBe(true);
  });

  it('covers both streams in both currencies', () => {
    const seen = new Set(TRANSACTION_SEED.map((t) => `${t.type}/${t.currency}`));
    expect(seen.has('subscription/NGN')).toBe(true);
    expect(seen.has('book/USD')).toBe(true);
  });

  it('gives every transaction a known type and status', () => {
    const types = new Set(['subscription', 'book', 'refund']);
    const statuses = new Set(['paid', 'pending', 'failed', 'refunded']);
    TRANSACTION_SEED.forEach((t) => {
      expect(types.has(t.type)).toBe(true);
      expect(statuses.has(t.status)).toBe(true);
    });
  });

  it('leaves some failed charges to recover, so the alert has something to show', () => {
    expect(TRANSACTION_SEED.some((t) => t.status === 'failed')).toBe(true);
  });

  it('lands every transaction inside the charted window', () => {
    const inWindow = new Set(MONTHS);
    expect(TRANSACTION_SEED.every((t) => inWindow.has(t.date.slice(0, 7)))).toBe(true);
  });

  it('prices every plan and never leaves MRR as NaN', () => {
    PLAN_SEED.forEach((p) => expect(Number.isFinite(planMrr(p))).toBe(true));
  });

  it('has at least one closed plan, to exercise the inactive path', () => {
    expect(PLAN_SEED.some((p) => !p.active)).toBe(true);
  });

  it('formats a seeded amount without losing precision', () => {
    expect(formatMoney(4.99, 'USD')).toBe('$4.99');
  });
});

describe('monthToDate', () => {
  it('stops at today for the current month', () => {
    expect(monthToDate('2026-08', '2026-08-19')).toMatchObject({ from: '2026-08-01', to: '2026-08-19', day: 19 });
  });

  it('covers a whole past month', () => {
    expect(monthToDate('2026-06', '2026-08-19').to).toBe('2026-06-31');
  });

  it('compares against the same span of the prior month, not the whole of it', () => {
    // 19 days against 31 would make every mid-month figure look like a collapse.
    expect(priorMonthToDate('2026-08', '2026-08-19')).toMatchObject({
      from: '2026-07-01', to: '2026-07-19', month: '2026-07',
    });
  });

  it('rolls back across a year boundary', () => {
    expect(priorMonthToDate('2026-01', '2026-01-09').month).toBe('2025-12');
  });
});

describe('roster and charge log agree', () => {
  // Two independently invented numbers would contradict each other on screen:
  // the MRR card and the last point of the revenue chart must reconcile.
  it.each(['NGN', 'USD'])('%s subscription revenue tracks MRR within the failure rate', (currency) => {
    const plans = PLAN_SEED.filter((p) => p.currency === currency);
    const rows = TRANSACTION_SEED.filter((t) => t.currency === currency);
    const mrr = mrrByCurrency(plans).get(currency);
    const month = MONTHS[MONTHS.length - 2];
    const collected = revenue(rows, {
      type: 'subscription', from: `${month}-01`, to: `${month}-31`,
    }).get(currency);

    expect(collected).toBeGreaterThan(mrr * 0.8);
    expect(collected).toBeLessThanOrEqual(mrr);
  });

  it('sells recipe books on both rails, so neither currency tab looks empty', () => {
    ['NGN', 'USD'].forEach((currency) => {
      expect(bookSales(TRANSACTION_SEED.filter((t) => t.currency === currency)).length).toBeGreaterThan(0);
    });
  });

  it('bills Nigerian customers in naira and everyone else in dollars', () => {
    TRANSACTION_SEED.forEach((t) => {
      expect(t.currency).toBe(t.country === 'Nigeria' ? 'NGN' : 'USD');
    });
  });

  it('keeps a recurring charge on the same customer month to month', () => {
    const plus = TRANSACTION_SEED.filter((t) => t.item === 'Lu Plus');
    const perMonth = new Map();
    plus.forEach((t) => {
      const m = t.date.slice(0, 7);
      perMonth.set(m, (perMonth.get(m) ?? new Set()).add(t.customer));
    });
    const seen = [...perMonth.values()];
    const overlap = [...seen[0]].filter((c) => seen[seen.length - 1].has(c));
    expect(overlap.length).toBeGreaterThan(0);
  });
});

describe('who is subscribed', () => {
  const tx = (over) => ({ type: 'subscription', status: 'paid', currency: 'NGN', amount: 100, ...over });
  const rows = [
    tx({ customerId: 1, date: '2026-08-18' }),   // charged inside the window
    tx({ customerId: 1, date: '2026-01-04' }),   // and long before — still one subscriber
    tx({ customerId: 2, date: '2026-08-01' }),
    tx({ customerId: 3, date: '2026-05-02' }),   // lapsed, outside the window
    { type: 'book', customerId: 9, date: '2026-08-19', status: 'paid', currency: 'NGN', amount: 5 },
  ];

  it('takes the horizon from the newest charge, not the clock', () => {
    expect(latestChargeDate(rows)).toBe('2026-08-19');
  });

  it('counts a customer once however many times they were charged', () => {
    expect(subscriberIds(rows, { asOf: '2026-08-20' })).toEqual(new Set(['1', '2']));
  });

  it('drops a subscription that stopped paying', () => {
    // No flag says customer 3 cancelled; they simply stop appearing.
    expect(subscriberIds(rows, { asOf: '2026-08-20' }).has('3')).toBe(false);
  });

  it('never counts a book buyer as a subscriber', () => {
    expect(subscriberIds(rows, { asOf: '2026-08-20' }).has('9')).toBe(false);
  });

  it('runs the window past a month, so a renewal date that drifts still counts', () => {
    // A strict 30 days would drop anyone billed on the 31st and make the
    // count sawtooth from one day to the next.
    expect(subscriberIds(rows, { asOf: '2026-09-04', days: 35 }).has('2')).toBe(true);
    expect(subscriberIds(rows, { asOf: '2026-09-04', days: 30 }).has('2')).toBe(false);
  });

  it('is empty when nothing has ever been charged', () => {
    expect(subscriberIds([]).size).toBe(0);
    expect(latestChargeDate([])).toBe('');
  });

  it('dates each subscription from its first charge', () => {
    expect(firstSubscriptionDates(rows).get('1')).toBe('2026-01-04');
  });

  it('counts only genuinely new subscribers', () => {
    // Customer 1 was charged this month but started in January.
    const fresh = newSubscriberIds(rows, { asOf: '2026-08-20', days: 30 });
    expect(fresh.has('1')).toBe(false);
    expect(fresh.has('2')).toBe(true);
  });

  it('buckets new subscribers by week for the trend', () => {
    const s = newSubscriberSeries(rows, { asOf: '2026-08-20', weeks: 8 });
    expect(s).toHaveLength(8);
    expect(s.reduce((a, b) => a + b, 0)).toBe(1); // only customer 2 started recently
  });

  it('has no series without a charge to anchor to', () => {
    expect(newSubscriberSeries([])).toEqual([]);
  });
});

describe('subscribers in the real data', () => {
  it('finds a majority of the roster subscribed, but not all of it', () => {
    const ids = subscriberIds(TRANSACTION_SEED);
    const inTable = CUSTOMERS.filter((c) => ids.has(String(c.id))).length;
    expect(inTable).toBeGreaterThan(CUSTOMERS.length / 2);
    expect(inTable).toBeLessThan(CUSTOMERS.length);
  });

  it('keeps new subscribers a small slice of the total', () => {
    const all = subscriberIds(TRANSACTION_SEED);
    const fresh = newSubscriberIds(TRANSACTION_SEED);
    expect(fresh.size).toBeLessThan(all.size);
  });

  it('never marks a new subscriber who is not a subscriber', () => {
    const all = subscriberIds(TRANSACTION_SEED);
    newSubscriberIds(TRANSACTION_SEED).forEach((id) => expect(all.has(id)).toBe(true));
  });
});

describe('failed charges carry a reason', () => {
  const failed = TRANSACTION_SEED.filter((t) => t.status === 'failed');

  it('gives every failure a label and an explanation', () => {
    // Without a reason nobody can tell a retryable timeout from a dead card.
    expect(failed.length).toBeGreaterThan(0);
    failed.forEach((t) => {
      expect(t.failureLabel).toBeTruthy();
      expect(t.failureDetail).toBeTruthy();
      expect(typeof t.retryable).toBe('boolean');
    });
  });

  it('marks some failures as beyond retrying', () => {
    // An expired card cannot be retried into working.
    expect(failed.some((t) => t.retryable === false)).toBe(true);
    expect(failed.some((t) => t.retryable === true)).toBe(true);
  });

  it('leaves cleared charges with no failure fields', () => {
    TRANSACTION_SEED.filter((t) => t.status === 'paid').forEach((t) => {
      expect(t.failure).toBeUndefined();
      expect(t.failureLabel).toBeUndefined();
    });
  });

  it('explains what a pending charge is waiting on', () => {
    const pending = TRANSACTION_SEED.filter((t) => t.status === 'pending');
    expect(pending.length).toBeGreaterThan(0);
    pending.forEach((t) => expect(t.pendingNote).toBeTruthy());
  });

  it('keeps failure reasons to the known set', () => {
    const known = new Set([
      'insufficient_funds', 'card_expired', 'card_declined',
      'processor_timeout', 'limit_exceeded',
    ]);
    failed.forEach((t) => expect(known.has(t.failure)).toBe(true));
  });
});
