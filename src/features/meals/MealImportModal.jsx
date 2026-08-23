import { useRef, useState } from 'react';
import Modal, { ModalActions } from '../../components/Modal.jsx';
import { ModalButton, Badge, Spinner, cx } from '../../components/ui.jsx';
import { IconUpload, IconWarning, IconInfo } from '../../components/icons.jsx';
import { parseCSV } from '../../lib/csv.js';
import { readXlsx, isSpreadsheet } from '../../lib/xlsx.js';
import { reviewMealRows, completeness, markDuplicates } from '../../lib/mealImport.js';

/* ═══════════════════════════════════════════════════════
   MEAL IMPORT

   Read, review, then write — nothing reaches the meal list until the
   rows have been looked at. The review is where an import earns trust:
   it shows which columns were understood, what each row will arrive
   with, and what it will arrive without.
   ═══════════════════════════════════════════════════════ */

function Bar({ filled, total }) {
  const pct = Math.round((filled / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line-light">
        <div
          className={cx('h-full rounded-full', pct >= 70 ? 'bg-mint' : pct >= 40 ? 'bg-amber' : 'bg-chili')}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <span className="w-11 shrink-0 text-[11px] tabular-nums text-ink-3">{filled}/{total}</span>
    </div>
  );
}

export default function MealImportModal({ open, onClose, onImport, existingMeals = [] }) {
  const [state, setState] = useState({ status: 'idle' });
  const [skipped, setSkipped] = useState(() => new Set());
  /* line -> 'skip' | 'replace' for rows that collide with an existing meal. */
  const [actions, setActions] = useState({});
  const fileRef = useRef(null);

  const close = () => { setState({ status: 'idle' }); setSkipped(new Set()); setActions({}); onClose(); };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState({ status: 'reading', fileName: file.name });
    try {
      const rows = isSpreadsheet(file.name)
        ? await readXlsx(await file.arrayBuffer())
        : parseCSV(await file.text());
      const review = reviewMealRows(rows);
      if (!review.rows.length) {
        setState({ status: 'error', message: 'No data rows found under the header.' });
        return;
      }
      if (!review.mappedCount) {
        setState({
          status: 'error',
          message: 'None of the column headings were recognised. The first row must name the columns — Name, Type, Calories and so on.',
        });
        return;
      }
      const marked = markDuplicates(review.rows, existingMeals);
      setSkipped(new Set(marked.filter((r) => !r.include).map((r) => r.line)));
      setActions(Object.fromEntries(marked.filter((r) => r.existing).map((r) => [r.line, 'skip'])));
      setState({ status: 'review', fileName: file.name, ...review, rows: marked });
    } catch (err) {
      setState({ status: 'error', message: err.message || 'That file could not be read.' });
    } finally {
      /* Same file twice in a row still fires a change event. */
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggle = (line) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      next.has(line) ? next.delete(line) : next.add(line);
      return next;
    });

  const selectable = state.status === 'review' ? state.rows.filter((r) => r.include) : [];
  /* A duplicate left on "skip" is not imported at all — it was being
     counted as chosen and added alongside the meal it duplicates. */
  const chosen = selectable.filter((r) => (
    !skipped.has(r.line) && !(r.existing && (actions[r.line] ?? 'skip') === 'skip')
  ));
  const chosenCount = chosen.length;
  const blocked = state.status === 'review' ? state.rows.filter((r) => !r.include) : [];
  const duplicates = state.status === 'review' ? state.rows.filter((r) => r.existing) : [];
  const replacing = chosen.filter((r) => r.existing && actions[r.line] === 'replace').length;

  const setAction = (line, value) => setActions((prev) => ({ ...prev, [line]: value }));

  const setAllDuplicates = (value) =>
    setActions((prev) => {
      const next = { ...prev };
      state.rows.filter((r) => r.existing).forEach((r) => { next[r.line] = value; });
      return next;
    });

  const confirm = () => {
    onImport(chosen.map((r) => ({
      meal: r.meal,
      /* A replacement carries the id it is replacing; everything else is
         new. The page decides what to do with that, not this modal. */
      replaces: r.existing && actions[r.line] === 'replace' ? r.existing.id : null,
    })));
    close();
  };


  return (
    <Modal
      open={open}
      onClose={close}
      title="Import meals"
      subtitle="CSV or Excel (.xlsx). The first row must name the columns."
      width="lg"
    >
      {state.status === 'idle' && (
        <div className="px-1 py-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-10 transition hover:border-forest hover:bg-canvas"
          >
            <span className="grid size-10 place-items-center rounded-full bg-mint-light text-mint-deep">
              <IconUpload />
            </span>
            <span className="text-[13.5px] font-medium text-ink">Choose a CSV or Excel file</span>
            <span className="text-[12px] text-ink-3">Nothing is imported until you have reviewed it</span>
          </button>

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3.5 py-3 text-[12px] leading-relaxed text-ink-2">
            <span className="mt-px shrink-0 text-ink-3"><IconInfo /></span>
            <span>
              Columns are matched by name, so <strong>Meal</strong>, <strong>Cook time</strong> and
              {' '}<strong>Kcal</strong> all land in the right place. Any column the file leaves out
              simply stays empty on the meal — nothing is filled in with a default.
              Ingredients and steps should be separated by <code className="rounded bg-line-light px-1">|</code>.
            </span>
          </div>
        </div>
      )}

      {state.status === 'reading' && (
        <div className="flex items-center justify-center gap-2.5 py-14 text-[13px] text-ink-2">
          <Spinner /> Reading {state.fileName}…
        </div>
      )}

      {state.status === 'error' && (
        <div className="px-1 py-4">
          <div className="flex items-start gap-2.5 rounded-card border border-chili/25 bg-chili-light px-4 py-3.5">
            <span className="mt-px shrink-0 text-chili-deep"><IconWarning /></span>
            <div className="text-[13px] leading-relaxed text-chili-deep">{state.message}</div>
          </div>
        </div>
      )}

      {state.status === 'review' && (
        <div className="px-1">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2">
            <span><strong className="text-ink">{state.fileName}</strong></span>
            <span>{state.mappedCount} columns understood</span>
            <span>{chosenCount} of {selectable.length} rows selected</span>
            {duplicates.length > 0 && (
              <span className="text-amber-deep">
                {replacing} replacing, {duplicates.length - replacing} skipping
              </span>
            )}
          </div>

          {state.unmapped.length > 0 && (
            <div className="mb-3 rounded-lg bg-amber-light px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-deep">
              Not recognised, and skipped: {state.unmapped.map((u) => `"${u}"`).join(', ')}.
              The rest of each row still imports.
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber/30 bg-amber-light px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[12.5px] font-semibold text-amber-deep">
                  {duplicates.length} meal{duplicates.length === 1 ? '' : 's'} already exist
                </span>
                <span className="text-[12px] text-amber-deep/80">
                  Choose what happens to each, or set them all at once.
                </span>
                <span className="ml-auto flex gap-1.5">
                  <button type="button" onClick={() => setAllDuplicates('skip')}
                    className="cursor-pointer rounded-md border border-amber/40 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-amber-deep transition hover:border-amber">
                    Skip all
                  </button>
                  <button type="button" onClick={() => setAllDuplicates('replace')}
                    className="cursor-pointer rounded-md border border-amber/40 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-amber-deep transition hover:border-chili hover:text-chili-deep">
                    Replace all
                  </button>
                </span>
              </div>
            </div>
          )}

          {blocked.length > 0 && (
            <div className="mb-3 rounded-lg bg-chili-light px-3.5 py-2.5 text-[12px] leading-relaxed text-chili-deep">
              {blocked.length} row{blocked.length === 1 ? '' : 's'} cannot be imported —
              {' '}{[...new Set(blocked.flatMap((b) => b.errors))].join('; ')}.
            </div>
          )}

          <div className="max-h-[46vh] overflow-y-auto rounded-card border border-line">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-9 border-b border-line bg-surface-2 px-3 py-2" />
                  <th className="border-b border-line bg-surface-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-3">Meal</th>
                  <th className="border-b border-line bg-surface-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-3">Type</th>
                  <th className="border-b border-line bg-surface-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-3">Nutrition</th>
                  <th className="border-b border-line bg-surface-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-3">Fields present</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((r) => {
                  const c = completeness(r.meal);
                  const on = r.include && !skipped.has(r.line);
                  return (
                    <tr key={r.line} className={cx('align-top', !r.include && 'opacity-50')}>
                      <td className="border-b border-line-light px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="size-3.5 cursor-pointer accent-forest"
                          checked={on}
                          disabled={!r.include}
                          onChange={() => toggle(r.line)}
                        />
                      </td>
                      <td className="border-b border-line-light px-3 py-2.5">
                        <div className="text-[13px] font-medium text-ink">
                          {r.meal.name || <span className="italic text-chili">no name</span>}
                        </div>
                        {r.existing && (
                          /* The choice sits on the row it applies to, so
                             nobody has to hold a mapping in their head. */
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-amber-deep">Already exists —</span>
                            {[['skip', 'Skip'], ['replace', 'Replace']].map(([value, label]) => {
                              const on = (actions[r.line] ?? 'skip') === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setAction(r.line, value)}
                                  aria-pressed={on}
                                  className={cx(
                                    'cursor-pointer rounded-md border px-2 py-0.5 text-[11px] font-medium transition',
                                    on
                                      ? value === 'replace'
                                        ? 'border-chili bg-chili-light text-chili-deep'
                                        : 'border-line bg-line-light text-ink-2'
                                      : 'border-line text-ink-3 hover:border-ink-3',
                                  )}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {r.warnings.map((w) => (
                          <div key={w} className="mt-0.5 text-[11px] leading-snug text-amber-deep">{w}</div>
                        ))}
                        {r.errors.map((e) => (
                          <div key={e} className="mt-0.5 text-[11px] leading-snug text-chili-deep">{e}</div>
                        ))}
                      </td>
                      <td className="border-b border-line-light px-3 py-2.5 text-[12px] text-ink-2">
                        {r.meal.type || <span className="italic text-ink-3">—</span>}
                      </td>
                      <td className="border-b border-line-light px-3 py-2.5 text-[12px] tabular-nums text-ink-2 whitespace-nowrap">
                        {r.meal.cal === null
                          ? <span className="italic text-ink-3">not given</span>
                          : `${r.meal.cal} kcal`}
                      </td>
                      <td className="border-b border-line-light px-3 py-2.5">
                        <Bar filled={c.filled} total={c.total} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={onFile}
      />

      <ModalActions>
        <ModalButton variant="ghost" onClick={close}>
          {state.status === 'review' ? 'Cancel' : 'Close'}
        </ModalButton>
        {state.status === 'review' ? (
          <ModalButton onClick={confirm} disabled={!chosenCount}>
            Import {chosenCount} meal{chosenCount === 1 ? '' : 's'}
            {replacing > 0 && `, replacing ${replacing}`}
          </ModalButton>
        ) : state.status === 'error' ? (
          <ModalButton onClick={() => fileRef.current?.click()}>Choose another file</ModalButton>
        ) : null}
      </ModalActions>
    </Modal>
  );
}
