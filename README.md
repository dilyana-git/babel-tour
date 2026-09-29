# Babel Tour

## The world tour

The piece opens on a map of the whole walk — a honeycomb of hexagonal galleries
built in three.js (`src/world/`), tilted to show its bookshelf walls — and
choosing a room flies down into it. From there the reader stays in the world:
**drag**, **A/D** or the **arrow keys** look around, **W** walks on to the next
room, **S** walks back, **M** rises to the map. The walks are real: through the
hallways, over the Echo's crossing stair, down the Vertigo's spiral into the
light and out in the Door, along the pergola, across the zigzag bridge, and
through the maze to its heart.

The Midjourney plate tour is set aside, not deleted: open the page with
`?plates` to walk it (everything below about plates, depth maps and the
balcony belongs to that tour).

## The reading balcony

Choose **explore balcony** in the tour controls to enter a small, walkable 3D
library overlooking the existing Vestibule artwork. The stone floor, columns,
balustrade, shelves, lantern and reading stand are geometry; the immense library
beyond the railing remains a painted backdrop. This is a single-room prototype.

- **WASD** walks and strafes; **drag** or **arrow keys** look around.
- **Enable mouse look** captures the pointer. Escape releases it; Escape again
  returns to the tour. Movement has a fixed eye height and solid boundaries.
- Approach the book beyond the right column and press **E**, or use its prompt,
  to open it. Approach the rear entrance and press **E** to return.
- On touch, hold the directional buttons to walk and drag the scene to look.
- **Return to tour** restores your position. Automatic drift pauses on entry.

The balcony loads on demand and adds no external models or runtime dependencies.
With Vite running, `node tools/balcony-check.mjs` checks collision, browser input,
the book and entrance, focus restoration, and touch layout and gestures. It saves
screenshots under `.ux-review/balcony/`.

## Checks

None of these adds a runtime or test dependency. Run them from the project root.

```powershell
npm run check:walk       # needs the dev server; teleports through all eight
                         # galleries and fails on anything thrown
npm run check:walls       # needs the dev server; walks every leg of the world
                          # tour and fails where it passes through the stone
npm run check:governor    # the frame-rate rule, handed numbers directly
npm run check:plates      # successful and failed image decoding, including older browsers
npm run verify:assets     # every plate and depth map a walk can ask for — and
                          # every finished plate the catalogue never hung
npm run review:ux         # needs the dev server; the heuristic UX pass below
npm run review:world      # needs the dev server; default tour, mobile and no-WebGL smoke check
```

`check:walk` is the one to run after moving code between modules. A free
variable is a runtime error, so the build, the bundler and oxlint are all blind
to it; only something that walks the tour can see it.

`check:walls` is the one to run after touching anything in `src/world`. It
stands where the camera will stand at forty points along each leg and asks the
geometry what is within reach: it caught every hallway in the Library standing
plugged by a 0.05-thick sliver of stone — the wall a corridor visibly ended in,
and then went through — and, under that, every wall in the world missing its
inner face, so a gallery was see-through from inside it. A still screenshot
shows neither, and nothing that only reads the source can.

`verify:assets` earns its place for the second half of its job. It reports art
that is *finished* — colour plate, depth map and baked backdrop all present —
but that no node hangs. That is not a failure and it does not fail the run, but
it is the one thing about this project that has gone wrong silently more than
once: work that was completed and then simply never put in the piece.

## Deploying

```powershell
npm ci
npm run check:deploy
```

Upload the contents of `dist/` to the **site root** on a static host. The build
is currently around **58 MB**, mostly WebP plates and depth maps. Its asset URLs
begin with `/`, so serving it from a subdirectory needs a Vite `base` setting
and an updated build. `check:deploy` lints the source, verifies art references,
checks the frame-rate governor and image decoding, builds the site, and checks the output for
missing art and stray video. Run the browser checks above against the intended
source before publishing. A Git-based deployment must include the new `src/`,
`tools/`, and artwork files in a commit; an uncommitted working tree is not what
the host will build.

### The video that used to be here

The tour was built around image-to-video clips: each painting woke into an i2v
render of itself while the reader stood in front of it, and there was a 5.7 MB
film behind the title card. All of it is gone from the piece.

What is left locally is ~2.4 GB of archive under `source-assets/video-archive/`: `video/` (the untagged
originals), nine super-resolution experiment roots, `overture.mp4`, and
`clip.mp4`. They are ignored for future commits (see `.gitignore`) and
**deliberately kept on disk** — several clips survive nowhere else. The archive
sits outside Vite's `public/` directory so local builds do not copy it into
`dist/` before removing it. `verify-dist.mjs` still checks that no video ships.

Nothing in `src/` names a `.mp4`. Putting the clips back is not a flag flip; it
means restoring the delivery table, the wake/replay loop, and the live half of
the painting shader from git history.

## Automated UI/UX review

With the Vite app running on `localhost:5173`, run:

```powershell
npm run review:ux
```

`npm run review:ux` checks the optional `?plates` tour. `npm run review:world`
checks the default 3D route, its lightweight entry map, keyboard and room
navigation, the 390 px layout, and the reading route when WebGL is unavailable.
It runs Chromium with the reduced mesh and postprocessing off so headless
software rendering can complete the interactions; `check:walls` covers the full
world geometry. Its evidence is written to `.ux-review/world/`.

The plate review agent opens a headless Chromium browser, clicks through the entry,
help, audio, autoplay and chapter controls, checks keyboard navigation, repeats
the layout check at 390 px, and writes screenshots plus prioritized feedback to
`.ux-review/latest/report.md`. It uses the browser's DevTools protocol directly,
so it adds no runtime or test dependency.

Options:

```powershell
npm run review:ux -- --url http://localhost:5173 --out .ux-review/my-run
npm run review:ux -- --browser "C:\path\to\chrome.exe" --no-mobile
```

Start the app first with `npm run dev`. The agent exits with a clear message if
the target is not reachable. Its report is a repeatable heuristic review; use it
alongside manual visual, assistive-technology, and user testing.

Note that its screenshots are captured through the DevTools protocol and can
tile or crop the canvas; judge framing from a purpose-made capture, not from
those files.

## Query flags

```
?variant=<fragment>   pin one painting by filename fragment; a pinned session
                      never restocks and leaves no marks on the saved walk
?node=<slug>&?ch=<n>  land on a gallery by name or by index (dev builds)
?coarse=1 ?thrift=1   force the touch / low-power mesh
?dpr=<n> ?governor=0  pin the pixel ratio, or watch the governor without it acting
```
