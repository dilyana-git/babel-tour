// ── The water ────────────────────────────────────────────────────────────────
// The pond under the Pavilion, and the two small pools with stone rims.
//
// What the garden had before this was a teal slab with one ripple normal map
// sliding across it at a constant rate, lit as a near-perfect mirror of a
// nearly black sky — so it came out the palest thing in the frame, flat edge to
// edge, with eight lanterns hanging over it and not one of them touching it.
// "Over black water a single pavilion burns warm," says the caption. It was
// neither black nor water: it was a sheet of mint plastic, and a scrolling
// texture reads as a conveyor belt however slowly you run it.
//
// Water at night is three things, and it needs all three:
//
//   the body   almost nothing. A dielectric, not a metal: looked straight down
//              into, it reflects about 2% and shows its own near-black colour;
//              looked along, it reflects everything. That curve — Fresnel — is
//              what makes a surface read as a liquid rather than as paint, and
//              a metal has no such curve. Three's physical BRDF already carries
//              it for `metalness: 0`, which is why the environment can be left
//              to do the broad sheen on its own.
//
//   the waves  a sum of travelling wavefronts, evaluated per pixel from the
//              world position, with no texture at all. Six of them, their
//              wavelengths in an irrational cascade so they never lock into the
//              plaid a tiling normal map makes, their directions clustered
//              round one breeze rather than spread evenly (still water has a
//              wind; a soap film does not), and their crests sharpened — real
//              waves are pointed on top and flat in the trough, and that
//              asymmetry is most of what glitters.
//
//              Short waves are dropped as they shrink below a couple of pixels
//              and the slope they carried is handed to ROUGHNESS instead, which
//              is both the correct thing to do and the only way a hundred units
//              of open water does not boil with aliasing.
//
//   the lights what you actually see on a pond after dark is not the water, it
//              is the lamps lying in it. A point of light reflected off a wavy
//              surface is not a point: only the facets tilted just so send it
//              to the eye, so it draws a broken column running towards you,
//              longer the rougher the water. That is a specular lobe about the
//              reflected view ray — computed here from a handful of registered
//              lamp positions rather than by making them real lights, because
//              the lanterns light nothing else in the garden and a PointLight
//              costs the whole frame, not just the water.
//
//   the mirror   and under all of it, what the pond is FOR. A lamp's glitter
//              lands close to the eye — a light hung high reflects near your
//              feet, not out in the middle — so the whole middle distance of a
//              pond is a mirror of the far bank, the trees and whatever stands
//              in the water, and with nothing in it the water is just a black
//              hole in the garden. That needs a second pass: the world drawn
//              again from a camera mirrored through the surface, at a quarter
//              of the size, and only while a reader is near enough to a pond
//              to see one. The waves then bend the lookup, which is why a
//              reflection in water wobbles and a reflection in glass does not.
//
// Plus the shore: waves feel the bottom and shrink as they come in, the water
// goes over to silt where you can see through it, and the mirror gives out.
import * as THREE from 'three';

const MAX_LAMPS = 12;
const WAVES = 6;

// Tuned against the Pavilion at night; on a dial in DEV as window.__water.
export const WATER = {
  breeze: 24,        // the direction the whole train runs, degrees
  spread: 46,        // how far the six wander off it
  calm: 1.8,         // a whole-pond multiplier on every slope: 3 is a gusty night
  drift: 0.34,       // how much of the true deep-water wave speed to run at
  sharp: 2.3,        // crest sharpening: 1 is a sine, 3 is pointed
  rough: 0.035,      // the water's own roughness where every wave is resolved
  roughGain: 5.5,    // how hard dropped wave detail is folded back in as roughness
  glint: 90,         // the lamp lobe's tightness — how tall a column it draws
  glintGain: 9,   // and how bright
  wash: 0.006,       // a second, wide lobe: the lamp's glow spread over the water
  moon: 0.8,         // the moon path
  sky: 1.0,          // the reflected night, where the mirror has nothing
  // The mirror is lifted above the 1.0 that Fresnel alone would give it. Some
  // of that is honest — the pass runs at a quarter size with no bloom, so every
  // small bright thing in it (which at night is all of them) loses most of its
  // energy to the averaging before the water ever reads it — and some of it is
  // simply that a pond you can see into is worth more here than one that is
  // arithmetically correct and black.
  mirror: 2.0,
  warp: 4.0,         // how far the waves bend what it reflects
  reach: 620,        // stop drawing the mirror beyond this far from the water
  env: 0.05,         // and a whisper of the scene environment on top of it
  // Three's own specular from the real lights, which over water is a second,
  // clumsier copy of what the lamps above already do — and a far brighter one,
  // because these lamps are lit for a painting and not by the inverse square.
  direct: 0,
  shore: 0.72,       // how far in from the rim the bottom is still felt
  // DEV: which of the several things stacked on this surface you are actually
  // looking at — window.__water({ debug: n }), and the ladder is at the foot of
  // the fragment shader below. It is here because the first day of this went
  // into fighting the water for a warm sheet that turned out to be a LAMP POOL
  // lying over it (buildWorld, the Pavilion), and nothing else could have
  // settled that: a surface with six terms on it cannot be read by eye.
  debug: 0,
};

// The one surface every body of water in the garden lies in. A reflection is
// a property of a PLANE, not of a mesh, so the pond and the two rimmed pools
// share both the plane and the pass that fills it.
export const WATER_Y = 6.5;

// Wavelengths in world units (a unit is about 9.4 cm, so these run from three
// metres down to thirty centimetres) — successive ratios near the golden
// section, which is the cheapest way to keep six wavefronts from ever agreeing.
const LENGTHS = [34, 21.4, 13.2, 8.3, 5.1, 3.2];
const GRAVITY = 104;   // 9.81 m/s², in world units

export function makeWater({ mirror = true } = {}) {
  const time = { value: 0 };
  const lamps = [];
  const surfaces = [];

  const waveA = [];   // xy: direction, z: 2π/wavelength, w: amplitude
  const waveB = [];   // x: angular speed, y: wavelength, z: phase
  const buildWaves = () => {
    waveA.length = 0;
    waveB.length = 0;
    for (let i = 0; i < WAVES; i++) {
      const L = LENGTHS[i];
      // Alternating either side of the breeze and narrowing as they shorten:
      // the long swell holds the wind's line, the chop wanders across it.
      const off = (i % 2 ? 1 : -1) * WATER.spread * (1 - i / (WAVES + 2)) * (0.45 + ((i * 0.37) % 0.62));
      const a = ((WATER.breeze + off) * Math.PI) / 180;
      const k = (Math.PI * 2) / L;
      // Steeper as they shorten, which is what a wind does to them. The slope —
      // amplitude × k — is the only thing the surface normal ever sees.
      const steep = (0.009 + i * 0.0022) * WATER.calm;
      waveA.push(new THREE.Vector4(Math.cos(a), Math.sin(a), k, steep / k));
      waveB.push(new THREE.Vector3(Math.sqrt(GRAVITY * k) * WATER.drift, L, i * 2.39));
    }
  };
  buildWaves();

  const shared = {
    uTime: time,
    uWaveA: { value: waveA },
    uWaveB: { value: waveB },
    uSharp: { value: WATER.sharp },
    uRough: { value: WATER.rough },
    uRoughGain: { value: WATER.roughGain },
    uPixels: { value: 600 },                       // pixels per world unit at distance 1
    uLampPos: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
    uLampColor: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
    uLampCount: { value: 0 },
    uGlint: { value: new THREE.Vector3(WATER.glint, WATER.glintGain, WATER.wash) },
    uMoonDir: { value: new THREE.Vector3(0.62, 0.3, -0.72).normalize() },
    uMoonColor: { value: new THREE.Color('#9fc4e8') },
    uMoon: { value: WATER.moon },
    uSky: { value: WATER.sky },
    uEnv: { value: WATER.env },
    uDirect: { value: WATER.direct },
    uShoreFall: { value: WATER.shore },
    uDebug: { value: WATER.debug },
    // The mirror. Until the pass below has run there is nothing in it, and
    // uMirror stays at 0 — so the water falls back on the night sky alone and
    // never samples a target that was never filled.
    uMirror: { value: 0 },
    uMirrorMap: { value: null },
    uMirrorMatrix: { value: new THREE.Matrix4() },
    uWarp: { value: WATER.warp },
  };

  const common = /* glsl */ `
    uniform float uTime;
    uniform vec4 uWaveA[${WAVES}];
    uniform vec3 uWaveB[${WAVES}];
    uniform float uSharp;
    uniform float uRough;
    uniform float uRoughGain;
    uniform float uPixels;
    uniform vec3 uLampPos[${MAX_LAMPS}];
    uniform vec3 uLampColor[${MAX_LAMPS}];
    uniform int uLampCount;
    uniform vec3 uGlint;
    uniform vec3 uMoonDir;
    uniform vec3 uMoonColor;
    uniform float uMoon;
    uniform float uSky;
    uniform float uEnv;
    uniform float uDirect;
    uniform float uShoreFall;
    uniform float uDebug;
    uniform float uMirror;
    uniform sampler2D uMirrorMap;
    uniform float uWarp;
    varying vec4 vMirrorUv;

    // What a reflected ray finds. Not the scene environment — that is a
    // world-wide average with a warm lamplit band round its horizon, and over
    // the pond it came out as a sheet of wet sand. This is the same night the
    // sky dome draws (sky.js), so the water and the air above it agree; and a
    // ring of trees stands round this pond, so the flattest reflections — the
    // far water, where Fresnel is strongest — never reach the sky at all. That
    // is what makes the far half of a pond the blackest thing in a garden.
    vec3 waterSky(vec3 R) {
      float up = max(R.y, 0.0);
      vec3 col = mix(vec3(0.05, 0.062, 0.078), vec3(0.004, 0.007, 0.016), pow(up, 0.4));
      return col * mix(0.13, 1.0, smoothstep(0.0, 0.17, up));
    }
    uniform vec4 uBody;      // xy centre, zw radii of this body of water
    varying vec3 vWPos;

    // The surface at one point: the slope of the whole wave train there, and
    // how much of the train was too fine to be drawn at this distance.
    void waterSurface(vec2 p, float dist, float feel, out vec2 slope, out float lost) {
      slope = vec2(0.0);
      lost = 0.0;
      for (int i = 0; i < ${WAVES}; i++) {
        vec4 A = uWaveA[i];
        vec3 B = uWaveB[i];
        // A wave is worth drawing while its crests are still a few pixels
        // apart. Below that it is not detail, it is noise — and it belongs in
        // the roughness instead.
        float px = B.y * uPixels / max(dist, 1.0);
        float lod = smoothstep(1.6, 4.5, px);
        float amp = A.w * feel;
        float ph = dot(p, A.xy) * A.z + uTime * B.x + B.z;
        float w = 0.5 + 0.5 * sin(ph);
        float d = amp * uSharp * pow(max(w, 1e-4), uSharp - 1.0) * 0.5 * cos(ph);
        slope += A.xy * A.z * d * lod;
        float carried = amp * A.z * uSharp * 0.5;
        lost += carried * carried * (1.0 - lod);
      }
    }
  `;

  const material = ({ c, rx, rz }) => {
    const m = new THREE.MeshStandardMaterial({
      // The body of it. Nearly black, faintly blue-green: at night the only
      // thing a pond has of its own is the little the bank bounces into it.
      color: '#060e11',
      // A DIELECTRIC. This is the whole difference between water and a puddle
      // of mercury, and it is one number.
      metalness: 0,
      // Only what the shader falls back on: the wave train overwrites
      // roughnessFactor per pixel from what it could not resolve there, so it
      // is WATER.rough (uRough) that is live, not this.
      roughness: WATER.rough,
      // NOT envMapIntensity. When a MeshStandardMaterial has no envMap of its
      // own and the scene has an environment, three overwrites that uniform
      // with scene.environmentIntensity every frame (WebGLRenderer, "material
      // .envMap === null && scene.environment !== null") — so the field is
      // dead here, whatever it is set to, and the garden's 1.6 applies. That
      // is how this surface came out as a sheet of wet sand and stayed one
      // through every value of it: the scene environment is a world-wide
      // average with a warm lamplit band round its horizon (effects.js), and
      // Fresnel hands the grazing half of any water nearly all of what it
      // reflects. The water takes a whisper of it (uEnv, below) and reflects
      // the night itself instead — waterSky.
      // Transparent and just short of opaque on purpose: the clearance probe
      // (probe.js) knows water by exactly this, and a reader must be able to
      // walk the bridge over it without the wall check calling it a wall.
      transparent: true,
      opacity: 0.97,
    });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared);
      shader.uniforms.uBody = { value: new THREE.Vector4(c[0], c[1], rx, rz) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform mat4 uMirrorMatrix;
          varying vec3 vWPos;
          varying vec4 vMirrorUv;`)
        .replace('#include <project_vertex>', `#include <project_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vMirrorUv = uMirrorMatrix * vec4(vWPos, 1.0);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          ${common}`)
        // The surface normal, in place of the tangent-space normal map the
        // standard material would have sampled here.
        .replace('#include <normal_fragment_maps>', /* glsl */ `
          float wDist = length(vWPos - cameraPosition);
          // How much water there is under this pixel: 1 out in the middle,
          // falling to 0 at the rim, where a wave has already broken its back.
          float wEdge = clamp(length((vWPos.xz - uBody.xy) / uBody.zw), 0.0, 1.0);
          float wDepth = 1.0 - smoothstep(uShoreFall, 1.0, wEdge);
          vec2 wSlope; float wLost;
          waterSurface(vWPos.xz, wDist, mix(0.28, 1.0, wDepth), wSlope, wLost);
          vec3 wN = normalize(vec3(-wSlope.x, 1.0, -wSlope.y));
          normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
          // Everything the waves were too small to draw comes back as gloss.
          roughnessFactor = sqrt(uRough * uRough + wLost * uRoughGain);
          // Shallow water is silt, not sky: the bottom is close enough to see.
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.058, 0.040), (1.0 - wDepth) * 0.8);
          roughnessFactor = mix(roughnessFactor, 0.55, (1.0 - wDepth) * 0.7);`)
        // See the material, above: the scene environment cannot be turned down
        // from the material, so it is turned down here, where it lands.
        .replace('#include <lights_fragment_maps>', /* glsl */ `
          #include <lights_fragment_maps>
          radiance *= uEnv;
          iblIrradiance *= uEnv;`)
        // One model for a lamp in water, not two. A 6400-candela lantern hung
        // for the look of the room, reflected off a surface three will not let
        // be smoother than 0.0525, lays a sheet of warm gloss over the whole
        // pond; the lamps below draw the broken column a lamp really makes.
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          reflectedLight.directSpecular *= uDirect;`)
        // The lamps lying in it, and the moon path.
        .replace('#include <emissivemap_fragment>', /* glsl */ `
          #include <emissivemap_fragment>
          vec3 wV = normalize(cameraPosition - vWPos);
          vec3 wR = reflect(-wV, wN);
          // A dielectric reflects 2% head-on and nearly everything at a graze;
          // it is that rise, not the amount, that reads as water.
          float wF = (0.02 + 0.98 * pow(1.0 - clamp(dot(wN, wV), 0.0, 1.0), 5.0)) * mix(0.25, 1.0, wDepth);
          vec3 wLit = vec3(0.0);
          for (int i = 0; i < ${MAX_LAMPS}; i++) {
            if (i >= uLampCount) break;
            vec3 toL = uLampPos[i] - vWPos;
            float d2 = dot(toL, toL);
            float s = max(dot(wR, toL * inversesqrt(d2)), 0.0);
            float fall = 1.0 / (1.0 + d2 * 0.00045);
            wLit += uLampColor[i] * fall * (pow(s, uGlint.x) * uGlint.y + pow(s, 6.0) * uGlint.z);
          }
          // The moon is a long way off: a direction, not a place.
          float wMs = max(dot(wR, uMoonDir), 0.0);
          wLit += uMoonColor * uMoon * (pow(wMs, 900.0) * 2.4 + pow(wMs, 40.0) * 0.07);
          // What the mirror caught, bent by the waves. The slope is a world
          // vector and the lookup is in screen space, so the bend has to fall
          // off with distance the way everything in a projection does — at the
          // far shore a hand's width of wave must move the reflection by a
          // hand's width, not by a third of the frame.
          vec3 wSky = waterSky(wR);
          float wMir = 0.0;
          vec2 ruv = vec2(0.5);
          if (uMirror > 0.001) {
            ruv = vMirrorUv.xy / max(vMirrorUv.w, 1e-4);
            ruv += wSlope * uWarp * (1.0 / max(vMirrorUv.w, 1.0));
            // Off the edge of the pass there is nothing to read, so the night
            // takes over again rather than the border pixel smearing outward.
            vec2 inside = smoothstep(0.0, 0.035, ruv) * smoothstep(1.0, 0.965, ruv);
            wMir = uMirror * inside.x * inside.y;
            wSky = mix(wSky, texture2D(uMirrorMap, clamp(ruv, 0.001, 0.999)).rgb, wMir);
          }
          totalEmissiveRadiance += (wLit + wSky * mix(uSky, 1.0, wMir)) * wF;`)
        // ── DEV: what this surface is actually made of ───────────────────
        // window.__water({ debug: n }). Half a dozen terms land on one pixel of
        // water and several of them are warm and broad, so "it looks wrong" is
        // not a diagnosis; each of these takes one of them on its own.
        //   1 the surface normal          6 the environment, on its own
        //   2 Fresnel                     7 what the mirror gave this pixel
        //   3 the lamps in it             8 the mirror's own texture, x30
        //   4 roughness                   9 the shore: edge, then depth
        //   5 three's own lighting       10 flat magenta: IS this water?
        // The binary ones are binary on purpose — tone mapping, the grade and
        // the vignette between here and the screen can turn a small number into
        // no number at all, and 8 and 10 were both read as "black" for an hour
        // because of it.
        .replace('#include <opaque_fragment>', /* glsl */ `
          #include <opaque_fragment>
          if (uDebug > 0.5) {
            vec3 dbg = wN * 0.5 + 0.5;
            if (uDebug > 1.5 && uDebug < 2.5) dbg = vec3(step(0.08, wF), wF, 0.0);
            else if (uDebug > 2.5 && uDebug < 3.5) dbg = wLit;
            else if (uDebug > 3.5 && uDebug < 4.5) dbg = vec3(roughnessFactor);
            else if (uDebug > 4.5 && uDebug < 5.5) dbg = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse
              + reflectedLight.directSpecular + reflectedLight.indirectSpecular;
            else if (uDebug > 5.5 && uDebug < 6.5) dbg = reflectedLight.indirectSpecular;
            else if (uDebug > 6.5 && uDebug < 7.5) dbg = wSky;
            else if (uDebug > 7.5 && uDebug < 8.5) dbg = texture2D(uMirrorMap, clamp(ruv, 0.0, 1.0)).rgb * 30.0;
            else if (uDebug > 8.5 && uDebug < 9.5) dbg = vec3(wEdge, wDepth, 0.0);
            else if (uDebug > 9.5) dbg = vec3(1.0, 0.0, 1.0);
            gl_FragColor = vec4(dbg, 1.0);
          }`);
    };
    m.customProgramCacheKey = () => 'babel-water';
    return m;
  };

  // Every mesh that lies in the surface, so the pass below can take them out
  // of the world before it draws the world into their own mirror.
  const surface = (mesh) => { surfaces.push(mesh); return mesh; };

  // ── The mirror ────────────────────────────────────────────────────────────
  // The world drawn again from a camera reflected through WATER_Y. Three's
  // Reflector does this for a mesh; here the plane is fixed and shared, and the
  // pass is skipped outright whenever no reader is near enough to a pond for it
  // to land anywhere — which is six rooms out of eight.
  //
  // The near plane is skewed onto the water itself (the oblique projection
  // below) rather than clipped with a clipping plane, because turning clipping
  // on and off recompiles every material in the world; this costs one frustum
  // and nothing else. Without it the lawn UNDER the pond comes up in its own
  // reflection.
  const target = mirror ? new THREE.WebGLRenderTarget(16, 16, {
    // Linear light, half float: the water adds what it reads straight into its
    // own radiance, before tone mapping, and a byte target would band the sky
    // and clip every lantern to a white disc.
    type: THREE.HalfFloatType,
    colorSpace: THREE.LinearSRGBColorSpace,
    depthBuffer: true,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  }) : null;
  const eye = new THREE.PerspectiveCamera();
  const here = new THREE.Vector3();
  const there = new THREE.Vector3();
  const look = new THREE.Vector3();
  const spin = new THREE.Matrix4();
  const clip = new THREE.Vector4();
  const q = new THREE.Vector4();
  const plane = new THREE.Plane();
  const UP = new THREE.Vector3(0, 1, 0);
  const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const buffer = new THREE.Vector2();
  let size = [0, 0];

  // `near`: how far the reader is from the nearest water. The caller knows the
  // ponds; this only knows how to draw one.
  const reflect = (renderer, scene, camera, near) => {
    if (!target) return;
    if (near > WATER.reach || camera.position.y < WATER_Y + 1) {
      shared.uMirror.value = 0;
      return;
    }
    renderer.getDrawingBufferSize(buffer);
    // A quarter of the frame. Everything in it is about to be bent by waves and
    // multiplied by a Fresnel term that is small wherever the eye looks down —
    // there is no detail here to keep.
    const w = Math.max(160, Math.min(640, Math.round(buffer.x / 2)));
    const h = Math.max(96, Math.round((w * buffer.y) / Math.max(1, buffer.x)));
    if (size[0] !== w || size[1] !== h) { target.setSize(w, h); size = [w, h]; }

    here.setFromMatrixPosition(camera.matrixWorld);
    spin.extractRotation(camera.matrixWorld);
    // the eye, and the point it looks at, both turned over in the surface
    there.set(here.x, 2 * WATER_Y - here.y, here.z);
    look.set(0, 0, -1).applyMatrix4(spin).add(here);
    look.y = 2 * WATER_Y - look.y;
    eye.position.copy(there);
    eye.up.set(0, 1, 0).applyMatrix4(spin);
    eye.up.y = -eye.up.y;
    eye.lookAt(look);
    // Taken whole rather than rebuilt from fov and aspect, so whatever the
    // room has done to the lens — the long opening shot, the view offset that
    // shifts the world out from under the panel — the mirror has done too.
    eye.projectionMatrix.copy(camera.projectionMatrix);
    eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert();
    eye.updateMatrixWorld();

    // Skew the near plane onto the water (Lengyel's oblique frustum), so
    // nothing below the surface is ever drawn into what the surface reflects.
    plane.setFromNormalAndCoplanarPoint(UP, there.set(here.x, WATER_Y, here.z));
    plane.applyMatrix4(eye.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const P = eye.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + P[8]) / P[0], (Math.sign(clip.y) + P[9]) / P[5], -1, (1 + P[10]) / P[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    P[2] = clip.x;
    P[6] = clip.y;
    P[10] = clip.z + 1 - 0.004;
    P[14] = clip.w;

    shared.uMirrorMatrix.value.copy(BIAS).multiply(eye.projectionMatrix).multiply(eye.matrixWorldInverse);

    // The water is not in its own reflection. In a `finally`, because a pond
    // that threw once would otherwise stay invisible for the rest of the walk.
    const was = renderer.getRenderTarget();
    const wasShadow = renderer.shadowMap.autoUpdate;
    surfaces.forEach((m) => { m.visible = false; });
    try {
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, eye);
    } finally {
      renderer.setRenderTarget(was);
      renderer.shadowMap.autoUpdate = wasShadow;
      surfaces.forEach((m) => { m.visible = true; });
    }

    shared.uMirrorMap.value = target.texture;
    // Fade the mirror out as the reader walks away from the water rather than
    // dropping it: the pass stops at `reach`, and a mirror that switched off in
    // one frame would be a light going out across the whole pond.
    shared.uMirror.value = WATER.mirror * (1 - THREE.MathUtils.smoothstep(near, WATER.reach * 0.72, WATER.reach));
  };

  // A lamp the water can see. A colour and a power, not a light: nothing else
  // in the garden is lit by these, and the water is the only place they show.
  const addLamp = ([x, z], y, color, power = 1) => {
    lamps.push({ p: new THREE.Vector3(x, y, z), color: new THREE.Color(color), power });
  };

  // Points are sized in world units; this is pixels per unit at distance 1, and
  // it is what tells the wave train how fine it may go before it aliases.
  const setViewport = (pixelsPerUnit) => { shared.uPixels.value = pixelsPerUnit; };

  const seat = () => {
    const n = Math.min(lamps.length, MAX_LAMPS);
    for (let i = 0; i < n; i++) {
      const lamp = lamps[i];
      shared.uLampPos.value[i].copy(lamp.p);
      shared.uLampColor.value[i].set(lamp.color.r * lamp.power, lamp.color.g * lamp.power, lamp.color.b * lamp.power);
    }
    shared.uLampCount.value = n;
  };

  const tick = (t) => {
    time.value = t;
    if (shared.uLampCount.value !== Math.min(lamps.length, MAX_LAMPS)) seat();
  };

  // DEV only: the whole surface on a dial, so a night can be swept rather than
  // guessed at — window.__water({ calm: 1.4, glint: 60 }), then look again.
  const redial = () => {
    buildWaves();
    shared.uSharp.value = WATER.sharp;
    shared.uRough.value = WATER.rough;
    shared.uRoughGain.value = WATER.roughGain;
    shared.uGlint.value.set(WATER.glint, WATER.glintGain, WATER.wash);
    shared.uMoon.value = WATER.moon;
    shared.uSky.value = WATER.sky;
    shared.uEnv.value = WATER.env;
    shared.uDirect.value = WATER.direct;
    shared.uShoreFall.value = WATER.shore;
    shared.uWarp.value = WATER.warp;
    shared.uDebug.value = WATER.debug;
  };

  const dispose = () => { target?.dispose(); };

  return { material, surface, reflect, addLamp, setViewport, tick, redial, dispose, count: () => lamps.length };
}
