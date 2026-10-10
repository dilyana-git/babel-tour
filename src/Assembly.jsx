// ── The opening ──────────────────────────────────────────────────────────────
// What a reader watches while the world is put together (World.jsx's assembly:
// about 13 seconds on a first visit to the AMD integrated GPU this piece is
// made on, 6–9 after). It used to be a dark sheet with "Assembling the
// Library…" breathing in the corner, and the wait was called really boring.
//
// Now the Library draws itself in gold ink, through the map's own camera. The
// Vestibule first: its rim traced both ways round, its far walls let down into
// the dark, shelved, its lamp lit. Then the rest of the walk: the Echo, the
// Silence, the Vertigo's stair turning down into its well, the Door broken open.
// Then the honeycomb, outward from the walk to every edge, and the garden's
// forking paths branching out of the Door. The camera starts low behind the
// Vestibule, looking down the walk, and draws back as the assembly goes on,
// until it is exactly where the map's camera rests (plan.js). Only then is the
// world shown (EntryMap's `inked`), so the stone fades in under the ink line
// for line while a last wash of light runs through the drawing and lets it go.
//
// Beside it (AssemblyEpigraph), the story's first sentence is found among the
// Library's random books a letter at a time, in step with the drawing.
//
// How far along: World.jsx's onProgress (0 to 0.99), eased, never going back,
// with a floor that creeps up with the clock so that a step that takes long
// (the World chunk still arriving, say) never leaves the page standing still.
// A cell is drawn in its own time (seconds, not progress) once the progress
// reaches its turn, so a jump in progress starts more cells rather than
// snapping any of them. With reduced motion the camera is at rest from the
// start, cells fade in whole, and nothing flickers, drifts or scrambles.
//
// The drawing itself is ink.js, run in a worker (ink.worker.js) wherever the
// canvas can be handed to one.
//
// DEV: ?ink=20 makes the opening take at least 20 seconds, to watch it;
// window.__ink is the driver (u, ready, inked, gone).
import { useEffect, useRef, useState } from 'react';
import { TILT_ELEVATION, TILT_FOV, TILT_YAW, restPose } from './world/plan';
import { mapOld } from './world/mapFix';
import { VOICES } from './voices';
import { DEV_PACE, GUESS, startInk, stream } from './ink';

// The Library's alphabet: twenty-two letters, the comma, the period and the
// space ("the orthographical symbols are twenty-five in number").
const SYMBOLS = 'abcdefghilmnopqrstuvxyz,.';
const SENTENCE = VOICES.vestibule[0];

export function AssemblyInk({ driver, progress, ready, shown, plan, reserveLeft, reducedMotion, onInked, onGone }) {
  const wrapRef = useRef(null);
  const inkRef = useRef(null);
  const feedRef = useRef(null);
  const props = useRef({ plan, reserveLeft, progress, ready, onInked, onGone });
  useEffect(() => {
    props.current = { plan, reserveLeft, progress, ready, onInked, onGone };
  }, [plan, reserveLeft, progress, ready, onInked, onGone]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const state = driver.current;
    Object.assign(state, { u: 0, ready: false, inked: false, gone: false });
    if (import.meta.env.DEV) window.__ink = state;
    const hear = (m) => {
      if (import.meta.env.DEV) {
        if (m.beat) (state.beats ??= []).push(m.beat);
        for (const k of ['inked', 'gone']) if (m[k]) (state.at ??= {})[k] = Math.round(performance.now());
      }
      Object.assign(state, m);
      if (m.inked) props.current.onInked?.();
      if (m.gone) props.current.onGone?.();
    };
    // In a worker if the canvas can be handed to one; on this thread if not.
    let canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    let ink = null;
    if (typeof canvas.transferControlToOffscreen === 'function') {
      try {
        const off = canvas.transferControlToOffscreen();
        const worker = new Worker(new URL('./ink.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => hear(data);
        worker.onerror = (e) => {
          console.warn('[ink] the opening could not be drawn:', e.message);
          hear({ u: 1, inked: true, gone: true });
        };
        worker.postMessage({ start: { canvas: off, reducedMotion, devPace: DEV_PACE } }, [off]);
        ink = { set: (m) => worker.postMessage(m), stop: () => worker.terminate() };
      } catch (error) {
        console.warn('[ink] drawing the opening on the page instead of a worker:', error);
        canvas.remove();
        canvas = document.createElement('canvas');
        wrap.appendChild(canvas);
      }
    }
    ink ??= startInk(canvas, { reducedMotion, devPace: DEV_PACE }, hear);
    inkRef.current = ink;

    // Its size, and the map's resting camera for that size: the world's own
    // frame once it has been built, GUESS until then.
    let restFor = '';
    const feed = () => {
      const box = wrap.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(box.width * dpr)), height = Math.max(1, Math.round(box.height * dpr));
      const { plan: points, reserveLeft: left } = props.current;
      const id = `${width}x${height}|${points ? 'world' : 'guess'}|${left}`;
      if (id === restFor) return;
      restFor = id;
      const rest = restPose(width / height, points ?? GUESS, left);
      if (import.meta.env.DEV && points) {
        const guess = restPose(width / height, GUESS, left);
        const off = Math.abs(guess.distance / rest.distance - 1) + guess.target.distanceTo(rest.target) / rest.distance;
        if (off > 0.01) console.warn('[ink] the opening guessed the map\'s frame wrong by', off.toFixed(3), '- update GUESS in ink.js');
      }
      ink.set({
        size: { width, height, dpr },
        rest: { target: rest.target.toArray(), distance: rest.distance, shift: rest.shift, fov: TILT_FOV, elevation: TILT_ELEVATION, yaw: TILT_YAW, lensed: !mapOld('L2') },
        progress: props.current.progress,
        ready: props.current.ready,
      });
    };
    feedRef.current = feed;
    feed();
    const observer = new ResizeObserver(feed);
    observer.observe(wrap);
    const onPointer = (e) => ink.set({ lean: [e.clientX / Math.max(1, window.innerWidth) - 0.5, e.clientY / Math.max(1, window.innerHeight) - 0.5] });
    if (!reducedMotion) window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      ink.stop();
      inkRef.current = null;
      feedRef.current = null;
      observer.disconnect();
      window.removeEventListener('pointermove', onPointer);
      canvas.remove();
    };
  }, [driver, reducedMotion]);

  // what it needs to know as it changes
  useEffect(() => { inkRef.current?.set({ progress }); }, [progress]);
  useEffect(() => {
    driver.current.ready = ready;
    inkRef.current?.set({ ready });
  }, [ready, driver]);
  useEffect(() => { feedRef.current?.(); }, [plan, reserveLeft]);
  // (the world shown under it: the drawing lets go)
  useEffect(() => { inkRef.current?.set({ shown }); }, [shown]);

  return <div ref={wrapRef} className="assembly-ink" aria-hidden="true" />;
}

// ── The first sentence, found ────────────────────────────────────────────────
// Its letters stand in the Library's random books at first, each one turning
// over by itself; as the drawing goes on they are found, roughly in reading
// order, until the sentence stands whole. The words keep their lengths from
// the start (a space stays a space), so nothing reflows while it is searched.
// Above it the shelf being searched, as a librarian would give it.
const WORDS = SENTENCE.split(' ');
const LETTERS = [...SENTENCE.replaceAll(' ', '')];
const shelfmark = (rnd) => {
  const hexagon = Math.floor(1 + rnd() * 999999).toLocaleString('en-US');
  return `Hexagon ${hexagon} · shelf ${1 + Math.floor(rnd() * 5)} · vol. ${1 + Math.floor(rnd() * 35)} · p. ${1 + Math.floor(rnd() * 410)}`;
};
const FOUND_MARK = 'Hexagon I · shelf 1 · vol. 1 · p. 1';
const TICK_MS = 160;
const FOUND_GLOW_MS = 480;

export function AssemblyEpigraph({ driver, reducedMotion }) {
  const lineRef = useRef(null);
  const markRef = useRef(null);
  const noteRef = useRef(null);
  // what the sentence stands in before it is searched
  const [first] = useState(() => {
    const rnd = stream(25);
    return { glyphs: LETTERS.map(() => SYMBOLS[Math.floor(rnd() * SYMBOLS.length)]), mark: shelfmark(rnd) };
  });

  useEffect(() => {
    const spans = [...lineRef.current.querySelectorAll('.assembly-ch')];
    const rnd = stream(410);
    const n = spans.length;
    const lockAt = spans.map((_, i) => 0.04 + 0.9 * (0.62 * (i / n) + 0.38 * rnd()));
    const next = new Float64Array(n);
    const found = new Float64Array(n); // when each letter was found (0: not yet)
    let markNext = 0, timer = 0;
    // A few times a second, and nothing that repaints in between: this runs
    // on the page's thread while it builds the world, and a glow animated on
    // each letter as it was found (a repaint every frame) cost the assembly
    // most of a second.
    const tick = () => {
      const now = performance.now();
      const { u } = driver.current;
      let left = 0, glowing = 0;
      for (let i = 0; i < n; i++) {
        if (found[i]) {
          // found letters come in bright and settle to ink
          if (found[i] > 0 && now - found[i] > FOUND_GLOW_MS) {
            spans[i].classList.remove('is-new');
            found[i] = -1;
          } else if (found[i] > 0) {
            glowing += 1;
          }
          continue;
        }
        if (u >= lockAt[i]) {
          found[i] = now;
          glowing += 1;
          spans[i].textContent = LETTERS[i];
          spans[i].classList.add('is-found', 'is-new');
          continue;
        }
        left += 1;
        if (!reducedMotion && now >= next[i]) {
          spans[i].textContent = SYMBOLS[Math.floor(rnd() * SYMBOLS.length)];
          next[i] = now + 150 + rnd() * 450;
        }
      }
      if (!left && !noteRef.current.classList.contains('is-found')) {
        markRef.current.textContent = FOUND_MARK;
        noteRef.current.textContent = 'The Library of Babel';
        noteRef.current.classList.add('is-found');
      }
      if (!left && !glowing) return;
      if (left && !reducedMotion && now >= markNext) {
        markRef.current.textContent = shelfmark(rnd);
        markNext = now + 650 + rnd() * 400;
      }
      timer = setTimeout(tick, TICK_MS);
    };
    timer = setTimeout(tick, TICK_MS);
    return () => clearTimeout(timer);
  }, [driver, reducedMotion]);

  let at = 0;
  return (
    <div className="assembly-epigraph" aria-hidden="true">
      <div className="assembly-epigraph-in">
        <div className="assembly-mark" ref={markRef}>{reducedMotion ? FOUND_MARK : first.mark}</div>
        <p className="assembly-line" ref={lineRef}>
          {WORDS.map((word, w) => (
            <span key={w}>
              {w > 0 && ' '}
              <span className="assembly-word">
                {[...word].map((ch) => {
                  const i = at++;
                  return <span key={i} className="assembly-ch">{reducedMotion ? ch : first.glyphs[i]}</span>;
                })}
              </span>
            </span>
          ))}
        </p>
        <div className="assembly-note" ref={noteRef}>Searching the shelves…</div>
      </div>
    </div>
  );
}
