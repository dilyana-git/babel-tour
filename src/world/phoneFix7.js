// What the design board on the phone (2026-10-11, audit III, board 7) marked
// FIX and REFINE, at 390 × 844 with a thumb — the points by the board's own
// numbers (1, the tall layout itself, it marked KEEP):
// 2  the walk button sat on the subject. The ringed arrow and "Drag to look ·
//    Hold to walk" stood centred two thirds of the way down the screen: on the
//    Door's opening, on the Pavilion's lamp and table, on the Echo's stair —
//    where each picture has its point. The button is on the bottom edge now,
//    in the walk's own line between the way back and the seal, where a thumb
//    rests (the way on has the line above to itself, and the way back says
//    only where to: "the Vertigo"). The sentence is there until the first
//    walk and does not come back when the reader stands still: the button it
//    explained is under their thumb.
// 3  half the writing was missing. On a phone the room's line and every
//    quotation were not shown at all: there for a screen reader, absent for
//    the eye, and the words are half of this piece. They surface in the
//    caption's own place, one at a time, in place of the room's name — a few
//    seconds after arriving, and again each time the reader has stood still a
//    while — and the name comes back between them. Nothing moves to make room
//    for them. On the way between two rooms the road's line is there as it is
//    on a wide screen.
// 4  the map was nearly black. The board left it to what was decided for the
//    hand-over (mapFix3.js, 2: the ink is kept, faint, on the unwalked cells),
//    and that decision is carried to this size: a cell 80 px across is drawn
//    in hairlines, which hold half the ink a 200 px cell's lines do, so the
//    kept drawing is stronger where its lines are fine; and the lantern lights
//    more of the stone round the walk, which at this size was a seam.
// 5  the bottom quarter was permanent text. Kicker, name, subtitle and two
//    ways, for as long as the reader stood there. The kicker and the subtitle
//    are there on arriving and sink away after a few seconds, leaving the name
//    and the ways. A touch on the name brings them back; another turns to the
//    room's next line.
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
