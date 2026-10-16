// The Pavilion's details: the stand, the bracket sets and arms, the rails and
// their finials, the qin, the willows and the gilt.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

const mix = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The paint on a bracket arm: a field of malachite inside a chalk line,
// both a little way in from the arm's own edge, which stays timber.
// (A green on the yellow side, and deep: under the eave it is lit by the sky
// as much as by the lamp, and a bluer one read from the stand as teal tubes.)
export const CAIHUA = { green: '#475f31', chalk: '#b3ab94', line: 0.13, field: 0.23, ease: 0.1 };

// What was gilt: `gilt` the collars' (half the gold's shine, and darker).
export const DARK_GILT = { color: '#735a30', roughness: 0.58, metalness: 0.75 };

// The willows (trees.js `weeping`, effects.js makeHangingMaterial `weep`):
// `tip` how dark a strand is at its end beside its top, `glow` how much of a
// strand's own colour it gives back (it was 1: bright strings on the night),
// `sway` how much further than the Door's wisteria it moves, `skip` the share
// of the curtain's cards left off (pavilionProps.js, left 0.45 of them off
// while each was a bright bar).
export const WILLOW = { tip: qn('wwillowtip', 0.34), glow: qn('wwillowglow', 0.4), sway: 1.6, skip: qn('wwillowskip', 0.2), tone: '#b4bb9c' };

// A triangle soup, each face turned to look away from `from(p)`, welded and
// smoothed, and handed back unwelded for a batch.
const skin = (tris, from) => {
  const pos = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3(), mid = new THREE.Vector3();
  for (const [p, q, r] of tris) {
    a.set(...p); b.set(...q); c.set(...r);
    n.subVectors(b, a).cross(m.subVectors(c, a));
    mid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    m.copy(mid).sub(from(mid.clone()));
    if (n.dot(m) < 0) pos.push(...p, ...r, ...q); else pos.push(...p, ...q, ...r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const welded = mergeVertices(g, 1e-4);
  welded.computeVertexNormals();
  const out = welded.toNonIndexed();
  g.dispose();
  welded.dispose();
  out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((out.attributes.position.count) * 2), 2));
  return out;
};
const rod = (p, q, r, sides = 5) => {
  const va = new THREE.Vector3(...p), vb = new THREE.Vector3(...q);
  const g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), sides).toNonIndexed();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
  const mid = va.add(vb).multiplyScalar(0.5);
  return g.translate(mid.x, mid.y, mid.z);
};

// A qin, in its own frame: x along it, its head at +x (a player's right
// hand), z across it with the player at +z, y up from the table it lies on,
// the middle of its length at the origin. About a hundred and thirteen
// centimetres of it (a unit is 9.4): the Zhongni outline — a square head, the
// neck cut in behind it, shoulders at its widest, a long taper, the waist cut
// in two-thirds of the way down, and a narrow tail. Its top is arched from
// side to side. Seven strings run from the bridge at the head (yueshan) to
// the nut at the tail (longyin), the thickest furthest from the player;
// outside it, the thirteen studs (hui) at the string's harmonics — an eighth,
// a sixth, a fifth, a quarter, a third, two fifths, the half, and back again —
// the middle one the largest. Under the tail's end of the body two feet
// (yanzu) hold it off the table; its head lies past the table's edge, where
// the seven pegs hang with their tassels. `edge(z)`: how far along x the
// table's rim is at z, for the tassels to know they are clear of it.
export function qin({ L = 12, half = 1.08 } = {}) {
  const hw = (u) => {
    const taper = u < 0.19 ? half : mix(half, half * 0.69, (u - 0.19) / 0.81);
    const neck = mix(mix(0.86, 0.72, ss(0.065, 0.095, u)), 1, ss(0.125, 0.19, u));
    const waist = 1 - 0.17 * (ss(0.6, 0.625, u) - ss(0.715, 0.74, u));
    const tail = 0.72 + 0.28 * Math.sqrt(Math.max(0, 1 - Math.max(0, (u - 0.975) / 0.025) ** 2));
    return taper * neck * waist * tail;
  };
  const X = (u) => L / 2 - u * L;
  const thick = (u) => mix(0.6, 0.46, u), DROP = 0.17;
  const top = (u, z) => thick(u) - DROP * Math.min(1, Math.abs(z) / hw(u)) ** 2;

  // the body: a ring at every station, the top in eight facets across
  const N = 96, ring = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, w = hw(u), pts = [];
    for (let j = 0; j <= 8; j++) { const z = w * (-1 + j / 4); pts.push([X(u), top(u, z), z]); }
    pts.push([X(u), 0, w - 0.08], [X(u), 0, -(w - 0.08)]);
    ring.push(pts);
  }
  const tris = [], R = ring[0].length;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < R; j++) {
      const a = ring[i][j], b = ring[i][(j + 1) % R], c = ring[i + 1][j], d = ring[i + 1][(j + 1) % R];
      tris.push([a, c, b], [b, c, d]);
    }
  }
  const body = [skin(tris, (p) => p.set(p.x, 0.25, 0))];
  // its two ends, flat
  for (const [i, sign] of [[0, 1], [N, -1]]) {
    const mid = [X(i / N), 0.25, 0], cap = [];
    for (let j = 0; j < R; j++) cap.push([mid, ring[i][j], ring[i][(j + 1) % R]]);
    body.push(skin(cap, (p) => p.set(p.x - sign, p.y, p.z)));
  }

  const UB = 0.068, UT = 0.992;
  const strings = [], pearl = [], fittings = [], tassels = [];
  // the bridge and the nut, in hardwood
  fittings.push(new THREE.BoxGeometry(0.15, 0.26, 1.24).toNonIndexed().translate(X(UB), thick(UB) + 0.04, 0));
  fittings.push(new THREE.BoxGeometry(0.12, 0.14, 0.92).toNonIndexed().translate(X(UT), thick(UT) - 0.02, 0));
  // the seven strings, string 1 at −z
  const zAt = (k, u) => mix(-0.5, 0.5, k / 6) * mix(1, 0.8, (u - UB) / (UT - UB));
  for (let k = 0; k < 7; k++) {
    strings.push(rod(
      [X(UB), thick(UB) + 0.17, zAt(k, UB)], [X(UT), thick(UT) + 0.05, zAt(k, UT)], mix(0.03, 0.017, k / 6),
    ));
  }
  // the thirteen studs
  [1 / 8, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 2 / 5, 1 / 2, 3 / 5, 2 / 3, 3 / 4, 4 / 5, 5 / 6, 7 / 8].forEach((f, k) => {
    // (counted from the nut, as a player counts them: the 13th is nearest the bridge)
    const u = mix(UT, UB, f), z = -Math.max(Math.abs(zAt(0, u)) + 0.13, Math.min(hw(u) - 0.11, Math.abs(zAt(0, u)) + 0.2));
    const r = mix(0.085, 0.05, Math.abs(k - 6) / 6);
    pearl.push(new THREE.CylinderGeometry(r, r, 0.03, 10).toNonIndexed().translate(X(u), top(u, z) + 0.004, z));
  });
  // the feet under the waist
  for (const z of [0.36, -0.36]) fittings.push(new THREE.CylinderGeometry(0.11, 0.14, 0.24, 8).toNonIndexed().translate(X(0.72), -0.12, z));
  // the pegs under the head, and what hangs from each: a cord and its tassel
  for (let k = 0; k < 7; k++) {
    const x = X(0.038) + (k % 2) * 0.16, z = mix(-0.62, 0.62, k / 6);
    fittings.push(new THREE.CylinderGeometry(0.06, 0.075, 0.5, 6).toNonIndexed().translate(x, -0.25, z));
    const len = 1.15 + ((k * 0.618034) % 1) * 0.75, sway = (((k * 0.381966) % 1) - 0.5) * 0.12;
    tassels.push(rod([x, -0.5, z], [x + sway, -0.5 - len, z + sway * 0.6], 0.022, 4));
    tassels.push(new THREE.CylinderGeometry(0.03, 0.085, 0.55, 6).toNonIndexed().translate(x + sway, -0.5 - len - 0.27, z + sway * 0.6));
  }

  // The tail is held off the table by its feet and the neck lies on it: the
  // whole of it turned that little about where it rests.
  const rest = X(0.14), tilt = -Math.atan2(0.24, rest - X(0.72));
  const parts = { body, strings, pearl, fittings, tassels };
  for (const list of Object.values(parts)) for (const g of list) g.translate(-rest, 0, 0).rotateZ(tilt).translate(rest, 0, 0);
  return { ...parts, L, half };
}

// The cloth under the qin's tail: laid on the table across the qin's line
// from `back` (the lamp's side), over the rim on the player's side and let
// down `hang`. In the qin's frame; the table's middle is at `centre` [x, z]
// in it, its rim `rim` out from that. `cloth` is the stuff, both its faces;
// `trim` the two woven lines down its sides and the one above its hem.
export function qinCloth({ centre, rim, x0, x1, back = -1.6, hang = 2.5, thick = 0.035 } = {}) {
  const FOLD = 0.13;
  const rimZ = (x) => centre[1] + Math.sqrt(Math.max(0, rim * rim - (x - centre[0]) ** 2));
  // rows down the cloth: [part, how far along the part]
  const rows = [];
  for (let k = 0; k <= 3; k++) rows.push(['flat', k / 3]);
  for (let k = 1; k <= 4; k++) rows.push(['fold', k / 4]);
  for (let k = 1; k <= 6; k++) rows.push(['hang', k / 6]);
  const at = (x, [part, f], lift) => {
    const zr = rimZ(x);
    if (part === 'flat') return [x, thick + lift, mix(back, zr - FOLD, f)];
    if (part === 'fold') {
      const a = (Math.PI / 2) * (1 - f), r = FOLD + lift;
      return [x, thick - FOLD + Math.sin(a) * r, zr - FOLD + Math.cos(a) * r];
    }
    // let down, and not as a board: it hangs in three slow folds
    const wave = Math.sin(x * 2.3 + 0.9) * 0.11 * f * f;
    return [x, thick - FOLD - (hang - FOLD) * f, zr + lift + wave];
  };
  const sheet = (xa, xb, nx, r0, r1, lift, flip = false) => {
    const pos = [], idx = [];
    const nr = r1 - r0;
    for (let i = 0; i <= nx; i++) for (let r = r0; r <= r1; r++) pos.push(...at(mix(xa, xb, i / nx), rows[r], lift));
    for (let i = 0; i < nx; i++) {
      for (let r = 0; r < nr; r++) {
        const a = i * (nr + 1) + r, b = a + 1, c = a + nr + 1, d = c + 1;
        if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const out = g.toNonIndexed();
    g.dispose();
    out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
    return out;
  };
  const last = rows.length - 1;
  // which way round faces up: taken from the sheet itself
  const probe = sheet(x0, x1, 1, 0, 1, 0), up = probe.attributes.normal.getY(0) > 0;
  probe.dispose();
  const cloth = [sheet(x0, x1, 14, 0, last, 0, !up), sheet(x0, x1, 14, 0, last, -thick * 0.9, up)];
  const w = x1 - x0, trim = [];
  // two threads down each side, a broad and a fine
  for (const [a, b] of [[0.06, 0.082], [0.1, 0.108]]) {
    trim.push(sheet(x0 + w * a, x0 + w * b, 1, 0, last, 0.012, !up), sheet(x1 - w * b, x1 - w * a, 1, 0, last, 0.012, !up));
  }
  // and the same two above the hem: narrow sheets of their own, each between two heights
  for (const [f0, f1] of [[0.86, 0.9], [0.8, 0.815]]) {
    const pos = [], idx = [], nx = 14;
    for (let i = 0; i <= nx; i++) {
      const x = mix(x0 + w * 0.06, x1 - w * 0.06, i / nx);
      pos.push(...at(x, ['hang', f0], 0.012), ...at(x, ['hang', f1], 0.012));
    }
    for (let i = 0; i < nx; i++) { const a = i * 2; idx.push(...(up ? [a, a + 2, a + 1, a + 1, a + 2, a + 3] : [a, a + 1, a + 2, a + 1, a + 3, a + 2])); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const out = g.toNonIndexed();
    g.dispose();
    out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
    trim.push(out);
  }
  return { cloth, trim };
}

// A rail's member, worn. From a to b ([x, z]), `h` tall from y0 and `t`
// through, cut along its length every unit or so, so that what it carries in
// its vertices can change along it. In each vertex's colour, read by the
// lacquer's shader (build/materials.js, `wornLacquer`) and not as a colour: red, how
// clean the lacquer is there (1; less under a rail, and where another member
// meets it — `joints`, distances along it); green, how far it is rubbed
// through to the wood: `rub` along the middle of its top, where a hand
// runs, a quarter of that at the top's edges, and less toward a joint — a
// hand lifts over a post's head. `ease` takes the two top corners off, so
// the top is a hand's rail and has no knife edge to light as one.
export function wornBar([ax, az], [bx, bz], y0, h, t, { rub = 0, ease = 0, joints = [], grime = 0.62, under = 0.55 } = {}) {
  const len = Math.max(0.5, Math.hypot(bx - ax, bz - az)), n = Math.max(1, Math.round(len / 1.1));
  // the section: [z across, y, clean, rubbed] round it, from the bottom corner
  const e = Math.min(ease, t / 2 - 0.05, h - 0.05);
  const sec = e > 0 ? [
    [-t / 2, 0, under, 0], [t / 2, 0, under, 0],
    [t / 2, h - e, 0.96, 0], [t / 2 - e, h, 1, rub * 0.25], [0, h, 1, rub],
    [-t / 2 + e, h, 1, rub * 0.25], [-t / 2, h - e, 0.96, 0],
  ] : [[-t / 2, 0, under, 0], [t / 2, 0, under, 0], [t / 2, h, 0.98, rub * 0.25], [0, h, 0.98, rub], [-t / 2, h, 0.98, rub * 0.25]];
  const pos = [], col = [];
  const near = (x) => joints.reduce((m, j) => Math.min(m, Math.abs(x - j)), Infinity);
  const clean = (x) => mix(grime, 1, ss(0.15, 1.0, near(x)));
  const handled = (x) => mix(0.3, 1, ss(0.5, 2.2, near(x)));
  // (each face its own vertices: the section's corners are corners)
  const S = sec.length;
  for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + (len * i) / n, x1 = -len / 2 + (len * (i + 1)) / n, c0 = clean(x0 + len / 2), c1 = clean(x1 + len / 2);
    const h0 = handled(x0 + len / 2), h1 = handled(x1 + len / 2);
    for (let k = 0; k < S; k++) {
      const p = sec[k], q = sec[(k + 1) % S];
      // a face's top edge is rubbed as the top is only where it IS the top
      const quad = [[x0, p, c0, h0], [x1, p, c1, h1], [x1, q, c1, h1], [x0, q, c0, h0]];
      for (const v of [0, 1, 2, 0, 2, 3]) {
        const [x, s, c, hand] = quad[v];
        pos.push(x, s[1], s[0]);
        col.push(s[2] * c, s[3] * hand, 0);
      }
    }
  }
  for (const [x, flip] of [[-len / 2, false], [len / 2, true]]) {
    for (let k = 1; k < S - 1; k++) {
      for (const v of flip ? [0, k + 1, k] : [0, k, k + 1]) { pos.push(x, sec[v][1], sec[v][0]); col.push(sec[v][2] * grime, 0, 0); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.rotateY(-Math.atan2(bz - az, bx - ax));
  g.translate((ax + bx) / 2, y0, (az + bz) / 2);
  return g;
}

// An upright of the same rail — a post or a baluster — `w` square and `h`
// tall, its foot at y0: the lacquer deeper at its foot and under what it
// carries, and a post's arrises a little rubbed at the height a hand passes.
export function wornPost([x, z], y0, w, h, ang, { foot = 0.6, head = 0.72, rub = 0 } = {}) {
  const g = new THREE.BoxGeometry(w, h, w, 1, 4, 1).toNonIndexed();
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const f = pos.getY(i) / h + 0.5;
    col[i * 3] = mix(foot, 1, ss(0, 0.3, f)) * mix(1, head, ss(0.7, 1, f));
    col[i * 3 + 1] = rub * ss(0.45, 0.8, f) * (1 - ss(0.9, 1, f));
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g.rotateY(ang).translate(x, y0 + h / 2, z);
}

// (for a batch whose members all carry a colour: anything else laid into it)
export function plainColour(g, clean = 1) {
  const flat = g.index ? g.toNonIndexed() : g;
  const col = new Float32Array(flat.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) col[i] = clean;
  flat.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return flat;
}

// The stand: `at` along the bridge's footprint (0 the shore end, 1 its first
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

// The bracket set over a column, in the column's own frame: +x out from the
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
// (`paint`, pavilionProps.js: up close an arm was a length of timber with a
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

// A lotus bud for the head of a rail post: a closed bud, pointed, its
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

// The willows' whips (textures.js `hanging`, kinds 4 and 5; effects.js
// `makeHangingMaterial`): broader strands, and coverage kept down the mips.
export const WILLOW_BROAD = true;
