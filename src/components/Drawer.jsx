import { useEffect } from 'react';
import { IconClose } from './icons.jsx';
import { cx } from './ui.jsx';

/**
 * Right-hand slide-over. Used where a form is long enough to need room
 * but the list behind it is worth keeping in view.
 */
export default function Drawer({ open, onClose, title, subtitle, width = 'w-[560px]', footer, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        className={cx('fixed inset-0 z-100 transition-colors duration-300',
          open ? 'bg-black/35' : 'pointer-events-none bg-transparent')}
      />
      <aside
        className={cx(
          'fixed inset-y-0 right-0 z-110 flex h-screen flex-col bg-surface shadow-tall',
          'transition-transform duration-300 max-md:w-full', width,
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line-light px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
          </div>
          <button onClick={onClose}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-line text-ink-3 transition hover:bg-canvas hover:text-ink">
            <IconClose />
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-line-light px-6 py-4">{footer}</div>
        )}
      </aside>
    </>
  );
}
