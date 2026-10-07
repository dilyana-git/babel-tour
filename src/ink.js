// ── The opening's drawing ────────────────────────────────────────────────────
// The Library drawing itself in ink while the world is put together: see
// Assembly.jsx for what it shows and why. This is the drawing alone, with
// nothing from React or three.js, so that it can run in a worker on an
// OffscreenCanvas (ink.worker.js). It has to: the world is built on the page's
// own thread in slices that can hold it for half a second at a time, and a
// drawing on that thread stood still for most of the build. It runs on the
// page's thread only where a canvas cannot be handed to a worker.
//
// startInk(canvas, { reducedMotion, devPace }, emit) starts it, and returns
// { set, stop }. It is told (set) its size in device pixels, the map's resting
// camera for that size (plan.js's restPose, as plain numbers), how far the
// world's assembly has got and whether it is ready, and where the reader's
// hand is. It says (emit) how far along it is ({ u }, 0 to 1), when it has come
// to rest on the map's view ({ inked }), and when it has let go ({ gone }).

// The page's dials for the opening (DEV): ?ink=20 makes it take at least 20
// seconds, to watch it; ?ink=0 leaves it out, to time the assembly without it.
const INK_DIAL = import.meta.env.DEV && typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('ink')
  : null;
export const DEV_PACE = Number(INK_DIAL) || 0;
export const INK_OFF = INK_DIAL === '0';
// How long EntryMap waits, once the world is ready, for the drawing to come to
// rest before it shows the world regardless.
export const INK_PATIENCE_MS = 4000 + DEV_PACE * 1000;

const DEG = Math.PI / 180;
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const smoother = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;
const lerp = (a, b, t) => a + (b - a) * t;
export const stream = (seed) => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ── The honeycomb, as buildWorld.js lays it out ("The honeycomb") ────────────
// If the Library is ever laid out differently, the ink will not land on the
// stone; DEV warns when the world's own frame disagrees with GUESS below.
const R = 100;                       // a gallery's rim, centre to corner
// ...but the Echo's: it stands out into its own walls (buildWorld.js, ECHO_R).
// (Not ?wechoroom=old: the ink may be drawn in a worker, which has no query.)
const ECHO_R = 112;
const rimOf = (i, j) => (i === 1 && j === -1 ? ECHO_R : R);
const A = (R * Math.sqrt(3)) / 2;    // centre to the middle of a wall
const D = 2 * A + 50;                // centre to centre
const O = [232, 785];
const E0 = [D * Math.cos(30 * DEG), D * Math.sin(30 * DEG)];
const E1 = [0, D];
const cellC = (i, j) => [O[0] + i * E0[0] + j * E1[0], O[1] + i * E0[1] + j * E1[1]];
const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const FLOOR = 6;
const TOP = 123;                     // MASS_H + CAP: the top of the pale stone
const SHELVES = [100, 79, 58, 37, 16];
const ARCH = { from: 0.32, to: 0.68, spring: 58, apex: 76 }; // the hallways' arches, along a wall
const LAMP_Y = 74;
const PIT_R = 101;
const ROUTE = [[0, 0], [1, -1], [2, -2], [3, -3], [4, -4]];
const VERTIGO = 3;
const DOOR = 4;
const key = (i, j) => `${i},${j}`;
const GARDEN = (() => {
  const g = new Set();
  for (let i = 3; i <= 16; i++) {
    for (let j = -20; j <= -2; j++) {
      const [x, y] = cellC(i, j);
      if (y < (x - 720) * 0.889 + 20) g.add(key(i, j));
    }
  }
  g.add('5,-4');
  ['4,-4', '3,-3', '3,-4'].forEach((k) => g.delete(k));
  return g;
})();

// What the map frames (plan.js, framePointsOf) until the world reports its
// own: the rooms' outlines, the pavilion, the pond, the maze and the entrance.
const ring = (c, rx, rz, y, n = 36) => Array.from({ length: n }, (_, k) => [
  c[0] + rx * Math.cos((k / n) * 2 * Math.PI), y, c[1] + rz * Math.sin((k / n) * 2 * Math.PI),
]);
const hexAt = (c, y, r = R) => Array.from({ length: 6 }, (_, k) => [c[0] + r * Math.cos(k * 60 * DEG), y, c[1] + r * Math.sin(k * 60 * DEG)]);
export const GUESS = [
  ...[0, 1, 2, DOOR].flatMap((r) => hexAt(cellC(...ROUTE[r]), TOP, rimOf(...ROUTE[r]))),
  ...ring(cellC(...ROUTE[VERTIGO]), PIT_R, PIT_R, TOP),
  ...[[1085, 255], [1150, 180], [1240, 185], [1255, 275], [1175, 330], [1100, 335]].map(([x, z]) => [x, 30, z]),
  ...ring([1300, 118], 118, 90, 8),
  ...[[1170, 305], [1430, 305], [1430, 535], [1170, 535]].map(([x, z]) => [x, 22, z]),
  [135.4, 8, 840.8],
];

// ── A cell's own time, in seconds from its turn ─────────────────────────────
// The garden starts once the Door has been drawn, and its pen walks this fast.
const GARDEN_AFTER = 3.2;
const GARDEN_PEN = 170;
// Its strokes in the order they are inked (later over earlier): colour, opacity, width.
const GARDEN_KINDS = ['fork', 'maze', 'water', 'pavilion', 'walk'];
const GARDEN_INK = {
  fork: [178, 196, 128, 0.7, 1.7],
  maze: [159, 196, 138, 0.6, 1.1],
  water: [159, 196, 138, 0.62, 1.2],
  pavilion: [232, 195, 90, 0.8, 1.2],
  walk: [190, 214, 150, 0.85, 1.5],
};
const TRACE = 0.6;                   // the rim, both ways round from where it grew
const DROP_AT = 0.32;                // the far walls let down into the dark…
const DROP = 0.55;
const SHELF_AT = 0.62;               // …shelved…
const LAMP_AT = 0.85;                // …and the lamp lit
// Enough of a gallery for the world to be shown under it: its rim. The rest
// (walls, shelves, lamp) finishes while the stone fades in beneath.
const RIMMED = TRACE;
const PIT_RIMMED = 0.9;
// Where the opening's camera starts: low behind the Vestibule, looking down
// the walk toward the Vertigo (a yaw of -50° puts it on the Vestibule's side
// of the walk), nearer and wider than the map's.
const START = { yaw: -50, elevation: 38, near: 0.3, fov: 38 };
// After the world is ready, whatever is left is drawn this much faster.
const RUSH = 4;
// The drawing's pace, and its pace while the world draws its first frames
// (measured cold on the AMD integrated GPU: those frames took 2.2 s beside a
// drawing at thirty a second, 1.5 s beside one at ten, 1.4 s beside four).
const FRAME_S = 1 / 24 - 0.004;
const HOLD_S = 0.1;
// The last wash of light, out from the Vestibule, and the ink letting go.
const SWEEP_SPEED = 2600;
const LET_GO_S = 1.5;


// A soft round light, drawn once and stamped wherever a lamp, a spark or a
// firefly is.
const canvasOf = (w, h) => {
  const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const makeGlow = () => {
  const c = canvasOf(128, 128);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,240,208,1)');
  grd.addColorStop(0.14, 'rgba(255,214,140,0.62)');
  grd.addColorStop(0.42, 'rgba(240,170,80,0.16)');
  grd.addColorStop(1, 'rgba(220,140,60,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return c;
};

// One dot of a path not taken.
const makeDot = () => {
  const c = canvasOf(8, 8);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(4, 4, 0, 4, 4, 4);
  grd.addColorStop(0, 'rgba(190,214,150,1)');
  grd.addColorStop(0.55, 'rgba(178,196,128,0.85)');
  grd.addColorStop(1, 'rgba(178,196,128,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 8);
  return c;
};

// The shelving, drawn once: five shelves of books in gold ink along a strip
// four walls long, each wall showing its own stretch of it. A wall is filled
// with it, one textured fill a wall. (Each book was a stroke of its own, and
// on the map's view that was some ten thousand strokes a frame, on the GPU the
// world was being compiled and first drawn on.)
const SHELF_W = 192;                 // the strip's pixels to one wall's length
const SHELF_H = 96;                  // and from the top of the stone to the floor
const makeShelving = () => {
  const w = SHELF_W * 4, h = SHELF_H;
  const c = canvasOf(w, h);
  const g = c.getContext('2d');
  const rnd = stream(35);
  const py = (y) => ((TOP - y) / (TOP - FLOOR)) * h;
  g.strokeStyle = 'rgba(201,162,76,0.9)';
  g.lineWidth = 1;
  for (const y of SHELVES) {
    const at = Math.round(py(y)) + 0.5;
    g.beginPath();
    g.moveTo(0, at);
    g.lineTo(w, at);
    g.stroke();
    // thirty-five books or so to a shelf, standing; now and then a gap
    let x = rnd() * 3;
    while (x < w) {
      const bw = 3.5 + rnd() * 4;
      if (rnd() < 0.05) {
        x += bw * 2;
        continue;
      }
      const bh = (0.45 + 0.42 * rnd()) * (21 / (TOP - FLOOR)) * h;
      g.fillStyle = `rgba(201,162,76,${(0.06 + rnd() * 0.2).toFixed(2)})`;
      g.fillRect(x, at - bh, bw - 1, bh);
      g.beginPath();
      g.moveTo(Math.round(x) + 0.5, at);
      g.lineTo(Math.round(x) + 0.5, at - bh);
      g.stroke();
      x += bw;
    }
  }
  return c;
};

// Every gallery the opening draws, the five on the walk first and the rest by
// how many galleries away from the walk they are, and when each one's turn
// comes (`u`, on the way from 0 to 1). `seen` says whether a centre is worth
// drawing at all.
const layCells = (seen) => {
  const all = new Map();
  for (let i = -7; i <= 16; i++) {
    for (let j = -20; j <= 12; j++) {
      const c = cellC(i, j);
      if (c[0] < -620 || c[0] > 2100 || c[1] < -1000 || c[1] > 1400) continue;
      if (GARDEN.has(key(i, j)) || !seen(c)) continue;
      all.set(key(i, j), { i, j, c });
    }
  }
  ROUTE.forEach(([i, j]) => { if (!all.has(key(i, j))) all.set(key(i, j), { i, j, c: cellC(i, j) }); });
  // breadth first out from the walk, remembering where each gallery grew from
  const hops = new Map();
  const from = new Map();
  let wave = ROUTE.map(([i, j]) => key(i, j));
  wave.forEach((k) => hops.set(k, 0));
  for (let h = 1; wave.length; h++) {
    const next = [];
    for (const k of wave) {
      const { i, j } = all.get(k);
      for (const [di, dj] of NB) {
        const n = key(i + di, j + dj);
        if (!all.has(n) || hops.has(n)) continue;
        hops.set(n, h);
        from.set(n, k);
        next.push(n);
      }
    }
    wave = next;
  }
  const rnd = stream(1941);
  const routeKeys = ROUTE.map(([i, j]) => key(i, j));
  const rest = [...all.keys()].filter((k) => !routeKeys.includes(k) && hops.has(k))
    .map((k) => ({ k, order: hops.get(k) + rnd() * 0.95 }))
    .sort((a, b) => a.order - b.order);
  const cells = [];
  const make = (k, u, after, route) => {
    const cell = all.get(k);
    const [cx, cz] = cell.c;
    const parent = from.get(k);
    // the rim starts at the corner nearest where the gallery grew from
    const toward = parent ? all.get(parent).c : route > 0 ? cellC(...ROUTE[route - 1]) : [cx - 200, cz + 120];
    const ang = Math.atan2(toward[1] - cz, toward[0] - cx);
    const v0 = ((Math.round(ang / (60 * DEG)) % 6) + 6) % 6;
    const nearWalk = Math.min(...routeKeys.map((rk) => Math.hypot(all.get(rk).c[0] - cx, all.get(rk).c[1] - cz)));
    const near = Math.exp(-nearWalk / 620);
    const seed = rnd();
    cells.push({
      ...cell,
      u,
      after,
      v0,
      route,
      seed,
      ink: route >= 0 ? 1 : 0.2 + 0.8 * near,
      glow: route >= 0 ? 1 : 0.1 + 0.5 * near * near + (seed > 0.86 ? 0.35 : 0),
      fromVestibule: Math.hypot(cx - O[0], cz - O[1]),
      // corners: rim (x, z), and the hallways (walls 2 and 5 open onto one,
      // unless the gallery beyond is garden)
      corners: Array.from({ length: 6 }, (_, n) => [cx + rimOf(cell.i, cell.j) * Math.cos(n * 60 * DEG), cz + rimOf(cell.i, cell.j) * Math.sin(n * 60 * DEG)]),
      // where along a wall its hallway's arch stands (a wider room's walls are longer)
      arch: rimOf(cell.i, cell.j) === R ? [ARCH.from, ARCH.to] : [0.5 - 18 / rimOf(cell.i, cell.j), 0.5 + 18 / rimOf(cell.i, cell.j)],
      hall: [2, 5].filter((w) => !GARDEN.has(key(cell.i + NB[w][0], cell.j + NB[w][1]))),
      broken: route === DOOR ? 5 : -1,
      age: 0,
      started: false,
      scr: new Float32Array(28), // 6 rim + 6 floor corners, the floor's middle, the lamp (x, y)
      depth: 0,
      scale: 0,
    });
  };
  // The walk's five a beat apart, the Vestibule alone first; then the rest no
  // faster than about forty a second, however far the progress has run ahead
  // (the opening's own clock, which runs faster once the world is ready).
  routeKeys.forEach((k, r) => make(k, 0, 0.3 + 0.55 * r, r));
  rest.forEach(({ k }, n) => make(k, 0.17 + 0.75 * (n / Math.max(1, rest.length - 1)) ** 0.92, 2.6 + 0.024 * n, -1));
  return cells;
};

// The garden of forking paths, in green ink, laid where the garden is (the
// numbers are the map's: buildWorld.js's garden walk, the Fork, the pond with
// its pavilion, the maze). First the walk through it, out of the Door's broken
// wall, over the zigzag bridge to the pavilion and down into the maze; then
// the pond and the maze traced round; and all the while the paths that fork
// off the walk, forking again and again, round the water and the hedges,
// until the garden runs out.
const POND = { c: [1300, 118], rx: 118, rz: 90 };
const PAVILION = [1305, 110];
const MAZE = { x0: 1170, z0: 305, x1: 1430, z1: 535 };
const layGarden = () => {
  const rnd = stream(1899);
  const gardenCells = [...GARDEN].map((k) => cellC(...k.split(',').map(Number)));
  const doorC = cellC(...ROUTE[DOOR]);
  const gate = [doorC[0] + A * Math.cos(330 * DEG), doorC[1] + A * Math.sin(330 * DEG)];
  const fork = [1186, 236];
  const shore = [1238, 196];
  const strokes = [];
  const stroke = (pts, y, u, kind) => {
    let len = 0;
    const cum = [0];
    for (let n = 1; n < pts.length; n++) {
      len += Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]);
      cum.push(len);
    }
    strokes.push({ pts, y, u, kind, len, cum, start: -1, age: 0 });
  };
  const loop = (n, at) => Array.from({ length: n + 1 }, (_, k) => at((k % n) / n));
  // the walk, and the leg down into the maze
  stroke([gate, fork, [1216, 218], shore, [1262, 186], [1252, 166], [1276, 156], [1285, 137], PAVILION], 8, 0.3, 'walk');
  stroke([shore, [1315, 212], [1311, 266], [1300, MAZE.z0], [1300, 420]], 8, 0.5, 'walk');
  // the pond, the pavilion in it, and the maze (outer hedge, and two rings in, each with its way through)
  stroke(loop(48, (f) => [POND.c[0] + POND.rx * Math.cos(f * 2 * Math.PI + 2.4), POND.c[1] + POND.rz * Math.sin(f * 2 * Math.PI + 2.4)]), 8, 0.45, 'water');
  stroke(loop(8, (f) => [PAVILION[0] + 24 * Math.cos(f * 2 * Math.PI), PAVILION[1] + 24 * Math.sin(f * 2 * Math.PI)]), 30, 0.55, 'pavilion');
  const rect = (i, gapAt) => {
    const x0 = MAZE.x0 + i, x1 = MAZE.x1 - i, z0 = MAZE.z0 + i, z1 = MAZE.z1 - i;
    const ring = [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];
    // open the ring by starting and ending it either side of its way through
    const side = Math.floor(gapAt * 4), t = gapAt * 4 - side;
    const a = ring[side], b = ring[side + 1];
    const gapW = 26 / Math.hypot(b[0] - a[0], b[1] - a[1]);
    const p = (s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
    return [p(Math.min(1, t + gapW / 2)), ...ring.slice(side + 1, 5), ...ring.slice(1, side + 1), p(Math.max(0, t - gapW / 2))];
  };
  stroke(rect(0, 0.125), 22, 0.6, 'maze');
  stroke(rect(30, 0.62), 22, 0.68, 'maze');
  stroke(rect(60, 0.37), 22, 0.76, 'maze');

  // the forking paths, off the walk, kept out of the water and the hedges
  const inGarden = (p) => {
    if (p[0] < 820 || p[0] > 2100 || p[1] < -1000 || p[1] > 760) return false;
    let best = Infinity;
    for (const c of gardenCells) best = Math.min(best, Math.hypot(c[0] - p[0], c[1] - p[1]));
    return best < D * 0.62 && Math.hypot(doorC[0] - p[0], doorC[1] - p[1]) > A + 6;
  };
  const clear = (p) => ((p[0] - POND.c[0]) / (POND.rx + 18)) ** 2 + ((p[1] - POND.c[1]) / (POND.rz + 18)) ** 2 > 1
    && !(p[0] > MAZE.x0 - 14 && p[0] < MAZE.x1 + 14 && p[1] > MAZE.z0 - 14 && p[1] < MAZE.z1 + 14);
  const forks = [];
  // (from every turn of the walk, a way or two off it: a net of paths
  // rather than one tree of them)
  const turns = [gate, fork, [1216, 218], shore, [1262, 186], [1276, 156], [1315, 212], [1311, 266]];
  const queue = turns.flatMap((p, i) => [0, 1].map(() => ({ p, a: rnd() * 2 * Math.PI, depth: 0, dist: i * 26 })));
  while (queue.length && forks.length < 190) {
    const { p, a, depth, dist } = queue.shift();
    const len = 26 + rnd() * 28;
    const q = [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len];
    if (!inGarden(q) || !clear(q)) continue;
    forks.push({ p, q, len, dist, depth });
    if (depth >= 9) continue;
    const on = { p: q, depth: depth + 1, dist: dist + len };
    if (rnd() < 0.42) {
      const spread = (18 + rnd() * 24) * DEG;
      queue.push({ ...on, a: a - spread }, { ...on, a: a + spread });
    } else {
      queue.push({ ...on, a: a + (rnd() - 0.5) * 30 * DEG });
    }
  }
  const far = Math.max(1, ...forks.map((s) => s.dist));
  forks.forEach((s) => stroke([s.p, s.q], 8, 0.34 + 0.6 * (s.dist / far), 'fork'));
  // (each fork's dots, every twelve units along it)
  strokes.forEach((s) => {
    if (s.kind !== 'fork') return;
    s.dots = Array.from({ length: Math.max(1, Math.floor(s.len / 12)) }, (_, n) => (n + 0.5) * 12)
      .filter((d) => d <= s.len)
      .map((d) => [d, lerp(s.pts[0][0], s.pts[1][0], d / s.len), lerp(s.pts[0][1], s.pts[1][1], d / s.len)]);
  });

  // fireflies over the paths and the water
  const lit = strokes.filter((s) => s.kind === 'fork' || s.kind === 'water');
  const flies = Array.from({ length: 48 }, () => {
    const s = lit[Math.floor(rnd() * lit.length)];
    const at = s.pts[Math.floor(rnd() * s.pts.length)];
    return {
      x: at[0] + (rnd() - 0.5) * 50, z: at[1] + (rnd() - 0.5) * 50, y: 14 + rnd() * 36,
      f: 0.3 + rnd() * 0.5, blink: 0.6 + rnd() * 1.4, phase: rnd() * 10, path: s,
    };
  });
  return { strokes, flies };
};

export function startInk(canvas, { reducedMotion = false, devPace = 0 } = {}, emit = () => {}) {
  const g = canvas.getContext('2d');
  if (!g) {
    emit({ u: 1, inked: true, gone: true });
    return { set() {}, stop() {} };
  }
  const still = reducedMotion;
  const glow = makeGlow();
  const dot = makeDot();
  const shelving = g.createPattern(makeShelving(), 'repeat');
  const vestibule = cellC(0, 0);
  const echo = cellC(1, -1);
  const pit = cellC(...ROUTE[VERTIGO]);
  let W = 0, H = 0, dpr = 1;
  let cells = null;
  const { strokes, flies } = layGarden();
  const motes = Array.from({ length: 34 }, (_, k) => {
    const r = stream(300 + k);
    return { x: r(), y: r(), s: 0.5 + r() * 1.2, v: 0.006 + r() * 0.012, a: 0.05 + r() * 0.2, w: r() * 10 };
  });
  const input = { progress: 0, ready: false, rest: null, shown: false };
  const state = { u: 0, clock: 0 };
  const t0 = performance.now() / 1000;
  let last = t0, inkedAt = -1, shownAt = -1, raf = 0, sentU = -1, stopped = false;
  // The reader's hand leans the drawing a little while it is being drawn
  // (none of it is left by the time the camera is at rest).
  const lean = { x: 0, y: 0, toX: 0, toY: 0 };
  const nextFrame = typeof requestAnimationFrame === 'function' ? (f) => requestAnimationFrame(f) : (f) => setTimeout(f, 16);
  const cancelFrame = typeof cancelAnimationFrame === 'function' ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);

  // ── The camera ───────────────────────────────────────────────────────────
  // three's PerspectiveCamera with lookAt and setViewOffset, by hand. At c = 1
  // it is restPose's camera exactly: 52° up, looking at the frame's middle, the
  // lens shifted by `shift` of the width (2 × shift in NDC).
  const eye = [0, 0, 0], fwd = [0, 0, 0], side = [0, 0, 0], up = [0, 0, 0];
  let focal = 1, lens = 0;
  // c: 0 is the opening's own look down the walk, 1 the map at rest
  const place = (c, t) => {
    const r = input.rest;
    const e = still ? 1 : smoother(c);
    const et = still ? 1 : smoother(Math.min(1, c * 1.18));
    const wander = (1 - e) ** 2;
    const yaw = lerp(START.yaw, 0, e) * DEG
      + (still ? 0 : (2.4 * Math.sin(t * 0.23) * wander + 9 * lean.x * (1 - e)) * DEG);
    const el = lerp(START.elevation * DEG, r.elevation, e)
      + (still ? 0 : (1.6 * Math.sin(t * 0.17 + 1) * wander - 6 * lean.y * (1 - e)) * DEG);
    const d = r.distance * Math.exp(Math.log(START.near) * (1 - e));
    const sx = lerp(vestibule[0], echo[0], 0.3), sz = lerp(vestibule[1], echo[1], 0.3);
    const tx = lerp(sx, r.target[0], et), ty = r.target[1], tz = lerp(sz, r.target[2], et);
    eye[0] = tx + Math.sin(yaw) * Math.cos(el) * d;
    eye[1] = ty + Math.sin(el) * d;
    eye[2] = tz + Math.cos(yaw) * Math.cos(el) * d;
    const fl = Math.hypot(tx - eye[0], ty - eye[1], tz - eye[2]);
    fwd[0] = (tx - eye[0]) / fl; fwd[1] = (ty - eye[1]) / fl; fwd[2] = (tz - eye[2]) / fl;
    const sl = Math.hypot(fwd[2], fwd[0]);
    side[0] = -fwd[2] / sl; side[1] = 0; side[2] = fwd[0] / sl;
    up[0] = side[1] * fwd[2] - side[2] * fwd[1];
    up[1] = side[2] * fwd[0] - side[0] * fwd[2];
    up[2] = side[0] * fwd[1] - side[1] * fwd[0];
    focal = 1 / Math.tan((lerp(START.fov, r.fov, e) * DEG) / 2);
    lens = 2 * r.shift * e;
  };
  // world → screen pixels (device), with the pixels a unit spans there; false if behind
  const out = [0, 0, 0];
  const project = (x, y, z) => {
    const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2];
    const zf = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
    if (zf < 1) return false;
    const xv = dx * side[0] + dy * side[1] + dz * side[2];
    const yv = dx * up[0] + dy * up[1] + dz * up[2];
    out[0] = ((xv * focal * H) / (zf * W) + lens + 1) * 0.5 * W;
    out[1] = (1 - (yv * focal) / zf) * 0.5 * H;
    out[2] = (focal * 0.5 * H) / zf;
    return true;
  };
  // the galleries worth drawing: in the frame at rest or at the start (with a margin)
  const seen = ([x, z]) => [1, 0].some((c) => {
    place(c, 0);
    if (!project(x, TOP, z)) return false;
    return Math.abs((out[0] / W) * 2 - 1) < 1.3 && Math.abs(1 - (out[1] / H) * 2) < 1.35;
  });

  // ── Drawing ────────────────────────────────────────────────────────────
  const gold = (a) => `rgba(232,195,90,${a.toFixed(3)})`;
  const umber = (a) => `rgba(201,162,76,${a.toFixed(3)})`;
  // a point on wall k of a cell (t along it from corner k, at height y), by
  // the projected corners: near enough to true across one wall
  const onWall = (s, k, t, y, into) => {
    const k1 = (k + 1) % 6;
    const h = (y - FLOOR) / (TOP - FLOOR);
    const bx = lerp(s[12 + k * 2], s[12 + k1 * 2], t), by = lerp(s[13 + k * 2], s[13 + k1 * 2], t);
    const tx = lerp(s[k * 2], s[k1 * 2], t), ty = lerp(s[k * 2 + 1], s[k1 * 2 + 1], t);
    into[0] = lerp(bx, tx, h);
    into[1] = lerp(by, ty, h);
    return into;
  };
  const P0 = [0, 0], P1 = [0, 0];
  const stamp = (x, y, r, a) => {
    if (a <= 0.003 || r < 0.5) return;
    g.globalAlpha = Math.min(1, a);
    g.drawImage(glow, x - r, y - r, r * 2, r * 2);
  };

  const drawRim = (cell, s, f, alpha, width) => {
    const { v0, broken } = cell;
    g.beginPath();
    for (const dir of [1, -1]) {
      let left = 3 * f, k = v0;
      while (left > 0.0001) {
        const n = (k + dir + 6) % 6;
        const t = Math.min(1, left);
        const edge = dir > 0 ? k : n; // edge index is its lower corner
        const ax = s[k * 2], ay = s[k * 2 + 1], bx = s[n * 2], by = s[n * 2 + 1];
        if (edge === broken) {
          // the Door's wall onto the garden: broken through the middle
          const seg = (p, q) => {
            const lo = Math.min(p, t), hi = Math.min(q, t);
            if (hi <= lo) return;
            g.moveTo(lerp(ax, bx, lo), lerp(ay, by, lo));
            g.lineTo(lerp(ax, bx, hi), lerp(ay, by, hi));
          };
          seg(0, 0.36);
          seg(0.64, 1);
        } else {
          g.moveTo(ax, ay);
          g.lineTo(lerp(ax, bx, t), lerp(ay, by, t));
        }
        left -= 1;
        k = n;
      }
    }
    if (cell.route >= 0) {
      g.strokeStyle = gold(alpha * 0.14);
      g.lineWidth = width * 3.2;
      g.stroke();
    }
    g.strokeStyle = gold(alpha);
    g.lineWidth = width;
    g.stroke();
  };
  // the pens' heads, while the rim is being traced
  const penHeads = (cell, s, f) => {
    const heads = [];
    for (const dir of [1, -1]) {
      const along = 3 * f;
      const whole = Math.floor(along);
      const k = (cell.v0 + dir * whole + 12) % 6;
      const n = (k + dir + 6) % 6;
      const t = along - whole;
      heads.push([lerp(s[k * 2], s[n * 2], t), lerp(s[k * 2 + 1], s[n * 2 + 1], t)]);
    }
    return heads;
  };

  const camXZ = [0, 0];
  // One gallery: its opening, the far walls let down into it with their
  // shelves, books and arches, and its rim over all of it. In as few calls as
  // it can be (the GPU it draws on is the one the world is being compiled and
  // first drawn on, underneath): the opening, a fill a wall, the arch, one
  // stroke for every line and one for every book. Nothing is clipped: seen
  // from the map's height and above, what hangs from the far rim stays inside
  // the near one.
  const facing = [0, 0, 0, 0, 0, 0];
  // whether a point is inside a gallery's rim on the screen (convex, either way round)
  const insideRim = (s, [x, y]) => {
    let sign = 0;
    for (let n = 0; n < 6; n++) {
      const k = (n + 1) % 6;
      const cross = (s[k * 2] - s[n * 2]) * (y - s[n * 2 + 1]) - (s[k * 2 + 1] - s[n * 2 + 1]) * (x - s[n * 2]);
      if (Math.abs(cross) < 1e-6) continue;
      if (sign === 0) sign = Math.sign(cross);
      else if (Math.sign(cross) !== sign) return false;
    }
    return true;
  };
  const drawCell = (cell, now, letGo, sweep) => {
    const s = cell.scr;
    const a = cell.age;
    const fade = still ? smooth(a / 0.7) : 1;
    const boost = 1 + 1.8 * sweep;
    const ink = cell.ink * fade * (1 - letGo) * boost;
    if (ink <= 0.003) return;
    const trace = still ? 1 : easeOut(a / TRACE);
    const drop = still ? 1 : smoother((a - DROP_AT) / DROP);
    const Y = TOP - drop * (TOP - FLOOR);
    const w = Math.max(0.6, Math.min(2.2, cell.scale * 1.1)) * (cell.route >= 0 ? 1.25 : 1);

    if (drop > 0) {
      const dark = drop * fade * (1 - letGo);
      // which walls face the eye, and how squarely; and whether any of their
      // feet would show past the near rim (only low and side-on, early in
      // the opening: then, and only for that gallery, it is clipped to its rim)
      let shown = 0, spill = false;
      for (let wall = 0; wall < 6; wall++) {
        const ang = (30 + 60 * wall) * DEG;
        const nx = Math.cos(ang), nz = Math.sin(ang);
        const tx = camXZ[0] - (cell.c[0] + nx * A), tz = camXZ[1] - (cell.c[1] + nz * A);
        facing[wall] = -(nx * tx + nz * tz) / (Math.hypot(tx, tz) || 1);
        if (facing[wall] <= 0.02) continue;
        shown = Math.max(shown, smooth(facing[wall] / 0.25));
        if (!spill) spill = !insideRim(s, onWall(s, wall, 0, Y, P0)) || !insideRim(s, onWall(s, wall, 1, Y, P0));
      }
      // the opening, darkening as the walls come down into it
      g.beginPath();
      for (let n = 0; n < 6; n++) g[n ? 'lineTo' : 'moveTo'](s[n * 2], s[n * 2 + 1]);
      g.closePath();
      g.fillStyle = `rgba(16,12,8,${(0.85 * dark).toFixed(3)})`;
      g.fill();
      if (spill) {
        g.save();
        g.clip();
      }
      // the walls, let down to Y, each lit by how squarely it faces the eye
      const shelved = still ? 1 : smooth((a - SHELF_AT) / 0.5);
      for (let wall = 0; wall < 6; wall++) {
        if (facing[wall] <= 0.02 || wall === cell.broken) continue;
        onWall(s, wall, 0, Y, P0);
        onWall(s, wall, 1, Y, P1);
        const k1 = (wall + 1) % 6;
        g.beginPath();
        g.moveTo(s[wall * 2], s[wall * 2 + 1]);
        g.lineTo(s[k1 * 2], s[k1 * 2 + 1]);
        g.lineTo(P1[0], P1[1]);
        g.lineTo(P0[0], P0[1]);
        g.closePath();
        const tone = 0.55 + 0.45 * facing[wall];
        const show = smooth(facing[wall] / 0.25);
        g.fillStyle = `rgba(${Math.round(34 * tone + 6)},${Math.round(26 * tone + 4)},${Math.round(16 * tone + 3)},${(0.92 * dark * show).toFixed(3)})`;
        g.fill();
        // its shelving: the strip laid along the wall from corner k, top
        // down, its own stretch of it (an affine fit of the wall: near enough
        // to true across one wall)
        if (shelved > 0) {
          const ox = s[wall * 2], oy = s[wall * 2 + 1];
          const ux = s[k1 * 2] - ox, uy = s[k1 * 2 + 1] - oy;
          const vx = s[12 + wall * 2] - ox, vy = s[13 + wall * 2] - oy;
          const x0 = Math.floor(((cell.seed * 7.31 + wall * 0.29) % 1) * SHELF_W * 4);
          shelving.setTransform({
            a: ux / SHELF_W, b: uy / SHELF_W, c: vx / SHELF_H, d: vy / SHELF_H,
            e: ox - (x0 * ux) / SHELF_W, f: oy - (x0 * uy) / SHELF_W,
          });
          g.fillStyle = shelving;
          g.globalAlpha = Math.min(1, 0.9 * ink * shelved * show);
          g.fill();
          g.globalAlpha = 1;
        }
      }
      // the hallways' arches, cut through once the walls are down
      const cut = still ? 1 : smooth((a - DROP_AT - DROP * 0.85) / 0.3);
      const arches = cut > 0 && cell.hall.some((wall) => facing[wall] > 0.02 && wall !== cell.broken);
      if (arches) {
        g.beginPath();
        for (const wall of cell.hall) {
          if (facing[wall] <= 0.02 || wall === cell.broken) continue;
          onWall(s, wall, cell.arch[0], FLOOR, P0);
          g.moveTo(P0[0], P0[1]);
          onWall(s, wall, cell.arch[0], ARCH.spring, P0);
          g.lineTo(P0[0], P0[1]);
          for (let q = 1; q <= 8; q++) {
            const th = Math.PI - (q / 8) * Math.PI;
            onWall(s, wall, 0.5 + (Math.cos(th) * (cell.arch[1] - cell.arch[0])) / 2, ARCH.spring + Math.sin(th) * (ARCH.apex - ARCH.spring), P0);
            g.lineTo(P0[0], P0[1]);
          }
          onWall(s, wall, cell.arch[1], FLOOR, P0);
          g.lineTo(P0[0], P0[1]);
        }
        g.fillStyle = `rgba(4,3,2,${(0.9 * cut * dark).toFixed(3)})`;
        g.fill();
      }
      // every line: the arches' edges, the corners down and the foot of each wall
      const lines = new Path2D();
      for (let wall = 0; wall < 6; wall++) {
        if (facing[wall] <= 0.02) continue;
        const k1 = (wall + 1) % 6;
        const open = wall === cell.broken;
        const hall = cell.hall.includes(wall);
        if (!open) {
          if (hall && cut > 0) {
            onWall(s, wall, cell.arch[0], FLOOR, P0);
            lines.moveTo(P0[0], P0[1]);
            onWall(s, wall, cell.arch[0], ARCH.spring, P0);
            lines.lineTo(P0[0], P0[1]);
            for (let q = 1; q <= 8; q++) {
              const th = Math.PI - (q / 8) * Math.PI;
              onWall(s, wall, 0.5 + (Math.cos(th) * (cell.arch[1] - cell.arch[0])) / 2, ARCH.spring + Math.sin(th) * (ARCH.apex - ARCH.spring), P0);
              lines.lineTo(P0[0], P0[1]);
            }
            onWall(s, wall, cell.arch[1], FLOOR, P0);
            lines.lineTo(P0[0], P0[1]);
          }
        }
        onWall(s, wall, 0, Y, P0);
        onWall(s, wall, 1, Y, P1);
        if (!open) {
          lines.moveTo(s[wall * 2], s[wall * 2 + 1]);
          lines.lineTo(P0[0], P0[1]);
          lines.lineTo(P1[0], P1[1]);
          lines.lineTo(s[k1 * 2], s[k1 * 2 + 1]);
        } else {
          // only the broken ends of the Door's wall stand
          lines.moveTo(s[wall * 2], s[wall * 2 + 1]);
          lines.lineTo(P0[0], P0[1]);
          onWall(s, wall, 0.36, Y, P1);
          lines.lineTo(P1[0], P1[1]);
          onWall(s, wall, 0.64, Y, P0);
          lines.moveTo(P0[0], P0[1]);
          onWall(s, wall, 1, Y, P1);
          lines.lineTo(P1[0], P1[1]);
          lines.lineTo(s[k1 * 2], s[k1 * 2 + 1]);
        }
      }
      g.strokeStyle = umber(0.62 * ink * shown);
      g.lineWidth = Math.max(0.5, w * 0.7);
      g.stroke(lines);
      if (spill) g.restore();
    }
    // the rim, over everything in it
    drawRim(cell, s, trace, Math.min(1, 0.9 * ink), w);
  };

  const lampOf = (cell, now) => {
    const ig = cell.age - LAMP_AT;
    if (ig <= 0) return 0;
    const on = smooth(ig / 0.12);
    const flash = still ? 0 : Math.exp(-ig * 2.4) * 1.4;
    const flicker = still ? 1 : 1 + 0.07 * Math.sin(now * 7.3 + cell.seed * 40) + 0.05 * Math.sin(now * 12.9 + cell.seed * 17);
    return on * (cell.glow + flash * Math.sqrt(cell.glow)) * flicker;
  };

  // The Vertigo: its rim, the rings of its funnel of books going down, and
  // the stair turning round and down inside it toward a light at the bottom.
  const pitDepth = (r) => TOP - 48 * r - 4 * r * r;
  const pitRadius = (r) => PIT_R * (1 - 0.055 * r);
  const drawPit = (cell, now, letGo, sweep) => {
    const a = cell.age;
    const ink = cell.ink * (still ? smooth(a / 0.7) : 1) * (1 - letGo) * (1 + 1.8 * sweep);
    if (ink <= 0.003 || !project(pit[0], TOP, pit[1])) return;
    const k = out[2];
    const w = Math.max(0.7, Math.min(2.4, k * 1.2));
    const start = Math.atan2(cellC(2, -2)[1] - pit[1], cellC(2, -2)[0] - pit[0]);
    // a point on the funnel's inner wall, if it faces the eye
    const facing = (x, z) => (x - pit[0]) * (camXZ[0] - x) + (z - pit[1]) * (camXZ[1] - z) < 0;
    const rimPath = (until) => {
      g.beginPath();
      let pen = false;
      for (let q = 0; q <= 48 * until; q++) {
        const th = start + (q / 48) * 2 * Math.PI;
        if (!project(pit[0] + Math.cos(th) * PIT_R, TOP, pit[1] + Math.sin(th) * PIT_R)) { pen = false; continue; }
        if (pen) g.lineTo(out[0], out[1]); else g.moveTo(out[0], out[1]);
        pen = true;
      }
    };
    const rimOn = still ? 1 : easeOut(a / 0.9);

    // Everything below the rim is seen through it: the funnel is convex, so
    // a point on its far wall is in sight if it faces the eye and the rim is
    // round it on the screen.
    g.save();
    rimPath(1);
    g.closePath();
    g.fillStyle = `rgba(10,7,5,${(0.9 * rimOn * (1 - letGo)).toFixed(3)})`;
    g.fill();
    g.clip();
    // rings of shelving going down, each traced as its turn comes
    for (let r = 1; r <= 10; r++) {
      const on = still ? 1 : easeOut((a - 0.45 - 0.12 * r) / 0.6);
      if (on <= 0) continue;
      const y = pitDepth(r), rad = pitRadius(r);
      const deep = 1 - r / 12;
      g.beginPath();
      let pen = false;
      for (let q = 0; q <= 48 * on; q++) {
        const th = start + (q / 48) * 2 * Math.PI;
        const x = pit[0] + Math.cos(th) * rad, z = pit[1] + Math.sin(th) * rad;
        if (!facing(x, z) || !project(x, y, z)) { pen = false; continue; }
        if (pen) g.lineTo(out[0], out[1]); else g.moveTo(out[0], out[1]);
        pen = true;
      }
      g.strokeStyle = umber(0.55 * ink * deep * deep);
      g.lineWidth = w * 0.7;
      g.stroke();
    }
    // the stair, round and down
    const stair = still ? 1 : smooth((a - 0.7) / 2.6);
    if (stair > 0) {
      const turns = 5.5, n = 260;
      g.beginPath();
      let pen = false;
      for (let q = 0; q <= n * stair; q++) {
        const f = q / n;
        const th = start + f * turns * 2 * Math.PI;
        const rad = pitRadius(10 * f) - 8;
        const x = pit[0] + Math.cos(th) * rad, z = pit[1] + Math.sin(th) * rad;
        if (!facing(x, z) || !project(x, pitDepth(10 * f) - 4, z)) { pen = false; continue; }
        if (pen) g.lineTo(out[0], out[1]); else g.moveTo(out[0], out[1]);
        pen = true;
      }
      g.strokeStyle = gold(0.75 * ink);
      g.lineWidth = w * 0.9;
      g.stroke();
    }
    // the light at the bottom, warming the well from below
    const deepLight = still ? 1 : smooth((a - 1.4) / 1.6);
    const pulse = still ? 1 : 1 + 0.08 * Math.sin(now * 1.3);
    g.globalCompositeOperation = 'lighter';
    if (deepLight > 0 && project(pit[0], pitDepth(6), pit[1])) {
      stamp(out[0], out[1], 260 * out[2] * pulse, 0.6 * deepLight * (1 - letGo));
    }
    g.restore();
    // the rim, over what it opens on, and the light welling up out of it
    rimPath(rimOn);
    g.strokeStyle = gold(Math.min(1, 0.95 * ink));
    g.lineWidth = w * 1.25;
    g.stroke();
    if (deepLight > 0 && project(pit[0], 40, pit[1])) {
      g.globalCompositeOperation = 'lighter';
      stamp(out[0], out[1], 150 * out[2] * pulse, 0.3 * deepLight * (1 - letGo));
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
  };

  // (DEV: where it is drawn, and each second how many frames and the longest gap, in ms)
  const beat = { at: 0, frames: 0, worst: 0, busy: 0, cells: 0 };
  if (import.meta.env.DEV) emit({ where: typeof window === 'undefined' ? 'worker' : 'page' });
  const frame = () => {
    if (stopped) return;
    raf = nextFrame(frame);
    if (!cells) return;
    const now = performance.now() / 1000;
    // Thirty frames a second; and only a few while the world, under it, draws
    // its own first frames (it is waited on for two of them, and the two
    // share one GPU).
    const hold = input.progress >= 0.99 && !input.ready;
    if (now - last < (hold ? HOLD_S : FRAME_S)) return;
    if (import.meta.env.DEV) {
      beat.frames += 1;
      beat.worst = Math.max(beat.worst, now - last);
      if (now - beat.at >= 1) {
        emit({ beat: [Math.round(now - t0), beat.frames, Math.round(beat.worst * 1000), Math.round(beat.busy), beat.cells] });
        Object.assign(beat, { at: now, frames: 0, worst: 0, busy: 0 });
      }
    }
    const dt = Math.min(0.1, now - last);
    last = now;
    const t = now - t0;
    // how far along: the world's word, eased, never back, and a floor that creeps with the clock
    let { progress, ready } = input;
    if (devPace) {
      progress = Math.min(progress, (0.99 * t) / devPace);
      ready = ready && t >= devPace;
    }
    const goal = ready ? 1 : Math.max(progress, 0.9 * (1 - Math.exp(-t / 30)));
    state.u = Math.max(state.u, lerp(state.u, goal, 1 - Math.exp(-dt / (ready ? 0.12 : 0.8))));
    if (ready && 1 - state.u < 0.002) state.u = 1;
    const { u } = state;
    if (u - sentU > 0.002 || (u === 1 && sentU < 1)) {
      sentU = u;
      emit({ u });
    }
    const speed = ready ? RUSH : 1;
    state.clock += dt * speed;
    lean.x += (lean.toX - lean.x) * (1 - Math.exp(-dt / 0.9));
    lean.y += (lean.toY - lean.y) * (1 - Math.exp(-dt / 0.9));

    place(Math.min(1, u / 0.97), t);
    camXZ[0] = eye[0];
    camXZ[1] = eye[2];

    // the cells' turns, and how far on each one is
    let drawn = true;
    for (const cell of cells) {
      if (!cell.started && u >= cell.u && state.clock >= cell.after) cell.started = true;
      if (cell.started) cell.age += dt * speed;
      if (cell.age < (cell.route === VERTIGO ? PIT_RIMMED : RIMMED)) drawn = false;
    }
    // (the garden once the Door is drawn)
    for (const s of strokes) {
      if (s.start < 0 && u >= s.u && state.clock >= GARDEN_AFTER) s.start = now;
      if (s.start >= 0) s.age += dt * speed;
    }
    if (ready && drawn && u >= 1 && inkedAt < 0) {
      inkedAt = now;
      emit({ inked: true });
    }
    // It lets go once the page says the world is being shown under it (the
    // page's thread can be held up between the two by the world's first
    // frames), or a little after it came to rest if that word never comes.
    if (inkedAt >= 0 && shownAt < 0 && (input.shown || now - inkedAt > 2)) shownAt = now;
    const letGo = shownAt < 0 ? 0 : smooth((now - shownAt - 0.15) / LET_GO_S);
    const wave = shownAt < 0 || still ? -1e9 : (now - shownAt) * SWEEP_SPEED;
    const sweepAt = (d) => (wave < 0 ? 0 : Math.exp(-(((d - wave) / 260) ** 2)));

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.imageSmoothingQuality = 'high';

    // the garden, under the Library: each stroke drawn out at a walking pen's pace
    const gardenInk = (1 - letGo) * (1 + 1.2 * sweepAt(1200));
    const tips = [];
    const P = [0, 0];
    // the paths that fork off the walk, dotted, as the map draws the road not taken
    g.globalAlpha = Math.min(1, GARDEN_INK.fork[3] * gardenInk);
    for (const s of strokes) {
      if (s.kind !== 'fork' || s.start < 0) continue;
      const reach = still ? s.len : Math.min(s.len, s.age * GARDEN_PEN);
      for (const [d, x, z] of s.dots) {
        if (d > reach) break;
        if (project(x, 8, z)) g.drawImage(dot, out[0] - 1.4 * dpr, out[1] - 1.4 * dpr, 2.8 * dpr, 2.8 * dpr);
      }
      if (!still && reach < s.len && project(lerp(s.pts[0][0], s.pts[1][0], reach / s.len), 8, lerp(s.pts[0][1], s.pts[1][1], reach / s.len))) {
        tips.push(out[0], out[1], out[2] * 0.6);
      }
    }
    g.globalAlpha = 1;
    for (const kind of GARDEN_KINDS) {
      if (kind === 'fork') continue;
      g.beginPath();
      for (const s of strokes) {
        if (s.kind !== kind || s.start < 0) continue;
        const reach = still ? s.len : Math.min(s.len, s.age * GARDEN_PEN);
        let pen = false;
        for (let n = 0; n < s.pts.length; n++) {
          const over = s.cum[n] > reach;
          if (over) {
            const f = (reach - s.cum[n - 1]) / (s.cum[n] - s.cum[n - 1]);
            P[0] = lerp(s.pts[n - 1][0], s.pts[n][0], f);
            P[1] = lerp(s.pts[n - 1][1], s.pts[n][1], f);
          } else {
            P[0] = s.pts[n][0];
            P[1] = s.pts[n][1];
          }
          if (!project(P[0], s.y, P[1])) { pen = false; continue; }
          if (pen) g.lineTo(out[0], out[1]); else g.moveTo(out[0], out[1]);
          pen = true;
          if (over) {
            if (!still) tips.push(out[0], out[1], out[2]);
            break;
          }
        }
      }
      const [r, gr, b, alpha, width] = GARDEN_INK[kind];
      g.strokeStyle = `rgba(${r},${gr},${b},${(alpha * gardenInk).toFixed(3)})`;
      g.lineWidth = Math.max(0.6, width * dpr);
      g.stroke();
    }
    // rings going out over the pond from the pavilion
    const water = strokes.find((s) => s.kind === 'water');
    if (!still && water.start >= 0) {
      const calm = smooth((water.age - 1) / 1.5) * gardenInk;
      for (let r = 0; r < 3 && calm > 0; r++) {
        const f = (t * 0.11 + r / 3) % 1;
        g.beginPath();
        let pen = false;
        for (let q = 0; q <= 40; q++) {
          const th = (q / 40) * 2 * Math.PI;
          const x = PAVILION[0] + Math.cos(th) * lerp(34, POND.rx - 8, f);
          const z = PAVILION[1] + Math.sin(th) * lerp(34, POND.rz - 8, f);
          if (!project(x, 8, z)) { pen = false; continue; }
          if (pen) g.lineTo(out[0], out[1]); else g.moveTo(out[0], out[1]);
          pen = true;
        }
        g.strokeStyle = `rgba(159,196,138,${(0.3 * (1 - f) * smooth(f / 0.15) * calm).toFixed(3)})`;
        g.lineWidth = Math.max(0.5, 0.8 * dpr);
        g.stroke();
      }
    }

    // the galleries, far ones first
    for (const cell of cells) {
      if (!cell.started) { cell.depth = -1; continue; }
      const s = cell.scr;
      let ok = true;
      for (let n = 0; n < 6 && ok; n++) {
        ok = project(cell.corners[n][0], TOP, cell.corners[n][1]);
        s[n * 2] = out[0];
        s[n * 2 + 1] = out[1];
      }
      for (let n = 0; n < 6 && ok; n++) {
        ok = project(cell.corners[n][0], FLOOR, cell.corners[n][1]);
        s[12 + n * 2] = out[0];
        s[13 + n * 2] = out[1];
      }
      ok = ok && project(cell.c[0], FLOOR, cell.c[1]);
      s[24] = out[0];
      s[25] = out[1];
      // the lamp's place, and how many pixels a unit is there
      ok = ok && project(cell.c[0], LAMP_Y, cell.c[1]);
      s[26] = out[0];
      s[27] = out[1];
      cell.scale = out[2];
      const margin = 140 * out[2];
      cell.depth = ok && out[0] > -margin && out[0] < W + margin && out[1] > -margin && out[1] < H + margin
        ? 1 / out[2] : -1;
    }
    const order = cells.filter((c) => c.depth > 0).sort((x, y) => y.depth - x.depth);
    for (const cell of order) {
      const sweep = sweepAt(cell.fromVestibule);
      if (cell.route === VERTIGO) drawPit(cell, now, letGo, sweep);
      else drawCell(cell, now, letGo, sweep);
    }

    // light: lamps, the pens' heads, fireflies, the dust in the air
    g.globalCompositeOperation = 'lighter';
    for (const cell of order) {
      if (cell.route === VERTIGO) continue;
      const lamp = lampOf(cell, now) * (1 - letGo);
      if (lamp > 0) {
        const k = cell.scale;
        stamp(cell.scr[26], cell.scr[27], 120 * k * (0.55 + 0.45 * Math.min(1.6, lamp)), 0.5 * lamp);
        stamp(cell.scr[26], cell.scr[27], 9 * k, Math.min(1, 1.2 * lamp));
      }
      if (!still && cell.age < TRACE) {
        for (const [x, y] of penHeads(cell, cell.scr, easeOut(cell.age / TRACE))) {
          stamp(x, y, Math.max(6 * dpr, 16 * cell.scale), 0.9 * cell.ink);
        }
      }
    }
    for (let n = 0; n < tips.length; n += 3) stamp(tips[n], tips[n + 1], Math.max(5 * dpr, 12 * tips[n + 2]), 0.7 * (1 - letGo));
    if (!still) {
      for (const fly of flies) {
        if (fly.path.start < 0) continue;
        const on = smooth((now - fly.path.start) / 1.2) * (1 - letGo);
        const b = Math.max(0, Math.sin(now * fly.blink + fly.phase)) ** 6;
        if (on * b < 0.01) continue;
        const x = fly.x + Math.sin(now * fly.f + fly.phase) * 14;
        const z = fly.z + Math.cos(now * fly.f * 0.8 + fly.phase) * 14;
        if (!project(x, fly.y + Math.sin(now * 0.7 + fly.phase) * 5, z)) continue;
        stamp(out[0], out[1], Math.max(4 * dpr, 10 * out[2]), 0.85 * on * b);
      }
      const air = (1 - letGo) * smooth(t / 2);
      for (const mote of motes) {
        const y = ((mote.y - mote.v * t) % 1 + 1) % 1;
        const x = mote.x + Math.sin(t * 0.3 + mote.w) * 0.012;
        stamp(x * W, y * H, mote.s * 3 * dpr, mote.a * air);
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;

    if (import.meta.env.DEV) {
      beat.busy += performance.now() - now * 1000;
      beat.cells = order.length;
    }
    if (letGo >= 1) {
      stopped = true;
      emit({ gone: true });
    }
  };
    raf = nextFrame(frame);
  return {
    set(m) {
      if (m.size && (m.size.width !== W || m.size.height !== H)) {
        W = canvas.width = m.size.width;
        H = canvas.height = m.size.height;
      }
      if (m.size) dpr = m.size.dpr;
      if (m.rest) input.rest = m.rest;
      if ('progress' in m) input.progress = m.progress;
      if ('ready' in m) input.ready = m.ready;
      if ('shown' in m) input.shown = m.shown;
      if (m.lean) [lean.toX, lean.toY] = m.lean;
      if (!cells && W && input.rest) cells = layCells(seen);
    },
    stop() {
      stopped = true;
      cancelFrame(raf);
    },
  };
}
