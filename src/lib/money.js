/* ═══════════════════════════════════════════════════════
   MONEY

   Shared by recipe-group pricing and the finance page. Split out so
   neither has to import the other just to format an amount.
   ═══════════════════════════════════════════════════════ */

export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: '$ — US Dollar' },
  { code: 'NGN', symbol: '₦', label: '₦ — Nigerian Naira' },
  { code: 'GHS', symbol: '₵', label: '₵ — Ghanaian Cedi' },
  { code: 'KES', symbol: 'KSh', label: 'KSh — Kenyan Shilling' },
  { code: 'GBP', symbol: '£', label: '£ — Pound Sterling' },
];

export function currencySymbol(code) {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/**
 * `$4.99`, `₦44,748,000.00`.
 *
 * Two decimals always — a price reading "$5" looks like a typo — and
 * grouped thousands, because an eight-digit revenue figure without
 * separators cannot be read at a glance.
 */
export function formatPrice(price, currency) {
  if (price === null || price === undefined || price === '') return '—';
  const n = Number(price);
  if (Number.isNaN(n)) return '—';
  const sym = currencySymbol(currency);
  const amount = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return sym.length > 1 ? `${sym} ${amount}` : `${sym}${amount}`;
}

/** '' / junk -> null, so a cleared price never silently becomes 0. */
export function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

/** Alias — reads better where the amount is revenue rather than a price. */
export const formatMoney = formatPrice;

/**
 * `₦1.2M` / `$4.3K` — for axis ticks and headline figures, where the exact
 * kobo is noise. Anything a number is *reconciled* against uses formatMoney.
 */
export function compactMoney(amount, code = 'USD') {
  const symbol = currencySymbol(code);
  const n = toNum(amount) ?? 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}${symbol}${Math.round(abs)}`;
}

/**
 * Totals are grouped by currency rather than summed blindly.
 * Adding ₦ to $ produces a number that is wrong in a way nobody notices,
 * so mixed currencies stay separate until someone supplies a rate.
 */
export function totalsByCurrency(rows, amountKey = 'amount') {
  const out = new Map();
  rows.forEach((r) => {
    const amount = toNum(r[amountKey]);
    if (amount === null) return;
    out.set(r.currency, (out.get(r.currency) ?? 0) + amount);
  });
  return out;
}

/** Formats a totals map, keeping each currency distinct. */
export function formatTotals(totals) {
  if (!totals.size) return '—';
  return [...totals].map(([code, amount]) => formatMoney(amount, code)).join(' + ');
}
