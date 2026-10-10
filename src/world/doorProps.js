// The Door, design audit II's board 9 (2026-10-10) — the numbered points:
// 1 the gable's apex touched the frame's top edge and its finial was cut off:
//   the stand is further back and looks higher, so the whole gable, its
//   finial and a strip of the night over the wall are in the frame;
// 2 the pavement had gone olive-green right across the room — the garden's
//   light was a pool a hundred and fifty units wide laid 22 into the room and
//   a green lamp outside the arch that no wall stopped — it is a tongue now,
//   in the passage and a slab or so beyond the jambs, and the near floor has
//   the lamps' warmth;
// 3 (the lit seam along the right-hand case's foot was the floor's brass
//   fillet: auditFix.js, 1);
// 4 the candles were clean cylinders: they have burnt down unevenly, with a
//   melted crown, runs of wax down their sides and on the pans, a soft halo
//   round each flame, the flames' light on the piers behind, and a flicker;
// 5 the fallen books lay shut, plain and dark, and read as tiles: one lies
//   splayed open with its pale leaves lifting, one has fallen open on its
//   face with its lettered spine up, and one of the shut ones is in vellum;
// 7 the lamp to the left of the portal hung large and bright and took the eye
//   from the doorway: a smaller globe, burning lower, with less halo — its
//   light on the carving is what it was;
// 8 the fallen blocks had rounded arrises all round, like foam: where a block
//   broke fresh its arrises are sharp now, and only its old faces are worn
//   (rubble.js, `crisp`);
// 9 the ladder was cut by the frame's right edge: it stands further along
//   its rail.
//
// ?wdoorprops=old puts all of them back as they were; ?wdoorprops=old:2,7 only those.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from './textures';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wdoorprops');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const doorPropsOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// 1. The stand: how far back along the lane from where it was (38 behind the
// room's middle), and the height it looks at over the same point beyond the
// gate (it was 45). The finial's tip is at 123, which from the old stand was
// eight degrees over the frame's top edge.
export const STAND = { back: qn('wdback', 21), lookY: qn('wdlooky', 61) };

// 2. The garden's light in the room. `pools`: [how far into the room from the
// gate, how wide, how strong] — the first in the passage, the last a slab
// beyond the jambs (which stand 25 in). `lamp`: the green lamp outside the
// arch, its power (it was 3800) and how far out it hangs (it was 14).
// `warm`: what the room's own two lamps lay on the floor (they were 0.12, 0.2).
export const SPILL = {
  pools: [[4, 34, qn('wdgreen', 0.2)], [20, 36, qn('wdgreen', 0.2) * 0.8], [36, 34, qn('wdgreen', 0.2) * 0.42]],
  lamp: { power: qn('wdmoon', 1500), out: 26 },
  warm: { near: qn('wdwarm', 0.2), side: 0.24 },
};

// 7. The lamp to the left of the portal: its globe (it was 9), how hard it
// burns to the eye (1.05), and its halo (0.6). Its light is not touched.
export const SIDE_LAMP = { r: qn('wdlampr', 7), strength: qn('wdlampk', 0.55), haze: qn('wdlamph', 0.4) };

// 9. The ladder on the wall to the right: where along its rail (it was 16).
export const LADDER_U = qn('wdladder', -8);

// 4. The candles. `burn`: how much of each is left, the middle one and the
// four on the arms, for each candelabrum (they were all as they came out of
// the box). `halo`: the glow round each flame, across and how strong.
// `breath`: how much the light they throw on the piers rises and falls.
export const CANDLES = {
  burn: [[0.86, 0.6, 1, 0.74, 0.9], [0.7, 0.95, 0.66, 1, 0.8]],
  halo: { size: qn('wdchalo', 5.2), opacity: qn('wdchaloo', 0.62) },
  breath: 0.06,
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tinted = (g, color, at = null) => {
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(color);
    if (at) at(c, p.getX(i), p.getY(i), p.getZ(i));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
};
// A candle that has been burning: `h` tall and `r` round at its foot (which
// stands at y = 0), its crown melted — a lip round a well the wick stands in,
// higher on one side, and let down where the wax has run over it — and the
// runs themselves down its sides, each ending in a bead, the longest in a
// pool on the pan. Its wax in its vertices' colour: lit warm toward the flame,
// duller toward the pan. `seed`: which candle. `wick`: where the wick stands.
export function candleWax(h, r, seed) {
  const rng = makeRng(seed), R = (a, b) => a + (b - a) * rng();
  const WELL = 0.17, parts = [];
  const prof = [[r * 1.05, 0], [r * 1.04, h * 0.35], [r * 1.01, h - 0.5], [r, h - 0.16], [r * 0.97, h - 0.02], [r * 0.86, h + 0.03], [r * 0.7, h - 0.03], [r * 0.42, h - WELL * 0.78], [0.07, h - WELL], [0, h - WELL]];
  const body = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 18);
  // where it has run: [angle, how far down, how thick]
  const runs = Array.from({ length: 2 + Math.floor(rng() * 3) }, (_, k) => [R(0, Math.PI * 2), k === 0 ? h + 0.3 : R(0.25, 0.9) * h, R(0.085, 0.14)]);
  const lowSide = R(0, Math.PI * 2), slant = R(0.05, 0.13);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rad = Math.hypot(x, z);
    const w = smooth(h - 0.55, h - 0.05, y) * Math.min(1, rad / (r * 0.5));
    if (w <= 0) continue;
    const a = Math.atan2(z, x);
    let dy = -slant * (1 + Math.cos(a - lowSide));
    for (const [ra, , rw] of runs) {
      const da = Math.atan2(Math.sin(a - ra), Math.cos(a - ra));
      dy -= rw * 1.7 * Math.exp(-((da / 0.4) ** 2));
    }
    p.setY(i, y + dy * w);
  }
  body.computeVertexNormals();
  const wax = new THREE.Color('#d3c5a2'), lit = new THREE.Color('#f6dcae'), dull = new THREE.Color('#a79a7c'), fresh = new THREE.Color('#e2d6b6');
  const shade = (c, x, y) => {
    c.lerp(dull, 0.75 * (1 - smooth(0, h * 0.7, y)));
    c.lerp(lit, 0.85 * smooth(h - 1.1, h, y)).multiplyScalar(1 + 0.25 * smooth(h - 0.7, h, y));
  };
  parts.push(tinted(body, wax, shade));
  for (const [a, len, rw] of runs) {
    // a run: thin where it left the lip, fuller down it, a bead at its end
    const y1 = h - 0.1 - slant, y0 = Math.max(0.06, h - len), L = y1 - y0;
    const run = new THREE.LatheGeometry([[0, 0], [rw * 0.55, -0.12 * L], [rw * 0.8, -0.55 * L], [rw, -L + rw * 2.6], [rw * 1.5, -L + rw * 1.3], [rw * 1.25, -L + rw * 0.35], [0, -L]].map(([x, y]) => new THREE.Vector2(x, y)), 7);
    run.scale(1.25, 1, 0.75).rotateY(-a).translate(Math.cos(a) * (r * 1.03 - rw * 0.2), y1, Math.sin(a) * (r * 1.03 - rw * 0.2));
    parts.push(tinted(run, fresh, shade));
    if (h - len <= 0.06) {
      // (it reached the pan, and set there)
      const pool = new THREE.SphereGeometry(1, 9, 6).scale(R(0.26, 0.36), 0.09, R(0.2, 0.28)).rotateY(-a).translate(Math.cos(a) * (r + 0.2), 0.03, Math.sin(a) * (r + 0.2));
      parts.push(tinted(pool, fresh, shade));
    }
  }
  const g = mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q)));
  parts.forEach((q) => q.dispose());
  return { geo: g, wick: h - WELL - slant * 0.5 };
}

// 5. A folio fallen open on its back, splayed, its boards on the floor and
// its leaves standing up out of the gutter, lifting: in its own frame, the
// gutter along z, the floor at y = 0. Comes back as [geometry, 'leather' or
// 'paper'] pieces.
export function splayedBook(seed = 11) {
  const rng = makeRng(seed), R = (a, b) => a + (b - a) * rng();
  const LEN = 4.4, WB = 3.1, WP = WB - 0.22, LP = LEN - 0.34, out = [];
  // each side: which way, how far its board is lifted, how thick its leaves lie
  for (const [side, lift, thick] of [[-1, 0.2, 0.34], [1, 0.09, 0.66]]) {
    out.push([new THREE.BoxGeometry(WB, 0.13, LEN).translate(side * WB / 2, 0.065, 0).rotateZ(side * lift), 'leather']);
    // the leaves lying on it: low in the gutter, a swell beside it, falling to the fore-edge
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(WP, 0);
    sh.lineTo(WP + 0.03, thick * 0.78);
    for (let k = 9; k >= 0; k--) {
      const u = k / 10;
      sh.lineTo(u * WP, thick * (0.3 + 0.7 * smooth(0, 0.3, u)) * (1 - 0.2 * smooth(0.4, 1, u)));
    }
    const block = new THREE.ExtrudeGeometry(sh, { depth: LP, bevelEnabled: false, curveSegments: 1 }).translate(0, 0.13, -LP / 2);
    if (side < 0) block.rotateY(Math.PI);
    out.push([block.rotateZ(side * lift), 'paper']);
  }
  out.push([new THREE.BoxGeometry(0.5, 0.14, LEN).translate(0, 0.05, 0), 'leather']);
  // the leaves lifting: each a sheet bent from the gutter, standing at `a`
  // from the floor and curling over by `curl`
  for (const [a, curl, len] of [[0.5, -0.5, 1], [0.95, -0.75, 0.97], [1.35, -0.55, 1], [1.72, 0.5, 0.98], [2.15, 0.8, 1], [2.55, 0.45, 0.96]]) {
    const W = WP * len, twist = R(-0.12, 0.12), bow = R(0.4, 1.3);
    const leaf = new THREE.BoxGeometry(W, 0.028, LP * R(0.985, 1), 12, 1, 1);
    const p = leaf.attributes.position;
    // (the curve it follows, walked out from the gutter)
    const cx = [0], cy = [0.34], th = [];
    for (let k = 0; k <= 12; k++) {
      th.push(a + curl * (k / 12) ** bow + R(-0.02, 0.02));
      if (k < 12) { cx.push(cx[k] + Math.cos(th[k]) * W / 12); cy.push(cy[k] + Math.sin(th[k]) * W / 12); }
    }
    for (let i = 0; i < p.count; i++) {
      const s = p.getX(i) / W + 0.5, k = Math.min(12, Math.round(s * 12)), y = p.getY(i), z = p.getZ(i);
      const t = th[k] + twist * (z / LP) * s;
      p.setXYZ(i, cx[k] - Math.sin(t) * y, Math.max(0.2, cy[k] + Math.cos(t) * y), z);
    }
    leaf.computeVertexNormals();
    out.push([leaf, 'paper']);
  }
  return out;
}
// And one fallen open on its face: its boards a tent, its leaves hanging in
// it, its spine uppermost — the ridge along z, the floor at y = 0. `spine`:
// where the lettered spine lies along the ridge ([its middle's height, its
// width, its length]), for the books' own material to draw.
export function tentBook() {
  const LEN = 4.6, WB = 3.2, FALL = 0.66, out = [];   // FALL: each board's lean from upright
  const HR = WB * Math.cos(FALL);
  for (const side of [-1, 1]) {
    const lay = (g) => g.rotateZ(-side * (Math.PI / 2 - FALL)).translate(0, HR, 0);
    out.push([lay(new THREE.BoxGeometry(WB, 0.13, LEN).translate(side * WB / 2, 0, 0)), 'leather']);
    out.push([lay(new THREE.BoxGeometry(WB - 0.25, 0.3, LEN - 0.3).translate(side * (WB / 2 + 0.02), -0.215, 0)), 'paper']);
  }
  return { parts: out, spine: [HR + 0.03, 0.8, LEN] };
}
