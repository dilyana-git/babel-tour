// The HUD and its type (2026-10-11, audit III, board 2): the subtitle's face
// (1, SUBS below: the user chose a), the caps voice (2), the Vertigo's corner
// (3), the inks (4), the curves and durations (5), the caption's corner kept
// clear (6).
// What each point was, and why: docs/design-history.md.
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
