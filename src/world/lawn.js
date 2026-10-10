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
// the lantern's own stone does (buildWorld.js, flameLit) — falling off with
// distance, warm, brightest toward the tip. Geometry, not cards: no alpha to
// test and nothing to shimmer.
//
// All from the `seed` it is handed, never the world's stream.
import * as THREE from 'three';
import { makeRng } from './textures';

// `lamps`: [{ p: [x, z], y, reach, k }]. `ok(p)`: whether grass grows at p.
// `ground`: the lawn's height. Returns one geometry per lamp.
export function lawnBlades({ lamps, ok, ground, seed = 6607, density = 1, height = 0.8 }) {
  const out = [];
  lamps.forEach((lamp, li) => {
    const r = makeRng(seed + li * 131), R = (a, b) => a + (b - a) * r();
    const pos = [], col = [], nor = [], lit = [];
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
        tuft(x, z, 1 - d);
      }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aLamp', new THREE.Float32BufferAttribute(lit, 4));
    g.computeBoundingSphere();
    out.push(g);
  });
  return out;
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
