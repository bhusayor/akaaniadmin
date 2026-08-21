import { useEffect, useState } from 'react';
import Modal, { ModalActions } from '../../components/Modal.jsx';
import { Field, Input, Select, ModalButton, cx } from '../../components/ui.jsx';
import { IconTrash, IconImage } from '../../components/icons.jsx';
import LuCard from './LuCard.jsx';
import {
  FACT_CATEGORIES, FACT_STATUSES, BODY_LIMIT, BODY_COMFORTABLE,
  validateFact, bodyLoad,
} from '../../lib/luFacts.js';

const EMOJI = ['💡', '🍋', '🧄', '🧅', '🍅', '🍓', '🍍', '🍊', '🥒', '🥬', '🍌', '🍠', '🎃', '🫚', '🦐', '🫗', '🌽', '🥜'];

const blank = () => ({
  title: '', body: '', emoji: '💡', image: null,
  category: 'Nutrition', status: 'draft', ingredient: '',
});

export default function FactFormModal({ open, fact, allFacts, onClose, onSave }) {
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!open) return;
    setErrors([]);
    setForm(fact ? { ...fact } : blank());
  }, [open, fact]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    const others = allFacts.filter((f) => f.id !== fact?.id);
    const problems = validateFact(form, others);
    setErrors(problems);
    if (problems.length) return;
    onSave(form);
  };

  const len = form.body.trim().length;
  const load = bodyLoad(form.body);
  const counterTone = len > BODY_LIMIT ? 'text-chili'
    : load > 1 ? 'text-amber-deep'
      : 'text-ink-3';

  const pickImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => set('image', e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="md"
      title={fact ? 'Edit fun meal fact' : 'Add a fun meal fact'}
      subtitle="Short, specific and true. Lu shows these beside the ingredient."
    >
      {errors.length > 0 && (
        <div className="mb-4 rounded-xl border border-chili/30 bg-chili-light px-4 py-3 text-[12.5px] text-chili-deep">
          <ul className="list-inside list-disc">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {/* The preview leads, because it is what the reader actually sees. */}
      <LuCard fact={form} className="mb-5" />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Title" required hint="the subject of the fact">
            <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Lemon" />
          </Field>
          <Field label="Ingredient" hint="optional link">
            <Input value={form.ingredient} onChange={(e) => set('ingredient', e.target.value)}
              placeholder="e.g. Lemon" />
          </Field>
        </div>

        <Field label="Fact" required>
          <textarea
            rows={4}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder="One specific, checkable claim. Avoid hedging."
            className={cx(
              'w-full resize-y rounded-lg border bg-surface px-3 py-2.5 text-[13px] text-ink outline-none transition',
              'placeholder:text-ink-3 focus:ring-3 focus:ring-mint/8',
              len > BODY_LIMIT ? 'border-chili focus:border-chili' : 'border-line focus:border-mint',
            )}
          />
          <div className="mt-1.5 flex items-center gap-2">
            {/* A bar, not just a number: it shows how close the card is to
                looking cramped, which a raw count does not. */}
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-light">
              <div
                className={cx('h-full rounded-full transition-all',
                  len > BODY_LIMIT ? 'bg-chili' : load > 1 ? 'bg-amber' : 'bg-mint')}
                style={{ width: `${Math.min(100, (len / BODY_LIMIT) * 100)}%` }}
              />
            </div>
            <span className={cx('shrink-0 text-[11px] tabular-nums', counterTone)}>
              {len}/{BODY_LIMIT}
              {len > BODY_LIMIT ? ' — too long' : load > 1 ? ' — getting long' : ''}
            </span>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Category">
            <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {FACT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Status" hint="only published facts are shown">
            <div className="flex gap-0.5 rounded-lg bg-canvas p-0.5">
              {FACT_STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => set('status', s)}
                  className={cx('flex-1 cursor-pointer rounded-md px-3 py-1.5 text-[12.5px] capitalize transition',
                    form.status === s ? 'bg-surface font-semibold text-ink shadow-soft' : 'font-medium text-ink-3 hover:text-ink')}>
                  {s}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Icon" hint="or upload an image below">
          <div className="flex flex-wrap gap-1.5">
            {EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => set('emoji', e)}
                className={cx('grid size-9 cursor-pointer place-items-center rounded-lg border text-lg transition',
                  form.emoji === e && !form.image
                    ? 'border-forest bg-mint-light'
                    : 'border-line hover:border-forest hover:bg-canvas')}>
                {e}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Image" hint="replaces the icon">
          {form.image ? (
            <div className="flex items-center gap-3">
              <img src={form.image} alt="" className="size-16 rounded-xl object-cover" />
              <button type="button" onClick={() => set('image', null)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition hover:border-chili hover:text-chili">
                <IconTrash size={13} /> Remove
              </button>
            </div>
          ) : (
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-[12.5px] text-ink-2 transition hover:border-forest hover:text-forest">
              <IconImage size={14} /> Choose image
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
          )}
        </Field>
      </div>

      <ModalActions>
        <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
        <ModalButton onClick={save}>{fact ? 'Save changes' : 'Add fact'}</ModalButton>
      </ModalActions>
    </Modal>
  );
}
