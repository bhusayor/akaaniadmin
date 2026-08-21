/* ═══════════════════════════════════════════════════════
   CSV PRIMITIVES

   Parsing, serialising and downloading — deliberately free of any
   WAFCT dependency so pages that only need an export (Customers,
   Meals) do not pull the 960-food dataset into the main bundle.
   ═══════════════════════════════════════════════════════ */

/** RFC-4180-ish: quoted fields, embedded commas/newlines, CRLF, BOM. */
export function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"')  { inQuotes = true; i++; continue; }
    if (c === ',')  { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((f) => String(f).trim() !== ''));
}

export function toCSV(rows) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c === null || c === undefined ? '' : String(c);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
}

/** Triggers a browser download. No-op outside the browser. */
export function downloadCSV(filename, rows) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
