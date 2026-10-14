// The Echo's moonlight comparison.
// What each point was, and why: docs/design-history.md.
//
// ?wechofix=old or ?wechofix=old:4 restores the lower moonlight column.
// (?wecho=old is the flights' old tread, and is its own.)
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('wechofix') : null;
const ONLY = Q && Q.startsWith('old:') ? new Set(Q.slice(4).split(',').map(Number)) : null;
export const echoOld = (n) => Q === 'old' || (ONLY ? ONLY.has(n) : false);

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
