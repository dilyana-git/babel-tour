// What the user said of the map (2026-10-12): "it looks too reddish". Measured
// on their screenshot, the stone round the walk sat at hue ~23 (a quarter of
// it under 17: red-brown), where the palette the Library was re-keyed to puts
// its lamplight at ~33-36 (World.jsx, "The palette"). Three things put it
// there, all over the map only:
//   the wall tops lit in the lamps' own orange (mapFix4.js, 2), which against
//      the moon it replaced is 2.2x the red and a fifth of the blue, on stone
//      that is warm already — and ACES carries a saturated orange on toward red
//   the warm bounce on the walk's rooms' rims (mapFix.js, 8), as orange
//   the grade's gold (Grade.js), which turns brown light amber, but only where
//      a pixel is lit: the paving round the rooms is too dark for it to reach
// The user asked for options. Four, from the warmest to the most neutral, each
// a set of the same dials (TONES, below):
//   a  amber      the same warmth, its hue moved from copper to amber
//   b  old gold   yellower and a little brighter: brass lamplight on the stone
//   c  parchment  half the colour: pale warm limestone, the lit rooms warmest
//   d  ash        the stone near grey; the warmth left to the rooms and their rims
//
// ?wmaptone=a|b|c|d puts one on the map; with none, the map is as it was.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

// Each look's dials. Any left out is as it was.
// `route`: the light on the wall tops over the map (mapFix4.js's ROUTE_LIGHT:
//   its colour, and how far it goes from the moon's toward it)
// `rim`: the warm bounce on the walk's rooms' rims (mapFix.js's RIM_WARM: its
//   colour and strength)
// `quiet`: the unwalked cells' stone (mapFix3.js's LOOK tint)
// `bounce`: the hemisphere's ground colour over the map — what the cells'
//   walls see coming up off the stone (World.jsx's LIBRARY_BOUNCE, '#5b432f')
// `grade`: over the map only (Grade.js) — `gold`, how far green is carried up
//   toward red in warm pixels (0.18 among the walls); `deep`, how far down into
//   the dark it reaches (0: lit pixels only, as among the walls; 1: down to
//   near black); `chroma`, what is kept of the colour of the warm, unlit stone
export const TONES = {
  a: {
    route: { color: '#ffc985', warm: 1 },
    rim: { color: [1.0, 0.74, 0.42] },
    grade: { gold: 0.3, deep: 1, chroma: 0.92 },
  },
  b: {
    route: { color: '#ffd796', warm: 1, k: 0.5 },
    rim: { color: [1.0, 0.8, 0.48], k: 0.85 },
    quiet: [0.41, 0.385, 0.33],
    bounce: '#5a4c36',
    grade: { gold: 0.42, deep: 1 },
  },
  c: {
    route: { color: '#ffd8a0', warm: 0.55 },
    rim: { color: [1.0, 0.78, 0.5], k: 0.55 },
    quiet: [0.4, 0.38, 0.355],
    bounce: '#4e463c',
    grade: { gold: 0.3, deep: 1, chroma: 0.62 },
  },
  d: {
    route: { color: '#e9e2d6', warm: 1 },
    rim: { color: [1.0, 0.8, 0.52], k: 0.5 },
    quiet: [0.38, 0.375, 0.37],
    bounce: '#3f3c38',
    grade: { gold: 0.25, deep: 1, chroma: 0.3 },
  },
};
export const TONE = TONES[Q.get('wmaptone')] ?? null;
