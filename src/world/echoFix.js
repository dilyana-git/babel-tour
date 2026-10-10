// The Echo's arrival frame, reviewed 2026-10-08 (the numbered points on the
// review board): 1 the stand a few strides further in, so the two column
// shafts frame the stair instead of walling a quarter of the frame off; 2 the
// stair read by its values — the nosing the palest line, the riser a shade
// under the tread, a string run up both flanks; 3 carved keystones over the
// arches instead of the bronze roundels that hung over them like knockers;
// 4 the moon's column of light begun above the lower storey's cornice, its
// edge warmed; 5 (the bright sliver between two balusters, which is the
// Silence's lamp seen through the hallway — moved out of line by 1); 6 the
// drum's ashlar coursed finer as it rises and no longer one tile repeated;
// 7 books over the ways out, so every bay of the upper storey shows shelves.
//
// ?wechofix=old puts all of them back as they were; ?wechofix=old:3,6 only
// those. (?wecho=old is the flights' old tread, and is its own.)
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('wechofix') : null;
const ONLY = Q && Q.startsWith('old:') ? new Set(Q.slice(4).split(',').map(Number)) : null;
export const echoOld = (n) => Q === 'old' || (ONLY ? ONLY.has(n) : false);

// 1. How far from the middle of the room the reader stands, on the flight's
// axis. In the aisle's middle (80.4) the colonnade's two nearest shafts stood
// 20 ahead and 16 to either side, and took the frame's outer seventh each.
// At 72 they stand just outside a 16:10 frame and come in at the very edges
// of a wider one; the first riser is nine units off.
// And 5: the "specular sliver" on the left balustrade was no highlight. It is
// the lamp hung in the hallway to the Silence, 180 away, seen through the last
// gap before the far flight's newel. Which gap it falls in is a matter of
// where the eye is, so it is settled here: from 72.5 in, the newel covers the
// whole globe (rays to the globe's disc, every quarter unit from 69 to 78:
// none seen to 72.5, a few from 72.75, a third of it from 75).
export const ECHO_STAND_R = 72;

// 4. The column of moonlight, ending in the air above the lower arcade (the
// gallery's rail) rather than hanging over the stair in front of the reader,
// and warmer at its edges, where the cool grey had read as a wedge of filter.
// (The light it lays on the treads, moonLand, is the light that reaches the
// stair; it stays.) Patched into the beam's own ShaderMaterial before it is
// ever compiled.
export const MOON_FROM = 60, MOON_FULL = 84;
export function moonBeamPatch(material) {
  if (echoOld(4)) return material;
  material.vertexShader = material.vertexShader
    .replace('varying float vOpen;', 'varying float vOpen;\n      varying float vMoonY;')
    .replace('gl_Position = projectionMatrix * mv;', 'vMoonY = (modelMatrix * vec4(position, 1.0)).y;\n        gl_Position = projectionMatrix * mv;');
  material.fragmentShader = material.fragmentShader
    .replace('varying float vOpen;', 'varying float vOpen;\n      varying float vMoonY;')
    .replace('gl_FragColor = vec4(uColor, uStrength * body * along * near * vOpen * intersection);', `
        // (warm toward the silhouette, where the column is thinnest, and a
        // little warm through: the stone's lamplight in the dust it lights)
        vec3 moonCol = mix(uColor, vec3(0.93, 0.82, 0.66), 0.25 + 0.6 * pow(1.0 - facing, 1.5));
        float moonRise = smoothstep(${MOON_FROM.toFixed(1)}, ${MOON_FULL.toFixed(1)}, vMoonY);
        // (what is left of the column is the upper half, which was always the
        // fainter: a little more of it, so the room still has its moon)
        gl_FragColor = vec4(moonCol, 1.45 * uStrength * body * along * near * vOpen * intersection * moonRise);`);
  return material;
}

// 6. The drum's coursing (a GLSL body for stoneShade's `drum`): the wall's own
// ashlar, but laid as a mason sets a tall wall — each course a little lower
// than the one under it, so the eye reads height — and every tile of courses
// set along by its own amount, so no block comes round again above itself.
// `s` is the height in courses at the foot's size: ds/dy = e^(y/L), so a
// course at y is e^(-y/L) of one on the floor (0.6 at the cornice). The
// length of the blocks steps down with them once a tile (twelve courses), at
// a bed joint, so the perpends stay plumb.
export const DRUM_L = 235;
export const drumUvGlsl = (tile, rep) => `
  vec2 drumUvOf(vec3 w, vec3 n) {
    vec3 an = abs(n);
    if (an.y >= an.x && an.y >= an.z) return w.xz * ${rep};
    vec2 t = normalize(vec2(-n.z, n.x) + 1e-6);
    float h = dot(w.xz, t);
    float s = ${DRUM_L.toFixed(1)} * (exp(max(w.y, 0.0) / ${DRUM_L.toFixed(1)}) - 1.0);
    float band = floor(s / ${tile});
    float k = 1.0 / (1.0 + (band + 0.5) * ${tile} / ${DRUM_L.toFixed(1)});
    float shift = fract(sin(band * 12.9898 + 4.1) * 43758.5453) * ${tile};
    return vec2(h / k + shift, s) * ${rep};
  }`;
