// What the design board on the phone (2026-10-09, board 14, "In the hand")
// marked REFINE, where it is in the world and its camera — the points by the
// board's own numbers (the rest of that board is the page's: EntryMap.jsx,
// Assembly.jsx and map.css, under `.is-tall`):
// 3  the map was a thumbnail. Its stage was a 1440 × 900 strip (244 px tall
//    on a 390 × 844 screen) and the walk lay nearly flat across it, so the
//    width was all it used: rooms 46 px across, the garden's three in one
//    knot. The stage is half the screen now (map.css), and on it the map's
//    camera is turned to look along the walk (plan.js, yawFor), which then
//    climbs from the bottom left corner to the garden in the top right and is
//    fitted to the stage's diagonal: half as large again.
// 8  standing in a room, a tall screen saw a slot of it. The lens is set by
//    its height (58°), so upright a phone was given 29° across where a
//    laptop has 89°: in the Pavilion, two columns and the lantern, and none
//    of the water or the bridge that make it the Pavilion. A tall screen's
//    lens opens until it sees TALL_VIEW.across from side to side (and no
//    wider than TALL_VIEW.most from top to bottom) — the step back the board
//    asked for, taken with the lens, since behind most stands there is a wall.
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
