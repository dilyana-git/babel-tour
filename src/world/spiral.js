import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPIRAL = Object.freeze({ drop: 440, turns: 3.8, steps: 210, depth: 460, mouth: 68, neck: 50, width: 15 });
const TAU = Math.PI * 2;
const pitch = SPIRAL.drop / SPIRAL.turns;
const phase0 = THREE.MathUtils.degToRad(170);

export function spiralAt(center, t) {
  const y = 4 - t * SPIRAL.drop;
  const outer = SPIRAL.mouth + (SPIRAL.neck - SPIRAL.mouth) * ((6 - Math.max(y, 4 - SPIRAL.drop)) / SPIRAL.depth);
  const angle = phase0 + t * SPIRAL.turns * TAU, radius = outer - SPIRAL.width / 2 - 1;
  return { p: [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius],
    tread: y + 1.5, a: angle * 180 / Math.PI, edge: outer - SPIRAL.width - 1, radius, outer };
}

export function railIntent(feet, gaze, center) {
  const stair = spiralAt(center, (5.5 - feet.y) / SPIRAL.drop);
  const x = center[0] - feet.x, z = center[1] - feet.z, radius = Math.hypot(x, z);
  const horizontal = Math.hypot(gaze.x, gaze.z);
  return feet.y < 5 && radius >= stair.edge - 2 && radius < stair.edge + 10
    && gaze.y < -0.55 && horizontal > 0.1 && (x * gaze.x + z * gaze.z) / (radius * horizontal) > 0.7;
}

// A fixed pool of complete turns keeps both rendered stone and collision
// geometry around the visitor. Position continues downward; no camera reset,
// teleport, growing scene graph, or diagnostic-only progress counter.
// `rail` (optional): one turn of the stair's own rail, given the turn's
// { edge, pitch, angle0 } and returning [geometry, material, name] for each
// of its parts in the turn's frame; without it, a plain bronze rod on posts.
export function makeEndlessSpiral(center, { stone, bronze, books, rail = null }) {
  const root = new THREE.Group();
  const start = spiralAt(center, 1), top = 4 - SPIRAL.drop;
  const angle0 = THREE.MathUtils.degToRad(start.a), steps = 56;
  const pieces = [], posts = [];
  const railPoints = [];
  for (let s = 0; s < steps; s++) {
    const angle = angle0 + s / steps * TAU, y = -s / steps * pitch;
    pieces.push(new THREE.BoxGeometry(SPIRAL.width, 3, TAU * start.radius / steps * 1.12)
      .rotateY(-angle).translate(Math.cos(angle) * start.radius, y, Math.sin(angle) * start.radius));
    posts.push(new THREE.CylinderGeometry(0.3, 0.3, 10.5, 6)
      .translate(Math.cos(angle) * (start.edge - 0.9), y + 6.2, Math.sin(angle) * (start.edge - 0.9)));
  }
  for (let s = 0; s <= steps * 3; s++) {
    const u = s / (steps * 3), angle = angle0 + u * TAU;
    railPoints.push(new THREE.Vector3(Math.cos(angle) * (start.edge - 0.9), 12 - u * pitch, Math.sin(angle) * (start.edge - 0.9)));
  }
  const treadGeo = mergeGeometries(pieces), postGeo = mergeGeometries(posts);
  [...pieces, ...posts].forEach(g => g.dispose());
  const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints), steps * 3, 0.6, 6, false);
  const own = rail ? rail({ edge: start.edge, pitch, angle0 }) : null;
  const railParts = own ?? [[postGeo, bronze, 'bronze'], [railGeo, bronze, 'bronze']];
  const wallGeo = new THREE.CylinderGeometry(start.outer + 5, start.outer + 5, pitch, 64, 1, true).translate(0, -pitch / 2, 0);
  const wallMat = books.clone();
  wallMat.side = THREE.BackSide;
  wallMat.vertexColors = false;
  wallMat.emissive.set('#a87742');
  wallMat.emissiveIntensity = 0.25;
  const turns = Array.from({ length: 8 }, (_, k) => {
    const group = new THREE.Group();
    for (const [geometry, material, name] of [[treadGeo, stone, 'step'], ...railParts, [wallGeo, wallMat, 'spiralBooks']]) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.userData.spiral = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    root.add(group);
    return { group, index: k };
  });
  const update = y => {
    const first = Math.max(0, Math.floor((top - y) / pitch) - 2);
    let changed = false;
    for (let j = 0; j < turns.length; j++) {
      const index = first + j, slot = turns[index % turns.length];
      if (slot.index !== index || !slot.placed) {
        slot.index = index; slot.placed = true;
        slot.group.position.set(center[0], top - index * pitch, center[1]);
        changed = true;
      }
    }
    if (changed) root.updateMatrixWorld(true);
    return changed;
  };
  update(0);
  return { root, update, pitch,
    // The angle locates the feet within a turn; height selects the turn.
    aim(feet, direction = 1) {
      const raw = Math.atan2(feet.z - center[1], feet.x - center[0]) - phase0;
      const estimated = (5.5 - feet.y) / pitch;
      const turn = raw / TAU + Math.round(estimated - raw / TAU);
      return spiralAt(center, (turn + direction * 0.025) / SPIRAL.turns);
    },
    dispose() { [treadGeo, postGeo, railGeo, wallGeo, ...(own ?? []).map(([g]) => g)].forEach(g => g.dispose()); wallMat.dispose(); },
  };
}
