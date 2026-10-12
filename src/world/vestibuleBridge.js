// The Vestibule's bridge, level with the floor (2026-10-06).
//
// It stood in the room as a thing set down in it: a slab across the well with
// its two ends standing a step (56 cm) proud of the paving as blocks, a
// balustrade along it in a stone twice as pale as anything round it, and the
// well's own rail running on through its deck. Asked to make it of a piece
// with the Library, and shown two rounds of ways it could be done, the user
// chose this one. The deck is the gallery's floor carried on across the well,
// paved as the floor is paved, so that its slabs run on from the gallery's
// without a joint. The well's low bronze rail goes round each half of the
// well and along the deck's edge as one unbroken run, with the well's newels
// where it comes onto the bridge. Under the deck the arch is as it was, from
// the floor's level. (?wbridge=old: the raised bridge with its balustrade.)
//
// Then, the same evening, "a little bit unnatural": the well's balusters
// hung off the rail like beads (their necks 3 cm thick, so only the bulbs
// showed from the stand), and under the deck the bridge was a blank wall in
// the well with nothing to say it spanned it. Shown three ways to mend it,
// the user took two: balusters that stand the height of the rail, and each
// face of the bridge dressed as an arch. (?wvb=old: S1 as first built.)
import * as THREE from 'three';

// The Vestibule's well as buildWorld cuts it: the floor's hole half a unit
// wider than its shaft, the rail round it at shaft + 1.4. Out along the
// bridge's axis, which is square to two of the well's sides, the hole ends at
// LIP and the rail runs at RAIL.
const SHAFT = 48, COS30 = Math.sqrt(3) / 2;
const LIP = (SHAFT + 0.5) * COS30, RAIL_R = SHAFT + 1.4, RAIL = RAIL_R * COS30;
// the floor, the deck's half width, and how far down its edge the nosing runs
export const FLOOR = 6;
const HALF = 8.5, NOSE = 1.8;
const FIRST_BUILT = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wvb') === 'old';

// A turned baluster `h` tall: a foot and a head of fixed size, the vase
// between them stretched to fit, and never thinner than 0.36 anywhere, so
// that seen from across the well it stands on the plinth instead of hanging
// off the rail.
const balusterCache = new Map();
function balusterGeo(h) {
  if (!balusterCache.has(h)) {
    const foot = [[0, 0], [0.64, 0], [0.64, 0.18], [0.55, 0.25], [0.62, 0.38], [0.52, 0.52], [0.44, 0.66]];
    const vase = [[0.44, 0], [0.56, 0.18], [0.64, 0.34], [0.63, 0.46], [0.54, 0.62], [0.44, 0.78], [0.39, 0.9], [0.38, 1]];
    const lo = 0.66, hi = h - 0.62;
    const head = [[0.48, h - 0.58], [0.48, h - 0.48], [0.4, h - 0.42], [0.44, h - 0.28], [0.58, h - 0.16], [0.58, h], [0, h]];
    const pts = [...foot, ...vase.slice(1).map(([r, t]) => [r, lo + t * (hi - lo)]), ...head];
    balusterCache.set(h, new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 8));
  }
  return balusterCache.get(h).clone();
}

// A convex block given as a quad in (along, up) — `q` — between w0 and w1
// across, through `at(u, w, y)`, every face turned away from its middle.
function prism(q, w0, w1, at) {
  const P = [...q.map(([u, y]) => at(u, w0, y)), ...q.map(([u, y]) => at(u, w1, y))];
  const mid = [0, 1, 2].map((k) => P.reduce((t, p) => t + p[k], 0) / 8);
  const quads = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const pos = [];
  for (const [a, b, c, d] of quads) {
    for (const t of [[a, b, c], [a, c, d]]) {
      const [p, r, s] = t.map((i) => P[i]);
      const e = [r[0] - p[0], r[1] - p[1], r[2] - p[2]], f = [s[0] - p[0], s[1] - p[1], s[2] - p[2]];
      const n = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
      const o = [(p[0] + r[0] + s[0]) / 3 - mid[0], (p[1] + r[1] + s[1]) / 3 - mid[1], (p[2] + r[2] + s[2]) / 3 - mid[2]];
      pos.push(...(n[0] * o[0] + n[1] * o[1] + n[2] * o[2] >= 0 ? [p, r, s] : [p, s, r]).flat());
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // (a uv of its own, so it merges with whatever else its batch holds; a
  // projected batch lays its own over it)
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  return g;
}

// A surface as a grid of points, `at(i, j)` for row i of `nu` and column j of
// `nv`, its faces turned toward `out(p)`.
function surface(nu, nv, at, out) {
  const W = nv + 1, pts = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) pts.push(at(i, j));
  let vote = 0;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = pts[i * W + j], b = pts[i * W + j + 1], d = pts[(i + 1) * W + j + 1];
      const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], f = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const n = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
      const o = out([(a[0] + d[0]) / 2, (a[1] + d[1]) / 2, (a[2] + d[2]) / 2]);
      vote += Math.sign(n[0] * o[0] + n[1] * o[1] + n[2] * o[2]);
    }
  }
  const idx = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * W + j, b = a + 1, d = a + W + 1, e = a + W;
      if (vote >= 0) idx.push(a, b, d, a, d, e); else idx.push(a, d, b, a, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Each face of the bridge dressed as the face of an arch: a string
// course under the deck's nosing, and a ring of voussoirs round the arch's
// underside with its keystone running up into the string course — so that,
// looked down on from the gallery, the stone under the deck reads as a
// bridge's span and not as a wall standing in the well. Each voussoir stands
// 0.25 proud of the face in dressed stone, on a course of mortar set back
// from it, which is what its joints show: a dark line, never a hole. It is
// seen from the well's edge, looking down, more than from the stand.
function dressArch({ at, under, LB, mouldGeo }) {
  const slope = (u) => (-52 * u) / (44 * 44);
  const out = (u) => { const L = Math.hypot(slope(u), 1); return [-slope(u) / L, 1 / L]; };
  // even blocks round the ring by length, from wall to wall (into them)
  const S = LIP + 0.8, M = 400, us = [], len = [0];
  for (let i = 0; i <= M; i++) us.push(-S + (2 * S * i) / M);
  for (let i = 1; i <= M; i++) len.push(len[i - 1] + Math.hypot(us[i] - us[i - 1], under(us[i]) - under(us[i - 1])));
  const uAt = (l) => {
    let i = 1;
    while (i < M && len[i] < l) i++;
    return us[i - 1] + ((l - len[i - 1]) / (len[i] - len[i - 1])) * (us[i] - us[i - 1]);
  };
  const N = 27, KEY = (N - 1) / 2, J = 0.07, D = 3.4;
  // a block of the ring from ua to ub, d deep, its foot a hair under the
  // soffit (never in its plane), the keystone wider at its head
  const block = (ua, ub, d, flare = 0, foot = 0.03) => {
    const [na, nb] = [out(ua), out(ub)];
    return [[ua, under(ua) - foot], [ub, under(ub) - foot], [ub + nb[0] * d + flare, under(ub) + nb[1] * d], [ua + na[0] * d - flare, under(ua) + na[1] * d]];
  };
  for (const s of [-1, 1]) {
    const sc = [[-0.4, -NOSE - 0.02, true], [0.42, -NOSE - 0.02, true], [0.42, -2.75], [0.32, -3.1], [0.2, -3.45, true], [-0.4, -3.45, true]];
    LB.step.add(mouldGeo([-LIP, LIP].map((u) => at(u, s * HALF, FLOOR)), sc.map(([a, y, sharp]) => [a * s, y, sharp])));
    for (let k = 0; k < N; k++) {
      const key = k === KEY;
      const u0 = uAt((k / N) * len[M]), u1 = uAt(((k + 1) / N) * len[M]);
      // the voussoir in dressed stone, 0.25 proud; behind it, set back 0.13
      // from its face, the mortar its joints show
      LB.dressed.add(prism(block(uAt((k / N) * len[M] + J), uAt(((k + 1) / N) * len[M] - J), key ? 4.7 : D, key ? 0.45 : 0),
        s * (HALF - 0.02), s * (HALF + (key ? 0.5 : 0.25)), at));
      LB.joint.add(prism(block(u0, u1, D - 0.1, 0, -0.04), s * (HALF - 0.02), s * (HALF + 0.12), at));
    }
  }
}

// `c` the bridge's middle (the well's), `ax` along it, `px` across it.
// It lays the Vestibule's well rail as well: buildWorld lays no other there.
export function buildVestibuleBridge({ c, ax, px, LB, placed, mouldGeo, balusters, wornRibbon }) {
  const at = (u, w, y) => [c[0] + ax[0] * u + px[0] * w, y, c[1] + ax[1] * u + px[1] * w];
  // the arch's underside: two courses under the deck at the crown, springing
  // from the well's sides
  const under = (u) => FLOOR - 8 - 26 * (u / 44) ** 2;
  const NU = 84, U = (i) => -LIP + (i / NU) * 2 * LIP;
  const away = (p) => {
    const u = (p[0] - c[0]) * ax[0] + (p[2] - c[1]) * ax[1], m = at(u, 0, 0);
    return [p[0] - m[0], 0, p[2] - m[2]];
  };
  // The deck, in the floor's own paving and on its plane, from one side of
  // the floor's hole to the other; its two sides and the arch under it in the
  // bridge's stone; and a rounded nosing along each edge in the pale stone the
  // well's lip is ringed with.
  LB.floor.add(surface(NU, 1, (i, j) => at(U(i), (j ? 1 : -1) * HALF, FLOOR), () => [0, 1, 0]));
  for (const s of [-1, 1]) {
    LB.step.add(surface(NU, 1, (i, j) => at(U(i), s * HALF, j ? under(U(i)) : FLOOR - NOSE), away));
    const path = [-LIP, LIP].map((u) => at(u, s * HALF, FLOOR));
    // (its top a hair under the deck's, so the two never share a plane)
    const sec = [[-0.6, -NOSE, true], [0, -NOSE, true], [0.15, -1.4], [0.5, -0.95], [0.6, -0.55], [0.45, -0.2], [0.15, -0.02, true], [-0.6, -0.02, true]];
    LB.cap.add(mouldGeo(path, sec.map(([a, y, sharp]) => [a * s, y, sharp])));
  }
  LB.step.add(surface(NU, 1, (i, j) => at(U(i), (j ? 1 : -1) * HALF, under(U(i))), () => [0, -1, 0]));
  // Walked smooth down its middle, and out onto the floor at either end where
  // the file turns back (walkers.js: the turns reach 49.8 along it).
  LB.wornFloor.add(wornRibbon([-50, 50].map((u) => { const p = at(u, 0, 0); return [p[0], p[2]]; }), 7, FLOOR + 0.03));

  // The well's rail. Round each half of the well it is one run — from where
  // it comes off the bridge, out along the well's side, round its corners,
  // back to the bridge and along the deck's edge to where it began — with a
  // newel at each of the well's corners and at either side of each end of
  // the bridge: a low plinth, turned balusters standing the height of the
  // rail every 3.4, a slim rail on their heads, and the handrail rubbed
  // bright, its top 69 cm up.
  const box = (half, h, y = 0) => [[-half, y, true], [half, y, true], [half, y + h, true], [-half, y + h, true]];
  const handrail = Array.from({ length: 16 }, (_, k) => { const t = (k / 16) * 2 * Math.PI; return [1.3 * Math.cos(t), 5.8 + 0.78 * Math.sin(t)]; });
  if (!FIRST_BUILT) {
    dressArch({ at, under, LB, mouldGeo });
    const LOW = 5.6;
    const run = (path, h, gap) => {
      LB.bronze.add(mouldGeo(path, box(1.2, 1)));
      LB.bronze.add(mouldGeo(path, box(0.85, 0.35, 1)));
      LB.bronzeDim.add(mouldGeo(path, box(0.8, 0.35, h)));
      const rail = Array.from({ length: 16 }, (_, k) => { const t = (k / 16) * 2 * Math.PI; return [1.2 * Math.cos(t), h + 1 + 0.72 * Math.sin(t)]; });
      LB.bronzeWorn.add(mouldGeo(path, rail));
      for (let k = 0; k + 1 < path.length; k++) {
        const a = path[k], b = path[k + 1], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
        const n = Math.max(1, Math.round((L - 3.2) / gap));
        for (let i = 0; i <= n; i++) {
          const t = (1.6 + (i * (L - 3.2)) / n) / L;
          LB.bronze.add(placed(balusterGeo(h - 0.85), [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t], FLOOR + 1));
        }
      }
    };
    const newel = ([x, y, z], h) => {
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(0.95, 1.25, h, 14), [x, z], y + h / 2));
      LB.bronzeWorn.add(placed(new THREE.CylinderGeometry(1.15, 0.95, 0.55, 16), [x, z], y + h + 0.28));
      LB.bronzeWorn.add(placed(new THREE.SphereGeometry(0.62, 14, 8).scale(1, 0.55, 1), [x, z], y + h + 0.62));
    };
    for (const s of [-1, 1]) {
      const edge = s * (HALF - 1.2);
      const ring = [[RAIL, edge], [RAIL, (s * RAIL_R) / 2], [0, s * RAIL_R], [-RAIL, (s * RAIL_R) / 2], [-RAIL, edge]].map(([u, w]) => at(u, w, FLOOR));
      run([...ring, ring[0]], LOW, 3.4);
      ring.forEach((p) => newel(p, LOW + 1.3));
    }
    return;
  }
  // (?wvb=old) the rail as S1 was first built: the well's rail elsewhere,
  // its balusters squat bulbs every 6.4 between a two-step plinth and a band
  for (const s of [-1, 1]) {
    const edge = s * (HALF - 1.2);
    const loop = [[RAIL, edge], [RAIL, (s * RAIL_R) / 2], [0, s * RAIL_R], [-RAIL, (s * RAIL_R) / 2], [-RAIL, edge], [RAIL, edge]]
      .map(([u, w]) => at(u, w, FLOOR));
    LB.bronze.add(mouldGeo(loop, box(1.4, 1.4)));
    LB.bronze.add(mouldGeo(loop, box(1, 0.7, 1.4)));
    LB.bronzeDim.add(mouldGeo(loop, box(1.5, 0.6, 4.5)));
    LB.bronzeWorn.add(mouldGeo(loop, handrail));
    // (the run begins and ends at the first newel, which closes the joint)
    for (const [x, y, z] of loop.slice(0, 5)) {
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(0.95, 1.25, 5.4, 14), [x, z], y + 2.7));
      // capped low and moulded, as the well's newels have always been
      LB.bronzeWorn.add(placed(new THREE.CylinderGeometry(1.15, 0.95, 0.55, 16), [x, z], y + 6.75));
      LB.bronzeWorn.add(placed(new THREE.SphereGeometry(0.62, 14, 8).scale(1, 0.55, 1), [x, z], y + 7.1));
    }
    // One baluster every 6.4 or so, clear of the newels. (At 4.2 the shafts
    // closed up into a solid band across the bottom of the frame; see the
    // well's rail in buildWorld.)
    for (let k = 0; k + 1 < loop.length; k++) {
      const a = loop[k], b = loop[k + 1], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const n = Math.max(1, Math.round((L - 3) / 6.4));
      for (let i = 0; i < n; i++) {
        const t = (1.5 + ((i + 0.5) * (L - 3)) / n) / L;
        balusters.push({ p: [a[0] + (b[0] - a[0]) * t, FLOOR + 1.4, a[2] + (b[2] - a[2]) * t], s: [0.85, 0.5, 0.85] });
      }
    }
  }
}
