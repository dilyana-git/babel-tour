// ── A body to walk in ────────────────────────────────────────────────────────
// The reader's own feet, for walking wherever they look rather than along the
// piece's lines (World.jsx's free walk). It is a reader-sized column standing
// on whatever is underneath it: it climbs a stair a tread at a time, slides
// along a wall instead of stopping dead against it, and will not step off a
// ledge, into the pond or over the Vertigo's broken rail. The rail is the one
// way off a ledge, and the piece walks the reader through it itself (the fall).
//
// What it stands on and bumps into is the world as it is drawn: every solid
// mesh buildWorld made, felt through a bounding-volume tree per geometry
// (three-mesh-bvh), so that a stair re-cut, a hedge regrown or a lantern moved
// is walked as it now stands with nothing to keep in step. The trees are built
// in slices while the reader stands (`warm`), nearest first, and any the body
// reaches before then are built on the spot.
//
// The instanced fields that are boxes — the books, the balusters — are felt
// too, each field merged once into one solid of its own the first time the
// body comes near it: a bookcase's lower cupboard is a step's height and deep
// enough to stand on, and with its books unfelt the reader stepped up onto it
// and walked into them. Not felt: the other instanced fields (chain links,
// leaves, petals), the lit air and the glows, the sky, and anything that
// moves (the readers walking the Vestibule's bridge, the koi, the finale's
// figures).
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

// A reader is 18 units tall (a unit is about 9.4 cm): the eye stands 15 over
// the feet, as every stand in buildWorld does.
export const EYE = 15;
// Half a shoulder's width: how close the eye may come to stone.
export const RADIUS = 4;
// The tallest riser in the world is the first step of the Echo's flight (5).
const STEP_UP = 5.5;
// And no deeper down than that in one step: off the crossing's parapet, the
// Silence's landing or the Vertigo's stair is a fall, and nobody walks into one.
const STEP_DOWN = 6;
// The column the walls push against: from just over a step to the top of the
// head. Below it, the floor decides.
const KNEE = STEP_UP + 0.5;
const HEAD = EYE + 2;
// Steeper than this is a wall, not somewhere to stand.
const FLOOR_NORMAL = 0.6;
// ...but a stair's own stone may lean this far and still be stepped on (floorIn)
const LEANING = 0.2;
// Water no deeper than this over something to stand on is not water (floorIn).
const WADE = 0.2;
// A gap no wider than twice this is stepped across (landing).
const CRACK = 0.8;
// A step up taller than any tread (the treads rise 2.1-2.4) has to be onto
// somewhere: floor all round the feet — every 45°, bar the ones behind, where
// the feet came up from — at each of FEET, no more than a riser (TREAD) below
// the step's own top. Two rings, because the well rail is two and a half
// across: from its near edge, a foot put down 2.2 off is still on it. (The
// outer ring was tried at a step down's leeway, to let the reader onto the
// Echo's flight a little further off its middle; it let them up onto a
// bookcase's cupboard too, and the flight is only a stride's hesitation.)
const TALL = 3;
const TREAD = 2.8;
const FEET = [{ r: 2.2, drop: TREAD }, { r: 4.4, drop: TREAD }];
const FOOTPRINT = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => [Math.cos(THREE.MathUtils.degToRad(a)), Math.sin(THREE.MathUtils.degToRad(a))]);
const BEHIND = -0.3;
// No step a reader could not take (see `landing`). A rise taller than any
// tread is only ever onto STAIRS — the Echo's first step is the one there is —
// and never onto a cupboard, a seat, a coping or a rock. And the whole foot
// stands on something: FOOTPRINT's points at FOOT round it, bar the ones
// behind, are never more than a tread above nothing.
// (a flight's nosings are the parapet's stone, `cap` — `capShade` in the Silence;
// and its treads are worn down the middle, `wornStep`, laid over them)
// (`nosing`: the Echo's stair lips, in a paler stone of their own since
// 2026-10-08 — echoFix.js)
const STAIRS = new Set(['step', 'carved', 'cap', 'capShade', 'wornStep', 'nosing', 'pavilionThreshold', 'pavilionStep', 'shoreStep']);
const FOOT = 2.5;
// Nor on a crest — a kerb, a coping, a rail, a beam: somewhere with the
// ground more than RIDGE below the foot on both sides of it at once.
const RIDGE = 1;
// How far around the body anything is considered at all.
const REACH = 40;
// Room to stand (`keepRoom`): what is straight ahead at chest height is not
// walked up to nearer than ROOM_STAND (about 85 cm), easing from twice that.
const CHEST = 12;
export const ROOM_STAND = 9;

const MOVING = /^(bridge-reader|finale|koi)/;
// (and the doorways that open somewhere else: a picture of a room, walked into)
// Wear and inlaid colour sit over existing stone. Their thin overlapping
// triangles must not replace the supporting floor in a foot probe.
// (`moonLand`, the moon laid on the Echo's treads, is a sheet a twentieth over
// them, unnamed until 2026-10-09: once it was carried down to the first riser,
// that step read as a climb onto nothing a stair is, and was refused)
const AIR = new Set(['stars', 'sky', 'dust', 'dustFan', 'shafts', 'doorway', 'wornPath', 'floorBand', 'inlay', 'moonLand']);
// The books on the galleries' shelves, real-sized since 2026-10-06, are never
// reached: the shelves' boards run out to the case's front past them at every
// height the column has, and the case's ledge keeps the feet off. There are
// tens of thousands of them, and merged into a solid on approach they were a
// long stall. (Books lying loose — on the floor, the stair, a table — are felt.)
// Nor the Door's smaller stones (rubble.js), the most of them a hand's width
// and only the smallest on the way through: a foot goes among them, and the body
// riding up and down over each was a walk across a gravel bed. (They were
// never felt before 2026-10-07 either. Its fallen blocks are.)
// (Nor the ivy's stems on the Door's stone, nor the wisteria twined up the
// pergola's posts: ivy.js. The posts they hold to are felt.)
// (Nor the lawn's blades round a lantern, a hand high — lawn.js — nor the
// Pavilion's roof tiles, which nobody reaches: forkProps.js.)
const UNFELT = new Set(['shelvedBooks', 'rubble', 'rubbleBig', 'ivyStems', 'lawnBlades', 'pavRoof']);

const bvhs = new WeakMap();
const treeFor = (geometry) => {
  let bvh = bvhs.get(geometry);
  if (!bvh) {
    // `indirect`: the tree keeps its own order and never touches the drawn
    // geometry's index (a plain build re-sorts it, and adds one where there is
    // none — a change to what the GPU draws, for the sake of a collision).
    bvh = new MeshBVH(geometry, { indirect: true, maxLeafTris: 10, verbose: false });
    bvhs.set(geometry, bvh);
  }
  return bvh;
};

// An instanced field of boxes as one solid in world space (positions only).
const mergeField = (inst) => {
  const g = inst.geometry, pos = g.attributes.position, idx = g.index;
  const n = inst.count, per = pos.count;
  const out = new Float32Array(n * per * 3);
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    inst.getMatrixAt(i, m);
    m.premultiply(inst.matrixWorld);
    for (let k = 0; k < per; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(m);
      out[(i * per + k) * 3] = v.x;
      out[(i * per + k) * 3 + 1] = v.y;
      out[(i * per + k) * 3 + 2] = v.z;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  if (idx) {
    const index = new Uint32Array(n * idx.count);
    for (let i = 0; i < n; i++) for (let k = 0; k < idx.count; k++) index[i * idx.count + k] = idx.getX(k) + i * per;
    geo.setIndex(new THREE.BufferAttribute(index, 1));
  }
  geo.computeBoundingSphere();
  return geo;
};
const BOX_TRIS = 12;
const IDENTITY = new THREE.Matrix4();

export function makeBody(root) {
  const colliders = [];
  const merged = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isBatchedMesh) return;
    if (MOVING.test(o.name) || AIR.has(o.name) || UNFELT.has(o.name)) return;
    const m = o.material;
    if (!m || Array.isArray(m) || !o.geometry?.attributes?.position) return;
    if (m.blending === THREE.AdditiveBlending || m.side === THREE.BackSide) return;
    const water = o.name === 'water';
    if (!water && m.transparent && !m.alphaTest && m.opacity < 0.9) return;
    const c = { water, name: o.name, double: m.side === THREE.DoubleSide, sphere: new THREE.Sphere(), inverse: new THREE.Matrix4() };
    if (o.isInstancedMesh) {
      const g = o.geometry;
      if (m.alphaTest || m.transparent || (g.index ? g.index.count : g.attributes.position.count) / 3 !== BOX_TRIS) return;
      // merged on first approach (`solid`), in world space
      if (!o.boundingSphere) o.computeBoundingSphere();
      Object.assign(c, { field: o, geometry: null, matrix: IDENTITY, bounds: o.boundingSphere.clone().applyMatrix4(o.matrixWorld) });
    } else {
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      Object.assign(c, { geometry: o.geometry, matrix: o.matrixWorld });
    }
    colliders.push(c);
  });
  const solid = (c) => {
    if (!c.geometry) {
      c.geometry = mergeField(c.field);
      merged.push(c.geometry);
    }
    return treeFor(c.geometry);
  };

  // ── Which colliders are near, with their trees ─────────────────────────────
  let near = [];
  const nearFrom = new THREE.Vector3(Infinity, 0, 0);
  const placed = (c) => (c.field ? c.sphere.copy(c.bounds) : c.sphere.copy(c.geometry.boundingSphere).applyMatrix4(c.matrix));
  const gather = (p) => {
    near = [];
    nearFrom.copy(p);
    for (const c of colliders) {
      if (placed(c).center.distanceTo(p) - c.sphere.radius > REACH) continue;
      c.bvh = solid(c);
      c.identity = c.matrix.equals(IDENTITY);
      if (!c.identity) c.inverse.copy(c.matrix).invert();
      near.push(c);
    }
  };
  // Only re-gathered once the body has gone a fair way: everything within
  // REACH of where it was gathered is still in the list for the next stretch.
  const around = (p) => {
    if (nearFrom.distanceToSquared(p) > (REACH / 4) ** 2) gather(p);
    return near;
  };

  // ── Feeling along a ray ────────────────────────────────────────────────────
  const ray = new THREE.Ray(), local = new THREE.Ray(), hitP = new THREE.Vector3(), n = new THREE.Vector3();
  const toC = new THREE.Vector3();
  const found = { d: 0, y: 0, water: false, up: 0, nx: 0, nz: 0, what: '', field: false };
  // The first solid face along `ray`, no nearer than nothing and no further
  // than `far`, among `list` — or null. Only the colliders the ray's segment
  // actually passes near are asked: there are fifty or sixty round the body,
  // and most of them are behind it or overhead.
  const cast = (list, far, water = true) => {
    let hitAny = false, bestD = far;
    for (const c of list) {
      if (!water && c.water) continue;
      toC.subVectors(c.sphere.center, ray.origin);
      const t = THREE.MathUtils.clamp(toC.dot(ray.direction), 0, far);
      if (toC.addScaledVector(ray.direction, -t).lengthSq() > c.sphere.radius ** 2) continue;
      local.copy(ray);
      if (!c.identity) local.applyMatrix4(c.inverse);
      const hit = c.bvh.raycastFirst(local, THREE.DoubleSide, 0, c.identity ? bestD : Infinity);
      if (!hit) continue;
      hitP.copy(hit.point);
      if (!c.identity) hitP.applyMatrix4(c.matrix);
      const d = hitP.distanceTo(ray.origin);
      if (d >= bestD) continue;
      n.copy(hit.face.normal);
      if (!c.identity) n.transformDirection(c.matrix);
      bestD = d;
      hitAny = true;
      Object.assign(found, { d, y: hitP.y, water: c.water, up: c.double ? Math.abs(n.y) : n.y, nx: n.x, nz: n.z, what: c.name, field: !!c.field });
    }
    return hitAny ? found : null;
  };

  // ── What is underfoot ──────────────────────────────────────────────────────
  // Straight down from `top` at (x, z), no further than `depth`: the height of
  // the first thing there to stand on, or null if the first thing is not (the
  // underside of something, a slope, open air, water).
  // (and `floorWhat`: what the last floor found was, by its mesh's name)
  let floorWhat = '';
  // (and `shoulderY`: where the first thing there was a face too steep to stand
  // on — a stone's shoulder, a kerb's chamfer — how high it was met)
  let shoulderY = null;
  // (`solid`: a field of boxes counts as what is there, for round the foot)
  const floorIn = (list, x, top, z, depth, solid = false) => {
    ray.origin.set(x, top, z);
    ray.direction.set(0, -1, 0);
    let hit = cast(list, depth);
    // (a film of water over stone is the stone: the pond's surface lies a
    // finger under the top of the abutment each bridge comes ashore on, and
    // where that stone dips it shows through — a hand's width of "water" that
    // a foot coming off the deck was refused for standing over)
    if (hit && hit.water) {
      const surface = hit.y;
      hit = cast(list, depth, false);
      if (!hit || surface - hit.y > WADE) {
        floorWhat = 'water';
        shoulderY = null;
        return null;
      }
    }
    floorWhat = hit ? hit.what : '';
    shoulderY = hit && !hit.water && !hit.field && hit.up > 0 && hit.up < FLOOR_NORMAL ? hit.y : null;
    // (a step of rough stone has a riser that leans — the bridges' feet on the
    // shore: met from above it is too steep to be a floor, and a reader coming
    // back up off the gravel was held at the foot of it with nothing to say
    // why. On a stair's own stone, a face that leans is part of the step.)
    if (shoulderY !== null && hit.up > LEANING && STAIRS.has(hit.what)) return hit.y;
    // (a field of boxes — the books — is never a floor: a pile of folios by a
    // desk in the Silence was a step off the stair onto the top of it)
    return !hit || hit.water || (hit.field && !solid) || hit.up < FLOOR_NORMAL ? null : hit.y;
  };
  const floorAt = (x, top, z, depth, solid = false) => floorIn(around(toC.set(x, top, z)), x, top, z, depth, solid);
  // The floor where the feet would land, stepping from floor height y in the
  // direction (ux, uz), or null if the step there is not one a reader takes.
  // A tall step up has to be onto somewhere a reader can stand: the low bronze
  // rail round a gallery's well is five units off the floor at its rounded
  // edge — the height of the Echo's first step — and the reader walked up
  // onto it, head-on and sliding along it, and stood on the handrail over the
  // drop. Round the first tread is the stair; round the rail is the well.
  //   And it has to be a step at all (STAIRS): the Pavilion's seat is four
  // units up and wide enough to stand on, and from it the reader went up onto
  // its handrail and round the outside of the balustrade.
  //   `whole`: the whole foot is on it (FOOT). The rails of the zig-zag bridges
  // stand under the column the walls push (KNEE), so a stride carried the
  // reader over one and onto the lip of the deck outside it, half on the
  // bridge and half over the water; and the edge of anything — a landing, a
  // stair, the pond's bank — could be walked with the body half off it.
  const foot = new Array(FOOTPRINT.length).fill(null);
  // (which rule turned the last step down, for DEV's traces)
  let refused = '';
  const no = (why) => { refused = why; return null; };
  const landing = (x, z, y, ux, uz, whole = true) => {
    let f = floorAt(x, y + STEP_UP + 0.5, z, STEP_UP + STEP_DOWN + 1);
    // The shoulder of a low stone, under the foot's middle: a face too steep
    // to be a floor, but of something no more than RIDGE proud of the ground
    // round it (the Fork's rock, with the way laid over it: the feet were
    // turned aside at its flank and went round it in a shimmy). Proud of the
    // ground ROUND it, not of where the feet stand — or a slope of any height
    // could be crept up a finger at a time.
    if (f === null && shoulderY !== null && Math.abs(shoulderY - y) <= RIDGE) {
      const on = shoulderY;
      let low = Infinity;
      for (const [dx, dz] of FOOTPRINT) {
        const g = floorAt(x + dx * FOOT, on + TREAD, z + dz * FOOT, TREAD + RIDGE + 0.5, true);
        if (g !== null) low = Math.min(low, g);
      }
      // (asked again, for what it is)
      floorAt(x, y + STEP_UP + 0.5, z, STEP_UP + STEP_DOWN + 1);
      if (on - low <= RIDGE) f = on;
    }
    // A crack is not a gap: between the two stones a bridge comes ashore on
    // there is a slot a hand wide with the pond in it, and a foot put down
    // across it was a foot over water. With floor a little short of the place
    // and a little past it (CRACK each way, along the step), level with where
    // the feet stand, it is stepped across.
    if (f === null || y - f > STEP_DOWN) {
      const a = floorAt(x - ux * CRACK, y + TREAD, z - uz * CRACK, TREAD + RIDGE), b = floorAt(x + ux * CRACK, y + TREAD, z + uz * CRACK, TREAD + RIDGE);
      if (a !== null && b !== null && Math.abs(a - y) <= RIDGE && Math.abs(b - y) <= RIDGE) f = Math.abs(a - y) < Math.abs(b - y) ? a : b;
      else floorAt(x, y + STEP_UP + 0.5, z, STEP_UP + STEP_DOWN + 1);
    }
    if (f === null || f - y > STEP_UP || y - f > STEP_DOWN) return no(f === null ? 'no floor' : f > y ? 'too high' : 'too deep');
    const what = floorWhat, stair = STAIRS.has(what);
    if (f - y > TREAD && !stair) return no(`climb onto ${what || '?'}`);
    // Stepping up a tall step (a first riser: TALL), the foot is put down on
    // the edge of it, and a point of the ring a little behind it is off the nosing,
    // over the floor the step was taken from — where the other foot still
    // is, and no reason to refuse it. Which of FOOTPRINT's eight points fall
    // "a little behind" depends on the compass, not the stair, so without
    // this the Silence's flights (and the Echo's second one), laid at 240°
    // and 300°, could only be climbed a few degrees askew, never straight
    // on. Only the floor stepped up FROM excuses a point: a drop, a well, or
    // the floor beside a kerb still refuses it. (Not for a rise of a tread or
    // a little more: from a tread up onto a flight's kerb is just over one,
    // and the tread left behind would have excused the reader up onto it.)
    const rise = f - y > TALL;
    const cameFrom = (px, pz, g) => {
      if (g === null || Math.abs(g - y) > RIDGE) g = floorAt(px, f + TREAD, pz, f + TREAD - y + RIDGE);
      return g !== null && Math.abs(g - y) <= RIDGE;
    };
    if (f - y > TALL) {
      for (const { r, drop } of FEET) {
        for (const [dx, dz] of FOOTPRINT) {
          const along = dx * ux + dz * uz;
          if (along < BEHIND) continue;
          const g = floorAt(x + dx * r, f + TREAD, z + dz * r, TREAD + drop);
          if (g === null || f - g > drop) {
            if (along < 0 && cameFrom(x + dx * r, z + dz * r, null)) continue;
            return no('tall step onto nothing');
          }
        }
      }
    }
    if (whole) {
      // (from a step's height above, so the next tread up is under it too)
      for (let i = 0; i < FOOTPRINT.length; i++) {
        const [dx, dz] = FOOTPRINT[i];
        // (the books beside the foot are as solid as the floor: only never under it)
        foot[i] = floorAt(x + dx * FOOT, f + STEP_UP + 0.5, z + dz * FOOT, STEP_UP + 1 + STEP_DOWN, true);
        // (the shoulder of a low stone is not a drop: the Fork's, a hand proud
        // of the gravel with the way laid across it, turned every reader back
        // who walked up to it — "foot over nothing" — because its rounded flank
        // is too steep to be a floor. A face that steep but no more than RIDGE
        // below the floor under the foot's middle is something the foot rests
        // on or against, not a drop — and one that stands above it, like the
        // end of the bridge's deck over its stone step, is for the next rule.)
        if (foot[i] === null && shoulderY !== null && shoulderY >= f - RIDGE) foot[i] = shoulderY;
        const along = dx * ux + dz * uz;
        if (along < BEHIND) continue;
        // (ahead, off a flight's own stone, the ground may fall a whole step:
        // the Echo's first riser, walked down)
        const fall = stair && along > 0.5 ? STEP_DOWN : TREAD;
        // (and a crack under one point of the ring is not a drop either:
        // floor both nearer in and further out along that bearing)
        if (foot[i] === null || f - foot[i] > fall) {
          const a = floorAt(x + dx * (FOOT - CRACK), f + TREAD, z + dz * (FOOT - CRACK), TREAD + fall, true);
          const b = a === null ? null : floorAt(x + dx * (FOOT + CRACK), f + TREAD, z + dz * (FOOT + CRACK), TREAD + fall, true);
          if (a !== null && b !== null) foot[i] = Math.min(a, b);
        }
        if (foot[i] === null || f - foot[i] > fall) {
          if (!(rise && along < 0 && cameFrom(x + dx * FOOT, z + dz * FOOT, foot[i]))) return no(`foot over nothing, bearing ${i * 45}°`);
          continue;
        }
        // Nor more than a tread above it, unless that is the next step of a
        // flight: whatever stands lower than the knee — a seat, a desk, a pile
        // of folios, a bridge's handrail — goes under the column the walls
        // push (KNEE), and the reader stood half inside it, or a stride
        // carried them over it.
        if (foot[i] - f > TREAD && !STAIRS.has(floorWhat)) return no(`foot under ${floorWhat || '?'}, bearing ${i * 45}°`);
      }
      // The Silence's half-flights carry their parapet near the floor as a
      // kerb a hand high, with the string course a little below it outside:
      // there was a tread's drop at most either side of it, and the reader
      // walked up the flight along its edge, on the kerb. On a stair the
      // tread ahead and the one behind are never both below the foot.
      const low = (g) => g === null || f - g > RIDGE;
      for (let i = 0; i < 4; i++) if (low(foot[i]) && low(foot[i + 4])) return no(`on a crest, bearing ${i * 45}°`);
    }
    return f;
  };

  // ── The walls ──────────────────────────────────────────────────────────────
  const segment = new THREE.Line3(), box = new THREE.Box3(), localBox = new THREE.Box3();
  const onTri = new THREE.Vector3(), onSeg = new THREE.Vector3(), away = new THREE.Vector3();
  // Moves the column standing at (p.x, p.z) on floor y out of anything it is
  // inside of, sideways only (up and down are the floor's to say).
  const shoulder = (p, y) => {
    segment.start.set(p.x, y + KNEE + RADIUS, p.z);
    segment.end.set(p.x, Math.max(y + HEAD - RADIUS, y + KNEE + RADIUS), p.z);
    for (const c of around(p)) {
      if (c.water) continue;
      box.makeEmpty().expandByPoint(segment.start).expandByPoint(segment.end).expandByScalar(RADIUS);
      localBox.copy(box);
      if (!c.identity) localBox.applyMatrix4(c.inverse);
      const mw = c.matrix;
      c.bvh.shapecast({
        intersectsBounds: (b) => b.intersectsBox(localBox),
        intersectsTriangle: (tri) => {
          if (!c.identity) {
            tri.a.applyMatrix4(mw);
            tri.b.applyMatrix4(mw);
            tri.c.applyMatrix4(mw);
          }
          const d = tri.closestPointToSegment(segment, onTri, onSeg);
          if (d >= RADIUS) return false;
          away.subVectors(onSeg, onTri).setY(0);
          if (away.lengthSq() < 1e-8) return false;
          away.normalize().multiplyScalar(RADIUS - d);
          segment.start.add(away);
          segment.end.add(away);
          return false;
        },
      });
    }
    p.x = segment.start.x;
    p.z = segment.start.z;
  };

  // ── A step ─────────────────────────────────────────────────────────────────
  const next = new THREE.Vector3(), tryMove = new THREE.Vector3();
  // Sideways tries when the way ahead is a ledge, so a reader walking at the
  // edge of one at an angle slides along it instead of sticking.
  const SLIDES = [0, 35, -35, 70, -70].map((a) => [THREE.MathUtils.degToRad(a), Math.cos(THREE.MathUtils.degToRad(a))]);
  // Moves `feet` (x, z, and y = the floor they stand on) by `move` (sideways
  // only) as far as the world allows. Says what stopped it, if anything:
  // 'ledge' for a drop or a floor that is not one, 'wall' for being held back.
  // With `room` (how far, in units), the reader's own walk: they keep that
  // much comfortable clearance where space allows (`keepRoom`). Without it, the body as the
  // piece's walks need it.
  const stepOnce = (feet, move, room = 0) => {
    const len = Math.hypot(move.x, move.z);
    if (len < 1e-6) return { moved: 0, stop: null };
    if (room > 0) move = keepRoom(feet, move, room);
    const want = Math.hypot(move.x, move.z);
    if (want < 1e-6) return { moved: 0, stop: 'wall' };
    let ledge = false;
    for (const [a, k] of SLIDES) {
      const c = Math.cos(a), s = Math.sin(a);
      tryMove.set((move.x * c - move.z * s) * k, 0, (move.x * s + move.z * c) * k);
      next.set(feet.x + tryMove.x, feet.y, feet.z + tryMove.z);
      const ux = tryMove.x / (want * k), uz = tryMove.z / (want * k);
      // (the centre first, which is cheap; the whole foot once the walls have
      // put it where it will stand)
      const f = landing(next.x, next.z, feet.y, ux, uz, false);
      if (f === null) { ledge = true; continue; }
      shoulder(next, f);
      // pushed off the wall, the floor there has to be one too
      const g = landing(next.x, next.z, feet.y, ux, uz);
      if (g === null) { ledge = true; continue; }
      const moved = Math.hypot(next.x - feet.x, next.z - feet.z);
      feet.set(next.x, g, next.z);
      return { moved, stop: moved < len * 0.5 ? (ledge ? 'ledge' : 'wall') : null };
    }
    return { moved: 0, stop: ledge ? 'ledge' : 'wall' };
  };

  // Check every short part of a move. A dropped frame or a long probe step
  // must not carry the body across a thin wall or an unsupported bridge edge.
  const step = (feet, move, room = 0) => {
    const n = Math.max(1, Math.ceil(Math.hypot(move.x, move.z) / 1.25));
    const part = move.clone().multiplyScalar(1 / n);
    let moved = 0, stop = null;
    for (let i = 0; i < n; i++) {
      const result = stepOnce(feet, part, room);
      moved += result.moved;
      stop = result.stop;
      if (stop) break;
    }
    return { moved, stop };
  };

  // Could a reader walk straight from `from` to `to` (feet, with y the floor)
  // without being turned aside, held back or stopped at a ledge? For the
  // piece's own walks, which take over from wherever the reader has got to:
  // they go in a straight line to the nearest point of the way they know.
  const along = new THREE.Vector3(), walker = new THREE.Vector3(), line = new THREE.Line3(), onLine = new THREE.Vector3();
  const clear = (from, to) => {
    walker.copy(from);
    line.start.set(from.x, 0, from.z);
    line.end.set(to.x, 0, to.z);
    for (let k = 0; k < 400; k++) {
      along.set(to.x - walker.x, 0, to.z - walker.z);
      const left = along.length();
      if (left < 1.5) return Math.abs(walker.y - to.y) < STEP_UP;
      along.multiplyScalar(Math.min(2, left) / left);
      const { moved } = step(walker, along);
      if (moved < 0.2) return false;
      line.closestPointToPoint(onLine.set(walker.x, 0, walker.z), true, onLine);
      if (onLine.distanceTo(along.set(walker.x, 0, walker.z)) > 1.5) return false;
    }
    return false;
  };

  // ── Looking ahead ──────────────────────────────────────────────────────────
  // How far a reader standing at `feet` could walk along (ux, uz) — no
  // further than `far` — before the column's front meets a wall, or the floor
  // gives out or climbs past a step. For the steering that turns a reader
  // aside before they walk into something (World.jsx), so it is felt the way
  // the feet would go: in strides of LOOK_STEP, each felt at shin height over
  // the floor the last one reached, so a stair rises under it instead of
  // standing in front of it like a wall.
  const LOOK_STEP = 4;
  // Over the floor: above the tallest step (the Echo's first, 5), below the
  // low rails round the wells (5-6.5) — which it would otherwise walk over.
  const SHIN = 5.6;
  // And at the shoulders as well as down the middle: felt down the middle
  // alone, a way that cleared a doorway's jamb by a hair was open, and the
  // reader was steered into the jamb shoulder-first. (A shoulder ray stands
  // in from the column's edge, where its front is that much further back.)
  const SIDE = RADIUS * 0.8, SIDE_FRONT = RADIUS * 0.6;
  const clearance = (feet, ux, uz, far) => {
    const list = around(feet);
    let x = feet.x, z = feet.z, y = feet.y;
    for (let d = 0; d < far; d += LOOK_STEP) {
      const run = Math.min(LOOK_STEP, far - d);
      ray.origin.set(x, y + SHIN, z);
      ray.direction.set(ux, 0, uz);
      const wall = cast(list, run + RADIUS, false);
      if (wall) return Math.max(0, d + wall.d - RADIUS);
      for (const side of [-1, 1]) {
        ray.origin.set(x - uz * SIDE * side, y + SHIN, z + ux * SIDE * side);
        const brush = cast(list, run + SIDE_FRONT, false);
        if (brush) return Math.max(0, d + brush.d - SIDE_FRONT);
      }
      x += ux * run;
      z += uz * run;
      const f = floorIn(list, x, y + STEP_UP + 0.5, z, STEP_UP + STEP_DOWN + 1);
      if (f === null || f - y > STEP_UP || y - f > STEP_DOWN) return d + run / 2;
      // A ray down the middle alone calls the very edge of a deck walkable.
      // Both sides of the foot need support before steering towards it.
      for (const side of [-1, 1]) {
        const g = floorIn(list, x - uz * FOOT * side, f + STEP_UP + 0.5, z + ux * FOOT * side, STEP_UP + STEP_DOWN + 1);
        if (g === null || f - g > TREAD || g - f > STEP_UP) return d;
      }
      y = f;
    }
    return far;
  };

  // ── At an edge ─────────────────────────────────────────────────────────────
  // How far ahead along (ux, uz), within `far`, the floor falls away by more
  // than DEEP — a gallery's well, the side of a bridge over the floor, the
  // open side of the Vertigo's stair — or null. A rail at the edge does not
  // hide it (a reader walks up to a rail to look over it), and a stair going
  // down is not one (each tread is under the last); but a wall at eye height
  // before it does hide it. For the head going down to look over an edge as
  // the reader walks up to it (World.jsx, BRINK).
  const DEEP = 20;
  const BRINK_STEP = 1.5;
  const brink = (feet, ux, uz, far) => {
    const list = around(feet);
    ray.origin.set(feet.x, feet.y + EYE - 1, feet.z);
    ray.direction.set(ux, 0, uz);
    const wall = cast(list, far, false);
    const reach = wall ? wall.d - 1 : far;
    for (let d = BRINK_STEP; d <= reach; d += BRINK_STEP) {
      ray.origin.set(feet.x + ux * d, feet.y + EYE - 1, feet.z + uz * d);
      ray.direction.set(0, -1, 0);
      if (!cast(list, EYE - 1 + DEEP, false)) return d;
    }
    return null;
  };

  // ── Room to stand ──────────────────────────────────────────────────────────
  // The column keeps the eye RADIUS off the stone, which is a nose's length
  // (38 cm): walked straight at a wall, the reader stood with the grain
  // filling the frame. Nobody walks up to a wall like that. So whatever is
  // straight ahead at chest height takes back the part of a step that goes
  // into it, a little of it from twice `stand` out and all of it at `stand`
  // (ROOM_STAND unless dialled), and the reader comes to a stand that far
  // short of it.
  // The forward check removes the part going into the wall. Side checks
  // gradually draw a moving reader away from nearby stone and books. Where
  // two sides are close, the target is half the available width: the centre
  // of a doorway or bridge, rather than an impossibly wide exclusion zone.
  //   At chest height, over the floor the feet would reach, stride by stride
  // as `clearance` feels it: a stair rising ahead is floor, not wall, and the
  // well rails, balustrades and benches are under it, so a reader still comes
  // right up to a rail to look over. Nothing past a drop is felt: the
  // Vertigo's broken rail is walked into.
  //   Which way the face ahead runs is read across SPAN either side of the
  // middle, not off the one triangle the middle meets: a shelf's books stand
  // proud of each other, and read off a book's side the wall ran straight at
  // the reader, so what was held back swung from one book to the next and the
  // feet zigzagged in and jittered where they stood.
  const SPAN = 3;
  const wallAt = { d: 0, nx: 0, nz: 0 };
  const sideHit = (ox, oy, oz, ux, uz, s, list, far) => {
    ray.origin.set(ox - uz * SPAN * s, oy, oz + ux * SPAN * s);
    ray.direction.set(ux, 0, uz);
    const hit = cast(list, far, false);
    return hit ? hit.d : null;
  };
  const wallAhead = (feet, ux, uz, far) => {
    const list = around(feet);
    let x = feet.x, z = feet.z, y = feet.y;
    for (let d = 0; d < far; d += LOOK_STEP) {
      const run = Math.min(LOOK_STEP, far - d);
      ray.origin.set(x, y + CHEST, z);
      ray.direction.set(ux, 0, uz);
      const wall = cast(list, run, false);
      if (wall) {
        const t = wall.d;
        // the face's own normal, level and turned toward the reader (a
        // two-sided face's may be the far side's), for when nothing either
        // side is met — a post, a column narrower than the span; one mostly
        // up or down, a slanting underside, reads as square on
        let nx = wall.nx, nz = wall.nz;
        if (nx * ux + nz * uz > 0) { nx = -nx; nz = -nz; }
        const h = Math.hypot(nx, nz);
        if (h < 0.3) { nx = -ux; nz = -uz; } else { nx /= h; nz /= h; }
        // across the span: (a, b) is the face's run, sideways and on
        const l = sideHit(x, y + CHEST, z, ux, uz, -1, list, t + SPAN * 3);
        const r = sideHit(x, y + CHEST, z, ux, uz, 1, list, t + SPAN * 3);
        const a = l !== null && r !== null ? 2 * SPAN : SPAN;
        const b = l !== null && r !== null ? r - l : l !== null ? t - l : r !== null ? r - t : null;
        if (b !== null) {
          // square to that run, toward the reader: (b, -a) sideways and on
          const k = Math.hypot(a, b);
          nx = (b * -uz - a * ux) / k;
          nz = (b * ux - a * uz) / k;
        }
        return Object.assign(wallAt, { d: d + t, nx, nz });
      }
      x += ux * run;
      z += uz * run;
      const f = floorIn(list, x, y + STEP_UP + 0.5, z, STEP_UP + STEP_DOWN + 1);
      if (f === null || f - y > STEP_UP || y - f > STEP_DOWN) return null;
      y = f;
    }
    return null;
  };
  const roomy = new THREE.Vector3();
  const sideRoom = (feet, ux, uz, far) => {
    const list = around(feet);
    let gap = far;
    // Rails as well as the books and stone at chest height.
    for (const height of [KNEE + 0.5, CHEST]) {
      ray.origin.set(feet.x, feet.y + height, feet.z);
      ray.direction.set(ux, 0, uz);
      const hit = cast(list, far, false);
      if (hit) gap = Math.min(gap, hit.d);
    }
    return gap;
  };
  const keepRoom = (feet, move, stand) => {
    const len = Math.hypot(move.x, move.z);
    roomy.set(move.x, 0, move.z);
    const ux = move.x / len, uz = move.z / len;
    const wall = wallAhead(feet, ux, uz, stand * 2);
    if (wall) {
      const into = -(roomy.x * wall.nx + roomy.z * wall.nz);
      if (into > 0) {
        const held = 1 - THREE.MathUtils.smoothstep(wall.d, stand, stand * 2);
        roomy.x += wall.nx * into * held;
        roomy.z += wall.nz * into * held;
      }
    }
    const left = sideRoom(feet, -uz, ux, stand * 2);
    const right = sideRoom(feet, uz, -ux, stand * 2);
    const target = Math.min(stand, (left + right) / 2);
    const away = (Math.max(0, target - right) - Math.max(0, target - left)) / Math.max(target, RADIUS);
    // Gradual lateral clearance, balanced between two close walls. Scaling
    // by the stride keeps it smooth and never pushes a stationary reader.
    roomy.x += -uz * away * len * 0.6;
    roomy.z += ux * away * len * 0.6;
    return roomy;
  };

  // ── Building the trees before they are needed ──────────────────────────────
  let warming = null;
  const warm = (from, delay = 0) => {
    if (warming) return;
    const order = colliders
      .map((c) => {
        placed(c);
        return [c, c.sphere.center.distanceTo(from)];
      })
      .sort((a, b) => a[1] - b[1])
      .map(([c]) => c);
    let i = 0;
    const slice = () => {
      const until = performance.now() + 6;
      while (i < order.length && performance.now() < until) solid(order[i++]);
      warming = i < order.length ? setTimeout(slice, 30) : true;
      // (on the page's timeline beside World.jsx's own marks)
      if (warming === true) performance.mark?.('world:feet-ready');
    };
    warming = setTimeout(slice, Math.max(30, delay));
  };

  const floorUnder = (eye) => floorAt(eye.x, eye.y, eye.z, EYE + STEP_DOWN + 2);

  // ── In sight ───────────────────────────────────────────────────────────────
  // Whether the line from `a` to within `short` of `b` is clear of anything
  // solid: for a lamp's halo (buildWorld's `occlude`), which is drawn over
  // everything, so a lamp behind a column or a wall still laid its glow over
  // the stone in front of it. Only the trees already built are asked (`warm`
  // builds them all within a few seconds of arriving): a line of sight never
  // builds one, and a tree not built yet stands in the way of nothing.
  let seeing = [], seenAt = -Infinity, seenAll = false;
  const lookers = () => {
    const now = performance.now();
    if (seenAll || now - seenAt < 500) return seeing;
    seenAt = now;
    seenAll = warming === true;
    seeing = [];
    for (const c of colliders) {
      if (c.water || !c.geometry) continue;
      const bvh = bvhs.get(c.geometry);
      if (!bvh) continue;
      c.bvh = bvh;
      c.identity = c.matrix.equals(IDENTITY);
      if (!c.identity) c.inverse.copy(c.matrix).invert();
      placed(c);
      seeing.push(c);
    }
    return seeing;
  };
  // (any solid will do, so the first one met ends it: no need of the nearest)
  const sight = (a, b, short = 0) => {
    ray.origin.copy(a);
    ray.direction.subVectors(b, a);
    const far = ray.direction.length() - short;
    if (far <= 0) return true;
    ray.direction.normalize();
    for (const c of lookers()) {
      toC.subVectors(c.sphere.center, ray.origin);
      const t = THREE.MathUtils.clamp(toC.dot(ray.direction), 0, far);
      if (toC.addScaledVector(ray.direction, -t).lengthSq() > c.sphere.radius ** 2) continue;
      local.copy(ray);
      if (!c.identity) local.applyMatrix4(c.inverse);
      const hit = c.bvh.raycastFirst(local, THREE.DoubleSide, 0, c.identity ? far : Infinity);
      if (!hit) continue;
      if (c.identity) return false;
      hitP.copy(hit.point).applyMatrix4(c.matrix);
      if (hitP.distanceTo(ray.origin) < far) return false;
    }
    return true;
  };

  return {
    step,
    clear,
    clearance,
    brink,
    floorUnder,
    landing,
    wallAhead,
    why: () => refused,
    // (DEV, for the reach of the feet: what stands under them at (x, y, z),
    // and how many of FOOTPRINT's eight round them, at FOOT, have nothing to
    // stand on within a tread below)
    ground: (x, y, z) => {
      const f = floorAt(x, y + 1, z, 3);
      return { y: f, what: floorWhat };
    },
    // (and straight down from `top`, as the foot's ring asks it)
    under: (x, top, z, depth) => {
      const y = floorAt(x, top, z, depth, true);
      return { y, what: floorWhat, shoulder: shoulderY };
    },
    footing: (x, y, z, r = 2.5) => FOOTPRINT.filter(([dx, dz]) => {
      const g = floorAt(x + dx * r, y + STEP_UP + 0.5, z + dz * r, STEP_UP + 0.5 + TREAD, true);
      return g === null || y - g > TREAD;
    }).length,
    warm,
    sight,
    refresh: () => { nearFrom.set(Infinity, 0, 0); },
    count: colliders.length,
    dispose: () => {
      if (warming && warming !== true) clearTimeout(warming);
      merged.forEach((g) => g.dispose());
    },
  };
}
