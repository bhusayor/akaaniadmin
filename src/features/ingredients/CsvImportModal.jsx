import { useRef, useState } from 'react';
import Modal, { ModalActions } from '../../components/Modal.jsx';
import { Badge, Button, ModalButton, Th, Td, cx } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import {
  parseCSV, buildReviewRows, applyReviewRows, gapReportRows,
  downloadCSV, EXPECTED_COLUMNS,
} from '../../lib/csvImport.js';
import * as NE from '../../lib/nutritionEstimate.js';
import { isAiSource, fmtMacro } from '../../lib/ingredients.js';
import { MATCHED_THRESHOLD } from '../../lib/wafctMatch.js';

const STAGE = { UPLOAD: 1, REVIEW: 2, SUMMARY: 3 };

const TITLES = {
  [STAGE.UPLOAD]: ['Import Ingredients from CSV', 'Rows without nutrition are matched against WAFCT automatically. Nothing is written until you confirm.'],
  [STAGE.REVIEW]: ['Review before importing', 'Uncheck anything you do not want created. Nothing has been written yet.'],
  [STAGE.SUMMARY]: ['Import complete', 'Here is what happened.'],
};

function Macros({ m }) {
  return (
    <span className="whitespace-nowrap text-[11.5px] tabular-nums text-ink-2">
      {m.calories === null ? '—' : `${m.calories} kcal`} · P {fmtMacro(m.protein_g, 'g')} ·
      {' '}C {fmtMacro(m.carbs_g, 'g')} · F {fmtMacro(m.fat_g, 'g')} · Fb {fmtMacro(m.fibre_g, 'g')}
    </span>
  );
}

export default function CsvImportModal({ open, onClose, onImport }) {
  const toast = useToast();
  const [stage, setStage] = useState(STAGE.UPLOAD);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [estimating, setEstimating] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);

  const reset = () => { setStage(STAGE.UPLOAD); setRows([]); setSummary(null); setEstimating(null); };
  const close = () => { reset(); onClose(); };

  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows: parsed, error } = buildReviewRows(parseCSV(ev.target.result));
      if (error) { toast(error); return; }
      setRows(parsed);
      setStage(STAGE.REVIEW);
    };
    reader.readAsText(file);
  };

  const setChecked = (index, checked) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, checked } : r)));

  const setAll = (checked) =>
    setRows((prev) => prev.map((r) => (r.selectable ? { ...r, checked } : r)));

  /**
   * Estimates the rows WAFCT could not match. Results are never
   * pre-checked — an estimate is weaker evidence than a measured match.
   */
  const estimateMissing = () => {
    const pending = rows.filter((r) => !r.selectable);
    if (!pending.length) return;
    setEstimating({ done: 0, total: pending.length });

    NE.estimateMany(
      pending.map((r) => r.name),
      (done, total) => setEstimating({ done, total }),
      (results) => {
        const byName = new Map();
        results.forEach((out) => { if (out.result) byName.set(out.name, out.result); });

        let filled = 0;
        setRows((prev) => prev.map((r) => {
          if (r.selectable) return r;
          const res = byName.get(r.name);
          if (!res) return r;
          const empty = Object.values(res.macros).every((v) => v === null);
          if (empty) return r;
          filled++;
          return { ...r, macros: res.macros, source: res.source, source_code: null, selectable: true, checked: false };
        }));
        setEstimating(null);
        toast(filled ? `${filled} estimated — review before importing` : 'No estimates came back');
      },
    );
  };

  const doImport = () => {
    const result = applyReviewRows(rows);
    onImport(result.created);
    setSummary(result);
    setStage(STAGE.SUMMARY);
  };

  const downloadTemplate = () =>
    downloadCSV('akaani-ingredients-template.csv', [
      EXPECTED_COLUMNS,
      ['Boiled Yam', 'Peeled and boiled', 'g', '', '', '', '', '', '', ''],
      ['Egusi', 'Ground melon seed', 'g', '', '', '', '', '', '', ''],
      ['Olive Oil', 'Extra virgin', 'g', 'Oils, Fats & Condiments', 'Oils & Fats', '900', '0', '0', '100', '0'],
    ]);

  const counts = {
    csv: rows.filter((r) => r.source === 'csv').length,
    strong: rows.filter((r) => r.source === 'WAFCT' && r.score >= MATCHED_THRESHOLD).length,
    review: rows.filter((r) => r.source === 'WAFCT' && r.score < MATCHED_THRESHOLD).length,
    ai: rows.filter((r) => isAiSource(r.source)).length,
    none: rows.filter((r) => !r.selectable).length,
  };
  const checkedCount = rows.filter((r) => r.selectable && r.checked).length;
  const [title, subtitle] = TITLES[stage];

  return (
    <Modal open={open} onClose={close} width="lg" title={title} subtitle={subtitle}>
      {stage === STAGE.UPLOAD && (
        <>
          <div
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) readFile(f);
            }}
            className={cx(
              'cursor-pointer rounded-card border-[1.5px] border-dashed px-6 py-10 text-center transition',
              dragging ? 'border-mint bg-[#F4FBF8]' : 'border-line bg-surface-2 hover:border-mint hover:bg-[#F4FBF8]',
            )}
          >
            <div className="mb-2 text-[32px] opacity-50">📄</div>
            <div className="text-sm font-semibold text-ink">Choose a CSV file</div>
            <div className="mt-1 text-[12.5px] text-ink-3">or drag and drop it here</div>
          </div>
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />

          <div className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3.5">
            <div className="mb-2 text-[11.5px] font-semibold text-ink-2">Expected columns</div>
            <div className="flex flex-wrap gap-1">
              {EXPECTED_COLUMNS.map((c) => (
                <code key={c} className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                  {c}
                </code>
              ))}
            </div>
            <div className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
              Only <strong>name</strong> is required. Extra columns are ignored, missing ones stay blank.
              An optional <code className="font-mono">image_url</code> column is attached as the image, and
              a <code className="font-mono">product_url</code> column is preserved on export.
              <br />
              <button onClick={downloadTemplate} className="mt-1 cursor-pointer font-semibold text-mint underline">
                Download a template CSV
              </button>
            </div>
          </div>
          <ModalActions><ModalButton variant="ghost" onClick={close}>Cancel</ModalButton></ModalActions>
        </>
      )}

      {stage === STAGE.REVIEW && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3.5 text-xs text-ink-2">
              {[
                ['#185FA5', `${counts.csv} from CSV`],
                ['#1D9E75', `${counts.strong} WAFCT matched`],
                ['#C8A97E', `${counts.review} needs review`],
                ...(counts.ai ? [['#7A4F2A', `${counts.ai} AI estimated`]] : []),
                ['#9CA3AF', `${counts.none} no match`],
              ].map(([colour, label]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="size-[7px] shrink-0 rounded-full" style={{ background: colour }} />
                  {label}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              {counts.none > 0 && (
                <Button variant="ghost" onClick={estimateMissing} disabled={!!estimating}>
                  {estimating ? `Estimating ${estimating.done}/${estimating.total}…` : `Estimate ${counts.none} with AI`}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setAll(true)}>Select all</Button>
              <Button variant="ghost" onClick={() => setAll(false)}>Deselect all</Button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr>
                  <Th className="sticky top-0 z-2 w-10" />
                  <Th className="sticky top-0 z-2">Name</Th>
                  <Th className="sticky top-0 z-2">Group / Category</Th>
                  <Th className="sticky top-0 z-2">Nutrition (per 100g)</Th>
                  <Th className="sticky top-0 z-2">Source</Th>
                  <Th className="sticky top-0 z-2">Confidence</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.name}-${i}`} className={cx(!r.selectable && 'bg-[#FEFBFA]')}>
                    <Td>
                      {r.selectable && (
                        <input type="checkbox" className="size-3.5 cursor-pointer accent-forest"
                          checked={r.checked} onChange={(e) => setChecked(i, e.target.checked)} />
                      )}
                    </Td>
                    <Td>
                      <div className={cx('font-medium', !r.selectable && 'text-ink-2')}>{r.name}</div>
                      {r.match && <div className="text-[11px] text-ink-3">{r.match.name}</div>}
                    </Td>
                    <Td>
                      <div className="text-[11.5px] text-ink-2">{r.product_group || '—'}</div>
                      <div className="text-[11px] text-ink-3">{r.product_category || '—'}</div>
                    </Td>
                    <Td>
                      {r.selectable ? <Macros m={r.macros} />
                        : <span className="text-[11px] italic text-ink-3">no nutrition found</span>}
                    </Td>
                    <Td>
                      {r.source === 'csv' ? <Badge tone="ocean">CSV</Badge>
                        : r.source === 'WAFCT' ? <Badge tone="mint">WAFCT</Badge>
                          : isAiSource(r.source) ? <Badge tone="amber" title={r.source}>AI est.</Badge>
                            : <Badge>—</Badge>}
                    </Td>
                    <Td>
                      {isAiSource(r.source) ? <Badge tone="amber" className="rounded-full">Estimated</Badge>
                        : r.score === null ? <span className="text-[11px] italic text-ink-3">—</span>
                          : <Badge tone={r.score >= MATCHED_THRESHOLD ? 'mint' : 'amber'} className="rounded-full">
                              {Math.round(r.score)}%
                            </Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ModalActions>
            <ModalButton variant="ghost" onClick={reset}>Back</ModalButton>
            <ModalButton onClick={doImport} disabled={!checkedCount}>
              Import {checkedCount} ingredient{checkedCount === 1 ? '' : 's'}
            </ModalButton>
          </ModalActions>
        </>
      )}

      {stage === STAGE.SUMMARY && summary && (
        <>
          <div className="py-1.5 pb-4.5 text-center">
            <div className="text-[34px] font-bold leading-tight text-forest">{summary.created.length}</div>
            <div className="mt-0.5 text-[13px] text-ink-2">ingredients created</div>
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            {[
              ['#1D9E75', 'Created', summary.created.length],
              ['#C8A97E', 'Skipped (unchecked)', summary.skipped.length],
              ['#9CA3AF', 'No nutrition match', summary.noMatch.length],
            ].map(([colour, label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-line-light px-4 py-3 text-[13px] last:border-0">
                <span className="flex items-center gap-2 text-ink-2">
                  <span className="size-[7px] rounded-full" style={{ background: colour }} />{label}
                </span>
                <span className="font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </div>

          {summary.skipped.length + summary.noMatch.length > 0 && (
            <div className="mt-3.5 rounded-xl bg-amber-light px-3.5 py-3 text-xs leading-relaxed text-amber-deep">
              <strong>{summary.skipped.length + summary.noMatch.length} rows</strong> were not imported.
              Download them below so the gap stays visible — they are not lost, just waiting on a name the
              matcher recognises or on manual macros.
            </div>
          )}

          <ModalActions>
            {summary.skipped.length + summary.noMatch.length > 0 && (
              <ModalButton variant="ghost"
                onClick={() => {
                  downloadCSV('akaani-ingredients-not-imported.csv', gapReportRows(summary));
                  toast(`Downloaded ${summary.skipped.length + summary.noMatch.length} rows`);
                }}>
                Download skipped rows
              </ModalButton>
            )}
            <ModalButton onClick={close}>Done</ModalButton>
          </ModalActions>
        </>
      )}
    </Modal>
  );
}
