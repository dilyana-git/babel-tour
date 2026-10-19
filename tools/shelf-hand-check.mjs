import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeBody } from '../src/world/body.js';
import { bookOf, makeShelfHand, shelfRoute } from '../src/world/shelfHand.js';

const shelf = () => {
  const root = new THREE.Group();
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 4, 3), new THREE.MeshBasicMaterial(), 2);
  mesh.name = 'shelvedBooks';
  mesh.userData.books = [-2, 2].map((x, i) => ({ p:[x, 12, -20], read:{ room:0, hex:'CXI', wall:3, shelf:2, volume:i+1, inward:[0,1] } }));
  mesh.userData.books.forEach((b, i) => { mesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation(...b.p)); mesh.setColorAt(i,new THREE.Color('#402a26')); });
  mesh.computeBoundingSphere(); root.add(mesh); root.updateMatrixWorld(true);
  const feel = { sight:()=>true, floorUnder:()=>0 };
  const hand = makeShelfHand(root, feel);
  const camera = new THREE.PerspectiveCamera(58,1,0.5,1000); camera.position.set(2,12,0); camera.lookAt(2,12,-20); camera.updateMatrixWorld();
  return {root,mesh,hand,camera,feel};
};

test('the ray opens the hit instance, whose identity survives a second pick', () => {
  const {hand,camera} = shelf();
  const hit = hand.pick(camera,50,50,{left:0,top:0,width:100,height:100},0);
  assert.equal(hit.instance,1); assert.equal(bookOf(hit.item).volume,2);
  assert.deepEqual(bookOf(hit.item),bookOf(hand.pick(camera,50,50,{left:0,top:0,width:100,height:100},0).item));
  assert.equal(hand.pick(camera,50,50,{left:0,top:0,width:100,height:100},1),null);
  hand.dispose();
});

test('only the hovered spine warms, and leaving or disposal restores its colour', () => {
  const {hand,camera,mesh} = shelf();
  const before = new THREE.Color(), neighbour = new THREE.Color(); mesh.getColorAt(1,before); mesh.getColorAt(0,neighbour);
  hand.hover(hand.pick(camera,50,50,{left:0,top:0,width:100,height:100},0)); hand.tick(1);
  const after = new THREE.Color(), other = new THREE.Color(); mesh.getColorAt(1,after); mesh.getColorAt(0,other);
  assert(after.r > before.r); assert.deepEqual(other,neighbour);
  hand.hover(null); hand.tick(1); mesh.getColorAt(1,after); assert.deepEqual(after,before);
  hand.hover(hand.pick(camera,50,50,{left:0,top:0,width:100,height:100},0)); hand.tick(1); hand.dispose(); mesh.getColorAt(1,after); assert.deepEqual(after,before);
});

test('hidden, obstructed and out-of-reach books cannot be picked', () => {
  const {hand,camera,mesh,feel} = shelf(), bounds={left:0,top:0,width:100,height:100};
  feel.sight=()=>false; assert.equal(hand.pick(camera,50,50,bounds,0),null);
  feel.sight=()=>true; mesh.visible=false; assert.equal(hand.pick(camera,50,50,bounds,0),null);
  mesh.visible=true; feel.floorUnder=()=>-30; assert.equal(hand.pick(camera,50,50,bounds,0),null);
  hand.dispose();
});

test('a shelf approach goes around solid obstructions and refuses a sealed destination', () => {
  const root=new THREE.Group();
  const floor=new THREE.Mesh(new THREE.BoxGeometry(240,2,240),new THREE.MeshBasicMaterial()); floor.position.y=-1; floor.name='floor'; root.add(floor);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(20,30,40),new THREE.MeshBasicMaterial()); wall.position.y=15; wall.name='mass'; root.add(wall); root.updateMatrixWorld(true);
  const feel=makeBody(root), from=new THREE.Vector3(-65,0,0), to=new THREE.Vector3(65,0,0);
  const outline=[[-100,0,-100],[100,0,-100],[100,0,100],[-100,0,100]];
  assert.equal(feel.clear(from,to),false);
  const path=shelfRoute(feel,from,to,outline); assert(path?.length>2);
  for(let i=1;i<path.length;i++)assert(feel.clear(path[i-1],path[i]));
  assert.equal(shelfRoute(feel,from,new THREE.Vector3(0,0,0),outline),null);
  feel.dispose();
});
