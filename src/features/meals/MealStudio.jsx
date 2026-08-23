import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner, cx } from '../../components/ui.jsx';
import {
  IconSparkles, IconClose, IconRetry, IconWarning, IconInfo, IconCheck,
} from '../../components/icons.jsx';
import { sendTurn, applyTurn } from '../../lib/mealStudioChat.js';
import { emptyDraft, validateDraft, summarise } from '../../lib/mealStudio.js';
import { computeNutrition, CONFIDENCE_NOTE } from '../../lib/mealNutrition.js';
import DraftReview from './DraftReview.jsx';

/* ═══════════════════════════════════════════════════════
   MEAL STUDIO PANEL

   A conversation beside the Create Meal form, not instead of it. The draft
   it builds is applied in one explicit action and can be edited afterwards
   like anything else — nothing here saves.

   Macros are not asked of the model. Ingredients are matched against WAFCT
   and USDA and the totals computed, so the figures carry a provenance the
   panel can state rather than a number nobody can check.
   ═══════════════════════════════════════════════════════ */

const OPENERS = [
  'A vegan Nigerian brunch built around akara',
  'A high-protein jollof for four, under 40 minutes',
  'A low-carb swallow to serve with egusi',
];

function Bubble({ role, children, tone }) {
  const mine = role === 'user';
  return (
    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cx(
        'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
        mine ? 'bg-forest text-white'
          : tone === 'error' ? 'bg-chili-light text-chili-deep'
            : tone === 'notice' ? 'bg-surface-2 text-ink-3 italic'
              : 'bg-mint-light text-ink',
      )}>
        {children}
      </div>
    </div>
  );
}

function Figure({ label, value, unit }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.06em] text-ink-3">{label}</div>
      <div className="truncate text-[13px] font-semibold tabular-nums text-ink">
        {value === null || value === undefined ? '—' : value}
        {value !== null && value !== undefined && unit && (
          <span className="ml-0.5 text-[10px] font-medium text-ink-3">{unit}</span>
        )}
      </div>
    </div>
  );
}

export default function MealStudio({ open, onClose, onApply, formHasContent }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastFailed, setLastFailed] = useState(null);
  const log = useRef(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const validation = useMemo(() => validateDraft(draft), [draft]);

  /* Recomputed from the reference sets whenever the ingredients move. */
  const nutrition = useMemo(
    () => (draft?.ingredients?.length ? computeNutrition(draft.ingredients, draft.servings) : null),
    [draft?.ingredients, draft?.servings],
  );

  const say = (role, content, tone) =>
    setMessages((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, role, content, tone }]);

  const run = async (text) => {
    setBusy(true);
    setLastFailed(null);
    try {
      const turn = await sendTurn({
        message: text,
        currentMeal: draft,
        /* Draft snapshots are for reading, not for re-sending — the model
           already receives the current draft as `currentMeal`. */
        history: messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
      });
      say('assistant', turn.assistantMessage);
      if (turn.changed) {
        setDraft((d) => {
          const next = applyTurn(d ?? emptyDraft(), turn);
          /* Snapshotted at this turn, so scrolling back shows what the
             draft actually looked like then rather than what it is now. */
          setMessages((prev) => [...prev, {
            id: `draft-${Date.now()}-${prev.length}`,
            role: 'draft',
            draft: next,
          }]);
          return next;
        });
      }
    } catch (err) {
      /* The typed message and the draft both survive a failure — losing
         either would make a flaky connection cost real work. */
      say('assistant', err.message || 'That did not go through.', 'error');
      setLastFailed(text);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    say('user', text);
    setInput('');
    run(text);
  };

  const reset = () => {
    setMessages([]);
    setDraft(null);
    setInput('');
    setLastFailed(null);
  };

  if (!open) return null;

  return (
    /* Pinned to the viewport, not scrolled with the form. The form is long,
       and a panel that scrolled away would put the conversation out of reach
       exactly when you are checking a field against it.

       Fixed rather than sticky: sticky needs every ancestor between it and
       the scroll container to leave overflow alone, and the admin shell does
       not. Fixed does not care what the ancestors do. */
    <aside className="fixed bottom-0 right-0 top-[60px] z-40 flex w-[420px] flex-col border-l border-line bg-surface shadow-tall max-lg:z-50 max-lg:w-[min(420px,100vw)]">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-mint-light text-mint-deep">
          <IconSparkles size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-ink">Meal Studio</div>
          <div className="truncate text-[11px] text-ink-3">
            {draft ? summarise(draft) || 'Draft in progress' : 'Nothing drafted yet'}
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={reset} title="Start over"
            className="cursor-pointer rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-3 transition hover:bg-canvas hover:text-ink">
            Reset
          </button>
        )}
        <button onClick={onClose} title="Close"
          className="grid size-7 cursor-pointer place-items-center rounded-md text-ink-3 transition hover:bg-canvas hover:text-ink">
          <IconClose />
        </button>
      </div>

      {/* ── Conversation ── */}
      <div ref={log} className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3.5">
        {messages.length === 0 && (
          <div className="pt-2">
            <p className="text-[13px] leading-relaxed text-ink-2">
              Describe the meal you want and I will draft it — then tell me what to change.
              Nothing reaches the form until you apply it.
            </p>
            <div className="mt-3 space-y-1.5">
              {OPENERS.map((o) => (
                <button
                  key={o}
                  onClick={() => { say('user', o); run(o); }}
                  className="block w-full cursor-pointer rounded-lg border border-line bg-surface-2 px-3 py-2 text-left text-[12.5px] text-ink-2 transition hover:border-forest hover:text-forest"
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'draft' ? (
            <DraftReview
              key={m.id}
              draft={m.draft}
              nutrition={computeNutrition(m.draft.ingredients, m.draft.servings)}
              latest={!messages.slice(i + 1).some((x) => x.role === 'draft')}
            />
          ) : (
            <Bubble key={m.id} role={m.role} tone={m.tone}>{m.content}</Bubble>
          )
        ))}

        {busy && (
          <Bubble role="assistant" tone="notice">
            <span className="inline-flex items-center gap-2"><Spinner /> Thinking…</span>
          </Bubble>
        )}

        {lastFailed && !busy && (
          <div className="flex justify-start">
            <button
              onClick={() => run(lastFailed)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition hover:border-forest hover:text-forest"
            >
              <IconRetry /> Try that again
            </button>
          </div>
        )}
      </div>

      {/* ── Draft summary ── */}
      {draft && (
        <div className="shrink-0 border-t border-line bg-surface-2 px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="truncate text-[13px] font-semibold text-ink">
              {draft.name || <span className="italic text-ink-3">Unnamed</span>}
            </div>
            <span className={cx(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              validation.valid ? 'bg-mint-light text-mint-deep' : 'bg-amber-light text-amber-deep',
            )}>
              {validation.valid ? 'Ready to apply' : `${validation.blocking.length} to fix`}
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-4 gap-2">
            <Figure label="Serves" value={draft.servings} />
            <Figure label="Time" value={draft.prep} unit="min" />
            <Figure label="Items" value={draft.ingredients.length} />
            <Figure label="Steps" value={draft.instructions.length} />
          </div>

          {/* Computed, never asked for — see mealNutrition.js */}
          {nutrition && nutrition.confidence !== 'none' && (
            <div className="mt-2.5 rounded-lg border border-line-light bg-surface px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  Per serving
                </span>
                <span className={cx(
                  'rounded px-1.5 py-px text-[9.5px] font-semibold uppercase',
                  nutrition.confidence === 'measured' ? 'bg-mint-light text-mint-deep' : 'bg-amber-light text-amber-deep',
                )}>
                  {nutrition.confidence}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                <Figure label="kcal" value={nutrition.perServing?.kcal ?? nutrition.total.kcal} />
                <Figure label="Prot" value={nutrition.perServing?.protein_g ?? nutrition.total.protein_g} unit="g" />
                <Figure label="Carb" value={nutrition.perServing?.carbs_g ?? nutrition.total.carbs_g} unit="g" />
                <Figure label="Fat" value={nutrition.perServing?.fat_g ?? nutrition.total.fat_g} unit="g" />
                <Figure label="Fibre" value={nutrition.perServing?.fibre_g ?? nutrition.total.fibre_g} unit="g" />
              </div>
              <div className="mt-1.5 text-[10.5px] leading-snug text-ink-3">
                {CONFIDENCE_NOTE[nutrition.confidence]}
                {nutrition.unresolved.length > 0 && (
                  <> Not counted: {nutrition.unresolved.map((u) => u.name).join(', ')}.</>
                )}
              </div>
            </div>
          )}

          {validation.blocking.length > 0 && (
            <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-amber-deep">
              <span className="mt-px shrink-0"><IconWarning /></span>
              <span>Still needed: {validation.blocking.join(', ')}.</span>
            </div>
          )}
          {validation.blocking.length === 0 && validation.warnings.length > 0 && (
            <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-ink-3">
              <span className="mt-px shrink-0"><IconInfo /></span>
              <span>{validation.warnings.join(' · ')}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Composer and apply ── */}
      <form onSubmit={submit} className="shrink-0 border-t border-line px-4 py-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
          rows={2}
          disabled={busy}
          placeholder={draft ? 'What should change?' : 'Describe the meal…'}
          className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition placeholder:text-ink-3 focus:border-mint focus:ring-3 focus:ring-mint/8 disabled:opacity-60"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button type="submit" variant="ghost" disabled={!input.trim() || busy}>Send</Button>
          <Button
            type="button"
            className="ml-auto"
            disabled={!validation.valid || busy}
            onClick={() => onApply(draft, nutrition)}
            title={validation.valid ? undefined : `Still needed: ${validation.blocking.join(', ')}`}
          >
            <IconCheck /> Apply to form
          </Button>
        </div>
        <div className="mt-1.5 text-[10.5px] text-ink-3">
          {formHasContent
            ? 'The form already has content — you will be asked before anything is replaced.'
            : 'Applying fills the form. Nothing is saved until you submit it yourself.'}
        </div>
      </form>
    </aside>
  );
}
