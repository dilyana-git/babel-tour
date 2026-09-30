// ── Light in the air, and on the books ───────────────────────────────────────
// The shader pieces of the world that a stock material cannot do:
//
//   the bindings     one instanced box per book, bound in leather by an atlas
//                    of spines — raised bands that catch the lamp, tooled gold
//                    that is actually metal, paper labels — and seen from above,
//                    a page block inside a leather rim
//   the shafts       the cone of lit air under a lamp; faint, soft at its
//                    edges, gone when you walk into it
//   the motes        dust and fireflies as points of light that drift on the
//                    GPU, with a hot core and a soft falloff — solid spheres
//                    read as snow, or as beads
//   the environment  what polished things reflect: a warm band of lamplit
//                    shelves round a dark vault, with a few hot lamps in it
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SPINE_COLS, SPINE_ROWS, SPINE_KINDS } from './textures';

// ?wglare=old: the globes and the light columns as they were before 2026-09-26
// (see makeLampGlobeMaterial and shaftVolume), to compare against.
const OLD_GLARE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wglare') === 'old';
// ?wgraze=0..: how strongly the lamp-rails under the cornices wash the top
// shelves (see makeBookMaterial); 0 turns the wash off to compare.
const GRAZE = (() => {
  const v = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wgraze');
  return v !== null && v !== false && v !== '' && Number.isFinite(+v) ? +v : 0.75;
})();

// ── The bindings ──────────────────────────────────────────────────────────────

export function makeBookMaterial(atlas) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  material.defines = { USE_UV: '' };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSpineDetail = { value: atlas.detail };
    shader.uniforms.uSpineMask = { value: atlas.mask };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSpine;
        attribute float aGraze;
        attribute float aDust;
        varying vec2 vSpineUv;
        varying float vFace;
        varying float vGraze;
        varying float vDust;
        varying float vDeep;`)
      // aSpine is the atlas cell, plus 1000 for a book LAID FLAT. A laid book
      // shows its spine turned through a right angle, its cover on top and
      // the ends of its leaves at either side. Drawn as if it stood, the tall
      // spine was squeezed into a strip two units high and the stack read as
      // a grey radiator grille.
      //   vFace  1 spine   2 page block (top of a book that stands)
      //          3 cover   4 page ends (a laid book)   0 the rest
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float laid = step(999.5, aSpine);
        float cell = aSpine - 1000.0 * laid;
        vec2 cellAt = vec2(mod(cell, ${SPINE_COLS}.0), ${SPINE_ROWS - 1}.0 - floor(cell / ${SPINE_COLS}.0));
        vec2 suv = laid > 0.5 ? vec2(uv.y, uv.x) : uv;
        vSpineUv = (cellAt + vec2(0.04 + suv.x * 0.92, 0.01 + suv.y * 0.98)) / vec2(${SPINE_COLS}.0, ${SPINE_ROWS}.0);
        vFace = normal.z > 0.5 ? 1.0
          : normal.y > 0.5 ? (laid > 0.5 ? 3.0 : 2.0)
          : (laid > 0.5 && abs(normal.x) > 0.5 ? 4.0 : 0.0);
        // The wash from a lamp-rail under the cornice: strongest on the top
        // shelf, gone by the middle of the wall. aGraze says how much of it a
        // book's room has (none in the Silence).
        #ifdef USE_INSTANCING
          float grazeY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
        #else
          float grazeY = (modelMatrix * vec4(transformed, 1.0)).y;
        #endif
        vGraze = aGraze * pow(smoothstep(78.0, 111.0, grazeY), 1.6);
        vDust = aDust;
        // Only the Vertigo's books go this far down: the light at the bottom
        // of the funnel climbing its last few turns (see the Vertigo).
        vDeep = pow(smoothstep(-150.0, -440.0, grazeY), 1.5);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uSpineDetail;
        uniform sampler2D uSpineMask;
        varying vec2 vSpineUv;
        varying float vFace;
        varying float vGraze;
        varying float vDust;
        varying float vDeep;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 leather = diffuseColor.rgb;
        vec3 spineMask = vec3(0.0, 0.0, 0.43);
        if (vFace > 0.5 && vFace < 1.5) {
          float detail = texture2D(uSpineDetail, vSpineUv).r;
          spineMask = texture2D(uSpineMask, vSpineUv).rgb;
          vec3 col = leather * (0.2 + detail * 1.3);
          col = mix(col, vec3(0.6, 0.53, 0.4) * (0.5 + detail * 0.55), spineMask.g);
          col = mix(col, vec3(0.8, 0.6, 0.28), spineMask.r * 0.92);
          diffuseColor.rgb = col;
        } else if (vFace > 2.5 && vFace < 3.5) {
          // the cover of a book lying flat: its own leather, a shade darker
          // toward the edges where the boards are rubbed
          vec2 e = min(vUv, 1.0 - vUv);
          diffuseColor.rgb = leather * (0.62 + 0.16 * smoothstep(0.0, 0.12, min(e.x, e.y)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.4, 0.37), vDust * 0.5);
        } else if (vFace > 1.5) {
          // the top of the page block inside a rim of the binding: the edges of
          // the leaves as fine lines, browning toward one edge, each book its
          // own shade of old paper. One flat paper tone on every book read, from
          // above (down the Vertigo's well, most of all), as a floor of pale tiles.
          vec2 pagePixel = max(fwidth(vUv), vec2(1e-5));
          vec2 pageRim = smoothstep(vec2(0.1, 0.08) - pagePixel, vec2(0.1, 0.08) + pagePixel, vUv)
            * (1.0 - smoothstep(vec2(0.9, 0.94) - pagePixel, vec2(0.9, 0.94) + pagePixel, vUv));
          float inner = pageRim.x * pageRim.y;
          float age = fract(sin(dot(leather, vec3(12.9898, 78.233, 37.719)) * 91.7) * 43758.5453);
          // Fade page lines into their average before they become smaller than
          // two pixels; unfiltered procedural stripes have no texture mipmaps.
          float pagePhase = vUv.x * 190.0 + age * 40.0;
          float pageDetail = 1.0 - smoothstep(1.0, 3.14159, fwidth(pagePhase));
          float leaves = 0.86 + 0.14 * sin(pagePhase) * pageDetail;
          vec3 paper = vec3(0.46, 0.4, 0.31) * (0.5 + 0.32 * age) * leaves * mix(1.0, 0.72, smoothstep(0.35, 0.94, vUv.y));
          diffuseColor.rgb = mix(leather * 0.7, paper, inner);
          // a room nobody reads in: the tops gone grey under dust
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.4, 0.37), vDust * 0.6);
        } else {
          diffuseColor.rgb = leather * 0.55;
        }`)
      // The tooled gold is metal, but not a mirror. At 0.28/0.92 every letter on
      // every spine in the room threw a highlight small enough to sit inside a
      // pixel and bright enough to cross the bloom threshold — so a wall of
      // books glittered as the reader moved, and a library is not a chandelier.
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.42, spineMask.r);`)
      // Light raking down from the rail: returned by what it lands on, so it
      // is the binding's own colour (and the gilt's) that brightens, on the
      // spines far more than on the tops of the pages it barely reaches.
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.7, 0.42) * vGraze * ${GRAZE.toFixed(3)}
          * ((vFace > 0.5 && vFace < 1.5) ? 1.0 + spineMask.r * 0.8 : 0.25);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.62, 0.32) * vDeep * 0.9;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.78, spineMask.r);`)
      // The raised bands, as a bump taken from the height channel. The guard on
      // the normalize is not defensive tidiness — it is the whole of the black
      // squares the reader spent a week reporting.
      //
      // `det` is the scalar triple product of the two screen derivatives and
      // the normal, and it is ZERO wherever those three are coplanar: a
      // silhouette fragment, an edge-on spine, a degenerate quad. There,
      // `abs(det)` is 0 and `sign(det)` is 0, so the whole expression is
      // vec3(0.0) and `normalize` of that is 0/0 — **NaN**. A NaN normal makes
      // a NaN fragment, and a NaN fragment goes into the bloom, where the blur
      // spreads it over everything it touches. That is why the black patches
      // were SQUARE (a blur footprint is), why they moved about at random (a
      // different book is edge-on every frame), why they were worst in the
      // Echo (the most books in view), and why they got SMALLER rather than
      // going away when the bloom stopped using a mip chain — a smaller kernel
      // spreads one bad texel less far. It is also why raising the bloom's
      // threshold to 0.99 and dropping its intensity to zero changed nothing:
      // NaN fails every comparison and survives being multiplied by nothing.
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (vFace > 0.5 && vFace < 1.5) {
          vec2 dh = vec2(dFdx(spineMask.b), dFdy(spineMask.b)) * 2.2;
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1);
          vec3 bumped = abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2);
          float bumpLen = dot(bumped, bumped);
          normal = bumpLen > 1e-12 ? bumped * inversesqrt(bumpLen) : normal;
        }`);
  };
  material.customProgramCacheKey = () => `babel-books-${GRAZE}`;
  return material;
}

// A stable binding for a book at a place: no draw on the world's random stream.
export const spineAt = ([x, y, z]) => {
  const h = Math.sin(x * 12.9898 + z * 78.233 + y * 37.719) * 43758.5453;
  // any binding but vellum: a pale vellum spine is a choice (shelfWall makes
  // it), not something to scatter over the funnel and the vault
  return Math.floor((h - Math.floor(h)) * SPINE_KINDS.vellum[0]);
};

// ── The glowing cores ─────────────────────────────────────────────────────────
// A lamp's core, a lantern's paper: light seen THROUGH a round thing is hottest
// where the eye looks straight through it and falls off toward the rim. A flat
// emissive sphere is the same brightness edge to edge, and reads as a disc cut
// out of paper.
export function makeGlowMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vC;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vec4 mv = modelViewMatrix * local;
        vN = normalMatrix * n;
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vC;
      void main() {
        // safeNormalize: same NaN trap as the bindings above — a zero-length
        // view or normal vector turns the whole fragment, and then whatever
        // the bloom smears it across, into nothing.
        float nLen = dot(vN, vN), vLen = dot(vV, vV);
        float through = (nLen > 1e-12 && vLen > 1e-12)
          ? abs(dot(vN * inversesqrt(nLen), vV * inversesqrt(vLen))) : 1.0;
        gl_FragColor = vec4(vC * (0.07 + 1.55 * pow(through, 2.8)), 1.0);
      }
    `,
  });
}

// ── A lamp's globe ────────────────────────────────────────────────────────────
// "Light is provided by some spherical fruits which bear the name of lamps."
// The glass IS the lamp: one opal globe lit from inside, not a bright ball in a
// clear bubble (which read as a ping-pong ball in a soap bubble, with the
// fitting drowned inside it). Opal glass lit from its middle is hottest where
// you look straight through it and goes amber toward the limb, where the light
// has crossed more glass; under the bronze collar the cap shades it. It never
// reaches white — the light is "insufficient, incessant" — so it keeps its
// colour through the tone curve and the bloom does the rest. Built on the unit
// sphere: `position` is the globe's own coordinates, instance colour × k is its
// strength.
export function makeLampGlobeMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vC;
      varying vec3 vL;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vL = position;
        vec4 mv = modelViewMatrix * local;
        vN = normalMatrix * n;
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vC;
      varying vec3 vL;
      void main() {
        float nLen = dot(vN, vN), vLen = dot(vV, vV);
        float through = (nLen > 1e-12 && vLen > 1e-12)
          ? abs(dot(vN * inversesqrt(nLen), vV * inversesqrt(vLen))) : 1.0;
        vec3 hot = vec3(1.0, 0.9, 0.74);
        vec3 limb = vec3(0.78, 0.4, 0.14);
        // Only the middle may pass the bloom threshold (0.72): the rest of the
        // globe stays under it so the amber toward the limb survives the grade.
        // The tone curve and the exposure squeeze everything above ~0.4 into
        // the top of the range, so the hot spot has to be TIGHT (through^12 is
        // half-strength under a third of the way out) and the limb well down, or
        // the globe prints as one flat cream disc. At ^8 and 1.05 it still did
        // from the Echo's crossing, fifty units off: a white plate a fifth of
        // the frame wide (2026-09-26).
        vec3 col = limb * 0.24 + hot * 0.07 + hot * ${OLD_GLARE ? '1.05 * pow(through, 8.0)' : '0.9 * pow(through, 12.0)'};
        // the collar's shade over the crown of the globe
        col *= mix(1.0, 0.3, smoothstep(0.42, 0.9, vL.y));
        // hand-blown: the wall is never quite even
        float w = sin(vL.x * 21.0 + sin(vL.y * 13.0) * 2.0) * sin(vL.z * 17.0 + vL.y * 9.0);
        col *= 1.0 + 0.05 * w;
        gl_FragColor = vec4(vC * col, 1.0);
      }
    `,
  });
}

// ── Foliage ───────────────────────────────────────────────────────────────────
// A tree's crown is a cloud of leaf sprays — crossed cards, alpha-cut — that
// sway on a slow wind, each spray a little out of step with its neighbours.
//
// Per spray: `aKind`, the column of the atlas it shows (textures.js,
// foliageAtlas), and `aCrown`, the clump it belongs to — centre and radius, 0
// for none. A card lit by its own normal is a flat plane catching the light
// its own way, and a crown of them read as a heap of planes, with bright
// streaks wherever one lay edge-on. Turned out from the clump's centre instead,
// the normals light the clump as the billow it is meant to be — bright on its
// moonward shoulder, dark underneath — and both faces of a card agree, so
// there is no front and back to flip between (three's DOUBLE_SIDED flip is
// taken out for that reason). Deeper in the clump is darker too: the rest of
// it stands between a spray there and the sky.
//
// And a spray keeps its leaf when it is far off. Mip levels average alpha, so
// the coverage of an alpha-cut card thins with distance until a crown across
// the garden is a pale ghost of itself; the alpha is scaled back up by how far
// down the chain the sample comes from.
//
// Drawn twice (makeFoliagePrepass): once for depth alone and then lit, only
// where the first pass left the nearest leaf. A crown is cards over cards, and
// lit in one pass every one of them paid for the whole of the lighting —
// the moon and its shadow, the lamps, the sky — wherever it lay behind
// another: 9 ms a frame from the Pavilion, where the same cards drawn unlit
// cost nothing measurable. So both passes must cut a card identically: the
// same atlas column, the same sway, the same alpha.
const foliageVertex = (kinds, sway = false) => (shader) => shader.vertexShader
  .replace('#include <common>', `#include <common>
    attribute float aKind;
    attribute vec4 aCrown;
    ${sway ? 'uniform float uWind;' : ''}`)
  .replace('#include <uv_vertex>', `#include <uv_vertex>
    #if defined(USE_INSTANCING) && defined(USE_MAP)
      vMapUv.x = (vMapUv.x + aKind) / ${kinds.toFixed(1)};
    #endif`)
  .replace('#include <begin_vertex>', `#include <begin_vertex>
    #if defined(USE_INSTANCING) && ${sway ? 1 : 0}
      vec3 anchor = instanceMatrix[3].xyz;
      float sway = sin(uWind * 0.8 + anchor.x * 0.045 + anchor.z * 0.03) * 0.07
        + sin(uWind * 2.1 + anchor.z * 0.21 + anchor.y * 0.1) * 0.025;
      transformed.x += sway * (position.y + 0.5);
      transformed.z += sway * 0.6 * (position.y + 0.5);
    #endif`);
const foliageAlpha = (shader) => shader.fragmentShader
  .replace('#include <map_fragment>', `#include <map_fragment>
    #ifdef USE_MAP
      {
        vec2 texel = vMapUv * vec2(textureSize(map, 0));
        vec2 dx = dFdx(texel), dy = dFdy(texel);
        float mip = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
        diffuseColor.a *= 1.0 + 0.3 * mip;
      }
    #endif`);

// `prepassed`: drawn after makeFoliagePrepass has laid the depth, so it
// writes none of its own — and with no depth to write, a card that fails the
// depth test is thrown away before its lighting is ever run.
export function makeFoliageMaterial(map, wind, kinds = 1, { prepassed = false } = {}) {
  const material = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.86, depthWrite: !prepassed });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = foliageVertex(kinds, true)(shader)
      .replace('#include <common>', `#include <common>
        varying float vDeep;
        varying float vCrowned;`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        vDeep = 1.0;
        vCrowned = 0.0;
        #ifdef USE_INSTANCING
          if (aCrown.w > 0.0) {
            vCrowned = 1.0;
            vec3 cardW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
            vec3 outward = cardW - aCrown.xyz;
            float reach = length(outward);
            outward = reach > 1e-3 ? outward / reach : vec3(0.0, 1.0, 0.0);
            vec3 flatN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
            flatN *= sign(dot(flatN, outward) + 1e-4);
            transformedNormal = normalize(mat3(viewMatrix) * normalize(mix(flatN, outward, 0.78)));
            vDeep = clamp(reach / aCrown.w, 0.0, 1.0);
          }
        #endif`);
    shader.fragmentShader = foliageAlpha(shader)
      .replace('#include <common>', `#include <common>
        varying float vDeep;
        varying float vCrowned;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(0.42, 1.0, smoothstep(0.1, 0.95, vDeep));`)
      .replace('#include <normal_fragment_begin>', `
        float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
        vec3 normal = normalize(vNormal);
        // (a spray in no clump — the leaf over the pergola, lit from under
        // by its lanterns — keeps its card's two faces, as three draws them)
        if (vCrowned < 0.5) normal *= faceDirection;
        vec3 nonPerturbedNormal = normal;
        // The far side of a clump, seen through it or from under it, is its
        // inside: the side of it turned away from the eye is lit only for
        // someone standing over there.
        diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(-0.5, 0.35, dot(normal, normalize(vViewPosition))));`)
      // No sheen. A normal turned out from a clump is, over half of it,
      // turned away from the eye, where three's Fresnel is at its grazing
      // peak — and it mirrored the moonlit sky: pines from below were
      // snow-covered, and a willow's crown shone like palm fronds.
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectSpecular *= 0.0;
        reflectedLight.directSpecular *= 0.2;`);
  };
  material.customProgramCacheKey = () => `babel-foliage-${kinds}-${prepassed ? 'p' : 's'}`;
  return material;
}

// The depth of the nearest leaf, and nothing else. Pushed back a hair
// (polygonOffset), so the lit pass that follows passes the depth test on the
// very card that laid it and on no card behind.
export function makeFoliagePrepass(map, wind, kinds = 1) {
  const material = new THREE.MeshBasicMaterial({
    map, alphaTest: 0.42, side: THREE.DoubleSide, colorWrite: false,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = foliageVertex(kinds, true)(shader);
    shader.fragmentShader = foliageAlpha(shader);
  };
  material.customProgramCacheKey = () => `babel-foliage-pre-${kinds}`;
  return material;
}

// The same sprays, as the moon's shadow map sees them: cut by the same column
// of the atlas, so a crown's shadow on the grass has the holes its leaves have.
// (The map and the alpha test are handed over by three at render time.)
export function makeFoliageDepthMaterial(kinds) {
  const material = new THREE.MeshDepthMaterial();
  material.onBeforeCompile = (shader) => { shader.vertexShader = foliageVertex(kinds)(shader); };
  material.customProgramCacheKey = () => `babel-foliage-depth-${kinds}`;
  return material;
}

// Things that hang — wisteria racemes, trailing strands — from the top edge of
// their card, and swing from it: nothing at the stalk, the most at the tip.
// (The foliage above sways from the foot of its card, which is a spray
// growing up from a branch.) `aKind` picks the column of `map` a card shows
// (see textures.js, `hanging`); a card is PlaneGeometry(1, 1) moved down so its
// top edge is on the anchor.
export function makeHangingMaterial(map, wind, kinds) {
  const material = new THREE.MeshStandardMaterial({
    map, alphaTest: 0.38, side: THREE.DoubleSide, roughness: 0.82,
    // Seen against the moonlit garden from a lamplit room, a strand lit only
    // by what falls on it is a black cut-out; a little of its own colour back.
    emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.16,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uWind;
        attribute float aKind;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_INSTANCING
          vMapUv.x = (vMapUv.x + aKind) / ${kinds.toFixed(1)};
          vEmissiveMapUv.x = (vEmissiveMapUv.x + aKind) / ${kinds.toFixed(1)};
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 anchor = instanceMatrix[3].xyz;
          float hang = clamp(-position.y, 0.0, 1.0);
          float sway = sin(uWind * 0.9 + anchor.x * 0.07 + anchor.z * 0.05) * 0.22
            + sin(uWind * 2.3 + anchor.z * 0.19 + anchor.y * 0.13) * 0.07;
          transformed.x += sway * hang * hang;
          transformed.z += sway * 0.8 * hang * hang;
        #endif`);
  };
  material.customProgramCacheKey = () => 'babel-hanging';
  return material;
}

// Three upright cards at 60° and one lying flat: full from any side, and from
// above as well. (`flat` false: the upright three alone — a sprig on the face
// of a hedge, whose flat card would lie on the leaf and half sink into it.)
export function crossedCards({ flat = true } = {}) {
  const parts = [0, 60, 120].map((d) => new THREE.PlaneGeometry(1, 1).rotateY((d * Math.PI) / 180));
  if (flat) parts.push(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

// ── The shafts ────────────────────────────────────────────────────────────────
// A column of lit air is something you see from OUTSIDE it: from inside, every
// way you look runs out through its wall, and the wall is facing you square —
// its brightest angle — so the whole frame goes behind one pale veil. Standing
// on the Echo's crossing, inside the moon's shaft, that veil was 62% of what
// made the room milky. So each column carries its own axis (`shaftVolume`) and
// gives way while the eye is in it.

// World-space axis of a column, bottom and top, each with its radius there:
// every vertex carries it, so columns batched into one mesh still know which
// one they belong to. `null` for a column that must not give way (one the
// reader falls down on purpose).
export function shaftVolume(geo, bottom = null, rBottom = 0, top = null, rTop = 0) {
  if (OLD_GLARE) bottom = null;
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 4), b = new Float32Array(n * 4);
  if (bottom) {
    for (let i = 0; i < n; i++) {
      a.set([bottom[0], bottom[1], bottom[2], rBottom], i * 4);
      b.set([top[0], top[1], top[2], rTop], i * 4);
    }
  }
  geo.setAttribute('aShaftA', new THREE.BufferAttribute(a, 4));
  geo.setAttribute('aShaftB', new THREE.BufferAttribute(b, 4));
  return geo;
}

export function makeShaftMaterial(color = '#ffc88a', strength = 0.17) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aShaftA;
      attribute vec4 aShaftB;
      varying vec3 vN;
      varying vec3 vView;
      varying float vT;
      varying float vOpen;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        vN = normalMatrix * normal;
        vT = 1.0 - uv.y;
        // How far out of this column the eye stands, in its own radii at that
        // height: gone inside it, whole again half a radius out.
        vOpen = 1.0;
        if (aShaftA.w > 0.0) {
          vec3 ab = aShaftB.xyz - aShaftA.xyz;
          float t = clamp(dot(cameraPosition - aShaftA.xyz, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
          float r = mix(aShaftA.w, aShaftB.w, t);
          float d = length(cameraPosition - (aShaftA.xyz + ab * t));
          vOpen = smoothstep(r * 0.9, r * 1.5, d);
        }
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec3 vN;
      varying vec3 vView;
      varying float vT;
      varying float vOpen;
      void main() {
        float nLen = dot(vN, vN), vLen = dot(vView, vView);
        float facing = (nLen > 1e-12 && vLen > 1e-12)
          ? abs(dot(vN * inversesqrt(nLen), vView * inversesqrt(vLen))) : 0.0;
        float body = pow(facing, 2.4);
        float along = smoothstep(0.0, 0.1, vT) * (1.0 - 0.75 * smoothstep(0.5, 1.0, vT));
        float near = smoothstep(8.0, 50.0, length(vView));
        gl_FragColor = vec4(uColor, uStrength * body * along * near * vOpen);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// ── The motes ─────────────────────────────────────────────────────────────────

const sparkVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uDrift;
  uniform float uRise;
  uniform float uPulse;
  uniform float uRate;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aSize;
  varying vec3 vColor;
  void main() {
    float t = uTime * uRate;
    vec3 p = position + vec3(sin(t * 0.6 + aPhase), sin(t * 0.9 + aPhase * 1.3) * uRise, cos(t * 0.5 + aPhase)) * uDrift;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // A firefly's own light, coming up and going down — slowly. At 1.7 rad/s
    // with a full swing they strobed; the mix with 1.0 (uPulse) is how much of
    // the mote's brightness is allowed to swing at all.
    float pulse = mix(1.0, 0.45 + 0.55 * max(0.0, sin(uTime * 0.95 + aPhase * 3.0)), uPulse);
    vColor = aColor * pulse;
    gl_PointSize = clamp(aSize * uScale / max(1.0, -mv.z), 1.0, 64.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const sparkFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float soft = 1.0 - smoothstep(0.0, 1.0, r);
    float core = 1.0 - smoothstep(0.0, 0.3, r);
    gl_FragColor = vec4(vColor * (soft * soft * 0.55 + core * 1.3), 1.0);
  }
`;

export function makeSparkles(items, { drift = 6, rise = 0.5, pulse = 0, rate = 1, sizeOf = (it) => it.s[0] * 2 } = {}) {
  const n = items.length;
  const position = new Float32Array(n * 3), color = new Float32Array(n * 3), phase = new Float32Array(n), size = new Float32Array(n);
  const c = new THREE.Color();
  items.forEach((it, i) => {
    position.set(it.p, i * 3);
    c.set(it.color ?? '#ffffff').multiplyScalar(it.k ?? 1);
    color.set([c.r, c.g, c.b], i * 3);
    phase[i] = it.phase ?? i * 1.618;
    size[i] = sizeOf(it);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += drift * 2;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uScale: { value: 500 }, uDrift: { value: drift },
      uRise: { value: rise }, uPulse: { value: pulse }, uRate: { value: rate },
    },
    vertexShader: sparkVertex,
    fragmentShader: sparkFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 6;
  return points;
}

// ── The environment ───────────────────────────────────────────────────────────

export function makeEnvironment(renderer) {
  const scene = new THREE.Scene();
  const dome = new THREE.SphereGeometry(50, 48, 24);
  const vault = new THREE.Color(0.012, 0.016, 0.028);
  const band = new THREE.Color(0.3, 0.2, 0.12);
  const floor = new THREE.Color(0.07, 0.055, 0.04);
  const tone = [];
  const c = new THREE.Color();
  const p = dome.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50;
    if (y > 0.4) c.copy(vault);
    else if (y > -0.08) c.lerpColors(band, vault, (y + 0.08) / 0.48);
    else c.lerpColors(band, floor, Math.min(1, (-0.08 - y) * 4));
    tone.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(tone, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 4.6, 2.4) });
  const bulb = new THREE.SphereGeometry(2.2, 12, 8);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const m = new THREE.Mesh(bulb, hot);
    m.position.set(Math.cos(a) * 28, 10 + (k % 3) * 7, Math.sin(a) * 28);
    scene.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  dome.dispose();
  bulb.dispose();
  hot.dispose();
  return target;
}
