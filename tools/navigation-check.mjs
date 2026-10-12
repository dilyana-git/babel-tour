import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { makeWalkCurve, makeWalkPace, hexAislePoint, roundAislePoint, pathToPoint } from '../src/world/walkPath.js';
import { makeBody, RADIUS, ROOM_STAND } from '../src/world/body.js';
import { PAVILION, PAVILION_BRIDGE, PAVILION_NORTH_BRIDGE, PAVILION_BRIDGE_HALF_WIDTH, pavilionCrossing } from '../src/world/pavilionBridge.js';

const points = (a) => a.map((p) => new THREE.Vector3(...p));
const material = new THREE.MeshBasicMaterial();
const box = (root, name, size, centre) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...centre);
  root.add(mesh);
};
const floor = (root) => box(root, 'floor', [200, 2, 200], [0, -1, 0]);
const distanceToPath = (p, ctrl) => Math.min(...ctrl.slice(1).map((b, i) => {
  const line = new THREE.Line3(ctrl[i], b);
  return line.closestPointToPoint(p, true, new THREE.Vector3()).distanceTo(p);
}));

test('Silence centreline stays halfway between the hexagonal rail and bookcases', () => {
  const centre = [618.6025403784, 561.7949192431];
  const inner = 42.8, outer = 100 * Math.cos(Math.PI / 6) - 16.8;
  for (let angle = -180; angle <= 540; angle++) {
    const p = hexAislePoint(centre, angle, inner, outer);
    const face = (Math.floor(angle / 60) * 60 + 30) * Math.PI / 180;
    const along = (p[0] - centre[0]) * Math.cos(face) + (p[1] - centre[1]) * Math.sin(face);
    const inside = along - inner * Math.cos(Math.PI / 6), outside = outer - along;
    assert(Math.abs(inside - outside) < 1e-8);
    assert(outside > 16);
  }
  // The stand at the centre of a wall used to sit at radius 66.
  assert(hexAislePoint(centre, 90, inner, outer)[1] - centre[1] < 54);
});

test('Vestibule centreline balances the wider well and the bookcase trim', () => {
  const centre = [232, 785], inner = 50.8, outer = 100 * Math.cos(Math.PI / 6) - 16.8;
  const ctrl = points(Array.from({ length: 13 }, (_, i) => {
    const p = hexAislePoint(centre, 150 - i * 15, inner, outer);
    return [p[0], 21, p[1]];
  }));
  const curve = makeWalkCurve(ctrl);
  for (let i = 0; i <= 1000; i++) {
    const p = curve.getPointAt(i / 1000);
    const angle = Math.atan2(p.z - centre[1], p.x - centre[0]) * 180 / Math.PI;
    const middle = hexAislePoint(centre, angle, inner, outer);
    assert(Math.hypot(p.x - middle[0], p.z - middle[1]) < 0.7);
    const face = (Math.floor(angle / 60) * 60 + 30) * Math.PI / 180;
    const along = (p.x - centre[0]) * Math.cos(face) + (p.z - centre[1]) * Math.sin(face);
    assert(along - inner * Math.cos(Math.PI / 6) > 12);
    assert(outer - along > 12);
  }
});

test('Echo centreline balances a round colonnade against hexagonal bookcases', () => {
  const centre = [425.3012701892, 673.3974596216], inner = 59, outer = 100 * Math.cos(Math.PI / 6) - 12;
  for (let angle = -180; angle <= 540; angle++) {
    const p = roundAislePoint(centre, angle, inner, outer);
    const face = (Math.floor(angle / 60) * 60 + 30) * Math.PI / 180;
    const along = (p[0] - centre[0]) * Math.cos(face) + (p[1] - centre[1]) * Math.sin(face);
    const inside = Math.hypot(p[0] - centre[0], p[1] - centre[1]) - inner;
    assert(Math.abs(inside - (outer - along)) < 1e-8);
    assert(inside > 7.5);
  }
  // A square approach to the stair: no lateral jump from the arrival stand.
  assert(Math.abs(roundAislePoint(centre, 180, inner, outer)[1] - centre[1]) < 1e-8);
});

test('zigzag bridge corners stay within 0.6 of the centreline in both directions', () => {
  const ctrl = points([[0, 15, 0], [24, 15, -10], [14, 15, -30], [38, 15, -40]]);
  const forward = makeWalkCurve(ctrl), back = makeWalkCurve([...ctrl].reverse());
  for (let i = 0; i <= 1000; i++) {
    const p = forward.getPointAt(i / 1000);
    assert(distanceToPath(p, ctrl) < 0.6);
    assert(p.distanceTo(back.getPointAt(1 - i / 1000)) < 1e-6);
  }
});

test('Pavilion navigation rounds bends inside the original zigzag deck', () => {
  assert.deepEqual(PAVILION_BRIDGE, [[1238, 196], [1262, 186], [1252, 166], [1276, 156], [1285, 137]]);
  assert.deepEqual(PAVILION_NORTH_BRIDGE, [[1310, 10], [1298, 38], [1306, 63]]);
  assert.equal(PAVILION_BRIDGE_HALF_WIDTH, 8.4);
  const walk = points(pavilionCrossing(PAVILION_BRIDGE));
  const deck = walk.filter(p => Math.abs(p.y - 23.6) < 1e-6);
  const ctrl = points(PAVILION_BRIDGE.map(([x, z]) => [x, 23.6, z]));
  for (const p of deck) {
    assert(distanceToPath(p, ctrl) < 1.6);
    assert(PAVILION_BRIDGE_HALF_WIDTH - 1.9 - distanceToPath(p, ctrl) > RADIUS);
  }
  const heading = deck.slice(1).map((p, i) => p.clone().sub(deck[i]).normalize());
  for (let i = 1; i < heading.length; i++) assert(heading[i].angleTo(heading[i - 1]) < 0.35);
  const landing = walk.at(-1);
  assert(Math.hypot(landing.x - PAVILION[0], landing.z - PAVILION[1]) < 25);
  assert.equal(landing.y, 27.1);
});

test('the maze arrival retains its final corner and square approach', () => {
  const maze = [[0, 0], [30, 0], [30, 30], [0, 30], [0, 60]];
  const route = pathToPoint(maze, [0, 34]);
  assert.deepEqual(route, [[0, 0], [30, 0], [30, 30], [0, 30], [0, 34]]);
  const ctrl = points(route.map(([x, z]) => [x, 20, z]));
  const curve = makeWalkCurve(ctrl);
  for (let i = 0; i <= 1000; i++) assert(distanceToPath(curve.getPointAt(i / 1000), ctrl) < 0.6);
  assert(Math.abs(curve.getTangentAt(1).x) < 1e-8);
});

test('stairs keep their axis, monotone height, and short treads', () => {
  const ctrl = points([[-20, 15, 0], [-10, 15, 0], [-7, 20, 0], [0, 22, 0], [7, 24, 0], [14, 26, 0], [20, 26, 0]]);
  const curve = makeWalkCurve(ctrl);
  let last = curve.getPointAt(0);
  for (let i = 1; i <= 1000; i++) {
    const p = curve.getPointAt(i / 1000);
    assert(Math.abs(p.z) < 1e-8);
    assert(p.y >= last.y && p.x >= last.x);
    assert(p.distanceTo(last) <= curve.getLength() / 1000 + 1e-6);
    last = p;
  }
});

test('a winding stair stays near its middle instead of cutting towards its edge', () => {
  const ctrl = points(Array.from({ length: 13 }, (_, i) => {
    const angle = (170 + i * 6.84) * Math.PI / 180;
    return [60 * Math.cos(angle), 21 - i * 2.2, 60 * Math.sin(angle)];
  }));
  for (const order of [ctrl, [...ctrl].reverse()]) {
    const curve = makeWalkCurve(order);
    for (let i = 0; i <= 1000; i++) {
      const p = curve.getPointAt(i / 1000);
      assert(Math.abs(Math.hypot(p.x, p.z) - 60) < 0.3);
    }
  }
});

test('walking brakes for a corner and slows on stairs', () => {
  const straight = makeWalkCurve(points([[0, 15, 0], [100, 15, 0]]));
  assert.equal(makeWalkPace(straight, 18)(30), 18);
  const bend = makeWalkCurve(points([[0, 15, 0], [30, 15, 0], [30, 15, 30]]));
  const pace = makeWalkPace(bend, 18);
  assert(pace(25) < pace(5));
  assert(pace(30) < 9);
  const stairs = makeWalkCurve(points([[0, 15, 0], [50, 35, 0]]));
  assert(makeWalkPace(stairs, 18)(20) < 14);
});

test('a short landing tread leads onto its threshold without stalling or treating furniture as stairs', () => {
  for (const name of ['pavilionThreshold', 'plank']) {
    const root = new THREE.Group();
    box(root, 'deck', [20, 2, 16], [0, -1, -8]);
    box(root, 'stone', [16, 1.75, 4.5], [0, 0.875, 2.25]);
    box(root, name, [15, 1.2, 4], [0, 3.8, 3.8]);
    box(root, 'wood', [30, 2, 20], [0, 2.5, 13.3]);
    const body = makeBody(root), feet = new THREE.Vector3(0, 0, -4);
    for (let i = 0; i < 80; i++) body.step(feet, new THREE.Vector3(0, 0, 0.2));
    if (name === 'pavilionThreshold') {
      assert(feet.z > 11.9);
      assert.equal(feet.y, 3.5);
    } else assert(feet.z < 0, 'An ordinary raised plank must still block the leading foot');
    body.dispose();
  }
});

test('a long move cannot tunnel through a thin wall', () => {
  const root = new THREE.Group(); floor(root);
  box(root, 'wall', [0.5, 30, 200], [10, 15, 0]);
  const body = makeBody(root), feet = new THREE.Vector3(0, 0, 0);
  body.step(feet, new THREE.Vector3(30, 0, 0));
  assert(feet.x <= 9.75 - RADIUS + 0.02);
  body.dispose();
});

test('floor markings cannot turn supported pavement into a ledge', () => {
  const root = new THREE.Group(); floor(root);
  const marking = new THREE.Mesh(new THREE.PlaneGeometry(20, 100).rotateX(Math.PI / 2), material);
  marking.position.y = 0.12;
  marking.name = 'wornPath';
  root.add(marking);
  const body = makeBody(root), feet = new THREE.Vector3(0, 0, -20);
  const result = body.step(feet, new THREE.Vector3(0, 0, 40));
  assert.equal(result.stop, null);
  assert.equal(feet.z, 20);
  assert.equal(feet.y, 0);
  body.dispose();
  // A colour strip is not a substitute for ground under a bridge or well.
  const unsupported = new THREE.Group(); unsupported.add(marking.clone());
  const air = makeBody(unsupported);
  assert.equal(air.floorUnder(new THREE.Vector3(0, 15, 0)), null);
  air.dispose();
});

test('passing a wall gains gentle clearance instead of scraping it', () => {
  const root = new THREE.Group(); floor(root);
  box(root, 'books', [2, 30, 200], [-1, 15, 0]);
  const body = makeBody(root), feet = new THREE.Vector3(5, 0, -30);
  let lastX = feet.x;
  for (let i = 0; i < 120; i++) {
    body.step(feet, new THREE.Vector3(0, 0, 0.5), ROOM_STAND);
    assert(Math.abs(feet.x - lastX) < 0.15);
    lastX = feet.x;
  }
  assert(feet.x > 8.8 && feet.x < 9.1);
  body.dispose();
});

test('clearance adapts to a narrow corridor and brings the feet to its middle', () => {
  const root = new THREE.Group(); floor(root);
  for (const side of [-1, 1]) box(root, 'wall', [2, 30, 200], [side * 8, 15, 0]);
  const body = makeBody(root), feet = new THREE.Vector3(2, 0, -30);
  for (let i = 0; i < 100; i++) body.step(feet, new THREE.Vector3(0, 0, 0.5), ROOM_STAND);
  assert(Math.abs(feet.x) < 0.1);
  assert(feet.z > 19);
  body.dispose();
});

test('a long move stops before unsupported ground rather than jumping it', () => {
  const root = new THREE.Group();
  box(root, 'deck', [18, 2, 20], [0, -1, 0]);
  box(root, 'deck', [18, 2, 20], [0, -1, 28]);
  const body = makeBody(root), feet = new THREE.Vector3(0, 0, 0);
  body.step(feet, new THREE.Vector3(0, 0, 30));
  assert(feet.z < 10);
  assert.equal(body.clearance(feet, 0, 1, 30) < 30, true);
  body.dispose();
});
