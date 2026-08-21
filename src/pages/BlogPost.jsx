import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useTopbar from '../hooks/useTopbar.js';
import Modal, { ModalActions } from '../components/Modal.jsx';
import { Button, Card, EmptyState, ModalButton, cx } from '../components/ui.jsx';
import { IconEdit, IconTrash, IconClock, IconCalendar } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { useBlogs } from '../state/BlogsProvider.jsx';
import Markdown from '../features/blogs/Markdown.jsx';

/* ═══════════════════════════════════════════════════════
   BLOG POST — READ VIEW

   The post as a reader meets it on the site, not as a form.

   Opening a written piece straight into an editor makes it impossible to
   judge, so this is what a card now opens; Edit is one click from here.
   ═══════════════════════════════════════════════════════ */

const STATUS_TONE = {
  published: 'bg-mint-light text-mint-deep',
  draft: 'bg-amber-light text-amber-deep',
  archived: 'bg-line-light text-ink-3',
};

const formatDate = (iso) => {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export default function BlogPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { getBlog, deleteBlog } = useBlogs();
  const post = getBlog(id);

  useTopbar(post ? post.title : 'Post');
  const [pendingDelete, setPendingDelete] = useState(false);

  if (!post) {
    return (
      <div className="px-7 py-5 max-md:px-4">
        <Card>
          <EmptyState icon="📝" title="Post not found" sub="It may have been deleted." />
          <div className="flex justify-center pb-8">
            <Button onClick={() => navigate('/blogs')}>Back to blogs</Button>
          </div>
        </Card>
      </div>
    );
  }

  const published = formatDate(post.publishDate) ?? formatDate(post.createdAt);

  return (
    <>
      {/* Actions stay on a bar of their own, so nothing chrome-like
          intrudes on the post itself below. */}
      <div className="sticky top-[60px] z-15 flex flex-wrap items-center gap-3 border-b border-line bg-surface px-7 pt-4 pb-3 max-md:static max-md:px-4">
        <Link to="/blogs" className="text-[12.5px] text-ink-3 transition hover:text-ink">← All posts</Link>
        <span className={cx('rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize', STATUS_TONE[post.status])}>
          {post.status}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setPendingDelete(true)}>
            <IconTrash /> Delete
          </Button>
          <Button onClick={() => navigate(`/blogs/edit/${post.id}`)}>
            <IconEdit /> Edit post
          </Button>
        </div>
      </div>

      {/* A reading column, not a full-width dashboard row — long prose set
          across 1400px is unreadable. */}
      <article className="mx-auto max-w-[760px] px-7 py-8 max-md:px-4">
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <span key={t} className="rounded-full bg-mint-light px-2.5 py-1 text-[11.5px] font-medium text-mint-deep">
              {t}
            </span>
          ))}
        </div>

        <h1 className="mt-4 text-[34px] font-bold leading-[1.15] tracking-[-0.02em] text-ink max-sm:text-[26px]">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{post.excerpt}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-line-light py-3 text-[12.5px] text-ink-3">
          {published && (
            <span className="inline-flex items-center gap-1.5"><IconCalendar size={12} /> {published}</span>
          )}
          <span className="inline-flex items-center gap-1.5"><IconClock size={11} /> {post.readingTime} min read</span>
          {post.status !== 'published' && (
            <span className="text-amber-deep">Not live on the site yet</span>
          )}
        </div>

        {post.image && (
          <img
            src={post.image}
            alt=""
            className="mt-6 aspect-[16/9] w-full rounded-card object-cover"
          />
        )}

        <div className="mt-7">
          <Markdown source={post.body} />
        </div>

        {(post.seoTitle || post.seoDescription) && (
          <div className="mt-10 rounded-card border border-line bg-surface-2 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              How this looks in search
            </div>
            <div className="mt-2.5">
              <div className="text-[15px] text-ocean-deep">{post.seoTitle || post.title}</div>
              <div className="mt-0.5 text-[12px] text-mint-deep">akaani.com/blog/{post.slug}</div>
              <div className="mt-1 text-[13px] leading-snug text-ink-2">
                {post.seoDescription || post.excerpt}
              </div>
            </div>
          </div>
        )}
      </article>

      <Modal
        open={pendingDelete}
        onClose={() => setPendingDelete(false)}
        title="Delete post?"
        subtitle={`"${post.title}" will be permanently removed.`}
      >
        <ModalActions>
          <ModalButton variant="ghost" onClick={() => setPendingDelete(false)}>Cancel</ModalButton>
          <ModalButton
            variant="danger"
            onClick={() => { deleteBlog(post.id); toast('Post deleted'); navigate('/blogs'); }}
          >
            Delete
          </ModalButton>
        </ModalActions>
      </Modal>
    </>
  );
}
