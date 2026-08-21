import { cx } from '../../components/ui.jsx';

/**
 * How the fact appears in the app.
 *
 * Shown live while editing, because the body has a real length budget and
 * a character counter alone does not tell you when the card starts to
 * look cramped.
 */
export default function LuCard({ fact, className }) {
  const title = fact.title?.trim() || 'Untitled';
  const body = fact.body?.trim();

  return (
    <div className={cx('rounded-2xl border border-mint/25 bg-mint-light px-4 py-3.5', className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-lg shadow-soft">
          {fact.image
            ? <img src={fact.image} alt="" className="size-full rounded-xl object-cover" />
            : fact.emoji || '💡'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-semibold text-mint-deep">Lu</span>
            <span className="text-[11px] text-ink-3">on {title}</span>
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
            {body || <span className="italic text-ink-3">The fact will appear here.</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
