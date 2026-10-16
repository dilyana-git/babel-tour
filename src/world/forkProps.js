// The Fork's details: the moon, the stand, the raked gravel and the stones
// along the ways, the waymark, the tōrō, the hedge, the cherries, the lawn
// and the pebbled bank.
import { makeRng } from './textures';
import { FORK_VIEW } from './gardenPlan';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
export const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// The moon (sky.js): `k` how bright its highlands are, `seas` how much
// darker its seas, `limb` how much it darkens to its edge, `halo` the corona.
export const MOON = { k: qn('wmoonk2', 1.1), seas: qn('wmoonseas', 0.34), limb: qn('wmoonlimb', 0.4), halo: qn('wmoonhalo', 0.45) };

// The stone the ways part at (shore.js `gardenRock`, a stone to step on):
// `w` by `d` across and `h` deep, `proud` of it over the gravel (under a
// tread's height, and under what the body calls a crest: it is walked over),
// turned by `turn` so that it lies across the view from the stand.
export const FORK_STONE = {
  rock: { w: qn('wfstw', 6.6), h: 2.0, d: qn('wfstd', 4.5), seed: qn('wfstseed', 3371), round: 0.62, cuts: 4, moss: 0.55, lichen: 0.9, tone: 1.12, warm: 0.3 },
  proud: qn('wfstup', 0.85), turn: qn('wfstturn', -1.05),
};

// The cherries at night: the tints their sprays are multiplied by (the
// flowers' own pink is in the atlas: these take the colour out of it and the
// brightness down), the share of sprays left off, and how dark a spray in the
// underside of its crown is beside one on top.
export const BLOSSOM_NIGHT = {
  tints: ['#7f8684', '#8a8d88', '#787f80', '#84847f'],
  drop: qn('wblossomdrop', 0.33), under: qn('wblossomunder', 0.4),
};

// The hedges. A clipped finial is a drum of the same hedge, domed, grown
// through the hedge's line and standing `up` over its top: `r` its radius.
// On the hedge that closes the garden they stand at its turns (`turn`) and
// once along each long run between (`run`); on the maze, either side of its
// mouth and at its four corners (`mouth`). `HEDGE_SHEEN`: the moon on a
// hedge's shoulder and top, `k` of it, from `near` to `far` off — close to,
// a pale band along every top was the first thing wrong with the maze.
export const FINIALS = {
  turn: { r: 7.2, up: qn('wfinialup', 9) }, run: { r: 6.2, up: qn('wfinialup', 9) * 0.6 }, mouth: { r: 6, up: 7.5 },
  longRun: 95,
};
export const HEDGE_SHEEN = { k: qn('whedgesheen', 0.8), near: 70, far: 240 };

// The lawn's blades (lawn.js): how far round a lantern they grow and how
// much of its light they take (`toro`, the stone lanterns; `waymark`, the
// iron one under the waymark's arm), how thick, how tall (a unit is 9.4 cm),
// and how far up from the water the pond's bank keeps them off.
export const LAWN = {
  toro: { reach: qn('wlawnreach', 36), k: qn('wlawnk', 1.2) }, waymark: { reach: 26, k: qn('wlawnk', 1.2) * 0.5 },
  density: qn('wlawndensity', 1), height: qn('wlawnh', 0.62), bank: 13,
};

// The Pavilion's roof (pavilionRoof.js): which dressing — 'grey', tile in
// rolls; 'green', the same glazed; 'bark', shingle without rolls.
export const ROOF_KIND = ['grey', 'green', 'bark'].includes(Q.get('wroof')) ? Q.get('wroof') : 'grey';

// The stand: `back` from the Fork's stone along the pergola's line (at its
// last frame, under the ends of its rafters, which are over the reader's head
// and out of the frame), `side` across it (to the walker's left, negative),
// looking out on bearing `yaw` with the eye `pitch` degrees down. From there
// the stone is in the bottom of the frame with the ways parting at it — the
// one to the bridge running off left to the Pavilion, the road to the Heart
// off right to the two lanterns at the maze's mouth — and the moon, which
// hangs over the Pavilion at seventeen degrees, is in the sky with room
// above it. (Much further down and its top is cut off by the frame again.)
export const STAND = { back: qn('wfback', 28), side: qn('wfside', -5), yaw: qn('wfyaw', FORK_VIEW.yaw), pitch: qn('wfpitch', -5) };

// The waymark: where it stands, by bearing and distance from the Fork's
// stone — out in the lawn between the two ways, where they have parted, so
// it is where the fork is and not in front of it (in the near corner, by the
// road to the Heart, it stood over the lanterns at that road's end) — and
// which way its lantern's bracket reaches: to the left, clear of the boards
// and of the lantern behind it, over the lawn's edge by the way to the bridge.
// The Pavilion's board goes up over the bracket (`boards`: the heights of
// THE PAVILION and THE HEART), where the lantern hung across its name.
export const WAYMARK = {
  bearing: qn('wfpostb', FORK_VIEW.postBearing), dist: qn('wfpostd', FORK_VIEW.postDistance), arm: qn('wfarm', 252),
  // a squared timber post, tapering a little, weathered dark
  post: { r0: 0.95, r1: 0.82, top: 28.2 },
  boards: [qn('wfboard1', 26.4), qn('wfboard2', 17.9)],
  color: Q.get('wfpostc') ? `#${Q.get('wfpostc')}` : '#7a6754',
};

// The rake. The furrows' dark and the pale lip of gravel thrown up beside
// each were 0.3 and 0.13 — a lip of unlit grey on gravel the moon barely
// reaches, so every groove was a white line. `dark`, `lit`: their strength
// now. A rake has four tines, so the furrows go in fours: each pass wanders
// (`wob`, across) and the passes drift apart and together (`drift`, the
// fraction their spacing changes by); and a furrow stops short of a stone
// (`clear`, beyond the stone's own reach) and now and then where it was
// scuffed out (`scuff`: one in that many paces).
export const RAKE = {
  dark: qn('wfrdark', 0.15), lit: qn('wfrlit', 0.035), wob: qn('wfrwob', 0.32), drift: qn('wfrdrift', 0.18),
  clear: 0.7, scuff: 45,
};
const TINES = 4;
// The offset across the way of furrow `k` (nominal `o`) of way `wi`, `s` along it.
export const rakeOffset = (k, o, s, wi) => {
  const pass = Math.floor(k / TINES) + wi * 7;
  const h = (n) => { const x = Math.sin((pass * 12.9898 + n * 78.233) * 1.37) * 43758.5453; return x - Math.floor(x); };
  const wander = RAKE.wob * (0.65 * Math.sin(s / (9 + 6 * h(1)) + 6.28 * h(2)) + 0.35 * Math.sin(s / (3.5 + 2 * h(3)) + 6.28 * h(4)));
  const spread = 1 + RAKE.drift * Math.sin(s / (17 + 10 * h(5)) + 6.28 * h(6));
  // (and each tine a hair off true)
  const tine = 0.05 * Math.sin(s / 2.3 + k * 1.7);
  return o * spread + wander + tine;
};
// Where along a furrow it has been scuffed out: [from, to] runs of `s`.
export const rakeScuffs = (k, wi, length) => {
  const r = makeRng(4400 + wi * 101 + k * 7), out = [];
  for (let s = r() * RAKE.scuff; s < length; s += RAKE.scuff * (0.5 + r())) out.push([s, s + 1 + 2.5 * r()]);
  return out;
};

// The stones along a way: in groups, not one every seven paces. Each group
// is a lead stone (now and then a big one, and now and then sunk to half its
// height) with nought to three smaller set against it, mostly on its outer
// side; gaps between of five to sixteen paces (twice that on a way less
// walked). Sizes run three to one. `ok(p, r)`: whether a stone of reach r may
// sit at p. Returns rocks as buildWorld's `rocks` hold them, flagged `edge`.
// (Where a way comes to the water its edge is the pond's kerb, shore.js's:
// set in groups the same way there, pondShore's `kerbVary`.)
const TONES = ['#5f5b55', '#4e4b46', '#6b665f'];
export const edgeStones = (pts, w, seed, { sparse = false, ok = () => true } = {}) => {
  const r = makeRng(seed), R = (a, b) => a + (b - a) * r();
  const segs = pts.slice(1).map((b, i) => {
    const a = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { a, t: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], L };
  });
  const total = segs.reduce((s, q) => s + q.L, 0);
  const frame = (s) => {
    let u = s;
    for (const q of segs) {
      if (u <= q.L) return { p: [q.a[0] + q.t[0] * u, q.a[1] + q.t[1] * u], t: q.t };
      u -= q.L;
    }
    const q = segs[segs.length - 1];
    return { p: [q.a[0] + q.t[0] * q.L, q.a[1] + q.t[1] * q.L], t: q.t };
  };
  const out = [];
  const put = (s, across, k, flat, sink) => {
    if (s < 0 || s > total) return;
    const { p, t } = frame(s), n = [-t[1], t[0]];
    const q = [p[0] + n[0] * across, p[1] + n[1] * across];
    const sx = k * R(0.85, 1.2), sz = k * R(0.75, 1.1), sy = k * flat;
    if (!ok(q, Math.max(sx, sz) * 0.6)) return;
    out.push({
      p: [q[0], 5 - sy * sink, q[1]], rot: [R(-0.6, 0.6), R(0, 6.28), R(-0.6, 0.6)], s: [sx, sy, sz],
      color: TONES[Math.floor(r() * 3)], edge: true,
    });
  };
  for (const side of [-1, 1]) {
    let s = R(0, 8);
    while (s < total) {
      const big = r() < 0.2, sunk = r() < 0.3;
      const k = big ? R(2.6, 3.4) : R(1.4, 2.4);
      // the lead: set in the way's edge, a big one further into the gravel
      const across = side * (w / 2 + R(-0.4, 1.2) - (big ? 0.6 : 0));
      put(s, across, k, R(0.55, 0.8), sunk ? R(0.25, 0.45) : R(0, 0.12));
      let reach = k * 0.55;
      for (let c = 0, n = r() < 0.2 ? 0 : 1 + Math.floor(r() * 3); c < n; c++) {
        const kc = k * R(0.3, 0.6), dir = r() < 0.5 ? -1 : 1;
        const along = dir * (k * 0.45 + kc * 0.4) * R(0.75, 1.05);
        put(s + along, across + side * R(-0.3, 1.4) * k * 0.4, kc, R(0.5, 0.85), r() < 0.35 ? R(0.2, 0.4) : 0);
        reach = Math.max(reach, Math.abs(along) + kc * 0.5);
      }
      s += reach + R(5, 16) * (sparse ? 2 : 1);
    }
  }
  return out;
};

// The pebbled bank round the pond (shore.js): how far up from the water it
// comes was its kind's width ±25% every pace or so — at any distance, one
// even band. Now slowly much wider and much narrower, and gone altogether
// in places (grass or dark earth to the water). See pondShore's `bankVary`.
export const BANK_VARY = true;
