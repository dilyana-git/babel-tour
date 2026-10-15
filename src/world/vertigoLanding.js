import { SPIRAL, spiralAt } from './spiral.js';

const DEG = Math.PI / 180;
const ease = (u) => u * u * u * (u * (u * 6 - 15) + 10);
const polar = (center, a, r) => [center[0] + Math.cos(a * DEG) * r, center[1] + Math.sin(a * DEG) * r];

// Join the rim and stair tangentially, with no corner posts across the entry.
// The paving meets the mouth's actual polygon, avoiding overlapping floor faces.
export function vertigoLanding(center, mouth, headRadius) {
  const from = 153, to = 170, back = 170, rimRadius = mouth + 1.3;
  const radiusAt = (a) => rimRadius + (headRadius - rimRadius) * ease(Math.max(0, Math.min(1, (a - from) / (to - from))));
  const rail = Array.from({ length: 41 }, (_, i) => {
    const a = from + (to - from) * i / 40;
    return polar(center, a, radiusAt(a));
  });
  const holeRadius = (a) => mouth * Math.cos(2.25 * DEG) / Math.cos((a - (Math.floor(a / 4.5) + 0.5) * 4.5) * DEG);
  const floorRadius = (a) => radiusAt(a) + 0.2;
  let lo = from, hi = back;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (floorRadius(mid) > holeRadius(mid)) lo = mid; else hi = mid;
  }
  const start = (lo + hi) / 2;
  const outer = [start, ...[157.5, 162, 166.5].filter(a => a > start), back]
    .map(a => polar(center, a, holeRadius(a)));
  const edge = Array.from({ length: 32 }, (_, i) => {
    const a = back + (start - back) * i / 32;
    return polar(center, a, floorRadius(a));
  });
  return { rail, floor: [...outer, ...edge] };
}

// Leave the corridor along its own axis, then turn progressively onto the
// stair. A single Bezier keeps both joins tangent without an aisle sidestep.
export function vertigoApproach(center, entryRadius, floor, eye) {
  const end = spiralAt(center, 20 / (SPIRAL.turns * 360));
  const controls = [polar(center, 150, entryRadius), polar(center, 150, entryRadius - 28),
    [end.p[0] + Math.sin(190 * DEG) * 14, end.p[1] - Math.cos(190 * DEG) * 14], end.p];
  return Array.from({ length: 33 }, (_, i) => {
    const u = i / 32, v = 1 - u, weights = [v ** 3, 3 * v * v * u, 3 * v * u * u, u ** 3];
    const p = [0, 1].map(k => controls.reduce((sum, c, j) => sum + c[k] * weights[j], 0));
    const a = (Math.atan2(p[1] - center[1], p[0] - center[0]) / DEG + 360) % 360;
    const stair = spiralAt(center, (a - 170) / (SPIRAL.turns * 360));
    return [p[0], (a < 170 ? floor : stair.tread) + eye, p[1]];
  });
}
