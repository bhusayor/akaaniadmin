import { cx } from './ui.jsx';

/* ═══════════════════════════════════════════════════════
   STAT PANEL

   Headline counts under one heading, with the first card filled to mark
   it as the figure the others break down.

   Shared by the dashboard's platform figures and the customer roster, so
   the two read as the same object rather than two similar ones.
   ═══════════════════════════════════════════════════════ */

/**
 * A trend line drawn from the values themselves, so its direction always
 * matches the note printed beside it. A sparkline rising next to a fall is
 * worse than no sparkline at all.
 */
export function Sparkline({ values, stroke, className }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 56},${20 - ((v - min) / span) * 16}`)
    .join(' ');

  return (
    <svg
      className={cx('pointer-events-none absolute bottom-3.5 right-4', className)}
      width="56" height="24" viewBox="0 0 56 24" aria-hidden="true"
    >
      <polyline
        fill="none" stroke={stroke} strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round" points={points}
      />
    </svg>
  );
}

const NOTE_TONE = {
  up: 'text-mint',
  down: 'text-chili',
  warn: 'text-amber-deep',
  neutral: 'text-ink-3',
};

const LINE_TONE = {
  up: 'rgba(29,158,117,0.35)',
  down: 'rgba(226,75,74,0.35)',
  warn: 'rgba(200,169,126,0.5)',
  neutral: 'rgba(156,163,175,0.35)',
};

/**
 * `direction` draws the arrow and is set only when the note carries a
 * movement. `tone` colours the text and line independently — a count that
 * is not a change gets no arrow, whatever colour it wears.
 *
 * With `onClick` the card becomes a filter control; `selected` marks the
 * one currently applied.
 */
export function StatCard({
  label, value, note, direction, tone = 'neutral', trend,
  filled, onClick, selected, title,
}) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      aria-pressed={onClick ? !!selected : undefined}
      className={cx(
        'relative overflow-hidden rounded-[14px] px-5 py-4.5 text-left transition',
        onClick && 'cursor-pointer',
        filled
          ? 'bg-forest shadow-mid'
          : 'border border-line-light bg-surface-2',
        onClick && !filled && 'hover:border-line hover:shadow-soft',
        /* The ring sits inside the radius so a selected card does not grow
           and nudge its neighbours. */
        selected && (filled
          ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface'
          : 'border-forest/30 ring-2 ring-forest/15'),
      )}
    >
      <div
        className={cx(
          'text-[11px] font-semibold uppercase tracking-[0.09em]',
          filled ? 'text-white/50' : 'text-ink-3',
        )}
      >
        {label}
      </div>

      <div
        className={cx(
          'mt-2 text-[30px] font-bold leading-none tracking-[-0.025em] tabular-nums',
          filled ? 'text-white' : 'text-ink',
        )}
      >
        {value}
      </div>

      <div
        className={cx(
          'mt-2.5 flex items-center gap-1 text-[12.5px] font-medium',
          filled ? 'text-accent' : NOTE_TONE[tone],
        )}
      >
        {direction && <span aria-hidden="true">{direction === 'down' ? '↓' : '↑'}</span>}
        {note}
      </div>

      {trend?.length > 1 && (
        <Sparkline
          values={trend}
          stroke={filled ? 'rgba(93,202,165,0.55)' : LINE_TONE[tone]}
        />
      )}
    </Tag>
  );
}

export default function StatPanel({ title, subtitle, cards, footer, className }) {
  return (
    <div
      className={cx(
        'rounded-card border border-line bg-surface px-6 pt-5 pb-6 shadow-soft max-md:px-4',
        className,
      )}
    >
      <div className="text-[12.5px] font-bold uppercase tracking-[0.09em] text-ink">{title}</div>
      {subtitle && <div className="mt-1 text-[12.5px] text-ink-3">{subtitle}</div>}

      <div className="mt-4.5 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {footer && <div className="mt-4 text-[12px] text-ink-3">{footer}</div>}
    </div>
  );
}
