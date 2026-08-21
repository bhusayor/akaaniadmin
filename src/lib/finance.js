/* ═══════════════════════════════════════════════════════
   FINANCE

   Two revenue streams with different mechanics:

     subscription — recurring, measured as MRR
     book         — one-off recipe-book sales, measured as revenue in a period

   Mixing them into a single "revenue" number hides which one is
   actually growing, so they are kept apart everywhere.
   ═══════════════════════════════════════════════════════ */

import { toNum, totalsByCurrency, formatMoney } from './money.js';

export const TX_TYPES = {
  subscription: { label: 'Subscription', tone: 'bg-mint-light text-mint-deep' },
  book: { label: 'Recipe book', tone: 'bg-ocean-light text-ocean-deep' },
  refund: { label: 'Refund', tone: 'bg-chili-light text-chili-deep' },
};

export const TX_STATUSES = {
  paid: { label: 'Paid', tone: 'bg-mint-light text-mint-deep' },
  pending: { label: 'Pending', tone: 'bg-amber-light text-amber-deep' },
  failed: { label: 'Failed', tone: 'bg-chili-light text-chili-deep' },
  refunded: { label: 'Refunded', tone: 'bg-line-light text-ink-3' },
};

export const INTERVALS = { monthly: 1, annual: 12 };

/**
 * A plan's contribution to MRR.
 *
 * An annual plan is divided across its twelve months — counting the whole
 * charge in the month it lands makes MRR spike and then collapse, which is
 * the most common way this number gets reported wrong.
 */
export function planMrr(plan) {
  const price = toNum(plan.price);
  if (price === null || !plan.active) return 0;
  const months = INTERVALS[plan.interval] ?? 1;
  return (price / months) * (plan.subscribers ?? 0);
}

export function mrrByCurrency(plans) {
  const out = new Map();
  plans.forEach((p) => {
    const value = planMrr(p);
    if (!value) return;
    out.set(p.currency, (out.get(p.currency) ?? 0) + value);
  });
  return out;
}

/** Annual run rate — MRR × 12, not the sum of annual plan prices. */
export function arrByCurrency(plans) {
  const out = new Map();
  mrrByCurrency(plans).forEach((v, code) => out.set(code, v * 12));
  return out;
}

export const activeSubscribers = (plans) =>
  plans.filter((p) => p.active).reduce((n, p) => n + (p.subscribers ?? 0), 0);

/** Only money actually collected counts — pending and failed do not. */
export const isRealised = (tx) => tx.status === 'paid';

export function revenue(transactions, { type, from, to } = {}) {
  const rows = transactions.filter((t) => {
    if (!isRealised(t)) return false;
    if (type && t.type !== type) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  });
  return totalsByCurrency(rows);
}

/** Refunds are stored positive; they subtract from the period they land in. */
export function netRevenue(transactions, opts = {}) {
  const gross = revenue(transactions, opts);
  const refunds = totalsByCurrency(
    transactions.filter((t) => t.status === 'refunded'
      && (!opts.from || t.date >= opts.from) && (!opts.to || t.date <= opts.to)),
  );
  const out = new Map(gross);
  refunds.forEach((v, code) => out.set(code, (out.get(code) ?? 0) - v));
  return out;
}

/** Average revenue per subscriber, per month. */
export function arpu(plans) {
  const subs = activeSubscribers(plans);
  if (!subs) return new Map();
  const out = new Map();
  mrrByCurrency(plans).forEach((v, code) => out.set(code, v / subs));
  return out;
}

/** Money sitting in failed charges — the actionable number on this page. */
export function atRisk(transactions) {
  return totalsByCurrency(transactions.filter((t) => t.status === 'failed'));
}

/** Groups realised revenue into `YYYY-MM` buckets for the chart. */
export function monthlySeries(transactions, type, months) {
  return months.map((month) => {
    const rows = transactions.filter((t) => isRealised(t)
      && t.date.startsWith(month) && (!type || t.type === type));
    // Charting mixed currencies on one axis would be meaningless, so the
    // series is built from the dominant currency only.
    const totals = totalsByCurrency(rows);
    return totals.size ? [...totals.values()].reduce((a, b) => a + b, 0) : 0;
  });
}

/**
 * The day-range of `month`, stopping at `today` when `month` is the current
 * one.
 *
 * Comparing 19 days of this month against 31 of last month makes every
 * metric look like it is collapsing mid-month. Both sides of a
 * month-on-month comparison have to cover the same number of days.
 */
export function monthToDate(month, today = new Date().toISOString().slice(0, 10)) {
  const day = today.startsWith(month) ? Number(today.slice(8, 10)) : 31;
  return { from: `${month}-01`, to: `${month}-${String(day).padStart(2, '0')}`, day };
}

/** The same span of days one month earlier, for a like-for-like comparison. */
export function priorMonthToDate(month, today = new Date().toISOString().slice(0, 10)) {
  const [y, m] = month.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const key = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
  const { day } = monthToDate(month, today);
  return { from: `${key}-01`, to: `${key}-${String(day).padStart(2, '0')}`, month: key, day };
}

export function lastMonths(count, endISO = new Date().toISOString().slice(0, 10)) {
  const [y, m] = endISO.split('-').map(Number);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export const monthLabel = (ym) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

/** Percentage change, null when there is no base to compare against. */
export function growth(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/* ── Who is subscribed ──────────────────────────────────
   Derived from the charge log rather than a flag on the customer, so a
   subscription that lapses stops counting on its own.
   ─────────────────────────────────────────────────────── */

/** The newest charge on record — the horizon the windows below run back from. */
export const latestChargeDate = (transactions) =>
  transactions.reduce((max, t) => (t.date > max ? t.date : max), '');

const daysBefore = (date, days) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() - days * 86400000).toISOString().slice(0, 10);

/**
 * Customers with a subscription charge inside the billing window.
 *
 * The window runs a little past a month because a renewal does not land on
 * the same day every cycle — a strict 30 days would drop anyone billed on
 * the 31st and make subscriber counts sawtooth.
 */
export function subscriberIds(transactions, { asOf, days = 35 } = {}) {
  const end = asOf || latestChargeDate(transactions);
  if (!end) return new Set();
  const from = daysBefore(end, days);
  return new Set(
    transactions
      .filter((t) => t.type === 'subscription' && t.date > from && t.date <= end)
      .map((t) => String(t.customerId)),
  );
}

/** Each customer's first subscription charge, keyed by customer id. */
export function firstSubscriptionDates(transactions) {
  const out = new Map();
  transactions.filter((t) => t.type === 'subscription').forEach((t) => {
    const key = String(t.customerId);
    const seen = out.get(key);
    if (!seen || t.date < seen) out.set(key, t.date);
  });
  return out;
}

/** Customers whose first charge landed in the `days` before `asOf`. */
export function newSubscriberIds(transactions, { asOf, days = 30 } = {}) {
  const end = asOf || latestChargeDate(transactions);
  if (!end) return new Set();
  const from = daysBefore(end, days);
  const out = new Set();
  firstSubscriptionDates(transactions).forEach((date, id) => {
    if (date > from && date <= end) out.add(id);
  });
  return out;
}

/** New subscribers per week, for the trend line. */
export function newSubscriberSeries(transactions, { asOf, weeks = 8 } = {}) {
  const end = asOf || latestChargeDate(transactions);
  if (!end) return [];
  const firsts = [...firstSubscriptionDates(transactions).values()];
  return Array.from({ length: weeks }, (_, i) => {
    const to = daysBefore(end, 7 * (weeks - 1 - i));
    const from = daysBefore(to, 7);
    return firsts.filter((d) => d > from && d <= to).length;
  });
}

/** Units sold per recipe book, so pricing can be judged against demand. */
export function bookSales(transactions) {
  const out = new Map();
  transactions.filter((t) => t.type === 'book' && isRealised(t)).forEach((t) => {
    const row = out.get(t.item) ?? { item: t.item, units: 0, currency: t.currency, revenue: 0 };
    row.units += 1;
    row.revenue += toNum(t.amount) ?? 0;
    out.set(t.item, row);
  });
  return [...out.values()].sort((a, b) => b.revenue - a.revenue);
}

export { formatMoney };
