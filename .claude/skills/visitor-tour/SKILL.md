---
name: visitor-tour
description: Send a role-play first-time visitor through babel-tour headlessly and get a UX report — what landed, what confused them, ranked friction. Use when asking "how does this actually feel to someone arriving cold", not to verify a specific change (that's the verify skill).
---

# Sending a visitor through babel-tour

Spawns a subagent that plays the piece as a curious first-time reader and reports
what the experience was like. Complements `verify`: that one checks whether a
change is correct, this one checks whether the piece *works on someone*.

The piece is the world tour: a map of a honeycomb of galleries, a flight down
into a room, then W to walk the way through eight rooms (the Vestibule, the
Echo, the Silence, the Vertigo, the Door, the Fork, the Pavilion, the Web of
Time), M or Escape back to the map. `README.md` describes the controls.

## Read this before you trust the output

A visitor agent's **observations are valuable and its explanations are not**. The
first run of this (2026-08-05, on the plate tour this piece began as) produced a
confident ten-item ranked list whose top two findings were both false: it
blamed an idle drift that was switched off, and a dissolve that a direct sweep
showed never happened. Its evidence was one shot taken seconds after a resize.

The agent cannot see the clock or the code, so it narrates a plausible mechanism for
whatever it photographed — and software WebGL manufactures artifacts (slow
texture decodes read as "broken room", a frame caught mid-ease reads as "smear")
that are indistinguishable from real ones in a still frame.

**So: treat the report as a list of coordinates to go look at, never as a diagnosis.**
Before changing anything, reproduce the artifact yourself (`npm run shot`, see the
`verify` skill) and read the mechanism it names. The findings that tend to survive
are the ones that need no renderer at all — discoverability, affordance,
information architecture.

## Launch

1. **A dev server**, if none is running: `npx vite --port 5173 --strictPort` from the
   repo root, in the background. It may bind IPv6 only: use `http://localhost:5173/`,
   not `127.0.0.1`. Never stop a server you did not start.
2. **A browser** listening for DevTools on port 9333, with an absolute profile path
   (a relative `--user-data-dir` makes the browser die silently):

   Linux (cloud sessions; software WebGL):
   ```bash
   /opt/pw-browsers/chromium --headless=new --no-sandbox --remote-debugging-port=9333 \
     --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
     --user-data-dir=/tmp/visitor-profile --no-first-run about:blank &
   ```
   Windows (GPU):
   ```powershell
   msedge.exe --headless=new --remote-debugging-port=9333 --use-angle=d3d11 `
     --ignore-gpu-blocklist --user-data-dir=<ABSOLUTE tmp path> --no-first-run about:blank
   ```
3. **Drive it** with the `driver.mjs` shipped next to this file:

   ```bash
   SHOT_DIR=<abs path> VW=640 VH=360 node driver.mjs "$(cat steps.json)"
   ```

   Write `steps.json` to a file rather than inlining the JSON — quoting nested JS in a
   shell argument is where these runs go to die. Step keys are documented at the top
   of `driver.mjs`. Start every visit with an `open` and an `until` that waits for the
   world:

   ```json
   [{ "open": "http://localhost:5173/", "wait": 1000 },
    { "until": "document.querySelector('.entry-map.is-world')", "settle": 3000, "shot": "01-arrival" }]
   ```

Kill only the browser you started (by its `--remote-debugging-port` in the command
line: on Windows the launched process exits and the browser outlives it).

### Headless traps

- **It is slow.** Under software WebGL the world takes about six minutes to build
  and a flight between rooms a minute or more. Use `until` rather than guessing a
  `wait`, and give eased camera state a few seconds' `settle` before each shot.
- **Shoot small: 640×360.** Large viewports starve rAF under software WebGL: the
  clock stops and the captured PNG can disagree with a correct DOM. Drive small;
  re-shoot anything that looks like a rendering bug at the user's aspect (with
  `npm run shot`) before believing it.
- **Wait for mounts inside the page**, not in the driver: `until` polls in-page.
- **Scrubbing an animation:** `a.pause()` **before** setting `a.currentTime`, or it
  re-syncs to the document timeline and the seek silently reverts.
- **Never report FPS or smoothness.** Meaningless under software WebGL.
- The page emulates no reduced motion unless asked; with reduced motion the
  opening and the flights are cuts.

## The agent prompt

Spawn a `general-purpose` subagent in the background with roughly this, adjusted for
whatever you want the visit to focus on:

> You are a FIRST-TIME VISITOR to an art website; your job is honest UX feedback.
> A vite dev server is already running at http://localhost:5173/ and a headless
> browser is listening for DevTools on port 9333. Do not restart either; do not build.
>
> **Staying in character.** Form impressions ONLY from what you can see on the
> rendered screen — screenshots are your eyes. You may read
> `.claude/skills/visitor-tour/SKILL.md` and its `driver.mjs` for MECHANICS. Do NOT
> read the source to explain away something that confused you; if you got lost,
> that IS the finding. Start at the plain URL with no query params. Only after
> honestly failing to reach somewhere unaided may you use the dev hooks
> (`__worldJump(i)` stands in room i) — and say when you do.
>
> **Report observations, not causes.** Describe what you saw and what you did. Where
> you want to explain *why* something happened, label it `UNVERIFIED GUESS` — a
> reader of your report will check it against the code, and a confident wrong
> mechanism costs them more than no mechanism. Never report FPS or smoothness.
> Where you cannot tell whether a problem is the software renderer or the piece
> itself, say so explicitly instead of picking one.
>
> **Do:** land on the map, work out what you're for, choose a room, walk, look
> around, find what there is to find (a library; a garden; an ending). Turn all the
> way around. Dwell still. Go back to the map. Then try what a confused person
> tries — clicking randomly, unbound keys, resizing, walking backwards. Screenshot
> every meaningful moment and actually LOOK at each one with the Read tool.
>
> **Deliver:** (1) first 15 seconds — what you thought this was, what you tried;
> (2) walkthrough, beat by beat, referencing screenshots by filename; (3) what
> worked, specifically why; (4) what didn't — confusions, dead ends, anything ugly
> (floating fragments, hard edges, feeling like you float rather than stand);
> (5) ranked friction list, worst first, each with what you'd expect instead;
> (6) any `UNVERIFIED GUESS` notes, clearly separated.

## After the report

1. Relay the observations; the agent's final report is not shown to the user.
2. Pick the findings that need no renderer to verify and act on those first.
3. For anything visual, reproduce it yourself at the user's aspect with a generous
   settle before touching code.
4. Read the mechanism behind any causal claim before acting on it.
5. Kill only the browser instances you spawned; leave the user's dev server alone.
