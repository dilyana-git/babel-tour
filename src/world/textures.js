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

const canvas = (w, h = w) => {
  const c = document.createElement('canvas');
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
  const bw = size / blocks;
  const rhythm = RHYTHM.slice(0, courses);
  while (rhythm.length < courses) rhythm.push(RHYTHM[rhythm.length % RHYTHM.length]);
  const sum = rhythm.reduce((a, b) => a + b, 0);
  const block = (x, y, w, h, [v, wear, tilt], strokes) => {
    const l = v * 16;
    c.fillStyle = `rgb(${tone[0] + l + 4},${tone[1] + l},${tone[2] + l - 3})`;
    c.fillRect(x, y, w, h);
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
    rg.fillStyle = grey(200 - wear * 60);
    rg.fillRect(x + 4, y + 4, w - 8, h - 8);
    // tooling: short parallel strokes across the face
    for (const [fx, fy, tl, lighter] of strokes) {
      c.fillStyle = lighter ? 'rgba(236,226,206,0.06)' : 'rgba(18,13,8,0.08)';
      c.fillRect(x + fx * w, y + fy * h, tl, 1);
      hg.fillStyle = lighter ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
      hg.fillRect(x + fx * w, y + fy * h, tl, 1);
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
      const look = [rnd() * 2 - 1, rnd(), rnd()];
      const strokes = Array.from({ length: Math.round((70 * w) / bw) }, () => [rnd(), rnd(), 3 + rnd() * 14, rnd() < 0.5]);
      // a block over the right-hand edge comes back in at the left
      for (const dx of [0, -size]) {
        if (x + dx + w <= 0 || x + dx >= size) continue;
        block(x + dx + joint, y0 + joint, w - joint * 2, bh - joint * 2, look, strokes);
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
      const gloss = rg.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.6);
      gloss.addColorStop(0, grey(96 - polish * 30));
      gloss.addColorStop(1, grey(190));
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
  };
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
// letter, has the cap in its middle.
export function giltLetters({ chars = 'ACDEGHILMNOVWX·', cols = 4, cellW = 160, cellH = 128, px = 112 } = {}) {
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
export function limestone({ size = 1024, seed = 61, tone = [164, 157, 144] } = {}) {
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
  for (let set = 0; set < 170; set++) {
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
