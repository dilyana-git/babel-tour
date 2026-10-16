// The map in motion: its warm light and the unexplored dark follow the eye's
// height on the way down into a room and on the finale's rise, not the veil.
import { MASS_H } from './build/common';

// `warm`: the eye heights the map's warm light eases out between; `dark`, the
// unexplored dark's.
const MAP_MOVE = {
  warm: [MASS_H + 6, MASS_H + 140],
  dark: [MASS_H + 70, MASS_H + 420],
};

const ss = (x, [a, b]) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// How much of the map's dressing the eye at height y still sees.
export const mapMoveAt = (y) => ({ warm: ss(y, MAP_MOVE.warm), dark: ss(y, MAP_MOVE.dark) });
