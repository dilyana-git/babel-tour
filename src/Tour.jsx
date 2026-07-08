import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import DioramaScene from './DioramaScene';
import TransitionVideo from './TransitionVideo';

const NODES = [
  {
    slug: 'descent',
    title: 'The Descent',
    subtitle: 'Threshold of the archive',
    summary: 'A slow entry into the stack, where each corridor seems to breathe with memory.',
    accent: '#c9a24c',
    folio: {
      eyebrow: 'NODE I — THE DESCENT',
      line: '"The universe (which others call the Library)…"',
      attr: 'J. L. BORGES — LA BIBLIOTECA DE BABEL, 1941',
    },
  },
  {
    slug: 'echo',
    title: 'The Echo',
    subtitle: 'A corridor of repeated forms',
    summary: 'The scene tilts inward as the fog gathers and the path becomes less certain.',
    accent: '#d7b26d',
    folio: {
      eyebrow: 'NODE II — THE ECHO',
      line: '"Every book is a mirror of the impossible order that surrounds us."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
    },
  },
  {
    slug: 'hexagon',
    title: 'The Hexagon',
    subtitle: 'Geometry in the dark',
    summary: 'The camera slips toward a wider geometry, framing the archive like a ritual chamber.',
    accent: '#f0dba1',
    folio: {
      eyebrow: 'NODE III — THE HEXAGON',
      line: '"The Library is composed of an indefinite number of hexagonal galleries."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
    },
  },
  {
    slug: 'return',
    title: 'The Return',
    subtitle: 'A closing of the loop',
    summary: 'The passage narrows once more, and the archive opens like a hand closing around light.',
    accent: '#e2c17a',
    folio: {
      eyebrow: 'NODE IV — THE RETURN',
      line: '"And if the Library exists, then every path returns to its own beginning."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
    },
  },
  {
    slug: 'vertigo',
    title: 'The Vertigo',
    subtitle: 'Shelves without end',
    summary: 'The eye falls through gallery after gallery, and the count of the books refuses to close.',
    accent: '#b98a3e',
    folio: {
      eyebrow: 'NODE V — THE VERTIGO',
      line: '"The certitude that everything has been written negates us or turns us into phantoms."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
    },
  },
  {
    slug: 'silence',
    title: 'The Silence',
    subtitle: 'Where the lamps grow faint',
    summary: 'At the deepest reach the air stills, and only a distant gold remains to mark the way.',
    accent: '#8f6f3a',
    folio: {
      eyebrow: 'NODE VI — THE SILENCE',
      line: '"Light is provided by spherical fruit which bear the name of lamps."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
    },
  },
];

const SCENE = {
  color: '/nodes/descent/color.png',
  depth: '/nodes/descent/depth_soft.png',
};

const MAX = NODES.length - 1;
const clamp = (v) => Math.min(Math.max(v, 0), MAX);

// Pre-parse accent colors once for continuous interpolation between chapters.
const ACCENTS = NODES.map((n) => new THREE.Color(n.accent));

export default function Tour() {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Live, render-free state driving the persistent canvas.
  const descentRef = useRef(0);   // current camera depth (float)
  const targetRef = useRef(0);    // where we're easing toward
  const accentRef = useRef(ACCENTS[0].clone());
  const barRef = useRef(null);    // progress bar fill (mutated directly)
  const settledRef = useRef(0);   // last chapter the camera settled on

  // React state only for the HUD chrome — updates rarely (on chapter change).
  const [chapter, setChapter] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [videoFlash, setVideoFlash] = useState(0); // 0..1 flash envelope

  const pointerStartX = useRef(null);
  const pointerStartYaw = useRef(0);
  const flashStart = useRef(0);

  // Horizontal look-around. `yawRef` is the live gaze angle (radians); `yawTarget`
  // is where we're panning toward. Left/right pan the view without moving. The range
  // is small — the relief fills the frame, so a gentle pan surveys within it rather
  // than swinging off its edge into the surrounding dark.
  const yawRef = useRef(0);
  const yawTarget = useRef(0);
  const YAW_MAX = 0.16; // ~9deg either side — a subtle survey, never off the image

  const panYaw = useCallback((delta) => {
    yawTarget.current = Math.min(Math.max(yawTarget.current + delta, -YAW_MAX), YAW_MAX);
  }, []);

  const setTarget = useCallback((next) => {
    const to = clamp(next);
    const from = targetRef.current;
    targetRef.current = to;
    // A change of destination triggers a video flash bridging the move.
    if (Math.round(to) !== Math.round(from) && !reduced) {
      flashStart.current = performance.now();
    }
  }, [reduced]);

  const go = useCallback((dir) => {
    setTarget(Math.round(targetRef.current) + dir);
  }, [setTarget]);

  const jumpTo = useCallback((index) => {
    setTarget(index);
  }, [setTarget]);

  // The single, persistent animation loop. Runs for the component's lifetime —
  // eases descent + accent, updates the progress bar and video flash, and only
  // pokes React state when the settled chapter actually changes.
  useEffect(() => {
    let frame;
    const tick = () => {
      const d = descentRef.current;
      const t = targetRef.current;
      // Very slow ease toward the target depth — a long, meditative glide, so a
      // full chapter move unfolds over many seconds rather than a quick lurch.
      descentRef.current = Math.abs(t - d) < 0.0004 ? t : d + (t - d) * 0.012;
      const cur = descentRef.current;

      // Look-around: gaze eases toward its target, which itself drifts slowly back
      // to center — so the view always settles to facing down the corridor.
      yawTarget.current += (0 - yawTarget.current) * 0.004;
      yawRef.current += (yawTarget.current - yawRef.current) * 0.03;

      // Interpolate accent between the two bracketing chapters.
      const lo = Math.floor(cur);
      const hi = Math.min(lo + 1, MAX);
      accentRef.current.copy(ACCENTS[lo]).lerp(ACCENTS[hi], cur - lo);

      // Progress bar, updated by direct DOM write (no React render).
      if (barRef.current) {
        barRef.current.style.width = `${(cur / (MAX || 1)) * 100}%`;
      }

      // Video dissolve phase: linear 0->1 over ~4s; TransitionVideo shapes a slow,
      // faint bloom that lingers softly rather than a bright pulse.
      if (flashStart.current) {
        const age = (performance.now() - flashStart.current) / 4000;
        if (age >= 1) {
          flashStart.current = 0;
          setVideoFlash(0);
        } else {
          setVideoFlash(age);
        }
      }

      // Update HUD chapter when we cross a rounded boundary.
      const nearest = Math.round(cur);
      if (nearest !== settledRef.current) {
        settledRef.current = nearest;
        setChapter(nearest);
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Autoplay: drift forward, loop back to the top at the end.
  useEffect(() => {
    if (!autoplay || NODES.length <= 1) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      const atEnd = Math.round(targetRef.current) >= MAX;
      setTarget(atEnd ? 0 : Math.round(targetRef.current) + 1);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [autoplay, setTarget]);

  // Keyboard: Up/Down + Space move deeper/shallower; Left/Right pan the gaze.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setShowHelp((v) => !v);
        return;
      }
      if (['ArrowDown', ' '].includes(event.key)) {
        event.preventDefault();
        go(1);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        go(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        panYaw(0.05);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        panYaw(-0.05);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, panYaw]);

  // Scroll wheel nudges descent gently — small increments, so the glide stays calm.
  useEffect(() => {
    const onWheel = (event) => {
      event.preventDefault();
      setTarget(targetRef.current + Math.sign(event.deltaY) * 0.12);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [setTarget]);

  // Drag horizontally to pan the gaze in real time; a plain click goes deeper.
  const dragMoved = useRef(false);
  const handlePointerDown = (event) => {
    pointerStartX.current = event.clientX;
    pointerStartYaw.current = yawTarget.current;
    dragMoved.current = false;
  };
  const handlePointerMove = (event) => {
    if (pointerStartX.current === null) {
      return;
    }
    const delta = event.clientX - pointerStartX.current;
    if (Math.abs(delta) > 4) {
      dragMoved.current = true;
    }
    // Map full-width drag to the full pan range; dragging right looks right.
    const yaw = pointerStartYaw.current - (delta / window.innerWidth) * YAW_MAX * 2.2;
    yawTarget.current = Math.min(Math.max(yaw, -YAW_MAX), YAW_MAX);
  };
  const handlePointerUp = () => {
    pointerStartX.current = null;
  };
  const handleClick = () => {
    // Only advance if this was a click, not the end of a look-around drag.
    if (!dragMoved.current) {
      go(1);
    }
  };

  const node = NODES[chapter];
  const accent = node.accent;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#15120d', overflow: 'hidden' }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <DioramaScene
        color={SCENE.color}
        depth={SCENE.depth}
        chapters={NODES.length}
        descentRef={descentRef}
        accentRef={accentRef}
        yawRef={yawRef}
        reduced={reduced}
      />

      <TransitionVideo active={videoFlash > 0.001} progress={videoFlash} reduced={reduced} />

      {/* Chapter card (top-left) */}
      <div style={{
        position: 'fixed', left: '2rem', top: '2rem', zIndex: 35,
        maxWidth: '22rem', padding: '1rem 1.1rem', borderRadius: '1rem',
        background: 'rgba(12, 10, 8, 0.72)', border: `1px solid ${accent}47`,
        backdropFilter: 'blur(12px)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.28)',
        transition: 'border-color 600ms ease',
      }}>
        <div style={{
          font: "400 0.67rem/1 'IBM Plex Mono', monospace",
          letterSpacing: '0.24em', color: accent, textTransform: 'uppercase', marginBottom: '0.45rem',
          transition: 'color 600ms ease',
        }}>
          {node.title}
        </div>
        <div style={{
          font: "italic 500 1.15rem/1.35 'Cormorant Garamond', serif",
          color: '#ece4d2', marginBottom: '0.45rem',
        }}>
          {node.subtitle}
        </div>
        <div style={{
          font: "400 0.8rem/1.6 'IBM Plex Mono', monospace",
          color: '#a89c82',
        }}>
          {node.summary}
        </div>
      </div>

      {/* Folio (bottom-left) */}
      <div style={{
        position: 'fixed', left: '2.2rem', bottom: '4.5rem',
        maxWidth: '30rem', pointerEvents: 'none', zIndex: 35,
      }}>
        <div style={{
          font: "400 0.66rem/1 'IBM Plex Mono', monospace",
          letterSpacing: '0.22em', color: accent, marginBottom: '0.7rem',
          transition: 'color 600ms ease',
        }}>{node.folio.eyebrow}</div>
        <div style={{
          font: "italic 500 1.35rem/1.5 'Cormorant Garamond', serif",
          color: '#ece4d2',
        }}>{node.folio.line}</div>
        <div style={{
          font: "400 0.62rem/1 'IBM Plex Mono', monospace",
          letterSpacing: '0.18em', color: '#a89c82', marginTop: '0.55rem',
        }}>{node.folio.attr}</div>
      </div>

      {/* Controls (top-right) */}
      <div style={{
        position: 'fixed', inset: '1.25rem 1.25rem auto auto', zIndex: 40,
        display: 'flex', gap: '0.75rem', pointerEvents: 'none',
      }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); go(-1); }}
          disabled={chapter === 0}
          style={{
            pointerEvents: 'auto', border: '1px solid rgba(201, 162, 76, 0.35)',
            background: 'rgba(21, 18, 13, 0.82)', color: '#ece4d2', padding: '0.65rem 0.9rem',
            borderRadius: '999px', cursor: chapter === 0 ? 'not-allowed' : 'pointer',
            opacity: chapter === 0 ? 0.55 : 1,
          }}
        >
          ←
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setAutoplay((v) => !v); }}
          style={{
            pointerEvents: 'auto', border: '1px solid rgba(201, 162, 76, 0.35)',
            background: autoplay ? 'rgba(201, 162, 76, 0.2)' : 'rgba(21, 18, 13, 0.82)',
            color: '#ece4d2', padding: '0.65rem 0.9rem', borderRadius: '999px', cursor: 'pointer',
          }}
        >
          {autoplay ? 'Pause' : 'Descend'}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); go(1); }}
          disabled={chapter === MAX}
          style={{
            pointerEvents: 'auto', border: '1px solid rgba(201, 162, 76, 0.35)',
            background: 'rgba(21, 18, 13, 0.82)', color: '#ece4d2', padding: '0.65rem 0.9rem',
            borderRadius: '999px', cursor: chapter === MAX ? 'not-allowed' : 'pointer',
            opacity: chapter === MAX ? 0.55 : 1,
          }}
        >
          →
        </button>
      </div>

      {/* Chapter dots (bottom-left, above folio) */}
      <div style={{
        position: 'fixed', left: '2rem', bottom: '2rem', zIndex: 40,
        display: 'flex', flexDirection: 'column', gap: '0.6rem', pointerEvents: 'none',
      }}>
        <div style={{
          font: "400 0.66rem/1 'IBM Plex Mono', monospace",
          letterSpacing: '0.22em', color: accent, textTransform: 'uppercase',
          transition: 'color 600ms ease',
        }}>
          {`DEPTH ${chapter + 1} / ${NODES.length}`}
        </div>
        <div style={{ display: 'flex', gap: '0.45rem' }}>
          {NODES.map((n, index) => (
            <button
              key={n.slug}
              type="button"
              onClick={(e) => { e.stopPropagation(); jumpTo(index); }}
              style={{
                pointerEvents: 'auto', width: '0.8rem', height: '0.8rem', padding: 0,
                borderRadius: '999px',
                border: index === chapter ? `1px solid ${accent}` : '1px solid rgba(236,228,210,0.24)',
                background: index === chapter ? accent : 'rgba(236,228,210,0.16)',
                cursor: 'pointer', transition: 'background 400ms ease, border-color 400ms ease',
              }}
              aria-label={`Descend to ${n.slug}`}
            />
          ))}
        </div>
      </div>

      {showHelp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 45, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(8, 8, 8, 0.64)', backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: 'min(32rem, calc(100vw - 2rem))', borderRadius: '1rem', background: 'rgba(21, 18, 13, 0.95)',
            border: '1px solid rgba(201, 162, 76, 0.3)', padding: '1.25rem 1.35rem', color: '#ece4d2',
          }}>
            <div style={{ font: "400 0.7rem/1 'IBM Plex Mono', monospace", letterSpacing: '0.26em', color: '#c9a24c', marginBottom: '0.7rem', textTransform: 'uppercase' }}>
              Navigation help
            </div>
            <div style={{ font: "400 0.95rem/1.6 'IBM Plex Mono', monospace", color: '#ece4d2' }}>
              • Scroll, ↑ / ↓, or space descend and rise through the archive<br />
              • ← / → or drag horizontally to look around the space<br />
              • Click to drift one gallery deeper<br />
              • Press H to hide or show this guide<br />
              • Use the depth dots for direct jumps
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowHelp(false); }}
              style={{ marginTop: '1rem', border: '1px solid rgba(201, 162, 76, 0.36)', background: 'rgba(201, 162, 76, 0.16)', color: '#ece4d2', padding: '0.6rem 0.9rem', borderRadius: '999px', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Depth progress bar (bottom) */}
      <div style={{
        position: 'fixed', left: '2rem', right: '2rem', bottom: '1rem', zIndex: 40,
        display: 'flex', alignItems: 'center', gap: '0.8rem', pointerEvents: 'none',
      }}>
        <div style={{
          flex: 1, height: '0.18rem', borderRadius: '999px', background: 'rgba(168,156,130,0.24)', overflow: 'hidden',
        }}>
          <div ref={barRef} style={{
            width: '0%', height: '100%',
            background: 'linear-gradient(90deg, #c9a24c, #ece4d2)',
          }} />
        </div>
        <div style={{
          font: "400 0.66rem/1 'IBM Plex Mono', monospace",
          letterSpacing: '0.16em', color: '#a89c82', textTransform: 'uppercase',
        }}>
          Descending
        </div>
      </div>
    </div>
  );
}
