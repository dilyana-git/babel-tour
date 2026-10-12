import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nearestRoute, wrapAngle, gazeAngle, headYaw, progressDelta } from './navigation-observations.mjs';

test('route measurements project onto segments rather than snapping to a sampled vertex', () => {
  const measured = nearestRoute([5, 15, 3], [[[0, 15, 0], [10, 15, 0]]]);
  assert.equal(measured.distance, 3);
  assert.deepEqual(measured.point, [5, 15, 0]);
  assert.deepEqual(measured.direction, [1, 0]);
});
test('a route above or below the visitor is not mistaken for a return', () => {
  assert.equal(nearestRoute([5, 15, 0], [[[0, 40, 0], [10, 40, 0]]]), null);
  const measured = nearestRoute([5, 15, 1], [[[0, 40, 0], [10, 40, 0]], [[0, 15, 0], [10, 15, 0]]]);
  assert.equal(measured.line, 1);
});
test('angle measurements handle crossing the full-turn boundary', () => {
  assert(Math.abs(wrapAngle(2 * Math.PI + 0.02) - 0.02) < 1e-12);
  assert(Math.abs(wrapAngle(-2 * Math.PI - 0.02) + 0.02) < 1e-12);
});
test('rendered gaze measurements detect actual camera turns, independent of input labels', () => {
  assert.equal(gazeAngle([0, 0, -1], [0, 0, -1]), 0);
  assert.equal(gazeAngle([0, 0, -1], [1, 0, 0]), Math.PI / 2);
  assert.equal(gazeAngle([0, 0, -1], [0, 0, 1]), Math.PI);
  assert.throws(() => gazeAngle([0, 0, 0], [1, 0, 0]), /finite and nonzero/);
});
test('free looking retains its offset while the walking body turns naturally', () => {
  const first = headYaw([0, -1], [-Math.SQRT1_2, 0, -Math.SQRT1_2]);
  const turned = headYaw([1, 0], [Math.SQRT1_2, 0, -Math.SQRT1_2]);
  assert(Math.abs(first - Math.PI / 4) < 1e-12);
  assert(Math.abs(first - turned) < 1e-12);
});
test('stair progress survives a floating-origin correction without counting an upward reset as descent', () => {
  const a = { distanceWalked: 100, feet: [0, -40, 0] }, b = { distanceWalked: 110, feet: [0, 350, 0] };
  assert.deepEqual(progressDelta(a, b, [0, 0, 0], [0, 400, 0]), { walked: 10, descended: 10 });
  assert.deepEqual(progressDelta(a, { ...b, distanceWalked: 2 }, [0, 0, 0], [0, 0, 0]), { walked: 2, descended: -390 });
});
