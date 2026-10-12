// The phone at 390 × 844 (2026-10-11, audit III, board 7): the walk button
// (2), the writing on a phone (3), the map's ink (4), the text at the bottom
// (5).
// What each point was, and why: docs/design-history.md.
//
// ?wphone7=old puts all four back as they were; ?wphone7=old:2,4 only those.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const V = Q.get('wphone7');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map((s) => s.trim())) : null;
export const phone7Old = (n) => V === 'old' || (ONLY ? ONLY.has(String(n)) : false);
// (for the stylesheet: the points put back, as .entry-map's data-phone-old)
export const PHONE_OLD = [2, 3, 4, 5].filter(phone7Old).join(' ');

// 3. The caption's pace on a tall screen, in ms: how long the room's name
// stands before its first line surfaces, how long it stands between two
// lines, and how long the reader has to have stood still, after walking,
// before the next.
export const VOICE_PACE = { first: 4500, rest: 12000, still: 5000 };

// 5. How long the kicker and the subtitle stay, on arriving and after a touch.
export const HEAD_MS = 4500;

// 4. The map on a tall screen. `fine`: what the kept drawing keeps of its
// lines where they are hairlines (ink.js draws a cell's lines 0.6 px wide at
// this size and 2.2 px on a desk; LOOKS' own `lines` is for those), `under`
// and `over` the widths between which the one gives way to the other.
// `lantern`: how much wider the light round the walk is cut, by the room's
// own size on the screen. `veil`: how far everything else is dimmed.
export const MAP_TALL = { fine: 0.74, under: 0.75, over: 1.7, lantern: 2, veil: 0.5 };
