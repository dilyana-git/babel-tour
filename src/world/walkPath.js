import * as THREE from 'three';

// The aisle is between two hexagonal boundaries, not two circles. Its
// middle stays halfway between their faces, including near a room's corners.
export function hexAislePoint(centre, bearing, innerRadius, outerApothem) {
  const radians = Math.PI / 180;
  const face = Math.floor(bearing / 60) * 60 + 30;
  const middle = (innerRadius * Math.cos(Math.PI / 6) + outerApothem) / 2;
  const radius = middle / Math.cos((bearing - face) * radians);
  return [centre[0] + Math.cos(bearing * radians) * radius, centre[1] + Math.sin(bearing * radians) * radius];
}

// A round colonnade inside a hexagonal room: equal distance from the
// columns' outer envelope and the nearest face of the bookcases.
export function roundAislePoint(centre, bearing, innerRadius, outerApothem) {
  const radians = Math.PI / 180;
  const face = Math.floor(bearing / 60) * 60 + 30;
  const radius = (innerRadius + outerApothem) / (1 + Math.cos((bearing - face) * radians));
  return [centre[0] + Math.cos(bearing * radians) * radius, centre[1] + Math.sin(bearing * radians) * radius];
}

// Stop a corridor route at a point on its final approach, keeping every
// intervening corner. Filtering vertices by distance can cut across an aisle.
export function pathToPoint(points, end) {
  let nearest = 0, distance = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], lengthSq = dx * dx + dz * dz;
    const t = lengthSq ? THREE.MathUtils.clamp(((end[0] - a[0]) * dx + (end[1] - a[1]) * dz) / lengthSq, 0, 1) : 0;
    const d = Math.hypot(end[0] - a[0] - dx * t, end[1] - a[1] - dz * t);
    if (d <= distance) { distance = d; nearest = i; }
  }
  return [...points.slice(0, nearest + 1), end];
}

// Round each centreline corner locally. A spline through a whole route can
// overshoot short treads and narrow decks, even when every waypoint is safe.
export function makeWalkCurve(points, cornerTrim = 2) {
  const ctrl = points.filter((p, i) => !i || p.distanceToSquared(points[i - 1]) > 1e-8);
  const path = [ctrl[0].clone()];
  for (let i = 1; i < ctrl.length - 1; i++) {
    const p = ctrl[i], a = ctrl[i - 1], b = ctrl[i + 1];
    const incoming = p.clone().sub(a), outgoing = b.clone().sub(p);
    const trim = Math.min(cornerTrim, incoming.length() * 0.4, outgoing.length() * 0.4);
    if (incoming.normalize().dot(outgoing.normalize()) < -0.95) {
      path.push(p.clone());
      continue;
    }
    const start = p.clone().addScaledVector(incoming, -trim);
    const end = p.clone().addScaledVector(outgoing, trim);
    path.push(start);
    const bend = new THREE.QuadraticBezierCurve3(start, p, end);
    for (let k = 1, n = Math.max(2, Math.ceil(trim * 2 / 0.3)); k <= n; k++) path.push(bend.getPoint(k / n));
  }
  if (ctrl.length > 1) path.push(ctrl.at(-1).clone());
  return new WalkCurve(path);
}

class WalkCurve extends THREE.Curve {
  constructor(points) {
    super();
    this.points = points;
    this.distances = [0];
    for (let i = 1; i < points.length; i++) this.distances.push(this.distances[i - 1] + points[i].distanceTo(points[i - 1]));
    this.length = this.distances.at(-1);
  }
  getLength() { return this.length; }
  getPointAt(t, out = new THREE.Vector3()) { return this.getPoint(t, out); }
  getPoint(t, out = new THREE.Vector3()) {
    if (!this.length) return out.copy(this.points[0]);
    const distance = THREE.MathUtils.clamp(t, 0, 1) * this.length;
    let lo = 1, hi = this.points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.distances[mid] < distance) lo = mid + 1;
      else hi = mid;
    }
    const start = this.distances[lo - 1], span = this.distances[lo] - start;
    return out.copy(this.points[lo - 1]).lerp(this.points[lo], span ? (distance - start) / span : 0);
  }
}

// ── How a walk moves ─────────────────────────────────────────────────────────
// Two things a walk felt abrupt by, measured on a fixed clock (World.jsx's
// __worldSim): its pace was a sawtooth, and its eyes snapped.
//   The eyes looked along the way, so every corner of the way swung them, and
// the feet were held to whatever pace swung them no faster than a head turns:
// a quarter of a stride at every corner, braked into at two metres a second
// squared. The walk on from the Pavilion nearly stopped fifteen times in
// seventy seconds, and across its zigzag bridge the view went ninety degrees
// left and ninety right in six paces. And where the way doubled back the eyes
// turned right round in one frame.
//   Now the eyes have a track of their own (`makeGazeTrack`), laid along the
// way before it is walked: where they looked before, but through a chicane
// they look to where it comes out, they never turn more than GAZE.slope a
// unit, and they cannot jump. The feet keep the pace a walker keeps round a
// bend (a third power of its radius: under half a stride at the tightest),
// slow only as much more as the eyes' own turning asks, and brake at a
// walker's rate, from further back. ?wmotion=old: as it was.
export const MOTION_OLD = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wmotion') === 'old';
// Where the eyes go while the feet follow the path: not one point a few strides
// on, but a blend of three — near, middle and far — each counted by direction
// only (see World.jsx's walkMove, where this was tuned).
export const LOOK_AHEAD = [[16, 0.45], [36, 0.35], [64, 0.2]];
export const GAZE = {
  // through a chicane, the eyes go to a point this far on along the way...
  chord: 48,
  // ...a chicane being where, from `back` behind to `chord` ahead, the way
  // turns a good deal (`turning`, radians) and most of it cancels out
  back: 24, turning: 0.9,
  // the most the eyes turn for a unit walked (radians): a right angle over
  // about nine paces
  slope: 0.055,
  // and the rounding of where a turn of theirs begins and ends (units)
  round: 3,
  // the most they tip up or down for a unit walked (radians)
  tip: 0.03,
};
export const PACE = {
  // the radius (units) of the gentlest bend that slows a walker at all, and
  // the least of a stride they keep round the tightest
  radius: 20, tightest: 0.45,
  // turned right round on the spot (a way that doubles back): nearly a stand
  about: 0.12,
  // the eyes turn no faster than this (rad/s), and the feet wait for them —
  // but never to less than `waits` of a stride
  view: 0.8, waits: 0.34,
  // braking for what is coming, units/s² (about 1.1 m/s²), seen from this far back
  brake: 12, ahead: 26,
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const gauss = (xs, sigma) => {
  if (sigma <= 0) return xs;
  const r = Math.ceil(sigma * 3), n = xs.length, out = new Float32Array(n);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let j = -r; j <= r; j++) acc += xs[Math.min(n - 1, Math.max(0, i + j))] * k[j + r];
    out[i] = acc / sum;
  }
  return out;
};

// The eyes' track along a way: `samples` are points of it `step` apart, in the
// order walked. Says, at each, the bearing the eyes look along (`yaw`, radians,
// continuous: it never wraps) and how fast that turns (`slope`, radians a
// unit), and `at(i, out)` the same between samples (i a fraction of an index).
export function makeGazeTrack(samples, step) {
  const n = samples.length, last = n - 1;
  const tangent = new Float32Array(n), aim = new Float32Array(n), chord = new Float32Array(n);
  let pitch = new Float32Array(n);
  const v = new THREE.Vector3(), sum = new THREE.Vector3();
  // the way's own bearing
  for (let i = 0; i < n; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(last, i + 1)];
    const flat = Math.hypot(b.x - a.x, b.z - a.z);
    const t = flat > 1e-4 ? Math.atan2(b.z - a.z, b.x - a.x) : (i ? tangent[i - 1] : 0);
    tangent[i] = i ? tangent[i - 1] + wrap(t - tangent[i - 1]) : t;
  }
  // where the eyes went before: near, middle and far, by direction
  for (let i = 0; i < n; i++) {
    sum.set(0, 0, 0);
    for (const [reach, weight] of LOOK_AHEAD) {
      const j = i + Math.round(reach / step);
      v.copy(samples[Math.min(last, j)]).sub(samples[i]);
      // (a point past the end of the way is the end of the way, looked at level)
      if (j > last) v.y = 0;
      const len = v.length();
      if (len > 1e-3) sum.addScaledVector(v, weight / len);
    }
    const flat = Math.hypot(sum.x, sum.z);
    const t = flat > 0.05 ? Math.atan2(sum.z, sum.x) : (i ? aim[i - 1] : tangent[0]);
    // half the climb or fall of the way ahead: the eyes lead the feet up a
    // stair but do not stare at the treads. (Where the three points pull
    // against each other — a way that doubles back — there is no saying how
    // steeply: as it was a stride before.)
    pitch[i] = flat > 0.3 ? Math.atan2(sum.y * 0.5, flat) : (i ? pitch[i - 1] : 0);
    aim[i] = i ? aim[i - 1] + wrap(t - aim[i - 1]) : tangent[0] + wrap(t - tangent[0]);
    // and to one point well on along the way
    v.copy(samples[Math.min(last, i + Math.round(GAZE.chord / step))]).sub(samples[i]);
    chord[i] = Math.hypot(v.x, v.z) > 1 ? aim[i] + wrap(Math.atan2(v.z, v.x) - aim[i]) : aim[i];
  }
  // a chicane: the way turning one way and then back
  const turned = new Float32Array(n);
  for (let i = 1; i < n; i++) turned[i] = turned[i - 1] + Math.abs(tangent[i] - tangent[i - 1]);
  let wiggle = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - Math.round(GAZE.back / step)), b = Math.min(last, i + Math.round(GAZE.chord / step));
    const total = turned[b] - turned[a], net = Math.abs(tangent[b] - tangent[a]);
    wiggle[i] = total > GAZE.turning ? Math.min(1, Math.max(0, (1 - net / total - 0.2) / 0.45)) : 0;
  }
  wiggle = gauss(wiggle, 10 / step);
  let yaw = new Float32Array(n);
  for (let i = 0; i < n; i++) yaw[i] = aim[i] + wiggle[i] * (chord[i] - aim[i]);
  // never more than GAZE.slope a unit: held to twice that walking on and
  // walking back, and the two halved (a sudden turn of the way becomes a
  // steady one, half of it before and half after)
  const most = GAZE.slope * 2 * step, fwd = Float32Array.from(yaw), back = Float32Array.from(yaw);
  for (let i = 1; i < n; i++) fwd[i] = Math.min(fwd[i - 1] + most, Math.max(fwd[i - 1] - most, yaw[i]));
  for (let i = n - 2; i >= 0; i--) back[i] = Math.min(back[i + 1] + most, Math.max(back[i + 1] - most, yaw[i]));
  for (let i = 0; i < n; i++) yaw[i] = (fwd[i] + back[i]) / 2;
  yaw = gauss(yaw, GAZE.round / step);
  // (and up and down the same way: it tipped twenty degrees in a frame where
  // the way turned back at the foot of the north bridge's steps)
  const tip = GAZE.tip * step;
  for (let i = 1; i < n; i++) pitch[i] = Math.min(pitch[i - 1] + tip, Math.max(pitch[i - 1] - tip, pitch[i]));
  for (let i = n - 2; i >= 0; i--) pitch[i] = Math.min(pitch[i + 1] + tip, Math.max(pitch[i + 1] - tip, pitch[i]));
  pitch = gauss(pitch, GAZE.round / step);
  const slope = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(last, i + 1);
    slope[i] = i1 > i0 ? (yaw[i1] - yaw[i0]) / ((i1 - i0) * step) : 0;
  }
  return {
    yaw, slope, pitch, wiggle, step,
    at(i, out) {
      const f = Math.min(last, Math.max(0, i)), i0 = Math.floor(f), i1 = Math.min(last, i0 + 1), t = f - i0;
      out.yaw = yaw[i0] + (yaw[i1] - yaw[i0]) * t;
      out.pitch = pitch[i0] + (pitch[i1] - pitch[i0]) * t;
      out.slope = slope[i0] + (slope[i1] - slope[i0]) * t;
      return out;
    },
  };
}

// The pace a bend of `radius` units is walked at, and one whose eyes turn
// `slope` radians a unit, as fractions of a stride.
export const bendPace = (radius) => Math.min(1, Math.max(PACE.tightest, Math.cbrt(radius / PACE.radius)));
export const viewPace = (slope, speed) => Math.min(1, Math.max(PACE.waits, PACE.view / Math.max(1e-6, Math.abs(slope) * speed)));

// Brake before a tight turn, and take stairs at a measured pace. The limit
// is prepared once per route; it is independent of the rendering frame rate.
// (`gaze`: the eyes' track along the same curve, if they have one.)
export function makeWalkPace(curve, speed, gaze = null) {
  const spacing = 2, length = curve.getLength();
  if (length < 1e-8) return () => 0;
  const n = Math.max(1, Math.ceil(length / spacing));
  const pts = curve.getSpacedPoints(n);
  const old = MOTION_OLD;
  const at = { yaw: 0, slope: 0 };
  const limits = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    const before = p.clone().sub(a), after = b.clone().sub(p);
    const horizontal = Math.hypot(b.x - a.x, b.z - a.z);
    const slope = Math.abs(b.y - a.y) / Math.max(0.1, horizontal);
    const angle = before.lengthSq() && after.lengthSq() ? before.setY(0).angleTo(after.setY(0)) : 0;
    const bend = angle / Math.max(0.1, horizontal / 2);
    if (old) return Math.min(speed / (1 + slope * 1.5), Math.max(speed * 0.22, 0.8 / Math.max(1e-6, bend)));
    const feet = angle > 2.6 ? PACE.about : bendPace(1 / Math.max(1e-6, bend));
    const eyes = gaze ? viewPace(gaze.at((i / n) * (gaze.yaw.length - 1), at).slope, speed) : 1;
    return Math.min(speed / (1 + slope * 1.5), speed * feet, speed * eyes);
  });
  const brake = old ? 22 : PACE.brake, reach = old ? 10 : Math.ceil(PACE.ahead / (length / n));
  return (distance) => {
    const i = Math.min(n, Math.max(0, Math.floor(distance / length * n)));
    let pace = speed;
    for (let j = Math.max(0, i - 1); j <= Math.min(n, i + reach); j++) {
      pace = Math.min(pace, Math.sqrt(limits[j] ** 2 + 2 * brake * Math.max(0, j - i) * length / n));
    }
    return pace;
  };
}
