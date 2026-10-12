// The ending, reviewed 2026-10-09 (board 13 of the second audit; the numbers
// are the board's own). The idea was right and the armillary waking (1) is
// kept as it was; the pictures on the way were less sure than the idea:
// 2 the flood was a screensaver: hundreds of round dots of one size and one
//   yellow-green, spread evenly over the frame. A third as many now; each as
//   large as its distance makes it, and more than that — the near ones wide
//   and soft, out of focus, the far ones points; gold by the armillary and
//   paling outward; of uneven brightness; and over the heart they rise in a
//   slow column, where they had hung everywhere at once (finale.js).
// 3 as the others gathered, half the frame was hedge: the film is watched from
//   wherever the reader stood when it began, and from the stand that is a
//   corridor, the court seen through its mouth — turned toward the west gate,
//   the eye looked at the corridor's own wall. The reader takes the step in
//   that the caption says they take, as far as the mouth of the gate, and the
//   eye is turned only until the armillary stands on the left third, the
//   others to its right and the hedge a wing at the frame's edge (World.jsx,
//   finaleMove). The one behind is brought as far forward, so it is as near
//   as it was.
// 4 the other's hood was plastic: one smooth even tan with a soft sheen, the
//   inside of its edge a pale band round the opening like a tyre, and the
//   opening one flat black. The others' wool is woven now, and matt but for
//   its fuzz at the edges; the cowl hangs in folds to its hem; the hem is
//   thin, turned in, and frayed; and inside the hood there is a low warm
//   light, as from the reader's own lamp, on the brow and the nose and the
//   chin of whoever is in it (readers.js, `close`, and clothShader).
// 5 the rise over the lit maze was right, and snowed on: the glitter over it
//   was twice too dense and of one brightness. It is halved (2), and it goes
//   out as the eye rises, so that the last thing seen is the lit path.
//
// ?wfin=old puts all of them back as they were; ?wfin=old:2,4 only those.
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wfin');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const finaleOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// 2. The flood. `maze`: how many hang over the maze's ways ([as built, on a
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

// 5. The rise: the motes go out between these seconds after it begins, down
// to `rest` of themselves — which is what of them is left over the map.
export const RISE = { fade: [qn('wfrise0', 2.2), qn('wfrise1', 7.5)], rest: qn('wfrest', 0) };

// 3. The step in. `to`: how far from the heart, along the way in, the reader
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

// 4. The hood, close to. `fold`: how much deeper the cowl's and the mantle's
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
// itself as a black egg), `wool` times over: the dye is dark. `weave`: the wool's ribs, how many to a unit and how deep; `fleck`
// how uneven its dye; `matt` how much of the smooth shine is taken off it.
export const HOOD = {
  fold: qn('wfhfold', 2.4),
  hem: [[0.012, 0.975, 0.5], [0.04, 0.95, 0.8], [0.1, 0.92, 0.93], [0.2, 0.88, 0.97], [0.36, 0.83, 0.985], [0.55, 0.8, 0.99], [0.6875, 0.8, 0.99], [0.8125, 0.8, 0.99], [0.875, 0.8, 0.99], [0.9375, 0.8, 0.99], [1, 0.8, 0.99]],
  lining: 0.62,
  fray: [0.03, 0.11], threads: 64,
  lamp: { at: [0, -2.1, 1.35], k: qn('wfhlamp', 4.5), half: 2.2, color: [1.0, 0.7, 0.4], face: qn('wfhface', 0.5), reach: [0.6, 1.2], cloth: [0.85, 1.5], wool: qn('wfhwool', 1.7) },
  weave: [qn('wfhweave', 26), qn('wfhrib', 0.5)], fleck: qn('wfhfleck', 0.2), matt: qn('wfhmatt', 0.92),
};
