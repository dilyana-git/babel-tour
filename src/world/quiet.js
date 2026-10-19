// Deferred world preparation runs only while the reader is still in a room.
// The governor discards windows marked busy so that preparation costs do not
// lower rendering quality.
export const QUIET = { since: Infinity, busy: 0 };

// In a room with the eye unmoved for `ms`.
export const stillFor = (ms) => performance.now() - QUIET.since >= ms;
