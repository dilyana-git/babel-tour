// The phone, in the world and its camera (2026-10-09, board 14): the map's
// stage (3) and a tall screen's lens (8).
// What each point was, and why: docs/design-history.md.
//
// ?wphone=old puts both back as they were; ?wphone=old:3 only that one.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const V = Q.get('wphone');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map((s) => s.trim())) : null;
export const phoneOld = (n) => V === 'old' || (ONLY ? ONLY.has(String(n)) : false);

// 3. How far the map's camera is turned on a tall screen, by the shape of its
// stage (width over height): looking well along the walk on a stage about as
// tall as it is wide (a phone's), less on a wider one (a tablet upright, a
// short phone), where the walk has less height to climb into. Each is the turn
// that draws the map largest on that shape, to a degree or two.
export const TALL_MAP = { narrow: 0.92, yawNarrow: -32, wide: 1.5, yawWide: -11 };

// 8. Degrees: what a tall screen is shown from side to side in a room, and the
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
  if (phoneOld(8) || aspect >= 1 || eye <= 0) return fov;
  const t = half(fov), tRoom = half(room), tFall = half(fall);
  const open = Math.min(half(TALL_VIEW.across) / aspect, half(TALL_VIEW.most)) - tRoom;
  if (open <= 0) return fov;
  const less = Math.min(1, Math.max(0, (tFall - t) / (tFall - tRoom)));
  return (Math.atan(t + open * less * Math.min(1, eye)) * 360) / Math.PI;
};
