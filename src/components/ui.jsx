/* ═══════════════════════════════════════════════════════
   UI PRIMITIVES

   The shared components the vanilla build expressed as .btn-primary,
   .fi, .card and friends in css/shared.css — now Tailwind, in one place
   so every page stays visually consistent.
   ═══════════════════════════════════════════════════════ */

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ── Buttons ── */

const BTN_BASE =
  'inline-flex items-center gap-1.5 rounded-lg text-xs font-medium whitespace-nowrap ' +
  'transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

export function Button({ variant = 'primary', className, ...props }) {
  const styles = {
    primary: 'bg-forest text-white px-3.5 py-2 hover:opacity-85',
    ghost: 'border border-line text-ink-2 px-3.5 py-2 hover:bg-canvas hover:border-forest hover:text-forest',
    danger: 'bg-chili text-white px-3.5 py-2 hover:opacity-85',
    rust: 'bg-rust text-white px-3.5 py-2 hover:opacity-85 font-semibold',
  }[variant];
  return <button className={cx(BTN_BASE, styles, className)} {...props} />;
}

/** Modal-footer sized buttons — slightly larger than toolbar ones. */
export function ModalButton({ variant = 'primary', className, ...props }) {
  const styles = {
    primary: 'bg-forest text-white px-5 py-2.5 text-[13px] font-semibold hover:opacity-85',
    ghost: 'border border-line text-ink-2 px-4 py-2.5 text-[13px] hover:bg-canvas',
    danger: 'bg-chili text-white px-5 py-2.5 text-[13px] font-semibold hover:opacity-85',
  }[variant];
  return <button className={cx(BTN_BASE, 'rounded-[9px]', styles, className)} {...props} />;
}

export function IconButton({ className, title, ...props }) {
  return (
    <button
      title={title}
      className={cx(
        'grid place-items-center rounded-[7px] border border-line bg-surface text-ink-3',
        'transition hover:bg-canvas hover:border-forest hover:text-forest cursor-pointer',
        'size-7',
        className,
      )}
      {...props}
    />
  );
}

/* ── Form fields ── */

/**
 * `hint` is a neutral aside beside the label. `error` is a failure, so it
 * sits under the field in full size and in the warning colour — a
 * validation message set in 10px grey next to the label reads as a tip and
 * gets missed.
 */
export function Field({ label, required, children, className, hint, error }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-xs font-medium text-ink-2">
          {label}
          {required && <span className="text-chili"> *</span>}
          {hint && !error && <span className="ml-1 text-[10px] font-normal text-ink-3">{hint}</span>}
        </label>
      )}
      {children}
      {error && (
        <span role="alert" className="text-[11.5px] font-medium text-chili">{error}</span>
      )}
    </div>
  );
}

const INPUT_BASE =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none ' +
  'transition placeholder:text-ink-3 focus:border-mint focus:ring-3 focus:ring-mint/8';

export function Input({ className, ...props }) {
  return <input className={cx(INPUT_BASE, className)} {...props} />;
}

const CARET =
  "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")";

export function Select({ className, ...props }) {
  return (
    <select
      className={cx(INPUT_BASE, 'cursor-pointer appearance-none bg-no-repeat pr-8', className)}
      style={{ backgroundImage: CARET, backgroundPosition: 'right 12px center' }}
      {...props}
    />
  );
}

/** Compact toolbar filter select. */
export function FilterSelect({ className, ...props }) {
  return (
    <select
      className={cx(
        'h-[34px] cursor-pointer appearance-none rounded-lg border border-line bg-surface',
        'pl-2.5 pr-7 text-[12.5px] text-ink outline-none transition focus:border-mint',
        className,
      )}
      style={{ backgroundImage: CARET, backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat' }}
      {...props}
    />
  );
}

/* ── Surfaces ── */

export function Card({ className, children }) {
  return (
    <div className={cx('overflow-hidden rounded-card border border-line bg-surface shadow-soft', className)}>
      {children}
    </div>
  );
}

export function Badge({ tone = 'neutral', className, children, ...props }) {
  const tones = {
    neutral: 'bg-line-light text-ink-3',
    mint: 'bg-mint-light text-mint-deep',
    amber: 'bg-amber-light text-amber-deep',
    chili: 'bg-chili-light text-chili-deep',
    ocean: 'bg-ocean-light text-ocean-deep',
    grape: 'bg-grape-light text-grape',
  }[tone];
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap', tones, className)}
      {...props}
    >
      {children}
    </span>
  );
}

/** Status pill with the leading dot, as in the vanilla .spill. */
export function StatusPill({ status }) {
  const map = {
    active: ['bg-mint-light text-mint-deep', 'Active'],
    inactive: ['bg-chili-light text-chili-deep', 'Inactive'],
    pending: ['bg-amber-light text-amber-deep', 'Pending'],
    new: ['bg-ocean-light text-ocean-deep', 'New'],
  };
  const [tone, label] = map[status] || map.new;
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', tone)}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function CountBadge({ children }) {
  return (
    <span className="rounded-full bg-line-light px-2.5 py-0.5 text-[11px] font-semibold text-ink-3">
      {children}
    </span>
  );
}

export function Spinner({ className }) {
  return (
    <span
      className={cx('inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-black/12 border-t-mint', className)}
    />
  );
}

export function EmptyState({ icon = '🌿', title, sub }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mb-2.5 text-[42px] opacity-35">{icon}</div>
      <div className="text-sm font-semibold text-ink-2">{title}</div>
      {sub && <div className="mt-1 text-[12.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

/* ── Page chrome ── */

export function PageToolbar({ left, right }) {
  return (
    <div className="sticky top-[60px] z-15 flex flex-wrap items-center gap-3 border-b border-line bg-surface px-7 pt-4 pb-3 max-lg:px-4 max-md:static">
      <div className="flex flex-1 flex-wrap items-center gap-2.5">{left}</div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

export const Th = ({ className, children }) => (
  <th className={cx('bg-surface-2 border-b border-line px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-3 whitespace-nowrap', className)}>
    {children}
  </th>
);

/**
 * A cell that becomes a labelled row on a phone.
 *
 * An admin table is unreadable at 390px: the first column fits and every
 * other one, including the actions, is off to the right behind a sideways
 * scroll nobody finds. Below `md` the table stacks — each row becomes a
 * card and each cell a `label: value` line — which is why `label` matters.
 *
 * Pass `label` on every cell that carries data. Omit it on a checkbox or an
 * action column, where a heading beside the control would be noise.
 */
export const Td = ({ className, label, children, ...props }) => (
  <td
    data-label={label}
    className={cx(
      'border-b border-line-light px-4 py-3 text-[13px] align-middle',
      'max-md:border-0 max-md:px-0 max-md:py-1',
      // With a label the cell is a `label: value` line; without one it is a
      // block, so a name and its blurb stack instead of sitting side by side.
      label
        ? 'max-md:flex max-md:items-baseline max-md:gap-3 max-md:before:w-24 max-md:before:shrink-0 max-md:before:text-[11px] max-md:before:leading-5 max-md:before:text-ink-3 max-md:before:content-[attr(data-label)]'
        : 'max-md:block',
      className,
    )}
    {...props}
  >
    {/* On a phone the cell is a flex row holding the label and the value, so
        a cell with two children would sit them side by side. The wrapper
        keeps them together as one value; `md:contents` dissolves it again on
        a desktop, leaving the table layout exactly as it was. */}
    {label ? <div className="min-w-0 flex-1 md:contents">{children}</div> : children}
  </td>
);

/**
 * A table that turns into a list of cards on a phone.
 *
 * The markup stays a real table — semantics, keyboard order and the desktop
 * layout are unchanged — and only the display switches below `md`.
 */
export const DataTable = ({ className, children, ...props }) => (
  <table
    className={cx(
      'w-full border-collapse',
      'max-md:block',
      '[&_thead]:max-md:hidden',
      '[&_tbody]:max-md:block',
      '[&_tbody_tr]:max-md:mb-2 [&_tbody_tr]:max-md:block [&_tbody_tr]:max-md:rounded-xl',
      '[&_tbody_tr]:max-md:border [&_tbody_tr]:max-md:border-line [&_tbody_tr]:max-md:bg-surface [&_tbody_tr]:max-md:p-3.5',
      className,
    )}
    {...props}
  >
    {children}
  </table>
);

export { cx };
