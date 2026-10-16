// III — the Silence (buildWorld.js, assembleWorld).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from '../textures';
import { readerMaterial } from '../walkers';
import { ROBE, BOUNCE, SHEEN, DEAD_EMBERS } from '../silenceProps';
import { readerGeometry } from '../readers';
import { deg, MASS_H } from '../build/common';
import { sootOver } from '../ashlarSurface';

// The pale ashlar (common.js `pale`, 42 units a tile) as painted, measured off
// the texture: beds at 0, 197, 484 and 689 px of 1024, and the last course,
// the tallest, two blocks long with its joints at 287 and 787 px (blocks of
// 20.5 and 21.5 units). v 38.75 (945 px) is the strip of it with the fewest
// soot streaks — in a band one unit tall a streak reads as one more joint —
// and with the tallest piece here on it (2.8, the flights' ends) still 1.7
// units clear of the bed under it.
const COURSE_V = 38.75;
// Half a block: a course shifted by it has no joint within 10 units of one
// in the course under it.
const BOND = 10.5;

// Lays uvs on a band of the drum: `centre` [x, z] and the bearing `b0` it is
// measured round from (degrees, as `dir`), `R` the radius the arc length is
// counted at, `k` the course (alternate ones bonded), `yMid` / `rMid` the
// middle of the band's height and depth.
export function coursedUv(geo, { centre, b0, R, k, yMid, rMid }) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const pos = g.attributes.position, nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const shift = (k % 2) * BOND;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - centre[0], dz = pos.getZ(i) - centre[1], y = pos.getY(i);
    const r = Math.hypot(dx, dz);
    let b = (Math.atan2(dz, dx) * 180) / Math.PI;
    while (b < b0 - 1) b += 360;
    const along = ((b - b0) * Math.PI / 180) * R + shift;
    const ny = Math.abs(nor.getY(i));
    const radial = r > 1e-6 ? Math.abs((nor.getX(i) * dx + nor.getZ(i) * dz) / r) : 0;
    if (ny > 0.7) { uv[i * 2] = along; uv[i * 2 + 1] = COURSE_V + (r - rMid); }          // soffit / top
    else if (radial > 0.3) { uv[i * 2] = along; uv[i * 2 + 1] = COURSE_V + (y - yMid); } // the face
    else { uv[i * 2] = shift + (r - rMid); uv[i * 2 + 1] = COURSE_V + (y - yMid); }      // a cut end
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.userData.uvOwn = true;
  return g;
}

// A flat face, `a` to `b` along the ground ([x, z]) and `y0` to `y1` up,
// coursed the same way (`k` as above): u along it, v up it.
export function coursedFace(a, b, y0, y1, k) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const g = new THREE.PlaneGeometry(len, y1 - y0);
  g.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0]));
  g.translate((a[0] + b[0]) / 2, (y0 + y1) / 2, (a[1] + b[1]) / 2);
  const uv = g.attributes.uv, shift = (k % 2) * BOND;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, shift + uv.getX(i) * len, COURSE_V + (uv.getY(i) - 0.5) * (y1 - y0));
  g.userData.uvOwn = true;
  return g;
}

export function buildSilence(ctx) {
  const { rr, pick, dir, add, dist, rot3, keep, root, centre, slabGeo, placed,
    profileGeo, qNum, cellC, hallMid, flightProfile, stoneRail, FLIGHT_RAIL,
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
    const TERRACE_OUT = qNum('wterraceout', 6);
    const TOP = flightProfile({ from: 9 }).pitch(0);
    const seat = add(add(c, dir(64), 11.5), dir(253), 3);
    for (const ang of [240, 300]) {
      const f = flightProfile({ from: 9, to: 18 });
      LB.step.add(profileGeo(f.pts, 13, c, ang));
      const inner = ang === 240 ? 1 : -1;
      // The flanks are one face of the flights' own stone, as the Echo's are:
      // dressed in the dark cap stone, the string, corona, ring course and kerb
      // each stood proud of the next as a flat band of its own.
      flightDress(c, ang, f, 6.9, { ends: [false, true], gap: (side) => [-1, side === inner ? INNER : OUTER], stone: LB.capShade, worn: false, keyThrough: false, plane: true, face: LB.flank });
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
    // deck, kerb and coping, with a continuous stone balustrade around the
    // free arc. Its slender members leave the reader visible between them.
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
      const FC = add(c, dir(90), TERRACE_OUT);
      const N0 = add(c, dir(A0), RN), N1 = add(c, dir(A1), RN);
      const bearing = (p) => (Math.atan2(p[1] - FC[1], p[0] - FC[0]) / deg + 360) % 360;
      const RF = dist(FC, N0), LF = RF + (LAND - RN);
      const B0 = bearing(N0), B1 = bearing(N1) + 360;
      const arc = (r, n = 28) => Array.from({ length: n + 1 }, (_, k) => add(FC, dir(B0 + ((B1 - B0) * k) / n), r));
      // (each band a course of its own, bonded with the next: silence.js)
      const band = (r0, r1, y0, h, stone = LB.cap, k = 0) => {
        const g = slabGeo([...arc(r1, 40), ...arc(r0, 40).reverse()], [], h, y0);
        stone.add(coursedUv(g, { centre: FC, b0: B0, R: LF, k, yMid: y0 + h / 2, rMid: (r0 + r1) / 2 }));
      };
      // A slab, not a drum. As a solid disc down to the arches' soffit, with a
      // cone under it, the landing reads as a font or a pulpit standing on the
      // well, and not as the place two flights come to rest. Thin, it is
      // carried out over the well on the flights' own stone. (Behind the newels
      // — over the crowns, between the flights — it keeps the round.)
      const back = Array.from({ length: 21 }, (_, k) => add(c, dir(A1 + ((A0 + 360 - A1) * k) / 20), LAND));
      LB.step.add(slabGeo([...arc(LF, 40), ...back.slice(1, -1)], [], 3.4, TOP - 3.4));
      // (the kerb carried down over the slab's edge, which showed between it
      // and the corona as a pale seam of paving: silence.js)
      band(LF - 1.6, LF + 0.03, TOP - 0.45, 2.05, LB.cap, 1);
      band(LF - 1.05, LF + 1.15, TOP + 1.6, 0.85, LB.cap, 0);   // its coping
      band(LF - 0.5, LF + 0.82, TOP - 2.45, 1.2, LB.cap, 1);    // the string
      band(LF - 0.5, LF + 1.15, TOP - 1.25, 0.8, LB.cap, 0);    // its corona
      // a fillet under the slab — on the round landing only. The terrace's
      // wider arc turns the ends of its underside to the floor, and from the
      // stand they would be two pale lenses hung under it, in the pale stone or
      // the dark (or the slab's own, paler still); without it the slab ends in
      // its string.
      // Under the string, a skin of the flights' stone over the slab's own
      // edge: bare, the paving's flag texture ran down its face and its lower
      // arris printed from the floor as a bright chipped crack along the whole
      // underside of the terrace.
      band(LF - 0.3, LF + 0.03, TOP - 3.4, 0.95, LB.capShade, 0);
      // Under the slab, between the two arches, the two flights' cut ends
      // (each flight is the half from the axis out, so it ends in a bare
      // section through the stair), in the paving the treads are laid in and
      // projected edge on: from the stand, two flat squares. Faced in the
      // flights' stone, coursed like the drum over them (below). Half
      // of each is buried in the other flight.
      
      for (const ang of [240, 300]) {
        const f = flightProfile({ from: 9, to: 18 });
        const out = add(c, dir(ang + 180), 0.03), px = dir(ang + 90);
        LB.capShade.add(coursedFace(add(out, px, -6.5), add(out, px, 6.5), f.soffit(f.u0), TOP - 3.4, 1));
      }
      const base = TOP + 2.45, railY = TOP + 8.4;
      const length = (B1 - B0) * deg * RF;
      const bear = (s) => B0 + s / (RF * deg);
      const delicate = {
        ...FLIGHT_RAIL, railH: 1.0, baseH: 0.72, r: 0.56,
        rail: FLIGHT_RAIL.rail.map(([z, y, sharp]) => [z * 0.85, y * 1.0 / FLIGHT_RAIL.railH, sharp]),
        base: FLIGHT_RAIL.base.map(([z, y, sharp]) => [z * 0.9, y * 0.72 / FLIGHT_RAIL.baseH, sharp]),
      };
      stoneRail(LB.balustradeShade, {
        at: (s) => add(FC, dir(bear(s)), RF), foot: () => base, top: () => railY,
        knots: Array.from({ length: 41 }, (_, k) => k / 40 * length), clear: [1.5, 1.5],
        ry: (s) => -(bear(s) + 90) * deg, S: delicate,
      });
      // a small boss under the middle, and no more
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.1, 0.7, 0.8, 16), FC, TOP - 3.8));
    }
    // Along the free arc, beside the book: its light reaches the page and
    // hood from the front, then falls down the coping and the slab's face.
    const lampAt = add(c, [-3, 20]), lampY = TOP + 10.2, lampR = 3;
    lamp(lampAt, { y: lampY, lightY: lampY, r: lampR, light: 2600, priority: 6, color: '#ffc98e', strength: 0.85, haze: 0.3, pool: 0.2, poolSize: 18, poolAt: add(seat, dir(90), 3), poolY: TOP + 0.06, beam: false });
    M.deadGlass.userData.lamp.value.set(lampAt[0], lampY, lampAt[1], lampR * 0.55);
    // Not all of them are out: three are going out, no two with the same left
    // in them, spread through the room's heights so that what the eye finds
    // overhead is lamps dying rather than a ceiling of dead glass
    // (silenceProps.js).
    const ember = (a) => (DEAD_EMBERS[a] ?? 0);
    for (const a of [15, 75, 168, 122, 330]) lamp(add(c, dir(a), rr(52, 64)), { out: true, ember: ember(a), r: rr(7.5, 9), ...(a === 122 ? { y: 82 } : {}) });
    // More that have gone out, at other heights, so the dark globes are a
    // room's worth and not a row — and one that fell: its chain still hangs
    // where it was, and the glass lies broken on the floor under it.
    // (the one at 235, not 265: from the stand that is straight behind the lit
    // globe and just under it, so through the balusters the two read as one
    // lamp twice the height)
    // (and the one at 40 at 235, over the stand's left: silenceProps.js)
    for (const [a, rad, y, r] of [[45, 30, 74, 8], [110, 44, 58, 7], [185, 30, 82, 8.5], [40, 62, 56, 7.5]]) {
      lamp(add(c, dir(a), rad), { out: true, ember: ember(a), y, r });
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
      const seated = new THREE.Mesh(keep(set(readerGeometry({ seed: 2262, color: ROBE, seated: true }))), seatedLook.mat);
      // (its geometry is laid in the world, so the book is put there with it)
      const bk = seated.geometry.userData.book;
      if (bk) {
        const b = new THREE.Vector3(...bk).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(seat[0], top, seat[1]));
        seatedLook.u.uBook.value.set(b.x, b.y, b.z, 1);
      }
      // the lamp's pool on the stone at the reader's feet, thrown back up
      // onto the robe's front, the hands and the face (silenceProps.js)
      {
        const g = add(seat, dir(face), BOUNCE.ahead);
        seatedLook.u.uGlow.value.set(g[0], top + BOUNCE.rise, g[1], BOUNCE.k);
        seatedLook.u.uSheen.value = SHEEN;
      }
      // The lamp's light wraps onto the wool, and the lit page reflects a
      // little more of it up into the bowed hood.
      seatedLook.u.uLitK.value.set(1, 1.2, 1.6);
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
    const at = hallMid(i, j, k);
    lamp(at, { y: 46, strength, pool: 0.34 * strength, poolSize: 130, r: 5 });
    // (and over it, on the hallway's vault, its soot: ashlarSurface.js, 4)
    sootOver([at[0], 46 + 2.75, at[1]], 0.8);
  }
}
