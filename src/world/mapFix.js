// What the design board on the opening and the map (2026-10-09, board 2)
// marked REFINE, where it is in the world and its camera — the points by the
// board's own numbers:
// L2 the opening's first frame was lopsided: looking down the walk, the ink's
//    camera put the Vestibule in the middle of the frame and the Echo over its
//    top edge, cut off, with the left half of the screen holding only the
//    epigraph. Its lens now starts shifted down and toward the title, and the
//    shift is gone by the time the camera rests (ink.js, START).
// 4  the garden was squeezed into the map's top right corner, and the frame
//    rested against its left and bottom bounds only. The map's camera is
//    turned 9° off north (plan.js, TILT_YAW), so the walk runs flatter, from
//    the bottom left into the centre right, and its aim is panned until the
//    rooms sit centred between the left and right bounds and down on the
//    bottom one (clear of the title and caption) before it is fitted: the
//    frame is larger and the garden is given the right of it.
// 7  seen from the map, the Vertigo had a floor: the cone of lit air under
//    the lamp hung in the drum, seen down its axis as a lit round foot, and
//    the stair's pale treads under it, turned down the funnel as one beige
//    disc — in the room whose line is "the stairwell that has no floor".
//    Over the map that cone goes, the floor round the mouth darkens, and the
//    stair and the shelves darken with depth below it; the books do not, so
//    the warm light the bottom throws up them is what is left to see. All of
//    it is gone before a flight reaches the rooms. (Dark layers across the
//    shaft were tried first: they put out that glow too.)
// 8  the wall tops were one cold grey everywhere: the lit rooms glowed, but
//    their rims were as cold as the dark ones'. Over the map, the coping round
//    each room of the walk takes a faint warm bounce from inside, strongest
//    at its inner edge.
//
// ?wmapfix=old puts all of them back as they were; ?wmapfix=old:L2,7 only those.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const V = Q.get('wmapfix');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map((s) => s.trim().toUpperCase())) : null;
export const mapOld = (n) => V === 'old' || (ONLY ? ONLY.has(String(n).toUpperCase()) : false);

// 7. The well's stone, shelves and floor over the map: how much of the
// lamplight they lose — `floor` of it at the pit's floor (6), `k` of it from
// `to` down; and how much of the cone of lit air under the drum's lamp goes.
export const PIT_FADE = { floor: 0.55, k: 0.85, from: 6, to: -45, shaft: 0.9 };

// 8. The warm bounce on the rims of the walk's rooms, over the map: its colour,
// strength, and the reach in from the room's inner wall (the hexagon's flat
// radius at the wall top, 86.6) out across the coping.
export const RIM_WARM = { color: [1.0, 0.62, 0.3], k: 0.75, inner: 84, outer: 122 };
