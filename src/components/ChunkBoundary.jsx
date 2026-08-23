import { Component } from 'react';
import { Button } from './ui.jsx';
import { IconWarning, IconRetry } from './icons.jsx';

/* ═══════════════════════════════════════════════════════
   CHUNK BOUNDARY

   A route that is code-split can fail to load, and when it does React
   simply never renders it — Suspense keeps waiting and the page is left
   blank with nothing to explain it.

   That is not a hypothetical: a browser holding a cached index.html asks
   for a chunk hash that no longer exists after a rebuild, and the import
   404s. This catches it, says so, and offers the reload that fixes it.
   ═══════════════════════════════════════════════════════ */

/**
 * A failed dynamic import, as opposed to a bug inside the loaded page.
 *
 * Only this decides whether to reload: reloading on a genuine render bug
 * would hide it behind an endless refresh.
 */
export const isChunkError = (error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i
    .test(String(error?.message ?? error));

/* One automatic reload per tab. Kept in sessionStorage rather than state
   because the reload is what clears the state. */
const RELOAD_KEY = 'akaani.chunkReloaded';

export default class ChunkBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, recovering: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    /* Left visible on purpose — a blank page with a clean console is the
       hardest kind of failure to report. */
    console.error('[ChunkBoundary]', error);

    /**
     * A stale index.html asking for a chunk hash that no longer exists is
     * fixed by reloading, and nobody should have to know that. So do it —
     * once per tab, tracked in sessionStorage so a genuinely missing file
     * cannot put the page in a reload loop.
     */
    if (!isChunkError(error)) return;
    let already = 'true';
    try { already = sessionStorage.getItem(RELOAD_KEY); } catch { /* private mode */ }
    if (already) return;

    try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* ignore */ }
    this.setState({ recovering: true });
    window.location.reload();
  }

  render() {
    const { error, recovering } = this.state;
    if (!error) return this.props.children;

    /* Mid-reload. Showing the failure here would flash an error the user
       never needed to see. */
    if (recovering) {
      return (
        <div className="px-7 py-16 text-center text-[13px] text-ink-3 max-md:px-4">
          Updating to the latest version…
        </div>
      );
    }

    const stale = isChunkError(error);

    return (
      <div className="px-7 py-16 max-md:px-4">
        <div className="mx-auto max-w-[440px] text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-amber-light text-amber-deep">
            <IconWarning />
          </div>
          <h2 className="mt-4 text-[17px] font-semibold text-ink">
            {stale ? 'This page could not be loaded' : 'Something went wrong on this page'}
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
            {stale
              ? 'The admin was updated while this tab was open, and reloading once did not pick up the new version. The file this page needs is not being served.'
              : 'The rest of the admin is still fine — only this page failed to render.'}
          </p>

          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => {
              try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
              window.location.reload();
            }}>
              <IconRetry /> Try again
            </Button>
          </div>

          <p className="mt-4 font-mono text-[11px] leading-relaxed break-words text-ink-3">
            {String(error?.message ?? error)}
          </p>
        </div>
      </div>
    );
  }
}
