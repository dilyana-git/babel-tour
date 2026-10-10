// The Fork's props, reviewed 2026-10-09 (board 10 of the second audit; the
// numbers are the board's own). The frame was right and the things in it were
// new from the factory: 1 the moon was an even white disc in a wide halo, a
// lamp in the sky — it has its seas now, a little darker at the limb, ivory,
// and a closer halo; 2 the Pavilion's roof was navy panes between black ribs,
// a conservatory's — it is tiled: grey tile in rolls down every slope, a
// round tile-end on each roll at the eave, the hips rolled, and the corners
// swept up (and 11: they ended in gold balls on black posts, bedknobs; they
// end in the sweep's own curl); 3 the stone the ways part at was a sawn disc
// — a low boulder, weathered, the rake's rings going round its own outline;
// 4 the tōrō were porcelain — granite, grimed under every ledge, damp at the
// foot, lichened; 6 the hedge behind the lanterns was one black stripe — its
// top takes the moon, and clipped finials stand out of it; 7 the cherries
// were the most saturated thing in the night — greyer, fewer flowers, lit
// from above only; 8 the gravel was white speckle on grey — larger, softer
// grains, a little warm; 10 the lawn in the lanterns' light was brown mud —
// it has blades there.
//
// ?wprops=old puts all of them back as they were; ?wprops=old:3,8 only those.
// ?wroof=green|bark: the roof's two other dressings (green-glazed tile; bark
// shingle, without rolls), for looking at beside the grey.
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wprops');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const propsOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
export const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// 1. The moon (sky.js): `k` how bright its highlands are, `seas` how much
// darker its seas, `limb` how much it darkens to its edge, `halo` the corona.
export const MOON = { k: qn('wmoonk2', 1.1), seas: qn('wmoonseas', 0.34), limb: qn('wmoonlimb', 0.4), halo: qn('wmoonhalo', 0.45) };

// 3. The stone the ways part at (shore.js `gardenRock`, a stone to step on):
// `w` by `d` across and `h` deep, `proud` of it over the gravel (under a
// tread's height, and under what the body calls a crest: it is walked over),
// turned by `turn` so that it lies across the view from the stand.
export const FORK_STONE = {
  rock: { w: qn('wfstw', 6.6), h: 2.0, d: qn('wfstd', 4.5), seed: qn('wfstseed', 3371), round: 0.62, cuts: 4, moss: 0.55, lichen: 0.9, tone: 1.12, warm: 0.3 },
  proud: qn('wfstup', 0.85), turn: qn('wfstturn', -1.05),
};

// 7. The cherries at night: the tints their sprays are multiplied by (the
// flowers' own pink is in the atlas: these take the colour out of it and the
// brightness down), the share of sprays left off, and how dark a spray in the
// underside of its crown is beside one on top.
export const BLOSSOM_NIGHT = {
  tints: ['#7f8684', '#8a8d88', '#787f80', '#84847f'],
  drop: qn('wblossomdrop', 0.33), under: qn('wblossomunder', 0.4),
};

// 6. The hedges. A clipped finial is a drum of the same hedge, domed, grown
// through the hedge's line and standing `up` over its top: `r` its radius.
// On the hedge that closes the garden they stand at its turns (`turn`) and
// once along each long run between (`run`); on the maze, either side of its
// mouth and at its four corners (`mouth`). `HEDGE_SHEEN`: the moon on a
// hedge's shoulder and top, `k` of it, from `near` to `far` off — close to,
// a pale band along every top was the first thing wrong with the maze.
export const FINIALS = {
  turn: { r: 7.2, up: qn('wfinialup', 9) }, run: { r: 6.2, up: qn('wfinialup', 9) * 0.6 }, mouth: { r: 6, up: 7.5 },
  longRun: 95,
};
export const HEDGE_SHEEN = { k: qn('whedgesheen', 0.8), near: 70, far: 240 };

// 10. The lawn's blades (lawn.js): how far round a lantern they grow and how
// much of its light they take (`toro`, the stone lanterns; `waymark`, the
// iron one under the waymark's arm), how thick, how tall (a unit is 9.4 cm),
// and how far up from the water the pond's bank keeps them off.
export const LAWN = {
  toro: { reach: qn('wlawnreach', 36), k: qn('wlawnk', 1.2) }, waymark: { reach: 26, k: qn('wlawnk', 1.2) * 0.5 },
  density: qn('wlawndensity', 1), height: qn('wlawnh', 0.62), bank: 13,
};

// 2. The Pavilion's roof (pavilionRoof.js): which dressing — 'grey', tile in
// rolls; 'green', the same glazed; 'bark', shingle without rolls.
export const ROOF_KIND = ['grey', 'green', 'bark'].includes(Q.get('wroof')) ? Q.get('wroof') : 'grey';
