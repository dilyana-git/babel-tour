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
import { HOOD, FACE } from './finaleLook';

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
// (FRAY: wool too — the threads at a hood's hem, `close`.)
const K = { ROBE: 0, WOOL: 1, FRAY: 1.2, HEMP: 2, LEATHER: 3, PAPER: 4, SKIN: 5, FACE: 5.25, SHOE: 6 };
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
// `close`: one the reader will stand face to face with (the others at the
// heart of the maze: finaleLook.js) — the cowl and the mantle in deeper
// folds that run to the hem, the hem thin, turned in and frayed, the inside
// of the hood the wool's own colour going into the dark.
export function readerGeometry({ seed = 1, color = ROBES[0], book = false, seated = false, detail = 1, close = false, plain = false, hollow = false, nod = 0, heavyWool = false } = {}) {
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
  const bow = seated ? R(0.3, 0.42) : book ? R(0.2, 0.3) : nod;
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
    if (heavyWool) {
      // Four broad folds continue from the shoulders to the hem.
      const f = Math.sin(4 * u + waves[0].ph + 0.09 * Math.sin(y * 0.3));
      return f > 0 ? f ** 0.65 : -((-f) ** 1.3);
    }
    let s = 0;
    for (const w of waves) s += w.a * Math.sin(w.k * u + w.ph + 0.35 * Math.sin(y * w.drift + w.ph));
    const f = Math.max(-1, Math.min(1, s / norm));
    return f > 0 ? f ** 0.7 : -((-f) ** 1.5);
  };
  // how deep the folds hang: deepest at the hem, gathered at the belt, a
  // little over the chest
  const depth = (y) => heavyWool ? 0.22 + 0.48 * (1 - smooth(y / TOP)) : (y < BELT
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
    if (heavyWool) c.multiplyScalar(1 - 0.42 * clamp01(1 - y / 2.8));
    // (`close`: the robe's neck, up inside the collar, in the collar's dark —
    // lit, its edge showed either side of the chin as two white ticks)
    return close ? [...c.toArray(), 0.92 * smooth((y - 14.2) / 0.6)] : c.toArray();
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
  // (`close`: the cape's folds deeper, and the cloth gathered where it is
  // drawn in round the neck)
  const gather = (u, t) => (close ? 0.05 * Math.sin(13 * u + mPh) * smooth((t - 0.3) / 0.5) : 0);
  const mDeep = heavyWool ? 2.2 : close ? 1 + 0.25 * HOOD.fold : 1;
  const mantle = faceOut(sheet(18, res(close ? 128 : 64), (v, u, i) => {
    // the first ring is the hem turned under, so the cape has an edge to it
    const t = i === 0 ? 0 : (i - 1) / 16;
    const y = lerp(mHem(u), 15.3, t) - scoop(u, t) + (i === 0 ? 0.08 : 0);
    const d = (0.07 + 0.17 * (1 - t) ** 1.5) * mFold(u) * mDeep + gather(u, t) - (i === 0 ? 0.16 : 0);
    return [(mx(t) + d) * Math.cos(u) * wide, y * tall, lean(y) + (mz(t) + d) * Math.sin(u) * wide];
  }, (v, u, i) => {
    const t = i === 0 ? 0 : (i - 1) / 16;
    const k = (i === 0 ? 0.6 : 1) * (0.72 + 0.28 * (0.5 + 0.5 * mFold(u))) * (1 - 0.2 * smooth((t - 0.8) / 0.2)) * (1 + 3.2 * gather(u, t));
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
  // (`close`, finaleLook.js: turned in so far and so soon, the inside of the
  // edge was a band of its own round the opening, facing the eye and lit —
  // a tyre. Close, the hem is a thread's width and the dark begins behind it.)
  const rings = [
    ...(close
      ? HOOD.hem.slice().reverse().map(([v, sc, k]) => ({ v, s: sc, dark: true, k }))
      : [0.55, 0.4, 0.26, 0.14, 0.05].map((v) => ({ v, s: 0.8 + 0.12 * (1 - v / 0.55), dark: true }))),
    close ? { v: 0, s: 1, back: -0.03, rim: true } : { v: 0, s: 1.025, back: -0.07, rim: true },
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
  // (`close`: deeper, with one slow sag across the whole cowl, and not let go
  // of at the edge — the hem hangs in the folds the cloth behind it does, and
  // its inside with it)
  const drape = (u, v) => HOOD.fold * (0.07 * Math.sin(5 * u + hPh + 2 * v) + 0.06 * Math.max(0, 0.2 - Math.sin(u)) * Math.sin(9 * u + hPh2 + 4 * v)
    + 0.03 * Math.sin(2 * u + hPh2)) * (1 - v) ** 0.7 * (0.4 + 0.6 * smooth(v / 0.12));
  const hoodAt = (r, u) => {
    const v = Math.min(1, r.v);
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
    const crest = (r.dark && !close ? 0.08 : lerp(0.12, 0.28, smooth(v / 0.3))) * (1 - smooth((v - 0.7) / 0.3));
    let cx = Math.sign(cu) * Math.abs(cu) ** 0.82;
    const cy = su > 0 ? (1 - crest) * su + crest * (1 - Math.abs(cu)) : su;
    // narrowing to the throat, where its two edges cross
    if (su < 0) cx *= 1 - 0.3 * (-su) ** 1.6 * edge;
    const f = close ? drape(u, v) : r.dark || r.rim ? 0 : hoodFold(u, v);
    const w = hw(v) * r.s + f, h = (su > 0 ? hu(v) : hd(v)) * r.s + f;
    c.addScaledVector(X, w * cx * wide).addScaledVector(Y, h * cy);
    return [c.x, c.y * tall, c.z];
  };
  const hood = faceOut(sheet(rings.length, res(close ? 88 : 44), (_, u, i) => hoodAt(rings[i], u), (_, u, i) => {
    const r = rings[i];
    // the inside going into the dark, a little of the rim's light caught
    // just inside its lower edge
    if (r.dark) {
      return close ? [...tone(base, HOOD.lining * grain()), r.k]
        : [...tone(base, 0.25), smooth(r.v / 0.3) * 0.85 + 0.15 - 0.2 * (1 - r.v / 0.55) * Math.max(0, -Math.sin(u))];
    }
    // (`close`: and under the chin, where the two edges come down onto the
    // chest and cross, the hood's own shadow — thin, the edge there caught
    // the sky along its length and stood out of the dark as two pale tusks)
    // (in its colour, and only a little as a hollow, aDark: the light in the
    // hood is for the hood's hollows, and found the tusks again)
    const under = close ? smooth((-Math.sin(u) - 0.3) / 0.3) * (1 - smooth(r.v / 0.3)) : 0;
    // (the rim no paler than the hood: lit from behind, a paler roll read as a halo)
    if (r.rim) return close ? [...tone(base, 0.95 * (1 - 0.4 * under)), 0.3 * under] : tone(base, 0.95);
    if (close) return [...tone(base, (0.84 + 0.16 * Math.max(0, Math.sin(u))) * (1 + 0.9 * drape(u, r.v)) * grain() * (1 - 0.4 * under)), 0.3 * under];
    return tone(base, (0.84 + 0.16 * Math.max(0, Math.sin(u))) * (1 + 1.6 * hoodFold(u, r.v)) * grain());
    // (asked from the middle of the head: asked level with each point, the
    // cowl's underside voted it inside out and the hood vanished but its rim)
  }), () => new THREE.Vector3(H.x, H.y * tall, H.z));
  if (bow) remap(hood, bowed);
  // The hem's threads, `close`: a strip on from the edge the way the cloth
  // was going, longer in some places than others; clothShader cuts it into
  // threads, each of its own length (the strip's kind runs from K.FRAY at
  // the edge to K.FRAY + 0.2 at the threads' ends, which is how it is told
  // how far along one a point is).
  let fray = null;
  if (close) {
    const rim = rings.find((r) => r.rim), behind = { v: 1 / 16, s: 1 };
    const fPh = R(0, TAU), n = res(176);
    fray = sheet(2, n, (_, u, i) => {
      const a = new THREE.Vector3(...hoodAt(rim, u));
      if (i === 0) return a.toArray();
      const on = a.clone().sub(new THREE.Vector3(...hoodAt(behind, u))).normalize();
      // (none under the chin, where the two edges cross on the chest)
      const len = lerp(HOOD.fray[0], HOOD.fray[1], 0.5 + 0.5 * Math.sin(7 * u + fPh) * Math.sin(17 * u + 2 * fPh)) * smooth((Math.sin(u) + 0.55) / 0.4);
      return a.addScaledVector(on, len).toArray();
    }, () => tone(base, 0.82));
    fray.getAttribute('aKind').array.forEach((_, k, kinds) => { kinds[k] = K.FRAY + (k < n ? 0 : 0.2); });
    fray.computeVertexNormals();
    if (bow) remap(fray, bowed);
  }

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
  // (a face that will be seen close: FACE; `plain`: the head as it was before that)
  const carved = close && FACE.on && !plain;
  const noseCut = profile([[-0.42, 0], [-0.36, 0.03], [-0.31, 0.3], [-0.24, 0.43], [-0.15, 0.36], [0.0, 0.25], [0.14, 0.17], [0.27, 0.1], [0.38, 0.03], [0.46, 0]]);
  const head = (v, u) => {
    const th = (u - 0.5) * 3.9, ph = (v - 0.5) * 3.05;
    const x = Math.sin(th) * Math.cos(ph), y = Math.sin(ph), z = Math.cos(th) * Math.cos(ph);
    const front = smooth((z - 0.25) / 0.55);
    let X = x * 0.74, Z = z * 0.92;
    if (y < 0) X *= 1 - 0.3 * smooth(-y / 0.95) ** 1.3 * (0.4 + 0.6 * front);
    Z -= 0.1 * front * (1 - y * y);   // the face flatter than the skull
    if (carved) {
      // (finaleLook.js, FACE) Carved: the brow a ridge over each socket and
      // the sockets deep under it; the nose standing well out of the face, its
      // bridge narrow, its tip round, a wing either side, and cut under
      // sharply; the cheekbones; the fold from each wing down past the mouth;
      // the upper lip, the line between the lips, the lower lip full, the
      // groove under it; the chin a knob, and the jaw drawn in to it.
      const pair = (cx, cy, sx, sy) => gauss(x, y, -cx, cy, sx, sy) + gauss(x, y, cx, cy, sx, sy);
      X *= 1 - 0.1 * smooth((-y - 0.35) / 0.6) * front;
      Z += front * (0.11 * pair(0.3, 0.34, 0.3, 0.085) + 0.05 * gauss(x, y, 0, 0.3, 0.14, 0.1)
        - 0.2 * pair(0.36, 0.14, 0.2, 0.11)
        + noseCut(y) * Math.exp(-((x / lerp(0.17, 0.085, smooth((y + 0.22) / 0.4))) ** 2))
        + 0.1 * pair(0.17, -0.28, 0.075, 0.065)
        + 0.09 * pair(0.5, -0.02, 0.22, 0.14)
        - 0.045 * pair(0.31, -0.42, 0.09, 0.15)
        // (the mouth no wider than a mouth: across the whole face its lines
        // were stripes)
        + 0.075 * gauss(x, y, 0, -0.455, 0.17, 0.055)
        - 0.06 * gauss(x, y, 0, -0.535, 0.19, 0.03)
        + 0.085 * gauss(x, y, 0, -0.61, 0.14, 0.05)
        - 0.045 * gauss(x, y, 0, -0.71, 0.15, 0.05)
        + 0.15 * gauss(x, y, 0, -0.85, 0.2, 0.11));
    } else {
      Z += front * (0.09 * gauss(x, y, 0, 0.34, 0.55, 0.09)
        - 0.15 * (gauss(x, y, -0.34, 0.15, 0.17, 0.12) + gauss(x, y, 0.34, 0.15, 0.17, 0.12))
        + nose(y) * Math.exp(-((x / lerp(0.2, 0.12, smooth((y + 0.2) / 0.5))) ** 2))
        + 0.07 * (gauss(x, y, -0.46, -0.08, 0.2, 0.15) + gauss(x, y, 0.46, -0.08, 0.2, 0.15))
        - 0.04 * gauss(x, y, 0, -0.5, 0.24, 0.05)
        + 0.1 * gauss(x, y, 0, -0.78, 0.24, 0.13));
    }
    return { p: [X * wide, y * 1.12 * tall, Z], x, y, front };
  };
  const face = faceOut(sheet(carved ? FACE.rows : res(26), carved ? FACE.cols : res(34), (v, u) => head(v, u).p, (v, u) => {
    const { x, y, front } = head(v, u);
    // (Given back in patches — the nose, each cheek, the chin — the two
    // cheeks lit in the black of the hood read as eyes. So the face comes out
    // of the dark evenly from the brow down, the nose a little the most.)
    const lit = front * (smooth((0.1 - y) / 0.9) + 0.4 * gauss(x, y, 0, -0.2, 0.16, 0.14));
    const socket = gauss(x, y, -0.34, 0.15, 0.2, 0.14) + gauss(x, y, 0.34, 0.15, 0.2, 0.14);
    const c = tone(SKIN, (1 - 0.35 * socket) * (0.95 + 0.1 * rng()));
    c[0] *= 1 + 0.15 * gauss(x, y, 0, -0.52, 0.2, 0.06);
    // (`close`: and from the brow up wholly in the hood's dark — the crown
    // caught the sky and drew a pale arc over the face, the top of an egg)
    return [...c, Math.max(Math.min(0.985, 0.96 - 0.13 * Math.min(1, lit) + 0.02 * socket), close ? smooth((y - 0.05) / 0.4) : 0)];
    // (over an open book, the page throws the lamps' light back up into the
    // hood: K.FACE, clothShader)
  }, book || seated ? K.FACE : K.SKIN, false), () => new THREE.Vector3(0, 0, 0));
  face.translate(H.x, (H.y + 0.12) * tall, H.z - 0.12);
  if (bow) remap(face, bowed);

  // (`hollow`: nobody in it — the hood, and the dark it holds: finaleLook.js, HOODED)
  const parts = hollow ? [robe, mantle, hood] : [robe, mantle, hood, face];
  if (hollow) face.dispose();
  if (fray) parts.push(fray);

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
    // Open across the lap, slightly tipped toward the bowed head so light
    // arriving from beside the reader can reach both pages.
    openBook(new THREE.Matrix4().makeTranslation(0, LAP + 2.35, 3.4)
      .multiply(new THREE.Matrix4().makeRotationX(-(Math.PI / 2 + 0.12)))
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
  // where the open book's pages are, for the light they throw (clothShader's uBook)
  if (book || seated) merged.userData.book = seated ? [0, LAP + 2.6, 3.4] : [0, 11.85 * tall + 0.3, 3.2 + lean(11.85)];
  // where the light in the hood is (clothShader's uHood): under the chin and before it
  const lamp = [H.x + HOOD.lamp.at[0], (H.y + 0.12) * tall + HOOD.lamp.at[1], H.z - 0.12 + HOOD.lamp.at[2]];
  merged.userData.hood = bow ? bowed(lamp) : seated ? sit(lamp) : lamp;
  // the face's middle and how far the head is bowed (readerNear.js: the
  // hood's shadow on it)
  const mid = [H.x, (H.y + 0.12) * tall, H.z - 0.12];
  merged.userData.face = [...(bow ? bowed(mid) : seated ? sit(mid) : mid), bow];
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
// x the wool's edge against a lamp behind, y the light wrapped onto the dark
// side, z the pages' light under the hood (one for every reader; DEV:
// window.__readerLit)
export const READER_LIT = { value: new THREE.Vector3(6.5, 2.2, 2.5) };
export const clothShader = (sh, u) => {
  if (!u.uBook) u.uBook = { value: new THREE.Vector4() };
  // `uGlow`: a lit floor at a reader's feet — where, and how strongly its
  // light comes back up (the Silence's seated reader over the lamp's pool;
  // 0 for everyone else)
  if (!u.uGlow) u.uGlow = { value: new THREE.Vector4() };
  // `uSheen`: how much of the wool's fuzz and its lit edge a reader shows (1
  // for everyone but the Silence's, near its lamp and turned half from it,
  // where both together made the robe's shoulder pale plaster)
  if (!u.uSheen) u.uSheen = { value: 1 };
  // `uWool`: the cloth seen close (finaleLook.js; all 0 for everyone else) —
  // x how many ribs of its weave to a unit, y how deep they are, z how uneven
  // its dye, w how much of the smooth shine every surface has is taken off it.
  // `uHood`: a light inside the hood, where (in the reader's own frame) and
  // how strong; `uHoodTint`: its colour, and the distance it halves over.
  if (!u.uWool) u.uWool = { value: new THREE.Vector4() };
  if (!u.uHood) u.uHood = { value: new THREE.Vector4() };
  if (!u.uHoodTint) u.uHoodTint = { value: new THREE.Vector4(1, 0.7, 0.4, 2.4) };
  // `uPlain`: 1 for a head left `plain`, lit as it was before FACE.
  if (!u.uPlain) u.uPlain = { value: 0 };
  // `uLitK`: how much more of uLit's three lights this reader takes than
  // everyone does. `uArch`: a lit opening behind the reader, as a light — a
  // broad one, where it is in the world and how strong; `uArchTint`: its
  // colour, and the distance it halves over (the file on the bridge, against
  // the arch to the Echo: libraryProps.js; 0 for everyone else).
  if (!u.uLitK) u.uLitK = { value: new THREE.Vector3(1, 1, 1) };
  if (!u.uArch) u.uArch = { value: new THREE.Vector4() };
  if (!u.uArchTint) u.uArchTint = { value: new THREE.Vector4(1, 0.8, 0.54, 150) };
  // `uPage`: the open page as a light of its own (the one who is the reader,
  // at the heart of the maze: finaleLook.js; 0 for everyone else) — x how
  // bright the paper is itself, y how much it throws on what faces it beside
  // what the lamps overhead give it to throw, z how much of that light the
  // face takes (as a light on a form, not the wash the cloth has).
  if (!u.uPage) u.uPage = { value: new THREE.Vector3() };
  Object.assign(sh.uniforms, u);
  sh.uniforms.uLit = READER_LIT;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
      uniform float uStride;
      uniform float uMove;
      uniform float uReach;
      uniform vec4 uBook;
      varying vec3 vBookV;
      uniform vec4 uGlow;
      varying vec3 vGlowV;
      uniform vec4 uHood;
      varying vec3 vHoodV;
      uniform vec4 uArch;
      varying vec3 vArchV;
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
      vBookV = (modelViewMatrix * vec4(uBook.xyz, 1.0)).xyz;
      vGlowV = (viewMatrix * vec4(uGlow.xyz, 1.0)).xyz;
      vHoodV = (modelViewMatrix * vec4(uHood.xyz, 1.0)).xyz;
      vArchV = (viewMatrix * vec4(uArch.xyz, 1.0)).xyz;
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
      uniform vec3 uLit;
      uniform vec4 uBook;
      varying vec3 vBookV;
      uniform vec4 uGlow;
      varying vec3 vGlowV;
      uniform float uSheen;
      uniform vec4 uWool;
      uniform vec4 uHood;
      uniform vec4 uHoodTint;
      uniform float uPlain;
      varying vec3 vHoodV;
      uniform vec3 uLitK;
      uniform vec4 uArch;
      uniform vec4 uArchTint;
      varying vec3 vArchV;
      uniform vec3 uPage;
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
    .replace('#include <color_fragment>', `#include <color_fragment>
      // The hem's threads (K.FRAY): the strip cut along its length into
      // threads, each ending where it will; and none of it from further off
      // than a thread can be told from the next.
      if (vKind > 1.15 && vKind < 1.45) {
        float fT = clamp((vKind - 1.2) / 0.2, 0.0, 1.0);
        float fW = length(fwidth(vCloth)) * ${f3(HOOD.threads)};
        vec2 fC = floor(vCloth.xy * ${f3(HOOD.threads)});
        float fH = fract(sin(dot(fC, vec2(127.1, 311.7))) * 43758.5453);
        if (fW > 0.8 || fH * fH < fT - 0.04) discard;
      }
      // Wool seen close: woven, a twill's ribs across it, and its dye uneven
      // — flecked, and in slow patches.
      if (uWool.x > 0.0 && vKind < 1.5) {
        float wFw = length(fwidth(vCloth));
        float wRib = sin(dot(vCloth, vec3(0.64, 0.64, 0.43)) * uWool.x * 6.2831853) * (1.0 - smoothstep(0.2, 0.5, wFw * uWool.x));
        float wFleck = clothNoise(vCloth * 12.0 + 5.0).x * 0.55 + clothNoise(vCloth * 43.0).x * 0.45 * (1.0 - smoothstep(0.25, 0.6, wFw * 43.0));
        float wPatch = clothNoise(vCloth * vec3(1.7, 0.8, 1.7) + 9.0).x;
        diffuseColor.rgb *= max(0.0, 1.0 + uWool.z * (2.0 * (wFleck - 0.5) + 1.2 * (wPatch - 0.5)) + 0.07 * uWool.y * wRib);
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
          if (uWool.x > 0.0) {
            // the ribs of the weave, the threads across them, and the nap
            float wF = uWool.x * 6.2831853, wOn = 1.0 - smoothstep(0.2, 0.5, cFw * uWool.x);
            vec3 wA = vec3(0.64, 0.64, 0.43), wB = vec3(-0.69, 0.69, 0.22);
            cG += (wA * cos(dot(vCloth, wA) * wF) * 0.34 + wB * cos(dot(vCloth, wB) * wF * 1.6) * 0.2) * uWool.y * wOn;
            n = clothNoise(vCloth * 38.0 + 1.3);
            cG += 0.36 * n.yzw * (1.0 - smoothstep(0.25, 0.6, cFw * 38.0));
          }
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
        outgoingLight += cIrr * cTint * (0.9 * pow(1.0 - cNV, 4.0) + 0.04) * uSheen;
        // (close, matt: what shine the surface has of its own, a smooth
        // thing's, taken off it — the fuzz above is the wool's)
        outgoingLight -= (reflectedLight.directSpecular + reflectedLight.indirectSpecular) * uWool.w;
      }
      // the hollows no light reaches (aDark), and the inside of the cloth —
      // the back of the hood seen past the face, up a sleeve, under a hem —
      // which every part is wound to show as its back (faceOut, tube)
      // (not the hem's threads, K.FRAY: they have no inside)
      outgoingLight *= 1.0 - 0.97 * max(vDark, vKind < 1.15 && !gl_FrontFacing ? 0.9 : 0.0);
      // (the page that is a light, uPage: the paper itself)
      if (uPage.x > 0.0 && vKind > 3.5 && vKind < 4.5) outgoingLight += diffuseColor.rgb * vec3(1.0, 0.84, 0.6) * uPage.x;
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
      ${`#if NUM_POINT_LIGHTS > 0
      {
        vec3 cV = normalize(vViewPosition);
        float cNV2 = clamp(dot(normal, cV), 0.0, 1.0);
        float cOpen = 1.0 - vDark;
        bool cCloth = vKind < 2.5;
        vec3 cUp2 = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vec3 cRim = vec3(0.0), cWrap = vec3(0.0), cOnPage = vec3(0.0);
        vec3 cLit = uLit * uLitK;
        for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
          vec3 cL = pointLights[i].position + vViewPosition;
          float cD = length(cL);
          vec3 cLd = cL / cD;
          vec3 cE = pointLights[i].color * getDistanceAttenuation(cD, pointLights[i].distance, pointLights[i].decay);
          // the edge turned toward a lamp, most of all a lamp behind the reader
          float cBack = 0.3 + 0.7 * max(0.0, -dot(cV, cLd));
          cRim += cE * pow(1.0 - cNV2, 3.0) * max(dot(normal, cLd), 0.0) * cBack;
          float cW = dot(normal, cLd) * 0.5 + 0.5;
          cWrap += cE * cW * cW;
          if (uBook.w > 0.5) {
            vec3 cB = pointLights[i].position - vBookV;
            float cBd = length(cB);
            cOnPage += pointLights[i].color * getDistanceAttenuation(cBd, pointLights[i].distance, pointLights[i].decay) * max(dot(cB / cBd, cUp2), 0.0);
          }
        }
        cOnPage += vec3(uPage.y);
        if (cCloth) {
          outgoingLight += cRim * (diffuseColor.rgb * 2.5 + vec3(0.012, 0.008, 0.004)) * cLit.x * cOpen * uSheen;
          outgoingLight += cWrap * diffuseColor.rgb * cLit.y * cOpen;
        }
        // The page as a lamp of its own, low and warm: on whatever of the
        // reader faces it within a forearm or two, the inside of the hood too
        // (its dark, aDark, is where this light is the only light).
        if (uBook.w > 0.5 && (cCloth || (vKind > 4.75 && vKind < 5.75))) {
          vec3 cP = vBookV + vViewPosition;
          float cPd = length(cP);
          float cFall = 1.0 / (1.0 + cPd * cPd / 9.0);
          float cToward = max(dot(normal, cP / max(cPd, 1e-3)), 0.0) * 0.8 + 0.2;
          // (a face under a page that is a light, uPage: none of the wash — it
          // made an egg of it — and of the light itself uPage.z, falling as a
          // light falls on a form, and dying up the face as the hood's own does)
          float cSpare = 1.0;
          if (uPage.x > 0.0 && vKind > 5.1 && vKind < 5.5) {
            float cUpFace = length(vHoodV + vViewPosition);
            vec3 cFrom = normalize(cP / max(cPd, 1e-3) + normalize(normalMatrix * vec3(0.0, 0.0, 1.0)) * ${f3(FACE.fore)});
            cSpare = uPage.z * pow(max((dot(normal, cFrom) + ${f3(FACE.wrap)}) / ${f3(1 + FACE.wrap)}, 0.0), ${f3(FACE.side.gamma)}) / max(cToward, 1e-3)
              * (1.0 - smoothstep(${f3(FACE.reach[0])} * uHoodTint.w, ${f3(FACE.reach[1])} * uHoodTint.w, cUpFace));
          }
          outgoingLight += diffuseColor.rgb * cOnPage * vec3(1.0, 0.86, 0.66) * cLit.z * cFall * cToward * cSpare;
        }
      }
      #endif`}
      // A lit opening behind the reader (uArch): a broad light, so it comes
      // a little way round the cloth, and brightest along the edge of whatever
      // is seen against it — the shoulder, the side of the hood, the sleeve.
      if (uArch.w > 0.0) {
        vec3 aP = vArchV + vViewPosition;
        float aD = length(aP);
        vec3 aL = aP / max(aD, 1e-3);
        vec3 aV = normalize(vViewPosition);
        float aNV = clamp(dot(normal, aV), 0.0, 1.0);
        float aWrap = clamp(dot(normal, aL) * 0.7 + 0.3, 0.0, 1.0);
        float aRim = pow(1.0 - aNV, 2.5) * (0.35 + 0.65 * max(0.0, -dot(aV, aL)));
        float aFall = 1.0 / (1.0 + aD * aD / (uArchTint.w * uArchTint.w));
        outgoingLight += (diffuseColor.rgb * (0.55 * aWrap * aWrap + 3.2 * aRim * aWrap) + vec3(0.012, 0.009, 0.005) * aRim * aWrap)
          * uArchTint.rgb * uArch.w * aFall * (1.0 - vDark);
      }
      // The lit stone at the feet, as a low warm lamp of its own: on the
      // front of the robe, the hands, the book's edge and — up under the
      // hood, where nothing else reaches — the chin and the brow.
      if (uGlow.w > 0.0) {
        vec3 gP = vGlowV + vViewPosition;
        float gD = length(gP);
        float gFall = 1.0 / (1.0 + gD * gD / 9.0);
        float gToward = max(dot(normal, gP / max(gD, 1e-3)), 0.0);
        outgoingLight += diffuseColor.rgb * vec3(1.0, 0.78, 0.52) * uGlow.w * gFall * gToward * (1.0 - 0.8 * vDark);
      }
      // A low warm light in the hood, as from a lamp the reader holds: on the
      // face, and on the inside of the cowl round it — nowhere else. (Without
      // it the opening is one flat black, and whoever stands face to face
      // with the reader at the end is nobody.)
      if (uHood.w > 0.0) {
        bool hSkin = vKind > 4.75 && vKind < 5.75;
        float hIn = hSkin ? ${f3(HOOD.lamp.face)} : vKind < 1.5 ? ${f3(HOOD.lamp.wool)} * smoothstep(0.3, 0.8, vDark) : 0.0;
        if (hIn > 0.0) {
          vec3 hP = vHoodV + vViewPosition;
          float hD = length(hP);
          float hToward = max(dot(normal, hP / max(hD, 1e-3)), 0.0);
          // the cloth takes it from every side, as a hollow does; the face only
          // where it is turned to it, and not at all where it turns away from
          // the eye into the hood (lit to its edge it had an outline, an egg's)
          if (hSkin) {
            ${FACE.on ? `// (a light on a form: round it a little way, off it quickly, and
            // not cut off at the profile; a plain head, uPlain, as it was lit before)
            float hOld = (hToward * 0.85 + 0.15) * smoothstep(0.0, 0.6, dot(normal, normalize(vViewPosition)))
              * (1.0 - smoothstep(${f3(HOOD.lamp.reach[0])} * uHoodTint.w, ${f3(HOOD.lamp.reach[1])} * uHoodTint.w, hD));
            float hRaw = dot(normal, normalize(hP / max(hD, 1e-3) + normalize(normalMatrix * vec3(0.0, 0.0, 1.0)) * ${f3(FACE.fore)}));
            hToward = pow(max((hRaw + ${f3(FACE.wrap)}) / ${f3(1 + FACE.wrap)}, 0.0), ${f3(FACE.gamma)}) * ${f3(FACE.k / HOOD.lamp.face)}
              * smoothstep(${f3(FACE.edge[0])}, ${f3(FACE.edge[1])}, dot(normal, normalize(vViewPosition)))
              * (1.0 - smoothstep(${f3(FACE.reach[0])} * uHoodTint.w, ${f3(FACE.reach[1])} * uHoodTint.w, hD));
            if (uPlain > 0.5) hToward = hOld;`
    : `hToward = (hToward * 0.85 + 0.15) * smoothstep(0.0, 0.6, dot(normal, normalize(vViewPosition)))
              * (1.0 - smoothstep(${f3(HOOD.lamp.reach[0])} * uHoodTint.w, ${f3(HOOD.lamp.reach[1])} * uHoodTint.w, hD));`}
          } else {
            hToward = (hToward * 0.7 + 0.2)
              * (1.0 - smoothstep(${f3(HOOD.lamp.cloth[0])} * uHoodTint.w, ${f3(HOOD.lamp.cloth[1])} * uHoodTint.w, hD));
          }
          outgoingLight += diffuseColor.rgb * uHoodTint.rgb * uHood.w * hToward * hIn / (1.0 + hD * hD / (uHoodTint.w * uHoodTint.w));
        }
      }
      #include <opaque_fragment>`);
};
