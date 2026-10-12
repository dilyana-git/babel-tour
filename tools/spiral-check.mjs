import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SPIRAL, spiralAt, railIntent, makeEndlessSpiral } from '../src/world/spiral.js';
import { makeBody } from '../src/world/body.js';
import { endlessRail } from '../src/world/vertigoRail.js';

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
