/* ═══════════════════════════════════════════════════════
   BLOG RECORD

   One normalisation path, whether a post was typed by hand or drafted
   by the model.
   ═══════════════════════════════════════════════════════ */

import { markdownToText, readingTime, wordCount } from './markdown.js';

export const STATUSES = ['draft', 'published', 'archived'];

export const BLOG_TAGS = [
  'Nutrition', 'Recipes', 'West African Food', 'Health', 'Meal Planning',
  'Product Updates', 'Ingredients', 'Community',
];

let nextId = 500;

export function slugify(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

/** First ~160 characters of real prose, cut on a word boundary. */
export function autoExcerpt(body, limit = 160) {
  const text = markdownToText(body);
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
}

export function normalizeBlog(data, id) {
  const body = data.body ?? '';
  const title = String(data.title ?? '').trim();
  return {
    id: id ?? nextId++,
    title,
    slug: data.slug?.trim() || slugify(title),
    body,
    // Falls back to the opening prose, so a card is never blank.
    excerpt: String(data.excerpt ?? '').trim() || autoExcerpt(body),
    image: data.image ?? null,
    tags: [...(data.tags ?? [])],
    status: STATUSES.includes(data.status) ? data.status : 'draft',
    author: data.author ?? 'Peter Omidiji',
    publishDate: data.publishDate || null,
    createdAt: data.createdAt || new Date().toISOString().slice(0, 10),
    /* Kept so an editor can see a draft came from the model. Blogs are
       reviewed before publishing, so this is provenance, not a warning. */
    aiGenerated: !!data.aiGenerated,
    aiPrompt: data.aiPrompt ?? '',
    seoTitle: data.seoTitle ?? '',
    seoDescription: data.seoDescription ?? '',
    // Derived, never stored stale.
    get readingTime() { return readingTime(this.body); },
    get wordCount() { return wordCount(this.body); },
  };
}

/** Sorted newest-first by whichever date the post actually has. */
export function sortBlogs(list) {
  return [...list].sort((a, b) =>
    (b.publishDate || b.createdAt).localeCompare(a.publishDate || a.createdAt));
}

export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
