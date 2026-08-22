import { useState } from 'react';
import { ALLERGENS } from '../../lib/allergens.js';
import { cx } from '../../components/ui.jsx';

/* ═══════════════════════════════════════════════════════
   ALLERGEN PICKER

   A reference match fills these in, but most ingredients have no match —
   and plenty that do carry allergens the reference cannot know about,
   like a spice blend milled alongside peanuts.

   Free text is allowed alongside the standard list, because the list is
   the regulated set and a kitchen deals in more than that.
   ═══════════════════════════════════════════════════════ */

export default function AllergenPicker({ value = [], onChange }) {
  const [custom, setCustom] = useState('');

  const toggle = (tag) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);

  const addCustom = () => {
    const tag = custom.trim();
    if (!tag) return;
    /* Case-insensitive, so "Mustard" and "mustard" do not both end up on
       the same ingredient. */
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setCustom('');
  };

  const extra = value.filter((t) => !ALLERGENS.includes(t));

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap gap-1.5">
        {ALLERGENS.map((tag) => {
          const on = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              aria-pressed={on}
              className={cx(
                'cursor-pointer rounded-md border px-2 py-1 text-[11.5px] font-medium transition',
                on
                  ? 'border-amber bg-amber-light text-amber-deep'
                  : 'border-line text-ink-3 hover:border-ink-3 hover:text-ink-2',
              )}
            >
              {tag}
            </button>
          );
        })}

        {extra.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            aria-pressed="true"
            title={`Remove "${tag}"`}
            className="cursor-pointer rounded-md border border-amber bg-amber-light px-2 py-1 text-[11.5px] font-medium text-amber-deep transition hover:border-chili hover:text-chili"
          >
            {tag} ✕
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-1.5">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder="Add another — mustard, sulphites…"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none transition placeholder:text-ink-3 focus:border-mint"
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

      <div className="mt-2 text-[11px] text-ink-3">
        {value.length
          ? 'Listed on the ingredient and on every meal that uses it.'
          : 'None recorded — that is not the same as “contains none”.'}
      </div>
    </div>
  );
}
