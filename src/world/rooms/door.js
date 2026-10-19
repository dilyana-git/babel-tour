// V — the Door (buildWorld.js, assembleWorld): the gallery whose sixth wall
// gave way, and the arch onto the garden.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lanternPaneGeometry } from '../sconce';
import { flameGeometry, waxGlowGeometry } from '../lampPass';
import { makeRng, SPINE_KINDS } from '../textures';
import { shaftVolume, makeShaftMaterial, spineAt, titleAt } from '../effects';
import { buildPortal, PORTAL } from '../portal';
import { SPILL as DOOR_SPILL, MOON_BEYOND, SIDE_LAMP as DOOR_SIDE_LAMP, tentBook, splayedBook, CANDLES as DOOR_CANDLES, candleWax, LAMP_Y as DOOR_LAMP_Y, SHAFT_K } from '../doorProps';
import { rubbleLayout, fallenBlock, fragment } from '../rubble';
import { stoneCaster, growIvy, hangIvy } from '../ivy';
import { FLORA, roomSheets, caseFaces, strandFeeder, joinStrand, wallEnds, wallRunner } from '../doorFlora';
import { DOOR_CRACKS, DOOR_FALLEN, deg } from '../build/common';
import { GRAVEL_TOP, gardenness } from '../gardenPlan';

export function buildDoor(ctx) {
  const { dir, add, dist, A, cellC } = ctx;
  // V — the Door: shelves on five walls; on the sixth, a way out.
  const DOOR = cellC(4, -4);
  const GATE = add(DOOR, dir(330), A);
  if (dist(GATE, DOOR_CRACKS.origin) > 1e-6) console.warn("[cracks] painted round a breach that is not the Door's:", DOOR_CRACKS.origin, GATE);
  return { DOOR, GATE };
}

export function* buildArch(ctx) {
  const { light, rnd, rr, pick, dir, add, rot3, keep, bookRowsSet, Std, M, root, placed,
    chunkGeo, rockGeo, instances, decal, haloMaterial, halos, lightWishes, point, R, A,
    edgeFrame, hallMid, LB, doorIvy, doorRubble, petals, hangs, ivyLeaves, ivyWood,
    IVY_GREEN, IVY_YOUNG, posts, links, balusters, shelved, lodRows, wallRoom, books, lampCores,
    lampShells, globes, deadGlobes, rubble, trialPanes, trialFlames, trialWax, candleLights,
    BOOKS, LAID, alongWall, lamp, DOOR, GATE } = ctx;
  // ── The arch ──────────────────────────────────────────────────────────────
  // What stands in the sixth wall (portal.js). It is built in a frame of its
  // own — x along the wall (dir 60) from the middle of the breach, y up, z
  // into the room (dir 150) — and set in the wall here.
  const PORTAL_AXIS = add(GATE, dir(60), 1.5);
  const portalFrame = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(dir(60)[0], 0, dir(60)[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir(150)[0], 0, dir(150)[1]),
  ).setPosition(PORTAL_AXIS[0], 0, PORTAL_AXIS[1]);
  // a point in the arch's frame, on the ground
  const inPortal = (x, z) => add(add(PORTAL_AXIS, dir(60), x), dir(150), z);
  const portalStone = [];
  {
    const into = { carve: LB.portalCarve, dressed: LB.portalDressed, mass: LB.mass, marble: LB.marble, bronze: LB.bronze };
    for (const [name, list] of Object.entries(buildPortal({ light }))) {
      for (const g of list) {
        // (the stone the ivy grows on, in the arch's own frame — ivy.js)
        portalStone.push(g.clone());
        into[name].add(g.applyMatrix4(portalFrame));
      }
    }
  }
  yield;
  {
    const e = edgeFrame(DOOR, 5);
    // Boulders at the foot of the wall on the garden side, either side of the
    // arch. (The draws are those of the fallen wall that once lay in the
    // breach: the world's stream's, so they are all still made, and only where
    // the stone is laid differs.)
    for (let s = 0; s < 60; s++) {
      const out = rr(-6, 40), along = rr(-46, 46);
      if (Math.abs(along) < 13) continue; // a way through, for the walk
      const off = 27 + ((out + 6) / 46) * 10, sideways = Math.sign(along) * (34 + ((Math.abs(along) - 13) / 33) * 15);
      const p = add(add(GATE, e.n, off), e.t, sideways);
      rubble.push({ p: [p[0], rr(5, 12), p[1]], rot: rot3(), s: Array(3).fill(rr(2.5, 9)), color: pick(['#8a8176', '#6f675c', '#9c948a']) });
    }
    // What fell when the stone that walled the arch up gave way ("between two
    // shelves the stone gives way"), lying where it came down. Without it the
    // Door's pavement is forty per cent of the frame with nothing whatever on
    // it.
    //
    // The draws of a hundred-odd chips of one size spread evenly over the lot —
    // confetti — are still made (the garden is laid out from the same stream)
    // and thrown away; what the floor gets instead is below, from a stream of
    // its own.
    const ghostRubble = [];
    for (let k = 0; k < (light ? 40 : 110); k++) {
      // Nothing big close to where the reader stands: a chunk of wall at eye
      // distance reads as a boulder in the room rather than as debris.
      const into = Math.sqrt(rnd()) * 88;
      const p = add(add(GATE, e.n, -into), e.t, rr(-60, 60) * (0.35 + into / 150));
      const grit = rnd() < 0.88 || into > 55;
      ghostRubble.push({
        p: [p[0], 6 + (grit ? rr(0.1, 0.45) : rr(0.9, 2.2)), p[1]],
        rot: rot3(),
        s: grit ? [rr(0.5, 1.7), rr(0.22, 0.6), rr(0.5, 1.7)] : [rr(2.4, 5), rr(1.1, 2.4), rr(2.4, 5)],
        color: pick(['#a49a8c', '#8a8176', '#b0a698', '#79716a']),
      });
    }
    // What a wall leaves when it comes down: a few of its own blocks out in
    // front of the arch, tilted where they fell; a fan of smaller stone thrown
    // out into the room from the threshold, thinning and getting smaller as it
    // goes; grit, and a tongue of pale dust. Big pieces keep off the way
    // through, and nothing lies on the arch's own footings.
    {
      const at = (along, into) => add(add(GATE, e.n, -into), e.t, along);
      {
        // (rubble.js: the same layout the crack painter shaded the floor round)
        const { blocks, stones } = rubbleLayout(DOOR_FALLEN, DOOR_CRACKS);
        // (sharp where they broke fresh: doorProps.js)
        for (const k of blocks) LB.rubbleBlocks.add(fallenBlock(k, { floor: 6, light, crisp: true }));
        // (what broke off a block is as solid as the block; the stones darken
        // where a block stands over them)
        for (const s of stones) (s.felt ? LB.rubbleBlocks : s.size >= 1.3 ? LB.rubbleBig : LB.rubble).add(fragment(s, { floor: 6, near: blocks }));
      }
      // the dust: pale, heaviest at the breach, a tongue into the room
      const fan = new THREE.PlaneGeometry(1, 1, 8, 12).rotateX(-Math.PI / 2);
      const fp = fan.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const u = fp.getX(i), v = fp.getZ(i) + 0.5;           // v: 0 at the breach, 1 in the room
        const q = at(1.5 + u * (22 + v * 66), v * 62 - 2);
        fp.setXYZ(i, q[0], 6.13, q[1]);
      }
      fan.computeVertexNormals();
      LB.dustFan.add(fan);
      // Books that came down with it, off the shelves the stone carried: lying
      // where they fell among the rubble, one of them open on its face. (Off
      // the way through, where the walk goes.)
      const fallen = [[-27, 24, 0.4, 0.12], [-19, 33, 2.1, -0.08], [-33, 40, 1.2, 0.2], [21, 27, 2.6, -0.15], [30, 36, 0.9, 0.1]];
      // (folios, 41-47 cm, not giants of 90 cm-1.2 m)
      const fk = 0.46;
      fallen.forEach(([along, into, yaw, tilt], i) => {
        const q = at(along, into), th = (1.7 + (i % 3) * 0.4) * (0.36);
        const vellum = i === 2;
        books.push({ p: [q[0], 6 + th / 2 + Math.abs(tilt) * 2 * fk, q[1]], rot: [tilt, yaw, -tilt * 0.6], s: [(9.5 + i * 0.7) * fk, th, 7 * fk], color: vellum ? '#a59576' : ['#5a2923', '#6f4c31', '#221d19', '#7d5738', '#8e8062'][i], k: 0.9, spine: LAID + (vellum ? SPINE_KINDS.vellum[0] + 3 : SPINE_KINDS.label[0] + i * 2) });
      });
      {
        const q = at(-11, 46);
        for (const [g, k] of splayedBook()) LB[k].add(g.rotateY(2.45).translate(q[0], 6.02, q[1]));
        const tent = tentBook(), tq = at(27, 51), yaw = 0.95;
        for (const [g, k] of tent.parts) LB[k].add(g.rotateY(yaw).translate(tq[0], 6.02, tq[1]));
        // (its spine: a book's own, lettered, laid along the ridge and turned up)
        books.push({ p: [tq[0], 6.02 + tent.spine[0], tq[1]], rot: [-Math.PI / 2, 0, yaw], s: [tent.spine[1], tent.spine[2], 0.3], color: '#5a2923', k: 1, spine: SPINE_KINDS.label[0] + 5 });
      }
      // and the garden coming in after it: wisteria petals blown a little way
      // into the room along the green light, thinning as they go
      const pr = makeRng(5150);
      for (let k = 0; k < (light ? 30 : 80); k++) {
        const into = -2 + 50 * pr() ** 1.8, along = 1.5 + (pr() - 0.5) * (14 + into * 0.9);
        const q = at(along, into);
        petals.push({ p: [q[0], 6.16 + pr() * 0.05, q[1]], rot: [(pr() - 0.5) * 0.3, pr() * 6.28, (pr() - 0.5) * 0.3], s: Array(3).fill(0.7 + pr() * 0.6), color: ['#d8cbe8', '#c3b2da', '#e6dcef'][Math.floor(pr() * 3)] });
      }
    }
    // and the cracks it ran through the pavement, spreading from the gap. They
    // are painted into the floor itself (cracks.js, read by paveShade),
    // breaking slab by slab, from the breach and from under the blocks that
    // fell. The cracks once laid here as strips are still drawn: the draws
    // are the world's stream's, and the garden is laid out from the stream
    // after them.
    for (let k = 0; k < 9; k++) {
      rr(4, 14); rr(-58, 58);
      for (let seg = 0; seg < 5 + Math.floor(rnd() * 4); seg++) { rr(7, 22); rr(0.5, 1.5); rr(-34, 34); }
    }
    // ── One volume was a gate ─────────────────────────────────────────────
    // The title of the room: the way out of the Library is a bookcase. It hung
    // at the garden end of the arch's passage, closing it to twice a reader's
    // height, and it has swung back into the passage and stands folded against
    // its left side, its shelves still full and turned to whoever goes through.
    // (Anywhere out in the opening, or at the arch's full height, from the room
    // it would stand across the arch as a dark post.) It stands clear of the
    // plinth and the impost that run along the reveal.
    {
      // The leaf it replaces drew its books from the world's stream, and the
      // garden is laid out from the stream after it: the same draws, thrown away.
      for (let shelf = 0; shelf < 3; shelf++) {
        for (let u = 2.6; u < 21 - 4;) { const w = rr(2.2, 4.6); rr(9.5, 12.6); rr(6, 7.4); pick(BOOKS); rr(0.75, 1.1); u += w + rr(0.2, 0.9); }
      }
      rr(0, 6.28); pick(BOOKS);

      const { HW: hw } = PORTAL;
      const lr = makeRng(4808), within = (lo, hi) => lo + (hi - lo) * lr();
      // in the arch's frame: its back at x0, its books facing +x at x1; it runs
      // from z0 (the garden end, where it hangs) toward the room
      const x0 = -hw + 1.9, T = 2.8, x1 = x0 + T, z0 = -PORTAL.WALL + 4.8, L = 12.2, z1 = z0 + L;
      const Y0 = 6.35, H = 36;
      const spot3 = (x, y, z) => { const q = inPortal(x, z); return [q[0], y, q[1]]; };
      const piece = (xa, xb, ya, yb, za, zb, batch = LB.shelf) => batch.add(new THREE.BoxGeometry(xb - xa, yb - ya, zb - za).translate((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2).applyMatrix4(portalFrame));
      piece(x0, x0 + 0.8, Y0, H, z0, z1);                       // the back
      piece(x0, x1 + 0.3, Y0, H, z0, z0 + 1.2);                 // a stile at each end
      piece(x0, x1 + 0.3, Y0, H, z1 - 1.2, z1);
      piece(x0, x1 + 0.45, H - 1.6, H, z0 - 0.15, z1 + 0.15);   // the rail over the head, moulded
      piece(x0, x1 + 0.7, H - 2.2, H - 1.6, z0 + 1.2, z1 - 1.2);
      piece(x0, x1 + 0.3, Y0, Y0 + 1.8, z0 + 1.2, z1 - 1.2);    // the plinth
      // (six shelves of quartos)
      const shelves = Array.from({ length: 6 }, (_, j) => Y0 + 1.8 + (j * (H - 2.2 - Y0 - 1.8)) / 6);
      const spines = 30 * deg;   // a book's spine faces +x in this frame
      shelves.forEach((y, i) => {
        if (i) piece(x0 + 0.8, x1, y - (0.45), y, z0 + 1.2, z1 - 1.2);
        const cap = (i < shelves.length - 1 ? shelves[i + 1] - 0.45 : H - 2.2) - 0.3;
        let z = z0 + 1.35, run = 0, col = '#5f422c', hh0 = 0;
        while (z < z1 - 1.6) {
          if (run <= 0) { run = 1 + Math.floor(lr() * 5); col = ['#6f4c31', '#5a2923', '#221d19', '#8e8062', '#7d5738', '#4f2420', '#6f5f36', '#523a28'][Math.floor(lr() * 8)]; hh0 = within(2.9, 3.4); }
          const w = within(0.4, 0.75);
          if (z + w > z1 - 1.3) break;
          const hh = Math.min(hh0 * within(0.97, 1.03), cap - y), d = within(1.8, 2.1);
          books.push({ p: spot3(x1 - d / 2 - 0.15, y + hh / 2, z + w / 2), rot: [0, spines, 0], s: [w, hh, d], color: col, k: within(0.8, 1.05) });
          z += w + (within(0.006, 0.04));
          run--;
        }
      });
      // pivots at the garden end, where it hangs, and a bronze ring to pull it by
      for (const y of [11, 23, 33]) LB.bronze.add(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 12).translate(x0 + 0.4, y, z0 - 0.35).applyMatrix4(portalFrame));
      LB.bronze.add(new THREE.TorusGeometry(1.5, 0.24, 8, 20).rotateY(Math.PI / 2).translate(x1 + 0.5, 26, z1 - 2.6).applyMatrix4(portalFrame));
      LB.bronze.add(new THREE.CylinderGeometry(0.62, 0.62, 0.7, 12).rotateZ(Math.PI / 2).translate(x1 + 0.4, 27.3, z1 - 2.6).applyMatrix4(portalFrame));
      // and the one that opened it, on the floor where it fell
      const drop = inPortal(-4, 20);
      books.push({ p: [drop[0], 6.38, drop[1]], rot: [0, 2.1, 1.57], s: [0.75, 4.4, 3.2], color: '#5a2923', k: 1.05 });
    }
    // ── The garden comes in ──────────────────────────────────────────────
    // Ivy up the garden face of the arch. The only green in the Library, and
    // it keeps to the walls: none on the floor.
    {
      const gr = makeRng(5505), within = (a, b) => a + (b - a) * gr();
      // (the draws of the leaves that once lay blown in across the floor: the
      // curtain below is laid from the same stream after them)
      for (let k = 0; k < 42 * 8; k++) gr();
      for (let k = 0; k < (light ? 20 : 38); k++) {
        gr(); within(13.5, 31); gr();
        within(-0.5, 0.5); within(7, 12); within(5, 8); gr();
      }
      // And the curtain the plates hang in that doorway: green trailing down
      // from the vault at the garden end of the passage, wisteria in it, lit
      // by the moon's light coming through. Hung high — the lowest tip is
      // twice a head's height over the way through.
      for (let z = -PORTAL.WALL + 5; z < -PORTAL.WALL + 11.5; z += within(1.3, 2)) {
        for (let x = -PORTAL.HW + 0.8 + gr() * 1.2; x < PORTAL.HW - 0.8; x += within(1.1, 2)) {
          const top = PORTAL.soffitAt(x) - 0.4, wisteria = gr() < 0.3;
          const len = Math.min(top - 38 - gr() * 3, within(8, 17) + (1 - Math.abs(x) / PORTAL.HW) * within(0, 8));
          const q = inPortal(x + within(-0.3, 0.3), z + within(-0.4, 0.4));
          const yaw = gr() * Math.PI, kind = wisteria ? Math.floor(gr() * 2) : 2 + Math.floor(gr() * 2), wide = within(2.6, 3.8);
          if (len < 4) continue;
          hangs.push({ p: [q[0], top, q[1]], rot: [0, yaw, 0], s: [wide, len, 1], kind, color: wisteria ? '#e6dcec' : '#c8d6c4', k: within(0.8, 1.05) });
        }
      }
      for (let k = 0; k < (light ? 4 : 9); k++) {
        gr(); gr(); within(-0.5, 0.5); within(6, 10); within(4.5, 7);
      }
      // The ivy itself (ivy.js), grown out of the ground at the foot of the
      // wall: up the garden face either side of the arch — highest on the
      // left, where it has been longest and reaches round the ring of
      // voussoirs and hangs from it — and in along the passage's walls as far
      // as the garden's light goes. In the arch's frame, cast onto its stone.
      {
        yield;
        const W = PORTAL.WALL, HW = PORTAL.HW, F = PORTAL.FLOOR;
        // (the wall's garden face beyond the arch's own masonry, either side)
        const beyond = (x0, x1) => new THREE.PlaneGeometry(x1 - x0, 125).translate((x0 + x1) / 2, 62.5, -W);
        const caster = stoneCaster([...portalStone, beyond(-80, -24), beyond(24, 80)]);
        // (the room's side of it, and the cases' ends, for the garden coming in: doorFlora.js)
        const floraCaster = FLORA ? stoneCaster([...portalStone, ...caseFaces()]) : null;
        portalStone.forEach((g) => g.dispose());
        const ir = makeRng(5521), R = (a, b) => a + (b - a) * ir();
        const opening = (u, v, a) => Math.abs(u) < HW + a && v < PORTAL.soffitAt(u, a) + 0.4;
        const face = {
          ray: (u, v, o, d) => { o.set(u, v, -W - 12); d.set(0, 0, 1); }, far: 30,
          light: new THREE.Vector3(0, 1, -0.5).normalize(), max: light ? 1400 : 3400,
          allow: (u, v) => Math.abs(u) < 42 && v > F - 1 && !opening(u, v, 1.4)
            && v < (u < 0 ? 82 - Math.max(0, -u - 22) * 1.3 : 58 - Math.max(0, u - 22) * 1.3),
          seeds: [
            ...[-15.6, -19.5, -24, -29, -34.5].map((u) => [u + R(-0.8, 0.8), F + 0.2, R(-0.3, 0.3), R(62, 88), R(0.75, 1)]),
            ...[16, 20.5, 27, 33].map((u) => [u + R(-0.8, 0.8), F + 0.2, R(-0.3, 0.3), R(38, 58), R(0.6, 0.85)]),
          ],
        };
        const reveal = (sd) => ({
          ray: (u, v, o, d) => { o.set(sd * (HW - 6), v, u); d.set(sd, 0, 0); }, far: 20, drift: 0.3, scale: 0.9,
          light: new THREE.Vector3(0, 0.7, -1).normalize(), max: light ? 200 : 650,
          allow: (u, v) => u > -W - 0.2 && u < -W + (FLORA?.reveal ?? 15) && v > F - 0.5 && v < 40 - (u + W) * (FLORA ? 0.9 : 1.6),
          seeds: [[-W + 0.8, F + 0.6, 0.2, R(28, 36), 0.7], [-W + 3, F + 0.6, 0.4, R(22, 30), 0.55], [-W + 6.5, F + 0.6, 0.3, R(14, 22), 0.4], [-W + 9.5, F + 0.6, 0.5, R(8, 14), 0.3]],
        });
        const grown = growIvy(caster, [face, reveal(-1), reveal(1)], ir);
        // and strands hanging from the arch's edge on the left, where the
        // stems that went over the ring come down; none lower than twice a
        // head's height over the way through. (Each from the end of its stem,
        // round the ring from the ivy below: doorFlora.js strandFeeder.)
        const sr = makeRng(5651);
        for (const u of [-16.5, -14.5, -12, -9.5, -6.5, 11.5, 15]) {
          if (u > 0 && ir() < 0.4) continue;
          const top = PORTAL.soffitAt(u, 3.6) - 0.3, len = Math.min(R(5, 14), top - 40);
          if (len < 3) continue;
          const feed = strandFeeder(caster, u, 3.6, sr, { from: u < 0 ? 60 + sr() * 12 : 48 + sr() * 6 });
          const end = feed ? feed.nodes[feed.nodes.length - 1].p.clone().add(new THREE.Vector3(0, -0.15, -0.3)) : new THREE.Vector3(u, top, -W - 0.4);
          let hung = hangIvy(end, new THREE.Vector3(0, 0, -1), len, ir);
          if (feed) hung = joinStrand(feed, hung);
          grown.stems.push(hung.nodes);
          grown.leaves.push(...hung.leaves);
        }
        caster.dispose();
        // The garden coming on into the room (doorFlora.js, ?wflora=a|b|c):
        // up the room's face of the arch and the cases' ends, and hanging
        // from the arch.
        if (FLORA) {
          const fr = makeRng(5611), FR = (a, b) => a + (b - a) * fr();
          // (all of it from the garden: the strands along the soffit from the
          // garden face, the room face's stems along the passage's walls out
          // of the ground beyond it — doorFlora.js, "Rooted in the garden";
          // their own stream. Nothing on the floor.)
          const gr = makeRng(5661), ends = wallEnds(FLORA, gr);
          const more = growIvy(floraCaster, roomSheets(FLORA, FR, FLORA.face ? ends : null), fr);
          for (const end of ends) {
            const stem = FLORA.face ? more.stems.find((st) => st[0].u === end.u && st[0].v === end.v) : null;
            const run = wallRunner(floraCaster, end, stem ? stem[0].r : 0.08, gr);
            if (!run) continue;
            if (stem) stem.unshift(...run.nodes);
            else more.stems.push(run.nodes);
            more.stems.push(...run.shoots);
            more.leaves.push(...run.leaves);
          }
          grown.stems.push(...more.stems);
          grown.leaves.push(...more.leaves);
          for (let k = 0; k < FLORA.hang; k++) {
            const u = (k % 2 ? 1 : -1) * FR(1, HW - 0.8), top = PORTAL.soffitAt(u, 0.6) - 0.3, len = Math.min(FR(4, 12), top - 40);
            if (len < 3) continue;
            const feed = strandFeeder(floraCaster, u, 0, gr, { into: PORTAL.Z0 + 0.6, from: u < 0 ? 60 + gr() * 12 : 48 + gr() * 6 });
            const end = feed ? feed.nodes[feed.nodes.length - 1].p.clone().add(new THREE.Vector3(0, -0.15, 0)) : new THREE.Vector3(u, top, PORTAL.Z0 + 0.6);
            let hung = hangIvy(end, new THREE.Vector3(0, 0, 1), len, fr);
            if (feed) hung = joinStrand(feed, hung);
            grown.stems.push(hung.nodes);
            grown.leaves.push(...hung.leaves);
          }
          floraCaster.dispose();
        }
        const qf = new THREE.Quaternion().setFromRotationMatrix(portalFrame), eu = new THREE.Euler();
        const stemTint = new THREE.Color('#857563');
        for (const stem of grown.stems) {
          ivyWood.tube(stem.map((nd) => ({ p: nd.p.clone().applyMatrix4(portalFrame), r: nd.r })), stem[0].r > 0.14 ? 6 : 4, stemTint);
        }
        for (const lf of grown.leaves) {
          const p = lf.p.clone().applyMatrix4(portalFrame);
          eu.setFromQuaternion(qf.clone().multiply(lf.q));
          const old = ir() < 0.04;
          const color = old ? '#4a3d24' : lf.young ? IVY_YOUNG[Math.floor(ir() * IVY_YOUNG.length)] : IVY_GREEN[Math.floor(ir() * IVY_GREEN.length)];
          ivyLeaves.push({ p: [p.x, p.y, p.z], rot: [eu.x, eu.y, eu.z], s: [lf.s, lf.s, lf.s], color, k: 1.75 * R(0.85, 1.15) });
        }
      }
    }
    yield;
    // ── The green moon, through the jamb ──────────────────────────────────
    // "Hedges breathe under a green moon": the light off the garden falls
    // through the breach and lands on the pavement, which is the only thing
    // that ever happens on forty per cent of this frame.
    {
      const mid = add(DOOR, dir(330), A);
      const top = new THREE.Vector3(mid[0] + dir(330)[0] * 16, 82, mid[1] + dir(330)[1] * 16);
      const foot = new THREE.Vector3(mid[0] + dir(150)[0] * 52, 6, mid[1] + dir(150)[1] * 52);
      const axis = top.clone().sub(foot);
      const len = axis.length();
      const g = new THREE.CylinderGeometry(1, 1.5, len, 26, 1, true);
      g.scale(13, 1, 5.5);
      const yv = axis.clone().normalize();
      const xv = new THREE.Vector3(dir(60)[0], 0, dir(60)[1]).projectOnPlane(yv).normalize();
      g.applyMatrix4(new THREE.Matrix4().makeBasis(xv, yv, xv.clone().cross(yv).normalize()));
      g.translate(...top.clone().add(foot).multiplyScalar(0.5).toArray());
      const shaft = new THREE.Mesh(keep(shaftVolume(g)), keep(makeShaftMaterial('#a6edc6', 0.12 * (SHAFT_K))));
      shaft.renderOrder = 2;
      root.add(shaft);
    }
    // One lamp behind the reader and one in view across the gallery: the green
    // belongs BEYOND the jamb, and with the gate's light at 8000 it owned the
    // whole room and the Library stopped being warm.
    // A globe on its stand beside the reading table: furniture that is not a
    // shelf. (Put near the reader as a dark shape at the edge of the frame it
    // sat in the corner under the room's caption, pale and enormous.)
    {
      const at = alongWall(DOOR, 3).on(11, 25);
      const legs = [0, 120, 240].map((a) => {
        const foot = add([0, 0], dir(a), 3.6);
        const v0 = new THREE.Vector3(foot[0], 6, foot[1]), v1 = new THREE.Vector3(0, 11.5, 0);
        const g = new THREE.CylinderGeometry(0.28, 0.4, v0.distanceTo(v1), 8);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v1.clone().sub(v0).normalize()));
        return g.translate((v0.x + v1.x) / 2, (v0.y + v1.y) / 2, (v0.z + v1.z) / 2);
      });
      legs.push(new THREE.CylinderGeometry(0.35, 0.45, 2.4, 10).translate(0, 12.6, 0));
      legs.push(new THREE.TorusGeometry(4.35, 0.32, 6, 40).rotateX(Math.PI / 2).translate(0, 16.2, 0));
      for (const a of [0, 120, 240]) legs.push(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 6).translate(Math.cos(a * deg) * 4.35, 14.5, Math.sin(a * deg) * 4.35));
      LB.shelf.add(placed(mergeGeometries(legs), at, 0, 0.4));
      legs.forEach((g) => g.dispose());
      LB.bronze.add(placed(new THREE.TorusGeometry(3.95, 0.16, 6, 40).rotateZ(23 * deg), at, 16.2, 0.4));
      const globe = new THREE.Mesh(keep(new THREE.SphereGeometry(3.6, 36, 24)), M.globeMap);
      globe.rotation.set(0, 1.1, 23 * deg);
      globe.position.set(at[0], 16.2, at[1]);
      globe.castShadow = true;
      root.add(globe);
    }
    // (its pool on the floor at 6.2: at 6.6 it drew a pale
    // sock round the foot of the reading corner's legs)
    lamp(add(DOOR, dir(214), 46), { light: 6500, priority: 3, strength: 1.2, pool: DOOR_SPILL.warm.near, poolSize: 140, poolY: 6.2, haze: 0.18, beam: false });
    // ── Candles at the foot of the arch ──────────────────────────────────
    // A bronze candelabrum either side, standing before the piers, as every
    // plate of this room has them: the carving is lit from below, warm, the
    // way the stone was meant to be seen, and the green comes through between.
    // (Flames only — a halo would draw on the world's stream.)
    for (const side of [-1, 1]) {
      const at = inPortal(side * 29.5, 29);
      const put = (g) => LB.bronze.add(g.translate(at[0], 0, at[1]));
      const L = (pts, seg = 18) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
      put(L([[0, 6], [3.1, 6], [3.1, 6.45], [2.5, 6.9], [1.5, 7.4], [1.0, 8.2], [0.72, 9.4], [0, 9.4]]));
      // (the stem runs on past the arms' knop up into the centre candle's
      // pan: it stopped at the knop, and the middle candle hung in the air)
      put(L([[0, 9.2], [0.5, 9.2], [0.42, 12.4], [0.95, 13.1], [0.42, 13.8], [0.38, 18.2], [0.85, 18.9], [0.4, 19.6], [0.36, 23.6], [1.05, 24.3], [0.5, 24.9], [0.34, 25.4], [0.32, 26.7], [0.62, 27.15], [0.55, 27.5], [0, 27.5]], 14));
      const flames = [[0, 27.8, 0, 3.4]];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4, c = [Math.cos(a) * 3.3, Math.sin(a) * 3.3];
        const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 23.8, 0), new THREE.Vector3(c[0] * 0.45, 22.8, c[1] * 0.45), new THREE.Vector3(c[0] * 0.9, 23.4, c[1] * 0.9), new THREE.Vector3(c[0], 25.2, c[1])]);
        put(new THREE.TubeGeometry(arm, 12, 0.24, 6, false));
        flames.push([c[0], 25.6, c[1], 2.2 + ((k * 7) % 3) * 0.55]);
      }
      // (Burnt down, each as far as it has, its crown melted and its wax run
      // down it and onto the pan, a glow round each flame — its own sprite:
      // `halo()` draws on the world's stream — and the flames moving a little:
      // doorProps.js.)
      const cr = makeRng(side < 0 ? 4411 : 4412);
      flames.forEach(([x, y, z, h0], fi) => {
        put(L([[0, y - 0.4], [0.95, y - 0.35], [1.0, y - 0.15], [0.45, y], [0, y]], 14).translate(x, 0, z));
        const h = h0 * DOOR_CANDLES.burn[side < 0 ? 0 : 1][fi];
        // (`top`: where the wick stands, down in the well of a melted crown)
        let top = y + h;
        {
          const c = candleWax(h, 0.35, 7700 + (side < 0 ? 0 : 10) + fi);
          top = y + c.wick;
          LB.wax.add(c.geo.rotateY(cr() * 6.28).translate(at[0] + x, y, at[1] + z));
        }
        
        // a flame, not an egg of light; a wick; the wax lit round it (lampPass.js)
        trialFlames.push({ p: [at[0] + x, top + (0.78), at[1] + z], s: [0.32, 0.66, 0.32], color: '#ffffff', k: 1.45 });
        trialWax.push(waxGlowGeometry(at[0] + x, top + 0.02, at[1] + z, 0.36));
        LB.iron.add(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 4).translate(at[0] + x, top + 0.2, at[1] + z));
        {
          const { size, opacity } = DOOR_CANDLES.halo;
          const glow = new THREE.Sprite(haloMaterial('#ffb45e', opacity));
          glow.scale.set(size, size, 1);
          glow.position.set(at[0] + x, top + 0.85, at[1] + z);
          glow.renderOrder = 4;
          root.add(glow);
          halos.push({ mat: glow.material, base: opacity, phase: cr() * 100, sprite: glow, size, lamp: false, seen: 1, seenTo: 1 });
        }
      });
      // (theirs to keep from anywhere in the room: from the stand, further back
      // — doorProps.js — two lamps out in the Vertigo would be nearer than
      // these, and the arch would stand unlit)
      point(at, 27, '#ffb466', 2600, 5, null, [DOOR[0], DOOR[1], R]);
      candleLights.push({ wish: lightWishes.at(-1), base: lightWishes.at(-1).intensity, phase: side < 0 ? 0.7 : 3.9 });
    }
    // Hung to the left of the arch rather than in front of it, across the
    // springing, and high, level with the head of the hood: from there its
    // light rakes across the orders and the gable, and every roll, hollow and
    // foil reads by it. (Hung at the springing it lights the jambs, and the
    // carving over the arch is one flat tone.) (no beam: its cone is a hard
    // pale wedge down the cases to the left of the arch, and the breach is the
    // one shaft of light this room wants) (low enough that the frame's top edge
    // does not cut its globe in half — doorProps.js) (a small globe burning
    // low, so the doorway and not the lamp is what the eye goes to —
    // doorProps.js)
    lamp(inPortal(-44, 38), {
      y: DOOR_LAMP_Y, light: 5200, priority: 4, poolSize: 150, beam: false,
      pool: DOOR_SPILL.warm.side,
      ...(DOOR_SIDE_LAMP),
    });
    // The garden's light: a lamp outside the arch and its pool on the floor, a
    // tongue in the passage and a slab beyond (doorProps.js: a wide pool
    // laid into the room, and a lamp that no wall stops hung close outside,
    // turn the whole pavement olive).
    
    point(add(GATE, e.n, DOOR_SPILL.lamp.out), 40, '#8ff0d4', DOOR_SPILL.lamp.power, 9);
    for (const [into, wide, o] of DOOR_SPILL.pools) decal(add(add(GATE, e.n, -into), e.t, 1.5), wide, wide, '#7ee8c8', o);
    // and beyond the pergola, the moon on the gravel (doorProps.js), for as
    // long as the eye is still among the walls
    for (const [x, z, across, along, o] of MOON_BEYOND.pools) {
      const m = decal([x, z], across, along, MOON_BEYOND.color, o, GRAVEL_TOP + MOON_BEYOND.lift);
      m.onBeforeRender = (r, s, cam) => {
        m.material.opacity = o * (1 - gardenness(cam.position.x, cam.position.z)) * (cam.position.y < 90 ? 1 : 0);
      };
    }
  }
  const ENTRANCE = hallMid(0, 0, 2);

  const bookAttrs = { aSpine: (it) => it.spine ?? spineAt(it.p), aTitle: (it) => it.title ?? titleAt(it.p), aDust: (it) => it.dust ?? 0 };
  yield;
  instances(new THREE.BoxGeometry(1, 1, 1), M.books, books, { chunked: true, attrs: bookAttrs });
  yield;
  // A shelved book shows its spine, its head and its sides, never the foot it
  // stands on or the fore-edge against the case's back: its box without
  // those two faces (BoxGeometry's -y and -z), a third less to draw of each
  // of tens of thousands.
  const shelvedBox = (() => {
    const g = new THREE.BoxGeometry(1, 1, 1), idx = g.index.array, keepFaces = [0, 1, 2, 4];
    g.setIndex(keepFaces.flatMap((f) => Array.from(idx.slice(f * 6, f * 6 + 6))));
    g.clearGroups();
    return g;
  })();
  instances(shelvedBox, M.books, shelved, { group: (it) => it.wall, attrs: bookAttrs, name: 'shelvedBooks' });
  // Keep the shelf catalogue in the same order as each wall's instances.
  const shelfItems = new Map();
  for (const book of shelved) {
    if (!shelfItems.has(book.wall)) shelfItems.set(book.wall, []);
    shelfItems.get(book.wall).push(book);
  }
  for (const mesh of root.children) {
    if (mesh.name === 'shelvedBooks') mesh.userData.books = shelfItems.get(mesh.userData.group);
  }
  yield;
  // Each wall's painted copy, a mesh to a wall, to stand in for its boxes
  // when no eye is near: through an arch two galleries off, or from the map,
  // a real book is two or three pixels across and the paint is the same
  // thing at a fraction of the cost. (The Silence's paint greyed as its
  // bindings are.)
  const lodGroups = [];
  {
    const greyRows = Std({ map: bookRowsSet.map, roughness: 0.85 });
    greyRows.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, 0.4) * 0.8;`);
    };
    greyRows.customProgramCacheKey = () => 'babel-rows-grey';
    const byWall = new Map();
    root.children.forEach((o) => { if (o.name === 'shelvedBooks') byWall.set(o.userData.group, o); });
    for (const [wall, geos] of lodRows) {
      const boxes = byWall.get(wall);
      if (!boxes || !geos.length) continue;
      const flat = geos.map((g) => { const f = g.index ? g.toNonIndexed() : g; if (f !== g) g.dispose(); return f; });
      const geo = keep(mergeGeometries(flat, false));
      flat.forEach((g) => g.dispose());
      const room = wallRoom.get(wall);
      const rows = new THREE.Mesh(geo, room === 2 ? greyRows : room === 0 ? M.vestBookRows : M.bookRows);
      rows.name = 'shelvedRows';
      rows.visible = false;
      root.add(rows);
      lodGroups.push({ boxes, rows, c: boxes.boundingSphere.center.clone(), r: boxes.boundingSphere.radius });
      yield;
    }
  }
  instances(new THREE.TorusGeometry(0.72, 0.2, 5, 10), M.iron, links, { cast: false, chunked: true });
  yield;
  instances(new THREE.LatheGeometry([
    [0, 0], [0.95, 0], [0.95, 0.35], [0.5, 0.8], [0.36, 2], [0.78, 3.2], [0.84, 3.7], [0.38, 4.6], [0.42, 5.5], [0.85, 6], [0, 6.2],
  ].map(([x, yy]) => new THREE.Vector2(x, yy)), 10), M.bronze, balusters, { chunked: true });
  yield;
  instances(new THREE.SphereGeometry(1, 16, 12), M.glow, lampCores, { cast: false, receive: false, chunked: true });
  instances(new THREE.SphereGeometry(1, 20, 14), M.glass, lampShells, { cast: false, receive: false, chunked: true });
  instances(new THREE.SphereGeometry(1, 32, 20), M.globe, globes, { cast: false, receive: false, chunked: true });
  // (`aEmber`: what is left burning in a globe that is going out — silenceProps.js)
  instances(new THREE.SphereGeometry(1, 32, 20), M.deadGlass, deadGlobes, { cast: false, chunked: true, attrs: { aEmber: (it) => it.ember ?? 0 } });
  yield;
  // (the lamp pass, lampPass.js)
  instances(lanternPaneGeometry(), M.globe, trialPanes, { cast: false, receive: false, chunked: true, name: 'trial-panes' });
  instances(flameGeometry(), M.lpFlame, trialFlames, { cast: false, receive: false, chunked: true, name: 'trial-flames' });
  if (trialWax.length) {
    const wax = new THREE.Mesh(keep(mergeGeometries(trialWax)), M.lpWax);
    trialWax.forEach((g) => g.dispose());
    wax.name = 'trial-wax';
    wax.renderOrder = 2;
    root.add(wax);
  }
  yield;
  instances(rockGeo(), M.rock, rubble, { chunked: true });
  instances(chunkGeo(), M.moonRock, doorRubble, { chunked: true });
  instances(new THREE.PlaneGeometry(0.9, 0.62).rotateX(-Math.PI / 2), M.petal, petals, { cast: false });
  instances(new THREE.PlaneGeometry(1, 1), M.ivy, doorIvy, { cast: false });
  instances(new THREE.BoxGeometry(1, 1, 1), M.wallTop, posts, { chunked: true });
  return { ENTRANCE, lodGroups };
}
