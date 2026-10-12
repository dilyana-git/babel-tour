// What the design board on the HUD and its type (2026-10-11, audit III,
// board 2) marked FIX and REFINE — the points by the board's own numbers:
// 1  the room's subtitle is set in Tangerine at about 26 px: hairlines a pixel
//    wide over a moving scene, a swash capital that takes a beat to decode,
//    and the one face here that says stationery, not library. The board asked
//    for options first, and there were four (SUBS, below). The user chose a:
//    the name's own italic, Cormorant Garamond, at half the name's size.
// 2  four families for forty words. The mono is right in the opening, where
//    "HEXAGON 967,168 · SHELF 2" is the catalogue speaking; over every room,
//    as the kicker and the caption's source, it was a 2017 corporate face in a
//    1941 library. Those are set in Cormorant SC, letterspaced — the title's
//    voice — and the mono is left to the opening (map.css, `--caps`).
// 3  the Vertigo is the one room whose brightest area is bottom right: the
//    corner's pool of shadow ran out before it reached "fall into", set small
//    at 72 per cent ink over lit spines. The pool reaches further left in that
//    room and holds more of its dark, and the verb is in full ink there.
// 4  one ink in thirteen strengths, ten warm whites, three darks at eight
//    alphas: drift, not decisions. map.css names four steps of ink, three
//    shades and three lamp whites beside the gold and the jade, and nothing
//    else. (No flag: it is the same page.)
// 5  fourteen durations, nearly all on the browser's default curve. One curve
//    for what arrives (a long settle, a lamp coming up), one for what leaves,
//    three durations (map.css, `--arrive`, `--leave`, `--t-*`). `old` puts the
//    default curve back; the durations stay.
// 6  the first room's name was set over a reader: one of the file on the
//    Vestibule's bridge, stopped at the rail in the corner of the frame the
//    caption is in, half out of it. The corner the caption stands in is kept
//    like the frame's edges are (walkers.js): nobody in it on arrival, and
//    nobody stops in it, or across an edge, at any time.
//
// ?whud3=old puts 2, 3, 5 and 6 back as they were; ?whud3=old:3,6 only those.
// ?whudsub=b|c|d puts one of the other three subtitles (1) in a's place; `off`
// is the script as it was.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const V = Q.get('whud3');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map((s) => s.trim())) : null;
export const hud3Old = (n) => V === 'old' || (ONLY ? ONLY.has(String(n)) : false);
// (for the stylesheet: the points put back, as .entry-map's data-hud-old)
export const HUD_OLD = [2, 3, 5].filter(hud3Old).join(' ');

// 1. The subtitle, four ways (map.css, [data-sub]): `href` the face to fetch
// for it, where the page does not already have it.
//   a  Cormorant Garamond italic, the name's own face, at the script's size on
//      the page
//   b  Tangerine Bold: the hand it is in now, with strokes that hold
//   c  Quintessential: a chancery italic with real weight
//   d  IM Fell DW Pica italic: a printer's italic out of an old book
const TANGERINE = 'https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&display=swap';
export const SUBS = {
  a: {},
  b: { href: TANGERINE },
  off: { href: TANGERINE },
  c: { href: 'https://fonts.googleapis.com/css2?family=Quintessential&display=swap' },
  d: { href: 'https://fonts.googleapis.com/css2?family=IM+Fell+DW+Pica:ital@1&display=swap' },
};
// The user's pick, from the canvas of the four (2026-10-11): a, which is what
// map.css sets with nothing asked of it. SUB is another way asked for by name
// (.entry-map's data-sub), else null.
const ASKED = Q.get('whudsub');
export const SUB = ASKED === 'off' || (ASKED !== 'a' && SUBS[ASKED]) ? ASKED : null;
if (SUB && SUBS[SUB]?.href && typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = SUBS[SUB].href;
  document.head.append(link);
}

// 6. The caption's corner of the Vestibule's first frame, in CSS pixels from
// the screen's bottom left: as far right as the room's name and its subtitle
// run, from the rule over the summary up to the kicker. (Not on a tall screen:
// the caption is across the whole foot of it there, on a shade of its own.)
export const CAPTION = { right: 380, foot: 150, head: 318 };
