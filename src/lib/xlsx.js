/* ═══════════════════════════════════════════════════════
   XLSX READER

   An .xlsx file is a ZIP archive of XML parts. Both halves of that are
   things the platform already does — `DecompressionStream('deflate-raw')`
   inflates, and the XML we need is regular enough to scan directly — so
   this reads a spreadsheet without a parsing dependency.

   That matters here: the only SheetJS build on npm is frozen at 0.18.5,
   which carries an unfixed prototype-pollution advisory and a ReDoS one.
   Feeding a user-supplied file to that in the browser is exactly the case
   the advisories describe.

   Scope is deliberately small — the first worksheet, as text. Formulas,
   styles, merged cells and dates-as-serial-numbers are out; an admin
   importing a flat export needs none of them.
   ═══════════════════════════════════════════════════════ */

const te = new TextDecoder();

const u16 = (v, o) => v[o] | (v[o + 1] << 8);
const u32 = (v, o) => (v[o] | (v[o + 1] << 8) | (v[o + 2] << 16) | (v[o + 3] << 24)) >>> 0;

/** Raw inflate via the platform, so no deflate implementation lives here. */
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Reads a ZIP's central directory rather than scanning local headers —
 * local headers can carry a zeroed size with the real one trailing in a
 * data descriptor, which is exactly what streamed writers emit.
 */
async function unzip(buffer) {
  const v = new Uint8Array(buffer);

  /* End-of-central-directory, searched from the back because it is
     followed by a comment of unknown length. */
  let eocd = -1;
  for (let i = v.length - 22; i >= 0 && i > v.length - 65558; i--) {
    if (u32(v, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file — no end-of-central-directory record.');

  const count = u16(v, eocd + 10);
  let p = u32(v, eocd + 16);
  const files = new Map();

  for (let n = 0; n < count; n++) {
    if (u32(v, p) !== 0x02014b50) break;
    const method = u16(v, p + 10);
    const compressedSize = u32(v, p + 20);
    const nameLen = u16(v, p + 28);
    const extraLen = u16(v, p + 30);
    const commentLen = u16(v, p + 32);
    const localOffset = u32(v, p + 42);
    const name = te.decode(v.subarray(p + 46, p + 46 + nameLen));

    /* Walk into the local header to find where the data actually starts —
       its extra field length can differ from the central one. */
    const lNameLen = u16(v, localOffset + 26);
    const lExtraLen = u16(v, localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;

    files.set(name, { method, bytes: v.subarray(start, start + compressedSize) });
    p += 46 + nameLen + extraLen + commentLen;
  }

  const out = new Map();
  for (const [name, f] of files) {
    if (f.method === 0) out.set(name, f.bytes);
    else if (f.method === 8) out.set(name, await inflateRaw(f.bytes));
    /* Anything else is a compression method Excel does not emit. */
  }
  return out;
}

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeXml(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|lt|gt|amp|quot|apos);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X'
        ? parseInt(e.slice(2), 16)
        : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/**
 * The shared string table. Excel stores most text once here and cells
 * reference it by index; a string split across formatting runs arrives as
 * several <t> under one <si> and has to be joined.
 */
function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => {
    const parts = [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXml(t[1]));
    return parts.join('');
  });
}

/** `BC12` → 54 (zero-based column index). */
export function columnIndex(ref) {
  const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? '';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];

  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? '';
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1];

      let value = '';
      if (type === 'inlineStr') {
        value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXml(t[1])).join('');
      } else {
        const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (raw !== undefined) {
          value = type === 's' ? (shared[Number(raw)] ?? '') : decodeXml(raw);
        }
      }

      /* Excel omits empty cells entirely, so a row's cells are placed by
         their reference — otherwise a blank mid-row shifts every value
         after it one column to the left. */
      const at = ref ? columnIndex(ref) : cells.length;
      while (cells.length < at) cells.push('');
      cells[at] = value;
    }
    rows.push(cells);
  }

  /* Pad every row to the widest, so callers can index by column safely. */
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  return rows.map((r) => {
    const copy = r.slice();
    while (copy.length < width) copy.push('');
    return copy;
  });
}

/**
 * Reads the first worksheet of an .xlsx as an array of string rows.
 *
 * @param buffer ArrayBuffer or Uint8Array of the file
 * @returns {Promise<string[][]>}
 */
export async function readXlsx(buffer) {
  const files = await unzip(buffer);

  const sheetNames = [...files.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => {
      const num = (s) => Number(/(\d+)\.xml$/.exec(s)[1]);
      return num(a) - num(b);
    });

  if (!sheetNames.length) throw new Error('No worksheet found — is this an .xlsx file?');

  const shared = parseSharedStrings(
    files.has('xl/sharedStrings.xml') ? te.decode(files.get('xl/sharedStrings.xml')) : '',
  );

  return parseSheet(te.decode(files.get(sheetNames[0])), shared);
}

/** Whether a filename looks like a spreadsheet rather than a CSV. */
export const isSpreadsheet = (name) => /\.xlsx$/i.test(String(name || ''));
