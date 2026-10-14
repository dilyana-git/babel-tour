# Babel Tour: working on it

Read `docs/development-memory.md` at the start of work in this project. It
records the user's development preferences and the reason for the workflow.

## A short visual feedback loop

Make one coherent visual revision, inspect a focused preview, and present it
promptly. Let the user's next feedback guide further polish. Keep the requested
scope small; do not add speculative performance investigations, shader dumps,
or broad refactors to a simple appearance change.

Prefer a focused tree preview when one is available. Reuse saved camera views
and the existing screenshot tools; capture several views in one browser
session. Reuse a running preview session between edits when possible instead
of creating one-off copies of the screenshot driver. New preview tooling and
seed migrations are separate tasks: do not implement them as part of a visual
fix or an instructions-only request unless the user explicitly asks.

Run the quick check after each coherent app edit. Schedule any required browser
smoke test once the functional change is settled. Repeat successful checks only
when a later change, failure, or concrete unresolved concern justifies it.
Optional diagnostics are not a reason to leave a verified visual fix unfinished.

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

- `npm run check:navigation:smoke` when a change affects navigation, input
  handling, room-control behaviour, walking clearance/collision behaviour or
  scene lifecycle behaviour; run it after the functional change is settled;
- the full gate (`npm run check:major`) when the user asks for it, or once
  after a large refactor that moves code across the world;
- in CI, which runs the full gate nightly and by hand
  (`.github/workflows/navigation.yml`) and the quick checks on every push.

**Do not run browser smoke tests for purely visual changes.** Materials,
lighting, foliage, tree appearance and decorative geometry are visual changes
unless they also change how the user moves or interacts with the world. A
filename shared with collision or lifecycle code does not by itself require
a smoke test. Keep `npm run check` and a rendered picture for visual edits.

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

## In a cloud session: the user looks

This section applies only in a Claude Code cloud session (`CLAUDE_CODE_REMOTE`
is `true`): Linux, no GPU, minutes per page load. On any other machine, take
the pictures yourself as above.

In a cloud session the user pulls the branch and looks on their own machine:

1. Make the change, run `npm run check`, commit (one commit per change) and
   push. Do not run `npm run shot` unless the user asks.
2. For each commit, tell the user its hash, where to look (room, vantage,
   what should differ) and how to see it: `npm run dev`, or
   `npm run shot -- --room=N`, with `--ab=<flag>=old` for a before/after.
   Independent changes can go up together as separate commits.
3. Report a visual change as pushed and waiting for the user's look, not
   done. It is done when the user approves it. If they reject it, revert that
   commit or revise it as they say. A screenshot the user attaches is the
   picture to look at.
4. Offer a design question's options behind a temporary query flag, so the
   user can compare them in one tab. "Variants of a look" applies once they
   pick.
5. Browser suites and fingerprints still run when this file calls for them
   (`check:navigation:smoke`, `--fingerprint` around a refactor): run them in
   the background, or ask the user to run them locally on the GPU
   (`BABEL_BROWSER_GRAPHICS=hardware` for the suites).

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

Use an explicit independent seed for new tree specimens and new procedural
detail. Keep growth and leaf-colour streams separate from placement. Reuse
existing seed values when migrating current trees: the user wants the current
garden's shapes and planting preserved. Migrate the older compatibility draw
budgets in small steps, proving that existing output is unchanged.
Treat this migration as a separately requested task, not part of an appearance
adjustment.

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
