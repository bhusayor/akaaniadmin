import { useState } from 'react';
import Modal, { ModalActions } from '../../components/Modal.jsx';
import { Field, ModalButton, Spinner, cx } from '../../components/ui.jsx';
import { generate, config } from '../../lib/blogGenerate.js';
import { readingTime } from '../../lib/markdown.js';

const IDEAS = [
  'why swallow food is not automatically fattening',
  'a beginner guide to cooking with palm oil',
  'how to read the nutrition on a Nigerian food label',
  'meal prepping jollof for a week without it drying out',
];

/**
 * Describe the post, get a draft.
 *
 * The draft never publishes itself — it opens in the editor as an
 * unsaved draft so a person edits and publishes it deliberately.
 */
export default function AiGenerateModal({ open, onClose, onDraft }) {
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState({ status: 'idle' });

  const close = () => {
    if (state.status === 'working') return;
    setPrompt(''); setState({ status: 'idle' }); onClose();
  };

  const run = () => {
    setState({ status: 'working' });
    generate(prompt, (err, draft) => {
      if (err) { setState({ status: 'error', message: err.message }); return; }
      setState({ status: 'done', draft });
    });
  };

  return (
    <Modal open={open} onClose={close} width="md"
      title="Generate a post with AI"
      subtitle="Describe what the post should cover. You get an editable draft — nothing is published.">
      {state.status === 'done' ? (
        <>
          <div className="rounded-xl border border-amber bg-amber-light px-4 py-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-deep">
              AI draft · review before publishing
            </div>
            <div className="mt-1 text-[15px] font-semibold text-ink">{state.draft.title}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{state.draft.excerpt}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-2">
              <span>{readingTime(state.draft.body)} min read</span>
              <span className="text-ink-3">·</span>
              {state.draft.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/70 px-2 py-0.5 font-medium">{t}</span>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
            It opens in the editor as a draft. Add a featured image and check the facts before publishing.
          </p>
          <ModalActions>
            <ModalButton variant="ghost" onClick={() => setState({ status: 'idle' })}>Try again</ModalButton>
            <ModalButton onClick={() => { onDraft(state.draft); close(); }}>Open in editor</ModalButton>
          </ModalActions>
        </>
      ) : (
        <>
          <Field label="What should the post be about?" required>
            <textarea
              rows={4}
              autoFocus
              value={prompt}
              disabled={state.status === 'working'}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. why swallow food is not automatically fattening, aimed at people new to tracking"
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none transition placeholder:text-ink-3 focus:border-mint focus:ring-3 focus:ring-mint/8 disabled:opacity-60"
            />
          </Field>

          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-medium text-ink-3">Or start from one of these</div>
            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button key={idea} type="button" onClick={() => setPrompt(idea)}
                  disabled={state.status === 'working'}
                  className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-left text-[11.5px] text-ink-2 transition hover:border-mint hover:text-forest disabled:opacity-50">
                  {idea}
                </button>
              ))}
            </div>
          </div>

          {state.status === 'error' && (
            <div className="mt-3 rounded-lg bg-chili-light px-3 py-2.5 text-[12.5px] text-chili-deep">
              {state.message}
            </div>
          )}

          <div className="mt-3 text-[11.5px] text-ink-3">
            Provider: <strong className="font-semibold text-ink-2">{config.provider}</strong>
            {config.provider === 'mock' && ' — deterministic placeholder text, no model is called'}
          </div>

          <ModalActions>
            <ModalButton variant="ghost" onClick={close} disabled={state.status === 'working'}>Cancel</ModalButton>
            <ModalButton onClick={run} disabled={prompt.trim().length < 10 || state.status === 'working'}>
              {state.status === 'working'
                ? <><Spinner className="border-white/30 border-t-white" /> Writing…</>
                : 'Generate draft'}
            </ModalButton>
          </ModalActions>
        </>
      )}
    </Modal>
  );
}
