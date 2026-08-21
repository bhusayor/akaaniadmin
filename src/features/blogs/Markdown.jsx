import { parseMarkdown } from '../../lib/markdown.js';

/* Renders the token tree as React elements. Nothing goes through
   dangerouslySetInnerHTML, so markup inside a post stays text. */

function Inline({ nodes }) {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'strong': return <strong key={i} className="font-semibold text-ink"><Inline nodes={n.children} /></strong>;
      case 'em': return <em key={i} className="italic"><Inline nodes={n.children} /></em>;
      case 'code': return <code key={i} className="rounded bg-line-light px-1.5 py-0.5 font-mono text-[0.85em] text-ink">{n.value}</code>;
      case 'link': return (
        <a key={i} href={n.href} target="_blank" rel="noreferrer noopener"
          className="text-mint underline underline-offset-2 hover:text-forest">
          <Inline nodes={n.children} />
        </a>
      );
      case 'image': return <img key={i} src={n.src} alt={n.alt} className="my-1 inline-block max-h-64 rounded-lg" />;
      default: return <span key={i}>{n.value}</span>;
    }
  });
}

const HEADING = {
  1: 'mt-8 mb-3 text-[26px] font-semibold tracking-[-0.02em] text-ink first:mt-0',
  2: 'mt-7 mb-2.5 text-[20px] font-semibold tracking-[-0.01em] text-ink first:mt-0',
  3: 'mt-6 mb-2 text-[16px] font-semibold text-ink first:mt-0',
};

export default function Markdown({ source, className = '' }) {
  const blocks = parseMarkdown(source);

  if (!blocks.length) {
    return <p className="text-[14px] italic text-ink-3">Nothing to preview yet.</p>;
  }

  return (
    <div className={className}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading': {
            const Tag = `h${Math.min(b.level, 6)}`;
            return <Tag key={i} className={HEADING[b.level] ?? HEADING[3]}><Inline nodes={b.children} /></Tag>;
          }
          case 'quote':
            return (
              <blockquote key={i} className="my-4 border-l-[3px] border-mint bg-mint-light/40 py-2 pl-4 text-[15px] italic leading-relaxed text-ink-2">
                <Inline nodes={b.children} />
              </blockquote>
            );
          case 'code':
            return (
              <pre key={i} className="scroll-thin my-4 overflow-x-auto rounded-xl bg-ink px-4 py-3.5 text-[12.5px] leading-relaxed text-white/90">
                <code>{b.text}</code>
              </pre>
            );
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i} className={`my-3 flex flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-ink-2 ${b.ordered ? 'list-decimal' : 'list-disc'}`}>
                {b.items.map((item, k) => <li key={k}><Inline nodes={item} /></li>)}
              </Tag>
            );
          }
          case 'hr':
            return <hr key={i} className="my-7 border-line" />;
          case 'image':
            return <img key={i} src={b.src} alt={b.alt} className="my-5 w-full rounded-xl object-cover" />;
          default:
            return (
              <p key={i} className="my-3.5 text-[15px] leading-relaxed text-ink-2">
                <Inline nodes={b.children} />
              </p>
            );
        }
      })}
    </div>
  );
}
