// ── The governor ─────────────────────────────────────────────────────────────
// What the device tier could not know.
//
// capability.js decides a pixel ceiling before a frame has been drawn, out of
// pointer type and connection type, and neither of those has ever met the GPU.
// The machine this piece was built on draws the same corridor at 60 fps on its
// discrete chip and about 12 on its integrated one — same pointer, same
// connection, same ceiling, six times the frame time. Measured on that machine:
// a median of 83 ms with 52 ms of jitter, which reads to a walker as the
// "flicker when I navigate" that a whole day was once spent looking for in the
// band feather and the antialiasing, where it never was.
//
// So the ceiling is where a walk starts and this is what happens next: sample
// the frame clock, and if the frames are persistently late, step the ratio down
// one rung. Fill rate is what this scene is short of — a million displaced
// vertices, every fragment doing relief and unsharp work — so pixels are the
// lever that actually moves, and dropping 1.5 to 1.25 is a third of them.
//
// Three things it deliberately does not do:
//
//   It never climbs back. A reader dwelling on a painting must not watch it
//   change resolution, and the only way to be sure of that is to have nowhere
//   to climb to. A machine that recovers keeps what it fell to.
//
//   It never re-tessellates. LIGHT_MESH is the bigger saving and it is decided
//   once at load for a reason — rebuilding six slab stacks mid-walk costs far
//   more than the frames it would go on to save, and does it as a visible hitch
//   in the exact moment the walk is already struggling.
//
//   It judges by MEDIAN, never by a frame. A plate decoding, a clip waking and
//   a garbage collection are all single late frames, and a governor that reacted
//   to those would spend the walk chasing events that were over before it moved.
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DPR_LADDER, FRAME_BUDGET_MS, GOVERNS } from './capability';
import { judge, PATIENCE, GROSS } from './governorRule';

// What it gives back, and in what ORDER. Pixels last.
//
// This used to be a ladder of nothing but pixel ratios, and that was the wrong
// shape: told twice that the piece blinks, and once that it got WORSE after the
// ratio came down, the thing to notice is that drawing below the screen's own
// grid does not soften a thin bright line — it makes the line crawl, because
// every frame resamples it differently. Measured on the integrated AMD this is
// made on, at the reader's own 1536x730 at 1.25 — 1.75 million pixels — three
// interleaved passes, best of each:
//
//   everything on, native            38.3 ms
//   no contact shadow, native        32.1      -16%
//   four lamps instead of six        35.0       -9%
//   both, native                     ~29        1.75 Mpix
//   everything on, ratio 0.85        ~26        0.81 Mpix
//
// The same frame time for more than twice the pixels. So the contact shadow
// goes first, then two of the six lamps, and only then does the picture get
// smaller. Two and not three: the Vertigo is lamps at every depth of its well,
// and it falls off a cliff between four and three (mean luminance 29.1 against
// 17.3, and over half the frame down in the dark).
// Both are per-fragment work, which is what this scene is short of; neither
// rebuilds any geometry (see "never re-tessellates" below). Each costs one
// shader recompile as it is spent — a single hitch, once, against a softness
// that would last the rest of the walk.
const GIVE = ['ao', 'lights'];

// How long a window of frames has to be before it is allowed to mean anything.
// Long enough that a stutter cannot fill it, short enough that a reader is not
// three rooms in before the machine is asked to keep up.
const WINDOW_MS = 2500;

// The first frames of a walk are the most expensive ones it will ever draw —
// shaders compiling, six plate pairs decoding and uploading, the opening
// withdrawal moving the camera the whole time — and they are not what anyone is
// walking through. Judging them would drop the ratio on every machine.
const WARMUP_MS = 6000;

// Longer than any frame this scene can honestly produce. Past it, what is being
// timed is not the GPU: a hidden tab, a dragged window, a debugger.
const STALL_MS = 500;

export default function Governor({ onQuality }) {
  const setDpr = useThree((s) => s.setDpr);
  const started = useRef(0);
  const frames = useRef([]);
  const elapsed = useRef(0);
  const state = useRef({ rung: 0, late: 0, floored: false });
  const spent = useRef(0);      // how many of GIVE have gone
  const late = useRef(0);       // lateness while concessions are still available
  // Windows to throw away after acting. Giving back the contact shadow or a
  // light rebuilds a shader, and that recompile lands in the NEXT window as a
  // spike of a few hundred milliseconds — which is not the machine being slow,
  // it is the machine doing what it was just asked to. Measured without this,
  // the governor read 38 ms, gave back the AO, read 65, gave back the lamps,
  // read 59, and dropped the pixels too: it spent the whole budget reacting to
  // its own cost. One window discarded is enough for the recompile to be over.
  const settle = useRef(0);

  useFrame((_, delta) => {
    const ms = delta * 1000;
    const now = performance.now();
    if (!started.current) started.current = now;
    if (now - started.current < WARMUP_MS) return;

    // A tab that was hidden hands back one enormous delta on the way in, and a
    // breakpoint or a dragged window hands back several. None of them is a slow
    // GPU, and all of them are longer than any frame this scene can honestly
    // produce, so they are not evidence and are not counted.
    if (ms > STALL_MS) return;

    frames.current.push(ms);
    elapsed.current += ms;
    if (elapsed.current < WINDOW_MS) return;

    const sorted = frames.current.sort((a, b) => a - b);
    const mid = sorted[sorted.length >> 1];
    frames.current = [];
    elapsed.current = 0;
    if (settle.current > 0) { settle.current -= 1; return; }

    // The concessions come first, one to a window, on the same terms the ratio
    // ladder moves on: two late windows in a row, or one that is not close.
    if (spent.current < GIVE.length) {
      if (mid <= FRAME_BUDGET_MS) { late.current = 0; onQuality?.({ median: mid, dpr: DPR_LADDER[state.current.rung], acted: false }); return; }
      late.current += 1;
      if (mid < FRAME_BUDGET_MS * GROSS && late.current < PATIENCE) {
        onQuality?.({ median: mid, dpr: DPR_LADDER[state.current.rung], acted: false });
        return;
      }
      late.current = 0;
      const give = GIVE[spent.current];
      spent.current += 1;
      settle.current = 1;
      console.info(`[gl] frames running ${mid.toFixed(0)} ms (budget ${FRAME_BUDGET_MS}); giving back ${give} before any pixels`);
      onQuality?.({ median: mid, give, acted: GOVERNS });
      return;
    }
    const acted = judge(state.current, mid, DPR_LADDER, FRAME_BUDGET_MS);
    if (!acted) {
      onQuality?.({ median: mid, dpr: DPR_LADDER[state.current.rung], acted: false });
      return;
    }
    if (!acted.floor && GOVERNS) { setDpr(acted.dpr); settle.current = 1; }
    console.info(`[gl] frames running ${mid.toFixed(0)} ms`
      + ` (budget ${FRAME_BUDGET_MS}); pixel ratio → ${acted.dpr}`
      + (acted.floor ? ' — the last rung; nothing further to give' : '')
      + (GOVERNS ? '' : ' — not applied, ?governor=0'));
    onQuality?.({ ...acted, acted: GOVERNS && !acted.floor });
  });

  return null;
}
