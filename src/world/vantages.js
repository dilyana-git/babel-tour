// Names and copy for places the reader can climb to within a room.
// Kept separate from the world builder so the map can load before its geometry.
export const VANTAGES = {
  // From the floor, the Echo's flights are seen end-on. Their crossing only
  // reads from the crown where they meet, so that is its second place to stand.
  1: {
    name: 'the crossing',
    up: 'The crossing',
    down: 'The floor',
    climbing: 'Climbing to the crossing…',
    descending: 'Coming down to the floor…',
    standing: 'You are on the crown, where the two flights cross — one stair running out from under your feet, the other down behind you, and the arcades standing level with the eye.',
  },
};
