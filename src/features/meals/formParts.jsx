import { useState } from 'react';
import { Input, cx } from '../../components/ui.jsx';

/* ═══════════════════════════════════════════════════════
   EDIT-FORM BUILDING BLOCKS
   ═══════════════════════════════════════════════════════ */

/* oz and lb sit with g and kg: the four units the nutrition calculator can convert. */
export const UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'cup', 'cups', 'tbsp', 'tsp',
  'piece', 'pieces', 'clove', 'cloves', 'pinch', 'bunch', 'handful', 'pack', 'tin'];

export const CATEGORIES = ['Soup', 'Stew', 'Rice Dish', 'Swallow', 'Grill',
  'Snack', 'Salad', 'Drink', 'Porridge', 'Side'];

function Chevron({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round"
      className={cx('transition-transform', open && 'rotate-180')}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * A titled, collapsible block.
 *
 * The production form puts a bare "Show" on the right of a hairline. That
 * reads as static text and never says which state you are in, so this uses
 * a real button, a rotating chevron, a Show/Hide label, and a count of what
 * is inside — collapsed sections stay legible without opening them.
 */
export function Section({ title, count, defaultOpen = false, children, id }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="scroll-mt-32">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full cursor-pointer items-center gap-3 py-3 text-left"
      >
        <span className="text-[15px] font-semibold text-ink">{title}</span>
        {count !== undefined && (
          <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
            count ? 'bg-mint-light text-mint-deep' : 'bg-line-light text-ink-3')}>
            {count}
          </span>
        )}
        <span className="h-px flex-1 bg-line" />
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 transition group-hover:text-forest">
          {open ? 'Hide' : 'Show'}
          <Chevron open={open} />
        </span>
      </button>
      {open && <div className="animate-fade-in pb-6 pt-1">{children}</div>}
    </section>
  );
}

/**
 * Multi-select as removable chips.
 *
 * `capitalize` suits short lowercase vocabularies like meal types, but it
 * mangles proper names — "Ugu and Water Leaf Soup" becomes "Ugu And Water
 * Leaf Soup" — so callers with real titles turn it off.
 */
export function ChipSelect({ options, value, onChange, placeholder = 'Select…', capitalize = true }) {
  const [openList, setOpenList] = useState(false);
  const available = options.filter((o) => !value.includes(o));

  return (
    <div className="rounded-lg border border-line bg-surface px-2 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((v) => (
          <span key={v} className={cx('inline-flex items-center gap-1.5 rounded-md bg-line-light px-2 py-1 text-[12px] font-medium text-ink', capitalize && 'capitalize')}>
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))}
              className="cursor-pointer text-ink-3 transition hover:text-chili" aria-label={`Remove ${v}`}>
              ✕
            </button>
          </span>
        ))}
        {!value.length && <span className="px-1 text-[13px] text-ink-3">{placeholder}</span>}
        <button type="button" onClick={() => setOpenList((v) => !v)}
          className="ml-auto cursor-pointer px-1.5 text-ink-3 transition hover:text-forest">
          <Chevron open={openList} />
        </button>
      </div>

      {openList && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line-light pt-2">
          {available.length ? available.map((o) => (
            <button key={o} type="button"
              onClick={() => { onChange([...value, o]); }}
              className={cx('cursor-pointer rounded-md border border-line px-2 py-1 text-[12px] font-medium text-ink-2 transition hover:border-forest hover:text-forest', capitalize && 'capitalize')}>
              + {o}
            </button>
          )) : <span className="px-1 text-[12px] text-ink-3">Everything is selected</span>}
        </div>
      )}
    </div>
  );
}

export function RowButtons({ onDelete, onAdd, disableDelete }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={onDelete} disabled={disableDelete} title="Remove"
        className="grid size-7 cursor-pointer place-items-center rounded-md text-chili transition hover:bg-chili-light disabled:cursor-not-allowed disabled:opacity-30">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
        </svg>
      </button>
      <button type="button" onClick={onAdd} title="Add below"
        className="grid size-7 cursor-pointer place-items-center rounded-md text-mint transition hover:bg-mint-light">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </button>
    </div>
  );
}

/** A simple repeatable list of single-line values. */
export function StringRows({ items, onChange, placeholder, emptyLabel }) {
  const setAt = (i, v) => onChange(items.map((x, n) => (n === i ? v : x)));
  const addAt = (i) => onChange([...items.slice(0, i + 1), '', ...items.slice(i + 1)]);
  const removeAt = (i) => onChange(items.filter((_, n) => n !== i));

  if (!items.length) {
    return (
      <button type="button" onClick={() => onChange([''])}
        className="w-full cursor-pointer rounded-xl border border-dashed border-line py-4 text-[13px] text-ink-3 transition hover:border-mint hover:text-forest">
        + {emptyLabel}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={item} placeholder={placeholder} onChange={(e) => setAt(i, e.target.value)} />
          <RowButtons onDelete={() => removeAt(i)} onAdd={() => addAt(i)} disableDelete={items.length === 1 && !item} />
        </div>
      ))}
    </div>
  );
}
