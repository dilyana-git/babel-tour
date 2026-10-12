// What the design board on the opening and the map (2026-10-12, audit IV,
// board 1) marked, where it is in the world — the points by the board's own
// numbers:
// 2  the paving was neutral grey, and most of the picture. The wall tops
//    between and round the cells take about two fifths of the frame, and what
//    lit them along the walk was the map's moon alone — a cool grey-white on
//    pale stone — while every lamp inside the rooms is warm: "moonlit
//    concrete" before "library". Over the map the light that falls on the
//    wall tops is the lamps' own colour, and less of it, so the lit rooms
//    are the brightest things on the page. It is the colour of the light on
//    that stone (buildWorld.js, stoneShade): the moon is as it was on the
//    garden and down in the rooms, and nothing is laid over the picture.
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
