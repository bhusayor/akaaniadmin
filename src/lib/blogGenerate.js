/* ═══════════════════════════════════════════════════════
   AI BLOG DRAFTING

   Same shape as nutritionEstimate.js: a mock provider so the whole flow
   works offline with no key, and an 'openai' provider that posts to the
   local proxy which holds the credentials.

   What comes back is a *draft*. It lands in the editor as an unsaved
   draft with aiGenerated stamped on it — never straight to published.
   ═══════════════════════════════════════════════════════ */

import { BLOG_TAGS } from './blogs.js';

const CONFIG = {
  provider: 'mock',
  endpoint: 'http://localhost:8787/generate-blog',
  timeoutMs: 45000,
};

export function configure(opts) {
  if (opts) Object.keys(opts).forEach((k) => { if (opts[k] !== undefined) CONFIG[k] = opts[k]; });
  return CONFIG;
}

export const config = CONFIG;

/** Model output is untrusted: coerce to the shape the editor expects. */
export function sanitizeDraft(raw, prompt) {
  const str = (v, max) => (typeof v === 'string' ? v : '').trim().slice(0, max);
  const tags = Array.isArray(raw?.tags)
    ? raw.tags.filter((t) => BLOG_TAGS.includes(t)).slice(0, 4)
    : [];
  return {
    title: str(raw?.title, 200),
    excerpt: str(raw?.excerpt, 400),
    body: str(raw?.body, 40000),
    tags,
    seoTitle: str(raw?.seoTitle, 70),
    seoDescription: str(raw?.seoDescription, 160),
    aiGenerated: true,
    aiPrompt: prompt,
  };
}

/* ══════════════════════════════════════
   MOCK PROVIDER

   Deterministic and clearly labelled. It produces a realistic *shape* —
   headings, a list, a quote — so the editor, preview and reading-time
   estimate can all be exercised without a key.
══════════════════════════════════════ */

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function mockDraft(prompt) {
  const clean = String(prompt).trim().replace(/\s+/g, ' ');
  const subject = titleCase(clean.split(/[.,;]/)[0].slice(0, 60));
  const h = hash(clean);
  const tags = [BLOG_TAGS[h % BLOG_TAGS.length], BLOG_TAGS[(h >> 3) % BLOG_TAGS.length]];

  const body = [
    `## Why this matters`,
    ``,
    `${subject} comes up constantly in the Akaani community, and the advice on it is`,
    `split between two camps that rarely talk to each other. This piece walks through`,
    `what actually holds up.`,
    ``,
    `## What the data says`,
    ``,
    `Three things are worth pulling out:`,
    ``,
    `- **Portion beats substitution.** Changing how much is on the plate moves the`,
    `  numbers further than swapping one ingredient for another.`,
    `- **Preparation is not neutral.** Boiling, frying and roasting the same food`,
    `  produce genuinely different values per 100g.`,
    `- **Local data is thin.** Most published tables lean on non-African foods, which`,
    `  is exactly the gap WAFCT was built to close.`,
    ``,
    `> The honest answer is that the gap is in the data, not in the cooking.`,
    ``,
    `## Putting it into practice`,
    ``,
    `1. Start from what is already being cooked at home.`,
    `2. Adjust portions before replacing ingredients.`,
    `3. Track for two weeks before drawing a conclusion.`,
    ``,
    `None of this requires abandoning the food people grew up on — which is the`,
    `point Akaani keeps returning to.`,
  ].join('\n');

  return {
    title: subject.length > 12 ? subject : `${subject}: What the Evidence Says`,
    excerpt: `A closer look at ${clean.slice(0, 90).toLowerCase()} — what holds up, what does not, and what to do about it.`,
    body,
    tags: [...new Set(tags)],
    seoTitle: subject.slice(0, 60),
    seoDescription: `A practical look at ${clean.slice(0, 110).toLowerCase()}`,
  };
}

/* ══════════════════════════════════════
   OPENAI PROVIDER (via the local proxy)
══════════════════════════════════════ */

function postJSON(url, body, timeoutMs, cb) {
  if (typeof fetch !== 'function') { cb(new Error('fetch is unavailable here')); return; }
  let done = false;
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    cb(new Error(`Generation timed out after ${Math.round(timeoutMs / 1000)}s`));
  }, timeoutMs);

  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((res) => res.text().then((text) => {
      let json = null;
      try { json = JSON.parse(text); } catch { /* non-JSON body */ }
      if (!res.ok) throw new Error(json?.error || `Proxy returned ${res.status}`);
      return json;
    }))
    .then((json) => { if (done) return; done = true; clearTimeout(timer); cb(null, json); })
    .catch((err) => {
      if (done) return;
      done = true; clearTimeout(timer);
      cb(new Error(/failed to fetch|networkerror|load failed/i.test(err.message)
        ? `Could not reach the blog server at ${CONFIG.endpoint} — start it with: npm run estimate-server`
        : err.message));
    });
}

/**
 * @param {string} prompt  what the post should be about
 * @param {function(Error, object)} cb  draft: { title, excerpt, body, tags, seoTitle, seoDescription }
 */
export function generate(prompt, cb) {
  if (typeof cb !== 'function') throw new Error('generate() needs a callback');
  const clean = String(prompt ?? '').trim();
  if (clean.length < 10) {
    cb(new Error('Describe the post in at least 10 characters'));
    return;
  }

  if (CONFIG.provider === 'mock') {
    // Async on purpose — the real provider is, and callers should not
    // come to depend on behaviour that disappears later.
    setTimeout(() => cb(null, sanitizeDraft(mockDraft(clean), clean)), 900);
    return;
  }

  if (CONFIG.provider === 'openai') {
    postJSON(CONFIG.endpoint, { prompt: clean }, CONFIG.timeoutMs, (err, json) => {
      if (err) { cb(err); return; }
      if (!json?.draft) { cb(new Error('Server returned no draft')); return; }
      cb(null, sanitizeDraft(json.draft, clean));
    });
    return;
  }

  cb(new Error(`Unknown provider: ${CONFIG.provider}`));
}
