// The world's constants and the flags read once from the address: shared by
// every section of assembleWorld (buildWorld.js).

import { CEDAR_WOOD } from '../textures';
import { RIM_WARM as RIM_BASE, ROUTE_LIGHT as ROUTE_BASE, TONE } from '../mapLook';
import { FALLEN as DOOR_FALLEN_HEAPS, CRACKS as DOOR_CRACK_STYLE, DUST as DOOR_DUST } from '../doorProps';
import { rubbleLayout } from '../rubble';
import { ASHLAR, ASHLAR_ON } from '../ashlarSurface';

export const FRAME = [1440, 900];
export const stoneTint = (was, now) => (now);
// The light on the wall tops and the rims' warm bounce over the map, as the
// map's look has them (mapLook.js).
export const ROUTE_LIGHT = { ...ROUTE_BASE, ...TONE.route };
export const RIM_WARM = { ...RIM_BASE, ...TONE.rim };
// ?wtree=pine (DEV): every tree in the garden grown as the one kind, to judge
// it; ?wtree=none, no trees at all, to measure what they cost (__worldBench).
export const ONE_TREE = import.meta.env?.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('wtree') : null;
// ?whedge=bare (DEV): the hedges without their sprigs; ?whedge=none, no hedges
// at all; ?whedge=gloss, the body's full lamp gloss — what they cost, and what
// the sprigs do for the silhouette.
export const HEDGE_DIAL = import.meta.env?.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('whedge') : null;
// ?wbound=0: without the hedge that closes the garden (for weighing what it costs)
export const NO_BOUND = import.meta.env?.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wbound') === '0';
export const MASS_H = 120;   // how tall the galleries' walls stand
export const CAP = 3;        // the pale stone laid on top of them

// ── Somewhere else to stand ──────────────────────────────────────────────────
// `stands` (below) gives every room the one place the walk puts a reader. A
// vantage is a SECOND place in the same room, climbed to from the first and come
// back down from — somewhere the room only shows itself from, which the walk
// through it cannot stop at.
//
// The geometry hangs on the stand itself (`stands[i].vantage`); the names live
// in vantages.js so the HUD can load before the world builder.
export const deg = Math.PI / 180;

// The cases: five tiers of shelving (Borges's five shelves to a wall), each
// TIER_H tall, the lowest standing on a plinth at TIER_BASE; the frieze board
// over the top tier at FRIEZE_Y.
export const TIER_H = 21, TIER_BASE = 10, TIERS = 5;
export const FRIEZE_Y = 111.5;
// A tier is a bay of real shelves — three of folios at the foot, four of
// quartos, five each of octavos and of the small books at the top — and its
// books are the size books are: a folio 38-50 cm, a quarto 28-37, an octavo
// 21-27 (a unit is 9.4 cm). Thin boards between the tier's own heavy ones, and
// a back to the case 4.6 deep.
export const SHELVES = [
  { n: 3, h: [4.0, 5.3], w: [0.5, 0.95], d: [3.0, 3.5] },
  { n: 4, h: [3.0, 3.9], w: [0.4, 0.78], d: [2.3, 2.8] },
  { n: 5, h: [2.5, 3.1], w: [0.32, 0.64], d: [1.8, 2.2] },
  { n: 5, h: [2.2, 2.85], w: [0.3, 0.58], d: [1.6, 1.95] },
  { n: 5, h: [1.8, 2.5], w: [0.26, 0.5], d: [1.4, 1.75] },
];
export const BOARD = 0.45, CASE_BACK = 7.4;
// tier `t`, standing on `y`: where each of its shelves' books stand, and the
// room over them (the top tier's up to the frieze board)
export const shelvesOf = (t, y) => {
  const { n } = SHELVES[t];
  const top = t === TIERS - 1 ? FRIEZE_Y - 1.5 : y + TIER_H - 2.4;
  const clear = (top - y - (n - 1) * BOARD) / n;
  return Array.from({ length: n }, (_, j) => ({ y: y + j * (clear + BOARD), clear }));
};

// Shelved the way a library is, not the way a random number is: in RUNS — a
// set of matching volumes, then something else — the big books low and the
// small ones high, each run its own binding, height, tooling and depth. Drawn
// book by book from one wide spread, every shelf in the Library came out the
// same even noise of dark browns under the same gilt fleuron, and even noise
// reads as wallpaper.
//
// Bindings by share of the runs. Still old leather and low in chroma (a
// shelf of primaries measured as the thing that made a room read as a toy),
// but not one family of brown: calf and tan, oxblood, bottle green, black,
// vellum and faded cloth — the pale vellum is what lets the dark ones read
// as dark. Colour in the Library lives on its objects, never in its light.
export const BINDINGS = [
  { share: 44, cols: ['#6f4c31', '#7d5738', '#5f422c', '#8a6341', '#523a28', '#76563a'] },
  { share: 15, cols: ['#5a2923', '#662e25', '#4f2420'] },
  { share: 12, cols: ['#2d3a2b', '#333d29', '#283426'], green: true },
  { share: 10, cols: ['#221d19', '#2a241f', '#1e1a17'] },
  { share: 8, cols: ['#8e8062', '#84775a', '#958868'], kind: 'vellum' },
  { share: 8, cols: ['#6f5f36', '#665243', '#61463f'], kind: 'cloth' },
];

// The far galleries' books, painted (textures.js's bookRows): each size of
// book as it stands on its shelves, two strips of each, 128 units long, 16
// pixels to the unit (a book 4 to 15 across). Also the two top tiers in the
// galleries themselves, 50 and more over every eye (see shelfWall).
export const BOOK_ROWS = {
  rows: SHELVES.map((S, t) => ({ h: S.h, w: S.w, clear: shelvesOf(t, TIER_BASE + t * TIER_H)[0].clear })),
  unit: 16, variants: 2, length: 128,
  palette: BINDINGS.map(({ share, cols, kind }) => ({ share, cols, ...(kind ? { kind } : {}) })),
};

// The blocks that fell when the Door's wall came down — [along, into, w, h, d]
// in the breach's frame (see the Door, in assembleWorld) — and the cracks
// painted into its pavement (cracks.js), which spread from the breach and from
// under them. The frame runs along the sixth wall (dir 60) and into the room
// (dir 150) from its middle, which is assembleWorld's GATE, worked out again
// here from the honeycomb's numbers because the painting begins before the
// world is built (assembleWorld checks that the two agree).
// (in two heaps under the breach, wedged and bedded in the floor: doorProps.js)
export const DOOR_FALLEN = DOOR_FALLEN_HEAPS;
export const DOOR_CRACKS = (() => {
  const A = (100 * Math.sqrt(3)) / 2, D = 2 * A + 50, E0 = [D * Math.cos(30 * deg), D * Math.sin(30 * deg)];
  const door = [232 + 4 * E0[0], 785 + 4 * E0[1] - 4 * D];
  const frame = {
    origin: [door[0] + Math.cos(330 * deg) * A, door[1] + Math.sin(330 * deg) * A],
    along: [Math.cos(60 * deg), Math.sin(60 * deg)], into: [Math.cos(150 * deg), Math.sin(150 * deg)],
  };
  return {
    ...frame,
    // (out to where the reader stands, 125 in; 14 pixels a unit: 7 mm, where
    // a pixel of the floor's own map is 3)
    a0: -72, a1: 72, b0: -2, b1: 130, ppu: 14,
    breach: [-9, 12, 1.5, 6], blocks: DOOR_FALLEN.map(([along, into, w]) => [along, into, w]),
    // and where the blocks and the stones lie (rubble.js), for the shade at
    // their feet and the grit round them
    rest: rubbleLayout(DOOR_FALLEN, frame).rest,
    // (doorProps.js: 5, cracks that taper all the way out; 2, more dust round
    // what fell)
    ...(DOOR_CRACK_STYLE.taper ? { taper: true } : {}),
    ...({ dust: DOOR_DUST }),
  };
})();
// The Door's portal in the world (portal.js's frame: x along the wall, z into
// the room, from the middle of the opening), for its stone's shader
// (doorProps.js). assembleWorld sets the portal there.
export const PORTAL_FRAME = {
  origin: [DOOR_CRACKS.origin[0] + DOOR_CRACKS.along[0] * 1.5, DOOR_CRACKS.origin[1] + DOOR_CRACKS.along[1] * 1.5],
  x: DOOR_CRACKS.along, z: DOOR_CRACKS.into,
};

// The surfaces painted off the main thread (paint.js, paintJobs.js), named
// here so the painting can begin before the world is built: each is a painter
// in textures.js and what it is asked for. None of them draws on the world's
// own stream, so where and when they are painted changes nothing they show.
export const PAINTED = {
  // the floor: a mason's pavement
  flag: ['paving'],
  cracks: ['floorCracks', DOOR_CRACKS],
  // Shared wall stone: roughly 30 cm courses, varied lengths, flat faces
  // and narrow joints, with a single step of tone between stones — a third of
  // the step it was, and the arrises weathered (ashlarSurface.js, 1 and 2).
  wall: ['ashlar', { seed: 107, courses: 12, blocks: 5, joint: 1, strength: 0.65, spread: ASHLAR_ON.tone ? ASHLAR.spread : 18, dress: 'flat', arris: ASHLAR_ON.arris ? ASHLAR.arris : 0 }],
  // The massive pale stone of the caps.
  pale: ['ashlar', { seed: 9, courses: 4, blocks: 2, tone: [158, 150, 136], strength: 2 }],
  // The wood: boards sawn from the log, grain along u (`timber`).
  wood: ['timber'],
  timber: ['timber', { seed: 23, tone: CEDAR_WOOD, ring: 9, knots: 2 }],
  // the bindings, lettered (spineAtlas2 and its titles) unless ?wbook says
  // to see them as they were (see effects.js)
  // (with the tooling varied down each back: vertigoProps.js)
  spines: ['spineAtlas2', { tooling: true }],
  ...({ titles: ['spineTitles'] }),
  // the far galleries' books, in painted rows (see shelfWall)
  bookRows: ['bookRows', BOOK_ROWS],
  vestBookRows: ['bookRows', { ...BOOK_ROWS, quietLabels: true }],
  hedge: ['hedgeLeaves'],
  carve: ['limestone'],
  // the Door's fallen stone (rubble.js), laid on by M.rubble
  ...({ rubble: ['rubbleStone'] }),
  // the garden's granite and the pond's pebbled bank (shore.js)
  ...({ shoreRock: ['shoreRock'], shoreBank: ['shoreBank'] }),
  column: ['limestone', { seed: 73, tone: [172, 165, 152], honed: true }],
  bark: ['bark'],
};
