// ── The heart of the maze ─────────────────────────────────────────────────────
// How the walk ends. It used to end a step short of a plinth in a corridor of
// the maze, facing a turning gold armillary the size of a desk toy, and a
// button that said "The end of the walk" and did nothing. Now the heart is a
// court (buildWorld cuts it out of the maze), and stepping into it is the last
// thing the reader does:
//
//   the heart catches   the armillary spins up and flares, and its light runs
//                       out down every way through the maze at once — every
//                       fork taken, dead ends and all: "he chooses —
//                       simultaneously — all of them"
//   the others          where the light has passed, readers who were not there
//                       a moment ago walk in by the ways the reader did not
//                       take and stop at the edge of the court, facing them;
//                       the last one stands in the gate the reader came in by
//   the rise            up out of the maze, a net of light now, and on over the
//                       whole walk as the light runs back along it — the
//                       bridge, the pergola, the leap to the Vertigo, the
//                       galleries — and out along the road not taken, to the map
//
// This file builds what is there only for that: the light on the maze's floor
// (a distance field from the heart, so it runs round corners as light in a
// corridor would, and never through a hedge), the fireflies it wakes, the
// thread along the walk, and the others. World.jsx moves the camera
// (finaleMove) and hands this the film's time every frame; everything here is
// a function of that time, so any moment of it can be held and looked at.
import * as THREE from 'three';
import { makeRng } from './textures';
import { readerGeometry, ROBES, clothShader } from './readers';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const WARM = new THREE.Color('#ffb25a');
const HOT = new THREE.Color('#fff1c9');

// The film, in seconds from the step into the court.
export const FINALE = {
  walk: 5,              // from the gate to the heart
  ignite: 5.2,          // the heart catches
  flood: 42,            // how fast its light runs down a corridor, units a second
  rise: [18.2, 34],     // out of the maze and up to the map
  end: 34,
};

// What the caption says, and when (EntryMap): the step in, the others, the one
// in the reader's own gate, the rise, and the last seconds, when it goes too.
export const finalePhase = (t) => (t < FINALE.ignite ? 'walk'
  : t < 11.8 ? 'others'
    : t < FINALE.rise[0] ? 'you'
      : t < FINALE.end - 2.8 ? 'rise' : 'leave');

// ── How far the light has to run to each point of the maze ──────────────────
// One texel a unit over the maze and a margin round it: the shortest way from
// the heart to every point a reader could stand on, round the hedges, and
// (for the shader) how clear of a hedge that point is. The court floods as a
// ring — its texels start at their straight-line distance from the heart —
// and the corridors from there, sixteen ways out of every texel, so a front
// running down one stays square to it.
const PAD = 8;
const STEPS = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2],
].map(([i, j]) => [i, j, Math.hypot(i, j)]);

function floodField({ MZ, rects, heart, court, mouths }) {
  const x0 = MZ.x0 - PAD, z0 = MZ.z0 - PAD;
  const W = MZ.cols * MZ.cw + 2 * PAD, H = MZ.rows * MZ.ch + 2 * PAD, n = W * H;
  const clear = new Float32Array(n), walk = new Uint8Array(n);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = x0 + i + 0.5, z = z0 + j + 0.5;
      let m = Infinity;
      for (const r of rects) {
        const dx = Math.max(r[0] - x, 0, x - r[2]), dz = Math.max(r[1] - z, 0, z - r[3]);
        m = Math.min(m, dx * dx + dz * dz);
      }
      const k = j * W + i;
      clear[k] = Math.sqrt(m);
      const inMaze = x > MZ.x0 && x < MZ.x0 + MZ.cols * MZ.cw && z < MZ.z0 + MZ.rows * MZ.ch;
      const outside = z <= MZ.z0 && mouths.some(([a, b]) => x > a && x < b);
      walk[k] = clear[k] > 1.5 && ((inMaze && z > MZ.z0) || outside) ? 1 : 0;
    }
  }
  // (Float64, as the sums are: a Float32 that rounds a stored distance UP lets
  // every other path of the same length through `nd < dist` again, and on a
  // grid the paths of one length are beyond counting — it never finished.)
  const dist = new Float64Array(n).fill(Infinity);
  // a binary heap of texels by distance (lazy: a texel may be in it twice)
  const hk = [], hd = [];
  const push = (k, d) => {
    let c = hk.length;
    hk.push(k); hd.push(d);
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (hd[p] <= d) break;
      hk[c] = hk[p]; hd[c] = hd[p]; c = p;
    }
    hk[c] = k; hd[c] = d;
  };
  const pop = () => {
    const k = hk[0], d = hd[0], lk = hk.pop(), ld = hd.pop();
    if (hk.length) {
      let c = 0;
      for (;;) {
        let s = 2 * c + 1;
        if (s >= hk.length) break;
        if (s + 1 < hk.length && hd[s + 1] < hd[s]) s += 1;
        if (hd[s] >= ld) break;
        hk[c] = hk[s]; hd[c] = hd[s]; c = s;
      }
      hk[c] = lk; hd[c] = ld;
    }
    return [k, d];
  };
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = x0 + i + 0.5, z = z0 + j + 0.5, k = j * W + i;
      if (walk[k] && x > court[0] && x < court[2] && z > court[1] && z < court[3]) {
        dist[k] = Math.hypot(x - heart[0], z - heart[1]);
        push(k, dist[k]);
      }
    }
  }
  while (hk.length) {
    const [k, d] = pop();
    if (d > dist[k]) continue;
    const i = k % W, j = (k - i) / W;
    for (const [di, dj, w] of STEPS) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      const kk = jj * W + ii;
      // a knight's move may not jump a corner
      if (!walk[kk] || (w > 1.5 && (!walk[j * W + ii] && !walk[jj * W + i]))) continue;
      const nd = d + w;
      if (nd < dist[kk]) { dist[kk] = nd; push(kk, nd); }
    }
  }
  // Out into the hedge a little way, so the texture blends at their feet
  // instead of running up against a wall of "never".
  for (let pass = 0; pass < 8; pass++) {
    const was = dist.slice();
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (Number.isFinite(was[k])) continue;
        let m = Infinity;
        for (let q = 0; q < 4; q++) {
          const [di, dj] = STEPS[q];
          const ii = i + di, jj = j + dj;
          if (ii >= 0 && jj >= 0 && ii < W && jj < H) m = Math.min(m, was[jj * W + ii] + 1);
        }
        dist[k] = m;
      }
    }
  }
  const data = new Uint16Array(n * 2);
  let far = 0;
  for (let k = 0; k < n; k++) {
    const d = Number.isFinite(dist[k]) ? dist[k] : 4000;
    if (walk[k]) far = Math.max(far, d);
    data[2 * k] = THREE.DataUtils.toHalfFloat(d);
    data[2 * k + 1] = THREE.DataUtils.toHalfFloat(walk[k] ? smooth(1.2, 4.5, clear[k]) : 0);
  }
  const texture = new THREE.DataTexture(data, W, H, THREE.RGFormat, THREE.HalfFloatType);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const at = (x, z) => {
    const i = Math.min(W - 1, Math.max(0, Math.floor(x - x0))), j = Math.min(H - 1, Math.max(0, Math.floor(z - z0)));
    return dist[j * W + i];
  };
  const open = (x, z, min = 0.9) => {
    const i = Math.floor(x - x0), j = Math.floor(z - z0);
    return i >= 0 && j >= 0 && i < W && j < H && walk[j * W + i] && smooth(1.2, 4.5, clear[j * W + i]) >= min;
  };
  return { texture, origin: [x0, z0], size: [W, H], at, open, far };
}

// ── The light on the floor ────────────────────────────────────────────────────
// Laid over the gravel and the court's stone as light coming back off them:
// behind the running edge a steady glow with a slow swell moving outward
// through it, and at the edge itself the hot line of a fuse.
const floorVertex = /* glsl */ `
  uniform vec2 uOrigin;
  uniform vec2 uSize;
  varying vec2 vUv;
  varying vec2 vXZ;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vUv = (w.xz - uOrigin) / uSize;
    vXZ = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const floorFragment = /* glsl */ `
  uniform sampler2D uField;
  uniform float uFront;
  uniform float uTime;
  uniform float uLevel;
  uniform vec3 uWarm;
  uniform vec3 uHot;
  varying vec2 vUv;
  varying vec2 vXZ;
  float fHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 f = texture2D(uField, vUv).rg;
    float behind = uFront - f.r;
    if (behind <= 0.0 || f.g < 0.01) discard;
    float lit = smoothstep(0.0, 16.0, behind);
    float e = (behind - 6.0) / 7.0;
    float edge = exp(-e * e);
    // Rings of it still running outward down the corridors long after the
    // front has passed, and lying in pools where the fireflies hang thickest
    // — slowly drifting. (Held even, the lit maze read from above as a floor
    // painted cream.)
    float swell = 0.72 + 0.34 * sin(f.r * 0.07 - uTime * 1.1);
    float pools = 0.45 + 0.9 * fNoise(vXZ * 0.045 + vec2(uTime * 0.03, -uTime * 0.02)) * fNoise(vXZ * 0.11 - uTime * 0.05);
    // (less on the court's stone, which the heart's own lamp is lighting)
    float court = mix(0.45, 1.0, smoothstep(30.0, 52.0, f.r));
    vec3 c = uWarm * lit * 0.26 * swell * pools * court + uHot * edge * 0.9;
    gl_FragColor = vec4(c * f.g * uLevel, 1.0);
  }
`;

// ── The fireflies it wakes ────────────────────────────────────────────────────
// Asleep on the ground until the light reaches them; then they rise off it,
// brightest in the moment it passes, and hang in the corridors. Never less
// than a pixel and a half, so from the map the maze still sparkles.
const flyVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uFront;
  uniform float uLevel;
  uniform float uGround;
  attribute float aDist;
  attribute float aPhase;
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    float behind = uFront - aDist;
    float born = smoothstep(0.0, 34.0, behind);
    vec3 p = position;
    p.y = mix(uGround + 0.8, position.y, born);
    float t = uTime * 0.7;
    p += vec3(sin(t * 0.6 + aPhase), sin(t * 0.9 + aPhase * 1.3) * 0.5, cos(t * 0.5 + aPhase)) * 4.0 * born;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float e = (behind - 12.0) / 14.0;
    float flash = exp(-e * e);
    float pulse = 0.45 + 0.55 * max(0.0, sin(uTime * 0.95 + aPhase * 3.0));
    vColor = aColor * (born * pulse * 0.8 + flash * 1.6) * uLevel;
    gl_PointSize = behind > 0.0 ? clamp(aSize * uScale / max(1.0, -mv.z), 1.5, 48.0) : 0.0;
    gl_Position = projectionMatrix * mv;
  }
`;
const flyFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float soft = 1.0 - smoothstep(0.0, 1.0, r);
    float core = 1.0 - smoothstep(0.0, 0.3, r);
    gl_FragColor = vec4(vColor * (soft * soft * 0.55 + core * 1.3), 1.0);
  }
`;

// ── The thread ────────────────────────────────────────────────────────────────
// The walk, backwards: a ribbon turned to face the eye all along its length
// (so it reads from overhead and from the side alike), never thinner than a
// pixel or two however far off the eye is, lit from the maze's mouth outward
// as the front passes.
const threadVertex = /* glsl */ `
  uniform float uScale;
  uniform float uWidth;
  uniform float uMinPx;
  attribute vec3 aTangent;
  attribute float aSide;
  attribute float aDist;
  varying float vSide;
  varying float vDist;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 t = (modelViewMatrix * vec4(aTangent, 0.0)).xyz;
    vec3 s = cross(t, normalize(mv.xyz));
    float sl = length(s);
    s = sl > 1e-5 ? s / sl : vec3(1.0, 0.0, 0.0);
    float ppu = uScale / max(1.0, -mv.z);
    mv.xyz += s * aSide * max(uWidth, uMinPx / ppu) * 0.5;
    vSide = aSide;
    vDist = aDist;
    gl_Position = projectionMatrix * mv;
  }
`;
const threadFragment = /* glsl */ `
  uniform float uFront;
  uniform float uTime;
  uniform float uStrength;
  uniform float uLevel;
  uniform vec3 uWarm;
  uniform vec3 uHot;
  varying float vSide;
  varying float vDist;
  void main() {
    float behind = uFront - vDist;
    if (behind <= 0.0) discard;
    float across = exp(-vSide * vSide * 3.0);
    float lit = smoothstep(0.0, 30.0, behind);
    float h = (behind - 22.0) / 50.0;
    float head = exp(-h * h);
    float run = 0.78 + 0.22 * sin(vDist * 0.05 - uTime * 2.0);
    vec3 c = (uWarm * lit * run + uHot * head * 1.4) * across * uStrength * uLevel;
    gl_FragColor = vec4(c, 1.0);
  }
`;

// A polyline's corners cut, `n` times over (Chaikin), its ends kept. The walk's
// legs keep to the rooms' corners a few units off each one; seen from above as
// one line of light those kinks made it a lightning bolt.
const rounded = (pts, n = 3) => {
  let out = pts;
  for (let k = 0; k < n; k++) {
    const next = [out[0]];
    for (let i = 0; i + 1 < out.length; i++) {
      const a = out[i], b = out[i + 1];
      next.push(a.map((x, j) => x * 0.75 + b[j] * 0.25), a.map((x, j) => x * 0.25 + b[j] * 0.75));
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
};

// A polyline laid out evenly every `step`, with its running length.
const resample = (pts, step, d0 = 0) => {
  const v = pts.map((p) => new THREE.Vector3(...p)).filter((p, i, all) => i === 0 || p.distanceTo(all[i - 1]) > 0.3);
  const out = [];
  let d = d0;
  for (let i = 0; i + 1 < v.length; i++) {
    const L = v[i].distanceTo(v[i + 1]), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) {
      const p = v[i].clone().lerp(v[i + 1], k / n);
      out.push({ p, d: d + (L * k) / n });
    }
    d += L;
  }
  out.push({ p: v[v.length - 1].clone(), d });
  out.forEach((q, i) => {
    const a = out[Math.max(0, i - 1)].p, b = out[Math.min(out.length - 1, i + 1)].p;
    q.t = b.clone().sub(a).normalize();
  });
  return out;
};

const threadGeometry = (strips) => {
  const pos = [], tan = [], side = [], dist = [], index = [];
  for (const strip of strips) {
    const base = pos.length / 3;
    strip.forEach((q, i) => {
      for (const s of [-1, 1]) {
        pos.push(q.p.x, q.p.y, q.p.z);
        tan.push(q.t.x, q.t.y, q.t.z);
        side.push(s);
        dist.push(q.d);
      }
      if (i) {
        const a = base + (i - 1) * 2, b = base + i * 2;
        index.push(a, a + 1, b, a + 1, b + 1, b);
      }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTangent', new THREE.Float32BufferAttribute(tan, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
};

// Where a strip is at distance d along it.
const along = (strip, d) => {
  if (d <= strip[0].d) return strip[0].p;
  const last = strip[strip.length - 1];
  if (d >= last.d) return last.p;
  let lo = 0, hi = strip.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (strip[mid].d <= d) lo = mid; else hi = mid;
  }
  const a = strip[lo], b = strip[hi];
  return a.p.clone().lerp(b.p, (d - a.d) / Math.max(1e-6, b.d - a.d));
};

// A function of time sampled into a table as it is integrated: the heart's
// extra turn, and how far the light has run along the walk.
const integrate = (rate, end, dt = 0.02) => {
  const out = new Float32Array(Math.ceil(end / dt) + 2);
  for (let i = 1; i < out.length; i++) out[i] = out[i - 1] + rate((i - 0.5) * dt) * dt;
  return (t) => {
    const x = Math.min(out.length - 1.001, Math.max(0, t / dt)), i = Math.floor(x);
    return out[i] + (out[i + 1] - out[i]) * (x - i);
  };
};

// ── The others ────────────────────────────────────────────────────────────────
// Hooded readers (readers.js), walking. They come out of the light rather
// than into it: each is cut out of nothing by a noise that closes from the
// ground up, a hot gold rim running along the cut, and once whole they are
// dark robes lit by the heart and, at the hem, by the floor they stand on.
// Walking, the robe moves with the legs under it and the feet step under the
// hem, as every reader's do (readers.js, clothShader).
const otherShader = (u) => (sh) => {
  clothShader(sh, u);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
      varying vec3 vOther;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vOther = position;`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float uReveal;
      uniform float uFloor;
      varying vec3 vOther;
      float oHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float oNoise(vec3 x) {
        vec3 i = floor(x), f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(oHash(i), oHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(oHash(i + vec3(0.0, 1.0, 0.0)), oHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
          mix(mix(oHash(i + vec3(0.0, 0.0, 1.0)), oHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(oHash(i + vec3(0.0, 1.0, 1.0)), oHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
          f.z);
      }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float oUp = clamp(vOther.y / 18.0, 0.0, 1.0);
      float oCut = uReveal * 1.3 - 0.15;
      float oN = mix(oNoise(vOther * vec3(0.7, 0.35, 0.7)), oUp, 0.55);
      if (oN > oCut) discard;
      float oRim = 1.0 - smoothstep(0.0, 0.06, oCut - oN);
      // the rim of the cut, and the lit floor's light coming up onto the hem
      // (as the cloth's own colour gives it back: added flat, it turned the
      // dark robes to pale ghosts from the knee down)
      totalEmissiveRadiance += vec3(1.0, 0.7, 0.34) * oRim * 3.0
        + vColor.rgb * vec3(1.0, 0.8, 0.55) * uFloor * pow(1.0 - oUp, 2.0) * 2.4;`);
};

// (A step was 11 — a metre — when the robe had no feet under it; with them,
// a foot out that far stood clear of the hem.)
const STRIDE = 8;

export function buildFinale({
  root, keep, light = false,
  maze: { MZ, grid, rects, court, heart, ground, entry },
  stand, inside, route, branch, glowTex, heartParts,
}) {
  const group = new THREE.Group();
  group.name = 'finale';
  group.visible = false;
  root.add(group);
  const rng = makeRng(8128);
  const R = (a, b) => a + (b - a) * rng();
  const { cw, ch } = MZ;
  const cellC = (c, r) => [MZ.x0 + (c + 0.5) * cw, MZ.z0 + (r + 0.5) * ch];

  // ── The field and the floor ─────────────────────────────────────────────
  const mouths = grid[0].map((g, c) => (g.n ? null : [MZ.x0 + c * cw, MZ.x0 + (c + 1) * cw])).filter(Boolean);
  const courtBox = [MZ.x0 + court.c0 * cw, MZ.z0 + court.r0 * ch, MZ.x0 + (court.c1 + 1) * cw, MZ.z0 + (court.r1 + 1) * ch];
  const field = floodField({ MZ, rects, heart, court: courtBox, mouths });
  keep(field.texture);
  const floorMat = keep(new THREE.ShaderMaterial({
    uniforms: {
      uField: { value: field.texture },
      uOrigin: { value: new THREE.Vector2(...field.origin) },
      uSize: { value: new THREE.Vector2(...field.size) },
      uFront: { value: 0 }, uTime: { value: 0 }, uLevel: { value: 1 },
      uWarm: { value: WARM.clone() }, uHot: { value: HOT.clone() },
    },
    vertexShader: floorVertex,
    fragmentShader: floorFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const floorGeo = keep(new THREE.PlaneGeometry(field.size[0], field.size[1]));
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(field.origin[0] + field.size[0] / 2, ground + 0.75, field.origin[1] + field.size[1] / 2);
  floor.renderOrder = 2;
  floor.name = 'finale-floor';
  group.add(floor);

  // ── The fireflies ───────────────────────────────────────────────────────
  const flies = [];
  for (let tries = 0; flies.length < (light ? 380 : 900) && tries < 20000; tries++) {
    const x = R(field.origin[0], field.origin[0] + field.size[0]), z = R(field.origin[1], field.origin[1] + field.size[1]);
    if (!field.open(x, z)) continue;
    flies.push({ x, z, y: ground + 3 + 22 * rng() ** 0.8, d: field.at(x, z) });
  }
  const flyGeo = keep(new THREE.BufferGeometry());
  flyGeo.setAttribute('position', new THREE.Float32BufferAttribute(flies.flatMap((f) => [f.x, f.y, f.z]), 3));
  flyGeo.setAttribute('aDist', new THREE.Float32BufferAttribute(flies.map((f) => f.d), 1));
  flyGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(flies.map(() => R(0, 100)), 1));
  flyGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(flies.map(() => R(1.8, 3.6)), 1));
  const tint = ['#fff2a4', '#ffe08a', '#ffd9a0', '#f4ff9c'].map((c) => new THREE.Color(c));
  flyGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(flies.flatMap(() => tint[Math.floor(rng() * tint.length)].toArray()), 3));
  const flyMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 500 }, uFront: { value: 0 }, uLevel: { value: 1 }, uGround: { value: ground } },
    vertexShader: flyVertex,
    fragmentShader: flyFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const fireflies = new THREE.Points(flyGeo, flyMat);
  fireflies.frustumCulled = false;
  fireflies.renderOrder = 6;
  group.add(fireflies);

  // ── The thread ──────────────────────────────────────────────────────────
  // It starts where the light leaves the maze, so its distances carry on from
  // the field's; the road not taken carries on from the fork.
  const mouth = field.at(entry[0], MZ.z0 - 2);
  const main = resample(rounded(route), 2.5, mouth);
  let fork = main[0];
  for (const q of main) if (Math.hypot(q.p.x - branch.at[0], q.p.z - branch.at[1]) < Math.hypot(fork.p.x - branch.at[0], fork.p.z - branch.at[1])) fork = q;
  const side = resample(rounded([[fork.p.x, fork.p.y, fork.p.z], ...branch.pts]), 2.5, fork.d);
  const threadGeo = keep(threadGeometry([main, side]));
  const threadMat = (width, minPx, strength) => keep(new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: 500 }, uWidth: { value: width }, uMinPx: { value: minPx },
      uFront: { value: 0 }, uTime: { value: 0 }, uStrength: { value: strength }, uLevel: { value: 1 },
      uWarm: { value: WARM.clone() }, uHot: { value: HOT.clone() },
    },
    vertexShader: threadVertex,
    fragmentShader: threadFragment,
    transparent: true,
    depthWrite: false,
    // (the world starts over the map: see setEyeLevel)
    depthTest: false,
    // (built facing the eye, but wound clockwise on the screen: one-sided,
    // every triangle of it was culled as a back face)
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const threads = [threadMat(16, 9, 0.24), threadMat(3.2, 1.8, 0.85)].map((mat, i) => {
    const m = new THREE.Mesh(threadGeo, mat);
    m.frustumCulled = false;
    m.renderOrder = 7 + i;
    m.name = 'finale-thread';
    group.add(m);
    return m;
  });
  // the running head of it, one on each way
  const heads = [main, side].map((strip) => {
    const mat = keep(new THREE.SpriteMaterial({
      map: glowTex, color: HOT.clone(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    const s = new THREE.Sprite(mat);
    s.renderOrder = 9;
    s.visible = false;
    group.add(s);
    return { s, mat, strip };
  });
  const walkEnd = main[main.length - 1].d, sideEnd = side[side.length - 1].d;

  // How far the light has run: down the maze at the flood's pace from the
  // moment the heart catches; out of the maze's mouth at that pace, easing to
  // a creep along the gravel while the reader is still in the court; and from
  // the rise, gathering, so that it reaches the Library's door — and the end
  // of the road not taken — a little before the camera reaches the map.
  const mazeFront = (t) => Math.max(0, t - FINALE.ignite) * FINALE.flood;
  const tMouth = FINALE.ignite + mouth / FINALE.flood;
  const [r0, r1] = FINALE.rise, arrive = r1 - 2.6;
  const CREEP = 10;
  const hump = (t) => (t > r0 && t < arrive ? Math.sin(Math.PI * (t - r0) / (arrive - r0)) ** 2 : 0);
  const slow = (t) => (t < tMouth ? FINALE.flood : CREEP + (FINALE.flood - CREEP) * Math.exp(-(t - tMouth) / 0.7));
  const before = integrate(slow, r0);
  const need = Math.max(walkEnd, sideEnd) + 40 - (mouth + before(r0) - before(tMouth));
  const humpArea = (arrive - r0) / 2;
  const vmax = Math.max(0, (need - CREEP * (arrive - r0)) / humpArea);
  const walkRun = integrate((t) => (t < tMouth ? 0 : t < r0 ? slow(t) : CREEP + vmax * hump(t)), FINALE.end + 1);
  const walkFront = (t) => (t < tMouth ? mazeFront(t) : mouth + walkRun(t));

  // ── The others ──────────────────────────────────────────────────────────
  // The maze as a tree grown outward from the court: for each gate, the way
  // back from it into the maze along its longest branch. The others start one
  // and two cells up those ways and come in.
  const inCourt = ([c, r]) => c >= court.c0 && c <= court.c1 && r >= court.r0 && r <= court.r1;
  const key = ([c, r]) => `${c},${r}`;
  const parent = new Map();
  const queue = [];
  for (let r = court.r0; r <= court.r1; r++) for (let c = court.c0; c <= court.c1; c++) { parent.set(key([c, r]), null); queue.push([c, r]); }
  const ways = ([c, r]) => {
    const g = grid[r][c], out = [];
    if (r > 0 && !g.n) out.push([c, r - 1]);
    if (r < MZ.rows - 1 && !grid[r + 1][c].n) out.push([c, r + 1]);
    if (c > 0 && !g.w) out.push([c - 1, r]);
    if (c < MZ.cols - 1 && !grid[r][c + 1].w) out.push([c + 1, r]);
    return out;
  };
  while (queue.length) {
    const at = queue.shift();
    for (const nb of ways(at)) {
      if (parent.has(key(nb))) continue;
      parent.set(key(nb), at);
      queue.push(nb);
    }
  }
  const children = (cell) => [...parent].filter(([, p]) => p && key(p) === key(cell)).map(([k]) => k.split(',').map(Number));
  const depthMemo = new Map();
  const depth = (cell) => {
    if (!depthMemo.has(key(cell))) depthMemo.set(key(cell), 1 + Math.max(0, ...children(cell).map(depth)));
    return depthMemo.get(key(cell));
  };
  const branchFrom = (cell, n) => {
    const out = [cell];
    while (out.length < n) {
      const kids = children(out[out.length - 1]).filter((k) => !inCourt(k));
      if (!kids.length) break;
      out.push(kids.sort((a, b) => depth(b) - depth(a))[0]);
    }
    return out;
  };
  const dirOf = (a) => [Math.cos(a), Math.sin(a)];
  const radial = (a, r) => [heart[0] + Math.cos(a) * r, heart[1] + Math.sin(a) * r];
  const STOP = 30;
  const deg = Math.PI / 180;
  // (the gates: the way out of the court, the cell beyond it, and the angle
  // it opens at, seen from the heart)
  const midC = Math.round((court.c0 + court.c1) / 2), midR = Math.round((court.r0 + court.r1) / 2);
  const gates = {
    s: { beyond: [midC, court.r1 + 1], at: [heart[0], courtBox[3]], a: 90 * deg },
    w: { beyond: [court.c0 - 1, midR], at: [courtBox[0], heart[1]], a: 180 * deg },
    e: { beyond: [court.c1 + 1, midR], at: [courtBox[2], heart[1]], a: 0 },
  };
  const within = (t0, d) => Math.max(t0, FINALE.ignite + d / FINALE.flood + 0.25);
  // [gate, cells up the way, which side of the gate it stops at and how far
  // round (in 22° steps), appears, sets off, arrives]
  // (The two from the south come through the gate straight across the court
  // from the reader, behind the plinth, one after the other, and step out
  // from behind it either side of the armillary while the reader is still
  // looking at the heart — so they stand wider apart than the rest.)
  const cast = [
    ['s', 1, -1.7, 6.8, 7.2, 9.3],
    ['s', 1, 1.7, 7.7, 8.1, 10.3],
    ['e', 1, 1, 7.1, 7.6, 11.0],
    ['w', 1, 1, 7.6, 8.1, 11.6],
    ['e', 3, -1, 8.6, 9.1, 13.8],
    ['w', 2, -1, 8.3, 8.8, 13.2],
  ];
  const reader = new THREE.Vector3(inside[0], ground, inside[1]);
  // The soft dark each stands in: without it they stood ON the lit floor,
  // cut out and pasted there. Drawn after the floor's light, so it darkens that too.
  const shadowTex = (() => {
    const N = 64, data = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const r = Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2) / (N / 2);
        data.set([255, 255, 255, Math.round(255 * (1 - smooth(0.15, 1, r)) ** 1.6)], (j * N + i) * 4);
      }
    }
    const t = new THREE.DataTexture(data, N, N);
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return keep(t);
  })();
  const shadowGeo = keep(new THREE.PlaneGeometry(8, 7).rotateX(-Math.PI / 2));
  const makeOther = (points, when, name, i, book = false) => {
    const u = { uReveal: { value: 0 }, uFloor: { value: 0 }, uStride: { value: 0 }, uMove: { value: 0 }, uReach: { value: STRIDE / 2 } };
    // Wool, matt: the shade of the folds is in the vertices, the nap and the
    // fuzz in clothShader. (MeshPhysical's own sheen was tried and is not
    // per-vertex: it lit the black inside of the hood as a pale bald head and
    // turned every robe to pale suede.)
    // Both sides: the hood's cloth is seen from inside through its opening,
    // and one-sided, whichever way its sheet was wound, part of it went.
    const mat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide }));
    mat.onBeforeCompile = otherShader(u);
    mat.customProgramCacheKey = () => 'babel-other';
    const mesh = new THREE.Mesh(keep(readerGeometry({ seed: 11 + i * 7, color: ROBES[i % ROBES.length], book })), mat);
    mesh.name = name;
    mesh.visible = false;
    group.add(mesh);
    const shadow = new THREE.Mesh(shadowGeo, keep(new THREE.MeshBasicMaterial({
      color: '#000000', map: shadowTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    })));
    shadow.renderOrder = 3;
    shadow.visible = false;
    group.add(shadow);
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, ground, z)), false, 'centripetal');
    return { mesh, shadow, u, curve, L: curve.getLength(), ...when };
  };
  const others = cast.map(([g, n, s, show, go, arrive], i) => {
    const gate = gates[g];
    const cells = branchFrom(gate.beyond, n);
    const start = cells[cells.length - 1];
    const stop = radial(gate.a + s * 22 * deg, STOP);
    const inward = dirOf(gate.a + Math.PI);
    const pts = [...cells.slice().reverse().map(([c, r]) => cellC(c, r)), [gate.at[0] + inward[0] * 3, gate.at[1] + inward[1] * 3], stop];
    const t0 = within(show, field.at(...cellC(...start)));
    // (two of them carrying a book)
    return makeOther(pts, { show: t0, go: Math.max(go, t0 + 0.5), arrive: Math.max(arrive, t0 + 2.5) }, `finale-other-${i}`, i, i === 1 || i === 5);
  });
  // ...and the one who stands where the reader came in: a few paces up the
  // corridor from where they stood at the gate looking in, come a step
  // nearer, and still. (On the very spot, it stood so near that it filled
  // the gate.)
  const toGate = [inside[0] - stand.eye[0], inside[1] - stand.eye[2]];
  const gl = Math.hypot(...toGate);
  const youAt = [stand.eye[0] - (toGate[0] / gl) * 8, stand.eye[2] - (toGate[1] / gl) * 8];
  const youTo = [youAt[0] + (toGate[0] / gl) * 2, youAt[1] + (toGate[1] / gl) * 2];
  // (and a book: the reader's own)
  others.push(makeOther([[youAt[0] - (toGate[0] / gl) * 2, youAt[1] - (toGate[1] / gl) * 2], youTo], { show: 13.9, go: 14.6, arrive: 16.0 }, 'finale-you', others.length, true));

  const lookAt = new THREE.Vector3();
  const hideOther = (o) => {
    o.mesh.visible = false;
    o.shadow.visible = false;
  };
  const placeOther = (o, t, reveal) => {
    const mesh = o.mesh;
    o.u.uReveal.value = reveal;
    mesh.visible = reveal > 0.001;
    o.shadow.visible = mesh.visible;
    if (!mesh.visible) return;
    const w = clamp01((t - o.go) / (o.arrive - o.go));
    // gathering the step and putting it down, as the reader does: a steady
    // pace between an easing-in over the first sixth and out over the last
    const A = 0.15, v = 1 / (1 - A);
    const s = clamp01(w < A ? (v * w * w) / (2 * A) : w > 1 - A ? 1 - (v * (1 - w) ** 2) / (2 * A) : v * (w - A / 2));
    const p = o.curve.getPointAt(s);
    const moving = w > 0 && w < 1 ? smooth(0, 0.12, w) * smooth(0, 0.15, 1 - w) : 0;
    const stride = ((s * o.L) / STRIDE) * Math.PI;
    const bob = (Math.sin(stride) ** 2 - 0.5) * 0.3 * moving;
    o.u.uStride.value = stride;
    o.u.uMove.value = moving;
    mesh.position.set(p.x, p.y + bob, p.z);
    o.shadow.position.set(p.x, ground + 0.8, p.z);
    // (only as dark as they are there: it comes up with them out of the light)
    o.shadow.material.opacity = 0.62 * smooth(0.3, 1, reveal);
    // along the way while walking; round to the reader once there
    const tangent = o.curve.getTangentAt(Math.min(0.999, s));
    lookAt.set(p.x + tangent.x, p.y, p.z + tangent.z);
    const face = Math.atan2(lookAt.x - p.x, lookAt.z - p.z);
    const toReader = Math.atan2(reader.x - p.x, reader.z - p.z);
    let turn = toReader - face;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    // (the stoop is in the figure; this is only leaning into the step)
    mesh.rotation.set(0.04 * moving, face + turn * smooth(0.82, 1, w), 0, 'YXZ');
    o.shadow.rotation.y = mesh.rotation.y;
  };

  // ── The heart ───────────────────────────────────────────────────────────
  // It spins up as the reader comes to it, catches, and keeps turning faster
  // than it did, burning brighter, for as long as the light is out.
  const spinRate = (t) => (t < 1.5 ? 0
    : t < FINALE.ignite ? 3.4 * ((t - 1.5) / (FINALE.ignite - 1.5)) ** 2
      : 0.7 + 2.7 * Math.exp(-(t - FINALE.ignite) / 1.8));
  const spin = integrate(spinRate, FINALE.end + 1);
  const heartState = { spin: 0, flare: 0, glow: 0 };
  const flash = (t) => (t < FINALE.ignite
    ? Math.exp(-(((t - FINALE.ignite) / 0.3) ** 2))
    : Math.exp(-(t - FINALE.ignite) / 1.4));

  // ── Moment to moment ───────────────────────────────────────────────────
  let done = false;
  let pixelsPerUnit = 500;
  const setFront = (maze, walk) => {
    floorMat.uniforms.uFront.value = maze;
    flyMat.uniforms.uFront.value = maze;
    threads.forEach((t) => { t.material.uniforms.uFront.value = walk; });
  };
  const setLevel = (level) => {
    floorMat.uniforms.uLevel.value = level;
    flyMat.uniforms.uLevel.value = level;
    threads.forEach((t) => { t.material.uniforms.uLevel.value = level; });
  };
  const camPos = new THREE.Vector3();
  const placeHeads = (front, camera, level) => {
    for (const h of heads) {
      const { strip } = h;
      const d0 = strip[0].d, d1 = strip[strip.length - 1].d;
      const on = front > d0 && level > 0.01;
      h.s.visible = on && front < d1 + 160;
      if (!h.s.visible) continue;
      const p = along(strip, front);
      h.s.position.copy(p);
      camPos.copy(camera.position);
      // about thirty pixels across wherever the eye is, and a last bloom
      // where the way runs out
      const out = clamp01((front - d1) / 160);
      const size = (34 * (1 + out * 1.5) * camPos.distanceTo(p)) / Math.max(1, pixelsPerUnit);
      h.s.scale.set(size, size, 1);
      h.mat.opacity = smooth(d0, d0 + 30, front) * (1 - out) * level * 0.9;
    }
  };

  // `film`: seconds into the finale, or null when it is not playing — then
  // what is left of it, if the reader has seen it, is the walk drawn in light
  // on the map, gone again as they go back down among the walls (`eye`).
  let warming = 3;
  const update = (film, { eye, camera }) => {
    // The world's first frames draw all of it, lit by nothing and cut away to
    // nothing, so its programs are compiled then and not in the middle of the
    // film: a lit material compiling on the AMD machine this is made on is a
    // stall, and it would have fallen on the heart catching.
    if (warming > 0 && (film === null || film === undefined)) {
      warming -= 1;
      group.visible = true;
      setLevel(1);
      setFront(0, 0);
      // (where they will stand, in the map's view: out of view, nothing is drawn
      // and nothing compiled)
      for (const o of others) {
        placeOther(o, FINALE.end, 1);
        o.u.uReveal.value = 0;
        o.shadow.material.opacity = 0;
      }
      return;
    }
    if (film !== null && film !== undefined) {
      const t = Math.min(film, FINALE.end);
      if (t >= FINALE.end) done = true;
      group.visible = true;
      setLevel(1);
      setFront(mazeFront(t), walkFront(t));
      placeHeads(walkFront(t), camera, 1);
      for (const o of others) placeOther(o, t, smooth(o.show, o.show + 1.4, t));
      heartState.spin = spin(t);
      heartState.flare = flash(t);
      heartState.glow = smooth(FINALE.ignite - 2.5, FINALE.ignite, t) * (1 - 0.5 * smooth(FINALE.rise[0], FINALE.end, t));
      return;
    }
    const level = done ? 1 - smooth(0.25, 0.75, eye) : 0;
    group.visible = level > 0.001;
    heartState.flare = 0;
    heartState.glow = done ? 0.5 * level : 0;
    if (!group.visible) {
      for (const o of others) hideOther(o);
      heads.forEach((h) => { h.s.visible = false; });
      return;
    }
    setLevel(level);
    setFront(1e5, 1e5);
    placeHeads(1e5, camera, level);
    for (const o of others) placeOther(o, FINALE.end, level);
  };

  // Called from the world's own tick, after the armillary and the halos have
  // been set for the frame: the heart's share of the finale laid over them.
  const coreBase = heartParts.core ? heartParts.core.material.color.clone() : null;
  const wishBase = heartParts.wish ? heartParts.wish.intensity : 0;
  const tilt = heartParts.armillary ? heartParts.armillary.children[2].rotation.z : 0;
  const tick = (t) => {
    floorMat.uniforms.uTime.value = t;
    flyMat.uniforms.uTime.value = t;
    threads.forEach((m) => { m.material.uniforms.uTime.value = t; });
    const { armillary, core, halo, wish } = heartParts;
    const { spin: s, flare, glow } = heartState;
    if (armillary) {
      armillary.rotation.y += s;
      armillary.children[1].rotation.y += s * 1.6;
      armillary.children[2].rotation.z = tilt + s * 0.9;
    }
    // (a flash, not a whiteout: at four times the halo and two and a half
    // times the lamp the whole court went to one gold wash)
    if (core) core.material.color.copy(coreBase).multiplyScalar(1 + glow * 1.4 + flare * 4);
    if (halo) {
      halo.mat.opacity *= 1 + glow * 0.5 + flare * 1.8;
      halo.sprite.scale.multiplyScalar(1 + glow * 0.15 + flare * 0.6);
    }
    if (wish) wish.intensity = wishBase * (1 + glow * 0.35 + flare * 1.2);
    for (const o of others) o.u.uFloor.value = o.mesh.visible ? 1 : 0;
  };

  const setViewport = (ppu) => {
    pixelsPerUnit = ppu;
    flyMat.uniforms.uScale.value = ppu;
    threads.forEach((m) => { m.material.uniforms.uScale.value = ppu; });
  };
  // From above the thread is a line laid over the map, and no wall may cut it;
  // down among the hedges it must be hidden by them (as the halos are).
  const setEyeLevel = (down) => {
    threads.forEach((m) => { m.material.depthTest = down; });
    heads.forEach((h) => { h.mat.depthTest = down; });
  };

  return {
    group,
    duration: FINALE.end,
    timeline: FINALE,
    phaseAt: finalePhase,
    // where the camera stops in the court, and what it looks at from there
    inside,
    heart,
    ground,
    gates: Object.fromEntries(Object.entries(gates).map(([k, g]) => [k, g.at])),
    you: youTo,
    update,
    tick,
    setViewport,
    setEyeLevel,
    get done() { return done; },
    // for a harness: where the others are headed, how far the light has to go
    debug: () => ({
      far: field.far, mouth, walkEnd, sideEnd, vmax: +vmax.toFixed(1),
      others: others.map((o) => ({ name: o.mesh.name, show: o.show, go: o.go, arrive: o.arrive, L: +o.L.toFixed(1), from: o.curve.points[0].toArray().map((x) => +x.toFixed(1)) })),
    }),
  };
}
