# Babel Tour verification

**PAUSED (2026-10-07):** the navigation test gate is switched off because it
was slowing development to a crawl. Do NOT run `npm run check:major`,
`check:navigation*`, `check:fast`, `check:project` or `dev:checked*` unless
the user asks for them in that request. Verify a change with `npm run build`
and, where useful, a quick look in the browser. The rest of this file
describes the gate for when it is switched back on.

After every major change to the world, navigation, input handling, entry map,
room controls, collision geometry, scene lifecycle, catalogue, or responsive
layout, run `npm run check:major` before reporting the work complete. Treat a
failed or unexecuted navigation scenario as unfinished verification. Read the
navigation report and diagnose a failure; never weaken an assertion to make a
change pass without establishing the intended behavior.

The command runs geometry/path unit tests and real browser navigation tests,
then builds the app. It starts its own Vite server and headless Edge. On an
offline machine, set `EDGE_DRIVER_PATH` to an installed Edge driver. In the
Codex sandbox, a browser may need approved execution outside the sandbox.
Keep existing unrelated working-tree changes intact.

The browser suite tests the default world tour with real keyboard, mouse and
touch input. Development diagnostics only observe outcomes and accelerate the
clock; do not replace tested inputs with jump/scrub/stroll hooks. Geometry
sweeps are separate coverage. Reports and failure screenshots are written to
`.ux-review/navigation/<run>/` and must retain failed and unexecuted scenarios.

When changing the retained plate tour or reading balcony, also run the relevant
existing Selenium/plate or balcony checks. The world navigation suite does not
claim coverage of those separate experiences.
