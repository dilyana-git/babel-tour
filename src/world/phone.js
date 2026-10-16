// A tall screen: the map's stage and turn, what a room shows across it, and
// the caption's pace.
// How far the map's camera is turned on a tall screen, by the shape of its
// stage (width over height): looking well along the walk on a stage about as
// tall as it is wide (a phone's), less on a wider one (a tablet upright, a
// short phone), where the walk has less height to climb into. Each is the turn
// that draws the map largest on that shape, to a degree or two.
export const TALL_MAP = { narrow: 0.92, yawNarrow: -32, wide: 1.5, yawWide: -11 };

// Degrees: what a tall screen is shown from side to side in a room, and the
// most its lens may open from top to bottom to show it.
export const TALL_VIEW = { across: 40, most: 76 };

const half = (deg) => Math.tan((deg * Math.PI) / 360);

// The lens for a frame of this shape: `fov` as the piece asks for it (top to
// bottom, composed for a wide screen), opened on a tall one. `eye` is how far
// the camera is down among the walls (0 over the map, whose frame is fitted to
// the screen already and must stay as the overlay was projected). The wider
// lenses the piece asks for itself — leaning over the Vertigo's well, falling
// down it — are opened less, and the widest (`fall`) not at all.
export const tallFov = (fov, aspect, eye = 1, room = 58, fall = 92) => {
  if (aspect >= 1 || eye <= 0) return fov;
  const t = half(fov), tRoom = half(room), tFall = half(fall);
  const open = Math.min(half(TALL_VIEW.across) / aspect, half(TALL_VIEW.most)) - tRoom;
  if (open <= 0) return fov;
  const less = Math.min(1, Math.max(0, (tFall - t) / (tFall - tRoom)));
  return (Math.atan(t + open * less * Math.min(1, eye)) * 360) / Math.PI;
};

// The caption's pace on a tall screen, in ms: how long the room's name
// stands before its first line surfaces, how long it stands between two
// lines, and how long the reader has to have stood still, after walking,
// before the next.
export const VOICE_PACE = { first: 4500, rest: 12000, still: 5000 };

// How long the kicker and the subtitle stay, on arriving and after a touch.
export const HEAD_MS = 4500;

// The map on a tall screen. `fine`: what the kept drawing keeps of its
// lines where they are hairlines (ink.js draws a cell's lines 0.6 px wide at
// this size and 2.2 px on a desk; LOOK's own `lines` is for those), `under`
// and `over` the widths between which the one gives way to the other.
// `lantern`: how much wider the light round the walk is cut, by the room's
// own size on the screen. `veil`: how far everything else is dimmed.
export const MAP_TALL = { fine: 0.74, under: 0.75, over: 1.7, lantern: 2, veil: 0.5 };
