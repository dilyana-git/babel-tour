// The map's tone (2026-10-12): the stone round the walk had read too reddish —
// the wall tops lit in the lamps' own orange (mapFix4.js, 2), the rims' warm
// bounce as orange (mapFix.js, 8), and the grade's gold never reaching the dark
// paving (Grade.js). This is the look the user picked from four ("parchment"):
// half the colour, the stone a pale warm limestone and the lit rooms the
// warmest thing on the page. The other three, and the map as it was, are in
// docs/design-history.md.
//
// Its dials. Any left out is as the module it overrides has it.
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
export const TONE = {
  route: { color: '#ffd8a0', warm: 0.55 },
  rim: { color: [1.0, 0.78, 0.5], k: 0.55 },
  quiet: [0.4, 0.38, 0.355],
  bounce: '#4e463c',
  grade: { gold: 0.3, deep: 1, chroma: 0.62 },
};
