import { Curve, Vector3 } from 'three';

// A tree's control points are fixed while its wood is sampled. Cache each
// segment's centripetal Catmull-Rom coefficients instead of deriving the same
// intervals and tangents for every sample. Endpoint extrapolation and cubic
// evaluation retain three.js's arithmetic so the sampled wood is unchanged.
export class TreeCurve extends Curve {
  constructor(points) {
    super();
    this.segments = [];
    const last = points.length - 1;
    for (let i = 0; i < last; i++) {
      const a = i ? points[i - 1] : points[0].clone().sub(points[1]).add(points[0]);
      const b = points[i], c = points[i + 1];
      const d = i + 2 <= last ? points[i + 2] : points[last].clone().sub(points[last - 1]).add(points[last]);
      let u = Math.pow(a.distanceToSquared(b), 0.25);
      let v = Math.pow(b.distanceToSquared(c), 0.25);
      let w = Math.pow(c.distanceToSquared(d), 0.25);
      if (v < 1e-4) v = 1;
      if (u < 1e-4) u = v;
      if (w < 1e-4) w = v;
      const coefficients = [];
      for (const axis of ['x', 'y', 'z']) {
        let enter = (b[axis] - a[axis]) / u - (c[axis] - a[axis]) / (u + v) + (c[axis] - b[axis]) / v;
        let leave = (c[axis] - b[axis]) / v - (d[axis] - b[axis]) / (v + w) + (d[axis] - c[axis]) / w;
        enter *= v;
        leave *= v;
        coefficients.push(b[axis], enter, -3 * b[axis] + 3 * c[axis] - 2 * enter - leave,
          2 * b[axis] - 2 * c[axis] + enter + leave);
      }
      this.segments.push(coefficients);
    }
  }

  getPoint(t, target = new Vector3()) {
    const p = this.segments.length * t;
    let i = Math.floor(p), weight = p - i;
    if (weight === 0 && i === this.segments.length) { i--; weight = 1; }
    const c = this.segments[i], t2 = weight * weight, t3 = t2 * weight;
    return target.set(c[0] + c[1] * weight + c[2] * t2 + c[3] * t3,
      c[4] + c[5] * weight + c[6] * t2 + c[7] * t3,
      c[8] + c[9] * weight + c[10] * t2 + c[11] * t3);
  }
}
