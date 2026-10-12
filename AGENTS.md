# Babel Tour: working on it

## Checking a change

After every change to the app, run:

```
npm run check
```

It lints, checks the frame-rate rule and the geometry/path/collision unit
tests (`check:fast`, a few seconds, no browser), then builds. A failure is
unfinished work: read it and diagnose it; never weaken an assertion to make a
change pass without establishing the intended behavior.

To see a change, take a picture of it (see "Looking at the world" below).

**The browser test gate is off.** Do not run `npm run check:major`,
`check:navigation:browser`, `check:navigation:all`, `check:navigation:contracts`,
`dev:checked*` or `check:navigation:watch*` after a change. They drive headless
Edge through every room with software WebGL and take tens of minutes. Run them
only:

- `npm run check:navigation:smoke` when a change touches navigation, input
  handling, room controls, collision geometry or scene lifecycle;
- the full gate (`npm run check:major`) when the user asks for it, or once
  after a large refactor that moves code across the world;
- in CI, which runs the full gate nightly and by hand
  (`.github/workflows/navigation.yml`) and the quick checks on every push.

The browser suites start their own Vite server and headless Edge. On an
offline machine, set `EDGE_DRIVER_PATH` to an installed Edge driver; on a
machine with a GPU, `BABEL_BROWSER_GRAPHICS=hardware` is several times faster.
They test the default world tour with real keyboard, mouse and touch input.
Development diagnostics only observe outcomes and accelerate the clock; do not
replace tested inputs with jump/scrub/stroll hooks. Geometry sweeps are
separate coverage. Reports and failure screenshots go to
`.ux-review/navigation/<run>/` and must retain failed and unexecuted
scenarios. See `docs/navigation-testing.md`.

## Looking at the world

```
npm run shot -- --room=1                  stand in the Echo
npm run shot                              the map
npm run shot -- --room=1 --ab=wmap5=old   the same frame without and with a flag
```

`tools/shot.mjs` starts its own Vite and headless browser (Edge or Chrome on
Windows and macOS with the GPU; Chromium on Linux with software WebGL, about
six minutes a page load) and writes PNGs to `.ux-review/shots/`. `--help`
lists its options. Look at every picture before reporting a visual change
done. The `verify` skill has more.

## Where the world is built

`src/world/buildWorld.js` runs the world's sections in order (assembleWorld).
Each room is a file in `src/world/rooms/` (vestibule, echo, silence, vertigo,
door, garden, fork, web); what they share — materials, the honeycomb, the
shelves, the grounds, the light, the walk — is in `src/world/build/`. Each
section is a function that takes `ctx` (what the sections before it made)
and returns what later sections need. Everything is laid out from one random
stream (`rnd`) in that order: a change that adds or removes a draw, or moves a
section, moves everything after it. Use a stream of your own (`makeRng`) for
anything new.

To prove a refactor changes nothing, compare scene fingerprints before and
after (`npm run shot -- --fingerprint`, then `--compare=a.json,b.json`; see
`tools/shot.mjs`).

## Variants of a look

When a design question is answered with options (`?w…=a|b|c` flags, an `old`
path kept for comparison), they are a tool for choosing, not something to
keep:

1. Once the user picks one, in the same commit, make it the only code path:
   delete the losing looks and their `old` path and the query flag that
   selected them.
2. Record what was tried in `docs/design-history.md`: the question, each
   option's values, which was picked, and the commit that still holds the
   code for all of them.
3. Check the picked look with a before/after picture.

Do not leave an unpicked variant in the code "for later": git history and the
design history keep it. The older `?w…=old` flags from earlier boards
(the `src/world/*Fix*.js` modules) are due the same treatment, room by room.

## Comments and design history

Code comments say what the code does and why. Dates, the reviews that asked
for a change, quotes, options considered and what something used to look like
belong in `docs/design-history.md` and the commit message, not in the code.

Keep existing unrelated working-tree changes intact. Make one small commit per
change, with a message that says what changed and why.
