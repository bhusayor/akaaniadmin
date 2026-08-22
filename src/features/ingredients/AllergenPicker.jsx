import { useEffect, useRef, useState } from 'react';
import { ALLERGENS } from '../../lib/allergens.js';
import { cx } from '../../components/ui.jsx';
import { IconChevronDown, IconClose } from '../../components/icons.jsx';

/* ═══════════════════════════════════════════════════════
   ALLERGEN PICKER

   A multi-select that collapses to one control, so it sits on the same
   row as Unit instead of pushing the form a block taller.

   A reference match fills these in, but most ingredients have no match —
   and plenty that do carry allergens the reference cannot know about,
   like a spice blend milled alongside peanuts. Free text is accepted next
   to the regulated list for exactly that.
   ═══════════════════════════════════════════════════════ */

export default function AllergenPicker({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const box = useRef(null);

  /* Close on an outside click or Escape — a panel that only closes by
     re-clicking the trigger traps people who click away from it. */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (tag) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);

  const addCustom = () => {
    const tag = custom.trim();
    if (!tag) return;
    /* Case-insensitive, so "Mustard" and "mustard" do not both land. */
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setCustom('');
  };

  const options = [...ALLERGENS, ...value.filter((t) => !ALLERGENS.includes(t))];

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cx(
          'flex w-full cursor-pointer items-center gap-2 rounded-lg border bg-surface px-3 py-2.5 text-left transition',
          open ? 'border-mint ring-3 ring-mint/8' : 'border-line hover:border-ink-3',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {value.length === 0 ? (
            <span className="text-[13px] text-ink-3">None recorded</span>
          ) : (
            value.map((t) => (
              <span key={t} className="rounded bg-amber-light px-1.5 py-px text-[11px] font-semibold whitespace-nowrap text-amber-deep">
                {t}
              </span>
            ))
          )}
        </span>
        {value.length > 0 && (
          <span
            role="button"
            tabIndex={-1}
            title="Clear all"
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
            className="shrink-0 text-ink-3 transition hover:text-chili"
          >
            <IconClose />
          </span>
        )}
        <span className={cx('shrink-0 text-ink-3 transition', open && 'rotate-180')}>
          <IconChevronDown />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1.5 rounded-lg border border-line bg-surface p-2 shadow-tall"
        >
          <div className="max-h-52 overflow-y-auto">
            {options.map((tag) => {
              const on = value.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(tag)}
                  className={cx(
                    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition',
                    on ? 'bg-amber-light text-amber-deep' : 'text-ink-2 hover:bg-canvas',
                  )}
                >
                  <span className={cx(
                    'grid size-3.5 shrink-0 place-items-center rounded-[3px] border text-[9px] font-bold',
                    on ? 'border-amber bg-amber text-white' : 'border-line',
                  )}>
                    {on ? '✓' : ''}
                  </span>
                  {tag}
                  {!ALLERGENS.includes(tag) && (
                    <span className="ml-auto text-[10px] text-ink-3">added</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex gap-1.5 border-t border-line-light pt-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
              placeholder="Add another…"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-[12px] text-ink outline-none transition placeholder:text-ink-3 focus:border-mint"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!custom.trim()}
              className="shrink-0 cursor-pointer rounded-md border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition hover:border-forest hover:text-forest disabled:cursor-default disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
