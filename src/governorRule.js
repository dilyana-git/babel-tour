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

// ...unless the miss is not close. At twice the budget nothing is "a room
// arriving": a frame of 49 ms against a budget of 24 is a machine in the wrong
// place, and making it prove that twice costs the reader five more seconds of
// exactly what they are complaining about. Measured on the integrated AMD this
// is made on, at a 1536x730 window and a ratio of 1.25 — 1.75 million pixels —
// the walk runs at 20 fps, and it is 16 seconds before patience and one rung at
// a time arrive at the ratio the first window already pointed to.
export const GROSS = 2;

// How far a single decision may move. The frame of this scene is very nearly
// all fill rate — measured, the time goes as the square of the ratio and no
// single pass in the composer is worth more than 13% — so from a median you can
// say where the ratio needs to be rather than creep toward it. Capped at two
// rungs because the governor NEVER CLIMBS BACK: a decision made on one bad
// window is permanent for the session, so it may be quick without being
// reckless, and one more window will take it further if it was not enough.
export const REACH = 2;

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
  if (medianMs < budget * GROSS && state.late < patience) return null;
  state.late = 0;
  // Where the numbers point: time goes as the ratio squared, so the ratio that
  // would have made this window's median fit the budget is the current one
  // scaled by sqrt(budget / median). Step to the first rung at or below it,
  // and never more than REACH rungs at once.
  const want = ladder[state.rung] * Math.sqrt(budget / medianMs);
  let next = state.rung + 1;
  while (next + 1 < ladder.length && next < state.rung + REACH && ladder[next] > want) next += 1;
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
