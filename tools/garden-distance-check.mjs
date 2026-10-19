import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lineDistance, segmentDistance } from '../src/world/gardenDistance.js';

const originalSegment = (p, a, b) => {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const length2 = vx * vx + vz * vz;
  const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / length2)) : 0;
  const q = [a[0] + vx * t, a[1] + vz * t];
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
};
const originalLine = (p, pts) => Math.min(...pts.slice(1).map((b, i) => originalSegment(p, pts[i], b)));

test('garden distances preserve endpoints, repeated points and points on path edges', () => {
  for (const pts of [[], [[1, 2]], [[1, 2], [1, 2]], [[-10, -20], [10, 20], [35, -20], [35, -20], [-40, 10]]]) {
    for (const p of [[0, 0], [1, 2], [-10, -20], [35, -20], [35, -20 + Number.EPSILON], [800, -900]]) {
      assert.equal(lineDistance(p, pts), originalLine(p, pts));
      for (let i = 1; i < pts.length; i++) assert.equal(segmentDistance(p, pts[i - 1], pts[i]), originalSegment(p, pts[i - 1], pts[i]));
    }
  }
});

test('garden distances retain exact clearance decisions over seeded paths', () => {
  let seed = 8719;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let n = 2; n <= 128; n *= 2) {
    const pts = Array.from({ length: n }, () => [random() * 2000 - 1000, random() * 2000 - 1000]);
    for (let i = 0; i < 1500; i++) {
      const p = [random() * 2400 - 1200, random() * 2400 - 1200];
      assert.equal(lineDistance(p, pts), originalLine(p, pts));
    }
  }
});
