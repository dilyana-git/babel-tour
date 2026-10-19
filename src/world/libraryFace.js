// The Library seen from the garden: an open arcade of Doric columns,
// voussoir arches and a cornice, with lit galleries behind it. The rooms of
// the walk keep their walls. An invisible wall preserves the garden's walking
// boundary, so the galleries are looked into from here.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { stairSconce } from './lampPass';
import { MASS_H, CAP } from './build/common';

// The arcade in the wall: three bays to a wall, a Doric column at each
// corner and between, an impost over each capital for the arches to spring
// from, the arches' rings cut in thirteen voussoirs with a keystone, a
// spandrel wall over them and a cornice. (The Echo's orders: rooms/echo.js.)
export const ARCADE = { bays: 3, rad: 2.8, foot: 6, spring: 62, ring: 3.2, deep: 5.4, top: 86, cornice: 3.4, voussoirs: 13 };

// the rooms of the walk keep every stone
const ROUTE = ['0,0', '1,-1', '2,-2', '3,-3', '4,-4'];

// Whether edge k of a cell is the face: a gallery (not a room of the walk)
// whose neighbour across that edge is the garden.
export const faceEdge = ({ isGardenAt, NB }) => (cell, k) =>
  !cell.garden && !ROUTE.includes(cell.k) && isGardenAt(cell.i + NB[k][0], cell.j + NB[k][1]);

export function buildLibraryFace(ctx) {
  const { cells, hallway, edgeFrame, rimAt, HALL, add, LB, M, root, trialPanes, point,
    facePieces = [] } = ctx;
  if (!facePieces.length) return;
  const isFace = faceEdge(ctx);
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

  // the wall's own stone, laid in world units as every batched surface is (materials.js uvWorld)
  const uvWorld = (geo) => {
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  };
  // The wall's solid boundary is kept for body.js, which also reads hidden
  // meshes. Its prisms cover the same footprint and height as the masonry.
  const boundary = new THREE.Group();
  boundary.name = 'face-boundary';
  boundary.visible = false;
  const prismOf = (poly, y0, y1) => {
    const area = poly.reduce((acc, p, i) => { const q = poly[(i + 1) % poly.length]; return acc + p[0] * q[1] - q[0] * p[1]; }, 0);
    const pts = area > 0 ? poly : [...poly].reverse(), pos = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      pos.push(p[0], y0, p[1], p[0], y1, p[1], q[0], y1, q[1], p[0], y0, p[1], q[0], y1, q[1], q[0], y0, q[1]);
    }
    for (let i = 1; i < pts.length - 1; i++) {
      pos.push(pts[0][0], y1, pts[0][1], pts[i + 1][0], y1, pts[i + 1][1], pts[i][0], y1, pts[i][1]);
      pos.push(pts[0][0], y0, pts[0][1], pts[i][0], y0, pts[i][1], pts[i + 1][0], y0, pts[i + 1][1]);
    }
    return pos;
  };
  for (const [y0, y1, mat, name] of [[0, MASS_H, M.mass, 'mass'], [MASS_H, MASS_H + CAP, M.cap, 'cap']]) {
    const pos = facePieces.flatMap(({ piece }) => prismOf(piece, y0, y1));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = name;
    boundary.add(mesh);
  }
  root.add(boundary);

  // The arcade uses the world's own stone materials.
  const arcadeParts = { column: [], columnBox: [], carve: [], dressed: [] };
  const AB = Object.fromEntries(Object.keys(arcadeParts).map((k) => [k, { add: (g) => arcadeParts[k].push(g) }]));
  const { bays, rad, foot, spring, ring, deep, top, cornice, voussoirs: VS } = ARCADE;
  // a turned profile [radius, height], its uv in world units along the
  // profile and round it (as the Echo's colLathe)
  const colLathe = (prof, segs = 16) => {
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs);
    const along = [0];
    for (let i = 1; i < prof.length; i++) along.push(along[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
    const rMax = Math.max(...prof.map(([r]) => r)), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, along[Math.round(uv.getY(i) * (prof.length - 1))], uv.getX(i) * Math.PI * 2 * rMax);
    return g;
  };
  // the Echo's Attic base and Roman Doric capital, in units of the shaft's radius
  const BASE = [[1.22, 0], [1.33, 0.06], [1.32, 0.19], [1.2, 0.27], [1.07, 0.32], [1.04, 0.42], [1.13, 0.49], [1.16, 0.56], [1.12, 0.63], [1.04, 0.68], [1.0, 0.75]];
  const CAPITAL = [[0.83, -0.02], [0.9, 0.03], [0.9, 0.1], [0.845, 0.14], [0.845, 0.4], [0.885, 0.43], [0.865, 0.46], [0.9, 0.5],
    ...[0.2, 0.45, 0.7, 0.9, 1].map((s) => [0.9 + 0.34 * (1 - (1 - s) ** 2), 0.53 + 0.34 * s])];
  const plinthH = rad * 0.55, baseH = rad * 0.75, capH = rad * 1.15, impH = rad * 1.3;
  const shaftY = foot + plinthH + baseH, capY = spring - impH - capH, shaftH = capY - shaftY + rad * 0.02;
  const baseGeo = colLathe(BASE.map(([q, y]) => [q * rad, y * rad]));
  const capGeo = colLathe(CAPITAL.map(([q, y]) => [q * rad, y * rad]));
  // a plain shaft with entasis: straight for its lower third, drawn in to 0.86 at the neck
  const shaftGeo = colLathe(Array.from({ length: 7 }, (_, i) => { const t = i / 6; return [rad * (t < 1 / 3 ? 1 : 1 - 0.14 * ((t - 1 / 3) / (2 / 3)) ** 1.6), t * shaftH]; }), 16);
  const columnAt = new Map();
  const column = (p, ry) => {
    const key = p.map((v) => Math.round(v)).join(',');
    if (columnAt.has(key)) return;
    columnAt.set(key, true);
    const at = (g, y) => g.clone().rotateY(ry).translate(p[0], y, p[1]);
    AB.columnBox.add(at(new THREE.BoxGeometry(rad * 2.9, plinthH, rad * 2.9), foot + plinthH / 2));
    AB.column.add(at(baseGeo, foot + plinthH));
    AB.column.add(at(shaftGeo, shaftY));
    AB.column.add(at(capGeo, capY));
    AB.columnBox.add(at(new THREE.BoxGeometry(rad * 3.1, impH, rad * 3.1), capY + capH + impH / 2 - rad * 0.02));
  };
  for (const { piece } of facePieces) {
    const [i0, i1, o1, o0] = piece;
    // the wall's middle line, corner to corner
    const m0 = lerp(i0, o0, 0.5), m1 = lerp(i1, o1, 0.5);
    const L = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]), t = [(m1[0] - m0[0]) / L, (m1[1] - m0[1]) / L], n = [t[1], -t[0]];
    const ry = Math.atan2(-t[1], t[0]);
    const bay = L / bays, R = (bay - rad * 3.1) / 2;
    for (let k = 0; k <= bays; k++) column(lerp(m0, m1, k / bays), ry);
    for (let k = 0; k < bays; k++) {
      // the bay's own frame: x along the arcade, y up, z across it
      const o = lerp(m0, m1, (k + 0.5) / bays);
      const place = (g) => {
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          pos.setXYZ(i, o[0] + t[0] * x + n[0] * z, y, o[1] + t[1] * x + n[1] * z);
        }
        g.deleteAttribute('normal');
        g.computeVertexNormals();
        return g;
      };
      const extrude = (pts, z0, z1, segs = 1) => {
        const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
        return place(new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: segs }).translate(0, 0, z0));
      };
      // the ring: thirteen voussoirs through the arcade, the key standing proud and taller
      for (let v = 0; v < VS; v++) {
        const key = v === (VS - 1) / 2, a0 = (Math.PI * v) / VS + 0.012, a1 = (Math.PI * (v + 1)) / VS - 0.012;
        const ro = R + (key ? ring + 1.2 : ring), z = deep / 2 + (key ? 0.5 : 0.25);
        const at = (an, r) => [Math.cos(an) * r, spring + Math.sin(an) * r];
        AB.carve.add(extrude([at(a0, R), at(a1, R), at(a1, ro), at(a0, ro)], -z, z));
      }
      // the spandrel over it, up to the cornice, with the ring's extrados cut out of it
      const ARC = 16, outline = [[-bay / 2, spring], [-(R + ring), spring]];
      for (let i = 0; i <= ARC; i++) { const an = Math.PI - (Math.PI * i) / ARC; outline.push([Math.cos(an) * (R + ring), spring + Math.sin(an) * (R + ring)]); }
      outline.push([R + ring, spring], [bay / 2, spring], [bay / 2, top], [-bay / 2, top]);
      AB.dressed.add(extrude(outline, -deep / 2, deep / 2));
      // the cornice: a fillet, the corona standing out, a cap
      AB.carve.add(place(new THREE.BoxGeometry(bay, 0.6, deep + 0.8).translate(0, top + 0.3, 0)));
      AB.carve.add(place(new THREE.BoxGeometry(bay, cornice - 1.2, deep + 2.6).translate(0, top + 0.6 + (cornice - 1.2) / 2, 0)));
      AB.carve.add(place(new THREE.BoxGeometry(bay, 0.6, deep + 1.8).translate(0, top + cornice - 0.3, 0)));
    }
  }

  const arcade = new THREE.Group();
  arcade.name = 'face-arcade';
  {
    // (laid as their batches would lay them: the turned pieces and the
    // carving in their own uv, the boxes and the spandrels in world units)
    const MATS = { column: [M.column, false], columnBox: [M.column, true], carve: [M.carve, false], dressed: [M.dressed, true] };
    for (const [k, list] of Object.entries(arcadeParts)) {
      if (!list.length) continue;
      const [mat, project] = MATS[k];
      const flat = list.map((g) => {
        const f = g.index ? g.toNonIndexed() : g;
        if (project) uvWorld(f);
        for (const name of Object.keys(f.attributes)) if (!['position', 'normal', 'uv'].includes(name)) f.deleteAttribute(name);
        return f;
      });
      const g = mergeGeometries(flat, false);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = k;
      mesh.castShadow = mesh.receiveShadow = true;
      arcade.add(mesh);
    }
    root.add(arcade);
  }

  // One wall lantern on each pier of the galleries' hallways, either side
  // of the arch, a little above a reader's head.
  const faceCells = cells.filter((c) => [0, 1, 2, 3, 4, 5].some((k) => isFace(c, k)));
  for (const cell of faceCells) {
    const pier = (HALL / 2 + 3.2 + rimAt(cell.c) / 2) / 2 - 0.8;
    for (const k of [2, 5]) {
      if (!hallway(cell, k)) continue;
      const e = edgeFrame(cell.c, k), inward = [-e.n[0], -e.n[1]];
      const ry = Math.atan2(-inward[1], inward[0]);
      for (const s of [-1, 1]) {
        const lantern = stairSconce({ wall: add(e.mi, e.t, s * pier), ry, y: 33 });
        lantern.bronze.forEach((g) => LB.bronze.add(g));
        if (lantern.pane) trialPanes.push(lantern.pane);
      }
      point(add(e.mi, inward, 12), 44, '#ffb866', 2600, -1);
    }
  }
}
