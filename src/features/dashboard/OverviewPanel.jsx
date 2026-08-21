import StatPanel from '../../components/StatPanel.jsx';
import { formatAsOf, formatCount, formatDelta } from '../../lib/platform.js';

/* ═══════════════════════════════════════════════════════
   PLATFORM OVERVIEW PANEL

   The dashboard's headline user counts. The panel chrome and the cards
   themselves live in components/StatPanel.jsx, shared with the customer
   roster so the two read as one object.
   ═══════════════════════════════════════════════════════ */

export default function OverviewPanel({ overview }) {
  const {
    asOf, total, active, inactive, newThisWeek, newThisMonth,
    becameInactive, perWeek, lapsedPerWeek, totalSeries, activeSeries,
  } = overview;

  const move = (n) => (n < 0 ? 'down' : 'up');

  const cards = [
    {
      label: 'All users',
      value: formatCount(total),
      note: `${formatDelta(newThisWeek)} this week`,
      direction: move(newThisWeek),
      tone: move(newThisWeek),
      trend: totalSeries,
      filled: true,
    },
    {
      label: 'Active users',
      value: formatCount(active),
      note: `${formatDelta(newThisMonth)} this month`,
      direction: move(newThisMonth),
      tone: move(newThisMonth),
      trend: activeSeries,
    },
    {
      label: 'Inactive users',
      value: formatCount(inactive),
      note: `${formatCount(becameInactive)} went quiet this month`,
      direction: 'down',
      tone: 'down',
      trend: lapsedPerWeek,
    },
    {
      label: 'New users',
      value: formatCount(newThisWeek),
      note: 'joined this week',
      direction: 'up',
      tone: 'up',
      trend: perWeek,
    },
  ];

  return (
    <StatPanel
      className="mb-5"
      title="Platform overview"
      subtitle={`As of ${formatAsOf(asOf)}`}
      cards={cards}
    />
  );
}
