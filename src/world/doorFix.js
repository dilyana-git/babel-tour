// The Door's arrival frame, reviewed 2026-10-09 (the numbered points on the
// review board): 2 the fallen blocks were clean bevelled boxes of a size,
// spread evenly over the floor like props — they lie in two heaps now under
// the breach they came out of, most of them broken to wedges, bedded into
// the floor where they struck it, with big spalls round them and more dust;
// 4 the garden in the arch was a milky grey haze, its wisteria and lantern
// drained — that was the "green moon" shaft, a pale sheet seen face on across
// the whole opening, and the pergola's three lantern halos stacked on one
// another down its axis; 3 the portal's jambs, reveals and soffits were one
// warm grey — the reveals and undersides of each order go dark now, the
// deeper the darker, so the arch is a funnel; 5 the cracks were lines of an
// even width — they start wide, taper all the way out, branch and chip more,
// and here and there a slab has sunk and tipped; 8 the lamp left of the
// portal hung where the frame's top edge cut its globe in half — it hangs
// lower. (7, the copy, is catalogue.js: it said a green moon, which nothing
// shows; it says what the arch shows.)
//
// ?wdoorfix=old puts all of them back as they were; ?wdoorfix=old:2,4 only those.
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wdoorfix');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const doorOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// 2. What fell, [along, into, w, h, d, how it lies] in the breach's frame
// (buildWorld's DOOR_FALLEN, which this replaces). Two heaps, one under each
// side of the breach, against the feet of the piers (which stand twenty-five
// into the room): a long block broken across its length and a wedge beside
// it on the left; on the right, a block come down on a stone that fell before
// it (the fourth, as it always was), a wedge and a smaller one. Sizes from a
// full block to a third of one. `wedge`: how much of its height the block
// keeps on its low side, the rest sheared off on a slope up to the arris on
// the other (and `twist`, how that slope winds along it). `tilt`: how far it
// is tipped, about its length and its width; `bury`: how far its high edge
// is in the floor, all the rest of it being further in.
export const FALLEN = [
  [-24, 31, 12.5, 5.4, 7, { tilt: [0.1, 0.035], bury: 0.25 }],
  [-35, 30, 7, 4.8, 6.2, { wedge: 0.38, twist: 0.6, tilt: [-0.07, 0.05], bury: 0.3 }],
  [-17, 42, 5.2, 3.6, 4.6, { wedge: 0.55, twist: -0.8, tilt: [0.09, -0.06], bury: 0.2 }],
  [26, 32, 9, 5, 7, {}],
  [35, 40, 6.6, 4.4, 5.6, { wedge: 0.3, twist: -0.5, tilt: [0.06, -0.08], bury: 0.35 }],
  [19, 44, 4.6, 3.2, 4.2, { wedge: 0.6, twist: 0.9, tilt: [-0.1, 0.04], bury: 0.2 }],
];
// and the dust their fall threw up, pale round each (the crack painter's
// `veil`: as strong, and out as far, in units)
export const DUST = [qn('wddust', 0.3), 3.4];

// 4. The green moon's shaft through the breach: a quarter of what it was. Its
// strongest part is its top, out in the opening, and from the stand the
// reader looks along it — it hung there as a pale sheet over everything
// beyond the jamb.
export const SHAFT_K = qn('wdshaft', 0.25);
// The pergola's lanterns' halos: from the Door the reader looks straight down
// the pergola, and its three lanterns' halos (forty across, drawn over
// everything) lay one on another, a pale wall behind the first lantern.
export const LANTERN_HALO = { size: qn('wdhalos', 22), opacity: qn('wdhaloo', 0.24) };

// 5. The cracks: wide where they start and thinning all the way out (they
// were the same width till their last third), wider where the floor was hit
// harder, branching and flaking more, and now and then a piece of a slab sunk
// and tipped enough for the lamp to find its edge.
export const CRACKS = { taper: !doorOld(5) };

// 8. The lamp to the left of the portal: down from 82, level with the head
// of the hood, to where the frame keeps all of its globe.
export const LAMP_Y = qn('wdlampy', 72);

// 3. The portal's reveals and undersides, darkened in its stone's own shader
// (buildWorld gives the portal a carve and a dressed material of its own,
// through this): in the arch's frame — x across the opening, y up, z toward
// the room, as portal.js builds it — every face turned in toward the opening
// (a reveal; round the arch, toward the arc's centre) or turned down (a
// soffit, the underside of a capital or a hood) loses light by how far it is
// turned and how deep in the wall it stands; and the whole funnel darkens
// toward the door line, gently, so the orders step back into the dark.
// `frame`: { origin: [x, z], x: [x, z], z: [x, z] } of the arch in the world.
// `P`: portal.js's PORTAL.
export const REVEAL = { turn: qn('wdrev', 0.5), deep: qn('wddeep', 0.28), under: qn('wdunder', 0.45) };
const f = (x) => (Number.isInteger(x) ? `${x}.0` : `${x}`);
export const revealShade = (mat, frame, P, key) => {
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    before?.call(mat, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vRevealW;
        varying vec3 vRevealN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRevealW = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vRevealN = mat3(modelMatrix) * objectNormal;`);
    const [ox, oz] = frame.origin, [xx, xz] = frame.x, [zx, zz] = frame.z;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vRevealW;
        varying vec3 vRevealN;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // (the Door's portal: doorFix.js, 3)
          vec2 rd = vRevealW.xz - vec2(${f(ox)}, ${f(oz)});
          vec3 p = vec3(dot(rd, vec2(${f(xx)}, ${f(xz)})), vRevealW.y, dot(rd, vec2(${f(zx)}, ${f(zz)})));
          vec3 wn = normalize(vRevealN);
          vec3 n = vec3(dot(wn.xz, vec2(${f(xx)}, ${f(xz)})), wn.y, dot(wn.xz, vec2(${f(zx)}, ${f(zz)})));
          float sx = p.x < 0.0 ? -1.0 : 1.0;
          // out from the opening into the stone (a), and the way back in to it
          vec2 c = vec2(-sx * ${f(P.CEN)}, ${f(P.SPR)});
          vec2 fromC = vec2(p.x, p.y) - c;
          float arched = step(${f(P.SPR)}, p.y);
          float a = mix(abs(p.x) - ${f(P.HW)}, length(fromC) - ${f(P.R0)}, arched);
          vec2 inward = mix(vec2(-sx, 0.0), -normalize(fromC), arched);
          float within = (1.0 - smoothstep(${f(P.JAMB + 1.5)}, ${f(P.JAMB + 5)}, a)) * step(-2.0, a)
            * (1.0 - smoothstep(${f(P.ZF + 1)}, ${f(P.ZF + 4)}, p.z)) * step(${f(-P.WALL - 1)}, p.z);
          float deep = smoothstep(${f(P.ZS)}, ${f(P.Z0 - 6)}, p.z);
          float turned = smoothstep(0.3, 0.85, dot(n.xy, inward));
          float under = smoothstep(0.2, 0.75, -n.y);
          float revealK = 1.0 - within * (${f(REVEAL.deep)} * deep + max(${f(REVEAL.turn)} * turned, ${f(REVEAL.under)} * under) * (0.55 + 0.45 * deep));
          diffuseColor.rgb *= revealK;
        }`);
  };
  const keyBefore = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${keyBefore ? keyBefore() : ''}|reveal-${key}`;
  return mat;
};
