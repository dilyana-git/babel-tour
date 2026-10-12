import './failure.css';

// ── When the Library cannot be drawn ─────────────────────────────────────────
// Nothing used to check whether the browser could give us a WebGL2 context, and
// a machine that could not was shown a black rectangle with a working HUD over
// it, the piece silently insisting that everything was fine.
//
// It is fine for this to be plain. What it must not be is blank.

// A still of the piece: the Vertigo from its stand, which is also the share
// card (index.html). This page exists precisely because there is no live room
// to show, and a reader who cannot be shown the Library is at least shown the
// picture of it. (It asked for the plate tour's overture poster, which went
// with the plates: the page stood on its bare ground.)
const POSTER = '/og-card.jpg';

const FAULTS = {
  // No WebGL2. Checked BEFORE the canvas is mounted, so this is the one failure
  // the reader meets instead of the veil rather than after it.
  webgl: {
    line: 'This browser cannot draw the Library.',
    detail: 'The diorama is built in WebGL 2. Try a current Chrome, Edge, '
      + 'Firefox or Safari — and if you are already in one, check that hardware '
      + 'acceleration has not been switched off.',
    retry: null,
  },
  // Something threw inside the scene tree — a shader the driver refuses, a
  // three version disagreeing with itself.
  crash: {
    line: 'The Library could not be assembled.',
    detail: 'Something in the scene failed to build. The console holds what it '
      + 'was.',
    retry: 'try again',
  },
  // The GPU took the context back and never gave it to us. Common enough on a
  // laptop that sleeps, switches graphics, or is simply asked for more than it
  // has — and this piece asks for a good deal.
  lost: {
    line: 'The light went out.',
    detail: 'The browser reclaimed the graphics context and did not hand it '
      + 'back. Reloading rebuilds the Library.',
    retry: 'rebuild',
  },
};

export function Failure({ kind, onRetry }) {
  const fault = FAULTS[kind] ?? FAULTS.crash;
  return (
    <div className="entry-veil is-failure" role="alert">
      <div className="entry-film" aria-hidden="true">
        {/* Under the poster, in case it is one more thing this browser cannot
            fetch — the page must never be readable text on nothing. */}
        <div className="entry-film-ground" />
        <img className="entry-film-still" src={POSTER} alt="" />
        <div className="entry-film-scrim" />
      </div>
      <div className="entry-eyebrow">J. L. Borges — 1941</div>
      <h1 className="entry-title">La Biblioteca de Babel</h1>
      <div className="entry-rule" />
      <div className="entry-fault">
        <p className="entry-fault-line">{fault.line}</p>
        <p className="entry-fault-detail">{fault.detail}</p>
      </div>
      {fault.retry && (
        <button
          type="button"
          className="entry-restart"
          onClick={onRetry ?? (() => window.location.reload())}
        >
          {fault.retry}
        </button>
      )}
    </div>
  );
}

// Can this machine draw the piece at all? Asked once, before the canvas is
// mounted, on a throwaway 1×1 canvas that is released immediately — the context
// itself is never used, and holding one open would count against the browser's
// small per-page limit for the renderer that is about to want one.
//
// webgl2 specifically, not webgl: the world's shaders are GLSL3, so a context
// that could only offer WebGL 1 would not fail here — it would fail later, as
// compile errors on every surface, which is the same black rectangle by a
// longer road.
//
// Asked once a page: the answer does not change, and every ask made and threw
// away a context.
let drawable = null;
export function canDraw() {
  if (typeof document === 'undefined') return true;
  if (drawable !== null) return drawable;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    drawable = !!gl;
    // Give it straight back. Under software rendering (the headless captures)
    // this is a real context and does need releasing.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    drawable = false;
  }
  return drawable;
}
