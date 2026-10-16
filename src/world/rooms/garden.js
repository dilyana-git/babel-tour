// The garden of forking paths (buildWorld.js, assembleWorld): its layout —
// the pond, the paths, the maze's plan — the raked fork, the wisteria pergola
// and the lanterns.

import * as THREE from 'three';
import { PAVILION, PAVILION_BRIDGE, PAVILION_NORTH_BRIDGE } from '../pavilionBridge';
import { FORK, POND as POND_PLAN, MAZE, MAZE_ENTRY as ENTRY, HEART as MAZE_HEART,
  PAVILION_PATH, MAZE_PATH, SHORE_PATH, FORK_TO_MAZE, LANTERNS, BOUNDARY } from '../gardenPlan';
import { makeRng } from '../textures';
import { growHedge, stripLoop } from '../hedges';
import { edgeStones, RAKE, rakeScuffs, rakeOffset, FORK_STONE, LAWN } from '../forkProps';
import { VINE } from '../gardenProps';
import { LANTERN_HALO } from '../doorProps';
import { gardenRock } from '../shore';
import { ivyLeafGeometry, leafletGeometry, twineWisteria, compoundLeaf } from '../ivy';
import { HEDGE_DIAL } from '../build/common';

export function buildGarden(ctx) {
  const { paintings, light, rnd, dir, add, lerp2, unit2, dist, hexPts, circlePts,
    keep, shorePond, M, root, Batch, slabGeo, RC, cells, P, G, GATE } = ctx;
  // ── The garden ────────────────────────────────────────────────────────────
  const GB = {
    grass: new Batch(M.grass, { cast: false, ...P }), gravel: new Batch(M.gravel, { cast: false, ...P }),
    mazeFloor: new Batch(M.mazeFloor, { cast: false, ...P }), wood: new Batch(M.wood, G), plank: new Batch(M.plank, G),
    // the bridge's boards, each with its grain laid along it rather than projected
    deck: new Batch(M.plank),
    lacquer: new Batch(M.lacquer, G), gold: new Batch(M.gold), ridge: new Batch(M.ridge), stone: new Batch(M.stone, P),
    lantern: new Batch(M.lanternStone, P), paperLit: new Batch(M.lanternPaper, { cast: false, receive: false }),
    paperDead: new Batch(M.paperDead, { cast: false }), iron: new Batch(M.iron),
    rakeDark: new Batch(M.rakeDark, { cast: false, receive: false }), rakeLit: new Batch(M.rakeLit, { cast: false }),
    forkRakeDark: new Batch(M.forkRakeDark, { cast: false, receive: false }), forkPost: new Batch(M.forkPost, G),
    signPost: new Batch(M.signPost, G), signBoard: new Batch(M.signBoard, G),
    pavBronze: new Batch(M.pavBronze),
    // (pavilionProps.js: 13, 3, 4, 10)
    pavGilt: new Batch(M.pavGilt), pavGreen: new Batch(M.pavGreen, { cast: false }), pavChalk: new Batch(M.pavChalk, { cast: false }),
    brocade: new Batch(M.brocade), railWorn: new Batch(M.lacquerWorn, G),
    // the gilt capitals cut round the armillary's pedestal (webProps.js)
    letters: new Batch(M.letters, { cast: false }),
    // and the pedestal's stone, its uv laid round it and up it by webProps.js:
    // projected per face, a turned and reeded surface took the stone's grain
    // in streaks and rope-twists
    pedestal: new Batch(M.pedestalStone),
    newWood: new Batch(M.newWood, G), blackLacquer: new Batch(M.blackLacquer), silk: new Batch(M.silk),
    cushion: new Batch(M.cushion), pavilionThreshold: new Batch(M.plank, G), pavilionStep: new Batch(M.stone, P),
    // the pond's edge (shore.js): its set stones and the bridge's pier, the
    // stone stepped onto the bridge from (a stair, to the body), and the bank
    ...({ shoreStone: new Batch(M.shoreRock), shoreStep: new Batch(M.shoreRock), bank: new Batch(M.bank, { cast: false }) }),
  };
  const rocks = [], ivy = [], fireflies = [], moreFlies = [];
  // lily leaves by kind (pond.js, PAD_KINDS), and the flowers and buds among them
  const lilies = [[], [], [], []], blooms = { white: [], pink: [], whiteBud: [], pinkBud: [] };
  const foliage = [];
  // (the cedars behind the maze, apart: webProps.js — see `beltGroup`)
  const beltFoliage = [], beltWood = [];
  const beltLight = {
    uBackMoon: { value: new THREE.Color() }, uBackMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uBackSky: { value: new THREE.Color() }, uBackGround: { value: new THREE.Color() }, uBackFill: { value: new THREE.Color() },
  };
  const LEAF = ['#4a6b47', '#3f5c46', '#557a52', '#38503f', '#47664a'];
  const BLOSSOM = ['#9d7683', '#b39197', '#8e6a7a'];
  const mazeRoute = [];
  const heartParts = {};
  // A hedge grown over a footprint (hedges.js): its body, and its sprigs drawn
  // and shadowed as the trees' leaf is — those on top on the trees' crossed
  // cards, those on a face on the three upright cards alone.
  const topSprigs = [], faceSprigs = [];
  const plantHedge = (loops, opts) => {
    if (HEDGE_DIAL === 'none') return;
    const { geometry, sprigs, litter } = growHedge(loops, { detail: HEDGE_DIAL === 'bare' ? 0 : light ? 0.5 : 1, ...opts });
    hedgeGround.push(...loops);
    const m = new THREE.Mesh(keep(geometry), M.hedge);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'hedge';
    root.add(m);
    const floor = new THREE.Mesh(keep(litter), M.hedgeLitter);
    floor.receiveShadow = true;
    floor.renderOrder = 1;
    floor.name = 'hedge-litter';
    root.add(floor);
    for (const s of sprigs) (s.flat ? topSprigs : faceSprigs).push(s);
  };
  // A clipped finial (forkProps.js): a drum of the same hedge, domed by the
  // shears, grown through a hedge's line at `p` and standing `up` over its top
  // `H`. From across the garden a hedge is one level stripe of black from edge
  // to edge of the frame; these are what stands out of it.
  const finial = (p, { r, up }, ground, H, seed) => {
    plantHedge([[[p[0] - r, p[1] - r], [p[0] + r, p[1] - r], [p[0] + r, p[1] + r], [p[0] - r, p[1] + r]]], {
      ground, H: H + up, seed, round: r - 0.3, shoulder: r * 0.6, batter: 0.8, foot: 0.6,
    });
  };
  for (const cell of cells) if (cell.garden) GB.grass.add(slabGeo(hexPts(cell.c, RC + 0.5), [], 4, 0));

  const PERGOLA0 = add(GATE, dir(150), 10);
  const J = FORK;
  const POND = POND_PLAN;
  Object.assign(shorePond, POND);
  const PV = PAVILION;
  const SHORE = PAVILION_BRIDGE[0];
  const BRIDGE = PAVILION_BRIDGE;
  const BRIDGE_STAND = lerp2(BRIDGE[1], BRIDGE[2], 0.6);
  const MZ = MAZE;
  const MAZE_ENTRY = ENTRY;
  const HEART = MAZE_HEART;
  // the nine cells round the heart, cleared into one court (the world tour only)
  const COURT = { c0: 3, c1: 5, r0: 2, r1: 4 };
  const COURT_HALF = 1.5 * MZ.cw;
  const POOLS = [{ c: [1088, 482], r: 26 }, { c: [955, 150], r: 22 }];
  const PATHS = [
    { pts: [PERGOLA0, J], w: 18 },
    { pts: PAVILION_PATH, w: 16 },
    { pts: MAZE_PATH, w: 14 },
    { pts: [J, [1120, 160], [1000, 88], [890, 30], [840, -40]], w: 14, fading: true },
  ];
  const segDist = (p, a, b) => {
    const vx = b[0] - a[0], vz = b[1] - a[1];
    const length2 = vx * vx + vz * vz;
    const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / length2)) : 0;
    return dist(p, [a[0] + vx * t, a[1] + vz * t]);
  };
  const lineDist = (p, pts) => Math.min(...pts.slice(1).map((b, i) => segDist(p, pts[i], b)));
  const pathDist = (p) => Math.min(...PATHS.map((path) => lineDist(p, path.pts)));
  // ── The road not taken, taken ────────────────────────────────────────────
  // The Fork parts the two ways a reader has: the Pavilion straight on, and to
  // the right of it, clear of the pergola's last post, the road to the Heart,
  // down to where the way from the water turns into the maze, under the two
  // lanterns that stand there facing it. And the bridge's foot has its own way
  // on along the shore (SHORE_WAY). Whichever way the reader takes at the Fork,
  // the Heart is where it goes.
  //
  // PATHS keeps the first road, which faded out across the lawn to the
  // north-west and led nowhere: the world's stream was spent along it, and
  // still is — the trees, the rocks and the mist stand where they stood, and
  // what a newer road would have stood on is taken up off it. (The second
  // bridge into the Pavilion's north bay comes down onto a landing of its own.)
  const N_SHORE = PAVILION_NORTH_BRIDGE[0];
  const NORTH_BRIDGE = PAVILION_NORTH_BRIDGE;
  const NORTH_OPEN = !paintings;
  const wayThrough = (ctrl, w) => {
    const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const pts = curve.getSpacedPoints(Math.ceil(curve.getLength() / 9)).map((v) => [v.x, v.z]);
    return { ctrl, pts, w };
  };
  const ROAD = wayThrough(FORK_TO_MAZE, 14);
  // from the last leg of the way to the bridge, round the abutment and along
  // the shore, into the way to the maze where it leaves the water
  const SHORE_WAY = wayThrough(SHORE_PATH, 14);
  // and where the road does not come to it, the second bridge's foot stands on
  // gravel all the same: a few paces of it, out past the step to the lawn
  const LANDING = !NORTH_OPEN ? null : (() => {
    const axis = unit2(N_SHORE, NORTH_BRIDGE[1]);
    return { pts: [add(N_SHORE, axis, -3), add(N_SHORE, axis, -14)], w: 16 };
  })();
  const WAYS = [ROAD, SHORE_WAY, LANDING].filter(Boolean);
  const wayDist = (p) => Math.min(...WAYS.map((way) => lineDist(p, way.pts)));
  // what stands on the ground the ways must keep their stones off: the
  // pergola's posts, the lanterns and the waymark, each with the reach of its foot
  const standing = [];
  // the lanterns that stand on the lawn, for the blades their light shows (lawn.js)
  const lawnLamps = [], hedgeGround = [];
  const onNorthBridge = (p, m = 0) => NORTH_BRIDGE.slice(1).some((b, i) => segDist(p, NORTH_BRIDGE[i], b) < 13 + m);
  // And the lawn beyond the dressed garden closed off by a hedge, from the
  // Library's wall west of the Fork round the north of the road and the pond
  // and down past the maze to its wall again: without it there is nothing
  // outside but grass going on into the dark, and a reader could walk out into
  // it. (Both ends stand in the Library's stone. The trees beyond it are the
  // skyline they always were.)
  const boundaryDist = (p) => Math.min(...BOUNDARY.slice(1).map((b, i) => segDist(p, BOUNDARY[i], b)));

  // Keep the shared random budget fixed for the relocated approaches; their
  // edging uses its own stream so longer paths do not move later sections.
  const edgeDraws = [0, 180, 270, 0];
  for (const [pathIndex, path] of PATHS.entries()) {
    const edgeRnd = edgeDraws[pathIndex] ? makeRng(9161 + pathIndex * 6) : rnd;
    const edgeRr = (a, b) => a + (b - a) * edgeRnd();
    // (the first road not taken: its draws, and nothing laid — ROAD is laid
    // below)
    const old = path === PATHS[3];
    path.pts.forEach((p, i) => {
      if (!old) GB.gravel.add(slabGeo(circlePts(p, path.w / 2, 20), [], 1.2, 4));
      if (i === 0) return;
      const a = path.pts[i - 1], L = dist(a, p);
      const t = [(p[0] - a[0]) / L, (p[1] - a[1]) / L], n = [-t[1], t[0]];
      if (!old) GB.gravel.add(slabGeo([add(a, n, path.w / 2), add(p, n, path.w / 2), add(p, n, -path.w / 2), add(a, n, -path.w / 2)], [], 1.2, 4));
      for (let u = 0; u < L; u += 7) {
        for (let s = 0; s < 2; s++) {
          if (path.fading && edgeRnd() < 0.5) continue;
          // (the draws of stones once laid along the edge, spent as they always were)
          edgeRr(-2, 2); edgeRr(0, 1.5);
          edgeRr(0, 3); edgeRr(0, 3); edgeRr(0, 3);
          edgeRr(1.2, 2.3); edgeRr(0.8, 1.6); edgeRr(1.2, 2.3); edgeRnd();
        }
      }
    });
    for (let n = 0; n < edgeDraws[pathIndex]; n++) rnd();
  }
  // The ways' stones set in groups, a big one and smaller ones against it,
  // some sunk, gaps between — not one of a size every seven paces, like beads
  // on a string (forkProps.js). Each from its own stream; none on another
  // way's gravel or down the bank.
  const offPond = (p, m = 4) => ((p[0] - POND.c[0]) / (POND.rx + m)) ** 2 + ((p[1] - POND.c[1]) / (POND.rz + m)) ** 2 > 1;
  const edgeOk = (way) => (p, r) => [...PATHS.slice(0, 3), ...WAYS].every((o) => o === way || lineDist(p, o.pts) > o.w / 2 + r * 0.5) && offPond(p);
  PATHS.slice(0, 3).forEach((path, i) => rocks.push(...edgeStones(path.pts, path.w, 9161 + i * 6, { ok: edgeOk(path) })));

  // The road not taken, laid: gravel the width of the first one, edged with
  // stones as it was (half of them gone, a way less walked), from a stream of
  // its own — and the way along the shore beside it, edged all along as the
  // walked ways are, from another. Neither leaves a stone lying on another
  // way's gravel or down the bank into the water (all of each stone drawn
  // first, so the ones after it are the same whether it is laid or not).
  for (const [way, seed, sparse] of [[ROAD, 9127, true], [SHORE_WAY, 9131, false], [LANDING, 9137, true]]) {
    if (!way) continue;
    const qr = makeRng(seed), qrr = (a, b) => a + (b - a) * qr();
    const { pts, w } = way;
    pts.forEach((p, i) => {
      GB.gravel.add(slabGeo(circlePts(p, w / 2, 20), [], 1.2, 4));
      if (i === 0) return;
      const a = pts[i - 1], L = dist(a, p);
      const t = [(p[0] - a[0]) / L, (p[1] - a[1]) / L], n = [-t[1], t[0]];
      GB.gravel.add(slabGeo([add(a, n, w / 2), add(p, n, w / 2), add(p, n, -w / 2), add(a, n, -w / 2)], [], 1.2, 4));
    });
    for (let i = 1; i < pts.length; i++) {
      const L = dist(pts[i - 1], pts[i]);
      for (let u = 0; u < L; u += 7) {
        for (let s = 0; s < 2; s++) {
          if (sparse && qr() < 0.5) continue;
          qrr(-2, 2); qrr(0, 1.5);
          qrr(0, 6.28); qrr(0, 6.28); qrr(0, 6.28);
          qrr(1.2, 2.3); qrr(0.8, 1.6); qrr(1.2, 2.3); qr();
        }
      }
    }
    rocks.push(...edgeStones(pts, w, seed + 40, { sparse, ok: edgeOk(way) }));
  }
  return { GB, rocks, ivy, fireflies, moreFlies, lilies, blooms, foliage, beltFoliage, beltWood,
    beltLight, LEAF, BLOSSOM, mazeRoute, heartParts, topSprigs, faceSprigs, plantHedge, finial,
    PERGOLA0, J, POND, PV, SHORE, BRIDGE, BRIDGE_STAND, MZ, MAZE_ENTRY, HEART, COURT, COURT_HALF,
    POOLS, PATHS, segDist, lineDist, pathDist, N_SHORE, NORTH_BRIDGE, NORTH_OPEN, ROAD, WAYS,
    wayDist, standing, lawnLamps, hedgeGround, onNorthBridge, BOUNDARY, boundaryDist, offPond };
}

export function buildForkRaked(ctx) {
  const { light, add, lerp2, unit2, dist, wornRibbon, GB, rocks, J, PATHS, lineDist, ROAD } = ctx;
  // ── The fork, raked ──────────────────────────────────────────────────────
  // "Every path taken at once" — and in one flat grey nothing at the reader's
  // feet says that the way divides. So the gravel is raked, as a temple
  // garden's is: grooves running the length of each way, and where the ways
  // part, a flat stone with the grooves going round it in rings and leaving by
  // every road at once. A groove is a dark furrow with the gravel it threw up
  // pale beside it.
  {
    const TOP = 5.2, R0 = 9.6;   // the gravel's top (slabGeo above), the rings' reach
    // (only the stretches of it `keep` keeps: a groove stops where it would
    // run out over another way's gravel)
    // (`o` may be a function of how far along: the passes of the rake wander,
    // forkProps.js; and `gap(s, p)` breaks it — at a stone, or scuffed out)
    const furrow = (pts, o, keep, gap) => {
      let s = 0;
      const along = pts.map((p, i) => (s += i ? dist(pts[i - 1], p) : 0));
      const off = pts.map((p, i) => {
        const t = unit2(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]);
        return add(p, [-t[1], t[0]], typeof o === 'function' ? o(along[i]) : o);
      });
      const runs = [[]];
      off.forEach((p, i) => {
        if ((!keep || keep(p)) && !(gap && gap(along[i], p))) runs[runs.length - 1].push(p);
        else if (runs[runs.length - 1].length) runs.push([]);
      });
      for (const run of runs) {
        if (run.length < 2) continue;
        (GB.forkRakeDark).add(wornRibbon(run, 0.26, TOP + 0.02));
        const lip = run.map((p, i) => {
          const t = unit2(run[Math.max(0, i - 1)], run[Math.min(run.length - 1, i + 1)]);
          return add(p, [-t[1], t[0]], 0.24);
        });
        GB.rakeLit.add(wornRibbon(lip, 0.18, TOP + 0.025));
      }
    };
    // each way from the stone outward, cut back from it to where the rings end
    const fromStone = (pts) => {
      const q = (pts[0] === J ? pts : pts.slice().reverse()).filter((p, i) => i > 0 && dist(p, J) > R0 + 1.5);
      return [add(J, unit2(J, q[0]), R0 + 0.4), ...q];
    };
    // a way's line again with a point every unit or two, so a groove can stop
    // close to where it should
    const fine = (pts) => pts.flatMap((p, i) => {
      if (i === 0) return [p];
      const n = Math.ceil(dist(pts[i - 1], p) / 1.5);
      return Array.from({ length: n }, (_, k) => lerp2(pts[i - 1], p, (k + 1) / n));
    });
    // The road to the Heart leaves the way to the bridge at a narrow angle, and
    // their gravels run together for a few paces past the rings: there its
    // grooves give way to the bridge way's, and it peels off that way's edge
    // rather than crossing it. It is raked to where it meets the way from the
    // water.
    const offWays = (ways) => (p) => ways.every((o) => lineDist(p, o.pts) > o.w / 2 - 0.3);
    const raked = [[PATHS[0].pts, PATHS[0].w], [PATHS[1].pts, PATHS[1].w], [fine([J, ...ROAD.pts.slice(1)]), ROAD.w, offWays([PATHS[1], PATHS[2]])]];
    // the stones a furrow stops short of: whatever sits at the ways' edges
    // (the stones set in groups along them since forkProps.js, the big ones
    // well into the gravel), each with its reach
    const sitting = rocks.filter((r) => r.bank === undefined && dist([r.p[0], r.p[2]], J) < 170)
      .map((r) => ({ p: [r.p[0], r.p[2]], r: Math.max(r.s[0], r.s[2]) + RAKE.clear }));
    const atStone = (p) => sitting.some((st) => Math.abs(st.p[0] - p[0]) < st.r && Math.abs(st.p[1] - p[1]) < st.r && dist(st.p, p) < st.r);
    raked.forEach(([pts, w, keep], wi) => {
      // (a groove every hand's breadth: at twice that, coarse and dark, the
      // raked way read from the stand as a striped walkway)
      // Ruled, they read as a crossing: in passes of a four-tined rake, each
      // pass wandering and the passes drifting apart and together, and a furrow
      // broken where a stone sits and here and there scuffed out.
      const way = fine(fromStone(pts));
      for (let k = 0, o = -(w / 2 - 2.2); o <= w / 2 - 2.2 + 1e-6; o += 1.25, k++) {
        const kk = k, o0 = o, scuffs = rakeScuffs(kk, wi, 600);
        furrow(way, (s) => rakeOffset(kk, o0, s, wi), keep, (s, p) => atStone(p) || scuffs.some(([a, b]) => s >= a && s <= b));
      }
    });
    // (rings carry the ribbons' second uv set too, or the two will not merge)
    const ring = (r0, r1, y) => {
      const g = new THREE.RingGeometry(r0, r1, 64).rotateX(-Math.PI / 2).translate(J[0], y, J[1]);
      g.setAttribute('uv1', g.attributes.uv.clone());
      return g;
    };
    if (!GB.shoreStone) {
      for (let r = 3.1; r <= R0; r += 1.25) {
        (GB.forkRakeDark).add(ring(r - 0.13, r + 0.13, TOP + 0.02));
        GB.rakeLit.add(ring(r + 0.15, r + 0.33, TOP + 0.025));
      }
      // the stone the ways part at, low and flat: stepped on, never stepped round
      GB.stone.add(new THREE.CylinderGeometry(2.3, 2.5, 0.7, 20).scale(1, 1, 0.82).rotateY(0.4).translate(J[0], TOP + 0.2, J[1]));
    } else {
      // (forkProps.js: a stone, not a sawn disc with a groove ruled across
      // it — the garden's granite (shore.js): wider than it is tall, most of it
      // in the ground, cleft and worn and lichened, its top level enough to
      // stand on and no higher over the gravel than a foot goes up without
      // thinking. And the rake goes round the stone it has, not round a compass
      // point: the first ring a hand off its outline, each one rounder, the
      // last the circle the ways' furrows start from.)
      const g = gardenRock({ ...FORK_STONE.rock, flatTop: true, detail: light ? 12 : 22 });
      g.computeBoundingBox();
      g.rotateY(FORK_STONE.turn).translate(J[0], TOP + FORK_STONE.proud - g.boundingBox.max.y, J[1]);
      // its outline where it comes out of the gravel, by bearing
      const N = 96, out = new Float32Array(N), pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < TOP - 0.25 || y > TOP + 0.45) continue;
        const x = pos.getX(i) - J[0], z = pos.getZ(i) - J[1];
        const k = Math.round(((Math.atan2(z, x) / (Math.PI * 2) + 1) % 1) * N) % N;
        out[k] = Math.max(out[k], Math.hypot(x, z));
      }
      const mean = out.reduce((s, v) => s + v, 0) / out.filter((v) => v > 0).length;
      for (let k = 0; k < N; k++) if (!out[k]) out[k] = mean;
      let line = Array.from(out);
      for (let pass = 0; pass < 3; pass++) line = line.map((v, k) => (line[(k + N - 1) % N] + 2 * v + line[(k + 1) % N]) / 4);
      GB.shoreStone.add(g);
      const rings = Math.max(3, Math.round((R0 - mean - 0.8) / 1.25) + 1);
      for (let j = 0; j < rings; j++) {
        const t = j / (rings - 1);
        const at = (off) => Array.from({ length: N + 1 }, (_, k) => {
          const a = ((k % N) / N) * Math.PI * 2, r = (line[k % N] + 0.8) * (1 - t) + R0 * t + off;
          return [J[0] + Math.cos(a) * r, J[1] + Math.sin(a) * r];
        });
        (GB.forkRakeDark).add(wornRibbon(at(0), 0.26, TOP + 0.02));
        GB.rakeLit.add(wornRibbon(at(0.24), 0.18, TOP + 0.025));
      }
    }
  }
}

export function buildPergola(ctx) {
  const { light, rr, add, lerp2, dist, keep, M, root, instances, decal, halo, POOL_DIAL, point,
    hangs, ivyLeaves, vineLeaves, ivyWood, trialPaper, GB, LEAF, J, PATHS, standing } = ctx;
  // ── The wisteria pergola, hung with lanterns ─────────────────────────────
  // What the arch opens onto, and what walks the reader from it to the Fork.
  // Joinery: each post an octagon on a stone base, a bearing block on its head,
  // a tie beam across with its ends cut to a cloud, curved braces up to the
  // beam and along to the purlins, rafters across the top and battens along
  // them — and the wisteria not painted on a card but hanging, a raceme at a
  // time, from the rafters it has taken over, with the old vines it climbed by
  // twisted up four of the posts. Four paper lanterns in the bays, ribbed and
  // capped.
  //
  // Laid out in its own frame — x across, y up, z along from the Door toward
  // the Fork — and set on the path here. None of it draws on the world's stream
  // but the four halos, which always did.
  {
    const a = PATHS[0].pts[0], b = J, L = dist(a, b);
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const frame = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(t[1], 0, -t[0]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(t[0], 0, t[1]),
    ).setPosition(a[0], 0, a[1]);
    const W3 = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(frame);
    const wood = (g) => GB.wood.add(g.applyMatrix4(frame));
    const stone = (g) => GB.stone.add(g.applyMatrix4(frame));
    const lacq = (g) => GB.lacquer.add(g.applyMatrix4(frame));
    const gold = (g) => GB.gold.add(g.applyMatrix4(frame));
    const bx = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    // a side profile [[across, y]] run along z for w, or [[along, y]] run across x for w
    const alongZ = (pts, z0, w) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: w, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, z0);
    const alongX = (pts, x0, w) => alongZ(pts.map(([u, y]) => [-u, y]), 0, w).rotateY(Math.PI / 2).translate(x0, 0, 0);
    const pr = makeRng(6606), within = (lo, hi) => lo + (hi - lo) * pr();
    // Four frames, so the Fork is open ground. A fifth would stand three paces
    // short of the Fork's stone, and from where the reader stops at the Fork
    // its left post would stand exactly in front of the stone lantern beyond it
    // (at one bearing from there, to within a fraction of a degree), and read
    // as a tree trunk.
    const Z0 = 40, BAY = 22, FRAMES = [0, 1, 2, 3, 4].map((k) => Z0 + k * BAY).filter((z) => z < L + 1).slice(0, 4);
    const POST = 17, SPAN = 25, GROUND = 5.2;
    const TIE = [39.4, 42.8], PURLIN = [TIE[1], TIE[1] + 2.6], RAFTER = [PURLIN[1], PURLIN[1] + 1.3];
    const zA = Z0 - 6, zB = FRAMES[FRAMES.length - 1] + 6;
    // A curved brace from (u0, y0) — on the post — up to (u1, y1), under a
    // beam: a band of timber a quarter-circle round, drawn in its own plane.
    const braceShape = (u0, y0, u1, y1, w = 1.25) => {
      // a quarter ellipse about the open corner (u1, y0), and a second one w
      // further out; both ends run into the timber they join
      const rx = Math.abs(u1 - u0), ry = y1 - y0, s = Math.sign(u1 - u0), n = 12;
      const inner = [], outer = [];
      for (let k = 0; k <= n; k++) {
        const th = (k / n) * (Math.PI / 2);
        inner.push([u1 - s * rx * Math.cos(th), y0 + ry * Math.sin(th)]);
        outer.push([u1 - s * (rx + w) * Math.cos(th), y0 + (ry + w) * Math.sin(th)]);
      }
      return [...inner, ...outer.reverse()];
    };
    for (const z of FRAMES) {
      for (const side of [-1, 1]) {
        const x = side * POST, foot = W3(x, 0, z);
        standing.push({ p: [foot.x, foot.z], r: 3.6 });
        // the base: a stone plinth, chamfered, and a drum
        stone(bx(x - 2.5, x + 2.5, GROUND - 0.4, GROUND + 1.2, z - 2.5, z + 2.5));
        stone(bx(x - 2.1, x + 2.1, GROUND + 1.2, GROUND + 1.9, z - 2.1, z + 2.1));
        stone(new THREE.LatheGeometry([[0, 0], [1.95, 0], [1.95, 0.3], [1.7, 0.8], [1.62, 1.4], [0, 1.4]].map(([r, y]) => new THREE.Vector2(r, y)), 16).translate(x, GROUND + 1.9, z));
        // the post, an octagon, with a collar where the brackets take it
        wood(new THREE.CylinderGeometry(1.35, 1.45, TIE[0] - 1.3 - (GROUND + 3.3), 8).rotateY(Math.PI / 8).translate(x, (TIE[0] - 1.3 + GROUND + 3.3) / 2, z));
        wood(new THREE.CylinderGeometry(1.62, 1.62, 0.6, 8).rotateY(Math.PI / 8).translate(x, 31.2, z));
        wood(bx(x - 1.9, x + 1.9, TIE[0] - 1.3, TIE[0], z - 1.9, z + 1.9));
        // braces: along the pergola up to the purlin, both ways, and across up to the tie beam
        for (const way of [-1, 1]) {
          if ((way < 0 && z === FRAMES[0]) || (way > 0 && z === FRAMES[FRAMES.length - 1])) continue;
          wood(alongX(braceShape(z + way * 1.2, 31.6, z + way * 8.5, PURLIN[0]), x - 0.62, 1.25));
        }
        wood(alongZ(braceShape(x - side * 1.2, 32.4, x - side * 7.5, TIE[0]), z - 0.6, 1.2));
      }
      // the tie beam, its ends cut to a cloud beyond the posts
      const cloud = (s) => {
        const pts = [];
        for (let k = 0; k <= 12; k++) {
          const f = k / 12;
          pts.push([s * (POST + 1.6 + f * (SPAN - POST - 1.6)), TIE[0] + 1.9 * (0.5 - 0.5 * Math.cos(Math.PI * f)) - 0.35 * Math.sin(Math.PI * 2 * f)]);
        }
        return pts;
      };
      wood(alongZ([...cloud(-1).reverse(), ...cloud(1), [SPAN, TIE[1] - 0.5], [SPAN - 0.5, TIE[1]], [-SPAN + 0.5, TIE[1]], [-SPAN, TIE[1] - 0.5]], z - 1.25, 2.5));
    }
    // the purlins along the heads of the posts, their ends cut the same way
    for (const side of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 10; k++) { const f = k / 10; pts.push([zA + f * 5.5, PURLIN[0] + 1.6 * (0.5 + 0.5 * Math.cos(Math.PI * f))]); }
      for (let k = 0; k <= 10; k++) { const f = k / 10; pts.push([zB - 5.5 + f * 5.5, PURLIN[0] + 1.6 * (0.5 - 0.5 * Math.cos(Math.PI * f))]); }
      pts.push([zB, PURLIN[1]], [zA, PURLIN[1]]);
      wood(alongX(pts, side * POST - 1.1, 2.2));
    }
    // rafters across the top, their ends splayed, and battens along them
    const rafters = [];
    for (let z = zA + 1.5; z <= zB - 1; z += 3.3) {
      rafters.push(z);
      wood(alongZ([[-SPAN + 1.2, RAFTER[0]], [SPAN - 1.2, RAFTER[0]], [SPAN + 0.6, RAFTER[1]], [-SPAN - 0.6, RAFTER[1]]], z - 0.5, 1));
    }
    for (const x of [-20.5, -12, -4, 4, 12, 20.5]) wood(bx(x - 0.4, x + 0.4, RAFTER[1], RAFTER[1] + 0.7, zA + 0.5, zB - 0.5));
    // old vines up four of the posts, twisted round them and over onto the top
    for (const [x, z, turns] of [[-POST, FRAMES[0], 2.2], [POST, FRAMES[1], 1.8], [-POST, FRAMES[2], 2.5], [POST, FRAMES[3], 2]]) {
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const f = k / 40, ang = f * turns * Math.PI * 2 + x * 0.1, r = 1.9 + Math.sin(f * 9) * 0.2;
        pts.push(new THREE.Vector3(x + Math.cos(ang) * r, GROUND + 1 + f * (RAFTER[1] - GROUND - 0.4), z + Math.sin(ang) * r));
      }
      for (let k = 1; k <= 8; k++) pts.push(new THREE.Vector3(x + Math.sin(k) * 0.8, RAFTER[1] + 0.6 + Math.sin(k * 1.7) * 0.3, z + k * 2.6 * (x < 0 ? 1 : -1)));
    }
    // (ivy.js) The same four vines grown as wisteria grows: out of the ground
    // beside the plinth, over its edge, two strands twisted on each other as
    // they twine the post, thick and grey-barked at the foot and thinning as
    // they climb; up past the head of the post on the outside, clear of the
    // tie beam, and over onto the rafters, where the run of the old vine
    // went; leaves off the upper post and the run, and a few young shoots
    // reaching out into the air.
    {
      const vr = makeRng(6611), VR = (lo, hi) => lo + (hi - lo) * vr();
      const qf = new THREE.Quaternion().setFromRotationMatrix(frame), eu = new THREE.Euler();
      const shootTint = new THREE.Color('#7d7a52');
      const VINE_GREEN = ['#4f6e30', '#5a7a36', '#476629', '#62823a', '#55743a'];
      for (const [x, z, turns] of [[-POST, FRAMES[0], 2.2], [POST, FRAMES[1], 1.8], [-POST, FRAMES[2], 2.5], [POST, FRAMES[3], 2]]) {
        const sx = Math.sign(x), runZ = x < 0 ? 1 : -1;
        // the side of the tie beam to go up past: the one farther from a rafter
        const clear = (zz) => Math.min(...rafters.map((r) => Math.abs(r - zz)));
        const dz = clear(z + 1.6) >= clear(z - 1.6) ? 1.6 : -1.6;
        const over = [
          new THREE.Vector3(x + sx * 2.0, TIE[0] - 0.4, z + dz * 1.1),
          new THREE.Vector3(x + sx * 2.5, TIE[0] + 2.1, z + dz * 1.05),
          new THREE.Vector3(x + sx * 2.6, PURLIN[0] + 1.8, z + dz * 0.97),
          new THREE.Vector3(x + sx * 2.0, RAFTER[1] + 0.45, z + dz * 0.8),
        ];
        for (let k = 1; k <= 6; k++) over.push(new THREE.Vector3(x + sx * 1.4 + Math.sin(k * 1.3) * 0.7, RAFTER[1] + 0.45 + Math.max(0, Math.sin(k * 1.7)) * 0.25, z + dz * 0.8 + k * 2.6 * runZ));
        const vine = twineWisteria({
          x, z, postR: 1.5, plinthR: 2.5, ground: GROUND, foot: { r: 1.95, y: GROUND + 3.3 }, top: TIE[0] - 1.8, turns,
          endAngle: Math.atan2(dz * 1.1, sx * 2.0), over,
          // (gardenProps.js: not a grey ribbon of one width)
          rope: VINE,
        }, vr);
        vine.strands.forEach((st, k) => {
          const nodes = st.map((nd) => ({ p: nd.p.clone().applyMatrix4(frame), r: nd.r }));
          ivyWood.tube(nodes, 12, new THREE.Color(VINE.tints[k % VINE.tints.length]), { ribs: { n: VINE.stems[k].ribs, deep: VINE.stems[k].deep, spin: 0.45 + 0.1 * k } });
        });
        for (const sh of vine.shoots) ivyWood.tube(sh.map((nd) => ({ p: nd.p.clone().applyMatrix4(frame), r: nd.r })), 4, shootTint);
        for (const lf of vine.leaflets) {
          const p = lf.p.clone().applyMatrix4(frame);
          eu.setFromQuaternion(qf.clone().multiply(lf.q));
          const s = lf.s * 0.72;
          vineLeaves.push({ p: [p.x, p.y, p.z], rot: [eu.x, eu.y, eu.z], s: [s, s, s], color: VINE_GREEN[Math.floor(vr() * VINE_GREEN.length)], k: VR(0.85, 1.1) });
        }
      }
    }
    // The wisteria: a raceme from the rafters every couple of units, longest
    // at the sides and short over the path, so the way through is a tunnel of
    // flowers that clears the head; leaves in with them; and leaf over the top.
    for (const z of rafters) {
      for (let x = -SPAN + 2 + pr() * 1.5; x < SPAN - 2; x += within(1.6, 2.8)) {
        const edge = Math.min(1, Math.abs(x) / POST), green = pr() < 0.28;
        const len = (green ? within(6, 12) : within(5, 9)) + edge * edge * within(4, 9);
        const q = W3(x + within(-0.4, 0.4), RAFTER[0] + 0.1, z + within(-0.6, 0.6));
        const yaw = pr() * Math.PI, wide = green ? within(3, 4.2) : within(2.8, 3.8), kind = green ? 2 + Math.floor(pr() * 2) : Math.floor(pr() * 2), k = within(0.85, 1.1);
        if (RAFTER[0] - len < 30 + (1 - edge) * 4) continue;
        hangs.push({ p: [q.x, q.y, q.z], rot: [0, yaw, 0], s: [wide, len, 1], kind, color: green ? '#c4d0c0' : '#e6dcec', k });
      }
    }
    let canopy = 0;
    const canopyFrame = new THREE.Quaternion().setFromRotationMatrix(frame), canopyEuler = new THREE.Euler();
    const CANOPY_GREEN = ['#3f5c28', '#4a6a2e', '#3a5524', '#55743a'];
    for (let z = zA + 2; z < zB - 2; z += within(3.5, 5)) {
      for (const x of [-18, -9, 0, 9, 18]) {
        const skip = pr() < 0.25;
        const q = W3(x + within(-3, 3), RAFTER[1] + within(1.2, 2.4), z);
        const item = { p: [q.x, q.y, q.z], rot: [within(-0.2, 0.2), pr() * 6.28, within(-0.2, 0.2)], s: Array(3).fill(within(6, 9.5)), color: LEAF[Math.floor(pr() * LEAF.length)], k: within(0.55, 0.8) };
        if (skip) continue;
        // (ivy.js) not a ball of painted leaf on the battens but the leaves
        // themselves: a spread of wisteria leaves where it lay, laid out over
        // the rafters and hanging between them
        const cr = makeRng(7000 + canopy++), CR = (lo, hi) => lo + (hi - lo) * cr();
        const S = item.s[0];
        for (let n = 0; n < (light ? 6 : 12); n++) {
          const a = cr() * Math.PI * 2, r = Math.sqrt(cr()) * S * 0.42;
          const base = new THREE.Vector3(x + Math.cos(a) * r, RAFTER[1] + CR(0.3, 1.4), z + Math.sin(a) * r);
          const dirn = new THREE.Vector3(Math.cos(a + CR(-0.6, 0.6)), CR(-0.25, 0.25), Math.sin(a + CR(-0.6, 0.6))).normalize();
          const got = [];
          compoundLeaf(base, dirn, CR(2.6, 3.8), 0.72 * CR(0.85, 1.15), cr, got);
          for (const lf of got) {
            const p = lf.p.applyMatrix4(frame);
            canopyEuler.setFromQuaternion(canopyFrame.clone().multiply(lf.q));
            vineLeaves.push({ p: [p.x, p.y, p.z], rot: [canopyEuler.x, canopyEuler.y, canopyEuler.z], s: [lf.s, lf.s, lf.s], color: CANOPY_GREEN[Math.floor(cr() * CANOPY_GREEN.length)], k: CR(0.7, 1.0) });
          }
        }
      }
    }
    if (ivyLeaves.length) instances(ivyLeafGeometry(), M.ivyLeaf, ivyLeaves, { cast: false, chunked: true, name: 'ivy' });
    if (vineLeaves.length) instances(leafletGeometry(), M.vineLeaf, vineLeaves, { cast: false, chunked: true, name: 'ivy' });
    if (ivyWood.pos.length) {
      const g = keep(ivyWood.geometry());
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, M.bark);
      m.castShadow = true;
      m.receiveShadow = true;
      // (not felt: a foot or a shoulder brushes past ivy — body.js, UNFELT)
      m.name = 'ivyStems';
      root.add(m);
    }
    // The lanterns: round paper globes on cords, a fine bamboo rib every so
    // often round them, a lacquered cap and foot, and a short silk tassel.
    for (const z of [51, 73, 95, 117]) {
      // (the fourth bay went with the fifth frame; its halo's draw is still taken)
      if (z > zB) { rr(0, 100); continue; }
      const LY = 29.5, R = 2.6, H = 2.75, p = W3(0, LY, z);
      // (the paper lit from its flame, the ribs drawn in it — lampPass.js)
      trialPaper.push({ p: [p.x, p.y, p.z], s: [R, H, R], color: '#fff0e0', k: 1.0 });
      lacq(new THREE.CylinderGeometry(0.9, 1.25, 0.55, 18).translate(0, LY + H - 0.05, z));
      lacq(new THREE.CylinderGeometry(1.25, 0.95, 0.5, 18).translate(0, LY - H + 0.05, z));
      gold(new THREE.CylinderGeometry(0.28, 0.4, 0.45, 10).translate(0, LY + H + 0.45, z));
      wood(new THREE.CylinderGeometry(0.08, 0.08, RAFTER[0] - LY - H - 0.6, 5).translate(0, (RAFTER[0] + LY + H + 0.6) / 2, z));
      gold(new THREE.SphereGeometry(0.28, 10, 8).translate(0, LY - H - 0.55, z));
      lacq(new THREE.CylinderGeometry(0.18, 0.34, 2.1, 10).translate(0, LY - H - 1.8, z));
      // (from the Door the three lay one on another down the pergola: doorProps.js)
      halo([p.x, p.z], LY, LANTERN_HALO.size, '#ffb866', LANTERN_HALO.opacity);
    }
    point(add(a, t, 64), 25, '#ffb866', 4200, 6);
    decal(lerp2(a, b, 0.5), 220, 130, '#ffae5c', 0.24 * POOL_DIAL, 5.8, 0.12);
  }
}

export function buildLanterns(ctx) {
  const { light, add, unit2, detail, lanternPoolTex, lampHaloTex, decal, halo, POOL_DIAL,
    waterLamps, GATE, GB, plantHedge, J, standing, lawnLamps } = ctx;
  // ── Lanterns ─────────────────────────────────────────────────────────────
  // Tōrō of the Kasuga kind: a six-sided foot under a ring of lotus petals
  // turned down; a round post with a knot at its middle; a platform on petals
  // turned up; the fire box, a paper window front and back and the sun and the
  // moon cut through two more of its sides; a wide six-sided roof whose corners
  // curl up like young fern; and the jewel on top. The light is inside, behind
  // paper, and falls first on the lantern's own stone (flameLit).
  //
  // Each is built about its own axis (y is the world's) with face 0 of every
  // hexagon at 30° and a corner at 0°, as three's six-sided cylinders have
  // them, then turned and set down. None of it draws on the world's stream but
  // the halo and the pool, which always did.
  const HEX = Math.PI / 3;
  const V2 = (x, y) => new THREE.Vector2(x, y);
  // A sheet of quads from fn(u, v) → [x, y, z], u and v 0 to 1; `flip` turns it over.
  const sheet = (fn, nu, nv, flip = false) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { pos.push(...fn(i / nu, j / nv)); uv.push(i / nu, j / nv); }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = i * (nv + 1) + j, b = a + nv + 1;
        if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1);
        else idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const lathe = (prof, n) => new THREE.LatheGeometry(prof.map(([r, y]) => V2(r, y)), n);
  // Lotus petals turned on a lathe: `prof` is [r, y, w] from the bottom up, w
  // how far out toward the petals' free edge that ring lies (0 at the root),
  // so the petals part at their tips and are one stone at the root.
  const petalLathe = (prof, petals, depth, per = 6) => {
    const n = petals * Math.max(4, Math.round(per * detail));
    const g = lathe(prof, n), pos = g.attributes.position, np = prof.length;
    for (let i = 0; i <= n; i++) {
      const lobe = Math.sqrt(Math.abs(Math.cos((i / n) * Math.PI * petals)));
      for (let j = 0; j < np; j++) {
        const k = i * np + j, s = 1 - depth * prof[j][2] * (1 - lobe);
        pos.setX(k, pos.getX(k) * s);
        pos.setZ(k, pos.getZ(k) * s);
      }
    }
    g.computeVertexNormals();
    return g;
  };
  // A side of a six-sided box, `w` wide and `t` thick, with what is cut
  // through it; laid with its outer face at z = 0, for `onFace` to set on face k.
  const panel = (w, y0, y1, t, holes = []) => {
    const s = new THREE.Shape([V2(-w / 2, y0), V2(w / 2, y0), V2(w / 2, y1), V2(-w / 2, y1)]);
    s.holes.push(...holes);
    return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: light ? 8 : 16 }).translate(0, 0, -t);
  };
  const onFace = (g, k, R) => {
    const a = (k + 0.5) * HEX, apo = R * Math.cos(HEX / 2);
    return g.rotateY(a).translate(Math.sin(a) * apo, 0, Math.cos(a) * apo);
  };
  // The moon: a disc with a second, offset disc taken out of it.
  const crescent = (cx, cy, r1, ox, oy, r2, n = 18) => {
    const d = Math.hypot(ox, oy), beta = Math.atan2(oy, ox);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const g1 = Math.acos(a / r1), g2 = Math.acos((d - a) / r2);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const th = beta + g1 + (2 * Math.PI - 2 * g1) * (i / n);
      pts.push(V2(cx + r1 * Math.cos(th), cy + r1 * Math.sin(th)));
    }
    for (let i = 1; i < n; i++) {
      const th = beta + Math.PI + g2 - 2 * g2 * (i / n);
      pts.push(V2(cx + ox + r2 * Math.cos(th), cy + oy + r2 * Math.sin(th)));
    }
    return new THREE.Path(pts);
  };
  // A six-sided roof: R to its corners at the eave; the underside of the eave
  // at y0 mid-side, T thick there; rising H, hollowed, to a ring of radius
  // `top`; the corners lifted by `lift`, and the underside meeting the box it
  // sits on at `seat`. One sheet per slope, so the hips stay sharp.
  const hexRoof = ({ R, y0, T, H, lift, top, seat, nu = 10, nv = 8 }) => {
    const geos = [];
    for (let k = 0; k < 6; k++) {
      const at = (u) => {
        const phi = (k + u) * HEX;
        return { s: Math.sin(phi), c: Math.cos(phi), r: R * Math.cos(HEX / 2) / Math.cos((u - 0.5) * HEX), up: lift * Math.abs(2 * u - 1) ** 7 };
      };
      geos.push(sheet((u, t) => {
        const a = at(u), r = a.r + (top - a.r) * t;
        return [a.s * r, y0 + T + H * (0.45 * t + 0.55 * t * t) + a.up * (1 - t) ** 2.5, a.c * r];
      }, nu, nv));
      geos.push(sheet((u, v) => { const a = at(u); return [a.s * a.r, y0 + a.up + T * v, a.c * a.r]; }, nu, 1));
      geos.push(sheet((u, t) => {
        const a = at(u), r = a.r + (seat - a.r) * t;
        return [a.s * r, y0 + a.up * (1 - t) ** 2.5 + 0.25 * t, a.c * r];
      }, nu, 4, true));
    }
    return geos;
  };
  // Its hips: a rolled ridge down each, and at each corner the fern — a scroll
  // rising off the tip and rolling back in on itself, tighter as it goes (a
  // ring of even radius leaves a hole through it and reads as a handle).
  const roofCorners = ({ R, y0, T, H, lift, top }, rho, tube, ridge) => {
    const geos = [];
    for (let k = 0; k < 6; k++) {
      const phi = k * HEX, s = Math.sin(phi), c = Math.cos(phi), pts = [];
      for (let j = 0; j <= 10; j++) {
        const t = 0.04 + 0.9 * (j / 10), r = R + (top - R) * t;
        pts.push(new THREE.Vector3(s * r, y0 + T + H * (0.45 * t + 0.55 * t * t) + lift * (1 - t) ** 2.5 + ridge * 0.5, c * r));
      }
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, ridge, 5, false));
      const out = R - rho * 0.6, curl = [];
      for (let j = 0; j <= 16; j++) {
        const f = j / 16, th = -Math.PI / 2 + f * Math.PI * 2.1, r = rho * (1 - 0.62 * f);
        curl.push(new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, 0));
      }
      const eye = [s * out, y0 + T + lift + rho * 0.55, c * out];
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curl), 20, tube, 6, false).rotateY(phi - Math.PI / 2).translate(...eye));
      geos.push(new THREE.SphereGeometry(tube * 0.9, 8, 6).translate(...eye));
    }
    return geos;
  };
  // Paper with a flame behind it: brightest and palest nearest the flame,
  // deepening to amber and dimming toward its edges, as a shōji does. In
  // vertex colours, so the sheet is cut fine enough to carry the fall-off.
  const paperHot = new THREE.Color('#ffd9a4'), paperEdge = new THREE.Color('#ff9f55'), paperC = new THREE.Color();
  const litPaper = (geo, flame, near, strength) => {
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const f = Math.min(1.25, ((near * near) / v.fromBufferAttribute(pos, i).distanceToSquared(flame)) ** 1.4);
      paperC.copy(paperEdge).lerp(paperHot, Math.min(1, f)).multiplyScalar(strength * (0.28 + 1.1 * f));
      col.set([paperC.r, paperC.g, paperC.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  };

  // `face`: what the windows look toward.
  const toro = (p, lit, face) => {
    standing.push({ p, r: 4.2 });
    const yaw = Math.atan2(face[0] - p[0], face[1] - p[1]) - HEX / 2;
    const flame = new THREE.Vector3(p[0], 20.5, p[1]), axis = [Math.sin(yaw + HEX / 2), Math.cos(yaw + HEX / 2)];
    const set = (g) => g.rotateY(yaw).translate(p[0], 0, p[1]);
    const stone = (g) => {
      set(g);
      const n = g.attributes.position.count, f = [flame.x, flame.y, flame.z, lit ? 13 : 0];
      g.setAttribute('aFlame', new THREE.BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => f[i % 4]), 4));
      g.setAttribute('aFlameAxis', new THREE.BufferAttribute(Float32Array.from({ length: n * 2 }, (_, i) => axis[i % 2]), 2));
      GB.lantern.add(g);
    };
    const round = Math.round(20 * detail);
    // the foot
    stone(new THREE.CylinderGeometry(4.0, 4.15, 2.9, 6).translate(0, 5.05, 0));
    stone(new THREE.CylinderGeometry(3.75, 3.95, 0.35, 6).translate(0, 6.675, 0));
    stone(petalLathe([[3.55, 6.8, 1], [3.5, 7.1, 0.95], [3.2, 7.55, 0.75], [2.65, 8.0, 0.45], [2.05, 8.35, 0.15], [1.7, 8.55, 0], [1.45, 8.6, 0]], 12, 0.2));
    // the post, with the knot at its middle
    stone(new THREE.CylinderGeometry(1.28, 1.42, 7.8, round).translate(0, 12.4, 0));
    stone(new THREE.CylinderGeometry(1.58, 1.58, 0.55, round).translate(0, 12.3, 0));
    for (const y of [11.8, 12.8]) stone(new THREE.TorusGeometry(1.45, 0.16, 6, round).rotateX(Math.PI / 2).translate(0, y, 0));
    // the platform, on petals turned up
    stone(petalLathe([[1.25, 16.1, 0], [1.6, 16.35, 0.1], [2.3, 16.8, 0.4], [2.95, 17.35, 0.75], [3.3, 17.85, 0.95], [3.25, 18.05, 1]], 12, 0.22));
    stone(new THREE.CylinderGeometry(3.45, 3.6, 0.85, 6).translate(0, 18.45, 0));
    stone(new THREE.CylinderGeometry(3.05, 3.3, 0.3, 6).translate(0, 19.0, 0));
    // The fire box. Windows on faces 0 and 3, the sun through face 1 and the
    // moon through face 4, and on the last two a panel carved in low relief.
    const FB = [19.15, 23.25], RB = 2.65, TH = 0.38, WIN = [-0.78, 0.78, 19.75, 22.6], SUN = 21.55;
    for (let k = 0; k < 6; k++) {
      const holes = k % 3 === 0 ? [new THREE.Path([V2(WIN[0], WIN[2]), V2(WIN[1], WIN[2]), V2(WIN[1], WIN[3]), V2(WIN[0], WIN[3])])]
        : k === 1 ? [new THREE.Path().absarc(0, SUN, 0.56, 0, Math.PI * 2, false)]
          : k === 4 ? [crescent(0, SUN, 0.6, 0.22, 0.12, 0.56)] : [];
      stone(onFace(panel(RB, FB[0], FB[1], TH, holes), k, RB));
      if (k === 2 || k === 5) {
        for (const g of [
          new THREE.BoxGeometry(0.16, 3.36, 0.1).translate(-0.86, 21.2, 0.05), new THREE.BoxGeometry(0.16, 3.36, 0.1).translate(0.86, 21.2, 0.05),
          new THREE.BoxGeometry(1.88, 0.16, 0.1).translate(0, 19.6, 0.05), new THREE.BoxGeometry(1.88, 0.16, 0.1).translate(0, 22.8, 0.05),
        ]) stone(onFace(g, k, RB));
      }
      stone(new THREE.CylinderGeometry(0.3, 0.3, FB[1] - FB[0], 8).translate(Math.sin(k * HEX) * RB, (FB[0] + FB[1]) / 2, Math.cos(k * HEX) * RB));
    }
    stone(new THREE.CylinderGeometry(RB + 0.28, RB + 0.2, 0.4, 6).translate(0, FB[1] + 0.2, 0));
    // what the light comes through: paper behind every opening, and a shōji
    // in each window — its frame, and the lattice across it
    const near = RB * Math.cos(HEX / 2) - TH - 0.02;
    const paper = (g, k) => {
      set(onFace(g.translate(0, 0, -TH - 0.02), k, RB));
      if (lit) GB.paperLit.add(litPaper(g, flame, near, 0.8));
      else GB.paperDead.add(g);
    };
    for (const k of [0, 3]) {
      paper(new THREE.PlaneGeometry(1.9, 3.1, 4, 8).translate(0, (WIN[2] + WIN[3]) / 2, 0), k);
      const mid = (WIN[2] + WIN[3]) / 2, h = WIN[3] - WIN[2], w = WIN[1] - WIN[0], z = -TH + 0.09;
      for (const g of [
        new THREE.BoxGeometry(0.13, h, 0.14).translate(WIN[0] + 0.065, mid, z), new THREE.BoxGeometry(0.13, h, 0.14).translate(WIN[1] - 0.065, mid, z),
        new THREE.BoxGeometry(w, 0.13, 0.14).translate(0, WIN[2] + 0.065, z), new THREE.BoxGeometry(w, 0.13, 0.14).translate(0, WIN[3] - 0.065, z),
        ...[-0.22, 0.22].map((u) => new THREE.BoxGeometry(0.06, h, 0.08).translate(u, mid, z)),
        ...[1, 2, 3].map((j) => new THREE.BoxGeometry(w, 0.06, 0.08).translate(0, WIN[2] + (h * j) / 4, z)),
      ]) GB.wood.add(set(onFace(g, k, RB)));
    }
    for (const k of [1, 4]) paper(new THREE.PlaneGeometry(1.5, 1.5, 3, 3).translate(0, SUN, 0), k);
    // the roof, and the jewel on it
    const roof = { R: 5.5, y0: 23.35, T: 0.72, H: 2.35, lift: 0.4, top: 1.15, seat: 2.95 };
    hexRoof({ ...roof, nu: light ? 5 : 10, nv: light ? 4 : 8 }).forEach(stone);
    roofCorners(roof, 0.32, 0.2, 0.2).forEach(stone);
    const yT = roof.y0 + roof.T + roof.H, b = yT + 0.95;
    stone(lathe([[0, yT - 0.35], [1.32, yT - 0.35], [1.38, yT + 0.05], [1.25, yT + 0.4], [0.95, yT + 0.55], [0, yT + 0.55]], round));
    stone(petalLathe([[0.55, yT + 0.5, 0], [0.8, yT + 0.72, 0.35], [1.02, yT + 1.0, 0.8], [1.05, yT + 1.12, 1]], 8, 0.25));
    stone(lathe([[0, b], [0.42, b], [0.72, b + 0.22], [0.9, b + 0.55], [0.88, b + 0.88], [0.72, b + 1.2], [0.48, b + 1.5], [0.26, b + 1.78], [0.1, b + 2.0], [0, b + 2.15]], round));
    if (lit) {
      waterLamps.push({ p: [p[0], 21, p[1]], color: '#ffcd86', k: 1.1 });
      lawnLamps.push({ p, y: 21, ...LAWN.toro });
      halo(p, 21.2, 18, '#ffc070', 0.14, lampHaloTex);
      // the light it lays on the ground, out of its windows
      const pool = decal(p, 100, 76, '#ffb462', 0.3 * POOL_DIAL, 5.3, 0.14);
      pool.material.map = lanternPoolTex;
      pool.rotation.y = yaw + HEX / 2 - Math.PI / 2;
    }
  };
  // (the road to the Heart leaves the Fork where the first stood, and the way
  // along the shore passes where the second did: each stepped back onto the
  // lawn beside its way, still facing what it lit)
  for (const { at, toward } of LANTERNS) toro(at, true, toward);
  toro([1098, 140], false, J);
  toro([1030, 60], false, J);

  // Hedges either side of the way out, close enough to be seen through the
  // breach: "beyond the jamb, hedges breathe under a green moon".
  {
    const along = unit2(GATE, J), across = [along[1], -along[0]];
    for (const side of [-1, 1]) {
      const a = add(add(GATE, along, 20), across, side * 21);
      const b = add(add(GATE, along, 108), across, side * 21);
      plantHedge([stripLoop(a, b, 9)], { ground: 4, H: 17, seed: side < 0 ? 21 : 22 });
    }
  }

  // A tsuri-dōrō: a six-sided iron lantern, a lattice round paper, under a
  // roof of its own, hung by its ring over `lp` — the one on the Fork's
  // signpost, and the one in the hedge by the Web of Time's stand
  // (gardenProps.js). `dy`: how much lower than the signpost's it hangs.
  const tsuriDoro = (lp, yaw, dy = 0) => {
    const flame = new THREE.Vector3(lp[0], 20.6 + dy, lp[1]);
    const iron = (g) => GB.iron.add(g.translate(0, dy, 0).rotateY(yaw).translate(lp[0], 0, lp[1]));
    iron(new THREE.TorusGeometry(0.32, 0.07, 6, 14).translate(0, 24.1, 0));
    iron(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6).translate(0, 23.45, 0));
    const roof = { R: 1.75, y0: 22.05, T: 0.14, H: 0.8, lift: 0.26, top: 0.2, seat: 1.0 };
    hexRoof({ ...roof, nu: light ? 3 : 6, nv: 4 }).forEach(iron);
    roofCorners(roof, 0.13, 0.055, 0.06).forEach(iron);
    iron(new THREE.SphereGeometry(0.27, 10, 8).translate(0, roof.y0 + roof.T + roof.H + 0.1, 0));
    const RB = 1.1, Y = [19.3, 22.05], h = Y[1] - Y[0], mid = (Y[0] + Y[1]) / 2;
    iron(new THREE.CylinderGeometry(RB + 0.14, RB - 0.05, 0.28, 6).translate(0, Y[0] - 0.1, 0));
    iron(new THREE.CylinderGeometry(RB + 0.1, RB + 0.1, 0.16, 6).translate(0, Y[1] - 0.02, 0));
    iron(new THREE.ConeGeometry(0.22, 0.7, 6).rotateX(Math.PI).translate(0, Y[0] - 0.6, 0));
    for (let k = 0; k < 6; k++) {
      iron(new THREE.CylinderGeometry(0.07, 0.07, h, 5).translate(Math.sin(k * HEX) * RB, mid, Math.cos(k * HEX) * RB));
      for (const g of [
        ...[-0.18, 0.18].map((u) => new THREE.BoxGeometry(0.05, h, 0.05).translate(u, mid, 0.01)),
        ...[1, 2].map((j) => new THREE.BoxGeometry(RB, 0.05, 0.05).translate(0, Y[0] + (h * j) / 3, 0.01)),
      ]) iron(onFace(g, k, RB));
      const sheetG = onFace(new THREE.PlaneGeometry(RB - 0.06, h, 2, 6).translate(0, mid, -0.06), k, RB).translate(0, dy, 0).rotateY(yaw).translate(lp[0], 0, lp[1]);
      GB.paperLit.add(litPaper(sheetG, flame, RB * Math.cos(HEX / 2) - 0.06, 0.75));
    }
    return flame;
  };
  return { tsuriDoro };
}
