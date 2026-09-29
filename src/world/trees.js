// ── Trees ─────────────────────────────────────────────────────────────────────
// The garden's trees, grown rather than stood up. Each was a seven-sided post
// run up through a ball of leaf cards — from the Pavilion, a row of telephone
// poles wearing lollipops, every crown the same blob at the same height, and
// the flat cards showing as bright streaks wherever one lay edge-on to the eye.
//
// A tree now has wood: a trunk that leans and recovers, limbs that fork and
// taper, and twigs, as tubes (`Wood`) merged per patch of ground. Its leaves
// are sprays (crossed cards, effects.js) set where the wood ends, in clumps,
// so the sky shows between them and the crown has a shape to it. Every spray
// carries the clump it belongs to (`crown`: centre and radius), and the
// foliage shader turns the spray's normal out from it — so a crown is lit as
// a volume, bright on its moonward shoulder and dark under itself, instead of
// as a pile of flat planes each catching the light its own way.
//
// Six kinds, because a garden is planted:
//   broad   a vase of limbs under a crown of billows — the tree line
//   pine    black pine pruned into clouds: a leaning, twisting trunk and flat
//           pads of needles at the ends of long near-level limbs
//   maple   low, many-stemmed, its leaf held in layers, in autumn colour
//   cherry  wide, dark, spreading limbs, in flower
//   willow  a heavy trunk leaning to the water, and a dome of fine leaf with
//           a curtain of whips let fall from its rim (effects.js
//           makeHangingMaterial, kinds 4 and 5)
//   cedar   a straight spire, whorl over whorl of drooping branches — the
//           skyline
//
// What a crown costs is its lighting, not its cards: the leaves are drawn for
// depth first and lit once (effects.js, makeFoliagePrepass), so the trees
// cost a frame what the posts and blobs did (6 ms of scene at 1600 × 900 on
// the AMD iGPU, from the Pavilion). Lit in one pass they cost twice that.
// Keep clumps to two or three sprays even so: a spray packed behind another
// adds nothing to a crown's shape.
//
// Everything is in the tree's own frame — the foot of the trunk at the origin,
// y up — and drawn from the `rng` it is handed, never the world's stream.
import * as THREE from 'three';

export const LEAF = { broad: 0, maple: 1, pine: 2, blossom: 3, cedar: 4, willow: 5 };

// Bark colours, multiplied into the bark texture (textures.js, bark).
export const BARK = {
  broad: '#8a8074', pine: '#8a5f45', maple: '#8b877c', cherry: '#5a423f', willow: '#7c7266', cedar: '#8a5a40',
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
// a direction from a bearing (radians, in the xz plane) and an elevation
const heading = (bearing, elevation) => V(Math.cos(elevation) * Math.cos(bearing), Math.sin(elevation), Math.cos(elevation) * Math.sin(bearing));
const bearingOf = (d) => Math.atan2(d.z, d.x);

// Tapered tubes, indexed, with a uv for the bark (round the stem a whole
// number of times, up it by length) and a colour per vertex.
export class Wood {
  constructor(scale = 7) {
    Object.assign(this, { scale, pos: [], nor: [], uv: [], col: [], idx: [] });
  }

  // `nodes`: [{ p, r }] from the base out. `sides` round. `flare` swells the
  // foot of a trunk into buttresses.
  tube(nodes, sides, tint, { flare = 0 } = {}) {
    const n = nodes.length;
    if (n < 2) return;
    const T = [], N = [];
    for (let i = 0; i < n; i++) {
      const a = nodes[Math.max(0, i - 1)].p, b = nodes[Math.min(n - 1, i + 1)].p;
      T.push(b.clone().sub(a).normalize());
    }
    // parallel transport, so the rings do not twist round the stem
    const t0 = T[0];
    const ref = Math.abs(t0.y) < 0.9 ? UP : V(1, 0, 0);
    N.push(V().crossVectors(t0, ref).normalize());
    for (let i = 1; i < n; i++) {
      const axis = V().crossVectors(T[i - 1], T[i]);
      const s = axis.length();
      const next = N[i - 1].clone();
      if (s > 1e-6) next.applyAxisAngle(axis.divideScalar(s), Math.atan2(s, T[i - 1].dot(T[i])));
      N.push(next);
    }
    const base = this.pos.length / 3;
    const around = Math.max(1, Math.round((Math.PI * 2 * nodes[0].r) / this.scale));
    const off = V(), B = V();
    let run = 0;
    for (let i = 0; i < n; i++) {
      if (i) run += nodes[i].p.distanceTo(nodes[i - 1].p);
      B.crossVectors(T[i], N[i]);
      const { p, r } = nodes[i];
      // damp and dark at the foot, where the rain splashes the stem
      const foot = 0.62 + 0.38 * Math.min(1, Math.max(0, (p.y - 0.5) / 7));
      for (let k = 0; k <= sides; k++) {
        const th = (k / sides) * Math.PI * 2;
        off.copy(N[i]).multiplyScalar(Math.cos(th)).addScaledVector(B, Math.sin(th));
        const swell = flare && i === 0 ? 1 + flare * (0.6 + 0.4 * Math.cos(th * 5 + 1.3)) : flare && i === 1 ? 1 + flare * 0.25 : 1;
        this.pos.push(p.x + off.x * r * swell, p.y + off.y * r * swell, p.z + off.z * r * swell);
        this.nor.push(off.x, off.y, off.z);
        this.uv.push((k / sides) * around, run / this.scale);
        this.col.push(tint.r * foot, tint.g * foot, tint.b * foot);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const a = base + i * (sides + 1) + k, b = a + sides + 1;
        this.idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

// Grows a tree. `H` is its height, `S` how far its crown reaches out from the
// trunk, `lean` the bearing it leans toward (a willow to the water), `detail`
// false for one only ever seen across the garden: no twigs, fewer sprays.
// Returns the wood (added to `wood`), the sprays and, for a willow, the whips:
//   sprays  { p, s, rot, kind, shade, crown: [x, y, z, r] }
//   whips   { p, len, wide, yaw, kind, shade }
export function growTree(species, rng, wood, { H, S, lean = null, detail = true }) {
  const R = (a, b) => a + (b - a) * rng();
  const tint = new THREE.Color(BARK[species]);
  const sprays = [], whips = [];

  // A limb from `from` along `dir`: `n` segments over `len`, radius r0 to r1,
  // `steer(d, t, i)` turning it at every node.
  const grow = (from, dir, len, r0, r1, n, steer) => {
    const nodes = [];
    const p = from.clone(), d = dir.clone().normalize();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      nodes.push({ p: p.clone(), d: d.clone(), r: r0 + (r1 - r0) * Math.pow(t, 0.85) });
      if (i === n) break;
      if (steer) steer(d, t, i);
      d.normalize();
      p.addScaledVector(d, len / n);
    }
    return nodes;
  };
  // where along a limb, t from 0 to 1
  const at = (nodes, t) => {
    const f = Math.min(nodes.length - 1.0001, t * (nodes.length - 1)), i = Math.floor(f), u = f - i;
    const a = nodes[i], b = nodes[i + 1];
    return { p: a.p.clone().lerp(b.p, u), d: a.d.clone().lerp(b.d, u).normalize(), r: a.r + (b.r - a.r) * u };
  };
  const wobble = (d, amount) => { d.x += (rng() - 0.5) * amount; d.y += (rng() - 0.5) * amount * 0.6; d.z += (rng() - 0.5) * amount; };
  const end = (nodes) => nodes[nodes.length - 1];
  const sides = (r) => (r > 1.2 ? 8 : r > 0.5 ? 6 : r > 0.22 ? 5 : 4);
  const tube = (nodes, opts) => wood.tube(nodes, sides(nodes[0].r), tint, opts);

  // A clump of leaf: `count` sprays round `c`, `rc` across, flattened by
  // `flat` (1 round, 0.5 a layer). Its crown for the shader sits a little
  // below its middle, so the normals lean up: lit on top, dark beneath.
  // (Two or three to a clump, spread wide: every card drawn is paid for in
  // full wherever it overlaps another, and four packed into one clump cost
  // twice what they add to its shape.)
  const clump = (c, rc, count, kind, { flat = 1, drop = 0.35, size = 1.25 } = {}) => {
    const crown = [c.x, c.y - rc * drop, c.z, rc * 1.35];
    const turn = rng() * Math.PI * 2;
    for (let k = 0; k < count; k++) {
      const a = turn + (k / count) * Math.PI * 2 + R(-0.5, 0.5), rho = rc * (count > 1 ? R(0.35, 0.65) : R(0, 0.3));
      const up = (rng() - 0.35) * rc * 0.5 * flat;
      const w = rc * size * R(0.8, 1.1);
      sprays.push({
        p: [c.x + Math.cos(a) * rho, c.y + up, c.z + Math.sin(a) * rho],
        s: [w, w * flat, w],
        rot: [R(-0.3, 0.3), rng() * Math.PI * 2, R(-0.3, 0.3)],
        kind, crown,
      });
    }
  };

  if (species === 'broad') {
    const r0 = R(1.5, 2.2) * Math.min(1.25, H / 58);
    const trunk = grow(V(), UP, H * R(0.3, 0.4), r0, r0 * 0.72, 4, (d) => wobble(d, 0.12));
    tube(trunk, { flare: 0.45 });
    const limbs = 3 + Math.floor(rng() * 2), turn = rng() * Math.PI * 2;
    for (let l = 0; l < limbs; l++) {
      const from = at(trunk, l === limbs - 1 && limbs > 3 ? R(0.55, 0.7) : R(0.86, 1));
      const d = heading(turn + (l / limbs) * Math.PI * 2 + R(-0.4, 0.4), R(0.62, 1.05));
      const limb = grow(from.p, d, H * R(0.4, 0.52), from.r * 0.62, 0.3, 4, (dd) => { wobble(dd, 0.2); dd.y += 0.05; });
      tube(limb);
      const branches = 3;
      for (let b = 0; b < branches; b++) {
        const on = b === branches - 1 ? end(limb) : at(limb, R(0.25, 0.9));
        const bd = on.d.clone().lerp(heading(bearingOf(on.d) + R(-1, 1), R(0.1, 0.9)), R(0.4, 0.7));
        const br = grow(on.p, bd, H * R(0.16, 0.24), Math.max(0.2, on.r * 0.6), 0.12, 3, (dd) => wobble(dd, 0.3));
        tube(br);
        const tip = end(br);
        clump(tip.p.clone().addScaledVector(tip.d, 1.5), S * R(0.42, 0.52), 2, LEAF.broad, { size: 1.55 });
        const tw = at(br, R(0.4, 0.7));
        if (detail) {
          const twig = grow(tw.p, tw.d.clone().lerp(heading(rng() * 6.28, R(0, 0.8)), 0.6), H * 0.1, 0.15, 0.07, 2, (dd) => wobble(dd, 0.4));
          tube(twig);
          clump(end(twig).p, S * R(0.3, 0.38), 2, LEAF.broad, { size: 1.5 });
        } else clump(tw.p.clone().add(V(0, 2, 0)), S * R(0.32, 0.4), 2, LEAF.broad, { size: 1.5 });
      }
    }
  } else if (species === 'pine') {
    // Leans out from its foot and comes back up: an S.
    const lb = lean ?? rng() * Math.PI * 2, r0 = R(1.6, 2.3) * Math.min(1.2, H / 52);
    const side = heading(lb + Math.PI / 2, 0), phase = rng() * 6.28;
    const trunk = grow(V(), heading(lb, Math.PI / 2 - R(0.3, 0.55)), H * 1.02, r0, 0.45, 9, (d, t) => {
      d.y += t > 0.3 ? 0.13 : -0.02;
      d.addScaledVector(side, Math.sin(t * 7 + phase) * 0.1);
      wobble(d, 0.14);
    });
    tube(trunk, { flare: 0.4 });
    const top = end(trunk);
    // the pads: level clouds at the ends of the limbs, smaller up the tree
    const pad = (c, rp) => {
      // A cloud of small sprays, level beneath and domed over: a ring round
      // the middle and a few heaped on top. (One broad card through the middle
      // was a smeared disc from anywhere below it.)
      const crown = [c.x, c.y - rp * 0.6, c.z, rp * 1.4];
      const ring = detail ? 4 : 3;
      for (let k = 0; k < ring; k++) {
        const a = (k / ring) * Math.PI * 2 + rng() * 0.6, d = rp * R(0.42, 0.62);
        const w = rp * R(0.95, 1.2);
        sprays.push({ p: [c.x + Math.cos(a) * d, c.y + rp * R(-0.08, 0.08), c.z + Math.sin(a) * d], s: [w, w * 0.62, w], rot: [R(-0.12, 0.12), rng() * 6.28, R(-0.12, 0.12)], kind: LEAF.pine, crown });
      }
      for (let k = 0; k < 1; k++) {
        const a = rng() * 6.28, d = rp * R(0, 0.3), w = rp * R(0.85, 1.05);
        sprays.push({ p: [c.x + Math.cos(a) * d, c.y + rp * R(0.22, 0.34), c.z + Math.sin(a) * d], s: [w, w * 0.62, w], rot: [R(-0.1, 0.1), rng() * 6.28, R(-0.1, 0.1)], kind: LEAF.pine, crown });
      }
    };
    const limbs = 5 + Math.floor(rng() * 3);
    let bearing = lb + Math.PI + R(-0.8, 0.8);
    const heights = Array.from({ length: limbs }, () => R(0.3, 0.9)).sort((a, b) => a - b);
    for (const t of heights) {
      bearing += 2.4 + R(-0.5, 0.5);
      const from = at(trunk, t);
      const len = H * R(0.26, 0.42) * (1.2 - t * 0.6);
      // angular, as black pine limbs are: down, up, down, and the tip lifted
      const limb = grow(from.p, heading(bearing, R(-0.12, 0.2)), len, Math.max(0.3, from.r * 0.5), 0.16, 5, (d, tt, i) => {
        d.y += i === 4 ? 0.35 : (i % 2 ? 0.2 : -0.22) * rng();
        wobble(d, 0.18);
      });
      tube(limb);
      const rp = R(5.5, 8.5) * (1.15 - t * 0.45) * Math.min(1.3, H / 50);
      pad(end(limb).p.clone().add(V(0, rp * 0.2, 0)), rp);
      if (detail && rng() < 0.7) {
        const on = at(limb, R(0.45, 0.75));
        const sub = grow(on.p, heading(bearingOf(on.d) + (rng() < 0.5 ? -1 : 1) * R(0.6, 1.1), R(0, 0.25)), len * R(0.35, 0.5), 0.16, 0.1, 2, (d) => wobble(d, 0.2));
        tube(sub);
        pad(end(sub).p.clone().add(V(0, rp * 0.15, 0)), rp * R(0.55, 0.7));
      }
    }
    pad(top.p.clone().add(V(0, 1, 0)), R(5, 7) * Math.min(1.3, H / 50));
  } else if (species === 'maple') {
    const r0 = R(1.0, 1.5) * Math.min(1.2, H / 36);
    const trunk = grow(V(), heading(rng() * 6.28, Math.PI / 2 - R(0, 0.15)), H * R(0.14, 0.22), r0, r0 * 0.8, 2, (d) => wobble(d, 0.1));
    tube(trunk, { flare: 0.35 });
    const stems = 3 + Math.floor(rng() * 2), turn = rng() * 6.28;
    for (let s = 0; s < stems; s++) {
      const from = at(trunk, R(0.7, 1));
      const stem = grow(from.p, heading(turn + (s / stems) * 6.28 + R(-0.4, 0.4), R(0.75, 1.1)), H * R(0.55, 0.72), from.r * 0.62, 0.22, 5, (d) => {
        wobble(d, 0.3);
        d.y -= 0.05;
      });
      tube(stem);
      const branches = detail ? 4 : 3;
      for (let b = 0; b < branches; b++) {
        const on = b === branches - 1 ? end(stem) : at(stem, R(0.3, 0.95));
        // near level, and out: the layers a maple holds its leaf in
        const bd = heading(bearingOf(on.d) + R(-1.1, 1.1), R(-0.05, 0.3));
        const reach = Math.min(S * R(0.35, 0.55), S * 0.8);
        const br = grow(on.p, bd, reach, Math.max(0.12, on.r * 0.55), 0.07, 3, (d) => { wobble(d, 0.3); d.y *= 0.7; });
        tube(br);
        const tip = end(br), mid = at(br, 0.55);
        clump(tip.p, S * R(0.26, 0.34), 2, LEAF.maple, { flat: 0.55, drop: 0.25, size: 1.5 });
        clump(mid.p.clone().add(V(0, 1.2, 0)), S * R(0.2, 0.26), 1, LEAF.maple, { flat: 0.55, drop: 0.25, size: 1.6 });
      }
    }
  } else if (species === 'cherry') {
    const r0 = R(1.6, 2.2) * Math.min(1.2, H / 40);
    const trunk = grow(V(), heading(rng() * 6.28, Math.PI / 2 - R(0.05, 0.2)), H * R(0.26, 0.34), r0, r0 * 0.75, 3, (d) => wobble(d, 0.14));
    tube(trunk, { flare: 0.5 });
    const limbs = 3 + Math.floor(rng() * 2), turn = rng() * 6.28;
    for (let l = 0; l < limbs; l++) {
      const from = at(trunk, R(0.8, 1));
      // wide and spreading, the ends drooping under the weight of flower
      const limb = grow(from.p, heading(turn + (l / limbs) * 6.28 + R(-0.35, 0.35), R(0.45, 0.8)), S * R(0.85, 1.1), from.r * 0.66, 0.2, 5, (d, t) => {
        wobble(d, 0.22);
        if (t > 0.4) d.y -= 0.09;
      });
      tube(limb);
      const branches = 3;
      for (let b = 0; b < branches; b++) {
        const on = b === branches - 1 ? end(limb) : at(limb, R(0.3, 0.95));
        const bd = on.d.clone().lerp(heading(bearingOf(on.d) + R(-1.2, 1.2), R(-0.1, 0.7)), 0.55);
        const br = grow(on.p, bd, S * R(0.3, 0.45), Math.max(0.14, on.r * 0.6), 0.08, 3, (d) => wobble(d, 0.35));
        tube(br);
        clump(end(br).p, S * R(0.3, 0.38), 2, LEAF.blossom, { flat: 0.8, size: 1.45 });
        clump(at(br, 0.45).p.clone().add(V(0, 1, 0)), S * R(0.22, 0.28), 1, LEAF.blossom, { flat: 0.8, size: 1.6 });
      }
    }
  } else if (species === 'willow') {
    // A dome, and a curtain let down from it. The limbs rise from a short,
    // heavy trunk and arch over; what the eye sees is the dome they make — a
    // crown of fine leaf over the top, and whips falling from all round its
    // rim nearly to the grass, shorter further in. (Hung from the limbs
    // alone, the whips came down as a few flat banners from bare sticks.)
    const lb = lean ?? rng() * 6.28, r0 = R(2.2, 3.0) * Math.min(1.2, H / 62);
    const trunk = grow(V(), heading(lb, Math.PI / 2 - R(0.12, 0.3)), H * R(0.32, 0.4), r0, r0 * 0.7, 4, (d) => { wobble(d, 0.12); d.y += 0.04; });
    tube(trunk, { flare: 0.55 });
    const c = end(trunk).p;
    const eave = H * R(0.52, 0.6), Rd = S;
    // the dome over the trunk's head: a point on it `f` of the way out
    const dome = (a, f) => V(c.x + Math.cos(a) * f * Rd, eave + (H - eave) * Math.sqrt(Math.max(0, 1 - f * f)), c.z + Math.sin(a) * f * Rd);
    const limbs = 5 + Math.floor(rng() * 2), turn = rng() * 6.28;
    for (let l = 0; l < limbs; l++) {
      const a = turn + (l / limbs) * 6.28 + R(-0.35, 0.35);
      const from = at(trunk, R(0.8, 1));
      // up and out toward the dome's shoulder, then over
      const limb = grow(from.p, heading(a, R(0.9, 1.2)), H * R(0.42, 0.52), from.r * 0.6, 0.2, 5, (d, t) => {
        wobble(d, 0.1);
        if (t > 0.45) d.y -= 0.14;
      });
      tube(limb);
      for (let b = 0; b < 2; b++) {
        const on = at(limb, R(0.4, 0.9));
        const br = grow(on.p, on.d.clone().lerp(heading(a + R(-0.9, 0.9), R(0.2, 0.7)), 0.5), H * R(0.18, 0.26), Math.max(0.12, on.r * 0.55), 0.07, 3, (d) => { wobble(d, 0.2); d.y -= 0.2; });
        tube(br);
      }
    }
    // the crown: fine leaf laid over the dome, lit as one
    const crown = [c.x, eave - 6, c.z, Rd + 8];
    const heads = detail ? 15 : 10;
    for (let k = 0; k < heads; k++) {
      const f = Math.sqrt(rng()) * 0.96, q = dome(rng() * 6.28, f);
      const w = R(15, 21) * Math.min(1.2, H / 60);
      sprays.push({ p: [q.x, q.y - 3.5, q.z], s: [w, w * 0.85, w], rot: [R(-0.3, 0.3), rng() * 6.28, R(-0.3, 0.3)], kind: LEAF.willow, crown });
    }
    // the curtain: longest round the rim, where it nearly reaches the grass
    const whip = (f, bottom) => {
      const q = dome(rng() * 6.28, f);
      const len = q.y - 1.5 - bottom;
      if (len > 5) whips.push({ p: [q.x, q.y - 1.5, q.z], len, wide: R(2.2, 3.4), yaw: rng() * Math.PI, kind: 4 + Math.floor(rng() * 2) });
    };
    for (let k = 0; k < (detail ? 56 : 34); k++) whip(R(0.8, 1), R(3, 11));
    for (let k = 0; k < (detail ? 22 : 12); k++) whip(R(0.5, 0.8), R(10, 24));
    for (let k = 0; k < (detail ? 8 : 4); k++) whip(R(0.1, 0.5), H - R(10, 18));
  } else if (species === 'cedar') {
    const r0 = R(1.8, 2.6) * Math.min(1.25, H / 110);
    const trunk = grow(V(), UP, H, r0, 0.3, 9, (d) => wobble(d, 0.04));
    tube(trunk, { flare: 0.5 });
    let y = H * R(0.2, 0.3), turn = rng() * 6.28;
    while (y < H * 0.95) {
      const t = y / H, on = at(trunk, t);
      const reach = S * Math.pow(1 - t, 0.85) * R(0.8, 1.1) + 2.5;
      const per = 3;
      turn += R(0.6, 1.4);
      for (let k = 0; k < per; k++) {
        // out, drooping, and the tip turned up
        const br = grow(on.p, heading(turn + (k / per) * 6.28 + R(-0.3, 0.3), R(-0.45, -0.05)), reach, Math.max(0.12, on.r * 0.3), 0.06, 2, (d, tt, i) => { if (i === 1) d.y += 0.35; wobble(d, 0.15); });
        if (detail || reach > 6) tube(br);
        const tip = end(br), mid = at(br, 0.5);
        // big enough that a whorl's sprays reach the next one up: a cone of
        // leaf, not a stack of plates
        const w = Math.max(7, reach * 1.15);
        const crown = [on.p.x, on.p.y - 2, on.p.z, reach + 5];
        sprays.push({ p: [mid.p.x, mid.p.y + R(-1, 1.5), mid.p.z], s: [w, w * R(0.75, 0.95), w], rot: [R(-0.35, 0.35), rng() * 6.28, R(-0.35, 0.35)], kind: LEAF.cedar, crown });
        if (reach > 12) sprays.push({ p: [tip.p.x, tip.p.y + R(-1, 1), tip.p.z], s: [w * 0.7, w * 0.6, w * 0.7], rot: [R(-0.3, 0.3), rng() * 6.28, R(-0.3, 0.3)], kind: LEAF.cedar, crown });
      }
      // and leaf in close round the stem, dark, so the cone is solid at its heart
      if (rng() < 0.3) {
        const w = Math.max(6, reach * 0.9);
        sprays.push({ p: [on.p.x, on.p.y + 1, on.p.z], s: [w, w * 0.9, w], rot: [R(-0.2, 0.2), rng() * 6.28, R(-0.2, 0.2)], kind: LEAF.cedar, crown: [on.p.x, on.p.y, on.p.z, reach + 5] });
      }
      y += R(6, 9) * Math.min(1.2, H / 110);
    }
    const tip = end(trunk).p;
    for (let k = 0; k < 2; k++) sprays.push({ p: [tip.x, tip.y - k * 3, tip.z], s: [6 - k, 7, 6 - k], rot: [0, rng() * 6.28, 0], kind: LEAF.cedar, crown: [tip.x, tip.y - 6, tip.z, 9] });
  }

  // Shade: a crown is dark low down and in, where the rest of it stands
  // between a spray and the sky, and lit at the top and the rim.
  if (sprays.length) {
    let lo = Infinity, hi = -Infinity;
    for (const s of sprays) { lo = Math.min(lo, s.p[1]); hi = Math.max(hi, s.p[1]); }
    for (const s of sprays) {
      const up = hi > lo ? (s.p[1] - lo) / (hi - lo) : 1;
      const out = Math.min(1, Math.hypot(s.p[0], s.p[2]) / Math.max(4, S));
      s.shade = 0.5 + 0.38 * up + 0.2 * out;
    }
  }
  for (const w of whips) w.shade = 0.8 + 0.25 * rng();
  return { sprays, whips };
}
