import { cx } from '../../components/ui.jsx';
import {
  IconBold, IconItalic, IconH1, IconH2, IconH3, IconQuote, IconCode,
  IconBullets, IconNumbered, IconLink, IconImageBlock, IconRule,
} from '../../components/icons.jsx';

/* Wraps or prefixes the current selection, then restores focus and the
   caret so typing carries straight on. */
export function applyFormat(textarea, action, setValue) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.slice(start, end);
  let next = value;
  let caret = end;

  const wrap = (before, after = before, placeholder = '') => {
    const inner = selected || placeholder;
    next = value.slice(0, start) + before + inner + after + value.slice(end);
    caret = start + before.length + inner.length + (selected ? after.length : 0);
  };

  const prefixLines = (prefix) => {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = end + (value.slice(end).indexOf('\n') === -1 ? value.length - end : value.slice(end).indexOf('\n'));
    const chunk = value.slice(lineStart, lineEnd);
    const numbered = prefix === '1. ';
    const out = chunk.split('\n')
      .map((l, i) => (numbered ? `${i + 1}. ` : prefix) + l.replace(/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?)/, ''))
      .join('\n');
    next = value.slice(0, lineStart) + out + value.slice(lineEnd);
    caret = lineStart + out.length;
  };

  switch (action) {
    case 'bold': wrap('**', '**', 'bold text'); break;
    case 'italic': wrap('*', '*', 'italic text'); break;
    case 'h1': prefixLines('# '); break;
    case 'h2': prefixLines('## '); break;
    case 'h3': prefixLines('### '); break;
    case 'quote': prefixLines('> '); break;
    case 'code': wrap('\n```\n', '\n```\n', 'code'); break;
    case 'ul': prefixLines('- '); break;
    case 'ol': prefixLines('1. '); break;
    case 'link': wrap('[', '](https://)', 'link text'); break;
    case 'image': wrap('![', '](https://)', 'alt text'); break;
    case 'hr': {
      const pad = start === 0 || value[start - 1] === '\n' ? '' : '\n';
      next = `${value.slice(0, start)}${pad}\n---\n\n${value.slice(end)}`;
      caret = start + pad.length + 6;
      break;
    }
    default: return;
  }

  setValue(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  });
}

const BUTTONS = [
  ['bold', IconBold, 'Bold'],
  ['italic', IconItalic, 'Italic'],
  null,
  ['h1', IconH1, 'Heading 1'],
  ['h2', IconH2, 'Heading 2'],
  ['h3', IconH3, 'Heading 3'],
  null,
  ['quote', IconQuote, 'Quote'],
  ['code', IconCode, 'Code block'],
  null,
  ['ul', IconBullets, 'Bullet list'],
  ['ol', IconNumbered, 'Numbered list'],
  null,
  ['link', IconLink, 'Link'],
  ['image', IconImageBlock, 'Image'],
  ['hr', IconRule, 'Divider'],
];

export default function MarkdownToolbar({ onAction, mode, onMode }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-1.5">
      {BUTTONS.map((b, i) => {
        if (b === null) return <span key={`sep${i}`} className="mx-1 h-5 w-px bg-line" />;
        const [action, Icon, label] = b;
        return (
          <button
            key={action}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => onAction(action)}
            disabled={mode === 'preview'}
            className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-2 transition hover:bg-surface hover:text-ink disabled:opacity-35"
          >
            <Icon />
          </button>
        );
      })}

      <div className="ml-auto flex gap-0.5 rounded-lg bg-surface p-0.5">
        {[['write', 'Write'], ['preview', 'Preview']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => onMode(key)}
            className={cx('cursor-pointer rounded-md px-3 py-1.5 text-[12.5px] transition',
              mode === key ? 'bg-surface font-semibold text-ink shadow-soft' : 'font-medium text-ink-3 hover:text-ink')}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
