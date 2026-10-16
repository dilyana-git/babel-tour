// The Web of Time's details: the wall top and the belt of cedars, the night
// behind it, the armillary's rings, the way out of the court, the fireflies
// and the pedestal.
import * as THREE from 'three';
import { HEART, MAZE } from './gardenPlan';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// The belt (webProps.js, SCREEN, is what it was: three rows two cells deep,
// of which twenty-one trees stood — the Library's stone is ten units behind
// the first row west of the maze's middle, and the garden's own hedge runs
// through the third). Each row: `at` how far past the maze's far hedge, `x`
// from where to where (in cells off the maze's west side), its heights and
// reaches; `lane`: the way out of the court's back gate is left open through
// it; `far`: beyond the garden's hedge, never seen from near. Two rows stand
// between the maze and the stone, and two more behind the garden's hedge,
// in front of the far block (`tight`: how close a row is set, 1 the gap).
// `step`: the share of the gap from one tree to the next along a row.
// `map`: how much of their height they have over the map, where they stood
// across the maze from the eye (buildWorld.js, beltGroup), and `sink` from
// how much of the map showing to how much they are drawn down. `foot`: how
// high up a `far` one its leaf begins.
// `fill`: what the scene's own fill gives a leaf of theirs, beside the moon
// and the sky (effects.js, makeBackdropFoliage; ?wwblit=1 lights them as the
// garden's trees are, for comparing).
// `moon`: how much more of the night's light their leaf gives back at the
// leader than a garden cedar's (a third of that at the foot): at the garden's
// own value the belt was one black shape with a toothed top, and the right
// of the frame, where the spires stand to its top, a wall again.
// `wall`: the height of one with the Library's stone close behind it (there
// the belt is two rows deep and no more, and a low tree is a notch with the
// wall in it), `reach` how much wider, `tight` how much closer the next one
// stands: `behind` and `beside`, how close.
export const BELT = {
  rows: [
    { at: 13, sway: 3, lane: true, tight: 1.3, H: [68, 116], S: [14, 19] },
    { at: 25, sway: 3, lane: true, tight: 1.3, H: [76, 130], S: [15, 21] },
    { at: 71, sway: 4, lane: false, far: true, tight: 1.3, x: [3.8, 11.6], H: [104, 146], S: [19, 25] },
    { at: 86, sway: 5, lane: false, far: true, tight: 1.3, x: [3.8, 11.6], H: [112, 156], S: [19, 26] },
    // and down the maze's west side, where the stone stands along it too
    // (`flank`: how far west of the maze, `z` from where to where in cells
    // off its far hedge)
    { flank: 26, z: [-2.7, 0.2], sway: 4, lane: false, H: [140, 184], S: [17, 22] },
  ],
  step: [0.62, 1.45],
  moon: qn('wwbmoon', 3.4),
  map: qn('wwbmap', 0.14), sink: [0.04, 0.7], foot: qn('wwbfoot', 34),
  lit: Q.get('wwblit') === '1', fill: [0.32, 0.7, 1.05].map((v) => v * qn('wwbfill', 1)),
  wall: [qn('wwbwall0', 164), qn('wwbwall1', 200)], reach: 1.12, tight: qn('wwbtight', 0.9), behind: 44, beside: [0, 16, 32],
};
// And how one is dressed (trees.js, growTree `spire`): `taper` the power its
// reach falls away by up the stem (1 a straight cone), `belly` how far up its
// widest whorl is, `close` a whorl's distance from the last as a share of its
// reach, between `step` units, `leaf` a spray's width as a share of the reach.
export const SPIRE = { taper: qn('wwbtaper', 0.92), belly: 0.1, close: qn('wwbclose', 0.6), step: [3.3, 8.5], leaf: qn('wwbleaf', 1.42) };

// Rows stood by chance leave gaps, and a gap in the belt has the Library in
// it. So the belt is closed from where it is looked at: `eye`, the court's
// stand, and `skyline`, the top of the Library's stone from there by bearing —
// [degrees off due south (west positive), degrees up, how far off] — as the
// stand's own rays found it. Along every degree of it, either a spire already
// stands across the ray as high as the stone shows (`over` degrees more), or
// one is planted on the ray: as far back as it can stand (`back` short of the
// stone, then `step` nearer at a time), tall enough that the height wanted is
// `at` of the way up it, where it is still `cover` of its reach wide.
export const CLOSE = {
  eye: [HEART[0], 20, HEART[1] - 57], over: 1, at: [0.6, 0.74], cover: 0.8, back: 16, step: 9, least: 150,
  skyline: [
    [-44, 7.5, 738], [-41, 8, 703], [-38, 10.5, 532], [-35, 12, 536], [-32, 12.5, 517], [-29, 12, 479], [-26, 13, 491],
    [-24.5, 16.5, 338], [-21.5, 17.5, 358], [-18.5, 18, 348], [-15.5, 18.5, 340], [-12.5, 18.5, 338], [-9.5, 19, 332],
    [-6.5, 19, 329], [-3.5, 19, 334], [-2, 18.5, 305], [1, 20, 278], [4, 21.5, 256], [7, 23, 238], [10, 24.5, 222],
    [13, 26, 210], [16, 26.5, 204], [19, 26.5, 228], [22, 26, 211], [25, 25.5, 238], [28, 25, 244], [31, 24.5, 252],
    [34, 23.5, 236], [37, 23, 270], [40, 21.5, 256], [43, 21, 266], [46, 21.5, 287], [49, 22, 280], [52, 22.5, 277],
  ],
};
// `trees`: the belt so far, [{ p, H, S }], added to. `ok(p, S)`: the garden's
// say; `clear(p, S)`: off the maze and out of the lane; `ground`: the lawn.
export function closeBelt(trees, rng, ok, clear, ground) {
  const R = (a, b) => a + (b - a) * rng();
  const [ex, ey, ez] = CLOSE.eye, deg = Math.PI / 180;
  // how wide a spire is, a height up it (the narrowest its whorls are drawn)
  const wide = (t, y) => (y >= t.H ? 0 : CLOSE.cover * t.S * Math.pow(1 - y / t.H, SPIRE.taper));
  const sky = CLOSE.skyline;
  for (let az = sky[0][0]; az <= sky[sky.length - 1][0]; az += 1) {
    const k = Math.max(1, sky.findIndex((s) => s[0] >= az)), u = (az - sky[k - 1][0]) / (sky[k][0] - sky[k - 1][0]);
    // (the higher and the nearer of the two it lies between: the stone steps)
    const up = Math.max(sky[k - 1][1], sky[k][1]) + CLOSE.over, far = u < 0.5 ? sky[k - 1][2] : sky[k][2];
    const dir = [-Math.sin(az * deg), Math.cos(az * deg)], rise = Math.tan(up * deg);
    const want = (along) => ey + along * rise - ground;
    const covered = trees.some((t) => {
      const dx = t.p[0] - ex, dz = t.p[1] - ez, along = dx * dir[0] + dz * dir[1];
      return along > 20 && along < far - 4 && Math.abs(dx * dir[1] - dz * dir[0]) < wide(t, want(along)) - 1.5;
    });
    // (the draws spent whether one is planted or not)
    const share = R(...CLOSE.at), reach = R(0.125, 0.15);
    if (covered) continue;
    for (let along = far - CLOSE.back; along >= CLOSE.least; along -= CLOSE.step) {
      const p = [ex + dir[0] * along, ez + dir[1] * along];
      const H = Math.min(206, Math.max(70, want(along) / share)), S = Math.min(26, Math.max(15, H * reach));
      if (!clear(p, S) || !ok(p, S)) continue;
      trees.push({ p, H, S, closing: true });
      break;
    }
  }
  return trees;
}

// The rings, as bands: [inner radius, outer radius, half thickness], the
// arris eased by `ease`. The scale on a face: `n` divisions, every `mid`th
// longer and every `long`th longest (`len`, from the outer scribed line in),
// `wide` across, `proud` of the face — a hair, so they are let in and not
// laid on. `in`: the scale's outer line, in from the rim.
export const RINGS = {
  ease: 0.07, proud: 0.012,
  meridian: { band: [8.98, 10.0, 0.26], n: 180, mid: 5, long: 10, len: [0.24, 0.4, 0.58], wide: 0.05, in: 0.12 },
  equator: { band: [8.16, 8.9, 0.2], n: 96, mid: 2, long: 4, len: [0.16, 0.26, 0.4], wide: 0.045, in: 0.1 },
};
// A band about the origin in the xy plane: its section turned on the lathe,
// every corner twice (so each face is flat and the eased arris catches the
// light as a line).
// `bead` (gardenProps.js — { r, in }): a half-round raised along each edge
// of each face, so the band has a section and is not a strip.
const bandGeometry = ([ri, ro, h], ease, segments, bead = null) => {
  const P = [];
  const corner = (r, y) => P.push(new THREE.Vector2(r, y), new THREE.Vector2(r, y));
  // a bead on the face at `y0` (standing `up` from it), its middle at `rc`,
  // drawn the way the section is being walked (`way`: 1 outward, -1 inward)
  const round = (rc, y0, up, way) => {
    if (!bead) return;
    corner(rc - way * bead.r, y0);
    for (let k = 1; k < 6; k++) { const t = (Math.PI * k) / 6; P.push(new THREE.Vector2(rc - way * bead.r * Math.cos(t), y0 + up * bead.r * Math.sin(t))); }
    corner(rc + way * bead.r, y0);
  };
  corner(ri, -h + ease); corner(ri + ease, -h);
  round(ri + (bead?.in ?? 0) + ease, -h, -1, 1); round(ro - (bead?.in ?? 0) - ease, -h, -1, 1);
  corner(ro - ease, -h); corner(ro, -h + ease);
  corner(ro, h - ease); corner(ro - ease, h);
  round(ro - (bead?.in ?? 0) - ease, h, 1, -1); round(ri + (bead?.in ?? 0) + ease, h, 1, -1);
  corner(ri + ease, h); corner(ri, h - ease);
  P.push(new THREE.Vector2(ri, -h + ease));
  return new THREE.LatheGeometry(P, segments).rotateX(Math.PI / 2);
};
// The gilt let into it: the divisions on both faces (each a bar through the
// band, a hair longer than the band is thick, so only its two ends show), the
// two scribed lines the scale lies between and, with `edge`, a line across
// the band's outer edge at every `long` division — what is seen of a ring
// lying level, from below.
const scaleGeometries = ({ band: [, ro, h], n, mid, long, len, wide, in: inset }, proud, { edge = false } = {}) => {
  const parts = [], out = ro - inset, deep = 2 * (h + proud);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, L = len[k % long === 0 ? 2 : k % mid === 0 ? 1 : 0];
    parts.push(new THREE.BoxGeometry(L, wide, deep).translate(out - L / 2, 0, 0).rotateZ(a));
    if (edge && k % long === 0) parts.push(new THREE.BoxGeometry(2 * proud + 0.1, wide, 2 * h - 0.14).translate(ro - 0.05, 0, 0).rotateZ(a));
  }
  for (const r of [out, out - len[2] - 0.05]) {
    const line = [[r - 0.018, -h - proud], [r + 0.018, -h - proud], [r + 0.018, h + proud], [r - 0.018, h + proud], [r - 0.018, -h - proud]];
    // (indexed, as a lathe is; the bars are not, and the two are merged)
    parts.push(new THREE.LatheGeometry(line.map(([x, y]) => new THREE.Vector2(x, y)), 144).rotateX(Math.PI / 2).toNonIndexed());
  }
  return parts.map((g) => (g.index ? g.toNonIndexed() : g));
};
// One ring: { band, scale } — the bronze and the gilt, each one geometry.
// (`opts.bead`: with a bead at each edge the scale lies between the beads —
// further in from the rim, its divisions a little shorter.)
export function graduatedRing(which, merge, opts = {}) {
  const bead = opts.bead ?? null, room = bead ? bead.in + bead.r + 0.04 : 0;
  const R = bead ? { ...RINGS[which], in: RINGS[which].in + room, len: RINGS[which].len.map((l) => l * (which === 'equator' ? 0.72 : 0.86)) } : RINGS[which];
  const parts = scaleGeometries(R, RINGS.proud, opts);
  const scale = merge(parts);
  parts.forEach((g) => g.dispose());
  return { band: bandGeometry(R.band, RINGS.ease, 144, bead), scale };
}

// The night behind the belt. `dir`: the bearing of it in the xz plane (from
// the court, south: the way the stand looks); `k` how much of the horizon's
// own haze is laid over the sky there; `rise`, as sines of the height: full
// from the first, where the spires' tips are, to the second, and gone by the
// third; `wide` how far round from `dir` it reaches (1 a half-circle).
// `near`, `far`: how far from the heart the eye may be and still have all of
// it, and where it has none — the glow belongs to this court's view of the
// sky, and the Fork's and the Pavilion's nights are the ones they were.
export const GLOW = {
  on: true,
  dir: [0, 1], k: qn('wwglow', 0.9), rise: [0.26, 0.44, qn('wwglowtop', 0.84)], wide: qn('wwglowwide', 0.8),
  heart: HEART, near: 150, far: 330,
};

// The cedars behind the maze: rows parallel to its far hedge, `gap` apart
// along the row, `back` between rows, the first `first` past the hedge's
// line. Heights by row (the back rows taller, so the spires stand over the
// ones in front and close the notches between their tips). Their own stream.
export const SCREEN = {
  seed: 7741,
  first: qn('wwsfirst', 24), back: qn('wwsback', 16), gap: qn('wwsgap', 17), skirt: qn('wwsskirt', 0.06),
  // (of a height and evenly spaced they were a palisade)
  rows: BELT.rows,
  step: BELT.step,
};
// And the stone they stand in front of, let fall into the night (the mass's
// `weather` shading, build/materials.js): by `k` south of z[0]..z[1] and east of
// x[0]..x[1] — behind the maze from the court, and clear of the Door's cell
// and of every room on the walk. (The heart's own falloff already takes
// most of the near walls; the far block at z 673 was out of its reach.)
// `spec`: and its sheen with it. The heart's falloff only ever darkened the
// stone's colour, and blank brick painted black was still brick in the sky's
// reflection off it.
export const WALLS = { k: qn('wwwall', 0.93),
  z: [MAZE.z0 + 152, MAZE.z0 + 227], x: [MAZE.x0 - 120, MAZE.x0 - 50], spec: true };
// Where they stand: `MZ` the maze's grid, `ok(p)` the garden's say (inside it,
// off its hedge, a crown's reach off the Library's stone). The rows run the
// width of the maze and a cell past each side, because from the stand the
// stone shows over the court's side hedges too.
// `walled(p)`: the Library's stone is close behind `p` (below).
export function screenPlaces(rng, MZ, ok, walled = null) {
  const R = (a, b) => a + (b - a) * rng();
  const out = [];
  const hedge = MZ.z0 + MZ.rows * MZ.ch, z0 = hedge + SCREEN.first;
  const xa = MZ.x0 - 1.2 * MZ.cw, xb = MZ.x0 + (MZ.cols + 1.4) * MZ.cw;
  const laneX = MZ.x0 + (GATE.col + 0.5) * MZ.cw;
  SCREEN.rows.forEach((row, k) => {
    // (a row of the belt, webProps.js, says where it stands: `at` off the
    // hedge, and `x` from where to where as shares of a cell off the maze)
    const a = row.x ? MZ.x0 + row.x[0] * MZ.cw : xa, b = row.x ? MZ.x0 + row.x[1] * MZ.cw : xb;
    const z = row.at === undefined ? z0 + k * SCREEN.back : hedge + row.at, sway = row.sway ?? 5;
    let tight = 1;
    const za = row.flank === undefined ? 0 : hedge + row.z[0] * MZ.ch, zb = row.flank === undefined ? 0 : hedge + row.z[1] * MZ.ch;
    for (let x = row.flank === undefined ? a + (k % 2) * SCREEN.gap * 0.5 : za; x <= (row.flank === undefined ? b : zb); x += SCREEN.gap * R(...SCREEN.step) * tight) {
      tight = row.tight ?? 1;
      const p = row.flank === undefined ? [x + R(-3, 3), z + R(-sway, sway)] : [MZ.x0 - row.flank + R(-sway, sway), x + R(-3, 3)];
      // (all the draws spent whether it stands or not, so one moved by a dial
      // does not reshuffle the rest)
      let H = R(...row.H);
      let S = R(...row.S);
      if (walled) {
        const tall = R(...BELT.wall);
        if (row.flank === undefined && walled(p)) { H = Math.max(H, tall); S *= BELT.reach; tight = BELT.tight; }
      }
      const inLane = GATE.through && (row.lane ?? k < 2) && Math.abs(p[0] - laneX) < S * GATE.lane[0] + GATE.lane[1];
      if (ok(p, S) && !inLane) out.push({ p, H, S, far: !!row.far });
    }
  });
  return out;
}

// The gate: the cell of the court's south rim that opens (5, to the left of
// the armillary from the stand; 3 is to its right), and the run of cells the
// way goes straight on through before the maze has it turn.
// `through`: and on out of the maze's far side, into a lane left between the
// cedars' first two rows (`lane`: how far off its line a trunk must stand, as
// a share of its crown, plus a margin). Stopped by the maze's outer hedge 60
// units on, the way read as an alcove, lit at its end; it runs into the dark
// now. (The lawn out there was always walked on; the garden's hedge closes it.)
export const GATE = { col: qn('wwgcol', 5), run: 2, through: Q.get('wwgthrough') !== '0', lane: [0.55, 5] };
// `set(c, r, d, v)` and `reachable()` are the court's own (rooms/web.js).
export function openGate(grid, COURT, set, reachable) {
  const c = GATE.col, rows = grid.length;
  let r = COURT.r1;
  set(c, r, 's', 0);
  for (let k = 1; k <= GATE.run && r + k < rows; k++) {
    if (r + k + 1 < rows) {
      if (k < GATE.run) set(c, r + k, 's', 0);
    } else if (GATE.through) grid[r + k][c].s = 0;   // (the maze's outer hedge)
  }
  // hedge on both hands the length of the run, where the maze can spare it:
  // a way that opens sideways at once reads as a gap, not a way
  for (let k = 1; k <= GATE.run && r + k < rows; k++) {
    for (const d of ['e', 'w']) {
      if (grid[r + k][c][d]) continue;
      set(c, r + k, d, 1);
      if (!reachable()) set(c, r + k, d, 0);
    }
  }
}

// The fireflies: every one the stream drew (a third were flown), `extra`
// more over the maze from a stream of their own, at `size` of the old size,
// and blinking.
export const FLIES = { size: qn('wwfsize', 0.5), extra: qn('wwfextra', 240), seed: 7757, blink: qn('wwfblink', 1) };

// The pedestal, as a profile turned on the lathe: [r, y] from the foot of
// the plinth out and up to the middle of the abacus's top. A corner is the
// same point twice (LatheGeometry then keeps the faces either side of it
// flat). Heights are the old stand's: on the court's floor at 5, the
// armillary's seat at 16.1.
const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});
const D = Math.PI / 180;
export const PEDESTAL = {
  // the shaft: foot and head radius, its two reeded zones and the two rings of
  // letters between them (centre heights), the band's height
  shaft: { y0: 9.1, y1: 13.7, r0: 4.02, r1: 3.66 },
  reeds: [[9.1, 9.84], [12.36, 13.7]],
  rings: [11.65, 10.55], band: 0.94,
  flutes: 28, fluteDeep: 0.13,
  text: ['TIME FORKS PERPETUALLY', 'TOWARD INNUMERABLE FUTURES'],
};
const shaftR = (y) => {
  const { y0, y1, r0, r1 } = PEDESTAL.shaft, t = (y - y0) / (y1 - y0);
  // entasis: a swell a third of the way up, not a straight cone
  return r0 + (r1 - r0) * t + 0.06 * Math.sin(Math.PI * Math.min(1, t * 1.5));
};
export const pedestalShaftR = shaftR;
function profile() {
  const P = [];
  const corner = (r, y) => P.push([r, y], [r, y]);
  const run = (pts) => pts.forEach((p) => P.push(p));
  // plinth: two steps, their arrises chamfered
  corner(6.95, 5.0);
  run([[6.95, 5.62]]);
  corner(6.72, 5.84);
  corner(6.2, 5.84);
  run([[6.2, 6.4]]);
  corner(6.02, 6.58);
  // base: torus, scotia, torus, fillet, and the shaft's curved foot
  corner(5.42, 6.58);
  run(arc(5.42, 6.97, 0.39, -90 * D, 90 * D, 8).slice(1));
  corner(5.1, 7.36);
  run([[5.0, 7.42], [4.8, 7.56], [4.69, 7.76], [4.7, 7.95], [4.8, 8.08]]);
  run(arc(4.78, 8.33, 0.25, -95 * D, 90 * D, 7));
  corner(4.5, 8.58);
  run([[4.5, 8.72]]);
  run([[4.32, 8.82], [4.16, 8.94], [shaftR(9.1), 9.1]]);
  // the shaft, with a fillet round it above and below each ring of letters
  // (the one between the rings is shared)
  const fillets = [...new Set(PEDESTAL.rings.flatMap((y) => [y - PEDESTAL.band / 2 - 0.16, y + PEDESTAL.band / 2]).map((f) => +f.toFixed(3)))].sort((a, b) => a - b);
  let y = 9.1;
  for (const f of fillets) {
    for (let t = y + 0.2; t < f - 0.04; t += 0.2) run([[shaftR(t), t]]);
    corner(shaftR(f), f);
    corner(shaftR(f) + 0.13, f);
    corner(shaftR(f) + 0.13, f + 0.16);
    corner(shaftR(f + 0.16), f + 0.16);
    y = f + 0.16;
  }
  for (let t = y + 0.2; t < PEDESTAL.shaft.y1 - 0.04; t += 0.2) run([[shaftR(t), t]]);
  run([[shaftR(13.7), 13.7]]);
  // neck: the astragal is the gilt ring (pedestalGeometry); then the capital's
  // ovolo swelling out to the abacus, and the abacus with its top arris eased
  corner(3.62, 13.96);
  run([[3.62, 14.1]]);
  run(arc(3.62, 15.02, 0.92, -90 * D, 0, 7).slice(1));
  corner(4.62, 15.02);
  corner(4.78, 15.02);
  run([[4.78, 15.84]]);
  corner(4.62, 16.1);
  corner(0.001, 16.1);
  return P.map(([r, yy]) => new THREE.Vector2(r, yy));
}
// The stone of it, about the origin (the caller carries it to the heart), and
// the gilt: the neck's astragal and a bead in the base's upper fillet.
export function pedestalGeometry(segments = PEDESTAL.flutes * 8) {
  const g = new THREE.LatheGeometry(profile(), segments);
  // Reeds in the two zones: the stone cut back in rounded channels, faded out
  // at either end of a zone so the channels stop in the stone as cut ones do.
  const pos = g.attributes.position, n = PEDESTAL.flutes;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const zone = PEDESTAL.reeds.find(([a, b]) => y > a && y < b);
    if (!zone) continue;
    const [a, b] = zone, edge = Math.min(1, (y - a) / 0.18, (b - y) / 0.18);
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    if (r < 1) continue;
    const ang = Math.atan2(z, x);
    // (a whole cosine, every vertex on a channel or a ridge: cut as a
    // half-cosine with flats between, the channels twisted like rope)
    const cut = PEDESTAL.fluteDeep * edge * (0.5 + 0.5 * Math.cos(n * ang));
    pos.setXYZ(i, (x / r) * (r - cut), y, (z / r) * (r - cut));
  }
  g.computeVertexNormals();
  // uv in world units, as the garden's stone takes it (its maps repeat once
  // in 26): round the shaft by arc length, and up it by height plus radius,
  // so a step's top is not one smear of a single texel row
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    uv.setXY(i, ((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * 2 * Math.PI * 4.2, pos.getY(i) + r * 0.8);
  }
  const gold = [
    new THREE.TorusGeometry(3.74, 0.17, 8, 64).rotateX(Math.PI / 2).translate(0, 13.83, 0),
    new THREE.TorusGeometry(4.53, 0.08, 6, 64).rotateX(Math.PI / 2).translate(0, 8.65, 0),
  ];
  return { stone: g, gold };
}
// The letters' places: for each ring, each glyph's angle round the shaft (the
// middle of the ring turned to `face`, an angle in the xz plane, the reader
// reading left to right from outside), its height, its size.
export function pedestalLetters(glyphs, face) {
  const track = 0.14, space = 0.55, out = [];
  PEDESTAL.text.forEach((text, k) => {
    const y = PEDESTAL.rings[k], r = shaftR(y) + 0.035;
    const span = [...text].reduce((w, ch) => w + (ch === ' ' ? space : glyphs[ch].adv + track), -track);
    // the letters as tall as the band takes, and never so wide the ring
    // runs into itself (half a letter's room left where it closes)
    const cap = Math.min(PEDESTAL.band * 0.62, (2 * Math.PI * r - 1.2) / (span + 1.4));
    let s = -span / 2;
    for (const ch of text) {
      if (ch === ' ') { s += space; continue; }
      const G = glyphs[ch];
      out.push({ ch, a: face - ((s + G.adv / 2) * cap) / r, y, r, cap });
      s += G.adv + track;
    }
  });
  return out;
}
