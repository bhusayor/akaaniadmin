import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTopbar, { useSearch } from '../hooks/useTopbar.js';
import { Button, Card, FilterSelect, CountBadge, PageToolbar, EmptyState, cx } from '../components/ui.jsx';
import { IconPlus, IconSparkles } from '../components/icons.jsx';
import BlogCard from '../features/blogs/BlogCard.jsx';
import AiGenerateModal from '../features/blogs/AiGenerateModal.jsx';
import { useBlogs } from '../state/BlogsProvider.jsx';
import { STATUSES, sortBlogs } from '../lib/blogs.js';

export default function Blogs() {
  useTopbar('Blogs', 'Search posts…');
  const [search] = useSearch();
  const navigate = useNavigate();
  const { blogs, allTags, setAiDraft } = useBlogs();

  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [aiOpen, setAiOpen] = useState(false);

  const counts = useMemo(() => {
    const out = { all: blogs.length };
    STATUSES.forEach((s) => { out[s] = blogs.filter((b) => b.status === s).length; });
    return out;
  }, [blogs]);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sortBlogs(blogs.filter((b) => {
      if (q && !b.title.toLowerCase().includes(q) && !b.excerpt.toLowerCase().includes(q)) return false;
      if (status && b.status !== status) return false;
      if (tag && !b.tags.includes(tag)) return false;
      return true;
    }));
  }, [blogs, search, status, tag]);

  const openDraft = (draft) => {
    setAiDraft(draft);
    navigate('/blogs/new?ai=1');
  };

  return (
    <>
      <PageToolbar
        left={
          <>
            <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s[0].toUpperCase() + s.slice(1)} ({counts[s]})
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">All tags</option>
              {allTags.map((t) => <option key={t}>{t}</option>)}
            </FilterSelect>
            <CountBadge>{rows.length} of {counts.all}</CountBadge>
          </>
        }
        right={
          <>
            <Button variant="ghost" onClick={() => setAiOpen(true)}>
              <IconSparkles /> Generate with AI
            </Button>
            <Button onClick={() => navigate('/blogs/new')}><IconPlus /> Write a post</Button>
          </>
        }
      />

      <div className="px-7 py-5 max-md:px-4">
        {/* Status strip — how many are actually live is the first question. */}
        <div className="mb-4 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          {[
            ['Published', counts.published, 'text-mint'],
            ['Drafts', counts.draft, 'text-amber-deep'],
            ['Archived', counts.archived, 'text-ink-3'],
            ['Total', counts.all, 'text-ink'],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-xl border border-line-light bg-surface-2 px-4 py-3">
              <div className="text-[11px] font-medium text-ink-3">{label}</div>
              <div className={cx('mt-0.5 text-xl font-bold tabular-nums', tone)}>{value}</div>
            </div>
          ))}
        </div>

        {rows.length ? (
          <div className="grid grid-cols-4 gap-4 max-[1500px]:grid-cols-3 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
            {rows.map((post) => <BlogCard key={post.id} post={post} />)}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon="📝"
              title={blogs.length ? 'No posts match those filters' : 'No posts yet'}
              sub={blogs.length ? 'Try clearing the search or filters.' : 'Write one, or let AI draft a starting point.'}
            />
          </Card>
        )}
      </div>

      <AiGenerateModal open={aiOpen} onClose={() => setAiOpen(false)} onDraft={openDraft} />
    </>
  );
}
