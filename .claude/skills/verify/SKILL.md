---
name: verify
description: Build, launch, and headlessly drive the babel-tour app to verify changes at the rendered surface
---

# Verifying babel-tour changes

## Build / lint
```powershell
Set-Location babel-tour
npx oxlint src          # pre-existing warning: exhaustive-deps on the tick effect — ignore
npx vite build          # chunk-size warning is pre-existing
```

## Launch
The user often already has `vite` running on port 5173 — it binds **IPv6 `::1` only**,
so probe `http://localhost:5173/` (NOT `127.0.0.1`). If nothing is listening, start
`npx vite --port 5173 --strictPort` in the background from `babel-tour/`.

`?dev=1` (dev builds only) skips the entry veil, marks the tour as entered, opens the
garden door, and settles the camera at the vortex (deepest library gallery). It also
exposes `window.__setDive(el)` to freeze the dive at any progress.

## Drive headlessly (zero-dep CDP)
Node 24 has global `WebSocket` — no puppeteer needed. Spawn Edge:
`msedge.exe --headless=new --remote-debugging-port=9333 --enable-unsafe-swiftshader
--use-gl=angle --use-angle=swiftshader --user-data-dir=<ABSOLUTE tmp path> --no-first-run about:blank`
(relative `--user-data-dir` makes the browser die silently — always absolute).

Then: GET `/json/version` → browser ws → `Target.createTarget{url}` (no width/height),
`Target.attachToTarget{flatten:true}`, `Emulation.setDeviceMetricsOverride`,
**wait ~13s** for WebGL textures under swiftshader, `Page.captureScreenshot`.

Input works through CDP and reaches the app's window/pointer handlers:
- `Input.dispatchKeyEvent` (`rawKeyDown`+`keyUp`, `modifiers: 8` = Shift)
- `Input.dispatchMouseEvent` pressed → ~14 moved steps → released simulates a drag

Give eased camera state ~2s to settle before each screenshot. A known-good driver
script pattern is in the session scratchpads as `look.mjs` (spawn, ws send/await,
key/drag/shot helpers).

## Gotchas
- The headless clock is unreliable for pacing — under swiftshader the rAF-driven
  sim runs ~10× slow, so chapter crossings that take ~7s on real hardware barely
  move in a 10s headless wait. Do NOT diagnose "navigation broken" from a stale
  `DEPTH n/4` label alone; read `window.__nav()` (dev+?dev only — returns
  `{target, descent, immT, diving}`) to see whether the *target* moved. For the
  dive use the frozen-progress hook `window.__setDive(el)`.
- Navigation state to eyeball in shots: `DEPTH n/4` label, progress bar, chapter card
  title — these confirm whether an input walked, dove, or only moved the gaze.
- Depth/layering regressions to look for in shots: bright fragments floating
  detached over dark voids = the next chapter's near band poking through this
  chapter's far band (the DEPTH_SPREAD interleave ceiling — see the constant's
  comment).
