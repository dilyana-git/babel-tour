// ── The governor's rule ──────────────────────────────────────────────────────
// Held in its own module, with no React and no three in it, for one reason: it
// is the only part of the governor with an opinion, and it is the only part
// that can be CHECKED. The frame loop cannot be run anywhere a harness can
// watch it — under headless GL this scene draws at 130-700 ms a frame, so a
// test that tried to watch the governor act would be measuring swiftshader
// rather than the rule. Here the rule can be handed numbers directly, which is
// what tools/governor-check.mjs does.
// It imports nothing, on purpose. capability.js reads the query string and the
// ladder it derives is a fact about a browser; this file is arithmetic, and a
// check that had to stand up a `window` to ask what a median of 83 ms means
// would be testing the wrong thing. The caller passes what it is measuring
// against.

// How many late windows in a row it takes to move. One is a room arriving; two
// in a row, five seconds apart, is the machine.
export const PATIENCE = 2;

// The decision, as a function of nothing but the numbers.
//
// `state` is { rung, late, floored } and is MUTATED in place — it is a ref's contents in
// the caller, and a governor that allocated a new object every 2.5 s to hold two
// integers would be a poor advertisement for itself.
//
// Returns what the caller should do: null for nothing, or { dpr, median, floor }.
export const judge = (state, medianMs, ladder, budget, patience = PATIENCE) => {
  if (medianMs <= budget) {
    // One window inside budget forgives the one before it: what the patience
    // count is for is a machine that is CONSISTENTLY late, and an alternating
    // pattern is a walk passing through a heavy room, not a slow chip.
    state.late = 0;
    return null;
  }
  state.late += 1;
  if (state.late < patience) return null;
  state.late = 0;
  const next = state.rung + 1;
  // Out of rungs. The piece has given back every pixel it is willing to and the
  // machine is still behind; what is left to give is the video, and that is the
  // reader's call to make with ?stills=1, not one to make for them by silently
  // stopping the paintings from ever waking.
  //
  // Said ONCE. A machine that cannot hold the last rung will fail every window
  // for the rest of the walk, and a line of console per five seconds saying so
  // is not more information than the first line was — it is the same fact,
  // burying whatever else the walk had to report.
  if (next >= ladder.length) {
    if (state.floored) return null;
    state.floored = true;
    return { dpr: ladder[state.rung], median: medianMs, floor: true };
  }
  state.rung = next;
  return { dpr: ladder[next], median: medianMs, floor: false };
};
