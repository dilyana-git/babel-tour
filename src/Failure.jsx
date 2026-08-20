import React from 'react';

// ── When the Library cannot be drawn ─────────────────────────────────────────
// There was no failure path at all. Nothing checked whether the browser could
// give us a WebGL2 context, nothing caught a throw out of the scene tree, and
// nothing listened for the context being taken back — while the entry veil let
// the reader through on a timeout regardless of what was behind it. All three
// ended the same way: a black rectangle with a working HUD over it, the piece
// silently insisting that everything was fine.
//
// It is fine for this to be plain. What it must not be is blank.

// The overture's own poster (see OVERTURE_POSTER in Tour). Using it here means
// a reader who cannot be shown the diorama is at least shown the picture the
// title card was already going to show them, and the fallback needs no visual
// language of its own — it is the entry veil with a different last line.
const POSTER = '/overture-poster.jpg';

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
  // Something threw inside the scene tree — a plate that will not decode, a
  // shader the driver refuses, a three version disagreeing with itself.
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
// webgl2 specifically, not webgl: the paintings sample an explicit LOD
// (textureLod, GLSL3) and the slab stacks are built on it, so a context that
// could only offer WebGL 1 would not fail here — it would fail later, as
// compile errors on every surface, which is the same black rectangle by a
// longer road.
export function canDraw() {
  if (typeof document === 'undefined') return true;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return false;
    // Give it straight back. Under software rendering (the headless captures)
    // this is a real context and does need releasing.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// One boundary around the scene tree. React unmounts everything up to the
// nearest boundary when a render throws, and there was none — so a single bad
// plate took the whole page, HUD and all, down to a white screen with a stack
// trace in the console.
//
// It reports rather than renders: the fallback belongs to Tour, which knows
// whether the ambience is running and has to stop it. `fallback` is what stands
// in the tree's place in the meantime (null, for the scene — Tour is about to
// replace the whole page anyway).
export class SceneBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // The console line IS the deliverable here — this is the one place the
    // reason survives, and without it the failure is indistinguishable from a
    // scene that simply never rendered.
    console.error('[scene] the diorama threw and was taken down:', error,
      info?.componentStack ?? '');
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

// The same, for ONE gallery's plates. A missing or undecodable image makes
// useTexture throw out of Suspense, and with a single boundary around the whole
// tree that costs the reader the entire corridor — eight galleries dark because
// one .webp 404'd. Here it costs the one gallery, which goes quietly empty
// while the walk continues through it.
export class PlateBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[plate] gallery %s could not be hung (%s) — the corridor '
      + 'keeps walking through an empty room:', this.props.name ?? '?',
      error?.message ?? error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
