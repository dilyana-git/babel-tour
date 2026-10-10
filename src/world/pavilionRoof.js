// ── The Pavilion's roof, tiled ───────────────────────────────────────────────
// It was two shells turned on a lathe with sixteen black rods laid over each
// and a ruled texture between them, glossy: from the Fork and from the bridge,
// navy panes in curved black ribs — a conservatory, or an umbrella. And the
// curve it was turned from was a dome's: level at the top and steepest at the
// eave, where a roof of this kind is the other way about.
//
// So (forkProps.js, 2 and 11) it is a roof of tile now. Each slope falls in a
// hollow curve — steep under the ridge, easing to the eave, and level at the
// eave's edge — and at every corner the eave sweeps up. On each slope the
// tiles lie as they are laid: pans in the valleys, and over every joint
// between two pans a roll of half-round cover tiles, each tile lapping the one
// below it, running straight down the fall from wherever it meets a hip; at
// the eave each roll ends in a round tile-end and each pan in a drip tile. The
// hips are rolled too, heavier, and run on past the eave into the corner's
// sweep, tapering, and end in a scroll turned back on itself — where there
// were black posts with gold balls on them. Under it, a soffit of dark boards
// and an eave board to close the edge.
//
// All of it is laid out from `roofTop`, the roof's own surface, which the
// rafters under it and the lanterns hung from it ask too (buildWorld.js,
// `soffit`): a facet's surface is ruled between its two hips, so a point of
// it is known by how far out its hips are there (`q`) and how far across it
// lies from one hip to the other (`u`).
//
// `kind`: 'grey' (grey tile in rolls: the roof it has), 'green' (the same,
// green-glazed), 'bark' (bark shingle: no rolls, a thick soft edge).
import * as THREE from 'three';
import { makeRng } from './textures';

const D = Math.PI / 180, HALF = 22.5 * D, SIN = Math.sin(HALF), COS = Math.cos(HALF);

// The two tiers. `r`: out to the column of its eave purlin's reach, where the
// old shell's eave was (and where the lanterns hang); `y` its height there;
// `A` its slope at the eave and `B` how fast that steepens going up; inside
// `rc` it turns over to a level top at `flat` (the lower tier's, under the
// upper one, is the ceiling the reader sees from the table); `lift`: how far
// its corners sweep up; `stop`: inside this its tiles are under something
// (the upper tier's eave; the finial's foot) and are not laid; `hip` the
// radius of its hip rolls.
export const ROOF_TIERS = [
  { r: 52, y: 44, A: 0.5, B: 0.0051, rc: 29, flat: 7, lift: 4.2, stop: 27, hip: 1.0 },
  { r: 29, y: 62, A: 0.25, B: 0.00586, rc: 4, flat: 0, lift: 3.0, stop: 4.8, hip: 0.85 },
];
// how far the eave oversails `r`, the roof's thickness, and its tiles: a
// roll's radius, the rolls' spacing, a tile's length (a unit is 9.4 cm)
const EAVE = 1.06, THICK = 0.45;
const TILE = { roll: 0.52, gap: 2.25, len: 3.3 };

const ss = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
// the height of a tier's top along a hip, `q` out
export const roofProfile = (t, q) => {
  const s = t.r - q;
  if (s < 0) { const over = t.r * (EAVE - 1); return t.y + t.A * s + (t.A / (2 * over)) * s * s; }
  if (q >= t.rc) return t.y + t.A * s + t.B * s * s;
  const sc = t.r - t.rc, yc = t.y + t.A * sc + t.B * sc * sc, mc = t.A + 2 * t.B * sc;
  const span = t.rc - t.flat, d = Math.min(t.rc - q, span);
  return yc + mc * d - (mc / (2 * span)) * d * d;
};
const sweep = (t, u, q) => t.lift * Math.abs(2 * u - 1) ** 2.2 * ss((q - 0.72 * t.r * EAVE) / (0.28 * t.r * EAVE)) ** 1.5;
// the roof's top at bearing `a` (degrees), `r` out from the middle
export const roofTop = (t, a, r) => {
  const f = ((((a - 22.5) % 45) + 45) % 45 - 22.5) * D;
  const q = (r * Math.cos(f)) / COS;
  const u = q > 1e-6 ? 0.5 + (r * Math.sin(f)) / (2 * q * SIN) : 0.5;
  return roofProfile(t, q) + sweep(t, u, q);
};

// A mesh gathered a triangle at a time, each corner { p, n, t } — wound to
// agree with the normals it is given.
const gather = () => {
  const pos = [], nor = [], uv = [];
  const tri = (a, b, c) => {
    const ux = b.p[0] - a.p[0], uy = b.p[1] - a.p[1], uz = b.p[2] - a.p[2];
    const vx = c.p[0] - a.p[0], vy = c.p[1] - a.p[1], vz = c.p[2] - a.p[2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * fx + fy * fy + fz * fz < 1e-12) return;
    const flip = fx * (a.n[0] + b.n[0] + c.n[0]) + fy * (a.n[1] + b.n[1] + c.n[1]) + fz * (a.n[2] + b.n[2] + c.n[2]) < 0;
    for (const v of flip ? [a, c, b] : [a, b, c]) { pos.push(...v.p); nor.push(...v.n); uv.push(...v.t); }
  };
  return {
    tri,
    quad: (a, b, c, d) => { tri(a, b, c); tri(a, c, d); },
    geometry: () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeBoundingSphere();
      return g;
    },
  };
};
const norm = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix3 = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

// The roof over `at` ([x, z]). Returns { tiles, under }: the tiled top (for
// `roofTiles`' texture) and the soffit and eave board under it; and `tips`,
// where each corner's scroll ends.
export function tiledRoof({ at, kind = 'grey', light = false }) {
  const tiles = gather(), under = gather(), tips = [];
  const rolled = kind !== 'bark';
  const hash = (i, j, k) => { const x = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return x - Math.floor(x); };
  ROOF_TIERS.forEach((t, ti) => {
    const rE = t.r * EAVE;
    // how far down the slope from `q` to the eave's edge (along a facet's middle)
    const arc = (() => {
      const N = 240, qs = [], s = [];
      let run = 0;
      for (let i = 0; i <= N; i++) {
        const q = rE * (1 - i / N);
        if (i) run += Math.hypot((rE / N) * COS, roofProfile(t, q) - roofProfile(t, qs[i - 1]));
        qs.push(q);
        s.push(run);
      }
      return {
        of: (q) => { const x = (1 - q / rE) * N, i = Math.min(N - 1, Math.max(0, Math.floor(x))); return s[i] + (s[i + 1] - s[i]) * (x - i); },
        at: (len) => { let i = 0; while (i < N - 1 && s[i + 1] < len) i++; return qs[i] + (qs[i + 1] - qs[i]) * ((len - s[i]) / ((s[i + 1] - s[i]) || 1)); },
      };
    })();
    for (let k = 0; k < 8; k++) {
      const a0 = (22.5 + 45 * k) * D, a1 = a0 + 45 * D, am = a0 + HALF;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      // along the eave, and straight out from the middle of the facet
      const S = norm([c1 - c0, 0, s1 - s0]), OUT = [Math.cos(am), 0, Math.sin(am)];
      const P = (u, q, drop = 0) => [at[0] + (c0 * (1 - u) + c1 * u) * q, roofProfile(t, q) + sweep(t, u, q) - drop, at[1] + (s0 * (1 - u) + s1 * u) * q];
      // by how far across it lies in units, not as a share: `w` from the middle
      const chord = (q) => 2 * q * SIN;
      const W = (w, q, drop = 0) => P(0.5 + Math.min(0.5, Math.max(-0.5, w / Math.max(1e-6, chord(q)))), q, drop);
      const N = (w, q) => {
        // (a step across that stays on the facet: at its far hip, back the other way)
        const e = 0.25, p0 = W(w, q), pq = W(w, Math.max(0.05, q - e)), pw = W(w + (w + e > chord(q) / 2 ? -e : e), q);
        const n = norm(cross([pq[0] - p0[0], pq[1] - p0[1], pq[2] - p0[2]], [pw[0] - p0[0], pw[1] - p0[1], pw[2] - p0[2]]));
        return n[1] < 0 ? [-n[0], -n[1], -n[2]] : n;
      };
      const n = Math.max(1, Math.floor((chord(rE) - 2 * t.hip - TILE.gap * 0.4) / TILE.gap) + 1);
      const lines = Array.from({ length: n }, (_, j) => (j - (n - 1) / 2) * TILE.gap);
      const rows = [];
      for (let q = rE, i = 0; q > 0.4; i++, q = arc.at(i * TILE.len * (light ? 2 : 1))) rows.push(q);
      rows.push(0.4);

      // ── the pans: a strip between each two rolls, cut off at the hips ─────
      const bounds = [-1e9, ...lines, 1e9];
      for (let j = 0; j < bounds.length - 1; j++) {
        const left = j === 0 ? lines[0] - TILE.gap : bounds[j], col = Math.floor(hash(ti, k, j) * 3);
        const corner = (w, q) => {
          const wc = Math.min(chord(q) / 2, Math.max(-chord(q) / 2, w));
          const x = rolled ? Math.min(1, Math.max(0, (wc - left) / TILE.gap)) : (wc / TILE.gap) % 1;
          return { p: W(wc, q), n: N(wc, q), t: [rolled ? (col + 0.04 + 0.92 * x) * 0.2 : wc / (TILE.gap * 4), arc.of(q) / (TILE.len * 4)] };
        };
        for (let i = 0; i < rows.length - 1; i++) {
          const qa = rows[i], qb = rows[i + 1];
          if (bounds[j] >= chord(qa) / 2 || bounds[j + 1] <= -chord(qa) / 2) continue;
          tiles.quad(corner(bounds[j], qa), corner(bounds[j + 1], qa), corner(bounds[j + 1], qb), corner(bounds[j], qb));
        }
      }
      // ── the rolls, a tile at a time, and what each ends in at the eave ────
      if (rolled) {
        const TH = light ? 3 : 5;
        const ring = (w, q, rad, v) => {
          const c = W(w, q), nn = N(w, q);
          return Array.from({ length: TH + 1 }, (_, h) => {
            const th = (h / TH) * Math.PI, cs = Math.cos(th), sn = Math.sin(th);
            return {
              p: [c[0] + (S[0] * cs + nn[0] * sn) * rad, c[1] + (S[1] * cs + nn[1] * sn) * rad, c[2] + (S[2] * cs + nn[2] * sn) * rad],
              n: norm([S[0] * cs + nn[0] * sn, S[1] * cs + nn[1] * sn, S[2] * cs + nn[2] * sn]),
              t: [0.61 + 0.18 * (h / TH), v],
            };
          });
        };
        lines.forEach((w, j) => {
          const top = Math.max(t.stop, Math.abs(w) / SIN + t.hip * 0.8);
          if (top > rE - 1.2) return;
          const sTop = arc.of(top), row = Math.floor(hash(ti + 5, k, j) * 4);
          for (let i = 0; i * TILE.len < sTop; i++) {
            const sa = i * TILE.len, sb = Math.min(sTop, sa + TILE.len);
            // (each tile a little wider at its lower end, where it laps the next)
            const lo = ring(w, arc.at(sa), TILE.roll * 1.1, (i + row) * 0.25 + 0.004);
            const hi = ring(w, arc.at(sb), TILE.roll * 0.9, (i + row) * 0.25 + 0.25 * ((sb - sa) / TILE.len) - 0.004);
            for (let h = 0; h < TH; h++) tiles.quad(lo[h], lo[h + 1], hi[h + 1], hi[h]);
          }
          // the tile-end: a round face on the roll's end, looking out
          const c = W(w, rE), nn = N(w, rE), outw = norm(cross(S, nn)), o = outw[0] * OUT[0] + outw[2] * OUT[2] < 0 ? -1 : 1;
          const face = [outw[0] * o, outw[1] * o, outw[2] * o], R = TILE.roll * 1.12;
          const mid = { p: mix3(mix3(c, nn, R * 0.25), face, 0.12), n: face, t: [0.9, 0.5] };
          const rim = Array.from({ length: 11 }, (_, h) => {
            const th = (h / 10) * Math.PI * 2;
            return { p: mix3(mix3(mid.p, S, Math.cos(th) * R), nn, Math.sin(th) * R), n: face, t: [0.9 + 0.085 * Math.cos(th), 0.5 + 0.085 * Math.sin(th)] };
          });
          for (let h = 0; h < 10; h++) tiles.tri(mid, rim[h], rim[h + 1]);
          // and the drip tile between this roll and the next: a tongue hung from the pan's edge
          if (j < lines.length - 1) {
            const wa = w + TILE.roll * 1.1, wb = lines[j + 1] - TILE.roll * 1.1, wm = (wa + wb) / 2;
            const pa = W(wa, rE, 0.1), pb = W(wb, rE, 0.1), pm = mix3(W(wm, rE, 1.15), face, 0.15);
            tiles.tri({ p: pa, n: face, t: [0.03, 0.03] }, { p: pb, n: face, t: [0.17, 0.03] }, { p: pm, n: face, t: [0.1, 0.2] });
          }
        });
      }
      // ── the soffit, and the eave board that closes the edge ───────────────
      const NU = light ? 4 : 8;
      const underAt = (u, q) => { const nn = N((u - 0.5) * chord(q), q); return { p: P(u, q, THICK), n: [-nn[0], -nn[1], -nn[2]], t: [u, q / rE] }; };
      const qs = [rE, t.r, t.r * 0.82, t.r * 0.62, t.r * 0.42, t.r * 0.22, 0.3];
      for (let i = 0; i < qs.length - 1; i++) {
        for (let h = 0; h < NU; h++) under.quad(underAt(h / NU, qs[i]), underAt((h + 1) / NU, qs[i]), underAt((h + 1) / NU, qs[i + 1]), underAt(h / NU, qs[i + 1]));
      }
      const BOARD = rolled ? 1.5 : 2.4, NE = light ? 8 : 16;
      for (let h = 0; h < NE; h++) {
        const ua = h / NE, ub = (h + 1) / NE;
        for (const side of [1, -1]) {
          const nrm = [OUT[0] * side, 0, OUT[2] * side];
          under.quad({ p: P(ua, rE, 0.02), n: nrm, t: [ua, 1] }, { p: P(ub, rE, 0.02), n: nrm, t: [ub, 1] },
            { p: P(ub, rE, BOARD), n: nrm, t: [ub, 0] }, { p: P(ua, rE, BOARD), n: nrm, t: [ua, 0] });
        }
        under.quad({ p: P(ua, rE, BOARD), n: [0, -1, 0], t: [ua, 0] }, { p: P(ub, rE, BOARD), n: [0, -1, 0], t: [ub, 0] },
          { p: P(ub, rE - 0.7, BOARD), n: [0, -1, 0], t: [ub, 0.1] }, { p: P(ua, rE - 0.7, BOARD), n: [0, -1, 0], t: [ua, 0.1] });
      }

      // ── the hip down this facet's first corner, on into the sweep ─────────
      {
        const e = [c0, 0, s0], b = [-s0, 0, c0];   // out along the hip, and across it
        const line = [];
        const from = Math.max(t.stop, 0.6), STEPS = light ? 10 : 18;
        for (let i = 0; i <= STEPS; i++) {
          const q = from + (rE - from) * (i / STEPS);
          line.push({ o: q, y: roofProfile(t, q) + sweep(t, 0, q) + t.hip * 0.45, rad: t.hip });
        }
        // past the eave: the horn, rising as it goes, thinner; then the scroll
        const tipY = line[line.length - 1].y, HORN = light ? 4 : 7;
        for (let i = 1; i <= HORN; i++) {
          const tau = i / HORN;
          line.push({ o: rE + 2.9 * tau - 0.8 * tau * tau, y: tipY + 2.3 * tau ** 1.8, rad: t.hip * (1 - 0.55 * tau) });
        }
        const end = line[line.length - 1], SCROLL = light ? 5 : 9, R0 = 0.78;
        for (let i = 1; i <= SCROLL; i++) {
          const f = i / SCROLL, phi = f * Math.PI * 1.55, rr = R0 * (1 - 0.5 * f);
          line.push({ o: end.o - R0 + Math.cos(phi) * rr, y: end.y + 0.2 + Math.sin(phi) * rr, rad: t.hip * (0.45 - 0.17 * f) });
        }
        tips.push([at[0] + e[0] * (end.o - R0), end.y + 0.2, at[1] + e[2] * (end.o - R0)]);
        const RAD = light ? 6 : 8;
        let run = 0;
        const rings = line.map((pt, i) => {
          const a = line[Math.max(0, i - 1)], c = line[Math.min(line.length - 1, i + 1)];
          const tl = Math.hypot(c.o - a.o, c.y - a.y) || 1, to = (c.o - a.o) / tl, ty = (c.y - a.y) / tl;
          // square to the hip's own run, in the upright plane it lies in
          const up = [-ty * e[0], to, -ty * e[2]];
          if (i) run += Math.hypot(pt.o - line[i - 1].o, pt.y - line[i - 1].y);
          const centre = [at[0] + e[0] * pt.o, pt.y, at[1] + e[2] * pt.o];
          return Array.from({ length: RAD + 1 }, (_, h) => {
            const th = (h / RAD) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
            const nn = [up[0] * cs + b[0] * sn, up[1] * cs + b[1] * sn, up[2] * cs + b[2] * sn];
            return { p: mix3(centre, nn, pt.rad), n: nn, t: [0.61 + 0.18 * (h / RAD), run / (TILE.len * 4)] };
          });
        });
        for (let i = 0; i < rings.length - 1; i++) for (let h = 0; h < RAD; h++) tiles.quad(rings[i][h], rings[i][h + 1], rings[i + 1][h + 1], rings[i + 1][h]);
      }
    }
  });
  return { tiles: tiles.geometry(), under: under.geometry(), tips };
}

// The tiles' texture, for `tiledRoof`'s uv: five columns — three of pans side
// by side, the rolls' own strip, and a last one for the round face of a
// tile-end — four tiles up, each tile's lower edge at the bottom of its cell:
// a lip the light catches there, and under the tile above it, its shadow.
const KINDS = {
  grey: { pan: [58, 62, 66], roll: [88, 92, 95], spread: 9, lichen: [146, 148, 126], moss: [44, 58, 34], lip: 26 },
  green: { pan: [26, 50, 40], roll: [42, 82, 62], spread: 8, lichen: [120, 136, 104], moss: [30, 44, 26], lip: 34 },
  bark: { pan: [58, 47, 39], roll: [58, 47, 39], spread: 7, lichen: [112, 110, 88], moss: [46, 58, 32], lip: 12 },
};
export function roofTiles(kind = 'grey', size = 512) {
  const K = KINDS[kind] ?? KINDS.grey, r = makeRng(7741), R = (a, b) => a + (b - a) * r();
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), cw = size / 5, ch = size / 4;
  const rgb = (v, k = 0, a = 1) => `rgba(${Math.round(v[0] + k)},${Math.round(v[1] + k)},${Math.round(v[2] + k)},${a})`;
  if (kind === 'bark') {
    // shingle of bark, laid in thin courses: no columns, many layers, each a
    // ragged line with the one above it lapping it
    g.fillStyle = rgb(K.pan);
    g.fillRect(0, 0, size, size);
    const layers = 28, lh = size / layers;
    for (let i = 0; i < layers; i++) {
      for (let x = 0; x < size; x += R(10, 34)) {
        const w = R(10, 34), k = R(-K.spread, K.spread);
        g.fillStyle = rgb(K.pan, k);
        g.fillRect(x, i * lh, w, lh);
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(x, i * lh, 1, lh);
      }
      const grd = g.createLinearGradient(0, i * lh, 0, (i + 1) * lh);
      grd.addColorStop(0, 'rgba(0,0,0,0.42)');
      grd.addColorStop(0.35, 'rgba(0,0,0,0)');
      grd.addColorStop(0.85, 'rgba(255,240,220,0)');
      grd.addColorStop(1, `rgba(255,240,220,${(K.lip / 255).toFixed(3)})`);
      g.fillStyle = grd;
      g.fillRect(0, i * lh, size, lh);
    }
  } else {
    for (let col = 0; col < 4; col++) {
      const roll = col === 3, base = roll ? K.roll : K.pan;
      for (let row = 0; row < 4; row++) {
        const x = col * cw, y = row * ch, k = R(-K.spread, K.spread);
        g.fillStyle = rgb(base, k);
        g.fillRect(x, y, cw, ch);
        // across it: a pan is a trough, dark where the rolls beside it shade
        // it; a roll is round, a little paler along its crown
        const across = g.createLinearGradient(x, 0, x + cw, 0);
        if (roll) {
          across.addColorStop(0, 'rgba(0,0,0,0.3)'); across.addColorStop(0.5, 'rgba(255,255,255,0.07)'); across.addColorStop(1, 'rgba(0,0,0,0.3)');
        } else {
          across.addColorStop(0, 'rgba(0,0,0,0.5)'); across.addColorStop(0.3, 'rgba(0,0,0,0.08)'); across.addColorStop(0.7, 'rgba(0,0,0,0.08)'); across.addColorStop(1, 'rgba(0,0,0,0.5)');
        }
        g.fillStyle = across;
        g.fillRect(x, y, cw, ch);
        // up it: the shadow of the tile above over its top, its own lip below
        const up = g.createLinearGradient(0, y, 0, y + ch);
        up.addColorStop(0, 'rgba(0,0,0,0.55)'); up.addColorStop(0.16, 'rgba(0,0,0,0.12)'); up.addColorStop(0.4, 'rgba(0,0,0,0)');
        up.addColorStop(0.9, 'rgba(255,255,255,0)'); up.addColorStop(0.955, `rgba(235,240,245,${(K.lip / 255).toFixed(3)})`); up.addColorStop(1, 'rgba(0,0,0,0.3)');
        g.fillStyle = up;
        g.fillRect(x, y, cw, ch);
      }
    }
    // the round face of a tile-end, in the last column: a rim and a boss
    const ex = 4.5 * cw, ey = size * 0.5, er = 0.085 * size;
    g.fillStyle = rgb(K.roll, -14);
    g.fillRect(4 * cw, 0, cw, size);
    for (const [rad, k] of [[er, -20], [er * 0.84, -8], [er * 0.6, -14], [er * 0.3, -4]]) {
      g.fillStyle = rgb(K.roll, k);
      g.beginPath(); g.arc(ex, ey, rad, 0, Math.PI * 2); g.fill();
    }
  }
  // weather over all of it: grain, a little lichen, moss where the wet stays
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${R(0.04, 0.2).toFixed(3)})` : `rgba(255,250,240,${R(0.02, 0.1).toFixed(3)})`;
    const s = R(0.8, 2.6);
    g.fillRect(R(0, size), R(0, size), s, s);
  }
  for (let i = 0; i < 46; i++) {
    const x = R(0, size), y = R(0, size), rad = R(4, 15), moss = r() < 0.45;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, rgb(moss ? K.moss : K.lichen, 0, moss ? 0.55 : 0.34));
    grd.addColorStop(1, rgb(moss ? K.moss : K.lichen, 0, 0));
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
}
// what each dressing is as a surface: its roughness, and how much of the sky
// it gives back (the glass the old roof read as was mostly the second)
export const ROOF_SURFACE = {
  grey: { roughness: 0.88, sky: 0.3, direct: 0.6 },
  green: { roughness: 0.5, sky: 0.45, direct: 0.8 },
  bark: { roughness: 0.96, sky: 0.15, direct: 0.3 },
};
