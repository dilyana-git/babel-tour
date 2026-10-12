// The Vestibule and the Echo (2026-10-11, audit III, board 3): the galleries'
// colour (1, COLOURS below: the user chose c), the readers on the bridge (2),
// the ashlar (3), the Echo's carved stone (4), the pier glasses (5), the
// string course over the Vestibule's way out (6).
// What each point was, and why: docs/design-history.md.
//
// ?wlib3=old puts all of them back as they were; ?wlib3=old:3,5 only those.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const V = Q.get('wlib3');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map((s) => s.trim())) : null;
export const lib3Old = (n) => V === 'old' || (ONLY ? ONLY.has(String(n)) : false);

// 5. The pier glasses. `quality`: the reflection's height as a fraction of
// the glass's on the screen (0.6 before: from the Vestibule's stand a glass
// 200 pixels tall was drawn 128 by 50); `least`: and never lower than this.
// `tint`, `silver`: what the old plate gives back of the room — a little
// green in it, as old glass has, and under three quarters of the light.
export const GLASS3 = { quality: 1.5, least: 256, tint: [0.84, 0.88, 0.78], silver: 0.78 };

// 2. The file on the bridge. `robes`: their wool, in place of readers.js's
// near-blacks (which keep the finale, where the light is a flood). `lit`:
// how much more of the rim, the wrapped light and the page's light these
// readers take than READER_LIT gives everyone. `arch`: the lit arch behind
// them as a light — its colour, how strong, and how far it reaches.
export const BRIDGE_READERS = {
  robes: ['#4b3526', '#3f3530', '#51302a', '#433d27', '#3a302a', '#47382f', '#4e3722'],
  lit: [1.0, 0.8, 2.0],
  arch: { color: [1.0, 0.8, 0.54], k: 0.65, reach: 150 },
};

// 4. The Echo's carved stone (stoneShade's `worked`), inside `reach` of the
// room's middle. `tone`: how uneven its value, slowly and stone by stone;
// `soffit`: how much darker what faces down (arch soffits, the undersides of
// mouldings); `up`: how much paler what faces up, where dust lies and hands
// and feet go; `polish`: the roughness worn into those faces at the full of
// it (the nosings; the handrail a little less; 1 is the matt it all was);
// `joints`: how much darker the ashlar's joints; `sides`: the flats a
// baluster is turned in (10 before).
export const ECHO_STONE = { reach: 118, tone: 0.44, soffit: 0.48, up: 0.16, streak: 0.24, polish: 0.6, joints: 0.5, sides: 20 };

// 6. The Vestibule's wall over its way out. `y`: the string course's bed;
// `proud`: how far its fascia stands off the wall; `glow`: the wash a
// lamp-rail lying on its ledge throws up the stone over it, and `fall` the
// height that wash falls to a third in.
export const STRING = { y: 84, proud: 2.2, glow: 1.2, fall: 13 };

// 1. The Library's colour, three ways.
//   a  the bindings carry it: each gallery's shelves weighted to one
//      leather — oxblood in the Vestibule, bottle green and tan in the Echo,
//      vellum in the Silence — in the mix they have now, book by book
//   b  the cases carry it: a gallery shelved as collections, a whole bay in
//      one binding, so that from the stand a wall is blocks of colour
//   c  the bindings and the room's own things: a's weighting, and the
//      scalloped leather on every shelf's edge in the gallery's colour
// `weight`: how many times its ordinary share of the runs a gallery's own
// binding has; `keep`: how much of a binding's chroma is given back at a
// distance; `leathers`: the shelf-edges, by room.
const LEATHERS = ['#742a22', '#2f4d36', '#8f8263'];
export const COLOURS = {
  a: { weight: 3.2, bays: false, dress: false, keep: 1.25 },
  b: { weight: 2.2, bays: true, dress: false, keep: 1.3 },
  c: { weight: 3.2, bays: false, dress: true, keep: 1.25, leathers: LEATHERS },
};
// The user's pick, from the canvas of the three (2026-10-11): c.
// ?wlibcol=a|b puts one of the other two in its place; `off` is the shelves
// as they were, with nothing of the options on them (as ?wlib3=old:1 is).
const PICK = Q.get('wlibcol');
export const COLOUR = lib3Old(1) || PICK === 'off' ? null : COLOURS[PICK] ?? COLOURS.c;
