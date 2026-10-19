// The Door's details: the stand, the fallen blocks and their dust, the cracks,
// the portal's reveals, the garden's light on the pavement, the lamps, the
// candles and the fallen books.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from './textures';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// The stand: how far back along the lane from where it was (38 behind the
// room's middle), and the height it looks at over the same point beyond the
// gate (it was 45). The finial's tip is at 123, which from the old stand was
// eight degrees over the frame's top edge.
export const STAND = { back: qn('wdback', 21), lookY: qn('wdlooky', 61) };

// The garden's light in the room. `pools`: [how far into the room from the
// gate, how wide, how strong] — the first in the passage, the last a slab
// beyond the jambs (which stand 25 in). `lamp`: the green lamp outside the
// arch, its power (it was 3800) and how far out it hangs (it was 14).
// `warm`: what the room's own two lamps lay on the floor (they were 0.12, 0.2).
export const SPILL = {
  pools: [[4, 34, qn('wdgreen', 0.2)], [20, 36, qn('wdgreen', 0.2) * 0.8], [36, 34, qn('wdgreen', 0.2) * 0.42]],
  lamp: { power: qn('wdmoon', 1500), out: 26 },
  warm: { near: qn('wdwarm', 0.2), side: 0.24 },
};

// The garden beyond the arch, from the room. Among the walls the moon is a
// third of what it is out under it (World.jsx), the Library's mass shades the
// ground by the wall, and the pergola's lamp is too far off to be among the
// lights the stand holds: through the doorway, one lantern floated in black.
// So the moon on the gravel where the ways part, past the pergola's end,
// laid on as light: `pools` [x, z, across, along, strength] in the world, on
// the gravel's top + `lift`; gone as the reader comes out into the garden,
// where the moon is the moon again (gardenPlan.js gardenness).
export const MOON_BEYOND = {
  pools: [[1186, 236, 64, 80, qn('wdmoonk', 0.6)], [1183, 150, 40, 96, qn('wdmoonk', 0.6) * 0.7]],
  color: '#9fb2cc', lift: 0.35,
};

// The lamp to the left of the portal: its globe (it was 9), how hard it
// burns to the eye (1.05), and its halo (0.6). Its light is not touched.
export const SIDE_LAMP = { r: qn('wdlampr', 7), strength: qn('wdlampk', 0.55), haze: qn('wdlamph', 0.4) };

// The ladder on the wall to the right: where along its rail (it was 16).
export const LADDER_U = qn('wdladder', -8);

// The candles. `burn`: how much of each is left, the middle one and the
// four on the arms, for each candelabrum (they were all as they came out of
// the box). `halo`: the glow round each flame, across and how strong.
// `breath`: how much the light they throw on the piers rises and falls.
export const CANDLES = {
  burn: [[0.86, 0.6, 1, 0.74, 0.9], [0.7, 0.95, 0.66, 1, 0.8]],
  halo: { size: qn('wdchalo', 5.2), opacity: qn('wdchaloo', 0.62) },
  breath: 0.06,
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tinted = (g, color, at = null) => {
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(color);
    if (at) at(c, p.getX(i), p.getY(i), p.getZ(i));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
};
// A candle that has been burning: `h` tall and `r` round at its foot (which
// stands at y = 0), its crown melted — a lip round a well the wick stands in,
// higher on one side, and let down where the wax has run over it — and the
// runs themselves down its sides, each ending in a bead, the longest in a
// pool on the pan. Its wax in its vertices' colour: lit warm toward the flame,
// duller toward the pan. `seed`: which candle. `wick`: where the wick stands.
export function candleWax(h, r, seed) {
  const rng = makeRng(seed), R = (a, b) => a + (b - a) * rng();
  const WELL = 0.17, parts = [];
  const prof = [[r * 1.05, 0], [r * 1.04, h * 0.35], [r * 1.01, h - 0.5], [r, h - 0.16], [r * 0.97, h - 0.02], [r * 0.86, h + 0.03], [r * 0.7, h - 0.03], [r * 0.42, h - WELL * 0.78], [0.07, h - WELL], [0, h - WELL]];
  const body = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 18);
  // where it has run: [angle, how far down, how thick]
  const runs = Array.from({ length: 2 + Math.floor(rng() * 3) }, (_, k) => [R(0, Math.PI * 2), k === 0 ? h + 0.3 : R(0.25, 0.9) * h, R(0.085, 0.14)]);
  const lowSide = R(0, Math.PI * 2), slant = R(0.05, 0.13);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rad = Math.hypot(x, z);
    const w = smooth(h - 0.55, h - 0.05, y) * Math.min(1, rad / (r * 0.5));
    if (w <= 0) continue;
    const a = Math.atan2(z, x);
    let dy = -slant * (1 + Math.cos(a - lowSide));
    for (const [ra, , rw] of runs) {
      const da = Math.atan2(Math.sin(a - ra), Math.cos(a - ra));
      dy -= rw * 1.7 * Math.exp(-((da / 0.4) ** 2));
    }
    p.setY(i, y + dy * w);
  }
  body.computeVertexNormals();
  const wax = new THREE.Color('#d3c5a2'), lit = new THREE.Color('#f6dcae'), dull = new THREE.Color('#a79a7c'), fresh = new THREE.Color('#e2d6b6');
  const shade = (c, x, y) => {
    c.lerp(dull, 0.75 * (1 - smooth(0, h * 0.7, y)));
    c.lerp(lit, 0.85 * smooth(h - 1.1, h, y)).multiplyScalar(1 + 0.25 * smooth(h - 0.7, h, y));
  };
  parts.push(tinted(body, wax, shade));
  for (const [a, len, rw] of runs) {
    // a run: thin where it left the lip, fuller down it, a bead at its end
    const y1 = h - 0.1 - slant, y0 = Math.max(0.06, h - len), L = y1 - y0;
    const run = new THREE.LatheGeometry([[0, 0], [rw * 0.55, -0.12 * L], [rw * 0.8, -0.55 * L], [rw, -L + rw * 2.6], [rw * 1.5, -L + rw * 1.3], [rw * 1.25, -L + rw * 0.35], [0, -L]].map(([x, y]) => new THREE.Vector2(x, y)), 7);
    run.scale(1.25, 1, 0.75).rotateY(-a).translate(Math.cos(a) * (r * 1.03 - rw * 0.2), y1, Math.sin(a) * (r * 1.03 - rw * 0.2));
    parts.push(tinted(run, fresh, shade));
    if (h - len <= 0.06) {
      // (it reached the pan, and set there)
      const pool = new THREE.SphereGeometry(1, 9, 6).scale(R(0.26, 0.36), 0.09, R(0.2, 0.28)).rotateY(-a).translate(Math.cos(a) * (r + 0.2), 0.03, Math.sin(a) * (r + 0.2));
      parts.push(tinted(pool, fresh, shade));
    }
  }
  const g = mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q)));
  parts.forEach((q) => q.dispose());
  return { geo: g, wick: h - WELL - slant * 0.5 };
}

// A folio fallen open on its back, splayed, its boards on the floor and
// its leaves standing up out of the gutter, lifting: in its own frame, the
// gutter along z, the floor at y = 0. Comes back as [geometry, 'leather' or
// 'pageOld'] pieces.
export function splayedBook(seed = 11) {
  const rng = makeRng(seed), R = (a, b) => a + (b - a) * rng();
  const LEN = 4.4, WB = 3.1, WP = WB - 0.22, LP = LEN - 0.34, out = [];
  // each side: which way, how far its board is lifted, how thick its leaves lie
  for (const [side, lift, thick] of [[-1, 0.2, 0.34], [1, 0.09, 0.66]]) {
    out.push([new THREE.BoxGeometry(WB, 0.13, LEN).translate(side * WB / 2, 0.065, 0).rotateZ(side * lift), 'leather']);
    // the leaves lying on it: low in the gutter, a swell beside it, falling to the fore-edge
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(WP, 0);
    sh.lineTo(WP + 0.03, thick * 0.78);
    for (let k = 9; k >= 0; k--) {
      const u = k / 10;
      sh.lineTo(u * WP, thick * (0.3 + 0.7 * smooth(0, 0.3, u)) * (1 - 0.2 * smooth(0.4, 1, u)));
    }
    const block = new THREE.ExtrudeGeometry(sh, { depth: LP, bevelEnabled: false, curveSegments: 1 }).translate(0, 0.13, -LP / 2);
    if (side < 0) block.rotateY(Math.PI);
    out.push([block.rotateZ(side * lift), 'pageOld']);
  }
  out.push([new THREE.BoxGeometry(0.5, 0.14, LEN).translate(0, 0.05, 0), 'leather']);
  // the leaves lifting: each a sheet bent from the gutter, standing at `a`
  // from the floor and curling over by `curl`
  for (const [a, curl, len] of [[0.5, -0.5, 1], [0.95, -0.75, 0.97], [1.35, -0.55, 1], [1.72, 0.5, 0.98], [2.15, 0.8, 1], [2.55, 0.45, 0.96]]) {
    const W = WP * len, twist = R(-0.12, 0.12), bow = R(0.4, 1.3);
    const leaf = new THREE.BoxGeometry(W, 0.028, LP * R(0.985, 1), 12, 1, 1);
    const p = leaf.attributes.position;
    // (the curve it follows, walked out from the gutter)
    const cx = [0], cy = [0.34], th = [];
    for (let k = 0; k <= 12; k++) {
      th.push(a + curl * (k / 12) ** bow + R(-0.02, 0.02));
      if (k < 12) { cx.push(cx[k] + Math.cos(th[k]) * W / 12); cy.push(cy[k] + Math.sin(th[k]) * W / 12); }
    }
    for (let i = 0; i < p.count; i++) {
      const s = p.getX(i) / W + 0.5, k = Math.min(12, Math.round(s * 12)), y = p.getY(i), z = p.getZ(i);
      const t = th[k] + twist * (z / LP) * s;
      p.setXYZ(i, cx[k] - Math.sin(t) * y, Math.max(0.2, cy[k] + Math.cos(t) * y), z);
    }
    leaf.computeVertexNormals();
    out.push([leaf, 'pageOld']);
  }
  return out;
}
// And one fallen open on its face: its boards a tent, its leaves hanging in
// it, its spine uppermost — the ridge along z, the floor at y = 0. `spine`:
// where the lettered spine lies along the ridge ([its middle's height, its
// width, its length]), for the books' own material to draw.
export function tentBook() {
  const LEN = 4.6, WB = 3.2, FALL = 0.66, out = [];   // FALL: each board's lean from upright
  const HR = WB * Math.cos(FALL);
  for (const side of [-1, 1]) {
    const lay = (g) => g.rotateZ(-side * (Math.PI / 2 - FALL)).translate(0, HR, 0);
    out.push([lay(new THREE.BoxGeometry(WB, 0.13, LEN).translate(side * WB / 2, 0, 0)), 'leather']);
    out.push([lay(new THREE.BoxGeometry(WB - 0.25, 0.3, LEN - 0.3).translate(side * (WB / 2 + 0.02), -0.215, 0)), 'pageOld']);
  }
  return { parts: out, spine: [HR + 0.03, 0.8, LEN] };
}

// What fell, [along, into, w, h, d, how it lies] in the breach's frame
// (build/common.js's DOOR_FALLEN, which this replaces). Two heaps, one under each
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

// The green moon's shaft through the breach: a quarter of what it was. Its
// strongest part is its top, out in the opening, and from the stand the
// reader looks along it — it hung there as a pale sheet over everything
// beyond the jamb.
export const SHAFT_K = qn('wdshaft', 0.25);
// The pergola's lanterns' halos: from the Door the reader looks straight down
// the pergola, and its three lanterns' halos (forty across, drawn over
// everything) lay one on another, a pale wall behind the first lantern.
export const LANTERN_HALO = { size: qn('wdhalos', 22), opacity: qn('wdhaloo', 0.24) };

// The cracks: wide where they start and thinning all the way out (they
// were the same width till their last third), wider where the floor was hit
// harder, branching and flaking more, and now and then a piece of a slab sunk
// and tipped enough for the lamp to find its edge.
export const CRACKS = { taper: true };

// The lamp to the left of the portal: down from 82, level with the head
// of the hood, to where the frame keeps all of its globe.
export const LAMP_Y = qn('wdlampy', 72);

// The portal's reveals and undersides, darkened in its stone's own shader
// (rooms/door.js gives the portal a carve and a dressed material of its own,
// through this): in the arch's frame — x across the opening, y up, z toward
// the room, as portal.js builds it — every face turned in toward the opening
// (a reveal; round the arch, toward the arc's centre) or turned down (a
// soffit, the underside of a capital or a hood) loses light by how far it is
// turned and how deep in the wall it stands; and the whole funnel darkens
// toward the door line, gently, so the orders step back into the dark.
// `frame`: { origin: [x, z], x: [x, z], z: [x, z] } of the arch in the world.
// `P`: portal.js's PORTAL.
export const REVEAL = { turn: qn('wdrev', 0.5), deep: qn('wddeep', 0.28), under: qn('wdunder', 0.45) };
// The piers' blind lancets (portal.js LANCET), cut back into the face: how
// much light their sunk fields keep, and their reveals where they meet the
// field (going from the face's own tone at their front edge).
export const SUNK = { field: qn('wdsunk', 0.62), reveal: qn('wdsunkr', 0.48) };
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
          // (the Door's portal: doorProps.js)
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
          // the piers' blind lancets: a field sunk behind the face, and the
          // reveals down to it, in shadow (no lamp here casts one)
          {
            float ax = abs(abs(p.x) - ${f(P.X + P.PIER / 2)});
            ${P.LANCET.rects.map(([w, y0, y1], i) => {
              const z = P.LANCET.face[i], hw = w - P.LANCET.frame, top = y1 + 2 * hw * 0.866;
              return `if (ax < ${f(hw + 0.05)} && p.y > ${f(y0 + P.LANCET.frame - 0.05)} && p.y < ${f(top + 0.05)} && p.z < ${f(z - 0.04)} && p.z > ${f(z - P.LANCET.sink - 0.1)})
              revealK *= abs(n.z) > 0.5 ? ${f(SUNK.field)} : mix(1.0, ${f(SUNK.reveal)}, smoothstep(${f(z)}, ${f(z - P.LANCET.sink)}, p.z));`;
            }).join('\n            ')}
          }
          diffuseColor.rgb *= revealK;
        }`);
  };
  const keyBefore = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${keyBefore ? keyBefore() : ''}|reveal-${key}`;
  return mat;
};
