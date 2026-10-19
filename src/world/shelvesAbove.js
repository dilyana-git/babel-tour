// Full bookcase walls continue above the Echo and Silence. Each storey uses
// the room's shelving and materials, with stone behind it and a dark lid above.
// Independent shelf streams preserve the garden's planting. The upper walls
// draw only near the room and below its wall tops, keeping the map open.
import * as THREE from 'three';
import { MASS_H, CAP, TIERS } from './build/common';

// the galleries whose walls go on up, by cell, and the room each is
export const SHELVES_ABOVE = { '1,-1': 1, '2,-2': 2 };
export const STOREY = MASS_H + CAP;
// how far up the lamps' chains are drawn there: into the dark, not to a stop
export const CHAIN_ABOVE = MASS_H + 3 * STOREY;
const LEVELS = 8;
// what a storey in the air has no use for: a shadow laid on a floor it has not got
const LEFT = new Set(['contact', 'shafts']);
// within this of the room's middle, and under its wall tops, the eye sees them
const NEAR = { 1: 300, 2: 170 };
// The rooms beside them with no walls going on up of their own, and the
// shape of their wall tops: from inside one of these, walls going on up next
// door are seen only through its arches, never over its wall tops (see `mask`).
const BESIDE = { '0,0': 'hex', '3,-3': 'round' };
// drawn after everything else that is solid, and the mask just before them
const ORDER = 8;

export function* buildShelvesAbove(ctx, { levels = LEVELS } = {}) {
  const { LB, Batch, shelfWall, edgeFrame, wallRing, slabGeo, cellC, rimAt, RC, root, keep } = ctx;
  // (each like the world's own, which stand aside while shelfWall draws; a
  // set to a room, so each room's are meshes of its own)
  const own = { ...LB };
  let up = null;
  const batch = (k) => (up[k] ??= new Batch(own[k].mat, { cast: false, receive: own[k].receive, project: own[k].project }));
  const sink = { add: (g) => { g.dispose?.(); return sink; } };
  // shelfWall's pieces, `dy` up, into batches of their own
  const raise = (dy, fn) => {
    const kept = { ...LB };
    for (const k of Object.keys(LB)) {
      LB[k] = LEFT.has(k) ? sink : { add(g, uvAt) { g.translate(0, dy, 0); batch(k).add(g, uvAt); return this; } };
    }
    try { fn(); } finally { Object.assign(LB, kept); }
  };
  const rooms = [];
  for (const [cell, room] of Object.entries(SHELVES_ABOVE)) {
    const c = cellC(...cell.split(',').map(Number)), rim = rimAt(c);
    up = {};
    for (let s = 1; s <= levels; s++) {
      raise(s * STOREY, () => {
        for (let k = 0; k < 6; k++) {
          const e = edgeFrame(c, k);
          shelfWall(e.i0, e.i1, [-e.n[0], -e.n[1]], { from: 0, to: TIERS - 1, room, detail: 1, stream: 0 });
        }
      });
      yield;
    }
    // the stone behind, unbroken (the hallways are a storey down), and its courses
    for (const piece of wallRing(c, rim, RC, () => [])) {
      batch('mass').add(slabGeo(piece, [], levels * STOREY, STOREY));
      for (let s = 1; s <= levels; s++) batch('cap').add(slabGeo(piece, [], CAP, s * STOREY + MASS_H));
    }
    rooms.push({ c, room, top: (levels + 1) * STOREY, rim, up });
  }
  const hold = new THREE.Group();
  hold.name = 'above';
  for (const r of rooms) {
    r.group = new THREE.Group();
    r.group.name = 'above';
    r.group.visible = false;
    hold.add(r.group);
  }
  // (a batch flushes into the world's root: taken out again into its room's
  // group at every step, not once it is done, so the world drawn while it
  // builds never has a room's walls standing in it ungated)
  for (const r of rooms) {
    for (const b of Object.values(r.up)) {
      const before = root.children.length;
      const take = () => { for (const m of root.children.slice(before)) r.group.add(m); };
      const steps = b.flushSteps('above');
      for (let n = steps.next(); !n.done; n = steps.next()) { take(); yield n.value; }
      take();
    }
  }
  const dark = keep(new THREE.MeshBasicMaterial({ color: '#000000' }));
  for (const { c, top, rim, group } of rooms) {
    const lid = new THREE.Mesh(keep(new THREE.CircleGeometry(rim + 2, 6).rotateX(Math.PI / 2)), dark);
    lid.position.set(c[0], top - 2, c[1]);
    lid.name = 'above';
    group.add(lid);
  }
  // From the room next door these walls are seen from behind, over that
  // room's own wall tops: a black tower in its sky (the Echo's over the
  // Vestibule, until the Vestibule's library has climbed over it; the
  // Silence's over the Vertigo's rim). Through its arch, though, the shelves
  // going on up are what that room is to see of the next one, so they cannot
  // simply be put out. Instead, while the eye is inside such a room, its
  // walls go on up too, unseen: a shell standing on its wall tops that
  // writes only depth, drawn after everything but these walls. Over the wall
  // tops it hides them and the sky shows; through an arch the eye passes
  // under it and they are there.
  for (const r of rooms) r.group.traverse((o) => { if (o.isMesh) o.renderOrder = ORDER; });
  const unseen = keep(new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
  const masks = Object.entries(BESIDE).map(([cell, shape]) => {
    const o = cellC(...cell.split(',').map(Number)), apothem = (rimAt(o) * Math.sqrt(3)) / 2;
    // on the wall tops, behind the wall's inner face and short of its outer one
    const H = (levels + 2) * STOREY;
    const geo = shape === 'hex'
      ? new THREE.CylinderGeometry((apothem + 14) / Math.cos(Math.PI / 6), (apothem + 14) / Math.cos(Math.PI / 6), H, 6, 1, true, Math.PI / 2)
      : new THREE.CylinderGeometry(106, 106, H, 48, 1, true);
    const m = new THREE.Mesh(keep(geo), unseen);
    m.position.set(o[0], STOREY + H / 2, o[1]);
    m.name = 'above';
    m.renderOrder = ORDER - 0.5;
    m.frustumCulled = false;
    m.visible = false;
    hold.add(m);
    const within = shape === 'hex'
      ? (x, z) => Math.max(Math.abs(z), Math.abs(x * 0.8660254 + z * 0.5), Math.abs(-x * 0.8660254 + z * 0.5)) < apothem
      : (x, z) => Math.hypot(x, z) < 101;
    return { m, at: (eye) => eye.y < STOREY && within(eye.x - o[0], eye.z - o[1]) };
  });
  root.add(hold);
  const show = (eye) => {
    let any = false;
    for (const { c, room, group } of rooms) {
      group.visible = !!eye && eye.y < 140 && Math.hypot(eye.x - c[0], eye.z - c[1]) < NEAR[room];
      any ||= group.visible;
    }
    for (const k of masks) k.m.visible = any && k.at(eye);
  };
  return { root: hold, show };
}
