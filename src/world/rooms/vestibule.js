// I — the Vestibule (buildWorld.js, assembleWorld): a bridge over a wide
// shaft, a file of readers on it, and the library over it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildVestibuleBridge } from '../vestibuleBridge';
import { makeBookMaterial, BOOKS_GIANT, spineAt, titleAt } from '../effects';
import { buildWalkers } from '../walkers';
import { vestOld } from '../vestFix';
import { WOOD_OLD } from '../woodGrain';
import { deg, MASS_H, CAP, BOOK_ROWS } from '../build/common';

export function buildVestibule(ctx) {
  const { light, rr, dir, add, keep, wood, spines, titles, bookRowsSet, rowV, Std, M, root, boxGeo,
    placed, profileGeo, rodGeo, wornRibbon, R, A, cellC, RAIL_OLD, BRIDGE_LEVEL, mouldGeo, patchOf,
    pedestalGeo, VEST_RAIL, stoneRail, LB, balusters, BOOKS, alongWall, lamp } = ctx;
  let vault = null;   // the library over the Vestibule, raised by the reader's gaze in tick
  let walkers = null; // the readers walking the Vestibule's bridge, moved by tick
  // I — the Vestibule: a bridge over a wide shaft, a file of readers on it.
  {
    const c = cellC(0, 0), ax = dir(30), px = dir(120);
    const a = add(c, ax, -55), b = add(c, ax, 55);
    // "A bridge of stone carries a file of readers across the dark on its own
    // arch" — so it has one. A segmental arch springing off the lip of the well
    // at ±44, two courses thick at the crown and eight at the springing, with
    // the deck laid over it. It was a flat slab 110 long and 6 thick, and being
    // the first thing seen in the first room it was a quarter of the frame of
    // untextured brown.
    const soffit = [];
    for (let k = 0; k <= 26; k++) {
      const u = 44 - (k / 26) * 88;
      soffit.push([u, 4 - 26 * (u / 44) ** 2]);
    }
    if (!BRIDGE_LEVEL) LB.step.add(profileGeo([[-55, -34], [-55, 12], [55, 12], [55, -34], [44, -34], ...soffit, [-44, -34]], 17, c, 30));
    // a moulded string course along each edge of the deck, and the keystone
    for (const side of BRIDGE_LEVEL ? [] : [-1, 1]) {
      LB.cap.add(boxGeo(add(a, px, side * 8.6), add(b, px, side * 8.6), 1.6, 2.2, 10.4));
      LB.cap.add(boxGeo(add(a, px, side * 9.2), add(b, px, side * 9.2), 1.2, 1.4, 9.2));
    }
    for (const side of BRIDGE_LEVEL ? [] : [-1, 1]) {
      LB.cap.add(placed(new THREE.BoxGeometry(5, 7, 2.6), add(c, px, side * 8.7), 6, 30 * deg));
    }
    // A stone balustrade along each side of the deck, on the string course:
    // five pedestals a side — one over the keystone, where the arch is
    // highest, one at each end with a ball on it, and two halfway between —
    // and the plinth, balusters and handrail run between them.
    // (?wrail=old: the bronze handrail on posts it replaced; it is the
    // raised bridge's, ?wbridge=old: see vestibuleBridge.js)
    if (!RAIL_OLD && !BRIDGE_LEVEL) {
      const ry = -30 * deg, DECK = 12, TOP = 20.6, PEDS = [-52, -26, 0, 26, 52];
      for (const side of [-1, 1]) {
        const at = (u) => add(add(c, ax, u), px, side * 8.3);
        PEDS.forEach((u, i) => {
          // (let down onto the lower string, or the overhang of its base
          // shows a slot of dark under it from the floor)
          LB.balustrade.add(placed(pedestalGeo(VEST_RAIL.ped, VEST_RAIL.baseH - VEST_RAIL.sink, TOP + 0.1 - DECK,
            { ball: Math.abs(u) === 52, sunk: 1.5, shift: patchOf(at(u)) }), at(u), DECK, ry));
          if (i) {
            stoneRail(LB.balustrade, {
              at, foot: () => DECK, top: () => TOP, knots: [PEDS[i - 1], u],
              clear: [VEST_RAIL.ped / 2 + 0.25, VEST_RAIL.ped / 2 + 0.25], ry: () => ry, S: VEST_RAIL,
            });
          }
        });
      }
    }
    // Level with the floor, and of a piece with the room (the default).
    if (BRIDGE_LEVEL) buildVestibuleBridge({ c, ax, px, LB, placed, mouldGeo, balusters, wornRibbon });
    // a bronze handrail on posts, rather than a bar floating in the air
    for (const side of RAIL_OLD ? [-1, 1] : []) {
      const rail0 = add(a, px, side * 8), rail1 = add(b, px, side * 8);
      LB.bronze.add(rodGeo([rail0[0], 20, rail0[1]], [rail1[0], 20, rail1[1]], 0.7));
      LB.bronze.add(rodGeo([rail0[0], 15.5, rail0[1]], [rail1[0], 15.5, rail1[1]], 0.35));
      for (let u = -52; u <= 52; u += 13) {
        const q = add(add(c, ax, u), px, side * 8);
        LB.bronze.add(placed(new THREE.CylinderGeometry(0.55, 0.7, 8.4, 8), q, 16.2));
        // A ball only where the rail ends. One on every post was a row of
        // knobs along the bridge, a toy's rail; between, a collar where the
        // rail passes over the post.
        if (Math.abs(u) === 52) LB.bronze.add(placed(new THREE.SphereGeometry(0.95, 10, 8), q, 20.6));
        else LB.bronze.add(placed(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 10), q, 19.1));
      }
    }
    // A FILE of readers, not a queue. Seven at thirteen apart stood shoulder to
    // shoulder across the whole width of the frame — a row of near-identical
    // dark blobs with no gap to see the bridge, the arch or the far side
    // through. Four, spread down the length of it, read as people crossing:
    // the eye gets between them, and the bridge gets to be a bridge. They
    // walk it now (walkers.js, built under the lectern below). Their old
    // places' draws stay: the world's random stream is shared, and everything
    // built after this would otherwise be shuffled.
    for (let k = 0; k < 4; k++) { rr(-2, 2); rr(-1.2, 1.2); rr(0, Math.PI * 2); }
    // Low, and only these two: "two lamps keep the gap they cross". Hung at
    // lamp height with the rest they lit the whole hexagon evenly and the room
    // became the same room as the Echo — these sit just above the readers'
    // heads, so the bridge is an island of light and the gallery falls away.
    // (their pools laid on the floor, as the reading corner's is: at the
    // default 6.6 they drew a pale sock round the foot of every leg in the room)
    // (their halos turned down as the lamps by the other stands are: at the
    // full 111 units across, the near one's laid a pale band down the whole
    // bay of shelves behind it, from the top of the frame to the rail, which
    // read as a smear on the lens — review 2026-10-08, point 6)
    const BRIDGE_HAZE = vestOld(6) ? 1 : 0.45;
    lamp(add(c, ax, -64), { y: 42, light: 9000, priority: 8, strength: 1.3, pool: 0.42, poolSize: 150, poolY: 6.15, haze: BRIDGE_HAZE });
    lamp(add(c, ax, 64), { y: 42, light: 9000, priority: 5, strength: 1.3, pool: 0.42, poolSize: 150, poolY: 6.15, haze: BRIDGE_HAZE });
    // The deck walked smooth down its middle: the file has been crossing it
    // for a very long time.
    if (!BRIDGE_LEVEL) LB.wornStep.add(wornRibbon([add(c, ax, -54), add(c, ax, 54)], 7, 12.03));
    // A reader who has stopped. Under the first lamp, where the bridge comes
    // down to the floor, a lectern with a folio open on it and one of the file
    // turned aside to read it: the readers were only ever walking past.
    {
      const at = add(c, ax, -67), ry = Math.atan2(ax[0], ax[1]), tilt = 0.42;
      const parts = [
        new THREE.BoxGeometry(4.2, 0.8, 4.2).translate(0, 6.4, 0),
        new THREE.CylinderGeometry(0.75, 0.95, 9, 12).translate(0, 11.3, 0),
        new THREE.BoxGeometry(3, 0.8, 2.4).translate(0, 16.2, 0),
        new THREE.BoxGeometry(6.6, 0.45, 4.8).rotateX(tilt).translate(0, 17.3, 0),
        new THREE.BoxGeometry(6.6, 0.6, 0.45).translate(0, 16.6, 2.1),
      ];
      LB.shelf.add(placed(mergeGeometries(parts), at, 0, ry));
      parts.forEach((g) => g.dispose());
      const folio = [-1, 1].map((side) => new THREE.BoxGeometry(3.1, 0.5, 4.1).translate(side * 1.62, 0.25, 0).rotateZ(-side * 0.07));
      LB.paper.add(placed(mergeGeometries(folio).rotateX(tilt).translate(0, 17.62, 0), at, 0, ry));
      folio.forEach((g) => g.dispose());
      walkers = buildWalkers({
        root, keep, c, ax, px, deck: BRIDGE_LEVEL ? 6 : 12, light,
        lectern: { at: add(c, ax, -61.2), y: 6, face: Math.atan2(-ax[0], -ax[1]) },
        // (the way out to the Echo, lit from beyond: a little inside its arch)
        arch: [c[0] + dir(330)[0] * (A + 16), 38, c[1] + dir(330)[1] * (A + 16)],
      });
    }
    // The card catalogue, at the other end of the wall with the reading table:
    // six drawers across and seven high, each the size a drawer of index
    // cards is (15 × 11 cm), with a brass frame for its card and a pull under
    // it, the case on a stand with the reference slide drawn out. (It had
    // four drawers across and six high, 26 cm wide, with 10 cm labels: from
    // the floor it read as a chest of drawers, and the labels as pale tiles.)
    {
      const { on, turn } = alongWall(c, 4);
      const COLS = 6, ROWS = 7, DW = 1.6, DH = 1.15, ST = 0.12, SIDE = 0.3, DP = 5, LEGS = 2.2;
      const W = COLS * DW + (COLS + 1) * ST + 2 * SIDE, H = ROWS * DH + (ROWS + 1) * ST;
      const Y0 = 6 + LEGS + 0.4;
      const carcass = [
        new THREE.BoxGeometry(W, H, DP).translate(0, Y0 + H / 2, 0),
        // a moulding under an overhanging top, and the plinth it stands on
        new THREE.BoxGeometry(W + 0.36, 0.2, DP + 0.26).translate(0, Y0 + H + 0.1, 0.05),
        new THREE.BoxGeometry(W + 0.8, 0.4, DP + 0.6).translate(0, Y0 + H + 0.4, 0.1),
        new THREE.BoxGeometry(W + 0.3, 0.4, DP + 0.3).translate(0, Y0 - 0.2, 0),
        // the stand: an apron and four tapered legs
        new THREE.BoxGeometry(W - 0.5, 0.5, DP - 0.5).translate(0, 6 + LEGS - 0.25, 0),
      ];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          carcass.push(new THREE.CylinderGeometry(0.42, 0.28, LEGS, 4).rotateY(Math.PI / 4).translate(sx * (W / 2 - 0.45), 6 + LEGS / 2, sz * (DP / 2 - 0.45)));
        }
      }
      // the slide, drawn out of the plinth a hand's breadth
      const slide = [new THREE.BoxGeometry(W - 1.6, 0.18, DP).translate(0, Y0 - 0.2, 1.6)];
      const fronts = [], pulls = [new THREE.SphereGeometry(0.14, 8, 6).translate(0, Y0 - 0.2, DP / 2 + 1.7)], labels = [];
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          const x = -W / 2 + SIDE + ST + col * (DW + ST) + DW / 2, y = Y0 + ST + row * (DH + ST) + DH / 2;
          fronts.push(new THREE.BoxGeometry(DW - 0.04, DH - 0.04, 0.22).translate(x, y, DP / 2 + 0.06));
          pulls.push(new THREE.BoxGeometry(0.62, 0.32, 0.04).translate(x, y + 0.2, DP / 2 + 0.19));
          pulls.push(new THREE.BoxGeometry(0.46, 0.12, 0.14).translate(x, y - 0.25, DP / 2 + 0.24));
          labels.push(new THREE.BoxGeometry(0.5, 0.2, 0.03).translate(x, y + 0.2, DP / 2 + 0.215));
        }
      }
      const q = on(18, 18.8);
      for (const [batch, list] of [[LB.shelf, carcass], [LB.oak, [...fronts, ...slide]], [LB.bronze, pulls], [LB.paper, labels]]) {
        batch.add(placed(mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))), q, 0, turn));
        list.forEach((g) => g.dispose());
      }
    }
    // ── The library over the Vestibule ──
    // The room opens with nothing over it but the dark. Look up and the
    // library begins to climb out of it: a gallery of shelves spiralling up
    // from the wall tops, tread after tread, each turn a little further in
    // than the one below, so that looking up the eye goes round and round and
    // in, and the turns go on dimming into the dark until there is no telling
    // where they stop. It is built along the spiral: the treads, the shelves
    // and the rail first, then the books flying up out of the room onto them,
    // and all of it arriving as dark as it stays: nothing lights up as it
    // lands. Once begun it goes on by itself, and looking up hurries it.
    // Leave the room and it is gone again, so the Vestibule always opens on
    // the same empty dark.
    //
    // Its own random stream, not the world's: this is built in the middle of
    // the galleries, and every draw on the shared one would reshuffle
    // everything built after it (the garden with it).
    {
      let st = 0x5113ce;
      const vr = () => {
        st = (st + 0x6d2b79f5) | 0;
        let x = Math.imul(st ^ (st >>> 15), 1 | st);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
      const vrr = (a, b) => a + (b - a) * vr();
      const Y0 = MASS_H + CAP;
      // Nine turns, each 38 high and 12% narrower than the last: from the wall
      // tops to a throat a third as wide, 340 up. SEG treads to a turn.
      // Every turn is the turn below it made smaller: 12% narrower, 12% lower,
      // its shelves, books, rail and lamps all 12% smaller. So the turns do
      // not stop — they close in on a point 290 up, books to the last of them,
      // the way a picture of a library inside a picture of that library does.
      // (Built at one size and faded into black, the top of it was a dark lid,
      // and the reader could see where the library ended.)
      const TURNS = light ? 11 : 18, SEG = light ? 24 : 36, PITCH = 38, R0 = 97, SHRINK = 0.88;
      const SHELF = 8, WALK = 10, TREAD = 2.6;
      const N = TURNS * SEG, LN = -Math.log(SHRINK);
      const scale = (s) => SHRINK ** (TURNS * s);
      const radius = (s) => R0 * scale(s);
      // the height a tread is set at: each turn rises its own (shrunken) pitch
      const height = (s) => Y0 + (PITCH * (1 - scale(s))) / LN;
      const angle = (s) => 330 + 360 * TURNS * s;   // starts over the far wall, the one the stand faces
      // The hexagon's own edge along a bearing: where the first turn's treads
      // have to reach to close against the wall tops. The corners are at
      // 0, 60, 120… (hexPts) and the flats between them. (Measured from the
      // wrong one of the two, it reached out past the flats and fell short of
      // every corner, and the sky showed through at all six.)
      const edge = (a) => A / Math.cos(((((a % 60) + 60) % 60) - 30) * deg);
      // Dark from the first turn, darker going up, but never so dark that the
      // books go out: they have to be there to the end. (0.45 at the foot read
      // as a lit ceiling; this is under half of that, and the books are
      // dimmed through their gilt as well as their leather — see `bookMat`.)
      const fade = (s) => 0.07 + 0.13 * Math.exp(-1.8 * s);

      const UP = new THREE.Vector3(0, 1, 0);
      const pieces = { wood: [], stone: [], bronze: [], lamps: [], books: [], rows: [] };
      // A piece: its place, where it comes from, and when in the build it
      // sets off. `inward` is the unit vector toward the axis at its bearing.
      const put = (kind, center, inward, size, color, order, { from = null, tilt = 0 } = {}) => {
        const z = inward.clone(), x = new THREE.Vector3().crossVectors(UP, z).normalize();
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, UP, z));
        if (tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
        const away = from ?? new THREE.Vector3(vrr(-10, 10), vrr(30, 55), vrr(-10, 10)).addScaledVector(inward, vrr(6, 16));
        const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(vrr(-2, 2), vrr(-2, 2), vrr(-2, 2)));
        pieces[kind].push({ p: center.clone(), q, s: new THREE.Vector3(...size), from: away, spin, color: new THREE.Color(color), order, t0: -1, state: 0 });
      };
      const at = (r, a, y) => new THREE.Vector3(c[0] + Math.cos(a * deg) * r, y, c[1] + Math.sin(a * deg) * r);
      const inwardAt = (a) => new THREE.Vector3(-Math.cos(a * deg), 0, -Math.sin(a * deg));
      const tint = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
      const chord = (r) => 2 * r * Math.sin((180 / SEG) * deg) * 1.02;
      // where the rail's top runs, at the start of tread `i`
      const railAt = (i) => {
        const s = i / N, f = scale(s);
        return at(radius((i + 0.5) / N) - (SHELF + WALK - 1.1) * f, angle(s), height(s) + 9 * f);
      };

      for (let i = 0; i < N; i++) {
        const s = i / N, sm = (i + 0.5) / N, a = angle(sm), r = radius(sm), k = fade(sm), f = scale(sm);
        const y = height(s);                       // the top of this tread
        const yUp = height(s + 1 / TURNS);         // the tread a turn above it
        const inn = inwardAt(a);
        const order = s;
        // the tread: from the rail out to the wall of the turn below it (or,
        // in the first turn, to the hexagon's own wall tops)
        const rIn = r - (SHELF + WALK) * f, rOut = i < SEG ? edge(a) + 3 : radius(sm - 1 / TURNS) + 1.5 * f;
        put('stone', at((rIn + rOut) / 2, a, y - (TREAD * f) / 2), inn, [chord(rOut), TREAD * f, rOut - rIn], tint('#4d443a', k), order);
        // its nosing: the pale edge that draws the spiral seen from below
        put('stone', at(rIn + 0.4 * f, a, y - 3.7 * f), inn, [chord(rIn) * 1.01, 2.2 * f, 1.6 * f], tint('#8a7c69', k), order);
        // and a bronze string under that: the one line that catches the
        // light all the way up, so the eye is handed the helix and not a
        // stack of rings
        put('bronze', at(rIn + 0.1 * f, a, y - 5.1 * f), inn, [0.55 * f, chord(rIn) * 1.02, 0.55 * f], tint('#ffffff', 0.25 + 0.6 * k), order, { tilt: Math.PI / 2 });
        // The back of the bookcase, up to the underside of the tread a turn
        // above — and in the first turn down behind the wall tops, so there is
        // no seeing past its foot.
        const low = i < SEG ? Y0 - 12 : y;
        put('wood', at(r + f, a, (low + yUp) / 2), inn, [chord(r + f), yUp - low, 2 * f], tint('#2a1d15', k), order + 0.0005);
        // two shelves, a cornice over them, and the uprights between the bays
        const PH = yUp - y;
        for (const [yy, t, deep] of [[y + 0.2 * f, 1.6, 0], [y + PH / 2, 1.4, 0], [yUp - (TREAD + 3) * f, 3, 1.6]]) {
          put('wood', at(r - (SHELF / 2 + deep / 2) * f, a, yy + (t * f) / 2), inn, [chord(r), t * f, (SHELF + deep) * f], tint('#4a3526', k), order + 0.001);
        }
        if (i % 3 === 0) {
          const ab = angle(s);
          put('wood', at(r - (SHELF / 2 + 0.4) * f, ab, (y + yUp) / 2), inwardAt(ab), [1.8 * f, PH - TREAD * f, (SHELF + 0.8) * f], tint('#3b2a1e', k), order + 0.001);
        }
        // the rail: a baluster at every tread, a rod from each to the next
        const p0 = railAt(i), p1 = railAt(i + 1);
        put('bronze', p0.clone().setY(p0.y - 4.5 * f), inwardAt(angle(s)), [0.55 * f, 9 * f, 0.55 * f], tint('#ffffff', 0.2 + 0.6 * k), order + 0.002);
        {
          const len = p0.distanceTo(p1), mid = p0.clone().add(p1).multiplyScalar(0.5);
          const along = p1.clone().sub(p0).normalize();
          pieces.bronze.push({
            p: mid, q: new THREE.Quaternion().setFromUnitVectors(UP, along), s: new THREE.Vector3(0.42 * f, len * 1.02, 0.42 * f),
            from: new THREE.Vector3(vrr(-8, 8), vrr(30, 50), vrr(-8, 8)), spin: new THREE.Quaternion(),
            color: tint('#ffffff', 0.2 + 0.6 * k), order: order + 0.002, t0: -1, state: 0,
          });
        }
        // a small lamp on every third post: a string of lights going round
        // and up and in, which is what draws the spiral the eye follows
        if (i % 3 === 1) {
          const g = Math.max(0.35, 0.9 * f);
          put('lamps', p0.clone().setY(p0.y + 1.2 * f), inwardAt(angle(s)), [g, g, g], tint('#ffc98e', 0.2 + 1.5 * k), order + 0.003);
        }
        // the books, both shelves, flying up out of the room onto them
        const rb = r - 4.2 * f, w = chord(rb) * 0.97;
        const along = new THREE.Vector3().crossVectors(UP, inn).normalize();
        const rows = [[y + 1.8 * f, PH * 0.5 - 2.6 * f], [y + PH * 0.5 + 1.4 * f, PH * 0.5 - TREAD * f - 4.8 * f]];
        // In the first turn the tread climbs away from the wall tops, and the
        // bookcase under it — down to the stone — was a bare dark board as
        // tall as the whole bay by the end of the turn. It gets shelves too.
        if (i < SEG) {
          const under = y - 6 * f - Y0;
          for (let b = Y0; b + 9 < Y0 + under; b += PH / 2) {
            const room = Math.min(PH / 2 - 2.4 * f, Y0 + under - b - 1.2);
            put('wood', at(r - (SHELF / 2) * f, a, b - 0.7 * f), inn, [chord(r), 1.4 * f, SHELF * f], tint('#4a3526', k), order + 0.001);
            rows.push([b + 0.1, room]);
          }
        }
        for (const [yb, room] of rows) {
          if (!BOOKS_GIANT) {
            // Real books (2026-10-06): a giant's shelf here is three or four
            // of quartos, each a painted row of them (bookRows) set down
            // whole. Seen from the floor, a hundred and more below, a book is
            // a pixel or two across; boxes for them all were tens of thousands.
            const n = Math.max(1, Math.round(room / (4.1 * f))), pitch = room / n, rf = r - 7.4 * f, wr = chord(rf) * 0.97;
            for (let j = 0; j < n; j++) {
              const sy = yb + j * pitch, clear = pitch - (j < n - 1 ? 0.4 * f : 0);
              if (j > 0) put('wood', at(r - (SHELF / 2) * f, a, sy - 0.2 * f), inn, [chord(r), 0.4 * f, SHELF * f], tint('#4a3526', k), order + 0.001);
              const { top: vt, base: vb } = rowV[BOOK_ROWS.variants + Math.floor(vr() * BOOK_ROWS.variants)];
              const from = inn.clone().multiplyScalar(vrr(28, 60)).add(new THREE.Vector3(vrr(-12, 12), -vrr(8, 30), vrr(-12, 12)));
              // (twice the fade the boxes took: the boxes' labels, lift and
              // gilt in the books' shader carried them, and the bare paint at
              // the same fade read as half as bright)
              put('rows', at(rf, a, sy + clear / 2), inn, [wr, clear, 1], tint('#ffffff', 2.2 * k * vrr(0.9, 1.1)), order + 0.003 + j * 0.0004, { from });
              pieces.rows[pieces.rows.length - 1].row = [vr(), wr / BOOK_ROWS.length, vb, vt];
            }
            continue;
          }
          const base = yb - y;
          let u = -w / 2;
          let n = 0;
          while (u < w / 2 - 1.4 * f) {
            if (vr() < 0.04) { u += vrr(1.5, 4) * f; continue; }
            const bw = Math.min(vrr(1.3, 2.9) * f, w / 2 - u), bh = vrr(room * 0.7, room);
            const tilt = vr() < 0.05 ? vrr(-0.25, 0.25) : 0;
            // across the bay, not round it: a straight shelf in each bay
            const p = at(rb, a, y + base + bh / 2).addScaledVector(along, u + bw / 2);
            const from = inn.clone().multiplyScalar(vrr(28, 60)).add(new THREE.Vector3(vrr(-12, 12), -vrr(8, 30), vrr(-12, 12)));
            put('books', p, inn, [bw, bh, vrr(6, 7.4) * f], tint(BOOKS[Math.floor(vr() * BOOKS.length)], vrr(0.8, 1.15)),
              order + 0.003 + n * 0.00012, { from, tilt });
            pieces.books[pieces.books.length - 1].dim = k;
            u += bw + vrr(0.1, 0.5) * f;
            n++;
          }
        }
      }
      // What it closes in on: past the last turn the next would be a few
      // units across, so the throat is stopped with a dark disc rather than
      // left as a hole onto the stars.
      {
        const yTop = height(1 + 1 / TURNS), r = radius(1) + 2;
        pieces.stone.push({
          p: new THREE.Vector3(c[0], yTop, c[1]), q: new THREE.Quaternion(), s: new THREE.Vector3(r * 2, 1, r * 2),
          from: new THREE.Vector3(0, 60, 0), spin: new THREE.Quaternion(), color: new THREE.Color('#050404'), order: 1.0, t0: -1, state: 0,
        });
      }

      // ── drawing it ──
      const woodMat = Std({ color: '#ffffff', map: wood.map, roughness: 0.9 });
      // Each piece is the unit box stretched by its instance, so its uv ran
      // 0..1 over every face whatever that face's size: a tile of timber
      // squeezed onto a dentil and drawn out down an upright. Measured off the
      // instance's own scale instead, in world units, with the grain along a
      // face's longer side and each piece cut from its own stretch of the
      // board (see woodGrain.js).
      if (!WOOD_OLD) {
        woodMat.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
          {
            vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
            vec3 an = abs(normal);
            // a face's sides as a BoxGeometry lays its uv: ±x faces (z, y), ±y (x, z), ±z (x, y)
            vec2 side = an.x > 0.5 ? sc.zy : an.y > 0.5 ? sc.xz : sc.xy;
            vec2 w = uv * side;
            if (side.y > side.x) w = w.yx;
            w += fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * vec2(97.0, 53.0);
            vMapUv = (mapTransform * vec3(w, 1.0)).xy;
          }`);
        };
        woodMat.customProgramCacheKey = () => 'babel-vault-wood';
      }
      const stoneMat = Std({ color: '#ffffff', roughness: 0.95 });
      // The room's own bindings, but dimmed whole. The book material paints
      // the gilt, the labels and the page edges in colours of their own, so an
      // instance colour only ever darkened the leather — and a spiral of dark
      // leather under bright gold lettering read as a lit library, however far
      // the leather went down. `aDim` takes the finished colour down with it,
      // gold and paper included.
      const bookMat = makeBookMaterial(spines, titles?.map);
      {
        const base = bookMat.onBeforeCompile;
        bookMat.onBeforeCompile = (sh, r) => {
          base.call(bookMat, sh, r);
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
        attribute float aDim;
        varying float vDim;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
        vDim = aDim;`);
          // after the bindings are painted (color_fragment), before anything
          // reads the colour — so the gilt's metal goes down with it too
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
        varying float vDim;`)
            .replace('#include <roughnessmap_fragment>', `diffuseColor.rgb *= vDim;
        #include <roughnessmap_fragment>`);
        };
        bookMat.customProgramCacheKey = () => 'babel-books-dimmed';
        keep(bookMat);
      }
      const lampMat = keep(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      const meshes = [];
      // the painted rows: a quad apiece, showing its own stretch of the strip
      const rowsMat = Std({ map: bookRowsSet.map, roughness: 0.85 });
      rowsMat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
          attribute vec4 aRow;`)
          .replace('#include <uv_vertex>', `#include <uv_vertex>
          vMapUv = vec2(aRow.x + uv.x * aRow.y, mix(aRow.z, aRow.w, uv.y));`);
      };
      rowsMat.customProgramCacheKey = () => 'babel-vault-rows';
      const make = (list, geo, mat, { spine = false, row = false } = {}) => {
        if (!list.length) return;
        const g = keep(geo);
        if (row) g.setAttribute('aRow', new THREE.InstancedBufferAttribute(Float32Array.from(list.flatMap((b) => b.row)), 4));
        if (spine) {
          g.setAttribute('aSpine', new THREE.InstancedBufferAttribute(Float32Array.from(list, (b) => spineAt([b.p.x, b.p.y, b.p.z])), 1));
          g.setAttribute('aTitle', new THREE.InstancedBufferAttribute(Float32Array.from(list, (b) => titleAt([b.p.x, b.p.y, b.p.z])), 1));
          g.setAttribute('aDim', new THREE.InstancedBufferAttribute(Float32Array.from(list, (b) => b.dim ?? 1), 1));
          g.setAttribute('aGraze', new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1));
          g.setAttribute('aDust', new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1));
        }
        const mesh = new THREE.InstancedMesh(g, mat, list.length);
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        list.forEach((it, j) => mesh.setColorAt(j, it.color));
        root.add(mesh);
        meshes.push({ mesh, list });
      };
      make(pieces.stone, new THREE.BoxGeometry(1, 1, 1), stoneMat);
      make(pieces.wood, new THREE.BoxGeometry(1, 1, 1), woodMat);
      make(pieces.books, new THREE.BoxGeometry(1, 1, 1), bookMat, { spine: true });
      make(pieces.rows, new THREE.PlaneGeometry(1, 1), rowsMat, { row: true });
      make(pieces.bronze, new THREE.CylinderGeometry(0.5, 0.5, 1, 8), M.bronze);
      make(pieces.lamps, new THREE.SphereGeometry(0.5, 12, 8), lampMat);

      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      const FLY = 1.3, LAST = 1.02;
      let built = 0, was = null, begun = false, held = false, dirty = false;
      // States: 0 not yet, 1 in the air, 3 set down. Only a piece in the air
      // costs anything a frame, so a finished library is free.
      const draw = (t) => {
        let busy = false;
        for (const { mesh, list } of meshes) {
          let touched = false;
          list.forEach((it, j) => {
            if (it.state === 3) return;
            if (it.state === 0) {
              if (built < it.order) return;
              it.state = 1;
              it.t0 = t;
            }
            const u = Math.min(1, (t - it.t0) / FLY);
            if (u < 1) {
              // lifted along an arc and set down, turning out of its tumble
              const e = 1 - (1 - u) ** 3;
              p.copy(it.p).addScaledVector(it.from, 1 - e);
              p.y += Math.sin(Math.PI * e) * 6;
              q.copy(it.spin).multiply(it.q).slerp(it.q, e);
              sc.copy(it.s).multiplyScalar(Math.min(1, u * 5));
            } else {
              p.copy(it.p);
              q.copy(it.q);
              sc.copy(it.s);
              it.state = 3;
            }
            mesh.setMatrixAt(j, m4.compose(p, q, sc));
            touched = true;
            busy = true;
          });
          if (touched) mesh.instanceMatrix.needsUpdate = true;
        }
        return busy;
      };
      const clear = () => {
        for (const { mesh, list } of meshes) {
          const zero = new THREE.Matrix4().makeScale(0, 0, 0);
          list.forEach((it, j) => { it.state = 0; mesh.setMatrixAt(j, zero); });
          mesh.instanceMatrix.needsUpdate = true;
          mesh.visible = false;
        }
      };
      clear();
      vault = (t, eye, gaze) => {
        const dt = was === null ? 0 : Math.min(0.1, Math.max(0, t - was));
        was = t;
        const far = eye ? Math.hypot(eye.x - c[0], eye.z - c[1]) : Infinity;
        if (far > R) {
          // Gone again once the reader is out of the room, so it is never
          // found half-built from the hallway.
          if (built > 0 && far > R + 20) { built = 0; begun = false; clear(); }
          return;
        }
        // Looking out level, or at the stair, does nothing: it wants the head
        // turned up, past where the room's composed view points.
        const up = gaze ? THREE.MathUtils.smoothstep(gaze.y, 0.3, 0.72) : 0;
        if (up > 0) begun = true;
        if (begun && !held && built < LAST) { built = Math.min(LAST, built + dt * (0.032 + 0.12 * up)); dirty = true; }
        if (built > 0) for (const { mesh } of meshes) mesh.visible = true;
        if (dirty) dirty = draw(t) || built < LAST;
      };
      if (import.meta.env.DEV) {
        window.__vault = (v, hold = false) => {
          if (v !== undefined) {
            // set down everything before `v` at once
            clear();
            built = v;
            begun = v > 0;
            held = hold;
            for (const { list } of meshes) for (const it of list) if (it.order <= v - 0.04) { it.state = 1; it.t0 = -1e3; }
            dirty = true;
          }
          return built;
        };
      }
    }
  }
  return { vault, walkers };
}
