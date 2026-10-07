// ── What came down with the Door's wall ─────────────────────────────────────
// 2026-10-07 the reader, of the stones lying round the cracks in the Door's
// pavement: "make them more realistic". They were the cheapest things in the
// room:
//   - the six blocks were boxes, one face dented by a sine, the pale ashlar
//     projected over them in world units, so a single fallen stone carried
//     the joints of a little wall across its faces; set at a tilt with their
//     middles at 0.4 of their height, they hung over the floor or went into it;
//   - every smaller stone was the same twenty-faced icosahedron, turned every
//     way at random, so they stood on their points like dark cut gems, one size
//     and evenly spread.
// A first answer (the same day) made each block one chipped stone and each
// small stone its own plane-cut polyhedron, and the reader: "I do not think
// they look realistic at all." Rightly: flat faces of one tone under a moon
// fill that lit every face alike, nothing dark in a chip or where two stones
// touch, gems of flat facets, and every stone a prop set down on a swept floor.
// So, as stone is:
//   - its SURFACE (`rubbleStone`, laid on triplanar by the material): sand
//     grain, shell, the pits and vugs weather opens, hairline veins and rust,
//     in the relief as much as in the colour, so the light finds it;
//   - a block's faces are not planes but weathered — undulating, worn round
//     along some lengths of arris and sharp along others, spalled where it
//     struck (a flake off an edge, a corner knocked off), lime still crusted
//     on its beds; the room's face smoked, the garden's streaked; the two
//     longest broke, rough and pale along the break, and the piece lies by;
//   - a smaller stone is a ROCK: a box softened and cut by the planes it broke
//     along, rough over them, lying on its broadest break;
//   - each is shaded as light finds it: dark in its hollows and pale on its
//     worn edges (from the mesh's own curvature), dark at its foot and where a
//     block stands over it, dust on whatever faces up — and the moon's fill
//     comes in through the breach, not from everywhere at once;
//   - they lie as a collapse leaves them: the blocks in their own debris, small
//     stone heaped against their feet and run under their edges, spalls off
//     the broken ends, a carpet of it thrown in through the breach, the floor
//     round all of it greyed with grit and dust (cracks.js paints that, from
//     this same layout).
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng, normalsFrom, toTexture } from './textures';

export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Value noise, smooth, in three dimensions: the stone's clouding, the lime
// left on a bed, the relief of a break.
const hash = (i, j, k, s) => {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(k, 0x1b873593) ^ Math.imul(s, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};
const fade = (t) => t * t * (3 - 2 * t);
export const noise = (x, y, z, s) => {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const u = fade(x - i), v = fade(y - j), w = fade(z - k);
  const L = (a, b, t) => a + (b - a) * t;
  return L(
    L(L(hash(i, j, k, s), hash(i + 1, j, k, s), u), L(hash(i, j + 1, k, s), hash(i + 1, j + 1, k, s), u), v),
    L(L(hash(i, j, k + 1, s), hash(i + 1, j, k + 1, s), u), L(hash(i, j + 1, k + 1, s), hash(i + 1, j + 1, k + 1, s), u), v),
    w,
  );
};
export const fbm = (x, y, z, s, octaves = 3) => {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * f, y * f, z * f, s + o * 31);
    norm += amp;
    amp *= 0.5;
    f *= 2.07;
  }
  return sum / norm;
};

// ── The stone's surface ──────────────────────────────────────────────────────
// Units of the world to a repeat of it (six: 56 cm), as the material lays it.
export const RUBBLE_TILE = 6;
const canvas = (w, h = w) => {
  const c = typeof document === 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
};
// Weathered oolite, as a block that stood in a wall for centuries and then
// fell is: the colour of it is in each stone's vertices; this is its grain.
// Painted into the relief as strongly as into the colour (a pit is dark AND
// low), so a lamp or the moon raking across a face finds it.
export function rubbleStone({ size = 1024, seed = 83 } = {}) {
  const rnd = makeRng(seed);
  const R = (lo, hi) => lo + (hi - lo) * rnd();
  const [col, c] = canvas(size);
  const [hei, hg] = canvas(size);
  const [rou, rg] = canvas(size);
  c.fillStyle = 'rgb(170,164,152)';
  c.fillRect(0, 0, size, size);
  hg.fillStyle = 'rgb(128,128,128)';
  hg.fillRect(0, 0, size, size);
  rg.fillStyle = 'rgb(222,222,222)';
  rg.fillRect(0, 0, size, size);
  // anything round drawn again across each seam it crosses, so the canvas tiles
  const tiled = (x, y, r, paint) => {
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        if (x + dx + r < 0 || x + dx - r > size || y + dy + r < 0 || y + dy - r > size) continue;
        paint(x + dx, y + dy);
      }
    }
  };
  const blot = (g, x, y, r, inner) => tiled(x, y, r, (px, py) => {
    const b = g.createRadialGradient(px, py, 0, px, py, r);
    b.addColorStop(0, inner);
    b.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = b;
    g.fillRect(px - r, py - r, r * 2, r * 2);
  });
  // Its clouding, broad and faint, and a face that is not flat under it.
  // (Blots from ten centimetres up at a tenth of the tone were camouflage:
  // the stone's own tone changes slowly, and its grain does the rest.)
  for (let k = 0; k < 120; k++) {
    const r = size * (0.06 + rnd() ** 2 * 0.22), x = rnd() * size, y = rnd() * size, up = rnd() < 0.45, a = R(0.02, 0.045);
    blot(c, x, y, r, up ? `rgba(228,218,198,${a})` : `rgba(46,40,32,${a * 1.2})`);
    blot(hg, x, y, r, up ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  }
  // where iron in the bed has wept
  for (let k = 0; k < 12; k++) blot(c, rnd() * size, rnd() * size, size * R(0.02, 0.07), `rgba(150,104,60,${R(0.04, 0.09)})`);
  // the sand it is made of
  for (let k = 0; k < 110000; k++) {
    const x = rnd() * size, y = rnd() * size, s = 1 + rnd() * 1.5, up = rnd() < 0.5, a = R(0.04, 0.14);
    c.fillStyle = up ? `rgba(238,230,214,${a})` : `rgba(30,26,20,${a})`;
    c.fillRect(x, y, s, s);
    hg.fillStyle = up ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    hg.fillRect(x, y, s, s);
  }
  // shell: the pale crescents that say oolite and not concrete
  for (let k = 0; k < 1100; k++) {
    const x = rnd() * size, y = rnd() * size, r = 0.8 + rnd() * 2.8, a0 = rnd() * 6.28;
    c.strokeStyle = `rgba(234,226,208,${R(0.15, 0.35)})`;
    hg.strokeStyle = 'rgba(255,255,255,0.25)';
    for (const g of [c, hg]) {
      g.lineWidth = 0.6 + rnd() * 0.8;
      g.beginPath();
      g.arc(x, y, r, a0, a0 + 1.4 + rnd() * 2);
      g.stroke();
    }
  }
  const hole = (x, y, r, dark, deep) => {
    c.fillStyle = `rgba(36,30,24,${dark})`;
    hg.fillStyle = `rgba(0,0,0,${deep})`;
    rg.fillStyle = 'rgba(255,255,255,0.6)';
    for (const g of [c, hg, rg]) {
      g.beginPath();
      for (let t = 0; t < 9; t++) {
        const a = (t / 9) * Math.PI * 2, rr = r * (0.65 + 0.5 * rnd());
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.fill();
    }
  };
  // The pits weather opens in a face, and a few ragged vugs: shallow, not
  // dark through (4200 of them, black, read as the holes in concrete).
  for (let k = 0; k < 1500; k++) hole(rnd() * size, rnd() * size, 0.5 + rnd() ** 3 * 2, R(0.1, 0.28), R(0.25, 0.55));
  for (let k = 0; k < 45; k++) {
    const x = R(8, size - 8), y = R(8, size - 8);
    hole(x, y, R(2.5, 6), R(0.22, 0.4), 0.7);
  }
  // the bed it was laid down in, faint bands across it, in its colour and its relief
  for (let y = 0; y < size; y += 2) {
    const v = Math.sin((y / size) * Math.PI * 2 * 5 + 0.7) * 0.5 + Math.sin((y / size) * Math.PI * 2 * 17 + 2.3) * 0.3 + (rnd() - 0.5) * 0.5;
    c.fillStyle = v > 0 ? `rgba(226,214,190,${v * 0.035})` : `rgba(40,34,28,${-v * 0.045})`;
    c.fillRect(0, y, size, 2);
    hg.fillStyle = v > 0 ? `rgba(255,255,255,${v * 0.04})` : `rgba(0,0,0,${-v * 0.04})`;
    hg.fillRect(0, y, size, 2);
  }
  // hairline veins, which a fall opens
  for (let k = 0; k < 24; k++) {
    let x = R(0.15, 0.85) * size, y = R(0.15, 0.85) * size, a = rnd() * 6.28;
    const steps = Math.floor(R(8, 30)), w = R(0.7, 1.3);
    c.strokeStyle = `rgba(40,34,28,${R(0.15, 0.32)})`;
    hg.strokeStyle = 'rgba(0,0,0,0.5)';
    for (const g of [c, hg]) { g.lineWidth = w; g.beginPath(); g.moveTo(x, y); }
    for (let s = 0; s < steps; s++) {
      a += R(-0.5, 0.5);
      x += Math.cos(a) * R(3, 8);
      y += Math.sin(a) * R(3, 8);
      c.lineTo(x, y);
      hg.lineTo(x, y);
    }
    c.stroke();
    hg.stroke();
  }
  return {
    map: toTexture(col),
    normalMap: toTexture(normalsFrom(hei, 2.6), { srgb: false }),
    roughnessMap: toTexture(rou, { srgb: false }),
  };
}

// ── Where it all lies ────────────────────────────────────────────────────────
// `fallen`: the blocks, [along, into, w, h, d] in the breach's frame (buildWorld's
// DOOR_FALLEN). `frame`: { origin, along, into } of that frame in the world.
// Returns the pieces to build — each with its place in the frame (a, b), in the
// world (x, z) and its turn about the vertical there (`theta`, three's) — and
// `rest`, what the crack painter shades the floor round:
// [along, into, half length, half width, turn, how dark, round].
export function rubbleLayout(fallen, { origin, along, into }) {
  const r = makeRng(4406);
  const R = (lo, hi) => lo + (hi - lo) * r();
  // many small, few large
  const pareto = (s0, alpha, max) => Math.min(max, s0 * (1 - r() * 0.995) ** (-1 / alpha));
  const seed = () => Math.floor(r() * 2147483647);
  // Nothing on the footings of the arch, which stand some twenty-four units
  // into the room either side of the opening; nothing big in the way through.
  const onArch = (a, b) => Math.abs(a - 1.5) > 11.5 && b < 25;
  const free = (a, b, size) => !onArch(a, b) && (size < 0.8 || b > 90 || Math.abs(a - 6) > 10 + size)
    && Math.abs(a) < 66 && b > 1 && b < 124;
  // how far (a, b) is outside a block's footprint, 0 inside it
  const outside = (a, b, k) => {
    const c = Math.cos(k.phi), s = Math.sin(k.phi), da = a - k.a, db = b - k.b;
    return Math.hypot(Math.max(0, Math.abs(da * c + db * s) - k.w / 2), Math.max(0, Math.abs(-da * s + db * c) - k.across / 2));
  };
  const frameAngle = Math.atan2(along[1], along[0]);
  const world = (it) => Object.assign(it, {
    x: origin[0] + along[0] * it.a + into[0] * it.b,
    z: origin[1] + along[1] * it.a + into[1] * it.b,
    theta: -(frameAngle + it.phi),
  });
  // a point given in a block's own frame (u along its length, v across), in the breach's
  const fromBlock = (k, u, v) => [k.a + u * Math.cos(k.phi) - v * Math.sin(k.phi), k.b + u * Math.sin(k.phi) + v * Math.cos(k.phi)];
  // how far out from a block's middle its side is, along `psi` in its own frame
  const edgeAt = (k, cu, sv) => 1 / Math.max(Math.abs(cu) / (k.w / 2), Math.abs(sv) / (k.across / 2));

  // ── the blocks
  const blocks = [];
  const stones = [];
  // (what is big on the floor, [along, into, across], for the stones to lie beside)
  const big = [];
  const block = (o) => {
    const k = { tilt: [R(-0.035, 0.035), R(-0.03, 0.03)], end: 0, sink: R(0.12, 0.3), tone: R(0.9, 1.08), seed: seed(), ...o };
    k.across = k.d;
    blocks.push(world(k));
    return k;
  };
  fallen.forEach(([a, b, w, h, d0], i) => {
    const phi = R(0, Math.PI * 2);
    // (a block's bed four-fifths of DOOR_FALLEN's: at its full depth every
    // one of them, seen from its end, was a cube)
    const d = d0 * 0.8;
    // one came down on a stone that fell before it, and is propped on it
    const propped = i === 3;
    const tilt = propped ? [R(0.13, 0.17), 0] : undefined;
    // (its low edge only just into the floor: the prop is cut to the gap)
    const sink = propped ? 0.06 : undefined;
    // The two longest broke across their length: the block where it came
    // down, its broken end rough, and what broke off it lying off that end,
    // a chunk with the dressed faces it took with it.
    if (w >= 10) {
      const f = R(0.7, 0.78), w1 = w * f, piece = Math.max(h, d) * R(0.75, 0.9);
      for (const dir of [1, -1]) {
        const ph = phi + (dir < 0 ? Math.PI : 0), c = Math.cos(ph), s = Math.sin(ph);
        const a1 = a - c * (w - w1) / 2, b1 = b - s * (w - w1) / 2;
        const gap = R(0.6, 2), a2 = a1 + c * (w1 / 2 + gap + piece / 2), b2 = b1 + s * (w1 / 2 + gap + piece / 2);
        if (!free(a2, b2, piece) || !free(a1, b1, w1)) continue;
        block({ a: a1, b: b1, w: w1, h, d, phi: ph, end: 1 });
        stones.push(world({
          a: a2, b: b2, size: piece, phi: R(0, Math.PI * 2), tilt: [R(-0.06, 0.06), R(-0.06, 0.06)], seed: seed(), tone: R(0.9, 1.05),
          dressed: true, flat: h / piece * R(0.9, 1.1), cuts: 3, sink: 0.12, felt: true,
        }));
        big.push([a2, b2, piece * 1.6]);
        return;
      }
    }
    const k = block({ a, b, w, h, d, phi, ...(tilt ? { tilt, sink } : {}) });
    if (propped) {
      // Tipped about its length, its edge at -v is up off the floor; under it,
      // a stone the height of the gap there (and a little into both).
      const v = -k.across / 2 * 0.62, u = R(-0.22, 0.22) * w;
      const height = (k.across / 2 - v) * Math.sin(k.tilt[0]) - k.sink + 0.14;
      const [pa, pb] = fromBlock(k, u, v);
      stones.push(world({ a: pa, b: pb, size: Math.max(1.6, height * 2.3), height, phi: R(0, Math.PI * 2), tilt: [0, 0], seed: seed(), tone: R(0.9, 1.05), dressed: false, flat: 0.5, sink: 0.04, prop: true, tuck: true }));
    }
  });

  // ── the stones
  const clearOfBlocks = (a, b, size) => blocks.every((k) => outside(a, b, k) > size * 0.3);
  const stone = (a, b, size, o = {}) => {
    if (!free(a, b, size)) return;
    if (!o.tuck) {
      if (!clearOfBlocks(a, b, size)) return;
      // big ones lie beside each other, not in each other
      if (big.some(([ba, bb, bs]) => Math.hypot(a - ba, b - bb) < (size + bs) * 0.45)) return;
    }
    if (size > 1) big.push([a, b, size]);
    stones.push(world({
      a, b, size, phi: R(0, Math.PI * 2), tilt: [R(-0.07, 0.07), R(-0.07, 0.07)], seed: seed(), tone: R(0.82, 1.1),
      dressed: r() < 0.4, flat: size < 0.7 ? R(0.42, 0.66) : R(0.32, 0.6), sink: size * R(0.03, 0.09), ...o,
    }));
  };
  for (const k of [...blocks]) {
    // Run in under its edges and heaped against its foot: the small stone it
    // came down on, and what it broke off itself. (Tucked: half under it.)
    for (let j = 0, n = Math.round(10 + k.w * 1.4); j < n; j++) {
      const psi = R(0, Math.PI * 2), cu = Math.cos(psi), sv = Math.sin(psi);
      const size = Math.min(1.4, 0.34 * (1 - r() * 0.98) ** (-1 / 1.6));
      const out = edgeAt(k, cu, sv) + R(-0.25, 0.35);
      const [a, b] = fromBlock(k, cu * out, sv * out);
      stone(a, b, size, { tuck: true });
    }
    // what was struck off its arrises, out round it, most off a broken end
    const n = Math.round(4 + k.w * 0.6) + (k.end ? 6 : 0);
    for (let j = 0; j < n; j++) {
      const offEnd = k.end && j < 6;
      const psi = offEnd ? (k.end > 0 ? 0 : Math.PI) + R(-0.8, 0.8) : R(0, Math.PI * 2);
      const cu = Math.cos(psi), sv = Math.sin(psi);
      const size = offEnd ? pareto(0.6, 1.4, 2.6) : pareto(0.5, 1.5, 2.2);
      const out = edgeAt(k, cu, sv) + size * 0.4 + 0.15 - Math.log(1 - r() * 0.95) * (offEnd ? 1.3 : 1);
      const [a, b] = fromBlock(k, cu * out, sv * out);
      stone(a, b, size);
    }
  }
  // Thrown in from the breach: fewer and smaller the farther they went.
  for (let k = 0; k < 76; k++) {
    const b = 3 + r() ** 1.3 * 74, spread = 16 + b * 0.8, a = 1.5 + R(-spread, spread);
    stone(a, b, pareto(0.46, 1.5, Math.max(0.75, 3.4 * (1 - b / 110))));
  }
  // and a carpet of it just inside, where most of the wall came down
  for (let k = 0; k < 120; k++) {
    const b = r() ** 1.5 * 46, a = 1.5 + R(-1, 1) * (22 + b * 0.7);
    stone(a, b, R(0.28, 0.7));
  }

  const rest = [
    ...blocks.map((k) => [k.a, k.b, k.w / 2, k.across / 2, k.phi, 0.36, 0]),
    ...stones.filter((s) => !s.prop).map((s) => [s.a, s.b, s.size * 0.42, s.size * 0.42, 0, Math.min(0.3, 0.1 + s.size * 0.12), 1]),
  ];
  return { blocks, stones, rest };
}

// ── Shared ───────────────────────────────────────────────────────────────────
// A box's surface as one closed mesh, each vertex shared by every face that
// meets there, so that whatever moves a corner moves it for all of them.
// (BoxGeometry and mergeVertices made the same, at three times the cost.)
export const boxSurface = (w, h, d, nx, ny, nz) => {
  const id = new Int32Array((nx + 1) * (ny + 1) * (nz + 1)).fill(-1), pos = [], idx = [];
  const at = (i, j, k) => {
    const key = (i * (ny + 1) + j) * (nz + 1) + k;
    if (id[key] < 0) { id[key] = pos.length / 3; pos.push((i / nx - 0.5) * w, (j / ny - 0.5) * h, (k / nz - 0.5) * d); }
    return id[key];
  };
  // (each quad wound to look out of the box)
  const quad = (a, b, c, e) => idx.push(a, b, c, a, c, e);
  for (let j = 0; j < ny; j++) {
    for (let k = 0; k < nz; k++) {
      quad(at(nx, j, k), at(nx, j + 1, k), at(nx, j + 1, k + 1), at(nx, j, k + 1));
      quad(at(0, j, k), at(0, j, k + 1), at(0, j + 1, k + 1), at(0, j + 1, k));
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      quad(at(i, ny, k), at(i, ny, k + 1), at(i + 1, ny, k + 1), at(i + 1, ny, k));
      quad(at(i, 0, k), at(i + 1, 0, k), at(i + 1, 0, k + 1), at(i, 0, k + 1));
    }
    for (let j = 0; j < ny; j++) {
      quad(at(i, j, nz), at(i + 1, j, nz), at(i + 1, j + 1, nz), at(i, j + 1, nz));
      quad(at(i, j, 0), at(i, j + 1, 0), at(i + 1, j + 1, 0), at(i + 1, j, 0));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
};

// How a closed mesh curves at each vertex, from its neighbours: over 0 where
// it is convex (an arris, a corner, the rim of a chip), under 0 in a hollow.
// Measured against the length of its edges, so it is the shape and not the
// size; smoothed once, so it is a narrow band along an arris and not a line
// of dots (twice, and it was a wide one round every face).
export const curvature = (g) => {
  g.computeVertexNormals();
  const p = g.attributes.position.array, n = g.attributes.normal.array, idx = g.index.array, N = p.length / 3;
  const sum = new Float64Array(N * 3), cnt = new Uint16Array(N), len = new Float64Array(N);
  const edge = (a, b) => {
    sum[a * 3] += p[b * 3]; sum[a * 3 + 1] += p[b * 3 + 1]; sum[a * 3 + 2] += p[b * 3 + 2];
    const dx = p[b * 3] - p[a * 3], dy = p[b * 3 + 1] - p[a * 3 + 1], dz = p[b * 3 + 2] - p[a * 3 + 2];
    len[a] += Math.sqrt(dx * dx + dy * dy + dz * dz);
    cnt[a]++;
  };
  // (each edge is met twice, once from each triangle, which only doubles the sums)
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    edge(a, b); edge(b, a); edge(b, c); edge(c, b); edge(c, a); edge(a, c);
  }
  let k = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (!cnt[i] || len[i] < 1e-9) continue;
    const lx = sum[i * 3] / cnt[i] - p[i * 3], ly = sum[i * 3 + 1] / cnt[i] - p[i * 3 + 1], lz = sum[i * 3 + 2] / cnt[i] - p[i * 3 + 2];
    k[i] = -(lx * n[i * 3] + ly * n[i * 3 + 1] + lz * n[i * 3 + 2]) / (len[i] / cnt[i]);
  }
  for (let pass = 0; pass < 1; pass++) {
    const out = new Float32Array(N), w = new Float32Array(N);
    for (let t = 0; t < idx.length; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = idx[t + e], b = idx[t + (e + 1) % 3];
        out[a] += k[b]; w[a]++;
        out[b] += k[a]; w[b]++;
      }
    }
    for (let i = 0; i < N; i++) out[i] = (k[i] * 2 + out[i]) / (2 + w[i]);
    k = out;
  }
  return k;
};
// A hollow darker; an arris a little paler, and only in places (`patch`): an
// even pale band round every face made each one a cushion.
// (A hollow is a chip's scar or a step in a break, not the faint rise and
// fall of a face: under 0.06 it is nothing.)
export const wear = (k, patch = 1) => 1 + 0.16 * patch * smoothstep(0.05, 0.25, k) - 0.5 * smoothstep(0.06, 0.3, -k);

// Laid down: tipped, turned, settled onto the floor at `floor` and `sink`
// into it, and its normals creased (sharp at an arris, a chip's rim or a
// break's ridge; smooth across a face). Then the light it gets as it lies:
// dust on what faces up, dark at its foot and under itself, and darker where
// a block stands over it (`near`: the blocks, as boxes).
const lay = (g, { tilt, theta, x, z, floor, sink, ns, foot, near = [] }) => {
  g.rotateX(tilt[0]);
  g.rotateZ(tilt[1]);
  g.rotateY(theta);
  g.computeBoundingBox();
  g.translate(x, floor - sink - g.boundingBox.min.y, z);
  const out = toCreasedNormals(g, 0.42);
  g.dispose();
  const p = out.attributes.position.array, nr = out.attributes.normal.array, c = out.attributes.color.array;
  // (only the blocks near enough to shade any of it, each with its turn
  // worked out once)
  const bb = out.boundingBox ?? (out.computeBoundingBox(), out.boundingBox);
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, span = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
  const over = near.filter((k) => Math.hypot(cx - k.x, cz - k.z) < Math.hypot(k.w, k.across) / 2 + span + 4)
    .map((k) => ({ ...k, cs: Math.cos(k.theta), sn: Math.sin(k.theta) }));
  // (the dust the fall threw up, settled on everything: a coat over the
  // tops, thinner toward their edges, thick in patches)
  const dust = [1.0, 0.97, 0.9];
  for (let i = 0; i < p.length / 3; i++) {
    const px = p[i * 3], py = p[i * 3 + 1], pz = p[i * 3 + 2], nx = nr[i * 3], ny = nr[i * 3 + 1], nz = nr[i * 3 + 2];
    const settled = ny > 0.35 ? smoothstep(0.35, 0.9, ny) * (0.45 + 0.55 * smoothstep(0.3, 0.65, noise(px * 0.5, py * 0.5, pz * 0.5, ns + 11))) * 0.72 : 0;
    let light = (0.38 + 0.62 * smoothstep(0, foot, py - floor)) * (ny < -0.3 ? 0.7 : 1);
    for (const k of over) {
      const dx = px - k.x, dz = pz - k.z;
      const lx = dx * k.cs - dz * k.sn, lz = dx * k.sn + dz * k.cs;
      const ox = clamp(lx, -k.w / 2, k.w / 2) - lx, oz = clamp(lz, -k.across / 2, k.across / 2) - lz;
      const oy = clamp(py, floor, floor + k.h - k.sink) - py;
      const wx = ox * k.cs + oz * k.sn, wz = -ox * k.sn + oz * k.cs, d = Math.sqrt(wx * wx + oy * oy + wz * wz);
      if (d < 1e-3) { light *= 0.45; continue; }
      if (d > 5) continue;
      light *= 1 - 0.6 * Math.max(0, (nx * wx + ny * oy + nz * wz) / d) * Math.exp(-d / 1.1);
    }
    for (let j = 0; j < 3; j++) {
      const v = c[i * 3 + j];
      c[i * 3 + j] = (v + (dust[j] - v) * settled) * light;
    }
  }
  out.attributes.color.needsUpdate = true;
  return out;
};

// ── A block ──────────────────────────────────────────────────────────────────
// Built in its own frame (x its length, y its height, z across, the face that
// was the room's at -z), then laid. Comes back in the world, its tone in its
// vertex colours.
export function fallenBlock({ w, h, d, tilt, end, seed, tone, sink, theta, x: X, z: Z }, { floor, light = false }) {
  const rng = makeRng(seed);
  const R = (lo, hi) => lo + (hi - lo) * rng();
  const ns = seed % 9973;
  // vertices every third of a unit or so, closer toward the arrises (`warp`),
  // where the wear and the chips are
  const S = light ? 0.55 : 0.3;
  const seg = (L) => Math.max(3, Math.ceil(L / S));
  const g = boxSurface(w, h, d, seg(w), seg(h), seg(d));
  const hx = w / 2, hy = h / 2, hz = d / 2, H = [hx, hy, hz];
  const warp = (t) => Math.sign(t) * (1 - (1 - Math.min(1, Math.abs(t))) ** 1.5);

  // Spalled where it struck and where it rolled: flakes off every arris, many
  // and small and a few large, so that no edge of it runs straight for long;
  // corners knocked off; and here and there a shallow flake off a face. Each
  // is the inside of a big ellipsoid standing off the stone, so the scar is
  // all but flat — a facet, as limestone spalls — and sharp at its rim.
  const chips = [];
  const scar = (e, out, size, deep, along = -1, stretch = 1) => {
    const big = size * R(2.2, 3.4), L = Math.hypot(...out);
    const c = e.map((v, j) => v + (out[j] / L) * (big - deep));
    const rad = [big, big, big];
    if (along >= 0) rad[along] = big * stretch;
    chips.push({ c, rad });
  };
  const sgn = () => (rng() < 0.5 ? -1 : 1);
  for (let k = 0, n = Math.round(22 + (w + h + d) * 2.2); k < n; k++) {
    const ax = Math.floor(rng() * 3), o1 = (ax + 1) % 3, o2 = (ax + 2) % 3, s1 = sgn(), s2 = sgn();
    const size = Math.min(1.5, 0.16 * (1 - rng() * 0.98) ** (-1 / 1.5));
    const e = [0, 0, 0], out = [0, 0, 0];
    e[ax] = R(-0.95, 0.95) * H[ax];
    e[o1] = s1 * H[o1];
    e[o2] = s2 * H[o2];
    out[o1] = s1 * R(0.5, 1);
    out[o2] = s2 * R(0.5, 1);
    scar(e, out, size, size * R(0.22, 0.45), ax, R(1.2, 2.2));
  }
  for (let k = 0, n = 3 + Math.floor(rng() * 4); k < n; k++) {
    const s = [sgn(), sgn(), sgn()], size = 0.5 + rng() ** 2 * 1.6;
    scar(s.map((v, j) => v * H[j]), s.map((v) => v * R(0.6, 1)), size, size * R(0.4, 0.75));
  }
  for (let k = 0, n = 2 + Math.floor(rng() * 4); k < n; k++) {
    const ax = Math.floor(rng() * 3), o1 = (ax + 1) % 3, o2 = (ax + 2) % 3, s = sgn();
    const e = [0, 0, 0], out = [0, 0, 0], size = R(0.6, 1.8);
    e[ax] = s * H[ax];
    e[o1] = R(-0.7, 0.7) * H[o1];
    e[o2] = R(-0.7, 0.7) * H[o2];
    out[ax] = s;
    scar(e, out, size, R(0.06, 0.16));
  }
  // The face it broke along, if it broke: planes meeting in ridges, as a
  // block breaks — not square to it, and standing out where they meet — and
  // rough over all of it. (How far in from where its end was, at y, z.)
  const planes = Array.from({ length: 3 + Math.floor(rng() * 2) }, () => {
    const a = R(-0.75, 0.75), b = R(-0.75, 0.75);
    return [R(0.15, 0.8) + Math.abs(a) + Math.abs(b), a, b];
  });
  const bo = R(0, 50);
  const broken = (y, z) => {
    let m = 0;
    for (const [c, a, b] of planes) m = Math.max(m, c + a * y / hy + b * z / hz);
    // (ridged: the steps a break goes down in are sharp-crested, where smooth
    // noise over it read as a sack, not a stone)
    return m + 0.22 * Math.abs(noise(y * 0.8 + bo, z * 0.8, bo, ns + 5) - 0.5) * 2
      + 0.1 * Math.abs(noise(y * 1.9, z * 1.9 + bo, bo, ns + 7) - 0.5) * 2
      + 0.04 * (noise(y * 4.1, z * 4.1, bo, ns + 9) - 0.5) * 2;
  };

  const p = g.attributes.position, n = p.count;
  const col = new Float32Array(n * 3);
  // (linear, over the stone's own map: the dressed faces a quarter darker
  // than the old boxes, a fresh break as pale as they were; and no two
  // blocks quite the same stone, one more ochre, one greyer)
  const mortar = [1.3, 1.27, 1.16], freshStone = [1.02, 0.98, 0.92];
  const hue = R(-1, 1), tint = [1 + 0.07 * hue, 1, 1 - 0.09 * hue];
  for (let i = 0; i < n; i++) {
    const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i);
    let x = warp(x0 / hx) * hx, y = warp(y0 / hy) * hy, z = warp(z0 / hz) * hz;
    // which face it was on, before anything was worn away
    const fx = Math.abs(x0) / hx, fy = Math.abs(y0) / hy, fz = Math.abs(z0) / hz;
    const face = fx >= fy && fx >= fz ? 0 : fy >= fz ? 1 : 2;
    const side = Math.sign([x0, y0, z0][face]) || 1;
    // Its arrises: sharp along some lengths, worn round along others.
    const rr = 0.03 + 0.34 * smoothstep(0.5, 0.82, fbm(x * 0.28, y * 0.28, z * 0.28, ns + 1));
    const qx = clamp(x, rr - hx, hx - rr), qy = clamp(y, rr - hy, hy - rr), qz = clamp(z, rr - hz, hz - rr);
    let dx = x - qx, dy = y - qy, dz = z - qz;
    const L = Math.hypot(dx, dy, dz) || 1;
    dx /= L; dy /= L; dz /= L;
    x = qx + dx * rr; y = qy + dy * rr; z = qz + dz * rr;
    // A face is not a plane: weathered over, tooled once. And on a bed or a
    // head (inside the wall), the lime it was laid in, crusted in patches.
    // (the lime keeps off the arrises: crusted over them it hung like icing)
    const inside = face === 1 || (face === 0 && side !== end);
    const fromEdge = Math.min(...[0, 1, 2].filter((a) => a !== face).map((a) => H[a] - Math.abs([x, y, z][a])));
    const m = inside ? smoothstep(0.56, 0.66, fbm(x * 0.5, y * 0.5, z * 0.5, ns + 8)) * smoothstep(0.25, 0.7, fromEdge) : 0;
    // (only just: soft bulges seven millimetres deep, raked by the moon, made
    // a smoked face a sack; the grain's own relief is in its map, and nothing
    // finer than the vertices here, which aliased into a waffle)
    const relief = 0.03 * (fbm(x * 0.6, y * 0.6, z * 0.6, ns + 13) - 0.5) * 2
      + m * (0.04 + 0.07 * noise(x * 1.4, y * 1.4, z * 1.4, ns + 15));
    x += dx * relief; y += dy * relief; z += dz * relief;
    const wx = x, wy = y, wz = z;
    for (const { c: o, rad } of chips) {
      const ex = (x - o[0]) / rad[0], ey = (y - o[1]) / rad[1], ez = (z - o[2]) / rad[2];
      const E2 = ex * ex + ey * ey + ez * ez;
      if (E2 >= 1) continue;
      const E = Math.sqrt(E2);
      if (E > 1e-6) {
        // (out to the scar's surface, and rough over it: a fresh break is)
        const to = (1 + 0.025 * (noise(x * 3.3, y * 3.3, z * 3.3, ns + 3) - 0.5)) / E;
        x = o[0] + (x - o[0]) * to;
        y = o[1] + (y - o[1]) * to;
        z = o[2] + (z - o[2]) * to;
      }
    }
    if (end) {
      const lim = hx - broken(y, z);
      if (end * x > lim) x = end * lim;
    }
    p.setXYZ(i, x, y, z);

    // ── its tone, where it was in the wall: the stone's own clouding, slow
    // and strong, and finer under it
    const fresh = smoothstep(0.03, 0.2, Math.hypot(x - wx, y - wy, z - wz));
    const k = tone * 0.74 * (0.74 + 0.4 * fbm(x * 0.22, y * 0.22, z * 0.22, ns + 2) + 0.07 * (noise(x * 1.3, y * 1.3, z * 1.3, ns + 12) - 0.5));
    let c = [k * tint[0], k * 0.99, k * 0.97 * tint[2]];
    if (face === 2 && side < 0) {
      // the face that was the room's, smoked by its lamps for centuries,
      // most toward what was its top, and the smoke run down it in streaks
      const soot = (0.5 + 0.18 * smoothstep(0.25, 0.75, noise(x * 1.3, y * 0.18, z * 1.3, ns + 4))) * (1 - 0.12 * (y / hy + 1) / 2);
      c = [c[0] * soot, c[1] * soot * 0.96, c[2] * soot * 0.9];
    } else if (face === 2) {
      // the garden's face, rained on: run down it in streaks
      const wet = 0.62 + 0.3 * smoothstep(0.3, 0.7, noise(x * 1.4, y * 0.12, z * 1.4, ns + 6));
      c = [c[0] * wet, c[1] * wet, c[2] * wet * 0.97];
    }
    c = c.map((v, j) => v + (v * mortar[j] - v) * m);
    c = c.map((v, j) => v + (tone * freshStone[j] - v) * fresh * 0.9);
    col.set(c, i * 3);
  }
  const bend = curvature(g);
  for (let i = 0; i < n; i++) {
    const f = wear(bend[i], smoothstep(0.45, 0.7, noise(p.getX(i) * 0.9, p.getY(i) * 0.9, p.getZ(i) * 0.9, ns + 16)));
    for (let j = 0; j < 3; j++) col[i * 3 + j] *= f;
  }
  g.deleteAttribute('normal');
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return lay(g, { tilt, theta, x: X, z: Z, floor, sink, ns, foot: 1 });
}

// ── A stone broken off ───────────────────────────────────────────────────────
// A rock: a box (`flat` as tall as it is long, more or less across), its
// corners softened a little as a stone's are that has tumbled, cut by the
// planes it broke along, and rough over the cuts. `dressed`: what is left of
// its box is a piece of a dressed face, not of another break. It lies on its
// broadest face, `size` across (`height` tall, if it has to be).
export function fragment({ size, height, flat, dressed, cuts: few, tilt, seed, tone, sink, theta, x: X, z: Z }, { floor, near = [] }) {
  const rng = makeRng(seed);
  const R = (lo, hi) => lo + (hi - lo) * rng();
  const ns = seed % 9973;
  const hx = 1, hy = flat * R(0.8, 1.25), hz = R(0.55, 1);
  // as many vertices as it is big (the smallest, on three to a side and
  // softened, came out as little drums)
  const n = size < 0.55 ? 4 : size < 1.3 ? 6 : 9;
  const g = boxSurface(2 * hx, 2 * hy, 2 * hz, n, Math.max(2, Math.round(n * hy)), Math.max(3, Math.round(n * hz)));
  // (cut deep: a box that the cuts only nicked lay there as a rounded block)
  const cuts = Array.from({ length: few ?? 5 + Math.floor(rng() * 4) }, () => {
    const v = [R(-1, 1), R(-1, 1), R(-1, 1)], L = Math.hypot(...v) || 1, nrm = v.map((c) => c / L);
    const support = Math.abs(nrm[0]) * hx + Math.abs(nrm[1]) * hy + Math.abs(nrm[2]) * hz;
    return { nrm, off: support * (few ? R(0.3, 0.72) : R(0.18, 0.6)) };
  });
  const p = g.attributes.position, N = p.count;
  // which face it ends on: a cut (0..) or a face of its box (-1..-6)
  const on = new Int16Array(N);
  const soft = 0.12 * Math.min(hy, hz);
  for (let i = 0; i < N; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fx = Math.abs(x) / hx, fy = Math.abs(y) / hy, fz = Math.abs(z) / hz;
    let face = fx >= fy && fx >= fz ? (x > 0 ? -1 : -2) : fy >= fz ? (y > 0 ? -3 : -4) : (z > 0 ? -5 : -6);
    const qx = clamp(x, soft - hx, hx - soft), qy = clamp(y, soft - hy, hy - soft), qz = clamp(z, soft - hz, hz - soft);
    const dx = x - qx, dy = y - qy, dz = z - qz, L = Math.hypot(dx, dy, dz) || 1;
    x = qx + (dx / L) * soft; y = qy + (dy / L) * soft; z = qz + (dz / L) * soft;
    cuts.forEach(({ nrm, off }, k) => {
      const over = x * nrm[0] + y * nrm[1] + z * nrm[2] - off;
      if (over > 0) { x -= nrm[0] * over; y -= nrm[1] * over; z -= nrm[2] * over; face = k; }
    });
    on[i] = face;
    // rough: a break more than what is left of a dressed face; and no piece
    // the shape of a box, however it was cut
    const rough = (face >= 0 || !dressed ? 0.06 : 0.025) * (fbm(x * 1.6, y * 1.6, z * 1.6, ns + 1) - 0.5) * 2
      + 0.09 * (noise(x * 0.7, y * 0.7, z * 0.7, ns + 17) - 0.5) * 2;
    const r0 = Math.hypot(x, y, z) || 1;
    p.setXYZ(i, x + (x / r0) * rough, y + (y / r0) * rough, z + (z / r0) * rough);
  }
  // its tone: the break pale and fresh, what is left of a dressed face as the
  // wall was (smoked, if it was the room's); dark in its hollows, pale on its edges
  const freshStone = [0.93, 0.9, 0.85], old = rng() < 0.35 ? [0.42, 0.4, 0.37] : [0.62, 0.61, 0.58];
  const bend = curvature(g);
  const col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = on[i] >= 0 || !dressed ? freshStone : old;
    const k = tone * (0.86 + 0.28 * fbm(p.getX(i) * 0.9, p.getY(i) * 0.9, p.getZ(i) * 0.9, ns + 2, 2)) * wear(bend[i]);
    col.set([t[0] * k, t[1] * k, t[2] * k], i * 3);
  }
  g.deleteAttribute('normal');
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // On its broadest face, by area: each face's triangles summed as vectors
  // (a deep cut piles many vertices onto a small face, and counted by its
  // vertices a stone stood up on its edge; any triangle folded under the cut
  // faces the other way and takes itself off)
  const sum = new Map(), pa = p.array, ix = g.index.array;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t], ix[t + 1], ix[t + 2]];
    if (on[a] !== on[b] || on[a] !== on[c]) continue;
    const ux = pa[b * 3] - pa[a * 3], uy = pa[b * 3 + 1] - pa[a * 3 + 1], uz = pa[b * 3 + 2] - pa[a * 3 + 2];
    const vx = pa[c * 3] - pa[a * 3], vy = pa[c * 3 + 1] - pa[a * 3 + 1], vz = pa[c * 3 + 2] - pa[a * 3 + 2];
    const s = sum.get(on[a]) ?? [0, 0, 0];
    s[0] += uy * vz - uz * vy; s[1] += uz * vx - ux * vz; s[2] += ux * vy - uy * vx;
    sum.set(on[a], s);
  }
  // And of its three broadest, the first it would not topple off — not
  // standing taller than it is narrow — or else the steadiest of them.
  const faces = [...sum.values()].map((s) => ({ A: Math.hypot(s[0], s[1], s[2]), s })).sort((u, v) => v.A - u.A).slice(0, 3);
  const turn = new THREE.Quaternion(), v3 = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0);
  let best = null;
  for (const { A, s } of faces) {
    turn.setFromUnitVectors(v3.set(s[0] / A, s[1] / A, s[2] / A), DOWN);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < N; i++) {
      v3.set(pa[i * 3], pa[i * 3 + 1], pa[i * 3 + 2]).applyQuaternion(turn);
      lo[0] = Math.min(lo[0], v3.x); lo[1] = Math.min(lo[1], v3.y); lo[2] = Math.min(lo[2], v3.z);
      hi[0] = Math.max(hi[0], v3.x); hi[1] = Math.max(hi[1], v3.y); hi[2] = Math.max(hi[2], v3.z);
    }
    const stand = (hi[1] - lo[1]) / Math.min(hi[0] - lo[0], hi[2] - lo[2]);
    if (!best || stand < best.stand) best = { stand, q: turn.clone() };
    if (stand < 0.8) { best = { stand, q: turn.clone() }; break; }
  }
  g.applyQuaternion(best ? best.q : new THREE.Quaternion());
  g.computeBoundingBox();
  const bb = g.boundingBox, across = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
  const s = size / across, sy = height ? height / (bb.max.y - bb.min.y) : s;
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  g.scale(s, sy, s);
  const tall = (bb.max.y - bb.min.y) * sy;
  return lay(g, { tilt, theta, x: X, z: Z, floor, sink, ns, foot: Math.min(0.9, tall * 0.65), near });
}
