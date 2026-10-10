// The Vertigo's rail: iron and walnut (2026-10-07).
//
// "Please generate suggestions for a railing, it does not look very appealing
// at the moment. It should match the overall atmosphere, be ornate but not too
// much as to steal the attention from the rest of the scene." What there was:
// round the pit's mouth a plain bronze box 85 cm high, cut off square where the
// stair begins (from the doorway it stood in the frame as a block), and down
// the stair a six-sided bronze tube on squat bulbs, with a stone bollard and a
// ball for a newel. Shown four rails built in the tour (the Vestibule's bronze
// vases, iron and walnut, wrought-iron lyres, a hexagon fret: the Design
// canvas's Round 5), the user chose this one: how a library's stair is railed.
// Square iron bars, every other one twisted between two collars, on an iron
// shoe and under an iron core, carrying a walnut handrail in the bookcases'
// own wood; a turned walnut newel at the stair's head and iron posts with
// walnut caps where the rail turns. The dark iron goes back into the dark of
// the well, and what the eye follows round the mouth and down every turn is
// the warm line of the handrail.
//
// It is laid as one rail: round the pit's mouth on the floor, along the
// landing at the stair's head to its newel, and down the stair's open edge
// but for the gaps where it has given way (the fall: one every turn, at the
// same bearing, spiral.js GAPS); and down every turn of
// the endless stair below (spiral.js), whose turns are one geometry, reused.
// Nothing here draws on the world's random stream. (?wvrail=old: the rail as
// it was.)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
export const VRAIL_OLD = Q.get('wvrail') === 'old';
// ?wvland=old: the stair's head as it was, the pit open beside its newel
export const VLAND_OLD = Q.get('wvland') === 'old';

// The handrail's top over what is walked on: 99 cm, over the floor and over
// each tread's middle.
const H = 10.5;
// (mouldGeo lays its uv at the carving's scale, 1/13 a unit; the wood is laid
// in units, its grain along u)
const CARVE = 13;
// a bar every 22 cm, and the first 15 cm clear of a newel
const SPACING = 2.3, CLEAR = 1.6;

// ── Sections, [across, up, sharp] ───────────────────────────────────────────
const box = (half, h, y = 0) => [[-half, y, true], [half, y, true], [half, y + h, true], [-half, y + h, true]];
// drawn as the right half from its foot to the top of its middle, and mirrored
const mirrored = (right) => [...right, ...[...right].reverse().filter(([z]) => z > 1e-6).map(([z, y, s]) => [-z, y, s])];
// The handrail: a toad's back, a bead each side and a flat under it, 20 cm
// across, its top at the rail's top.
const WALNUT_RAIL = mirrored([
  [0.5, -1.28, true], [0.5, -1.08, true], [0.88, -1.02], [1.06, -0.86], [1.06, -0.66], [0.96, -0.56], [1.02, -0.44], [0.94, -0.24], [0.72, -0.09], [0.4, -0.01], [0, 0],
]);
// the iron it rests on, and the shoe the bars stand in (wider on the floor)
const CORE = box(0.36, 0.32, -1.6), SHOE_LEVEL = box(0.5, 0.5), SHOE_STAIR = box(0.42, 0.4);
const SHOE = { level: 0.5, stair: 0.4 };

// ── Little geometries ───────────────────────────────────────────────────────
const V2 = (x, y) => new THREE.Vector2(x, y);
// wood laid as a turner or joiner cuts it: grain (u) up a post, along a level
// face's longer side
const woodUv = (geo) => {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const up = Math.abs(nor.getY(i)) > 0.7;
    uv[i * 2] = up ? x : y;
    uv[i * 2 + 1] = up ? z : Math.abs(nor.getX(i)) > Math.abs(nor.getZ(i)) ? z : x;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
};
const lathe = (prof, n) => new THREE.LatheGeometry(prof.map(([r, y]) => V2(r, y)), n);
// A square bar a unit high, twisted a turn and a half between two collars
// (stood up and stretched to its height where it is set).
const twistedBar = (segs = 48) => {
  const bar = new THREE.BoxGeometry(0.4, 1, 0.4, 1, segs, 1).translate(0, 0.5, 0);
  const p = bar.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), f = Math.min(1, Math.max(0, (y - 0.16) / 0.68)), a = f * f * (3 - 2 * f) * 3 * Math.PI;
    const x = p.getX(i), z = p.getZ(i);
    p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a));
  }
  bar.computeVertexNormals();
  const parts = [bar, ...[0.13, 0.84].map((y) => new THREE.BoxGeometry(0.58, 0.035, 0.58).translate(0, y + 0.0175, 0))];
  const g = mergeGeometries(parts);
  parts.forEach((q) => q.dispose());
  return g;
};
const plainBar = () => new THREE.BoxGeometry(0.3, 1, 0.3).translate(0, 0.5, 0);
const placed = (geo, x, y, z) => geo.translate(x, y, z);

// ── Runs ────────────────────────────────────────────────────────────────────
// A run is a line of points { x, z, base (the bars' feet), top (the rail's
// top), level }, measured along in plan (s), with `knots` where it turns or
// ends (newels).
const measure = (pts) => {
  let s = 0;
  return pts.map((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); return { ...p, s }; });
};
const helixRun = ({ at, tread, base }, t0, t1, samples) => {
  const n = Math.max(2, Math.ceil((t1 - t0) * samples));
  return measure(Array.from({ length: n + 1 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / n, [x, z] = at(t);
    return { x, z, base: base(t), top: tread(t) + H, level: false };
  }));
};
const at = (run, s) => {
  let lo = 0, hi = run.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (run[m].s <= s) lo = m; else hi = m; }
  const a = run[lo], b = run[hi], f = b.s > a.s ? Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s))) : 0, L = b.s - a.s || 1;
  const lerp = (k) => a[k] + (b[k] - a[k]) * f;
  return { x: lerp('x'), z: lerp('z'), base: lerp('base'), top: lerp('top'), tx: (b.x - a.x) / L, tz: (b.z - a.z) / L, level: a.level };
};
// the bars along every stretch between knots, `clear` from them: alternately
// twisted and plain, each plumb from its shoe to the core and turned square
// to the run
const barsOf = (runs, clear) => {
  const twist = [], plain = [];
  for (const { run, knots } of runs) {
    for (let k = 0; k + 1 < knots.length; k++) {
      const a = knots[k] + clear, L = knots[k + 1] - clear - a;
      if (L <= 0) continue;
      const n = Math.max(1, Math.round(L / SPACING));
      for (let i = 0; i <= n; i++) {
        const p = at(run, a + (L * i) / n), y0 = p.base + (p.level ? SHOE.level : SHOE.stair), y1 = p.top - 1.6;
        (i % 2 ? plain : twist).push({ p: [p.x, y0, p.z], s: [1, y1 - y0, 1], rot: [0, Math.atan2(-p.tz, p.tx), 0] });
      }
    }
  }
  return { twist, plain };
};
// the shoe, the core and the handrail swept along every run
const members = (runs, mouldGeo, iron, wood) => {
  for (const { run } of runs) {
    const path = (from) => run.map((p) => [p.x, from === 'top' ? p.top : p.base, p.z]);
    iron.add(mouldGeo(path('base'), run[0].level ? SHOE_LEVEL : SHOE_STAIR));
    iron.add(mouldGeo(path('top'), CORE));
    const g = mouldGeo(path('top'), WALNUT_RAIL), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * CARVE, uv.getY(i) * CARVE);
    wood.add(g);
  }
};

// ── The rail ────────────────────────────────────────────────────────────────
// `level`: the run round the pit's mouth and along the landing, [x, z] from
// the rail's end beside the stair round to the stair's newel, with `corners`
// (indices) where it turns (and `toHead` false if it stops short of the
// newel, on a post); `floor` its height. `helix`: the stair's open
// edge, `at(t)` the rail's line, `tread(t)` and `base(t)` (the top of the open
// string the bars stand on) at a fraction t of the way down, in `runs`
// between the gap where the rail has gone. `head`: the newel's place at the
// stair's head. The rest are buildWorld's.
export function buildVertigoRail({ level, corners, toHead = true, floor, helix, head, newBatch, M, instances, mouldGeo }) {
  const iron = newBatch(M.iron), wood = newBatch(M.shelf);
  const flat = measure(level.map(([x, z]) => ({ x, z, base: floor, top: floor + H, level: true })));
  const stairs = helix.runs.map(([t0, t1]) => helixRun(helix, t0, t1, helix.samples));
  const runs = [
    { run: flat, knots: [0, ...corners.map((i) => flat[i].s), flat.at(-1).s] },
    ...stairs.map((run) => ({ run, knots: [0, run.at(-1).s] })),
  ];
  members(runs, mouldGeo, iron, wood);
  const { twist, plain } = barsOf(runs, CLEAR);
  instances(twistedBar(), M.iron, twist, { chunked: true, name: 'vrail-twist' });
  instances(plainBar(), M.iron, plain, { chunked: true, name: 'vrail-bars' });
  // where the rail turns and where it ends beside the stair: an iron post,
  // capped in walnut, an acorn on the cap
  for (const p of [0, ...corners, ...(toHead ? [] : [flat.length - 1])].map((i) => flat[i])) {
    const h = p.top - p.base;
    iron.add(placed(new THREE.BoxGeometry(0.85, h, 0.85), p.x, p.base + h / 2, p.z));
    wood.add(woodUv(placed(new THREE.BoxGeometry(1.5, 0.55, 1.5), p.x, p.top + 0.27, p.z)));
    wood.add(woodUv(placed(lathe([[0, 0], [0.55, 0], [0.62, 0.25], [0.45, 0.55], [0.18, 0.8], [0, 0.85]], 12), p.x, p.top + 0.55, p.z)));
  }
  // The stair's newel: a walnut post, its foot square, turned above it into
  // a vase and a ring, capped, and an acorn on the cap.
  const [hx, hz] = head, hy = helix.base(0);
  const top = helix.tread(0) + H, foot = 5.6, T = top - hy - foot - 0.3;
  wood.add(woodUv(placed(new THREE.BoxGeometry(2.5, foot + 2, 2.5), hx, hy - 2 + (foot + 2) / 2, hz)));
  wood.add(woodUv(placed(new THREE.BoxGeometry(2.8, 0.45, 2.8), hx, hy + foot - 0.1, hz)));
  wood.add(woodUv(placed(lathe([
    [1.05, 0], [1.1, 0.25], [0.85, 0.5], [0.75, 0.9], [0.95, 1.6], [1.0, 2.0], [0.8, 2.5], [0.65, T - 1.0],
    [0.95, T - 0.75], [0.95, T - 0.45], [0.75, T - 0.3], [0.8, T], [0, T],
  ], 16), hx, hy + foot + 0.1, hz)));
  wood.add(woodUv(placed(new THREE.BoxGeometry(2.3, 0.6, 2.3), hx, top + 0.1, hz)));
  wood.add(woodUv(placed(lathe([[0, 0], [0.7, 0], [0.78, 0.2], [0.55, 0.4], [0.62, 0.62], [0.82, 1.0], [0.78, 1.45], [0.5, 1.85], [0.18, 2.1], [0, 2.15]], 14), hx, top + 0.4, hz)));
  // Where it gave way the rail just stops, the walnut rounded off at each end.
  for (const p of stairs.flatMap((run, i) => [i > 0 ? run[0] : null, i < stairs.length - 1 ? run.at(-1) : null]).filter(Boolean)) {
    wood.add(woodUv(placed(new THREE.SphereGeometry(0.9, 12, 8).scale(1, 0.75, 1), p.x, p.top - 0.55, p.z)));
  }
  iron.flush('vrailIron');
  wood.flush('vrailWood');
}

// One turn of the same rail for the endless stair under the last tread
// (spiral.js `rail`), in a turn's own frame: the pit's axis at the origin, the
// turn starting at `angle0` on the rail's line and dropping `pitch` round it.
// Its treads have no carriage, so the open string the bars stand in comes
// down with them: the stair's string and the roll along its top. Each turn's
// bars are merged with its iron, so the body feels them as it does the rail.
// Returns [geometry, material, name] for each part.
// (sampled more coarsely than the stair above: its eight turns are drawn
// together, and seen, if at all, by a reader walking on down past the end)
// `gap`: [u0, u1], where in the turn the rail has given way, as it has at the
// same bearing on every turn above (spiral.js GAPS) — or null.
export function endlessRail({ edge, pitch, angle0, gap = null, mouldGeo, M, carved, samples = 120 }) {
  const r = edge - 0.9, TAU = Math.PI * 2;
  const helix = {
    at: (u) => [Math.cos(angle0 + u * TAU) * r, Math.sin(angle0 + u * TAU) * r],
    tread: (u) => 1.5 - u * pitch, base: (u) => 2.2 - u * pitch,
  };
  // (the string the bars stand in runs on under the gap: it is the stair's)
  const whole = helixRun(helix, 0, 1, samples);
  const runs = (gap ? [[0, gap[0]], [gap[1], 1]] : [[0, 1]])
    .map(([u0, u1]) => helixRun(helix, u0, u1, samples))
    .map((run) => ({ run, knots: [0, run.at(-1).s] }));
  const into = () => { const list = []; return { list, add: (g) => list.push(g.index ? g.toNonIndexed() : g) }; };
  const iron = into(), wood = into(), stone = into();
  members(runs, mouldGeo, iron, wood);
  // Where it gave way the rail just stops, the walnut rounded off at each end.
  if (gap) {
    for (const p of [runs[0].run.at(-1), runs[1].run[0]]) {
      wood.add(woodUv(placed(new THREE.SphereGeometry(0.9, 12, 8).scale(1, 0.75, 1), p.x, p.top - 0.55, p.z)));
    }
  }
  // (spaced from the turn's ends by half a bar's spacing, so the turns meet
  // with the bars running on evenly)
  const { twist, plain } = barsOf(runs, SPACING / 2), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const bar = { twist: twistedBar(12), plain: plainBar() };
  for (const [kind, list] of [['twist', twist], ['plain', plain]]) {
    for (const it of list) iron.add(bar[kind].clone().applyMatrix4(m4.compose(new THREE.Vector3(...it.p), q.setFromEuler(e.set(...it.rot)), new THREE.Vector3(...it.s))));
  }
  bar.twist.dispose();
  bar.plain.dispose();
  // the string, from under the tread's top up to the bars' feet, and its roll
  // (a section's `across` points inward from the rail's line)
  const line = whole.map((p) => [p.x, p.base, p.z]);
  stone.add(mouldGeo(line, [[-1.5, -5.2, true], [0.9, -5.2, true], [0.9, 0, true], [-1.5, 0, true]]));
  stone.add(mouldGeo(line, Array.from({ length: 10 }, (_, k) => [0.35 + Math.cos((k * Math.PI) / 5) * 1.15, 0.1 + Math.sin((k * Math.PI) / 5) * 1.0])));
  const merged = (parts) => { const g = mergeGeometries(parts.list, false); parts.list.forEach((p) => p.dispose()); return g; };
  return [[merged(stone), carved, 'carved'], [merged(iron), M.iron, 'vrailIron'], [merged(wood), M.shelf, 'vrailWood']];
}
