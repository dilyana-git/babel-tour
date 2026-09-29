// Metres, with the visitor's feet on y=0. These match Balcony's physical meshes.
export const EYE_HEIGHT = 1.65;
export const START = { x: 0, z: 1.5, yaw: 0, pitch: 0.02 };
export const PILLARS = [-3.15, 3.15].map(x => ({ x, z: -2.9, radius: 0.64 }));
const RADIUS = 0.24;
const OBSTACLES = [
  ...PILLARS,
  { x: 3.85, z: -3.55, radius: 0.55 }, // reading stand
];

function clear(x, z) {
  if (x < -4.75 || x > 4.75 || z < -4.15 || z > 4.35) return false;
  // Bookcases project from the side walls.
  if (Math.abs(x) > 4.3 && z > -0.6 && z < 3.65) return false;
  return OBSTACLES.every(o => Math.hypot(x - o.x, z - o.z) >= o.radius + RADIUS);
}

// Small substeps prevent tunnelling during a long frame. Resolve the axes
// independently so the visitor slides along a wall rather than sticking to it.
export function moveVisitor(position, dx, dz) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  let { x, z } = position;
  for (let i = 0; i < steps; i++) {
    if (clear(x + dx / steps, z)) x += dx / steps;
    if (clear(x, z + dz / steps)) z += dz / steps;
  }
  return { x, z };
}

export function nearbyObject({ x, z }) {
  if (Math.hypot(x - 3.85, z + 3.55) < 1.65) return 'book';
  if (Math.abs(x) < 1.25 && z > 2.8) return 'door';
  return null;
}
