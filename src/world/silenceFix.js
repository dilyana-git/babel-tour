// The Silence's arrival frame, reviewed 2026-10-09 (the numbered points on the
// review board): 1 the reader's hood no longer over the lamp — the lamp hung a
// body-width to the side, so the head is drawn against its glow and not on
// it; 2 the reader lit from below by the lamp's own pool on the terrace, so
// the one figure is not the darkest thing in the frame and the balusters stand
// out against it; 3 the dead globes smoked and dulled, no longer clear
// bubbles, and two of them hung out of the stand's frame; 4 the arches under
// the flights lit from below, so their voussoirs — what the stand sees of the
// stair under the terrace — read course by course instead of going to black;
// 5 the moonlit sky between the posts on
// the Vertigo's far crown, seen through the hallway, closed behind them.
// (6, the key-cap hint over the cornice, went with the hint's move to the
// foot of the frame; 9, the copy, is in catalogue.js.)
//
// ?wsilfix=old puts all of them back as they were; ?wsilfix=old:2,4 only
// those.
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wsilfix');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const silenceOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);

// 1. Where the one lamp hangs, round the room's middle: [bearing, radius]. At
// dir(258)·9 it was six degrees from the reader's head as the stand sees it,
// and globe and hood touched — one dark lump with a light in its shoulder.
// Hung on over the 240° flight's crown it is a body-width clear of the head,
// and still over the place where the stairs stop. [bearing, radius, height]:
// higher than it was, so from the stand the globe clears the terrace's rail
// instead of sitting on it (at 56 it was still tangent to the rail's top).
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);
const LAMP_Y = qn('wslampy', 61);
export const LAMP_AT = [233, 12.5, LAMP_Y];

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

// 3. The dead glass: soot laid inside the globe from the top down, where the
// flame's smoke rose, and the glass gone dull — at roughness 0.07 every lamp
// in the room put a pin of light in each dead globe and they read as soap
// bubbles. (The bearings the two that hung in the stand's frame move to are
// in buildWorld.js.)
export function deadGlassPatch(mat) {
  if (silenceOld(3)) return mat;
  mat.roughness = 0.36;
  mat.envMapIntensity = 0.22;
  mat.color.set('#5e5246');
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDeadL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDeadL = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDeadL;
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
        // soot from the top down, heaviest under the collar and streaked
        // where it ran; the bottom of the bowl left a dull amber
        float deadSoot = smoothstep(-0.55, 0.75, vDeadL.y + 0.35 * (deadNoise(vDeadL * vec3(5.0, 1.4, 5.0)) - 0.5));
        diffuseColor.rgb *= mix(1.0, 0.3, deadSoot);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 0.98, 0.8), 1.0 - deadSoot);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        // (and the soot is matt: what gloss the glass keeps is low on the bowl)
        roughnessFactor = mix(roughnessFactor, 0.9, smoothstep(-0.2, 0.6, vDeadL.y));`);
  };
  mat.customProgramCacheKey = () => 'babel-dead-glass';
  return mat;
}

// 5. The Vertigo's crown: a blind back to its parapet, between the posts and
// the sky. From the Silence's stand the hallway's line of sight runs on over
// the Vertigo's far wall and grazes its top, and with the moon low behind it
// the gaps between the posts printed as a row of cold white slots — the only
// cool colour in a warm room. How far out from the posts' middle it stands,
// and how thick.
export const CROWN_BACK = { out: 1.4, t: 0.8 };
