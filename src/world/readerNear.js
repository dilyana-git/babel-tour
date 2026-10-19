// Bridge and lectern readers wear fulled moorit wool. Its nap, pills and
// hood shadow hold at arm's length and wherever a lamp lights the figure;
// from a distance, the room's own light and colour take over.
import * as THREE from 'three';

// `weave`: [threads to a unit (a unit is 9.4 cm), how steep their relief,
// how much paler a thread's crown is than its sides]. `wool`: [the colour
// the cloth is drawn toward, how far
// its own colour is let go (0 none, 1 all), its value]. `face`: [where the
// rim's shadow ends on the face (+1 the crown, -1 the chin), how soft its
// edge, what is left of the light above it, what is left below it].
// `skin`: how much of the skin's colour is let go (the orange).
const NEAR = { weave: [30, 0.32, 0.12], wool: [[0.95, 0.72, 0.52], 0.35, 0.42], face: [-0.62, 0.1, 0.02, 0.12], skin: 0.55 };
// How near it all holds: wholly within the first (a unit is 9.4 cm), none of
// the darkening past the second; and how much of the colour's letting go
// is kept past it.
const NEAR_REACH = [30, 70, 0.3];
// Lamplight at the chest holds the darker wool even beyond NEAR_REACH.
// One measure for the whole figure keeps its hood and hem consistent.
const NEAR_LIT = [0.6, 1.6];

// The same wool and skin treatment for every bridge and lectern reader.
const U = {
  uNear: { value: new THREE.Vector3(...NEAR.weave) },
  uNearCol: { value: new THREE.Vector4(...NEAR.wool[0], NEAR.wool[1]) },
  uNearFace: { value: new THREE.Vector4(...NEAR.face) },
  uNearMisc: { value: new THREE.Vector2(NEAR.wool[2], NEAR.skin) },
  uNearLit: { value: new THREE.Vector2(...NEAR_LIT) },
};

// Put it into a reader's material after clothShader (readers.js), which it
// needs (vCloth, vKind, clothNoise). `face`: the geometry's userData.face.
export const nearMaterial = (mat, face) => {
  const prev = mat.onBeforeCompile;
  const at = new THREE.Vector4(...(face ?? [0, 16.2, 0.2, 0]));
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    Object.assign(sh.uniforms, U, { uFaceAt: { value: at } });
    nearShader(sh);
  };
  mat.customProgramCacheKey = () => 'babel-walker-near';
};

const nearShader = (sh) => {
  // (the chest, where the lamplight on the reader is asked: one place for
  // the whole figure, so the hood is not held more than the hem)
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
      varying vec3 vNearChest;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vNearChest = (modelViewMatrix * vec4(0.0, 12.0, 0.0, 1.0)).xyz;`);
  sh.fragmentShader = sh.fragmentShader
    .replace('void main() {', `
      uniform vec3 uNear;
      uniform vec4 uNearCol;
      uniform vec4 uNearFace;
      uniform vec2 uNearMisc;
      uniform vec4 uFaceAt;
      uniform vec2 uNearLit;
      varying vec3 vNearChest;
      // The cloth's relief: its height (x) and that height's gradient in the
      // reader's own frame (yzw), already let go of where a thread would be
      // finer than a few pixels. Threads run round the body and up it: round
      // it by the angle about the reader's axis (a whole number of threads
      // to the turn, so no seam), up it by height.
      vec4 nearWeave(vec3 p) {
        // fulled: no thread, a nap, and pills
        vec4 n1 = clothNoise(p * uNear.x + 2.3);
        vec4 n2 = clothNoise(p * uNear.x * 2.3 + 8.1);
        vec4 n3 = clothNoise(p * uNear.x * 0.45 + 11.7);
        float fw = length(fwidth(p)) * uNear.x;
        float on1 = 1.0 - smoothstep(0.3, 0.7, fw), on2 = 1.0 - smoothstep(0.3, 0.7, fw * 2.3), on3 = 1.0 - smoothstep(0.3, 0.7, fw * 0.45);
        float pill = smoothstep(0.8, 0.9, n3.x);
        float dPill = 6.0 * clamp((n3.x - 0.8) / 0.1, 0.0, 1.0) * (1.0 - clamp((n3.x - 0.8) / 0.1, 0.0, 1.0)) / 0.1;
        float h = (n1.x - 0.5) * on1 + 0.5 * (n2.x - 0.5) * on2 + 0.35 * pill * on3;
        vec3 g = (n1.yzw * on1 + 0.5 * n2.yzw * on2 * 2.3 + 0.35 * dPill * n3.yzw * on3 * 0.45);
        return vec4(h, g);
      }
      vec4 nearW = vec4(0.0);
      void main() {`)
    // the colour: undyed, and a thread's crown paler than its sides
    .replace('#include <color_fragment>', `#include <color_fragment>
      {
        nearW = nearWeave(vCloth);
        if (vKind < 1.15) {
          nearW *= 1.0 - smoothstep(0.3, 0.7, vDark);
          diffuseColor.rgb *= 1.0 + uNear.z * nearW.x;
        } else if (vKind > 4.75 && vKind < 5.75) {
          float nS = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(nS) * vec3(1.0, 0.86, 0.74), uNearMisc.y);
        }
      }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (vKind < 1.15) {
        vec3 nG = normalMatrix * (nearW.yzw * uNear.y);
        normal = normalize(normal - (nG - dot(nG, normal) * normal));
      }`)
    // The face: in the hood rim's shadow down to uNearFace.x, a little left
    // of it above, more below; measured up the face as the head is bowed.
    // The wool's colour, undyed and darker — on the light it gives back, not
    // its albedo: under a lamp close by, the fuzz, the rim and the arch's
    // edge (clothShader) each add a pale of their own that no albedo
    // touches, and it was those that made it cream. All of it at arm's
    // length; from the stand, where lighting them made them the room's
    // subject, their light kept and some of the colour (NEAR_REACH).
    // (and wherever a lamp is on the reader, however far off: NEAR_LIT)
    .replace('#include <opaque_fragment>', `if (vKind < 1.15) {
        float nK = 1.0 - smoothstep(${NEAR_REACH[0].toFixed(1)}, ${NEAR_REACH[1].toFixed(1)}, length(vViewPosition));
        #if NUM_POINT_LIGHTS > 0
        float nE = 0.0;
        for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
          nE += dot(pointLights[i].color, vec3(0.3, 0.59, 0.11))
            * getDistanceAttenuation(length(pointLights[i].position - vNearChest), pointLights[i].distance, pointLights[i].decay);
        }
        nK = max(nK, smoothstep(uNearLit.x, uNearLit.y, nE));
        #endif
        float nL = dot(outgoingLight, vec3(0.3, 0.59, 0.11));
        float nT = dot(uNearCol.rgb, vec3(0.3, 0.59, 0.11));
        outgoingLight = mix(outgoingLight, nL * uNearCol.rgb / nT, uNearCol.w * mix(${NEAR_REACH[2].toFixed(2)}, 1.0, nK)) * mix(1.0, uNearMisc.x * nT, nK);
      }
      if (vKind > 4.75 && vKind < 5.75) {
        vec3 fUp = vec3(0.0, cos(uFaceAt.w), sin(uFaceAt.w));
        vec3 fD = vCloth - uFaceAt.xyz;
        float fNear = 1.0 - smoothstep(1.6, 2.4, length(fD));
        float fy = dot(fD, fUp) / 1.12;
        float fLit = 1.0 - smoothstep(uNearFace.x - uNearFace.y, uNearFace.x + uNearFace.y, fy);
        outgoingLight *= mix(1.0, mix(uNearFace.z, uNearFace.w, fLit), fNear);
      }
      #include <opaque_fragment>`);
};
