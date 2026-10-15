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

// Ease inward over a generous arc, entering only where the first treads exist.
// Its ends follow the aisle and spiral tangents instead of a radial sidestep.
export function vertigoApproach(center, aisleRadius, floor, eye) {
  return Array.from({ length: 21 }, (_, i) => {
    const a = 150 + i * 2, t = (a - 170) / (SPIRAL.turns * 360);
    const stair = spiralAt(center, t), u = i / 20;
    const p = polar(center, a, aisleRadius + (stair.radius - aisleRadius) * ease(u));
    return [p[0], (a < 170 ? floor : stair.tread) + eye, p[1]];
  });
}
