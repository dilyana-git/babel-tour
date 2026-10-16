// ── The plan ─────────────────────────────────────────────────────────────────
// The map's resting camera, and the honeycomb it looks down on, as plain
// numbers: what World.jsx frames the map with, and what the opening
// (Assembly.jsx) draws the Library with before the world exists. It lives
// apart from World.jsx because the opening draws from the first frame the
// page has, long before the world's own chunk has arrived, and the ink only
// turns into the stone if both are looking through the same lens.
import * as THREE from 'three';
import { TALL_MAP } from './phone';

export const TILT_ELEVATION = 52 * (Math.PI / 180);
export const TILT_FOV = 30;
// Turned a little off due north (the eye to the east of south), so that the
// walk, which climbs north-east from the Vestibule, runs flatter across the
// screen — from the bottom left into the centre right — and the garden it ends
// in is given the right third of the frame instead of its top corner
// (2026-10-09, board 2 · 4).
export const TILT_YAW = 9 * (Math.PI / 180);
// On a tall screen (EntryMap's `.is-tall`: a phone held upright) the map has a
// stage of its own between the title and the caption, about as tall as it is
// wide, and there is no caption over it to keep clear of. The walk laid flat
// across that stage used its width and left half its height to empty
// honeycomb. So there the eye is turned the other way, to look along the walk:
// it climbs from the bottom left corner to the garden in the top right, and
// the frame is fitted to the stage's diagonal (board 14 · 3, phone.js).
export const yawFor = (aspect, tall = false) => {
  if (!tall) return TILT_YAW;
  const { narrow, yawNarrow, wide, yawWide } = TALL_MAP;
  const k = Math.min(1, Math.max(0, (aspect - narrow) / (wide - narrow)));
  return (yawNarrow + (yawWide - yawNarrow) * k) * (Math.PI / 180);
};
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export const placeTilted = (cam, d, target, yaw = TILT_YAW) => {
  const flat = Math.cos(TILT_ELEVATION) * d;
  cam.position.set(target.x + Math.sin(yaw) * flat, target.y + Math.sin(TILT_ELEVATION) * d, target.z + Math.cos(yaw) * flat);
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
// (On a tall screen nothing is laid over the stage, and the margins are its
// own: enough for the outlines' glow at the sides and the foot, and for the
// numerals over the rooms at the top.)
const WIDE_BOUNDS = { right: 0.92, top: 0.84, bottom: -0.86 };
const TALL_BOUNDS = { left: -0.94, right: 0.94, top: 0.84, bottom: -0.92 };
export const restPose = (aspect, points, reserveLeft, tall = false) => {
  const turned = tall;
  const yaw = yawFor(aspect, tall);
  const BOUNDS = turned ? TALL_BOUNDS : WIDE_BOUNDS;
  const cam = new THREE.PerspectiveCamera(TILT_FOV, aspect, 1, 1e6);
  const box = new THREE.Box3().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const target = box.getCenter(new THREE.Vector3());
  target.y = 40;
  const left = turned ? BOUNDS.left : reserveLeft ? -0.5 : -0.9;
  const shift = (left + BOUNDS.right) / 4; // as a fraction of the width
  const fullW = 1000, fullH = 1000 / aspect;
  cam.setViewOffset(fullW, fullH, -shift * fullW, 0, fullW, fullH);
  const v = new THREE.Vector3();
  const fits = (d) => {
    placeTilted(cam, d, target, yaw);
    for (const [x, y, z] of points) {
      v.set(x, y, z).project(cam);
      if (v.z > 1 || v.x < left || v.x > BOUNDS.right || v.y > BOUNDS.top || v.y < BOUNDS.bottom) return false;
    }
    return true;
  };
  const fit = () => {
    let lo = 300, hi = 60000;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid; else lo = mid;
    }
    placeTilted(cam, hi, target, yaw);
    return hi;
  };
  // Aimed at the middle of the points in the world, the frame came to rest
  // against its left and bottom bounds only (the Vestibule's corner), with the
  // garden well short of the right: so the aim is panned until the points sit
  // centred between the left and right bounds on the screen, and on the
  // bottom one — as low as they go, out from under the title and the caption
  // in the top left (centred up and down, the Vestibule and the Echo went in
  // under the caption at 1280 × 720) — and fitted again. (On a tall screen,
  // with nothing over the stage, they are centred up and down as well.)
  let distance = fit();
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  for (let k = 0; k < (4); k++) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y, z] of points) {
      v.set(x, y, z).project(cam);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const halfH = distance * Math.tan((TILT_FOV * Math.PI) / 360), halfW = halfH * aspect;
    right.setFromMatrixColumn(cam.matrixWorld, 0);
    up.setFromMatrixColumn(cam.matrixWorld, 1);
    target.addScaledVector(right, ((x0 + x1 - left - BOUNDS.right) / 2) * halfW)
      .addScaledVector(up, (turned ? (y0 + y1 - BOUNDS.top - BOUNDS.bottom) / 2 : y0 - BOUNDS.bottom) * halfH);
    distance = fit();
  }
  const hi = distance;
  return { position: cam.position.clone(), quaternion: cam.quaternion.clone(), distance: hi, camera: cam, shift, target, yaw };
};

// What the resting camera frames: every room, the walk and the garden paths.
export const framePointsOf = (overlay) => [
  ...overlay.rooms.flat(), ...overlay.walk, ...overlay.gardenWalk, ...overlay.mazeLeg,
];
