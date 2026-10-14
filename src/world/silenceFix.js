// The Silence's reader, dead glass, arch bounce and blind hallway crown.
// ?wsilfix=old restores the earlier reader fill, globe placement, arches and
// hallway crown; old:n selects those individual details (2–5).
import * as THREE from 'three';
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wsilfix');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const silenceOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);

const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// 2. The light the lamp's pool on the terrace throws back up: warm, from the
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

// 4. How much more of the lamplit floor's bounce (stoneShade) the flights'
// stone takes (`lift`), and that the faces standing upright take it too
// (`side`). From the stand what reads as "the stair under the terrace" is the
// two arch rings, seen nearly end on: every voussoir's end a band, one over
// the next like steps. Those ends face the room and away from the lamp, and
// the bounce was for soffits only — so they had the hushed fill and nothing
// else, and went to black.
export const ARCH_LIFT = { lift: 14, side: 1 };

// Smoked opal glass with dust collected under the collar. Its intact glaze
// reflects the one burning lamp; the dust softens that reflection at the top.
export function deadGlassPatch(mat) {
  mat.roughness = 0.16;
  mat.envMapIntensity = 0;
  mat.color.set('#39312b');
  const lamp = { value: new THREE.Vector4() };
  mat.userData.lamp = lamp;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDeadLamp = lamp;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDeadL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDeadL = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDeadL;
        uniform vec4 uDeadLamp;
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
        float deadFresnel = pow(1.0 - max(dot(normal, deadV), 0.0), 3.0);
        outgoingLight *= 1.0 - 0.28 * deadFresnel;
        outgoingLight += vec3(0.8, 0.56, 0.3) * deadPin * (1.0 - 0.85 * deadDust) * step(0.01, uDeadLamp.w);
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'babel-dead-glass-lamp';
  return mat;
}

// 5. The Vertigo's crown: a blind back to its parapet, between the posts and
// the sky. From the Silence's stand the hallway's line of sight runs on over
// the Vertigo's far wall and grazes its top, and with the moon low behind it
// the gaps between the posts printed as a row of cold white slots — the only
// cool colour in a warm room. How far out from the posts' middle it stands,
// and how thick.
export const CROWN_BACK = { out: 1.4, t: 0.8 };
