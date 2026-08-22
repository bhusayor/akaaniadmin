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

/** A failed dynamic import, as opposed to a bug inside the loaded page. */
const isChunkError = (error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i
    .test(String(error?.message ?? error));

export default class ChunkBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    /* Left visible on purpose — a blank page with a clean console is the
       hardest kind of failure to report. */
    console.error('[ChunkBoundary]', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

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
              ? 'The admin was updated while this tab was open, so part of it is no longer where the page expects. Reloading picks up the new version.'
              : 'The rest of the admin is still fine — only this page failed to render.'}
          </p>

          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>
              <IconRetry /> Reload the page
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
