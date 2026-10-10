// ── Pier glasses ─────────────────────────────────────────────────────────────
// "In the hallway there is a mirror, which faithfully duplicates all
// appearances." The Library had one: a sheet of rough metal on the side wall of
// a passage, reflecting a blurred environment map and nothing of the room —
// from the doorway it read as a blackboard ("they don't look like mirrors").
// A mirror is known by one thing only, that it shows the room. These do.
//
// They hang on the piers either side of a gallery's way out, where the arch is
// flanked by bare ashlar — the place a pier glass has always hung, between two
// openings — so the first thing a reader sees in each room has the room in it
// twice. Round-headed, like the arches they flank, in a carved and gilded frame:
// a beaded sight edge, a cove, a fat torus, and a cresting with the Library's
// own hexagon in a cartouche between two scrolls; a shell hangs under the
// bottom rail. The glass is old: silvered warm, a little soft, foxed and gone
// dark in clouds toward its edges, with a bevel round it that bends the room.
//
// What the glass shows is the world drawn again from the reader's eye turned
// over in the glass's plane, through a frustum cut to the glass itself (an
// off-axis projection with the near plane ON the glass — Kooima's generalised
// perspective — so nothing behind the wall can be drawn and the image lands on
// the glass texel for texel, at a resolution set by how big the glass is on the
// screen). A glass is only drawn while the reader is in its room; one further
// off keeps the last thing it showed. `GLASS.budget` is how many may be drawn
// in one frame (?wglass=0: none — every glass holds its first image).
import * as THREE from 'three';
import { vestOld } from './vestFix';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const GLASS = {
  quality: 0.6,   // the reflection's height, as a fraction of the glass's on the screen
  reach: 175,     // drawn live only for a reader this near (a gallery is 173 across)
  // The most glasses drawn in one frame. A drawing of the world costs the same
  // whatever size it is drawn at (a glass is a few thousand pixels; the cost is
  // every book in the room), so two glasses in view are taken in turn: each
  // is redrawn every other frame, and the frame pays for one.
  budget: 1,
  // A reader standing still gets a glass redrawn this many frames apart — the
  // readers on the bridge still walk in it.
  still: 3,
  // How far the reflection reaches. A gallery and its hallways are inside 450
  // of any glass; what lies beyond is fog, and drawing it cost as much again.
  far: 520,
};

// The frame's section, from the sight edge (w 0, at the glass) outward, and how
// far each point stands off the wall (d). `true`: an arris — the faces either
// side of it are lit as two faces, not rounded into one.
const GZ = 0.45;  // the glass's face, off the wall
const PROFILE = [
  [-0.3, GZ + 0.02, true], // the rebate's lip, over the glass's edge
  [-0.3, 0.95, true],
  [0.05, 1.12],
  [0.35, 1.18],            // the bead's fillet
  [0.62, 1.12, true],
  [0.74, 0.92],            // the cove
  [0.92, 0.86],
  [1.12, 0.97],
  [1.36, 1.3],             // the torus
  [1.66, 1.54],
  [2.0, 1.62],
  [2.32, 1.5],
  [2.52, 1.24],
  [2.6, 1.02, true],
  [2.76, 0.98, true],      // the outer fillet
  [2.8, 0.74, true],
  [3.05, 0.7, true],
  [3.1, 0.48],
  [3.1, 0.0, true],        // down to the stone
];
const FRAME_W = 3.1;

const v2 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1],
  norm: (a) => { const L = Math.hypot(a[0], a[1]) || 1; return [a[0] / L, a[1] / L]; },
};
// right of the way the outline runs: outward, for an outline drawn anticlockwise
const outward = (a, b) => v2.norm([b[1] - a[1], -(b[0] - a[0])]);

// The glass's outline: a rectangle `2·hw` wide with its sides `side` tall and a
// half circle on top, anticlockwise from the bottom left. The bottom corners
// are arrises; where a side runs into the head is not.
const archLoop = (hw, side, n = 28) => {
  const loop = [{ p: [-hw, 0], sharp: true }, { p: [hw, 0], sharp: true }, { p: [hw, side] }];
  for (let k = 1; k < n; k++) {
    const a = (k / n) * Math.PI;
    loop.push({ p: [hw * Math.cos(a), side + hw * Math.sin(a)] });
  }
  loop.push({ p: [-hw, side] });
  return loop;
};

// Every face turned the way its vertices' normals say it faces.
const orient = (geo) => {
  const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), f = new THREE.Vector3();
  for (let t = 0; t < idx.count; t += 3) {
    const i = idx.getX(t), j = idx.getX(t + 1), k = idx.getX(t + 2);
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, j); c.fromBufferAttribute(pos, k);
    f.subVectors(b, a).cross(c.sub(a));
    n.fromBufferAttribute(nor, i).add(a.fromBufferAttribute(nor, j)).add(b.fromBufferAttribute(nor, k));
    if (f.dot(n) < 0) { idx.setX(t + 1, k); idx.setX(t + 2, j); }
  }
  return geo;
};

const indexed = (pos, nor, uv, idx) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return orient(g);
};

// The moulding run round the outline.
const sweep = (loop, profile) => {
  const prof = [];
  const segN = (a, b) => v2.norm([-(b[1] - a[1]), b[0] - a[0]]);
  profile.forEach(([w, d, hard], j) => {
    const nIn = j > 0 ? segN(profile[j - 1], profile[j]) : null;
    const nOut = j < profile.length - 1 ? segN(profile[j], profile[j + 1]) : null;
    if (hard && nIn && nOut) prof.push({ w, d, n: nIn }, { w, d, n: nOut, split: true });
    else prof.push({ w, d, n: nIn && nOut ? v2.norm(v2.add(nIn, nOut)) : (nIn ?? nOut) });
  });
  const rings = [];
  const L = loop.length;
  let run = 0;
  for (let i = 0; i < L; i++) {
    const a = loop[(i - 1 + L) % L].p, b = loop[i].p, c = loop[(i + 1) % L].p;
    const n1 = outward(a, b), n2 = outward(b, c);
    const m = v2.norm(v2.add(n1, n2));
    const s = 1 / Math.max(0.2, v2.dot(m, n1));
    run += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (loop[i].sharp) rings.push({ q: b, m, s, n: n1, cut: true, run }, { q: b, m, s, n: n2, run });
    else rings.push({ q: b, m, s, n: m, run });
  }
  const pos = [], nor = [], uv = [], idx = [];
  const P = prof.length;
  for (const r of rings) {
    for (const p of prof) {
      pos.push(r.q[0] + r.m[0] * r.s * p.w, r.q[1] + r.m[1] * r.s * p.w, p.d);
      const nx = r.n[0] * p.n[0], ny = r.n[1] * p.n[0], nz = p.n[1];
      const nl = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / nl, ny / nl, nz / nl);
      uv.push(r.run * 0.1, p.w * 0.3);
    }
  }
  const R = rings.length;
  for (let k = 0; k < R; k++) {
    if (rings[k].cut) continue;
    const k2 = (k + 1) % R;
    for (let j = 0; j < P - 1; j++) {
      if (prof[j + 1].split) continue;
      const a = k * P + j, b = k2 * P + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return indexed(pos, nor, uv, idx);
};

// A carved stem: a tube along `pts` that thins from r0 to r1, with an eye at
// its end. A scroll is not a bent rod: its section is broad across the board
// and shallow off it (`flat`), it swells a little before it thins (`swell`),
// and it is cut in reeds along its length (`ribs`) that each take the light.
const stem = (pts, r0, r1, { segs = 40, radial = 8, eye = 1.35, flat = 1, swell = 0, ribs = 0, rib = 0.1 } = {}) => {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3();
  const sectionR = (t) => (r0 + (r1 - r0) * Math.pow(t, 0.8)) * (1 + swell * Math.sin(Math.PI * Math.pow(t, 0.6)));
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const r = sectionR(t);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2, cs = Math.cos(v), sn = Math.sin(v);
      // the frame of a curve in the wall's plane: N lies in it, B stands off it
      const k = r * (1 + (ribs ? rib * Math.cos(ribs * v) : 0));
      const a = cs * k, b = sn * k * flat;
      pos.push(P.x + a * N.x + b * B.x, P.y + a * N.y + b * B.y, P.z + a * N.z + b * B.z);
      const na = cs * flat, nb = sn;
      nor.push(na * N.x + nb * B.x, na * N.y + nb * B.y, na * N.z + nb * B.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const tube = indexed(pos, nor, uv, idx);
  // (turned by the section's own normals; lit by the reeds')
  if (ribs) tube.computeVertexNormals();
  const out = [tube];
  if (eye) {
    curve.getPointAt(1, P);
    out.push(new THREE.SphereGeometry(r1 * eye, 10, 8).scale(1, 1, flat).translate(P.x, P.y, P.z));
  }
  curve.getPointAt(0, P);
  out.push(new THREE.SphereGeometry(r0, 10, 8).scale(1, 1, flat).translate(P.x, P.y, P.z));
  return out;
};

// A flat shape carved out of the board: extruded, its edges rounded over.
const carve = (shape, { depth = 0.5, bevel = 0.3, z = 0, curve = 10 } = {}) => {
  let g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 3, curveSegments: curve,
  });
  g.translate(0, 0, z + bevel);
  // Rounded, not cut: the bevel's facets each took the lamp as a line of their
  // own, and a carving under gilt has no flats on its edges.
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-3);
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
};

// A closed outline, `n` points round (cx, cy) at radius f(θ) × (rx, ry).
const outline = (cx, cy, rx, ry, f = () => 1, n = 72, into = new THREE.Shape()) => {
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2, s = f(a);
    const x = cx + Math.cos(a) * rx * s, y = cy + Math.sin(a) * ry * s;
    if (k === 0) into.moveTo(x, y); else into.lineTo(x, y);
  }
  return into;
};

const bead = (r) => new THREE.SphereGeometry(r, 8, 6);

// Beads strung along an outline, `w` out from it, `pitch` apart.
const beadsAlong = (loop, w, z, pitch, r) => {
  const out = [];
  const L = loop.length;
  const pts = loop.map((v, i) => {
    const a = loop[(i - 1 + L) % L].p, b = v.p, c = loop[(i + 1) % L].p;
    const n1 = outward(a, b), m = v2.norm(v2.add(n1, outward(b, c)));
    return v2.add(b, [m[0] * w / Math.max(0.2, v2.dot(m, n1)), m[1] * w / Math.max(0.2, v2.dot(m, n1))]);
  });
  let carry = 0;
  for (let i = 0; i < L; i++) {
    const a = pts[i], b = pts[(i + 1) % L];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let u = carry;
    while (u < len) {
      const t = u / len;
      out.push(bead(r).translate(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z));
      u += pitch;
    }
    carry = u - len;
  }
  return out;
};

// A scroll: out from `from` and down into a spiral about `c` (radius `r` at its
// start, `turns` round, tightening to a fifth), on the plane z — mirrored by sx.
const scroll = (sx, from, c, r, a0, turns, z, r0, r1, ribs = 5) => {
  const pts = [[sx * from[0], from[1], z]];
  const n = Math.ceil(turns * 18);
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = a0 - t * turns * Math.PI * 2, rr = r * (1 - 0.8 * t);
    pts.push([sx * (c[0] + Math.cos(a) * rr), c[1] + Math.sin(a) * rr, z + 0.25 * Math.sin(t * Math.PI)]);
  }
  return stem(pts, r0, r1, { segs: Math.max(48, n * 3), radial: ribs ? ribs * 4 : 10, flat: 0.62, swell: 0.3, ribs, rib: 0.09 });
};

// A leaf: a lens `len` long and `w` across, standing up from (x, y) at `a`
// degrees off upright.
const leaf = (x, y, a, len, w, z) => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(w, len * 0.45, 0, len);
  s.quadraticCurveTo(-w, len * 0.45, 0, 0);
  return carve(s, { depth: 0.12, bevel: 0.16, z, curve: 8 }).rotateZ((-a * Math.PI) / 180).translate(x, y, 0);
};

// The whole frame, in the glass's own place: x across (to the right of a
// reader facing it), y up from the glass's foot, z out from the wall.
// Two gilts: `bright`, burnished, on everything that stands proud, and `deep`,
// matt and darker, in the hollows and grounds — the cove, the cartouche's
// field, the back of the shell — so the carving stands off them.
export const pierGlassFrame = ({ hw, side }) => {
  const loop = archLoop(hw, side);
  const parts = [sweep(loop, PROFILE.slice(0, 5)), sweep(loop, PROFILE.slice(8))];
  const deep = [sweep(loop, PROFILE.slice(4, 9))];
  parts.push(...beadsAlong(loop, 0.36, 1.2, 0.62, 0.21));

  // The cresting, on the head of the frame.
  const top = side + hw + FRAME_W;
  const cy = top + 1.7;
  // a cartouche with a scalloped edge, a moulded rim and the Library's hexagon on it
  const rim = (a) => 1 + 0.045 * Math.cos(a * 12) + 0.08 * Math.cos(a * 2);
  deep.push(carve(outline(0, cy, 2.55, 3.05, rim, 120), { depth: 0.45, bevel: 0.42, z: 0.55 }));
  const rimLoop = [];
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2, s = rim(a) * 0.93;
    rimLoop.push({ p: [Math.cos(a) * 2.55 * s, cy + Math.sin(a) * 3.05 * s] });
  }
  parts.push(sweep(rimLoop, [[-0.3, 1.5, true], [-0.26, 1.95], [-0.1, 2.16], [0.1, 2.16], [0.26, 1.95], [0.3, 1.5, true]]));
  const hex = new THREE.Shape();
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 2;
    if (k === 0) hex.moveTo(Math.cos(a) * 1.5, cy + Math.sin(a) * 1.5); else hex.lineTo(Math.cos(a) * 1.5, cy + Math.sin(a) * 1.5);
  }
  const hole = new THREE.Path();
  for (let k = 0; k <= 6; k++) {
    const a = -(k / 6) * Math.PI * 2 + Math.PI / 2;
    if (k === 0) hole.moveTo(Math.cos(a) * 0.92, cy + Math.sin(a) * 0.92); else hole.lineTo(Math.cos(a) * 0.92, cy + Math.sin(a) * 0.92);
  }
  hex.holes.push(hole);
  parts.push(carve(hex, { depth: 0.2, bevel: 0.2, z: 1.75, curve: 1 }));
  parts.push(new THREE.SphereGeometry(0.5, 14, 10).scale(1, 1, 0.7).translate(0, cy, 2.0));
  // beads round the field, inside the rim
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2, s = rim(a) * 0.74;
    parts.push(bead(0.17).translate(Math.cos(a) * 2.55 * s, cy + Math.sin(a) * 3.05 * s, 1.8));
  }
  for (const sx of [-1, 1]) {
    // the great scrolls, out from the cartouche and down over the head
    parts.push(...scroll(sx, [1.9, cy - 1.1], [5.25, top - 1.35], 1.45, 1.92, 1.05, 1.45, 0.52, 0.2));
    // small ones over them, curling up
    parts.push(...scroll(sx, [1.25, cy + 2.6], [2.65, cy + 3.15], 0.62, Math.PI * 1.05, 0.85, 1.25, 0.3, 0.13));
    // and ears where the sides run into the head
    parts.push(...scroll(sx, [hw + FRAME_W - 0.6, side + 1.8], [hw + FRAME_W + 0.75, side - 0.6], 0.95, Math.PI * 0.62, 0.95, 1.2, 0.36, 0.15));
  }
  // a palmette standing on the cartouche
  [[-52, 1.9], [-26, 2.6], [0, 3.1], [26, 2.6], [52, 1.9]].forEach(([a, len]) => {
    parts.push(leaf(0, cy + 2.75, a, len, 0.55, 0.85));
  });
  parts.push(new THREE.SphereGeometry(0.45, 12, 8).translate(0, cy + 2.85, 1.25));

  // The apron: a shell hung under the bottom rail, and a drop under it.
  const hinge = [0, -FRAME_W + 0.6];
  const fan = (a) => (a > Math.PI ? 1 + 0.07 * Math.cos(a * 9) : 0.25);
  deep.push(carve(outline(hinge[0], hinge[1], 3.0, 2.6, fan, 120), { depth: 0.25, bevel: 0.25, z: 0.3 }));
  // its flutes: broad and shallow, near enough touching at the rim, so it
  // reads as a scallop and not as a fan of sticks
  for (let k = 0; k < 9; k++) {
    const a = Math.PI + (Math.PI * (k + 0.5)) / 9;
    const end = [hinge[0] + Math.cos(a) * 2.7, hinge[1] + Math.sin(a) * 2.35];
    const mid = [hinge[0] + Math.cos(a) * 1.5, hinge[1] + Math.sin(a) * 1.3];
    parts.push(...stem([[hinge[0], hinge[1], 1.0], [mid[0], mid[1], 1.2], [end[0], end[1], 0.9]], 0.1, 0.5, { segs: 16, radial: 10, eye: 0.85, flat: 0.45 }));
  }
  parts.push(new THREE.SphereGeometry(0.5, 12, 8).translate(0, hinge[1] + 0.15, 1.35));
  parts.push(...stem([[0, hinge[1] - 2.5, 0.6], [0, hinge[1] - 3.3, 0.75], [0, hinge[1] - 4.0, 0.85]], 0.22, 0.16, { segs: 8, radial: 8, eye: 3.2 }));
  return { bright: parts, deep };
};

// The glass itself, a little under the frame's lip all round.
const glassGeometry = (hw, side) => {
  const s = new THREE.Shape();
  const e = hw + 0.3;
  s.moveTo(-e, -0.3);
  s.lineTo(e, -0.3);
  s.lineTo(e, side);
  s.absarc(0, side, e, 0, Math.PI, false);
  s.lineTo(-e, -0.3);
  return new THREE.ShapeGeometry(s, 32);
};

const vertexShader = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHas;
  uniform vec4 uGlass;   // half width, side, head radius, height
  uniform vec2 uTexel;
  uniform float uSeed;
  uniform float uAged;   // 1: the silvering of 2026-10-08 (vestFix.js, point 4)
  varying vec2 vLocal;

  float mHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float mNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mHash(i), mHash(i + vec2(1.0, 0.0)), f.x), mix(mHash(i + vec2(0.0, 1.0)), mHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float mFbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * mNoise(p); p = p * 2.03 + 7.1; a *= 0.5; }
    return s;
  }

  void main() {
    float hw = uGlass.x, side = uGlass.y, r = uGlass.z, H = uGlass.w;
    vec2 p = vLocal;
    // How far in from the frame this is, and which way is out.
    float dl = p.x + hw, dr = hw - p.x, db = p.y;
    float d = min(min(dl, dr), db);
    vec2 out2 = db < min(dl, dr) ? vec2(0.0, -1.0) : (dl < dr ? vec2(-1.0, 0.0) : vec2(1.0, 0.0));
    if (p.y > side) {
      vec2 q = vec2(p.x, p.y - side);
      float lq = max(length(q), 1e-4);
      d = r - lq;
      out2 = q / lq;
    }
    // Old plate is never quite flat, and the bevel round it — a finger's
    // width — bends what it shows out toward the frame.
    vec2 wob = vec2(mNoise(p * 0.5 + uSeed) - 0.5, mNoise(p * 0.5 + uSeed + 19.0) - 0.5) * 0.0035;
    float bev = 1.0 - smoothstep(0.0, 0.85, d);
    // (mirrored: the glass's right is the left of what it shows)
    vec2 uv = vec2((hw - p.x) / (2.0 * hw), p.y / H);
    uv += vec2(-out2.x / (2.0 * hw), out2.y / H) * bev * 0.7 + wob;
    vec2 lo = uTexel, hi = 1.0 - uTexel;
    vec2 o = uTexel * (uAged > 0.5 ? 0.35 : 0.6);
    vec3 refl = 0.25 * (
      texture2D(uMap, clamp(uv + vec2(o.x, o.y), lo, hi)).rgb + texture2D(uMap, clamp(uv + vec2(-o.x, o.y), lo, hi)).rgb +
      texture2D(uMap, clamp(uv + vec2(o.x, -o.y), lo, hi)).rgb + texture2D(uMap, clamp(uv - o, lo, hi)).rgb);

    // The silvering: warm, a little short of white, and going — in clouds
    // that gather toward the edges, and in a scatter of foxing spots.
    float edge = 1.0 - smoothstep(0.0, 3.4, d);
    float cloud = mFbm(p * 0.26 + uSeed);
    // (the clouds hug the frame; the open glass keeps most of its silver)
    float rot = smoothstep(0.62, 0.82, cloud * 0.7 + edge * 0.55);
    // foxing: soft brown blooms, a few, mostly near the edge — not a scatter of black
    float fox = mFbm(p * 1.1 + uSeed * 3.0);
    float spots = smoothstep(0.66, 0.78, fox) * (0.15 + 0.85 * edge) * 0.55;
    float loss = clamp(rot * 0.65 + spots, 0.0, 1.0);
    float silver = mix(0.86, 0.2, loss) * (0.94 + 0.06 * cloud);
    vec3 tint = mix(vec3(0.95, 0.9, 0.82), vec3(0.8, 0.66, 0.5), spots);
    if (uAged > 0.5) {
      // Old silver: darker all through and warmer, and going brown from the
      // frame in, so the glass gives back the room — dimmer than the room is
      // — and never shines on its own. A bright pale plate read as a frosted
      // panel lit from behind: the lamp over the stand, and its halo, filled
      // all of it. The highlights are held down too (old silver loses the top
      // of the light first), so the lamp in it is a lamp and not a glow.
      // (the loss kept to a band round the frame: the middle of the glass
      // holds its silver, and shows the room plainly)
      float rim = 1.0 - smoothstep(0.0, 4.0, d);
      rot = smoothstep(0.62, 0.86, cloud * 0.5 + rim * 0.7);
      spots = smoothstep(0.62, 0.76, fox) * (0.05 + 0.95 * rim) * 0.7 + 0.25 * rim * rim;
      loss = clamp(rot * 0.7 + spots, 0.0, 1.0);
      silver = mix(0.84, 0.16, loss) * (0.95 + 0.05 * cloud);
      tint = mix(vec3(0.94, 0.84, 0.68), vec3(0.62, 0.45, 0.28), clamp(spots, 0.0, 1.0));
      float peak = max(refl.r, max(refl.g, refl.b));
      refl /= 1.0 + 0.2 * peak;
    }
    vec3 col = refl * tint * silver;
    // where it has gone, the dark of the backing
    col += vec3(0.010, 0.0085, 0.0065) * loss;
    // the bevel's inner arris catches what light there is
    float ridge = exp(-pow((d - 0.85) / 0.1, 2.0));
    col *= 1.0 + (uAged > 0.5 ? 0.18 : 0.3) * ridge + (uAged > 0.5 ? 0.06 : 0.15) * bev;
    if (uHas < 0.5) col = vec3(0.018, 0.016, 0.013) * (0.6 + 0.4 * cloud);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// The glasses, and the pass that draws what each one shows.
export function makeMirrors({ root, keep, light = false }) {
  const mirrors = [];
  const U = new THREE.Vector3(0, 1, 0);

  // `at` [x, z] on the wall's face, `y` the glass's foot, `normal` [x, z] out
  // of the wall, `hw`/`side` the glass. Returns the frame's pieces, placed,
  // in its two gilts.
  const hang = ({ at, y, normal, hw, side }) => {
    const N = new THREE.Vector3(normal[0], 0, normal[1]).normalize();
    const Rt = new THREE.Vector3().crossVectors(U, N);
    const basis = new THREE.Matrix4().makeBasis(Rt, U, N).setPosition(at[0], y, at[1]);
    const H = side + hw;
    const target = keep(new THREE.WebGLRenderTarget(16, 16, {
      // Linear light, half float, like the frame it is pasted into.
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      depthBuffer: true,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    }));
    const material = keep(new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: target.texture },
        uHas: { value: 0 },
        uGlass: { value: new THREE.Vector4(hw, side, hw, H) },
        uTexel: { value: new THREE.Vector2(1 / 16, 1 / 16) },
        uSeed: { value: mirrors.length * 7.31 + 2.2 },
        uAged: { value: vestOld(4) ? 0 : 1 },
      },
      vertexShader,
      fragmentShader,
      fog: false,
    }));
    const glass = new THREE.Mesh(keep(glassGeometry(hw, side)), material);
    glass.name = 'mirror-glass';
    glass.matrixAutoUpdate = false;
    glass.matrix.copy(basis).multiply(new THREE.Matrix4().makeTranslation(0, 0, GZ));
    glass.matrixWorldNeedsUpdate = true;
    glass.castShadow = false;
    glass.receiveShadow = false;
    root.add(glass);
    const foot = new THREE.Vector3(at[0], y, at[1]).addScaledVector(N, GZ);
    const box = new THREE.Box3()
      .expandByPoint(foot.clone().addScaledVector(Rt, hw))
      .expandByPoint(foot.clone().addScaledVector(Rt, -hw).addScaledVector(U, H));
    box.expandByScalar(0.5);
    mirrors.push({
      glass, material, target, N, Rt, foot, hw, H, box, size: [16, 16], has: false, centre: box.getCenter(new THREE.Vector3()),
      // frames since it was last drawn, and the eye it was drawn for
      age: 0, pose: new Float32Array(16),
    });
    const { bright, deep } = pierGlassFrame({ hw, side });
    return { bright: bright.map((g) => g.applyMatrix4(basis)), deep: deep.map((g) => g.applyMatrix4(basis)) };
  };

  const eye = new THREE.PerspectiveCamera();
  const frustum = new THREE.Frustum();
  const view = new THREE.Matrix4();
  const spin = new THREE.Matrix4();
  const pe = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const vr = new THREE.Vector3(), vn = new THREE.Vector3();
  const buffer = new THREE.Vector2();
  const P = new THREE.Vector3();
  let drawn = 0;

  // One glass: the world from the reader's eye turned over in it, through the
  // glass as through a window.
  const draw = (m, renderer, scene, camera, px, hide, aim) => {
    const quality = GLASS.quality * (light ? 0.75 : 1);
    const h = Math.min(1024, Math.max(96, Math.round((px * quality) / 32) * 32));
    const w = Math.max(32, Math.round((h * 2 * m.hw) / m.H));
    if (m.size[0] !== w || m.size[1] !== h) {
      m.target.setSize(w, h);
      m.size = [w, h];
      m.material.uniforms.uTexel.value.set(1 / w, 1 / h);
    }
    const out = P.subVectors(camera.position, m.foot).dot(m.N);
    pe.copy(camera.position).addScaledVector(m.N, -2 * out);
    // The glass's corners as the eye behind it sees them: its left is the
    // reader's right.
    pa.copy(m.foot).addScaledVector(m.Rt, m.hw);
    pb.copy(m.foot).addScaledVector(m.Rt, -m.hw);
    pc.copy(pa).addScaledVector(U, m.H);
    vr.copy(m.Rt).negate();
    vn.copy(m.N).negate();
    va.subVectors(pa, pe); vb.subVectors(pb, pe); vc.subVectors(pc, pe);
    const d = -va.dot(vn);
    // the near plane a hair out from the glass: the wall behind it is never drawn
    const near = d + 0.05, k = near / d;
    eye.projectionMatrix.makePerspective(vr.dot(va) * k, vr.dot(vb) * k, U.dot(vc) * k, U.dot(va) * k, near, Math.min(camera.far, d + GLASS.far));
    eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert();
    eye.position.copy(pe);
    eye.quaternion.setFromRotationMatrix(spin.makeBasis(vr, U, vn));
    eye.scale.set(1, 1, 1);
    eye.updateMatrixWorld();
    eye.layers.mask = camera.layers.mask;

    const was = renderer.getRenderTarget();
    const wasShadow = renderer.shadowMap.autoUpdate;
    const held = hide.map((o) => o.visible);
    m.glass.visible = false;
    hide.forEach((o) => { o.visible = false; });
    try {
      renderer.shadowMap.autoUpdate = false;
      aim?.(pe);
      renderer.setRenderTarget(m.target);
      renderer.clear();
      renderer.render(scene, eye);
    } finally {
      renderer.setRenderTarget(was);
      renderer.shadowMap.autoUpdate = wasShadow;
      aim?.(null);
      m.glass.visible = true;
      hide.forEach((o, i) => { o.visible = held[i]; });
    }
    m.has = true;
    m.material.uniforms.uHas.value = 1;
    m.age = 0;
    m.pose.set(camera.matrixWorld.elements);
    drawn += 1;
  };
  const moved = (m, camera) => {
    const e = camera.matrixWorld.elements;
    for (let i = 0; i < 16; i++) if (Math.abs(e[i] - m.pose[i]) > 1e-3) return true;
    return false;
  };

  // Every frame, after the camera is placed and before the frame is drawn.
  // `hide`: what must not be in a reflection (the doorways, whose face is
  // painted for the reader's own eye); `aim(at)`: set the halos for the
  // reflected eye, and `aim(null)` back.
  const want = [];
  const render = (renderer, scene, camera, { live = true, hide = [], aim = null } = {}) => {
    drawn = 0;
    if (!mirrors.length) return 0;
    renderer.getDrawingBufferSize(buffer);
    const focal = buffer.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    frustum.setFromProjectionMatrix(view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    want.length = 0;
    let prime = null;
    for (const m of mirrors) {
      m.age += 1;
      if (P.subVectors(camera.position, m.foot).dot(m.N) < 0.5) continue;
      if (!frustum.intersectsBox(m.box)) continue;
      const dist = camera.position.distanceTo(m.centre);
      const px = (m.H * focal) / Math.max(dist, 1);
      if (px < 12) continue;
      if (live && dist < GLASS.reach) {
        // Moving, it is due every frame; standing, every `still` frames.
        if (m.has && m.age < GLASS.still && !moved(m, camera)) continue;
        // the biggest and the longest undrawn first
        want.push({ m, px, rank: px * m.age });
      } else if (!m.has && (!prime || px > prime.px)) prime = { m, px };
    }
    want.sort((a, b) => b.rank - a.rank);
    want.splice(live ? (light ? 1 : GLASS.budget) : 0);
    // A glass never drawn shows the dark of its backing: draw it once, however far off.
    if (!want.length && prime) want.push(prime);
    for (const { m, px } of want) draw(m, renderer, scene, camera, px, hide, aim);
    return drawn;
  };

  const list = () => mirrors.map((m) => ({
    foot: [+m.foot.x.toFixed(2), +m.foot.y.toFixed(2), +m.foot.z.toFixed(2)],
    normal: [+m.N.x.toFixed(3), +m.N.z.toFixed(3)],
    centre: [+m.centre.x.toFixed(2), +m.centre.y.toFixed(2), +m.centre.z.toFixed(2)],
    size: m.size, has: m.has,
  }));

  return { hang, render, list, count: () => mirrors.length, drawn: () => drawn };
}
