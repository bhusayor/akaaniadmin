import { useEffect, useState } from 'react';
import { cx } from '../../components/ui.jsx';
import { IconImage, IconChevronDown } from '../../components/icons.jsx';
import { CONFIDENCE_NOTE } from '../../lib/mealNutrition.js';

/* ═══════════════════════════════════════════════════════
   DRAFT REVIEW

   The whole meal, written out in the conversation, so it can be read and
   vetted before it ever reaches the form.

   Every field appears whether or not it is filled — a blank row saying
   "not set" is information, and a field that silently vanished when empty
   would be impossible to notice was missing.

   Only the newest card is expanded. Earlier ones collapse to a line so a
   long session stays readable while its history stays inspectable.
   ═══════════════════════════════════════════════════════ */

function Row({ label, children, empty }) {
  return (
    <div className="flex gap-3 border-b border-line-light py-1.5 last:border-0">
      <div className="w-24 shrink-0 text-[11px] leading-relaxed text-ink-3">{label}</div>
      <div className={cx('min-w-0 flex-1 text-[12px] leading-relaxed', empty ? 'italic text-ink-3' : 'text-ink')}>
        {children}
      </div>
    </div>
  );
}

const Value = ({ value, unit }) => (
  value === null || value === undefined || value === ''
    ? <span className="italic text-ink-3">not set</span>
    : <>{value}{unit ? ` ${unit}` : ''}</>
);

const ListValue = ({ items }) => (
  items?.length
    ? <span className="flex flex-wrap gap-1">
        {items.map((t) => (
          <span key={t} className="rounded bg-line-light px-1.5 py-px text-[11px] text-ink-2">{t}</span>
        ))}
      </span>
    : <span className="italic text-ink-3">none</span>
);

export default function DraftReview({ draft, nutrition, latest }) {
  const [open, setOpen] = useState(latest);

  /* Collapse when a newer draft supersedes this one. Only on that
     transition, so re-expanding an old card by hand still sticks. */
  useEffect(() => { if (!latest) setOpen(false); }, [latest]);

  const ings = draft.ingredients ?? [];
  const steps = draft.instructions ?? [];

  return (
    <div className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-ink">
            {draft.name || 'Untitled draft'}
          </span>
          <span className="block text-[11px] text-ink-3">
            {open ? 'Full draft — check it before applying' : 'Tap to read the full draft'}
          </span>
        </span>
        <span className={cx('shrink-0 text-ink-3 transition', open && 'rotate-180')}>
          <IconChevronDown />
        </span>
      </button>

      {open && (
        <div className="border-t border-line-light px-3 pb-3 pt-1">
          {/* Image first, matching the order of the form it will fill. */}
          <Row label="Image">
            {draft.image
              ? <img src={draft.image} alt="" className="h-24 w-full rounded-lg object-cover" />
              : (
                <span className="flex items-center gap-1.5 italic text-ink-3">
                  <IconImage /> none — add one on the form
                </span>
              )}
          </Row>

          <Row label="Name"><Value value={draft.name} /></Row>
          <Row label="Emoji"><Value value={draft.emoji} /></Row>
          <Row label="Description"><Value value={draft.description} /></Row>
          <Row label="Lu tips"><Value value={draft.luTips} /></Row>
          <Row label="Notification"><Value value={draft.notificationMessage} /></Row>
          <Row label="Type"><ListValue items={draft.types} /></Row>
          <Row label="Category"><Value value={draft.category} /></Row>
          <Row label="Tags"><ListValue items={draft.tags} /></Row>
          <Row label="Countries"><ListValue items={draft.countries} /></Row>
          <Row label="Servings"><Value value={draft.servings} /></Row>
          <Row label="Cook time"><Value value={draft.prep} unit="min" /></Row>
          <Row label="Portion"><Value value={draft.portion} /></Row>
          <Row label="Conditions"><ListValue items={draft.healthConditions} /></Row>
          <Row label="Video"><Value value={draft.videoUrl} /></Row>

          <Row label={`Ingredients${ings.length ? ` (${ings.length})` : ''}`}>
            {ings.length ? (
              <ol className="space-y-0.5">
                {ings.map((ing, n) => (
                  <li key={`${ing.name}-${n}`} className="flex gap-1.5">
                    <span className="shrink-0 tabular-nums text-ink-3">{n + 1}.</span>
                    <span>
                      {[ing.quantity, ing.unit].filter(Boolean).length > 0 && (
                        <b className="font-semibold">{[ing.quantity, ing.unit].filter(Boolean).join(' ')} </b>
                      )}
                      {ing.name}
                      {ing.description && <span className="text-ink-3"> — {ing.description}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            ) : <span className="italic text-ink-3">none</span>}
          </Row>

          <Row label={`Steps${steps.length ? ` (${steps.length})` : ''}`}>
            {steps.length ? (
              <ol className="space-y-1">
                {steps.map((s, n) => (
                  <li key={`${s.text}-${n}`} className="flex gap-1.5">
                    <span className="shrink-0 tabular-nums text-ink-3">{n + 1}.</span>
                    <span>
                      {s.text}
                      {s.timeEstimate && <span className="text-ink-3"> ({s.timeEstimate})</span>}
                    </span>
                  </li>
                ))}
              </ol>
            ) : <span className="italic text-ink-3">none</span>}
          </Row>

          {/* Computed from the references, so it says where it came from. */}
          <Row label="Nutrition">
            {nutrition && nutrition.confidence !== 'none' ? (
              <>
                <div className="tabular-nums">
                  {nutrition.total.kcal} kcal · P {nutrition.total.protein_g}g · C {nutrition.total.carbs_g}g
                  {' '}· F {nutrition.total.fat_g}g · Fb {nutrition.total.fibre_g}g
                  <span className="text-ink-3"> (whole meal)</span>
                </div>
                {nutrition.perServing && (
                  <div className="tabular-nums text-ink-2">
                    {nutrition.perServing.kcal} kcal per serving
                  </div>
                )}
                <div className="mt-0.5 text-[11px] leading-snug text-ink-3">
                  {CONFIDENCE_NOTE[nutrition.confidence]}
                </div>
                {nutrition.unresolved.length > 0 && (
                  <div className="text-[11px] leading-snug text-amber-deep">
                    Not counted: {nutrition.unresolved.map((u) => u.name).join(', ')}.
                  </div>
                )}
                {nutrition.resolved.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-ink-3">
                      What each ingredient matched
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {nutrition.resolved.map((r) => (
                        <li key={r.food_id} className="text-[11px] text-ink-3">
                          <span className="text-ink-2">{r.name}</span> → {r.matched}
                          {' '}<span className="uppercase">{r.source}</span> {r.score}% · {r.grams}g
                          {!r.exact && ' (approx)'}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            ) : <span className="italic text-ink-3">nothing to total yet</span>}
          </Row>
        </div>
      )}
    </div>
  );
}
