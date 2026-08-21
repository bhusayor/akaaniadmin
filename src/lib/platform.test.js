import { describe, it, expect } from 'vitest';
import {
  PLATFORM_TOTAL, platformOverview, rosterOverview, latestJoin, lapseSeries,
  joinedRecently, formatAsOf, formatCount, formatDelta,
} from './platform.js';
import { CUSTOMERS } from '../data/customers.js';

const roster = (statuses, joined = '2026-01-01') =>
  statuses.map((status, i) => ({ id: i, status, joined }));

describe('latestJoin', () => {
  it('picks the freshest record, not the last one in the array', () => {
    expect(latestJoin([
      { joined: '2025-04-02' }, { joined: '2026-02-16' }, { joined: '2024-11-30' },
    ])).toBe('2026-02-16');
  });

  it('is empty for an empty roster rather than throwing', () => {
    expect(latestJoin([])).toBe('');
  });
});

describe('platformOverview', () => {
  it('always has active and inactive sum to the total', () => {
    // Rounding both independently lets them miss by a user, and a panel
    // whose own numbers do not add up casts doubt on the whole page.
    [7, 33, 100, 207, 999].forEach((n) => {
      const o = platformOverview(roster(Array.from({ length: n }, (_, i) => (i % 7 ? 'active' : 'inactive'))), 2062);
      expect(o.active + o.inactive).toBe(2062);
    });
  });

  it('scales the measured inactive share up to the platform total', () => {
    const o = platformOverview(roster(['inactive', 'active', 'active', 'active']), 1000);
    expect(o.inactive).toBe(250);
    expect(o.active).toBe(750);
  });

  it('treats anything not lapsed as active', () => {
    const o = platformOverview(roster(['active', 'active', 'active', 'inactive']), 100);
    expect(o.inactive).toBe(25);
    expect(o.active).toBe(75);
  });

  it('reports the share of users that have gone quiet', () => {
    const o = platformOverview(roster(['inactive', 'active', 'active', 'active']), 1000);
    expect(o.inactiveShare).toBeCloseTo(25);
  });

  it('dates itself from the newest record, not the clock', () => {
    // A dashboard reading "as of today" over February data lies about
    // its own freshness.
    const o = platformOverview([
      { status: 'active', joined: '2026-02-16' },
      { status: 'active', joined: '2025-08-01' },
    ], 100);
    expect(o.asOf).toBe('2026-02-16');
  });

  it('counts joins inside the week and month windows, scaled', () => {
    const o = platformOverview([
      { status: 'active', joined: '2026-02-16' },  // asOf
      { status: 'active', joined: '2026-02-12' },  // within 7d
      { status: 'active', joined: '2026-02-01' },  // within 30d
      { status: 'active', joined: '2025-01-01' },  // outside both
    ], 4);
    expect(o.newThisWeek).toBe(2);
    expect(o.newThisMonth).toBe(3);
  });

  it('survives an empty roster without NaN', () => {
    const o = platformOverview([], 0);
    expect(o).toMatchObject({ total: 0, active: 0, inactive: 0, newThisWeek: 0, inactiveShare: 0 });
    expect(Number.isNaN(o.active)).toBe(false);
  });
});

describe('the real roster', () => {
  const o = platformOverview(CUSTOMERS);

  it('reconciles against the platform total', () => {
    expect(o.active + o.inactive).toBe(PLATFORM_TOTAL);
  });

  it('leaves the great majority of users active', () => {
    expect(o.active).toBeGreaterThan(o.inactive * 5);
  });

  it('shows growth in both windows, so no arrow points the wrong way', () => {
    expect(o.newThisWeek).toBeGreaterThan(0);
    expect(o.newThisMonth).toBeGreaterThanOrEqual(o.newThisWeek);
  });
});

describe('users that went quiet', () => {
  const roster = [
    { status: 'inactive', joined: '2025-01-01', lapsedOn: '2026-02-14' }, // in window
    { status: 'inactive', joined: '2025-01-01', lapsedOn: '2026-01-25' }, // in window
    { status: 'inactive', joined: '2025-01-01', lapsedOn: '2025-06-01' }, // outside
    { status: 'active', joined: '2026-02-16' },
  ];

  it('counts only lapses inside the month window', () => {
    expect(platformOverview(roster, 4).becameInactive).toBe(2);
  });

  it('scales the count to the platform', () => {
    expect(platformOverview(roster, 40).becameInactive).toBe(20);
  });

  it('ignores active accounts, which carry no lapse date', () => {
    expect(platformOverview(
      [{ status: 'active', joined: '2026-02-16' }], 100,
    ).becameInactive).toBe(0);
  });

  it('buckets lapses by week for the trend line', () => {
    const s = lapseSeries(roster, '2026-02-16', 8, 1);
    expect(s).toHaveLength(8);
    expect(s.reduce((a, b) => a + b, 0)).toBe(2);
    expect(s[7]).toBe(1); // the 14 Feb lapse lands in the final week
  });

  it('has no series without a date to anchor to', () => {
    expect(lapseSeries(roster, '', 8, 1)).toEqual([]);
  });
});

describe('the real roster records when accounts lapsed', () => {
  it('gives every inactive account a lapse date, and no one else', () => {
    CUSTOMERS.forEach((c) => {
      expect(Boolean(c.lapsedOn)).toBe(c.status === 'inactive');
    });
  });

  it('never lapses an account before it joined', () => {
    CUSTOMERS.filter((c) => c.lapsedOn).forEach((c) => {
      expect(c.lapsedOn >= c.joined).toBe(true);
    });
  });

  it('never lapses an account past the roster horizon', () => {
    const horizon = latestJoin(CUSTOMERS);
    CUSTOMERS.filter((c) => c.lapsedOn).forEach((c) => {
      expect(c.lapsedOn <= horizon).toBe(true);
    });
  });

  it('leaves a month of churn small next to the active base', () => {
    const o = platformOverview(CUSTOMERS);
    expect(o.becameInactive).toBeGreaterThan(0);
    expect(o.becameInactive).toBeLessThan(o.inactive);
  });
});

describe('rosterOverview', () => {
  const roster = [
    { status: 'active', joined: '2026-02-14' },
    { status: 'active', joined: '2026-02-01' },
    { status: 'active', joined: '2024-05-05' },
    { status: 'active', joined: '2026-02-15' },
    { status: 'inactive', joined: '2024-01-01', lapsedOn: '2026-02-10' },
    { status: 'inactive', joined: '2024-01-01', lapsedOn: '2025-03-01' },
  ];
  const o = rosterOverview(roster);

  it('counts the records themselves, with no scaling', () => {
    // The customer table can be edited, so the panel must report what is
    // in it rather than a sample projected onto the platform.
    expect(o.total).toBe(6);
    expect(o.active).toBe(4);
    expect(o.inactive).toBe(2);
  });

  it('has active and inactive account for every row', () => {
    // There is no third state, so anything not active must be inactive.
    expect(o.active + o.inactive).toBe(o.total);
  });

  it('counts joins and lapses in their windows', () => {
    expect(o.joinedThisWeek).toBe(2);      // 14 and 15 Feb
    expect(o.joinedThisMonth).toBe(3);     // plus 1 Feb
    expect(o.activeThisMonth).toBe(3);
    expect(o.becameInactive).toBe(1);      // only the 10 Feb lapse
  });

  it('gives each bucket its own trend line', () => {
    expect(o.totalSeries).toHaveLength(8);
    expect(o.totalSeries.at(-1)).toBe(o.total);
    expect(o.activeSeries).toHaveLength(8);
    expect(o.inactiveSeries).toHaveLength(8);
    expect(o.newSeries).toHaveLength(8);
  });

  it('tracks edits to the roster', () => {
    const fewer = rosterOverview(roster.filter((c) => c.status !== 'inactive'));
    expect(fewer.total).toBe(4);
    expect(fewer.inactive).toBe(0);
    expect(fewer.active).toBe(4);
  });

  it('survives an empty table without NaN or a bad date', () => {
    const empty = rosterOverview([]);
    expect(empty).toMatchObject({ total: 0, active: 0, inactive: 0, joinedThisMonth: 0 });
    expect(formatAsOf(empty.asOf)).toBe('');
  });
});

describe('joinedRecently', () => {
  const asOf = '2026-02-16';

  it('accepts a join inside the window', () => {
    expect(joinedRecently({ joined: '2026-02-01' }, asOf)).toBe(true);
  });

  it('rejects one outside it', () => {
    expect(joinedRecently({ joined: '2025-12-30' }, asOf)).toBe(false);
  });

  it('never counts a record with no join date', () => {
    expect(joinedRecently({}, asOf)).toBe(false);
  });

  it('is false with nothing to anchor to, rather than throwing', () => {
    expect(joinedRecently({ joined: '2026-02-01' }, '')).toBe(false);
  });

  it('agrees with the count the New card shows', () => {
    const o = rosterOverview(CUSTOMERS);
    const matching = CUSTOMERS.filter((c) => joinedRecently(c, o.asOf)).length;
    expect(matching).toBe(o.joinedThisMonth);
  });
});

describe('the real roster panel', () => {
  const o = rosterOverview(CUSTOMERS);

  it('reconciles its buckets against the row count', () => {
    expect(o.active + o.inactive).toBe(CUSTOMERS.length);
  });

  it('has no customer left in a pending state', () => {
    expect(CUSTOMERS.some((c) => c.status === 'pending')).toBe(false);
  });

  it('ends its running total on the row count', () => {
    expect(o.totalSeries.at(-1)).toBe(CUSTOMERS.length);
  });
});

describe('formatting', () => {
  it('writes the month out, so 03/04 is never ambiguous', () => {
    expect(formatAsOf('2026-03-26')).toBe('26 March 2026');
    expect(formatAsOf('2026-02-16')).toBe('16 February 2026');
  });

  it('does not shift the date across a timezone', () => {
    expect(formatAsOf('2026-01-01')).toBe('1 January 2026');
  });

  it('is empty for a missing date rather than "Invalid Date"', () => {
    expect(formatAsOf('')).toBe('');
  });

  it('groups thousands', () => {
    expect(formatCount(2062)).toBe('2,062');
  });

  it('signs a delta explicitly, with a true minus', () => {
    expect(formatDelta(20)).toBe('+20');
    expect(formatDelta(-5)).toBe('−5');
    expect(formatDelta(0)).toBe('0');
  });
});
