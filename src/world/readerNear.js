// The readers at arm's length (2026-10-15, audit V, board 3, point 3).
// From the stand the file on the Vestibule's bridge is good. Walk past one
// and the hood is smooth cream with no weave and no weight in its folds, and
// the face is an orange blob with a shadow for eyes: lighting them (libraryProps.js,
// 2) made them visible, which also made this visible. It is the closest any
// human figure comes to the eye in ordinary walking.
//
// Three ways, all three undyed wool (the board: "more undyed wool than
// banana"), each with its own cloth and its own way of keeping the face in
// the hood:
//   a  twill, oatmeal: a fine diagonal twill; the brow, the eyes and the
//      cheekbones in the hood rim's shadow, the nose's tip and the chin
//      catching a little of the page
//   b  fulled, moorit: felted wool, no thread to be seen, a nap and pills;
//      a darker grey-brown fleece; the hood an empty dark but for the chin
//   c  homespun, greige: a coarse plain weave, thick-and-thin yarn; the
//      rim's shadow a line across the cheekbones, under it a dim face
// Only the bridge readers and the one at the lectern (walkers.js); the
// Silence's reader and the finale's others are left as they are.
//
// The user's pick, from the canvas of the three (2026-10-15): b. ?wnear=a|c
// puts one of the other two in its place; `old` is the readers as they were.
// DEV: window.__wnear('a') switches it live.
import * as THREE from 'three';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

// `weave`: [threads to a unit (a unit is 9.4 cm), how steep their relief,
// the kind (0 twill, 1 fulled, 2 plain), how much paler a thread's crown is
// than its sides]. `wool`: [the colour the cloth is drawn toward, how far
// its own colour is let go (0 none, 1 all), its value]. `face`: [where the
// rim's shadow ends on the face (+1 the crown, -1 the chin), how soft its
// edge, what is left of the light above it, what is left below it].
// `skin`: how much of the skin's colour is let go (the orange).
export const NEARS = {
  a: { weave: [22, 0.32, 0, 0.1], wool: [[1.0, 0.82, 0.6], 0.25, 0.62], face: [-0.32, 0.14, 0.03, 0.32], skin: 0.45 },
  b: { weave: [30, 0.32, 1, 0.12], wool: [[0.95, 0.72, 0.52], 0.35, 0.42], face: [-0.62, 0.1, 0.02, 0.12], skin: 0.55 },
  c: { weave: [12, 0.3, 2, 0.1], wool: [[1.0, 0.84, 0.66], 0.38, 0.55], face: [-0.02, 0.035, 0.04, 0.42], skin: 0.5 },
};
// How near it all holds: wholly within the first (a unit is 9.4 cm), none of
// the darkening past the second; and how much of the colour's letting go
// is kept past it.
const NEAR_REACH = [30, 70, 0.3];
const PICK = Q.get('wnear') ?? 'b';
export const NEAR_ON = !!NEARS[PICK];

// One set of uniforms for every reader it is on, so a switch is live.
const U = {
  uNear: { value: new THREE.Vector4() },
  uNearCol: { value: new THREE.Vector4() },
  uNearFace: { value: new THREE.Vector4() },
  uNearMisc: { value: new THREE.Vector4() },
};
const set = (o) => {
  U.uNear.value.set(...o.weave);
  U.uNearCol.value.set(...o.wool[0], o.wool[1]);
  U.uNearFace.value.set(...o.face);
  U.uNearMisc.value.set(o.wool[2], o.skin, 1, 0);
};
if (NEAR_ON) set(NEARS[PICK]);
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__wnear = (k) => { if (NEARS[k]) set(NEARS[k]); else U.uNearMisc.value.z = 0; return k; };
  // (and any of an option's numbers, live: __wnearTune('a', { wool: [[1, 0.8, 0.6], 0.4, 0.6] }))
  window.__wnearTune = (k, o) => { set({ ...NEARS[k], ...o }); return o; };
}

// Put it into a reader's material after clothShader (readers.js), which it
// needs (vCloth, vKind, clothNoise). `face`: the geometry's userData.face.
export const nearMaterial = (mat, face) => {
  if (!NEAR_ON) return;
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
  sh.fragmentShader = sh.fragmentShader
    .replace('void main() {', `
      uniform vec4 uNear;
      uniform vec4 uNearCol;
      uniform vec4 uNearFace;
      uniform vec4 uNearMisc;
      uniform vec4 uFaceAt;
      // The cloth's relief: its height (x) and that height's gradient in the
      // reader's own frame (yzw), already let go of where a thread would be
      // finer than a few pixels. Threads run round the body and up it: round
      // it by the angle about the reader's axis (a whole number of threads
      // to the turn, so no seam), up it by height.
      vec4 nearWeave(vec3 p) {
        float k = uNear.z;
        if (k > 0.5 && k < 1.5) {
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
        float r2 = max(p.x * p.x + p.z * p.z, 0.04);
        float turns = floor(uNear.x * 6.2831853 * 2.4 + 0.5);
        float u = atan(p.x, p.z) * turns;
        float v = p.y * uNear.x * 6.2831853;
        vec3 gu = turns * vec3(p.z, 0.0, -p.x) / r2, gv = vec3(0.0, uNear.x * 6.2831853, 0.0);
        float on = 1.0 - smoothstep(0.8, 1.6, max(fwidth(u), fwidth(v)));
        float h; vec3 g;
        if (k < 0.5) {
          // twill: the ribs running on the diagonal, and the threads across them faintly
          h = sin(u + v) + 0.25 * sin(u) * sin(v);
          g = cos(u + v) * (gu + gv) + 0.25 * (cos(u) * sin(v) * gu + sin(u) * cos(v) * gv);
        } else {
          // plain, homespun: over and under, and the yarn thick and thin along itself
          float slub = 0.65 + 0.7 * clothNoise(vec3(p.x * 3.0, floor(v / 3.1415927) * 0.37, p.z * 3.0)).x;
          float slub2 = 0.65 + 0.7 * clothNoise(vec3(floor(u / 3.1415927) * 0.41, p.y * 3.0, 5.0)).x;
          h = sin(u) * sin(v) * 0.5 * (slub + slub2) + 0.3 * (slub * sin(v) * sin(v) + slub2 * sin(u) * sin(u) - 1.0);
          g = (cos(u) * sin(v) * gu + sin(u) * cos(v) * gv) * 0.5 * (slub + slub2) + 0.3 * (slub * sin(2.0 * v) * gv + slub2 * sin(2.0 * u) * gu);
        }
        // (per unit of the phase: the steepness is uNear.y whatever the count)
        return vec4(h * on, g * on / (uNear.x * 6.2831853));
      }
      vec4 nearW = vec4(0.0);
      void main() {`)
    // the colour: undyed, and a thread's crown paler than its sides
    .replace('#include <color_fragment>', `#include <color_fragment>
      if (uNearMisc.z > 0.0) {
        nearW = nearWeave(vCloth);
        if (vKind < 1.15) {
          nearW *= 1.0 - smoothstep(0.3, 0.7, vDark);
          diffuseColor.rgb *= 1.0 + uNear.w * nearW.x;
        } else if (vKind > 4.75 && vKind < 5.75) {
          float nS = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(nS) * vec3(1.0, 0.86, 0.74), uNearMisc.y);
        }
      }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (uNearMisc.z > 0.0 && vKind < 1.15) {
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
    .replace('#include <opaque_fragment>', `if (uNearMisc.z > 0.0 && vKind < 1.15) {
        float nK = 1.0 - smoothstep(${NEAR_REACH[0].toFixed(1)}, ${NEAR_REACH[1].toFixed(1)}, length(vViewPosition));
        float nL = dot(outgoingLight, vec3(0.3, 0.59, 0.11));
        float nT = dot(uNearCol.rgb, vec3(0.3, 0.59, 0.11));
        outgoingLight = mix(outgoingLight, nL * uNearCol.rgb / nT, uNearCol.w * mix(${NEAR_REACH[2].toFixed(2)}, 1.0, nK)) * mix(1.0, uNearMisc.x * nT, nK);
      }
      if (uNearMisc.z > 0.0 && vKind > 4.75 && vKind < 5.75) {
        vec3 fUp = vec3(0.0, cos(uFaceAt.w), sin(uFaceAt.w));
        vec3 fD = vCloth - uFaceAt.xyz;
        float fNear = 1.0 - smoothstep(1.6, 2.4, length(fD));
        float fy = dot(fD, fUp) / 1.12;
        float fLit = 1.0 - smoothstep(uNearFace.x - uNearFace.y, uNearFace.x + uNearFace.y, fy);
        outgoingLight *= mix(1.0, mix(uNearFace.z, uNearFace.w, fLit), fNear);
      }
      #include <opaque_fragment>`);
};
