// ── Hedges ────────────────────────────────────────────────────────────────────
// The maze was walls of rounded box — a RoundedBoxGeometry for every edge of
// the grid, laid end over end, wrapped in one printed field of leaf. From
// inside it read as upholstery: ruler-straight tops against the sky, cushion
// corners, a flat wallpaper face, and a hard seam where the green met the
// gravel. Nothing in it had grown.
//
// A clipped hedge is a plant cut to a shape, and the shape is never quite
// the one the gardener meant. It is cut with a batter — wider at the foot than
// the top, so the light reaches the lower leaf — and the shears round its
// shoulders. It swells where it grows strongly and sags where it does not,
// its top wanders by a hand's breadth, and a few weeks after the cut every
// face is fuzzed with new shoots, thickest on top where the light is. At the
// foot, where it shades itself, it thins to bare stems over a litter of its
// own dead leaves.
//
// So a hedge here is grown from its FOOTPRINT: the outline of the ground it
// stands on (the union of the maze's walls, one continuous outline, so a
// T-junction is one hedge grown together and not three boxes pushed into
// each other), swept up through a profile — the leggy foot, the battered
// face, the rounded shoulder — and pushed in and out by noise in the world's
// own coordinates. What it returns is a body (one indexed mesh, its shade in
// its vertices), the litter at its foot, and its sprigs: small leaf sprays
// (textures.js, foliageAtlas kind `box`) set on the surface where it would
// have grown since the cut, each turned out along the surface it grows
// from. The sprigs are what break the
// silhouette, and the silhouette is what said "box". (A sprig on a face is
// its three upright cards only, `flat` false: the fourth would lie on the
// leaf, half sunk in the lumps, and in the hedge's own moon shadow — a dark
// star on every face.)
//
// All in world units (a unit is 9.4 cm), drawn from the `seed` it is handed,
// never the world's stream.
import * as THREE from 'three';
import { makeRng } from './textures';

// Value noise in three dimensions, 0 to 1, smooth: a hash at each lattice
// point and a smoothstep between.
const hash3 = (x, y, z, s) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
export const noise3 = (seed) => (x, y, z) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const at = (a, b, c) => hash3(xi + a, yi + b, zi + c, seed);
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(
    lerp(lerp(at(0, 0, 0), at(1, 0, 0), u), lerp(at(0, 1, 0), at(1, 1, 0), u), v),
    lerp(lerp(at(0, 0, 1), at(1, 0, 1), u), lerp(at(0, 1, 1), at(1, 1, 1), u), v),
    w,
  );
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const signedArea = (loop) => loop.reduce((s, [x, z], i) => {
  const [x2, z2] = loop[(i + 1) % loop.length];
  return s + (x * z2 - x2 * z) / 2;
}, 0);

// The outline of a union of axis-aligned rectangles [x0, z0, x1, z1], as
// closed loops of corners with the hedge on the left of the way round (so an
// outer loop runs counter-clockwise with x right and z up, and a hole the
// other way). Cut on the rectangles' own edges, so the result is exact.
export function rectUnionLoops(rects) {
  const xs = [...new Set(rects.flatMap((r) => [r[0], r[2]]))].sort((a, b) => a - b);
  const zs = [...new Set(rects.flatMap((r) => [r[1], r[3]]))].sort((a, b) => a - b);
  const nx = xs.length - 1, nz = zs.length - 1;
  const full = Array.from({ length: nx }, (_, i) => Array.from({ length: nz }, (_, j) => {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    return rects.some((r) => cx > r[0] && cx < r[2] && cz > r[1] && cz < r[3]);
  }));
  const filled = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && full[i][j];
  const next = new Map();
  const edge = (a, b) => next.set(`${a[0]},${a[1]}`, b);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (!full[i][j]) continue;
      if (!filled(i, j - 1)) edge([i, j], [i + 1, j]);
      if (!filled(i + 1, j)) edge([i + 1, j], [i + 1, j + 1]);
      if (!filled(i, j + 1)) edge([i + 1, j + 1], [i, j + 1]);
      if (!filled(i - 1, j)) edge([i, j + 1], [i, j]);
    }
  }
  const loops = [];
  while (next.size) {
    const [startKey] = next.keys();
    const loop = [];
    let key = startKey;
    while (next.has(key)) {
      const b = next.get(key);
      next.delete(key);
      const [i, j] = key.split(',').map(Number);
      loop.push([xs[i], zs[j]]);
      key = `${b[0]},${b[1]}`;
    }
    // only the corners
    const corners = loop.filter((p, k) => {
      const a = loop[(k - 1 + loop.length) % loop.length], c = loop[(k + 1) % loop.length];
      return Math.abs((p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0])) > 1e-6;
    });
    if (corners.length >= 3) loops.push(corners);
  }
  return loops;
}

// A rectangle from `a` to `b` on the ground, `t` thick, as a loop the right
// way round — a hedge along any bearing.
export function stripLoop(a, b, t) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
  const h = t / 2, nx = -dz * h, nz = dx * h;
  const loop = [[a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz]];
  return signedArea(loop) > 0 ? loop : loop.reverse();
}

// Walks a loop into points about `step` apart, each carrying the way out of
// the hedge there (`n`), how far along it must go to inset the outline evenly
// (`m`: 1 on a face, the miter at an inside corner), how far round the loop it
// lies (`u`, for the leaf's texture), and how near an inside corner it is
// (`nook`, 0 in the corner, 1 clear of it). An outside corner is rounded off
// at radius `round` — larger than any inset asked of it, or the inset loop
// would turn inside out there.
function walkLoop(loop, { round, step }) {
  const N = loop.length;
  const unit = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const corners = loop.map((P, i) => {
    const din = unit(loop[(i - 1 + N) % N], P), dout = unit(P, loop[(i + 1) % N]);
    return { P, din, dout, convex: din[0] * dout[1] - din[1] * dout[0] > 0 };
  });
  const out = [];
  const push = (p, n, m, corner) => out.push({ p, n, m, corner });
  corners.forEach((c, i) => {
    const { P, din, dout } = c;
    if (c.convex) {
      const S = [P[0] - din[0] * round, P[1] - din[1] * round];
      const C = [S[0] - din[1] * round, S[1] + din[0] * round];
      let a0 = Math.atan2(S[1] - C[1], S[0] - C[0]);
      let a1 = Math.atan2(P[1] + dout[1] * round - C[1], P[0] + dout[0] * round - C[0]);
      while (a1 < a0) a1 += Math.PI * 2;
      const segs = Math.max(3, Math.ceil(((a1 - a0) * round) / (step * 0.8)));
      for (let k = 0; k <= segs; k++) {
        const a = a0 + ((a1 - a0) * k) / segs, n = [Math.cos(a), Math.sin(a)];
        push([C[0] + n[0] * round, C[1] + n[1] * round], n, 1, 'out');
      }
    } else {
      const nin = [din[1], -din[0]], nout = [dout[1], -dout[0]];
      const s = [nin[0] + nout[0], nin[1] + nout[1]], L = Math.hypot(s[0], s[1]);
      const n = [s[0] / L, s[1] / L];
      push(P, n, 1 / Math.max(0.3, n[0] * nin[0] + n[1] * nin[1]), 'in');
    }
    // the straight run to the next corner, less the rounding at either end
    const nc = corners[(i + 1) % N];
    const a = c.convex ? [P[0] + dout[0] * round, P[1] + dout[1] * round] : P;
    const b = nc.convex ? [nc.P[0] - dout[0] * round, nc.P[1] - dout[1] * round] : nc.P;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), segs = Math.max(1, Math.round(L / step));
    for (let k = 1; k < segs; k++) push([a[0] + ((b[0] - a[0]) * k) / segs, a[1] + ((b[1] - a[1]) * k) / segs], [dout[1], -dout[0]], 1, null);
  });
  let u = 0;
  out.forEach((q, k) => {
    if (k) u += Math.hypot(q.p[0] - out[k - 1].p[0], q.p[1] - out[k - 1].p[1]);
    q.u = u;
  });
  // how far round the loop to the nearest inside corner, either way
  const inside = out.filter((q) => q.corner === 'in').map((q) => q.u);
  const total = u + Math.hypot(out[0].p[0] - out[out.length - 1].p[0], out[0].p[1] - out[out.length - 1].p[1]);
  for (const q of out) {
    let near = Infinity;
    for (const w of inside) { const d = Math.abs(q.u - w); near = Math.min(near, d, total - d); }
    q.nook = smooth(0, 5, near);
  }
  return out;
}

// The hedge's section, from below the ground to the top: `y` above the ground,
// `d` how far in from the footprint. A leggy foot, pulled in where it has
// thinned to stems; the fullest point a little above the ground; a batter up
// the face; and the shears' round over the shoulder onto the top.
function profile(H, { batter, shoulder, foot }) {
  const pts = [
    { y: -0.8, d: foot },
    { y: 0.6, d: foot * 0.9 },
    { y: 1.8, d: foot * 0.45 },
    { y: 3.2, d: 0 },
  ];
  const face0 = 3.2, face1 = H - shoulder, rise = Math.max(1, Math.round((face1 - face0) / 2.3));
  for (let k = 1; k <= rise; k++) pts.push({ y: face0 + ((face1 - face0) * k) / rise, d: (batter * k) / rise });
  for (let k = 1; k <= 5; k++) {
    const th = (k / 5) * (Math.PI / 2);
    pts.push({ y: face1 + shoulder * Math.sin(th), d: batter + shoulder * (1 - Math.cos(th)), top: k / 5 });
  }
  // how far up the section a point is, walking it (the leaf's other texture axis)
  let v = 0;
  pts.forEach((p, k) => {
    if (k) v += Math.hypot(p.y - pts[k - 1].y, p.d - pts[k - 1].d);
    p.v = v;
    // the section's own outward normal, in (out, up)
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    const dy = b.y - a.y, dd = b.d - a.d, L = Math.hypot(dy, dd) || 1;
    p.no = dy / L;
    p.nu = dd / L;
    p.top ??= 0;
  });
  return pts;
}

// Grows a hedge over `loops` (see rectUnionLoops, stripLoop) standing on the
// ground at `ground`, `H` tall. `leaf` is the green its sprigs are tinted, and
// `detail` scales how many there are (0, none). Returns its body (`geometry`,
// indexed, its shade in a vertex colour), its `sprigs` for the foliage
// instances ({ p, rot, s, color, k, kind, crown, flat }), and the `litter` it
// stands in (a ribbon with its alpha in a vertex colour).
export function growHedge(loops, { ground, H, seed = 1, leaf = '#566e3d', detail = 1, round = 3, batter = 0.7, shoulder = 1.9, foot = 0.9 }) {
  const rng = makeRng(seed), R = (a, b) => a + (b - a) * rng();
  const lump = noise3(seed * 7 + 1), swell = noise3(seed * 7 + 2), wander = noise3(seed * 7 + 3);
  const tone = noise3(seed * 7 + 4), hue = noise3(seed * 7 + 5);
  const section = profile(H, { batter, shoulder, foot });
  const levels = section.length;
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const leafColor = new THREE.Color(leaf);
  // outer loops first, each hole kept with the loop it lies in, for the top
  const outers = [], holes = [];
  for (const loop of loops) (signedArea(loop) > 0 ? outers : holes).push(loop);

  const bodies = loops.map((loop) => {
    const walk = walkLoop(loop, { round, step: 1.5 });
    const n = walk.length, last = walk[n - 1];
    // round once more to the first point, so the leaf runs on across the join
    // instead of squeezing the whole way round back into one quad
    const cols = [...walk, { ...walk[0], u: last.u + Math.hypot(walk[0].p[0] - last.p[0], walk[0].p[1] - last.p[1]) }];
    const base = pos.length / 3;
    for (const s of section) {
      for (const q of cols) {
        const inset = s.d * q.m;
        let x = q.p[0] - q.n[0] * inset, z = q.p[1] - q.n[1] * inset;
        let y = ground + s.y;
        // Push in and out along the surface: broad swells where it grows
        // strongly, the lumps of the last cut, and a top that wanders. The
        // foot is left alone, where the ground holds it.
        const at = Math.min(1, Math.max(0, s.y / 4));
        const push = at * (
          (swell(x / 22, y / 22, z / 22) - 0.5) * 1.2
          + (lump(x / 5.5, y / 5.5, z / 5.5) - 0.5) * 1.1
          + (lump(x / 2.4 + 40, y / 2.4, z / 2.4) - 0.5) * 0.45);
        x += q.n[0] * s.no * push;
        z += q.n[1] * s.no * push;
        y += s.nu * push + s.top * (wander(x / 16, 0, z / 16) - 0.5) * 1.6;
        pos.push(x, y, z);
        nor.push(0, 1, 0);
        uv.push(q.u, s.v);
        // Shade: dark at the foot, where the hedge stands in its own shadow
        // over bare stems, and in the nook of an inside corner; lighter and
        // yellower on top, where the new growth is. Then a slow wander of
        // tone and hue across the whole planting, so no two runs are one green.
        const foot_ = 0.26 + 0.74 * smooth(-0.5, 5.5, s.y);
        const nook = 0.68 + 0.32 * q.nook;
        const t = tone(x / 26, y / 18, z / 26), h = hue(x / 40, y / 40, z / 40);
        const k = foot_ * nook * (0.8 + 0.36 * t);
        const fresh = s.top * 0.14 + (h - 0.5) * 0.18;
        col.push(k * (1 + fresh * 0.9), k * (1 + fresh * 0.55), k * (1 - fresh * 0.6));
      }
    }
    const w = n + 1;
    for (let l = 0; l < levels - 1; l++) {
      for (let i = 0; i < n; i++) {
        const a = base + l * w + i, b = a + 1, c = b + w, d = a + w;
        idx.push(a, c, b, a, d, c);
      }
    }
    return { loop, base, n, w, walk, cols };
  });

  // The top: the last ring of each outer loop (and of any hole in it), laid
  // flat in its own vertices, textured from above.
  const top = levels - 1;
  const inside = (p, loop) => {
    let hit = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const [xi, zi] = loop[i], [xj, zj] = loop[j];
      if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) hit = !hit;
    }
    return hit;
  };
  for (const outer of outers) {
    const body = bodies.find((b) => b.loop === outer);
    const own = [body, ...bodies.filter((b) => holes.includes(b.loop) && inside(b.loop[0], outer))];
    const capBase = pos.length / 3;
    const contour = [], holeRings = [];
    own.forEach((b, bi) => {
      const ring = [];
      for (let i = 0; i < b.n; i++) {
        const v = (b.base + top * b.w + i) * 3;
        pos.push(pos[v], pos[v + 1], pos[v + 2]);
        nor.push(0, 1, 0);
        uv.push(pos[v], pos[v + 2]);
        col.push(col[v], col[v + 1], col[v + 2]);
        ring.push(new THREE.Vector2(pos[v], pos[v + 2]));
      }
      if (bi === 0) contour.push(...ring);
      else holeRings.push(ring);
    });
    const tris = THREE.ShapeUtils.triangulateShape(contour, holeRings);
    for (const [a, b, c] of tris) idx.push(capBase + a, capBase + c, capBase + b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  // and the two columns that meet at the join lit as one
  const N = geometry.attributes.normal;
  for (const { base, n, w } of bodies) {
    for (let l = 0; l < levels; l++) {
      const a = base + l * w, b = a + n;
      const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), L = Math.hypot(x, y, z) || 1;
      N.setXYZ(a, x / L, y / L, z / L);
      N.setXYZ(b, x / L, y / L, z / L);
    }
  }

  // ── Sprigs ────────────────────────────────────────────────────────────────
  // New shoots since the cut, set on the surface and turned out along it:
  // everywhere over the shoulders and the top, sparser down the faces, most on
  // an outside corner (the shears miss a corner), none on the leggy foot, and
  // here and there a long one standing up out of the top that the next cut
  // will take. Each sprig's clump is a point behind the surface it grows from,
  // so the foliage shader lights it as that surface (effects.js, aCrown).
  const sprigs = [];
  const nrm = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), spin = new THREE.Quaternion();
  const euler = new THREE.Euler(), tint = new THREE.Color();
  const sprig = (vi, { poke, wide, lift = 0, wild = 0, flat = true }) => {
    const x = pos[vi * 3], y = pos[vi * 3 + 1], z = pos[vi * 3 + 2];
    nrm.set(N.getX(vi), N.getY(vi), N.getZ(vi)).normalize();
    // a little off the surface's own normal, and upward: things grow to the light
    nrm.x += R(-0.35, 0.35); nrm.z += R(-0.35, 0.35); nrm.y += R(-0.15, 0.35) + lift;
    nrm.normalize();
    const h = poke * 1.7;
    q.setFromUnitVectors(up, nrm);
    spin.setFromAxisAngle(nrm, rng() * Math.PI * 2);
    euler.setFromQuaternion(spin.multiply(q));
    const c = poke - h * 0.5 - 0.1;
    const k = col[vi * 3 + 1];
    tint.copy(leafColor);
    if (wild) tint.lerp(new THREE.Color('#6d803f'), 0.3);
    sprigs.push({
      p: [x + nrm.x * c, y + nrm.y * c, z + nrm.z * c],
      rot: [euler.x, euler.y, euler.z],
      s: [wide, h, wide],
      color: tint.getHex(),
      k: Math.min(1, 0.55 + 0.45 * k) * R(0.88, 1.05),
      kind: 6,
      crown: [x - nrm.x * 6, y - nrm.y * 6, z - nrm.z * 6, 6 + poke],
      flat,
    });
  };
  for (const { base, n, w, walk } of bodies) {
    section.forEach((s, l) => {
      if (s.y < 4.5) return;
      const high = smooth(4.5, H - 1, s.y);
      for (let i = 0; i < n; i++) {
        const corner = walk[i].corner === 'out';
        // chance per vertex (about 1.35 × 2.3 units of face each; less over
        // the shoulder, where the rings are closer)
        // (only the upper rings of the shoulder: five rings of sprigs laid one
        // over another there cost six milliseconds and showed as one)
        if (s.top > 0 && s.top < 0.55) continue;
        let p = s.top > 0 ? 0.3 : 0.02 + 0.09 * high * high;
        if (corner) p += 0.25;
        if (walk[i].corner === 'in' || walk[i].nook < 0.3) p *= 0.3;
        if (rng() >= p * detail) continue;
        const vi = base + l * w + i;
        if (s.top > 0) sprig(vi, { poke: R(1.2, 2.6), wide: R(3, 4.3), lift: s.top * 0.4 });
        else sprig(vi, { poke: R(0.8, 1.7) * (0.7 + 0.5 * high), wide: R(2.2, 3.4), flat: false });
      }
    });
    // the long ones out of the top
    for (let i = 0; i < n; i++) {
      if (rng() >= 0.05 * detail) continue;
      sprig(base + top * w + i, { poke: R(2.6, 4.6), wide: R(2, 3), lift: 1.4, wild: 1 });
    }
  }

  // ── Litter ────────────────────────────────────────────────────────────────
  // What a hedge stands in: the damp margin of its own dead leaf, thick under
  // the leggy foot and thinning out onto the path a hand or two from it. A
  // ribbon round the foot, its alpha falling away outward, its width
  // wandering; lit, so under a lamp it is leaf and not a painted shadow.
  const lp = [], luv = [], lcol = [], lidx = [];
  const reach = noise3(seed * 7 + 6);
  for (const { cols } of bodies) {
    const base = lp.length / 3;
    for (const q of cols) {
      const out = 1.6 + 2.2 * reach(q.p[0] / 9, 0, q.p[1] / 9) * (0.4 + 0.6 * q.nook);
      for (const [d, a] of [[-foot * 1.2, 0.95], [0.4, 0.9], [out, 0]]) {
        const x = q.p[0] + q.n[0] * d * q.m, z = q.p[1] + q.n[1] * d * q.m;
        lp.push(x, ground + 0.05, z);
        luv.push(x, z);
        lcol.push(1, 1, 1, a);
      }
    }
    for (let i = 0; i < cols.length - 1; i++) {
      for (let r = 0; r < 2; r++) {
        const a = base + i * 3 + r, b = a + 3;
        lidx.push(a, b + 1, a + 1, a, b, b + 1);
      }
    }
  }
  const litter = new THREE.BufferGeometry();
  litter.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  litter.setAttribute('normal', new THREE.Float32BufferAttribute(lp.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  litter.setAttribute('uv', new THREE.Float32BufferAttribute(luv, 2));
  litter.setAttribute('color', new THREE.Float32BufferAttribute(lcol, 4));
  litter.setIndex(lidx);
  return { geometry, sprigs, litter };
}
