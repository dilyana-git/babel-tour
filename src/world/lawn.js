// ── The lawn, where a lantern shows it ───────────────────────────────────────
// The garden's lawn is a plane with grass painted on it, and at night that is
// all it needs to be — until a lantern stands on it. In a lantern's light the
// ground beside the path was a flat brown sheet: the painted blades too fine
// to see, and nothing standing up out of it for the light to catch. So round
// each lantern, as far as its light goes, the lawn has blades (forkProps.js,
// 10): tufts of five to eight, a hand high, each blade one leaning triangle,
// thick near the lantern and thinning out to nothing where its light does.
//
// They are lit by the lantern they stand round and by nothing else that
// would not also light the plane under them: each vertex carries its lamp
// (`aLamp`: where it is, and how strong), and the blade takes that light as
// the lantern's own stone does (build/materials.js, flameLit) — falling off with
// distance, warm, brightest toward the tip. Geometry, not cards: no alpha to
// test and nothing to shimmer.
//
// All from the `seed` it is handed, never the world's stream.
import * as THREE from 'three';
import { makeRng } from './textures';

// `lamps`: [{ p: [x, z], y, reach, k }]. `ok(p)`: whether grass grows at p.
// `ground`: the lawn's height. Yields one geometry per lamp so assembly can
// give the page time between lamps without changing their random streams.
// `clump` (gardenFix5.js, 5 — GRASS): the blades were scattered evenly, each
// one triangle a centimetre wide with a pale tip, and read as needles on dark
// ground. With it they stand in clumps, in patches — thick here, none there —
// each blade broader, bent over at two thirds of its height, its tip a mid
// green.
export function* lawnBlades({ lamps, ok, ground, seed = 6607, density = 1, height = 0.8, clump = null }) {
  // a slow field over the lawn: where it is low, no clump stands
  const cell = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7 + seed) * 43758.5453; return x - Math.floor(x); };
  const field = (x, z) => {
    const u = x / (clump?.patch ?? 1), v = z / (clump?.patch ?? 1), i = Math.floor(u), j = Math.floor(v);
    const fu = u - i, fv = v - j, su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
    return (cell(i, j) * (1 - su) + cell(i + 1, j) * su) * (1 - sv) + (cell(i, j + 1) * (1 - su) + cell(i + 1, j + 1) * su) * sv;
  };
  for (const [li, lamp] of lamps.entries()) {
    const r = makeRng(seed + li * 131), R = (a, b) => a + (b - a) * r();
    const pos = [], col = [], nor = [], lit = [];
    const bent = (x, z, near) => {
      const blades = Math.round(R(...clump.blades)), dry = r() < 0.08;
      const hue = R(-1, 1), tall = height * R(0.7, 1.4) * (0.8 + 0.3 * near), lay = R(0, Math.PI * 2);
      for (let b = 0; b < blades; b++) {
        // out from the clump's middle, most of them leaning the clump's own way
        const a = r() < 0.6 ? lay + R(-0.9, 0.9) : R(0, Math.PI * 2), spread = R(...clump.spread), lean = R(0.15, 0.7);
        const bx = x + Math.cos(a) * spread, bz = z + Math.sin(a) * spread;
        const h = tall * R(0.55, 1.15), w = R(...clump.wide);
        const ax = -Math.sin(a) * w, az = Math.cos(a) * w, cx = Math.cos(a), cz = Math.sin(a);
        const my = ground + h * 0.62, mo = lean * h * 0.3, ty = ground + h * (1 - 0.22 * lean), to = lean * h * 0.95;
        const B0 = [bx - ax, ground - 0.05, bz - az], B1 = [bx + ax, ground - 0.05, bz + az];
        const M0 = [bx + cx * mo - ax * 0.62, my, bz + cz * mo - az * 0.62], M1 = [bx + cx * mo + ax * 0.62, my, bz + cz * mo + az * 0.62];
        const T = [bx + cx * to, ty, bz + cz * to];
        pos.push(...B0, ...B1, ...M1, ...B0, ...M1, ...M0, ...M0, ...M1, ...T);
        for (let v = 0; v < 9; v++) nor.push(0, 1, 0);
        const k = R(0.8, 1.15) * clump.k;
        const g0 = dry ? [0.07, 0.06, 0.026] : [0.031 + 0.006 * hue, 0.047, 0.013];
        const gm = g0.map((c) => c * (1 + (clump.tip - 1) * 0.6) * k);
        const gt = g0.map((c) => c * clump.tip * k), gb = g0.map((c) => c * k * 0.8);
        col.push(...gb, ...gb, ...gm, ...gb, ...gm, ...gm, ...gm, ...gm, ...gt);
        for (let v = 0; v < 9; v++) lit.push(lamp.p[0], lamp.y, lamp.p[1], lamp.k);
      }
    };
    // a blade's greens: root, tip — olive, a few gone to straw
    const tuft = (x, z, near) => {
      const blades = 6 + Math.floor(r() * 5), dry = r() < 0.1;
      const hue = R(-1, 1), tall = height * R(0.65, 1.35) * (0.8 + 0.3 * near);
      for (let b = 0; b < blades; b++) {
        const a = R(0, Math.PI * 2), spread = R(0.03, 0.36), lean = R(0.1, 0.6);
        const bx = x + Math.cos(a) * spread, bz = z + Math.sin(a) * spread;
        const h = tall * R(0.6, 1.15), w = R(0.028, 0.05);
        // across the blade, square to the way it leans
        const ax = -Math.sin(a) * w, az = Math.cos(a) * w;
        const tx = bx + Math.cos(a) * lean * h, tz = bz + Math.sin(a) * lean * h;
        pos.push(bx - ax, ground - 0.05, bz - az, bx + ax, ground - 0.05, bz + az, tx, ground + h, tz);
        // lit as the ground they stand on is: a blade has no face to turn away
        nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
        const g0 = dry ? [0.075, 0.066, 0.032] : [0.026 + 0.006 * hue, 0.045, 0.019];
        const g1 = dry ? [0.13, 0.112, 0.052] : [0.06 + 0.014 * hue, 0.1 + 0.008 * hue, 0.032];
        const k = R(0.8, 1.15);
        col.push(g0[0] * k, g0[1] * k, g0[2] * k, g0[0] * k, g0[1] * k, g0[2] * k, g1[0] * k, g1[1] * k, g1[2] * k);
        for (let v = 0; v < 3; v++) lit.push(lamp.p[0], lamp.y, lamp.p[1], lamp.k);
      }
    };
    // a jittered grid over the lamp's reach, kept by how near the lamp it is
    const step = 0.9 / Math.sqrt(density), n = Math.ceil(lamp.reach / step);
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const x = lamp.p[0] + (i + R(-0.5, 0.5)) * step, z = lamp.p[1] + (j + R(-0.5, 0.5)) * step;
        const d = Math.hypot(x - lamp.p[0], z - lamp.p[1]) / lamp.reach, keep = r();
        if (d >= 1 || keep > (1 - d * d) ** 1.3 || !ok([x, z])) continue;
        if (clump) {
          // (a second draw: a clump stands by the field, and then by chance)
          const thick = (field(x, z) - clump.bare) / (1 - clump.bare);
          if (r() > thick * 2.2) continue;
          bent(x, z, 1 - d);
          continue;
        }
        tuft(x, z, 1 - d);
      }
    }
    if (!pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aLamp', new THREE.Float32BufferAttribute(lit, 4));
    g.computeBoundingSphere();
    yield g;
  }
}

// The mown sward under the blades (gardenFix5.js, 5): for each lamp a sheet
// just over the lawn, as far as its light goes, carrying the lamp as the
// blades do (`aLamp`) and how much of it shows at each corner (`aShow`: none
// at the edge of the lamp's reach, none where no grass grows). It adds the
// lantern's light off cut grass to the lawn under it and is nothing else.
export function* lawnSward({ lamps, ok, ground, step = 1.2 }) {
  for (const lamp of lamps) {
    const n = Math.ceil(lamp.reach / step), W = 2 * n + 1;
    const show = new Float32Array(W * W);
    for (let i = 0; i < W; i++) {
      for (let j = 0; j < W; j++) {
        const x = lamp.p[0] + (i - n) * step, z = lamp.p[1] + (j - n) * step;
        const d = Math.hypot(x - lamp.p[0], z - lamp.p[1]) / lamp.reach;
        show[i * W + j] = d < 1 && ok([x, z]) ? (1 - d * d) ** 1.2 : 0;
      }
    }
    // (a corner next to one where nothing grows shows nothing either, so the
    // sheet's edge at a way or a stone is a fade and not a step)
    const soft = new Float32Array(W * W);
    for (let i = 1; i < W - 1; i++) {
      for (let j = 1; j < W - 1; j++) {
        soft[i * W + j] = Math.min(show[i * W + j], show[(i + 1) * W + j], show[(i - 1) * W + j], show[i * W + j + 1], show[i * W + j - 1]) > 0 ? show[i * W + j] : 0;
      }
    }
    const pos = [], uv = [], lit = [], shown = [], idx = [], at = new Int32Array(W * W).fill(-1);
    const vert = (i, j) => {
      if (at[i * W + j] >= 0) return at[i * W + j];
      const x = lamp.p[0] + (i - n) * step, z = lamp.p[1] + (j - n) * step;
      pos.push(x, ground, z);
      uv.push(x, z);
      lit.push(lamp.p[0], lamp.y, lamp.p[1], lamp.k);
      shown.push(soft[i * W + j]);
      return (at[i * W + j] = pos.length / 3 - 1);
    };
    for (let i = 0; i < W - 1; i++) {
      for (let j = 0; j < W - 1; j++) {
        if (soft[i * W + j] + soft[(i + 1) * W + j] + soft[i * W + j + 1] + soft[(i + 1) * W + j + 1] <= 0) continue;
        const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1);
        idx.push(a, d, c, a, c, b);
      }
    }
    if (!idx.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aLamp', new THREE.Float32BufferAttribute(lit, 4));
    g.setAttribute('aShow', new THREE.Float32BufferAttribute(shown, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    yield g;
  }
}

// Its material: `map` the mown grass (laid in world units, `tile` to a
// repeat), lit by each corner's lamp, added to what lies under it.
export function swardLit(map, { tile = 9, k = 0.4, color = '#ffb46a' } = {}) {
  const mat = new THREE.MeshBasicMaterial({
    map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const lampColor = new THREE.Color(color);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLampColor = { value: lampColor };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aLamp;
        attribute float aShow;
        varying vec4 vLamp;
        varying float vShow;
        varying vec3 vSwardW;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vMapUv = uv / ${tile.toFixed(2)};`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLamp = aLamp;
        vShow = aShow;
        vSwardW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uLampColor;
        varying vec4 vLamp;
        varying float vShow;
        varying vec3 vSwardW;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 toLamp = vLamp.xyz - vSwardW;
        diffuseColor.rgb *= uLampColor * (${k.toFixed(3)} * vLamp.w * vShow / (1.0 + 0.006 * dot(toLamp, toLamp)));`);
  };
  mat.customProgramCacheKey = () => 'babel-lawn-sward';
  return mat;
}

// The blades' material: `mat` (a MeshStandardMaterial with vertex colours)
// lit by each vertex's own lamp. `color`: the lamp's; `ground`: the lawn's
// height, which a blade far from the eye is laid down to.
export function bladeLit(mat, color = '#ffb46a', ground = 3.95) {
  const lampColor = new THREE.Color(color);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLampColor = { value: lampColor };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aLamp;
        varying vec4 vLamp;
        varying vec3 vBladeW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLamp = aLamp;
        vBladeW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        // far off a blade is finer than a pixel and only glitters as the eye
        // moves: there it lies down into the lawn it is painted on
        transformed.y = mix(transformed.y, ${ground.toFixed(2)}, smoothstep(70.0, 130.0, distance(vBladeW, cameraPosition)));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uLampColor;
        varying vec4 vLamp;
        varying vec3 vBladeW;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 toLamp = vLamp.xyz - vBladeW;
        totalEmissiveRadiance += diffuseColor.rgb * uLampColor * vLamp.w / (1.0 + 0.006 * dot(toLamp, toLamp));`);
  };
  mat.customProgramCacheKey = () => 'babel-lawn-blades';
  return mat;
}
