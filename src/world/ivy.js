// ── Ivy, and the wisteria's old trunks ───────────────────────────────────────
// The Door's ivy was cards painted with round green blots, laid flat on the
// garden face of the arch and on the passage's walls: from the passage they
// read as green beads scattered over the stone, the same size on the quoin as
// on the post beyond, with nothing holding them there. And the vine up the
// pergola's posts was one tube of timber, the post's own colour, no thicker at
// the ground than at the beams and without a leaf on it.
//
// Ivy is a plant before it is a texture. It comes out of the ground as a few
// old stems, grey and hairy, pressed to the stone; they fork, and fork again,
// and fan out up the wall, always climbing, wandering where the joints and the
// arrises take them; and every hand's breadth along each stem a leaf stands
// off the wall on its stalk, turned out to the light — five-lobed, dark and
// glossy, its veins pale — the leaves overlapping like slates, biggest low down
// where the stems are old, small and bright green at the growing tips. Where
// a stem reaches the edge of the arch it goes over it and hangs.
//
// So it is grown here: stems wandering over the actual stone (cast onto it,
// ray by ray, through a tree of the arch's own faces), forking, thickening
// toward the root; leaves real outlines in geometry (no alpha edge to crawl),
// set along the stems on their stalks; and the wisteria's trunks two strands
// twisted on each other as they twine the post, thick at the foot, grey-barked,
// with leaves and a few loose shoots where they come out over the top.
//
// Drawn from the rng it is handed, never the world's stream. (?wivy=old)
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);

// ── The leaf ──────────────────────────────────────────────────────────────────
// An ivy leaf in its own frame: the stalk joins at the origin, the tip is up
// +y (about 1 long), the face looks along +z. Five lobes — a long middle one,
// two to the sides and two small ones at the base round a heart-shaped notch.
// `n` points per lobe-to-lobe run.
const LOBES = [[0, 1.0], [58, 0.66], [112, 0.42], [-112, 0.42], [-58, 0.66]].sort((a, b) => a[0] - b[0]);
const CENTRE = 0.36;   // where the veins meet, up the blade from the stalk
const ivyOutline = (n = 4) => {
  // angle from the tip, round from the left basal lobe to the right; radii are
  // from the vein centre; the base notch sits at ±180
  const tips = [[-180, 0.3], ...LOBES.map(([a, r]) => [a, r]), [180, 0.3]];
  const pts = [];
  for (let k = 0; k < tips.length - 1; k++) {
    const [a0, r0] = tips[k], [a1, r1] = tips[k + 1];
    const notch = k === 0 || k === tips.length - 2;
    for (let i = 0; i < n; i++) {
      const f = i / n, a = a0 + (a1 - a0) * f;
      // a lobe comes to a point; the sinus between two is a shallow round
      const sinus = Math.sin(Math.PI * f);
      const r = (r0 + (r1 - r0) * f) * (1 - (notch ? 0.15 : 0.36) * sinus ** 0.8) - (notch && f > 0.5 ? 0.05 * sinus : 0);
      pts.push([a, r]);
    }
  }
  return pts.map(([a, r]) => [Math.sin(a * Math.PI / 180) * r, CENTRE + Math.cos(a * Math.PI / 180) * r]);
};

// The blade as a mesh: a fan from the vein centre through a ring halfway out,
// folded along the midrib, cupped, and the tip let down a little. The uv is
// the leaf's own (x, y) laid into the painted texture's square.
export function ivyLeafGeometry() {
  const rim = ivyOutline(4), n = rim.length;
  const pos = [], uv = [], idx = [];
  const lift = (x, y) => {
    // fold along the midrib (the halves rise to the sides), cup, and droop at the tip
    const z = Math.abs(x) * 0.16 - (x * x + (y - CENTRE) ** 2) * 0.1 - Math.max(0, y - 0.7) ** 2 * 0.25;
    return z;
  };
  const push = (x, y) => {
    pos.push(x, y, lift(x, y));
    uv.push(0.5 + x / 1.4, 0.04 + y * 0.92 / 1.38);
    return pos.length / 3 - 1;
  };
  const c = push(0, CENTRE);
  const mid = rim.map(([x, y]) => push(x * 0.5, CENTRE + (y - CENTRE) * 0.5));
  const out = rim.map(([x, y]) => push(x, y));
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    idx.push(c, mid[j], mid[k], mid[k], out[j], out[k], mid[k], mid[j], out[j]);
  }
  // the stalk's foot is at the origin, the base notch just above it
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A wisteria leaflet: a long pointed oval, folded a little along its rib.
export function leafletGeometry() {
  const n = 7, pos = [0, 0, 0], idx = [];
  for (const side of [1, -1]) {
    for (let i = 1; i < n; i++) {
      const t = i / n, w = Math.sin(Math.PI * t ** 0.85) * 0.21 * side;
      pos.push(w, t, Math.abs(w) * 0.35 - t * t * 0.08);
    }
  }
  pos.push(0, 1, -0.08);
  // 0 the foot, 1..n-1 down the +x edge, n..2n-2 the -x edge, 2n-1 the tip
  const tipI = 2 * n - 1, px = (i) => i, nx = (i) => n - 1 + i;
  idx.push(0, px(1), nx(1));
  for (let i = 1; i < n - 1; i++) idx.push(px(i), px(i + 1), nx(i + 1), px(i), nx(i + 1), nx(i));
  idx.push(px(n - 1), tipI, nx(n - 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// The blade's face, painted: mid green with the five main veins pale and
// raised from the centre to the lobes' points, the finer ones between, a
// darker margin, and the gloss broken by a fine mottle. Light enough that the
// tint each leaf is drawn with (its instance colour) is the leaf's own colour;
// the veins come out at about one and a half times it.
export function ivyLeafTexture(seed = 1) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let s = seed >>> 0;
  const r = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296);
  const X = (x) => (0.5 + x / 1.4) * S, Yp = (y) => (1 - (0.04 + y * 0.92 / 1.38)) * S;
  g.fillStyle = 'rgb(196,196,196)';
  g.fillRect(0, 0, S, S);
  // the margin a shade darker, the blade's middle a shade lighter
  const grd = g.createRadialGradient(X(0), Yp(CENTRE), 4, X(0), Yp(CENTRE), S * 0.42);
  grd.addColorStop(0, 'rgba(212,212,204,1)');
  grd.addColorStop(0.7, 'rgba(196,196,196,1)');
  grd.addColorStop(1, 'rgba(166,166,166,1)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  for (let k = 0; k < 900; k++) {
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.03 + r() * 0.05})` : `rgba(255,255,240,${0.03 + r() * 0.05})`;
    const w = 1 + r() * 3;
    g.fillRect(r() * S, r() * S, w, w);
  }
  // veins: a slightly bowed line from the centre to each lobe's point, and
  // side veins off them toward the margin
  const vein = (x0, y0, x1, y1, w, a) => {
    const mx = (x0 + x1) / 2 + (y1 - y0) * 0.06, my = (y0 + y1) / 2 - (x1 - x0) * 0.06;
    g.strokeStyle = `rgba(236,240,214,${a})`;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(X(x0), Yp(y0)); g.quadraticCurveTo(X(mx), Yp(my), X(x1), Yp(y1)); g.stroke();
  };
  vein(0, 0.02, 0, CENTRE, 5, 0.9);
  for (const [a, rr] of LOBES) {
    const th = a * Math.PI / 180, L = rr * 0.9;
    const ex = Math.sin(th) * L, ey = CENTRE + Math.cos(th) * L;
    vein(0, CENTRE, ex, ey, rr > 0.9 ? 4.5 : 3.4, 0.85);
    for (let k = 1; k <= 4; k++) {
      const f = k / 5.2, bx = ex * f, by = CENTRE + (ey - CENTRE) * f;
      for (const side of [-1, 1]) {
        const off = th + side * (0.7 + r() * 0.25), len = (1 - f) * rr * 0.42 + 0.05;
        vein(bx, by, bx + Math.sin(off) * len, by + Math.cos(off) * len, 1.6, 0.42);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// The underside of a leaf is paler and duller than its face.
export function backPaler(mat, key) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include map_fragment', '#include map_fragment\n  if (!gl_FrontFacing) diffuseColor.rgb *= vec3(1.3, 1.36, 1.12);')
      .replace('#include roughnessmap_fragment', '#include roughnessmap_fragment\n  if (!gl_FrontFacing) roughnessFactor = min(1.0, roughnessFactor + 0.3);');
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// ── Casting onto the stone ────────────────────────────────────────────────────
// A tree of every face the ivy may grow on (`geos`, any frame, merged as
// positions only), and a cast: first hit along a ray, with the face's normal
// turned back toward where the ray came from.
export function stoneCaster(geos) {
  const flat = geos.map((g) => {
    const f = new THREE.BufferGeometry();
    f.setAttribute('position', g.attributes.position.clone());
    if (g.index) f.setIndex(g.index.clone());
    const n = f.index ? f.toNonIndexed() : f;
    if (n !== f) f.dispose();
    return n;
  });
  const geo = mergeGeometries(flat, false);
  flat.forEach((g) => g.dispose());
  const bvh = new MeshBVH(geo);
  const ray = new THREE.Ray();
  return {
    cast(origin, dir, far = 40) {
      ray.origin.copy(origin);
      ray.direction.copy(dir);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, far);
      if (!hit) return null;
      const n = hit.face.normal.clone();
      if (n.dot(dir) > 0) n.negate();
      return { p: hit.point.clone(), n, t: hit.distance };
    },
    dispose() { geo.dispose(); },
  };
}

// ── Growing ivy over a sheet of stone ─────────────────────────────────────────
// A sheet is a way of finding the stone from a point (u, v) of a plane laid
// over it: `ray(u, v)` gives the ray that finds it, `allow(u, v)` whether ivy
// grows there at all. `v` is up the sheet: stems climb toward +v, and wander.
// Each seed is a root: [u, v, heading, length, vigour].
//
// Returns stems — lists of { p, n, r } nodes in the caster's frame, from the
// root out — and leaves { p, q, s, young } (q: a quaternion; the leaf's frame
// as ivyLeafGeometry has it).
export function growIvy(caster, sheets, rng, { step = 0.55 } = {}) {
  const R = (a, b) => a + (b - a) * rng();
  const stems = [], leaves = [];
  const o = V(), d = V();
  const probe = (sheet, u, v) => {
    sheet.ray(u, v, o, d);
    return caster.cast(o, d, sheet.far ?? 40);
  };
  for (const sheet of sheets) {
    // (each sheet its own budget of leaves: `max`)
    const cap = leaves.length + (sheet.max ?? Infinity);
    const queue = sheet.seeds.map(([u, v, th, len, vigour]) => ({ u, v, th, len, vigour, r: 0.16 + 0.22 * vigour, depth: 0 }));
    while (queue.length && leaves.length < cap) {
      const st = queue.shift();
      let { u, v, th } = st;
      let hit = probe(sheet, u, v);
      if (!hit) continue;
      const nodes = [{ p: hit.p.clone(), n: hit.n.clone(), t: hit.t, u, v }];
      const steps = Math.floor(st.len / step);
      for (let i = 0; i < steps; i++) {
        // wander, and lean back toward climbing (or toward the sheet's own drift)
        th += (rng() - 0.5) * 0.55;
        th += ((sheet.drift ?? 0) - th) * 0.06;
        let nu = u + Math.sin(th) * step, nv = v + Math.cos(th) * step;
        if (!sheet.allow(nu, nv)) {
          // feel round the obstacle once, either way
          const turn = rng() < 0.5 ? 0.9 : -0.9;
          th += turn;
          nu = u + Math.sin(th) * step; nv = v + Math.cos(th) * step;
          if (!sheet.allow(nu, nv)) break;
        }
        const h = probe(sheet, nu, nv);
        if (!h) break;
        const prev = nodes[nodes.length - 1];
        const jump = h.t - prev.t;
        if (Math.abs(jump) > 3.2) break;
        // over an arris: a node at the corner, so the stem does not cut it
        if (Math.abs(jump) > 0.3) {
          const at = jump < 0 ? [u, v] : [nu, nv], tt = Math.min(prev.t, h.t);
          sheet.ray(at[0], at[1], o, d);
          nodes.push({ p: o.clone().addScaledVector(d, tt), n: (jump < 0 ? h.n : prev.n).clone().add(d.clone().negate()).normalize(), t: tt, u: at[0], v: at[1] });
        }
        u = nu; v = nv;
        nodes.push({ p: h.p.clone(), n: h.n.clone(), t: h.t, u, v });
        // fork: the branch goes off at an angle, with less length left to it
        const left = st.len - (i + 1) * step;
        if (st.depth < 4 && left > 4 && rng() < (sheet.fork ?? 0.075)) {
          queue.push({ u, v, th: th + (rng() < 0.5 ? -1 : 1) * R(0.45, 1.15), len: left * R(0.45, 0.85), vigour: st.vigour * 0.6, r: 0, depth: st.depth + 1, parentR: true });
        }
      }
      if (nodes.length < 3) continue;
      // radius: thick at the root, thin at the tip; a branch starts at most as thick as it is long
      const total = nodes.length;
      const r0 = st.depth === 0 ? st.r : Math.min(0.16, 0.05 + st.len * 0.006);
      nodes.forEach((nd, k) => {
        const f = k / (total - 1);
        nd.r = 0.045 + (r0 - 0.045) * (1 - f) ** 1.4;
        // the stem lies ON the stone, its own thickness off it
        nd.p.addScaledVector(nd.n, nd.r * 0.9 + 0.04);
      });
      stems.push(nodes);
      // leaves along it
      let along = R(0, 0.6), side = rng() < 0.5 ? 1 : -1, run = 0;
      const T = V(), S = V(), N = V(), tip = V(), m = new THREE.Matrix4(), X = V();
      for (let k = 1; k < total && leaves.length < cap; k++) {
        const a = nodes[k - 1], b = nodes[k], seg = a.p.distanceTo(b.p);
        run += seg;
        while (run >= along && leaves.length < cap) {
          const f = k / (total - 1);
          T.subVectors(b.p, a.p).normalize();
          N.copy(b.n);
          S.crossVectors(N, T).normalize();
          side = -side;
          // size: big low on the old stems, small at the growing tips
          const young = f > 0.82;
          const size = (young ? R(0.55, 0.85) : R(0.95, 1.55)) * (sheet.scale ?? 1) * (1 - 0.2 * Math.min(1, st.depth / 3));
          const stalk = size * R(0.45, 0.9);
          const base = b.p.clone().addScaledVector(N, stalk * 0.5).addScaledVector(S, side * stalk * 0.55).addScaledVector(T, stalk * 0.1);
          // the face turned out from the stone and up toward the sky's light
          const face = N.clone().multiplyScalar(1).addScaledVector(sheet.light ?? Y, R(0.25, 0.6)).addScaledVector(S, side * R(0, 0.3));
          face.x += R(-0.25, 0.25); face.y += R(-0.2, 0.2); face.z += R(-0.25, 0.25);
          face.normalize();
          // the tip: down and out to the stalk's side on a wall, along the stem on the ground
          tip.copy(sheet.hang ?? Y).multiplyScalar(-0.75).addScaledVector(S, side * R(0.3, 0.9)).addScaledVector(T, R(-0.2, 0.3));
          tip.addScaledVector(face, -tip.dot(face));
          if (tip.lengthSq() < 1e-4) tip.copy(S);
          tip.normalize();
          X.crossVectors(tip, face).normalize();
          m.makeBasis(X, tip, face);
          leaves.push({ p: base, q: new THREE.Quaternion().setFromRotationMatrix(m), s: size * R(0.92, 1.08), young, f });
          along += R(0.5, 0.78) * (young ? 0.8 : 1);
        }
      }
    }
  }
  return { stems, leaves };
}

// A strand hanging free from a point: down, swaying, its leaves turned out to
// `out`. Nodes and leaves as growIvy gives them.
export function hangIvy(from, out, len, rng) {
  const R = (a, b) => a + (b - a) * rng();
  const nodes = [], leaves = [];
  const p = from.clone(), sway = R(0, 6.28), m = new THREE.Matrix4();
  for (let i = 0; i * 0.6 <= len; i++) {
    const f = (i * 0.6) / len;
    nodes.push({ p: p.clone().add(V(Math.sin(sway + f * 3) * 0.4 * f, 0, Math.cos(sway + f * 2.3) * 0.3 * f)).addScaledVector(out, 0.4 * Math.sin(f * 2)), n: out.clone(), r: 0.13 * (1 - f) + 0.04 });
    p.y -= 0.6;
  }
  let side = 1;
  for (let k = 1; k < nodes.length; k++) {
    const f = k / (nodes.length - 1);
    side = -side;
    const S = V().crossVectors(out, Y).normalize();
    const size = R(0.6, 1.05) * (1 - f * 0.3);
    const face = out.clone().addScaledVector(Y, R(0.1, 0.5)).addScaledVector(S, side * R(0.1, 0.5)).normalize();
    const tip = V(0, -1, 0).addScaledVector(S, side * R(0.4, 1));
    tip.addScaledVector(face, -tip.dot(face)).normalize();
    m.makeBasis(V().crossVectors(tip, face).normalize(), tip, face);
    leaves.push({ p: nodes[k].p.clone().addScaledVector(S, side * size * 0.4).addScaledVector(out, size * 0.25), q: new THREE.Quaternion().setFromRotationMatrix(m), s: size, young: f > 0.8, f });
  }
  return { nodes, leaves };
}

// ── The wisteria's trunk, round a post ────────────────────────────────────────
// In the post's frame (x, z its axis; y up). Out of the ground beside the
// plinth, over its edge, then twined up the post `turns` times as two strands
// twisted on each other — a vine that old is a rope of its own stems — to
// `top`, where `over` (points) takes it over the beams. Returns the strands as
// node lists, the compound leaves as leaflets { p, q, s }, and a few young
// shoots (node lists) reaching out into the air.
export function twineWisteria({ x, z, postR, foot, plinthR, ground, top, turns, endAngle = null, over = [] }, rng) {
  const R = (a, b) => a + (b - a) * rng();
  const phase = R(0, 6.28), lean = Math.sign(x) || 1;
  const spine = [];
  // out of the ground off the middle of one of the plinth's faces (never its
  // corner, which stands out further), up it and onto the drum
  const a0 = Math.round(phase / (Math.PI / 2)) * (Math.PI / 2) + R(-0.3, 0.3);
  const at = (a, r, y) => V(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
  spine.push(at(a0, plinthR + 0.9, ground - 0.6), at(a0, plinthR + 0.75, ground + 0.4), at(a0 + 0.1, plinthR + 0.5, ground + 1.6), at(a0 + 0.2, foot.r + 0.9, foot.y + 0.3), at(a0 + 0.3, postR + 0.85, foot.y + 1.6));
  const y0 = foot.y + 1.6, N = 60;
  // so many turns, give or take what ends the twining where `over` leaves the post
  let total = turns * Math.PI * 2 * lean;
  if (endAngle !== null) {
    const miss = endAngle - (a0 + 0.3 + total);
    total += Math.atan2(Math.sin(miss), Math.cos(miss));
  }
  for (let k = 1; k <= N; k++) {
    const f = k / N, y = y0 + f * (top - y0) + Math.sin(f * 11 + phase) * 0.9;
    const a = a0 + 0.3 + (f + Math.sin(f * 7.3 + phase * 2) * 0.035) * total;
    // thinner as it climbs, so it sits closer to the post
    const r = postR + 0.25 + 0.6 * (1 - f) + Math.max(0, Math.sin(f * 13 + phase)) * 0.35;
    spine.push(at(a, r, y));
  }
  spine.push(...over);
  const curve = new THREE.CatmullRomCurve3(spine);
  const L = curve.getLength(), n = Math.max(40, Math.round(L / 0.45));
  const pts = curve.getSpacedPoints(n), frames = curve.computeFrenetFrames(n, false);
  // two strands about the spine, twisted round each other; the second runs
  // out a little before the top and the first goes on alone
  const strands = [[], []];
  // (a full twist every five to seven units: slower, and the two lay side by side as a strap)
  const twist = R(0.9, 1.25);
  for (let i = 0; i <= n; i++) {
    const f = i / n, s = i * L / n;
    const radius = 0.62 - 0.42 * f ** 0.7;
    const ang = s * twist + phase;
    const T = frames.tangents[i];
    // a reference across the strand that does not spin with the Frenet frame:
    // outward from the post's axis, square to the tangent
    const out = V(pts[i].x - x, 0, pts[i].z - z);
    if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
    out.normalize().addScaledVector(T, -out.dot(T)).normalize();
    const B = V().crossVectors(T, out);
    for (const [k, st] of strands.entries()) {
      if (k === 1 && f > 0.82) continue;
      const a = ang + k * Math.PI, off = radius * 0.5;
      st.push({ p: pts[i].clone().addScaledVector(out, Math.cos(a) * off).addScaledVector(B, Math.sin(a) * off), r: (k === 1 ? 0.75 : 1) * radius * 0.62 * (1 + 0.08 * Math.sin(s * 1.7 + k)) });
    }
  }
  // Leaves: compound, a rachis with leaflets in pairs and one at its end,
  // springing from the upper post and the run over the top; and the loose
  // shoots, twining about nothing.
  const leaflets = [], shoots = [];
  const compound = (base, dir, len, scale) => compoundLeaf(base, dir, len, scale, rng, leaflets);
  const main = strands[0];
  for (let i = 0; i < main.length; i++) {
    const p = main[i].p;
    if (p.y < top - 13 || rng() > 0.3) continue;
    const out = V(p.x - x, R(-0.2, 0.6), p.z - z).normalize();
    compound(p.clone().addScaledVector(out, 0.3), out.clone().add(V(R(-0.4, 0.4), R(-0.1, 0.3), R(-0.4, 0.4))).normalize(), R(2.4, 3.6), R(0.85, 1.15));
  }
  for (let s = 0; s < 3; s++) {
    const from = main[Math.floor(main.length * R(0.62, 0.95))];
    const out = V(from.p.x - x, 0, from.p.z - z).normalize();
    const nodes = [], h = R(0.5, 0.9), len = R(4, 7);
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      nodes.push({ p: from.p.clone().addScaledVector(out, f * len).add(V(Math.cos(f * 9 + s) * h * f, f * len * R(0.1, 0.25) + Math.sin(f * 9 + s) * h * f, 0)), r: 0.12 * (1 - f) + 0.035 });
    }
    shoots.push(nodes);
    for (let i = 3; i < 14; i += 3) compound(nodes[i].p, out.clone().add(V(R(-0.5, 0.5), R(-0.3, 0.2), R(-0.5, 0.5))).normalize(), R(1.6, 2.6), R(0.6, 0.85));
  }
  return { strands, leaflets, shoots };
}

// A wisteria leaf: a rachis from `base` along `dir` for `len`, drooping
// toward its end, with leaflets in pairs and one at its tip, pushed onto
// `out` as { p, q, s } (q: leafletGeometry's frame).
export function compoundLeaf(base, dir, len, scale, rng, out) {
  const R = (a, b) => a + (b - a) * rng();
  const m = new THREE.Matrix4();
  const pairs = Math.round(R(4, 6));
  const droop = V(0, -1, 0);
  for (let j = 0; j <= pairs; j++) {
    const f = j / pairs;
    const along = dir.clone().addScaledVector(droop, f * f * 0.6).normalize();
    const p = base.clone().addScaledVector(dir, len * f).addScaledVector(droop, len * f * f * 0.35);
    const side = V().crossVectors(along, Y);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const face = V().crossVectors(side, along).normalize();
    if (face.y < 0) face.negate();
    for (const sgn of j === pairs ? [0] : [-1, 1]) {
      const tip = sgn === 0 ? along.clone() : side.clone().multiplyScalar(sgn).addScaledVector(along, 0.45).addScaledVector(droop, R(0.1, 0.5)).normalize();
      const fc = face.clone().addScaledVector(tip, -face.dot(tip)).normalize();
      m.makeBasis(V().crossVectors(tip, fc).normalize(), tip, fc);
      out.push({ p: p.clone(), q: new THREE.Quaternion().setFromRotationMatrix(m), s: scale * (sgn === 0 ? 1.1 : R(0.85, 1.05)) * (0.75 + 0.25 * Math.sin(Math.PI * (0.3 + f * 0.7))) });
    }
  }
}
