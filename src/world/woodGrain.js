// ── Wood laid with its grain ─────────────────────────────────────────────────
// 2026-10-05 the reader asked for better wood. The stone is laid by `uvWorld`
// (buildWorld.js): each face projected on whichever world axis it is turned
// to. Stone has no direction and that is right for it; wood does, and the
// projection put the grain along world x or z on every face, whatever the
// piece was. A post or a bookcase upright had its grain running AROUND it — a
// stack of rings, a ribbed column — the cases on four of a hexagon's six walls
// had grain slanting across their shelves, and every board in a run continued
// the same stretch of figure into the next, one plank printed along the wall.
//
// So a wooden piece is laid the way a joiner cuts one. Each separate part of
// what a Batch is given (a stool's legs and seat arrive merged, but are found
// apart by their shared corners) is measured for its longest axis, and the
// texture's u — the grain — is laid along it. Across the grain, v runs round
// the part as an arc (r·θ), so on a turned post or leg the figure continues
// over the facets rather than starting again on each. The faces across the
// grain (end grain) are projected flat. Every part is cut from its own stretch
// of the timber: an offset hashed from where it stands, so the same part
// always gets the same piece and a neighbour never does.
//
// A ring of shelving (the Vertigo's, the Silence vault's) is not cut from one
// straight plank: `ringGrain` marks a geometry whose grain runs round a centre.
//
// ?wwood=old puts the wood back as it was: the old striped walnut, projected.
import { BufferAttribute } from 'three';

const Q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
export const WOOD_OLD = Q.get('wwood') === 'old';

// How much timber one tile of the painted texture is, in world units (a unit
// is 9.4 cm): along the grain, across it. The canvas is 1024 × 512 (see
// `timber` in textures.js), so a unit is ~51 px of walnut and ~43 of cedar.
export const WALNUT_TILE = [20, 10];
export const CEDAR_TILE = [24, 12];

// Mark a geometry as a ring of wood whose grain runs round [cx, cz].
export const ringGrain = (geo, cx, cz) => { geo.userData.grain = { ring: [cx, cz] }; return geo; };

// The eigenvectors of a symmetric 3×3 (cyclic Jacobi), largest first.
const eigen3 = (m) => {
  const a = [[m[0], m[1], m[2]], [m[1], m[3], m[4]], [m[2], m[4], m[5]]];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 12; sweep++) {
    const off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off < 1e-12) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-14) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return [0, 1, 2].map((i) => ({ value: a[i][i], vec: [v[0][i], v[1][i], v[2][i]] })).sort((x, y) => y.value - x.value);
};

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// a stretch of timber for a part, from where it stands
const hash = (x, y, z) => {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return h - Math.floor(h);
};

// Scratch space, kept between calls: nearly every piece is one box, and
// fresh arrays for each of eight thousand of them cost more than the work.
let scratch = { tris: 0 };
const room = (tris) => {
  if (scratch.tris >= tris) return scratch;
  const n = Math.max(64, 1 << Math.ceil(Math.log2(tris)));
  let cap = 16;
  while (cap < n * 6) cap <<= 1;
  scratch = {
    tris: n, X: new Float32Array(n * 9), parent: new Int32Array(n), keys: new Int32Array(cap), owner: new Int32Array(cap),
    area: new Float32Array(n), normal: new Float32Array(n * 3), mid: new Float32Array(n * 3),
  };
  return scratch;
};

// `geo`: non-indexed, in world space. `at`: [x, z] the part is laid as though
// it stood that much further off (see uvWorld). `hint`: geo.userData.grain.
export function uvGrain(geo, at = null, hint = null) {
  const pos = geo.attributes.position;
  if (!pos) return geo;
  const tris = Math.floor(pos.count / 3), nv = tris * 3;
  const { X, parent, keys, owner, area, normal, mid } = room(tris);
  if (!pos.isInterleavedBufferAttribute && pos.itemSize === 3 && pos.array instanceof Float32Array) X.set(pos.array.subarray(0, nv * 3));
  else for (let i = 0; i < nv; i++) { X[i * 3] = pos.getX(i); X[i * 3 + 1] = pos.getY(i); X[i * 3 + 2] = pos.getZ(i); }
  // The parts: triangles joined by a shared corner, a corner known by a hash
  // of where it is (two parts that hashed alike would only share a grain),
  // in an open-addressed table. A dozen triangles or fewer is one box.
  for (let t = 0; t < tris; t++) parent[t] = t;
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  if (tris > 12) {
    let cap = 16;
    while (cap < nv * 2) cap <<= 1;
    owner.fill(-1, 0, cap);
    for (let i = 0; i < nv; i++) {
      const key = (Math.imul(Math.round(X[i * 3] * 256), 73856093) ^ Math.imul(Math.round(X[i * 3 + 1] * 256), 19349663) ^ Math.imul(Math.round(X[i * 3 + 2] * 256), 83492791)) | 0;
      let slot = Math.imul(key, 0x9e3779b1) & (cap - 1);
      while (owner[slot] !== -1 && keys[slot] !== key) slot = (slot + 1) & (cap - 1);
      const t = (i / 3) | 0;
      if (owner[slot] === -1) { owner[slot] = t; keys[slot] = key; }
      else { const a = find(owner[slot]), b = find(t); if (a !== b) parent[a] = b; }
    }
  } else {
    for (let t = 1; t < tris; t++) parent[t] = 0;
  }
  const parts = new Map();
  for (let t = 0; t < tris; t++) {
    const o = t * 9;
    const ax = X[o + 3] - X[o], ay = X[o + 4] - X[o + 1], az = X[o + 5] - X[o + 2];
    const bx = X[o + 6] - X[o], by = X[o + 7] - X[o + 1], bz = X[o + 8] - X[o + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz);
    area[t] = l / 2;
    if (l > 0) { normal[t * 3] = nx / l; normal[t * 3 + 1] = ny / l; normal[t * 3 + 2] = nz / l; }
    else normal[t * 3] = normal[t * 3 + 1] = normal[t * 3 + 2] = 0;
    for (let k = 0; k < 3; k++) mid[t * 3 + k] = (X[o + k] + X[o + 3 + k] + X[o + 6 + k]) / 3;
    const r = find(t);
    let list = parts.get(r);
    if (!list) parts.set(r, (list = []));
    list.push(t);
  }
  const uv = new Float32Array(nv * 2);
  for (const list of parts.values()) {
    // where it stands and how it is spread: the surface's second moment
    let A = 0, cx = 0, cy = 0, cz = 0;
    for (const t of list) { const w = area[t] || 1e-6; A += w; cx += mid[t * 3] * w; cy += mid[t * 3 + 1] * w; cz += mid[t * 3 + 2] * w; }
    cx /= A; cy /= A; cz /= A;
    const off0 = hash(cx + (at ? at[0] : 0), cy, cz + (at ? at[1] : 0)), off1 = hash(cz + (at ? at[1] : 0), cx + (at ? at[0] : 0), cy * 1.7);
    const offU = off0 * 97, offV = off1 * 53;
    const ring = hint?.ring;
    if (ring) {
      // round a centre: u is the arc at the ring's mean radius, v the radius
      // on a flat face and the height on an edge
      let Rm = 0;
      for (const t of list) Rm += Math.hypot(mid[t * 3] - ring[0], mid[t * 3 + 2] - ring[1]) * (area[t] || 1e-6);
      Rm /= A;
      for (const t of list) {
        const flat = Math.abs(normal[t * 3 + 1]) > 0.7;
        let th0 = 0;
        for (let k = 0; k < 3; k++) {
          const i = t * 3 + k, px = X[i * 3] - ring[0], pz = X[i * 3 + 2] - ring[1];
          let th = Math.atan2(pz, px);
          if (k === 0) th0 = th;
          else th += 2 * Math.PI * Math.round((th0 - th) / (2 * Math.PI));
          uv[i * 2] = th * Rm + offU;
          uv[i * 2 + 1] = (flat ? Math.hypot(px, pz) : X[i * 3 + 1]) + offV;
        }
      }
      continue;
    }
    const m = [0, 0, 0, 0, 0, 0];
    for (const t of list) {
      const w = (area[t] || 1e-6) / 3;
      for (let k = 0; k < 3; k++) {
        const o = (t * 3 + k) * 3, dx = X[o] - cx, dy = X[o + 1] - cy, dz = X[o + 2] - cz;
        m[0] += dx * dx * w; m[1] += dx * dy * w; m[2] += dx * dz * w;
        m[3] += dy * dy * w; m[4] += dy * dz * w; m[5] += dz * dz * w;
      }
    }
    const [e1, e2] = eigen3(m);
    let g = norm(e1.vec);
    // A part about as long as it is wide (a square panel, a disc, a block)
    // has no longest axis worth the name, and its eigenvectors can come out
    // at any angle in the plane. Grain stands upright in an upright panel, as
    // a joiner hangs it, and lies level in a level one.
    if (e2.value > 0.8 * e1.value) {
      const up = Math.abs(g[1]) > Math.abs(e2.vec[1]) ? g : norm(e2.vec);
      let big = 0, bigY = 1;
      for (const t of list) if (area[t] > big) { big = area[t]; bigY = normal[t * 3 + 1]; }
      if (Math.abs(bigY) < 0.7 && Math.abs(up[1]) > 0.5) g = [0, Math.sign(up[1]) || 1, 0];
      else if (Math.abs(bigY) >= 0.7) g = g[0] !== 0 || g[2] !== 0 ? norm([g[0], 0, g[2]]) : [1, 0, 0];
    }
    // a frame round the grain, right-handed, so θ turns the way the arc runs
    const gd = dot(e2.vec, g);
    const e2v = norm([e2.vec[0] - gd * g[0], e2.vec[1] - gd * g[1], e2.vec[2] - gd * g[2]]);
    const e3v = cross(g, e2v);
    const [gx, gy, gz] = g, [ux, uy, uz] = e2v, [wx, wy, wz] = e3v;
    const flip = off0 > 0.5 ? -1 : 1;   // and a board turned end for end
    // Round a turned part of N facets, v is the arc at a radius that makes
    // N facets' widths add up to it exactly (a facet is 2a·tan(π/N) wide,
    // its arc a·2π/N), so the figure runs on over each edge without a step.
    const bins = new Set();
    for (const t of list) {
      const nx = normal[t * 3], ny = normal[t * 3 + 1], nz = normal[t * 3 + 2];
      if (Math.abs(nx * gx + ny * gy + nz * gz) <= 0.8) bins.add(Math.round((Math.atan2(nx * wx + ny * wy + nz * wz, nx * ux + ny * uy + nz * uz) * 180) / Math.PI));
    }
    const N = bins.size, arc = N >= 5 ? (N / Math.PI) * Math.tan(Math.PI / N) : 1;
    for (const t of list) {
      const nx = normal[t * 3], ny = normal[t * 3 + 1], nz = normal[t * 3 + 2];
      const along = nx * gx + ny * gy + nz * gz;
      if (Math.abs(along) > 0.8) {
        // end grain: flat across the part
        for (let k = 0; k < 3; k++) {
          const i = t * 3 + k, dx = X[i * 3] - cx, dy = X[i * 3 + 1] - cy, dz = X[i * 3 + 2] - cz;
          uv[i * 2] = dx * ux + dy * uy + dz * uz + offU;
          uv[i * 2 + 1] = dx * wx + dy * wy + dz * wz + offV;
        }
        continue;
      }
      // b: the face's way out from the grain; tan: round the part
      let bx = nx - along * gx, by = ny - along * gy, bz = nz - along * gz;
      const bl = Math.hypot(bx, by, bz) || 1;
      bx /= bl; by /= bl; bz /= bl;
      const tx = gy * bz - gz * by, ty = gz * bx - gx * bz, tz = gx * by - gy * bx;
      const th = Math.atan2(bx * wx + by * wy + bz * wz, bx * ux + by * uy + bz * uz);
      const r = Math.max(0, (mid[t * 3] - cx) * bx + (mid[t * 3 + 1] - cy) * by + (mid[t * 3 + 2] - cz) * bz) * arc;
      for (let k = 0; k < 3; k++) {
        const i = t * 3 + k, dx = X[i * 3] - cx, dy = X[i * 3 + 1] - cy, dz = X[i * 3 + 2] - cz;
        uv[i * 2] = flip * (dx * gx + dy * gy + dz * gz) + offU;
        uv[i * 2 + 1] = dx * tx + dy * ty + dz * tz + r * th + offV;
      }
    }
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  return geo;
}
