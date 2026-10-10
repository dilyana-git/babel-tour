// The lamp pass of 2026-10-07: what was chosen from the "Lamps — what you
// approve" canvas, now the lamps as they are. ?wlamps=old puts every lamp back
// as it was; ?wlampsoff=flame,pool (any of the names below) just those.
//
//   flame    the Door's candle flames as flames, the wax lit under them
//   paper    paper lanterns lit from their flame: the pergola, the Pavilion's eaves
//   table    the Pavilion's table lamp as lit panels in its frame, the glow egg gone
//   sconce   the Vertigo's stair sconces: a small lantern on a wall bracket
//   pool     lamp pools laid IN the floor — light on the stone — not a sheet over it
//   corner   the reading-corner shade lit from its bulb, and the bulb a real light
//   glint    globes catching the lamps near them; the dead glass glossed
//   occlude  a halo hidden by what stands between it and the eye (body.js `sight`)
//
// ?wpoolshadow=1: the pools in the floor shadowed by what stands between them
// and their lamp, baked once on the GPU after the world is up (bakePoolShadows).
import * as THREE from 'three';
import { sweep, curl, lathe } from './sconce';
import { lanternPaneGeometry } from './sconce';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const OLD = Q.get('wlamps') === 'old';
const OFF = new Set((Q.get('wlampsoff') ?? '').split(',').map((s) => s.trim()).filter(Boolean));
export const LAMPS = Object.fromEntries(['flame', 'paper', 'table', 'sconce', 'pool', 'corner', 'glint', 'occlude'].map((k) => [k, !OLD && !OFF.has(k)]));
export const POOL_SHADOW = LAMPS.pool && Q.get('wpoolshadow') === '1';
export const lpNum = (k, d) => {
  const v = Q.get(k);
  return v !== null && v !== '' && Number.isFinite(+v) ? +v : d;
};
export { lanternPaneGeometry };

// The glass shaders' vertex half: the unit shape's own coordinates (vL), and
// the view and normal for how squarely the eye looks through it.
const LOCAL_VS = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vC;
  varying vec3 vL;
  void main() {
    vec4 local = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      n = mat3(instanceMatrix) * n;
    #endif
    vC = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vC = instanceColor;
    #endif
    vL = position;
    vec4 mv = modelViewMatrix * local;
    vN = normalMatrix * n;
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
const THROUGH = /* glsl */ `
  float nLen = dot(vN, vN), vLen = dot(vV, vV);
  float through = (nLen > 1e-12 && vLen > 1e-12) ? abs(dot(vN * inversesqrt(nLen), vV * inversesqrt(vLen))) : 1.0;
`;

// Paper lit from a flame inside it. Paper is not glass: it is lit, not seen
// through, so it is brightest where the sheet is nearest the flame — the same
// from every side — and dims toward the caps that hold it; the light that has
// crossed more of it comes out redder. The ribs (or, `lattice`, a frame of
// thin wood over silk) are drawn here rather than as geometry: a 4 mm bamboo
// ring is well under a pixel from the path, and crawled.
// `flame`: where the flame is, in the shape's own unit coordinates; `gain`:
// how bright the sheet nearest it is.
export function makePaperMaterial({ lattice = false, flame = [0, -0.25, 0], gain = 0.62, near = 1.0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uFlame: { value: new THREE.Vector3(...flame) }, uGain: { value: gain }, uNear: { value: near } },
    vertexShader: LOCAL_VS,
    fragmentShader: /* glsl */ `
      uniform vec3 uFlame;
      uniform float uGain;
      uniform float uNear;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vC;
      varying vec3 vL;
      void main() {
        ${THROUGH}
        vec3 d = vL - uFlame;
        float e = uNear * 0.92 / pow(dot(d, d) + 0.08, 1.2);
        e *= 0.82 + 0.3 * pow(through, 2.0);
        e *= mix(1.0, 0.3, smoothstep(0.72, 0.98, abs(vL.y)));
        float shade = 1.0;
        ${lattice ? `
        vec2 q = vec2(vL.x + vL.z, vL.y) * vec2(3.0, 3.5);
        vec2 dq = abs(q - floor(q + 0.5)), wq = max(fwidth(q), vec2(1e-4));
        float lx = (1.0 - smoothstep(0.04, 0.04 + 1.5 * wq.x, dq.x)) * clamp(0.14 / wq.x, 0.0, 1.0);
        float ly = (1.0 - smoothstep(0.04, 0.04 + 1.5 * wq.y, dq.y)) * clamp(0.14 / wq.y, 0.0, 1.0);
        shade = 1.0 - 0.8 * max(lx, ly);` : `
        float ry = vL.y * 3.6, dr = abs(ry - floor(ry + 0.5)), wr = max(fwidth(ry), 1e-4);
        float line = (1.0 - smoothstep(0.05, 0.05 + 1.5 * wr, dr)) * clamp(0.16 / wr, 0.0, 1.0);
        shade = (1.0 - 0.55 * line) * (1.0 + 0.06 * cos(6.2832 * ry));`}
        vec3 warm = mix(vec3(0.74, 0.3, 0.09), vec3(1.0, 0.8, 0.56), smoothstep(0.55, 1.35, e));
        gl_FragColor = vec4(vC * warm * e * uGain * shade, 1.0);
      }
    `,
  });
}

// A candle flame: a teardrop (flameGeometry), hottest low in the middle where
// the eye looks into it, orange to its tip, and soft at its edges — added to
// the frame, never painted over it.
// `alive` (doorProps.js, 4): it leans and draws up a little as the air moves,
// each flame in its own time (`uTime`), and burns a little brighter and lower
// with it. Slowly: a flame that changed faster than a breath read as blinking.
export function makeFlameMaterial({ alive = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: alive ? LOCAL_VS
      .replace('varying vec3 vL;', `varying vec3 vL;
  varying float vBreath;
  uniform float uTime;`)
      .replace('vec4 local = vec4(position, 1.0);', `vec4 local = vec4(position, 1.0);
    float ph = 0.0;
    #ifdef USE_INSTANCING
      ph = dot(instanceMatrix[3].xyz, vec3(1.7, 3.1, 2.3));
    #endif
    float up = smoothstep(-0.5, 1.0, position.y);
    local.x += up * up * (0.2 * sin(uTime * 2.3 + ph) + 0.11 * sin(uTime * 3.7 + ph * 1.3));
    local.z += up * up * 0.14 * sin(uTime * 2.9 + ph * 0.6);
    local.y += max(0.0, position.y + 0.3) * 0.09 * sin(uTime * 1.9 + ph * 0.7);
    vBreath = 1.0 + 0.07 * sin(uTime * 1.3 + ph) + 0.04 * sin(uTime * 2.9 + ph * 2.1);`) : LOCAL_VS,
    fragmentShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vC;
      varying vec3 vL;
      ${alive ? 'varying float vBreath;' : 'const float vBreath = 1.0;'}
      void main() {
        ${THROUGH}
        float y = vL.y;
        float core = (1.0 - smoothstep(-0.6, 0.35, y)) * smoothstep(-1.0, -0.72, y);
        vec3 col = mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.9, 0.7), pow(through, 2.0) * (0.3 + 0.7 * core));
        float a = pow(through, 1.4) * (1.0 - 0.75 * smoothstep(0.25, 1.0, y)) * smoothstep(-1.0, -0.82, y);
        gl_FragColor = vec4(vC * col * a * vBreath, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
// -1 at the wick, 1 at the tip
export const flameGeometry = () => new THREE.LatheGeometry(
  [[0, -1], [0.38, -0.86], [0.58, -0.6], [0.6, -0.35], [0.5, -0.05], [0.34, 0.3], [0.17, 0.65], [0.05, 0.92], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)),
  18,
);
// The top of a lit candle: the wax round the flame lets its light through,
// strongest at the rim. A shell just outside the candle, fading downward.
export const waxGlowGeometry = (x, top, z, r, h = 0.75) => {
  const g = new THREE.CylinderGeometry(r + 0.012, r + 0.012, h, 14, 1, true).translate(x, top - h / 2, z);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), hot = new THREE.Color('#ff8a3a');
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, (p.getY(i) - (top - h)) / h) ** 1.8 * 0.55;
    col[i * 3] = hot.r * t; col[i * 3 + 1] = hot.g * t; col[i * 3 + 2] = hot.b * t;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return g;
};
export const waxGlowMaterial = () => new THREE.MeshBasicMaterial({
  vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
});

// The reading-corner shade lit from its bulb: an even glow through the cloth,
// a little more at its middle, a darker binding at each rim, and the inside —
// lit straight by the bulb — twice as bright as the outside. `y0`..`y1`: the
// shade's foot and head in the world (every corner's table is the same height).
export function shadeLit(mat, y0, y1) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vShadeY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShadeY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vShadeY;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float shT = clamp((vShadeY - ${y0.toFixed(3)}) / ${(y1 - y0).toFixed(3)}, 0.0, 1.0);
        float shE = (0.85 + 0.3 * sin(3.14159 * shT)) * (1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.05, shT)) - 0.6 * smoothstep(0.95, 1.0, shT));
        totalEmissiveRadiance *= shE * (gl_FrontFacing ? 1.0 : 2.0);`);
  };
  mat.customProgramCacheKey = () => 'babel-shade-lit';
  return mat;
}

// ── The Vertigo's stair sconces ───────────────────────────────────────────────
// A small lantern on a wall bracket: the Echo's pier lantern (sconce.js) at
// eight-tenths its size. Drawn in the sconce's own plane, x out from the wall
// toward the well, y the world's height, and turned into place (as sconce.js
// does): `wall` the point on the wall string, `ry` the turn carrying +x toward
// the well, `y` the tread, `out` how far the light stands off the wall. The
// light's middle stays where the old globe's was (y + 11.2), so its light and
// halo did not move. (Chosen over the hanging lamps' globe on a swan neck.)
export function stairSconce({ wall, ry, y, out = 2.8 }) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const world = (x, yy, z = 0) => [wall[0] + x * cs + z * sn, yy, wall[1] - x * sn + z * cs];
  const place = (g) => g.rotateY(ry).translate(wall[0], 0, wall[1]);
  const bronze = [];
  const X = out, mid = y + 11.2;
  const k = 0.8, RB = 0.92 * k, RT = 1.12 * k, h = 3 * k, y0 = mid - h / 2, y1 = mid + h / 2, yb = y0 - 0.45;
  // the plate on the wall string, and the boss the console springs from
  bronze.push(new THREE.BoxGeometry(0.22, 3.1, 1.15).translate(0.11, yb - 0.65, 0));
  bronze.push(lathe([[0, 0], [0.42, 0], [0.42, 0.06], [0.3, 0.2], [0.24, 0.32], [0, 0.34]], 16).rotateZ(-Math.PI / 2).translate(0.2, yb + 0.35, 0));
  // the console: a bar out from the plate, an S-brace under it, and a scroll in the corner
  bronze.push(sweep([[0.25, yb + 0.12], [X * 0.6, yb + 0.14], [X - 0.45, yb + 0.16]], 0.13, 0.11, { segs: 8 }));
  bronze.push(sweep([[0.22, yb - 1.7], [0.9, yb - 1.55], [1.4, yb - 1.0], [1.9, yb - 0.35], [X - 0.6, yb + 0.02]], 0.085, 0.07));
  bronze.push(sweep(curl(1.05, yb - 0.6, 0.26, Math.PI * 0.5, Math.PI * 2.9), 0.06, 0.04, { segs: 50, radial: 8 }));
  // the pan and its drop, the rings at the panes' foot and head, a bar up every corner, the roof and finial
  bronze.push(lathe([[0, y0 - 0.45 * k], [0.12, y0 - 0.4 * k], [0.34, y0 - 0.27 * k], [0.66, y0 - 0.14 * k], [RB + 0.12, y0 - 0.06], [RB + 0.14, y0], [RB + 0.06, y0 + 0.04]], 6, X, true));
  bronze.push(lathe([[0, y0 - 0.85 * k], [0.08, y0 - 0.7 * k], [0.1, y0 - 0.58 * k], [0.07, y0 - 0.48 * k], [0.14, y0 - 0.42 * k]], 12, X));
  bronze.push(lathe([[RB - 0.05, y0 - 0.04], [RB + 0.07, y0 - 0.04], [RB + 0.07, y0 + 0.07], [RB - 0.05, y0 + 0.07]], 6, X, true));
  bronze.push(lathe([[RT - 0.05, y1 - 0.05], [RT + 0.08, y1 - 0.05], [RT + 0.08, y1 + 0.07], [RT - 0.05, y1 + 0.07]], 6, X, true));
  for (let j = 0; j < 6; j++) {
    const ph = (j * Math.PI) / 3, sx = Math.sin(ph), sz = Math.cos(ph);
    bronze.push(sweep([[X + sx * (RB + 0.02), y0, sz * (RB + 0.02)], [X + sx * (RT + 0.02), y1, sz * (RT + 0.02)]], 0.055, 0.055, { segs: 1, radial: 6 }));
  }
  bronze.push(lathe([[RT + 0.17, y1], [RT + 0.2, y1 + 0.08], [RT + 0.13, y1 + 0.17], [RT - 0.05, y1 + 0.28], [0.65, y1 + 0.48], [0.47, y1 + 0.72], [0.37, y1 + 0.96], [0.36, y1 + 1.08], [0.44, y1 + 1.16], [0.4, y1 + 1.24], [0.18, y1 + 1.34], [0, y1 + 1.36]], 6, X, true));
  bronze.push(lathe([[0, y1 + 1.31], [0.13, y1 + 1.38], [0.16, y1 + 1.49], [0.1, y1 + 1.62], [0.05, y1 + 1.75], [0.08, y1 + 1.83], [0, y1 + 2.0]], 12, X));
  return {
    bronze: bronze.map(place),
    pane: { p: world(X, mid), s: [k, h / 2, k], rot: [0, ry, 0], color: '#ffe8c8', k: 0.85 },
  };
}

// ── Pools laid in the floor ───────────────────────────────────────────────────
// A lamp's pool is light the floor sends back, so it belongs IN the floor's
// lighting: what it adds is multiplied by the stone (dark wool, a rug, the
// floor band take less of it than pale paving), it lands only on what faces
// up at floor height — not on the foot of every leg and plinth standing in it,
// which an additive sheet 6 cm up painted with a pale sock — and nothing is
// drawn over the well. The pools are summed into one world-space map, the way
// the old sheets drew them (radialTex's fall-off), and the floor reads it.
export const floorPools = [];
export const floorPoolU = {
  tex: { value: new THREE.DataTexture(new Uint16Array(4), 1, 1, THREE.RGBAFormat, THREE.HalfFloatType) },
  box: { value: new THREE.Vector4(0, 0, 1, 1) },
  gain: { value: lpNum('wlpgain', 60) },
};
const radialAt = (t) => (t < 0.3 ? 1 - (t / 0.3) * 0.45 : t < 0.65 ? 0.55 - ((t - 0.3) / 0.35) * 0.41 : t < 1 ? 0.14 * (1 - (t - 0.65) / 0.35) : 0);
export function bakeFloorPools() {
  if (!floorPools.length) return 0;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of floorPools) {
    x0 = Math.min(x0, p.x - p.sx / 2); x1 = Math.max(x1, p.x + p.sx / 2);
    z0 = Math.min(z0, p.z - p.sz / 2); z1 = Math.max(z1, p.z + p.sz / 2);
  }
  const W = 1024, H = 1024, du = (x1 - x0) / W, dv = (z1 - z0) / H;
  const acc = new Float32Array(W * H * 3);
  for (const p of floorPools) {
    const i0 = Math.max(0, Math.floor((p.x - p.sx / 2 - x0) / du)), i1 = Math.min(W - 1, Math.ceil((p.x + p.sx / 2 - x0) / du));
    const j0 = Math.max(0, Math.floor((p.z - p.sz / 2 - z0) / dv)), j1 = Math.min(H - 1, Math.ceil((p.z + p.sz / 2 - z0) / dv));
    for (let j = j0; j <= j1; j++) {
      const z = z0 + (j + 0.5) * dv;
      for (let i = i0; i <= i1; i++) {
        const x = x0 + (i + 0.5) * du;
        const t = Math.hypot((x - p.x) / (p.sx / 2), (z - p.z) / (p.sz / 2));
        if (t >= 1) continue;
        const a = radialAt(t) * p.o, k = (j * W + i) * 3;
        acc[k] += p.c.r * a; acc[k + 1] += p.c.g * a; acc[k + 2] += p.c.b * a;
      }
    }
  }
  const half = new Uint16Array(W * H * 4);
  for (let n = 0; n < W * H; n++) {
    half[n * 4] = THREE.DataUtils.toHalfFloat(acc[n * 3]);
    half[n * 4 + 1] = THREE.DataUtils.toHalfFloat(acc[n * 3 + 1]);
    half[n * 4 + 2] = THREE.DataUtils.toHalfFloat(acc[n * 3 + 2]);
    half[n * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const tex = new THREE.DataTexture(half, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  floorPoolU.tex.value = tex;
  floorPoolU.box.value.set(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0));
  return floorPools.length;
}
export function floorPoolPatch(mat) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey?.call(mat) ?? '';
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uPoolTex = floorPoolU.tex;
    sh.uniforms.uPoolBox = floorPoolU.box;
    sh.uniforms.uPoolGain = floorPoolU.gain;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPoolW;\nvarying float vPoolUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPoolW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvPoolUp = normalize(mat3(modelMatrix) * objectNormal).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uPoolTex;\nuniform vec4 uPoolBox;\nuniform float uPoolGain;\nvarying vec3 vPoolW;\nvarying float vPoolUp;')
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        {
          vec2 poolUv = (vPoolW.xz - uPoolBox.xy) * uPoolBox.zw;
          if (poolUv.x > 0.0 && poolUv.x < 1.0 && poolUv.y > 0.0 && poolUv.y < 1.0 && vPoolW.y < 7.2)
            irradiance += texture2D(uPoolTex, poolUv).rgb * uPoolGain * smoothstep(0.5, 0.9, vPoolUp);
        }`);
  };
  mat.customProgramCacheKey = () => `${prevKey}-pool`;
  return mat;
}

// ── The pools' shadows (?wpoolshadow=1) ───────────────────────────────────────
// What stands between a lamp and the floor — the well's rail and balusters, a
// stair, a table, a reader — shades the pool it lays there. Lamp shadow maps
// drawn every frame hang this machine's GPU (?wlampshadow); but a lamp never
// moves, so its shadow need be drawn only ONCE. Each pool's lamp looks
// straight down at it and keeps how far it can see (a depth map of the solids
// round it, `CASTER` layer only); then the pool is laid again into a finer map
// of the floor, dimmed wherever the floor is hidden from the lamp, and soft by
// the width of the globe and how far the thing in the way is from the floor
// (PCSS). Two lamps a frame (World.jsx steps it), and the floor reads the new
// map once all are laid.
const CASTER = 9;
const DISK = [
  [-0.942, -0.399], [0.946, -0.769], [-0.094, -0.929], [0.345, 0.294], [-0.916, 0.458], [-0.815, -0.879], [-0.383, 0.277], [0.975, 0.756],
  [0.443, -0.975], [0.537, -0.474], [-0.265, -0.419], [0.792, 0.191], [-0.242, 0.997], [-0.814, 0.914], [0.2, 0.786], [0.144, -0.141],
];
const SPLAT_FS = /* glsl */ `
  uniform vec4 uBox;
  uniform vec4 uPool;
  uniform vec3 uColor;
  uniform float uHas;
  uniform sampler2D uDepth;
  uniform mat4 uLightV;
  uniform mat4 uLightP;
  uniform float uNear;
  uniform float uFar;
  uniform float uTanHalf;
  uniform float uLightR;
  uniform float uFloorY;
  uniform float uTexel;
  // ?wpooldebug=1: what each lamp sees of its pool, in green (blue: a pool with no lamp)
  uniform float uDebug;
  const vec2 DISK[16] = vec2[16](${DISK.map(([x, y]) => `vec2(${x.toFixed(3)}, ${y.toFixed(3)})`).join(', ')});
  float lin(float d) { return uNear * uFar / (uFar - d * (uFar - uNear)); }
  float radial(float t) {
    if (t < 0.3) return 1.0 - t / 0.3 * 0.45;
    if (t < 0.65) return 0.55 - (t - 0.3) / 0.35 * 0.41;
    return 0.14 * (1.0 - (t - 0.65) / 0.35);
  }
  void main() {
    vec2 xz = uBox.xy + gl_FragCoord.xy * uBox.zw;
    float t = length((xz - uPool.xy) / uPool.zw);
    if (t >= 1.0) discard;
    float vis = 1.0;
    if (uHas > 0.5) {
      vec4 v = uLightV * vec4(xz.x, uFloorY, xz.y, 1.0);
      float zr = -v.z;
      vec4 c = uLightP * v;
      vec2 uv = c.xy / c.w * 0.5 + 0.5;
      if (zr > uNear && uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
        float bias = 0.15 + 0.004 * zr;
        // uv per world unit, at the floor's distance from the lamp
        float perUnit = 1.0 / (2.0 * zr * uTanHalf);
        // the samples turned a little texel by texel, so the soft edge is grain, not rings
        float a = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
        mat2 turn = mat2(cos(a), sin(a), -sin(a), cos(a));
        float search = clamp(uLightR * perUnit, 2.0 * uTexel, 40.0 * uTexel);
        float zb = 0.0, nb = 0.0;
        for (int k = 0; k < 16; k++) {
          float d = lin(texture2D(uDepth, uv + turn * DISK[k] * search).r);
          if (d < zr - bias) { zb += d; nb += 1.0; }
        }
        if (nb > 0.0) {
          zb /= nb;
          // the penumbra on the floor: the globe's width, scaled by how far
          // the thing in the way stands from the floor against from the lamp
          float pen = 2.0 * uLightR * (zr - zb) / max(zb, 1e-3);
          float rad = clamp(0.5 * pen * perUnit, 1.0 * uTexel, 48.0 * uTexel);
          float lit = 0.0;
          for (int k = 0; k < 16; k++) {
            float d = lin(texture2D(uDepth, uv + turn * DISK[k] * rad).r);
            lit += d < zr - bias ? 0.0 : 1.0;
          }
          vis = lit / 16.0;
        }
      }
    }
    gl_FragColor = uDebug > 0.5 ? vec4(0.0, uHas * vis * 0.12, (1.0 - uHas) * 0.12, 1.0) * step(t, 0.95) : vec4(uColor * radial(t) * vis, 1.0);
  }
`;
// `exclude`: materials that are the floor itself (it never shades itself);
// `floorY`: the height the floor is read at.
export function makePoolShadowBake({ root, exclude = [], floorY = 6.05, texel = 1, depthSize = 1024 }) {
  const skip = new Set(exclude);
  let next = 0, ready = false, casters = [], depthRT = null, accRT = null, W = 0, H = 0;
  const cam = new THREE.PerspectiveCamera(90, 1, 1, 100);
  cam.layers.set(CASTER);
  cam.up.set(0, 0, 1);
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  const splatMat = new THREE.ShaderMaterial({
    uniforms: {
      uBox: { value: new THREE.Vector4() }, uPool: { value: new THREE.Vector4() }, uColor: { value: new THREE.Color() }, uHas: { value: 0 },
      uDepth: { value: null }, uLightV: { value: new THREE.Matrix4() }, uLightP: { value: new THREE.Matrix4() },
      uNear: { value: 1 }, uFar: { value: 100 }, uTanHalf: { value: 1 }, uLightR: { value: 1 }, uFloorY: { value: floorY }, uTexel: { value: 1 / depthSize }, uDebug: { value: lpNum('wpooldebug', 0) },
    },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: SPLAT_FS,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    depthTest: false, depthWrite: false, transparent: true,
  });
  const splatScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), splatMat);
  quad.frustumCulled = false;
  splatScene.add(quad);
  const splatCam = new THREE.Camera();
  const MOVING = /^(bridge-reader|finale|koi|shelvedBooks|sky|stars|doorway)/;

  const start = (gl) => {
    root.traverse((o) => {
      const m = o.material;
      if (!o.isMesh || !m || Array.isArray(m) || MOVING.test(o.name) || skip.has(m)) return;
      if (!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return;
      if ((m.transparent && !m.alphaTest) || m.blending === THREE.AdditiveBlending || m.side === THREE.BackSide) return;
      o.layers.enable(CASTER);
      casters.push(o);
    });
    const b = floorPoolU.box.value, w = 1 / b.z, h = 1 / b.w;
    W = Math.min(2048, Math.ceil(w / texel));
    H = Math.min(2048, Math.ceil(h / texel));
    splatMat.uniforms.uBox.value.set(b.x, b.y, w / W, h / H);
    accRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false });
    const depthTexture = new THREE.DepthTexture(depthSize, depthSize, THREE.UnsignedIntType);
    depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
    depthRT = new THREE.WebGLRenderTarget(depthSize, depthSize, { depthBuffer: true, depthTexture });
    gl.setRenderTarget(accRT);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    ready = true;
  };

  const lay = (gl, scene, p) => {
    const u = splatMat.uniforms;
    u.uPool.value.set(p.x, p.z, p.sx / 2, p.sz / 2);
    u.uColor.value.copy(p.c).multiplyScalar(p.o);
    u.uHas.value = 0;
    if (p.src) {
      const [lx, ly, lz, G] = p.src, h = ly - floorY;
      if (h > 2) {
        const reach = Math.max(p.sx, p.sz) / 2 + Math.hypot(p.x - lx, p.z - lz);
        const half = Math.min(75 * THREE.MathUtils.DEG2RAD, Math.atan(reach / h));
        cam.fov = 2 * half * THREE.MathUtils.RAD2DEG;
        cam.near = G * 1.3 + 0.3;
        cam.far = h / Math.cos(half) + 20;
        cam.position.set(lx, ly, lz);
        cam.lookAt(lx, floorY, lz);
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
        // (the chunks the cull has put away for the eye are still in the lamp's way)
        const hid = [];
        for (const o of casters) if (!o.visible) { hid.push(o); o.visible = true; }
        const over = scene.overrideMaterial, bg = scene.background;
        scene.overrideMaterial = depthMat;
        scene.background = null;
        gl.setRenderTarget(depthRT);
        gl.clear(true, true, false);
        gl.render(scene, cam);
        scene.overrideMaterial = over;
        scene.background = bg;
        for (const o of hid) o.visible = false;
        u.uDepth.value = depthRT.depthTexture;
        u.uLightV.value.copy(cam.matrixWorldInverse);
        u.uLightP.value.copy(cam.projectionMatrix);
        u.uNear.value = cam.near;
        u.uFar.value = cam.far;
        u.uTanHalf.value = Math.tan(half);
        u.uLightR.value = G;
        u.uHas.value = 1;
      }
    }
    // only over the pool's own texels
    const b = u.uBox.value;
    const x0 = THREE.MathUtils.clamp(Math.floor((p.x - p.sx / 2 - b.x) / b.z), 0, W), x1 = THREE.MathUtils.clamp(Math.ceil((p.x + p.sx / 2 - b.x) / b.z), 0, W);
    const y0 = THREE.MathUtils.clamp(Math.floor((p.z - p.sz / 2 - b.y) / b.w), 0, H), y1 = THREE.MathUtils.clamp(Math.ceil((p.z + p.sz / 2 - b.y) / b.w), 0, H);
    if (x1 <= x0 || y1 <= y0) return;
    accRT.viewport.set(x0, y0, x1 - x0, y1 - y0);
    accRT.scissor.set(x0, y0, x1 - x0, y1 - y0);
    accRT.scissorTest = true;
    gl.setRenderTarget(accRT);
    gl.render(splatScene, splatCam);
  };

  const state = {
    done: !floorPools.length,
    // the number laid, of how many (DEV)
    progress: () => [next, floorPools.length],
    step: (gl, scene, n = 2) => {
      if (state.done) return;
      const was = gl.getRenderTarget(), auto = gl.autoClear, cc = gl.getClearColor(new THREE.Color()), ca = gl.getClearAlpha();
      gl.autoClear = false;
      if (!ready) start(gl);
      for (let k = 0; k < n && next < floorPools.length; k++) lay(gl, scene, floorPools[next++]);
      gl.setRenderTarget(was);
      gl.autoClear = auto;
      gl.setClearColor(cc, ca);
      if (next >= floorPools.length) {
        floorPoolU.tex.value = accRT.texture;
        depthRT.dispose();
        depthMat.dispose();
        state.done = true;
      }
    },
    dispose: () => {
      accRT?.dispose();
      depthRT?.dispose();
      splatMat.dispose();
      quad.geometry.dispose();
    },
  };
  return state;
}
