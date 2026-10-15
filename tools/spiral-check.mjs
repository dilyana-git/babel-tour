import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SPIRAL, spiralAt, railIntent, makeEndlessSpiral } from '../src/world/spiral.js';
import { makeBody } from '../src/world/body.js';
import { endlessRail } from '../src/world/vertigoRail.js';
import { vertigoLanding, vertigoApproach } from '../src/world/vertigoLanding.js';

const center = [80, 50];
// buildWorld's moulding sweep, plainly: the section set off square to the
// path in plan and plumb, without its mitres, end caps or uv
const mouldGeo = (path, sec) => {
  const pos = [], idx = [], C = sec.length;
  path.forEach(([x, y, z], i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    for (const [s, h] of sec) pos.push(x - ((b[2] - a[2]) / L) * s, y + h, z + ((b[0] - a[0]) / L) * s);
  });
  for (let i = 0; i + 1 < path.length; i++) for (let j = 0; j < C; j++) { const a = i * C + j, b = i * C + ((j + 1) % C); idx.push(a, b, b + C, a, b + C, a + C); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};
// `railed`: with the stair's own rail and string down every turn, as the
// world lays it (double-sided here, so the body feels them from either side)
const make = ({ railed = false } = {}) => {
  const stone = new THREE.MeshStandardMaterial(), bronze = stone.clone(), books = stone.clone();
  const M = { iron: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }), shelf: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }) };
  const carved = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  const rail = railed ? (turn) => endlessRail({ ...turn, mouldGeo, M, carved }) : null;
  const spiral = makeEndlessSpiral(center, { stone, bronze, books, rail });
  // The world's decorative star backdrop crosses the repeated flight's
  // height. It must never become a floor or push the visitor under the stair.
  const backdrop = new THREE.PlaneGeometry(9000, 8000).rotateX(-Math.PI / 2).translate(0, -520, 0);
  const stars = new THREE.Mesh(backdrop, stone); stars.name = 'stars'; spiral.root.add(stars);
  return { spiral, dispose: () => { spiral.dispose(); backdrop.dispose(); [stone, bronze, books, M.iron, M.shelf, carved].forEach(m => m.dispose()); } };
};

test('the continuing stair joins the initial flight and retains a full walking width', () => {
  const a = spiralAt(center, 1 - 1e-6), b = spiralAt(center, 1 + 1e-6);
  assert(Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]) < 0.003);
  for (const t of [0, 0.06, 1, 100, 10000]) {
    const at = spiralAt(center, t);
    assert(at.radius - at.edge >= 7.5);
    assert(at.outer - at.radius >= 8.5);
  }
});

test('the Vertigo approach flows from the doorway into the stair without a sideways corner', () => {
  const points = vertigoApproach(center, 110, 6, 15);
  const first = points[0], next = points[1], last = points.at(-1), previous = points.at(-2);
  const inward = [-Math.cos(150 * Math.PI / 180), -Math.sin(150 * Math.PI / 180)];
  const angleTo = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b)))));
  assert(angleTo([next[0] - first[0], next[2] - first[2]], inward) < 0.1, 'The doorway approach begins with a sideways turn');
  const stair = spiralAt(center, (190 - 170) / (SPIRAL.turns * 360));
  assert(Math.hypot(last[0] - stair.p[0], last[2] - stair.p[1]) < 0.01);
  assert(angleTo([last[0] - previous[0], last[2] - previous[2]], [-Math.sin(190 * Math.PI / 180), Math.cos(190 * Math.PI / 180)]) < 0.1);
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    assert(angleTo([b[0] - a[0], b[2] - a[2]], [c[0] - b[0], c[2] - b[2]]) < 0.15, 'The entrance contains a sharp steering correction');
  }
});

test('the rounded entrance supports walking onto the stair and back with room either side of the route', () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  const landing = vertigoLanding(center, SPIRAL.mouth, spiralAt(center, 0).edge - 0.9);
  const slab = (points, holes = []) => {
    const wound = (pts, clockwise) => {
      const v = pts.map(([x, z]) => new THREE.Vector2(x, -z));
      return THREE.ShapeUtils.isClockWise(v) === clockwise ? v : v.reverse();
    };
    const shape = new THREE.Shape(wound(points, false));
    holes.forEach(h => shape.holes.push(new THREE.Path(wound(h, true))));
    return new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2);
  };
  const ring = (r) => Array.from({ length: 80 }, (_, i) => [center[0] + Math.cos(i * Math.PI / 40) * r, center[1] + Math.sin(i * Math.PI / 40) * r]);
  const add = (geometry, name) => { const mesh = new THREE.Mesh(geometry, material); mesh.name = name; root.add(mesh); };
  add(slab(ring(130), [ring(SPIRAL.mouth)]), 'floor');
  add(slab(landing.floor), 'floor');
  const path = landing.rail.map(([x, z]) => [x, 6, z]);
  add(mouldGeo(path, [[-1.06, 9.2], [1.06, 9.2], [1.06, 10.5], [-1.06, 10.5]]), 'vrailWood');
  const string = Array.from({ length: 33 }, (_, i) => {
    const at = spiralAt(center, i / 33 * 0.04), a = at.a * Math.PI / 180;
    return [center[0] + Math.cos(a) * (at.outer - 0.3), Math.min(at.tread + 3.3, 5.9), center[1] + Math.sin(a) * (at.outer - 0.3)];
  });
  add(mouldGeo(string, [[-1.2, 0], [-1.2, -8], [1.2, -8], [1.2, 0]]), 'carved');
  for (let s = 0; s < 9; s++) {
    const at = spiralAt(center, s / SPIRAL.steps), a = at.a * Math.PI / 180;
    const run = 2 * Math.PI * (at.radius + 1) * SPIRAL.turns / SPIRAL.steps * 1.08;
    add(new THREE.BoxGeometry(SPIRAL.width, 3, run).rotateY(-a).translate(at.p[0], at.tread - 1.5, at.p[1]), 'step');
  }
  const route = vertigoApproach(center, 110, 6, 15), body = makeBody(root);
  const feet = new THREE.Vector3(route[0][0], 6, route[0][2]);
  try {
    for (const offset of [-2, 0, 2]) {
      const lane = route.map((p, i) => {
        const a = route[Math.max(0, i - 1)], b = route[Math.min(route.length - 1, i + 1)];
        const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
        return [p[0] - (b[2] - a[2]) / length * offset, p[1], p[2] + (b[0] - a[0]) / length * offset];
      });
      feet.set(lane[0][0], 6, lane[0][2]);
      for (const points of [lane, [...lane].reverse()]) {
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1], b = points[i];
          for (let k = 1; k <= 20; k++) {
            const x = a[0] + (b[0] - a[0]) * k / 20, z = a[2] + (b[2] - a[2]) * k / 20;
            const result = body.step(feet, new THREE.Vector3(x - feet.x, 0, z - feet.z), 0);
            assert(Math.hypot(feet.x - x, feet.z - z) < 0.1, `Entrance blocked at offset ${offset}, ${i}/${k}, feet ${feet.toArray()}, target ${x},${z}: ${result.stop}: ${body.why()}`);
            const expected = a[1] + (b[1] - a[1]) * k / 20 - 15;
            assert(Math.abs(feet.y - expected) < 2.2, `Unsupported entrance at ${i}/${k}: ${feet.y} / ${expected}`);
          }
        }
      }
    }
  } finally {
    body.dispose(); root.children.forEach(mesh => mesh.geometry.dispose()); material.dispose();
  }
});

test('looking down needs the inner rail and an inward gaze', () => {
  const stair = spiralAt(center, 0.06), angle = THREE.MathUtils.degToRad(stair.a);
  const feet = new THREE.Vector3(center[0] + Math.cos(angle) * (stair.edge + 5), stair.tread, center[1] + Math.sin(angle) * (stair.edge + 5));
  const inward = new THREE.Vector3(-Math.cos(angle), -1, -Math.sin(angle)).normalize();
  assert(railIntent(feet, inward, center));
  assert(!railIntent(feet, inward.clone().setY(0), center));
  assert(!railIntent(feet, inward.clone().multiplyScalar(-1).setY(-0.7), center));
  const far = feet.clone().add(new THREE.Vector3(Math.cos(angle) * 20, 0, Math.sin(angle) * 20));
  assert(!railIntent(far, inward, center));
  assert(!railIntent(feet.clone().setY(8), inward, center));
});

for (const railed of [false, true]) test(`real collision treads support descent through recycled turns and the return upward${railed ? ', railed' : ''}`, () => {
  const fixture = make({ railed }), { spiral } = fixture, body = makeBody(spiral.root);
  try {
    const start = spiralAt(center, 1.02);
    const feet = new THREE.Vector3(start.p[0], start.tread + 3, start.p[1]);
    feet.y = body.floorUnder(feet);
    assert.notEqual(feet.y, null);
    for (const direction of [1, -1]) {
      const from = direction > 0 ? 1.02 : 1.02 + 12 / SPIRAL.turns;
      for (let k = 1; k <= 4800; k++) {
        const at = spiralAt(center, from + direction * (12 / SPIRAL.turns) * k / 4800);
        if (spiral.update(at.tread)) body.refresh();
        const result = body.step(feet, new THREE.Vector3(at.p[0] - feet.x, 0, at.p[1] - feet.z), 0);
        assert(Math.hypot(feet.x - at.p[0], feet.z - at.p[1]) < 0.1, `Stopped on turn ${k}: ${result.stop}: ${body.why()}`);
        assert(Math.abs(feet.y - at.tread) < 2.2, `Wrong floor at ${k}: ${feet.y} / ${at.tread}`);
      }
    }
    assert.equal(spiral.root.children.filter(o => o.isGroup).length, 8);
    assert(Math.abs(feet.y - start.tread) < 2.2);
  } finally { body.dispose(); fixture.dispose(); }
});

test('the stair pool has fixed geometry even far beyond the initial turns', () => {
  const fixture = make(), { spiral } = fixture;
  try {
    const objects = []; spiral.root.traverse(o => { if (o.isMesh) objects.push(o); });
    const geometries = objects.map(o => o.geometry);
    for (const turns of [10, 100, 10000, 5, 0]) spiral.update(-440 - spiral.pitch * turns);
    const after = []; spiral.root.traverse(o => { if (o.isMesh) after.push(o.geometry); });
    assert.deepEqual(after, geometries);
    assert.equal(after.length, 33);
  } finally { fixture.dispose(); }
  // railed, each turn is its tread, its string, its iron, its walnut and its books
  const railed = make({ railed: true });
  try {
    const objects = []; railed.spiral.root.traverse(o => { if (o.isMesh) objects.push(o.geometry); });
    for (const turns of [10, 100, 10000, 5, 0]) railed.spiral.update(-440 - railed.spiral.pitch * turns);
    const after = []; railed.spiral.root.traverse(o => { if (o.isMesh) after.push(o.geometry); });
    assert.deepEqual(after, objects);
    assert.equal(after.length, 8 * 5 + 1);
  } finally { railed.dispose(); }
});

test('the live look-ahead course remains supported at long frame intervals', () => {
  for (const dt of [1 / 60, 0.4, 1.2]) {
    const fixture = make(), { spiral } = fixture, body = makeBody(spiral.root);
    try {
      const start = spiralAt(center, 1.02), feet = new THREE.Vector3(start.p[0], start.tread + 3, start.p[1]);
      feet.y = body.floorUnder(feet);
      const goal = feet.y - spiral.pitch * 3;
      let frames = 0;
      while (feet.y > goal && frames++ < 12000) {
        if (spiral.update(feet.y)) body.refresh();
        const at = spiral.aim(feet);
        const delta = new THREE.Vector3(at.p[0] - feet.x, 0, at.p[1] - feet.z).normalize().multiplyScalar(11.16 * dt);
        const result = body.step(feet, delta, 0);
        assert(result.moved > delta.length() * 0.8, `dt=${dt}, frame=${frames}, feet=${feet.toArray()}, ${body.why()}`);
      }
      assert(feet.y <= goal, `No continued descent with dt=${dt}`);
    } finally { body.dispose(); fixture.dispose(); }
  }
});
