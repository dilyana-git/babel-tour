// TODO(beauty) — REMAINING PLAN (delete each item when done; see matching
// TODO(beauty-N) comments in DioramaScene.jsx):
//  13. DioramaScene: postprocessing pass — film grain, soft vignette, high-threshold
//      bloom. (@react-three/postprocessing installed.)
//  14. DioramaScene/Canvas: powerPreference 'high-performance', fewer plane segments
//      on coarse-pointer devices.
//  16. README: describe the actual project + how to add per-chapter artwork
//      (nodes/<slug>/ color+depth pairs — needs new art, stays documented).
import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useProgress } from '@react-three/drei';
import DioramaScene from './DioramaScene';
import AmbientSound from './ambientSound';

// Two worlds on one corridor. Each node owns its relief (color + depth pair),
// the [u, v] anchor of its light source (where the lamp glow hangs), its fog
// mood, and its accent — so descending re-grades the whole world, not just the
// picture. The library's four galleries come first; dwelling in the deepest
// one opens a door onto the garden's four paths (see GARDEN.md).
const LIBRARY_NODES = [
  {
    slug: 'vestibule',
    title: 'The Vestibule',
    subtitle: 'Threshold of the archive',
    summary: 'Twin stairways rise into the dark, chains hang like plumb lines, and one robed reader waits at the door of fire.',
    accent: '#c9a24c',
    scene: {
      color: '/nodes/descent/impossible_1.webp',
      depth: '/nodes/descent/impossible_1_depth.webp',
      glowAt: [0.515, 0.84],
      glowScale: 0.85,
      fog: '#16110a',
      // Walking into the Vestibule climbs its twin stairways: the camera gains
      // this much height across the full walk-in, footfalls riding the rise.
      climb: 2.6,
    },
    folio: {
      eyebrow: 'NODE I — THE VESTIBULE',
      line: '"The universe (which others call the Library)…"',
      attr: 'J. L. BORGES — LA BIBLIOTECA DE BABEL, 1941',
    },
  },
  {
    slug: 'echo',
    title: 'The Echo',
    subtitle: 'A corridor of repeated forms',
    summary: 'Stairs cross stairs and arcades answer arcades — every passage insists it has been walked before.',
    accent: '#d9b06a',
    scene: {
      color: '/nodes/descent/impossible_2.webp',
      depth: '/nodes/descent/impossible_2_depth.webp',
      glowAt: [0.655, 0.72],
      glowScale: 1.0,
      fog: '#141009',
      // The Echo's crossing stairs lift the walk-in too, more gently.
      climb: 1.4,
    },
    folio: {
      eyebrow: 'NODE II — THE ECHO',
      line: '"To speak is to fall into tautology."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
    },
  },
  {
    slug: 'silence',
    title: 'The Silence',
    subtitle: 'Where the lamps grow faint',
    summary: 'At the deepest reach the stairways still their crossing, and a single lamp keeps the dark honest.',
    accent: '#c98a3e',
    scene: {
      color: '/nodes/descent/impossible_4.webp',
      depth: '/nodes/descent/impossible_4_depth.webp',
      glowAt: [0.57, 0.86],
      glowScale: 0.8,
      fog: '#0f0d0b',
    },
    folio: {
      eyebrow: 'NODE III — THE SILENCE',
      line: '"Light is provided by spherical fruit which bear the name of lamps."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
    },
  },
  // The threshold. The vortex is the last gallery: dwell here and its warm
  // tunnel core (lower-right) kindles into a portal; descending then plunges
  // the camera down the spiral and out into the garden (see the dive in
  // DioramaScene's DescentRig). glowAt is pinned to that receding core.
  {
    slug: 'vertigo',
    title: 'The Vertigo',
    subtitle: 'The stairwell that has no floor',
    summary: 'The galleries curl into a spiral pit that winds down toward a single warm light, and the count of the books refuses to close.',
    accent: '#c9a24c',
    scene: {
      color: '/nodes/descent/impossible_3.webp',
      depth: '/nodes/descent/impossible_3_depth.webp',
      glowAt: [0.83, 0.82],
      glowScale: 1.3,
      fog: '#0b0f15',
    },
    folio: {
      eyebrow: 'NODE IV — THE VERTIGO',
      line: '"The certitude that everything has been written negates us or turns us into phantoms."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
    },
  },
];

// The garden — Borges' other 1941 labyrinth, from the collection that gave
// the Library its home. Warm amber cools into jade, flares gold once at the
// pavilion, then dissolves into moon-silver.
//
// Each node offers several Midjourney variants; one is drawn per page load.
// A variant's `videos` are image-to-video renders OF THAT EXACT ARTWORK —
// when the camera dwells at the node, DioramaScene crossfades the relief's
// surface from the still to its playing video, so the world itself stirs
// (matched by content, not filename: the "library_*.mp4" clips are all Door
// artwork and must never play elsewhere).
const GARDEN_NODE_VARIANTS = {
  door: {
    title: 'The Door',
    subtitle: 'One volume was a gate',
    summary: 'Between two shelves the stone gives way; beyond the jamb, hedges breathe under a green moon.',
    accent: '#9fc48a',
    variants: [
      {
        color: '/nodes/garden/04-gothic-library-var0.webp',
        depth: '/nodes/garden/04-gothic-library-var0-depth.webp',
        videos: ['/video/04-gothic-library-var0-clip1.mp4', '/video/04-gothic-library-var0-clip2.mp4'],
        glowAt: [0.5, 0.45], glowScale: 1.1,
      },
      {
        color: '/nodes/garden/04-gothic-library-var2.webp',
        depth: '/nodes/garden/04-gothic-library-var2-depth.webp',
        videos: ['/video/04-gothic-library-var2-clip1.mp4'],
        glowAt: [0.47, 0.7], glowScale: 0.9,
      },
      {
        color: '/nodes/garden/04-gothic-library-var3.webp',
        depth: '/nodes/garden/04-gothic-library-var3-depth.webp',
        videos: ['/video/04-gothic-library-var3-clip1.mp4', '/video/04-gothic-library-var3-clip2.mp4'],
        glowAt: [0.49, 0.5], glowScale: 1.0,
      },
    ],
    fog: '#0b1209',
    folio: {
      eyebrow: 'NODE V — THE DOOR',
      line: '"I leave to the various futures (not to all) my garden of forking paths."',
      attr: 'J. L. BORGES — THE GARDEN OF FORKING PATHS, 1941',
    },
  },
  fork: {
    title: 'The Fork',
    subtitle: 'Every path taken at once',
    summary: 'The pale gravel divides and divides again, and each branch insists it is the one you chose.',
    accent: '#7fbf8e',
    variants: [
      {
        color: '/nodes/garden/01-moonlit-labyrinth-var1.webp',
        depth: '/nodes/garden/01-moonlit-labyrinth-var1-depth.webp',
        videos: ['/video/01-moonlit-labyrinth-var1-clip2.mp4'],
        glowAt: [0.74, 0.55], glowScale: 0.85,
      },
      {
        color: '/nodes/garden/01-moonlit-labyrinth-var2.webp',
        depth: '/nodes/garden/01-moonlit-labyrinth-var2-depth.webp',
        videos: ['/video/01-moonlit-labyrinth-var2-clip1.mp4', '/video/01-moonlit-labyrinth-var2-clip2.mp4', '/video/01-moonlit-labyrinth-var2-clip3.mp4', '/video/01-moonlit-labyrinth-var2-clip4.mp4'],
        glowAt: [0.585, 0.56], glowScale: 0.9,
      },
    ],
    fog: '#0a140d',
    folio: {
      eyebrow: 'NODE VI — THE FORK',
      line: '"In the fiction of Ts\'ui Pên, he chooses — simultaneously — all of them."',
      attr: 'J. L. BORGES — THE GARDEN OF FORKING PATHS',
    },
  },
  pavilion: {
    title: 'The Pavilion',
    subtitle: 'Where the lamp keeps every future',
    summary: 'Over black water a single pavilion burns warm, and its music seems to arrive from all your lives at once.',
    accent: '#e0b45c',
    variants: [
      {
        color: '/nodes/garden/03-solitary-pavilion-var0.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var0-depth.webp',
        videos: ['/video/03-solitary-pavilion-var0-clip0.mp4', '/video/03-solitary-pavilion-var0-clip1.mp4', '/video/03-solitary-pavilion-var0-clip2.mp4'],
        glowAt: [0.5, 0.55], glowScale: 1.15,
      },
      {
        color: '/nodes/garden/03-solitary-pavilion-var1.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var1-depth.webp',
        videos: ['/video/03-solitary-pavilion-var1-clip0.mp4'],
        glowAt: [0.56, 0.55], glowScale: 1.1,
      },
      {
        color: '/nodes/garden/03-solitary-pavilion-var2.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var2-depth.webp',
        videos: ['/video/03-solitary-pavilion-var2-clip0.mp4', '/video/03-solitary-pavilion-var2-clip1.mp4'],
        glowAt: [0.3, 0.52], glowScale: 1.0,
      },
      {
        color: '/nodes/garden/03-solitary-pavilion-var3.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var3-depth.webp',
        videos: ['/video/03-solitary-pavilion-var3-clip0.mp4', '/video/03-solitary-pavilion-var3-clip1.mp4', '/video/03-solitary-pavilion-var3-clip3.mp4'],
        glowAt: [0.55, 0.55], glowScale: 1.1,
      },
    ],
    fog: '#0d1309',
    folio: {
      eyebrow: 'NODE VII — THE PAVILION',
      line: '"The Garden of Forking Paths is an enormous riddle, or parable, whose theme is time."',
      attr: 'J. L. BORGES — THE GARDEN OF FORKING PATHS',
    },
  },
  web: {
    title: 'The Web of Time',
    subtitle: 'Strands that bifurcate and ignore each other',
    summary: 'The paths stop pretending to be paths: in every direction you are already walking, choosing otherwise.',
    accent: '#a9c9d8',
    variants: [
      {
        color: '/nodes/garden/02-endless-garden-starry-var1.webp',
        depth: '/nodes/garden/02-endless-garden-starry-var1-depth.webp',
        videos: ['/video/02-endless-garden-starry-var1-clip1.mp4', '/video/02-endless-garden-starry-var1-clip2.mp4'],
        glowAt: [0.48, 0.31], glowScale: 0.7,
      },
      // var2 pulled from rotation: the still is only 1680×720 (missed the MJ
      // upscale step). Restore once re-exported at 3376×1440 with a fresh depth map.
    ],
    fog: '#0c1114',
    folio: {
      eyebrow: 'NODE VIII — THE WEB OF TIME',
      line: '"This web of time — the strands of which approach one another, bifurcate, intersect or ignore each other — embraces every possibility."',
      attr: 'J. L. BORGES — THE GARDEN OF FORKING PATHS',
    },
  },
};

// Per-clip playback rate. Every source .mp4 is 5.21s; slowing a clip stretches
// its single awakening pass into a longer, more dreamlike drift (the still
// settles whenever the pass truly ends, so this just lengthens the motion).
// Clips omitted here fall back to VIDEO_RATE_DEFAULT. The hero, contemplative
// shots run slowest. At these rates the garden's surfaces breathe for ~11–13s
// before settling, so the motion carries the whole dwell rather than a brief
// flicker at the top of it.
const VIDEO_RATE_DEFAULT = 0.42; // → ~12.4s per pass
const VIDEO_RATE = {
  '/video/04-gothic-library-var2-clip1.mp4': 0.38,  // the lone reader before the far moon → ~13.7s
  '/video/04-gothic-library-var3-clip1.mp4': 0.42,  // grand candlelit hall reveal → ~12.4s
  '/video/04-gothic-library-var3-clip2.mp4': 0.42,
  '/video/02-endless-garden-starry-var2-clip1.mp4': 0.38,   // starry delta, ghost figures → ~13.7s
  '/video/02-endless-garden-starry-var1-clip1.mp4': 0.38,
  '/video/02-endless-garden-starry-var1-clip2.mp4': 0.38,
  '/video/01-moonlit-labyrinth-var2-clip3.mp4': 0.42, // the wide 1080p labyrinth → ~12.4s
};

const selectRandomVariant = (slug) => {
  const node = GARDEN_NODE_VARIANTS[slug];
  const variant = node.variants[Math.floor(Math.random() * node.variants.length)];
  const video = variant.videos
    ? variant.videos[Math.floor(Math.random() * variant.videos.length)]
    : undefined;
  return {
    slug,
    title: node.title,
    subtitle: node.subtitle,
    summary: node.summary,
    accent: node.accent,
    scene: {
      color: variant.color,
      depth: variant.depth,
      glowAt: variant.glowAt,
      glowScale: variant.glowScale,
      video,
      videoRate: video ? (VIDEO_RATE[video] ?? VIDEO_RATE_DEFAULT) : undefined,
      fog: node.fog,
    },
    folio: node.folio,
  };
};

const GARDEN_NODES = ['door', 'fork', 'pavilion', 'web'].map(selectRandomVariant);

const GARDEN_ART_READY = true;

const NODES = [
  ...LIBRARY_NODES,
  ...GARDEN_NODES.map((node, i) => (GARDEN_ART_READY ? node : {
    ...node,
    scene: { ...LIBRARY_NODES[i].scene, fog: node.scene.fog },
  })),
];

const LIBRARY_MAX = LIBRARY_NODES.length - 1;
const MAX = NODES.length - 1;
const clamp = (v, max) => Math.min(Math.max(v, 0), max);
const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

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
      1200,
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
    // Four galleries' worth of textures stream in behind the veil; give them a
    // generous window before letting an impatient reader through regardless.
    const timer = setTimeout(() => setTimedOut(true), 15000);
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
        {ready
          ? 'Click to descend'
          : `The Library is assembling… ${Math.min(99, Math.round(progress))}%`}
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
  const velRef = useRef(0);       // descent velocity (spring integration)
  // Immersion: how far the camera has walked INTO the gallery it dwells before
  // (0 = at the mouth, 1 = pressed deep among its cards). Separate from descent,
  // so stepping in parallaxes the slab stack without dissolving the veil. The
  // forward gesture fills this first and only rolls on to the next chapter once
  // it tops out.
  const immersionRef = useRef(0);
  const immersionTargetRef = useRef(0);
  const accentRef = useRef(ACCENTS[0].clone());
  const barRef = useRef(null);    // progress bar fill (mutated directly)
  const settledRef = useRef(0);   // last chapter the camera settled on
  // The vortex dive: 0 while in the library, ramping 0→1 across the single
  // crossing from the vortex (deepest gallery) into the garden. It drives the
  // camera's spin + core-aim in DioramaScene and the warm whiteout that covers
  // the hand-off. flashRef is that overlay, opacity written straight to the DOM.
  const diveRef = useRef(0);
  const flashRef = useRef(null);
  // The dive is paced by its own clock, not the depth spring — a long, deliberate
  // fall you can watch, rather than a ~2s whoosh. Holds { start } while a plunge
  // is underway, then hands the camera back to the spring, settled in the garden.
  const diveAnimRef = useRef(null);
  const DIVE_MS = 5200; // wall-clock length of the plunge down the spiral

  // React state only for the HUD chrome — updates rarely (on chapter change).
  const [chapter, setChapter] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [veil, setVeil] = useState('shown'); // 'shown' | 'leaving' | 'gone'
  const [muted, setMuted] = useState(false);
  // One-time navigation hint: surfaces after the veil lifts, leaves on the
  // reader's first move (or after a generous while, unprompted).
  const [hint, setHint] = useState('pending'); // 'pending' | 'shown' | 'gone'
  // True for the length of the vortex plunge: the beckon unmounts and the whole
  // HUD fades out, so nothing man-made rides along on the fall.
  const [isDiving, setIsDiving] = useState(false);

  // The door to the garden. Sealed until the reader has dwelled in The
  // Silence for a few breaths; once open it stays open. The ref mirrors the
  // state for the render-free tick and input callbacks.
  const [doorOpen, setDoorOpen] = useState(false);
  const doorOpenRef = useRef(false);
  // The reachable end of the corridor, eased — when the door opens, the
  // progress bar relaxes from "journey complete" back to "the road goes on".
  const unlockedEased = useRef(LIBRARY_MAX);

  const enteredRef = useRef(false);
  const audioRef = useRef(null);

  const pointerStart = useRef(null); // { x, y, yaw, pitch, swiped }

  // Free look-around. `yawRef`/`pitchRef` are the live gaze angles (radians);
  // the *Target refs are where we're panning toward. Yaw surveys left/right,
  // pitch tilts the gaze up/down — neither moves the body. The cards wrap
  // sideways and mirror vertically past their edges (with a fog dissolve), so
  // the ranges can be generous without ever swinging into raw dark.
  const yawRef = useRef(0);
  const yawTarget = useRef(0);
  const pitchRef = useRef(0);
  const pitchTarget = useRef(0);
  const YAW_MAX = 0.34;   // ~19deg either side
  const PITCH_MAX = 0.24; // ~14deg up or down

  const panGaze = useCallback((dYaw, dPitch = 0) => {
    yawTarget.current = Math.min(Math.max(yawTarget.current + dYaw, -YAW_MAX), YAW_MAX);
    pitchTarget.current = Math.min(Math.max(pitchTarget.current + dPitch, -PITCH_MAX), PITCH_MAX);
  }, []);

  // Commit the vortex dive: a slow, watchable plunge down the spiral toward the
  // core light, then a warm flood and out into the garden. Paced by its own clock
  // in the tick (diveAnimRef); the plunge/spin/aim + flash ride on top there.
  // `dest` is where the fall ultimately lands — the first garden node by default;
  // a deeper hex-jump lands there first, then springs on to its chosen node.
  const dive = useCallback((dest = LIBRARY_MAX + 1) => {
    if (diveAnimRef.current) return; // already falling
    immersionTargetRef.current = 0;
    immersionRef.current = 0;
    velRef.current = 0;
    targetRef.current = LIBRARY_MAX + 1;
    diveAnimRef.current = { start: performance.now(), then: dest };
    setIsDiving(true);
    if (!reduced && audioRef.current) {
      // The dive's rush: builds for most of the fall and crests with the
      // whiteout (~el 0.65 of DIVE_MS), then releases into the garden's air.
      audioRef.current.swell(3.4, 0.085, 1.3);
    }
  }, [reduced]);

  const setTarget = useCallback((next) => {
    const to = clamp(next, doorOpenRef.current ? MAX : LIBRARY_MAX);
    const from = targetRef.current;
    // Any downward crossing of the library→garden threshold is ALWAYS the
    // cinematic dive — whether it comes from the beckon, a scroll, an arrow, or
    // a hex-dot jump straight to a deep garden node — so you never merely slide
    // across that threshold.
    if (to > LIBRARY_MAX && Math.round(from) <= LIBRARY_MAX && !diveAnimRef.current) {
      dive(to);
      return;
    }
    targetRef.current = to;
    // A new destination chapter: swell the ambience across the crossing and
    // reset immersion so you arrive at the mouth of the next room, not already
    // buried in it.
    if (Math.round(to) !== Math.round(from)) {
      immersionTargetRef.current = 0;
      if (!reduced && audioRef.current) {
        audioRef.current.swell();
      }
    }
  }, [reduced, dive]);

  // The single forward/back axis. A positive step walks deeper INTO the current
  // gallery; once immersion tops out the next step crosses to the following
  // chapter. Backing out empties immersion first, then retreats a chapter.
  const advance = useCallback((step) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    setHint('gone');
    const next = immersionTargetRef.current + step;
    if (next > 1) {
      setTarget(Math.round(targetRef.current) + 1); // resets immersion to 0
    } else if (next < 0) {
      if (immersionTargetRef.current <= 0.001) {
        setTarget(Math.round(targetRef.current) - 1);
      } else {
        immersionTargetRef.current = 0;
      }
    } else {
      immersionTargetRef.current = next;
    }
  }, [setTarget]);

  const go = useCallback((dir) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    setHint('gone');
    // Whole-chapter jump (used by autoplay / chapter dots): clear immersion so
    // the crossing reads cleanly, then step the target chapter.
    immersionTargetRef.current = 0;
    setTarget(Math.round(targetRef.current) + dir);
  }, [setTarget]);

  const jumpTo = useCallback((index) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    setHint('gone');
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

  // One footfall from the walking gait (DescentRig calls this mid-stride):
  // lay a soft step sound under it, scaled by how strongly the gait is swinging.
  const handleStep = useCallback((intensity) => {
    if (!reduced && audioRef.current) {
      audioRef.current.step(intensity);
    }
  }, [reduced]);

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
    let last = performance.now();
    const tick = (now) => {
      // Wall-clock easing so the glide keeps the same meditative pace on any
      // refresh rate (clamped so a background tab doesn't lurch on return).
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const diving = diveAnimRef.current !== null;
      if (diving) {
        // The vortex plunge runs on its own clock — a slow, watchable fall. Its
        // two motions are DECOUPLED: `el` drives how far the camera dives into
        // the vortex core (diveRef → the plunge/spin/aim in DioramaScene), which
        // stays deep late into the fall — so you actually travel THROUGH the
        // spiral, on screen the whole way. The descent crossover is held to the
        // very end and runs behind the tunnel's own darkness (the near-black
        // veil below closes as the camera buries itself in the throat), because
        // the crossing melt seen at point-blank range reads as abstract shards —
        // it must never be in the open this close.
        const a = diveAnimRef.current;
        // `frozen` holds the fall at a fixed progress — dev-capture only (the
        // ?dev hook below); a real dive never sets it.
        const el = a.frozen != null ? a.frozen : Math.min((now - a.start) / DIVE_MS, 1);
        diveRef.current = el;
        descentRef.current = LIBRARY_MAX + smoothstep(0.78, 0.97, el);
        velRef.current = 0;
        if (a.frozen == null && el >= 1) {
          // Landed. Hand the camera back to the spring — aimed at the fall's
          // true destination, so a deep hex-jump glides on through the garden —
          // and let the HUD chrome fade back in.
          diveAnimRef.current = null;
          descentRef.current = LIBRARY_MAX + 1;
          diveRef.current = 1;
          targetRef.current = a.then ?? LIBRARY_MAX + 1;
          setIsDiving(false);
        }
      } else {
        const d = descentRef.current;
        const t = targetRef.current;
        // Critically damped spring toward the target depth: the camera gathers
        // itself out of one gallery, crests mid-corridor, and brakes softly into
        // the next — one continuous breath instead of a lurch-and-crawl. A full
        // chapter crossing unfolds over roughly seven seconds.
        const K = 0.55;                 // stiffness — sets the crossing's tempo
        const C = 2 * Math.sqrt(K);     // critical damping — no overshoot
        let v = velRef.current;
        v += (K * (t - d) - C * v) * dt;
        let next = d + v * dt;
        if (Math.abs(t - next) < 0.0006 && Math.abs(v) < 0.002) {
          next = t;
          v = 0;
        }
        velRef.current = v;
        descentRef.current = Math.min(Math.max(next, 0), MAX);
      }
      const cur = descentRef.current;

      // Immersion eases toward its target, but only while the camera is settled
      // on a chapter — mid-crossing (and mid-fall, when descent briefly holds at
      // the vortex) it is pulled to 0 so the walk-in doesn't fight the crossing.
      const settled = Math.abs(cur - Math.round(cur)) < 0.02;
      const immT = settled && !diving ? immersionTargetRef.current : 0;
      immersionRef.current += (immT - immersionRef.current) * (1 - Math.exp(-dt * 2.4));

      // Look-around: gaze eases toward its target on both axes. The target
      // barely drifts back toward center — slow enough that the view stays
      // where the reader pointed it, yet over a long dwell it settles back to
      // facing down the corridor.
      yawTarget.current += (0 - yawTarget.current) * (1 - Math.exp(-dt * 0.05));
      yawRef.current += (yawTarget.current - yawRef.current) * (1 - Math.exp(-dt * 2.4));
      pitchTarget.current += (0 - pitchTarget.current) * (1 - Math.exp(-dt * 0.05));
      pitchRef.current += (pitchTarget.current - pitchRef.current) * (1 - Math.exp(-dt * 2.4));

      // Interpolate accent between the two bracketing chapters.
      const lo = Math.floor(cur);
      const hi = Math.min(lo + 1, MAX);
      accentRef.current.copy(ACCENTS[lo]).lerp(ACCENTS[hi], cur - lo);

      // Progress bar, updated by direct DOM write (no React render). Measured
      // against the *reachable* end of the corridor, which itself eases out
      // when the door opens — the full bar slowly gives way to a longer road.
      unlockedEased.current +=
        ((doorOpenRef.current ? MAX : LIBRARY_MAX) - unlockedEased.current) *
        (1 - Math.exp(-dt * 1.6));
      if (barRef.current) {
        const frac = Math.min(cur / (unlockedEased.current || 1), 1);
        barRef.current.style.width = `${frac * 100}%`;
      }

      // The soundscape darkens through the library, then the garden opens the
      // air back up: leaf-hiss in, drone weight out, across the crossing.
      if (audioRef.current) {
        audioRef.current.setDescent(Math.min(cur, LIBRARY_MAX) / (LIBRARY_MAX || 1));
        audioRef.current.setGarden(Math.min(Math.max(cur - LIBRARY_MAX, 0), 1));
      }

      // Update HUD chapter when we cross a rounded boundary — right at the
      // bridge's peak, so the card swap happens under the video's cover.
      const nearest = Math.round(cur);
      if (nearest !== settledRef.current) {
        settledRef.current = nearest;
        setChapter(nearest);
      }

      // The vortex dive drives a warm radial flash. While falling, `diveRef` is
      // the plunge clock (el); otherwise it just tracks the depth so idle/garden
      // states stay dark. The flash keeps the whole plunge into the vortex in the
      // clear (p up to ~0.5), then swells to cover the late crossover and the
      // camera righting, and clears onto the garden. Reduced motion softens it.
      // Off the dive, the plunge is fully at rest — so a normal crossing (or
      // ascending back out of the garden) never spuriously spins the camera.
      if (!diving) {
        diveRef.current = 0;
      }
      const p = diveRef.current;
      if (flashRef.current) {
        // The tunnel swallows the light. No gold flood — the spiral is on
        // screen until the camera buries itself in the throat, then the dark
        // veil closes over the plate hand-off and lifts onto the garden:
        // falling into darkness, emerging into green.
        const bell = smoothstep(0.7, 0.88, p) * (1 - smoothstep(0.93, 1.0, p));
        flashRef.current.style.opacity = `${(reduced ? 0.8 : 0.92) * bell}`;
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Surface the navigation hint once the veil has fully dissolved; if the
  // reader never moves on their own, let it bow out after a while regardless.
  useEffect(() => {
    if (veil !== 'gone' || hint !== 'pending') {
      return undefined;
    }
    setHint('shown');
    const timer = setTimeout(() => setHint('gone'), 14000);
    return () => clearTimeout(timer);
  }, [veil, hint]);

  // Dev-only capture rig (stripped from production builds by Vite): ?dev=1
  // jumps straight to the woken vortex — or to ?ch=<n> when given — and
  // exposes window.__setDive(el) to freeze the dive at any progress, so
  // headless screenshots can inspect any instant of the fall. See the capture
  // recipe in the project memory.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('dev')) return;
    setVeil('gone');
    enteredRef.current = true;
    doorOpenRef.current = true;
    setDoorOpen(true);
    const ch = Number(params.get('ch'));
    const at = params.has('ch') && Number.isFinite(ch) ? clamp(Math.round(ch), MAX) : LIBRARY_MAX;
    descentRef.current = at;
    targetRef.current = at;
    window.__setDive = (el) => {
      diveAnimRef.current = { frozen: Math.max(0, Math.min(1, el)) };
      setIsDiving(true);
    };
    window.__nav = () => ({
      target: targetRef.current,
      descent: descentRef.current,
      immT: immersionTargetRef.current,
      diving: diveAnimRef.current !== null,
    });
  }, []);

  // The door: once the reader has settled in The Silence and dwelled for a
  // few breaths, a green light kindles between the shelves and the garden
  // unlocks. Leaving before the dwell completes keeps it sealed.
  useEffect(() => {
    if (doorOpen || chapter !== LIBRARY_MAX) {
      return undefined;
    }
    const timer = setTimeout(() => {
      doorOpenRef.current = true;
      setDoorOpen(true);
      if (audioRef.current) {
        audioRef.current.announce();
      }
    }, 4500);
    return () => clearTimeout(timer);
  }, [chapter, doorOpen]);

  // Autoplay: drift forward, loop back to the top at the reachable end.
  useEffect(() => {
    if (!autoplay || NODES.length <= 1) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      const end = doorOpenRef.current ? MAX : LIBRARY_MAX;
      const atEnd = Math.round(targetRef.current) >= end;
      setTarget(atEnd ? 0 : Math.round(targetRef.current) + 1);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [autoplay, setTarget]);

  // Keyboard: Up/Down + Space move deeper/shallower; Left/Right pan the gaze;
  // Shift+Up/Down tilt the gaze up and down instead of walking.
  useEffect(() => {
    const onKey = (event) => {
      if (!enteredRef.current) {
        return;
      }
      if (event.key.toLowerCase() === 'h' || event.key === '?') {
        event.preventDefault();
        setShowHelp((v) => !v);
        return;
      }
      if (event.key === 'Escape') {
        setShowHelp(false);
        return;
      }
      if (['ArrowDown', ' '].includes(event.key)) {
        event.preventDefault();
        if (event.shiftKey && event.key === 'ArrowDown') {
          panGaze(0, -0.06); // tilt the gaze down
        } else {
          advance(0.5); // step deeper into the room, then on to the next chapter
        }
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (event.shiftKey) {
          panGaze(0, 0.06); // tilt the gaze up
        } else {
          advance(-0.5); // step back out toward the mouth, then to the previous
        }
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        panGaze(0.08);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        panGaze(-0.08);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, panGaze]);

  // Scroll wheel walks the camera in and out in small, calm increments — deeper
  // into the current gallery first, rolling on to the next once fully immersed.
  useEffect(() => {
    const onWheel = (event) => {
      event.preventDefault();
      if (!enteredRef.current) {
        return;
      }
      advance(Math.sign(event.deltaY) * 0.14);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [advance]);

  // Pointer: a mouse/pen drag pans the gaze freely on both axes (grab the
  // world and pull it). On touch, horizontal drags look around while a clear
  // vertical swipe still walks in/out — that's the touch path to navigation.
  // A plain click drifts deeper.
  const dragMoved = useRef(false);
  const handlePointerDown = (event) => {
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      yaw: yawTarget.current,
      pitch: pitchTarget.current,
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
    const isTouch = event.pointerType === 'touch';
    if (isTouch && !start.swiped && Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) {
      start.swiped = true;
      advance(dy < 0 ? 0.5 : -0.5); // swipe up = press deeper into the room
      return;
    }
    // Map a full-width/height drag to the full pan range, grab-the-world
    // style: pulling the scene right swings the gaze left, pulling it down
    // tips the gaze up.
    const yaw = start.yaw - (dx / window.innerWidth) * YAW_MAX * 2.2;
    yawTarget.current = Math.min(Math.max(yaw, -YAW_MAX), YAW_MAX);
    if (!isTouch) {
      const pitch = start.pitch + (dy / window.innerHeight) * PITCH_MAX * 2.2;
      pitchTarget.current = Math.min(Math.max(pitch, -PITCH_MAX), PITCH_MAX);
    }
  };
  const handlePointerUp = () => {
    pointerStart.current = null;
  };
  const handleClick = () => {
    // Only advance if this was a click, not the end of a look-around drag.
    if (enteredRef.current && !dragMoved.current) {
      advance(0.5); // a click steps you further into the room
    }
  };

  const node = NODES[chapter];
  const inGarden = chapter > LIBRARY_MAX;

  return (
    <div
      className={`tour-root${isDiving ? ' is-diving' : ''}`}
      style={{ '--accent': node.accent }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <DioramaScene
        scenes={NODES.map((n) => n.scene)}
        descentRef={descentRef}
        immersionRef={immersionRef}
        accentRef={accentRef}
        yawRef={yawRef}
        pitchRef={pitchRef}
        diveRef={diveRef}
        portalRef={doorOpenRef}
        libraryMax={LIBRARY_MAX}
        reduced={reduced}
        onStep={handleStep}
      />

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
          title="Ascend one gallery (↑)"
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
          title="Descend one gallery (↓)"
          onClick={(e) => { e.stopPropagation(); go(1); }}
          disabled={chapter === (doorOpen ? MAX : LIBRARY_MAX)}
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
        <button
          type="button"
          className={`pill${showHelp ? ' is-on' : ''}`}
          aria-label={showHelp ? 'Hide the navigation help' : 'Show the navigation help'}
          title="Navigation help (H)"
          onClick={(e) => { e.stopPropagation(); setShowHelp((v) => !v); }}
        >
          ?
        </button>
      </div>

      <div className="depth">
        <div className="depth-label">
          {inGarden
            ? `PATH ${chapter - LIBRARY_MAX} / ${GARDEN_NODES.length}`
            : `DEPTH ${chapter + 1} / ${LIBRARY_NODES.length}`}
        </div>
        <div className="depth-dots">
          {NODES.map((n, index) => {
            const isGarden = index > LIBRARY_MAX;
            if (isGarden && !doorOpen) {
              return null;
            }
            return (
              <button
                key={n.slug}
                type="button"
                className={`hex-btn${index === chapter ? ' is-active' : ''}${isGarden ? ' is-garden' : ''}`}
                onClick={(e) => { e.stopPropagation(); jumpTo(index); }}
                aria-label={isGarden ? `Follow the path to ${n.title}` : `Descend to ${n.title}`}
                title={n.title}
              >
                <span className="hex" />
              </button>
            );
          })}
        </div>
      </div>

      {doorOpen && chapter === LIBRARY_MAX && !isDiving && (
        <button
          type="button"
          className="door-call"
          onClick={(e) => { e.stopPropagation(); dive(); }}
          aria-label="Descend into the spiral toward the Garden of Forking Paths"
        >
          <span className="door-eyebrow">the spiral has woken</span>
          <span className="door-verb">descend</span>
          <span className="door-chevron" aria-hidden="true">↓</span>
        </button>
      )}

      {showHelp && (
        <div className="help-overlay">
          <div className="help-panel">
            <div className="help-title">Navigation help</div>
            <div className="help-body">
              • Scroll, ↑ / ↓, or space walk into a gallery, then on to the next<br />
              • Drag with the mouse to look anywhere — left, right, up, below<br />
              • ← / → also look around; Shift + ↑ / ↓ tilt the gaze up and down<br />
              • Swipe up or down to walk in and move between galleries on touch<br />
              • Click to step further into the room<br />
              • Press H or ? to open this guide, Esc to close it<br />
              • Use the depth hexagons for direct jumps<br />
              • In the deepest gallery, wait — something opens
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

      {hint !== 'pending' && (
        <div
          className={`nav-hint${hint === 'shown' ? ' is-shown' : ''}`}
          aria-hidden="true"
        >
          <span className="nav-hint-mouse">scroll or click to walk deeper&ensp;·&ensp;drag to look around&ensp;·&ensp;? for help</span>
          <span className="nav-hint-touch">swipe up to walk deeper&ensp;·&ensp;drag to look around</span>
        </div>
      )}

      <div className="progress">
        <div className="progress-track">
          <div ref={barRef} className="progress-fill" />
        </div>
        <div className="progress-label">{inGarden ? 'Branching' : 'Descending'}</div>
      </div>

      {/* Warm whiteout of the vortex dive — opacity driven straight from the
          tick, so it swells to flood the frame as the camera plunges the spiral
          core and clears onto the garden. */}
      <div className="vortex-flash" ref={flashRef} aria-hidden="true" />

      {veil !== 'gone' && <EntryVeil leaving={veil === 'leaving'} onEnter={enter} />}
    </div>
  );
}
