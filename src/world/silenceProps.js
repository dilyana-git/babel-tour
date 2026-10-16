// The Silence's details: the reader's light from the terrace, the dead
// glass, the arches' bounce and the blind hallway's crown.
import * as THREE from 'three';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// The light the lamp's pool on the terrace throws back up: warm, from the
// stone at the reader's feet, onto the robe's front, the hands and the book,
// and under the hood the face (clothShader's uGlow). Strength, and how far in
// front of the seat the lit stone is.
export const BOUNCE = { k: qn('wsglow', 3), ahead: 3.2, rise: 0.4 };
// And the robe a dark umber rather than the darkest wool there is (#18120f,
// a hundredth of the light it is given): with the lamp off to the side the
// wool no longer comes up grey from behind, and nothing could lift it.
// and its fuzz and lit edge turned down: lit from behind at a grazing angle,
// the wool's sheen and rim (both grey whatever the dye) made the shoulder
// pale plaster.
export const SHEEN = qn('wssheen', 0.3);
export const ROBE = Q.get('wsrobe') ? `#${Q.get('wsrobe')}` : '#231a14';

// How much more of the lamplit floor's bounce (stoneShade) the flights'
// stone takes (`lift`), and that the faces standing upright take it too
// (`side`). From the stand what reads as "the stair under the terrace" is the
// two arch rings, seen nearly end on: every voussoir's end a band, one over
// the next like steps. Those ends face the room and away from the lamp, and
// the bounce was for soffits only — so they had the hushed fill and nothing
// else, and went to black.
export const ARCH_LIFT = { lift: 14, side: 1 };

// The globes that have gone out, as GLASS. Smoked opal with dust collected
// under the collar; its intact glaze reflects the one burning lamp, and the
// dust softens that reflection at the top. But a sphere of dark glass is not a
// sphere of iron: the sightline goes THROUGH the near wall and finds the
// inside of the far one, lit by what light is in the room, and the limb turned
// toward the burning lamp takes a rim of it at a graze. And a globe may keep an
// ember — `aEmber`, per instance, a fraction of a lamp — so that the room shows
// lamps dying rather than a ceiling of dead ones.
// `ember`: how much is left in a globe, by the bearing it hangs at (silence.js).
export const DEAD_EMBERS = { 110: 0.45, 330: 0.3, 185: 0.1 };
export function deadGlassPatch(mat) {
  mat.roughness = 0.16;
  mat.envMapIntensity = 0;
  mat.color.set('#39312b');
  const lamp = { value: new THREE.Vector4() };
  mat.userData.lamp = lamp;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDeadLamp = lamp;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDeadL;
        ${`attribute float aEmber;
        varying vec3 vDeadW; varying vec3 vDeadC; varying float vDeadR; varying float vDeadEmber;`}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vDeadL = position;
        ${`// the globe's own sphere in the world: its centre and its radius, so the
        // far wall of it can be found along the sightline (below)
        mat4 deadM = modelMatrix;
        #ifdef USE_INSTANCING
          deadM = deadM * instanceMatrix;
        #endif
        vDeadW = (deadM * vec4(position, 1.0)).xyz;
        vDeadC = (deadM * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vDeadR = max(length(deadM[0].xyz), 1e-3);
        vDeadEmber = aEmber;`}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDeadL;
        uniform vec4 uDeadLamp;
        ${'varying vec3 vDeadW; varying vec3 vDeadC; varying float vDeadR; varying float vDeadEmber;'}
        float deadHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float deadNoise(vec3 x) {
          vec3 i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(deadHash(i), deadHash(i + vec3(1, 0, 0)), f.x), mix(deadHash(i + vec3(0, 1, 0)), deadHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(deadHash(i + vec3(0, 0, 1)), deadHash(i + vec3(1, 0, 1)), f.x), mix(deadHash(i + vec3(0, 1, 1)), deadHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float deadSoot = smoothstep(-0.35, 0.82, vDeadL.y + 0.3 * (deadNoise(vDeadL * vec3(5.0, 1.4, 5.0)) - 0.5));
        float deadDust = smoothstep(0.25, 0.85, vDeadL.y)
          * (0.55 + 0.45 * deadNoise(vDeadL * 34.0));
        diffuseColor.rgb *= mix(1.0, 0.38, deadSoot);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.069, 0.052), deadDust * 0.5);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.62, deadDust);`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        // The room's environment includes other galleries' lamps. Keep its
        // diffuse fill, and reserve the glass reflection for this room's lamp.
        reflectedLight.directSpecular = vec3(0.0);
        reflectedLight.indirectSpecular = vec3(0.0);`)
      .replace('#include <opaque_fragment>', `
        // The reflected lamp has its actual angular size, feathered by a
        // pixel so a distant highlight remains a small spot as the eye moves.
        vec3 deadV = normalize(vViewPosition);
        vec3 deadP = (viewMatrix * vec4(uDeadLamp.xyz, 1.0)).xyz + vViewPosition;
        float deadD = max(length(deadP), 0.001);
        float deadFacing = dot(reflect(-deadV, normal), deadP / deadD);
        float deadEdge = cos(min(0.22, uDeadLamp.w / deadD));
        float deadWidth = max(fwidth(deadFacing), 0.00015);
        float deadPin = smoothstep(deadEdge - deadWidth, deadEdge + deadWidth, deadFacing);
        ${`
        // ── The glass, and what is behind it ──
        // The sphere is known exactly, so the sightline can be followed
        // through it: in at this fragment, out at the far wall. What the eye
        // reads as the body of the globe is the INSIDE of that far wall.
        vec3 deadN = normalize(vDeadW - vDeadC);
        vec3 deadEye = normalize(cameraPosition - vDeadW);
        vec3 deadRay = -deadEye;
        float deadFace = clamp(dot(deadN, deadEye), 0.0, 1.0);
        vec3 deadBack = vDeadW - 2.0 * dot(deadRay, vDeadW - vDeadC) * deadRay;
        vec3 deadInN = normalize(vDeadC - deadBack);
        vec3 deadToLamp = uDeadLamp.xyz - deadBack;
        float deadLampD = max(length(deadToLamp), 1.0);
        vec3 deadL = deadToLamp / deadLampD;
        // one lamp, a room away: what reaches a globe falls off from it
        float deadReach = step(0.01, uDeadLamp.w) / (1.0 + pow(deadLampD / 70.0, 2.0));
        // the far wall lit from the room side, and — for a globe with the lamp
        // behind it — the little that comes through the glass from behind
        float deadInside = max(dot(deadInN, deadL), 0.0) + 0.25 * max(-dot(deadInN, deadL), 0.0);
        // The inside is not clean, and it is what keeps the globe from reading
        // as a shaded ball: the mottle of hand-blown glass at two scales, and
        // the dust that has settled in the bottom of it — a pool with an edge
        // to it, lying across the sphere where no surface shading would put a line.
        vec3 deadBackL = -deadInN;
        deadInside *= 0.2 + 0.45 * deadNoise(deadBackL * 9.0) + 0.3 * deadNoise(deadBackL * 23.0)
          + 0.95 * (1.0 - smoothstep(-0.72, -0.42, deadBackL.y));
        // and it is seen THROUGH the near wall: skimmed at the limb, and under
        // the collar barely at all, where the soot of its own burning is
        float deadClear = smoothstep(0.04, 0.5, deadFace) * (1.0 - 0.5 * deadDust) * mix(1.0, 0.3, deadSoot);
        outgoingLight += vec3(0.032, 0.019, 0.011) * deadInside * deadClear * deadReach;
        // The rim: the sightline that skims the limb runs the length of the
        // glass, which at that graze reflects — a bright edge on the side the
        // one lamp is on, and the one thing a ball of iron could not do. It is
        // narrow (the outer tenth of the disc) because that is where the glass
        // is edge-on; spread over the whole sphere it would only make a paler ball.
        vec3 deadRimL = normalize(uDeadLamp.xyz - vDeadW);
        float deadRim = pow(1.0 - deadFace, 6.0) * smoothstep(-0.25, 0.55, dot(deadN, deadRimL));
        outgoingLight += vec3(0.62, 0.36, 0.17) * deadRim * (1.0 - 0.5 * deadDust) * deadReach;
        // A globe that is not out: an ember where the burner is, a little above
        // the middle of the glass, found as the sightline's nearest approach to
        // it; the inside of its own globe lit by it; and the smoke of it over
        // the whole of the glass. Kept to a fraction of a lamp — this is a lamp
        // going out, not a small lamp.
        if (vDeadEmber > 0.0) {
          vec3 deadCoal = vDeadC + vec3(0.0, 0.2, 0.0) * vDeadR;
          vec3 deadToCoal = deadCoal - vDeadW;
          float deadMiss = length(deadToCoal - deadRay * max(dot(deadToCoal, deadRay), 0.0)) / vDeadR;
          float deadBurn = exp(-deadMiss * deadMiss / 0.055);
          outgoingLight += vec3(0.42, 0.18, 0.055) * vDeadEmber * (0.08 + 0.92 * deadBurn) * (1.0 - 0.45 * deadDust);
          outgoingLight += vec3(0.16, 0.085, 0.035) * vDeadEmber * deadClear
            * (0.3 + 0.6 * max(dot(deadInN, normalize(deadCoal - deadBack)), 0.0));
        }`}
        outgoingLight += vec3(0.8, 0.56, 0.3) * ${'0.55 * '}deadPin * (1.0 - 0.85 * deadDust) * step(0.01, uDeadLamp.w);
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `babel-dead-glass-lamp-${'shell'}`;
  return mat;
}

// The Vertigo's crown: a blind back to its parapet, between the posts and
// the sky. From the Silence's stand the hallway's line of sight runs on over
// the Vertigo's far wall and grazes its top, and with the moon low behind it
// the gaps between the posts printed as a row of cold white slots — the only
// cool colour in a warm room. How far out from the posts' middle it stands,
// and how thick.
export const CROWN_BACK = { out: 1.4, t: 0.8 };
