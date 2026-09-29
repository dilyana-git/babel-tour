// ── The Door's arch ──────────────────────────────────────────────────────────
// The way out of the Library was a slot: forty-nine units of broken wall open
// to the sky, and in it the pergola's first frame — two six-sided posts and a
// beam — which was the only arch the Door had. Every plate of the Door hangs a
// pointed arch in that wall instead, carved and deep, with green coming
// through it. This is that arch, built the way a Gothic doorway is built:
//
//   the orders   three, stepped back from the room into the wall, so the
//                opening is a funnel of stone and not a hole in a plane
//   the shafts   one in the nook of every step, polished dark marble on a
//                moulded base, ringed at mid height, under a leaf capital
//   the mouldings  ONE section per face, drawn once (a `profile`) and then
//                run straight up the jambs and round the arch (`sweep`), so a
//                roll that stands in a nook as a shaft below the capitals goes
//                on round the arch as the same roll above them — which is the
//                whole character of the thing
//   the hood     a drip moulding over the arch, dying into the piers
//   the gable    steep, over the hood, crocketed up both rakes to a finial,
//                a trefoil in a roundel in its field
//   the piers    a buttress each side, standing in front of the ends of the
//                bookcases, panelled, set off, and carried up into pinnacles
//   the garden face  the plain side of the wall: a ring of voussoirs, quoins,
//                a hood with a stop at each end
//
// Joints are cut in the stone, not painted on it — a voussoir is a groove
// round the arch every so many degrees, a course a groove across the jamb —
// because a painted joint on a carved roll is a stripe.
//
// Everything is built in the doorway's own frame and handed back by material:
// x across the opening (0 on its axis), y up (the world's height; the floor is
// at 6), z toward the room (0 on the inner face of the wall, which runs back to
// z = −25). buildWorld.js puts it in the wall.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const deg = Math.PI / 180;
const FLOOR = 6;
const HW = 13;                  // half the clear opening: 26 across, two and a half metres
const CEN = 13;                 // the arcs' centres, at ±13: an equilateral arch
const R0 = HW + CEN;            // the intrados' radius
const SPR = 46;                 // the springing
const WALL = 25;                // the wall's thickness
const Z0 = 5;                   // where the door line ends and the orders begin
const DA = 4.2, DZ = 4, ORDERS = 3;
const JAMB = ORDERS * DA;       // how far the orders reach across, from the door line
const ZS = Z0 + ORDERS * DZ + 0.6;   // the face of the spandrels
const ZG = ZS + 1.6;            // the face of the gable
const ZF = ZS + 3.2;            // the front of the piers
const PIER = 6.8;
const RC = 1.25;                // a shaft, and the roll it goes on as round the arch
const RB = 0.6;                 // the bead on an arris
const GARDEN = 4.5;             // the splay on the garden face
const IMPOST = SPR - 1.8;
const GABLE = { foot: 66, apex: 107 };
const PIN = { base: 90, top: 111 };
// height of a curve of radius R0 + a (a out from the intrados) over the crown
const crownAt = (a) => SPR + Math.sqrt((R0 + a) ** 2 - CEN ** 2);
// the underside of the opening at x, for a curve `a` out from the intrados
const soffitAt = (x, a = 0) => {
  const r = R0 + a, dx = Math.abs(x) + CEN;
  if (Math.abs(x) >= HW + a) return FLOOR;
  return SPR + Math.sqrt(Math.max(0, r * r - dx * dx));
};
export const PORTAL = { HW, CEN, R0, SPR, WALL, Z0, ZS, ZG, ZF, JAMB, PIER, FLOOR, crownAt, soffitAt, GABLE, PIN };

// ── Sections ─────────────────────────────────────────────────────────────────
// A moulding's section, in its own plane: `a` out from the opening into the
// stone, `z` toward the room. Traced with the air on the left (a to the right,
// z up), so every normal is known from the direction of travel. A point that
// is a crease keeps a sharp arris; every point of an `arc` between its ends
// is shaded smooth.
const profile = () => {
  const pts = [];
  const api = {
    pts,
    to(a, z, crease = true) { pts.push({ a, z, crease }); return api; },
    arc(ca, cz, r, t0, t1, n = 8) {
      for (let k = 0; k <= n; k++) {
        const t = t0 + ((t1 - t0) * k) / n;
        pts.push({ a: ca + r * Math.cos(t), z: cz + r * Math.sin(t), crease: k === 0 || k === n });
      }
      return api;
    },
    // a hollow cut into a face running along a (at z), or into a side running along z (at a)
    hollowA(a0, a1, z, d, n = 6) {
      for (let k = 1; k < n; k++) { const t = k / n; pts.push({ a: a0 + (a1 - a0) * t, z: z - d * Math.sin(Math.PI * t), crease: false }); }
      return api;
    },
    hollowZ(a, z0, z1, d, n = 6) {
      for (let k = 1; k < n; k++) { const t = k / n; pts.push({ a: a + d * Math.sin(Math.PI * t), z: z0 + (z1 - z0) * t, crease: false }); }
      return api;
    },
  };
  return api;
};

// Normals, and a length along the section for the texture. A crease is doubled
// (one copy for each face it divides), and the zero-width strip between the
// two copies is skipped when the surface is stitched.
const finish = (pts) => {
  const P = [];
  for (const p of pts) {
    const q = P[P.length - 1];
    if (q && Math.hypot(q.a - p.a, q.z - p.z) < 1e-4) { q.crease = q.crease || p.crease; continue; }
    P.push({ ...p });
  }
  const segN = [];
  for (let i = 0; i < P.length - 1; i++) {
    const da = P[i + 1].a - P[i].a, dz = P[i + 1].z - P[i].z, L = Math.hypot(da, dz);
    segN.push([-dz / L, da / L]);
  }
  const out = [];
  let v = 0;
  P.forEach((p, i) => {
    if (i) v += Math.hypot(p.a - P[i - 1].a, p.z - P[i - 1].z);
    const nIn = segN[i - 1], nOut = segN[i];
    if (!nIn || !nOut) {
      const n = nIn ?? nOut;
      out.push({ a: p.a, z: p.z, na: n[0], nz: n[1], v });
    } else if (p.crease) {
      out.push({ a: p.a, z: p.z, na: nIn[0], nz: nIn[1], v, seam: true });
      out.push({ a: p.a, z: p.z, na: nOut[0], nz: nOut[1], v });
    } else {
      const na = nIn[0] + nOut[0], nz = nIn[1] + nOut[1], L = Math.hypot(na, nz) || 1;
      out.push({ a: p.a, z: p.z, na: na / L, nz: nz / L, v });
    }
  });
  return out;
};

// A section carried along a path: `rings[i].at(a)` says where the point `a`
// out from the path lies on ring i, as [x, y, nx, ny] — its position in the
// x-y plane and the direction `a` grows in there. `rings[i].inset` sinks the
// whole section into the stone there, which is how a joint is cut: a ring
// either side of it at full depth, two in it sunk.
const sweep = (prof, rings, { tex = 1 / 13 } = {}) => {
  const P = finish(prof.pts);
  const nr = rings.length, np = P.length;
  const pos = new Float32Array(nr * np * 3), nor = new Float32Array(nr * np * 3), uv = new Float32Array(nr * np * 2);
  const run = new Float32Array(np);
  for (let i = 0; i < nr; i++) {
    const R = rings[i];
    for (let j = 0; j < np; j++) {
      const p = P[j], ins = R.inset || 0;
      const [x, y, nx, ny] = R.at(p.a - ins * p.na);
      const z = p.z - ins * p.nz, k = i * np + j;
      if (i) run[j] += Math.hypot(x - pos[(k - np) * 3], y - pos[(k - np) * 3 + 1], z - pos[(k - np) * 3 + 2]);
      pos.set([x, y, z], k * 3);
      const Nx = nx * p.na, Ny = ny * p.na, Nz = p.nz, L = Math.hypot(Nx, Ny, Nz) || 1;
      nor.set([Nx / L, Ny / L, Nz / L], k * 3);
      uv.set([run[j] * tex, p.v * tex], k * 2);
    }
  }
  const idx = [];
  const v3 = (k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
  for (let i = 0; i < nr - 1; i++) {
    for (let j = 0; j < np - 1; j++) {
      if (P[j].seam) continue;
      const a = i * np + j, b = (i + 1) * np + j, c = (i + 1) * np + j + 1, d = i * np + j + 1;
      // wound to face the way the section's normals say, whichever way round
      // the path runs (a mirrored half runs the other way)
      const A = v3(a), B = v3(b), C = v3(c), D = v3(d);
      const e1 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], e2 = [D[0] - B[0], D[1] - B[1], D[2] - B[2]];
      const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      let s = 0;
      for (const q of [a, b, c, d]) s += g[0] * nor[q * 3] + g[1] * nor[q * 3 + 1] + g[2] * nor[q * 3 + 2];
      if (s >= 0) idx.push(a, b, d, b, c, d);
      else idx.push(a, d, b, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.userData.swept = true;
  return geo;
};
// Everything else carved takes its texture by projection, at the mouldings'
// scale: an extrusion's own uv is its coordinates, which tiles the stone
// every unit, and a sphere's wraps one tile round a crocket.
const projectUv = (geo, tex = 1 / 13) => {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
    uv[i * 2] = u * tex;
    uv[i * 2 + 1] = v * tex;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
};

// Rings. `side` is −1 for the left of the opening, +1 for the right.
// Up a jamb: the opening's edge at x = side·(HW + off).
const jambRing = (side, y, inset = 0, off = 0) => ({ inset, at: (a) => [side * (HW + off + a), y, side, 0] });
// Round the arch, at angle `phi` from the springing, the curve `off` out from
// the intrados. Each point stops at the crown — the plane x = 0, where the two
// halves meet — so the outer members, which have further to go, are mitred
// there instead of overshooting it.
const archRing = (side, phi, inset = 0, off = 0) => ({
  inset,
  at: (a) => {
    const r = R0 + off + a, f = Math.min(phi, Math.acos(Math.min(1, CEN / r)));
    return [-side * (CEN - r * Math.cos(f)), SPR + r * Math.sin(f), side * Math.cos(f), Math.sin(f)];
  },
});
// the angle at which a curve `a` out from the intrados reaches the crown
const crownPhi = (a) => Math.acos(CEN / (R0 + a));

// Rings up a jamb from y0 to y1, with a bed joint every `course`.
const jambRings = (side, y0, y1, { course = 0, off = 0 } = {}) => {
  const out = [jambRing(side, y0, 0, off)];
  if (course) {
    const J = 0.09, DEPTH = 0.1;
    for (let y = y0 + course; y < y1 - course * 0.4; y += course) {
      out.push(jambRing(side, y - J - 0.05, 0, off), jambRing(side, y - J, DEPTH, off), jambRing(side, y + J, DEPTH, off), jambRing(side, y + J + 0.05, 0, off));
    }
  }
  out.push(jambRing(side, y1, 0, off));
  return out;
};
// Rings round one half of the arch, springing to crown, with `stones`
// voussoirs in the half (0 for none); `reach` is the outermost a the section
// has, which decides how far round the rings have to go.
const archRings = (side, { reach, stones = 0, step = 0.035, off = 0, from = 0 } = {}) => {
  const top = crownPhi(off + reach) + 1e-6;
  const cuts = [];
  if (stones) {
    const J = 0.2 / (R0 + off), DEPTH = 0.1;
    const inner = crownPhi(off);
    for (let s = 1; s < stones; s++) {
      const f = (inner * s) / stones;
      cuts.push([f - J / 2 - 0.004, 0], [f - J / 2, DEPTH], [f + J / 2, DEPTH], [f + J / 2 + 0.004, 0]);
    }
  }
  const phis = [];
  for (let f = from; f < top; f += step) phis.push([f, 0]);
  phis.push([top, 0]);
  const all = [...phis, ...cuts].sort((p, q) => p[0] - q[0]);
  // a joint's own rings win over a plain ring that falls inside it
  const out = [];
  for (let i = 0; i < all.length; i++) {
    const [f, ins] = all[i];
    const inCut = cuts.some(([g, d], k) => d && k % 4 === 1 && f > g && f < cuts[k + 1][0]);
    if (!ins && inCut) continue;
    out.push(archRing(side, f, ins, off));
  }
  return out;
};

// ── Solids ───────────────────────────────────────────────────────────────────
// An outline in the x-y plane, extruded toward the room from z0 to z1. With
// holes: outline CCW and holes CW, which is the pair three squares up itself.
const upright = (outline, z0, z1, holes = []) => {
  const wind = (pts, cw) => {
    const v = pts.map(([x, y]) => new THREE.Vector2(x, y));
    return THREE.ShapeUtils.isClockWise(v) === cw ? v : v.reverse();
  };
  const shape = new THREE.Shape(wind(outline, false));
  for (const h of holes) shape.holes.push(new THREE.Path(wind(h, true)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, z0);
  return g;
};
// An outline in the x-z plane (plan), laid flat and raised from y0 by h.
const slab = (plan, y0, h) => {
  const v = plan.map(([x, z]) => new THREE.Vector2(x, -z));
  const shape = new THREE.Shape(THREE.ShapeUtils.isClockWise(v) ? v.reverse() : v);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
};
const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
// The pointed opening a curve `a` out from the intrados, from the floor up and
// over, as a polyline (x, y) — for cutting it out of a wall.
const pointed = (a, n = 28, floor = FLOOR - 0.5) => {
  const pts = [[-(HW + a), floor], [-(HW + a), SPR]];
  const top = crownPhi(a), r = R0 + a;
  for (let k = 1; k <= n; k++) { const f = (top * k) / n; pts.push([CEN - r * Math.cos(f), SPR + r * Math.sin(f)]); }
  for (let k = n - 1; k >= 1; k--) { const f = (top * k) / n; pts.push([-(CEN - r * Math.cos(f)), SPR + r * Math.sin(f)]); }
  pts.push([HW + a, SPR], [HW + a, floor]);
  return pts;
};
// The same opening as a notch in a rectangle: one closed outline, no hole (a
// hole has to stop short of the outline it is cut in, and what it stops short
// by stands across the doorway — see wallRing in buildWorld.js).
const notched = (x0, x1, y0, y1, a) => [[x0, y0], ...pointed(a, 28, y0), [x1, y0], [x1, y1], [x0, y1]];
// What is over an arch a curve `a` out from the intrados, between x = ±X and
// up to yTop: the spandrels and the wall above, as one outline.
const aboveArch = (X, a, yTop, n = 28) => {
  const r = R0 + a, meet = Math.acos(Math.min(1, (CEN + X) / r)), top = crownPhi(a);
  const left = [];
  for (let k = 0; k <= n; k++) { const f = meet + ((top - meet) * k) / n; left.push([CEN - r * Math.cos(f), SPR + r * Math.sin(f)]); }
  const right = left.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  return [...left, ...right, [X, yTop], [-X, yTop]];
};

// A lathe about the y axis from [radius, height] pairs.
const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// ── Carving ──────────────────────────────────────────────────────────────────
// Foliage is what makes this carving, and the first cut of it was spheres —
// an ellipsoid with a ball on it for a crocket, a ring of them for a capital —
// which read, near the eye, as lumps of dough. A stone leaf reads by two
// things: the stalk it grows on, and the way its blade turns. So a leaf here
// is a lobed blade, cupped across (its edges turned back) and curled along
// its length, the tip rolling over; and every crocket is a stalk with one of
// them on it.
const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
// A blade grown from the origin along +y with its face toward +z, curled
// through `curl` radians (most of it near the tip) over toward +z.
const leafGeo = ({ len = 1.8, wid = 0.8, curl = 2.2, cup = 0.45, lobes = 3, nu = 12, nv = 6 } = {}) => {
  const spine = [];
  let p = V3(0, 0), th = 0;
  for (let i = 0; i <= nu; i++) {
    spine.push({ p: p.clone(), th });
    const mid = curl * ((i + 0.5) / nu) ** 1.6;
    p = p.clone().add(V3(0, Math.cos(mid), Math.sin(mid)).multiplyScalar(len / nu));
    th = curl * ((i + 1) / nu) ** 1.6;
  }
  const pos = [], idx = [];
  spine.forEach(({ p: sp, th: a }, i) => {
    const u = i / nu;
    // broadest past the middle, pointed at the tip, and lobed along the edge
    const w = wid * Math.sin(Math.PI * Math.min(1, u * 1.06)) ** 0.7 * (1 - 0.3 * Math.abs(Math.sin(Math.PI * lobes * u))) + 0.02;
    const n = V3(0, -Math.sin(a), Math.cos(a));
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * 2 - 1;
      // the edges turned back, and a midrib standing up the middle
      const q = sp.clone().add(V3(v * w, 0, 0)).addScaledVector(n, -cup * v * v * w + 0.14 * w * (1 - Math.abs(v)));
      pos.push(q.x, q.y, q.z);
    }
  });
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};
// a leaf set on in a frame: its growth along `grow`, curling toward `toward`
const leafOn = (opts, at, grow, toward) => {
  const Y = V3(...grow).normalize(), Z = V3(...toward);
  Z.addScaledVector(Y, -Z.dot(Y)).normalize();
  return leafGeo(opts).applyMatrix4(new THREE.Matrix4().makeBasis(V3().crossVectors(Y, Z), Y, Z).setPosition(...at));
};
const stalk = (pts, r = 0.2) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => V3(...q))), 8, r, 6, false);
const merged = (list) => {
  const g = mergeGeometries(list.map((p) => { const q = p.index ? p.toNonIndexed() : p; q.deleteAttribute('uv'); return q; }));
  list.forEach((p) => p.dispose());
  return g;
};

// A crocket on an edge. In its own frame +x runs UP the edge it climbs, +y
// out from it, z across: a stalk rising out of the edge, and a leaf carrying
// it on that turns over into a hook back toward the edge, a small leaf either
// side of the stalk's foot.
const crocketGeo = merged([
  stalk([[-0.25, -0.15], [0.02, 0.5], [0.42, 1.0]], 0.22),
  leafOn({ len: 1.9, wid: 0.8, curl: 2.9, cup: 0.5, lobes: 3 }, [0.42, 1.0, 0], [0.62, 0.78, 0], [0.78, -0.62, 0]),
  leafOn({ len: 0.95, wid: 0.42, curl: 1.3, cup: 0.3, lobes: 2, nu: 6, nv: 4 }, [0, 0.35, 0.12], [0.35, 0.45, 0.82], [0.6, 0.1, -0.2]),
  leafOn({ len: 0.95, wid: 0.42, curl: 1.3, cup: 0.3, lobes: 2, nu: 6, nv: 4 }, [0, 0.35, -0.12], [0.35, 0.45, -0.82], [0.6, 0.1, 0.2]),
]);
// A capital's crocket: the stalk runs up the bell from the necking, and the
// leaf at its head curls out and down under the corner of the abacus. Frame:
// +x up, +y out from the bell.
const capCrocketGeo = merged([
  stalk([[0, 0], [0.9, 0.12], [1.9, 0.5], [2.55, 0.95]], 0.2),
  leafOn({ len: 1.5, wid: 0.72, curl: 3.1, cup: 0.45, lobes: 3 }, [2.55, 0.95, 0], [0.62, 0.78, 0], [-0.78, 0.62, 0]),
]);
// Placed at `p`, climbing `up`, standing out toward `out` (made square to
// `up` here, so either can be given loosely).
const placeIn = (geo, p, up, out, s) => {
  const X = V3(up[0], up[1], up[2] ?? 0).normalize();
  const Y = V3(out[0], out[1], out[2] ?? 0);
  Y.addScaledVector(X, -Y.dot(X)).normalize();
  return geo.clone().scale(s, s, s).applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, V3().crossVectors(X, Y)).setPosition(p[0], p[1], p[2]));
};
const crocket = (p, up, out, s = 1) => placeIn(crocketGeo, p, up, out, s);
const capCrocket = (p, up, out, s = 1) => placeIn(capCrocketGeo, p, up, out, s);
// A boss of leaves, facing `face` from `p`: five blades round a bud.
const rosetteGeo = merged([
  ...Array.from({ length: 5 }, (_, k) => {
    const a = (k / 5) * Math.PI * 2;
    return leafOn({ len: 1.05, wid: 0.55, curl: 1.1, cup: 0.35, lobes: 3, nu: 8, nv: 4 }, [0, 0, 0.1], [Math.cos(a), Math.sin(a), 0.25], [0, 0, 1]);
  }),
  new THREE.SphereGeometry(0.42, 12, 8).scale(1, 1, 0.8).translate(0, 0, 0.35),
]);
const rosette = (p, face, s = 1) => {
  const Z = V3(...face).normalize(), X = Math.abs(Z.y) > 0.9 ? V3(1, 0, 0) : V3().crossVectors(V3(0, 1, 0), Z).normalize();
  return rosetteGeo.clone().scale(s, s, s).applyMatrix4(new THREE.Matrix4().makeBasis(X, V3().crossVectors(Z, X), Z).setPosition(...p));
};
// A finial: a stem with two knots of crockets round it and a pointed bud.
const finial = (p, s = 1) => {
  const [x, y, z] = p, out = [];
  out.push(new THREE.CylinderGeometry(0.55 * s, 0.75 * s, 3.2 * s, 12).translate(x, y + 1.6 * s, z));
  for (const [dy, k, n] of [[0.9, 1.05, 4], [3.3, 0.8, 4]]) {
    for (let q = 0; q < n; q++) {
      const a = (q / n) * Math.PI * 2 + (dy > 1 ? Math.PI / 4 : 0), o = [Math.cos(a), 0, Math.sin(a)];
      out.push(capCrocket([x + o[0] * 0.45 * s, y + dy * s, z + o[2] * 0.45 * s], [0, 1, 0], o, k * s));
    }
  }
  out.push(lathe([[0, 0], [0.62, 0.15], [0.85, 0.7], [0.72, 1.3], [0.3, 1.9], [0.1, 2.3], [0, 2.4]], 12).scale(s, s, s).translate(x, y + 5.3 * s, z));
  return out;
};

// A leaf capital's bell, and its abacus: an octagon, moulded underneath.
const bellGeo = (h, r0, r1) => lathe([[0, 0], [r0, 0], [r0 * 1.02, h * 0.18], [r0 * 1.12, h * 0.45], [r1 * 0.82, h * 0.78], [r1, h], [0, h]], 18);
const abacusGeo = (r) => lathe([[0, 0], [r * 0.86, 0], [r * 0.88, 0.12], [r * 0.93, 0.34], [r, 0.52], [r, 0.98], [r * 0.97, 1.05], [0, 1.05]], 8).rotateY(Math.PI / 8);

// ── The doorway ──────────────────────────────────────────────────────────────
export function buildPortal({ light = false } = {}) {
  const parts = { carve: [], dressed: [], mass: [], marble: [], bronze: [] };
  const C = (g) => parts.carve.push(g), D = (g) => parts.dressed.push(g);
  const rolls = light ? 8 : 12;

  // ── the wall filled back up ──
  // Through the wall, a pointed tunnel at the door line; on the garden face a
  // splay; everything above it laid up to the top of the wall again.
  D(upright(notched(-24.6, 24.6, FLOOR - 0.5, 120, 0), -WALL + GARDEN, Z0 - 1));
  parts.mass.push(upright(notched(-24.6, 24.6, FLOOR - 0.5, 120, GARDEN), -WALL, -WALL + GARDEN + 0.2));
  // the splay itself, from the garden face in to the door line
  const splay = profile().to(GARDEN, -WALL).to(0, -WALL + GARDEN);
  for (const side of [-1, 1]) {
    C(sweep(splay, jambRings(side, FLOOR - 0.5, SPR, { course: 7.3 })));
    C(sweep(splay, archRings(side, { reach: GARDEN, stones: 9 })));
  }
  // a rib across the tunnel's soffit, halfway through the wall
  const rib = profile().to(0.2, -11.4).to(-0.55, -11.4).to(-0.95, -11).to(-0.95, -9.2).to(-0.55, -8.8).to(0.2, -8.8);
  for (const side of [-1, 1]) {
    C(sweep(rib, jambRings(side, FLOOR + 2.4, IMPOST)));
    C(sweep(rib, archRings(side, { reach: 0.2, stones: 7, step: 0.05 })));
  }

  // ── the orders ──
  // Below the capitals the jamb is quiet — each step with a chamfered arris,
  // the shafts standing in its nooks. Above them the section is the whole
  // moulding: on every order a bead on the arris, a hollow, the roll the shaft
  // has become, a hollow on the return.
  const jamb = profile().to(0, Z0 - 1.2);
  for (let k = 0; k < ORDERS; k++) {
    const a0 = k * DA, a1 = a0 + DA, zf = Z0 + k * DZ;
    jamb.to(a0, zf - 0.55).to(a0 + 0.55, zf).to(a1, zf);
    if (k < ORDERS - 1) jamb.to(a1, zf + DZ - 0.55);
  }
  const arch = profile().to(0, Z0 - 1.2);
  for (let k = 0; k < ORDERS; k++) {
    const a0 = k * DA, a1 = a0 + DA, zf = Z0 + k * DZ;
    arch.to(a0, zf - RB).arc(a0, zf, RB, -Math.PI / 2, -2 * Math.PI, rolls - 3);
    arch.to(a0 + RB + 0.12, zf).hollowA(a0 + RB + 0.12, a1 - 2 * RC + 0.2, zf, 0.5).to(a1 - 2 * RC + 0.2, zf);
    arch.to(a1 - RC, zf).arc(a1 - RC, zf + RC, RC, -Math.PI / 2, -2 * Math.PI, rolls + 2);
    const z1 = (k < ORDERS - 1 ? zf + DZ : ZS) - RB - 0.12;
    arch.to(a1, zf + RC + 0.12).hollowZ(a1, zf + RC + 0.12, z1, 0.45).to(a1, z1);
  }
  arch.to(JAMB, ZS - RB).arc(JAMB, ZS, RB, -Math.PI / 2, -2 * Math.PI, rolls - 3).to(JAMB + 1.6, ZS);
  for (const side of [-1, 1]) {
    C(sweep(jamb, jambRings(side, FLOOR - 0.5, IMPOST + 0.3, { course: 7.3 })));
    C(sweep(arch, archRings(side, { reach: JAMB + 1.6, stones: 8, step: light ? 0.05 : 0.032 })));
  }

  // ── the shafts ──
  const nooks = Array.from({ length: ORDERS }, (_, k) => ({ a: (k + 1) * DA - RC, z: Z0 + k * DZ + RC }));
  const SHAFT = [11.6, IMPOST - 3.8];
  for (const side of [-1, 1]) {
    for (const n of nooks) {
      const x = side * (HW + n.a), z = n.z;
      // base: a little octagonal plinth, and on it an attic base — two rolls
      // and a hollow between them, the lower roll the bigger
      C(new THREE.CylinderGeometry(1.95, 1.95, 1.4, 8).rotateY(Math.PI / 8).translate(x, 8.9, z));
      C(lathe([[0, 0], [1.72, 0], [1.8, 0.35], [1.68, 0.72], [1.4, 0.82], [1.3, 1.05], [1.36, 1.25], [1.46, 1.42], [1.4, 1.62], [RC + 0.05, 1.8], [RC, 2], [0, 2]], 20).translate(x, 9.6, z));
      // the shaft, and the ring that ties it to the jamb halfway up
      parts.marble.push(new THREE.CylinderGeometry(RC, RC, SHAFT[1] - SHAFT[0], 20).translate(x, (SHAFT[0] + SHAFT[1]) / 2, z));
      const ringY = SHAFT[0] + (SHAFT[1] - SHAFT[0]) * 0.52;
      C(new THREE.TorusGeometry(RC + 0.14, 0.3, 8, 22).rotateX(Math.PI / 2).translate(x, ringY, z));
      C(new THREE.CylinderGeometry(RC + 0.2, RC + 0.2, 0.34, 20).translate(x, ringY + 0.42, z));
      C(new THREE.CylinderGeometry(RC + 0.2, RC + 0.2, 0.34, 20).translate(x, ringY - 0.42, z));
      // the capital: an astragal, a bell, crockets curling out under the
      // corners of the abacus and a row of stiff leaves round its foot
      const cap0 = SHAFT[1];
      C(new THREE.TorusGeometry(RC + 0.06, 0.26, 8, 22).rotateX(Math.PI / 2).translate(x, cap0 + 0.2, z));
      C(bellGeo(3.3, RC + 0.05, 2.2).translate(x, cap0 + 0.45, z));
      // Which way is out of the nook: away from the corner it stands in. A
      // crocket on a stalk up the bell to each of the three open corners of
      // the abacus, and a stiff leaf between each two, curling a little out.
      const corner = V3(side, 0, -1).normalize();
      for (let q = 0; q < 8; q++) {
        const ang = (q / 8) * Math.PI * 2 + Math.PI / 4;
        const o = [Math.cos(ang), 0, Math.sin(ang)];
        if (o[0] * corner.x + o[2] * corner.z > 0.5) continue;   // buried in the nook
        if (q % 2 === 0) {
          C(capCrocket([x + o[0] * (RC - 0.05), cap0 + 0.55, z + o[2] * (RC - 0.05)], [0, 1, 0], o, 1.08));
        } else if (!light) {
          C(leafOn({ len: 1.7, wid: 0.55, curl: 1.15, cup: 0.4, lobes: 3, nu: 8, nv: 4 }, [x + o[0] * (RC + 0.05), cap0 + 0.6, z + o[2] * (RC + 0.05)], [o[0] * 0.3, 1, o[2] * 0.3], o));
        }
      }
      C(abacusGeo(2.6).translate(x, cap0 + 3.72, z));
    }
  }

  // ── the plinth and the impost ──
  // The plan of one jamb as an outline round its steps and its pier, grown
  // out by `o` into the air: the plinth course at the foot, and the impost the
  // arch springs from, are this outline laid flat at two sizes each.
  // (The plinth turns the corner onto the garden face; the impost stops where
  // the splay begins, or it would run through the stops of the garden hood.)
  const plan = (side, o, garden = true) => {
    const pts = [
      ...(garden ? [[GARDEN - o * 0.4, -WALL - o], [-o, -WALL + GARDEN + o * 0.2]] : [[-o, -WALL + GARDEN + 0.4]]),
      [-o, Z0 + o],
      [DA - o, Z0 + o], [DA - o, Z0 + DZ + o], [2 * DA - o, Z0 + DZ + o], [2 * DA - o, Z0 + 2 * DZ + o],
      [JAMB - o, Z0 + 2 * DZ + o], [JAMB - o, ZF + o], [JAMB + PIER + o, ZF + o], [JAMB + PIER + o, -0.3],
      [JAMB + 0.4, -0.3], [JAMB + 0.4, garden ? -WALL - o : -WALL + GARDEN + 0.4],
    ];
    return pts.map(([a, z]) => [side * (HW + a), z]);
  };
  for (const side of [-1, 1]) {
    C(slab(plan(side, 1.8), FLOOR - 0.5, 2));
    C(slab(plan(side, 1.25), FLOOR + 1.5, 0.8));
    C(slab(plan(side, 0.7), FLOOR + 2.3, 0.4));
    C(slab(plan(side, 1.1, false), IMPOST, 0.9));
    C(slab(plan(side, 1.75, false), IMPOST + 0.9, 0.9));
  }

  // ── the spandrels, and the wall over the arch ──
  D(upright(aboveArch(HW + JAMB, JAMB + 1.4, 120), Z0 - 1.25, ZS));
  // a cap on it, level with the top of the wall behind, and the cap along the
  // top of the wall itself, where the breach had taken it off
  C(box(-(HW + JAMB) - 0.2, HW + JAMB + 0.2, 120, 121.3, Z0 - 1.25, ZS + 1.1));
  C(box(-24.6, 24.6, 120, 123, -WALL, 0));

  // ── the hood ──
  const hood = profile()
    .to(JAMB + 0.8, ZS - 0.4).to(JAMB + 0.8, ZS + 0.7).to(JAMB + 0.55, ZS + 0.95)
    .arc(JAMB + 1.4, ZS + 1.6, 0.82, 217 * deg, 20 * deg, rolls)
    .to(JAMB + 3.9, ZS + 0.35).to(JAMB + 4.1, ZS - 0.4);
  for (const side of [-1, 1]) C(sweep(hood, archRings(side, { reach: JAMB + 4.1, step: 0.03 })));

  // ── the gable ──
  // Its underside rides the hood; its rakes run from the piers to the apex.
  const X = HW + JAMB;
  const rake = [[-X, GABLE.foot], [0, GABLE.apex]];
  {
    const rHood = R0 + JAMB + 2.6, top = crownPhi(JAMB + 2.6);
    const meet = Math.acos((CEN + X) / rHood);
    const arcPts = [];
    for (let k = 0; k <= 24; k++) { const f = meet + ((top - meet) * k) / 24; arcPts.push([CEN - rHood * Math.cos(f), SPR + rHood * Math.sin(f)]); }
    const outline = [[-X, GABLE.foot], [0, GABLE.apex], [X, GABLE.foot], ...arcPts.map(([x, y]) => [-x, y]), ...arcPts.reverse().slice(1)];
    // (smooth stone, not coursed: the field is the ground its tracery is read on)
    C(upright(outline, ZS - 0.3, ZG));
  }
  // the coping up both rakes, mitred at the apex, and the crockets on it
  const coping = profile()
    .to(-2.1, ZG - 0.3).to(-2.1, ZG + 0.55).to(-1.65, ZG + 1.0).to(0.7, ZG + 1.0)
    .arc(0.7, ZG + 0.4, 0.6, Math.PI / 2, 0, 6)
    .to(1.3, ZS - 0.4);
  {
    const d = [rake[1][0] - rake[0][0], rake[1][1] - rake[0][1]], L = Math.hypot(d[0], d[1]);
    const u = [d[0] / L, d[1] / L];
    for (const side of [-1, 1]) {
      // up the rake toward the apex, and out from the gable square to it
      const up = side < 0 ? u : [-u[0], u[1]];
      const out = side < 0 ? [-u[1], u[0]] : [u[1], u[0]];
      const foot = [side * X, GABLE.foot];
      const start = [foot[0] - up[0] * 1.2, foot[1] - up[1] * 1.2];
      // the kneeler: the block the coping starts from, bonded into the pier
      C(box(Math.min(side * (X - 2.8), side * (X + 0.6)), Math.max(side * (X - 2.8), side * (X + 0.6)), GABLE.foot - 4.2, GABLE.foot + 0.9, ZS - 0.3, ZG + 1.4));
      const ringAt = (t, mitre) => ({
        at: (a) => {
          let x = start[0] + up[0] * t + out[0] * a, y = start[1] + up[1] * t + out[1] * a;
          if (mitre) { const s = -x / up[0]; x += up[0] * s; y += up[1] * s; }
          return [x, y, out[0], out[1]];
        },
      });
      const run = Math.hypot(-start[0], GABLE.apex - start[1]);
      C(sweep(coping, [ringAt(0, false), ringAt(run, true)]));
      // Cusping under the coping: a row of foils, each an arc bulging up
      // under the stone with a cusp hanging at either end — the fringe that
      // turns a sloped edge into tracery.
      {
        const t0 = 3.4, t1 = run - 4.2, foils = 6, P = (t, a) => [start[0] + up[0] * t + out[0] * a, start[1] + up[1] * t + out[1] * a];
        const edge = [P(t0, -1.95), P(t1, -1.95)];
        for (let k = foils - 1; k >= 0; k--) {
          for (let m = 10; m >= (k === 0 ? 0 : 1); m--) {
            const f = m / 10, t = t0 + ((t1 - t0) * (k + f)) / foils;
            edge.push(P(t, -2.5 - 1.55 * (1 - Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2)))));
          }
        }
        C(upright(edge, ZG - 0.25, ZG + 1.25));
      }
      // crockets, one every few units, leaning up the rake
      const n = light ? 5 : 8;
      for (let k = 1; k <= n; k++) {
        const t = 3.2 + ((run - 6.5) * (k - 0.5)) / n;
        const q = [start[0] + up[0] * t + out[0] * 1.3, start[1] + up[1] * t + out[1] * 1.3];
        C(crocket([q[0], q[1], ZG - 0.1], up, out, 1.15));
      }
    }
  }
  // the finial: a stem, two knots of crockets, a pointed bud
  finial([0, GABLE.apex + 0.9, ZG - 0.4], 1.15).forEach(C);
  // A trefoil in a roundel in the gable's field: the largest circle the field
  // holds, clear of the hood below it and of the coping over both rakes.
  {
    const floorY = crownAt(JAMB + 4.1) + 0.5;
    const sinT = X / Math.hypot(X, GABLE.apex - GABLE.foot);   // the rake's lean from the vertical
    const cy = (floorY + sinT * GABLE.apex - 2.7) / (1 + sinT);
    const R = cy - floorY;
    const ring = (r, n = 48) => Array.from({ length: n }, (_, k) => [Math.cos((k / n) * Math.PI * 2) * r, cy + Math.sin((k / n) * Math.PI * 2) * r]);
    C(upright(ring(R), ZG - 0.2, ZG + 1.5, [ring(R - 0.95)]));
    C(upright(ring(R + 0.55), ZG - 0.2, ZG + 0.7, [ring(R)]));
    // the foils: three lobes, the outline of each drawn as the furthest of
    // three circles in each direction, a band of stone between two of them
    const trefoil = (lobe, n = 90) => Array.from({ length: n }, (_, k) => {
      const th = (k / n) * Math.PI * 2;
      let best = 0;
      for (let f = 0; f < 3; f++) {
        const c = Math.PI / 2 + (f * Math.PI * 2) / 3, cx = Math.cos(c) * R * 0.36, cz = Math.sin(c) * R * 0.36;
        // distance from the centre, along th, to the far side of this lobe
        const b = cx * Math.cos(th) + cz * Math.sin(th), q = cx * cx + cz * cz - lobe * lobe;
        const disc = b * b - q;
        if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
      }
      return [Math.cos(th) * best, cy + Math.sin(th) * best];
    });
    C(upright(trefoil(R * 0.5), ZG - 0.2, ZG + 1.2, [trefoil(R * 0.37)]));
    // a boss of leaves where the three foils meet
    C(rosette([0, cy, ZG + 0.5], [0, 0, 1], 0.9));
  }

  // ── the piers ──
  // A buttress each side, standing in front of the end of the bookcase: two
  // stages with a weathered set-off between, a blind lancet on each face of
  // each stage, a gablet at the top of its face and a pinnacle over it.
  const panel = (x0, x1, y0, y1, z) => {
    // a sunk lancet: its frame stands out from the face, the field inside it is the face
    const w = (x1 - x0) / 2, cx = (x0 + x1) / 2;
    const lancet = (inset) => {
      const pts = [[cx - w + inset, y0 + inset], [cx + w - inset, y0 + inset], [cx + w - inset, y1]];
      const r = 2 * w - 2 * inset, n = 10;
      for (let k = 1; k <= n; k++) { const f = (Math.PI / 3) * (k / n); pts.push([cx - w + inset + r * Math.cos(f), y1 + r * Math.sin(f)]); }
      for (let k = n - 1; k >= 0; k--) { const f = (Math.PI / 3) * (k / n); pts.push([cx + w - inset - r * Math.cos(f), y1 + r * Math.sin(f)]); }
      return pts;
    };
    return upright(lancet(0), z - 0.3, z + 0.55, [lancet(0.6)]);
  };
  for (const side of [-1, 1]) {
    const x0 = side * X, x1 = side * (X + PIER), lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    D(box(lo, hi, FLOOR + 2, 60, -0.2, ZF));
    // The set-off: where the pier steps back, a sloped weathering to throw the
    // water off — drawn as its side view and run across the pier.
    {
      const y0 = 60, y1 = 62.6, zb = ZF - 1.4, w = hi - lo + 0.6;
      const side = [[-0.2, y0], [ZF + 0.3, y0], [ZF + 0.3, y0 + 0.35], [zb, y1], [-0.2, y1]];
      C(upright(side, 0, w).rotateY(-Math.PI / 2).translate(hi + 0.3, 0, 0));
      C(box(lo - 0.3, hi + 0.3, y0 - 0.7, y0, -0.2, ZF + 0.3));
    }
    D(box(lo + 0.3, hi - 0.3, 62.6, PIN.base - 2, -0.2, ZF - 1.4));
    C(box(lo - 0.1, hi + 0.1, PIN.base - 2, PIN.base - 0.8, -0.2, ZF - 1.2));
    C(box(lo - 0.4, hi + 0.4, PIN.base - 0.8, PIN.base, -0.2, ZF - 0.9));
    // blind lancets on the front of each stage, clear of the impost
    const cx = (lo + hi) / 2;
    C(panel(cx - 2.2, cx + 2.2, FLOOR + 5, IMPOST - 4.6, ZF));
    C(panel(cx - 2.2, cx + 2.2, SPR + 2.2, 55.8, ZF));
    C(panel(cx - 2, cx + 2, 64.6, 77.4, ZF - 1.4));
    // a gablet at the head of the upper stage's face
    {
      const gz = ZF - 1.4, gy = 82.5, gw = (hi - lo) / 2 - 0.2;
      const tri = [[cx - gw, gy], [cx + gw, gy], [cx, gy + gw * 1.25]];
      C(upright(tri, gz - 0.2, gz + 0.9));
      for (const s of [-1, 1]) C(crocket([cx + s * gw * 0.5, gy + gw * 0.62 + 0.3, gz + 0.3], [-s * 0.62, 0.78], [s * 0.78, 0.62], 0.62));
      finial([cx, gy + gw * 1.25 - 0.2, gz + 0.3], 0.42).forEach(C);
    }
    // the pinnacle: a square shaft with a gablet on each face, a spire over
    // it with crockets up its four edges, a finial
    {
      const pz = (ZF - 1.4) * 0.55, pw = 2.3, y0 = PIN.base, ys = y0 + 7.2;
      C(box(cx - pw, cx + pw, y0, ys, pz - pw, pz + pw));
      for (let f = 0; f < 4; f++) {
        const a = (f * Math.PI) / 2;
        const g = upright([[-pw, 0], [pw, 0], [0, pw * 1.45]], -0.4, 0.4).translate(0, ys - 0.2, pw + 0.2);
        C(g.rotateY(a).translate(cx, 0, pz));
      }
      C(box(cx - pw - 0.35, cx + pw + 0.35, ys - 0.4, ys + 0.4, pz - pw - 0.35, pz + pw + 0.35));
      const spireH = PIN.top - ys - 2.4;
      C(new THREE.ConeGeometry(pw * 1.3, spireH, 4, 1).rotateY(Math.PI / 4).translate(cx, ys + spireH / 2, pz));
      const n = light ? 2 : 3;
      for (let f = 0; f < 4; f++) {
        const a = (f * Math.PI) / 2 + Math.PI / 4;
        const e = [Math.cos(a), Math.sin(a)];
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1), r = pw * 1.3 * (1 - t);
          const up = [-e[0] * pw * 1.3, spireH, -e[1] * pw * 1.3];
          C(crocket([cx + e[0] * (r + 0.1), ys + spireH * t, pz + e[1] * (r + 0.1)], up, [e[0], 0.15, e[1]], 0.62));
        }
      }
      finial([cx, PIN.top - 3.2, pz], 0.6).forEach(C);
    }
    // a stop where the hood dies into the pier: a boss of leaves
    {
      const f = Math.acos((CEN + X) / (R0 + JAMB + 1.4));
      const y = SPR + (R0 + JAMB + 1.4) * Math.sin(f) - 0.9;
      C(rosette([side * (X - 0.5), y, ZS + 1.3], [0, 0, 1], 1.35));
    }
  }

  // ── the garden face ──
  // The plain side of the wall, and the side a reader walks back to: a ring of
  // voussoirs round the arch standing proud of the wall, quoins down the
  // jambs, and a hood with a stop at each foot.
  const ring = profile().to(GARDEN + 5, -WALL + 0.1).to(GARDEN + 5, -WALL - 0.5).to(GARDEN + 4.7, -WALL - 0.8).to(GARDEN + 0.3, -WALL - 0.8).to(GARDEN, -WALL - 0.5).to(GARDEN, -WALL + 0.1);
  const gHood = profile()
    .to(GARDEN + 7.9, -WALL + 0.1).to(GARDEN + 7.9, -WALL - 1.3)
    .arc(GARDEN + 6.9, -WALL - 1.3, 1, 0, -Math.PI * 0.5, 6)
    .to(GARDEN + 5.4, -WALL - 2.3).to(GARDEN + 5.2, -WALL - 1.6).to(GARDEN + 5.2, -WALL + 0.1);
  for (const side of [-1, 1]) {
    C(sweep(ring, archRings(side, { reach: GARDEN + 5, stones: 9, step: 0.04 })));
    C(sweep(gHood, archRings(side, { reach: GARDEN + 7.9, step: 0.04 })));
    // quoins: long and short by turns, standing a little proud
    for (let q = 0, y = FLOOR + 0.5; y < SPR - 1; q++) {
      const h = Math.min(4.6, SPR - y), long = q % 2 === 0;
      const a0 = GARDEN, a1 = GARDEN + (long ? 7.2 : 4.6);
      const xa = side * (HW + a0), xb = side * (HW + a1);
      C(box(Math.min(xa, xb), Math.max(xa, xb), y, y + h - 0.28, -WALL - 0.6, -WALL + 0.1));
      y += h;
    }
    // the stop at the hood's foot
    const sx = side * (HW + GARDEN + 6.6);
    C(rosette([sx, SPR - 1.6, -WALL - 0.6], [0, 0, -1], 1.6));
  }
  // a plain threshold stone, worn, across the door line
  C(box(-HW + 0.2, HW - 0.2, FLOOR - 0.4, FLOOR + 0.35, -WALL - 0.6, Z0 - 1));

  // Every part carries position, normal and uv and nothing else, so the
  // batches can merge them.
  for (const list of Object.values(parts)) {
    list.forEach((g, i) => {
      let h = g.index ? g.toNonIndexed() : g;
      if (h !== g) g.dispose();
      for (const name of Object.keys(h.attributes)) if (!['position', 'normal', 'uv'].includes(name)) h.deleteAttribute(name);
      if (!h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
      if (!h.attributes.normal) h.computeVertexNormals();
      if (list === parts.carve && !g.userData.swept) projectUv(h);
      list[i] = h;
    });
  }
  return parts;
}
