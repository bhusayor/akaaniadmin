/* ═══════════════════════════════════════════════════════
   PLATFORM OVERVIEW

   The headline user counts on the dashboard.

   Every figure here is derived from one canonical total and the customer
   roster's own status mix, so the numbers on screen add up: active and
   inactive always sum to the total, and the sidebar badge, the overview
   and the country breakdown can never drift apart.
   ═══════════════════════════════════════════════════════ */

/** The platform's user count. The customer table is a sample of it. */
export const PLATFORM_TOTAL = 2062;

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);

const shift = (date, days) => iso(new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY));

/**
 * The freshest record in the roster.
 *
 * The panel is dated from the data, not from the clock — a dashboard that
 * says "as of today" over figures that stopped updating in February is
 * lying about its own freshness.
 */
export function latestJoin(customers) {
  return customers.reduce((max, c) => (c.joined > max ? c.joined : max), '');
}

/** How many joined in the `days` before `asOf`, scaled to the platform. */
function joinedWithin(customers, asOf, days, scale) {
  /* No records means no window to count in — shifting an empty date
     produces an Invalid Date and throws on the way out. */
  if (!asOf) return 0;
  const from = shift(asOf, -days);
  const n = customers.filter((c) => c.joined > from && c.joined <= asOf).length;
  return Math.round(n * scale);
}

/**
 * @param customers the roster sample
 * @param total     the platform-wide user count
 */
export function platformOverview(customers, total = PLATFORM_TOTAL) {
  const asOf = latestJoin(customers);
  const scale = customers.length ? total / customers.length : 0;

  /* Inactive is the measured share; active is whatever is left. Rounding
     both independently would let them miss the total by a user or two,
     and a panel whose own numbers do not add up invites doubt about the
     rest of the page. */
  const inactive = Math.round(
    (customers.filter((c) => c.status === 'inactive').length / (customers.length || 1)) * total,
  );
  const active = total - inactive;

  const newThisWeek = joinedWithin(customers, asOf, 7, scale);
  const newThisMonth = joinedWithin(customers, asOf, 30, scale);

  const perWeek = joinSeries(customers, asOf, 8, scale);
  const lapsedPerWeek = lapseSeries(customers, asOf, 8, scale);

  return {
    asOf,
    total,
    active,
    inactive,
    newThisWeek,
    newThisMonth,
    /* Accounts that went quiet in the last 30 days — counted from the
       dates on the records, not inferred from the current split. */
    becameInactive: lapsedWithin(customers, asOf, 30, scale),
    perWeek,
    lapsedPerWeek,
    totalSeries: cumulativeTo(total, perWeek),
    activeSeries: cumulativeTo(active, perWeek),
    inactiveShare: total ? (inactive / total) * 100 : 0,
  };
}

/** How many lapsed in the `days` before `asOf`, scaled to the platform. */
function lapsedWithin(customers, asOf, days, scale) {
  if (!asOf) return 0;
  const from = shift(asOf, -days);
  const n = customers.filter((c) => c.lapsedOn && c.lapsedOn > from && c.lapsedOn <= asOf).length;
  return Math.round(n * scale);
}

/**
 * Joins per week over the `weeks` ending at `asOf`, scaled to the platform.
 *
 * The sparklines are drawn from this rather than from a shape chosen to
 * look good — a trend line implying a movement the data does not record is
 * the same fabrication as a made-up number, just harder to notice.
 */
export function joinSeries(customers, asOf, weeks = 8, scale = 1) {
  return weeklySeries(customers, asOf, weeks, scale, 'joined');
}

/** The same, over the date an account went quiet. */
export function lapseSeries(customers, asOf, weeks = 8, scale = 1) {
  return weeklySeries(customers, asOf, weeks, scale, 'lapsedOn');
}

function weeklySeries(customers, asOf, weeks, scale, field) {
  if (!asOf) return [];
  return Array.from({ length: weeks }, (_, i) => {
    const to = shift(asOf, -7 * (weeks - 1 - i));
    const from = shift(to, -7);
    const n = customers.filter((c) => c[field] && c[field] > from && c[field] <= to).length;
    return Math.round(n * scale);
  });
}

/** The running total that arrives at `total` on the final week. */
export function cumulativeTo(total, perWeek) {
  const out = [];
  let running = total;
  for (let i = perWeek.length - 1; i >= 0; i--) {
    out[i] = running;
    running -= perWeek[i];
  }
  return out;
}

/**
 * The customer table's own figures.
 *
 * Unlike platformOverview these are raw counts of the records on screen,
 * not a sample scaled up — the customer page lets you delete rows and flip
 * a status, and an overview that ignored those edits would contradict the
 * table underneath it.
 */
export function rosterOverview(customers) {
  const asOf = latestJoin(customers);
  const of = (status) => customers.filter((c) => c.status === status);

  const active = of('active');
  const inactive = of('inactive');

  return {
    asOf,
    total: customers.length,
    active: active.length,
    inactive: inactive.length,

    joinedThisWeek: joinedWithin(customers, asOf, 7, 1),
    joinedThisMonth: joinedWithin(customers, asOf, 30, 1),
    activeThisMonth: joinedWithin(active, asOf, 30, 1),
    becameInactive: lapsedWithin(customers, asOf, 30, 1),

    totalSeries: cumulativeTo(customers.length, joinSeries(customers, asOf)),
    activeSeries: joinSeries(active, asOf),
    inactiveSeries: lapseSeries(customers, asOf),
    newSeries: joinSeries(customers, asOf),
  };
}

/** Did this account join inside the `days` before `asOf`? */
export function joinedRecently(customer, asOf, days = 30) {
  if (!asOf || !customer.joined) return false;
  return customer.joined > shift(asOf, -days) && customer.joined <= asOf;
}

/** `26 March 2026` — long month, so 03/04 is never ambiguous. */
export function formatAsOf(date) {
  if (!date) return '';
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** `2,062` */
export const formatCount = (n) => n.toLocaleString('en-US');

/** `+20`, `−5`, `0` — a true minus sign, and an explicit sign on gains. */
export function formatDelta(n) {
  if (n > 0) return `+${formatCount(n)}`;
  if (n < 0) return `−${formatCount(Math.abs(n))}`;
  return '0';
}
