// VIII — the Web of Time (buildWorld.js, assembleWorld): the maze, its
// fireflies, and the court at its heart.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from '../textures';
import { rectUnionLoops } from '../hedges';
import { FINIALS } from '../forkProps';
import { webOld, openGate, pedestalGeometry, pedestalLetters, FLIES } from '../webFix';
import { auditOld } from '../auditFix';
import { webPropsOld, graduatedRing } from '../webProps';
import { garden5Old, NICHE, BEAD } from '../gardenFix5';
import { deg, MASS_H, CAP, IVY_OLD } from '../build/common';

export function buildWeb(ctx) {
  const { paintings, light, rr, pick, dir, add, lerp2, unit2, circlePts, keep, gilt, lampHaloTex, M,
    root, slabGeo, placed, profileGeo, rodGeo, wornRibbon, decal, halos, halo, lightWishes,
    POOL_DIAL, point, A, RC, NB, cells, isGardenAt, inGarden, edgeFrame, mounts, hangPainting, DOOR,
    GATE, GB, ivy, fireflies, moreFlies, mazeRoute, heartParts, plantHedge, finial, MZ, HEART,
    COURT, pathDist, tsuriDoro } = ctx;
  // VIII — the Web of Time: the maze, fireflies, and its painting at the heart.
  let armillary = null;
  // What the finale (finale.js) needs from the maze once it has grown.
  let mazeGrid = null, mazeRects = null;
  {
    const { x0, z0, cols, rows, cw, ch } = MZ;
    GB.mazeFloor.add(slabGeo([[x0 - 6, z0 - 6], [x0 + cols * cw + 6, z0 - 6], [x0 + cols * cw + 6, z0 + rows * ch + 6], [x0 - 6, z0 + rows * ch + 6]], [], 1, 4));
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ n: 1, s: 1, e: 1, w: 1, v: 0 })));
    const stack = [[4, 3]];
    grid[3][4].v = 1;
    while (stack.length) {
      const [cc, r] = stack[stack.length - 1];
      const opts = [];
      if (r > 0 && !grid[r - 1][cc].v) opts.push(['n', cc, r - 1, 's']);
      if (r < rows - 1 && !grid[r + 1][cc].v) opts.push(['s', cc, r + 1, 'n']);
      if (cc < cols - 1 && !grid[r][cc + 1].v) opts.push(['e', cc + 1, r, 'w']);
      if (cc > 0 && !grid[r][cc - 1].v) opts.push(['w', cc - 1, r, 'e']);
      if (!opts.length) { stack.pop(); continue; }
      const [d, nc, nr, opp] = pick(opts);
      grid[r][cc][d] = 0;
      grid[nr][nc][opp] = 0;
      grid[nr][nc].v = 1;
      stack.push([nc, nr]);
    }
    grid[0][4].n = 0;
    grid[2][4].s = 0;
    grid[3][4].n = 0;
    // ── The heart: a court, not a cell ────────────────────────────────────
    // Not one cell of the grid, a corridor with a hedge on either hand, where
    // the walk would end facing a plinth the way a dead end does: the nine
    // cells round it, cleared into one court, with a way in on each of its axes
    // — the one the reader comes by, and three for the others (finale.js). Any
    // other way into the court is closed, where the maze can spare it — every
    // cell must still be reachable from the entrance. (Knocked through after
    // the maze is grown, so the world's stream is spent exactly as the plain
    // maze spends it.)
    if (!paintings) {
      const side = { n: [0, -1, 's'], s: [0, 1, 'n'], e: [1, 0, 'w'], w: [-1, 0, 'e'] };
      const set = (c, r, d, v) => {
        const [dc, dr, opp] = side[d];
        grid[r][c][d] = v;
        if (grid[r + dr]?.[c + dc]) grid[r + dr][c + dc][opp] = v;
      };
      const { c0, c1, r0, r1 } = COURT;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (c < c1) set(c, r, 'e', 0);
          if (r < r1) set(c, r, 's', 0);
        }
      }
      const mc = (c0 + c1) / 2, mr = (r0 + r1) / 2;
      set(mc, r0, 'n', 0);
      set(mc, r1, 's', 0);
      set(c0, mr, 'w', 0);
      set(c1, mr, 'e', 0);
      const reachable = () => {
        const seen = new Set(['4,0']), queue = [[4, 0]];
        while (queue.length) {
          const [c, r] = queue.shift();
          for (const [d, [dc, dr]] of Object.entries(side)) {
            if (grid[r][c][d] || !grid[r + dr]?.[c + dc] || seen.has(`${c + dc},${r + dr}`)) continue;
            seen.add(`${c + dc},${r + dr}`);
            queue.push([c + dc, r + dr]);
          }
        }
        return seen.size === rows * cols;
      };
      const rim = [];
      for (let c = c0; c <= c1; c++) rim.push([c, r0, 'n'], [c, r1, 's']);
      for (let r = r0; r <= r1; r++) rim.push([c0, r, 'w'], [c1, r, 'e']);
      for (const [c, r, d] of rim) {
        if (grid[r][c][d] || (c === mc && (d === 'n' || d === 's')) || (r === mr && (d === 'w' || d === 'e'))) continue;
        set(c, r, d, 1);
        if (!reachable()) set(c, r, d, 0);
      }
      // and a fifth way out, off the axis, that can be SEEN from the way in:
      // the fourth gate is straight behind the armillary (webFix.js, 3)
      if (!webOld(3)) openGate(grid, COURT, set, reachable);
    }
    // the one way through to the heart, for the walk
    {
      const from = new Map([['4,0', null]]), queue = [[4, 0]];
      while (queue.length) {
        const [cc, r] = queue.shift();
        if (cc === 4 && r === 3) break;
        const next = [];
        if (r > 0 && !grid[r][cc].n) next.push([cc, r - 1]);
        if (r < rows - 1 && !grid[r + 1][cc].n) next.push([cc, r + 1]);
        if (cc > 0 && !grid[r][cc].w) next.push([cc - 1, r]);
        if (cc < cols - 1 && !grid[r][cc + 1].w) next.push([cc + 1, r]);
        for (const n of next) {
          if (from.has(`${n}`)) continue;
          from.set(`${n}`, [cc, r]);
          queue.push(n);
        }
      }
      for (let at = [4, 3]; at; at = from.get(`${at}`)) mazeRoute.unshift([x0 + (at[0] + 0.5) * cw, z0 + (at[1] + 0.5) * ch]);
    }
    // every wall of the grid as the ground it stands on, and one hedge grown
    // over all of it (hedges.js)
    const T = 8.5, footprint = [];
    const wall = (a, b) => footprint.push([
      Math.min(a[0], b[0]) - T / 2, Math.min(a[1], b[1]) - T / 2, Math.max(a[0], b[0]) + T / 2, Math.max(a[1], b[1]) + T / 2,
    ]);
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        const X = x0 + cc * cw, Z = z0 + r * ch, g = grid[r][cc];
        if (g.n) wall([X, Z], [X + cw, Z]);
        if (g.w) wall([X, Z], [X, Z + ch]);
        if (r === rows - 1 && g.s) wall([X, Z + ch], [X + cw, Z + ch]);
        if (cc === cols - 1 && g.e) wall([X + cw, Z], [X + cw, Z + ch]);
      }
    }
    // (gardenFix5.js, 10) Either side of where the reader stops for the Web of
    // Time — the cell before the court's way in — the hedge would be a blank
    // leaf wall a pace off. A niche is clipped into each, with a small iron
    // lantern hung in it on a crook, lit — the two of them a gate before the
    // court — and in the wider one a stone seat beside its lantern.
    const niches = [];
    if (!paintings && !garden5Old(10)) {
      const nc = 4, nr = 1, zc = z0 + (nr + 0.6) * ch + NICHE.ahead;
      for (const [has, face, into, wide] of [[grid[nr][nc].w, x0 + nc * cw + T / 2, -1, NICHE.wide[0]], [grid[nr][nc + 1]?.w, x0 + (nc + 1) * cw - T / 2, 1, NICHE.wide[1]]]) {
        if (!has) continue;
        const back = face + into * NICHE.deep;
        niches.push({ rect: [Math.min(face, back), zc - wide / 2, Math.max(face, back), zc + wide / 2], face, into, z: zc, wide });
      }
    }
    plantHedge(rectUnionLoops(footprint, niches.map((q) => q.rect)), { ground: 5, H: 20, seed: 11 });
    niches.forEach((q, qi) => {
      const seated = q.wide > NICHE.wide[0];
      // the lantern, on a crook planted at the back of the niche (at its far
      // end, toward the court, where a seat has the rest)
      const lz = seated ? q.z + q.wide / 2 - 2.6 : q.z;
      const lp = [q.face + q.into * 2.4, lz], foot = q.face + q.into * 4.4, topY = 21.6;
      GB.stone.add(placed(new THREE.CylinderGeometry(0.85, 1.0, 0.7, 10), [foot, lz], 5.35));
      GB.iron.add(rodGeo([foot, 5.4, lz], [foot, topY, lz], 0.17));
      for (let k = 0; k < 8; k++) {
        const a = Math.PI * (1 - k / 8), b = Math.PI * (1 - (k + 1) / 8), mid = (foot + lp[0]) / 2, r = Math.abs(lp[0] - foot) / 2;
        GB.iron.add(rodGeo([mid + Math.cos(a) * r, topY + Math.sin(a) * r, lz], [mid + Math.cos(b) * r, topY + Math.sin(b) * r, lz], 0.15));
      }
      const flame = tsuriDoro(lp, Math.PI / 2, NICHE.lamp.dy);
      halo(lp, flame.y, 12, '#ffbc70', 0.12, lampHaloTex, 41 + qi * 23);
      point(lp, flame.y - 0.2, '#ffb866', NICHE.lamp.k, 4);
      decal(lp, 40, 40, '#ffb462', 0.1 * POOL_DIAL, 5.36, 0);
      if (!seated) return;
      // the seat: a slab on two waisted legs, set back a hand from the hedge's face
      const { w, d, h } = NICHE.seat, xc = q.face + q.into * (0.7 + d / 2), top = 5 + h, sz = q.z - q.wide / 2 + 0.9 + w / 2;
      GB.stone.add(new THREE.BoxGeometry(d, 0.8, w).translate(xc, top - 0.4, sz));
      GB.stone.add(new THREE.BoxGeometry(d - 0.4, 0.28, w - 0.5).translate(xc, top - 0.94, sz));
      const leg = [[-1.35, 5], [1.35, 5], [1.35, 5.5], [0.95, 6.1], [1.05, 7.2], [1.4, top - 1.08], [-1.4, top - 1.08], [-1.05, 7.2], [-0.95, 6.1], [-1.35, 5.5]];
      for (const s of [-1, 1]) GB.stone.add(profileGeo(leg, 1.1, [xc, sz + s * (w / 2 - 1.3)], 0));
    });
    // its mouth between two clipped finials, and one on each corner (forkProps.js, 6)
    if (!paintings) {
      [[x0 + 4 * cw, z0], [x0 + 5 * cw, z0], [x0, z0], [x0 + cols * cw, z0], [x0, z0 + rows * ch], [x0 + cols * cw, z0 + rows * ch]]
        .forEach((p, i) => finial(p, FINIALS.mouth, 5, 20, 1101 + i));
    }
    mazeGrid = grid;
    mazeRects = footprint;
    // (Not 3800 with a pool of 0.34: the pale paving prints as one even cream
    // stage against black hedges — the middle of it so far up the tone curve
    // that the fall-off toward the kerb is squeezed out of it. A third lower,
    // the light is seen to come FROM the armillary and fade.)
    point(HEART, 28, '#ffc77e', 2600, 5);
    heartParts.wish = lightWishes[lightWishes.length - 1];
    decal(HEART, 160, 160, '#ffbd6c', 0.22 * POOL_DIAL, 5.4, 0.12);
    if (!paintings) {
      // The court's floor: a round of the pale stone laid in the gravel, kerbed,
      // for the plinth to stand in the middle of and the others at the edge of.
      GB.stone.add(slabGeo(circlePts(HEART, 34, 64), [], 0.3, 5));
      GB.stone.add(slabGeo(circlePts(HEART, 35.2, 64), [circlePts(HEART, 33.6, 64)], 0.6, 5));
      // And in it, the garden of forking paths: brass let into the paving,
      // three lines out from the plinth that divide at every ring of stones,
      // and divide again, twenty-four ways to the kerb — so the one place the
      // finale's light floods is not bright, even paving with nothing drawn on
      // it, and the flood has the paths to run along.
      {
        const RINGS = [6.9, 14, 22, 30, 33.2], SPREAD = [0, 0.3, 0.15, 0.075];
        const pol = (r, a) => add(HEART, [Math.cos(a), Math.sin(a)], r);
        const grow = (a, k) => {
          if (k === 4) return;
          for (const side of k === 0 ? [0] : [-1, 1]) {
            const b = a + side * SPREAD[k];
            const line = wornRibbon([pol(RINGS[k], a), pol(RINGS[k + 1], b)], [0.42, 0.34, 0.28, 0.22][k], 5.33);
            line.deleteAttribute('uv1');   // (to merge with the rest of the gilt)
            GB.gold.add(line);
            grow(b, k + 1);
          }
        };
        for (let j = 0; j < 3; j++) grow(-Math.PI / 2 + (j * 2 * Math.PI) / 3 + 0.35, 0);
        for (const r of RINGS.slice(1, 4)) {
          const g = new THREE.RingGeometry(r - 0.12, r + 0.12, 96).rotateX(-Math.PI / 2).translate(HEART[0], 5.32, HEART[1]);
          g.setAttribute('uv1', g.attributes.uv.clone());
          GB.rakeDark.add(g);
        }
      }
      // An armillary of gold rings turning over a stone plinth — the size of a
      // thing a court is built round, not of a thing on a desk: rings 5 to 6.4
      // across read, at the end of the walk, as a toy.
      if (webOld(7)) {
        GB.stone.add(placed(new THREE.CylinderGeometry(6.2, 6.6, 1.4, 20), HEART, 5 + 0.7));
        GB.stone.add(placed(new THREE.CylinderGeometry(3.2, 4.0, 8.6, 16), HEART, 6.4 + 4.3));
        GB.stone.add(placed(new THREE.CylinderGeometry(4.2, 3.4, 1.1, 16), HEART, 15 + 0.55));
        // the drum banded in gilt top and foot, as an instrument's stand is
        GB.gold.add(placed(new THREE.TorusGeometry(3.86, 0.16, 6, 40).rotateX(Math.PI / 2), HEART, 7.8));
        GB.gold.add(placed(new THREE.TorusGeometry(3.32, 0.14, 6, 40).rotateX(Math.PI / 2), HEART, 14.2));
      } else {
        // A carved stand (webFix.js, 7): three plain cylinders under the most
        // richly made thing in the garden read as a drainpipe under a clock. A
        // stepped plinth, a moulded base, a shaft reeded at foot and head, an
        // ovolo capital; and between the reeds, in two rings of gilt capitals,
        // the sentence the map says when the walk is over — its middle turned
        // to the way in.
        const { stone, gold } = pedestalGeometry();
        GB.pedestal.add(stone.translate(HEART[0], 0, HEART[1]));
        // (gardenFix5.js, 8: its two bands in the collars' dark gilt, not bright gold)
        for (const g of gold) (garden5Old(8) ? GB.gold : GB.pavGilt).add(g.translate(HEART[0], 0, HEART[1]));
        const from = mazeRoute.length > 1 ? unit2(HEART, mazeRoute[mazeRoute.length - 2]) : [0, -1];
        for (const L of pedestalLetters(gilt.glyphs, Math.atan2(from[1], from[0]))) {
          const G = gilt.glyphs[L.ch];
          const g = new THREE.PlaneGeometry(gilt.cellW * L.cap, gilt.cellH * L.cap);
          const uv = g.attributes.uv;
          for (let v = 0; v < uv.count; v++) uv.setXY(v, (G.col + uv.getX(v)) / gilt.cols, 1 - (G.row + 1 - uv.getY(v)) / gilt.rows);
          // standing on the shaft, facing out from it
          GB.letters.add(g.rotateY(Math.PI / 2 - L.a).translate(HEART[0] + Math.cos(L.a) * L.r, L.y, HEART[1] + Math.sin(L.a) * L.r));
        }
      }
      // An instrument, not three hoops: three plain gold rings on a stalk have
      // less to them than a lamp, and they are the last thing the walk shows.
      // The meridian, standing, its rim cut in degrees, with the polar axis
      // through it at the latitude of the place; the equator, ticked in hours;
      // and the ecliptic, a broad band with the twelve signs let into it — dark
      // bronze, and the gilt only in what is cut into it. A seed of light where
      // the axis crosses. (Each ring is the child the three hoops were: the
      // turning in tick and the finale's spin ask for them by place.)
      armillary = new THREE.Group();
      armillary.position.set(HEART[0], 26, HEART[1]);
      const ticks = (r, n, len, deep, every = 0) => {
        const parts = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2, long = every && k % every === 0;
          parts.push(new THREE.BoxGeometry(long ? len * 1.9 : len, 0.12, deep).translate(r + (long ? len * 0.95 : len / 2), 0, 0).rotateZ(a));
        }
        const g = mergeGeometries(parts);
        parts.forEach((x) => x.dispose());
        return keep(g);
      };
      // (webProps.js, 3: flat bands, the scale let into their faces; with
      // ?wwebprops=old:3 the degrees and the hours are those `ticks`, gilt
      // blocks stood out from the rims of round hoops, and the rings read as
      // gears)
      const ringed = (group, which, hoop, teeth, opts) => {
        if (webPropsOld(3)) {
          group.add(new THREE.Mesh(keep(hoop()), M.bronze));
          group.add(new THREE.Mesh(teeth(), M.gold));
          return;
        }
        // (gardenFix5.js, 8: and a bead at each edge of each face, the scale between)
        const { band, scale } = graduatedRing(which, (parts) => mergeGeometries(parts), { ...opts, bead: garden5Old(8) ? null : BEAD });
        group.add(new THREE.Mesh(keep(band), M.bronze));
        group.add(new THREE.Mesh(keep(scale), M.gold));
      };
      const meridian = new THREE.Group();
      ringed(meridian, 'meridian', () => new THREE.TorusGeometry(9.4, 0.46, 10, 120), () => ticks(9.82, 72, 0.42, 0.62, 6));
      {
        const lat = 35 * deg, L = 11.8;
        const axisRod = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.2, 0.2, 2 * L, 10)), M.bronze);
        axisRod.rotation.z = -lat;
        meridian.add(axisRod);
        for (const e of [-1, 1]) {
          const tip = new THREE.Mesh(keep(new THREE.SphereGeometry(0.42, 12, 8)), M.gold);
          tip.position.set(Math.sin(lat) * L * e, Math.cos(lat) * L * e, 0);
          meridian.add(tip);
        }
      }
      armillary.add(meridian);
      const equator = new THREE.Group();
      ringed(equator, 'equator', () => new THREE.TorusGeometry(8.6, 0.32, 8, 110), () => ticks(8.88, 24, 0.36, 0.42), { edge: true });
      equator.rotation.set(Math.PI / 2, 0, 0);
      armillary.add(equator);
      const ecliptic = new THREE.Group();
      {
        // (gardenFix5.js, 8: the broad band's two rims rolled over, inside and out)
        const roll = (r, y, way) => Array.from({ length: 7 }, (_, k) => [r + way * 0.1 * Math.sin((Math.PI * k) / 6), y - way * 0.1 * Math.cos((Math.PI * k) / 6)]);
        const section = garden5Old(8) ? [[7.32, -0.85], [7.72, -0.85], [7.72, 0.85], [7.32, 0.85], [7.32, -0.85]]
          : [[7.32, -0.85], [7.72, -0.85], [7.72, -0.85], ...roll(7.72, -0.73, 1), [7.72, -0.63], [7.72, 0.63], ...roll(7.72, 0.73, 1), [7.72, 0.85], [7.72, 0.85],
            [7.32, 0.85], [7.32, 0.85], ...roll(7.32, 0.73, -1), [7.32, 0.63], [7.32, -0.63], ...roll(7.32, -0.73, -1), [7.32, -0.85]];
        const band = new THREE.LatheGeometry(section.map(([x, y]) => new THREE.Vector2(x, y)), 110);
        ecliptic.add(new THREE.Mesh(keep(band.rotateX(Math.PI / 2)), M.bronze));
        const signs = [];
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          signs.push(new THREE.BoxGeometry(0.1, 0.08, 1.5).translate(7.76, 0, 0).rotateZ(a));
          signs.push(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10).rotateZ(Math.PI / 2).translate(7.77, 0, 0).rotateZ(a + Math.PI / 12));
        }
        const g = mergeGeometries(signs);
        signs.forEach((x) => x.dispose());
        ecliptic.add(new THREE.Mesh(keep(g), M.gold));
      }
      ecliptic.rotation.set(Math.PI / 2, 0, Math.PI / 3);
      armillary.add(ecliptic);
      heartParts.core = new THREE.Mesh(keep(new THREE.SphereGeometry(0.8, 20, 14)), keep(new THREE.MeshBasicMaterial({ color: '#ffcf8a', toneMapped: false })));
      armillary.add(heartParts.core);
      halo(HEART, 26, 34, '#ffd08a', 0.34);
      heartParts.halo = halos[halos.length - 1];
      heartParts.armillary = armillary;
      root.add(armillary);
    } else {
      const facing = [0, 1], width = 30, height = width / (3376 / 1440);
      const at = add(HEART, facing, -6), angle = Math.atan2(facing[0], facing[1]);
      const panel = new THREE.BoxGeometry(width + 3, height + 3, 1.6);
      panel.rotateY(angle);
      panel.translate(at[0], 10 + height / 2, at[1]);
      GB.stone.add(panel);
      const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
      const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
      const front = add(at, facing, 0.9);
      plane.position.set(front[0], 10 + height / 2, front[1]);
      plane.rotation.y = angle;
      root.add(plane);
      mounts[7] = { center: [front[0], 10 + height / 2, front[1]], normal: facing, width, height, material: mat };
    }
    for (let s = 0; s < (light ? 70 : 160); s++) {
      const p = s < 100
        ? [rr(x0 - 12, x0 + cols * cw + 12), rr(z0 - 12, z0 + rows * ch + 12)]
        : [rr(900, 1500), rr(-40, 640)];
      if (s >= 100 && (!inGarden(p) || pathDist(p) > 80)) continue;
      fireflies.push({ p: [p[0], rr(12, 46), p[1]], s: Array(3).fill(rr(0.7, 1.35)), color: pick(['#f4ff9c', '#fff2a4', '#b8ffe6']), k: rr(0.8, 1.4), phase: rr(0, 100) });
    }
    // and more over the maze, from a stream of their own (webFix.js, 5)
    if (!webOld(5)) {
      const fr = makeRng(FLIES.seed), frr = (a, b) => a + (b - a) * fr();
      for (let s = 0; s < (light ? FLIES.extra / 2 : FLIES.extra); s++) {
        moreFlies.push({ p: [frr(x0 - 10, x0 + cols * cw + 10), frr(12, 40), frr(z0 - 10, z0 + rows * ch + 10)], s: Array(3).fill(frr(0.7, 1.35)), color: fr() < 0.5 ? '#f4ff9c' : '#fff2a4', k: frr(0.8, 1.4), phase: frr(0, 100) });
      }
    }
  }

  // ivy over the stone where the honeycomb meets the garden
  for (const cell of cells) {
    if (cell.garden) continue;
    for (let k = 0; k < 6; k++) {
      if (!isGardenAt(cell.i + NB[k][0], cell.j + NB[k][1]) || (cell.k === '4,-4' && k === 5)) continue;
      const e = edgeFrame(cell.c, k);
      const o0 = add(cell.c, dir(60 * k), RC), o1 = add(cell.c, dir(60 * k + 60), RC);
      for (let s = 0; s < 3; s++) {
        const p = add(lerp2(o0, o1, rr(0.1, 0.9)), e.n, rr(-10, 4));
        // (mats laid flat on the coping: from the Web of Time, over the
        // cedars, a row of dark green discs. Drawn, not laid: auditFix.js, 2)
        const mat = { p: [p[0], MASS_H + CAP + 0.6 + s * 0.3, p[1]], rot: [0, -Math.atan2(e.t[1], e.t[0]) + rr(-0.25, 0.25), 0], s: [rr(56, 90), 1, rr(22, 34)] };
        if (auditOld(2)) ivy.push(mat);
      }
    }
  }
  {
    // Mats of it over the first bays of the pergola. (The draws of mats once
    // laid across the breach at the height of the arch, laid out beyond the
    // wall.)
    const e = edgeFrame(DOOR, 5);
    for (let s = 0; s < 6; s++) {
      const along = rr(-46, 46), out = rr(-16, 16);
      const p = add(add(GATE, e.t, along * 0.32), e.n, 48 + out * 1.2);
      const y = Math.abs(along) < 30 ? rr(46, 60) : rr(20, 60);
      // (seen from under the pergola, a ceiling of painted green balls; the
      // wisteria's own leaves lie over its rafters now — ivy.js — and the
      // draws are only spent)
      const mat = { p: [p[0], 47 + (y - 20) * 0.04, p[1]], rot: [0, rr(0, 6.28), 0], s: [rr(40, 64) * 0.7, 1, rr(26, 40) * 0.7] };
      if (IVY_OLD) ivy.push(mat);
    }
  }

  hangPainting(4, [DOOR[0], DOOR[1] - A + 2.5], 38, [0, 1], 80);
  return { armillary, mazeGrid, mazeRects };
}
