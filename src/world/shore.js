// ── The pond's edge ──────────────────────────────────────────────────────────
// 2026-10-07, from the foot of the Pavilion's bridge: "The edge of the lake
// looks very unrealistic ... The stones do not look very detailed - like a
// complete afterthought." What was there:
//   - the water was a sheet 0.3 thick laid 2.5 over the lawn (WATER_Y 6.5 on
//     ground at 4), cut to an ellipse: the gravel ran under it, and its edge
//     stood up out of the path as a step of black glass;
//   - round it, a stone at every other point of that ellipse, each the same
//     smooth icosahedron (buildWorld's stoneGeo) squashed and darkened, so
//     they lay on the water like beans;
//   - the bridge came down onto two boxes of the paving's ashlar, a joint of
//     it drawn across them as if they were a little wall.
// So, as a garden pond is made:
//   - a BANK (`pondShore`): the ground rises out of the lawn or the gravel to
//     a lip just over the water and goes down under it, so the water lies IN
//     the ground and its edge is wherever the bank meets it; wet earth and
//     pebbles at the water, lawn or gravel again where it meets the floor;
//   - its stones SET as a gardener sets them: a big stone and its companions
//     straddling the waterline, a kerb of set stones wherever a way runs along
//     the water, a beach of pebbles between, a low stone here and there in the
//     grass;
//   - every stone a stone (`gardenRock`): a block of the hill's rock,
//     weathered round along its arrises and cleft flat where it split, rough
//     over all of it, dark in its hollows and at its foot, moss on what faces
//     up, lichen in patches; its grain (`shoreRock`) laid on from three sides
//     in the world's units, and wet from the water up a hand's breadth;
//   - and the bridge's foot (`bridgeFoot`) a pier of coursed granite blocks
//     with one broad stone to step up from.
// Its own streams throughout: nothing here draws on the world's.
import * as THREE from 'three';
import { makeRng, normalsFrom, toTexture } from './textures';
import { noise, fbm, boxSurface, curvature, wear, smoothstep, clamp } from './rubble';

const TAU = Math.PI * 2;
const canvas = (w, h = w) => {
  const c = typeof document === 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
};
// anything round drawn again across each seam it crosses, so the canvas tiles
const tiler = (size) => (x, y, r, paint) => {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      if (x + dx + r < 0 || x + dx - r > size || y + dy + r < 0 || y + dy - r > size) continue;
      paint(x + dx, y + dy);
    }
  }
};
const blotter = (tiled) => (g, x, y, r, inner) => tiled(x, y, r, (px, py) => {
  const b = g.createRadialGradient(px, py, 0, px, py, r);
  b.addColorStop(0, inner);
  b.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = b;
  g.fillRect(px - r, py - r, r * 2, r * 2);
});

// ── The stone's grain ────────────────────────────────────────────────────────
// Units of the world to a repeat of it (seven: 66 cm), as shoreRockLit lays it.
export const ROCK_TILE = 7;
// A weathered granite, the garden's own: grey with a little warmth, its
// crystals black, white, rose and glassy grey, clouded slowly, rusted where
// iron weathered out of it, pitted, crazed with a few hairline joints, and
// crusted with lichen in rosettes — in its relief as much as in its colour.
export function shoreRock({ size = 1024, seed = 211 } = {}) {
  const rnd = makeRng(seed);
  const R = (lo, hi) => lo + (hi - lo) * rnd();
  const [col, c] = canvas(size);
  const [hei, hg] = canvas(size);
  const [rou, rg] = canvas(size);
  c.fillStyle = 'rgb(150,146,138)';
  c.fillRect(0, 0, size, size);
  hg.fillStyle = 'rgb(128,128,128)';
  hg.fillRect(0, 0, size, size);
  rg.fillStyle = 'rgb(214,214,214)';
  rg.fillRect(0, 0, size, size);
  const tiled = tiler(size), blot = blotter(tiled);
  for (let k = 0; k < 170; k++) {
    const r = size * (0.04 + rnd() ** 2 * 0.24), x = rnd() * size, y = rnd() * size, up = rnd() < 0.5, a = R(0.05, 0.11);
    blot(c, x, y, r, up ? `rgba(220,214,200,${a})` : `rgba(44,40,36,${a * 1.2})`);
    blot(hg, x, y, r, up ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  }
  for (let k = 0; k < 14; k++) blot(c, rnd() * size, rnd() * size, size * R(0.02, 0.08), `rgba(140,100,62,${R(0.05, 0.11)})`);
  // the crystals: [colour, share, lift]
  const grains = [['28,26,24', 0.34, -1], ['228,222,210', 0.34, 1], ['176,146,118', 0.1, 0.5], ['112,114,116', 0.22, 0]];
  for (let k = 0; k < 130000; k++) {
    let t = rnd(), j = 0;
    while (t > grains[j][1] && j < grains.length - 1) { t -= grains[j][1]; j++; }
    const [rgb, , lift] = grains[j], s = 1 + rnd() * rnd() * 3, a = R(0.12, 0.5), x = rnd() * size, y = rnd() * size;
    c.fillStyle = `rgba(${rgb},${a})`;
    c.fillRect(x, y, s, s);
    if (lift) {
      hg.fillStyle = lift > 0 ? `rgba(255,255,255,${a * 0.3 * lift})` : `rgba(0,0,0,${a * 0.35})`;
      hg.fillRect(x, y, s, s);
    }
  }
  // What reads from a few paces, where the grain does not: its big crystals —
  // feldspar laths, white and rose, a centimetre or two — and dark clots of
  // mica, both standing a little proud where the rest has weathered back.
  const rgb = (v, a) => `rgba(${v.map(Math.round).join(',')},${a})`;
  for (let k = 0; k < 1100; k++) {
    const x = rnd() * size, y = rnd() * size, L = R(3, 13), W = L * R(0.3, 0.6), rot = R(0, Math.PI), rose = rnd() < 0.3;
    const a = R(0.35, 0.75), l = R(196, 232);
    tiled(x, y, L, (px, py) => {
      for (const [g, style] of [[c, rgb(rose ? [l, l * 0.86, l * 0.76] : [l, l * 0.97, l * 0.9], a)], [hg, `rgba(255,255,255,${a * 0.4})`], [rg, `rgba(0,0,0,${a * 0.18})`]]) {
        g.save();
        g.translate(px, py);
        g.rotate(rot);
        g.fillStyle = style;
        g.fillRect(-L / 2, -W / 2, L, W);
        g.restore();
      }
    });
  }
  for (let k = 0; k < 1600; k++) {
    const x = rnd() * size, y = rnd() * size, r = R(1.5, 5), a = R(0.45, 0.8);
    tiled(x, y, r, (px, py) => {
      c.fillStyle = `rgba(26,24,22,${a})`;
      hg.fillStyle = `rgba(0,0,0,${a * 0.3})`;
      for (const g of [c, hg]) {
        g.beginPath();
        for (let t = 0; t < 7; t++) {
          const an = (t / 7) * TAU, rr = r * (0.6 + 0.5 * rnd());
          g.lineTo(px + Math.cos(an) * rr, py + Math.sin(an) * rr);
        }
        g.fill();
      }
    });
  }
  const hole = (x, y, r, dark, deep) => {
    c.fillStyle = `rgba(36,32,28,${dark})`;
    hg.fillStyle = `rgba(0,0,0,${deep})`;
    rg.fillStyle = 'rgba(255,255,255,0.5)';
    for (const g of [c, hg, rg]) {
      g.beginPath();
      for (let t = 0; t < 8; t++) {
        const a = (t / 8) * TAU, rr = r * (0.65 + 0.5 * rnd());
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.fill();
    }
  };
  for (let k = 0; k < 1200; k++) hole(rnd() * size, rnd() * size, 0.5 + rnd() ** 3 * 2.2, R(0.12, 0.3), R(0.3, 0.6));
  // and the pits weather opens where a crystal has gone, a few millimetres to a centimetre
  for (let k = 0; k < 520; k++) hole(R(8, size - 8), R(8, size - 8), R(2, 7), R(0.3, 0.5), R(0.6, 0.9));
  for (let k = 0; k < 14; k++) {
    let x = R(0.1, 0.9) * size, y = R(0.1, 0.9) * size, a = rnd() * TAU;
    const steps = Math.floor(R(10, 34)), w = R(0.7, 1.4);
    c.strokeStyle = `rgba(34,30,26,${R(0.18, 0.36)})`;
    hg.strokeStyle = 'rgba(0,0,0,0.55)';
    for (const g of [c, hg]) { g.lineWidth = w; g.beginPath(); g.moveTo(x, y); }
    for (let s = 0; s < steps; s++) {
      a += R(-0.45, 0.45);
      x += Math.cos(a) * R(3, 9);
      y += Math.sin(a) * R(3, 9);
      c.lineTo(x, y);
      hg.lineTo(x, y);
    }
    c.stroke();
    hg.stroke();
  }
  // Lichen: crusts in rosettes, grey-green, sulphur-ochre and near white,
  // densest in the middle of a colony and thinning to its rim, a little proud
  // of the stone and dry (rough) where the stone round it may shine wet.
  const lichens = [[180, 180, 162], [190, 178, 140], [200, 198, 186], [156, 158, 142]];
  for (let k = 0; k < 30; k++) {
    const [lr, lg, lb] = lichens[Math.floor(rnd() * lichens.length)];
    const cx = rnd() * size, cy = rnd() * size, r = R(10, 50), n = Math.round(r * r * 0.4);
    // (lobed: a colony grows out unevenly, and a disc of it read as a spot)
    const lobes = [R(0, TAU), R(0, TAU), R(0, TAU)], lobe = (a) => 0.62 + 0.2 * Math.sin(a * 3 + lobes[0]) + 0.12 * Math.sin(a * 5 + lobes[1]) + 0.08 * Math.sin(a * 2 + lobes[2]);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, d = r * lobe(a) * Math.sqrt(rnd()), dr = R(0.6, 2.2);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const al = R(0.12, 0.4) * (1 - 0.5 * (d / r) ** 2);
      tiled(x, y, dr, (px, py) => {
        c.fillStyle = `rgba(${lr},${lg},${lb},${al})`;
        hg.fillStyle = `rgba(255,255,255,${al * 0.25})`;
        rg.fillStyle = `rgba(255,255,255,${al * 0.5})`;
        for (const g of [c, hg, rg]) { g.beginPath(); g.arc(px, py, dr, 0, TAU); g.fill(); }
      });
    }
  }
  return {
    map: toTexture(col),
    normalMap: toTexture(withAlpha(normalsFrom(hei, 3), rou), { srgb: false }),
    roughnessMap: toTexture(rou, { srgb: false }),
  };
}
// The roughness in a normal map's alpha, so the stones read both in one look
// up per side (shoreRockLit): twelve reads a pixel made the garden's stones
// cost as much as everything else on the lawn.
const withAlpha = (normal, rough) => {
  const w = normal.width, h = normal.height, g = normal.getContext('2d', { willReadFrequently: true });
  const n = g.getImageData(0, 0, w, h), r = rough.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) n.data[i * 4 + 3] = Math.max(96, r[i * 4 + 1]);
  g.putImageData(n, 0, 0);
  return normal;
};

// ── The bank's ground ────────────────────────────────────────────────────────
// Units to a repeat (fourteen: 1.3 m), as bankLit lays it.
export const BANK_TILE = 14;
// What the water's edge is made of where it is not stone: pebbles of the same
// granite and the river's darker stones, two to ten centimetres, bedded in
// dark earth, a few white with quartz; moss creeping over them in patches;
// last year's leaves.
export function shoreBank({ size = 1024, seed = 223 } = {}) {
  const rnd = makeRng(seed);
  const R = (lo, hi) => lo + (hi - lo) * rnd();
  const [col, c] = canvas(size);
  const [hei, hg] = canvas(size);
  const [rou, rg] = canvas(size);
  c.fillStyle = 'rgb(64,55,44)';
  c.fillRect(0, 0, size, size);
  hg.fillStyle = 'rgb(70,70,70)';
  hg.fillRect(0, 0, size, size);
  rg.fillStyle = 'rgb(236,236,236)';
  rg.fillRect(0, 0, size, size);
  const tiled = tiler(size), blot = blotter(tiled);
  for (let k = 0; k < 90; k++) {
    const r = size * R(0.03, 0.15), up = rnd() < 0.5;
    blot(c, rnd() * size, rnd() * size, r, up ? `rgba(120,104,82,${R(0.05, 0.12)})` : `rgba(20,16,12,${R(0.08, 0.16)})`);
  }
  for (let k = 0; k < 30000; k++) {
    const l = R(-40, 60);
    c.fillStyle = `rgba(${110 + l},${100 + l},${86 + l},${R(0.2, 0.6)})`;
    c.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  const S = size / BANK_TILE;
  const rgb = (v) => `rgb(${v.map((x) => Math.round(clamp(x, 0, 255))).join(',')})`;
  for (let k = 0; k < 2400; k++) {
    const r = S * (0.12 + rnd() ** 1.8 * 0.42), asp = R(0.6, 1), rot = R(0, Math.PI), x = rnd() * size, y = rnd() * size;
    const fam = rnd();
    const l = fam < 0.06 ? R(190, 220) : fam < 0.3 ? R(60, 92) : R(96, 170);
    const base = fam < 0.06 ? [l, l * 0.98, l * 0.93] : fam < 0.55 ? [l, l * 0.97, l * 0.92] : [l * 1.04, l * 0.94, l * 0.8];
    tiled(x, y, r * 1.3, (px, py) => {
      // the dark of the earth it sits in, under its rim
      const ao = c.createRadialGradient(px, py, r * 0.8, px, py, r * 1.3);
      ao.addColorStop(0, 'rgba(14,11,8,0.55)');
      ao.addColorStop(1, 'rgba(14,11,8,0)');
      c.fillStyle = ao;
      c.fillRect(px - r * 1.3, py - r * 1.3, r * 2.6, r * 2.6);
      for (const [g, inner, mid, rim] of [
        [c, rgb(base.map((v) => v * 1.12)), rgb(base), rgb(base.map((v) => v * 0.62))],
        [hg, 'rgb(250,250,250)', 'rgb(205,205,205)', 'rgb(120,120,120)'],
        [rg, 'rgb(170,170,170)', 'rgb(185,185,185)', 'rgb(215,215,215)'],
      ]) {
        g.save();
        g.translate(px, py);
        g.rotate(rot);
        g.scale(1, asp);
        const gr = g.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.05, 0, 0, r);
        gr.addColorStop(0, inner);
        gr.addColorStop(0.7, mid);
        gr.addColorStop(1, rim);
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.fill();
        g.restore();
      }
    });
  }
  // moss, in patches over earth and stones alike
  for (let k = 0; k < 55; k++) {
    const cx = rnd() * size, cy = rnd() * size, r = R(20, 90), n = Math.round(r * r * 0.35);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, d = r * Math.sqrt(rnd()), dr = R(0.8, 2.6);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * R(0.7, 1.1);
      const al = R(0.35, 0.85) * (1 - 0.6 * (d / r) ** 2), lit = rnd() < 0.3;
      tiled(x, y, dr, (px, py) => {
        c.fillStyle = lit ? `rgba(92,104,46,${al})` : `rgba(48,60,26,${al})`;
        hg.fillStyle = `rgba(255,255,255,${al * 0.18})`;
        rg.fillStyle = `rgba(255,255,255,${al})`;
        for (const g of [c, hg, rg]) { g.beginPath(); g.arc(px, py, dr, 0, TAU); g.fill(); }
      });
    }
  }
  for (let k = 0; k < 60; k++) {
    const x = rnd() * size, y = rnd() * size, r = R(4, 11), rot = R(0, Math.PI);
    tiled(x, y, r, (px, py) => {
      c.save();
      c.translate(px, py);
      c.rotate(rot);
      c.fillStyle = `rgba(${Math.round(R(80, 120))},${Math.round(R(52, 70))},${Math.round(R(28, 40))},${R(0.5, 0.8)})`;
      c.beginPath();
      c.ellipse(0, 0, r, r * 0.45, 0, 0, TAU);
      c.fill();
      c.restore();
    });
  }
  return {
    map: toTexture(col),
    normalMap: toTexture(withAlpha(normalsFrom(hei, 3), rou), { srgb: false }),
    roughnessMap: toTexture(rou, { srgb: false }),
  };
}

// ── A stone ──────────────────────────────────────────────────────────────────
// Laplacian smoothing over a closed mesh: rounds what a cut left sharp.
// how rusty a stone is, by its seed: most a little, a few a lot
const R2 = (ns) => [0.2, 0.5, 0.9, 0.35, 1.2, 0.15, 0.6][ns % 7];
const relax = (g, lambda, passes) => {
  const p = g.attributes.position.array, idx = g.index.array, N = p.length / 3;
  for (let pass = 0; pass < passes; pass++) {
    const sum = new Float64Array(N * 3), cnt = new Uint16Array(N);
    for (let t = 0; t < idx.length; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = idx[t + e], b = idx[t + (e + 1) % 3];
        for (let j = 0; j < 3; j++) { sum[a * 3 + j] += p[b * 3 + j]; sum[b * 3 + j] += p[a * 3 + j]; }
        cnt[a]++;
        cnt[b]++;
      }
    }
    for (let i = 0; i < N; i++) {
      if (!cnt[i]) continue;
      for (let j = 0; j < 3; j++) p[i * 3 + j] += lambda * (sum[i * 3 + j] / cnt[i] - p[i * 3 + j]);
    }
  }
  g.attributes.position.needsUpdate = true;
};

// A garden stone, built where it lies: `w` along x, `h` up, `d` across z, its
// lowest point at y 0. A block of the rock (`round`: how far its arrises are
// worn, of its least half-size), cleft flat by `cuts` planes, never under it;
// rough over all of it (`dressed`: a mason's face, rough only a little); its
// tone in its vertices — dark in its hollows and toward its foot, pale on a
// worn arris, moss (`moss`) on what faces up, lichen (`lichen`) in patches,
// `tone` and `warm` making each stone its own. `flatTop`: nothing rises over
// the plane its top was cut to (a stone to step on).
export function gardenRock({ w, h, d, seed, round = 0.5, cuts = 3, moss = 0.5, lichen = 0.5, tone = 1, warm = 0, dressed = false, flatTop = false, detail = 14 }) {
  const rng = makeRng(seed);
  const R = (lo, hi) => lo + (hi - lo) * rng();
  const ns = seed % 9973;
  const size = Math.max(w, h, d), least = Math.min(w, h, d);
  const S = size / detail;
  const seg = (L) => Math.max(3, Math.round(L / S));
  const g = boxSurface(w, h, d, seg(w), seg(h), seg(d));
  const hx = w / 2, hy = h / 2, hz = d / 2, H = [hx, hy, hz];
  const rad = clamp(round, 0.05, 0.95) * least / 2;
  // Cleft faces: round its sides, so that in plan it is a polygon and not a
  // box, and (a stone left as it split, not a stone to step on) one over its
  // top at a slant — never under it. Narrower at the top than at its foot,
  // and leaning a little, as nothing cut square does.
  const natural = !dressed && !flatTop;
  const planes = Array.from({ length: cuts }, (_, k) => {
    const a = R(0, TAU), top = natural && k === 0 && rng() < 0.75;
    const up = top ? R(1.2, 3.5) : flatTop ? R(-0.15, 0.15) : R(-0.25, 0.35);
    const n = [Math.cos(a), up, Math.sin(a)], L = Math.hypot(...n);
    const nrm = n.map((v) => v / L);
    const support = Math.abs(nrm[0]) * hx + Math.abs(nrm[1]) * hy + Math.abs(nrm[2]) * hz;
    return { nrm, off: support * (dressed ? R(0.8, 0.94) : top ? R(0.66, 0.86) : R(0.55, 0.84)) };
  });
  // And chipped: small clefts off its arrises and corners, each a facet with a
  // sharp rim, so no edge of it runs smooth for long (on a mason's stone,
  // spalls off its arrises; never off the top of a stone to step on).
  const chips = Array.from({ length: Math.round((dressed ? 14 : 9) + rng() * 8) }, () => {
    const a = R(0, TAU), up = flatTop ? R(-0.5, 0.1) : R(-0.35, 1.2);
    const n = [Math.cos(a), up, Math.sin(a)], L = Math.hypot(...n);
    const nrm = n.map((v) => v / L);
    const support = Math.abs(nrm[0]) * hx + Math.abs(nrm[1]) * hy + Math.abs(nrm[2]) * hz;
    return { nrm, off: support * (dressed ? R(0.93, 0.985) : R(0.86, 0.96)) };
  });
  const taper = natural ? R(0.06, 0.3) : 0, lean = natural ? [R(-0.12, 0.12), R(-0.12, 0.12)] : [0, 0];
  const soft = 0.14 * least, crisp = 0.035 * least;
  const p = g.attributes.position, N = p.count;
  const v = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    v[0] = p.getX(i); v[1] = p.getY(i); v[2] = p.getZ(i);
    const ty = (v[1] + hy) / (2 * hy);
    v[0] = v[0] * (1 - taper * ty) + lean[0] * hx * ty;
    v[2] = v[2] * (1 - taper * ty) + lean[1] * hz * ty;
    // worn round
    const q = v.map((x, j) => clamp(x, rad - H[j], H[j] - rad));
    const e = v.map((x, j) => x - q[j]), L = Math.hypot(...e);
    if (L > 1e-9) for (let j = 0; j < 3; j++) v[j] = q[j] + (e[j] / L) * rad;
    // cleft, the arris where a cleft face meets the rest worn too (a smooth min)
    for (const [list, sm] of [[planes, soft], [chips, crisp]]) {
      for (const { nrm, off } of list) {
        const s = v[0] * nrm[0] + v[1] * nrm[1] + v[2] * nrm[2] - off;
        if (s < -sm) continue;
        const k = clamp(0.5 - (0.5 * s) / sm, 0, 1), s2 = s * k - sm * k * (1 - k);
        for (let j = 0; j < 3; j++) v[j] += nrm[j] * (s2 - s);
      }
    }
    p.setXYZ(i, v[0], v[1], v[2]);
  }
  relax(g, 0.3, 1);
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  // Weathered: broad swells and hollows, finer roughness, and fissures — the
  // joints the frost opens — as narrow grooves. In the stone's own units, so
  // a pebble and a boulder are rough alike. (Over the top of a stone to step
  // on, only a little.)
  const f = 1 / size, amp = dressed ? 0.35 : 1;
  const topY = flatTop ? Math.max(...Array.from({ length: N }, (_, i) => p.getY(i))) : 0;
  for (let i = 0; i < N; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fx = x * f, fy = y * f, fz = z * f;
    let relief = size * amp * (0.06 * (noise(fx * 1.3 + 3, fy * 1.3, fz * 1.3, ns + 11) - 0.5) * 2
      + 0.03 * (fbm(fx * 3.2, fy * 3.2, fz * 3.2, ns + 1, 3) - 0.5) * 2
      + 0.01 * (noise(fx * 9, fy * 9, fz * 9, ns + 3) - 0.5) * 2);
    const rn = Math.abs(noise(fx * 3.1 + 7, fy * 3.1, fz * 3.1, ns + 5) - 0.5) * 2;
    relief -= size * amp * 0.02 * (1 - smoothstep(0, 0.07, rn));
    let ny = nr.getY(i);
    // (a stone to step on: nothing raised over its top, and that top only
    // dished a centimetre where feet have gone)
    if (flatTop && topY - y < 0.6) relief = Math.min(relief, 0);
    if (flatTop && ny > 0.6 && topY - y < 0.3) { relief = clamp(relief, -0.06, 0.0) - 0.04 * smoothstep(0.7, 1, ny); ny = 1; }
    p.setXYZ(i, x + nr.getX(i) * relief, y + ny * relief, z + nr.getZ(i) * relief);
  }
  g.computeBoundingBox();
  const lo = g.boundingBox.min.y;
  g.translate(0, -lo, 0);
  g.computeVertexNormals();
  const bend = curvature(g);
  const tint = [1 + 0.06 * warm, 1 + 0.01 * warm, 1 - 0.08 * warm];
  const col = new Float32Array(N * 3);
  const mossCol = [0.34, 0.42, 0.14];
  const lichenCol = [1.1, 1.09, 1.0];
  const ht = g.boundingBox.max.y - lo;
  for (let i = 0; i < N; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), up = nr.getY(i);
    const patch = smoothstep(0.45, 0.7, noise(x * 0.9, y * 0.9, z * 0.9, ns + 16));
    let k = tone * (0.68 + 0.64 * fbm(x * 0.3, y * 0.3, z * 0.3, ns + 2, 3)) * wear(bend[i], patch);
    k *= 0.6 + 0.4 * smoothstep(0, Math.min(1.4, ht * 0.4), y);
    let c = tint.map((t) => t * k);
    // where iron has weathered out of it and run: rust-brown, in patches
    const rust = smoothstep(0.58, 0.74, noise(x * 0.32 + 5, y * 0.5, z * 0.32, ns + 21)) * R2(ns);
    c = [c[0] * (1 + 0.32 * rust), c[1] * (1 + 0.04 * rust), c[2] * (1 - 0.22 * rust)];
    const m = moss * smoothstep(0.25, 0.85, up)
      * smoothstep(0.4, 0.6, fbm(x * 0.45 + 3, y * 0.45, z * 0.45, ns + 7, 3) + 0.15 * smoothstep(0.05, 0.3, -bend[i]));
    const mk = 0.75 + 0.5 * noise(x * 1.7, y * 1.7, z * 1.7, ns + 8);
    c = c.map((v, j) => v + (mossCol[j] * mk - v) * m * 0.92);
    const l = lichen * smoothstep(0.62, 0.7, noise(x * 0.9 + 11, y * 0.9, z * 0.9, ns + 9)) * (1 - m) * smoothstep(-0.3, 0.3, up);
    c = c.map((v, j) => v + (lichenCol[j] * tone - v) * l * 0.3);
    col.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// For the garden's instanced stones: `n` shapes, each centred on the origin
// and the size of the one they replace (stoneGeo: 2 across, 1.24 high).
export function rockVariants(n, { seed = 6151, detail = 12, moss = 0.6 } = {}) {
  const r = makeRng(seed);
  const R = (lo, hi) => lo + (hi - lo) * r();
  return Array.from({ length: n }, () => {
    const g = gardenRock({
      w: 2, h: R(0.9, 1.5), d: 2 * R(0.65, 1), seed: Math.floor(r() * 1e9), round: R(0.4, 0.85), cuts: 2 + Math.floor(r() * 3),
      moss: moss * R(0.5, 1.2), lichen: R(0.3, 0.8), tone: R(0.85, 1.05), warm: R(-0.4, 0.8), detail,
    });
    g.computeBoundingBox();
    const b = g.boundingBox, c = new THREE.Vector3();
    b.getCenter(c);
    g.translate(-c.x, -c.y, -c.z);
    g.scale(2 / Math.max(b.max.x - b.min.x, b.max.z - b.min.z), 1.24 / (b.max.y - b.min.y), 2 / Math.max(b.max.x - b.min.x, b.max.z - b.min.z));
    g.computeVertexNormals();
    return g;
  });
}

// ── Where the bank and its stones lie ────────────────────────────────────────
// `edge`: the pond's outline, the very points its water is cut to (so the
// bank meets the water's own edge, chord for chord). `world`:
//   floorAt(x, z)  the ground there (lawn 4, gravel 5.2)
//   gravelAt(x, z) how much of it is gravel, 0..1
//   under(x, z)    the most the bank may rise there (under a bridge's deck,
//                  across the way onto it), or Infinity
//   clear(p, r)    whether a stone r across its middle may stand at p
//   near(p)        how near the nearest way's gravel comes to p (its edge)
// Returns the bank's arcs (geometries), its stones (geometries, in the world)
// and its pebbles (instances: p, rot, s, color, v).
export function pondShore({ edge, waterY, world, seed = 5813, light = false, bankVary = false, kerbVary = false }) {
  const rnd = makeRng(seed);
  // (`kerbVary`'s choices from a stream of their own: forkFix.js, 4)
  const kv = makeRng(seed + 77), KV = (lo, hi) => lo + (hi - lo) * kv();
  let kerbLeft = 2 + Math.floor(kv() * 3);
  const R = (lo, hi) => lo + (hi - lo) * rnd();
  const { floorAt, gravelAt, under, clear, near } = world;
  // the rim: each chord in six, so the bank's own edge lies on the water's
  const SUB = light ? 3 : 6;
  const rim = [];
  for (let k = 0; k < edge.length; k++) {
    const a = edge[k], b = edge[(k + 1) % edge.length];
    for (let j = 0; j < SUB; j++) rim.push([a[0] + ((b[0] - a[0]) * j) / SUB, a[1] + ((b[1] - a[1]) * j) / SUB]);
  }
  const M = rim.length;
  const cx = edge.reduce((s, q) => s + q[0], 0) / edge.length, cz = edge.reduce((s, q) => s + q[1], 0) / edge.length;
  const sAt = new Float64Array(M + 1);
  for (let i = 1; i <= M; i++) sAt[i] = sAt[i - 1] + Math.hypot(rim[i % M][0] - rim[i - 1][0], rim[i % M][1] - rim[i - 1][1]);
  const P = sAt[M];
  // out from the water, square to the rim (smoothed over its neighbours)
  const out = rim.map((q, i) => {
    const a = rim[(i + M - 2) % M], b = rim[(i + 2) % M];
    let n = [b[1] - a[1], -(b[0] - a[0])];
    const L = Math.hypot(...n) || 1;
    n = [n[0] / L, n[1] / L];
    if (n[0] * (q[0] - cx) + n[1] * (q[1] - cz) < 0) n = [-n[0], -n[1]];
    return n;
  });
  const along = rim.map((q, i) => [-out[i][1], out[i][0]]);
  // slow noise round the rim, closing on itself
  const ring = (s, scale, ns) => {
    const th = (s / P) * TAU, r = P / TAU / scale;
    return noise(Math.cos(th) * r + 50, Math.sin(th) * r + 50, ns * 0.37, ns);
  };
  // ── what each stretch of it is ──
  // a revetment of stones, grass to the water, or a beach of pebbles, in
  // runs; and a kerb of set stones wherever a way's gravel comes to the water
  const runs = [];
  {
    let s = R(0, 20);
    const order = ['rocks', 'grass', 'beach', 'rocks', 'beach', 'grass'];
    let k = Math.floor(rnd() * order.length);
    while (s < P + 1e-6) {
      const kind = order[k++ % order.length];
      const L = kind === 'rocks' ? R(18, 36) : kind === 'grass' ? R(14, 30) : R(18, 40);
      runs.push({ kind, s0: s, s1: Math.min(P, s + L) });
      s += L;
    }
  }
  const runAt = (s) => {
    const t = ((s % P) + P) % P;
    return runs.find((r) => t >= r.s0 && t < r.s1) ?? runs[runs.length - 1];
  };
  const kindAt = (i) => {
    const q = rim[i], o = out[i];
    if (near([q[0] + o[0] * 3, q[1] + o[1] * 3]) < 2.5) return 'kerb';
    return runAt(sAt[i]).kind;
  };
  const kinds = rim.map((_, i) => kindAt(i));
  // ── the bank's section, place by place ──
  const prof = rim.map((q, i) => {
    const s = sAt[i];
    return {
      // where it comes out of the water: in from the cut edge, by a little or a lot
      w0: -0.15 - 1.4 * smoothstep(0.35, 0.75, ring(s, 7, 3)) - 0.4 * ring(s, 2.2, 5),
      crest: waterY + 0.32 + 0.45 * ring(s, 9, 7) + 0.15 * ring(s, 2.5, 8),
      cOff: 0.9 + 1.6 * ring(s, 6, 9),
      reach: 7.5 + 6 * ring(s, 11, 10),
    };
  });
  // how far up from the water the bank's pebbled earth comes, and over how much it gives way
  const bankW = { beach: [4.2, 2.5], rocks: [2.0, 2.0], kerb: [2.6, 1.8], grass: [0.15, 0.9] };
  // inner section: offsets from w0 and heights over the water (under it, mostly)
  const IN_X = [-9, -5, -2.6, -1.2, -0.45, 0], IN_Y = [-2.3, -1.45, -0.75, -0.32, -0.1, 0.1];
  const bankY = (i, x, wx, wz) => {
    const q = prof[i];
    const t0 = x - q.w0;
    let y;
    if (t0 <= 0) {
      let j = 0;
      while (j < IN_X.length - 2 && t0 > IN_X[j + 1]) j++;
      const u = clamp((t0 - IN_X[j]) / (IN_X[j + 1] - IN_X[j]), 0, 1);
      y = waterY + IN_Y[j] + (IN_Y[j + 1] - IN_Y[j]) * u;
    } else {
      const F = floorAt(wx, wz), crest = Math.max(q.crest, F + 0.35);
      if (t0 <= q.cOff) y = waterY + 0.1 + (crest - waterY - 0.1) * Math.sin((t0 / q.cOff) * Math.PI / 2);
      else if (t0 <= q.reach) y = F + (crest - F) * 0.5 * (1 + Math.cos(Math.PI * (t0 - q.cOff) / (q.reach - q.cOff)));
      else y = F - 0.6 * Math.min(1, (t0 - q.reach) / 1.4);
    }
    return Math.min(y, under(wx, wz));
  };
  // the rim index and offset of a world point near it (nearest rim point)
  const placeOf = (i, x) => [rim[i][0] + out[i][0] * x, rim[i][1] + out[i][1] * x];

  // ── the bank itself, in arcs ──
  const COLS = (q) => [
    ...IN_X.map((x) => q.w0 + x),
    q.w0 + q.cOff * 0.35, q.w0 + q.cOff * 0.7, q.w0 + q.cOff,
    ...[0.15, 0.32, 0.5, 0.68, 0.85, 1].map((t) => q.w0 + q.cOff + (q.reach - q.cOff) * t),
    q.w0 + q.reach + 1.4,
  ];
  const NC = COLS(prof[0]).length;
  // the whole ring first, so its normals are smooth all the way round
  const pos = new Float32Array(M * NC * 3), uvs = new Float32Array(M * NC * 2), shs = new Float32Array(M * NC * 3);
  const outer = new Uint8Array(M * NC);
  for (let i = 0; i < M; i++) {
    const q = prof[i], [w1, fall0] = bankW[kinds[i]], cols = COLS(q);
    let bw = w1 * (0.75 + 0.5 * ring(sAt[i], 1.5, 12)), fall = fall0;
    // `bankVary` (forkFix.js, 7): the pebbles' reach up the bank slowly half
    // to half again as wide as its kind's, and here and there none at all —
    // grass or the dark wet earth down to the water — so it is not one even
    // pale band round the pond
    if (bankVary) {
      const wide = smoothstep(0.28, 0.72, ring(sAt[i], 9, 31)), gone = smoothstep(0.34, 0.5, ring(sAt[i], 20, 32));
      bw *= (0.3 + 1.3 * wide) * gone;
      fall *= 0.45 + 0.55 * gone;
    }
    cols.forEach((x, c) => {
      const [wx, wz] = placeOf(i, x), k = i * NC + c;
      pos.set([wx, bankY(i, x, wx, wz), wz], k * 3);
      uvs.set([wx, -wz], k * 2);
      const t0 = x - q.w0;
      const bank = t0 <= 0 ? 1 : 1 - smoothstep(bw, bw + fall, t0);
      const wet = 1 - smoothstep(0.25, 1.1 + 0.6 * ring(sAt[i], 0.8, 13), t0);
      shs.set([bank, gravelAt(wx, wz), wet], k * 3);
      outer[k] = t0 >= q.reach - 1e-6 ? 1 : 0;
    });
  }
  // wound to face up: the rim runs one way round or the other against `along`
  const d0 = [rim[1][0] - rim[0][0], rim[1][1] - rim[0][1]];
  const up = d0[0] * along[0][0] + d0[1] * along[0][1] > 0;
  const tri = (r0, r1, c, list) => {
    const a = r0 * NC + c, b = a + 1, d = r1 * NC + c, e = d + 1;
    if (up) list.push(a, d, b, b, d, e);
    else list.push(a, b, d, b, e, d);
  };
  const all = [];
  for (let i = 0; i < M; i++) for (let c = 0; c < NC - 1; c++) tri(i, (i + 1) % M, c, all);
  const whole = new THREE.BufferGeometry();
  whole.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  whole.setIndex(all);
  whole.computeVertexNormals();
  const nrm = whole.attributes.normal.array;
  // (facing up wherever it meets the floor, as the floor does, so the seam
  // where it goes under the lawn or the gravel takes the light as they do)
  for (let k = 0; k < outer.length; k++) if (outer[k]) nrm.set([0, 1, 0], k * 3);
  whole.dispose();
  // and cut into arcs, so each can be left undrawn when it is out of sight
  const ARC = light ? 40 : 60;
  const arcs = [];
  for (let a0 = 0; a0 < M; a0 += ARC) {
    const rows = Math.min(ARC, M - a0) + 1;
    const take = (src, size) => {
      const outA = new Float32Array(rows * NC * size);
      for (let r = 0; r < rows; r++) {
        const i = (a0 + r) % M;
        outA.set(src.subarray(i * NC * size, (i + 1) * NC * size), r * NC * size);
      }
      return outA;
    };
    const idx = [];
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < NC - 1; c++) tri(r, r + 1, c, idx);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(take(pos, 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(take(nrm, 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(take(uvs, 2), 2));
    g.setAttribute('aShore', new THREE.BufferAttribute(take(shs, 3), 3));
    g.setIndex(idx);
    arcs.push(g);
  }

  // ── its stones ──
  const stones = [], placed = [];
  const tryStone = (i, x, { L, D, show, round, cuts, moss, yaw = 0, tilt = 0.06, keep = 0.8, tone = R(0.8, 1.05) }) => {
    const p = placeOf(i, x), r = Math.max(L, D) / 2;
    if (!clear(p, r * keep, D / 2)) return false;
    if (placed.some((o) => Math.hypot(o.p[0] - p[0], o.p[1] - p[1]) < (o.r + r) * 0.62)) return false;
    // bedded: its foot under the bank all round, `show` of it over the bank
    const t = along[i], o = out[i];
    const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 0]].map(([a, b]) => {
      const w = [p[0] + t[0] * a * L * 0.42 + o[0] * b * D * 0.42, p[1] + t[1] * a * L * 0.42 + o[1] * b * D * 0.42];
      const xi = x + b * D * 0.42;
      return bankY(i, xi, w[0], w[1]);
    });
    const mid = corners[4];
    const y0 = Math.min(...corners) - 0.3 - Math.abs(tilt) * Math.max(L, D) * 0.5;
    const top = Math.max(mid + show, waterY + 0.45);
    const h = top - y0;
    if (h < 0.4) return false;
    const g = gardenRock({
      w: L, h, d: D, seed: Math.floor(rnd() * 1e9), round, cuts, moss, lichen: R(0.3, 0.9), tone, warm: R(-0.3, 0.9), detail: light ? 9 : Math.max(L, D) > 5 ? 14 : 9,
    });
    g.rotateX(R(-1, 1) * tilt);
    g.rotateZ(R(-1, 1) * tilt);
    g.rotateY(Math.atan2(-t[1], t[0]) + yaw);
    g.translate(p[0], y0, p[1]);
    stones.push(g);
    placed.push({ p, r });
    return true;
  };
  const step = (i, ds) => {
    // the rim index ds further round
    const target = sAt[i] + ds;
    let j = i;
    const fwd = ds >= 0;
    for (let n = 0; n < M; n++) {
      const nj = (j + (fwd ? 1 : M - 1)) % M;
      const sj = sAt[nj] + (fwd ? (nj < i ? P : 0) : (nj > i ? -P : 0));
      if (fwd ? sj > target : sj < target) break;
      j = nj;
    }
    return j;
  };
  const indexAt = (s) => {
    const t = ((s % P) + P) % P;
    let lo = 0, hi = M - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (sAt[m] <= t) lo = m; else hi = m - 1; }
    return lo;
  };
  const pebbles = [];
  const pebble = (i, x, r) => {
    const [wx, wz] = placeOf(i, x);
    if (under(wx, wz) < 9 || gravelAt(wx, wz) > 0.4) return;
    const y = bankY(i, x, wx, wz);
    const l = R(0.55, 1.05), warm = R(-0.5, 1);
    pebbles.push({
      p: [wx, y + r * R(0.05, 0.25), wz], rot: [R(-0.2, 0.2), R(0, TAU), R(-0.2, 0.2)], s: [r, r * R(0.5, 0.8), r * R(0.65, 1)],
      color: `#${new THREE.Color(l * (1 + 0.05 * warm), l, l * (1 - 0.07 * warm)).getHexString()}`, v: Math.floor(rnd() * 4),
    });
  };
  let s = 0;
  while (s < P) {
    const i = indexAt(s), kind = kinds[i];
    if (kind === 'rocks') {
      // a stone and its companions: one broad and low (and now and then one
      // standing taller), a smaller to either side, one of them out in the water
      const tall = rnd() < 0.16, big = !tall && rnd() < 0.15;
      const L = tall ? R(4, 6.5) : big ? R(9.5, 13) : R(4.5, 9), D = tall ? R(3.5, 5.5) : R(3.6, 6.4) * (big ? 1.3 : 1);
      const show = tall ? R(3.4, 5.4) : big ? R(2.6, 4) : R(1.2, 3);
      const x = R(-0.6, 1.4);
      if (tryStone(i, x, { L, D, show, round: R(0.2, 0.5), cuts: 3 + Math.floor(rnd() * 3), moss: R(0.5, 0.95), yaw: R(-0.35, 0.35) })) {
        for (let c = 0, n = 1 + Math.floor(rnd() * 3); c < n; c++) {
          const k = R(0.28, 0.62), side = rnd() < 0.5 ? -1 : 1;
          const j = step(i, side * (L / 2 + (L * k) / 2 - R(0.4, 1.2)));
          tryStone(j, x + R(-1.6, 2.4), { L: L * k, D: D * k * R(0.8, 1.2), show: show * R(0.4, 0.8), round: R(0.25, 0.6), cuts: 3 + Math.floor(rnd() * 2), moss: R(0.4, 0.9), yaw: R(-0.8, 0.8) });
        }
        for (let n = 0; n < 4; n++) pebble(step(i, R(-L, L)), R(-0.8, 2), R(0.28, 0.65));
        s += L + R(2, 9);
      } else s += 1.5;
    } else if (kind === 'kerb') {
      // set shoulder to shoulder between the gravel and the water
      // (river boulders, worn round: cut square they stood along the way like
      // a row of dark bricks)
      const big = rnd() < 0.22, low = !big && rnd() < 0.3;
      let L = R(2.6, 6) * (big ? 1.5 : 1), D = R(2.4, 4) * (big ? 1.25 : 1), show = (low ? R(0.6, 1.1) : R(0.9, 1.9)) * (big ? 1.4 : 1);
      // `kerbVary`: not one of a size every pace like beads on a string — a
      // few to three times the size of the rest, small ones between, some
      // sunk to half their height, and a gap now and then after a few
      if (kerbVary) {
        const k = kv() < 0.25 ? KV(1.4, 1.9) : kv() < 0.45 ? KV(0.45, 0.65) : KV(0.8, 1.1);
        L *= k;
        D *= Math.sqrt(k);
        show *= (kv() < 0.3 ? 0.45 : 1) * Math.sqrt(k);
      }
      if (tryStone(i, R(-0.5, 1), { L, D, show, round: R(0.55, 0.9), cuts: 1 + Math.floor(rnd() * 2), moss: R(0.3, 0.7), yaw: R(-0.35, 0.35), keep: 0.55 })) {
        // and a small one wedged into the joint, now and then
        if (rnd() < 0.45) tryStone(step(i, L / 2 + R(0.2, 0.8)), R(-1.2, 0.4), { L: R(1.2, 2.2), D: R(1, 1.8), show: R(0.4, 0.9), round: R(0.3, 0.7), cuts: 2, moss: R(0.2, 0.6), yaw: R(-1, 1), keep: 0.4 });
        for (let n = 0; n < 2; n++) pebble(step(i, L / 2 + R(-0.4, 0.6)), R(-0.6, 1.5), R(0.25, 0.55));
        s += L + R(-0.2, 1.4);
        if (kerbVary && --kerbLeft <= 0) {
          // the gap: the gravel's edge with only a pebble or two in it
          const gap = KV(3, 10);
          for (let n = 0, m = Math.floor(gap / 3); n < m; n++) pebble(step(i, KV(0, gap)), KV(-0.6, 1.2), KV(0.25, 0.6));
          s += gap;
          kerbLeft = 2 + Math.floor(kv() * 3);
        }
      } else s += 1;
    } else if (kind === 'beach') {
      // (in the round at the water, where they break its edge; up the beach
      // the bank's own painted pebbles carry it — 4000 of them in the round
      // were a million and a half triangles)
      for (let n = 0; n < 2; n++) {
        const x = -1.1 + (bankW.beach[0] + 1.4) * rnd() ** 2.8;
        pebble(i, x, R(0.28, 0.78) * (1 - 0.35 * clamp(x / bankW.beach[0], 0, 1)));
      }
      if (rnd() < 0.05) tryStone(i, R(-0.6, 2), { L: R(1.8, 3.6), D: R(1.5, 3), show: R(0.5, 1.1), round: R(0.5, 0.9), cuts: 2, moss: R(0.2, 0.6), yaw: R(-1, 1) });
      s += light ? 0.9 : 0.6;
    } else {
      if (rnd() < 0.06) tryStone(i, R(-0.4, 2.2), { L: R(2.5, 5), D: R(2, 4), show: R(0.6, 1.4), round: R(0.45, 0.85), cuts: 2 + Math.floor(rnd() * 2), moss: R(0.6, 1), yaw: R(-1, 1) });
      if (rnd() < 0.12) pebble(i, R(-0.6, 0.8), R(0.2, 0.45));
      s += 1;
    }
  }
  return { arcs, stones, pebbles, bankY: (p) => {
    // the bank's height at a world point near the rim (nearest rim point's section)
    let best = 0, bd = Infinity;
    for (let i = 0; i < M; i++) { const d = (rim[i][0] - p[0]) ** 2 + (rim[i][1] - p[1]) ** 2; if (d < bd) { bd = d; best = i; } }
    const x = (p[0] - rim[best][0]) * out[best][0] + (p[1] - rim[best][1]) * out[best][1];
    return bankY(best, x, p[0], p[1]);
  } };
}

// ── The bridge's foot ────────────────────────────────────────────────────────
// In the frame of its first run: `a` where the run starts, `t` along it, `n`
// across it. A pier of granite under the deck's end — two courses, the lower
// broken into three blocks, the upper two long stones laid across, their
// joints off the ones below, from under the bank to `pierTop` — and in front
// of it the stone stepped up onto from the gravel: one broad slab, its top
// flat at `stepTop` and worn a little where feet go, over at least the
// rectangle the walk uses (u0..u1 along, ±half across). Each comes back in the
// world.
export function bridgeFoot({ a, t, n, half, pier: [p0, p1], pierTop, step: { u0, u1, half: sh, top: stepTop }, floor, seed = 7331, light = false }) {
  const rnd = makeRng(seed);
  const R = (lo, hi) => lo + (hi - lo) * rnd();
  const at = (u, v) => [a[0] + t[0] * u + n[0] * v, a[1] + t[1] * u + n[1] * v];
  const yaw = Math.atan2(-t[1], t[0]);
  const set = (g, u, v, y) => {
    g.computeBoundingBox();
    const b = g.boundingBox;
    g.translate(-(b.min.x + b.max.x) / 2, 0, -(b.min.z + b.max.z) / 2);
    g.rotateY(yaw);
    const w = at(u, v);
    g.translate(w[0], y, w[1]);
    return g;
  };
  const blocks = [];
  const J = 0.12;   // the joints, open
  const block = (u, v, L, W, y0, y1, k) => {
    const g = gardenRock({
      w: L - J, h: y1 - y0, d: W - J, seed: Math.floor(rnd() * 1e9), round: R(0.12, 0.22), cuts: 0, dressed: true,
      moss: R(0.25, 0.55), lichen: R(0.4, 0.9), tone: R(0.86, 1.0) * k, warm: R(-0.2, 0.6), detail: light ? 10 : 18,
    });
    g.computeBoundingBox();
    // (the rough it was given may have lifted its bed: sit it on y0, top at y1)
    const sy = (y1 - y0) / (g.boundingBox.max.y - g.boundingBox.min.y);
    g.scale(1, sy, 1);
    blocks.push(set(g, u, v, y0));
  };
  const len = p1 - p0, mid = (p0 + p1) / 2, W = half * 2;
  const course = (floor + pierTop) / 2 - 0.2;
  // lower course: three across
  const cuts = [-half, -half + W * R(0.3, 0.38), half - W * R(0.3, 0.38), half];
  for (let k = 0; k < 3; k++) block(mid, (cuts[k] + cuts[k + 1]) / 2, len, cuts[k + 1] - cuts[k], floor - 1.5, course, 0.92);
  // upper course: two long stones, the joint between them off both below
  const j = R(-0.12, 0.12) * W;
  block(mid + 0.15, (-half + j) / 2, len + 0.3, half + j, course, pierTop, 1);
  block(mid + 0.15, (half + j) / 2, len + 0.3, half - j, course, pierTop, 1);
  // the step: a broad stone, worn round, its sides cleft, its top flat
  // (no further toward the deck than the old step went: the deck's end beam
  // comes down to 6.7 just past it)
  const SL = (u1 - u0) + 0.8, SW = sh * 2 + 1.4, depth = stepTop - (floor - 0.8);
  const g = gardenRock({
    w: SL, h: depth, d: SW, seed: Math.floor(rnd() * 1e9), round: 0.3, cuts: 5, dressed: true, flatTop: true,
    moss: 0.12, lichen: 0.35, tone: R(0.95, 1.05), warm: 0.35, detail: light ? 12 : 22,
  });
  g.computeBoundingBox();
  g.scale(1, depth / (g.boundingBox.max.y - g.boundingBox.min.y), 1);
  const stepGeo = set(g, (u0 + u1) / 2 - 0.2, 0, floor - 0.8);
  return { blocks, step: stepGeo };
}

// The stones that stand guard at a bridge's foot (hashibasami-ishi): one to
// either side of the step, upright and taller than anything else at the
// water's edge, a low one at its foot — where the ground there is free
// (`clear`, as pondShore's). `ground(p)`: the bank's or the floor's height.
export function guardStones({ a, t, n, stepHalf, stepU, ground, clear, seed = 9241, light = false }) {
  const rnd = makeRng(seed);
  const R = (lo, hi) => lo + (hi - lo) * rnd();
  const at = (u, v) => [a[0] + t[0] * u + n[0] * v, a[1] + t[1] * u + n[1] * v];
  const out = [];
  const stand = (p, L, D, show, yaw, round, k) => {
    const y = ground(p);
    const g = gardenRock({
      w: L, h: show + 1.2, d: D, seed: Math.floor(rnd() * 1e9), round, cuts: 3 + Math.floor(rnd() * 2),
      moss: R(0.45, 0.8), lichen: R(0.5, 0.9), tone: R(0.9, 1.05) * k, warm: R(0, 0.7), detail: light ? 10 : 18,
    });
    g.rotateY(Math.atan2(-t[1], t[0]) + yaw);
    g.translate(p[0], y - 1.2, p[1]);
    out.push(g);
  };
  for (const side of [-1, 1]) {
    const L = R(3, 4.2), D = R(2.6, 3.4), u = stepU + R(-0.6, 0.6), v = side * (stepHalf + 0.9 + D / 2 + R(0, 0.6));
    const p = at(u, v);
    if (!clear(p, Math.max(L, D) / 2, D / 2)) continue;
    stand(p, L, D, R(3.4, 4.6), R(-0.25, 0.25), R(0.3, 0.55), 1);
    // and a low one beside it, toward the water
    const q = at(u + L / 2 + R(0.6, 1.4), v + side * R(0.2, 1.2));
    if (clear(q, 1.4, 1.2)) stand(q, R(2, 2.8), R(1.8, 2.5), R(0.8, 1.4), R(-1, 1), R(0.45, 0.8), 0.95);
  }
  return out;
}

// ── Materials ────────────────────────────────────────────────────────────────
// The stones' grain from three sides at once in the world's units (they are
// turned every way, and no one projection could lay it on them all), and wet
// from the water up: dark and glossy under a line the ripples keep moving, a
// hand's breadth over the still water, and green-brown below it. Only round
// the pond (`pond`: c, rx, rz and its wobble, as buildWorld cuts the water)
// — a stone on the lawn stands lower than the water does. Instanced or not.
// `lite`: the pebbles — one look at the grain, from above, and no relief of
// its own (they are a few centimetres across, and there are a thousand).
export function shoreRockLit(mat, { waterY, pond, tile = ROCK_TILE, lite = false }) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uShoreWater = { value: waterY };
    sh.uniforms.uShorePond = { value: new THREE.Vector4(pond.c[0], pond.c[1], pond.rx, pond.rz) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vShW;
        varying vec3 vShN;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        {
          vec3 shn = objectNormal;
          #ifdef USE_INSTANCING
            shn = mat3(instanceMatrix) * shn;
          #endif
          vShN = normalize(mat3(modelMatrix) * shn);
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 shw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            shw = instanceMatrix * shw;
          #endif
          vShW = (modelMatrix * shw).xyz;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uShoreWater;
        uniform vec4 uShorePond;
        varying vec3 vShW;
        varying vec3 vShN;
        float shWet;`)
      .replace('#include <map_fragment>', `
        vec3 shN = normalize(vShN);
        vec3 shB = pow(abs(shN), vec3(4.0));
        shB /= shB.x + shB.y + shB.z;
        vec3 shP = vShW * ${(1 / tile).toFixed(5)};
        ${lite ? 'vec4 shC = texture2D(map, shP.xz + shP.y * 0.37);' : 'vec4 shC = texture2D(map, shP.zy) * shB.x + texture2D(map, shP.xz) * shB.y + texture2D(map, shP.xy) * shB.z;'}
        diffuseColor *= shC;
        // how far out of the pond's outline, in units (its wobble as buildWorld cuts it)
        vec2 shE = (vShW.xz - uShorePond.xy) / uShorePond.zw;
        float shA = atan(shE.y, shE.x);
        float shOut = (length(shE) / (1.0 + sin(shA * 3.0 + 1.0) * 0.04 + sin(shA * 7.0) * 0.02) - 1.0) * 0.5 * (uShorePond.z + uShorePond.w);
        // (only stone at the water's edge: the step onto the bridge stands a
        // hand over the water too, but on the gravel, and is dry)
        float shNear = 1.0 - smoothstep(0.8, 2.6, shOut);
        float shLine = uShoreWater + 0.26 + 0.1 * sin(vShW.x * 0.83 + vShW.z * 0.61) + 0.07 * sin(vShW.z * 2.3 - vShW.x * 1.7);
        shWet = shNear * (1.0 - smoothstep(shLine - 0.3, shLine + 0.08, vShW.y));
        float shUnder = shNear * (1.0 - smoothstep(uShoreWater - 0.5, uShoreWater + 0.02, vShW.y));
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.42, 0.4, 0.37), shWet);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.64, 0.4), shUnder);`)
      // (the relief and the roughness in one look per side: the roughness is
      // the normal map's alpha, see withAlpha)
      .replace('#include <normal_fragment_maps>', lite ? `
        normal = normalize((viewMatrix * vec4(shN, 0.0)).xyz);
        float shRough = 0.85;` : `
        vec4 shTx = texture2D(normalMap, shP.zy);
        vec4 shTy = texture2D(normalMap, shP.xz);
        vec4 shTz = texture2D(normalMap, shP.xy);
        float shRough = shTx.a * shB.x + shTy.a * shB.y + shTz.a * shB.z;
        shTx.xyz = shTx.xyz * 2.0 - 1.0;
        shTy.xyz = shTy.xyz * 2.0 - 1.0;
        shTz.xyz = shTz.xyz * 2.0 - 1.0;
        vec3 shWN = normalize(shN + (vec3(0.0, shTx.y, shTx.x) * shB.x + vec3(shTy.x, 0.0, shTy.y) * shB.y + vec3(shTz.x, shTz.y, 0.0) * shB.z) * normalScale.x);
        normal = normalize((viewMatrix * vec4(shWN, 0.0)).xyz);`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;`)
      .replace('#include <lights_physical_fragment>', `
        roughnessFactor = mix(roughness * shRough, 0.45, shWet);
        #include <lights_physical_fragment>`);
  };
  mat.customProgramCacheKey = () => (lite ? 'babel-shore-rock-lite' : 'babel-shore-rock');
  return mat;
}

// The bank: the lawn's own grass and the ways' own gravel where it meets them
// (the same maps, laid as they lay them — u along x, v along -z — and their
// colours), the pebbled earth of shoreBank toward the water, and wet and dark
// at it. `aShore`: how much is bank, how much of the floor is gravel, how wet.
export function bankLit(mat, { grass, gravel, grassColor, gravelColor, grassRepeat, gravelRepeat }) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBkGrass = { value: grass };
    sh.uniforms.uBkGravel = { value: gravel };
    sh.uniforms.uBkGrassCol = { value: new THREE.Color(grassColor) };
    sh.uniforms.uBkGravelCol = { value: new THREE.Color(gravelColor) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aShore;
        varying vec3 vShore;
        varying vec3 vBkW;
        varying vec3 vBkN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vShore = aShore;
        vBkW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vBkN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uBkGrass;
        uniform sampler2D uBkGravel;
        uniform vec3 uBkGrassCol;
        uniform vec3 uBkGravelCol;
        varying vec3 vShore;
        varying vec3 vBkW;
        varying vec3 vBkN;`)
      // (each map read only where it shows — the lawn and the gravel off the
      // pebbles, the pebbles off the lawn — with the gradients taken first, so
      // a read inside a branch still picks its mip as the floor's does)
      .replace('#include <map_fragment>', `
        vec2 bkXZ = vec2(vBkW.x, -vBkW.z);
        vec2 bkUv = bkXZ * ${(1 / BANK_TILE).toFixed(5)};
        vec2 bkGU = bkXZ * ${grassRepeat.toFixed(6)}, bkVU = bkXZ * ${gravelRepeat.toFixed(6)};
        vec2 bkBx = dFdx(bkUv), bkBy = dFdy(bkUv), bkGx = dFdx(bkGU), bkGy = dFdy(bkGU), bkVx = dFdx(bkVU), bkVy = dFdy(bkVU);
        vec3 bkGround = vec3(0.0);
        if (vShore.x < 0.999) {
          bkGround = textureGrad(uBkGrass, bkGU, bkGx, bkGy).rgb * uBkGrassCol;
          if (vShore.y > 0.001) bkGround = mix(bkGround, textureGrad(uBkGravel, bkVU, bkVx, bkVy).rgb * uBkGravelCol, vShore.y);
        }
        vec3 bkBank = vec3(0.0);
        vec4 bkT = vec4(0.5, 0.5, 1.0, 1.0);
        if (vShore.x > 0.001) {
          bkBank = textureGrad(map, bkUv, bkBx, bkBy).rgb * diffuse;
          bkT = textureGrad(normalMap, bkUv, bkBx, bkBy);
        }
        diffuseColor.rgb = mix(bkGround, bkBank, vShore.x);
        diffuseColor.rgb *= mix(1.0, 0.45, vShore.z);`)
      // (its roughness is the normal map's alpha, see withAlpha)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = mix(1.0, bkT.a, vShore.x);
        // (damp, not glazed: at 0.32 every pebble's crown caught the sky at a
        // grazing look and the far shore glittered white like frost)
        roughnessFactor = mix(roughnessFactor, 0.6, vShore.z);`)
      .replace('#include <normal_fragment_maps>', `
        vec3 bkWN = normalize(normalize(vBkN) + vec3(bkT.x * 2.0 - 1.0, 0.0, 1.0 - bkT.y * 2.0) * normalScale.x * vShore.x);
        normal = normalize((viewMatrix * vec4(bkWN, 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'babel-shore-bank';
  return mat;
}
