# Startup performance

Measure with `npm run shot -- --profile --name=startup --strict`. The tool
records `world:*` timeline marks, main-thread long tasks and a JavaScript CPU
profile in `.ux-review/shots/startup-startup.json`, alongside a screenshot.
The `profile` field can be saved as a `.cpuprofile` for Chrome or Edge DevTools.
Use separate names for before and after runs. Avoid concurrent builds or browser
tests while measuring.

## 2026-10-19: reduce waste while planting the garden

Baseline: `553122d`. Garden path checks allocated a sliced array, a mapped
array and a projected point for each segment on every query. They now walk
the segments directly and skip a full distance calculation when either axis
already exceeds the nearest distance. The projection arithmetic is unchanged.
The same helper checks the garden boundary.

Trees excluded by the paths still spend their established growth and leaf
draws, but no longer refine bark or create vertex buffers that would immediately
be discarded. Their leaf-colour draws are retained without mixing unused colours.
All planted trees retain their full detail.

The local Node benchmark of 40,000 queries against a 119-segment path improved
from **162.4 ms to 66.8 ms** (seven-run medians after two warm-ups; 59% less CPU
time). Tests compare exact distances over 10,500 seeded queries and cover
endpoints and degenerate paths. Tree checks compare growth, foliage and the
next growth, weeping and tint draws with and without bark construction.

Headless Edge/GPU at 960×600 measured navigation-to-ready at 18.3 seconds
before and 17.2 / 30.8 seconds after. The variation in painting, construction
and driver waits prevents a reliable claim about total loading-time savings.
These changes reduce specific startup work; they do not establish a general
page-load percentage improvement.

Scene fingerprints retain identical geometry for all 1,345 objects, material
code and all 414 captured shader sources. The raw comparison still differs in
23 animated material values, 27 transforms and one animated instance buffer.
The map, Fork and Pavilion captures were inspected. Profiles, fingerprints,
the distance benchmark and pictures are in `.ux-review/qa/load-2026-10-19/`.

## 2026-10-19: skip secondary views outside the frame

Baseline: `08b1c7c`. Doorways checked their projected corners, treating a
corner behind the near plane as a full-screen opening. An entire doorway
behind the eye could therefore render the far room unnecessarily. A world-space
frustum check now rejects an invisible opening before that fallback, while
retaining openings that genuinely cross the near plane.

The water reflection previously checked distance alone. It now checks the
visible bounds of actual water meshes, including their parent visibility;
fish and pebbles registered to be hidden during reflection cannot request a
reflection themselves. Looking back refreshes the reflection in the same frame.
The pass also restores each surface item's previous visibility rather than
making every registered object visible after drawing.

Headless Edge, GPU/D3D11, 1440×900, `?wperf`, settled DPR 1:

- Echo arrival: secondary scene passes fell from about 2.7 to 1.7 per frame,
  and rendered triangles from 8.3M to 7.5M. The measured frame rate remained
  about 14–15 fps; the main room and its mirrors are still expensive.
- Looking up from the Fork: the pond pass is skipped, leaving one scene pass,
  270 calls and 3.5M triangles (45–50 fps in this capture).
- The normal Fork and Pavilion views still draw their visible water reflection.
  Their rendering cost is substantially unchanged; these checks do not show a
  general frame-rate improvement.

Five rendering regression checks cover invisible and near-plane doorways,
crossing while looking away, reflection visibility/return, and restoration after
a failed draw. They run in `npm run check`. Inspected before/after captures and
runtime samples are in `.ux-review/qa/performance-2026-10-19/` (`runtime-*`,
`visibility-*`).

## 2026-10-19: keep the curved trees, reduce repeated work

Baseline: `8160d31`. The new wood refinement rebuilt centripetal spline
coefficients for every sample, searched unrelated branches, and allocated two
temporary vectors per bark vertex. Fixed control-point curves now cache their
coefficients; branch searches reject bounds outside their attachment tolerance;
ring directions and normal scratch vectors are reused.

On the local Node runtime, a batch of 192 seeded specimens covering all six
species, distant/near detail, weeping willows and cedar spires improved from
**576.4 ms to 283.7 ms** (five-run medians, after two warm-ups; 51% less time).
All 456,361 vertices, 735,424 triangles, geometry attributes and foliage outputs
have the same SHA-256 hash before and after. Browser startup profiles also show
`growTree` CPU time falling from 1,020 ms to 640 ms.

The full scene fingerprints have identical geometry for all 1,345 objects and
the same 414 captured shader sources. The raw comparison reports animated
uniforms/material values, moving transforms and one animated instance buffer
as different; it is not a full-state equality result. Total profiled startup
varied from 22.1 to 32.7 seconds as painting and shader/upload waits changed,
so these runs do not establish an overall page-load speedup. Raw timings,
profiles, fingerprints and the reproducible specimen benchmark are retained in
`.ux-review/qa/performance-2026-10-19/`.

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
