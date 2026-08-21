import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { BLOG_SEED } from '../data/blogs.js';
import { normalizeBlog, BLOG_TAGS } from '../lib/blogs.js';

const BlogsContext = createContext(null);

export function BlogsProvider({ children }) {
  const [blogs, setBlogs] = useState(() => BLOG_SEED.map((b) => normalizeBlog(b, b.id)));
  /* Where the AI modal parks a draft while the editor route mounts. */
  const [aiDraft, setAiDraft] = useState(null);

  const createBlog = useCallback((data) => {
    const post = normalizeBlog(data);
    setBlogs((prev) => [post, ...prev]);
    return post;
  }, []);

  const updateBlog = useCallback((id, patch) => {
    setBlogs((prev) => prev.map((b) => (b.id === id ? normalizeBlog({ ...b, ...patch }, b.id) : b)));
  }, []);

  const deleteBlog = useCallback((id) => {
    setBlogs((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const getBlog = useCallback(
    (id) => blogs.find((b) => String(b.id) === String(id)),
    [blogs],
  );

  const clearAiDraft = useCallback(() => setAiDraft(null), []);

  /* Every tag the built-in list knows about, plus every tag actually in
     use. A tag invented on one post is therefore offered on the next,
     without needing a separate store to keep in sync. */
  const allTags = useMemo(() => {
    const seen = new Set(BLOG_TAGS);
    blogs.forEach((b) => b.tags.forEach((t) => seen.add(t)));
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [blogs]);

  const value = useMemo(
    () => ({ blogs, allTags, createBlog, updateBlog, deleteBlog, getBlog, aiDraft, setAiDraft, clearAiDraft }),
    [blogs, allTags, createBlog, updateBlog, deleteBlog, getBlog, aiDraft, clearAiDraft],
  );

  return <BlogsContext.Provider value={value}>{children}</BlogsContext.Provider>;
}

export function useBlogs() {
  const ctx = useContext(BlogsContext);
  if (!ctx) throw new Error('useBlogs must be used inside <BlogsProvider>');
  return ctx;
}
