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

// Brake before a tight turn, and take stairs at a measured pace. The limit
// is prepared once per route; it is independent of the rendering frame rate.
export function makeWalkPace(curve, speed) {
  const spacing = 2, length = curve.getLength();
  if (length < 1e-8) return () => 0;
  const n = Math.max(1, Math.ceil(length / spacing));
  const pts = curve.getSpacedPoints(n);
  const limits = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    const before = p.clone().sub(a), after = b.clone().sub(p);
    const horizontal = Math.hypot(b.x - a.x, b.z - a.z);
    const slope = Math.abs(b.y - a.y) / Math.max(0.1, horizontal);
    const angle = before.lengthSq() && after.lengthSq() ? before.setY(0).angleTo(after.setY(0)) : 0;
    const bend = angle / Math.max(0.1, horizontal / 2);
    return Math.min(speed / (1 + slope * 1.5), Math.max(speed * 0.22, 0.8 / Math.max(1e-6, bend)));
  });
  return (distance) => {
    const i = Math.min(n, Math.max(0, Math.floor(distance / length * n)));
    let pace = speed;
    for (let j = Math.max(0, i - 1); j <= Math.min(n, i + 10); j++) {
      pace = Math.min(pace, Math.sqrt(limits[j] ** 2 + 2 * 22 * Math.max(0, j - i) * length / n));
    }
    return pace;
  };
}
