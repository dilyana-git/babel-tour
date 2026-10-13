# Startup performance

Measure with `npm run shot -- --profile --name=startup --strict`. The tool
records `world:*` timeline marks, main-thread long tasks and a JavaScript CPU
profile in `.ux-review/shots/startup-startup.json`, alongside a screenshot.
The `profile` field can be saved as a `.cpuprofile` for Chrome or Edge DevTools.
Use separate names for before and after runs. Avoid concurrent builds or browser
tests while measuring.

## 2026-10-13: reduce loading freezes

Baseline: `c75ab94`. Headless Edge, AMD Radeon integrated graphics through
ANGLE/D3D11, 960×600, reduced motion, local Vite development server, CPU profiler
enabled. These are local measurements with warmed browser caches, not a
production-network or cold-cache benchmark.

| Measurement, through `world:ready` | Before | After, two runs |
| --- | ---: | ---: |
| Navigation to ready | 25.9 s | 20.8 / 22.6 s |
| Longest main-thread task | 4.13 s | 1.30 / 1.12 s |
| Sum of each long task's duration beyond 50 ms | 18.78 s | 8.41 / 8.48 s |
| Tasks longer than 500 ms | 10 | 6 / 5 |

The profiler found synchronous texture uploads waiting on GPU work while
shaders were still compiling, as well as uninterrupted gallery and lawn
construction. The changes:

- Submit shader variants in short batches, and wait for all programs attached
  to each material before uploading textures. Include textures introduced by
  `onBeforeCompile` in the upload preparation.
- Target 12 ms of work between yields. Yield between library galleries,
  lantern lawns and the largest initial canvas paintings, preserving the
  construction order and every random draw.
- Keep unnamed construction yields out of the section-based progress count.

The before/after scene fingerprints contain the same 1,147 objects, identical
geometry and all 331 captured shader sources. The raw comparison still reports
animated material uniforms, moving transforms and one animated instance buffer
as different; it is not an exact full-state equality result. The map, Vestibule
and Fork screenshots were inspected.

Loading still includes several seconds of asynchronous shader preparation and
some large individual construction/first-render calls. The changes reduce
freezes without reducing scene detail; they do not make startup instantaneous.
