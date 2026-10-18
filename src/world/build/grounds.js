// The garden's trees and the mist on its grass (buildWorld.js,
// assembleWorld).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PAVILION_BRIDGE_HALF_WIDTH } from '../pavilionBridge';
import { PAVILION_PATH, gardenWalks } from '../gardenPlan';
import { makeRng, FOLIAGE_KINDS } from '../textures';
import { makeSparkles, makeFoliageDepthMaterial, crossedCards, makeBackdropFoliage } from '../effects';
import { Wood, growTree } from '../trees';
import { bindSceneDepth } from '../softDepth';
import { WATER_Y } from '../water';
import { lilyFlowerGeometry, lilyBudGeometry } from '../pond';
import { WAYMARK, BLOSSOM_NIGHT, FINIALS, LAWN } from '../forkProps';
import { WILLOW } from '../pavilionProps';
import { lawnBlades, swardLit, lawnSward, edgeTufts } from '../lawn';
import { MIST_COLOR, TUFTS, trackMist, SWARD, GRASS, paintSward, FEATHER } from '../gardenProps';
import { SCREEN, screenPlaces, GATE as WEB_GATE, FLIES, BELT, closeBelt, SPIRE, inCourtView } from '../webProps';
import { pondShore, rockVariants, guardStones } from '../shore';
import { ONE_TREE, NO_BOUND } from './common';

export function* buildTrees(ctx) {
  const { light, paintings, rnd, rr, pick, dir, add, dist, keep, M, root, instances, chunkKey, inGarden, hangs,
    GATE, foliage, beltFoliage, beltWood, LEAF, BLOSSOM, PERGOLA0, J, POND, MZ,
    POOLS, PATHS, segDist, pathDist, NORTH_OPEN, wayDist, onNorthBridge, boundaryDist } = ctx;
  // ── Trees (trees.js) ──────────────────────────────────────────────────────
  // (the cedars behind the maze, in a group of their own: webProps.js)
  let beltGroup = null;
  // Where they stand is drawn from the world's stream, which this spends to the
  // draw exactly as the first trees did, so the shrubs, the mist and everything
  // after keep their places. What each tree IS comes from a stream of its own,
  // and from where it stands: willows and black pines on the pond's far bank,
  // leaning out to the water; maples and pines in the middle ground the walk
  // looks across; cherries where the old ones were in blossom; and beyond,
  // broad trees and the tall cedars that make the skyline. A tree never walked
  // near is grown without twigs.
  {
    const blocked = (p, m = 0) => !inGarden(p)
      || pathDist(p) < 24 + m
      || ((p[0] - POND.c[0]) / (POND.rx + 22 + m)) ** 2 + ((p[1] - POND.c[1]) / (POND.rz + 22 + m)) ** 2 < 1
      || (p[0] > MZ.x0 - 16 - m && p[0] < MZ.x0 + MZ.cols * MZ.cw + 16 + m && p[1] > MZ.z0 - 16 - m && p[1] < MZ.z0 + MZ.rows * MZ.ch + 16 + m)
      || segDist(p, PATHS[0].pts[0], J) < 36 + m
      || dist(p, add(J, dir(WAYMARK.bearing), WAYMARK.dist)) < 40
      || POOLS.some((pool) => dist(p, pool.c) < pool.r + 24 + m);
    // the line the walk takes through the garden, and how far off it a place is
    const WALK = gardenWalks(GATE, PERGOLA0);
    const walkDist = (p) => Math.min(...WALK.flatMap((pts) => pts.slice(1).map((b, i) => segDist(p, pts[i], b))));
    const pondGap = (p) => (Math.hypot((p[0] - POND.c[0]) / POND.rx, (p[1] - POND.c[1]) / POND.rz) - 1) * ((POND.rx + POND.rz) / 2);
    const tr = makeRng(5150), trr = (a, b) => a + (b - a) * tr(), tpick = (xs) => xs[Math.floor(tr() * xs.length)];
    // Leaf colours by kind. Greens toward olive — the moon cools them enough —
    // and the maples in their autumn reds, which the lanterns catch.
    const TINT = {
      broad: ['#56683f', '#4d6140', '#5d6c43', '#48593b', '#526542'],
      pine: ['#3e5034', '#445636', '#394a31'],
      maple: ['#a43424', '#b4452a', '#9a2a22', '#b85a2c', '#c07434'],
      mapleTurning: ['#8c7a36', '#9a6a30'],
      cherry: ['#cdaaaa', '#d6b6b2', '#c29ea4', '#d0aea8'],
      willow: ['#6e7a44', '#667240', '#737c46'],
      cedar: ['#3d4b31', '#37452e', '#434f30'],
    };
    const GROUND_T = 3.6;
    const woodChunks = new Map();
    const tone = new THREE.Color(), pickTone = new THREE.Color();
    const placedTrees = [];
    // (for a harness: root.userData.trees)
    const treeList = [];
    root.userData.trees = treeList;
    const TREES = light ? 70 : 150;
    for (let s = 0; s < 22000 && placedTrees.length < TREES; s++) {
      const near = placedTrees.length && rnd() < 0.45 ? pick(placedTrees) : null;
      const p = near
        ? [near[0] + rr(-52, 52), near[1] + rr(-52, 52)]
        : [rr(720, 2080), rr(-980, 760)];
      if (p[0] < 700 || p[0] > 2100 || p[1] < -1000 || p[1] > 780) continue;
      if (blocked(p) || placedTrees.some((o) => dist(o, p) < 21)) continue;
      placedTrees.push(p);
      if (placedTrees.length % 8 === 0) yield;
      const v = rnd() < 0.2 ? 3 + Math.floor(rnd() * 2) : Math.floor(rnd() * 3);
      const kind = rnd();
      // spreading | a tall narrow spire | a young one, half the height
      const [size, top, sprays] = kind < 0.58 ? [rr(40, 68), rr(46, 74), 10]
        : kind < 0.84 ? [rr(24, 36), rr(66, 104), 13]
          : [rr(18, 30), rr(22, 38), 6];
      // (what the old trees drew from it after that: a tint, 7 for each of
      // their sprays and 2 for the post they stood on)
      pick(v >= 3 ? BLOSSOM : LEAF);
      for (let k = 0; k < sprays * 7 + 2; k++) rnd();

      const gap = pondGap(p), walk = walkDist(p);
      // (The nearest any tree stands to the water is some sixty units, and to
      // the walk a hundred and forty: the pond and its paths are open lawn,
      // and the trees that matter from the Pavilion are the ring on the far
      // bank, standing behind it in the view.)
      let species;
      const blossom = v >= 3 && tr() < 0.8, roll = tr();
      if (gap < 135) species = gap < 70 ? 'pine' : blossom && roll < 0.3 ? 'cherry' : roll < 0.72 ? 'willow' : 'pine';
      else if (blossom) species = 'cherry';
      else if (walk < 320) species = roll < 0.35 ? 'maple' : roll < 0.62 ? 'pine' : 'broad';
      else if (kind < 0.58) species = 'broad';
      else if (kind < 0.84) species = 'cedar';
      else species = tr() < 0.5 ? 'maple' : 'broad';
      if (ONE_TREE === 'none') continue;
      if (ONE_TREE) species = ONE_TREE;
      const room = Math.max(10, walk - 12);
      const shape = {
        broad: kind < 0.84 ? { H: top, S: size * 0.5 } : { H: top * 1.25, S: size * 0.6 },
        cedar: { H: top * 1.3, S: size * 0.5 },
        pine: { H: Math.min(62, Math.max(38, top * 0.8)), S: 20 },
        maple: { H: trr(26, 40), S: 0 },
        cherry: { H: trr(30, 42), S: 0 },
        willow: { H: trr(54, 72), S: 0 },
      }[species];
      if (species === 'maple') shape.S = Math.min(shape.H * trr(0.6, 0.8), room);
      if (species === 'cherry') shape.S = Math.min(shape.H * trr(0.7, 0.9), room);
      if (species === 'willow') shape.S = shape.H * 0.5;
      // willows and pines by the water lean out over it
      const lean = gap < 135 ? Math.atan2(POND.c[1] - p[1], POND.c[0] - p[0]) + trr(-0.5, 0.5) : null;
      const wood = new Wood(7);
      // (pavilionProps.js: a willow is dressed as a weeping one, from a
      // stream of its own — the trees' stream is spent as it always was)
      const weeping = species === 'willow' ? makeRng(6100 + placedTrees.length * 17) : null;
      const grown = growTree(species, tr, wood, { ...shape, lean, detail: !light && walk < 420, weeping });
      // (one on the road not taken, the way along the shore, the road's old
      // second bridge or the hedge that closes the garden is grown all the
      // same — its own stream spent to the draw — and not stood up)
      const gone = wayDist(p) < 24 || (NORTH_OPEN && onNorthBridge(p, 20)) || boundaryDist(p) < 14;
      if (!gone) treeList.push({ p, species, H: +shape.H.toFixed(1), gap: Math.round(gap), walk: Math.round(walk) });
      const g = wood.geometry().translate(p[0], GROUND_T, p[1]);
      const key = chunkKey(p[0], p[1]);
      if (!woodChunks.has(key)) woodChunks.set(key, []);
      if (gone) g.dispose();
      else woodChunks.get(key).push(g);

      // (forkProps.js: a cherry in flower at night. Lit all round in the
      // palest pink, from across the water each tree is a puff of the one
      // saturated colour in the frame; so greyer and deeper, a third of its
      // sprays left off, so the dark limbs show through, and a spray under the
      // crown's middle in the crown's own shade — the moon is on its top. No
      // draws are spent on any of it: the stream does not move.)
      const night = species === 'cherry';
      const palette = species === 'maple' && tr() < 0.2 ? TINT.mapleTurning : night ? BLOSSOM_NIGHT.tints : TINT[species];
      const base = new THREE.Color(tpick(palette));
      // (A weeping willow has more sprays than the plain willow whose draws it
      // takes, and every spray stood up draws its tint from the trees' stream:
      // that stream is spent on the plain willow's sprays, to the draw, and the
      // weeping one's take theirs from its own. Drawn for the new ones, every
      // tree after the first willow would be another tree.)
      for (const sp of grown.was ?? []) {
        const at = [sp.p[0] + p[0], sp.p[1] + GROUND_T, sp.p[2] + p[1]];
        if (walkDist([at[0], at[2]]) < 8 + sp.s[0] * 0.5 && at[1] - sp.s[1] * 0.5 < 30) continue;
        tpick(palette);
      }
      const leafRng = grown.tintRng ?? (grown.was ? weeping : null);
      const tintOf = leafRng ? (xs) => xs[Math.floor(leafRng() * xs.length)] : tpick;
      for (const [si, sp] of grown.sprays.entries()) {
        const at = [sp.p[0] + p[0], sp.p[1] + GROUND_T, sp.p[2] + p[1]];
        // nothing in the walk's way at head height
        if (walkDist([at[0], at[2]]) < 8 + sp.s[0] * 0.5 && at[1] - sp.s[1] * 0.5 < 30) continue;
        tone.copy(base).lerp(pickTone.set(tintOf(palette)), 0.3);
        if (gone) continue;
        let shade = sp.shade;
        if (night) {
          if (((si * 0.618034 + Math.abs(sp.p[0]) * 0.071) % 1) < BLOSSOM_NIGHT.drop) continue;
          const up = (sp.p[1] - sp.crown[1]) / (sp.crown[3] || 1);
          shade *= BLOSSOM_NIGHT.under + (1 - BLOSSOM_NIGHT.under) * Math.min(1, Math.max(0, (up + 0.25) / 0.8));
        }
        foliage.push({
          p: at, rot: sp.rot, s: sp.s, color: tone.getHex(), k: shade, kind: sp.kind,
          crown: [sp.crown[0] + p[0], sp.crown[1] + GROUND_T, sp.crown[2] + p[1], sp.crown[3]],
        });
      }
      for (const [wi, w] of grown.whips.entries()) {
        // (broad strands, pavilionProps.js: each now carries one or two ropes
        // of leaf, which seen at all are seen as a wall of bars — so about
        // half the cards are left off. No draws are spent here: the stream
        // does not move.)
        // (pavilionProps.js: darker to their tips, fewer are left off)
        if (((wi * 0.618034 + w.p[0] * 0.013) % 1) < (weeping ? WILLOW.skip : 0.45)) continue;
        const at = [w.p[0] + p[0], w.p[1] + GROUND_T, w.p[2] + p[1]];
        let len = w.len;
        if (walkDist([at[0], at[2]]) < 8 + w.wide) len = Math.min(len, at[1] - 30);
        if (len < 6 || gone) continue;
        hangs.push({ p: at, rot: [w.tilt?.[0] ?? 0, w.yaw, w.tilt?.[1] ?? 0], s: [w.wide, len, 1], kind: w.kind, color: weeping ? WILLOW.tone : '#d6dac4', k: w.shade });
      }
    }
    // Plant compact groves around the relocated lake and maze. Their crowns
    // stay outside the walking corridors; low shrubs and stones fill the gaps.
    // A separate stream leaves the established trees and later sections alone.
    if (!paintings && !ONE_TREE) {
      const gr = makeRng(74192), range = (a, b) => a + (b - a) * gr();
      const choose = (xs) => xs[Math.floor(gr() * xs.length)];
      const groves = [[1144, -224], [1200, -323], [1300, -330], [1459, -246],
        [1490, -122], [1470, 64], [1183, 71], [1210, 335], [1454, 456]];
      const planted = [];
      for (const [gi, centre] of groves.entries()) {
        yield;
        for (let tries = 0, count = 0; tries < 100 && count < (light ? 2 : 5); tries++) {
          const p = [centre[0] + range(-42, 42), centre[1] + range(-34, 34)];
          const walk = walkDist(p);
          if (blocked(p) || wayDist(p) < 28 || boundaryDist(p) < 22 || walk < 37
            || placedTrees.some((q) => dist(q, p) < 23) || planted.some((q) => dist(q, p) < 27)) continue;
          const species = gi % 3 === 0 ? 'cherry' : gr() < 0.5 ? 'pine' : 'broad';
          const H = species === 'pine' ? range(42, 58) : range(34, 52);
          const S = Math.min(range(22, 31), walk - 15, boundaryDist(p) - 8);
          const wood = new Wood(7);
          const grown = growTree(species, gr, wood, { H, S, detail: false });
          const geometry = wood.geometry().translate(p[0], GROUND_T, p[1]);
          const key = chunkKey(...p);
          if (!woodChunks.has(key)) woodChunks.set(key, []);
          woodChunks.get(key).push(geometry);
          const tint = new THREE.Color(choose(TINT[species]));
          for (const sp of grown.sprays) {
            const at = [sp.p[0] + p[0], sp.p[1] + GROUND_T, sp.p[2] + p[1]];
            if (walkDist([at[0], at[2]]) < 9 + sp.s[0] * 0.5 && at[1] - sp.s[1] * 0.5 < 30) continue;
            foliage.push({ p: at, rot: sp.rot, s: sp.s, color: tint.getHex(), k: sp.shade, kind: sp.kind,
              crown: [sp.crown[0] + p[0], sp.crown[1] + GROUND_T, sp.crown[2] + p[1], sp.crown[3]] });
          }
          treeList.push({ p, species, H: +H.toFixed(1), grove: true });
          planted.push(p);
          count++;
          for (let k = 0; k < 3; k++) {
            const q = [p[0] + range(-18, 18), p[1] + range(-18, 18)];
            if (blocked(q, -10) || wayDist(q) < 18 || walkDist(q) < 20 || boundaryDist(q) < 12) continue;
            const size = range(9, 16);
            foliage.push({ p: [q[0], range(7, 10), q[1]], rot: [0, range(0, Math.PI * 2), 0],
              s: [size, size * 0.8, size], color: choose(TINT.broad), k: range(0.7, 0.9),
              crown: [q[0], 5, q[1], size * 0.75] });
            ctx.rocks.push({ p: [q[0] + 4, 4.5, q[1] - 3], rot: [0, range(0, 3), 0],
              s: [range(2.5, 4), range(1.5, 2.5), range(2, 3.5)], color: '#aaa293' });
          }
        }
      }
    }
    // Layered woodland makes glades of the lake and maze. A small family of
    // grown shapes shares bark geometry; scale, rotation and leaf tints vary
    // each tree. Its own stream keeps the established planting in place.
    if (!paintings && !ONE_TREE) {
      const wr = makeRng(94263), range = (a, b) => a + (b - a) * wr();
      const choose = (xs) => xs[Math.floor(wr() * xs.length)];
      const shapes = new Map();
      for (const [si, species] of ['broad', 'pine', 'cherry', 'maple'].entries()) {
        shapes.set(species, Array.from({ length: 3 }, (_, variant) => {
          const wood = new Wood(7);
          const grown = growTree(species, makeRng(94400 + si * 31 + variant * 7), wood, { H: 50, S: 30, detail: false });
          return { geometry: wood.geometry(), sprays: grown.sprays, was: grown.was, trees: [] };
        }));
        yield;
      }
      const groves = [[1085, -242], [1120, -342], [1180, -407], [1240, -422], [1320, -419], [1400, -416],
        [1475, -352], [1530, -255], [1550, -160], [1585, -53], [1575, 42], [1585, 153],
        [1570, 280], [1542, 401], [1520, 485], [1440, 522], [1345, 537], [1235, 465],
        [1190, 400], [1170, 330], [1145, 230], [1164, -88], [1410, 59], [1212, 62]];
      const yawQ = new THREE.Quaternion(), leafQ = new THREE.Quaternion(), angles = new THREE.Euler();
      for (const [gi, centre] of groves.entries()) {
        yield;
        for (let tries = 0, count = 0; tries < 180 && count < (light ? 3 : 8); tries++) {
          const p = [centre[0] + range(-54, 54), centre[1] + range(-43, 43)];
          const walk = walkDist(p);
          if (blocked(p) || wayDist(p) < 28 || boundaryDist(p) < 24 || walk < 43
            || placedTrees.some((q) => dist(q, p) < 23) || treeList.some((t) => dist(t.p, p) < 23)) continue;
          const roll = wr();
          let species = gi % 7 === 3 ? 'cherry' : roll < 0.46 ? 'broad' : roll < 0.82 ? 'pine' : roll < 0.94 ? 'cherry' : 'maple';
          // (behind the maze's hedges from the court, a pine: webProps.js,
          // inCourtView. Neither has draws the other lacks.)
          if (species === 'cherry' && inCourtView(p)) species = 'pine';
          const shape = choose(shapes.get(species)), H = range(49, 76), scale = H / 50;
          const yaw = range(0, Math.PI * 2), cs = Math.cos(yaw), sn = Math.sin(yaw);
          const at = ([x, y, z]) => [p[0] + scale * (cs * x + sn * z), GROUND_T + scale * y, p[1] + scale * (cs * z - sn * x)];
          shape.trees.push({ p: [p[0], GROUND_T, p[1]], rot: [0, yaw, 0], s: [scale, scale, scale] });
          yawQ.setFromEuler(angles.set(0, yaw, 0));
          const palette = TINT[species], tint = new THREE.Color(choose(palette));
          // Spend the established leaf-tint budget before dressing a curved
          // maple, so later woodland trees keep their places and species.
          for (const sp of shape.was ?? []) {
            const position = at(sp.p), size = sp.s.map((s) => s * scale);
            if (walkDist([position[0], position[2]]) < 9 + size[0] * 0.5 && position[1] - size[1] * 0.5 < 30) continue;
            choose(palette);
          }
          const leafRng = shape.was ? makeRng(Math.round(p[0] * 1024) ^ Math.round(p[1] * 4096)) : null;
          const tintOf = leafRng ? (xs) => xs[Math.floor(leafRng() * xs.length)] : choose;
          for (const sp of shape.sprays) {
            const position = at(sp.p), size = sp.s.map((s) => s * scale);
            if (walkDist([position[0], position[2]]) < 9 + size[0] * 0.5 && position[1] - size[1] * 0.5 < 30) continue;
            leafQ.setFromEuler(angles.set(...sp.rot)).premultiply(yawQ);
            angles.setFromQuaternion(leafQ);
            tone.copy(tint).lerp(pickTone.set(tintOf(palette)), 0.25);
            foliage.push({ p: position, rot: [angles.x, angles.y, angles.z], s: size, color: tone.getHex(),
              k: sp.shade, kind: sp.kind, crown: [...at(sp.crown), sp.crown[3] * scale] });
          }
          treeList.push({ p, species, H: +H.toFixed(1), woodland: true });
          count++;
          for (let k = 0; k < 2; k++) {
            const q = [p[0] + range(-20, 20), p[1] + range(-20, 20)];
            if (blocked(q, -10) || wayDist(q) < 18 || walkDist(q) < 22 || boundaryDist(q) < 12) continue;
            const size = range(10, 18);
            foliage.push({ p: [q[0], range(7, 11), q[1]], rot: [0, range(0, Math.PI * 2), 0],
              s: [size, size * 0.8, size], color: choose(TINT.broad), k: range(0.7, 0.9), crown: [q[0], 5, q[1], size * 0.75] });
            if (k === 0) ctx.rocks.push({ p: [q[0] + 5, 4.4, q[1] - 3], rot: [0, range(0, 3), 0],
              s: [range(2.5, 4), range(1.5, 2.5), range(2, 3.5)], color: '#aaa293' });
          }
        }
      }
      for (const family of shapes.values()) {
        for (const shape of family) {
          if (shape.trees.length) instances(shape.geometry, M.bark, shape.trees, { chunked: true, name: 'trees' });
          else shape.geometry.dispose();
          yield;
        }
      }
    }
    // Behind the maze, a belt of cedars (webProps.js). The Library's garden
    // faces stand three paces past the maze's far hedge and ten metres tall,
    // and from the heart, bare, they are the top half of the frame: a garden
    // maze in a walled yard. Two and three deep, the back rows taller, their
    // spires are the skyline from the court and the stone is behind them.
    // (Their own stream: nothing above moves.)
    if (!paintings) {
      const sr = makeRng(SCREEN.seed), spick = (xs) => xs[Math.floor(sr() * xs.length)];
      const around = (p, r) => Array.from({ length: 8 }, (_, k) => add(p, [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)], r));
      const ok = (p, S) => inGarden(p) && around(p, S * 0.4).every(inGarden)
        && boundaryDist(p) > 8 && wayDist(p) > 24 && pathDist(p) > 24
        && !placedTrees.some((o) => dist(o, p) < 12);
      // (webProps.js: spires, of many heights; where the Library's stone
      // is close behind one, a tall one)
      const walled = (p) => BELT.beside.some((dx) => !inGarden([p[0] - dx, p[1] + BELT.behind]));
      const belt = screenPlaces(sr, MZ, ok, walled);
      // (and closed, from where it is looked at: wherever the rows left the
      // Library's stone showing between two spires, one more)
      {
        const hedge = MZ.z0 + MZ.rows * MZ.ch, laneX = MZ.x0 + (WEB_GATE.col + 0.5) * MZ.cw;
        const clear = (p, S) => (p[1] > hedge + 9 || p[0] < MZ.x0 - 9 || p[0] > MZ.x0 + MZ.cols * MZ.cw + 9)
          && !(WEB_GATE.through && p[1] < hedge + 50 && Math.abs(p[0] - laneX) < S * WEB_GATE.lane[0] + WEB_GATE.lane[1]);
        const far = (t) => t.p[1] > hedge + 56;
        closeBelt(belt, sr, ok, clear, GROUND_T).forEach((t) => { if (t.closing) t.far = far(t); });
      }
      for (const [ti, t] of belt.entries()) {
        if (ti % 8 === 0) yield;
        const wood = new Wood(7);
        const grown = growTree('cedar', sr, wood, { H: t.H, S: t.S, detail: !light && !t.far, skirt: SCREEN.skirt, spire: { ...SPIRE, taper: t.taper } });
        treeList.push({ p: t.p, species: 'cedar', H: +t.H.toFixed(1), screen: true });
        const g = wood.geometry().translate(t.p[0], GROUND_T, t.p[1]);
        beltWood.push(g);
        const base = new THREE.Color(spick(TINT.cedar));
        for (const sp of grown.sprays) {
          tone.copy(base).lerp(pickTone.set(spick(TINT.cedar)), 0.3);
          // (a tree beyond the garden's hedge is seen from the court or not
          // at all, and from there the hedges stand across its foot — its
          // lowest whorls, the broadest cards it has, are not stood up. The
          // tint is drawn all the same.)
          if (t.far && sp.p[1] < BELT.foot) continue;
          (beltFoliage).push({
            p: [sp.p[0] + t.p[0], sp.p[1] + GROUND_T, sp.p[2] + t.p[1]], rot: sp.rot, s: sp.s, color: tone.getHex(), k: sp.shade * (1 + (BELT.moon - 1) * (0.35 + 0.65 * Math.min(1, sp.p[1] / t.H))), kind: sp.kind,
            crown: [sp.crown[0] + t.p[0], sp.crown[1] + GROUND_T, sp.crown[2] + t.p[1], sp.crown[3]],
          });
        }
      }
    }
    // The belt stands in a group of its own, because of the map. Its spires
    // are the tallest things in the garden and stand south of the maze, which
    // is where the map is looked at from: at their full height they stood
    // across the maze and the lit court on it. Over the map they are drawn
    // down to `BELT.map` of their height (setVeil), and they stand up as the
    // reader comes down among the walls. And they cast no shadow: the moon is
    // low, the shadows of spires this tall lie three hundred units long
    // across the Library, and the shadow map is drawn once, over the map.
    if (beltWood.length) {
      beltGroup = new THREE.Group();
      beltGroup.name = 'belt';
      root.add(beltGroup);
      const geo = keep(mergeGeometries(beltWood, false));
      beltWood.forEach((g) => g.dispose());
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, M.bark);
      m.receiveShadow = true;
      m.name = 'trees';
      // (after its leaf: nearly all of the wood is behind it, and bark drawn
      // first is lit in full and then drawn over)
      m.renderOrder = 1;
      beltGroup.add(m);
    }
    for (const geos of woodChunks.values()) {
      const geo = keep(mergeGeometries(geos, false));
      geos.forEach((g) => g.dispose());
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, M.bark);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = 'trees';
      root.add(m);
      yield;
    }
    let shrubs = 0;
    for (let s = 0; s < 6000 && shrubs < (light ? 60 : 140); s++) {
      const p = [rr(720, 2080), rr(-980, 760)];
      if (blocked(p, -14)) continue;
      shrubs++;
      const size = rr(14, 26);
      const tint = pick(LEAF);
      const gone = wayDist(p) < 16 || (NORTH_OPEN && onNorthBridge(p, 12)) || boundaryDist(p) < 12;
      for (let s2 = 0; s2 < 3; s2++) {
        const sprig = { p: [p[0] + rr(-4, 4), rr(7, 12), p[1] + rr(-4, 4)], rot: [0, rr(0, 6.28), 0], s: Array(3).fill(size * rr(0.55, 0.75)), color: tint, k: rr(0.6, 0.85), crown: [p[0], 4, p[1], size * 0.75] };
        if (!gone) foliage.push(sprig);
      }
    }
  }
  return { beltGroup };
}

export function* buildMist(ctx) {
  const { paintings, light, rr, add, lerp2, unit2, dist, keep, paint, tex, withRepeat, starTex,
    radialTex, water, wind, lilyPads, leaves, M, root, flatPlane, instances, lightWishes,
    R, RC, cells, inGarden, LB, hangs, dust, trialPaper, trialEaves, glows, PIT, GB, rocks, ivy,
    fireflies, moreFlies, lilies, blooms, foliage, beltFoliage, beltLight, topSprigs, faceSprigs,
    plantHedge, finial, J, POND, SHORE, BRIDGE, BRIDGE_STAND, HEART, PATHS, segDist, lineDist,
    NORTH_BRIDGE, NORTH_OPEN, WAYS, standing, lawnLamps, hedgeGround, BOUNDARY, boundaryDist,
    offPond, pondEdge, beltGroup, MZ } = ctx;
  // ── Mist on the grass ─────────────────────────────────────────────────────
  let beltLeaf = null;
  // What a night garden has that a lit lawn has not: something between the eye
  // and the ground. Sheets of it lie low, thickest over the water and along the
  // pergola, and they drift. They are what puts distance between the near grass,
  // the pavilion and the tree line — without them the whole garden is one flat
  // field of one value, which is exactly how it read.
  const mist = [];
  {
    const near = [POND.c, [1150, 300], [1090, 400], [1240, 200], SHORE, J, [980, 520], [1350, 60],
      [1420, 250], [900, 430], [1180, 120], [1500, 380], [820, 300], [1600, 150]];
    // Faint, with its centres kept away from the places a reader stands.
    const mistMat = trackMist(keep(new THREE.MeshBasicMaterial({
      map: radialTex, color: MIST_COLOR, transparent: true, opacity: 0.055,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    })));
    // And out of the Library. A sheet laid on the lawn beside the Door reaches
    // in over the breach, and from inside the gallery its far edge would meet
    // the walls at eye height: a razor-straight line across both walls of
    // shelves, milky above and clear below. So over any room on the walk the
    // mist thins to nothing — in the shader, so every sheet keeps the size and
    // place the garden was composed with.
    {
      const rooms = cells.filter((cl) => cl.room !== undefined).map((cl) => new THREE.Vector2(cl.c[0], cl.c[1]));
      const depth = {
        uSceneDepth: { value: null },
        uDepthSize: { value: new THREE.Vector2(1, 1) },
        uDepthViewport: { value: new THREE.Vector4(0, 0, 1, 1) },
        uInverseProjection: { value: new THREE.Matrix4() },
        uCameraWorld: { value: new THREE.Matrix4() },
        uSoft: { value: 0 },
      };
      bindSceneDepth(mistMat, depth);
      mistMat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, depth);
        sh.uniforms.uRooms = { value: rooms };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
            varying vec3 vMistW;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vMistW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
            uniform vec2 uRooms[${rooms.length}];
            uniform sampler2D uSceneDepth;
            uniform vec2 uDepthSize;
            uniform vec4 uDepthViewport;
            uniform mat4 uInverseProjection;
            uniform mat4 uCameraWorld;
            uniform float uSoft;
            varying vec3 vMistW;`)
          .replace('#include <map_fragment>', `#include <map_fragment>
            for (int i = 0; i < ${rooms.length}; i++) diffuseColor.a *= smoothstep(${R.toFixed(1)}, ${(RC + 6).toFixed(1)}, distance(vMistW.xz, uRooms[i]));
            // Fade by vertical separation, so grazing views keep a soft edge
            // where a horizontal sheet meets a trunk or post.
            float mistIntersection = 0.0;
            if (uSoft > 0.5) {
              float solidDepth = texture2D(uSceneDepth, gl_FragCoord.xy / uDepthSize).r;
              vec2 ndc = (gl_FragCoord.xy - uDepthViewport.xy) / uDepthViewport.zw * 2.0 - 1.0;
              vec4 surface = uInverseProjection * vec4(ndc, solidDepth * 2.0 - 1.0, 1.0);
              if (abs(surface.w) > 1e-6) {
                float surfaceY = (uCameraWorld * vec4(surface.xyz / surface.w, 1.0)).y;
                mistIntersection = smoothstep(0.0, 8.0, abs(surfaceY - vMistW.y));
              }
            }
            diffuseColor.a *= mistIntersection;`);
      };
      mistMat.customProgramCacheKey = () => 'babel-mist-soft';
    }
    const sheet = keep(flatPlane());
    const stands = [J, BRIDGE_STAND, HEART];
    for (let k = 0, tries = 0; k < (light ? 7 : 17) && tries < 400; tries++) {
      const base = near[tries % near.length];
      const p = [base[0] + rr(-110, 110), base[1] + rr(-90, 90)];
      if (stands.some((q) => dist(p, q) < 150)) continue;
      k++;
      const m = new THREE.Mesh(sheet, mistMat);
      const w = rr(260, 520);
      m.scale.set(w, 1, w * rr(0.6, 1));
      m.position.set(p[0], rr(11, 26), p[1]);
      m.renderOrder = 3;
      root.add(m);
      mist.push({ m, home: [p[0], p[1]], phase: rr(0, 100), speed: rr(0.02, 0.05), reach: rr(14, 34) });
    }
  }

  const stoneTone = new THREE.Color(), paleStone = new THREE.Color('#ece6da');
  // Nothing left lying in the road not taken, the way along the shore or
  // across the hedge's line, nor half inside a post's or a lantern's foot
  // (their draws long spent: taking them up moves nothing else).
  for (let k = rocks.length - 1; k >= 0; k--) {
    const { p: [x, , z], s: [sx, , sz] } = rocks[k];
    const onWay = WAYS.some((way) => lineDist([x, z], way.pts) < way.w / 2 - 0.5);
    const underFoot = rocks[k].bank === undefined && standing.some((st) => dist([x, z], st.p) < st.r + Math.max(sx, sz) * 0.6);
    if (onWay || underFoot || boundaryDist([x, z]) < 8) rocks.splice(k, 1);
  }
  {
    // the hedge closing the garden: one outline round the line, mitred at each turn
    const side = (d) => BOUNDARY.map((q, i) => {
      const n = (k) => { const t = unit2(BOUNDARY[k], BOUNDARY[k + 1]); return [-t[1], t[0]]; };
      if (i === 0) return add(q, n(0), d);
      if (i === BOUNDARY.length - 1) return add(q, n(i - 1), d);
      const n0 = n(i - 1), n1 = n(i);
      return add(q, [n0[0] + n1[0], n0[1] + n1[1]], d / (1 + n0[0] * n1[0] + n0[1] * n1[1]));
    });
    const loop = [...side(5.5), ...side(-5.5).reverse()];
    const area = loop.reduce((a, [x, z], i) => a + (x * loop[(i + 1) % loop.length][1] - loop[(i + 1) % loop.length][0] * z) / 2, 0);
    if (!NO_BOUND) plantHedge([area > 0 ? loop : loop.reverse()], { ground: 4, H: 24, seed: 31, detail: light ? 0.3 : 0.6 });
    // and its finials: one at each turn of it, and one along each long run
    // between (forkProps.js) — never at its two ends, which stand in stone
    if (!NO_BOUND) {
      BOUNDARY.forEach((q, i) => {
        if (i > 0 && i < BOUNDARY.length - 1) finial(q, FINIALS.turn, 4, 24, 3101 + i);
        if (i < BOUNDARY.length - 1 && dist(q, BOUNDARY[i + 1]) > FINIALS.longRun) finial(lerp2(q, BOUNDARY[i + 1], 0.5), FINIALS.run, 4, 24, 3201 + i);
      });
    }
  }
  // The lawn's blades, round each lantern that stands on it (lawn.js;
  // forkProps.js): wherever there is lawn — not a way's gravel, nor the
  // pond's bank, nor under a hedge or a lantern's own foot.
  if (!paintings) {
    const inLoop = (p, loop) => {
      let hit = false;
      for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
        const [xi, zi] = loop[i], [xj, zj] = loop[j];
        if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) hit = !hit;
      }
      return hit;
    };
    const ways = [...PATHS.slice(0, 3), ...WAYS];
    const hedged = hedgeGround.map((loop) => ({
      loop, x0: Math.min(...loop.map((q) => q[0])), x1: Math.max(...loop.map((q) => q[0])), z0: Math.min(...loop.map((q) => q[1])), z1: Math.max(...loop.map((q) => q[1])),
    }));
    const ok = (p) => inGarden(p) && ways.every((o) => lineDist(p, o.pts) > o.w / 2 + 0.4) && offPond(p, LAWN.bank)
      && !standing.some((st) => dist(p, st.p) < st.r + 0.2)
      && !hedged.some((h) => p[0] > h.x0 && p[0] < h.x1 && p[1] > h.z0 && p[1] < h.z1 && inLoop(p, h.loop));
    // (gardenProps.js: clumped, broader, their tips a mid green, not needles;
    // and under them a mown sward for the lantern to fall on)
    const clump = GRASS;
    // (gardenProps.js: not sprinkled over the open lawn round each lantern
    // but gathered along its edges, across the whole garden — the ways'
    // sides, the hedges' feet, the bank's lip, round stones and posts)
    const mazeRect = [[MZ.x0 - 6, MZ.z0 - 6], [MZ.x0 + MZ.cols * MZ.cw + 6, MZ.z0 - 6],
      [MZ.x0 + MZ.cols * MZ.cw + 6, MZ.z0 + MZ.rows * MZ.ch + 6], [MZ.x0 - 6, MZ.z0 + MZ.rows * MZ.ch + 6]];
    const offMaze = (p) => p[0] < mazeRect[0][0] - 0.3 || p[0] > mazeRect[1][0] + 0.3 || p[1] < mazeRect[0][1] - 0.3 || p[1] > mazeRect[2][1] + 0.3;
    if (TUFTS.on) {
      const bankRing = Array.from({ length: 120 }, (_, i) => {
        const a = (i / 120) * Math.PI * 2;
        return [POND.c[0] + Math.cos(a) * (POND.rx + LAWN.bank), POND.c[1] + Math.sin(a) * (POND.rz + LAWN.bank)];
      });
      const edges = [
        ...ways.map((o) => ({ pts: o.pts, off: o.w / 2 + 0.15 })),
        ...hedgeGround.map((loop) => ({ pts: loop, off: 0.6, closed: true })),
        { pts: bankRing, off: 0, closed: true },
        { pts: mazeRect, off: 0.2, closed: true },
      ];
      const rings = [
        ...standing.map((st) => ({ p: st.p, r: st.r + 0.2 })),
        ...rocks.filter((rk) => rk.bank === undefined).map((rk) => ({ p: [rk.p[0], rk.p[2]], r: Math.max(rk.s[0], rk.s[2]) * 0.8 })),
      ];
      for (const g of edgeTufts({ edges, rings, ok: (p) => ok(p) && offMaze(p), lamps: lawnLamps, ground: 4, t: TUFTS, density: light ? 0.5 : 1 })) {
        const m = new THREE.Mesh(keep(g), M.lawnBlade);
        m.receiveShadow = true;
        m.name = 'lawnBlades';
        root.add(m);
        yield;
      }
    }
    for (const g of TUFTS.on ? [] : lawnBlades({ lamps: lawnLamps, ok, ground: 4, density: LAWN.density * (light ? 0.5 : 1), height: LAWN.height, clump })) {
      const m = new THREE.Mesh(keep(g), M.lawnBlade);
      m.receiveShadow = true;
      m.name = 'lawnBlades';
      root.add(m);
      yield;
    }
    if (clump) {
      const swardTex = tex(paint(512, 512, (g, s) => paintSward(g, s, makeRng(6619))), [1, 1]);
      const swardMat = keep(swardLit(swardTex, { ...GRASS.sward, k: GRASS.sward.k * (SWARD.lampSward) }));
      for (const g of lawnSward({ lamps: lawnLamps, ok, ground: 4.04 })) {
        const m = new THREE.Mesh(keep(g), swardMat);
        // (named with the blades: not felt — body.js, UNFELT)
        m.name = 'lawnBlades';
        m.renderOrder = 1;
        root.add(m);
        yield;
      }
    }
  }
  {
    // ── The pond's edge (shore.js) ──────────────────────────────────────────
    // A bank the water lies in, its stones set along it, and pebbles; the plain
    // stones round it (`bank`) are left out — their draws are spent where they
    // are made, so nothing else moves.
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const HWB = PAVILION_BRIDGE_HALF_WIDTH;
    const bridges = [BRIDGE, ...(NORTH_OPEN ? [NORTH_BRIDGE] : [])];
    const floors = [...PATHS.slice(0, 3), ...WAYS];
    // how far outside the nearest way's gravel (negative: on it)
    const offWay = (p) => Math.min(...floors.map((o) => lineDist(p, o.pts) - o.w / 2));
    const gravelAt = (x, z) => ss(1.2, -1.2, offWay([x, z]));
    const floorAt = (x, z) => 4 + 1.2 * gravelAt(x, z);
    // the way up onto each bridge's step, kept to the gravel (the walk's own
    // line onto the Pavilion's: in from the path, then square up the run)
    const approaches = bridges.map((BR) => {
      const t = unit2(BR[0], BR[1]);
      return BR === BRIDGE ? [PAVILION_PATH.at(-2), add(BR[0], t, -10), add(BR[0], t, -7.4)] : [add(BR[0], t, -18), add(BR[0], t, -7.4)];
    });
    const approachD = (p) => Math.min(...approaches.map((pts) => lineDist(p, pts)));
    const deckD = (p) => Math.min(...bridges.flatMap((BR) => BR.slice(1).map((b, i) => segDist(p, BR[i], b))));
    // under a deck, the bank no higher than the water; across a way onto a
    // bridge, under the gravel
    const under = (x, z) => {
      const p = [x, z];
      let y = Infinity;
      const dd = deckD(p) - (HWB + 1.2), cd = approachD(p) - 5.5;
      if (dd < 2) y = 6.4 + Math.max(0, dd) * 0.6;
      if (cd < 3) y = Math.min(y, 4.95 + Math.max(0, cd) * 0.75);
      return y;
    };
    const clear = (p, r, across) => offWay(p) > across - 0.8
      && deckD(p) > HWB + r + 0.6
      && approachD(p) > 5.5 + r
      && standing.every((st) => dist(p, st.p) > st.r + r + 0.5);
    // (the pebbled bank coming and going round the pond: forkProps.js; the
    // kerb where a way comes to the water set in groups, 4)
    const shore = pondShore({ edge: pondEdge, waterY: WATER_Y, world: { floorAt, gravelAt, under, clear, near: offWay }, light, bankVary: true, kerbVary: true });
    for (const g of shore.arcs) GB.bank.add(g);
    for (const g of shore.stones) GB.shoreStone.add(g);
    // the stones that stand guard at each bridge's foot, either side of its
    // step (wherever a way's gravel or a lantern leaves room)
    for (const BR of bridges) {
      const t = unit2(BR[0], BR[1]), n = [-t[1], t[0]];
      const feet = guardStones({
        a: BR[0], t, n, stepHalf: HWB - 1.5, stepU: -5.4, light, seed: 9241 + Math.round(BR[0][0]),
        ground: (p) => Math.max(floorAt(p[0], p[1]), Math.min(shore.bankY(p), 7.2)),
        clear: (p, r, across) => offWay(p) > across - 0.4 && standing.every((st) => dist(p, st.p) > st.r + r + 0.5),
      });
      for (const g of feet) GB.shoreStone.add(g);
    }
    // (and not in the pond's mirror: a few centimetres of stone at the water's
    // edge reflect as nothing at a quarter of the frame, and the mirror would
    // pay for every one of them again)
    rockVariants(4, { seed: 6163, detail: 3, moss: 0.15 }).forEach((geo, v) => {
      const first = instances(geo, M.pebble, shore.pebbles.filter((q) => q.v === v), { cast: false, chunked: true, name: 'pebbles' });
      if (first) root.traverse((o) => { if (o.isInstancedMesh && o.geometry === first.geometry) water.surface(o); });
    });
    // and the garden's other stones, each one of eight stones of the same
    // granite (rockVariants), set level-ish, not tipped on their edges
    const items = rocks.filter((r) => r.bank === undefined).map((r, k) => {
      const sc = r.s, color = `#${stoneTone.set(r.color).lerp(paleStone, 0.9).getHexString()}`;
      return { ...r, v: k % 8, color, rot: [r.rot[0] * 0.08, r.rot[1], r.rot[2] * 0.08], p: [r.p[0], r.p[1] - sc[1] * 0.3, r.p[2]] };
    });
    rockVariants(8, { seed: 6151, detail: light ? 7 : 9 }).forEach((geo, v) => {
      instances(geo, M.shoreRock, items.filter((it) => it.v === v), { cast: false, chunked: true });
    });
  }
  yield;
  instances(new THREE.SphereGeometry(1, 12, 8), M.glow, glows, { cast: false, receive: false, chunked: true });
  // (the paper lanterns, lampPass.js)
  instances(new THREE.SphereGeometry(1, 40, 28), M.lpPaper, trialPaper, { cast: false, receive: false, chunked: true, name: 'trial-paper' });
  instances(new THREE.SphereGeometry(1, 28, 20), M.lpPaper, trialEaves, { cast: false, receive: false, chunked: true, name: 'trial-eaves' });
  {
    lilyPads.geometries.forEach((geo, k) => instances(geo, M.lily, lilies[k], { cast: false, chunked: true }));
    instances(lilyFlowerGeometry('white', 5), M.flower, blooms.white, { cast: false, chunked: true });
    instances(lilyFlowerGeometry('pink', 6), M.flower, blooms.pink, { cast: false, chunked: true });
    instances(lilyBudGeometry('white', 7), M.flower, blooms.whiteBud, { cast: false, chunked: true });
    instances(lilyBudGeometry('pink', 8), M.flower, blooms.pinkBud, { cast: false, chunked: true });
    instances(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), M.ivy, ivy, { chunked: true });
    // Leaf casts the moon's shadow now (the map is drawn once, at the start,
    // so it costs nothing after): a tree without one stood on the lawn as if
    // pasted there.
    const foliageDepth = keep(makeFoliageDepthMaterial(FOLIAGE_KINDS));
    instances(crossedCards(), M.foliage, foliage, {
      chunked: true,
      depth: foliageDepth,
      prepass: M.foliagePre,
      attrs: { aKind: (it) => it.kind ?? 0, aCrown: (it) => it.crown ?? [it.p[0], it.p[1], it.p[2], 0] },
      // (feathered, it blends: ahead of the water, the pools and the halos)
      order: FEATHER.on ? -0.5 : 0,
    });
    yield;
    if (beltGroup) {
      // (lit by the card's corner, not by the pixel: effects.js)
      const lit = BELT.lit;
      // Nearest the court first. What is left of the belt's cost is its cards
      // lying over one another, five rows deep, and a card drawn behind one
      // already drawn fails the depth test before its texture is read.
      beltFoliage.sort((a, b) => dist([a.p[0], a.p[2]], HEART) - dist([b.p[0], b.p[2]], HEART));
      beltLeaf = lit ? null : keep(makeBackdropFoliage(leaves, wind, FOLIAGE_KINDS, beltLight));
      instances(crossedCards(), lit ? M.foliage : beltLeaf, beltFoliage, {
        chunked: true, cast: false, to: beltGroup,
        prepass: lit ? M.foliagePre : null,
        attrs: { aKind: (it) => it.kind ?? 0, aCrown: (it) => it.crown ?? [it.p[0], it.p[1], it.p[2], 0] },
      });
    }
    for (const [cards, sprigs] of [[crossedCards(), topSprigs], [crossedCards({ flat: false }), faceSprigs]]) {
      instances(cards, M.hedgeLeaf, sprigs, {
        chunked: true,
        depth: foliageDepth,
        prepass: M.hedgeLeafPre,
        attrs: { aKind: (it) => it.kind, aCrown: (it) => it.crown },
        // (feathered, it blends, as the trees do)
        order: FEATHER.on ? -0.5 : 0,
      });
    }
    // wisteria and trailing leaves, hung by the top edge (makeHangingMaterial)
    {
      const card = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
      const cards = mergeGeometries([card.clone(), card.clone().rotateY(Math.PI / 2)]);
      card.dispose();
      instances(cards, M.hang, hangs, { cast: false, chunked: true, attrs: { aKind: (it) => it.kind } });
    }
  }
  // Fireflies and dust are points of light drifting on the GPU (effects.js).
  // Dust is not luminous, it is LIT: each mote takes its brightness once, from
  // how near it hangs to a lamp, squared — evenly bright specks read as snow.
  for (const d of dust) {
    let lit = 0;
    for (const w of lightWishes) {
      const f = Math.max(0, 1 - Math.hypot(w.x - d.p[0], w.y - d.p[1], w.z - d.p[2]) / 95);
      lit = Math.max(lit, f * f * Math.min(1, w.intensity / 6000));
    }
    d.k = 0.05 + lit * 1.6;
  }
  // Motes hang in the air; they do not dart about it. A drift of 9 units is
  // most of a metre of wandering, which at speed reads as flies, and the tiny
  // additive points wink in and out as they cross a pixel.
  const sparkles = [
    // All of them, and more over the maze, half the size, each flashing on a
    // beat of its own and dark between (webProps.js): few, large and steady,
    // they read as dust; big and even at head height, as dots on the lens. (No
    // mint ones: the garden takes no teal.)
    fireflies.length && (makeSparkles([...fireflies, ...moreFlies].map((f, i) => ({
        ...f, p: [f.p[0], 12 + (f.p[1] - 12) * 0.45, f.p[2]], k: (f.k ?? 1) * (0.5 + ((i * 0.618) % 1) * 0.8),
        color: f.color === '#b8ffe6' ? '#eaf7a6' : f.color,
      })), { drift: 5, rise: 0.5, rate: 0.45, blink: FLIES.blink, sizeOf: (f) => f.s[0] * 1.7 * FLIES.size })),
    dust.length && makeSparkles(dust, { drift: 3.5, rise: 0.9, rate: 0.22, sizeOf: (d) => d.s[0] * 1.3 }),
  ].filter(Boolean);
  sparkles.forEach((points) => {
    keep(points.geometry);
    keep(points.material);
    root.add(points);
  });

  // Merging a world's worth of stone in one pass blocks the opening. Finish
  // one material at a time so assembly can pause between the larger batches.
  for (const batches of [LB, GB]) {
    for (const [name, b] of Object.entries(batches)) {
      yield* b.flushSteps(name);
      yield;
    }
  }

  // The dark the honeycomb stands in: stars all the way down.
  {
    const shape = new THREE.Shape([[-4500, -4000], [4500, -4000], [4500, 4000], [-4500, 4000]].map(([x, y]) => new THREE.Vector2(x, y)));
    const opening = new THREE.Path();
    opening.absarc(PIT[0] - 720, 300 - PIT[1], 110, 0, Math.PI * 2, true);
    shape.holes.push(opening);
    const backdrop = new THREE.ShapeGeometry(shape, 64);
    const positions = backdrop.attributes.position, uv = backdrop.attributes.uv;
    for (let i = 0; i < positions.count; i++) uv.setXY(i, (positions.getX(i) + 4500) / 9000, (positions.getY(i) + 4000) / 8000);
    const abyss = new THREE.Mesh(keep(backdrop), keep(new THREE.MeshBasicMaterial({
      map: withRepeat(starTex, [18, 16]), color: '#8fb4c8', toneMapped: false,
    })));
    abyss.rotation.x = -Math.PI / 2;
    abyss.position.set(720, -520, 300);
    abyss.name = 'stars';
    root.add(abyss);
  }
  return { beltLeaf, mist, sparkles };
}
