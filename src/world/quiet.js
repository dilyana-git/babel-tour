// ── When the background may work ─────────────────────────────────────────────
// 2026-10-16 the reader: "when I am on the map after it is loaded, it freezes
// for a second and the flight from the map into the room is choppy". What
// was left to do once the world was up (the storeys under the wells,
// wellsBelow.js; the feet's trees, body.js) began the moment the map was
// live, so its compiles and uploads landed on the map and on the flight in:
// the two moments the eye is moving over the whole world. It waits now
// until the reader stands in a room, and stops again while they move.
//
// LiveWorld (World.jsx) says each frame whether the eye is still in a room;
// the Governor does not judge a window while `busy` (the work's own hitches
// are not the machine being slow).
export const QUIET = { since: Infinity, busy: 0 };

// in a room, the eye unmoved, for `ms`
export const stillFor = (ms) => performance.now() - QUIET.since >= ms;
