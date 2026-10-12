// Passive measurements. These helpers neither move the visitor nor replace
// the application's movement controller with a test implementation.
export const flatDistance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export function gazeAngle(a, b) {
  const length = Math.hypot(...a) * Math.hypot(...b);
  if (!Number.isFinite(length) || !length) throw new Error('Rendered gaze vectors must be finite and nonzero');
  return Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, v, i) => sum + v * b[i], 0) / length)));
}
export const headYaw = (base, gaze) => Math.atan2(base[1] * gaze[0] - base[0] * gaze[2], base[0] * gaze[0] + base[1] * gaze[2]);
export const progressDelta = (before, after, beforeOrigin, afterOrigin) => ({
  walked: after.distanceWalked >= before.distanceWalked ? after.distanceWalked - before.distanceWalked : after.distanceWalked,
  descended: (before.feet[1] - beforeOrigin[1]) - (after.feet[1] - afterOrigin[1]),
});

export function nearestRoute(eye, routes, heightTolerance = 7) {
  let best = null;
  routes.forEach((route, line) => {
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i], dx = b[0] - a[0], dz = b[2] - a[2];
      const lengthSq = dx * dx + dz * dz;
      if (!lengthSq) continue;
      const t = Math.max(0, Math.min(1, ((eye[0] - a[0]) * dx + (eye[2] - a[2]) * dz) / lengthSq));
      const point = [a[0] + dx * t, a[1] + (b[1] - a[1]) * t, a[2] + dz * t];
      if (Math.abs(eye[1] - point[1]) > heightTolerance) continue;
      const distance = flatDistance(eye, point);
      if (!best || distance < best.distance) best = { line, segment: i - 1, point, distance, direction: [dx / Math.sqrt(lengthSq), dz / Math.sqrt(lengthSq)] };
    }
  });
  return best;
}

export async function startRecording(driver) {
  await driver.executeScript(() => {
    window.__navigationRecording?.stop();
    const frames = [], recording = { frames, truncated: false, stop: () => { running = false; cancelAnimationFrame(id); } };
    let running = true, id, lastFrame = -1;
    const observe = at => {
      const w = window.__worldWalk?.();
      if (w && w.frame !== lastFrame) {
        lastFrame = w.frame;
        if (frames.length < 6000) frames.push({ at, frame: w.frame, place: w.place, hand: w.hand,
          yaw: w.look.yaw, pitch: w.look.pitch, gaze: w.gaze, camera: w.camera, origin: w.origin, body: w.body,
          follow: w.follow ? { c: w.follow.c, i: w.follow.i, dir: w.follow.dir } : null, move: w.move?.kind ?? null });
        else recording.truncated = true;
      }
      if (running) id = requestAnimationFrame(observe);
    };
    window.__navigationRecording = recording;
    id = requestAnimationFrame(observe);
  });
}

export async function stopRecording(driver) {
  return driver.executeScript(() => {
    const recording = window.__navigationRecording;
    if (!recording) throw new Error('Navigation recording was not started');
    recording.stop();
    const result = { frames: recording.frames, truncated: recording.truncated };
    delete window.__navigationRecording;
    return result;
  });
}
