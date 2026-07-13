# Chapter II — The Garden of Forking Paths

The collection that contains *The Library of Babel* is titled *El jardín de
senderos que se bifurcan* (1941) — so the door out of the Library leads, of
course, into Borges' other labyrinth. When the reader has dwelled in The
Silence (Node IV) for a few breaths, a green light kindles between the
shelves and four garden nodes unlock on the same corridor: the descent
becomes a wandering.

The mechanic is already wired into `src/Tour.jsx`. Until the artwork below
lands in `public/nodes/garden/`, the garden nodes borrow the library reliefs
(`GARDEN_ART_READY = false` at the top of `Tour.jsx`) so the door, the
crossing, the re-grade, and the sound shift can all be felt end-to-end today.

## The four nodes

| # | Slug | Files | Accent | Fog | Light anchor |
|---|------|-------|--------|-----|--------------|
| V | `door` | `garden_1.webp` + `garden_1_depth.webp` | `#9fc48a` pale green-gold | `#0b1209` | the opening itself |
| VI | `fork` | `garden_2.webp` + `garden_2_depth.webp` | `#7fbf8e` jade | `#0a140d` | one hanging lantern |
| VII | `pavilion` | `garden_3.webp` + `garden_3_depth.webp` | `#e0b45c` lantern gold | `#0d1309` | the pavilion windows |
| VIII | `web` | `garden_4.webp` + `garden_4_depth.webp` | `#a9c9d8` moon silver | `#0c1114` | the far convergence lantern |

Arc of the palette: the warm candle-amber of the library cools into jade and
moss, flares gold once at the pavilion (the one warm room in the garden, as
the fire door was the one warm room in the stone), then dissolves into
moonlit silver — mirroring the library's own warm → cool → ash grading.

## Midjourney prompts

All existing art is ~21:9 (3376×1440). Generate at `--ar 21:9`; a couple of
percent of aspect drift is invisible (the scene overscans by 1.35×).

**Consistency kit** — for every prompt below:

- Add a style reference to one of the existing pieces so the new world reads
  as the same hand: upload `public/nodes/descent/impossible_1.png` and use
  `--sref <that URL>`. Start at default weight; `--sw 200` if the garden
  drifts too painterly.
- Keep the shared DNA the existing four images established: **one tiny robed
  figure for scale, one warm light source against a cool mist, monumental
  impossible scale, hyperdetailed surfaces, volumetric light**.
- Generate 4–8 candidates per node and choose for *depth layering*, not
  beauty: a clear foreground mass, a mid-ground subject, a background that
  recedes toward a single vanishing region. That is what makes the relief
  shader sing.

**Depth-friendliness rules** (the depth-estimation step rewards these):

1. One dominant perspective recession — avoid two competing vanishing points.
2. Structured vegetation (clipped hedges, topiary walls, stone edges), not
   full-frame loose foliage — dense leaf noise turns depth maps to mush.
3. One clear dominant light source per image (it becomes `glowAt`).
4. Keep the key subject inside the central ~75% of the frame — the edges are
   cropped by overscan and only revealed when the viewer pans.

### Node V — The Door (`garden_1`)

> the last gallery of an infinite gothic library where one towering bookshelf
> swings open like a stone door revealing a moonlit garden of clipped hedges
> beyond, warm candlelight inside, cool green moonlight streaming through the
> opening, a single tiny robed figure at the threshold, hanging iron chains
> giving way to hanging vines, drifting mist, monumental impossible
> architecture, hyperdetailed carved stone and ancient books, cinematic
> volumetric light --ar 21:9

This is the bridge image — half library, half garden. The composition should
keep the library's stone vocabulary on the flanks and let the green light own
the center. `glowAt` = the middle of the opening.

### Node VI — The Fork (`garden_2`)

> a vast moonlit garden labyrinth where a pale stone path forks again and
> again between towering sculpted hedges and mossy stone arches, every branch
> identical, paper lanterns hanging from twisted wisteria, a tiny robed
> figure hesitating at the first bifurcation, ground mist and fireflies, cool
> jade and silver night with one warm lantern glow, monumental scale,
> hyperdetailed, cinematic volumetric light --ar 21:9

Pick the candidate where the first bifurcation happens in the mid-ground —
the fork is the subject. `glowAt` = the nearest lantern.

### Node VII — The Pavilion (`garden_3`)

> a solitary lamplit pavilion at the heart of an immense dark garden, warm
> golden light in its lattice windows, a stone bridge crossing a black
> reflecting pond toward it, colossal hedges and ancient cypresses vaulting
> overhead like a cathedral nave, a tiny robed figure crossing the bridge,
> moths circling the light, mist over the water, deep green and gold night,
> monumental scale, hyperdetailed, cinematic volumetric light --ar 21:9

Stephen Albert's pavilion — the one warm interior of the garden. The vaulting
trees deliberately rhyme with the library's arches. `glowAt` = the lit
windows; give it the largest `glowScale` of the four.

### Node VIII — The Web of Time (`garden_4`)

> an endless garden dissolving into a starry night sky, pale stone paths
> branching and rebranching into the distance like a luminous river delta,
> translucent ghostly copies of the same robed figure walking every divergent
> path at once, hedges thinning into constellations, one distant lantern
> burning where all paths converge, silver-blue moonlight, mist, monumental
> scale, hyperdetailed, ethereal cinematic volumetric light --ar 21:9

The finale — architecture gives way to time itself. If the ghost-copies come
out kitschy, drop that clause and rely on the delta of paths. `glowAt` = the
distant convergence lantern, small `glowScale` (~0.7).

## Depth maps

Same pipeline that produced `impossible_N_depth`:

1. Run each color image through **Depth Anything V2 (Large)** — the free
   Hugging Face space (`huggingface.co/spaces/depth-anything/Depth-Anything-V2`)
   or Replicate both work. Marigold is a good fallback if a map comes out
   posterized.
2. Convention check: **white = near, black = far** (the shader displaces by
   `d - 0.5` and the dissolve sweeps from depth 1 = nearest stone). Depth
   Anything outputs this by default; don't invert.
3. Post in any editor: auto-levels so the histogram spans the full 0–255
   range, then a 1–2 px gaussian blur to kill banding and edge halos.
4. Export at the exact pixel size of its color image.

## Convert + install

```sh
cwebp -q 92 garden_1.png -o public/nodes/garden/garden_1.webp
cwebp -q 90 -m 6 garden_1_depth.png -o public/nodes/garden/garden_1_depth.webp
# …and likewise for 2–4
```

## Integration checklist

1. Drop the eight `.webp` files into `public/nodes/garden/`.
2. Flip `GARDEN_ART_READY` to `true` at the top of `src/Tour.jsx`.
3. Calibrate each node's `glowAt`: find the light source's pixel coords in
   the image, then `u = x / width`, `v = y / height`. Nudge `glowScale`
   until the halo hugs the painted glow.
4. Sample each image's darkest ambient tone and fold it into the node's
   `fog` color so distant planes melt into it seamlessly.
5. Walk the whole tour: dwell at The Silence until the door kindles, cross,
   and check each crossing's dissolve rim against the accent color.
