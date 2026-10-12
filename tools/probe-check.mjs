import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { probeRay, probeClearance } from '../src/world/probe.js';

const box = (root, name, size, centre) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.name = name; mesh.position.set(...centre); root.add(mesh); return mesh;
};
const rawSection = (objects, from, direction, reach) => {
  const ray = new THREE.Raycaster(new THREE.Vector3(...from), new THREE.Vector3(...direction).normalize(), 0, reach);
  return ray.intersectObjects(objects, false).map(hit => ({ d: +hit.distance.toFixed(3), what: hit.object.name,
    facing: +hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(ray.ray.direction).toFixed(2) }));
};

test('probe sections retain every face and match native Three ray casting', () => {
  const root = new THREE.Group();
  const objects = [box(root, 'near', [2, 10, 10], [0, 0, 0]), box(root, 'far', [3, 12, 12], [10, 0, 0])];
  root.updateMatrixWorld(true);
  const from = [-20, 0.3, 0.4], direction = [1, 0, 0];
  assert.deepEqual(probeRay(root, from, direction, 50), rawSection(objects, from, direction, 50));
  assert.equal(probeRay(root, from, direction, 50).length, 4);
});
test('transformed probe sections retain material sides, distance and facing', () => {
  for (let i = 0; i < 24; i++) {
    const root = new THREE.Group(), mesh = box(root, 'stone', [2, 8, 10], [4, 0, 0]);
    mesh.rotation.y = i * 0.12; mesh.scale.set(0.7 + i * 0.03, 1.3, 0.9);
    mesh.material.side = i % 2 ? THREE.FrontSide : THREE.DoubleSide;
    root.updateMatrixWorld(true);
    const from = [-10, 0.3, 0.4], direction = [1, 0.01, 0.005];
    assert.deepEqual(probeRay(root, from, direction, 40), rawSection([mesh], from, direction, 40), `case ${i}`);
  }
});
test('clearance distinguishes outside stone from being buried inside it', () => {
  const root = new THREE.Group(); box(root, 'stone', [20, 20, 20], [0, 0, 0]); root.updateMatrixWorld(true);
  const outside = probeClearance(root, new THREE.Vector3(-20, 0.3, 0.4));
  assert.equal(outside.nearest.d, 10); assert.equal(outside.inside, 0);
  const inside = probeClearance(root, new THREE.Vector3(0.2, 0.3, 0.4));
  assert.equal(inside.inside, 1); assert(inside.nearest.back);
});
test('probe acceleration must not mutate rendered vertices, indices or mesh raycast methods', () => {
  const root = new THREE.Group(), mesh = box(root, 'stone', [2, 10, 10], [0, 0, 0]); root.updateMatrixWorld(true);
  const vertices = mesh.geometry.attributes.position.array.slice(), indices = mesh.geometry.index.array.slice(), method = mesh.raycast;
  probeRay(root, [-10, 0.3, 0.4], [1, 0, 0], 40);
  probeClearance(root, new THREE.Vector3(-10, 0.3, 0.4));
  assert.deepEqual(mesh.geometry.attributes.position.array, vertices);
  assert.deepEqual(mesh.geometry.index.array, indices);
  assert.equal(mesh.raycast, method);
  assert.equal(mesh.geometry.boundsTree, undefined);
});
