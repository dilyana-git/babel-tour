// How the ending comes in (2026-10-12: after the film "the title and the
// subtitle and quote took too much to load and looks like they are stuck to
// the page"). Two things were wrong, and neither was the words:
// - the film's last seconds were held empty on purpose ("the map comes up
//   under nothing"): 2.8 s of film with the camera all but stopped, nothing
//   written anywhere — and the film's clock is the frame's, so at twelve
//   frames a second it was nearer six. Only when the film said it was done did
//   anything begin, 0.2 s later still;
// - and then all of it began on the same frame, as one block: the pool of
//   shadow, the title, the author, the last line, and the lantern's dimming of
//   the whole map under them.
// Now the words begin as the film's last phase does, over a map still drawing
// back, and one after another: the shadow gathers, the hairlines are drawn,
// the title, the author, the walk's last line and where it is from. The map is
// dimmed round the lit walk last, slowly, once the camera has stopped (it is
// drawn for the camera at rest, and may not come before that).
// On a tall screen the film has the whole screen until it is done and the
// title is not on it: there the same sequence begins when the film ends.
//
// ?wendin=a|b|c|d: how the words arrive (map.css, "The ending comes in"). Four
// were shown; the user chose c, 2026-10-12, and the others are kept behind
// the flag.
// a in turn — each fades up where it stands;
// b found — the last line is found among the Library's letters, as the first
//   sentence was while the Library was put together (Assembly.jsx);
// c lit — the light that ran along the walk runs on along the hairline, and
//   the words catch it one at a time and cool to ink;
// d drawn back — the title settles from a wider setting and the line from a
//   little larger, with the camera.
// ?wendin=old: as it was — nothing until the film is done, then all at once.
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wendin');
export const ENDIN = V === 'old' ? null : ['a', 'b', 'c', 'd'].includes(V) ? V : 'c';

// From the entrance's first moment until the last line and its source stand
// whole, in ms (map.css's delays and lengths, added up), and `alone`: how long
// the line is then left by itself before the colophon comes in under it.
export const ENDIN_LINE = { a: 4500, b: 6400, c: 5000, d: 4700 }[ENDIN] ?? 0;
export const ENDIN_ALONE = 4500;

// b. The line, found: when the search begins and how long it takes (ms from
// the entrance's first moment; map.css brings the unsearched letters up just
// before), how often a letter not yet found turns over, and how long a found
// one stays bright.
export const FOUND = { from: 2600, over: 2600, tick: 110, glow: 520 };
