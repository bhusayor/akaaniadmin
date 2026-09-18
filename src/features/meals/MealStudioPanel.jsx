import { useRef, useState } from 'react';
import { Badge, Button, Spinner, cx } from '../../components/ui.jsx';
import { IconInfo, IconSparkles, IconWarning } from '../../components/icons.jsx';
import { isExpiredSession, isForbidden, mealStudioChat } from '../../lib/api.js';
import {
  changedFields, FIELD_LABELS, fromStudioMeal, MEAL_SCHEMA_VERSION, toStudioMeal,
} from '../../lib/mealStudio.js';

const EXAMPLES = [
  'Draft a Nigerian breakfast built around oats and groundnut',
  'Add cooking steps for this meal',
  'Make it lower carb and adjust the macros',
];

/**
 * Shows an API failure in full: the server's own message, plus what that
 * status actually means for the draft. Nothing is swallowed or softened —
 * the endpoint is live but the company OpenAI account has no credit, so a
 * 502 is the expected answer today and has to read as one.
 */
function StudioError({ error, onRetry }) {
  const status = error.status;
  const detail = error.data || {};

  let meaning = null;
  if (isExpiredSession(error)) {
    meaning = 'Your session has expired. Sign in again — the draft below is untouched.';
  } else if (isForbidden(error)) {
    meaning = 'Meal Studio is staff and admin only (isAdminOrStaff). A plain user account cannot draft meals.';
  } else if (status === 409) {
    meaning = `This admin drafts against "${detail.received || MEAL_SCHEMA_VERSION}" but the server drafts against "${detail.expected || 'a different version'}". Reload the page; if it persists, this panel needs updating to the server's meal shape.`;
  } else if (status === 502) {
    meaning = 'The platform API reached the assistant and got nothing usable back. While the company OpenAI account is without credit, this is the expected answer — the endpoint itself is working.';
  } else if (status === 0) {
    meaning = 'The request never reached the platform API.';
  }

  return (
    <div role="alert" className="mt-3 rounded-xl border border-chili/40 bg-chili-light p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-chili-deep"><IconWarning /></span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-chili-deep">
            Draft failed{status ? ` — HTTP ${status}` : ''}{error.name && error.name !== 'ApiError' ? ` · ${error.name}` : ''}
          </div>
          {/* The server's exact words, never paraphrased. */}
          <p className="mt-1 font-mono text-[11.5px] leading-relaxed break-words text-chili-deep">{error.message}</p>
          {meaning && <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">{meaning}</p>}
          <p className="mt-1.5 text-[11.5px] text-ink-3">
            Your draft has not been changed.
            {detail.conversationId && <> Conversation <code className="font-mono">{detail.conversationId}</code>.</>}
          </p>
          {detail.errors?.length > 0 && (
            <ul className="mt-1.5 list-inside list-disc text-[11.5px] text-ink-2">
              {detail.errors.map((e) => <li key={String(e)}>{String(e)}</li>)}
            </ul>
          )}
          {onRetry && (
            <Button variant="ghost" className="mt-2.5" onClick={onRetry}>Try again</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * AI meal drafting against POST /v1/meal-studio/chat.
 *
 * The form stays the source of truth: every turn sends the draft currently
 * in the form, and what comes back is only applied when someone clicks
 * Apply. Nothing here talks to a model directly.
 */
export default function MealStudioPanel({ form, onApply }) {
  const [turns, setTurns] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null);
  const conversationId = useRef(null);
  const lastMessage = useRef('');

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    lastMessage.current = trimmed;
    setTurns((t) => [...t, { role: 'user', text: trimmed }]);
    setMessage('');
    setBusy(true);
    setError(null);
    try {
      const data = await mealStudioChat({
        message: trimmed,
        currentMeal: toStudioMeal(form),
        conversationId: conversationId.current,
        mealSchemaVersion: MEAL_SCHEMA_VERSION,
      });
      conversationId.current = data.conversationId || conversationId.current;
      setTurns((t) => [...t, { role: 'assistant', text: data.assistantMessage || '(no message returned)' }]);
      setDraft({ meal: data.meal || {}, validation: data.validation || {} });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const patch = draft ? fromStudioMeal(draft.meal, form) : null;
  const changed = patch ? changedFields(patch, form) : [];

  const apply = () => {
    onApply(patch, changed);
    setDraft(null);
  };

  return (
    <div className="mb-4 rounded-xl border border-grape/30 bg-grape-light/40 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* No title: the collapsible Section around this panel already carries it. */}
        <div className="flex items-center gap-2">
          <span className="text-grape"><IconSparkles /></span>
          <Badge tone="grape">POST /v1/meal-studio/chat</Badge>
        </div>
        {conversationId.current && (
          <span className="font-mono text-[10.5px] text-ink-3">conv {conversationId.current.slice(0, 8)}…</span>
        )}
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
        Drafts this meal through the platform API, which holds the model credentials — the browser
        never calls a model. Nothing is saved: a draft only reaches the form when you apply it.
      </p>

      {turns.length > 0 && (
        <div className="scroll-thin mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
          {turns.map((t, i) => (
            <div key={i} className={cx('rounded-lg px-3 py-2 text-[12.5px] leading-relaxed',
              t.role === 'user' ? 'self-end bg-surface text-ink' : 'bg-surface-2 text-ink-2')}>
              {t.text}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 px-1 text-[11.5px] text-ink-3">
              <Spinner /> Drafting…
            </div>
          )}
        </div>
      )}

      {error && <StudioError error={error} onRetry={() => send(lastMessage.current)} />}

      {draft && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Returned draft</div>
          {changed.length ? (
            <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
              Would change: <b className="font-semibold">{changed.map((k) => FIELD_LABELS[k] || k).join(', ')}</b>.
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-ink-3">Nothing in the draft differs from the form.</p>
          )}

          {draft.validation.missingFields?.length > 0 && (
            <p className="mt-1.5 text-[11.5px] text-amber-deep">
              Still missing before this meal could be published: {draft.validation.missingFields.join(', ')}.
            </p>
          )}
          {draft.validation.warnings?.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[11.5px] text-ink-3">
              {draft.validation.warnings.map((w) => <li key={String(w)}>{String(w)}</li>)}
            </ul>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button onClick={apply} disabled={!changed.length}>Apply to form</Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
            <span className="flex items-center gap-1 text-[11px] text-ink-3">
              <IconInfo /> Applying fills the form only — saving the meal is still a separate step.
            </span>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(message); }}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(message); }
          }}
          rows={2}
          placeholder="Ask for a change, e.g. “add cooking steps and estimate the macros”"
          className="min-w-0 flex-1 resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] text-ink outline-none transition placeholder:text-ink-3 focus:border-mint focus:ring-3 focus:ring-mint/8"
        />
        <Button type="submit" disabled={busy || !message.trim()}>
          {busy ? <><Spinner /> Drafting…</> : 'Send'}
        </Button>
      </form>

      {!turns.length && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setMessage(ex)}
              className="cursor-pointer rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-2 transition hover:border-grape hover:text-grape">
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
