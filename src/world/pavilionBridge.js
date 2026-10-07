import * as THREE from 'three';
import { makeWalkCurve } from './walkPath.js';

// The original zigzag footprints. Navigation rounds the walking line inside
// the existing deck; it never moves the deck, rails, bays or steps.
export const PAVILION = [1305, 110];
export const PAVILION_BRIDGE = [[1238, 196], [1262, 186], [1252, 166], [1276, 156], [1285, 137]];
export const PAVILION_NORTH_BRIDGE = [[1310, 10], [1298, 38], [1306, 63]];
export const PAVILION_BRIDGE_HALF_WIDTH = 8.4;

// Continue along the bridge's axis through its stone step and threshold,
// then centre the feet in the open bay, away from its two columns.
// Coordinates are eye points, as used by the world's walking legs.
export function pavilionLanding(bridge, eyeHeight = 15) {
  const a = bridge.at(-2), b = bridge.at(-1);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const t = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const bearing = Math.atan2(b[1] - PAVILION[1], b[0] - PAVILION[0]) * 180 / Math.PI;
  const bay = Math.floor(((bearing + 337.5 + 360) % 360) / 45);
  const angle = (45 + bay * 45) * Math.PI / 180;
  const face = [Math.cos(angle), Math.sin(angle)];
  const radius = (b[0] - PAVILION[0]) * face[0] + (b[1] - PAVILION[1]) * face[1];
  const dot = t[0] * face[0] + t[1] * face[1];
  return [[36, 8.6], [32.4, 10.35], [29.5, 13], [20.5, 12.1]].map(([reach, floor], i) => {
    // Extending the north bridge's diagonal straight into the room lands
    // beside a column. Turn into the bay once the threshold is behind us.
    if (i === 3) return [PAVILION[0] + face[0] * reach, floor + eyeHeight, PAVILION[1] + face[1] * reach];
    const u = (reach - radius) / dot;
    return [b[0] + t[0] * u, floor + eyeHeight, b[1] + t[1] * u];
  });
}

export function pavilionCrossing(bridge, eyeHeight = 15) {
  const landing = pavilionLanding(bridge, eyeHeight);
  const deck = [...bridge.slice(0, -1).map(([x, z]) => [x, 8.6 + eyeHeight, z]), landing[0]];
  const curve = makeWalkCurve(deck.map(p => new THREE.Vector3(...p)), 5);
  return [...curve.getSpacedPoints(Math.ceil(curve.getLength())).map(p => p.toArray()), ...landing.slice(1)];
}

// A continuous walk through the room, around the table rather than into it.
// The return uses the other side of the room, so neither arrival becomes an
// about-turn on the Pavilion's threshold.
export function pavilionInterior(from, to, eyeHeight = 15) {
  const start = Math.atan2(from[2] - PAVILION[1], from[0] - PAVILION[0]);
  let end = Math.atan2(to[2] - PAVILION[1], to[0] - PAVILION[0]);
  while (end <= start) end += Math.PI * 2;
  const arc = [];
  // Leave room for the bay's diagonal approach at either end. Radius 19.5
  // clears the table, cushion, columns and seats with the existing body size.
  for (let angle = start + Math.PI / 12; angle < end - Math.PI / 12; angle += Math.PI / 36) {
    arc.push([PAVILION[0] + Math.cos(angle) * 19.5, 12.1 + eyeHeight, PAVILION[1] + Math.sin(angle) * 19.5]);
  }
  return [from, ...arc, to];
}
