// Shared ground coordinates for the garden, its routes, lighting and map.
// The ways' gravel lies flush with the lawn (whose top is 4), a hair over it.
// A slab 1.2 proud of the grass with a sheer side read as a boardwalk.
export const GRAVEL_TOP = 4.06;
export const FORK = [1186, 236];
// How far out in the garden a point is, 0 among the walls to 1 out under the
// moon, across the Library's garden wall (World.jsx eases the light, the fog
// and the print between the two by it, for where the eye stands).
export const gardenness = (x, z) => {
  const t = Math.min(1, Math.max(0, ((x - 720) * 0.889 + 20 - z + 60) / 140));
  return t * t * (3 - 2 * t);
};
export const POND = { c: [1300, -174], rx: 148, rz: 112 };
export const PAVILION = [1305, -182];
export const BRIDGE = [[1214, -70], [1262, -106], [1252, -126], [1276, -136], [1285, -155]];
export const NORTH_BRIDGE = [[1312, -309], [1298, -254], [1306, -229]];
export const SHORE = BRIDGE[0];
export const MAZE = { x0: 1240, z0: 195, cols: 8, rows: 7, cw: 30, ch: 30 };
export const MAZE_SEED = -923889612;
export const FORK_VIEW = { yaw: 315, postBearing: 306, postDistance: 40 };
export const MAZE_ENTRY = [MAZE.x0 + 4.5 * MAZE.cw, MAZE.z0];
export const HEART = [MAZE_ENTRY[0], MAZE.z0 + 3.5 * MAZE.ch];
export const MAZE_BOUNDS = { x0: MAZE.x0 - 10, z0: MAZE.z0 - 13,
  x1: MAZE.x0 + MAZE.cols * MAZE.cw + 10, z1: MAZE.z0 + MAZE.rows * MAZE.ch + 7 };
export const MAZE_OUTLINE = [[MAZE_BOUNDS.x0, MAZE_BOUNDS.z0], [MAZE_BOUNDS.x1, MAZE_BOUNDS.z0],
  [MAZE_BOUNDS.x1, MAZE_BOUNDS.z1], [MAZE_BOUNDS.x0, MAZE_BOUNDS.z1]];

// The approach ends along the bridge's axis, clear of its step and side rail.
export const PAVILION_PATH = [FORK, [1184, 120], [1178, 20], [1189, -34], [1191.6, -53.2], SHORE];
export const MAZE_PATH = [[1375, 145], [MAZE_ENTRY[0], MAZE_ENTRY[1] - 4]];
export const SHORE_PATH = [[1202.8, -61.6], [1218, -46], [1245, -37], [1292, -32],
  [1333, -9], [1345, 37], [1350, 92], MAZE_PATH[0]];
export const FORK_TO_MAZE = [FORK, [1207, 191], [1240, 155], [1310, 139], MAZE_PATH[0]];

export function gardenWalks(gate, pergola) {
  return [
    [gate, pergola, ...PAVILION_PATH, ...BRIDGE.slice(1), PAVILION],
    [SHORE, ...SHORE_PATH, ...MAZE_PATH.slice(1), MAZE_ENTRY],
  ];
}

export const LANTERNS = [
  { at: [1201, 262], toward: FORK },
  { at: [1170, 56], toward: PAVILION_PATH[2] },
  { at: [1252, -20], toward: SHORE_PATH[2] },
  { at: [1389, 143], toward: MAZE_PATH[0] },
];
export const BOUNDARY = [[865, 140], [985, 70], [1010, -100], [1100, -300], [1240, -370],
  [1370, -355], [1460, -260], [1515, -150], [1560, 100], [1562, 300], [1520, 455],
  [1455, 572], [1262, 592]];
