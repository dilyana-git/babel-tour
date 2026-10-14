// Where a reader stands and the ways on (buildWorld.js, assembleWorld): the
// stands, the legs of the walk, the floor it has worn, what the water
// reflects, and how the walk ends — which returns the world.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pavilionCrossing, pavilionRound, pavilionInterior } from '../pavilionBridge';
import { PAVILION_PATH, SHORE_PATH } from '../gardenPlan';
import { LAMPS } from '../lampPass';
import { buildFinale } from '../finale';
import { makeDoorway } from '../doorway';
import { vestOld } from '../vestFix';
import { echoOld, ECHO_STAND_R } from '../echoFix';
import { vertigoOld, STAND_TURN, STAND_PITCH } from '../vertigoFix';
import { forkOld, STAND as FORK_STAND } from '../forkFix';
import { pavOld, standOn, STAND as PAV_STAND } from '../pavilionFix';
import { BELT } from '../webProps';
import { POND as POND_GLOW } from '../gardenFix5';
import { doorPropsOld, STAND as DOOR_STAND, CANDLES as DOOR_CANDLES } from '../doorProps';
import { VANTAGES } from '../vantages';
import { hexAislePoint, roundAislePoint, pathToPoint, makeWalkCurve } from '../walkPath';
import { BRINK_OLD } from '../spiral';
import { deg, OLD_GLARE } from './common';

export function buildStands(ctx) {
  const { paintings, dir, add, dist, A, cellC, ECHO_A, BRIDGE_LEVEL, flightProfile, ECHO_FLIGHT,
    ECHO_RING, PIT, stairAt, DOOR, mazeRoute, PERGOLA0, J, SHORE, BRIDGE, BRIDGE_STAND, MAZE_ENTRY,
    HEART, COURT_HALF, at } = ctx;
  // ── Where a reader stands, and the ways on ────────────────────────────────
  // Eye height is a reader's (the figures stand 18 tall). The ground is 6 on
  // the Library's floors, 5.2 on the garden's gravel, 8.6 on the bridge, 5 in
  // the maze, and each tread's height on the Echo's stair.
  const EYE = 15, FLOOR = 6, GRAVEL = 5.2, DECK = 8.6, MAZE = 5;
  const C0 = cellC(0, 0), C1 = cellC(1, -1), C2 = cellC(2, -2);
  const ring = (c, a, r) => add(c, dir(a), r);
  // Use the aisle's two boundaries, including the corners of a hexagon.
  // The Echo's round colonnade has a different inner edge from a well rail.
  const vestibuleMiddle = (a) => {
    // The raised bridge (?wbridge=old) projects beyond the well. At its far
    // end the aisle is between that abutment and the books, rather than the
    // well's rail. Level with the floor, the bridge ends at the well.
    if (!BRIDGE_LEVEL && a >= 15 && a <= 45) return hexAislePoint(C0, a, 55 / Math.cos(Math.PI / 6), A - 12);
    return hexAislePoint(C0, a, 50.8, A - 16.8);
  };
  const echoMiddle = (a) => roundAislePoint(C1, a, ECHO_RING + 3, ECHO_A - 12);
  const silenceMiddle = (a) => hexAislePoint(C2, a, 42.8, A - 16.8);
  const vertigoMiddle = (a) => ring(PIT, a, (70.6 + 89) / 2);
  // The folded bookcase occupies the left of the arch. Centre the walk in
  // the remaining opening, then join the pergola's own axis.
  const doorLane = (u) => add(add(DOOR, dir(330), u), dir(60), 4.2);
  const unit = (a, b) => { const L = dist(a, b) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const eye = (p, ground) => [p[0], ground + EYE, p[1]];
  const way = (ground, pts) => pts.map((p) => eye(p, ground));
  // a line that keeps to its corners (the bridge, the maze) instead of cutting
  // them (never further along a side than half of it: the way into the maze
  // ends three units past its last corner, and four along it from that corner
  // is a point BEYOND the end — the walk would overshoot its stand by a pace
  // and come back, and the eyes, which look along the way, turn right round in
  // one frame)
  const hug = (ground, pts, r = 3) => pts.flatMap((p, i) => (i === 0 || i === pts.length - 1
    ? [eye(p, ground)]
    : [eye(add(p, unit(p, pts[i - 1]), Math.min(r, dist(p, pts[i - 1]) / 2)), ground), eye(p, ground), eye(add(p, unit(p, pts[i + 1]), Math.min(r, dist(p, pts[i + 1]) / 2)), ground)]));
  // Approach the bridge along its first run, using the actual abutment
  // steps. Entering diagonally from the shore crossed the side rail.
  const bridgeAxis = unit(SHORE, BRIDGE[1]);
  const bridgeEntry = [
    eye(add(SHORE, bridgeAxis, -10), GRAVEL),
    eye(add(SHORE, bridgeAxis, -5.4), 6.9),
    eye(add(SHORE, bridgeAxis, -3.6), 6.7),
    eye(SHORE, DECK),
  ];
  const pergola = unit(PERGOLA0, J);
  const heartFrom = unit(mazeRoute[mazeRoute.length - 2] ?? MAZE_ENTRY, HEART);
  // `p` turned about `o` by `a` degrees (to the right, seen from above the way the walk faces)
  const turnAbout = (o, p, a) => {
    const v = [p[0] - o[0], p[1] - o[1]], c = Math.cos(a * deg), s = Math.sin(a * deg);
    return [o[0] + v[0] * c - v[1] * s, o[1] + v[0] * s + v[1] * c];
  };
  const onStair = (t, lift = EYE) => { const st = stairAt(t); return [st.p[0], st.tread + lift, st.p[1]]; };
  // standing at the stair's open edge, just short of the drop
  const onEdge = (t) => { const st = stairAt(t); return at(add(PIT, dir(st.a), st.edge + 1.4), st.tread + EYE - 0.5); };
  const spot = [
    // Rest on the centreline too; the Echo faces its first tread squarely.
    // (the Echo's a few strides in from the aisle's middle: echoFix.js, 1)
    vestibuleMiddle(150), echoOld(1) ? echoMiddle(180) : ring(C1, 180, ECHO_STAND_R), silenceMiddle(90), null,
    // The Web of Time: in the corridor a few paces short of the court's gate,
    // looking in at the heart. (The step into the court is the finale's.)
    // (the Fork's back at the pergola's end and a little left, where both ways
    // can be seen leaving the stone: forkFix.js, 1)
    // (the Door's further back, so the gable's finial is in the frame: doorProps.js, 1)
    doorLane(doorPropsOld(1) ? -38 : -38 - DOOR_STAND.back), forkOld(1) ? add(J, pergola, -8) : add(add(J, pergola, -FORK_STAND.back), [-pergola[1], pergola[0]], FORK_STAND.side),
    // (the Pavilion's back on the bridge's first run, near the shore, so its
    // roof is against the sky and not over the eye: pavilionFix.js, 8)
    pavOld(8) ? BRIDGE_STAND : standOn(BRIDGE), add(HEART, heartFrom, paintings ? -22 : -(COURT_HALF + 12)),
  ];
  // The Echo's stair, every tread of it, up over the well and down the other
  // side: the second leg walks it, and the climb to the crossing is its first
  // half.
  //
  // Both ends are walked tread by tread. Leave them out and the climb from the
  // floor to the third tread raises the eye ten units — about a metre — at 50
  // degrees in a stride, where the stair itself is 17, and coming down from the
  // crossing the reader drops off the bottom of the flight; a walk that leaves
  // the flight by its SIDE, over the parapet, falls twelve units to the floor
  // beside it. The first riser is the one tall step there is (5 units off the
  // floor, where the rest are 2.4), so the end treads are stood on towards
  // their upper riser, spreading it over the most ground. (Read off the flight
  // itself, so a re-cut stair — ECHO_FLIGHT — is walked as it is built.)
  const echoFlight = flightProfile(ECHO_FLIGHT);
  const { run: ECHO_RUN, span: ECHO_SPAN, steps: ECHO_STEPS } = echoFlight.dims;
  const echoStair = [];
  for (let s = 0; s < ECHO_STEPS; s++) {
    const at0 = s === 0 ? ECHO_RUN - 2.5 : s === ECHO_STEPS - 1 ? 2.5 : ECHO_RUN / 2 - 0.3;
    echoStair.push(eye(add(C1, dir(0), -ECHO_SPAN + s * ECHO_RUN + at0), echoFlight.stepTop(s)));
  }
  // The floor just short of the first nosing. The stand is back from the foot,
  // and without this the eye would begin to rise the moment it left the stand,
  // up a ramp that is not there. (Only where the foot IS in front of the stand:
  // with the old tread, ?wecho=old, it is behind it.)
  const footU = -ECHO_SPAN - 1.5;
  const echoFoot = footU > spot[1][0] - C1[0] + 1 ? [eye(add(C1, dir(0), footU), FLOOR)] : [];
  return { EYE, FLOOR, GRAVEL, DECK, MAZE, C0, C1, C2, ring, vestibuleMiddle, echoMiddle,
    silenceMiddle, vertigoMiddle, doorLane, unit, eye, way, hug, bridgeEntry,
    heartFrom, turnAbout, onStair, onEdge, spot, echoFlight, ECHO_SPAN, ECHO_STEPS, echoStair,
    echoFoot };
}

export function buildCrossing(ctx) {
  const { paintings, dir, add, lerp2, dist, Q, A, ECHO_A, hallMid, walkers, PIT, stairAt, GATE,
    mazeRoute, PERGOLA0, J, PV, SHORE, BRIDGE, MAZE_ENTRY, HEART, N_SHORE, NORTH_BRIDGE, at,
    EYE, FLOOR, GRAVEL, DECK, MAZE, C0, C1, C2, ring, vestibuleMiddle, echoMiddle, silenceMiddle,
    vertigoMiddle, doorLane, unit, eye, way, hug, bridgeEntry, turnAbout, onStair,
    onEdge, spot, echoFlight, ECHO_SPAN, ECHO_STEPS, echoStair, echoFoot } = ctx;
  // ── The crossing, over the middle of the Echo (VANTAGES) ───────────────────
  // The crown of a flight is its two middle treads, level over the well —
  // asked of flightProfile rather than written out again here, so a flight that
  // is ever re-cut takes this with it.
  const CROWN = Math.max(...echoFlight.top.map(([, h]) => h));
  const crossing = {
    ...VANTAGES[1],
    eye: at(C1, CROWN + EYE),
    // Along the OTHER flight — the one that cannot be seen from the floor. It
    // runs out from under the reader's feet and down to the gallery floor, with
    // the arcades over it and the shaft falling across both. Level would show
    // the arcades and no stair; much steeper cuts the arches off at the top of
    // the frame.
    look: at(add(C1, dir(60), 70), CROWN - 4),
    // Up the flight the walk to the Silence climbs, and no further: whatever
    // the climb is, it is the one the room already has.
    points: [eye(spot[1], FLOOR), ...echoFoot, ...echoStair.slice(0, ECHO_STEPS / 2), at(C1, CROWN + EYE)],
  };
  const stands = [
    { eye: eye(spot[0], FLOOR), look: at(ring(C0, 30, 16), 24) },
    // Along one flight, not across both: seen end-on the two crossing stairs
    // are a heap, and from the foot of one they are a stair you could climb.
    // The crossing itself is up there to be stood on (`vantage`), because from
    // the floor you can only ever see one of the two flights.
    { eye: eye(spot[1], FLOOR), look: at(add(C1, dir(0), 34), 34), vantage: crossing },
    // across the well at the two broken flights, with the one lamp behind them
    { eye: eye(spot[2], FLOOR), look: at(ring(C2, 285, 26), 37) },
    // Face the next steps. A chord across the funnel looked well away from
    // the stair's tangent and made setting off feel like a sideways turn.
    // (turned in toward the well and looking down into it: vertigoFix.js, 1)
    { eye: onStair(0.06), look: vertigoOld(1) ? onStair(0.072) : (() => {
      const e = onStair(0.06), n = onStair(0.072), yaw = Math.atan2(n[2] - e[2], n[0] - e[0]) + STAND_TURN * deg, p = STAND_PITCH * deg;
      return [e[0] + Math.cos(yaw) * Math.cos(p) * 40, e[1] + Math.sin(p) * 40, e[2] + Math.sin(yaw) * Math.cos(p) * 40];
    })() },
    // Up at the arch, gable and pinnacles and all: level, the frame stops at
    // the springing of its hood and cuts off the carving above it.
    { eye: eye(spot[4], FLOOR), look: at(add(GATE, dir(330), 40), doorPropsOld(1) ? 45 : DOOR_STAND.lookY) },
    // at the end of the pergola, the waymark ahead where the gravel divides —
    // turned a few degrees right of it, to keep the waymark off the middle.
    //
    // Back from the stone the ways part at and a little left, so that both ways
    // leave it across the frame: to the Pavilion, under the moon, and to the
    // maze's mouth and its two lanterns. (Level enough that the moon over the
    // Pavilion is whole: forkFix.js, 1 and 6.)
    { eye: eye(spot[5], GRAVEL), look: forkOld(1) ? at(turnAbout(spot[5], add(J, dir(285), 30), 7), 13)
      : at(add(spot[5], dir(FORK_STAND.yaw), 40 * Math.cos(FORK_STAND.pitch * deg)), GRAVEL + EYE + 40 * Math.sin(FORK_STAND.pitch * deg)) },
    // on the bridge, the whole pavilion across the water — the roof's eave a
    // line against the sky, the finial whole, and the lanterns along the eave
    // all in the frame (pavilionFix.js, 8 and 5)
    { eye: eye(spot[6], DECK), look: at(PV, pavOld(8) ? 26 : PAV_STAND.lookY) },
    // at the gate of the court at the heart of the maze, looking in
    { eye: eye(spot[7], MAZE), look: at(HEART, paintings ? 21 : 23) },
  ];
  // (the file on its bridge keeps out of the edges of the Vestibule's first frame)
  if (walkers) walkers.watchFrom({ eye: stands[0].eye, look: stands[0].look, fov: 58 });
  const pavilionWalk = paintings ? [] : pavilionCrossing(BRIDGE, EYE);
  const pavilionSplit = pavilionWalk.reduce((nearest, p, i) =>
    dist([p[0], p[2]], spot[6]) < dist([pavilionWalk[nearest][0], pavilionWalk[nearest][2]], spot[6]) ? i : nearest, 0);
  const pavilionIn = paintings ? [] : [...pavilionWalk.slice(0, pavilionSplit), eye(spot[6], DECK)];
  const pavilionVisit = paintings ? [] : [eye(spot[6], DECK), ...pavilionWalk.slice(pavilionSplit + 1)];
  const northWalk = paintings ? [] : pavilionCrossing(NORTH_BRIDGE, EYE);
  const northAxis = unit(N_SHORE, NORTH_BRIDGE[1]);
  const northEntry = [
    eye(add(N_SHORE, northAxis, -10), GRAVEL),
    eye(add(N_SHORE, northAxis, -5.4), 6.9),
    eye(add(N_SHORE, northAxis, -3.6), 6.7),
    eye(N_SHORE, DECK),
  ];
  // The way on from the Pavilion goes in, once round the table, and out again
  // by the bridge it came over; the second bridge is there to be found. Out
  // over it to the landing it comes down on — a few paces of gravel and a hedge
  // — and back would be twenty-five seconds of a fifty-six second walk spent
  // going to a dead end and returning from it. (?wpavway=old: over it and
  // back.)
  const pavilionThrough = paintings ? [] : Q.get('wpavway') !== 'old' ? [
    ...pavilionVisit,
    ...pavilionRound(pavilionVisit.at(-1), EYE).slice(1),
    ...pavilionVisit.slice(0, -1).reverse(), ...pavilionIn.slice(0, -1).reverse(),
  ] : [
    ...pavilionVisit,
    ...pavilionInterior(pavilionVisit.at(-1), northWalk.at(-1), EYE).slice(1),
    ...northWalk.slice(0, -1).reverse(),
    ...northEntry.slice(0, -1).reverse(),
    // The north bridge meets the lawn. Take its steps before coming back
    // through the opposite side of the room and continuing towards the maze.
    ...northEntry.slice(1), ...northWalk.slice(1),
    ...pavilionInterior(northWalk.at(-1), pavilionVisit.at(-1), EYE).slice(1),
    ...pavilionVisit.slice(0, -1).reverse(), ...pavilionIn.slice(0, -1).reverse(),
  ];
  const legs = [
    { kind: 'walk', points: way(FLOOR, [spot[0], ...[135, 120, 105, 90, 75, 60, 45, 30, 15, 0, -15, -30].map(vestibuleMiddle), ring(C0, 330, 84), hallMid(0, 0, 5), ring(C1, 150, ECHO_A - 2.6), ...[150, 165].map(echoMiddle), spot[1]]) },
    { kind: 'walk', points: [
      eye(spot[1], FLOOR),
      ...echoFoot,
      // Finish the flight along its axis before turning into the aisle.
      ...echoStair,
      ...way(FLOOR, [add(C1, [ECHO_SPAN + 3, 0]), ...[-15, -30].map(echoMiddle), ring(C1, 330, ECHO_A - 2.6), hallMid(1, -1, 5), ring(C2, 150, 84), ...[150, 135, 120, 105].map(silenceMiddle), spot[2]]),
    ] },
    { kind: 'walk', points: [
      // Onto the stair square, a few degrees in from where it starts: the
      // mouth is open from 156° but the stair only begins at 170°, and from
      // 164° the way's last run cut across the corner of the open mouth.
      ...way(FLOOR, [spot[2], ...[75, 60, 45, 30, 15, 0, -15, -30].map(silenceMiddle), ring(C2, 330, 84), hallMid(2, -2, 5), ring(PIT, 150, 94), ...[150, 163, 176].map(vertigoMiddle), ring(PIT, 176, 76)]),
      // Follow the spiral's middle closely instead of taking long chords
      // towards its open edge between a few widely spaced stair samples.
      ...Array.from({ length: 11 }, (_, i) => onStair((i + 1) * 0.005)), stands[3].eye,
    ],
      // Free walking continues down the same stair after the composed stand.
      // The tour still arrives at the broken rail, where its fall begins.
      followThrough: Array.from({ length: 188 }, (_, i) => onStair(0.065 + i * 0.005)),
      // ...but walked on from the stand, the way by default (World.jsx's
      // FOLLOW) is not on down the stair: it bends in across the tread to
      // where the rail has given way, a few steps on, and ends facing out
      // over the edge — so that a reader who only keeps walking comes to the
      // edge, looks over, and goes over if they keep on. The stair down is
      // there to be chosen (turn onto it). (?wbrink=old: the way goes on down.)
      brink: BRINK_OLD ? null : [[0.0632, 6.6], [0.0655, 5.4], [0.0668, 4.2]].map(([t, r]) => {
        const st = stairAt(t);
        return at(add(PIT, dir(st.a), st.edge + r), st.tread + EYE);
      }),
    },
    // off the stair where its rail has given way (0.06 is inside the Vertigo's GAP)
    { kind: 'fall', edge: onEdge(0.06), center: PIT, bottom: -430 },
    { kind: 'walk', points: [
      ...way(FLOOR, [spot[4], doorLane(0), doorLane(50)]),
      // (none of it past the stand, which is further back since forkFix.js 1)
      ...way(GRAVEL, [doorLane(A), ...[0.2, 0.5, 0.8].map((t) => lerp2(PERGOLA0, J, t)).filter((p) => dist(p, J) > dist(spot[5], J) + 4), spot[5]]),
    ] },
    { kind: 'walk', points: [
      ...way(GRAVEL, [spot[5], ...PAVILION_PATH.slice(0, -1)]),
      ...bridgeEntry, ...(paintings ? hug(DECK, [SHORE, BRIDGE[1], spot[6]]).slice(1) : pavilionIn.slice(1)),
    ] },
    { kind: 'walk', points: [
      // Through the room and onto its other bridge, with continuous guidance.
      ...(paintings ? hug(DECK, [spot[6], BRIDGE[1], SHORE]) : pavilionThrough),
      ...bridgeEntry.slice(0, -1).reverse(),
      // Clear the bridge's stone step along its axis before following the
      // shore path. End on the maze's approach, square to its entrance.
      ...way(GRAVEL, SHORE_PATH),
      // (no further in than the stand: the court is the finale's)
      ...hug(MAZE, [[MAZE_ENTRY[0], MAZE_ENTRY[1] - 6], ...pathToPoint(mazeRoute, spot[7])], 4),
    ] },
  ];
  return { stands, legs };
}

export function buildWornFloor(ctx) {
  const { dir, add, dist, keep, M, root, wornRibbon, A, D, HALL, WAY_IN, cellC, ECHO_A, inGarden,
    EYE, FLOOR, legs } = ctx;
  // ── Where the walk has worn the floor ─────────────────────────────────────
  // The walk's own line through the galleries, laid on the pavement as stone
  // walked smooth: every room had one grid from wall to well and nothing on it
  // to say where people go. Only where the walk is on a gallery floor — not on
  // a stair, not out on the gravel.
  {
    const runs = [];
    for (const leg of legs) {
      if (leg.kind !== 'walk') continue;
      let run = [];
      const flush = () => { if (run.length > 1) runs.push(run); run = []; };
      for (const q of leg.points) {
        if (Math.abs(q[1] - (FLOOR + EYE)) < 0.01 && !inGarden([q[0], q[2]])) run.push(new THREE.Vector3(q[0], 0, q[2]));
        else flush();
      }
      flush();
    }
    const geos = [];
    // the hallway the way in is dressed as (WAY_IN): along it, how far past its far end
    // (the Echo's face, which stands out into its walls: the hallway is `hall` long)
    const far = add(cellC(0, 0), dir(150), D - ECHO_A), along = dir(150), hall = D - ECHO_A - A;
    const pastFar = (p) => (p[0] - far[0] - WAY_IN.by[0]) * along[0] + (p[1] - far[1] - WAY_IN.by[1]) * along[1];
    const acrossFar = (p) => Math.abs((p[0] - far[0] - WAY_IN.by[0]) * -along[1] + (p[1] - far[1] - WAY_IN.by[1]) * along[0]);
    for (const pts of runs) {
      const curve = makeWalkCurve(pts);
      const line = curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / 2))).map((v) => [v.x, v.z]);
      geos.push(wornRibbon(line, 9, 6.12));
      // The way in is worn as that hallway is — by everyone who ever came in.
      let run0 = 0, from = -1, to = -1;
      line.forEach((p, i) => {
        if (pastFar(p) > -hall - 3 && pastFar(p) < 3 && acrossFar(p) < HALL) { if (from < 0) from = i; to = i; }
      });
      if (from >= 0 && to > from) {
        for (let i = 1; i <= from; i++) run0 += dist(line[i - 1], line[i]);
        geos.push(wornRibbon(line.slice(from, to + 1), 9, 6.12, { run0, moveBy: [-WAY_IN.by[0], -WAY_IN.by[1]] }));
      }
    }
    if (geos.length) {
      const m = new THREE.Mesh(keep(mergeGeometries(geos)), M.wornFloor);
      geos.forEach((g) => g.dispose());
      m.name = 'wornPath';
      m.renderOrder = 1;
      root.add(m);
    }
  }
}

export function buildWaterView(ctx) {
  const { dist, water, glows, waterLamps, POND, PV, POOLS } = ctx;
  // ── What the water has to look at ─────────────────────────────────────────
  // Every lit thing in the world offers itself to the pond, and the few that
  // would actually show in it are the ones it keeps. A lamp in water is not a
  // point but a broken column of light running towards the eye (water.js), and
  // the eight lanterns round the Pavilion's eaves are the whole of that room —
  // so they are handed to the water directly rather than made into real lights,
  // which would cost the entire frame to light nothing else.
  {
    const bodies = [POND, ...POOLS.map((o) => ({ c: o.c, rx: o.r, rz: o.r }))];
    const reach = (g) => Math.max(...bodies.map((b) => {
      const flat = Math.max(0, dist([g.p[0], g.p[2]], b.c) - Math.max(b.rx, b.rz));
      return 1 / (1 + (flat * flat + (g.p[1] - 6.5) ** 2) * 0.00045);
    }));
    // One lamp, once. The Pavilion's table lamp is both a glow and a water
    // lamp, and handed over as both it would lay a column twice as bright as
    // any other lamp's — a sheet of gold on the water in front of the Fork's
    // stand. The stronger of the two stands for it.
    const one = [];
    for (const g of [...glows, ...waterLamps]) {
      const twin = one.find((o) => Math.hypot(o.p[0] - g.p[0], o.p[1] - g.p[1], o.p[2] - g.p[2]) < 1);
      if (!twin) one.push(g);
      else if ((g.k ?? 1) > (twin.k ?? 1)) one[one.indexOf(twin)] = g;
    }
    one.map((g) => ({ g, seen: reach(g) }))
      .filter((e) => e.seen > 0.06)
      .sort((a, b) => b.seen - a.seen)
      .slice(0, 12)
      .forEach(({ g }) => water.addLamp([g.p[0], g.p[2]], g.p[1], g.color, g.k ?? 1));
    // and the Pavilion's lit columns, for the chop to break up (gardenFix5.js, 7)
    if (POND_GLOW.on) water.setGlow([PV[0], 30, PV[1]], POND_GLOW.glow.color);
  }
}

export function buildEnding(ctx) {
  const { paintings, light, dir, add, disposables, keep, glowTex, water, wind, setWay, M, root,
    pools, halos, lightWishes, R, D, HALL, ARCH_SPRING, ARCH_R, WAY_IN, cellC, ECHO_A, mirrors,
    candleLights, mounts, archGeo, vault, walkers, PIT, pitCore, pitSink, spiral, drift, ENTRANCE,
    beltLight, heartParts, J, POND, MZ, MAZE_ENTRY, HEART, COURT, COURT_HALF, POOLS, ROAD,
    armillary, mazeGrid, mazeRects, beltLeaf, mist, sparkles, hemi, moon, poolShadows,
    takeShadowRequest, setLightBudget, twins, placeLights, updateLights, isTwinning, setVeil, cull,
    at, overlay, EYE, FLOOR, GRAVEL, MAZE, heartFrom, stands, legs } = ctx;
  // ── How the walk ends (finale.js) ─────────────────────────────────────────
  // The light at the heart runs back along the walk: every leg the reader
  // walked, backwards and on the ground, from the maze's mouth to the
  // Library's door — and between the Door and the Vertigo, where the walk is a
  // fall, along the arc the map draws for it — and out down the road not taken.
  let finale = null;
  if (!paintings && mazeGrid) {
    const ground = (p) => [p[0], p[1] - EYE + 1.2, p[2]];
    const back = (i) => [...legs[i].points].reverse().map(ground);
    // The leap from the Door back up to where the reader stood on the
    // Vertigo's stair, arched as the map arches the fall (the map's own arc
    // ends in the middle of the well, and the thread came out of it in a V).
    const door = back(4).at(-1), stair = back(2)[0];
    const ctrl = [(door[0] + stair[0]) / 2 + 40, 260, (door[2] + stair[2]) / 2 - 60];
    const leap = Array.from({ length: 33 }, (_, s) => {
      const t = s / 32, u = 1 - t;
      return [0, 1, 2].map((k) => u * u * door[k] + 2 * u * t * ctrl[k] + t * t * stair[k]);
    });
    finale = buildFinale({
      root, keep, light,
      maze: { MZ, grid: mazeGrid, rects: mazeRects, court: COURT, heart: HEART, ground: MAZE, entry: MAZE_ENTRY },
      stand: stands[7],
      // (far enough off the armillary to see it whole: at 16 its rings filled the frame)
      inside: add(HEART, heartFrom, -28),
      route: [
        at(MAZE_ENTRY, MAZE + 1.2),
        ...back(6).filter((p) => p[2] < MZ.z0 - 3),
        ...back(5), ...back(4),
        ...leap,
        ...back(2), ...back(1), ...back(0),
        at(ENTRANCE, FLOOR + 1.2),
      ],
      branch: { at: J, pts: ROAD.pts.slice(1).map((p) => at(p, GRAVEL + 1.2)) },
      glowTex,
      heartParts,
    });
    finale.room = stands.length - 1;
    // how far the court runs either side of the heart, for a reader who walks
    // into it on their own (World.jsx's free walk sets the finale off there)
    finale.court = COURT_HALF;
  }

  // ── The way in opens onto the Echo (doorway.js) ───────────────────────────
  // The hallway out of the back of the Vestibule — the way in — ran on into a
  // hexagon nobody has dressed. Its far end opens instead onto the Echo,
  // through the Echo's far door: two hallways along the honeycomb is the one
  // between the Silence and the Echo, the same stone walked the same way. A
  // reader walking out of the Vestibule's back comes into the Echo from the
  // Silence's side; turned round inside, the hallway behind them leads to the
  // Silence. The Library does not add up.
  //
  // (The doorway stands where the Echo's face would be: the Echo stands out
  // into its walls, so its hallways are shorter, and the way in opens that
  // much short of its own end, the last of it sealed behind the doorway.)
  const doorways = paintings ? [] : [makeDoorway({
    root, keep,
    at: add(cellC(0, 0), dir(150), D - ECHO_A + 0.05),
    out: dir(150),
    half: HALL / 2 + 1,
    floor: FLOOR - 1,
    top: ARCH_SPRING + ARCH_R + 2,
    by: WAY_IN.by,
  })];
  // (a doorway's face is painted for the reader's own eye: out of every glass)
  const mirrorHide = root.children.filter((o) => o.name === 'doorway');
  // every lamp on the far side with one standing where it would be on this side
  for (const d of doorways) {
    for (const w of lightWishes) {
      const t = lightWishes.find((o) => o !== w && Math.abs(o.x - (w.x - d.by[0])) < 1 && Math.abs(o.z - (w.z - d.by[1])) < 1 && Math.abs(o.y - w.y) < 1);
      if (t) twins.set(w, t);
    }
  }
  // Set what is drawn for an eye — the halos, the lamps — for the far eye a
  // doorway is drawing from (`at`), or back for the reader's own (`at` null,
  // `eye` the reader's).
  const aimFar = (at, eye) => {
    aimHalos(at ?? eye, !at);
    placeLights(at ? false : isTwinning());
    // the light columns thinned with the fog, for the far eye only
    const k = at ? portalThin(eye) : 1;
    if (!hazeMats) {
      hazeMats = [];
      root.traverse((o) => {
        const m = o.material;
        if (m?.uniforms?.uStrength && m.uniforms.uSoft && !hazeMats.some((h) => h.mat === m)) hazeMats.push({ mat: m, base: m.uniforms.uStrength.value });
      });
    }
    for (const h of hazeMats) h.mat.uniforms.uStrength.value = h.base * k;
  };
  // How much of its haze the room through the Vestibule's way in is drawn with,
  // for a reader whose eye is at `eye`. With all of it, through the arch the
  // Echo is the brightest and the greyest thing in the Vestibule's first frame:
  // its moon shaft and its fog, seen down the length of the room, lift its
  // blacks to milk. Seen from across the room it keeps half of them; walking up
  // to the arch it gets them all back, so that by the step through — where the
  // doorway has to be the room itself — it is the room itself (vestFix.js, 3;
  // ?wvest=old:3).
  const portalThin = (eye) => {
    if (vestOld(3) || !eye || !doorways.length) return 1;
    const at = doorways[0].at;
    const d = Math.hypot(eye.x - at[0], eye.z - at[1]);
    const t = Math.min(1, Math.max(0, (d - 14) / 38));
    return 1 - 0.5 * t * t * (3 - 2 * t);
  };
  // (every light column's material and its own strength, gathered the first time)
  let hazeMats = null;

  const coreColor = new THREE.Color('#ffe4b4');
  // The widest a halo may look from the walk: its full width over its distance,
  // so 0.73 is ±20° either side of the lamp.
  const HALO_REACH = OLD_GLARE ? Infinity : 2 * Math.tan(20 * deg);
  // `eye`, the camera's position: up close — walking under a lamp — a halo would
  // be a wash of light over everything, so it gives way.
  // The halos are seen from an eye: their size and strength are set for it.
  // `aimHalos` again for another eye (a doorway drawing the room beyond it,
  // doorway.js) and back, between the frame's drawings.
  let haloT = 0;
  let eyeAmount = 0;
  // ── A halo hidden by what stands in front of its lamp ───────────────────────
  // A halo is drawn with depthTest off, so that it lies over the stone its lamp
  // lights; and so a lamp behind a column, a wall or a flight of stairs would
  // lay its glow over them as if nothing were there. Each halo in front of the
  // eye is asked whether its lamp can be seen — one line a frame, to its middle
  // and then either side of it in turn, so a post takes a third of it and not
  // all — four halos a frame, and none again from where the eye already asked
  // them all three; each fades to what can be seen (`seen`). A line costs a
  // fifth of a millisecond here. `sight`: the body's line of sight (body.js),
  // handed in by World.jsx. ?wlampsoff=occlude: no halo hidden.
  let sight = null;
  const setSight = (fn) => { sight = LAMPS.occlude ? fn : null; };
  let seenNext = 0, seenT = -1;
  const toLamp = new THREE.Vector3(), aside = new THREE.Vector3(), seenAt = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const SIDE = [0, 1, -1];
  const occlude = (t, eye, gaze) => {
    const dt = seenT < 0 ? 0 : Math.min(0.1, Math.max(0, t - seenT));
    seenT = t;
    if (!sight || !eye || !halos.length) return;
    let asked = 0, n = 0;
    for (; n < halos.length && asked < 4; n++) {
      const h = halos[(seenNext + n) % halos.length];
      toLamp.subVectors(h.sprite.position, eye);
      const d = toLamp.length();
      if (d < 1 || d > 900 || (gaze && toLamp.dot(gaze) < d * 0.3)) continue;
      if (!h.from || h.from.distanceToSquared(eye) > 2.25) {
        (h.from ??= new THREE.Vector3()).copy(eye);
        h.tries = 0;
        h.open ??= [1, 1, 1];
      } else if (h.tries >= 3) continue;
      asked++;
      // (stopping short of the lamp, so its own fitting is never in the way)
      const r = Math.max(1.2, h.size * 0.05), short = Math.max(1.6, h.size * 0.08);
      aside.crossVectors(toLamp, UP).normalize().multiplyScalar(r * SIDE[h.tries % 3]);
      seenAt.copy(h.sprite.position).add(aside);
      h.open[h.tries % 3] = sight(eye, seenAt, short) ? 1 : 0;
      h.tries++;
      h.seenTo = (h.open[0] + h.open[1] + h.open[2]) / 3;
    }
    seenNext = (seenNext + n) % halos.length;
    const ease = Math.min(1, dt * 8);
    for (const h of halos) h.seen += (h.seenTo - h.seen) * ease;
  };
  // (`own`: the eye is the reader's — a doorway drawing a far room has none of this)
  const aimHalos = (eye, own = true) => {
    const t = haloT;
    for (const h of halos) {
      let o = h.base * (1 + Math.sin(t * 0.9 + h.phase) * 0.05);
      let size = h.size;
      if (eye) {
        const d = eye.distanceTo(h.sprite.position);
        // down among the walls the bloom already carries a lamp; the halo only helps
        o *= 0.55 * THREE.MathUtils.smoothstep(d, h.size * 0.2, h.size * 0.75);
        if (own) o *= h.seen;
        // A glow round a light is seen at an ANGLE, not measured in the room:
        // sized in world units, a gallery lamp's halo fifty units off spread
        // ±44° from it and washed a whole quarter of the frame from the Echo's
        // crossing. Held to HALO_REACH it stays a glow about the glass.
        if (h.lamp) size = Math.min(size, d * HALO_REACH);
      }
      // The overview reads as a map; the floating glows belong inside rooms.
      h.sprite.visible = eyeAmount > 0;
      h.mat.opacity = o * eyeAmount;
      h.sprite.scale.set(size, size, 1);
    }
  };
  // While the reader falls down the Vertigo's well, or climbs back up out of
  // it, the light at the bottom stays where it was when they went (true); it
  // keeps its distance below the eye again after (false).
  let pitHeld = null;
  const holdPit = (on) => { pitHeld = on && pitCore ? (pitHeld ?? pitCore.position.y) : null; };
  // `aspect`: the frame's width over its height (the file on the Vestibule's
  // bridge keeps out of its edges: walkers.js)
  const tick = (t, eye, gaze, aspect = 0) => {
    // (the belt's leaf takes its light from the world's own lights, as they
    // stand this frame: webProps.js, 2)
    if (beltLeaf) {
      beltLight.uBackMoon.value.copy(moon.color).multiplyScalar(moon.intensity);
      beltLight.uBackMoonDir.value.copy(moon.position).sub(moon.target.position).normalize();
      beltLight.uBackSky.value.copy(hemi.color).multiplyScalar(hemi.intensity);
      beltLight.uBackGround.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity);
      beltLight.uBackFill.value.setRGB(...BELT.fill).multiplyScalar(root.parent?.environmentIntensity ?? 1);
    }
    // A lamp breathes; it does not flicker. Fast terms — 11 and 6 radians a
    // second, about two a second — read as blinking, and a pool of light on
    // stone has no business doing that.
    for (const p of pools) {
      const n = Math.sin(t * 1.15 + p.phase) * 0.6 + Math.sin(t * 2.6 + p.phase * 1.7) * 0.4;
      p.mat.opacity = p.base * (1 + n * p.amount * 0.55);
    }
    // (the Door's candles: the flames move, and their light on the piers with them)
    M.lpFlame.uniforms.uTime.value = light ? 0 : t;
    for (const c of candleLights) c.wish.intensity = c.base * (1 + DOOR_CANDLES.breath * (light ? 0 : 0.6 * Math.sin(t * 1.3 + c.phase) + 0.4 * Math.sin(t * 2.9 + c.phase * 2.1)));
    haloT = t;
    occlude(t, eye, gaze);
    aimHalos(eye);
    if (armillary) {
      armillary.rotation.y = t * 0.22;
      armillary.children[1].rotation.y = t * 0.5;
    }
    // (after the armillary and the heart's halo: the finale's share laid over them)
    if (finale) finale.tick(light ? 0 : t);
    if (pitCore) {
      pitCore.material.color.copy(coreColor).multiplyScalar(1.35 + Math.sin(t * 1.3) * 0.12);
      // (held where it is while the reader falls toward it or climbs out of
      // it — `holdPit` — or the light would flee the fall all the way down)
      const below = pitHeld ?? (eye && Math.hypot(eye.x - PIT[0], eye.z - PIT[1]) < 101 ? Math.min(-453, eye.y - 420) : -453);
      pitCore.position.y = below;
      pitSink?.(below + 453);
    }
    if (drift) drift(light ? 0 : t);
    if (vault) vault(t, eye, gaze);
    if (walkers) walkers.tick(t, eye, aspect);
    for (const f of mist) {
      f.m.position.x = f.home[0] + Math.sin(t * f.speed + f.phase) * f.reach;
      f.m.position.z = f.home[1] + Math.cos(t * f.speed * 0.73 + f.phase * 1.3) * f.reach * 0.6;
    }
    sparkles.forEach((points) => { points.material.uniforms.uTime.value = light ? 0 : t; });
    water.tick(t);
    wind.value = light ? 0 : t;
  };

  // Points are sized in world units; this is the pixels per unit at distance 1.
  const setViewport = (pixelsPerUnit) => {
    sparkles.forEach((points) => { points.material.uniforms.uScale.value = pixelsPerUnit; });
    water.setViewport(pixelsPerUnit);
    if (finale) finale.setViewport(pixelsPerUnit);
  };

  const setPainting = (index, texture) => {
    const mount = mounts[index];
    if (!mount) return;
    mount.material.map = texture;
    mount.material.color.set('#ffffff');
    mount.material.needsUpdate = true;
  };

  const dispose = () => {
    spiral?.dispose();
    water.dispose();
    doorways.forEach((d) => d.dispose());
    archGeo.dispose();
    disposables.forEach((d) => d.dispose?.());
    root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  };

  // Fade halos in on the way down from the map; inside rooms, walls hide them.
  let eyeLevel = false;
  const setEye = (amount) => {
    eyeAmount = amount;
    const down = amount > 0.5;
    if (down === eyeLevel) return;
    eyeLevel = down;
    halos.forEach((h) => { h.mat.depthTest = down; });
    if (finale) finale.setEyeLevel(down);
  };

  // How far the eye is from the nearest open water — what tells the mirror
  // pass whether it is worth drawing the world a second time this frame.
  const ponds = [POND, ...POOLS.map((o) => ({ c: o.c, rx: o.r, rz: o.r }))];
  const toWater = (eye) => Math.min(...ponds.map((b) => Math.max(0,
    Math.hypot(eye.x - b.c[0], eye.z - b.c[1]) - Math.max(b.rx, b.rz))));

  const pit = { x: PIT[0], z: PIT[1], r: 101 };
  // the Silence, where the fill is let down so that its one lamp carries the room
  const hush = { x: cellC(2, -2)[0], z: cellC(2, -2)[1], r: R };
  return { root, moon, hemi, mounts, stands, legs, overlay, pit, spiral, hush, water, toWater, finale, doorways, mirrors, mirrorHide, aimFar, portalThin, walkers, tick, holdPit, setPainting, setVeil, setEye, setWay, updateLights, setLightBudget, takeShadowRequest, cull, setViewport, setSight, poolShadows, dispose };
}
