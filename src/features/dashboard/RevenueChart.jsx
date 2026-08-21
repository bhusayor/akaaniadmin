import { useState } from 'react';

/* ═══════════════════════════════════════════════════════
   REVENUE CHART

   A single smoothed line over a gradient fill, drawn as inline SVG —
   no charting dependency.

   The path is drawn in a 0–100 viewBox with preserveAspectRatio="none"
   so it stretches to whatever width the card gets. That would normally
   distort the stroke and turn dots into ellipses, so the line uses
   vector-effect="non-scaling-stroke" and the dots are positioned
   absolutely in percentages rather than drawn in the SVG.
   ═══════════════════════════════════════════════════════ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Cubic bezier through every point, with control points at the horizontal midpoints. */
function smoothPath(points) {
  return points.reduce((d, [x, y], i) => {
    if (i === 0) return `M ${x},${y}`;
    const [px, py] = points[i - 1];
    const mid = (px + x) / 2;
    return `${d} C ${mid},${py} ${mid},${y} ${x},${y}`;
  }, '');
}

export default function RevenueChart({
  values,
  months = MONTHS,
  height = 300,
  format = (v) => `₦${(v * 1000).toLocaleString()}`,
  /* Axis ticks default to the dashboard's thousands basis. Callers whose
     values are already absolute amounts pass their own formatter. */
  tick = (v) => (v === 0 ? '0' : v >= 1000 ? `${Math.round(v / 1000)}m` : `${v}k`),
  /* Twelve full month names do not fit the dashboard card, so it shows
     initials. A wider card can pass through the whole label. */
  labelFor = (m) => m.slice(0, 1),
}) {
  const [hover, setHover] = useState(null);

  /* Headroom above the peak so the line never touches the ceiling. */
  const max = Math.max(...values) * 1.15;
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * 100,
    100 - (v / max) * 100,
  ]);

  const line = smoothPath(points);
  const area = `${line} L 100,100 L 0,100 Z`;

  /* Four evenly spaced gridlines, labelled in the data's own units. */
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: t * 100,
    label: (1 - t) * max,
  }));

  return (
    <div className="px-5 pb-4 pt-5">
      <div className="flex gap-3">
        {/* Y axis */}
        <div className="relative w-9 shrink-0" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t.y}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-ink-3"
              style={{ top: `${t.y}%` }}
            >
              {tick(Math.round(t.label))}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height }}>
          {/* Gridlines */}
          {ticks.map((t) => (
            <div key={t.y} className="absolute inset-x-0 border-t border-line-light" style={{ top: `${t.y}%` }} />
          ))}

          <svg
            className="absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-mint)" stopOpacity="0.32" />
                <stop offset="55%" stopColor="var(--color-mint)" stopOpacity="0.10" />
                <stop offset="100%" stopColor="var(--color-mint)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="revenue-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--color-forest)" />
                <stop offset="100%" stopColor="var(--color-mint)" />
              </linearGradient>
            </defs>

            <path d={area} fill="url(#revenue-fill)" />
            <path
              d={line}
              fill="none"
              stroke="url(#revenue-line)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Points and hover targets — absolute so they stay circular. */}
          {points.map(([x, y], i) => (
            <div
              key={i}
              className="absolute top-0 h-full -translate-x-1/2"
              style={{ left: `${x}%`, width: `${100 / values.length}%` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && <div className="absolute inset-y-0 left-1/2 w-px bg-mint/30" />}
              <span
                className={
                  'absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ' +
                  'border-surface bg-mint transition-opacity ' +
                  (hover === i ? 'opacity-100' : 'opacity-0')
                }
                style={{ top: `${y}%` }}
              />
              {hover === i && (
                <div
                  className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-medium text-white shadow-tall"
                  style={{ top: `${y}%` }}
                >
                  <div className="text-white/55">{months[i]}</div>
                  <div className="tabular-nums">{format(values[i])}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* X axis — positioned on the same percentages as the points, so the
          labels line up with the line rather than sitting in equal slots. */}
      <div className="mt-2 flex gap-3">
        <div className="w-9 shrink-0" />
        <div className="relative h-4 min-w-0 flex-1">
          {points.map(([x], i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 text-[10px] text-ink-3"
              style={{ left: `${x}%` }}
            >
              {labelFor(months[i])}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
