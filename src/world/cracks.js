// ── Cracks in the Door's pavement ────────────────────────────────────────────
// 2026-10-07 the reader: "make sure that the lines on the floor appear as real
// cracks". They were strips laid on the pavement: a dark groove three to ten
// centimetres wide with a pale lip beside it, run straight for a metre or two
// and turned, green knobs of moss along them, and every one of them crossing
// the joints of the floor as if the joints were not there. Lines drawn over a
// floor, not breaks in it.
//
// A break is in the stone, so this is painted into the floor (buildWorld's
// paveShade reads it), and from the floor as it is laid (textures.js,
// `pavingLayout`): every crack knows which slab it is running through.
//   - A crack is jagged at every scale: a run of a centimetre or so, then a turn,
//     its heading wandering over the metre. Its gape opens and closes as it goes
//     and it thins out to nothing at its end, putting out narrower branches.
//   - A joint stops it, or it goes on in the next slab from somewhere else
//     along the joint: each slab breaks on its own.
//   - Its arrises are broken down into it, and here and there a flake has
//     come away from one side, leaving a shallow scar of paler, fresher stone.
//   - Where a crack runs right across a slab the slab is in pieces, and the
//     pieces have settled — sunk as much as a centimetre, tilted a little — so the
//     lamp catches a step at the crack and the pieces take its sheen
//     differently. Most where the wall came down and under the blocks that fell
//     from it, where the cracks spread from.
//
// One map, linear: red and green the slope of the relief, x and z of the world
// (as the floor's own normal map has it: see `normalsFromField`), stored as a
// square root so a piece's gentle tilt survives eight bits; blue its tone, from
// the black of the open crack (0) through the floor as it is (128) to fresh
// stone (255). Off the cracks it is 128 throughout, and the floor is untouched.
import { makeRng, pavingLayout, toTexture } from './textures';

// the steepest slope the map holds (a crack's wall)
export const CRACK_SLOPE = 4;

const canvas = (w, h) => {
  const c = typeof document === 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
};

// The canvas's size, from the frame it is painted in (paintJobs.js says it
// before a pixel is painted).
export const crackSize = ({ a0, a1, b0, b1, ppu }) => ({ w: Math.round((a1 - a0) * ppu), h: Math.round((b1 - b0) * ppu) });

// `origin`: where along and into are both 0 (world x, z); `along`, `into`: the
// frame's axes (unit, world x z). The canvas runs a0..a1 along and b0..b1 into,
// at `ppu` pixels a unit; its rows run into the room. `breach`: [a0, a1, b0, b1],
// where the wall came down; `blocks`: [along, into, size] of each block that fell.
// `rest`: what lies on the floor (rubble.js) — [along, into, half length, half
// width, turn, how dark, round] — for the shade at its foot and the grit round it.
// The pavement is the floor's: `tile` units to its canvas of `paveSize` pixels.
export function crackFields({
  origin, along, into, a0, a1, b0, b1, ppu = 16,
  breach = [-9, 12, 1.5, 6], blocks = [], rest = [],
  tile = 32, paveSize = 1024, paveSeed = 19, courses = 4, seed = 4242,
}) {
  const { w: W, h: H } = crackSize({ a0, a1, b0, b1, ppu });
  const N = W * H;
  const rnd = makeRng(seed);
  const R = (lo, hi) => lo + (hi - lo) * rnd();
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.41;

  // ── the pavement under each pixel: which slab, and how far to its joint
  const rows = pavingLayout({ size: paveSize, seed: paveSeed, courses });
  const kp = paveSize / tile;
  let paveKey = 0, paveD = 0, paveCourse = false;
  const pave = (a, b) => {
    const x = origin[0] + along[0] * a + into[0] * b, z = origin[1] + along[1] * a + into[1] * b;
    // (a texture runs up its canvas: the canvas's row j is z's tile turned over)
    const v = z / tile, ty = Math.floor(v), j = (1 - (v - ty)) * paveSize;
    let r = 0;
    while (r + 1 < courses && rows[r + 1].y <= j) r++;
    const row = rows[r], J = row.joints, U = x * kp - row.x0, sx = Math.floor(U / paveSize), xr = U - sx * paveSize;
    let s = 0;
    while (s + 1 < row.lens.length && J[s + 1] <= xr) s++;
    const dc = Math.min(j - row.y, row.y + row.h - j), dx = Math.min(xr - J[s], J[s + 1] - xr);
    paveKey = ((sx + 512) * 1024 + (ty + 512)) * 64 + r * 16 + s;
    paveD = Math.min(dc, dx) / kp;
    paveCourse = dc < dx;   // the nearest joint is a course's, which runs along x
  };
  const JOINT = 0.055;   // half a joint's width, units
  const key = new Int32Array(N), joint = new Uint8Array(N);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      pave(a0 + (i + 0.5) / ppu, b0 + (j + 0.5) / ppu);
      key[j * W + i] = paveKey;
      joint[j * W + i] = paveD < JOINT ? 1 : 0;
    }
  }

  // How hard the floor was hit here: most at the breach, and round each block
  // that came down, by its size.
  const blow = (a, b) => {
    let k = Math.exp(-Math.max(0, b - 4) / 24) * Math.exp(-Math.max(0, Math.abs(a - 1.5) - 16) / 14);
    for (const [ba, bb, size] of blocks) k = Math.max(k, Math.exp(-Math.max(0, Math.hypot(a - ba, b - bb) - size * 0.3) / (size * 0.75)));
    return k;
  };

  // ── fields
  const cover = new Float32Array(N);   // how much of a pixel is open crack
  const core = new Float32Array(N);    // how far from its walls, out to its middle
  const relief = new Float32Array(N);  // how far below the slab's face, units
  const dirt = new Float32Array(N);    // what the crack's edges have taken in
  const pale = new Float32Array(N);    // fresh stone, where a flake came away
  const cut = new Uint8Array(N);       // a crack right through: one piece from the next
  const who = new Int32Array(N);       // which crack opened it
  const inside = (a, b, m) => a > a0 + m && a < a1 - m && b > b0 + m && b < b1 - m;

  // a step of a crack: the gape itself, the arris broken down into it, the dirt
  const lay = (a, b, hw, gen, k, id) => {
    const cx = (a - a0) * ppu - 0.5, cy = (b - b0) * ppu - 0.5, hp = hw * ppu;
    const rim = 0.9 + Math.min(1.8, hp * 0.6), reach = hp + rim + 0.2 * ppu;
    const edge = (0.01 + 0.03 * Math.min(1, hp / 2)) * (0.6 + 0.4 * k), deep = edge + 0.03 * Math.min(1, hp + 0.2);
    const i0 = Math.max(0, Math.floor(cx - reach)), i1 = Math.min(W - 1, Math.ceil(cx + reach));
    const j0 = Math.max(0, Math.floor(cy - reach)), j1 = Math.min(H - 1, Math.ceil(cy + reach));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const q = j * W + i;
        if (joint[q]) continue;
        const d = Math.hypot(i - cx, j - cy), e = d - hp;
        if (e > reach - hp) continue;
        const cov = Math.max(0, Math.min(d + hp, 0.5) - Math.max(d - hp, -0.5));
        if (cov > cover[q]) cover[q] = cov;
        const mid = hp > 0.8 ? Math.max(0, 1 - d / hp) : 1;
        if (cov > 0 && mid > core[q]) core[q] = mid;
        if (cov > 0.3 && !who[q]) who[q] = id;
        const r = e < 0 ? -deep : e < rim ? -edge * (1 - e / rim) ** 2 : 0;
        if (r < relief[q]) relief[q] = r;
        const dt = Math.exp(-Math.max(0, e) / (0.07 * ppu)) * (0.25 + 0.35 * Math.min(1, hp / 2));
        if (dt > dirt[q]) dirt[q] = dt;
        if (gen < 2 && d <= Math.max(hp, 0.95)) cut[q] = 1;
      }
    }
  };

  // ── the cracks
  const paths = [];
  const queue = [];
  const step = 0.4 / ppu;
  const run = ({ a, b, dir, len, w, gen, curl = 0, parent = 0, stop = [0.04, 0.35, 0.65][gen] }) => {
    const id = paths.length + 1;
    let base = dir, segDir = dir, seg = 0, s = 0;
    pave(a, b);
    let slab = paveKey;
    const path = { pts: [], gen };
    // the gape, opening and closing as it goes (value noise along its length)
    const knots = Array.from({ length: Math.ceil(len / 0.9) + 2 }, () => 0.45 + rnd() * 1.1);
    const gape = (t) => { const f = t / 0.9, i = Math.floor(f), u = f - i, sm = u * u * (3 - 2 * u); return knots[i] + (knots[i + 1] - knots[i]) * sm; };
    while (s < len) {
      if (seg <= 0) {
        // a new run: short, at its own angle off the crack's heading, which wanders
        seg = 0.05 + (-Math.log(1 - rnd() * 0.98)) * 0.22;
        base += gauss() * 0.09 + (dir - base) * 0.12;
        segDir = base + gauss() * 0.42;
      }
      a += Math.cos(segDir) * step;
      b += Math.sin(segDir) * step;
      s += step;
      seg -= step;
      // (an arc's heading comes round with it)
      if (curl) { dir += curl * step; base += curl * step; segDir += curl * step; }
      if (!inside(a, b, 4 / ppu)) break;
      pave(a, b);
      if (paveD < JOINT) continue;
      if (paveKey !== slab) {
        // Across a joint, into another slab: it stops there, or it takes up
        // again in this one from somewhere else along the joint.
        if (rnd() < stop + 0.3 * (s / len) ** 2) break;
        const tw = paveCourse ? [1, 0] : [0, 1];
        const ta = tw[0] * along[0] + tw[1] * along[1], tb = tw[0] * into[0] + tw[1] * into[1];
        const shift = (rnd() < 0.5 ? -1 : 1) * R(0.04, 0.7);
        const was = paveKey;
        pave(a + ta * shift, b + tb * shift);
        if (paveKey === was && paveD >= JOINT) { a += ta * shift; b += tb * shift; }
        pave(a, b);
        slab = paveKey;
        base += gauss() * 0.22;
        seg = 0;
      }
      const t = s / len;
      const k = blow(a, b);
      const hw = 0.5 * w * gape(s) * Math.min(1, ((1 - t) / 0.3) ** 0.8) * (0.7 + 0.3 * k);
      // Run into another crack and it ends there: the stone is already broken
      // (cracks meet in a T, and never cross).
      const ci = Math.floor((a - a0) * ppu), cj = Math.floor((b - b0) * ppu), met = who[cj * W + ci];
      const ended = met && met !== id && met !== parent && s > 1.5 && rnd() < 0.9;
      lay(a, b, hw, gen, k, id);
      if (ended) break;
      path.pts.push(a, b, hw, segDir);
      // a branch, narrower, running off at an angle and not as far
      if (gen < 2 && t < 0.8 && rnd() < [0.07, 0.035][gen] * step) {
        queue.push({ a, b, dir: base + (rnd() < 0.5 ? -1 : 1) * R(0.35, 0.95), len: Math.min(len - s, R(3, 14)) * R(0.4, 1), w: w * R(0.45, 0.7), gen: gen + 1, parent: id });
      }
    }
    paths.push(path);
  };

  // Spreading from the breach, into the room: fanned out from along it, each
  // turned away from the middle as much as it starts from it, so that they part.
  const [ba0, ba1, bb0, bb1] = breach;
  for (let c = 0, n = 7; c < n; c++) {
    const f = (c + 0.5) / n, spread = (f - 0.5) * 1.5 + gauss() * 0.1;
    queue.push({ a: ba1 - f * (ba1 - ba0) + R(-1, 1), b: R(bb0, bb1), dir: Math.PI / 2 + spread, len: R(70, 130), w: R(0.36, 0.48), gen: 0 });
  }
  // Under each block that fell: the slab it struck burst, cracks out from under
  // it all round and an arc or two of them farther out.
  for (const [ba, bb, size] of blocks) {
    const n = 3 + Math.floor(rnd() * 3), a0r = rnd() * Math.PI * 2;
    for (let c = 0; c < n; c++) {
      const ang = a0r + (c / n) * Math.PI * 2 + R(-0.5, 0.5), r0 = size * R(0.1, 0.3);
      queue.push({ a: ba + Math.cos(ang) * r0, b: bb + Math.sin(ang) * r0, dir: ang + gauss() * 0.15, len: size * R(0.5, 2.2), w: R(0.22, 0.36), gen: 0, stop: 0.3 });
    }
    for (let c = 0, arcs = 1 + Math.floor(rnd() * 2); c < arcs; c++) {
      const ang = rnd() * Math.PI * 2, r = size * R(0.55, 0.85), side = rnd() < 0.5 ? -1 : 1;
      queue.push({ a: ba + Math.cos(ang) * r, b: bb + Math.sin(ang) * r, dir: ang + side * Math.PI / 2, len: r * R(0.8, 1.6), w: R(0.12, 0.18), gen: 1, curl: side / r });
    }
  }
  // and the hairlines that the shock left in the slabs round about
  for (let c = 0; c < 26; c++) {
    const a = R(a0 + 6, a1 - 6), b = R(2, b1 - 6);
    if (rnd() > blow(a, b) * 1.6 + 0.25) continue;
    queue.push({ a, b, dir: rnd() * Math.PI * 2, len: R(2, 9), w: R(0.05, 0.08), gen: 2 });
  }
  while (queue.length) run(queue.shift());

  // ── flakes off the arris, along the cracks: a shallow scar on one side,
  // deepest at the crack, paler
  for (const { pts, gen } of paths) {
    let next = -Math.log(1 - rnd()) * 1.3;
    for (let p = 0, since = 0; p + 4 <= pts.length; p += 4) {
      since += step;
      if (since < next) continue;
      since = 0;
      const [a, b, hw, dir] = pts.slice(p, p + 4);
      const k = blow(a, b);
      next = -Math.log(1 - rnd()) * (gen ? 2.2 : 1.1) / (0.35 + k);
      if (hw * ppu < 0.25) continue;
      const side = rnd() < 0.5 ? -1 : 1, ta = Math.cos(dir), tb = Math.sin(dir), na = -tb * side, nb = ta * side;
      const la = R(0.14, 0.6) * (0.6 + 0.6 * k), lp = R(0.07, 0.28) * (0.6 + 0.6 * k), depth = R(0.012, 0.035);
      const ca = a + na * hw, cb = b + nb * hw;
      const h1 = R(0.1, 0.3), p1 = rnd() * 6.28, h2 = R(0.05, 0.15), p2 = rnd() * 6.28;
      const reach = Math.max(la, lp) * 1.4 * ppu;
      const cx = (ca - a0) * ppu - 0.5, cy = (cb - b0) * ppu - 0.5;
      for (let j = Math.max(0, Math.floor(cy - reach)); j <= Math.min(H - 1, Math.ceil(cy + reach)); j++) {
        for (let i = Math.max(0, Math.floor(cx - reach)); i <= Math.min(W - 1, Math.ceil(cx + reach)); i++) {
          const q = j * W + i;
          if (joint[q]) continue;
          const da = (i - cx) / ppu, db = (j - cy) / ppu;
          const u = da * ta + db * tb, v = da * na + db * nb;
          if (v < -hw) continue;
          const th = Math.atan2(v / lp, u / la);
          const rho = Math.hypot(u / la, Math.max(0, v) / lp) * (1 + h1 * Math.sin(3 * th + p1) + h2 * Math.sin(7 * th + p2));
          if (rho >= 1) continue;
          const r = -depth * (1 - rho * rho) ** 0.45;
          if (r < relief[q]) relief[q] = r;
          const fresh = 0.75 * (1 - rho) ** 0.3;
          if (fresh > pale[q]) pale[q] = fresh;
        }
      }
    }
  }

  // ── the pieces: what a slab's cracks and joints cut it into, each settled
  const piece = new Int32Array(N).fill(-1);
  const stack = new Int32Array(N);
  const pieces = [];
  for (let q0 = 0; q0 < N; q0++) {
    if (piece[q0] >= 0 || cut[q0] || joint[q0]) continue;
    const id = pieces.length, kk = key[q0];
    let top = 0, n = 0, sa = 0, sb = 0, edge = false;
    stack[top++] = q0;
    piece[q0] = id;
    while (top) {
      const q = stack[--top], i = q % W, j = (q - i) / W;
      n++; sa += i; sb += j;
      if (i === 0 || j === 0 || i === W - 1 || j === H - 1) edge = true;
      const look = (nq) => { if (piece[nq] < 0 && !cut[nq] && !joint[nq] && key[nq] === kk) { piece[nq] = id; stack[top++] = nq; } };
      if (i > 0) look(q - 1);
      if (i < W - 1) look(q + 1);
      if (j > 0) look(q - W);
      if (j < H - 1) look(q + W);
    }
    pieces.push({ key: kk, n, ci: sa / n, cj: sb / n, edge });
  }
  // the largest piece of each slab is where the slab was; the others have moved
  const largest = new Map();
  pieces.forEach((p, id) => { const L = largest.get(p.key); if (L === undefined || pieces[L].n < p.n) largest.set(p.key, id); });
  const plane = pieces.map((p, id) => {
    if (p.edge) return [0, 0, 0];
    const a = a0 + (p.ci + 0.5) / ppu, b = b0 + (p.cj + 0.5) / ppu, k = blow(a, b);
    const main = largest.get(p.key) === id, crumb = p.n < 40;
    const sink = k * R(0.3, 1) * 0.12 * (main ? 0.12 : crumb ? 1.4 : 1);
    // tipped, but never so far that its high side stands proud of the floor
    const radius = Math.sqrt(p.n / Math.PI) / ppu * 1.5 + 0.2;
    const tilt = Math.min(k * R(0.004, 0.03) * (main ? 0.3 : 1), (sink * 1.15) / radius), th = rnd() * Math.PI * 2;
    return [-sink, tilt * Math.cos(th), tilt * Math.sin(th), a, b];
  });
  const base = new Float32Array(N);
  const known = new Uint8Array(N);
  for (let q = 0; q < N; q++) {
    const id = piece[q];
    if (id < 0) continue;
    const [h, ga, gb, ca, cb] = plane[id];
    if (h === 0 && ga === 0 && gb === 0) { known[q] = 1; continue; }
    const i = q % W, j = (q - i) / W;
    base[q] = h + ga * (a0 + (i + 0.5) / ppu - ca) + gb * (b0 + (j + 0.5) / ppu - cb);
    known[q] = 1;
  }
  // a crack or a joint between two pieces lies at the lower of them
  for (let pass = 0; pass < 3; pass++) {
    const fill = [];
    for (let q = 0; q < N; q++) {
      if (known[q]) continue;
      const i = q % W, j = (q - i) / W;
      let lo = Infinity;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const nq = jj * W + ii;
        if (known[nq] && base[nq] < lo) lo = base[nq];
      }
      if (lo < Infinity) fill.push(q, lo);
    }
    for (let f = 0; f < fill.length; f += 2) { base[fill[f]] = fill[f + 1]; known[fill[f]] = 1; }
  }

  // ── What lies on it (rubble.js): the floor in the shade at the foot of each
  // block and stone, which keep the sky and the room's light off it there, and
  // the grit that came down with them — pale grains a pixel or two across,
  // thickest round the blocks and just inside the breach. (A stream of its
  // own, so the cracks are as they were.)
  // (`veil`: the dust a block's fall threw up, settled pale round it, out past
  // the shade at its foot)
  const shade = new Float32Array(N), grit = new Float32Array(N), veil = new Float32Array(N);
  const gr = makeRng(seed + 101), G = (lo, hi) => lo + (hi - lo) * gr();
  // how far (a, b) is outside a footprint, 0 under it
  const away = (a, b, [ca, cb, hx, hz, phi, , round]) => {
    const da = a - ca, db = b - cb;
    if (round) return Math.max(0, Math.hypot(da, db) - hx);
    const c = Math.cos(phi), s = Math.sin(phi);
    return Math.hypot(Math.max(0, Math.abs(da * c + db * s) - hx), Math.max(0, Math.abs(-da * s + db * c) - hz));
  };
  const grain = (a, b, rad, v) => {
    const cx = (a - a0) * ppu - 0.5, cy = (b - b0) * ppu - 0.5, rp = rad * ppu;
    for (let j = Math.max(0, Math.floor(cy - rp - 1)); j <= Math.min(H - 1, Math.ceil(cy + rp + 1)); j++) {
      for (let i = Math.max(0, Math.floor(cx - rp - 1)); i <= Math.min(W - 1, Math.ceil(cx + rp + 1)); i++) {
        const cov = Math.min(1, Math.max(0, rp + 0.5 - Math.hypot(i - cx, j - cy)));
        const q = j * W + i;
        if (v > 0) grit[q] = Math.max(grit[q], v * cov);
        else shade[q] = Math.max(shade[q], -v * cov);
      }
    }
  };
  for (const st of rest) {
    const [ca, cb, hx, hz, , depth, round] = st;
    const fall = 0.22 + 0.16 * Math.min(hx, hz), reach = Math.max(hx, hz) + (round ? fall * 5 : 7);
    const i0 = Math.max(0, Math.floor((ca - reach - a0) * ppu)), i1 = Math.min(W - 1, Math.ceil((ca + reach - a0) * ppu));
    const j0 = Math.max(0, Math.floor((cb - reach - b0) * ppu)), j1 = Math.min(H - 1, Math.ceil((cb + reach - b0) * ppu));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const q = j * W + i, o = away(a0 + (i + 0.5) / ppu, b0 + (j + 0.5) / ppu, st);
        const s = depth * Math.exp(-o / fall);
        shade[q] = 1 - (1 - shade[q]) * (1 - s);
        if (!round) veil[q] = Math.max(veil[q], 0.17 * Math.exp(-o / 2.3));
      }
    }
    // its grit: round a block, a thousand grains; round a stone, a few
    const tries = round ? Math.round(hx * 60) : 1000;
    for (let k = 0; k < tries; k++) {
      const a = ca + G(-1, 1) * (reach + 1.5), b = cb + G(-1, 1) * (reach + 1.5);
      const o = away(a, b, st);
      if (o <= 0 || gr() > Math.exp(-o / (round ? 0.5 : 1.5))) continue;
      grain(a, b, G(0.04, 0.12), gr() < 0.3 ? -G(0.12, 0.28) : G(0.3, 0.75));
    }
  }
  // and at the breach, thrown in through it
  if (rest.length) {
    for (let k = 0; k < 4800; k++) {
      const b = 2 + gr() ** 1.8 * 46, a = 1.5 + (gr() - 0.5) * (26 + b * 1.1);
      grain(a, b, G(0.035, 0.1), gr() < 0.3 ? -G(0.12, 0.28) : G(0.25, 0.65));
    }
  }

  // ── out: slope (world x, z) and tone
  const rgba = new Uint8ClampedArray(N * 4);
  const enc = (s) => 128 + 127 * Math.sign(s) * Math.sqrt(Math.min(1, Math.abs(s) / CRACK_SLOPE));
  const hAt = (i, j) => base[j * W + i] + relief[j * W + i];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const q = j * W + i, o = q * 4;
      let sx = 0, sz = 0;
      if (i > 0 && j > 0 && i < W - 1 && j < H - 1) {
        // the slope along and into, then turned into the world's x and z
        const ha = (hAt(i + 1, j) - hAt(i - 1, j)) * ppu * 0.5, hb = (hAt(i, j + 1) - hAt(i, j - 1)) * ppu * 0.5;
        sx = ha * along[0] + hb * into[0];
        sz = ha * along[1] + hb * into[1];
      }
      // The gap: its broken walls in shadow, black down the middle; and the
      // dirt its edges have taken in, never as dark as the gap (the floor's
      // shader draws the crack's outline where the two part, at 0.45).
      // (and the shade at a stone's foot over both; the grit on the stone)
      const gap = Math.min(1, cover[q] * (0.6 + 0.4 * core[q]) + dirt[q] * 0.45 * (1 - cover[q]));
      // (kept under the gap's 0.45 off the gap, so the shader never draws a
      // crack's crisp outline round a patch of shade)
      const shaded = 1 - (1 - gap) * (1 - shade[q]), dark = gap < 0.45 ? Math.min(0.44, shaded) : shaded;
      const fresh = Math.min(1, pale[q] + grit[q] + veil[q]) * (1 - cover[q]);
      rgba[o] = enc(-sx);
      rgba[o + 1] = enc(-sz);
      rgba[o + 2] = 128 + 127 * Math.max(-1, Math.min(1, fresh - dark));
      rgba[o + 3] = 255;
    }
  }
  // (the joints and the pieces' heights too, for looking at it outside the world)
  return { W, H, rgba, pieces: pieces.length, paths: paths.length, joint, base };
}

export function floorCracks(args) {
  const { W, H, rgba } = crackFields(args);
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  img.data.set(rgba);
  g.putImageData(img, 0, 0);
  return { map: toTexture(c, { srgb: false }) };
}
