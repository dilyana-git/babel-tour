// The opening and the map, in the world and its camera (2026-10-09, board 2):
// the opening's first frame (L2), the map's framing (4), the Vertigo seen
// from the map (7), the warm rims of the walk's rooms (8).
// What each point was, and why: docs/design-history.md.
//
// ?wmapfix=old puts all of them back as they were; ?wmapfix=old:L2,7 only those.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const V = Q.get('wmapfix');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map((s) => s.trim().toUpperCase())) : null;
export const mapOld = (n) => V === 'old' || (ONLY ? ONLY.has(String(n).toUpperCase()) : false);

// 7. The well's stone, shelves and floor over the map: how much of the
// lamplight they lose — `floor` of it at the pit's floor (6), `k` of it from
// `to` down; and how much of the cone of lit air under the drum's lamp goes.
export const PIT_FADE = { floor: 0.35, k: 0.72, from: 6, to: -45, shaft: 0.9 };

// 8. The warm bounce on the rims of the walk's rooms, over the map: its colour,
// strength, and the reach in from the room's inner wall (the hexagon's flat
// radius at the wall top, 86.6) out across the coping.
export const RIM_WARM = { color: [1.0, 0.62, 0.3], k: 0.75, inner: 84, outer: 122 };
