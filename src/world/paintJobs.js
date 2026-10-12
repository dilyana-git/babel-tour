// ── The surfaces worth painting off the main thread ──────────────────────────
// The big stone, wood, leaf and leather surfaces of textures.js take about two
// and a half seconds to paint on the machine this piece is made on, and that
// used to be two and a half seconds of a frozen page while the Library was
// assembled. They depend on nothing but their own seed (each painter makes its
// own stream; none of them touches the world's), so they can be painted
// anywhere, in any order, at the same time as the world is built.
//
// Shared by the worker (paint.worker.js), which paints, and by paint.js, which
// hands out the textures before a pixel of them exists. That is why each one
// says here what it will return — every map's size and how it is sampled —
// because materials are made from these textures, and shaders compiled for
// them, long before the paint arrives (effects.js reads the spine atlas's size
// as it compiles the books).
import { ashlar, flagstones, paving, walnut, timber, spineAtlas, spineAtlas2, spineTitles, bookRows, bookRowsLayout, hedgeLeaves, limestone, bark, SPINE_COLS, SPINE_ROWS, HIDE_SIZE, TITLE_COLS, TITLE_ROWS } from './textures';
import { floorCracks, crackSize } from './cracks';
import { rubbleStone } from './rubble';
import { shoreRock, shoreBank } from './shore';

// As toTexture (textures.js) leaves a map: colour in sRGB, the rest linear,
// repeating both ways.
const map = (w, h, srgb, anisotropy = 8) => ({ w, h, srgb, anisotropy });
const stoneSet = (size) => ({ map: map(size, size, true), normalMap: map(size, size, false), roughnessMap: map(size, size, false) });

// `cost` is what each took on that machine, in milliseconds, so the work can
// be shared out evenly between the painters.
export const PAINTERS = {
  ashlar: { paint: ashlar, cost: 270, gives: (a = {}) => stoneSet(a.size ?? 1024) },
  flagstones: { paint: flagstones, cost: 110, gives: (a = {}) => stoneSet(a.size ?? 1024) },
  // the Library's floor, laid as a mason lays it (2026-10-06): painted per pixel
  paving: { paint: paving, cost: 750, gives: (a = {}) => stoneSet(a.size ?? 1024) },
  // the cracks in the Door's pavement (2026-10-07, cracks.js): one linear map
  // over the breach's frame, its size from the frame
  floorCracks: { paint: floorCracks, cost: 1500, gives: (a) => { const { w, h } = crackSize(a); return { map: map(w, h, false) }; } },
  limestone: { paint: limestone, cost: 360, gives: (a = {}) => stoneSet(a.size ?? 1024) },
  // the grain of the stone that came down in the Door (2026-10-07, rubble.js)
  rubbleStone: { paint: rubbleStone, cost: 450, gives: (a = {}) => stoneSet(a.size ?? 1024) },
  // the garden's granite and the pond's pebbled bank (2026-10-07, shore.js)
  shoreRock: { paint: shoreRock, cost: 500, gives: (a = {}) => stoneSet(a.size ?? 1024) },
  shoreBank: { paint: shoreBank, cost: 350, gives: (a = {}) => stoneSet(a.size ?? 1024) },
  walnut: { paint: walnut, cost: 25, gives: (a = {}) => stoneSet(a.size ?? 512) },
  // a board sawn from the log (2026-10-05), twice as long as it is wide
  timber: {
    paint: timber,
    cost: 650,
    gives: (a = {}) => ({ map: map(a.w ?? 1024, a.h ?? 512, true), normalMap: map(a.w ?? 1024, a.h ?? 512, false), roughnessMap: map(a.w ?? 1024, a.h ?? 512, false) }),
  },
  hedgeLeaves: { paint: hedgeLeaves, cost: 410, gives: (a = {}) => stoneSet(a.size ?? 1024) },
  spineAtlas: {
    paint: spineAtlas,
    cost: 340,
    gives: (a = {}) => {
      const W = (a.cellW ?? 64) * SPINE_COLS, H = (a.cellH ?? 256) * SPINE_ROWS;
      return { detail: map(W, H, true, 4), mask: map(W, H, false, 4), hide: map(HIDE_SIZE, HIDE_SIZE, false, 4) };
    },
  },
  // the lettered books' atlas (one map: gilt, the leather's grey, height) and
  // their titles (textures.js)
  spineAtlas2: {
    paint: spineAtlas2,
    cost: 700,
    gives: (a = {}) => ({
      mask: map((a.cellW ?? 128) * SPINE_COLS, (a.cellH ?? 512) * SPINE_ROWS, false, 8),
      hide: map(HIDE_SIZE, HIDE_SIZE, false, 4),
    }),
  },
  spineTitles: {
    paint: spineTitles,
    cost: 400,
    gives: (a = {}) => ({ map: map((a.cellW ?? 256) * TITLE_COLS, (a.cellH ?? 128) * TITLE_ROWS, false, 8) }),
  },
  // the far galleries' books, painted in rows (2026-10-06; see buildWorld's shelfWall)
  bookRows: {
    paint: bookRows,
    cost: 200,
    gives: (a = {}) => { const L = bookRowsLayout(a); return { map: map(L.w, L.h, true, 4) }; },
  },
  bark: { paint: bark, cost: 50, gives: (a = {}) => ({ map: map(a.w ?? 256, a.h ?? 512, true), normalMap: map(a.w ?? 256, a.h ?? 512, false) }) },
};

// A painted set as plain pixels: each map's RGBA, its rows turned over (a canvas
// runs down, a texture up — what flipY did for the canvas), and how it was
// left to be sampled, so the receiving side can check it against `gives`.
export function readMaps(set) {
  const maps = {}, transfer = [];
  for (const [key, tex] of Object.entries(set)) {
    const c = tex.image, w = c.width, h = c.height, row = w * 4;
    const src = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) out.set(src.subarray(y * row, y * row + row), (h - 1 - y) * row);
    maps[key] = { data: out, w, h, srgb: tex.colorSpace === 'srgb', anisotropy: tex.anisotropy, wrapS: tex.wrapS, wrapT: tex.wrapT };
    transfer.push(out.buffer);
    tex.dispose();
  }
  return { maps, transfer };
}
