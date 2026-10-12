# Design history

What the design boards asked for, what was tried, and what was picked. The
code keeps only what is built and why; the story of how it got there lives
here and in git history.

A look's alternatives were removed once one was picked. To try one again,
the values below are enough to put it back, and the commits named hold the
code that drew it.

## The map's tone (2026-10-12)

The user said of the map: "it looks too reddish". Measured on their
screenshot, the stone round the walk sat at hue ~23 (a quarter of it under 17:
red-brown), where the palette the Library was re-keyed to puts its lamplight
at ~33-36 (World.jsx, "The palette"). Three things put it there, all over the
map only:

- the wall tops lit in the lamps' own orange (mapFix4.js, 2), which against the
  moon it replaced is 2.2x the red and a fifth of the blue, on stone that is
  warm already — and ACES carries a saturated orange on toward red
- the warm bounce on the walk's rooms' rims (mapFix.js, 8), as orange
- the grade's gold (Grade.js), which turns brown light amber, but only where a
  pixel is lit: the paving round the rooms is too dark for it to reach

The user asked for options. Four, from the warmest to the most neutral, each a
set of the same dials (`TONE` in `src/world/mapFix6.js` explains each dial):

| look | | route (wall-top light) | rim (bounce) | quiet (unwalked stone) | bounce (hemisphere ground) | grade (map only) |
|---|---|---|---|---|---|---|
| a | amber: the same warmth, its hue moved from copper to amber | `#ffc985`, warm 1 | `[1.0, 0.74, 0.42]` | as `LOOK.a` | `#5b432f` | gold 0.3, deep 1, chroma 0.92 |
| b | old gold: yellower and a little brighter, brass lamplight on the stone | `#ffd796`, warm 1, k 0.5 | `[1.0, 0.8, 0.48]`, k 0.85 | `[0.41, 0.385, 0.33]` | `#5a4c36` | gold 0.42, deep 1 |
| **c** | **parchment: half the colour, pale warm limestone, the lit rooms warmest (picked)** | `#ffd8a0`, warm 0.55 | `[1.0, 0.78, 0.5]`, k 0.55 | `[0.4, 0.38, 0.355]` | `#4e463c` | gold 0.3, deep 1, chroma 0.62 |
| d | ash: the stone near grey, the warmth left to the rooms and their rims | `#e9e2d6`, warm 1 | `[1.0, 0.8, 0.52]`, k 0.5 | `[0.38, 0.375, 0.37]` | `#3f3c38` | gold 0.25, deep 1, chroma 0.3 |
| old | the map before this board | `#ffb466`, warm 1 | `[1.0, 0.62, 0.3]`, k 0.75 | `[0.4, 0.37, 0.33]` | `#5b432f` | gold 0.18, deep 0, chroma 1 |

The user picked c. The code with all four behind `?wmaptone=a|b|c|d|old` is
commit `e2222d8`.
