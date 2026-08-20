// ── The drifting quote ───────────────────────────────────────────────────────
// The sentence that hangs in the air of each gallery, in both tongues, and the
// arithmetic deciding where each of its words sits and when it arrives.
//
// It is text and typography and a seeded shuffle, and it touches nothing else
// in the tour: given a node and a width it returns a layout, and Tour's only
// business with it is to render what comes back and to know how long a word
// takes to dissolve. Out here that boundary is visible; inline it was 200 lines
// of vw bands standing in the middle of the walk.
import { NODES } from './catalogue';

// A tiny seeded PRNG (mulberry32) for scattering the drifting quotes — the
// Library is fixed, so a given scatter is the same scatter forever.
const mulberry = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The quote hangs in the air rather than lying on a page (design: 3b). Each
// word sits at one of three depths — near words large and sharp, far ones
// small, dimmed and out of focus — so the sentence has volume.
//
// It breathes rather than being posted: words gather out of the air in no
// particular order, the sentence holds long enough to be read, then it
// dissolves word by word — in a different order again — and after a pause of
// empty air it begins over. Nothing arrives in reading order, so the sentence
// assembles itself in front of you rather than being typed out.
//
// Sizes are vw, so the field scales with the frame. That alone isn't enough
// across the range this app has to cover: the wide bands reproduce the
// design's 86/54/38px on a 1920 canvas, but the same numbers on a phone
// render the sentence at 17px. The narrow set trades depth contrast for
// legibility and packs wider rows, and the layout below is run once for each.
const LEAD_MS = 700;      // a beat of empty air before the first word
const APPEAR_MS = 2000;   // one word's gathering
const APPEAR_STEP = 230;  // …and the beat between them
// One word's dissolving is 2200ms — owned by `scatter-gone` in tour.css and no
// longer needed here, now that nothing has to know when the field goes empty.
const VANISH_STEP = 150;  // the beat between one word leaving and the next
// The dissolve's own length, matching `scatter-gone` in tour.css. Nothing in
// the layout needs it — a word's disappearance is entirely the CSS animation's
// business — but the drift does, to know when the last word is actually gone
// rather than merely started leaving. Keep in step with the stylesheet.
export const SCATTER_GONE_MS = 2200;

// How long the assembled sentence stands. Scaled to its length rather than
// fixed: the words are readable as they land, so this is only the tail after
// the last one arrives — but twenty-two of them still need longer to finish
// than seven. (7 → 2.2s, 12 → 2.7s, 22 → 3.6s.)
const holdFor = (count) => 1600 + count * 90;

// Fisher–Yates on the seeded PRNG: the same hand scatters it every visit.
const shuffled = (n, rand) => {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// The design's far band is 38px at 0.6 opacity under 3.2px of blur. Against
// its one quote that reads as atmosphere; across eight it loses whole words —
// the Silence's "fruit" and "lamps" simply weren't there. These bands keep the
// depth but hold every word legible: the sentence is the content, not texture.
const SCATTER_WIDE = {
  bands: [
    { size: 4.48, blur: 0, opacity: 1 },
    { size: 3.2, blur: 1.2, opacity: 0.9 },
    { size: 2.5, blur: 2.2, opacity: 0.72 },
  ],
  rowMax: 74,   // percent of viewport width a row may fill
  rowStep: 11.5, // percent of viewport height between rows
  centre: 50,   // the vertical line rows are centred on
  // The LAST row's centre line, not the field's middle. Anchoring the bottom
  // keeps every quote sitting low in the frame whatever its length — a long
  // one grows upward into empty air rather than down through the attribution.
  bottom: 72,
};

const SCATTER_NARROW = {
  bands: [
    { size: 6.5, blur: 0, opacity: 1 },
    { size: 5.4, blur: 0.9, opacity: 0.92 },
    { size: 4.7, blur: 1.6, opacity: 0.78 },
  ],
  // Narrower and pushed off-centre to the left: at this width the plumb line
  // owns the right sixth of the frame, and a viewport-centred row long enough
  // to fill 92% ran straight through it.
  rowMax: 78,
  rowStep: 6.2,
  centre: 42,
  bottom: 70,
};

// `lang` is the DIRECTION OF TRAVEL, not a locale: descending, the Library
// speaks to you in translation, exactly as it has all along; walking back up,
// the same sentence re-gathers in Borges' own Spanish. Both layouts are built
// here at load — the same seeded hand scatters each, so a quote you have
// already read reassembles in the shape you remember, in the other tongue.
const buildScatter = (node, n, cfg, lang) => {
  const rand = mulberry(n * 31 + 11);
  const line = lang === 'es' ? node.folio.lineEs : node.folio.line;
  const list = line.split(' ').filter(Boolean);
  const band = (i) => cfg.bands[i % cfg.bands.length];
  // Estimated width as a percent of the viewport, from the band's size and an
  // average italic-serif character width — enough to keep words from colliding.
  const wEst = list.map((w, i) => (w.length + 1) * band(i).size * 0.55);

  // The design scatters the words along a single zig-zagging line. That holds
  // for its twelve-word quote but not for the Web of Time's twenty-two, which
  // would pile onto each other, so words flow into rows once a row is full.
  const pack = (limit) => {
    const out = [];
    let row = [];
    let rowW = 0;
    wEst.forEach((w, i) => {
      if (row.length && rowW + 1.6 + w > limit) {
        out.push({ items: row, width: rowW });
        row = [];
        rowW = 0;
      }
      row.push(i);
      rowW += (row.length > 1 ? 1.6 : 0) + w;
    });
    if (row.length) out.push({ items: row, width: rowW });
    return out;
  };

  // Greedy packing strands the tail — the Silence's twelve words leave
  // `lamps."` alone on a line of its own. Once the row count is known, re-pack
  // to the average row width so the field sits as an even block.
  let rows = pack(cfg.rowMax);
  if (rows.length > 1) {
    const total = wEst.reduce((a, b) => a + b, 0) + 1.6 * (wEst.length - 1);
    const even = pack(Math.min((total / rows.length) * 1.06, cfg.rowMax));
    if (even.length === rows.length) rows = even;
  }

  // Two independent scatters: the order words gather in, and the order they
  // dissolve in. Both are shuffles of the word list rather than its sequence,
  // so neither the arrival nor the departure reads left-to-right.
  const count = list.length;
  const appearAt = [];
  shuffled(count, rand).forEach((wi, k) => { appearAt[wi] = LEAD_MS + k * APPEAR_STEP; });
  // Whole sentence present. The lead is inside the breath, so arriving in a
  // gallery opens on empty air before the first word condenses.
  const gathered = LEAD_MS + (count - 1) * APPEAR_STEP + APPEAR_MS;
  const outStart = gathered + holdFor(count);
  const vanishAt = [];
  shuffled(count, rand).forEach((wi, k) => { vanishAt[wi] = outStart + k * VANISH_STEP; });

  const top = cfg.bottom - (rows.length - 1) * cfg.rowStep;
  const words = [];
  rows.forEach((r, ri) => {
    let x = cfg.centre - r.width / 2; // each row rides centred on the field's line
    r.items.forEach((i) => {
      const b = band(i);
      words.push({
        t: list[i],
        x: +x.toFixed(2),
        // A wobble off the row's baseline, so it reads as scattered depth
        // rather than as a justified paragraph.
        // This is the row's CENTRE LINE, not the word's top edge: the bands
        // differ in size by more than 2×, so anchoring by top would leave a
        // small word floating a whole line below its neighbours and scramble
        // the reading order. CSS centres each word on it.
        y: +(top + ri * cfg.rowStep + Math.sin(i * 0.9) * 1.2 + (rand() - 0.5) * 1.4).toFixed(2),
        size: b.size,
        blur: b.blur,
        opacity: b.opacity,
        d: appearAt[i],
        od: vanishAt[i],
        fdur: +(3.4 + rand() * 2.4).toFixed(1),
        fd: +(-rand() * 5).toFixed(1),
      });
      x += wEst[i] + 1.6;
    });
  });
  return {
    words,
    // The attribution signs the sentence once it is whole, and is the last
    // thing to leave — it outlasts the words it belongs to by a breath.
    attrD: gathered + 200,
    attrOutD: outStart + (count - 1) * VANISH_STEP,
  };
};

const bothTongues = (cfg) => ({
  en: NODES.map((node, n) => buildScatter(node, n, cfg, 'en')),
  es: NODES.map((node, n) => buildScatter(node, n, cfg, 'es')),
});
export const SCATTER = { wide: bothTongues(SCATTER_WIDE), narrow: bothTongues(SCATTER_NARROW) };
