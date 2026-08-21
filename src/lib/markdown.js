/* ═══════════════════════════════════════════════════════
   MARKDOWN → TOKEN TREE

   Covers exactly what the editor toolbar can produce: headings, bold,
   italic, inline code, fenced code, quotes, ordered/unordered lists,
   links, images and rules.

   It emits a token tree rather than an HTML string on purpose — the
   renderer builds React elements from it, so nothing ever reaches
   dangerouslySetInnerHTML and a post can't inject markup.
   ═══════════════════════════════════════════════════════ */

/** Inline: **bold**, *italic*, `code`, [text](href), ![alt](src) */
export function parseInline(text) {
  const out = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer) { out.push({ type: 'text', value: buffer }); buffer = ''; }
  };

  while (i < text.length) {
    const rest = text.slice(i);

    let m = /^!\[([^\]]*)\]\(([^)\s]+)\)/.exec(rest);
    if (m) { flush(); out.push({ type: 'image', alt: m[1], src: m[2] }); i += m[0].length; continue; }

    m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (m) { flush(); out.push({ type: 'link', href: m[2], children: parseInline(m[1]) }); i += m[0].length; continue; }

    m = /^`([^`]+)`/.exec(rest);
    if (m) { flush(); out.push({ type: 'code', value: m[1] }); i += m[0].length; continue; }

    m = /^\*\*([^*]+)\*\*/.exec(rest);
    if (m) { flush(); out.push({ type: 'strong', children: parseInline(m[1]) }); i += m[0].length; continue; }

    m = /^\*([^*]+)\*/.exec(rest);
    if (m) { flush(); out.push({ type: 'em', children: parseInline(m[1]) }); i += m[0].length; continue; }

    buffer += text[i];
    i += 1;
  }
  flush();
  return out;
}

/** Blocks. Returns [] for empty input. */
export function parseMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i += 1; continue; }

    // fenced code
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const body = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { body.push(lines[i]); i += 1; }
      i += 1; // closing fence
      blocks.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { blocks.push({ type: 'hr' }); i += 1; continue; }

    let m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      blocks.push({ type: 'heading', level: m[1].length, children: parseInline(m[2].trim()) });
      i += 1;
      continue;
    }

    // a lone image is its own block, so it can be rendered full width
    m = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line.trim());
    if (m) { blocks.push({ type: 'image', alt: m[1], src: m[2] }); i += 1; continue; }

    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { body.push(lines[i].replace(/^>\s?/, '')); i += 1; }
      blocks.push({ type: 'quote', children: parseInline(body.join(' ')) });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*[-*+]\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*\d+[.)]\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // paragraph — consecutive non-blank lines that start no other block
    const para = [];
    while (
      i < lines.length && lines[i].trim() &&
      !/^(#{1,6}\s|>|```|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i]) &&
      !/^\s*([-*_])\1{2,}\s*$/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    if (para.length) blocks.push({ type: 'paragraph', children: parseInline(para.join(' ')) });
  }

  return blocks;
}

/** Plain text, for excerpts and word counts. */
export function markdownToText(source) {
  return String(source ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_])\1{2,}\s*$/gm, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(source) {
  const text = markdownToText(source);
  return text ? text.split(/\s+/).length : 0;
}

/** Reading time in whole minutes at 200 wpm; never returns 0 for real content. */
export function readingTime(source) {
  const words = wordCount(source);
  return words ? Math.max(1, Math.round(words / 200)) : 0;
}
