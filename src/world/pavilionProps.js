// The Pavilion's own things, reviewed 2026-10-09 (board 11 of the second
// audit; the numbers are the board's own). The stand was right and showed
// what stood in it: 3 up close the bracket arms were lengths of timber with
// flat ends, and a gilt cup and ball hung from the middle of the ceiling like
// a bell — the arms' edges are eased and their ends rolled under, their faces
// carry a band of green inside a chalk line (cǎihuà, the paint a bracket of
// this kind is always given), and the boss is a plain lacquered one; 4 the
// qin the caption sends the reader to was a board with a pale stripe — it has
// a qin's outline now (the head, the neck cut in, the shoulders, the waist),
// an arched top, seven strings from the bridge to the tail, thirteen studs of
// pearl where the harmonics are, its head over the table's edge with the pegs
// and their tassels hanging from it, and a cloth under its tail let down over
// the rim; 6 the willows were umbrella pines — tufts on bare limbs, and thin
// bright strings hung from them like rain on glass: a full round crown that
// droops at its shoulders, and a curtain that starts inside it and darkens
// to its tips; 10 the rails were one red-brown from end to end, plastic —
// the lacquer is deeper where two members meet and under every rail, rubbed
// through to the wood along the top of the handrail where hands go, and
// its top is eased; 13 gilt collars on every column and gilt balls under
// every lantern, with the finial, were a casino's — the collars are dark
// gilt, the small fittings bronze, and the one bright gold thing is the
// finial. (1 and 2, the roof and its corners: forkProps.js, 2 and 11. 9, the
// caption's last two words alone on a line: map.css, `.room-voice-line`.)
//
// ?wpavprops=old puts all of them back as they were; ?wpavprops=old:4,10 only those.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wpavprops');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const pavPropsOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

const mix = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 3. The paint on a bracket arm: a field of malachite inside a chalk line,
// both a little way in from the arm's own edge, which stays timber.
// (A green on the yellow side, and deep: under the eave it is lit by the sky
// as much as by the lamp, and a bluer one read from the stand as teal tubes.)
export const CAIHUA = { green: '#475f31', chalk: '#b3ab94', line: 0.13, field: 0.23, ease: 0.1 };

// 13. What was gilt: `gilt` the collars' (half the gold's shine, and darker).
export const DARK_GILT = { color: '#735a30', roughness: 0.58, metalness: 0.75 };

// 6. The willows (trees.js `weeping`, effects.js makeHangingMaterial `weep`):
// `tip` how dark a strand is at its end beside its top, `glow` how much of a
// strand's own colour it gives back (it was 1: bright strings on the night),
// `sway` how much further than the Door's wisteria it moves, `skip` the share
// of the curtain's cards left off (pavilionFix.js, 4, left 0.45 of them off
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

// 4. A qin, in its own frame: x along it, its head at +x (a player's right
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

// 4. The cloth under the qin's tail: laid on the table across the qin's line
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

// 10. A rail's member, worn. From a to b ([x, z]), `h` tall from y0 and `t`
// through, cut along its length every unit or so, so that what it carries in
// its vertices can change along it. In each vertex's colour, read by the
// lacquer's shader (buildWorld, `wornLacquer`) and not as a colour: red, how
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

// 10. An upright of the same rail — a post or a baluster — `w` square and `h`
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

