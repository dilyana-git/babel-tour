// ── How lamplight falls ──────────────────────────────────────────────────────
// Two changes to three.js's own lighting, made once, when this module is first
// imported — before anything in the world has compiled a shader.
//
// 2026-10-05 the reader found the light "a bit harsh at places". Where it was
// harsh, it was harsh the same two ways:
//
// A LAMP IS A GLOBE, NOT A POINT. Three falls a light off as 1/d^decay from a
// point, so the stone a few units from a lamp — the keystone over the Echo's
// bay, the Vertigo's stair under its globe, the Pavilion's table and the floor
// round it — took many times the light of the wall it was hung to light, and
// printed as a blown patch with a hard rim. A real globe has a size, and what
// is near it sees its light come from a disc rather than a pinprick, so the
// near field is capped and the far field is unchanged: 1/(d² + R²)^(decay/2).
// LAMP_SOFT is that R — about a metre, twice the globe's own radius, because a
// lamp in a room also lights the air and the walls round it, and that is what
// the stone beside it sees. (buildWorld's `point` scales each lamp back up by
// `softGain` so that a wall DECAY_AT away is lit exactly as it was.)
//
// LIGHT WRAPS ROUND A FORM. With one point of light and nothing to bounce it,
// every column, baluster and robe was lit on one side and gone on the other,
// cut along a hard line where the surface turned away from the lamp: stage
// light. A lamp in a stone room lights the room, and the room lights the far
// side of everything a little, so the lamps' diffuse light is wrapped —
// (N·L + w) / (1 + w) — and fades out a little past the edge instead of on it.
// The highlight is not wrapped: a sheen only comes from the light itself. And
// only the lamps are: the moon is one hard light with a shadow map, and light
// wrapped past its terminator would meet its own shadow in a seam.
//
// ?wsoft=old puts both back; ?wsoft=N and ?wwrap=N dial them.
import * as THREE from 'three';

const Q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
const qNum = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);
const OLD = Q.get('wsoft') === 'old';
export const LAMP_SOFT = OLD ? 0 : Math.max(0, qNum('wsoft', 11));
export const LAMP_WRAP = OLD ? 0 : Math.max(0, qNum('wwrap', 0.35));

// What a lamp loses at `at` to the softer near field, so it can be given back.
export const softGain = (decay, at) => ((at * at + LAMP_SOFT * LAMP_SOFT) / (at * at)) ** (decay / 2);

const swap = (chunk, from, to) => {
  const src = THREE.ShaderChunk[chunk];
  // Fails loudly in development rather than lighting the world the old way
  // without a word: three changes these chunks from release to release.
  if (!src.includes(from)) {
    if (import.meta.env?.DEV) console.error(`lightModel: ${chunk} no longer has "${from.slice(0, 60)}…"`);
    return false;
  }
  THREE.ShaderChunk[chunk] = src.replace(from, to);
  return true;
};
const f = (x) => (Number.isInteger(x) ? `${x}.0` : `${x}`);

if (LAMP_SOFT > 0) {
  swap('lights_pars_begin',
    'float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );',
    `float distanceFalloff = 1.0 / max( pow( lightDistance * lightDistance + ${f(LAMP_SOFT * LAMP_SOFT)}, 0.5 * decayExponent ), 0.01 );`);
}

if (LAMP_WRAP > 0) {
  // How far the light in hand wraps: set to LAMP_WRAP for the point lights and
  // back to nothing before the spots and the moon (lights_fragment_begin).
  // Declared with the physical lighting, so only the standard materials see it
  // — the whole of the world.
  const declared = swap('lights_physical_pars_fragment',
    'void RE_Direct_Physical(',
    'float gLightWrap = 0.0;\nvoid RE_Direct_Physical(');
  const used = declared && swap('lights_physical_pars_fragment',
    'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );',
    `float wrapNL = saturate( ( dot( geometryNormal, directLight.direction ) + gLightWrap ) / ( 1.0 + gLightWrap ) );
	reflectedLight.directDiffuse += wrapNL * directLight.color * BRDF_Lambert( material.diffuseContribution );`);
  if (used) {
    swap('lights_fragment_begin',
      '#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )',
      `#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	#ifdef STANDARD
		gLightWrap = ${f(LAMP_WRAP)};
	#endif`);
    swap('lights_fragment_begin',
      '#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )',
      `#ifdef STANDARD
	gLightWrap = 0.0;
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )`);
  }
}
