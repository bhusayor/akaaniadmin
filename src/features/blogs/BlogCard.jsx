import { Link } from 'react-router-dom';
import { cx } from '../../components/ui.jsx';
import { formatDate } from '../../lib/blogs.js';

const STATUS_TONE = {
  published: 'bg-mint-light text-mint-deep',
  draft: 'bg-amber-light text-amber-deep',
  archived: 'bg-line-light text-ink-3',
};

/* Published cards show the live date; drafts say so plainly, because the
   difference between "live" and "not live" is the thing you scan for. */
export default function BlogCard({ post }) {
  const date = formatDate(post.publishDate) ?? formatDate(post.createdAt);

  return (
    <Link
      to={`/blogs/${post.id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-soft transition hover:-translate-y-0.5 hover:border-mint/40 hover:shadow-mid"
    >
      <div className="relative aspect-16/9 shrink-0 overflow-hidden bg-gradient-to-br from-mint-light to-[#F3FAF7]">
        {post.image ? (
          <img src={post.image} alt="" loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid size-full place-items-center text-4xl opacity-40">📝</div>
        )}
        <span className={cx('absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10.5px] font-semibold capitalize shadow-soft',
          STATUS_TONE[post.status])}>
          {post.status}
        </span>
        {post.aiGenerated && (
          <span className="absolute right-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10.5px] font-semibold text-amber-deep shadow-soft backdrop-blur">
            AI draft
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-3">
          <span>{post.status === 'published' ? date : `${date} · not live`}</span>
          <span>·</span>
          <span>{post.readingTime} min read</span>
        </div>

        <h3 className="mt-1.5 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink transition group-hover:text-forest">
          {post.title || 'Untitled post'}
        </h3>

        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-2">
          {post.excerpt || 'No excerpt yet.'}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
          {post.tags.length ? post.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-2">
              {t}
            </span>
          )) : <span className="text-[11px] italic text-ink-3">No tags</span>}
        </div>
      </div>
    </Link>
  );
}
