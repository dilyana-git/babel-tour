// III — the Silence (buildWorld.js, assembleWorld).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from '../textures';
import { readerMaterial } from '../walkers';
import { silenceOld, ROBE, BOUNCE, SHEEN } from '../silenceFix';
import { readerGeometry } from '../readers';
import { deg, MASS_H } from '../build/common';

export function buildSilence(ctx) {
  const { rr, pick, dir, add, dist, circlePts, rot3, keep, root, centre, slabGeo, placed,
    profileGeo, mouldGeo, pedestalGeo, patchOf, Q, qNum, cellC, hallMid, flightProfile, stoneRail, FLIGHT_RAIL,
    flightDress, LB, links, lamp, M } = ctx;
  // III — the Silence: "where the stairways stop crossing, a single lamp keeps
  // the dark honest". So the Echo's crossing is here too — and stilled: two
  // flights climb out over the well and, instead of crossing, come to rest on
  // one landing in the middle of it, under the one lamp; five of the six lamps
  // have gone out, and the one that has not is the whole light in the room.
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
    const TOP = flightProfile({ from: 9 }).pitch(0);
    const seat = TERRACE ? add(add(c, dir(64), 11.5), dir(253), 3) : c;
    const railChoice = ['a', 'b', 'c'].includes(Q.get('wsilrail')) ? Q.get('wsilrail') : 'a';
    for (const ang of [240, 300]) {
      const f = flightProfile({ from: 9, to: 18 });
      LB.step.add(profileGeo(f.pts, 13, c, ang));
      const inner = ang === 240 ? 1 : -1;
      flightDress(c, ang, f, 6.9, { ends: [false, true], gap: (side) => [-1, side === inner ? INNER : OUTER], stone: LB.capShade, worn: false, keyThrough: !TERRACE });
      // The draws of the rubble that broken flight ends once shed onto the
      // floor are still made, because the world's random stream is shared and
      // everything built after this would otherwise be shuffled.
      for (let k = 0; k < 6; k++) { rr(-26, 26); rr(50, 74); rot3(); rr(2, 5.5); rr(1, 2.6); rr(2, 5.5); pick([0, 0, 0]); }
    }
    // ── The landing ──
    // A round floor at the height of the crowns, where the two flights come
    // in, carried on their arches. Everything round its free edge — the half
    // circle facing the room — is the flights' own dressing bent round it, the
    // same members at the same heights, so the stone reads as one stair that
    // arrives rather than two that were stopped: string and corona under the
    // deck, kerb and coping, with full balustrades wrapping the two sides.
    // The central front section frames the reader and the open page.
    //
    // And it is a TERRACE: the free edge is carried out toward the room, so
    // there is somewhere up there to stand and look from. As a round floor no
    // wider than the flights' crowns it is a pulpit — the reader on the stool
    // fills it, both flights arrive straight at the stool, and nobody who
    // climbs up can get round it to the rail (between it and either outer newel
    // there are five units, and a reader is eight across). So the edge is a
    // wider arc whose middle is pushed TERRACE_OUT toward the room; it still
    // springs from the same two newels, so the flights, their dressing and the
    // back of the landing (over the crowns) are the round landing's — but for
    // the two keystones, which would break up through the paving in an X where
    // the stool hid them (`keyThrough`).
    {
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
      // cone under it, the landing reads as a font or a pulpit standing on the
      // well, and not as the place two flights come to rest. Thin, it is
      // carried out over the well on the flights' own stone. (Behind the newels
      // — over the crowns, between the flights — it keeps the round.)
      const back = Array.from({ length: 21 }, (_, k) => add(c, dir(A1 + ((A0 + 360 - A1) * k) / 20), LAND));
      LB.step.add(slabGeo(TERRACE ? [...arc(LF, 40), ...back.slice(1, -1)] : circlePts(c, LAND, 48), [], 3.4, TOP - 3.4));
      band(LF - 1.6, LF, TOP, 1.6);                  // the kerb
      band(LF - 1.05, LF + 1.15, TOP + 1.6, 0.85);   // its coping
      band(LF - 0.5, LF + 0.82, TOP - 2.45, 1.2);    // the string
      band(LF - 0.5, LF + 1.15, TOP - 1.25, 0.8);    // its corona
      // a fillet under the slab — on the round landing only. The terrace's
      // wider arc turns the ends of its underside to the floor, and from the
      // stand they would be two pale lenses hung under it, in the pale stone or
      // the dark (or the slab's own, paler still); without it the slab ends in
      // its string.
      if (!TERRACE) band(LF - 0.5, LF + 0.6, TOP - 4.3, 0.9, LB.cap);
      // Under the string, a skin of the flights' stone over the slab's own
      // edge: bare, the paving's flag texture ran down its face and its lower
      // arris printed from the floor as a bright chipped crack along the whole
      // underside of the terrace.
      if (TERRACE) band(LF - 0.3, LF + 0.03, TOP - 3.4, 0.95, LB.capShade);
      const mid = (B0 + B1) / 2, front0 = mid - 37.5, front1 = mid + 37.5;
      const base = TOP + 2.45, high = TOP + 9.5;
      const shoulderTop = (a, low, spread) => {
        const t = THREE.MathUtils.clamp((Math.abs(a - mid) - 37.5) / spread, 0, 1);
        return TOP + low + (9.5 - low) * t * t * (3 - 2 * t);
      };
      const railRun = (a0, a1, top, S = FLIGHT_RAIL) => {
        const length = (a1 - a0) * deg * RF;
        const bear = (s) => a0 + s / (RF * deg);
        const segments = Math.ceil((a1 - a0) / 4);
        stoneRail(LB.balustradeShade, {
          at: (s) => add(FC, dir(bear(s)), RF), foot: () => base,
          top: (s) => top(bear(s)),
          knots: Array.from({ length: segments + 1 }, (_, k) => k / segments * length),
          clear: [1.5, 1.5], ry: (s) => -(bear(s) + 90) * deg, S,
        });
      };
      if (railChoice === 'b') {
        // The rail slopes down on each shoulder, then remains level across
        // the front, below the reader's hands and book.
        const lowRail = {
          ...FLIGHT_RAIL, railH: 0.65, baseH: 0.28, sink: 0.18, r: 0.45, step: 3.2,
          rail: FLIGHT_RAIL.rail.map(([z, y, sharp]) => [z * 0.72, y * 0.65 / FLIGHT_RAIL.railH, sharp]),
          base: FLIGHT_RAIL.base.map(([z, y, sharp]) => [z * 0.8, y * 0.28 / FLIGHT_RAIL.baseH, sharp]),
        };
        railRun(B0, front0 - 28, () => high);
        railRun(front0 - 28, front1 + 28, (a) => shoulderTop(a, 5.4, 28), lowRail);
        railRun(front1 + 28, B1, () => high);
      } else {
        const endHeight = railChoice === 'a' ? 7.2 : 6.6;
        railRun(B0, front0, (a) => shoulderTop(a, endHeight, 22));
        railRun(front1, B1, (a) => shoulderTop(a, endHeight, 22));
        for (const a of [front0, front1]) {
          const p = add(FC, dir(a), RF);
          LB.balustradeShade.add(placed(pedestalGeo(1.5, 0.6, endHeight - 2.45 - 1.6, { shift: patchOf(p) }), p, base, -(a + 90) * deg));
        }
        if (railChoice === 'c') {
          // A moulded bronze handrail rests on square posts with socket feet
          // and collars. Its low arc keeps the hood and page above the rail.
          const railY = TOP + 6.6, railH = 0.45;
          const front = Array.from({ length: 25 }, (_, k) => {
            const p = add(FC, dir(front0 + (front1 - front0) * k / 24), RF);
            return [p[0], railY - railH, p[1]];
          });
          const section = FLIGHT_RAIL.rail.map(([z, y, sharp]) => [z * 0.34, y * railH / FLIGHT_RAIL.railH, sharp]);
          LB.bronze.add(mouldGeo(front, section));
          for (const offset of [-30, -15, 0, 15, 30]) {
            const a = mid + offset, turn = -(a + 90) * deg;
            const p = add(FC, dir(a), RF);
            const postH = railY - railH - base;
            LB.bronzeDim.add(placed(new THREE.BoxGeometry(0.28, postH, 0.34), p, base + postH / 2, turn));
            LB.bronzeDim.add(placed(new THREE.BoxGeometry(0.64, 0.18, 0.72), p, base + 0.09, turn));
            LB.bronze.add(placed(new THREE.BoxGeometry(0.45, 0.16, 0.5), p, railY - railH - 0.08, turn));
          }
        }
      }
      // a small boss under the middle, and no more
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.1, 0.7, 0.8, 16), FC, TOP - 3.8));
    }
    // Along the free arc, beside the book: its light reaches the page and
    // hood from the front, then falls down the coping and the slab's face.
    const lampAt = add(c, [-3, 20]), lampY = TOP + 10.2, lampR = 3;
    lamp(lampAt, { y: lampY, lightY: lampY, r: lampR, light: 1100, priority: 6, color: '#ffc98e', strength: 0.85, haze: 0.3, pool: 0.2, poolSize: 18, poolAt: add(seat, dir(90), 3), poolY: TOP + 0.06, beam: false });
    M.deadGlass.userData.lamp.value.set(lampAt[0], lampY, lampAt[1], lampR * 0.55);
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
    // (the one at 235, not 265: from the stand that is straight behind the lit
    // globe and just under it, so through the balusters the two read as one
    // lamp twice the height)
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
    // room that is about stopping. (The draw for a reader who once stood down
    // on the floor by the rail is still made: the world's random stream is
    // shared.)
    rr(0, Math.PI * 2);
    {
      const top = TOP;
      const face = 112;   // toward the room, a little round from the stand
      const ry = Math.atan2(Math.cos(face * deg), Math.sin(face * deg));
      // The seat is clear of both arriving flights, with the feet and hem
      // inside the kerb. The lamp hangs to its front and left.
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
  // Two of them turned down. Full, the one hung in the Vestibule's arch is the
  // brightest thing in the view through it, so the eye stops in the doorway
  // instead of going on into the Echo; the one past the Silence is warmer than
  // the Silence's own last lamp.
  for (const [i, j, k, strength] of [[0, 0, 2, 1], [0, 0, 5, 0.5], [1, -1, 5, 1], [2, -2, 5, 0.4]]) {
    lamp(hallMid(i, j, k), { y: 46, strength, pool: 0.34 * strength, poolSize: 130, r: 5 });
  }
}
