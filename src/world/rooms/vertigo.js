// IV — the Vertigo (buildWorld.js, assembleWorld): the well of books and the
// stair that goes on down it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LAMPS, stairSconce } from '../lampPass';
import { makeRng } from '../textures';
import { BOOKS_GIANT, shaftVolume, spineAt, titleAt, makeLampGlobeMaterial } from '../effects';
import { WELL, vertigoOld, bookHash, MISSING, shelfLip } from '../vertigoFix';
import { silenceOld, CROWN_BACK } from '../silenceFix';
import { SPIRAL, GAPS, BRINK_OLD, makeEndlessSpiral, spiralAt, bookAt } from '../spiral';
import { VLAND_OLD, VRAIL_OLD, buildVertigoRail, endlessRail } from '../vertigoRail';
import { WOOD_OLD, ringGrain } from '../woodGrain';
import { deg, MASS_H, CAP, SHELVES, BOOK_ROWS, TIER_BASE, TIER_H, TIERS, shelvesOf, BOARD } from '../build/common';

export function* buildVertigo(ctx) {
  const { light, paintings, rnd, stream, rr, pick, dir, add, hexPts, circlePts, keep, paint, tex,
    withRepeat, again, pale, wood, bookRowsSet, rowV, lampHaloTex, shaftMaterial, Std, M, root,
    Batch, slabGeo, boxGeo, placed, rodGeo, instances, decal, halos, halo, lightWishes, point, A,
    AC, RC, HALL, cellC, mouldGeo, LB, balusters, shelved, shelvedWalls, lodFor, books, lampCores,
    globes, dust, trialPanes, BOOKS, lamp, hangPainting, RAIL_H, railRun } = ctx;
  // IV — the Vertigo: a round pit, a stair winding down a funnel of books to one light.
  const PIT = cellC(3, -3);
  // (the well's light is graded round this, patched in before the build: vertigoFix.js, 4)
  if (import.meta.env?.DEV && Math.hypot(PIT[0] - WELL.c[0], PIT[1] - WELL.c[1]) > 0.01) console.error('vertigoFix: WELL.c is not the pit', PIT, WELL.c);
  let pitCore = null;
  // (the stair's own stone, darkened with depth over the map: mapFix.js, 7)
  let pitCarved = null;
  // (the rest of the light at the bottom, moved down with the disc: see `sink`)
  let pitSink = null;
  let stairAt = null, spiral = null;
  let drift = null;   // the loose pages falling down the well, moved by tick
  {
    const c = PIT, rWall = 101, rMouth = 68;
    // The face of the bookcase that lines the room, 12 in front of the wall.
    const rFace = rWall - 12;
    // The way in is a hallway like every other: stone to either hand, the
    // gallery's arch over it, and a dressed face where it meets the room. That
    // face stands where a gallery's inner wall does, `A` from the centre, which
    // is where the bookcase's front crosses the hallway's walls — so the
    // passage goes on through the depth of the shelves, and the bookcase stops
    // at a stone pier either side of it, cut radially at `jambA`.
    //
    // It stopped at the wall behind the books. Every ring of shelving ran
    // straight across the doorway — the lowest a wooden step at the shins, the
    // others planks barring the opening at head height and above — and the
    // arch, built as deep as a gallery's wall is thick, stood out past the
    // stone into the room with its pilasters free in front of the books.
    const jambA = Math.acos(A / rFace) / deg;
    // The wall round the pit, between its round mouth and the edge of the cell,
    // cut through by the one hallway in — so it is not a ring at all but a C,
    // and is built as one. (As a ring with a keyhole in it, the keyhole had to
    // stop short of the cell's edge, and the stone it stopped short by stood
    // across the hallway: see wallRing.)
    const pitWall = (() => {
      const axis = 150;
      const local = (along, across) => add(add(c, dir(axis), along), dir(axis + 90), across);
      const pts = [];
      for (let s = 0; s <= 80; s++) pts.push(add(c, dir(axis + jambA + ((360 - 2 * jambA) * s) / 80), rWall));
      pts.push(add(c, dir(axis - jambA), rFace));
      pts.push(local(A, -HALL / 2));
      pts.push(local(AC, -HALL / 2));
      for (let k = 0; k < 6; k++) pts.push(add(c, dir(axis - 30 - 60 * k), RC));
      pts.push(local(AC, HALL / 2));
      pts.push(local(A, HALL / 2));
      pts.push(add(c, dir(axis + jambA), rFace));
      return pts;
    })();
    // A ring of the bookcase, open across the doorway.
    const caseArc = (r) => Array.from({ length: 81 }, (_, s) => add(c, dir(150 + jambA + ((360 - 2 * jambA) * s) / 80), r));
    const caseRing = [...caseArc(rWall), ...caseArc(rFace).reverse()];
    LB.mass.add(slabGeo(pitWall, [], MASS_H, 0));
    LB.cap.add(slabGeo(pitWall, [], CAP, MASS_H));
    {
      const ring = [];
      for (let s = 0; s <= 72; s++) {
        const a = (360 * s) / 72;
        if (Math.abs(((a - 150 + 540) % 360) - 180) < 16) { ring.push(null); continue; }
        ring.push(add(c, dir(a), rWall + 3.5));
      }
      ring.forEach((p, s) => { if (p && ring[s + 1]) railRun(p, ring[s + 1]); });
      // a blind back behind the posts, so the sky is over the rail and not
      // between its posts (silenceFix.js, 5)
      if (!silenceOld(5)) {
        ring.forEach((p, s) => {
          const q = ring[s + 1];
          if (!p || !q) return;
          const out = (r) => add(c, dir(Math.atan2(r[1] - c[1], r[0] - c[0]) / deg), rWall + 3.5 + CROWN_BACK.out);
          LB.rail.add(boxGeo(out(p), out(q), RAIL_H, CROWN_BACK.t, MASS_H + CAP));
        });
      }
    }
    LB.floor.add(slabGeo(hexPts(c, RC), [circlePts(c, rMouth, 80)], 6, 0));
    // the bronze rim, open where the stair begins its way down (?wvrail=old:
    // the rail is otherwise iron and walnut, laid below, vertigoRail.js)
    for (let s = 0; s < 80 && VRAIL_OLD; s++) {
      const a0 = (360 * s) / 80, a1 = (360 * (s + 1)) / 80;
      if (a1 > 156 && a0 < 184) continue;
      LB.bronze.add(boxGeo(add(c, dir(a0), rMouth + 1.3), add(c, dir(a1), rMouth + 1.3), 9, 2.6, 6));
    }
    // (0.5, under the pools' plane at 6.6: see the rings round the wells)
    LB.inlay.add(slabGeo(circlePts(c, rMouth + 17, 80), [circlePts(c, rMouth + 14.5, 80)], 0.5, 6));
    // Pale vellum and calf near the rim, dark leather down the throat, so the
    // funnel falls away in value before any lamp says how deep it is. Chosen by
    // where a book stands rather than drawn: every draw here belongs to the
    // garden (see `resume`), and the draws the first colours made are still
    // made.
    //
    // More vellum at the rim and black soon, so the fall in value is the first
    // thing the funnel says — and then, in the last turns, the books warmed
    // again by the light they stand over.
    const warmed = new THREE.Color(), litFrom = new THREE.Color('#c88a4c');
    const funnelColor = (p, y) => {
      const h = Math.abs(Math.sin(p[0] * 12.9898 + p[1] * 78.233 + y * 3.137) * 43758.5453) % 1;
      const deep = Math.min(1, Math.max(0, (6 - y) / 260));
      const odds = [
        ['#a89a7b', '#9d8f70', '#b0a283', 0.38 * (1 - deep) ** 2],
        ['#8a6341', '#7d5738', '#6f4c31', 0.42 - 0.18 * deep],
        ['#5a2923', '#662e25', '#4f2420', 0.12 + 0.04 * deep],
        ['#2d3a2b', '#333d29', '#283426', 0.08 + 0.04 * deep],
        ['#221d19', '#2a241f', '#1e1a17', 0.08 + 0.42 * deep],
      ];
      const total = odds.reduce((n, o) => n + o[3], 0);
      let r = h * total, hex = odds[1][0];
      for (const o of odds) { r -= o[3]; if (r <= 0) { hex = o[Math.floor(h * 997) % 3]; break; } }
      const glow = Math.min(1, Math.max(0, (-250 - y) / 180));
      return glow > 0 ? `#${warmed.set(hex).lerp(litFrom, 0.38 * glow * glow).getHexString()}` : hex;
    };
    // Real books round the rings, not giants 12-18 tall and 9 deep. A ring is
    // shelved bay by bay, from bearing `from` to `to` (degrees), in sets of a
    // binding's volumes standing on `sy` with `clear` over them, their spines a
    // finger's breadth behind the shelf's face at radius `rf`; coloured where a
    // set starts, as the giants were where they stood. On a stream of their
    // own: every draw on the world's here belongs to the garden (see `resume`).
    const vr = makeRng(0x7e5d1);
    const shelveRing = (t, sy, clear, rf, from, to, wall) => {
      const S = SHELVES[t], within = ([lo, hi]) => lo + (hi - lo) * vr();
      let a = from + (vr() * 0.2) / rf / deg, run = 0, R = null, lean = 0;
      while (a < to) {
        if (run <= 0) {
          // now and then one taken out, and its neighbour leaning into the gap
          if (vr() < 0.03) { const g = 0.35 + vr() * 0.45; a += g / rf / deg; lean = g; continue; }
          const p = add(c, dir(a), rf), at = [p[0], sy, p[1]];
          R = {
            n: vr() < 0.22 ? 1 : 2 + Math.floor(vr() * vr() * 8), h: within(S.h), w: within(S.w), d: within(S.d),
            set: 0.1 + vr() * 0.6, color: funnelColor(p, sy), k: 0.8 + vr() * 0.3, spine: spineAt(at), title: titleAt(at),
          };
          run = R.n;
        }
        const w = R.w * (1 + (vr() - 0.5) * 0.06), hh = Math.min(clear - 0.3, R.h * (1 + (vr() - 0.5) * 0.025));
        if (a + w / rf / deg > to) break;
        const book = { wall, color: R.color, k: R.k * (0.96 + vr() * 0.08), spine: R.spine, title: R.title + (R.n > 1 ? 1000 * (R.n - run + 1) : 0) };
        // now and then one gone from its set as well, and the next leaning
        // into its room (vertigoFix.js, 2: by where it stood, so the stream
        // draws as it did)
        if (!vertigoOld(2) && !lean && bookHash(a, sy) < MISSING) {
          a += (w + 0.006 + vr() * 0.035) / rf / deg;
          lean = w * 0.9;
          run--;
          continue;
        }
        // (pivoted on its foot at the edge of the gap, its head on the book across it)
        const th = lean ? Math.min(0.36, Math.asin(Math.min(0.9, lean / hh))) : 0;
        const am = a + ((w / 2) * Math.cos(th) - (hh / 2) * Math.sin(th)) / rf / deg, p = add(c, dir(am), rf + R.set + R.d / 2);
        shelved.push({ ...book, p: [p[0], sy + (w / 2) * Math.sin(th) + (hh / 2) * Math.cos(th), p[1]], rot: [0, -(am + 90) * deg, th], s: [w, hh, R.d] });
        a += (w * Math.cos(th) + 0.006 + vr() * 0.035) / rf / deg;
        lean = 0;
        run--;
      }
    };
    // A ring's books painted (bookRows), where they are only seen from far
    // off: a strip bent round the ring a little in front of the shelf's face.
    // `tint` (rgb) takes it down the funnel's fall in value.
    const paintedRing = (batch, t, sy, clear, rf, from, to, tint = null) => {
      const { top: vt, base: vb } = rowV[t * BOOK_ROWS.variants + Math.floor(vr() * BOOK_ROWS.variants)];
      const segs = Math.max(1, Math.ceil((to - from) / 4)), r = rf + 0.4, u0 = vr();
      const pos = [], nor = [], uv = [], col = [], idx = [];
      for (let i = 0; i <= segs; i++) {
        const a = from + ((to - from) * i) / segs, p = add(c, dir(a), r), n = dir(a);
        const u = u0 + ((a - from) * deg * r) / BOOK_ROWS.length;
        pos.push(p[0], sy, p[1], p[0], sy + clear, p[1]);
        nor.push(-n[0], 0, -n[1], -n[0], 0, -n[1]);
        uv.push(u, vb, u, vt);
        if (tint) col.push(...tint, ...tint);
      }
      // (wound to face the axis: seen from the middle, the next bearing is to the right)
      for (let i = 0; i < segs; i++) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      if (tint) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      batch.add(g);
    };
    // a ring of board between two radii, over the bearings from `a0` to `a1`
    const arcSlab = (r0, r1, a0, a1) => {
      const n = Math.max(2, Math.ceil((a1 - a0) / 2.5));
      const arc = (r) => Array.from({ length: n + 1 }, (_, s) => add(c, dir(a0 + ((a1 - a0) * s) / n), r));
      return [...arc(r1), ...arc(r0).reverse()];
    };
    // The room's shelves run from jamb to jamb round from the doorway (150),
    // and in the three lower tiers stop either side of the painting (270).
    const jamb0 = 150 + jambA + 1.3, jamb1 = 510 - jambA - 1.3;
    const roomBays = (tier) => (paintings && tier < 3 ? [[jamb0, 244], [296, jamb1]] : [[jamb0, jamb1]]);
    if (!BOOKS_GIANT) {
      // the case's back brought forward to stand behind the books
      const backY = TIER_BASE + 3 * TIER_H, topY = TIER_BASE + TIERS * TIER_H;
      for (const [a0, a1] of roomBays(0)) LB.shelfBack.add(ringGrain(slabGeo(arcSlab(rFace + 4.6, rFace + 5.6, a0, a1), [], backY - TIER_BASE, TIER_BASE), c[0], c[1]));
      LB.shelfBack.add(ringGrain(slabGeo(arcSlab(rFace + 4.6, rFace + 5.6, jamb0, jamb1), [], topY - backY, backY), c[0], c[1]));
    }
    for (let tier = 0; tier < TIERS; tier++) {
      yield;
      const y = TIER_BASE + tier * TIER_H;
      LB.shelf.add(ringGrain(slabGeo(caseRing, [], 2.4, y - 2.4), c[0], c[1]));
      if (!vertigoOld(3)) LB.shelfLip.add(shelfLip(c, rFace, y, y - 2.4, 150 + jambA, 510 - jambA));
      for (let s = 0; s < 170; s++) {
        const a = (360 * s) / 170, off = Math.abs(((a - 150 + 540) % 360) - 180);
        if (off < 12) continue;
        if (paintings && tier < 3 && Math.abs(((a - 270 + 540) % 360) - 180) < 26) continue;
        const p = add(c, dir(a), rWall - 5.5), hh = rr(12, TIER_H - 3), w = rr(2.6, 3.6), color = pick(BOOKS);
        // The books where the doorway's piers now stand are still drawn: the
        // garden is laid out from the same stream (see `resume`). And so are
        // the giants (?wbookscale=old), real books shelved below in their place.
        if (off < jambA + 1.3 || !BOOKS_GIANT) continue;
        books.push({ p: [p[0], y + hh / 2, p[1]], rot: [0, -(a + 90) * deg, 0], s: [w, hh, 9], color: color && funnelColor(p, y) });
      }
      if (BOOKS_GIANT) continue;
      // A box to every book in the three tiers the eye is level with; the
      // two over them, seen only from far below, painted.
      const wall = shelvedWalls.n++;
      shelvesOf(tier, y).forEach(({ y: sy, clear }, j) => {
        for (const [a0, a1] of roomBays(tier)) {
          if (j > 0) LB.shelf.add(ringGrain(slabGeo(arcSlab(rFace, rFace + 4.6, a0, a1), [], BOARD, sy - BOARD), c[0], c[1]));
          if (j > 0 && !vertigoOld(3)) LB.shelfLip.add(shelfLip(c, rFace, sy, sy - BOARD, a0, a1));
          if (tier < 3) {
            shelveRing(tier, sy, clear, rFace, a0, a1, wall);
            paintedRing(lodFor(wall, 3), tier, sy, clear, rFace, a0, a1);
          } else paintedRing(LB.bookRows, tier, sy, clear, rFace, a0, a1);
        }
      });
    }
    // ── The funnel ──
    // Below the floor the pit narrows 460 down to a throat of light, lined the
    // whole way with shelves set back into its stone. The stair winds down the
    // face of them on a carved carriage bracketed into the wall, its open side
    // railed in bronze — but for the one place, a few steps down, where the
    // rail has given way and the fall begins (and the same place on every turn
    // below it: spiral.js GAPS). Lamps hang in the well at every depth, so that
    // looking down there is something to measure the drop by, and loose pages
    // turn slowly all the way down it. (A smooth brown cone with a disc of
    // light at the bottom has nothing in it to say how far down the light is.)
    //
    // All of this draws on the world's random stream far more than a plain
    // funnel, and the garden is laid out from that same stream: `resume` puts
    // the stream back where the first funnel left it (see the end).
    const resume = stream.seed;
    const { depth: DEPTH, neck: NECK, drop: DROP, steps: STEPS, turns: TURNS } = SPIRAL;
    const RECESS = 12;
    // Keep the risers walkable on every device. Reducing this to 120 made
    // sideways foot support drop farther than a tread on the curved flight.
    // where the rail is gone (spiral.js): a stretch of every turn, at the same
    // bearing (the Vertigo's stand is in the first, at 0.06) — and between
    // them, where it still stands
    const RAILED = [...GAPS.map((g, k) => [k ? GAPS[k - 1][1] : 0, g[0]]), [GAPS.at(-1)[1], 1]];
    const inGap = (t) => GAPS.some(([t0, t1]) => t >= t0 && t <= t1);
    const coneR = (y) => rMouth + (NECK - rMouth) * ((6 - y) / DEPTH);   // the face of the shelves at a height
    const treadW = () => SPIRAL.width;
    const bearing = (t) => 170 + t * TURNS * 360;
    const inner = (t) => coneR(4 - t * DROP) - treadW(t) - 1;           // the stair's open edge
    const facing = (a) => Math.PI / 2 - a * deg;                         // turns a box's +z out along bearing a
    // where the stair is, a fraction `t` of the way down: its tread, its bearing, its open edge
    stairAt = (t) => spiralAt(c, t);
    const carved = new Batch(Std({
      map: again(pale.map, 1), normalMap: again(pale.normalMap, 1), roughnessMap: again(pale.roughnessMap, 1),
      color: '#b3a796', roughness: 1, side: THREE.DoubleSide,
    }));
    const nosings = new Batch(M.nosing, { project: true });

    // the dark wood at the back of the shelves
    // (5 behind the face for real books, 12 for the giants)
    const BACK = BOOKS_GIANT ? RECESS : 5;
    const back = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(rMouth + BACK, NECK + BACK, DEPTH, light ? 48 : 96, 1, true)),
      Std({ map: withRepeat(wood.map, WOOD_OLD ? [36, 26] : [16, 46]), color: '#4a3a2e', roughness: 1, side: THREE.BackSide }),
    );
    back.position.set(c[0], 6 - DEPTH / 2, c[1]);
    back.receiveShadow = true;
    root.add(back);
    // The funnel's painted rows (see below): the far shelves' paint, with the
    // giants' fall in value as a colour per ring and the light at the bottom
    // of the well climbing its last turns, as the books' own shader has it.
    const funnelRowsMat = Std({ map: bookRowsSet.map, roughness: 0.85, vertexColors: true });
    funnelRowsMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
        varying float vDeep;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        vDeep = pow(smoothstep(-150.0, -440.0, (modelMatrix * vec4(transformed, 1.0)).y), 1.5);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
        varying float vDeep;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.62, 0.32) * vDeep * 0.9;`);
    };
    funnelRowsMat.customProgramCacheKey = () => 'babel-funnel-rows';
    const funnelRows = new Batch(funnelRowsMat, { cast: false });
    // uprights down the slope of the funnel between the bays
    const UPRIGHTS = light ? 12 : 18, slope = Math.atan((rMouth - NECK) / DEPTH), uprightAt = [];
    for (let k = 0; k < UPRIGHTS; k++) {
      const a = (360 * k) / UPRIGHTS + 7, yMid = 6 - DEPTH / 2, p = add(c, dir(a), coneR(yMid) + RECESS / 2);
      uprightAt.push(a);
      LB.shelf.add(new THREE.BoxGeometry(2.6, DEPTH / Math.cos(slope), RECESS).rotateX(slope).rotateY(facing(a)).translate(p[0], yMid, p[1]));
    }
    // a shelf every tier, and its books
    for (let k = 0; (k + 1) * TIER_H < 6 + DROP; k++) {
      yield;
      const y = 6 - (k + 1) * TIER_H, face = coneR(y), n = light ? 40 : 80;
      LB.shelf.add(ringGrain(slabGeo(circlePts(c, face + RECESS + 0.5, n), [circlePts(c, face - 0.6, n)], 2.4, y - 2.4), c[0], c[1]));
      if (!vertigoOld(3)) LB.shelfLip.add(shelfLip(c, face - 0.6, y, y - 2.4, 0, 360, 360 / n));
      const rs = face + 5.3;
      for (let u = rr(0, 3); u < 2 * Math.PI * rs - 3;) {
        const w = rr(2.3, 4.4), a = (u + w / 2) / rs / deg;
        const clear = !uprightAt.some((ua) => Math.abs(((a - ua + 540) % 360) - 180) * deg * rs < 1.5 + w / 2);
        if (clear && rnd() > 0.035) {
          const hh = rr(11, k === 0 ? 13 : 17.5), p = add(c, dir(a), rs);
          const tip = rnd() < 0.05 ? rr(-0.25, 0.25) : 0, color = pick(BOOKS) && funnelColor(p, y), shade = rr(0.7, 1.05);
          // On the four shelves nearest the head of the stair, shelved by hand:
          // one taken out here and there, others leaning into the room it left,
          // some pushed to the back. Every book stood upright at one depth
          // reads as rings of bricks. Decided by where the book stands — the
          // draws above are the garden's (see `resume`), all still made.
          const h = k < 4 ? Math.abs(Math.sin(p[0] * 39.346 + p[1] * 11.135 + y * 7.11) * 24634.6345) % 1 : 1;
          if (h >= 0.06 && BOOKS_GIANT) {
            const lean = h < 0.2 ? (h < 0.13 ? 1 : -1) * (0.1 + 0.14 * ((h * 53) % 1)) : tip;
            const q = h > 0.2 && h < 0.29 ? add(c, dir(a), rs + 1.8) : p;
            books.push({ p: [q[0], y + hh / 2, q[1]], rot: [0, -(a + 90) * deg, lean], s: [w, hh, 9], color, k: shade });
          }
        }
        u += w + rr(0.12, 0.8);
      }
      if (BOOKS_GIANT) continue;
      // Real books: four shelves of quartos to a giant's one, each a little
      // wider round than the one below it as the funnel opens upward, between
      // the uprights. Boxes in the seven rings the stair's head looks across
      // and down into; deeper, where the funnel is only ever looked down into
      // from far above, painted, and taken down in value and warmed by the
      // light below as the giants' colours were.
      const wall = shelvedWalls.n++;
      const T = 1, n2 = light ? 40 : 80;
      shelvesOf(T, y).forEach(({ y: sy, clear }, j) => {
        const rf = coneR(sy);
        if (j > 0) LB.shelf.add(ringGrain(slabGeo(circlePts(c, rf + BACK + 0.5, n2), [circlePts(c, rf - 0.6, n2)], BOARD, sy - BOARD), c[0], c[1]));
        if (j > 0 && !vertigoOld(3)) LB.shelfLip.add(shelfLip(c, rf - 0.6, sy, sy - BOARD, 0, 360, 360 / n2));
        const half = 1.45 / rf / deg;
        const deep = Math.min(1, Math.max(0, (6 - sy) / 260)), glow = Math.min(1, Math.max(0, (-250 - sy) / 180)), v = 1.05 - 0.6 * deep;
        const tint = [0.78, 0.54, 0.3].map((lit) => v + (lit - v) * 0.38 * glow * glow);
        if (k < 7) {
          uprightAt.forEach((ua, i) => {
            const a0 = ua + half, a1 = (i + 1 < uprightAt.length ? uprightAt[i + 1] : uprightAt[0] + 360) - half;
            shelveRing(T, sy, clear, rf, a0, a1, wall);
          });
        }
        // (the paint all the way round, behind the uprights)
        paintedRing(k < 7 ? lodFor(wall, 3) : funnelRows, T, sy, clear, rf, uprightAt[0], uprightAt[0] + 360, k < 7 ? null : tint);
      });
    }

    // the treads, a sconce every so often on the wall string, books left on the steps
    for (let s = 0; s < STEPS; s++) {
      if (s % 32 === 0) yield;
      const t = s / STEPS, y = 4 - t * DROP, rf = coneR(y), a = bearing(t), w = treadW(t);
      const len = ((2 * Math.PI * (rf - w / 2) * TURNS) / STEPS) * 1.08;
      const run = Math.max(1.5, len), middle = add(c, dir(a), rf - w / 2 - 1);
      LB.step.add(placed(new THREE.BoxGeometry(w, 3, run), middle, y, -a * deg));
      // A rounded, worn arris catches the wall lantern along each tread front.
      const profile = new THREE.Shape([
        [-0.8, 1.52], [-0.12, 1.52], [0.08, 1.43], [0.18, 1.24],
        [0.08, 1.03], [-0.12, 0.94], [-0.8, 0.94],
      ].map(([z, h]) => new THREE.Vector2(run / 2 + z, h)));
      const lip = new THREE.ExtrudeGeometry(profile, { depth: w - 0.3, bevelEnabled: false })
        .rotateY(-Math.PI / 2).translate((w - 0.3) / 2, 0, 0);
      nosings.add(placed(lip, middle, y, -a * deg));
      if (s % Math.round(STEPS / 12) === 5) {
        const la = a + 1, lp = add(c, dir(la), rf - 3.4), stem = add(c, dir(la), rf - 0.9);
        // a small lantern on a wall bracket (lampPass.js; ?wlampsoff=sconce:
        // without it)
        const trial = LAMPS.sconce && stairSconce({ wall: add(c, dir(la), rf - 0.6), ry: (180 - la) * deg, y });
        if (trial) {
          trial.bronze.forEach((g) => LB.bronze.add(g));
          if (trial.globe) globes.push(trial.globe);
          if (trial.pane) trialPanes.push(trial.pane);
        } else {
          LB.bronze.add(rodGeo([stem[0], y + 5, stem[1]], [stem[0], y + 14.2, stem[1]], 0.32));
          LB.bronze.add(rodGeo([stem[0], y + 14, stem[1]], [lp[0], y + 13.4, lp[1]], 0.28));
          LB.bronze.add(placed(new THREE.CylinderGeometry(0.6, 1.25, 1, 12), lp, y + 13.2));
          globes.push({ p: [lp[0], y + 11.2, lp[1]], s: [1.5, 1.5, 1.5], color: '#fff3e2', k: 1.2 });
        }
        halo(lp, y + 11, 28, '#ffb866', 0.34, trial ? lampHaloTex : undefined);
        point(lp, y + 11, '#ffb866', 3400, -1);
      }
      if (s > 2 && s % 7 === 3 && rnd() < 0.5) {
        // Leave the middle of the tread clear. These low piles are solid to
        // the feet; set back beside the wall string they can be passed.
        const bp = add(c, dir(a + rr(-1, 1)), rf - 1.6 * (1 - t * 0.35)), yaw = -a * deg + rr(-0.35, 0.35);
        // (folios of 47-66 cm by 34-43, 10-18 thick, as the giants were; at
        // their real size, the draws as the giants' were)
        const pk = BOOKS_GIANT ? 1 : 0.42, pl = BOOKS_GIANT ? 1 : 0.76;
        for (let n = 0, top = y + 1.5, count = 1 + Math.floor(rnd() * 3); n < count; n++) {
          const th = rr(1.1, 1.9) * pk;
          books.push({ p: [bp[0], top + th / 2, bp[1]], rot: [0, yaw + rr(-0.2, 0.2), Math.PI / 2], s: [th, rr(5, 7) * (1 - t * 0.3) * pl, rr(3.6, 4.6) * pl],
            // lying down, a book shows its cover in the bindings' dark side
            // tone: shelf leather there reads as a hole in the stair, so paler
            // calf
            color: pick(['#8a6a48', '#7a5c40', '#6e5a44', '#5f6452', '#7a4a3a']), k: rr(0.9, 1.2) });
          top += th;
        }
      }
    }

    // A profile in (radius, height), swept down the stair from t0 to t1; `cap`
    // closes its top end, where the stair leaves the floor.
    const sweep = (profileAt, t0, t1, cap = false, uvScale = 36) => {
      const samples = Math.max(2, Math.ceil((t1 - t0) * STEPS * 3)), n = profileAt(t0).length;
      const pos = [], uv = [], index = [];
      let run = 0, last = null;
      for (let i = 0; i <= samples; i++) {
        const t = t0 + ((t1 - t0) * i) / samples, prof = profileAt(t), [ux, uz] = dir(bearing(t));
        const spot = [c[0] + ux * prof[0][0], prof[0][1], c[1] + uz * prof[0][0]];
        if (last) run += Math.hypot(spot[0] - last[0], spot[1] - last[1], spot[2] - last[2]);
        last = spot;
        for (let k = 0, around = 0; k < n; k++) {
          const [r0, y0] = prof[k], [r1, y1] = prof[(k + 1) % n], edgeLen = Math.hypot(r1 - r0, y1 - y0);
          pos.push(c[0] + ux * r0, y0, c[1] + uz * r0, c[0] + ux * r1, y1, c[1] + uz * r1);
          uv.push(run / uvScale, around / uvScale, run / uvScale, (around + edgeLen) / uvScale);
          around += edgeLen;
        }
      }
      for (let i = 0; i < samples; i++) {
        for (let k = 0; k < n; k++) {
          const a = (i * n + k) * 2, b = a + n * 2;
          index.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(index);
      g.computeVertexNormals();
      if (!cap) return g;
      const [ux, uz] = dir(bearing(t0));
      const end = new THREE.ShapeGeometry(new THREE.Shape(profileAt(t0).map(([r, y]) => new THREE.Vector2(r, y))));
      const ep = end.attributes.position, eu = end.attributes.uv;
      for (let i = 0; i < ep.count; i++) {
        const r = ep.getX(i), y = ep.getY(i);
        ep.setXYZ(i, c[0] + ux * r, y, c[1] + uz * r);
        eu.setXY(i, r / uvScale, y / uvScale);
      }
      end.computeVertexNormals();
      const merged = mergeGeometries([g.toNonIndexed(), end.toNonIndexed()], false);
      g.dispose();
      end.dispose();
      return merged;
    };
    const yAt = (t) => 4 - t * DROP;
    // the carriage: a closed string on the open side standing proud of the treads,
    // and a soffit under them sloping up into the wall
    const carriage = (t) => {
      const y = yAt(t), rw = coneR(y), ri = inner(t);
      return [[ri - 1.8, y + 2.2], [ri - 1.8, y - 8], [ri + 3, y - 9], [rw - 0.4, y - 4.5], [rw - 0.4, y - 2.6], [ri + 0.6, y - 2.6], [ri + 0.6, y + 2.2]];
    };
    carved.add(sweep(carriage, 0, 1, true));
    // A roll moulding along the top of the open string and a fillet under it:
    // the edge the eye crosses first, looking down, is no plain square arris.
    const roll = (t) => {
      const y = yAt(t) + 2.3, rc = inner(t) - 1.25;
      return Array.from({ length: 10 }, (_, k) => [rc + Math.cos((k * Math.PI) / 5) * 1.15, y + Math.sin((k * Math.PI) / 5) * 1.0]);
    };
    const fillet = (t) => {
      const y = yAt(t), ri = inner(t);
      return [[ri - 2.35, y - 0.5], [ri - 2.35, y - 1.7], [ri - 1.8, y - 1.7], [ri - 1.8, y - 0.5]];
    };
    carved.add(sweep(roll, 0, 1));
    carved.add(sweep(fillet, 0, 1));
    // the wall string, where the treads meet the shelves (at the stair's head
    // no higher than the floor: its first few degrees stood 2.8 proud of the
    // floor's edge, a plank across the way onto the stair)
    carved.add(sweep((t) => {
      const y = yAt(t), rw = coneR(y), top = VLAND_OLD ? y + 4.8 : Math.min(y + 4.8, 5.9);
      return [[rw - 1.5, top], [rw - 1.5, y - 3.2], [rw + 0.9, y - 3.2], [rw + 0.9, top]];
    }, 0, 1, true));
    // corbels under the carriage, into the wall
    for (let k = 1; k < (light ? 18 : 34); k++) {
      const t = k / (light ? 18 : 34), y = yAt(t), rw = coneR(y), a = bearing(t);
      for (const [depth, h, top, wide] of [[5, 6, -4.2, 3.2], [3, 4, -10, 2.6]]) {
        const p = add(c, dir(a), rw + 0.5 - depth / 2);
        carved.add(new THREE.BoxGeometry(wide, h, depth).rotateY(facing(a)).translate(p[0], y + top - h / 2, p[1]));
      }
    }
    // The stair's head. The stair's first tread begins at 166.5°, but the rim
    // round the mouth stops at 153°: for a stride beside the newel the floor
    // would just end over the drop, nothing to stand on, nothing to hold ("the
    // staircase has a weird hole that makes it look unsafe"). The floor runs on
    // over the pit to the first tread as a landing, carried on the stair's own
    // carriage swept back level under it, and the rim turns in along the
    // landing's end and runs on along its open edge to the newel. (?wvland=old:
    // no landing.)
    const LAND0 = 153;   // where the rim stops: a corner of the floor's 80-sided hole
    const beside = (a, r, off) => add(add(c, dir(a), r), dir(a + 90), off);
    if (!VLAND_OLD) {
      // the paving, its outer edge on the hole's own corners (so the floor's
      // joint is a joint, not a sliver of the two overlapping), and on a
      // little way over the first tread's back
      const back = 167.5, chord = (rMouth * Math.cos(2.25 * deg)) / Math.cos((back - 168.75) * deg), rIn = inner(0) + 0.1;
      const outer = [153, 157.5, 162, 166.5].map((a) => add(c, dir(a), rMouth));
      const edge = Array.from({ length: 9 }, (_, k) => add(c, dir(back - ((back - LAND0) * k) / 8), rIn));
      LB.floor.add(slabGeo([...outer, add(c, dir(back), chord), ...edge], [], 6, 0));
      // the carriage under it, level, closed at the landing's end
      const tHead = (LAND0 - 170) / (TURNS * 360), level = (prof) => () => prof(0);
      carved.add(sweep(level(carriage), tHead, 0, true));
      carved.add(sweep(level(roll), tHead, 0));
      carved.add(sweep(level(fillet), tHead, 0));
      for (const a of [157, 163]) {
        for (const [depth, h, top, wide] of [[5, 6, -4.2, 3.2], [3, 4, -10, 2.6]]) {
          const p = add(c, dir(a), coneR(4) + 0.5 - depth / 2);
          carved.add(new THREE.BoxGeometry(wide, h, depth).rotateY(facing(a)).translate(p[0], 4 + top - h / 2, p[1]));
        }
      }
      // (?wvrail=old) the rim, turned in along the landing's end and on along its edge
      if (VRAIL_OLD) {
        LB.bronze.add(boxGeo(beside(LAND0, rMouth + 2.6, 1.3), beside(LAND0, inner(0) - 1.9, 1.3), 9, 2.6, 6));
        for (let a = LAND0; a < 168; a += 4.5) LB.bronze.add(boxGeo(add(c, dir(a), inner(0) - 0.6), add(c, dir(Math.min(168, a + 4.5)), inner(0) - 0.6), 9, 2.6, 6));
      }
    }
    if (!VRAIL_OLD) {
      // The rail, iron and walnut (vertigoRail.js): round the mouth from
      // beside the stair to the landing, in along its end, along its edge to
      // the newel; and down the stair's open edge, but for the gap.
      const rimR = rMouth + 1.3, railR = inner(0) - 0.9;
      const turnIn = beside(LAND0, Math.sqrt(rimR ** 2 - 0.81), 0.9), atEdge = beside(LAND0, railR, 0.9);
      const rimTo = 360 + LAND0 + Math.asin(0.9 / rimR) / deg, edgeFrom = LAND0 + Math.atan2(0.9, railR) / deg;
      const n = Math.ceil((rimTo - 184.5) / 2.25), m = Math.ceil((170 - edgeFrom) / 2.25);
      // (with ?wvland=old there is no landing, and the rail stops at the rim's end)
      const rim = [...Array.from({ length: n }, (_, k) => add(c, dir(184.5 + ((rimTo - 184.5) * k) / n), rimR)), turnIn];
      const level = VLAND_OLD ? rim : [...rim, atEdge, ...Array.from({ length: m }, (_, k) => add(c, dir(edgeFrom + ((170 - edgeFrom) * (k + 1)) / m), railR))];
      buildVertigoRail({
        level, corners: VLAND_OLD ? [] : [n, n + 1], toHead: !VLAND_OLD, floor: 6, head: add(c, dir(170), railR),
        helix: {
          at: (t) => add(c, dir(bearing(t)), inner(t) - 0.9), tread: (t) => yAt(t) + 1.5, base: (t) => yAt(t) + 2.2,
          runs: RAILED, samples: STEPS * 3,
        },
        newBatch: (mat) => new Batch(mat), M, instances, mouldGeo,
      });
    } else {
      // a newel where the stair leaves the floor
      {
        const p = add(c, dir(bearing(0)), inner(0) - 0.6);
        carved.add(placed(new THREE.CylinderGeometry(2, 2.6, 21, 12), p, 6.5));
        LB.bronze.add(placed(new THREE.SphereGeometry(2, 14, 10), p, 18.6));
      }
      // the handrail and its balusters, spaced by distance along the open edge
      const rail = (t) => Array.from({ length: 6 }, (_, k) => [inner(t) - 0.9 + Math.cos((k * Math.PI) / 3) * 0.6, yAt(t) + 12 + Math.sin((k * Math.PI) / 3) * 0.6]);
      // The fall and the return use this opening. Keep both the solid rail
      // and its posts out of the gap, with the end knobs below marking it.
      for (const [t0, t1] of RAILED) LB.bronze.add(sweep(rail, t0, t1));
      const railAt = (t, lift, inset = 0) => { const p = add(c, dir(bearing(t)), inner(t) - 0.9 - inset); return [p[0], yAt(t) + lift, p[1]]; };
      for (let s = 1, samples = STEPS * 4, since = 4.5; s <= samples; s++) {
        const t = s / samples, dt = 1 / samples;
        since += Math.hypot((2 * Math.PI * inner(t) * TURNS) * dt, DROP * dt);
        if (since < 4.5) continue;
        since = 0;
        if (inGap(t)) continue;
        balusters.push({ p: railAt(t, 2.2), s: [0.6, 1.55, 0.6] });
      }
      // Where it gave way the rail just stops, a knob on each end. (A rail torn
      // down into the gap, a baluster knocked askew and the sockets of the lost
      // ones, a stride from the reader's eye, stood in the frame like a bronze
      // bone and a row of black holes.)
      for (const t of GAPS.flat()) {
        const p = railAt(t, 12);
        LB.bronze.add(new THREE.SphereGeometry(0.95, 12, 8).translate(p[0], p[1], p[2]));
      }
    }

    // An open book left lying where the rail has gone (spiral.js `bookAt`):
    // a folio, open at the same page on every turn, a few treads into the gap
    // on the open side of the tread — someone set it down here — so that a
    // reader who walks on down knows the place again each time they come
    // round to it. Lying across the tread, which is wider than it is long.
    // (Not on the world's stream: nothing here is drawn.)
    const openBook = (x, y, z, yaw) => {
      const parts = [[new THREE.BoxGeometry(6, 0.14, 4.2).translate(0, 0.07, 0), 'leather']];
      for (const side of [-1, 1]) {
        parts.push([new THREE.BoxGeometry(2.8, 0.34, 3.95).translate(side * 1.45, 0.17, 0).rotateZ(-side * 0.06).translate(0, 0.14, 0), 'paper']);
      }
      return parts.map(([g, k]) => [g.rotateY(yaw).translate(x, y, z), k]);
    };
    const BOOK_IN = 4.2;   // its middle, in from the open edge
    if (!BRINK_OLD) {
      for (const [t0] of GAPS) {
        const t = bookAt(t0, STEPS), p = add(c, dir(bearing(t)), inner(t) + BOOK_IN);
        for (const [g, k] of openBook(p[0], yAt(t) + 1.5, p[1], -bearing(t) * deg + 0.15)) LB[k].add(g);
      }
    }

    // Lamps hung in the well at every depth, well clear of the stair and of the
    // line the fall takes down the middle, their chains running up into the dark.
    const hanging = light
      ? [[20, 30, -80, 7], [290, 14, -270, 5]]
      : [[20, 30, -70, 7], [140, 22, -170, 6], [290, 14, -270, 5], [65, 9, -345, 3.5]];
    // (The nearest a step down from the rest — the brightest thing in the frame
    // should be the light at the bottom — and all of them on a chain of half
    // the gauge: from the stand a heavy one is the heaviest line in the
    // picture, cutting it from the corner to the middle.)
    const opal = keep(makeLampGlobeMaterial({ diffused: true }));
    hanging.forEach(([b, off, y, r], i) => lamp(add(c, dir(b), off), {
      y, r, light: i === 0 ? 4800 : 4200, priority: -1, strength: i === 0 ? 0.85 : 1.1, pool: 0, beam: false, chain: 52, link: 0.55,
      globeMaterial: opal,
    }));

    // The light at the bottom: a hot core in the throat, the funnel's floor
    // glowing round it, light standing up the well and hanging in its air in
    // thinning layers — each sized to fade out before it meets the shelves.
    const wellTex = tex(paint(256, 256, (g) => {
      const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, '#fffaf0');
      grd.addColorStop(0.35, '#ffe2a8');
      grd.addColorStop(0.72, '#e8984e');
      grd.addColorStop(1, '#5a2e12');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
    }), [1, 1]);
    pitCore = new THREE.Mesh(keep(new THREE.CircleGeometry(NECK - SPIRAL.width - 6, 48)), keep(new THREE.MeshBasicMaterial({ map: wellTex, color: '#ffe4b4', toneMapped: false })));
    pitCore.name = 'sky';
    pitCore.rotation.x = -Math.PI / 2;
    pitCore.position.set(c[0], 7 - DEPTH, c[1]);
    root.add(pitCore);
    // The light is never reached on foot. Walked down toward it, the disc in
    // the throat keeps 420 below the eye (`tick`) — and the rest of the light
    // goes down with it, the hot core, the glow over it, the column standing up
    // from it and the light it throws: if only the disc went, a reader walking
    // on down the endless turns would pass the glow, hanging in the well at the
    // depth the light had been, and look back up at it. However far down they
    // walk, the light below looks as it did from the stair's head.
    // (?wbrink=old: only the disc.)
    const sink = BRINK_OLD ? null : { halos: [], shaft: null, glow: null, wish: null };
    if (sink) {
      sink.glow = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(1, 16, 12)), M.glow, 1);
      sink.glow.setMatrixAt(0, new THREE.Matrix4().makeScale(7, 7, 7));
      sink.glow.setColorAt(0, new THREE.Color('#ffe6b8').multiplyScalar(2.2));
      sink.glow.position.set(c[0], -447, c[1]);
      sink.glow.computeBoundingSphere();
      sink.glow.name = 'sky';
      root.add(sink.glow);
    } else lampCores.push({ p: [c[0], -447, c[1]], s: [7, 7, 7], color: '#ffe6b8', k: 2.2 });
    halo(c, -445, 150, '#ffc680', 0.55);
    halo(c, -395, 90, '#ffb060', 0.2);
    if (sink) sink.halos = halos.slice(-2).map((h) => ({ sprite: h.sprite, y: h.sprite.position.y }));
    // (the one column that stays whole with the eye inside it: the fall is down it)
    const column = shaftVolume(new THREE.CylinderGeometry(9, 26, 300, 28, 1, true).rotateX(Math.PI).translate(c[0], -447 + 150, c[1]));
    if (sink) {
      sink.shaft = new THREE.Mesh(keep(column), shaftMaterial);
      sink.shaft.name = 'shafts';
      root.add(sink.shaft);
    } else LB.shafts.add(column);
    for (const [y, o] of [[-110, 0.06], [-190, 0.09], [-260, 0.12], [-320, 0.14], [-370, 0.17], [-410, 0.22]]) {
      decal(c, coneR(y) * 1.9, coneR(y) * 1.9, '#ffb25a', o, y, 0.08);
    }
    point(c, -425, '#ffa64a', 14000, 10, 2, [c[0], c[1], rWall + 14]);
    if (sink) {
      sink.wish = lightWishes.at(-1);
      // (by how far the disc has gone below where it was built, at -453)
      pitSink = (dy) => {
        sink.glow.position.y = -447 + dy;
        for (const h of sink.halos) h.sprite.position.y = h.y + dy;
        sink.shaft.position.y = dy;
        sink.wish.y = -425 + dy;
      };
    }
    // (over the map, the well darkens with depth: mapFix.js, 7 — see pitFade)
    pitCarved = carved.mat;

    // loose pages, turning slowly down the well
    {
      // A page, not a card: printed, curled at its corner as well as across,
      // and lit through — paper this thin holds the lamp's light in it. As a
      // plain pale quad it is the brightest thing in the well and reads as a
      // sticker on the frame.
      const leaf = keep(new THREE.PlaneGeometry(4.2, 5.6, 8, 4));
      const lp = leaf.attributes.position;
      for (let i = 0; i < lp.count; i++) {
        const x = lp.getX(i), y = lp.getY(i);
        lp.setZ(i, x ** 2 * 0.14 + x * y * 0.025 + (x > 0.8 && y > 1.2 ? (x - 0.8) * (y - 1.2) * 0.35 : 0));
      }
      leaf.computeVertexNormals();
      const pageTex = tex(paint(256, 342, (g, w, h) => {
        const pr = makeRng(611);
        g.fillStyle = '#efe6d2';
        g.fillRect(0, 0, w, h);
        for (let k = 0; k < 40; k++) {
          const x = pr() * w, y = pr() * h, r = 2 + pr() * 10;
          const fox = g.createRadialGradient(x, y, 0, x, y, r);
          fox.addColorStop(0, `rgba(150,110,60,${0.05 + pr() * 0.1})`);
          fox.addColorStop(1, 'rgba(150,110,60,0)');
          g.fillStyle = fox;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        g.fillStyle = 'rgba(52,38,24,0.55)';
        g.fillRect(w / 2 - 30, 20, 60, 3);
        for (let y = 42; y < h - 40; y += 9) {
          const para = pr() < 0.12;
          let x = 26 + (para ? 14 : 0);
          const end = w - 26 - (pr() < 0.1 ? 60 + pr() * 60 : 0);
          while (x < end) {
            const ww = 6 + pr() * 22;
            g.fillStyle = `rgba(40,30,20,${0.5 + pr() * 0.25})`;
            g.fillRect(x, y, Math.min(ww, end - x), 3);
            x += ww + 4;
          }
        }
        g.fillStyle = 'rgba(52,38,24,0.6)';
        g.fillRect(w / 2 - 6, h - 22, 12, 3);
      }), [1, 1]);
      // Seven: fewer, half as large again, falling and turning at a little over
      // half the pace — a page drifting down, not flecks of white crossing the
      // frame. At forty-four loose pages are a blizzard, white flecks over
      // every part of the frame, and the well has no quiet anywhere in it.
      // (Twenty-two are still drawn from the stream: the garden is laid out
      // from it, see `resume`.)
      const pages = Array.from({ length: light ? 10 : 22 }, () => ({
        phase: rnd(), frac: rr(0.25, 0.85), spin: rr(0.12, 0.3) * (rnd() < 0.5 ? -1 : 1), fall: rr(5, 9), a0: rr(0, Math.PI * 2), tumble: rr(0.6, 1.4),
      })).slice(0, light ? 4 : 7).map((pg) => ({ ...pg, spin: pg.spin * 0.6, fall: pg.fall * 0.55, tumble: pg.tumble * 0.55 }));
      const mesh = new THREE.InstancedMesh(leaf, Std({
        map: pageTex, color: '#d6cab4', roughness: 0.95, side: THREE.DoubleSide,
        emissive: '#a0703e', emissiveMap: pageTex, emissiveIntensity: 0.36,
      }), pages.length);
      mesh.frustumCulled = false;
      const TOP = -10, SPAN = 420;
      const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), eu = new THREE.Euler(), at = new THREE.Vector3(), sc = new THREE.Vector3();
      drift = (time) => {
        pages.forEach((pg, i) => {
          const down = (time * pg.fall + pg.phase * SPAN) % SPAN, y = TOP - down;
          const r = pg.frac * Math.max(2, inner(Math.min(1, Math.max(0, (4 - y) / DROP))) - 2.5);
          const ang = pg.a0 + time * pg.spin + Math.sin(time * 0.7 + pg.phase * 9) * 0.3;
          at.set(c[0] + Math.cos(ang) * r, y + Math.sin(time * 1.9 + pg.phase * 20) * 1.5, c[1] + Math.sin(ang) * r);
          eu.set(Math.sin(time * pg.tumble + pg.phase * 7) * 1.1, time * pg.tumble * 0.8 + pg.phase * 6, Math.cos(time * pg.tumble * 0.9 + pg.phase * 5) * 0.9);
          // grown in at the top and gone into the light at the bottom
          sc.setScalar(1.5 * Math.max(0.001, Math.min(1, down / 20, (SPAN - down) / 20)));
          mesh.setMatrixAt(i, m4.compose(at, qt.setFromEuler(eu), sc));
        });
        mesh.instanceMatrix.needsUpdate = true;
      };
      drift(0);
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
    // dust in the well's air, lit by whatever lamp it drifts near
    for (let s = 0; s < (light ? 34 : 110); s++) {
      const y = rr(-430, 80), reach = y > 6 ? 90 : Math.max(4, inner(Math.min(1, Math.max(0, (4 - y) / DROP))) - 2);
      const p = add(c, dir(rr(0, 360)), Math.sqrt(rnd()) * reach);
      dust.push({ p: [p[0], y, p[1]], s: Array(3).fill(rr(0.4, 0.9)), color: '#ffdca8', k: 0, phase: rr(0, 100) });
    }
    yield* carved.flushSteps('carved');
    yield* nosings.flushSteps('nosing');
    yield* funnelRows.flushSteps('funnelRows');
    spiral = makeEndlessSpiral(c, {
      stone: LB.step.mat ?? carved.mat, bronze: LB.bronze.mat, books: funnelRowsMat,
      // (the same rail on down every turn of it, and the string it stands in)
      rail: VRAIL_OLD ? null : (turn) => endlessRail({ ...turn, mouldGeo, M, carved: carved.mat }),
      // (and the same book, by the same gap, on every one of its turns)
      dress: BRINK_OLD ? null : ({ edge, pitch, angle0, steps }) => {
        const TAU = Math.PI * 2, a0 = bearing(bookAt(GAPS[0][0], STEPS)) * deg;
        const u = Math.round(((((a0 - angle0) % TAU) + TAU) % TAU) / TAU * steps) / steps, a = angle0 + u * TAU;
        return openBook(Math.cos(a) * (edge + BOOK_IN), 1.5 - u * pitch, Math.sin(a) * (edge + BOOK_IN), -a + 0.15).map(([g, k]) => [g, M[k], k]);
      },
    });
    root.add(spiral.root);

    for (const a of [40, 320]) lamp(add(c, dir(a), 84), { light: a === 40 ? 7000 : 0, priority: 4, strength: 1.2, pool: 0.26 });
    hangPainting(3, [c[0], c[1] - rWall + 3.5], 38, [0, 1], 80);
    // The old funnel took two draws a step, one for each of its twelve lamps,
    // two for its haze and four for the rim lamps; every draw advances the seed
    // by the same constant, so this is exactly where it left the stream.
    // Preserve the garden's layout when the lightweight stair gains treads.
    stream.seed = (resume + Math.imul(2 * (light ? 120 : STEPS) + 18, 0x6D2B79F5)) | 0;
  }
  return { PIT, pitCore, pitCarved, pitSink, stairAt, spiral, drift };
}
