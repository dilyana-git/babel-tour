// Distances used while planting the garden. Keep the projection arithmetic
// unchanged so clearances keep every existing tree, stone and blade in place.
export function segmentDistance(p, a, b) {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const length2 = vx * vx + vz * vz;
  const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / length2)) : 0;
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vz * t));
}

export function lineDistance(p, pts) {
  let nearest = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const vx = b[0] - a[0], vz = b[1] - a[1];
    const length2 = vx * vx + vz * vz;
    const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / length2)) : 0;
    const dx = p[0] - (a[0] + vx * t), dz = p[1] - (a[1] + vz * t);
    // A segment already farther away on either axis cannot be the closest.
    // Most long paths need only a few full distance calculations per point.
    if (Math.abs(dx) > nearest || Math.abs(dz) > nearest) continue;
    nearest = Math.min(nearest, Math.hypot(dx, dz));
  }
  return nearest;
}
