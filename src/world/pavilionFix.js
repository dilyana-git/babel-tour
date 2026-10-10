// The Pavilion's arrival frame, reviewed 2026-10-09 (the numbered points on the
// review board): 8 the roof's underside filled the top third of the frame —
// the stand was most of the way along the bridge, under the eave's reach, and
// looked level at the deck; it stands back on the bridge's first run now,
// near the shore, and looks up a little, so the roof is a silhouette against
// the sky with its finial whole, and (5) the eight paper lanterns along the
// eave are all inside the frame, where two were cut by its edges; 2 under the
// eave the bracket sets read as stacked lumber — two tiers of plain boxes
// over every column, the rafters and two purlins at one radius run through
// them, and a bright gilt cube on the front of each: one clean set to a
// column now (block, arm, block, arm, in a stepped cross, the arms' ends
// rounded off underneath the way a bracket arm's are), the arms laid along
// the beams they carry, and a small cap of dark bronze where the gilt was;
// 3 the rail posts' finials were eggs, and the nearest, out of focus at the
// bottom of the frame, an acorn: small lotus buds, petals carved in; 4 the
// willows' whips shimmered as vertical scan lines (three hair-fine whips to a
// card, under a pixel across from the bridge, alpha-tested): one or two
// broader strands to a card, thinning to the tip, and a card keeps its
// coverage as its texture shrinks; 6 the copy promised music in a world that
// has no sound — it speaks of the qin on the table instead (catalogue.js).
//
// ?wpavfix=old puts all of them back as they were; ?wpavfix=old:2,4 only those.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wpavfix');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const pavOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// 8. The stand: `at` along the bridge's footprint (0 the shore end, 1 its first
// turn, 1.6 where it stood), and the height `lookY` of the point over the
// pavilion's middle the eye is turned to. From 0.3 the pavilion is ninety-odd
// units off, the whole roof and its finial are in the frame with sky round
// them, and the zigzag of the bridge leads in to it under the frame's middle.
export const STAND = { at: qn('wpvat', 0.3), lookY: qn('wpvy', 33) };
export const standOn = (bridge) => {
  const i = Math.min(bridge.length - 2, Math.floor(STAND.at)), t = STAND.at - i;
  const a = bridge[i], b = bridge[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};

// 2. The bracket set over a column, in the column's own frame: +x out from the
// column line, +z along the eave, y up from the column's head. Returns the
// arms, the blocks and the bronze caps as geometries to be carried into place.
//
// A dougong is blocks and arms in alternation. A big cap block on the column
// head; on it a cross — one arm along the eave and one projecting out under
// it; small blocks on the ends of both; on those, a longer arm along the eave
// and a second projecting arm stepping further out; and at that arm's tip a
// short cross-arm and its own blocks, which carry the eave purlin. Every arm
// along the eave is laid along the BEAM it carries (on an octagon that is not
// the tangent: a beam from one column to the next leaves it 22.5° inward), so
// the arms of a set are two halves meeting over the column. The arm ends are
// rounded off underneath in four facets — the one shape that says a bracket
// arm rather than a length of timber.
export const BRACKET = {
  // where the column-line beam and the eave purlin sit, above the column head,
  // and how far out the purlin is from the column line
  beamY: 6.0, purlinY: 6.0, purlinOut: 7.2,
};
const HALF = 22.5 * Math.PI / 180;
// (`paint`, pavilionProps.js 3: up close an arm was a length of timber with a
// flat end. Its edges are eased, its end rolled further under, and each face
// carries its paint — `paint.line` in from the edge a chalk line, `paint.field`
// in a field of green — returned as `chalk` and `green`, a hair proud of it.)
export function bracketSet({ paint = null } = {}) {
  const arms = [], blocks = [], caps = [], chalk = [], green = [];
  const AH = 1.3, AW = 1.4;
  // An arm along +x from x0 to x1, its bottom at y0, `ends` which of its two
  // ends are rounded under (a half arm meets its twin over the column square).
  // the arm's outline, `e` in from its edge all round (an end that is not
  // rounded is under a block: left where it is)
  const outline = (x0, x1, y0, ends, rise, cut, steps, e) => {
    const s = new THREE.Shape(), r = AH * rise - e, c = cut - e, yb = y0 + e, yt = y0 + AH - e;
    const xa = ends[0] ? x0 + e : x0, xb = ends[1] ? x1 - e : x1;
    s.moveTo(xa, yt);
    if (ends[0]) {
      s.lineTo(xa, yb + r);
      for (let i = 1; i <= steps; i++) { const t = (i / steps) * Math.PI / 2; s.lineTo(xa + c - c * Math.cos(t), yb + r - r * Math.sin(t)); }
    } else s.lineTo(xa, yb);
    if (ends[1]) {
      s.lineTo(xb - c, yb);
      for (let i = 1; i <= steps; i++) { const t = (i / steps) * Math.PI / 2; s.lineTo(xb - c + c * Math.sin(t), yb + r * (1 - Math.cos(t))); }
      s.lineTo(xb, yt);
    } else { s.lineTo(xb, yb); s.lineTo(xb, yt); }
    return s;
  };
  const slab = (shape, width) => new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -width / 2);
  const arm = (x0, x1, y0, { ends = [true, true], rise = paint ? 0.74 : 0.55, cut = paint ? 1.55 : 1.3 } = {}) => {
    if (!paint) return slab(outline(x0, x1, y0, ends, rise, cut, 4, 0), AW);
    const b = paint.ease;
    const g = new THREE.ExtrudeGeometry(outline(x0, x1, y0, ends, rise, cut, 7, 0), {
      depth: AW - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 1, curveSegments: 1,
    });
    g.translate(0, 0, -(AW / 2 - b));
    // the paint goes where the arm goes: carried with it by `along` below
    g.userData.paint = [
      [chalk, slab(outline(x0, x1, y0, ends, rise, cut, 7, paint.line), AW + 0.04)],
      [green, slab(outline(x0, x1, y0, ends, rise, cut, 7, paint.field), AW + 0.08)],
    ];
    return g;
  };
  // an arm into `arms`, and its paint after it by the same move
  const lay = (g, move = (x) => x) => {
    arms.push(move(g));
    for (const [into, p] of g.userData.paint ?? []) into.push(move(p));
  };
  // A block: a square top, and under it the waist cut in toward the foot.
  const block = (x, z, y0, size, ry = 0) => {
    const hb = size * 0.2, ht = size * 0.24, rTop = size / Math.SQRT2;
    const parts = [
      new THREE.CylinderGeometry(rTop, rTop * 0.74, hb, 4, 1).rotateY(Math.PI / 4).translate(0, y0 + hb / 2, 0),
      new THREE.BoxGeometry(size, ht, size).translate(0, y0 + hb + ht / 2, 0),
    ];
    const g = mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
    parts.forEach((p) => p.dispose());
    blocks.push(g.rotateY(ry).translate(x, 0, z));
    return y0 + hb + ht;
  };
  // the two halves of an arm along the eave, `len` each way from (x, ·, 0)
  const along = (x, y0, len) => {
    for (const side of [1, -1]) {
      const g = arm(-0.7, len, y0, { ends: [false, true] });
      // +x carried onto the beam's line: out of the tangent, 22.5° inward
      lay(g, (q) => q.rotateY(side * -(Math.PI / 2 + HALF)).translate(x, 0, 0));
    }
  };
  const onAlong = (x, d, side) => [x - Math.sin(HALF) * d, side * Math.cos(HALF) * d];
  const turnAlong = (side) => side * -(Math.PI / 2 + HALF);

  // the cap block on the column head
  let y = block(0, 0, 0, 4.4);
  // first tier: the cross
  along(0, y, 4.6);
  lay(arm(-2.6, 4.6, y));
  y += AH;
  // its blocks: the centre, the two ends along the eave, the tip and the tail
  let y2 = block(0, 0, y, 2.0);
  for (const side of [1, -1]) { const [bx, bz] = onAlong(0, 3.7, side); block(bx, bz, y, 2.0, turnAlong(side)); }
  block(3.7, 0, y, 2.0);
  block(-1.7, 0, y, 2.0);
  y = y2;
  // second tier, stepped: a longer arm along the eave, and a second projecting
  // arm reaching out to the eave purlin, with its own short cross at the tip
  along(0, y, 7.0);
  lay(arm(-2.6, BRACKET.purlinOut + 1.0, y));
  along(BRACKET.purlinOut, y, 3.9);
  y += AH;
  block(0, 0, y, 2.0);
  for (const side of [1, -1]) {
    const [bx, bz] = onAlong(0, 6.1, side); block(bx, bz, y, 2.0, turnAlong(side));
    const [cx, cz] = onAlong(BRACKET.purlinOut, 3.1, side); block(cx, cz, y, 2.0, turnAlong(side));
  }
  block(BRACKET.purlinOut, 0, y, 2.0);
  // A small dark bronze cap on the end of the projecting arm, where the
  // bracket meets the eye from across the water — the end grain shod, not a
  // gilt cube stood in front of it. (On the end face above the rounding.)
  const tip = BRACKET.purlinOut + 1.0, yTop = y;
  caps.push(new THREE.BoxGeometry(0.16, AH * 0.42, AW + 0.12).translate(tip + 0.08, yTop - AH * 0.21, 0));
  return { arms, blocks, caps, chalk, green };
}

// 3. A lotus bud for the head of a rail post: a closed bud, pointed, its
// petals carved into it (six, the grooves between them deepest at the swell
// and closing at the tip), sitting in a ring of petal tips turned out. About
// two-thirds the size of the egg it replaces. Origin at its foot.
export function lotusBud({ petals = 6, height = 1.0, radius = 0.36, segments = 30 } = {}) {
  const prof = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = t * height;
    // swell low, run to a point: a bud, not an egg
    const r = radius * Math.max(0, Math.sin(Math.PI * (0.2 + 0.8 * t))) ** 0.75 * (1 - 0.25 * t) + 0.001;
    prof.push(new THREE.Vector2(i === N ? 0.001 : r, y));
  }
  const bud = new THREE.LatheGeometry(prof, segments);
  const pos = bud.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), yy = pos.getY(i), t = yy / height;
    const th = Math.atan2(z, x);
    // a groove where two petals meet, sharpest low on the bud, gone at the tip
    const ridge = Math.abs(Math.cos((th * petals) / 2)) ** 0.45;
    const k = 1 - 0.16 * (1 - ridge) * (1 - t) ** 0.6;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  bud.computeVertexNormals();
  // the ring of outer petals at its foot, their tips lifted
  // (a closed section, out and back: seen from above the rail, an open cup
  // showed its culled inside as a gap round the bud)
  const cupProf = [
    new THREE.Vector2(radius * 0.55, 0), new THREE.Vector2(radius * 1.05, height * 0.1), new THREE.Vector2(radius * 1.22, height * 0.2),
    new THREE.Vector2(radius * 0.95, height * 0.17), new THREE.Vector2(radius * 0.5, height * 0.12),
  ];
  const cup = new THREE.LatheGeometry(cupProf, segments);
  const cp = cup.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), z = cp.getZ(i), yy = cp.getY(i);
    if (yy < height * 0.15) continue;
    const th = Math.atan2(z, x) + Math.PI / petals;
    cp.setY(i, yy + height * 0.12 * Math.abs(Math.cos((th * petals) / 2)) ** 3);
  }
  cup.computeVertexNormals();
  const g = mergeGeometries([bud.toNonIndexed(), cup.toNonIndexed()], false);
  bud.dispose();
  cup.dispose();
  return g;
}

// 4. The willows' whips (textures.js `hanging`, kinds 4 and 5; effects.js
// `makeHangingMaterial`): broader strands, and coverage kept down the mips.
export const WILLOW_BROAD = !pavOld(4);
