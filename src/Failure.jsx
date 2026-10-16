import { useEffect, useState } from 'react';
import './map.css';
import './failure.css';

// ── When the Library cannot be drawn ─────────────────────────────────────────
// Nothing used to check whether the browser could give us a WebGL2 context, and
// a machine that could not was shown a black rectangle with a working HUD over
// it, the piece silently insisting that everything was fine.
//
// It is fine for this to be plain. What it must not be is blank. It is the
// map's sheet with nothing drawn on it: the map's title block, top left, and
// the fault in the caption's place under it, in the caption's voice.

// The map's portrait break (EntryMap.jsx, TALL_QUERY), where the title is
// centred over the page and the caption stacks under it.
const TALL_QUERY = '(max-aspect-ratio: 1/1)';

function useTall() {
  const [tall, setTall] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(TALL_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(TALL_QUERY);
    const onChange = (e) => setTall(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return tall;
}

const FAULTS = {
  // No WebGL2. Checked BEFORE the canvas is mounted, so this is the one failure
  // the reader meets instead of the map rather than after it.
  webgl: {
    line: 'This browser cannot draw the Library.',
    detail: 'The Library is drawn in WebGL 2. Try a current Chrome, Edge, '
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
    retry: 'Try again',
  },
  // The GPU took the context back and never gave it to us. Common enough on a
  // laptop that sleeps, switches graphics, or is simply asked for more than it
  // has — and this piece asks for a good deal.
  lost: {
    line: 'The light went out.',
    detail: 'The browser reclaimed the graphics context and did not hand it '
      + 'back. Reloading rebuilds the Library.',
    retry: 'Rebuild',
  },
};

export function Failure({ kind, onRetry }) {
  const fault = FAULTS[kind] ?? FAULTS.crash;
  const tall = useTall();
  return (
    <section className={`entry-map is-failure${tall ? ' is-tall' : ''}`} role="alert">
      <div className="map-head">
        <header className="map-title">
          <span className="map-title-rule" aria-hidden="true" />
          <h1 className="map-title-name" lang="es">La Biblioteca de Babel</h1>
          <span className="map-title-rule" aria-hidden="true" />
          <div className="map-title-line">
            <span className="map-title-eyebrow">Jorge Luis Borges · 1941</span>
          </div>
        </header>
        <div className="map-card">
          <p className="map-card-summary">{fault.line}</p>
          <p className="map-card-summary failure-detail">{fault.detail}</p>
          {fault.retry && (
            <button
              type="button"
              className="map-enter"
              onClick={onRetry ?? (() => window.location.reload())}
            >
              {fault.retry}
            </button>
          )}
        </div>
      </div>
    </section>
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
