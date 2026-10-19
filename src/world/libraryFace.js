// The Library seen from the garden. It has no outside, only a face that is
// there until it is looked at. Hold the eye on the wall and it begins to give:
// first cracks, stepping down its joints from a few places; then a patch of it
// goes where the cracks are, taking what stood over it; then more; then the
// rest, from the top down, never all at once and never in rows. A stone that
// goes does not come away whole: its face breaks into pieces of every size,
// which fall fast and tumble and break on the ground in a little dust. What is
// left standing in the wall's place is an arcade — Doric columns, arches cut
// in voussoirs, a cornice — a structure of its own, as the Echo's arcades
// stand apart from the Echo's walls, built inside the wall's thickness. Through
// it, the galleries, their lanterns lit on the piers. Look away and the wall
// comes back; come back from the Library and it is whole.
//
// Only the face goes: the walls of the galleries that look onto the garden
// (shelves.js hands their stone over, and draws their cases into nothing),
// never a room of the walk — the Door keeps every stone. The walking body
// still feels the wall: the garden is looked into, not walked into.
//
// All of it is done to the wall's own pieces in the vertex shader of its own
// views of the wall's materials (nothing is discarded, and no other stone in
// the Library is touched by it). While the wall stands, a plain copy of it is
// drawn instead; the pieces only while they move.
//
// ?wface=0 leaves the face as it was.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { stairSconce } from './lampPass';
import { MASS_H, CAP } from './build/common';

const Q = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
const ON = Q.get('wface') !== '0';

// Times are seconds of looking (the wall's going runs only while it is looked at).
export const FACE = {
  open: 25,      // seconds of looking for the whole wall to go
  close: 40,     // and of looking elsewhere for it to come back
  leave: 1,      // and once the eye is back in the Library
  reach: 900,    // how far off the wall still answers the eye
  course: 9,     // a course of the wall's stones, and how long a stone is
  block: 19,
  // the stages: cracks, the first patches to give way, more, then the rest
  cracks: [2, 10], first: [6, 11], more: [10, 15], rest: [13, 20],
  // A piece's going: a moment loose (`loose`), then a fast fall under gravity
  // (`g`, units a second squared: a reader's eye, 23 up, is a metre and a
  // half), tumbling, until it strikes the ground (`ground`) and breaks
  // (`breaks`); a little dust where an outer stone struck (`dust` seconds).
  loose: 0.12, g: 190, ground: 3, breaks: 0.12, dust: 2.6,
};
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
  ON && !cell.garden && !ROUTE.includes(cell.k) && isGardenAt(cell.i + NB[k][0], cell.j + NB[k][1]);

// a material seen with the wall's going in it: everything the material is
// (every patch, as it stands when it is compiled), plus the going
let views = 0;
const f1 = (v) => v.toFixed(3);
// Each piece: the point it turns about (`aPivot`), its fall (`aFall`: its
// drift over the ground, its spin, and the moment it goes), and, on a stone's
// outer face, where in the stone it is and when its joints crack (`aJoint`:
// along, up, the moment). Its tumbling axis is its own, drawn from its pivot.
const goingHead = `
  attribute vec3 aPivot; attribute vec4 aFall; attribute vec3 aJoint;
  uniform float uFaceTime; uniform float uFaceBack;
  varying vec3 vFaceJoint;
  vec3 faceRot(vec3 v, vec3 k, float an) { float c = cos(an), s = sin(an); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
  vec3 faceAxis() { return normalize(fract(sin(aPivot * vec3(12.9898, 78.233, 37.719)) * 43758.5453) - 0.5 + vec3(0.0, 0.001, 0.0)); }
  float faceLand() { return sqrt(2.0 * max(aPivot.y - ${f1(FACE.ground)}, 0.0) / ${f1(FACE.g)}); }
  float faceAngle() {
    float t = uFaceTime - aFall.w;
    if (uFaceBack > 0.5 || t <= ${f1(FACE.loose)}) return 0.0;
    return aFall.z * min(t - ${f1(FACE.loose)}, faceLand());
  }
`;
const goingGlsl = `
  {
    float t = uFaceTime - aFall.w;
    vec3 l = transformed - aPivot, o = vec3(0.0);
    float sc = 1.0;
    if (uFaceBack > 0.5) sc = clamp(-t / 0.4, 0.0, 1.0);
    else if (t > 0.0) {
      float lo = min(t, ${f1(FACE.loose)}) / ${f1(FACE.loose)};
      float tf = max(t - ${f1(FACE.loose)}, 0.0), land = faceLand(), tl = min(tf, land);
      o.xz = aFall.xy * (0.06 * lo + tl);
      o.y = -0.5 * ${f1(FACE.g)} * tl * tl - 0.2 * lo;
      l = faceRot(l, faceAxis(), faceAngle());
      sc = 1.0 - clamp((tf - land) / ${f1(FACE.breaks)}, 0.0, 1.0);
    }
    transformed = aPivot + o + l * sc;
    float faceCrackAt = mod(aJoint.z, 100.0);
    vFaceJoint = vec3(aJoint.xy, step(50.0, aJoint.z) + 0.999 * smoothstep(faceCrackAt, faceCrackAt + 1.6, uFaceTime));
  }`;
const goingVert = (src) => goingHead + src
  .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = faceRot(objectNormal, faceAxis(), faceAngle());')
  .replace('#include <begin_vertex>', `#include <begin_vertex>${goingGlsl}`);
// the cracks: a stone's joints darkening and opening as its moment comes
const crackFrag = (src) => `varying vec3 vFaceJoint;\n${src.replace('#include <map_fragment>', `#include <map_fragment>
  if (vFaceJoint.x > -0.5 && vFaceJoint.z > 0.0) {
    // A stepped crack, as masonry cracks: down the head joint on one side of
    // the stone (vFaceJoint.z carries which, over 1.0 for the right), and
    // along half its bed joint from that side, wavering in width.
    float right = step(1.0, vFaceJoint.z), k = fract(vFaceJoint.z) * 1.0;
    float u = vFaceJoint.x, v = vFaceJoint.y;
    float waver = 0.45 + 0.55 * abs(sin(u * 17.0 + v * 5.0) * sin(u * 7.3 + 1.7));
    float w = 0.55 * k * waver;
    float dHead = (right > 0.5 ? 1.0 - u : u) * ${f1(FACE.block)};
    float onBed = right > 0.5 ? step(0.5, u) : step(u, 0.5);
    float dBed = v * ${f1(FACE.course)} + (1.0 - onBed) * 99.0;
    float line = 1.0 - smoothstep(w * 0.3, w, min(dHead, dBed));
    diffuseColor.rgb *= 1.0 - 0.85 * k * line;
  }`)}`;

export function buildLibraryFace(ctx) {
  const none = { libraryFace: { segs: [], lamps: [], meshes: [], tick: () => {}, hold: () => ({}) } };
  if (!ON) return none;
  const { cells, inGarden, hallway, edgeFrame, rimAt, HALL, RC, add, dir, LB, M, root, trialPanes, point,
    lightWishes, facePieces = [] } = ctx;
  if (!facePieces.length) return none;
  const U = { uFaceTime: { value: 0 }, uFaceBack: { value: 0 } };

  // The face: every edge of a gallery whose neighbour is garden, from corner
  // k to k + 1, its normal out to the grass (what the eye is tried on).
  const isFace = faceEdge(ctx);
  const segs = [];
  for (const cell of cells) {
    for (let k = 0; k < 6; k++) {
      if (!isFace(cell, k)) continue;
      segs.push({ a: add(cell.c, dir(60 * k), RC), b: add(cell.c, dir(60 * k + 60), RC), n: dir(60 * k + 30) });
    }
  }

  // ── the wall, as its stones and their pieces ──
  let seed = 911;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const span = ([lo, hi]) => lo + rnd() * (hi - lo);
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const byCell = new Map();
  const dusts = [];
  const NO_JOINT = [-1, -1, 1e4];
  // A prism over a convex polygon in plan from y0 to y1, its vertices carrying
  // the piece's pivot and fall; the faces that lie on the stone's outer face
  // (`face`: [O0, O1] and the stone's course) carry where in the stone they
  // are and when its joints crack.
  const prismInto = (out, poly, y0, y1, pivot, fall, face = null) => {
    const n = poly.length;
    const area = poly.reduce((acc, p, i) => { const q = poly[(i + 1) % n]; return acc + (p[0] * q[1] - q[0] * p[1]); }, 0);
    const pts = area > 0 ? poly : [...poly].reverse();
    const P = out.pos;
    const put = (verts, joint) => {
      for (const v of verts) {
        P.push(...v);
        out.pivot.push(...pivot); out.fall.push(...fall);
        out.joint.push(...(joint ? joint(v) : NO_JOINT));
      }
    };
    const onFace = (p) => face && Math.abs((p[0] - face.o0[0]) * face.n[0] + (p[1] - face.o0[1]) * face.n[1]) < 0.05;
    const jointOf = (v) => [((v[0] - face.o0[0]) * face.t[0] + (v[2] - face.o0[1]) * face.t[1]) / face.len, (v[1] - face.y0) / (face.y1 - face.y0), face.crack];
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const side = [[p[0], y0, p[1]], [p[0], y1, p[1]], [q[0], y1, q[1]], [p[0], y0, p[1]], [q[0], y1, q[1]], [q[0], y0, q[1]]];
      put(side, onFace(p) && onFace(q) ? jointOf : null);
    }
    for (let i = 1; i < n - 1; i++) {
      put([[pts[0][0], y1, pts[0][1]], [pts[i + 1][0], y1, pts[i + 1][1]], [pts[i][0], y1, pts[i][1]]]);
      put([[pts[0][0], y0, pts[0][1]], [pts[i][0], y0, pts[i][1]], [pts[i + 1][0], y0, pts[i + 1][1]]]);
    }
  };
  const centroid = (poly) => [poly.reduce((acc, p) => acc + p[0], 0) / poly.length, poly.reduce((acc, p) => acc + p[1], 0) / poly.length];
  const part = () => ({ pos: [], pivot: [], fall: [], joint: [] });

  for (const { piece, cell, k: edge } of facePieces) {
    const out = dir(60 * edge + 30), along = [-out[1], out[0]];
    if (!byCell.has(cell.k)) byCell.set(cell.k, { mass: part(), cap: part() });
    const into = byCell.get(cell.k);
    const [i0, i1, o1, o0] = piece;
    const len = Math.hypot(o1[0] - o0[0], o1[1] - o0[1]);
    const count = Math.max(2, Math.round(len / FACE.block));
    const courses = Math.round(MASS_H / FACE.course);
    const H = MASS_H + CAP;
    // the stones, course by course, breaking joint
    const rows = [];
    for (let c = 0; c <= courses; c++) {
      const capping = c === courses;
      const y0 = capping ? MASS_H : (c * MASS_H) / courses, y1 = capping ? H : ((c + 1) * MASS_H) / courses;
      const cuts = [0], shift = (c % 2) * 0.5;
      for (let k = 1; k < count + (shift ? 1 : 0); k++) { const t = (k - shift) / count; if (t > 0.02 && t < 0.98) cuts.push(t); }
      cuts.push(1);
      rows.push(cuts.slice(0, -1).map((t0, k) => ({ c, capping, y0, y1, t0, t1: cuts[k + 1], crack: Infinity, onset: Infinity, side: rnd() < 0.5 ? 0 : 1 })));
    }
    const stoneAt = (c, t) => rows[c]?.find((st) => t >= st.t0 && t <= st.t1);
    const uOf = (st) => ((st.t0 + st.t1) / 2) * len, yOf = (st) => (st.y0 + st.y1) / 2;
    // Cracks: from a few seeds, stepping down the joints one stone at a time,
    // always to the same side, now and then the other, a third of a second a stone.
    const paths = [];
    for (let n = 2 + Math.floor(rnd() * 2); n > 0; n--) {
      let c = Math.floor(courses * (0.35 + rnd() * 0.6)), t = 0.1 + rnd() * 0.8, side = rnd() < 0.5 ? -1 : 1;
      let time = span([FACE.cracks[0], FACE.cracks[0] + 0.6 * (FACE.cracks[1] - FACE.cracks[0])]);
      const path = [];
      for (let steps = 3 + Math.floor(rnd() * 7); steps > 0 && c >= 0; steps--) {
        const st = stoneAt(c, t);
        if (!st) break;
        st.crack = Math.min(st.crack, time);
        // (the head joint it runs down is the one on the side it steps to)
        st.side = side > 0 ? 1 : 0;
        path.push(st);
        if (rnd() < 0.2) side = -side;
        t = Math.min(0.99, Math.max(0.01, t + (side * (st.t1 - st.t0)) / 2));
        c -= 1;
        time += 0.3 + rnd() * 0.25;
      }
      if (path.length) paths.push(path);
    }
    // Patches giving way: where the cracks are first, then elsewhere; each
    // takes the stones round its middle and every stone over it to the top,
    // nearest first.
    const patch = (centre, time, half) => {
      const uc = uOf(centre), yc = yOf(centre);
      for (const row of rows) {
        for (const st of row) {
          const du = Math.abs(uOf(st) - uc), dy = yOf(st) - yc;
          const inside = dy >= 0 ? du < half * (1 + dy / H) : Math.hypot(du, dy * 1.6) < half * 0.7;
          if (!inside) continue;
          const at = time + Math.hypot(du, Math.max(-dy, 0) * 1.6, Math.max(dy, 0) * 0.35) / 32 + rnd() * 0.5;
          st.onset = Math.min(st.onset, at);
          st.crack = Math.min(st.crack, at - 1.2 - rnd() * 0.8);
        }
      }
    };
    for (const path of paths) if (rnd() < 0.75) patch(path[Math.floor(rnd() * path.length)], span(FACE.first), 8 + rnd() * 12);
    for (let n = 1 + Math.floor(rnd() * 2); n > 0; n--) {
      const row = rows[Math.floor(courses * (0.3 + rnd() * 0.65))];
      patch(row[Math.floor(rnd() * row.length)], span(FACE.more), 10 + rnd() * 16);
    }
    // and the rest, from the top down, scattered
    for (const row of rows) {
      for (const st of row) {
        const rest = FACE.rest[0] + (1 - yOf(st) / H) * (FACE.rest[1] - FACE.rest[0]) * 0.85 + rnd() * 1.4;
        st.onset = Math.min(st.onset, rest);
        st.crack = Math.min(st.crack, st.onset - 0.6 - rnd() * 0.6);
      }
    }
    // The stones, each as its pieces: the inner face stone whole, falling into
    // the gallery; the outer face broken by slanted cuts (and now and then
    // across its height) into pieces of every size, each with a fall of its own.
    for (const row of rows) {
      for (const st of row) {
        const target = st.capping ? into.cap : into.mass;
        const I0 = lerp(i0, i1, st.t0), I1 = lerp(i0, i1, st.t1), O1 = lerp(o0, o1, st.t1), O0 = lerp(o0, o1, st.t0);
        const M0 = lerp(I0, O0, 0.5), M1 = lerp(I1, O1, 0.5);
        // the inner
        {
          const cIn = centroid([I0, I1, M1, M0]), sp = 1 + rnd() * 2;
          prismInto(target, [I0, I1, M1, M0], st.y0, st.y1, [cIn[0], (st.y0 + st.y1) / 2, cIn[1]],
            [-out[0] * sp, -out[1] * sp, 1 + rnd() * 2, st.onset + 0.1]);
        }
        // the outer: cut across its depth at slants, into 1 to 3 slabs along it
        const fl = Math.hypot(O1[0] - O0[0], O1[1] - O0[1]);
        const face = { o0: O0, len: fl, t: [(O1[0] - O0[0]) / fl, (O1[1] - O0[1]) / fl], n: out, y0: st.y0, y1: st.y1, crack: st.crack + 100 * st.side };
        const ts = [0];
        for (let n = Math.floor(rnd() * 3); n > 0; n--) ts.push(0.15 + rnd() * 0.7);
        ts.sort((x, y) => x - y);
        ts.push(1);
        for (let k = 0; k < ts.length - 1; k++) {
          // (the cut's slant: where it meets the back and the face differ)
          const sa = k ? Math.min(0.97, Math.max(0.03, ts[k] + (rnd() - 0.5) * 0.25)) : 0, sb = k ? ts[k] : 0;
          const ea = k < ts.length - 2 ? Math.min(0.97, Math.max(0.03, ts[k + 1] + (rnd() - 0.5) * 0.25)) : 1, eb = ts[k + 1];
          const poly = [lerp(M0, M1, sa), lerp(M0, M1, ea), lerp(O0, O1, eb), lerp(O0, O1, sb)];
          const layers = rnd() < 0.45 ? [st.y0, st.y0 + (st.y1 - st.y0) * (0.35 + rnd() * 0.3), st.y1] : [st.y0, st.y1];
          for (let h = 0; h < layers.length - 1; h++) {
            const cp = centroid(poly), sp = 2 + rnd() * 5, sl = (rnd() - 0.5) * 3;
            const fall = [out[0] * sp + along[0] * sl, out[1] * sp + along[1] * sl, (2 + rnd() * 5) * (rnd() < 0.5 ? -1 : 1), st.onset + rnd() * 0.3];
            prismInto(target, poly, layers[h], layers[h + 1], [cp[0], (layers[h] + layers[h + 1]) / 2, cp[1]], fall, face);
          }
        }
        // a little dust where it strikes
        const oc = lerp(O0, O1, 0.5), y = (st.y0 + st.y1) / 2, land = Math.sqrt((2 * Math.max(y - FACE.ground, 0)) / FACE.g);
        dusts.push({ at: [oc[0] + out[0] * 4.5 * land, FACE.ground + 1, oc[1] + out[1] * 4.5 * land], struck: st.onset + FACE.loose + land });
      }
    }
  }
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
  const viewOf = (mat) => {
    const m = Object.create(mat);
    Object.defineProperty(m, 'id', { value: 3e7 + views++ });
    m.uuid = THREE.MathUtils.generateUUID();
    m._listeners = {};
    m.onBeforeCompile = function (sh, r) {
      mat.onBeforeCompile?.call(this, sh, r);
      Object.assign(sh.uniforms, U);
      sh.vertexShader = goingVert(sh.vertexShader);
      sh.fragmentShader = crackFrag(sh.fragmentShader);
    };
    m.customProgramCacheKey = () => `${mat.customProgramCacheKey ? mat.customProgramCacheKey.call(mat) : ''}|face`;
    return m;
  };
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); sh.vertexShader = goingVert(sh.vertexShader); };
  depth.customProgramCacheKey = () => 'libraryFace-depth';
  const massView = viewOf(M.mass), capView = viewOf(M.cap);
  const meshes = [];
  // The wall whole, as it is nearly all the time: each piece one plain prism
  // on the wall's own (shared) materials, a few hundred triangles in all. The
  // blocks are drawn only while the wall is going or coming back.
  const whole = new THREE.Group();
  whole.name = 'face-whole';
  {
    const prismOf = (quad, y0, y1) => {
      const o = part();
      prismInto(o, quad, y0, y1, [0, 0, 0], [0, 0, 0, 0]);
      return o.pos;
    };
    const mass = [], cap = [];
    for (const { piece } of facePieces) {
      mass.push(...prismOf(piece, 0, MASS_H));
      cap.push(...prismOf(piece, MASS_H, MASS_H + CAP));
    }
    for (const [pos, mat, name] of [[mass, M.mass, 'mass'], [cap, M.cap, 'cap']]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      uvWorld(g);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = name;
      mesh.castShadow = mesh.receiveShadow = true;
      whole.add(mesh);
    }
    root.add(whole);
  }
  const blocks = [];
  for (const { mass, cap } of byCell.values()) {
    for (const [part, mat, name] of [[mass, massView, 'mass'], [cap, capView, 'cap']]) {
      if (!part.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
      g.computeVertexNormals();
      uvWorld(g);
      g.setAttribute('aPivot', new THREE.Float32BufferAttribute(part.pivot, 3));
      g.setAttribute('aFall', new THREE.Float32BufferAttribute(part.fall, 4));
      g.setAttribute('aJoint', new THREE.Float32BufferAttribute(part.joint, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      // (named as the wall's own stone, so the walking body feels it: body.js)
      mesh.name = name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = depth;
      // (falling stones go a little outside the wall they were)
      g.boundingSphere.radius += 25;
      root.add(mesh);
      meshes.push(mesh);
      blocks.push(mesh);
    }
  }

  // ── the dust where each stone strikes ──
  // A puff to a stone (one that fell outward), rising and spreading from where it broke and
  // thinning out: a soft round of the stone's own dull colour, unlit (dim
  // enough to sit in the night), drawn only while it lasts.
  {
    const pos = [], struck = [], rand = [];
    for (const d of dusts) { pos.push(...d.at); struck.push(d.struck); rand.push(rnd()); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aStruck', new THREE.Float32BufferAttribute(struck, 1));
    g.setAttribute('aRand', new THREE.Float32BufferAttribute(rand, 1));
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    c2.fillStyle = gr;
    c2.fillRect(0, 0, 64, 64);
    const mat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cv), color: '#9a9283', size: 1, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0.3, fog: true });
    const life = `clamp((uFaceTime - aStruck) / ${f1(FACE.dust)}, 0.0, 1.0)`;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = `attribute float aStruck; attribute float aRand;
        uniform float uFaceTime; uniform float uFaceBack;
        varying float vPuff;\n${sh.vertexShader}`
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float tp = uFaceTime - aStruck, life = ${life};
          vPuff = (uFaceBack > 0.5 || tp <= 0.0 || life >= 1.0) ? 0.0 : smoothstep(0.0, 0.1, tp) * (1.0 - life) * (1.0 - life);
          transformed += vec3((aRand - 0.5) * 8.0 * life, 10.0 * sqrt(life), (fract(aRand * 7.31) - 0.5) * 8.0 * life);`)
        .replace('gl_PointSize = size;', `gl_PointSize = size * mix(7.0, 22.0, sqrt(${life})) * (0.7 + 0.6 * aRand) * step(0.001, vPuff);`);
      sh.fragmentShader = `varying float vPuff;\n${sh.fragmentShader}`
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vPuff;');
    };
    mat.customProgramCacheKey = () => 'libraryFace-dust';
    const puffs = new THREE.Points(g, mat);
    puffs.name = 'face-dust';
    puffs.frustumCulled = false;
    puffs.renderOrder = 3;
    root.add(puffs);
    blocks.push(puffs);
  }

  // ── the arcade inside it ──
  // Its own meshes on the world's own materials (no new programs), drawn only
  // once the wall has come down below its cornice: inside the wall it is
  // never seen, and its hundred thousand triangles need not be drawn.
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

  // ── the lanterns of the galleries behind the face ──
  // The stair's wall lantern (lampPass.js), one on each pier of a hallway,
  // either side of its arch, a little over a reader's head. Their light is
  // gated (light.js): none at all while the wall stands, so none falls on the
  // lawn through it, and it comes on as the wall goes.
  const faceCells = cells.filter((c) => [0, 1, 2, 3, 4, 5].some((k) => isFace(c, k)));
  const lamps = [];
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
      const wish = lightWishes[lightWishes.length - 1];
      wish.gate = 0;
      lamps.push(wish);
    }
  }

  // ── the eye on it ──
  // Whether the face is in the middle of the view: any of a few points over
  // each wall turned to the eye (along it, and up it) within LOOK of the
  // gaze, and within reach. (Not the one ray through the middle of the frame:
  // from the Pavilion that falls on the Door, which keeps its wall, while the
  // galleries' face fills the rest of the view.)
  const LOOK = Math.cos((16 * Math.PI) / 180);
  const SAMPLES = [0.1, 0.3, 0.5, 0.7, 0.9].flatMap((u) => [30, 85].map((y) => [u, y]));
  const seen = (eye, gaze) => {
    for (const { a, b, n } of segs) {
      if ((eye.x - a[0]) * n[0] + (eye.z - a[1]) * n[1] <= 0) continue;
      for (const [u, y] of SAMPLES) {
        const x = a[0] + (b[0] - a[0]) * u - eye.x, z = a[1] + (b[1] - a[1]) * u - eye.z, h = y - eye.y;
        const d = Math.hypot(x, h, z);
        if (d > FACE.reach) continue;
        if ((x * gaze.x + h * gaze.y + z * gaze.z) / d > LOOK) return true;
      }
    }
    return false;
  };
  let a = 0, last = null, held = null, back = 0;
  const saw = { eye: null, out: false, seen: false };
  // For the first few frames everything is drawn (the pieces in their beds
  // stand exactly where the plain wall does, and the arcade is inside it), so
  // every program and buffer is ready before anyone reaches the garden: drawn
  // for the first time in the middle of the wall's going, the arcade alone
  // held a frame for over a second.
  let warm = 4;
  const lazy = [...blocks, ...arcade.children];
  const show = () => {
    const warming = warm > 0;
    if (warming) warm -= 1;
    for (const m of lazy) m.frustumCulled = !warming && m.name !== 'face-dust';
    const moving = (a > 0 && a < 1) || warming;
    whole.visible = a <= 0 && !warming;
    for (const m of blocks) m.visible = moving;
    arcade.visible = a > 0 || warming;
  };
  const apply = () => {
    show();
    U.uFaceTime.value = a * FACE.open;
    U.uFaceBack.value = back;
    // the lanterns come on as the last of the wall goes
    const gate = Math.max(0, Math.min(1, (a - 0.7) / 0.25));
    for (const w of lamps) w.gate = gate;
  };
  const tick = (time, eye, gaze) => {
    const dt = last === null ? 0 : Math.min(0.1, Math.max(0, time - last));
    last = time;
    if (held !== null) a = held;
    else {
      const out = !!eye && inGarden([eye.x, eye.z]);
      const looking = out && !!gaze && seen(eye, gaze);
      Object.assign(saw, { eye: eye ? [eye.x, eye.y, eye.z].map(Math.round) : null, out, seen: looking });
      const was = a;
      if (looking) a = Math.min(1, a + dt / FACE.open);
      else a = Math.max(0, a - dt / (out ? FACE.close : FACE.leave));
      // (falling when it goes, reappearing in place when it comes back)
      if (a > was) back = 0;
      else if (a < was) back = 1;
    }
    apply();
  };
  // (headless checks: __worldFace(0.6) holds it that far gone; __worldFace(null) gives it back to the eye)
  const hold = (v) => {
    held = v === null || v === undefined ? null : Math.max(0, Math.min(1, v));
    if (held !== null) { a = held; back = 0; apply(); }
    return { a, saw, lamps: lamps.length, walls: facePieces.length, columns: columnAt.size };
  };
  if (typeof window !== 'undefined' && import.meta.env?.DEV) window.__worldFace = hold;
  return { libraryFace: { segs, lamps, meshes, tick, hold } };
}
