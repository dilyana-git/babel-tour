// ── What lives in the pond ───────────────────────────────────────────────────
// The lilies and the koi of the Pavilion's pond.
//
// What was there before: twenty flat dark discs with a wedge cut out, all one
// size and all lying at one height (so wherever two met they fought for the
// same pixels), a pink icosahedron dropped beside a few of them for a flower,
// and seven fish that were cut-out cards lying ON the water, never moving. A
// pond is the one place in a garden that is visibly alive, and from the bridge
// it read as a table with plates on it.
//
//   the pads   Nymphaea: a leaf split to the stalk at one side, the two lobes
//              either side of the split rounded off, the rim not quite round
//              and, on an older leaf, turned up and wavy, so the maroon of the
//              underside shows at its edge. Veins run out from the stalk and
//              fork twice on the way to the rim; young leaves are mottled
//              maroon, old ones yellow from the rim in and are bitten into.
//              They grow in colonies off one rhizome — a clump of large pads
//              with young ones between them — and never as an even scatter.
//
//   the flowers   four green sepals lying on the water, then three whorls of
//              pointed petals, each more upright than the last, round a crown
//              of gold stamens; and closed buds standing up out of the water.
//
//   the koi    solid fish, not cards, swimming: each follows its own loop round
//              the Pavilion (or loiters in one patch of water), speeding up and
//              gliding, its body bending to the curve it swims and a wave running
//              down it to the tail, the pectoral fins spread when it hangs and
//              folded back when it goes. Patterned as the real varieties are —
//              kohaku, sanke, showa, tancho, the metallic ogon, chagoi, asagi.
//
//              And they are UNDER the water, which is the difficult part. The
//              pond is a sheet 0.97 opaque (the clearance probe knows water by
//              that — see water.js), so nothing actually below it can be seen.
//              Each fish is instead laid in the one place it can be seen from:
//              every vertex of the fish as it really is, down in the water, is
//              carried along the eye's ray back up to the surface, and set a
//              hair above it — the same picture, drawn where the water cannot
//              cover it and a lily pad can. On the way it is lifted by the
//              water's refraction (a thing under water looks three quarters as
//              deep as it is), dimmed by the water it is seen through, and lost
//              to the reflection at a graze.
import * as THREE from 'three';
import { makeRng, toTexture, normalsFrom } from './textures';
import { WATER_Y } from './water';

const TAU = Math.PI * 2;
const canvas = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
};
const grey = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;
const hsla = ([h, s, l], a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

// ── Lily pads ─────────────────────────────────────────────────────────────────
// Four leaves in one atlas, each with its own mesh: the outline that is painted
// is the outline that is cut, so the brown of a rim lies on the rim.
export const PAD_KINDS = ['young', 'prime', 'wet', 'old'];
const CELLS = 2;          // the atlas is CELLS × CELLS leaves
const PAD_R = 0.47;       // a leaf's radius in its cell
const PAD_FIT = 1.06;     // the largest a leaf's wobbling rim reaches, in leaf radii

// The outline of one leaf, split at angle 0 (+x) to the stalk at its centre.
const padShape = (rnd, cell) => {
  const kind = PAD_KINDS[cell];
  const w = [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU];
  const slit = 0.05 + rnd() * 0.035;
  const squash = 0.93 + rnd() * 0.06;
  const rim = (a) => 1 + 0.022 * Math.sin(3 * a + w[0]) + 0.012 * Math.sin(7 * a + w[1]) + 0.006 * Math.sin(13 * a + w[2])
    // the two lobes round off where they meet at the split
    - 0.08 * Math.exp(-(((a - slit) / 0.16) ** 2)) - 0.08 * Math.exp(-(((TAU - slit - a) / 0.16) ** 2));
  const at = (a, t = 1) => [Math.cos(a) * rim(a) * t, Math.sin(a) * rim(a) * t * squash];
  return {
    cell, kind, slit, w, at,
    // how far the rim turns up (in leaf radii) and how wavy it is
    curl: { young: 0.012, prime: 0.028, wet: 0.022, old: 0.06 }[kind] * (0.7 + rnd() * 0.6),
    ripple: { young: 0.004, prime: 0.01, wet: 0.008, old: 0.022 }[kind],
  };
};

const PALETTE = {
  //        centre           rim             margin
  young: [[90, 44, 35], [97, 40, 26], [342, 42, 26]],
  prime: [[97, 37, 29], [105, 38, 20], [24, 36, 20]],
  wet: [[102, 36, 26], [110, 37, 18], [18, 34, 18]],
  old: [[76, 40, 31], [64, 42, 25], [28, 44, 17]],
};

function paintPads(shapes, { cell = 512, seed = 83 } = {}) {
  const rnd = makeRng(seed);
  const size = cell * CELLS;
  const [col, c] = canvas(size), [hgt, h] = canvas(size), [rgh, r] = canvas(size);
  h.fillStyle = grey(128);
  h.fillRect(0, 0, size, size);
  // a leaf is waxed: it sheds water and takes a highlight
  r.fillStyle = grey(150);
  r.fillRect(0, 0, size, size);

  for (const shape of shapes) {
    const x0 = (shape.cell % CELLS) * cell, y0 = Math.floor(shape.cell / CELLS) * cell;
    const ox = x0 + cell / 2, oy = y0 + cell / 2, S = (cell * PAD_R) / PAD_FIT;
    const P = ([x, z]) => [ox + x * S, oy + z * S];
    const trace = (g, t = 1) => {
      g.beginPath();
      g.moveTo(ox, oy);
      for (let k = 0; k <= 120; k++) g.lineTo(...P(shape.at(shape.slit + ((TAU - 2 * shape.slit) * k) / 120, t)));
      g.closePath();
    };
    // anywhere on the leaf, away from the split
    const onLeaf = (t0 = 0, t1 = 0.97) => {
      const a = shape.slit + 0.1 + rnd() * (TAU - 2 * shape.slit - 0.2);
      return { a, t: t0 + (t1 - t0) * Math.sqrt(rnd()) };
    };
    const [centre, rimC, margin] = PALETTE[shape.kind];
    const light = (hsl, dl) => [hsl[0], hsl[1], hsl[2] + dl];

    // the whole cell in the rim's colour, so no mip level pulls anything else in
    c.fillStyle = hsla(rimC);
    c.fillRect(x0, y0, cell, cell);
    for (const g of [c, h, r]) { g.save(); trace(g); g.clip(); }

    const grd = c.createRadialGradient(ox, oy, 0, ox, oy, S * 1.04);
    grd.addColorStop(0, hsla(light(centre, 3)));
    grd.addColorStop(0.5, hsla([(centre[0] + rimC[0]) / 2, (centre[1] + rimC[1]) / 2, (centre[2] + rimC[2]) / 2]));
    grd.addColorStop(1, hsla(rimC));
    c.fillStyle = grd;
    c.fillRect(x0, y0, cell, cell);

    // broad mottling, so a leaf lit by one lamp is not one flat green
    for (let k = 0; k < 110; k++) {
      const { a, t } = onLeaf();
      const [px, py] = P(shape.at(a, t)), rad = S * (0.04 + rnd() * 0.16);
      const b = c.createRadialGradient(px, py, 0, px, py, rad);
      b.addColorStop(0, hsla([centre[0] + (rnd() - 0.5) * 20, centre[1], centre[2] + (rnd() - 0.5) * 12], 0.22));
      b.addColorStop(1, hsla(centre, 0));
      c.fillStyle = b;
      c.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    // the fine grain of the leaf's surface, felt more than seen
    for (let k = 0; k < 900; k++) {
      const { a, t } = onLeaf();
      const [px, py] = P(shape.at(a, t));
      h.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
      h.fillRect(px, py, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    // young leaves are mottled maroon, thickest toward the rim
    const speckles = { young: 300, prime: 40, wet: 20, old: 0 }[shape.kind];
    for (let k = 0; k < speckles; k++) {
      const { a, t } = onLeaf(0.25, 0.98);
      const [px, py] = P(shape.at(a, t));
      c.fillStyle = hsla([342 + rnd() * 16, 40, 20 + rnd() * 6], 0.3 + rnd() * 0.45);
      c.beginPath();
      c.arc(px, py, 0.8 + rnd() * 2.4 * t, 0, TAU);
      c.fill();
    }

    // Veins: from the stalk to the rim, forking twice on the way, pressed a
    // little into the leaf (grooves in the height, paler in the colour).
    const stroke = (pts, width) => {
      for (let k = 1; k < pts.length; k++) {
        const f = 1 - k / pts.length;
        const [ax, ay] = P(shape.at(pts[k - 1][0], pts[k - 1][1])), [bx, by] = P(shape.at(pts[k][0], pts[k][1]));
        c.strokeStyle = `rgba(206,222,150,${0.06 + 0.12 * f})`;
        c.lineWidth = 0.6 + width * f;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
        h.strokeStyle = `rgba(0,0,0,${0.15 + 0.25 * f})`;
        h.lineWidth = 1.2 + width * f;
        h.beginPath(); h.moveTo(ax, ay); h.lineTo(bx, by); h.stroke();
      }
    };
    const vein = (a, t0, t1, bend, width, forks) => {
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const t = t0 + ((t1 - t0) * k) / 10;
        pts.push([a + bend * (t - t0) * (t - t0), t]);
      }
      stroke(pts, width);
      if (!forks) return;
      const end = pts[pts.length - 1][0], spread = 0.05 + rnd() * 0.04;
      const next = t1 + (0.97 - t1) * (0.5 + rnd() * 0.2);
      for (const s of [-1, 1]) vein(end + s * spread, t1, forks > 1 ? next : 0.97, bend * 0.5 + s * 0.04, width * 0.6, forks - 1);
    };
    const n = 17 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const a = shape.slit + 0.14 + ((TAU - 2 * shape.slit - 0.28) * (i + 0.5 + (rnd() - 0.5) * 0.45)) / n;
      // the one running straight away from the split is the midrib
      const mid = Math.abs(a - Math.PI) < Math.PI / n;
      vein(a, 0.03, 0.45 + rnd() * 0.2, (rnd() - 0.5) * 0.14, mid ? 3 : 2, 1);
    }
    // where the stalk meets the leaf
    const knot = c.createRadialGradient(ox, oy, 0, ox, oy, S * 0.07);
    knot.addColorStop(0, 'rgba(214,220,150,0.5)');
    knot.addColorStop(1, 'rgba(214,220,150,0)');
    c.fillStyle = knot;
    c.fillRect(ox - S * 0.07, oy - S * 0.07, S * 0.14, S * 0.14);

    if (shape.kind === 'wet') {
      // Water lying on the wax, a little glossier where it lies. Only a
      // little: a glossy patch on a matte leaf is DARKER than the leaf from
      // anywhere its reflection does not reach the eye, and at full gloss
      // every film of water read as a hole in the leaf.
      for (let k = 0; k < 3; k++) {
        const { a, t } = onLeaf(0.2, 0.85);
        const [px, py] = P(shape.at(a, t)), rad = S * (0.12 + rnd() * 0.16);
        const b = r.createRadialGradient(px, py, 0, px, py, rad);
        b.addColorStop(0, 'rgba(110,110,110,0.7)');
        b.addColorStop(1, 'rgba(110,110,110,0)');
        r.fillStyle = b;
        r.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      }
    }
    if (shape.kind === 'old') {
      // yellowing in from part of the rim
      const a0 = shape.slit + 0.6 + rnd() * 4.5;
      const [yx, yy] = P(shape.at(a0, 0.95));
      const y = c.createRadialGradient(yx, yy, 0, yx, yy, S * 0.7);
      y.addColorStop(0, 'hsla(52,58%,44%,0.6)');
      y.addColorStop(0.6, 'hsla(58,50%,38%,0.25)');
      y.addColorStop(1, 'hsla(58,50%,38%,0)');
      c.fillStyle = y;
      c.fillRect(x0, y0, cell, cell);
    }

    // The rim: a thin coloured margin, raised a little, and its damage.
    c.lineWidth = 3.5;
    c.strokeStyle = hsla(margin, 0.75);
    trace(c);
    c.stroke();
    h.lineWidth = 4;
    h.strokeStyle = 'rgba(255,255,255,0.55)';
    trace(h);
    h.stroke();
    const scars = { young: 0, prime: 1, wet: 0, old: 3 }[shape.kind];
    const holes = { young: 0, prime: 0, wet: 0, old: 1 }[shape.kind];
    const bite = (px, py, rad) => {
      c.fillStyle = hsla([26 + rnd() * 10, 30, 11 + rnd() * 4], 0.8);
      c.beginPath();
      for (let k = 0; k <= 9; k++) {
        const q = (k / 9) * TAU, rr = rad * 1.8 * (0.75 + rnd() * 0.5);
        c.lineTo(px + Math.cos(q) * rr, py + Math.sin(q) * rr);
      }
      c.fill();
      r.fillStyle = grey(175);
      r.beginPath(); r.arc(px, py, rad * 1.8, 0, TAU); r.fill();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      for (let k = 0; k <= 9; k++) {
        const q = (k / 9) * TAU, rr = rad * (0.7 + rnd() * 0.5);
        c.lineTo(px + Math.cos(q) * rr, py + Math.sin(q) * rr);
      }
      c.fill();
      c.globalCompositeOperation = 'source-over';
    };
    for (let k = 0; k < scars; k++) {
      const a = shape.slit + 0.2 + rnd() * (TAU - 2 * shape.slit - 0.4);
      bite(...P(shape.at(a, 1.0)), 4 + rnd() * 7);
    }
    for (let k = 0; k < holes; k++) {
      const { a, t } = onLeaf(0.35, 0.85);
      bite(...P(shape.at(a, t)), 2.5 + rnd() * 5);
    }
    for (const g of [c, h, r]) g.restore();
  }
  // A leaf's veins are soft ridges under a waxed skin, not cut lines: drawn
  // sharp, every one of them caught the light as a scratch.
  const [soft, sg] = canvas(size);
  sg.filter = 'blur(1.6px)';
  sg.drawImage(hgt, 0, 0);
  return {
    map: toTexture(col, { anisotropy: 8 }),
    normalMap: toTexture(normalsFrom(soft, 2.2), { srgb: false }),
    roughnessMap: toTexture(rgh, { srgb: false }),
  };
}

// One leaf as a mesh: rings out from the stalk, the rim lifting and waving.
function padGeometry(shape) {
  const RINGS = 9, SEG = 48;
  const pos = [], uv = [], idx = [];
  const S = PAD_R / PAD_FIT, ox = (shape.cell % CELLS) + 0.5, oy = Math.floor(shape.cell / CELLS) + 0.5;
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    for (let j = 0; j <= SEG; j++) {
      const a = shape.slit + ((TAU - 2 * shape.slit) * j) / SEG;
      const [x, z] = shape.at(a, t);
      const edge = Math.max(0, (t - 0.6) / 0.4);
      const lobes = Math.exp(-(((a - shape.slit) / 0.4) ** 2)) + Math.exp(-(((TAU - shape.slit - a) / 0.4) ** 2));
      const y = shape.curl * edge * edge * (1 + 0.6 * Math.sin(2 * a + shape.w[3]))
        + shape.ripple * t ** 3 * Math.sin(5 * a + shape.w[0])
        // the lobes either side of the split lift a little off the water
        + 0.02 * edge * lobes;
      pos.push(x, y, z);
      uv.push((ox + x * S) / CELLS, 1 - (oy + z * S) / CELLS);
    }
  }
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEG; j++) {
      const a = i * (SEG + 1) + j, b = a + 1, c = a + SEG + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// `time`: the world's clock ({ value }), which a leaf turns on its stalk by.
export function makeLilyPads(time, { seed = 83 } = {}) {
  const rnd = makeRng(seed);
  const shapes = PAD_KINDS.map((_, k) => padShape(rnd, k));
  const maps = paintPads(shapes, { seed: seed + 1 });
  const material = new THREE.MeshStandardMaterial({
    ...maps,
    // At night the leaf is the dark thing on the water it always was — the
    // paint gives it veins and a rim, not a lighter green.
    color: '#6f7d68',
    roughness: 1,
    normalScale: new THREE.Vector2(0.9, 0.9),
    side: THREE.DoubleSide,
    alphaTest: 0.5,
  });
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;`)
      // A leaf swings a little on its stalk as the water moves under it.
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 padAt = instanceMatrix[3].xyz;
          float padTurn = 0.05 * sin(uTime * 0.21 + padAt.x * 0.13 + padAt.z * 0.07)
            + 0.02 * sin(uTime * 0.53 + padAt.z * 0.19);
          transformed.xz = mat2(cos(padTurn), -sin(padTurn), sin(padTurn), cos(padTurn)) * transformed.xz;
        #endif`);
    // The underside of a water-lily leaf is maroon, and it shows wherever the
    // rim turns up.
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.07, 0.018, 0.02);`)
      // What the wax reflects is the night, not the scene environment's
      // lamplit average: at full strength it silvered every leaf in the pond
      // (water.js turns the same thing down for the same reason).
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        radiance *= 0.3;`)
      // and the moon's own gloss, which at a graze turned the near leaves blue
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directSpecular *= 0.5;`);
  };
  material.customProgramCacheKey = () => 'babel-lilypad';
  return { shapes, material, geometries: shapes.map(padGeometry), textures: Object.values(maps) };
}

// ── Flowers ───────────────────────────────────────────────────────────────────
// Built as a grower would count them: sepals, three whorls of petals, stamens,
// the stigma's cup. One unit is the open flower's radius.
const colour = (hex) => new THREE.Color(hex);

function petal(B, { a, r0 = 0.1, y0 = 0.02, len, wid, lift, bend, cup = 0.3, c0, c1, NU = 7, NV = 4 }) {
  const start = B.pos.length / 3;
  const radial = [Math.cos(a), Math.sin(a)], tang = [-Math.sin(a), Math.cos(a)];
  // the centreline, rising more steeply as it goes (bend: how much more, in radians)
  let along = r0, up = y0;
  const line = [];
  for (let i = 0; i <= NU; i++) {
    const s = i / NU, e = lift + bend * s;
    line.push({ along, up, e, s });
    along += (Math.cos(e) * len) / NU;
    up += (Math.sin(e) * len) / NU;
  }
  const tmp = new THREE.Color();
  for (const { along: ra, up: uy, e, s } of line) {
    // widest a little past the middle, pointed at the tip, narrow at the foot
    const w = wid * Math.sin(Math.PI * Math.min(1, 0.05 + 0.95 * s ** 0.9)) ** 0.75;
    tmp.copy(c0).lerp(c1, s ** 1.3);
    for (let j = 0; j <= NV; j++) {
      const v = (j / NV) * 2 - 1;
      // cupped: the edges rise off the petal's own plane
      const lift2 = cup * v * v * w;
      const rad = ra - Math.sin(e) * lift2, y = uy + Math.cos(e) * lift2;
      B.pos.push(radial[0] * rad + tang[0] * v * w, y, radial[1] * rad + tang[1] * v * w);
      B.col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const p = start + i * (NV + 1) + j, q = p + NV + 1;
      B.idx.push(p, p + 1, q, p + 1, q + 1, q);
    }
  }
}

const finish = (B) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
  g.setIndex(B.idx);
  g.computeVertexNormals();
  return g;
};

const SCHEMES = {
  // Nymphaea alba: cream at the foot of the petal, white by the tip
  white: { foot: '#d8d2a8', tip: '#efece4', inner: '#e8e2cc' },
  // a pink hardy hybrid: pale at the foot, rose at the tip
  pink: { foot: '#ead2d2', tip: '#c9738d', inner: '#e3b4c0' },
};

export function lilyFlowerGeometry(scheme = 'white', seed = 5) {
  const rnd = makeRng(seed), jit = (x) => x * (1 + (rnd() - 0.5) * 0.14);
  const S = SCHEMES[scheme];
  const B = { pos: [], col: [], idx: [] };
  const sepal = [colour('#4a5a33'), colour('#6e6a4c')];
  for (let k = 0; k < 4; k++) {
    petal(B, { a: (k / 4) * TAU + 0.3, len: jit(0.92), wid: 0.3, lift: 0.1, bend: 0.12, cup: 0.25, c0: sepal[0], c1: sepal[1] });
  }
  const whorls = [
    { n: 8, len: 1.0, wid: 0.29, lift: 0.3, bend: 0.2, off: 0.1 },
    { n: 8, len: 0.9, wid: 0.27, lift: 0.62, bend: 0.2, off: 0.49 },
    { n: 8, len: 0.78, wid: 0.24, lift: 0.95, bend: 0.14, off: 0.1 },
    { n: 6, len: 0.6, wid: 0.2, lift: 1.2, bend: 0.06, off: 0.6 },
  ];
  whorls.forEach((w, i) => {
    const c0 = colour(i < 2 ? S.foot : S.inner), c1 = colour(i < 3 ? S.tip : S.inner);
    for (let k = 0; k < w.n; k++) {
      petal(B, {
        a: ((k + w.off + (rnd() - 0.5) * 0.25) / w.n) * TAU, r0: 0.09 - i * 0.012, y0: 0.03 + i * 0.03,
        len: jit(w.len), wid: jit(w.wid), lift: w.lift + (rnd() - 0.5) * 0.12, bend: w.bend, cup: 0.35, c0, c1,
      });
    }
  });
  // stamens: a crown of flattened gold straps
  const gold = [colour('#e0a92c'), colour('#f2cf5a')];
  for (let k = 0; k < 30; k++) {
    petal(B, {
      a: (k / 30) * TAU + rnd() * 0.2, r0: 0.09 + (k % 2) * 0.03, y0: 0.08, len: 0.2 + rnd() * 0.08, wid: 0.028,
      lift: 1.2 + rnd() * 0.2, bend: 0.25, cup: 0, c0: gold[0], c1: gold[1], NU: 3, NV: 1,
    });
  }
  // and the stigma, a shallow gold cup inside them
  const base = B.pos.length / 3, cupC = colour('#d9b24a');
  B.pos.push(0, 0.1, 0);
  B.col.push(cupC.r, cupC.g, cupC.b);
  for (let k = 0; k < 14; k++) {
    const q = (k / 14) * TAU;
    B.pos.push(Math.cos(q) * 0.1, 0.14, Math.sin(q) * 0.1);
    B.col.push(cupC.r, cupC.g, cupC.b);
  }
  for (let k = 0; k < 14; k++) B.idx.push(base, base + 1 + ((k + 1) % 14), base + 1 + k);
  return finish(B);
}

// A bud: the sepals clasping five petals that close to a point over the heart.
export function lilyBudGeometry(scheme = 'pink', seed = 9) {
  const rnd = makeRng(seed);
  const S = SCHEMES[scheme];
  const B = { pos: [], col: [], idx: [] };
  const sepal = [colour('#46542f'), colour('#5d5a3e')];
  for (let k = 0; k < 5; k++) {
    petal(B, { a: (k / 5) * TAU + 0.5, r0: 0.05, y0: 0, len: 1.2, wid: 0.3, lift: 1.4, bend: 0.5, cup: 0.55, c0: colour(S.foot), c1: colour(S.tip) });
  }
  for (let k = 0; k < 4; k++) {
    petal(B, { a: (k / 4) * TAU + rnd() * 0.3, r0: 0.07, y0: 0, len: 1.05, wid: 0.34, lift: 1.34, bend: 0.46, cup: 0.55, c0: sepal[0], c1: sepal[1] });
  }
  return finish(B);
}

export function makeFlowerMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide });
  // A petal is thin: lamp light comes through it as well as off it, and in the
  // dark a pale flower still reads as a pale shape rather than going out.
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * 0.035;`);
  };
  m.customProgramCacheKey = () => 'babel-lilyflower';
  return m;
}

// ── Koi ───────────────────────────────────────────────────────────────────────
// Varieties, in the order the shader knows them by.
export const KOI = { kohaku: 0, sanke: 1, showa: 2, tancho: 3, yamabuki: 4, platinum: 5, orenji: 6, chagoi: 7, asagi: 8 };

// One fish one unit long, in its own frame: x from the nose (0) to the tip of
// the tail (1), y up, z to its side. `part`: 0 body, 1 tail, 2 pectoral fin,
// 3 dorsal fin; `fin`: along the fin from its root (0-1) and across it (-1-1).
function koiTemplate() {
  const pos = [], nrm = [], part = [], idx = [];
  const put = (p, n, k, a = 0, b = 0, s = 0) => { pos.push(...p); nrm.push(...n); part.push(k, a, b, s); return pos.length / 3 - 1; };

  // The body: blunt round head, broadest a quarter of the way back, tapering
  // to the wrist of the tail. Half-width, and half-height above and below.
  const END = 0.8;
  const prof = (u) => (u < 0.26 ? Math.sqrt(Math.max(0, 1 - ((0.26 - u) / 0.26) ** 2)) : 1 - 0.8 * ((u - 0.26) / (END - 0.26)) ** 1.45);
  const half = (u) => [0.1 * prof(u), 0.108 * prof(u), 0.094 * prof(u)];
  const mid = (u) => -0.018 * Math.max(0, 1 - u / 0.14) ** 2;   // the mouth sits low
  const NU = 34, NP = 18;
  const station = (i) => 0.004 + (END - 0.004) * (i / NU) ** 1.2;
  const nose = put([0, mid(0), 0], [-1, 0, 0], 0);
  for (let i = 0; i <= NU; i++) {
    const u = station(i), [w, hu, hl] = half(u), y0 = mid(u);
    for (let j = 0; j < NP; j++) {
      const f = (j / NP) * TAU, c = Math.cos(f), s = Math.sin(f);
      // fuller in the flank than an ellipse: a koi is a broad-backed fish
      put([u, y0 + (s >= 0 ? hu : hl) * s, w * Math.sign(c) * Math.abs(c) ** 0.85], [0, 0, 0], 0);
    }
  }
  const ring = (i, j) => nose + 1 + i * NP + (j % NP);
  for (let j = 0; j < NP; j++) idx.push(nose, ring(0, j), ring(0, j + 1));
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NP; j++) idx.push(ring(i, j), ring(i + 1, j), ring(i, j + 1), ring(i, j + 1), ring(i + 1, j), ring(i + 1, j + 1));
  }
  const tail = put([END + 0.006, mid(END), 0], [1, 0, 0], 0);
  for (let j = 0; j < NP; j++) idx.push(tail, ring(NU, j + 1), ring(NU, j));
  // smooth normals for the body alone, before the fins are added
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const n = g.attributes.normal.array;
    for (let i = 0; i < n.length; i++) nrm[i] = n[i];
    g.dispose();
  }
  const bodyEnd = pos.length / 3;

  const sheet = (NA, NB, at, normal, k) => {
    const start = pos.length / 3;
    for (let i = 0; i <= NA; i++) {
      for (let j = 0; j <= NB; j++) {
        const a = i / NA, b = (j / NB) * 2 - 1, [p, extra] = at(a, b);
        put(p, normal(a, b), k, a, b, extra ?? 0);
      }
    }
    for (let i = 0; i < NA; i++) {
      for (let j = 0; j < NB; j++) {
        const p = start + i * (NB + 1) + j, q = p + NB + 1;
        idx.push(p, q, p + 1, p + 1, q, q + 1);
      }
    }
  };
  // The tail: a vertical fan, forked, the lobes rounded.
  sheet(7, 10, (a, b) => {
    const reach = 0.24 - 0.075 * (1 - Math.abs(b)) ** 1.6;
    const hgt = 0.032 + (0.125 - 0.032) * a ** 0.8;
    return [[0.76 + a * reach, mid(0.8) + b * hgt * (1 - 0.1 * a * a), 0]];
  }, () => [0, 0, 1], 1);
  // The dorsal fin along the back, tallest at its front.
  sheet(8, 2, (a, b) => {
    const u = 0.3 + a * 0.3, up = (b + 1) / 2, [, hu] = half(u);
    const tall = 0.07 * (1 - 0.55 * a) * Math.min(1, a / 0.08 + 0.15);
    return [[u + 0.035 * up, mid(u) + hu - 0.004 + up * tall, 0]];
  }, () => [0, 0, 1], 3);
  // The pectoral fins: rounded paddles low on the flanks behind the head,
  // swept back and out and drooping a little at the tip.
  for (const s of [-1, 1]) {
    const u0 = 0.19, [w0, , hl0] = half(u0);
    const root = [u0, mid(u0) - hl0 * 0.4, s * w0 * 0.82];
    const back = Math.cos(0.95), out = Math.sin(0.95);
    const dir = new THREE.Vector3(back, -0.2, s * out).normalize();
    const across = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const n = new THREE.Vector3().crossVectors(across, dir).normalize();
    if (n.y < 0) n.negate();
    sheet(6, 4, (a, b) => {
      const w = 0.058 * Math.sqrt(Math.max(0, 1 - ((a - 0.5) / 0.53) ** 2)) * (a < 0.15 ? 0.55 + a * 3 : 1);
      return [[
        root[0] + dir.x * a * 0.17 + across.x * b * w,
        root[1] + dir.y * a * 0.17 + across.y * b * w - 0.02 * a * a,
        root[2] + dir.z * a * 0.17 + across.z * b * w,
      ], s];
    }, () => [n.x, n.y, n.z], 2);
  }
  return { pos, nrm, part, idx, bodyEnd };
}

// `pond`: { c, rx, rz }; `clear(p)`: may a fish's path cross point p ([x, z]);
// `time`: the world's clock ({ value }); `gather`: where people stand over the
// water ([x, z]) — koi learn where they are fed, and two of them keep near it.
export function makeKoi({ pond, clear, time, gather = null, seed = 2718 }) {
  const rnd = makeRng(seed), rr = (a, b) => a + (b - a) * rnd();
  // Twelve fish, the proportions a garden pond has: mostly kohaku and sanke.
  const kinds = ['kohaku', 'kohaku', 'sanke', 'showa', 'kohaku', 'yamabuki', 'sanke', 'chagoi', 'tancho', 'platinum', 'asagi', 'orenji'];
  const fish = [];
  kinds.forEach((kind, n) => {
    // A third of them keep to one patch of water; the rest go round the Pavilion.
    const loiter = n % 3 === 2;
    for (let tries = 0; tries < 600; tries++) {
      let cx, cz, ax, az;
      if (loiter && gather && n < 6) {
        const a = rr(0, TAU), d = rr(16, 40);
        cx = gather[0] + Math.cos(a) * d;
        cz = gather[1] + Math.sin(a) * d;
        ax = rr(8, 16);
        az = ax * rr(0.55, 1);
      } else if (loiter) {
        cx = pond.c[0] + rr(-0.8, 0.8) * pond.rx;
        cz = pond.c[1] + rr(-0.8, 0.8) * pond.rz;
        ax = rr(8, 18);
        az = ax * rr(0.55, 1);
      } else {
        cx = pond.c[0] + rr(-6, 6);
        cz = pond.c[1] + rr(-6, 6);
        const rho = rr(0.62, 0.78);
        ax = pond.rx * rho;
        az = pond.rz * rho;
      }
      const b1 = rr(0, 0.12), p1 = rr(0, TAU), b2 = rr(0, 0.07), p2 = rr(0, TAU);
      const path = (th) => {
        const r = 1 + b1 * Math.sin(2 * th + p1) + b2 * Math.sin(3 * th + p2);
        return [cx + Math.cos(th) * ax * r, cz + Math.sin(th) * az * r];
      };
      let ok = true;
      for (let k = 0; k < 120 && ok; k++) ok = clear(path((k / 120) * TAU));
      if (!ok) continue;
      // A unit is 9.4 cm: these cruise at 12 to 26 cm a second, and a big old
      // chagoi is near a metre long.
      const L = kind === 'chagoi' ? rr(9.6, 10.8) : rr(6.6, 9.4);
      const v = rr(1.3, 2.8) * (loiter ? 0.6 : 1);
      const om = v / ((ax + az) / 2);
      // and not at a constant speed: it swims, then glides (0.3 to 1.7 of it)
      const beta = rr(0.1, 0.26);
      const top = 0.13 * L + 0.25;
      const depth = rr(top + 0.6, top + 3.2);
      fish.push({
        kind: KOI[kind], path,
        pathA: [cx, cz, ax, az], pathB: [b1, p1, b2, p2],
        swim: [rr(0, TAU), om * (rnd() < 0.5 ? -1 : 1), (0.7 * om) / beta, beta],
        body: [L, depth, rr(0.15, Math.min(1.2, depth - top)), rnd()],
        look: [KOI[kind], rr(0.75, 1.2), rr(0, TAU), rr(0.03, 0.08)],
      });
      break;
    }
  });

  const T = koiTemplate();
  const nv = T.pos.length / 3;
  const pos = [], nrm = [], part = [], idx = [];
  const per = { aPathA: [], aPathB: [], aSwim: [], aFish: [], aLook: [] };
  fish.forEach((f, k) => {
    pos.push(...T.pos);
    nrm.push(...T.nrm);
    part.push(...T.part);
    T.idx.forEach((i) => idx.push(i + k * nv));
    for (let i = 0; i < nv; i++) {
      per.aPathA.push(...f.pathA);
      per.aPathB.push(...f.pathB);
      per.aSwim.push(...f.swim);
      per.aFish.push(...f.body);
      per.aLook.push(...f.look);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aKoi', new THREE.Float32BufferAttribute(part, 4));
  for (const [name, data] of Object.entries(per)) g.setAttribute(name, new THREE.Float32BufferAttribute(data, 4));
  g.setIndex(idx);
  // The vertices are placed in the shader; what the pond can hold is the bound.
  const reach = Math.max(pond.rx, pond.rz) + 12;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(pond.c[0], WATER_Y, pond.c[1]), reach);
  g.boundingBox = new THREE.Box3(
    new THREE.Vector3(pond.c[0] - pond.rx - 12, WATER_Y - 6, pond.c[1] - pond.rz - 12),
    new THREE.Vector3(pond.c[0] + pond.rx + 12, WATER_Y + 1, pond.c[1] + pond.rz + 12),
  );

  const uniforms = { uKoiTime: time, uWaterY: { value: WATER_Y }, uKoiEnv: { value: 0.35 }, uKoiCover: { value: 0.6 } };
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff', roughness: 0.42, metalness: 0,
    side: THREE.DoubleSide, transparent: true, depthWrite: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform float uKoiTime;
        uniform float uWaterY;
        attribute vec4 aKoi;
        attribute vec4 aPathA;
        attribute vec4 aPathB;
        attribute vec4 aSwim;
        attribute vec4 aFish;
        attribute vec4 aLook;
        varying vec3 vKoiLocal;
        varying vec4 vKoiId;
        varying vec2 vKoiFin;
        varying vec2 vKoiWater;
        // Where round its loop a fish is, at angle th.
        vec2 koiPath(float th) {
          float r = 1.0 + aPathB.x * sin(2.0 * th + aPathB.y) + aPathB.z * sin(3.0 * th + aPathB.w);
          return aPathA.xy + vec2(cos(th) * aPathA.z, sin(th) * aPathA.w) * r;
        }`)
      .replace('#include <beginnormal_vertex>', /* glsl */ `
        float kT = uKoiTime;
        float kDir = aSwim.y < 0.0 ? -1.0 : 1.0;
        float kOm = abs(aSwim.y);
        // how far round the head is, and how hard the fish is swimming there
        float kTh = aSwim.x + kDir * (kOm * kT + aSwim.z * sin(aSwim.w * kT + aLook.z));
        float kRate = kOm + aSwim.z * aSwim.w * cos(aSwim.w * kT + aLook.z);
        float kSpeed = clamp(kRate / (kOm + aSwim.z * aSwim.w), 0.0, 1.0);
        float kL = aFish.x;
        float kPer = length(koiPath(kTh + 0.02) - koiPath(kTh)) / 0.02;
        vec3 kPos = position;
        // the pectorals spread when the fish hangs in the water and fold back as it goes
        if (aKoi.x > 1.5 && aKoi.x < 2.5) {
          kPos.z *= 1.0 - 0.35 * kSpeed * aKoi.y;
          kPos.y += aKoi.y * 0.045 * sin(4.4 * kT + aLook.z * 3.0 + aKoi.w) * (1.15 - kSpeed);
        }
        // Every station along the body follows the head down the same path,
        // so the fish bends to the curve it swims.
        float kU = clamp(kPos.x, 0.0, 1.0);
        float kThU = kTh - kDir * kU * kL / max(kPer, 0.5);
        vec2 kP = koiPath(kThU);
        vec2 kTan = normalize(koiPath(kThU + 0.01 * kDir) - koiPath(kThU - 0.01 * kDir) + vec2(1e-6, 0.0));
        vec2 kSide0 = vec2(-kTan.y, kTan.x);
        // and a wave runs down it to the tail, small when it glides
        float kAmp = mix(0.3, 1.0, kSpeed);
        float kEnv = 0.016 + 0.1 * kU * kU;
        float kPh = 6.2832 * (kU / 0.95 - aLook.y * kT) + aLook.z;
        float kLat = kAmp * kEnv * sin(kPh);
        float kSlope = kAmp * (0.2 * kU * sin(kPh) + kEnv * cos(kPh) * 6.2832 / 0.95);
        vec2 kBack = normalize(-kTan + kSide0 * kSlope);
        vec3 kBack3 = vec3(kBack.x, 0.0, kBack.y), kSide3 = vec3(-kBack.y, 0.0, kBack.x);
        float kDepth = aFish.y + aFish.z * sin(aLook.w * kT + aFish.w * 6.2832);
        vec3 kWorld = vec3(kP.x, uWaterY - kDepth, kP.y)
          + vec3(kSide0.x, 0.0, kSide0.y) * kLat * kL + kSide3 * kPos.z * kL + vec3(0.0, kPos.y * kL, 0.0);
        vec3 objectNormal = normalize(kBack3 * normal.x + vec3(0.0, normal.y, 0.0) + kSide3 * normal.z);`)
      .replace('#include <begin_vertex>', /* glsl */ `
        // Seen from above the water, the fish is carried up the eye's ray to
        // the surface: the same picture, drawn where the water cannot cover it.
        vec3 transformed = kWorld;
        vKoiWater = vec2(0.0);
        if (cameraPosition.y > uWaterY + 0.05) {
          // refraction lifts it: under water a thing looks 3/4 as deep as it is
          vec3 kApp = vec3(kWorld.x, uWaterY - max(uWaterY - kWorld.y, 0.0) * 0.75, kWorld.z);
          vec3 kRay = kApp - cameraPosition;
          float kCross = clamp((uWaterY - cameraPosition.y) / min(kRay.y, -1e-4), 0.0, 1.0);
          vec3 kDirN = normalize(kRay);
          float kUnder = length(kRay) * (1.0 - kCross);
          float kCos = clamp(-kDirN.y, 0.05, 1.0);
          // held a hair over the surface — higher the less water is in front
          // of it, so the fish's own parts still sort — and always under a pad
          float kLift = 0.004 + 0.09 * exp(-kUnder / 3.5);
          transformed = cameraPosition + kRay * kCross - kDirN * (kLift / kCos);
          vKoiWater = vec2(kUnder, 0.02 + 0.98 * pow(1.0 - kCos, 5.0));
        }
        vKoiLocal = kPos;
        vKoiId = vec4(aLook.x, aFish.w, aKoi.x, 0.0);
        vKoiFin = aKoi.yz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform float uKoiEnv;
        uniform float uKoiCover;
        varying vec3 vKoiLocal;
        varying vec4 vKoiId;
        varying vec2 vKoiFin;
        varying vec2 vKoiWater;
        float kHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float kNoise(vec3 x) {
          vec3 i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(kHash(i), kHash(i + vec3(1, 0, 0)), f.x), mix(kHash(i + vec3(0, 1, 0)), kHash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(kHash(i + vec3(0, 0, 1)), kHash(i + vec3(1, 0, 1)), f.x), mix(kHash(i + vec3(0, 1, 1)), kHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }
        float kFbm(vec3 p) { return 0.55 * kNoise(p) + 0.3 * kNoise(p * 2.03 + 11.0) + 0.15 * kNoise(p * 4.1 + 23.0); }`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        float kPart = vKoiId.z;
        // the inside of the body is never seen
        if (kPart < 0.5 && !gl_FrontFacing) discard;
        int kKind = int(vKoiId.x + 0.5);
        vec3 kL = vKoiLocal;
        vec3 kQ = vec3(kL.x * 5.2, kL.y * 11.0, kL.z * 11.0) + vKoiId.y * 37.0;
        float kN1 = kFbm(kQ), kN2 = kFbm(kQ * 1.9 + 17.3), kN3 = kFbm(kQ * 2.7 + 41.7);
        // the pattern is on the back and flanks; the belly is pale
        float kUpper = smoothstep(-0.05, -0.005, kL.y + (kN2 - 0.5) * 0.05);
        float kHead = 1.0 - smoothstep(0.13, 0.22, kL.x);
        const vec3 SHIRO = vec3(0.80, 0.77, 0.69);
        const vec3 HI = vec3(0.72, 0.075, 0.012);
        const vec3 SUMI = vec3(0.008, 0.008, 0.01);
        vec3 kCol = SHIRO;
        float kMetal = 0.0, kRough = 0.4;
        float kRed = smoothstep(0.5, 0.53, kN1 + kHead * 0.1) * kUpper;
        if (kKind == 0) {
          kCol = mix(SHIRO, HI, kRed);
        } else if (kKind == 1) {
          kCol = mix(SHIRO, HI, kRed);
          kCol = mix(kCol, SUMI, smoothstep(0.64, 0.66, kN3) * kUpper * step(0.2, kL.x));
        } else if (kKind == 2) {
          kCol = mix(SUMI, SHIRO, smoothstep(0.5, 0.53, kN2 + (1.0 - kUpper) * 0.06));
          kCol = mix(kCol, HI, smoothstep(0.52, 0.55, kN1 + kHead * 0.12) * kUpper);
        } else if (kKind == 3) {
          float d = length(vec2(kL.x - 0.125, kL.z * 1.1));
          kCol = mix(SHIRO, HI, (1.0 - smoothstep(0.05, 0.056, d)) * smoothstep(0.0, 0.02, kL.y));
        } else if (kKind == 4) {
          kCol = vec3(0.86, 0.46, 0.05); kMetal = 0.75; kRough = 0.3;
        } else if (kKind == 5) {
          kCol = vec3(0.72, 0.71, 0.66); kMetal = 0.75; kRough = 0.3;
        } else if (kKind == 6) {
          kCol = vec3(0.9, 0.22, 0.015); kMetal = 0.6; kRough = 0.32;
        } else if (kKind == 7) {
          kCol = mix(vec3(0.2, 0.1, 0.032), vec3(0.3, 0.17, 0.06), kN2);
        } else {
          kCol = mix(vec3(0.15, 0.2, 0.25), HI * 0.85, (1.0 - kUpper) * smoothstep(0.08, 0.3, kL.x));
        }
        kCol = mix(kCol, kCol * 0.5 + SHIRO * 0.45, (1.0 - smoothstep(-0.075, -0.035, kL.y)) * (kKind == 2 ? 0.3 : 0.6));
        float kAlpha = 1.0;
        if (kPart < 0.5) {
          // scales, in offset rows; the net of an asagi or chagoi is its edges
          if (kL.x > 0.17 && kL.x < 0.8) {
            vec2 sc = vec2(kL.x * 40.0, atan(kL.y, kL.z) * 3.5);
            sc.y += 0.5 * mod(floor(sc.x), 2.0);
            float edge = smoothstep(0.3, 0.52, length(fract(sc) - vec2(0.35, 0.5)));
            float net = (kKind == 7 || kKind == 8) ? -0.4 : (kMetal > 0.0 ? -0.25 : 0.07);
            kCol *= 1.0 - net * edge * smoothstep(0.17, 0.26, kL.x);
          }
          // an eye on each side of the head
          float e = length(vec2(kL.x - 0.068, (kL.y - 0.012) * 1.1));
          float side = step(0.018, abs(kL.z));
          float pupil = (1.0 - smoothstep(0.0085, 0.0105, e)) * side;
          float iris = (1.0 - smoothstep(0.0125, 0.0145, e)) * side - pupil;
          kCol = mix(kCol, vec3(0.45, 0.33, 0.16), iris * 0.8);
          kCol = mix(kCol, vec3(0.004), pupil);
          kRough = mix(kRough, 0.12, pupil + iris);
        } else {
          // fins: thin membrane on rays, clearer toward the edge
          vec3 fin = SHIRO * 0.95;
          if (kKind == 2) fin = mix(SUMI, SHIRO, smoothstep(0.15, 0.6, vKoiFin.x));
          else if (kKind == 4) fin = vec3(0.86, 0.5, 0.07);
          else if (kKind == 5) fin = vec3(0.7, 0.7, 0.66);
          else if (kKind == 6) fin = vec3(0.9, 0.26, 0.02);
          else if (kKind == 7) fin = vec3(0.2, 0.1, 0.035);
          else if (kKind == 8) fin = mix(HI * 0.85, SHIRO, 0.35);
          else if (kPart > 0.5 && kPart < 1.5) fin = mix(fin, HI, (1.0 - smoothstep(0.0, 0.25, vKoiFin.x)) * kRed);
          kCol = fin * (0.8 + 0.2 * cos(vKoiFin.y * 26.0));
          kAlpha = mix(0.85, 0.4, vKoiFin.x) * (1.0 - 0.75 * smoothstep(0.86, 1.0, vKoiFin.x));
          kMetal *= 0.5;
          kRough = 0.5;
        }
        diffuseColor.rgb = kCol;
        diffuseColor.a = kAlpha;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = kRough;`)
      // A fin is a membrane lit from whichever side the eye is on.
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (kPart > 0.5 && dot(normal, vViewPosition) < 0.0) normal = -normal;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = kMetal;`)
      // Under water the sky's light is mostly gone (see water.js on why the
      // scene environment is turned down where it lands rather than on the material).
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        radiance *= uKoiEnv;
        iblIrradiance *= uKoiEnv;`)
      .replace('#include <opaque_fragment>', /* glsl */ `#include <opaque_fragment>
        // The water it is seen through: pond water is tea and algae, not the
        // sea — it takes the blue first, and a white fish goes to old ivory —
        // then the fish itself; and at a graze the surface gives back the sky.
        gl_FragColor.rgb *= exp(-vKoiWater.x * vec3(0.15, 0.13, 0.27));
        float kSeen = exp(-vKoiWater.x * 0.16) * (1.0 - vKoiWater.y);
        // the outline goes soft first, and the deeper the softer
        if (kPart < 0.5) kSeen *= smoothstep(0.0, 0.2 + 0.03 * vKoiWater.x, abs(dot(normal, normalize(vViewPosition))));
        gl_FragColor.a = clamp(kAlpha * kSeen, 0.0, 1.0);`)
      // Premultiplied (after the fog), and covering only part of what is
      // behind: what lies behind is the water's surface — the lamps and the far
      // bank mirrored in it — and a fish under the surface does not hide that.
      .replace('#include <premultiplied_alpha_fragment>', `
        gl_FragColor = vec4(gl_FragColor.rgb * gl_FragColor.a, gl_FragColor.a * uKoiCover);`);
  };
  material.customProgramCacheKey = () => 'babel-koi';

  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'koi';
  // after the water, which they are drawn over (water.js is renderOrder 2)
  mesh.renderOrder = 3;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  // The geometry at the origin is a template, not where the fish are: nothing
  // should ever find them there (probe.js, the wall check).
  mesh.raycast = () => {};

  // DEV and harnesses: where each fish's head is at time t (the shader's sums).
  const where = (t = time.value) => fish.map((f) => {
    const [th0, om, a, b] = f.swim;
    const dir = Math.sign(om);
    const th = th0 + dir * (Math.abs(om) * t + a * Math.sin(b * t + f.look[2]));
    const [x, z] = f.path(th);
    return { kind: Object.keys(KOI)[f.kind], x: +x.toFixed(1), z: +z.toFixed(1), L: +f.body[0].toFixed(1) };
  });
  mesh.userData.where = where;
  mesh.userData.clock = time;
  return { mesh, material, geometry: g, count: fish.length, where };
}
