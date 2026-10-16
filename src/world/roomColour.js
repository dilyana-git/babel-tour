// Each gallery its own colour (2026-10-15). The four rooms of the Library were
// one limestone, one timber, one binding mix and one lamp, and the print's
// grade took most of the rest out of the shadows they stand in. From a canvas
// of four directions (Quarry, Fire, Heraldry, Signature) the user chose D,
// Signature: the strongest of the levers for each room —
//   I   the Vestibule  walnut cases, crimson bindings, candlelight
//   II  the Echo       pale polished stone, the columns in the same
//                      limestone as its arches and bridges, old ivory vellum
//                      among the calf, the near-white light of a gas mantle
//   III the Silence    black basalt, ebonised cases, old vellum, embers
//   IV  the Vertigo    red sandstone, mahogany rings, gilt bindings
//   V   the Door       (chosen from its own board, F: the most natural) a
//                      garden room: its cases stained grey-sage, the stone
//                      warm and pale, ivy-green cloth among the calf, the lamps a
//                      warm white so the green is not burnt brown, and the
//                      night's grey-green in the fill from the breach
// Every colour is one a thing in the room has or a flame in it gives; nothing
// is laid over the picture (and nothing is blue: palette-gold-on-teal).
//
// Parts: 1 the bindings (shelves.js, the Vertigo's funnelColor), 2 the stone,
// 3 the wood and the metal, 4 the lamps (their light, globes, halos and
// pools), 5 the print opened in the Library and the fill by room.
import * as THREE from 'three';
import { floorPools } from './lampPass';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const ONLY = null;
export const roomColOld = (n) => (ONLY ? ONLY.has(String(n)) : false);

// By room (0 Vestibule, 1 Echo, 2 Silence, 3 Vertigo, 4 the Door). `stone`,
// `wood`, `metal`: what the room's stone, timber and metal are multiplied by
// (linear); `stain`: the cases' timber stained this colour, grain, sheen and
// all (null: as they are; a flat paint over the grain, the first build of the
// Door, read as plastic); `polish`: the stone's roughness where it is
// worked smooth (null: as it is); `lamp`: the flame's colour and how strong it
// is against the Library's lamp; `fill`: the sky's and the bounce's fill
// against what it was, and `sky` its colour (null: as it is); `edge`: where
// the room's colour stops, centre to the side of its hexagon (default: the
// middle of the hallways; the Door's stops at its own wall, so the garden
// past the breach keeps its own).
export const ROOM_COLOUR = [
  { stone: [1, 1, 1], wood: [0.55, 0.45, 0.38], metal: [1, 1, 1], polish: null,
    lamp: { color: '#ff9a48', globe: '#ffd9b0', halo: '#ff9e50', pool: '#ff9440', k: 1 }, fill: 0.9 },
  { stone: [1.3, 1.26, 1.17], wood: [1.3, 1.2, 1.0], metal: [1, 1, 1], polish: 0.5,
    lamp: { color: '#ffeedd', globe: '#fff6ea', halo: '#ffe6c4', pool: '#ffe2c0', k: 1.25 }, fill: 1.15 },
  { stone: [0.45, 0.41, 0.37], wood: [0.38, 0.33, 0.3], metal: [0.8, 0.78, 0.76], polish: null,
    lamp: { color: '#ff6a2c', globe: '#ffb488', halo: '#ff7036', pool: '#ff6a2c', k: 0.7 }, fill: 0.75 },
  { stone: [1.42, 0.74, 0.5], wood: [1.1, 0.55, 0.4], metal: [1.35, 1.12, 0.7], polish: null,
    lamp: null, fill: 1 },
  { stone: [1.08, 1.06, 1.0], wood: [1, 1, 1], stain: Q.get('wdstain') ? `#${Q.get('wdstain')}` : '#c4dcbc', metal: [1, 1, 1], polish: null,
    lamp: { color: '#ffe6c8', globe: '#fff0dc', halo: '#ffe2c0', pool: '#ffe0c0', k: 1 }, fill: 1.25, sky: '#9a9e90',
    edge: [84, 88] },
];
const N = ROOM_COLOUR.length;
const EDGES = ROOM_COLOUR.map((r) => r.edge ?? [108.5, 112.5]);
// 1. The bindings, by room: the room's own binding (BINDINGS' index) and its
// colours, and the share of the runs it takes (of every hundred books);
// `quiet`: other bindings' shares put down (the Echo keeps only a trace of
// green).
// The Silence's vellum is OLD vellum — parchment gone the colour of tea, not
// paper — and matte: a quarter of the shelves pale and the rest dark calf,
// so a wall of it reads as books in a dark room, not as a lit panel (the
// canvas's first try, half the shelf in pale cream, read as one).
const DOOR_CLOTH = (() => {
  const v = Q.get('wdbind');
  return v ? v.split(',').map((h) => `#${h}`) : ['#2d4a24', '#34522a', '#26401f', '#3a5a2c'];
})();
export const ROOM_BINDINGS = [
  { index: 1, cols: ['#7a1a1c', '#6a1518', '#842022', '#5c1416'], share: 45 },
  { index: 4, cols: ['#b7aa8a', '#ab9d7d', '#c0b292', '#9f9274'], share: 20, lum: 0.86, quiet: { 2: 3 } },
  { index: 4, cols: ['#8a7a58', '#7b6b4d', '#917f5d', '#6c5d44'], share: 26, lum: 0.7 },
  null,
  // (the Door's shelves lose their bottle-green calf, shelves.js, so its own
  // is matched by kind: its cloth — in the ivy's greens, the arch's garden
  // face's own (IVY_GREEN, build/honeycomb.js). ?wdbind=hex,hex,… and
  // ?wdbshare=N try others.)
  { kind: 'cloth', cols: DOOR_CLOTH, share: Number(Q.get('wdbshare') ?? 22) },
];
// The scalloped leather along the shelves' edges, by room (libraryProps.js;
// null: as it is) — the Echo's in honey calf, not green; the Silence's in a
// dark tobacco calf (its pale vellum caught the lamps and read as lace).
export const ROOM_LEATHER = [null, '#6e4a2c', '#5a3826'];
// ...and the Vertigo's (rooms/vertigo.js, funnelColor): gilt and saffron
// calf, a share that thins as the funnel goes down into its dark.
export const VERTIGO_GILT = ['#b8892e', '#a77a26', '#c39436'];

// 5. The print in the Library (Grade.js): `open` takes the saturation, the
// gold pull and the darks' chroma toward these. Opening alone, with every
// room still one colour, printed orange-brown (palette-gold-on-teal); it is
// the rooms' own colours that it lets through.
export const OPEN_GRADE = {
  saturation: Number(Q.get('wrcsat') ?? 0.86),
  gold: Number(Q.get('wrcgold') ?? 0.08),
  shadowChroma: Number(Q.get('wrcdark') ?? 0.85),
};

// The rooms' centres and which of them a point is in: a hexagon out to the
// middle of the hallways round it, so a hallway is half one room's and half
// the next's, and the stone changes at a joint, not in a smear.
const centres = [];
export const setRoomCentres = (list) => { centres.length = 0; list.forEach((c) => centres.push([c[0], c[1]])); };
const hexAt = (x, z, c) => {
  const dx = x - c[0], dz = z - c[1];
  return Math.max(Math.abs(dz), Math.abs(dx * 0.8660254 + dz * 0.5), Math.abs(-dx * 0.8660254 + dz * 0.5));
};
export const roomWeights = (x, z) => ROOM_COLOUR.map((_, i) => (centres[i]
  ? THREE.MathUtils.smoothstep(-hexAt(x, z, centres[i]), -EDGES[i][1], -EDGES[i][0]) : 0));
export const roomOf = (x, z) => { const w = roomWeights(x, z); const i = w.indexOf(Math.max(...w)); return w[i] > 0.5 ? i : -1; };

// ── 2, 3: the stone, the wood and the metal ──────────────────────────────
// One patch on top of whatever a material already does: where in the world a
// fragment is, and the room's colour multiplied into its albedo just before it
// is lit (and the stone's roughness, where the room polishes it).
const centreU = { value: ROOM_COLOUR.map(() => new THREE.Vector2(0, 0)) };
const edgeU = { value: EDGES.map(([a, b]) => new THREE.Vector2(a, b)) };
const tintU = (key) => ({ value: ROOM_COLOUR.map((r) => new THREE.Vector3(...(r[key] ?? [1, 1, 1]))) });
const roughU = { value: ROOM_COLOUR.map((r) => r.polish ?? -1) };
const roomTinted = (mat, tint, { rough = false, tag }) => {
  if (!mat || mat.userData.roomTinted) return;
  mat.userData.roomTinted = tag;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = function (sh, r) {
    prev?.call(this, sh, r);
    sh.uniforms.uRcCentre = centreU;
    sh.uniforms.uRcEdge = edgeU;
    sh.uniforms.uRcTint = tint;
    if (rough) sh.uniforms.uRcRough = roughU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRcW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 rcAt = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          rcAt = instanceMatrix * rcAt;
        #endif
        vRcW = (modelMatrix * rcAt).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vRcW;
        uniform vec2 uRcCentre[${N}];
        uniform vec2 uRcEdge[${N}];
        uniform vec3 uRcTint[${N}];
        ${rough ? `uniform float uRcRough[${N}];` : ''}
`)
      .replace('#include <lights_physical_fragment>', `{
          for (int i = 0; i < ${N}; i++) {
            vec2 d = vRcW.xz - uRcCentre[i];
            float hex = max(abs(d.y), max(abs(dot(d, vec2(0.8660254, 0.5))), abs(dot(d, vec2(-0.8660254, 0.5)))));
            float w = smoothstep(uRcEdge[i].y, uRcEdge[i].x, hex);
            diffuseColor.rgb *= mix(vec3(1.0), uRcTint[i], w);
            ${rough ? 'if (uRcRough[i] >= 0.0) roughnessFactor = mix(roughnessFactor, min(roughnessFactor, uRcRough[i]), w);' : ''}
          }
        }
        #include <lights_physical_fragment>`);
  };
  mat.customProgramCacheKey = function () { return `${prevKey ? prevKey.call(this) : ''}|rc-${tag}`; };
  mat.needsUpdate = true;
};

const STONE = ['floor', 'floorBand', 'mass', 'vestMass', 'cap', 'capShade', 'step', 'nosing', 'carve', 'carveShade', 'dressed',
  'column', 'well', 'wellGlow', 'wornFloor', 'wornStep'];
const WOOD = ['shelf', 'shelfBack', 'shelfLip', 'oak', 'shelfWorn', 'wood', 'plank', 'lacquer'];
const CASES = new Set(['shelf', 'shelfBack', 'shelfLip']);
const EXTRA_STONE = new Set(['portalCarve', 'portalDressed', 'rubble', 'rubbleBig', 'rubbleBlocks']);
const METAL = ['gilt', 'giltDeep', 'frame', 'bronze', 'bronzeDim', 'bronzeWorn', 'inlay', 'fillet', 'gold', 'iron'];

// After the world is built (other patches set first): the materials.
// `extra`: { stone, wood, metal } materials that are not in M.
export function tintRooms(ctx, extra = {}) {
  const { M, bounceRooms, root } = ctx;
  // (the Door's portal and its fallen blocks are batches of their own)
  root?.traverse((o) => {
    if (!o.isMesh || !EXTRA_STONE.has(o.name)) return;
    (extra.stone ??= []).push(...(Array.isArray(o.material) ? o.material : [o.material]));
  });
  setRoomCentres(bounceRooms.value.slice(0, N).map((v) => [v.x, v.y]));
  centreU.value.forEach((v, i) => v.set(...centres[i]));
  {
    const stone = tintU('stone');
    for (const k of STONE) roomTinted(M[k], stone, { rough: true, tag: 'stone' });
    (extra.stone ?? []).forEach((m) => roomTinted(m, stone, { rough: true, tag: 'stone' }));
  }
  {
    const wood = tintU('wood'), metal = tintU('metal');
    // (only the cases take a stain: the desk, the chair and the ladder stay
    // oak. A stain is the colour the timber is drawn in, its own texture under
    // it: so each case material's tint is the stain over its own colour.)
    for (const k of WOOD) {
      if (!CASES.has(k) || !M[k]) { roomTinted(M[k], wood, { tag: 'wood' }); continue; }
      const own = M[k].color, t = tintU('wood');
      ROOM_COLOUR.forEach((r, i) => {
        if (!r.stain) return;
        const c = new THREE.Color(r.stain);
        t.value[i].set(c.r / Math.max(own.r, 1e-3), c.g / Math.max(own.g, 1e-3), c.b / Math.max(own.b, 1e-3));
      });
      roomTinted(M[k], t, { tag: 'case' });
    }
    for (const k of METAL) roomTinted(M[k], metal, { tag: 'metal' });
    (extra.wood ?? []).forEach((m) => roomTinted(m, wood, { tag: 'wood' }));
    (extra.metal ?? []).forEach((m) => roomTinted(m, metal, { tag: 'metal' }));
  }
}

// ── 4: the lamps ────────────────────────────────────────────────────────────
// Before the light is built: each lamp's light, globe, halo and floor pool
// takes its room's flame. (A lamp in a hallway takes the room whose half it
// hangs in; the Vertigo keeps its own, and its pit's.)
export function lightRooms(ctx) {
  const { lightWishes, globes, halos, bounceRooms } = ctx;
  setRoomCentres(bounceRooms.value.slice(0, N).map((v) => [v.x, v.y]));
  // (only a lamp's warm light: the moon's green spill into the Door, and any
  // light of the garden's, keep their own colour)
  const was = new THREE.Color();
  const warm = (c) => { was.set(c); return was.r >= was.g; };
  const flame = (x, z, c) => { const i = roomOf(x, z); return i >= 0 && (c === undefined || warm(c)) ? ROOM_COLOUR[i].lamp : null; };
  for (const w of lightWishes ?? []) {
    const f = flame(w.x, w.z, w.color);
    if (f) { w.color = f.color; w.intensity *= f.k; }
  }
  for (const g of globes ?? []) {
    const f = flame(g.p[0], g.p[2], g.color ?? '#ffffff');
    if (f && g.color) g.color = f.globe;
  }
  for (const h of halos ?? []) {
    const f = flame(h.sprite.position.x, h.sprite.position.z, h.mat.color);
    if (f) h.mat.color.set(f.halo);
  }
  for (const p of floorPools) {
    const f = flame(p.x, p.z, p.c);
    if (f) p.c.set(f.pool);
  }
}

// ── 5: the print and the fill, where the eye is ─────────────────────────────
// How open the print is (1 in a gallery, 0 out of the Library) and the fill
// (the sky's and the bounce's) by room, eased across the hallways.
const SKIES = ROOM_COLOUR.map((r) => (r.sky ? new THREE.Color(r.sky) : null));
export function roomPlace(x, z) {
  const w = roomWeights(x, z);
  const sum = w.reduce((a, b) => a + b, 0);
  const fill = sum > 0 ? w.reduce((a, wi, i) => a + wi * ROOM_COLOUR[i].fill, 0) / Math.max(1, sum) + (1 - Math.min(1, sum)) : 1;
  // (the one room whose fill has a colour of its own, as far as the eye is in it)
  const k = SKIES.findIndex((c, i) => c && w[i] > 0);
  return { open: Math.min(1, sum), fill, sky: k >= 0 ? SKIES[k] : null, skyW: k >= 0 ? w[k] : 0 };
}
