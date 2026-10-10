// The Web of Time's own things, reviewed 2026-10-09 (board 12 of the second
// audit; the numbers are the board's own). The court was right — the lettered
// pedestal, the paving and its gold paths, the fireflies, the hedges in the
// near field — and what stood round and over it was not:
// 1 over the cedars the Library's wall top still showed, a pale lit strip on
//   the night (the green discs along it were auditFix.js, 2). The balustrade
//   on the wall tops is the garden's pale stone, and nothing let it fall into
//   the night with the wall and the coping under it; and its balusters are
//   instances, which the night's falloff placed at the world's origin, so
//   they stayed white whatever the rail did. Both fall now (buildWorld.js,
//   M.wallTop and stoneShade's `vStoneAt`) — and the belt, below, is closed
//   in front of all of it, so that from the stand none of the stone shows.
// 2 the cedars were telegraph poles: a straight bare stem with a tuft every
//   nine units up it, all of a height and evenly spaced, a palisade — and
//   only twenty-five of them stood, with the wall between. They are grown as
//   spires (trees.js, `spire`): leaf from the grass to the leader, in whorls
//   set as close as their own reach, hanging low down and lifting toward the
//   top; of heights from 68 to 200; stood unevenly, in rows where there is
//   ground for a row, and then one more wherever from the stand the stone
//   still showed between two (closeBelt).
// 3 the armillary was a saw blade: its degrees and hours were blocks of gilt
//   stood out from the rims of round hoops, teeth on a gear. The rings are
//   flat bands now, as an instrument's are, and the graduations are let into
//   their faces in gilt, every fifth longer and every tenth longest, between
//   two scribed lines. The lit band with its signs is as it was.
// 6 the caption's last words ran out over the pale court, the brightest floor
//   on the walk, and its name sat a line lower than in every other room:
//   map.css — the pool of shadow under it reaches further in this room
//   (`.room-hud[data-room='web']`), and the voice's cell is as tall in every
//   room (`.room-voice`). (No switch: it is not the world's.)
// 7 the top of the frame was a black void — sky and cedars both at nothing,
//   the trees without an outline, the court afloat in black. The night behind
//   the belt is lifted a few levels, low down, as haze with the moon on it
//   (sky.js), and the belt's own leaf gives back enough of the night to have
//   a shape (`BELT.moon`): over the upper three fifths of the stand's frame
//   the median luminance went from 0.0006 to 0.0019.
//
// ?wwebprops=old puts all of them back as they were; ?wwebprops=old:2,7 only those.
import * as THREE from 'three';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wwebprops');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const webPropsOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// 2. The belt (webFix.js, SCREEN, is what it was: three rows two cells deep,
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
  eye: [1315, 20, 366], over: 1, at: [0.6, 0.74], cover: 0.8, back: 16, step: 9, least: 150,
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

// 3. The rings, as bands: [inner radius, outer radius, half thickness], the
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
const bandGeometry = ([ri, ro, h], ease, segments) => {
  const P = [];
  const corner = (r, y) => P.push(new THREE.Vector2(r, y), new THREE.Vector2(r, y));
  corner(ri, -h + ease); corner(ri + ease, -h); corner(ro - ease, -h); corner(ro, -h + ease);
  corner(ro, h - ease); corner(ro - ease, h); corner(ri + ease, h); corner(ri, h - ease);
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
export function graduatedRing(which, merge, opts) {
  const R = RINGS[which];
  const parts = scaleGeometries(R, RINGS.proud, opts);
  const scale = merge(parts);
  parts.forEach((g) => g.dispose());
  return { band: bandGeometry(R.band, RINGS.ease, 144), scale };
}

// 7. The night behind the belt. `dir`: the bearing of it in the xz plane (from
// the court, south: the way the stand looks); `k` how much of the horizon's
// own haze is laid over the sky there; `rise`, as sines of the height: full
// from the first, where the spires' tips are, to the second, and gone by the
// third; `wide` how far round from `dir` it reaches (1 a half-circle).
// `near`, `far`: how far from the heart the eye may be and still have all of
// it, and where it has none — the glow belongs to this court's view of the
// sky, and the Fork's and the Pavilion's nights are the ones they were.
export const GLOW = {
  on: !webPropsOld(7),
  dir: [0, 1], k: qn('wwglow', 0.9), rise: [0.26, 0.44, qn('wwglowtop', 0.84)], wide: qn('wwglowwide', 0.8),
  heart: [1315, 423], near: 150, far: 330,
};
