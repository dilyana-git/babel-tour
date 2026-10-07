// ── The plan ─────────────────────────────────────────────────────────────────
// The map's resting camera, and the honeycomb it looks down on, as plain
// numbers: what World.jsx frames the map with, and what the opening
// (Assembly.jsx) draws the Library with before the world exists. It lives
// apart from World.jsx because the opening draws from the first frame the
// page has, long before the world's own chunk has arrived, and the ink only
// turns into the stone if both are looking through the same lens.
import * as THREE from 'three';

export const TILT_ELEVATION = 52 * (Math.PI / 180);
export const TILT_FOV = 30;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export const placeTilted = (cam, d, target) => {
  cam.position.set(target.x, target.y + Math.sin(TILT_ELEVATION) * d, target.z + Math.cos(TILT_ELEVATION) * d);
  cam.up.copy(WORLD_UP);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
};

// Everything the map has to show — every room, the walk, the garden's paths —
// framed inside the window with a margin, as close as the tilt allows. Past
// those points the honeycomb and the stars carry on to every edge.
// With the room card on the left of a wide window, the frame is shifted right
// by a lens offset (not by moving the camera, which would change the view).
const BOUNDS = { right: 0.92, top: 0.84, bottom: -0.86 };
export const restPose = (aspect, points, reserveLeft) => {
  const cam = new THREE.PerspectiveCamera(TILT_FOV, aspect, 1, 1e6);
  const box = new THREE.Box3().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const target = box.getCenter(new THREE.Vector3());
  target.y = 40;
  const left = reserveLeft ? -0.5 : -0.9;
  const shift = (left + BOUNDS.right) / 4; // as a fraction of the width
  const fullW = 1000, fullH = 1000 / aspect;
  cam.setViewOffset(fullW, fullH, -shift * fullW, 0, fullW, fullH);
  const v = new THREE.Vector3();
  const fits = (d) => {
    placeTilted(cam, d, target);
    for (const [x, y, z] of points) {
      v.set(x, y, z).project(cam);
      if (v.z > 1 || v.x < left || v.x > BOUNDS.right || v.y > BOUNDS.top || v.y < BOUNDS.bottom) return false;
    }
    return true;
  };
  let lo = 300, hi = 60000;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid; else lo = mid;
  }
  placeTilted(cam, hi, target);
  return { position: cam.position.clone(), quaternion: cam.quaternion.clone(), distance: hi, camera: cam, shift, target };
};

// What the resting camera frames: every room, the walk and the garden paths.
export const framePointsOf = (overlay) => [
  ...overlay.rooms.flat(), ...overlay.walk, ...overlay.gardenWalk, ...overlay.mazeLeg,
];
