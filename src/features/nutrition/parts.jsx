import { Badge, cx } from '../../components/ui.jsx';
import { macroValue } from '../../lib/mealNutrition.js';

/** WAFCT / USDA, the two sources the collection holds. */
export function SourceTag({ source }) {
  if (source === 'wafct') return <Badge tone="mint">WAFCT</Badge>;
  if (source === 'usda') return <Badge tone="ocean">USDA</Badge>;
  return <Badge>{source || 'unknown'}</Badge>;
}

/* Dot colours per nutrient, so a row of figures can be read at a glance
   without labels repeating on every line. */
const NUTRIENTS = [
  { key: 'calories', label: 'kcal', dot: 'bg-forest', calories: true },
  { key: 'protein', label: 'protein', dot: 'bg-mint' },
  { key: 'carbohydrate', label: 'carbs', dot: 'bg-amber' },
  { key: 'fat', label: 'fat', dot: 'bg-rust' },
  { key: 'fiber', label: 'fibre', dot: 'bg-grape' },
];

/**
 * A preparation's per-100g figures as chips.
 *
 * A nutrient the source never published shows an em dash. It is not 0,
 * and a chip that reads "0g fibre" would be a measurement nobody made.
 */
export function MacroChips({ record, className }) {
  const per100 = record?.nutrients_per_100g || {};
  const estimated = record?.estimated_nutrients || [];

  return (
    <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-2', className)}>
      {NUTRIENTS.map(({ key, label, dot, calories }) => {
        const value = macroValue(per100[key]);
        const isEstimate = estimated.includes(key);
        return (
          <span key={key} className={cx('inline-flex items-center gap-1.5',
            calories && 'rounded-full bg-surface-2 px-2 py-0.5')}>
            <span className={cx('size-1.5 shrink-0 rounded-full', dot)} />
            {value === null ? (
              <span className="italic text-ink-3">— {label}</span>
            ) : (
              <span className={cx('tabular-nums', isEstimate && 'text-amber-deep')}
                title={isEstimate ? 'Bracketed in the source — a lower-confidence figure' : undefined}>
                <b className="font-semibold text-ink">{value}{calories ? '' : 'g'}</b>
                {isEstimate ? '*' : ''} {calories ? 'kcal' : label}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
