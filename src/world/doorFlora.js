// Ivy grows from the garden, follows the passage's walls and soffit,
// and climbs the room's face of the arch. Nothing lies on the floor.
// Coordinates are in the arch's frame: x along the wall, y up, z into
// the room. Growth uses independent streams.
import * as THREE from 'three';
import { PORTAL } from './portal';
import { growIvy } from './ivy';

export const FLORA = { face: { left: 42, right: 30, max: 1500 }, reveal: 25, hang: 5 };

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

// The sheets the ivy grows over on the room's side, for growIvy: the room's
// face of the arch, cast toward the wall.
export function roomSheets(ends) {
  const F = PORTAL.FLOOR, HW = PORTAL.HW;
  const opening = (u, v, a) => Math.abs(u) < HW + a && v < PORTAL.soffitAt(u, a) + 0.4;
  const { left, right, max } = FLORA.face;
  return [{
    ray: (u, v, o, d) => { o.set(u, v, 40); d.set(0, 0, -1); }, far: 48,
    light: new THREE.Vector3(0, 1, 0.6).normalize(), max, fork: 0.09,
    allow: (u, v) => Math.abs(u) < 33 && v > F - 1 && !opening(u, v, 0.8)
      && v < (u < 0 ? left - Math.max(0, -u - 20) * 0.6 : right - Math.max(0, u - 20) * 0.6),
    // Continue from where the passage's stems come round onto the room face.
    seeds: ends.map(({ u, v, th, len, vigour }) => [u, v, th, len, vigour]),
  }];
}
// The cases' ends beside the arch, as stone to grow on (where they stand: 12.7
// in front of the wall, from 33 out to 46 either side).
export const caseFaces = () => [-1, 1].map((sd) => new THREE.PlaneGeometry(14, 100).translate(sd * 39.5, 50, 12.7));

// Each hanging strand and wall runner connects to ivy rooted in the garden.
// A stem laid on the stone along a run of rays ([o, d] a step apart), each
// finding what it lies on.
function layStem(caster, rays, { far = 30 } = {}) {
  const nodes = [];
  let prev = null;
  for (const [o, d] of rays) {
    const h = caster.cast(o, d, far);
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

// The room face's ivy, rooted in the garden and carried along the passage's
// walls. "Those branches look very 2D and they still end in nowhere … maybe
// they should stay on the wall, not on the floor" (2026-10-16): the stems that
// lay across the threshold and along the cracks are gone. Each of these comes
// out of the ground in the garden beside the arch, among the hedges at the
// wall's foot, climbs the garden face, turns its arris into the passage, runs
// the length of the passage's wall — wandering, never down to the floor — and
// comes round the room's arris onto the face of the first order, where the
// room face's ivy (roomSheets) goes on from its end.
//
// Where they come round, and the stems that go on from there, left and right:
// [{ s, u, v, th, len, vigour }] (growIvy's seed, and `s` its side).
const RUNS = { left: [4, 9.5, 15, 22], right: [5, 12, 19] };
export function wallEnds(rng) {
  const R = (lo, hi) => lo + (hi - lo) * rng();
  const { HW, FLOOR: F } = PORTAL, { left, right } = FLORA.face;
  const ends = [];
  for (const [s, hs, top] of [[-1, RUNS.left, left], [1, RUNS.right, right]]) {
    for (const h of hs) ends.push({ s, u: s * (HW + 1.6), v: F + h + R(-1.2, 1.2), th: s * R(0.45, 0.85), len: top * R(0.75, 1.1), vigour: s < 0 ? R(0.35, 0.6) : R(0.25, 0.5) });
  }
  return ends;
}
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// no two nodes nearer than `gap` (rays fanned round a corner bunch up)
const thin = (nodes, gap) => nodes.reduce((kept, nd) => {
  if (!kept.length || nd.p.distanceTo(kept[kept.length - 1].p) > gap) kept.push(nd);
  return kept;
}, []);
// One runner, to `end` (wallEnds'), ending `r1` thick. Returns its nodes (in
// the arch's frame, from the root), its shoots (stems of their own) and the
// leaves of both, with a few more lying on the ground round its root.
export function wallRunner(caster, { s, v }, r1, rng) {
  const R = (lo, hi) => lo + (hi - lo) * rng();
  const { HW, WALL: W, Z0, FLOOR: F } = PORTAL, GARDEN = 4.5, X = (d) => s * (HW + d), deg = Math.PI / 180;
  // up the garden face out of the grass (4 there), and across it to the splay
  const xr = X(GARDEN + R(3, 7)), yA = Math.min(v, F + R(2, 7)), x1 = X(GARDEN + 0.4);
  const n1 = Math.max(4, Math.round(Math.hypot(xr - x1, yA - 4) / 0.5)), bow = R(-1.2, 1.2);
  const up = [];
  for (let i = 0; i <= n1; i++) {
    const t = i / n1;
    up.push([V3(xr + (x1 - xr) * t * t + s * bow * Math.sin(Math.PI * t), 4 + (yA - 4) * Math.sin((t * Math.PI) / 2), -W - 14), V3(0, 0, 1)]);
  }
  const face = layStem(caster, up, { far: 20 });
  // along the passage's wall, a ray out to it at each step, from the arris on
  // the garden side to the door line: climbing from where it came in to `v`,
  // wandering up and down about that line as a stem on a wall does
  const z0 = -W + 0.4, z1 = Z0 - 1.6, K = 6;
  const ctrl = Array.from({ length: K + 1 }, (_, k) => {
    const t = k / K, e = t * t * (3 - 2 * t);
    return V3(0, yA + (v - yA) * e + (k && k < K ? R(-2.8, 2.8) : 0), z0 + (z1 - z0) * (k && k < K ? t + R(-0.04, 0.04) : t));
  });
  const path = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const rays = path.getSpacedPoints(Math.round((z1 - z0) / 0.5)).map((q) => [V3(s * (HW - 6), Math.max(F + 2.5, q.y), q.z), V3(s, 0, 0)]);
  const along = layStem(caster, rays, { far: 20 });
  // round the room's arris onto the first order's face: rays fanned from a
  // point in the opening, swept from the wall round to the face
  const fan = [];
  for (let a = 56; a >= 34; a -= 1.5) fan.push([V3(s * (HW - 3), v, Z0 + 3), V3(s * Math.cos(a * deg), 0, -Math.sin(a * deg))]);
  const round = layStem(caster, fan, { far: 12 });
  if (face.length < 2 || along.length < 6) return null;
  const nodes = thin([
    { p: V3(xr, 3.2, -W - 0.7), n: V3(0, 0.3, -1).normalize() },
    ...face,
    { p: V3(X(GARDEN + 0.05), yA, -W - 0.05), n: V3(-s * 0.4, 0, -1).normalize() },
    ...along, ...round,
  ], 0.4);
  settle(nodes, R(0.34, 0.42), r1);
  // leaves all along it, and shoots off it up (a few down) the passage's
  // wall, each with its leaves: a stem the length of the passage is not a
  // bare cable with a leaf every so often
  const leaves = leavesAlong(nodes, rng, { light: V3(0, 0.8, -0.7).normalize(), scale: 1.05, spacing: 0.8 });
  leaves.forEach((lf) => { lf.young = false; });
  const seeds = [];
  for (let at = R(1, 3), run = 0, k = 1; k < along.length; k++) {
    run += along[k].p.distanceTo(along[k - 1].p);
    if (run < at) continue;
    at = run + R(2.5, 5);
    const down = rng() < 0.25;
    seeds.push([along[k].p.z, along[k].p.y, down ? Math.PI + R(-0.6, 0.6) : R(-1.1, 1.1), down ? R(1.5, 3.5) : R(2.5, 8), 0.2]);
  }
  const shoots = growIvy(caster, [{
    ray: (u, y, o, d) => { o.set(s * (HW - 6), y, u); d.set(s, 0, 0); }, far: 20, scale: 0.95, fork: 0.12,
    light: V3(0, 0.7, -1).normalize(), max: 600,
    allow: (u, y) => u > -W + 0.6 && u < Z0 - 1.4 && y > F + 2 && y < 42,
    seeds,
  }], rng);
  // (a shoot is a third the thickness growIvy gives a root; laid back to the wall to match)
  for (const st of shoots.stems) {
    for (const nd of st) {
      const r = 0.035 + (nd.r - 0.045) * 0.4;
      nd.p.addScaledVector(nd.n, (r - nd.r) * 0.9);
      nd.r = r;
    }
  }
  leaves.push(...shoots.leaves);
  // and the ivy it rose from, lying on the ground about its root
  const m = new THREE.Matrix4();
  for (let k = 0; k < 9; k++) {
    const a = R(0, 6.28), d = R(0.4, 2.6);
    const face = V3(R(-0.35, 0.35), 1, R(-0.35, 0.35)).normalize(), tip = V3(Math.cos(a), 0, Math.sin(a));
    tip.addScaledVector(face, -tip.dot(face)).normalize();
    m.makeBasis(V3().crossVectors(tip, face).normalize(), tip, face);
    leaves.push({ p: V3(xr + Math.cos(a) * d, 4.08 + R(0, 0.25), Math.min(-W - 0.4, -W - 0.6 + Math.sin(a) * d)), q: new THREE.Quaternion().setFromRotationMatrix(m), s: R(0.9, 1.4) });
  }
  return { nodes, leaves, shoots: shoots.stems };
}
