# Navigation testing

> **Paused (2026-10-07):** the navigation gate and checked development commands
> run only when explicitly requested, as recorded in `AGENTS.md`. Verify changes
> with `npm run build` and, where useful, a quick browser check. The GitHub
> workflow is manual-only.

These scripts run locally without an AI model. The following describes the
available suites and the verification workflow for when the gate is re-enabled.
At that point, frequent fast checks supplement the full major-change gate.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run check:fast` | Lint, governor rules, deterministic geometry, generated movement cases, and harness checks |
| `npm run dev:checked:fast` | Start Vite and rerun fast movement checks after each settled batch of edits |
| `npm run check:navigation:watch:fast` | Watch and rerun fast checks without starting the development server |
| `npm run check:navigation:smoke` | Entry, combined input/release, walking interruption, and both ending-skip keys |
| `npm run check:major` | All baseline and acceptance browser scenarios, fast navigation tests, lint and build |
| `npm run check:project` | The major-change gate followed by retained plate, responsive and balcony checks |
| `npm run check:navigation:contracts` | Focused acceptance checks for the controls and spiral passage |

For a focused browser case:

```powershell
npm run check:navigation:browser -- --scenario=finale-can-be-skipped
npm run check:navigation:contracts -- --scenario=vestibule
```

`--scenario` matches a stable scenario ID or part of its name. An unknown
selection fails rather than passing with zero tests. Filtered runs explicitly
report their scope and never replace the major-change gate. `--suite=all`
includes the baseline and acceptance contracts; it is used by `check:major`.

An offline Windows installation can use its existing matching Edge driver:

```powershell
$env:EDGE_DRIVER_PATH = 'C:\path\to\msedgedriver.exe'
```

For frequent local browser runs, the same functional assertions can use the
machine's graphics driver instead of software WebGL:

```powershell
$env:BABEL_BROWSER_GRAPHICS = 'hardware'
npm run check:navigation:smoke
```

The default remains `software` for portable CI. The world report records the
requested graphics profile and actual renderer. A faster renderer does not
change the tested inputs, geometry or assertions, and is not itself a measured
performance guarantee.

## Test-first acceptance contracts

These contracts were written and exercised before the navigation redesign.
They now run alongside the baseline journeys in the major-change gate.
They do not use `skip`, `todo`, expected-failure suppression, or a substitute
movement controller.

- While W remains held, arrows change gaze without releasing the route,
  changing the walking course, or letting the route turn the gaze back.
- Verify that combined action in the Vestibule, Echo, Silence, Door, Fork,
  Pavilion and Web of Time. The spiral has its separate passage contract.
- Releasing W, choosing a gaze, and pressing W anew selects the new heading.
- A deliberate detour permits independent movement. Crossing the path
  sideways remains independent; entering it along either direction resumes
  the corresponding route without a guidance button.
- Approaching the spiral rail remains distinct from committing the descent
  by sustained looking over it.

The spiral contracts also measure continued walking beyond twice the initial
stair length, require continued descent, and check cancellation by looking
away during a brief peek. This is a finite repeatability horizon, not proof
of infinitely many laps. Standing rail gaze and a fall after repeated turns
also use real input. Fast tests walk the actual pooled collision geometry
through twelve turns down and back up, include the decorative star backdrop,
and exercise long frame intervals. The pool retains eight rendered turns.

## Baseline and generated exploration

Browser scenarios establish their starting room using the actual map and
keyboard/mouse controls. A stuck preceding scenario is recovered by reloading
the page. No jump, scrub or stroll hook completes a tested input journey.
Observational development hooks read outcomes and accelerate travel only.
Arrival also waits for the room controls to finish becoming visible; a
rendered title alone does not make a moving entrance-animation target ready
for a touch gesture.

Baseline coverage includes destination controls in both directions, held-W
journeys through all library/garden rooms, simultaneous walking and looking,
key release and focus loss, map selection, the Echo vantage, interruption,
ending completion/skip, actual touch, reduced motion and refresh. Geometry
sweeps remain separately identified.

The fast generated tests use four fixed, printed seeds. They exercise 96
rotated thin-wall cases, 120 forward/reverse routes with 121 samples each,
and 2,000 free movement steps on bounded supported ground. They test the
same path and body modules the app uses. Failure messages retain the seed
and case index. This sampling does not enumerate every point in the world.

## Evidence and reporting

Every browser run retains `.ux-review/navigation/<run>/report.json` and
`report.md`. Each failing scenario receives its own screenshot when the
browser remains available. Per-scenario snapshots retain navigation state;
contracts also retain passive per-frame movement recordings.
The gaze recording reads the camera's rendered orientation, rather than
assuming that the requested arrow-key angle is what appeared on screen.
The free-look check retains the gaze's offset relative to the walking body,
so it permits natural body turns without permitting automatic recentering.

One failure does not end the suite: later independent scenarios execute.
Infrastructure failures still abort with a nonzero exit code, retaining
unexecuted scenarios. Source fingerprints invalidate a run if files changed
while it was running. Passed, failed, not run, and not selected remain distinct.

The default browser configuration uses software WebGL. It checks functional
behavior and movement outcomes, not actual-device visual comfort or rendering
performance. Hardware frame-time baselines and quantitative acceleration/
camera-jitter thresholds are a further test layer, not a claim of this suite.

## Other experiences

The default world gate does not cover the retained plate tour or reading
balcony. `npm run check:legacy` starts its own server for their checks;
`npm run check:project` combines both gates. Their individual commands remain:

```powershell
npm run check:selenium -- plates responsive
# With a Vite server already running:
node tools/balcony-check.mjs
```

## Implementation discipline

When the gate is re-enabled, run a behavior change's contract first and retain
the failing evidence.
Make the smallest runtime change, run fast and focused browser checks, and
then complete `npm run check:major`. Never relax an assertion just to obtain
a green report. Check the intended behavior and diagnose failed or unexecuted
scenarios. Read compact summaries first; load detailed traces on failure.
