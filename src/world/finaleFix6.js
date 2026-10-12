// The ending, reviewed 2026-10-11 (board 6 of the third audit; the numbers are
// the board's own). The film has the right shape — gather, recognise, rise —
// and the rise (2) is kept as it was. What was not right:
// 1 the close-up was the weakest image, at the film's peak: for several
//   seconds a smooth orange hood round a black void with a chin in it, a hand's
//   breadth from the lens. Three ways out of it, all built (CLOSE, below):
//   (the user chose a, 2026-10-12; b and c are kept behind ?wfinclose)
//   a never head-on — the one who is the reader comes to stand beside them, a
//     little ahead, looking where they look, the page lit in its hands and the
//     face only the hood's edge against the heart's light;
//   b the angle kept, from further off, so that the book is in the frame and
//     it is the page that lights the mouth and the jaw from below;
//   c cut — the eye stays on the others gathered, and rises from there.
// 3 there was no ending: the film came down on the map, with the card it had
//   before ("Enter The Web of Time") and one small status line. Now the lit
//   walk is held under one line; then a quiet colophon; then "Walk it again"
//   (EntryMap.jsx, map.css).
// 4 the others were figurines: robes of one cut and one height, set at even
//   intervals round the court, every one turned to the reader. They are of
//   different heights now and stand where people stand, nearer and further;
//   one reads on and does not look up; one is turned to the armillary, its
//   back to the reader (finale.js). (One more was the reader who had stopped
//   on the Silence's terrace, sitting on the same stool: not liked, 2026-10-12,
//   and taken out.)
// 5 "Skip to the map" stood in the corner of every frame for thirty-four
//   seconds, the rise included. It sinks to a trace after three, and comes
//   back when the pointer moves or the screen is touched (EntryMap.jsx).
//
// ?wfin6=old puts all of them back as they were; ?wfin6=old:1,4 only those.
// ?wfinclose=a|b|c: which way out of the close-up (1).
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wfin6');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const fin6Old = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// (how much of the page's light the face of the one seen from the side takes: FACE, below)
const FACE_SIDE = qn('wffside', 3.2);

// 1. The close-up: which way out of it, or null for the close-up as it was.
const PICK = Q.get('wfinclose');
export const CLOSE = fin6Old(1) ? null : ['a', 'b', 'c'].includes(PICK) ? PICK : null;
// a. `round`: how far round from the way to the heart the other comes to
// stand, seen from where the reader stops, and `out` how far off; `step`: the
// last pace of its way there, toward the heart; `turn`: how far it is turned
// from the heart toward the reader (degrees: at 46 the hood hid the whole
// face; from about 64 the nose, the lips and the chin stand out of it in
// profile; past 74 it is nearly face to face again); `across`: where across the frame
// it is put (0 the middle, 1 the right edge), `high`: how far above the ground
// the eye is turned to, there; `rim`: the heart as a light along its edges —
// how strong, the distance it halves over, its colour.
// b. `behind`: how far behind the reader it stands (it was 6); `low`: how far
// below its own height the eye is turned, to have the book in the frame;
// `lamp`: the light in the hood, how much stronger than the others' (the page
// is what throws it).
// c. `drift`: how far on the eye goes, in degrees, over the seconds the
// close-up had; `near`: and how far it looks.
// `page`: the open page as a light — how bright it is itself, how much it
// throws on the hands, the chest and the inside of the hood; `face`: how much
// of it the face of the one seen from the side takes (FACE, below — the wash
// the cloth has made an egg of a face: finaleFix.js); `hands`: how much of
// their colour the hands that hold it keep.
export const YOU = {
  a: { round: qn('wfyround', 52), out: qn('wfyout', 12.5), step: 2.4, turn: qn('wfyturn', 68), across: qn('wfyacross', 0.5), high: qn('wfyhigh', 14.2), rim: { k: qn('wfyrim', 2.2), half: 60, color: [1.0, 0.74, 0.42] } },
  b: { behind: qn('wfybehind', 11), low: qn('wfylow', 2.6), lamp: qn('wfylamp', 1) },
  c: { drift: qn('wfydrift', 7), near: 36 },
  page: { glow: qn('wfpage', 1.5), lamp: qn('wfpagelamp', 1.3), face: FACE_SIDE, hands: qn('wfhands', 0.55) },
};

// 1, again (2026-10-12: "I like option A, just refine the face"). Close to, a
// face in one of these hoods was a smooth egg with a warm patch on its chin:
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
  on: !fin6Old(1), rows: 84, cols: 72,
  wrap: qn('wffwrap', 0.12), gamma: qn('wffgamma', 1.5), reach: [qn('wffr0', 0.5), qn('wffr1', 1.3)], edge: [-0.2, 0.25], k: qn('wffk', 0.85), fore: qn('wfffore', 0.9),
  side: { k: FACE_SIDE, gamma: qn('wffsg', 1.6) },
};

// 1, a third time (2026-10-12). a was not liked — one standing too close,
// reading, its hands on the book "horrific" — and the close-up is face to face
// again, as it was. A face modelled and lit inside the hood was tried the same
// day and not liked either ("go back to completely hooded figure without a
// distinctive face"; it is not kept). `HOODED`: who it is that stands there,
// four ways (?wfhood=a|b|c|d; the user chose d, 2026-10-12):
// a as it was before any of this: the smooth head, the book, a low warm light
//   on the chin and nothing above it;
// b nobody: the wool, and the dark the hood holds;
// c nobody, and the head bowed: the hood's brow comes down over its opening
//   (a step further off: bowed, the hood comes forward, and at 6 it was the
//   whole frame);
// d nobody, from further off: the whole of the figure, to the hands in its
//   sleeves, between the two lanterns.
// `book`: one open in its hands (then the head is bowed over it); `cut`: how
// it is made (readers.js: `plain` the head as it was, `hollow` no head, `nod`
// how far the head is bowed, in radians); `lamp`: the light in the hood, of
// the others'; `back`: how far behind the reader it comes to stand.
const HOOD_PICK = Q.get('wfhood');
const HOODS = {
  a: { book: true, cut: { plain: true }, lamp: 1, back: 6 },
  b: { book: false, cut: { hollow: true }, lamp: 0, back: 6 },
  c: { book: false, cut: { hollow: true, nod: qn('wfhnod', 0.3) }, lamp: 0, back: qn('wfhcback', 8.5) },
  d: { book: false, cut: { hollow: true }, lamp: 0, back: qn('wfhback', 10) },
};
export const HOODED = fin6Old(1) || CLOSE ? null : { kind: HOODS[HOOD_PICK] ? HOOD_PICK : 'd', ...(HOODS[HOOD_PICK] ?? HOODS.d) };

// 4. The others. For each: the gate it comes in by and how many cells up that
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

// 3. The ending, on the map. The line is held alone for `hold` ms; the
// colophon comes in, and after `then` ms the ways on.
export const ENDING = { hold: qn('wfehold', 6500), then: qn('wfethen', 3500) };

// 5. The way out of the film: `after` ms without a hand on anything it sinks
// to a trace (map.css, .room-skip.is-trace).
export const SKIP = { after: qn('wfskip', 3000) };
