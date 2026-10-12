---
name: verify
description: Build, launch, and headlessly drive the babel-tour app to verify changes at the rendered surface
---

# Verifying babel-tour changes

The piece is the world tour (`src/WorldTour.jsx` → `EntryMap.jsx` → `src/world`).
The Midjourney plate tour was removed on 2026-10-12; nothing below applies to it.

## Build / lint
```powershell
Set-Location babel-tour
npx oxlint src          # pre-existing warnings: exhaustive-deps in EntryMap — ignore
npx vite build          # chunk-size warning is pre-existing
```
The navigation gate (`check:major`, `check:navigation*`) is paused: see AGENTS.md.

## Launch
The user often already has `vite` running on port 5173 — it binds **IPv6 `::1` only**,
and other apps share that port. Never stop a server by port number. Start your own on
another port with its own `cacheDir` and `hmr: false`, check the page `<title>` says
"La Biblioteca de Babel", and stop only the PID you started.

## Drive headlessly (zero-dep CDP)
Node 24 has global `WebSocket` — no puppeteer needed. Spawn Edge with a real GPU:
`msedge.exe --headless=new --remote-debugging-port=<n> --use-angle=d3d11
--ignore-gpu-blocklist --user-data-dir=<ABSOLUTE tmp path> --no-first-run about:blank`
(a relative `--user-data-dir` makes the browser die silently). Keep the profile
directory between runs: a cold profile draws no frames for the first run.

Then: GET `/json/version` → browser ws → `Target.createTarget`, `Target.attachToTarget
{flatten:true}`, `Emulation.setDeviceMetricsOverride` (`mobile: true` plus
`Emulation.setTouchEmulationEnabled` for a phone), `Page.navigate`, wait for
`window.__worldJump && document.querySelector('.entry-map.is-world')`, then
`Page.captureScreenshot`.

Dev hooks (dev builds only, set by `World.jsx`):
- `__worldJump(i)` — stand in room `i` (0-7) at once; `__worldJump(i, true)` at its vantage.
- `__worldLook(yaw, pitch)` — turn the head at a stand.
- `__worldScrub(t)` — hold a leg or the finale at a point; `null` lets it run.
- `__worldSim({...})` — walk a move on a fixed clock, without waiting on frames.
- `__worldBench(n)` — milliseconds per frame of the scene alone, drawn `n` times.

Input reaches the app through CDP: `Input.dispatchKeyEvent`, `Input.dispatchMouseEvent`
(pressed → moved steps → released is a drag) and `Input.dispatchTouchEvent`
(`touchStart` … `touchEnd`; a synthetic `PointerEvent` has no live pointer and cannot
be captured, so test the touch walk button with real touch events).

## Gotchas
- The harness usually emulates `prefers-reduced-motion`, under which a walked leg is a
  cut and the finale is skipped. Drop the emulation to see either; flights then take
  a minute or more headless.
- Kill Edge by its `--remote-debugging-port` in the command line: the launched
  process exits and the browser outlives it, leaving the profile locked.
- Old looks sit behind `?w…=old[:n]` flags, one module per design board
  (`src/world/*Fix*.js`). Shoot the A/B pair in the same session.
