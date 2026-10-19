# Babel Tour

## The world tour

The piece opens on a map of the whole walk — a honeycomb of hexagonal galleries
built in three.js (`src/world/`), tilted to show its bookshelf walls — and
choosing a room flies down into it. From there the reader stays in the world:
**W** walks the way — the walk the piece itself makes, through every room and
hallway, over the Echo's crossing, across the zigzag bridge and through the
maze — and the reader only has to hold it. While on it, the stone worn smooth
along the way catches a little warm light a few strides ahead, and lets it go
when you leave the way (`?wway=0` turns that off). **A/D**, the **arrow keys**
or a **drag** turn the head while W stays held, and a glance leaves the course
alone. Keep looking more than 35° off the course, the head settled, for about
0.6 s, and the course turns to where you are looking (`?wgaze=0` turns that
off). Releasing **W**, looking, and pressing **W** again also chooses a new
course at once. Rejoining the path heading along it resumes following
in that direction; crossing it sideways leaves you walking independently.
In the Pavilion, keep **W** held to walk around the table and across the north
bridge. The guided walk returns through the other side of the room before
continuing towards the maze.
**S** steps back; **M** or **Escape** rises to the map when no transition is
underway. The feet go only where the world has floor
(`src/world/body.js`): up a stair a tread at a time, along a wall rather than
through it, never off a ledge or into the pond, and walking plainly into a wall
off the way you are turned gently aside. Walk into the court at the heart of
the maze and the walk ends. The HUD's buttons ask the piece to take you to the
next or previous room. `?wfollow=0` and `?wassist=0` turn path following and
the turning aside off.

In **the Vertigo**, the composed arrival stands a little way down the spiral,
at its broken rail, facing the next steps. Holding **W** follows the staircase,
which continues beyond its initial turns; walking down alone keeps you in the
room. Near the inner rail, look inward and down for **1.25 seconds** to commit
a fall into the Door. This works while standing without W, and farther down
the spiral. A brief peek makes you lean; looking away before commitment
cancels it. **Fall · The Door** starts the same scripted passage directly.
The fall lasts **7.2 seconds** and plays to completion once committed; reduced
motion skips its animation. From the Door, **Climb · The Vertigo** reverses
the passage and returns to the upper staircase.

The Midjourney plate tour and its reading balcony, which the piece began as,
were removed on 2026-10-12 (their artwork had already gone). They are in git
history: the last commit holding the art is the parent of `391c5fe`, and the
last holding the tour's source is `e50afe9`.

## Checks

After every change, run `npm run check`: lint, the frame-rate rule, the
geometry/path unit tests and the build, in about ten seconds with no browser.
`npm run shot` takes a picture of the world (`tools/shot.mjs`; `--help` for
its options).

The browser gate is no longer run after every change (see `AGENTS.md`): it
drives headless Edge through every room and takes tens of minutes. Run
`npm run check:navigation:smoke` when navigation, input or collision changes,
and `npm run check:major` when asked or after a large refactor; CI runs the
full gate nightly. The test-first navigation suite and its commands are
described in [docs/navigation-testing.md](docs/navigation-testing.md).
`npm run dev:checked:fast` provides automatic checks while editing. The
`npm run check:navigation:contracts` selection tests free looking, deliberate
steering, automatic path rejoining and the endless spiral passage. Those
acceptance cases also run in the major gate.

The browser suites use the `selenium-webdriver` development dependency.
Run these commands from the project root.

`npm run check:major` lints the app, checks the
frame-rate rule and path/collision math, drives the default world tour through
real navigation controls, and builds the app. The browser suite starts Vite
and headless Edge itself; no manually running server is required. Set
`BABEL_TEST_URL` to reuse a server, or `EDGE_DRIVER_PATH` for an offline driver.
Its own test server disables hot reload so edits cannot reset a journey in progress.

`npm run check:navigation:all` runs the navigation checks alone. The browser
pass checks all eight rooms forward and backward, map selection and return,
key release and focus loss, looking and dragging, repeated clicks, the Echo's
vantage, interrupted walking, finale completion/skip, real touch input, reduced
motion, refresh, and clearance along the built world's routes. It asserts
arrival at each destination instead of merely checking that movement started.
It fails with a nonzero exit code and preserves the scenario results, state
trace, browser errors, and a failure screenshot under `.ux-review/navigation/`.
Content hashes flag runs where app code, assets, or test configuration changed
while verification was in progress; a stale result cannot pass the gate.

Travel uses a 12× development clock and DPR 0.5 for practical software rendering;
basic held-key movement is checked at normal speed; stopping/travel use the faster clock. No jump/scrub/stroll hook
completes an input journey. These are navigation checks, not performance or
visual-quality benchmarks.

`.github/workflows/navigation.yml` runs `npm run check` on every push and pull
request, and the browser gate (its baseline and contracts suites as two
parallel jobs) nightly and when started by hand from GitHub Actions, uploading
the evidence.

`npm run dev:checked` starts automatic local runs. It starts
Vite, prints the app URL, and watches app code, assets, tests, dependencies and CI files.
Browser checks use a separate test server while that development window stays live.
It checks navigation at startup and after a batch of edits has been quiet for
15 seconds. Runs never overlap; edits made during a run queue a fresh check,
and an older result is not announced as current. `npm run check:navigation:watch`
provides the watcher without a persistent Vite session. Stop with Ctrl+C;
an active browser run finishes and cleans up before the watcher exits.

```powershell
npm run check:walls       # needs the dev server; walks every leg of the world
                          # tour and fails where it passes through the stone
npm run check:governor    # the frame-rate rule, handed numbers directly
npm run review:world-ux   # default world: mobile map, entry timing, return path
npm run check:selenium    # starts Vite and Edge; entering and leaving the world tour
```

The Selenium suite runs in headless Microsoft Edge and starts its own Vite server.
It checks entering and leaving the world tour.
Set `BABEL_TEST_URL` to test an already running server. Selenium Manager finds
the matching Edge driver on the first run (which may require network access);
on an offline machine, set `EDGE_DRIVER_PATH` to an installed `msedgedriver`.
The exit code is nonzero on failure, so the command also works in a precommit
hook or CI job.

`review:world-ux` runs a repeatable mobile first-use audit of the default world
tour and writes timing, layout, and development ideas to
`.ux-review/world-design-latest/report.md`. It starts Vite itself, or accepts
`BABEL_TEST_URL` for an existing server. It uses reduced motion and software
WebGL, so compare its timings across changes on the same machine rather than
treating them as real-device performance targets.

`check:walls` is the one to run after touching anything in `src/world`. It
stands where the camera will stand at forty points along each leg and asks the
geometry what is within reach: it caught every hallway in the Library standing
plugged by a 0.05-thick sliver of stone — the wall a corridor visibly ended in,
and then went through — and, under that, every wall in the world missing its
inner face, so a gallery was see-through from inside it. A still screenshot
shows neither, and nothing that only reads the source can.

## Deploying

```powershell
npm ci
npm run check:deploy
```

Upload the contents of `dist/` to the **site root** on a static host. The build
is a few megabytes of script, fonts and small static assets; the world is built in the
browser, not shipped as art. Its asset URLs begin with `/`, so serving it from
a subdirectory needs a Vite `base` setting and an updated build. `check:deploy`
lints the source, checks the frame-rate governor, builds the site, and checks
the output for missing files and stray video. Run `npm run check` before
publishing, plus `npm run check:navigation:smoke` when navigation, input,
collision or scene lifecycle changed (see `AGENTS.md`). A Git-based deployment must
include the new `src/` and `tools/` files in a commit; an uncommitted working
tree is not what the host will build.

### The video that used to be here

The tour was built around image-to-video clips: each painting woke into an i2v
render of itself while the reader stood in front of it, and there was a 5.7 MB
film behind the title card. All of it is gone from the piece.

The local video archive, raw source artwork, unused painting drafts and old
video color diagnostics have been removed, and the plates themselves went with
the plate tour. The offline processing scripts have been retired.

Nothing in `src/` names a `.mp4`. Putting the clips back is not a flag flip; it
means restoring the delivery table, the wake/replay loop, and the live half of
the painting shader from git history.

## Query flags

```
#<slug>               a room as an address (#vestibule … #web): written while
                      the reader stands in a room, read once at load — the map
                      opens with that room lit and offered first
?wsound=off           no sound at all (it otherwise starts with the first touch;
                      the strokes top right stop and start it)
?wperf                write what a frame costs, once a second, top left: median
                      milliseconds, pixel ratio, triangles, draw calls, passes
?coarse=1 ?thrift=1   force the touch / low-power mesh
?dpr=<n> ?governor=0  pin the pixel ratio, or watch the governor without it acting
```
