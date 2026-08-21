import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import useTopbar from '../hooks/useTopbar.js';
import { Button, Field, Input, cx } from '../components/ui.jsx';
import {
  IconTrash, IconCheck, IconExcerpt, IconImage, IconTag, IconCalendar,
  IconGlobe, IconSparkles, IconPlus, IconFile,
} from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { useBlogs } from '../state/BlogsProvider.jsx';
import MarkdownToolbar, { applyFormat } from '../features/blogs/MarkdownToolbar.jsx';
import Markdown from '../features/blogs/Markdown.jsx';
import { STATUSES, autoExcerpt } from '../lib/blogs.js';
import { readingTime, wordCount } from '../lib/markdown.js';

const TITLE_LIMIT = 200;

const blank = () => ({
  title: '', body: '', excerpt: '', image: null, tags: [], status: 'draft',
  publishDate: '', seoTitle: '', seoDescription: '', aiGenerated: false, aiPrompt: '',
});

/* Panel heading on the right rail. */
function Rail({ icon: Icon, title, children }) {
  return (
    <div className="border-b border-line-light px-5 py-4 last:border-0">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
        <span className="text-ink-3"><Icon /></span>{title}
      </div>
      {children}
    </div>
  );
}

export default function BlogEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { getBlog, createBlog, updateBlog, deleteBlog, aiDraft, clearAiDraft, allTags } = useBlogs();

  const existing = id ? getBlog(id) : null;
  const [form, setForm] = useState(() => {
    if (existing) return { ...existing, publishDate: existing.publishDate ?? '' };
    // A draft handed over from the AI modal.
    if (params.get('ai') && aiDraft) return { ...blank(), ...aiDraft };
    return blank();
  });
  const [mode, setMode] = useState('write');
  const [newTag, setNewTag] = useState('');
  const bodyRef = useRef(null);
  const initial = useRef(JSON.stringify(form));

  useTopbar(existing ? 'Edit post' : 'New post');

  /* The handed-over draft is consumed once, so a refresh does not resurrect it. */
  useEffect(() => { if (params.get('ai')) clearAiDraft(); }, [params, clearAiDraft]);

  const dirty = useMemo(() => JSON.stringify(form) !== initial.current, [form]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const words = wordCount(form.body);
  const minutes = readingTime(form.body);

  const persist = (status) => {
    if (!form.title.trim()) { toast('Give the post a title first'); return; }

    const payload = {
      ...form,
      status,
      // Publishing without a date would sort the post to the bottom forever.
      publishDate: status === 'published'
        ? form.publishDate || new Date().toISOString().slice(0, 10)
        : form.publishDate || null,
      excerpt: form.excerpt.trim() || autoExcerpt(form.body),
    };

    if (existing) {
      updateBlog(existing.id, payload);
      toast(status === 'published' ? 'Post published' : 'Changes saved');
      navigate('/blogs');
    } else {
      const created = createBlog(payload);
      toast(status === 'published' ? 'Post published' : 'Draft saved');
      navigate(`/blogs/edit/${created.id}`, { replace: true });
      initial.current = JSON.stringify({ ...form, status });
      setForm((f) => ({ ...f, status }));
    }
  };

  const remove = () => {
    if (!existing || !window.confirm(`Delete "${existing.title}"?`)) return;
    deleteBlog(existing.id);
    toast('Post deleted');
    navigate('/blogs');
  };

  const pickImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => set('image', e.target.result);
    reader.readAsDataURL(file);
  };

  const toggleTag = (t) =>
    set('tags', form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t]);

  const trimmedTag = newTag.trim();
  // Case-insensitive, so "Recipes" and "recipes" cannot both exist.
  const canAddTag = !!trimmedTag && !form.tags.some((t) => t.toLowerCase() === trimmedTag.toLowerCase());

  const addTag = () => {
    if (!canAddTag) return;
    // Reuse the existing casing when the tag is already in the vocabulary.
    const existing = allTags.find((t) => t.toLowerCase() === trimmedTag.toLowerCase());
    set('tags', [...form.tags, existing ?? trimmedTag]);
    setNewTag('');
  };

  return (
    <>
      {/* Top bar */}
      <div className="sticky top-[60px] z-15 flex flex-wrap items-center gap-3 border-b border-line bg-surface px-7 pt-3 pb-3 max-md:static max-md:px-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-amber-light text-amber-deep">
          <IconFile size={14} />
        </span>
        <span className="text-[14px] font-semibold text-ink">{existing ? 'Edit post' : 'New post'}</span>
        {form.aiGenerated && (
          <span className="rounded-full bg-amber-light px-2.5 py-1 text-[10.5px] font-semibold text-amber-deep">
            AI draft
          </span>
        )}

        {/* Status */}
        <div className="ml-auto flex gap-0.5 rounded-lg bg-canvas p-0.5">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => set('status', s)}
              className={cx('cursor-pointer rounded-md px-3 py-1.5 text-[12.5px] capitalize transition',
                form.status === s ? 'bg-surface font-semibold text-ink shadow-soft' : 'font-medium text-ink-3 hover:text-ink')}>
              {s}
            </button>
          ))}
        </div>

        {existing && (
          <Button variant="ghost" className="hover:border-chili hover:text-chili" onClick={remove}>
            <IconTrash /> Delete
          </Button>
        )}
        <Button variant="ghost" onClick={() => persist('draft')}>Save draft</Button>
        <Button onClick={() => persist('published')}>
          <IconCheck size={13} stroke={2.5} /> {form.status === 'published' ? 'Update' : 'Publish'}
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start max-[1100px]:grid-cols-1">
        {/* ── Composer ── */}
        <div className="min-w-0 px-10 py-8 max-md:px-4 max-md:py-5">
          <div className="mx-auto max-w-[720px]">
            <input
              value={form.title}
              maxLength={TITLE_LIMIT}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Your story title…"
              className="w-full border-none bg-transparent text-[40px] font-semibold leading-tight tracking-[-0.03em] text-ink outline-none placeholder:text-ink-3/60 max-md:text-[28px]"
            />
            <div className="mb-5 mt-2 flex items-center justify-between border-b border-line pb-2 text-[11.5px] text-ink-3">
              <span>{words} words · {minutes} min read</span>
              <span className="tabular-nums">{form.title.length}/{TITLE_LIMIT}</span>
            </div>

            <MarkdownToolbar
              mode={mode}
              onMode={setMode}
              onAction={(a) => applyFormat(bodyRef.current, a, (v) => set('body', v))}
            />

            {mode === 'write' ? (
              <textarea
                ref={bodyRef}
                value={form.body}
                onChange={(e) => set('body', e.target.value)}
                placeholder="Tell your story… (Markdown supported)"
                className="mt-5 min-h-[440px] w-full resize-y border-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3/70"
              />
            ) : (
              <div className="mt-5 min-h-[440px]">
                <Markdown source={form.body} />
              </div>
            )}
          </div>
        </div>

        {/* ── Rail ── */}
        <aside className="sticky top-[116px] border-l border-line bg-surface max-[1100px]:static max-[1100px]:border-l-0 max-[1100px]:border-t">
          <Rail icon={IconExcerpt} title="Excerpt">
            <textarea
              rows={3}
              value={form.excerpt}
              onChange={(e) => set('excerpt', e.target.value)}
              placeholder="Short summary for previews…"
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink outline-none transition placeholder:text-ink-3 focus:border-mint focus:ring-3 focus:ring-mint/8"
            />
            <p className="mt-1.5 text-[11px] text-ink-3">
              {form.excerpt.trim() ? `${form.excerpt.trim().length} characters` : 'Left blank, the opening lines are used.'}
            </p>
          </Rail>

          <Rail icon={IconImage} title="Featured image">
            {form.image ? (
              <div className="relative overflow-hidden rounded-xl">
                <img src={form.image} alt="" className="h-36 w-full object-cover" />
                <button onClick={() => set('image', null)} title="Remove image"
                  className="absolute bottom-2 right-2 grid size-8 cursor-pointer place-items-center rounded-full bg-chili text-white shadow-mid transition hover:opacity-85">
                  <IconTrash size={13} />
                </button>
              </div>
            ) : (
              <label className="grid h-24 cursor-pointer place-items-center rounded-xl border border-dashed border-line bg-surface-2 text-[12.5px] text-ink-3 transition hover:border-mint hover:text-forest">
                Choose image
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => pickImage(e.target.files?.[0])} />
              </label>
            )}
          </Rail>

          <Rail icon={IconTag} title="Tags">
            <div className="flex flex-wrap gap-1.5">
              {/* Anything already on this post shows even if it is brand new
                  and not yet in the shared vocabulary. */}
              {[...new Set([...allTags, ...form.tags])].map((t) => (
                <button key={t} onClick={() => toggleTag(t)}
                  className={cx('cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition',
                    form.tags.includes(t)
                      ? 'border-forest bg-forest text-white'
                      : 'border-line text-ink-2 hover:border-forest hover:text-forest')}>
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-2.5 flex gap-1.5">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add a tag…"
                maxLength={40}
                className="px-2.5 py-1.5 text-[12px]"
              />
              <button
                type="button"
                onClick={addTag}
                disabled={!canAddTag}
                title="Add tag"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-line text-ink-2 transition hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconPlus />
              </button>
            </div>
            {newTag.trim() && !canAddTag && (
              <p className="mt-1 text-[11px] text-ink-3">
                {form.tags.some((t) => t.toLowerCase() === newTag.trim().toLowerCase())
                  ? 'Already on this post.'
                  : 'Enter a tag name.'}
              </p>
            )}
          </Rail>

          <Rail icon={IconCalendar} title="Publish date">
            <Input type="date" value={form.publishDate ?? ''}
              onChange={(e) => set('publishDate', e.target.value)} />
            <p className="mt-1.5 text-[11px] text-ink-3">Left blank, publishing stamps today.</p>
          </Rail>

          <Rail icon={IconGlobe} title="SEO settings">
            <div className="flex flex-col gap-3">
                <Field label="SEO title" hint={`${form.seoTitle.length}/60`}>
                  <Input value={form.seoTitle} maxLength={60} placeholder={form.title || 'Defaults to the post title'}
                    onChange={(e) => set('seoTitle', e.target.value)} />
                </Field>
                <Field label="Meta description" hint={`${form.seoDescription.length}/160`}>
                  <textarea rows={3} maxLength={160} value={form.seoDescription}
                    onChange={(e) => set('seoDescription', e.target.value)}
                    placeholder="Defaults to the excerpt"
                    className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink outline-none transition placeholder:text-ink-3 focus:border-mint focus:ring-3 focus:ring-mint/8" />
                </Field>
                <div className="rounded-lg bg-surface-2 px-3 py-2.5">
                  <div className="truncate text-[13px] text-ocean">{form.seoTitle || form.title || 'Post title'}</div>
                  <div className="truncate text-[11px] text-mint-deep">akaani.com/blog/{form.slug || 'post-slug'}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11.5px] text-ink-3">
                    {form.seoDescription || form.excerpt || autoExcerpt(form.body) || 'Meta description preview'}
                  </div>
                </div>
            </div>
          </Rail>

          {form.aiGenerated && form.aiPrompt && (
            <Rail icon={IconSparkles} title="AI prompt">
              <p className="text-[12px] italic leading-relaxed text-ink-3">“{form.aiPrompt}”</p>
            </Rail>
          )}

          <div className="px-5 py-3 text-[11px] text-ink-3">
            {dirty ? 'Unsaved changes' : existing ? 'All changes saved' : 'Nothing saved yet'}
          </div>
        </aside>
      </div>
    </>
  );
}
