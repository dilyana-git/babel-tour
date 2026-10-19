// The map's look: the light on the wall tops and the warm rims of the walk's
// rooms, the unwalked cells let down, the garden seen from above, the well
// over the map, and the tone over all of it (TONE, which the others defer to).
import { LANTERNS } from './gardenPlan';


// The well's stone, shelves and floor over the map: how much of the
// lamplight they lose — `floor` of it at the pit's floor (6), `k` of it from
// `to` down; and how much of the cone of lit air under the drum's lamp goes.
export const PIT_FADE = { floor: 0.12, k: 0.32, from: 6, to: -45, shaft: 0.65 };

// The warm bounce on the rims of the walk's rooms, over the map: its colour,
// strength, and the reach in from the room's inner wall (the hexagon's flat
// radius at the wall top, 86.6) out across the coping.
export const RIM_WARM = { color: [1.0, 0.62, 0.3], k: 0.75, inner: 84, outer: 122 };

// The unwalked cells' stone over the map. `near`: the flat (hexagon)
// distance from a room of the walk inside which the stone is as it was, and
// the distance by which it is quiet (a room's own half of its wall ends at
// 111.6). `flat`: how much of the blocks goes; `relief`: of the normal map;
// `tint`: what is left of its colour.
export const QUIET = { near: [112, 128], flat: 0.85, relief: 0.8, tint: [0.62, 0.6, 0.58] };

// The garden's light over the map: each a patch of light laid on it, `k`
// strong. The pavilion's reflection by its reach from the near foot; the
// moon's road by where it crosses the pond (0 its west shore, 1 its east),
// the wash of it over the whole water, and the road itself as the lamps'
// columns lie from the bridge (POND): `width`, its half-width far and near
// (shares of the pond's width), `dashes` stacked down it, `soft` the band
// under them; nothing off it (2026-10-17: 110 strokes scattered over a wide
// band read from the map as snow on a screen);
// the wisteria by its length along the pergola from the Door's arch, its
// width and its height (over the leaves), and `chroma` what it keeps of its
// violet (the most saturated thing on the map at 1); the lit stone lanterns
// by where they stand.
export const GARDEN_MAP = {
  pavilion: { r: 86 / Math.sqrt(3), k: 1.2 },
  moon: { road: 0.8, wash: 0.2, k: 0.6, width: [0.018, 0.04], dashes: 34, soft: 0.14 },
  wisteria: { along: [28, 124], across: 36, y: 52, k: 0.85, chroma: 0.3 },
  lanterns: { at: LANTERNS.map((lamp) => lamp.at), r: 19, y: 24, k: 0.5 },
};

// The hand-over from the drawing to the stone: the ink never fully leaves,
// and the unwalked cells stay as a faint drawing over darker stone.
// `ink`: what the drawing keeps of its unwalked cells once it has let go —
// their lines, the dark in their openings, their lamps. `tint`: the unwalked
// stone's colour in place of QUIET's. `veil`: the lantern's dimming of
// everything but the walk (map.css has 0.6).
export const LOOK = { ink: { lines: 0.42, dark: 0, lamps: 0 }, tint: [0.4, 0.37, 0.33], veil: 0.62 };

// The light on the wall tops over the map. `color`: the lamps' (lamp()'s
// own, buildWorld.js), in place of `moon`, the map's moon and sky; `warm`: how
// far the light goes from the one to the other. `k`: how much of it is left
// on the paving round the rooms of the walk, and `far` out past them, where
// the unwalked cells are already let down (below). `from`: the
// height it comes in over, from the wall tops down — the coping, what stands
// on it, and the heads of the walls over the bookcases, which the moon struck
// as pale bands inside every rim; not the rooms under them.
export const ROUTE_LIGHT = { color: '#ffb466', moon: '#c8dcea', warm: 1, k: 0.45, far: 0.8, from: [-24, -15] };



// The map's tone (2026-10-12): the stone round the walk had read too reddish —
// the wall tops lit in the lamps' own orange (below), the rims' warm
// bounce as orange (below), and the grade's gold never reaching the dark
// paving (Grade.js). This is the look the user picked from four ("parchment"):
// half the colour, the stone a pale warm limestone and the lit rooms the
// warmest thing on the page. The other three, and the map as it was, are in
// docs/design-history.md.
//
// Its dials. Any left out is as the module it overrides has it.
// `route`: the light on the wall tops over the map (ROUTE_LIGHT:
//   its colour, and how far it goes from the moon's toward it)
// `rim`: the warm bounce on the walk's rooms' rims (RIM_WARM: its
//   colour and strength)
// `quiet`: the unwalked cells' stone (LOOK tint)
// `bounce`: the hemisphere's ground colour over the map — what the cells'
//   walls see coming up off the stone (World.jsx's LIBRARY_BOUNCE, '#5b432f')
// `grade`: over the map only (Grade.js) — `gold`, how far green is carried up
//   toward red in warm pixels (0.18 among the walls); `deep`, how far down into
//   the dark it reaches (0: lit pixels only, as among the walls; 1: down to
//   near black); `chroma`, what is kept of the colour of the warm, unlit stone
export const TONE = {
  route: { color: '#ffd8a0', warm: 0.55 },
  rim: { color: [1.0, 0.78, 0.5], k: 0.55 },
  quiet: [0.4, 0.38, 0.355],
  bounce: '#4e463c',
  grade: { gold: 0.3, deep: 1, chroma: 0.62 },
};
