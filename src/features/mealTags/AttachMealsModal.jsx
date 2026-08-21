import { useEffect, useMemo, useState } from 'react';
import Modal, { ModalActions } from '../../components/Modal.jsx';
import { Input, ModalButton, cx } from '../../components/ui.jsx';
import { IconSearch, IconCheck } from '../../components/icons.jsx';

/**
 * Which meals carry this tag.
 *
 * One list, not two: the production modal shows the same selection as
 * chips inside the input *and* again underneath, which doubles the
 * reading without adding anything. Here the meals are a single checkable
 * list with the count in the footer.
 */
export default function AttachMealsModal({ open, tag, meals, onClose, onSave }) {
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open || !tag) return;
    setQuery('');
    setSelected(new Set(meals.filter((m) => m.tags.includes(tag.name)).map((m) => m.id)));
  }, [open, tag, meals]);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return meals
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [meals, query]);

  if (!tag) return null;

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const initial = new Set(meals.filter((m) => m.tags.includes(tag.name)).map((m) => m.id));
  const added = [...selected].filter((id) => !initial.has(id)).length;
  const removed = [...initial].filter((id) => !selected.has(id)).length;

  return (
    <Modal open={open} onClose={onClose} width="md"
      title="Meals with this tag"
      subtitle={`Tag: ${tag.name}`}>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 focus-within:border-mint">
        <span className="text-ink-3"><IconSearch /></span>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meals…"
          className="w-full border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
        />
        {selected.size > 0 && (
          <button onClick={() => setSelected(new Set())}
            className="shrink-0 cursor-pointer text-[11.5px] font-medium text-ink-3 transition hover:text-chili">
            Clear all
          </button>
        )}
      </div>

      <div className="scroll-thin mt-3 max-h-[340px] overflow-y-auto rounded-xl border border-line">
        {rows.length ? rows.map((m) => {
          const on = selected.has(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={cx('flex w-full cursor-pointer items-center gap-3 border-b border-line-light px-3.5 py-2.5 text-left transition last:border-0',
                on ? 'bg-mint-light/40' : 'hover:bg-surface-2')}
            >
              <span className={cx('grid size-4.5 shrink-0 place-items-center rounded border transition',
                on ? 'border-forest bg-forest text-white' : 'border-line bg-surface')}>
                {on && <IconCheck size={11} stroke={3} />}
              </span>
              <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-mint-light text-sm">
                {m.image ? <img src={m.image} alt="" className="size-full object-cover" /> : m.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{m.name}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {(m.types ?? [m.type]).join(', ')} · {m.tags.length} tag{m.tags.length === 1 ? '' : 's'}
                </span>
              </span>
            </button>
          );
        }) : (
          <div className="px-4 py-8 text-center text-[13px] text-ink-3">No meals match “{query}”.</div>
        )}
      </div>

      <div className="mt-3 text-[12px] text-ink-2">
        <strong className="font-semibold text-ink">{selected.size}</strong> of {meals.length} meals selected
        {(added || removed) ? (
          <span className="text-ink-3">
            {' · '}
            {added ? `${added} to add` : ''}{added && removed ? ', ' : ''}{removed ? `${removed} to remove` : ''}
          </span>
        ) : <span className="text-ink-3"> · no changes</span>}
      </div>

      <ModalActions>
        <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
        <ModalButton onClick={() => onSave([...selected])} disabled={!added && !removed}>
          Save
        </ModalButton>
      </ModalActions>
    </Modal>
  );
}
