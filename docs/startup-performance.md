# Startup performance

Measure with `npm run shot -- --profile --name=startup --strict`. The tool
records `world:*` timeline marks, main-thread long tasks and a JavaScript CPU
profile in `.ux-review/shots/startup-startup.json`, alongside a screenshot.
The `profile` field can be saved as a `.cpuprofile` for Chrome or Edge DevTools.
Use separate names for before and after runs. Avoid concurrent builds or browser
tests while measuring.

## 2026-10-20: keep the opening's cadence even through handover

The opening targeted roughly 27 updates a second during construction, then
deliberately fell to 10 while the hidden world drew its first two frames.
On a 60 Hz display this made ordinary updates alternate between about 33 and
50 ms; the handover could leave 116 ms between updates even without a stall.
It now keeps a 30 Hz deadline throughout, allowing 1 ms of callback timestamp
jitter and preserving the deadline's phase when callbacks arrive late.

A controlled run of the actual `startInk` driver, with raster calls stubbed
and callback jitter of up to 0.3 ms, checked 60, 90 and 120 Hz displays. Each
1.4-second sample produced 42 updates both before and during handover. At
60 Hz the longest scheduled gap fell from 50.4 to 33.9 ms during construction
and from 116.4 to 33.9 ms during handover. `inked` and `gone` each fired once,
and stopping cancelled the pending callback. The measurements are in
`.ux-review/qa/opening-smoothness/cadence.json`.

These are scheduling checks, not a claim that GPU or main-thread loading
stalls have disappeared. The opening can now use more GPU time during the
world's first frames instead of deliberately slowing its own animation.
Full-motion before/after captures and startup timing records are alongside
the cadence results. Scene construction and the readiness conditions are
unchanged.

The full `npm run check` passes on an isolated copy of `2f11773` with this
ink change applied (`check-2f11773/full-check.log` in the same review folder).
The shared checkout's check fails in the separate cherry changes committed
as `4a4248a`: seed 94400, limb 51 is detached by 0.3246 against the existing
0.15 tolerance. The committed tree baseline passes all 28 tree checks. The
assertion and the cherry work were left unchanged by this pacing fix.

## 2026-10-20: batch the opening's green dots

The green forking paths stamped a separate gradient image for every dot on
every frame. They now collect the projected dots into three concentric paths
and fill each path once. Three translucent discs approximate the former soft
dot; planting, path positions, reveal times and the opening's camera are kept.

A controlled replay of the completed garden at 960×600, progress 0.94 and
12 seconds recorded **553 dot image draws replaced by three fills per frame**.
The whole ink frame went from 751 image draws / 593 fills / 171 strokes to
198 image draws / 596 fills / 171 strokes. This counts Canvas API operations,
not GPU draw calls or an established improvement in overall startup time.

Worker timers alone did not improve a controlled two-second main-thread stall.
CPU rasterization also failed to improve the measured cadence consistently;
both experiments were removed. The final change retains accelerated canvas
drawing and the existing animation scheduler. `npm run check` passes; replay
counts and rendered opening captures are in `.ux-review/qa/ink-lag/`.

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
