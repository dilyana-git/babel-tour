// The honeycomb of galleries (buildWorld.js, assembleWorld): where the cells
// stand, their walls, hallways and arches, the stone balustrades, and the
// dressing every flight of stairs is given.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Wood } from '../trees';
import { PORTAL } from '../portal';
import { makeMirrors } from '../mirror';
import { ECHO_STONE, lib3Old } from '../libFix3';
import { doorOld, revealShade } from '../doorFix';
import { WOOD_OLD } from '../woodGrain';
import { deg, PORTAL_FRAME } from './common';

export function buildHoneycomb(ctx) {
  const { light, dir, add, dist, bounceRooms, workAt, echoDeep, placed, wells, Q, qNum } = ctx;
  // ── The honeycomb ─────────────────────────────────────────────────────────
  const R = 100, A = R * Math.sqrt(3) / 2, GAP = 50, D = 2 * A + GAP, AC = D / 2, RC = AC * 2 / Math.sqrt(3);
  const HALL = 36;
  const ARCH_SPRING = 58, ARCH_R = HALL / 2; // hallways are arched, apex at 76
  const O = [232, 785];
  const E0 = [D * Math.cos(30 * deg), D * Math.sin(30 * deg)], E1 = [0, D];
  // The way in — the hallway out of the back of the Vestibule — and the one it
  // is dressed as and opens as (doorway.js): two hallways along the honeycomb,
  // between the Silence and the Echo. `by` takes the one to the other.
  const WAY_IN = { from: '0,0', to: '-1,1', by: [2 * (E0[0] - E1[0]), 2 * (E0[1] - E1[1])] };
  const cellC = (i, j) => [O[0] + i * E0[0] + j * E1[0], O[1] + i * E0[1] + j * E1[1]];
  // The Echo is wider than the other galleries. With its colonnade out at 62
  // (clear of the stair coping) the aisle between a column's plinth and the
  // bookcases would be under a metre at the others' size, and the reader would
  // squeeze past every pier. Growing R for every room moves every cell and the
  // garden with them (see the honeycomb's spacing above), so only this room
  // grows, into its own walls: they stand 25 deep on each side of a hallway,
  // and the Echo takes ten of its twenty-five. Every cell stays where it is,
  // and so does every other room; the hallways into the Echo are shorter by
  // what it took. ?wechoroom=old is the Echo at 100; ?wechor dials it.
  const ECHO_R = qNum('wechor', Q.get('wechoroom') === 'old' ? R : 112), ECHO_A = (ECHO_R * Math.sqrt(3)) / 2;
  const ECHO_C = cellC(1, -1);
  // a room's rim, centre to corner, and how much nearer the cell's edge its
  // walls stand than a standard room's (what its hallways lose at its end)
  const rimAt = (c) => (dist(c, ECHO_C) < 1 ? ECHO_R : R);
  const deepAt = (c) => ((rimAt(c) - R) * Math.sqrt(3)) / 2;
  const key = (i, j) => `${i},${j}`;
  const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const ROUTE = { '0,0': 0, '1,-1': 1, '2,-2': 2, '3,-3': 3, '4,-4': 4 };
  const GARDEN = new Set();
  for (let i = 3; i <= 16; i++) {
    for (let j = -20; j <= -2; j++) {
      const [x, y] = cellC(i, j);
      if (y < (x - 720) * 0.889 + 20) GARDEN.add(key(i, j));
    }
  }
  GARDEN.add('5,-4');
  ['4,-4', '3,-3', '3,-4'].forEach((k) => GARDEN.delete(k));
  const cells = [];
  for (let i = -7; i <= 16; i++) {
    for (let j = -20; j <= 12; j++) {
      const c = cellC(i, j);
      if (c[0] < -620 || c[0] > 2100 || c[1] < -1000 || c[1] > 1400) continue;
      cells.push({ i, j, c, k: key(i, j), garden: GARDEN.has(key(i, j)), room: ROUTE[key(i, j)] });
    }
  }
  // (x, z, how much warm floor-light the room's stone soffits take back)
  bounceRooms.value = [[0, 0, 1], [1, -1, 0.8], [2, -2, 0.25], [3, -3, 0.5], [4, -4, 0.7]]
    .map(([i, j, k]) => { const q = cellC(i, j); return new THREE.Vector3(q[0], q[1], k); });
  workAt.value.set(ECHO_C[0], ECHO_C[1], ECHO_STONE.reach + ECHO_R - 112);
  echoDeep.value = deepAt(ECHO_C);
  // the wells of the three rooms that have one (hexagons: the flat radius of
  // `shaft` below), and the Vertigo's round pit
  wells.value = [[0, 0, 48, 1], [1, -1, 38, 1], [2, -2, 40, 1], [3, -3, 68, 0]]
    .map(([i, j, r, hex]) => { const q = cellC(i, j); return new THREE.Vector4(q[0], q[1], hex ? r * Math.sqrt(3) / 2 : r, hex); });
  const inFrame = (p) => p[0] > -160 && p[0] < 1600 && p[1] > -260 && p[1] < 1080;
  const isGardenAt = (i, j) => GARDEN.has(key(i, j));
  const nearestCell = (p) => cells.reduce((best, c) => (dist(c.c, p) < dist(best.c, p) ? c : best), cells[0]);
  const inGarden = (p) => nearestCell(p).garden;
  const routeCenters = Object.keys(ROUTE).map((k) => cellC(...k.split(',').map(Number)));
  const routeDist = (p) => Math.min(...routeCenters.map((c) => dist(c, p)));
  const hallway = (cell, k) => {
    if (cell.garden || (k !== 2 && k !== 5)) return false;
    if (isGardenAt(cell.i + NB[k][0], cell.j + NB[k][1])) return false;
    if (cell.k === '3,-3' && k === 5) return false;
    if (cell.k === '4,-4') return false;
    return true;
  };
  const edgeFrame = (c, k) => {
    const r = rimAt(c);
    const n = dir(60 * k + 30);
    const i0 = add(c, dir(60 * k), r), i1 = add(c, dir(60 * k + 60), r);
    const t = [(i1[0] - i0[0]) / r, (i1[1] - i0[1]) / r];
    return { n, t, i0, i1, mi: add(c, n, (r * Math.sqrt(3)) / 2) };
  };
  const hallMid = (i, j, k) => add(cellC(i, j), dir(60 * k + 30), AC);

  // ── Stone balustrades ──
  // What a stone bridge carries over the dark: a plinth, turned stone
  // balusters, a moulded handrail, and a pedestal wherever the run starts,
  // stops or is met by another. Not bronze: pipes on round posts and a rod over
  // spindles are a ship's rail and an office stair's, in rooms of ashlar, Doric
  // columns and walnut. It all goes in the stone of the coping it stands on, in
  // batches of its own: `balustrade` is not one of body.js's STAIRS, so no tall
  // step is ever taken up onto it. ?wrail=old is the bronze.
  const RAIL_OLD = Q.get('wrail') === 'old';
  // The Vestibule's bridge level with the floor, the well's rail run round it
  // (vestibuleBridge.js). ?wbridge=old: the raised bridge with the stone
  // balustrade above, ?wrail=old the bronze before that.
  const BRIDGE_LEVEL = !RAIL_OLD && Q.get('wbridge') !== 'old';
  // The Echo's flights without their string course, flank and arch one face
  // (?wline=old: the string), and its well ringed by a low stone kerb rather
  // than the bronze rail every other well has (?wwell=old: the bronze).
  const ECHO_ONE_FACE = Q.get('wline') !== 'old';
  const ECHO_KERB = Q.get('wwell') !== 'old';
  // A moulding run along a line. `sec` is its section, [across, up, sharp]
  // round the outline, set off each point of `path` ([x, y, z]) across the
  // line in plan and straight up: on a rake the section stays plumb, as a
  // stair's stone handrail is cut, and where the line turns in plan the run
  // is mitred. Both ends are closed.
  const mouldGeo = (path, sec) => {
    const seg = path.slice(1).map((p, i) => {
      const dx = p[0] - path[i][0], dz = p[2] - path[i][2], L = Math.hypot(dx, dz) || 1;
      return [-dz / L, dx / L];
    });
    const across = path.map((_, i) => {
      const a = seg[Math.max(0, i - 1)], b = seg[Math.min(seg.length - 1, i)];
      const m = [a[0] + b[0], a[1] + b[1]], L = Math.hypot(m[0], m[1]) || 1;
      const k = 1 / Math.max(0.5, (m[0] * b[0] + m[1] * b[1]) / L);
      return [(m[0] / L) * k, (m[1] / L) * k];
    });
    // the section's columns of vertices: a sharp corner is two, one for each
    // face it parts, so the arrises stay crisp and the curves stay round
    // (`p`, how far round the outline: the stone is laid along the moulding,
    // as it is cut, and round it)
    const cols = [], faces = [];
    let prev = -1, p = 0;
    sec.forEach(([z, y, sharp], j) => {
      if (j) p += Math.hypot(z - sec[j - 1][0], y - sec[j - 1][1]);
      const into = cols.push([z, y, p]) - 1, out = sharp ? cols.push([z, y, p]) - 1 : into;
      if (prev >= 0) faces.push([prev, into]);
      prev = out;
    });
    // (closed by a column of its own at the far end of the outline)
    faces.push([prev, cols.push([sec[0][0], sec[0][1], p + Math.hypot(sec[0][0] - sec[sec.length - 1][0], sec[0][1] - sec[sec.length - 1][1])]) - 1]);
    let area = 0;
    sec.forEach(([z, y], j) => { const [z2, y2] = sec[(j + 1) % sec.length]; area += z * y2 - z2 * y; });
    const C = cols.length, pos = [], uv = [], idx = [];
    let run = 0;
    path.forEach(([x, y, z], i) => {
      if (i) run += Math.hypot(x - path[i - 1][0], y - path[i - 1][1], z - path[i - 1][2]);
      for (const [cz, cy, cp] of cols) { pos.push(x + across[i][0] * cz, y + cy, z + across[i][1] * cz); uv.push(run * CARVE_UV, cp * CARVE_UV); }
    });
    for (let i = 0; i + 1 < path.length; i++) {
      for (const [sa, sb] of faces) {
        const a = i * C + sa, b = i * C + sb, c = (i + 1) * C + sb, d = (i + 1) * C + sa;
        if (area > 0) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d);
      }
    }
    const tris = THREE.ShapeUtils.triangulateShape(sec.map(([z, y]) => new THREE.Vector2(z, y)), []);
    for (const [back, i] of [[true, 0], [false, path.length - 1]]) {
      const o = pos.length / 3;
      for (const [z, y] of sec) { pos.push(path[i][0] + across[i][0] * z, path[i][1] + y, path[i][2] + across[i][1] * z); uv.push(z * CARVE_UV, y * CARVE_UV); }
      for (const t of tris) {
        const [p, q, r] = t.map((k) => sec[k]);
        // a triangle anticlockwise in (across, up) faces back down the line
        const anti = (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]) > 0;
        if (anti === back) idx.push(o + t[0], o + t[1], o + t[2]); else idx.push(o + t[0], o + t[2], o + t[1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // Carved stone is laid by projection where nothing says otherwise: at the
  // mouldings' scale, off whichever axis a face is turned to (as portal.js
  // lays the Door's arch). `shift` moves a piece about on the stone, so no
  // two are cut from the same patch of it.
  const CARVE_UV = 1 / 13;
  const carveUv = (geo, shift = [0, 0]) => {
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
      uv[i * 2] = u * CARVE_UV + shift[0];
      uv[i * 2 + 1] = v * CARVE_UV + shift[1];
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
  };
  // where on the stone a piece standing at [x, z] is cut from (not the
  // world's random stream: nothing built after this may move)
  const patchOf = ([x, z]) => [((x * 0.618 + z * 0.271) % 1 + 1) % 1, ((x * 0.137 - z * 0.553) % 1 + 1) % 1];
  // A section drawn as its right half, bottom to top, and mirrored; `half`
  // and `h` scale it from the unit it is drawn in (half-width 1, height h0).
  const section = (right, h0) => (half, h) => [...right, ...[...right].reverse().filter(([z]) => z > 1e-6).map(([z, y, s]) => [-z, y, s])]
    .map(([z, y, s]) => [z * half, (y * h) / h0, s]);
  // The handrail: a fillet on the balusters' heads, an ovolo swelling out
  // under a plain face, and a rounded back for the hand.
  const RAIL_SEC = section([
    [0.74, 0, true], [0.74, 0.12, true], [0.8, 0.17], [0.89, 0.27], [0.95, 0.4], [0.98, 0.52, true],
    [1, 0.56, true], [1, 0.94, true], [0.95, 1.07], [0.82, 1.19], [0.58, 1.28], [0.3, 1.33], [0, 1.35],
  ], 1.35);
  // The plinth: a plain block, and a small ogee stepping it in to the
  // balusters' feet.
  const BASE_SEC = section([
    [1, 0, true], [1, 0.8, true], [0.97, 0.86], [0.9, 0.95], [0.82, 1.02, true], [0.78, 1.02, true], [0.78, 1.25, true],
  ], 1.25);
  // A turned stone baluster, plumb: a square plinth, a torus over a scotia,
  // the belly low, a long neck and a ring, and an echinus flaring to a square
  // abacus. [radius / r, height up the turned part]
  const BAL = [
    [0.92, 0], [0.99, 0.035], [0.7, 0.085], [0.72, 0.12], [0.92, 0.19], [1, 0.28], [0.93, 0.4], [0.7, 0.52],
    [0.48, 0.63], [0.45, 0.69], [0.58, 0.715], [0.58, 0.765], [0.46, 0.79], [0.62, 0.885], [0.86, 0.965], [0.9, 1],
  ];
  // Both square blocks are sunk BED into what they stand on and carry: plumb
  // under a raking rail, a level block stands proud of it at one corner.
  const BED = 0.3;
  const balusterCache = new Map();
  const balusterGeo = (h, r, shift) => {
    const key = `${h.toFixed(2)}:${r}`;
    if (!balusterCache.has(key)) {
      const blk = BED + 0.34, L = h - 2 * blk, sq = 2.04 * r;
      // the turned part laid round it and up it, as it turns on the lathe
      const turned = new THREE.LatheGeometry(BAL.map(([x, t]) => new THREE.Vector2(x * r, blk + t * L)), lib3Old(4) ? (light ? 7 : 10) : (light ? 10 : ECHO_STONE.sides));
      const tp = turned.attributes.position, tuv = turned.attributes.uv;
      for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) * 2 * Math.PI * r * CARVE_UV, tp.getY(i) * CARVE_UV);
      const parts = [
        carveUv(new THREE.BoxGeometry(sq, blk, sq).translate(0, blk / 2, 0)),
        turned,
        carveUv(new THREE.BoxGeometry(sq, blk, sq).translate(0, h - blk / 2, 0)),
      ];
      balusterCache.set(key, mergeGeometries(parts));
      parts.forEach((g) => g.dispose());
    }
    const g = balusterCache.get(key).clone(), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + shift[0], uv.getY(i) + shift[1]);
    return g;
  };
  // A pedestal, from its foot: a base block as high as the plinth beside it
  // (and `sunk` below the foot, so a rake or a string under it never shows
  // daylight), a die with a raised panel on each face, and a cornice — capped
  // with a low weathering, or with a ball where a bridge ends.
  const pedestalGeo = (w, base, die, { ball = false, sunk = 0.5, shift = [0, 0] } = {}) => {
    // (each block let a hair down into the one under it: two faces on one
    // plane, in a stone drawn from both sides, flicker as a dashed line
    // along every joint)
    const LAP = 0.03;
    const box = (x, h, y0) => new THREE.BoxGeometry(x, h + LAP, x).translate(0, y0 + (h - LAP) / 2, 0);
    const parts = [
      box(w + 0.3, base + sunk, -sunk), box(w + 0.16, 0.28, base), box(w, die - base - 0.28, base + 0.28),
      box(w + 0.22, 0.3, die), box(w + 0.56, 0.55, die + 0.3), box(w + 0.3, 0.2, die + 0.85),
    ];
    const ph = die - base - 1.4;
    if (ph > 1) {
      for (let k = 0; k < 4; k++) {
        parts.push(new THREE.BoxGeometry(w - 0.8, ph, 0.16).translate(0, base + 0.84 + ph / 2, w / 2).rotateY((k * Math.PI) / 2));
      }
    }
    if (ball) {
      const r = w * 0.32;
      parts.push(box(w * 0.62, 0.3, die + 1.05),
        new THREE.CylinderGeometry(r * 0.42, r * 0.72, 0.42, 14).translate(0, die + 1.56 - LAP, 0),
        new THREE.SphereGeometry(r, 18, 12).translate(0, die + 1.62 + r * 0.92, 0));
    } else {
      const rr = (w + 0.3) / Math.SQRT2;
      // (four flat faces: as a smooth cone the weathering read as a dome)
      const cap = new THREE.CylinderGeometry(rr * 0.3, rr, 0.38, 4, 1).rotateY(Math.PI / 4).translate(0, die + 1.24 - LAP, 0).toNonIndexed();
      cap.computeVertexNormals();
      parts.push(cap);
    }
    const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
    const g = carveUv(mergeGeometries(flat), shift);
    parts.forEach((p) => p.dispose());
    flat.forEach((p) => p.dispose());
    return g;
  };
  // The two sizes: the Vestibule's bridge, and the flights' (and the Silence's
  // terrace, which is the flights' dressing bent round).
  //   railH/baseH  the handrail's and the plinth's heights; `sink` how far the
  //                plinth is let into what it stands on
  //   r, step      a baluster's belly, and how far apart they stand (the
  //                flights': three to a tread)
  const VEST_RAIL = { rail: RAIL_SEC(1, 1.4), railH: 1.4, base: BASE_SEC(1, 1.5), baseH: 1.5, sink: 0.3, r: 0.78, step: 2.6, ped: 2.6 };
  const FLIGHT_RAIL = { rail: RAIL_SEC(0.9, 1.25), railH: 1.25, base: BASE_SEC(0.7, 0.85), baseH: 0.85, sink: 0.25, r: 0.68, step: 7 / 3, ped: 2.1 };
  // A run of balustrade from one end to the other (pedestal centres, or any
  // ends it dies into): its plinth along `foot`, its handrail with its top at
  // `top`, balusters between. `at(s)` is [x, z] at s along it, `knots` every s
  // where a line bends (the two ends among them), `clear` how far in from
  // each end the balusters begin, `ry(s)` the turn of their square blocks.
  const stoneRail = (batch, { at, foot, top, knots, clear = [0, 0], ry, S }) => {
    const line = (y) => knots.map((s) => { const p = at(s); return [p[0], y(s), p[1]]; });
    batch.add(mouldGeo(line((s) => foot(s) - S.sink), S.base));
    batch.add(mouldGeo(line((s) => top(s) - S.railH), S.rail));
    const a = knots[0] + clear[0], b = knots[knots.length - 1] - clear[1];
    const n = Math.max(1, Math.round((b - a) / S.step));
    for (let k = 0; k < n; k++) {
      const s = a + ((k + 0.5) * (b - a)) / n;
      const y0 = foot(s) - S.sink + S.baseH - BED, y1 = top(s) - S.railH + BED;
      if (y1 - y0 < 2 + 2 * BED) continue;
      batch.add(placed(balusterGeo(Math.round((y1 - y0) * 20) / 20, S.r, patchOf(at(s))), at(s), y0, ry(s)));
    }
  };

  // A flight of steps as one piece of stone: stepped along the top, arched
  // underneath, and — with `from`/`to` inside [0, steps] — able to stop in mid
  // air, sheared off over the well with the arch broken away under it.
  const flightProfile = ({
    steps = 18, run = 8, lift = 2.4, base = 8, tread = 3, span = (steps * run) / 2,
    from = 0, to = steps, spring = 47, arch = 21, ground = 3,
  }) => {
    const stepTop = (k) => base + (k < steps / 2 ? k : steps - 1 - k) * lift + tread;
    // the top of whichever tread is at u
    const stepAt = (u) => stepTop(Math.max(from, Math.min(to - 1, Math.floor((u + span) / run))));
    const soffit = (t) => { const r = Math.abs(t) / spring; return ground + (r < 1 ? arch * (1 - r * r) ** 0.62 : 0); };
    // The pitch line: the straight rake through the nosings, up one side and
    // down the other, level over the two middle treads. Everything the flight
    // wears — its string course, its arch ring, the height of its handrail —
    // is set off this one line, so none of it can drift out of step with the
    // stone. (The stepped top is where a tread IS; the pitch line is where the
    // eye reads the stair going.)
    const pitch = (u) => base + tread + lift * Math.min((u + span) / run, (span - u) / run, (steps - 2) / 2);
    // where it levels off, either side of the crown
    const crown = span - (run * (steps - 2)) / 2;
    const u0 = -span + from * run, u1 = -span + to * run;
    const top = [];
    for (let k = from; k < to; k++) {
      const t0 = -span + k * run;
      top.push([t0, stepTop(k)], [t0 + run, stepTop(k)]);
    }
    const under = [];
    for (let n = 24; n >= 0; n--) {
      const t = u0 + (n / 24) * (u1 - u0);
      under.push([t, soffit(t)]);
    }
    return {
      pts: [...top, ...under], top, u0, u1, soffit, pitch, stepTop, stepAt, crown,
      dims: { steps, run, span, spring, from, to },
    };
  };
  return { R, A, GAP, D, AC, RC, HALL, ARCH_SPRING, ARCH_R, WAY_IN, cellC, ECHO_R, ECHO_A, rimAt,
    deepAt, NB, cells, inFrame, isGardenAt, inGarden, routeCenters, routeDist, hallway, edgeFrame,
    hallMid, RAIL_OLD, BRIDGE_LEVEL, ECHO_ONE_FACE, ECHO_KERB, mouldGeo, patchOf, pedestalGeo,
    VEST_RAIL, FLIGHT_RAIL, stoneRail, flightProfile };
}

export function buildFlightDressing(ctx) {
  const { light, dir, add, keep, shaftMaterial, stoneShade, M, root, Batch, slabGeo, boxGeo, placed,
    profileGeo, rodGeo, flatQuad, RAIL_OLD, patchOf, pedestalGeo, FLIGHT_RAIL, stoneRail } = ctx;
  // ── The dressing on a flight ──────────────────────────────────────────────
  // A stepped block with a hole under it is not a bridge yet. This is what
  // makes it one. Almost none of it is written out in numbers of its own:
  // every line is asked of the profile the stone is cut from
  // (`flightProfile`), so a flight that is ever re-cut carries its ornament
  // with it.
  //
  //   nosings      a moulded lip over every riser. Without them a stair is a
  //                stack of blocks, and this is the part the reader climbs
  //                past at arm's length.
  //   the ring     the arch drawn as the voussoirs it would be built of: proud
  //                of both flanks AND carried on across the soffit, so the
  //                underside is coursed too instead of being one dark sheet,
  //                with a keystone at the crown.
  //   abutments    beyond the springing the flank comes down to the floor, and
  //                that is the only stone in the span standing on anything —
  //                so it is the part that should look like it. Coursed ashlar
  //                on a projecting plinth, joints broken course over course.
  //   the string   a band and a corona over it, riding just under the deck
  //                line from end to end. It is the line that hands the eye
  //                the whole span at once, and what the keystone breaks up
  //                through.
  //   balustrade   turned balusters on the coping, between newels, over the
  //                arch and no further — and BROKEN again at the crossing,
  //                where the other flight's deck arrives and a reader can
  //                step across. Both of those are measured, not chosen; the
  //                notes are where they are decided.
  // (`nosing`, `riser`: where the lips and the risers' shade go, when not
  // `stone` and LB.riserShade; `string`: a wall string up the inside of both
  // flanks — the Echo's, echoFix.js point 2)
  const flightDress = (c, ang, f, halfW, { gap = null, ends = [true, true], stone = LB.cap, worn = true, keyThrough = true, cross = null, gapNewels = true, plane = false, face = stone, nosing = stone, riser = LB.riserShade, string = false } = {}) => {
    const { run, span, spring, steps, from, to } = f.dims;
    const { u0, u1, soffit, pitch, stepTop, stepAt, crown } = f;
    const ax = dir(ang), px = dir(ang + 90);
    const spot = (u, z) => add(add(c, ax, u), px, z);
    // A flight sheared off in mid air (the Silence) has no pitch line left
    // where it was cut, so the parapet would stand on past the broken deck in
    // the air. `shorn` holds it down to the stone that is really there.
    const shorn = Math.min(from > 0 ? stepTop(from) + 0.6 : Infinity,
      to < steps ? stepTop(to - 1) + 0.6 : Infinity);
    const deck = (u) => Math.min(pitch(u), shorn);
    // Everything on the flank is set off the deck line and RAKES with it — the
    // parapet, its coping, the string under it, the top of the arch ring.
    // Stepping the kerb with the treads instead leaves a sawtooth of bare stone
    // between it and every raking member, and the foot of the stair looks like
    // a slipped wall.
    //
    // The pitch line kinks over the crown, so a member drawn from end to end
    // has to be given those corners or it cuts across the top of the flight.
    const kinks = [-crown, crown].filter((u) => u > u0 + 1e-6 && u < u1 - 1e-6);
    const rake = (dy, a = u0, b = u1) => [a, ...kinks.filter((k) => k > a + 1e-6 && k < b - 1e-6), b]
      .map((u) => [u, deck(u) + dy]);
    const bandPts = (lo, hi, a, b) => [...rake(hi, a, b), ...rake(lo, a, b).reverse()];
    // Over the crossing the parapet comes DOWN. The other flight's deck arrives
    // there, and a kerb standing across it is a kerb across the way off — from
    // the crown the landing would be a lattice of four little walls with the
    // reader penned in the middle of it. Only the stone above the deck goes;
    // what is under it belongs to the arch and stays. `gap` is one span for
    // both flanks, or a function of the flank (-1, 1) where the two differ —
    // two flights meeting at a landing at 60 degrees bury the inner flank in
    // each other three times as far as the outer one. A span may run off either
    // end of the flight; it is clipped to it.
    const HIGH = 1.6, FLUSH = -0.45;
    // ── where another flight crosses this one ──
    // `cross` is a flight crossing this one at its middle, the same width (the
    // Echo's two): { c, ang, f, half }, `half` the half-width of its treads.
    // The flank is set off the PITCH line, which rakes through the nosings and
    // so stands a whole riser over the back of every tread: under the crown
    // that is buried, one tread down it is not, and run straight on through the
    // other flight the parapet, the string and corona and the keystone would
    // stand up out of its lower treads as slabs and sloping kerbs lying across
    // its stair, up to three units proud. So, crossed:
    //
    //   - no member of the flank stands higher than the other flight's tread
    //     where it passes under it (`crossTop`, `roof`, `cutTo`);
    //   - over the crossing the flank comes down to its own TREADS, not to the
    //     pitch line, so the landing is stone flush to the outer face;
    //   - the parapet opens only where the other's deck really comes in, a
    //     different stretch on each flank, and the two balustrades meet at a
    //     newel at each of the four corners (one span for both would leave each
    //     flank open over the well for ten units past the other flight).
    // ?wcross=old is the old crossing.
    const crossTop = (p) => {
      if (!cross) return Infinity;
      const a = dir(cross.ang), n = dir(cross.ang + 90), d = [p[0] - cross.c[0], p[1] - cross.c[1]];
      const u = d[0] * a[0] + d[1] * a[1], z = d[0] * n[0] + d[1] * n[1];
      return Math.abs(z) > cross.half || u < cross.f.u0 || u > cross.f.u1 ? Infinity : cross.f.stepAt(u);
    };
    // The highest a member lying from z0 to z1 off the axis may stand at u:
    // a hair under any tread of the other flight over it, and over the gap
    // `g`, a hair under this flight's own.
    const roof = (z0, z1, g = null) => (u) => {
      let y = g && u > g[0] && u < g[1] ? stepAt(u) - 0.03 : Infinity;
      const n = Math.max(1, Math.ceil(Math.abs(z1 - z0) / 0.4));
      for (let i = 0; i <= n; i++) y = Math.min(y, crossTop(spot(u, z0 + ((z1 - z0) * i) / n)) - 0.08);
      return y;
    };
    const lineAt = (line, u) => {
      for (let i = 1; i < line.length; i++) {
        const [ua, ya] = line[i - 1], [ub, yb] = line[i];
        if (ub > ua && u >= ua && u <= ub) return ya + ((yb - ya) * (u - ua)) / (ub - ua);
      }
      return u < line[0][0] ? line[0][1] : line[line.length - 1][1];
    };
    // A profile, `top` over `bot` (both running up u), cut down to `lim`: the
    // pieces of it left standing. Where nothing cuts it, it is the profile it
    // was, point for point.
    const cutTo = (top, bot, lim) => {
      const whole = [[...top, ...[...bot].reverse()]];
      if (!cross) return whole;
      const a = top[0][0], b = top[top.length - 1][0];
      const us = [a, b];
      for (let u = a; u < b; u += 0.25) us.push(u);
      for (const [u] of [...top, ...bot]) us.push(u - 1e-3, u, u + 1e-3);
      // (the risers, either side: a tread's edge is a step, not a slope)
      for (let k = from; k <= to; k++) { const e = -span + k * run; us.push(e - 1e-3, e + 1e-3); }
      const U = [...new Set(us)].filter((u) => u >= a && u <= b).sort((p, q) => p - q);
      if (U.every((u) => lim(u) >= lineAt(top, u))) return whole;
      const pieces = [];
      let cur = [];
      for (const u of U) {
        const lo = lineAt(bot, u), hi = Math.min(lineAt(top, u), lim(u));
        if (hi > lo + 0.02) cur.push([u, hi, lo]);
        else if (cur.length) { pieces.push(cur); cur = []; }
      }
      if (cur.length) pieces.push(cur);
      // A point in a straight run says nothing, so it goes — but straight
      // measured from the last point KEPT, not from its neighbours. Sampled a
      // thousandth apart, every point of a curve lies "in line" with the two
      // either side of it; tested that way the whole soffit would go, point by
      // point, its two ends joined by a chord, and the arch's backing course
      // and the flank over it would hang down across the opening under both
      // flights as one flat wall. A point goes only if every point dropped
      // since the last one kept still lies within a hundredth of the line that
      // stands for them.
      const lean = (line) => {
        const out = [line[0]];
        let k = 0;
        for (let i = 1; i < line.length - 1; i++) {
          const [ua, ya] = line[k], [ub, yb] = line[i + 1], L = Math.hypot(ub - ua, yb - ya) || 1;
          let off = 0;
          for (let j = k + 1; j <= i; j++) off = Math.max(off, Math.abs((yb - ya) * (line[j][0] - ua) - (line[j][1] - ya) * (ub - ua)) / L);
          if (off > 0.01) { out.push(line[i]); k = i; }
        }
        if (line.length > 1) out.push(line[line.length - 1]);
        return out;
      };
      return pieces.filter((r) => r.length > 1)
        .map((r) => [...lean(r.map(([u, hi]) => [u, hi])), ...lean(r.map(([u, , lo]) => [u, lo])).reverse()]);
    };
    const gapOf = (side) => {
      if (cross) {
        // from where this flank's rail meets one of the other flight's two
        // rails to where it meets the other (Z, the balustrade's line)
        const t = (cross.ang - ang) * deg, Z = halfW + 0.6;
        const a = (side * Z * Math.cos(t) - Z) / Math.sin(t), b = (side * Z * Math.cos(t) + Z) / Math.sin(t);
        return [Math.min(a, b), Math.max(a, b)];
      }
      return typeof gap === 'function' ? gap(side) : gap;
    };
    const parapetTop = (side) => {
      const out = [];
      const leg = (a, b, dy) => { if (b > a + 1e-6) out.push(...rake(dy, a, b)); };
      const g = gapOf(side);
      if (g && g[1] > u0 && g[0] < u1) {
        const a = Math.max(u0, g[0]), b = Math.min(u1, g[1]);
        leg(u0, a, HIGH);   // each leg ends and the next begins at the
        // same u: the doubled point is the step down (crossed, `roof` brings
        // it down to the treads)
        leg(a, b, cross ? HIGH : FLUSH);
        leg(b, u1, HIGH);
      } else leg(u0, u1, HIGH);
      return out;
    };
    // How far each member stands out past the flank the flight already has.
    // The order IS the hierarchy: courses recessed, the arch ring proud of
    // them, the string and the capping over the kerb proudest of all.
    const FACE = halfW + 0.8, COURSE = 0.3, RING = 0.78, BACK = 0.28, MOULD = 0.82, CORONA = 1.15;
    // (`face`: the stone of the flanks — kerb, ring, abutments, string, coping
    // — where `stone` is the nosings', which are walked on and so a stair to
    // body.js. The Echo's flanks are the flights' own stone: the caps' ashlar,
    // laid in world units, would run ONE bed joint dead level across both
    // flights at the same height, a line cutting the bridge in two)
    const FLOOR_Y = 6;
    const band = (pts, z0, z1, side) => face.add(profileGeo(pts, z1 - z0, spot(0, (side * (z0 + z1)) / 2), ang));
    // a member right across the flight, from `top` down to `bot`: in two
    // halves where another flight crosses, because each flank passes under
    // the other's treads at a different place
    const across = (top, bot, w) => {
      if (!cross) { face.add(profileGeo(cutTo(top, bot, null)[0], 2 * w, c, ang)); return; }
      for (const side of [-1, 1]) {
        for (const pts of cutTo(top, bot, roof(0, side * w))) face.add(profileGeo(pts, w, spot(0, (side * w) / 2), ang));
      }
    };

    // ── the flank ──
    // The kerb the flight carries its ornament on: one raking parapet a side,
    // from the soffit up past the deck, closing the stone at both flanks.
    for (const side of [-1, 1]) {
      const lim = roof(side * (halfW - 0.8), side * (halfW + 0.8), gapOf(side));
      for (const pts of cutTo(parapetTop(side), f.pts.slice(f.top.length).reverse(), lim)) {
        face.add(profileGeo(pts, 1.6, spot(0, side * halfW), ang));
      }
    }

    // ── nosings ──
    // One over every riser, overhanging the step below it and chamfered under,
    // so the lip throws a line of shadow the length of the flight instead of
    // reading as another square edge.
    //
    // And a stair is read by its values, not its shape: the lip pale, the riser
    // under it dark, the tread between. Cut from the treads' own stone and lit
    // by lamps that cast no shadow, all three would be one flat brown and the
    // flight a stack of slabs. So the lip is the parapet's paler stone, the
    // riser is laid in the shadow the lip would throw, and each tread is walked
    // paler down its middle where feet have gone.
    const TREAD_W = 2 * (halfW - 0.8);
    for (let k = from; k <= to; k++) {
      const e = -span + k * run;
      const hi = k > from ? stepTop(k - 1) : -1e9, lo = k < to ? stepTop(k) : -1e9;
      if (Math.abs(hi - lo) < 0.01) continue;
      // which way the lip hangs: out over the lower of the two steps it divides
      const d = hi > lo ? 1 : -1, floor = Math.min(hi, lo);
      // (where a crossing flight's tread lies level with the lip, the lip
      // sinks a hair under it rather than fight it for the one plane)
      const level = cross && Array.from({ length: 9 }, (_, i) => crossTop(spot(e + d * 0.5, ((i - 4) / 4) * (TREAD_W / 2))))
        .some((y) => Math.abs(y - Math.max(hi, lo)) < 0.01);
      const h = Math.max(hi, lo) - (level ? 0.06 : 0);
      // (with a string, the Echo's: the lip's front arris taken off at 45°,
      // a face turned up to the lamps over the stair, so the lip is drawn as
      // the palest line on each step — its front faces away from them)
      nosing.add(profileGeo(string
        ? [[e, h], [e + d * 0.6, h], [e + d * 0.95, h - 0.35], [e + d * 0.95, h - 0.6], [e + d * 0.3, h - 1.2], [e, h - 1.2]]
        : [[e, h], [e + d * 0.95, h], [e + d * 0.95, h - 0.5], [e + d * 0.3, h - 1.2], [e, h - 1.2]], TREAD_W, c, ang));
      if (floor > -1e8 && h - 1.2 > floor + 0.2) {
        riser.add(profileGeo([[e + d * 0.03, floor], [e + d * 0.06, floor], [e + d * 0.06, h - 1.2], [e + d * 0.03, h - 1.2]], TREAD_W, c, ang));
      }
    }
    // ── the wall string ──
    // A raking band up the inside of each flank, from under the treads to a
    // little over the nosings, that every step dies into. Without it each
    // tread ended against the parapet on its own, its lip and the shade under
    // it a dark notch at both ends: a flight of separate slabs. (Cut as the
    // flank is, so it never stands across the other flight's treads or the
    // way off at the crossing.)
    if (string) {
      const LIFT = stepTop(Math.min(to - 1, from + 1)) - stepTop(from) || 2.4;
      const IN = halfW - 0.8, D = 0.3;
      for (const side of [-1, 1]) {
        // One plain band, a hair proud of the flank. (Not with a fillet along
        // its top: that is a second bright line beside the coping, and from the
        // stand the flank reads as three rails running down to the floor.
        // ?wechofix=old:2 is without any string.)
        const parts = [[-LIFT - 1.1, 0.6, D]];
        for (const [lo, hi, depth] of parts) {
          const lim = roof(side * (IN - depth), side * IN, gapOf(side));
          for (const pts of cutTo(rake(hi), rake(lo), lim)) {
            face.add(profileGeo(pts, depth + 0.1, spot(0, side * (IN - (depth - 0.1) / 2)), ang));
          }
        }
      }
    }
    // (`worn` may be a test of the tread, k: a tread with something laid in
    // it — the Echo's rose — is worn some other way, or not at all)
    if (worn) {
      for (let k = from; k < to; k++) {
        if (typeof worn === 'function' && !worn(k)) continue;
        LB.wornStep.add(flatQuad(spot(-span + (k + 0.5) * run, 0), ang, run * 0.72, TREAD_W * 0.55, stepTop(k) + 0.03));
      }
    }

    // ── the arch ring ──
    // Laid out from the springing rather than from the built ends, so the
    // middle bay falls on the crown and can be a keystone — and so a flight
    // sheared off in mid air (the Silence) keeps the coursing of the one that
    // is whole. Each voussoir is one piece right across the flight.
    const slope = (t) => {
      const h = 0.06, a = Math.max(-spring + 1e-4, t - h), b = Math.min(spring - 1e-4, t + h);
      return Math.max(-46, Math.min(46, (soffit(b) - soffit(a)) / (b - a)));
    };
    const normal = (t) => { const d = slope(t), L = Math.hypot(d, 1); return [-d / L, 1 / L]; };
    const ringTop = (t) => pitch(t) - 2.6;
    const t0R = Math.max(-spring, u0), t1R = Math.min(spring, u1);
    const BAYS = light ? 13 : 21;
    // The ring is laid in two thicknesses: a continuous course behind, and the
    // jointed voussoirs on top of it. Without the one behind, every joint is a
    // hole through to the flank — 0.4 wide and the best part of a unit deep,
    // and in this light that is a black slot. Backed, the joint has a lit
    // floor half a unit down and reads as a joint.
    {
      const low = [], high = [];
      for (let n = 0; n <= BAYS * 3; n++) {
        const t = t0R + ((t1R - t0R) * n) / (BAYS * 3), nn = normal(t);
        low.push([t - nn[0] * 0.25, soffit(t) - nn[1] * 0.25]);
        high.push([t, ringTop(t)]);
      }
      across(high, low, FACE + BACK);
    }
    for (let k = 0; k < BAYS; k++) {
      const a0 = -spring + (2 * spring * k) / BAYS, a1 = -spring + (2 * spring * (k + 1)) / BAYS;
      if (a1 <= t0R + 0.2 || a0 >= t1R - 0.2) continue;
      // The joint is a fixed width of ARC, not of span, or the bays close up
      // into one smooth curve again where the arch turns vertical.
      const jt = (t) => Math.min(0.3 / Math.hypot(1, slope(t)), (a1 - a0) * 0.3);
      const b0 = Math.max(t0R, a0 + jt(a0)), b1 = Math.min(t1R, a1 - jt(a1));
      if (b1 - b0 < 0.15) continue;
      const key = Math.abs((a0 + a1) / 2) < spring / BAYS;
      const low = [], high = [];
      for (let n = 0; n <= 4; n++) {
        const t = b0 + ((b1 - b0) * n) / 4, nn = normal(t);
        low.push([t - nn[0] * (key ? 0.9 : 0.55), soffit(t) - nn[1] * (key ? 0.9 : 0.55)]);
        // The keystone is longer than its neighbours at both ends and breaks
        // UP through the string course, which is the one stone in an arch that
        // is allowed to interrupt anything. (Not where the crown is under a
        // floor somebody walks on — the Silence's terrace — or it stands up
        // through the paving as a kerb across the middle of it: `keyThrough`.)
        high.push([t, key ? (keyThrough ? pitch(t) + 0.35 : pitch(t) - 0.45) : ringTop(t)]);
      }
      const out = key ? RING + 0.5 : RING;
      across(high, low, FACE + out);
      // a boss on the keystone, one to a face: the same coin the arcade
      // overhead puts over every one of its own crowns
      if (key) {
        const y = (pitch(0) + soffit(0)) / 2 - 0.6;
        for (const side of [-1, 1]) {
          const q = spot((b0 + b1) / 2, side * (FACE + out));
          LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.15, 1.15, 0.5, 14).rotateX(Math.PI / 2), q, y, -ang * deg));
        }
      }
    }

    // ── the abutments ──
    if (!light) {
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
          const lo = end < 0 ? u0 : spring, hi = end < 0 ? -spring : u1;
          if (hi - lo < 3) continue;
          // the plinth: one course standing out further than any above it
          face.add(boxGeo(spot(lo, side * (FACE + BACK)), spot(hi, side * (FACE + BACK)), 2.2, BACK * 2, FLOOR_Y));
          // Courses of 1.6, not of 2.6: at the feet the abutment is barely
          // three units of stone between the floor and the string, and on a
          // coarser bed not one of them would fit.
          for (let row = 0; row < 8; row++) {
            const y0 = FLOOR_Y + 2.2 + row * 1.95, y1 = y0 + 1.6, step = 3.4;
            for (let m = -1; ; m++) {
              const ua = lo + (row % 2 ? step / 2 : 0) + m * step;
              if (ua >= hi) break;
              let a = Math.max(lo, ua), b = Math.min(hi, ua + step - 0.22);
              // The string rakes and the courses do not, so most stones in a
              // course run out under it partway along. Cut them back to where
              // they still have a course's worth of room, rather than dropping
              // whichever ones straddle the line — dropped, they left the foot
              // of the flight one blank face with a plinth under it; cut, each
              // course ends against the string the way cut stone does.
              while (a < b && ringTop(a) < y0 + 0.85) a += 0.3;
              while (b > a && ringTop(b) < y0 + 0.85) b -= 0.3;
              if (b - a < 1.1) continue;
              const cut = Math.min(y1, ringTop(a), ringTop(b));
              face.add(boxGeo(spot(a, side * (FACE + COURSE / 2)), spot(b, side * (FACE + COURSE / 2)), cut - y0, COURSE, y0));
            }
          }
        }
      }
    }

    // ── the springers ──
    // Without them, where the arch comes down to the floor the ring simply
    // dives into it, and the coursed abutment beside it reads as a different
    // building. A skewback block at each springing, standing out past
    // everything around it, is what the two are jointed by — and it says where
    // the span begins, which from the floor is the one thing about this stair
    // worth knowing.
    for (const side of [-1, 1]) {
      for (const e of [-spring, spring]) {
        if (e < u0 + 1 || e > u1 - 1) continue;
        const d = e < 0 ? -3.2 : 3.2, top = ringTop(e) + 0.9;
        band([[e, top], [e + d, top], [e + d, FLOOR_Y], [e, FLOOR_Y]], FACE, FACE + RING + 0.22, side);
        band([[e - Math.sign(d) * 0.5, top + 1.1], [e + d * 1.16, top + 1.1],
          [e + d * 1.16, top], [e - Math.sign(d) * 0.5, top]], FACE, FACE + RING + 0.62, side);
      }
    }

    // ── the string course, and the coping over the parapet ──
    // The string is two members, not one: a plain band and a corona over it
    // that oversails it, so the moulding throws a shadow instead of being a
    // stripe. It runs just under the deck line, which is where a bridge's does
    // — it is the line that tells the eye where you would be walking.
    for (const side of [-1, 1]) {
      // The string runs straight through the crossing — it is below the deck,
      // on stone that is there whether or not the parapet over it is. (Below
      // the pitch line, that is, which is not below the treads: crossed, it is
      // cut down to them.)
      const g = gapOf(side);
      // `plane` (the Echo): no string. Its corona's shadow would run the length
      // of the flight just under the deck, on top of the arch ring, and cut the
      // bridge in two along it — a balustraded wall standing on an arch.
      // Instead the flank comes out flush with the ring's face from the ring to
      // the coping, so arch and parapet are one face of one stone, broken only
      // by the keystone and the springers. (?wline=old: the string.)
      if (plane) {
        for (const pts of cutTo(parapetTop(side), rake(-2.6), roof(side * FACE, side * (FACE + RING), g))) band(pts, FACE, FACE + RING, side);
      } else {
        for (const [lo, hi, out] of [[-2.45, -1.25, MOULD], [-1.25, -0.45, CORONA]]) {
          for (const pts of cutTo(rake(hi), rake(lo), roof(side * FACE, side * (FACE + out), g))) band(pts, FACE, FACE + out, side);
        }
      }
      // the coping, in as many pieces as the parapet under it has
      for (const [a, b] of g ? [[u0, Math.min(u1, g[0])], [Math.max(u0, g[1]), u1]] : [[u0, u1]]) {
        if (b - a > 2) band(bandPts(1.6, 2.45, a, b), halfW - 0.25, FACE + CORONA, side);
      }
      // a quoin closing the flank at each end it really ends at — and not at
      // one it was sheared off at, where the stone should look broken
      for (const [i, e] of [[0, u0], [1, u1]]) {
        if (!ends[i]) continue;
        const d = i ? -3.4 : 3.4;
        band([[e, deck(e) + 1.6], [e + d, deck(e + d) + 1.6], [e + d, FLOOR_Y], [e, FLOOR_Y]],
          FACE, FACE + CORONA, side);
      }
    }

    // ── the parapet's joints ──
    // The parapet and its coping are cut into blocks a little over a stride
    // long, joint by joint, inside face and out: as one smooth stone the length
    // of the flight, from its foot either is a plain plane along the side of
    // the frame. (Not on the Echo's flanks — `plane` — whose stone has joints
    // of its own; these would be black slits through them, read as cracks.)
    for (const side of plane ? [] : [-1, 1]) {
      const g = gapOf(side);
      for (let u = u0 + 3.6; u < u1 - 1.5; u += 7.2) {
        if (g && u > g[0] - 0.5 && u < g[1] + 0.5) continue;
        const y = deck(u), slot = [[u - 0.09, y - 0.45], [u + 0.09, y - 0.45], [u + 0.09, y + 2.47], [u - 0.09, y + 2.47]];
        LB.joint.add(profileGeo(slot, 0.06, spot(0, side * (halfW - 0.83)), ang));
        LB.joint.add(profileGeo(slot, 0.06, spot(0, side * (FACE + 0.03)), ang));
      }
    }

    // ── the balustrade ──
    // The uprights plumb and the rail following the pitch line: that is what a
    // stair balustrade is, and what a rod on posts stepping with the treads is
    // not. Broken wherever `gap` says the other flight comes in.
    const railY = (u) => pitch(u) + 9;
    const copingTop = (u) => deck(u) + 2.45;
    const Z = FACE - 0.2;
    // (the stone balustrade goes in the flight's own stone: pale, or the
    // Silence's shaded)
    const carve = stone === LB.capShade ? LB.balustradeShade : LB.balustrade;
    const newel = (u, side) => {
      const q = spot(u, side * Z), y = copingTop(u), r = -ang * deg;
      if (!RAIL_OLD) {
        // A pedestal, its cornice at the height of the rail: a raking rail
        // ending at its middle meets the uphill face a third of a unit
        // higher, and dies into the cornice there rather than over it. Let
        // down into the kerb, whose top the coping is set back from on the
        // stair's side.
        carve.add(placed(pedestalGeo(FLIGHT_RAIL.ped, FLIGHT_RAIL.baseH - FLIGHT_RAIL.sink, railY(u) + 0.35 - y, { sunk: 0.9, shift: patchOf(q) }), q, y, r));
        return;
      }
      stone.add(placed(new THREE.BoxGeometry(2.2, 0.9, 2.2), q, y + 0.45, r));
      stone.add(placed(new THREE.BoxGeometry(1.75, 0.45, 1.75), q, y + 1.12, r));
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.72, 0.72, 0.42, 12), q, y + 1.56));
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.44, 0.58, 4.9, 12), q, y + 4.22));
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.78, 0.52, 0.7, 12), q, y + 7.02));
      // a plain turned cap: a ball and spike are the sharpest, brightest thing
      // in the Echo's frame, and pull the eye off the arches
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.62, 0.8, 0.32, 14), q, y + 7.53));
      LB.bronze.add(placed(new THREE.SphereGeometry(0.5, 14, 8).scale(1, 0.62, 1), q, y + 7.75));
    };
    // The balustrade runs from springing to springing — over the WELL, and no
    // further. Past the springing the flight is a low ramp a few feet above a
    // stone floor, where a kerb is all it wants; and it is how a bridge reads
    // anyway, solid parapet on the approaches and balusters over the arch.
    //
    // (A rail carried out to the feet would also be one the walk goes through:
    // a reader gets on and off within a stride of the bookcases, over the
    // parapet.)
    const END = 5.5;
    const R0 = Math.max(u0 + END, -spring + 3), R1 = Math.min(u1 - END, spring - 3);
    for (const side of [-1, 1]) {
      const g = gapOf(side);
      for (const [ra, rb] of g ? [[R0, Math.min(R1, g[0])], [Math.max(R0, g[1]), R1]] : [[R0, R1]]) {
        if (rb - ra < 6) continue;
        // the pitch line kinks over the crown, so the rail is drawn in the
        // pieces it really has rather than one rod through the bend
        const knots = [ra, ...[-crown, crown].filter((u) => u > ra + 0.5 && u < rb - 0.5), rb];
        // (where two flights' balustrades meet at a corner, one newel stands
        // for both: the other flight's, unless `gapNewels`)
        if (gapNewels || !g || ra !== g[1]) newel(ra, side);
        if (gapNewels || !g || rb !== g[0]) newel(rb, side);
        if (!RAIL_OLD) {
          // Stone, from newel to newel: the plinth on the coping, the rail
          // raking with the pitch line. Balusters start clear of the newels
          // at both ends — of the other flight's too, which stands at 60° to
          // this one and so reaches further along it.
          stoneRail(carve, {
            at: (u) => spot(u, side * Z), foot: copingTop, top: (u) => railY(u) + 0.5,
            knots, clear: [1.5, 1.5], ry: () => -ang * deg, S: FLIGHT_RAIL,
          });
          continue;
        }
        for (let i = 1; i < knots.length; i++) {
          const a = spot(knots[i - 1], side * Z), b = spot(knots[i], side * Z);
          LB.bronze.add(rodGeo([a[0], railY(knots[i - 1]), a[1]], [b[0], railY(knots[i]), b[1]], 0.44));
        }
        // Two to a tread. One reads as a fence with its pickets missing; four
        // closes into a bronze band there is no seeing the room through.
        for (let u = ra + run / 2; u < rb - 1.2; u += run / 2) {
          const base = copingTop(u), h = railY(u) - 0.55 - base;
          if (h < 2) continue;
          const q = spot(u, side * Z);
          balusters.push({ p: [q[0], base, q[1]], s: [0.42, h / 6.2, 0.42] });
        }
      }
    }

    // ── the corners ──
    // Where two flights' balustrades meet, each parapet and coping ends square
    // under the newel they share, and on the side a reader stands the corner
    // between the two ends would be left open: a bite out of the wall the
    // height of the kerb, three units deep at the sharp corners. Filled to
    // where the two inner faces meet, they meet in one mitre. (One flight lays
    // them, with the newels.)
    if (cross && gapNewels) {
      const oa = dir(cross.ang), on = dir(cross.ang + 90);
      // where p + s·d crosses q + r·e
      const meet = (p, d, q, e) => add(p, d, ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0]));
      for (const side of [-1, 1]) {
        for (const uQ of gapOf(side)) {
          // the newel's point, and which of its own flanks the other flight
          // brings to it
          const Q = spot(uQ, side * Z), dq = [Q[0] - cross.c[0], Q[1] - cross.c[1]];
          const t = Math.sign(dq[0] * on[0] + dq[1] * on[1]), uo = dq[0] * oa[0] + dq[1] * oa[1];
          const y = deck(uQ);
          for (const [zin, y0, y1] of [[halfW - 0.8, ringTop(uQ), y + HIGH], [halfW - 0.25, y + 1.6, y + 2.45]]) {
            const a = spot(uQ, side * zin), b = add(add(cross.c, oa, uo), on, t * zin);
            face.add(slabGeo([a, meet(a, ax, b, oa), b, Q], [], y1 - y0, y0));
          }
        }
      }
    }
  };

  // The stone of a gallery's walls: the ring between the room and the edge of
  // its cell, as the six trapezoids it really is — one to an edge, split where
  // a doorway opens — and not one slab with a room-shaped hole in it.
  //
  // A doorway cannot be a hole. A hole has to stop short of the outline it is
  // cut in, and what this one stopped short by — 0.05 of stone, half a
  // centimetre at a reader's scale — stood across every hallway, its full width
  // and its full height. That sliver is what the corridor visibly ended in, and
  // what the walk went through.
  //
  // `gaps(k)`: the doorways in edge k, as spans measured along the edge from
  // its middle. Where a span runs to the end of the edge the piece keeps the
  // cell's mitred corner; where a doorway cuts it, the piece ends square, and
  // that square end is the jamb of the doorway.
  const wallRing = (c, rIn, rOut, gaps) => {
    const pieces = [];
    for (let k = 0; k < 6; k++) {
      const n = dir(60 * k + 30), t = dir(60 * k + 120);
      const inner = (u) => add(add(c, n, (rIn * Math.sqrt(3)) / 2), t, u);
      const outer = (u) => add(add(c, n, (rOut * Math.sqrt(3)) / 2), t, u);
      const run = (a, b) => {
        if (b - a < 0.5) return;
        pieces.push([inner(a), inner(b),
          outer(b === rIn / 2 ? rOut / 2 : b), outer(a === -rIn / 2 ? -rOut / 2 : a)]);
      };
      let u = -rIn / 2;
      for (const [a, b] of gaps(k).sort((p, q) => p[0] - q[0])) { run(u, a); u = b; }
      run(u, rIn / 2);
    }
    return pieces;
  };

  // the pier glasses either side of each gallery's way out (mirror.js)
  const mirrors = makeMirrors({ root, keep, light });
  const P = { project: true };
  const G = { project: WOOD_OLD || 'grain' };
  const LB = {
    mass: new Batch(M.mass, P), cap: new Batch(M.cap, P), capShade: new Batch(M.capShade, P), floor: new Batch(M.floor, { cast: false, ...P }),
    // the bridges' stone balustrades: carved stone, never a stair (their uv
    // is their own: along each moulding, round each baluster)
    balustrade: new Batch(M.carve), balustradeShade: new Batch(M.carveShade),
    shelf: new Batch(M.shelf, G), shelfLip: new Batch(M.shelfLip), shelfBack: new Batch(M.shelfBack, { cast: false, ...G }),
    bronze: new Batch(M.bronze), bronzeDim: new Batch(M.bronzeDim), inlay: new Batch(M.inlay, { cast: false }), fillet: new Batch(M.fillet, { cast: false }),
    liner: new Batch(M.liner, { cast: false }), stars: new Batch(M.stars, { cast: false, receive: false }),
    step: new Batch(M.step, P), mirror: new Batch(M.mirror, { cast: false }), stone: new Batch(M.stone, P),
    frame: new Batch(M.frame), gilt: new Batch(M.gilt, { cast: false }), giltDeep: new Batch(M.giltDeep, { cast: false }), iron: new Batch(M.iron, { cast: false }), rail: new Batch(M.wallTop, P),
    shafts: new Batch(shaftMaterial, { cast: false, receive: false }),
    frieze: new Batch(M.frieze, P), plate: new Batch(M.plate), letters: new Batch(M.letters, { cast: false }), scallop: new Batch(M.scallop, { cast: false }),
    railGlow: new Batch(M.railGlow, { cast: false, receive: false }), floorBand: new Batch(M.floorBand, { cast: false, ...P }),
    bronzeWorn: new Batch(M.bronzeWorn), oak: new Batch(M.oak, G), shade: new Batch(M.shade, { cast: false }),
    shadeDead: new Batch(M.shadeDead), paper: new Batch(M.paper), wax: new Batch(M.wax), leather: new Batch(M.leather), tuft: new Batch(M.tuft, { cast: false }),
    shelfWorn: new Batch(M.shelfWorn, { cast: false, ...G }), dust: new Batch(M.dust, { cast: false }),
    contact: new Batch(M.contact, { cast: false, receive: false }), riserShade: new Batch(M.riserShade, { cast: false, receive: false }), joint: new Batch(M.joint, { cast: false }), deadShards: new Batch(M.deadShards, { cast: false }),
    wornFloor: new Batch(M.wornFloor, { cast: false }), wornStep: new Batch(M.wornStep, { cast: false }),
    dustFan: new Batch(M.dustFan, { cast: false }), moonStone: new Batch(M.moonStone, P),
    // the Door's fallen blocks (felt, as they always were) and the stones
    // round them (not: body.js, UNFELT)
    rubbleBlocks: new Batch(M.rubble, P), rubbleBig: new Batch(M.rubble, P),
    // (the smallest cast no shadow worth the drawing: a moon shadow's texel is
    // three-quarters of a unit)
    rubble: new Batch(M.rubble, { cast: false, ...P }),
    carve: new Batch(M.carve), dressed: new Batch(M.dressed, P), marble: new Batch(M.marble),
    // the Door's portal, in the same stones, its reveals and soffits darkened
    // in the shader (doorFix.js, 3)
    portalCarve: new Batch(doorOld(3) ? M.carve : keep(revealShade(stoneShade(M.carve.clone()), PORTAL_FRAME, PORTAL, 'carve'))),
    portalDressed: new Batch(doorOld(3) ? M.dressed : keep(revealShade(stoneShade(M.dressed.clone(), { weather: true }), PORTAL_FRAME, PORTAL, 'dressed')), P),
    // The Echo's flights' flanks, in the stone the flights themselves are cut
    // from (their steps and the arch under them): one stone, its joints running
    // every way, so no single course runs level across both flights. Its own
    // batch, because body.js reads `step` as a stair and a flank is not one.
    // (Not the carving's jointless limestone: on a face this big its soft
    // mottle reads as glossed plaster.)
    flank: new Batch(M.step, P),
    // (the Echo's: echoFix.js, 2 and 6)
    nosing: new Batch(M.nosing, P), riserSoft: new Batch(M.riserSoft, { cast: false, receive: false }), drum: new Batch(M.drum, P),
    column: new Batch(M.column), columnBox: new Batch(M.column, P),
    bookRows: new Batch(M.bookRows, { cast: false }), bookRowsLit: new Batch(M.bookRowsLit, { cast: false }),
  };
  const fallenLeaves = [], doorIvy = [], doorRubble = [], petals = [], hangs = [];
  // the Door's ivy and the pergola's wisteria leaves, and both their wood (ivy.js)
  const ivyLeaves = [], vineLeaves = [], ivyWood = new Wood(7);
  const IVY_GREEN = ['#26401f', '#2d4a24', '#34522a', '#2a4422', '#3a5a2c', '#22381c', '#304d26'];
  const IVY_YOUNG = ['#5a7a34', '#66863a', '#4f6e2e'];
  const posts = [], links = [], balusters = [];
  // (`shelved`: the books standing on the galleries' shelves, at their real
  // size — drawn a wall to a mesh, and not felt by the walking body, which
  // the shelves' boards keep off them: see body.js)
  const shelved = [];
  const shelvedWalls = { n: 0 };
  // and each wall's books painted as well (bookRows), drawn instead of its
  // boxes when no eye is near it: `lodRows` holds the strips for a wall,
  // `wallRoom` the gallery it is in (see `lodGroups`)
  const lodRows = new Map(), wallRoom = new Map();
  const lodFor = (wall, room) => {
    if (!lodRows.has(wall)) { lodRows.set(wall, []); wallRoom.set(wall, room); }
    const list = lodRows.get(wall);
    return { add: (g) => list.push(g) };
  };
  const books = [], lampCores = [], lampShells = [], globes = [], deadGlobes = [], rubble = [], dust = [];
  // (the lamp pass, lampPass.js: the stair sconces' panes in the globes' glass,
  // paper lanterns, candle flames and the wax under them)
  const trialPanes = [], trialPaper = [], trialEaves = [], trialFlames = [], trialWax = [];
  // Declared up here because the Library uses it too (the Echo's sconces), not
  // only the garden's lanterns.
  const glows = [];
  // (the Door's candelabra's lights, which breathe with their flames: doorProps.js, 4)
  const candleLights = [];
  // Lights the pond may see that are not glows: a flame behind paper is drawn
  // as the paper (see the stone lanterns), but the water still wants a lamp.
  const waterLamps = [];
  // Old leather, not a paint chart (see textures.js): the gold on the spines is
  // what should catch the eye, not the bindings.
  const BOOKS = ['#4a3a2c', '#3e2f26', '#35382e', '#4f4130', '#383d40', '#4c392b', '#56372c', '#2f3830', '#3a3346', '#5e4b36', '#6b5a44', '#402a26', '#2e3a3c'];
  return { flightDress, wallRing, mirrors, P, G, LB, fallenLeaves, doorIvy, doorRubble, petals,
    hangs, ivyLeaves, vineLeaves, ivyWood, IVY_GREEN, IVY_YOUNG, posts, links, balusters, shelved,
    shelvedWalls, lodRows, wallRoom, lodFor, books, lampCores, lampShells, globes, deadGlobes,
    rubble, dust, trialPanes, trialPaper, trialEaves, trialFlames, trialWax, glows, candleLights,
    waterLamps, BOOKS };
}
