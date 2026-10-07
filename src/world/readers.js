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
//   the hood     a cowl drawn forward, falling onto the chest in front and to
//                a point down the back; inside it, the dark
//   the sleeves  wide, hanging, the hands folded into them — or out of them,
//                holding a book open
//   the cord     a rope at the waist, knotted, its two ends hanging
// Every piece carries its shade in its vertices — the fold valleys darker,
// the hem greyed with the dust of the paths, the inside of the hood black —
// so one material draws the lot. Built facing +z, standing on y = 0, in world
// units (a reader is about 18 tall; a unit is 9.4 cm).
//
// 2026-10-05, seen close — someone walking up to a reader on the bridge and
// looking up into the hood — they were still dolls: the hood a smooth helmet
// with a fat round rim about a hole, the book a brown box held by no hands,
// the folded cuffs two blunt ends meeting in a beak, every surface one even
// clay. So now:
//   the hood     two panels sewn over the crown, so a ridge runs back over
//                the head and the sides hang flatter; the opening brought
//                forward over the brow and narrowing to the throat, its edge
//                a thin uneven hem, the slack of the cloth in folds
//   the face     a head, not a ball — brow, sockets, nose, cheekbones, chin —
//                so the little light the hood lets in falls on a face
//   the book     open, in two hands: fingers under the boards, thumbs on the
//                pages, the spine's raised bands on its back, the leaves
//                curving down into the gutter with a grey block of type on each
//   the sleeves  folded, each hand goes into the other cuff
//   the feet     shoes and hose, which step under the hem when the reader
//                walks (clothShader)
//   the wool     uneven, with a nap, and the fuzz of it catching the light
//                where it turns away (clothShader)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from './textures';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2));

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

// What each part is made of (`aKind`), which is how clothShader shades it:
// the robe's wool, the rest of the wool (mantle, hood, sleeves), the hemp of
// the cord, leather, paper, skin (the face of one reading, over the page, a
// kind of its own) — and the shoes, 6 the right and 7 the left, with .5 for
// the hose above each, which step when the reader walks.
const K = { ROBE: 0, WOOL: 1, HEMP: 2, LEATHER: 3, PAPER: 4, SKIN: 5, FACE: 5.25, SHOE: 6 };
// Where the feet stand (each FOOT_X either side, FOOT_Z0 forward of the
// middle), how high one is lifted in its step, and what a shoe turns about:
// the ball of the foot as the heel comes up, the heel as the toe does.
const FOOT_X = 0.72, FOOT_Z0 = 0.25, FOOT_LIFT = 0.7, FOOT_BALL = 1.05, FOOT_HEEL = -0.8;

// A sheet of `rows` rings of `cols` points, closed round each ring (or, not
// `closed`, an open strip with u from 0 to 1 across it): at(v, u, i) is the
// point, tint(v, u, i) its colour — and, as a fourth number, how far it is in
// the dark of a cavity (the inside of the hood, the mouth of a cuff), which no
// light reaches (`aDark`, clothShader). Dark in its colour alone, it still
// took the sky's grey sheen like any other surface, and the hollow of the hood
// read as a head.
const sheet = (rows, cols, at, tint, kind = K.WOOL, closed = true) => {
  const n = rows * cols;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), dark = new Float32Array(n);
  for (let i = 0; i < rows; i++) {
    const v = rows > 1 ? i / (rows - 1) : 0;
    for (let j = 0; j < cols; j++) {
      const u = closed ? (j / cols) * TAU : j / (cols - 1), k = i * cols + j;
      pos.set(at(v, u, i), k * 3);
      const c = tint(v, u, i);
      col.set([c[0], c[1], c[2]], k * 3);
      dark[k] = c[3] ?? 0;
    }
  }
  const index = [];
  for (let i = 0; i + 1 < rows; i++) {
    for (let j = 0; j < (closed ? cols : cols - 1); j++) {
      const a = i * cols + j, b = i * cols + ((j + 1) % cols), c = a + cols, d = b + cols;
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aDark', new THREE.BufferAttribute(dark, 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(kind), 1));
  g.setIndex(index);
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

// A box (or any indexed part) coloured where it was built — `color(x, y, z,
// nx, ny, nz)` in its own frame, after `shape` has bent it — and then carried
// into place by `to`. A mirrored place turns its faces inside out, so `flip`
// winds them back.
const carry = (g, to, { color, kind, shape = null, flip = false }) => {
  const p = g.attributes.position, nrm = g.attributes.normal, n = p.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (shape) [x, y, z] = shape(x, y, z);
    col.set(color(x, y, z, nrm.getX(i), nrm.getY(i), nrm.getZ(i)), i * 3);
    const q = to(x, y, z);
    p.setXYZ(i, q.x, q.y, q.z);
  }
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aDark', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(kind), 1));
  if (flip) {
    const idx = g.index.array;
    for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  }
  g.computeVertexNormals();
  return g;
};

// A tube along points ([x, y, z] or Vector3), radius(t) at every fraction t of
// its length (0 closes it there; [across, up] for an oval, `up` saying which
// way up is), colour(t, u) round it; `sag` lets the underside hang. Its rings
// are laid round the tangent the way a right hand turns, so it faces outward
// as built, without asking.
const UP = new THREE.Vector3(0, 1, 0);
const tube = (pts, radius, colour, { cols = 10, rows = 24, sag = null, kind = K.WOOL, up = UP } = {}) => {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p))), false, 'centripetal');
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
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
    const [ra, rb] = Array.isArray(r) ? r : [r, r];
    const p = f.c.clone().addScaledVector(f.N, ra * Math.cos(u)).addScaledVector(f.B, rb * Math.sin(u));
    if (sag && Math.sin(u) < 0) p.y -= sag(f.t) * -Math.sin(u) * Math.min(1, ra * 4);
    return p.toArray();
  }, (v, u, i) => colour(frames[i].t, u), kind);
  g.computeVertexNormals();
  return g;
};

const tone = (color, k) => [color.r * k, color.g * k, color.b * k];

// The robes the others wear: dyed dark, and faded unevenly, as wool is.
export const ROBES = ['#2b2019', '#241f1b', '#2e1d18', '#26241a', '#201a16', '#2a2320', '#2f2219'];
const DUST = new THREE.Color('#4a4238');
const HEMP = new THREE.Color('#433827');
const LEATHER = new THREE.Color('#2a1510');
const PAPER = new THREE.Color('#a8936b');
const SKIN = new THREE.Color('#4a382c');
const HAND = new THREE.Color('#44302a');
const SHOE = new THREE.Color('#1f1610');

// A sheet's points moved, and its shading found again (the winding stays as
// it was voted in the pose it was built in).
const remap = (g, fn) => {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const q = fn([p.getX(i), p.getY(i), p.getZ(i)]);
    p.setXYZ(i, q[0], q[1], q[2]);
  }
  g.computeVertexNormals();
  return g;
};

// `seed` varies the build, the stoop, the fall of the folds; `book` has the
// reader reading as they go, a book open in their hands and the head bowed
// over it, instead of the hands folded into the sleeves. `seated` sits the
// reader down with the book open in the lap; `detail` thins every sheet, and
// below 1 leaves off the hands and feet, for readers only seen from afar.
export function readerGeometry({ seed = 1, color = ROBES[0], book = false, seated = false, detail = 1 } = {}) {
  const rng = makeRng(seed);
  const R = (a, b) => a + (b - a) * rng();
  const base = new THREE.Color(color);
  const tall = R(0.96, 1.05), wide = R(0.95, 1.07), stoop = R(0.28, 0.55);
  const lean = (y) => stoop * Math.max(0, y - 5) ** 1.2 / 10;   // the upper body a little forward
  const grain = () => 0.93 + 0.14 * rng();                      // the wool not quite one colour
  const res = (n) => Math.max(8, Math.round(n * detail));
  const near = detail >= 1;

  // ── Sitting ─────────────────────────────────────────────────────────────
  // Built standing and then sat down: everything from the hips up let down
  // onto the seat (DROP); the robe below the hips carried forward over the
  // thighs, round the knees and down the shins to the floor, its section
  // turning with them; the head bowed about the neck over the book (and a
  // little, standing, over a book read on the way).
  const HIP = 9, DROP = seated ? 3.4 : 0, LAP = HIP - DROP;
  const THIGH = 4.2, BEND = 1.3, TURN = 1.6, RUN = THIGH + BEND * Math.PI / 2 + (LAP - BEND);
  const bow = seated ? R(0.3, 0.42) : book ? R(0.2, 0.3) : 0;
  const lap = ([x, y, z]) => {
    const d = ((HIP - y) / HIP) * RUN;
    let cy, cz, b;   // the middle of the cloth there, and how far its section has turned
    if (d <= THIGH) {
      cy = LAP; cz = d; b = (Math.PI / 2) * smooth(d / TURN);
    } else if (d <= THIGH + BEND * Math.PI / 2) {
      const f = (d - THIGH) / BEND;
      cy = LAP - BEND * (1 - Math.cos(f)); cz = THIGH + BEND * Math.sin(f); b = Math.PI / 2 - f;
    } else {
      cy = LAP - BEND - (d - THIGH - BEND * Math.PI / 2); cz = THIGH + BEND; b = 0;
    }
    const k = 0.72 + 0.28 * Math.cos(b);   // drawn closer over the thighs than down the shins
    return [x, cy + z * k * Math.sin(b), cz + z * k * Math.cos(b)];
  };
  const sit = (p) => [p[0], p[1] - DROP, p[2]];
  const NECK = [14.9 * tall, lean(14.9)];
  const bowed = (p) => {
    const dy = p[1] - NECK[0], dz = p[2] - NECK[1];
    return [p[0], NECK[0] - DROP + dy * Math.cos(bow) - dz * Math.sin(bow), NECK[1] + dy * Math.sin(bow) + dz * Math.cos(bow)];
  };

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
    y -= 0.75 * Math.max(0, Math.sin(u)) ** 2 * smooth((y - 13.6) / 1.5);   // its neck scooped as the mantle's
    const front = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(u));  // the back hangs straighter
    const d = depth(y) * front * fold(u, y);
    return [(rx(y) + d) * Math.cos(u) * wide, y * tall, lean(y) + (rz(y) + d * 0.9) * Math.sin(u) * wide];
  };
  const robe = faceOut(sheet(res(46), res(72), robeAt, (v, u) => {
    const y = v * TOP;
    const f = fold(u, y), deep = Math.min(1, depth(y) * 2.4);
    let k = 1 - (0.5 - 0.5 * f) * deep * 0.78;                // dark in the valleys
    k *= 1 - 0.35 * Math.exp(-(((y - 11.1) / 0.9) ** 2));      // under the mantle's hem
    const c = base.clone().multiplyScalar(k * grain());
    c.lerp(DUST, 0.5 * clamp01(1 - y / 2.2) ** 2);             // the dust of the paths
    return c.toArray();
  }, K.ROBE), (p) => new THREE.Vector3(0, p.y, lean(p.y / tall)));
  if (seated) remap(robe, (p) => (p[1] < HIP ? lap(p) : sit(p)));

  // ── The mantle ──────────────────────────────────────────────────────────
  const mx = profile([[0, 2.95], [0.35, 2.9], [0.6, 2.75], [0.8, 2.3], [0.92, 1.7], [1, 1.2]]);
  const mz = profile([[0, 2.0], [0.35, 1.95], [0.6, 1.85], [0.8, 1.55], [0.92, 1.3], [1, 1.05]]);
  const mPh = R(0, TAU);
  const mHem = (u) => 11.55 + 0.2 * Math.sin(2 * u + mPh) + 0.1 * Math.sin(5 * u + mPh) - 0.3 * Math.max(0, Math.sin(u)) ** 3;
  const mFold = (u) => 0.6 * Math.sin(4 * u + mPh) + 0.4 * Math.sin(7 * u + 2 * mPh);
  // (the neck of it scooped low in front: standing round the neck as high as
  // the chin, it hid the lower face, the one part the light finds in a hood)
  const scoop = (u, t) => 0.75 * Math.max(0, Math.sin(u)) ** 2 * smooth((t - 0.55) / 0.45);
  const mantle = faceOut(sheet(18, res(64), (v, u, i) => {
    // the first ring is the hem turned under, so the cape has an edge to it
    const t = i === 0 ? 0 : (i - 1) / 16;
    const y = lerp(mHem(u), 15.3, t) - scoop(u, t) + (i === 0 ? 0.08 : 0);
    const d = (0.07 + 0.17 * (1 - t) ** 1.5) * mFold(u) - (i === 0 ? 0.16 : 0);
    return [(mx(t) + d) * Math.cos(u) * wide, y * tall, lean(y) + (mz(t) + d) * Math.sin(u) * wide];
  }, (v, u, i) => {
    const t = i === 0 ? 0 : (i - 1) / 16;
    const k = (i === 0 ? 0.6 : 1) * (0.72 + 0.28 * (0.5 + 0.5 * mFold(u))) * (1 - 0.2 * smooth((t - 0.8) / 0.2));
    // (the collar, inside the hood: seen down its opening under the chin, lit,
    // it was a shelf)
    return [...tone(base, 1.06 * k * grain()), 0.9 * smooth((t - 0.82) / 0.14)];
  }), (p) => new THREE.Vector3(0, p.y, lean(p.y / tall)));
  if (seated) remap(mantle, sit);

  // ── The hood ────────────────────────────────────────────────────────────
  // Rings from the rim of the opening back to the point, each with its own
  // width and its height above and below the line through their middles (a
  // cowl falls further than it rises). Before the rim, the same rings again,
  // a little smaller, going back in: its inside. The face is in the dark.
  const H = new THREE.Vector3(0, 16.1, 0.28 + lean(16.1));
  const droop = R(-0.35, 0.35);
  const path = new THREE.CatmullRomCurve3([
    [0, 0.05, 1.36], [0, 0.28, 0.5], [0, 0.55, -0.52], [0, 0.95 + droop * 0.4, -1.25], [0, 1.55 + droop, -1.72],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).add(H)), false, 'centripetal');
  // (Fuller than the head it holds: cut close, it read from the front as a
  // head in a halo.)
  const hw = profile([[0, 1.28], [0.25, 1.82], [0.55, 1.78], [0.8, 1.2], [1, 0]]);
  const hu = profile([[0, 1.5], [0.25, 2.0], [0.55, 1.95], [0.8, 1.3], [1, 0]]);
  const hd = profile([[0, 1.7], [0.25, 2.35], [0.55, 2.25], [0.8, 1.55], [1, 0]]);
  // The edge: a hem, turned in. (It was a thick roll of cloth, which from below
  // read as the rim of a helmet; folded much tighter than this, its two faces
  // fought for the same depth and it flickered in pale dashes.)
  const rings = [
    ...[0.55, 0.4, 0.26, 0.14, 0.05].map((v) => ({ v, s: 0.8 + 0.12 * (1 - v / 0.55), dark: true })),
    { v: 0, s: 1.025, back: -0.07, rim: true },
    ...Array.from({ length: 17 }, (_, k) => ({ v: k / 16, s: 1 })),
  ];
  const T = new THREE.Vector3(), Y = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
  const hPh = R(0, TAU), hPh2 = R(0, TAU);
  // the opening: its top brought forward over the brow, its bottom drawn back
  // to the throat, and the hem not quite even
  const brow = (u) => 0.3 * Math.max(0, Math.sin(u)) ** 2 - 0.22 * Math.max(0, -Math.sin(u)) ** 2 + 0.05 * Math.sin(3 * u + hPh);
  // the slack of the cloth: pleats running back to the point, and soft folds
  // where the sides fall onto the shoulders (none at the edge itself)
  const hoodFold = (u, v) => (0.07 * Math.sin(5 * u + hPh + 2 * v) + 0.06 * Math.max(0, 0.2 - Math.sin(u)) * Math.sin(9 * u + hPh2 + 4 * v))
    * (1 - v) ** 0.7 * smooth(v / 0.12);
  const hood = faceOut(sheet(rings.length, res(44), (_, u, i) => {
    const r = rings[i], v = Math.min(1, r.v);
    const c = path.getPointAt(v);
    path.getTangentAt(v, T);
    Y.set(0, -T.z, T.y);
    if (Y.y < 0) Y.negate();
    Y.normalize();
    const edge = 1 - smooth(v / 0.3);
    c.addScaledVector(T, (r.back ?? 0) - brow(u) * edge);
    const cu = Math.cos(u), su = Math.sin(u);
    // two panels sewn along the top: a ridge back over the crown, which a
    // round cowl did not have, and the sides flatter
    const crest = (r.dark ? 0.08 : lerp(0.12, 0.28, smooth(v / 0.3))) * (1 - smooth((v - 0.7) / 0.3));
    let cx = Math.sign(cu) * Math.abs(cu) ** 0.82;
    const cy = su > 0 ? (1 - crest) * su + crest * (1 - Math.abs(cu)) : su;
    // narrowing to the throat, where its two edges cross
    if (su < 0) cx *= 1 - 0.3 * (-su) ** 1.6 * edge;
    const f = r.dark || r.rim ? 0 : hoodFold(u, v);
    const w = hw(v) * r.s + f, h = (su > 0 ? hu(v) : hd(v)) * r.s + f;
    c.addScaledVector(X, w * cx * wide).addScaledVector(Y, h * cy);
    return [c.x, c.y * tall, c.z];
  }, (_, u, i) => {
    const r = rings[i];
    // the inside going into the dark, a little of the rim's light caught
    // just inside its lower edge
    if (r.dark) return [...tone(base, 0.25), smooth(r.v / 0.3) * 0.85 + 0.15 - 0.2 * (1 - r.v / 0.55) * Math.max(0, -Math.sin(u))];
    // (the rim no paler than the hood: lit from behind, a paler roll read as a halo)
    if (r.rim) return tone(base, 0.95);
    return tone(base, (0.84 + 0.16 * Math.max(0, Math.sin(u))) * (1 + 1.6 * hoodFold(u, r.v)) * grain());
    // (asked from the middle of the head: asked level with each point, the
    // cowl's underside voted it inside out and the hood vanished but its rim)
  }), () => new THREE.Vector3(H.x, H.y * tall, H.z));
  if (bow) remap(hood, bowed);

  // ── The face ────────────────────────────────────────────────────────────
  // Set back in the hood's shadow. All black, it was a hole cut out of the
  // picture — a mask, from the front; a sphere given back a little light read
  // as a smooth bald head. So it is a head: the brow over the sockets, the
  // nose, the cheekbones, the mouth, the jaw narrowing to the chin — and only
  // where they stand out (the nose, the cheeks, the chin) does any light come
  // back out of the hood. Only the front of it is made; the rest is the
  // hood's dark. Built round its middle in its own units (half a width, a
  // height, a depth: 0.74, 1.12, 0.92).
  const nose = profile([[-0.44, 0], [-0.32, 0.04], [-0.22, 0.3], [-0.1, 0.25], [0.06, 0.15], [0.22, 0.07], [0.34, 0]]);
  const head = (v, u) => {
    const th = (u - 0.5) * 3.9, ph = (v - 0.5) * 3.05;
    const x = Math.sin(th) * Math.cos(ph), y = Math.sin(ph), z = Math.cos(th) * Math.cos(ph);
    const front = smooth((z - 0.25) / 0.55);
    let X = x * 0.74, Z = z * 0.92;
    if (y < 0) X *= 1 - 0.3 * smooth(-y / 0.95) ** 1.3 * (0.4 + 0.6 * front);
    Z -= 0.1 * front * (1 - y * y);   // the face flatter than the skull
    Z += front * (0.09 * gauss(x, y, 0, 0.34, 0.55, 0.09)
      - 0.15 * (gauss(x, y, -0.34, 0.15, 0.17, 0.12) + gauss(x, y, 0.34, 0.15, 0.17, 0.12))
      + nose(y) * Math.exp(-((x / lerp(0.2, 0.12, smooth((y + 0.2) / 0.5))) ** 2))
      + 0.07 * (gauss(x, y, -0.46, -0.08, 0.2, 0.15) + gauss(x, y, 0.46, -0.08, 0.2, 0.15))
      - 0.04 * gauss(x, y, 0, -0.5, 0.24, 0.05)
      + 0.1 * gauss(x, y, 0, -0.78, 0.24, 0.13));
    return { p: [X * wide, y * 1.12 * tall, Z], x, y, front };
  };
  const face = faceOut(sheet(res(26), res(34), (v, u) => head(v, u).p, (v, u) => {
    const { x, y, front } = head(v, u);
    // (Given back in patches — the nose, each cheek, the chin — the two
    // cheeks lit in the black of the hood read as eyes. So the face comes out
    // of the dark evenly from the brow down, the nose a little the most.)
    const lit = front * (smooth((0.1 - y) / 0.9) + 0.4 * gauss(x, y, 0, -0.2, 0.16, 0.14));
    const socket = gauss(x, y, -0.34, 0.15, 0.2, 0.14) + gauss(x, y, 0.34, 0.15, 0.2, 0.14);
    const c = tone(SKIN, (1 - 0.35 * socket) * (0.95 + 0.1 * rng()));
    c[0] *= 1 + 0.15 * gauss(x, y, 0, -0.52, 0.2, 0.06);
    return [...c, Math.min(0.985, 0.96 - 0.13 * Math.min(1, lit) + 0.02 * socket)];
    // (over an open book, the page throws the lamps' light back up into the
    // hood: K.FACE, clothShader)
  }, book || seated ? K.FACE : K.SKIN, false), () => new THREE.Vector3(0, 0, 0));
  face.translate(H.x, (H.y + 0.12) * tall, H.z - 0.12);
  if (bow) remap(face, bowed);

  const parts = [robe, mantle, hood, face];

  // ── The book ────────────────────────────────────────────────────────────
  // Open in the hands. In its own frame — the gutter at the middle, x across
  // it, y along the spine toward the reader, z up out of the page — two
  // boards on the spine in a shallow V, a half of the leaves on each, falling
  // into the gutter; `M` stands it in the reader's hands. Each hand holds its
  // side from under the board, fingers toward the spine, and the thumb comes
  // round the fore-edge onto the page. The wrists are kept for the sleeves.
  const LW = 1.5, LL = 2.25, J = 0.27, BETA = 0.13, TH = 0.23, BOARD = 0.065;
  const wrists = {};
  const openBook = (M) => {
    const leafAt = (s) => (x, y, z) => new THREE.Vector3(s * (J + x * Math.cos(BETA) - z * Math.sin(BETA)), y, x * Math.sin(BETA) + z * Math.cos(BETA)).applyMatrix4(M);
    const leather = (k) => tone(LEATHER, k * grain());
    for (const s of [-1, 1]) {
      const at = leafAt(s);
      // the board, worn paler at its edges and most at its corners
      parts.push(carry(new THREE.BoxGeometry(LW, LL, BOARD, res(6), res(8), 1).translate(LW / 2, 0, 0), at, {
        kind: K.LEATHER, flip: s < 0,
        color: (x, y) => {
          const ex = LW - x, ey = LL / 2 - Math.abs(y);
          return leather(1 + 0.4 * (1 - smooth(Math.min(ex, ey) / 0.2)) + 0.35 * (1 - smooth(Math.hypot(ex, ey) / 0.32)));
        },
      }));
      // half of the leaves: down into the gutter, a little rise, then flat
      // to the fore-edge; on the page a grey block of type in its margins
      const x0 = -J + 0.03, x1 = LW - 0.07, y1 = LL / 2 - 0.07;
      const top = (x) => BOARD / 2 + TH * (0.28 + 0.72 * smooth((x - x0) / 0.36)) * (1 + 0.06 * Math.sin(Math.PI * clamp01((x - 0.05) / 0.85)));
      parts.push(carry(new THREE.BoxGeometry(x1 - x0, 2 * y1, 1, res(14), res(10), 1).translate((x0 + x1) / 2, 0, 0.5), at, {
        kind: K.PAPER, flip: s < 0,
        shape: (x, y, z) => [x, y, z > 0.5 ? top(x) : BOARD / 2],
        color: (x, y, z, nx, ny, nz) => tone(PAPER, nz > 0.5 ? (x > 0.14 && x < LW - 0.26 && Math.abs(y) < y1 - 0.24 ? 0.76 : 1) : 0.78),
      }));
      wrists[s] = at(LW + 0.55, 0.5, -BOARD / 2 - 0.3);
    }
    // the back of the spine, rounded under the gutter, its bands across it
    const spineAt = (a, y, r = J) => new THREE.Vector3(r * Math.cos(a), y, r * 1.05 * Math.sin(a)).applyMatrix4(M);
    parts.push(sheet(res(8), 10, (v, u) => spineAt(Math.PI * (1 + u), (v - 0.5) * LL).toArray(), () => tone(LEATHER, 0.9), K.LEATHER, false));
    parts[parts.length - 1].computeVertexNormals();
    if (near) {
      for (const y of [-0.32, -0.11, 0.11, 0.32].map((k) => k * LL)) {
        parts.push(tube(Array.from({ length: 7 }, (_, k) => spineAt(Math.PI * (1 + k / 6), y)), () => 0.035, () => tone(LEATHER, 1.2), { cols: 6, rows: 10, kind: K.LEATHER }));
      }
    }
    if (!near) return;
    for (const s of [-1, 1]) {
      const at = leafAt(s);
      const up = at(0, 0, 1).sub(at(0, 0, 0)).normalize();
      const skin = () => tone(HAND, 1);
      const Z0 = -BOARD / 2, PAGE = BOARD / 2 + TH;
      // (a rounded end, over the last of a part's length)
      const cap = (t, a) => (t > a ? Math.sqrt(Math.max(0, 1 - ((t - a) / (1 - a)) ** 2)) : 1);
      // the palm, its heel out past the fore-edge and the knuckles under the
      // board: wider than it is thick, rounded at both ends
      parts.push(tube([at(LW + 0.58, 0.5, Z0 - 0.31), at(LW + 0.2, 0.43, Z0 - 0.2), at(LW - 0.14, 0.39, Z0 - 0.15), at(LW - 0.28, 0.38, Z0 - 0.15)],
        (t) => { const k = cap(t, 0.8) * cap(1 - t, 0.82); return [lerp(0.27, 0.41, smooth(t / 0.6)) * k, lerp(0.17, 0.12, t) * k]; },
        skin, { cols: 12, rows: 12, kind: K.SKIN, up }));
      // the fingers, side by side along the underside of the board, the middle
      // the longest, a little bent at the first joint and pressing up with
      // the tips, swelling at each joint; a little wider than they are thick
      for (const [dy, len, r] of [[-0.28, 0.78, 0.09], [-0.093, 0.86, 0.095], [0.093, 0.8, 0.091], [0.275, 0.63, 0.08]]) {
        const y0 = 0.39 + dy, x0 = LW - 0.2;
        const knuckles = (t) => 1 + 0.07 * Math.exp(-(((t - 0.4) / 0.06) ** 2)) + 0.05 * Math.exp(-(((t - 0.7) / 0.05) ** 2));
        parts.push(tube([at(x0 + 0.06, y0, Z0 - 0.16), at(x0 - len * 0.35, y0 + dy * 0.03, Z0 - r - 0.06), at(x0 - len * 0.7, y0 + dy * 0.06, Z0 - r - 0.015), at(x0 - len, y0 + dy * 0.08, Z0 - r * 0.9)],
          (t) => { const k = r * (1 - 0.18 * t) * knuckles(t) * cap(t, 0.86); return [k * 1.1, k * 0.9]; }, skin, { cols: 9, rows: 16, kind: K.SKIN, up }));
      }
      // the thumb, from the heel of the hand round the edge of the board and
      // the fore-edge of the leaves, onto the page
      parts.push(tube([at(LW + 0.3, 0.2, Z0 - 0.2), at(LW + 0.14, 0.02, Z0 + 0.02), at(LW + 0.03, -0.07, PAGE + 0.06), at(LW - 0.2, -0.1, PAGE + 0.09), at(LW - 0.4, -0.08, PAGE + 0.08)],
        (t) => lerp(0.135, 0.095, t) * cap(t, 0.86), skin, { cols: 9, rows: 18, kind: K.SKIN, up }));
    }
  };
  if (seated) {
    // open in the lap, tipped up toward the bowed head
    openBook(new THREE.Matrix4().makeTranslation(0, LAP + 2.35, 3.4)
      .multiply(new THREE.Matrix4().makeRotationX(-(Math.PI / 2 + 1.0)))
      .multiply(new THREE.Matrix4().makeRotationZ(R(-0.15, 0.15))));
  } else if (book) {
    // held at the chest, a forearm's length out, tipped toward the face
    openBook(new THREE.Matrix4().makeTranslation(0, 11.85 * tall, 3.2 + lean(11.85))
      .multiply(new THREE.Matrix4().makeRotationX(-(Math.PI / 2 + 0.75)))
      .multiply(new THREE.Matrix4().makeRotationZ(R(-0.1, 0.1))));
  }

  // ── The sleeves ─────────────────────────────────────────────────────────
  // Wide and hanging: fuller at the cuff than the shoulder, the underside
  // sagging, the cuff's mouth turned in and dark. Folded, each hand goes into
  // the other's cuff: one sleeve's end in the mouth of the other, the two
  // lying across the belt. (Brought down to meet in the middle, they made a
  // beak.) With a book, they come forward to the wrists.
  // (Slimmer over the arm than it first was — round and full the whole way
  // they read as bolsters — and the cloth of the cuff hanging well below the
  // wrist, as a wide sleeve's does.)
  for (const s of [-1, 1]) {
    let shoulder = [s * 1.72 * wide, 13.55 * tall, 0.05 + lean(13.55)];
    let elbow = book ? [s * 2.15 * wide, 11.2 * tall, 0.55 + lean(11.2)] : [s * 2.25 * wide, 11.2 * tall, 0.5 + lean(11.2)];
    // sitting, the forearms come down onto the thighs, the hands at the book
    if (seated) { shoulder = sit(shoulder); elbow = sit([s * 2.3 * wide, 10.9 * tall, 0.8 + lean(10.9)]); }
    let cuff, cuffR = 0.9, arm = [];
    if (wrists[s]) {
      const W = wrists[s], dir = W.clone().sub(new THREE.Vector3(...elbow)).normalize();
      // (the forearm straight into the cuff, so the wrist comes out of the
      // middle of its mouth and not through the side of it)
      arm = [W.clone().addScaledVector(dir, -1.1).toArray()];
      cuff = W.clone().addScaledVector(dir, -0.12).toArray();
      // the wrist, out of the dark of the cuff into the hand
      if (near) {
        // (rounded at both ends: open, its end showed past the heel of the hand
        // as a ring round a hole)
        const round = (t) => Math.sqrt(Math.max(0, 1 - (Math.max(0, 0.15 - t, t - 0.85) / 0.15) ** 2));
        parts.push(tube([W.clone().addScaledVector(dir, -0.6), W.clone().addScaledVector(dir, -0.15), W.clone().addScaledVector(dir, 0.22)],
          (t) => [0.25 * round(t), 0.19 * round(t)], () => tone(HAND, 0.9), { cols: 14, rows: 10, kind: K.SKIN }));
      }
    } else {
      // the right's end (s -1) the wider, and over the left's
      cuff = s < 0 ? [0.45 * wide, 11.05 * tall, 2.3 + lean(11.05)] : [-0.25 * wide, 10.95 * tall, 2.1 + lean(10.95)];
      cuffR = s < 0 ? 0.95 : 0.8;
    }
    // (the last few rings close the cuff's mouth: dark, where the hands are)
    const radius = (t) => lerp(0.56, cuffR, smooth((t - 0.45) / 0.55)) * (t > 0.96 ? Math.max(0, 1 - (t - 0.96) / 0.04) : 1);
    parts.push(tube([shoulder, elbow, ...arm, cuff], radius, (t, u) => {
      if (t > 0.965) return [...tone(base, 0.3), 1];
      const under = 0.5 + 0.5 * Math.sin(u);
      return tone(base, (0.55 + 0.45 * under) * (0.86 + 0.14 * Math.sin(4 * u + s + t * 6)));
    }, { cols: res(22), rows: res(28), sag: (t) => 0.75 * smooth((t - 0.4) / 0.6) ** 1.3 }));
  }

  // ── The cord ────────────────────────────────────────────────────────────
  // A rope at the waist, knotted at the side, its ends hanging: the longer
  // with three knots in it, the shorter with one.
  const beltY = BELT + 0.05;
  const loop = Array.from({ length: 49 }, (_, k) => {
    const u = (k / 48) * TAU;
    const d = depth(beltY) * fold(u, beltY) + 0.1;
    return [(rx(beltY) + d) * Math.cos(u) * wide, beltY * tall, lean(beltY) + (rz(beltY) + d) * Math.sin(u) * wide];
  });
  const hemp = (t, u) => tone(HEMP, 0.75 + 0.25 * Math.sin(u * 3 + t * 40));
  parts.push(tube(seated ? loop.map(sit) : loop, () => 0.12, hemp, { cols: 8, rows: res(60), kind: K.HEMP }));
  const knot = [-0.55 * wide, beltY * tall, lean(beltY) + (rz(beltY) + 0.2) * wide];
  // (sitting, the ends lie in the lap and are lost in it; far off, too fine to see)
  for (const [dx, len, knots] of seated || !near ? [] : [[-0.12, 3.4, [0.42, 0.66, 0.9]], [0.2, 2.3, [0.88]]]) {
    const pts = [0, 0.5, 1].map((t) => {
      const y = knot[1] - len * t;
      return [knot[0] + dx * t, y, lean(y / tall) + (rz(y / tall) + depth(y / tall) * 0.6 + 0.22) * wide];
    });
    // (each knot a swelling, and the end closed)
    parts.push(tube(pts, (t) => (0.1 + knots.reduce((a, k) => a + 0.09 * Math.exp(-(((t - k) / 0.035) ** 2)), 0)) * (t > 0.995 ? 0 : 1),
      hemp, { cols: 8, rows: 34, kind: K.HEMP }));
  }

  // ── The feet ────────────────────────────────────────────────────────────
  // Shoes of dark leather under the hem, worn paler at the toe, with the hose
  // going up into the robe above them. Walking, they step (clothShader);
  // standing, the hem hides them; sitting, the toes show past it.
  if (near) {
    const L0 = -0.85, L1 = 1.85;
    const sw = profile([[L0, 0], [L0 + 0.1, 0.3], [-0.45, 0.4], [0.4, 0.45], [1.05, 0.49], [1.5, 0.4], [1.75, 0.24], [L1, 0]]);
    const sh = profile([[L0, 0], [L0 + 0.1, 0.55], [-0.45, 0.92], [0.05, 0.95], [0.6, 0.72], [1.1, 0.52], [1.5, 0.42], [1.75, 0.28], [L1, 0]]);
    for (const s of [-1, 1]) {
      const kind = K.SHOE + (s < 0 ? 0 : 1);
      const ax = s * (seated ? 0.95 : FOOT_X) * wide, az = seated ? THIGH + BEND + 1.1 : FOOT_Z0;
      parts.push(faceOut(sheet(18, 14, (v, u) => {
        const z = lerp(L0, L1, v), w = Math.max(0, sw(z)), h = Math.max(0, sh(z)), c = Math.min(0.1, 0.35 * h), su = Math.sin(u);
        const y = su >= 0 ? c + (h - c) * su ** 0.8 : c * (1 - (-su) ** 0.35);
        return [ax + w * Math.cos(u), y, az + z];
      }, (v, u) => {
        const z = lerp(L0, L1, v), su = Math.sin(u);
        return tone(SHOE, (su < -0.5 ? 0.5 : 1) * (1 + 0.45 * smooth((z - 1.1) / 0.6) * Math.max(0, su)) * grain());
      }, kind), (p) => new THREE.Vector3(ax, 0.3, p.z)));
      parts.push(tube([[ax, 0.6, az - 0.15], [ax, 2.0, az - 0.25], [ax, 3.4, az - 0.3]], (t) => 0.34 + 0.06 * t, () => tone(base, 0.55), { cols: 10, rows: 6, kind: kind + 0.5 }));
    }
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

// ── How they are shaded ───────────────────────────────────────────────────────
// One MeshStandardMaterial (matt, both sides: finale.js says why) with this put
// into it, for every reader (walkers.js, finale.js). `u` brings uStride (how
// far through their steps they are, in half-turns a step), uMove (0 standing
// … 1 walking) and uReach (half a stride: how far ahead of and behind the
// body a foot goes, so that a foot on the ground stays where it was put).
//
// Walking, the robe moves with the legs under it: the hem swung a little at
// every step, the knee of the leg that is stepping pushing the cloth out in
// front of it, and the hem kept ahead of the foot out in front and behind
// the one left behind. The feet step: each on the ground for half the time,
// carried back under the body as it goes on, the heel coming up at the end
// of it; then lifted and swung through to land again, toe up, ahead.
//
// The wool is not one smooth clay: it is uneven (slowly, and drawn out down
// the robe where it hangs), and it has a nap, which the light rakes across
// close to and which is let go of where it would be finer than a pixel. And
// its fuzz catches the light where the cloth turns away from the eye, as wool
// does at its edges. (A sheen added flat was tried in 2026-09 and lit the
// black inside of the hood as a pale bald head, and turned the robes to suede:
// here it is the cloth's own light, and the hollows no light reaches — aDark —
// stay dark, sheen and all.) Leather takes a soft highlight, and a grain.
const f3 = (x) => x.toFixed(3);
const PAGE_BOUNCE = 0.2;   // how much of the page's light reaches the face (more than a page would give)
export const clothShader = (sh, u) => {
  Object.assign(sh.uniforms, u);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
      uniform float uStride;
      uniform float uMove;
      uniform float uReach;
      attribute float aDark;
      attribute float aKind;
      varying float vDark;
      varying float vKind;
      varying vec3 vCloth;
      // Where a foot is in its step: how far ahead of where it stands, how
      // high it is lifted, and how far its heel is raised (+) or its toe (-).
      // Side -1 is the right foot; it strikes the ground furthest forward
      // when sin(uStride) * side = 1, as the knee in front does (below).
      vec3 readerStep(float side) {
        float ph = mod(uStride - side * 1.5707963, 6.2831853) / 3.1415927;
        vec3 s;
        if (ph < 1.0) {
          s = vec3(1.0 - 2.0 * ph, 0.0, 0.45 * smoothstep(0.55, 1.0, ph) - 0.12 * (1.0 - smoothstep(0.0, 0.2, ph)));
        } else {
          // (swung through on a curve that leaves the ground and meets it again
          // at the pace of the ground going by, so the foot never jerks)
          float t = ph - 1.0;
          s = vec3(((-8.0 * t + 12.0) * t - 2.0) * t - 1.0, pow(max(0.0, sin(3.1415927 * t)), 1.5),
            0.45 * (1.0 - smoothstep(0.0, 0.55, t)) - 0.12 * smoothstep(0.6, 1.0, t));
        }
        return s * vec3(uReach, ${f3(FOOT_LIFT)}, 1.0) * uMove;
      }
      vec2 readerTurn(vec2 zy, float a) { float c = cos(a), s = sin(a); return vec2(zy.x * c + zy.y * s, zy.y * c - zy.x * s); }`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      float rFoot = step(5.75, aKind);
      vec3 rStep = rFoot > 0.5 ? readerStep(aKind < 6.75 ? -1.0 : 1.0) : vec3(0.0);
      // heel up, the shoe bends at the ball of the foot and the toe stays
      // down; toe up, the whole of it turns about the heel
      float rPivot = rStep.z > 0.0 ? ${f3(FOOT_BALL)} : ${f3(FOOT_HEEL)};
      float rA = rStep.z * (rStep.z > 0.0 ? 1.0 - smoothstep(${f3(FOOT_BALL - 0.35)}, ${f3(FOOT_BALL + 0.15)}, position.z - ${f3(FOOT_Z0)}) : 1.0);
      objectNormal.zy = readerTurn(objectNormal.zy, rA);`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vDark = aDark;
      vKind = aKind;
      vCloth = position;
      if (rFoot > 0.5) {
        vec3 rP = vec3(0.0, 0.0, ${f3(FOOT_Z0)} + rPivot);
        vec3 rQ = transformed - rP;
        rQ.zy = readerTurn(rQ.zy, rA);
        // (and kept on the ground while the body rises and falls over it)
        float rS = sin(uStride);
        transformed = rP + rQ + vec3(0.0, rStep.y - (rS * rS - 0.5) * 0.3 * uMove, rStep.x);
      } else {
        float rLow = clamp(1.0 - position.y / 11.0, 0.0, 1.0);
        float rX = position.x >= 0.0 ? 1.0 : -1.0;
        float rKnee = (position.y - 5.0) / 2.2;
        transformed.z += uMove * (abs(sin(uStride)) * rLow * rLow * 0.25
          + max(0.0, sin(uStride) * rX) * exp(-rKnee * rKnee) * 0.35 * smoothstep(-0.5, 1.5, position.z));
        transformed.x += uMove * sin(uStride) * rLow * rLow * 0.14;
        float rHem = pow(clamp(1.0 - position.y / 8.0, 0.0, 1.0), 1.5);
        for (int i = 0; i < 2; i++) {
          float side = i == 0 ? -1.0 : 1.0;
          float az = ${f3(FOOT_Z0)} + readerStep(side).x;
          float dx = (position.x - side * ${f3(FOOT_X)}) / 1.5;
          float wx = rHem * exp(-dx * dx);
          transformed.z += wx * (max(0.0, az - 1.8) * smoothstep(-0.5, 2.0, position.z)
            - max(0.0, -1.8 - az) * (1.0 - smoothstep(-2.0, 0.5, position.z)));
        }
      }`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform mat3 normalMatrix;
      varying float vDark;
      varying float vKind;
      varying vec3 vCloth;
      float clothHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      // value noise and its gradient (quintic, so no seam shows in the light
      // along the lattice)
      vec4 clothNoise(vec3 x) {
        vec3 i = floor(x), f = fract(x);
        vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        vec3 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
        float a = clothHash(i), b = clothHash(i + vec3(1.0, 0.0, 0.0)), c = clothHash(i + vec3(0.0, 1.0, 0.0)), d = clothHash(i + vec3(1.0, 1.0, 0.0));
        float e = clothHash(i + vec3(0.0, 0.0, 1.0)), g = clothHash(i + vec3(1.0, 0.0, 1.0)), h = clothHash(i + vec3(0.0, 1.0, 1.0)), k = clothHash(i + vec3(1.0, 1.0, 1.0));
        float k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d, k5 = a - c - e + h, k6 = a - b - e + g, k7 = -a + b + c - d + e - g - h + k;
        return vec4(a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
          du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
      }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        float cK = vKind;
        bool cHose = cK > 5.75 && fract(cK) > 0.25;
        bool cWool = cK < 1.5 || cHose;
        bool cLeather = (cK > 2.5 && cK < 3.5) || (cK > 5.75 && !cHose);
        // (how much cloth a pixel covers here: detail finer than that is let go)
        float cFw = length(fwidth(vCloth));
        vec3 cG = vec3(0.0);
        if (cWool) {
          vec3 sc = cK < 0.5 ? vec3(1.0, 0.3, 1.0) : vec3(1.0);
          vec4 n = clothNoise(vCloth * sc * 0.9);
          cG += 0.144 * sc * n.yzw;
          n = clothNoise(vCloth * sc * 2.6 + 7.1);
          cG += 0.13 * sc * n.yzw * (1.0 - smoothstep(0.3, 0.8, cFw * 2.6));
          vec3 sn = vec3(9.0, 4.0, 9.0);
          n = clothNoise(vCloth * sn + 3.7);
          cG += 0.012 * sn * n.yzw * (1.0 - smoothstep(0.25, 0.6, cFw * 9.0));
          roughnessFactor = 0.95;
        } else if (cLeather) {
          vec4 n = clothNoise(vCloth * 14.0);
          cG += 0.084 * n.yzw * (1.0 - smoothstep(0.25, 0.6, cFw * 14.0));
          roughnessFactor = 0.5 + 0.25 * clothNoise(vCloth * 3.0).x;
        } else if (cK > 4.5) {
          roughnessFactor = 0.7;
        } else if (cK > 3.5) {
          roughnessFactor = 0.8;
        } else {
          roughnessFactor = 0.9;
        }
        vec3 cGv = normalMatrix * cG;
        normal = normalize(normal - (cGv - dot(cGv, normal) * normal));
      }`)
    .replace('#include <opaque_fragment>', `if (vKind < 1.5 || (vKind > 5.75 && fract(vKind) > 0.25)) {
        vec3 cIrr = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb, vec3(0.003));
        float cNV = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        vec3 cTint = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.5) * 2.0 + 0.012;
        outgoingLight += cIrr * cTint * (0.9 * pow(1.0 - cNV, 4.0) + 0.04);
      }
      // the hollows no light reaches (aDark), and the inside of the cloth —
      // the back of the hood seen past the face, up a sleeve, under a hem —
      // which every part is wound to show as its back (faceOut, tube)
      outgoingLight *= 1.0 - 0.97 * max(vDark, vKind < 1.5 && !gl_FrontFacing ? 0.9 : 0.0);
      // A face over an open book, lit from below by the page: the lamps'
      // light on something facing up, a little of it thrown back onto the
      // chin, the mouth, the underside of the nose (where the hood's dark is
      // least), and none where no lamp is near. (Without it, under lamps
      // hung overhead, the hood was a black hole again.)
      #if NUM_POINT_LIGHTS > 0
      if (vKind > 5.1 && vKind < 5.5) {
        vec3 cUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vec3 cPage = vec3(0.0);
        for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
          vec3 cL = pointLights[i].position + vViewPosition;
          float cD = length(cL);
          cPage += pointLights[i].color * getDistanceAttenuation(cD, pointLights[i].distance, pointLights[i].decay) * max(dot(cL / cD, cUp), 0.0);
        }
        float cFaces = 0.35 + 0.65 * max(0.0, -dot(normal, cUp));
        outgoingLight += diffuseColor.rgb * cPage * ${f3(PAGE_BOUNCE)} * cFaces * clamp((0.97 - vDark) / 0.13, 0.0, 1.0);
      }
      #endif
      #include <opaque_fragment>`);
};
