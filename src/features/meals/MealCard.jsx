import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '../../components/ui.jsx';

/* ═══════════════════════════════════════════════════════
   MEAL CARD

   Photo, name, meal-type pills, countries, then a tags row.

   `types` is read as an array so a meal can be both Lunch and Dinner —
   the same reason the list is no longer grouped by tag.
   ═══════════════════════════════════════════════════════ */

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}

export default function MealCard({ meal, onCopyId }) {
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const types = meal.types ?? [meal.type];

  const copy = (e) => {
    // Sits inside the card link — must not navigate.
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(String(meal.id)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
    onCopyId?.(meal);
  };

  return (
    <Link
      to={`/meals/${meal.id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-soft transition hover:-translate-y-0.5 hover:border-mint/40 hover:shadow-mid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
    >
      {/* Photo */}
      <div className="relative aspect-4/3 shrink-0 overflow-hidden bg-gradient-to-br from-mint-light to-[#F3FAF7]">
        {meal.image && !failed ? (
          <img
            src={meal.image}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <span className="grid size-20 place-items-center rounded-full bg-white/60 text-[38px] shadow-soft">
              {meal.emoji}
            </span>
          </div>
        )}

        <button
          onClick={copy}
          className={cx(
            'absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5',
            'text-[12px] font-medium shadow-soft backdrop-blur transition cursor-pointer',
            copied ? 'bg-forest text-white' : 'bg-white/92 text-ink hover:bg-white',
          )}
        >
          {copied ? 'Copied' : 'Copy ID'}
          <CopyIcon />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 pb-3 pt-4">
        <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink transition group-hover:text-forest">
          {meal.name}
        </h3>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {types.map((t) => (
            <span
              key={t}
              className="rounded-full bg-amber-light px-2.5 py-1 text-[11.5px] font-medium capitalize text-amber-deep"
            >
              {t}
            </span>
          ))}
        </div>

        <p className="mt-3 text-[13px] text-ink-3">
          <span className="text-ink-2">Countries:</span> {meal.countries.join(', ')}
        </p>

        {/* Tags are reported, not used to group — a meal can hold several. */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-light pt-3">
          <span className="text-[13px] text-ink-2">Meal Tags</span>
          <span
            title={meal.tags.length ? meal.tags.join(', ') : 'No tags assigned'}
            className={cx(
              'rounded-full px-2.5 py-1 text-[11.5px] font-medium',
              meal.tags.length ? 'bg-mint-light text-mint-deep' : 'bg-line-light text-ink-3',
            )}
          >
            {meal.tags.length ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
    </Link>
  );
}
