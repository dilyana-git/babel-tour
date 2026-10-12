// III — the Silence (buildWorld.js, assembleWorld).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from '../textures';
import { readerMaterial } from '../walkers';
import { silenceOld, LAMP_AT, ROBE, BOUNCE, SHEEN } from '../silenceFix';
import { readerGeometry } from '../readers';
import { deg, MASS_H } from '../build/common';

export function buildSilence(ctx) {
  const { rr, pick, dir, add, dist, circlePts, rot3, keep, root, centre, slabGeo, placed,
    profileGeo, rodGeo, Q, qNum, cellC, hallMid, RAIL_OLD, FLIGHT_RAIL, stoneRail, flightProfile,
    flightDress, LB, links, balusters, lamp } = ctx;
  // III — the Silence: "where the stairways stop crossing,
  // a single lamp keeps the dark honest". So the Echo's crossing is here
  // too — and stilled: two flights climb out over the well and, instead of
  // crossing, come to rest on one landing in the middle of it, under the one
  // lamp; five of the six lamps have gone out, and the one that has not is the
  // whole light in the room. (They used to be sheared off in the air a little
  // short of each other, and from the stand that read as a bridge into
  // nowhere, not as a stair that had stopped. Before that it was a lamp, a
  // reader and twelve boxes spiralling into the shaft — the Echo again with
  // the lights down.)
  {
    const c = cellC(2, -2);
    // Both flights climb from the floor to the middle and end on its axis,
    // the level crown of each running on into the landing. (`from: 9` builds
    // the half on the near side of the axis, which is the half the walk does
    // not cross — see `legs`.)
    //
    // Where they meet, each is buried in the other: the inner flank as far as
    // the V where the two inner parapets cross (13 puts both newels on the
    // bisector, one post), the outer flank only until it leaves the landing.
    // The parapet comes down over both, as it does over the Echo's crossing.
    const LAND = 9.5, INNER = 13, OUTER = 5.5;
    // (the landing as a terrace: see below)
    const TERRACE = Q.get('wterrace') !== 'old';
    const TERRACE_OUT = qNum('wterraceout', 6);
    for (const ang of [240, 300]) {
      const f = flightProfile({ from: 9, to: 18 });
      LB.step.add(profileGeo(f.pts, 13, c, ang));
      const inner = ang === 240 ? 1 : -1;
      flightDress(c, ang, f, 6.9, { ends: [false, true], gap: (side) => [-1, side === inner ? INNER : OUTER], stone: LB.capShade, worn: false, keyThrough: !TERRACE });
      // The rubble the broken ends used to shed onto the floor is gone with
      // them; its draws stay, because the world's random stream is shared and
      // everything built after this would otherwise be shuffled.
      for (let k = 0; k < 6; k++) { rr(-26, 26); rr(50, 74); rot3(); rr(2, 5.5); rr(1, 2.6); rr(2, 5.5); pick([0, 0, 0]); }
    }
    // ── The landing ──
    // A round floor at the height of the crowns, where the two flights come
    // in, carried on their arches. Everything round its free edge — the half
    // circle facing the room — is the flights' own dressing bent round it, the
    // same members at the same heights, so the stone reads as one stair that
    // arrives rather than two that were stopped: string and corona under the
    // deck, a kerb and its coping, balusters and a rail from the outer newel
    // of one flight to the outer newel of the other.
    //
    // And it is a TERRACE: the free edge is carried out toward the room, so
    // there is somewhere up there to stand and look from. As a round floor no
    // wider than the flights' crowns it was a pulpit — the reader on the stool
    // filled it, both flights arrived straight at the stool, and nobody who
    // climbed up could get round it to the rail (between it and either outer
    // newel there was five units, and a reader is eight across). Now the edge
    // is a wider arc whose middle is pushed TERRACE_OUT toward the room; it
    // still springs from the same two newels, so the flights, their dressing
    // and the back of the landing (over the crowns) are as they were — but
    // for the two keystones, which broke up through the paving in an X where
    // the stool used to hide them (`keyThrough`).
    // ?wterrace=old puts the round landing, the reader and the lamp back.
    {
      const f = flightProfile({ from: 9 });
      const TOP = f.pitch(0);
      // The free edge: from one flight's outer newel round to the other's. The
      // newels stand at u = OUTER, 7.5 off the axis (see flightDress).
      const RN = Math.hypot(OUTER, 7.5), half = Math.atan2(7.5, OUTER) / deg;
      const A0 = 300 + half, A1 = 360 + 240 - half;
      // the arc it is drawn on: round FC, through both newels, by way of the room
      const FC = TERRACE ? add(c, dir(90), TERRACE_OUT) : c;
      const N0 = add(c, dir(A0), RN), N1 = add(c, dir(A1), RN);
      const bearing = (p) => (Math.atan2(p[1] - FC[1], p[0] - FC[0]) / deg + 360) % 360;
      const RF = dist(FC, N0), LF = RF + (LAND - RN);
      const B0 = bearing(N0), B1 = bearing(N1) + 360;
      const arc = (r, n = 28) => Array.from({ length: n + 1 }, (_, k) => add(FC, dir(B0 + ((B1 - B0) * k) / n), r));
      const band = (r0, r1, y0, h, stone = LB.cap) => stone.add(slabGeo([...arc(r1, 40), ...arc(r0, 40).reverse()], [], h, y0));
      // A slab, not a drum. As a solid disc down to the arches' soffit, with a
      // cone under it, the landing read as a font or a pulpit standing on the
      // well, and not as the place two flights came to rest. Thin, it is
      // carried out over the well on the flights' own stone. (Behind the
      // newels — over the crowns, between the flights — it keeps the round.)
      const back = Array.from({ length: 21 }, (_, k) => add(c, dir(A1 + ((A0 + 360 - A1) * k) / 20), LAND));
      LB.step.add(slabGeo(TERRACE ? [...arc(LF, 40), ...back.slice(1, -1)] : circlePts(c, LAND, 48), [], 3.4, TOP - 3.4));
      band(LF - 1.6, LF, TOP, 1.6);                  // the kerb
      band(LF - 1.05, LF + 1.15, TOP + 1.6, 0.85);   // its coping
      band(LF - 0.5, LF + 0.82, TOP - 2.45, 1.2);    // the string
      band(LF - 0.5, LF + 1.15, TOP - 1.25, 0.8);    // its corona
      // a fillet under the slab — on the round landing only. The terrace's
      // wider arc turns the ends of its underside to the floor, and from the
      // stand they were two pale lenses hung under it, in the pale stone or
      // the dark (or the slab's own, paler still); without it the slab ends
      // in its string.
      if (!TERRACE) band(LF - 0.5, LF + 0.6, TOP - 4.3, 0.9, LB.cap);
      // Under the string, a skin of the flights' stone over the slab's own
      // edge: bare, the paving's flag texture ran down its face and its lower
      // arris printed from the floor as a bright chipped crack along the whole
      // underside of the terrace.
      if (TERRACE) band(LF - 0.3, LF + 0.03, TOP - 3.4, 0.95, LB.capShade);
      const railY = TOP + 9, base = TOP + 2.45;
      // the flights' stone balustrade, carried round from newel to newel
      if (!RAIL_OLD) {
        const L = (B1 - B0) * deg * RF, bear = (s) => B0 + ((B1 - B0) * s) / L;
        stoneRail(LB.balustradeShade, {
          at: (s) => add(FC, dir(bear(s)), RF), foot: () => base, top: () => railY + 0.5,
          knots: Array.from({ length: 41 }, (_, k) => (k / 40) * L), clear: [1.5, 1.5],
          ry: (s) => -(bear(s) + 90) * deg, S: FLIGHT_RAIL,
        });
      }
      const rail = RAIL_OLD ? arc(RF, 32) : [];
      for (let i = 1; i < rail.length; i++) {
        LB.bronze.add(rodGeo([rail[i - 1][0], railY, rail[i - 1][1]], [rail[i][0], railY, rail[i][1]], 0.44));
      }
      // at the flights' spacing of two to a tread, along the arc
      const n = RAIL_OLD ? Math.round(((B1 - B0) * deg * RF) / 4) : 0;
      for (let k = 1; k < n; k++) {
        const q = add(FC, dir(B0 + ((B1 - B0) * k) / n), RF);
        balusters.push({ p: [q[0], base, q[1]], s: [0.42, (railY - 0.55 - base) / 6.2, 0.42] });
      }
      // a small boss under the middle, and no more
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.1, 0.7, 0.8, 16), FC, TOP - 3.8));
    }
    // The one lamp still burning hangs over the landing, just off its middle
    // toward where the flights come in — so what it lights is the place where
    // the stairs stop. (Beyond them it only silhouetted them, and a dark shape
    // over a dark well is not a stair.) With the terrace it hangs HIGHER: at
    // 50 its globe was at the eye of anyone standing up there, nine units
    // off, and filled a third of the view with blown white. At 54 it is out of
    // a level look from anywhere on the terrace, and from the floor it still
    // stands behind the reader's head.
    // (its pool on the landing, where it falls: the floor under it is a well
    // — and on the terrace's middle, not on the lamp's: a pool laid round the
    // lamp itself ran off the back of the landing and hung over the treads)
    // Its globe is the hallway lamps' size, not the galleries' (r 9 is a
    // globe nearly ten units across, made to hang sixty up in a room's air):
    // over a terrace, a head or two above the reader, that size read as a
    // second moon.
    // (hung a body-width clear of the reader's head as the stand sees it:
    // silenceFix.js, 1)
    const LAMP = silenceOld(1) ? [258, 9, 54] : LAMP_AT;
    if (TERRACE) lamp(add(c, dir(LAMP[0]), LAMP[1]), { y: LAMP[2], r: 5.5, light: 7000, priority: 6, color: '#ffc98e', strength: 0.95, pool: 0.3, poolSize: 20, poolAt: add(c, dir(90), 4), poolY: flightProfile({ from: 9 }).pitch(0) + 0.06, beam: false });
    else lamp(add(c, dir(270), 9), { y: 50, light: 7000, priority: 6, color: '#ffc98e', strength: 0.95, pool: 0.3, poolSize: 24, poolY: flightProfile({ from: 9 }).pitch(0) + 0.06, beam: false });
    // (the one toward the Echo is hung off its doorway, at 168: on 150 it
    // hung in the arch itself, the middle of the view from the terrace)
    // (the one at 122 hung at 210, in the stand's frame, and goes higher than
    // the rest so that from the terrace the near wall's dead globes are not a
    // row: silenceFix.js, 3)
    const OUT_FRAME = !silenceOld(3);
    for (const a of [15, 75, TERRACE ? 168 : 150, OUT_FRAME ? 122 : 210, 330]) lamp(add(c, dir(a), rr(52, 64)), { out: true, r: rr(7.5, 9), ...(a === 122 ? { y: 82 } : {}) });
    // More that have gone out, at other heights, so the dark globes are a
    // room's worth and not a row — and one that fell: its chain still hangs
    // where it was, and the glass lies broken on the floor under it.
    // (the one at 235 hung at 265 until the terrace: from the stand it was
    // straight behind the lit globe and just under it, so through the
    // balusters the two read as one lamp twice the height)
    // (and the one at 40 at 235, over the stand's left: silenceFix.js, 3)
    for (const [a, rad, y, r] of [[45, 30, 74, 8], [110, 44, 58, 7], [185, 30, 82, 8.5], OUT_FRAME ? [40, 62, 56, 7.5] : [TERRACE ? 235 : 265, 60, 70, 7.5]]) {
      lamp(add(c, dir(a), rad), { out: true, y, r });
    }
    {
      const sr = makeRng(2262), at = add(c, dir(262), 50);
      for (let cy = 64, k = 0; cy < MASS_H + 40; cy += 1.55, k++) links.push({ p: [at[0], cy, at[1]], rot: [0, k % 2 ? Math.PI / 2 : 0, 0], s: [1, 1, 1] });
      // The globe broke where it fell: the bottom of it whole, tipped on its
      // side with its broken edge jagged, and the rest in curved pieces round
      // it. (Lying whole but for a cap, smooth and pale, it read from the stand
      // as an egg — or a bald head — just over the rail.)
      const floorOn = (g) => { g.computeBoundingBox(); return g.translate(0, 6.12 - g.boundingBox.min.y, 0); };
      const bowl = new THREE.SphereGeometry(4.2, 22, 8, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42);
      {
        const bp = bowl.attributes.position;
        for (let i = 0; i < bp.count; i++) if (bp.getY(i) > -1.3) bp.setY(i, bp.getY(i) - sr() * 1.6);
      }
      LB.deadShards.add(floorOn(bowl.rotateX(1.2).rotateY(0.6).translate(at[0], 0, at[1])));
      for (let k = 0; k < 5; k++) {
        const piece = new THREE.SphereGeometry(4.2, 5, 4, sr() * 6.28, 0.6 + sr() * 0.6, 0.6 + sr() * 1.6, 0.5 + sr() * 0.4);
        piece.computeBoundingBox();
        piece.boundingBox.getCenter(centre);
        piece.translate(-centre.x, -centre.y, -centre.z).rotateX(sr() < 0.5 ? 0.2 : Math.PI - 0.2).rotateY(sr() * 6.28);
        const q = add(at, dir(sr() * 360), 4.5 + sr() * 5);
        LB.deadShards.add(floorOn(piece.translate(q[0], 0, q[1])));
      }
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.4, 1.9, 1.1, 16).rotateZ(Math.PI / 2).rotateY(1.2), add(at, dir(20), 6), 6.9));
      for (let k = 0; k < 10; k++) {
        const q = add(at, dir(sr() * 360), 3 + sr() * 8);
        LB.deadShards.add(new THREE.IcosahedronGeometry(1, 0).scale(0.5 + sr(), 0.08 + sr() * 0.1, 0.4 + sr() * 0.8)
          .rotateY(sr() * 6.28).translate(q[0], 6.12, q[1]));
      }
    }
    // ── The one who has stopped ──
    // A reader on a stool in the middle of the landing, in the one lamp's
    // light, a book open in the lap and the head bowed over it; on the stone
    // beside the stool a second book laid face down, and a candle burnt to a
    // stub in its dish. The only person in the piece who has stopped, in the
    // room that is about stopping. (One used to stand down on the floor by the
    // rail, out of the lamp's reach, where only the top of the hood caught any
    // light: from the stand, a pale egg on the rail. Its draw is kept: the
    // world's random stream is shared.)
    rr(0, Math.PI * 2);
    {
      const top = flightProfile({ from: 9 }).pitch(0);
      const face = 112;   // toward the room, a little round from the stand
      const ry = Math.atan2(Math.cos(face * deg), Math.sin(face * deg));
      // On the terrace, out toward its rail, between the lamp and the room: in
      // the middle, where both flights arrive, the stool was the first thing
      // anyone who climbed up walked into, and the rail was behind it. A
      // little to one side, so from the floor the lamp burns beside the head
      // instead of behind it (straight behind, the reader was a black cut-out
      // with a halo), and the rest of the rail is free to stand at.
      // (Drawn back three units from where it was first put, at dir(64)·11.5:
      // there, the feet and the hem of the robe ran on through the kerb and
      // stood out of the terrace's face, a shoe and a dark patch in the stone.)
      const seat = TERRACE ? add(add(c, dir(64), 11.5), dir(253), 3) : c;
      const set = (g) => g.rotateY(ry).translate(seat[0], top, seat[1]);
      // (in the darkest wool there is: a few units under the room's one lamp,
      // the dyes the walkers wear came up pale grey from behind)
      const seatedLook = readerMaterial(keep);
      const seated = new THREE.Mesh(keep(set(readerGeometry({ seed: 2262, color: silenceOld(2) ? '#18120f' : ROBE, seated: true }))), seatedLook.mat);
      // (its geometry is laid in the world, so the book is put there with it)
      const bk = seated.geometry.userData.book;
      if (bk) {
        const b = new THREE.Vector3(...bk).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(seat[0], top, seat[1]));
        seatedLook.u.uBook.value.set(b.x, b.y, b.z, 1);
      }
      // the lamp's pool on the stone at the reader's feet, thrown back up
      // onto the robe's front, the hands and the face (silenceFix.js, 2)
      if (!silenceOld(2)) {
        const g = add(seat, dir(face), BOUNCE.ahead);
        seatedLook.u.uGlow.value.set(g[0], top + BOUNCE.rise, g[1], BOUNCE.k);
        seatedLook.u.uSheen.value = SHEEN;
      }
      seated.name = 'silence-reader';
      root.add(seated);
      const stool = [new THREE.BoxGeometry(4.3, 0.5, 3.5).translate(0, 4.2, 1.0)];
      for (const [x, z] of [[-1.8, -0.4], [1.8, -0.4], [-1.8, 2.4], [1.8, 2.4]]) stool.push(new THREE.BoxGeometry(0.45, 3.95, 0.45).translate(x, 1.98, z));
      stool.push(new THREE.BoxGeometry(3.6, 0.3, 0.3).translate(0, 1.2, -0.4), new THREE.BoxGeometry(3.6, 0.3, 0.3).translate(0, 1.2, 2.4));
      LB.oak.add(set(mergeGeometries(stool)));
      stool.forEach((g) => g.dispose());
      // the book face down, open, its two boards a low tent
      for (const side of [-1, 1]) {
        LB.leather.add(set(new THREE.BoxGeometry(2.1, 0.22, 3.1).translate(side * 1.02, 0, 0).rotateZ(-side * 0.16).translate(-3.9, 0.45, 2.6).rotateY(0.5)));
        LB.paper.add(set(new THREE.BoxGeometry(1.9, 0.3, 2.9).translate(side * 0.95, -0.2, 0).rotateZ(-side * 0.16).translate(-3.9, 0.45, 2.6).rotateY(0.5)));
      }
      // the candle: a dish, a stub of wax, the wax that ran
      LB.bronzeDim.add(set(new THREE.CylinderGeometry(0.85, 0.7, 0.14, 16).translate(3.4, 0.07, 2.2)));
      LB.paper.add(set(new THREE.CylinderGeometry(0.36, 0.42, 0.75, 12).translate(3.4, 0.52, 2.2)));
      LB.paper.add(set(new THREE.SphereGeometry(0.3, 10, 6).scale(1, 0.45, 1.3).translate(3.75, 0.2, 2.35)));
      LB.iron.add(set(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 4).translate(3.4, 1.0, 2.2)));
    }
  }
  // Two of them turned down. The one hung in the Vestibule's arch was the
  // brightest thing in the view through it, so the eye stopped in the doorway
  // instead of going on into the Echo; the one past the Silence was warmer
  // than the Silence's own last lamp.
  for (const [i, j, k, strength] of [[0, 0, 2, 1], [0, 0, 5, 0.5], [1, -1, 5, 1], [2, -2, 5, 0.4]]) {
    lamp(hallMid(i, j, k), { y: 46, strength, pool: 0.34 * strength, poolSize: 130, r: 5 });
  }
}
