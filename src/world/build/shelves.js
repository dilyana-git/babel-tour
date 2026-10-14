// The books on a wall and the Library's furniture (buildWorld.js,
// assembleWorld): shelves, lamps, ladders, reading corners, paintings and the
// readers in the distance.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LAMPS } from '../lampPass';
import { SPINE_KINDS, PLATE_CELLS, makeRng, TITLE_COUNT } from '../textures';
import { BOOKS_GIANT, shaftVolume } from '../effects';
import { vestOld } from '../vestFix';
import { echoOld } from '../echoFix';
import { auditOld, FILLET } from '../auditFix';
import { COLOUR, lib3Old, STRING } from '../libFix3';
import { doorPropsOld, LADDER_U as DOOR_LADDER_U } from '../doorProps';
import { BINDINGS, TIERS, TIER_BASE, TIER_H, FRIEZE_Y, SHELVES, CASE_BACK, BOOK_ROWS, shelvesOf, BOARD, MASS_H, CAP, deg, GLASS_OLD } from './common';

export function buildBooks(ctx) {
  const { rnd, rr, pick, add, dist, rowV, gilt, boxGeo, placed, rodGeo, LB, shelved, shelvedWalls,
    lodFor, books, BOOKS } = ctx;
  // ── The books on a wall ───────────────────────────────────────────────────
  // Per room: the Silence is a room nobody reads in, and its bindings have gone
  // grey with it; the Door keeps green off its shelves, so that the only green
  // in the room is the moon's beyond the jamb.
  const tone = new THREE.Color();
  const toneHex = (hex, sat = 1, lum = 1) => {
    tone.set(hex);
    const hsl = tone.getHSL({});
    tone.setHSL(hsl.h, hsl.s * sat, Math.min(0.9, hsl.l * lum));
    return `#${tone.getHexString()}`;
  };
  // And each gallery one local colour of its own, where one of the board's
  // options for it is picked (libFix3.js, 1; c, the user's, by default): oxblood in
  // the Vestibule, bottle green in the Echo, vellum in the Silence — that
  // binding's share of the runs weighted up, and every leather given back a
  // little of the chroma a wall of them loses at a stand's distance.
  const LOCAL = [1, 2, 4];   // BINDINGS' index, by room
  const bindingsFor = (room) => BINDINGS
    .map((b, i) => (COLOUR && LOCAL[room] === i ? { ...b, share: b.share * COLOUR.weight, local: true } : b))
    .map((b) => (COLOUR && room !== undefined && room < 2 ? { ...b, cols: b.cols.map((h) => toneHex(h, COLOUR.keep, 1)) } : b))
    .filter((b) => !(room === 4 && b.green))
    .map((b) => (room === 2
      ? { ...b, share: b.kind === 'vellum' && !b.local ? 4 : b.share, cols: b.cols.map((h) => toneHex(h, 0.4, b.kind === 'vellum' ? 0.62 : 0.8)) }
      : b));
  // Folios low, octavos high: the heights and widths a run is drawn from, tier
  // by tier. The top shelf stops well short of the frieze board over it.
  const SIZES = [
    { h: [16.6, 19.4], w: [3.8, 6.0] },
    { h: [15.2, 18.4], w: [3.2, 5.2] },
    { h: [13.4, 16.6], w: [2.8, 4.5] },
    { h: [11.6, 14.6], w: [2.4, 3.9] },
    { h: [10.0, 13.0], w: [2.1, 3.5] },
  ];
  const kindCell = (kind, r) => { const [lo, hi] = SPINE_KINDS[kind]; return lo + Math.floor(r * (hi - lo)); };
  const LAID = 1000;   // aSpine for a book lying flat (see makeBookMaterial)
  // How much of the lamp-rails' wash each lit room has: none in the Silence,
  // "where the lamps grow faint".
  const GRAZE_BY_ROOM = { 0: 1, 1: 0.7, 2: 0, 4: 0.8 };
  // Numbered plates for the bays: a box whose every face shows cell `i`.
  const plateGeo = (i) => {
    const g = new THREE.BoxGeometry(3.4, 2.1, 0.3);
    const uv = g.attributes.uv;
    for (let v = 0; v < uv.count; v++) uv.setX(v, (i + uv.getX(v)) / PLATE_CELLS);
    return g;
  };
  // Borges numbers every hexagon and every wall of it, so the cornice carries
  // both: the hexagon's own number (from its place in the honeycomb, kept to
  // a numeral short enough to cut) and the wall's, I to VI round the room. A
  // doorway has no shelves and so no number; the gaps in the count are the
  // ways out.
  const NUMERALS = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  const roman = (n) => NUMERALS.reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
  const hexNumber = (i, j) => {
    let n = 100 + ((Math.imul(i + 37, 73856093) ^ Math.imul(j + 91, 19349663)) >>> 0) % 900;
    while (roman(n).length > 7) n++;
    return roman(n);
  };

  // A wall of shelves, tier above tier, from `from` to `to` (tier indexes).
  // `detail`: 0 for the far honeycomb, 1 near the walk (pilasters, the frieze
  // board, the ledge), 2 in the rooms themselves (flutes, dentils, numbered
  // plates, leather shelf-edges, the lamp-rail).
  // `stream`: the length of wall the world's stream is drawn for, when that is
  // not this wall's (the Echo's are longer than the walls it was drawn for).
  const shelfWall = (a, b, inward, { from = 0, to = TIERS - 1, room, detail = 0, graze = 0, words = null, stream } = {}) => {
    const len = dist(a, b);
    const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const s0 = 12, s1 = len - 12;
    const yBottom = TIER_BASE + from * TIER_H, yTop = TIER_BASE + (to + 1) * TIER_H;
    const face = -Math.atan2(t[1], t[0]), turn = face;
    const on = (u, z) => add(add(a, t, u), inward, z);
    LB.shelfBack.add(boxGeo(on(s0, 1.2), on(s1, 1.2), yTop - yBottom, 2, yBottom));
    // The world's random stream, drawn exactly as the old shelving drew it and
    // then thrown away. Everything built after the galleries — the garden above
    // all — is laid out off that stream, and shelving on it any other way would
    // have reshuffled the lot. The books themselves come from `br`, the wall's own.
    const ghost = [], ghostEnd = stream === undefined ? s1 : stream - 12;
    for (let tier = from; tier <= to; tier++) {
      const y = TIER_BASE + tier * TIER_H;
      let u = s0;
      while (u < ghostEnd - 2) {
        if (rnd() < 0.05) { u += rr(3, 9); continue; }
        if (rnd() < 0.045) {
          const w2 = rr(9, 15);
          for (let n = 0; n < 2 + Math.floor(rnd() * 3); n++) {
            const th = rr(1.5, 2.8);
            ghost.push([face + rr(-0.06, 0.06), w2 * rr(0.8, 1), th, rr(8, 10.5), pick(BOOKS), rr(0.75, 1.1)]);
          }
          u += w2 + rr(0.4, 1.6);
          continue;
        }
        const w = rr(2.3, 5.2), hh = rr(15.5, TIER_H - 2.2);
        ghost.push([y, rnd() < 0.05 ? rr(-0.3, 0.3) : 0, w, hh, rr(8, 11), pick(BOOKS), rr(0.75, 1.1)]);
        u += w + rr(0.15, 1);
      }
    }
    const br = makeRng((Math.round(a[0] * 131 + a[1] * 71 + b[0] * 37 + b[1] * 17) ^ (from * 7919)) | 0);
    // The titles have a stream of their own, so the shelving stays as it was:
    // one title to a set, its volumes numbered along the shelf (see
    // makeBookMaterial; `title` carries 1000 × the volume).
    const tr = makeRng((Math.round(a[0] * 89 + a[1] * 53 + b[0] * 61 + b[1] * 29) ^ (from * 104729) ^ 0x7e11) | 0);
    const newTitle = () => Math.floor(tr() * TITLE_COUNT);
    // the Silence: nobody has taken a book down in a long time
    const dust = room === 2 ? 1 : 0;
    const within = ([lo, hi]) => lo + (hi - lo) * br();
    const bindings = bindingsFor(room);
    const shareSum = bindings.reduce((n, x) => n + x.share, 0);
    // (`caseOf`: the one binding a case is shelved in, where the Library is
    // shelved as collections — libFix3.js, 1b. Five runs in six are in it;
    // the stream is drawn as it always was.)
    let caseOf = null;
    const pickBinding = () => {
      const r0 = br();
      if (caseOf && (r0 * 977.31) % 1 < 0.84) return caseOf;
      let r = r0 * shareSum;
      for (const x of bindings) { r -= x.share; if (r <= 0) return x; }
      return bindings[0];
    };
    const caseBinding = (tier, ua) => {
      let r = makeRng((Math.round(a[0] * 131 + a[1] * 71 + ua * 53) ^ (tier * 7919) ^ 0x5ca1e) | 0)() * shareSum;
      for (const x of bindings) { r -= x.share; if (r <= 0) return x; }
      return bindings[0];
    };
    const newRun = (tier, giant = BOOKS_GIANT) => {
      const B = pickBinding(), size = giant ? SIZES[tier] : SHELVES[tier], r = br();
      // (the big folios on the low shelves mostly plain: a label on every one
      // of a long run of them read as a pattern printed on the case)
      const [rich, label] = tier < 2 ? [0.14, 0.38] : [0.25, 0.7];
      const kind = B.kind ?? (r < rich ? 'rich' : r < label ? 'label' : 'plain');
      // the top shelf is nearest the lamps, and faded paler for it
      const top = tier === TIERS - 1;
      const d = giant ? 8 + br() * 2 : within(size.d);
      const n = br() < 0.22 ? 1 : 2 + Math.floor(br() * br() * 8);
      return {
        n: kind === 'vellum' ? Math.min(n, 3) : n,
        color: toneHex(B.cols[Math.floor(br() * B.cols.length)], top ? 0.8 : 1, top ? 1.1 : 1),
        spine: kindCell(kind, br()),
        h: within(size.h), w: within(size.w) * (kind === 'vellum' ? 0.85 : 1),
        // (a real book stands a finger's breadth or two back from the shelf's
        // edge at 12, a giant one a hand or more)
        d, front: giant ? 9.4 + br() * 1.8 : 11.9 - br() * 0.6, k: 0.86 + br() * 0.2,
      };
    };
    const bayEnds = [0, 1, 2, 3].map((i) => s0 + (i * (s1 - s0)) / 3);
    if (!BOOKS_GIANT) {
      // In the galleries on the walk every book is a box of its own. In the
      // rest of the Library, seen only from over the walls, a shelf is its
      // painted row of them (bookRows), a stretch of the strip.
      const real = detail >= 2;
      // The case's back, brought forward to stand behind the books: a real
      // folio is 3 deep.
      if (real) LB.shelfBack.add(boxGeo(on(s0, CASE_BACK - 0.5), on(s1, CASE_BACK - 0.5), yTop - yBottom, 1, yBottom));
      const spin = Math.atan2(inward[0], inward[1]);
      const paintedBay = (tier, sy, clear, ua, ub, target = LB.bookRows) => {
        const L = ub - ua, { top: vt, base: vb } = rowV[tier * BOOK_ROWS.variants + Math.floor(br() * BOOK_ROWS.variants)];
        const u0 = br(), g = new THREE.PlaneGeometry(L, clear), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (uv.getX(i) * L) / BOOK_ROWS.length, vb + uv.getY(i) * (vt - vb));
        g.rotateY(spin);
        const q = on((ua + ub) / 2, 11.6);
        target.add(g.translate(q[0], sy + clear / 2, q[1]));
      };
      let R = null, run = 0;
      const wall = shelvedWalls.n++, far = real ? lodFor(wall, room) : null;
      // (a gallery's top tiers, painted where they stand)
      const lit = {
        add: (g) => {
          const n = g.attributes.position.count, v = [graze, room === 2 ? 1 : 0];
          g.setAttribute('aLit', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => v).flat(), 2));
          (room === 0 ? LB.vestBookRowsLit : LB.bookRowsLit).add(g);
        },
      };
      // One bay of one shelf, from `ua` to `ub` along the wall, its books
      // standing on `sy` with `clear` over them. A set runs on from bay to bay
      // and shelf to shelf, as a set on a real shelf does.
      const shelveBay = (tier, sy, clear, ua, ub) => {
        const SH = SHELVES[tier];
        if (COLOUR?.bays && room !== undefined && room < 3) caseOf = caseBinding(tier, ua);
        let u = ua + br() * 0.1, lean = 0;
        while (u < ub - 0.3) {
          if (run <= 0) {
            const x = br();
            // now and then a reader has taken one out, and its neighbour leans
            // into the gap it left
            if (x < 0.02 && u > ua + 1) {
              // or a bronze bookend holds up what is left of the run
              if (br() < 0.4) {
                const eh = Math.min(2.2, clear - 0.5);
                LB.bronzeDim.add(placed(new THREE.BoxGeometry(0.1, eh, 1.5), on(u + 0.05, 10.8), sy + eh / 2, turn));
                LB.bronzeDim.add(placed(new THREE.BoxGeometry(0.9, 0.06, 1.5), on(u + 0.5, 10.8), sy + 0.03, turn));
                u += 0.14;
                lean = 0;
                continue;
              }
              const g = 0.35 + br() * 0.45; u += g; lean = g; continue;
            }
            // or a few are laid flat on the shelf, spine out
            if (x < 0.032) {
              const w2 = within(SH.h);
              if (u + w2 > ub) break;
              const B = pickBinding();
              let lie = sy;
              for (let n = 0, count = 2 + Math.floor(br() * 3); n < count; n++) {
                const th = within(SH.w) * 1.1, wn = w2 * (0.86 + br() * 0.14), dn = within(SH.d);
                if (lie + th > sy + clear - 0.4) break;
                const q = on(u + w2 / 2 + (br() - 0.5) * 0.15, 11.7 - dn / 2);
                shelved.push({
                  wall,
                  p: [q[0], lie + th / 2, q[1]], rot: [0, face + (br() - 0.5) * 0.1, 0], s: [wn, th, dn],
                  color: pickBinding().cols[0], k: 0.85 + br() * 0.2, spine: LAID + kindCell(B.kind === 'vellum' ? 'vellum' : 'label', br()), graze, dust,
                  title: newTitle(),
                });
                lie += th;
              }
              u += w2 + 0.1 + br() * 0.25;
              lean = 0;
              continue;
            }
            R = newRun(tier);
            R.title = newTitle();
            run = R.n;
          }
          const w = R.w * (1 + (br() - 0.5) * 0.06), hh = R.h * (1 + (br() - 0.5) * 0.025);
          if (u + w > ub) break;
          const inset = R.front - R.d / 2;
          const book = { color: R.color, k: R.k * (0.96 + br() * 0.08), spine: R.spine, graze, dust, title: R.title + (R.n > 1 ? 1000 * (R.n - run + 1) : 0) };
          if (lean) {
            // Pivoted on its foot at the edge of the gap and resting its head on
            // the book across it.
            const th = Math.min(0.36, Math.asin(Math.min(0.9, lean / hh)));
            const c2 = on(u + (w / 2) * Math.cos(th) - (hh / 2) * Math.sin(th), inset);
            shelved.push({ ...book, wall, p: [c2[0], sy + (w / 2) * Math.sin(th) + (hh / 2) * Math.cos(th), c2[1]], rot: [0, face, th], s: [w, hh, R.d] });
            u += w * Math.cos(th) + 0.04;
            lean = 0;
          } else {
            const p = on(u + w / 2, inset);
            shelved.push({ ...book, wall, p: [p[0], sy + hh / 2, p[1]], rot: [0, face, 0], s: [w, hh, R.d] });
            u += w + 0.006 + br() * 0.035;
          }
          run--;
        }
      };
      for (let tier = from; tier <= to; tier++) {
        const y = TIER_BASE + tier * TIER_H;
        if (tier > from) LB.shelf.add(boxGeo(on(s0, 6), on(s1, 6), 2.4, 12, y - 2.4));
        // (a set does not run on into a tier of another size)
        run = 0;
        shelvesOf(tier, y).forEach(({ y: sy, clear }, j) => {
          const mid = (CASE_BACK + 12) / 2;
          if (j > 0) LB.shelf.add(boxGeo(on(s0, mid), on(s1, mid), BOARD, 12 - CASE_BACK, sy - BOARD));
          // between the uprights, not through them
          // In a gallery, a box to every book on the three tiers the eye
          // is level with or under; the two over them — from 73 to the frieze,
          // more than 50 over any eye and nearly two thirds of the wall's
          // books, the smallest — painted, as the far galleries are.
          // (paint runs the length of the shelf, behind the uprights)
          const ua = bayEnds[0] + 1.35, ub = bayEnds[3] - 1.35;
          if (real && tier < 3) {
            for (let i = 0; i < 3; i++) shelveBay(tier, sy, clear, bayEnds[i] + 1.35, bayEnds[i + 1] - 1.35);
            paintedBay(tier, sy, clear, ua, ub, far);
          } else paintedBay(tier, sy, clear, ua, ub, real ? lit : LB.bookRows);
        });
      }
    } else for (let tier = from; tier <= to; tier++) {
      const y = TIER_BASE + tier * TIER_H;
      // (the lowest tier stands on the plinth: a board of its own lay inside
      // it with its top in the plinth's plane — see the plinth below)
      if (tier > from) LB.shelf.add(boxGeo(on(s0, 6), on(s1, 6), 2.4, 12, y - 2.4));
      let u = s0 + br() * 0.8, run = 0, R = null, lean = 0;
      while (u < s1 - 2) {
        if (run <= 0) {
          const x = br();
          // now and then a reader has taken one out, and its neighbour leans
          // into the gap it left
          if (x < 0.035 && u > s0 + 4) {
            // or a bronze bookend holds up what is left of the run
            if (br() < 0.4) {
              LB.bronzeDim.add(placed(new THREE.BoxGeometry(0.35, 6.4, 4.6), on(u + 0.2, 7.4), y + 3.2, turn));
              LB.bronzeDim.add(placed(new THREE.BoxGeometry(2.8, 0.25, 4.6), on(u + 1.5, 7.4), y + 0.13, turn));
              u += 0.6;
              lean = 0;
              continue;
            }
            const g = 2.4 + br() * 2.4; u += g; lean = g; continue;
          }
          // or a few are laid flat on the rest of the shelf
          if (x < 0.075) {
            const w2 = 9 + br() * 5;
            if (u + w2 > s1) break;
            const B = pickBinding();
            let lie = y;
            for (let n = 0, count = 2 + Math.floor(br() * 3); n < count; n++) {
              const th = 1.6 + br() * 1.1, wn = w2 * (0.84 + br() * 0.16), dn = 7.4 + br() * 2;
              if (lie + th > y + TIER_H - 3) break;
              const q = on(u + w2 / 2 + (br() - 0.5) * 0.8, 10.2 - dn / 2);
              books.push({
                p: [q[0], lie + th / 2, q[1]], rot: [0, face + (br() - 0.5) * 0.1, 0], s: [wn, th, dn],
                color: pickBinding().cols[0], k: 0.85 + br() * 0.2, spine: LAID + kindCell(B.kind === 'vellum' ? 'vellum' : 'label', br()), graze, dust,
                title: newTitle(),
              });
              lie += th;
            }
            u += w2 + 0.5 + br() * 1.2;
            lean = 0;
            continue;
          }
          R = newRun(tier, true);
          R.title = newTitle();
          run = R.n;
        }
        const w = R.w * (1 + (br() - 0.5) * 0.06), hh = R.h * (1 + (br() - 0.5) * 0.025);
        if (u + w > s1) break;
        const inset = R.front - R.d / 2;
        const book = { color: R.color, k: R.k * (0.96 + br() * 0.08), spine: R.spine, graze, dust, title: R.title + (R.n > 1 ? 1000 * (R.n - run + 1) : 0) };
        if (lean) {
          // Pivoted on its foot at the edge of the gap and resting its head on
          // the book across it.
          const th = Math.min(0.36, Math.asin(Math.min(0.9, lean / hh)));
          const c2 = on(u + (w / 2) * Math.cos(th) - (hh / 2) * Math.sin(th), inset);
          books.push({ ...book, p: [c2[0], y + (w / 2) * Math.sin(th) + (hh / 2) * Math.cos(th), c2[1]], rot: [0, face, th], s: [w, hh, R.d] });
          u += w * Math.cos(th) + 0.3;
          lean = 0;
        } else {
          const p = on(u + w / 2, inset);
          books.push({ ...book, p: [p[0], y + hh / 2, p[1]], rot: [0, face, 0], s: [w, hh, R.d] });
          u += w + 0.12 + br() * 0.3;
        }
        run--;
      }
    }
    // The bays: uprights between them, and near the walk a pilaster on each —
    // a face board with a base and a capital, reeded in the rooms themselves —
    // so a wall of books is a piece of joinery and not a plane of spines.
    const capY = detail >= 1 ? FRIEZE_Y - 2.2 : yTop - 1.6;
    for (const u of bayEnds) {
      LB.shelf.add(placed(new THREE.BoxGeometry(2.6, yTop - yBottom, 12), on(u, 6), yBottom + (yTop - yBottom) / 2, turn));
      LB.shelf.add(placed(new THREE.BoxGeometry(4, 2.2, 13.4), on(u, 6.7), capY, turn));
      if (detail >= 1) {
        const lo = yBottom + (from === 0 ? 0 : 0.5), hi = capY - 1.1;
        LB.shelf.add(placed(new THREE.BoxGeometry(3.6, hi - lo, 0.7), on(u, 12.35), (lo + hi) / 2, turn));
        LB.shelf.add(placed(new THREE.BoxGeometry(4.4, 4.2, 1.3), on(u, 12.65), lo + 2.1, turn));
        LB.shelf.add(placed(new THREE.BoxGeometry(4.6, 1, 1.6), on(u, 12.8), capY - 0.6, turn));
        if (detail >= 2) {
          for (const dx of [-1.05, 0, 1.05]) {
            LB.shelf.add(placed(new THREE.BoxGeometry(0.42, hi - lo - 8, 0.34), on(u + dx, 12.87), (lo + 4.2 + hi - 3.8) / 2, turn));
          }
        }
      }
    }
    // A plinth on the floor — with a ledge at hand height to lay a book open
    // on, and a raised panel in each bay — and a stepped cornice along the top.
    //
    // One top at the height the books stand on, never two or three. If the
    // lowest shelf board, the plinth and the ledge all end level there, each
    // piece of wood takes its own stretch of grain and the three fight for
    // every pixel of it: streaks of one board's figure and another's that
    // reshuffle with every step. So the lowest tier has no board (the plinth is
    // its shelf; 2.4 tall at least, so it holds all a board would), and under a
    // ledge the plinth stops at the ledge's foot.
    const ledge = detail >= 1 && from === 0;
    const plinthH = yBottom > 12 ? 2.4 : ledge ? 3.2 : 4;
    LB.shelf.add(boxGeo(on(s0 - 1.5, 7), on(s1 + 1.5, 7), plinthH, 14, yBottom - (yBottom > 12 ? 2.4 : 4)));
    if (ledge) {
      LB.shelf.add(boxGeo(on(s0 - 2, 7.7), on(s1 + 2, 7.7), 0.8, 15.4, yBottom - 0.8));
      if (detail >= 2) {
        for (let i = 0; i < 3; i++) LB.shelf.add(boxGeo(on(bayEnds[i] + 2.6, 14.15), on(bayEnds[i + 1] - 2.6, 14.15), 1.9, 0.3, 6.85));
      }
    }
    // The frieze: a board over the top shelf with a gilt key along it, a
    // numbered plate over the middle of each bay, dentils under the cornice.
    if (detail >= 1) {
      LB.frieze.add(boxGeo(on(s0 - 2, 12.6), on(s1 + 2, 12.6), yTop - FRIEZE_Y, 1.2, FRIEZE_Y));
      if (detail >= 2) {
        for (let i = 0; i < 3; i++) {
          LB.plate.add(placed(plateGeo(i), on((bayEnds[i] + bayEnds[i + 1]) / 2, 13.3), (FRIEZE_Y + yTop) / 2, turn));
        }
        for (let u = s0 - 1; u <= s1 + 1; u += 1.9) LB.shelf.add(placed(new THREE.BoxGeometry(0.9, 1.3, 0.8), on(u, 15.2), yTop + 0.75, turn));
      }
    }
    LB.shelf.add(boxGeo(on(s0 - 2, 7.4), on(s1 + 2, 7.4), 2, 14.8, yTop));
    LB.shelf.add(boxGeo(on(s0 - 3, 8.4), on(s1 + 3, 8.4), 2.4, 16.8, yTop + 2));
    // Over the dentils, in the face of the cornice, the wall's number in gilt
    // capitals: the first of `words` that goes at a readable size, centred on
    // the wall and read left to right from the room.
    if (detail >= 2 && words) {
      const track = 0.14, space = 0.5;
      const span = (s) => [...s].reduce((w, ch) => w + (ch === ' ' ? space : gilt.glyphs[ch].adv + track), -track);
      const fits = s1 - s0 - 6;
      const text = words.find((s) => span(s) * 1.1 <= fits) ?? words[words.length - 1];
      const cap = Math.min(1.5, fits / span(text));
      const right = [inward[1], -inward[0]], spin = Math.atan2(inward[0], inward[1]);
      const mid = on((s0 + s1) / 2, 16.85);
      let x = -span(text) / 2;
      for (const ch of text) {
        if (ch === ' ') { x += space; continue; }
        const G = gilt.glyphs[ch];
        const g = new THREE.PlaneGeometry(gilt.cellW * cap, gilt.cellH * cap);
        const uv = g.attributes.uv;
        for (let v = 0; v < uv.count; v++) uv.setXY(v, (G.col + uv.getX(v)) / gilt.cols, 1 - (G.row + 1 - uv.getY(v)) / gilt.rows);
        const p = add(mid, right, (x + G.adv / 2) * cap);
        LB.letters.add(g.rotateY(spin).translate(p[0], yTop + 3.2, p[1]));
        x += G.adv + track;
      }
    }
    if (detail >= 2) {
      // A leather dust-flap under the front of every shelf, bay by bay: a warm
      // scalloped line of shadow that reads from across the room.
      for (let tier = Math.max(1, from); tier <= to; tier++) {
        const y = TIER_BASE + tier * TIER_H - 2.4;
        for (let i = 0; i < 3; i++) {
          const ua = bayEnds[i] + 1.9, ub = bayEnds[i + 1] - 1.9, L = ub - ua;
          const g = new THREE.PlaneGeometry(L, 1.3);
          const uv = g.attributes.uv;
          for (let v = 0; v < uv.count; v++) uv.setX(v, (uv.getX(v) * L) / 2.4);
          g.rotateY(Math.atan2(inward[0], inward[1]));
          const q = on((ua + ub) / 2, 12.08);
          LB.scallop.add(g.translate(q[0], y - 0.65, q[1]));
        }
      }
      for (let tier = Math.max(1, from); tier <= to; tier++) {
        const y = TIER_BASE + tier * TIER_H;
        for (let i = 0; i < 3; i++) {
          const ua = bayEnds[i], ub = bayEnds[i + 1], L = ub - ua;
          if (dust) {
            // dust lying along the front of the shelf, in front of the books
            LB.dust.add(boxGeo(on(ua + 1.4, 11.55), on(ub - 1.4, 11.55), 0.06, 0.8, y));
          } else {
            // the front edge rubbed paler at the middle of the bay, where
            // books have gone in and out
            LB.shelfWorn.add(boxGeo(on(ua + L * 0.18, 11.8), on(ub - L * 0.18, 11.8), 0.3, 0.52, y - 0.3));
          }
        }
      }
      // where the case stands on the floor, a soft dark line
      if (from === 0) {
        const g = new THREE.PlaneGeometry(s1 - s0 + 5, 3.6);
        const uv = g.attributes.uv;
        g.setAttribute('uv1', new THREE.BufferAttribute(Float32Array.from({ length: uv.count * 2 }, (_, i) => (i % 2 ? 1 - uv.array[i] : uv.array[i])), 2));
        g.rotateX(-Math.PI / 2).rotateY(face);
        const q = on((s0 + s1) / 2, 15.8);
        LB.contact.add(g.translate(q[0], 6.14, q[1]));
      }
      // The lamp-rail: a bronze rod under the frieze on little arms, a line of
      // light along its underside washing down the top shelves (the wash is
      // in the books' own shader — see makeBookMaterial).
      if (graze > 0) {
        const r0 = on(s0, 14.4), r1 = on(s1, 14.4);
        LB.bronze.add(rodGeo([r0[0], FRIEZE_Y - 0.9, r0[1]], [r1[0], FRIEZE_Y - 0.9, r1[1]], 0.34));
        LB.railGlow.add(boxGeo(on(s0 + 0.5, 14.4), on(s1 - 0.5, 14.4), 0.22, 0.4, FRIEZE_Y - 1.5));
        for (const u of bayEnds.slice(0, 3).map((e, i) => (e + bayEnds[i + 1]) / 2)) {
          LB.bronze.add(placed(new THREE.BoxGeometry(0.4, 0.4, 1.6), on(u, 13.6), FRIEZE_Y - 0.9, turn));
        }
      }
    }
    // a brass rail for a ladder, along the full walls
    if (from === 0) {
      const ry = TIER_BASE + 2 * TIER_H + 7;
      const r0 = add(add(a, t, s0), inward, 14), r1 = add(add(a, t, s1), inward, 14);
      LB.bronze.add(rodGeo([r0[0], ry, r0[1]], [r1[0], ry, r1[1]], 0.45));
      for (const u of [s0 + 2, (s0 + s1) / 2, s1 - 2]) {
        const q = add(add(a, t, u), inward, 13);
        LB.bronze.add(placed(new THREE.BoxGeometry(0.8, 0.8, 3), q, ry, turn));
      }
    }
  };
  return { LAID, GRAZE_BY_ROOM, roman, hexNumber, shelfWall };
}

export function* buildFurniture(ctx) {
  const { paintings, light, rnd, rr, dir, add, lerp2, dist, hexPts, keep, lampHaloTex, stringWash,
    root, slabGeo, boxGeo, placed, rodGeo, barGeo, decal, halo, POOL_DIAL, point, R, A, GAP, RC,
    HALL, ARCH_SPRING, ARCH_R, WAY_IN, cellC, rimAt, deepAt, NB, cells, inFrame, routeDist, hallway,
    edgeFrame, hallMid, BRIDGE_LEVEL, ECHO_KERB, mouldGeo, wallRing, mirrors, LB, posts, links,
    balusters, books, globes, deadGlobes, dust, glows, LAID, GRAZE_BY_ROOM, roman, hexNumber,
    shelfWall } = ctx;
  // ── Furniture ─────────────────────────────────────────────────────────────
  // What gives a person's scale back to a room whose every wall is eleven
  // metres of books: a gallery overhead that you are not on, a ladder left
  // where the last reader stood it, and one corner somebody was reading in.
  // Most of what filled a frame stood three to twelve metres up; these are
  // at the height the eye actually lives at. None of it draws on the world's
  // random stream (placing a chair must not move the garden).
  const alongWall = (c, k) => {
    const e = edgeFrame(c, k), inward = [-e.n[0], -e.n[1]];
    const on = (u, z) => add(add(e.mi, e.t, u), inward, z);
    return { e, inward, on, at3: (u, z, y) => { const q = on(u, z); return [q[0], y, q[1]]; }, turn: -Math.atan2(e.t[1], e.t[0]) };
  };
  // An iron walk along the tier-3 shelf: a deck on brackets, a bronze fascia,
  // bars and a handrail. The room reads as tall because it has a floor in it
  // that nobody is standing on.
  const GALLERY_Y = TIER_BASE + 3 * TIER_H;
  const gallery = (c, k) => {
    const { on, at3, turn } = alongWall(c, k);
    const u0 = -R / 2 + 11, u1 = R / 2 - 11, Y = GALLERY_Y;
    LB.iron.add(boxGeo(on(u0, 15.4), on(u1, 15.4), 1.1, 6.8, Y - 1.1));
    LB.bronzeDim.add(boxGeo(on(u0, 18.95), on(u1, 18.95), 1.5, 0.35, Y - 1.35));
    for (let i = 0; i <= 3; i++) {
      const u = -R / 2 + 12 + (i * (R - 24)) / 3;
      LB.iron.add(rodGeo(at3(u, 12.9, Y - 10), at3(u, 18.4, Y - 1.2), 0.42));
      LB.iron.add(boxGeo(on(u - 0.3, 15.6), on(u + 0.3, 15.6), 1.2, 6.2, Y - 2.3));
    }
    LB.bronze.add(rodGeo(at3(u0, 18.5, Y + 9.6), at3(u1, 18.5, Y + 9.6), 0.42));
    LB.iron.add(rodGeo(at3(u0, 18.5, Y + 1.1), at3(u1, 18.5, Y + 1.1), 0.3));
    for (let u = u0 + 1.2; u < u1 - 0.6; u += 2.3) LB.iron.add(placed(new THREE.BoxGeometry(0.26, 8.5, 0.26), on(u, 18.5), Y + 5.35, turn));
    for (const u of [u0, u1]) LB.iron.add(placed(new THREE.BoxGeometry(1, 10.4, 1), on(u, 18.5), Y + 5.2, turn));
  };
  // A library ladder hooked over the brass rail every full wall carries.
  const ladder = (c, k, u) => {
    const { e, inward, on, turn } = alongWall(c, k);
    const ry = TIER_BASE + 2 * TIER_H + 7;
    const top = 14.7, foot = 26.5, rise = ry + 0.4 - 6, run = foot - top;
    const L = Math.hypot(rise, run), tilt = Math.atan2(run, rise);
    const parts = [];
    for (const sx of [-3.1, 3.1]) parts.push(new THREE.BoxGeometry(0.8, L, 0.55).translate(sx, L / 2, 0));
    for (let y = 3.6; y < L - 1.5; y += 4.3) parts.push(new THREE.CylinderGeometry(0.28, 0.28, 6.2, 8).rotateZ(Math.PI / 2).translate(0, y, 0));
    const g = mergeGeometries(parts);
    parts.forEach((x) => x.dispose());
    g.rotateX(-tilt);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(e.t[0], 0, e.t[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(inward[0], 0, inward[1])));
    const f = on(u, foot);
    LB.oak.add(g.translate(f[0], 6, f[1]));
    for (const sx of [-3.1, 3.1]) LB.bronze.add(placed(new THREE.BoxGeometry(1, 1.3, 1.8), on(u + sx, top), ry + 0.3, turn));
  };
  // A turned part: a lathe profile ([radius, height] from the end at `a`, the
  // heights in any units: they are spread over the length) set on the line
  // from a to b.
  const turned = (prof, a, b, segs = 10) => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const L = d.length(), top = prof[prof.length - 1][1];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, (y / top) * L)), segs);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.divideScalar(L)));
    return g.translate(a[0], a[1], a[2]);
  };
  // A bow-back Windsor, the chair a reading room actually had: a thick rounded
  // seat, four splayed legs turned with a ring where an H of turned stretchers
  // enters them, and a bent hoop raked back over seven spindles. Built facing
  // -z; a unit is 9.4 cm, so the seat is at 45 cm and the hoop at 95.
  const windsorChair = () => {
    const SEAT = 4.8, parts = [];
    // The seat: a D, straight sides and front and a round back, its edge
    // rounded over by the bevel (which adds 0.1 all round, so it is drawn
    // 0.1 in). Smoothed whole, so the rounding has no facets.
    const half = (z) => z >= -0.2 ? 2.2 - Math.max(0, 0.35 - Math.sqrt(Math.max(0, 0.35 ** 2 - Math.max(0, z - 1.6) ** 2))) : 2.2 * Math.sqrt(Math.max(0, 1 - ((z + 0.2) / 1.85) ** 2));
    const outline = [];
    for (let i = 0; i <= 24; i++) { const z = -2.05 + 4.0 * (1 - Math.cos((Math.PI * i) / 24)) / 2; outline.push(new THREE.Vector2(half(z), -z)); }
    for (let i = 23; i >= 1; i--) { const z = -2.05 + 4.0 * (1 - Math.cos((Math.PI * i) / 24)) / 2; outline.push(new THREE.Vector2(-half(z), -z)); }
    let seat = new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: 0.26, bevelEnabled: true, bevelThickness: 0.11, bevelSize: 0.1, bevelSegments: 3, curveSegments: 1 });
    seat.rotateX(-Math.PI / 2).translate(0, SEAT - 0.37, 0);
    seat.deleteAttribute('uv');
    seat.deleteAttribute('normal');
    seat = mergeVertices(seat);
    seat.computeVertexNormals();
    parts.push(seat);
    // the legs, splayed out to the side and raked: the back pair more
    const LEG = [[0, 0], [0.15, 0], [0.17, 0.3], [0.2, 1.1], [0.235, 1.45], [0.19, 1.6], [0.24, 1.7], [0.19, 1.8], [0.22, 2.2], [0.27, 2.85], [0.25, 3.25], [0.19, 3.75], [0.16, 4], [0.2, 4.15], [0.16, 4.3], [0.15, 4.75], [0, 4.75]];
    const RING = 1.7 / 4.75;
    const legAt = (sx, front) => ({ a: [sx * 2.2, 0, front ? 1.95 : -1.85], b: [sx * 1.62, 4.62, front ? 1.3 : -1.05] });
    const at = ({ a, b }, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const STRETCHER = [[0, 0], [0.11, 0], [0.13, 0.2], [0.17, 0.5], [0.13, 0.8], [0.11, 1], [0, 1]];
    const mids = [];
    for (const sx of [-1, 1]) {
      const f = legAt(sx, true), r = legAt(sx, false);
      parts.push(turned(LEG, f.a, f.b), turned(LEG, r.a, r.b));
      const p = at(f, RING), q = at(r, RING);
      parts.push(turned(STRETCHER, p, q, 8));
      mids.push([(p[0] + q[0]) / 2, p[1] + 0.05, (p[2] + q[2]) / 2]);
    }
    parts.push(turned([[0, 0], [0.12, 0], [0.14, 0.2], [0.18, 0.5], [0.14, 0.8], [0.12, 1], [0, 1]], mids[0], mids[1], 8));
    // The hoop: up from the seat's back corners, round over the top, raked
    // back 10° and following the round of the seat's back in plan. The
    // spindles stand on the same round, 0.45 in from the edge.
    const RAKE = 0.18;
    const plan = (x) => -0.2 - 1.85 * Math.sqrt(Math.max(0, 1 - (x / 2.3) ** 2)) + 0.45;
    const HOOP = [[1.92, 4.45], [1.95, 4.75], [2.08, 6], [2.05, 7.3], [1.82, 8.5], [1.3, 9.45], [0.68, 9.92], [0, 10.05]];
    const pts = [...HOOP.map(([x, h]) => [-x, h]), ...HOOP.slice(0, -1).reverse()]
      .map(([x, h]) => new THREE.Vector3(x, h, plan(x) - RAKE * (h - SEAT)));
    const hoop = new THREE.CatmullRomCurve3(pts);
    parts.push(new THREE.TubeGeometry(hoop, 72, 0.15, 8, false));
    const along = hoop.getSpacedPoints(400).filter((p) => p.y > 8.6);
    const SPINDLE = [[0, 0], [0.085, 0], [0.105, 0.22], [0.1, 0.42], [0.075, 0.8], [0.07, 1], [0, 1]];
    for (const x of [-1.32, -0.88, -0.44, 0, 0.44, 0.88, 1.32]) {
      const top = along.reduce((best, p) => (Math.abs(p.x - x * 1.08) < Math.abs(best.x - x * 1.08) ? p : best));
      const foot = [x, SEAT - 0.18, plan(x)];
      const d = [top.x - foot[0], top.y - foot[1], top.z - foot[2]], l = Math.hypot(...d);
      parts.push(turned(SPINDLE, foot, [top.x + (d[0] / l) * 0.08, top.y + (d[1] / l) * 0.08, top.z + (d[2] / l) * 0.08], 8));
    }
    return parts.map((g) => g.rotateY(Math.PI));
  };
  // A table against the cases with its lamp, an open book, a closed one with a
  // smaller one on it, a stack on the floor by the leg and the chair pushed
  // back from it. `lit`: in the Silence the lamp is out and the chair was left
  // turned away.
  //
  // The books are the size of books a person reads at a table: folios of 35-46
  // cm.
  const readingCorner = (c, k, u0, { lit = true } = {}) => {
    const { on, turn } = alongWall(c, k);
    const TOP = 6 + 7.6, Z = 22;
    LB.shelf.add(placed(new THREE.BoxGeometry(15, 0.7, 7.2), on(u0, Z), TOP - 0.35, turn));
    LB.shelf.add(placed(new THREE.BoxGeometry(13.6, 1.3, 6), on(u0, Z), TOP - 1.35, turn));
    // the legs: square where the apron is tenoned into them, then turned — a
    // collar, a long vase, a ring at the ankle and a bun foot
    const TLEG = [[0, 0], [0.24, 0], [0.31, 0.1], [0.33, 0.28], [0.26, 0.48], [0.19, 0.62], [0.23, 0.72], [0.19, 0.84], [0.21, 1.5], [0.29, 2.9], [0.34, 3.8], [0.3, 4.4], [0.22, 4.75], [0.31, 4.93], [0.33, 5.1], [0.27, 5.28], [0.3, 5.6], [0, 5.6]];
    const KNEE = TOP - 2;
    for (const [du, dz] of [[-6.4, -2.6], [6.4, -2.6], [-6.4, 2.6], [6.4, 2.6]]) {
      const q = on(u0 + du, Z + dz);
      LB.shelf.add(turned(TLEG, [q[0], 6, q[1]], [q[0], KNEE, q[1]], 12));
      LB.shelf.add(placed(new THREE.BoxGeometry(0.9, TOP - 0.7 - KNEE, 0.9), q, (KNEE + TOP - 0.7) / 2, turn));
    }
    // the lamp: a brass foot and stem, and an amber shade with the bulb glowing
    // through it — light at the height of a reader's hands, which nothing else
    // in the Library gives. A desk lamp's size, 50 cm with a 36 cm shade, so
    // that it is not the biggest thing on the table.
    const lp = on(u0 + 5, Z - 1.5);
    LB.bronze.add(placed(new THREE.CylinderGeometry(1.05, 1.25, 0.32, 18), lp, TOP + 0.16));
    LB.bronze.add(placed(new THREE.CylinderGeometry(0.15, 0.15, 4.3, 8), lp, TOP + 2.45));
    (lit ? LB.shade : LB.shadeDead).add(placed(new THREE.CylinderGeometry(0.85, 1.9, 1.8, 22, 1, true), lp, TOP + 4.65));
    if (lit) {
      glows.push({ p: [lp[0], TOP + 4.2, lp[1]], s: [0.55, 0.55, 0.55], color: '#ffd9a0', k: 1.25 });
      decal(lp, 8, 8, '#ffb060', 0.35 * POOL_DIAL, TOP + 0.04);
      // On the floor itself (its dark band is 6.1), not at 6.6 with the
      // room's pools: a sheet of added light 6 cm up the legs drew a pale
      // sock round the foot of every leg in the corner.
      decal(on(u0, Z + 5), 46, 46, '#ffb060', 0.1 * POOL_DIAL, 6.15, 0, [lp[0], TOP + 4.2, lp[1], 0.4]);
      // The bulb a light of its own, low: the pool hands it a light only
      // when the reader is at the table (lampPass.js)
      if (LAMPS.corner) point(lp, TOP + 4.2, '#ffc58a', 520, -1);
    }
    // the open book, a folio: leather boards, and the two halves of the text
    // block lifting toward the spine
    const bp = on(u0 - 3.6, Z + 0.8), bt = turn + 0.14;
    LB.leather.add(placed(new THREE.BoxGeometry(6, 0.14, 4.2), bp, TOP + 0.07, bt));
    for (const side of [-1, 1]) {
      LB.paper.add(placed(new THREE.BoxGeometry(2.8, 0.34, 3.95).translate(side * 1.45, 0.17, 0).rotateZ(-side * 0.06), bp, TOP + 0.14, bt));
    }
    const shut = on(u0 + 1.3, Z - 1.6), onIt = on(u0 + 1.45, Z - 1.75);
    books.push({ p: [shut[0], TOP + 0.35, shut[1]], rot: [0, turn + 0.25, 0], s: [3.9, 0.7, 2.8], color: '#5a2923', k: 1, spine: LAID + SPINE_KINDS.label[0] + 3 });
    books.push({ p: [onIt[0], TOP + 0.7 + 0.22, onIt[1]], rot: [0, turn - 0.05, 0], s: [3.2, 0.44, 2.3], color: '#2d3a2b', k: 1, spine: LAID + SPINE_KINDS.label[0] + 7 });
    // the stack, clear of the leg (at u0 + 6.4) by a hand: each book a
    // little off the one under it
    let lie = 6;
    [[4.9, 0.85, 3.6, '#6f4c31'], [4.5, 0.62, 3.3, '#2d3a2b'], [4.7, 0.9, 3.4, '#221d19'], [4.1, 0.55, 3, '#a89a7b'], [4.3, 0.7, 3.1, '#5a2923'], [3.6, 0.5, 2.6, '#4a3a28']].forEach(([w, th, dp, color], i) => {
      const q = on(u0 + 10.2 + [0, 0.12, -0.1, 0.15, 0, -0.12][i], Z - 0.8 + [0, -0.1, 0.12, 0, -0.15, 0.08][i]);
      books.push({ p: [q[0], lie + th / 2, q[1]], rot: [0, turn + [0.05, -0.1, 0.16, -0.06, 0.22, -0.14][i], 0], s: [w, th, dp], color, k: 1, spine: LAID + SPINE_KINDS.label[0] + i * 3 });
      lie += th;
    });
    // the chair
    const cp = on(u0 - 3.5, Z + 8), ct = turn + (lit ? 0.35 : 1.1);
    for (const g of windsorChair()) LB.shelf.add(placed(g, cp, 6, ct));
  };
  // A reader standing far off in a gallery the walk only looks into: the
  // walking readers' own figure (readers.js), cut coarser than a near one needs
  // and all gathered into one mesh once the galleries are built (below). (Not a
  // robe turned on a lathe: from anywhere near, that is a pawn, the same from
  // every side, with no shoulders and no arms.)
  const distantReaders = [];
  const figure = (p, y) => {
    distantReaders.push({ p, y, ry: rr(0, Math.PI * 2) });
  };
  // A glass sphere lamp hung on a chain from above the walls: a hot core, a
  // glass shell, a halo, and — for the lamps that matter — a real light.
  const LAMP_Y = 66;
  // `beam`: the cone of lit air to the floor under it (not for a lamp hung in the Vertigo's well).
  // `out`: a lamp that has gone out — the fitting, the chain and the cold glass,
  // and nothing else. "Where the lamps grow faint" needs lamps that ARE faint,
  // not one lamp turned down.
  // `haze`: how much halo it is allowed. A lamp's halo is a sprite drawn with
  // depthTest OFF so it can lie over the stone it lights; within about sixty
  // units of where a reader stands that becomes a hundred-unit disc of light in
  // FRONT of the room, and the gallery goes milky. Lamps near a stand turn it down.
  const lamp = (p, { y = LAMP_Y, light: power = 0, priority = 0, color = '#ffb466', strength = 1, pool = 0.3, poolSize = 200, poolY = 6.6, poolAt = p, r = 9, beam = true, out = false, haze = 1, chain = Infinity, link = 1 } = {}) => {
    // One opal globe, with no clear shell round it: a lit globe is the light
    // (makeLampGlobeMaterial), a dead one is the same globe in cold, dull
    // glass.
    const G = r * 0.55;
    (out ? deadGlobes : globes).push({ p: [p[0], y, p[1]], s: [G, G, G], ...(out ? {} : { color: '#fff3e2', k: 0.45 + strength * 0.5 }) });
    // The fitting sits ON the globe, outside it: a collar gripping its neck, a
    // bead of rim where the glass goes in, a cap, and a loop for the chain; a
    // small drop finishes the bottom of the glass.
    LB.bronze.add(placed(new THREE.CylinderGeometry(G * 0.34, G * 0.46, G * 0.26, 24), p, y + G * 0.99));
    LB.bronze.add(placed(new THREE.TorusGeometry(G * 0.47, G * 0.045, 8, 32).rotateX(Math.PI / 2), p, y + G * 0.87));
    LB.bronze.add(placed(new THREE.CylinderGeometry(G * 0.1, G * 0.34, G * 0.2, 20), p, y + G * 1.22));
    LB.bronze.add(placed(new THREE.TorusGeometry(G * 0.13, G * 0.035, 6, 16), p, y + G * 1.45));
    LB.bronze.add(placed(new THREE.ConeGeometry(G * 0.09, G * 0.3, 12).rotateX(Math.PI), p, y - G * 1.1));
    // `chain`: how far up the links are drawn before the dark is left to say
    // the rest. A lamp in a gallery hangs from the top of the wall and its
    // whole chain is part of the room. A lamp hung in the Vertigo's well hangs
    // four hundred units down, and drawing every link of that puts a black
    // cable from the top of the frame to the bottom across the one thing the
    // room is for — the look down the funnel. The chain still rises out of the
    // light; it just stops being drawn once there is nothing left to light it.
    const chainTop = Math.min(MASS_H + 40, y + G * 1.58 + chain);
    for (let cy = y + G * 1.58, k = 0; cy < chainTop; cy += 1.55 * link, k++) {
      links.push({ p: [p[0], cy, p[1]], rot: [0, k % 2 ? Math.PI / 2 : 0, 0], s: [link, link, link] });
    }
    if (out) return;
    // the cone of lit air beneath it
    if (beam && (power || strength >= 1)) {
      const h = y - r - 6, foot = Math.min(poolSize * 0.3, 62);
      LB.shafts.add(shaftVolume(
        new THREE.CylinderGeometry(r * 0.7, foot, h, 28, 1, true).translate(p[0], 6 + h / 2, p[1]),
        [p[0], 6, p[1]], foot, [p[0], 6 + h, p[1]], r * 0.7,
      ));
    }
    halo(p, y, r * 11 * (0.6 + strength * 0.4) * Math.sqrt(haze), '#ffc27a', (0.08 + strength * 0.52) * haze, lampHaloTex);
    // Every lamp may light its room; which ones do, at a given moment, is the
    // light pool's business (see updateLights).
    point(p, y - 4, color, power || 2400 * strength, power ? priority : -1);
    // (`poolAt`: where it falls is a floor that stops short of under the lamp)
    if (pool) decal(poolAt, poolSize, poolSize, '#ffb060', pool * POOL_DIAL, poolY, 0.1, [p[0], y, p[1], G]);
  };

  const mounts = [];
  const hangPainting = (index, [x, z], y, normal, width) => {
    if (!paintings) return;
    const height = width / (3376 / 1440);
    const angle = Math.atan2(normal[0], normal[1]);
    const frameGeo = new THREE.BoxGeometry(width + 5, height + 5, 2.2);
    frameGeo.rotateY(angle);
    frameGeo.translate(x, y, z);
    LB.frame.add(frameGeo);
    const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
    const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
    plane.position.set(x + normal[0] * 1.25, y, z + normal[1] * 1.25);
    plane.rotation.y = angle;
    root.add(plane);
    mounts[index] = { center: [x + normal[0] * 1.25, y, z + normal[1] * 1.25], normal, width, height, material: mat };
  };

  // An arch over a hallway: fills the opening above the arch through the
  // thickness of the stone, with a cap on top.
  const archGeoOf = (len) => {
    const s = new THREE.Shape();
    s.moveTo(-HALL / 2, MASS_H);
    s.lineTo(HALL / 2, MASS_H);
    s.lineTo(HALL / 2, ARCH_SPRING);
    s.absarc(0, ARCH_SPRING, ARCH_R, 0, Math.PI, false);
    s.lineTo(-HALL / 2, MASS_H);
    const g = new THREE.ExtrudeGeometry(s, { depth: len + 0.2, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -(len + 0.2) / 2);
    return g;
  };
  const archGeo = archGeoOf(GAP);
  // Dressed stone on each face of the opening: an archivolt, a keystone, and a
  // pilaster up each jamb — a hole cut in a wall reads as a hole.
  // `cut`: how much shorter the hallway is at its -n and +n ends, where the
  // room there (the Echo) stands further out into its walls.
  const archivoltGeo = keep(new THREE.TorusGeometry(ARCH_R + 1.6, 1.6, 8, 28, Math.PI));
  // The ring as it would be built: thirteen voussoirs, each cut to the arch's
  // centre, the keystone longer and standing out further, set a little proud of
  // the wall on a bed of mortar that shows in their joints (vestFix.js, 5;
  // ?wvest=old:5 puts the old smooth moulding back). Built in the arch's own
  // frame, x across, y up, z out of the face: `z0`..`z1`.
  const VOUSSOIRS = 13, V_DEEP = 3.4, V_JOINT = 0.012;
  const ringBlock = (a0, a1, ri, ro, z0, z1) => {
    const at = (a, r) => [Math.cos(a) * r, ARCH_SPRING + Math.sin(a) * r];
    const sh = new THREE.Shape();
    const p = [at(a0, ri), at(a1, ri), at(a1, ro), at(a0, ro)];
    sh.moveTo(...p[0]);
    p.slice(1).forEach((q) => sh.lineTo(...q));
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
    return g.translate(0, 0, z0);
  };
  const voussoirsGeo = (zFace) => {
    const stones = [], beds = [];
    for (let k = 0; k < VOUSSOIRS; k++) {
      const key = k === (VOUSSOIRS - 1) / 2;
      const a0 = (Math.PI * k) / VOUSSOIRS, a1 = (Math.PI * (k + 1)) / VOUSSOIRS;
      // the stone, a hair under the soffit (never in its plane) and clear of its neighbours
      stones.push(ringBlock(a0 + V_JOINT, a1 - V_JOINT, ARCH_R - 0.06, ARCH_R + (key ? V_DEEP + 1.3 : V_DEEP), zFace - 0.05, zFace + (key ? 0.95 : 0.6)));
      // and the mortar behind it, set back from its face, filling its joints (a
      // piece to each stone: cut by the quarter, its straight edges would be
      // two dark beams across the opening)
      beds.push(ringBlock(a0, a1, ARCH_R - 0.03, ARCH_R + V_DEEP - 0.1, zFace - 0.05, zFace + 0.42));
    }
    return { stone: mergeGeometries(stones, false), mortar: mergeGeometries(beds, false), parts: [...stones, ...beds] };
  };
  const arch = (mid0, n, uvAt = null, cut = [0, 0], mass = LB.mass) => {
    const turn = Math.atan2(n[0], n[1]);
    const len = GAP - cut[0] - cut[1], mid = add(mid0, n, (cut[0] - cut[1]) / 2);
    const g = len === GAP ? archGeo.clone() : archGeoOf(len);
    g.rotateY(turn);
    g.translate(mid[0], 0, mid[1]);
    mass.add(g, uvAt);
    LB.cap.add(boxGeo(add(mid, n, -len / 2), add(mid, n, len / 2), CAP, HALL, MASS_H), uvAt);
    const across = [n[1], -n[0]];
    for (const side of [-1, 1]) {
      const face = add(mid, n, side * (len / 2 + 0.7));
      if (vestOld(5)) {
        LB.cap.add(archivoltGeo.clone().rotateY(turn).translate(face[0], ARCH_SPRING, face[1]), uvAt);
        LB.cap.add(new THREE.BoxGeometry(4.2, 6, 3.4).rotateY(turn).translate(face[0], ARCH_SPRING + ARCH_R + 2.4, face[1]), uvAt);
      } else {
        // (on the -n face the ring is built facing +z and turned round to it)
        const { stone, mortar, parts } = voussoirsGeo(len / 2 + 0.1);
        for (const [batch, g] of [[LB.cap, stone], [LB.joint, mortar]]) {
          if (side < 0) g.rotateY(Math.PI);
          batch.add(g.rotateY(turn).translate(mid[0], 0, mid[1]), uvAt);
        }
        parts.forEach((g) => g.dispose());
      }
      for (const s of [-1, 1]) {
        const j = add(face, across, s * (HALL / 2 + 1.6));
        LB.cap.add(new THREE.BoxGeometry(3.2, ARCH_SPRING - 6, 1.8).rotateY(turn).translate(j[0], 6 + (ARCH_SPRING - 6) / 2, j[1]), uvAt);
        LB.cap.add(new THREE.BoxGeometry(4.4, 2, 2.6).rotateY(turn).translate(j[0], ARCH_SPRING - 1, j[1]), uvAt);
      }
    }
  };

  // A stone balustrade along the rim of a gallery, on top of its walls: posts
  // and a rail, broken where a hallway or a fallen wall opens.
  const RAIL_H = 10;
  const railRun = (a, b) => {
    const len = dist(a, b);
    if (len < 6) return;
    const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    for (let u = 3; u <= len - 3; u += 8) {
      const p = add(a, t, u);
      posts.push({ p: [p[0], MASS_H + CAP + RAIL_H / 2, p[1]], s: [2, RAIL_H, 2] });
    }
    LB.rail.add(boxGeo(a, b, 2, 3.4, MASS_H + CAP + RAIL_H));
  };
  const balustrade = (cell, halls) => {
    for (let k = 0; k < 6; k++) {
      const e = edgeFrame(cell.c, k);
      const a = add(e.i0, e.n, 3.5), b = add(e.i1, e.n, 3.5);
      const rim = rimAt(cell.c);
      const opening = halls.includes(k)
        ? [0.5 - (HALL + 8) / (2 * rim), 0.5 + (HALL + 8) / (2 * rim)]
        : null;
      if (opening) {
        railRun(a, lerp2(a, b, opening[0]));
        railRun(lerp2(a, b, opening[1]), b);
      } else {
        railRun(a, b);
      }
    }
  };

  for (const cell of cells) {
    if (cell.garden || cell.k === '3,-3') continue;
    yield;
    const { c } = cell;
    const room = cell.room;
    const lit = room !== undefined;
    const framed = inFrame(c);
    const near = Math.exp(-((routeDist(c) / 430) ** 2));
    const shaft = room === 0 ? 48 : room === 4 ? 0 : room === 2 ? 40 : room === 1 ? 38 : 36;
    const halls = [0, 1, 2, 3, 4, 5].filter((k) => hallway(cell, k));
    // The hallways, and the wall the Door has lost into the garden.
    const gaps = (k) => [
      ...(halls.includes(k) ? [[-HALL / 2, HALL / 2]] : []),
      ...(cell.k === '4,-4' && k === 5 ? [[(0.27 - 0.5) * R, (0.76 - 0.5) * R]] : []),
    ];
    // The hole half a unit wider than the shaft, so the slab's cut edge is
    // buried inside the well's liner (below). Cut at `shaft` itself, it stood
    // in the very plane of the liner's face for the slab's whole depth, and
    // the two fought for every pixel of the band under the rail's plinth:
    // stripes of stone and dark that reshuffled with every step.
    LB.floor.add(slabGeo(hexPts(c, RC), shaft ? [hexPts(c, shaft + 0.5)] : [], 6, 0));
    // A floor with a plan to it: a band of darker stone along the foot of the
    // cases with a brass fillet on its inner edge, and a ring of the pale stone
    // round the lip of the well. One grid from wall to well says nothing about
    // where the room's edge is, or its middle. (the band follows the cases out
    // in a wider room; the ring round the well stays with the well)
    const rim = rimAt(c), wider = rim - R;
    if (lit) {
      LB.floorBand.add(slabGeo(hexPts(c, 83.8 + wider), [hexPts(c, 72.4 + wider)], 0.1, 6));
      if (auditOld(1)) LB.inlay.add(slabGeo(hexPts(c, 72.9 + wider), [hexPts(c, 72.1 + wider)], 0.16, 6));
      else LB.fillet.add(slabGeo(hexPts(c, FILLET.outer + wider), [hexPts(c, FILLET.inner + wider)], FILLET.proud, 6));
      if (shaft) LB.cap.add(slabGeo(hexPts(c, shaft + 13), [hexPts(c, shaft + 2.6)], 0.08, 6));
    }
    // (the way in's two walls, stone for stone the far hallway's: WAY_IN)
    const wayInSide = cell.k === WAY_IN.from ? 150 : cell.k === WAY_IN.to ? 330 : null;
    for (const piece of wallRing(c, rim, RC, gaps)) {
      const mid = piece.reduce((m, q) => [m[0] + q[0] / piece.length, m[1] + q[1] / piece.length], [0, 0]);
      const bearing = (Math.atan2(mid[1] - c[1], mid[0] - c[0]) / deg + 360) % 360;
      const uvAt = wayInSide !== null && Math.abs(((bearing - wayInSide + 540) % 360) - 180) < 30 ? WAY_IN.by : null;
      (room === 0 ? LB.vestMass : LB.mass).add(slabGeo(piece, [], MASS_H, 0), uvAt);
      LB.cap.add(slabGeo(piece, [], CAP, MASS_H), uvAt);
    }
    if (hallway(cell, 5)) {
      arch(hallMid(cell.i, cell.j, 5), dir(330), cell.k === WAY_IN.to ? WAY_IN.by : null,
        [deepAt(c), deepAt(cellC(cell.i + NB[5][0], cell.j + NB[5][1]))], room === 0 || cell.k === WAY_IN.to ? LB.vestMass : LB.mass);
    }
    if (framed) balustrade(cell, halls);

    // Shelves: every tier in the lit galleries, fewer as the Library recedes.
    const topTier = lit ? TIERS - 1 : framed ? (light ? 1 : (near > 0.3 ? 4 : 2)) : 0;
    const fromTier = lit ? 0 : TIERS - 1 - topTier;
    const dress = { room, detail: lit ? 2 : near > 0.5 ? 1 : 0, graze: GRAZE_BY_ROOM[room] ?? 0 };
    const hexNo = lit ? hexNumber(cell.i, cell.j) : null;
    const wallWords = (k) => hexNo && [`HEXAGON ${hexNo} · WALL ${roman(k + 1)}`, `HEXAGON ${hexNo}`];
    for (let k = 0; k < 6; k++) {
      // "Between two shelves the stone gives way" — so the Door's broken wall
      // keeps its shelving either side of the breach, right up to the jamb.
      // It had none at all, which left the way out a bare slot in masonry.
      if (cell.k === '4,-4' && k === 5) {
        const e5 = edgeFrame(c, 5);
        const inward5 = [-e5.n[0], -e5.n[1]];
        const at5 = (t) => add(e5.mi, e5.t, t);
        // No number on this wall: between the corners and the portal's gable
        // block only a hand's breadth of either cornice shows. The wall that
        // gave way is the one missing from the count.
        shelfWall(at5(-62), at5(-11), inward5, { from: 0, to: TIERS - 1, ...dress });
        shelfWall(at5(14), at5(62), inward5, { from: 0, to: TIERS - 1, ...dress });
        continue;
      }
      const e = edgeFrame(c, k);
      const inward = [-e.n[0], -e.n[1]];
      if (halls.includes(k)) {
        // "In the hallway there is a mirror, which faithfully duplicates all
        // appearances." With ?wglass=old, a glass hung ON the hallway's wall,
        // in a frame, stopping short of both openings so each doorway keeps its
        // jambs and reads as a door. Otherwise the Library's mirrors hang as
        // pier glasses either side of a gallery's way out (below). The stream
        // is drawn here either way.
        if (k === 5 && (lit || (framed && rnd() < 0.4) || cell.k === WAY_IN.to) && GLASS_OLD) {
          const on = (along, z) => add(add(e.mi, e.n, along), e.t, z);
          // (from this room's face to the next one's, a hallway into the Echo
          // being shorter; and the way in hangs its glass where the hallway it
          // is dressed as has one, which starts that much further along)
          const lead = cell.k === WAY_IN.to ? deepAt(add(c, WAY_IN.by)) : 0;
          const a0 = 8 + lead, a1 = GAP - deepAt(c) - deepAt(cellC(cell.i + NB[5][0], cell.j + NB[5][1])) - 8;
          const z = HALL / 2 - 0.3, y0 = 12, y1 = 44;
          LB.mirror.add(boxGeo(on(a0, z), on(a1, z), y1 - y0, 0.5, y0));
          const fz = HALL / 2 - 0.55, bar = 1.3;
          LB.frame.add(boxGeo(on(a0 - bar, fz), on(a1 + bar, fz), bar, 1, y0 - bar));
          LB.frame.add(boxGeo(on(a0 - bar, fz), on(a1 + bar, fz), bar, 1, y1));
          for (const a of [a0 - bar / 2, a1 + bar / 2]) {
            LB.frame.add(boxGeo(on(a - bar / 2, fz), on(a + bar / 2, fz), y1 - y0, 1, y0));
          }
        }
        // A pier glass on each pier of the way out: the bare ashlar between
        // the arch's jambs (21.2 out from its axis) and the corner cases, so
        // the room is in it from wherever the gallery is crossed toward the
        // next one. Clear of any room's stream: these draw nothing from it.
        if (k === 5 && lit && !GLASS_OLD) {
          const pier = (HALL / 2 + 3.2 + rimAt(c) / 2) / 2 - 0.8;
          for (const s of [-1, 1]) {
            const { bright, deep } = mirrors.hang({ at: add(e.mi, e.t, s * pier), y: 14.5, normal: inward, hw: 6, side: 25 });
            bright.forEach((g) => LB.gilt.add(g));
            deep.forEach((g) => LB.giltDeep.add(g));
          }
        }
        // A string course over the Vestibule's way out (libFix3.js, 6), or the
        // wall over the arch is flat block going to black, the top third of the
        // room's first frame. A moulded course in the pale stone three units
        // over the keystone, from corner case to corner case — a bed fillet, a
        // cove, a fascia and a weathered top — and a lamp-rail lying on its
        // ledge, out of sight from the floor, washing the stone over it as the
        // cases' rails wash their top shelves.
        if (k === 5 && lit && room === 0 && !lib3Old(6)) {
          const p = STRING.proud, y = STRING.y;
          const half = [[1.0, 0, true], [1.0, 0.5, true], [1.2, 0.85], [1.6, 1.4], [p, 1.9, true], [p, 3.3, true], [1.1, 4.0, true]];
          const sec = [...half.map(([z, h, s]) => [-z, h, s]).reverse(), ...half].reverse();
          LB.cap.add(mouldGeo([e.i0, e.i1].map(([x, z]) => [x, y, z]), sec));
          stringWash.a.value.set(e.mi[0], e.mi[1], y + 4, STRING.glow);
          stringWash.b.value.set(e.t[0], e.t[1], rimAt(c) / 2, 0);
        }
        // Books over the Echo's ways out (echoFix.js, 7): the room is named for
        // repetition, and through the upper arcade every bay shows shelves,
        // these two too. The top tier runs right across over the arch (its apex
        // is at 76, the tier begins at 94); the two below it stand on the piers
        // either side, over the pier glasses (whose heads are under 50), from
        // the corner to a few units clear of the arch's voussoirs. Drawing
        // nothing from the world's stream (`stream: 0`): the books are the
        // walls' own.
        if (room === 1 && lit && !echoOld(7)) {
          const clear = ARCH_R + 4;
          shelfWall(e.i0, e.i1, inward, { from: TIERS - 1, to: TIERS - 1, ...dress, stream: 0 });
          // (shelfWall keeps 12 clear at each end of what it is given)
          shelfWall(e.i0, add(e.mi, e.t, -clear + 12), inward, { from: 2, to: TIERS - 2, ...dress, stream: 0 });
          shelfWall(add(e.mi, e.t, clear - 12), e.i1, inward, { from: 2, to: TIERS - 2, ...dress, stream: 0 });
        }
        continue;
      }
      // (a wider room's longer walls still draw the world's stream for a
      // standard wall, or everything built after them would move)
      const stream = wider ? dist(add(c, dir(60 * k), R), add(c, dir(60 * k + 60), R)) : undefined;
      if (lit && k === 4 && paintings) shelfWall(e.i0, e.i1, inward, { from: 3, to: TIERS - 1, ...dress, words: wallWords(k), stream });
      else shelfWall(e.i0, e.i1, inward, { from: fromTier, to: TIERS - 1, ...dress, words: wallWords(k), stream });
    }
    if (lit) hangPainting(room, [c[0], c[1] - A - deepAt(c) + 2.5], 38, [0, 1], 80);

    if (shaft) {
      // (2.5 thick, so its top, level with the paving, lies wholly under the
      // bronze plinth or the parapet: at 3 a sliver of it showed beside the
      // parapet's foot, in the floor's own plane)
      const lining = lit && room === 0 && !vestOld(7) ? LB.wellGlow : LB.well;
      lining.add(slabGeo(hexPts(c, shaft + 2.5), [hexPts(c, shaft)], 236, -230));
      LB.stars.add(slabGeo(hexPts(c, shaft + 2), [], 1, -232));
      if (lit && room === 0 && BRIDGE_LEVEL) {
        // (the Vestibule's well rail is laid with its bridge, as one run
        // round each half of the well: vestibuleBridge.js)
      } else if (lit && room === 1 && ECHO_KERB) {
        // The Echo's well is the one its bridge stands over: a bronze rail
        // round it would run under both flights' arches a hand's breadth below
        // their soffits, a turned rail of another metal and another shape under
        // the stone one. So a kerb instead, in the balustrades' stone: a
        // plinth, a plain die and a rounded coping, 46 cm high, the well's lip
        // and no kind of rail. (Carved stone, not a stair: body.js takes no
        // step up onto it, and no crest.)
        const ring = hexPts(c, shaft + 1.4), mid = lerp2(ring[5], ring[0], 0.5);
        const loop = [mid, ...ring, mid].map(([x, z]) => [x, 6, z]);
        const box = (half, y0, y1) => [[-half, y0, true], [half, y0, true], [half, y1, true], [-half, y1, true]];
        LB.balustrade.add(mouldGeo(loop, box(1.6, -0.3, 0.6)));
        LB.balustrade.add(mouldGeo(loop, box(1.2, 0.5, 4.1)));
        LB.balustrade.add(mouldGeo(loop, [[-1.6, 4, true], [1.6, 4, true], [1.6, 4.45], [1.42, 4.8], [1.0, 4.95], [-1.0, 4.95], [-1.42, 4.8], [-1.6, 4.45]]));
      } else if (lit) {
        // a turned bronze balustrade round the well: base, balusters, rail
        LB.bronze.add(slabGeo(hexPts(c, shaft + 2.8), [hexPts(c, shaft)], 1.4, 6));
        LB.bronze.add(slabGeo(hexPts(c, shaft + 2.4), [hexPts(c, shaft + 0.4)], 0.7, 7.4));
        // The rail: a bead, a neck, and a rounded handrail on them, rubbed
        // bright on top where hands have gone round it — six straight lengths,
        // their joints closed by a knuckle of the same section, and in the
        // Vestibule (the one well no stair crosses at a corner) a newel
        // standing on each corner.
        //
        // And LOW. "The ventilation shafts are surrounded by very low
        // railings", Borges says, and at a man's hip the rail would stand
        // across the lower third of every stand's view, two paces away and the
        // largest thing in it. At a reader's knee (the handrail tops at 12.5,
        // 60 cm up) it lies along the bottom edge of the frame and the room has
        // its floor.
        LB.bronzeDim.add(slabGeo(hexPts(c, shaft + 2.9), [hexPts(c, shaft - 0.1)], 0.6, 10.5));
        {
          const corners = hexPts(c, shaft + 1.4);
          corners.forEach((q, k) => {
            LB.bronzeWorn.add(barGeo(q, corners[(k + 1) % 6], 11.8, 1.3, 0.6));
            LB.bronzeWorn.add(placed(new THREE.SphereGeometry(1.3, 18, 12).scale(1, 0.6, 1), q, 11.8));
            if (room === 0) {
              LB.bronzeDim.add(placed(new THREE.CylinderGeometry(0.95, 1.25, 5.4, 14), q, 6 + 2.7));
              // capped low and moulded: a ball would be the nearest, brightest
              // round thing in the Vestibule's first frame
              LB.bronzeWorn.add(placed(new THREE.CylinderGeometry(1.15, 0.95, 0.55, 16), q, 12.75));
              LB.bronzeWorn.add(placed(new THREE.SphereGeometry(0.62, 14, 8).scale(1, 0.55, 1), q, 13.1));
            }
          });
        }
        const ringPts = hexPts(c, shaft + 1.4);
        ringPts.forEach((q, k) => {
          // One baluster every 6.4 rather than every 4.2. At the tighter
          // spacing the rail round the well is a picket fence: from a reader's
          // eye the turned shafts close up into a solid bronze band across the
          // bottom of the frame, and the floor and the well behind it are both
          // lost. Spaced out you see between them, and the room keeps its
          // floor.
          const next = ringPts[(k + 1) % 6], n = Math.floor(dist(q, next) / 6.4);
          for (let s = 0; s < n; s++) {
            const b = lerp2(q, next, (s + 0.5) / n);
            balusters.push({ p: [b[0], 7.4, b[1]], s: [0.85, 0.5, 0.85] });
          }
        });
      } else {
        LB.bronzeDim.add(slabGeo(hexPts(c, shaft + 2.6), [hexPts(c, shaft)], 9, 6));
      }
      if (lit || near > 0.4) decal(c, shaft * 2.6, shaft * 2.6, '#79a8bd', lit ? 0.07 : 0.035, 6.8);
      // 0.5 proud, never 0.6. The lamps lay their pools of light flat at 6.6
      // (decal), and a ring whose top stood in that very plane fought them
      // for every pixel: a comb of lit and unlit teeth down the brass that
      // changed with every step, which is the "blinking rails on the floor".
      if (lit && room !== 4) LB.inlay.add(slabGeo(hexPts(c, shaft + 18), [hexPts(c, shaft + 16.6)], 0.5, 6));
    }
    if (!lit && framed && rnd() < 0.14 + 0.5 * near) {
      const strength = 0.15 + 0.6 * near;
      lamp(add(c, dir(rr(0, 360)), shaft + 26), { strength, pool: near > 0.2 ? 0.05 + 0.16 * near : 0, poolSize: 180 });
      if (rnd() < 0.3) figure(add(c, dir(rr(0, 360)), shaft + 12), 6);
    }
    if (lit) {
      // Dust, not a snowstorm. At 26 a gallery of it reads as sparkle rather
      // than air — and the eye goes to whatever moves, which is the wrong
      // thing.
      for (let s = 0; s < (light ? 6 : 14); s++) {
        const p = add(c, dir(rr(0, 360)), rr(0, R * 0.8));
        dust.push({ p: [p[0], rr(12, MASS_H - 10), p[1]], s: Array(3).fill(rr(0.4, 0.9)), color: '#ffdca8', k: rr(0.16, 0.4), phase: rr(0, 100) });
      }
    }
  }

  // The rooms' furniture: a gallery on each of the two walls at the sides of a
  // stand's view, a ladder on another, and a reading corner on a wall the walk
  // does not pass (check:walls holds all of it off the legs).
  if (!paintings) {
    const V = cellC(0, 0), S = cellC(2, -2), Dr = cellC(4, -4);
    gallery(V, 1); gallery(V, 4); ladder(V, 3, 20); readingCorner(V, 4, -16);
    gallery(S, 0); gallery(S, 3); ladder(S, 4, -20); readingCorner(S, 3, 12, { lit: false });
    gallery(Dr, 1); gallery(Dr, 4); ladder(Dr, 0, doorPropsOld(9) ? 16 : DOOR_LADDER_U); readingCorner(Dr, 3, -10);
  }
  return { alongWall, distantReaders, lamp, mounts, hangPainting, archGeo, RAIL_H, railRun };
}
