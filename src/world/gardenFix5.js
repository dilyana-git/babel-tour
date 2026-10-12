// The garden's props, reviewed 2026-10-11 (board 5 of the third audit; the
// numbers are the board's own). The Fork and the Pavilion are the two best
// arrivals in the piece (1, kept), and what was left was a handful of things
// that had not caught up with their neighbours:
// 3 the signpost stood at the centre of the Fork's composition and was the
//   least made thing in it, a square black stick with two boards: it is the
//   pergola's timber now, turned — a foot, a shaft that swells and tapers, a
//   collar under each board, an onion cap — its boards weathered grey, housed
//   through the post, their names cut into them and gilt in the cut; and it
//   takes the light of the lantern on its own arm (`signLit`).
// 4 the wisteria's trunk was a grey ribbon, smooth, of one width from the
//   plinth to the beam: three stems now, unequal, sinewed, roped on each
//   other, turning on each other faster as they climb; thick at the foot and
//   a third of that at the head; grey-brown, not grey.
// 5 the grass round the lanterns was single pale blades scattered on dark
//   ground, needles: the blades stand in clumps (thick here, bare there),
//   each broader and bent over, their tips a mid green and not a pale one;
//   and under them a mown sward the lantern's light falls on (`swardLit`).
// 6 the curled ends of the Pavilion's hips were the roll tiles' pale grey
//   against dark tile and the night, horns: dark bronze, and the gold finial
//   is the roof's one bright note.
// 7 "over black water a single pavilion burns warm", and the water round it
//   gave nothing back. From the bridge every lantern's mirror image falls
//   below the frame (the eye is too high over the water for anything taller
//   than a rail to show in it), so what the frame can have is what a painter
//   gives it: the lit Pavilion lying on the water round its own foot, on
//   every facet of the chop that leans toward it — the lacquer's red, the
//   lanterns' orange — and thinning with distance (water.js, `glow`). The
//   lamps are also reflected a second time off a steeper chop (`shatter`),
//   which from this stand gives a few glints by the bridge and no more.
//   From the Fork the same glow lies under the Pavilion as its reflection.
// 8 the armillary's plinth stood in its own lamp's shadow — the light is
//   over its head — and so took only the sky: smooth blue-grey, with gold
//   bands. It takes the paving's light back off the floor now, is the
//   paving's stone with the lanterns' weather on it (grain, damp at the
//   foot, streaks under every moulding, lichen, moss), and its two gilt
//   bands are dulled; and the rings have a section: a bead at each edge of
//   each face, the scale cut between them.
// 10 the Web of Time's stand had a blank leaf wall on either hand: a niche is
//   clipped into each, with a small iron lantern hung in it on a crook, lit —
//   the pair of them a gate before the court — and in the wider one a stone
//   seat beside its lantern.
// 11 the trees across the garden had hard, stepped outlines: beyond `FEATHER`
//   units a spray's cut edge is a ramp a couple of pixels across (effects.js,
//   `feather`). The trees' crowns only: a willow's hanging strands are drawn
//   in one pass, writing their own depth, and are left as they were.
//
// ?wgarden5=old puts all of them back as they were; ?wgarden5=old:3,8 only those.
import * as THREE from 'three';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wgarden5');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const garden5Old = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// ── 3. The signpost ───────────────────────────────────────────────────────────
// `post`, `board`: the tints of the timber (the pergola's; and the same gone
// grey in the weather). `lamp`: how much of its lantern's light it takes,
// `fall` how fast that goes with distance, `wrap` how far round the post it
// reaches. `thick`: a board's thickness; `tail`: how far it stands out behind
// the post it is housed through.
export const SIGN = {
  post: '#a08263', board: '#978a78',
  lamp: qn('wsignk', 3.4), fall: 0.02, wrap: 0.45,
  thick: 0.72, tail: 1.5, len: 9.4,
  top: 28.2,
};
// The post, turned: [r, y] from the footing up to the tip of its cap. Heights
// are the world's (the lawn is at 4); the boards hang at `boards`, and the
// post is left plain where each is housed, with a turned collar under it.
export function signPostGeometry(boards, segments = 20) {
  const P = [];
  const corner = (r, y) => P.push([r, y], [r, y]);
  const run = (pts) => pts.forEach((p) => P.push(p));
  const bead = (r, y, b, n = 5) => {
    for (let k = 0; k <= n; k++) { const a = -Math.PI / 2 + (Math.PI * k) / n; P.push([r + Math.cos(a) * b, y + Math.sin(a) * b]); }
  };
  const shaft = (y) => 0.9 - 0.2 * ((y - 7.4) / (SIGN.top - 7.4)) + 0.05 * Math.sin(Math.PI * Math.min(1, (y - 7.4) / 9));
  // the foot: a drum, a cove, a bead
  corner(1.14, 4.6);
  run([[1.14, 5.9]]);
  corner(1.06, 6.02);
  run([[0.98, 6.2], [0.9, 6.5], [0.9, 6.72]]);
  bead(0.9, 6.92, 0.2);
  run([[0.9, 7.12], [shaft(7.4), 7.4]]);
  // the shaft, with a collar under each board (lowest first)
  let y = 7.4;
  for (const b of [...boards].sort((a, c) => a - c)) {
    const under = b - 1.75;
    for (let t = y + 0.8; t < under - 0.2; t += 0.8) run([[shaft(t), t]]);
    run([[shaft(under), under]]);
    bead(shaft(under), under + 0.17, 0.17, 4);
    run([[shaft(under + 0.34), under + 0.34]]);
    y = under + 0.34;
  }
  for (let t = y + 0.8; t < SIGN.top - 0.5; t += 0.8) run([[shaft(t), t]]);
  // the neck, the cap's board, and the cap: an onion, drawn up to a point
  const T = SIGN.top;
  run([[shaft(T - 0.5), T - 0.5], [0.62, T - 0.28], [0.6, T - 0.1]]);
  corner(1.06, T - 0.1);
  run([[1.12, T + 0.02], [1.12, T + 0.2]]);
  corner(1.02, T + 0.32);
  run([[0.56, T + 0.36], [0.5, T + 0.52], [0.62, T + 0.74], [0.86, T + 1.02], [0.95, T + 1.36], [0.88, T + 1.72],
    [0.68, T + 2.08], [0.44, T + 2.4], [0.24, T + 2.74], [0.1, T + 3.1], [0.001, T + 3.3]]);
  return new THREE.LatheGeometry(P.map(([r, yy]) => new THREE.Vector2(r, yy)), segments);
}
// A board, in its own plane ([along, height] from the post's axis, extruded
// across its thickness and centred on it): a finger pointing the way, its
// tail cut to an ogee behind the post, its arrises worn round.
export function signBoardGeometry(L, y) {
  const h = 1.15, t = -SIGN.tail;
  const s = new THREE.Shape();
  s.moveTo(t + 0.5, y - h);
  s.lineTo(L, y - h);
  s.quadraticCurveTo(L + 0.5, y - h * 0.55, L + 1.5, y);
  s.quadraticCurveTo(L + 0.5, y + h * 0.55, L, y + h);
  s.lineTo(t + 0.45, y + h);
  s.quadraticCurveTo(t - 0.15, y + h * 0.45, t + 0.25, y);
  s.quadraticCurveTo(t + 0.6, y - h * 0.5, t + 0.5, y - h);
  const b = 0.07;
  const g = new THREE.ExtrudeGeometry(s, { depth: SIGN.thick - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
  return g.translate(0, 0, -(SIGN.thick - 2 * b) / 2);
}
// A name, cut into its board and gilt in the cut: the upper wall of each
// stroke in its own shadow, the lower one lit, a dark arris above it and a
// pale one below where the wood's edge takes the light.
export function paintSignName(g, w, h, text) {
  g.clearRect(0, 0, w, h);
  g.font = '600 104px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.letterSpacing = '14px';
  g.fillStyle = 'rgba(244,228,196,0.4)';
  g.fillText(text, w / 2 + 2, h / 2 + 4);
  g.fillStyle = 'rgba(14,8,4,0.92)';
  g.fillText(text, w / 2 - 2, h / 2 - 3);
  const gold = g.createLinearGradient(0, h * 0.22, 0, h * 0.8);
  gold.addColorStop(0, '#5d4520');
  gold.addColorStop(0.45, '#b08a48');
  gold.addColorStop(1, '#f2d795');
  g.fillStyle = gold;
  g.fillText(text, w / 2, h / 2);
}
// The timber's material, lit by the lantern on the post's arm (`lamp`: a
// uniform { value: Vector4(x, y, z, strength) }), and weathered: paler and
// greyer in slow patches, dark where the rain stands (the foot, the tops of
// things) and in streaks down the grain.
export function signLit(mat, lamp, color = '#ffb866') {
  const lampColor = new THREE.Color(color);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSignLamp = lamp;
    sh.uniforms.uSignColor = { value: lampColor };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSignW;
        varying vec3 vSignN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vSignW = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vSignN = mat3(modelMatrix) * objectNormal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec4 uSignLamp;
        uniform vec3 uSignColor;
        varying vec3 vSignW;
        varying vec3 vSignN;
        float signHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float signNoise(vec3 x) {
          vec3 i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(signHash(i), signHash(i + vec3(1, 0, 0)), f.x), mix(signHash(i + vec3(0, 1, 0)), signHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(signHash(i + vec3(0, 0, 1)), signHash(i + vec3(1, 0, 1)), f.x), mix(signHash(i + vec3(0, 1, 1)), signHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 signN = normalize(vSignN);
        float sSlow = signNoise(vSignW * 0.55), sFine = signNoise(vSignW * vec3(9.0, 1.3, 9.0) + 2.7);
        float silver = smoothstep(0.35, 0.75, sSlow * 0.7 + sFine * 0.3);
        float sLum = dot(diffuseColor.rgb, vec3(0.333));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(sLum) * vec3(1.04, 1.02, 0.98), 0.45 * silver) * (0.8 + 0.34 * sSlow);
        float sDamp = 1.0 - smoothstep(5.2 + 1.2 * sSlow, 8.6 + 2.4 * sSlow, vSignW.y);
        float sStreak = smoothstep(0.62, 0.86, signNoise(vec3(vSignW.x * 5.0, vSignW.y * 0.3, vSignW.z * 5.0) + 4.1)) * (1.0 - abs(signN.y));
        diffuseColor.rgb *= mix(1.0, 0.5, sDamp) * (1.0 - 0.3 * sStreak) * (1.0 - 0.22 * smoothstep(0.5, 1.0, signN.y));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 toSign = uSignLamp.xyz - vSignW;
        float signD2 = max(dot(toSign, toSign), 0.01);
        float signNdl = clamp((dot(signN, toSign * inversesqrt(signD2)) + ${SIGN.wrap.toFixed(2)}) / ${(1 + SIGN.wrap).toFixed(2)}, 0.0, 1.0);
        totalEmissiveRadiance += diffuseColor.rgb * uSignColor * uSignLamp.w * signNdl * signNdl / (1.0 + ${SIGN.fall.toFixed(3)} * signD2);`);
  };
  mat.customProgramCacheKey = () => 'babel-sign-timber';
  return mat;
}

// ── 4. The wisteria's trunk (ivy.js, twineWisteria `old`) ─────────────────────
// `foot`, `head`: the rope's radius where it leaves the ground and where it
// goes over the beam; `ease`: how the winding is shared out up the post (1,
// evenly, as it was: from the Fork's stand it then crosses the post's face
// at the height of the eye; more, slow at the foot and close at the head);
// `twist`: how fast
// the stems turn on each other at the foot and at the head, radians a unit;
// `stems`: each one's place in the rope (the angle it starts at, how far off
// the rope's middle as a share of its radius), its own thickness, where up
// the vine it gives out, how many sinews it has and how deep.
export const VINE = {
  foot: qn('wvinefoot', 0.98), head: qn('wvinehead', 0.3), ease: qn('wvineease', 1),
  twist: [0.55, 1.9],
  stems: [
    { a: 0, off: 0.52, r: 0.62, end: 1, ribs: 5, deep: 0.16 },
    { a: 2.25, off: 0.6, r: 0.5, end: 0.9, ribs: 4, deep: 0.18 },
    { a: 4.3, off: 0.66, r: 0.36, end: 0.64, ribs: 3, deep: 0.2 },
  ],
  tints: ['#a39683', '#93876f', '#ada08a'],
};

// ── 5. The grass ──────────────────────────────────────────────────────────────
// `patch`: the size of the clumps' patches, and `bare` the share of the lawn
// that has none; `blades` to a clump, `spread` how far from its middle they
// root; `wide` a blade's half-width at the root; `tip`: its tip's green beside
// its root's (2.3 was the needles'). `sward`: the mown grass under them — its
// texture's tile in units, and how much of the lantern's light it gives back.
export const GRASS = {
  patch: 5.5, bare: qn('wgrassbare', 0.32), blades: [9, 16], spread: [0.04, 0.3], wide: [0.05, 0.085],
  tip: qn('wgrasstip', 1.45), k: qn('wgrassk', 0.62),
  sward: { tile: 9, k: qn('wswardk', 2.4) },
};
// The mown sward's texture: short strokes of blade, close, in the lawn's own
// greens, a few gone to straw; tiles. Drawn from its own stream.
export function paintSward(g, s, rng) {
  const R = (a, b) => a + (b - a) * rng();
  g.fillStyle = '#20301a';
  g.fillRect(0, 0, s, s);
  for (let k = 0; k < 70; k++) {
    const x = R(0, s), y = R(0, s), r = R(s * 0.05, s * 0.16);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rng() < 0.5 ? 'rgba(52,78,36,0.5)' : 'rgba(18,26,14,0.5)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
  }
  g.lineCap = 'round';
  for (let k = 0; k < 9000; k++) {
    const x = R(0, s), y = R(0, s), a = R(-0.6, 0.6) + (rng() < 0.5 ? 0 : Math.PI), L = R(5, 13);
    const straw = rng() < 0.05, t = R(0.6, 1.25);
    g.strokeStyle = straw ? `rgba(${Math.round(120 * t)},${Math.round(108 * t)},${Math.round(58 * t)},0.8)`
      : `rgba(${Math.round(R(44, 64) * t)},${Math.round(R(74, 98) * t)},${Math.round(R(30, 42) * t)},0.85)`;
    g.lineWidth = R(1, 2.1);
    for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + Math.sin(a) * L, y + oy - Math.cos(a) * L);
      g.stroke();
    }
  }
}

// ── 6. The hips' curled ends (pavilionRoof.js: `horns`, their own mesh) ───────
export const HORN = { color: '#4a3b2a', roughness: 0.58, metalness: 0.55, sky: 0.3 };

// ── 7. The pond (water.js, `shatter`) ─────────────────────────────────────────
// A second, steeper chop that only the lamps see: `steep` times the slope the
// wave train has at each point, `tight` the lobe each lamp lays in it, `gain`
// how bright, `reach` how far from a lamp's foot it lies (units). And `glow`:
// the lit Pavilion itself — lanterns, lacquer, the lamp on its table — as a
// light lying on the water round its foot: its colour, `k` how strong, from
// `from` units off its middle and fading over `fade` more, on every facet of
// the chop that leans toward it (`lean`: the slope at which a facet begins to
// take it, and takes all of it).
export const POND = {
  on: !garden5Old(7),
  steep: qn('wpondsteep', 9), tight: qn('wpondtight', 26), gain: qn('wpondgain', 1.1), reach: qn('wpondreach', 95),
  glow: { color: '#ff8a40', k: garden5Old(7) ? 0 : qn('wpondglow', 0.85), from: 30, fade: qn('wpondfade', 24), lean: [0.006, 0.034] },
};

// ── 8. The armillary's plinth, and its rings ──────────────────────────────────
// `floor`: how much of the paving's light comes back up onto the stone, its
// colour, and how high up the stand it reaches; `gilt`: the two bands, dulled.
export const PLINTH = {
  color: '#c2b49c', floor: qn('wplinthk', 0.72), warm: '#ffc27a', top: 30,
  gilt: { color: '#8a6a34', roughness: 0.5, metalness: 0.7 },
};
// The stone's material: weathered as the garden's lanterns are (their granite's
// grain is left out: this is the paving's limestone), and lit from below by
// the paving — most on what faces down and out, less with height.
export function plinthLit(mat) {
  const warm = new THREE.Color(PLINTH.warm);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uPlinthWarm = { value: warm };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPlinthW;
        varying vec3 vPlinthN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPlinthW = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vPlinthN = mat3(modelMatrix) * objectNormal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uPlinthWarm;
        varying vec3 vPlinthW;
        varying vec3 vPlinthN;
        float plinthHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float plinthNoise(vec3 x) {
          vec3 i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(plinthHash(i), plinthHash(i + vec3(1, 0, 0)), f.x), mix(plinthHash(i + vec3(0, 1, 0)), plinthHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(plinthHash(i + vec3(0, 0, 1)), plinthHash(i + vec3(1, 0, 1)), f.x), mix(plinthHash(i + vec3(0, 1, 1)), plinthHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 plN = normalize(vPlinthN);
        float pSlow = plinthNoise(vPlinthW * 0.5), pMid = plinthNoise(vPlinthW * 1.9 + 3.1), pFine = plinthNoise(vPlinthW * 9.0);
        diffuseColor.rgb *= (0.84 + 0.24 * pSlow) * (0.92 + 0.16 * pMid) * (0.92 + 0.16 * pFine);
        // damp at the foot, unevenly, as high as the rain splashes off the paving
        float pDamp = 1.0 - smoothstep(5.5 + 0.7 * pMid, 6.6 + 1.6 * pMid, vPlinthW.y);
        diffuseColor.rgb *= mix(1.0, 0.56, pDamp);
        // soot and wet under every moulding, and run down the face below it
        float pUnder = smoothstep(0.1, 0.7, -plN.y);
        float pStreak = smoothstep(0.52, 0.84, plinthNoise(vec3(vPlinthW.x * 2.8, vPlinthW.y * 0.24, vPlinthW.z * 2.8) + 1.3)) * (1.0 - abs(plN.y));
        diffuseColor.rgb *= (1.0 - 0.4 * pUnder) * (1.0 - 0.3 * pStreak);
        // lichen where it has light, grey-green and ochre; moss on what faces the sky, low down
        float pLichen = smoothstep(0.56, 0.86, plinthNoise(vPlinthW * 1.3 + 9.4) * 0.7 + plinthNoise(vPlinthW * 4.6) * 0.3) * smoothstep(-0.3, 0.3, plN.y) * (1.0 - pDamp);
        vec3 pLichenCol = mix(vec3(0.22, 0.235, 0.17), vec3(0.3, 0.27, 0.15), smoothstep(0.45, 0.7, plinthNoise(vPlinthW * 0.9 + 21.0)));
        diffuseColor.rgb = mix(diffuseColor.rgb, pLichenCol * (0.8 + 0.4 * pFine), pLichen * 0.42);
        float pMoss = smoothstep(0.35, 0.9, plN.y) * smoothstep(0.4, 0.66, plinthNoise(vPlinthW * 0.9) * 0.6 + plinthNoise(vPlinthW * 3.1) * 0.4) * (1.0 - smoothstep(8.5, 12.0, vPlinthW.y));
        pMoss = max(pMoss, pDamp * smoothstep(0.5, 0.78, plinthNoise(vPlinthW * 2.1 + 5.0)) * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.085, 0.03) * (0.75 + 0.6 * pFine), pMoss * 0.8);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float pFloor = (0.62 - 0.38 * plN.y) * (1.0 - smoothstep(5.0, ${PLINTH.top.toFixed(1)}, vPlinthW.y) * 0.75);
        totalEmissiveRadiance += diffuseColor.rgb * uPlinthWarm * ${PLINTH.floor.toFixed(3)} * max(pFloor, 0.0);`);
  };
  mat.customProgramCacheKey = () => 'babel-plinth-stone';
  return mat;
}
// The beads: on each face of a band, at its inner and outer edge — `r` their
// radius, `in` how far in from the edge their middle lies.
export const BEAD = { r: 0.085, in: 0.1 };

// ── 10. The niches at the Web of Time's stand ─────────────────────────────────
// Clipped into the hedge either side of where the reader stops (`ahead`: how
// far toward the court from there): `wide` along the hedge (west, east),
// `deep` into it (it is 8.5 thick). In each a small iron lantern on a crook,
// lit (`lamp`: its light's strength, and how much lower than the signpost's
// it hangs — at the height of the chest); in the wider, a stone seat.
export const NICHE = {
  ahead: qn('wnicheahead', 0), wide: [9, 13.4], deep: 5.2, seat: { w: 7.6, d: 3.3, h: 4.3 },
  lamp: { k: qn('wnichek', 620), dy: -2.3 },
};

// ── 11. The far trees' edge ───────────────────────────────────────────────────
// From `near` to `far` units off, a spray's cut edge goes over to a soft one:
// a ramp `wide` pixels across, centred on where its alpha test cut it.
export const FEATHER = { on: !garden5Old(11), near: qn('wfeathernear', 70), far: qn('wfeatherfar', 180), wide: qn('wfeatherwide', 2.2) };
