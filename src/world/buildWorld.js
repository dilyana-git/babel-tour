// ── The world ────────────────────────────────────────────────────────────────
// The whole walk as one carved place, built in three.js and seen from a
// three-quarter height, after the first set of look frames: the Library a
// honeycomb of tall hexagonal galleries whose every wall is a bookshelf (five
// shelves to a wall, as Borges has it), arched hallways, glass sphere lamps
// hanging on chains, an air shaft in each gallery that opens onto stars and a
// starfield under the whole honeycomb; the Vertigo a funnel of books at the
// centre; the Door, whose sixth wall is a carved Gothic arch (portal.js) onto
// the garden of forking paths — the wisteria pergola, the teal pond and its
// pavilion, the maze.
//
// Standing in it: every room has a place for a reader at eye level (`stands`)
// and a way on to the next (`legs`) — the hallways, the Echo's stair, the
// Vertigo's funnel, the pergola, the Pavilion bridge, the maze — which World.jsx
// walks. With `paintings` (the plate tour, ?plates) each room instead holds its
// Midjourney plate on its far wall, and the camera flies down to it.
//
// Units are pixels of the old overhead render's 1440 × 900 frame: x to the
// right, z down the frame (toward the camera), y up.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildVestibuleBridge } from './vestibuleBridge';
import { PAVILION, PAVILION_BRIDGE, PAVILION_NORTH_BRIDGE, PAVILION_BRIDGE_HALF_WIDTH, pavilionCrossing, pavilionInterior, pavilionRound } from './pavilionBridge';
import { pierLantern, lanternPaneGeometry } from './sconce';
import { LAMPS, POOL_SHADOW, stairSconce, makePaperMaterial, makeFlameMaterial, flameGeometry, waxGlowGeometry, waxGlowMaterial, shadeLit, floorPools, bakeFloorPools, floorPoolPatch, makePoolShadowBake } from './lampPass';
import { CEDAR, CEDAR_WOOD, pavingLayout, bookRowsLayout, foliageAtlas, FOLIAGE_KINDS, glow as glowTexture, makeRng, SPINE_KINDS, TITLE_COUNT, friezeBand, bayPlates, PLATE_CELLS, giltLetters, shelfEdge, purbeck, hanging, HANGING_KINDS } from './textures';
import { paintNow } from './paint';
import { glintLights, GLINT_N } from './effects';
import { makeBookMaterial, makeShaftMaterial, shaftVolume, makeSparkles, makeGlowMaterial, makeLampGlobeMaterial, makeFoliageMaterial, makeFoliageDepthMaterial, makeFoliagePrepass, makeBackdropFoliage, makeHangingMaterial, crossedCards, spineAt, titleAt, BOOKS_TITLED, BOOKS_GIANT, GRAZE } from './effects';
import { growTree, Wood } from './trees';
import { growHedge, rectUnionLoops, stripLoop } from './hedges';
import { buildPortal, PORTAL } from './portal';
import { makeWater, WATER_Y } from './water';
import { makeLilyPads, lilyFlowerGeometry, lilyBudGeometry, makeFlowerMaterial, makeKoi } from './pond';
import { buildFinale } from './finale';
import { makeDoorway } from './doorway';
import { makeMirrors } from './mirror';
import { buildWalkers, readerMaterial } from './walkers';
import { vestOld } from './vestFix';
import { echoOld, ECHO_STAND_R, moonBeamPatch, drumUvGlsl } from './echoFix';
import { vertigoOld, STAND_TURN, STAND_PITCH, WELL, shelfLip, LIP_COLOR, MISSING, bookHash } from './vertigoFix';
import { silenceOld, LAMP_AT, BOUNCE, deadGlassPatch, CROWN_BACK, ARCH_LIFT, ROBE, SHEEN } from './silenceFix';
import { forkOld, STAND as FORK_STAND, WAYMARK, RAKE, rakeOffset, rakeScuffs, edgeStones, BANK_VARY } from './forkFix';
import { pavOld, STAND as PAV_STAND, standOn, bracketSet, BRACKET, lotusBud, WILLOW_BROAD } from './pavilionFix';
import { propsOld, FORK_STONE, BLOSSOM_NIGHT, FINIALS, HEDGE_SHEEN, LAWN, ROOF_KIND } from './forkProps';
import { pavPropsOld, CAIHUA, DARK_GILT, WILLOW, qin, qinCloth, wornBar, wornPost } from './pavilionProps';
import { lawnBlades, bladeLit } from './lawn';
import { ROOF_TIERS, roofProfile, roofTop, tiledRoof, roofTiles, ROOF_SURFACE } from './pavilionRoof';
import { webOld, SCREEN, GATE as WEB_GATE, screenPlaces, openGate, FLIES, WALLS, pedestalGeometry, pedestalLetters } from './webFix';
import { auditOld, FILLET, FILLET_BRASS, deadOpal } from './auditFix';
import { webPropsOld, BELT, SPIRE, closeBelt, graduatedRing } from './webProps';
import { mapOld, PIT_FADE, RIM_WARM } from './mapFix';
import { doorPropsOld, STAND as DOOR_STAND, SPILL as DOOR_SPILL, SIDE_LAMP as DOOR_SIDE_LAMP, LADDER_U as DOOR_LADDER_U, CANDLES as DOOR_CANDLES, candleWax, splayedBook, tentBook } from './doorProps';
import { doorOld, FALLEN as DOOR_FALLEN_HEAPS, DUST as DOOR_DUST, SHAFT_K, LANTERN_HALO, CRACKS as DOOR_CRACK_STYLE, LAMP_Y as DOOR_LAMP_Y, revealShade } from './doorFix';
import { readerGeometry, ROBES } from './readers';
import { VANTAGES } from './vantages';
import { hexAislePoint, roundAislePoint, pathToPoint, makeWalkCurve } from './walkPath';
import { lightPoolSize } from '../capability';
import { SPIRAL, spiralAt, makeEndlessSpiral, GAPS, BRINK_OLD, bookAt } from './spiral';
import { VRAIL_OLD, VLAND_OLD, buildVertigoRail, endlessRail } from './vertigoRail';
// (imported for what it does to three.js's lighting before anything compiles)
import { softGain } from './lightModel';
import { uvGrain, ringGrain, WOOD_OLD, WALNUT_TILE, CEDAR_TILE } from './woodGrain';
import { CRACK_SLOPE, crackSize } from './cracks';
import { rubbleLayout, fallenBlock, fragment, RUBBLE_TILE } from './rubble';
import { rockVariants, gardenRock, pondShore, bridgeFoot, guardStones, shoreRockLit, bankLit } from './shore';
import { ivyLeafGeometry, ivyLeafTexture, leafletGeometry, backPaler, stoneCaster, growIvy, hangIvy, twineWisteria, compoundLeaf } from './ivy';

export const FRAME = [1440, 900];
// The palette (see World.jsx): the stone was a warm greige that stayed brown
// in the lamp's light and out of it. It is a neutral limestone grey now, so the
// lamps are what make it warm. (A cool sage was tried first and read, with the
// rest of that cut, as a filter.) ?wpal=old for the stone as it was.
const OLD_PALETTE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wpal') === 'old';
// The Library's floor as it was before 2026-10-06 — twelve slabs of one size
// in a brick bond (`flagstones`) — not the pavement (`paving`) that replaced it.
const FLOOR_OLD = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wfloor') === 'old';
// ?wcrack=old: the Door's cracks as they were before 2026-10-07 — dark strips
// laid on the pavement, a pale lip beside each and knobs of moss along them —
// not the cracks painted into it (cracks.js). (With the old floor, the old
// cracks: the painted ones follow the pavement's joints.)
const CRACK_OLD = FLOOR_OLD || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wcrack') === 'old');
// ?wrubble=old: what came down with the Door's wall as it was before
// 2026-10-07 (boxes with a dented end and one twenty-faced chip, turned every
// way) — not the stones of rubble.js and the shade at their feet.
const RUBBLE_OLD = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wrubble') === 'old';
// ?wshore=old: the pond's edge as it was before 2026-10-07 — the water cut to
// an ellipse over the lawn with a smooth stone at every other point of it,
// and the Pavilion's bridge coming down onto two boxes of ashlar — not the
// bank, the set stones and the granite pier and step of shore.js.
const SHORE_OLD = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wshore') === 'old';
const stoneTint = (was, now) => (OLD_PALETTE ? was : now);
// ?wivy=old: the Door's ivy as it was before 2026-10-09 — cards of painted
// green blots on the arch's garden face and the passage walls — and the
// pergola's vines as one plain tube of timber, not the grown ivy and twined,
// barked, leaved wisteria of ivy.js.
const IVY_OLD = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wivy') === 'old';
// ?wglare=old: the lamps and the moon's shaft as they were before 2026-09-26 —
// halos sized in the room, and light columns that stay whole with the eye
// inside them (the milky Echo crossing), to compare against.
const OLD_GLARE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wglare') === 'old';
// ?wglass=old: the Borges mirrors back in the hallways as they were (metal
// panels that read as blackboards), and no pier glasses (mirror.js).
const GLASS_OLD = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wglass') === 'old';
// ?wtree=pine (DEV): every tree in the garden grown as the one kind, to judge
// it; ?wtree=none, no trees at all, to measure what they cost (__worldBench).
const ONE_TREE = import.meta.env?.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('wtree') : null;
// ?whedge=bare (DEV): the hedges without their sprigs; ?whedge=none, no hedges;
// ?whedge=gloss, the body's full lamp gloss as it was before 2026-09-28
// at all — what they cost, and what the sprigs do for the silhouette.
const HEDGE_DIAL = import.meta.env?.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('whedge') : null;
// ?wbound=0: without the hedge that closes the garden (for weighing what it costs)
const NO_BOUND = import.meta.env?.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wbound') === '0';
// ?wfork=old: the garden's ways as they were before 2026-10-07 — the road not
// taken leaving the Fork through the pergola's last post and going round the
// north of the pond to the second bridge, and only lawn between the Pavilion's
// bridge and the way to the maze.
const FORK_OLD = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wfork') === 'old';
// ?wpergola=old: the pergola as it was before 2026-10-07, five frames running on
// to three paces short of the Fork's stone, a lantern in each of four bays.
const PERGOLA_OLD = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wpergola') === 'old';
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
const deg = Math.PI / 180;

// The cases: five tiers of shelving (Borges's five shelves to a wall), each
// TIER_H tall, the lowest standing on a plinth at TIER_BASE; the frieze board
// over the top tier at FRIEZE_Y.
const TIER_H = 21, TIER_BASE = 10, TIERS = 5;
const FRIEZE_Y = 111.5;
// Those were giants: folios of 1.6-1.8 m, taller than the readers walking
// past them, a shelf to a tier. A tier is now a bay of real shelves — three
// of folios at the foot, four of quartos, five each of octavos and of the
// small books at the top — and its books are the size books are: a folio
// 38-50 cm, a quarto 28-37, an octavo 21-27 (a unit is 9.4 cm). Thin boards
// between the tier's own heavy ones, and a back to the case 4.6 deep, not
// the 12 a giant folio needed. (?wbookscale=old for the giants.)
const SHELVES = [
  { n: 3, h: [4.0, 5.3], w: [0.5, 0.95], d: [3.0, 3.5] },
  { n: 4, h: [3.0, 3.9], w: [0.4, 0.78], d: [2.3, 2.8] },
  { n: 5, h: [2.5, 3.1], w: [0.32, 0.64], d: [1.8, 2.2] },
  { n: 5, h: [2.2, 2.85], w: [0.3, 0.58], d: [1.6, 1.95] },
  { n: 5, h: [1.8, 2.5], w: [0.26, 0.5], d: [1.4, 1.75] },
];
const BOARD = 0.45, CASE_BACK = 7.4;
// tier `t`, standing on `y`: where each of its shelves' books stand, and the
// room over them (the top tier's up to the frieze board)
const shelvesOf = (t, y) => {
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
const BINDINGS = [
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
const BOOK_ROWS = {
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
// (since 2026-10-09 in two heaps under the breach, wedged and bedded in the
// floor: doorFix.js, 2; ?wdoorfix=old:2 for the six spread over the floor)
const DOOR_FALLEN = doorOld(2)
  ? [[-42, 31, 11, 5.4, 7], [-24, 38, 8, 4.4, 6], [40, 38, 10, 5, 7.5], [47, 50, 7, 4, 5.5], [-50, 46, 6, 3.4, 5], [25, 46, 6.5, 3.6, 5]]
  : DOOR_FALLEN_HEAPS;
const DOOR_CRACKS = (() => {
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
    rest: RUBBLE_OLD ? [] : rubbleLayout(DOOR_FALLEN, frame).rest,
    // (doorFix.js: 5, cracks that taper all the way out; 2, more dust round
    // what fell)
    ...(DOOR_CRACK_STYLE.taper ? { taper: true } : {}),
    ...(doorOld(2) ? {} : { dust: DOOR_DUST }),
  };
})();
// The Door's portal in the world (portal.js's frame: x along the wall, z into
// the room, from the middle of the opening), for its stone's shader
// (doorFix.js, 3). assembleWorld sets the portal there.
const PORTAL_FRAME = {
  origin: [DOOR_CRACKS.origin[0] + DOOR_CRACKS.along[0] * 1.5, DOOR_CRACKS.origin[1] + DOOR_CRACKS.along[1] * 1.5],
  x: DOOR_CRACKS.along, z: DOOR_CRACKS.into,
};

// The surfaces painted off the main thread (paint.js, paintJobs.js), named
// here so the painting can begin before the world is built: each is a painter
// in textures.js and what it is asked for. None of them draws on the world's
// own stream, so where and when they are painted changes nothing they show.
export const PAINTED = {
  // the floor: a mason's pavement (`paving`, 2026-10-06) or the tiles it replaced
  flag: FLOOR_OLD ? ['flagstones'] : ['paving'],
  ...(CRACK_OLD ? {} : { cracks: ['floorCracks', DOOR_CRACKS] }),
  // Twelve courses to the tile, not eight: a course about 30 cm, a block
  // about 70 cm long, each a little further from the next in tone. At eight
  // they were a torso high, and over an arch every block looked the same;
  // at sixteen (22 cm) the wall read as small brick, not dressed stone
  // (the review of 2026-10-08, point 5; ?wvest=old:5 lays the old).
  wall: vestOld(5) ? ['ashlar'] : ['ashlar', { courses: 12, blocks: 5, spread: 24 }],
  // the caps' pale stone; the Door's dressed faces are the same stone, laid smaller
  pale: ['ashlar', { seed: 9, courses: 4, blocks: 2, tone: [158, 150, 136], strength: 2 }],
  // The wood: boards sawn from the log, grain along u (`timber`, 2026-10-05),
  // or the striped walnut it replaced (?wwood=old, see woodGrain.js).
  wood: WOOD_OLD ? ['walnut'] : ['timber'],
  timber: WOOD_OLD ? ['walnut', { seed: 23, tone: CEDAR }] : ['timber', { seed: 23, tone: CEDAR_WOOD, ring: 9, knots: 2 }],
  // the bindings, lettered (spineAtlas2 and its titles) unless ?wbook says
  // to see them as they were (see effects.js)
  // (with the tooling varied down each back: vertigoFix.js, 2)
  spines: BOOKS_TITLED ? ['spineAtlas2', { tooling: !vertigoOld(2) }] : ['spineAtlas'],
  ...(BOOKS_TITLED ? { titles: ['spineTitles'] } : {}),
  // the far galleries' books, in painted rows (see shelfWall)
  bookRows: ['bookRows', BOOK_ROWS],
  hedge: ['hedgeLeaves'],
  carve: ['limestone'],
  // the Door's fallen stone (rubble.js), laid on by M.rubble
  ...(RUBBLE_OLD ? {} : { rubble: ['rubbleStone'] }),
  // the garden's granite and the pond's pebbled bank (shore.js)
  ...(SHORE_OLD ? {} : { shoreRock: ['shoreRock'], shoreBank: ['shoreBank'] }),
  column: ['limestone', { seed: 73, tone: [172, 165, 152], honed: true }],
  bark: ['bark'],
};

// Built in one go, as it always was. World.jsx builds it a section at a time
// instead (assembleWorld below), so the page can breathe and say how far along
// it is while the Library goes up.
export function buildWorld(options) {
  const steps = assembleWorld(options);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

// The world, built section by section: it yields between them (the name of the
// one it is about to start) and returns the world. `painter` hands out the
// PAINTED surfaces (paint.js); without one they are painted here and now.
export function* assembleWorld({ light = false, paintings = true, painter = paintNow(PAINTED) } = {}) {
  let seed = 1941;
  const rnd = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const dir = (a) => [Math.cos(a * deg), Math.sin(a * deg)];
  const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s];
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const unit2 = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const hexPts = (c, r) => Array.from({ length: 6 }, (_, k) => add(c, dir(60 * k), r));
  const circlePts = (c, r, n = 48) => Array.from({ length: n }, (_, k) => add(c, dir((360 * k) / n), r));
  const rot3 = () => [rr(0, 3), rr(0, 3), rr(0, 3)];
  const detail = light ? 0.5 : 1;

  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // ── Painted textures ──────────────────────────────────────────────────────
  const paint = (w, h, fn) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    fn(c.getContext('2d'), w, h);
    return c;
  };
  const tex = (canvas, repeat = [1, 1], srgb = true) => {
    const t = keep(new THREE.CanvasTexture(canvas));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const withRepeat = (t, repeat) => {
    const c = keep(t.clone());
    c.repeat.set(repeat[0], repeat[1]);
    c.needsUpdate = true;
    return c;
  };
  const rgb = (r, g, b, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
  const speckle = (g, w, h, n, dark, alpha, size = [0.6, 2.2]) => {
    for (let k = 0; k < n * detail; k++) {
      g.fillStyle = dark ? `rgba(0,0,0,${rr(0, alpha)})` : `rgba(255,236,205,${rr(0, alpha)})`;
      const s = rr(...size);
      g.fillRect(rr(0, w), rr(0, h), s, s);
    }
  };
  const blob = (g, x, y, r, [hh, ss, ll], alpha = 1, lightOff = 0.3) => {
    const grd = g.createRadialGradient(x - r * lightOff, y - r * lightOff, r * 0.08, x, y, r);
    grd.addColorStop(0, `hsla(${hh},${ss}%,${Math.min(95, ll + 9)}%,${alpha})`);
    grd.addColorStop(0.62, `hsla(${hh},${ss}%,${ll}%,${alpha})`);
    grd.addColorStop(1, `hsla(${hh},${ss}%,${Math.max(2, ll - 8)}%,0)`);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };

  const grassTex = tex(paint(1024, 1024, (g, s) => {
    g.fillStyle = '#1a2c21';
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 800 * detail; k++) {
      g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${rr(0.03, 0.1)})` : `rgba(96,140,96,${rr(0.02, 0.06)})`;
      g.beginPath(); g.arc(rr(0, s), rr(0, s), rr(10, 70), 0, Math.PI * 2); g.fill();
    }
    for (let k = 0; k < 36000 * detail; k++) {
      g.strokeStyle = `hsla(${rr(95, 150)},${rr(20, 42)}%,${rr(12, 30)}%,${rr(0.4, 0.8)})`;
      g.lineWidth = rr(0.6, 1.4);
      const x = rr(0, s), y = rr(0, s), a = rr(0, Math.PI * 2), L = rr(2, 7);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
  }), [1 / 46, 1 / 46]);

  const gravelOldTex = tex(paint(512, 512, (g, s) => {
    g.fillStyle = '#6f685c';
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 8000 * detail; k++) {
      const l = rr(-30, 40);
      g.fillStyle = rgb(158 + l, 150 + l, 134 + l, rr(0.6, 1));
      g.beginPath(); g.ellipse(rr(0, s), rr(0, s), rr(0.8, 3.2), rr(0.6, 2.4), rr(0, 3), 0, Math.PI * 2); g.fill();
    }
    speckle(g, s, s, 8000, true, 0.35);
  }), [1 / 16, 1 / 16]);
  // (forkProps.js, 8: that was white speckle on grey — a grain a pixel or two
  // across, forty shades apart from the next. Pebbles now: each a few
  // millimetres to a centimetre and a half, rounded, lit a little on one side,
  // a dozen shades apart, a little warm; and the bed they lie on shows dark
  // only between them. Painted from its own stream — the old one is still
  // painted above, for the draws it took from the world's.)
  const GRAVEL_COLOR = propsOld(8) ? '#6f6c66' : '#7b7367';
  const gravelTex = propsOld(8) ? gravelOldTex : tex(paint(1024, 1024, (g, s) => {
    const r = makeRng(8808), R = (a, b) => a + (b - a) * r();
    g.fillStyle = '#6c6458';
    g.fillRect(0, 0, s, s);
    const grain = (x, y, rx, ry, rot, l, warm) => {
      const c = [150 + l + warm, 140 + l, 121 + l - warm];
      // (and again across the tile's edge, where it lies over one)
      const xs = x < 8 ? [0, s] : x > s - 8 ? [0, -s] : [0], ys = y < 8 ? [0, s] : y > s - 8 ? [0, -s] : [0];
      for (const ox of xs) for (const oy of ys) {
        g.save();
        g.translate(x + ox, y + oy);
        g.rotate(rot);
        g.scale(1, ry / rx);
        const grd = g.createRadialGradient(-rx * 0.3, -rx * 0.3, rx * 0.1, 0, 0, rx);
        grd.addColorStop(0, rgb(c[0] + 9, c[1] + 9, c[2] + 8));
        grd.addColorStop(0.7, rgb(c[0], c[1], c[2]));
        grd.addColorStop(1, rgb(c[0] - 16, c[1] - 16, c[2] - 15, 0.85));
        g.fillStyle = grd;
        g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    };
    // a bed of small ones, then the pebbles over it
    for (let k = 0; k < 16000 * detail; k++) grain(R(0, s), R(0, s), R(1.6, 3), R(1.3, 2.6), R(0, 3.14), R(-16, 6), R(-3, 5));
    for (let k = 0; k < 9000 * detail; k++) grain(R(0, s), R(0, s), R(3, 6.5), R(2.4, 5), R(0, 3.14), R(-11, 13), R(-3, 6));
    // and the slow change of tone a raked bed has across a pace
    for (let k = 0; k < 60; k++) {
      const x = R(0, s), y = R(0, s), rad = R(60, 170), dark = r() < 0.5;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        if (x + ox + rad < 0 || x + ox - rad > s || y + oy + rad < 0 || y + oy - rad > s) continue;
        const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        grd.addColorStop(0, dark ? 'rgba(40,34,26,0.07)' : 'rgba(214,200,176,0.06)');
        grd.addColorStop(1, dark ? 'rgba(40,34,26,0)' : 'rgba(214,200,176,0)');
        g.fillStyle = grd;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  }), [1 / 16, 1 / 16]);

  // Stars, for the shafts, the pools and the dark under everything.
  const starCanvas = paint(512, 512, (g, s) => {
    g.fillStyle = '#01040a';
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 16; k++) {
      const x = rr(0, s), y = rr(0, s), r = rr(50, 170);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${pick(['40,140,170', '70,90,160', '30,160,150'])},${rr(0.08, 0.2)})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    }
    for (let k = 0; k < 1100 * detail; k++) {
      const big = rnd() > 0.93;
      g.fillStyle = pick(['#ffffff', '#cfefff', '#ffe9c4', '#9fe3ff']);
      g.globalAlpha = rr(0.35, 1);
      g.beginPath();
      g.arc(rr(0, s), rr(0, s), big ? rr(1, 1.8) : rr(0.3, 0.8), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 14; k++) {
      const x = rr(0, s), y = rr(0, s);
      const grd = g.createRadialGradient(x, y, 0, x, y, 6);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(1, 'rgba(160,230,255,0)');
      g.fillStyle = grd;
      g.fillRect(x - 6, y - 6, 12, 12);
    }
  });
  const starTex = tex(starCanvas, [1 / 180, 1 / 180]);

  const roofTex = tex(paint(256, 256, (g, s) => {
    const rows = 12, rowH = s / rows;
    for (let r = 0; r < rows; r++) {
      g.fillStyle = r % 2 ? '#26302f' : '#1e2827';
      g.fillRect(0, r * rowH, s, rowH);
      g.fillStyle = 'rgba(150,178,170,0.42)';
      g.fillRect(0, r * rowH, s, 1.6);
    }
    for (let x = 0; x < s; x += 8) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, 0, 1.4, s); }
  }), [8, 1]);

  const radialTex = tex(paint(256, 256, (g) => {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.65, 'rgba(255,255,255,0.14)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  }), [1, 1], false);
  // Where a stone lantern's light lands: nothing right under it — its own
  // platform shades the ground there — a little all round from the sun and the
  // moon, and most of it out in front of each window. Laid with the windows
  // along x. (Painted without the world's stream: see the wisteria below.)
  const lanternPoolTex = tex(paint(256, 256, (g) => {
    const ring = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    ring.addColorStop(0, 'rgba(255,255,255,0)');
    ring.addColorStop(0.12, 'rgba(255,255,255,0.08)');
    ring.addColorStop(0.24, 'rgba(255,255,255,0.34)');
    ring.addColorStop(0.55, 'rgba(255,255,255,0.1)');
    ring.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ring;
    g.fillRect(0, 0, 256, 256);
    for (const s of [-1, 1]) {
      g.save();
      g.translate(128 + s * 46, 128);
      g.scale(1, 0.6);
      const lobe = g.createRadialGradient(0, 0, 0, 0, 0, 74);
      lobe.addColorStop(0, 'rgba(255,255,255,0.6)');
      lobe.addColorStop(0.5, 'rgba(255,255,255,0.22)');
      lobe.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lobe;
      g.fillRect(-128, -128, 256, 256);
      g.restore();
    }
    g.globalCompositeOperation = 'destination-out';
    const shade = g.createRadialGradient(128, 128, 0, 128, 128, 34);
    shade.addColorStop(0, 'rgba(0,0,0,1)');
    shade.addColorStop(0.55, 'rgba(0,0,0,0.85)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = shade;
    g.fillRect(0, 0, 256, 256);
  }), [1, 1], false);

  // (The pergola hangs its wisteria as racemes now — see the pergola — and no
  // longer lays this card over its top. It is still painted: painting it draws
  // on the world's stream, and the garden is laid out from the draws after.)
  const wisteriaTex = tex(paint(768, 300, (g, w, h) => {
    for (let k = 0; k < 700; k++) blob(g, rr(0, w), rr(16, h - 16), rr(3, 7), [rr(100, 130), rr(28, 38), rr(18, 30)], 1, 0.3);
    for (let k = 0; k < 420; k++) {
      const x = rr(8, w - 8), y = rr(18, h - 18);
      const edge = Math.abs(y - h / 2) / (h / 2);
      if (rnd() > 0.35 + edge * 0.8) continue;
      const ang = rr(0, 6.28), n = Math.floor(rr(10, 22));
      for (let m = 0; m < n; m++) {
        const t = m / n;
        blob(g, x + Math.cos(ang) * t * 17 + rr(-1.5, 1.5), y + Math.sin(ang) * t * 17 + rr(-1.5, 1.5), 4 * (1 - t * 0.65), [rr(262, 278), rr(38, 52), 44 + t * 36], 1, 0.25);
      }
    }
  }));
  const ivyTex = tex(paint(384, 192, (g, w, h) => {
    for (let k = 0; k < 520; k++) {
      const x = rr(0, w), y = rr(0, h);
      const edge = Math.max(Math.abs(x - w / 2) / (w / 2), Math.abs(y - h / 2) / (h / 2));
      if (rnd() < edge * 1.1) continue;
      blob(g, x, y, rr(4, 10), [rr(112, 140), rr(26, 40), rr(14, 28)], 1, 0.35);
    }
  }));
  // The koi were a card painted here, four blotches drawn from the world's
  // stream; they are solid fish now (pond.js), and the stream is spent as the
  // card spent it, so everything laid out after this lands where it did.
  for (let k = 0; k < 20; k++) rnd();

  // Surfaces with the maps that make light behave on them (see textures.js).
  const scaled = (set, repeat, repeatV = repeat) => {
    Object.values(set).forEach((t) => { keep(t); t.repeat.set(repeat, repeatV); });
    return set;
  };
  const again = (t, repeat, repeatV = repeat) => {
    const c = keep(t.clone());
    c.repeat.set(repeat, repeatV);
    c.needsUpdate = true;
    return c;
  };
  // A reader is 18 units tall, so a unit is 9.4 cm and these are sizes of stone:
  // a flagstone 1 m across, an ashlar course 45 cm high, the massive pale stone
  // of the caps and the drums laid 2 m by 1. (Everything they go on is projected
  // in world units — see uvWorld — so these numbers mean what they say.)
  const flag = scaled(painter.take('flag'), 1 / 32);
  // the Door's cracks, over the breach's frame (cracks.js; read by paveShade)
  const crackMap = CRACK_OLD ? null : keep(painter.take('cracks').map);
  const wall = scaled(painter.take('wall'), 1 / 38);
  const pale = scaled(painter.take('pale'), 1 / 42);
  // (the wood is a board's length of timber along u and its width across v:
  // WALNUT_TILE and CEDAR_TILE, laid by uvGrain along each piece)
  const wood = WOOD_OLD ? scaled(painter.take('wood'), 1 / 7) : scaled(painter.take('wood'), 1 / WALNUT_TILE[0], 1 / WALNUT_TILE[1]);
  const whiteTex = keep(new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1));
  whiteTex.colorSpace = THREE.SRGBColorSpace;
  whiteTex.needsUpdate = true;
  const timber = WOOD_OLD ? scaled(painter.take('timber'), 1 / 12) : scaled(painter.take('timber'), 1 / CEDAR_TILE[0], 1 / CEDAR_TILE[1]);
  const spines = painter.take('spines');
  Object.values(spines).forEach(keep);
  const titles = BOOKS_TITLED ? painter.take('titles') : null;
  // the far shelves' painted rows, and where on the strip each row lies (v
  // runs up the texture, the canvas down)
  const bookRowsSet = painter.take('bookRows');
  keep(bookRowsSet.map);
  const rowV = (() => { const L = bookRowsLayout(BOOK_ROWS); return L.at.map(({ y, h }) => ({ top: 1 - y / L.h, base: 1 - (y + h) / L.h })); })();
  if (titles) Object.values(titles).forEach(keep);
  // The frieze's key is laid in world units like the stone: seven units to a
  // pair of keys along the wall, and the board's own height (111.5 to 115) up
  // it — so the pattern sits on the board whatever length of wall it runs.
  const friezeTex = keep(friezeBand());
  friezeTex.repeat.set(1 / 7, 1 / 3.5);
  friezeTex.offset.set(0, 1 - ((111.5 / 3.5) % 1));
  const gilt = giltLetters();
  keep(gilt.map);
  const hedge = scaled(painter.take('hedge'), 1 / 12);
  // The Door's arch (portal.js): carved stone with no joints painted in it,
  // laid by the mouldings' own length (a unit of texture every nine units of
  // stone); the same pale ashlar as the caps at half the size of block, for
  // the plain faces of a doorway; the dark marble of its shafts; what hangs in it.
  const carveSet = painter.take('carve');
  Object.values(carveSet).forEach(keep);
  // the grain of what came down in the Door (rubble.js; laid on by M.rubble)
  const rubbleSet = RUBBLE_OLD ? null : painter.take('rubble');
  // the garden's granite and the pond's bank (shore.js; laid on by M.shoreRock, M.bank)
  const shoreRockSet = SHORE_OLD ? null : painter.take('shoreRock');
  const shoreBankSet = SHORE_OLD ? null : painter.take('shoreBank');
  for (const set of [shoreRockSet, shoreBankSet]) if (set) Object.values(set).forEach(keep);
  if (rubbleSet) Object.values(rubbleSet).forEach(keep);
  // (painted once: the caps' stone, laid at another size — it was painted twice)
  const dressedSet = { map: again(pale.map, 1 / 20), normalMap: again(pale.normalMap, 1 / 20), roughnessMap: again(pale.roughnessMap, 1 / 20) };
  const marbleSet = purbeck();
  Object.values(marbleSet).forEach(keep);
  // The Echo's columns: the carving's oolite again, honed, each shaft one
  // stone with its bed running up it. Everything it goes on carries its uv in
  // world units (colLathe, or projected), so a unit of texture is 9 of stone.
  const columnSet = scaled(painter.take('column'), 1 / 9);
  const hangTex = keep(hanging({ broadWillow: WILLOW_BROAD }));
  const glowTex = keep(glowTexture());
  const lampHaloTex = keep(glowTexture(256, 0.11));
  const water = makeWater({ mirror: !light });
  const wind = { value: 0 };
  const lilyPads = makeLilyPads(wind);
  lilyPads.textures.forEach(keep);
  const leaves = keep(foliageAtlas());
  const barkSet = painter.take('bark');
  Object.values(barkSet).forEach(keep);
  const shaftMaterial = keep(makeShaftMaterial());

  // A gradient across a strip (black at v = 0, white at v = 1), and a worn
  // track: opaque down the middle, thinning irregularly to nothing at both
  // sides. Both are read as alpha (from green), on the second uv set.
  const gradTex = tex(paint(8, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, h, 0, 0);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.35, '#6a6a6a');
    grd.addColorStop(1, '#000000');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }), [1, 1], false);
  const wornTex = tex(paint(64, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const across = Math.abs(x / (w - 1) - 0.5) * 2;
      const v = Math.max(0, 1 - across ** 2.2);
      g.fillStyle = `rgb(${v * 200},${v * 200},${v * 200})`;
      g.fillRect(x, 0, 1, h);
    }
    // (its own stream: a draw on the world's would move the garden)
    const wr = makeRng(71), wrr = (a, b) => a + (b - a) * wr();
    for (let k = 0; k < 600; k++) {
      g.fillStyle = `rgba(0,0,0,${wrr(0.05, 0.25)})`;
      g.fillRect(wrr(0, w), wrr(0, h), wrr(1, 4), wrr(2, 10));
    }
  }), [1, 1], false);
  for (const t of [gradTex, wornTex]) { t.channel = 1; t.wrapS = THREE.ClampToEdgeWrapping; }
  // The Door's: pale dust thinning away from the breach (v runs into the
  // room); moss drawn along the joints of the floor's own layout (textures.js,
  // `pavingLayout` — or the old tiles' four rows, three to a row, every other
  // row offset half a slab), laid in the same world units so it sits in them;
  // one leaf; a globe.
  const dustFanTex = tex(paint(128, 128, (g, w, h) => {
    const dr = makeRng(303);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1), a = 0.55 * (1 - v) ** 1.6;
      for (let x = 0; x < w; x++) {
        const across = Math.abs(x / (w - 1) - 0.5) * 2;
        g.fillStyle = `rgba(255,255,255,${a * (1 - across ** 1.8) * (0.7 + dr() * 0.3)})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  }), [1, 1]);
  dustFanTex.wrapS = dustFanTex.wrapT = THREE.ClampToEdgeWrapping;
  const mossTex = tex(paint(1024, 1024, (g, S) => {
    const mr = makeRng(808), mrr = (a, b) => a + (b - a) * mr();
    const tuft = (x, y, r) => {
      g.fillStyle = `hsla(${mrr(72, 100)},${mrr(24, 42)}%,${mrr(12, 24)}%,${mrr(0.55, 0.9)})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    if (!FLOOR_OLD) {
      // (a slab's end joint is drawn again a canvas to either side, so a
      // tuft on the edge comes back in at the other)
      for (const row of pavingLayout({ size: S })) {
        for (let x = 0; x < S; x += mrr(3, 7)) if (mr() < 0.75) tuft(x, row.y + mrr(-3, 3), mrr(3, 9));
        for (const J of row.joints.slice(0, -1)) {
          const x0 = (row.x0 + J) % S;
          for (let y = row.y; y < row.y + row.h; y += mrr(3, 7)) {
            if (mr() < 0.75) { const x = x0 + mrr(-3, 3), r = mrr(3, 9); for (const dx of [-S, 0, S]) tuft(x + dx, y, r); }
          }
          for (let n = 0; n < 3; n++) { const x = x0 + mrr(-10, 10), y = row.y + mrr(-10, 10), r = mrr(8, 18); for (const dx of [-S, 0, S]) tuft(x + dx, y, r); }
        }
      }
    } else {
      const sh = S / 4, sw = S / 3;
      for (let r = 0; r < 4; r++) {
        for (let x = 0; x < S; x += mrr(3, 7)) if (mr() < 0.75) tuft(x, r * sh + mrr(-3, 3), mrr(3, 9));
        const off = (r % 2) * sw * 0.5;
        for (let k = -1; k <= 3; k++) {
          const x0 = k * sw + off;
          for (let y = r * sh; y < (r + 1) * sh; y += mrr(3, 7)) if (mr() < 0.75) tuft(x0 + mrr(-3, 3), y, mrr(3, 9));
          for (let n = 0; n < 3; n++) tuft(x0 + mrr(-10, 10), r * sh + mrr(-10, 10), mrr(8, 18));
        }
      }
    }
  }), [1 / 32, 1 / 32]);
  const leafTex = tex(paint(64, 40, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(2, h / 2);
    g.quadraticCurveTo(w * 0.45, -h * 0.15, w - 2, h / 2);
    g.quadraticCurveTo(w * 0.45, h * 1.15, 2, h / 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(4, h / 2); g.lineTo(w - 6, h / 2); g.stroke();
  }), [1, 1]);
  const globeTex = tex(paint(512, 256, (g, w, h) => {
    const gr = makeRng(404), grr = (a, b) => a + (b - a) * gr();
    g.fillStyle = '#b9a47c';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 16; k++) {
      const x = grr(0, w), y = grr(h * 0.15, h * 0.85);
      g.fillStyle = `rgba(${grr(96, 130)},${grr(78, 100)},${grr(48, 64)},0.9)`;
      g.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        const r = grr(14, 44) * (0.6 + 0.4 * Math.sin(a * 3 + k));
        g.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r);
      }
      g.fill();
    }
    g.strokeStyle = 'rgba(70,50,30,0.35)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += w / 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = h / 6; y < h; y += h / 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }), [1, 1]);

  yield 'Materials';
  // ── Materials ─────────────────────────────────────────────────────────────
  const Std = (o) => keep(new THREE.MeshStandardMaterial(o));
  // the pond, for the stones' wet line (filled in where POND is laid out)
  const shorePond = { c: [0, 0], rx: 1, rz: 1 };
  // Walls are dirtiest where feet and smoke reach them: darker over the bottom
  // metre, where the floor is swept against them, and sooted toward the top,
  // where the lamps' heat has carried it for centuries. By height in the world
  // — the stone's texture tiles every 38 units, so no painted grime could know
  // where the floor is.
  //
  // And stone turned DOWN — the soffit of an arch, the underside of a bridge or
  // a stair — takes a little of the lamplit floor's light back up, warm. With
  // nothing to lift them those faces went flat black, which no lit room has.
  // By room (`bounceRooms`, filled once the honeycomb is laid out): strongest
  // in the Vestibule, least in the Silence.
  const bounceRooms = { value: [new THREE.Vector3(0, 0, 0)] };
  // And over the map, the coping round each of those rooms warmed from inside,
  // most at its inner edge (mapFix.js, 8): `mapWarm` is how much of the map
  // is showing — 1 over it, 0 among the walls (setVeil).
  const RIM = !mapOld(8);
  const mapWarm = { value: 1 };
  // `drum` (the Echo's walls, echoFix.js point 6): the maps laid by the
  // fragment's own place on the wall, in courses that grow lower as it rises,
  // rather than by the projected uv — { tile, rep }: the tile's size in world
  // units and the maps' repeat.
  // `lift`: how much more of that bounce this stone takes, and `side` how much
  // of it a face standing upright takes too — it sees half the floor that a
  // soffit does (the Silence's arches over its well: silenceFix.js, 4)
  // `night`: the falloff into the night round the maze alone, without the
  // weathering by height (the copings on the walls, webFix.js 2).
  const stoneShade = (mat, { weather = false, night = false, drum = null, lift = 1, side = 0 } = {}) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBounceRooms = bounceRooms;
      if (RIM) sh.uniforms.uMapWarm = mapWarm;
      sh.uniforms.uStoneLift = { value: lift };
      sh.uniforms.uStoneSide = { value: side };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vStoneW;
          varying float vStoneDown;
          varying float vStoneSide;
          ${night ? 'varying vec3 vStoneAt;' : ''}
          ${drum ? 'varying vec3 vStoneN;' : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vStoneW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          ${night ? `
          // (where it stands, for the night: a post is an instance, and its
          // own vertices are a unit box at the origin — the balusters on the
          // wall tops stayed white over the cedars: webProps.js, 1)
          vec4 stoneAt = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            stoneAt = instanceMatrix * stoneAt;
          #endif
          vStoneAt = (modelMatrix * stoneAt).xyz;` : ''}`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vStoneDown = max(0.0, -normalize(mat3(modelMatrix) * objectNormal).y);
          vStoneSide = 1.0 - abs(normalize(mat3(modelMatrix) * objectNormal).y);
          ${drum ? 'vStoneN = mat3(modelMatrix) * objectNormal;' : ''}`);
      if (drum) {
        // (every map read in main() reads this uv instead of the vertex's)
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', `varying vec3 vStoneN;
          ${drumUvGlsl(drum.tile.toFixed(2), drum.rep.toFixed(6))}
          vec2 drumUv;
          #define vMapUv drumUv
          #define vNormalMapUv drumUv
          #define vRoughnessMapUv drumUv
          void main() {
            drumUv = drumUvOf(vStoneW, normalize(vStoneN));`);
      }
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uBounceRooms[${bounceRooms.value.length}];
          ${RIM ? 'uniform float uMapWarm;' : ''}
          uniform float uStoneLift;
          uniform float uStoneSide;
          varying vec3 vStoneW;
          varying float vStoneDown;
          varying float vStoneSide;
          ${night ? 'varying vec3 vStoneAt;' : ''}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          ${weather || night ? `
            ${night ? 'vec3 stoneP = vStoneAt;' : 'vec3 stoneP = vStoneW;'}
            // the honeycomb's walls standing round the maze, let fall into
            // the night: from the court at its heart they were blank brick
            // filling the sky behind the hedges, and the walk ended against a
            // warehouse. (The heart at 1315, 423; the Door's own cell, at
            // 1005, 339, kept as it was — its walls are a room from inside.)
            float stoneNight = (1.0 - 0.88 * smoothstep(290.0, 160.0, distance(stoneP.xz, vec2(1315.0, 423.0)))
              * smoothstep(100.0, 118.0, distance(stoneP.xz, vec2(1005.2, 338.6))))
            // and behind the maze, out past that reach, the stone the cedars
            // stand in front of (webFix.js, 2): what shows between their
            // spires is dark, not brick
              * (1.0 - ${WALLS.k.toFixed(3)} * smoothstep(${WALLS.z[0].toFixed(1)}, ${WALLS.z[1].toFixed(1)}, stoneP.z)
              * smoothstep(${WALLS.x[0].toFixed(1)}, ${WALLS.x[1].toFixed(1)}, stoneP.x));
            diffuseColor.rgb *= ${weather ? `mix(0.66, 1.0, smoothstep(6.0, 17.0, vStoneW.y))
            * (1.0 - 0.3 * smoothstep(88.0, 124.0, vStoneW.y))
            *` : ''} stoneNight;` : ''}`)
        // (and its gloss with it, webFix.js 2: let fall in its colour alone,
        // the stone kept the sky in its sheen — blank brick, painted black,
        // was still brick in the moonlit sky's reflection)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
          ${(weather || night) && WALLS.spec ? `reflectedLight.directSpecular *= stoneNight;
          reflectedLight.indirectSpecular *= stoneNight;` : ''}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float bounce = 0.0;
          for (int i = 0; i < ${bounceRooms.value.length}; i++) {
            bounce = max(bounce, uBounceRooms[i].z * smoothstep(130.0, 80.0, distance(vStoneW.xz, uBounceRooms[i].xy)));
          }
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.72, 0.46) * 0.2 * bounce * uStoneLift * (vStoneDown + uStoneSide * 0.5 * vStoneSide)
            * smoothstep(60.0, 20.0, vStoneW.y);
          ${RIM ? `
          // the rims of the walk's rooms, over the map: by the flat (hexagon)
          // distance from the room's middle, warm from its inner wall out
          // across the coping, and only up at the wall tops
          if (uMapWarm > 0.0) {
            float rim = 0.0;
            for (int i = 0; i < ${bounceRooms.value.length}; i++) {
              vec2 d = vStoneW.xz - uBounceRooms[i].xy;
              float hex = max(abs(d.y), max(abs(dot(d, vec2(0.8660254, 0.5))), abs(dot(d, vec2(-0.8660254, 0.5)))));
              rim = max(rim, smoothstep(${RIM_WARM.outer.toFixed(1)}, ${RIM_WARM.inner.toFixed(1)}, hex));
            }
            totalEmissiveRadiance += diffuseColor.rgb * vec3(${RIM_WARM.color.map((x) => x.toFixed(2)).join(', ')})
              * ${RIM_WARM.k.toFixed(3)} * rim * uMapWarm * smoothstep(${(MASS_H - 14).toFixed(1)}, ${(MASS_H - 2).toFixed(1)}, vStoneW.y);
          }` : ''}`);
    };
    mat.customProgramCacheKey = () => `babel-stone-${weather ? 'w' : night ? 'n' : 'b'}${(weather || night) && WALLS.spec ? 's' : ''}${drum ? '-drum' : ''}-${bounceRooms.value.length}${RIM ? '-rim' : ''}`;
    return mat;
  };
  // Less of the sky in a surface's gloss, `k` of it, and `direct` of the
  // lamps'. (three takes no envMapIntensity from a material while the scene
  // has an environment, so it is done after the lighting.)
  const skyDull = (mat, k, direct = 1) => {
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectSpecular *= ${k.toFixed(2)};
        reflectedLight.directSpecular *= ${direct.toFixed(2)};`);
    };
    mat.customProgramCacheKey = () => `babel-skydull-${k.toFixed(2)}-${direct.toFixed(2)}`;
    return mat;
  };
  // The rails' lacquer, worn (pavilionProps.js, 10). What a member carries in
  // its vertices' colour is not a colour: red is how clean the lacquer is
  // there, green how far it is rubbed through to the wood (`wornBar`). Both
  // are broken up by the place they are at — in patches a pace across, and
  // along the timber's own grain — so that a rail is rubbed through in
  // lengths and not in a stripe; and the lacquer between is never one red.
  // Where it is whole it is a little glossier than it was, a soft sheen;
  // where it is grimed or gone, matte.
  const wornLacquer = (mat) => {
    const wood = new THREE.Color('#654a33');
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWornAt;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vWornAt = position;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWornAt;
          float wornRub = 0.0;
          float wornClean = 1.0;
          float wornHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
          float wornNoise(vec3 x) {
            vec3 i = floor(x), f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(wornHash(i), wornHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(wornHash(i + vec3(0.0, 1.0, 0.0)), wornHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
              mix(mix(wornHash(i + vec3(0.0, 0.0, 1.0)), wornHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(wornHash(i + vec3(0.0, 1.0, 1.0)), wornHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
          }`)
        .replace('#include <color_fragment>', `
          {
            float wornPatch = wornNoise(vWornAt * 0.55) * 0.65 + wornNoise(vWornAt * 2.3) * 0.35;
            float wornGrain = 0.5;
            #ifdef USE_ROUGHNESSMAP
              wornGrain = texture2D(roughnessMap, vRoughnessMapUv).g;
            #endif
            wornClean = mix(1.0, vColor.r, 0.55 + 0.45 * wornPatch);
            wornRub = smoothstep(0.5, 0.82, vColor.g + (wornPatch - 0.5) * 0.4 + (wornGrain - 0.5) * 0.3);
            diffuseColor.rgb *= mix(0.88, 1.06, wornPatch);
            // (round what is rubbed through, the lacquer thinned to its dark ground)
            diffuseColor.rgb *= 1.0 - 0.45 * wornRub * (1.0 - wornRub) * 4.0;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${wood.r.toFixed(4)}, ${wood.g.toFixed(4)}, ${wood.b.toFixed(4)}) * (0.75 + 0.5 * wornGrain), wornRub);
            diffuseColor.rgb *= wornClean;
          }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor * 0.72, 0.92, wornRub);
          roughnessFactor = mix(roughnessFactor, 0.95, (1.0 - wornClean) * 0.9);`);
    };
    mat.customProgramCacheKey = () => 'babel-worn-lacquer';
    return mat;
  };
  // The moon on a hedge's shoulder and top, from across the garden only
  // (forkProps.js, 6). Close to, a pale band along every top was the first
  // thing wrong with the maze, and there is none; far off, the hedge that
  // closes the garden was a stripe of black with nothing to say where its
  // top was. Laid on what the skyDull above left.
  const hedgeMoon = (mat) => {
    if (propsOld(6) || HEDGE_SHEEN.k <= 0) return mat;
    const inner = mat.onBeforeCompile, key = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, renderer) => {
      inner(sh, renderer);
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 hedgeN = inverseTransformDirection(normal, viewMatrix);
          float hedgeFar = smoothstep(${HEDGE_SHEEN.near.toFixed(1)}, ${HEDGE_SHEEN.far.toFixed(1)}, length(vViewPosition));
          totalEmissiveRadiance += diffuseColor.rgb * vec3(0.6, 0.74, 0.92) * ${HEDGE_SHEEN.k.toFixed(3)} * hedgeFar * smoothstep(0.2, 0.8, hedgeN.y);
        }`);
    };
    mat.customProgramCacheKey = () => `${key()}-moon-${HEDGE_SHEEN.k}`;
    return mat;
  };
  // The pavement, every slab its own. The painted tile is three metres of
  // floor, and a room is five of them across: the same slab, shade for shade,
  // came round again and again. `paving` (textures.js) writes into the
  // roughness map's spare channels which slab a pixel is (red) and which
  // repeat of the tile that slab began in (blue); with the repeat this pixel
  // is in, that names one slab of the whole floor, and each takes its own
  // shade, warmth, sheen and lie from it. Over that, the slow change of tone a
  // floor has across metres. (The slab's part fades out where a slab is down to
  // a few pixels — there the mips have mixed one slab's number with the next's.)
  const pave = { vary: { value: 1 } };
  if (import.meta.env?.DEV && typeof window !== 'undefined') window.__pave = (v) => { if (v !== undefined) pave.vary.value = v; return pave.vary.value; };
  // The cracks in the Door's pavement (cracks.js) are in the same stone, read
  // where the floor falls inside their map: their slope added to the slab's,
  // the open crack darkened and the flaked stone paler. The floor's uv is the
  // world's x and z (uvWorld) and the map lies in the breach's frame, so the
  // one is turned into the other here; off the cracks the map is neutral.
  const crackFrame = (() => {
    const { origin: o, along: t, into: n, a0, a1, b0, b1 } = DOOR_CRACKS;
    return {
      uCrackMap: { value: crackMap },
      uCrackO: { value: new THREE.Vector2(o[0] + t[0] * a0 + n[0] * b0, o[1] + t[1] * a0 + n[1] * b0) },
      uCrackAxes: { value: new THREE.Vector4(t[0] / (a1 - a0), t[1] / (a1 - a0), n[0] / (b1 - b0), n[1] / (b1 - b0)) },
      uCrackTexels: { value: new THREE.Vector2(crackSize(DOOR_CRACKS).w, crackSize(DOOR_CRACKS).h) },
    };
  })();
  const paveShade = (mat) => {
    if (FLOOR_OLD) return mat;
    const texels = (mat.roughnessMap.image?.width ?? 1024).toFixed(1);
    const tile = (1 / mat.roughnessMap.repeat.x).toFixed(4);
    // (sampled with its own gradients: a pixel's neighbours may be off the map)
    const cracks = CRACK_OLD ? '' : `
          vec2 crackW = vRoughnessMapUv * ${tile} - uCrackO;
          vec2 crackUv = vec2(dot(crackW, uCrackAxes.xy), 1.0 - dot(crackW, uCrackAxes.zw));
          vec2 crackDx = dFdx(crackUv), crackDy = dFdy(crackUv);
          if (all(greaterThan(crackUv, vec2(0.0))) && all(lessThan(crackUv, vec2(1.0)))) {
            vec3 ck = (textureGrad(uCrackMap, crackUv, crackDx, crackDy).rgb * 255.0 - 128.0) / 127.0;
            crackSlope = sign(ck.xy) * ck.xy * ck.xy * ${CRACK_SLOPE.toFixed(1)};
            // Up close a texel of the map spans several pixels, and the edge of
            // a crack would blur across them: its outline (where the dirt at its
            // edge, under 0.45, gives way to the gap, over it) is drawn crisp
            // instead, as broken stone's is, by as much as the map is magnified.
            float crackMag = max(1.0, 1.0 / max(length(crackDx * uCrackTexels), length(crackDy * uCrackTexels)));
            float crackRaw = max(-ck.z, 0.0), crackPale = max(ck.z, 0.0);
            float crackIn = clamp((crackRaw - 0.45) * (1.0 + 0.8 * (crackMag - 1.0)) + 0.5, 0.0, 1.0);
            float crackSharp = mix(min(crackRaw, 0.27), max(crackRaw, 0.6), crackIn);
            crackDark = mix(crackRaw, crackSharp, min(1.0, crackMag - 1.0));
            diffuseColor.rgb *= (1.0 - 0.94 * crackDark) * (1.0 + 0.7 * crackPale);
            roughnessFactor = clamp(roughnessFactor + 0.3 * crackDark, 0.0, 1.0);
          }`;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uPaveVary = pave.vary;
      if (!CRACK_OLD) Object.assign(sh.uniforms, crackFrame);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uPaveVary;
          uniform sampler2D uCrackMap;
          uniform vec2 uCrackO;
          uniform vec4 uCrackAxes;
          uniform vec2 uCrackTexels;
          vec3 paveHash(vec3 p) {
            p = fract(p * vec3(0.1031, 0.1030, 0.0973));
            p += dot(p, p.yxz + 33.33);
            return fract((p.xxy + p.yxx) * p.zyx);
          }
          float paveNoise(vec2 x) {
            vec2 i = floor(x), f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(paveHash(vec3(i, 3.7)).x, paveHash(vec3(i + vec2(1.0, 0.0), 3.7)).x, f.x),
              mix(paveHash(vec3(i + vec2(0.0, 1.0), 3.7)).x, paveHash(vec3(i + vec2(1.0, 1.0), 3.7)).x, f.x), f.y);
          }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          vec2 paveFw = fwidth(vRoughnessMapUv) * ${texels};
          float paveNear = uPaveVary * (1.0 - smoothstep(6.0, 28.0, max(paveFw.x, paveFw.y)));
          vec3 paveSlab = vec3(floor(vRoughnessMapUv) - vec2(floor(texelRoughness.b * 2.0 + 0.5) - 1.0, 0.0), floor(texelRoughness.r * 15.9375)) + vec3(0.37, 0.71, 0.13);
          vec3 paveH = paveHash(paveSlab) - 0.5;
          vec3 paveT = paveHash(paveSlab + 19.19) - 0.5;
          float paveMacro = paveNoise(vRoughnessMapUv * 0.45) * 0.65 + paveNoise(vRoughnessMapUv * 1.3 + 17.0) * 0.35;
          diffuseColor.rgb *= (1.0 + paveNear * 0.17 * paveH.x) * (1.0 + uPaveVary * 0.14 * (paveMacro - 0.5))
            * vec3(1.0 + paveNear * 0.06 * paveH.y, 1.0, 1.0 - paveNear * 0.08 * paveH.y);
          roughnessFactor = clamp(roughnessFactor + paveNear * 0.1 * paveH.z + uPaveVary * 0.08 * (paveMacro - 0.5), 0.0, 1.0);
          vec2 paveTilt = paveNear * 0.028 * paveT.xy;
          vec2 crackSlope = vec2(0.0);
          float crackDark = 0.0;${cracks}`)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
          reflectedLight.directSpecular *= 1.0 - 0.9 * crackDark;
          reflectedLight.indirectSpecular *= 1.0 - 0.9 * crackDark;`)
        .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale;\n\tmapN.xy += paveTilt + crackSlope;'));
    };
    mat.customProgramCacheKey = () => 'babel-pave';
    return mat;
  };
  // The lamps' pools read by the floor, not laid over it (lampPass.js)
  const lpPool = (mat) => (LAMPS.pool ? floorPoolPatch(mat) : mat);
  // The way, shown rather than explained: while the reader is on the piece's
  // own way (World.jsx, `follow`), the stone worn smooth along it catches a
  // little warm light a few strides ahead of them, and lets it go when they
  // leave the way. Only the worn strips take it (M.wornFloor, M.wornStep), and
  // they lie only along the way. World sets where the feet are, which way the
  // way runs on from them, and how much (`setWay`). ?wway=0: never.
  const WAY_SHOWN = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('wway') !== '0';
  // how much light it catches at the full of it (?wwaygain= to try another)
  const WAY_GAIN = (typeof window !== 'undefined' && Number(new URLSearchParams(window.location.search).get('wwaygain'))) || 0.9;
  const wayU = { uWay: { value: new THREE.Vector4(0, 0, 0, -1) }, uWayY: { value: 0 }, uWayOn: { value: 0 } };
  const wayLit = (mat, key) => {
    if (!WAY_SHOWN) return mat;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, wayU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWayW;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vWayW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec4 uWay;
          uniform float uWayY, uWayOn;
          varying vec3 vWayW;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            // from about two strides ahead (where the floor comes into view at
            // eye level) to about seven, fading either side of the way and where
            // the stone is well above or below the feet (another floor)
            vec2 wd = vWayW.xz - uWay.xy;
            float wAlong = dot(wd, uWay.zw);
            float wAcross = abs(wd.x * uWay.w - wd.y * uWay.z);
            float wRise = abs(vWayW.y - uWayY) - 0.6 * max(wAlong, 0.0);
            float wayGlow = uWayOn * smoothstep(8.0, 18.0, wAlong) * (1.0 - smoothstep(38.0, 66.0, wAlong))
              * (1.0 - smoothstep(7.0, 13.0, wAcross)) * (1.0 - smoothstep(6.0, 12.0, wRise));
            totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.76, 0.46) * ${WAY_GAIN.toFixed(3)} * wayGlow;
          }`);
    };
    mat.customProgramCacheKey = () => `babel-way-${key}`;
    return mat;
  };
  // where the feet are (x, y, z), the way on from them (dx, dz, level), how much
  const setWay = (amount, x = 0, y = 0, z = 0, dx = 0, dz = -1) => {
    wayU.uWayOn.value = amount;
    if (amount > 0) {
      wayU.uWay.value.set(x, z, dx, dz);
      wayU.uWayY.value = y;
    }
  };
  // What came down in the Door (rubble.js). Its grain is laid on from the
  // world's three axes at once, blended by which way a face looks: a rock is
  // turned every way, and projected along one axis per face its grain tore
  // into seams across every rough stone. RUBBLE_TILE units to the repeat, at
  // the stone's real scale on the smallest chip and the biggest block alike.
  // And the moon's fill (the emissive, as moonStone has it) comes in through
  // the breach — what faces it and the sky takes most, what is turned away a
  // third — where it lifted every face alike and flattened every stone.
  const rubbleFill = new THREE.Vector3(-DOOR_CRACKS.into[0] * 0.55, 0.8, -DOOR_CRACKS.into[1] * 0.55).normalize();
  const rubbleLit = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRubFill = { value: rubbleFill };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vRubW;
          varying vec3 vRubN;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vRubW = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vRubN = normalize(mat3(modelMatrix) * objectNormal);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uRubFill;
          varying vec3 vRubW;
          varying vec3 vRubN;`)
        .replace('#include <map_fragment>', `
          vec3 rubN = normalize(vRubN);
          vec3 rubB = pow(abs(rubN), vec3(4.0));
          rubB /= rubB.x + rubB.y + rubB.z;
          vec3 rubP = vRubW * ${(1 / RUBBLE_TILE).toFixed(5)};
          vec4 rubC = texture2D(map, rubP.zy) * rubB.x + texture2D(map, rubP.xz) * rubB.y + texture2D(map, rubP.xy) * rubB.z;
          diffuseColor *= rubC;`)
        .replace('#include <roughnessmap_fragment>', `
          float roughnessFactor = roughness * (texture2D(roughnessMap, rubP.zy).g * rubB.x + texture2D(roughnessMap, rubP.xz).g * rubB.y + texture2D(roughnessMap, rubP.xy).g * rubB.z);`)
        // (a projection's slope is the world's: x of the map along its u, y along its v)
        .replace('#include <normal_fragment_maps>', `
          vec3 rubTx = texture2D(normalMap, rubP.zy).xyz * 2.0 - 1.0;
          vec3 rubTy = texture2D(normalMap, rubP.xz).xyz * 2.0 - 1.0;
          vec3 rubTz = texture2D(normalMap, rubP.xy).xyz * 2.0 - 1.0;
          vec3 rubWN = normalize(rubN + (vec3(0.0, rubTx.y, rubTx.x) * rubB.x + vec3(rubTy.x, 0.0, rubTy.y) * rubB.y + vec3(rubTz.x, rubTz.y, 0.0) * rubB.z) * normalScale.x);
          normal = normalize((viewMatrix * vec4(rubWN, 0.0)).xyz);`)
        .replace('#include <emissivemap_fragment>', `
          totalEmissiveRadiance *= rubC.rgb * vColor.rgb * (0.33 + 0.67 * clamp(dot(rubWN, uRubFill) * 0.5 + 0.5, 0.0, 1.0));`);
    };
    mat.customProgramCacheKey = () => 'babel-rubble';
    return mat;
  };
  // Stone with a flame inside it. A lantern's light reaches its own stone
  // first — the jambs of its windows, the ledge under them, the underside of
  // its roof — and one real light per lantern would take the whole of the
  // light pool (see updateLights) to light a few square metres of stone. So
  // each vertex carries its lantern's flame (`aFlame`: where, and how strong;
  // 0 for a lantern that is out) and the way its windows face (`aFlameAxis`),
  // and the stone takes that light here as a lamp would give it: falling off
  // with distance, gone on any face turned away, strongest out of the windows.
  // It is also weathered as a garden lantern is — darker at the foot where
  // the rain splashes it, and moss on whatever faces the sky.
  const flameColor = new THREE.Color('#ffb46a');
  const flameLit = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uFlameColor = { value: flameColor };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aFlame;
          attribute vec2 aFlameAxis;
          varying vec4 vFlame;
          varying vec2 vFlameAxis;
          varying vec3 vFlameW;
          varying vec3 vFlameN;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vFlame = aFlame;
          vFlameAxis = aFlameAxis;
          vFlameW = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vFlameN = mat3(modelMatrix) * objectNormal;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uFlameColor;
          varying vec4 vFlame;
          varying vec2 vFlameAxis;
          varying vec3 vFlameW;
          varying vec3 vFlameN;
          float flameHash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }
          float flameNoise(vec3 x) {
            vec3 i = floor(x), f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(flameHash(i), flameHash(i + vec3(1, 0, 0)), f.x), mix(flameHash(i + vec3(0, 1, 0)), flameHash(i + vec3(1, 1, 0)), f.x), f.y),
              mix(mix(flameHash(i + vec3(0, 0, 1)), flameHash(i + vec3(1, 0, 1)), f.x), mix(flameHash(i + vec3(0, 1, 1)), flameHash(i + vec3(1, 1, 1)), f.x), f.y),
              f.z);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 flameN = normalize(vFlameN);
          float stoneLum = dot(diffuseColor.rgb, vec3(0.333));
          ${propsOld(4) ? `
          diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(5.2, 9.5, vFlameW.y)) * (0.8 + 0.4 * flameNoise(vFlameW * 0.42));
          float moss = smoothstep(0.4, 0.95, flameN.y)
            * smoothstep(0.42, 0.72, flameNoise(vFlameW * 0.8) * 0.65 + flameNoise(vFlameW * 2.9) * 0.35);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.062, 0.064, 0.026) * (0.7 + 2.0 * stoneLum), moss * 0.7);` : `
          // (forkProps.js, 4: it was porcelain — one pale tone, clean to the
          // ground. Granite that has stood out of doors: its grain, salt and
          // pepper; slow blotches of tone; the foot dark with damp, unevenly,
          // as high as the rain splashes; soot and wet under every ledge and
          // run down the faces below it in streaks; grey-green lichen in
          // patches where it has light; and moss on what faces the sky.)
          float gSlow = flameNoise(vFlameW * 0.42), gMid = flameNoise(vFlameW * 1.7 + 3.1), gFine = flameNoise(vFlameW * 11.0);
          float gPep = flameNoise(vFlameW * 23.0 + 7.7);
          diffuseColor.rgb *= (0.72 + 0.36 * gSlow) * (0.9 + 0.2 * gMid) * (0.84 + 0.3 * gFine) * (1.0 - 0.3 * smoothstep(0.66, 0.9, gPep));
          float damp = 1.0 - smoothstep(6.0 + 2.2 * gMid, 8.4 + 3.4 * gMid, vFlameW.y);
          diffuseColor.rgb *= mix(1.0, 0.46, damp);
          float under = smoothstep(0.1, 0.7, -flameN.y);
          float streak = smoothstep(0.5, 0.82, flameNoise(vec3(vFlameW.x * 2.6, vFlameW.y * 0.22, vFlameW.z * 2.6) + 1.3))
            * (1.0 - abs(flameN.y));
          diffuseColor.rgb *= (1.0 - 0.45 * under) * (1.0 - 0.34 * streak);
          float lichen = smoothstep(0.6, 0.76, flameNoise(vFlameW * 1.15 + 9.4) * 0.7 + flameNoise(vFlameW * 4.3) * 0.3)
            * smoothstep(-0.25, 0.3, flameN.y) * (1.0 - damp);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.21, 0.16) * (0.75 + 0.5 * gFine), lichen * 0.55);
          float moss = smoothstep(0.3, 0.9, flameN.y)
            * smoothstep(0.36, 0.62, flameNoise(vFlameW * 0.8) * 0.6 + flameNoise(vFlameW * 2.9) * 0.4);
          moss = max(moss, damp * smoothstep(0.55, 0.8, flameNoise(vFlameW * 1.9 + 5.0)) * smoothstep(-0.2, 0.5, flameN.y) * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.062, 0.022) * (0.75 + 0.6 * gFine), moss * 0.82);`}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec3 toFlame = vFlame.xyz - vFlameW;
          float flameD2 = max(dot(toFlame, toFlame), 0.01);
          float flameNdl = max(0.0, dot(flameN, toFlame * inversesqrt(flameD2)));
          float flameOut = length(toFlame.xz);
          float flameAim = flameOut > 0.3 ? abs(dot(-toFlame.xz / flameOut, vFlameAxis)) : 1.0;
          totalEmissiveRadiance += diffuseColor.rgb * uFlameColor * vFlame.w * flameNdl
            * mix(0.35, 1.0, flameAim * flameAim * flameAim) / (1.0 + 0.16 * flameD2);`);
    };
    mat.customProgramCacheKey = () => `babel-flame-stone${propsOld(4) ? '' : '-granite'}`;
    return mat;
  };
  const sprite = (map) => Std({ map, alphaTest: 0.32, roughness: 0.9, side: THREE.DoubleSide });
  const M = {
    floor: lpPool(paveShade(Std({ map: flag.map, normalMap: flag.normalMap, roughnessMap: flag.roughnessMap, color: stoneTint('#8d7f6e', '#8a857b'), roughness: 1, side: THREE.DoubleSide }))),
    mass: stoneShade(Std({ map: wall.map, normalMap: wall.normalMap, roughnessMap: wall.roughnessMap, color: stoneTint('#b6a897', '#ada89e'), roughness: 1, side: THREE.DoubleSide }), { weather: true }),
    // the Echo's: the same stone, coursed lower as it rises (echoFix.js, 6)
    drum: stoneShade(Std({ map: wall.map, normalMap: wall.normalMap, roughnessMap: wall.roughnessMap, color: stoneTint('#b6a897', '#ada89e'), roughness: 1, side: THREE.DoubleSide }), { weather: true, drum: { tile: 1 / wall.map.repeat.x, rep: wall.map.repeat.x } }),
    cap: stoneShade(Std({ map: pale.map, normalMap: pale.normalMap, roughnessMap: pale.roughnessMap, color: stoneTint('#b3a894', '#b0aa9d'), roughness: 1, side: THREE.DoubleSide }), { night: WALLS.spec }),
    // the same stone in the Silence's flights, where the lamp over the landing
    // reached in under it (no lamp casts a shadow) and drew a lit line along
    // every voussoir and string: a striped ziggurat in the quietest room
    // (its undersides lifted by the floor's bounce: silenceFix.js, 4)
    capShade: stoneShade(Std({ map: pale.map, normalMap: pale.normalMap, roughnessMap: pale.roughnessMap, color: stoneTint('#5e584d', '#5b5850'), roughness: 1, side: THREE.DoubleSide }), silenceOld(4) ? {} : ARCH_LIFT),
    shelf: Std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, roughness: 1 }),
    shelfBack: Std({ map: wood.map, color: '#7a6754', roughness: 1 }),
    // the Vertigo's shelves' moulded fronts, a darker walnut (vertigoFix.js, 3)
    shelfLip: Std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, color: LIP_COLOR, roughness: 0.92 }),
    books: keep(makeBookMaterial(spines, titles?.map)),
    bookRows: Std({ map: bookRowsSet.map, roughness: 0.85 }),
    // the same paint on a gallery's top two tiers: washed by its lamp-rail as
    // the books' shader washes them (aLit.x, the room's graze), and greyed in
    // the Silence (aLit.y) as its bindings are
    bookRowsLit: (() => {
      const m = Std({ map: bookRowsSet.map, roughness: 0.85 });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
          attribute vec2 aLit;
          varying vec2 vLit;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
          vLit = vec2(aLit.x * pow(smoothstep(78.0, 111.0, (modelMatrix * vec4(transformed, 1.0)).y), 1.6), aLit.y);`);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
          varying vec2 vLit;`)
          .replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), 0.6 * vLit.y) * (1.0 - 0.2 * vLit.y);`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.7, 0.42) * vLit.x * ${GRAZE.toFixed(3)};`);
      };
      m.customProgramCacheKey = () => 'babel-rows-lit';
      return m;
    })(),
    // the dressing of a bookcase (see shelfWall)
    frieze: Std({ map: friezeTex, roughness: 0.55, metalness: 0.25 }),
    plate: Std({ map: keep(bayPlates()), roughness: 0.35, metalness: 0.05 }),
    letters: Std({ map: gilt.map, roughness: 0.45, metalness: 0.35, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    scallop: Std({ map: keep(shelfEdge()), color: '#6a3c26', alphaTest: 0.5, roughness: 0.8, side: THREE.DoubleSide }),
    railGlow: keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc07a').multiplyScalar(0.75), toneMapped: false })),
    // A darker stone for the band a floor keeps along its walls, so a room
    // has an edge to it and not one grid from wall to well.
    floorBand: lpPool(paveShade(Std({ map: flag.map, normalMap: flag.normalMap, roughnessMap: flag.roughnessMap, color: '#5a554c', roughness: 1, side: THREE.DoubleSide }))),
    // Bronze where hands go: the top of a handrail, a newel's cap. Rubbed
    // bright and smooth, where the rest has gone dark.
    bronzeWorn: Std({ color: '#86653b', roughness: 0.42, metalness: 0.8, side: THREE.DoubleSide }),
    // The ladders, the stools, the catalogue's drawer fronts: a paler wood
    // than the cases'. (One flat colour until 2026-10-05, and under a lamp a
    // ladder's rail lit up like a rod of orange plastic.) The cases' walnut,
    // tinted up in linear light, so it shares their compiled program.
    oak: WOOD_OLD ? Std({ color: '#5e3f27', roughness: 0.55 })
      : Std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, color: new THREE.Color().setRGB(1.55, 1.36, 1.1), roughness: 1.1 }),
    shade: ((m) => (LAMPS.corner ? shadeLit(m, 6 + 7.6 + 3.75, 6 + 7.6 + 5.55) : m))(Std({ color: '#7a4a22', emissive: '#ff9a48', emissiveIntensity: 1.3, roughness: 0.7, side: THREE.DoubleSide })),
    shadeDead: Std({ color: '#4d3e32', roughness: 0.85, side: THREE.DoubleSide }),
    paper: Std({ color: '#cdbf9e', roughness: 0.9 }),
    // the front edge of a shelf where books have gone in and out for centuries
    shelfWorn: WOOD_OLD ? Std({ color: '#6e4d31', roughness: 0.45 })
      : Std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, color: new THREE.Color().setRGB(2.5, 2.3, 1.9), roughness: 0.8 }),
    dust: Std({ color: '#8b857a', roughness: 1 }),
    // the soft dark line where a case stands on the floor
    contact: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.5, alphaMap: gradTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
    // Stone walked smooth: the floor's and the stair's own stone, paler and
    // with a sheen, in a strip that fades out at both sides. Laid over the
    // stone in world units, so its joints are the stone's joints.
    // (Roughness 0.34 and 0.36 until 2026-10-05: a tread worn that glossy
    // took the lamp over it as a hot spot the size of a footprint.)
    // (and catches the light a few strides on where the reader walks the way: `wayLit`)
    wornFloor: wayLit(Std({ map: flag.map, color: '#a8a295', roughness: 0.56, transparent: true, depthWrite: false, alphaMap: wornTex, polygonOffset: true, polygonOffsetFactor: -2 }), 'floor'),
    wornStep: wayLit(Std({ map: again(flag.map, 1 / 22), color: '#c6c0b2', roughness: 0.58, transparent: true, depthWrite: false, alphaMap: wornTex, polygonOffset: true, polygonOffsetFactor: -2 }), 'step'),
    // a stair's risers, in the shadow of the lip over them; the joints of a parapet
    riserShade: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
    // The Echo's stair read by its values (echoFix.js, 2): the lip the palest
    // stone on it, the riser only a shade under the tread — at 0.4 every
    // riser was a black slot and the flight a stack of separate slabs.
    // (in the balustrades' jointless limestone: the caps' ashlar put a mortar
    // joint through the middle of every lip, a dark slot down the flight)
    nosing: stoneShade(Std({ map: again(carveSet.map, 1 / 13), normalMap: again(carveSet.normalMap, 1 / 13), roughnessMap: again(carveSet.roughnessMap, 1 / 13), color: '#d6cfc0', roughness: 1, side: THREE.DoubleSide })),
    riserSoft: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
    joint: Std({ color: '#2a241e', roughness: 1 }),
    deadShards: Std({ color: '#3d3833', roughness: 0.22, metalness: 0, envMapIntensity: 0.8, side: THREE.DoubleSide }),
    dustFan: Std({ map: dustFanTex, color: '#bdb3a2', roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    moss: Std({ map: mossTex, roughness: 1, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3 }),
    leaf: Std({ map: leafTex, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide }),
    globeMap: Std({ map: globeTex, roughness: 0.55 }),
    // What came down with the Door's wall lies in the light that comes in
    // through it: no lamp reaches it, and unlit it read as black chips.
    moonRock: Std({ map: again(pale.map, 0.35), normalMap: again(pale.normalMap, 0.35), color: '#b3aa9c', roughness: 0.95, emissive: '#71897b', emissiveIntensity: 0.28, emissiveMap: again(pale.map, 0.35) }),
    moonStone: Std({ map: pale.map, normalMap: pale.normalMap, color: '#b0aa9d', roughness: 1, emissive: '#71897b', emissiveIntensity: 0.22, emissiveMap: pale.map }),
    // The same, for the stones of rubble.js, in a grain of their own (no
    // joints: the pale ashlar drew a little wall across every fallen block).
    // Each stone's tone is in its vertices — the room's face smoked, the break
    // fresh, dark in its hollows and at its foot, dust on top — and see
    // `rubbleLit` for how the grain is laid and the moon's fill comes in.
    rubble: rubbleSet && rubbleLit(Std({
      map: rubbleSet.map, normalMap: rubbleSet.normalMap, roughnessMap: rubbleSet.roughnessMap, normalScale: new THREE.Vector2(0.9, 0.9),
      vertexColors: true, color: '#b0aa9d', roughness: 1, emissive: '#71897b', emissiveIntensity: 0.22,
    })),
    // The garden's stones and the pond's bank (shore.js): each stone's tone,
    // moss and lichen in its vertices, its grain laid on from three sides,
    // wet from the water up; the bank the lawn's grass and the ways' gravel
    // where it meets them, pebbled earth at the water.
    shoreRock: shoreRockSet && shoreRockLit(Std({
      map: shoreRockSet.map, normalMap: shoreRockSet.normalMap, normalScale: new THREE.Vector2(0.85, 0.85),
      vertexColors: true, color: '#9a9389', roughness: 1,
    }), { waterY: WATER_Y, pond: shorePond }),
    pebble: shoreRockSet && shoreRockLit(Std({ map: shoreRockSet.map, vertexColors: true, color: '#9a9389', roughness: 1 }), { waterY: WATER_Y, pond: shorePond, lite: true }),
    bank: shoreBankSet && bankLit(Std({
      map: shoreBankSet.map, normalMap: shoreBankSet.normalMap, normalScale: new THREE.Vector2(1, 1),
      color: '#c4baa8', roughness: 1,
    }), { grass: grassTex, gravel: gravelTex, grassColor: '#5e6d63', gravelColor: GRAVEL_COLOR, grassRepeat: 1 / 46, gravelRepeat: 1 / 16 }),
    bronze: Std({ color: '#7d5d38', roughness: 0.46, metalness: 0.8, side: THREE.DoubleSide }),
    bronzeDim: Std({ color: '#4e3d2b', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
    inlay: Std({ color: '#9c7c3c', roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide }),
    // (the fillet round each floor, in its own duller brass: auditFix.js, 1)
    fillet: Std({ ...FILLET_BRASS, side: THREE.DoubleSide }),
    mirror: Std({ color: '#767c82', roughness: 0.34, metalness: 0.95, envMapIntensity: 2.4 }),
    liner: Std({ color: '#2a2219', roughness: 1, side: THREE.DoubleSide }),
    stars: keep(new THREE.MeshBasicMaterial({ map: starTex, color: '#ffffff', toneMapped: false, side: THREE.DoubleSide })),
    step: stoneShade(Std({ map: again(flag.map, 1 / 22), normalMap: again(flag.normalMap, 1 / 22), roughnessMap: again(flag.roughnessMap, 1 / 22), color: stoneTint('#b3a692', '#aea99b'), roughness: 1 })),
    glow: keep(makeGlowMaterial()),
    globe: keep(makeLampGlobeMaterial()),
    // (the lamp pass, lampPass.js: paper lit from its flame, the Pavilion's
    // table panels, candle flames and the wax under them)
    lpPaper: keep(makePaperMaterial()),
    lpPanel: keep(Object.assign(makePaperMaterial({ lattice: true, flame: [0, -0.15, 0], gain: 0.62, near: 0.4 }), { side: THREE.DoubleSide })),
    lpFlame: keep(makeFlameMaterial({ alive: !doorPropsOld(4) })),
    // (the Door's candles: wax, its tone in its vertices, the flame showing a little through it — doorProps.js, 4)
    wax: Std({ vertexColors: true, roughness: 0.42, emissive: '#3b2412', emissiveIntensity: 0.3 }),
    lpWax: keep(waxGlowMaterial()),
    // A globe that has gone out: the same opal glass with nothing behind it —
    // dull, dark and opaque, catching only a highlight of the lamp still lit.
    // (smoked and dulled: silenceFix.js, 3)
    deadGlass: deadOpal(deadGlassPatch(Std({ color: '#5c544a', roughness: LAMPS.glint ? 0.07 : 0.3, metalness: 0, envMapIntensity: 0.7 }))),
    foliage: keep(makeFoliageMaterial(leaves, wind, FOLIAGE_KINDS, { prepassed: true })),
    foliagePre: keep(makeFoliagePrepass(leaves, wind, FOLIAGE_KINDS)),
    // the dead leaf a hedge stands in: its own leaf, browned, laid flat
    hedgeLitter: Std({
      name: 'hedge-litter', map: hedge.map, color: '#8c7556', roughness: 1, vertexColors: true,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    // the same again for the hedges' sprigs (one program with the trees'; a
    // material of their own so they can be told apart — and switched off —
    // by name)
    hedgeLeaf: keep(Object.assign(makeFoliageMaterial(leaves, wind, FOLIAGE_KINDS, { prepassed: true }), { name: 'hedge-leaf' })),
    hedgeLeafPre: keep(Object.assign(makeFoliagePrepass(leaves, wind, FOLIAGE_KINDS), { name: 'hedge-leaf-pre' })),
    // the trees' wood (trees.js): each tree's bark colour is in its vertices
    bark: Std({ map: barkSet.map, normalMap: barkSet.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), vertexColors: true, roughness: 0.95 }),
    glass: Std({ color: '#ffe2b8', transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0, envMapIntensity: 2.2, depthWrite: false }),
    iron: Std({ color: '#2a2520', roughness: 0.6, metalness: 0.6 }),
    grass: Std({ map: grassTex, color: '#5e6d63', roughness: 1, side: THREE.DoubleSide }),
    gravel: Std({ map: gravelTex, color: GRAVEL_COLOR, roughness: 1, side: THREE.DoubleSide }),
    mazeFloor: Std({ map: gravelTex, color: '#635f57', roughness: 1, side: THREE.DoubleSide }),
    wood: Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: '#9d7d5e', roughness: 0.85 }),
    plank: WOOD_OLD ? Std({ map: again(timber.map, 1 / 16), normalMap: again(timber.normalMap, 1 / 16), color: '#b59872', roughness: 0.85 })
      : Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: '#b59872', roughness: 0.85 }),
    // Red lacquer over wood: the colour is the lacquer's, but the board under
    // it shows in the gloss — the grain a faint relief, the sheen a little
    // uneven along it. (A white map so it compiles as the garden's wood does.)
    lacquer: WOOD_OLD ? Std({ color: '#5a2620', roughness: 0.45 })
      : Std({ map: whiteTex, normalMap: timber.normalMap, normalScale: new THREE.Vector2(0.22, 0.22), roughnessMap: timber.roughnessMap, color: '#5a2620', roughness: 0.55 }),
    roof: Std({ map: roofTex, roughness: 0.55, flatShading: true }),
    // Ridge tiles: the rolls and hips laid over the roof shell. Glazed the same
    // green but darker, because a ridge is a doubled course and sits in its own
    // shadow — one colour for both and the ridges vanish into the shell.
    ridge: Std({ color: '#222c2a', roughness: 0.5 }),
    gold: Std({ color: '#d6ae58', roughness: 0.25, metalness: 0.9 }),
    rock: Std({ map: again(pale.map, 0.35), normalMap: again(pale.normalMap, 0.35), color: '#9f9688', roughness: 0.95 }),
    // Clipped box (hedges.js): its shade is in its vertices, its gloss in the
    // leaf. Not for the sky: a face of glossy leaf seen at a grazing angle took
    // the moonlit sky as a pale grey band along every top. And only a fifth of
    // it for the lamps, as the sprigs on it have (effects.js): under the
    // maze's heart lamp every leaf-dome in the texture caught its own warm
    // highlight, and the face went mustard and leopard-spotted behind sprigs
    // that stayed green.
    hedge: hedgeMoon(skyDull(Std({
      name: 'hedge',
      map: hedge.map, normalMap: hedge.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: hedge.roughnessMap,
      color: '#d6dccb', roughness: 1, vertexColors: true,
    }), 0.1, HEDGE_DIAL === 'gloss' ? 1 : 0.2)),
    gardenStone: Std({ map: again(pale.map, 0.35), normalMap: again(pale.normalMap, 0.35), color: '#a39a8b', roughness: 0.95, vertexColors: true }),
    rakeDark: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
    // (unlit, like the furrow: one shader for both, and each new one costs the
    // world a fraction of a second more to compile before it can be shown)
    rakeLit: keep(new THREE.MeshBasicMaterial({ color: '#9a9284', transparent: true, opacity: forkOld(2) ? 0.13 : RAKE.lit, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
    // the Fork's furrows, fainter than the court's rings (forkFix.js, 2: the
    // same program, another opacity)
    forkRakeDark: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: forkOld(2) ? 0.3 : RAKE.dark, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
    // the Fork's waymark, a post of weathered timber (forkFix.js, 3)
    forkPost: Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: WAYMARK.color, roughness: 0.9 }),
    // the caps shod on the Pavilion's bracket arms, dark bronze (pavilionFix.js, 2)
    pavBronze: Std({ color: '#5c4630', roughness: 0.5, metalness: 0.65 }),
    // the armillary's pedestal, turned from one stone: the garden stone's
    // tint on the lanterns' jointless carving (webFix.js, 7 — the ashlar's
    // mortar ran in joints down the lettered shaft)
    pedestalStone: stoneShade(Std({ map: again(carveSet.map, 1 / 11), normalMap: again(carveSet.normalMap, 1 / 11), roughnessMap: again(carveSet.roughnessMap, 1 / 11), color: '#b9ae9f', roughness: 1 })),
    // the Pavilion's own (pavilionProps.js): the dark gilt of its columns'
    // collars (13); the green and the chalk line painted on its bracket arms
    // (3); the cloth under the qin (4) — none with a map, so all of them the
    // ridge's compiled program; and its rails' lacquer, worn (10)
    pavGilt: Std({ ...DARK_GILT }),
    pavGreen: Std({ color: CAIHUA.green, roughness: 0.82 }),
    pavChalk: Std({ color: CAIHUA.chalk, roughness: 0.88 }),
    brocade: Std({ color: '#39452e', roughness: 0.93 }),
    lacquerWorn: wornLacquer(WOOD_OLD ? Std({ color: '#5a2620', roughness: 0.45, vertexColors: true })
      : Std({ map: whiteTex, normalMap: timber.normalMap, normalScale: new THREE.Vector2(0.22, 0.22), roughnessMap: timber.roughnessMap, color: '#5a2620', roughness: 0.55, vertexColors: true })),
    blackLacquer: Std({ color: '#17110d', roughness: 0.32 }),
    silk: Std({ color: '#e2d6bc', roughness: 0.6 }),
    // The guqin player's cushion: cloth, not lacquer. In the lacquer it took
    // the table lamp as a near-white disc at the foot of the table, where the
    // table's own shade should be darkest. (No maps, so it shares the ridge's
    // compiled program.)
    cushion: Std({ color: '#4e231c', roughness: 0.92 }),
    newWood: Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: '#e3d2ae', roughness: 0.8 }),
    stone: stoneShade(Std({ map: again(pale.map, 1 / 26), normalMap: again(pale.normalMap, 1 / 26), roughnessMap: again(pale.roughnessMap, 1 / 26), color: '#b9ae9f', roughness: 1 })),
    // the same stone in the balustrades on the wall tops, let fall into the
    // night round the maze with the walls and copings under them (webProps.js,
    // 1: over the cedars it was a pale lit strip, the one thing of the Library
    // left in the court's sky)
    wallTop: stoneShade(Std({ map: again(pale.map, 1 / 26), normalMap: again(pale.normalMap, 1 / 26), roughnessMap: again(pale.roughnessMap, 1 / 26), color: '#b9ae9f', roughness: 1 }), { night: !webPropsOld(1) }),
    frame: Std({ color: '#7a5a30', roughness: 0.4, metalness: 0.6 }),
    // water gilding on the pier glasses' carving (mirror.js), burnished and old
    gilt: Std({ color: '#c2994c', roughness: 0.34, metalness: 0.9 }),
    giltDeep: Std({ color: '#6f5128', roughness: 0.62, metalness: 0.75 }),
    // The garden's stone lanterns: cut stone with no joints in it (a lantern
    // is carved from five blocks, not laid in courses), lit from inside.
    lanternStone: flameLit(Std({ map: again(carveSet.map, 1 / 11), normalMap: again(carveSet.normalMap, 1 / 11), roughnessMap: again(carveSet.roughnessMap, 1 / 11), color: propsOld(4) ? '#b3ada2' : '#8d8a85', roughness: 1 })),
    // the paper of their windows, coloured by the flame behind it (litPaper)
    lanternPaper: keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })),
    paperDead: Std({ color: '#6f685c', roughness: 0.95, side: THREE.DoubleSide }),
    leather: Std({ color: '#4a2519', roughness: 0.62 }),
    tuft: Std({ color: '#4c5c33', roughness: 1, emissive: '#1f2b18', emissiveIntensity: 0.5 }),
    // the lawn's blades in a lantern's light (lawn.js; forkProps.js, 10)
    lawnBlade: bladeLit(Std({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })),
    petal: Std({ color: '#cdbfe0', roughness: 0.8, side: THREE.DoubleSide, emissive: '#3a3348', emissiveIntensity: 0.45 }),
    wisteria: sprite(wisteriaTex),
    ivy: sprite(ivyTex),
    // the Door's grown ivy, a leaf at a time (ivy.js): glossy, its veins pale,
    // its underside paler and duller; and the wisteria's leaflets
    ivyLeaf: backPaler(Std({ map: keep(ivyLeafTexture(7)), roughness: 0.42, side: THREE.DoubleSide }), 'babel-ivy-leaf'),
    vineLeaf: backPaler(Std({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide }), 'babel-vine-leaf'),
    carve: stoneShade(Std({ map: carveSet.map, normalMap: carveSet.normalMap, roughnessMap: carveSet.roughnessMap, color: stoneTint('#b3a894', '#b4aea1'), roughness: 1, side: THREE.DoubleSide })),
    // the same, in the Silence's shaded stone (capShade's tone): its stone
    // balustrade, which goes on from the flights' dark stone (one program
    // with `carve`)
    carveShade: stoneShade(Std({ map: carveSet.map, normalMap: carveSet.normalMap, roughnessMap: carveSet.roughnessMap, color: stoneTint('#5e584d', '#5b5850'), roughness: 1, side: THREE.DoubleSide })),
    dressed: stoneShade(Std({ map: dressedSet.map, normalMap: dressedSet.normalMap, roughnessMap: dressedSet.roughnessMap, color: stoneTint('#b3a894', '#aca699'), roughness: 1, side: THREE.DoubleSide }), { weather: true }),
    marble: Std({ map: marbleSet.map, roughness: 0.24, metalness: 0, envMapIntensity: 1.3 }),
    column: stoneShade(Std({ map: columnSet.map, normalMap: columnSet.normalMap, roughnessMap: columnSet.roughnessMap, color: stoneTint('#b3a894', '#bab3a6'), roughness: 1 })),
    hang: keep(makeHangingMaterial(hangTex, wind, HANGING_KINDS, { keepCoverage: WILLOW_BROAD, weep: pavPropsOld(6) ? null : WILLOW })),
    // the lilies of the pond (pond.js): four kinds of leaf in one atlas, and the flowers
    lily: keep(lilyPads.material),
    flower: keep(makeFlowerMaterial()),
  };

  const root = new THREE.Group();
  root.name = 'world';

  // Geometry is merged per material AND per patch of ground. From above the
  // whole honeycomb is in view and the patches cost nothing extra; but a reader
  // standing in one gallery sees two or three rooms, and one world-sized mesh
  // would have every book in the Library drawn behind the walls. A patch can be
  // culled (see `cull`), and sorted front to back.
  const CHUNK = 450;
  const chunkKey = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
  const centre = new THREE.Vector3();
  class Batch {
    // `project`: lay this batch's texture in world units rather than per face.
    constructor(mat, { cast = true, receive = true, project = false } = {}) { Object.assign(this, { mat, cast, receive, project, chunks: new Map() }); }
    // `uvAt`: lay it as it lies that far off ([x, z]) — the way in, dressed as
    // the hallway its doorway opens as (see WAY_IN).
    add(geo, uvAt = null) {
      const grain = geo.userData.grain;
      const flat = geo.index ? geo.toNonIndexed() : geo;
      if (flat !== geo) geo.dispose();
      // (`project: 'grain'`: wood, laid along each piece — see woodGrain.js)
      if (this.project === 'grain') uvGrain(flat, uvAt, grain);
      else if (this.project) uvWorld(flat, uvAt);
      flat.computeBoundingBox();
      flat.boundingBox.getCenter(centre);
      const k = chunkKey(centre.x, centre.z);
      if (!this.chunks.has(k)) this.chunks.set(k, []);
      this.chunks.get(k).push(flat);
      return this;
    }
    flush(name = '') {
      for (const geos of this.chunks.values()) {
        const geo = keep(mergeGeometries(geos, false));
        geos.forEach((g) => g.dispose());
        geo.computeBoundingSphere();
        const m = new THREE.Mesh(geo, this.mat);
        m.castShadow = this.cast;
        m.receiveShadow = this.receive;
        // Named so a probe can say WHAT the walk is standing in (see probe.js).
        m.name = name;
        root.add(m);
      }
      this.chunks.clear();
    }
  }
  // A hole must be drawn the opposite way round to the outline it is cut in, or
  // its walls come out inside out — and three only squares the two up when the
  // OUTLINE is the one it had to turn round (the `reverse` branch of its
  // ExtrudeGeometry). Every outline here is drawn clockwise, so that branch
  // never ran and every hole kept the winding it arrived with: the stone had no
  // inner face at all. A gallery's own walls were culled from inside it — the
  // eye looked straight through them into the next room, which is what walking
  // the Library felt like.
  const wound = (pts, clockwise) => {
    const v = pts.map(([x, z]) => new THREE.Vector2(x, -z));
    return THREE.ShapeUtils.isClockWise(v) === clockwise ? v : v.reverse();
  };
  const slabGeo = (pts, holes, depth, y0) => {
    const shape = new THREE.Shape(wound(pts, false));
    for (const h of holes) shape.holes.push(new THREE.Path(wound(h, true)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y0, 0);
    return geo;
  };
  const boxGeo = ([ax, az], [bx, bz], h, t, y0) => {
    const len = Math.max(0.5, Math.hypot(bx - ax, bz - az));
    const g = new THREE.BoxGeometry(len, h, t);
    g.rotateY(-Math.atan2(bz - az, bx - ax));
    g.translate((ax + bx) / 2, y0 + h / 2, (az + bz) / 2);
    return g;
  };
  const placed = (geo, [x, z], y, ry = 0) => { geo.rotateY(ry); geo.translate(x, y, z); return geo; };
  // A side profile — [along, height] — extruded across its own width and stood
  // where it belongs. What a flight of steps is: stepped along the top and, in
  // a room where you walk UNDER it, something on the underside that could hold
  // the stone up.
  const profileGeo = (pts, width, centre, ang) => {
    const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -width / 2);
    g.rotateY(-Math.atan2(Math.sin(ang * deg), Math.cos(ang * deg)));
    g.translate(centre[0], 0, centre[1]);
    return g;
  };
  // Texture at a real size, everywhere. Three lays UVs in world units on an
  // ExtrudeGeometry but 0..1 across every face of a BoxGeometry, so one stone
  // material drew 3-metre courses on a wall and a smear of half a block on a
  // step — the same ruled-cardboard reading the balcony pass measured, at five
  // times the scale. Projecting every batched surface from where it stands, on
  // whichever axis its face is turned to, puts one scale over all of it; after
  // this a texture's `repeat` means the size of the stone, and nothing else.
  const uvWorld = (geo, at = null) => {
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    if (!pos || !nor) return geo;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (at ? at[0] : 0), y = pos.getY(i), z = pos.getZ(i) + (at ? at[1] : 0);
      const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; }
      else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; }
      else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
  };
  const rodGeo = (a, b, r) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
    const mid = va.add(vb).multiplyScalar(0.5);
    g.translate(mid.x, mid.y, mid.z);
    return g;
  };
  const flatPlane = () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return keep(g); };
  // Stone walked smooth, as a strip laid along a line on a floor or a stair
  // (M.wornFloor / M.wornStep): `uv` is the world's x and z, so the stone's
  // joints run on through it; `uv1` is across the strip (0-1) and along it.
  // (`run0`, `moveBy`: a length of another ribbon, picked up and laid down
  // `moveBy` off, worn exactly as it was where it came from)
  const wornRibbon = (pts, width, y, { run0 = 0, moveBy = [0, 0] } = {}) => {
    const pos = [], uvw = [], uv1 = [], idx = [];
    let run = run0;
    pts.forEach((p, i) => {
      const t = unit2(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]), n = [-t[1], t[0]];
      if (i) run += dist(pts[i - 1], p);
      for (const side of [-1, 1]) {
        const q = add(p, n, (side * width) / 2);
        pos.push(q[0] + moveBy[0], y, q[1] + moveBy[1]);
        uvw.push(q[0], q[1]);
        uv1.push(side < 0 ? 0 : 1, run / 24);
      }
      if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvw, 2));
    g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
    g.setIndex(idx);
    return g;
  };
  // A rectangle lying flat, `len` along bearing `ang` and `wid` across it.
  const flatQuad = (centre, ang, len, wid, y) => {
    const a = dir(ang);
    return wornRibbon([add(centre, a, -len / 2), add(centre, a, len / 2)], wid, y);
  };
  // A rail from p to q at height y: round, or `squash`ed into an oval.
  const barGeo = (p, q, y, r, squash = 1) => {
    const g = new THREE.CylinderGeometry(r, r, dist(p, q), 18, 1, false);
    g.rotateZ(Math.PI / 2);
    g.scale(1, squash, 1);
    g.rotateY(-Math.atan2(q[1] - p[1], q[0] - p[0]));
    g.translate((p[0] + q[0]) / 2, y, (p[1] + q[1]) / 2);
    return g;
  };
  // `chunked`: one instanced mesh per patch of ground (see Batch), for anything
  // that never moves. Things that drift keep one mesh, whose matrices tick moves.
  // A weathered stone: a subdivided sphere pushed in and out by a smooth
  // function of direction (so shared vertices move together and the faces stay
  // closed), flattened a little, as stones settle. Twelve flat facets was a die.
  // A block of a wall as it came down: dressed on five faces and broken on the
  // sixth, the one it tore away from the course it was bedded in.
  const brokenBlock = (w, h, d, rng) => {
    const g = new THREE.BoxGeometry(w, h, d, 6, 4, 4);
    const p = g.attributes.position, ph = [rng() * 6, rng() * 6, rng() * 6];
    for (let i = 0; i < p.count; i++) {
      if (p.getX(i) < w / 2 - 1e-3) continue;
      const y = p.getY(i), z = p.getZ(i);
      const f = 0.55 + 0.45 * Math.sin(y * 1.7 + ph[0]) * Math.sin(z * 2.1 + ph[1]) + 0.22 * Math.sin(y * 4.3 + z * 3.7 + ph[2]);
      p.setX(i, w / 2 - w * 0.24 * Math.max(0, f));
    }
    g.computeVertexNormals();
    return g;
  };
  // A fragment of dressed stone: angular, flat-faced, not a pebble.
  const chunkGeo = () => {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * 1.15, p.getY(i) * 0.62, p.getZ(i) * 0.9);
    g.computeVertexNormals();
    return g;
  };
  // A garden stone: worn round, wider than it is tall, and green where rain
  // and the dark sit on it. (The garden's stones were rockGeo, faceted and
  // flat-shaded: from the Fork they read as black chips cut out of the frame.)
  const stoneGeo = () => {
    const g = new THREE.IcosahedronGeometry(1, light ? 2 : 3);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    const m = mergeVertices(g);
    g.dispose();
    const p = m.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const bump = 1 + 0.16 * Math.sin(v.x * 2.6 + 1.3) * Math.sin(v.y * 2.2 + 0.4) * Math.sin(v.z * 2.9 + 2.1) + 0.05 * Math.sin(v.x * 6.1 + v.z * 4.7);
      v.multiplyScalar(bump);
      v.y *= 0.62;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    m.computeVertexNormals();
    const n = m.attributes.normal, col = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2);
    const moss = [0.5, 0.62, 0.36];
    for (let i = 0; i < p.count; i++) {
      const t = Math.min(1, Math.max(0, (n.getY(i) - 0.45) / 0.4)) * (0.7 + 0.3 * Math.sin(p.getX(i) * 9.1 + p.getZ(i) * 7.3));
      col.set([1 + (moss[0] - 1) * t, 1 + (moss[1] - 1) * t, 1 + (moss[2] - 1) * t], i * 3);
      uv.set([p.getX(i) * 0.5 + 0.5, p.getZ(i) * 0.5 + 0.5], i * 2);
    }
    m.setAttribute('color', new THREE.BufferAttribute(col, 3));
    m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return m;
  };
  const rockGeo = () => {
    const g = new THREE.IcosahedronGeometry(1, light ? 1 : 2);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const bump = 1
        + 0.22 * Math.sin(v.x * 3.1 + 1.3) * Math.sin(v.y * 2.7 + 0.4) * Math.sin(v.z * 3.3 + 2.1)
        + 0.09 * Math.sin(v.x * 7.9 + v.z * 5.3) + 0.05 * Math.sin(v.y * 11.7 - v.x * 9.1);
      v.multiplyScalar(bump);
      v.y *= 0.78;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  };

  // `attrs`: per-instance attributes, { name: (item) => number | number[] }.
  // `depth`: the material the shadow map draws them with, if not three's own.
  // `prepass`: a material to lay their depth with first, in a mesh of its own
  // drawn ahead of everything (see makeFoliagePrepass).
  // `group`: what an item is drawn with instead of its patch of ground (each
  // group a mesh of its own, culled on its own); `name` names the meshes.
  const instances = (geo, mat, items, { cast = true, receive = true, chunked = false, attrs = null, depth = null, prepass = null, group: groupOf = null, name = '', to = root } = {}) => {
    if (!items.length) return null;
    keep(geo);
    const groups = new Map();
    for (const it of items) {
      const k = groupOf ? groupOf(it) : chunked ? chunkKey(it.p[0], it.p[2]) : 'all';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), c = new THREE.Color();
    let first = null;
    for (const group of groups.values()) {
      // an instanced attribute lives on the geometry, so each group needs its own
      const g = attrs && groups.size > 1 ? keep(geo.clone()) : geo;
      if (attrs) {
        for (const [name, of] of Object.entries(attrs)) {
          const head = of(group[0]), size = Array.isArray(head) ? head.length : 1;
          g.setAttribute(name, new THREE.InstancedBufferAttribute(Float32Array.from(size > 1 ? group.flatMap(of) : group.map(of)), size));
        }
      }
      const inst = new THREE.InstancedMesh(g, mat, group.length);
      group.forEach((it, i) => {
        qt.setFromEuler(new THREE.Euler(...(it.rot ?? [0, 0, 0])));
        m4.compose(new THREE.Vector3(...it.p), qt, new THREE.Vector3(...(it.s ?? [1, 1, 1])));
        inst.setMatrixAt(i, m4);
        inst.setColorAt(i, c.set(it.color ?? '#ffffff').multiplyScalar(it.k ?? 1));
      });
      inst.castShadow = cast;
      inst.receiveShadow = receive;
      inst.name = name;
      inst.userData.group = groupOf ? groupOf(group[0]) : undefined;
      if (depth) inst.customDepthMaterial = depth;
      inst.computeBoundingSphere();
      to.add(inst);
      if (prepass) {
        const pre = new THREE.InstancedMesh(g, prepass, group.length);
        pre.instanceMatrix = inst.instanceMatrix;
        pre.castShadow = false;
        pre.receiveShadow = false;
        pre.renderOrder = -1;
        pre.computeBoundingSphere();
        to.add(pre);
      }
      first ??= inst;
    }
    return first;
  };
  const pools = [];
  // A pool of lamplight is light coming back off a floor, and over a well
  // there is no floor: a pool laid flat across the shaft hung in the air over
  // it as a pale sheet, the well's dark gone. Floor-level pools are cut away
  // over every well and over the Vertigo's pit (`wells`, filled once the rooms
  // are laid out: x, z, flat radius, and 1 for a hexagon or 0 for a circle).
  const wells = { value: [new THREE.Vector4(0, 0, 0, 0)] };
  const offWells = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWells = wells;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec2 vPoolXZ;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vPoolXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec4 uWells[${wells.value.length}];
          varying vec2 vPoolXZ;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          for (int i = 0; i < ${wells.value.length}; i++) {
            vec2 d = vPoolXZ - uWells[i].xy;
            float hex = max(abs(d.y), max(abs(dot(d, vec2(0.8660254, 0.5))), abs(dot(d, vec2(-0.8660254, 0.5)))));
            float r = mix(length(d), hex, uWells[i].w);
            diffuseColor.a *= smoothstep(uWells[i].z - 0.5, uWells[i].z + 1.5, r);
          }`);
    };
    mat.customProgramCacheKey = () => `babel-pool-${wells.value.length}`;
    return mat;
  };
  // `src`: the light a pool comes from ([x, y, z, its globe's radius]), for its shadows
  const decal = ([x, z], sx, sz, color, opacity, y = 6.6, flicker = 0, src = null) => {
    // A pool on a Library floor goes into the floor's own light (lampPass.js;
    // the draw its breathing took is still taken)
    if (LAMPS.pool && y > 5.9 && y < 6.7) {
      floorPools.push({ x, z, sx, sz, c: new THREE.Color(color), o: opacity, src });
      if (flicker) rr(0, 100);
      return null;
    }
    const mat = keep(new THREE.MeshBasicMaterial({
      map: radialTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    if (y > 5 && y < 7) offWells(mat);   // (not the light hung in layers down the Vertigo)
    const m = new THREE.Mesh(flatPlane(), mat);
    m.scale.set(sx, 1, sz);
    m.position.set(x, y, z);
    // Under the water, not over it (see the Pavilion): a pool of lamplight is
    // light coming back off the GROUND, and where the ground is a pond the
    // surface stands between the two.
    m.renderOrder = 1;
    root.add(m);
    if (flicker) pools.push({ mat, base: opacity, phase: rr(0, 100), amount: flicker });
    return m;
  };
  // The halo round a lamp, always facing the eye.
  const haloMaterial = (color, opacity, map = glowTex) => keep(new THREE.SpriteMaterial({
    map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false,
  }));
  const halos = [];
  const halo = ([x, z], y, size, color, opacity, map) => {
    const mat = haloMaterial(color, opacity, map);
    const s = new THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    s.position.set(x, y, z);
    s.renderOrder = 4;
    root.add(s);
    // a hanging lamp's (see HALO_REACH): the only halos big enough to fill a room
    halos.push({ mat, base: opacity, phase: rr(0, 100), sprite: s, size, lamp: map === lampHaloTex, seen: 1, seenTo: 1 });
  };
  const lightWishes = [];
  // The lamps' light, softened 2026-10-01, when the reader found the piece
  // "almost aggressively lit". It fell off at an inverse square from a hot
  // core, so whatever stood near a lamp — the court's paving under the
  // armillary, the waymark beside its lantern, the Pavilion's floor and
  // columns — was floodlit while the rest of the frame went black: stage
  // light, not lamplight. Now it falls away more gently, the lamps put 60% of
  // the light they did on what they light (the lamps themselves, their globes
  // and halos, burn as bright as ever), the warm pools painted under them are
  // a little over half as strong, and the fill comes up to meet them
  // (World.jsx). The middle of the frame holds its brightness; the top 1%
  // came down by 0.1-0.15.
  //
  // A lamp is rescaled so that it lights a wall DECAY_AT away exactly as it
  // did at an inverse square; only nearer than that does the softer fall-off
  // soften it, and further off it carries. ?wlight=old puts the hard light
  // back; ?wdecay, ?wlamp and ?wpool dial each part of it.
  const Q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const qNum = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);
  const HARD_LIGHT = Q.get('wlight') === 'old';
  const LAMP_DECAY = qNum('wdecay', HARD_LIGHT ? 2 : 1.5), DECAY_AT = 32;
  const LAMP_DIAL = qNum('wlamp', HARD_LIGHT ? 1 : 0.6), POOL_DIAL = qNum('wpool', HARD_LIGHT ? 1 : 0.55);
  // (And since 2026-10-05 a lamp is a globe, not a point — lightModel.js — so
  // it is given back what the softer near field takes from it at DECAY_AT.)
  // `column` [x, z, radius]: whoever stands inside it keeps this light, however far off.
  const point = ([x, z], y, color, intensity, priority, decay = null, column = null) => {
    lightWishes.push({
      x, y, z, color, priority, column,
      // (a light that names its own fall-off keeps it, and its power: the one
      // at the bottom of the Vertigo is meant to be the brightest thing there)
      intensity: decay === null ? LAMP_DIAL * intensity * DECAY_AT ** (LAMP_DECAY - 2) * softGain(LAMP_DECAY, DECAY_AT) : intensity,
      decay: decay ?? LAMP_DECAY,
    });
  };

  yield 'The honeycomb';
  // ── The honeycomb ─────────────────────────────────────────────────────────
  const R = 100, A = R * Math.sqrt(3) / 2, GAP = 50, D = 2 * A + GAP, AC = D / 2, RC = AC * 2 / Math.sqrt(3);
  const HALL = 36;
  const ARCH_SPRING = 58, ARCH_R = HALL / 2; // hallways are arched, apex at 76
  const O = [232, 785];
  const E0 = [D * Math.cos(30 * deg), D * Math.sin(30 * deg)], E1 = [0, D];
  // The way in — the hallway out of the back of the Vestibule — and the one it
  // is dressed as and opens as (doorway.js): two hallways along the honeycomb,
  // between the Silence and the Echo. `by` takes the one to the other.
  const WAY_IN = { from: '0,0', to: '-1,1', by: [2 * (E0[0] - E1[0]), 2 * (E0[1] - E1[1])] };
  const cellC = (i, j) => [O[0] + i * E0[0] + j * E1[0], O[1] + i * E0[1] + j * E1[1]];
  // The Echo is wider than the other galleries. With its colonnade out at 62
  // (clear of the stair coping) the aisle between a column's plinth and the
  // bookcases was under a metre, and the reader squeezed past every pier.
  // Growing R for every room moves every cell and the garden with them (see
  // the honeycomb's spacing above), so only this room grows, into its own
  // walls: they stand 25 deep on each side of a hallway, and the Echo takes
  // ten of its twenty-five. Every cell stays where it was, and so does every
  // other room; the hallways into the Echo are shorter by what it took.
  // ?wechoroom=old is the Echo at 100 again; ?wechor dials it.
  const ECHO_R = qNum('wechor', Q.get('wechoroom') === 'old' ? R : 112), ECHO_A = (ECHO_R * Math.sqrt(3)) / 2;
  const ECHO_C = cellC(1, -1);
  // a room's rim, centre to corner, and how much nearer the cell's edge its
  // walls stand than a standard room's (what its hallways lose at its end)
  const rimAt = (c) => (dist(c, ECHO_C) < 1 ? ECHO_R : R);
  const deepAt = (c) => ((rimAt(c) - R) * Math.sqrt(3)) / 2;
  const key = (i, j) => `${i},${j}`;
  const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const ROUTE = { '0,0': 0, '1,-1': 1, '2,-2': 2, '3,-3': 3, '4,-4': 4 };
  const GARDEN = new Set();
  for (let i = 3; i <= 16; i++) {
    for (let j = -20; j <= -2; j++) {
      const [x, y] = cellC(i, j);
      if (y < (x - 720) * 0.889 + 20) GARDEN.add(key(i, j));
    }
  }
  GARDEN.add('5,-4');
  ['4,-4', '3,-3', '3,-4'].forEach((k) => GARDEN.delete(k));
  const cells = [];
  for (let i = -7; i <= 16; i++) {
    for (let j = -20; j <= 12; j++) {
      const c = cellC(i, j);
      if (c[0] < -620 || c[0] > 2100 || c[1] < -1000 || c[1] > 1400) continue;
      cells.push({ i, j, c, k: key(i, j), garden: GARDEN.has(key(i, j)), room: ROUTE[key(i, j)] });
    }
  }
  // (x, z, how much warm floor-light the room's stone soffits take back)
  bounceRooms.value = [[0, 0, 1], [1, -1, 0.8], [2, -2, 0.25], [3, -3, 0.5], [4, -4, 0.7]]
    .map(([i, j, k]) => { const q = cellC(i, j); return new THREE.Vector3(q[0], q[1], k); });
  // the wells of the three rooms that have one (hexagons: the flat radius of
  // `shaft` below), and the Vertigo's round pit
  wells.value = [[0, 0, 48, 1], [1, -1, 38, 1], [2, -2, 40, 1], [3, -3, 68, 0]]
    .map(([i, j, r, hex]) => { const q = cellC(i, j); return new THREE.Vector4(q[0], q[1], hex ? r * Math.sqrt(3) / 2 : r, hex); });
  const inFrame = (p) => p[0] > -160 && p[0] < 1600 && p[1] > -260 && p[1] < 1080;
  const isGardenAt = (i, j) => GARDEN.has(key(i, j));
  const nearestCell = (p) => cells.reduce((best, c) => (dist(c.c, p) < dist(best.c, p) ? c : best), cells[0]);
  const inGarden = (p) => nearestCell(p).garden;
  const routeCenters = Object.keys(ROUTE).map((k) => cellC(...k.split(',').map(Number)));
  const routeDist = (p) => Math.min(...routeCenters.map((c) => dist(c, p)));
  const hallway = (cell, k) => {
    if (cell.garden || (k !== 2 && k !== 5)) return false;
    if (isGardenAt(cell.i + NB[k][0], cell.j + NB[k][1])) return false;
    if (cell.k === '3,-3' && k === 5) return false;
    if (cell.k === '4,-4') return false;
    return true;
  };
  const edgeFrame = (c, k) => {
    const r = rimAt(c);
    const n = dir(60 * k + 30);
    const i0 = add(c, dir(60 * k), r), i1 = add(c, dir(60 * k + 60), r);
    const t = [(i1[0] - i0[0]) / r, (i1[1] - i0[1]) / r];
    return { n, t, i0, i1, mi: add(c, n, (r * Math.sqrt(3)) / 2) };
  };
  const hallMid = (i, j, k) => add(cellC(i, j), dir(60 * k + 30), AC);

  // ── Stone balustrades ──
  // What a stone bridge carries over the dark: a plinth, turned stone
  // balusters, a moulded handrail, and a pedestal wherever the run starts,
  // stops or is met by another. The Vestibule's bridge had two bronze pipes
  // on round posts and the flights a thin rod over metal spindles — a ship's
  // rail and an office stair's, in rooms of ashlar, Doric columns and walnut.
  // It all goes in the stone of the coping it stands on, in batches of its
  // own: `balustrade` is not one of body.js's STAIRS, so no tall step is ever
  // taken up onto it, as none was onto the bronze. ?wrail=old is the bronze.
  const RAIL_OLD = Q.get('wrail') === 'old';
  // The Vestibule's bridge level with the floor, the well's rail run round it
  // (vestibuleBridge.js, 2026-10-06). ?wbridge=old: the raised bridge with the
  // stone balustrade above, ?wrail=old the bronze before that.
  const BRIDGE_LEVEL = !RAIL_OLD && Q.get('wbridge') !== 'old';
  // The Echo's flights without their string course, flank and arch one face
  // (?wline=old: the string), and its well ringed by a low stone kerb rather
  // than the bronze rail every other well has (?wwell=old: the bronze).
  const ECHO_ONE_FACE = Q.get('wline') !== 'old';
  const ECHO_KERB = Q.get('wwell') !== 'old';
  // A moulding run along a line. `sec` is its section, [across, up, sharp]
  // round the outline, set off each point of `path` ([x, y, z]) across the
  // line in plan and straight up: on a rake the section stays plumb, as a
  // stair's stone handrail is cut, and where the line turns in plan the run
  // is mitred. Both ends are closed.
  const mouldGeo = (path, sec) => {
    const seg = path.slice(1).map((p, i) => {
      const dx = p[0] - path[i][0], dz = p[2] - path[i][2], L = Math.hypot(dx, dz) || 1;
      return [-dz / L, dx / L];
    });
    const across = path.map((_, i) => {
      const a = seg[Math.max(0, i - 1)], b = seg[Math.min(seg.length - 1, i)];
      const m = [a[0] + b[0], a[1] + b[1]], L = Math.hypot(m[0], m[1]) || 1;
      const k = 1 / Math.max(0.5, (m[0] * b[0] + m[1] * b[1]) / L);
      return [(m[0] / L) * k, (m[1] / L) * k];
    });
    // the section's columns of vertices: a sharp corner is two, one for each
    // face it parts, so the arrises stay crisp and the curves stay round
    // (`p`, how far round the outline: the stone is laid along the moulding,
    // as it is cut, and round it)
    const cols = [], faces = [];
    let prev = -1, p = 0;
    sec.forEach(([z, y, sharp], j) => {
      if (j) p += Math.hypot(z - sec[j - 1][0], y - sec[j - 1][1]);
      const into = cols.push([z, y, p]) - 1, out = sharp ? cols.push([z, y, p]) - 1 : into;
      if (prev >= 0) faces.push([prev, into]);
      prev = out;
    });
    // (closed by a column of its own at the far end of the outline)
    faces.push([prev, cols.push([sec[0][0], sec[0][1], p + Math.hypot(sec[0][0] - sec[sec.length - 1][0], sec[0][1] - sec[sec.length - 1][1])]) - 1]);
    let area = 0;
    sec.forEach(([z, y], j) => { const [z2, y2] = sec[(j + 1) % sec.length]; area += z * y2 - z2 * y; });
    const C = cols.length, pos = [], uv = [], idx = [];
    let run = 0;
    path.forEach(([x, y, z], i) => {
      if (i) run += Math.hypot(x - path[i - 1][0], y - path[i - 1][1], z - path[i - 1][2]);
      for (const [cz, cy, cp] of cols) { pos.push(x + across[i][0] * cz, y + cy, z + across[i][1] * cz); uv.push(run * CARVE_UV, cp * CARVE_UV); }
    });
    for (let i = 0; i + 1 < path.length; i++) {
      for (const [sa, sb] of faces) {
        const a = i * C + sa, b = i * C + sb, c = (i + 1) * C + sb, d = (i + 1) * C + sa;
        if (area > 0) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d);
      }
    }
    const tris = THREE.ShapeUtils.triangulateShape(sec.map(([z, y]) => new THREE.Vector2(z, y)), []);
    for (const [back, i] of [[true, 0], [false, path.length - 1]]) {
      const o = pos.length / 3;
      for (const [z, y] of sec) { pos.push(path[i][0] + across[i][0] * z, path[i][1] + y, path[i][2] + across[i][1] * z); uv.push(z * CARVE_UV, y * CARVE_UV); }
      for (const t of tris) {
        const [p, q, r] = t.map((k) => sec[k]);
        // a triangle anticlockwise in (across, up) faces back down the line
        const anti = (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]) > 0;
        if (anti === back) idx.push(o + t[0], o + t[1], o + t[2]); else idx.push(o + t[0], o + t[2], o + t[1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // Carved stone is laid by projection where nothing says otherwise: at the
  // mouldings' scale, off whichever axis a face is turned to (as portal.js
  // lays the Door's arch). `shift` moves a piece about on the stone, so no
  // two are cut from the same patch of it.
  const CARVE_UV = 1 / 13;
  const carveUv = (geo, shift = [0, 0]) => {
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
      uv[i * 2] = u * CARVE_UV + shift[0];
      uv[i * 2 + 1] = v * CARVE_UV + shift[1];
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
  };
  // where on the stone a piece standing at [x, z] is cut from (not the
  // world's random stream: nothing built after this may move)
  const patchOf = ([x, z]) => [((x * 0.618 + z * 0.271) % 1 + 1) % 1, ((x * 0.137 - z * 0.553) % 1 + 1) % 1];
  // A section drawn as its right half, bottom to top, and mirrored; `half`
  // and `h` scale it from the unit it is drawn in (half-width 1, height h0).
  const section = (right, h0) => (half, h) => [...right, ...[...right].reverse().filter(([z]) => z > 1e-6).map(([z, y, s]) => [-z, y, s])]
    .map(([z, y, s]) => [z * half, (y * h) / h0, s]);
  // The handrail: a fillet on the balusters' heads, an ovolo swelling out
  // under a plain face, and a rounded back for the hand.
  const RAIL_SEC = section([
    [0.74, 0, true], [0.74, 0.12, true], [0.8, 0.17], [0.89, 0.27], [0.95, 0.4], [0.98, 0.52, true],
    [1, 0.56, true], [1, 0.94, true], [0.95, 1.07], [0.82, 1.19], [0.58, 1.28], [0.3, 1.33], [0, 1.35],
  ], 1.35);
  // The plinth: a plain block, and a small ogee stepping it in to the
  // balusters' feet.
  const BASE_SEC = section([
    [1, 0, true], [1, 0.8, true], [0.97, 0.86], [0.9, 0.95], [0.82, 1.02, true], [0.78, 1.02, true], [0.78, 1.25, true],
  ], 1.25);
  // A turned stone baluster, plumb: a square plinth, a torus over a scotia,
  // the belly low, a long neck and a ring, and an echinus flaring to a square
  // abacus. [radius / r, height up the turned part]
  const BAL = [
    [0.92, 0], [0.99, 0.035], [0.7, 0.085], [0.72, 0.12], [0.92, 0.19], [1, 0.28], [0.93, 0.4], [0.7, 0.52],
    [0.48, 0.63], [0.45, 0.69], [0.58, 0.715], [0.58, 0.765], [0.46, 0.79], [0.62, 0.885], [0.86, 0.965], [0.9, 1],
  ];
  // Both square blocks are sunk BED into what they stand on and carry: plumb
  // under a raking rail, a level block stands proud of it at one corner.
  const BED = 0.3;
  const balusterCache = new Map();
  const balusterGeo = (h, r, shift) => {
    const key = `${h.toFixed(2)}:${r}`;
    if (!balusterCache.has(key)) {
      const blk = BED + 0.34, L = h - 2 * blk, sq = 2.04 * r;
      // the turned part laid round it and up it, as it turns on the lathe
      const turned = new THREE.LatheGeometry(BAL.map(([x, t]) => new THREE.Vector2(x * r, blk + t * L)), light ? 7 : 10);
      const tp = turned.attributes.position, tuv = turned.attributes.uv;
      for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) * 2 * Math.PI * r * CARVE_UV, tp.getY(i) * CARVE_UV);
      const parts = [
        carveUv(new THREE.BoxGeometry(sq, blk, sq).translate(0, blk / 2, 0)),
        turned,
        carveUv(new THREE.BoxGeometry(sq, blk, sq).translate(0, h - blk / 2, 0)),
      ];
      balusterCache.set(key, mergeGeometries(parts));
      parts.forEach((g) => g.dispose());
    }
    const g = balusterCache.get(key).clone(), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + shift[0], uv.getY(i) + shift[1]);
    return g;
  };
  // A pedestal, from its foot: a base block as high as the plinth beside it
  // (and `sunk` below the foot, so a rake or a string under it never shows
  // daylight), a die with a raised panel on each face, and a cornice — capped
  // with a low weathering, or with a ball where a bridge ends.
  const pedestalGeo = (w, base, die, { ball = false, sunk = 0.5, shift = [0, 0] } = {}) => {
    // (each block let a hair down into the one under it: two faces on one
    // plane, in a stone drawn from both sides, flicker as a dashed line
    // along every joint)
    const LAP = 0.03;
    const box = (x, h, y0) => new THREE.BoxGeometry(x, h + LAP, x).translate(0, y0 + (h - LAP) / 2, 0);
    const parts = [
      box(w + 0.3, base + sunk, -sunk), box(w + 0.16, 0.28, base), box(w, die - base - 0.28, base + 0.28),
      box(w + 0.22, 0.3, die), box(w + 0.56, 0.55, die + 0.3), box(w + 0.3, 0.2, die + 0.85),
    ];
    const ph = die - base - 1.4;
    if (ph > 1) {
      for (let k = 0; k < 4; k++) {
        parts.push(new THREE.BoxGeometry(w - 0.8, ph, 0.16).translate(0, base + 0.84 + ph / 2, w / 2).rotateY((k * Math.PI) / 2));
      }
    }
    if (ball) {
      const r = w * 0.32;
      parts.push(box(w * 0.62, 0.3, die + 1.05),
        new THREE.CylinderGeometry(r * 0.42, r * 0.72, 0.42, 14).translate(0, die + 1.56 - LAP, 0),
        new THREE.SphereGeometry(r, 18, 12).translate(0, die + 1.62 + r * 0.92, 0));
    } else {
      const rr = (w + 0.3) / Math.SQRT2;
      // (four flat faces: as a smooth cone the weathering read as a dome)
      const cap = new THREE.CylinderGeometry(rr * 0.3, rr, 0.38, 4, 1).rotateY(Math.PI / 4).translate(0, die + 1.24 - LAP, 0).toNonIndexed();
      cap.computeVertexNormals();
      parts.push(cap);
    }
    const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
    const g = carveUv(mergeGeometries(flat), shift);
    parts.forEach((p) => p.dispose());
    flat.forEach((p) => p.dispose());
    return g;
  };
  // The two sizes: the Vestibule's bridge, and the flights' (and the Silence's
  // terrace, which is the flights' dressing bent round).
  //   railH/baseH  the handrail's and the plinth's heights; `sink` how far the
  //                plinth is let into what it stands on
  //   r, step      a baluster's belly, and how far apart they stand (the
  //                flights': three to a tread)
  const VEST_RAIL = { rail: RAIL_SEC(1, 1.4), railH: 1.4, base: BASE_SEC(1, 1.5), baseH: 1.5, sink: 0.3, r: 0.78, step: 2.6, ped: 2.6 };
  const FLIGHT_RAIL = { rail: RAIL_SEC(0.9, 1.25), railH: 1.25, base: BASE_SEC(0.7, 0.85), baseH: 0.85, sink: 0.25, r: 0.68, step: 7 / 3, ped: 2.1 };
  // A run of balustrade from one end to the other (pedestal centres, or any
  // ends it dies into): its plinth along `foot`, its handrail with its top at
  // `top`, balusters between. `at(s)` is [x, z] at s along it, `knots` every s
  // where a line bends (the two ends among them), `clear` how far in from
  // each end the balusters begin, `ry(s)` the turn of their square blocks.
  const stoneRail = (batch, { at, foot, top, knots, clear = [0, 0], ry, S }) => {
    const line = (y) => knots.map((s) => { const p = at(s); return [p[0], y(s), p[1]]; });
    batch.add(mouldGeo(line((s) => foot(s) - S.sink), S.base));
    batch.add(mouldGeo(line((s) => top(s) - S.railH), S.rail));
    const a = knots[0] + clear[0], b = knots[knots.length - 1] - clear[1];
    const n = Math.max(1, Math.round((b - a) / S.step));
    for (let k = 0; k < n; k++) {
      const s = a + ((k + 0.5) * (b - a)) / n;
      const y0 = foot(s) - S.sink + S.baseH - BED, y1 = top(s) - S.railH + BED;
      if (y1 - y0 < 2 + 2 * BED) continue;
      batch.add(placed(balusterGeo(Math.round((y1 - y0) * 20) / 20, S.r, patchOf(at(s))), at(s), y0, ry(s)));
    }
  };

  // A flight of steps as one piece of stone: stepped along the top, arched
  // underneath, and — with `from`/`to` inside [0, steps] — able to stop in mid
  // air, sheared off over the well with the arch broken away under it.
  const flightProfile = ({
    steps = 18, run = 8, lift = 2.4, base = 8, tread = 3, span = (steps * run) / 2,
    from = 0, to = steps, spring = 47, arch = 21, ground = 3,
  }) => {
    const stepTop = (k) => base + (k < steps / 2 ? k : steps - 1 - k) * lift + tread;
    // the top of whichever tread is at u
    const stepAt = (u) => stepTop(Math.max(from, Math.min(to - 1, Math.floor((u + span) / run))));
    const soffit = (t) => { const r = Math.abs(t) / spring; return ground + (r < 1 ? arch * (1 - r * r) ** 0.62 : 0); };
    // The pitch line: the straight rake through the nosings, up one side and
    // down the other, level over the two middle treads. Everything the flight
    // wears — its string course, its arch ring, the height of its handrail —
    // is set off this one line, so none of it can drift out of step with the
    // stone. (The stepped top is where a tread IS; the pitch line is where the
    // eye reads the stair going.)
    const pitch = (u) => base + tread + lift * Math.min((u + span) / run, (span - u) / run, (steps - 2) / 2);
    // where it levels off, either side of the crown
    const crown = span - (run * (steps - 2)) / 2;
    const u0 = -span + from * run, u1 = -span + to * run;
    const top = [];
    for (let k = from; k < to; k++) {
      const t0 = -span + k * run;
      top.push([t0, stepTop(k)], [t0 + run, stepTop(k)]);
    }
    const under = [];
    for (let n = 24; n >= 0; n--) {
      const t = u0 + (n / 24) * (u1 - u0);
      under.push([t, soffit(t)]);
    }
    return {
      pts: [...top, ...under], top, u0, u1, soffit, pitch, stepTop, stepAt, crown,
      dims: { steps, run, span, spring, from, to },
    };
  };

  yield 'The dressing on a flight';
  // ── The dressing on a flight ──────────────────────────────────────────────
  // A stepped block with a hole under it is not a bridge yet. This is what
  // makes it one. Almost none of it is written out in numbers of its own:
  // every line is asked of the profile the stone is cut from
  // (`flightProfile`), so a flight that is ever re-cut carries its ornament
  // with it.
  //
  //   nosings      a moulded lip over every riser. Without them a stair is a
  //                stack of blocks, and this is the part the reader climbs
  //                past at arm's length.
  //   the ring     the arch drawn as the voussoirs it would be built of: proud
  //                of both flanks AND carried on across the soffit, so the
  //                underside is coursed too instead of being one dark sheet,
  //                with a keystone at the crown.
  //   abutments    beyond the springing the flank comes down to the floor, and
  //                that is the only stone in the span standing on anything —
  //                so it is the part that should look like it. Coursed ashlar
  //                on a projecting plinth, joints broken course over course.
  //   the string   a band and a corona over it, riding just under the deck
  //                line from end to end. It is the line that hands the eye
  //                the whole span at once, and what the keystone breaks up
  //                through.
  //   balustrade   turned balusters on the coping, between newels, over the
  //                arch and no further — and BROKEN again at the crossing,
  //                where the other flight's deck arrives and a reader can
  //                step across. Both of those are measured, not chosen; the
  //                notes are where they are decided.
  // (`nosing`, `riser`: where the lips and the risers' shade go, when not
  // `stone` and LB.riserShade; `string`: a wall string up the inside of both
  // flanks — the Echo's, echoFix.js point 2)
  const flightDress = (c, ang, f, halfW, { gap = null, ends = [true, true], stone = LB.cap, worn = true, keyThrough = true, cross = null, gapNewels = true, plane = false, face = stone, nosing = stone, riser = LB.riserShade, string = false } = {}) => {
    const { run, span, spring, steps, from, to } = f.dims;
    const { u0, u1, soffit, pitch, stepTop, stepAt, crown } = f;
    const ax = dir(ang), px = dir(ang + 90);
    const spot = (u, z) => add(add(c, ax, u), px, z);
    // A flight sheared off in mid air (the Silence) has no pitch line left
    // where it was cut, so the parapet would stand on past the broken deck in
    // the air. `shorn` holds it down to the stone that is really there.
    const shorn = Math.min(from > 0 ? stepTop(from) + 0.6 : Infinity,
      to < steps ? stepTop(to - 1) + 0.6 : Infinity);
    const deck = (u) => Math.min(pitch(u), shorn);
    // Everything on the flank is set off the deck line and RAKES with it —
    // the parapet, its coping, the string under it, the top of the arch ring.
    // Stepping the kerb with the treads instead (which is how this was built)
    // leaves a sawtooth of bare stone between it and every raking member, and
    // the foot of the stair came out looking like a slipped wall.
    //
    // The pitch line kinks over the crown, so a member drawn from end to end
    // has to be given those corners or it cuts across the top of the flight.
    const kinks = [-crown, crown].filter((u) => u > u0 + 1e-6 && u < u1 - 1e-6);
    const rake = (dy, a = u0, b = u1) => [a, ...kinks.filter((k) => k > a + 1e-6 && k < b - 1e-6), b]
      .map((u) => [u, deck(u) + dy]);
    const bandPts = (lo, hi, a, b) => [...rake(hi, a, b), ...rake(lo, a, b).reverse()];
    // Over the crossing the parapet comes DOWN. The other flight's deck
    // arrives there, and a kerb standing across it is a kerb across the way
    // off — from the crown the landing was a lattice of four little walls with
    // the reader penned in the middle of it. Only the stone above the deck
    // goes; what is under it belongs to the arch and stays.
    // `gap` is one span for both flanks, or a function of the flank (-1, 1)
    // where the two differ — two flights meeting at a landing at 60 degrees
    // bury the inner flank in each other three times as far as the outer one.
    // A span may run off either end of the flight; it is clipped to it.
    const HIGH = 1.6, FLUSH = -0.45;
    // ── where another flight crosses this one ──
    // `cross` is a flight crossing this one at its middle, the same width
    // (the Echo's two): { c, ang, f, half }, `half` the half-width of its
    // treads. Each flight's flank ran straight on through the other, and the
    // flank is set off the PITCH line, which rakes through the nosings and so
    // stands a whole riser over the back of every tread. Under the crown that
    // is buried; one tread down it is not. The parapet "flush" with the pitch
    // line, the string and corona, the keystone all stood up out of the other
    // flight's lower treads as slabs and sloping kerbs lying across its stair,
    // up to three units proud ("this weird shape", 2026-10-06). So, crossed:
    //   - no member of the flank stands higher than the other flight's tread
    //     where it passes under it (`crossTop`, `roof`, `cutTo`);
    //   - over the crossing the flank comes down to its own TREADS, not to the
    //     pitch line, so the landing is stone flush to the outer face;
    //   - the parapet opens only where the other's deck really comes in, a
    //     different stretch on each flank, and the two balustrades meet at a
    //     newel at each of the four corners (the old one span for both left
    //     each flank open over the well for ten units past the other flight).
    // ?wcross=old is the crossing as it was.
    const crossTop = (p) => {
      if (!cross) return Infinity;
      const a = dir(cross.ang), n = dir(cross.ang + 90), d = [p[0] - cross.c[0], p[1] - cross.c[1]];
      const u = d[0] * a[0] + d[1] * a[1], z = d[0] * n[0] + d[1] * n[1];
      return Math.abs(z) > cross.half || u < cross.f.u0 || u > cross.f.u1 ? Infinity : cross.f.stepAt(u);
    };
    // The highest a member lying from z0 to z1 off the axis may stand at u:
    // a hair under any tread of the other flight over it, and over the gap
    // `g`, a hair under this flight's own.
    const roof = (z0, z1, g = null) => (u) => {
      let y = g && u > g[0] && u < g[1] ? stepAt(u) - 0.03 : Infinity;
      const n = Math.max(1, Math.ceil(Math.abs(z1 - z0) / 0.4));
      for (let i = 0; i <= n; i++) y = Math.min(y, crossTop(spot(u, z0 + ((z1 - z0) * i) / n)) - 0.08);
      return y;
    };
    const lineAt = (line, u) => {
      for (let i = 1; i < line.length; i++) {
        const [ua, ya] = line[i - 1], [ub, yb] = line[i];
        if (ub > ua && u >= ua && u <= ub) return ya + ((yb - ya) * (u - ua)) / (ub - ua);
      }
      return u < line[0][0] ? line[0][1] : line[line.length - 1][1];
    };
    // A profile, `top` over `bot` (both running up u), cut down to `lim`: the
    // pieces of it left standing. Where nothing cuts it, it is the profile it
    // was, point for point.
    const cutTo = (top, bot, lim) => {
      const whole = [[...top, ...[...bot].reverse()]];
      if (!cross) return whole;
      const a = top[0][0], b = top[top.length - 1][0];
      const us = [a, b];
      for (let u = a; u < b; u += 0.25) us.push(u);
      for (const [u] of [...top, ...bot]) us.push(u - 1e-3, u, u + 1e-3);
      // (the risers, either side: a tread's edge is a step, not a slope)
      for (let k = from; k <= to; k++) { const e = -span + k * run; us.push(e - 1e-3, e + 1e-3); }
      const U = [...new Set(us)].filter((u) => u >= a && u <= b).sort((p, q) => p - q);
      if (U.every((u) => lim(u) >= lineAt(top, u))) return whole;
      const pieces = [];
      let cur = [];
      for (const u of U) {
        const lo = lineAt(bot, u), hi = Math.min(lineAt(top, u), lim(u));
        if (hi > lo + 0.02) cur.push([u, hi, lo]);
        else if (cur.length) { pieces.push(cur); cur = []; }
      }
      if (cur.length) pieces.push(cur);
      // A point in a straight run says nothing, so it goes — but straight
      // measured from the last point KEPT, not from its neighbours. Sampled a
      // thousandth apart, every point of a curve lies "in line" with the two
      // either side of it, and tested that way the whole soffit went, point
      // by point, and its two ends were joined by a chord: the arch's backing
      // course and the flank over it hung down across the opening under both
      // flights as one flat wall, from the crossing nearly to the floor ("the
      // two bridge parts do not mesh together", 2026-10-06). A point goes
      // only if every point dropped since the last one kept still lies within
      // a hundredth of the line that stands for them.
      const lean = (line) => {
        const out = [line[0]];
        let k = 0;
        for (let i = 1; i < line.length - 1; i++) {
          const [ua, ya] = line[k], [ub, yb] = line[i + 1], L = Math.hypot(ub - ua, yb - ya) || 1;
          let off = 0;
          for (let j = k + 1; j <= i; j++) off = Math.max(off, Math.abs((yb - ya) * (line[j][0] - ua) - (line[j][1] - ya) * (ub - ua)) / L);
          if (off > 0.01) { out.push(line[i]); k = i; }
        }
        if (line.length > 1) out.push(line[line.length - 1]);
        return out;
      };
      return pieces.filter((r) => r.length > 1)
        .map((r) => [...lean(r.map(([u, hi]) => [u, hi])), ...lean(r.map(([u, , lo]) => [u, lo])).reverse()]);
    };
    const gapOf = (side) => {
      if (cross) {
        // from where this flank's rail meets one of the other flight's two
        // rails to where it meets the other (Z, the balustrade's line)
        const t = (cross.ang - ang) * deg, Z = halfW + 0.6;
        const a = (side * Z * Math.cos(t) - Z) / Math.sin(t), b = (side * Z * Math.cos(t) + Z) / Math.sin(t);
        return [Math.min(a, b), Math.max(a, b)];
      }
      return typeof gap === 'function' ? gap(side) : gap;
    };
    const parapetTop = (side) => {
      const out = [];
      const leg = (a, b, dy) => { if (b > a + 1e-6) out.push(...rake(dy, a, b)); };
      const g = gapOf(side);
      if (g && g[1] > u0 && g[0] < u1) {
        const a = Math.max(u0, g[0]), b = Math.min(u1, g[1]);
        leg(u0, a, HIGH);   // each leg ends and the next begins at the
        // same u: the doubled point is the step down (crossed, `roof` brings
        // it down to the treads)
        leg(a, b, cross ? HIGH : FLUSH);
        leg(b, u1, HIGH);
      } else leg(u0, u1, HIGH);
      return out;
    };
    // How far each member stands out past the flank the flight already has.
    // The order IS the hierarchy: courses recessed, the arch ring proud of
    // them, the string and the capping over the kerb proudest of all.
    const FACE = halfW + 0.8, COURSE = 0.3, RING = 0.78, BACK = 0.28, MOULD = 0.82, CORONA = 1.15;
    // (`face`: the stone of the flanks — kerb, ring, abutments, string,
    // coping — where `stone` is the nosings', which are walked on and so a
    // stair to body.js. The Echo's flanks are the flights' own stone: the
    // caps' ashlar, laid in world units, ran ONE bed joint dead level across
    // both flights at the same height, and with the darker block over it that
    // was the line that cut the bridge in two, 2026-10-07)
    const FLOOR_Y = 6;
    const band = (pts, z0, z1, side) => face.add(profileGeo(pts, z1 - z0, spot(0, (side * (z0 + z1)) / 2), ang));
    // a member right across the flight, from `top` down to `bot`: in two
    // halves where another flight crosses, because each flank passes under
    // the other's treads at a different place
    const across = (top, bot, w) => {
      if (!cross) { face.add(profileGeo(cutTo(top, bot, null)[0], 2 * w, c, ang)); return; }
      for (const side of [-1, 1]) {
        for (const pts of cutTo(top, bot, roof(0, side * w))) face.add(profileGeo(pts, w, spot(0, (side * w) / 2), ang));
      }
    };

    // ── the flank ──
    // The kerb the flight carries its ornament on: one raking parapet a side,
    // from the soffit up past the deck, closing the stone at both flanks.
    for (const side of [-1, 1]) {
      const lim = roof(side * (halfW - 0.8), side * (halfW + 0.8), gapOf(side));
      for (const pts of cutTo(parapetTop(side), f.pts.slice(f.top.length).reverse(), lim)) {
        face.add(profileGeo(pts, 1.6, spot(0, side * halfW), ang));
      }
    }

    // ── nosings ──
    // One over every riser, overhanging the step below it and chamfered under,
    // so the lip throws a line of shadow the length of the flight instead of
    // reading as another square edge.
    //
    // And a stair is read by its values, not its shape: the lip pale, the
    // riser under it dark, the tread between. Cut from the treads' own stone
    // and lit by lamps that cast no shadow, all three were one flat brown and
    // the flight was a stack of slabs. So the lip is the parapet's paler
    // stone, the riser is laid in the shadow the lip would throw, and each
    // tread is walked paler down its middle where feet have gone.
    const TREAD_W = 2 * (halfW - 0.8);
    for (let k = from; k <= to; k++) {
      const e = -span + k * run;
      const hi = k > from ? stepTop(k - 1) : -1e9, lo = k < to ? stepTop(k) : -1e9;
      if (Math.abs(hi - lo) < 0.01) continue;
      // which way the lip hangs: out over the lower of the two steps it divides
      const d = hi > lo ? 1 : -1, floor = Math.min(hi, lo);
      // (where a crossing flight's tread lies level with the lip, the lip
      // sinks a hair under it rather than fight it for the one plane)
      const level = cross && Array.from({ length: 9 }, (_, i) => crossTop(spot(e + d * 0.5, ((i - 4) / 4) * (TREAD_W / 2))))
        .some((y) => Math.abs(y - Math.max(hi, lo)) < 0.01);
      const h = Math.max(hi, lo) - (level ? 0.06 : 0);
      // (with a string, the Echo's: the lip's front arris taken off at 45°,
      // a face turned up to the lamps over the stair, so the lip is drawn as
      // the palest line on each step — its front faces away from them)
      nosing.add(profileGeo(string
        ? [[e, h], [e + d * 0.6, h], [e + d * 0.95, h - 0.35], [e + d * 0.95, h - 0.6], [e + d * 0.3, h - 1.2], [e, h - 1.2]]
        : [[e, h], [e + d * 0.95, h], [e + d * 0.95, h - 0.5], [e + d * 0.3, h - 1.2], [e, h - 1.2]], TREAD_W, c, ang));
      if (floor > -1e8 && h - 1.2 > floor + 0.2) {
        riser.add(profileGeo([[e + d * 0.03, floor], [e + d * 0.06, floor], [e + d * 0.06, h - 1.2], [e + d * 0.03, h - 1.2]], TREAD_W, c, ang));
      }
    }
    // ── the wall string ──
    // A raking band up the inside of each flank, from under the treads to a
    // little over the nosings, that every step dies into. Without it each
    // tread ended against the parapet on its own, its lip and the shade under
    // it a dark notch at both ends: a flight of separate slabs. (Cut as the
    // flank is, so it never stands across the other flight's treads or the
    // way off at the crossing.)
    if (string) {
      const LIFT = stepTop(Math.min(to - 1, from + 1)) - stepTop(from) || 2.4;
      const IN = halfW - 0.8, D = 0.3;
      for (const side of [-1, 1]) {
        // One plain band, a hair proud of the flank. (With a fillet along its
        // top it was a second bright line beside the coping, and from the
        // stand the flank read as three rails running down to the floor;
        // ?wechofix=old:2 is without any string.)
        const parts = [[-LIFT - 1.1, 0.6, D]];
        for (const [lo, hi, depth] of parts) {
          const lim = roof(side * (IN - depth), side * IN, gapOf(side));
          for (const pts of cutTo(rake(hi), rake(lo), lim)) {
            face.add(profileGeo(pts, depth + 0.1, spot(0, side * (IN - (depth - 0.1) / 2)), ang));
          }
        }
      }
    }
    // (`worn` may be a test of the tread, k: a tread with something laid in
    // it — the Echo's rose — is worn some other way, or not at all)
    if (worn) {
      for (let k = from; k < to; k++) {
        if (typeof worn === 'function' && !worn(k)) continue;
        LB.wornStep.add(flatQuad(spot(-span + (k + 0.5) * run, 0), ang, run * 0.72, TREAD_W * 0.55, stepTop(k) + 0.03));
      }
    }

    // ── the arch ring ──
    // Laid out from the springing rather than from the built ends, so the
    // middle bay falls on the crown and can be a keystone — and so a flight
    // sheared off in mid air (the Silence) keeps the coursing of the one that
    // is whole. Each voussoir is one piece right across the flight.
    const slope = (t) => {
      const h = 0.06, a = Math.max(-spring + 1e-4, t - h), b = Math.min(spring - 1e-4, t + h);
      return Math.max(-46, Math.min(46, (soffit(b) - soffit(a)) / (b - a)));
    };
    const normal = (t) => { const d = slope(t), L = Math.hypot(d, 1); return [-d / L, 1 / L]; };
    const ringTop = (t) => pitch(t) - 2.6;
    const t0R = Math.max(-spring, u0), t1R = Math.min(spring, u1);
    const BAYS = light ? 13 : 21;
    // The ring is laid in two thicknesses: a continuous course behind, and the
    // jointed voussoirs on top of it. Without the one behind, every joint is a
    // hole through to the flank — 0.4 wide and the best part of a unit deep,
    // and in this light that is a black slot. Backed, the joint has a lit
    // floor half a unit down and reads as a joint.
    {
      const low = [], high = [];
      for (let n = 0; n <= BAYS * 3; n++) {
        const t = t0R + ((t1R - t0R) * n) / (BAYS * 3), nn = normal(t);
        low.push([t - nn[0] * 0.25, soffit(t) - nn[1] * 0.25]);
        high.push([t, ringTop(t)]);
      }
      across(high, low, FACE + BACK);
    }
    for (let k = 0; k < BAYS; k++) {
      const a0 = -spring + (2 * spring * k) / BAYS, a1 = -spring + (2 * spring * (k + 1)) / BAYS;
      if (a1 <= t0R + 0.2 || a0 >= t1R - 0.2) continue;
      // The joint is a fixed width of ARC, not of span, or the bays close up
      // into one smooth curve again where the arch turns vertical.
      const jt = (t) => Math.min(0.3 / Math.hypot(1, slope(t)), (a1 - a0) * 0.3);
      const b0 = Math.max(t0R, a0 + jt(a0)), b1 = Math.min(t1R, a1 - jt(a1));
      if (b1 - b0 < 0.15) continue;
      const key = Math.abs((a0 + a1) / 2) < spring / BAYS;
      const low = [], high = [];
      for (let n = 0; n <= 4; n++) {
        const t = b0 + ((b1 - b0) * n) / 4, nn = normal(t);
        low.push([t - nn[0] * (key ? 0.9 : 0.55), soffit(t) - nn[1] * (key ? 0.9 : 0.55)]);
        // The keystone is longer than its neighbours at both ends and breaks
        // UP through the string course, which is the one stone in an arch that
        // is allowed to interrupt anything. (Not where the crown is under a
        // floor somebody walks on — the Silence's terrace — or it stands up
        // through the paving as a kerb across the middle of it: `keyThrough`.)
        high.push([t, key ? (keyThrough ? pitch(t) + 0.35 : pitch(t) - 0.45) : ringTop(t)]);
      }
      const out = key ? RING + 0.5 : RING;
      across(high, low, FACE + out);
      // a boss on the keystone, one to a face: the same coin the arcade
      // overhead puts over every one of its own crowns
      if (key) {
        const y = (pitch(0) + soffit(0)) / 2 - 0.6;
        for (const side of [-1, 1]) {
          const q = spot((b0 + b1) / 2, side * (FACE + out));
          LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.15, 1.15, 0.5, 14).rotateX(Math.PI / 2), q, y, -ang * deg));
        }
      }
    }

    // ── the abutments ──
    if (!light) {
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
          const lo = end < 0 ? u0 : spring, hi = end < 0 ? -spring : u1;
          if (hi - lo < 3) continue;
          // the plinth: one course standing out further than any above it
          face.add(boxGeo(spot(lo, side * (FACE + BACK)), spot(hi, side * (FACE + BACK)), 2.2, BACK * 2, FLOOR_Y));
          // Courses of 1.6, not of 2.6: at the feet the abutment is barely
          // three units of stone between the floor and the string, and on a
          // coarser bed not one of them would fit.
          for (let row = 0; row < 8; row++) {
            const y0 = FLOOR_Y + 2.2 + row * 1.95, y1 = y0 + 1.6, step = 3.4;
            for (let m = -1; ; m++) {
              const ua = lo + (row % 2 ? step / 2 : 0) + m * step;
              if (ua >= hi) break;
              let a = Math.max(lo, ua), b = Math.min(hi, ua + step - 0.22);
              // The string rakes and the courses do not, so most stones in a
              // course run out under it partway along. Cut them back to where
              // they still have a course's worth of room, rather than dropping
              // whichever ones straddle the line — dropped, they left the foot
              // of the flight one blank face with a plinth under it; cut, each
              // course ends against the string the way cut stone does.
              while (a < b && ringTop(a) < y0 + 0.85) a += 0.3;
              while (b > a && ringTop(b) < y0 + 0.85) b -= 0.3;
              if (b - a < 1.1) continue;
              const cut = Math.min(y1, ringTop(a), ringTop(b));
              face.add(boxGeo(spot(a, side * (FACE + COURSE / 2)), spot(b, side * (FACE + COURSE / 2)), cut - y0, COURSE, y0));
            }
          }
        }
      }
    }

    // ── the springers ──
    // Where the arch comes down to the floor the ring simply dived into it,
    // and the coursed abutment beside it read as a different building. A
    // skewback block at each springing, standing out past everything around
    // it, is what the two are jointed by — and it says where the span begins,
    // which from the floor is the one thing about this stair worth knowing.
    for (const side of [-1, 1]) {
      for (const e of [-spring, spring]) {
        if (e < u0 + 1 || e > u1 - 1) continue;
        const d = e < 0 ? -3.2 : 3.2, top = ringTop(e) + 0.9;
        band([[e, top], [e + d, top], [e + d, FLOOR_Y], [e, FLOOR_Y]], FACE, FACE + RING + 0.22, side);
        band([[e - Math.sign(d) * 0.5, top + 1.1], [e + d * 1.16, top + 1.1],
          [e + d * 1.16, top], [e - Math.sign(d) * 0.5, top]], FACE, FACE + RING + 0.62, side);
      }
    }

    // ── the string course, and the coping over the parapet ──
    // The string is two members, not one: a plain band and a corona over it
    // that oversails it, so the moulding throws a shadow instead of being a
    // stripe. It runs just under the deck line, which is where a bridge's does
    // — it is the line that tells the eye where you would be walking.
    for (const side of [-1, 1]) {
      // The string runs straight through the crossing — it is below the deck,
      // on stone that is there whether or not the parapet over it is. (Below
      // the pitch line, that is, which is not below the treads: crossed, it is
      // cut down to them.)
      const g = gapOf(side);
      // `plane` (the Echo): no string. Its corona's shadow ran the length of
      // the flight just under the deck, on top of the arch ring, and cut the
      // bridge in two along it — a balustraded wall standing on an arch, "a
      // large line that splits the bridge in two horizontally" (2026-10-07).
      // Instead the flank comes out flush with the ring's face from the ring
      // to the coping, so arch and parapet are one face of one stone, broken
      // only by the keystone and the springers. (?wline=old: the string.)
      if (plane) {
        for (const pts of cutTo(parapetTop(side), rake(-2.6), roof(side * FACE, side * (FACE + RING), g))) band(pts, FACE, FACE + RING, side);
      } else {
        for (const [lo, hi, out] of [[-2.45, -1.25, MOULD], [-1.25, -0.45, CORONA]]) {
          for (const pts of cutTo(rake(hi), rake(lo), roof(side * FACE, side * (FACE + out), g))) band(pts, FACE, FACE + out, side);
        }
      }
      // the coping, in as many pieces as the parapet under it has
      for (const [a, b] of g ? [[u0, Math.min(u1, g[0])], [Math.max(u0, g[1]), u1]] : [[u0, u1]]) {
        if (b - a > 2) band(bandPts(1.6, 2.45, a, b), halfW - 0.25, FACE + CORONA, side);
      }
      // a quoin closing the flank at each end it really ends at — and not at
      // one it was sheared off at, where the stone should look broken
      for (const [i, e] of [[0, u0], [1, u1]]) {
        if (!ends[i]) continue;
        const d = i ? -3.4 : 3.4;
        band([[e, deck(e) + 1.6], [e + d, deck(e + d) + 1.6], [e + d, FLOOR_Y], [e, FLOOR_Y]],
          FACE, FACE + CORONA, side);
      }
    }

    // ── the parapet's joints ──
    // The parapet and its coping were each one smooth stone the length of the
    // flight: from the foot of it, a plain plane along the side of the frame.
    // Cut into blocks a little over a stride long, joint by joint, inside face
    // and out, it is built.
    // (Not on the Echo's flanks — `plane` — whose stone has joints of its
    // own; these were black slits through them, read as cracks.)
    for (const side of plane ? [] : [-1, 1]) {
      const g = gapOf(side);
      for (let u = u0 + 3.6; u < u1 - 1.5; u += 7.2) {
        if (g && u > g[0] - 0.5 && u < g[1] + 0.5) continue;
        const y = deck(u), slot = [[u - 0.09, y - 0.45], [u + 0.09, y - 0.45], [u + 0.09, y + 2.47], [u - 0.09, y + 2.47]];
        LB.joint.add(profileGeo(slot, 0.06, spot(0, side * (halfW - 0.83)), ang));
        LB.joint.add(profileGeo(slot, 0.06, spot(0, side * (FACE + 0.03)), ang));
      }
    }

    // ── the balustrade ──
    // The uprights plumb and the rail following the pitch line: that is what a
    // stair balustrade is, and what a rod on posts stepping with the treads is
    // not. Broken wherever `gap` says the other flight comes in.
    const railY = (u) => pitch(u) + 9;
    const copingTop = (u) => deck(u) + 2.45;
    const Z = FACE - 0.2;
    // (the stone balustrade goes in the flight's own stone: pale, or the
    // Silence's shaded)
    const carve = stone === LB.capShade ? LB.balustradeShade : LB.balustrade;
    const newel = (u, side) => {
      const q = spot(u, side * Z), y = copingTop(u), r = -ang * deg;
      if (!RAIL_OLD) {
        // A pedestal, its cornice at the height of the rail: a raking rail
        // ending at its middle meets the uphill face a third of a unit
        // higher, and dies into the cornice there rather than over it. Let
        // down into the kerb, whose top the coping is set back from on the
        // stair's side.
        carve.add(placed(pedestalGeo(FLIGHT_RAIL.ped, FLIGHT_RAIL.baseH - FLIGHT_RAIL.sink, railY(u) + 0.35 - y, { sunk: 0.9, shift: patchOf(q) }), q, y, r));
        return;
      }
      stone.add(placed(new THREE.BoxGeometry(2.2, 0.9, 2.2), q, y + 0.45, r));
      stone.add(placed(new THREE.BoxGeometry(1.75, 0.45, 1.75), q, y + 1.12, r));
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.72, 0.72, 0.42, 12), q, y + 1.56));
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.44, 0.58, 4.9, 12), q, y + 4.22));
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.78, 0.52, 0.7, 12), q, y + 7.02));
      // a plain turned cap: the ball and spike it had were the sharpest,
      // brightest thing in the Echo's frame, and pulled the eye off the arches
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.62, 0.8, 0.32, 14), q, y + 7.53));
      LB.bronze.add(placed(new THREE.SphereGeometry(0.5, 14, 8).scale(1, 0.62, 1), q, y + 7.75));
    };
    // The balustrade runs from springing to springing — over the WELL, and no
    // further. Past the springing the flight is a low ramp a few feet above a
    // stone floor, where a kerb is all it wants; and it is how a bridge reads
    // anyway, solid parapet on the approaches and balusters over the arch.
    //
    // (A rail carried out to the feet was also one the walk went through: when
    // the feet stood within a stride of the bookcases and a reader got on and
    // off over the parapet, check:walls measured the old thin one at 0.7 from
    // the eye on the way out, and at 1.1 from it on the way in.)
    const END = 5.5;
    const R0 = Math.max(u0 + END, -spring + 3), R1 = Math.min(u1 - END, spring - 3);
    for (const side of [-1, 1]) {
      const g = gapOf(side);
      for (const [ra, rb] of g ? [[R0, Math.min(R1, g[0])], [Math.max(R0, g[1]), R1]] : [[R0, R1]]) {
        if (rb - ra < 6) continue;
        // the pitch line kinks over the crown, so the rail is drawn in the
        // pieces it really has rather than one rod through the bend
        const knots = [ra, ...[-crown, crown].filter((u) => u > ra + 0.5 && u < rb - 0.5), rb];
        // (where two flights' balustrades meet at a corner, one newel stands
        // for both: the other flight's, unless `gapNewels`)
        if (gapNewels || !g || ra !== g[1]) newel(ra, side);
        if (gapNewels || !g || rb !== g[0]) newel(rb, side);
        if (!RAIL_OLD) {
          // Stone, from newel to newel: the plinth on the coping, the rail
          // raking with the pitch line. Balusters start clear of the newels
          // at both ends — of the other flight's too, which stands at 60° to
          // this one and so reaches further along it.
          stoneRail(carve, {
            at: (u) => spot(u, side * Z), foot: copingTop, top: (u) => railY(u) + 0.5,
            knots, clear: [1.5, 1.5], ry: () => -ang * deg, S: FLIGHT_RAIL,
          });
          continue;
        }
        for (let i = 1; i < knots.length; i++) {
          const a = spot(knots[i - 1], side * Z), b = spot(knots[i], side * Z);
          LB.bronze.add(rodGeo([a[0], railY(knots[i - 1]), a[1]], [b[0], railY(knots[i]), b[1]], 0.44));
        }
        // Two to a tread. One reads as a fence with its pickets missing; four
        // closes into a bronze band there is no seeing the room through.
        for (let u = ra + run / 2; u < rb - 1.2; u += run / 2) {
          const base = copingTop(u), h = railY(u) - 0.55 - base;
          if (h < 2) continue;
          const q = spot(u, side * Z);
          balusters.push({ p: [q[0], base, q[1]], s: [0.42, h / 6.2, 0.42] });
        }
      }
    }

    // ── the corners ──
    // Where two flights' balustrades meet, each parapet and coping ends square
    // under the newel they share, and on the side a reader stands the corner
    // between the two ends was left open: a bite out of the wall the height
    // of the kerb, three units deep at the sharp corners. Filled to where the
    // two inner faces meet, they meet in one mitre. (One flight lays them,
    // with the newels.)
    if (cross && gapNewels) {
      const oa = dir(cross.ang), on = dir(cross.ang + 90);
      // where p + s·d crosses q + r·e
      const meet = (p, d, q, e) => add(p, d, ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0]));
      for (const side of [-1, 1]) {
        for (const uQ of gapOf(side)) {
          // the newel's point, and which of its own flanks the other flight
          // brings to it
          const Q = spot(uQ, side * Z), dq = [Q[0] - cross.c[0], Q[1] - cross.c[1]];
          const t = Math.sign(dq[0] * on[0] + dq[1] * on[1]), uo = dq[0] * oa[0] + dq[1] * oa[1];
          const y = deck(uQ);
          for (const [zin, y0, y1] of [[halfW - 0.8, ringTop(uQ), y + HIGH], [halfW - 0.25, y + 1.6, y + 2.45]]) {
            const a = spot(uQ, side * zin), b = add(add(cross.c, oa, uo), on, t * zin);
            face.add(slabGeo([a, meet(a, ax, b, oa), b, Q], [], y1 - y0, y0));
          }
        }
      }
    }
  };

  // The stone of a gallery's walls: the ring between the room and the edge of
  // its cell, as the six trapezoids it really is — one to an edge, split where
  // a doorway opens — and not one slab with a room-shaped hole in it.
  //
  // A doorway cannot be a hole. A hole has to stop short of the outline it is
  // cut in, and what this one stopped short by — 0.05 of stone, half a
  // centimetre at a reader's scale — stood across every hallway, its full width
  // and its full height. That sliver is what the corridor visibly ended in, and
  // what the walk went through.
  //
  // `gaps(k)`: the doorways in edge k, as spans measured along the edge from
  // its middle. Where a span runs to the end of the edge the piece keeps the
  // cell's mitred corner; where a doorway cuts it, the piece ends square, and
  // that square end is the jamb of the doorway.
  const wallRing = (c, rIn, rOut, gaps) => {
    const pieces = [];
    for (let k = 0; k < 6; k++) {
      const n = dir(60 * k + 30), t = dir(60 * k + 120);
      const inner = (u) => add(add(c, n, (rIn * Math.sqrt(3)) / 2), t, u);
      const outer = (u) => add(add(c, n, (rOut * Math.sqrt(3)) / 2), t, u);
      const run = (a, b) => {
        if (b - a < 0.5) return;
        pieces.push([inner(a), inner(b),
          outer(b === rIn / 2 ? rOut / 2 : b), outer(a === -rIn / 2 ? -rOut / 2 : a)]);
      };
      let u = -rIn / 2;
      for (const [a, b] of gaps(k).sort((p, q) => p[0] - q[0])) { run(u, a); u = b; }
      run(u, rIn / 2);
    }
    return pieces;
  };

  // the pier glasses either side of each gallery's way out (mirror.js)
  const mirrors = makeMirrors({ root, keep, light });
  const P = { project: true };
  const G = { project: WOOD_OLD || 'grain' };
  const LB = {
    mass: new Batch(M.mass, P), cap: new Batch(M.cap, P), capShade: new Batch(M.capShade, P), floor: new Batch(M.floor, { cast: false, ...P }),
    // the bridges' stone balustrades: carved stone, never a stair (their uv
    // is their own: along each moulding, round each baluster)
    balustrade: new Batch(M.carve), balustradeShade: new Batch(M.carveShade),
    shelf: new Batch(M.shelf, G), shelfLip: new Batch(M.shelfLip), shelfBack: new Batch(M.shelfBack, { cast: false, ...G }),
    bronze: new Batch(M.bronze), bronzeDim: new Batch(M.bronzeDim), inlay: new Batch(M.inlay, { cast: false }), fillet: new Batch(M.fillet, { cast: false }),
    liner: new Batch(M.liner, { cast: false }), stars: new Batch(M.stars, { cast: false, receive: false }),
    step: new Batch(M.step, P), mirror: new Batch(M.mirror, { cast: false }), stone: new Batch(M.stone, P),
    frame: new Batch(M.frame), gilt: new Batch(M.gilt, { cast: false }), giltDeep: new Batch(M.giltDeep, { cast: false }), iron: new Batch(M.iron, { cast: false }), rail: new Batch(M.wallTop, P),
    shafts: new Batch(shaftMaterial, { cast: false, receive: false }),
    frieze: new Batch(M.frieze, P), plate: new Batch(M.plate), letters: new Batch(M.letters, { cast: false }), scallop: new Batch(M.scallop, { cast: false }),
    railGlow: new Batch(M.railGlow, { cast: false, receive: false }), floorBand: new Batch(M.floorBand, { cast: false, ...P }),
    bronzeWorn: new Batch(M.bronzeWorn), oak: new Batch(M.oak, G), shade: new Batch(M.shade, { cast: false }),
    shadeDead: new Batch(M.shadeDead), paper: new Batch(M.paper), wax: new Batch(M.wax), leather: new Batch(M.leather), tuft: new Batch(M.tuft, { cast: false }),
    shelfWorn: new Batch(M.shelfWorn, { cast: false, ...G }), dust: new Batch(M.dust, { cast: false }),
    contact: new Batch(M.contact, { cast: false, receive: false }), riserShade: new Batch(M.riserShade, { cast: false, receive: false }), joint: new Batch(M.joint, { cast: false }), deadShards: new Batch(M.deadShards, { cast: false }),
    wornFloor: new Batch(M.wornFloor, { cast: false }), wornStep: new Batch(M.wornStep, { cast: false }),
    dustFan: new Batch(M.dustFan, { cast: false }), moonStone: new Batch(M.moonStone, P),
    // the Door's fallen blocks (felt, as they always were) and the stones
    // round them (not: body.js, UNFELT)
    rubbleBlocks: new Batch(M.rubble, P), rubbleBig: new Batch(M.rubble, P),
    // (the smallest cast no shadow worth the drawing: a moon shadow's texel is
    // three-quarters of a unit)
    rubble: new Batch(M.rubble, { cast: false, ...P }),
    carve: new Batch(M.carve), dressed: new Batch(M.dressed, P), marble: new Batch(M.marble),
    // the Door's portal, in the same stones, its reveals and soffits darkened
    // in the shader (doorFix.js, 3)
    portalCarve: new Batch(doorOld(3) ? M.carve : keep(revealShade(stoneShade(M.carve.clone()), PORTAL_FRAME, PORTAL, 'carve'))),
    portalDressed: new Batch(doorOld(3) ? M.dressed : keep(revealShade(stoneShade(M.dressed.clone(), { weather: true }), PORTAL_FRAME, PORTAL, 'dressed')), P),
    // The Echo's flights' flanks, in the stone the flights themselves are cut
    // from (their steps and the arch under them): one stone, its joints
    // running every way, so no single course runs level across both flights.
    // Its own batch, because body.js reads `step` as a stair and a flank is not
    // one. (It was the carving's limestone, jointless, and on a face this big
    // its soft mottle read as glossed plaster, 2026-10-07.)
    flank: new Batch(M.step, P),
    // (the Echo's: echoFix.js, 2 and 6)
    nosing: new Batch(M.nosing, P), riserSoft: new Batch(M.riserSoft, { cast: false, receive: false }), drum: new Batch(M.drum, P),
    column: new Batch(M.column), columnBox: new Batch(M.column, P),
    bookRows: new Batch(M.bookRows, { cast: false }), bookRowsLit: new Batch(M.bookRowsLit, { cast: false }),
  };
  const fallenLeaves = [], doorIvy = [], doorRubble = [], petals = [], hangs = [];
  // the Door's ivy and the pergola's wisteria leaves, and both their wood (ivy.js)
  const ivyLeaves = [], vineLeaves = [], ivyWood = new Wood(7);
  const IVY_GREEN = ['#26401f', '#2d4a24', '#34522a', '#2a4422', '#3a5a2c', '#22381c', '#304d26'];
  const IVY_YOUNG = ['#5a7a34', '#66863a', '#4f6e2e'];
  const posts = [], links = [], balusters = [];
  // (`shelved`: the books standing on the galleries' shelves, at their real
  // size — drawn a wall to a mesh, and not felt by the walking body, which
  // the shelves' boards keep off them: see body.js)
  const shelved = [];
  let shelvedWalls = 0;
  // and each wall's books painted as well (bookRows), drawn instead of its
  // boxes when no eye is near it: `lodRows` holds the strips for a wall,
  // `wallRoom` the gallery it is in (see `lodGroups`)
  const lodRows = new Map(), wallRoom = new Map();
  const lodFor = (wall, room) => {
    if (!lodRows.has(wall)) { lodRows.set(wall, []); wallRoom.set(wall, room); }
    const list = lodRows.get(wall);
    return { add: (g) => list.push(g) };
  };
  const books = [], lampCores = [], lampShells = [], globes = [], deadGlobes = [], rubble = [], dust = [];
  // (the lamp pass, lampPass.js: the stair sconces' panes in the globes' glass,
  // paper lanterns, candle flames and the wax under them)
  const trialPanes = [], trialPaper = [], trialEaves = [], trialFlames = [], trialWax = [];
  // Declared up here because the Library uses it too (the Echo's sconces), not
  // only the garden's lanterns.
  const glows = [];
  // (the Door's candelabra's lights, which breathe with their flames: doorProps.js, 4)
  const candleLights = [];
  // Lights the pond may see that are not glows: a flame behind paper is drawn
  // as the paper (see the stone lanterns), but the water still wants a lamp.
  const waterLamps = [];
  // Old leather, not a paint chart (see textures.js): the gold on the spines is
  // what should catch the eye, not the bindings.
  const BOOKS = ['#4a3a2c', '#3e2f26', '#35382e', '#4f4130', '#383d40', '#4c392b', '#56372c', '#2f3830', '#3a3346', '#5e4b36', '#6b5a44', '#402a26', '#2e3a3c'];

  yield 'The books on a wall';
  // ── The books on a wall ───────────────────────────────────────────────────
  // Per room: the Silence is a room nobody reads in, and its bindings have gone
  // grey with it; the Door keeps green off its shelves, so that the only green
  // in the room is the moon's beyond the jamb.
  const tone = new THREE.Color();
  const toneHex = (hex, sat = 1, lum = 1) => {
    tone.set(hex);
    const hsl = tone.getHSL({});
    tone.setHSL(hsl.h, hsl.s * sat, Math.min(0.9, hsl.l * lum));
    return `#${tone.getHexString()}`;
  };
  const bindingsFor = (room) => BINDINGS
    .filter((b) => !(room === 4 && b.green))
    .map((b) => (room === 2
      ? { ...b, share: b.kind === 'vellum' ? 4 : b.share, cols: b.cols.map((h) => toneHex(h, 0.4, b.kind === 'vellum' ? 0.62 : 0.8)) }
      : b));
  // Folios low, octavos high: the heights and widths a run is drawn from, tier
  // by tier. The top shelf stops well short of the frieze board over it.
  const SIZES = [
    { h: [16.6, 19.4], w: [3.8, 6.0] },
    { h: [15.2, 18.4], w: [3.2, 5.2] },
    { h: [13.4, 16.6], w: [2.8, 4.5] },
    { h: [11.6, 14.6], w: [2.4, 3.9] },
    { h: [10.0, 13.0], w: [2.1, 3.5] },
  ];
  const kindCell = (kind, r) => { const [lo, hi] = SPINE_KINDS[kind]; return lo + Math.floor(r * (hi - lo)); };
  const LAID = 1000;   // aSpine for a book lying flat (see makeBookMaterial)
  // How much of the lamp-rails' wash each lit room has: none in the Silence,
  // "where the lamps grow faint".
  const GRAZE_BY_ROOM = { 0: 1, 1: 0.7, 2: 0, 4: 0.8 };
  // Numbered plates for the bays: a box whose every face shows cell `i`.
  const plateGeo = (i) => {
    const g = new THREE.BoxGeometry(3.4, 2.1, 0.3);
    const uv = g.attributes.uv;
    for (let v = 0; v < uv.count; v++) uv.setX(v, (i + uv.getX(v)) / PLATE_CELLS);
    return g;
  };
  // Borges numbers every hexagon and every wall of it, so the cornice carries
  // both: the hexagon's own number (from its place in the honeycomb, kept to
  // a numeral short enough to cut) and the wall's, I to VI round the room. A
  // doorway has no shelves and so no number; the gaps in the count are the
  // ways out.
  const NUMERALS = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  const roman = (n) => NUMERALS.reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
  const hexNumber = (i, j) => {
    let n = 100 + ((Math.imul(i + 37, 73856093) ^ Math.imul(j + 91, 19349663)) >>> 0) % 900;
    while (roman(n).length > 7) n++;
    return roman(n);
  };

  // A wall of shelves, tier above tier, from `from` to `to` (tier indexes).
  // `detail`: 0 for the far honeycomb, 1 near the walk (pilasters, the frieze
  // board, the ledge), 2 in the rooms themselves (flutes, dentils, numbered
  // plates, leather shelf-edges, the lamp-rail).
  // `stream`: the length of wall the world's stream is drawn for, when that is
  // not this wall's (the Echo's are longer than the walls it was drawn for).
  const shelfWall = (a, b, inward, { from = 0, to = TIERS - 1, room, detail = 0, graze = 0, words = null, stream } = {}) => {
    const len = dist(a, b);
    const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const s0 = 12, s1 = len - 12;
    const yBottom = TIER_BASE + from * TIER_H, yTop = TIER_BASE + (to + 1) * TIER_H;
    const face = -Math.atan2(t[1], t[0]), turn = face;
    const on = (u, z) => add(add(a, t, u), inward, z);
    LB.shelfBack.add(boxGeo(on(s0, 1.2), on(s1, 1.2), yTop - yBottom, 2, yBottom));
    // The world's random stream, drawn exactly as the old shelving drew it and
    // then thrown away. Everything built after the galleries — the garden above
    // all — is laid out off that stream, and shelving on it any other way would
    // have reshuffled the lot. The books themselves come from `br`, the wall's own.
    const ghost = [], ghostEnd = stream === undefined ? s1 : stream - 12;
    for (let tier = from; tier <= to; tier++) {
      const y = TIER_BASE + tier * TIER_H;
      let u = s0;
      while (u < ghostEnd - 2) {
        if (rnd() < 0.05) { u += rr(3, 9); continue; }
        if (rnd() < 0.045) {
          const w2 = rr(9, 15);
          for (let n = 0; n < 2 + Math.floor(rnd() * 3); n++) {
            const th = rr(1.5, 2.8);
            ghost.push([face + rr(-0.06, 0.06), w2 * rr(0.8, 1), th, rr(8, 10.5), pick(BOOKS), rr(0.75, 1.1)]);
          }
          u += w2 + rr(0.4, 1.6);
          continue;
        }
        const w = rr(2.3, 5.2), hh = rr(15.5, TIER_H - 2.2);
        ghost.push([y, rnd() < 0.05 ? rr(-0.3, 0.3) : 0, w, hh, rr(8, 11), pick(BOOKS), rr(0.75, 1.1)]);
        u += w + rr(0.15, 1);
      }
    }
    const br = makeRng((Math.round(a[0] * 131 + a[1] * 71 + b[0] * 37 + b[1] * 17) ^ (from * 7919)) | 0);
    // The titles have a stream of their own, so the shelving stays as it was:
    // one title to a set, its volumes numbered along the shelf (see
    // makeBookMaterial; `title` carries 1000 × the volume).
    const tr = makeRng((Math.round(a[0] * 89 + a[1] * 53 + b[0] * 61 + b[1] * 29) ^ (from * 104729) ^ 0x7e11) | 0);
    const newTitle = () => Math.floor(tr() * TITLE_COUNT);
    // the Silence: nobody has taken a book down in a long time
    const dust = room === 2 ? 1 : 0;
    const within = ([lo, hi]) => lo + (hi - lo) * br();
    const bindings = bindingsFor(room);
    const shareSum = bindings.reduce((n, x) => n + x.share, 0);
    const pickBinding = () => { let r = br() * shareSum; for (const x of bindings) { r -= x.share; if (r <= 0) return x; } return bindings[0]; };
    const newRun = (tier, giant = BOOKS_GIANT) => {
      const B = pickBinding(), size = giant ? SIZES[tier] : SHELVES[tier], r = br();
      // (the big folios on the low shelves mostly plain: a label on every one
      // of a long run of them read as a pattern printed on the case)
      const [rich, label] = tier < 2 ? [0.14, 0.38] : [0.25, 0.7];
      const kind = B.kind ?? (r < rich ? 'rich' : r < label ? 'label' : 'plain');
      // the top shelf is nearest the lamps, and faded paler for it
      const top = tier === TIERS - 1;
      const d = giant ? 8 + br() * 2 : within(size.d);
      const n = br() < 0.22 ? 1 : 2 + Math.floor(br() * br() * 8);
      return {
        n: kind === 'vellum' ? Math.min(n, 3) : n,
        color: toneHex(B.cols[Math.floor(br() * B.cols.length)], top ? 0.8 : 1, top ? 1.1 : 1),
        spine: kindCell(kind, br()),
        h: within(size.h), w: within(size.w) * (kind === 'vellum' ? 0.85 : 1),
        // (a real book stands a finger's breadth or two back from the shelf's
        // edge at 12, a giant one a hand or more)
        d, front: giant ? 9.4 + br() * 1.8 : 11.9 - br() * 0.6, k: 0.86 + br() * 0.2,
      };
    };
    const bayEnds = [0, 1, 2, 3].map((i) => s0 + (i * (s1 - s0)) / 3);
    if (!BOOKS_GIANT) {
      // In the galleries on the walk every book is a box of its own. In the
      // rest of the Library, seen only from over the walls, a shelf is its
      // painted row of them (bookRows), a stretch of the strip.
      const real = detail >= 2;
      // The case's back, brought forward to stand behind the books: a giant
      // folio was 9 deep, a real one is 3.
      if (real) LB.shelfBack.add(boxGeo(on(s0, CASE_BACK - 0.5), on(s1, CASE_BACK - 0.5), yTop - yBottom, 1, yBottom));
      const spin = Math.atan2(inward[0], inward[1]);
      const paintedBay = (tier, sy, clear, ua, ub, target = LB.bookRows) => {
        const L = ub - ua, { top: vt, base: vb } = rowV[tier * BOOK_ROWS.variants + Math.floor(br() * BOOK_ROWS.variants)];
        const u0 = br(), g = new THREE.PlaneGeometry(L, clear), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (uv.getX(i) * L) / BOOK_ROWS.length, vb + uv.getY(i) * (vt - vb));
        g.rotateY(spin);
        const q = on((ua + ub) / 2, 11.6);
        target.add(g.translate(q[0], sy + clear / 2, q[1]));
      };
      let R = null, run = 0;
      const wall = shelvedWalls++, far = real ? lodFor(wall, room) : null;
      // (a gallery's top tiers, painted where they stand)
      const lit = {
        add: (g) => {
          const n = g.attributes.position.count, v = [graze, room === 2 ? 1 : 0];
          g.setAttribute('aLit', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => v).flat(), 2));
          LB.bookRowsLit.add(g);
        },
      };
      // One bay of one shelf, from `ua` to `ub` along the wall, its books
      // standing on `sy` with `clear` over them. A set runs on from bay to bay
      // and shelf to shelf, as a set on a real shelf does.
      const shelveBay = (tier, sy, clear, ua, ub) => {
        const SH = SHELVES[tier];
        let u = ua + br() * 0.1, lean = 0;
        while (u < ub - 0.3) {
          if (run <= 0) {
            const x = br();
            // now and then a reader has taken one out, and its neighbour leans
            // into the gap it left
            if (x < 0.02 && u > ua + 1) {
              // or a bronze bookend holds up what is left of the run
              if (br() < 0.4) {
                const eh = Math.min(2.2, clear - 0.5);
                LB.bronzeDim.add(placed(new THREE.BoxGeometry(0.1, eh, 1.5), on(u + 0.05, 10.8), sy + eh / 2, turn));
                LB.bronzeDim.add(placed(new THREE.BoxGeometry(0.9, 0.06, 1.5), on(u + 0.5, 10.8), sy + 0.03, turn));
                u += 0.14;
                lean = 0;
                continue;
              }
              const g = 0.35 + br() * 0.45; u += g; lean = g; continue;
            }
            // or a few are laid flat on the shelf, spine out
            if (x < 0.032) {
              const w2 = within(SH.h);
              if (u + w2 > ub) break;
              const B = pickBinding();
              let lie = sy;
              for (let n = 0, count = 2 + Math.floor(br() * 3); n < count; n++) {
                const th = within(SH.w) * 1.1, wn = w2 * (0.86 + br() * 0.14), dn = within(SH.d);
                if (lie + th > sy + clear - 0.4) break;
                const q = on(u + w2 / 2 + (br() - 0.5) * 0.15, 11.7 - dn / 2);
                shelved.push({
                  wall,
                  p: [q[0], lie + th / 2, q[1]], rot: [0, face + (br() - 0.5) * 0.1, 0], s: [wn, th, dn],
                  color: pickBinding().cols[0], k: 0.85 + br() * 0.2, spine: LAID + kindCell(B.kind === 'vellum' ? 'vellum' : 'label', br()), graze, dust,
                  title: newTitle(),
                });
                lie += th;
              }
              u += w2 + 0.1 + br() * 0.25;
              lean = 0;
              continue;
            }
            R = newRun(tier);
            R.title = newTitle();
            run = R.n;
          }
          const w = R.w * (1 + (br() - 0.5) * 0.06), hh = R.h * (1 + (br() - 0.5) * 0.025);
          if (u + w > ub) break;
          const inset = R.front - R.d / 2;
          const book = { color: R.color, k: R.k * (0.96 + br() * 0.08), spine: R.spine, graze, dust, title: R.title + (R.n > 1 ? 1000 * (R.n - run + 1) : 0) };
          if (lean) {
            // Pivoted on its foot at the edge of the gap and resting its head on
            // the book across it.
            const th = Math.min(0.36, Math.asin(Math.min(0.9, lean / hh)));
            const c2 = on(u + (w / 2) * Math.cos(th) - (hh / 2) * Math.sin(th), inset);
            shelved.push({ ...book, wall, p: [c2[0], sy + (w / 2) * Math.sin(th) + (hh / 2) * Math.cos(th), c2[1]], rot: [0, face, th], s: [w, hh, R.d] });
            u += w * Math.cos(th) + 0.04;
            lean = 0;
          } else {
            const p = on(u + w / 2, inset);
            shelved.push({ ...book, wall, p: [p[0], sy + hh / 2, p[1]], rot: [0, face, 0], s: [w, hh, R.d] });
            u += w + 0.006 + br() * 0.035;
          }
          run--;
        }
      };
      for (let tier = from; tier <= to; tier++) {
        const y = TIER_BASE + tier * TIER_H;
        if (tier > from) LB.shelf.add(boxGeo(on(s0, 6), on(s1, 6), 2.4, 12, y - 2.4));
        // (a set does not run on into a tier of another size)
        run = 0;
        shelvesOf(tier, y).forEach(({ y: sy, clear }, j) => {
          const mid = (CASE_BACK + 12) / 2;
          if (j > 0) LB.shelf.add(boxGeo(on(s0, mid), on(s1, mid), BOARD, 12 - CASE_BACK, sy - BOARD));
          // between the uprights, not through them
          // In a gallery, a box to every book on the three tiers the eye
          // is level with or under; the two over them — from 73 to the frieze,
          // more than 50 over any eye and nearly two thirds of the wall's
          // books, the smallest — painted, as the far galleries are.
          // (paint runs the length of the shelf, behind the uprights)
          const ua = bayEnds[0] + 1.35, ub = bayEnds[3] - 1.35;
          if (real && tier < 3) {
            for (let i = 0; i < 3; i++) shelveBay(tier, sy, clear, bayEnds[i] + 1.35, bayEnds[i + 1] - 1.35);
            paintedBay(tier, sy, clear, ua, ub, far);
          } else paintedBay(tier, sy, clear, ua, ub, real ? lit : LB.bookRows);
        });
      }
    } else for (let tier = from; tier <= to; tier++) {
      const y = TIER_BASE + tier * TIER_H;
      // (the lowest tier stands on the plinth: a board of its own lay inside
      // it with its top in the plinth's plane — see the plinth below)
      if (tier > from) LB.shelf.add(boxGeo(on(s0, 6), on(s1, 6), 2.4, 12, y - 2.4));
      let u = s0 + br() * 0.8, run = 0, R = null, lean = 0;
      while (u < s1 - 2) {
        if (run <= 0) {
          const x = br();
          // now and then a reader has taken one out, and its neighbour leans
          // into the gap it left
          if (x < 0.035 && u > s0 + 4) {
            // or a bronze bookend holds up what is left of the run
            if (br() < 0.4) {
              LB.bronzeDim.add(placed(new THREE.BoxGeometry(0.35, 6.4, 4.6), on(u + 0.2, 7.4), y + 3.2, turn));
              LB.bronzeDim.add(placed(new THREE.BoxGeometry(2.8, 0.25, 4.6), on(u + 1.5, 7.4), y + 0.13, turn));
              u += 0.6;
              lean = 0;
              continue;
            }
            const g = 2.4 + br() * 2.4; u += g; lean = g; continue;
          }
          // or a few are laid flat on the rest of the shelf
          if (x < 0.075) {
            const w2 = 9 + br() * 5;
            if (u + w2 > s1) break;
            const B = pickBinding();
            let lie = y;
            for (let n = 0, count = 2 + Math.floor(br() * 3); n < count; n++) {
              const th = 1.6 + br() * 1.1, wn = w2 * (0.84 + br() * 0.16), dn = 7.4 + br() * 2;
              if (lie + th > y + TIER_H - 3) break;
              const q = on(u + w2 / 2 + (br() - 0.5) * 0.8, 10.2 - dn / 2);
              books.push({
                p: [q[0], lie + th / 2, q[1]], rot: [0, face + (br() - 0.5) * 0.1, 0], s: [wn, th, dn],
                color: pickBinding().cols[0], k: 0.85 + br() * 0.2, spine: LAID + kindCell(B.kind === 'vellum' ? 'vellum' : 'label', br()), graze, dust,
                title: newTitle(),
              });
              lie += th;
            }
            u += w2 + 0.5 + br() * 1.2;
            lean = 0;
            continue;
          }
          R = newRun(tier, true);
          R.title = newTitle();
          run = R.n;
        }
        const w = R.w * (1 + (br() - 0.5) * 0.06), hh = R.h * (1 + (br() - 0.5) * 0.025);
        if (u + w > s1) break;
        const inset = R.front - R.d / 2;
        const book = { color: R.color, k: R.k * (0.96 + br() * 0.08), spine: R.spine, graze, dust, title: R.title + (R.n > 1 ? 1000 * (R.n - run + 1) : 0) };
        if (lean) {
          // Pivoted on its foot at the edge of the gap and resting its head on
          // the book across it.
          const th = Math.min(0.36, Math.asin(Math.min(0.9, lean / hh)));
          const c2 = on(u + (w / 2) * Math.cos(th) - (hh / 2) * Math.sin(th), inset);
          books.push({ ...book, p: [c2[0], y + (w / 2) * Math.sin(th) + (hh / 2) * Math.cos(th), c2[1]], rot: [0, face, th], s: [w, hh, R.d] });
          u += w * Math.cos(th) + 0.3;
          lean = 0;
        } else {
          const p = on(u + w / 2, inset);
          books.push({ ...book, p: [p[0], y + hh / 2, p[1]], rot: [0, face, 0], s: [w, hh, R.d] });
          u += w + 0.12 + br() * 0.3;
        }
        run--;
      }
    }
    // The bays: uprights between them, and near the walk a pilaster on each —
    // a face board with a base and a capital, reeded in the rooms themselves —
    // so a wall of books is a piece of joinery and not a plane of spines.
    const capY = detail >= 1 ? FRIEZE_Y - 2.2 : yTop - 1.6;
    for (const u of bayEnds) {
      LB.shelf.add(placed(new THREE.BoxGeometry(2.6, yTop - yBottom, 12), on(u, 6), yBottom + (yTop - yBottom) / 2, turn));
      LB.shelf.add(placed(new THREE.BoxGeometry(4, 2.2, 13.4), on(u, 6.7), capY, turn));
      if (detail >= 1) {
        const lo = yBottom + (from === 0 ? 0 : 0.5), hi = capY - 1.1;
        LB.shelf.add(placed(new THREE.BoxGeometry(3.6, hi - lo, 0.7), on(u, 12.35), (lo + hi) / 2, turn));
        LB.shelf.add(placed(new THREE.BoxGeometry(4.4, 4.2, 1.3), on(u, 12.65), lo + 2.1, turn));
        LB.shelf.add(placed(new THREE.BoxGeometry(4.6, 1, 1.6), on(u, 12.8), capY - 0.6, turn));
        if (detail >= 2) {
          for (const dx of [-1.05, 0, 1.05]) {
            LB.shelf.add(placed(new THREE.BoxGeometry(0.42, hi - lo - 8, 0.34), on(u + dx, 12.87), (lo + 4.2 + hi - 3.8) / 2, turn));
          }
        }
      }
    }
    // A plinth on the floor — with a ledge at hand height to lay a book open on,
    // and a raised panel in each bay — and a stepped cornice along the top.
    //
    // One top at the height the books stand on, never two or three. The
    // lowest shelf board, the plinth and the ledge all used to end level
    // there, and since each piece of wood took its own stretch of grain the
    // three fought for every pixel of it: streaks of one board's figure and
    // another's that reshuffled with every step. So the lowest tier has no
    // board (the plinth is its shelf; 2.4 tall at least, so it holds all the
    // board did), and under a ledge the plinth stops at the ledge's foot.
    const ledge = detail >= 1 && from === 0;
    const plinthH = yBottom > 12 ? 2.4 : ledge ? 3.2 : 4;
    LB.shelf.add(boxGeo(on(s0 - 1.5, 7), on(s1 + 1.5, 7), plinthH, 14, yBottom - (yBottom > 12 ? 2.4 : 4)));
    if (ledge) {
      LB.shelf.add(boxGeo(on(s0 - 2, 7.7), on(s1 + 2, 7.7), 0.8, 15.4, yBottom - 0.8));
      if (detail >= 2) {
        for (let i = 0; i < 3; i++) LB.shelf.add(boxGeo(on(bayEnds[i] + 2.6, 14.15), on(bayEnds[i + 1] - 2.6, 14.15), 1.9, 0.3, 6.85));
      }
    }
    // The frieze: a board over the top shelf with a gilt key along it, a
    // numbered plate over the middle of each bay, dentils under the cornice.
    if (detail >= 1) {
      LB.frieze.add(boxGeo(on(s0 - 2, 12.6), on(s1 + 2, 12.6), yTop - FRIEZE_Y, 1.2, FRIEZE_Y));
      if (detail >= 2) {
        for (let i = 0; i < 3; i++) {
          LB.plate.add(placed(plateGeo(i), on((bayEnds[i] + bayEnds[i + 1]) / 2, 13.3), (FRIEZE_Y + yTop) / 2, turn));
        }
        for (let u = s0 - 1; u <= s1 + 1; u += 1.9) LB.shelf.add(placed(new THREE.BoxGeometry(0.9, 1.3, 0.8), on(u, 15.2), yTop + 0.75, turn));
      }
    }
    LB.shelf.add(boxGeo(on(s0 - 2, 7.4), on(s1 + 2, 7.4), 2, 14.8, yTop));
    LB.shelf.add(boxGeo(on(s0 - 3, 8.4), on(s1 + 3, 8.4), 2.4, 16.8, yTop + 2));
    // Over the dentils, in the face of the cornice, the wall's number in gilt
    // capitals: the first of `words` that goes at a readable size, centred on
    // the wall and read left to right from the room.
    if (detail >= 2 && words) {
      const track = 0.14, space = 0.5;
      const span = (s) => [...s].reduce((w, ch) => w + (ch === ' ' ? space : gilt.glyphs[ch].adv + track), -track);
      const fits = s1 - s0 - 6;
      const text = words.find((s) => span(s) * 1.1 <= fits) ?? words[words.length - 1];
      const cap = Math.min(1.5, fits / span(text));
      const right = [inward[1], -inward[0]], spin = Math.atan2(inward[0], inward[1]);
      const mid = on((s0 + s1) / 2, 16.85);
      let x = -span(text) / 2;
      for (const ch of text) {
        if (ch === ' ') { x += space; continue; }
        const G = gilt.glyphs[ch];
        const g = new THREE.PlaneGeometry(gilt.cellW * cap, gilt.cellH * cap);
        const uv = g.attributes.uv;
        for (let v = 0; v < uv.count; v++) uv.setXY(v, (G.col + uv.getX(v)) / gilt.cols, 1 - (G.row + 1 - uv.getY(v)) / gilt.rows);
        const p = add(mid, right, (x + G.adv / 2) * cap);
        LB.letters.add(g.rotateY(spin).translate(p[0], yTop + 3.2, p[1]));
        x += G.adv + track;
      }
    }
    if (detail >= 2) {
      // A leather dust-flap under the front of every shelf, bay by bay: a warm
      // scalloped line of shadow that reads from across the room.
      for (let tier = Math.max(1, from); tier <= to; tier++) {
        const y = TIER_BASE + tier * TIER_H - 2.4;
        for (let i = 0; i < 3; i++) {
          const ua = bayEnds[i] + 1.9, ub = bayEnds[i + 1] - 1.9, L = ub - ua;
          const g = new THREE.PlaneGeometry(L, 1.3);
          const uv = g.attributes.uv;
          for (let v = 0; v < uv.count; v++) uv.setX(v, (uv.getX(v) * L) / 2.4);
          g.rotateY(Math.atan2(inward[0], inward[1]));
          const q = on((ua + ub) / 2, 12.08);
          LB.scallop.add(g.translate(q[0], y - 0.65, q[1]));
        }
      }
      for (let tier = Math.max(1, from); tier <= to; tier++) {
        const y = TIER_BASE + tier * TIER_H;
        for (let i = 0; i < 3; i++) {
          const ua = bayEnds[i], ub = bayEnds[i + 1], L = ub - ua;
          if (dust) {
            // dust lying along the front of the shelf, in front of the books
            LB.dust.add(boxGeo(on(ua + 1.4, 11.55), on(ub - 1.4, 11.55), 0.06, 0.8, y));
          } else {
            // the front edge rubbed paler at the middle of the bay, where
            // books have gone in and out
            LB.shelfWorn.add(boxGeo(on(ua + L * 0.18, 11.8), on(ub - L * 0.18, 11.8), 0.3, 0.52, y - 0.3));
          }
        }
      }
      // where the case stands on the floor, a soft dark line
      if (from === 0) {
        const g = new THREE.PlaneGeometry(s1 - s0 + 5, 3.6);
        const uv = g.attributes.uv;
        g.setAttribute('uv1', new THREE.BufferAttribute(Float32Array.from({ length: uv.count * 2 }, (_, i) => (i % 2 ? 1 - uv.array[i] : uv.array[i])), 2));
        g.rotateX(-Math.PI / 2).rotateY(face);
        const q = on((s0 + s1) / 2, 15.8);
        LB.contact.add(g.translate(q[0], 6.14, q[1]));
      }
      // The lamp-rail: a bronze rod under the frieze on little arms, a line of
      // light along its underside washing down the top shelves (the wash is
      // in the books' own shader — see makeBookMaterial).
      if (graze > 0) {
        const r0 = on(s0, 14.4), r1 = on(s1, 14.4);
        LB.bronze.add(rodGeo([r0[0], FRIEZE_Y - 0.9, r0[1]], [r1[0], FRIEZE_Y - 0.9, r1[1]], 0.34));
        LB.railGlow.add(boxGeo(on(s0 + 0.5, 14.4), on(s1 - 0.5, 14.4), 0.22, 0.4, FRIEZE_Y - 1.5));
        for (const u of bayEnds.slice(0, 3).map((e, i) => (e + bayEnds[i + 1]) / 2)) {
          LB.bronze.add(placed(new THREE.BoxGeometry(0.4, 0.4, 1.6), on(u, 13.6), FRIEZE_Y - 0.9, turn));
        }
      }
    }
    // a brass rail for a ladder, along the full walls
    if (from === 0) {
      const ry = TIER_BASE + 2 * TIER_H + 7;
      const r0 = add(add(a, t, s0), inward, 14), r1 = add(add(a, t, s1), inward, 14);
      LB.bronze.add(rodGeo([r0[0], ry, r0[1]], [r1[0], ry, r1[1]], 0.45));
      for (const u of [s0 + 2, (s0 + s1) / 2, s1 - 2]) {
        const q = add(add(a, t, u), inward, 13);
        LB.bronze.add(placed(new THREE.BoxGeometry(0.8, 0.8, 3), q, ry, turn));
      }
    }
  };

  yield 'Furniture';
  // ── Furniture ─────────────────────────────────────────────────────────────
  // What gives a person's scale back to a room whose every wall is eleven
  // metres of books: a gallery overhead that you are not on, a ladder left
  // where the last reader stood it, and one corner somebody was reading in.
  // Most of what filled a frame stood three to twelve metres up; these are
  // at the height the eye actually lives at. None of it draws on the world's
  // random stream (placing a chair must not move the garden).
  const alongWall = (c, k) => {
    const e = edgeFrame(c, k), inward = [-e.n[0], -e.n[1]];
    const on = (u, z) => add(add(e.mi, e.t, u), inward, z);
    return { e, inward, on, at3: (u, z, y) => { const q = on(u, z); return [q[0], y, q[1]]; }, turn: -Math.atan2(e.t[1], e.t[0]) };
  };
  // An iron walk along the tier-3 shelf: a deck on brackets, a bronze fascia,
  // bars and a handrail. The room reads as tall because it has a floor in it
  // that nobody is standing on.
  const GALLERY_Y = TIER_BASE + 3 * TIER_H;
  const gallery = (c, k) => {
    const { on, at3, turn } = alongWall(c, k);
    const u0 = -R / 2 + 11, u1 = R / 2 - 11, Y = GALLERY_Y;
    LB.iron.add(boxGeo(on(u0, 15.4), on(u1, 15.4), 1.1, 6.8, Y - 1.1));
    LB.bronzeDim.add(boxGeo(on(u0, 18.95), on(u1, 18.95), 1.5, 0.35, Y - 1.35));
    for (let i = 0; i <= 3; i++) {
      const u = -R / 2 + 12 + (i * (R - 24)) / 3;
      LB.iron.add(rodGeo(at3(u, 12.9, Y - 10), at3(u, 18.4, Y - 1.2), 0.42));
      LB.iron.add(boxGeo(on(u - 0.3, 15.6), on(u + 0.3, 15.6), 1.2, 6.2, Y - 2.3));
    }
    LB.bronze.add(rodGeo(at3(u0, 18.5, Y + 9.6), at3(u1, 18.5, Y + 9.6), 0.42));
    LB.iron.add(rodGeo(at3(u0, 18.5, Y + 1.1), at3(u1, 18.5, Y + 1.1), 0.3));
    for (let u = u0 + 1.2; u < u1 - 0.6; u += 2.3) LB.iron.add(placed(new THREE.BoxGeometry(0.26, 8.5, 0.26), on(u, 18.5), Y + 5.35, turn));
    for (const u of [u0, u1]) LB.iron.add(placed(new THREE.BoxGeometry(1, 10.4, 1), on(u, 18.5), Y + 5.2, turn));
  };
  // A library ladder hooked over the brass rail every full wall carries.
  const ladder = (c, k, u) => {
    const { e, inward, on, turn } = alongWall(c, k);
    const ry = TIER_BASE + 2 * TIER_H + 7;
    const top = 14.7, foot = 26.5, rise = ry + 0.4 - 6, run = foot - top;
    const L = Math.hypot(rise, run), tilt = Math.atan2(run, rise);
    const parts = [];
    for (const sx of [-3.1, 3.1]) parts.push(new THREE.BoxGeometry(0.8, L, 0.55).translate(sx, L / 2, 0));
    for (let y = 3.6; y < L - 1.5; y += 4.3) parts.push(new THREE.CylinderGeometry(0.28, 0.28, 6.2, 8).rotateZ(Math.PI / 2).translate(0, y, 0));
    const g = mergeGeometries(parts);
    parts.forEach((x) => x.dispose());
    g.rotateX(-tilt);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(e.t[0], 0, e.t[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(inward[0], 0, inward[1])));
    const f = on(u, foot);
    LB.oak.add(g.translate(f[0], 6, f[1]));
    for (const sx of [-3.1, 3.1]) LB.bronze.add(placed(new THREE.BoxGeometry(1, 1.3, 1.8), on(u + sx, top), ry + 0.3, turn));
  };
  // A turned part: a lathe profile ([radius, height] from the end at `a`, the
  // heights in any units: they are spread over the length) set on the line
  // from a to b.
  const turned = (prof, a, b, segs = 10) => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const L = d.length(), top = prof[prof.length - 1][1];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, (y / top) * L)), segs);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.divideScalar(L)));
    return g.translate(a[0], a[1], a[2]);
  };
  // A bow-back Windsor, the chair a reading room actually had: a thick
  // rounded seat, four splayed legs turned with a ring where an H of turned
  // stretchers enters them, and a bent hoop raked back over seven spindles.
  // (It was a box on four sticks with a ladder of two rails for a back, and
  // a hand's breadth taller than a chair.) Built facing -z, the way the old
  // one sat; a unit is 9.4 cm, so the seat is at 45 cm and the hoop at 95.
  const windsorChair = () => {
    const SEAT = 4.8, parts = [];
    // The seat: a D, straight sides and front and a round back, its edge
    // rounded over by the bevel (which adds 0.1 all round, so it is drawn
    // 0.1 in). Smoothed whole, so the rounding has no facets.
    const half = (z) => z >= -0.2 ? 2.2 - Math.max(0, 0.35 - Math.sqrt(Math.max(0, 0.35 ** 2 - Math.max(0, z - 1.6) ** 2))) : 2.2 * Math.sqrt(Math.max(0, 1 - ((z + 0.2) / 1.85) ** 2));
    const outline = [];
    for (let i = 0; i <= 24; i++) { const z = -2.05 + 4.0 * (1 - Math.cos((Math.PI * i) / 24)) / 2; outline.push(new THREE.Vector2(half(z), -z)); }
    for (let i = 23; i >= 1; i--) { const z = -2.05 + 4.0 * (1 - Math.cos((Math.PI * i) / 24)) / 2; outline.push(new THREE.Vector2(-half(z), -z)); }
    let seat = new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: 0.26, bevelEnabled: true, bevelThickness: 0.11, bevelSize: 0.1, bevelSegments: 3, curveSegments: 1 });
    seat.rotateX(-Math.PI / 2).translate(0, SEAT - 0.37, 0);
    seat.deleteAttribute('uv');
    seat.deleteAttribute('normal');
    seat = mergeVertices(seat);
    seat.computeVertexNormals();
    parts.push(seat);
    // the legs, splayed out to the side and raked: the back pair more
    const LEG = [[0, 0], [0.15, 0], [0.17, 0.3], [0.2, 1.1], [0.235, 1.45], [0.19, 1.6], [0.24, 1.7], [0.19, 1.8], [0.22, 2.2], [0.27, 2.85], [0.25, 3.25], [0.19, 3.75], [0.16, 4], [0.2, 4.15], [0.16, 4.3], [0.15, 4.75], [0, 4.75]];
    const RING = 1.7 / 4.75;
    const legAt = (sx, front) => ({ a: [sx * 2.2, 0, front ? 1.95 : -1.85], b: [sx * 1.62, 4.62, front ? 1.3 : -1.05] });
    const at = ({ a, b }, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const STRETCHER = [[0, 0], [0.11, 0], [0.13, 0.2], [0.17, 0.5], [0.13, 0.8], [0.11, 1], [0, 1]];
    const mids = [];
    for (const sx of [-1, 1]) {
      const f = legAt(sx, true), r = legAt(sx, false);
      parts.push(turned(LEG, f.a, f.b), turned(LEG, r.a, r.b));
      const p = at(f, RING), q = at(r, RING);
      parts.push(turned(STRETCHER, p, q, 8));
      mids.push([(p[0] + q[0]) / 2, p[1] + 0.05, (p[2] + q[2]) / 2]);
    }
    parts.push(turned([[0, 0], [0.12, 0], [0.14, 0.2], [0.18, 0.5], [0.14, 0.8], [0.12, 1], [0, 1]], mids[0], mids[1], 8));
    // The hoop: up from the seat's back corners, round over the top, raked
    // back 10° and following the round of the seat's back in plan. The
    // spindles stand on the same round, 0.45 in from the edge.
    const RAKE = 0.18;
    const plan = (x) => -0.2 - 1.85 * Math.sqrt(Math.max(0, 1 - (x / 2.3) ** 2)) + 0.45;
    const HOOP = [[1.92, 4.45], [1.95, 4.75], [2.08, 6], [2.05, 7.3], [1.82, 8.5], [1.3, 9.45], [0.68, 9.92], [0, 10.05]];
    const pts = [...HOOP.map(([x, h]) => [-x, h]), ...HOOP.slice(0, -1).reverse()]
      .map(([x, h]) => new THREE.Vector3(x, h, plan(x) - RAKE * (h - SEAT)));
    const hoop = new THREE.CatmullRomCurve3(pts);
    parts.push(new THREE.TubeGeometry(hoop, 72, 0.15, 8, false));
    const along = hoop.getSpacedPoints(400).filter((p) => p.y > 8.6);
    const SPINDLE = [[0, 0], [0.085, 0], [0.105, 0.22], [0.1, 0.42], [0.075, 0.8], [0.07, 1], [0, 1]];
    for (const x of [-1.32, -0.88, -0.44, 0, 0.44, 0.88, 1.32]) {
      const top = along.reduce((best, p) => (Math.abs(p.x - x * 1.08) < Math.abs(best.x - x * 1.08) ? p : best));
      const foot = [x, SEAT - 0.18, plan(x)];
      const d = [top.x - foot[0], top.y - foot[1], top.z - foot[2]], l = Math.hypot(...d);
      parts.push(turned(SPINDLE, foot, [top.x + (d[0] / l) * 0.08, top.y + (d[1] / l) * 0.08, top.z + (d[2] / l) * 0.08], 8));
    }
    return parts.map((g) => g.rotateY(Math.PI));
  };
  // A table against the cases with its lamp, an open book, a closed one with
  // a smaller one on it, a stack on the floor by the leg and the chair pushed
  // back from it. `lit`: in the Silence the lamp is out and the chair was
  // left turned away.
  //
  // The books are the size of books a person reads at a table: folios of
  // 35-46 cm. (They were drawn at the shelves' size, and the shelves are
  // eleven metres of giants: the shut one was 80 cm long, the stack on the
  // floor was a metre wide and stood higher than the table, and it stood
  // round the table's leg.)
  const readingCorner = (c, k, u0, { lit = true } = {}) => {
    const { on, turn } = alongWall(c, k);
    const TOP = 6 + 7.6, Z = 22;
    LB.shelf.add(placed(new THREE.BoxGeometry(15, 0.7, 7.2), on(u0, Z), TOP - 0.35, turn));
    LB.shelf.add(placed(new THREE.BoxGeometry(13.6, 1.3, 6), on(u0, Z), TOP - 1.35, turn));
    // the legs: square where the apron is tenoned into them, then turned — a
    // collar, a long vase, a ring at the ankle and a bun foot
    const TLEG = [[0, 0], [0.24, 0], [0.31, 0.1], [0.33, 0.28], [0.26, 0.48], [0.19, 0.62], [0.23, 0.72], [0.19, 0.84], [0.21, 1.5], [0.29, 2.9], [0.34, 3.8], [0.3, 4.4], [0.22, 4.75], [0.31, 4.93], [0.33, 5.1], [0.27, 5.28], [0.3, 5.6], [0, 5.6]];
    const KNEE = TOP - 2;
    for (const [du, dz] of [[-6.4, -2.6], [6.4, -2.6], [-6.4, 2.6], [6.4, 2.6]]) {
      const q = on(u0 + du, Z + dz);
      LB.shelf.add(turned(TLEG, [q[0], 6, q[1]], [q[0], KNEE, q[1]], 12));
      LB.shelf.add(placed(new THREE.BoxGeometry(0.9, TOP - 0.7 - KNEE, 0.9), q, (KNEE + TOP - 0.7) / 2, turn));
    }
    // the lamp: a brass foot and stem, and an amber shade with the bulb
    // glowing through it — light at the height of a reader's hands, which
    // nothing else in the Library gave. A desk lamp's size, 50 cm with a 36 cm
    // shade: once the books were cut to the size of books it had become the
    // biggest thing on the table.
    const lp = on(u0 + 5, Z - 1.5);
    LB.bronze.add(placed(new THREE.CylinderGeometry(1.05, 1.25, 0.32, 18), lp, TOP + 0.16));
    LB.bronze.add(placed(new THREE.CylinderGeometry(0.15, 0.15, 4.3, 8), lp, TOP + 2.45));
    (lit ? LB.shade : LB.shadeDead).add(placed(new THREE.CylinderGeometry(0.85, 1.9, 1.8, 22, 1, true), lp, TOP + 4.65));
    if (lit) {
      glows.push({ p: [lp[0], TOP + 4.2, lp[1]], s: [0.55, 0.55, 0.55], color: '#ffd9a0', k: 1.25 });
      decal(lp, 8, 8, '#ffb060', 0.35 * POOL_DIAL, TOP + 0.04);
      // On the floor itself (its dark band is 6.1), not at 6.6 with the
      // room's pools: a sheet of added light 6 cm up the legs drew a pale
      // sock round the foot of every leg in the corner.
      decal(on(u0, Z + 5), 46, 46, '#ffb060', 0.1 * POOL_DIAL, 6.15, 0, [lp[0], TOP + 4.2, lp[1], 0.4]);
      // The bulb a light of its own, low: the pool hands it a light only
      // when the reader is at the table (lampPass.js)
      if (LAMPS.corner) point(lp, TOP + 4.2, '#ffc58a', 520, -1);
    }
    // the open book, a folio: leather boards, and the two halves of the text
    // block lifting toward the spine
    const bp = on(u0 - 3.6, Z + 0.8), bt = turn + 0.14;
    LB.leather.add(placed(new THREE.BoxGeometry(6, 0.14, 4.2), bp, TOP + 0.07, bt));
    for (const side of [-1, 1]) {
      LB.paper.add(placed(new THREE.BoxGeometry(2.8, 0.34, 3.95).translate(side * 1.45, 0.17, 0).rotateZ(-side * 0.06), bp, TOP + 0.14, bt));
    }
    const shut = on(u0 + 1.3, Z - 1.6), onIt = on(u0 + 1.45, Z - 1.75);
    books.push({ p: [shut[0], TOP + 0.35, shut[1]], rot: [0, turn + 0.25, 0], s: [3.9, 0.7, 2.8], color: '#5a2923', k: 1, spine: LAID + SPINE_KINDS.label[0] + 3 });
    books.push({ p: [onIt[0], TOP + 0.7 + 0.22, onIt[1]], rot: [0, turn - 0.05, 0], s: [3.2, 0.44, 2.3], color: '#2d3a2b', k: 1, spine: LAID + SPINE_KINDS.label[0] + 7 });
    // the stack, clear of the leg (at u0 + 6.4) by a hand: each book a
    // little off the one under it
    let lie = 6;
    [[4.9, 0.85, 3.6, '#6f4c31'], [4.5, 0.62, 3.3, '#2d3a2b'], [4.7, 0.9, 3.4, '#221d19'], [4.1, 0.55, 3, '#a89a7b'], [4.3, 0.7, 3.1, '#5a2923'], [3.6, 0.5, 2.6, '#4a3a28']].forEach(([w, th, dp, color], i) => {
      const q = on(u0 + 10.2 + [0, 0.12, -0.1, 0.15, 0, -0.12][i], Z - 0.8 + [0, -0.1, 0.12, 0, -0.15, 0.08][i]);
      books.push({ p: [q[0], lie + th / 2, q[1]], rot: [0, turn + [0.05, -0.1, 0.16, -0.06, 0.22, -0.14][i], 0], s: [w, th, dp], color, k: 1, spine: LAID + SPINE_KINDS.label[0] + i * 3 });
      lie += th;
    });
    // the chair
    const cp = on(u0 - 3.5, Z + 8), ct = turn + (lit ? 0.35 : 1.1);
    for (const g of windsorChair()) LB.shelf.add(placed(g, cp, 6, ct));
  };
  // A reader standing far off in a gallery the walk only looks into. They
  // were a robe turned on a lathe — a profile spun round an axis, wide at the
  // hem and pointed at the hood — and from anywhere near that was a pawn, the
  // same from every side, with no shoulders and no arms. They are the walking
  // readers' own figure now (readers.js), cut coarser than a near one needs
  // and all gathered into one mesh once the galleries are built (below).
  const distantReaders = [];
  const figure = (p, y) => {
    distantReaders.push({ p, y, ry: rr(0, Math.PI * 2) });
  };
  // A glass sphere lamp hung on a chain from above the walls: a hot core, a
  // glass shell, a halo, and — for the lamps that matter — a real light.
  const LAMP_Y = 66;
  // `beam`: the cone of lit air to the floor under it (not for a lamp hung in the Vertigo's well).
  // `out`: a lamp that has gone out — the fitting, the chain and the cold glass,
  // and nothing else. "Where the lamps grow faint" needs lamps that ARE faint,
  // not one lamp turned down.
  // `haze`: how much halo it is allowed. A lamp's halo is a sprite drawn with
  // depthTest OFF so it can lie over the stone it lights; within about sixty
  // units of where a reader stands that becomes a hundred-unit disc of light in
  // FRONT of the room, and the gallery goes milky. Lamps near a stand turn it down.
  const lamp = (p, { y = LAMP_Y, light: power = 0, priority = 0, color = '#ffb466', strength = 1, pool = 0.3, poolSize = 200, poolY = 6.6, poolAt = p, r = 9, beam = true, out = false, haze = 1, chain = Infinity, link = 1 } = {}) => {
    // One opal globe, the size the bright core used to be. There is no clear
    // shell round it any more: a lit globe is the light (makeLampGlobeMaterial),
    // a dead one is the same globe in cold, dull glass.
    const G = r * 0.55;
    (out ? deadGlobes : globes).push({ p: [p[0], y, p[1]], s: [G, G, G], ...(out ? {} : { color: '#fff3e2', k: 0.45 + strength * 0.5 }) });
    // The fitting sits ON the globe, outside it: a collar gripping its neck, a
    // bead of rim where the glass goes in, a cap, and a loop for the chain; a
    // small drop finishes the bottom of the glass.
    LB.bronze.add(placed(new THREE.CylinderGeometry(G * 0.34, G * 0.46, G * 0.26, 24), p, y + G * 0.99));
    LB.bronze.add(placed(new THREE.TorusGeometry(G * 0.47, G * 0.045, 8, 32).rotateX(Math.PI / 2), p, y + G * 0.87));
    LB.bronze.add(placed(new THREE.CylinderGeometry(G * 0.1, G * 0.34, G * 0.2, 20), p, y + G * 1.22));
    LB.bronze.add(placed(new THREE.TorusGeometry(G * 0.13, G * 0.035, 6, 16), p, y + G * 1.45));
    LB.bronze.add(placed(new THREE.ConeGeometry(G * 0.09, G * 0.3, 12).rotateX(Math.PI), p, y - G * 1.1));
    // `chain`: how far up the links are drawn before the dark is left to say
    // the rest. A lamp in a gallery hangs from the top of the wall and its
    // whole chain is part of the room. A lamp hung in the Vertigo's well hangs
    // four hundred units down, and drawing every link of that put a black cable
    // from the top of the frame to the bottom across the one thing the room is
    // for — the look down the funnel. The chain still rises out of the light;
    // it just stops being drawn once there is nothing left to light it.
    const chainTop = Math.min(MASS_H + 40, y + G * 1.58 + chain);
    for (let cy = y + G * 1.58, k = 0; cy < chainTop; cy += 1.55 * link, k++) {
      links.push({ p: [p[0], cy, p[1]], rot: [0, k % 2 ? Math.PI / 2 : 0, 0], s: [link, link, link] });
    }
    if (out) return;
    // the cone of lit air beneath it
    if (beam && (power || strength >= 1)) {
      const h = y - r - 6, foot = Math.min(poolSize * 0.3, 62);
      LB.shafts.add(shaftVolume(
        new THREE.CylinderGeometry(r * 0.7, foot, h, 28, 1, true).translate(p[0], 6 + h / 2, p[1]),
        [p[0], 6, p[1]], foot, [p[0], 6 + h, p[1]], r * 0.7,
      ));
    }
    halo(p, y, r * 11 * (0.6 + strength * 0.4) * Math.sqrt(haze), '#ffc27a', (0.08 + strength * 0.52) * haze, lampHaloTex);
    // Every lamp may light its room; which ones do, at a given moment, is the
    // light pool's business (see updateLights).
    point(p, y - 4, color, power || 2400 * strength, power ? priority : -1);
    // (`poolAt`: where it falls is a floor that stops short of under the lamp)
    if (pool) decal(poolAt, poolSize, poolSize, '#ffb060', pool * POOL_DIAL, poolY, 0.1, [p[0], y, p[1], G]);
  };

  // ── Light from far down the Vestibule's well ─────────────────────────────
  // From the stand, under the bridge, the well was a flat black slab beside
  // it: nothing said it went down. Now its walls are lit from somewhere far
  // below, warmly and faintly — none at the lip, more the further down the
  // eye goes — so the dark under the bridge reads as depth (review
  // 2026-10-08, point 7; ?wvest=old:7). A sheet of lit air laid just inside
  // the liner, as the light columns are: no lamp, nothing to cost.
  const wellGlowMat = keep(new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ff9d58') }, uStrength: { value: 0.24 } },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vY = w.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying float vY;
      void main() {
        // nothing at the lip, and more the further down: from the stand the
        // eye only reaches the top thirty or forty units of it, under the bridge
        float t = clamp((3.0 - vY) / 110.0, 0.0, 1.0);
        gl_FragColor = vec4(uColor * uStrength * pow(t, 0.7), 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  }));
  const wellGlow = (c, shaft) => {
    const ring = hexPts(c, shaft - 0.25), pos = [];
    const TOP = 3, BOT = -228;
    for (let k = 0; k < ring.length; k++) {
      const [ax0, az0] = ring[k], [bx0, bz0] = ring[(k + 1) % ring.length];
      pos.push(ax0, TOP, az0, bx0, TOP, bz0, bx0, BOT, bz0, ax0, TOP, az0, bx0, BOT, bz0, ax0, BOT, az0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(keep(g), wellGlowMat);
    m.name = 'well-glow';
    m.renderOrder = 2;
    root.add(m);
  };

  const mounts = [];
  const hangPainting = (index, [x, z], y, normal, width) => {
    if (!paintings) return;
    const height = width / (3376 / 1440);
    const angle = Math.atan2(normal[0], normal[1]);
    const frameGeo = new THREE.BoxGeometry(width + 5, height + 5, 2.2);
    frameGeo.rotateY(angle);
    frameGeo.translate(x, y, z);
    LB.frame.add(frameGeo);
    const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
    const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
    plane.position.set(x + normal[0] * 1.25, y, z + normal[1] * 1.25);
    plane.rotation.y = angle;
    root.add(plane);
    mounts[index] = { center: [x + normal[0] * 1.25, y, z + normal[1] * 1.25], normal, width, height, material: mat };
  };

  // An arch over a hallway: fills the opening above the arch through the
  // thickness of the stone, with a cap on top.
  const archGeoOf = (len) => {
    const s = new THREE.Shape();
    s.moveTo(-HALL / 2, MASS_H);
    s.lineTo(HALL / 2, MASS_H);
    s.lineTo(HALL / 2, ARCH_SPRING);
    s.absarc(0, ARCH_SPRING, ARCH_R, 0, Math.PI, false);
    s.lineTo(-HALL / 2, MASS_H);
    const g = new THREE.ExtrudeGeometry(s, { depth: len + 0.2, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -(len + 0.2) / 2);
    return g;
  };
  const archGeo = archGeoOf(GAP);
  // Dressed stone on each face of the opening: an archivolt, a keystone, and a
  // pilaster up each jamb — a hole cut in a wall reads as a hole.
  // `cut`: how much shorter the hallway is at its -n and +n ends, where the
  // room there (the Echo) stands further out into its walls.
  const archivoltGeo = keep(new THREE.TorusGeometry(ARCH_R + 1.6, 1.6, 8, 28, Math.PI));
  // The ring as it would be built: thirteen voussoirs, each cut to the
  // arch's centre, the keystone longer and standing out further,
  // set a little proud of the wall on a bed of mortar that shows in their
  // joints. (It was a smooth round moulding with a box for a keystone; with
  // the wall's blocks a torso high every face of every arch looked the same —
  // review 2026-10-08, point 5; ?wvest=old:5 puts the moulding back.) Built in
  // the arch's own frame, x across, y up, z out of the face: `z0`..`z1`.
  const VOUSSOIRS = 13, V_DEEP = 3.4, V_JOINT = 0.012;
  const ringBlock = (a0, a1, ri, ro, z0, z1) => {
    const at = (a, r) => [Math.cos(a) * r, ARCH_SPRING + Math.sin(a) * r];
    const sh = new THREE.Shape();
    const p = [at(a0, ri), at(a1, ri), at(a1, ro), at(a0, ro)];
    sh.moveTo(...p[0]);
    p.slice(1).forEach((q) => sh.lineTo(...q));
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
    return g.translate(0, 0, z0);
  };
  const voussoirsGeo = (zFace) => {
    const stones = [], beds = [];
    for (let k = 0; k < VOUSSOIRS; k++) {
      const key = k === (VOUSSOIRS - 1) / 2;
      const a0 = (Math.PI * k) / VOUSSOIRS, a1 = (Math.PI * (k + 1)) / VOUSSOIRS;
      // the stone, a hair under the soffit (never in its plane) and clear of its neighbours
      stones.push(ringBlock(a0 + V_JOINT, a1 - V_JOINT, ARCH_R - 0.06, ARCH_R + (key ? V_DEEP + 1.3 : V_DEEP), zFace - 0.05, zFace + (key ? 0.95 : 0.6)));
      // and the mortar behind it, set back from its face, filling its joints
      // (a piece to each stone: cut by the quarter, its straight edges were
      // two dark beams across the opening)
      beds.push(ringBlock(a0, a1, ARCH_R - 0.03, ARCH_R + V_DEEP - 0.1, zFace - 0.05, zFace + 0.42));
    }
    return { stone: mergeGeometries(stones, false), mortar: mergeGeometries(beds, false), parts: [...stones, ...beds] };
  };
  const arch = (mid0, n, uvAt = null, cut = [0, 0]) => {
    const turn = Math.atan2(n[0], n[1]);
    const len = GAP - cut[0] - cut[1], mid = add(mid0, n, (cut[0] - cut[1]) / 2);
    const g = len === GAP ? archGeo.clone() : archGeoOf(len);
    g.rotateY(turn);
    g.translate(mid[0], 0, mid[1]);
    LB.mass.add(g, uvAt);
    LB.cap.add(boxGeo(add(mid, n, -len / 2), add(mid, n, len / 2), CAP, HALL, MASS_H), uvAt);
    const across = [n[1], -n[0]];
    for (const side of [-1, 1]) {
      const face = add(mid, n, side * (len / 2 + 0.7));
      if (vestOld(5)) {
        LB.cap.add(archivoltGeo.clone().rotateY(turn).translate(face[0], ARCH_SPRING, face[1]), uvAt);
        LB.cap.add(new THREE.BoxGeometry(4.2, 6, 3.4).rotateY(turn).translate(face[0], ARCH_SPRING + ARCH_R + 2.4, face[1]), uvAt);
      } else {
        // (on the -n face the ring is built facing +z and turned round to it)
        const { stone, mortar, parts } = voussoirsGeo(len / 2 + 0.1);
        for (const [batch, g] of [[LB.cap, stone], [LB.joint, mortar]]) {
          if (side < 0) g.rotateY(Math.PI);
          batch.add(g.rotateY(turn).translate(mid[0], 0, mid[1]), uvAt);
        }
        parts.forEach((g) => g.dispose());
      }
      for (const s of [-1, 1]) {
        const j = add(face, across, s * (HALL / 2 + 1.6));
        LB.cap.add(new THREE.BoxGeometry(3.2, ARCH_SPRING - 6, 1.8).rotateY(turn).translate(j[0], 6 + (ARCH_SPRING - 6) / 2, j[1]), uvAt);
        LB.cap.add(new THREE.BoxGeometry(4.4, 2, 2.6).rotateY(turn).translate(j[0], ARCH_SPRING - 1, j[1]), uvAt);
      }
    }
  };

  // A stone balustrade along the rim of a gallery, on top of its walls: posts
  // and a rail, broken where a hallway or a fallen wall opens.
  const RAIL_H = 10;
  const railRun = (a, b) => {
    const len = dist(a, b);
    if (len < 6) return;
    const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    for (let u = 3; u <= len - 3; u += 8) {
      const p = add(a, t, u);
      posts.push({ p: [p[0], MASS_H + CAP + RAIL_H / 2, p[1]], s: [2, RAIL_H, 2] });
    }
    LB.rail.add(boxGeo(a, b, 2, 3.4, MASS_H + CAP + RAIL_H));
  };
  const balustrade = (cell, halls) => {
    for (let k = 0; k < 6; k++) {
      const e = edgeFrame(cell.c, k);
      const a = add(e.i0, e.n, 3.5), b = add(e.i1, e.n, 3.5);
      const rim = rimAt(cell.c);
      const opening = halls.includes(k)
        ? [0.5 - (HALL + 8) / (2 * rim), 0.5 + (HALL + 8) / (2 * rim)]
        : null;
      if (opening) {
        railRun(a, lerp2(a, b, opening[0]));
        railRun(lerp2(a, b, opening[1]), b);
      } else {
        railRun(a, b);
      }
    }
  };

  for (const cell of cells) {
    if (cell.garden || cell.k === '3,-3') continue;
    const { c } = cell;
    const room = cell.room;
    const lit = room !== undefined;
    const framed = inFrame(c);
    const near = Math.exp(-((routeDist(c) / 430) ** 2));
    const shaft = room === 0 ? 48 : room === 4 ? 0 : room === 2 ? 40 : room === 1 ? 38 : 36;
    const halls = [0, 1, 2, 3, 4, 5].filter((k) => hallway(cell, k));
    // The hallways, and the wall the Door has lost into the garden.
    const gaps = (k) => [
      ...(halls.includes(k) ? [[-HALL / 2, HALL / 2]] : []),
      ...(cell.k === '4,-4' && k === 5 ? [[(0.27 - 0.5) * R, (0.76 - 0.5) * R]] : []),
    ];
    // The hole half a unit wider than the shaft, so the slab's cut edge is
    // buried inside the well's liner (below). Cut at `shaft` itself, it stood
    // in the very plane of the liner's face for the slab's whole depth, and
    // the two fought for every pixel of the band under the rail's plinth:
    // stripes of stone and dark that reshuffled with every step.
    LB.floor.add(slabGeo(hexPts(c, RC), shaft ? [hexPts(c, shaft + 0.5)] : [], 6, 0));
    // A floor with a plan to it: a band of darker stone along the foot of the
    // cases with a brass fillet on its inner edge, and a ring of the pale stone
    // round the lip of the well. One grid from wall to well said nothing about
    // where the room's edge was, or its middle.
    // (the band follows the cases out in a wider room; the ring round the
    // well stays with the well)
    const rim = rimAt(c), wider = rim - R;
    if (lit) {
      LB.floorBand.add(slabGeo(hexPts(c, 83.8 + wider), [hexPts(c, 72.4 + wider)], 0.1, 6));
      if (auditOld(1)) LB.inlay.add(slabGeo(hexPts(c, 72.9 + wider), [hexPts(c, 72.1 + wider)], 0.16, 6));
      else LB.fillet.add(slabGeo(hexPts(c, FILLET.outer + wider), [hexPts(c, FILLET.inner + wider)], FILLET.proud, 6));
      if (shaft) LB.cap.add(slabGeo(hexPts(c, shaft + 13), [hexPts(c, shaft + 2.6)], 0.08, 6));
    }
    // (the way in's two walls, stone for stone the far hallway's: WAY_IN)
    const wayInSide = cell.k === WAY_IN.from ? 150 : cell.k === WAY_IN.to ? 330 : null;
    for (const piece of wallRing(c, rim, RC, gaps)) {
      const mid = piece.reduce((m, q) => [m[0] + q[0] / piece.length, m[1] + q[1] / piece.length], [0, 0]);
      const bearing = (Math.atan2(mid[1] - c[1], mid[0] - c[0]) / deg + 360) % 360;
      const uvAt = wayInSide !== null && Math.abs(((bearing - wayInSide + 540) % 360) - 180) < 30 ? WAY_IN.by : null;
      // (the Echo's walls coursed as a drum: echoFix.js, 6)
      (room === 1 && !echoOld(6) ? LB.drum : LB.mass).add(slabGeo(piece, [], MASS_H, 0), uvAt);
      LB.cap.add(slabGeo(piece, [], CAP, MASS_H), uvAt);
    }
    if (hallway(cell, 5)) {
      arch(hallMid(cell.i, cell.j, 5), dir(330), cell.k === WAY_IN.to ? WAY_IN.by : null,
        [deepAt(c), deepAt(cellC(cell.i + NB[5][0], cell.j + NB[5][1]))]);
    }
    if (framed) balustrade(cell, halls);

    // Shelves: every tier in the lit galleries, fewer as the Library recedes.
    const topTier = lit ? TIERS - 1 : framed ? (light ? 1 : (near > 0.3 ? 4 : 2)) : 0;
    const fromTier = lit ? 0 : TIERS - 1 - topTier;
    const dress = { room, detail: lit ? 2 : near > 0.5 ? 1 : 0, graze: GRAZE_BY_ROOM[room] ?? 0 };
    const hexNo = lit ? hexNumber(cell.i, cell.j) : null;
    const wallWords = (k) => hexNo && [`HEXAGON ${hexNo} · WALL ${roman(k + 1)}`, `HEXAGON ${hexNo}`];
    for (let k = 0; k < 6; k++) {
      // "Between two shelves the stone gives way" — so the Door's broken wall
      // keeps its shelving either side of the breach, right up to the jamb.
      // It had none at all, which left the way out a bare slot in masonry.
      if (cell.k === '4,-4' && k === 5) {
        const e5 = edgeFrame(c, 5);
        const inward5 = [-e5.n[0], -e5.n[1]];
        const at5 = (t) => add(e5.mi, e5.t, t);
        // No number on this wall: between the corners and the portal's gable
        // block only a hand's breadth of either cornice shows. The wall that
        // gave way is the one missing from the count.
        shelfWall(at5(-62), at5(-11), inward5, { from: 0, to: TIERS - 1, ...dress });
        shelfWall(at5(14), at5(62), inward5, { from: 0, to: TIERS - 1, ...dress });
        continue;
      }
      const e = edgeFrame(c, k);
      const inward = [-e.n[0], -e.n[1]];
      if (halls.includes(k)) {
        // "In the hallway there is a mirror, which faithfully duplicates all
        // appearances." It was a slab: 44 tall, the whole length of the
        // passage, standing out from the wall and running through the jambs of
        // both doorways — from either room the way through looked half walled
        // up by something black. Now it is a glass hung ON the wall, in a
        // frame, stopping short of both openings so each doorway keeps its
        // jambs and reads as a door.
        // (2026-10-06: it still read as a blackboard — a panel of rough metal
        // showing a blur of the environment and nothing of the room — and the
        // Library's mirrors hang now as pier glasses either side of a
        // gallery's way out, below. The stream is drawn here exactly as it
        // was; ?wglass=old hangs these again.)
        if (k === 5 && (lit || (framed && rnd() < 0.4) || cell.k === WAY_IN.to) && GLASS_OLD) {
          const on = (along, z) => add(add(e.mi, e.n, along), e.t, z);
          // (from this room's face to the next one's, a hallway into the Echo
          // being shorter; and the way in hangs its glass where the hallway it
          // is dressed as has one, which starts that much further along)
          const lead = cell.k === WAY_IN.to ? deepAt(add(c, WAY_IN.by)) : 0;
          const a0 = 8 + lead, a1 = GAP - deepAt(c) - deepAt(cellC(cell.i + NB[5][0], cell.j + NB[5][1])) - 8;
          const z = HALL / 2 - 0.3, y0 = 12, y1 = 44;
          LB.mirror.add(boxGeo(on(a0, z), on(a1, z), y1 - y0, 0.5, y0));
          const fz = HALL / 2 - 0.55, bar = 1.3;
          LB.frame.add(boxGeo(on(a0 - bar, fz), on(a1 + bar, fz), bar, 1, y0 - bar));
          LB.frame.add(boxGeo(on(a0 - bar, fz), on(a1 + bar, fz), bar, 1, y1));
          for (const a of [a0 - bar / 2, a1 + bar / 2]) {
            LB.frame.add(boxGeo(on(a - bar / 2, fz), on(a + bar / 2, fz), y1 - y0, 1, y0));
          }
        }
        // A pier glass on each pier of the way out: the bare ashlar between
        // the arch's jambs (21.2 out from its axis) and the corner cases, so
        // the room is in it from wherever the gallery is crossed toward the
        // next one. Clear of any room's stream: these draw nothing from it.
        if (k === 5 && lit && !GLASS_OLD) {
          const pier = (HALL / 2 + 3.2 + rimAt(c) / 2) / 2 - 0.8;
          for (const s of [-1, 1]) {
            const { bright, deep } = mirrors.hang({ at: add(e.mi, e.t, s * pier), y: 14.5, normal: inward, hw: 6, side: 25 });
            bright.forEach((g) => LB.gilt.add(g));
            deep.forEach((g) => LB.giltDeep.add(g));
          }
        }
        // Books over the Echo's ways out (echoFix.js, 7). The room is named
        // for repetition, and through the upper arcade every bay showed
        // shelves but these two, which were bare ashlar from the arch to the
        // cornice. The top tier runs right across over the arch (its apex is
        // at 76, the tier begins at 94); the two below it stand on the piers
        // either side, over the pier glasses (whose heads are under 50), from
        // the corner to a few units clear of the arch's voussoirs. Drawing
        // nothing from the world's stream (`stream: 0`): the books are the
        // walls' own.
        if (room === 1 && lit && !echoOld(7)) {
          const clear = ARCH_R + 4;
          shelfWall(e.i0, e.i1, inward, { from: TIERS - 1, to: TIERS - 1, ...dress, stream: 0 });
          // (shelfWall keeps 12 clear at each end of what it is given)
          shelfWall(e.i0, add(e.mi, e.t, -clear + 12), inward, { from: 2, to: TIERS - 2, ...dress, stream: 0 });
          shelfWall(add(e.mi, e.t, clear - 12), e.i1, inward, { from: 2, to: TIERS - 2, ...dress, stream: 0 });
        }
        continue;
      }
      // (a wider room's longer walls still draw the world's stream for a
      // standard wall, or everything built after them would move)
      const stream = wider ? dist(add(c, dir(60 * k), R), add(c, dir(60 * k + 60), R)) : undefined;
      if (lit && k === 4 && paintings) shelfWall(e.i0, e.i1, inward, { from: 3, to: TIERS - 1, ...dress, words: wallWords(k), stream });
      else shelfWall(e.i0, e.i1, inward, { from: fromTier, to: TIERS - 1, ...dress, words: wallWords(k), stream });
    }
    if (lit) hangPainting(room, [c[0], c[1] - A - deepAt(c) + 2.5], 38, [0, 1], 80);

    if (shaft) {
      // (2.5 thick, so its top, level with the paving, lies wholly under the
      // bronze plinth or the parapet: at 3 a sliver of it showed beside the
      // parapet's foot, in the floor's own plane)
      LB.liner.add(slabGeo(hexPts(c, shaft + 2.5), [hexPts(c, shaft)], 236, -230));
      LB.stars.add(slabGeo(hexPts(c, shaft + 2), [], 1, -232));
      if (lit && room === 0 && !vestOld(7)) wellGlow(c, shaft);
      if (lit && room === 0 && BRIDGE_LEVEL) {
        // (the Vestibule's well rail is laid with its bridge, as one run
        // round each half of the well: vestibuleBridge.js)
      } else if (lit && room === 1 && ECHO_KERB) {
        // The Echo's well is the one its bridge stands over, and the bronze
        // rail round it ran under both flights' arches a hand's breadth
        // below their soffits: a turned rail of another metal and another
        // shape, at the height of a parapet, under the stone one — "like a
        // bridge over a bridge" (2026-10-07). So a kerb instead, in the
        // balustrades' stone: a plinth, a plain die and a rounded coping,
        // 46 cm high, the well's lip and no kind of rail. (Carved stone,
        // not a stair: body.js takes no step up onto it, and no crest.)
        const ring = hexPts(c, shaft + 1.4), mid = lerp2(ring[5], ring[0], 0.5);
        const loop = [mid, ...ring, mid].map(([x, z]) => [x, 6, z]);
        const box = (half, y0, y1) => [[-half, y0, true], [half, y0, true], [half, y1, true], [-half, y1, true]];
        LB.balustrade.add(mouldGeo(loop, box(1.6, -0.3, 0.6)));
        LB.balustrade.add(mouldGeo(loop, box(1.2, 0.5, 4.1)));
        LB.balustrade.add(mouldGeo(loop, [[-1.6, 4, true], [1.6, 4, true], [1.6, 4.45], [1.42, 4.8], [1.0, 4.95], [-1.0, 4.95], [-1.42, 4.8], [-1.6, 4.45]]));
      } else if (lit) {
        // a turned bronze balustrade round the well: base, balusters, rail
        LB.bronze.add(slabGeo(hexPts(c, shaft + 2.8), [hexPts(c, shaft)], 1.4, 6));
        LB.bronze.add(slabGeo(hexPts(c, shaft + 2.4), [hexPts(c, shaft + 0.4)], 0.7, 7.4));
        // The rail was three flat rings stacked into a plank, the nearest and
        // largest thing in most frames and the least interesting. Now a bead,
        // a neck, and a rounded handrail on them, rubbed bright on top where
        // hands have gone round it — six straight lengths, their joints closed
        // by a knuckle of the same section, and in the Vestibule (the one well
        // no stair crosses at a corner) a newel standing on each corner.
        //
        // And LOW. "The ventilation shafts are surrounded by very low railings",
        // Borges says, and at a man's hip the rail stood across the lower third
        // of every stand's view, two paces away and the largest thing in it.
        // At a reader's knee (the handrail tops at 12.5, 60 cm up) it lies along
        // the bottom edge of the frame and the room has its floor again.
        LB.bronzeDim.add(slabGeo(hexPts(c, shaft + 2.9), [hexPts(c, shaft - 0.1)], 0.6, 10.5));
        {
          const corners = hexPts(c, shaft + 1.4);
          corners.forEach((q, k) => {
            LB.bronzeWorn.add(barGeo(q, corners[(k + 1) % 6], 11.8, 1.3, 0.6));
            LB.bronzeWorn.add(placed(new THREE.SphereGeometry(1.3, 18, 12).scale(1, 0.6, 1), q, 11.8));
            if (room === 0) {
              LB.bronzeDim.add(placed(new THREE.CylinderGeometry(0.95, 1.25, 5.4, 14), q, 6 + 2.7));
              // capped low and moulded: the ball it wore was the nearest,
              // brightest round thing in the Vestibule's first frame
              LB.bronzeWorn.add(placed(new THREE.CylinderGeometry(1.15, 0.95, 0.55, 16), q, 12.75));
              LB.bronzeWorn.add(placed(new THREE.SphereGeometry(0.62, 14, 8).scale(1, 0.55, 1), q, 13.1));
            }
          });
        }
        const ringPts = hexPts(c, shaft + 1.4);
        ringPts.forEach((q, k) => {
          // One baluster every 6.4 rather than every 4.2. At the tighter
          // spacing the rail round the well was a picket fence: from a
          // reader's eye the turned shafts closed up into a solid bronze band
          // across the bottom of the frame, and the floor and the well behind
          // it were both lost. Spaced out you see between them, and the room
          // keeps its floor.
          const next = ringPts[(k + 1) % 6], n = Math.floor(dist(q, next) / 6.4);
          for (let s = 0; s < n; s++) {
            const b = lerp2(q, next, (s + 0.5) / n);
            balusters.push({ p: [b[0], 7.4, b[1]], s: [0.85, 0.5, 0.85] });
          }
        });
      } else {
        LB.bronzeDim.add(slabGeo(hexPts(c, shaft + 2.6), [hexPts(c, shaft)], 9, 6));
      }
      if (lit || near > 0.4) decal(c, shaft * 2.6, shaft * 2.6, '#79a8bd', lit ? 0.07 : 0.035, 6.8);
      // 0.5 proud, never 0.6. The lamps lay their pools of light flat at 6.6
      // (decal), and a ring whose top stood in that very plane fought them
      // for every pixel: a comb of lit and unlit teeth down the brass that
      // changed with every step, which is the "blinking rails on the floor".
      if (lit && room !== 4) LB.inlay.add(slabGeo(hexPts(c, shaft + 18), [hexPts(c, shaft + 16.6)], 0.5, 6));
    }
    if (!lit && framed && rnd() < 0.14 + 0.5 * near) {
      const strength = 0.15 + 0.6 * near;
      lamp(add(c, dir(rr(0, 360)), shaft + 26), { strength, pool: near > 0.2 ? 0.05 + 0.16 * near : 0, poolSize: 180 });
      if (rnd() < 0.3) figure(add(c, dir(rr(0, 360)), shaft + 12), 6);
    }
    if (lit) {
      // Dust, not a snowstorm. At 26 a gallery of it read as sparkle rather than
      // air — and the eye goes to whatever moves, which was the wrong thing.
      for (let s = 0; s < (light ? 6 : 14); s++) {
        const p = add(c, dir(rr(0, 360)), rr(0, R * 0.8));
        dust.push({ p: [p[0], rr(12, MASS_H - 10), p[1]], s: Array(3).fill(rr(0.4, 0.9)), color: '#ffdca8', k: rr(0.16, 0.4), phase: rr(0, 100) });
      }
    }
  }

  // The rooms' furniture: a gallery on each of the two walls at the sides of a
  // stand's view, a ladder on another, and a reading corner on a wall the walk
  // does not pass (check:walls holds all of it off the legs).
  if (!paintings) {
    const V = cellC(0, 0), S = cellC(2, -2), Dr = cellC(4, -4);
    gallery(V, 1); gallery(V, 4); ladder(V, 3, 20); readingCorner(V, 4, -16);
    gallery(S, 0); gallery(S, 3); ladder(S, 4, -20); readingCorner(S, 3, 12, { lit: false });
    gallery(Dr, 1); gallery(Dr, 4); ladder(Dr, 0, doorPropsOld(9) ? 16 : DOOR_LADDER_U); readingCorner(Dr, 3, -10);
  }

  let vault = null;   // the library over the Vestibule, raised by the reader's gaze in tick
  let walkers = null; // the readers walking the Vestibule's bridge, moved by tick
  yield 'The Vestibule';
  // I — the Vestibule: a bridge over a wide shaft, a file of readers on it.
  {
    const c = cellC(0, 0), ax = dir(30), px = dir(120);
    const a = add(c, ax, -55), b = add(c, ax, 55);
    // "A bridge of stone carries a file of readers across the dark on its own
    // arch" — so it has one. A segmental arch springing off the lip of the well
    // at ±44, two courses thick at the crown and eight at the springing, with
    // the deck laid over it. It was a flat slab 110 long and 6 thick, and being
    // the first thing seen in the first room it was a quarter of the frame of
    // untextured brown.
    const soffit = [];
    for (let k = 0; k <= 26; k++) {
      const u = 44 - (k / 26) * 88;
      soffit.push([u, 4 - 26 * (u / 44) ** 2]);
    }
    if (!BRIDGE_LEVEL) LB.step.add(profileGeo([[-55, -34], [-55, 12], [55, 12], [55, -34], [44, -34], ...soffit, [-44, -34]], 17, c, 30));
    // a moulded string course along each edge of the deck, and the keystone
    for (const side of BRIDGE_LEVEL ? [] : [-1, 1]) {
      LB.cap.add(boxGeo(add(a, px, side * 8.6), add(b, px, side * 8.6), 1.6, 2.2, 10.4));
      LB.cap.add(boxGeo(add(a, px, side * 9.2), add(b, px, side * 9.2), 1.2, 1.4, 9.2));
    }
    for (const side of BRIDGE_LEVEL ? [] : [-1, 1]) {
      LB.cap.add(placed(new THREE.BoxGeometry(5, 7, 2.6), add(c, px, side * 8.7), 6, 30 * deg));
    }
    // A stone balustrade along each side of the deck, on the string course:
    // five pedestals a side — one over the keystone, where the arch is
    // highest, one at each end with a ball on it, and two halfway between —
    // and the plinth, balusters and handrail run between them.
    // (?wrail=old: the bronze handrail on posts it replaced; it is the
    // raised bridge's, ?wbridge=old: see vestibuleBridge.js)
    if (!RAIL_OLD && !BRIDGE_LEVEL) {
      const ry = -30 * deg, DECK = 12, TOP = 20.6, PEDS = [-52, -26, 0, 26, 52];
      for (const side of [-1, 1]) {
        const at = (u) => add(add(c, ax, u), px, side * 8.3);
        PEDS.forEach((u, i) => {
          // (let down onto the lower string, or the overhang of its base
          // shows a slot of dark under it from the floor)
          LB.balustrade.add(placed(pedestalGeo(VEST_RAIL.ped, VEST_RAIL.baseH - VEST_RAIL.sink, TOP + 0.1 - DECK,
            { ball: Math.abs(u) === 52, sunk: 1.5, shift: patchOf(at(u)) }), at(u), DECK, ry));
          if (i) {
            stoneRail(LB.balustrade, {
              at, foot: () => DECK, top: () => TOP, knots: [PEDS[i - 1], u],
              clear: [VEST_RAIL.ped / 2 + 0.25, VEST_RAIL.ped / 2 + 0.25], ry: () => ry, S: VEST_RAIL,
            });
          }
        });
      }
    }
    // Level with the floor, and of a piece with the room (the default).
    if (BRIDGE_LEVEL) buildVestibuleBridge({ c, ax, px, LB, placed, mouldGeo, balusters, wornRibbon });
    // a bronze handrail on posts, rather than a bar floating in the air
    for (const side of RAIL_OLD ? [-1, 1] : []) {
      const rail0 = add(a, px, side * 8), rail1 = add(b, px, side * 8);
      LB.bronze.add(rodGeo([rail0[0], 20, rail0[1]], [rail1[0], 20, rail1[1]], 0.7));
      LB.bronze.add(rodGeo([rail0[0], 15.5, rail0[1]], [rail1[0], 15.5, rail1[1]], 0.35));
      for (let u = -52; u <= 52; u += 13) {
        const q = add(add(c, ax, u), px, side * 8);
        LB.bronze.add(placed(new THREE.CylinderGeometry(0.55, 0.7, 8.4, 8), q, 16.2));
        // A ball only where the rail ends. One on every post was a row of
        // knobs along the bridge, a toy's rail; between, a collar where the
        // rail passes over the post.
        if (Math.abs(u) === 52) LB.bronze.add(placed(new THREE.SphereGeometry(0.95, 10, 8), q, 20.6));
        else LB.bronze.add(placed(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 10), q, 19.1));
      }
    }
    // A FILE of readers, not a queue. Seven at thirteen apart stood shoulder to
    // shoulder across the whole width of the frame — a row of near-identical
    // dark blobs with no gap to see the bridge, the arch or the far side
    // through. Four, spread down the length of it, read as people crossing:
    // the eye gets between them, and the bridge gets to be a bridge. They
    // walk it now (walkers.js, built under the lectern below). Their old
    // places' draws stay: the world's random stream is shared, and everything
    // built after this would otherwise be shuffled.
    for (let k = 0; k < 4; k++) { rr(-2, 2); rr(-1.2, 1.2); rr(0, Math.PI * 2); }
    // Low, and only these two: "two lamps keep the gap they cross". Hung at
    // lamp height with the rest they lit the whole hexagon evenly and the room
    // became the same room as the Echo — these sit just above the readers'
    // heads, so the bridge is an island of light and the gallery falls away.
    // (their pools laid on the floor, as the reading corner's is: at the
    // default 6.6 they drew a pale sock round the foot of every leg in the room)
    // (their halos turned down as the lamps by the other stands are: at the
    // full 111 units across, the near one's laid a pale band down the whole
    // bay of shelves behind it, from the top of the frame to the rail, which
    // read as a smear on the lens — review 2026-10-08, point 6)
    const BRIDGE_HAZE = vestOld(6) ? 1 : 0.45;
    lamp(add(c, ax, -64), { y: 42, light: 9000, priority: 8, strength: 1.3, pool: 0.42, poolSize: 150, poolY: 6.15, haze: BRIDGE_HAZE });
    lamp(add(c, ax, 64), { y: 42, light: 9000, priority: 5, strength: 1.3, pool: 0.42, poolSize: 150, poolY: 6.15, haze: BRIDGE_HAZE });
    // The deck walked smooth down its middle: the file has been crossing it
    // for a very long time.
    if (!BRIDGE_LEVEL) LB.wornStep.add(wornRibbon([add(c, ax, -54), add(c, ax, 54)], 7, 12.03));
    // A reader who has stopped. Under the first lamp, where the bridge comes
    // down to the floor, a lectern with a folio open on it and one of the file
    // turned aside to read it: the readers were only ever walking past.
    {
      const at = add(c, ax, -67), ry = Math.atan2(ax[0], ax[1]), tilt = 0.42;
      const parts = [
        new THREE.BoxGeometry(4.2, 0.8, 4.2).translate(0, 6.4, 0),
        new THREE.CylinderGeometry(0.75, 0.95, 9, 12).translate(0, 11.3, 0),
        new THREE.BoxGeometry(3, 0.8, 2.4).translate(0, 16.2, 0),
        new THREE.BoxGeometry(6.6, 0.45, 4.8).rotateX(tilt).translate(0, 17.3, 0),
        new THREE.BoxGeometry(6.6, 0.6, 0.45).translate(0, 16.6, 2.1),
      ];
      LB.shelf.add(placed(mergeGeometries(parts), at, 0, ry));
      parts.forEach((g) => g.dispose());
      const folio = [-1, 1].map((side) => new THREE.BoxGeometry(3.1, 0.5, 4.1).translate(side * 1.62, 0.25, 0).rotateZ(-side * 0.07));
      LB.paper.add(placed(mergeGeometries(folio).rotateX(tilt).translate(0, 17.62, 0), at, 0, ry));
      folio.forEach((g) => g.dispose());
      walkers = buildWalkers({
        root, keep, c, ax, px, deck: BRIDGE_LEVEL ? 6 : 12, light,
        lectern: { at: add(c, ax, -61.2), y: 6, face: Math.atan2(-ax[0], -ax[1]) },
      });
    }
    // The card catalogue, at the other end of the wall with the reading table:
    // six drawers across and seven high, each the size a drawer of index
    // cards is (15 × 11 cm), with a brass frame for its card and a pull under
    // it, the case on a stand with the reference slide drawn out. (It had
    // four drawers across and six high, 26 cm wide, with 10 cm labels: from
    // the floor it read as a chest of drawers, and the labels as pale tiles.)
    {
      const { on, turn } = alongWall(c, 4);
      const COLS = 6, ROWS = 7, DW = 1.6, DH = 1.15, ST = 0.12, SIDE = 0.3, DP = 5, LEGS = 2.2;
      const W = COLS * DW + (COLS + 1) * ST + 2 * SIDE, H = ROWS * DH + (ROWS + 1) * ST;
      const Y0 = 6 + LEGS + 0.4;
      const carcass = [
        new THREE.BoxGeometry(W, H, DP).translate(0, Y0 + H / 2, 0),
        // a moulding under an overhanging top, and the plinth it stands on
        new THREE.BoxGeometry(W + 0.36, 0.2, DP + 0.26).translate(0, Y0 + H + 0.1, 0.05),
        new THREE.BoxGeometry(W + 0.8, 0.4, DP + 0.6).translate(0, Y0 + H + 0.4, 0.1),
        new THREE.BoxGeometry(W + 0.3, 0.4, DP + 0.3).translate(0, Y0 - 0.2, 0),
        // the stand: an apron and four tapered legs
        new THREE.BoxGeometry(W - 0.5, 0.5, DP - 0.5).translate(0, 6 + LEGS - 0.25, 0),
      ];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          carcass.push(new THREE.CylinderGeometry(0.42, 0.28, LEGS, 4).rotateY(Math.PI / 4).translate(sx * (W / 2 - 0.45), 6 + LEGS / 2, sz * (DP / 2 - 0.45)));
        }
      }
      // the slide, drawn out of the plinth a hand's breadth
      const slide = [new THREE.BoxGeometry(W - 1.6, 0.18, DP).translate(0, Y0 - 0.2, 1.6)];
      const fronts = [], pulls = [new THREE.SphereGeometry(0.14, 8, 6).translate(0, Y0 - 0.2, DP / 2 + 1.7)], labels = [];
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          const x = -W / 2 + SIDE + ST + col * (DW + ST) + DW / 2, y = Y0 + ST + row * (DH + ST) + DH / 2;
          fronts.push(new THREE.BoxGeometry(DW - 0.04, DH - 0.04, 0.22).translate(x, y, DP / 2 + 0.06));
          pulls.push(new THREE.BoxGeometry(0.62, 0.32, 0.04).translate(x, y + 0.2, DP / 2 + 0.19));
          pulls.push(new THREE.BoxGeometry(0.46, 0.12, 0.14).translate(x, y - 0.25, DP / 2 + 0.24));
          labels.push(new THREE.BoxGeometry(0.5, 0.2, 0.03).translate(x, y + 0.2, DP / 2 + 0.215));
        }
      }
      const q = on(18, 18.8);
      for (const [batch, list] of [[LB.shelf, carcass], [LB.oak, [...fronts, ...slide]], [LB.bronze, pulls], [LB.paper, labels]]) {
        batch.add(placed(mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))), q, 0, turn));
        list.forEach((g) => g.dispose());
      }
    }
    // ── The library over the Vestibule ──
    // The room opens with nothing over it but the dark. Look up and the
    // library begins to climb out of it: a gallery of shelves spiralling up
    // from the wall tops, tread after tread, each turn a little further in
    // than the one below, so that looking up the eye goes round and round and
    // in, and the turns go on dimming into the dark until there is no telling
    // where they stop. It is built along the spiral: the treads, the shelves
    // and the rail first, then the books flying up out of the room onto them,
    // and all of it arriving as dark as it stays: nothing lights up as it
    // lands. Once begun it goes on by itself, and looking up hurries it.
    // Leave the room and it is gone again, so the Vestibule always opens on
    // the same empty dark.
    //
    // Its own random stream, not the world's: this is built in the middle of
    // the galleries, and every draw on the shared one would reshuffle
    // everything built after it (the garden with it).
    {
      let st = 0x5113ce;
      const vr = () => {
        st = (st + 0x6d2b79f5) | 0;
        let x = Math.imul(st ^ (st >>> 15), 1 | st);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
      const vrr = (a, b) => a + (b - a) * vr();
      const Y0 = MASS_H + CAP;
      // Nine turns, each 38 high and 12% narrower than the last: from the wall
      // tops to a throat a third as wide, 340 up. SEG treads to a turn.
      // Every turn is the turn below it made smaller: 12% narrower, 12% lower,
      // its shelves, books, rail and lamps all 12% smaller. So the turns do
      // not stop — they close in on a point 290 up, books to the last of them,
      // the way a picture of a library inside a picture of that library does.
      // (Built at one size and faded into black, the top of it was a dark lid,
      // and the reader could see where the library ended.)
      const TURNS = light ? 11 : 18, SEG = light ? 24 : 36, PITCH = 38, R0 = 97, SHRINK = 0.88;
      const SHELF = 8, WALK = 10, TREAD = 2.6;
      const N = TURNS * SEG, LN = -Math.log(SHRINK);
      const scale = (s) => SHRINK ** (TURNS * s);
      const radius = (s) => R0 * scale(s);
      // the height a tread is set at: each turn rises its own (shrunken) pitch
      const height = (s) => Y0 + (PITCH * (1 - scale(s))) / LN;
      const angle = (s) => 330 + 360 * TURNS * s;   // starts over the far wall, the one the stand faces
      // The hexagon's own edge along a bearing: where the first turn's treads
      // have to reach to close against the wall tops. The corners are at
      // 0, 60, 120… (hexPts) and the flats between them. (Measured from the
      // wrong one of the two, it reached out past the flats and fell short of
      // every corner, and the sky showed through at all six.)
      const edge = (a) => A / Math.cos(((((a % 60) + 60) % 60) - 30) * deg);
      // Dark from the first turn, darker going up, but never so dark that the
      // books go out: they have to be there to the end. (0.45 at the foot read
      // as a lit ceiling; this is under half of that, and the books are
      // dimmed through their gilt as well as their leather — see `bookMat`.)
      const fade = (s) => 0.07 + 0.13 * Math.exp(-1.8 * s);

      const UP = new THREE.Vector3(0, 1, 0);
      const pieces = { wood: [], stone: [], bronze: [], lamps: [], books: [], rows: [] };
      // A piece: its place, where it comes from, and when in the build it
      // sets off. `inward` is the unit vector toward the axis at its bearing.
      const put = (kind, center, inward, size, color, order, { from = null, tilt = 0 } = {}) => {
        const z = inward.clone(), x = new THREE.Vector3().crossVectors(UP, z).normalize();
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, UP, z));
        if (tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
        const away = from ?? new THREE.Vector3(vrr(-10, 10), vrr(30, 55), vrr(-10, 10)).addScaledVector(inward, vrr(6, 16));
        const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(vrr(-2, 2), vrr(-2, 2), vrr(-2, 2)));
        pieces[kind].push({ p: center.clone(), q, s: new THREE.Vector3(...size), from: away, spin, color: new THREE.Color(color), order, t0: -1, state: 0 });
      };
      const at = (r, a, y) => new THREE.Vector3(c[0] + Math.cos(a * deg) * r, y, c[1] + Math.sin(a * deg) * r);
      const inwardAt = (a) => new THREE.Vector3(-Math.cos(a * deg), 0, -Math.sin(a * deg));
      const tint = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
      const chord = (r) => 2 * r * Math.sin((180 / SEG) * deg) * 1.02;
      // where the rail's top runs, at the start of tread `i`
      const railAt = (i) => {
        const s = i / N, f = scale(s);
        return at(radius((i + 0.5) / N) - (SHELF + WALK - 1.1) * f, angle(s), height(s) + 9 * f);
      };

      for (let i = 0; i < N; i++) {
        const s = i / N, sm = (i + 0.5) / N, a = angle(sm), r = radius(sm), k = fade(sm), f = scale(sm);
        const y = height(s);                       // the top of this tread
        const yUp = height(s + 1 / TURNS);         // the tread a turn above it
        const inn = inwardAt(a);
        const order = s;
        // the tread: from the rail out to the wall of the turn below it (or,
        // in the first turn, to the hexagon's own wall tops)
        const rIn = r - (SHELF + WALK) * f, rOut = i < SEG ? edge(a) + 3 : radius(sm - 1 / TURNS) + 1.5 * f;
        put('stone', at((rIn + rOut) / 2, a, y - (TREAD * f) / 2), inn, [chord(rOut), TREAD * f, rOut - rIn], tint('#4d443a', k), order);
        // its nosing: the pale edge that draws the spiral seen from below
        put('stone', at(rIn + 0.4 * f, a, y - 3.7 * f), inn, [chord(rIn) * 1.01, 2.2 * f, 1.6 * f], tint('#8a7c69', k), order);
        // and a bronze string under that: the one line that catches the
        // light all the way up, so the eye is handed the helix and not a
        // stack of rings
        put('bronze', at(rIn + 0.1 * f, a, y - 5.1 * f), inn, [0.55 * f, chord(rIn) * 1.02, 0.55 * f], tint('#ffffff', 0.25 + 0.6 * k), order, { tilt: Math.PI / 2 });
        // The back of the bookcase, up to the underside of the tread a turn
        // above — and in the first turn down behind the wall tops, so there is
        // no seeing past its foot.
        const low = i < SEG ? Y0 - 12 : y;
        put('wood', at(r + f, a, (low + yUp) / 2), inn, [chord(r + f), yUp - low, 2 * f], tint('#2a1d15', k), order + 0.0005);
        // two shelves, a cornice over them, and the uprights between the bays
        const PH = yUp - y;
        for (const [yy, t, deep] of [[y + 0.2 * f, 1.6, 0], [y + PH / 2, 1.4, 0], [yUp - (TREAD + 3) * f, 3, 1.6]]) {
          put('wood', at(r - (SHELF / 2 + deep / 2) * f, a, yy + (t * f) / 2), inn, [chord(r), t * f, (SHELF + deep) * f], tint('#4a3526', k), order + 0.001);
        }
        if (i % 3 === 0) {
          const ab = angle(s);
          put('wood', at(r - (SHELF / 2 + 0.4) * f, ab, (y + yUp) / 2), inwardAt(ab), [1.8 * f, PH - TREAD * f, (SHELF + 0.8) * f], tint('#3b2a1e', k), order + 0.001);
        }
        // the rail: a baluster at every tread, a rod from each to the next
        const p0 = railAt(i), p1 = railAt(i + 1);
        put('bronze', p0.clone().setY(p0.y - 4.5 * f), inwardAt(angle(s)), [0.55 * f, 9 * f, 0.55 * f], tint('#ffffff', 0.2 + 0.6 * k), order + 0.002);
        {
          const len = p0.distanceTo(p1), mid = p0.clone().add(p1).multiplyScalar(0.5);
          const along = p1.clone().sub(p0).normalize();
          pieces.bronze.push({
            p: mid, q: new THREE.Quaternion().setFromUnitVectors(UP, along), s: new THREE.Vector3(0.42 * f, len * 1.02, 0.42 * f),
            from: new THREE.Vector3(vrr(-8, 8), vrr(30, 50), vrr(-8, 8)), spin: new THREE.Quaternion(),
            color: tint('#ffffff', 0.2 + 0.6 * k), order: order + 0.002, t0: -1, state: 0,
          });
        }
        // a small lamp on every third post: a string of lights going round
        // and up and in, which is what draws the spiral the eye follows
        if (i % 3 === 1) {
          const g = Math.max(0.35, 0.9 * f);
          put('lamps', p0.clone().setY(p0.y + 1.2 * f), inwardAt(angle(s)), [g, g, g], tint('#ffc98e', 0.2 + 1.5 * k), order + 0.003);
        }
        // the books, both shelves, flying up out of the room onto them
        const rb = r - 4.2 * f, w = chord(rb) * 0.97;
        const along = new THREE.Vector3().crossVectors(UP, inn).normalize();
        const rows = [[y + 1.8 * f, PH * 0.5 - 2.6 * f], [y + PH * 0.5 + 1.4 * f, PH * 0.5 - TREAD * f - 4.8 * f]];
        // In the first turn the tread climbs away from the wall tops, and the
        // bookcase under it — down to the stone — was a bare dark board as
        // tall as the whole bay by the end of the turn. It gets shelves too.
        if (i < SEG) {
          const under = y - 6 * f - Y0;
          for (let b = Y0; b + 9 < Y0 + under; b += PH / 2) {
            const room = Math.min(PH / 2 - 2.4 * f, Y0 + under - b - 1.2);
            put('wood', at(r - (SHELF / 2) * f, a, b - 0.7 * f), inn, [chord(r), 1.4 * f, SHELF * f], tint('#4a3526', k), order + 0.001);
            rows.push([b + 0.1, room]);
          }
        }
        for (const [yb, room] of rows) {
          if (!BOOKS_GIANT) {
            // Real books (2026-10-06): a giant's shelf here is three or four
            // of quartos, each a painted row of them (bookRows) set down
            // whole. Seen from the floor, a hundred and more below, a book is
            // a pixel or two across; boxes for them all were tens of thousands.
            const n = Math.max(1, Math.round(room / (4.1 * f))), pitch = room / n, rf = r - 7.4 * f, wr = chord(rf) * 0.97;
            for (let j = 0; j < n; j++) {
              const sy = yb + j * pitch, clear = pitch - (j < n - 1 ? 0.4 * f : 0);
              if (j > 0) put('wood', at(r - (SHELF / 2) * f, a, sy - 0.2 * f), inn, [chord(r), 0.4 * f, SHELF * f], tint('#4a3526', k), order + 0.001);
              const { top: vt, base: vb } = rowV[BOOK_ROWS.variants + Math.floor(vr() * BOOK_ROWS.variants)];
              const from = inn.clone().multiplyScalar(vrr(28, 60)).add(new THREE.Vector3(vrr(-12, 12), -vrr(8, 30), vrr(-12, 12)));
              // (twice the fade the boxes took: the boxes' labels, lift and
              // gilt in the books' shader carried them, and the bare paint at
              // the same fade read as half as bright)
              put('rows', at(rf, a, sy + clear / 2), inn, [wr, clear, 1], tint('#ffffff', 2.2 * k * vrr(0.9, 1.1)), order + 0.003 + j * 0.0004, { from });
              pieces.rows[pieces.rows.length - 1].row = [vr(), wr / BOOK_ROWS.length, vb, vt];
            }
            continue;
          }
          const base = yb - y;
          let u = -w / 2;
          let n = 0;
          while (u < w / 2 - 1.4 * f) {
            if (vr() < 0.04) { u += vrr(1.5, 4) * f; continue; }
            const bw = Math.min(vrr(1.3, 2.9) * f, w / 2 - u), bh = vrr(room * 0.7, room);
            const tilt = vr() < 0.05 ? vrr(-0.25, 0.25) : 0;
            // across the bay, not round it: a straight shelf in each bay
            const p = at(rb, a, y + base + bh / 2).addScaledVector(along, u + bw / 2);
            const from = inn.clone().multiplyScalar(vrr(28, 60)).add(new THREE.Vector3(vrr(-12, 12), -vrr(8, 30), vrr(-12, 12)));
            put('books', p, inn, [bw, bh, vrr(6, 7.4) * f], tint(BOOKS[Math.floor(vr() * BOOKS.length)], vrr(0.8, 1.15)),
              order + 0.003 + n * 0.00012, { from, tilt });
            pieces.books[pieces.books.length - 1].dim = k;
            u += bw + vrr(0.1, 0.5) * f;
            n++;
          }
        }
      }
      // What it closes in on: past the last turn the next would be a few
      // units across, so the throat is stopped with a dark disc rather than
      // left as a hole onto the stars.
      {
        const yTop = height(1 + 1 / TURNS), r = radius(1) + 2;
        pieces.stone.push({
          p: new THREE.Vector3(c[0], yTop, c[1]), q: new THREE.Quaternion(), s: new THREE.Vector3(r * 2, 1, r * 2),
          from: new THREE.Vector3(0, 60, 0), spin: new THREE.Quaternion(), color: new THREE.Color('#050404'), order: 1.0, t0: -1, state: 0,
        });
      }

      // ── drawing it ──
      const woodMat = Std({ color: '#ffffff', map: wood.map, roughness: 0.9 });
      // Each piece is the unit box stretched by its instance, so its uv ran
      // 0..1 over every face whatever that face's size: a tile of timber
      // squeezed onto a dentil and drawn out down an upright. Measured off the
      // instance's own scale instead, in world units, with the grain along a
      // face's longer side and each piece cut from its own stretch of the
      // board (see woodGrain.js).
      if (!WOOD_OLD) {
        woodMat.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
          {
            vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
            vec3 an = abs(normal);
            // a face's sides as a BoxGeometry lays its uv: ±x faces (z, y), ±y (x, z), ±z (x, y)
            vec2 side = an.x > 0.5 ? sc.zy : an.y > 0.5 ? sc.xz : sc.xy;
            vec2 w = uv * side;
            if (side.y > side.x) w = w.yx;
            w += fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * vec2(97.0, 53.0);
            vMapUv = (mapTransform * vec3(w, 1.0)).xy;
          }`);
        };
        woodMat.customProgramCacheKey = () => 'babel-vault-wood';
      }
      const stoneMat = Std({ color: '#ffffff', roughness: 0.95 });
      // The room's own bindings, but dimmed whole. The book material paints
      // the gilt, the labels and the page edges in colours of their own, so an
      // instance colour only ever darkened the leather — and a spiral of dark
      // leather under bright gold lettering read as a lit library, however far
      // the leather went down. `aDim` takes the finished colour down with it,
      // gold and paper included.
      const bookMat = makeBookMaterial(spines, titles?.map);
      {
        const base = bookMat.onBeforeCompile;
        bookMat.onBeforeCompile = (sh, r) => {
          base.call(bookMat, sh, r);
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
        attribute float aDim;
        varying float vDim;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
        vDim = aDim;`);
          // after the bindings are painted (color_fragment), before anything
          // reads the colour — so the gilt's metal goes down with it too
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
        varying float vDim;`)
            .replace('#include <roughnessmap_fragment>', `diffuseColor.rgb *= vDim;
        #include <roughnessmap_fragment>`);
        };
        bookMat.customProgramCacheKey = () => 'babel-books-dimmed';
        keep(bookMat);
      }
      const lampMat = keep(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      const meshes = [];
      // the painted rows: a quad apiece, showing its own stretch of the strip
      const rowsMat = Std({ map: bookRowsSet.map, roughness: 0.85 });
      rowsMat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
          attribute vec4 aRow;`)
          .replace('#include <uv_vertex>', `#include <uv_vertex>
          vMapUv = vec2(aRow.x + uv.x * aRow.y, mix(aRow.z, aRow.w, uv.y));`);
      };
      rowsMat.customProgramCacheKey = () => 'babel-vault-rows';
      const make = (list, geo, mat, { spine = false, row = false } = {}) => {
        if (!list.length) return;
        const g = keep(geo);
        if (row) g.setAttribute('aRow', new THREE.InstancedBufferAttribute(Float32Array.from(list.flatMap((b) => b.row)), 4));
        if (spine) {
          g.setAttribute('aSpine', new THREE.InstancedBufferAttribute(Float32Array.from(list, (b) => spineAt([b.p.x, b.p.y, b.p.z])), 1));
          g.setAttribute('aTitle', new THREE.InstancedBufferAttribute(Float32Array.from(list, (b) => titleAt([b.p.x, b.p.y, b.p.z])), 1));
          g.setAttribute('aDim', new THREE.InstancedBufferAttribute(Float32Array.from(list, (b) => b.dim ?? 1), 1));
          g.setAttribute('aGraze', new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1));
          g.setAttribute('aDust', new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1));
        }
        const mesh = new THREE.InstancedMesh(g, mat, list.length);
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        list.forEach((it, j) => mesh.setColorAt(j, it.color));
        root.add(mesh);
        meshes.push({ mesh, list });
      };
      make(pieces.stone, new THREE.BoxGeometry(1, 1, 1), stoneMat);
      make(pieces.wood, new THREE.BoxGeometry(1, 1, 1), woodMat);
      make(pieces.books, new THREE.BoxGeometry(1, 1, 1), bookMat, { spine: true });
      make(pieces.rows, new THREE.PlaneGeometry(1, 1), rowsMat, { row: true });
      make(pieces.bronze, new THREE.CylinderGeometry(0.5, 0.5, 1, 8), M.bronze);
      make(pieces.lamps, new THREE.SphereGeometry(0.5, 12, 8), lampMat);

      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      const FLY = 1.3, LAST = 1.02;
      let built = 0, was = null, begun = false, held = false, dirty = false;
      // States: 0 not yet, 1 in the air, 3 set down. Only a piece in the air
      // costs anything a frame, so a finished library is free.
      const draw = (t) => {
        let busy = false;
        for (const { mesh, list } of meshes) {
          let touched = false;
          list.forEach((it, j) => {
            if (it.state === 3) return;
            if (it.state === 0) {
              if (built < it.order) return;
              it.state = 1;
              it.t0 = t;
            }
            const u = Math.min(1, (t - it.t0) / FLY);
            if (u < 1) {
              // lifted along an arc and set down, turning out of its tumble
              const e = 1 - (1 - u) ** 3;
              p.copy(it.p).addScaledVector(it.from, 1 - e);
              p.y += Math.sin(Math.PI * e) * 6;
              q.copy(it.spin).multiply(it.q).slerp(it.q, e);
              sc.copy(it.s).multiplyScalar(Math.min(1, u * 5));
            } else {
              p.copy(it.p);
              q.copy(it.q);
              sc.copy(it.s);
              it.state = 3;
            }
            mesh.setMatrixAt(j, m4.compose(p, q, sc));
            touched = true;
            busy = true;
          });
          if (touched) mesh.instanceMatrix.needsUpdate = true;
        }
        return busy;
      };
      const clear = () => {
        for (const { mesh, list } of meshes) {
          const zero = new THREE.Matrix4().makeScale(0, 0, 0);
          list.forEach((it, j) => { it.state = 0; mesh.setMatrixAt(j, zero); });
          mesh.instanceMatrix.needsUpdate = true;
          mesh.visible = false;
        }
      };
      clear();
      vault = (t, eye, gaze) => {
        const dt = was === null ? 0 : Math.min(0.1, Math.max(0, t - was));
        was = t;
        const far = eye ? Math.hypot(eye.x - c[0], eye.z - c[1]) : Infinity;
        if (far > R) {
          // Gone again once the reader is out of the room, so it is never
          // found half-built from the hallway.
          if (built > 0 && far > R + 20) { built = 0; begun = false; clear(); }
          return;
        }
        // Looking out level, or at the stair, does nothing: it wants the head
        // turned up, past where the room's composed view points.
        const up = gaze ? THREE.MathUtils.smoothstep(gaze.y, 0.3, 0.72) : 0;
        if (up > 0) begun = true;
        if (begun && !held && built < LAST) { built = Math.min(LAST, built + dt * (0.032 + 0.12 * up)); dirty = true; }
        if (built > 0) for (const { mesh } of meshes) mesh.visible = true;
        if (dirty) dirty = draw(t) || built < LAST;
      };
      if (import.meta.env.DEV) {
        window.__vault = (v, hold = false) => {
          if (v !== undefined) {
            // set down everything before `v` at once
            clear();
            built = v;
            begun = v > 0;
            held = hold;
            for (const { list } of meshes) for (const it of list) if (it.order <= v - 0.04) { it.state = 1; it.t0 = -1e3; }
            dirty = true;
          }
          return built;
        };
      }
    }
  }
  yield 'The Echo';
  // II — the Echo: two flights crossing over the shaft, a colonnade answering itself.
  //
  // The Echo's flights are cut on a tread of 7, not 8. At 8 each one ran 144
  // long, and its feet came down at 72 from the middle of the room: in the
  // corners, a stride from the bookcases, so the reader stepped onto the
  // stair out of the shelves with the case at their back — "too little space
  // when ascending". At 7 every foot stands 9 further in, with the floor
  // clear in front of it (the parapet's corner 16 from the case, where it was
  // 8), and the crown is where it was: only the going is shorter, not the rise.
  // ?wecho=old cuts them on the old 8 again; ?wechorun dials it.
  const ECHO_FLIGHT = { run: qNum('wechorun', Q.get('wecho') === 'old' ? 8 : 7) };
  // Keep the arcade and the walk on the same ring. Six units outward gives
  // the column bases about 23 cm clear of the stair coping (formerly 9 cm),
  // while leaving about a metre between their plinths and the bookcases.
  const ECHO_RING = qNum('wechoring', 62);
  {
    const c = cellC(1, -1);
    // Each flight is ONE piece of stone: a stepped top, and under it the arc
    // that carries it over the shaft — springing off the floor at the well's
    // lip, thinnest at the crown. As 36 separate slabs hung in the air with a
    // gap under every one, this read as a stack of packing crates, which is the
    // single thing that made this room look built out of cardboard.
    // A real arch under each flight, springing wide of the well: end-on, a
    // flight is a wall across half the room, and the opening under it is what
    // makes it a bridge instead.
    //
    // The crown both flights share is where the rose is laid (see the
    // crossing), so its two treads are not worn: the rose is what the feet
    // have worn there. ?wrose=old is the rose as it was.
    const ROSE_OLD = Q.get('wrose') === 'old';
    const echoF = flightProfile(ECHO_FLIGHT);
    const CROWN_Y = Math.max(...echoF.top.map(([, h]) => h));
    const ROSE_R = 6.9;
    const notCrown = (k) => echoF.stepTop(k) < CROWN_Y;
    const CROSS_OLD = Q.get('wcross') === 'old';
    for (const ang of [0, 60]) {
      const f = flightProfile(ECHO_FLIGHT);
      LB.step.add(profileGeo(f.pts, 15, c, ang));
      // The two flights cross at the crown, so each one's balustrade stops a
      // little short of where the other's deck arrives: the landing is open on
      // all four sides, which is the only way "stairs cross stairs" can be
      // something a reader does rather than something they look at. Each
      // flank opens only as far as the other deck really comes in over it, and
      // the balustrades meet at the four corners on one newel (`cross`; the
      // flight at 0 sets the newels). ?wcross=old is one span of ±15 for both
      // flanks, with each flight's flank standing up out of the other's treads.
      // (The keystones stop under the deck, as the Silence's do under its
      // terrace: standing up through the crown they crossed as a raised X of
      // stone under the rose, and the rose had to float over them.)
      // (the lips paler, the risers' shade lighter and a string up both
      // flanks: echoFix.js, 2)
      const VALUES = echoOld(2) ? {} : { nosing: LB.nosing, riser: LB.riserSoft, string: true };
      flightDress(c, ang, f, 7.9, CROSS_OLD
        ? { gap: [-15, 15], worn: ROSE_OLD || notCrown, keyThrough: ROSE_OLD, plane: ECHO_ONE_FACE, face: ECHO_ONE_FACE ? LB.flank : LB.cap, ...VALUES }
        // (the other flight is cut on the same profile as this one)
        : { cross: { c, ang: 60 - ang, f, half: 7.5 }, gapNewels: ang === 0, worn: ROSE_OLD || notCrown, keyThrough: ROSE_OLD, plane: ECHO_ONE_FACE, face: ECHO_ONE_FACE ? LB.flank : LB.cap, ...VALUES });
    }
    // ── The crossing ─────────────────────────────────────────────────────
    // The one piece of floor in this room a reader is ever brought to a stop
    // on (VANTAGES), and it was two staircases overlapping. An inlaid rose
    // makes it a place: six points for the six ways out of a hexagon, two of
    // which are the flights under your feet. Kept inside 7.1, which is where
    // the flanks of both flights stand: a wider ring runs into them at four
    // bearings and reads as a broken circle (and past 8.66 the landing is air
    // — beyond that radius neither flight is under it).
    //
    // It was laid as hoops and spokes of brass standing half a unit proud of
    // the crown round a dark hub, and from the stair it read as a cartwheel
    // left lying on the bridge ("very unnatural", 2026-10-05). An inlay is
    // LEVEL with what it is let into, and told from it by colour and sheen,
    // never by height. And a rose is points, not spokes: shapes with an area,
    // each lit on one half and shaded on the other, so that they read as
    // facets in a floor that is flat. So: a roundel of the dark polished
    // Purbeck (the Door's shafts) let into the crown; a twelve-point star of
    // brass and pale stone on it, with a brass dial round the star; a ring
    // with a sentence of the Library's cut in gilt between that and the rim;
    // and at the middle, rubbed bright, a hexagon — "the Library is a sphere
    // whose exact center is any one of its hexagons", and this is the one the
    // reader is standing in.
    //
    // Each piece is a few hundredths proud of what it lies on: enough to keep
    // the two surfaces out of each other's depth (see the well rings), too
    // little for the eye or a foot to find. No two pieces at one height
    // overlap.
    if (!ROSE_OLD) {
      const Y = CROWN_Y;
      const FIELD = Y + 0.06, METAL = Y + 0.1, HEX_IN = Y + 0.13, HEX = Y + 0.16;
      const at = (a, r) => add(c, dir(a), r);
      const piece = (batch, pts) => batch.add(slabGeo(pts, [], METAL - (FIELD - 0.03), FIELD - 0.03));
      // (the marble's figure finer than on the Door's shafts: at their size
      // the shell in it read as terrazzo from the stair)
      const marble = (g) => {
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
        return LB.marble.add(g);
      };
      marble(slabGeo(circlePts(c, ROSE_R, 96), [], FIELD - (Y - 0.3), Y - 0.3));
      const ring = (r0, r1) => LB.inlay.add(slabGeo(circlePts(c, r1, 96), [circlePts(c, r0, 96)], METAL - FIELD + 0.03, FIELD - 0.03));
      ring(6.55, 6.82);
      ring(5.46, 5.6);
      // The star. The six great points run out to the ring, along the
      // flights and the four other ways out; the six between them stop short,
      // and twelve small ones stand in the angles. Every point is halved down
      // its length, the half the rose turns towards lit and the other shaded,
      // all the same way round: that is what makes a flat star read as cut.
      const V = 1.2;
      for (let k = 0; k < 12; k++) {
        const a = 30 * k, great = k % 2 === 0, tip = at(a, great ? 5.44 : 3.6);
        piece(great ? LB.inlay : LB.stone, [c, at(a + 15, V), tip]);
        piece(great ? LB.bronzeDim : LB.capShade, [c, tip, at(a - 15, V)]);
        const b = a + 15;
        piece(LB.inlay, [at(b, 1.45), at(b + 3.5, 1.85), at(b, 2.7)]);
        piece(LB.bronzeDim, [at(b, 1.45), at(b, 2.7), at(b - 3.5, 1.85)]);
      }
      // the dial: a tick to every seven and a half degrees, longer at the
      // small points' bearings, and none where a great point meets the ring
      for (let k = 0; k < 48; k++) {
        if (k % 8 === 0) continue;
        const a = 7.5 * k, r0 = k % 4 === 0 ? 4.75 : k % 2 === 0 ? 4.98 : 5.14, w = dir(a + 90);
        piece(LB.inlay, [add(at(a, r0), w, -0.045), add(at(a, 5.38), w, -0.045), add(at(a, 5.38), w, 0.045), add(at(a, r0), w, 0.045)]);
      }
      // the hexagon at the middle: worn brass, with the marble for its floor
      LB.bronzeWorn.add(slabGeo(hexPts(c, 1.05), [hexPts(c, 0.62)], HEX - (METAL - 0.03), METAL - 0.03));
      marble(slabGeo(hexPts(c, 0.6), [], HEX_IN - (METAL - 0.03), METAL - 0.03));
      // The sentence round the rim, gilt cut in the marble. Read from the
      // middle of the rose, a letter's head to the rim, so it reads for the
      // one reader who stops here; its two ends meet behind that reader, at
      // a small hexagon, and the middle of it lies in front of them, along
      // the far flight (the vantage looks out along 60 degrees).
      const TEXT = 'THE LIBRARY IS A SPHERE WHOSE EXACT CENTER IS ANY ONE OF ITS HEXAGONS';
      const BAND = 6.075, SEAM = 240, track = 0.14, space = 0.5;
      const span = [...TEXT].reduce((w, ch) => w + (ch === ' ' ? space : gilt.glyphs[ch].adv + track), -track);
      const cap = Math.min(0.54, (2 * Math.PI * BAND - 1.3) / span);
      piece(LB.bronzeWorn, hexPts(at(SEAM, BAND), 0.2));
      let s = -span / 2;
      for (const ch of TEXT) {
        if (ch === ' ') { s += space; continue; }
        const G = gilt.glyphs[ch];
        const a = (SEAM + 180) * deg + ((s + G.adv / 2) * cap) / BAND;
        const g = new THREE.PlaneGeometry(gilt.cellW * cap, gilt.cellH * cap);
        const uv = g.attributes.uv;
        for (let v = 0; v < uv.count; v++) uv.setXY(v, (G.col + uv.getX(v)) / gilt.cols, 1 - (G.row + 1 - uv.getY(v)) / gilt.rows);
        const p = add(c, [Math.cos(a), Math.sin(a)], BAND);
        // laid flat, the head out along the radius and the line running on
        // round the ring
        LB.letters.add(g.rotateX(-Math.PI / 2).rotateY(-(a + Math.PI / 2)).translate(p[0], FIELD + 0.02, p[1]));
        s += G.adv + track;
      }
    } else {
      const y = 30.2 + 0.45;
      // Inside 7.1, which is where the flanks of both flights stand: a wider
      // ring runs into them at four bearings and reads as a broken circle.
      LB.inlay.add(slabGeo(circlePts(c, 6.6, 40), [circlePts(c, 5.8, 40)], 0.5, y));
      LB.inlay.add(slabGeo(circlePts(c, 5.2, 40), [circlePts(c, 4.95, 40)], 0.5, y));
      for (let k = 0; k < 6; k++) {
        const a = 60 * k;
        LB.inlay.add(slabGeo([add(c, dir(a - 3), 1.4), add(c, dir(a), 4.8), add(c, dir(a + 3), 1.4)], [], 0.5, y));
      }
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 20), c, y));
    }
    // ── The light down the well ───────────────────────────────────────────
    // The gallery stands open to the sky, and nothing in the room said so. A
    // cool shaft falls the whole height of the rotunda, crosses both flights
    // and goes on down the well — the one thing in here that is not stone, and
    // the only light in the piece that is not a lamp.
    {
      // Leaning the way the moon does, so it falls across the room instead of
      // standing in the middle of it like a pillar.
      const tilt = 15 * deg, bear = 52 * deg;
      const up = new THREE.Vector3(Math.sin(tilt) * Math.cos(bear), Math.cos(tilt), Math.sin(tilt) * Math.sin(bear));
      const mid = new THREE.Vector3(c[0], 30, c[1]);
      // The crossing stands in the middle of this, so it has to know where it
      // is: from the crown it was the whole frame gone pale (see shaftVolume).
      const beam = new THREE.Mesh(
        keep(shaftVolume(new THREE.CylinderGeometry(21, 35, 190, 30, 1, true),
          mid.clone().addScaledVector(up, -95).toArray(), 35, mid.clone().addScaledVector(up, 95).toArray(), 21)),
        // (begun over the lower arcade and warmed at its edge: echoFix.js, 4)
        keep(moonBeamPatch(makeShaftMaterial('#c3cfd8', 0.09))),
      );
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      beam.position.copy(mid);
      beam.renderOrder = 2;
      root.add(beam);
      // Where it LANDS. From the floor the column hung in front of the stair
      // as a grey sheet, and light in the air is the weakest way to say light.
      // Laid on the treads it crosses, cut to the beam's own section at the
      // height of each tread, it comes down the stair in steps.
      //
      // ADDED, a flat grey laid on top of the stone, it was the harshest thing
      // on the bridge ("too harsh and unnatural", 2026-10-05): each tread
      // under the crown a sheet of white paper with a hard outline, the joints
      // between its flags turned blue-grey, because added light lights the
      // mortar exactly as much as the stone. Light MULTIPLIES what it falls on.
      // So it brightens the stone it lands on in proportion to the stone
      // (dst·(1 + k)): the joints stay dark, the stone keeps its warmth, and
      // the edge is a penumbra several units wide, not a cut line.
      // ?wmoon=old is the added sheet.
      const moonOld = Q.get('wmoon') === 'old';
      const moonLand = keep(moonOld ? new THREE.ShaderMaterial({
        uniforms: {
          uC: { value: new THREE.Vector2(c[0], c[1]) },
          uD: { value: new THREE.Vector2(Math.cos(bear), Math.sin(bear)) },
          uColor: { value: new THREE.Color('#e7ebee') },
          uO: { value: 0.18 },
        },
        vertexShader: `varying vec3 vW;
          void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform vec2 uC; uniform vec2 uD; uniform vec3 uColor; uniform float uO; varying vec3 vW;
          void main() {
            float t = (vW.y - 30.0) / ${Math.cos(tilt).toFixed(5)};
            vec2 ctr = uC + uD * (t * ${Math.sin(tilt).toFixed(5)});
            float r = 28.0 - 7.0 * t / 95.0;
            float d = distance(vW.xz, ctr);
            float m = (1.0 - smoothstep(r - 1.4, r + 0.3, d)) * (0.72 + 0.28 * (1.0 - d / r));
            gl_FragColor = vec4(uColor * m * uO, 1.0);
          }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }) : new THREE.ShaderMaterial({
        uniforms: {
          uC: { value: new THREE.Vector2(c[0], c[1]) },
          uD: { value: new THREE.Vector2(Math.cos(bear), Math.sin(bear)) },
          // What it multiplies is stone already lit by the lamps, so a neutral
          // moon would only be more lamplight. Leaning a little cool, it takes
          // the lamp's amber partly back out where it falls: the patch reads
          // as a different light, nearer the stone's own colour. Only a little:
          // a stronger cool cast on warm stone reads as a filter, the teal
          // grade that was turned down.
          uColor: { value: new THREE.Color().setRGB(0.84, 0.92, 1.0) },
          // Since the column was begun over the lower arcade (echoFix.js, 4)
          // the light is what it lays on the stair, and the stair has to be
          // the brightest thing in the room: stronger where it falls, and a
          // fainter spill of it carried on down the flight to the floor,
          // which the stand looks up (the lower treads lay outside the
          // column's section, and from the floor the moon lit nothing seen).
          uK: { value: qNum('wmoonk', echoOld(4) ? 0.8 : 1.3) },
          uSoft: { value: qNum('wmoonsoft', 6) },
          uSpill: { value: qNum('wmoonspill', echoOld(4) ? 0 : 0.8) },
        },
        vertexShader: `varying vec3 vW;
          void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform vec2 uC; uniform vec2 uD; uniform vec3 uColor; uniform float uK; uniform float uSoft; uniform float uSpill; varying vec3 vW;
          void main() {
            float t = (vW.y - 30.0) / ${Math.cos(tilt).toFixed(5)};
            vec2 ctr = uC + uD * (t * ${Math.sin(tilt).toFixed(5)});
            float r = 28.0 - 7.0 * t / 95.0;
            float d = distance(vW.xz, ctr);
            float m = 1.0 - smoothstep(r - uSoft, r + 0.5 * uSoft, d);
            m *= 0.8 + 0.2 * clamp(1.0 - d / r, 0.0, 1.0);
            m = max(m, uSpill * (1.0 - smoothstep(0.7 * r, 3.2 * r, d)));
            gl_FragColor = vec4(uColor * (m * uK), 1.0);
          }`,
        // out = src·dst + dst, and the target's alpha left as it was
        transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.DstColorFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }));
      const treads = [];
      const f = flightProfile(ECHO_FLIGHT);
      for (const ang of [0, 60]) {
        for (let k = 0; k < f.dims.steps; k++) {
          const u = -f.dims.span + (k + 0.5) * f.dims.run, y = f.stepTop(k);
          if (ang === 60 && Math.abs(u) < 9) continue;   // the crown both flights share, lit once
          const q = add(c, dir(ang), u);
          const off = (y - 30) * Math.tan(tilt), ctr = add(c, dir(52), off), r = 32 - (8 * ((y - 30) / Math.cos(tilt))) / 95;
          if (dist(q, ctr) > (echoOld(4) ? r + 9 : 3.2 * r + 9)) continue;
          if (!ROSE_OLD && y >= CROWN_Y) continue;   // (the crown: below)
          treads.push(flatQuad(q, ang, f.dims.run, 14.6, y + 0.05));
        }
      }
      // The crown, with the rose let into it. Laid flat across it as the
      // other treads are, the light would lie UNDER the inlay it falls on —
      // so it is laid round the rose at the crown's height, and over the rose
      // a little above the highest piece of it.
      if (!ROSE_OLD) {
        const sheet = (pts, holes, y) => {
          const v2 = (p) => p.map(([x, z]) => new THREE.Vector2(x, -z));
          const shape = new THREE.Shape(v2(pts));
          holes.forEach((h) => shape.holes.push(new THREE.Path(v2(h))));
          const g = new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2).translate(0, y, 0);
          g.setAttribute('uv1', g.attributes.uv.clone());
          return g;
        };
        const R = f.dims.run, rim = circlePts(c, ROSE_R + 0.05, 96);
        treads.push(sheet([[-R, -7.3], [R, -7.3], [R, 7.3], [-R, 7.3]].map(([u, z]) => add(c, [u, z])), [rim], CROWN_Y + 0.05));
        treads.push(sheet(rim, [], CROWN_Y + 0.22));
      }
      const land = new THREE.Mesh(keep(mergeGeometries(treads)), moonLand);
      treads.forEach((g) => g.dispose());
      // (named, so the walking body takes it for light on the stone and not a
      // floor of its own: body.js AIR)
      land.name = 'moonLand';
      land.renderOrder = 2;
      root.add(land);
    }
    // Every passage insists it has been walked before: a paler, smoother track
    // up the middle of every tread of both flights.
    {
      const f = flightProfile(ECHO_FLIGHT);
      for (const ang of [0, 60]) {
        for (let k = 0; k < f.dims.steps; k++) {
          if (!ROSE_OLD && !notCrown(k)) continue;
          const u = -f.dims.span + (k + 0.5) * f.dims.run;
          LB.wornStep.add(flatQuad(add(c, dir(ang), u), ang, f.dims.run - 0.6, 6.4, f.stepTop(k) + 0.03));
        }
      }
    }
    LB.inlay.add(slabGeo(circlePts(c, 50.5, 60), [circlePts(c, 49, 60)], 0.5, 6));
    LB.inlay.add(slabGeo(circlePts(c, 79 + ECHO_R - R, 60), [circlePts(c, 77.2 + ECHO_R - R, 60)], 0.5, 6));
    // ── Arcades answering arcades ─────────────────────────────────────────
    // What the room is called after, and what it did not have: two storeys of
    // arcade round the well on twelve bays, so that from anywhere in the gallery
    // you are looking through one arch at another, and through that at a third.
    // Without it this was a hexagon of bookshelves with a lamp in it — which is
    // exactly what the Vestibule is, and the two rooms were interchangeable.
    const FLOOR = 6, BAYS = 12;
    // The slender columns still stand directly on the floor. Their ring is
    // set back from the flights so the plinths and coping read as separate
    // stonework; the twelve bays and both storeys keep their rhythm.
    const RING = ECHO_RING, HALF = RING * Math.sin((180 / BAYS) * deg);
    // A turned profile, [radius, height] from the bottom up, with its uv in
    // world units: along the profile, and round it. (That way round, so the
    // stone's bed runs up a column as it does in a monolith, not round it.)
    const colLathe = (prof, segs = 40) => {
      const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs);
      const along = [0];
      for (let i = 1; i < prof.length; i++) along.push(along[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
      const rMax = Math.max(...prof.map(([r]) => r)), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, along[Math.round(uv.getY(i) * (prof.length - 1))], uv.getX(i) * Math.PI * 2 * rMax);
      }
      return g;
    };
    // A fluted shaft with entasis: straight for its lower third, then drawn in
    // to `top` of its foot at the neck. Twenty flutes with a fillet between
    // them, each a shallow hollow — the light finds every one, and they are
    // what makes a shaft read as cut stone rather than a pipe. The uv is world
    // units, up the shaft and round it, as colLathe's.
    const flutedShaft = (rad, h, { flutes = 20, rows = 6, top = 0.84, depth = 0.075, fillet = 0.2, fine = true } = {}) => {
      const E = fillet / 2;
      // where round one flute the vertices fall: on both arrises of the fillet,
      // and three across the hollow (one, for a column only seen from afar)
      const STOPS = fine ? [0, E, E + (1 - fillet) * 0.25, 0.5, E + (1 - fillet) * 0.75, 1 - E] : [0, E, 0.5, 1 - E];
      const cols = flutes * STOPS.length;
      const thAt = (i) => ((Math.floor(i / STOPS.length) + STOPS[i % STOPS.length]) / flutes) * Math.PI * 2;
      const R = (t) => rad * (t < 1 / 3 ? 1 : 1 - (1 - top) * ((t - 1 / 3) / (2 / 3)) ** 1.6);
      const hollow = (th) => {
        const f = ((th / (Math.PI * 2)) * flutes) % 1;
        return f < E || f > 1 - E ? 0 : Math.sin((Math.PI * (f - E)) / (1 - fillet));
      };
      const r = (th, t) => R(t) * (1 - depth * hollow(th));
      const pos = [], nor = [], uv = [], idx = [];
      const d = 1e-4;
      for (let j = 0; j <= rows; j++) {
        const t = j / rows, y = t * h;
        for (let i = 0; i <= cols; i++) {
          const th = i === cols ? Math.PI * 2 : thAt(i);
          const rr = r(th, t);
          const cs = Math.cos(th), sn = Math.sin(th);
          pos.push(cs * rr, y, sn * rr);
          // the normal from the surface's own derivatives (central, so an
          // arris shades as the mean of the faces either side of it)
          const rTh = (r(th + d, t) - r(th - d, t)) / (2 * d);
          const rY = (r(th, Math.min(1, t + d)) - r(th, Math.max(0, t - d))) / ((Math.min(1, t + d) - Math.max(0, t - d)) * h);
          const pTh = new THREE.Vector3(rTh * cs - rr * sn, 0, rTh * sn + rr * cs);
          const pY = new THREE.Vector3(rY * cs, 1, rY * sn);
          const n = new THREE.Vector3().crossVectors(pY, pTh).normalize();
          nor.push(n.x, n.y, n.z);
          uv.push(y, th * rad);
        }
      }
      const W = cols + 1;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const a = j * W + i, b = a + 1, c2 = a + W, e = c2 + 1;
          idx.push(a, c2, b, b, c2, e);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      return g;
    };
    // The orders' mouldings, as profiles in units of the shaft's radius. The
    // base is an Attic one — a torus, a hollow between two fillets, a smaller
    // torus — and the capital a Roman Doric: an astragal where the shaft ends,
    // a plain necking, three annulets, the echinus swelling out to carry the
    // abacus. (Each moulding is a few points: a lathe smooths its normals, and
    // a doubled point, which would sharpen one, makes a NaN of it.)
    const BASE = [
      [1.22, 0], [1.33, 0.06], [1.32, 0.19], [1.2, 0.27], [1.07, 0.32], [1.04, 0.42], [1.13, 0.49],
      [1.16, 0.56], [1.12, 0.63], [1.04, 0.68], [1.0, 0.75],
    ];
    const CAP = [
      [0.83, -0.02], [0.9, 0.03], [0.9, 0.1], [0.845, 0.14], [0.845, 0.4], [0.885, 0.43], [0.865, 0.46], [0.9, 0.5],
      ...[0.2, 0.45, 0.7, 0.9, 1].map((s) => [0.9 + 0.34 * (1 - (1 - s) ** 2), 0.53 + 0.34 * s]),
    ];
    // An arcade storey: a colonnade carrying a run of arches and a cornice over.
    // What keeps it from being any arcade anywhere is entirely in the ornament —
    // a moulded ring round every arch, an impost for it to spring from, a
    // roundel over every crown and a course of dentils under every cornice. Bare,
    // twelve identical openings in one pale stone read as a default.
    //
    // A column from the floor up: a square plinth, the base, the shaft, the
    // capital and its abacus, and over that an impost block — a little piece
    // of entablature, as in a Florentine loggia — for the arch to spring from,
    // so the arches can stand on columns no thicker than a column should be.
    // (`ped`: a pedestal first, for a storey standing on a cornice.)
    const KEY_OLD = echoOld(3);
    const arcade = ({ foot, ped = 0, top, rad, rise, band, wall }) => {
      const plinthH = rad * 0.55, baseH = rad * 0.75, capH = rad * 1.15, impH = rad * 1.3;
      const y0 = foot + ped, shaftY = y0 + plinthH + baseH, capY = top - impH - capH;
      const shaftH = capY - shaftY + rad * 0.02;
      const span = HALF - rad * 1.3;
      // (Turned as finely as they are seen: the upper storey is never nearer
      // than the crossing, and every column here is drawn into the shadow map
      // as well. At forty segments and twelve rows the two storeys came to
      // 125k triangles, a quarter of the world.)
      const near = rad > 1.5;
      const baseGeo = colLathe(BASE.map(([q, y]) => [q * rad, y * rad]), near ? 20 : 14);
      const capGeo = colLathe(CAP.map(([q, y]) => [q * rad, y * rad]), near ? 20 : 14);
      const shaftGeo = flutedShaft(rad, shaftH, near ? {} : { flutes: 16, rows: 4, fine: false });
      for (let k = 0; k < BAYS; k++) {
        const a = 15 + k * (360 / BAYS);
        const p = add(c, dir(a), RING), ry = -a * deg;
        if (ped) {
          // a pedestal: a base slab, a plain die, a cap
          LB.columnBox.add(placed(new THREE.BoxGeometry(rad * 3.2, 0.5, rad * 3.2), p, foot + 0.25, ry));
          LB.columnBox.add(placed(new THREE.BoxGeometry(rad * 2.8, ped - 0.9, rad * 2.8), p, foot + 0.5 + (ped - 0.9) / 2, ry));
          LB.columnBox.add(placed(new THREE.BoxGeometry(rad * 3.15, 0.4, rad * 3.15), p, foot + ped - 0.2, ry));
        }
        LB.columnBox.add(placed(new THREE.BoxGeometry(rad * 2.9, plinthH, rad * 2.9), p, y0 + plinthH / 2, ry));
        LB.column.add(placed(baseGeo.clone(), p, y0 + plinthH, ry));
        LB.column.add(placed(shaftGeo.clone(), p, shaftY, ry));
        LB.column.add(placed(capGeo.clone(), p, capY, ry));
        // the abacus, square to the ring
        LB.columnBox.add(placed(new THREE.BoxGeometry(rad * 2.75, capH - rad * 0.87, rad * 2.75), p, capY + (capH + rad * 0.87) / 2, ry));
        // the impost: a block the depth of the arcade's wall, and a cornice
        // over it a little wider each way
        LB.columnBox.add(placed(new THREE.BoxGeometry(wall + 0.4, impH * 0.72, rad * 2.7), p, capY + capH + impH * 0.36, ry));
        LB.columnBox.add(placed(new THREE.BoxGeometry(wall + 1.1, impH * 0.28, rad * 3.05), p, top - impH * 0.14, ry));

        const mid = add(c, dir(a + 180 / BAYS), RING * Math.cos((180 / BAYS) * deg));
        const turn = a + 90 + 180 / BAYS;
        // the spandrel between this column and the next: one closed outline,
        // the arch cut out of its underside (a hole would have to stop short)
        const arc = [];
        for (let n = 0; n <= 24; n++) {
          const th = Math.PI * (1 - n / 24);
          arc.push([Math.cos(th) * span, top + Math.sin(th) * rise]);
        }
        (echoOld(6) ? LB.mass : LB.drum).add(profileGeo(
          [[-HALF, top], [-span, top], ...arc, [span, top], [HALF, top], [HALF, top + rise + band], [-HALF, top + rise + band]],
          wall, mid, turn,
        ));
        // the archivolt: a moulded ring standing proud on each face of the arch
        const t = rad * 0.27;
        for (const face of [-1, 1]) {
          const q = add(mid, dir(turn + 90), face * (wall / 2 + t * 0.45));
          const ring2 = new THREE.TorusGeometry(span + t, t, 8, 36, Math.PI);
          ring2.scale(1, (rise + t) / (span + t), 1);
          LB.cap.add(placed(ring2.rotateY(-turn * deg), q, top));
          // and a keystone at the crown
          if (KEY_OLD) LB.cap.add(placed(new THREE.BoxGeometry(rad * 0.95, rad * 1.9, t * 2.2), q, top + rise + rad * 0.45, -turn * deg));
        }
        // A carved keystone (echoFix.js, 3): a wedge through the archivolt
        // that runs on up the spandrel as a console under the cornice, with a
        // sunk panel down its face and a cap moulding where it meets the
        // dentils. The short block with a bronze roundel standing on it read
        // from the floor as a ring hung over every arch, a door's knocker.
        if (!KEY_OLD) {
          const capH = rad * 0.35, y0 = top + rise - rad * 0.35, y1 = top + rise + band - 1.45 - capH;
          const wb = rad * 0.42, wt = rad * 0.66, D = t * 1.9 + 0.15;
          const wedge = (w0, w1, a, b) => [[-w0, a], [w0, a], [w1, b], [-w1, b]];
          const at = (z) => y0 + (y1 - y0) * z, wAt = (z) => wb + (wt - wb) * z;
          for (const face of [-1, 1]) {
            const off = (d) => add(mid, dir(turn + 90), face * (wall / 2 - 0.15 + d / 2));
            LB.cap.add(profileGeo(wedge(wb, wt, y0, y1), D, off(D), turn));
            // the panel, sunk: a raised margin each side of it, the field between
            for (const s of [-1, 1]) {
              LB.cap.add(profileGeo([[s * wAt(0.16) * 0.58, at(0.16)], [s * wAt(0.16) * 0.9, at(0.16)], [s * wAt(0.84) * 0.9, at(0.84)], [s * wAt(0.84) * 0.58, at(0.84)]], D + 0.3, off(D + 0.3), turn));
            }
            LB.cap.add(profileGeo([[-wAt(0.16) * 0.9, at(0.1)], [wAt(0.16) * 0.9, at(0.1)], [wAt(0.16) * 0.9, at(0.16)], [-wAt(0.16) * 0.9, at(0.16)]], D + 0.3, off(D + 0.3), turn));
            LB.cap.add(profileGeo([[-wAt(0.84) * 0.9, at(0.84)], [wAt(0.84) * 0.9, at(0.84)], [wAt(0.84) * 0.9, at(0.9)], [-wAt(0.84) * 0.9, at(0.9)]], D + 0.3, off(D + 0.3), turn));
            // the cap: a fillet, and a wider abacus over it
            LB.cap.add(placed(new THREE.BoxGeometry(wt * 2 + rad * 0.12, capH * 0.4, D + 0.25), off(D + 0.25), y1 + capH * 0.2, -turn * deg));
            LB.cap.add(placed(new THREE.BoxGeometry(wt * 2 + rad * 0.34, capH * 0.6, D + 0.5), off(D + 0.5), y1 + capH * 0.7, -turn * deg));
          }
          continue;
        }
        // a roundel over every crown, bronze in a pale surround
        for (const face of [-1, 1]) {
          const oc = add(mid, dir(turn + 90), face * (wall / 2 + 0.2));
          LB.cap.add(placed(new THREE.CylinderGeometry(band * 0.34, band * 0.34, 0.6, 24).rotateX(Math.PI / 2), oc, top + rise + band * 0.5, -turn * deg));
          LB.bronzeDim.add(placed(new THREE.CylinderGeometry(band * 0.25, band * 0.25, 0.9, 24).rotateX(Math.PI / 2), oc, top + rise + band * 0.5, -turn * deg));
        }
      }
      [baseGeo, capGeo, shaftGeo].forEach((g) => g.dispose());
      // a course of dentils under the cornice on both faces, the smallest
      // repeat in the room
      for (const face of [-1, 1]) {
        const rr = RING + face * (wall / 2 + 0.35);
        for (let d = 0; d < BAYS * 16; d++) {
          const a = (360 / (BAYS * 16)) * d;
          posts.push({
            p: [c[0] + Math.cos(a * deg) * rr, top + rise + band - 0.75, c[1] + Math.sin(a * deg) * rr],
            rot: [0, -a * deg, 0],
            s: [0.8, 1.3, 1.1],
          });
        }
      }
      // The cornice the storey carries, a ring right round the well — kept
      // narrow, because a deep one hangs over the reader's head as a black
      // soffit right across the top of the frame.
      // Round, not hexagonal: as a hexagon the ring's CORNERS reach out to
      // within a few units of where the reader stands and hang over their head
      // as a black soffit across the top of the frame.
      const ring = (r) => circlePts(c, r, 48);
      LB.cap.add(slabGeo(ring(RING + wall / 2 + 1.5), [ring(RING - wall / 2 - 1.5)], 2, top + rise + band));
      LB.cap.add(slabGeo(ring(RING + wall / 2 + 0.9), [ring(RING - wall / 2 - 0.9)], 1.4, top + rise + band + 2));
      return top + rise + band + 2.4;
    };
    // The lower storey springs its arches where the old one did (43.5), level
    // with the crown; the columns are 4.2 across and 8 diameters tall, where
    // the piers were 7.2 across on 10-unit pedestals.
    const upper = arcade({ foot: FLOOR, top: 43.5, rad: 2.1, rise: 12, band: 8, wall: 4.6 });
    arcade({ foot: upper, ped: 3, top: upper + 20, rad: 1.15, rise: 10, band: 6, wall: 3.2 });
    // The upper arcade's bays stand open. They once held a low case of
    // books each, on the cornice between the columns; looked up at from the
    // floor they read as cabinets left out in a loggia, not as library.
    // A sconce on every other pier, so the light repeats with the arches. Not
    // `lamp` — its halo is a sprite drawn with depthTest off, and at this size
    // and this close it hangs in front of the arcade as a pale disc.
    // Not on the two piers at the ends of the flight the walk climbs (165° and
    // 345°): the walk steps onto the stair beside one and off it beside the
    // other, a few units from the pier at the height of the eye, and a lit
    // lamp that close sweeping past the lens was most of what made going over
    // the crossing feel like walking into the columns.
    // Since 2026-10-07 a lantern on a console (sconce.js), fixed to a cast plate
    // on the shaft's face; ?wmount=old: held by a band round the shaft instead;
    // ?wsconce=old: the sconce as it was, a rod run through its globe under a
    // pan. The shaft's radius at the plate is the lower storey's, entasis and
    // all: arcade({ foot: FLOOR, top: 43.5, rad: 2.1 }).
    const SCONCE_OLD = Q.get('wsconce') === 'old';
    const shaftR = (y) => {
      const rad = 2.1, from = FLOOR + rad * 1.3, h = 43.5 - rad * 2.45 - from + rad * 0.02, t = (y - from) / h;
      return rad * (t < 1 / 3 ? 1 : 1 - 0.16 * ((t - 1 / 3) / (2 / 3)) ** 1.6);
    };
    const lanternWash = [], lanternPanes = [];
    for (let k = 1; k < BAYS; k += 2) {
      const a = 15 + k * 30, p = add(c, dir(a), RING - 2.1 - 1.5);
      if (a === 165 || a === 345) continue;
      if (!SCONCE_OLD) {
        const s = pierLantern({ at: add(c, dir(a), RING), ry: (180 - a) * deg, R: shaftR, oldBand: Q.get('wmount') === 'old' });
        s.bronze.forEach((g) => LB.bronze.add(g));
        lanternPanes.push(s.pane);
        lanternWash.push(s.wash);
        halo(s.halo.p, s.halo.y, 16, '#ffbe78', 0.16, lampHaloTex);
        continue;
      }
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.4, 0.4, 3.4, 6).rotateZ(Math.PI / 2), p, 26, -a * deg));
      LB.bronze.add(placed(new THREE.CylinderGeometry(1.9, 1.1, 0.8, 10), p, 28.4));
      // A small opal globe, the hanging lamps' glass (makeLampGlobeMaterial):
      // it was a glow-core, bright nearly to its rim, and from the stand it
      // printed as a flat cream plate stuck on the pier.
      // (And the lamps' hollow halo, which leaves the glass to be seen.)
      globes.push({ p: [p[0], 26.5, p[1]], s: [1.55, 1.55, 1.55], color: '#ffe8c8', k: 0.85 });
      halo(p, 26.6, 16, '#ffbe78', 0.16, lampHaloTex);
    }
    if (!SCONCE_OLD) {
      // the panes, in the globes' own opal glass
      instances(lanternPaneGeometry(), M.globe, lanternPanes, { cast: false, receive: false, chunked: true, name: 'lantern-panes' });
      // the light each lays on its own column
      const wash = new THREE.Mesh(keep(mergeGeometries(lanternWash, false)), keep(new THREE.MeshBasicMaterial({
        map: radialTex, color: '#ffb466', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })));
      wash.name = 'lantern-wash';
      wash.renderOrder = 1;
      root.add(wash);
    }
    // (Both with their halos turned down: between them and the moon the upper
    // middle of the stand's frame — the arcade, the room's subject — was milk.)
    // (At 44 since the colonnade came in to 56: at 52 its globe stood in the
    // upper storey's arches.)
    lamp(add(c, dir(150), 44), { light: 8500, priority: 7, strength: 1.2, pool: 0.32, haze: 0.45 });
    // In a little from the arcade and down in strength: at 52 it hung a dozen
    // units from the keystone and roundel over its bay and blew them out, and
    // with the moon the room had two brightest things. The moon wins now.
    lamp(add(c, dir(30), 45), { strength: 0.85, pool: 0.26, haze: 0.45 });
  }
  yield 'The Silence';
  // III — the Silence: "where the stairways stop crossing,
  // a single lamp keeps the dark honest". So the Echo's crossing is here
  // too — and stilled: two flights climb out over the well and, instead of
  // crossing, come to rest on one landing in the middle of it, under the one
  // lamp; five of the six lamps have gone out, and the one that has not is the
  // whole light in the room. (They used to be sheared off in the air a little
  // short of each other, and from the stand that read as a bridge into
  // nowhere, not as a stair that had stopped. Before that it was a lamp, a
  // reader and twelve boxes spiralling into the shaft — the Echo again with
  // the lights down.)
  {
    const c = cellC(2, -2);
    // Both flights climb from the floor to the middle and end on its axis,
    // the level crown of each running on into the landing. (`from: 9` builds
    // the half on the near side of the axis, which is the half the walk does
    // not cross — see `legs`.)
    //
    // Where they meet, each is buried in the other: the inner flank as far as
    // the V where the two inner parapets cross (13 puts both newels on the
    // bisector, one post), the outer flank only until it leaves the landing.
    // The parapet comes down over both, as it does over the Echo's crossing.
    const LAND = 9.5, INNER = 13, OUTER = 5.5;
    // (the landing as a terrace: see below)
    const TERRACE = Q.get('wterrace') !== 'old';
    const TERRACE_OUT = qNum('wterraceout', 6);
    for (const ang of [240, 300]) {
      const f = flightProfile({ from: 9, to: 18 });
      LB.step.add(profileGeo(f.pts, 13, c, ang));
      const inner = ang === 240 ? 1 : -1;
      flightDress(c, ang, f, 6.9, { ends: [false, true], gap: (side) => [-1, side === inner ? INNER : OUTER], stone: LB.capShade, worn: false, keyThrough: !TERRACE });
      // The rubble the broken ends used to shed onto the floor is gone with
      // them; its draws stay, because the world's random stream is shared and
      // everything built after this would otherwise be shuffled.
      for (let k = 0; k < 6; k++) { rr(-26, 26); rr(50, 74); rot3(); rr(2, 5.5); rr(1, 2.6); rr(2, 5.5); pick([0, 0, 0]); }
    }
    // ── The landing ──
    // A round floor at the height of the crowns, where the two flights come
    // in, carried on their arches. Everything round its free edge — the half
    // circle facing the room — is the flights' own dressing bent round it, the
    // same members at the same heights, so the stone reads as one stair that
    // arrives rather than two that were stopped: string and corona under the
    // deck, a kerb and its coping, balusters and a rail from the outer newel
    // of one flight to the outer newel of the other.
    //
    // And it is a TERRACE: the free edge is carried out toward the room, so
    // there is somewhere up there to stand and look from. As a round floor no
    // wider than the flights' crowns it was a pulpit — the reader on the stool
    // filled it, both flights arrived straight at the stool, and nobody who
    // climbed up could get round it to the rail (between it and either outer
    // newel there was five units, and a reader is eight across). Now the edge
    // is a wider arc whose middle is pushed TERRACE_OUT toward the room; it
    // still springs from the same two newels, so the flights, their dressing
    // and the back of the landing (over the crowns) are as they were — but
    // for the two keystones, which broke up through the paving in an X where
    // the stool used to hide them (`keyThrough`).
    // ?wterrace=old puts the round landing, the reader and the lamp back.
    {
      const f = flightProfile({ from: 9 });
      const TOP = f.pitch(0);
      // The free edge: from one flight's outer newel round to the other's. The
      // newels stand at u = OUTER, 7.5 off the axis (see flightDress).
      const RN = Math.hypot(OUTER, 7.5), half = Math.atan2(7.5, OUTER) / deg;
      const A0 = 300 + half, A1 = 360 + 240 - half;
      // the arc it is drawn on: round FC, through both newels, by way of the room
      const FC = TERRACE ? add(c, dir(90), TERRACE_OUT) : c;
      const N0 = add(c, dir(A0), RN), N1 = add(c, dir(A1), RN);
      const bearing = (p) => (Math.atan2(p[1] - FC[1], p[0] - FC[0]) / deg + 360) % 360;
      const RF = dist(FC, N0), LF = RF + (LAND - RN);
      const B0 = bearing(N0), B1 = bearing(N1) + 360;
      const arc = (r, n = 28) => Array.from({ length: n + 1 }, (_, k) => add(FC, dir(B0 + ((B1 - B0) * k) / n), r));
      const band = (r0, r1, y0, h, stone = LB.cap) => stone.add(slabGeo([...arc(r1, 40), ...arc(r0, 40).reverse()], [], h, y0));
      // A slab, not a drum. As a solid disc down to the arches' soffit, with a
      // cone under it, the landing read as a font or a pulpit standing on the
      // well, and not as the place two flights came to rest. Thin, it is
      // carried out over the well on the flights' own stone. (Behind the
      // newels — over the crowns, between the flights — it keeps the round.)
      const back = Array.from({ length: 21 }, (_, k) => add(c, dir(A1 + ((A0 + 360 - A1) * k) / 20), LAND));
      LB.step.add(slabGeo(TERRACE ? [...arc(LF, 40), ...back.slice(1, -1)] : circlePts(c, LAND, 48), [], 3.4, TOP - 3.4));
      band(LF - 1.6, LF, TOP, 1.6);                  // the kerb
      band(LF - 1.05, LF + 1.15, TOP + 1.6, 0.85);   // its coping
      band(LF - 0.5, LF + 0.82, TOP - 2.45, 1.2);    // the string
      band(LF - 0.5, LF + 1.15, TOP - 1.25, 0.8);    // its corona
      // a fillet under the slab — on the round landing only. The terrace's
      // wider arc turns the ends of its underside to the floor, and from the
      // stand they were two pale lenses hung under it, in the pale stone or
      // the dark (or the slab's own, paler still); without it the slab ends
      // in its string.
      if (!TERRACE) band(LF - 0.5, LF + 0.6, TOP - 4.3, 0.9, LB.cap);
      // Under the string, a skin of the flights' stone over the slab's own
      // edge: bare, the paving's flag texture ran down its face and its lower
      // arris printed from the floor as a bright chipped crack along the whole
      // underside of the terrace.
      if (TERRACE) band(LF - 0.3, LF + 0.03, TOP - 3.4, 0.95, LB.capShade);
      const railY = TOP + 9, base = TOP + 2.45;
      // the flights' stone balustrade, carried round from newel to newel
      if (!RAIL_OLD) {
        const L = (B1 - B0) * deg * RF, bear = (s) => B0 + ((B1 - B0) * s) / L;
        stoneRail(LB.balustradeShade, {
          at: (s) => add(FC, dir(bear(s)), RF), foot: () => base, top: () => railY + 0.5,
          knots: Array.from({ length: 41 }, (_, k) => (k / 40) * L), clear: [1.5, 1.5],
          ry: (s) => -(bear(s) + 90) * deg, S: FLIGHT_RAIL,
        });
      }
      const rail = RAIL_OLD ? arc(RF, 32) : [];
      for (let i = 1; i < rail.length; i++) {
        LB.bronze.add(rodGeo([rail[i - 1][0], railY, rail[i - 1][1]], [rail[i][0], railY, rail[i][1]], 0.44));
      }
      // at the flights' spacing of two to a tread, along the arc
      const n = RAIL_OLD ? Math.round(((B1 - B0) * deg * RF) / 4) : 0;
      for (let k = 1; k < n; k++) {
        const q = add(FC, dir(B0 + ((B1 - B0) * k) / n), RF);
        balusters.push({ p: [q[0], base, q[1]], s: [0.42, (railY - 0.55 - base) / 6.2, 0.42] });
      }
      // a small boss under the middle, and no more
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.1, 0.7, 0.8, 16), FC, TOP - 3.8));
    }
    // The one lamp still burning hangs over the landing, just off its middle
    // toward where the flights come in — so what it lights is the place where
    // the stairs stop. (Beyond them it only silhouetted them, and a dark shape
    // over a dark well is not a stair.) With the terrace it hangs HIGHER: at
    // 50 its globe was at the eye of anyone standing up there, nine units
    // off, and filled a third of the view with blown white. At 54 it is out of
    // a level look from anywhere on the terrace, and from the floor it still
    // stands behind the reader's head.
    // (its pool on the landing, where it falls: the floor under it is a well
    // — and on the terrace's middle, not on the lamp's: a pool laid round the
    // lamp itself ran off the back of the landing and hung over the treads)
    // Its globe is the hallway lamps' size, not the galleries' (r 9 is a
    // globe nearly ten units across, made to hang sixty up in a room's air):
    // over a terrace, a head or two above the reader, that size read as a
    // second moon.
    // (hung a body-width clear of the reader's head as the stand sees it:
    // silenceFix.js, 1)
    const LAMP = silenceOld(1) ? [258, 9, 54] : LAMP_AT;
    if (TERRACE) lamp(add(c, dir(LAMP[0]), LAMP[1]), { y: LAMP[2], r: 5.5, light: 7000, priority: 6, color: '#ffc98e', strength: 0.95, pool: 0.3, poolSize: 20, poolAt: add(c, dir(90), 4), poolY: flightProfile({ from: 9 }).pitch(0) + 0.06, beam: false });
    else lamp(add(c, dir(270), 9), { y: 50, light: 7000, priority: 6, color: '#ffc98e', strength: 0.95, pool: 0.3, poolSize: 24, poolY: flightProfile({ from: 9 }).pitch(0) + 0.06, beam: false });
    // (the one toward the Echo is hung off its doorway, at 168: on 150 it
    // hung in the arch itself, the middle of the view from the terrace)
    // (the one at 122 hung at 210, in the stand's frame, and goes higher than
    // the rest so that from the terrace the near wall's dead globes are not a
    // row: silenceFix.js, 3)
    const OUT_FRAME = !silenceOld(3);
    for (const a of [15, 75, TERRACE ? 168 : 150, OUT_FRAME ? 122 : 210, 330]) lamp(add(c, dir(a), rr(52, 64)), { out: true, r: rr(7.5, 9), ...(a === 122 ? { y: 82 } : {}) });
    // More that have gone out, at other heights, so the dark globes are a
    // room's worth and not a row — and one that fell: its chain still hangs
    // where it was, and the glass lies broken on the floor under it.
    // (the one at 235 hung at 265 until the terrace: from the stand it was
    // straight behind the lit globe and just under it, so through the
    // balusters the two read as one lamp twice the height)
    // (and the one at 40 at 235, over the stand's left: silenceFix.js, 3)
    for (const [a, rad, y, r] of [[45, 30, 74, 8], [110, 44, 58, 7], [185, 30, 82, 8.5], OUT_FRAME ? [40, 62, 56, 7.5] : [TERRACE ? 235 : 265, 60, 70, 7.5]]) {
      lamp(add(c, dir(a), rad), { out: true, y, r });
    }
    {
      const sr = makeRng(2262), at = add(c, dir(262), 50);
      for (let cy = 64, k = 0; cy < MASS_H + 40; cy += 1.55, k++) links.push({ p: [at[0], cy, at[1]], rot: [0, k % 2 ? Math.PI / 2 : 0, 0], s: [1, 1, 1] });
      // The globe broke where it fell: the bottom of it whole, tipped on its
      // side with its broken edge jagged, and the rest in curved pieces round
      // it. (Lying whole but for a cap, smooth and pale, it read from the stand
      // as an egg — or a bald head — just over the rail.)
      const floorOn = (g) => { g.computeBoundingBox(); return g.translate(0, 6.12 - g.boundingBox.min.y, 0); };
      const bowl = new THREE.SphereGeometry(4.2, 22, 8, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42);
      {
        const bp = bowl.attributes.position;
        for (let i = 0; i < bp.count; i++) if (bp.getY(i) > -1.3) bp.setY(i, bp.getY(i) - sr() * 1.6);
      }
      LB.deadShards.add(floorOn(bowl.rotateX(1.2).rotateY(0.6).translate(at[0], 0, at[1])));
      for (let k = 0; k < 5; k++) {
        const piece = new THREE.SphereGeometry(4.2, 5, 4, sr() * 6.28, 0.6 + sr() * 0.6, 0.6 + sr() * 1.6, 0.5 + sr() * 0.4);
        piece.computeBoundingBox();
        piece.boundingBox.getCenter(centre);
        piece.translate(-centre.x, -centre.y, -centre.z).rotateX(sr() < 0.5 ? 0.2 : Math.PI - 0.2).rotateY(sr() * 6.28);
        const q = add(at, dir(sr() * 360), 4.5 + sr() * 5);
        LB.deadShards.add(floorOn(piece.translate(q[0], 0, q[1])));
      }
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.4, 1.9, 1.1, 16).rotateZ(Math.PI / 2).rotateY(1.2), add(at, dir(20), 6), 6.9));
      for (let k = 0; k < 10; k++) {
        const q = add(at, dir(sr() * 360), 3 + sr() * 8);
        LB.deadShards.add(new THREE.IcosahedronGeometry(1, 0).scale(0.5 + sr(), 0.08 + sr() * 0.1, 0.4 + sr() * 0.8)
          .rotateY(sr() * 6.28).translate(q[0], 6.12, q[1]));
      }
    }
    // ── The one who has stopped ──
    // A reader on a stool in the middle of the landing, in the one lamp's
    // light, a book open in the lap and the head bowed over it; on the stone
    // beside the stool a second book laid face down, and a candle burnt to a
    // stub in its dish. The only person in the piece who has stopped, in the
    // room that is about stopping. (One used to stand down on the floor by the
    // rail, out of the lamp's reach, where only the top of the hood caught any
    // light: from the stand, a pale egg on the rail. Its draw is kept: the
    // world's random stream is shared.)
    rr(0, Math.PI * 2);
    {
      const top = flightProfile({ from: 9 }).pitch(0);
      const face = 112;   // toward the room, a little round from the stand
      const ry = Math.atan2(Math.cos(face * deg), Math.sin(face * deg));
      // On the terrace, out toward its rail, between the lamp and the room: in
      // the middle, where both flights arrive, the stool was the first thing
      // anyone who climbed up walked into, and the rail was behind it. A
      // little to one side, so from the floor the lamp burns beside the head
      // instead of behind it (straight behind, the reader was a black cut-out
      // with a halo), and the rest of the rail is free to stand at.
      // (Drawn back three units from where it was first put, at dir(64)·11.5:
      // there, the feet and the hem of the robe ran on through the kerb and
      // stood out of the terrace's face, a shoe and a dark patch in the stone.)
      const seat = TERRACE ? add(add(c, dir(64), 11.5), dir(253), 3) : c;
      const set = (g) => g.rotateY(ry).translate(seat[0], top, seat[1]);
      // (in the darkest wool there is: a few units under the room's one lamp,
      // the dyes the walkers wear came up pale grey from behind)
      const seatedLook = readerMaterial(keep);
      const seated = new THREE.Mesh(keep(set(readerGeometry({ seed: 2262, color: silenceOld(2) ? '#18120f' : ROBE, seated: true }))), seatedLook.mat);
      // (its geometry is laid in the world, so the book is put there with it)
      const bk = seated.geometry.userData.book;
      if (bk) {
        const b = new THREE.Vector3(...bk).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(seat[0], top, seat[1]));
        seatedLook.u.uBook.value.set(b.x, b.y, b.z, 1);
      }
      // the lamp's pool on the stone at the reader's feet, thrown back up
      // onto the robe's front, the hands and the face (silenceFix.js, 2)
      if (!silenceOld(2)) {
        const g = add(seat, dir(face), BOUNCE.ahead);
        seatedLook.u.uGlow.value.set(g[0], top + BOUNCE.rise, g[1], BOUNCE.k);
        seatedLook.u.uSheen.value = SHEEN;
      }
      seated.name = 'silence-reader';
      root.add(seated);
      const stool = [new THREE.BoxGeometry(4.3, 0.5, 3.5).translate(0, 4.2, 1.0)];
      for (const [x, z] of [[-1.8, -0.4], [1.8, -0.4], [-1.8, 2.4], [1.8, 2.4]]) stool.push(new THREE.BoxGeometry(0.45, 3.95, 0.45).translate(x, 1.98, z));
      stool.push(new THREE.BoxGeometry(3.6, 0.3, 0.3).translate(0, 1.2, -0.4), new THREE.BoxGeometry(3.6, 0.3, 0.3).translate(0, 1.2, 2.4));
      LB.oak.add(set(mergeGeometries(stool)));
      stool.forEach((g) => g.dispose());
      // the book face down, open, its two boards a low tent
      for (const side of [-1, 1]) {
        LB.leather.add(set(new THREE.BoxGeometry(2.1, 0.22, 3.1).translate(side * 1.02, 0, 0).rotateZ(-side * 0.16).translate(-3.9, 0.45, 2.6).rotateY(0.5)));
        LB.paper.add(set(new THREE.BoxGeometry(1.9, 0.3, 2.9).translate(side * 0.95, -0.2, 0).rotateZ(-side * 0.16).translate(-3.9, 0.45, 2.6).rotateY(0.5)));
      }
      // the candle: a dish, a stub of wax, the wax that ran
      LB.bronzeDim.add(set(new THREE.CylinderGeometry(0.85, 0.7, 0.14, 16).translate(3.4, 0.07, 2.2)));
      LB.paper.add(set(new THREE.CylinderGeometry(0.36, 0.42, 0.75, 12).translate(3.4, 0.52, 2.2)));
      LB.paper.add(set(new THREE.SphereGeometry(0.3, 10, 6).scale(1, 0.45, 1.3).translate(3.75, 0.2, 2.35)));
      LB.iron.add(set(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 4).translate(3.4, 1.0, 2.2)));
    }
  }
  // Two of them turned down. The one hung in the Vestibule's arch was the
  // brightest thing in the view through it, so the eye stopped in the doorway
  // instead of going on into the Echo; the one past the Silence was warmer
  // than the Silence's own last lamp.
  for (const [i, j, k, strength] of [[0, 0, 2, 1], [0, 0, 5, 0.5], [1, -1, 5, 1], [2, -2, 5, 0.4]]) {
    lamp(hallMid(i, j, k), { y: 46, strength, pool: 0.34 * strength, poolSize: 130, r: 5 });
  }

  yield 'The Vertigo';
  // IV — the Vertigo: a round pit, a stair winding down a funnel of books to one light.
  const PIT = cellC(3, -3);
  // (the well's light is graded round this, patched in before the build: vertigoFix.js, 4)
  if (import.meta.env?.DEV && Math.hypot(PIT[0] - WELL.c[0], PIT[1] - WELL.c[1]) > 0.01) console.error('vertigoFix: WELL.c is not the pit', PIT, WELL.c);
  let pitCore = null;
  // (the stair's own stone, darkened with depth over the map: mapFix.js, 7)
  let pitCarved = null;
  // (the rest of the light at the bottom, moved down with the disc: see `sink`)
  let pitSink = null, pitHeld = null;
  let stairAt = null, spiral = null;
  let drift = null;   // the loose pages falling down the well, moved by tick
  {
    const c = PIT, rWall = 101, rMouth = 68;
    // The face of the bookcase that lines the room, 12 in front of the wall.
    const rFace = rWall - 12;
    // The way in is a hallway like every other: stone to either hand, the
    // gallery's arch over it, and a dressed face where it meets the room. That
    // face stands where a gallery's inner wall does, `A` from the centre, which
    // is where the bookcase's front crosses the hallway's walls — so the
    // passage goes on through the depth of the shelves, and the bookcase stops
    // at a stone pier either side of it, cut radially at `jambA`.
    //
    // It stopped at the wall behind the books. Every ring of shelving ran
    // straight across the doorway — the lowest a wooden step at the shins, the
    // others planks barring the opening at head height and above — and the
    // arch, built as deep as a gallery's wall is thick, stood out past the
    // stone into the room with its pilasters free in front of the books.
    const jambA = Math.acos(A / rFace) / deg;
    // The wall round the pit, between its round mouth and the edge of the cell,
    // cut through by the one hallway in — so it is not a ring at all but a C,
    // and is built as one. (As a ring with a keyhole in it, the keyhole had to
    // stop short of the cell's edge, and the stone it stopped short by stood
    // across the hallway: see wallRing.)
    const pitWall = (() => {
      const axis = 150;
      const local = (along, across) => add(add(c, dir(axis), along), dir(axis + 90), across);
      const pts = [];
      for (let s = 0; s <= 80; s++) pts.push(add(c, dir(axis + jambA + ((360 - 2 * jambA) * s) / 80), rWall));
      pts.push(add(c, dir(axis - jambA), rFace));
      pts.push(local(A, -HALL / 2));
      pts.push(local(AC, -HALL / 2));
      for (let k = 0; k < 6; k++) pts.push(add(c, dir(axis - 30 - 60 * k), RC));
      pts.push(local(AC, HALL / 2));
      pts.push(local(A, HALL / 2));
      pts.push(add(c, dir(axis + jambA), rFace));
      return pts;
    })();
    // A ring of the bookcase, open across the doorway.
    const caseArc = (r) => Array.from({ length: 81 }, (_, s) => add(c, dir(150 + jambA + ((360 - 2 * jambA) * s) / 80), r));
    const caseRing = [...caseArc(rWall), ...caseArc(rFace).reverse()];
    LB.mass.add(slabGeo(pitWall, [], MASS_H, 0));
    LB.cap.add(slabGeo(pitWall, [], CAP, MASS_H));
    {
      const ring = [];
      for (let s = 0; s <= 72; s++) {
        const a = (360 * s) / 72;
        if (Math.abs(((a - 150 + 540) % 360) - 180) < 16) { ring.push(null); continue; }
        ring.push(add(c, dir(a), rWall + 3.5));
      }
      ring.forEach((p, s) => { if (p && ring[s + 1]) railRun(p, ring[s + 1]); });
      // a blind back behind the posts, so the sky is over the rail and not
      // between its posts (silenceFix.js, 5)
      if (!silenceOld(5)) {
        ring.forEach((p, s) => {
          const q = ring[s + 1];
          if (!p || !q) return;
          const out = (r) => add(c, dir(Math.atan2(r[1] - c[1], r[0] - c[0]) / deg), rWall + 3.5 + CROWN_BACK.out);
          LB.rail.add(boxGeo(out(p), out(q), RAIL_H, CROWN_BACK.t, MASS_H + CAP));
        });
      }
    }
    LB.floor.add(slabGeo(hexPts(c, RC), [circlePts(c, rMouth, 80)], 6, 0));
    // the bronze rim, open where the stair begins its way down (?wvrail=old:
    // the rail is otherwise iron and walnut, laid below, vertigoRail.js)
    for (let s = 0; s < 80 && VRAIL_OLD; s++) {
      const a0 = (360 * s) / 80, a1 = (360 * (s + 1)) / 80;
      if (a1 > 156 && a0 < 184) continue;
      LB.bronze.add(boxGeo(add(c, dir(a0), rMouth + 1.3), add(c, dir(a1), rMouth + 1.3), 9, 2.6, 6));
    }
    // (0.5, under the pools' plane at 6.6: see the rings round the wells)
    LB.inlay.add(slabGeo(circlePts(c, rMouth + 17, 80), [circlePts(c, rMouth + 14.5, 80)], 0.5, 6));
    // Pale vellum and calf near the rim, dark leather down the throat, so the
    // funnel falls away in value before any lamp says how deep it is. Chosen
    // by where a book stands rather than drawn: every draw here belongs to the
    // garden (see `resume`), and the draws the old colours made are still made.
    //
    // Pushed further than it was: more vellum at the rim and black sooner,
    // so the fall in value is the first thing the funnel says — and then,
    // in the last turns, the books warmed again by the light they stand over.
    const warmed = new THREE.Color(), litFrom = new THREE.Color('#c88a4c');
    const funnelColor = (p, y) => {
      const h = Math.abs(Math.sin(p[0] * 12.9898 + p[1] * 78.233 + y * 3.137) * 43758.5453) % 1;
      const deep = Math.min(1, Math.max(0, (6 - y) / 260));
      const odds = [
        ['#a89a7b', '#9d8f70', '#b0a283', 0.38 * (1 - deep) ** 2],
        ['#8a6341', '#7d5738', '#6f4c31', 0.42 - 0.18 * deep],
        ['#5a2923', '#662e25', '#4f2420', 0.12 + 0.04 * deep],
        ['#2d3a2b', '#333d29', '#283426', 0.08 + 0.04 * deep],
        ['#221d19', '#2a241f', '#1e1a17', 0.08 + 0.42 * deep],
      ];
      const total = odds.reduce((n, o) => n + o[3], 0);
      let r = h * total, hex = odds[1][0];
      for (const o of odds) { r -= o[3]; if (r <= 0) { hex = o[Math.floor(h * 997) % 3]; break; } }
      const glow = Math.min(1, Math.max(0, (-250 - y) / 180));
      return glow > 0 ? `#${warmed.set(hex).lerp(litFrom, 0.38 * glow * glow).getHexString()}` : hex;
    };
    // Real books round the rings (2026-10-06): the giants here were 12-18
    // tall and 9 deep. A ring is shelved bay by bay, from bearing `from` to
    // `to` (degrees), in sets of a binding's volumes standing on `sy` with
    // `clear` over them, their spines a finger's breadth behind the shelf's
    // face at radius `rf`; coloured where a set starts, as the giants were
    // where they stood. On a stream of their own: every draw on the world's
    // here belongs to the garden (see `resume`).
    const vr = makeRng(0x7e5d1);
    const shelveRing = (t, sy, clear, rf, from, to, wall) => {
      const S = SHELVES[t], within = ([lo, hi]) => lo + (hi - lo) * vr();
      let a = from + (vr() * 0.2) / rf / deg, run = 0, R = null, lean = 0;
      while (a < to) {
        if (run <= 0) {
          // now and then one taken out, and its neighbour leaning into the gap
          if (vr() < 0.03) { const g = 0.35 + vr() * 0.45; a += g / rf / deg; lean = g; continue; }
          const p = add(c, dir(a), rf), at = [p[0], sy, p[1]];
          R = {
            n: vr() < 0.22 ? 1 : 2 + Math.floor(vr() * vr() * 8), h: within(S.h), w: within(S.w), d: within(S.d),
            set: 0.1 + vr() * 0.6, color: funnelColor(p, sy), k: 0.8 + vr() * 0.3, spine: spineAt(at), title: titleAt(at),
          };
          run = R.n;
        }
        const w = R.w * (1 + (vr() - 0.5) * 0.06), hh = Math.min(clear - 0.3, R.h * (1 + (vr() - 0.5) * 0.025));
        if (a + w / rf / deg > to) break;
        const book = { wall, color: R.color, k: R.k * (0.96 + vr() * 0.08), spine: R.spine, title: R.title + (R.n > 1 ? 1000 * (R.n - run + 1) : 0) };
        // now and then one gone from its set as well, and the next leaning
        // into its room (vertigoFix.js, 2: by where it stood, so the stream
        // draws as it did)
        if (!vertigoOld(2) && !lean && bookHash(a, sy) < MISSING) {
          a += (w + 0.006 + vr() * 0.035) / rf / deg;
          lean = w * 0.9;
          run--;
          continue;
        }
        // (pivoted on its foot at the edge of the gap, its head on the book across it)
        const th = lean ? Math.min(0.36, Math.asin(Math.min(0.9, lean / hh))) : 0;
        const am = a + ((w / 2) * Math.cos(th) - (hh / 2) * Math.sin(th)) / rf / deg, p = add(c, dir(am), rf + R.set + R.d / 2);
        shelved.push({ ...book, p: [p[0], sy + (w / 2) * Math.sin(th) + (hh / 2) * Math.cos(th), p[1]], rot: [0, -(am + 90) * deg, th], s: [w, hh, R.d] });
        a += (w * Math.cos(th) + 0.006 + vr() * 0.035) / rf / deg;
        lean = 0;
        run--;
      }
    };
    // A ring's books painted (bookRows), where they are only seen from far
    // off: a strip bent round the ring a little in front of the shelf's face.
    // `tint` (rgb) takes it down the funnel's fall in value.
    const paintedRing = (batch, t, sy, clear, rf, from, to, tint = null) => {
      const { top: vt, base: vb } = rowV[t * BOOK_ROWS.variants + Math.floor(vr() * BOOK_ROWS.variants)];
      const segs = Math.max(1, Math.ceil((to - from) / 4)), r = rf + 0.4, u0 = vr();
      const pos = [], nor = [], uv = [], col = [], idx = [];
      for (let i = 0; i <= segs; i++) {
        const a = from + ((to - from) * i) / segs, p = add(c, dir(a), r), n = dir(a);
        const u = u0 + ((a - from) * deg * r) / BOOK_ROWS.length;
        pos.push(p[0], sy, p[1], p[0], sy + clear, p[1]);
        nor.push(-n[0], 0, -n[1], -n[0], 0, -n[1]);
        uv.push(u, vb, u, vt);
        if (tint) col.push(...tint, ...tint);
      }
      // (wound to face the axis: seen from the middle, the next bearing is to the right)
      for (let i = 0; i < segs; i++) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      if (tint) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      batch.add(g);
    };
    // a ring of board between two radii, over the bearings from `a0` to `a1`
    const arcSlab = (r0, r1, a0, a1) => {
      const n = Math.max(2, Math.ceil((a1 - a0) / 2.5));
      const arc = (r) => Array.from({ length: n + 1 }, (_, s) => add(c, dir(a0 + ((a1 - a0) * s) / n), r));
      return [...arc(r1), ...arc(r0).reverse()];
    };
    // The room's shelves run from jamb to jamb round from the doorway (150),
    // and in the three lower tiers stop either side of the painting (270).
    const jamb0 = 150 + jambA + 1.3, jamb1 = 510 - jambA - 1.3;
    const roomBays = (tier) => (paintings && tier < 3 ? [[jamb0, 244], [296, jamb1]] : [[jamb0, jamb1]]);
    if (!BOOKS_GIANT) {
      // the case's back brought forward to stand behind the books
      const backY = TIER_BASE + 3 * TIER_H, topY = TIER_BASE + TIERS * TIER_H;
      for (const [a0, a1] of roomBays(0)) LB.shelfBack.add(ringGrain(slabGeo(arcSlab(rFace + 4.6, rFace + 5.6, a0, a1), [], backY - TIER_BASE, TIER_BASE), c[0], c[1]));
      LB.shelfBack.add(ringGrain(slabGeo(arcSlab(rFace + 4.6, rFace + 5.6, jamb0, jamb1), [], topY - backY, backY), c[0], c[1]));
    }
    for (let tier = 0; tier < TIERS; tier++) {
      const y = TIER_BASE + tier * TIER_H;
      LB.shelf.add(ringGrain(slabGeo(caseRing, [], 2.4, y - 2.4), c[0], c[1]));
      if (!vertigoOld(3)) LB.shelfLip.add(shelfLip(c, rFace, y, y - 2.4, 150 + jambA, 510 - jambA));
      for (let s = 0; s < 170; s++) {
        const a = (360 * s) / 170, off = Math.abs(((a - 150 + 540) % 360) - 180);
        if (off < 12) continue;
        if (paintings && tier < 3 && Math.abs(((a - 270 + 540) % 360) - 180) < 26) continue;
        const p = add(c, dir(a), rWall - 5.5), hh = rr(12, TIER_H - 3), w = rr(2.6, 3.6), color = pick(BOOKS);
        // The books where the doorway's piers now stand are still drawn: the
        // garden is laid out from the same stream (see `resume`). And so are
        // the giants (?wbookscale=old), real books shelved below in their place.
        if (off < jambA + 1.3 || !BOOKS_GIANT) continue;
        books.push({ p: [p[0], y + hh / 2, p[1]], rot: [0, -(a + 90) * deg, 0], s: [w, hh, 9], color: color && funnelColor(p, y) });
      }
      if (BOOKS_GIANT) continue;
      // A box to every book in the three tiers the eye is level with; the
      // two over them, seen only from far below, painted.
      const wall = shelvedWalls++;
      shelvesOf(tier, y).forEach(({ y: sy, clear }, j) => {
        for (const [a0, a1] of roomBays(tier)) {
          if (j > 0) LB.shelf.add(ringGrain(slabGeo(arcSlab(rFace, rFace + 4.6, a0, a1), [], BOARD, sy - BOARD), c[0], c[1]));
          if (j > 0 && !vertigoOld(3)) LB.shelfLip.add(shelfLip(c, rFace, sy, sy - BOARD, a0, a1));
          if (tier < 3) {
            shelveRing(tier, sy, clear, rFace, a0, a1, wall);
            paintedRing(lodFor(wall, 3), tier, sy, clear, rFace, a0, a1);
          } else paintedRing(LB.bookRows, tier, sy, clear, rFace, a0, a1);
        }
      });
    }
    // ── The funnel ──
    // Below the floor the pit narrows 460 down to a throat of light, lined the
    // whole way with shelves set back into its stone. The stair winds down the
    // face of them on a carved carriage bracketed into the wall, its open side
    // railed in bronze — but for the one place, a few steps down, where the rail
    // has given way and the fall begins (and, since 2026-10-08, the same place
    // on every turn below it: spiral.js GAPS). Lamps hang in the well at every depth,
    // so that looking down there is something to measure the drop by, and loose
    // pages turn slowly all the way down it. (A smooth brown cone with a disc of
    // light at the bottom had nothing in it to say how far down the light was.)
    //
    // All of this draws on the world's random stream far more than the plainer
    // funnel did, and the garden is laid out from that same stream: `resume`
    // puts the stream back where the old funnel left it (see the end).
    const resume = seed;
    const { depth: DEPTH, neck: NECK, drop: DROP, steps: STEPS, turns: TURNS } = SPIRAL;
    const RECESS = 12;
    // Keep the risers walkable on every device. Reducing this to 120 made
    // sideways foot support drop farther than a tread on the curved flight.
    // where the rail is gone (spiral.js): a stretch of every turn, at the same
    // bearing (the Vertigo's stand is in the first, at 0.06) — and between
    // them, where it still stands
    const RAILED = [...GAPS.map((g, k) => [k ? GAPS[k - 1][1] : 0, g[0]]), [GAPS.at(-1)[1], 1]];
    const inGap = (t) => GAPS.some(([t0, t1]) => t >= t0 && t <= t1);
    const coneR = (y) => rMouth + (NECK - rMouth) * ((6 - y) / DEPTH);   // the face of the shelves at a height
    const treadW = () => SPIRAL.width;
    const bearing = (t) => 170 + t * TURNS * 360;
    const inner = (t) => coneR(4 - t * DROP) - treadW(t) - 1;           // the stair's open edge
    const facing = (a) => Math.PI / 2 - a * deg;                         // turns a box's +z out along bearing a
    // where the stair is, a fraction `t` of the way down: its tread, its bearing, its open edge
    stairAt = (t) => spiralAt(c, t);
    const carved = new Batch(Std({
      map: again(pale.map, 1), normalMap: again(pale.normalMap, 1), roughnessMap: again(pale.roughnessMap, 1),
      color: '#b3a796', roughness: 1, side: THREE.DoubleSide,
    }));

    // the dark wood at the back of the shelves
    // (5 behind the face for real books, 12 for the giants)
    const BACK = BOOKS_GIANT ? RECESS : 5;
    const back = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(rMouth + BACK, NECK + BACK, DEPTH, light ? 48 : 96, 1, true)),
      Std({ map: withRepeat(wood.map, WOOD_OLD ? [36, 26] : [16, 46]), color: '#4a3a2e', roughness: 1, side: THREE.BackSide }),
    );
    back.position.set(c[0], 6 - DEPTH / 2, c[1]);
    back.receiveShadow = true;
    root.add(back);
    // The funnel's painted rows (see below): the far shelves' paint, with the
    // giants' fall in value as a colour per ring and the light at the bottom
    // of the well climbing its last turns, as the books' own shader has it.
    const funnelRowsMat = Std({ map: bookRowsSet.map, roughness: 0.85, vertexColors: true });
    funnelRowsMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
        varying float vDeep;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        vDeep = pow(smoothstep(-150.0, -440.0, (modelMatrix * vec4(transformed, 1.0)).y), 1.5);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
        varying float vDeep;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.62, 0.32) * vDeep * 0.9;`);
    };
    funnelRowsMat.customProgramCacheKey = () => 'babel-funnel-rows';
    const funnelRows = new Batch(funnelRowsMat, { cast: false });
    // uprights down the slope of the funnel between the bays
    const UPRIGHTS = light ? 12 : 18, slope = Math.atan((rMouth - NECK) / DEPTH), uprightAt = [];
    for (let k = 0; k < UPRIGHTS; k++) {
      const a = (360 * k) / UPRIGHTS + 7, yMid = 6 - DEPTH / 2, p = add(c, dir(a), coneR(yMid) + RECESS / 2);
      uprightAt.push(a);
      LB.shelf.add(new THREE.BoxGeometry(2.6, DEPTH / Math.cos(slope), RECESS).rotateX(slope).rotateY(facing(a)).translate(p[0], yMid, p[1]));
    }
    // a shelf every tier, and its books
    for (let k = 0; (k + 1) * TIER_H < 6 + DROP; k++) {
      const y = 6 - (k + 1) * TIER_H, face = coneR(y), n = light ? 40 : 80;
      LB.shelf.add(ringGrain(slabGeo(circlePts(c, face + RECESS + 0.5, n), [circlePts(c, face - 0.6, n)], 2.4, y - 2.4), c[0], c[1]));
      if (!vertigoOld(3)) LB.shelfLip.add(shelfLip(c, face - 0.6, y, y - 2.4, 0, 360, 360 / n));
      const rs = face + 5.3;
      for (let u = rr(0, 3); u < 2 * Math.PI * rs - 3;) {
        const w = rr(2.3, 4.4), a = (u + w / 2) / rs / deg;
        const clear = !uprightAt.some((ua) => Math.abs(((a - ua + 540) % 360) - 180) * deg * rs < 1.5 + w / 2);
        if (clear && rnd() > 0.035) {
          const hh = rr(11, k === 0 ? 13 : 17.5), p = add(c, dir(a), rs);
          const tip = rnd() < 0.05 ? rr(-0.25, 0.25) : 0, color = pick(BOOKS) && funnelColor(p, y), shade = rr(0.7, 1.05);
          // On the four shelves nearest the head of the stair, shelved by
          // hand: one taken out here and there, others leaning into the room
          // it left, some pushed to the back. Every book stood upright at one
          // depth read as rings of bricks. Decided by where the book stands —
          // the draws above are the garden's (see `resume`), all still made.
          const h = k < 4 ? Math.abs(Math.sin(p[0] * 39.346 + p[1] * 11.135 + y * 7.11) * 24634.6345) % 1 : 1;
          if (h >= 0.06 && BOOKS_GIANT) {
            const lean = h < 0.2 ? (h < 0.13 ? 1 : -1) * (0.1 + 0.14 * ((h * 53) % 1)) : tip;
            const q = h > 0.2 && h < 0.29 ? add(c, dir(a), rs + 1.8) : p;
            books.push({ p: [q[0], y + hh / 2, q[1]], rot: [0, -(a + 90) * deg, lean], s: [w, hh, 9], color, k: shade });
          }
        }
        u += w + rr(0.12, 0.8);
      }
      if (BOOKS_GIANT) continue;
      // Real books: four shelves of quartos to the giants' one, each a
      // little wider round than the one below it as the funnel opens upward,
      // between the uprights. Boxes in the seven rings the stair's head looks
      // across and down into; deeper, where the funnel is only ever looked
      // down into from far above, painted, and taken down in value and warmed
      // by the light below as the giants' colours were.
      const wall = shelvedWalls++;
      const T = 1, n2 = light ? 40 : 80;
      shelvesOf(T, y).forEach(({ y: sy, clear }, j) => {
        const rf = coneR(sy);
        if (j > 0) LB.shelf.add(ringGrain(slabGeo(circlePts(c, rf + BACK + 0.5, n2), [circlePts(c, rf - 0.6, n2)], BOARD, sy - BOARD), c[0], c[1]));
        if (j > 0 && !vertigoOld(3)) LB.shelfLip.add(shelfLip(c, rf - 0.6, sy, sy - BOARD, 0, 360, 360 / n2));
        const half = 1.45 / rf / deg;
        const deep = Math.min(1, Math.max(0, (6 - sy) / 260)), glow = Math.min(1, Math.max(0, (-250 - sy) / 180)), v = 1.05 - 0.6 * deep;
        const tint = [0.78, 0.54, 0.3].map((lit) => v + (lit - v) * 0.38 * glow * glow);
        if (k < 7) {
          uprightAt.forEach((ua, i) => {
            const a0 = ua + half, a1 = (i + 1 < uprightAt.length ? uprightAt[i + 1] : uprightAt[0] + 360) - half;
            shelveRing(T, sy, clear, rf, a0, a1, wall);
          });
        }
        // (the paint all the way round, behind the uprights)
        paintedRing(k < 7 ? lodFor(wall, 3) : funnelRows, T, sy, clear, rf, uprightAt[0], uprightAt[0] + 360, k < 7 ? null : tint);
      });
    }

    // the treads, a sconce every so often on the wall string, books left on the steps
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS, y = 4 - t * DROP, rf = coneR(y), a = bearing(t), w = treadW(t);
      const len = ((2 * Math.PI * (rf - w / 2) * TURNS) / STEPS) * 1.08;
      LB.step.add(placed(new THREE.BoxGeometry(w, 3, Math.max(1.5, len)), add(c, dir(a), rf - w / 2 - 1), y, -a * deg));
      if (s % Math.round(STEPS / 12) === 5) {
        const la = a + 1, lp = add(c, dir(la), rf - 3.4), stem = add(c, dir(la), rf - 0.9);
        // a small lantern on a wall bracket (lampPass.js; ?wlampsoff=sconce: as it was)
        const trial = LAMPS.sconce && stairSconce({ wall: add(c, dir(la), rf - 0.6), ry: (180 - la) * deg, y });
        if (trial) {
          trial.bronze.forEach((g) => LB.bronze.add(g));
          if (trial.globe) globes.push(trial.globe);
          if (trial.pane) trialPanes.push(trial.pane);
        } else {
          LB.bronze.add(rodGeo([stem[0], y + 5, stem[1]], [stem[0], y + 14.2, stem[1]], 0.32));
          LB.bronze.add(rodGeo([stem[0], y + 14, stem[1]], [lp[0], y + 13.4, lp[1]], 0.28));
          LB.bronze.add(placed(new THREE.CylinderGeometry(0.6, 1.25, 1, 12), lp, y + 13.2));
          globes.push({ p: [lp[0], y + 11.2, lp[1]], s: [1.5, 1.5, 1.5], color: '#fff3e2', k: 1.2 });
        }
        halo(lp, y + 11, 28, '#ffb866', 0.34, trial ? lampHaloTex : undefined);
        point(lp, y + 11, '#ffb866', 3400, -1);
      }
      if (s > 2 && s % 7 === 3 && rnd() < 0.5) {
        // Leave the middle of the tread clear. These low piles are solid to
        // the feet; set back beside the wall string they can be passed.
        const bp = add(c, dir(a + rr(-1, 1)), rf - 1.6 * (1 - t * 0.35)), yaw = -a * deg + rr(-0.35, 0.35);
        // (folios of 47-66 cm by 34-43, 10-18 thick, as the giants were; at
        // their real size since 2026-10-06, the draws as they were)
        const pk = BOOKS_GIANT ? 1 : 0.42, pl = BOOKS_GIANT ? 1 : 0.76;
        for (let n = 0, top = y + 1.5, count = 1 + Math.floor(rnd() * 3); n < count; n++) {
          const th = rr(1.1, 1.9) * pk;
          books.push({ p: [bp[0], top + th / 2, bp[1]], rot: [0, yaw + rr(-0.2, 0.2), Math.PI / 2], s: [th, rr(5, 7) * (1 - t * 0.3) * pl, rr(3.6, 4.6) * pl],
            // lying down, a book shows its cover in the bindings' dark side tone:
            // shelf leather there read as a hole in the stair, so paler calf
            color: pick(['#8a6a48', '#7a5c40', '#6e5a44', '#5f6452', '#7a4a3a']), k: rr(0.9, 1.2) });
          top += th;
        }
      }
    }

    // A profile in (radius, height), swept down the stair from t0 to t1; `cap`
    // closes its top end, where the stair leaves the floor.
    const sweep = (profileAt, t0, t1, cap = false, uvScale = 36) => {
      const samples = Math.max(2, Math.ceil((t1 - t0) * STEPS * 3)), n = profileAt(t0).length;
      const pos = [], uv = [], index = [];
      let run = 0, last = null;
      for (let i = 0; i <= samples; i++) {
        const t = t0 + ((t1 - t0) * i) / samples, prof = profileAt(t), [ux, uz] = dir(bearing(t));
        const spot = [c[0] + ux * prof[0][0], prof[0][1], c[1] + uz * prof[0][0]];
        if (last) run += Math.hypot(spot[0] - last[0], spot[1] - last[1], spot[2] - last[2]);
        last = spot;
        for (let k = 0, around = 0; k < n; k++) {
          const [r0, y0] = prof[k], [r1, y1] = prof[(k + 1) % n], edgeLen = Math.hypot(r1 - r0, y1 - y0);
          pos.push(c[0] + ux * r0, y0, c[1] + uz * r0, c[0] + ux * r1, y1, c[1] + uz * r1);
          uv.push(run / uvScale, around / uvScale, run / uvScale, (around + edgeLen) / uvScale);
          around += edgeLen;
        }
      }
      for (let i = 0; i < samples; i++) {
        for (let k = 0; k < n; k++) {
          const a = (i * n + k) * 2, b = a + n * 2;
          index.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(index);
      g.computeVertexNormals();
      if (!cap) return g;
      const [ux, uz] = dir(bearing(t0));
      const end = new THREE.ShapeGeometry(new THREE.Shape(profileAt(t0).map(([r, y]) => new THREE.Vector2(r, y))));
      const ep = end.attributes.position, eu = end.attributes.uv;
      for (let i = 0; i < ep.count; i++) {
        const r = ep.getX(i), y = ep.getY(i);
        ep.setXYZ(i, c[0] + ux * r, y, c[1] + uz * r);
        eu.setXY(i, r / uvScale, y / uvScale);
      }
      end.computeVertexNormals();
      const merged = mergeGeometries([g.toNonIndexed(), end.toNonIndexed()], false);
      g.dispose();
      end.dispose();
      return merged;
    };
    const yAt = (t) => 4 - t * DROP;
    // the carriage: a closed string on the open side standing proud of the treads,
    // and a soffit under them sloping up into the wall
    const carriage = (t) => {
      const y = yAt(t), rw = coneR(y), ri = inner(t);
      return [[ri - 1.8, y + 2.2], [ri - 1.8, y - 8], [ri + 3, y - 9], [rw - 0.4, y - 4.5], [rw - 0.4, y - 2.6], [ri + 0.6, y - 2.6], [ri + 0.6, y + 2.2]];
    };
    carved.add(sweep(carriage, 0, 1, true));
    // A roll moulding along the top of the open string and a fillet under it:
    // the edge the eye crosses first, looking down, was a plain square arris.
    const roll = (t) => {
      const y = yAt(t) + 2.3, rc = inner(t) - 1.25;
      return Array.from({ length: 10 }, (_, k) => [rc + Math.cos((k * Math.PI) / 5) * 1.15, y + Math.sin((k * Math.PI) / 5) * 1.0]);
    };
    const fillet = (t) => {
      const y = yAt(t), ri = inner(t);
      return [[ri - 2.35, y - 0.5], [ri - 2.35, y - 1.7], [ri - 1.8, y - 1.7], [ri - 1.8, y - 0.5]];
    };
    carved.add(sweep(roll, 0, 1));
    carved.add(sweep(fillet, 0, 1));
    // the wall string, where the treads meet the shelves (at the stair's head
    // no higher than the floor: its first few degrees stood 2.8 proud of the
    // floor's edge, a plank across the way onto the stair)
    carved.add(sweep((t) => {
      const y = yAt(t), rw = coneR(y), top = VLAND_OLD ? y + 4.8 : Math.min(y + 4.8, 5.9);
      return [[rw - 1.5, top], [rw - 1.5, y - 3.2], [rw + 0.9, y - 3.2], [rw + 0.9, top]];
    }, 0, 1, true));
    // corbels under the carriage, into the wall
    for (let k = 1; k < (light ? 18 : 34); k++) {
      const t = k / (light ? 18 : 34), y = yAt(t), rw = coneR(y), a = bearing(t);
      for (const [depth, h, top, wide] of [[5, 6, -4.2, 3.2], [3, 4, -10, 2.6]]) {
        const p = add(c, dir(a), rw + 0.5 - depth / 2);
        carved.add(new THREE.BoxGeometry(wide, h, depth).rotateY(facing(a)).translate(p[0], y + top - h / 2, p[1]));
      }
    }
    // The stair's head (2026-10-07: "the staircase has a weird hole that
    // makes it look unsafe"). The stair's first tread begins at 166.5°, but
    // the rim round the mouth stopped at 153°: for a stride beside the newel
    // the floor just ended over the drop, nothing to stand on, nothing to
    // hold. The floor now runs on over the pit to the first tread as a
    // landing, carried on the stair's own carriage swept back level under it,
    // and the rim turns in along the landing's end and runs on along its open
    // edge to the newel. (?wvland=old: the head as it was.)
    const LAND0 = 153;   // where the rim stops: a corner of the floor's 80-sided hole
    const beside = (a, r, off) => add(add(c, dir(a), r), dir(a + 90), off);
    if (!VLAND_OLD) {
      // the paving, its outer edge on the hole's own corners (so the floor's
      // joint is a joint, not a sliver of the two overlapping), and on a
      // little way over the first tread's back
      const back = 167.5, chord = (rMouth * Math.cos(2.25 * deg)) / Math.cos((back - 168.75) * deg), rIn = inner(0) + 0.1;
      const outer = [153, 157.5, 162, 166.5].map((a) => add(c, dir(a), rMouth));
      const edge = Array.from({ length: 9 }, (_, k) => add(c, dir(back - ((back - LAND0) * k) / 8), rIn));
      LB.floor.add(slabGeo([...outer, add(c, dir(back), chord), ...edge], [], 6, 0));
      // the carriage under it, level, closed at the landing's end
      const tHead = (LAND0 - 170) / (TURNS * 360), level = (prof) => () => prof(0);
      carved.add(sweep(level(carriage), tHead, 0, true));
      carved.add(sweep(level(roll), tHead, 0));
      carved.add(sweep(level(fillet), tHead, 0));
      for (const a of [157, 163]) {
        for (const [depth, h, top, wide] of [[5, 6, -4.2, 3.2], [3, 4, -10, 2.6]]) {
          const p = add(c, dir(a), coneR(4) + 0.5 - depth / 2);
          carved.add(new THREE.BoxGeometry(wide, h, depth).rotateY(facing(a)).translate(p[0], 4 + top - h / 2, p[1]));
        }
      }
      // (?wvrail=old) the rim, turned in along the landing's end and on along its edge
      if (VRAIL_OLD) {
        LB.bronze.add(boxGeo(beside(LAND0, rMouth + 2.6, 1.3), beside(LAND0, inner(0) - 1.9, 1.3), 9, 2.6, 6));
        for (let a = LAND0; a < 168; a += 4.5) LB.bronze.add(boxGeo(add(c, dir(a), inner(0) - 0.6), add(c, dir(Math.min(168, a + 4.5)), inner(0) - 0.6), 9, 2.6, 6));
      }
    }
    if (!VRAIL_OLD) {
      // The rail, iron and walnut (vertigoRail.js): round the mouth from
      // beside the stair to the landing, in along its end, along its edge to
      // the newel; and down the stair's open edge, but for the gap.
      const rimR = rMouth + 1.3, railR = inner(0) - 0.9;
      const turnIn = beside(LAND0, Math.sqrt(rimR ** 2 - 0.81), 0.9), atEdge = beside(LAND0, railR, 0.9);
      const rimTo = 360 + LAND0 + Math.asin(0.9 / rimR) / deg, edgeFrom = LAND0 + Math.atan2(0.9, railR) / deg;
      const n = Math.ceil((rimTo - 184.5) / 2.25), m = Math.ceil((170 - edgeFrom) / 2.25);
      // (with ?wvland=old there is no landing, and the rail stops at the rim's end)
      const rim = [...Array.from({ length: n }, (_, k) => add(c, dir(184.5 + ((rimTo - 184.5) * k) / n), rimR)), turnIn];
      const level = VLAND_OLD ? rim : [...rim, atEdge, ...Array.from({ length: m }, (_, k) => add(c, dir(edgeFrom + ((170 - edgeFrom) * (k + 1)) / m), railR))];
      buildVertigoRail({
        level, corners: VLAND_OLD ? [] : [n, n + 1], toHead: !VLAND_OLD, floor: 6, head: add(c, dir(170), railR),
        helix: {
          at: (t) => add(c, dir(bearing(t)), inner(t) - 0.9), tread: (t) => yAt(t) + 1.5, base: (t) => yAt(t) + 2.2,
          runs: RAILED, samples: STEPS * 3,
        },
        newBatch: (mat) => new Batch(mat), M, instances, mouldGeo,
      });
    } else {
      // a newel where the stair leaves the floor
      {
        const p = add(c, dir(bearing(0)), inner(0) - 0.6);
        carved.add(placed(new THREE.CylinderGeometry(2, 2.6, 21, 12), p, 6.5));
        LB.bronze.add(placed(new THREE.SphereGeometry(2, 14, 10), p, 18.6));
      }
      // the handrail and its balusters, spaced by distance along the open edge
      const rail = (t) => Array.from({ length: 6 }, (_, k) => [inner(t) - 0.9 + Math.cos((k * Math.PI) / 3) * 0.6, yAt(t) + 12 + Math.sin((k * Math.PI) / 3) * 0.6]);
      // The fall and the return use this opening. Keep both the solid rail
      // and its posts out of the gap, with the end knobs below marking it.
      for (const [t0, t1] of RAILED) LB.bronze.add(sweep(rail, t0, t1));
      const railAt = (t, lift, inset = 0) => { const p = add(c, dir(bearing(t)), inner(t) - 0.9 - inset); return [p[0], yAt(t) + lift, p[1]]; };
      for (let s = 1, samples = STEPS * 4, since = 4.5; s <= samples; s++) {
        const t = s / samples, dt = 1 / samples;
        since += Math.hypot((2 * Math.PI * inner(t) * TURNS) * dt, DROP * dt);
        if (since < 4.5) continue;
        since = 0;
        if (inGap(t)) continue;
        balusters.push({ p: railAt(t, 2.2), s: [0.6, 1.55, 0.6] });
      }
      // Where it gave way the rail just stops, a knob on each end. (A rail torn
      // down into the gap, a baluster knocked askew and the sockets of the lost
      // ones, a stride from the reader's eye, stood in the frame like a bronze
      // bone and a row of black holes.)
      for (const t of GAPS.flat()) {
        const p = railAt(t, 12);
        LB.bronze.add(new THREE.SphereGeometry(0.95, 12, 8).translate(p[0], p[1], p[2]));
      }
    }

    // An open book left lying where the rail has gone (spiral.js `bookAt`):
    // a folio, open at the same page on every turn, a few treads into the gap
    // on the open side of the tread — someone set it down here — so that a
    // reader who walks on down knows the place again each time they come
    // round to it. Lying across the tread, which is wider than it is long.
    // (Not on the world's stream: nothing here is drawn.)
    const openBook = (x, y, z, yaw) => {
      const parts = [[new THREE.BoxGeometry(6, 0.14, 4.2).translate(0, 0.07, 0), 'leather']];
      for (const side of [-1, 1]) {
        parts.push([new THREE.BoxGeometry(2.8, 0.34, 3.95).translate(side * 1.45, 0.17, 0).rotateZ(-side * 0.06).translate(0, 0.14, 0), 'paper']);
      }
      return parts.map(([g, k]) => [g.rotateY(yaw).translate(x, y, z), k]);
    };
    const BOOK_IN = 4.2;   // its middle, in from the open edge
    if (!BRINK_OLD) {
      for (const [t0] of GAPS) {
        const t = bookAt(t0, STEPS), p = add(c, dir(bearing(t)), inner(t) + BOOK_IN);
        for (const [g, k] of openBook(p[0], yAt(t) + 1.5, p[1], -bearing(t) * deg + 0.15)) LB[k].add(g);
      }
    }

    // Lamps hung in the well at every depth, well clear of the stair and of the
    // line the fall takes down the middle, their chains running up into the dark.
    const hanging = light
      ? [[20, 30, -80, 7], [290, 14, -270, 5]]
      : [[20, 30, -70, 7], [140, 22, -170, 6], [290, 14, -270, 5], [65, 9, -345, 3.5]];
    // (The nearest a step down from the rest — the brightest thing in the
    // frame should be the light at the bottom — and all of them on a chain
    // of half the gauge: from the stand the old one was the heaviest line in
    // the picture, cutting it from the corner to the middle.)
    hanging.forEach(([b, off, y, r], i) => lamp(add(c, dir(b), off), {
      y, r, light: i === 0 ? 4800 : 4200, priority: -1, strength: i === 0 ? 0.85 : 1.1, pool: 0, beam: false, chain: 52, link: 0.55,
    }));

    // The light at the bottom: a hot core in the throat, the funnel's floor
    // glowing round it, light standing up the well and hanging in its air in
    // thinning layers — each sized to fade out before it meets the shelves.
    const wellTex = tex(paint(256, 256, (g) => {
      const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, '#fffaf0');
      grd.addColorStop(0.35, '#ffe2a8');
      grd.addColorStop(0.72, '#e8984e');
      grd.addColorStop(1, '#5a2e12');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
    }), [1, 1]);
    pitCore = new THREE.Mesh(keep(new THREE.CircleGeometry(NECK - SPIRAL.width - 6, 48)), keep(new THREE.MeshBasicMaterial({ map: wellTex, color: '#ffe4b4', toneMapped: false })));
    pitCore.name = 'sky';
    pitCore.rotation.x = -Math.PI / 2;
    pitCore.position.set(c[0], 7 - DEPTH, c[1]);
    root.add(pitCore);
    // The light is never reached on foot. Walked down toward it, the disc in
    // the throat keeps 420 below the eye (`tick`) — and since 2026-10-08 the
    // rest of the light goes down with it, the hot core, the glow over it,
    // the column standing up from it and the light it throws: before, only
    // the disc went, and a reader walking on down the endless turns passed
    // the glow, hanging in the well at the depth the light had been, and
    // looked back up at it. However far down they walk, the light below
    // looks as it did from the stair's head. (?wbrink=old: as it was.)
    const sink = BRINK_OLD ? null : { halos: [], shaft: null, glow: null, wish: null };
    if (sink) {
      sink.glow = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(1, 16, 12)), M.glow, 1);
      sink.glow.setMatrixAt(0, new THREE.Matrix4().makeScale(7, 7, 7));
      sink.glow.setColorAt(0, new THREE.Color('#ffe6b8').multiplyScalar(2.2));
      sink.glow.position.set(c[0], -447, c[1]);
      sink.glow.computeBoundingSphere();
      sink.glow.name = 'sky';
      root.add(sink.glow);
    } else lampCores.push({ p: [c[0], -447, c[1]], s: [7, 7, 7], color: '#ffe6b8', k: 2.2 });
    halo(c, -445, 150, '#ffc680', 0.55);
    halo(c, -395, 90, '#ffb060', 0.2);
    if (sink) sink.halos = halos.slice(-2).map((h) => ({ sprite: h.sprite, y: h.sprite.position.y }));
    // (the one column that stays whole with the eye inside it: the fall is down it)
    const column = shaftVolume(new THREE.CylinderGeometry(9, 26, 300, 28, 1, true).rotateX(Math.PI).translate(c[0], -447 + 150, c[1]));
    if (sink) {
      sink.shaft = new THREE.Mesh(keep(column), shaftMaterial);
      sink.shaft.name = 'shafts';
      root.add(sink.shaft);
    } else LB.shafts.add(column);
    for (const [y, o] of [[-110, 0.06], [-190, 0.09], [-260, 0.12], [-320, 0.14], [-370, 0.17], [-410, 0.22]]) {
      decal(c, coneR(y) * 1.9, coneR(y) * 1.9, '#ffb25a', o, y, 0.08);
    }
    point(c, -425, '#ffa64a', 14000, 10, 2, [c[0], c[1], rWall + 14]);
    if (sink) {
      sink.wish = lightWishes.at(-1);
      // (by how far the disc has gone below where it was built, at -453)
      pitSink = (dy) => {
        sink.glow.position.y = -447 + dy;
        for (const h of sink.halos) h.sprite.position.y = h.y + dy;
        sink.shaft.position.y = dy;
        sink.wish.y = -425 + dy;
      };
    }
    // (over the map, the well darkens with depth: mapFix.js, 7 — see pitFade)
    pitCarved = carved.mat;

    // loose pages, turning slowly down the well
    {
      // A page, not a card: printed, curled at its corner as well as across,
      // and lit through — paper this thin holds the lamp's light in it. As a
      // plain pale quad it was the brightest thing in the well and read as a
      // sticker on the frame.
      const leaf = keep(new THREE.PlaneGeometry(4.2, 5.6, 8, 4));
      const lp = leaf.attributes.position;
      for (let i = 0; i < lp.count; i++) {
        const x = lp.getX(i), y = lp.getY(i);
        lp.setZ(i, x ** 2 * 0.14 + x * y * 0.025 + (x > 0.8 && y > 1.2 ? (x - 0.8) * (y - 1.2) * 0.35 : 0));
      }
      leaf.computeVertexNormals();
      const pageTex = tex(paint(256, 342, (g, w, h) => {
        const pr = makeRng(611);
        g.fillStyle = '#efe6d2';
        g.fillRect(0, 0, w, h);
        for (let k = 0; k < 40; k++) {
          const x = pr() * w, y = pr() * h, r = 2 + pr() * 10;
          const fox = g.createRadialGradient(x, y, 0, x, y, r);
          fox.addColorStop(0, `rgba(150,110,60,${0.05 + pr() * 0.1})`);
          fox.addColorStop(1, 'rgba(150,110,60,0)');
          g.fillStyle = fox;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        g.fillStyle = 'rgba(52,38,24,0.55)';
        g.fillRect(w / 2 - 30, 20, 60, 3);
        for (let y = 42; y < h - 40; y += 9) {
          const para = pr() < 0.12;
          let x = 26 + (para ? 14 : 0);
          const end = w - 26 - (pr() < 0.1 ? 60 + pr() * 60 : 0);
          while (x < end) {
            const ww = 6 + pr() * 22;
            g.fillStyle = `rgba(40,30,20,${0.5 + pr() * 0.25})`;
            g.fillRect(x, y, Math.min(ww, end - x), 3);
            x += ww + 4;
          }
        }
        g.fillStyle = 'rgba(52,38,24,0.6)';
        g.fillRect(w / 2 - 6, h - 22, 12, 3);
      }), [1, 1]);
      // Twenty-two, not forty-four. Loose pages are a lovely idea and at that
      // count they were a blizzard: white flecks over every part of the frame,
      // so the well had no quiet anywhere in it.
      //
      // And seven, not twenty-two: fewer, half as large again, falling and
      // turning at a little over half the pace — a page drifting down, not
      // flecks of white crossing the frame. (Twenty-two are still drawn from
      // the stream: the garden is laid out from it, see `resume`.)
      const pages = Array.from({ length: light ? 10 : 22 }, () => ({
        phase: rnd(), frac: rr(0.25, 0.85), spin: rr(0.12, 0.3) * (rnd() < 0.5 ? -1 : 1), fall: rr(5, 9), a0: rr(0, Math.PI * 2), tumble: rr(0.6, 1.4),
      })).slice(0, light ? 4 : 7).map((pg) => ({ ...pg, spin: pg.spin * 0.6, fall: pg.fall * 0.55, tumble: pg.tumble * 0.55 }));
      const mesh = new THREE.InstancedMesh(leaf, Std({
        map: pageTex, color: '#d6cab4', roughness: 0.95, side: THREE.DoubleSide,
        emissive: '#a0703e', emissiveMap: pageTex, emissiveIntensity: 0.36,
      }), pages.length);
      mesh.frustumCulled = false;
      const TOP = -10, SPAN = 420;
      const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), eu = new THREE.Euler(), at = new THREE.Vector3(), sc = new THREE.Vector3();
      drift = (time) => {
        pages.forEach((pg, i) => {
          const down = (time * pg.fall + pg.phase * SPAN) % SPAN, y = TOP - down;
          const r = pg.frac * Math.max(2, inner(Math.min(1, Math.max(0, (4 - y) / DROP))) - 2.5);
          const ang = pg.a0 + time * pg.spin + Math.sin(time * 0.7 + pg.phase * 9) * 0.3;
          at.set(c[0] + Math.cos(ang) * r, y + Math.sin(time * 1.9 + pg.phase * 20) * 1.5, c[1] + Math.sin(ang) * r);
          eu.set(Math.sin(time * pg.tumble + pg.phase * 7) * 1.1, time * pg.tumble * 0.8 + pg.phase * 6, Math.cos(time * pg.tumble * 0.9 + pg.phase * 5) * 0.9);
          // grown in at the top and gone into the light at the bottom
          sc.setScalar(1.5 * Math.max(0.001, Math.min(1, down / 20, (SPAN - down) / 20)));
          mesh.setMatrixAt(i, m4.compose(at, qt.setFromEuler(eu), sc));
        });
        mesh.instanceMatrix.needsUpdate = true;
      };
      drift(0);
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
    // dust in the well's air, lit by whatever lamp it drifts near
    for (let s = 0; s < (light ? 34 : 110); s++) {
      const y = rr(-430, 80), reach = y > 6 ? 90 : Math.max(4, inner(Math.min(1, Math.max(0, (4 - y) / DROP))) - 2);
      const p = add(c, dir(rr(0, 360)), Math.sqrt(rnd()) * reach);
      dust.push({ p: [p[0], y, p[1]], s: Array(3).fill(rr(0.4, 0.9)), color: '#ffdca8', k: 0, phase: rr(0, 100) });
    }
    carved.flush('carved');
    funnelRows.flush('funnelRows');
    spiral = makeEndlessSpiral(c, {
      stone: LB.step.mat ?? carved.mat, bronze: LB.bronze.mat, books: funnelRowsMat,
      // (the same rail on down every turn of it, and the string it stands in)
      rail: VRAIL_OLD ? null : (turn) => endlessRail({ ...turn, mouldGeo, M, carved: carved.mat }),
      // (and the same book, by the same gap, on every one of its turns)
      dress: BRINK_OLD ? null : ({ edge, pitch, angle0, steps }) => {
        const TAU = Math.PI * 2, a0 = bearing(bookAt(GAPS[0][0], STEPS)) * deg;
        const u = Math.round(((((a0 - angle0) % TAU) + TAU) % TAU) / TAU * steps) / steps, a = angle0 + u * TAU;
        return openBook(Math.cos(a) * (edge + BOOK_IN), 1.5 - u * pitch, Math.sin(a) * (edge + BOOK_IN), -a + 0.15).map(([g, k]) => [g, M[k], k]);
      },
    });
    root.add(spiral.root);

    for (const a of [40, 320]) lamp(add(c, dir(a), 84), { light: a === 40 ? 7000 : 0, priority: 4, strength: 1.2, pool: 0.26 });
    hangPainting(3, [c[0], c[1] - rWall + 3.5], 38, [0, 1], 80);
    // The old funnel took two draws a step, one for each of its twelve lamps,
    // two for its haze and four for the rim lamps; every draw advances the seed
    // by the same constant, so this is exactly where it left the stream.
    // Preserve the garden's layout when the lightweight stair gains treads.
    seed = (resume + Math.imul(2 * (light ? 120 : STEPS) + 18, 0x6D2B79F5)) | 0;
  }

  yield 'The Door';
  // V — the Door: shelves on five walls; on the sixth, a way out.
  const DOOR = cellC(4, -4);
  const GATE = add(DOOR, dir(330), A);
  if (!CRACK_OLD && dist(GATE, DOOR_CRACKS.origin) > 1e-6) console.warn("[cracks] painted round a breach that is not the Door's:", DOOR_CRACKS.origin, GATE);
  yield 'The arch';
  // ── The arch ──────────────────────────────────────────────────────────────
  // What stands in the sixth wall (portal.js). It is built in a frame of its
  // own — x along the wall (dir 60) from the middle of the breach, y up, z
  // into the room (dir 150) — and set in the wall here.
  const PORTAL_AXIS = add(GATE, dir(60), 1.5);
  const portalFrame = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(dir(60)[0], 0, dir(60)[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir(150)[0], 0, dir(150)[1]),
  ).setPosition(PORTAL_AXIS[0], 0, PORTAL_AXIS[1]);
  // a point in the arch's frame, on the ground
  const inPortal = (x, z) => add(add(PORTAL_AXIS, dir(60), x), dir(150), z);
  const portalStone = [];
  {
    const into = { carve: LB.portalCarve, dressed: LB.portalDressed, mass: LB.mass, marble: LB.marble, bronze: LB.bronze };
    for (const [name, list] of Object.entries(buildPortal({ light }))) {
      for (const g of list) {
        // (the stone the ivy grows on, in the arch's own frame — ivy.js)
        if (!IVY_OLD) portalStone.push(g.clone());
        into[name].add(g.applyMatrix4(portalFrame));
      }
    }
  }
  {
    const e = edgeFrame(DOOR, 5);
    // Boulders at the foot of the wall on the garden side, either side of the
    // arch. (They were the fallen wall, lying in the breach; the draws are the
    // world's stream's, so they are all still made, and only where the stone
    // is laid has changed.)
    for (let s = 0; s < 60; s++) {
      const out = rr(-6, 40), along = rr(-46, 46);
      if (Math.abs(along) < 13) continue; // a way through, for the walk
      const off = 27 + ((out + 6) / 46) * 10, sideways = Math.sign(along) * (34 + ((Math.abs(along) - 13) / 33) * 15);
      const p = add(add(GATE, e.n, off), e.t, sideways);
      rubble.push({ p: [p[0], rr(5, 12), p[1]], rot: rot3(), s: Array(3).fill(rr(2.5, 9)), color: pick(['#8a8176', '#6f675c', '#9c948a']) });
    }
    // What fell when the stone that walled the arch up gave way ("between two
    // shelves the stone gives way"), lying where it came down. Without it the
    // Door's pavement was forty per cent of the frame with nothing whatever on
    // it.
    //
    // It was then a hundred-odd chips of one size spread evenly over the lot,
    // which read as confetti. Those draws are still made (the garden is laid
    // out from the same stream) and thrown away; what the floor gets instead
    // is below, from a stream of its own.
    const ghostRubble = [];
    for (let k = 0; k < (light ? 40 : 110); k++) {
      // Nothing big close to where the reader stands: a chunk of wall at eye
      // distance reads as a boulder in the room rather than as debris.
      const into = Math.sqrt(rnd()) * 88;
      const p = add(add(GATE, e.n, -into), e.t, rr(-60, 60) * (0.35 + into / 150));
      const grit = rnd() < 0.88 || into > 55;
      ghostRubble.push({
        p: [p[0], 6 + (grit ? rr(0.1, 0.45) : rr(0.9, 2.2)), p[1]],
        rot: rot3(),
        s: grit ? [rr(0.5, 1.7), rr(0.22, 0.6), rr(0.5, 1.7)] : [rr(2.4, 5), rr(1.1, 2.4), rr(2.4, 5)],
        color: pick(['#a49a8c', '#8a8176', '#b0a698', '#79716a']),
      });
    }
    // What a wall leaves when it comes down: a few of its own blocks out in
    // front of the arch, tilted where they fell; a fan of smaller stone thrown
    // out into the room from the threshold, thinning and getting smaller as it
    // goes; grit, and a tongue of pale dust. Big pieces keep off the way
    // through, and nothing lies on the arch's own footings.
    {
      const dr = makeRng(4404), within = (a, b) => a + (b - a) * dr();
      const at = (along, into) => add(add(GATE, e.n, -into), e.t, along);
      // nothing on the footing of the arch: its jambs and piers stand out to
      // about twenty-four units into the room, either side of the threshold
      const onArch = (along, into) => Math.abs(along - 1.5) > 11.5 && into < 25;
      const clear = (along, into, size) => !onArch(along, into) && (size < 0.8 || into > 90 || Math.abs(along - 6) > 10 + size);
      if (RUBBLE_OLD) {
        const fr = makeRng(4405);
        for (const [along, into, w, h, d] of DOOR_FALLEN) {
          const q = at(along, into);
          const g = brokenBlock(w, h, d, fr).rotateX(within(-0.22, 0.22)).rotateZ(within(-0.28, 0.28)).rotateY(within(0, Math.PI * 2));
          LB.moonStone.add(g.translate(q[0], 6 + h * 0.4, q[1]));
        }
        const stone = ['#b8ae9e', '#a89f91', '#c2b9aa', '#9d9486'];
        for (let k = 0; k < 48; k++) {
          const into = 5 + dr() ** 1.25 * 72, spread = 16 + into * 0.8, along = within(-spread, spread);
          const size = 2.9 * (1 - into / 100) * (0.45 + dr() * 0.75);
          if (!clear(along, into, size)) continue;
          const q = at(along, into);
          doorRubble.push({ p: [q[0], 6 + size * 0.28, q[1]], rot: [dr() * 3, dr() * 3, dr() * 3], s: [size, size * (0.45 + dr() * 0.3), size * (0.7 + dr() * 0.5)], color: stone[Math.floor(dr() * 4)] });
        }
        for (let k = 0; k < (light ? 30 : 80); k++) {
          const into = dr() ** 1.6 * 40, along = within(-24 - into * 0.6, 24 + into * 0.6);
          const q = at(along, into), g = 0.3 + dr() * 0.6;
          if (onArch(along, into)) continue;
          doorRubble.push({ p: [q[0], 6.1, q[1]], rot: [dr() * 3, dr() * 3, dr() * 3], s: [g, g * 0.4, g], color: stone[Math.floor(dr() * 4)] });
        }
      } else {
        // (rubble.js: the same layout the crack painter shaded the floor round)
        const { blocks, stones } = rubbleLayout(DOOR_FALLEN, DOOR_CRACKS);
        // (sharp where they broke fresh: doorProps.js, 8)
        for (const k of blocks) LB.rubbleBlocks.add(fallenBlock(k, { floor: 6, light, crisp: !doorPropsOld(8) }));
        // (what broke off a block is as solid as the block; the stones darken
        // where a block stands over them)
        for (const s of stones) (s.felt ? LB.rubbleBlocks : s.size >= 1.3 ? LB.rubbleBig : LB.rubble).add(fragment(s, { floor: 6, near: blocks }));
      }
      // the dust: pale, heaviest at the breach, a tongue into the room
      const fan = new THREE.PlaneGeometry(1, 1, 8, 12).rotateX(-Math.PI / 2);
      const fp = fan.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const u = fp.getX(i), v = fp.getZ(i) + 0.5;           // v: 0 at the breach, 1 in the room
        const q = at(1.5 + u * (22 + v * 66), v * 62 - 2);
        fp.setXYZ(i, q[0], 6.13, q[1]);
      }
      fan.computeVertexNormals();
      LB.dustFan.add(fan);
      // Books that came down with it, off the shelves the stone carried: lying
      // where they fell among the rubble, one of them open on its face. (Off
      // the way through, where the walk goes.)
      const fallen = [[-27, 24, 0.4, 0.12], [-19, 33, 2.1, -0.08], [-33, 40, 1.2, 0.2], [21, 27, 2.6, -0.15], [30, 36, 0.9, 0.1]];
      // (folios, 41-47 cm, since 2026-10-06: they were 90 cm-1.2 m across)
      const fk = BOOKS_GIANT ? 1 : 0.46;
      // (They lay shut, plain and dark, and from the stand read as tiles. One
      // of the shut ones is in vellum now; and where a giant's two boards lay
      // nearly flat on their face, a dark slab, a folio lies splayed open on
      // its back with its leaves lifting, and another has fallen open on its
      // face, a tent with its lettered spine up: doorProps.js, 5.)
      const strewn = !doorPropsOld(5);
      fallen.forEach(([along, into, yaw, tilt], i) => {
        const q = at(along, into), th = (1.7 + (i % 3) * 0.4) * (BOOKS_GIANT ? 1 : 0.36);
        const vellum = strewn && i === 2;
        books.push({ p: [q[0], 6 + th / 2 + Math.abs(tilt) * 2 * fk, q[1]], rot: [tilt, yaw, -tilt * 0.6], s: [(9.5 + i * 0.7) * fk, th, 7 * fk], color: vellum ? '#a59576' : ['#5a2923', '#6f4c31', '#221d19', '#7d5738', '#8e8062'][i], k: 0.9, spine: LAID + (vellum ? SPINE_KINDS.vellum[0] + 3 : SPINE_KINDS.label[0] + i * 2) });
      });
      if (strewn) {
        const q = at(-11, 46);
        for (const [g, k] of splayedBook()) LB[k].add(g.rotateY(2.45).translate(q[0], 6.02, q[1]));
        const tent = tentBook(), tq = at(27, 51), yaw = 0.95;
        for (const [g, k] of tent.parts) LB[k].add(g.rotateY(yaw).translate(tq[0], 6.02, tq[1]));
        // (its spine: a book's own, lettered, laid along the ridge and turned up)
        books.push({ p: [tq[0], 6.02 + tent.spine[0], tq[1]], rot: [-Math.PI / 2, 0, yaw], s: [tent.spine[1], tent.spine[2], 0.3], color: '#5a2923', k: 1, spine: SPINE_KINDS.label[0] + 5 });
      } else {
        const q = at(-11, 46);
        for (const side of [-1, 1]) {
          const half = new THREE.BoxGeometry(4.6, 0.22, 6.4).translate(side * 2.25, 0, 0).rotateZ(-side * 0.14).rotateY(0.7);
          LB.leather.add(half.translate(q[0], 6.75, q[1]));
          LB.paper.add(new THREE.BoxGeometry(4.3, 0.5, 6.0).translate(side * 2.1, -0.32, 0).rotateZ(-side * 0.14).rotateY(0.7).translate(q[0], 6.75, q[1]));
        }
      }
      // and the garden coming in after it: wisteria petals blown a little way
      // into the room along the green light, thinning as they go
      const pr = makeRng(5150);
      for (let k = 0; k < (light ? 30 : 80); k++) {
        const into = -2 + 50 * pr() ** 1.8, along = 1.5 + (pr() - 0.5) * (14 + into * 0.9);
        const q = at(along, into);
        petals.push({ p: [q[0], 6.16 + pr() * 0.05, q[1]], rot: [(pr() - 0.5) * 0.3, pr() * 6.28, (pr() - 0.5) * 0.3], s: Array(3).fill(0.7 + pr() * 0.6), color: ['#d8cbe8', '#c3b2da', '#e6dcef'][Math.floor(pr() * 3)] });
      }
    }
    // and the cracks it ran through the pavement, spreading from the gap.
    // Since 2026-10-07 they are painted into the floor itself (cracks.js, read
    // by paveShade), breaking slab by slab, from the breach and from under the
    // blocks that fell. What is laid here is what they were before (?wcrack=old):
    // a dark groove flush with the paving, a lip the moon catches on its side
    // toward the breach, each crack narrowing as it runs out, and moss in the
    // widest — still strips laid on the floor, crossing its joints as if they
    // were not there. Their draws are the world's stream's, and the garden is
    // laid out from the stream after them, so they are made either way.
    for (let k = 0; k < 9; k++) {
      let q = add(GATE, e.n, -rr(4, 14)), a = 150 + rr(-58, 58);
      for (let seg = 0; seg < 5 + Math.floor(rnd() * 4); seg++) {
        const len = rr(7, 22), nq = add(q, dir(a), len), w = rr(0.5, 1.5) * Math.max(0.3, 1 - seg * 0.13);
        const t = dir(a), toGate = (GATE[0] - q[0]) * -t[1] + (GATE[1] - q[1]) * t[0] > 0 ? 1 : -1;
        const nrm = [-t[1] * toGate, t[0] * toGate];
        if (CRACK_OLD) LB.liner.add(boxGeo(q, nq, 0.08, w * 0.7, 5.99));
        if (CRACK_OLD) LB.moonStone.add(boxGeo(add(q, nrm, w * 0.35 + 0.12), add(nq, nrm, w * 0.35 + 0.12), 0.1, 0.24, 6.0));
        if (CRACK_OLD && seg < 2 && w > 0.75) {
          for (let f = 0.2; f < 0.9; f += 0.23) {
            const m = add(q, t, len * f);
            LB.tuft.add(new THREE.SphereGeometry(w * 0.42, 7, 4).scale(1.6, 0.35, 1).rotateY(-a * deg).translate(m[0], 6.08, m[1]));
          }
        }
        q = nq;
        a += rr(-34, 34);
      }
    }
    // ── One volume was a gate ─────────────────────────────────────────────
    // The title of the room: the way out of the Library is a bookcase. It hung
    // at the garden end of the arch's passage, closing it to twice a reader's
    // height, and it has swung back into the passage and stands folded
    // against its left side, its shelves still full and turned to whoever goes
    // through. (Anywhere out in the opening, or at the arch's full height,
    // from the room it stood across the arch as a dark post.) It stands clear
    // of the plinth and the impost that run along the reveal.
    {
      // The leaf it replaces drew its books from the world's stream, and the
      // garden is laid out from the stream after it: the same draws, thrown away.
      for (let shelf = 0; shelf < 3; shelf++) {
        for (let u = 2.6; u < 21 - 4;) { const w = rr(2.2, 4.6); rr(9.5, 12.6); rr(6, 7.4); pick(BOOKS); rr(0.75, 1.1); u += w + rr(0.2, 0.9); }
      }
      rr(0, 6.28); pick(BOOKS);

      const { HW: hw } = PORTAL;
      const lr = makeRng(4808), within = (lo, hi) => lo + (hi - lo) * lr();
      // in the arch's frame: its back at x0, its books facing +x at x1; it runs
      // from z0 (the garden end, where it hangs) toward the room
      const x0 = -hw + 1.9, T = 2.8, x1 = x0 + T, z0 = -PORTAL.WALL + 4.8, L = 12.2, z1 = z0 + L;
      const Y0 = 6.35, H = 36;
      const spot3 = (x, y, z) => { const q = inPortal(x, z); return [q[0], y, q[1]]; };
      const piece = (xa, xb, ya, yb, za, zb, batch = LB.shelf) => batch.add(new THREE.BoxGeometry(xb - xa, yb - ya, zb - za).translate((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2).applyMatrix4(portalFrame));
      piece(x0, x0 + 0.8, Y0, H, z0, z1);                       // the back
      piece(x0, x1 + 0.3, Y0, H, z0, z0 + 1.2);                 // a stile at each end
      piece(x0, x1 + 0.3, Y0, H, z1 - 1.2, z1);
      piece(x0, x1 + 0.45, H - 1.6, H, z0 - 0.15, z1 + 0.15);   // the rail over the head, moulded
      piece(x0, x1 + 0.7, H - 2.2, H - 1.6, z0 + 1.2, z1 - 1.2);
      piece(x0, x1 + 0.3, Y0, Y0 + 1.8, z0 + 1.2, z1 - 1.2);    // the plinth
      // (two shelves of giants 85 cm-1.2 m tall until 2026-10-06; six of
      // quartos now, ?wbookscale=old for the two)
      const shelves = BOOKS_GIANT ? [Y0 + 1.8, 20.4] : Array.from({ length: 6 }, (_, j) => Y0 + 1.8 + (j * (H - 2.2 - Y0 - 1.8)) / 6);
      const spines = 30 * deg;   // a book's spine faces +x in this frame
      shelves.forEach((y, i) => {
        if (i) piece(x0 + 0.8, x1, y - (BOOKS_GIANT ? 0.8 : 0.45), y, z0 + 1.2, z1 - 1.2);
        const cap = BOOKS_GIANT ? (i < shelves.length - 1 ? shelves[i + 1] - 0.8 : H - 2.2) - 0.6 : (i < shelves.length - 1 ? shelves[i + 1] - 0.45 : H - 2.2) - 0.3;
        let z = z0 + 1.35, run = 0, col = '#5f422c', hh0 = 0;
        while (z < z1 - 1.6) {
          if (run <= 0) { run = 1 + Math.floor(lr() * 5); col = ['#6f4c31', '#5a2923', '#221d19', '#8e8062', '#7d5738', '#4f2420', '#6f5f36', '#523a28'][Math.floor(lr() * 8)]; hh0 = BOOKS_GIANT ? within(9, 12.4) - i * 0.6 : within(2.9, 3.4); }
          const w = BOOKS_GIANT ? within(1.8, 3.4) : within(0.4, 0.75);
          if (z + w > z1 - 1.3) break;
          const hh = Math.min(hh0 * within(0.97, 1.03), cap - y), d = within(1.8, 2.1);
          books.push({ p: spot3(x1 - d / 2 - 0.15, y + hh / 2, z + w / 2), rot: [0, spines, 0], s: [w, hh, d], color: col, k: within(0.8, 1.05) });
          z += w + (BOOKS_GIANT ? within(0.08, 0.3) : within(0.006, 0.04));
          run--;
        }
      });
      // pivots at the garden end, where it hangs, and a bronze ring to pull it by
      for (const y of [11, 23, 33]) LB.bronze.add(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 12).translate(x0 + 0.4, y, z0 - 0.35).applyMatrix4(portalFrame));
      LB.bronze.add(new THREE.TorusGeometry(1.5, 0.24, 8, 20).rotateY(Math.PI / 2).translate(x1 + 0.5, 26, z1 - 2.6).applyMatrix4(portalFrame));
      LB.bronze.add(new THREE.CylinderGeometry(0.62, 0.62, 0.7, 12).rotateZ(Math.PI / 2).translate(x1 + 0.4, 27.3, z1 - 2.6).applyMatrix4(portalFrame));
      // and the one that opened it, on the floor where it fell
      const drop = inPortal(-4, 20);
      books.push(BOOKS_GIANT
        ? { p: [drop[0], 7.2, drop[1]], rot: [0, 2.1, 1.57], s: [5.4, 2.4, 7.6], color: '#5a2923', k: 1.05 }
        : { p: [drop[0], 6.38, drop[1]], rot: [0, 2.1, 1.57], s: [0.75, 4.4, 3.2], color: '#5a2923', k: 1.05 });
    }
    // ── The garden comes in ──────────────────────────────────────────────
    // Moss in the joints of the pavement nearest the arch; leaves blown in
    // across the floor; ivy up the garden face of the arch. The only green in
    // the Library, and it has been earned.
    {
      const gr = makeRng(5505), within = (a, b) => a + (b - a) * gr();
      const at = (along, into) => add(add(GATE, e.n, -into), e.t, along);
      // Moss, laid on the pavement's own joints: the same world-projected
      // coordinates as the floor and a texture drawn to its slab layout, so the
      // green is IN the joints. Faded out with distance from the breach.
      {
        const g = new THREE.PlaneGeometry(1, 1, 24, 12).rotateX(-Math.PI / 2);
        const pos = g.attributes.position, uv = g.attributes.uv;
        const rgba = new Float32Array(pos.count * 4);
        for (let i = 0; i < pos.count; i++) {
          const along = pos.getX(i) * 110, into = (pos.getZ(i) + 0.5) * 54 - 12;
          const q = at(along, into);
          pos.setXYZ(i, q[0], 6.15, q[1]);
          uv.setXY(i, q[0], q[1]);
          const fall = Math.max(0, 1 - Math.max(0, into) / 40) * Math.max(0, 1 - Math.abs(along) / 52);
          rgba.set([1, 1, 1, Math.min(1, fall * 1.4)], i * 4);
        }
        g.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
        g.computeVertexNormals();
        const moss = new THREE.Mesh(keep(g), M.moss);
        moss.renderOrder = 1;
        root.add(moss);
      }
      // leaves, blown in and lying where they stopped
      for (let k = 0; k < 42; k++) {
        const into = -8 + gr() ** 1.4 * 60, along = within(-26 - into * 0.5, 26 + into * 0.5);
        const q = at(along, into);
        // on the threshold stone through the arch, and none on its footings
        const x = along - 1.5, sill = Math.abs(x) < 12.6 && into < 4;
        const leaf = { p: [q[0], (sill ? 6.4 : 6.18) + gr() * 0.05, q[1]], rot: [within(-0.15, 0.15), gr() * 6.28, within(-0.15, 0.15)], s: Array(3).fill(0.9 + gr() * 0.9),
          color: ['#6b5a2c', '#7a6234', '#556030', '#5f4a28', '#48552a'][Math.floor(gr() * 5)] };
        if (Math.abs(x) > 11.5 && into < 25) continue;
        fallenLeaves.push(leaf);
      }
      // Ivy up the garden face of the arch: up the quoins and round the ring of
      // voussoirs, thickest low down and on the left (the pergola's wisteria
      // has the right), and a little way in along the reveal, where the light
      // from the garden reaches.
      const faceYaw = Math.atan2(e.n[0], e.n[1]);
      for (let k = 0; k < (light ? 20 : 38); k++) {
        const left = gr() < 0.62, x = (left ? -1 : 1) * within(13.5, 31), y = PORTAL.FLOOR + 0.5 + gr() ** 1.6 * (left ? 72 : 50);
        const tilt = within(-0.5, 0.5), sx = within(7, 12), sy = within(5, 8), deep = gr();
        if (y > PORTAL.SPR - 3 && PORTAL.soffitAt(x, 4) > y - 3) continue;   // never across the opening
        const q = inPortal(x, -PORTAL.WALL - 0.9 - deep * 0.6);
        if (IVY_OLD) doorIvy.push({ p: [q[0], y, q[1]], rot: [0, faceYaw, tilt], s: [sx, sy, 1] });
      }
      // And the curtain the plates hang in that doorway: green trailing down
      // from the vault at the garden end of the passage, wisteria in it, lit
      // by the moon's light coming through. Hung high — the lowest tip is
      // twice a head's height over the way through.
      for (let z = -PORTAL.WALL + 5; z < -PORTAL.WALL + 11.5; z += within(1.3, 2)) {
        for (let x = -PORTAL.HW + 0.8 + gr() * 1.2; x < PORTAL.HW - 0.8; x += within(1.1, 2)) {
          const top = PORTAL.soffitAt(x) - 0.4, wisteria = gr() < 0.3;
          const len = Math.min(top - 38 - gr() * 3, within(8, 17) + (1 - Math.abs(x) / PORTAL.HW) * within(0, 8));
          const q = inPortal(x + within(-0.3, 0.3), z + within(-0.4, 0.4));
          const yaw = gr() * Math.PI, kind = wisteria ? Math.floor(gr() * 2) : 2 + Math.floor(gr() * 2), wide = within(2.6, 3.8);
          if (len < 4) continue;
          hangs.push({ p: [q[0], top, q[1]], rot: [0, yaw, 0], s: [wide, len, 1], kind, color: wisteria ? '#e6dcec' : '#c8d6c4', k: within(0.8, 1.05) });
        }
      }
      for (let k = 0; k < (light ? 4 : 9); k++) {
        const side = k % 2 ? 1 : -1, z = -PORTAL.WALL + 1 + gr() ** 1.3 * 9, y = PORTAL.FLOOR + 1 + gr() ** 1.5 * 24;
        const q = inPortal(side * (PORTAL.HW - 0.15), z), n = dir(side < 0 ? 60 : 240);
        const item = { p: [q[0], y, q[1]], rot: [0, Math.atan2(n[0], n[1]), within(-0.5, 0.5)], s: [within(6, 10), within(4.5, 7), 1] };
        if (IVY_OLD) doorIvy.push(item);
      }
      // The ivy itself (ivy.js), grown out of the ground at the foot of the
      // wall: up the garden face either side of the arch — highest on the
      // left, where it has been longest and reaches round the ring of
      // voussoirs and hangs from it — and in along the passage's walls as far
      // as the garden's light goes. In the arch's frame, cast onto its stone.
      if (!IVY_OLD) {
        const W = PORTAL.WALL, HW = PORTAL.HW, F = PORTAL.FLOOR;
        // (the wall's garden face beyond the arch's own masonry, either side)
        const beyond = (x0, x1) => new THREE.PlaneGeometry(x1 - x0, 125).translate((x0 + x1) / 2, 62.5, -W);
        const caster = stoneCaster([...portalStone, beyond(-80, -24), beyond(24, 80)]);
        portalStone.forEach((g) => g.dispose());
        const ir = makeRng(5521), R = (a, b) => a + (b - a) * ir();
        const opening = (u, v, a) => Math.abs(u) < HW + a && v < PORTAL.soffitAt(u, a) + 0.4;
        const face = {
          ray: (u, v, o, d) => { o.set(u, v, -W - 12); d.set(0, 0, 1); }, far: 30,
          light: new THREE.Vector3(0, 1, -0.5).normalize(), max: light ? 1400 : 3400,
          allow: (u, v) => Math.abs(u) < 42 && v > F - 1 && !opening(u, v, 1.4)
            && v < (u < 0 ? 82 - Math.max(0, -u - 22) * 1.3 : 58 - Math.max(0, u - 22) * 1.3),
          seeds: [
            ...[-15.6, -19.5, -24, -29, -34.5].map((u) => [u + R(-0.8, 0.8), F + 0.2, R(-0.3, 0.3), R(62, 88), R(0.75, 1)]),
            ...[16, 20.5, 27, 33].map((u) => [u + R(-0.8, 0.8), F + 0.2, R(-0.3, 0.3), R(38, 58), R(0.6, 0.85)]),
          ],
        };
        const reveal = (sd) => ({
          ray: (u, v, o, d) => { o.set(sd * (HW - 6), v, u); d.set(sd, 0, 0); }, far: 20, drift: 0.3, scale: 0.9,
          light: new THREE.Vector3(0, 0.7, -1).normalize(), max: light ? 200 : 650,
          allow: (u, v) => u > -W - 0.2 && u < -W + 15 && v > F - 0.5 && v < 40 - (u + W) * 1.6,
          seeds: [[-W + 0.8, F + 0.6, 0.2, R(28, 36), 0.7], [-W + 3, F + 0.6, 0.4, R(22, 30), 0.55], [-W + 6.5, F + 0.6, 0.3, R(14, 22), 0.4], [-W + 9.5, F + 0.6, 0.5, R(8, 14), 0.3]],
        });
        const grown = growIvy(caster, [face, reveal(-1), reveal(1)], ir);
        // and strands hanging from the arch's edge on the left, where the
        // stems that went over the ring come down; none lower than twice a
        // head's height over the way through
        for (const u of [-16.5, -14.5, -12, -9.5, -6.5, 11.5, 15]) {
          if (u > 0 && ir() < 0.4) continue;
          const top = PORTAL.soffitAt(u, 3.6) - 0.3, len = Math.min(R(5, 14), top - 40);
          if (len < 3) continue;
          const hung = hangIvy(new THREE.Vector3(u, top, -W - 0.4), new THREE.Vector3(0, 0, -1), len, ir);
          grown.stems.push(hung.nodes);
          grown.leaves.push(...hung.leaves);
        }
        caster.dispose();
        const qf = new THREE.Quaternion().setFromRotationMatrix(portalFrame), eu = new THREE.Euler();
        const stemTint = new THREE.Color('#857563');
        for (const stem of grown.stems) {
          ivyWood.tube(stem.map((nd) => ({ p: nd.p.clone().applyMatrix4(portalFrame), r: nd.r })), stem[0].r > 0.14 ? 6 : 4, stemTint);
        }
        for (const lf of grown.leaves) {
          const p = lf.p.clone().applyMatrix4(portalFrame);
          eu.setFromQuaternion(qf.clone().multiply(lf.q));
          const old = ir() < 0.04;
          const color = old ? '#4a3d24' : lf.young ? IVY_YOUNG[Math.floor(ir() * IVY_YOUNG.length)] : IVY_GREEN[Math.floor(ir() * IVY_GREEN.length)];
          ivyLeaves.push({ p: [p.x, p.y, p.z], rot: [eu.x, eu.y, eu.z], s: [lf.s, lf.s, lf.s], color, k: 1.75 * R(0.85, 1.15) });
        }
      }
    }
    // ── The green moon, through the jamb ──────────────────────────────────
    // "Hedges breathe under a green moon": the light off the garden falls
    // through the breach and lands on the pavement, which is the only thing
    // that ever happens on forty per cent of this frame.
    {
      const mid = add(DOOR, dir(330), A);
      const top = new THREE.Vector3(mid[0] + dir(330)[0] * 16, 82, mid[1] + dir(330)[1] * 16);
      const foot = new THREE.Vector3(mid[0] + dir(150)[0] * 52, 6, mid[1] + dir(150)[1] * 52);
      const axis = top.clone().sub(foot);
      const len = axis.length();
      const g = new THREE.CylinderGeometry(1, 1.5, len, 26, 1, true);
      g.scale(13, 1, 5.5);
      const yv = axis.clone().normalize();
      const xv = new THREE.Vector3(dir(60)[0], 0, dir(60)[1]).projectOnPlane(yv).normalize();
      g.applyMatrix4(new THREE.Matrix4().makeBasis(xv, yv, xv.clone().cross(yv).normalize()));
      g.translate(...top.clone().add(foot).multiplyScalar(0.5).toArray());
      const shaft = new THREE.Mesh(keep(shaftVolume(g)), keep(makeShaftMaterial('#a6edc6', 0.12 * (doorOld(4) ? 1 : SHAFT_K))));
      shaft.renderOrder = 2;
      root.add(shaft);
    }
    // One lamp behind the reader and one in view across the gallery: the green
    // belongs BEYOND the jamb, and with the gate's light at 8000 it owned the
    // whole room and the Library stopped being warm.
    // A globe on its stand beside the reading table: furniture that is not a
    // shelf. (Put near the reader as a dark shape at the edge of the frame it
    // sat in the corner under the room's caption, pale and enormous.)
    {
      const at = alongWall(DOOR, 3).on(11, 25);
      const legs = [0, 120, 240].map((a) => {
        const foot = add([0, 0], dir(a), 3.6);
        const v0 = new THREE.Vector3(foot[0], 6, foot[1]), v1 = new THREE.Vector3(0, 11.5, 0);
        const g = new THREE.CylinderGeometry(0.28, 0.4, v0.distanceTo(v1), 8);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v1.clone().sub(v0).normalize()));
        return g.translate((v0.x + v1.x) / 2, (v0.y + v1.y) / 2, (v0.z + v1.z) / 2);
      });
      legs.push(new THREE.CylinderGeometry(0.35, 0.45, 2.4, 10).translate(0, 12.6, 0));
      legs.push(new THREE.TorusGeometry(4.35, 0.32, 6, 40).rotateX(Math.PI / 2).translate(0, 16.2, 0));
      for (const a of [0, 120, 240]) legs.push(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 6).translate(Math.cos(a * deg) * 4.35, 14.5, Math.sin(a * deg) * 4.35));
      LB.shelf.add(placed(mergeGeometries(legs), at, 0, 0.4));
      legs.forEach((g) => g.dispose());
      LB.bronze.add(placed(new THREE.TorusGeometry(3.95, 0.16, 6, 40).rotateZ(23 * deg), at, 16.2, 0.4));
      const globe = new THREE.Mesh(keep(new THREE.SphereGeometry(3.6, 36, 24)), M.globeMap);
      globe.rotation.set(0, 1.1, 23 * deg);
      globe.position.set(at[0], 16.2, at[1]);
      globe.castShadow = true;
      root.add(globe);
    }
    // (its pool on the floor, over the moss at 6.15: at 6.6 it drew a pale
    // sock round the foot of the reading corner's legs)
    lamp(add(DOOR, dir(214), 46), { light: 6500, priority: 3, strength: 1.2, pool: doorPropsOld(2) ? 0.12 : DOOR_SPILL.warm.near, poolSize: 140, poolY: 6.2, haze: 0.18, beam: false });
    // ── Candles at the foot of the arch ──────────────────────────────────
    // A bronze candelabrum either side, standing before the piers, as every
    // plate of this room has them: the carving is lit from below, warm, the
    // way the stone was meant to be seen, and the green comes through between.
    // (Flames only — a halo would draw on the world's stream.)
    for (const side of [-1, 1]) {
      const at = inPortal(side * 29.5, 29);
      const put = (g) => LB.bronze.add(g.translate(at[0], 0, at[1]));
      const L = (pts, seg = 18) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
      put(L([[0, 6], [3.1, 6], [3.1, 6.45], [2.5, 6.9], [1.5, 7.4], [1.0, 8.2], [0.72, 9.4], [0, 9.4]]));
      // (the stem runs on past the arms' knop up into the centre candle's
      // pan: it stopped at the knop, and the middle candle hung in the air)
      put(L([[0, 9.2], [0.5, 9.2], [0.42, 12.4], [0.95, 13.1], [0.42, 13.8], [0.38, 18.2], [0.85, 18.9], [0.4, 19.6], [0.36, 23.6], [1.05, 24.3], [0.5, 24.9], [0.34, 25.4], [0.32, 26.7], [0.62, 27.15], [0.55, 27.5], [0, 27.5]], 14));
      const flames = [[0, 27.8, 0, 3.4]];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4, c = [Math.cos(a) * 3.3, Math.sin(a) * 3.3];
        const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 23.8, 0), new THREE.Vector3(c[0] * 0.45, 22.8, c[1] * 0.45), new THREE.Vector3(c[0] * 0.9, 23.4, c[1] * 0.9), new THREE.Vector3(c[0], 25.2, c[1])]);
        put(new THREE.TubeGeometry(arm, 12, 0.24, 6, false));
        flames.push([c[0], 25.6, c[1], 2.2 + ((k * 7) % 3) * 0.55]);
      }
      // (They were five clean cylinders of a size. Burnt down now, each as far
      // as it has, its crown melted and its wax run down it and onto the pan,
      // a glow round each flame — its own sprite: `halo()` draws on the world's
      // stream — and the flames moving a little: doorProps.js, 4.)
      const worn = !doorPropsOld(4), cr = makeRng(side < 0 ? 4411 : 4412);
      flames.forEach(([x, y, z, h0], fi) => {
        put(L([[0, y - 0.4], [0.95, y - 0.35], [1.0, y - 0.15], [0.45, y], [0, y]], 14).translate(x, 0, z));
        const h = worn ? h0 * DOOR_CANDLES.burn[side < 0 ? 0 : 1][fi] : h0;
        // (`top`: where the wick stands, down in the well of a melted crown)
        let top = y + h;
        if (worn) {
          const c = candleWax(h, 0.35, 7700 + (side < 0 ? 0 : 10) + fi);
          top = y + c.wick;
          LB.wax.add(c.geo.rotateY(cr() * 6.28).translate(at[0] + x, y, at[1] + z));
        } else LB.paper.add(new THREE.CylinderGeometry(0.34, 0.36, h, 12).translate(at[0] + x, y + h / 2, at[1] + z));
        if (LAMPS.flame) {
          // a flame, not an egg of light; a wick; the wax lit round it (lampPass.js)
          trialFlames.push({ p: [at[0] + x, top + (worn ? 0.78 : 0.66), at[1] + z], s: [0.32, 0.66, 0.32], color: '#ffffff', k: 1.45 });
          trialWax.push(waxGlowGeometry(at[0] + x, worn ? top + 0.02 : y + h, at[1] + z, worn ? 0.36 : 0.34));
          LB.iron.add(worn
            ? new THREE.CylinderGeometry(0.03, 0.035, 0.42, 4).translate(at[0] + x, top + 0.2, at[1] + z)
            : new THREE.CylinderGeometry(0.035, 0.035, 0.3, 4).translate(at[0] + x, y + h + 0.12, at[1] + z));
          if (worn) {
            const { size, opacity } = DOOR_CANDLES.halo;
            const glow = new THREE.Sprite(haloMaterial('#ffb45e', opacity));
            glow.scale.set(size, size, 1);
            glow.position.set(at[0] + x, top + 0.85, at[1] + z);
            glow.renderOrder = 4;
            root.add(glow);
            halos.push({ mat: glow.material, base: opacity, phase: cr() * 100, sprite: glow, size, lamp: false, seen: 1, seenTo: 1 });
          }
        } else glows.push({ p: [at[0] + x, y + h + 0.55, at[1] + z], s: [0.3, 0.62, 0.3], color: '#ffc47a', k: 1.5 });
      });
      // (theirs to keep from anywhere in the room: the stand is further back
      // since 2026-10-10 — doorProps.js, 1 — and from there two lamps out in the
      // Vertigo were nearer than these, and the arch stood unlit)
      point(at, 27, '#ffb466', 2600, 5, null, doorPropsOld(1) ? null : [DOOR[0], DOOR[1], R]);
      if (worn) candleLights.push({ wish: lightWishes.at(-1), base: lightWishes.at(-1).intensity, phase: side < 0 ? 0.7 : 3.9 });
    }
    // Hung to the left of the arch rather than in front of it, where it stood
    // across the springing, and high, level with the head of the hood: from
    // there its light rakes across the orders and the gable, and every roll,
    // hollow and foil reads by it. (Hung at the springing it lit the jambs,
    // and the carving over the arch was one flat tone.)
    // (no beam: its cone was a hard pale wedge down the cases to the left of
    // the arch, and the breach is the one shaft of light this room wants)
    // (lower since 2026-10-09: at 82 the frame's top edge cut its globe in half — doorFix.js, 8)
    // (a smaller globe burning lower since 2026-10-10, so the doorway and not
    // the lamp is what the eye goes to; its light is what it was — doorProps.js, 7)
    lamp(inPortal(-44, 38), {
      y: doorOld(8) ? 82 : DOOR_LAMP_Y, light: 5200, priority: 4, poolSize: 150, beam: false,
      pool: doorPropsOld(2) ? 0.2 : DOOR_SPILL.warm.side,
      ...(doorPropsOld(7) ? { strength: 1.05, haze: 0.6 } : DOOR_SIDE_LAMP),
    });
    // The garden's light: a lamp outside the arch and its pool on the floor.
    // (The pool was a hundred and fifty wide and laid 22 into the room, and
    // the lamp, which no wall stops, hung close outside: the whole pavement
    // was olive. A tongue now, in the passage and a slab beyond — doorProps.js, 2)
    if (doorPropsOld(2)) {
      point(add(GATE, e.n, 14), 40, '#8ff0d4', 3800, 9);
      decal(add(GATE, e.n, -22), 150, 140, '#7ee8c8', 0.17);
    } else {
      point(add(GATE, e.n, DOOR_SPILL.lamp.out), 40, '#8ff0d4', DOOR_SPILL.lamp.power, 9);
      for (const [into, wide, o] of DOOR_SPILL.pools) decal(add(add(GATE, e.n, -into), e.t, 1.5), wide, wide, '#7ee8c8', o);
    }
  }
  const ENTRANCE = hallMid(0, 0, 2);

  const bookAttrs = { aSpine: (it) => it.spine ?? spineAt(it.p), aTitle: (it) => it.title ?? titleAt(it.p), aGraze: (it) => it.graze ?? 0, aDust: (it) => it.dust ?? 0 };
  instances(new THREE.BoxGeometry(1, 1, 1), M.books, books, { chunked: true, attrs: bookAttrs });
  // A shelved book shows its spine, its head and its sides, never the foot it
  // stands on or the fore-edge against the case's back: its box without
  // those two faces (BoxGeometry's -y and -z), a third less to draw of each
  // of tens of thousands.
  const shelvedBox = (() => {
    const g = new THREE.BoxGeometry(1, 1, 1), idx = g.index.array, keepFaces = [0, 1, 2, 4];
    g.setIndex(keepFaces.flatMap((f) => Array.from(idx.slice(f * 6, f * 6 + 6))));
    g.clearGroups();
    return g;
  })();
  instances(shelvedBox, M.books, shelved, { group: (it) => it.wall, attrs: bookAttrs, name: 'shelvedBooks' });
  // Each wall's painted copy, a mesh to a wall, to stand in for its boxes
  // when no eye is near: through an arch two galleries off, or from the map,
  // a real book is two or three pixels across and the paint is the same
  // thing at a fraction of the cost. (The Silence's paint greyed as its
  // bindings are.)
  const lodGroups = [];
  {
    const greyRows = Std({ map: bookRowsSet.map, roughness: 0.85 });
    greyRows.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, 0.4) * 0.8;`);
    };
    greyRows.customProgramCacheKey = () => 'babel-rows-grey';
    const byWall = new Map();
    root.children.forEach((o) => { if (o.name === 'shelvedBooks') byWall.set(o.userData.group, o); });
    for (const [wall, geos] of lodRows) {
      const boxes = byWall.get(wall);
      if (!boxes || !geos.length) continue;
      const flat = geos.map((g) => { const f = g.index ? g.toNonIndexed() : g; if (f !== g) g.dispose(); return f; });
      const geo = keep(mergeGeometries(flat, false));
      flat.forEach((g) => g.dispose());
      const rows = new THREE.Mesh(geo, wallRoom.get(wall) === 2 ? greyRows : M.bookRows);
      rows.name = 'shelvedRows';
      rows.visible = false;
      root.add(rows);
      lodGroups.push({ boxes, rows, c: boxes.boundingSphere.center.clone(), r: boxes.boundingSphere.radius });
    }
  }
  instances(new THREE.TorusGeometry(0.72, 0.2, 5, 10), M.iron, links, { cast: false, chunked: true });
  instances(new THREE.LatheGeometry([
    [0, 0], [0.95, 0], [0.95, 0.35], [0.5, 0.8], [0.36, 2], [0.78, 3.2], [0.84, 3.7], [0.38, 4.6], [0.42, 5.5], [0.85, 6], [0, 6.2],
  ].map(([x, yy]) => new THREE.Vector2(x, yy)), 10), M.bronze, balusters, { chunked: true });
  instances(new THREE.SphereGeometry(1, 16, 12), M.glow, lampCores, { cast: false, receive: false, chunked: true });
  instances(new THREE.SphereGeometry(1, 20, 14), M.glass, lampShells, { cast: false, receive: false, chunked: true });
  instances(new THREE.SphereGeometry(1, 32, 20), M.globe, globes, { cast: false, receive: false, chunked: true });
  instances(new THREE.SphereGeometry(1, 32, 20), M.deadGlass, deadGlobes, { cast: false, chunked: true });
  // (the lamp pass, lampPass.js)
  instances(lanternPaneGeometry(), M.globe, trialPanes, { cast: false, receive: false, chunked: true, name: 'trial-panes' });
  instances(flameGeometry(), M.lpFlame, trialFlames, { cast: false, receive: false, chunked: true, name: 'trial-flames' });
  if (trialWax.length) {
    const wax = new THREE.Mesh(keep(mergeGeometries(trialWax)), M.lpWax);
    trialWax.forEach((g) => g.dispose());
    wax.name = 'trial-wax';
    wax.renderOrder = 2;
    root.add(wax);
  }
  instances(rockGeo(), M.rock, rubble, { chunked: true });
  instances(chunkGeo(), M.moonRock, doorRubble, { chunked: true });
  instances(new THREE.PlaneGeometry(0.9, 0.62).rotateX(-Math.PI / 2), M.petal, petals, { cast: false });
  instances(new THREE.PlaneGeometry(2.2, 1.3).rotateX(-Math.PI / 2), M.leaf, fallenLeaves, { cast: false });
  instances(new THREE.PlaneGeometry(1, 1), M.ivy, doorIvy, { cast: false });
  instances(new THREE.BoxGeometry(1, 1, 1), M.wallTop, posts, { chunked: true });

  yield 'The garden';
  // ── The garden ────────────────────────────────────────────────────────────
  const GB = {
    grass: new Batch(M.grass, { cast: false, ...P }), gravel: new Batch(M.gravel, { cast: false, ...P }),
    mazeFloor: new Batch(M.mazeFloor, { cast: false, ...P }), wood: new Batch(M.wood, G), plank: new Batch(M.plank, G),
    // the bridge's boards, each with its grain laid along it rather than projected
    deck: new Batch(M.plank),
    lacquer: new Batch(M.lacquer, G), gold: new Batch(M.gold), ridge: new Batch(M.ridge), stone: new Batch(M.stone, P),
    lantern: new Batch(M.lanternStone, P), paperLit: new Batch(M.lanternPaper, { cast: false, receive: false }),
    paperDead: new Batch(M.paperDead, { cast: false }), iron: new Batch(M.iron),
    rakeDark: new Batch(M.rakeDark, { cast: false, receive: false }), rakeLit: new Batch(M.rakeLit, { cast: false }),
    forkRakeDark: new Batch(M.forkRakeDark, { cast: false, receive: false }), forkPost: new Batch(M.forkPost, G),
    pavBronze: new Batch(M.pavBronze),
    // (pavilionProps.js: 13, 3, 4, 10)
    pavGilt: new Batch(M.pavGilt), pavGreen: new Batch(M.pavGreen, { cast: false }), pavChalk: new Batch(M.pavChalk, { cast: false }),
    brocade: new Batch(M.brocade), railWorn: new Batch(M.lacquerWorn, G),
    // the gilt capitals cut round the armillary's pedestal (webFix.js, 7)
    letters: new Batch(M.letters, { cast: false }),
    // and the pedestal's stone, its uv laid round it and up it by webFix.js:
    // projected per face, a turned and reeded surface took the stone's grain
    // in streaks and rope-twists
    pedestal: new Batch(M.pedestalStone),
    newWood: new Batch(M.newWood, WOOD_OLD ? {} : G), blackLacquer: new Batch(M.blackLacquer), silk: new Batch(M.silk),
    cushion: new Batch(M.cushion), pavilionThreshold: new Batch(M.plank, G), pavilionStep: new Batch(M.stone, P),
    // the pond's edge (shore.js): its set stones and the bridge's pier, the
    // stone stepped onto the bridge from (a stair, to the body), and the bank
    ...(SHORE_OLD ? {} : { shoreStone: new Batch(M.shoreRock), shoreStep: new Batch(M.shoreRock), bank: new Batch(M.bank, { cast: false }) }),
  };
  const rocks = [], ivy = [], fireflies = [], moreFlies = [];
  // lily leaves by kind (pond.js, PAD_KINDS), and the flowers and buds among them
  const lilies = [[], [], [], []], blooms = { white: [], pink: [], whiteBud: [], pinkBud: [] };
  const foliage = [];
  // (the cedars behind the maze, apart: webProps.js, 2 — see `beltGroup`)
  const beltFoliage = [], beltWood = [];
  let beltGroup = null, beltLeaf = null;
  const beltLight = {
    uBackMoon: { value: new THREE.Color() }, uBackMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uBackSky: { value: new THREE.Color() }, uBackGround: { value: new THREE.Color() }, uBackFill: { value: new THREE.Color() },
  };
  const LEAF = ['#4a6b47', '#3f5c46', '#557a52', '#38503f', '#47664a'];
  const BLOSSOM = ['#9d7683', '#b39197', '#8e6a7a'];
  const mazeRoute = [];
  let armillary = null;
  // What the finale (finale.js) needs from the maze once it has grown.
  let mazeGrid = null, mazeRects = null;
  const heartParts = {};
  // A hedge grown over a footprint (hedges.js): its body, and its sprigs drawn
  // and shadowed as the trees' leaf is — those on top on the trees' crossed
  // cards, those on a face on the three upright cards alone.
  const topSprigs = [], faceSprigs = [];
  const plantHedge = (loops, opts) => {
    if (HEDGE_DIAL === 'none') return;
    const { geometry, sprigs, litter } = growHedge(loops, { detail: HEDGE_DIAL === 'bare' ? 0 : light ? 0.5 : 1, ...opts });
    hedgeGround.push(...loops);
    const m = new THREE.Mesh(keep(geometry), M.hedge);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'hedge';
    root.add(m);
    const floor = new THREE.Mesh(keep(litter), M.hedgeLitter);
    floor.receiveShadow = true;
    floor.renderOrder = 1;
    floor.name = 'hedge-litter';
    root.add(floor);
    for (const s of sprigs) (s.flat ? topSprigs : faceSprigs).push(s);
  };
  // A clipped finial (forkProps.js, 6): a drum of the same hedge, domed by the
  // shears, grown through a hedge's line at `p` and standing `up` over its top
  // `H`. From across the garden a hedge was one level stripe of black from
  // edge to edge of the frame; these are what stands out of it.
  const finial = (p, { r, up }, ground, H, seed) => {
    if (propsOld(6)) return;
    plantHedge([[[p[0] - r, p[1] - r], [p[0] + r, p[1] - r], [p[0] + r, p[1] + r], [p[0] - r, p[1] + r]]], {
      ground, H: H + up, seed, round: r - 0.3, shoulder: r * 0.6, batter: 0.8, foot: 0.6,
    });
  };
  for (const cell of cells) if (cell.garden) GB.grass.add(slabGeo(hexPts(cell.c, RC + 0.5), [], 4, 0));

  const PERGOLA0 = add(GATE, dir(150), 10);
  const J = [1186, 236];
  const POND = { c: [1300, 118], rx: 118, rz: 90 };
  Object.assign(shorePond, POND);
  const PV = PAVILION;
  const SHORE = [1238, 196];
  const BRIDGE = PAVILION_BRIDGE;
  const BRIDGE_STAND = lerp2(BRIDGE[1], BRIDGE[2], 0.6);
  const MZ = { x0: 1180, z0: 318, cols: 8, rows: 7, cw: 30, ch: 30 };
  const MAZE_ENTRY = [MZ.x0 + 4.5 * MZ.cw, MZ.z0];
  const HEART = [MZ.x0 + 4.5 * MZ.cw, MZ.z0 + 3.5 * MZ.ch];
  // the nine cells round the heart, cleared into one court (the world tour only)
  const COURT = { c0: 3, c1: 5, r0: 2, r1: 4 };
  const COURT_HALF = 1.5 * MZ.cw;
  const POOLS = [{ c: [1088, 482], r: 26 }, { c: [955, 150], r: 22 }];
  const PATHS = [
    { pts: [PERGOLA0, J], w: 18 },
    { pts: [J, [1216, 218], SHORE], w: 16 },
    { pts: [[1315, 212], [1311, 266], [MAZE_ENTRY[0], MAZE_ENTRY[1] - 4]], w: 14 },
    { pts: [J, [1120, 160], [1000, 88], [890, 30], [840, -40]], w: 14, fading: true },
  ];
  const segDist = (p, a, b) => {
    const vx = b[0] - a[0], vz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (vx * vx + vz * vz)));
    return dist(p, [a[0] + vx * t, a[1] + vz * t]);
  };
  const lineDist = (p, pts) => Math.min(...pts.slice(1).map((b, i) => segDist(p, pts[i], b)));
  const pathDist = (p) => Math.min(...PATHS.map((path) => lineDist(p, path.pts)));
  // ── The road not taken, taken ────────────────────────────────────────────
  // It used to fade out across the lawn to the north-west and lead nowhere: a
  // reader walking it on their own came out on bare grass under the Library's
  // blank outer wall. Then it bent round the north of the pond and came down
  // to the far shore, where a second, shorter bridge went out to the
  // Pavilion's north bay. (PATHS keeps the oldest road: the world's stream was
  // spent along it, and still is — the trees, the rocks and the mist stand
  // where they stood, and what a newer road would have stood on is taken up
  // off it.)
  //
  // Round the pond, it set off from the Fork through the pergola's last post
  // (the pergola runs on to three paces short of the Fork's stone) and went to
  // the Pavilion, where the other way already goes — while from the Pavilion to
  // the maze there was no way at all, only lawn between the bridge's foot and a
  // path that began in the bank. Now the Fork parts the two ways a reader
  // has: the Pavilion straight on, and to the right of it, clear of the post,
  // the road to the Heart, down to where the way from the water turns into the
  // maze, under the two lanterns that stand there facing it. And the bridge's
  // foot has its own way on along the shore (SHORE_WAY). Whichever way the
  // reader takes at the Fork, the Heart is where it goes. (?wfork=old: the road
  // round the pond, and no way along the shore. The second bridge stays, and
  // comes down onto a landing of its own.)
  const N_SHORE = [1310, 10];
  const NORTH_BRIDGE = PAVILION_NORTH_BRIDGE;
  const NORTH_OPEN = !paintings || FORK_OLD;
  const wayThrough = (ctrl, w) => {
    const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const pts = curve.getSpacedPoints(Math.ceil(curve.getLength() / 9)).map((v) => [v.x, v.z]);
    return { ctrl, pts, w };
  };
  const ROAD = FORK_OLD
    ? wayThrough([J, [1120, 160], [1082, 92], [1092, 28], [1140, -22], [1215, -46], [1285, -38], N_SHORE], 14)
    : wayThrough([J, [1214, 246], [1250, 258], [1284, 266], PATHS[2].pts[1]], 14);
  // from the last leg of the way to the bridge, round the abutment and along
  // the shore, into the way to the maze where it leaves the water
  const SHORE_WAY = FORK_OLD ? null : wayThrough([[1228, 206], [1242, 211], [1262, 213], [1290, 218], [1314, 220]], 14);
  // and where the road no longer comes to it, the second bridge's foot stands
  // on gravel all the same: a few paces of it, out past the step to the lawn
  const LANDING = FORK_OLD || !NORTH_OPEN ? null : (() => {
    const axis = unit2(N_SHORE, NORTH_BRIDGE[1]);
    return { pts: [add(N_SHORE, axis, -3), add(N_SHORE, axis, -14)], w: 16 };
  })();
  const WAYS = [ROAD, SHORE_WAY, LANDING].filter(Boolean);
  const wayDist = (p) => Math.min(...WAYS.map((way) => lineDist(p, way.pts)));
  // what stands on the ground the ways must keep their stones off: the
  // pergola's posts, the lanterns and the waymark, each with the reach of its foot
  const standing = [];
  // the lanterns that stand on the lawn, for the blades their light shows (lawn.js)
  const lawnLamps = [], hedgeGround = [];
  const onNorthBridge = (p, m = 0) => NORTH_BRIDGE.slice(1).some((b, i) => segDist(p, NORTH_BRIDGE[i], b) < 13 + m);
  // And the lawn beyond the dressed garden closed off by a hedge, from the
  // Library's wall west of the Fork round the north of the road and the pond
  // and down past the maze to its wall again: outside it there was nothing but
  // grass going on into the dark, and a reader could walk out into it. (Both
  // ends stand in the Library's stone. The trees beyond it are the skyline
  // they always were.)
  const BOUNDARY = [[865, 140], [985, 70], [1030, -20], [1100, -80], [1210, -102], [1310, -92], [1400, -58],
    [1468, 12], [1490, 120], [1482, 232], [1470, 330], [1472, 470], [1455, 572], [1262, 592]];
  const boundaryDist = (p) => Math.min(...BOUNDARY.slice(1).map((b, i) => segDist(p, BOUNDARY[i], b)));

  for (const path of PATHS) {
    // (the old road not taken: its draws, and nothing laid — ROAD is laid below)
    const old = path === PATHS[3], edging = old ? [] : rocks;
    path.pts.forEach((p, i) => {
      if (!old) GB.gravel.add(slabGeo(circlePts(p, path.w / 2, 20), [], 1.2, 4));
      if (i === 0) return;
      const a = path.pts[i - 1], L = dist(a, p);
      const t = [(p[0] - a[0]) / L, (p[1] - a[1]) / L], n = [-t[1], t[0]];
      if (!old) GB.gravel.add(slabGeo([add(a, n, path.w / 2), add(p, n, path.w / 2), add(p, n, -path.w / 2), add(a, n, -path.w / 2)], [], 1.2, 4));
      for (let u = 0; u < L; u += 7) {
        for (const side of [-1, 1]) {
          if (path.fading && rnd() < 0.5) continue;
          const rp = add(add(a, t, u + rr(-2, 2)), n, side * (path.w / 2 + rr(0, 1.5)));
          const stone = { p: [rp[0], 5, rp[1]], rot: rot3(), s: [rr(1.2, 2.3), rr(0.8, 1.6), rr(1.2, 2.3)], color: pick(['#5f5b55', '#4e4b46', '#6b665f']) };
          // (in groups since 2026-10-09, laid below: these draws spent as they were)
          if (forkOld(4)) edging.push(stone);
        }
      }
    });
  }
  // The ways' stones set in groups, a big one and smaller ones against it,
  // some sunk, gaps between — not one of a size every seven paces, like beads
  // on a string (forkFix.js, 4). Each from its own stream; none on another
  // way's gravel or down the bank.
  const offPond = (p, m = 4) => ((p[0] - POND.c[0]) / (POND.rx + m)) ** 2 + ((p[1] - POND.c[1]) / (POND.rz + m)) ** 2 > 1;
  const edgeOk = (way) => (p, r) => [...PATHS.slice(0, 3), ...WAYS].every((o) => o === way || lineDist(p, o.pts) > o.w / 2 + r * 0.5) && offPond(p);
  if (!forkOld(4)) PATHS.slice(0, 3).forEach((path, i) => rocks.push(...edgeStones(path.pts, path.w, 9161 + i * 6, { ok: edgeOk(path) })));

  // The road not taken, laid: gravel the width of the old one, edged with
  // stones as it was (half of them gone, a way less walked), from a stream of
  // its own — and the way along the shore beside it, edged all along as the
  // walked ways are, from another. Neither leaves a stone lying on another
  // way's gravel or down the bank into the water (all of each stone drawn
  // first, so the ones after it are the same whether it is laid or not).
  for (const [way, seed, sparse] of [[ROAD, 9127, true], [SHORE_WAY, 9131, false], [LANDING, 9137, true]]) {
    if (!way) continue;
    const qr = makeRng(seed), qrr = (a, b) => a + (b - a) * qr();
    const { pts, w } = way;
    pts.forEach((p, i) => {
      GB.gravel.add(slabGeo(circlePts(p, w / 2, 20), [], 1.2, 4));
      if (i === 0) return;
      const a = pts[i - 1], L = dist(a, p);
      const t = [(p[0] - a[0]) / L, (p[1] - a[1]) / L], n = [-t[1], t[0]];
      GB.gravel.add(slabGeo([add(a, n, w / 2), add(p, n, w / 2), add(p, n, -w / 2), add(a, n, -w / 2)], [], 1.2, 4));
    });
    const others = [...PATHS.slice(0, 3), ...WAYS].filter((o) => o !== way);
    const offGravel = (p) => others.every((o) => lineDist(p, o.pts) > o.w / 2 + 1);
    const offBank = (p) => ((p[0] - POND.c[0]) / (POND.rx + 4)) ** 2 + ((p[1] - POND.c[1]) / (POND.rz + 4)) ** 2 > 1;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], L = dist(a, b), t = unit2(a, b), n = [-t[1], t[0]];
      for (let u = 0; u < L; u += 7) {
        for (const side of [-1, 1]) {
          if (sparse && qr() < 0.5) continue;
          const rp = add(add(a, t, u + qrr(-2, 2)), n, side * (w / 2 + qrr(0, 1.5)));
          const stone = {
            p: [rp[0], 5, rp[1]], rot: [qrr(0, 6.28), qrr(0, 6.28), qrr(0, 6.28)],
            s: [qrr(1.2, 2.3), qrr(0.8, 1.6), qrr(1.2, 2.3)], color: ['#5f5b55', '#4e4b46', '#6b665f'][Math.floor(qr() * 3)],
          };
          if (forkOld(4) && (FORK_OLD || (offGravel(rp) && offBank(rp)))) rocks.push(stone);
        }
      }
    }
    if (!forkOld(4)) rocks.push(...edgeStones(pts, w, seed + 40, { sparse, ok: edgeOk(way) }));
  }

  yield 'The fork, raked';
  // ── The fork, raked ──────────────────────────────────────────────────────
  // "Every path taken at once" — and the gravel was one flat grey, nothing at
  // the reader's feet saying that the way divides. So it is raked, as a
  // temple garden's gravel is: grooves running the length of each way, and
  // where the ways part, a flat stone with the grooves going round it in
  // rings and leaving by every road at once. A groove is a dark furrow with
  // the gravel it threw up pale beside it.
  {
    const TOP = 5.2, R0 = 9.6;   // the gravel's top (slabGeo above), the rings' reach
    // (only the stretches of it `keep` keeps: a groove stops where it would
    // run out over another way's gravel)
    // (`o` may be a function of how far along: the passes of the rake wander,
    // forkFix.js, 2; and `gap(s, p)` breaks it — at a stone, or scuffed out)
    const furrow = (pts, o, keep, gap) => {
      let s = 0;
      const along = pts.map((p, i) => (s += i ? dist(pts[i - 1], p) : 0));
      const off = pts.map((p, i) => {
        const t = unit2(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]);
        return add(p, [-t[1], t[0]], typeof o === 'function' ? o(along[i]) : o);
      });
      const runs = [[]];
      off.forEach((p, i) => {
        if ((!keep || keep(p)) && !(gap && gap(along[i], p))) runs[runs.length - 1].push(p);
        else if (runs[runs.length - 1].length) runs.push([]);
      });
      for (const run of runs) {
        if (run.length < 2) continue;
        (forkOld(2) ? GB.rakeDark : GB.forkRakeDark).add(wornRibbon(run, 0.26, TOP + 0.02));
        const lip = run.map((p, i) => {
          const t = unit2(run[Math.max(0, i - 1)], run[Math.min(run.length - 1, i + 1)]);
          return add(p, [-t[1], t[0]], 0.24);
        });
        GB.rakeLit.add(wornRibbon(lip, 0.18, TOP + 0.025));
      }
    };
    // each way from the stone outward, cut back from it to where the rings end
    const fromStone = (pts) => {
      const q = (pts[0] === J ? pts : pts.slice().reverse()).filter((p, i) => i > 0 && dist(p, J) > R0 + 1.5);
      return [add(J, unit2(J, q[0]), R0 + 0.4), ...q];
    };
    // a way's line again with a point every unit or two, so a groove can stop
    // close to where it should
    const fine = (pts) => pts.flatMap((p, i) => {
      if (i === 0) return [p];
      const n = Math.ceil(dist(pts[i - 1], p) / 1.5);
      return Array.from({ length: n }, (_, k) => lerp2(pts[i - 1], p, (k + 1) / n));
    });
    // The road to the Heart leaves the way to the bridge at a narrower angle
    // than the old road did, and their gravels run together for a few paces
    // past the rings: there its grooves give way to the bridge way's, and it
    // peels off that way's edge rather than crossing it. It is raked to where
    // it meets the way from the water, as far as the old road was raked.
    const offWays = (ways) => (p) => ways.every((o) => lineDist(p, o.pts) > o.w / 2 - 0.3);
    const raked = [[PATHS[0].pts, PATHS[0].w], [PATHS[1].pts, PATHS[1].w], FORK_OLD
      ? [ROAD.ctrl.slice(0, 3), ROAD.w]
      : [fine([J, ...ROAD.pts.slice(1)]), ROAD.w, offWays([PATHS[1], PATHS[2]])]];
    // the stones a furrow stops short of: whatever sits at the ways' edges
    // (the stones set in groups along them since forkFix.js, 4, the big ones
    // well into the gravel), each with its reach
    const sitting = rocks.filter((r) => r.bank === undefined && dist([r.p[0], r.p[2]], J) < 170)
      .map((r) => ({ p: [r.p[0], r.p[2]], r: Math.max(r.s[0], r.s[2]) + RAKE.clear }));
    const atStone = (p) => sitting.some((st) => Math.abs(st.p[0] - p[0]) < st.r && Math.abs(st.p[1] - p[1]) < st.r && dist(st.p, p) < st.r);
    raked.forEach(([pts, w, keep], wi) => {
      // (a groove every hand's breadth: at twice that, coarse and dark, the
      // raked way read from the stand as a striped walkway)
      if (forkOld(2)) {
        const way = fromStone(pts);
        for (let o = -(w / 2 - 2.2); o <= w / 2 - 2.2 + 1e-6; o += 1.25) furrow(way, o, keep);
        return;
      }
      // Ruled, they read as a crossing: in passes of a four-tined rake now,
      // each pass wandering and the passes drifting apart and together, and a
      // furrow broken where a stone sits and here and there scuffed out.
      const way = fine(fromStone(pts));
      for (let k = 0, o = -(w / 2 - 2.2); o <= w / 2 - 2.2 + 1e-6; o += 1.25, k++) {
        const kk = k, o0 = o, scuffs = rakeScuffs(kk, wi, 600);
        furrow(way, (s) => rakeOffset(kk, o0, s, wi), keep, (s, p) => atStone(p) || scuffs.some(([a, b]) => s >= a && s <= b));
      }
    });
    // (rings carry the ribbons' second uv set too, or the two will not merge)
    const ring = (r0, r1, y) => {
      const g = new THREE.RingGeometry(r0, r1, 64).rotateX(-Math.PI / 2).translate(J[0], y, J[1]);
      g.setAttribute('uv1', g.attributes.uv.clone());
      return g;
    };
    if (propsOld(3) || !GB.shoreStone) {
      for (let r = 3.1; r <= R0; r += 1.25) {
        (forkOld(2) ? GB.rakeDark : GB.forkRakeDark).add(ring(r - 0.13, r + 0.13, TOP + 0.02));
        GB.rakeLit.add(ring(r + 0.15, r + 0.33, TOP + 0.025));
      }
      // the stone the ways part at, low and flat: stepped on, never stepped round
      GB.stone.add(new THREE.CylinderGeometry(2.3, 2.5, 0.7, 20).scale(1, 1, 0.82).rotateY(0.4).translate(J[0], TOP + 0.2, J[1]));
    } else {
      // (forkProps.js, 3: that was a sawn disc with a groove ruled across it —
      // a puck. A stone now, the garden's granite (shore.js): wider than it
      // is tall, most of it in the ground, cleft and worn and lichened, its
      // top level enough to stand on and no higher over the gravel than a
      // foot goes up without thinking. And the rake goes round the stone it
      // has, not round a compass point: the first ring a hand off its outline,
      // each one rounder, the last the circle the ways' furrows start from.)
      const g = gardenRock({ ...FORK_STONE.rock, flatTop: true, detail: light ? 12 : 22 });
      g.computeBoundingBox();
      g.rotateY(FORK_STONE.turn).translate(J[0], TOP + FORK_STONE.proud - g.boundingBox.max.y, J[1]);
      // its outline where it comes out of the gravel, by bearing
      const N = 96, out = new Float32Array(N), pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < TOP - 0.25 || y > TOP + 0.45) continue;
        const x = pos.getX(i) - J[0], z = pos.getZ(i) - J[1];
        const k = Math.round(((Math.atan2(z, x) / (Math.PI * 2) + 1) % 1) * N) % N;
        out[k] = Math.max(out[k], Math.hypot(x, z));
      }
      const mean = out.reduce((s, v) => s + v, 0) / out.filter((v) => v > 0).length;
      for (let k = 0; k < N; k++) if (!out[k]) out[k] = mean;
      let line = Array.from(out);
      for (let pass = 0; pass < 3; pass++) line = line.map((v, k) => (line[(k + N - 1) % N] + 2 * v + line[(k + 1) % N]) / 4);
      GB.shoreStone.add(g);
      const rings = Math.max(3, Math.round((R0 - mean - 0.8) / 1.25) + 1);
      for (let j = 0; j < rings; j++) {
        const t = j / (rings - 1);
        const at = (off) => Array.from({ length: N + 1 }, (_, k) => {
          const a = ((k % N) / N) * Math.PI * 2, r = (line[k % N] + 0.8) * (1 - t) + R0 * t + off;
          return [J[0] + Math.cos(a) * r, J[1] + Math.sin(a) * r];
        });
        (forkOld(2) ? GB.rakeDark : GB.forkRakeDark).add(wornRibbon(at(0), 0.26, TOP + 0.02));
        GB.rakeLit.add(wornRibbon(at(0.24), 0.18, TOP + 0.025));
      }
    }
  }

  yield 'The wisteria pergola, hung with lanterns';
  // ── The wisteria pergola, hung with lanterns ─────────────────────────────
  // What the arch opens onto, and what walks the reader from it to the Fork.
  // It was six-sided posts, square beams and a flat card of leaves laid over
  // the top — the rough frame that stood in the old breach as the Door's only
  // arch. Now joinery: each post an octagon on a stone base, a bearing block
  // on its head, a tie beam across with its ends cut to a cloud, curved
  // braces up to the beam and along to the purlins, rafters across the top
  // and battens along them — and the wisteria not painted on a card but
  // hanging, a raceme at a time, from the rafters it has taken over, with the
  // old vines it climbed by twisted up four of the posts. Four paper lanterns
  // in the bays, ribbed and capped.
  //
  // Laid out in its own frame — x across, y up, z along from the Door toward
  // the Fork — and set on the path here. None of it draws on the world's
  // stream but the four halos, which always did.
  {
    const a = PATHS[0].pts[0], b = J, L = dist(a, b);
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const frame = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(t[1], 0, -t[0]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(t[0], 0, t[1]),
    ).setPosition(a[0], 0, a[1]);
    const W3 = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(frame);
    const wood = (g) => GB.wood.add(g.applyMatrix4(frame));
    const stone = (g) => GB.stone.add(g.applyMatrix4(frame));
    const lacq = (g) => GB.lacquer.add(g.applyMatrix4(frame));
    const gold = (g) => GB.gold.add(g.applyMatrix4(frame));
    const bx = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    // a side profile [[across, y]] run along z for w, or [[along, y]] run across x for w
    const alongZ = (pts, z0, w) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: w, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, z0);
    const alongX = (pts, x0, w) => alongZ(pts.map(([u, y]) => [-u, y]), 0, w).rotateY(Math.PI / 2).translate(x0, 0, 0);
    const pr = makeRng(6606), within = (lo, hi) => lo + (hi - lo) * pr();
    // Four frames. A fifth stood three paces short of the Fork's stone, and from
    // where the reader stops at the Fork its left post stood exactly in front
    // of the stone lantern beyond it (they were at one bearing from there, to
    // within a fraction of a degree); and it was the post the road not taken
    // went through, and the one turned out of the stand's frame because it read
    // as a tree trunk. So the pergola ends a bay sooner, and the Fork is open
    // ground. (?wpergola=old)
    const Z0 = 40, BAY = 22, FRAMES = [0, 1, 2, 3, 4].map((k) => Z0 + k * BAY).filter((z) => z < L + 1).slice(0, PERGOLA_OLD ? 5 : 4);
    const POST = 17, SPAN = 25, GROUND = 5.2;
    const TIE = [39.4, 42.8], PURLIN = [TIE[1], TIE[1] + 2.6], RAFTER = [PURLIN[1], PURLIN[1] + 1.3];
    const zA = Z0 - 6, zB = FRAMES[FRAMES.length - 1] + 6;
    // A curved brace from (u0, y0) — on the post — up to (u1, y1), under a
    // beam: a band of timber a quarter-circle round, drawn in its own plane.
    const braceShape = (u0, y0, u1, y1, w = 1.25) => {
      // a quarter ellipse about the open corner (u1, y0), and a second one w
      // further out; both ends run into the timber they join
      const rx = Math.abs(u1 - u0), ry = y1 - y0, s = Math.sign(u1 - u0), n = 12;
      const inner = [], outer = [];
      for (let k = 0; k <= n; k++) {
        const th = (k / n) * (Math.PI / 2);
        inner.push([u1 - s * rx * Math.cos(th), y0 + ry * Math.sin(th)]);
        outer.push([u1 - s * (rx + w) * Math.cos(th), y0 + (ry + w) * Math.sin(th)]);
      }
      return [...inner, ...outer.reverse()];
    };
    for (const z of FRAMES) {
      for (const side of [-1, 1]) {
        const x = side * POST, foot = W3(x, 0, z);
        standing.push({ p: [foot.x, foot.z], r: 3.6 });
        // the base: a stone plinth, chamfered, and a drum
        stone(bx(x - 2.5, x + 2.5, GROUND - 0.4, GROUND + 1.2, z - 2.5, z + 2.5));
        stone(bx(x - 2.1, x + 2.1, GROUND + 1.2, GROUND + 1.9, z - 2.1, z + 2.1));
        stone(new THREE.LatheGeometry([[0, 0], [1.95, 0], [1.95, 0.3], [1.7, 0.8], [1.62, 1.4], [0, 1.4]].map(([r, y]) => new THREE.Vector2(r, y)), 16).translate(x, GROUND + 1.9, z));
        // the post, an octagon, with a collar where the brackets take it
        wood(new THREE.CylinderGeometry(1.35, 1.45, TIE[0] - 1.3 - (GROUND + 3.3), 8).rotateY(Math.PI / 8).translate(x, (TIE[0] - 1.3 + GROUND + 3.3) / 2, z));
        wood(new THREE.CylinderGeometry(1.62, 1.62, 0.6, 8).rotateY(Math.PI / 8).translate(x, 31.2, z));
        wood(bx(x - 1.9, x + 1.9, TIE[0] - 1.3, TIE[0], z - 1.9, z + 1.9));
        // braces: along the pergola up to the purlin, both ways, and across up to the tie beam
        for (const way of [-1, 1]) {
          if ((way < 0 && z === FRAMES[0]) || (way > 0 && z === FRAMES[FRAMES.length - 1])) continue;
          wood(alongX(braceShape(z + way * 1.2, 31.6, z + way * 8.5, PURLIN[0]), x - 0.62, 1.25));
        }
        wood(alongZ(braceShape(x - side * 1.2, 32.4, x - side * 7.5, TIE[0]), z - 0.6, 1.2));
      }
      // the tie beam, its ends cut to a cloud beyond the posts
      const cloud = (s) => {
        const pts = [];
        for (let k = 0; k <= 12; k++) {
          const f = k / 12;
          pts.push([s * (POST + 1.6 + f * (SPAN - POST - 1.6)), TIE[0] + 1.9 * (0.5 - 0.5 * Math.cos(Math.PI * f)) - 0.35 * Math.sin(Math.PI * 2 * f)]);
        }
        return pts;
      };
      wood(alongZ([...cloud(-1).reverse(), ...cloud(1), [SPAN, TIE[1] - 0.5], [SPAN - 0.5, TIE[1]], [-SPAN + 0.5, TIE[1]], [-SPAN, TIE[1] - 0.5]], z - 1.25, 2.5));
    }
    // the purlins along the heads of the posts, their ends cut the same way
    for (const side of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 10; k++) { const f = k / 10; pts.push([zA + f * 5.5, PURLIN[0] + 1.6 * (0.5 + 0.5 * Math.cos(Math.PI * f))]); }
      for (let k = 0; k <= 10; k++) { const f = k / 10; pts.push([zB - 5.5 + f * 5.5, PURLIN[0] + 1.6 * (0.5 - 0.5 * Math.cos(Math.PI * f))]); }
      pts.push([zB, PURLIN[1]], [zA, PURLIN[1]]);
      wood(alongX(pts, side * POST - 1.1, 2.2));
    }
    // rafters across the top, their ends splayed, and battens along them
    const rafters = [];
    for (let z = zA + 1.5; z <= zB - 1; z += 3.3) {
      rafters.push(z);
      wood(alongZ([[-SPAN + 1.2, RAFTER[0]], [SPAN - 1.2, RAFTER[0]], [SPAN + 0.6, RAFTER[1]], [-SPAN - 0.6, RAFTER[1]]], z - 0.5, 1));
    }
    for (const x of [-20.5, -12, -4, 4, 12, 20.5]) wood(bx(x - 0.4, x + 0.4, RAFTER[1], RAFTER[1] + 0.7, zA + 0.5, zB - 0.5));
    // old vines up four of the posts, twisted round them and over onto the top
    for (const [x, z, turns] of [[-POST, FRAMES[0], 2.2], [POST, FRAMES[1], 1.8], [-POST, FRAMES[2], 2.5], [POST, FRAMES[3], 2]]) {
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const f = k / 40, ang = f * turns * Math.PI * 2 + x * 0.1, r = 1.9 + Math.sin(f * 9) * 0.2;
        pts.push(new THREE.Vector3(x + Math.cos(ang) * r, GROUND + 1 + f * (RAFTER[1] - GROUND - 0.4), z + Math.sin(ang) * r));
      }
      for (let k = 1; k <= 8; k++) pts.push(new THREE.Vector3(x + Math.sin(k) * 0.8, RAFTER[1] + 0.6 + Math.sin(k * 1.7) * 0.3, z + k * 2.6 * (x < 0 ? 1 : -1)));
      if (IVY_OLD) wood(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), light ? 40 : 90, 0.3, 6, false));
    }
    // (ivy.js) The same four vines grown as wisteria grows: out of the ground
    // beside the plinth, over its edge, two strands twisted on each other as
    // they twine the post, thick and grey-barked at the foot and thinning as
    // they climb; up past the head of the post on the outside, clear of the
    // tie beam, and over onto the rafters, where the run of the old vine
    // went; leaves off the upper post and the run, and a few young shoots
    // reaching out into the air.
    if (!IVY_OLD) {
      const vr = makeRng(6611), VR = (lo, hi) => lo + (hi - lo) * vr();
      const qf = new THREE.Quaternion().setFromRotationMatrix(frame), eu = new THREE.Euler();
      const barkTint = new THREE.Color('#8f8d88'), shootTint = new THREE.Color('#7d7a52');
      const VINE_GREEN = ['#4f6e30', '#5a7a36', '#476629', '#62823a', '#55743a'];
      for (const [x, z, turns] of [[-POST, FRAMES[0], 2.2], [POST, FRAMES[1], 1.8], [-POST, FRAMES[2], 2.5], [POST, FRAMES[3], 2]]) {
        const sx = Math.sign(x), runZ = x < 0 ? 1 : -1;
        // the side of the tie beam to go up past: the one farther from a rafter
        const clear = (zz) => Math.min(...rafters.map((r) => Math.abs(r - zz)));
        const dz = clear(z + 1.6) >= clear(z - 1.6) ? 1.6 : -1.6;
        const over = [
          new THREE.Vector3(x + sx * 2.0, TIE[0] - 0.4, z + dz * 1.1),
          new THREE.Vector3(x + sx * 2.5, TIE[0] + 2.1, z + dz * 1.05),
          new THREE.Vector3(x + sx * 2.6, PURLIN[0] + 1.8, z + dz * 0.97),
          new THREE.Vector3(x + sx * 2.0, RAFTER[1] + 0.45, z + dz * 0.8),
        ];
        for (let k = 1; k <= 6; k++) over.push(new THREE.Vector3(x + sx * 1.4 + Math.sin(k * 1.3) * 0.7, RAFTER[1] + 0.45 + Math.max(0, Math.sin(k * 1.7)) * 0.25, z + dz * 0.8 + k * 2.6 * runZ));
        const vine = twineWisteria({
          x, z, postR: 1.5, plinthR: 2.5, ground: GROUND, foot: { r: 1.95, y: GROUND + 3.3 }, top: TIE[0] - 1.8, turns,
          endAngle: Math.atan2(dz * 1.1, sx * 2.0), over,
        }, vr);
        for (const st of vine.strands) ivyWood.tube(st.map((nd) => ({ p: nd.p.clone().applyMatrix4(frame), r: nd.r })), st[0].r > 0.25 ? 9 : 6, barkTint);
        for (const sh of vine.shoots) ivyWood.tube(sh.map((nd) => ({ p: nd.p.clone().applyMatrix4(frame), r: nd.r })), 4, shootTint);
        for (const lf of vine.leaflets) {
          const p = lf.p.clone().applyMatrix4(frame);
          eu.setFromQuaternion(qf.clone().multiply(lf.q));
          const s = lf.s * 0.72;
          vineLeaves.push({ p: [p.x, p.y, p.z], rot: [eu.x, eu.y, eu.z], s: [s, s, s], color: VINE_GREEN[Math.floor(vr() * VINE_GREEN.length)], k: VR(0.85, 1.1) });
        }
      }
    }
    // The wisteria: a raceme from the rafters every couple of units, longest
    // at the sides and short over the path, so the way through is a tunnel of
    // flowers that clears the head; leaves in with them; and leaf over the top.
    for (const z of rafters) {
      for (let x = -SPAN + 2 + pr() * 1.5; x < SPAN - 2; x += within(1.6, 2.8)) {
        const edge = Math.min(1, Math.abs(x) / POST), green = pr() < 0.28;
        const len = (green ? within(6, 12) : within(5, 9)) + edge * edge * within(4, 9);
        const q = W3(x + within(-0.4, 0.4), RAFTER[0] + 0.1, z + within(-0.6, 0.6));
        const yaw = pr() * Math.PI, wide = green ? within(3, 4.2) : within(2.8, 3.8), kind = green ? 2 + Math.floor(pr() * 2) : Math.floor(pr() * 2), k = within(0.85, 1.1);
        if (RAFTER[0] - len < 30 + (1 - edge) * 4) continue;
        hangs.push({ p: [q.x, q.y, q.z], rot: [0, yaw, 0], s: [wide, len, 1], kind, color: green ? '#c4d0c0' : '#e6dcec', k });
      }
    }
    let canopy = 0;
    const canopyFrame = new THREE.Quaternion().setFromRotationMatrix(frame), canopyEuler = new THREE.Euler();
    const CANOPY_GREEN = ['#3f5c28', '#4a6a2e', '#3a5524', '#55743a'];
    for (let z = zA + 2; z < zB - 2; z += within(3.5, 5)) {
      for (const x of [-18, -9, 0, 9, 18]) {
        const skip = pr() < 0.25;
        const q = W3(x + within(-3, 3), RAFTER[1] + within(1.2, 2.4), z);
        const item = { p: [q.x, q.y, q.z], rot: [within(-0.2, 0.2), pr() * 6.28, within(-0.2, 0.2)], s: Array(3).fill(within(6, 9.5)), color: LEAF[Math.floor(pr() * LEAF.length)], k: within(0.55, 0.8) };
        if (skip) continue;
        if (IVY_OLD) { foliage.push(item); continue; }
        // (ivy.js) not a ball of painted leaf on the battens but the leaves
        // themselves: a spread of wisteria leaves where it lay, laid out over
        // the rafters and hanging between them
        const cr = makeRng(7000 + canopy++), CR = (lo, hi) => lo + (hi - lo) * cr();
        const S = item.s[0];
        for (let n = 0; n < (light ? 6 : 12); n++) {
          const a = cr() * Math.PI * 2, r = Math.sqrt(cr()) * S * 0.42;
          const base = new THREE.Vector3(x + Math.cos(a) * r, RAFTER[1] + CR(0.3, 1.4), z + Math.sin(a) * r);
          const dirn = new THREE.Vector3(Math.cos(a + CR(-0.6, 0.6)), CR(-0.25, 0.25), Math.sin(a + CR(-0.6, 0.6))).normalize();
          const got = [];
          compoundLeaf(base, dirn, CR(2.6, 3.8), 0.72 * CR(0.85, 1.15), cr, got);
          for (const lf of got) {
            const p = lf.p.applyMatrix4(frame);
            canopyEuler.setFromQuaternion(canopyFrame.clone().multiply(lf.q));
            vineLeaves.push({ p: [p.x, p.y, p.z], rot: [canopyEuler.x, canopyEuler.y, canopyEuler.z], s: [lf.s, lf.s, lf.s], color: CANOPY_GREEN[Math.floor(cr() * CANOPY_GREEN.length)], k: CR(0.7, 1.0) });
          }
        }
      }
    }
    if (ivyLeaves.length) instances(ivyLeafGeometry(), M.ivyLeaf, ivyLeaves, { cast: false, chunked: true, name: 'ivy' });
    if (vineLeaves.length) instances(leafletGeometry(), M.vineLeaf, vineLeaves, { cast: false, chunked: true, name: 'ivy' });
    if (ivyWood.pos.length) {
      const g = keep(ivyWood.geometry());
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, M.bark);
      m.castShadow = true;
      m.receiveShadow = true;
      // (not felt: a foot or a shoulder brushes past ivy — body.js, UNFELT)
      m.name = 'ivyStems';
      root.add(m);
    }
    // The lanterns: round paper globes on cords, a fine bamboo rib every so
    // often round them, a lacquered cap and foot, and a short silk tassel.
    for (const z of [51, 73, 95, 117]) {
      // (the fourth bay went with the fifth frame; its halo's draw is still taken)
      if (z > zB) { rr(0, 100); continue; }
      const LY = 29.5, R = 2.6, H = 2.75, p = W3(0, LY, z);
      // (the paper lit from its flame, the ribs drawn in it — lampPass.js)
      if (LAMPS.paper) trialPaper.push({ p: [p.x, p.y, p.z], s: [R, H, R], color: '#fff0e0', k: 1.0 });
      else glows.push({ p: [p.x, p.y, p.z], s: [R, H, R], color: '#ffb86e', k: 1.15 });
      for (let k = -3; k <= 3 && !LAMPS.paper; k++) {
        const yy = (k / 3.6) * H, r = R * Math.sqrt(Math.max(0, 1 - (yy / H) ** 2)) + 0.03;
        lacq(new THREE.TorusGeometry(r, 0.045, 4, 32).rotateX(Math.PI / 2).translate(0, LY + yy, z));
      }
      lacq(new THREE.CylinderGeometry(0.9, 1.25, 0.55, 18).translate(0, LY + H - 0.05, z));
      lacq(new THREE.CylinderGeometry(1.25, 0.95, 0.5, 18).translate(0, LY - H + 0.05, z));
      gold(new THREE.CylinderGeometry(0.28, 0.4, 0.45, 10).translate(0, LY + H + 0.45, z));
      wood(new THREE.CylinderGeometry(0.08, 0.08, RAFTER[0] - LY - H - 0.6, 5).translate(0, (RAFTER[0] + LY + H + 0.6) / 2, z));
      gold(new THREE.SphereGeometry(0.28, 10, 8).translate(0, LY - H - 0.55, z));
      lacq(new THREE.CylinderGeometry(0.18, 0.34, 2.1, 10).translate(0, LY - H - 1.8, z));
      // (from the Door the three lay one on another down the pergola: doorFix.js, 4)
      halo([p.x, p.z], LY, doorOld(4) ? 40 : LANTERN_HALO.size, '#ffb866', doorOld(4) ? 0.35 : LANTERN_HALO.opacity);
    }
    point(add(a, t, 64), 25, '#ffb866', 4200, 6);
    decal(lerp2(a, b, 0.5), 220, 130, '#ffae5c', 0.24 * POOL_DIAL, 5.8, 0.12);
  }

  yield 'Lanterns';
  // ── Lanterns ─────────────────────────────────────────────────────────────
  // Tōrō of the Kasuga kind: a six-sided foot under a ring of lotus petals
  // turned down; a round post with a knot at its middle; a platform on petals
  // turned up; the fire box, a paper window front and back and the sun and the
  // moon cut through two more of its sides; a wide six-sided roof whose
  // corners curl up like young fern; and the jewel on top. They were a box, a
  // post and a pyramid, with a glowing egg sitting ON the roof and nothing but
  // air where the fire belongs — a lamp turned inside out. The light is inside
  // now, behind paper, and falls first on the lantern's own stone (flameLit).
  //
  // Each is built about its own axis (y is the world's) with face 0 of every
  // hexagon at 30° and a corner at 0°, as three's six-sided cylinders have
  // them, then turned and set down. None of it draws on the world's stream
  // but the halo and the pool, which always did.
  const HEX = Math.PI / 3;
  const V2 = (x, y) => new THREE.Vector2(x, y);
  // A sheet of quads from fn(u, v) → [x, y, z], u and v 0 to 1; `flip` turns it over.
  const sheet = (fn, nu, nv, flip = false) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { pos.push(...fn(i / nu, j / nv)); uv.push(i / nu, j / nv); }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = i * (nv + 1) + j, b = a + nv + 1;
        if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1);
        else idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const lathe = (prof, n) => new THREE.LatheGeometry(prof.map(([r, y]) => V2(r, y)), n);
  // Lotus petals turned on a lathe: `prof` is [r, y, w] from the bottom up, w
  // how far out toward the petals' free edge that ring lies (0 at the root),
  // so the petals part at their tips and are one stone at the root.
  const petalLathe = (prof, petals, depth, per = 6) => {
    const n = petals * Math.max(4, Math.round(per * detail));
    const g = lathe(prof, n), pos = g.attributes.position, np = prof.length;
    for (let i = 0; i <= n; i++) {
      const lobe = Math.sqrt(Math.abs(Math.cos((i / n) * Math.PI * petals)));
      for (let j = 0; j < np; j++) {
        const k = i * np + j, s = 1 - depth * prof[j][2] * (1 - lobe);
        pos.setX(k, pos.getX(k) * s);
        pos.setZ(k, pos.getZ(k) * s);
      }
    }
    g.computeVertexNormals();
    return g;
  };
  // A side of a six-sided box, `w` wide and `t` thick, with what is cut
  // through it; laid with its outer face at z = 0, for `onFace` to set on face k.
  const panel = (w, y0, y1, t, holes = []) => {
    const s = new THREE.Shape([V2(-w / 2, y0), V2(w / 2, y0), V2(w / 2, y1), V2(-w / 2, y1)]);
    s.holes.push(...holes);
    return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: light ? 8 : 16 }).translate(0, 0, -t);
  };
  const onFace = (g, k, R) => {
    const a = (k + 0.5) * HEX, apo = R * Math.cos(HEX / 2);
    return g.rotateY(a).translate(Math.sin(a) * apo, 0, Math.cos(a) * apo);
  };
  // The moon: a disc with a second, offset disc taken out of it.
  const crescent = (cx, cy, r1, ox, oy, r2, n = 18) => {
    const d = Math.hypot(ox, oy), beta = Math.atan2(oy, ox);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const g1 = Math.acos(a / r1), g2 = Math.acos((d - a) / r2);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const th = beta + g1 + (2 * Math.PI - 2 * g1) * (i / n);
      pts.push(V2(cx + r1 * Math.cos(th), cy + r1 * Math.sin(th)));
    }
    for (let i = 1; i < n; i++) {
      const th = beta + Math.PI + g2 - 2 * g2 * (i / n);
      pts.push(V2(cx + ox + r2 * Math.cos(th), cy + oy + r2 * Math.sin(th)));
    }
    return new THREE.Path(pts);
  };
  // A six-sided roof: R to its corners at the eave; the underside of the eave
  // at y0 mid-side, T thick there; rising H, hollowed, to a ring of radius
  // `top`; the corners lifted by `lift`, and the underside meeting the box it
  // sits on at `seat`. One sheet per slope, so the hips stay sharp.
  const hexRoof = ({ R, y0, T, H, lift, top, seat, nu = 10, nv = 8 }) => {
    const geos = [];
    for (let k = 0; k < 6; k++) {
      const at = (u) => {
        const phi = (k + u) * HEX;
        return { s: Math.sin(phi), c: Math.cos(phi), r: R * Math.cos(HEX / 2) / Math.cos((u - 0.5) * HEX), up: lift * Math.abs(2 * u - 1) ** 7 };
      };
      geos.push(sheet((u, t) => {
        const a = at(u), r = a.r + (top - a.r) * t;
        return [a.s * r, y0 + T + H * (0.45 * t + 0.55 * t * t) + a.up * (1 - t) ** 2.5, a.c * r];
      }, nu, nv));
      geos.push(sheet((u, v) => { const a = at(u); return [a.s * a.r, y0 + a.up + T * v, a.c * a.r]; }, nu, 1));
      geos.push(sheet((u, t) => {
        const a = at(u), r = a.r + (seat - a.r) * t;
        return [a.s * r, y0 + a.up * (1 - t) ** 2.5 + 0.25 * t, a.c * r];
      }, nu, 4, true));
    }
    return geos;
  };
  // Its hips: a rolled ridge down each, and at each corner the fern — a
  // scroll rising off the tip and rolling back in on itself, tighter as it
  // goes (a ring of even radius left a hole through it and read as a handle).
  const roofCorners = ({ R, y0, T, H, lift, top }, rho, tube, ridge) => {
    const geos = [];
    for (let k = 0; k < 6; k++) {
      const phi = k * HEX, s = Math.sin(phi), c = Math.cos(phi), pts = [];
      for (let j = 0; j <= 10; j++) {
        const t = 0.04 + 0.9 * (j / 10), r = R + (top - R) * t;
        pts.push(new THREE.Vector3(s * r, y0 + T + H * (0.45 * t + 0.55 * t * t) + lift * (1 - t) ** 2.5 + ridge * 0.5, c * r));
      }
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, ridge, 5, false));
      const out = R - rho * 0.6, curl = [];
      for (let j = 0; j <= 16; j++) {
        const f = j / 16, th = -Math.PI / 2 + f * Math.PI * 2.1, r = rho * (1 - 0.62 * f);
        curl.push(new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, 0));
      }
      const eye = [s * out, y0 + T + lift + rho * 0.55, c * out];
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curl), 20, tube, 6, false).rotateY(phi - Math.PI / 2).translate(...eye));
      geos.push(new THREE.SphereGeometry(tube * 0.9, 8, 6).translate(...eye));
    }
    return geos;
  };
  // Paper with a flame behind it: brightest and palest nearest the flame,
  // deepening to amber and dimming toward its edges, as a shōji does. In
  // vertex colours, so the sheet is cut fine enough to carry the fall-off.
  const paperHot = new THREE.Color('#ffd9a4'), paperEdge = new THREE.Color('#ff9f55'), paperC = new THREE.Color();
  const litPaper = (geo, flame, near, strength) => {
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const f = Math.min(1.25, ((near * near) / v.fromBufferAttribute(pos, i).distanceToSquared(flame)) ** 1.4);
      paperC.copy(paperEdge).lerp(paperHot, Math.min(1, f)).multiplyScalar(strength * (0.28 + 1.1 * f));
      col.set([paperC.r, paperC.g, paperC.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  };

  // `face`: what the windows look toward.
  const toro = (p, lit, face) => {
    standing.push({ p, r: 4.2 });
    const yaw = Math.atan2(face[0] - p[0], face[1] - p[1]) - HEX / 2;
    const flame = new THREE.Vector3(p[0], 20.5, p[1]), axis = [Math.sin(yaw + HEX / 2), Math.cos(yaw + HEX / 2)];
    const set = (g) => g.rotateY(yaw).translate(p[0], 0, p[1]);
    const stone = (g) => {
      set(g);
      const n = g.attributes.position.count, f = [flame.x, flame.y, flame.z, lit ? 13 : 0];
      g.setAttribute('aFlame', new THREE.BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => f[i % 4]), 4));
      g.setAttribute('aFlameAxis', new THREE.BufferAttribute(Float32Array.from({ length: n * 2 }, (_, i) => axis[i % 2]), 2));
      GB.lantern.add(g);
    };
    const round = Math.round(20 * detail);
    // the foot
    stone(new THREE.CylinderGeometry(4.0, 4.15, 2.9, 6).translate(0, 5.05, 0));
    stone(new THREE.CylinderGeometry(3.75, 3.95, 0.35, 6).translate(0, 6.675, 0));
    stone(petalLathe([[3.55, 6.8, 1], [3.5, 7.1, 0.95], [3.2, 7.55, 0.75], [2.65, 8.0, 0.45], [2.05, 8.35, 0.15], [1.7, 8.55, 0], [1.45, 8.6, 0]], 12, 0.2));
    // the post, with the knot at its middle
    stone(new THREE.CylinderGeometry(1.28, 1.42, 7.8, round).translate(0, 12.4, 0));
    stone(new THREE.CylinderGeometry(1.58, 1.58, 0.55, round).translate(0, 12.3, 0));
    for (const y of [11.8, 12.8]) stone(new THREE.TorusGeometry(1.45, 0.16, 6, round).rotateX(Math.PI / 2).translate(0, y, 0));
    // the platform, on petals turned up
    stone(petalLathe([[1.25, 16.1, 0], [1.6, 16.35, 0.1], [2.3, 16.8, 0.4], [2.95, 17.35, 0.75], [3.3, 17.85, 0.95], [3.25, 18.05, 1]], 12, 0.22));
    stone(new THREE.CylinderGeometry(3.45, 3.6, 0.85, 6).translate(0, 18.45, 0));
    stone(new THREE.CylinderGeometry(3.05, 3.3, 0.3, 6).translate(0, 19.0, 0));
    // The fire box. Windows on faces 0 and 3, the sun through face 1 and the
    // moon through face 4, and on the last two a panel carved in low relief.
    const FB = [19.15, 23.25], RB = 2.65, TH = 0.38, WIN = [-0.78, 0.78, 19.75, 22.6], SUN = 21.55;
    for (let k = 0; k < 6; k++) {
      const holes = k % 3 === 0 ? [new THREE.Path([V2(WIN[0], WIN[2]), V2(WIN[1], WIN[2]), V2(WIN[1], WIN[3]), V2(WIN[0], WIN[3])])]
        : k === 1 ? [new THREE.Path().absarc(0, SUN, 0.56, 0, Math.PI * 2, false)]
          : k === 4 ? [crescent(0, SUN, 0.6, 0.22, 0.12, 0.56)] : [];
      stone(onFace(panel(RB, FB[0], FB[1], TH, holes), k, RB));
      if (k === 2 || k === 5) {
        for (const g of [
          new THREE.BoxGeometry(0.16, 3.36, 0.1).translate(-0.86, 21.2, 0.05), new THREE.BoxGeometry(0.16, 3.36, 0.1).translate(0.86, 21.2, 0.05),
          new THREE.BoxGeometry(1.88, 0.16, 0.1).translate(0, 19.6, 0.05), new THREE.BoxGeometry(1.88, 0.16, 0.1).translate(0, 22.8, 0.05),
        ]) stone(onFace(g, k, RB));
      }
      stone(new THREE.CylinderGeometry(0.3, 0.3, FB[1] - FB[0], 8).translate(Math.sin(k * HEX) * RB, (FB[0] + FB[1]) / 2, Math.cos(k * HEX) * RB));
    }
    stone(new THREE.CylinderGeometry(RB + 0.28, RB + 0.2, 0.4, 6).translate(0, FB[1] + 0.2, 0));
    // what the light comes through: paper behind every opening, and a shōji
    // in each window — its frame, and the lattice across it
    const near = RB * Math.cos(HEX / 2) - TH - 0.02;
    const paper = (g, k) => {
      set(onFace(g.translate(0, 0, -TH - 0.02), k, RB));
      if (lit) GB.paperLit.add(litPaper(g, flame, near, 0.8));
      else GB.paperDead.add(g);
    };
    for (const k of [0, 3]) {
      paper(new THREE.PlaneGeometry(1.9, 3.1, 4, 8).translate(0, (WIN[2] + WIN[3]) / 2, 0), k);
      const mid = (WIN[2] + WIN[3]) / 2, h = WIN[3] - WIN[2], w = WIN[1] - WIN[0], z = -TH + 0.09;
      for (const g of [
        new THREE.BoxGeometry(0.13, h, 0.14).translate(WIN[0] + 0.065, mid, z), new THREE.BoxGeometry(0.13, h, 0.14).translate(WIN[1] - 0.065, mid, z),
        new THREE.BoxGeometry(w, 0.13, 0.14).translate(0, WIN[2] + 0.065, z), new THREE.BoxGeometry(w, 0.13, 0.14).translate(0, WIN[3] - 0.065, z),
        ...[-0.22, 0.22].map((u) => new THREE.BoxGeometry(0.06, h, 0.08).translate(u, mid, z)),
        ...[1, 2, 3].map((j) => new THREE.BoxGeometry(w, 0.06, 0.08).translate(0, WIN[2] + (h * j) / 4, z)),
      ]) GB.wood.add(set(onFace(g, k, RB)));
    }
    for (const k of [1, 4]) paper(new THREE.PlaneGeometry(1.5, 1.5, 3, 3).translate(0, SUN, 0), k);
    // the roof, and the jewel on it
    const roof = { R: 5.5, y0: 23.35, T: 0.72, H: 2.35, lift: 0.4, top: 1.15, seat: 2.95 };
    hexRoof({ ...roof, nu: light ? 5 : 10, nv: light ? 4 : 8 }).forEach(stone);
    roofCorners(roof, 0.32, 0.2, 0.2).forEach(stone);
    const yT = roof.y0 + roof.T + roof.H, b = yT + 0.95;
    stone(lathe([[0, yT - 0.35], [1.32, yT - 0.35], [1.38, yT + 0.05], [1.25, yT + 0.4], [0.95, yT + 0.55], [0, yT + 0.55]], round));
    stone(petalLathe([[0.55, yT + 0.5, 0], [0.8, yT + 0.72, 0.35], [1.02, yT + 1.0, 0.8], [1.05, yT + 1.12, 1]], 8, 0.25));
    stone(lathe([[0, b], [0.42, b], [0.72, b + 0.22], [0.9, b + 0.55], [0.88, b + 0.88], [0.72, b + 1.2], [0.48, b + 1.5], [0.26, b + 1.78], [0.1, b + 2.0], [0, b + 2.15]], round));
    if (lit) {
      waterLamps.push({ p: [p[0], 21, p[1]], color: '#ffcd86', k: 1.1 });
      lawnLamps.push({ p, y: 21, ...LAWN.toro });
      halo(p, 21.2, 18, '#ffc070', 0.14, lampHaloTex);
      // the light it lays on the ground, out of its windows
      const pool = decal(p, 100, 76, '#ffb462', 0.3 * POOL_DIAL, 5.3, 0.14);
      pool.material.map = lanternPoolTex;
      pool.rotation.y = yaw + HEX / 2 - Math.PI / 2;
    }
  };
  // (the road to the Heart leaves the Fork where the first stood, and the way
  // along the shore passes where the second did: each stepped back onto the
  // lawn beside its way, still facing what it lit)
  toro(FORK_OLD ? [1206, 252] : [1201, 262], true, J);
  toro(FORK_OLD ? [1262, 222] : [1264, 234], true, SHORE);
  toro([1342, 262], true, [1311, 266]);
  toro([1290, 292], true, [1311, 266]);
  toro([1098, 140], false, J);
  toro([1030, 60], false, J);

  // Hedges either side of the way out, close enough to be seen through the
  // breach: "beyond the jamb, hedges breathe under a green moon".
  {
    const along = unit2(GATE, J), across = [along[1], -along[0]];
    for (const side of [-1, 1]) {
      const a = add(add(GATE, along, 20), across, side * 21);
      const b = add(add(GATE, along, 108), across, side * 21);
      plantHedge([stripLoop(a, b, 9)], { ground: 4, H: 17, seed: side < 0 ? 21 : 22 });
    }
  }

  yield 'The Fork';
  // VI — the Fork: where the road divides, a stone waymark with a board for each
  // way (with `paintings`, a painted screen facing the pergola).
  if (!paintings) {
    // The waymark stands dead centre of the Fork's view and was the palest
    // thing in the garden: a bare post with two boards. It carries the lantern
    // now — a fork in a path at night is somewhere someone hung a light.
    //
    // And it said nothing: a plain square pillar under a pyramid, with two
    // blank boards. Now a post that tapers, a moulded cap and a knob on its
    // roof; and boards shaped to point, with the ways cut into them and
    // gilded — THE PAVILION, and under it THE HEART, which is beyond it — and
    // one board newer and paler than the rest, pointing down the road not
    // taken, with nothing written on it. (Since the road not taken goes to the
    // Heart, THE HEART points down it, toward the maze's mouth, and there is no
    // third way to leave blank: ?wfork=old for the three boards.)
    //
    // (2026-10-09, forkFix.js 3: that pillar was the biggest and palest thing
    // in the Fork's frame, dead ahead, and its boards were blank from both
    // sides — the names faced into the wood. A slim post of weathered timber
    // now, standing back in the lawn between the ways, the names facing out.)
    const slim = !forkOld(3);
    const at = slim ? add(J, dir(WAYMARK.bearing), WAYMARK.dist) : add(J, dir(279), 30);
    standing.push({ p: at, r: slim ? 2.6 : 4 });
    if (slim) {
      const { r0, r1, top } = WAYMARK.post, turn = (WAYMARK.bearing + 45) * deg;
      // a dressed footing, mostly in the ground, and the post in it
      GB.stone.add(placed(new THREE.CylinderGeometry(1.75, 2.05, 1.6, 8), at, 4.3, turn));
      GB.forkPost.add(placed(new THREE.CylinderGeometry(r1, r0, top - 4, 4).rotateY(Math.PI / 4), at, (top + 4) / 2, turn));
      // a board cap and a low hipped top
      GB.forkPost.add(placed(new THREE.BoxGeometry(r1 * 2.3, 0.32, r1 * 2.3), at, top + 0.16, turn));
      GB.forkPost.add(placed(new THREE.ConeGeometry(r1 * 1.7, 1.1, 4), at, top + 0.32 + 0.55, turn + Math.PI / 4));
    } else {
      GB.stone.add(placed(new THREE.BoxGeometry(5.6, 3.2, 5.6), at, 4, 12 * deg));
      GB.stone.add(placed(new THREE.BoxGeometry(4.6, 1.6, 4.6), at, 6.4, 12 * deg));
      GB.stone.add(placed(new THREE.CylinderGeometry(2.05, 2.62, 22, 4).rotateY(Math.PI / 4), at, 4 + 11, 12 * deg));
      GB.stone.add(placed(new THREE.BoxGeometry(3.4, 0.5, 3.4), at, 23.9, 12 * deg));
      GB.stone.add(placed(new THREE.BoxGeometry(4.2, 0.55, 4.2), at, 24.45, 12 * deg));
      GB.stone.add(placed(new THREE.BoxGeometry(4.8, 1.2, 4.8), at, 25.3, 12 * deg));
      GB.stone.add(placed(new THREE.ConeGeometry(3.3, 3.0, 4), at, 27.4, 57 * deg));
      GB.stone.add(placed(new THREE.SphereGeometry(0.75, 12, 8), at, 29.2));
    }
    const nameTex = (text) => tex(paint(1024, 160, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = '600 104px Georgia, "Times New Roman", serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.letterSpacing = '14px';
      // cut into the wood (see giltLetters): a dark bed under each stroke, the
      // gold lighter along its top
      g.fillStyle = 'rgba(18,10,5,0.9)';
      g.fillText(text, w / 2 + 3, h / 2 + 4);
      const gold = g.createLinearGradient(0, h * 0.2, 0, h * 0.8);
      gold.addColorStop(0, '#f0d08a');
      gold.addColorStop(0.55, '#c9a05a');
      gold.addColorStop(1, '#8a6632');
      g.fillStyle = gold;
      g.fillText(text, w / 2, h / 2);
    }));
    const boards = FORK_OLD
      ? [[[1216, 218], 20.5, 'THE PAVILION', 1], [[1216, 218], 17.9, 'THE HEART', 0.84], [[1120, 160], 16.5, null, 1]]
      // (the Pavilion's from the slim post: at the bridge's foot — [1216, 218]
      // is the way's bend, behind it from there)
      : [[slim ? SHORE : [1216, 218], slim ? WAYMARK.boards[0] : 20.5, 'THE PAVILION', 1], [MAZE_ENTRY, slim ? WAYMARK.boards[1] : 17.9, 'THE HEART', 0.84]];
    // (out from the post's face: the slim post is a third as wide)
    const b0 = slim ? 0.45 : 1.6;
    boards.forEach(([to, y, name, len]) => {
      const a = Math.atan2(to[1] - at[1], to[0] - at[0]) / deg, L = (slim ? 8.8 : 10.2) * len;
      const board = [[b0, y - 1.1], [b0 + L, y - 1.1], [b0 + 1.3 + L, y], [b0 + L, y + 1.1], [b0, y + 1.1]];
      (name ? GB.wood : GB.newWood).add(profileGeo(board, 0.55, at, a));
      if (!name) return;
      const mat = keep(new THREE.MeshStandardMaterial({
        map: nameTex(name), transparent: true, alphaTest: 0.25, roughness: 0.42, metalness: 0.55,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }));
      const t = dir(a), n = [-t[1], t[0]];
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(keep(new THREE.PlaneGeometry(L * 0.86, 1.55)), mat);
        const q = add(add(at, t, b0 + L / 2), n, side * 0.3);
        plate.position.set(q[0], y, q[1]);
        // (each plate faces OUT of its side of the board: turned the other way,
        // as they were till forkFix.js 3, both faced into the wood and neither
        // side of a board showed its name)
        plate.rotation.y = (side > 0) === slim ? -a * deg : -a * deg + Math.PI;
        plate.name = 'waymark-name';
        root.add(plate);
      }
    });
    // An iron bracket off the post, braced, and hung from it a tsuri-dōrō: a
    // six-sided iron lantern, a lattice round paper, under a roof of its own.
    // It was two gilt discs with a glowing egg between them.
    const arm = dir(slim ? WAYMARK.arm : 196), a0 = slim ? 0.5 : 1.6;
    GB.iron.add(boxGeo(add(at, arm, a0), add(at, arm, a0 + 6.4), 0.5, 0.5, 24.4));
    {
      const a = add(at, arm, a0 + 0.3), b = add(at, arm, a0 + 3.8);
      GB.iron.add(rodGeo([a[0], 20.6, a[1]], [b[0], 24.5, b[1]], 0.16));
    }
    {
      const lp = add(at, arm, a0 + 6), flame = new THREE.Vector3(lp[0], 20.6, lp[1]);
      const yaw = Math.atan2(arm[0], arm[1]);
      const iron = (g) => GB.iron.add(g.rotateY(yaw).translate(lp[0], 0, lp[1]));
      iron(new THREE.TorusGeometry(0.32, 0.07, 6, 14).translate(0, 24.1, 0));
      iron(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6).translate(0, 23.45, 0));
      const roof = { R: 1.75, y0: 22.05, T: 0.14, H: 0.8, lift: 0.26, top: 0.2, seat: 1.0 };
      hexRoof({ ...roof, nu: light ? 3 : 6, nv: 4 }).forEach(iron);
      roofCorners(roof, 0.13, 0.055, 0.06).forEach(iron);
      iron(new THREE.SphereGeometry(0.27, 10, 8).translate(0, roof.y0 + roof.T + roof.H + 0.1, 0));
      const RB = 1.1, Y = [19.3, 22.05], h = Y[1] - Y[0], mid = (Y[0] + Y[1]) / 2;
      iron(new THREE.CylinderGeometry(RB + 0.14, RB - 0.05, 0.28, 6).translate(0, Y[0] - 0.1, 0));
      iron(new THREE.CylinderGeometry(RB + 0.1, RB + 0.1, 0.16, 6).translate(0, Y[1] - 0.02, 0));
      iron(new THREE.ConeGeometry(0.22, 0.7, 6).rotateX(Math.PI).translate(0, Y[0] - 0.6, 0));
      for (let k = 0; k < 6; k++) {
        iron(new THREE.CylinderGeometry(0.07, 0.07, h, 5).translate(Math.sin(k * HEX) * RB, mid, Math.cos(k * HEX) * RB));
        for (const g of [
          ...[-0.18, 0.18].map((u) => new THREE.BoxGeometry(0.05, h, 0.05).translate(u, mid, 0.01)),
          ...[1, 2].map((j) => new THREE.BoxGeometry(RB, 0.05, 0.05).translate(0, Y[0] + (h * j) / 3, 0.01)),
        ]) iron(onFace(g, k, RB));
        const sheetG = onFace(new THREE.PlaneGeometry(RB - 0.06, h, 2, 6).translate(0, mid, -0.06), k, RB).rotateY(yaw).translate(lp[0], 0, lp[1]);
        GB.paperLit.add(litPaper(sheetG, flame, RB * Math.cos(HEX / 2) - 0.06, 0.75));
      }
      waterLamps.push({ p: [lp[0], 20.6, lp[1]], color: '#ffc077', k: 1.1 });
      lawnLamps.push({ p: lp, y: 20.6, ...LAWN.waymark });
      halo(lp, 20.6, 16, '#ffbc70', 0.14, lampHaloTex);
      // (900 when it was an egg of light: it blew the post beside it out to white)
      point(lp, 20.4, '#ffb866', 180, 4);
      decal(lp, 62, 62, '#ffb462', 0.11 * POOL_DIAL, 5.3, 0.12);
    }
  } else {
    const at = add(J, dir(279), 30), facing = dir(151);
    const width = 58, height = width / (3376 / 1440);
    const angle = Math.atan2(facing[0], facing[1]);
    const side = dir(151 + 90);
    for (const s of [-1, 1]) GB.wood.add(placed(new THREE.CylinderGeometry(1.6, 1.8, height + 16, 6), add(at, side, s * (width / 2 + 2)), (height + 16) / 2 + 4));
    const panel = new THREE.BoxGeometry(width + 4, height + 4, 2);
    panel.rotateY(angle);
    panel.translate(at[0], 12 + height / 2, at[1]);
    GB.lacquer.add(panel);
    const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
    const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
    const front = add(at, facing, 1.1);
    plane.position.set(front[0], 12 + height / 2, front[1]);
    plane.rotation.y = angle;
    root.add(plane);
    mounts[5] = { center: [front[0], 12 + height / 2, front[1]], normal: facing, width, height, material: mat };
  }

  // pools of stars in the garden: the pond, and two small ones with stone rims
  const teal = [];
  // (the pond's outline, kept for its bank: shore.js, below)
  let pondEdge = null;
  {
    const { c, rx, rz } = POND;
    const edge = Array.from({ length: 110 }, (_, k) => {
      const a = (k / 110) * Math.PI * 2;
      const wob = 1 + Math.sin(a * 3 + 1) * 0.04 + Math.sin(a * 7) * 0.02;
      return [c[0] + Math.cos(a) * rx * wob, c[1] + Math.sin(a) * rz * wob];
    });
    pondEdge = edge;
    const pond = water.surface(new THREE.Mesh(keep(slabGeo(edge, [], 0.3, WATER_Y - 0.3)), keep(water.material(POND))));
    pond.name = 'water';
    pond.receiveShadow = true;
    pond.renderOrder = 2;
    root.add(pond);
    edge.forEach((p, k) => {
      if (k % 2) return;
      rocks.push({ p: [p[0] + rr(-2, 2), 6, p[1] + rr(-2, 2)], rot: rot3(), s: [rr(3.5, 7.5), rr(2.5, 4.5), rr(3.5, 7.5)], color: pick(['#5e5952', '#504c46', '#68635b', '#46423d']), bank: k / 2 });
    });
    const inPond = (p, m = 1) => ((p[0] - c[0]) / (rx * m)) ** 2 + ((p[1] - c[1]) / (rz * m)) ** 2 < 1;
    const nearBridge = (p) => BRIDGE.slice(1).some((b, i) => segDist(p, BRIDGE[i], b) < 13);
    // The pads, flowers and fish used to be drawn here from the world's stream,
    // and the Pavilion, the mist and the maze are laid out from what they left
    // of it. They have a stream of their own now; this spends the world's
    // exactly as they did, so the maze is still the maze it was.
    {
      let pads = 0;
      for (let s = 0; s < 300 && pads < 20; s++) {
        const p = [c[0] + rr(-rx, rx), c[1] + rr(-rz, rz)];
        if (!inPond(p, 0.9) || inPond(p, 0.55) || dist(p, PV) < 48 || nearBridge(p)) continue;
        pads++;
        for (let k = 0; k < 3; k++) rnd();
        if (rnd() < 0.4) for (let k = 0; k < 6; k++) rnd();
      }
      let fish = 0;
      for (let s = 0; s < 300 && fish < 7; s++) {
        const p = [c[0] + rr(-rx, rx), c[1] + rr(-rz, rz)];
        if (!inPond(p, 0.8) || dist(p, PV) < 46 || nearBridge(p)) continue;
        fish++;
        rnd();
      }
    }
    // Lilies grow in colonies off one rhizome — a clump of big leaves with
    // young ones between them, a flower or two among them, a bud coming up —
    // never as an even scatter. A leaf is 17 to 60 cm across (a unit is 9.4 cm)
    // and lies ON the water, just clear of where the koi are drawn (pond.js).
    const lr = makeRng(7331), lrr = (a, b) => a + (b - a) * lr();
    const leaves = [];
    const colony = (at, spread, count, inside, flowers) => {
      let placed = 0;
      for (let s = 0; s < count * 40 && placed < count; s++) {
        const a = lrr(0, Math.PI * 2), d = spread * Math.sqrt(lr());
        const p = [at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d];
        const young = lr() < 0.3;
        const r = young ? lrr(0.9, 1.6) : lrr(1.8, 3.2);
        // crowded, but a leaf never lies across another
        if (!inside(p, r) || leaves.some((q) => dist(p, q.p) < (r + q.r) * 0.92)) continue;
        leaves.push({ p, r });
        const kind = young ? 0 : lr() < 0.22 ? 3 : lr() < 0.45 ? 2 : 1;
        lilies[kind].push({
          p: [p[0], WATER_Y + 0.12 + (placed % 4) * 0.025, p[1]], rot: [0, lrr(0, Math.PI * 2), 0], s: [r, r, r],
          color: ['#ffffff', '#eef2e2', '#e3e9d2', '#f5efdd'][Math.floor(lr() * 4)],
        });
        placed++;
      }
      const scheme = lr() < 0.5 ? 'white' : 'pink';
      for (let k = 0, s = 0; k < flowers && s < 40; s++) {
        const a = lrr(0, Math.PI * 2), d = spread * 0.75 * Math.sqrt(lr());
        const p = [at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d];
        if (!inside(p, 1.6)) continue;
        k++;
        if (lr() < 0.35) {
          const b = lrr(1.0, 1.4);
          blooms[`${scheme}Bud`].push({ p: [p[0], WATER_Y + 0.05, p[1]], rot: [lrr(-0.25, 0.25), lrr(0, Math.PI * 2), lrr(-0.25, 0.25)], s: [b, b, b] });
        } else {
          const b = lrr(1.1, 1.5);
          blooms[scheme].push({ p: [p[0], WATER_Y + 0.26, p[1]], rot: [lrr(-0.07, 0.07), lrr(0, Math.PI * 2), lrr(-0.07, 0.07)], s: [b, b, b], color: ['#ffffff', '#f1ede6'][Math.floor(lr() * 2)] });
        }
      }
    };
    const inOpen = (p, r) => inPond(p, 0.9) && dist(p, PV) > 50 + r && !nearBridge(p) && !onNorthBridge(p);
    const colonies = [];
    for (let s = 0; s < 400 && colonies.length < 8; s++) {
      const at = [c[0] + lrr(-rx, rx), c[1] + lrr(-rz, rz)];
      if (!inPond(at, 0.84) || inPond(at, 0.5) || dist(at, PV) < 58 || nearBridge(at) || onNorthBridge(at, 8) || colonies.some((q) => dist(at, q) < 34)) continue;
      colonies.push(at);
      colony(at, lrr(7, 13), Math.floor(lrr(7, 14)), inOpen, Math.floor(lrr(1, 3.99)));
    }
    // The fish, on loops round the Pavilion and in patches of their own.
    const school = makeKoi({ pond: POND, time: wind, gather: BRIDGE_STAND, clear: (p) => inPond(p, 0.84) && dist(p, PV) > 52 });
    keep(school.geometry);
    keep(school.material);
    root.add(water.surface(school.mesh));
    for (const pool of POOLS) {
      // a small clump in each rimmed pool, off to one side of it
      const side = lrr(0, Math.PI * 2);
      colony([pool.c[0] + Math.cos(side) * pool.r * 0.4, pool.c[1] + Math.sin(side) * pool.r * 0.4], pool.r * 0.4, 5,
        (p, r) => dist(p, pool.c) < pool.r - r - 1.5, 1);
    }
    for (const pool of POOLS) {
      GB.stone.add(slabGeo(circlePts(pool.c, pool.r + 5, 40), [circlePts(pool.c, pool.r, 40)], 9, 0));
      // In the same surface as the pond, to the unit: one plane, one mirror.
      const w = water.surface(new THREE.Mesh(keep(slabGeo(circlePts(pool.c, pool.r, 40), [], 0.3, WATER_Y - 0.3)), keep(water.material({ c: pool.c, rx: pool.r, rz: pool.r }))));
      w.name = 'water';
      w.renderOrder = 2;
      root.add(w);
      teal.push(pool);
    }

    // ── VII — the Pavilion ────────────────────────────────────────────────
    // An octagon standing in the water. All of it is laid out from two numbers
    // — the angle of a bay and a radius — so the parts agree with each other
    // instead of each being placed by hand: the hips of both roofs run down the
    // column lines, the bracket sets stand over the columns and over the middle
    // of every bay, the rafters land on the purlins they cross, and the gap in
    // the balustrade is the bay the bridge actually arrives at.
    const DECK = 12, HEAD = 46, R_COL = 26;
    // (pavilionProps.js, 13: gilt on every column, under every lantern and on
    // the table's lamp, with the finial, was a casino's. The small fittings
    // are bronze; the one bright gold thing here is the finial.)
    const FITTING = pavPropsOld(13) ? GB.gold : GB.pavBronze;
    const RAIL_WORN = !pavPropsOld(10);
    const bay = (k) => 22.5 + k * 45;
    const on = (a, r) => add(PV, dir(a), r);
    // A piece in a bay's own frame: +x runs out from the middle of the
    // pavilion, +z along the eave, and `out` is measured from the column line.
    // (rotateY carries +x to (cos, −sin), so the angle it wants is the negative
    // of the one everything else here is written in.)
    const inBay = (a, out, along, y, w, h, d) => placed(
      new THREE.BoxGeometry(w, h, d), add(on(a, R_COL + out), dir(a + 90), along), y, -a * deg,
    );
    // Both tiers of roof are lathes turned from one curve — flat at the eave,
    // lifting to the ridge — and `soffit` IS that curve. Everything that has to
    // fit under the roof asks it where the roof is rather than guessing, which
    // is how the old rafters came to hang five units below it in open air.
    // (forkProps.js, 2: that curve was a dome's — level at the top, steepest
    // at the eave — and the roof it made was a conservatory's. The roof is
    // tiled now, pavilionRoof.js, on a hollow curve with its corners swept
    // up, and `soffit` asks that roof where it is: `a`, the bearing, because
    // a facet between two hips is lower at its middle than a lathe's ring.)
    const ROOF_OLD = propsOld(2);
    const TIERS = ROOF_OLD ? [{ r: 52, h: 17, y: 44 }, { r: 29, h: 15, y: 58 }]
      : ROOF_TIERS.map((t) => ({ ...t, h: roofProfile(t, 0) - t.y }));
    const soffit = (t, r, a = 22.5) => (ROOF_OLD ? t.y + t.h * (1 - Math.min(1, Math.max(0, r) / t.r) ** 2.4) : roofTop(t, a, Math.max(0, r)));
    // and the way OUT of that surface at radius r, for laying a ridge along it
    const outward = (t, r) => {
      const y0 = soffit(t, r - 0.4), y1 = soffit(t, r + 0.4);
      const L = Math.hypot(0.8, y1 - y0) || 1;
      return [(y0 - y1) / L, 0.8 / L];
    };

    // ── The deck ──────────────────────────────────────────────────────────
    // A stone foot standing in the water, boards over it, and a moulded lip
    // between the two: a slab with one straight edge reads as a table top.
    GB.stone.add(placed(new THREE.CylinderGeometry(33.4, 35.2, 7.2, 8), PV, 5.4, 22.5 * deg));
    GB.wood.add(placed(new THREE.CylinderGeometry(31, 33, 6, 8), PV, 9, 22.5 * deg));
    GB.lacquer.add(placed(new THREE.CylinderGeometry(33.4, 32.1, 1.4, 8), PV, 11.4, 22.5 * deg));

    // ── Columns, balustrade, and the seat along it ────────────────────────
    // The bay the bridge lands in is left open — worked out from where the
    // bridge actually ends rather than written down, because it was written
    // down once and it was the wrong bay.
    const arrivalOf = (BR) => {
      const end = BR[BR.length - 1];
      return Math.floor((((Math.atan2(end[1] - PV[1], end[0] - PV[0]) / deg) + 337.5 + 360) % 360) / 45);
    };
    // Both bridges need an open bay, whichever paths leave the Fork.
    const arrivals = [arrivalOf(BRIDGE), ...(NORTH_OPEN ? [arrivalOf(NORTH_BRIDGE)] : [])];
    for (let k = 0; k < 8; k++) {
      const a0 = bay(k), a1 = bay(k + 1), p = on(a0, R_COL);
      // a stone plinth, a shaft tapered the way a timber one is, a gilt collar
      GB.stone.add(placed(new THREE.CylinderGeometry(2.9, 3.5, 2.6, 8), p, DECK + 1.3));
      GB.lacquer.add(placed(new THREE.CylinderGeometry(1.45, 1.9, HEAD - DECK - 2.6, 12), p, (DECK + 2.6 + HEAD) / 2));
      if (pavPropsOld(13)) GB.gold.add(placed(new THREE.CylinderGeometry(1.8, 1.8, 0.45, 12), p, HEAD - 4.4));
      else {
        // (a dark gilt band between two beads, closer on the shaft)
        GB.pavGilt.add(placed(new THREE.CylinderGeometry(1.66, 1.68, 0.5, 16), p, HEAD - 4.4));
        for (const dy of [0.33, -0.33]) GB.pavGilt.add(placed(new THREE.CylinderGeometry(1.74, 1.74, 0.14, 16), p, HEAD - 4.4 + dy));
      }

      if (arrivals.includes(k)) continue;
      const c0 = on(a0, 30), c1 = on(a1, 30);
      if (RAIL_WORN) {
        // (pavilionProps.js, 10: the same members, worn)
        const span = dist(c0, c1);
        GB.railWorn.add(wornBar(c0, c1, DECK + 0.5, 1.1, 2.1, { rub: 0.3, joints: Array.from({ length: 9 }, (_, i) => (span * i) / 8) }));
        GB.railWorn.add(wornBar(c0, c1, 16.4, 1.5, 3.2, { rub: 1, ease: 0.34, joints: [0, span] }));
        for (let i = 1; i < 8; i++) GB.railWorn.add(wornPost(lerp2(c0, c1, i / 8), 13.5, 0.75, 3.0, -a0 * deg));
      } else {
        GB.lacquer.add(boxGeo(c0, c1, 1.1, 2.1, DECK + 0.5));                 // bottom rail
        GB.lacquer.add(boxGeo(c0, c1, 1.5, 3.2, 16.4));                       // handrail
        for (let i = 1; i < 8; i++) {                                         // balusters
          GB.lacquer.add(placed(new THREE.BoxGeometry(0.75, 3.0, 0.75), lerp2(c0, c1, i / 8), 15.0, -a0 * deg));
        }
      }
      // the seat that makes a pavilion somewhere to sit and not only to pass
      // through — a board inside the rail, on stubby brackets, stopping short
      // of the columns the way a bench between two posts has to
      const b0 = on(a0, 28.5), b1 = on(a1, 28.5);
      const s0 = lerp2(b0, b1, 0.13), s1 = lerp2(b0, b1, 0.87);
      GB.wood.add(boxGeo(s0, s1, 0.9, 5.4, 15.2));
      for (const t of [0.15, 0.5, 0.85]) {
        GB.wood.add(placed(new THREE.BoxGeometry(2.2, 2.6, 1.1), lerp2(s0, s1, t), 13.9, -((a0 + a1) / 2) * deg));
      }
    }
    // a low threshold board where each bridge comes aboard
    for (const arrival of arrivals) {
      // Same board, in a separate collision class: it is the next tread of
      // the landing, rather than a plank obstacle the leading foot refuses.
      (paintings ? GB.plank : GB.pavilionThreshold).add(placed(new THREE.BoxGeometry(4, 1.2, 15), on(bay(arrival) + 22.5, 29.5), 12.4, -(bay(arrival) + 22.5) * deg));
    }

    // ── The head of each bay: architrave, tie beam, openwork ──────────────
    for (let k = 0; k < 8; k++) {
      const a0 = bay(k), a1 = bay(k + 1), mid = (a0 + a1) / 2;
      const c0 = on(a0, R_COL), c1 = on(a1, R_COL);
      GB.lacquer.add(boxGeo(c0, c1, 3.0, 2.3, HEAD - 3.0));                 // the beam the brackets stand on
      GB.wood.add(boxGeo(c0, c1, 1.5, 1.9, HEAD - 9.2));                    // the tie under it
      // and hanging between the two, the openwork a pavilion of this kind
      // always carries: a comb of turned bars, a rail across them, and a brace
      // into each column, so that the top of a bay is not a rectangle of air.
      for (let i = 1; i < 9; i++) {
        GB.wood.add(placed(new THREE.BoxGeometry(0.6, 4.6, 0.6), lerp2(c0, c1, i / 9), HEAD - 5.5, -mid * deg));
      }
      GB.wood.add(boxGeo(c0, c1, 0.55, 0.55, HEAD - 5.2));
      for (const [from, to] of [[0.02, 0.16], [0.98, 0.84]]) {
        const f = lerp2(c0, c1, from), t = lerp2(c0, c1, to);
        GB.wood.add(rodGeo([f[0], HEAD - 3.6, f[1]], [t[0], HEAD - 7.6, t[1]], 0.6));
      }
    }

    // ── The bracket sets ──────────────────────────────────────────────────
    // Dougong: the stepped timber clusters that carry an eave out well past the
    // columns holding it up, and the one detail that says a roof of this kind
    // was built rather than draped over the top. Two tiers of crossed arms on
    // bearing blocks, over every column AND over the middle of every bay — and
    // each tier steps out only as far as the soffit above still has room for.
    const dougong = (a) => {
      GB.wood.add(inBay(a, 0, 0, HEAD + 0.9, 4.4, 1.8, 4.4));
      let y = HEAD + 1.8;
      // Sixteen clusters round a 26-unit circle leaves about ten units of arc
      // each at the first tier and thirteen at the second; arms longer than
      // that run into the neighbouring cluster and the whole band reads as
      // spilled bricks rather than as joinery.
      for (const [span, back, reach] of [[10.5, 3.0, 4.5], [15.0, 2.0, 8.0]]) {
        GB.wood.add(inBay(a, (reach - back) / 2, 0, y + 0.8, reach + back, 1.6, 2.2));
        GB.wood.add(inBay(a, reach - 3.0, 0, y + 0.8, 2.2, 1.6, span));
        for (const [out, along] of [[reach - 3.0, span / 2 - 1.5], [reach - 3.0, 1.5 - span / 2], [reach - 1.3, 0], [1.3 - back, 0]]) {
          GB.wood.add(inBay(a, out, along, y + 2.15, 2.3, 1.1, 2.3));
        }
        y += 2.7;
      }
      // the gilt eye on the front of the cluster, which is all a bracket ever
      // shows of itself from across the water
      GB.gold.add(inBay(a, 8.3, 0, HEAD + 5.3, 0.9, 1.7, 2.8));
    };
    // Over the columns only. With a cluster over the middle of every bay too,
    // seen from below on the bridge the sixteen ran into one another and the
    // band under the eave was a heap of loose blocks; eight, one to a column,
    // repeat, and repetition is what makes joinery read as made. (With the
    // room that leaves, each tier's arms reach further along the eave.)
    // (2026-10-09, pavilionFix.js 2: from the bridge those two tiers of plain
    // boxes, the rafters and a second purlin running through them, and a gilt
    // cube on the front of each, read as stacked lumber. One set to a column
    // now, block and arm in a stepped cross, its arms along the beams.)
    const PAV_BRACKETS = !pavOld(2);
    if (PAV_BRACKETS) {
      // (pavilionProps.js, 3: the arms eased and painted)
      const set = bracketSet({ paint: pavPropsOld(3) ? null : CAIHUA });
      // carried from the column's frame (+x out, +z along) onto column k
      const carry = (g, a) => { const p = on(a, R_COL); return g.clone().rotateY(-a * deg).translate(p[0], HEAD, p[1]); };
      for (let k = 0; k < 8; k++) {
        for (const g of set.arms) GB.wood.add(carry(g, bay(k)));
        for (const g of set.blocks) GB.lacquer.add(carry(g, bay(k)));
        for (const g of set.caps) GB.pavBronze.add(carry(g, bay(k)));
        for (const g of set.chalk) GB.pavChalk.add(carry(g, bay(k)));
        for (const g of set.green) GB.pavGreen.add(carry(g, bay(k)));
      }
      [...set.arms, ...set.blocks, ...set.caps, ...set.chalk, ...set.green].forEach((g) => g.dispose());
    } else for (let k = 0; k < 8; k++) dougong(bay(k));
    // the purlin the brackets were put there to hold, and the beam behind them
    // (each on the top blocks of the sets now, where they had floated a little
    // over them and the purlin sat inside the ring of rafter purlins below)
    for (let k = 0; k < 8; k++) {
      const out = PAV_BRACKETS ? R_COL + BRACKET.purlinOut : 33;
      GB.wood.add(boxGeo(on(bay(k), out), on(bay(k + 1), out), 1.7, 2.0, HEAD + (PAV_BRACKETS ? BRACKET.purlinY : 6.6)));
      GB.lacquer.add(boxGeo(on(bay(k), R_COL), on(bay(k + 1), R_COL), 1.5, 1.8, HEAD + (PAV_BRACKETS ? BRACKET.beamY : 5.6)));
    }

    // ── The ceiling and the eave ──────────────────────────────────────────
    // Rafters laid ON the soffit curve rather than chorded under it — sixteen
    // the whole way from the eave to the boss, and sixteen more that carry only
    // the eave, because an eave is where a roof of this kind is most closely
    // ribbed and the eave is the half of it a reader standing under it sees.
    for (let k = 0; k < 32; k++) {
      const a = 22.5 + k * 11.25, full = k % 2 === 0;
      let last = null;
      for (const r of full ? [50, 43, 36, 29, 21, 13, 6, 0] : [50, 44, 38, 33]) {
        const p = on(a, r), here = [p[0], soffit(TIERS[0], r, a) - 1.4, p[1]];
        if (last) GB.wood.add(rodGeo(last, here, full ? 0.85 : 0.6));
        last = here;
      }
    }
    // (the outer of the two rings sat at the eave purlin's own radius, just
    // under it and crossing it at every bay: two purlins in one place)
    for (const r of pavOld(2) ? [33, 21] : [21]) {
      for (let k = 0; k < 16; k++) {
        GB.wood.add(boxGeo(on(22.5 + k * 22.5, r), on(45 + k * 22.5, r), 1.4, 1.6, soffit(TIERS[0], r) - 3.5));
      }
    }
    {
      const apex = soffit(TIERS[0], 0);
      GB.lacquer.add(placed(new THREE.CylinderGeometry(5.2, 3.2, 1.6, 16), PV, apex - 1.4));
      if (pavPropsOld(3)) {
        GB.gold.add(placed(new THREE.CylinderGeometry(2.6, 1.3, 1.3, 16), PV, apex - 2.8));
        GB.gold.add(placed(new THREE.SphereGeometry(1.1, 10, 8), PV, apex - 4.0));
      } else if (ROOF_OLD) {
        // (pavilionProps.js, 3: a gilt cup and ball hung there, a bell. A
        // stepped boss of the ceiling's own timber, and a bud turned down.
        // Under the tiled roof the rafters' meeting is above the ceiling's
        // board, and the boss is on the board: see the roofs, below.)
        GB.wood.add(placed(new THREE.CylinderGeometry(3.3, 2.5, 0.7, 16), PV, apex - 2.55));
        GB.lacquer.add(placed(lotusBud({ height: 1.5, radius: 0.85 }).rotateX(Math.PI), PV, apex - 2.9));
      }
    }

    // ── The eaves ─────────────────────────────────────────────────────────
    for (let k = 0; k < 8; k++) {
      const a = bay(k), lp = on(a, 52);
      // A paper lantern at the eave: lacquered cap and base round the light —
      // small, and burning low. As big as a head and nearly as bright as the
      // lamp on the table they were eight lamps against its one, and "a single
      // pavilion burns warm" is a building lit from inside.
      FITTING.add(placed(new THREE.CylinderGeometry(0.18, 0.18, 2.6, 6), lp, 45.8));
      if (LAMPS.paper) trialEaves.push({ p: [lp[0], 42.8, lp[1]], s: [1.15, 1.5, 1.15], color: '#ffb070', k: 0.6 });
      else glows.push({ p: [lp[0], 42.8, lp[1]], s: [1.15, 1.5, 1.15], color: '#ff8a3e', k: 0.5 });
      GB.lacquer.add(placed(new THREE.CylinderGeometry(0.75, 1.0, 0.5, 10), lp, 44.5));
      GB.lacquer.add(placed(new THREE.CylinderGeometry(1.0, 0.75, 0.45, 10), lp, 41.2));
      FITTING.add(placed(new THREE.SphereGeometry(0.34, 8, 6), lp, 40.8));
      halo(lp, 42.8, 12, '#ff9a4e', 0.1);
    }

    // ── The roofs ─────────────────────────────────────────────────────────
    // Two tiers turned on a lathe: flat at the eave and lifting at the tip,
    // steepening to the ridge — tiles above, dark rafters beneath. A cone is a
    // hat; the curve is the whole character of the building. (The reversed
    // profile turns the lathe's faces inward: tiles on its back faces, rafters
    // on its front.) Both tiers are spun to the same 22.5°, so their corners
    // fall on the eight column lines and a hip runs the whole way up.
    M.roof.side = THREE.BackSide;
    const underside = Std({ color: '#2b1b12', roughness: 0.9, side: THREE.FrontSide });
    if (!ROOF_OLD) {
      // Tiled (pavilionRoof.js): the slopes with their rolls, tile-ends and
      // hips in one mesh, the soffit and the eave board in another; and
      // between the two tiers, the short wall the upper one stands on.
      const kind = ROOF_KIND, surface = ROOF_SURFACE[kind];
      const roofMat = skyDull(Std({ map: tex(roofTiles(kind), [1, 1]), roughness: surface.roughness, side: THREE.DoubleSide }), surface.sky, surface.direct);
      const roof = tiledRoof({ at: PV, kind, light });
      for (const [geo, material] of [[roof.tiles, roofMat], [roof.under, underside]]) {
        const m = new THREE.Mesh(keep(geo), material);
        m.castShadow = material === roofMat;
        m.receiveShadow = true;
        m.name = 'pavRoof';
        root.add(m);
      }
      const [low, high] = TIERS, wallR = high.r * 0.88;
      // (to the upper tier's soffit at a facet's middle: at its hips that roof is already sweeping up)
      const y0 = soffit(low, wallR) - 0.5, y1 = roofProfile(high, wallR) - 0.3;
      GB.lacquer.add(placed(new THREE.CylinderGeometry(wallR, wallR, y1 - y0, 8, 1, true), PV, (y0 + y1) / 2, 22.5 * deg));
      GB.wood.add(placed(new THREE.CylinderGeometry(wallR + 0.5, wallR + 0.5, 0.7, 8, 1, false), PV, y0 + 0.75, 22.5 * deg));
      // (pavilionProps.js, 3: that board is the ceiling a reader under it
      // looks up at, plain from edge to edge. A boss on its middle — a step
      // of lacquer, a step of timber, and a lotus bud turned down.)
      if (!pavPropsOld(3)) {
        const under = y0 + 0.4;
        GB.lacquer.add(placed(new THREE.CylinderGeometry(4.4, 5.0, 0.5, 16), PV, under - 0.25));
        GB.wood.add(placed(new THREE.CylinderGeometry(2.5, 3.2, 0.6, 16), PV, under - 0.8));
        GB.lacquer.add(placed(lotusBud({ height: 1.5, radius: 0.85 }).rotateX(Math.PI), PV, under - 1.1));
      }
      // (the gold balls, for whoever asks for them back: forkProps.js, 11)
      if (propsOld(11)) for (const p of roof.tips) GB.gold.add(new THREE.SphereGeometry(0.95, 32, 24).translate(p[0], p[1], p[2]));
    } else for (const tier of TIERS) {
      const { r, h, y } = tier;
      const profile = [new THREE.Vector2(r * 1.05, 2.2), new THREE.Vector2(r, 0)];
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        profile.push(new THREE.Vector2(r * (1 - t) + 0.01, h * (1 - (1 - t) ** 2.4)));
      }
      const geo = keep(new THREE.LatheGeometry(profile.reverse(), 8, 22.5 * deg));
      for (const material of [M.roof, underside]) {
        const roof = new THREE.Mesh(geo, material);
        roof.position.set(PV[0], y, PV[1]);
        roof.castShadow = material === M.roof;
        roof.receiveShadow = true;
        root.add(roof);
      }
      // Ridges laid ON that curve: eight hips down the corners and a thinner
      // roll of tile down the middle of each facet between them. A lathe on its
      // own gives a smooth shell, and a smooth shell is a lampshade.
      for (let k = 0; k < 16; k++) {
        const a = 22.5 + k * 22.5, hip = k % 2 === 0, lift = hip ? 1.0 : 0.6;
        let last = null;
        for (let i = 0; i <= 9; i++) {
          const rr0 = Math.min(r - 0.4, r * (1 - (i / 9) ** 1.3) + 0.6);
          const n = outward(tier, rr0), p = on(a, rr0 + n[0] * lift);
          const here = [p[0], soffit(tier, rr0) + n[1] * lift, p[1]];
          if (last) GB.ridge.add(rodGeo(last, here, hip ? 0.95 : 0.5));
          last = here;
        }
        if (!hip) continue;
        // and the flying tip, which at a hundred units is the whole of what
        // makes a roof of this kind read as a roof of this kind. It has to
        // CURVE, and it has to be short: laid out straight and long the eight
        // of them read as spears stuck through the building.
        let foot = null;
        for (const [ro, dy, rad] of [[1.05, 0.2, 1.0], [1.075, 1.4, 0.85], [1.09, 3.2, 0.6]]) {
          const q = on(a, r * ro), here = [q[0], y + 2.2 + dy, q[1]];
          if (foot) GB.ridge.add(rodGeo(foot, here, rad));
          foot = here;
        }
        GB.gold.add(placed(new THREE.SphereGeometry(0.95, 8, 6), on(a, r * 1.09), y + 6.0));
      }
      // the fascia along the eave: the course that closes the ends of the tiles
      // and, at night, the only line of the roof a lantern actually lights
      for (let k = 0; k < 8; k++) {
        GB.ridge.add(boxGeo(on(bay(k), r * 1.05), on(bay(k + 1), r * 1.05), 1.7, 1.3, y + 0.6));
      }
    }

    // ── The finial ────────────────────────────────────────────────────────
    // Not a ball. A lotus seat, three rings, the gourd and a spike: the one
    // piece of the building that is there only to be looked at.
    {
      const top = TIERS[1].y + TIERS[1].h;
      GB.lacquer.add(placed(new THREE.CylinderGeometry(3.0, 5.4, 2.6, 8), PV, top + 0.4));
      for (let i = 0; i < 3; i++) GB.gold.add(placed(new THREE.CylinderGeometry(2.5 - i * 0.35, 2.7 - i * 0.35, 0.7, 12), PV, top + 2.4 + i * 1.1));
      GB.gold.add(placed(new THREE.SphereGeometry(2.5, 12, 10), PV, top + 7.2));
      GB.gold.add(placed(new THREE.SphereGeometry(1.5, 12, 10), PV, top + 10.2));
      GB.gold.add(placed(new THREE.CylinderGeometry(0.16, 0.7, 4.4, 8), PV, top + 13.0));
    }

    point(PV, DECK + 12.2, '#ffb266', 5200, 7);
    // and NO pool of light on the ground. Every other lamp in the world lays
    // one — light scattered back off stone or gravel — but the ground under
    // this one is the pond, and water does not scatter light back, it reflects
    // it. A 210-by-190 additive quad of warm haze at y 6.9 is the whole reason
    // the pond read as a lawn: it lay over the water edge to edge, above it and
    // brighter than anything in it, and no amount of work on the surface
    // underneath could be seen through it. What a lamp does to this water is
    // the broken column it lays down towards the eye, and that is the water's
    // own business now (water.js).
    if (!paintings) {
      // ── The lamp at the heart of it ─────────────────────────────────────
      // "Where the lamp keeps every future." A low table on four legs with an
      // apron between them, and a standing lantern on it: a base, four corner
      // posts, a cap, and the light held inside a frame rather than loose in
      // the air the way it was.
      const TT = DECK + 6.6;
      for (let i = 0; i < 4; i++) {
        const q = add(PV, dir(45 + i * 90), 4.6);
        GB.wood.add(placed(new THREE.CylinderGeometry(0.75, 0.95, 6.6, 8), q, DECK + 3.3));
      }
      for (let i = 0; i < 4; i++) {
        GB.wood.add(boxGeo(add(PV, dir(45 + i * 90), 4.6), add(PV, dir(135 + i * 90), 4.6), 1.2, 0.7, TT - 2.4));
      }
      GB.wood.add(placed(new THREE.CylinderGeometry(8.0, 7.4, 1.3, 16), PV, TT + 0.65));
      // The table's shade. A lamp stood on a table lights the room above it;
      // the floor round the table is in the table's own shadow, out to about
      // 8 × 12.2 / 4.3 ≈ 23 (its top's radius, by the lamp's height over the
      // floor and over the top). The lamps cast no shadows here, so the
      // brightest thing on the deck was the floor directly UNDER the table, a
      // cream disc round its foot (2026-10-05). Laid as a shade, not drawn as a
      // shadow: a flat core and a penumbra as wide as the lantern is, and not
      // black, because the deck and the columns light it back a little.
      const shadeTex = tex(paint(128, 128, (g) => {
        const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.35, 'rgba(255,255,255,0.92)');
        grd.addColorStop(0.72, 'rgba(255,255,255,0.32)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 128, 128);
      }), [1, 1], false);
      const tableShade = new THREE.Mesh(flatPlane(), keep(new THREE.MeshBasicMaterial({
        map: shadeTex, color: '#000000', transparent: true, opacity: 0.72, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2,
      })));
      tableShade.scale.set(50, 1, 50);
      tableShade.position.set(PV[0], DECK + 0.05, PV[1]);
      tableShade.renderOrder = 1;
      root.add(tableShade);
      GB.lacquer.add(placed(new THREE.CylinderGeometry(3.4, 4.0, 1.0, 8), PV, TT + 1.8, 22.5 * deg));
      for (let i = 0; i < 4; i++) {
        GB.lacquer.add(placed(new THREE.BoxGeometry(0.45, 7.2, 0.45), add(PV, dir(45 + i * 90), 2.4), TT + 5.9));
      }
      GB.lacquer.add(placed(new THREE.CylinderGeometry(4.4, 3.2, 0.9, 8), PV, TT + 9.9, 22.5 * deg));
      FITTING.add(placed(new THREE.SphereGeometry(0.8, pavPropsOld(13) ? 8 : 16, pavPropsOld(13) ? 6 : 12), PV, TT + 10.9));
      if (LAMPS.table) {
        // lit panels of silk in the frame, a lattice over them, and no glow
        // egg — the posts stand dark against the light (lampPass.js)
        const panels = [];
        for (let i = 0; i < 4; i++) {
          panels.push(new THREE.PlaneGeometry(0.818, 1.986).translate(0, -0.007, 0.471).rotateY((i * Math.PI) / 2));
        }
        const lit = new THREE.Mesh(keep(mergeGeometries(panels)), M.lpPanel);
        panels.forEach((g) => g.dispose());
        lit.position.set(PV[0], TT + 5.9, PV[1]);
        lit.scale.setScalar(3.6);
        lit.name = 'pavilion-table-panels';
        root.add(lit);
      } else glows.push({ p: [PV[0], TT + 5.6, PV[1]], s: [2.0, 2.7, 2.0], color: '#ffd08a', k: 1.15 });
      halo(PV, TT + 5.6, 26, '#ffbe70', 0.3);
      // and its light laid on the black water under the pavilion (water.js)
      waterLamps.push({ p: [PV[0], TT + 5.6, PV[1]], color: '#ffc884', k: 1.2 });
      // "Its music seems to arrive from all your lives at once" — and nothing
      // in it could make a sound. (Nor can the world: it has none. The copy
      // speaks of the qin waiting instead, since pavilionFix.js 6.) A guqin on the table beside the lamp, on the
      // side the bridge comes from: a long zither in black lacquer, seven silk
      // strings, the thirteen studs of mother-of-pearl along its near edge; on
      // the boards before it, the cushion someone sits on to play it.
      // (pavilionProps.js, 4: from the stand that was a board with a pale
      // stripe. A qin's outline and arched top, its strings and studs where
      // a qin's are, the head out over the table's edge with its pegs and
      // tassels, and a cloth under its tail let down over the rim.)
      if (!pavPropsOld(4)) {
        const toBridge = 127, a = (toBridge - 90) * deg;
        // `OUT` from the table's middle to the qin's line (clear of the lamp's
        // foot), `SHIFT` along that line toward its head: the tail on the
        // table, and the head past its rim by a hand's width at the least
        const OUT = 5.3, SHIFT = 1.66, top = TT + 1.3;
        const mid = add(PV, dir(toBridge), OUT);
        const carry = (g, dx = 0) => g.translate(dx, 0, 0).rotateY(-a).translate(mid[0], top, mid[1]);
        const q = qin();
        for (const g of q.body) GB.blackLacquer.add(carry(g, SHIFT));
        for (const g of [...q.strings, ...q.pearl]) GB.silk.add(carry(g, SHIFT));
        for (const g of q.fittings) GB.wood.add(carry(g, SHIFT));
        for (const g of q.tassels) GB.cushion.add(carry(g, SHIFT));
        const cloth = qinCloth({ centre: [0, -OUT], rim: 8.06, x0: SHIFT - q.L / 2 + 0.3, x1: SHIFT - q.L / 2 + 3.7 });
        for (const g of cloth.cloth) GB.brocade.add(carry(g));
        for (const g of cloth.trim) GB.pavGilt.add(carry(g));
        const seat = add(PV, dir(toBridge), 12.5);
        GB.cushion.add(new THREE.CylinderGeometry(2.6, 2.8, 1.0, 20).scale(1, 1, 0.82).rotateY(-a).translate(seat[0], DECK + 0.5, seat[1]));
      } else {
        const toBridge = 127, a = (toBridge - 90) * deg, along = dir(toBridge - 90);
        const mid = add(PV, dir(toBridge), 5.7), top = TT + 1.3;
        const body = [
          new THREE.BoxGeometry(11, 0.5, 1.9).translate(0, 0.25, 0),
          new THREE.BoxGeometry(1.4, 0.35, 1.55).translate(-5.9, 0.2, 0),
          new THREE.CylinderGeometry(0.95, 0.95, 0.5, 14, 1, false, 0, Math.PI).rotateY(-Math.PI / 2).translate(5.5, 0.25, 0),
        ];
        GB.blackLacquer.add(mergeGeometries(body).rotateY(-a).translate(mid[0], top, mid[1]));
        body.forEach((g) => g.dispose());
        for (let k = 0; k < 7; k++) {
          const z = -0.66 + k * 0.22, p0 = add(add(mid, along, -5.4), dir(toBridge), z), p1 = add(add(mid, along, 5.2), dir(toBridge), z * 0.8);
          GB.silk.add(rodGeo([p0[0], top + 0.56, p0[1]], [p1[0], top + 0.6, p1[1]], 0.035));
        }
        for (let k = 0; k < 13; k++) {
          const q = add(add(mid, along, -4.2 + k * 0.7), dir(toBridge), 0.78);
          GB.silk.add(new THREE.SphereGeometry(0.09, 6, 4).translate(q[0], top + 0.52, q[1]));
        }
        const seat = add(PV, dir(toBridge), 12.5);
        GB.cushion.add(new THREE.CylinderGeometry(2.6, 2.8, 1.0, 20).scale(1, 1, 0.82).rotateY(-a).translate(seat[0], DECK + 0.5, seat[1]));
      }
    } else {
      const facing = dir(126.5), width = 40, height = width / (3376 / 1440);
      const at = add(PV, facing, -6), angle = Math.atan2(facing[0], facing[1]);
      const panel = new THREE.BoxGeometry(width + 3, height + 3, 1.6);
      panel.rotateY(angle);
      panel.translate(at[0], 14 + height / 2, at[1]);
      GB.lacquer.add(panel);
      const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
      const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
      const front = add(at, facing, 0.9);
      plane.position.set(front[0], 14 + height / 2, front[1]);
      plane.rotation.y = angle;
      root.add(plane);
      mounts[6] = { center: [front[0], 14 + height / 2, front[1]], normal: facing, width, height, material: mat };
    }
    // ── The bridge ────────────────────────────────────────────────────────
    // Boards laid across bearers, with continuous rails following the
    // original zigzag outline. Navigation follows bends within this deck.
    const bridgeOut = (BR) => {
      const arrival = arrivalOf(BR);
      const HW = PAVILION_BRIDGE_HALF_WIDTH;
      const RW = HW - 0.9;             // the rails' line, just in from its edge
      const TOP = 8.6;                 // the boards, where the walk stands (DECK, below)
      const runs = BR.slice(1).map((b, i) => {
        const a = BR[i], t = unit2(a, b);
        return { a, L: dist(a, b), t, n: [-t[1], t[0]] };
      });
      // The far end is cut along the face of the bay it arrives at — the last
      // run meets that face 20° off square — instead of stopping square across it.
      const face = dir(bay(arrival) + 22.5);
      const reach = (p) => (p[0] - PV[0]) * face[0] + (p[1] - PV[1]) * face[1];
      // the walk's line offset by d (either side), from `back` behind the shore
      // to `cut` out from the middle of the pavilion, mitred at every turn
      const edge = (d, back = 3, cut = 31) => {
        const last = runs[runs.length - 1];
        const pts = [add(add(runs[0].a, runs[0].n, d), runs[0].t, -back)];
        for (let i = 1; i < runs.length; i++) {
          const n0 = runs[i - 1].n, n1 = runs[i].n;
          pts.push(add(runs[i].a, [n0[0] + n1[0], n0[1] + n1[1]], d / (1 + n0[0] * n1[0] + n0[1] * n1[1])));
        }
        const q = add(BR[BR.length - 1], last.n, d);
        pts.push(add(q, last.t, (cut - reach(q)) / (last.t[0] * face[0] + last.t[1] * face[1])));
        return pts;
      };
      // a member laid along a line of points, each piece lengthened at a turn
      // by just enough to close the outside of the mitre
      // (`worn`, pavilionProps.js 10: a rail's member in worn lacquer, deeper
      // where each post — and, `balusters`, each baluster — meets it)
      const along = (pts, h, t, y0, batch, worn = null) => {
        const u = pts.slice(1).map((p, i) => unit2(pts[i], p));
        const over = (i) => {
          if (i <= 0 || i >= u.length) return 0;
          const c = Math.max(-0.99, u[i - 1][0] * u[i][0] + u[i - 1][1] * u[i][1]);
          return (t / 2) * Math.sqrt((1 - c) / (1 + c));
        };
        u.forEach((v, i) => {
          const from = add(pts[i], v, -over(i)), to = add(pts[i + 1], v, over(i + 1));
          if (!worn) { batch.add(boxGeo(from, to, h, t, y0)); return; }
          const L = dist(pts[i], pts[i + 1]), bays = Math.max(1, Math.round(L / 8)), n = bays * (worn.balusters ? 3 : 1);
          GB.railWorn.add(wornBar(from, to, y0, h, t, { ...worn, joints: Array.from({ length: n + 1 }, (_, j) => over(i) + (L * j) / n) }));
        });
      };
      // a convex outline cut down to where f(p) >= 0
      const keepWhere = (poly, f) => {
        const out = [];
        poly.forEach((p, i) => {
          const q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
          if (fp >= 0) out.push(p);
          if ((fp >= 0) !== (fq >= 0)) out.push(lerp2(p, q, fp / (fp - fq)));
        });
        return out;
      };
      const area = (poly) => Math.abs(poly.reduce((s, p, i) => {
        const q = poly[(i + 1) % poly.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0)) / 2;

      const L = edge(HW), R = edge(-HW);
      // What the boards lie on: a bed under the whole outline, an edge beam
      // under the board ends, and bearers across — one under the middle of each
      // run and one along each mitre — whose ends show under the edge.
      GB.wood.add(slabGeo([...edge(HW - 0.4), ...edge(-(HW - 0.4)).reverse()], [], 1.0, TOP - 1.6));
      for (const s of [1, -1]) along(edge(s * (HW - 0.6)), 1.3, 1.2, TOP - 1.9, GB.wood);
      runs.forEach((r, i) => {
        const m = add(r.a, r.t, r.L / 2);
        GB.wood.add(boxGeo(add(m, r.n, -(HW + 0.7)), add(m, r.n, HW + 0.7), 0.9, 1.2, TOP - 1.8));
        if (i > 0) GB.wood.add(boxGeo(add(L[i], unit2(R[i], L[i]), 0.7), add(R[i], unit2(L[i], R[i]), 0.7), 0.9, 1.2, TOP - 1.8));
      });
      // The boards, each run's cut along the mitres where it meets the next.
      // The grain runs along a board (u, see walnut in textures.js), and each
      // is cut from a different stretch of the timber.
      runs.forEach((r, i) => {
        const quad = [L[i], L[i + 1], R[i + 1], R[i]];
        const u = (p) => (p[0] - r.a[0]) * r.t[0] + (p[1] - r.a[1]) * r.t[1];
        const hi = Math.max(...quad.map(u));
        for (let k = 0, u0 = Math.min(...quad.map(u)); u0 < hi; k++, u0 += 2.2) {
          const board = keepWhere(keepWhere(quad, (p) => u(p) - u0), (p) => u0 + 2.04 - u(p));
          if (board.length < 3 || area(board) < 0.5) continue;
          const g = slabGeo(board, [], 0.6, TOP - 0.6);
          const pos = g.attributes.position, uv = g.attributes.uv, shift = ((i * 13 + k) * 5.37) % 16;
          for (let v = 0; v < pos.count; v++) {
            const x = pos.getX(v), z = pos.getZ(v);
            uv.setXY(v, x * r.n[0] + z * r.n[1] + shift * 3.1, x * r.t[0] + z * r.t[1] + shift);
          }
          GB.deck.add(g);
        }
      });
      // Onto it from the gravel, 3.4 below the boards, by a stone step on a
      // stone abutment; and off it onto the pavilion, 3.5 above, by another.
      {
        const r = runs[0];
        const quad = (w, u0, u1) => [[w, u0], [w, u1], [-w, u1], [-w, u0]].map(([d, u]) => add(add(r.a, r.n, d), r.t, u));
        const steps = paintings ? GB.stone : GB.pavilionStep;
        if (SHORE_OLD) {
          steps.add(slabGeo(quad(HW + 0.6, -4.2, 2.5), [], 2.5, TOP - 4.4));
          steps.add(slabGeo(quad(RW - 0.6, -7.2, -3.6), [], 2.2, TOP - 3.9));
        } else {
          // (shore.js) a pier of coursed granite under the deck's end, on the
          // footprint and to the top of the slab it replaces, and one broad
          // stone to step up from, its top where the old step's was
          const foot = bridgeFoot({
            a: r.a, t: r.t, n: r.n, half: HW + 0.6, pier: [-4.2, 2.5], pierTop: TOP - 1.9,
            step: { u0: -7.2, u1: -3.6, half: RW - 0.6, top: TOP - 1.7 }, floor: 5.2,
            seed: 7331 + Math.round(BR[0][0] + BR[0][1]), light,
          });
          for (const g of foot.blocks) GB.shoreStone.add(g);
          GB.shoreStep.add(foot.step);
        }
        const n = L.length - 1, w = RW - 0.9;
        const band = [...edge(w, 3, 28.8).slice(n - 1), ...edge(-w, 3, 28.8).slice(n - 1).reverse()];
        steps.add(slabGeo(keepWhere(band, (p) => 33.3 - reach(p)), [], 1.75, TOP));
        // At nine units wide the bridge cleared the rocks round the shore; at
        // this width some came up through its boards. Their draws are spent
        // already, so dropping them moves nothing else.
        const line = [add(r.a, r.t, -7.5), ...BR.slice(1)];
        for (let k = rocks.length - 1; k >= 0; k--) {
          const { p: [x, , z], s: [sx, , sz] } = rocks[k], room = HW + Math.max(sx, sz) * 0.75;
          if (line.slice(1).some((b, i) => segDist([x, z], line[i], b) < room)) rocks.splice(k, 1);
        }
      }
      // The rails: a post at every turn and never more than eight apart, and
      // the same members the pavilion's own rail has — posts with capped heads,
      // a handrail over them and a kick rail under, balusters between.
      const post = (q, v) => {
        const ang = -Math.atan2(v[1], v[0]);
        if (RAIL_WORN) GB.railWorn.add(wornPost(q, TOP, 1.4, 4.4, ang));
        else GB.lacquer.add(placed(new THREE.BoxGeometry(1.4, 4.4, 1.4), q, TOP + 2.2, ang));
        // A capped head, not a brass knob: the walk goes along this rail and
        // a gilt ball on every post came past the eye like a row of melons.
        // (And not a squat pyramid either, which was the nearest, heaviest
        // shape in the Pavilion's frame: a small lacquered bud on a collar.)
        FITTING.add(placed(new THREE.CylinderGeometry(0.85, 0.85, 0.22, 8), q, 13.95));
        GB.lacquer.add(placed(new THREE.CylinderGeometry(0.42, 0.62, 0.35, 10), q, 14.25));
        // (and not an egg, which the nearest, out of focus at the frame's
        // foot, made an acorn of: a lotus bud with its petals carved in —
        // pavilionFix.js, 3)
        if (pavOld(3)) GB.lacquer.add(placed(new THREE.SphereGeometry(0.5, 12, 8).scale(1, 1.45, 1), q, 14.95));
        else GB.lacquer.add(placed(bud.clone(), q, 14.38, ang));
      };
      const bud = keep(lotusBud());
      for (const s of [1, -1]) {
        const line = edge(s * RW, 2, 32);
        along(line, 1.0, 1.4, TOP, GB.wood);                               // curb
        along(line, 0.9, 1.5, 10.0, GB.lacquer, RAIL_WORN ? { rub: 0.3, balusters: true } : null);   // kick rail
        along(line, 1.1, 2.0, 13.0, GB.lacquer, RAIL_WORN ? { rub: 1, ease: 0.3 } : null);         // handrail
        const u = line.slice(1).map((p, i) => unit2(line[i], p));
        line.forEach((p, i) => {
          // at a turn the post stands square to the line halfway between the two runs
          post(p, i === 0 ? u[0] : i === u.length ? u[i - 1] : unit2([0, 0], add(u[i - 1], u[i])));
          if (i === u.length) return;
          const bays = Math.max(1, Math.round(dist(p, line[i + 1]) / 8)), ang = -Math.atan2(u[i][1], u[i][0]);
          for (let j = 0; j < bays; j++) {
            const a = lerp2(p, line[i + 1], j / bays), b = lerp2(p, line[i + 1], (j + 1) / bays);
            if (j > 0) post(a, u[i]);
            for (const f of [0.33, 0.67]) {
              if (RAIL_WORN) GB.railWorn.add(wornPost(lerp2(a, b, f), 10.8, 0.6, 2.3, ang));
              else GB.lacquer.add(placed(new THREE.BoxGeometry(0.6, 2.3, 0.6), lerp2(a, b, f), 11.95, ang));
            }
          }
        });
      }
    };
    bridgeOut(BRIDGE);
    if (NORTH_OPEN) bridgeOut(NORTH_BRIDGE);
  }

  yield 'The Web';
  // VIII — the Web of Time: the maze, fireflies, and its painting at the heart.
  {
    const { x0, z0, cols, rows, cw, ch } = MZ;
    GB.mazeFloor.add(slabGeo([[x0 - 6, z0 - 6], [x0 + cols * cw + 6, z0 - 6], [x0 + cols * cw + 6, z0 + rows * ch + 6], [x0 - 6, z0 + rows * ch + 6]], [], 1, 4));
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ n: 1, s: 1, e: 1, w: 1, v: 0 })));
    const stack = [[4, 3]];
    grid[3][4].v = 1;
    while (stack.length) {
      const [cc, r] = stack[stack.length - 1];
      const opts = [];
      if (r > 0 && !grid[r - 1][cc].v) opts.push(['n', cc, r - 1, 's']);
      if (r < rows - 1 && !grid[r + 1][cc].v) opts.push(['s', cc, r + 1, 'n']);
      if (cc < cols - 1 && !grid[r][cc + 1].v) opts.push(['e', cc + 1, r, 'w']);
      if (cc > 0 && !grid[r][cc - 1].v) opts.push(['w', cc - 1, r, 'e']);
      if (!opts.length) { stack.pop(); continue; }
      const [d, nc, nr, opp] = pick(opts);
      grid[r][cc][d] = 0;
      grid[nr][nc][opp] = 0;
      grid[nr][nc].v = 1;
      stack.push([nc, nr]);
    }
    grid[0][4].n = 0;
    grid[2][4].s = 0;
    grid[3][4].n = 0;
    // ── The heart: a court, not a cell ────────────────────────────────────
    // The heart was one cell of the grid, a corridor with a hedge on either
    // hand, and the walk ended in it facing a plinth, the way a dead end does.
    // It is the nine cells round it now, cleared into one court, with a way in
    // on each of its axes: the one the reader comes by, and three for the
    // others (finale.js). Any other way into the court is closed, where the
    // maze can spare it — every cell must still be reachable from the entrance.
    // (Knocked through after the maze is grown, so the world's stream is spent
    // exactly as before.)
    if (!paintings) {
      const side = { n: [0, -1, 's'], s: [0, 1, 'n'], e: [1, 0, 'w'], w: [-1, 0, 'e'] };
      const set = (c, r, d, v) => {
        const [dc, dr, opp] = side[d];
        grid[r][c][d] = v;
        if (grid[r + dr]?.[c + dc]) grid[r + dr][c + dc][opp] = v;
      };
      const { c0, c1, r0, r1 } = COURT;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (c < c1) set(c, r, 'e', 0);
          if (r < r1) set(c, r, 's', 0);
        }
      }
      const mc = (c0 + c1) / 2, mr = (r0 + r1) / 2;
      set(mc, r0, 'n', 0);
      set(mc, r1, 's', 0);
      set(c0, mr, 'w', 0);
      set(c1, mr, 'e', 0);
      const reachable = () => {
        const seen = new Set(['4,0']), queue = [[4, 0]];
        while (queue.length) {
          const [c, r] = queue.shift();
          for (const [d, [dc, dr]] of Object.entries(side)) {
            if (grid[r][c][d] || !grid[r + dr]?.[c + dc] || seen.has(`${c + dc},${r + dr}`)) continue;
            seen.add(`${c + dc},${r + dr}`);
            queue.push([c + dc, r + dr]);
          }
        }
        return seen.size === rows * cols;
      };
      const rim = [];
      for (let c = c0; c <= c1; c++) rim.push([c, r0, 'n'], [c, r1, 's']);
      for (let r = r0; r <= r1; r++) rim.push([c0, r, 'w'], [c1, r, 'e']);
      for (const [c, r, d] of rim) {
        if (grid[r][c][d] || (c === mc && (d === 'n' || d === 's')) || (r === mr && (d === 'w' || d === 'e'))) continue;
        set(c, r, d, 1);
        if (!reachable()) set(c, r, d, 0);
      }
      // and a fifth way out, off the axis, that can be SEEN from the way in:
      // the fourth gate is straight behind the armillary (webFix.js, 3)
      if (!webOld(3)) openGate(grid, COURT, set, reachable);
    }
    // the one way through to the heart, for the walk
    {
      const from = new Map([['4,0', null]]), queue = [[4, 0]];
      while (queue.length) {
        const [cc, r] = queue.shift();
        if (cc === 4 && r === 3) break;
        const next = [];
        if (r > 0 && !grid[r][cc].n) next.push([cc, r - 1]);
        if (r < rows - 1 && !grid[r + 1][cc].n) next.push([cc, r + 1]);
        if (cc > 0 && !grid[r][cc].w) next.push([cc - 1, r]);
        if (cc < cols - 1 && !grid[r][cc + 1].w) next.push([cc + 1, r]);
        for (const n of next) {
          if (from.has(`${n}`)) continue;
          from.set(`${n}`, [cc, r]);
          queue.push(n);
        }
      }
      for (let at = [4, 3]; at; at = from.get(`${at}`)) mazeRoute.unshift([x0 + (at[0] + 0.5) * cw, z0 + (at[1] + 0.5) * ch]);
    }
    // every wall of the grid as the ground it stands on, and one hedge grown
    // over all of it (hedges.js)
    const T = 8.5, footprint = [];
    const wall = (a, b) => footprint.push([
      Math.min(a[0], b[0]) - T / 2, Math.min(a[1], b[1]) - T / 2, Math.max(a[0], b[0]) + T / 2, Math.max(a[1], b[1]) + T / 2,
    ]);
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        const X = x0 + cc * cw, Z = z0 + r * ch, g = grid[r][cc];
        if (g.n) wall([X, Z], [X + cw, Z]);
        if (g.w) wall([X, Z], [X, Z + ch]);
        if (r === rows - 1 && g.s) wall([X, Z + ch], [X + cw, Z + ch]);
        if (cc === cols - 1 && g.e) wall([X + cw, Z], [X + cw, Z + ch]);
      }
    }
    plantHedge(rectUnionLoops(footprint), { ground: 5, H: 20, seed: 11 });
    // its mouth between two clipped finials, and one on each corner (forkProps.js, 6)
    if (!paintings) {
      [[x0 + 4 * cw, z0], [x0 + 5 * cw, z0], [x0, z0], [x0 + cols * cw, z0], [x0, z0 + rows * ch], [x0 + cols * cw, z0 + rows * ch]]
        .forEach((p, i) => finial(p, FINIALS.mouth, 5, 20, 1101 + i));
    }
    mazeGrid = grid;
    mazeRects = footprint;
    // (3800 and a pool of 0.34 until 2026-10-05: the pale paving printed as one
    // even cream stage against black hedges — the middle of it so far up the
    // tone curve that the fall-off toward the kerb was squeezed out of it.
    // Down a third, the light is seen to come FROM the armillary and fade.)
    point(HEART, 28, '#ffc77e', 2600, 5);
    heartParts.wish = lightWishes[lightWishes.length - 1];
    decal(HEART, 160, 160, '#ffbd6c', 0.22 * POOL_DIAL, 5.4, 0.12);
    if (!paintings) {
      // The court's floor: a round of the pale stone laid in the gravel, kerbed,
      // for the plinth to stand in the middle of and the others at the edge of.
      GB.stone.add(slabGeo(circlePts(HEART, 34, 64), [], 0.3, 5));
      GB.stone.add(slabGeo(circlePts(HEART, 35.2, 64), [circlePts(HEART, 33.6, 64)], 0.6, 5));
      // And in it, the garden of forking paths: brass let into the paving,
      // three lines out from the plinth that divide at every ring of stones,
      // and divide again, twenty-four ways to the kerb. It was bright, even
      // paving with nothing drawn on it, under the one place the finale's
      // light floods; now the flood has the paths to run along.
      {
        const RINGS = [6.9, 14, 22, 30, 33.2], SPREAD = [0, 0.3, 0.15, 0.075];
        const pol = (r, a) => add(HEART, [Math.cos(a), Math.sin(a)], r);
        const grow = (a, k) => {
          if (k === 4) return;
          for (const side of k === 0 ? [0] : [-1, 1]) {
            const b = a + side * SPREAD[k];
            const line = wornRibbon([pol(RINGS[k], a), pol(RINGS[k + 1], b)], [0.42, 0.34, 0.28, 0.22][k], 5.33);
            line.deleteAttribute('uv1');   // (to merge with the rest of the gilt)
            GB.gold.add(line);
            grow(b, k + 1);
          }
        };
        for (let j = 0; j < 3; j++) grow(-Math.PI / 2 + (j * 2 * Math.PI) / 3 + 0.35, 0);
        for (const r of RINGS.slice(1, 4)) {
          const g = new THREE.RingGeometry(r - 0.12, r + 0.12, 96).rotateX(-Math.PI / 2).translate(HEART[0], 5.32, HEART[1]);
          g.setAttribute('uv1', g.attributes.uv.clone());
          GB.rakeDark.add(g);
        }
      }
      // An armillary of gold rings turning over a stone plinth — the size of a
      // thing a court is built round now, not of a thing on a desk: the rings
      // were 5 to 6.4 across and read, at the end of the walk, as a toy.
      if (webOld(7)) {
        GB.stone.add(placed(new THREE.CylinderGeometry(6.2, 6.6, 1.4, 20), HEART, 5 + 0.7));
        GB.stone.add(placed(new THREE.CylinderGeometry(3.2, 4.0, 8.6, 16), HEART, 6.4 + 4.3));
        GB.stone.add(placed(new THREE.CylinderGeometry(4.2, 3.4, 1.1, 16), HEART, 15 + 0.55));
        // the drum banded in gilt top and foot, as an instrument's stand is
        GB.gold.add(placed(new THREE.TorusGeometry(3.86, 0.16, 6, 40).rotateX(Math.PI / 2), HEART, 7.8));
        GB.gold.add(placed(new THREE.TorusGeometry(3.32, 0.14, 6, 40).rotateX(Math.PI / 2), HEART, 14.2));
      } else {
        // A carved stand (webFix.js, 7): three plain cylinders under the
        // most richly made thing in the garden read as a drainpipe under a
        // clock. A stepped plinth, a moulded base, a shaft reeded at foot and
        // head, an ovolo capital; and between the reeds, in two rings of gilt
        // capitals, the sentence the map says when the walk is over — its
        // middle turned to the way in.
        const { stone, gold } = pedestalGeometry();
        GB.pedestal.add(stone.translate(HEART[0], 0, HEART[1]));
        for (const g of gold) GB.gold.add(g.translate(HEART[0], 0, HEART[1]));
        const from = mazeRoute.length > 1 ? unit2(HEART, mazeRoute[mazeRoute.length - 2]) : [0, -1];
        for (const L of pedestalLetters(gilt.glyphs, Math.atan2(from[1], from[0]))) {
          const G = gilt.glyphs[L.ch];
          const g = new THREE.PlaneGeometry(gilt.cellW * L.cap, gilt.cellH * L.cap);
          const uv = g.attributes.uv;
          for (let v = 0; v < uv.count; v++) uv.setXY(v, (G.col + uv.getX(v)) / gilt.cols, 1 - (G.row + 1 - uv.getY(v)) / gilt.rows);
          // standing on the shaft, facing out from it
          GB.letters.add(g.rotateY(Math.PI / 2 - L.a).translate(HEART[0] + Math.cos(L.a) * L.r, L.y, HEART[1] + Math.sin(L.a) * L.r));
        }
      }
      // An instrument, not three hoops. Three plain gold rings on a stalk had
      // less to them than a lamp, and they were the last thing the walk shows.
      // Now: the meridian, standing, its rim cut in degrees, with the polar
      // axis through it at the latitude of the place; the equator, ticked in
      // hours; and the ecliptic, a broad band with the twelve signs let into
      // it — dark bronze, and the gilt only in what is cut into it. A seed of
      // light where the axis crosses. (Each ring is still the child it was:
      // the turning in tick and the finale's spin ask for them by place.)
      armillary = new THREE.Group();
      armillary.position.set(HEART[0], 26, HEART[1]);
      const ticks = (r, n, len, deep, every = 0) => {
        const parts = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2, long = every && k % every === 0;
          parts.push(new THREE.BoxGeometry(long ? len * 1.9 : len, 0.12, deep).translate(r + (long ? len * 0.95 : len / 2), 0, 0).rotateZ(a));
        }
        const g = mergeGeometries(parts);
        parts.forEach((x) => x.dispose());
        return keep(g);
      };
      // (webProps.js, 3: the degrees and the hours were those `ticks`, gilt
      // blocks stood out from the rims of round hoops, and the rings read as
      // gears. Flat bands now, the scale let into their faces.)
      const ringed = (group, which, hoop, teeth, opts) => {
        if (webPropsOld(3)) {
          group.add(new THREE.Mesh(keep(hoop()), M.bronze));
          group.add(new THREE.Mesh(teeth(), M.gold));
          return;
        }
        const { band, scale } = graduatedRing(which, (parts) => mergeGeometries(parts), opts);
        group.add(new THREE.Mesh(keep(band), M.bronze));
        group.add(new THREE.Mesh(keep(scale), M.gold));
      };
      const meridian = new THREE.Group();
      ringed(meridian, 'meridian', () => new THREE.TorusGeometry(9.4, 0.46, 10, 120), () => ticks(9.82, 72, 0.42, 0.62, 6));
      {
        const lat = 35 * deg, L = 11.8;
        const axisRod = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.2, 0.2, 2 * L, 10)), M.bronze);
        axisRod.rotation.z = -lat;
        meridian.add(axisRod);
        for (const e of [-1, 1]) {
          const tip = new THREE.Mesh(keep(new THREE.SphereGeometry(0.42, 12, 8)), M.gold);
          tip.position.set(Math.sin(lat) * L * e, Math.cos(lat) * L * e, 0);
          meridian.add(tip);
        }
      }
      armillary.add(meridian);
      const equator = new THREE.Group();
      ringed(equator, 'equator', () => new THREE.TorusGeometry(8.6, 0.32, 8, 110), () => ticks(8.88, 24, 0.36, 0.42), { edge: true });
      equator.rotation.set(Math.PI / 2, 0, 0);
      armillary.add(equator);
      const ecliptic = new THREE.Group();
      {
        const band = new THREE.LatheGeometry([[7.32, -0.85], [7.72, -0.85], [7.72, 0.85], [7.32, 0.85], [7.32, -0.85]].map(([x, y]) => new THREE.Vector2(x, y)), 110);
        ecliptic.add(new THREE.Mesh(keep(band.rotateX(Math.PI / 2)), M.bronze));
        const signs = [];
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          signs.push(new THREE.BoxGeometry(0.1, 0.08, 1.5).translate(7.76, 0, 0).rotateZ(a));
          signs.push(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10).rotateZ(Math.PI / 2).translate(7.77, 0, 0).rotateZ(a + Math.PI / 12));
        }
        const g = mergeGeometries(signs);
        signs.forEach((x) => x.dispose());
        ecliptic.add(new THREE.Mesh(keep(g), M.gold));
      }
      ecliptic.rotation.set(Math.PI / 2, 0, Math.PI / 3);
      armillary.add(ecliptic);
      heartParts.core = new THREE.Mesh(keep(new THREE.SphereGeometry(0.8, 20, 14)), keep(new THREE.MeshBasicMaterial({ color: '#ffcf8a', toneMapped: false })));
      armillary.add(heartParts.core);
      halo(HEART, 26, 34, '#ffd08a', 0.34);
      heartParts.halo = halos[halos.length - 1];
      heartParts.armillary = armillary;
      root.add(armillary);
    } else {
      const facing = [0, 1], width = 30, height = width / (3376 / 1440);
      const at = add(HEART, facing, -6), angle = Math.atan2(facing[0], facing[1]);
      const panel = new THREE.BoxGeometry(width + 3, height + 3, 1.6);
      panel.rotateY(angle);
      panel.translate(at[0], 10 + height / 2, at[1]);
      GB.stone.add(panel);
      const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
      const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
      const front = add(at, facing, 0.9);
      plane.position.set(front[0], 10 + height / 2, front[1]);
      plane.rotation.y = angle;
      root.add(plane);
      mounts[7] = { center: [front[0], 10 + height / 2, front[1]], normal: facing, width, height, material: mat };
    }
    for (let s = 0; s < (light ? 70 : 160); s++) {
      const p = s < 100
        ? [rr(x0 - 12, x0 + cols * cw + 12), rr(z0 - 12, z0 + rows * ch + 12)]
        : [rr(900, 1500), rr(-40, 640)];
      if (s >= 100 && (!inGarden(p) || pathDist(p) > 80)) continue;
      fireflies.push({ p: [p[0], rr(12, 46), p[1]], s: Array(3).fill(rr(0.7, 1.35)), color: pick(['#f4ff9c', '#fff2a4', '#b8ffe6']), k: rr(0.8, 1.4), phase: rr(0, 100) });
    }
    // and more over the maze, from a stream of their own (webFix.js, 5)
    if (!webOld(5)) {
      const fr = makeRng(FLIES.seed), frr = (a, b) => a + (b - a) * fr();
      for (let s = 0; s < (light ? FLIES.extra / 2 : FLIES.extra); s++) {
        moreFlies.push({ p: [frr(x0 - 10, x0 + cols * cw + 10), frr(12, 40), frr(z0 - 10, z0 + rows * ch + 10)], s: Array(3).fill(frr(0.7, 1.35)), color: fr() < 0.5 ? '#f4ff9c' : '#fff2a4', k: frr(0.8, 1.4), phase: frr(0, 100) });
      }
    }
  }

  // ivy over the stone where the honeycomb meets the garden
  for (const cell of cells) {
    if (cell.garden) continue;
    for (let k = 0; k < 6; k++) {
      if (!isGardenAt(cell.i + NB[k][0], cell.j + NB[k][1]) || (cell.k === '4,-4' && k === 5)) continue;
      const e = edgeFrame(cell.c, k);
      const o0 = add(cell.c, dir(60 * k), RC), o1 = add(cell.c, dir(60 * k + 60), RC);
      for (let s = 0; s < 3; s++) {
        const p = add(lerp2(o0, o1, rr(0.1, 0.9)), e.n, rr(-10, 4));
        // (mats laid flat on the coping: from the Web of Time, over the
        // cedars, a row of dark green discs. Drawn, not laid: auditFix.js, 2)
        const mat = { p: [p[0], MASS_H + CAP + 0.6 + s * 0.3, p[1]], rot: [0, -Math.atan2(e.t[1], e.t[0]) + rr(-0.25, 0.25), 0], s: [rr(56, 90), 1, rr(22, 34)] };
        if (auditOld(2)) ivy.push(mat);
      }
    }
  }
  {
    // Mats of it over the first bays of the pergola. (They lay across the old
    // breach at the height of the arch, where they floated in the opening as
    // loose leaves; same draws, laid out beyond the wall.)
    const e = edgeFrame(DOOR, 5);
    for (let s = 0; s < 6; s++) {
      const along = rr(-46, 46), out = rr(-16, 16);
      const p = add(add(GATE, e.t, along * 0.32), e.n, 48 + out * 1.2);
      const y = Math.abs(along) < 30 ? rr(46, 60) : rr(20, 60);
      // (seen from under the pergola, a ceiling of painted green balls; the
      // wisteria's own leaves lie over its rafters now — ivy.js — and the
      // draws are only spent)
      const mat = { p: [p[0], 47 + (y - 20) * 0.04, p[1]], rot: [0, rr(0, 6.28), 0], s: [rr(40, 64) * 0.7, 1, rr(26, 40) * 0.7] };
      if (IVY_OLD) ivy.push(mat);
    }
  }

  hangPainting(4, [DOOR[0], DOOR[1] - A + 2.5], 38, [0, 1], 80);

  yield 'Trees';
  // ── Trees (trees.js) ──────────────────────────────────────────────────────
  // Where they stand is where they always stood — drawn from the world's
  // stream, which this still spends to the draw exactly as it did, so the
  // shrubs, the mist and everything after are where they were. What each tree
  // IS comes from a stream of its own, and from where it stands: willows and
  // black pines on the pond's far bank, leaning out to the water; maples and
  // pines in the middle ground the walk looks across; cherries where the old
  // ones were in blossom; and beyond, broad trees and the tall cedars that
  // make the skyline. A tree never walked near is grown without twigs.
  {
    const blocked = (p, m = 0) => !inGarden(p)
      || pathDist(p) < 24 + m
      || ((p[0] - POND.c[0]) / (POND.rx + 22 + m)) ** 2 + ((p[1] - POND.c[1]) / (POND.rz + 22 + m)) ** 2 < 1
      || (p[0] > MZ.x0 - 16 - m && p[0] < MZ.x0 + MZ.cols * MZ.cw + 16 + m && p[1] > MZ.z0 - 16 - m && p[1] < MZ.z0 + MZ.rows * MZ.ch + 16 + m)
      || segDist(p, PATHS[0].pts[0], J) < 36 + m
      || dist(p, add(J, dir(279), 30)) < 40
      || POOLS.some((pool) => dist(p, pool.c) < pool.r + 24 + m);
    // the line the walk takes through the garden, and how far off it a place is
    const WALK = [
      [GATE, PERGOLA0, J, [1216, 218], SHORE, ...BRIDGE.slice(1), PV],
      [SHORE, [1256, 208], [1290, 216], [1315, 212], [1311, 266], MAZE_ENTRY],
    ];
    const walkDist = (p) => Math.min(...WALK.flatMap((pts) => pts.slice(1).map((b, i) => segDist(p, pts[i], b))));
    const pondGap = (p) => (Math.hypot((p[0] - POND.c[0]) / POND.rx, (p[1] - POND.c[1]) / POND.rz) - 1) * ((POND.rx + POND.rz) / 2);
    const tr = makeRng(5150), trr = (a, b) => a + (b - a) * tr(), tpick = (xs) => xs[Math.floor(tr() * xs.length)];
    // Leaf colours by kind. Greens toward olive — the moon cools them enough —
    // and the maples in their autumn reds, which the lanterns catch.
    const TINT = {
      broad: ['#56683f', '#4d6140', '#5d6c43', '#48593b', '#526542'],
      pine: ['#3e5034', '#445636', '#394a31'],
      maple: ['#a43424', '#b4452a', '#9a2a22', '#b85a2c', '#c07434'],
      mapleTurning: ['#8c7a36', '#9a6a30'],
      cherry: ['#cdaaaa', '#d6b6b2', '#c29ea4', '#d0aea8'],
      willow: ['#6e7a44', '#667240', '#737c46'],
      cedar: ['#3d4b31', '#37452e', '#434f30'],
    };
    const GROUND_T = 3.6;
    const woodChunks = new Map();
    const tone = new THREE.Color(), pickTone = new THREE.Color();
    const placedTrees = [];
    // (for a harness: root.userData.trees)
    const treeList = [];
    root.userData.trees = treeList;
    const TREES = light ? 70 : 150;
    for (let s = 0; s < 22000 && placedTrees.length < TREES; s++) {
      const near = placedTrees.length && rnd() < 0.45 ? pick(placedTrees) : null;
      const p = near
        ? [near[0] + rr(-52, 52), near[1] + rr(-52, 52)]
        : [rr(720, 2080), rr(-980, 760)];
      if (p[0] < 700 || p[0] > 2100 || p[1] < -1000 || p[1] > 780) continue;
      if (blocked(p) || placedTrees.some((o) => dist(o, p) < 21)) continue;
      placedTrees.push(p);
      const v = rnd() < 0.2 ? 3 + Math.floor(rnd() * 2) : Math.floor(rnd() * 3);
      const kind = rnd();
      // spreading | a tall narrow spire | a young one, half the height
      const [size, top, sprays] = kind < 0.58 ? [rr(40, 68), rr(46, 74), 10]
        : kind < 0.84 ? [rr(24, 36), rr(66, 104), 13]
          : [rr(18, 30), rr(22, 38), 6];
      // (what the old trees drew from it after that: a tint, 7 for each of
      // their sprays and 2 for the post they stood on)
      pick(v >= 3 ? BLOSSOM : LEAF);
      for (let k = 0; k < sprays * 7 + 2; k++) rnd();

      const gap = pondGap(p), walk = walkDist(p);
      // (The nearest any tree stands to the water is some sixty units, and to
      // the walk a hundred and forty: the pond and its paths are open lawn,
      // and the trees that matter from the Pavilion are the ring on the far
      // bank, standing behind it in the view.)
      let species;
      const blossom = v >= 3 && tr() < 0.8, roll = tr();
      if (gap < 135) species = gap < 70 ? 'pine' : blossom && roll < 0.3 ? 'cherry' : roll < 0.72 ? 'willow' : 'pine';
      else if (blossom) species = 'cherry';
      else if (walk < 320) species = roll < 0.35 ? 'maple' : roll < 0.62 ? 'pine' : 'broad';
      else if (kind < 0.58) species = 'broad';
      else if (kind < 0.84) species = 'cedar';
      else species = tr() < 0.5 ? 'maple' : 'broad';
      if (ONE_TREE === 'none') continue;
      if (ONE_TREE) species = ONE_TREE;
      const room = Math.max(10, walk - 12);
      const shape = {
        broad: kind < 0.84 ? { H: top, S: size * 0.5 } : { H: top * 1.25, S: size * 0.6 },
        cedar: { H: top * 1.3, S: size * 0.5 },
        pine: { H: Math.min(62, Math.max(38, top * 0.8)), S: 20 },
        maple: { H: trr(26, 40), S: 0 },
        cherry: { H: trr(30, 42), S: 0 },
        willow: { H: trr(54, 72), S: 0 },
      }[species];
      if (species === 'maple') shape.S = Math.min(shape.H * trr(0.6, 0.8), room);
      if (species === 'cherry') shape.S = Math.min(shape.H * trr(0.7, 0.9), room);
      if (species === 'willow') shape.S = shape.H * 0.5;
      // willows and pines by the water lean out over it
      const lean = gap < 135 ? Math.atan2(POND.c[1] - p[1], POND.c[0] - p[0]) + trr(-0.5, 0.5) : null;
      const wood = new Wood(7);
      // (pavilionProps.js, 6: a willow is dressed as a weeping one, from a
      // stream of its own — the trees' stream is spent as it always was)
      const weeping = species === 'willow' && !pavPropsOld(6) ? makeRng(6100 + placedTrees.length * 17) : null;
      const grown = growTree(species, tr, wood, { ...shape, lean, detail: !light && walk < 420, weeping });
      // (one on the road not taken, the way along the shore, the road's old
      // second bridge or the hedge that closes the garden is grown all the
      // same — its own stream spent to the draw — and not stood up)
      const gone = wayDist(p) < 24 || (NORTH_OPEN && onNorthBridge(p, 20)) || boundaryDist(p) < 14;
      if (!gone) treeList.push({ p, species, H: +shape.H.toFixed(1), gap: Math.round(gap), walk: Math.round(walk) });
      const g = wood.geometry().translate(p[0], GROUND_T, p[1]);
      const key = chunkKey(p[0], p[1]);
      if (!woodChunks.has(key)) woodChunks.set(key, []);
      if (gone) g.dispose();
      else woodChunks.get(key).push(g);

      // (forkProps.js, 7: a cherry in flower at night. Its sprays were the
      // palest pink in the garden and lit all round, and from across the
      // water each tree was a puff of the one saturated colour in the frame.
      // Greyer now and deeper; a third of its sprays left off, so the dark
      // limbs show through; and a spray under the crown's middle is in the
      // crown's own shade — the moon is on its top. No draws are spent on
      // any of it: the stream does not move.)
      const night = species === 'cherry' && !propsOld(7);
      const palette = species === 'maple' && tr() < 0.2 ? TINT.mapleTurning : night ? BLOSSOM_NIGHT.tints : TINT[species];
      const base = new THREE.Color(tpick(palette));
      // (A weeping willow has more sprays than the willow it was, and every
      // spray stood up draws its tint from the trees' stream: that stream is
      // spent on the sprays it HAD, to the draw, and the ones it has take
      // theirs from its own. Drawn for the new ones, every tree after the
      // first willow was another tree.)
      for (const sp of grown.was ?? []) {
        const at = [sp.p[0] + p[0], sp.p[1] + GROUND_T, sp.p[2] + p[1]];
        if (walkDist([at[0], at[2]]) < 8 + sp.s[0] * 0.5 && at[1] - sp.s[1] * 0.5 < 30) continue;
        tpick(palette);
      }
      const tintOf = grown.was ? (xs) => xs[Math.floor(weeping() * xs.length)] : tpick;
      for (const [si, sp] of grown.sprays.entries()) {
        const at = [sp.p[0] + p[0], sp.p[1] + GROUND_T, sp.p[2] + p[1]];
        // nothing in the walk's way at head height
        if (walkDist([at[0], at[2]]) < 8 + sp.s[0] * 0.5 && at[1] - sp.s[1] * 0.5 < 30) continue;
        tone.copy(base).lerp(pickTone.set(tintOf(palette)), 0.3);
        if (gone) continue;
        let shade = sp.shade;
        if (night) {
          if (((si * 0.618034 + Math.abs(sp.p[0]) * 0.071) % 1) < BLOSSOM_NIGHT.drop) continue;
          const up = (sp.p[1] - sp.crown[1]) / (sp.crown[3] || 1);
          shade *= BLOSSOM_NIGHT.under + (1 - BLOSSOM_NIGHT.under) * Math.min(1, Math.max(0, (up + 0.25) / 0.8));
        }
        foliage.push({
          p: at, rot: sp.rot, s: sp.s, color: tone.getHex(), k: shade, kind: sp.kind,
          crown: [sp.crown[0] + p[0], sp.crown[1] + GROUND_T, sp.crown[2] + p[1], sp.crown[3]],
        });
      }
      for (const [wi, w] of grown.whips.entries()) {
        // (broad strands, pavilionFix.js 4: each now carries one or two ropes
        // of leaf, which seen at all are seen as a wall of bars — so about
        // half the cards are left off. No draws are spent here: the stream
        // does not move.)
        // (pavilionProps.js, 6: darker to their tips, fewer are left off)
        if (WILLOW_BROAD && ((wi * 0.618034 + w.p[0] * 0.013) % 1) < (weeping ? WILLOW.skip : 0.45)) continue;
        const at = [w.p[0] + p[0], w.p[1] + GROUND_T, w.p[2] + p[1]];
        let len = w.len;
        if (walkDist([at[0], at[2]]) < 8 + w.wide) len = Math.min(len, at[1] - 30);
        if (len < 6 || gone) continue;
        hangs.push({ p: at, rot: [w.tilt?.[0] ?? 0, w.yaw, w.tilt?.[1] ?? 0], s: [w.wide, len, 1], kind: w.kind, color: weeping ? WILLOW.tone : '#d6dac4', k: w.shade });
      }
    }
    // Behind the maze, a belt of cedars (webFix.js, 2). The Library's garden
    // faces stand three paces past the maze's far hedge and ten metres tall,
    // and from the heart they were the top half of the frame: a garden maze
    // in a walled yard. Two and three deep, the back rows taller, their
    // spires are the skyline from the court and the stone is behind them.
    // (Their own stream: nothing above moves.)
    if (!webOld(2) && !paintings) {
      const sr = makeRng(SCREEN.seed), spick = (xs) => xs[Math.floor(sr() * xs.length)];
      const around = (p, r) => Array.from({ length: 8 }, (_, k) => add(p, [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)], r));
      const ok = (p, S) => inGarden(p) && around(p, S * 0.4).every(inGarden)
        && boundaryDist(p) > 8 && wayDist(p) > 24 && pathDist(p) > 24
        && !placedTrees.some((o) => dist(o, p) < 12);
      // (webProps.js, 2: spires, of many heights; where the Library's stone
      // is close behind one, a tall one)
      const walled = webPropsOld(2) ? null : (p) => BELT.beside.some((dx) => !inGarden([p[0] - dx, p[1] + BELT.behind]));
      const belt = screenPlaces(sr, MZ, ok, walled);
      // (and closed, from where it is looked at: wherever the rows left the
      // Library's stone showing between two spires, one more)
      if (!webPropsOld(2)) {
        const hedge = MZ.z0 + MZ.rows * MZ.ch, laneX = MZ.x0 + (WEB_GATE.col + 0.5) * MZ.cw;
        const clear = (p, S) => (p[1] > hedge + 9 || p[0] < MZ.x0 - 9 || p[0] > MZ.x0 + MZ.cols * MZ.cw + 9)
          && !(WEB_GATE.through && p[1] < hedge + 50 && Math.abs(p[0] - laneX) < S * WEB_GATE.lane[0] + WEB_GATE.lane[1]);
        const far = (t) => t.p[1] > hedge + 56;
        closeBelt(belt, sr, ok, clear, GROUND_T).forEach((t) => { if (t.closing) t.far = far(t); });
      }
      for (const t of belt) {
        const wood = new Wood(7);
        const grown = growTree('cedar', sr, wood, { H: t.H, S: t.S, detail: !light && !t.far, skirt: SCREEN.skirt, spire: webPropsOld(2) ? null : SPIRE });
        treeList.push({ p: t.p, species: 'cedar', H: +t.H.toFixed(1), screen: true });
        const g = wood.geometry().translate(t.p[0], GROUND_T, t.p[1]);
        const key = chunkKey(t.p[0], t.p[1]);
        if (!webPropsOld(2)) beltWood.push(g);
        else {
          if (!woodChunks.has(key)) woodChunks.set(key, []);
          woodChunks.get(key).push(g);
        }
        const base = new THREE.Color(spick(TINT.cedar));
        for (const sp of grown.sprays) {
          tone.copy(base).lerp(pickTone.set(spick(TINT.cedar)), 0.3);
          // (a tree beyond the garden's hedge is seen from the court or not
          // at all, and from there the hedges stand across its foot — its
          // lowest whorls, the broadest cards it has, are not stood up. The
          // tint is drawn all the same.)
          if (t.far && !webPropsOld(2) && sp.p[1] < BELT.foot) continue;
          (webPropsOld(2) ? foliage : beltFoliage).push({
            p: [sp.p[0] + t.p[0], sp.p[1] + GROUND_T, sp.p[2] + t.p[1]], rot: sp.rot, s: sp.s, color: tone.getHex(), k: sp.shade * (webPropsOld(2) ? 1 : 1 + (BELT.moon - 1) * (0.35 + 0.65 * Math.min(1, sp.p[1] / t.H))), kind: sp.kind,
            crown: [sp.crown[0] + t.p[0], sp.crown[1] + GROUND_T, sp.crown[2] + t.p[1], sp.crown[3]],
          });
        }
      }
    }
    // The belt stands in a group of its own, because of the map. Its spires
    // are the tallest things in the garden and stand south of the maze, which
    // is where the map is looked at from: at their full height they stood
    // across the maze and the lit court on it. Over the map they are drawn
    // down to `BELT.map` of their height (setVeil), and they stand up as the
    // reader comes down among the walls. And they cast no shadow: the moon is
    // low, the shadows of spires this tall lie three hundred units long
    // across the Library, and the shadow map is drawn once, over the map.
    if (beltWood.length) {
      beltGroup = new THREE.Group();
      beltGroup.name = 'belt';
      root.add(beltGroup);
      const geo = keep(mergeGeometries(beltWood, false));
      beltWood.forEach((g) => g.dispose());
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, M.bark);
      m.receiveShadow = true;
      m.name = 'trees';
      // (after its leaf: nearly all of the wood is behind it, and bark drawn
      // first is lit in full and then drawn over)
      m.renderOrder = 1;
      beltGroup.add(m);
    }
    for (const geos of woodChunks.values()) {
      const geo = keep(mergeGeometries(geos, false));
      geos.forEach((g) => g.dispose());
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, M.bark);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = 'trees';
      root.add(m);
    }
    let shrubs = 0;
    for (let s = 0; s < 6000 && shrubs < (light ? 60 : 140); s++) {
      const p = [rr(720, 2080), rr(-980, 760)];
      if (blocked(p, -14)) continue;
      shrubs++;
      const size = rr(14, 26);
      const tint = pick(LEAF);
      const gone = wayDist(p) < 16 || (NORTH_OPEN && onNorthBridge(p, 12)) || boundaryDist(p) < 12;
      for (let s2 = 0; s2 < 3; s2++) {
        const sprig = { p: [p[0] + rr(-4, 4), rr(7, 12), p[1] + rr(-4, 4)], rot: [0, rr(0, 6.28), 0], s: Array(3).fill(size * rr(0.55, 0.75)), color: tint, k: rr(0.6, 0.85), crown: [p[0], 4, p[1], size * 0.75] };
        if (!gone) foliage.push(sprig);
      }
    }
  }

  yield 'Mist on the grass';
  // ── Mist on the grass ─────────────────────────────────────────────────────
  // What a night garden has that a lit lawn has not: something between the eye
  // and the ground. Sheets of it lie low, thickest over the water and along the
  // pergola, and they drift. They are what puts distance between the near grass,
  // the pavilion and the tree line — without them the whole garden is one flat
  // field of one value, which is exactly how it read.
  const mist = [];
  {
    const near = [POND.c, [1150, 300], [1090, 400], [1240, 200], SHORE, J, [980, 520], [1350, 60],
      [1420, 250], [900, 430], [1180, 120], [1500, 380], [820, 300], [1600, 150]];
    // Faint, and kept well off the places a reader stands: a horizontal sheet
    // that passes through a post in front of you draws a razor-straight line
    // across it. At this strength it is the air between the middle distance and
    // the tree line, which is all it was ever wanted for.
    const mistMat = keep(new THREE.MeshBasicMaterial({
      map: radialTex, color: '#9fc0d8', transparent: true, opacity: 0.055,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    }));
    // And out of the Library. A sheet laid on the lawn beside the Door reached
    // in over the breach, and from inside the gallery its far edge met the
    // walls at eye height: a razor-straight line across both walls of shelves,
    // milky above and clear below. Over any room on the walk the mist thins to
    // nothing — in the shader, so every sheet keeps the size and place the
    // garden was composed with.
    {
      const rooms = cells.filter((cl) => cl.room !== undefined).map((cl) => new THREE.Vector2(cl.c[0], cl.c[1]));
      mistMat.onBeforeCompile = (sh) => {
        sh.uniforms.uRooms = { value: rooms };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
            varying vec2 vMistXZ;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vMistXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
            uniform vec2 uRooms[${rooms.length}];
            varying vec2 vMistXZ;`)
          .replace('#include <map_fragment>', `#include <map_fragment>
            for (int i = 0; i < ${rooms.length}; i++) diffuseColor.a *= smoothstep(${R.toFixed(1)}, ${(RC + 6).toFixed(1)}, distance(vMistXZ, uRooms[i]));`);
      };
      mistMat.customProgramCacheKey = () => 'babel-mist';
    }
    const sheet = keep(flatPlane());
    const stands = [J, BRIDGE_STAND, HEART];
    for (let k = 0, tries = 0; k < (light ? 7 : 17) && tries < 400; tries++) {
      const base = near[tries % near.length];
      const p = [base[0] + rr(-110, 110), base[1] + rr(-90, 90)];
      if (stands.some((q) => dist(p, q) < 150)) continue;
      k++;
      const m = new THREE.Mesh(sheet, mistMat);
      const w = rr(260, 520);
      m.scale.set(w, 1, w * rr(0.6, 1));
      m.position.set(p[0], rr(11, 26), p[1]);
      m.renderOrder = 3;
      root.add(m);
      mist.push({ m, home: [p[0], p[1]], phase: rr(0, 100), speed: rr(0.02, 0.05), reach: rr(14, 34) });
    }
  }

  // The garden's stones half sunk in the ground, the way a set stone sits;
  // and round the pond, set as stones are set — a big one and two smaller
  // beside it, then a gap of low ones — rather than one of a size every few
  // paces. (Same places, same draws: only the size each is given.)
  // (And paler: the near-black greys they were given read as holes at night.)
  const BANK = [1.3, 0.85, 0.6, 0.42, 0.34];
  const granite = new THREE.Color('#aaa293'), stoneTone = new THREE.Color(), paleStone = new THREE.Color('#ece6da');
  // Nothing left lying in the road not taken, the way along the shore or
  // across the hedge's line, nor half inside a post's or a lantern's foot
  // (their draws long spent: taking them up moves nothing else).
  for (let k = rocks.length - 1; k >= 0; k--) {
    const { p: [x, , z], s: [sx, , sz] } = rocks[k];
    const onWay = WAYS.some((way) => lineDist([x, z], way.pts) < way.w / 2 - 0.5);
    const underFoot = !FORK_OLD && rocks[k].bank === undefined && standing.some((st) => dist([x, z], st.p) < st.r + Math.max(sx, sz) * 0.6);
    if (onWay || underFoot || boundaryDist([x, z]) < 8) rocks.splice(k, 1);
  }
  {
    // the hedge closing the garden: one outline round the line, mitred at each turn
    const side = (d) => BOUNDARY.map((q, i) => {
      const n = (k) => { const t = unit2(BOUNDARY[k], BOUNDARY[k + 1]); return [-t[1], t[0]]; };
      if (i === 0) return add(q, n(0), d);
      if (i === BOUNDARY.length - 1) return add(q, n(i - 1), d);
      const n0 = n(i - 1), n1 = n(i);
      return add(q, [n0[0] + n1[0], n0[1] + n1[1]], d / (1 + n0[0] * n1[0] + n0[1] * n1[1]));
    });
    const loop = [...side(5.5), ...side(-5.5).reverse()];
    const area = loop.reduce((a, [x, z], i) => a + (x * loop[(i + 1) % loop.length][1] - loop[(i + 1) % loop.length][0] * z) / 2, 0);
    if (!NO_BOUND) plantHedge([area > 0 ? loop : loop.reverse()], { ground: 4, H: 24, seed: 31, detail: light ? 0.3 : 0.6 });
    // and its finials: one at each turn of it, and one along each long run
    // between (forkProps.js, 6) — never at its two ends, which stand in stone
    if (!NO_BOUND) {
      BOUNDARY.forEach((q, i) => {
        if (i > 0 && i < BOUNDARY.length - 1) finial(q, FINIALS.turn, 4, 24, 3101 + i);
        if (i < BOUNDARY.length - 1 && dist(q, BOUNDARY[i + 1]) > FINIALS.longRun) finial(lerp2(q, BOUNDARY[i + 1], 0.5), FINIALS.run, 4, 24, 3201 + i);
      });
    }
  }
  // The lawn's blades, round each lantern that stands on it (lawn.js;
  // forkProps.js, 10): wherever there is lawn — not a way's gravel, nor the
  // pond's bank, nor under a hedge or a lantern's own foot.
  if (!propsOld(10) && !paintings) {
    const inLoop = (p, loop) => {
      let hit = false;
      for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
        const [xi, zi] = loop[i], [xj, zj] = loop[j];
        if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) hit = !hit;
      }
      return hit;
    };
    const ways = [...PATHS.slice(0, 3), ...WAYS];
    const hedged = hedgeGround.map((loop) => ({
      loop, x0: Math.min(...loop.map((q) => q[0])), x1: Math.max(...loop.map((q) => q[0])), z0: Math.min(...loop.map((q) => q[1])), z1: Math.max(...loop.map((q) => q[1])),
    }));
    const ok = (p) => inGarden(p) && ways.every((o) => lineDist(p, o.pts) > o.w / 2 + 0.4) && offPond(p, LAWN.bank)
      && !standing.some((st) => dist(p, st.p) < st.r + 0.2)
      && !hedged.some((h) => p[0] > h.x0 && p[0] < h.x1 && p[1] > h.z0 && p[1] < h.z1 && inLoop(p, h.loop));
    for (const g of lawnBlades({ lamps: lawnLamps, ok, ground: 4, density: LAWN.density * (light ? 0.5 : 1), height: LAWN.height })) {
      const m = new THREE.Mesh(keep(g), M.lawnBlade);
      m.receiveShadow = true;
      m.name = 'lawnBlades';
      root.add(m);
    }
  }
  if (SHORE_OLD) {
    instances(stoneGeo(), M.gardenStone, rocks.map((r) => {
      const k = r.bank === undefined ? 1 : BANK[r.bank % 5];
      const sc = [r.s[0] * k, r.s[1] * k, r.s[2] * k];
      const color = `#${stoneTone.set(r.color).lerp(granite, 0.55).getHexString()}`;
      return { ...r, color, s: sc, rot: [r.rot[0] * 0.25, r.rot[1], r.rot[2] * 0.25], p: [r.p[0], r.p[1] - sc[1] * 0.3, r.p[2]] };
    }), { cast: false, chunked: true });
  } else {
    // ── The pond's edge (shore.js) ──────────────────────────────────────────
    // A bank the water lies in, its stones set along it, and pebbles; the
    // stones that stood round it before (`bank`) are left out — their draws
    // were spent where they were made, so nothing else moves.
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const HWB = PAVILION_BRIDGE_HALF_WIDTH;
    const bridges = [BRIDGE, ...(NORTH_OPEN ? [NORTH_BRIDGE] : [])];
    const floors = [...PATHS.slice(0, 3), ...WAYS];
    // how far outside the nearest way's gravel (negative: on it)
    const offWay = (p) => Math.min(...floors.map((o) => lineDist(p, o.pts) - o.w / 2));
    const gravelAt = (x, z) => ss(1.2, -1.2, offWay([x, z]));
    const floorAt = (x, z) => 4 + 1.2 * gravelAt(x, z);
    // the way up onto each bridge's step, kept to the gravel (the walk's own
    // line onto the Pavilion's: in from the path, then square up the run)
    const approaches = bridges.map((BR) => {
      const t = unit2(BR[0], BR[1]);
      return BR === BRIDGE ? [[1216, 218], add(BR[0], t, -10), add(BR[0], t, -7.4)] : [add(BR[0], t, -18), add(BR[0], t, -7.4)];
    });
    const approachD = (p) => Math.min(...approaches.map((pts) => lineDist(p, pts)));
    const deckD = (p) => Math.min(...bridges.flatMap((BR) => BR.slice(1).map((b, i) => segDist(p, BR[i], b))));
    // under a deck, the bank no higher than the water; across a way onto a
    // bridge, under the gravel
    const under = (x, z) => {
      const p = [x, z];
      let y = Infinity;
      const dd = deckD(p) - (HWB + 1.2), cd = approachD(p) - 5.5;
      if (dd < 2) y = 6.4 + Math.max(0, dd) * 0.6;
      if (cd < 3) y = Math.min(y, 4.95 + Math.max(0, cd) * 0.75);
      return y;
    };
    const clear = (p, r, across) => offWay(p) > across - 0.8
      && deckD(p) > HWB + r + 0.6
      && approachD(p) > 5.5 + r
      && standing.every((st) => dist(p, st.p) > st.r + r + 0.5);
    // (the pebbled bank coming and going round the pond: forkFix.js, 7; the
    // kerb where a way comes to the water set in groups, 4)
    const shore = pondShore({ edge: pondEdge, waterY: WATER_Y, world: { floorAt, gravelAt, under, clear, near: offWay }, light, bankVary: BANK_VARY, kerbVary: !forkOld(4) });
    for (const g of shore.arcs) GB.bank.add(g);
    for (const g of shore.stones) GB.shoreStone.add(g);
    // the stones that stand guard at each bridge's foot, either side of its
    // step (wherever a way's gravel or a lantern leaves room)
    for (const BR of bridges) {
      const t = unit2(BR[0], BR[1]), n = [-t[1], t[0]];
      const feet = guardStones({
        a: BR[0], t, n, stepHalf: HWB - 1.5, stepU: -5.4, light, seed: 9241 + Math.round(BR[0][0]),
        ground: (p) => Math.max(floorAt(p[0], p[1]), Math.min(shore.bankY(p), 7.2)),
        clear: (p, r, across) => offWay(p) > across - 0.4 && standing.every((st) => dist(p, st.p) > st.r + r + 0.5),
      });
      for (const g of feet) GB.shoreStone.add(g);
    }
    // (and not in the pond's mirror: a few centimetres of stone at the water's
    // edge reflect as nothing at a quarter of the frame, and the mirror would
    // pay for every one of them again)
    rockVariants(4, { seed: 6163, detail: 3, moss: 0.15 }).forEach((geo, v) => {
      const first = instances(geo, M.pebble, shore.pebbles.filter((q) => q.v === v), { cast: false, chunked: true, name: 'pebbles' });
      if (first) root.traverse((o) => { if (o.isInstancedMesh && o.geometry === first.geometry) water.surface(o); });
    });
    // and the garden's other stones, each one of eight stones of the same
    // granite (rockVariants), set level-ish, not tipped on their edges
    const items = rocks.filter((r) => r.bank === undefined).map((r, k) => {
      const sc = r.s, color = `#${stoneTone.set(r.color).lerp(paleStone, 0.9).getHexString()}`;
      return { ...r, v: k % 8, color, rot: [r.rot[0] * 0.08, r.rot[1], r.rot[2] * 0.08], p: [r.p[0], r.p[1] - sc[1] * 0.3, r.p[2]] };
    });
    rockVariants(8, { seed: 6151, detail: light ? 7 : 9 }).forEach((geo, v) => {
      instances(geo, M.shoreRock, items.filter((it) => it.v === v), { cast: false, chunked: true });
    });
  }
  instances(new THREE.SphereGeometry(1, 12, 8), M.glow, glows, { cast: false, receive: false, chunked: true });
  // (the paper lanterns, lampPass.js)
  instances(new THREE.SphereGeometry(1, 40, 28), M.lpPaper, trialPaper, { cast: false, receive: false, chunked: true, name: 'trial-paper' });
  instances(new THREE.SphereGeometry(1, 28, 20), M.lpPaper, trialEaves, { cast: false, receive: false, chunked: true, name: 'trial-eaves' });
  {
    lilyPads.geometries.forEach((geo, k) => instances(geo, M.lily, lilies[k], { cast: false, chunked: true }));
    instances(lilyFlowerGeometry('white', 5), M.flower, blooms.white, { cast: false, chunked: true });
    instances(lilyFlowerGeometry('pink', 6), M.flower, blooms.pink, { cast: false, chunked: true });
    instances(lilyBudGeometry('white', 7), M.flower, blooms.whiteBud, { cast: false, chunked: true });
    instances(lilyBudGeometry('pink', 8), M.flower, blooms.pinkBud, { cast: false, chunked: true });
    instances(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), M.ivy, ivy, { chunked: true });
    // Leaf casts the moon's shadow now (the map is drawn once, at the start,
    // so it costs nothing after): a tree without one stood on the lawn as if
    // pasted there.
    const foliageDepth = keep(makeFoliageDepthMaterial(FOLIAGE_KINDS));
    instances(crossedCards(), M.foliage, foliage, {
      chunked: true,
      depth: foliageDepth,
      prepass: M.foliagePre,
      attrs: { aKind: (it) => it.kind ?? 0, aCrown: (it) => it.crown ?? [it.p[0], it.p[1], it.p[2], 0] },
    });
    if (beltGroup) {
      // (lit by the card's corner, not by the pixel: effects.js)
      const lit = BELT.lit;
      // Nearest the court first. What is left of the belt's cost is its cards
      // lying over one another, five rows deep, and a card drawn behind one
      // already drawn fails the depth test before its texture is read.
      beltFoliage.sort((a, b) => dist([a.p[0], a.p[2]], HEART) - dist([b.p[0], b.p[2]], HEART));
      beltLeaf = lit ? null : keep(makeBackdropFoliage(leaves, wind, FOLIAGE_KINDS, beltLight));
      instances(crossedCards(), lit ? M.foliage : beltLeaf, beltFoliage, {
        chunked: true, cast: false, to: beltGroup,
        prepass: lit ? M.foliagePre : null,
        attrs: { aKind: (it) => it.kind ?? 0, aCrown: (it) => it.crown ?? [it.p[0], it.p[1], it.p[2], 0] },
      });
    }
    for (const [cards, sprigs] of [[crossedCards(), topSprigs], [crossedCards({ flat: false }), faceSprigs]]) {
      instances(cards, M.hedgeLeaf, sprigs, {
        chunked: true,
        depth: foliageDepth,
        prepass: M.hedgeLeafPre,
        attrs: { aKind: (it) => it.kind, aCrown: (it) => it.crown },
      });
    }
    // wisteria and trailing leaves, hung by the top edge (makeHangingMaterial)
    {
      const card = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
      const cards = mergeGeometries([card.clone(), card.clone().rotateY(Math.PI / 2)]);
      card.dispose();
      instances(cards, M.hang, hangs, { cast: false, chunked: true, attrs: { aKind: (it) => it.kind } });
    }
  }
  // Fireflies and dust are points of light drifting on the GPU (effects.js).
  // Dust is not luminous, it is LIT: each mote takes its brightness once, from
  // how near it hangs to a lamp, squared — evenly bright specks read as snow.
  for (const d of dust) {
    let lit = 0;
    for (const w of lightWishes) {
      const f = Math.max(0, 1 - Math.hypot(w.x - d.p[0], w.y - d.p[1], w.z - d.p[2]) / 95);
      lit = Math.max(lit, f * f * Math.min(1, w.intensity / 6000));
    }
    d.k = 0.05 + lit * 1.6;
  }
  // Motes hang in the air; they do not dart about it. A drift of 9 units is
  // most of a metre of wandering, which at speed reads as flies, and the tiny
  // additive points wink in and out as they cross a pixel.
  const sparkles = [
    // A third of them, half the size, mostly low over the hedge tops, of
    // uneven brightness and blinking slowly: big and even, at head height in
    // front of everything, they read as dots on the lens, not as insects.
    // (All still drawn from the stream; only these are shown. No mint ones:
    // the garden takes no teal.)
    // (webFix.js, 5: and still they read as dust — few, large and steady. All
    // of them now, and more over the maze, half the size, each flashing on a
    // beat of its own and dark between.)
    fireflies.length && (webOld(5)
      ? makeSparkles(fireflies.filter((_, i) => i % 3 === 0).map((f, i) => ({
        ...f, p: [f.p[0], 12 + (f.p[1] - 12) * 0.45, f.p[2]], k: (f.k ?? 1) * (0.4 + ((i * 0.618) % 1) * 0.9),
        color: f.color === '#b8ffe6' ? '#eaf7a6' : f.color,
      })), { drift: 5, rise: 0.5, pulse: 0.8, rate: 0.45, sizeOf: (f) => f.s[0] * 1.7 })
      : makeSparkles([...fireflies, ...moreFlies].map((f, i) => ({
        ...f, p: [f.p[0], 12 + (f.p[1] - 12) * 0.45, f.p[2]], k: (f.k ?? 1) * (0.5 + ((i * 0.618) % 1) * 0.8),
        color: f.color === '#b8ffe6' ? '#eaf7a6' : f.color,
      })), { drift: 5, rise: 0.5, rate: 0.45, blink: FLIES.blink, sizeOf: (f) => f.s[0] * 1.7 * FLIES.size })),
    dust.length && makeSparkles(dust, { drift: 3.5, rise: 0.9, rate: 0.22, sizeOf: (d) => d.s[0] * 1.3 }),
  ].filter(Boolean);
  sparkles.forEach((points) => {
    keep(points.geometry);
    keep(points.material);
    root.add(points);
  });

  Object.entries(LB).forEach(([name, b]) => b.flush(name));
  Object.entries(GB).forEach(([name, b]) => b.flush(name));

  // The dark the honeycomb stands in: stars all the way down.
  {
    const shape = new THREE.Shape([[-4500, -4000], [4500, -4000], [4500, 4000], [-4500, 4000]].map(([x, y]) => new THREE.Vector2(x, y)));
    const opening = new THREE.Path();
    opening.absarc(PIT[0] - 720, 300 - PIT[1], 110, 0, Math.PI * 2, true);
    shape.holes.push(opening);
    const backdrop = new THREE.ShapeGeometry(shape, 64);
    const positions = backdrop.attributes.position, uv = backdrop.attributes.uv;
    for (let i = 0; i < positions.count; i++) uv.setXY(i, (positions.getX(i) + 4500) / 9000, (positions.getY(i) + 4000) / 8000);
    const abyss = new THREE.Mesh(keep(backdrop), keep(new THREE.MeshBasicMaterial({
      map: withRepeat(starTex, [18, 16]), color: '#8fb4c8', toneMapped: false,
    })));
    abyss.rotation.x = -Math.PI / 2;
    abyss.position.set(720, -520, 300);
    abyss.name = 'stars';
    root.add(abyss);
  }

  yield 'Light';
  // ── Light ───────────────────────────────────────────────────────────────
  // The ground half of it is the bounce: warm light coming back UP off a stone
  // floor the lamps are standing on. Left near-black, every surface a lamp did
  // not reach went to nothing — a third of some rooms and three-quarters of the
  // map sat below 0.06, where the plates it answers to hold 2-8%.
  const hemi = new THREE.HemisphereLight('#7f97a6', '#4a3728', 0.32);
  root.add(hemi);
  const moon = new THREE.DirectionalLight('#c8dcea', light ? 0.8 : 0.95);
  moon.position.set(720 - 700, 1600, 450 - 900);
  moon.target.position.set(720, 0, 450);
  moon.castShadow = !light;
  moon.shadow.mapSize.set(light ? 1024 : 4096, light ? 1024 : 4096);
  Object.assign(moon.shadow.camera, { left: -1500, right: 1500, top: 1500, bottom: -1500, near: 10, far: 6000 });
  moon.shadow.bias = -0.0003;
  moon.shadow.normalBias = 0.5;
  root.add(moon, moon.target);
  // A pool of real lights, handed to the lamps that matter from where the camera
  // is: over the map, the walk's own lamps by priority; down among the walls,
  // the nearest — so every lamp a reader walks under lights the stone round it,
  // and the frame pays for a handful of lights, never for all of them (a point
  // light is a per-fragment cost across the whole screen). A light changes lamp
  // only once it has faded out, so nothing pops.
  // (lampPass.js) the floor's pools summed into its map, and the lit globes
  // nearest the walk handed to the glass to glint with
  if (LAMPS.pool) bakeFloorPools();
  // ?wpoolshadow=1: and shadowed, once the world is up (World.jsx steps it)
  const poolShadows = POOL_SHADOW ? makePoolShadowBake({ root, exclude: [M.floor, M.floorBand], floorY: 6.05 }) : null;
  if (LAMPS.glint) {
    const mid = [520, 640];
    [...globes].sort((a, b) => Math.hypot(a.p[0] - mid[0], a.p[2] - mid[1]) - Math.hypot(b.p[0] - mid[0], b.p[2] - mid[1]))
      .slice(0, GLINT_N).forEach((g, i) => glintLights.value[i].set(g.p[0], g.p[1], g.p[2], g.s[0]));
  }
  const POOL = lightPoolSize();
  const byPriority = [...lightWishes].sort((a, b) => b.priority - a.priority);
  // ?wlampshadow=1: the first two of them cast shadows — the rails, the
  // balusters, the readers and the stairs laid across the lamplight on the
  // stone. A lamp never moves, so its shadow would be drawn ONCE, when it is
  // handed to a light, and kept (World.jsx renders shadows only when asked;
  // see takeShadowRequest). Off unless asked for: two shadowed point lights
  // put a cube-map lookup for each into every lit material, and on the AMD
  // integrated GPU this piece is made on, ANGLE's shader compiler never came
  // back from the programs that made — the frame stopped dead (2026-09-27).
  const LAMP_SHADOWS = !light && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wlampshadow') === '1';
  let shadowRequest = false;
  const lightPool = Array.from({ length: POOL }, (_, i) => {
    const l = new THREE.PointLight('#ffffff', 0, 0, 2);
    if (LAMP_SHADOWS && i < 2) {
      l.castShadow = true;
      l.shadow.mapSize.set(512, 512);
      l.shadow.camera.near = 2;
      l.shadow.camera.far = 240;
      l.shadow.bias = -0.004;
      l.shadow.normalBias = 0.25;
      l.shadow.autoUpdate = false;
    }
    root.add(l);
    return { light: l, wish: null, level: 0 };
  });
  const takeShadowRequest = () => { const r = shadowRequest; shadowRequest = false; return r; };
  // How many of the pool may be lit at once. A point light is per-fragment work
  // across the whole screen, so on a machine that cannot hold the frame this is
  // one of the few things that buys time WITHOUT costing resolution — which is
  // the trade that matters here (see Governor.jsx). Hiding a light rather than
  // dimming it is the point: three.js compiles the light count into the
  // program, so an unlit light still costs, and an invisible one does not.
  let budget = POOL;
  const setLightBudget = (n) => {
    budget = Math.max(1, Math.min(POOL, n));
    return budget;
  };
  const near2 = (w, p) => (w.x - p.x) ** 2 + (w.y - p.y) ** 2 + (w.z - p.z) ** 2;
  // `far`: where the eye stands that a doorway opening somewhere else
  // (doorway.js) is drawing the far room from, while the reader is walking up
  // to it. The lamps are then the far eye's, so the room in the doorway is lit
  // as it will be when the reader is moved there, and nothing comes on as
  // they step through. The reader's own hallway keeps its light, because the
  // far hallway's lamp has a twin in it (`twins`) and stands there for the
  // reader's own view (`placeLights`). (The room behind them goes without
  // until they turn back.)
  const twins = new Map();
  let twinning = false;
  const placeLights = (twinned) => {
    for (const s of lightPool) {
      if (!s.wish) continue;
      const w = (twinned && twins.get(s.wish)) || s.wish;
      s.light.position.set(w.x, w.y, w.z);
    }
  };
  const updateLights = (eye, dt, far = null) => {
    if (far) eye = far;
    // (the light at the bottom of the Vertigo is 450 down: never among the
    // nearest, and the whole of the well's colour)
    const owns = (w) => (w.column && (w.column[0] - eye.x) ** 2 + (w.column[1] - eye.z) ** 2 < w.column[2] ** 2 ? 1 : 0);
    // A lamp already lit keeps its place until another is CLEARLY nearer. Sorted
    // on raw distance, two lamps a reader walks between swap back and forth
    // across the tie, and a whole gallery's light flickers with their footsteps.
    // Only the slots inside the budget count for any of this. A slot the
    // governor has switched off still REMEMBERS the lamp it was lighting, and
    // if that memory is allowed to count as "held" then no live slot will ever
    // take that lamp on — it simply goes dark and stays dark. (That is exactly
    // what happened the first time the budget came down mid-walk: the garden
    // lost the light under its armillary and never got it back.) A slot that
    // falls outside the budget fades out like any other and then lets go.
    const live = lightPool.slice(0, budget);
    const lit = new Set(live.filter((s) => s.level > 0.05).map((s) => s.wish));
    const rank = (w) => Math.min(near2(w, eye), far ? near2(w, far) : Infinity) * (lit.has(w) ? 0.55 : 1);
    const wanted = eye
      ? [...lightWishes].sort((a, b) => (owns(b) - owns(a)) || (rank(a) - rank(b))).slice(0, budget)
      : byPriority.slice(0, budget);
    // A lamp and its twin are one light seen from either side of a doorway:
    // a light carrying the one is handed the other at once, where it stands,
    // rather than going out for it to come on again.
    for (const s of live) {
      const w = s.wish && wanted.find((o) => o !== s.wish && (twins.get(o) === s.wish || twins.get(s.wish) === o));
      if (w && !live.some((o) => o.wish === w)) s.wish = w;
    }
    const held = new Set(live.map((s) => s.wish));
    const waiting = wanted.filter((w) => !held.has(w));
    lightPool.forEach((slot, i) => {
      if (i >= budget) {
        // Faded right out before it is taken out of the scene, so the lamp it
        // was carrying dims rather than snapping off — and once it is invisible
        // three.js stops compiling it into the shader, which is the whole point
        // of doing this at all.
        slot.level = Math.max(0, slot.level - dt * 4);
        slot.light.intensity = slot.wish ? slot.wish.intensity * 0.9 * slot.level : 0;
        if (slot.level <= 0.001) { slot.wish = null; slot.light.visible = false; }
        return;
      }
      slot.light.visible = true;
      if (!(slot.wish && wanted.includes(slot.wish)) && slot.level <= 0.001 && waiting.length) {
        slot.wish = waiting.shift();
        slot.light.position.set(slot.wish.x, slot.wish.y, slot.wish.z);
        slot.light.color.set(slot.wish.color);
        slot.light.decay = slot.wish.decay;
        if (slot.light.castShadow) { slot.light.shadow.needsUpdate = true; shadowRequest = true; }
      }
      const on = slot.wish && wanted.includes(slot.wish);
      slot.level = on ? Math.min(1, slot.level + dt * 2.5) : Math.max(0, slot.level - dt * 4);
      slot.light.intensity = slot.wish ? slot.wish.intensity * 0.9 * slot.level : 0;
    });
    twinning = !!far;
    placeLights(twinning);
  };

  yield 'The unexplored';
  // ── The unexplored ────────────────────────────────────────────────────────
  const VEIL = { x0: -900, z0: -1200, w: 3400, h: 2900, scale: 0.28 };
  const veilCanvas = paint(Math.round(VEIL.w * VEIL.scale), Math.round(VEIL.h * VEIL.scale), (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const clear = ([x, z], r, strength = 1) => {
      const X = (x - VEIL.x0) * VEIL.scale, Z = (z - VEIL.z0) * VEIL.scale, RR = r * VEIL.scale;
      const grd = g.createRadialGradient(X, Z, 0, X, Z, RR);
      grd.addColorStop(0, `rgba(0,0,0,${strength})`);
      grd.addColorStop(0.5, `rgba(0,0,0,${strength * 0.75})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(X, Z, RR, 0, Math.PI * 2);
      g.fill();
    };
    routeCenters.forEach((c) => clear(c, 320));
    [[0, 0, 2], [0, 0, 5], [1, -1, 5], [2, -2, 5]].forEach(([i, j, k]) => clear(hallMid(i, j, k), 230));
    cells.filter((c) => c.garden && inFrame(c.c)).forEach((c) => clear(c.c, 300));
  });
  const veilMat = keep(new THREE.MeshBasicMaterial({
    map: keep(new THREE.CanvasTexture(veilCanvas)), transparent: true, opacity: 0.72, depthWrite: false, toneMapped: false,
  }));
  const veil = new THREE.Mesh(flatPlane(), veilMat);
  veil.scale.set(VEIL.w, 1, VEIL.h);
  veil.position.set(VEIL.x0 + VEIL.w / 2, MASS_H + 50, VEIL.z0 + VEIL.h / 2);
  veil.renderOrder = 5;
  root.add(veil);
  const setVeil = (amount) => {
    veilMat.opacity = 0.72 * amount;
    veil.visible = amount > 0.01;
    // (and what is there only over the map: mapFix.js, 7 and 8)
    mapWarm.value = amount;
    // (and the belt of cedars, drawn down out of the map's way: webProps.js, 2)
    if (beltGroup) {
      const t = Math.min(1, Math.max(0, (amount - BELT.sink[0]) / (BELT.sink[1] - BELT.sink[0])));
      beltGroup.scale.y = 1 - (1 - BELT.map) * t * t * (3 - 2 * t);
    }
  };

  // Over the map, the Vertigo has no floor (mapFix.js, 7). Seen from up there
  // the stair's pale treads and carriage, the shelves and their lips at the
  // head of the well, and the ring of floor round its mouth, lit by the lamps
  // hanging in it, turned down the funnel as one beige disc. Inside the pit, below its floor, they darken
  // with depth while the map shows; the books keep their colour, and the
  // light at the bottom warms them as it always did, so what is left to see
  // down there is the glow. (Chained onto whatever the material already does,
  // last, so nothing laid on it later takes its place.)
  const pitFade = (mat) => {
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, renderer) => {
      prev?.call(mat, sh, renderer);
      sh.uniforms.uPitMap = mapWarm;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vPitW;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vPitW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vPitW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uPitMap;
          varying vec3 vPitW;`)
        // (the lamplight it takes, not its own glow: the books' warmth from
        // the light below is emissive, and stays)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          float pitFade = 1.0 - uPitMap
            * mix(${PIT_FADE.floor.toFixed(2)}, ${PIT_FADE.k.toFixed(2)}, smoothstep(${PIT_FADE.from.toFixed(1)}, ${PIT_FADE.to.toFixed(1)}, vPitW.y))
            * step(vPitW.y, 7.5)
            * step(distance(vPitW.xz, vec2(${PIT[0].toFixed(2)}, ${PIT[1].toFixed(2)})), 104.0);
          reflectedLight.directDiffuse *= pitFade;
          reflectedLight.indirectDiffuse *= pitFade;
          reflectedLight.directSpecular *= pitFade;
          reflectedLight.indirectSpecular *= pitFade;`);
    };
    mat.customProgramCacheKey = () => `${prevKey.call(mat)}-pitfade`;
  };
  if (!mapOld(7)) [M.step, M.shelf, M.shelfLip, M.floor, M.inlay, pitCarved].forEach((m) => m && pitFade(m));
  // And the cone of lit air under the lamp hung in the drum, which was most of
  // that disc: looked down along its axis from the map it is a lit round foot
  // on the floor. Over the map it goes, inside the drum only and above the
  // well's own light (the column standing up from the bottom stays).
  if (!mapOld(7)) {
    const sh = shaftMaterial;
    sh.uniforms.uPitMap = mapWarm;
    const vert = sh.vertexShader
      .replace('varying float vOpen;', `varying float vOpen;
      varying vec3 vShaftW;`)
      .replace('gl_Position = projectionMatrix * mv;', `vShaftW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;`);
    const frag = sh.fragmentShader
      .replace('varying float vOpen;', `varying float vOpen;
      uniform float uPitMap;
      varying vec3 vShaftW;`)
      .replace('gl_FragColor = vec4(uColor, uStrength', `float pitOff = 1.0 - ${PIT_FADE.shaft.toFixed(2)} * uPitMap * step(-100.0, vShaftW.y)
          * step(distance(vShaftW.xz, vec2(${PIT[0].toFixed(2)}, ${PIT[1].toFixed(2)})), 104.0);
        gl_FragColor = vec4(uColor, pitOff * uStrength`);
    if (vert === sh.vertexShader || frag === sh.fragmentShader) console.warn('mapFix 7: the shaft shader has changed; the cone in the drum is left lit');
    else Object.assign(sh, { vertexShader: vert, fragmentShader: frag, needsUpdate: true });
  }

  // The readers far off in the galleries (`figure`), all one mesh.
  if (distantReaders.length) {
    const parts = distantReaders.map(({ p, y, ry }, i) => readerGeometry({
      seed: 101 + i * 17, color: ROBES[i % ROBES.length], book: i % 3 === 1, detail: 0.5,
    }).rotateY(ry).translate(p[0], y, p[1]));
    const mesh = new THREE.Mesh(keep(mergeGeometries(parts, false)), readerMaterial(keep).mat);
    parts.forEach((g) => g.dispose());
    mesh.name = 'distant-readers';
    root.add(mesh);
  }

  yield 'What a reader at eye level cannot see';
  // ── What a reader at eye level cannot see ─────────────────────────────────
  // Everything past `reach` from the eye, by bounding sphere. From above,
  // nothing is culled.
  root.updateMatrixWorld(true);
  const cullable = (() => {
    const box = new THREE.Box3(), sphere = new THREE.Sphere();
    return root.children
      .filter((o) => (o.isMesh || o.isSprite) && o !== veil)
      .map((o) => {
        box.setFromObject(o);
        box.getBoundingSphere(sphere);
        return { o, c: sphere.center.clone(), r: sphere.radius };
      });
  })();
  let culling = false;
  // `near`: the eyes a gallery wall's books are drawn as boxes for, within
  // LOD_NEAR of its bounds (the reader's, and the far side of a doorway's);
  // past that, as its painted rows (`lodGroups`). With none, all are painted.
  const LOD_NEAR = 150;
  const cull = (eye, near = [], reach = 1600) => {
    if (!eye) {
      if (culling) cullable.forEach(({ o }) => { o.visible = true; });
      culling = false;
    } else {
      culling = true;
      for (const { o, c, r } of cullable) o.visible = c.distanceTo(eye) - r < reach;
    }
    for (const g of lodGroups) {
      const close = near.some((e) => g.c.distanceTo(e) - g.r < LOD_NEAR), shown = !culling || g.boxes.visible;
      g.boxes.visible = shown && close;
      g.rows.visible = shown && !close;
    }
  };

  yield 'What the camera and the overlay need';
  // ── What the camera and the overlay need ─────────────────────────────────
  const top = MASS_H + CAP;
  const at = (p, y) => [p[0], y, p[1]];
  const fallPts = [];
  for (let s = 0; s <= 24; s++) {
    const t = s / 24, u = 1 - t;
    const ctrl = [(PIT[0] + DOOR[0]) / 2 + 40, 260, (PIT[1] + DOOR[1]) / 2 - 60];
    fallPts.push([
      u * u * PIT[0] + 2 * u * t * ctrl[0] + t * t * DOOR[0],
      u * u * 8 + 2 * u * t * ctrl[1] + t * t * 8,
      u * u * PIT[1] + 2 * u * t * ctrl[2] + t * t * DOOR[1],
    ]);
  }
  const overlay = {
    rooms: [
      hexPts(cellC(0, 0), R).map((p) => at(p, top)),
      hexPts(cellC(1, -1), ECHO_R).map((p) => at(p, top)),
      hexPts(cellC(2, -2), R).map((p) => at(p, top)),
      circlePts(PIT, 101, 36).map((p) => at(p, top)),
      hexPts(DOOR, R).map((p) => at(p, top)),
      [[1085, 255], [1150, 180], [1240, 185], [1255, 275], [1175, 330], [1100, 335]].map((p) => at(p, 30)),
      Array.from({ length: 36 }, (_, k) => at([POND.c[0] + Math.cos((k / 36) * Math.PI * 2) * POND.rx, POND.c[1] + Math.sin((k / 36) * Math.PI * 2) * POND.rz], 8)),
      [[1170, 305], [1430, 305], [1430, 535], [1170, 535]].map((p) => at(p, 22)),
    ],
    walk: [ENTRANCE, cellC(0, 0), hallMid(0, 0, 5), cellC(1, -1), hallMid(1, -1, 5), cellC(2, -2), hallMid(2, -2, 5), PIT].map((p) => at(p, 8)),
    gardenWalk: [DOOR, GATE, J, [1216, 218], SHORE, ...BRIDGE.slice(1), PV].map((p) => at(p, 8)),
    mazeLeg: [[1315, 212], [1311, 266], MAZE_ENTRY, HEART].map((p) => at(p, 8)),
    notTaken: ROAD.pts.map((p) => at(p, 8)),
    fall: fallPts,
    pit: at(PIT, 8),
  };

  yield 'Where a reader stands, and the ways on';
  // ── Where a reader stands, and the ways on ────────────────────────────────
  // Eye height is a reader's (the figures stand 18 tall). The ground is 6 on
  // the Library's floors, 5.2 on the garden's gravel, 8.6 on the bridge, 5 in
  // the maze, and each tread's height on the Echo's stair.
  const EYE = 15, FLOOR = 6, GRAVEL = 5.2, DECK = 8.6, MAZE = 5;
  const C0 = cellC(0, 0), C1 = cellC(1, -1), C2 = cellC(2, -2);
  const ring = (c, a, r) => add(c, dir(a), r);
  // Use the aisle's two boundaries, including the corners of a hexagon.
  // The Echo's round colonnade has a different inner edge from a well rail.
  const vestibuleMiddle = (a) => {
    // The raised bridge (?wbridge=old) projects beyond the well. At its far
    // end the aisle is between that abutment and the books, rather than the
    // well's rail. Level with the floor, the bridge ends at the well.
    if (!BRIDGE_LEVEL && a >= 15 && a <= 45) return hexAislePoint(C0, a, 55 / Math.cos(Math.PI / 6), A - 12);
    return hexAislePoint(C0, a, 50.8, A - 16.8);
  };
  const echoMiddle = (a) => roundAislePoint(C1, a, ECHO_RING + 3, ECHO_A - 12);
  const silenceMiddle = (a) => hexAislePoint(C2, a, 42.8, A - 16.8);
  const vertigoMiddle = (a) => ring(PIT, a, (70.6 + 89) / 2);
  // The folded bookcase occupies the left of the arch. Centre the walk in
  // the remaining opening, then join the pergola's own axis.
  const doorLane = (u) => add(add(DOOR, dir(330), u), dir(60), 4.2);
  const unit = (a, b) => { const L = dist(a, b) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const eye = (p, ground) => [p[0], ground + EYE, p[1]];
  const way = (ground, pts) => pts.map((p) => eye(p, ground));
  // a line that keeps to its corners (the bridge, the maze) instead of cutting them
  // (never further along a side than half of it: the way into the maze ends
  // three units past its last corner, and four along it from that corner was a
  // point BEYOND the end — the walk overshot its stand by a pace and came back,
  // and the eyes, which look along the way, turned right round in one frame)
  const hug = (ground, pts, r = 3) => pts.flatMap((p, i) => (i === 0 || i === pts.length - 1
    ? [eye(p, ground)]
    : [eye(add(p, unit(p, pts[i - 1]), Math.min(r, dist(p, pts[i - 1]) / 2)), ground), eye(p, ground), eye(add(p, unit(p, pts[i + 1]), Math.min(r, dist(p, pts[i + 1]) / 2)), ground)]));
  // Approach the bridge along its first run, using the actual abutment
  // steps. Entering diagonally from the shore crossed the side rail.
  const bridgeAxis = unit(SHORE, BRIDGE[1]);
  const bridgeEntry = [
    eye(add(SHORE, bridgeAxis, -10), GRAVEL),
    eye(add(SHORE, bridgeAxis, -5.4), 6.9),
    eye(add(SHORE, bridgeAxis, -3.6), 6.7),
    eye(SHORE, DECK),
  ];
  const SHORE_WALK_OLD = Q.get('wshoreway') === 'old';
  const pergola = unit(PERGOLA0, J);
  const heartFrom = unit(mazeRoute[mazeRoute.length - 2] ?? MAZE_ENTRY, HEART);
  // `p` turned about `o` by `a` degrees (to the right, seen from above the way the walk faces)
  const turnAbout = (o, p, a) => {
    const v = [p[0] - o[0], p[1] - o[1]], c = Math.cos(a * deg), s = Math.sin(a * deg);
    return [o[0] + v[0] * c - v[1] * s, o[1] + v[0] * s + v[1] * c];
  };
  const onStair = (t, lift = EYE) => { const st = stairAt(t); return [st.p[0], st.tread + lift, st.p[1]]; };
  // standing at the stair's open edge, just short of the drop
  const onEdge = (t) => { const st = stairAt(t); return at(add(PIT, dir(st.a), st.edge + 1.4), st.tread + EYE - 0.5); };
  const spot = [
    // Rest on the centreline too; the Echo faces its first tread squarely.
    // (the Echo's a few strides in from the aisle's middle: echoFix.js, 1)
    vestibuleMiddle(150), echoOld(1) ? echoMiddle(180) : ring(C1, 180, ECHO_STAND_R), silenceMiddle(90), null,
    // The Web of Time: in the corridor a few paces short of the court's gate,
    // looking in at the heart. (It stood 22 from the heart, and the heart was a
    // corridor; the step into the court is the finale's.)
    // (the Fork's back at the pergola's end and a little left, where both ways
    // can be seen leaving the stone: forkFix.js, 1)
    // (the Door's further back, so the gable's finial is in the frame: doorProps.js, 1)
    doorLane(doorPropsOld(1) ? -38 : -38 - DOOR_STAND.back), forkOld(1) ? add(J, pergola, -8) : add(add(J, pergola, -FORK_STAND.back), [-pergola[1], pergola[0]], FORK_STAND.side),
    // (the Pavilion's back on the bridge's first run, near the shore, so its
    // roof is against the sky and not over the eye: pavilionFix.js, 8)
    pavOld(8) ? BRIDGE_STAND : standOn(BRIDGE), add(HEART, heartFrom, paintings ? -22 : -(COURT_HALF + 12)),
  ];
  // The Echo's stair, every tread of it, up over the well and down the other
  // side: the second leg walks it, and the climb to the crossing is its first
  // half.
  //
  // It used to leave out the ends. The climb went from the floor straight to
  // the third tread (and through a point at floor height INSIDE the first
  // two), so the eye rose ten units — about a metre — at 50 degrees in a
  // stride, where the stair itself is 17; coming down from the crossing, that
  // was the reader dropping off the bottom of the flight. And the walk on to
  // the Silence left the flight by its SIDE, over the parapet, and fell twelve
  // units to the floor beside it: "like I am jumping, not walking". Both ends
  // are walked tread by tread now. The first riser is the one tall step there
  // is (5 units off the floor, where the rest are 2.4), so the end treads are
  // stood on towards their upper riser, spreading it over the most ground.
  // (Read off the flight itself, so a re-cut stair — ECHO_FLIGHT — is walked
  // as it is built.)
  const echoFlight = flightProfile(ECHO_FLIGHT);
  const { run: ECHO_RUN, span: ECHO_SPAN, steps: ECHO_STEPS } = echoFlight.dims;
  const echoStair = [];
  for (let s = 0; s < ECHO_STEPS; s++) {
    const at0 = s === 0 ? ECHO_RUN - 2.5 : s === ECHO_STEPS - 1 ? 2.5 : ECHO_RUN / 2 - 0.3;
    echoStair.push(eye(add(C1, dir(0), -ECHO_SPAN + s * ECHO_RUN + at0), echoFlight.stepTop(s)));
  }
  // The floor just short of the first nosing. The stand is back from the foot
  // now, and without this the eye began to rise the moment it left the stand,
  // up a ramp that is not there. (Only where the foot IS in front of the
  // stand: on the old tread it was behind it, and the walk set off backwards.)
  const footU = -ECHO_SPAN - 1.5;
  const echoFoot = footU > spot[1][0] - C1[0] + 1 ? [eye(add(C1, dir(0), footU), FLOOR)] : [];
  yield 'The crossing, over the middle of the Echo';
  // ── The crossing, over the middle of the Echo (VANTAGES) ───────────────────
  // The crown of a flight is its two middle treads, level over the well —
  // asked of flightProfile rather than written out again here, so a flight that
  // is ever re-cut takes this with it.
  const CROWN = Math.max(...echoFlight.top.map(([, h]) => h));
  const crossing = {
    ...VANTAGES[1],
    eye: at(C1, CROWN + EYE),
    // Along the OTHER flight — the one that cannot be seen from the floor. It
    // runs out from under the reader's feet and down to the gallery floor, with
    // the arcades over it and the shaft falling across both. Level would show
    // the arcades and no stair; much steeper cuts the arches off at the top of
    // the frame.
    look: at(add(C1, dir(60), 70), CROWN - 4),
    // Up the flight the walk to the Silence climbs, and no further: whatever
    // the climb is, it is the one the room already has.
    points: [eye(spot[1], FLOOR), ...echoFoot, ...echoStair.slice(0, ECHO_STEPS / 2), at(C1, CROWN + EYE)],
  };
  const stands = [
    { eye: eye(spot[0], FLOOR), look: at(ring(C0, 30, 16), 24) },
    // Along one flight, not across both: seen end-on the two crossing stairs
    // are a heap, and from the foot of one they are a stair you could climb.
    // The crossing itself is up there to be stood on (`vantage`), because from
    // the floor you can only ever see one of the two flights.
    { eye: eye(spot[1], FLOOR), look: at(add(C1, dir(0), 34), 34), vantage: crossing },
    // across the well at the two broken flights, with the one lamp behind them
    { eye: eye(spot[2], FLOOR), look: at(ring(C2, 285, 26), 37) },
    // Face the next steps. A chord across the funnel looked well away from
    // the stair's tangent and made setting off feel like a sideways turn.
    // (turned in toward the well and looking down into it: vertigoFix.js, 1)
    { eye: onStair(0.06), look: vertigoOld(1) ? onStair(0.072) : (() => {
      const e = onStair(0.06), n = onStair(0.072), yaw = Math.atan2(n[2] - e[2], n[0] - e[0]) + STAND_TURN * deg, p = STAND_PITCH * deg;
      return [e[0] + Math.cos(yaw) * Math.cos(p) * 40, e[1] + Math.sin(p) * 40, e[2] + Math.sin(yaw) * Math.cos(p) * 40];
    })() },
    // Up at the arch, gable and pinnacles and all: level, the frame stopped at
    // the springing of its hood and the carving above it was cut off.
    { eye: eye(spot[4], FLOOR), look: at(add(GATE, dir(330), 40), doorPropsOld(1) ? 45 : DOOR_STAND.lookY) },
    // at the end of the pergola, the waymark ahead where the gravel divides —
    // turned a few degrees right of it, so the pergola's last post is out of
    // the frame (it stood down the whole left edge, the nearest, darkest
    // thing in it, and read as a tree trunk; since 2026-10-07 the pergola
    // ends a bay short of here and that post is gone, but the turn still
    // keeps the waymark off the middle)
    //
    // It showed no fork: the stone the ways part at was eight paces off,
    // under the frame's bottom edge, and the look was down the way to the
    // bridge — which runs on the pergola's own line — with the road to the
    // Heart out of the frame to the right. Back from the stone and a little
    // left, both ways leave it across the frame now: to the Pavilion, under
    // the moon, and to the maze's mouth and its two lanterns. (Level enough
    // that the moon over the Pavilion is whole: forkFix.js, 1 and 6.)
    { eye: eye(spot[5], GRAVEL), look: forkOld(1) ? at(turnAbout(spot[5], add(J, dir(285), 30), 7), 13)
      : at(add(spot[5], dir(FORK_STAND.yaw), 40 * Math.cos(FORK_STAND.pitch * deg)), GRAVEL + EYE + 40 * Math.sin(FORK_STAND.pitch * deg)) },
    // on the bridge, the whole pavilion across the water — the roof's eave a
    // line against the sky, the finial whole, and the lanterns along the eave
    // all in the frame (pavilionFix.js, 8 and 5)
    { eye: eye(spot[6], DECK), look: at(PV, pavOld(8) ? 26 : PAV_STAND.lookY) },
    // at the gate of the court at the heart of the maze, looking in
    { eye: eye(spot[7], MAZE), look: at(HEART, paintings ? 21 : 23) },
  ];
  // (the file on its bridge keeps out of the edges of the Vestibule's first frame)
  if (walkers) walkers.watchFrom({ eye: stands[0].eye, look: stands[0].look, fov: 58 });
  const pavilionWalk = paintings ? [] : pavilionCrossing(BRIDGE, EYE);
  const pavilionSplit = pavilionWalk.reduce((nearest, p, i) =>
    dist([p[0], p[2]], spot[6]) < dist([pavilionWalk[nearest][0], pavilionWalk[nearest][2]], spot[6]) ? i : nearest, 0);
  const pavilionIn = paintings ? [] : [...pavilionWalk.slice(0, pavilionSplit), eye(spot[6], DECK)];
  const pavilionVisit = paintings ? [] : [eye(spot[6], DECK), ...pavilionWalk.slice(pavilionSplit + 1)];
  const northWalk = paintings ? [] : pavilionCrossing(NORTH_BRIDGE, EYE);
  const northAxis = unit(N_SHORE, NORTH_BRIDGE[1]);
  const northEntry = [
    eye(add(N_SHORE, northAxis, -10), GRAVEL),
    eye(add(N_SHORE, northAxis, -5.4), 6.9),
    eye(add(N_SHORE, northAxis, -3.6), 6.7),
    eye(N_SHORE, DECK),
  ];
  // The way on from the Pavilion went through the room, out over its second
  // bridge to the landing that bridge comes down on — a few paces of gravel
  // and a hedge — turned round there, and came all the way back before it set
  // off for the maze: twenty-five seconds of a fifty-six second walk spent
  // going to a dead end and returning from it. It goes in, once round the
  // table, and out again by the bridge it came over; the second bridge is
  // there to be found. (?wpavway=old: over it and back.)
  const pavilionThrough = paintings ? [] : Q.get('wpavway') !== 'old' ? [
    ...pavilionVisit,
    ...pavilionRound(pavilionVisit.at(-1), EYE).slice(1),
    ...pavilionVisit.slice(0, -1).reverse(), ...pavilionIn.slice(0, -1).reverse(),
  ] : [
    ...pavilionVisit,
    ...pavilionInterior(pavilionVisit.at(-1), northWalk.at(-1), EYE).slice(1),
    ...northWalk.slice(0, -1).reverse(),
    ...northEntry.slice(0, -1).reverse(),
    // The north bridge meets the lawn. Take its steps before coming back
    // through the opposite side of the room and continuing towards the maze.
    ...northEntry.slice(1), ...northWalk.slice(1),
    ...pavilionInterior(northWalk.at(-1), pavilionVisit.at(-1), EYE).slice(1),
    ...pavilionVisit.slice(0, -1).reverse(), ...pavilionIn.slice(0, -1).reverse(),
  ];
  const legs = [
    { kind: 'walk', points: way(FLOOR, [spot[0], ...[135, 120, 105, 90, 75, 60, 45, 30, 15, 0, -15, -30].map(vestibuleMiddle), ring(C0, 330, 84), hallMid(0, 0, 5), ring(C1, 150, ECHO_A - 2.6), ...[150, 165].map(echoMiddle), spot[1]]) },
    { kind: 'walk', points: [
      eye(spot[1], FLOOR),
      ...echoFoot,
      // Finish the flight along its axis before turning into the aisle.
      ...echoStair,
      ...way(FLOOR, [add(C1, [ECHO_SPAN + 3, 0]), ...[-15, -30].map(echoMiddle), ring(C1, 330, ECHO_A - 2.6), hallMid(1, -1, 5), ring(C2, 150, 84), ...[150, 135, 120, 105].map(silenceMiddle), spot[2]]),
    ] },
    { kind: 'walk', points: [
      // Onto the stair square, a few degrees in from where it starts: the
      // mouth is open from 156° but the stair only begins at 170°, and from
      // 164° the way's last run cut across the corner of the open mouth.
      ...way(FLOOR, [spot[2], ...[75, 60, 45, 30, 15, 0, -15, -30].map(silenceMiddle), ring(C2, 330, 84), hallMid(2, -2, 5), ring(PIT, 150, 94), ...[150, 163, 176].map(vertigoMiddle), ring(PIT, 176, 76)]),
      // Follow the spiral's middle closely instead of taking long chords
      // towards its open edge between a few widely spaced stair samples.
      ...Array.from({ length: 11 }, (_, i) => onStair((i + 1) * 0.005)), stands[3].eye,
    ],
      // Free walking continues down the same stair after the composed stand.
      // The tour still arrives at the broken rail, where its fall begins.
      followThrough: Array.from({ length: 188 }, (_, i) => onStair(0.065 + i * 0.005)),
      // ...but walked on from the stand, the way by default (World.jsx's
      // FOLLOW) is not on down the stair: it bends in across the tread to
      // where the rail has given way, a few steps on, and ends facing out
      // over the edge — so that a reader who only keeps walking comes to the
      // edge, looks over, and goes over if they keep on. The stair down is
      // there to be chosen (turn onto it). (?wbrink=old: the way goes on down.)
      brink: BRINK_OLD ? null : [[0.0632, 6.6], [0.0655, 5.4], [0.0668, 4.2]].map(([t, r]) => {
        const st = stairAt(t);
        return at(add(PIT, dir(st.a), st.edge + r), st.tread + EYE);
      }),
    },
    // off the stair where its rail has given way (0.06 is inside the Vertigo's GAP)
    { kind: 'fall', edge: onEdge(0.06), center: PIT, bottom: -430 },
    { kind: 'walk', points: [
      ...way(FLOOR, [spot[4], doorLane(0), doorLane(50)]),
      // (none of it past the stand, which is further back since forkFix.js 1)
      ...way(GRAVEL, [doorLane(A), ...[0.2, 0.5, 0.8].map((t) => lerp2(PERGOLA0, J, t)).filter((p) => dist(p, J) > dist(spot[5], J) + 4), spot[5]]),
    ] },
    { kind: 'walk', points: [
      ...way(GRAVEL, [spot[5], J, [1216, 218]]),
      ...bridgeEntry, ...(paintings ? hug(DECK, [SHORE, BRIDGE[1], spot[6]]).slice(1) : pavilionIn.slice(1)),
    ] },
    { kind: 'walk', points: [
      // Through the room and onto its other bridge, with continuous guidance.
      ...(paintings ? hug(DECK, [spot[6], BRIDGE[1], SHORE]) : pavilionThrough),
      ...bridgeEntry.slice(0, -1).reverse(),
      // Off the deck by its steps and round onto the shore. The way used to
      // turn straight back from the deck's end toward the maze, which floated
      // the eye out over the bridge's rail and the strip of water beside it;
      // a reader walking it on their own feet (World.jsx's free walk follows
      // this way by default) stood at the rail and could go no further.
      // (Out onto the middle of the shore's own gravel, SHORE_WAY, and round
      // with it: that way ran a pace and a half from the end of the bridge's
      // stone step, whose corner a reader's foot came up onto and stood on —
      // "on a crest" — and went no further; and it met the way to the maze at
      // a right angle and more, walked at a crawl. ?wshoreway=old)
      ...(SHORE_WALK_OLD
        ? way(GRAVEL, [[1231, 203], [1239, 208.5], [1256, 208], [1290, 216], ...PATHS[2].pts.slice(0, -1)])
        : way(GRAVEL, [[1227.5, 204.5], [1231, 208.5], [1238, 211], [1262, 213], [1290, 218], [1302, 220.5], [1310, 228], [1311.6, 240], PATHS[2].pts[1]])),
      // (no further in than the stand: the court is the finale's)
      ...hug(MAZE, [[MAZE_ENTRY[0], MAZE_ENTRY[1] - 6], ...pathToPoint(mazeRoute, spot[7])], 4),
    ] },
  ];

  yield 'Where the walk has worn the floor';
  // ── Where the walk has worn the floor ─────────────────────────────────────
  // The walk's own line through the galleries, laid on the pavement as stone
  // walked smooth: every room had one grid from wall to well and nothing on it
  // to say where people go. Only where the walk is on a gallery floor — not on
  // a stair, not out on the gravel.
  {
    const runs = [];
    for (const leg of legs) {
      if (leg.kind !== 'walk') continue;
      let run = [];
      const flush = () => { if (run.length > 1) runs.push(run); run = []; };
      for (const q of leg.points) {
        if (Math.abs(q[1] - (FLOOR + EYE)) < 0.01 && !inGarden([q[0], q[2]])) run.push(new THREE.Vector3(q[0], 0, q[2]));
        else flush();
      }
      flush();
    }
    const geos = [];
    // the hallway the way in is dressed as (WAY_IN): along it, how far past its far end
    // (the Echo's face, which stands out into its walls: the hallway is `hall` long)
    const far = add(cellC(0, 0), dir(150), D - ECHO_A), along = dir(150), hall = D - ECHO_A - A;
    const pastFar = (p) => (p[0] - far[0] - WAY_IN.by[0]) * along[0] + (p[1] - far[1] - WAY_IN.by[1]) * along[1];
    const acrossFar = (p) => Math.abs((p[0] - far[0] - WAY_IN.by[0]) * -along[1] + (p[1] - far[1] - WAY_IN.by[1]) * along[0]);
    for (const pts of runs) {
      const curve = makeWalkCurve(pts);
      const line = curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / 2))).map((v) => [v.x, v.z]);
      geos.push(wornRibbon(line, 9, 6.12));
      // The way in is worn as that hallway is — by everyone who ever came in.
      let run0 = 0, from = -1, to = -1;
      line.forEach((p, i) => {
        if (pastFar(p) > -hall - 3 && pastFar(p) < 3 && acrossFar(p) < HALL) { if (from < 0) from = i; to = i; }
      });
      if (from >= 0 && to > from) {
        for (let i = 1; i <= from; i++) run0 += dist(line[i - 1], line[i]);
        geos.push(wornRibbon(line.slice(from, to + 1), 9, 6.12, { run0, moveBy: [-WAY_IN.by[0], -WAY_IN.by[1]] }));
      }
    }
    if (geos.length) {
      const m = new THREE.Mesh(keep(mergeGeometries(geos)), M.wornFloor);
      geos.forEach((g) => g.dispose());
      m.name = 'wornPath';
      m.renderOrder = 1;
      root.add(m);
    }
  }

  yield 'What the water has to look at';
  // ── What the water has to look at ─────────────────────────────────────────
  // Every lit thing in the world offers itself to the pond, and the few that
  // would actually show in it are the ones it keeps. A lamp in water is not a
  // point but a broken column of light running towards the eye (water.js), and
  // the eight lanterns round the Pavilion's eaves are the whole of that room —
  // so they are handed to the water directly rather than made into real lights,
  // which would cost the entire frame to light nothing else.
  {
    const bodies = [POND, ...POOLS.map((o) => ({ c: o.c, rx: o.r, rz: o.r }))];
    const reach = (g) => Math.max(...bodies.map((b) => {
      const flat = Math.max(0, dist([g.p[0], g.p[2]], b.c) - Math.max(b.rx, b.rz));
      return 1 / (1 + (flat * flat + (g.p[1] - 6.5) ** 2) * 0.00045);
    }));
    // One lamp, once. The Pavilion's table lamp is both a glow and a water
    // lamp, and handed over as both it laid a column twice as bright as any
    // other lamp's — a sheet of gold on the water in front of the Fork's
    // stand (2026-10-05). The stronger of the two stands for it.
    const one = [];
    for (const g of [...glows, ...waterLamps]) {
      const twin = one.find((o) => Math.hypot(o.p[0] - g.p[0], o.p[1] - g.p[1], o.p[2] - g.p[2]) < 1);
      if (!twin) one.push(g);
      else if ((g.k ?? 1) > (twin.k ?? 1)) one[one.indexOf(twin)] = g;
    }
    one.map((g) => ({ g, seen: reach(g) }))
      .filter((e) => e.seen > 0.06)
      .sort((a, b) => b.seen - a.seen)
      .slice(0, 12)
      .forEach(({ g }) => water.addLamp([g.p[0], g.p[2]], g.p[1], g.color, g.k ?? 1));
  }

  yield 'How the walk ends';
  // ── How the walk ends (finale.js) ─────────────────────────────────────────
  // The light at the heart runs back along the walk: every leg the reader
  // walked, backwards and on the ground, from the maze's mouth to the
  // Library's door — and between the Door and the Vertigo, where the walk is a
  // fall, along the arc the map draws for it — and out down the road not taken.
  let finale = null;
  if (!paintings && mazeGrid) {
    const ground = (p) => [p[0], p[1] - EYE + 1.2, p[2]];
    const back = (i) => [...legs[i].points].reverse().map(ground);
    // The leap from the Door back up to where the reader stood on the
    // Vertigo's stair, arched as the map arches the fall (the map's own arc
    // ends in the middle of the well, and the thread came out of it in a V).
    const door = back(4).at(-1), stair = back(2)[0];
    const ctrl = [(door[0] + stair[0]) / 2 + 40, 260, (door[2] + stair[2]) / 2 - 60];
    const leap = Array.from({ length: 33 }, (_, s) => {
      const t = s / 32, u = 1 - t;
      return [0, 1, 2].map((k) => u * u * door[k] + 2 * u * t * ctrl[k] + t * t * stair[k]);
    });
    finale = buildFinale({
      root, keep, light,
      maze: { MZ, grid: mazeGrid, rects: mazeRects, court: COURT, heart: HEART, ground: MAZE, entry: MAZE_ENTRY },
      stand: stands[7],
      // (far enough off the armillary to see it whole: at 16 its rings filled the frame)
      inside: add(HEART, heartFrom, -28),
      route: [
        at(MAZE_ENTRY, MAZE + 1.2),
        ...back(6).filter((p) => p[2] < MZ.z0 - 3),
        ...back(5), ...back(4),
        ...leap,
        ...back(2), ...back(1), ...back(0),
        at(ENTRANCE, FLOOR + 1.2),
      ],
      branch: { at: J, pts: ROAD.pts.slice(1).map((p) => at(p, GRAVEL + 1.2)) },
      glowTex,
      heartParts,
    });
    finale.room = stands.length - 1;
    // how far the court runs either side of the heart, for a reader who walks
    // into it on their own (World.jsx's free walk sets the finale off there)
    finale.court = COURT_HALF;
  }

  // ── The way in opens onto the Echo (doorway.js) ───────────────────────────
  // The hallway out of the back of the Vestibule — the way in — ran on into a
  // hexagon nobody has dressed. Its far end opens instead onto the Echo,
  // through the Echo's far door: two hallways along the honeycomb is the one
  // between the Silence and the Echo, the same stone walked the same way. A
  // reader walking out of the Vestibule's back comes into the Echo from the
  // Silence's side; turned round inside, the hallway behind them leads to the
  // Silence. The Library does not add up.
  //
  // (The doorway stands where the Echo's face would be: the Echo stands out
  // into its walls, so its hallways are shorter, and the way in opens that
  // much short of its own end, the last of it sealed behind the doorway.)
  const doorways = paintings ? [] : [makeDoorway({
    root, keep,
    at: add(cellC(0, 0), dir(150), D - ECHO_A + 0.05),
    out: dir(150),
    half: HALL / 2 + 1,
    floor: FLOOR - 1,
    top: ARCH_SPRING + ARCH_R + 2,
    by: WAY_IN.by,
  })];
  // (a doorway's face is painted for the reader's own eye: out of every glass)
  const mirrorHide = root.children.filter((o) => o.name === 'doorway');
  // every lamp on the far side with one standing where it would be on this side
  for (const d of doorways) {
    for (const w of lightWishes) {
      const t = lightWishes.find((o) => o !== w && Math.abs(o.x - (w.x - d.by[0])) < 1 && Math.abs(o.z - (w.z - d.by[1])) < 1 && Math.abs(o.y - w.y) < 1);
      if (t) twins.set(w, t);
    }
  }
  // Set what is drawn for an eye — the halos, the lamps — for the far eye a
  // doorway is drawing from (`at`), or back for the reader's own (`at` null,
  // `eye` the reader's).
  const aimFar = (at, eye) => {
    aimHalos(at ?? eye, !at);
    placeLights(at ? false : twinning);
    // the light columns thinned with the fog, for the far eye only
    const k = at ? portalThin(eye) : 1;
    if (!hazeMats) {
      hazeMats = [];
      root.traverse((o) => {
        const m = o.material;
        if (m?.uniforms?.uStrength && m.uniforms.uSoft && !hazeMats.some((h) => h.mat === m)) hazeMats.push({ mat: m, base: m.uniforms.uStrength.value });
      });
    }
    for (const h of hazeMats) h.mat.uniforms.uStrength.value = h.base * k;
  };
  // How much of its haze the room through the Vestibule's way in is drawn
  // with, for a reader whose eye is at `eye`. Through the arch the Echo was
  // the brightest and the greyest thing in the Vestibule's first frame: its
  // moon shaft and its fog, seen down the length of the room, lifted its
  // blacks to milk. Seen from across the room it keeps half of them; walking
  // up to the arch it gets them all back, so that by the step through — where
  // the doorway has to be the room itself — it is the room itself (review
  // 2026-10-08, point 3; ?wvest=old:3).
  const portalThin = (eye) => {
    if (vestOld(3) || !eye || !doorways.length) return 1;
    const at = doorways[0].at;
    const d = Math.hypot(eye.x - at[0], eye.z - at[1]);
    const t = Math.min(1, Math.max(0, (d - 14) / 38));
    return 1 - 0.5 * t * t * (3 - 2 * t);
  };
  // (every light column's material and its own strength, gathered the first time)
  let hazeMats = null;

  const coreColor = new THREE.Color('#ffe4b4');
  // The widest a halo may look from the walk: its full width over its distance,
  // so 0.73 is ±20° either side of the lamp.
  const HALO_REACH = OLD_GLARE ? Infinity : 2 * Math.tan(20 * deg);
  // `eye`, the camera's position: up close — walking under a lamp — a halo would
  // be a wash of light over everything, so it gives way.
  // The halos are seen from an eye: their size and strength are set for it.
  // `aimHalos` again for another eye (a doorway drawing the room beyond it,
  // doorway.js) and back, between the frame's drawings.
  let haloT = 0;
  let eyeAmount = 0;
  // ── A halo hidden by what stands in front of its lamp ───────────────────────
  // A halo is drawn with depthTest off, so that it lies over the stone its lamp
  // lights; and so a lamp behind a column, a wall or a flight of stairs laid
  // its glow over them as if nothing were there. Each halo in front of the eye
  // is asked whether its lamp can be seen — one line a frame, to its middle and
  // then either side of it in turn, so a post takes a third of it and not all —
  // four halos a frame, and none again from where the eye already asked them
  // all three; each fades to what can be seen (`seen`). A line costs a fifth of
  // a millisecond here. `sight`: the body's line of sight (body.js), handed in
  // by World.jsx. ?wlampsoff=occlude: as it was.
  let sight = null;
  const setSight = (fn) => { sight = LAMPS.occlude ? fn : null; };
  let seenNext = 0, seenT = -1;
  const toLamp = new THREE.Vector3(), aside = new THREE.Vector3(), seenAt = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const SIDE = [0, 1, -1];
  const occlude = (t, eye, gaze) => {
    const dt = seenT < 0 ? 0 : Math.min(0.1, Math.max(0, t - seenT));
    seenT = t;
    if (!sight || !eye || !halos.length) return;
    let asked = 0, n = 0;
    for (; n < halos.length && asked < 4; n++) {
      const h = halos[(seenNext + n) % halos.length];
      toLamp.subVectors(h.sprite.position, eye);
      const d = toLamp.length();
      if (d < 1 || d > 900 || (gaze && toLamp.dot(gaze) < d * 0.3)) continue;
      if (!h.from || h.from.distanceToSquared(eye) > 2.25) {
        (h.from ??= new THREE.Vector3()).copy(eye);
        h.tries = 0;
        h.open ??= [1, 1, 1];
      } else if (h.tries >= 3) continue;
      asked++;
      // (stopping short of the lamp, so its own fitting is never in the way)
      const r = Math.max(1.2, h.size * 0.05), short = Math.max(1.6, h.size * 0.08);
      aside.crossVectors(toLamp, UP).normalize().multiplyScalar(r * SIDE[h.tries % 3]);
      seenAt.copy(h.sprite.position).add(aside);
      h.open[h.tries % 3] = sight(eye, seenAt, short) ? 1 : 0;
      h.tries++;
      h.seenTo = (h.open[0] + h.open[1] + h.open[2]) / 3;
    }
    seenNext = (seenNext + n) % halos.length;
    const ease = Math.min(1, dt * 8);
    for (const h of halos) h.seen += (h.seenTo - h.seen) * ease;
  };
  // (`own`: the eye is the reader's — a doorway drawing a far room has none of this)
  const aimHalos = (eye, own = true) => {
    const t = haloT;
    for (const h of halos) {
      let o = h.base * (1 + Math.sin(t * 0.9 + h.phase) * 0.05);
      let size = h.size;
      if (eye) {
        const d = eye.distanceTo(h.sprite.position);
        // down among the walls the bloom already carries a lamp; the halo only helps
        o *= 0.55 * THREE.MathUtils.smoothstep(d, h.size * 0.2, h.size * 0.75);
        if (own) o *= h.seen;
        // A glow round a light is seen at an ANGLE, not measured in the room:
        // sized in world units, a gallery lamp's halo fifty units off spread
        // ±44° from it and washed a whole quarter of the frame from the Echo's
        // crossing. Held to HALO_REACH it stays a glow about the glass.
        if (h.lamp) size = Math.min(size, d * HALO_REACH);
      }
      // The overview reads as a map; the floating glows belong inside rooms.
      h.sprite.visible = eyeAmount > 0;
      h.mat.opacity = o * eyeAmount;
      h.sprite.scale.set(size, size, 1);
    }
  };
  // While the reader falls down the Vertigo's well, or climbs back up out of
  // it, the light at the bottom stays where it was when they went (true); it
  // keeps its distance below the eye again after (false).
  const holdPit = (on) => { pitHeld = on && pitCore ? (pitHeld ?? pitCore.position.y) : null; };
  // `aspect`: the frame's width over its height (the file on the Vestibule's
  // bridge keeps out of its edges: walkers.js)
  const tick = (t, eye, gaze, aspect = 0) => {
    // (the belt's leaf takes its light from the world's own lights, as they
    // stand this frame: webProps.js, 2)
    if (beltLeaf) {
      beltLight.uBackMoon.value.copy(moon.color).multiplyScalar(moon.intensity);
      beltLight.uBackMoonDir.value.copy(moon.position).sub(moon.target.position).normalize();
      beltLight.uBackSky.value.copy(hemi.color).multiplyScalar(hemi.intensity);
      beltLight.uBackGround.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity);
      beltLight.uBackFill.value.setRGB(...BELT.fill).multiplyScalar(root.parent?.environmentIntensity ?? 1);
    }
    // A lamp breathes; it does not flicker. The fast terms in both of these —
    // 11 and 6 radians a second, about two a second — were what read as
    // blinking, and a pool of light on stone has no business doing that.
    for (const p of pools) {
      const n = Math.sin(t * 1.15 + p.phase) * 0.6 + Math.sin(t * 2.6 + p.phase * 1.7) * 0.4;
      p.mat.opacity = p.base * (1 + n * p.amount * 0.55);
    }
    // (the Door's candles: the flames move, and their light on the piers with them)
    M.lpFlame.uniforms.uTime.value = light ? 0 : t;
    for (const c of candleLights) c.wish.intensity = c.base * (1 + DOOR_CANDLES.breath * (light ? 0 : 0.6 * Math.sin(t * 1.3 + c.phase) + 0.4 * Math.sin(t * 2.9 + c.phase * 2.1)));
    haloT = t;
    occlude(t, eye, gaze);
    aimHalos(eye);
    if (armillary) {
      armillary.rotation.y = t * 0.22;
      armillary.children[1].rotation.y = t * 0.5;
    }
    // (after the armillary and the heart's halo: the finale's share laid over them)
    if (finale) finale.tick(light ? 0 : t);
    if (pitCore) {
      pitCore.material.color.copy(coreColor).multiplyScalar(1.35 + Math.sin(t * 1.3) * 0.12);
      // (held where it is while the reader falls toward it or climbs out of
      // it — `holdPit` — or the light would flee the fall all the way down)
      const below = pitHeld ?? (eye && Math.hypot(eye.x - PIT[0], eye.z - PIT[1]) < 101 ? Math.min(-453, eye.y - 420) : -453);
      pitCore.position.y = below;
      pitSink?.(below + 453);
    }
    if (drift) drift(light ? 0 : t);
    if (vault) vault(t, eye, gaze);
    if (walkers) walkers.tick(t, eye, aspect);
    for (const f of mist) {
      f.m.position.x = f.home[0] + Math.sin(t * f.speed + f.phase) * f.reach;
      f.m.position.z = f.home[1] + Math.cos(t * f.speed * 0.73 + f.phase * 1.3) * f.reach * 0.6;
    }
    sparkles.forEach((points) => { points.material.uniforms.uTime.value = light ? 0 : t; });
    water.tick(t);
    wind.value = light ? 0 : t;
  };

  // Points are sized in world units; this is the pixels per unit at distance 1.
  const setViewport = (pixelsPerUnit) => {
    sparkles.forEach((points) => { points.material.uniforms.uScale.value = pixelsPerUnit; });
    water.setViewport(pixelsPerUnit);
    if (finale) finale.setViewport(pixelsPerUnit);
  };

  const setPainting = (index, texture) => {
    const mount = mounts[index];
    if (!mount) return;
    mount.material.map = texture;
    mount.material.color.set('#ffffff');
    mount.material.needsUpdate = true;
  };

  const dispose = () => {
    spiral?.dispose();
    water.dispose();
    doorways.forEach((d) => d.dispose());
    archGeo.dispose();
    disposables.forEach((d) => d.dispose?.());
    root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  };

  // Fade halos in on the way down from the map; inside rooms, walls hide them.
  let eyeLevel = false;
  const setEye = (amount) => {
    eyeAmount = amount;
    const down = amount > 0.5;
    if (down === eyeLevel) return;
    eyeLevel = down;
    halos.forEach((h) => { h.mat.depthTest = down; });
    if (finale) finale.setEyeLevel(down);
  };

  // How far the eye is from the nearest open water — what tells the mirror
  // pass whether it is worth drawing the world a second time this frame.
  const ponds = [POND, ...POOLS.map((o) => ({ c: o.c, rx: o.r, rz: o.r }))];
  const toWater = (eye) => Math.min(...ponds.map((b) => Math.max(0,
    Math.hypot(eye.x - b.c[0], eye.z - b.c[1]) - Math.max(b.rx, b.rz))));

  const pit = { x: PIT[0], z: PIT[1], r: 101 };
  // the Silence, where the fill is let down so that its one lamp carries the room
  const hush = { x: cellC(2, -2)[0], z: cellC(2, -2)[1], r: R };
  return { root, moon, hemi, mounts, stands, legs, overlay, pit, spiral, hush, water, toWater, finale, doorways, mirrors, mirrorHide, aimFar, portalThin, walkers, tick, holdPit, setPainting, setVeil, setEye, setWay, updateLights, setLightBudget, takeShadowRequest, cull, setViewport, setSight, poolShadows, dispose };
}
