---
name: verify
description: Build, launch, and headlessly drive the babel-tour app to verify changes at the rendered surface
---

# Verifying babel-tour changes

The piece is the world tour (`src/WorldTour.jsx` → `EntryMap.jsx` → `src/world`).

## Check

```
npm run check     # lint + frame-rate rule + geometry/path unit tests + build, ~10 s
```

Lint has pre-existing `exhaustive-deps` warnings in `EntryMap.jsx` and one
`only-export-components` in `Failure.jsx`: ignore them, not new ones.
The browser test gate is off: see `AGENTS.md` for when its suites still run.

## Look

```
npm run shot -- --room=1                     stand in room 1 (0-7; 1 is the Echo)
npm run shot -- --room=0,1,2 --up            several rooms, at their vantages
npm run shot -- --room=3 --look=0.6,-0.3     turn the head (yaw, pitch; radians)
npm run shot -- --eye=0,200,300:0,0,0        look from a point at a point
npm run shot                                 the map
npm run shot -- --ab=wmap5=old --room=1      the same frame without and with a flag
npm run shot -- --help                       every option
```

`tools/shot.mjs` starts its own Vite (no HMR, its own dep cache, a free port:
it never touches a dev server the user has running) and a headless browser,
waits for the world to be built and drawn, and writes PNGs to
`.ux-review/shots/`. Then **Read each PNG** — a change is not verified until
you have looked at it.

- **Linux (cloud sessions):** Chromium at `/opt/pw-browsers/chromium`,
  software WebGL. A page load takes about **six minutes** (the world is built
  in the browser); run the command in the background and do other work. Every
  `--ab` side and every query string is a fresh page load, so ask for several
  rooms in one call rather than calling it once per room. Keep `--size` at the
  default 960x600 or smaller: large frames starve the renderer and the
  screenshot times out.
- **Windows / macOS:** Edge or Chrome with the GPU (`--software` to force
  software WebGL). `--browser=PATH` or `BROWSER_PATH` picks another browser.
- Reduced motion is emulated (the opening and the flights are cuts);
  `--motion` turns that off, and then flights take a minute or more headless.
- `--strict` exits 1 on a page error or a console error, such as a shader
  that does not compile: use it after touching GLSL in `buildWorld.js`.

Comparing two looks: shoot them in **one** `--ab` call, not two runs.
Software WebGL's exposure differs enough between sessions to fake a
difference. To measure what changed, diff the two PNGs (for example with
Python's PIL: `ImageChops.difference(a, b).getbbox()`): the garden's water and
flowers move between frames, so ignore noise there.

## Driving it yourself

For anything `shot.mjs` cannot do (pressing keys, dragging, touch), copy its
DevTools-protocol client: it is plain Node (global `WebSocket`), no
dependencies. Input reaches the app through `Input.dispatchKeyEvent`,
`Input.dispatchMouseEvent` (pressed → moved steps → released is a drag) and
`Input.dispatchTouchEvent` (a synthetic `PointerEvent` has no live pointer and
cannot be captured, so test the touch walk button with real touch events).

Dev hooks (dev builds only, set in `World.jsx`):
- `__worldJump(i, up)` — stand in room `i` (0-7) at once, at its vantage if `up`.
- `__worldLook(yaw, pitch)` — turn the head at a stand.
- `__worldEye({ from, at, fov })` — look from a point at a point; `null` gives the eye back to the walk.
- `__worldScrub(t)` — hold a leg or the finale at a point; `null` lets it run.
- `__worldSim({...})` — walk a move on a fixed clock, without waiting on frames.
- `__worldBench(n)` — milliseconds per frame of the scene alone, drawn `n` times.
- `__worldScene`, `__worldCamera` — the three.js scene and camera.

Wait for the world with `window.__worldJump && document.querySelector('.entry-map.is-world')`,
polled inside the page (`Runtime.evaluate` with `awaitPromise`), not from the driver.

## Gotchas

- Old looks sit behind `?w…=old[:n]` flags, one module per design board
  (`src/world/*Fix*.js`). When the user picks between options, follow
  "Variants of a look" in `AGENTS.md`.
- Never stop a server by its port number: the user's own `vite` may be on 5173.
  Stop only processes you started (`shot.mjs` cleans up after itself).
- A still frame under software WebGL can show artifacts the GPU does not
  (slow texture decode, a frame caught mid-ease). Re-shoot with a longer
  `--settle` before believing a rendering bug.
