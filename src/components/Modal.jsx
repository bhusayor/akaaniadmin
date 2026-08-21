import { useEffect } from 'react';
import { IconClose } from './icons.jsx';
import { cx } from './ui.jsx';

const WIDTHS = { sm: 'max-w-[440px]', md: 'max-w-[560px]', lg: 'max-w-[900px]' };

export default function Modal({ open, onClose, title, subtitle, width = 'sm', children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/45 p-5 max-md:items-end max-md:p-0"
      /* Close only on the backdrop itself. Relying on stopPropagation in
         the panel is fragile: if a click re-renders the element that was
         clicked, React can compute the dispatch path from a node that is
         no longer mounted, the panel's handler never runs, and the modal
         closes out from under the interaction. */
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cx(
          'scroll-thin relative max-h-[90vh] w-full overflow-y-auto rounded-modal bg-surface p-7 shadow-tall',
          'animate-fade-up max-md:max-h-[92vh] max-md:rounded-b-none',
          WIDTHS[width],
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid size-7.5 place-items-center rounded-lg bg-canvas text-ink-3 transition hover:bg-line"
        >
          <IconClose />
        </button>
        {title && <div className="mb-1 pr-8 text-base font-semibold text-ink">{title}</div>}
        {subtitle && <div className="mb-5 text-[13px] text-ink-3">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

export function ModalActions({ children }) {
  return <div className="mt-5 flex flex-wrap justify-end gap-2">{children}</div>;
}
