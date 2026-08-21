import { cx } from '../../components/ui.jsx';

/* ═══════════════════════════════════════════════════════
   SETTINGS BUILDING BLOCKS

   Card with its own header, form rows on a grid, toggle rows and a
   danger zone — the shapes the settings layout is built from.
   ═══════════════════════════════════════════════════════ */

/** The heading above each panel. */
export function SectionHead({ title, description }) {
  return (
    <div className="mb-6 border-b border-line pb-4">
      <h2 className="text-[18px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-ink-3">{description}</p>}
    </div>
  );
}

export function SettingsCard({ title, description, action, children, className }) {
  return (
    <div className="mb-4 overflow-hidden rounded-card border border-line bg-surface shadow-soft">
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-line-light px-5 pb-3.5 pt-4">
          <div className="min-w-0">
            {title && <div className="text-sm font-semibold text-ink">{title}</div>}
            {description && <div className="mt-0.5 text-[12px] text-ink-3">{description}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={cx('p-5', className)}>{children}</div>
    </div>
  );
}

/** 2-up by default; `cols` takes 1 or 3. Collapses on small screens. */
export function FormRow({ cols = 2, children, className }) {
  const grid = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }[cols];
  return (
    <div className={cx('mb-4 grid gap-4 max-sm:grid-cols-1', grid, className)}>{children}</div>
  );
}

export function Hint({ children }) {
  return <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{children}</p>;
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative ml-4 h-5.5 w-10 shrink-0 rounded-full transition',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        checked ? 'bg-forest' : 'bg-gray-300')}
    >
      <span className={cx('absolute bottom-0.5 size-4 rounded-full bg-white shadow transition-all',
        checked ? 'left-[21px]' : 'left-0.5')} />
    </button>
  );
}

export function ToggleRow({ label, sub, checked, onChange, disabled, children }) {
  return (
    <div className="flex items-center justify-between border-b border-line-light py-3.5 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        {sub && <div className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{sub}</div>}
      </div>
      {children ?? <Toggle checked={checked} onChange={onChange} disabled={disabled} />}
    </div>
  );
}

/** Cancel + Save, on a rule, at the foot of a card. */
export function SaveRow({ onCancel, onSave, saveLabel = 'Save Changes', dirty }) {
  return (
    <div className="mt-1 flex items-center justify-end gap-2.5 border-t border-line-light pt-4">
      {dirty && (
        <span className="mr-auto inline-flex items-center gap-1.5 text-[12px] text-ink-3">
          <span className="size-[7px] rounded-full bg-chili" />
          Unsaved changes
        </span>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel}
          className="cursor-pointer rounded-[9px] border border-line px-4 py-2.5 text-[13px] font-medium text-ink-2 transition hover:bg-canvas">
          Cancel
        </button>
      )}
      <button type="button" onClick={onSave}
        className="cursor-pointer rounded-[9px] bg-forest px-5 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-85">
        {saveLabel}
      </button>
    </div>
  );
}

export function DangerZone({ children }) {
  return (
    <div className="mb-4 overflow-hidden rounded-card border border-red-300">
      <div className="border-b border-red-300 bg-[#FEF2F2] px-5 py-3.5">
        <div className="text-sm font-semibold text-chili">Danger Zone</div>
        <div className="mt-0.5 text-[12px] text-chili-deep">
          These actions are irreversible. Please proceed with caution.
        </div>
      </div>
      {children}
    </div>
  );
}

export function DangerAction({ label, sub, cta, onClick, first }) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-4 bg-surface px-5 py-4',
      !first && 'border-t border-red-300')}>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-[12px] text-ink-3">{sub}</div>
      </div>
      <button type="button" onClick={onClick}
        className="cursor-pointer rounded-[9px] bg-chili px-4 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-85">
        {cta}
      </button>
    </div>
  );
}

/** Three bars — length alone never reaches the top band. */
export function PasswordStrength({ score, label }) {
  const tone = ['bg-line-light', 'bg-chili', 'bg-amber', 'bg-mint'][score];
  const text = ['text-ink-3', 'text-chili', 'text-amber-deep', 'text-mint-deep'][score];
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex gap-[3px]">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cx('h-1 w-8 rounded-sm transition-colors',
            score >= i ? tone : 'bg-line-light')} />
        ))}
      </div>
      <span className={cx('text-[11px] font-medium', text)}>{label}</span>
    </div>
  );
}
