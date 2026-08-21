/* ═══════════════════════════════════════════════════════
   BLOG + MARKDOWN TESTS          run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert, expect } from 'vitest';
import { parseMarkdown, parseInline, markdownToText, wordCount, readingTime } from './markdown.js';
import { normalizeBlog, slugify, autoExcerpt, sortBlogs, formatDate, STATUSES } from './blogs.js';
import { mockDraft, sanitizeDraft, generate } from './blogGenerate.js';

// ─── markdown blocks ───

it('parses every block the toolbar can produce', () => {
  const types = parseMarkdown([
    '# H1', '', '## H2', '', 'A paragraph.', '', '- a', '- b', '',
    '1. one', '2. two', '', '> quoted', '', '---', '', '```js', 'code()', '```',
  ].join('\n')).map((b) => b.type);
  assert.deepStrictEqual(types,
    ['heading', 'heading', 'paragraph', 'list', 'list', 'quote', 'hr', 'code']);
});

it('keeps heading levels', () => {
  assert.deepStrictEqual(
    parseMarkdown('# a\n\n## b\n\n### c').map((b) => b.level), [1, 2, 3]);
});

it('joins wrapped lines into one paragraph', () => {
  const blocks = parseMarkdown('one line\nsecond line\n\nnew para');
  assert.strictEqual(blocks.length, 2);
  assert.strictEqual(blocks[0].children[0].value, 'one line second line');
});

it('keeps code fences verbatim, without parsing their contents', () => {
  const [block] = parseMarkdown('```\n# not a heading\n**not bold**\n```');
  assert.strictEqual(block.type, 'code');
  assert.strictEqual(block.text, '# not a heading\n**not bold**');
});

it('treats a lone image as its own block', () => {
  const [block] = parseMarkdown('![alt text](/meals/jollof-rice.jpg)');
  assert.strictEqual(block.type, 'image');
  assert.strictEqual(block.src, '/meals/jollof-rice.jpg');
  assert.strictEqual(block.alt, 'alt text');
});

it('empty input yields no blocks', () => {
  assert.deepStrictEqual(parseMarkdown(''), []);
  assert.deepStrictEqual(parseMarkdown(null), []);
  assert.deepStrictEqual(parseMarkdown('   \n\n  '), []);
});

// ─── markdown inline ───

it('parses bold, italic, code, links and images', () => {
  const types = parseInline('**b** *i* `c` [t](u) ![a](s)').map((n) => n.type);
  assert.ok(types.includes('strong'));
  assert.ok(types.includes('em'));
  assert.ok(types.includes('code'));
  assert.ok(types.includes('link'));
  assert.ok(types.includes('image'));
});

it('emits a tree, never HTML — markup in a post cannot become markup', () => {
  // The renderer builds React elements from these tokens, so a script
  // tag in a post is text, not an injection.
  const nodes = parseInline('<script>alert(1)</script> and **bold**');
  assert.strictEqual(nodes[0].type, 'text');
  assert.ok(nodes[0].value.includes('<script>'));
  assert.ok(nodes.some((n) => n.type === 'strong'));
});

it('links keep their href and parse their label', () => {
  const [link] = parseInline('[**bold** label](https://example.com)');
  assert.strictEqual(link.href, 'https://example.com');
  assert.strictEqual(link.children[0].type, 'strong');
});

// ─── reading time ───

it('strips syntax before counting words', () => {
  const text = markdownToText('# Title\n\n- **one**\n- [two](/x)\n\n---\n\n> three');
  assert.strictEqual(text, 'Title one two three');
  assert.strictEqual(wordCount('# Title\n\n- **one**\n- [two](/x)'), 3);
});

it('reading time is whole minutes at 200 wpm', () => {
  assert.strictEqual(readingTime('word '.repeat(200)), 1);
  assert.strictEqual(readingTime('word '.repeat(600)), 3);
});

it('short posts still read as 1 minute, empty posts as 0', () => {
  assert.strictEqual(readingTime('just a few words'), 1);
  assert.strictEqual(readingTime(''), 0);
});

// ─── record ───

it('slugifies titles, dropping punctuation', () => {
  assert.strictEqual(slugify('Why Egusi Deserves a Second Look!'), 'why-egusi-deserves-a-second-look');
  assert.strictEqual(slugify('  Spaces   &  symbols?? '), 'spaces-symbols');
});

it('falls back to the opening prose when no excerpt is given', () => {
  const post = normalizeBlog({ title: 'T', body: '# Heading\n\nThe opening sentence carries on.' });
  assert.ok(post.excerpt.startsWith('Heading The opening sentence'));
});

it('a supplied excerpt is kept as written', () => {
  const post = normalizeBlog({ title: 'T', body: 'x '.repeat(50), excerpt: 'Mine' });
  assert.strictEqual(post.excerpt, 'Mine');
});

it('auto excerpt cuts on a word boundary', () => {
  const out = autoExcerpt('word '.repeat(100), 40);
  assert.ok(out.length <= 41, out.length);
  assert.ok(out.endsWith('…'));
  assert.ok(!out.includes('  '));
});

it('new posts default to draft, never published', () => {
  assert.strictEqual(normalizeBlog({ title: 'T' }).status, 'draft');
  assert.strictEqual(normalizeBlog({ title: 'T', status: 'nonsense' }).status, 'draft');
  assert.ok(STATUSES.includes('published'));
});

it('reading time is derived, so it cannot go stale', () => {
  const post = normalizeBlog({ title: 'T', body: 'word '.repeat(400) });
  assert.strictEqual(post.readingTime, 2);
  post.body = 'word '.repeat(1000);
  assert.strictEqual(post.readingTime, 5);
});

it('sorts newest first, using publishDate when present', () => {
  const order = sortBlogs([
    { id: 1, createdAt: '2026-01-01' },
    { id: 2, createdAt: '2026-01-01', publishDate: '2026-06-01' },
    { id: 3, createdAt: '2026-03-01' },
  ]).map((p) => p.id);
  assert.deepStrictEqual(order, [2, 3, 1]);
});

it('formats dates and tolerates a missing one', () => {
  assert.strictEqual(formatDate('2026-08-19'), '19 Aug 2026');
  assert.strictEqual(formatDate(null), null);
  assert.strictEqual(formatDate('nonsense'), null);
});

// ─── AI drafting ───

it('a generated draft is stamped and starts as a draft', () => {
  const draft = sanitizeDraft(mockDraft('egusi and portion size'), 'egusi and portion size');
  assert.strictEqual(draft.aiGenerated, true);
  assert.strictEqual(draft.aiPrompt, 'egusi and portion size');
  assert.strictEqual(normalizeBlog(draft).status, 'draft', 'AI output must never publish itself');
});

it('sanitising rejects junk and unknown tags', () => {
  const draft = sanitizeDraft({ title: 42, body: null, tags: ['Nutrition', 'Not A Real Tag'] }, 'p');
  assert.strictEqual(draft.title, '');
  assert.strictEqual(draft.body, '');
  assert.deepStrictEqual(draft.tags, ['Nutrition']);
});

it('mock drafts are deterministic and differ by prompt', () => {
  expect(mockDraft('a topic about yam')).toEqual(mockDraft('a topic about yam'));
  expect(mockDraft('a topic about yam')).not.toEqual(mockDraft('a topic about rice'));
});

it('a too-short prompt is refused rather than guessed at', () => new Promise((done) => {
  generate('hi', (err) => {
    assert.ok(err && /at least 10/.test(err.message));
    done();
  });
}));

it('generate returns a usable draft', () => new Promise((done) => {
  generate('why swallow food is not automatically fattening', (err, draft) => {
    assert.ifError(err);
    assert.ok(draft.title.length > 0);
    assert.ok(draft.body.length > 200);
    assert.ok(draft.tags.length > 0);
    assert.ok(readingTime(draft.body) >= 1);
    done();
  });
}));
