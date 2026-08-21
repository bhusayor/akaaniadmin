import { useEffect, useState } from 'react';
import Modal, { ModalActions } from '../../components/Modal.jsx';
import { Field, Input, Select, ModalButton, cx } from '../../components/ui.jsx';
import { TAG_CATEGORIES, validateTag } from '../../lib/mealTags.js';

const blank = () => ({ name: '', category: '', description: '' });

export default function TagFormModal({ open, tag, allTags, onClose, onSave }) {
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors([]); setNewCategory(''); setAddingCategory(false);
    setForm(tag ? { ...tag } : blank());
  }, [open, tag]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* Existing categories plus any already in use, so a category invented
     once keeps showing up. */
  const categories = [...new Set([
    ...TAG_CATEGORIES,
    ...allTags.map((t) => t.category).filter(Boolean),
    ...(form.category ? [form.category] : []),
  ])].sort((a, b) => a.localeCompare(b));

  const save = () => {
    const others = allTags.filter((t) => t.id !== tag?.id);
    const problems = validateTag(form, others);
    setErrors(problems);
    if (problems.length) return;
    onSave(form);
  };

  const commitCategory = () => {
    const value = newCategory.trim();
    if (!value) return;
    // Reuse existing casing rather than creating a near-duplicate.
    const existing = categories.find((c) => c.toLowerCase() === value.toLowerCase());
    set('category', existing ?? value);
    setNewCategory('');
    setAddingCategory(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tag ? 'Edit meal tag' : 'Add a meal tag'}
      subtitle={tag ? 'Renaming a tag updates every meal that carries it.' : 'Tags group meals for filtering and meal plans.'}
    >
      {errors.length > 0 && (
        <div className="mb-4 rounded-xl border border-chili/30 bg-chili-light px-4 py-3 text-[12.5px] text-chili-deep">
          <ul className="list-inside list-disc">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Field label="Name" required>
          <Input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Comfort Food" />
        </Field>

        <Field label="Category" required
          hint={addingCategory ? '' : 'pick one, or add a new category'}>
          {addingCategory ? (
            <div className="flex gap-2">
              <Input autoFocus value={newCategory} placeholder="New category name"
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitCategory(); }
                  if (e.key === 'Escape') { setAddingCategory(false); setNewCategory(''); }
                }} />
              <ModalButton variant="ghost" className="shrink-0 py-2" onClick={commitCategory}>Add</ModalButton>
            </div>
          ) : (
            <div className="flex gap-2">
              {/* A select, not free text. The production form is a plain
                  input, which is how "Special Occassion" got into the data. */}
              <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select a category…</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </Select>
              <button type="button" onClick={() => setAddingCategory(true)}
                className="shrink-0 cursor-pointer rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink-2 transition hover:border-forest hover:text-forest">
                New
              </button>
            </div>
          )}
        </Field>

        <Field label="Description" hint="shown to editors, not to users">
          <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)}
            placeholder="What belongs under this tag, and what does not"
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none transition placeholder:text-ink-3 focus:border-mint focus:ring-3 focus:ring-mint/8" />
        </Field>
      </div>

      <ModalActions>
        <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
        <ModalButton onClick={save}>{tag ? 'Save changes' : 'Add tag'}</ModalButton>
      </ModalActions>
    </Modal>
  );
}
