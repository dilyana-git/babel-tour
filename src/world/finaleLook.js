// The ending's dials: the flood of fireflies and the rise over the maze, the
// step in toward the heart, the others' hoods, the close-up and the ending on
// the map.
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// The flood. `maze`: how many hang over the maze's ways ([as built, on a
// light machine]), `court`: the share of those drawn over the court that are
// kept (the column is the court's); `high`: how far off the ground they hang.
// `column`: how many rise over the heart, from `foot` above the ground to
// `top`, between `r` of the armillary's axis (most of them close in: `pack`),
// at `speed` units a second, opening out by `flare` of their radius on the
// way up and fading over the last `fade` of it.
// `bright`: the dimmest and the brightest, and how many are dim (`skew`).
// `near`: within the first a mote is wholly out of focus, beyond the second
// wholly in; `bokeh` how much wider out of focus, and `dim` how much of its
// light a pixel of that disc has; `far`: how much smaller than its distance
// makes it a far one is drawn (reached at three times `near`'s second).
// `gold`, `straw`: the colours by the heart and out in the maze, from
// `warm`[0] to `warm`[1] of the light's own way there.
export const FLOOD = {
  maze: [qn('wfmaze', 430), 190], court: qn('wfcourt', 0.2), high: [3, 21],
  column: { n: [qn('wfcol', 90), 40], foot: 7, top: qn('wfcoltop', 88), r: [2.5, qn('wfcolr', 14)], pack: 1.3, speed: [1.1, 2.6], flare: 0.35, fade: 20 },
  bright: [0.22, 1.35], skew: 2.2,
  near: [qn('wfnear0', 9), qn('wfnear1', 38)], bokeh: qn('wfbokeh', 2.4), dim: qn('wfdim', 0.22), far: qn('wffar', 0.55),
  gold: ['#ffac48', '#ffbd62', '#ffc978'], straw: ['#ffe2a2', '#ffd98e', '#ffecc0'], warm: [14, 78],
};

// The rise: the motes go out between these seconds after it begins, down
// to `rest` of themselves — which is what of them is left over the map.
export const RISE = { fade: [qn('wfrise0', 2.2), qn('wfrise1', 7.5)], rest: qn('wfrest', 0) };

// The court's paving from above (finale.js): `stop` how much of its light is
// taken off (a half: a stop), reached as the eye goes from `high`[0] to
// `high`[1] above the ground — none of it where the reader stands, all of
// it straight over the heart; `r` how far out from the heart (the kerb is
// 35.2).
export const PAVING = { stop: qn('wfpave', 0.5), high: [28, 70], r: 35.4 };

// The step in. `to`: how far from the heart, along the way in, the reader
// comes to — a little short of the gate's line (45), so its jamb stays in the
// frame as a wing; `aside`: no further off that line than this, or the reader
// is somewhere else and stays there; `from`, `till`: when in the film (the
// heart catches at 5.2); `bob`: how far the eye sinks in each of the two
// paces. `heart`: where across the frame the armillary is brought to as the
// others gather (-1 the left edge, 0 the middle), and `gate`: on a frame too
// narrow for both, how far right of the middle the west gate may be; `edge`:
// none of the others may stand within this many degrees of either edge of the
// frame (one was cut by it), and the eye is turned a little less or a little
// more, by up to `give` degrees, until none does.
// (`to`: the court is round inside its square of hedge, about 36 across the
// half of it. From the gate's line, 45, the hedge in its corner was still a
// quarter of the frame; from 40 it is a twentieth.)
export const STEP = { to: qn('wfstep', 40), aside: 16, from: 1.4, till: 5.0, bob: 0.2, heart: qn('wfheart', -0.3), gate: 0.5, edge: 4.5, give: 9 };

// The hood, close to. `fold`: how much deeper the cowl's and the mantle's
// folds hang (and they run to the hem, which was kept smooth). `hem`: the
// edge turned in — [how far back along the hood, how much of its width, how
// far into the dark] for each ring of the inside, the first a thread's width
// from the edge and the last at the hood's point (left open at the back, the
// inside showed the back of the cowl through its end, paler than itself; and
// with fewer rings toward the point than the cowl has, the cowl's point came
// through it, a lit patch over the head). `lining`: the inside's colour, as a share of the wool's own
// (it was a quarter, and the sky made a grey rubber of it). `fray`: the
// threads at the edge, how long ([least, most]).
// `lamp`: the light in the hood — where, from the middle of the head (below
// the chin and before it), how strong, over what distance it halves, and its
// colour; `face`: how much of it the face has, beside the cloth round it, and
// `reach`: from where to where (in halvings) it leaves the face altogether —
// lit as the cloth is, the face was a pale egg in the hood, and then a mask
// with holes for eyes: it is the chin, the mouth and the underside of the nose
// that such a light finds, and the rest stays in the dark. `cloth`: the same
// for the inside of the cowl — it is lit beside the jaw and under it, and not
// up beside the brow or behind the head (lit there, it drew the head on
// itself as a black egg), `wool` times over: the dye is dark. `weave`: the
// wool's twill, how many ribs to a unit and how deep (a unit is 9.4 cm: a
// coarse homespun, so the rib can be told from the face-to-face distance,
// where a finer one was smoothed to clay); `fleck`
// how uneven its dye; `matt` how much of the smooth shine is taken off it.
export const HOOD = {
  fold: qn('wfhfold', 2.4),
  hem: [[0.012, 0.975, 0.5], [0.04, 0.95, 0.8], [0.1, 0.92, 0.93], [0.2, 0.88, 0.97], [0.36, 0.83, 0.985], [0.55, 0.8, 0.99], [0.6875, 0.8, 0.99], [0.8125, 0.8, 0.99], [0.875, 0.8, 0.99], [0.9375, 0.8, 0.99], [1, 0.8, 0.99]],
  lining: 0.62,
  fray: [0.03, 0.11], threads: 64,
  lamp: { at: [0, -2.1, 1.35], k: qn('wfhlamp', 4.5), half: 2.2, color: [1.0, 0.7, 0.4], face: qn('wfhface', 0.5), reach: [0.6, 1.2], cloth: [0.85, 1.5], wool: qn('wfhwool', 1.7) },
  weave: [qn('wfhweave', 9), qn('wfhrib', 1)], fleck: qn('wfhfleck', 0.2), matt: qn('wfhmatt', 0.92),
  // `crown`: an empty hood's crown, lying in across the inside (readers.js,
  // `hollow`) — how far below the top of the opening, how far back of the
  // hood's middle it is centred, how much it domes, how near the cloth it
  // comes (of the way), its shade, its dark ([middle, edge], aDark), and how
  // far its front edge is turned up behind the brow; `seen`: how steeply it
  // must be looked down on (the sine) before it is cloth and not the hood's dark;
  // `lining`: the darkest the hood's inside is then (aDark); `fill`: the
  // light it is given then (of its own colour), where no lamp reaches it.
  // (Just under the brow, it was behind what the eye sees from above: down
  // through the opening it is the collar's dark that shows, so it lies as
  // low as the throat, over the collar.)
  crown: { below: qn('wfhcrown', 2.15), back: 0.25, dome: 0.12, inset: 0.95, tone: 0.55, dark: [qn('wfhcdark', 0.55), 0.85], tuck: 0, seen: [0.3, 0.7], lining: qn('wfhclin', 0.7), fill: qn('wfhcfill', 3) },
};

// The body under the hood (readers.js, `close`). `slim`: how much narrower
// the robe is from the hips to the shoulders, so the arms hang clear of it.
// `cape`: the short cape's outline, [across, up, front to back] from its
// hem to the neck — out from the neck at a shallow slope, round the
// shoulder and down over the top of the arm. `sleeve`: shoulder, elbow,
// wrist and the end of the cuff, [out, up, forward]; `r`: its radius at the
// shoulder, the elbow and the cuff's mouth; `hang`: how much further the
// cuff falls in front of the arm than behind it.
// (2026-10-18: cut to end 12.65, a hand's breadth below the shoulder, with
// a rolled edge, the cape read as a padded roll round the shoulders — a neck
// pillow. Now it falls to the middle of the upper arm and flares a little.
// `fall`: how it hangs, [at the neck, more by the hem, how far forward of the
// shoulders the hem is lifted]. Down off each shoulder it falls in a ridge,
// in front and behind it lies in to the body, and smaller flutes break the
// hem. `edge`: the hem's turn under, [up, in]: a cloth's thickness.)
export const ARMS = {
  slim: 0.82,
  cape: [[3.32, 11.85, 2.05], [3.14, 12.7, 1.93], [3.02, 13.45, 1.82], [2.84, 13.95, 1.69], [2.5, 14.28, 1.52], [2.02, 14.48, 1.37], [1.58, 14.78, 1.23], [1.2, 15.3, 1.05]],
  fall: [0.05, 0.42, 0.55],
  edge: [0.03, 0.045],
  sleeve: [[2.15, 13.7, 0], [2.62, 10.5, 0.2], [2.58, 8.3, 0.75], [2.5, 7.3, 0.8]],
  r: [0.6, 0.66, 1.05],
  hang: 0.9,
};

// (how much of the page's light the face of the one seen from the side takes: FACE, below)
const FACE_SIDE = qn('wffside', 3.2);

// Close to, a face in one of these hoods was a smooth egg with a warm patch on its chin:
// the head was hardly modelled (a nose a tenth of its depth, no lips), and the
// light in the hood was laid on it flat. `FACE`: the head carved — `rows` by
// `cols` of it where there were 26 by 34 — and the light in the hood falling
// on it as a light does: `wrap` how far it comes round a form turned from it,
// `gamma` how quickly it leaves one (higher, harder), `reach` from where to
// where up the face it dies (in halvings of the lamp: the chin and the mouth
// have it, the eyes a little, the brow none), `edge` how far a surface may be
// turned from the eye and still be lit ([none, all] of the cosine: the old cut
// took the whole profile with it), `k` how much of the lamp the skin has;
// `fore`: how far round to the front of the face the light is brought (the
// lamp is under the chin, and a light straight up a face lights the undersides
// of things and nothing else: the mouth was three bright stripes).
// `side`: for the one seen from the side (a), how much of the page's own light
// its face takes, and how hard that light is.
export const FACE = {
  on: true, rows: 84, cols: 72,
  wrap: qn('wffwrap', 0.12), gamma: qn('wffgamma', 1.5), reach: [qn('wffr0', 0.5), qn('wffr1', 1.3)], edge: [-0.2, 0.25], k: qn('wffk', 0.85), fore: qn('wfffore', 0.9),
  side: { k: FACE_SIDE, gamma: qn('wffsg', 1.6) },
};

// Who stands behind the reader at the end: nobody, from further off — the
// whole of the figure, to the hands in its sleeves, between the two
// lanterns. `book`: one open in its hands; `cut`: how it is made (readers.js:
// `hollow`, no head); `lamp`: the light in the hood, of the others'; `back`:
// how far behind the reader it comes to stand.
export const HOODED = { book: false, cut: { hollow: true }, lamp: 0, back: qn('wfhback', 10) };

// What the others wear, and what is in their hoods. (2026-10-18: one of them
// was in the walkers' olive, the only green among the browns, and every one
// of the six still had a face lit by a lamp under the chin, where the walk
// has taught the reader to expect none. Now browns only, and every hood as
// empty as the one behind the reader.) `robes`: one each, in CAST's order,
// and the last the reader's own (finale-you takes the eighth).
export const OTHERS = {
  robes: ['#2b2019', '#241f1b', '#2e1d18', '#2c1f17', '#201a16', '#2a2320', '#2f2219', '#2b2019'],
  cut: HOODED.cut, lamp: 0,
};

// The lit floor's light on the robes from below (finale.js, otherShader):
// `k` how much (2.4 lit the hem as a band), `cloth` the brightest the cloth
// it comes back from may be (linear luminance; the robes' own dye is about
// 0.016, the path dust at the hem twice that).
export const FLOOR_BOUNCE = { k: qn('wfbounce', 1.7), cloth: qn('wfbcloth', 0.018) };

// The others. For each: the gate it comes in by and how many cells up that
// way it starts; where it comes to stand — degrees round the heart (0 east, 90
// south, straight across from the reader, who comes in from the north) and how
// far out; when it appears, sets off, arrives; and what it is: how tall (of
// the cut they all share), a book open in its hands, and where it looks once
// there — at the reader (so many degrees off them), or `heart`: at the
// armillary, which for one on the reader's side of it is its back to them.
export const CAST = [
  ['s', 1, 62, 26, 6.8, 7.2, 9.3, { tall: 1.05 }],
  ['s', 1, 122, 32, 7.7, 8.1, 10.3, { tall: 0.93, book: true, gaze: 24 }],
  ['e', 1, 20, 31, 7.1, 7.6, 11.0, { tall: 0.99, gaze: -12 }],
  ['w', 1, 207, 22.5, 7.6, 8.1, 11.6, { tall: 1.08 }],
  ['e', 3, 330, 33, 8.6, 9.1, 13.8, { tall: 0.96, book: true, gaze: 'heart' }],
  ['w', 2, 155, 20.5, 8.3, 8.8, 13.2, { tall: 1.01, gaze: 'heart' }],
];

// The ending, on the map. The line is held alone for `hold` ms; the
// colophon comes in, and after `then` ms the ways on.
export const ENDING = { then: qn('wfethen', 3500) };

// The way out of the film: `after` ms without a hand on anything it sinks
// to a trace (map.css, .room-skip.is-trace).
export const SKIP = { after: qn('wfskip', 3000) };
