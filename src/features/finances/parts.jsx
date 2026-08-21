import { cx } from '../../components/ui.jsx';
import { IconTrendUp, IconTrendDown } from '../../components/icons.jsx';
import { formatPercent } from '../../lib/finance.js';

/* ═══════════════════════════════════════════════════════
   FINANCE PAGE PARTS
   ═══════════════════════════════════════════════════════ */

/**
 * A headline number, optionally with its month-on-month move.
 *
 * Three distinct states, because collapsing them misleads:
 *   delta omitted   — a point-in-time count; month-on-month is meaningless
 *   delta null      — a comparison was attempted and there was no base
 *   delta a number  — a real move
 *
 * A missing base must never render as 0%, which reads as "flat" when the
 * truth is "unknown".
 */
export function KpiCard({ label, value, sub, delta, deltaLabel = 'vs last month', icon: Icon, tone = 'mint' }) {
  const tones = {
    mint: 'bg-mint-light text-mint-deep',
    ocean: 'bg-ocean-light text-ocean-deep',
    grape: 'bg-grape-light text-grape',
    amber: 'bg-amber-light text-amber-deep',
  }[tone];

  const up = delta !== null && delta !== undefined && delta >= 0;

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-ink-3">{label}</div>
        {Icon && <span className={cx('grid size-7 shrink-0 place-items-center rounded-lg', tones)}><Icon /></span>}
      </div>
      <div className="mt-2.5 text-[26px] font-bold leading-none tracking-[-0.02em] text-ink tabular-nums">{value}</div>
      {delta !== undefined && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {delta === null ? (
            <span className="text-[11.5px] text-ink-3">nothing to compare against</span>
          ) : (
            <>
              <span
                className={cx(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                  up ? 'bg-mint-light text-mint-deep' : 'bg-chili-light text-chili-deep',
                )}
              >
                {up ? <IconTrendUp /> : <IconTrendDown />}
                {formatPercent(delta)}
              </span>
              <span className="text-[11.5px] text-ink-3">{deltaLabel}</span>
            </>
          )}
        </div>
      )}
      {sub && <div className={cx('text-[11.5px] text-ink-3', delta === undefined ? 'mt-2.5' : 'mt-1.5')}>{sub}</div>}
    </div>
  );
}

/** Pill-style segmented control — currency, period, stream. */
export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cx('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx(
            'cursor-pointer rounded-[6px] px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition',
            value === o.value
              ? 'bg-surface text-ink shadow-soft'
              : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** One row's share of a total, drawn as a bar so the table scans at a glance. */
export function ShareBar({ value, total, tone = 'bg-mint' }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-14 overflow-hidden rounded-full bg-line-light">
        <div className={cx('h-full rounded-full', tone)} style={{ width: `${Math.max(pct, 1.5)}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink-3">{pct.toFixed(0)}%</span>
    </div>
  );
}

/** The two streams side by side, so the mix is visible without a legend. */
export function SplitBar({ subscription, book, format }) {
  const total = subscription + book;
  const pct = (v) => (total > 0 ? (v / total) * 100 : 50);

  const rows = [
    { label: 'Subscriptions', value: subscription, bar: 'bg-mint', dot: 'bg-mint' },
    { label: 'Recipe books', value: book, bar: 'bg-ocean', dot: 'bg-ocean' },
  ];

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-line-light">
        {rows.map((r) => (
          <div key={r.label} className={r.bar} style={{ width: `${pct(r.value)}%` }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-1.5">
            <span className={cx('size-2 rounded-full', r.dot)} />
            <span className="text-[12px] text-ink-2">{r.label}</span>
            <span className="text-[12px] font-semibold text-ink tabular-nums">{format(r.value)}</span>
            <span className="text-[11px] text-ink-3 tabular-nums">({pct(r.value).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionHead({ title, sub, right }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
      {/* A min width so the heading wraps the controls onto their own line
          rather than being squeezed to two words beside them. */}
      <div className="min-w-45 flex-1">
        <div className="text-[14px] font-semibold text-ink">{title}</div>
        {sub && <div className="mt-0.5 text-[12px] text-ink-3">{sub}</div>}
      </div>
      {right}
    </div>
  );
}
