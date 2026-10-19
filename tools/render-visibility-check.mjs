import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { makeDoorway } from '../src/world/doorway.js';
import { makeWater, WATER_Y } from '../src/world/water.js';

const cameraAt = (from, at, near = 0.1) => {
  const camera = new THREE.PerspectiveCamera(50, 4 / 3, near, 2000);
  camera.position.set(...from);
  camera.lookAt(...at);
  camera.updateMatrixWorld();
  return camera;
};
const renderer = () => ({
  draws: 0, target: null, shadowMap: { autoUpdate: true },
  getDrawingBufferSize: (out) => out.set(800, 600),
  getRenderTarget() { return this.target; },
  setRenderTarget(target) { this.target = target; },
  clear() {},
  render() { this.draws++; },
});

test('a doorway behind the eye or to its side does not render another scene', () => {
  const root = new THREE.Scene(), gl = renderer();
  const doorway = makeDoorway({ root, keep: (o) => o, at: [0, -10], out: [0, -1], half: 3, floor: 0, top: 10, by: [100, 0] });
  for (const at of [[0, 5, 10], [10, 5, 0]]) {
    doorway.render(gl, root, cameraAt([0, 5, 0], at), false);
    assert.equal(gl.draws, 0);
    assert(root.children.every((o) => !o.visible));
  }
  doorway.render(gl, root, cameraAt([0, 5, 0], [0, 5, -10]), true);
  assert.equal(gl.draws, 1);
  assert(root.children.every((o) => o.visible));
  doorway.dispose();
});

test('a doorway crossing the near plane still renders and crossing does not depend on looking at it', () => {
  const root = new THREE.Scene(), gl = renderer();
  const doorway = makeDoorway({ root, keep: (o) => o, at: [0, -1], out: [0, -1], half: 3, floor: 0, top: 10, by: [100, 0] });
  doorway.render(gl, root, cameraAt([0, 5, 0], [10, 5, -10]), false);
  assert.equal(gl.draws, 1);
  doorway.hide();
  assert(doorway.crossed(0, 1, 0, -0.5));
  doorway.dispose();
});

const pond = () => {
  const water = makeWater(), root = new THREE.Scene(), group = new THREE.Group();
  root.add(group);
  const geometry = new THREE.BoxGeometry(30, 0.3, 30).translate(0, WATER_Y - 0.15, -40);
  const mesh = water.surface(new THREE.Mesh(geometry, water.material({ c: [0, -40], rx: 15, rz: 15 })));
  group.add(mesh);
  return { water, root, group, mesh };
};

test('water reflects visible ponds, skips looking away, and refreshes immediately when looking back', () => {
  const { water, root } = pond(), gl = renderer();
  water.reflect(gl, root, cameraAt([0, 21, 0], [0, WATER_Y, -40]), 0);
  assert.equal(gl.draws, 1);
  water.reflect(gl, root, cameraAt([0, 21, 0], [0, 21, 40]), 0);
  assert.equal(gl.draws, 1);
  water.reflect(gl, root, cameraAt([0, 21, 0], [0, WATER_Y, -40]), 0);
  assert.equal(gl.draws, 2);
  water.dispose();
});

test('hidden water and visible fish do not request a reflection pass', () => {
  const { water, root, group, mesh } = pond(), gl = renderer();
  const fish = water.surface(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial()));
  fish.position.set(0, WATER_Y, -25);
  root.add(fish);
  group.visible = false;
  water.reflect(gl, root, cameraAt([0, 21, 0], [0, WATER_Y, -40]), 0);
  assert.equal(gl.draws, 0);
  group.visible = true;
  mesh.visible = false;
  water.reflect(gl, root, cameraAt([0, 21, 0], [0, WATER_Y, -40]), 0);
  assert.equal(gl.draws, 0);
  water.dispose();
});

test('a reflection restores hidden surface items and renderer state even if drawing throws', () => {
  const { water, root, mesh } = pond(), gl = renderer();
  const fish = water.surface(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial()));
  fish.visible = false;
  root.add(fish);
  const previous = {};
  gl.target = previous;
  gl.render = () => { throw new Error('draw failed'); };
  assert.throws(() => water.reflect(gl, root, cameraAt([0, 21, 0], [0, WATER_Y, -40]), 0), /draw failed/);
  assert.equal(mesh.visible, true);
  assert.equal(fish.visible, false);
  assert.equal(gl.target, previous);
  assert.equal(gl.shadowMap.autoUpdate, true);
  water.dispose();
});
