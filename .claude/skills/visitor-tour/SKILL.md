---
name: visitor-tour
description: Send a role-play first-time visitor through babel-tour headlessly and get a UX report — what landed, what confused them, ranked friction. Use when asking "how does this actually feel to someone arriving cold", not to verify a specific change (that's the verify skill).
---

# Sending a visitor through babel-tour

Spawns a subagent that plays the piece as a curious first-time reader and reports
what the experience was like. Complements `verify`: that one checks whether a
change is correct, this one checks whether the piece *works on someone*.

## Read this before you trust the output

A visitor agent's **observations are valuable and its explanations are not**. The
first run of this (2026-08-05) produced a confident ten-item ranked list whose top
two findings were both false, and acting on either would have shipped a change that
did nothing:

- It reported that idle auto-drift walks the camera into the depth where plates
  dissolve. In fact `autoplay` defaults to `false`, so the drift was never running;
  and the drift's `step()` zeroes `immersionTargetRef` before crossing, so it can
  only ever cross at the shallowest framing. What it felt was the entry ease.
- It reported the walk-in ceiling dissolving the garden plates. Sweeping `__imm()`
  to 1.0 on two garden nodes, wide and portrait, showed all four frames clean. Its
  evidence was one shot taken seconds after a resize without enough settle.
- It reported a plate 404ing. The file served 200; it was a transient swiftshader
  decode, caught by the error boundary exactly as designed.

The agent cannot see the clock or the code, so it narrates a plausible mechanism for
whatever it photographed — and swiftshader manufactures artifacts (slow decodes read
as "broken room", short settles read as "smear", a stale label reads as "navigation
broken") that are indistinguishable from real ones in a still frame.

**So: treat the report as a list of coordinates to go look at, never as a diagnosis.**
Before changing anything, reproduce the artifact yourself with a generous settle, and
read the mechanism it names. The findings that tend to survive are the ones that need
no renderer at all — discoverability, affordance, information architecture. In that
first run the three real ones were all of that kind: the fork being undiscoverable,
`help` styled identically to the two toggles beside it, and no *arriving* state for a
slow plate load.

## Launch

Dev server: `npx vite --port 5173 --strictPort` from `babel-tour/` if nothing is
listening. It binds IPv6 — probe `http://localhost:5173/`, **not** `127.0.0.1`.

Browser:

```bash
msedge.exe --headless=new --remote-debugging-port=9333 \
  --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader \
  --user-data-dir=<ABSOLUTE tmp path> --no-first-run about:blank
```

A relative `--user-data-dir` makes the browser die silently. Always absolute.

Then drive it with the `driver.mjs` shipped next to this file:

```bash
SHOT_DIR=<abs path> VW=640 VH=360 node driver.mjs "$(cat steps.json)"
```

Write `steps.json` to a file rather than inlining the JSON — quoting nested JS in a
shell argument is where these runs go to die. Step keys are documented at the top of
`driver.mjs`.

### Shoot SMALL — this is not optional

**640×360.** At 1600×900 swiftshader starves rAF: the sim stops ticking, the CSS
animation clock freezes, and the compositor stops repainting. The failure is
maximally confusing because the DOM is *correct* — an element can report
`opacity: 1` in `getComputedStyle` while the captured PNG shows nothing at all, and
the chapter header can sit on the previous room's title for the whole run. At
640×360 the clock advances, though still roughly 30× slow.

The tension with `verify`'s "shoot the user's aspect or the artifact hides" is real:
a small viewport is right for *driving and reading the UI*, the user's aspect is
right for *judging a rendering artifact*. Drive small; re-shoot anything that looks
like a depth or matting bug at the real aspect before believing it.

### Other headless traps

- **Waiting.** Wait ~13 s after opening before the first shot (longer on a cold
  server — textures are big), and give eased camera state ~2 s+ before each shot.
- **Wait for mounts inside the page, not in the driver.** rAF is slow enough that an
  element can appear *between* two of your evals. Poll in-page and return a promise
  (`driver.mjs` passes `awaitPromise`):
  ```js
  new Promise((res) => { let n = 0; const t = setInterval(() => {
    const e = document.querySelector('.thing');
    if (e) { clearInterval(t); res('found'); }
    else if (++n > 250) { clearInterval(t); res('ABSENT'); }
  }, 100); })
  ```
- **Scrubbing an animation:** `a.pause()` **before** setting `a.currentTime`, or it
  re-syncs to the frozen document timeline and your seek silently reverts.
- **Never report FPS or smoothness.** Meaningless under software WebGL.
- **A stale `DEPTH n/4` label is not broken navigation.** Cross-check
  `window.__nav()` (dev + `?dev=1`) to see whether the *target* actually moved.
- Clips routinely log `[clip] … is stalled` and never wake. The living-surface layer
  is usually absent from a headless visit entirely — say so rather than reporting on
  it.

## The agent prompt

Spawn a `general-purpose` subagent in the background with roughly this, adjusted for
whatever you want the visit to focus on:

> You are a FIRST-TIME VISITOR to an art website; your job is honest UX feedback.
> A vite dev server is already running at http://localhost:5173/ (IPv6 — use
> `localhost`, not `127.0.0.1`). Do not restart it; do not build.
>
> **Staying in character.** Form impressions ONLY from what you can see on the
> rendered screen — screenshots are your eyes. You may read
> `babel-tour/.claude/skills/visitor-tour/SKILL.md` and its `driver.mjs` for
> MECHANICS. Do NOT read the shader/scene source to explain away something that
> confused you; if you got lost, that IS the finding. Start at the plain URL with no
> query params. Only after honestly failing to reach somewhere unaided may you use
> `?dev=1` and the debug hooks — and say when you do.
>
> **Report observations, not causes.** Describe what you saw and what you did. Where
> you want to explain *why* something happened, label it `UNVERIFIED GUESS` — a
> reader of your report will check it against the code, and a confident wrong
> mechanism costs them more than no mechanism. Never report FPS or smoothness.
> Where you cannot tell whether a problem is the software renderer or the piece
> itself, say so explicitly instead of picking one.
>
> **Do:** land, work out what you're for, move, look around, go deeper, find what
> there is to find (a library; a garden reached by a descent). Turn all the way
> around. Dwell still. Then try what a confused person tries — clicking randomly,
> unbound keys, resizing, walking backwards. Screenshot every meaningful moment and
> actually LOOK at each one with the Read tool.
>
> **Deliver:** (1) first 15 seconds — what you thought this was, what you tried;
> (2) walkthrough, beat by beat, referencing screenshots by filename; (3) what
> worked, specifically why; (4) what didn't — confusions, dead ends, anything ugly
> (smearing, floating fragments, hard edges, feeling like you float rather than
> stand); (5) ranked friction list, worst first, each with what you'd expect
> instead; (6) any `UNVERIFIED GUESS` notes, clearly separated.

## After the report

1. Relay the observations; the agent's final report is not shown to the user.
2. Pick the findings that need no renderer to verify and act on those first.
3. For anything visual, reproduce it yourself at the user's aspect with a generous
   settle before touching code.
4. Read the mechanism behind any causal claim. Three separate checks — a default
   value, what a function actually mutates, and a direct sweep — is what it took to
   falsify one confident finding last time.
5. Kill only the browser instances you spawned; leave the user's dev server alone.
