// The garden's details: the signpost, the wisteria's trunk, the Pavilion's
// hip ends and water, the armillary's plinth, the Web's niches, the trees'
// outlines, and the ground under the moon (sward, tufts, mist).
import * as THREE from 'three';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
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

// ── 7. The pond (water.js, `column`) ──────────────────────────────────────────
// Each lamp's column: the long smear a lantern lays on black water, running
// from under it toward the eye and no wider than the lantern. A facet sends a
// lamp to the eye when it tilts by the slope that lamp needs there, and the
// slope a facet can have is spread far ALONG the line of sight (a wave that
// faces you swings the reflection up and down the column) and hardly at all
// ACROSS it — which is why the column is long and narrow, and why the water
// between two lamps stays black. `steep`: how far the chop's along-view tilt
// is exaggerated, for the glints; `dash`: their tolerance along and across;
// `smear`: the soft column under them, the slope spread along and across;
// `gain`: glints, smear.
//
// Until 2026-10-16 this was a "shatter" pass with a `glow`: the lit Pavilion
// as one low red light on every facet of the chop that leaned toward it, in a
// ring from 30 units out. Seen from the bridge that was a field of short
// red-orange strokes, evenly spread on both sides — a rash on the water, not
// a reflection of anything.
export const POND = {
  steep: qn('wpondsteep', 7),
  dash: [qn('wponddash', 0.05), qn('wponddashx', 0.012)],
  smear: [qn('wpondsmear', 0.3), qn('wpondsmearx', 0.014)],
  gain: [qn('wpondgain', 16), qn('wpondsoft', 3)],
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
  // (`behind`: the hedge left at the back of it, grown out on the far side to
  // take the shoulders' insets either side — rooms/web.js)
  ahead: qn('wnicheahead', 0), wide: [9, 13.4], deep: 5.2, behind: 6.2, seat: { w: 7.6, d: 3.3, h: 4.3 },
  lamp: { k: qn('wnichek', 620), dy: -2.3 },
};

// ── 11. The far trees' edge ───────────────────────────────────────────────────
// From `near` to `far` units off, a spray's cut edge goes over to a soft one:
// a ramp `wide` pixels across, centred on where its alpha test cut it.
export const FEATHER = { on: true, near: qn('wfeathernear', 70), far: qn('wfeatherfar', 180), wide: qn('wfeatherwide', 2.2) };

// ── 1, 2. The sward ───────────────────────────────────────────────────────────
// `color`: the turf's own (linear), a dark green with the yellow in it that
// living grass has; `deep` where it grows thick and dark (moss, the damp),
// `dry` where it has gone toward straw. `detail`: how much of the painted
// texture's light and dark is kept (its colour is not). `macro`: the sizes of
// the patches, in units (a unit is 9.4 cm), and `k` how far apart in value.
export const SWARD = {
  color: new THREE.Color().setRGB(qn('wswr', 0.054), qn('wswg', 0.06), qn('wswb', 0.009)),
  deep: new THREE.Color().setRGB(0.03, 0.042, 0.007),
  dry: new THREE.Color().setRGB(0.08, 0.068, 0.016),
  detail: qn('wswdetail', 0.8),
  macro: [7, 23, 71],
  k: qn('wswmacro', 0.45),
  gain: qn('wswgain', 0.45),
  // and the lantern's light off the cut grass (its `sward`),
  // which was set for the near-black lawn and over this one glowed mustard
  lampSward: qn('wswlamp', 0.24),
};

// ── 4. The moon on the ground ─────────────────────────────────────────────────
// `light`: what the lawn's diffuse light is multiplied by — the moon and sky's
// cyan taken out of it, a little, and not out of the sky. `fog`: how far the
// lawn's fog goes from the night's teal toward a grey of its own value.
// `mist`: the mist sheets' colour, a moonlit grey for the cyan they were.
export const MOON_GROUND = {
  light: new THREE.Vector3(qn('wmglr', 1.3), 1.0, qn('wmglb', 0.5)),
  fog: qn('wmgfog', 1),
  fogTint: new THREE.Vector3(1.25, 1.12, 0.6),
  mist: '#b6b8b0',
};

// The noise the patches are made from, and the sward's colour from the
// painted texture (`tex`, linear) and its mean (`mean`, the top of its mips)
// at a place on the lawn (`xz`). Shared by the lawn and the pond's bank.
export const SWARD_GLSL = /* glsl */ `
  uniform vec3 uSward;
  uniform vec3 uSwardDeep;
  uniform vec3 uSwardDry;
  uniform vec3 uSwardK;
  float gnHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float gnNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gnHash(i), gnHash(i + vec2(1.0, 0.0)), u.x), mix(gnHash(i + vec2(0.0, 1.0)), gnHash(i + 1.0), u.x), u.y);
  }
  vec3 swardColor(vec3 tex, vec3 mean, vec2 xz) {
    float y = dot(tex, vec3(0.2126, 0.7152, 0.0722)), my = max(dot(mean, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
    float detail = clamp(y / my, 0.35, 2.4);
    // three sizes of patch, the larger the stronger (the eye finds those first)
    float tone = (gnNoise(xz / ${SWARD.macro[0].toFixed(1)}) - 0.5) * 0.5
      + (gnNoise(xz / ${SWARD.macro[1].toFixed(1)} + 17.3) - 0.5) * 0.8
      + (gnNoise(xz / ${SWARD.macro[2].toFixed(1)} + 41.7) - 0.5) * 0.9;
    vec3 c = mix(uSward, uSwardDeep, smoothstep(0.0, -0.5, tone));
    c = mix(c, uSwardDry, smoothstep(0.12, 0.6, tone) * 0.75);
    c *= 1.0 + tone * uSwardK.y;
    return c * mix(1.0, detail, uSwardK.x) * uSwardK.z;
  }
`;
const swardUniforms = () => ({
  uSward: { value: SWARD.color }, uSwardDeep: { value: SWARD.deep }, uSwardDry: { value: SWARD.dry },
  uSwardK: { value: new THREE.Vector3(SWARD.detail, SWARD.k, SWARD.gain) },
});
const moonUniforms = () => ({ uMoonGround: { value: MOON_GROUND.light }, uMoonFog: { value: MOON_GROUND.fog }, uMoonFogTint: { value: MOON_GROUND.fogTint } });
// the lawn's diffuse light, less cyan; `w` how much of the surface is lawn.
// Only as far as the light IS cyan (the moon, the sky): a lantern's, already
// warm, warmed again turned the grass round it mustard.
export const moonGroundLight = (w = '1.0') => `
  {
    vec3 mgAlbedo = max(diffuseColor.rgb, vec3(1e-4));
    vec3 mgD = reflectedLight.directDiffuse / mgAlbedo, mgI = reflectedLight.indirectDiffuse / mgAlbedo;
    float mgCoolD = smoothstep(0.04, 0.25, (mgD.b - mgD.r) / max(mgD.b, 1e-5));
    float mgCoolI = smoothstep(0.04, 0.25, (mgI.b - mgI.r) / max(mgI.b, 1e-5));
    reflectedLight.directDiffuse *= mix(vec3(1.0), uMoonGround, ${w} * mgCoolD);
    reflectedLight.indirectDiffuse *= mix(vec3(1.0), uMoonGround, ${w} * mgCoolI);
  }`;
// the fog toward a grey of its own value; `w` as above
export const moonGroundFog = (w = '1.0') => `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(- fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    vec3 groundFog = mix(fogColor, vec3(dot(fogColor, vec3(0.2126, 0.7152, 0.0722))) * uMoonFogTint, uMoonFog * ${w});
    gl_FragColor.rgb = mix(gl_FragColor.rgb, groundFog, fogFactor);
  #endif`;

// Every material this module patches, for the dials (`__ground`, dev only).
const live = [], mists = [];
export const trackMist = (mat) => { mists.push(mat); return mat; };
const track = (sh) => { live.push(sh.uniforms); };

// Chain a patch after a material's own (keeping its program key apart).
function chain(mat, key, fn) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = function (sh, renderer) {
    prev?.call(this, sh, renderer);
    fn(sh);
  };
  mat.customProgramCacheKey = function () { return `${prevKey.call(this)}-${key}`; };
  return mat;
}

// The lawn (M.grass): its own colour from the painted grass's light and dark
// (1), patches over it (2), and its light and fog less cyan (4).
export function swardLawn(mat) {
  return chain(mat, `ground-${+true}${+true}${+true}`, (sh) => {
    Object.assign(sh.uniforms, swardUniforms(), moonUniforms());
    track(sh);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSwardW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vSwardW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    let f = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform vec3 uMoonGround;
        uniform float uMoonFog;
        uniform vec3 uMoonFogTint;
        varying vec3 vSwardW;
        ${SWARD_GLSL}`);
    
    f = f.replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = swardColor(sampledDiffuseColor.rgb, textureLod(map, vMapUv, 12.0).rgb, vSwardW.xz);`);
    
    f = f.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      ${moonGroundLight()}`)
      .replace('#include <fog_fragment>', moonGroundFog());
    sh.fragmentShader = f;
  });
}

// The blades (M.lawnBlade): their light less cyan as the lawn's is (4).
export function moonBlades(mat) {
  return chain(mat, 'ground-moon', (sh) => {
    Object.assign(sh.uniforms, moonUniforms());
    track(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uMoonGround;
        uniform float uMoonFog;
        uniform vec3 uMoonFogTint;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        ${moonGroundLight()}`)
      .replace('#include <fog_fragment>', moonGroundFog());
  });
}

// What bankLit (shore.js) takes to lay the same sward on the bank's grass
export const BANK_SWARD = { on: true, moon: true, uniforms: () => ({ ...swardUniforms(), ...moonUniforms() }), track };
export const MIST_COLOR = MOON_GROUND.mist;

// ── 3. Tufts along the edges ──────────────────────────────────────────────────
// Where a lawn is not mown: along the ways' sides, at a hedge's foot, round a
// stone or a post, on the lip of the bank — so the blades stand there, in
// runs and gaps, and not out in the open lawn. `step`: how far apart along an
// edge a clump may stand; `out`: how far off the edge (most of them close in);
// `run`: the length of the runs and gaps; `bare` the share that is gap.
// `ways`: how much closer set they are along the ways' sides, which are walked
// past and seen up close (elsewhere they cost frames no one sees).
// `height`: a clump's (uncut grass, a hand or two high); `stone`: clumps round
// each stone's foot.
export const TUFTS = {
  on: true,
  step: qn('wtuftstep', 0.75), out: [0.3, 3.6], run: 9, bare: qn('wtuftbare', 0.22), ways: qn('wtuftways', 1.7),
  height: qn('wtufth', 1.5), stone: [1, 3],
  blades: [16, 28], spread: [0.05, 0.6], wide: [0.035, 0.065], tip: 1.4, k: qn('wtuftk', 0.52),
  // a blade's root green (deep in the clump, in its own shade), and the share
  // gone to straw. 2026-10-16 "the grass is too light and sparse, make it
  // darker and more realistic": was [0.046, 0.058, 0.014] with a tenth gone
  // to straw — read as hay under the lanterns; now a deep green whose tips
  // only catch the light, finer blades, fewer gaps, closer set by the ways.
  green: [0.019, 0.04, 0.011], straw: [0.05, 0.046, 0.02], dry: 0.04,
};

// Dev: `__ground({ r, g, b, detail, macro, lr, lb, fog })` turns the dials live.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__ground = (o = {}) => {
    if (o.r !== undefined || o.g !== undefined || o.b !== undefined) SWARD.color.setRGB(o.r ?? SWARD.color.r, o.g ?? SWARD.color.g, o.b ?? SWARD.color.b);
    if (o.detail !== undefined) SWARD.detail = o.detail;
    if (o.macro !== undefined) SWARD.k = o.macro;
    if (o.gain !== undefined) SWARD.gain = o.gain;
    if (o.lr !== undefined) MOON_GROUND.light.x = o.lr;
    if (o.lb !== undefined) MOON_GROUND.light.z = o.lb;
    if (o.mist !== undefined) for (const m of mists) m.color.set(o.mist);
    if (o.fog !== undefined) MOON_GROUND.fog = o.fog;
    if (o.ft) MOON_GROUND.fogTint.set(...o.ft);
    for (const u of live) {
      if (u.uSwardK) u.uSwardK.value.set(SWARD.detail, u.uSwardK.value.y && SWARD.k, SWARD.gain);
      if (u.uMoonFog) u.uMoonFog.value = MOON_GROUND.fog;
    }
    return { sward: SWARD.color.toArray(), gain: SWARD.gain, detail: SWARD.detail, macro: SWARD.k, light: MOON_GROUND.light.toArray(), fog: MOON_GROUND.fog, live: live.length };
  };
}
