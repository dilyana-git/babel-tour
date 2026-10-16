// The Library rooms' shared details: the galleries' colour, the readers on
// the bridge, the Echo's stone, the pier glasses, the string course, and the
// brass fillet round each floor.

// The pier glasses. `quality`: the reflection's height as a fraction of
// the glass's on the screen (0.6 before: from the Vestibule's stand a glass
// 200 pixels tall was drawn 128 by 50); `least`: and never lower than this.
// `tint`, `silver`: what the old plate gives back of the room — a little
// green in it, as old glass has, and under three quarters of the light.
export const GLASS3 = { quality: 1.5, least: 256, tint: [0.84, 0.88, 0.78], silver: 0.78 };

// The file on the bridge. `robes`: their wool, in place of readers.js's
// near-blacks (which keep the finale, where the light is a flood). `lit`:
// how much more of the rim, the wrapped light and the page's light these
// readers take than READER_LIT gives everyone. `arch`: the lit arch behind
// them as a light — its colour, how strong, and how far it reaches.
export const BRIDGE_READERS = {
  robes: ['#4b3526', '#3f3530', '#51302a', '#433d27', '#3a302a', '#47382f', '#4e3722'],
  lit: [1.0, 0.8, 2.0],
  arch: { color: [1.0, 0.8, 0.54], k: 0.65, reach: 150 },
};

// The Echo's carved stone (stoneShade's `worked`), inside `reach` of the
// room's middle. `tone`: how uneven its value, slowly and stone by stone;
// `soffit`: how much darker what faces down (arch soffits, the undersides of
// mouldings); `up`: how much paler what faces up, where dust lies and hands
// and feet go; `polish`: the roughness worn into those faces at the full of
// it (the nosings; the handrail a little less; 1 is the matt it all was);
// `joints`: how much darker the ashlar's joints; `sides`: the flats a
// baluster is turned in (10 before).
export const ECHO_STONE = { reach: 118, tone: 0.44, soffit: 0.48, up: 0.16, streak: 0.24, polish: 0.6, joints: 0.5, sides: 20 };

// The Vestibule's wall over its way out. `y`: the string course's bed;
// `proud`: how far its fascia stands off the wall; `glow`: the wash a
// lamp-rail lying on its ledge throws up the stone over it, and `fall` the
// height that wash falls to a third in.
export const STRING = { y: 84, proud: 2.2, glow: 1.2, fall: 13 };

// The Library's colour: each gallery's shelves weighted to one leather —
// oxblood in the Vestibule, bottle green and tan in the Echo, vellum in the
// Silence — book by book, and the scalloped leather on every shelf's edge in
// the gallery's colour. `weight`: how many times its ordinary share of the
// runs a gallery's own binding has; `keep`: how much of a binding's chroma is
// given back at a distance; `leathers`: the shelf-edges, by room.
export const COLOUR = { weight: 3.2, keep: 1.25, leathers: ['#742a22', '#2f4d36', '#8f8263'] };

// The fillet: [outer, inner] radius off the room's rim (it was 72.9, 72.1),
// how far proud of the floor, and the brass it is made of.
export const FILLET = { outer: 72.95, inner: 71.85, proud: 0.16 };
export const FILLET_BRASS = { color: '#6b5634', roughness: 0.72, metalness: 0.35 };


