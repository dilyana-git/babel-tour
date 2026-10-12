import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { makeBody, RADIUS } from '../src/world/body.js';
import { makeWalkCurve, makeWalkPace } from '../src/world/walkPath.js';

// Deterministic generated cases: failure messages identify the seed to replay.
const random = seed => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const mesh = (root, name, size, at, yaw = 0) => {
  const result = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
  result.name = name; result.position.set(...at); result.rotation.y = yaw; root.add(result);
  return result;
};
const dispose = (root, body) => {
  body.dispose(); root.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); });
};

for (const seed of [17, 391, 20261006, 0xdeadbeef]) {
  test(`generated oblique movement cannot cross thin walls (seed ${seed})`, () => {
    const rnd = random(seed);
    for (let caseIndex = 0; caseIndex < 24; caseIndex++) {
      const root = new THREE.Group();
      mesh(root, 'floor', [600, 2, 600], [0, -1, 0]);
      const angle = rnd() * Math.PI * 2, n = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const thickness = 0.1 + rnd() * 1.9, distance = 9 + rnd() * 20;
      mesh(root, 'wall', [thickness, 30, 500], [n.x * distance, 15, n.z * distance], -angle);
      const body = makeBody(root), feet = new THREE.Vector3();
      try {
        const tangent = new THREE.Vector3(-n.z, 0, n.x);
        const movement = n.clone().multiplyScalar(40 + rnd() * 100).addScaledVector(tangent, (rnd() - 0.5) * 60);
        body.step(feet, movement);
        assert(feet.dot(n) <= distance - thickness / 2 - RADIUS + 0.08,
          JSON.stringify({ seed, caseIndex, angle, feet: feet.toArray(), distance, thickness }));
        assert(feet.toArray().every(Number.isFinite));
      } finally { dispose(root, body); }
    }
  });

  test(`generated forward and reverse routes agree and retain bounded pace (seed ${seed})`, () => {
    const rnd = random(seed);
    for (let caseIndex = 0; caseIndex < 30; caseIndex++) {
      const controls = [new THREE.Vector3()];
      for (let i = 0; i < 8; i++) {
        const p = controls.at(-1).clone(), length = 8 + rnd() * 35;
        if (i % 2) p.z += (rnd() < 0.5 ? -1 : 1) * length;
        else p.x += length;
        p.y += rnd() * 4; controls.push(p);
      }
      const forward = makeWalkCurve(controls), back = makeWalkCurve([...controls].reverse());
      const pace = makeWalkPace(forward, 18);
      for (let i = 0; i <= 120; i++) {
        const t = i / 120, p = forward.getPointAt(t);
        assert(p.distanceTo(back.getPointAt(1 - t)) < 1e-6, `seed ${seed}, case ${caseIndex}, sample ${i}`);
        assert(p.toArray().every(Number.isFinite));
        const speed = pace(t * forward.getLength());
        assert(Number.isFinite(speed) && speed > 0 && speed <= 18, `seed ${seed}, case ${caseIndex}: pace ${speed}`);
      }
    }
  });

  test(`generated independent steps stay on supported ground (seed ${seed})`, () => {
    const rnd = random(seed), root = new THREE.Group();
    mesh(root, 'floor', [36, 2, 36], [0, -1, 0]);
    const body = makeBody(root), feet = new THREE.Vector3();
    try {
      for (let i = 0; i < 500; i++) {
        const angle = rnd() * Math.PI * 2;
        body.step(feet, new THREE.Vector3(Math.cos(angle) * 12, 0, Math.sin(angle) * 12));
        assert(Math.abs(feet.x) <= 18 && Math.abs(feet.z) <= 18 && feet.y === 0,
          JSON.stringify({ seed, step: i, feet: feet.toArray() }));
        assert.notEqual(body.floorUnder(new THREE.Vector3(feet.x, 15, feet.z)), null);
      }
    } finally { dispose(root, body); }
  });
}
