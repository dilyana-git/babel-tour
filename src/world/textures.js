// ── Painted surfaces ─────────────────────────────────────────────────────────
// Every surface of the world is painted here on canvases at load, each with the
// maps that make light behave on it — a colour map, a normal map (drawn as a
// height field and differentiated, so a mortar joint is a groove the lamp
// rakes across, not a line printed on a board) and a roughness map (so a slab
// worn smooth by centuries of feet takes a sheen that its joints do not).
//
// The palette is the one measured off the Midjourney plates when the balcony
// was graded to them (see the balcony style pass): stone warm but LOW in
// chroma, red a little above blue even in shadow, and bindings the colour of
// old leather rather than of a paint chart — a shelf of saturated primaries
// was, by measurement, the one thing that made a room read as a toy.
import * as THREE from 'three';

export const makeRng = (seed) => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// In a worker there is no document, and the same painting goes onto an
// OffscreenCanvas (paint.worker.js — the heavy surfaces are painted off the
// main thread while the world is built).
const canvas = (w, h = w) => {
  const c = typeof document === 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
};

export const toTexture = (source, { srgb = true, repeat = [1, 1], anisotropy = 8 } = {}) => {
  const t = new THREE.CanvasTexture(source);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  return t;
};

// A tangent-space normal map from a grey height canvas (white is high),
// wrapping at the edges so a tiling height field makes a tiling normal map.
// Canvas rows run down and texture v runs up, hence the sign on y.
export function normalsFrom(height, strength = 2) {
  const w = height.width, h = height.height;
  const src = height.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = src[i * 4] / 255;
  const [out, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const up = ((y - 1 + h) % h) * w, row = y * w, down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const left = (x - 1 + w) % w, right = (x + 1) % w;
      const nx = (lum[row + left] - lum[row + right]) * strength;
      const ny = (lum[down + x] - lum[up + x]) * strength;
      const len = Math.sqrt(nx * nx + ny * ny + 1);
      const i = (row + x) * 4;
      d[i] = (nx / len * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return out;
}

const grey = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;

// Specks laid identically into colour, height and roughness, so a pit that is
// darker is also lower and rougher.
const pits = (layers, rnd, size, count, { dark = 0.12, deep = 40, big = 3 } = {}) => {
  const [c, hg, rg] = layers;
  for (let k = 0; k < count; k++) {
    const x = rnd() * size, y = rnd() * size, s = 0.6 + rnd() * big;
    const a = rnd() * dark;
    c.fillStyle = `rgba(12,9,6,${a})`;
    c.fillRect(x, y, s, s);
    hg.fillStyle = `rgba(0,0,0,${a * deep / 40})`;
    hg.fillRect(x, y, s, s);
    if (rg) {
      rg.fillStyle = `rgba(255,255,255,${a})`;
      rg.fillRect(x, y, s, s);
    }
  }
};

// Soiling at the scale of a whole wall, which is what stops a large face lit
// by one lamp reading as one flat tone.
const soil = (g, rnd, size, count, lightChance = 0.35) => {
  for (let k = 0; k < count; k++) {
    const x = rnd() * size, y = rnd() * size, r = size * (0.04 + rnd() * 0.16);
    const blot = g.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, rnd() < lightChance ? 'rgba(236,224,200,0.07)' : 'rgba(20,14,9,0.18)');
    blot.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = blot;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
};

// ── Stone ─────────────────────────────────────────────────────────────────────

// Ashlar: blocks in lime mortar, each its own shade of the same warm grey,
// chamfered at the arris, dirtier at its bed than its top, pitted and
// chiselled. `tone` is the mean block colour.
//
// Laid as a mason lays random ashlar, not as a tile repeats: the courses are
// not all one height (a deep course, then shallower ones, in a rhythm that
// still sums to the canvas so the texture tiles) and no two blocks in a course
// need be the same length. Eight equal courses of four equal blocks, every
// joint the same dark, read at room distance as brick wallpaper.
const RHYTHM = [1.3, 0.8, 1.12, 0.78, 1.06, 0.86, 1.22, 0.86];
export function ashlar({ size = 1024, seed = 7, courses = 8, blocks = 4, tone = [112, 100, 88], joint = 3, strength = 3.2 } = {}) {
  const rnd = makeRng(seed);
  const [col, c] = canvas(size);
  const [hei, hg] = canvas(size);
  const [rou, rg] = canvas(size);
  c.fillStyle = `rgb(${tone[0] * 0.42},${tone[1] * 0.4},${tone[2] * 0.38})`;
  c.fillRect(0, 0, size, size);
  hg.fillStyle = grey(30);
  hg.fillRect(0, 0, size, size);
  rg.fillStyle = grey(250);
  rg.fillRect(0, 0, size, size);
  // The lime the joints were pointed with, still there in places: paler than
  // the grime of the rest of the joint, and only ever seen in it (the blocks
  // are laid over this).
  for (let k = 0; k < 2600; k++) {
    c.fillStyle = `rgba(${tone[0] * 1.05},${tone[1] * 1.0},${tone[2] * 0.92},${0.18 + rnd() * 0.3})`;
    c.fillRect(rnd() * size, rnd() * size, 2 + rnd() * 12, 2 + rnd() * 8);
  }
  const bw = size / blocks;
  const rhythm = RHYTHM.slice(0, courses);
  while (rhythm.length < courses) rhythm.push(RHYTHM[rhythm.length % RHYTHM.length]);
  const sum = rhythm.reduce((a, b) => a + b, 0);
  // One block, as a mason dresses it: a smooth margin drafted round the face
  // and the field inside it worked with a broad chisel in close parallel
  // strokes at one angle. Faint in the colour and clear in the height, so the
  // tooling is seen only where a lamp rakes the wall, which is where it is
  // seen on a real one. (These were short dashes scattered over the face,
  // and at any distance a wall of them read as rivets or as Morse.)
  const block = (x, y, w, h, look) => {
    const { v, wear, tilt, warm, mottle, angle, chips } = look;
    const l = v * 18;
    c.fillStyle = `rgb(${tone[0] + l + 4 + warm * 7},${tone[1] + l + warm * 2},${tone[2] + l - 3 - warm * 6})`;
    c.fillRect(x, y, w, h);
    for (const g of [c, hg]) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); }
    // the stone's own clouding: no block is one tone through
    for (const [mx, my, mr, ma, light] of mottle) {
      const px = x + mx * w, py = y + my * h, r = mr * Math.max(w, h);
      const b = c.createRadialGradient(px, py, 0, px, py, r);
      b.addColorStop(0, light ? `rgba(232,220,198,${ma})` : `rgba(26,19,12,${ma * 1.4})`);
      b.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = b;
      c.fillRect(px - r, py - r, r * 2, r * 2);
    }
    const wash = c.createLinearGradient(0, y, 0, y + h);
    wash.addColorStop(0, 'rgba(236,224,200,0.1)');
    wash.addColorStop(0.45, 'rgba(0,0,0,0)');
    wash.addColorStop(1, `rgba(22,15,9,${0.22 + tilt * 0.14})`);
    c.fillStyle = wash;
    c.fillRect(x, y, w, h);
    // chamfered faces: lower toward every edge
    for (let s = 0; s < 7; s++) {
      hg.fillStyle = grey(70 + s * 22 + wear * 10);
      hg.fillRect(x + s, y + s, w - s * 2, h - s * 2);
    }
    // the field, tooled: parallel strokes across it inside the drafted margin
    const m = Math.max(5, Math.min(w, h) * 0.1);
    hg.save();
    hg.beginPath();
    hg.rect(x + m, y + m, w - m * 2, h - m * 2);
    hg.clip();
    // Short strokes, each the width of the chisel's edge, at random places
    // and lengths but all at the block's one angle, and a stipple between:
    // full-length lines at an even pitch drew a pinstripe that the distance
    // turned to moire across every big face.
    for (let k = 0, n = Math.round((w * h) / 150); k < n; k++) {
      const sx = x + m + rnd() * (w - m * 2), sy = y + m + rnd() * (h - m * 2), L = 6 + rnd() * 30;
      const a2 = (rnd() - 0.5) * 0.12, cx2 = Math.cos(angle + a2), sx2 = Math.sin(angle + a2);
      hg.strokeStyle = `rgba(0,0,0,${0.06 + rnd() * 0.08})`;
      hg.lineWidth = 1 + rnd() * 1.2;
      hg.beginPath();
      hg.moveTo(sx, sy);
      hg.lineTo(sx + cx2 * L, sy + sx2 * L);
      hg.stroke();
    }
    for (let k = 0, n = Math.round((w * h) / 70); k < n; k++) {
      hg.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
      hg.fillRect(x + m + rnd() * (w - m * 2), y + m + rnd() * (h - m * 2), 1 + rnd(), 1 + rnd());
    }
    hg.restore();
    // the margin a shade paler than the field: it was rubbed smooth
    c.strokeStyle = 'rgba(236,226,206,0.05)';
    c.lineWidth = m;
    c.strokeRect(x + m / 2, y + m / 2, w - m, h - m);
    for (const g of [c, hg]) g.restore();
    rg.fillStyle = grey(200 - wear * 60);
    rg.fillRect(x + 4, y + 4, w - 8, h - 8);
    // the arrises knocked: a few chips out of the edge, each a little hollow
    // in shadow
    for (const [side, along, s] of chips) {
      const cx = side < 2 ? x + along * w : side === 2 ? x : x + w;
      const cy = side < 2 ? (side === 0 ? y : y + h) : y + along * h;
      const ins = side === 0 ? [0, 1] : side === 1 ? [0, -1] : side === 2 ? [1, 0] : [-1, 0];
      const pts = [[cx - ins[1] * s, cy - ins[0] * s], [cx + ins[0] * s * 0.7 + ins[1] * s * 0.3, cy + ins[1] * s * 0.7 + ins[0] * s * 0.3], [cx + ins[1] * s, cy + ins[0] * s]];
      for (const [g, style] of [[c, 'rgba(24,17,11,0.4)'], [hg, grey(52)]]) {
        g.fillStyle = style;
        g.beginPath();
        pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
        g.closePath();
        g.fill();
      }
    }
  };
  let y0 = 0;
  for (let row = 0; row < courses; row++) {
    const bh = (rhythm[row] / sum) * size;
    // Block lengths from 0.6 to 1.5 of a block, the last one closing the
    // course where the first began, so it tiles across as well as down.
    const lens = [];
    let run = 0;
    while (run < size - bw * 0.55) { const w = bw * (0.6 + rnd() * 0.9); lens.push(w); run += w; }
    lens[lens.length - 1] += size - run;
    let x = rnd() * size;
    for (const w of lens) {
      const look = {
        v: rnd() * 2 - 1, wear: rnd(), tilt: rnd(), warm: rnd() * 2 - 1,
        mottle: Array.from({ length: 3 + Math.floor(rnd() * 4) }, () => [rnd(), rnd(), 0.2 + rnd() * 0.45, 0.04 + rnd() * 0.07, rnd() < 0.45]),
        // most blocks dressed across at a slant, some upright, a few level
        angle: (rnd() < 0.6 ? 1.15 : rnd() < 0.5 ? Math.PI / 2 : 0.08) + (rnd() - 0.5) * 0.25,
        chips: Array.from({ length: Math.floor(rnd() * rnd() * 5) }, () => [Math.floor(rnd() * 4), 0.08 + rnd() * 0.84, 3 + rnd() * 7]),
      };
      // a block over the right-hand edge comes back in at the left
      for (const dx of [0, -size]) {
        if (x + dx + w <= 0 || x + dx >= size) continue;
        block(x + dx + joint, y0 + joint, w - joint * 2, bh - joint * 2, look);
      }
      x += w;
    }
    y0 += bh;
  }
  // Pitted a quarter as much, and finer. Near the eye (the Echo's dark panels,
  // the Vertigo's rim) nine thousand dark squares read as rivets, not stone.
  pits([c, hg, rg], rnd, size, 2400, { dark: 0.11, big: 1.3 });
  for (let k = 0; k < 16000; k++) {
    const a = rnd() * 0.05;
    c.fillStyle = rnd() < 0.5 ? `rgba(230,218,196,${a})` : `rgba(16,12,8,${a})`;
    c.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1 + rnd() * 2);
  }
  // Streaks down the face: soot and damp carried down from a joint or a ledge
  // over the years, darker where they start, gone a block or two below. (The
  // canvas wraps top to bottom, so each is drawn again a canvas higher.)
  for (let k = 0; k < 46; k++) {
    const x = rnd() * size, y = rnd() * size, len = 60 + rnd() * 320, wd = 3 + rnd() * 14, a = 0.04 + rnd() * 0.07, pale = rnd() < 0.25;
    for (const dy of [0, -size]) {
      const g = c.createLinearGradient(0, y + dy, 0, y + dy + len);
      g.addColorStop(0, pale ? `rgba(226,216,196,${a * 0.7})` : `rgba(18,12,7,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - wd / 2, y + dy, wd, len);
    }
  }
  soil(c, rnd, size, 26);
  return {
    map: toTexture(col),
    normalMap: toTexture(normalsFrom(hei, strength), { srgb: false }),
    roughnessMap: toTexture(rou, { srgb: false }),
  };
}

// Flagstones: large slabs of a paler stone, laid in running bond, their faces
// walked smooth — the sheen a lamp makes in them is most of what says "floor"
// — their arrises rounded and blackened, a faint vein through some.
export function flagstones({ size = 1024, seed = 19, rows = 4, cols = 3 } = {}) {
  const rnd = makeRng(seed);
  const [col, c] = canvas(size);
  const [hei, hg] = canvas(size);
  const [rou, rg] = canvas(size);
  c.fillStyle = '#211a14';
  c.fillRect(0, 0, size, size);
  hg.fillStyle = grey(20);
  hg.fillRect(0, 0, size, size);
  rg.fillStyle = grey(240);
  rg.fillRect(0, 0, size, size);
  const sh = size / rows, sw = size / cols;
  const shade = Array.from({ length: rows }, () => Array.from({ length: cols }, () => [rnd() * 2 - 1, rnd()]));
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * sw * 0.5;
    for (let k = -1; k <= cols; k++) {
      const [v, polish] = shade[r][(k + cols) % cols];
      const x = k * sw + off + 4, y = r * sh + 4, w = sw - 8, h = sh - 8;
      const l = v * 12;
      c.fillStyle = `rgb(${134 + l},${122 + l},${106 + l})`;
      c.fillRect(x, y, w, h);
      // walked: a paler, smoother track down the middle of the slab
      const worn = c.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
      worn.addColorStop(0, 'rgba(226,214,190,0.08)');
      worn.addColorStop(1, 'rgba(18,12,8,0.3)');
      c.fillStyle = worn;
      c.fillRect(x, y, w, h);
      for (let s = 0; s < 9; s++) {
        hg.fillStyle = grey(60 + s * 20);
        hg.fillRect(x + s, y + s, w - s * 2, h - s * 2);
      }
      // The sheen of a walked slab: broad, faint and off its middle. It was a
      // tight gloss (roughness 0.26-0.38) dead in the middle of every slab, and
      // under a lamp each one took its own hot spot — a floor of polka dots,
      // which no stone does. Off-centre by a hash, not by `rnd`, so the veins
      // and pits drawn after it stay where they were.
      // (keyed on the slab, not the column, so a slab cut by the tile's edge
      // matches itself across it)
      const kk = (k + cols) % cols;
      const hx = Math.abs(Math.sin(r * 127.1 + kk * 311.7) * 43758.5453) % 1, hy = Math.abs(Math.sin(r * 269.5 + kk * 183.3) * 43758.5453) % 1;
      const gx = x + w * (0.25 + 0.5 * hx), gy = y + h * (0.25 + 0.5 * hy);
      const gloss = rg.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.9);
      gloss.addColorStop(0, grey(158 - polish * 22));
      gloss.addColorStop(1, grey(205));
      rg.fillStyle = gloss;
      rg.fillRect(x + 6, y + 6, w - 12, h - 12);
      if (rnd() < 0.55) {
        c.strokeStyle = `rgba(226,216,196,${0.08 + rnd() * 0.08})`;
        c.lineWidth = 0.8 + rnd() * 1.4;
        c.beginPath();
        let vx = x + rnd() * w, vy = y;
        c.moveTo(vx, vy);
        while (vy < y + h) { vx += rnd() * 30 - 15; vy += 12 + rnd() * 20; c.lineTo(Math.min(x + w, Math.max(x, vx)), Math.min(y + h, vy)); }
        c.stroke();
      }
    }
  }
  pits([c, hg, rg], rnd, size, 2000, { dark: 0.1, big: 1.2 });
  soil(c, rnd, size, 20, 0.25);
  return {
    map: toTexture(col),
    normalMap: toTexture(normalsFrom(hei, 2.4), { srgb: false }),
    roughnessMap: toTexture(rou, { srgb: false }),
  };
}

// ── Pavement ──────────────────────────────────────────────────────────────────
// 2026-10-06 the reader asked for a floor that looks more natural. `flagstones`
// above lays twelve slabs of one size in a brick bond, each one flat colour
// with a pale middle and a dark rim (a pillow), framed in a machined bevel and
// set in black joints all of one width: a bathroom's tiles. This lays the floor
// as a mason would: courses of uneven depth, slabs of random length in each,
// cut by hand so that no edge is quite straight and no joint quite one width,
// pointed with lime the dirt has got into. Each slab is its own piece of stone —
// its own shade, its bed running its own way, shell in some, a vein or a crack
// in a few — worn round at the arris, broken at a corner here and there, dished
// a little by the feet, and none of them lying quite flat, so that a lamp's
// sheen breaks from slab to slab as it does on an old floor.
//
// Painted per pixel into float fields: a slab's tilt is a slope finer than one
// grey step of an 8-bit height canvas, so the normal map is taken from the
// floats directly (`normalsFromField`).
//
// The roughness map carries two more things in its spare channels, for the
// floor's shader (`paveShade` in buildWorld): red is which slab a pixel belongs
// to (one of sixteen) and blue says whether that slab began a canvas to the
// left (0), here (128) or to the right (255) — a slab runs on over the canvas's
// edge and comes back in at the other — so the shader can tell every slab of
// every repeat of the tile from every other, and shade each its own way.

// Courses of uneven depth (summing to the canvas, so it tiles down) and, in
// each, slabs of random length closing on themselves round the canvas (so it
// tiles across), started where its joints fall farthest from those of the
// courses either side: a cross joint carried through two courses is a crack
// waiting to happen, and no mason lays one. Shared by the painter and by the
// Door's moss (buildWorld), which grows in these joints.
const PAVE_RHYTHM = [1.16, 0.84, 1.04, 0.92, 1.1];
export function pavingLayout({ size = 1024, seed = 19, courses = 4 } = {}) {
  const rnd = makeRng(seed * 31 + 7);
  const rhythm = Array.from({ length: courses }, (_, r) => PAVE_RHYTHM[r % PAVE_RHYTHM.length]);
  const sum = rhythm.reduce((a, b) => a + b, 0);
  const rows = [];
  const near = (a, b) => { const d = Math.abs(a - b) % size; return Math.min(d, size - d); };
  let y = 0;
  for (let r = 0; r < courses; r++) {
    const h = (rhythm[r] / sum) * size;
    // a slab from one to two of the course's depths long, now and then a short
    // make-up piece; scaled together to close the course
    const count = Math.max(2, Math.round(size / (h * 1.4)));
    const lens = Array.from({ length: count }, () => h * (rnd() < 0.14 ? 0.6 + rnd() * 0.3 : 1 + rnd() * 0.85));
    const k = size / lens.reduce((a, b) => a + b, 0);
    for (let s = 0; s < count; s++) lens[s] *= k;
    const joints = [0];
    for (const L of lens) joints.push(joints[joints.length - 1] + L);
    const beside = [rows[r - 1], r === courses - 1 && r > 0 ? rows[0] : null].filter(Boolean);
    let x0 = 0, best = -1;
    for (let t = 0; t < 48; t++) {
      const at = rnd() * size;
      let gap = Infinity;
      for (const J of joints) for (const o of beside) for (const J2 of o.joints) gap = Math.min(gap, near(at + J, o.x0 + J2));
      if (gap > best) { best = gap; x0 = at; }
    }
    rows.push({ y, h, x0, lens, joints });
    y += h;
  }
  return rows;
}

// A tangent-space normal map from a height field in pixels (a slope of 1 is
// 45°), wrapping as normalsFrom does.
const normalsFromField = (hf, w, h) => {
  const [out, g] = canvas(w, h);
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const up = ((y - 1 + h) % h) * w, row = y * w, down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const nx = (hf[row + ((x - 1 + w) % w)] - hf[row + ((x + 1) % w)]) * 0.5;
      const ny = (hf[down + x] - hf[up + x]) * 0.5;
      const len = Math.sqrt(nx * nx + ny * ny + 1), i = (row + x) * 4;
      d[i] = (nx / len * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return out;
};

export function paving({ size = 1024, seed = 19, courses = 4, tone = [119, 109, 95] } = {}) {
  const rnd = makeRng(seed);
  const rows = pavingLayout({ size, seed, courses });
  const n = size * size;
  // over the canvas (all wrap)
  const wobble = wrapNoise(rnd, 24, 24, 2);   // the hand-cut line of an edge
  const chip = wrapNoise(rnd, 80, 80, 2);     // where an arris has been knocked
  const stain = wrapNoise(rnd, 3, 3, 2);      // wax, damp and soot over the floor
  const grit = wrapNoise(rnd, 300, 300, 1);   // the stone's grain, a few pixels across
  const width = wrapNoise(rnd, 40, 40, 1);    // how wide a joint was left
  const lime = wrapNoise(rnd, 60, 60, 2);     // the pointing, where it is still there
  // sampled by a slab at its own offset in its own coordinates, so every slab
  // is a different piece of the same stone (the lattice wraps, so a slab that
  // runs over the canvas's edge is one piece across it)
  const cloud = wrapNoise(rnd, 5, 5, 3);
  const tint = wrapNoise(rnd, 4, 4, 1);
  const bed = wrapNoise(rnd, 2, 16, 2);

  let next = 0;
  for (const row of rows) {
    row.slabs = row.lens.map((len) => {
      const odd = rnd();
      return {
        index: next, id: next++ % 16, len,
        v: rnd() * 2 - 1, warm: rnd() * 2 - 1,
        // now and then a slab from another bed: greyer and darker, or paler
        odd: odd < 0.07 ? -1 : odd > 0.93 ? 1 : 0,
        // how it lies: a centimetre or so out of level across its length
        tx: (rnd() - 0.5) * 0.028, ty: (rnd() - 0.5) * 0.028,
        R: 3.5 + rnd() * 6,                       // how round the feet have worn its arris
        gloss: rnd(),
        ox: rnd(), oy: rnd(), bedA: rnd() * Math.PI, bedK: 0.3 + rnd() * 0.7,
        // its corners: most worn round, one in five broken off
        corner: [0, 1, 2, 3].map(() => (rnd() < 0.2 ? 9 + rnd() * 16 : 2.5 + rnd() * 4)),
        shell: rnd() < 0.4, vein: rnd() < 0.3, crack: rnd() < 0.14,
      };
    });
    // each joint's hand-cut line, down the canvas (the first course's top edge
    // is the canvas's own, and stays straight, so no course runs over it)
    for (const slab of row.slabs) { slab.ca = Math.cos(slab.bedA); slab.sa = Math.sin(slab.bedA); }
    row.wobX = row.joints.slice(0, -1).map((J) => Float32Array.from({ length: size }, (_, j) => 1.5 * wobble(((row.x0 + J) / size + 0.37) % 1, j / size)));
  }
  const wobY = rows.map((row, r) => Float32Array.from({ length: size }, (_, i) => (r === 0 ? 0 : 1.5 * wobble(i / size, r / courses))));
  const rowAt = Int8Array.from({ length: size }, (_, j) => { let r = 0; while (r + 1 < courses && rows[r + 1].y <= j) r++; return r; });

  const cf = new Float32Array(n * 3), hf = new Float32Array(n), rf = new Float32Array(n), D = new Float32Array(n);
  const idOf = new Uint8Array(n), home = new Int8Array(n), slabAt = new Int16Array(n);
  const [jr, jg, jb] = [62, 55, 47];          // the dirt in a joint
  const [lr, lg, lb] = [128, 120, 104];       // the lime it was pointed with
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i, u = i / size, v = j / size;
      // the course (its edges wander, so a pixel near one may be the next's)
      let r = rowAt[j];
      if (j < rows[r].y + wobY[r][i]) r -= 1;
      else if (r + 1 < courses && j >= rows[r + 1].y + wobY[r + 1][i]) r += 1;
      const row = rows[r], J = row.joints, m = row.lens.length;
      const top = row.y + wobY[r][i], bot = r + 1 < courses ? rows[r + 1].y + wobY[r + 1][i] : size;
      const dt = j - top, db = bot - j;
      // the slab, counted along the course from its first joint
      let xr = (((i - row.x0) % size) + size) % size, s = 0;
      while (s + 1 < m && J[s + 1] <= xr) s++;
      const W = row.wobX;
      if (xr < J[s] + W[s][j]) { s -= 1; if (s < 0) { s = m - 1; xr += size; } }
      else if (xr >= J[s + 1] + W[(s + 1) % m][j]) { s += 1; if (s === m) { s = 0; xr -= size; } }
      const dl = xr - J[s] - W[s][j], dr = J[s + 1] + W[(s + 1) % m][j] - xr;
      const slab = row.slabs[s];
      // how far in from the joint: half the joint off every edge, corners
      // rounded (or broken), the arris knocked about
      // (none of which reaches more than 30 pixels in)
      let d = Math.min(dl, dr, dt, db);
      if (d < 30) {
        const hw = 0.9 + 0.55 * (1 + width(u, v));
        const ax = Math.min(dl, dr) - hw, ay = Math.min(dt, db) - hw;
        const rc = slab.corner[(dt < db ? 0 : 2) + (dl < dr ? 0 : 1)];
        d = ax < rc && ay < rc ? rc - Math.sqrt((rc - ax) * (rc - ax) + (rc - ay) * (rc - ay)) : Math.min(ax, ay);
        if (d < 8) d -= 5 * Math.max(0, chip(u, v) - 0.35) * (1 - Math.max(0, d) / 8);
      }
      D[k] = d;
      idOf[k] = slab.id;
      slabAt[k] = slab.index;
      home[k] = Math.floor((row.x0 + xr) / size) - Math.floor((row.x0 + (J[s] + J[s + 1]) / 2) / size);

      // ── the stone
      const lx = xr - J[s], ly = j - row.y;
      const su = slab.ox + lx / size, sv = slab.oy + ly / size;
      const bd = bed(slab.ox + (lx * slab.ca - ly * slab.sa) / size, slab.oy + (lx * slab.sa + ly * slab.ca) / size);
      const cl = cloud(su, sv), gr = grit(u, v), st = stain(u, v);
      let L = 1 + 0.075 * slab.v + 0.07 * cl + 0.035 * slab.bedK * bd + 0.03 * gr;
      const tn = tint(su * 2, sv * 2);
      let warm = 0.035 * slab.warm + 0.025 * tn;
      if (slab.odd < 0) { L *= 0.8; warm -= 0.035; } else if (slab.odd > 0) { L *= 1.1; warm += 0.012; }
      // the floor's own soiling, and the dirt worked into the arris along
      // every joint (not a dark rim round a pale middle: a line of it)
      L *= 1 - 0.09 * Math.max(0, st) + 0.035 * Math.max(0, -st - 0.4);
      L *= 1 - 0.16 * Math.exp(-Math.max(0, d) / 3) * (0.75 + 0.25 * gr);
      let cr = tone[0] * L * (1 + warm), cg = tone[1] * L, cb = tone[2] * L * (1 - 1.5 * warm);
      // relief, in pixels: lying out of true, dished, grained; the arris worn round
      // (dished where the stone's own clouding says: the soft beds wear first)
      let hgt = slab.tx * (lx - slab.len / 2) + slab.ty * (ly - row.h / 2) + 0.9 * cl + 0.1 * gr;
      if (d < slab.R) hgt -= 0.34 * slab.R * (1 - Math.max(0, d) / slab.R) ** 2;
      let rough = 0.71 - 0.07 * (slab.gloss - 0.5) - 0.04 * tn + 0.04 * gr + 0.04 * Math.max(0, st);
      // ── the joint: dirt, the lime showing through it in places, sunk below both slabs
      if (d < 0.8) {
        const t = smooth(-1.4, 0.8, d), lm = smooth(0.15, 0.6, lime(u, v)) * 0.55;
        const g2 = 0.9 + 0.1 * gr;
        cr += ((jr + (lr - jr) * lm) * g2 - cr) * (1 - t);
        cg += ((jg + (lg - jg) * lm) * g2 - cg) * (1 - t);
        cb += ((jb + (lb - jb) * lm) * g2 - cb) * (1 - t);
        const hJ = -3.4 + 0.5 * lm + 0.25 * gr;
        hgt += (hJ - hgt) * (1 - smooth(-1.6, 0, d));
        rough += (0.94 - rough) * (1 - t);
      }
      cf[k * 3] = cr; cf[k * 3 + 1] = cg; cf[k * 3 + 2] = cb;
      hf[k] = hgt;
      rf[k] = rough;
    }
  }

  // Marks in the stone, each kept to its own slab and off its arris.
  const onSlab = (k, sl, inset = 2) => slabAt[k] === sl && D[k] > inset;
  const canvasAt = (row, s, lx, ly) => {
    const i = Math.floor((((row.x0 + row.joints[s] + lx) % size) + size) % size), j = Math.floor(row.y + ly);
    return j >= 0 && j < size ? j * size + i : -1;
  };
  const toward = (k, [r, g, b], a) => { cf[k * 3] += (r - cf[k * 3]) * a; cf[k * 3 + 1] += (g - cf[k * 3 + 1]) * a; cf[k * 3 + 2] += (b - cf[k * 3 + 2]) * a; };
  rows.forEach((row) => row.slabs.forEach((slab, s) => {
    const sl = slab.index, W = slab.len, Hh = row.h;
    // shell: little pale crescents and specks, the thing that says limestone
    // and not cement (packed in a band in some slabs, as a bed lays them)
    if (slab.shell) {
      const band = rnd() < 0.5;
      for (let q = 0, count = Math.round((W * Hh) / (band ? 700 : 1100)); q < count; q++) {
        const lx = rnd() * W, ly = band ? Hh * (0.3 + rnd() * 0.25) + (rnd() - 0.5) * Hh * 0.3 : rnd() * Hh;
        const rad = 0.8 + rnd() * 2.4, a0 = rnd() * 6.283, span = 1.4 + rnd() * 2.6, a = 0.18 + rnd() * 0.22;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const k = canvasAt(row, s, lx + dx, ly + dy);
            if (k < 0 || !onSlab(k, sl)) continue;
            const dd = Math.hypot(dx, dy), ang = (((Math.atan2(dy, dx) - a0) % 6.283) + 6.283) % 6.283;
            const e = Math.max(0, 1 - Math.abs(dd - rad) / 0.75) * (ang < span ? 1 : 0) + (rad < 1.3 && dd < 1 ? 0.6 : 0);
            if (e > 0) { toward(k, [190, 181, 162], a * Math.min(1, e)); hf[k] += 0.12 * e; }
          }
        }
      }
    }
    // a calcite vein: a pale thread wandering across the slab
    if (slab.vein) {
      let x = rnd() * W, y = 0, dir = Math.PI / 2 + (rnd() - 0.5) * 1.2;
      const a = 0.1 + rnd() * 0.12, wid = 0.6 + rnd() * 0.9;
      for (let step = 0; step < 3000 && y < Hh && x > -4 && x < W + 4; step++) {
        dir += (rnd() - 0.5) * 0.35 + (Math.PI / 2 - dir) * 0.02;
        x += Math.cos(dir) * 0.6; y += Math.sin(dir) * 0.6;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const k = canvasAt(row, s, x + dx, y + dy);
          if (k < 0 || !onSlab(k, sl, 1)) continue;
          const e = Math.max(0, 1 - Math.hypot(dx, dy) / (wid + 0.5));
          if (e > 0) { toward(k, [196, 188, 170], a * e * 0.35); rf[k] -= 0.03 * e * 0.35; }
        }
      }
    }
    // a crack in from an edge, jagged, a hair's breadth and dark, lower on one side
    if (slab.crack) {
      const fromTop = rnd() < 0.5;
      let x = W * (0.2 + rnd() * 0.6), y = fromTop ? 0 : Hh, dir = (fromTop ? 1 : -1) * Math.PI / 2 + (rnd() - 0.5) * 0.9;
      const len = Hh * (0.35 + rnd() * 0.75), aim = dir;
      for (let t = 0; t < len; t += 0.5) {
        dir += (rnd() - 0.5) * 0.4 + (aim - dir) * 0.04;
        x += Math.cos(dir) * 0.5; y += Math.sin(dir) * 0.5;
        const taper = 1 - (t / len) ** 2;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const k = canvasAt(row, s, x + dx, y + dy);
          if (k < 0 || slabAt[k] !== sl || D[k] < -0.5) continue;
          const e = Math.max(0, 1 - Math.hypot(dx, dy) / (0.6 + 0.6 * taper)) * taper;
          if (e > 0) { toward(k, [52, 45, 37], 0.45 * e); hf[k] -= 1.1 * e; rf[k] += 0.15 * e; }
        }
      }
    }
  }));
  // Pits: specks darker, lower and rougher at once.
  for (let q = 0, count = Math.round(n / 420); q < count; q++) {
    const i0 = Math.floor(rnd() * size), j0 = Math.floor(rnd() * size), s2 = rnd() < 0.8 ? 1 : 2, a = 0.1 + rnd() * 0.25;
    for (let dy = 0; dy < s2; dy++) for (let dx = 0; dx < s2; dx++) {
      const k = ((j0 + dy) % size) * size + ((i0 + dx) % size);
      if (D[k] < 1) continue;
      toward(k, [40, 34, 28], a);
      hf[k] -= 0.7 * a * 2;
      rf[k] += 0.2 * a;
    }
  }

  const [col, c] = canvas(size);
  const [rou, rg] = canvas(size);
  const C = c.createImageData(size, size), Rr = rg.createImageData(size, size);
  for (let k = 0; k < n; k++) {
    const o = k * 4;
    C.data[o] = cf[k * 3]; C.data[o + 1] = cf[k * 3 + 1]; C.data[o + 2] = cf[k * 3 + 2]; C.data[o + 3] = 255;
    Rr.data[o] = idOf[k] * 16 + 8;
    Rr.data[o + 1] = Math.max(0, Math.min(1, rf[k])) * 255;
    Rr.data[o + 2] = (home[k] + 1) * 127.5;
    Rr.data[o + 3] = 255;
  }
  c.putImageData(C, 0, 0);
  rg.putImageData(Rr, 0, 0);
  return {
    map: toTexture(col),
    normalMap: toTexture(normalsFromField(hf, size, size), { srgb: false }),
    roughnessMap: toTexture(rou, { srgb: false }),
  };
}

// ── Wood ──────────────────────────────────────────────────────────────────────

// Old walnut under a darkened varnish: the grain runs along u.
// `tone`: the wood. Shelf walnut is nearly black and takes the gilt off a spine;
// the garden's posts and rails stand out under a moon and want a weathered
// cedar, which is the same grain four times as pale — a dark map cannot be
// tinted UP, only down, so the pale one has to be painted pale.
export const WALNUT = { base: '#3a2618', dark: '16,9,5', light: '120,84,52', fleck: '10,6,3' };
export const CEDAR = { base: '#7d6247', dark: '64,48,33', light: '186,158,120', fleck: '52,38,26' };

export function walnut({ size = 512, seed = 5, tone = WALNUT } = {}) {
  const rnd = makeRng(seed);
  const [col, c] = canvas(size);
  const [hei, hg] = canvas(size);
  const [rou, rg] = canvas(size);
  c.fillStyle = tone.base;
  c.fillRect(0, 0, size, size);
  hg.fillStyle = grey(128);
  hg.fillRect(0, 0, size, size);
  rg.fillStyle = grey(120);
  rg.fillRect(0, 0, size, size);
  const phase = rnd() * 10;
  for (let y = 0; y < size; y++) {
    const band = Math.sin(y * 0.09 + Math.sin(y * 0.013 + phase) * 4) * 0.5 + 0.5;
    const fine = rnd();
    c.fillStyle = `rgba(${band < 0.5 ? tone.dark : tone.light},${0.05 + Math.abs(band - 0.5) * 0.24 + fine * 0.05})`;
    c.fillRect(0, y, size, 1);
    hg.fillStyle = grey(110 + band * 40 + fine * 10);
    hg.fillRect(0, y, size, 1);
  }
  for (let k = 0; k < 900; k++) {
    const y = rnd() * size, x = rnd() * size, len = 20 + rnd() * 140;
    c.fillStyle = `rgba(${tone.fleck},${0.06 + rnd() * 0.12})`;
    c.fillRect(x, y, len, 1);
    hg.fillStyle = 'rgba(0,0,0,0.25)';
    hg.fillRect(x, y, len, 1);
    rg.fillStyle = 'rgba(255,255,255,0.12)';
    rg.fillRect(x, y, len, 1);
  }
  soil(c, rnd, size, 12, 0.2);
  return {
    map: toTexture(col),
    normalMap: toTexture(normalsFrom(hei, 1.2), { srgb: false }),
    roughnessMap: toTexture(rou, { srgb: false }),
  };
}

// ── Timber ────────────────────────────────────────────────────────────────────
// 2026-10-05 the reader asked for better wood. `walnut` above draws one sine
// band per row of the canvas with its own random strength, which at any
// distance is a barcode of straight lines — brushed metal, not a board — and
// it does not wrap top to bottom. This paints a board as a board is: a log
// sawn through. The growth rings are the contours of the distance from the
// pith, so where the saw ran near the heart they close into the arches of a
// flat-sawn face and towards the edge they straighten into stripes; the rings
// are of uneven width, year to year, which is the figure the eye still finds
// when a single ring is too fine to see; and there are pores, mineral streaks,
// a knot or two, and — out of doors — checks and raised grain.
//
// The grain runs along u (the canvas's width), which is twice its height, and
// everything is drawn from noise on a lattice that wraps, so it tiles both ways.

// Value noise on an `nx` × `ny` lattice over the whole canvas; x and y in 0..1.
const lattice = (rnd, nx, ny) => ({ nx, ny, a: Float32Array.from({ length: nx * ny }, () => rnd() * 2 - 1) });
const latticeAt = ({ nx, ny, a }, x, y) => {
  const fx = x * nx, fy = y * ny, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
  ty = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
  // (wrapped with two remainders, not six: this is the hottest line of the
  // timber and the pavement both, and the answer is the same)
  let x0 = ix % nx, y0 = iy % ny;
  if (x0 < 0) x0 += nx;
  if (y0 < 0) y0 += ny;
  const x1 = x0 + 1 === nx ? 0 : x0 + 1, r0 = y0 * nx, r1 = (y0 + 1 === ny ? 0 : y0 + 1) * nx;
  const top = a[r0 + x0] + (a[r0 + x1] - a[r0 + x0]) * tx, bot = a[r1 + x0] + (a[r1 + x1] - a[r1 + x0]) * tx;
  return top + (bot - top) * ty;
};
// octaves of it, each lattice twice as fine, summed to about -1..1
const wrapNoise = (rnd, nx, ny, octaves = 3) => {
  const ls = Array.from({ length: octaves }, (_, k) => lattice(rnd, nx << k, ny << k));
  return (x, y) => {
    let s = 0, amp = 1, norm = 0;
    for (let o = 0; o < ls.length; o++) { s += latticeAt(ls[o], x, y) * amp; norm += amp; amp *= 0.5; }
    return (s / norm) * 1.6;
  };
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The woods, as sRGB triples: earlywood (the pale part of a ring), latewood
// (the dark), the streaks the minerals leave, and the colour a pore is.
// `finish`: varnished and rubbed (the Library's cases) or out in the weather
// (the garden's posts and boards). Their mean colours are the old `walnut`
// and `CEDAR`'s, so a room keeps the key it was graded to.
// `rings`: how much of the colour the rings carry. Walnut's are soft — its
// figure is streaks of tone and its pores — and a softwood's are bold.
export const WALNUT_WOOD = { early: [66, 44, 29], late: [35, 22, 14], streak: [31, 25, 20], pore: [15, 9, 5], rings: 0.55, finish: 'varnish' };
export const CEDAR_WOOD = { early: [150, 121, 90], late: [92, 68, 47], streak: [104, 94, 82], pore: [40, 30, 22], rings: 0.8, finish: 'weather' };

export function timber({ w = 1024, h = 512, seed = 5, tone = WALNUT_WOOD, ring = 7, knots = 1, strength = 2.2 } = {}) {
  const rnd = makeRng(seed);
  const weather = tone.finish === 'weather';
  const n = w * h;
  // the fields the board is drawn from (all wrap)
  const warpBig = wrapNoise(rnd, 1, 3, 3);       // the grain's long sway across the board
  const warpFine = wrapNoise(rnd, 2, 24, 2);     // and its small wander, long along u
  const depth = wrapNoise(rnd, 2, 1, 2);         // how deep under the bark the saw ran, along u
  const contrast = wrapNoise(rnd, 2, 12, 2);     // how strongly a ring shows
  const streaks = wrapNoise(rnd, 1, 20, 3);      // tone in long streaks along the grain
  const mineral = wrapNoise(rnd, 1, 36, 2);      // walnut's dark mineral streaks,
  const broken = wrapNoise(rnd, 6, 4, 2);        // which come and go along the board
  const grime = wrapNoise(rnd, 2, 2, 3);         // hands, soot and sun over the whole face
  const fibre = wrapNoise(rnd, 16, 256, 1);      // the fibre itself, a pixel or two across
  const p1 = rnd() * 6.283, p2 = rnd() * 6.283, p3 = rnd() * 6.283, pd = rnd();
  // The cut's depth changes slowly along the board, against the rings' fast
  // change across it, and that ratio is the arches' length: a flat-sawn arch
  // is five or ten times longer than it is wide. (At 0.38 of the height they
  // came out round, a contour map of hills.) And it changes by only a few
  // rings, so the eye where the saw came nearest the heart nests a few loops,
  // not a target of seventeen.
  const D0 = h * (0.2 + rnd() * 0.05), D1 = h * 0.07;
  // A knot: where a branch left the trunk. The rings bulge round it, long
  // along the grain, and its own end grain shows dark in the middle.
  const knotList = Array.from({ length: knots }, () => ({ x: rnd() * w, y: rnd() * h, r: (weather ? 7 : 4) + rnd() * (weather ? 9 : 5) }));
  const wrapD = (d, span) => d - span * Math.round(d / span);
  const S = h / Math.PI;
  const phase = new Float32Array(n), cm = new Float32Array(n), knotCore = new Float32Array(n);
  const cut = Float32Array.from({ length: w }, (_, i) => D0 + D1 * (0.5 + 0.5 * Math.sin(6.2832 * (i / w + pd))) + h * 0.035 * depth(i / w, 0));
  for (let j = 0; j < h; j++) {
    const y = j / h;
    for (let i = 0; i < w; i++) {
      const x = i / w, k = j * w + i;
      // across the board, wandering; then the distance from the pith (one
      // per canvas height, so sin² wraps) and the depth of the cut
      const yy = j + warpBig(x, y) * 22 + warpFine(x, y) * 2.5;
      const s = S * Math.sin((Math.PI * yy) / h);
      const d = cut[i];
      let R = Math.sqrt(d * d + s * s);
      let core = 0;
      for (const kn of knotList) {
        const dx = wrapD(i - kn.x, w) / (kn.r * 3.2), dy = wrapD(j - kn.y, h) / kn.r;
        const e = dx * dx * 0.35 + dy * dy;
        R += kn.r * 2.2 * Math.exp(-e * 0.5);
        core = Math.max(core, Math.exp(-((dx * 3.2) ** 2 + dy * dy) * 0.9));
      }
      // years of uneven growth: rings bunched in some, open in others (kept
      // under 1/ring in slope, so the rings never run backwards)
      phase[k] = R / ring + 0.9 * Math.sin(R / 23 + p1) + 0.45 * Math.sin(R / 9.7 + p2) + 0.25 * Math.sin(R / 61 + p3);
      cm[k] = (0.62 + 0.38 * Math.max(-1, Math.min(1, contrast(x, y)))) * (tone.rings ?? 1);
      knotCore[k] = core;
    }
  }
  const [col, c] = canvas(w, h);
  const [hei, hg] = canvas(w, h);
  const [rou, rg] = canvas(w, h);
  const C = c.createImageData(w, h), H = hg.createImageData(w, h), Rr = rg.createImageData(w, h);
  const hf = new Float32Array(n), rf = new Float32Array(n), cf = new Float32Array(n * 3);
  const { early, late, streak, pore } = tone;
  for (let j = 0; j < h; j++) {
    const y = j / h;
    for (let i = 0; i < w; i++) {
      const x = i / w, k = j * w + i;
      // How far apart the rings are here, in pixels: where they crowd under
      // two, a ring is finer than the canvas can draw and only its mean is
      // painted (the mips would do it anyway, as moiré on the way).
      const gx = phase[j * w + ((i + 1) % w)] - phase[j * w + ((i - 1 + w) % w)];
      const gy = phase[((j + 1) % h) * w + i] - phase[((j - 1 + h) % h) * w + i];
      const spacing = 2 / Math.max(1e-4, Math.hypot(gx, gy));
      const f = phase[k] - Math.floor(phase[k]);
      // the year's ring: pale earlywood darkening slowly into latewood, then
      // the sharp step into the next spring
      const lwRaw = weather ? smooth(0.45, 0.9, f) * (1 - smooth(0.93, 1, f)) : smooth(0.55, 0.92, f) * (1 - smooth(0.95, 1, f));
      const lw = 0.3 + (lwRaw - 0.3) * smooth(1.6, 3.2, spacing);
      const ring_ = lw * cm[k], fb = fibre(x, y);
      let r = early[0] + (late[0] - early[0]) * ring_, g = early[1] + (late[1] - early[1]) * ring_, b = early[2] + (late[2] - early[2]) * ring_;
      // long streaks of tone, and the fibre
      const t = 1 + (weather ? 0.12 : 0.2) * streaks(x, y) + 0.05 * fb;
      r *= t; g *= t; b *= t;
      // mineral streaks (walnut: long, thin, grey-dark) / weathered silver
      // (cedar, most in the soft earlywood)
      const m = weather ? 0.22 + 0.25 * (1 - lw) : 0.45 * smooth(0.55, 0.9, mineral(x, y)) * smooth(-0.1, 0.5, broken(x, y));
      r += (streak[0] - r) * m; g += (streak[1] - g) * m; b += (streak[2] - b) * m;
      const kc = knotCore[k];
      if (kc > 0.01) { const a = smooth(0.15, 0.7, kc) * 0.85; r += (pore[0] - r) * a; g += (pore[1] - g) * a; b += (pore[2] - b) * a; }
      const gr = grime(x, y);
      const soilK = 1 - 0.1 * Math.max(0, gr);
      cf[k * 3] = r * soilK; cf[k * 3 + 1] = g * soilK; cf[k * 3 + 2] = b * soilK;
      // relief: under varnish level, but for the pores; weathered, the soft
      // earlywood has gone and the latewood stands proud, and a knot proudest
      hf[k] = weather ? 0.5 + 0.2 * lw * cm[k] + 0.05 * fb + 0.12 * smooth(0.2, 0.8, kc) : 0.5 + 0.01 * lw + 0.02 * fb;
      // A rubbed varnish has one sheen over the rings — dulled by grime, the
      // pores and a little by the open earlywood. (With the latewood glossier
      // by 0.06, a lamp over a wide shelf lit the rings of a cathedral as
      // bright lines and drew a target on it.) Weathered wood has no sheen.
      rf[k] = weather ? 0.84 - 0.08 * lw + 0.05 * fb : 0.4 + 0.015 * (1 - lw) + 0.1 * Math.max(0, gr) - 0.06 * Math.max(0, -gr);
    }
  }
  // Pores, cut along the grain: walnut's are scattered and fine. Cedar has
  // none to speak of; it has checks — the splits the sun opens along a post.
  const along = (k0, len, fn) => { const j = Math.floor(k0 / w), i0 = k0 % w; for (let q = 0; q < len; q++) fn(j * w + ((i0 + q) % w), q / len); };
  if (!weather) {
    // (faint: the canvas's pixel is wider than a pore, and at full strength
    // a case seen from a step away was ruled with dashes)
    for (let q = 0, count = Math.round(n / 70); q < count; q++) {
      const a = 0.16 + rnd() * 0.3;
      along(Math.floor(rnd() * n), 2 + Math.floor(rnd() * 7), (k, u) => {
        const e = a * Math.sin(Math.PI * (0.15 + 0.7 * u));
        for (let ch = 0; ch < 3; ch++) cf[k * 3 + ch] += (pore[ch] - cf[k * 3 + ch]) * e;
        hf[k] -= 0.07 * e;
        rf[k] += 0.25 * e;
      });
    }
  } else {
    for (let q = 0; q < 26; q++) {
      const len = 40 + Math.floor(rnd() * 260), a = 0.5 + rnd() * 0.4;
      let jj = rnd() * h;
      const i0 = Math.floor(rnd() * w), drift = (rnd() - 0.5) * 0.04;
      for (let p = 0; p < len; p++) {
        jj += drift + (rnd() - 0.5) * 0.15;
        const k = (((Math.floor(jj) % h) + h) % h) * w + ((i0 + p) % w);
        const e = a * Math.sin(Math.PI * (p / len)) ** 0.5;
        for (let ch = 0; ch < 3; ch++) cf[k * 3 + ch] += (pore[ch] - cf[k * 3 + ch]) * e;
        hf[k] -= 0.3 * e;
        rf[k] += 0.1 * e;
      }
    }
  }
  for (let k = 0; k < n; k++) {
    const o = k * 4;
    C.data[o] = cf[k * 3]; C.data[o + 1] = cf[k * 3 + 1]; C.data[o + 2] = cf[k * 3 + 2]; C.data[o + 3] = 255;
    H.data[o] = H.data[o + 1] = H.data[o + 2] = Math.max(0, Math.min(255, hf[k] * 255)); H.data[o + 3] = 255;
    Rr.data[o] = Rr.data[o + 1] = Rr.data[o + 2] = Math.max(0, Math.min(255, rf[k] * 255)); Rr.data[o + 3] = 255;
  }
  c.putImageData(C, 0, 0);
  hg.putImageData(H, 0, 0);
  rg.putImageData(Rr, 0, 0);
  return {
    map: toTexture(col),
    normalMap: toTexture(normalsFrom(hei, strength), { srgb: false }),
    roughnessMap: toTexture(rou, { srgb: false }),
  };
}

// ── Bindings ──────────────────────────────────────────────────────────────────

export const SPINE_COLS = 16;
export const SPINE_ROWS = 4;

/// The book-spine atlas: SPINE_COLS × SPINE_ROWS spines, each drawn upright
// with its top at the top of its cell. Two textures:
//   detail  grey leather — the roundness of the spine, grain, scuffs, the
//           raised bands' light and shadow — multiplied into each book's own
//           binding colour in the shader
//   mask    R gilt (tooled gold lines, titles, fleurons), G paper label,
//           B height (the raised bands), all in linear space
//
// The rows are KINDS of binding, so a shelf can be dressed the way a library
// is rather than drawn from one pattern (see SPINE_KINDS). Every spine used to
// be three-quarters gilded with the same fleuron in every panel, and a wall
// of them was one repeating ornament — wallpaper, not books.
//   row 0   rich     gilt bands, a label or a tooled panel, fleurons
//   row 1   label    raised bands and a label; gilt on the label, at most
//   row 2   plain    raised bands, blind-tooled, no gold at all
//   row 3   cloth (cols 0-7): no bands, a small gilt title near the head
//           vellum (cols 8-15): smooth and pale, an inked title, no bands
export const SPINE_KINDS = { rich: [0, 16], label: [16, 32], plain: [32, 48], cloth: [48, 56], vellum: [56, 64] };
export function spineAtlas({ cellW = 64, cellH = 256, seed = 23 } = {}) {
  const rnd = makeRng(seed);
  const W = cellW * SPINE_COLS, H = cellH * SPINE_ROWS;
  const [det, d] = canvas(W, H);
  const [msk, m] = canvas(W, H);
  d.fillStyle = grey(150);
  d.fillRect(0, 0, W, H);
  m.fillStyle = 'rgb(0,0,110)';
  m.fillRect(0, 0, W, H);
  for (let row = 0; row < SPINE_ROWS; row++) {
    for (let colIdx = 0; colIdx < SPINE_COLS; colIdx++) {
      const x0 = colIdx * cellW, y0 = row * cellH;
      const kind = row === 0 ? 'rich' : row === 1 ? 'label' : row === 2 ? 'plain' : colIdx < 8 ? 'cloth' : 'vellum';
      const smooth = kind === 'cloth' || kind === 'vellum';
      const base = kind === 'vellum' ? 152 + rnd() * 22 : kind === 'cloth' ? 146 + rnd() * 28 : 130 + rnd() * 70;
      // the round of the spine: dark at both edges, light down the crown
      // (vellum and cloth are flatter-backed, so their edges fall off less)
      const edge = smooth ? 0.68 : 0.45;
      const round = d.createLinearGradient(x0, 0, x0 + cellW, 0);
      round.addColorStop(0, grey(base * edge));
      round.addColorStop(0.35, grey(base * 1.05));
      round.addColorStop(0.55, grey(base));
      round.addColorStop(1, grey(base * (edge - 0.03)));
      d.fillStyle = round;
      d.fillRect(x0, y0, cellW, cellH);
      if (kind === 'cloth') {
        // a fine weave instead of grain
        for (let k = 0; k < cellW; k += 2) { d.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.03})`; d.fillRect(x0 + k, y0, 1, cellH); }
        for (let k = 0; k < cellH; k += 2) { d.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.03})`; d.fillRect(x0, y0 + k, cellW, 1); }
      } else {
        for (let k = 0; k < (kind === 'vellum' ? 160 : 420); k++) {
          const a = rnd() * (kind === 'vellum' ? 0.06 : 0.12);
          d.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
          d.fillRect(x0 + rnd() * cellW, y0 + rnd() * cellH, 1 + rnd() * 2, 1 + rnd() * 2);
        }
      }
      // head and tail caps, worn paler
      for (const [yy, hh] of [[y0, 9], [y0 + cellH - 9, 9]]) {
        d.fillStyle = `rgba(0,0,0,${smooth ? 0.18 : 0.35})`;
        d.fillRect(x0, yy, cellW, hh);
        d.fillStyle = 'rgba(255,240,220,0.12)';
        d.fillRect(x0, yy + (yy === y0 ? hh - 2 : 0), cellW, 2);
      }
      // scuffs along the joints
      for (let k = 0; k < 12; k++) {
        d.fillStyle = `rgba(255,236,210,${0.06 + rnd() * 0.1})`;
        const side = rnd() < 0.5 ? x0 + 1 + rnd() * 6 : x0 + cellW - 7 + rnd() * 6;
        d.fillRect(side, y0 + rnd() * cellH, 2 + rnd() * 3, 3 + rnd() * 16);
      }
      const gilt = (x, y, w, h) => { m.fillStyle = 'rgb(255,0,110)'; m.fillRect(x, y, w, h); };
      if (kind === 'vellum') {
        // an inked title down the spine, by hand: short strokes, not quite level
        const ty = y0 + cellH * (0.16 + rnd() * 0.08);
        for (let t = 0; t < 3 + Math.floor(rnd() * 3); t++) {
          d.fillStyle = `rgba(52,32,14,${0.45 + rnd() * 0.25})`;
          d.fillRect(x0 + 14 + rnd() * 6, ty + t * 9, cellW - 34 - rnd() * 10, 2.4);
        }
        // a shelf-mark near the tail
        d.fillStyle = 'rgba(52,32,14,0.5)';
        d.fillRect(x0 + cellW / 2 - 6, y0 + cellH * 0.86, 12, 3);
        continue;
      }
      if (kind === 'cloth') {
        const ty = y0 + cellH * 0.12;
        gilt(x0 + 4, y0 + 12, cellW - 8, 1.5);
        gilt(x0 + 4, y0 + cellH - 14, cellW - 8, 1.5);
        gilt(x0 + 12, ty + 4, cellW - 24, 2.5);
        gilt(x0 + 16, ty + 11, cellW - 32, 2);
        continue;
      }
      const bands = 4 + (rnd() < 0.5 ? 1 : 0);
      const top = y0 + cellH * 0.1, span = cellH * 0.8;
      const bandYs = Array.from({ length: bands }, (_, i) => top + (span * (i + 0.5)) / bands);
      const bandGilt = kind === 'rich' || (kind === 'label' && rnd() < 0.5);
      for (const by of bandYs) {
        const ridge = d.createLinearGradient(0, by - 5, 0, by + 5);
        ridge.addColorStop(0, 'rgba(255,245,225,0.28)');
        ridge.addColorStop(0.5, 'rgba(255,245,225,0.08)');
        ridge.addColorStop(1, 'rgba(0,0,0,0.45)');
        d.fillStyle = ridge;
        d.fillRect(x0, by - 5, cellW, 10);
        // the band stands proud of the leather: 220 over its width, 255 on
        // its crown (these were drawn additively once, onto the 110 ground)
        m.fillStyle = 'rgb(0,0,220)';
        m.fillRect(x0, by - 4, cellW, 8);
        m.fillStyle = 'rgb(0,0,255)';
        m.fillRect(x0, by - 2, cellW, 4);
        if (bandGilt) {
          gilt(x0 + 3, by - 7, cellW - 6, 1.5);
          gilt(x0 + 3, by + 6, cellW - 6, 1.5);
        } else if (kind === 'plain') {
          // blind tooling: the same fillets pressed in without gold
          d.fillStyle = 'rgba(0,0,0,0.3)';
          d.fillRect(x0 + 3, by - 7, cellW - 6, 1.2);
          d.fillRect(x0 + 3, by + 6, cellW - 6, 1.2);
        }
      }
      if (kind === 'plain') continue;
      // between the first two bands: a label, of paper or of dark morocco
      const ly0 = bandYs[0] + 9, ly1 = bandYs[1] - 9;
      if (rnd() < (kind === 'label' ? 0.55 : 0.4)) {
        m.fillStyle = 'rgb(0,230,110)';
        m.fillRect(x0 + 8, ly0, cellW - 16, ly1 - ly0);
        d.fillStyle = 'rgba(0,0,0,0.5)';
        for (let t = ly0 + 8; t < ly1 - 6; t += 7) d.fillRect(x0 + 13 + rnd() * 4, t, cellW - 30 - rnd() * 10, 2);
      } else {
        d.fillStyle = 'rgba(0,0,0,0.42)';
        d.fillRect(x0 + 6, ly0, cellW - 12, ly1 - ly0);
        m.strokeStyle = 'rgb(255,0,110)';
        m.lineWidth = 1.2;
        m.strokeRect(x0 + 8, ly0 + 2, cellW - 16, ly1 - ly0 - 4);
        for (let t = ly0 + 9; t < ly1 - 8; t += 8) gilt(x0 + 14 + rnd() * 3, t, cellW - 28 - rnd() * 8, 2.5);
      }
      // fleurons in the other panels: the rich bindings only
      if (kind === 'rich') {
        m.fillStyle = 'rgb(255,0,110)';
        for (let i = 1; i < bands - 1; i++) {
          const cy = (bandYs[i] + bandYs[i + 1]) / 2, cx = x0 + cellW / 2;
          m.beginPath();
          m.arc(cx, cy, 2.6, 0, Math.PI * 2);
          m.fill();
          for (const [dx, dy] of [[-6, 0], [6, 0], [0, -7], [0, 7]]) m.fillRect(cx + dx - 1, cy + dy - 1, 2, 2);
        }
      }
    }
  }
  return {
    detail: toTexture(det, { anisotropy: 4 }),
    mask: toTexture(msk, { srgb: false, anisotropy: 4 }),
    hide: bindingHide(),
  };
}

// ── Lettered spines ───────────────────────────────────────────────────────────
// The atlas above lettered nothing: a label was a pale box with three grey
// bars on it, and a gilt one three gold bars in a frame, so up close a shelf
// read as a wall of placeholders. Now the atlas paints only the leather and
// its tooling, and the books are lettered in the shader (makeBookMaterial),
// in units of each book's own spine, from a second atlas of titles: so a
// label is the size a binder would cut it whatever the book's size, and no
// letter is stretched with the spine it is on.
//
// Where each spine of the atlas keeps its title: the compartments between
// its raised bands, as fractions of the spine down from its head. The atlas
// is painted from the same layout, and makeBookMaterial reads it as it
// compiles — before the paint arrives — so it has its own stream and costs
// nothing to make twice.
//   title   the compartment the title is in (the second, as on a calf
//           binding: the first, at the head, is the binder's ornament)
//   vol     the compartment a volume number goes in, under it
//   style   how it is lettered (TITLE_STYLE)
export const TITLE_STYLE = { none: 0, paper: 1, morocco: 2, gilt: 3, blind: 4, vellum: 5, cloth: 6 };
// a band and its fillets, in fractions of a spine (the 64 × 256 atlas drew a
// band ±4 px and its fillets 7 px off it)
const BAND_HALF = 4 / 256, FILLET_AT = 7.5 / 256;
export function spineLayout({ seed = 31 } = {}) {
  const rnd = makeRng(seed);
  const S = TITLE_STYLE;
  const cells = [];
  for (let row = 0; row < SPINE_ROWS; row++) {
    for (let col = 0; col < SPINE_COLS; col++) {
      const kind = row === 0 ? 'rich' : row === 1 ? 'label' : row === 2 ? 'plain' : col < 8 ? 'cloth' : 'vellum';
      // cloth: a title blocked in gold at the head, VOL. under it
      if (kind === 'cloth') { cells.push({ kind, bands: [], style: S.cloth, title: [0.075, 0.27], vol: [0.29, 0.36], bandGilt: false }); continue; }
      // vellum: written by hand up the spine, the volume across it below
      if (kind === 'vellum') { cells.push({ kind, bands: [], style: S.vellum, title: [0.12, 0.62], vol: [0.66, 0.74], bandGilt: false }); continue; }
      const n = 4 + (rnd() < 0.5 ? 1 : 0);
      const bands = Array.from({ length: n }, (_, i) => 0.1 + (0.8 * (i + 0.5)) / n);
      const inner = (i) => [bands[i] + FILLET_AT + 0.008, bands[i + 1] - FILLET_AT - 0.008];
      const r = rnd();
      const style = kind === 'rich' ? (r < 0.7 ? S.morocco : S.gilt)
        : kind === 'label' ? (r < 0.55 ? S.paper : S.morocco)
          : (r < 0.65 ? S.blind : S.paper);
      cells.push({ kind, bands, style, title: inner(0), vol: inner(1), bandGilt: kind === 'rich' || (kind === 'label' && rnd() < 0.5) });
    }
  }
  return cells;
}

// The spine atlas for lettered books: SPINE_COLS × SPINE_ROWS cells at twice
// the old resolution (128 × 512 — up close a spine is half a metre of leather,
// and 64 texels across it were a blur), all in ONE map, linear:
//   R  gilt    the tooling in gold: fillets, rolls on the bands, fleurons
//   G  detail  the leather's grey (sRGB-coded; the shader decodes it), which
//              the old atlas kept in a map of its own
//   B  height  the raised bands (110 is the ground, as before)
// The round of the spine is no longer painted: the shader bends the normal
// across it, so the lamps light the crown and the joints fall away as the
// reader moves. What is painted is the dark in the joints.
export function spineAtlas2({ cellW = 128, cellH = 512, seed = 23 } = {}) {
  const rnd = makeRng(seed);
  const layout = spineLayout();
  const W = cellW * SPINE_COLS, H = cellH * SPINE_ROWS, k = cellW / 64;
  const [, d] = canvas(W, H);
  const [, g] = canvas(W, H);
  const [, h] = canvas(W, H);
  d.fillStyle = grey(150); d.fillRect(0, 0, W, H);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  h.fillStyle = grey(110); h.fillRect(0, 0, W, H);
  const GOLD = '#fff';
  layout.forEach((cell, i) => {
    const x0 = (i % SPINE_COLS) * cellW, y0 = Math.floor(i / SPINE_COLS) * cellH;
    const Y = (t) => y0 + (0.01 + 0.98 * t) * cellH;     // down the spine from its head
    const { kind } = cell;
    const smooth = kind === 'cloth' || kind === 'vellum';
    d.save();
    d.beginPath(); d.rect(x0, y0, cellW, cellH); d.clip();
    g.save();
    g.beginPath(); g.rect(x0, y0, cellW, cellH); g.clip();
    const base = kind === 'vellum' ? 152 + rnd() * 22 : kind === 'cloth' ? 146 + rnd() * 28 : 130 + rnd() * 70;
    const edge = smooth ? 0.82 : 0.66;
    const round = d.createLinearGradient(x0, 0, x0 + cellW, 0);
    round.addColorStop(0, grey(base * edge));
    round.addColorStop(0.1, grey(base * 0.96));
    round.addColorStop(0.5, grey(base));
    round.addColorStop(0.9, grey(base * 0.96));
    round.addColorStop(1, grey(base * (edge - 0.03)));
    d.fillStyle = round;
    d.fillRect(x0, y0, cellW, cellH);
    if (kind === 'cloth') {
      // a fine weave instead of grain, and the cloth's own ribbed grain
      for (let x = 0; x < cellW; x += 2) { d.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.03})`; d.fillRect(x0 + x, y0, 1, cellH); }
      for (let y = 0; y < cellH; y += 2) { d.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.03})`; d.fillRect(x0, y0 + y, cellW, 1); }
    } else {
      // (as many specks as the old atlas had, each twice the size; the finest
      // grain is noise laid over the whole atlas below, which is far cheaper
      // than four times the specks)
      for (let n = 0, count = kind === 'vellum' ? 160 : 420; n < count; n++) {
        const a = rnd() * (kind === 'vellum' ? 0.06 : 0.12);
        d.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
        d.fillRect(x0 + rnd() * cellW, y0 + rnd() * cellH, (1 + rnd() * 2) * k, (1 + rnd() * 2) * k);
      }
    }
    if (!smooth) {
      // Old calf cracks ACROSS the spine, where it flexed every time the book
      // was opened: fine dark breaks with a pale lip, thickest toward the head
      // and the tail, where hands pull a book from the shelf.
      for (let n = 0, count = 14 + Math.floor(rnd() * 26); n < count; n++) {
        const t = rnd() < 0.6 ? (rnd() < 0.5 ? rnd() * 0.18 : 1 - rnd() * 0.18) : rnd();
        let x = x0 + 4 * k + rnd() * (cellW - 8 * k), y = Y(t);
        const len = (5 + rnd() ** 2 * 26) * k, dark = 0.22 + rnd() * 0.25;
        d.lineCap = 'round';
        for (const [style, dy, lw] of [[`rgba(255,238,215,${dark * 0.35})`, 1, 0.9], [`rgba(0,0,0,${dark})`, 0, 0.8]]) {
          d.strokeStyle = style;
          d.lineWidth = lw;
          d.beginPath();
          let xx = x, yy = y + dy;
          d.moveTo(xx, yy);
          for (let s = 0; s < 5; s++) { xx += len / 5; yy += (rnd() - 0.5) * 2.2; d.lineTo(xx, yy); }
          d.stroke();
        }
        x += len;
      }
    }
    // head and tail caps, worn paler
    for (const [yy, hh] of [[y0, 9 * k], [y0 + cellH - 9 * k, 9 * k]]) {
      d.fillStyle = `rgba(0,0,0,${smooth ? 0.18 : 0.35})`;
      d.fillRect(x0, yy, cellW, hh);
      d.fillStyle = 'rgba(255,240,220,0.12)';
      d.fillRect(x0, yy + (yy === y0 ? hh - 2 * k : 0), cellW, 2 * k);
    }
    // scuffs along the joints
    for (let n = 0; n < 20; n++) {
      d.fillStyle = `rgba(255,236,210,${0.06 + rnd() * 0.1})`;
      const side = rnd() < 0.5 ? x0 + k + rnd() * 6 * k : x0 + cellW - 7 * k + rnd() * 6 * k;
      d.fillRect(side, y0 + rnd() * cellH, (2 + rnd() * 3) * k, (3 + rnd() * 16) * k);
    }
    // Tooling: gold into R, and under it the impression the hot tool left in
    // the leather — darker, so where the gold has rubbed away the tooling
    // still shows, as it does on an old binding.
    const tool = (path) => {
      d.fillStyle = 'rgba(0,0,0,0.28)'; d.strokeStyle = 'rgba(0,0,0,0.2)'; d.lineWidth = 1.4 * k;
      path(d); d.fill(); d.stroke();
      g.fillStyle = GOLD;
      path(g); g.fill();
    };
    const bar = (x, y, w, hh) => tool((c) => { c.beginPath(); c.rect(x, y, w, hh); });
    const dot = (x, y, r) => tool((c) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); });
    const blind = (x, y, w, hh, a = 0.3) => { d.fillStyle = `rgba(0,0,0,${a})`; d.fillRect(x, y, w, hh); };
    const cx = x0 + cellW / 2;
    // a fleuron: one of a few tools, as a binder owned a few
    const fleuron = (cy, r, design) => {
      if (design === 0) {
        // four petals and a ring of points
        for (let q = 0; q < 4; q++) {
          const a = (q * Math.PI) / 2;
          tool((c) => { c.beginPath(); c.ellipse(cx + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.48, r * 0.36, r * 0.13, a, 0, Math.PI * 2); });
          dot(cx + Math.cos(a + Math.PI / 4) * r * 0.62, cy + Math.sin(a + Math.PI / 4) * r * 0.62, r * 0.07);
        }
        dot(cx, cy, r * 0.13);
      } else if (design === 1) {
        // a lozenge, open, with a point inside and one off each tip
        tool((c) => {
          c.beginPath();
          c.moveTo(cx, cy - r * 0.75); c.lineTo(cx + r * 0.5, cy); c.lineTo(cx, cy + r * 0.75); c.lineTo(cx - r * 0.5, cy); c.closePath();
          c.moveTo(cx, cy - r * 0.5); c.lineTo(cx - r * 0.3, cy); c.lineTo(cx, cy + r * 0.5); c.lineTo(cx + r * 0.3, cy); c.closePath();
        });
        dot(cx, cy, r * 0.1);
        for (const [dx, dy] of [[0, -0.95], [0, 0.95], [-0.7, 0], [0.7, 0]]) dot(cx + dx * r, cy + dy * r, r * 0.07);
      } else {
        // a star of eight rays round a boss
        tool((c) => {
          c.beginPath();
          for (let q = 0; q < 16; q++) {
            const a = (q * Math.PI) / 8, rr = q % 2 ? r * 0.22 : r * (q % 4 ? 0.55 : 0.8);
            c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          }
          c.closePath();
        });
        d.fillStyle = 'rgba(0,0,0,0.3)';
        d.beginPath(); d.arc(cx, cy, r * 0.12, 0, Math.PI * 2); d.fill();
      }
    };
    if (kind === 'cloth') {
      // the publisher's rules at head and tail, blocked in gold
      for (const t of [0.04, 0.052, 0.948, 0.96]) bar(x0 + 5 * k, Y(t), cellW - 10 * k, 1.4 * k);
      bar(x0 + 18 * k, Y(0.385), cellW - 36 * k, 1.2 * k);
    }
    if (kind === 'vellum') {
      // a shelf-mark in ink near the tail, and the sewing thongs laced through
      d.fillStyle = 'rgba(52,32,14,0.5)';
      d.fillRect(cx - 6 * k, Y(0.86), 12 * k, 3 * k);
      d.fillRect(cx - 3 * k, Y(0.885), 6 * k, 2.4 * k);
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        for (const x of [x0, x0 + cellW - 6 * k]) {
          d.fillStyle = 'rgba(70,50,30,0.16)';
          d.fillRect(x, Y(t) - 2 * k, 6 * k, 4 * k);
        }
      }
    }
    if (!smooth) {
      const bandGilt = cell.bandGilt, rich = kind === 'rich';
      for (const t of cell.bands) {
        const by = Y(t), bh = BAND_HALF * cellH, fy = FILLET_AT * cellH;
        const ridge = d.createLinearGradient(0, by - bh * 1.25, 0, by + bh * 1.25);
        ridge.addColorStop(0, 'rgba(255,245,225,0.28)');
        ridge.addColorStop(0.5, 'rgba(255,245,225,0.08)');
        ridge.addColorStop(1, 'rgba(0,0,0,0.45)');
        d.fillStyle = ridge;
        d.fillRect(x0, by - bh * 1.25, cellW, bh * 2.5);
        h.fillStyle = 'rgb(220,220,220)';
        h.fillRect(x0, by - bh, cellW, bh * 2);
        h.fillStyle = 'rgb(255,255,255)';
        h.fillRect(x0, by - bh / 2, cellW, bh);
        if (bandGilt) {
          bar(x0 + 3 * k, by - fy, cellW - 6 * k, 1.5 * k);
          bar(x0 + 3 * k, by + fy - 1.5 * k, cellW - 6 * k, 1.5 * k);
          if (rich) {
            // a second fillet outside each, and a rope roll run over the band
            // (slanted strokes, as the wheel of the tool leaves them)
            bar(x0 + 3 * k, by - fy - 3 * k, cellW - 6 * k, 0.9 * k);
            bar(x0 + 3 * k, by + fy + 2.1 * k, cellW - 6 * k, 0.9 * k);
            const rh = bh * 0.55;
            for (let x = x0 + 6 * k; x < x0 + cellW - 7 * k; x += 3.4 * k) {
              tool((c) => {
                c.beginPath();
                c.moveTo(x, by + rh); c.lineTo(x + 1.3 * k, by + rh);
                c.lineTo(x + 1.3 * k + rh * 0.9, by - rh); c.lineTo(x + rh * 0.9, by - rh);
                c.closePath();
              });
            }
          }
        } else if (kind === 'plain') {
          blind(x0 + 3 * k, by - fy, cellW - 6 * k, 1.2 * k);
          blind(x0 + 3 * k, by + fy - 1.2 * k, cellW - 6 * k, 1.2 * k);
        }
      }
      if (rich) {
        // rolls at the head and the tail
        for (const t of [0.035, 0.965]) {
          bar(x0 + 4 * k, Y(t) - 0.6 * k, cellW - 8 * k, 1.2 * k);
          for (let x = x0 + 7 * k; x < x0 + cellW - 7 * k; x += 6 * k) dot(x, Y(t) + (t < 0.5 ? 3.2 : -3.2) * k, 1 * k);
        }
      }
      // The compartments: the title's left bare (the shader letters it), an
      // ornament in the rest — on a rich binding a fleuron with a point in each
      // corner, on a gilt-banded one a small single tool, on the rest nothing.
      if (rich || bandGilt) {
        const design = Math.floor(rnd() * 3), corners = rich && rnd() < 0.6;
        const edges = [0.035, ...cell.bands, 0.965];
        for (let c = 0; c < edges.length - 1; c++) {
          // (and none under a number tooled straight onto the leather: the
          // shader can take the gold off an ornament, not its impression)
          if (c === 1 || (c === 2 && cell.style === TITLE_STYLE.gilt)) continue;
          const a = Y(edges[c]) + (c ? FILLET_AT * cellH + 2 * k : 4 * k), b = Y(edges[c + 1]) - FILLET_AT * cellH - 2 * k;
          if (b - a < 10 * k) continue;
          const cy = (a + b) / 2, r = Math.min(cellW * 0.3, (b - a) * 0.36);
          if (rich) fleuron(cy, r, design);
          else dot(cx, cy, Math.min(2.4 * k, r * 0.25));
          if (corners) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) dot(cx + sx * (cellW / 2 - 12 * k), cy + sy * ((b - a) / 2 - 6 * k), 1.3 * k);
        }
      }
    }
    d.restore();
    g.restore();
  });
  const D = d.getImageData(0, 0, W, H).data, G = g.getImageData(0, 0, W, H).data, Hh = h.getImageData(0, 0, W, H).data;
  const [out, o] = canvas(W, H);
  const img = o.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    // (a hash, not the stream: four million draws from it took a third of a second)
    let n = Math.imul(i, 0x9e3779b1);
    n = Math.imul(n ^ (n >>> 15), 0x85ebca77);
    const v = D[i * 4] + (((n ^ (n >>> 13)) >>> 24) - 128) * 0.055;
    img.data[i * 4] = G[i * 4];
    img.data[i * 4 + 1] = v < 0 ? 0 : v > 255 ? 255 : v;
    img.data[i * 4 + 2] = Hh[i * 4];
    img.data[i * 4 + 3] = 255;
  }
  o.putImageData(img, 0, 0);
  return { mask: toTexture(out, { srgb: false, anisotropy: 8 }), hide: bindingHide() };
}

// The titles: three pages of TITLE_COLS × TITLE_ROWS cells, one page to each
// of R, G and B, a title lettered in white on black in each cell, filling it
// as a binder fills a label (the shader fits the cell, not the letters, to
// the label, so the letters keep their shape on any book). The first
// NUMERALS slots are the volume numbers I to XVI.
//
// The Library's books are, as Borges says, almost all gibberish: so are most
// of their titles, set from his twenty-two letters with the comma, the full
// stop and the space, and set lower case (his books have no capitals) in an
// italic. The rest are the books the story names — Combed Thunder, The
// Plaster Cramp, Axaxaxas mlö, the catalogue of catalogues, the true story of
// your death — and the books of the man who wrote it, in English and in
// Spanish (the walk descends in one and climbs in the other), and the Latin
// of an old library's shelf.
export const TITLE_COLS = 8, TITLE_ROWS = 16, TITLE_PAGES = 3, NUMERALS = 16;
export const TITLE_ASPECT = 2;
export const TITLE_COUNT = TITLE_PAGES * TITLE_COLS * TITLE_ROWS - NUMERALS;
const TITLES = [
  // the story's own
  'COMBED THUNDER', 'THE PLASTER CRAMP', 'AXAXAXAS MLÖ', 'TRUENO PEINADO', 'EL CALAMBRE DE YESO',
  'M C V', 'DHCMRLCHTDJ', 'VINDICATIONS', 'VINDICACIONES', 'THE CATALOGUE OF CATALOGUES', 'CATÁLOGO DE CATÁLOGOS',
  'A FALSE CATALOGUE', 'THE FAITHFUL CATALOGUE', 'ON THE FALLACY OF THE TRUE CATALOGUE', 'THE GOSPEL OF BASILIDES',
  'COMMENTARY ON THE COMMENTARY', 'THE TRUE STORY OF YOUR DEATH', 'THE LOST BOOKS OF TACITUS', 'BEDE ON THE SAXONS',
  'AUTOBIOGRAPHIES OF THE ARCHANGELS', 'A HISTORY OF THE FUTURE', 'O TIME THY PYRAMIDS', 'OH TIEMPO TUS PIRÁMIDES',
  'THE MAN OF THE BOOK', 'EL HOMBRE DEL LIBRO', 'THE CRIMSON HEXAGON', 'EL HEXÁGONO CARMESÍ', 'THE TOTAL BOOK',
  'EL LIBRO TOTAL', 'THE CYCLIC BOOK', 'INTERPOLATIONS', 'A GRAMMAR OF GUARANÍ', 'THE ELEGANT HOPE',
  'UNLIMITED AND CYCLICAL', 'ILIMITADA Y PERIÓDICA', 'FOUR HUNDRED AND TEN PAGES', 'THE TWENTY-FIVE SYMBOLS',
  'ON THE HEXAGON', 'OF SPIRAL STAIRS', 'THE INQUISITORS', 'THE PURIFIERS', 'THE INFINITE LIBRARY',
  'LA BIBLIOTECA TOTAL', 'TRANSLATIONS OF EVERY BOOK', 'THE IMPERFECT LIBRARIAN',
  // the man who wrote it
  'THE GARDEN OF FORKING PATHS', 'EL JARDÍN DE SENDEROS QUE SE BIFURCAN', 'TLÖN, UQBAR, ORBIS TERTIUS',
  'A FIRST ENCYCLOPAEDIA OF TLÖN', 'THE BOOK OF SAND', 'EL LIBRO DE ARENA', 'THE ALEPH', 'EL ALEPH', 'THE ZAHIR',
  'PIERRE MENARD', 'THE APPROACH TO AL-MUTASIM', 'LABYRINTHS', 'LABERINTOS', 'THE SECRET MIRACLE', 'EL MILAGRO SECRETO',
  'THE WRITING OF THE GOD', 'THE IMMORTAL', 'EL INMORTAL', 'DEATH AND THE COMPASS', 'LA MUERTE Y LA BRÚJULA',
  'THE HOUSE OF ASTERION', 'LA CASA DE ASTERIÓN', 'HERBERT QUAIN', 'THE LOTTERY IN BABYLON', 'FUNES',
  'THE CIRCULAR RUINS', 'LAS RUINAS CIRCULARES', 'A NEW REFUTATION OF TIME', 'THE BOOK OF IMAGINARY BEINGS',
  'A UNIVERSAL HISTORY OF INFAMY', 'HISTORIA DE LA ETERNIDAD', 'FICCIONES', 'EL HACEDOR', 'DREAMTIGERS',
  'OTRAS INQUISICIONES', 'EL OTRO, EL MISMO', 'ELOGIO DE LA SOMBRA', 'EL ORO DE LOS TIGRES', 'DISCUSIÓN',
  'DEL RIGOR EN LA CIENCIA', 'TS’UI PÊN', 'THE ANGLO-AMERICAN CYCLOPAEDIA',
  // the galleries of this walk
  'THE VESTIBULE', 'THE ECHO', 'THE SILENCE', 'THE VERTIGO', 'THE DOOR', 'THE WEB OF TIME', 'EL ECO', 'EL SILENCIO',
  'EL VÉRTIGO', 'LA PUERTA', 'ESPEJOS', 'MIRRORS', 'ESCALERAS', 'THE LAMPS', 'LAS LÁMPARAS',
  // an old library's Latin
  'DE INFINITO', 'DE HEXAGONIS', 'BIBLIOTHECA UNIVERSALIS', 'SPECULUM MUNDI', 'OPERA OMNIA', 'ARS MAGNA',
  'DE ARTE COMBINATORIA', 'THEATRUM MUNDI', 'SUMMA', 'INDEX LIBRORUM', 'DE LABYRINTHO', 'DE NATURA RERUM',
  'MUNDUS SUBTERRANEUS', 'ETYMOLOGIAE', 'ORBIS PICTUS', 'DE SILENTIO', 'DE TEMPORE', 'ANNALES', 'CHRONICON',
  'SERMONES', 'EPISTOLAE', 'COMMENTARII', 'HISTORIA NATURALIS', 'DE SPECULIS', 'ARS MEMORIAE', 'LIBER LIBRORUM',
  'CODEX HEXAGONALIS', 'DE ORDINE', 'DE LUCE', 'FRAGMENTA', 'MISCELLANEA',
  // and its English and Spanish
  'SERMONS', 'ESSAYS', 'LETTERS', 'POEMS', 'ANNALS', 'MEMOIRS', 'DIALOGUES', 'TRAVELS', 'LEXICON', 'CONCORDANCE',
  'GLOSSES', 'TABLES OF THE STARS', 'A DICTIONARY OF THE LOST TONGUE', 'TRATADO DE LA ESFERA', 'MEMORIAS', 'CARTAS',
  'POESÍAS', 'CRÓNICAS', 'ON LAMPS AND THEIR OIL', 'OF THE AIR SHAFTS',
];
// Borges's twenty-two letters (he does not say which; these are twenty-two)
const LETTERS = 'abcdeghilmnopqrstuvxyz', VOWELS = 'aeiou';
const gibberish = (rnd) => {
  const pick = (s) => s[Math.floor(rnd() * s.length)];
  const word = () => {
    const mode = rnd();
    let w = '';
    if (mode < 0.45) {
      // a run of letters, any letters
      for (let n = 0, len = 2 + Math.floor(rnd() ** 1.5 * 10); n < len; n++) w += pick(LETTERS);
    } else if (mode < 0.85) {
      // something you could almost say
      for (let n = 0, len = 1 + Math.floor(rnd() * 4); n < len; n++) w += (rnd() < 0.7 ? pick(LETTERS) : '') + pick(VOWELS) + (rnd() < 0.4 ? pick(LETTERS) : '');
    } else {
      // a few letters said over and over
      const s = pick(LETTERS) + pick(VOWELS);
      w = s.repeat(2 + Math.floor(rnd() * 3));
    }
    return w;
  };
  const words = Array.from({ length: 1 + Math.floor(rnd() ** 1.4 * 3) }, word);
  let text = words.join(' ');
  if (rnd() < 0.2) text = text.replace(' ', ', ');
  if (rnd() < 0.15) text += '.';
  return { text, lower: true };
};
export function titleList({ seed = 37 } = {}) {
  const rnd = makeRng(seed);
  const out = TITLES.slice(0, TITLE_COUNT).map((text) => ({ text, lower: false }));
  while (out.length < TITLE_COUNT) {
    const g = gibberish(rnd);
    // a third of the gibberish lettered in capitals all the same: a binder
    // letters what he is given
    out.push(rnd() < 0.35 ? { text: g.text.toUpperCase(), lower: false } : g);
  }
  return out;
}
const ROMAN = (n) => [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
export function spineTitles({ cellW = 256, cellH = 128 } = {}) {
  const W = cellW * TITLE_COLS, H = cellH * TITLE_ROWS, per = TITLE_COLS * TITLE_ROWS;
  const titles = titleList();
  const pages = Array.from({ length: TITLE_PAGES }, () => canvas(W, H)[1]);
  const FACE = 'Georgia, "Book Antiqua", "Palatino Linotype", "Times New Roman", serif';
  for (const c of pages) {
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  }
  for (let slot = 0; slot < TITLE_PAGES * per; slot++) {
    const c = pages[Math.floor(slot / per)], cell = slot % per;
    const x0 = (cell % TITLE_COLS) * cellW, y0 = Math.floor(cell / TITLE_COLS) * cellH;
    const numeral = slot < NUMERALS;
    const { text, lower } = numeral ? { text: ROMAN(slot + 1), lower: false } : titles[slot - NUMERALS];
    const font = (px) => (lower ? `italic 500 ${px}px ${FACE}` : `600 ${px}px ${FACE}`);
    const track = lower ? 0.01 : numeral ? 0.04 : 0.09;
    const padX = cellW * (numeral ? 0.18 : 0.05), padY = cellH * (numeral ? 0.14 : 0.08);
    // measured at 100 px: each line's width and how far it reaches above and
    // below its baseline
    c.font = font(100);
    c.letterSpacing = `${track * 100}px`;
    const measure = (s) => {
      const m = c.measureText(s);
      return { w: m.width - track * 100, up: m.actualBoundingBoxAscent, down: m.actualBoundingBoxDescent };
    };
    // Every way of breaking it into one to three lines (a long word may be
    // split with a hyphen, as binders split them), and the one that lets the
    // letters be largest. A title of one word stays one line if it can.
    const words = text.split(' ');
    const ways = [];
    const n = words.length;
    for (let a = 1; a <= n; a++) {
      for (let b = a; b <= n; b++) {
        const lines = [words.slice(0, a), words.slice(a, b), words.slice(b)].filter((l) => l.length).map((l) => l.join(' '));
        if (lines.length <= 3 && !ways.some((w) => w.join('|') === lines.join('|'))) ways.push(lines);
      }
    }
    if (n === 1 && text.length >= 8) {
      const mid = Math.floor(text.length / 2);
      for (const cut of [mid - 1, mid, mid + 1]) ways.push([`${text.slice(0, cut)}-`, text.slice(cut)]);
    }
    let best = null;
    for (const lines of ways) {
      const ms = lines.map(measure);
      const lead = lower ? 1.12 : 1.02;
      const up = ms[0].up, down = ms[ms.length - 1].down;
      const blockH = up + down + (lines.length - 1) * 100 * (lower ? 0.98 : 0.86) * lead;
      // (and no larger than a binder would letter it: a title of two letters
      // filled its label edge to edge, and from across the room it shouted)
      const most = cellH * (numeral ? 0.72 : lower ? 0.6 : 0.48);
      const size = Math.min((cellW - 2 * padX) / Math.max(...ms.map((m) => m.w)) * 100, (cellH - 2 * padY) / blockH * 100, most);
      // (a hyphen costs a little: only worth it for letters a good deal larger)
      const score = size * (lines.some((l) => l.endsWith('-')) ? 0.85 : 1) * (1 - 0.03 * (lines.length - 1));
      if (!best || score > best.score) best = { lines, ms, size, up, blockH, lead, score };
    }
    const scale = best.size / 100;
    c.font = font(best.size);
    c.letterSpacing = `${track * best.size}px`;
    let y = y0 + (cellH - best.blockH * scale) / 2 + best.up * scale;
    best.lines.forEach((line) => {
      // (letterSpacing trails the last letter too: shift back by half of it)
      c.fillText(line, x0 + cellW / 2 + (track * best.size) / 2, y);
      y += 100 * (lower ? 0.98 : 0.86) * best.lead * scale;
    });
  }
  const P = pages.map((c) => c.getImageData(0, 0, W, H).data);
  const [out, o] = canvas(W, H);
  const img = o.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    for (let p = 0; p < 3; p++) img.data[i * 4 + p] = P[p] ? P[p][i * 4] : 0;
    img.data[i * 4 + 3] = 255;
  }
  o.putImageData(img, 0, 0);
  return { map: toTexture(out, { srgb: false, anisotropy: 8 }) };
}

// The hide every binding is cut from, laid over a book at its own size (one
// tile is HIDE_TILE units across) and at its own place in the tile, so no two
// boards are the same piece of leather. The spine atlas drew grain as a few
// hundred faint specks, and the mipmaps averaged them to nothing: past arm's
// length every binding was one smooth tone, and a cover — which had no
// texture at all — was a flat panel of paint. Three channels, all linear:
//   R  tone    the mottle of the skin and of handling, the binder's sprinkle,
//              pale scuffs, dark creases (128 is the leather as it is)
//   G  height  the pebble of the grain, its pores, the creases and scuffs as
//              grooves
//   B  marble  stone marbling for the paper sides of a half binding: drops
//              of colour floated one inside another, each with a dark rim
export const HIDE_TILE = 24, HIDE_SIZE = 512;
export function bindingHide({ size = HIDE_SIZE, seed = 29 } = {}) {
  const rnd = makeRng(seed);
  const S = size;
  // every mark drawn wherever it crosses an edge too, so the tile repeats
  const wrapped = (x, y, r, draw) => {
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      if (x + dx + r > 0 && x + dx - r < S && y + dy + r > 0 && y + dy - r < S) draw(x + dx, y + dy);
    }
  };
  const [, t] = canvas(S);
  const [, h] = canvas(S);
  const [, m] = canvas(S);
  t.fillStyle = grey(128); t.fillRect(0, 0, S, S);
  h.fillStyle = grey(128); h.fillRect(0, 0, S, S);
  m.fillStyle = grey(150); m.fillRect(0, 0, S, S);

  // the mottle: a skin is never one tone, and hands and damp leave theirs
  for (let k = 0; k < 90; k++) {
    const x = rnd() * S, y = rnd() * S, r = 12 + rnd() ** 2 * 110;
    const dark = rnd() < 0.62, a = dark ? 0.08 + rnd() * 0.16 : 0.05 + rnd() * 0.1, c = dark ? '0,0,0' : '255,255,255';
    wrapped(x, y, r, (px, py) => {
      const g = t.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${c},${a})`);
      g.addColorStop(1, `rgba(${c},0)`);
      t.fillStyle = g;
      t.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  // sprinkled calf: the binder's spatter of dark, in a few drifts. (Spattered
  // everywhere and dark, it survived the mipmaps as speckle, and a wall of
  // books seen from across a room read as granite.)
  for (let k = 0; k < 9; k++) {
    const cx = rnd() * S, cy = rnd() * S, spread = 14 + rnd() * 40;
    for (let n = 0, count = 20 + Math.floor(rnd() * 50); n < count; n++) {
      const x = cx + (rnd() + rnd() + rnd() - 1.5) * spread, y = cy + (rnd() + rnd() + rnd() - 1.5) * spread;
      const r = 0.6 + rnd() ** 3 * 1.4, a = 0.08 + rnd() * 0.16;
      wrapped(((x % S) + S) % S, ((y % S) + S) % S, r, (px, py) => {
        t.fillStyle = `rgba(0,0,0,${a})`;
        t.beginPath(); t.arc(px, py, r, 0, Math.PI * 2); t.fill();
      });
    }
  }
  // Flaking: old calf loses its grain layer in patches, and what is left is
  // paler, matt and sunk — sharp-edged, unlike a stain. These are what read as
  // a worn binding from across a room, where the grain itself is long gone
  // into the mipmaps.
  for (let k = 0; k < 70; k++) {
    const x = rnd() * S, y = rnd() * S, r = 3 + rnd() ** 2 * 16, n = 7 + Math.floor(rnd() * 6), a = 0.22 + rnd() * 0.22;
    const pts = Array.from({ length: n }, (_, i) => {
      const th = (i / n) * Math.PI * 2 + rnd() * 0.4, rr = r * (0.55 + rnd() * 0.45);
      return [Math.cos(th) * rr, Math.sin(th) * rr * (0.5 + rnd() * 0.5)];
    });
    wrapped(x, y, r, (px, py) => {
      for (const [g, style] of [[t, `rgba(255,236,214,${a})`], [h, 'rgba(0,0,0,0.3)']]) {
        g.fillStyle = style;
        g.beginPath();
        pts.forEach(([dx, dy], i) => (i ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy)));
        g.closePath();
        g.fill();
      }
    });
  }
  // the pebble of the grain, and its pores
  for (let k = 0; k < 14000; k++) {
    const x = rnd() * S, y = rnd() * S, r = 1 + rnd() * 1.4;
    h.fillStyle = `rgba(255,255,255,${0.08 + rnd() * 0.14})`;
    h.beginPath(); h.arc(x, y, r, 0, Math.PI * 2); h.fill();
  }
  for (let k = 0; k < 6000; k++) {
    h.fillStyle = `rgba(0,0,0,${0.2 + rnd() * 0.2})`;
    h.fillRect(rnd() * S, rnd() * S, 0.6 + rnd() * 0.6, 0.6 + rnd() * 0.6);
  }
  // creases (dark, sunk) and scuffs (pale where the grain is broken, and sunk)
  const stroke = (pts, width, tone, height) => {
    const r = Math.max(...pts.map(([x, y]) => Math.hypot(x - pts[0][0], y - pts[0][1]))) + width;
    wrapped(pts[0][0], pts[0][1], r, (px, py) => {
      for (const [g, style] of [[t, tone], [h, height]]) {
        g.strokeStyle = style;
        g.lineWidth = width;
        g.lineCap = 'round';
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x - pts[0][0] + px, y - pts[0][1] + py) : g.moveTo(px, py)));
        g.stroke();
      }
    });
  };
  for (let k = 0; k < 50; k++) {
    let x = rnd() * S, y = rnd() * S, ang = rnd() * Math.PI * 2;
    const pts = [[x, y]];
    for (let n = 0, segs = 4 + Math.floor(rnd() * 5); n < segs; n++) {
      ang += (rnd() - 0.5) * 1.0;
      const step = 6 + rnd() * 8;
      x += Math.cos(ang) * step; y += Math.sin(ang) * step;
      pts.push([x, y]);
    }
    stroke(pts, 0.8 + rnd() * 0.4, `rgba(0,0,0,${0.07 + rnd() * 0.07})`, 'rgba(0,0,0,0.35)');
  }
  for (let k = 0; k < 120; k++) {
    const x = rnd() * S, y = rnd() * S, len = 3 + rnd() ** 2 * 26, ang = rnd() * Math.PI * 2;
    stroke([[x, y], [x + Math.cos(ang) * len, y + Math.sin(ang) * len]], 0.8 + rnd() * 0.8,
      `rgba(255,255,255,${0.05 + rnd() * 0.1})`, 'rgba(0,0,0,0.22)');
  }
  // stone marbling: each drop floated on the size pushes the last aside, so
  // what the paper takes up is drops inside drops, each with a dark rim. At
  // the size of a few millimetres on a board, as a marbler's are: drawn a
  // hand across, they lay over a cover as polka dots.
  const LEVELS = [70, 120, 150, 175, 210];
  for (let k = 0; k < 5200; k++) {
    const x = rnd() * S, y = rnd() * S, r = 1.4 + rnd() ** 1.8 * 7.5, v = LEVELS[Math.floor(rnd() * LEVELS.length)];
    wrapped(x, y, r + 1, (px, py) => {
      m.fillStyle = grey(v);
      m.strokeStyle = 'rgba(25,25,25,0.7)';
      m.lineWidth = 0.7;
      m.beginPath(); m.arc(px, py, r, 0, Math.PI * 2); m.fill(); m.stroke();
    });
  }

  const T = t.getImageData(0, 0, S, S).data, H = h.getImageData(0, 0, S, S).data, M = m.getImageData(0, 0, S, S).data;
  const [out, o] = canvas(S);
  const img = o.createImageData(S, S);
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  for (let i = 0; i < S * S; i++) {
    img.data[i * 4] = clamp(T[i * 4] + (rnd() - 0.5) * 4);
    img.data[i * 4 + 1] = clamp(H[i * 4] + (rnd() - 0.5) * 10);
    img.data[i * 4 + 2] = clamp(M[i * 4] + (rnd() - 0.5) * 8);
    img.data[i * 4 + 3] = 255;
  }
  o.putImageData(img, 0, 0);
  return toTexture(out, { srgb: false, anisotropy: 4 });
}

// ── The dressing of a bookcase ────────────────────────────────────────────────

// The frieze board over the top shelf: a gilt key running on dark walnut
// between two gilt fillets. Two keys to the canvas; laid in world units, one
// canvas is 7 units along the wall and the board's own height up it.
export function friezeBand({ w = 512, h = 256, seed = 41 } = {}) {
  const rnd = makeRng(seed);
  const [col, c] = canvas(w, h);
  c.fillStyle = '#2a1b11';
  c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '90,62,40' : '8,5,3'},${0.05 + rnd() * 0.08})`;
    c.fillRect(0, y, w, 1);
  }
  const gold = '#c9a05a';
  c.fillStyle = gold;
  c.fillRect(0, 16, w, 7);
  c.fillRect(0, h - 23, w, 7);
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.fillRect(0, 23, w, 3);
  c.fillRect(0, h - 16, w, 3);
  // the key: a baseline, and off it a spiral turned in on itself, per unit
  const U = w / 2, top = 52, bot = h - 52, H = bot - top;
  c.strokeStyle = gold;
  c.lineWidth = 13;
  c.lineCap = 'square';
  c.lineJoin = 'miter';
  for (let k = -1; k <= 2; k++) {
    const X = (fx) => k * U + fx * U, Y = (fy) => top + fy * H;
    c.beginPath();
    c.moveTo(X(0), Y(1));
    c.lineTo(X(1), Y(1));
    c.moveTo(X(0.08), Y(1));
    c.lineTo(X(0.08), Y(0));
    c.lineTo(X(0.8), Y(0));
    c.lineTo(X(0.8), Y(0.66));
    c.lineTo(X(0.36), Y(0.66));
    c.lineTo(X(0.36), Y(0.33));
    c.lineTo(X(0.56), Y(0.33));
    c.stroke();
  }
  return toTexture(col, { anisotropy: 8 });
}

// Enamel plates for the bays, one numeral to a cell: I, II, III.
export const PLATE_CELLS = 3;
export function bayPlates({ cellW = 160, cellH = 96 } = {}) {
  const [col, c] = canvas(cellW * PLATE_CELLS, cellH);
  for (let i = 0; i < PLATE_CELLS; i++) {
    const x0 = i * cellW;
    c.fillStyle = '#6b4f30';
    c.fillRect(x0, 0, cellW, cellH);
    c.fillStyle = '#e4d8bd';
    c.fillRect(x0 + 6, 6, cellW - 12, cellH - 12);
    c.strokeStyle = '#3a2716';
    c.lineWidth = 3;
    c.strokeRect(x0 + 13, 13, cellW - 26, cellH - 26);
    c.fillStyle = '#2a1a10';
    c.font = '600 50px Georgia, "Times New Roman", serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(['I', 'II', 'III'][i], x0 + cellW / 2, cellH / 2 + 3);
  }
  const t = toTexture(col, { anisotropy: 4 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Gilt capitals for the inscription along a cornice ("HEXAGON CCCXV · WALL
// IV"): one letter to a cell, on nothing, so each is laid as its own quad and
// a whole wall of them costs one texture. `glyphs[ch]` gives the cell and the
// advance, in cap heights; a quad `cellW` × `cellH` caps, centred on the
// letter, has the cap in its middle. (Most of the alphabet: the Echo's rose
// carries a whole sentence round its rim.)
export function giltLetters({ chars = 'ABCDEFGHIKLMNOPRSTUVWXY·', cols = 6, cellW = 160, cellH = 128, px = 112 } = {}) {
  const rows = Math.ceil(chars.length / cols);
  const [col, c] = canvas(cols * cellW, rows * cellH);
  c.font = `600 ${px}px Georgia, "Times New Roman", serif`;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const cap = px * 0.69;
  const glyphs = {};
  [...chars].forEach((ch, i) => {
    const cx = (i % cols) * cellW + cellW / 2, base = Math.floor(i / cols) * cellH + cellH / 2 + cap / 2;
    // cut into the wood: a dark bed under and right of each stroke, the gold
    // lighter along its top where the lamps below catch it
    c.fillStyle = 'rgba(18,10,5,0.9)';
    c.fillText(ch, cx + 2, base + 3);
    const gold = c.createLinearGradient(0, base - cap, 0, base);
    gold.addColorStop(0, '#f0d08a');
    gold.addColorStop(0.55, '#c9a05a');
    gold.addColorStop(1, '#8a6632');
    c.fillStyle = gold;
    c.fillText(ch, cx, base);
    glyphs[ch] = { col: i % cols, row: Math.floor(i / cols), adv: c.measureText(ch).width / cap };
  });
  const map = toTexture(col, { anisotropy: 8 });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  return { map, glyphs, cols, rows, cellW: cellW / cap, cellH: cellH / cap };
}

// The leather dust-flap hung from the front of a shelf: stitched along the
// top, cut in a scallop below. White, to be tinted by its material; the cut
// is in the alpha. One scallop to the canvas.
export function shelfEdge({ w = 128, h = 64 } = {}) {
  const [col, c] = canvas(w, h);
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(w, 0);
  c.lineTo(w, h * 0.5);
  c.quadraticCurveTo(w / 2, h * 1.08, 0, h * 0.5);
  c.closePath();
  c.fill();
  const shade = c.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(0,0,0,0.25)');
  shade.addColorStop(0.3, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = shade;
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(40,24,12,0.55)';
  for (let x = 4; x < w; x += 10) c.fillRect(x, 8, 5, 2);
  c.globalCompositeOperation = 'source-over';
  return toTexture(col, { anisotropy: 4 });
}

// ── Books at a distance ───────────────────────────────────────────────────────
// The far galleries' shelves are only ever seen from over the walls (the map,
// the rise at the end of the walk), and at their real size a book there is a
// pixel or two across: their spines are painted, a strip of them per size of
// book, and each shelf shows a stretch of its strip (buildWorld's shelfWall)
// instead of a box for every one of them. `rows`: each size's heights, widths
// and the room over it on its shelf, in units; `unit` pixels to a unit, along
// the shelf and up it; `variants` strips of each size; `length` units along.
// The strips are stacked with a dark margin between, so a coarse mip of one
// does not bleed into the next.
const BOOK_ROW_PAD = 4;
export function bookRowsLayout({ rows, unit = 12, variants = 2, length = 128 }) {
  let y = 0;
  const at = [];
  for (const r of rows) {
    for (let v = 0; v < variants; v++) {
      const h = Math.round(r.clear * unit);
      at.push({ y: y + BOOK_ROW_PAD, h });
      y += h + 2 * BOOK_ROW_PAD;
    }
  }
  return { at, w: Math.round(length * unit), h: y };
}
export function bookRows({ rows, unit = 12, variants = 2, length = 128, palette, seed = 53 } = {}) {
  const rnd = makeRng(seed);
  const { at, w: W, h: H } = bookRowsLayout({ rows, unit, variants, length });
  const [col, c] = canvas(W, H);
  c.fillStyle = '#0a0705';
  c.fillRect(0, 0, W, H);
  const total = palette.reduce((n, p) => n + p.share, 0);
  const pickBinding = () => { let r = rnd() * total; for (const p of palette) { r -= p.share; if (r <= 0) return p; } return palette[0]; };
  const within = ([lo, hi]) => lo + (hi - lo) * rnd();
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.min(255, Math.round(v * k));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };
  rows.forEach((r, t) => {
    for (let v = 0; v < variants; v++) {
      const { y: top, h } = at[t * variants + v], base = top + h;
      // the dark of the shelf over the books, darkest under the board above
      const dark = c.createLinearGradient(0, top, 0, base);
      dark.addColorStop(0, '#050302');
      dark.addColorStop(1, '#1b130c');
      c.fillStyle = dark;
      c.fillRect(0, top, W, h);
      // in runs, as the near shelves are (buildWorld's newRun)
      let x = rnd() * 3, run = 0, B = null, kind = 'plain', hex = '#6f4c31', bh = 0, bw = 0;
      for (;;) {
        if (run <= 0) {
          if (rnd() < 0.03) { x += within([0.4, 1]) * unit; continue; }
          B = pickBinding();
          const q = rnd();
          kind = B.kind ?? (q < (t < 2 ? 0.14 : 0.25) ? 'rich' : q < (t < 2 ? 0.38 : 0.7) ? 'label' : 'plain');
          hex = B.cols[Math.floor(rnd() * B.cols.length)];
          bh = within(r.h) * unit;
          bw = within(r.w) * unit * (kind === 'vellum' ? 0.85 : 1);
          run = rnd() < 0.22 ? 1 : 2 + Math.floor(rnd() * rnd() * 8);
        }
        const w = Math.max(2, Math.round(bw * (0.97 + rnd() * 0.06))), hh = Math.round(bh * (0.99 + rnd() * 0.02));
        // (a gap where the strip comes round to its start again)
        if (x + w > W - 2) break;
        const y0 = base - hh;
        c.fillStyle = shade(hex, 0.86 + rnd() * 0.28);
        c.fillRect(x, y0, w, hh);
        // round: the joints in shadow, the crown catching the light
        if (w >= 4) {
          c.fillStyle = 'rgba(0,0,0,0.38)';
          c.fillRect(x, y0, 1, hh);
          c.fillRect(x + w - 1, y0, 1, hh);
          c.fillStyle = 'rgba(255,226,180,0.08)';
          c.fillRect(x + Math.round(w * 0.3), y0, Math.max(1, Math.round(w * 0.35)), hh);
        }
        if (kind !== 'vellum' && kind !== 'cloth') {
          // raised bands, gilt on the rich bindings
          c.fillStyle = kind === 'rich' ? 'rgba(201,160,90,0.85)' : 'rgba(0,0,0,0.3)';
          for (const f of [0.08, 0.27, 0.42, 0.57, 0.72, 0.92]) c.fillRect(x, Math.round(y0 + hh * f), w, 1);
        }
        if (kind === 'label') {
          c.fillStyle = 'rgba(158,138,104,0.9)';
          c.fillRect(x + Math.max(1, Math.round(w * 0.15)), Math.round(y0 + hh * 0.29), Math.max(1, Math.round(w * 0.7)), Math.max(2, Math.round(hh * 0.1)));
        } else if (kind === 'cloth') {
          c.fillStyle = 'rgba(201,160,90,0.6)';
          c.fillRect(x, Math.round(y0 + hh * 0.06), w, Math.max(1, Math.round(hh * 0.05)));
        }
        // the shadow along the head, and a hair of dark between books
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fillRect(x, y0, w, 1);
        x += w + (rnd() < 0.3 ? 1 : 0);
        run--;
      }
    }
  });
  return { map: toTexture(col, { anisotropy: 4 }) };
}

// ── The garden ────────────────────────────────────────────────────────────────

// A clipped hedge, face on (hedges.js). The shears cut every shoot, and a cut
// shoot breaks into a rosette of small oval leaves round its tip — so a hedge
// face is a pack of rosettes, with dark gaps between where the eye goes in
// among the stems. The gaps are what give it depth; the old face was one
// even field of five thousand ellipses, and it read as a printed wallpaper.
// A leaf is higher than the gap beside it, and glossy (box leaf is) where
// the gap is dull; and the colour is shaded by the height, so the gaps are
// dark before any light reaches them. The light is from above — texture v
// runs up the face. `size` pixels to one tile, laid (hedges.js) about 12
// units to the tile, so a leaf is 1.5 to 2.5 cm.
//
// Every leaf is ONE fill, into one canvas that carries all three things at
// once: red how high it lies, green which of the palette's tones it is, blue
// how light. Colour, height and gloss are read back out of it at the end.
// (A fill per leaf per map, each with its own gradient, was 1.6 s of the
// world's load for this texture alone; a fill is about 12 µs here, whatever
// its size, so the count of them is the whole cost.)
export function hedgeLeaves({ size = 1024, seed = 31 } = {}) {
  const rnd = makeRng(seed);
  const rr = (a, b) => a + (b - a) * rnd();
  // The tones, sorted by hue so that where two leaves' edges blend, the
  // index between them is a tone between them: mostly the green of box;
  // some new growth, lime; a few leaves dying, bronze; and the stems.
  const hsl = (h, s, l) => {
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const at = (n) => { const k = (n + h / 30) % 12; return l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [at(0), at(8), at(4)];
  };
  const tones = Array.from({ length: 240 }, () => {
    const r = rnd();
    if (r < 0.06) return [rr(70, 84), rr(30, 40), rr(26, 33)];
    if (r < 0.1) return [rr(34, 46), rr(22, 32), rr(18, 25)];
    return [rr(92, 118), rr(24, 36), rr(15, 25)];
  }).sort((a, b) => a[0] - b[0]);
  const palette = [...tones.map(([h, s, l]) => hsl(h, s, l)), ...Array.from({ length: 16 }, () => hsl(rr(28, 38), rr(18, 26), rr(22, 27)))];
  const STEM = 240;
  const [, f] = canvas(size);
  // the dark inside of the hedge, green and not the brown of its stems
  f.fillStyle = 'rgb(20,150,40)';
  f.fillRect(0, 0, size, size);
  // anything near an edge is drawn again across it, so the tile tiles
  const wrapped = (x, y, reach, fn) => {
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        if (x + dx < -reach || x + dx > size + reach || y + dy < -reach || y + dy > size + reach) continue;
        fn(x + dx, y + dy);
      }
    }
  };
  // the stems in the dark
  for (let k = 0; k < 420; k++) {
    const x = rnd() * size, y = rnd() * size, a = rr(-2.2, -0.9), len = rr(14, 46), w = rr(1.2, 2.6);
    const style = `rgb(${(40 + rnd() * 30) | 0},${STEM + ((rnd() * 16) | 0)},${(100 + rnd() * 60) | 0})`;
    wrapped(x, y, len, (px, py) => {
      f.strokeStyle = style;
      f.lineWidth = w;
      f.beginPath(); f.moveTo(px, py); f.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); f.stroke();
    });
  }
  // One leaf: an oval from its stalk at (x, y) out along `a`, `h` high,
  // tone `t`, lighter if it faces up and by `light` (0 to 1: half as light to
  // half as light again, 0.5 even).
  const leaf = (x, y, a, L, W, h, t, light) => {
    const cs = Math.cos(a), sn = Math.sin(a);
    f.fillStyle = `rgb(${h | 0},${t | 0},${Math.min(255, Math.max(0, (light - sn * 0.12) * 255)) | 0})`;
    wrapped(x, y, L, (px, py) => {
      f.setTransform(cs, sn, -sn, cs, px, py);
      f.beginPath();
      f.ellipse(L * 0.5, 0, L * 0.5, W * 0.5, 0, 0, Math.PI * 2);
      f.fill();
    });
  };
  const tone = () => (rnd() * 240) | 0;
  // a layer deep in, in shadow, that the rosettes are seen over
  for (let k = 0; k < 2800; k++) leaf(rnd() * size, rnd() * size, rnd() * Math.PI * 2, rr(11, 18), rr(6, 10), rr(96, 140), tone(), rr(0.2, 0.36));
  // The rosettes: leaves round each cut tip, the tip highest. Never a tidy
  // star — a shoot throws its leaves where it can, some short, some turned
  // back over the others, the whole knot off to one side of its tip; and
  // the tone leaf by leaf (a whole knot of lime or of bronze was a patch,
  // and under a lamp the patches were camouflage).
  for (let k = 0; k < 1250; k++) {
    const x = rnd() * size, y = rnd() * size;
    const n = 5 + Math.floor(rnd() * 6), lift = rr(150, 225), lean = rnd() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, Lf = rr(10, 19), off = rr(0, 6);
      leaf(x + Math.cos(lean) * off * 0.6 + Math.cos(a) * rr(0, 4), y + Math.sin(lean) * off * 0.6 + Math.sin(a) * rr(0, 4), a, Lf, Lf * rr(0.48, 0.62),
        lift - rr(15, 60), tone(), rr(0.4, 0.6));
    }
  }
  // and single leaves over everything, which the eye cannot group
  for (let k = 0; k < 1500; k++) leaf(rnd() * size, rnd() * size, rnd() * Math.PI * 2, rr(10, 17), rr(5.5, 9.5), rr(100, 180), tone(), rr(0.4, 0.6));
  f.setTransform(1, 0, 0, 1, 0, 0);

  // Read it back: the colour shaded by the height — gaps dark, the tips of
  // the rosettes lit — the gloss from the height (the leaf glossy, the gaps
  // dull), and the height itself softened by a box of five each way round
  // the wrap, twice. A leaf is a flat plateau as painted, and a lamp close
  // by lit each one evenly inside a hard rim: cut-outs. Softened, it is a
  // little dome, and it catches the lamp the way a curved leaf does.
  const [col, c] = canvas(size);
  const [rou, rg] = canvas(size);
  const [soft, sg] = canvas(size);
  const src = f.getImageData(0, 0, size, size).data;
  const colour = c.createImageData(size, size), gloss = rg.createImageData(size, size), height = sg.createImageData(size, size);
  const cd = colour.data, gd = gloss.data, hd = height.data;
  const ao = Float32Array.from({ length: 256 }, (_, v) => 0.42 + 0.58 * Math.pow(v / 255, 0.9));
  const hs = new Float32Array(size * size), tmp = new Float32Array(size * size);
  for (let i = 0, p = 0; p < size * size; i += 4, p++) {
    const h = src[i], [r, g, b] = palette[Math.min(255, src[i + 1])], k = ao[h] * (0.5 + src[i + 2] / 255) * 255;
    cd[i] = r * k; cd[i + 1] = g * k; cd[i + 2] = b * k; cd[i + 3] = 255;
    gd[i] = gd[i + 1] = gd[i + 2] = 255 - 90 * Math.min(1, Math.max(0, (h / 255 - 0.12) / 0.6)); gd[i + 3] = 255;
    hs[p] = h;
  }
  const wrap = (v) => (v + size) % size;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < size; y++) {
      const row = y * size;
      for (let x = 0; x < size; x++) {
        tmp[row + x] = (hs[row + wrap(x - 2)] + hs[row + wrap(x - 1)] + hs[row + x] + hs[row + wrap(x + 1)] + hs[row + wrap(x + 2)]) / 5;
      }
    }
    for (let y = 0; y < size; y++) {
      const a = wrap(y - 2) * size, b = wrap(y - 1) * size, row = y * size, d = wrap(y + 1) * size, e = wrap(y + 2) * size;
      for (let x = 0; x < size; x++) hs[row + x] = (tmp[a + x] + tmp[b + x] + tmp[row + x] + tmp[d + x] + tmp[e + x]) / 5;
    }
  }
  for (let p = 0, i = 0; p < size * size; p++, i += 4) { hd[i] = hd[i + 1] = hd[i + 2] = hs[p]; hd[i + 3] = 255; }
  c.putImageData(colour, 0, 0);
  rg.putImageData(gloss, 0, 0);
  sg.putImageData(height, 0, 0);
  soil(c, rnd, size, 8, 0.4);
  return {
    map: toTexture(col),
    normalMap: toTexture(normalsFrom(soft, 5), { srgb: false }),
    roughnessMap: toTexture(rou, { srgb: false }),
  };
}

// Sprays of leaf on a transparent ground, one kind to a column, for the crowns
// of the garden's trees (trees.js, LEAF) and the fringe of the hedges:
//   0 broad    leaves in alternate pairs along twigs that radiate from a stem
//   1 maple    small palmate leaves, five and seven lobed, on fine stalks
//   2 pine     brushes of needles, the stuff of a cloud-pruned pad
//   3 blossom  five-petalled flowers in umbels along dark twigs
//   4 cedar    cord-like shoots, needled all round, fanning out
//   5 willow   fine arching shoots, the narrow leaves hanging off them
//   6 box      a clipped shoot grown out again: short twigs, small oval
//              leaves in pairs, the sprigs that fuzz a hedge (hedges.js)
// A spray is drawn the way the eye finds one: stalks first, then the leaves
// from the inside out, darker in the middle where the spray shades itself and
// lighter at the rim — so each card has a little depth before any light
// reaches it. Near-neutral, because the tree's instance colour gives the hue.
// (There used to be one kind: two hundred and sixty ellipses in a disc, which
// was a sponge from any distance.)
export const FOLIAGE_KINDS = 7;
export function foliageAtlas({ size = 256, seed = 37 } = {}) {
  const rnd = makeRng(seed);
  const S = size, R = S * 0.44;
  const [col, c] = canvas(S * FOLIAGE_KINDS, S);
  c.clearRect(0, 0, S * FOLIAGE_KINDS, S);
  const rr = (a, b) => a + (b - a) * rnd();
  // A leaf along +x from its stalk: broadest a third of the way out, pointed.
  const blade = (x, y, a, L, W, fill, rib) => {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(L * 0.22, -W, L * 0.66, -W * 0.85, L, 0);
    c.bezierCurveTo(L * 0.66, W * 0.85, L * 0.22, W, 0, 0);
    c.fill();
    if (rib) {
      c.strokeStyle = rib;
      c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(1, 0); c.lineTo(L * 0.82, 0); c.stroke();
    }
    c.restore();
  };
  // Five or seven pointed lobes on a palm, the stalk behind it (a maple's).
  const palm = (x, y, a, r, fill, lobes) => {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillStyle = fill;
    c.beginPath();
    const span = lobes === 7 ? 2.5 : 2.2;
    for (let k = 0; k < lobes; k++) {
      const f = k / (lobes - 1) - 0.5, th = f * span * 2;
      const len = r * (1 - Math.abs(f) * (lobes === 7 ? 0.75 : 0.6));
      const n0 = th - span / (lobes - 1), n1 = th + span / (lobes - 1);
      if (k === 0) c.moveTo(Math.cos(n0) * r * 0.28, Math.sin(n0) * r * 0.28);
      c.quadraticCurveTo(Math.cos(th - 0.2) * len * 0.62, Math.sin(th - 0.2) * len * 0.62, Math.cos(th) * len, Math.sin(th) * len);
      c.quadraticCurveTo(Math.cos(th + 0.2) * len * 0.62, Math.sin(th + 0.2) * len * 0.62, Math.cos(n1) * r * 0.28, Math.sin(n1) * r * 0.28);
    }
    c.closePath();
    c.fill();
    c.restore();
  };
  // A stalk that wanders out from near the middle: its points, `steps` of them.
  const shoot = (cx, cy, a, len, steps, bend = 0.35) => {
    let x = cx + Math.cos(a) * R * 0.06, y = cy + Math.sin(a) * R * 0.06, ang = a;
    const pts = [[x, y, ang]];
    for (let i = 1; i <= steps; i++) {
      ang += (rnd() - 0.5) * bend;
      x += (Math.cos(ang) * len) / steps;
      y += (Math.sin(ang) * len) / steps;
      pts.push([x, y, ang]);
    }
    return pts;
  };
  const stem = (pts, w0, w1, style) => {
    c.strokeStyle = style;
    c.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      c.lineWidth = w0 + (w1 - w0) * (i / pts.length);
      c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    }
  };
  // how far out a point lies (0 at the middle, 1 at the rim) and how lit its
  // side is (the light is up and to the left, as on every spray in the garden)
  const place = (cx, cy, x, y) => ({ out: Math.min(1, Math.hypot(x - cx, y - cy) / R), lit: (cx - x + cy - y) / (S * 1.4) });
  for (let kind = 0; kind < FOLIAGE_KINDS; kind++) {
    const x0 = kind * S, cx = x0 + S / 2, cy = S / 2;
    c.save();
    // everything a kind draws stays in its own column, clear of the seams
    c.beginPath(); c.rect(x0 + 5, 5, S - 10, S - 10); c.clip();
    const marks = [];
    if (kind === 0 || kind === 1) {
      const n = kind === 0 ? 8 : 9;
      for (let s = 0; s < n; s++) {
        const pts = shoot(cx, cy, (s / n) * Math.PI * 2 + rr(-0.3, 0.3), R * rr(0.62, 0.95), 7);
        stem(pts, 1.8, 0.7, kind === 0 ? 'rgba(58,46,34,1)' : 'rgba(92,40,30,1)');
        pts.forEach(([x, y, ang], i) => {
          if (!i) return;
          const t = i / (pts.length - 1);
          for (const side of [-1, 1]) {
            if (rnd() < 0.12) continue;
            const a = ang + side * rr(0.55, 1.15);
            if (kind === 0) marks.push({ x, y, a, L: (23 - t * 7) * rr(0.8, 1.2), ...place(cx, cy, x, y) });
            else {
              const stalk = rr(4, 8);
              marks.push({ x: x + Math.cos(a) * stalk, y: y + Math.sin(a) * stalk, a, L: (12 - t * 3) * rr(0.8, 1.2), sx: x, sy: y, ...place(cx, cy, x, y) });
            }
          }
          if (i === pts.length - 1) marks.push({ x, y, a: ang, L: kind === 0 ? 20 : 11, ...place(cx, cy, x, y) });
        });
      }
      // and the leaves of the spray's heart, which the twigs are hidden under
      for (let k = 0; k < (kind === 0 ? 46 : 60); k++) {
        const a = rnd() * Math.PI * 2, rho = Math.sqrt(rnd()) * R * 0.55;
        const x = cx + Math.cos(a) * rho, y = cy + Math.sin(a) * rho;
        marks.push({ x, y, a: rnd() * Math.PI * 2, L: kind === 0 ? rr(16, 22) : rr(9, 12), ...place(cx, cy, x, y) });
      }
      marks.sort((p, q) => p.out - q.out);
      for (const m of marks) {
        if (kind === 0) {
          const L = 34 + m.out * 24 + m.lit * 14 + rr(-6, 6);
          blade(m.x, m.y, m.a, m.L, m.L * 0.34, `hsl(${rr(96, 124)},${rr(8, 20)}%,${L}%)`, `hsla(${rr(96, 124)},14%,${L - 12}%,0.7)`);
        } else {
          if (m.sx !== undefined) {
            c.strokeStyle = 'rgba(110,52,40,0.9)';
            c.lineWidth = 0.7;
            c.beginPath(); c.moveTo(m.sx, m.sy); c.lineTo(m.x, m.y); c.stroke();
          }
          // the warm neutrals a red tint turns crimson, and a few that turn gold
          const gold = rnd() < 0.18;
          const L = 40 + m.out * 26 + m.lit * 12 + rr(-6, 6);
          palm(m.x, m.y, m.a, m.L, gold ? `hsl(${rr(42, 52)},${rr(30, 44)}%,${L + 6}%)` : `hsl(${rr(16, 36)},${rr(10, 26)}%,${L}%)`, rnd() < 0.5 ? 5 : 7);
        }
      }
    } else if (kind === 2) {
      // twigs under the brushes, then the brushes, dark ones first
      for (let s = 0; s < 6; s++) stem(shoot(cx, cy, (s / 6) * Math.PI * 2 + rr(-0.4, 0.4), R * rr(0.5, 0.85), 5), 2, 1, 'rgba(62,44,32,1)');
      for (let k = 0; k < 70; k++) {
        const a = rnd() * Math.PI * 2, rho = Math.sqrt(rnd()) * R * 0.86;
        const x = cx + Math.cos(a) * rho, y = cy + Math.sin(a) * rho;
        marks.push({ x, y, ...place(cx, cy, x, y) });
      }
      marks.sort((p, q) => p.out - q.out);
      for (const m of marks) {
        const n = 22 + Math.floor(rnd() * 14), reach = rr(13, 22);
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2, L = reach * rr(0.6, 1);
          c.strokeStyle = `hsl(${rr(88, 118)},${rr(8, 20)}%,${30 + m.out * 26 + m.lit * 12 + rr(-6, 8)}%)`;
          c.lineWidth = rr(1, 1.5);
          c.beginPath();
          c.moveTo(m.x, m.y);
          c.quadraticCurveTo(m.x + Math.cos(a + 0.2) * L * 0.5, m.y + Math.sin(a + 0.2) * L * 0.5, m.x + Math.cos(a) * L, m.y + Math.sin(a) * L);
          c.stroke();
        }
      }
    } else if (kind === 3) {
      for (let s = 0; s < 7; s++) {
        const pts = shoot(cx, cy, (s / 7) * Math.PI * 2 + rr(-0.3, 0.3), R * rr(0.6, 0.95), 6, 0.5);
        stem(pts, 2.4, 0.9, 'rgba(46,30,28,1)');
        pts.forEach(([x, y], i) => { if (i) marks.push({ x, y, umbel: true, ...place(cx, cy, x, y) }); });
      }
      for (let k = 0; k < 26; k++) {
        const a = rnd() * Math.PI * 2, rho = Math.sqrt(rnd()) * R * 0.6;
        const x = cx + Math.cos(a) * rho, y = cy + Math.sin(a) * rho;
        marks.push({ x, y, umbel: true, ...place(cx, cy, x, y) });
      }
      marks.sort((p, q) => p.out - q.out);
      for (const m of marks) {
        // a few young leaves, bronze, in behind the flowers
        if (rnd() < 0.3) blade(m.x, m.y, rnd() * Math.PI * 2, rr(10, 15), rr(3, 4.5), `hsl(${rr(30, 60)},${rr(12, 24)}%,${rr(30, 42)}%)`);
        const flowers = 2 + Math.floor(rnd() * 4);
        for (let f = 0; f < flowers; f++) {
          const fx = m.x + rr(-9, 9), fy = m.y + rr(-9, 9), pr = rr(3.2, 5.2);
          if (rnd() < 0.18) {
            c.fillStyle = `hsl(${rr(338, 352)},${rr(30, 46)}%,${rr(52, 64)}%)`;
            c.beginPath(); c.arc(fx, fy, pr * 0.55, 0, Math.PI * 2); c.fill();
            continue;
          }
          const L = 72 + m.out * 16 + m.lit * 8 + rr(-6, 6), rot = rnd() * Math.PI;
          c.fillStyle = `hsl(${rr(336, 356)},${rr(14, 36)}%,${Math.min(95, L)}%)`;
          for (let p = 0; p < 5; p++) {
            const pa = rot + (p / 5) * Math.PI * 2;
            c.beginPath();
            c.ellipse(fx + Math.cos(pa) * pr * 0.62, fy + Math.sin(pa) * pr * 0.62, pr * 0.62, pr * 0.46, pa, 0, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = `hsl(${rr(335, 350)},${rr(30, 50)}%,${rr(46, 58)}%)`;
          c.beginPath(); c.arc(fx, fy, pr * 0.3, 0, Math.PI * 2); c.fill();
        }
      }
    } else if (kind === 6) {
      // short twigs from the middle, each with its leaves in opposite pairs,
      // and a heap of leaf at the heart where they start
      for (let s = 0; s < 7; s++) {
        const pts = shoot(cx, cy, (s / 7) * Math.PI * 2 + rr(-0.35, 0.35), R * rr(0.55, 0.92), 6, 0.45);
        stem(pts, 1.6, 0.7, 'rgba(70,58,40,1)');
        pts.forEach(([x, y, ang], i) => {
          if (i < 1) return;
          for (const side of [-1, 1]) {
            if (rnd() < 0.08) continue;
            marks.push({ x, y, a: ang + side * rr(0.7, 1.2), L: rr(13, 18) * (1 - (i / pts.length) * 0.25), ...place(cx, cy, x, y) });
          }
          if (i === pts.length - 1) marks.push({ x, y, a: ang, L: 12, ...place(cx, cy, x, y) });
        });
      }
      for (let k = 0; k < 40; k++) {
        const a = rnd() * Math.PI * 2, rho = Math.sqrt(rnd()) * R * 0.5;
        const x = cx + Math.cos(a) * rho, y = cy + Math.sin(a) * rho;
        marks.push({ x, y, a: rnd() * Math.PI * 2, L: rr(13, 18), ...place(cx, cy, x, y) });
      }
      marks.sort((p, q) => p.out - q.out);
      for (const m of marks) {
        const L = 34 + m.out * 22 + m.lit * 14 + rr(-6, 6);
        c.save();
        c.translate(m.x, m.y);
        c.rotate(m.a);
        c.fillStyle = `hsl(${rr(90, 118)},${rr(10, 22)}%,${L}%)`;
        c.beginPath();
        c.ellipse(m.L * 0.5, 0, m.L * 0.5, m.L * 0.29, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = `hsla(${rr(90, 118)},14%,${L + 12}%,0.45)`;
        c.lineWidth = 0.7;
        c.beginPath(); c.moveTo(m.L * 0.12, 0); c.lineTo(m.L * 0.85, 0); c.stroke();
        c.restore();
      }
    } else if (kind === 5) {
      // A fountain: shoots spring from high in the middle, arch out to either
      // side and fall, and the narrow leaves hang off them — so a crown laid
      // over with these weeps, where a spray radiating every way was a palm.
      for (let s = 0; s < 15; s++) {
        const side = s % 2 ? 1 : -1, spread = rr(0.2, 1);
        let x = cx + rr(-0.35, 0.35) * R, y = cy - R * rr(0.1, 0.7), vx = side * spread * rr(2, 3.4), vy = -rr(0.8, 2.4);
        const pts = [[x, y]];
        for (let i = 0; i < 26; i++) {
          x += vx; y += vy; vy += 0.3; vx *= 0.97;
          if (Math.hypot(x - cx, y - cy) > R * 1.05) break;
          pts.push([x, y]);
        }
        stem(pts.map(([px, py]) => [px, py, 0]), 1.2, 0.6, 'rgba(84,78,50,1)');
        pts.forEach(([px, py], i) => {
          if (i < 2) return;
          for (const hand of [-1, 1]) {
            if (rnd() < 0.25) continue;
            marks.push({ x: px, y: py, a: Math.PI / 2 + hand * rr(0.15, 0.55), L: rr(13, 20), ...place(cx, cy, px, py) });
          }
        });
      }
      marks.sort((p, q) => p.out - q.out);
      for (const m of marks) {
        const L = 36 + m.out * 24 + m.lit * 12 + rr(-6, 6);
        blade(m.x, m.y, m.a, m.L, m.L * 0.14, `hsl(${rr(70, 96)},${rr(10, 22)}%,${L}%)`);
      }
    } else {
      // cord-like shoots, and on each, needles all round it, short and stiff
      for (let s = 0; s < 9; s++) {
        const main = shoot(cx, cy, (s / 9) * Math.PI * 2 + rr(-0.25, 0.25), R * rr(0.7, 0.98), 9, 0.25);
        const all = [main];
        for (let b = 2; b < main.length - 1; b += 2) {
          const [x, y, ang] = main[b], side = b % 4 ? 1 : -1;
          all.push(shoot(x, y, ang + side * rr(0.5, 0.9), R * rr(0.18, 0.32), 4, 0.3).map(([px, py, pa]) => [px - Math.cos(ang + side * 0.7) * R * 0.06, py - Math.sin(ang + side * 0.7) * R * 0.06, pa]));
        }
        for (const pts of all) {
          stem(pts, 1.6, 0.8, 'rgba(56,48,34,1)');
          pts.forEach(([, , ang], i) => {
            for (let n = 0; n < 5; n++) {
              const f = i + n / 5;
              if (f >= pts.length - 1) break;
              const [ax, ay] = pts[Math.floor(f)], [bx, by] = pts[Math.floor(f) + 1];
              const u = f % 1;
              marks.push({ x: ax + (bx - ax) * u, y: ay + (by - ay) * u, a: ang, ...place(cx, cy, ax, ay) });
            }
          });
        }
      }
      marks.sort((p, q) => p.out - q.out);
      for (const m of marks) {
        const L = 30 + m.out * 24 + m.lit * 12 + rr(-6, 6);
        c.strokeStyle = `hsl(${rr(84, 112)},${rr(8, 18)}%,${L}%)`;
        c.lineWidth = rr(1.1, 1.6);
        for (const side of [-1, 1]) {
          const a = m.a + side * rr(0.6, 1.1), len = rr(4, 7);
          c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(m.x + Math.cos(a) * len, m.y + Math.sin(a) * len); c.stroke();
        }
      }
    }
    c.restore();
  }
  const t = toTexture(col, { anisotropy: 4 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Bark for the trees: ridges running up the stem with furrows between them,
// broken across here and there into plates, and a little lichen. It tiles both
// ways — every wander in a furrow is a whole number of waves down the canvas —
// and it is grey-brown and near-neutral, since each tree's vertex colour gives
// it its species (a pine's red-brown, a cherry's purple-black, a maple's grey).
export function bark({ w = 256, h = 512, seed = 83 } = {}) {
  const rnd = makeRng(seed);
  const [col, c] = canvas(w, h);
  const [hei, hg] = canvas(w, h);
  c.fillStyle = 'rgb(136,124,110)';
  c.fillRect(0, 0, w, h);
  hg.fillStyle = grey(170);
  hg.fillRect(0, 0, w, h);
  const TAU = Math.PI * 2;
  // anything that crosses a side edge is drawn again across it
  const wrapped = (fn) => { for (const dx of [-w, 0, w]) fn(dx); };
  // the ridges' own streaks: fibres up the bark
  for (let k = 0; k < 500; k++) {
    const x = rnd() * w, y = rnd() * h, len = 10 + rnd() * 60, v = rnd();
    c.fillStyle = v < 0.5 ? `rgba(70,60,50,${0.08 + rnd() * 0.12})` : `rgba(190,178,160,${0.06 + rnd() * 0.1})`;
    for (const dy of [-h, 0]) c.fillRect(x, y + dy, 1 + rnd() * 1.5, len);
  }
  // the furrows
  for (let k = 0; k < 20; k++) {
    const x0 = rnd() * w, n1 = 1 + Math.floor(rnd() * 2), n2 = 3 + Math.floor(rnd() * 3);
    const a1 = 3 + rnd() * 7, a2 = 1 + rnd() * 3, p1 = rnd() * TAU, p2 = rnd() * TAU, p3 = rnd() * TAU;
    const width = 2 + rnd() * 4;
    for (let y = 0; y < h; y += 2) {
      const x = x0 + a1 * Math.sin((y / h) * TAU * n1 + p1) + a2 * Math.sin((y / h) * TAU * n2 + p2);
      const wy = width * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin((y / h) * TAU * (2 + (k % 3)) + p3)));
      wrapped((dx) => {
        c.fillStyle = 'rgba(40,32,26,0.35)';
        c.fillRect(x + dx - wy, y, wy * 2, 2);
        c.fillStyle = 'rgba(28,22,18,0.8)';
        c.fillRect(x + dx - wy * 0.45, y, wy * 0.9, 2);
        hg.fillStyle = 'rgba(0,0,0,0.3)';
        hg.fillRect(x + dx - wy, y, wy * 2, 2);
        hg.fillStyle = 'rgba(0,0,0,0.7)';
        hg.fillRect(x + dx - wy * 0.45, y, wy * 0.9, 2);
      });
    }
  }
  // plates: the ridges broken across
  for (let k = 0; k < 70; k++) {
    const x = rnd() * w, y = rnd() * h, len = 6 + rnd() * 16, tilt = (rnd() - 0.5) * 6;
    wrapped((dx) => {
      c.strokeStyle = 'rgba(30,24,20,0.55)';
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x + dx, y); c.lineTo(x + dx + len, y + tilt); c.stroke();
      hg.strokeStyle = 'rgba(0,0,0,0.5)';
      hg.lineWidth = 1.5;
      hg.beginPath(); hg.moveTo(x + dx, y); hg.lineTo(x + dx + len, y + tilt); hg.stroke();
    });
  }
  // lichen, pale and grey-green, in a few patches
  for (let k = 0; k < 26; k++) {
    const x = rnd() * w, y = rnd() * (h - 40) + 20, r = 3 + rnd() * 9;
    wrapped((dx) => {
      c.fillStyle = `rgba(${150 + rnd() * 30},${156 + rnd() * 30},${128 + rnd() * 20},${0.12 + rnd() * 0.16})`;
      c.beginPath(); c.ellipse(x + dx, y, r, r * 1.4, 0, 0, TAU); c.fill();
    });
  }
  const map = toTexture(col);
  const normalMap = toTexture(normalsFrom(hei, 3), { srgb: false });
  return { map, normalMap };
}

// A soft round falloff with a hot centre: light caught in the air.
// `hollow`: the fraction of the radius left dark in the middle, for a halo
// hung round a lamp globe that carries its own light — a halo that peaks on
// the glass lays a flat wash over it and the globe reads as a paper disc.
export function glow(size = 128, hollow = 0) {
  const [col, c] = canvas(size);
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  if (hollow) {
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(hollow * 0.85, 'rgba(255,255,255,0)');
    g.addColorStop(hollow * 1.15, 'rgba(255,255,255,0.62)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.14, 'rgba(255,255,255,0.62)');
  }
  g.addColorStop(0.4, 'rgba(255,255,255,0.17)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  const t = toTexture(col, { anisotropy: 1 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ── Carved stone ──────────────────────────────────────────────────────────────

// Limestone for carving: the pale stone of the caps with no joints in it. A
// moulding is cut along its own length, and the courses of an ashlar texture
// laid across a roll or a capital read as stripes painted on it; where this
// stone has joints they are cut in the geometry (see portal.js). What is left
// to paint is what a dressed face really carries: a slow mottle through the
// bed, shell in it, the fine drag of the claw and a second drag across it,
// soot and wash, and a grain the lamp rakes across in the normal map.
// `honed`: a finished face, not a dressed one — no claw marks, the shell and
// grain fainter, the bed run along the stone's length, as a column's is (it
// is cut with the bed upright).
export function limestone({ size = 1024, seed = 61, tone = [164, 157, 144], honed = false } = {}) {
  const rnd = makeRng(seed);
  const [col, c] = canvas(size);
  const [hei, hg] = canvas(size);
  const [rou, rg] = canvas(size);
  c.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`;
  c.fillRect(0, 0, size, size);
  hg.fillStyle = grey(128);
  hg.fillRect(0, 0, size, size);
  rg.fillStyle = grey(228);
  rg.fillRect(0, 0, size, size);
  // Anything round is drawn again across each seam it crosses, so the canvas tiles.
  const tiled = (x, y, r, paint) => {
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        if (x + dx + r < 0 || x + dx - r > size || y + dy + r < 0 || y + dy - r > size) continue;
        paint(x + dx, y + dy);
      }
    }
  };
  // the mottle of the bed: broad, soft and low in contrast
  for (let k = 0; k < 90; k++) {
    const x = rnd() * size, y = rnd() * size, r = size * (0.05 + rnd() * 0.2);
    const warm = rnd() < 0.45, a = 0.018 + rnd() * 0.034;
    tiled(x, y, r, (px, py) => {
      const b = c.createRadialGradient(px, py, 0, px, py, r);
      b.addColorStop(0, warm ? `rgba(214,196,164,${a})` : `rgba(58,52,44,${a})`);
      b.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = b;
      c.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  // the bed itself: faint banding a stone keeps from how it was laid down
  for (let y = 0; y < size; y += 2) {
    const v = Math.sin((y / size) * Math.PI * 2 * 3 + 1.3) * 0.5 + Math.sin((y / size) * Math.PI * 2 * 11 + 4.1) * 0.3 + (rnd() - 0.5) * 0.4;
    c.fillStyle = v > 0 ? `rgba(226,214,190,${v * 0.025})` : `rgba(40,34,28,${-v * 0.03})`;
    c.fillRect(0, y, size, 2);
  }
  // shell: small pale crescents, the thing that says oolite and not plaster
  for (let k = 0; k < 900; k++) {
    const x = rnd() * size, y = rnd() * size, r = 0.8 + rnd() * 2.6;
    c.strokeStyle = `rgba(232,224,206,${0.12 + rnd() * 0.2})`;
    c.lineWidth = 0.6 + rnd() * 0.8;
    const a0 = rnd() * 6.28;
    c.beginPath();
    c.arc(x, y, r, a0, a0 + 1.4 + rnd() * 2);
    c.stroke();
    hg.fillStyle = `rgba(255,255,255,${0.1 + rnd() * 0.1})`;
    hg.fillRect(x - r / 2, y - r / 2, r, r);
  }
  // The claw's drag, in short parallel sets at the mason's angle, and a second
  // pass across it: faint in the colour, clear in the normal map, so it only
  // shows where a lamp grazes the face.
  for (let set = 0; set < (honed ? 0 : 170); set++) {
    const x = rnd() * size, y = rnd() * size, a = (rnd() < 0.5 ? 0.35 : -0.5) + (rnd() - 0.5) * 0.3;
    const L = 20 + rnd() * 60, teeth = 4 + Math.floor(rnd() * 5), gap = 2.2 + rnd() * 1.4;
    for (let t = 0; t < teeth; t++) {
      const ox = -Math.sin(a) * t * gap, oy = Math.cos(a) * t * gap;
      for (const [g, style] of [[hg, 'rgba(0,0,0,0.22)'], [c, 'rgba(30,24,18,0.035)']]) {
        g.strokeStyle = style;
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.lineTo(x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L);
        g.stroke();
      }
    }
  }
  // grain: a fine speckle through all three maps together
  pits([c, hg, rg], rnd, size, 5200, { dark: 0.09, big: 1.1, deep: 30 });
  for (let k = 0; k < 26000; k++) {
    const x = rnd() * size, y = rnd() * size, s = 1 + rnd() * 1.6, up = rnd() < 0.5;
    c.fillStyle = up ? `rgba(236,228,210,${rnd() * 0.06})` : `rgba(20,16,12,${rnd() * 0.06})`;
    c.fillRect(x, y, s, s);
    hg.fillStyle = up ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    hg.fillRect(x, y, s, s);
  }
  soil(c, rnd, size, 7, 0.5);
  return {
    map: toTexture(col),
    normalMap: toTexture(normalsFrom(hei, 1.4), { srgb: false }),
    roughnessMap: toTexture(rou, { srgb: false }),
  };
}

// Purbeck: the dark shelly marble the shafts of a Gothic doorway were cut
// from, polished — near black-brown with the fossil shell showing grey in it.
// The one polished thing in a pale doorway, so the colonnettes stand off the
// jambs they are set against instead of melting into them.
export function purbeck({ size = 512, seed = 67 } = {}) {
  const rnd = makeRng(seed);
  const [col, c] = canvas(size);
  c.fillStyle = '#3b3630';
  c.fillRect(0, 0, size, size);
  for (let k = 0; k < 40; k++) {
    const x = rnd() * size, y = rnd() * size, r = size * (0.05 + rnd() * 0.18);
    const b = c.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, rnd() < 0.5 ? 'rgba(92,84,70,0.16)' : 'rgba(14,12,10,0.22)');
    b.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = b;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // the shell, packed: little grey whorls and crescents, denser in bands
  for (let k = 0; k < 3400; k++) {
    const x = rnd() * size, y = rnd() * size;
    if (rnd() > 0.55 + 0.45 * Math.sin((y / size) * Math.PI * 2 * 6)) continue;
    const r = 0.8 + rnd() * 3.2, a0 = rnd() * 6.28;
    c.strokeStyle = `rgba(${140 + rnd() * 50},${130 + rnd() * 44},${112 + rnd() * 36},${0.25 + rnd() * 0.4})`;
    c.lineWidth = 0.5 + rnd() * 0.9;
    c.beginPath();
    c.arc(x, y, r, a0, a0 + 2 + rnd() * 3);
    c.stroke();
  }
  return { map: toTexture(col) };
}

// What hangs in the Door's arch, on a clear ground, each kind's stalk at the
// top of its column: 0 and 1 are wisteria racemes (a cone of florets, open
// and pale at the stalk, tight dark bud at the tip), 2 and 3 trailing strands
// of green — a stem with its leaves in pairs along it, the curtain the plates
// hang in that doorway. 4 and 5 are a weeping willow's: three or four whips
// to a card, each hung with narrow leaves that point down it, the curtain the
// willows by the pond let fall (trees.js).
export const HANGING_KINDS = 6;
export function hanging({ w = 128, h = 512, seed = 71 } = {}) {
  const rnd = makeRng(seed);
  const [col, c] = canvas(w * HANGING_KINDS, h);
  c.clearRect(0, 0, w * HANGING_KINDS, h);
  const leaf = (x, y, L, a, hue, light) => {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillStyle = `hsl(${hue},${30 + rnd() * 14}%,${light}%)`;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(L * 0.5, -L * 0.3, L, 0);
    c.quadraticCurveTo(L * 0.5, L * 0.3, 0, 0);
    c.fill();
    c.strokeStyle = `hsla(${hue},30%,${Math.max(4, light - 12)}%,0.8)`;
    c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(L * 0.9, 0); c.stroke();
    c.restore();
  };
  for (let kind = 0; kind < HANGING_KINDS; kind++) {
    const x0 = kind * w, cx = x0 + w / 2;
    // everything drawn for a kind stays inside its own column
    c.save();
    c.beginPath(); c.rect(x0 + 1, 0, w - 2, h); c.clip();
    if (kind < 2) {
      // the stalk, and a few leaflets where it leaves the vine
      c.strokeStyle = 'rgba(70,74,48,1)';
      c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(cx, 0); c.quadraticCurveTo(cx + 4, h * 0.2, cx - 2, h * 0.92); c.stroke();
      for (let k = 0; k < 7; k++) leaf(cx + (rnd() - 0.5) * 8, 4 + k * 9, 22 + rnd() * 16, (k % 2 ? 0.5 : Math.PI - 0.5) + (rnd() - 0.5) * 0.4, 96 + rnd() * 24, 26 + rnd() * 12);
      // florets from the top of the cone down, smaller and darker toward the tip
      const top = h * 0.1, len = h * (0.78 + kind * 0.08);
      for (let k = 0; k < 420; k++) {
        const t = rnd() ** 0.8, y = top + t * len;
        const spread = (1 - t) ** 0.7 * w * 0.36 + 3;
        const x = cx + (rnd() - 0.5) * 2 * spread + Math.sin(t * 3) * 4;
        const r = 3.6 * (1 - t * 0.6) + rnd() * 1.6;
        const open = 1 - t;
        const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        const L = 44 + open * 30 + rnd() * 8;
        g.addColorStop(0, `hsla(${266 + rnd() * 14},${34 + open * 18}%,${Math.min(92, L + 12)}%,1)`);
        g.addColorStop(0.7, `hsla(${262 + rnd() * 14},${38 + open * 14}%,${L}%,1)`);
        g.addColorStop(1, `hsla(258,40%,${L - 14}%,0)`);
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    } else if (kind >= 4) {
      // Willow whips: fine, pale-barked, hanging straight and swaying out a
      // little at the tip; the leaves narrow, yellow-green, lying close along
      // them and pointing down. The canvas is drawn at a card's proportions
      // (a column is 128 across and 512 down for a card some four units wide
      // and thirty long), so a leaf is drawn short down it and it stretches.
      const whips = kind === 4 ? 2 : 3;
      for (let s = 0; s < whips; s++) {
        let x = x0 + w * (0.24 + (0.52 * (s + 0.3 + rnd() * 0.4)) / whips), y = 0;
        // ragged at the foot: no two whips on a card end together
        const reach = h * (0.6 + rnd() * 0.38), drift = (rnd() - 0.5) * 0.5;
        const pts = [];
        while (y < reach) {
          pts.push([x, y]);
          y += 5;
          x += drift + (rnd() - 0.5) * 1.2;
          x = Math.max(x0 + 14, Math.min(x0 + w - 14, x));
        }
        c.strokeStyle = 'rgba(96,88,52,1)';
        c.lineWidth = 1.2;
        c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
        pts.forEach(([px, py], i) => {
          if (i < 2) return;
          const t = py / reach;
          for (const side of [-1, 1]) {
            if (rnd() < 0.34) continue;
            const L = (15 + rnd() * 9) * (1 - t * 0.35);
            // pointing down the whip, splayed a little off it
            const a = Math.PI / 2 + side * (0.22 + rnd() * 0.3);
            c.save();
            c.translate(px, py);
            c.rotate(a);
            c.fillStyle = `hsl(${74 + rnd() * 20},${14 + rnd() * 12}%,${22 + rnd() * 16 - t * 5}%)`;
            c.beginPath();
            c.moveTo(0, 0);
            c.quadraticCurveTo(L * 0.45, -2.6, L, 0);
            c.quadraticCurveTo(L * 0.45, 2.6, 0, 0);
            c.fill();
            c.restore();
          }
        });
      }
    } else {
      // a long stem wandering down, leaves in pairs along it, thinning to the tip
      const pts = [];
      let x = cx, y = 0;
      while (y < h * 0.97) {
        pts.push([x, y]);
        y += 6;
        x += (rnd() - 0.5) * 3 + Math.sin(y * 0.02 + kind) * 0.8;
        x = Math.max(x0 + 20, Math.min(x0 + w - 20, x));
      }
      c.strokeStyle = 'rgba(52,64,40,1)';
      c.lineWidth = 1.8;
      c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
      pts.forEach(([px, py], i) => {
        if (i % 2) return;
        const t = py / h, L = (18 + rnd() * 12) * (1 - t * 0.45);
        for (const side of [-1, 1]) leaf(px, py, L, (side < 0 ? Math.PI - 0.9 : 0.9) + (rnd() - 0.5) * 0.5, 104 + rnd() * 30, 22 + rnd() * 20 - t * 6);
      });
    }
    c.restore();
  }
  const t = toTexture(col, { anisotropy: 4 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
