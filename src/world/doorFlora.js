// The garden coming into the Door (2026-10-15; from a canvas of three the
// user chose b). The green stopped at the arch: ivy up its garden face and a little
// way in along the passage, moss in the joints by the threshold, leaves blown
// in — and then the Library's floor, clean. A garden that has broken a wall
// down does not stop at the line where the wall stood. So the ivy comes on
// in: along the cracks the fall opened in the pavement, which is where a root
// finds earth and water; up the room's face of the arch; and, in the last of
// the three, up the ends of the cases beside it. Grass and seedlings stand in
// the cracks.
//   a  in the cracks       tufts in the cracks near the threshold, a few
//                          short runners along the widest, the passage's ivy
//                          halfway through
//   b  over the threshold  the runners in to the middle of the room, the ivy
//                          up the room's face of the jambs and piers and
//                          hanging from the arch, through the passage
//   c  taken back          over the gable, up the ends of the cases beside
//                          the arch, the runners branching, tufts across the
//                          floor
// ?wflora=a|c puts one of the other two in its place; ?wflora=old is the
// Door as it was.
//
// All of it in the arch's frame (portal.js): x along the wall, y up, z into
// the room. The cracks' frame (cracks.js) has the same axes, its origin 1.5
// along: x = along − 1.5, z = into. Drawn from its own streams, never the
// world's.
import * as THREE from 'three';
import { crackFields } from './cracks';
import { PORTAL } from './portal';
import { CRACK_LINES } from './doorCrackLines';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

// `tufts`: how far into the room grass stands in the cracks, and how close
// together along them; `runners`: how far in the ivy runs along the cracks,
// which generations of crack it takes (0 the main ones), how many; `face`:
// how high it climbs the room's face of the arch, left and right (0: not at
// all), and its leaf budget; `reveal`: how far through the passage the
// garden face's ivy goes (into the room, from the wall's garden face);
// `cases`: up the case ends either side, how high; `hang`: strands from the
// arch's inner edge.
export const FLORAS = {
  a: { tufts: [45, 2.6], runners: { reach: 14, gens: [0], max: 4 }, face: null, reveal: 14, cases: 0, hang: 0 },
  b: { tufts: [72, 2.0], runners: { reach: 44, gens: [0], max: 7 }, face: { left: 42, right: 30, max: 1500 }, reveal: 25, cases: 0, hang: 5 },
  c: { tufts: [118, 1.5], runners: { reach: 84, gens: [0, 1], max: 16 }, face: { left: 104, right: 80, max: 3600 }, reveal: 25, cases: 62, hang: 9 },
};
const PICK = Q.get('wflora') ?? 'b';
export const FLORA = FLORAS[PICK] ?? FLORAS.b;

// The crack lines, in the arch's frame: [{ gen, pts: [x, z, half width] }].
// Painting them takes a second and a half (crackFields, the floor's map's own
// painting), so they are painted once ahead of time (tools/crack-lines.mjs,
// doorCrackLines.js) and read from there while the settings they were painted
// from are still the cracks' own (`crackKey`); if not, painted here.
export const crackKey = (cracks) => {
  const s = JSON.stringify(cracks);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
};
export function crackLines(cracks, { fresh = false } = {}) {
  if (!fresh && CRACK_LINES.key === crackKey(cracks)) {
    return CRACK_LINES.lines.map(([gen, flat]) => {
      const pts = [];
      for (let i = 0; i < flat.length; i += 3) pts.push([flat[i], flat[i + 1], flat[i + 2]]);
      return { gen, pts };
    });
  }
  if (!fresh) console.warn('[flora] the cracks have changed since their lines were written: run node tools/crack-lines.mjs');
  const { lines } = crackFields(cracks);
  return lines.map(({ pts, gen }) => {
    const out = [];
    for (let i = 0; i < pts.length; i += 4) out.push([pts[i] - 1.5, pts[i + 1], pts[i + 2]]);
    return { gen, pts: out };
  });
}

// Leaves along a run of stem nodes ({ p, n }), as growIvy sets them: on
// stalks either side, turned out from what the stem lies on and toward
// `light`, big on the old stem and small at the growing tip.
export function leavesAlong(nodes, rng, { light = new THREE.Vector3(0, 1, 0), scale = 1, hang = new THREE.Vector3(0, 1, 0), spacing = 1 } = {}) {
  const R = (a, b) => a + (b - a) * rng();
  const leaves = [];
  const T = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3(), tip = new THREE.Vector3(), X = new THREE.Vector3(), m = new THREE.Matrix4();
  let along = R(0, 0.6), side = rng() < 0.5 ? 1 : -1, run = 0;
  const total = nodes.length;
  for (let k = 1; k < total; k++) {
    const a = nodes[k - 1], b = nodes[k];
    run += a.p.distanceTo(b.p);
    while (run >= along) {
      const f = k / (total - 1);
      T.subVectors(b.p, a.p).normalize();
      N.copy(b.n);
      S.crossVectors(N, T).normalize();
      side = -side;
      const young = f > 0.8;
      const size = (young ? R(0.5, 0.8) : R(0.85, 1.35)) * scale;
      const stalk = size * R(0.45, 0.9);
      const base = b.p.clone().addScaledVector(N, stalk * 0.45).addScaledVector(S, side * stalk * 0.55).addScaledVector(T, stalk * 0.1);
      const face = N.clone().addScaledVector(light, R(0.25, 0.6)).addScaledVector(S, side * R(0, 0.3));
      face.x += R(-0.25, 0.25); face.y += R(-0.2, 0.2); face.z += R(-0.25, 0.25);
      face.normalize();
      tip.copy(hang).multiplyScalar(-0.75).addScaledVector(S, side * R(0.3, 0.9)).addScaledVector(T, R(-0.2, 0.3));
      tip.addScaledVector(face, -tip.dot(face));
      if (tip.lengthSq() < 1e-4) tip.copy(S);
      tip.normalize();
      X.crossVectors(tip, face).normalize();
      m.makeBasis(X, tip, face);
      leaves.push({ p: base, q: new THREE.Quaternion().setFromRotationMatrix(m), s: size * R(0.92, 1.08), young, f });
      along += R(0.5, 0.78) * (young ? 0.8 : 1) * spacing;
    }
  }
  return leaves;
}

// Ivy along the cracks: in from the threshold on the main cracks, lying in
// the gap and a little either side of it as a stem does, thinning to its tip.
export function crackRunners(lines, opt, rng) {
  const R = (a, b) => a + (b - a) * rng();
  const F = PORTAL.FLOOR, stems = [], leaves = [];
  const up = new THREE.Vector3(0, 1, 0);
  // the widest first, the ones that start at the breach
  const cands = lines.filter((l) => opt.gens.includes(l.gen) && l.pts.length > 20 && l.pts[0][1] < (l.gen ? opt.reach : 12))
    .sort((p, q) => q.pts[0][2] - p.pts[0][2]).slice(0, opt.max);
  for (const line of cands) {
    const reach = opt.reach * R(0.6, 1.1);
    const nodes = [];
    let last = null, wob = R(0, 6.28);
    for (const [x, z, hw] of line.pts) {
      if (z > reach) break;
      if (last && Math.hypot(x - last[0], z - last[1]) < 0.55) continue;
      wob += R(0.3, 0.8);
      const off = Math.sin(wob) * Math.max(0.15, hw * 1.4);
      nodes.push({ p: new THREE.Vector3(x + off * 0.5, F, z - off * 0.5), n: up.clone() });
      last = [x, z];
    }
    if (nodes.length < 4) continue;
    const total = nodes.length, r0 = R(0.11, 0.17) * (line.gen ? 0.7 : 1);
    nodes.forEach((nd, k) => {
      nd.r = 0.04 + (r0 - 0.04) * (1 - k / (total - 1)) ** 1.3;
      nd.p.y += nd.r * 0.7;
    });
    stems.push(nodes);
    leaves.push(...leavesAlong(nodes, rng, { scale: 0.85, spacing: 1.15, light: new THREE.Vector3(0, 1, 0.3).normalize() }));
  }
  return { stems, leaves };
}

// Grass and seedlings standing in the cracks: a tuft every so far along each,
// fewer the further in from the breach, each a few thin blades leaning out of
// the gap. One geometry, coloured by vertex.
const BLADES = ['#4a6b2c', '#3d5c26', '#5a7a34', '#2f4a22', '#66863a', '#6b7a3a'];
export function crackTufts(lines, [reach, every], rng, toWorld) {
  const R = (a, b) => a + (b - a) * rng();
  const F = PORTAL.FLOOR;
  const pos = [], col = [], nrm = [];
  const c = new THREE.Color();
  const blade = (x, z, h, lean, turn, w, shade) => {
    // a blade: a tapered strip, bent over as it rises (5 points up it)
    const dx = Math.cos(turn), dz = Math.sin(turn), sx = -dz, sz = dx;
    const ring = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4, bend = lean * t * t * h;
      ring.push([x + dx * bend, F + h * t * (1 - 0.25 * lean * t), z + dz * bend, w * (1 - t) ** 0.8]);
    }
    c.set(BLADES[Math.floor(rng() * BLADES.length)]).multiplyScalar(shade);
    for (let i = 0; i < 4; i++) {
      const [x0, y0, z0, w0] = ring[i], [x1, y1, z1, w1] = ring[i + 1];
      const quad = [[x0 - sx * w0, y0, z0 - sz * w0], [x0 + sx * w0, y0, z0 + sz * w0], [x1 + sx * w1, y1, z1 + sz * w1], [x1 - sx * w1, y1, z1 - sz * w1]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const p = toWorld(quad[k]);
        pos.push(p.x, p.y, p.z);
        // (a blade's light is the sky's: its normal more up than out)
        nrm.push(dx * 0.35, 0.9, dz * 0.35);
        const dark = i === 0 ? 0.55 : 1;
        col.push(c.r * dark, c.g * dark, c.b * dark);
      }
    }
  };
  for (const { pts } of lines) {
    let next = R(0, every);
    let s = 0, prev = null;
    for (const [x, z, hw] of pts) {
      if (prev) s += Math.hypot(x - prev[0], z - prev[1]);
      prev = [x, z];
      if (s < next || z > reach || hw < 0.012) continue;
      // fewer the further in, and not on every one
      next = s + every * R(0.6, 1.6) * (1 + z / reach);
      if (rng() < z / reach * 0.6) continue;
      const n = 3 + Math.floor(rng() * 6), shade = R(0.75, 1.1);
      const tall = R(0.5, 1.5) * (1.15 - 0.5 * z / reach);
      for (let k = 0; k < n; k++) {
        blade(x + R(-0.12, 0.12), z + R(-0.12, 0.12), tall * R(0.55, 1.1), R(0.2, 0.9), R(0, 6.28), R(0.035, 0.07), shade);
      }
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// The sheets the ivy grows over on the room's side, for growIvy: the room's
// face of the arch (cast toward the wall), and the case ends either side.
export function roomSheets(opt, R) {
  const F = PORTAL.FLOOR, HW = PORTAL.HW;
  const opening = (u, v, a) => Math.abs(u) < HW + a && v < PORTAL.soffitAt(u, a) + 0.4;
  const sheets = [];
  if (opt.face) {
    const { left, right, max } = opt.face;
    sheets.push({
      ray: (u, v, o, d) => { o.set(u, v, 40); d.set(0, 0, -1); }, far: 48,
      light: new THREE.Vector3(0, 1, 0.6).normalize(), max, fork: 0.09,
      allow: (u, v) => Math.abs(u) < 33 && v > F - 1 && !opening(u, v, 0.8)
        && v < (u < 0 ? left - Math.max(0, -u - 20) * 0.6 : right - Math.max(0, u - 20) * 0.6),
      seeds: [
        ...[-14.5, -17, -21, -25.5, -30].map((u) => [u + R(-0.6, 0.6), F + 0.2, R(-0.3, 0.3), left * R(0.8, 1.15), R(0.7, 1)]),
        ...[14.5, 18, 23, 29].map((u) => [u + R(-0.6, 0.6), F + 0.2, R(-0.3, 0.3), right * R(0.75, 1.1), R(0.55, 0.85)]),
      ],
    });
  }
  if (opt.cases) {
    for (const sd of [-1, 1]) {
      const h = opt.cases * (sd < 0 ? 1 : 0.8);
      sheets.push({
        ray: (u, v, o, d) => { o.set(sd * u, v, 40); d.set(0, 0, -1); }, far: 40, scale: 0.9,
        light: new THREE.Vector3(0, 1, 0.6).normalize(), max: 900, drift: 0.15 * sd,
        allow: (u, v) => u > 33 && u < 46 && v > F - 1 && v < h - (u - 33) * 1.5,
        seeds: [34, 37, 41].map((u) => [u + R(-0.5, 0.5), F + 0.2, 0.2, h * R(0.6, 1), R(0.5, 0.8)]),
      });
    }
  }
  return sheets;
}
// The cases' ends beside the arch, as stone to grow on (where they stand: 12.7
// in front of the wall, from 33 out to 46 either side).
export const caseFaces = () => [-1, 1].map((sd) => new THREE.PlaneGeometry(14, 100).translate(sd * 39.5, 50, 12.7));

// ── Rooted in the garden (2026-10-16) ─────────────────────────────────────────
// "Those ivy branches look like they grow from the ceiling … I want them to
// actually come from the garden, not end in the nowhere." What the garden sent
// in began where it was seen: strands out of the arch's soffit, runners at the
// door line, the room face's stems at the foot of its plinths. Each is now the
// far end of a stem that runs back out to the garden: a strand's over the
// garden face (along the ring of voussoirs, out of the ivy on it) and in along
// the passage's soffit; the runners' and the room face's across the threshold
// out of the ground beyond the wall.
const UP = new THREE.Vector3(0, 1, 0);
// A stem laid on the stone along a run of rays ([o, d] a step apart), each
// finding what it lies on; `miss` where it lies when a ray finds nothing.
function layStem(caster, rays, { far = 30, miss = null } = {}) {
  const nodes = [];
  let prev = null;
  for (const [o, d] of rays) {
    const h = caster.cast(o, d, far) ?? miss?.(o, d);
    if (!h) continue;
    // over an arris: a node at the corner, so the stem does not cut it
    const jump = prev ? h.t - prev.h.t : 0;
    if (Math.abs(jump) > 0.3) {
      const [ro, rd] = jump < 0 ? [prev.o, prev.d] : [o, d];
      nodes.push({ p: ro.clone().addScaledVector(rd, Math.min(prev.h.t, h.t)), n: (jump < 0 ? h.n : prev.h.n).clone().sub(rd).normalize() });
    }
    nodes.push({ p: h.p.clone(), n: h.n.clone() });
    prev = { o: o.clone(), d: d.clone(), h };
  }
  return nodes;
}
// thick at its first node to thin at its last, lying its own thickness off the stone
const settle = (nodes, r0, r1, lift = 0.9) => nodes.forEach((nd, k) => {
  nd.r = r1 + (r0 - r1) * (1 - k / Math.max(1, nodes.length - 1)) ** 1.2;
  nd.p.addScaledVector(nd.n, nd.r * lift + 0.04);
});
// The ground under a ray that finds no stone: the room's floor; beyond the
// wall the garden's, lower — the gravel of the way under the pergola (5.2),
// and the grass either side of it (4, from 9.5 out; measured by raycast).
const groundAt = (x, z) => (z > -PORTAL.WALL - 0.6 ? PORTAL.FLOOR : 5.2 - 1.2 * Math.min(1, Math.max(0, (Math.abs(x) - 8.5) / 1)));
const floorMiss = (o, d) => {
  if (d.y >= 0) return null;
  const y = groundAt(o.x, o.z);
  return { p: new THREE.Vector3(o.x, y, o.z), n: UP.clone(), t: o.y - y };
};
// Rays down onto the floor along a path of plan points [x, z], a step apart.
function downRays(plan, step = 0.55) {
  const curve = new THREE.CatmullRomCurve3(plan.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.max(2, Math.round(curve.getLength() / step));
  return curve.getSpacedPoints(n).map((p) => [new THREE.Vector3(p.x, PORTAL.FLOOR + 4, p.z), new THREE.Vector3(0, -1, 0)]);
}

// The arch's curves about their centres: a point `r` from the centre of the
// arc on `u`'s side, at angle `th` up from the springing.
const arcPoint = (s, th, r) => [-s * PORTAL.CEN + s * r * Math.cos(th), PORTAL.SPR + r * Math.sin(th)];
const arcAngle = (u, a) => Math.atan2(PORTAL.soffitAt(u, a) - PORTAL.SPR, Math.abs(u) + PORTAL.CEN);
// A hanging strand's stem, back from where it hangs (over `u`, `a` out from
// the intrados) to the ivy on the garden face: up the ring of voussoirs from
// low on its side (`from` high), where the ivy climbing the face reaches it,
// round to `u`, down over the ring's edge, and (`into` given, a depth in the
// room) into the splay and along the soffit to there. Returns the nodes (in
// the arch's frame, from the garden end) and the leaves along them.
export function strandFeeder(caster, u, a, rng, { into = null, from = 60 } = {}) {
  const R = (lo, hi) => lo + (hi - lo) * rng();
  const { WALL: W, R0, SPR } = PORTAL, GARDEN = 4.5, s = Math.sign(u) || 1;
  const thU = arcAngle(u, a), ring = R0 + GARDEN + R(1.8, 3);
  const th0 = Math.min(thU, Math.asin(Math.min(1, Math.max(0, (from - SPR) / ring))));
  const faceRays = [], wob = R(0, 6.28);
  // round the ring, then in across it to its inner edge (a ray each: from the garden, square to the wall)
  const along = Math.max(1, Math.round(((thU - th0) * ring) / 0.55));
  for (let i = 0; i <= along; i++) {
    const th = th0 + (thU - th0) * (i / along), [x, y] = arcPoint(s, th, ring + Math.sin(wob + i * 0.4) * 0.35);
    faceRays.push([new THREE.Vector3(x, y, -W - 14), new THREE.Vector3(0, 0, 1)]);
  }
  for (let r = ring - 0.55; r > R0 + GARDEN + 0.35; r -= 0.55) {
    const [x, y] = arcPoint(s, thU, r);
    faceRays.push([new THREE.Vector3(x, y, -W - 14), new THREE.Vector3(0, 0, 1)]);
  }
  const face = layStem(caster, faceRays, { far: 20 });
  let nodes = face;
  if (into !== null) {
    // over the inner edge and along the underside of the passage, a ray out from the arc's centre at each depth
    const [cx, cy] = arcPoint(s, thU, R0 + GARDEN + 0.15);
    const [ox, oy] = arcPoint(s, thU, R0 - 8);
    const dir = new THREE.Vector3(cx - ox, cy - oy, 0).normalize();
    const soffitRays = [];
    for (let z = -W + 0.25; z <= into; z += 0.55) soffitRays.push([new THREE.Vector3(ox, oy, z), dir.clone()]);
    const under = layStem(caster, soffitRays, { far: 16 });
    nodes = [...face, { p: new THREE.Vector3(cx, cy, -W - 0.15), n: dir.clone().negate().add(new THREE.Vector3(0, 0, -1)).normalize() }, ...under];
  }
  if (nodes.length < 3) return null;
  settle(nodes, R(0.16, 0.2), 0.1);
  // leaves: out from the face toward the garden's light; under the soffit, few, hanging
  const onFace = nodes.slice(0, face.length + 1), under = nodes.slice(face.length);
  const leaves = leavesAlong(onFace, rng, { light: new THREE.Vector3(0, 1, -0.5).normalize(), scale: 0.95 });
  if (under.length > 2) {
    leaves.push(...leavesAlong(under, rng, { light: new THREE.Vector3(0, -1, -0.3).normalize(), scale: 0.8, spacing: 1.7 })
      .filter((lf) => lf.p.z < -W + 4 || lf.p.z > -2 || rng() < 0.45));
  }
  leaves.forEach((lf) => { lf.young = false; });
  return { nodes, leaves };
}
// Hang `hung` (hangIvy's) off the end of its feeder: one stem, its thickness
// carried on down the strand.
export function joinStrand(feeder, hung) {
  const r1 = feeder.nodes[feeder.nodes.length - 1].r, tail = hung.nodes.slice(1);
  tail.forEach((nd, k) => { nd.r = 0.04 + (r1 - 0.04) * (1 - (k + 1) / tail.length); });
  return { nodes: [...feeder.nodes, ...tail], leaves: [...feeder.leaves, ...hung.leaves] };
}

// Where the garden's stems come in across the threshold: out of the grass
// beside the gravel way a few paces beyond the wall, over the gravel to one
// of three places at the threshold (a clump of stems at each), in across the
// threshold stone, and to `to`.
const ENTRIES = [-6.5, 1, 7.5];
function leadPlan(to, rng, { entry = null } = {}) {
  const R = (lo, hi) => lo + (hi - lo) * rng();
  const W = PORTAL.WALL, e = entry ?? ENTRIES.reduce((b, x) => (Math.abs(x - to[0]) < Math.abs(b - to[0]) ? x : b));
  const side = Math.abs(e) > 3 ? Math.sign(e) : rng() < 0.5 ? -1 : 1;
  return [
    [side * R(11, 14), -W - R(5, 10)],
    [side * R(9.5, 10.5), -W - R(3.5, 4.5)],
    [e + R(-0.8, 0.8), -W - R(1.2, 2)],
    [e * 0.92 + R(-0.8, 0.8), -W * 0.5 + R(-3, 3)],
    [e + (to[0] - e) * 0.25 + R(-0.6, 0.6), PORTAL.Z0 - 2],
    to,
  ];
}
// The nodes up to (not including) the plan's last point, laid on the floor
// and settled, the first sunk in the ground; and leaves along them (fewer in
// the passage's shade).
function lead(caster, plan, r0, r1, rng, opt = {}) {
  const nodes = layStem(caster, downRays(plan), { far: 20, miss: floorMiss });
  nodes.pop();
  if (nodes.length < 3) return null;
  settle(nodes, r0, r1, 0.7);
  nodes[0].p.y -= 0.5 + r0;
  const W = PORTAL.WALL;
  const leaves = leavesAlong(nodes, rng, { light: new THREE.Vector3(0, 1, 0.3).normalize(), scale: opt.scale ?? 0.9, spacing: opt.spacing ?? 1.2 })
    .filter((lf) => lf.p.z < -W + 3 || lf.p.z > -1 || rng() < 0.5);
  leaves.forEach((lf) => { lf.young = false; });
  return { nodes, leaves };
}
// Each runner (crackRunners') led back to the garden: prepended to its stem.
export function leadRunners(caster, run, rng) {
  for (const stem of run.stems) {
    const p0 = stem[0].p, l = lead(caster, leadPlan([p0.x, p0.z], rng), Math.max(0.2, stem[0].r * 1.4), stem[0].r, rng);
    if (!l) continue;
    stem.unshift(...l.nodes);
    run.leaves.push(...l.leaves);
  }
}
// The room face's stems (growIvy's, from roomSheets) that start on the floor:
// branches off a trunk either side, in from the garden along the foot of the
// passage's wall to the door line, and from there along the floor to each.
export function leadFaceRoots(caster, grown, rng) {
  const R = (lo, hi) => lo + (hi - lo) * rng();
  const { HW, Z0, FLOOR: F } = PORTAL;
  const trunks = [];
  for (const s of [-1, 1]) {
    const roots = grown.stems.filter((st) => st[0].p.y < F + 1.5 && Math.sign(st[0].p.x) === s && Math.abs(st[0].p.x) > HW - 1);
    if (!roots.length) continue;
    const corner = [s * (HW - 2.6), Z0 + 2.6];
    const big = Math.max(...roots.map((st) => st[0].r));
    const trunk = lead(caster, [...leadPlan(corner, rng, { entry: s * (HW - 3.2) }).slice(0, -1), corner, [corner[0] + s * 0.5, corner[1] + 0.6]], big * 1.25, big * 1.05, rng, { scale: 1 });
    if (!trunk) continue;
    trunks.push(trunk);
    for (const st of roots) {
      const p0 = st[0].p;
      // in front of the plinth it climbs from, then to it
      const plan = [corner, [corner[0] + (p0.x - corner[0]) * 0.5, Math.max(corner[1], p0.z + R(0.8, 1.6))], [p0.x + R(-0.4, 0.4), p0.z + R(0.9, 1.4)], [p0.x, p0.z]];
      const nodes = layStem(caster, downRays(plan), { far: 20, miss: floorMiss });
      nodes.pop();
      if (nodes.length < 2) continue;
      settle(nodes, big * 1.05, st[0].r, 0.7);
      st.unshift(...nodes);
      grown.leaves.push(...leavesAlong(nodes, rng, { light: new THREE.Vector3(0, 1, 0.3).normalize(), scale: 0.9, spacing: 1.3 }));
    }
  }
  for (const t of trunks) {
    grown.stems.push(t.nodes);
    grown.leaves.push(...t.leaves);
  }
}
