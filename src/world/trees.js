// ── Trees ─────────────────────────────────────────────────────────────────────
// The garden's trees have trunks that lean and recover, curved limbs that
// fork and taper, and fine twigs. Their tubes (`Wood`) are merged per patch
// of ground; their growth skeletons keep leaf and planting streams stable.
// The leaves
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
import { makeRng } from './textures.js';
import { TreeCurve } from './treeCurve.js';

export const LEAF = { broad: 0, maple: 1, pine: 2, blossom: 3, cedar: 4, willow: 5 };

// A cherry's flower: the tints its sprays are multiplied by, near white with
// a trace of blush (the atlas's flower is pale and all but neutral), and how
// soft the cut round it is, in alpha (effects.js, `blossom`).
export const BLOSSOM = { tints: ['#c6b2aa', '#bfaca6', '#cab4ab', '#bba8a4'], soft: 0.34 };

// Bark colours, multiplied into the bark texture (textures.js, bark).
export const BARK = {
  broad: '#8a8074', pine: '#8a5f45', maple: '#8b877c', cherry: '#5a423f', willow: '#7c7266', cedar: '#8a5a40',
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
// a direction from a bearing (radians, in the xz plane) and an elevation
const heading = (bearing, elevation) => V(Math.cos(elevation) * Math.cos(bearing), Math.sin(elevation), Math.cos(elevation) * Math.sin(bearing));
const bearingOf = (d) => Math.atan2(d.z, d.x);
const NO_WOOD = { tube() {}, finish() {} };

// Tapered tubes, indexed, with a uv for the bark (round the stem a whole
// number of times, up it by length) and a colour per vertex.
export class Wood {
  constructor(scale = 7) {
    Object.assign(this, { scale, pos: [], nor: [], uv: [], col: [], idx: [] });
  }

  // `nodes`: [{ p, r }] from the base out. `sides` round. `flare` swells the
  // foot of a trunk into buttresses. `ribs` ({ n, deep, spin }): sinews along
  // it, `n` round, turning about the stem as they go, dark between.
  tube(nodes, sides, tint, { flare = 0, ribs = null, flareLength = null, organic = false } = {}) {
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
    const off = V(), B = V(), across = V(), surfaceNormal = V();
    const rings = Array.from({ length: sides + 1 }, (_, k) => {
      const th = (k / sides) * Math.PI * 2;
      return { th, cos: Math.cos(th), sin: Math.sin(th), rootCos: Math.cos(th * 5 + 1.3), rootSin: Math.sin(th * 5 + 1.3) };
    });
    let run = 0;
    for (let i = 0; i < n; i++) {
      if (i) run += nodes[i].p.distanceTo(nodes[i - 1].p);
      B.crossVectors(T[i], N[i]);
      const { p, r } = nodes[i];
      const before = nodes[Math.max(0, i - 1)], after = nodes[Math.min(n - 1, i + 1)];
      const slope = organic ? (after.r - before.r) / Math.max(1e-6, after.p.distanceTo(before.p)) : 0;
      // damp and dark at the foot, where the rain splashes the stem
      const foot = 0.62 + 0.38 * Math.min(1, Math.max(0, (p.y - 0.5) / 7));
      const buttress = flareLength === null ? (i === 0 ? 1 : i === 1 ? 0.25 : 0) : Math.exp(-3 * run / flareLength);
      for (let k = 0; k <= sides; k++) {
        const { th, cos, sin, rootCos, rootSin } = rings[k];
        off.copy(N[i]).multiplyScalar(cos).addScaledVector(B, sin);
        const rib = ribs ? Math.cos(ribs.n * th + ribs.spin * run) : 0;
        const root = flareLength === null && i === 1 ? 1 + flare * 0.25 : 1 + flare * buttress * (0.6 + 0.4 * rootCos);
        const swell = root * (1 + (ribs ? ribs.deep * rib : 0));
        const shade = foot * (ribs ? 0.66 + 0.34 * (0.5 + 0.5 * rib) : 1);
        this.pos.push(p.x + off.x * r * swell, p.y + off.y * r * swell, p.z + off.z * r * swell);
        let normal = off;
        if (organic) {
          const rootSlope = flareLength ? -3 * r * (root - 1) / flareLength : 0;
          across.copy(N[i]).multiplyScalar(-sin).addScaledVector(B, cos);
          normal = surfaceNormal.copy(off).addScaledVector(T[i], -(slope * swell + rootSlope))
            .addScaledVector(across, 2 * flare * buttress * rootSin / swell).normalize();
        }
        this.nor.push(normal.x, normal.y, normal.z);
        this.uv.push((k / sides) * around, run / this.scale);
        this.col.push(tint.r * shade, tint.g * shade, tint.b * shade);
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

// Refine the wood after the growth skeleton is complete. The skeleton still
// owns every attachment and leaf position; this independent stream shapes the
// wood between them without spending any planting or leaf-colour draws.
class TreeWood {
  constructor(wood, species, detail) {
    Object.assign(this, { wood, species, detail, limbs: [] });
  }

  tube(nodes, sides, tint, opts = {}) {
    if (nodes.length < 2) return;
    const paths = (opts.source ? [opts.source, nodes] : [nodes]).map((path) => {
      const bounds = new THREE.Box3().setFromPoints(path.map((n) => n.p)).expandByScalar(0.01);
      return { nodes: path, bounds };
    });
    this.limbs.push({ nodes, sides, tint, opts, paths, children: [] });
  }

  finish() {
    const { wood, species, detail, limbs } = this;
    const smooth = (t) => t * t * (3 - 2 * t);
    const closest = (nodes, p) => {
      let distance = Infinity, at = 0, radius = 0;
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i], b = nodes[i + 1];
        const x = b.p.x - a.p.x, y = b.p.y - a.p.y, z = b.p.z - a.p.z;
        const t = THREE.MathUtils.clamp(((p.x - a.p.x) * x + (p.y - a.p.y) * y + (p.z - a.p.z) * z) / Math.max(1e-8, x * x + y * y + z * z), 0, 1);
        const dx = a.p.x + x * t - p.x, dy = a.p.y + y * t - p.y, dz = a.p.z + z * t - p.z;
        const gap = dx * dx + dy * dy + dz * dz;
        if (gap < distance) { distance = gap; at = (i + t) / (nodes.length - 1); radius = a.r + (b.r - a.r) * t; }
      }
      return { distance, at, radius };
    };
    for (const [index, limb] of limbs.entries()) {
      const start = limb.nodes[0], finish = limb.nodes.at(-1);
      // The seed comes from this limb's established geometry, never its place
      // in a draw stream. Every specimen keeps the same detail on each build.
      const seed = 0x68bc21eb ^ Math.round(start.p.x * 8192) ^ Math.round(start.p.y * 32768)
        ^ Math.round(start.p.z * 131072) ^ Math.round(finish.p.x * 524288) ^ Math.round(finish.p.z * 2048);
      const rng = makeRng(seed), range = (a, b) => a + (b - a) * rng();
      let parent = null, match = { distance: 1e-4, radius: 0 };
      for (let j = 0; j < index; j++) {
        const candidate = limbs[j];
        for (const path of candidate.paths) {
          if (!path.bounds.containsPoint(start.p)) continue;
          const hit = closest(path.nodes, start.p);
          if (hit.at < 0.04 || hit.radius < start.r * 0.55) continue;
          if (hit.distance < match.distance - 1e-10 || (Math.abs(hit.distance - match.distance) < 1e-10 && hit.radius > match.radius)) {
            parent = candidate; match = hit;
          }
        }
      }
      if (parent) { parent.children.push({ limb, at: match.at }); limb.parent = parent; }
      const curve = new TreeCurve(limb.nodes.map((n) => n.p));
      const length = curve.getLength(), axis = finish.p.clone().sub(start.p).normalize();
      const side = V().crossVectors(axis, UP);
      if (side.lengthSq() < 0.01) side.copy(heading(range(0, Math.PI * 2), 0));
      else side.normalize();
      const lift = UP.clone().addScaledVector(axis, -axis.y).normalize();
      const phase = range(-0.65, 0.65), sway = range(0.028, 0.055) * length;
      const weight = { broad: 0.05, pine: -0.06, maple: -0.015, cherry: -0.05, willow: -0.075, cedar: -0.045 }[species];
      const bow = length * weight * range(0.8, 1.2);
      const shift = parent ? parent.point(match.at).sub(start.p) : V();
      const enter = curve.getTangent(0);
      const tangent = parent ? enter.clone().lerp(parent.tangent(match.at), species === 'pine' || species === 'cedar' ? 0.32 : 0.65).normalize() : enter;
      const shoulder = tangent.sub(enter).multiplyScalar(length);
      limb.point = (t) => {
        const envelope = Math.sin(Math.PI * t) ** 2;
        return curve.getPoint(t)
          .addScaledVector(shift, 1 - smooth(Math.min(1, t / 0.55)))
          .addScaledVector(shoulder, t * (1 - t) ** 3)
          .addScaledVector(side, sway * envelope * Math.sin(Math.PI * t + phase))
          .addScaledVector(lift, bow * envelope);
      };
      limb.tangent = (t) => limb.point(Math.min(1, t + 0.001)).sub(limb.point(Math.max(0, t - 0.001))).normalize();
      Object.assign(limb, { length, rng, side });
    }
    for (const limb of limbs) {
      const { nodes, length, tint, opts, rng, side, children } = limb;
      const r0 = nodes[0].r, originalTip = nodes.at(-1).r;
      const continuing = children.some(({ at }) => at > 0.93);
      const r1 = continuing ? originalTip : Math.min(originalTip, r0 > 0.8 ? 0.075 : 0.025);
      const collar = limb.parent ? Math.min(0.18, r0 / Math.max(0.1, limb.parent.nodes[0].r) * 0.25) : 0;
      const radius = (t) => (r0 + (r1 - r0) * t ** 0.82) * (1 + collar * Math.exp(-14 * t));
      const segments = Math.max(nodes.length - 1, Math.min(24, Math.max(5, Math.ceil(length / (r0 > 0.7 ? 2 : 1.6)))));
      const refined = Array.from({ length: segments + 1 }, (_, i) => ({ p: limb.point(i / segments), r: radius(i / segments) }));
      const sides = Math.max(limb.sides, r0 > 1.2 ? 12 : r0 > 0.5 ? 10 : r0 > 0.16 ? 8 : 5);
      wood.tube(refined, sides, tint, { ...opts, organic: true, flareLength: opts.flare ? Math.min(9, length * 0.45) : null });

      // Short unequal forks finish exposed branch tips beneath their existing
      // leaf clusters. They taper to fine points rather than ending as rods.
      if (!detail || species === 'cedar' || children.length || length < 5 || r0 < 0.12 || r0 > 0.85) continue;
      for (const sign of [-1, 1]) {
        const t = 0.68 + rng() * 0.16, p = limb.point(t), forward = limb.tangent(t);
        const reach = Math.min(4.5, length * (0.18 + rng() * 0.09));
        const dir = forward.clone().addScaledVector(side, sign * (0.45 + rng() * 0.35)).addScaledVector(UP, species === 'willow' ? -0.35 : 0.2).normalize();
        const tip = p.clone().addScaledVector(dir, reach);
        const twig = new THREE.CubicBezierCurve3(p, p.clone().addScaledVector(forward, reach * 0.45), tip.clone().addScaledVector(dir, -reach * 0.3).addScaledVector(UP, -reach * 0.12), tip);
        const thick = Math.min(0.09, radius(t) * 0.48);
        wood.tube(Array.from({ length: 6 }, (_, i) => ({ p: twig.getPoint(i / 5), r: thick + (0.012 - thick) * (i / 5) ** 0.8 })), 5, tint, { organic: true });
      }
    }
  }
}

// A maple divides into curved leaders, then smaller limbs and fine forks.
// Cubic centre lines keep the tangent continuous along each limb; a side
// branch starts toward its parent's tangent before opening out into the crown.
function mapleWood(rng, wood, { H, S, r0, leaders, detail }) {
  const R = (a, b) => a + (b - a) * rng();
  const sprays = [], tint = new THREE.Color(BARK.maple);
  const limb = (start, finish, enter, leave, r0, r1, flare = 0) => {
    const length = start.distanceTo(finish);
    const curve = new THREE.CubicBezierCurve3(start, start.clone().addScaledVector(enter, length * 0.32),
      finish.clone().addScaledVector(leave, -length * 0.28), finish);
    const segments = r0 < 0.25 ? 5 : 12;
    const nodes = Array.from({ length: segments + 1 }, (_, i) => {
      const t = i / segments;
      return { p: curve.getPoint(t), d: curve.getTangent(t), r: r0 + (r1 - r0) * Math.pow(t, 0.8) };
    });
    wood.tube(nodes, r0 > 0.9 ? 8 : r0 > 0.25 ? 6 : 5, tint, { flare });
    return nodes;
  };
  const along = (nodes, t) => {
    const f = Math.min(nodes.length - 1.0001, t * (nodes.length - 1)), i = Math.floor(f), u = f - i;
    const a = nodes[i], b = nodes[i + 1];
    return { p: a.p.clone().lerp(b.p, u), d: a.d.clone().lerp(b.d, u).normalize(), r: a.r + (b.r - a.r) * u };
  };
  const leaf = (c, radius, count) => {
    const crown = [c.x, c.y - radius * 0.25, c.z, radius * 1.35];
    const turn = R(0, Math.PI * 2);
    for (let k = 0; k < count; k++) {
      const a = turn + k * Math.PI * 2 / count + R(-0.4, 0.4), reach = radius * R(0.2, 0.5);
      const size = radius * R(1.3, 1.6);
      sprays.push({ p: [c.x + Math.cos(a) * reach, c.y + radius * R(-0.1, 0.15), c.z + Math.sin(a) * reach],
        s: [size, size * 0.55, size], rot: [R(-0.15, 0.15), R(0, Math.PI * 2), R(-0.15, 0.15)],
        kind: LEAF.maple, crown });
    }
  };
  const turn = R(0, Math.PI * 2), bend = heading(turn, 0);
  const trunkEnd = bend.clone().multiplyScalar(H * R(0.025, 0.05)).add(V(0, H * R(0.17, 0.23), 0));
  const trunk = limb(V(), trunkEnd, UP, UP.clone().addScaledVector(bend, 0.2).normalize(), r0, r0 * 0.75, 0.35);
  for (let s = 0; s < leaders; s++) {
    const bearing = turn + s * Math.PI * 2 / leaders + R(-0.4, 0.4);
    const from = along(trunk, R(0.5 + s * 0.1, 0.65 + s * 0.1));
    const reach = S * (s === 0 ? R(0.3, 0.5) : R(0.55, 0.8));
    const finish = heading(bearing, 0).multiplyScalar(reach).add(V(0, H * (s === 0 ? R(0.76, 0.88) : R(0.55, 0.73)), 0));
    const enter = from.d.clone().lerp(heading(bearing, R(0.8, 1.1)), 0.45).normalize();
    const stem = limb(from.p, finish, enter, heading(bearing + R(-0.25, 0.25), R(0.15, 0.5)),
      from.r * (s === 0 ? 0.66 : 0.53), 0.08);
    const branches = detail ? 4 : 3;
    for (let b = 0; b < branches; b++) {
      const on = along(stem, R(0.25, 0.33) + b * (0.58 / (branches - 1)));
      const bearing = bearingOf(on.d) + (b % 2 ? 1 : -1) * R(0.4, 0.95);
      const outward = heading(bearing, R(0.08, 0.3));
      const end = on.p.clone().addScaledVector(outward, S * R(0.28, 0.42));
      const branch = limb(on.p, end, on.d.clone().lerp(heading(bearing, 0.6), 0.4).normalize(),
        heading(bearing + R(-0.2, 0.2), R(-0.12, 0.2)), on.r * 0.5, 0.045);
      const forks = detail ? [R(0.48, 0.62), R(0.72, 0.85)] : [R(0.55, 0.72)];
      let leafTip;
      for (const [i, t] of forks.entries()) {
        const fork = along(branch, t), side = bearing + R(-0.8, 0.8);
        const tip = fork.p.clone().addScaledVector(heading(side, R(0.15, 0.45)), S * R(0.1, 0.16));
        limb(fork.p, tip, fork.d, heading(side, R(-0.05, 0.3)), Math.max(0.04, fork.r * 0.48), 0.025);
        if (i === 0) leafTip = tip;
      }
      leaf(end, S * R(0.22, 0.28), b === branches - 1 ? 1 : 2);
      leaf(leafTip, S * R(0.13, 0.2), 1);
    }
    leaf(finish, S * R(0.15, 0.2), 1);
  }
  return sprays;
}

// A cherry in flower. `kept`: the wood the cherry grew ({ nodes, opts, part }),
// drawn here: each limb run through a smooth curve with a node every two
// units and many sides, bowed under its flower and tapering, and on from
// every branch's end fine twigs that thin to nothing. The flower is at the
// twigs' tips, where a cherry carries it: two soft puffs at each tip, a
// smaller one behind, and one deep in along each branch. Everything from
// `rng`, the cherry's own stream.
function bloomCherry(rng, wood, tint, kept, { S, detail }) {
  const R = (a, b) => a + (b - a) * rng();
  const sides = (r) => (r > 1.2 ? 12 : r > 0.5 ? 10 : r > 0.2 ? 8 : 6);
  // (`sag`: how far a limb bows down under its flower, most at its middle.
  // It thins fastest toward its end, so it tapers to the twigs instead of
  // running at one girth to a blunt tip.)
  const smooth = (nodes, sag = 0) => {
    if (nodes.length < 3) return nodes;
    const len = nodes.reduce((a, n, i) => a + (i ? n.p.distanceTo(nodes[i - 1].p) : 0), 0);
    const pts = nodes.map((n, i) => n.p.clone().add(V(0, -sag * len * Math.sin((Math.PI * i) / (nodes.length - 1)), 0)));
    const curve = new TreeCurve(pts);
    const seg = Math.max(4, Math.min(18, Math.round(curve.getLength() / 2)));
    const r0 = nodes[0].r, r1 = nodes[nodes.length - 1].r;
    return Array.from({ length: seg + 1 }, (_, i) => {
      const t = i / seg;
      return { p: curve.getPoint(t), d: curve.getTangent(t), r: r0 + (r1 - r0) * Math.pow(t, 0.6) };
    });
  };
  const at = (nodes, t) => {
    const f = Math.min(nodes.length - 1.0001, t * (nodes.length - 1)), i = Math.floor(f), u = f - i;
    const a = nodes[i], b = nodes[i + 1];
    return { p: a.p.clone().lerp(b.p, u), d: a.d.clone().lerp(b.d, u).normalize(), r: a.r + (b.r - a.r) * u };
  };
  // a twig: four segments, lifting a little toward the light, thin to its tip
  const twig = (from, dir, len, r0) => {
    const nodes = [], p = from.clone(), d = dir.clone().normalize();
    for (let i = 0; i <= 4; i++) {
      nodes.push({ p: p.clone(), d: d.clone(), r: r0 + (0.022 - r0) * Math.pow(i / 4, 0.8) });
      d.x += (rng() - 0.5) * 0.35; d.z += (rng() - 0.5) * 0.35; d.y += 0.07 + (rng() - 0.5) * 0.2;
      d.normalize();
      p.addScaledVector(d, len / 4);
    }
    wood.tube(nodes, 5, tint);
    return nodes;
  };
  const flowers = [];
  const spray = (c, w, role) => flowers.push({
    c, role, s: [w, w * 0.8, w], rot: [R(-0.3, 0.3), rng() * Math.PI * 2, R(-0.3, 0.3)],
  });
  for (const { nodes, opts, part } of kept) {
    const line = smooth(nodes, part === 'limb' ? 0.07 : part === 'branch' ? 0.05 : 0);
    wood.tube(line, sides(line[0].r), tint, { ...opts, source: nodes });
    if (part !== 'branch') continue;
    const tipEnd = line[line.length - 1];
    const twigs = detail ? 3 : 2;
    for (let k = 0; k < twigs; k++) {
      const on = k === 0 ? tipEnd : at(line, R(0.55, 0.85));
      const out = heading(bearingOf(on.d) + R(-1.3, 1.3), R(-0.1, 0.55));
      const tw = twig(on.p, on.d.clone().lerp(out, 0.6), S * R(0.1, 0.17), Math.max(0.05, Math.min(0.09, on.r)));
      const tip = tw[tw.length - 1].p, mid = tw[2].p;
      const rc = S * R(0.14, 0.18);
      spray(tip.clone().add(V(0, rc * 0.2, 0)), rc * R(1.7, 2.1), 'tip');
      spray(tip.clone().add(V(R(-1, 1) * rc * 0.6, -rc * 0.25, R(-1, 1) * rc * 0.6)), rc * R(1.5, 1.8), 'tip');
      spray(mid, rc * R(1.3, 1.5), 'mid');
    }
    const inner = at(line, R(0.3, 0.5));
    const w = S * R(0.2, 0.26) * 1.4;
    spray(inner.p.clone().add(V(0, w * 0.1, 0)), w, 'inner');
  }
  // One crown for the whole tree: the normals turn out from it, so the tree
  // is lit as one mass, and a spray deep in it is darker (effects.js, vDeep).
  // Centred on the tips themselves, not under them, so the lower half of the
  // crown is turned from the moon and goes dark while the top stays lit.
  const tips = flowers.filter((f) => f.role === 'tip');
  const cx = tips.reduce((a, f) => a + f.c.x, 0) / tips.length, cz = tips.reduce((a, f) => a + f.c.z, 0) / tips.length;
  const cy = tips.reduce((a, f) => a + f.c.y, 0) / tips.length;
  const reach = Math.max(...tips.map((f) => Math.hypot(f.c.x - cx, (f.c.y - cy) * 1.6, f.c.z - cz)));
  const crown = [cx, cy - reach * 0.05, cz, reach * 1.1];
  let lo = Infinity, hi = -Infinity;
  for (const f of flowers) { lo = Math.min(lo, f.c.y); hi = Math.max(hi, f.c.y); }
  const ROLE = { tip: 1, mid: 0.8, inner: 0.55 };
  return flowers.map((f) => ({
    p: [f.c.x, f.c.y, f.c.z], s: f.s, rot: f.rot, kind: LEAF.blossom, crown,
    shade: ROLE[f.role] * (0.72 + 0.28 * (hi > lo ? (f.c.y - lo) / (hi - lo) : 1)),
  }));
}

// Layer small sprays through each billow and grow leafy side shoots along
// exposed boughs. The established skeleton and its planting draws stay intact.
function fillCrown(species, rng, form, limbs, sprays, { H, detail }) {
  const R = (a, b) => a + (b - a) * rng();
  const kind = species === 'cherry' ? LEAF.broad : LEAF[species];
  const original = sprays.slice();
  for (const sp of original) {
    const count = species === 'cedar' || species === 'cherry' ? 1 : 2;
    for (let k = 0; k < count; k++) {
      const a = R(0, Math.PI * 2), w = sp.s[0], size = R(0.62, 0.83);
      const p = [sp.p[0] + Math.cos(a) * w * R(0.14, 0.3), sp.p[1] - w * R(0.04, 0.22), sp.p[2] + Math.sin(a) * w * R(0.14, 0.3)];
      sprays.push({ ...sp, p, s: sp.s.map((v) => v * size),
        rot: [R(-0.35, 0.35), R(0, Math.PI * 2), R(-0.35, 0.35)],
        kind: sp.kind, shade: sp.shade * R(0.85, 1.05) });
    }
  }
  const tint = new THREE.Color(BARK[species]);
  const leafyShoot = (on, forward, dir, reach, r0, w, bough = false) => {
    const tip = on.clone().addScaledVector(dir, reach);
    const curve = new THREE.CubicBezierCurve3(on, on.clone().addScaledVector(forward, reach * 0.4),
      tip.clone().addScaledVector(dir, -reach * 0.3).add(V(0, reach * (species === 'willow' ? 0.12 : -0.18), 0)), tip);
    form.tube(Array.from({ length: 7 }, (_, n) => ({ p: curve.getPoint(n / 6), r: r0 + (0.015 - r0) * (n / 6) ** 0.8 })), 5, tint);
    const crown = [tip.x, tip.y - w * 0.2, tip.z, w * 1.2];
    for (const along of bough ? [0.38, 0.7, 0.98] : [0.56, 0.94]) {
      const p = curve.getPoint(along).add(V(0, w * 0.14, 0));
      sprays.push({ p: p.toArray(), s: [w, w * (species === 'pine' ? 0.7 : 0.9), w],
        rot: [R(-0.25, 0.25), R(0, Math.PI * 2), R(-0.25, 0.25)], kind, crown, shade: R(0.72, 1.05),
        ...(species === 'cherry' ? { tint: '#4c6541' } : {}) });
    }
  };
  if (species === 'pine') {
    // Unequal boughs spiral through the crown; needles clothe their length
    // as well as their tips, leaving smaller, irregular windows of sky.
    const trunk = limbs[0], count = detail ? 12 : 9, turn = R(0, Math.PI * 2);
    for (let b = 0; b < count; b++) {
      const t = 0.38 + b / (count - 1) * 0.55 + R(-0.012, 0.012);
      const f = t * (trunk.length - 1), i = Math.floor(f), u = f - i;
      const on = trunk[i].p.clone().lerp(trunk[i + 1].p, u);
      if (on.y < 22) continue;
      const forward = trunk[i + 1].p.clone().sub(trunk[i].p).normalize();
      const dir = heading(turn + b * 2.399963 + R(-0.3, 0.3), R(-0.04, 0.18));
      const reach = H * R(0.24, 0.3) * (1 - t * 0.65), w = H * R(0.1, 0.14) * (1 - t * 0.25);
      leafyShoot(on, forward, dir, reach, R(0.15, 0.28) * (1 - t * 0.6), w, true);
    }
  }
  for (const nodes of limbs.slice(1)) {
    const start = nodes[0], end = nodes.at(-1), axis = end.p.clone().sub(start.p), length = axis.length();
    if (start.r < 0.14 || start.r > 1.35 || length < 6 || Math.hypot(axis.x, axis.z) < length * 0.3) continue;
    const count = detail ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const t = (k ? 0.73 : 0.43) + R(-0.06, 0.08), f = t * (nodes.length - 1), i = Math.floor(f), u = f - i;
      const on = nodes[i].p.clone().lerp(nodes[i + 1].p, u);
      // New woody detail stays above walking height; lower crowns gain leaf.
      if (on.y < 22) continue;
      const forward = nodes[i + 1].p.clone().sub(nodes[i].p).normalize();
      const a = bearingOf(forward) + (k % 2 ? -1 : 1) * R(0.6, 1.15);
      const dir = forward.clone().lerp(heading(a, species === 'willow' ? -0.18 : R(0.1, 0.5)), 0.7).normalize();
      const reach = Math.min(length * R(0.25, 0.4), H * 0.16);
      const r0 = Math.min(0.13, start.r * 0.22);
      const w = Math.max(3, Math.min(H * R(0.075, 0.11), reach * 1.6));
      leafyShoot(on, forward, dir, reach, r0, w);
    }
  }
}

// Grows a tree. `H` is its height, `S` how far its crown reaches out from the
// trunk, `lean` the bearing it leans toward (a willow to the water), `detail`
// false for one only ever seen across the garden: no twigs, fewer sprays.
// Returns the wood (added to `wood`), the sprays and, for a willow, the whips:
//   sprays  { p, s, rot, kind, shade, crown: [x, y, z, r] }
//   whips   { p, len, wide, yaw, kind, shade }
// `weeping` (a willow's, pavilionProps.js): a stream of its own to dress the
// willow from, as a weeping one — see the end of this.
// `spire` (a cedar's, webProps.js): dressed as a spire — see the cedar.
// A null `wood` spends the same growth and leaf draws without building bark
// for a tree excluded from the planting.
export function growTree(species, rng, wood, { H, S, lean = null, detail = true, skirt = 0, weeping = null, spire = null }) {
  const R = (a, b) => a + (b - a) * rng();
  const tint = new THREE.Color(BARK[species]);
  const sprays = [], whips = [];
  const bark = wood ? new TreeWood(wood, species, detail) : NO_WOOD;
  const limbs = [];
  const form = {
    tube(nodes, ...args) { limbs.push(nodes); bark.tube(nodes, ...args); },
    finish() { bark.finish(); },
  };
  let willow = null, maple = null, cherry = null, pine = null, tintRng = null;

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
  const tube = (nodes, opts) => form.tube(nodes, sides(nodes[0].r), tint, opts);

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
    const boughs = [];
    for (const t of heights) {
      bearing += 2.4 + R(-0.5, 0.5);
      const from = at(trunk, t);
      const len = H * R(0.26, 0.42) * (1.2 - t * 0.6);
      // angular, as black pine limbs are: down, up, down, and the tip lifted
      const limb = grow(from.p, heading(bearing, R(-0.12, 0.2)), len, Math.max(0.3, from.r * 0.5), 0.16, 5, (d, tt, i) => {
        d.y += i === 4 ? 0.35 : (i % 2 ? 0.2 : -0.22) * rng();
        wobble(d, 0.18);
      });
      const bough = { t, nodes: [limb], first: sprays.length };
      const rp = R(5.5, 8.5) * (1.15 - t * 0.45) * Math.min(1.3, H / 50);
      pad(end(limb).p.clone().add(V(0, rp * 0.2, 0)), rp);
      if (detail && rng() < 0.7) {
        const on = at(limb, R(0.45, 0.75));
        const sub = grow(on.p, heading(bearingOf(on.d) + (rng() < 0.5 ? -1 : 1) * R(0.6, 1.1), R(0, 0.25)), len * R(0.35, 0.5), 0.16, 0.1, 2, (d) => wobble(d, 0.2));
        bough.nodes.push(sub);
        pad(end(sub).p.clone().add(V(0, rp * 0.15, 0)), rp * R(0.55, 0.7));
      }
      bough.last = sprays.length;
      boughs.push(bough);
    }
    pad(top.p.clone().add(V(0, 1, 0)), R(5, 7) * Math.min(1.3, H / 50));
    pine = { trunk, boughs, seed: 0x70696e65 ^ Math.round(r0 * 0x1000000) ^ Math.round(phase * 0x10000) };
  } else if (species === 'maple') {
    // Retain the established stream and spray positions for the planting's
    // colour budget. The curved wood and its leaf use their own stream below.
    const r0 = R(1.0, 1.5) * Math.min(1.2, H / 36);
    const trunk = grow(V(), heading(rng() * 6.28, Math.PI / 2 - R(0, 0.15)), H * R(0.14, 0.22), r0, r0 * 0.8, 2, (d) => wobble(d, 0.1));
    const stems = 3 + Math.floor(rng() * 2), turn = rng() * 6.28;
    maple = { r0, leaders: stems, seed: Math.round(r0 * 0x1000000) ^ Math.round(turn * 0x100000) ^ Math.round(end(trunk).p.y * 0x100000) };
    for (let s = 0; s < stems; s++) {
      const from = at(trunk, R(0.7, 1));
      const stem = grow(from.p, heading(turn + (s / stems) * 6.28 + R(-0.4, 0.4), R(0.75, 1.1)), H * R(0.55, 0.72), from.r * 0.62, 0.22, 5, (d) => {
        wobble(d, 0.3);
        d.y -= 0.05;
      });
      const branches = detail ? 4 : 3;
      for (let b = 0; b < branches; b++) {
        const on = b === branches - 1 ? end(stem) : at(stem, R(0.3, 0.95));
        // near level, and out: the layers a maple holds its leaf in
        const bd = heading(bearingOf(on.d) + R(-1.1, 1.1), R(-0.05, 0.3));
        const reach = Math.min(S * R(0.35, 0.55), S * 0.8);
        const br = grow(on.p, bd, reach, Math.max(0.12, on.r * 0.55), 0.07, 3, (d) => { wobble(d, 0.3); d.y *= 0.7; });
        const tip = end(br), mid = at(br, 0.55);
        clump(tip.p, S * R(0.26, 0.34), 2, LEAF.maple, { flat: 0.55, drop: 0.25, size: 1.5 });
        clump(mid.p.clone().add(V(0, 1.2, 0)), S * R(0.2, 0.26), 1, LEAF.maple, { flat: 0.55, drop: 0.25, size: 1.6 });
      }
    }
  } else if (species === 'cherry') {
    // The wood is kept, to be drawn round and smooth and dressed in flower by
    // bloomCherry, its own stream; the clumps below are still grown from
    // this one, so every tree after a cherry is the tree it was.
    const kept = [];
    const cTube = (nodes, opts, part) => kept.push({ nodes, opts, part });
    const r0 = R(1.6, 2.2) * Math.min(1.2, H / 40);
    const trunk = grow(V(), heading(rng() * 6.28, Math.PI / 2 - R(0.05, 0.2)), H * R(0.26, 0.34), r0, r0 * 0.75, 3, (d) => wobble(d, 0.14));
    cTube(trunk, { flare: 0.5 }, 'trunk');
    const limbs = 3 + Math.floor(rng() * 2), turn = rng() * 6.28;
    cherry = { kept, seed: (Math.round(r0 * 0x1000000) ^ Math.round(turn * 0x100000) ^ 0x51ab) >>> 0 };
    for (let l = 0; l < limbs; l++) {
      const from = at(trunk, R(0.8, 1));
      // wide and spreading, the ends drooping under the weight of flower
      const limb = grow(from.p, heading(turn + (l / limbs) * 6.28 + R(-0.35, 0.35), R(0.45, 0.8)), S * R(0.85, 1.1), from.r * 0.66, 0.2, 5, (d, t) => {
        wobble(d, 0.22);
        if (t > 0.4) d.y -= 0.09;
      });
      cTube(limb, undefined, 'limb');
      const branches = 3;
      for (let b = 0; b < branches; b++) {
        const on = b === branches - 1 ? end(limb) : at(limb, R(0.3, 0.95));
        const bd = on.d.clone().lerp(heading(bearingOf(on.d) + R(-1.2, 1.2), R(-0.1, 0.7)), 0.55);
        const br = grow(on.p, bd, S * R(0.3, 0.45), Math.max(0.14, on.r * 0.6), 0.08, 3, (d) => wobble(d, 0.35));
        cTube(br, undefined, 'branch');
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
    willow = { c, eave, Rd };
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
    // `skirt`: branched nearly to the ground, as a cedar grown for a screen
    // is (webProps.js) — its draw spent all the same
    if (skirt) y = H * skirt;
    // A spire (webProps.js). Grown as below, a whorl every six to nine
    // units whatever its reach, the upper half of a cedar was a bare stem with
    // a tuft on it now and then: a telegraph pole. A whorl is set as far from
    // the last as its own leaf reaches, so the leaf of one runs into the next
    // from the grass to the leader; the lowest hang, the highest lift; and
    // the reach falls away evenly, widest a little way up, so the whole is a
    // cone with a ragged edge.
    if (spire) {
      y = H * Math.max(0.03, skirt * 0.6);
      let whorl = 0;
      while (y < H * 0.985) {
        const t = y / H, on = at(trunk, t);
        const reach = S * Math.pow(1 - t, spire.taper) * Math.min(1, 0.72 + (0.28 * t) / spire.belly) * R(0.82, 1.12) + 0.8;
        const per = reach > 5 ? 3 : 2;
        turn += R(0.6, 1.4);
        // hanging at the foot, level at two thirds, lifting under the leader
        const pitch = -0.5 + 0.85 * t;
        const crown = [on.p.x, on.p.y - 2, on.p.z, reach + 5];
        for (let k = 0; k < per; k++) {
          const br = grow(on.p, heading(turn + (k / per) * 6.28 + R(-0.3, 0.3), pitch + R(-0.15, 0.15)), reach, Math.max(0.1, on.r * 0.3), 0.05, 2, (d, tt, i) => { if (i === 1) d.y += 0.3; wobble(d, 0.15); });
          // (limbs only where a limb is seen: the long ones, on a tree that
          // is ever stood under)
          if (detail && reach > 9) tube(br);
          const tip = end(br), mid = at(br, 0.5);
          // (under the leader, where the reach is a spray's own width, the
          // sprays stand taller than they are wide and hide the stem)
          const w = Math.max(5.4, reach * spire.leaf), tall = reach < 5 ? 1.3 : 1;
          sprays.push({ p: [mid.p.x, mid.p.y + R(-0.8, 1), mid.p.z], s: [w, w * R(0.78, 0.98) * tall, w], rot: [R(-0.35, 0.35), rng() * 6.28, R(-0.35, 0.35)], kind: LEAF.cedar, crown });
          if (reach > 12 && k === 0 && detail) sprays.push({ p: [tip.p.x, tip.p.y + R(-1, 0.6), tip.p.z], s: [w * 0.62, w * 0.55, w * 0.62], rot: [R(-0.3, 0.3), rng() * 6.28, R(-0.3, 0.3)], kind: LEAF.cedar, crown });
        }
        // and leaf in close round the stem at every third whorl, so the stem
        // is not a line drawn up the middle of the cone
        if ((whorl++) % 3 === 0 && t > 0.25) {
          const w = Math.max(4.2, reach * 0.85);
          sprays.push({ p: [on.p.x, on.p.y + 0.6, on.p.z], s: [w, w * 1.15, w], rot: [R(-0.2, 0.2), rng() * 6.28, R(-0.2, 0.2)], kind: LEAF.cedar, crown });
        }
        y += Math.min(spire.step[1], Math.max(spire.step[0], reach * spire.close)) * R(0.85, 1.15) * (detail ? 1 : 1.4);
      }
      // the leader: three sprays, each narrower than the one under it
      const top = end(trunk).p;
      for (let k = 0; k < 3; k++) sprays.push({ p: [top.x, top.y - 3.6 + k * 2.4, top.z], s: [4.6 - k * 0.9, 6.6 - k * 0.8, 4.6 - k * 0.9], rot: [0, rng() * 6.28, 0], kind: LEAF.cedar, crown: [top.x, top.y - 6, top.z, 9] });
    } else {
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

  // A weeping willow (pavilionProps.js). Dressed as above it was an
  // umbrella pine: fifteen tufts lying level on the top of a dome, the limbs
  // bare under them, and whips let down from under the tufts as separate
  // bright strings. A willow is one round head of leaf that droops — fullest
  // at its shoulders, falling away below them — and its curtain comes out of
  // that head, not from under it. So: the leaf laid over the whole dome and
  // each spray tipped outward with the dome's own slope (a spray lying level
  // is a plate); a ring more of it hung below the shoulder; and the whips
  // begun inside the leaf, broader, each a little off plumb. All of it from
  // `weeping`, this willow's own stream, and after everything above has
  // drawn what it always drew — the wood is the same wood, and the trees
  // grown after this one are the trees they were. (`was`: the sprays it had,
  // handed back too. Whoever stands the tree up draws a tint for each spray
  // from the trees' stream, and must draw for those and not for these.)
  let was = null;
  if (pine) {
    // Keep the original spray positions for the planting's clipped tint
    // budget. Move each complete bough, forks and foliage together, so its
    // attachment stays joined while the crown opens into staggered tiers.
    was = sprays.slice();
    tintRng = makeRng(pine.seed);
    for (const [i, bough] of pine.boughs.entries()) {
      const from = at(pine.trunk, bough.t).p;
      const tier = i / (pine.boughs.length - 1);
      const to = at(pine.trunk, 0.29 + tier * 0.57 + (bough.t - 0.3 - tier * 0.6) * 0.12).p;
      const scale = 0.78 + 0.16 * ((i * 0.618034) % 1), lift = 0.1 + 0.04 * (i % 3);
      const move = (p) => {
        const q = p.clone().sub(from).multiplyScalar(scale);
        q.y += Math.hypot(q.x, q.z) * lift;
        return q.add(to);
      };
      for (const nodes of bough.nodes) tube(nodes.map((n) => ({ ...n, p: move(n.p) })));
      for (let j = bough.first; j < bough.last; j++) {
        const sp = sprays[j], c = move(V(...sp.crown.slice(0, 3)));
        sprays[j] = { ...sp, p: move(V(...sp.p)).toArray(), s: sp.s.map((v) => v * scale),
          crown: [c.x, c.y, c.z, sp.crown[3] * scale] };
      }
    }
  }
  if (maple) {
    was = sprays.slice();
    tintRng = makeRng(maple.seed);
    sprays.length = 0;
    sprays.push(...mapleWood(tintRng, form, { H, S, r0: maple.r0, leaders: maple.leaders, detail }));
  }
  if (cherry) {
    was = sprays.slice();
    tintRng = makeRng(cherry.seed);
    sprays.length = 0;
    sprays.push(...bloomCherry(tintRng, form, tint, cherry.kept, { S, detail }));
  }
  if (weeping && willow) {
    const { c, eave, Rd } = willow;
    const W = (a, b) => a + (b - a) * weeping();
    was = sprays.slice();
    sprays.length = 0;
    whips.length = 0;
    const dome = (a, f, sink = 0) => V(c.x + Math.cos(a) * f * Rd, eave + (H - eave) * Math.sqrt(Math.max(0, 1 - f * f)) - sink, c.z + Math.sin(a) * f * Rd);
    const crown = [c.x, eave - 6, c.z, Rd + 8];
    const tilt = new THREE.Quaternion(), yaw = new THREE.Quaternion(), euler = new THREE.Euler();
    const size = Math.min(1.2, H / 60);
    const tuft = (a, f, sink, droop, w, tall) => {
      const q = dome(a, Math.min(1, f), sink);
      if (f > 1) { q.x += Math.cos(a) * (f - 1) * Rd; q.z += Math.sin(a) * (f - 1) * Rd; }
      tilt.setFromAxisAngle(V(-Math.sin(a), 0, Math.cos(a)), -droop);
      euler.setFromQuaternion(tilt.multiply(yaw.setFromAxisAngle(UP, weeping() * 6.28)));
      sprays.push({ p: [q.x, q.y - 2.5, q.z], s: [w * size, w * tall * size, w * size], rot: [euler.x, euler.y, euler.z], kind: LEAF.willow, crown });
    };
    const turn = weeping() * 6.28;
    // Over the top and down to the shoulder: small sprays, close-set, laid
    // out on a sunflower's spiral so that none of the dome is bare. (Small:
    // at the size a broad tree's sprays are, each leaf of these was a hand
    // across and the willow a mango.)
    const cap = detail ? 28 : 17;
    for (let k = 0; k < cap; k++) {
      const f = Math.sqrt((k + 0.5) / cap) * 0.98;
      tuft(turn + k * 2.39996 + W(-0.2, 0.2), f, 0, f * f * 0.95, W(10.5, 14), 1);
    }
    // and below the shoulder, drooping
    const skirts = detail ? 13 : 8;
    for (let k = 0; k < skirts; k++) tuft(turn + ((k + 0.5) / skirts) * 6.28 + W(-0.2, 0.2), W(0.95, 1.05), H * W(0.05, 0.14), W(0.9, 1.2), W(10, 13), 1.3);
    // What a willow is made of is what hangs. `fall`: a strand from the dome
    // at `f`, begun in the leaf, `reach` long at the most and never nearer
    // the grass than `bottom`.
    const fall = (f, bottom, reach = Infinity) => {
      const q = dome(weeping() * 6.28, f), y0 = q.y + W(-1, 2.5);
      const len = Math.min(reach, y0 - bottom);
      if (len > 5) {
        whips.push({
          p: [q.x, y0, q.z], len, wide: W(3.0, 4.6), yaw: weeping() * Math.PI, kind: 4 + Math.floor(weeping() * 2),
          tilt: [W(-0.05, 0.05), W(-0.05, 0.05)], shade: W(0.72, 1),
        });
      }
    };
    // short ones all over the head, so the head itself is hung leaf
    for (let k = 0; k < (detail ? 64 : 36); k++) fall(Math.sqrt(W(0.02, 0.8)), 0, W(11, 20));
    // the curtain, longest round the rim
    for (let k = 0; k < (detail ? 64 : 38); k++) fall(W(0.86, 1.02), W(3, 10));
    for (let k = 0; k < (detail ? 28 : 16); k++) fall(W(0.55, 0.86), W(8, 20));
    let lo = Infinity, hi = -Infinity;
    for (const sp of sprays) { lo = Math.min(lo, sp.p[1]); hi = Math.max(hi, sp.p[1]); }
    for (const sp of sprays) sp.shade = 0.5 + 0.42 * ((sp.p[1] - lo) / Math.max(1, hi - lo)) + 0.12 * Math.min(1, Math.hypot(sp.p[0] - c.x, sp.p[2] - c.z) / Rd);
  }
  was ??= sprays.slice();
  const canopySeed = 0x4c555348 ^ Math.round(H * 4096) ^ Math.round(S * 65536)
    ^ Math.round(sprays[0]?.p[0] * 1048576) ^ Math.round(sprays[0]?.p[2] * 262144);
  tintRng ??= makeRng(canopySeed ^ 0x74696e74);
  fillCrown(species, makeRng(canopySeed), form, limbs, sprays, { H, detail });
  form.finish();
  return { sprays, whips, was, tintRng };
}
