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
import { judge } from './governorRule';

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

    const acted = judge(state.current, mid, DPR_LADDER, FRAME_BUDGET_MS);
    if (!acted) {
      onQuality?.({ median: mid, dpr: DPR_LADDER[state.current.rung], acted: false });
      return;
    }
    if (!acted.floor && GOVERNS) setDpr(acted.dpr);
    console.info(`[gl] frames running ${mid.toFixed(0)} ms`
      + ` (budget ${FRAME_BUDGET_MS}); pixel ratio → ${acted.dpr}`
      + (acted.floor ? ' — the last rung; nothing further to give' : '')
      + (GOVERNS ? '' : ' — not applied, ?governor=0'));
    onQuality?.({ ...acted, acted: GOVERNS && !acted.floor });
  });

  return null;
}
