// The opening and the map (2026-10-12, audit IV, board 1): the light on the
// wall tops over the map, the lamps' colour (2).
// What each point was, and why: docs/design-history.md.
//
// ?wmap4=old puts it back as it was; ?wmap4=old:2 only that point.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const V = Q.get('wmap4');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map((s) => s.trim())) : null;
export const map4Old = (n) => V === 'old' || (ONLY ? ONLY.has(String(n)) : false);

// 2. The light on the wall tops over the map. `color`: the lamps' (lamp()'s
// own, buildWorld.js), in place of `moon`, the map's moon and sky; `warm`: how
// far the light goes from the one to the other. `k`: how much of it is left
// on the paving round the rooms of the walk, and `far` out past them, where
// the unwalked cells are already let down (mapFix3.js, 2 and 3). `from`: the
// height it comes in over, from the wall tops down — the coping, what stands
// on it, and the heads of the walls over the bookcases, which the moon struck
// as pale bands inside every rim; not the rooms under them.
export const ROUTE_LIGHT = { color: '#ffb466', moon: '#c8dcea', warm: 1, k: 0.45, far: 0.8, from: [-24, -15] };
