// VI and VII — the Fork and the Pavilion (buildWorld.js, assembleWorld): the
// pond, its shore and bridges, the pavilion.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PAVILION_BRIDGE_HALF_WIDTH } from '../pavilionBridge';
import { LAMPS } from '../lampPass';
import { makeRng } from '../textures';
import { WATER_Y } from '../water';
import { makeKoi } from '../pond';
import { forkOld, WAYMARK } from '../forkFix';
import { pavOld, bracketSet, BRACKET, lotusBud } from '../pavilionFix';
import { LAWN, propsOld, ROOF_KIND } from '../forkProps';
import { pavPropsOld, wornBar, wornPost, CAIHUA, qin, qinCloth } from '../pavilionProps';
import { ROOF_TIERS, roofProfile, roofTop, ROOF_SURFACE, roofTiles, tiledRoof, roofFar } from '../pavilionRoof';
import { garden5Old, signPostGeometry, paintSignName, SIGN, signBoardGeometry, HORN } from '../gardenFix5';
import { bridgeFoot } from '../shore';
import { FORK_OLD, deg, SHORE_OLD } from '../build/common';

export function buildFork(ctx) {
  const { paintings, light, rnd, rr, pick, dir, add, lerp2, unit2, dist, circlePts, rot3, keep,
    paint, tex, lampHaloTex, water, wind, Std, skyDull, signLamp, M, root, slabGeo, boxGeo, placed,
    profileGeo, rodGeo, flatPlane, decal, halo, POOL_DIAL, point, trialEaves, glows, waterLamps,
    mounts, GB, rocks, lilies, blooms, J, POND, PV, SHORE, BRIDGE, BRIDGE_STAND, MAZE_ENTRY, POOLS,
    segDist, NORTH_BRIDGE, NORTH_OPEN, standing, lawnLamps, onNorthBridge, tsuriDoro } = ctx;
  // VI — the Fork: where the road divides, a stone waymark with a board for each
  // way (with `paintings`, a painted screen facing the pergola).
  if (!paintings) {
    // The waymark stands dead centre of the Fork's view; bare, a post with two
    // boards, it is the palest thing in the garden. It carries the lantern — a
    // fork in a path at night is somewhere someone hung a light.
    //
    // And it says something: a post that tapers, a moulded cap and a knob on
    // its roof; and boards shaped to point, with the ways cut into them and
    // gilded — THE PAVILION, and under it THE HEART, which is beyond it — and
    // one board newer and paler than the rest, pointing down the road not
    // taken, with nothing written on it. (Since the road not taken goes to the
    // Heart, THE HEART points down it, toward the maze's mouth, and there is no
    // third way to leave blank: ?wfork=old for the three boards.)
    //
    // (forkFix.js, 3: a slim post of weathered timber, standing back in the
    // lawn between the ways, the names facing out — not the biggest and palest
    // thing in the Fork's frame, dead ahead.)
    const slim = !forkOld(3);
    // (gardenFix5.js, 3: turned, in the pergola's timber, under an onion cap;
    // its boards weathered, housed through it, their names cut in)
    const turned = slim && !garden5Old(3);
    const at = slim ? add(J, dir(WAYMARK.bearing), WAYMARK.dist) : add(J, dir(279), 30);
    standing.push({ p: at, r: slim ? 2.6 : 4 });
    if (turned) {
      GB.stone.add(placed(new THREE.CylinderGeometry(1.75, 2.05, 1.6, 8), at, 4.3, (WAYMARK.bearing + 45) * deg));
      GB.signPost.add(placed(signPostGeometry(WAYMARK.boards), at, 0));
    } else if (slim) {
      const { r0, r1, top } = WAYMARK.post, turn = (WAYMARK.bearing + 45) * deg;
      // a dressed footing, mostly in the ground, and the post in it
      GB.stone.add(placed(new THREE.CylinderGeometry(1.75, 2.05, 1.6, 8), at, 4.3, turn));
      GB.forkPost.add(placed(new THREE.CylinderGeometry(r1, r0, top - 4, 4).rotateY(Math.PI / 4), at, (top + 4) / 2, turn));
      // a board cap and a low hipped top
      GB.forkPost.add(placed(new THREE.BoxGeometry(r1 * 2.3, 0.32, r1 * 2.3), at, top + 0.16, turn));
      GB.forkPost.add(placed(new THREE.ConeGeometry(r1 * 1.7, 1.1, 4), at, top + 0.32 + 0.55, turn + Math.PI / 4));
    } else {
      GB.stone.add(placed(new THREE.BoxGeometry(5.6, 3.2, 5.6), at, 4, 12 * deg));
      GB.stone.add(placed(new THREE.BoxGeometry(4.6, 1.6, 4.6), at, 6.4, 12 * deg));
      GB.stone.add(placed(new THREE.CylinderGeometry(2.05, 2.62, 22, 4).rotateY(Math.PI / 4), at, 4 + 11, 12 * deg));
      GB.stone.add(placed(new THREE.BoxGeometry(3.4, 0.5, 3.4), at, 23.9, 12 * deg));
      GB.stone.add(placed(new THREE.BoxGeometry(4.2, 0.55, 4.2), at, 24.45, 12 * deg));
      GB.stone.add(placed(new THREE.BoxGeometry(4.8, 1.2, 4.8), at, 25.3, 12 * deg));
      GB.stone.add(placed(new THREE.ConeGeometry(3.3, 3.0, 4), at, 27.4, 57 * deg));
      GB.stone.add(placed(new THREE.SphereGeometry(0.75, 12, 8), at, 29.2));
    }
    const nameTex = (text) => tex(paint(1024, 160, (g, w, h) => {
      if (turned) { paintSignName(g, w, h, text); return; }
      g.clearRect(0, 0, w, h);
      g.font = '600 104px Georgia, "Times New Roman", serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.letterSpacing = '14px';
      // cut into the wood (see giltLetters): a dark bed under each stroke, the
      // gold lighter along its top
      g.fillStyle = 'rgba(18,10,5,0.9)';
      g.fillText(text, w / 2 + 3, h / 2 + 4);
      const gold = g.createLinearGradient(0, h * 0.2, 0, h * 0.8);
      gold.addColorStop(0, '#f0d08a');
      gold.addColorStop(0.55, '#c9a05a');
      gold.addColorStop(1, '#8a6632');
      g.fillStyle = gold;
      g.fillText(text, w / 2, h / 2);
    }));
    const boards = FORK_OLD
      ? [[[1216, 218], 20.5, 'THE PAVILION', 1], [[1216, 218], 17.9, 'THE HEART', 0.84], [[1120, 160], 16.5, null, 1]]
      // (the Pavilion's from the slim post: at the bridge's foot — [1216, 218]
      // is the way's bend, behind it from there)
      : [[slim ? SHORE : [1216, 218], slim ? WAYMARK.boards[0] : 20.5, 'THE PAVILION', 1], [MAZE_ENTRY, slim ? WAYMARK.boards[1] : 17.9, 'THE HEART', 0.84]];
    // (out from the post's face: the slim post is a third as wide)
    const b0 = slim ? 0.45 : 1.6;
    boards.forEach(([to, y, name, len]) => {
      const a = Math.atan2(to[1] - at[1], to[0] - at[0]) / deg, L = (turned ? SIGN.len : slim ? 8.8 : 10.2) * len;
      const board = [[b0, y - 1.1], [b0 + L, y - 1.1], [b0 + 1.3 + L, y], [b0 + L, y + 1.1], [b0, y + 1.1]];
      if (turned) GB.signBoard.add(signBoardGeometry(L, y).rotateY(-a * deg).translate(at[0], 0, at[1]));
      else (name ? GB.wood : GB.newWood).add(profileGeo(board, 0.55, at, a));
      if (!name) return;
      const mat = keep(new THREE.MeshStandardMaterial({
        map: nameTex(name), transparent: true, alphaTest: 0.25, roughness: 0.42, metalness: 0.55,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }));
      const t = dir(a), n = [-t[1], t[0]];
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(keep(new THREE.PlaneGeometry(turned ? (L - 1.2) * 0.94 : L * 0.86, 1.55)), mat);
        const q = turned ? add(add(at, t, 1.15 + (L - 1.2) / 2), n, side * (SIGN.thick / 2 + 0.02)) : add(add(at, t, b0 + L / 2), n, side * 0.3);
        plate.position.set(q[0], y, q[1]);
        // (each plate faces OUT of its side of the board: turned the other way,
        // with ?wforkfix=old:3, both face into the wood and neither side of a
        // board shows its name)
        plate.rotation.y = (side > 0) === slim ? -a * deg : -a * deg + Math.PI;
        plate.name = 'waymark-name';
        root.add(plate);
      }
    });
    // An iron bracket off the post, braced, and hung from it a tsuri-dōrō: a
    // six-sided iron lantern, a lattice round paper, under a roof of its own.
    const arm = dir(slim ? WAYMARK.arm : 196), a0 = slim ? 0.5 : 1.6;
    GB.iron.add(boxGeo(add(at, arm, a0), add(at, arm, a0 + 6.4), 0.5, 0.5, 24.4));
    {
      const a = add(at, arm, a0 + 0.3), b = add(at, arm, a0 + 3.8);
      GB.iron.add(rodGeo([a[0], 20.6, a[1]], [b[0], 24.5, b[1]], 0.16));
    }
    {
      const lp = add(at, arm, a0 + 6);
      tsuriDoro(lp, Math.atan2(arm[0], arm[1]));
      waterLamps.push({ p: [lp[0], 20.6, lp[1]], color: '#ffc077', k: 1.1 });
      lawnLamps.push({ p: lp, y: 20.6, ...LAWN.waymark });
      signLamp.value.set(lp[0], 20.6, lp[1], SIGN.lamp);
      halo(lp, 20.6, 16, '#ffbc70', 0.14, lampHaloTex);
      // (not 900: that blows the post beside it out to white)
      point(lp, 20.4, '#ffb866', 180, 4);
      decal(lp, 62, 62, '#ffb462', 0.11 * POOL_DIAL, 5.3, 0.12);
    }
  } else {
    const at = add(J, dir(279), 30), facing = dir(151);
    const width = 58, height = width / (3376 / 1440);
    const angle = Math.atan2(facing[0], facing[1]);
    const side = dir(151 + 90);
    for (const s of [-1, 1]) GB.wood.add(placed(new THREE.CylinderGeometry(1.6, 1.8, height + 16, 6), add(at, side, s * (width / 2 + 2)), (height + 16) / 2 + 4));
    const panel = new THREE.BoxGeometry(width + 4, height + 4, 2);
    panel.rotateY(angle);
    panel.translate(at[0], 12 + height / 2, at[1]);
    GB.lacquer.add(panel);
    const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
    const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
    const front = add(at, facing, 1.1);
    plane.position.set(front[0], 12 + height / 2, front[1]);
    plane.rotation.y = angle;
    root.add(plane);
    mounts[5] = { center: [front[0], 12 + height / 2, front[1]], normal: facing, width, height, material: mat };
  }

  // pools of stars in the garden: the pond, and two small ones with stone rims
  const teal = [];
  // (the pond's outline, kept for its bank: shore.js, below)
  let pondEdge = null;
  {
    const { c, rx, rz } = POND;
    const edge = Array.from({ length: 110 }, (_, k) => {
      const a = (k / 110) * Math.PI * 2;
      const wob = 1 + Math.sin(a * 3 + 1) * 0.04 + Math.sin(a * 7) * 0.02;
      return [c[0] + Math.cos(a) * rx * wob, c[1] + Math.sin(a) * rz * wob];
    });
    pondEdge = edge;
    const pond = water.surface(new THREE.Mesh(keep(slabGeo(edge, [], 0.3, WATER_Y - 0.3)), keep(water.material(POND))));
    pond.name = 'water';
    pond.receiveShadow = true;
    pond.renderOrder = 2;
    root.add(pond);
    edge.forEach((p, k) => {
      if (k % 2) return;
      rocks.push({ p: [p[0] + rr(-2, 2), 6, p[1] + rr(-2, 2)], rot: rot3(), s: [rr(3.5, 7.5), rr(2.5, 4.5), rr(3.5, 7.5)], color: pick(['#5e5952', '#504c46', '#68635b', '#46423d']), bank: k / 2 });
    });
    const inPond = (p, m = 1) => ((p[0] - c[0]) / (rx * m)) ** 2 + ((p[1] - c[1]) / (rz * m)) ** 2 < 1;
    const nearBridge = (p) => BRIDGE.slice(1).some((b, i) => segDist(p, BRIDGE[i], b) < 13);
    // The Pavilion, the mist and the maze are laid out from what the pads,
    // flowers and fish once left of the world's stream. Those have a stream of
    // their own; this spends the world's exactly as they did, so the maze stays
    // the maze it is.
    {
      let pads = 0;
      for (let s = 0; s < 300 && pads < 20; s++) {
        const p = [c[0] + rr(-rx, rx), c[1] + rr(-rz, rz)];
        if (!inPond(p, 0.9) || inPond(p, 0.55) || dist(p, PV) < 48 || nearBridge(p)) continue;
        pads++;
        for (let k = 0; k < 3; k++) rnd();
        if (rnd() < 0.4) for (let k = 0; k < 6; k++) rnd();
      }
      let fish = 0;
      for (let s = 0; s < 300 && fish < 7; s++) {
        const p = [c[0] + rr(-rx, rx), c[1] + rr(-rz, rz)];
        if (!inPond(p, 0.8) || dist(p, PV) < 46 || nearBridge(p)) continue;
        fish++;
        rnd();
      }
    }
    // Lilies grow in colonies off one rhizome — a clump of big leaves with
    // young ones between them, a flower or two among them, a bud coming up —
    // never as an even scatter. A leaf is 17 to 60 cm across (a unit is 9.4 cm)
    // and lies ON the water, just clear of where the koi are drawn (pond.js).
    const lr = makeRng(7331), lrr = (a, b) => a + (b - a) * lr();
    const leaves = [];
    const colony = (at, spread, count, inside, flowers) => {
      let placed = 0;
      for (let s = 0; s < count * 40 && placed < count; s++) {
        const a = lrr(0, Math.PI * 2), d = spread * Math.sqrt(lr());
        const p = [at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d];
        const young = lr() < 0.3;
        const r = young ? lrr(0.9, 1.6) : lrr(1.8, 3.2);
        // crowded, but a leaf never lies across another
        if (!inside(p, r) || leaves.some((q) => dist(p, q.p) < (r + q.r) * 0.92)) continue;
        leaves.push({ p, r });
        const kind = young ? 0 : lr() < 0.22 ? 3 : lr() < 0.45 ? 2 : 1;
        lilies[kind].push({
          p: [p[0], WATER_Y + 0.12 + (placed % 4) * 0.025, p[1]], rot: [0, lrr(0, Math.PI * 2), 0], s: [r, r, r],
          color: ['#ffffff', '#eef2e2', '#e3e9d2', '#f5efdd'][Math.floor(lr() * 4)],
        });
        placed++;
      }
      const scheme = lr() < 0.5 ? 'white' : 'pink';
      for (let k = 0, s = 0; k < flowers && s < 40; s++) {
        const a = lrr(0, Math.PI * 2), d = spread * 0.75 * Math.sqrt(lr());
        const p = [at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d];
        if (!inside(p, 1.6)) continue;
        k++;
        if (lr() < 0.35) {
          const b = lrr(1.0, 1.4);
          blooms[`${scheme}Bud`].push({ p: [p[0], WATER_Y + 0.05, p[1]], rot: [lrr(-0.25, 0.25), lrr(0, Math.PI * 2), lrr(-0.25, 0.25)], s: [b, b, b] });
        } else {
          const b = lrr(1.1, 1.5);
          blooms[scheme].push({ p: [p[0], WATER_Y + 0.26, p[1]], rot: [lrr(-0.07, 0.07), lrr(0, Math.PI * 2), lrr(-0.07, 0.07)], s: [b, b, b], color: ['#ffffff', '#f1ede6'][Math.floor(lr() * 2)] });
        }
      }
    };
    const inOpen = (p, r) => inPond(p, 0.9) && dist(p, PV) > 50 + r && !nearBridge(p) && !onNorthBridge(p);
    const colonies = [];
    for (let s = 0; s < 400 && colonies.length < 8; s++) {
      const at = [c[0] + lrr(-rx, rx), c[1] + lrr(-rz, rz)];
      if (!inPond(at, 0.84) || inPond(at, 0.5) || dist(at, PV) < 58 || nearBridge(at) || onNorthBridge(at, 8) || colonies.some((q) => dist(at, q) < 34)) continue;
      colonies.push(at);
      colony(at, lrr(7, 13), Math.floor(lrr(7, 14)), inOpen, Math.floor(lrr(1, 3.99)));
    }
    // The fish, on loops round the Pavilion and in patches of their own.
    const school = makeKoi({ pond: POND, time: wind, gather: BRIDGE_STAND, clear: (p) => inPond(p, 0.84) && dist(p, PV) > 52 });
    keep(school.geometry);
    keep(school.material);
    root.add(water.surface(school.mesh));
    for (const pool of POOLS) {
      // a small clump in each rimmed pool, off to one side of it
      const side = lrr(0, Math.PI * 2);
      colony([pool.c[0] + Math.cos(side) * pool.r * 0.4, pool.c[1] + Math.sin(side) * pool.r * 0.4], pool.r * 0.4, 5,
        (p, r) => dist(p, pool.c) < pool.r - r - 1.5, 1);
    }
    for (const pool of POOLS) {
      GB.stone.add(slabGeo(circlePts(pool.c, pool.r + 5, 40), [circlePts(pool.c, pool.r, 40)], 9, 0));
      // In the same surface as the pond, to the unit: one plane, one mirror.
      const w = water.surface(new THREE.Mesh(keep(slabGeo(circlePts(pool.c, pool.r, 40), [], 0.3, WATER_Y - 0.3)), keep(water.material({ c: pool.c, rx: pool.r, rz: pool.r }))));
      w.name = 'water';
      w.renderOrder = 2;
      root.add(w);
      teal.push(pool);
    }

    // ── VII — the Pavilion ────────────────────────────────────────────────
    // An octagon standing in the water. All of it is laid out from two numbers
    // — the angle of a bay and a radius — so the parts agree with each other
    // instead of each being placed by hand: the hips of both roofs run down the
    // column lines, the bracket sets stand over the columns and over the middle
    // of every bay, the rafters land on the purlins they cross, and the gap in
    // the balustrade is the bay the bridge actually arrives at.
    const DECK = 12, HEAD = 46, R_COL = 26;
    // (pavilionProps.js, 13: gilt on every column, under every lantern and on
    // the table's lamp, with the finial, is a casino's. The small fittings are
    // bronze; the one bright gold thing here is the finial.)
    const FITTING = pavPropsOld(13) ? GB.gold : GB.pavBronze;
    const RAIL_WORN = !pavPropsOld(10);
    const bay = (k) => 22.5 + k * 45;
    const on = (a, r) => add(PV, dir(a), r);
    // A piece in a bay's own frame: +x runs out from the middle of the
    // pavilion, +z along the eave, and `out` is measured from the column line.
    // (rotateY carries +x to (cos, −sin), so the angle it wants is the negative
    // of the one everything else here is written in.)
    const inBay = (a, out, along, y, w, h, d) => placed(
      new THREE.BoxGeometry(w, h, d), add(on(a, R_COL + out), dir(a + 90), along), y, -a * deg,
    );
    // Both tiers of roof are lathes turned from one curve — flat at the eave,
    // lifting to the ridge — and `soffit` IS that curve. Everything that has to
    // fit under the roof asks it where the roof is rather than guessing.
    // (forkProps.js, 2: with ?wprops=old:2 that curve is a dome's — level at
    // the top, steepest at the eave — and the roof it makes is a
    // conservatory's. The roof is tiled, pavilionRoof.js, on a hollow curve
    // with its corners swept up, and `soffit` asks that roof where it is: `a`,
    // the bearing, because a facet between two hips is lower at its middle than
    // a lathe's ring.)
    const ROOF_OLD = propsOld(2);
    const TIERS = ROOF_OLD ? [{ r: 52, h: 17, y: 44 }, { r: 29, h: 15, y: 58 }]
      : ROOF_TIERS.map((t) => ({ ...t, h: roofProfile(t, 0) - t.y }));
    const soffit = (t, r, a = 22.5) => (ROOF_OLD ? t.y + t.h * (1 - Math.min(1, Math.max(0, r) / t.r) ** 2.4) : roofTop(t, a, Math.max(0, r)));
    // and the way OUT of that surface at radius r, for laying a ridge along it
    const outward = (t, r) => {
      const y0 = soffit(t, r - 0.4), y1 = soffit(t, r + 0.4);
      const L = Math.hypot(0.8, y1 - y0) || 1;
      return [(y0 - y1) / L, 0.8 / L];
    };

    // ── The deck ──────────────────────────────────────────────────────────
    // A stone foot standing in the water, boards over it, and a moulded lip
    // between the two: a slab with one straight edge reads as a table top.
    GB.stone.add(placed(new THREE.CylinderGeometry(33.4, 35.2, 7.2, 8), PV, 5.4, 22.5 * deg));
    GB.wood.add(placed(new THREE.CylinderGeometry(31, 33, 6, 8), PV, 9, 22.5 * deg));
    GB.lacquer.add(placed(new THREE.CylinderGeometry(33.4, 32.1, 1.4, 8), PV, 11.4, 22.5 * deg));

    // ── Columns, balustrade, and the seat along it ────────────────────────
    // The bay the bridge lands in is left open — worked out from where the
    // bridge actually ends rather than written down.
    const arrivalOf = (BR) => {
      const end = BR[BR.length - 1];
      return Math.floor((((Math.atan2(end[1] - PV[1], end[0] - PV[0]) / deg) + 337.5 + 360) % 360) / 45);
    };
    // Both bridges need an open bay, whichever paths leave the Fork.
    const arrivals = [arrivalOf(BRIDGE), ...(NORTH_OPEN ? [arrivalOf(NORTH_BRIDGE)] : [])];
    for (let k = 0; k < 8; k++) {
      const a0 = bay(k), a1 = bay(k + 1), p = on(a0, R_COL);
      // a stone plinth, a shaft tapered the way a timber one is, a gilt collar
      GB.stone.add(placed(new THREE.CylinderGeometry(2.9, 3.5, 2.6, 8), p, DECK + 1.3));
      GB.lacquer.add(placed(new THREE.CylinderGeometry(1.45, 1.9, HEAD - DECK - 2.6, 12), p, (DECK + 2.6 + HEAD) / 2));
      if (pavPropsOld(13)) GB.gold.add(placed(new THREE.CylinderGeometry(1.8, 1.8, 0.45, 12), p, HEAD - 4.4));
      else {
        // (a dark gilt band between two beads, closer on the shaft)
        GB.pavGilt.add(placed(new THREE.CylinderGeometry(1.66, 1.68, 0.5, 16), p, HEAD - 4.4));
        for (const dy of [0.33, -0.33]) GB.pavGilt.add(placed(new THREE.CylinderGeometry(1.74, 1.74, 0.14, 16), p, HEAD - 4.4 + dy));
      }

      if (arrivals.includes(k)) continue;
      const c0 = on(a0, 30), c1 = on(a1, 30);
      if (RAIL_WORN) {
        // (pavilionProps.js, 10: the same members, worn)
        const span = dist(c0, c1);
        GB.railWorn.add(wornBar(c0, c1, DECK + 0.5, 1.1, 2.1, { rub: 0.3, joints: Array.from({ length: 9 }, (_, i) => (span * i) / 8) }));
        GB.railWorn.add(wornBar(c0, c1, 16.4, 1.5, 3.2, { rub: 1, ease: 0.34, joints: [0, span] }));
        for (let i = 1; i < 8; i++) GB.railWorn.add(wornPost(lerp2(c0, c1, i / 8), 13.5, 0.75, 3.0, -a0 * deg));
      } else {
        GB.lacquer.add(boxGeo(c0, c1, 1.1, 2.1, DECK + 0.5));                 // bottom rail
        GB.lacquer.add(boxGeo(c0, c1, 1.5, 3.2, 16.4));                       // handrail
        for (let i = 1; i < 8; i++) {                                         // balusters
          GB.lacquer.add(placed(new THREE.BoxGeometry(0.75, 3.0, 0.75), lerp2(c0, c1, i / 8), 15.0, -a0 * deg));
        }
      }
      // the seat that makes a pavilion somewhere to sit and not only to pass
      // through — a board inside the rail, on stubby brackets, stopping short
      // of the columns the way a bench between two posts has to
      const b0 = on(a0, 28.5), b1 = on(a1, 28.5);
      const s0 = lerp2(b0, b1, 0.13), s1 = lerp2(b0, b1, 0.87);
      GB.wood.add(boxGeo(s0, s1, 0.9, 5.4, 15.2));
      for (const t of [0.15, 0.5, 0.85]) {
        GB.wood.add(placed(new THREE.BoxGeometry(2.2, 2.6, 1.1), lerp2(s0, s1, t), 13.9, -((a0 + a1) / 2) * deg));
      }
    }
    // a low threshold board where each bridge comes aboard
    for (const arrival of arrivals) {
      // Same board, in a separate collision class: it is the next tread of
      // the landing, rather than a plank obstacle the leading foot refuses.
      (paintings ? GB.plank : GB.pavilionThreshold).add(placed(new THREE.BoxGeometry(4, 1.2, 15), on(bay(arrival) + 22.5, 29.5), 12.4, -(bay(arrival) + 22.5) * deg));
    }

    // ── The head of each bay: architrave, tie beam, openwork ──────────────
    for (let k = 0; k < 8; k++) {
      const a0 = bay(k), a1 = bay(k + 1), mid = (a0 + a1) / 2;
      const c0 = on(a0, R_COL), c1 = on(a1, R_COL);
      GB.lacquer.add(boxGeo(c0, c1, 3.0, 2.3, HEAD - 3.0));                 // the beam the brackets stand on
      GB.wood.add(boxGeo(c0, c1, 1.5, 1.9, HEAD - 9.2));                    // the tie under it
      // and hanging between the two, the openwork a pavilion of this kind
      // always carries: a comb of turned bars, a rail across them, and a brace
      // into each column, so that the top of a bay is not a rectangle of air.
      for (let i = 1; i < 9; i++) {
        GB.wood.add(placed(new THREE.BoxGeometry(0.6, 4.6, 0.6), lerp2(c0, c1, i / 9), HEAD - 5.5, -mid * deg));
      }
      GB.wood.add(boxGeo(c0, c1, 0.55, 0.55, HEAD - 5.2));
      for (const [from, to] of [[0.02, 0.16], [0.98, 0.84]]) {
        const f = lerp2(c0, c1, from), t = lerp2(c0, c1, to);
        GB.wood.add(rodGeo([f[0], HEAD - 3.6, f[1]], [t[0], HEAD - 7.6, t[1]], 0.6));
      }
    }

    // ── The bracket sets ──────────────────────────────────────────────────
    // Dougong: the stepped timber clusters that carry an eave out well past the
    // columns holding it up, and the one detail that says a roof of this kind
    // was built rather than draped over the top. Two tiers of crossed arms on
    // bearing blocks, over every column AND over the middle of every bay — and
    // each tier steps out only as far as the soffit above still has room for.
    const dougong = (a) => {
      GB.wood.add(inBay(a, 0, 0, HEAD + 0.9, 4.4, 1.8, 4.4));
      let y = HEAD + 1.8;
      // Sixteen clusters round a 26-unit circle leaves about ten units of arc
      // each at the first tier and thirteen at the second; arms longer than
      // that run into the neighbouring cluster and the whole band reads as
      // spilled bricks rather than as joinery.
      for (const [span, back, reach] of [[10.5, 3.0, 4.5], [15.0, 2.0, 8.0]]) {
        GB.wood.add(inBay(a, (reach - back) / 2, 0, y + 0.8, reach + back, 1.6, 2.2));
        GB.wood.add(inBay(a, reach - 3.0, 0, y + 0.8, 2.2, 1.6, span));
        for (const [out, along] of [[reach - 3.0, span / 2 - 1.5], [reach - 3.0, 1.5 - span / 2], [reach - 1.3, 0], [1.3 - back, 0]]) {
          GB.wood.add(inBay(a, out, along, y + 2.15, 2.3, 1.1, 2.3));
        }
        y += 2.7;
      }
      // the gilt eye on the front of the cluster, which is all a bracket ever
      // shows of itself from across the water
      GB.gold.add(inBay(a, 8.3, 0, HEAD + 5.3, 0.9, 1.7, 2.8));
    };
    // Over the columns only. With a cluster over the middle of every bay too,
    // seen from below on the bridge the sixteen run into one another and the
    // band under the eave is a heap of loose blocks; eight, one to a column,
    // repeat, and repetition is what makes joinery read as made. (With the room
    // that leaves, each tier's arms reach further along the eave.)
    // (pavilionFix.js, 2: one set to a column, block and arm in a stepped
    // cross, its arms along the beams; ?wpavfix=old:2 for the two tiers of
    // plain boxes with a gilt cube on each, which from the bridge read as
    // stacked lumber.)
    const PAV_BRACKETS = !pavOld(2);
    if (PAV_BRACKETS) {
      // (pavilionProps.js, 3: the arms eased and painted)
      const set = bracketSet({ paint: pavPropsOld(3) ? null : CAIHUA });
      // carried from the column's frame (+x out, +z along) onto column k
      const carry = (g, a) => { const p = on(a, R_COL); return g.clone().rotateY(-a * deg).translate(p[0], HEAD, p[1]); };
      for (let k = 0; k < 8; k++) {
        for (const g of set.arms) GB.wood.add(carry(g, bay(k)));
        for (const g of set.blocks) GB.lacquer.add(carry(g, bay(k)));
        for (const g of set.caps) GB.pavBronze.add(carry(g, bay(k)));
        for (const g of set.chalk) GB.pavChalk.add(carry(g, bay(k)));
        for (const g of set.green) GB.pavGreen.add(carry(g, bay(k)));
      }
      [...set.arms, ...set.blocks, ...set.caps, ...set.chalk, ...set.green].forEach((g) => g.dispose());
    } else for (let k = 0; k < 8; k++) dougong(bay(k));
    // the purlin the brackets are there to hold, and the beam behind them (each
    // on the top blocks of the sets)
    for (let k = 0; k < 8; k++) {
      const out = PAV_BRACKETS ? R_COL + BRACKET.purlinOut : 33;
      GB.wood.add(boxGeo(on(bay(k), out), on(bay(k + 1), out), 1.7, 2.0, HEAD + (PAV_BRACKETS ? BRACKET.purlinY : 6.6)));
      GB.lacquer.add(boxGeo(on(bay(k), R_COL), on(bay(k + 1), R_COL), 1.5, 1.8, HEAD + (PAV_BRACKETS ? BRACKET.beamY : 5.6)));
    }

    // ── The ceiling and the eave ──────────────────────────────────────────
    // Rafters laid ON the soffit curve rather than chorded under it — sixteen
    // the whole way from the eave to the boss, and sixteen more that carry only
    // the eave, because an eave is where a roof of this kind is most closely
    // ribbed and the eave is the half of it a reader standing under it sees.
    for (let k = 0; k < 32; k++) {
      const a = 22.5 + k * 11.25, full = k % 2 === 0;
      let last = null;
      for (const r of full ? [50, 43, 36, 29, 21, 13, 6, 0] : [50, 44, 38, 33]) {
        const p = on(a, r), here = [p[0], soffit(TIERS[0], r, a) - 1.4, p[1]];
        if (last) GB.wood.add(rodGeo(last, here, full ? 0.85 : 0.6));
        last = here;
      }
    }
    // (the outer of the two rings sat at the eave purlin's own radius, just
    // under it and crossing it at every bay: two purlins in one place)
    for (const r of pavOld(2) ? [33, 21] : [21]) {
      for (let k = 0; k < 16; k++) {
        GB.wood.add(boxGeo(on(22.5 + k * 22.5, r), on(45 + k * 22.5, r), 1.4, 1.6, soffit(TIERS[0], r) - 3.5));
      }
    }
    {
      const apex = soffit(TIERS[0], 0);
      GB.lacquer.add(placed(new THREE.CylinderGeometry(5.2, 3.2, 1.6, 16), PV, apex - 1.4));
      if (pavPropsOld(3)) {
        GB.gold.add(placed(new THREE.CylinderGeometry(2.6, 1.3, 1.3, 16), PV, apex - 2.8));
        GB.gold.add(placed(new THREE.SphereGeometry(1.1, 10, 8), PV, apex - 4.0));
      } else if (ROOF_OLD) {
        // (pavilionProps.js, 3: a gilt cup and ball hung there, a bell. A
        // stepped boss of the ceiling's own timber, and a bud turned down.
        // Under the tiled roof the rafters' meeting is above the ceiling's
        // board, and the boss is on the board: see the roofs, below.)
        GB.wood.add(placed(new THREE.CylinderGeometry(3.3, 2.5, 0.7, 16), PV, apex - 2.55));
        GB.lacquer.add(placed(lotusBud({ height: 1.5, radius: 0.85 }).rotateX(Math.PI), PV, apex - 2.9));
      }
    }

    // ── The eaves ─────────────────────────────────────────────────────────
    for (let k = 0; k < 8; k++) {
      const a = bay(k), lp = on(a, 52);
      // A paper lantern at the eave: lacquered cap and base round the light —
      // small, and burning low. As big as a head and nearly as bright as the
      // lamp on the table they would be eight lamps against its one, and "a
      // single pavilion burns warm" is a building lit from inside.
      FITTING.add(placed(new THREE.CylinderGeometry(0.18, 0.18, 2.6, 6), lp, 45.8));
      if (LAMPS.paper) trialEaves.push({ p: [lp[0], 42.8, lp[1]], s: [1.15, 1.5, 1.15], color: '#ffb070', k: 0.6 });
      else glows.push({ p: [lp[0], 42.8, lp[1]], s: [1.15, 1.5, 1.15], color: '#ff8a3e', k: 0.5 });
      GB.lacquer.add(placed(new THREE.CylinderGeometry(0.75, 1.0, 0.5, 10), lp, 44.5));
      GB.lacquer.add(placed(new THREE.CylinderGeometry(1.0, 0.75, 0.45, 10), lp, 41.2));
      FITTING.add(placed(new THREE.SphereGeometry(0.34, 8, 6), lp, 40.8));
      halo(lp, 42.8, 12, '#ff9a4e', 0.1);
    }

    // ── The roofs ─────────────────────────────────────────────────────────
    // Two tiers turned on a lathe: flat at the eave and lifting at the tip,
    // steepening to the ridge — tiles above, dark rafters beneath. A cone is a
    // hat; the curve is the whole character of the building. (The reversed
    // profile turns the lathe's faces inward: tiles on its back faces, rafters
    // on its front.) Both tiers are spun to the same 22.5°, so their corners
    // fall on the eight column lines and a hip runs the whole way up.
    M.roof.side = THREE.BackSide;
    const underside = Std({ color: '#2b1b12', roughness: 0.9, side: THREE.FrontSide });
    if (!ROOF_OLD) {
      // Tiled (pavilionRoof.js): the slopes with their rolls, tile-ends and
      // hips in one mesh, the soffit and the eave board in another; and
      // between the two tiers, the short wall the upper one stands on.
      const kind = ROOF_KIND, surface = ROOF_SURFACE[kind];
      const roofMat = roofFar(skyDull(Std({ map: tex(roofTiles(kind), [1, 1]), roughness: surface.roughness, side: THREE.DoubleSide }), surface.sky, surface.direct));
      // (gardenFix5.js, 6: the hips' curled ends in dark bronze — in the rolls'
      // pale grey, on the night, they are horns)
      const roof = tiledRoof({ at: PV, kind, light, bronze: !garden5Old(6) });
      const hornMat = roof.horns ? skyDull(Std({ color: HORN.color, roughness: HORN.roughness, metalness: HORN.metalness, side: THREE.DoubleSide }), HORN.sky) : null;
      for (const [geo, material] of [[roof.tiles, roofMat], [roof.under, underside], ...(roof.horns ? [[roof.horns, hornMat]] : [])]) {
        const m = new THREE.Mesh(keep(geo), material);
        m.castShadow = material === roofMat;
        m.receiveShadow = true;
        m.name = 'pavRoof';
        root.add(m);
      }
      const [low, high] = TIERS, wallR = high.r * 0.88;
      // (to the upper tier's soffit at a facet's middle: at its hips that roof is already sweeping up)
      const y0 = soffit(low, wallR) - 0.5, y1 = roofProfile(high, wallR) - 0.3;
      GB.lacquer.add(placed(new THREE.CylinderGeometry(wallR, wallR, y1 - y0, 8, 1, true), PV, (y0 + y1) / 2, 22.5 * deg));
      GB.wood.add(placed(new THREE.CylinderGeometry(wallR + 0.5, wallR + 0.5, 0.7, 8, 1, false), PV, y0 + 0.75, 22.5 * deg));
      // (pavilionProps.js, 3: that board is the ceiling a reader under it
      // looks up at, plain from edge to edge. A boss on its middle — a step
      // of lacquer, a step of timber, and a lotus bud turned down.)
      if (!pavPropsOld(3)) {
        const under = y0 + 0.4;
        GB.lacquer.add(placed(new THREE.CylinderGeometry(4.4, 5.0, 0.5, 16), PV, under - 0.25));
        GB.wood.add(placed(new THREE.CylinderGeometry(2.5, 3.2, 0.6, 16), PV, under - 0.8));
        GB.lacquer.add(placed(lotusBud({ height: 1.5, radius: 0.85 }).rotateX(Math.PI), PV, under - 1.1));
      }
      // (the gold balls, for whoever asks for them back: forkProps.js, 11)
      if (propsOld(11)) for (const p of roof.tips) GB.gold.add(new THREE.SphereGeometry(0.95, 32, 24).translate(p[0], p[1], p[2]));
    } else for (const tier of TIERS) {
      const { r, h, y } = tier;
      const profile = [new THREE.Vector2(r * 1.05, 2.2), new THREE.Vector2(r, 0)];
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        profile.push(new THREE.Vector2(r * (1 - t) + 0.01, h * (1 - (1 - t) ** 2.4)));
      }
      const geo = keep(new THREE.LatheGeometry(profile.reverse(), 8, 22.5 * deg));
      for (const material of [M.roof, underside]) {
        const roof = new THREE.Mesh(geo, material);
        roof.position.set(PV[0], y, PV[1]);
        roof.castShadow = material === M.roof;
        roof.receiveShadow = true;
        root.add(roof);
      }
      // Ridges laid ON that curve: eight hips down the corners and a thinner
      // roll of tile down the middle of each facet between them. A lathe on its
      // own gives a smooth shell, and a smooth shell is a lampshade.
      for (let k = 0; k < 16; k++) {
        const a = 22.5 + k * 22.5, hip = k % 2 === 0, lift = hip ? 1.0 : 0.6;
        let last = null;
        for (let i = 0; i <= 9; i++) {
          const rr0 = Math.min(r - 0.4, r * (1 - (i / 9) ** 1.3) + 0.6);
          const n = outward(tier, rr0), p = on(a, rr0 + n[0] * lift);
          const here = [p[0], soffit(tier, rr0) + n[1] * lift, p[1]];
          if (last) GB.ridge.add(rodGeo(last, here, hip ? 0.95 : 0.5));
          last = here;
        }
        if (!hip) continue;
        // and the flying tip, which at a hundred units is the whole of what
        // makes a roof of this kind read as a roof of this kind. It has to
        // CURVE, and it has to be short: laid out straight and long the eight
        // of them read as spears stuck through the building.
        let foot = null;
        for (const [ro, dy, rad] of [[1.05, 0.2, 1.0], [1.075, 1.4, 0.85], [1.09, 3.2, 0.6]]) {
          const q = on(a, r * ro), here = [q[0], y + 2.2 + dy, q[1]];
          if (foot) GB.ridge.add(rodGeo(foot, here, rad));
          foot = here;
        }
        GB.gold.add(placed(new THREE.SphereGeometry(0.95, 8, 6), on(a, r * 1.09), y + 6.0));
      }
      // the fascia along the eave: the course that closes the ends of the tiles
      // and, at night, the only line of the roof a lantern actually lights
      for (let k = 0; k < 8; k++) {
        GB.ridge.add(boxGeo(on(bay(k), r * 1.05), on(bay(k + 1), r * 1.05), 1.7, 1.3, y + 0.6));
      }
    }

    // ── The finial ────────────────────────────────────────────────────────
    // Not a ball. A lotus seat, three rings, the gourd and a spike: the one
    // piece of the building that is there only to be looked at.
    {
      const top = TIERS[1].y + TIERS[1].h;
      GB.lacquer.add(placed(new THREE.CylinderGeometry(3.0, 5.4, 2.6, 8), PV, top + 0.4));
      for (let i = 0; i < 3; i++) GB.gold.add(placed(new THREE.CylinderGeometry(2.5 - i * 0.35, 2.7 - i * 0.35, 0.7, 12), PV, top + 2.4 + i * 1.1));
      GB.gold.add(placed(new THREE.SphereGeometry(2.5, 12, 10), PV, top + 7.2));
      GB.gold.add(placed(new THREE.SphereGeometry(1.5, 12, 10), PV, top + 10.2));
      GB.gold.add(placed(new THREE.CylinderGeometry(0.16, 0.7, 4.4, 8), PV, top + 13.0));
    }

    point(PV, DECK + 12.2, '#ffb266', 5200, 7);
    // and NO pool of light on the ground. Every other lamp in the world lays
    // one — light scattered back off stone or gravel — but the ground under
    // this one is the pond, and water does not scatter light back, it reflects
    // it. A 210-by-190 additive quad of warm haze at y 6.9 makes the pond read
    // as a lawn: it lies over the water edge to edge, above it and brighter
    // than anything in it, and nothing on the surface underneath can be seen
    // through it. What a lamp does to this water is the broken column it lays
    // down towards the eye, and that is the water's own business (water.js).
    if (!paintings) {
      // ── The lamp at the heart of it ─────────────────────────────────────
      // "Where the lamp keeps every future." A low table on four legs with an
      // apron between them, and a standing lantern on it: a base, four corner
      // posts, a cap, and the light held inside a frame rather than loose in
      // the air.
      const TT = DECK + 6.6;
      for (let i = 0; i < 4; i++) {
        const q = add(PV, dir(45 + i * 90), 4.6);
        GB.wood.add(placed(new THREE.CylinderGeometry(0.75, 0.95, 6.6, 8), q, DECK + 3.3));
      }
      for (let i = 0; i < 4; i++) {
        GB.wood.add(boxGeo(add(PV, dir(45 + i * 90), 4.6), add(PV, dir(135 + i * 90), 4.6), 1.2, 0.7, TT - 2.4));
      }
      GB.wood.add(placed(new THREE.CylinderGeometry(8.0, 7.4, 1.3, 16), PV, TT + 0.65));
      // The table's shade. A lamp stood on a table lights the room above it;
      // the floor round the table is in the table's own shadow, out to about 8
      // × 12.2 / 4.3 ≈ 23 (its top's radius, by the lamp's height over the
      // floor and over the top). The lamps cast no shadows here, so without
      // this the brightest thing on the deck is the floor directly UNDER the
      // table, a cream disc round its foot. Laid as a shade, not drawn as a
      // shadow: a flat core and a penumbra as wide as the lantern is, and not
      // black, because the deck and the columns light it back a little.
      const shadeTex = tex(paint(128, 128, (g) => {
        const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.35, 'rgba(255,255,255,0.92)');
        grd.addColorStop(0.72, 'rgba(255,255,255,0.32)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 128, 128);
      }), [1, 1], false);
      const tableShade = new THREE.Mesh(flatPlane(), keep(new THREE.MeshBasicMaterial({
        map: shadeTex, color: '#000000', transparent: true, opacity: 0.72, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2,
      })));
      tableShade.scale.set(50, 1, 50);
      tableShade.position.set(PV[0], DECK + 0.05, PV[1]);
      tableShade.renderOrder = 1;
      root.add(tableShade);
      GB.lacquer.add(placed(new THREE.CylinderGeometry(3.4, 4.0, 1.0, 8), PV, TT + 1.8, 22.5 * deg));
      for (let i = 0; i < 4; i++) {
        GB.lacquer.add(placed(new THREE.BoxGeometry(0.45, 7.2, 0.45), add(PV, dir(45 + i * 90), 2.4), TT + 5.9));
      }
      GB.lacquer.add(placed(new THREE.CylinderGeometry(4.4, 3.2, 0.9, 8), PV, TT + 9.9, 22.5 * deg));
      FITTING.add(placed(new THREE.SphereGeometry(0.8, pavPropsOld(13) ? 8 : 16, pavPropsOld(13) ? 6 : 12), PV, TT + 10.9));
      if (LAMPS.table) {
        // lit panels of silk in the frame, a lattice over them, and no glow
        // egg — the posts stand dark against the light (lampPass.js)
        const panels = [];
        for (let i = 0; i < 4; i++) {
          panels.push(new THREE.PlaneGeometry(0.818, 1.986).translate(0, -0.007, 0.471).rotateY((i * Math.PI) / 2));
        }
        const lit = new THREE.Mesh(keep(mergeGeometries(panels)), M.lpPanel);
        panels.forEach((g) => g.dispose());
        lit.position.set(PV[0], TT + 5.9, PV[1]);
        lit.scale.setScalar(3.6);
        lit.name = 'pavilion-table-panels';
        root.add(lit);
      } else glows.push({ p: [PV[0], TT + 5.6, PV[1]], s: [2.0, 2.7, 2.0], color: '#ffd08a', k: 1.15 });
      halo(PV, TT + 5.6, 26, '#ffbe70', 0.3);
      // and its light laid on the black water under the pavilion (water.js)
      waterLamps.push({ p: [PV[0], TT + 5.6, PV[1]], color: '#ffc884', k: 1.2 });
      // "Its music seems to arrive from all your lives at once" — and nothing
      // in it can make a sound. (Nor can the world: it has none. The copy
      // speaks of the qin waiting instead: pavilionFix.js, 6.) A guqin on the
      // table beside the lamp, on the side the bridge comes from: a long zither
      // in black lacquer, seven silk strings, the thirteen studs of
      // mother-of-pearl along its near edge; on the boards before it, the
      // cushion someone sits on to play it. (pavilionProps.js, 4: a qin's
      // outline and arched top, its strings and studs where a qin's are, the
      // head out over the table's edge with its pegs and tassels, and a cloth
      // under its tail let down over the rim.)
      if (!pavPropsOld(4)) {
        const toBridge = 127, a = (toBridge - 90) * deg;
        // `OUT` from the table's middle to the qin's line (clear of the lamp's
        // foot), `SHIFT` along that line toward its head: the tail on the
        // table, and the head past its rim by a hand's width at the least
        const OUT = 5.3, SHIFT = 1.66, top = TT + 1.3;
        const mid = add(PV, dir(toBridge), OUT);
        const carry = (g, dx = 0) => g.translate(dx, 0, 0).rotateY(-a).translate(mid[0], top, mid[1]);
        const q = qin();
        for (const g of q.body) GB.blackLacquer.add(carry(g, SHIFT));
        for (const g of [...q.strings, ...q.pearl]) GB.silk.add(carry(g, SHIFT));
        for (const g of q.fittings) GB.wood.add(carry(g, SHIFT));
        for (const g of q.tassels) GB.cushion.add(carry(g, SHIFT));
        const cloth = qinCloth({ centre: [0, -OUT], rim: 8.06, x0: SHIFT - q.L / 2 + 0.3, x1: SHIFT - q.L / 2 + 3.7 });
        for (const g of cloth.cloth) GB.brocade.add(carry(g));
        for (const g of cloth.trim) GB.pavGilt.add(carry(g));
        const seat = add(PV, dir(toBridge), 12.5);
        GB.cushion.add(new THREE.CylinderGeometry(2.6, 2.8, 1.0, 20).scale(1, 1, 0.82).rotateY(-a).translate(seat[0], DECK + 0.5, seat[1]));
      } else {
        const toBridge = 127, a = (toBridge - 90) * deg, along = dir(toBridge - 90);
        const mid = add(PV, dir(toBridge), 5.7), top = TT + 1.3;
        const body = [
          new THREE.BoxGeometry(11, 0.5, 1.9).translate(0, 0.25, 0),
          new THREE.BoxGeometry(1.4, 0.35, 1.55).translate(-5.9, 0.2, 0),
          new THREE.CylinderGeometry(0.95, 0.95, 0.5, 14, 1, false, 0, Math.PI).rotateY(-Math.PI / 2).translate(5.5, 0.25, 0),
        ];
        GB.blackLacquer.add(mergeGeometries(body).rotateY(-a).translate(mid[0], top, mid[1]));
        body.forEach((g) => g.dispose());
        for (let k = 0; k < 7; k++) {
          const z = -0.66 + k * 0.22, p0 = add(add(mid, along, -5.4), dir(toBridge), z), p1 = add(add(mid, along, 5.2), dir(toBridge), z * 0.8);
          GB.silk.add(rodGeo([p0[0], top + 0.56, p0[1]], [p1[0], top + 0.6, p1[1]], 0.035));
        }
        for (let k = 0; k < 13; k++) {
          const q = add(add(mid, along, -4.2 + k * 0.7), dir(toBridge), 0.78);
          GB.silk.add(new THREE.SphereGeometry(0.09, 6, 4).translate(q[0], top + 0.52, q[1]));
        }
        const seat = add(PV, dir(toBridge), 12.5);
        GB.cushion.add(new THREE.CylinderGeometry(2.6, 2.8, 1.0, 20).scale(1, 1, 0.82).rotateY(-a).translate(seat[0], DECK + 0.5, seat[1]));
      }
    } else {
      const facing = dir(126.5), width = 40, height = width / (3376 / 1440);
      const at = add(PV, facing, -6), angle = Math.atan2(facing[0], facing[1]);
      const panel = new THREE.BoxGeometry(width + 3, height + 3, 1.6);
      panel.rotateY(angle);
      panel.translate(at[0], 14 + height / 2, at[1]);
      GB.lacquer.add(panel);
      const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
      const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
      const front = add(at, facing, 0.9);
      plane.position.set(front[0], 14 + height / 2, front[1]);
      plane.rotation.y = angle;
      root.add(plane);
      mounts[6] = { center: [front[0], 14 + height / 2, front[1]], normal: facing, width, height, material: mat };
    }
    // ── The bridge ────────────────────────────────────────────────────────
    // Boards laid across bearers, with continuous rails following the
    // original zigzag outline. Navigation follows bends within this deck.
    const bridgeOut = (BR) => {
      const arrival = arrivalOf(BR);
      const HW = PAVILION_BRIDGE_HALF_WIDTH;
      const RW = HW - 0.9;             // the rails' line, just in from its edge
      const TOP = 8.6;                 // the boards, where the walk stands (DECK, below)
      const runs = BR.slice(1).map((b, i) => {
        const a = BR[i], t = unit2(a, b);
        return { a, L: dist(a, b), t, n: [-t[1], t[0]] };
      });
      // The far end is cut along the face of the bay it arrives at — the last
      // run meets that face 20° off square — instead of stopping square across it.
      const face = dir(bay(arrival) + 22.5);
      const reach = (p) => (p[0] - PV[0]) * face[0] + (p[1] - PV[1]) * face[1];
      // the walk's line offset by d (either side), from `back` behind the shore
      // to `cut` out from the middle of the pavilion, mitred at every turn
      const edge = (d, back = 3, cut = 31) => {
        const last = runs[runs.length - 1];
        const pts = [add(add(runs[0].a, runs[0].n, d), runs[0].t, -back)];
        for (let i = 1; i < runs.length; i++) {
          const n0 = runs[i - 1].n, n1 = runs[i].n;
          pts.push(add(runs[i].a, [n0[0] + n1[0], n0[1] + n1[1]], d / (1 + n0[0] * n1[0] + n0[1] * n1[1])));
        }
        const q = add(BR[BR.length - 1], last.n, d);
        pts.push(add(q, last.t, (cut - reach(q)) / (last.t[0] * face[0] + last.t[1] * face[1])));
        return pts;
      };
      // a member laid along a line of points, each piece lengthened at a turn
      // by just enough to close the outside of the mitre
      // (`worn`, pavilionProps.js 10: a rail's member in worn lacquer, deeper
      // where each post — and, `balusters`, each baluster — meets it)
      const along = (pts, h, t, y0, batch, worn = null) => {
        const u = pts.slice(1).map((p, i) => unit2(pts[i], p));
        const over = (i) => {
          if (i <= 0 || i >= u.length) return 0;
          const c = Math.max(-0.99, u[i - 1][0] * u[i][0] + u[i - 1][1] * u[i][1]);
          return (t / 2) * Math.sqrt((1 - c) / (1 + c));
        };
        u.forEach((v, i) => {
          const from = add(pts[i], v, -over(i)), to = add(pts[i + 1], v, over(i + 1));
          if (!worn) { batch.add(boxGeo(from, to, h, t, y0)); return; }
          const L = dist(pts[i], pts[i + 1]), bays = Math.max(1, Math.round(L / 8)), n = bays * (worn.balusters ? 3 : 1);
          GB.railWorn.add(wornBar(from, to, y0, h, t, { ...worn, joints: Array.from({ length: n + 1 }, (_, j) => over(i) + (L * j) / n) }));
        });
      };
      // a convex outline cut down to where f(p) >= 0
      const keepWhere = (poly, f) => {
        const out = [];
        poly.forEach((p, i) => {
          const q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
          if (fp >= 0) out.push(p);
          if ((fp >= 0) !== (fq >= 0)) out.push(lerp2(p, q, fp / (fp - fq)));
        });
        return out;
      };
      const area = (poly) => Math.abs(poly.reduce((s, p, i) => {
        const q = poly[(i + 1) % poly.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0)) / 2;

      const L = edge(HW), R = edge(-HW);
      // What the boards lie on: a bed under the whole outline, an edge beam
      // under the board ends, and bearers across — one under the middle of each
      // run and one along each mitre — whose ends show under the edge.
      GB.wood.add(slabGeo([...edge(HW - 0.4), ...edge(-(HW - 0.4)).reverse()], [], 1.0, TOP - 1.6));
      for (const s of [1, -1]) along(edge(s * (HW - 0.6)), 1.3, 1.2, TOP - 1.9, GB.wood);
      runs.forEach((r, i) => {
        const m = add(r.a, r.t, r.L / 2);
        GB.wood.add(boxGeo(add(m, r.n, -(HW + 0.7)), add(m, r.n, HW + 0.7), 0.9, 1.2, TOP - 1.8));
        if (i > 0) GB.wood.add(boxGeo(add(L[i], unit2(R[i], L[i]), 0.7), add(R[i], unit2(L[i], R[i]), 0.7), 0.9, 1.2, TOP - 1.8));
      });
      // The boards, each run's cut along the mitres where it meets the next.
      // The grain runs along a board (u, see walnut in textures.js), and each
      // is cut from a different stretch of the timber.
      runs.forEach((r, i) => {
        const quad = [L[i], L[i + 1], R[i + 1], R[i]];
        const u = (p) => (p[0] - r.a[0]) * r.t[0] + (p[1] - r.a[1]) * r.t[1];
        const hi = Math.max(...quad.map(u));
        for (let k = 0, u0 = Math.min(...quad.map(u)); u0 < hi; k++, u0 += 2.2) {
          const board = keepWhere(keepWhere(quad, (p) => u(p) - u0), (p) => u0 + 2.04 - u(p));
          if (board.length < 3 || area(board) < 0.5) continue;
          const g = slabGeo(board, [], 0.6, TOP - 0.6);
          const pos = g.attributes.position, uv = g.attributes.uv, shift = ((i * 13 + k) * 5.37) % 16;
          for (let v = 0; v < pos.count; v++) {
            const x = pos.getX(v), z = pos.getZ(v);
            uv.setXY(v, x * r.n[0] + z * r.n[1] + shift * 3.1, x * r.t[0] + z * r.t[1] + shift);
          }
          GB.deck.add(g);
        }
      });
      // Onto it from the gravel, 3.4 below the boards, by a stone step on a
      // stone abutment; and off it onto the pavilion, 3.5 above, by another.
      {
        const r = runs[0];
        const quad = (w, u0, u1) => [[w, u0], [w, u1], [-w, u1], [-w, u0]].map(([d, u]) => add(add(r.a, r.n, d), r.t, u));
        const steps = paintings ? GB.stone : GB.pavilionStep;
        if (SHORE_OLD) {
          steps.add(slabGeo(quad(HW + 0.6, -4.2, 2.5), [], 2.5, TOP - 4.4));
          steps.add(slabGeo(quad(RW - 0.6, -7.2, -3.6), [], 2.2, TOP - 3.9));
        } else {
          // (shore.js) a pier of coursed granite under the deck's end, on the
          // footprint and to the top of the slab it stands for, and one broad
          // stone to step up from, its top where that slab's step was
          const foot = bridgeFoot({
            a: r.a, t: r.t, n: r.n, half: HW + 0.6, pier: [-4.2, 2.5], pierTop: TOP - 1.9,
            step: { u0: -7.2, u1: -3.6, half: RW - 0.6, top: TOP - 1.7 }, floor: 5.2,
            seed: 7331 + Math.round(BR[0][0] + BR[0][1]), light,
          });
          for (const g of foot.blocks) GB.shoreStone.add(g);
          GB.shoreStep.add(foot.step);
        }
        const n = L.length - 1, w = RW - 0.9;
        const band = [...edge(w, 3, 28.8).slice(n - 1), ...edge(-w, 3, 28.8).slice(n - 1).reverse()];
        steps.add(slabGeo(keepWhere(band, (p) => 33.3 - reach(p)), [], 1.75, TOP));
        // At nine units wide the bridge cleared the rocks round the shore; at
        // this width some came up through its boards. Their draws are spent
        // already, so dropping them moves nothing else.
        const line = [add(r.a, r.t, -7.5), ...BR.slice(1)];
        for (let k = rocks.length - 1; k >= 0; k--) {
          const { p: [x, , z], s: [sx, , sz] } = rocks[k], room = HW + Math.max(sx, sz) * 0.75;
          if (line.slice(1).some((b, i) => segDist([x, z], line[i], b) < room)) rocks.splice(k, 1);
        }
      }
      // The rails: a post at every turn and never more than eight apart, and
      // the same members the pavilion's own rail has — posts with capped heads,
      // a handrail over them and a kick rail under, balusters between.
      const post = (q, v) => {
        const ang = -Math.atan2(v[1], v[0]);
        if (RAIL_WORN) GB.railWorn.add(wornPost(q, TOP, 1.4, 4.4, ang));
        else GB.lacquer.add(placed(new THREE.BoxGeometry(1.4, 4.4, 1.4), q, TOP + 2.2, ang));
        // A capped head, not a brass knob: the walk goes along this rail and a
        // gilt ball on every post comes past the eye like a row of melons. (And
        // not a squat pyramid either, which is the nearest, heaviest shape in
        // the Pavilion's frame: a small lacquered bud on a collar.)
        FITTING.add(placed(new THREE.CylinderGeometry(0.85, 0.85, 0.22, 8), q, 13.95));
        GB.lacquer.add(placed(new THREE.CylinderGeometry(0.42, 0.62, 0.35, 10), q, 14.25));
        // (and not an egg, which the nearest, out of focus at the frame's
        // foot, made an acorn of: a lotus bud with its petals carved in —
        // pavilionFix.js, 3)
        if (pavOld(3)) GB.lacquer.add(placed(new THREE.SphereGeometry(0.5, 12, 8).scale(1, 1.45, 1), q, 14.95));
        else GB.lacquer.add(placed(bud.clone(), q, 14.38, ang));
      };
      const bud = keep(lotusBud());
      for (const s of [1, -1]) {
        const line = edge(s * RW, 2, 32);
        along(line, 1.0, 1.4, TOP, GB.wood);                               // curb
        along(line, 0.9, 1.5, 10.0, GB.lacquer, RAIL_WORN ? { rub: 0.3, balusters: true } : null);   // kick rail
        along(line, 1.1, 2.0, 13.0, GB.lacquer, RAIL_WORN ? { rub: 1, ease: 0.3 } : null);         // handrail
        const u = line.slice(1).map((p, i) => unit2(line[i], p));
        line.forEach((p, i) => {
          // at a turn the post stands square to the line halfway between the two runs
          post(p, i === 0 ? u[0] : i === u.length ? u[i - 1] : unit2([0, 0], add(u[i - 1], u[i])));
          if (i === u.length) return;
          const bays = Math.max(1, Math.round(dist(p, line[i + 1]) / 8)), ang = -Math.atan2(u[i][1], u[i][0]);
          for (let j = 0; j < bays; j++) {
            const a = lerp2(p, line[i + 1], j / bays), b = lerp2(p, line[i + 1], (j + 1) / bays);
            if (j > 0) post(a, u[i]);
            for (const f of [0.33, 0.67]) {
              if (RAIL_WORN) GB.railWorn.add(wornPost(lerp2(a, b, f), 10.8, 0.6, 2.3, ang));
              else GB.lacquer.add(placed(new THREE.BoxGeometry(0.6, 2.3, 0.6), lerp2(a, b, f), 11.95, ang));
            }
          }
        });
      }
    };
    bridgeOut(BRIDGE);
    if (NORTH_OPEN) bridgeOut(NORTH_BRIDGE);
  }
  return { pondEdge };
}
