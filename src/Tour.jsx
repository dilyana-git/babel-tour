// TODO(beauty) — REMAINING PLAN (delete each item when done; see matching
// TODO(beauty-N) comments in DioramaScene.jsx):
//  12. DioramaScene: descent-driven grading — exposure and fog cool/darken toward
//      The Silence, lamp glow shrinks to an ember.
//  13. DioramaScene: postprocessing pass — film grain, soft vignette, high-threshold
//      bloom, god rays from the glowing door. (@react-three/postprocessing installed.)
//  14. DioramaScene/Canvas: powerPreference 'high-performance', fewer plane segments
//      on coarse-pointer devices.
//  15. Convert public/nodes/descent/{color,depth_soft}.png to .webp, update SCENE
//      paths below (color lossy q~88, depth lossless).
//  16. README: describe the actual project + how to add per-chapter artwork
//      (nodes/<slug>/ color+depth pairs — needs new art, stays documented).
import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useProgress } from '@react-three/drei';
import DioramaScene from './DioramaScene';
import TransitionVideo from './TransitionVideo';
import AmbientSound from './ambientSound';

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
      line: '"To speak is to fall into tautology."',
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
      line: '"A sphere whose exact center is any one of its hexagons and whose circumference is inaccessible."',
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
      line: '"The Library is unlimited and cyclical… the same volumes are repeated in the same disorder."',
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

// Renders `render(id)` and, when `id` changes, keeps the outgoing copy mounted
// briefly so it can drift up and out while the new one surfaces from below
// (the camera sinks, so the world moves upward). Layers carry their own id —
// tour.css owns the motion.
function FadeSwap({ id, render }) {
  const [layers, setLayers] = useState(() => [{ id, leaving: false }]);
  useEffect(() => {
    setLayers((prev) => {
      const current = prev.find((l) => !l.leaving);
      if (current && current.id === id) {
        return prev;
      }
      return [{ id, leaving: false }, ...(current ? [{ ...current, leaving: true }] : [])];
    });
    const timer = setTimeout(
      () => setLayers((prev) => prev.filter((l) => !l.leaving)),
      750,
    );
    return () => clearTimeout(timer);
  }, [id]);
  return (
    <div className="swap-stage">
      {layers.map((l) => (
        <div key={l.id} className={l.leaving ? 'swap-leave' : 'swap-enter'}>
          {render(l.id)}
        </div>
      ))}
    </div>
  );
}

// The overture: a title card over black while textures stream in, then an
// invitation. The dismissing click doubles as the user gesture that unlocks audio.
function EntryVeil({ leaving, onEnter }) {
  const { active, progress } = useProgress();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 3500);
    return () => clearTimeout(timer);
  }, []);
  const ready = timedOut || (!active && progress === 100);

  const enter = (event) => {
    event.stopPropagation();
    if (ready) {
      onEnter();
    }
  };
  return (
    <div
      className={`entry-veil${leaving ? ' is-leaving' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Enter the Library"
      onClick={enter}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          enter(event);
        }
      }}
    >
      <div className="entry-eyebrow">J. L. Borges — 1941</div>
      <h1 className="entry-title">La Biblioteca de Babel</h1>
      <div className="entry-rule" />
      <div className="entry-status">
        {ready ? 'Click to descend' : 'The Library is assembling…'}
      </div>
    </div>
  );
}

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
  const [veil, setVeil] = useState('shown'); // 'shown' | 'leaving' | 'gone'
  const [muted, setMuted] = useState(false);

  const enteredRef = useRef(false);
  const audioRef = useRef(null);

  const pointerStart = useRef(null); // { x, y, yaw, swiped }
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
    // A change of destination triggers a video flash + audio swell bridging the move.
    if (Math.round(to) !== Math.round(from) && !reduced) {
      flashStart.current = performance.now();
      if (audioRef.current) {
        audioRef.current.swell();
      }
    }
  }, [reduced]);

  const go = useCallback((dir) => {
    setTarget(Math.round(targetRef.current) + dir);
  }, [setTarget]);

  const jumpTo = useCallback((index) => {
    setTarget(index);
  }, [setTarget]);

  const enter = useCallback(() => {
    enteredRef.current = true;
    if (!audioRef.current) {
      audioRef.current = new AmbientSound();
    }
    audioRef.current.setMuted(muted);
    audioRef.current.start();
    setVeil('leaving');
    setTimeout(() => setVeil('gone'), 1200);
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (audioRef.current) {
        audioRef.current.setMuted(next);
      }
      return next;
    });
  }, []);

  // The single, persistent animation loop. Runs for the component's lifetime —
  // eases descent + accent, updates the progress bar, video flash, and ambience,
  // and only pokes React state when the settled chapter actually changes.
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

      // The soundscape darkens with depth alongside the light.
      if (audioRef.current) {
        audioRef.current.setDescent(MAX ? cur / MAX : 0);
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
      if (!enteredRef.current) {
        return;
      }
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
      if (!enteredRef.current) {
        return;
      }
      setTarget(targetRef.current + Math.sign(event.deltaY) * 0.12);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [setTarget]);

  // Pointer: drag horizontally to pan the gaze in real time; swipe vertically to
  // descend/ascend (the touch path to navigation); a plain click drifts deeper.
  const dragMoved = useRef(false);
  const handlePointerDown = (event) => {
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      yaw: yawTarget.current,
      swiped: false,
    };
    dragMoved.current = false;
  };
  const handlePointerMove = (event) => {
    const start = pointerStart.current;
    if (!start) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragMoved.current = true;
    }
    if (!start.swiped && Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) {
      start.swiped = true;
      go(dy < 0 ? 1 : -1); // swipe up = sink deeper, matching the world moving up
      return;
    }
    // Map full-width drag to the full pan range; dragging right looks right.
    const yaw = start.yaw - (dx / window.innerWidth) * YAW_MAX * 2.2;
    yawTarget.current = Math.min(Math.max(yaw, -YAW_MAX), YAW_MAX);
  };
  const handlePointerUp = () => {
    pointerStart.current = null;
  };
  const handleClick = () => {
    // Only advance if this was a click, not the end of a look-around drag.
    if (enteredRef.current && !dragMoved.current) {
      go(1);
    }
  };

  const node = NODES[chapter];

  return (
    <div
      className="tour-root"
      style={{ '--accent': node.accent }}
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

      <div className="chapter-card">
        <FadeSwap
          id={chapter}
          render={(i) => (
            <>
              <div className="chapter-title">{NODES[i].title}</div>
              <div className="chapter-subtitle">{NODES[i].subtitle}</div>
              <div className="chapter-summary">{NODES[i].summary}</div>
            </>
          )}
        />
      </div>

      <div className="folio">
        <FadeSwap
          id={chapter}
          render={(i) => {
            const words = NODES[i].folio.line.split(' ');
            return (
              <>
                <div className="folio-eyebrow">{NODES[i].folio.eyebrow}</div>
                <div className="folio-line">
                  {words.map((word, w) => (
                    <span
                      key={`${i}-${w}`}
                      className="folio-word"
                      style={{ animationDelay: `${w * 70}ms` }}
                    >
                      {word}
                      {w < words.length - 1 ? ' ' : ''}
                    </span>
                  ))}
                </div>
                <div
                  className="folio-attr folio-word"
                  style={{ animationDelay: `${words.length * 70 + 200}ms` }}
                >
                  {NODES[i].folio.attr}
                </div>
              </>
            );
          }}
        />
      </div>

      <div className="controls">
        <button
          type="button"
          className="pill"
          aria-label="Ascend one gallery"
          onClick={(e) => { e.stopPropagation(); go(-1); }}
          disabled={chapter === 0}
        >
          ↑
        </button>
        <button
          type="button"
          className={`pill${autoplay ? ' is-on' : ''}`}
          aria-label={autoplay ? 'Pause the drift' : 'Drift downward on its own'}
          onClick={(e) => { e.stopPropagation(); setAutoplay((v) => !v); }}
        >
          {autoplay ? 'Pause' : 'Drift'}
        </button>
        <button
          type="button"
          className="pill"
          aria-label="Descend one gallery"
          onClick={(e) => { e.stopPropagation(); go(1); }}
          disabled={chapter === MAX}
        >
          ↓
        </button>
        <button
          type="button"
          className={`pill${muted ? ' is-on' : ''}`}
          aria-label={muted ? 'Unmute the ambience' : 'Mute the ambience'}
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
      </div>

      <div className="depth">
        <div className="depth-label">{`DEPTH ${chapter + 1} / ${NODES.length}`}</div>
        <div className="depth-dots">
          {NODES.map((n, index) => (
            <button
              key={n.slug}
              type="button"
              className={`hex-btn${index === chapter ? ' is-active' : ''}`}
              onClick={(e) => { e.stopPropagation(); jumpTo(index); }}
              aria-label={`Descend to ${n.slug}`}
            >
              <span className="hex" />
            </button>
          ))}
        </div>
      </div>

      {showHelp && (
        <div className="help-overlay">
          <div className="help-panel">
            <div className="help-title">Navigation help</div>
            <div className="help-body">
              • Scroll, ↑ / ↓, or space descend and rise through the archive<br />
              • ← / → or drag horizontally to look around the space<br />
              • Swipe up or down to move between galleries on touch screens<br />
              • Click to drift one gallery deeper<br />
              • Press H to hide or show this guide<br />
              • Use the depth hexagons for direct jumps
            </div>
            <button
              type="button"
              className="help-close"
              onClick={(e) => { e.stopPropagation(); setShowHelp(false); }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="progress">
        <div className="progress-track">
          <div ref={barRef} className="progress-fill" />
        </div>
        <div className="progress-label">Descending</div>
      </div>

      {veil !== 'gone' && <EntryVeil leaving={veil === 'leaving'} onEnter={enter} />}
    </div>
  );
}
