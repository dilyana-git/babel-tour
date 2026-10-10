// The Web of Time's arrival frame, reviewed 2026-10-09 (the numbered points on
// the review board): 2 over the hedges, the top half of the frame was a wall
// of the Library's blue-grey ashlar — the honeycomb's garden faces stand three
// paces behind the maze's far hedge and ten metres tall, so the heart of a
// garden maze read as a walled yard: a belt of cedars is planted between the
// maze and the garden's hedge now, two and three deep, tall enough that from
// the stand their spires are the skyline and the stone is behind them;
// 3 the summary says that in every direction you are already walking, and no
// way left the court in view — its fourth gate is straight behind the
// armillary, and the hedges round it read as solid blocks: the court's south
// rim is opened a cell to the left of the armillary, onto a straight run of
// hedge two cells long that goes away from the lamp into the dark;
// 5 the fireflies were few and large and steady, dust on the lens: all of
// them are flown now and more besides, half the size, and each one flashes on
// its own beat and goes dark between, the way a firefly does (effects.js,
// makeSparkles `blink`); 7 the pedestal was three plain cylinders under a
// richly made sphere: a carved stand now — a stepped plinth, a moulded base,
// a shaft reeded at foot and head with two rings of gilt capitals between,
// and an ovolo capital under a square-edged abacus. The sentence is the one
// the map says at the end; 6 is in EntryMap.jsx (the way on says it is the
// ending, and the film has a Skip on screen for its whole length).
//
// ?wwebfix=old puts all of them back as they were; ?wwebfix=old:2,5 only those.
import * as THREE from 'three';
import { webPropsOld, BELT } from './webProps';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wwebfix');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const webOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// 2. The cedars behind the maze: rows parallel to its far hedge, `gap` apart
// along the row, `back` between rows, the first `first` past the hedge's
// line. Heights by row (the back rows taller, so the spires stand over the
// ones in front and close the notches between their tips). Their own stream.
export const SCREEN = {
  seed: 7741,
  first: qn('wwsfirst', 24), back: qn('wwsback', 16), gap: qn('wwsgap', 17), skirt: qn('wwsskirt', 0.06),
  // (webProps.js, 2: of a height and evenly spaced they were a palisade)
  rows: webPropsOld(2) ? [
    { H: [104, 138], S: [16, 20] },
    { H: [126, 160], S: [17, 22] },
    { H: [140, 176], S: [18, 23] },
  ] : BELT.rows,
  step: webPropsOld(2) ? [0.75, 1.3] : BELT.step,
};
// And the stone they stand in front of, let fall into the night (the mass's
// `weather` shading, buildWorld.js): by `k` south of z[0]..z[1] and east of
// x[0]..x[1] — behind the maze from the court, and clear of the Door's cell
// and of every room on the walk. (The heart's own falloff already takes
// most of the near walls; the far block at z 673 was out of its reach.)
// `spec`: and its sheen with it. The heart's falloff only ever darkened the
// stone's colour, and blank brick painted black was still brick in the sky's
// reflection off it.
export const WALLS = { k: webOld(2) ? 0 : qn('wwwall', 0.93), z: [470, 545], x: [1060, 1130], spec: !webOld(2) };
// Where they stand: `MZ` the maze's grid, `ok(p)` the garden's say (inside it,
// off its hedge, a crown's reach off the Library's stone). The rows run the
// width of the maze and a cell past each side, because from the stand the
// stone shows over the court's side hedges too.
// `walled(p)`: the Library's stone is close behind `p` (webProps.js, 2).
export function screenPlaces(rng, MZ, ok, walled = null) {
  const R = (a, b) => a + (b - a) * rng();
  const out = [];
  const hedge = MZ.z0 + MZ.rows * MZ.ch, z0 = hedge + SCREEN.first;
  const xa = MZ.x0 - 1.2 * MZ.cw, xb = MZ.x0 + (MZ.cols + 1.4) * MZ.cw;
  const laneX = MZ.x0 + (GATE.col + 0.5) * MZ.cw;
  SCREEN.rows.forEach((row, k) => {
    // (a row of the belt, webProps.js 2, says where it stands: `at` off the
    // hedge, and `x` from where to where as shares of a cell off the maze)
    const a = row.x ? MZ.x0 + row.x[0] * MZ.cw : xa, b = row.x ? MZ.x0 + row.x[1] * MZ.cw : xb;
    const z = row.at === undefined ? z0 + k * SCREEN.back : hedge + row.at, sway = row.sway ?? 5;
    let tight = 1;
    const za = row.flank === undefined ? 0 : hedge + row.z[0] * MZ.ch, zb = row.flank === undefined ? 0 : hedge + row.z[1] * MZ.ch;
    for (let x = row.flank === undefined ? a + (k % 2) * SCREEN.gap * 0.5 : za; x <= (row.flank === undefined ? b : zb); x += SCREEN.gap * R(...SCREEN.step) * tight) {
      tight = row.tight ?? 1;
      const p = row.flank === undefined ? [x + R(-3, 3), z + R(-sway, sway)] : [MZ.x0 - row.flank + R(-sway, sway), x + R(-3, 3)];
      // (all the draws spent whether it stands or not, so one moved by a dial
      // does not reshuffle the rest)
      let H = R(...row.H);
      let S = R(...row.S);
      if (walled) {
        const tall = R(...BELT.wall);
        if (row.flank === undefined && walled(p)) { H = Math.max(H, tall); S *= BELT.reach; tight = BELT.tight; }
      }
      const inLane = GATE.through && (row.lane ?? k < 2) && Math.abs(p[0] - laneX) < S * GATE.lane[0] + GATE.lane[1];
      if (ok(p, S) && !inLane) out.push({ p, H, S, far: !!row.far });
    }
  });
  return out;
}

// 3. The gate: the cell of the court's south rim that opens (5, to the left of
// the armillary from the stand; 3 is to its right), and the run of cells the
// way goes straight on through before the maze has it turn.
// `through`: and on out of the maze's far side, into a lane left between the
// cedars' first two rows (`lane`: how far off its line a trunk must stand, as
// a share of its crown, plus a margin). Stopped by the maze's outer hedge 60
// units on, the way read as an alcove, lit at its end; it runs into the dark
// now. (The lawn out there was always walked on; the garden's hedge closes it.)
export const GATE = { col: qn('wwgcol', 5), run: 2, through: !webOld(3) && Q.get('wwgthrough') !== '0', lane: [0.55, 5] };
// `set(c, r, d, v)` and `reachable()` are the court's own (buildWorld.js).
export function openGate(grid, COURT, set, reachable) {
  const c = GATE.col, rows = grid.length;
  let r = COURT.r1;
  set(c, r, 's', 0);
  for (let k = 1; k <= GATE.run && r + k < rows; k++) {
    if (r + k + 1 < rows) {
      if (k < GATE.run) set(c, r + k, 's', 0);
    } else if (GATE.through) grid[r + k][c].s = 0;   // (the maze's outer hedge)
  }
  // hedge on both hands the length of the run, where the maze can spare it:
  // a way that opens sideways at once reads as a gap, not a way
  for (let k = 1; k <= GATE.run && r + k < rows; k++) {
    for (const d of ['e', 'w']) {
      if (grid[r + k][c][d]) continue;
      set(c, r + k, d, 1);
      if (!reachable()) set(c, r + k, d, 0);
    }
  }
}

// 5. The fireflies: every one the stream drew (a third were flown), `extra`
// more over the maze from a stream of their own, at `size` of the old size,
// and blinking.
export const FLIES = { size: qn('wwfsize', 0.5), extra: qn('wwfextra', 240), seed: 7757, blink: qn('wwfblink', 1) };

// 7. The pedestal, as a profile turned on the lathe: [r, y] from the foot of
// the plinth out and up to the middle of the abacus's top. A corner is the
// same point twice (LatheGeometry then keeps the faces either side of it
// flat). Heights are the old stand's: on the court's floor at 5, the
// armillary's seat at 16.1.
const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});
const D = Math.PI / 180;
export const PEDESTAL = {
  // the shaft: foot and head radius, its two reeded zones and the two rings of
  // letters between them (centre heights), the band's height
  shaft: { y0: 9.1, y1: 13.7, r0: 4.02, r1: 3.66 },
  reeds: [[9.1, 9.84], [12.36, 13.7]],
  rings: [11.65, 10.55], band: 0.94,
  flutes: 28, fluteDeep: 0.13,
  text: ['TIME FORKS PERPETUALLY', 'TOWARD INNUMERABLE FUTURES'],
};
const shaftR = (y) => {
  const { y0, y1, r0, r1 } = PEDESTAL.shaft, t = (y - y0) / (y1 - y0);
  // entasis: a swell a third of the way up, not a straight cone
  return r0 + (r1 - r0) * t + 0.06 * Math.sin(Math.PI * Math.min(1, t * 1.5));
};
export const pedestalShaftR = shaftR;
function profile() {
  const P = [];
  const corner = (r, y) => P.push([r, y], [r, y]);
  const run = (pts) => pts.forEach((p) => P.push(p));
  // plinth: two steps, their arrises chamfered
  corner(6.95, 5.0);
  run([[6.95, 5.62]]);
  corner(6.72, 5.84);
  corner(6.2, 5.84);
  run([[6.2, 6.4]]);
  corner(6.02, 6.58);
  // base: torus, scotia, torus, fillet, and the shaft's curved foot
  corner(5.42, 6.58);
  run(arc(5.42, 6.97, 0.39, -90 * D, 90 * D, 8).slice(1));
  corner(5.1, 7.36);
  run([[5.0, 7.42], [4.8, 7.56], [4.69, 7.76], [4.7, 7.95], [4.8, 8.08]]);
  run(arc(4.78, 8.33, 0.25, -95 * D, 90 * D, 7));
  corner(4.5, 8.58);
  run([[4.5, 8.72]]);
  run([[4.32, 8.82], [4.16, 8.94], [shaftR(9.1), 9.1]]);
  // the shaft, with a fillet round it above and below each ring of letters
  // (the one between the rings is shared)
  const fillets = [...new Set(PEDESTAL.rings.flatMap((y) => [y - PEDESTAL.band / 2 - 0.16, y + PEDESTAL.band / 2]).map((f) => +f.toFixed(3)))].sort((a, b) => a - b);
  let y = 9.1;
  for (const f of fillets) {
    for (let t = y + 0.2; t < f - 0.04; t += 0.2) run([[shaftR(t), t]]);
    corner(shaftR(f), f);
    corner(shaftR(f) + 0.13, f);
    corner(shaftR(f) + 0.13, f + 0.16);
    corner(shaftR(f + 0.16), f + 0.16);
    y = f + 0.16;
  }
  for (let t = y + 0.2; t < PEDESTAL.shaft.y1 - 0.04; t += 0.2) run([[shaftR(t), t]]);
  run([[shaftR(13.7), 13.7]]);
  // neck: the astragal is the gilt ring (pedestalGeometry); then the capital's
  // ovolo swelling out to the abacus, and the abacus with its top arris eased
  corner(3.62, 13.96);
  run([[3.62, 14.1]]);
  run(arc(3.62, 15.02, 0.92, -90 * D, 0, 7).slice(1));
  corner(4.62, 15.02);
  corner(4.78, 15.02);
  run([[4.78, 15.84]]);
  corner(4.62, 16.1);
  corner(0.001, 16.1);
  return P.map(([r, yy]) => new THREE.Vector2(r, yy));
}
// The stone of it, about the origin (the caller carries it to the heart), and
// the gilt: the neck's astragal and a bead in the base's upper fillet.
export function pedestalGeometry(segments = PEDESTAL.flutes * 8) {
  const g = new THREE.LatheGeometry(profile(), segments);
  // Reeds in the two zones: the stone cut back in rounded channels, faded out
  // at either end of a zone so the channels stop in the stone as cut ones do.
  const pos = g.attributes.position, n = PEDESTAL.flutes;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const zone = PEDESTAL.reeds.find(([a, b]) => y > a && y < b);
    if (!zone) continue;
    const [a, b] = zone, edge = Math.min(1, (y - a) / 0.18, (b - y) / 0.18);
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    if (r < 1) continue;
    const ang = Math.atan2(z, x);
    // (a whole cosine, every vertex on a channel or a ridge: cut as a
    // half-cosine with flats between, the channels twisted like rope)
    const cut = PEDESTAL.fluteDeep * edge * (0.5 + 0.5 * Math.cos(n * ang));
    pos.setXYZ(i, (x / r) * (r - cut), y, (z / r) * (r - cut));
  }
  g.computeVertexNormals();
  // uv in world units, as the garden's stone takes it (its maps repeat once
  // in 26): round the shaft by arc length, and up it by height plus radius,
  // so a step's top is not one smear of a single texel row
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    uv.setXY(i, ((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * 2 * Math.PI * 4.2, pos.getY(i) + r * 0.8);
  }
  const gold = [
    new THREE.TorusGeometry(3.74, 0.17, 8, 64).rotateX(Math.PI / 2).translate(0, 13.83, 0),
    new THREE.TorusGeometry(4.53, 0.08, 6, 64).rotateX(Math.PI / 2).translate(0, 8.65, 0),
  ];
  return { stone: g, gold };
}
// The letters' places: for each ring, each glyph's angle round the shaft (the
// middle of the ring turned to `face`, an angle in the xz plane, the reader
// reading left to right from outside), its height, its size.
export function pedestalLetters(glyphs, face) {
  const track = 0.14, space = 0.55, out = [];
  PEDESTAL.text.forEach((text, k) => {
    const y = PEDESTAL.rings[k], r = shaftR(y) + 0.035;
    const span = [...text].reduce((w, ch) => w + (ch === ' ' ? space : glyphs[ch].adv + track), -track);
    // the letters as tall as the band takes, and never so wide the ring
    // runs into itself (half a letter's room left where it closes)
    const cap = Math.min(PEDESTAL.band * 0.62, (2 * Math.PI * r - 1.2) / (span + 1.4));
    let s = -span / 2;
    for (const ch of text) {
      if (ch === ' ') { s += space; continue; }
      const G = glyphs[ch];
      out.push({ ch, a: face - ((s + G.adv / 2) * cap) / r, y, r, cap });
      s += G.adv + track;
    }
  });
  return out;
}
