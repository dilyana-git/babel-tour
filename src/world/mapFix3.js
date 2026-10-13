// The opening and the map (2026-10-11, audit III, board 1): the hand-over (2,
// LOOKS below: the user chose a), the unwalked cells' stone (3), the garden's
// colour from above (4), the numerals' marks (5), the byline's line (6).
// What each point was, and why: docs/design-history.md.
//
// ?wmap3=old puts all of them back as they were; ?wmap3=old:3,5 only those.
// ?wmapink=b|c puts one of the other two hand-overs (2) in a's place; `off`
// is the stone of point 3 with nothing of the options on it.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const V = Q.get('wmap3');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map((s) => s.trim())) : null;
export const map3Old = (n) => V === 'old' || (ONLY ? ONLY.has(String(n)) : false);

// 3. The unwalked cells' stone over the map. `near`: the flat (hexagon)
// distance from a room of the walk inside which the stone is as it was, and
// the distance by which it is quiet (a room's own half of its wall ends at
// 111.6). `flat`: how much of the blocks goes; `relief`: of the normal map;
// `tint`: what is left of its colour.
export const QUIET = { near: [112, 128], flat: 0.85, relief: 0.8, tint: [0.62, 0.6, 0.58] };

// 4. The garden's light over the map: each a patch of light laid on it, `k`
// strong. The pavilion's reflection by its reach from the near foot; the
// moon's road by where it crosses the pond (0 its west shore, 1 its east)
// and the wash of it over the whole water;
// the wisteria by its length along the pergola from the Door's arch, its
// width and its height (over the leaves); the lit stone lanterns by where
// they stand.
export const GARDEN_MAP = {
  pavilion: { r: 86 / Math.sqrt(3), k: 1.2 },
  moon: { road: 0.8, wash: 0.2, k: 0.6 },
  wisteria: { along: [28, 124], across: 36, y: 52, k: 0.85 },
  lanterns: { at: [[1201, 262], [1264, 234], [1342, 262], [1290, 292]], r: 19, y: 24, k: 0.5 },
};

// 2. The hand-over, three ways.
//   a  the ink never fully leaves: the unwalked cells stay as a faint drawing
//      over darker stone
//   b  no ink: the stone is graded warm and dropped in value until the lit
//      rooms are the only light on the page
//   c  stone only inside the eight: the rest of the honeycomb remains the
//      drawing, on the dark
// `ink`: what the drawing keeps of its unwalked cells once it has let go —
// their lines, the dark in their openings, their lamps. `tint`: the unwalked
// stone's colour in place of QUIET's. `veil`: the lantern's dimming of
// everything but the walk (map.css has 0.6). (Each of a and c also drew a
// gold hairline round every room of the walk at rest; on the Echo and the
// Silence it was a thin wire inside a carved stone rim, and it went too.)
export const LOOKS = {
  a: { ink: { lines: 0.42, dark: 0, lamps: 0 }, tint: [0.4, 0.37, 0.33], veil: 0.62 },
  b: { ink: null, tint: [0.5, 0.35, 0.22], veil: 0.68 },
  c: { ink: { lines: 0.8, dark: 1, lamps: 0.22 }, tint: [0.2, 0.17, 0.14], veil: 0.96 },
};
// The user's pick, from the canvas of the three (2026-10-11): a.
const PICK = Q.get('wmapink');
export const LOOK = map3Old(2) || PICK === 'off' ? null : LOOKS[PICK] ?? LOOKS.a;
