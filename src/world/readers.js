// ── The readers ───────────────────────────────────────────────────────────────
// A reader in a hooded robe, cut and sewn rather than turned on a lathe. The
// lathe gave the Library its distant readers — a profile spun round an axis,
// wide at the hem and pointed at the hood — and from across a gallery that is
// enough. Up close, in the court at the heart of the maze (finale.js), it was
// a bowling pin: no shoulders, no arms, one smooth brown skin.
//
// So a reader here is made the way the clothes are:
//   the robe     an ellipse at every height, not a circle (a body is wider
//                than it is deep), flaring to a hem that pools on the ground,
//                hung in folds that deepen towards it and gather at the belt;
//                the upper body a little forward, as people stand
//   the mantle   a short cape over the shoulders, its own hem, its own folds
//   the hood     a cowl drawn forward, its rim rolled, falling onto the chest
//                in front and to a point down the back; inside it, the dark
//   the sleeves  wide, hanging, the hands folded into them — or held up, a
//                book against the chest
//   the cord     a rope at the waist, knotted, its two ends hanging
// Every piece carries its shade in its vertices — the fold valleys darker,
// the hem greyed with the dust of the paths, the inside of the hood black —
// so one material draws the lot. Built facing +z, standing on y = 0, in world
// units (a reader is about 18 tall; a unit is 9.4 cm).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from './textures';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

// A value along keyframes [[x, v], ...], Catmull-Rom between them.
const profile = (keys) => (x) => {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][1];
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (x > keys[i + 1][0]) i++;
  const [x1, p1] = keys[i], [x2, p2] = keys[i + 1];
  const p0 = keys[Math.max(0, i - 1)][1], p3 = keys[Math.min(n - 1, i + 2)][1];
  const t = (x - x1) / (x2 - x1);
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
};

// A sheet of `rows` rings of `cols` points, closed round each ring:
// at(v, u, i) is the point, tint(v, u, i) its colour — and, as a fourth
// number, how far it is in the dark of a cavity (the inside of the hood, the
// mouth of a cuff), which no light reaches (`aDark`, finale.js's shader).
// Dark in its colour alone, it still took the sky's grey sheen like any other
// surface, and the hollow of the hood read as a head.
const sheet = (rows, cols, at, tint) => {
  const pos = new Float32Array(rows * cols * 3), col = new Float32Array(rows * cols * 3), dark = new Float32Array(rows * cols);
  for (let i = 0; i < rows; i++) {
    const v = rows > 1 ? i / (rows - 1) : 0;
    for (let j = 0; j < cols; j++) {
      const u = (j / cols) * TAU, k = i * cols + j;
      pos.set(at(v, u, i), k * 3);
      const c = tint(v, u, i);
      col.set([c[0], c[1], c[2]], k * 3);
      dark[k] = c[3] ?? 0;
    }
  }
  const index = [];
  for (let i = 0; i + 1 < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * cols + j, b = i * cols + ((j + 1) % cols), c = a + cols, d = b + cols;
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aDark', new THREE.BufferAttribute(dark, 1));
  g.setIndex(index);
  return g;
};

// Colour and cavity for a part that is all one of each (a box, the face).
const paint = (g, color, dark = 0) => {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < c.length; i += 3) c.set(color, i);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aDark', new THREE.BufferAttribute(new Float32Array(n).fill(dark), 1));
  return g;
};

// Wound so that most of it faces away from `inside(point)`, then shaded.
// (A sheet that folds back on itself — a hood's rim turning into its inside —
// keeps one winding throughout, so its inner rows face inward, as they should.)
const faceOut = (g, inside) => {
  const p = g.attributes.position, idx = g.index.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  let score = 0;
  for (let t = 0; t < idx.length; t += 3) {
    a.fromBufferAttribute(p, idx[t]);
    b.fromBufferAttribute(p, idx[t + 1]);
    c.fromBufferAttribute(p, idx[t + 2]);
    n.subVectors(b, a).cross(m.subVectors(c, a));
    m.copy(a).add(b).add(c).divideScalar(3);
    score += Math.sign(n.dot(m.sub(inside(m.clone()))));
  }
  if (score < 0) {
    for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  }
  g.computeVertexNormals();
  return g;
};

// A box in one colour, with only what the sheets have (no uv), for merging.
const block = (w, h, d, color, at, rot = null) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.deleteAttribute('uv');
  if (rot) g.applyMatrix4(rot);
  g.translate(...at);
  return paint(g, color);
};

// A tube along points [[x, y, z], ...], radius(t) at every fraction t of its
// length (0 closes it there), colour(t, u) round it; `sag` lets the underside
// hang. Its rings are laid round the tangent the way a right hand turns, so
// it faces outward as built, without asking.
const tube = (pts, radius, colour, { cols = 10, rows = 24, sag = null } = {}) => {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const up = new THREE.Vector3(0, 1, 0), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const frames = Array.from({ length: rows }, (_, i) => {
    const t = i / (rows - 1);
    const c = curve.getPointAt(t);
    curve.getTangentAt(t, T);
    N.crossVectors(T, up);
    if (N.lengthSq() < 1e-6) N.set(1, 0, 0);
    N.normalize();
    B.crossVectors(N, T).normalize();
    return { t, c, N: N.clone(), B: B.clone() };
  });
  const g = sheet(rows, cols, (v, u, i) => {
    const f = frames[i], r = radius(f.t);
    const p = f.c.clone().addScaledVector(f.N, r * Math.cos(u)).addScaledVector(f.B, r * Math.sin(u));
    if (sag && Math.sin(u) < 0) p.y -= sag(f.t) * -Math.sin(u) * Math.min(1, r * 4);
    return p.toArray();
  }, (v, u, i) => colour(frames[i].t, u));
  g.computeVertexNormals();
  return g;
};

const tone = (color, k) => [color.r * k, color.g * k, color.b * k];

// The robes the others wear: dyed dark, and faded unevenly, as wool is.
export const ROBES = ['#2b2019', '#241f1b', '#2e1d18', '#26241a', '#201a16', '#2a2320', '#2f2219'];
const DUST = new THREE.Color('#4a4238');
const HEMP = new THREE.Color('#4a3f2f');
const LEATHER = new THREE.Color('#2a1510');
const PAPER = new THREE.Color('#a8936b');

// `seed` varies the build, the stoop, the fall of the folds; `book` has the
// hands up holding one against the chest instead of folded into the sleeves.
export function readerGeometry({ seed = 1, color = ROBES[0], book = false } = {}) {
  const rng = makeRng(seed);
  const R = (a, b) => a + (b - a) * rng();
  const base = new THREE.Color(color);
  const tall = R(0.96, 1.05), wide = R(0.95, 1.07), stoop = R(0.28, 0.55);
  const lean = (y) => stoop * Math.max(0, y - 5) ** 1.2 / 10;   // the upper body a little forward
  const grain = () => 0.93 + 0.14 * rng();                      // the wool not quite one colour

  // ── The robe ────────────────────────────────────────────────────────────
  const TOP = 15.1, BELT = 9.6;
  const rx = profile([[0, 3.1], [0.6, 3.0], [1.9, 2.8], [4.7, 2.5], [7.5, 2.25], [BELT, 2.06], [11.3, 2.2], [13.0, 2.3], [14.1, 2.25], [14.7, 1.8], [TOP, 1.05]]);
  const rz = profile([[0, 2.8], [0.6, 2.7], [1.9, 2.45], [4.7, 2.08], [7.5, 1.75], [BELT, 1.47], [11.3, 1.53], [13.0, 1.47], [14.1, 1.27], [14.7, 1.08], [TOP, 0.85]]);
  const waves = [[3, 0.3], [5, 0.45], [7, 0.32], [10, 0.2], [13, 0.12]].map(([k, a]) => ({ k, a, ph: R(0, TAU), drift: R(0.15, 0.45) }));
  const norm = waves.reduce((s, w) => s + w.a, 0) / 1.7;
  // -1 in the valley of a fold, +1 on its ridge: rounded ridges, creased valleys
  const fold = (u, y) => {
    let s = 0;
    for (const w of waves) s += w.a * Math.sin(w.k * u + w.ph + 0.35 * Math.sin(y * w.drift + w.ph));
    const f = Math.max(-1, Math.min(1, s / norm));
    return f > 0 ? f ** 0.7 : -((-f) ** 1.5);
  };
  // how deep the folds hang: deepest at the hem, gathered at the belt, a
  // little over the chest
  const depth = (y) => (y < BELT
    ? 0.05 + 0.42 * smooth((BELT - y) / BELT) ** 0.7
    : 0.05 + 0.1 * Math.sin(Math.PI * clamp01((y - BELT) / 4.5)));
  const hemPh = R(0, TAU);
  const hem = (u) => 0.22 * (0.5 + 0.5 * Math.sin(3 * u + hemPh)) + 0.08 * (0.5 + 0.5 * Math.sin(7 * u));
  const robeAt = (v, u) => {
    let y = v * TOP;
    y += (1 - v) ** 10 * hem(u);
    const front = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(u));  // the back hangs straighter
    const d = depth(y) * front * fold(u, y);
    return [(rx(y) + d) * Math.cos(u) * wide, y * tall, lean(y) + (rz(y) + d * 0.9) * Math.sin(u) * wide];
  };
  const robe = faceOut(sheet(46, 72, robeAt, (v, u) => {
    const y = v * TOP;
    const f = fold(u, y), deep = Math.min(1, depth(y) * 2.4);
    let k = 1 - (0.5 - 0.5 * f) * deep * 0.78;                // dark in the valleys
    k *= 1 - 0.35 * Math.exp(-(((y - 11.1) / 0.9) ** 2));      // under the mantle's hem
    const c = base.clone().multiplyScalar(k * grain());
    c.lerp(DUST, 0.5 * clamp01(1 - y / 2.2) ** 2);             // the dust of the paths
    return c.toArray();
  }), (p) => new THREE.Vector3(0, p.y, lean(p.y / tall)));

  // ── The mantle ──────────────────────────────────────────────────────────
  const mx = profile([[0, 2.95], [0.35, 2.9], [0.6, 2.75], [0.8, 2.3], [0.92, 1.7], [1, 1.2]]);
  const mz = profile([[0, 2.0], [0.35, 1.95], [0.6, 1.85], [0.8, 1.55], [0.92, 1.3], [1, 1.05]]);
  const mPh = R(0, TAU);
  const mHem = (u) => 11.55 + 0.2 * Math.sin(2 * u + mPh) + 0.1 * Math.sin(5 * u + mPh) - 0.3 * Math.max(0, Math.sin(u)) ** 3;
  const mFold = (u) => 0.6 * Math.sin(4 * u + mPh) + 0.4 * Math.sin(7 * u + 2 * mPh);
  const mantle = faceOut(sheet(18, 64, (v, u, i) => {
    // the first ring is the hem turned under, so the cape has an edge to it
    const t = i === 0 ? 0 : (i - 1) / 16;
    const y = lerp(mHem(u), 15.3, t) + (i === 0 ? 0.08 : 0);
    const d = (0.07 + 0.17 * (1 - t) ** 1.5) * mFold(u) - (i === 0 ? 0.16 : 0);
    return [(mx(t) + d) * Math.cos(u) * wide, y * tall, lean(y) + (mz(t) + d) * Math.sin(u) * wide];
  }, (v, u, i) => {
    const t = i === 0 ? 0 : (i - 1) / 16;
    const k = (i === 0 ? 0.6 : 1) * (0.72 + 0.28 * (0.5 + 0.5 * mFold(u))) * (1 - 0.2 * smooth((t - 0.8) / 0.2));
    return tone(base, 1.06 * k * grain());
  }), (p) => new THREE.Vector3(0, p.y, lean(p.y / tall)));

  // ── The hood ────────────────────────────────────────────────────────────
  // Rings from the rim of the opening back to the point, each with its own
  // width and its height above and below the line through their middles (a
  // cowl falls further than it rises). Before the rim, the same rings again,
  // a little smaller, going back in: its inside. The face is the dark.
  const H = new THREE.Vector3(0, 16.1, 0.28 + lean(16.1));
  const droop = R(-0.35, 0.35);
  const path = new THREE.CatmullRomCurve3([
    [0, 0.05, 1.36], [0, 0.28, 0.5], [0, 0.55, -0.52], [0, 0.95 + droop * 0.4, -1.25], [0, 1.55 + droop, -1.72],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).add(H)), false, 'centripetal');
  // (Fuller than the head it holds, and its rim a thick roll of cloth round
  // a deep hollow: cut close, it read from the front as a head in a halo.)
  const hw = profile([[0, 1.3], [0.25, 1.85], [0.55, 1.8], [0.8, 1.2], [1, 0]]);
  const hu = profile([[0, 1.5], [0.25, 2.0], [0.55, 1.95], [0.8, 1.3], [1, 0]]);
  const hd = profile([[0, 1.7], [0.25, 2.35], [0.55, 2.25], [0.8, 1.55], [1, 0]]);
  const rings = [
    // (a roll, not a pleat: folded tighter than this, its two faces fought
    // for the same depth and the rim flickered in pale dashes)
    ...[0.55, 0.4, 0.26, 0.13, 0.03].map((v) => ({ v, s: 0.8 + 0.1 * (1 - v / 0.55), back: 0, dark: true })),
    { v: 0, s: 1.05, back: -0.14, rim: true },
    ...Array.from({ length: 17 }, (_, k) => ({ v: k / 16, s: 1, back: 0 })),
  ];
  const T = new THREE.Vector3(), Y = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
  const hPh = R(0, TAU);
  const hood = faceOut(sheet(rings.length, 40, (_, u, i) => {
    const r = rings[i];
    const c = path.getPointAt(Math.min(1, r.v));
    path.getTangentAt(Math.min(1, r.v), T);
    Y.set(0, -T.z, T.y);
    if (Y.y < 0) Y.negate();
    Y.normalize();
    c.addScaledVector(T, r.back);
    const wrinkle = r.dark || r.rim ? 0 : 0.06 * (1 - r.v) * Math.sin(6 * u + hPh);
    const w = (hw(r.v) + wrinkle) * r.s, h = (Math.sin(u) > 0 ? hu(r.v) : hd(r.v)) * r.s + wrinkle;
    c.addScaledVector(X, w * Math.cos(u) * wide).addScaledVector(Y, h * Math.sin(u));
    return [c.x, (c.y - 0) * tall, c.z];
  }, (_, u, i) => {
    const r = rings[i];
    // the inside going into the dark, a little of the rim's light caught
    // just inside its lower edge
    if (r.dark) return [...tone(base, 0.25), smooth(r.v / 0.3) * 0.85 + 0.15 - 0.2 * (1 - r.v / 0.55) * Math.max(0, -Math.sin(u))];
    // (the rim no paler than the hood: lit from behind, a paler roll read as a halo)
    if (r.rim) return tone(base, 0.95);
    return tone(base, (0.84 + 0.16 * Math.max(0, Math.sin(u))) * grain());
    // (asked from the middle of the head: asked level with each point, the
    // cowl's underside voted it inside out and the hood vanished but its rim)
  }), () => new THREE.Vector3(H.x, H.y * tall, H.z));
  // the dark where the face would be, set well back in the hood
  const face = paint(new THREE.SphereGeometry(1, 16, 12), [0, 0, 0], 1);
  face.deleteAttribute('uv');
  face.scale(0.78 * wide, 0.98 * tall, 0.7);
  face.translate(H.x, (H.y - 0.12) * tall, H.z - 0.05);

  // ── The sleeves ─────────────────────────────────────────────────────────
  // Wide and hanging: fuller at the cuff than the shoulder, the underside
  // sagging, the cuff's mouth turned in and dark. Folded, the two cuffs meet
  // over the belt with the hands in them; with a book, they come up under it.
  const sleeves = [-1, 1].map((s) => {
    const shoulder = [s * 1.72, 13.55, 0.05], elbow = book ? [s * 2.3, 11.4, 0.85] : [s * 2.28, 11.0, 0.55];
    const cuff = book ? [s * 1.15, 10.9, 2.35] : [s * 0.42, 10.3, 2.05];
    const pts = [shoulder, elbow, cuff].map(([x, y, z]) => [x * wide, y * tall, z + lean(y)]);
    // (the last few rings close the cuff's mouth: dark, where the hands are)
    // (Slimmer over the arm than it first was — round and full the whole way
    // they read as bolsters — and the cloth of the cuff hanging well below
    // the wrist, as a wide sleeve's does.)
    const radius = (t) => lerp(0.56, 0.9, smooth((t - 0.45) / 0.55)) * (t > 0.96 ? Math.max(0, 1 - (t - 0.96) / 0.04) : 1);
    return tube(pts, radius, (t, u) => {
      if (t > 0.965) return [...tone(base, 0.3), 1];
      const under = 0.5 + 0.5 * Math.sin(u);
      return tone(base, (0.55 + 0.45 * under) * (0.86 + 0.14 * Math.sin(4 * u + s + t * 6)));
    }, { cols: 22, rows: 28, sag: (t) => 0.75 * smooth((t - 0.4) / 0.6) ** 1.3 });
  });

  // ── The cord ────────────────────────────────────────────────────────────
  const beltY = BELT + 0.05;
  const loop = Array.from({ length: 49 }, (_, k) => {
    const u = (k / 48) * TAU;
    const d = depth(beltY) * fold(u, beltY) + 0.12;
    return [(rx(beltY) + d) * Math.cos(u) * wide, beltY * tall, lean(beltY) + (rz(beltY) + d) * Math.sin(u) * wide];
  });
  const hemp = (t, u) => tone(HEMP, 0.75 + 0.25 * Math.sin(u * 3 + t * 40));
  const cord = [tube(loop, () => 0.15, hemp, { cols: 8, rows: 60 })];
  const knot = [-0.55 * wide, beltY * tall, lean(beltY) + (rz(beltY) + 0.2) * wide];
  for (const [dx, len] of [[-0.12, 3.0], [0.2, 2.3]]) {
    const pts = [0, 0.5, 1].map((t) => {
      const y = knot[1] - len * t;
      return [knot[0] + dx * t, y, lean(y / tall) + (rz(y / tall) + depth(y / tall) * 0.6 + 0.24) * wide];
    });
    // (a knot at the end of each, and the end closed)
    cord.push(tube(pts, (t) => (t > 0.86 ? 0.15 + 0.12 * Math.sin(Math.PI * (t - 0.86) / 0.14) : 0.13) * (t > 0.995 ? 0 : 1), hemp, { cols: 8, rows: 16 }));
  }

  const parts = [robe, mantle, hood, face, ...sleeves, ...cord];

  // ── The book ────────────────────────────────────────────────────────────
  if (book) {
    const rot = new THREE.Matrix4().makeRotationX(-0.24).multiply(new THREE.Matrix4().makeRotationY(R(-0.12, 0.12)));
    // (low and close against the chest, where the cuffs come up under it)
    const at = new THREE.Vector3(0, 11.95 * tall, 2.2 + lean(11.95));
    const place = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(rot).add(at).toArray();
    const leather = tone(LEATHER, grain()), paper = tone(PAPER, 0.8);
    parts.push(
      block(2.55, 3.35, 0.07, leather, place(0, 0, 0.33), rot),
      block(2.55, 3.35, 0.07, leather, place(0, 0, -0.33), rot),
      block(0.1, 3.35, 0.73, leather, place(-1.27, 0, 0), rot),
      block(2.4, 3.2, 0.6, paper, place(0.03, 0, 0), rot),
    );
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}
