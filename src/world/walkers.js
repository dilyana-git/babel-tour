// ── The file on the bridge ────────────────────────────────────────────────────
// "A bridge of stone carries a file of readers across the dark on its own arch."
// They stood on it: four lathe-turned robes, still as bollards, and from the
// stand they were the first people in the piece. They are readers (readers.js)
// now, and they walk it — the way readers walk who have nowhere to be: up
// one side of the deck to the end, a moment there, round, and back down the
// other side, each at their own pace. Two read as they go. One stops now and
// then at the rail to look down into the shaft. Nobody passes anybody: the
// deck is two abreast, so a quicker reader comes up behind a slower one and
// keeps behind, as people do.
//
// Everything is laid out in the bridge's own frame — `u` along it from its
// middle, `w` across it — and set in the world through `c`, `ax` and `px`.
// Built facing +z, standing on y = 0 (readers.js).
import * as THREE from 'three';
import { readerGeometry, ROBES, clothShader } from './readers';
import { makeRng } from './textures';
import { vestOld } from './vestFix';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Wool, matt, both sides (finale.js says why), with the stride in its hem and
// its feet (readers.js, clothShader): still when uMove is 0, which is how the
// readers who do not walk wear it.
export const readerMaterial = (keep) => {
  const u = { uStride: { value: 0 }, uMove: { value: 0 }, uReach: { value: STRIDE / 2 }, uBook: { value: new THREE.Vector4() }, uGlow: { value: new THREE.Vector4() }, uSheen: { value: 1 } };
  const mat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide }));
  mat.onBeforeCompile = (sh) => clothShader(sh, u);
  mat.customProgramCacheKey = () => 'babel-walker';
  return { mat, u };
};

// The way round: out along one side of the deck, a half turn at the end, back
// along the other, a half turn at the start. END is where a lane stops (the
// turn reaches LANE further: off the end of the bridge, which is level with
// the floor and ends at the well's lip, 42, and onto the gallery's floor;
// vestibuleBridge.js); LANE puts two readers passing each other a hand apart
// and each a hand from the rail.
const END = 46, LANE = 3.8;
const TURN = Math.PI * LANE, LOOP = 4 * END + 2 * TURN;
const ENDS = [2 * END, 4 * END + TURN];          // where each lane runs out
const STRIDE = 6.6;                              // a step, ~60 cm: an unhurried walk
const GAP = 8.5;                                 // how close behind another a reader comes

// Where on the way round `s` is: [u, w] and the way it faces [du, dw].
const along = (s) => {
  s = ((s % LOOP) + LOOP) % LOOP;
  if (s < 2 * END) return [-END + s, -LANE, 1, 0];
  if (s < 2 * END + TURN) {
    const f = -Math.PI / 2 + (s - 2 * END) / LANE;
    return [END + LANE * Math.cos(f), LANE * Math.sin(f), -Math.sin(f), Math.cos(f)];
  }
  if (s < 4 * END + TURN) return [END - (s - 2 * END - TURN), LANE, -1, 0];
  const f = Math.PI / 2 + (s - 4 * END - TURN) / LANE;
  return [-END + LANE * Math.cos(f), LANE * Math.sin(f), -Math.sin(f), Math.cos(f)];
};
const inLane = (s) => {
  const x = ((s % LOOP) + LOOP) % LOOP;
  return (x > 4 && x < 2 * END - 4) || (x > 2 * END + TURN + 4 && x < 4 * END + TURN - 4);
};
// the next place after `s` where a lane runs out
const nextEnd = (s) => {
  const base = Math.floor(s / LOOP) * LOOP;
  return [base + ENDS[0], base + ENDS[1], base + LOOP + ENDS[0]].find((e) => e > s + 1);
};

// A soft round shadow under each, where the robe meets the stone.
const shadowTexture = () => {
  const N = 64, data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const r = Math.hypot((i + 0.5) / N - 0.5, (j + 0.5) / N - 0.5) * 2;
      data.set([0, 0, 0, Math.round(255 * (1 - smooth(0.15, 1, r)) ** 1.6)], (j * N + i) * 4);
    }
  }
  const t = new THREE.DataTexture(data, N, N);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};

// `c` the bridge's middle, `ax` along it, `px` across it, `deck` the height
// of its walking surface; `lectern` the one who has stopped to read:
// { at: [x, z], y, face } (face: the angle about y they look along).
export function buildWalkers({ root, keep, c, ax, px, deck, lectern, light = false }) {
  const group = new THREE.Group();
  group.name = 'bridge-readers';
  root.add(group);
  const shadowGeo = keep(new THREE.PlaneGeometry(8, 7).rotateX(-Math.PI / 2));
  const shadowMap = keep(shadowTexture());
  const toWorld = (u, w) => [c[0] + ax[0] * u + px[0] * w, c[1] + ax[1] * u + px[1] * w];
  const heading = (du, dw) => Math.atan2(ax[0] * du + px[0] * dw, ax[1] * du + px[1] * dw);

  const figure = (name, i, book) => {
    const { mat, u } = readerMaterial(keep);
    const mesh = new THREE.Mesh(keep(readerGeometry({ seed: 3 + i * 13, color: ROBES[(i * 3 + 1) % ROBES.length], book })), mat);
    // (the open book's pages, which throw the lamps' light up under the hood)
    if (mesh.geometry.userData.book) u.uBook.value.set(...mesh.geometry.userData.book, 1);
    mesh.name = name;
    group.add(mesh);
    const shadow = new THREE.Mesh(shadowGeo, keep(new THREE.MeshBasicMaterial({
      color: '#000000', map: shadowMap, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false,
    })));
    shadow.renderOrder = 3;
    group.add(shadow);
    return { mesh, shadow, u };
  };

  // Four on the bridge, spread round the way, two of them reading as they go
  // (and slower for it).
  const rng = makeRng(0x5e57);
  const R = (a, b) => a + (b - a) * rng();
  const walkers = [
    { s: 14, book: false, pace: 8.2 },
    { s: 66, book: true, pace: 6.6 },
    { s: 118, book: false, pace: 7.6 },
    { s: 170, book: true, pace: 6.2 },
  ].map((o, i) => ({
    ...figure(`bridge-reader-${i}`, i, o.book),
    ...o, d: R(0, 40), v: 0, ph: R(0, 6.28), stopAt: 0, rest: 0, hold: 0, look: 'on', stopped: false, turn: 0, turnTo: 0,
  }));

  // How far round the way the next one ahead is, and the one behind.
  const gaps = (o) => {
    let ahead = Infinity, behind = Infinity;
    for (const q of walkers) {
      if (q === o) continue;
      const ds = (((q.s - o.s) % LOOP) + LOOP) % LOOP;
      ahead = Math.min(ahead, ds);
      behind = Math.min(behind, LOOP - ds);
    }
    return [ahead, behind];
  };

  // Where to stop next: mostly where the lane runs out, for a breath before
  // turning back; now and then partway, to look over the rail into the shaft
  // (never one with a book: they are reading; and not with someone close
  // behind, who would have to stand and wait).
  const plan = (o) => {
    const end = nextEnd(o.s);
    const mid = o.s + R(18, 70);
    if (!o.book && rng() < 0.35 && mid < end - 12 && inLane(mid) && gaps(o)[1] > 30) {
      o.stopAt = mid;
      o.rest = R(3, 6);
      o.look = 'rail';
    } else {
      o.stopAt = end;
      o.rest = R(0.6, 4.5);
      o.look = 'on';
    }
  };
  walkers.forEach(plan);
  // Nobody passes, so on a way round with no end the quick ones would close up
  // behind the slowest and the four would go round as one train, stopping and
  // starting together. A reader who has come up close behind another lingers
  // at their next stop instead, until the other has gone on a stretch.
  const SPREAD = (LOOP / walkers.length) * 0.8;
  const holdFor = (o) => {
    const [ahead, behind] = gaps(o);
    if (o.look === 'rail' && behind < 16) return 0.8;
    return o.rest + Math.min(8, Math.max(0, (SPREAD - ahead) / o.pace));
  };

  const place = (o) => {
    const [u, w, du, dw] = along(o.s);
    const [x, z] = toWorld(u, w);
    const moving = smooth(0.4, 3.2, o.v);
    const stride = (o.d / STRIDE) * Math.PI;
    o.u.uStride.value = stride;
    o.u.uMove.value = moving;
    o.mesh.position.set(x, deck + (Math.sin(stride) ** 2 - 0.5) * 0.3 * moving, z);
    const face = heading(du, dw);
    const t = o.turn * o.turn * (3 - 2 * o.turn);
    o.mesh.rotation.set(0.04 * moving, face + wrap(o.turnTo - face) * t, 0, 'YXZ');
    o.shadow.position.set(x, deck + 0.06, z);
    o.shadow.rotation.y = o.mesh.rotation.y;
  };

  // The one who has stopped: at the lectern, stooped over the folio.
  if (lectern) {
    const o = figure('lectern-reader', 5, false);
    o.mesh.position.set(lectern.at[0], lectern.y, lectern.at[1]);
    o.mesh.rotation.set(0.12, lectern.face, 0, 'YXZ');
    o.shadow.position.set(lectern.at[0], lectern.y + 0.06, lectern.at[1]);
    o.shadow.rotation.y = lectern.face;
  }
  walkers.forEach(place);

  // ── Nobody cut in half on arrival ──
  // The stand's frame cuts the bridge a third of the way along: the near end
  // of the file's way round is off its left edge, so a reader is forever half
  // in and half out of it. Walking, that is only someone walking out of the
  // picture; but on arrival, the first frame the piece composes, a reader cut
  // in two by its edge was the first person the visitor met (review
  // 2026-10-08, point 1; ?wvest=old:1). No turn of the stand keeps the whole
  // way in frame, so the file keeps out of the frame's edges instead, while a
  // reader is arriving and for a little while after: whoever is across an
  // edge walks on out of it, and nobody steps into one. Where the edges fall
  // depends on the screen's shape, so they are found again for each.
  let watch = null;            // { eye, look, fov }: the stand, and where it looks
  let edges = null, edgesFor = 0;
  const STEP = 0.5;
  const findEdges = (aspect) => {
    const cam = new THREE.PerspectiveCamera(watch.fov, aspect, 0.5, 2000);
    cam.position.set(...watch.eye);
    cam.lookAt(...watch.look);
    cam.updateMatrixWorld();
    const q = new THREE.Vector3();
    const n = Math.ceil(LOOP / STEP), cut = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const [u, w] = along(i * STEP);
      const [x, z] = toWorld(u, w);
      let lo = Infinity, hi = -Infinity, bot = Infinity, top = -Infinity, behind = false;
      for (const dx of [-3.2, 3.2]) {
        for (const dz of [-3.2, 3.2]) {
          for (const y of [deck, deck + 19]) {
            q.set(x + dx, y, z + dz).applyMatrix4(cam.matrixWorldInverse);
            if (q.z > -0.5) { behind = true; continue; }
            q.applyMatrix4(cam.projectionMatrix);
            lo = Math.min(lo, q.x); hi = Math.max(hi, q.x); bot = Math.min(bot, q.y); top = Math.max(top, q.y);
          }
        }
      }
      // in the picture at all, and not wholly inside it (with a little to spare)
      const seen = hi > -1.02 && lo < 1.02 && top > -1.02 && bot < 1.02;
      const whole = !behind && lo > -0.96 && hi < 0.96 && bot > -0.96 && top < 0.96;
      cut[i] = seen && !whole ? 1 : 0;
    }
    return cut;
  };
  const cutAt = (s) => edges[Math.floor((((s % LOOP) + LOOP) % LOOP) / STEP) % edges.length] === 1;
  // where, ahead of `s`, the next edge begins (Infinity: none within reach)
  const edgeAhead = (s, reach = 40) => {
    for (let k = STEP; k <= reach; k += STEP) if (cutAt(s + k)) return s + k - STEP;
    return Infinity;
  };
  // where, ahead of `s` inside an edge, it is left behind
  const edgeEnd = (s) => {
    let k = 0;
    while (k < LOOP && cutAt(s + k)) k += STEP;
    return s + k + STEP;
  };
  // Armed when the eye comes into the room — or comes down off the map, from
  // wherever the flight starts — and held until a few seconds after it has
  // settled on the stand; let go when the eye leaves.
  const guard = { near: false, at: 0, settled: null, map: false };
  const guarding = (time, eye) => {
    if (!watch) return false;
    if (!eye) { guard.map = true; guard.near = false; return false; }
    const d = Math.hypot(eye.x - watch.eye[0], eye.z - watch.eye[2]);
    // (off the map, the flight is held to until it lands, wherever it lands)
    const flying = guard.map || (guard.near && guard.settled === null && time - guard.at < 40 && d < 400);
    guard.map = false;
    const near = (d < 90 && eye.y < 90) || flying;
    if (near && !guard.near) Object.assign(guard, { at: time, settled: null });
    guard.near = near;
    if (!near) return false;
    if (d < 2 && guard.settled === null) guard.settled = time;
    // (ten seconds: long enough to take in the first frame, short enough
    // that a reader held back from an edge is only pausing)
    return guard.settled === null ? time - guard.at < 40 : time - guard.settled < 10;
  };

  let last = null;
  const tick = (time, eye = null, aspect = 0) => {
    const dt = last === null ? 0 : Math.min(0.1, Math.max(0, time - last));
    last = time;
    if (light || dt === 0) return;
    const keepOut = !vestOld(1) && watch && aspect > 0;
    if (keepOut && Math.abs(aspect - edgesFor) > 0.005) { edges = findEdges(aspect); edgesFor = aspect; }
    const held = keepOut && guarding(time, eye);
    // Over the map, where a reader is a pixel, whoever stands across an edge
    // is put on past it: then nobody is there when the eye comes down.
    if (keepOut && !eye) {
      for (const o of walkers) {
        if (!cutAt(o.s)) continue;
        const to = edgeEnd(o.s);
        o.d += to - o.s;
        o.s = to;
        o.stopped = false;
        o.turn = 0;
        if (o.stopAt < o.s) plan(o);
        place(o);
      }
    }
    for (const o of walkers) {
      const [gap] = gaps(o);
      let want = 0;
      const across = held && cutAt(o.s);
      // (stopped across an edge, they go on at once)
      if (across && o.stopped) o.hold = Math.min(o.hold, 0);
      const wall = held && !across ? edgeAhead(o.s) : Infinity;
      if (o.s >= o.stopAt - 0.3) {
        // stopped: turn to whatever is being looked at, and back before going
        if (!o.stopped) {
          o.stopped = true;
          o.hold = holdFor(o);
          const [, w, du, dw] = along(o.s);
          // the rail on this side, a little ahead, and down into the dark
          o.turnTo = o.look === 'rail' ? heading(du * 0.35, Math.sign(w)) : heading(du, dw) + R(-0.35, 0.35);
        }
        o.hold -= dt;
        o.turn = clamp01(o.turn + (o.hold > 1 ? dt : -dt) / 1.1);
        if (o.hold <= 0) {
          o.stopped = false;
          plan(o);
        }
      } else {
        o.turn = Math.max(0, o.turn - dt / 1.1);
        // a pace that drifts a little, eased into the stop, kept behind the one ahead
        want = o.pace * (0.92 + 0.08 * Math.sin(time * 0.13 + o.ph));
        want = Math.min(want, Math.sqrt(2 * 3.2 * Math.max(0, o.stopAt - o.s)));
        want = Math.min(want, Math.max(0, gap - GAP) * 1.4);
        // (and not into the frame's edge, while one is being arrived at)
        want = Math.min(want, Math.sqrt(2 * 3.2 * Math.max(0, wall - o.s)));
      }
      o.v += (want - o.v) * Math.min(1, dt * 2.4);
      const step = Math.min(o.v * dt, Math.max(0, gap - GAP + 0.5), Math.max(0, wall - o.s));
      o.s += step;
      o.d += step;
      place(o);
    }
  };

  // for a harness: where each one is, and what they are doing
  const where = () => walkers.map((o) => {
    const [u, w] = along(o.s);
    return { name: o.mesh.name, s: +o.s.toFixed(1), u: +u.toFixed(1), w: +w.toFixed(1), v: +o.v.toFixed(2), hold: +Math.max(0, o.hold).toFixed(1), look: o.look };
  });

  // `eye` and `look` [x, y, z] and `fov`: the stand the file keeps out of the edges of
  const watchFrom = (w) => { watch = w; edgesFor = 0; };
  // (and for a harness: which of them is across an edge of the stand's frame now)
  const across = () => walkers.map((o) => (edges ? cutAt(o.s) : null));
  return { group, tick, where, watchFrom, across };
}
