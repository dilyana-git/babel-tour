// The Echo's pier lanterns (?wsconce=old: the sconces as they were).
//
// The sconce on every other pier of the Echo's arcade was a bronze rod run
// straight through its globe — its hexagonal end stood out of the front of the
// glass — under a ten-sided pan, with nothing holding either to the column.
// Chosen 2026-10-07 over a gas bracket, a small hanging lamp and a fluted shade
// (canvas "Lamps — options"): a lantern of six opal panes, the shape of the
// galleries, standing on a console.
// The console was held by a deep band round the shaft, which read as a hoop on
// a barrel (?wmount=old). Chosen the same day over two cast roses in the stone
// and two slim straps: it is fixed to a cast plate on the column's face.
//
// Everything is drawn in the lantern's own plane — x out from the column's
// axis toward the room, y the world's height — and turned into place.
import * as THREE from 'three';

const V2 = (x, y) => new THREE.Vector2(x, y);

// A tube along a curve through `pts` ([x, y] or [x, y, z]), its radius running
// r0 → r1. Positions, normals and uv, indexed, as three's own tubes are.
export const sweep = (pts, r0, r1 = r0, { segs = 36, radial = 10 } = {}) => {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const { normals, binormals } = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      n.copy(normals[i]).multiplyScalar(-Math.cos(th)).addScaledVector(binormals[i], Math.sin(th)).normalize();
      pos.push(P.x + r * n.x, P.y + r * n.y, P.z + r * n.z);
      nor.push(n.x, n.y, n.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
};

// A scroll: a spiral that tightens as it turns, from angle th0 to th1.
export const curl = (cx, cy, r0, th0, th1, k = 0.22, n = 28) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const th = th0 + ((th1 - th0) * i) / n, r = r0 * Math.exp(-k * (th - th0));
    out.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  return out;
};

// Turned on its own axis, upright, at x along the lantern's plane. Six-sided
// pieces are cut `flat`, so each face catches the light as a face.
export const lathe = (prof, n, x = 0, flat = false) => {
  let g = new THREE.LatheGeometry(prof.map(([r, y]) => V2(r, y)), n);
  if (flat) { g = g.toNonIndexed(); g.computeVertexNormals(); }
  return g.translate(x, 0, 0);
};
export const ring = (R, tube, y, x = 0, segs = 40) => new THREE.TorusGeometry(R, tube, 8, segs).rotateX(Math.PI / 2).translate(x, y, 0);

// (?wmount=old) The band round the shaft the console sprang from: two beads
// and a fillet over a plain band, and a boss on its face where the bar came out.
const girdle = (R, y, h) => [
  new THREE.CylinderGeometry(R(y + h / 2) + 0.05, R(y - h / 2) + 0.05, h, 44, 1, true).translate(0, y, 0),
  ring(R(y + h / 2) + 0.07, 0.085, y + h / 2, 0, 48),
  ring(R(y - h / 2) + 0.07, 0.085, y - h / 2, 0, 48),
  ring(R(y) + 0.075, 0.045, y, 0, 48),
  new THREE.CylinderGeometry(0.36, 0.44, 0.3, 16).rotateZ(-Math.PI / 2).translate(R(y) + 0.2, y, 0),
];

// A point on the shaft's face, `lift` off it, `s` along the surface from the
// lantern's plane (an arc length, so a shape keeps its width as R narrows).
const onShaft = (R, s, y, lift) => {
  const r = R(y) + lift, ph = s / R(y);
  return [r * Math.cos(ph), y, r * Math.sin(ph)];
};

// Bent round the shaft: what is drawn flat against the plane x = R(y) (a boss)
// is pushed back by the sagitta at its z, so its rim lies on the stone.
const bend = (g, R, y) => {
  const p = g.attributes.position, r = R(y);
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    p.setX(i, p.getX(i) - (r - Math.sqrt(Math.max(r * r - z * z, 0))));
  }
  g.computeVertexNormals();
  return g;
};

// Turned on the axis the bar comes out along (+x), from the face at x0.
const boss = (prof, x0, y) => new THREE.LatheGeometry(prof.map(([r, h]) => V2(r, h)), 48)
  .rotateZ(-Math.PI / 2).translate(x0, y, 0);

// The plate on the shaft's face the console is fixed to: an upright oval cast
// with a bead round its rim and a second inside it, lying on the flutes'
// fillets, a turned boss where the bar and the brace come out of it and a drop
// under it. Nothing goes round the column.
// It comes down to y - 2.05 (22.25), below a reader's head, but within 0.2 of
// the stone: nothing there that the shaft does not already stand in.
const plate = (R, y, { lo = 1.5, hi = 0.75, W = 0.72 } = {}) => {
  const ya = y - lo, yb = y + hi;
  const half = (v) => W * Math.sqrt(Math.max(1 - (2 * v - 1) ** 2, 0));
  const vAt = (k, n) => (1 - Math.cos((Math.PI * k) / n)) / 2;     // close at the ends, where the oval turns
  const at = (u, v, lift) => onShaft(R, u * half(v), ya + (yb - ya) * v, lift);
  const nu = 14, nv = 32, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = vAt(j, nv);
    for (let i = 0; i <= nu; i++) {
      const u = -1 + (2 * i) / nu;
      pos.push(...at(u, v, 0.06 + 0.06 * (1 - u * u) * Math.sin(Math.PI * v) ** 0.5));
      uv.push(i / nu, v);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + nu + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const face = new THREE.BufferGeometry();
  face.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  face.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  face.setIndex(idx);
  face.computeVertexNormals();
  const edge = (sg, k, lift) => Array.from({ length: 31 }, (_, i) => at(sg * k, vAt(i, 30), lift));
  const tip = (yy, r) => new THREE.SphereGeometry(r, 12, 8).translate(R(yy) + 0.08, yy, 0);
  return [
    face,
    sweep(edge(-1, 1, 0.075), 0.055, 0.055, { segs: 48, radial: 8 }),
    sweep(edge(1, 1, 0.075), 0.055, 0.055, { segs: 48, radial: 8 }),
    sweep(edge(-1, 0.7, 0.13).slice(4, -4), 0.028, 0.028, { segs: 40, radial: 6 }),
    sweep(edge(1, 0.7, 0.13).slice(4, -4), 0.028, 0.028, { segs: 40, radial: 6 }),
    tip(ya, 0.075), tip(yb, 0.075),
    // a drop under it, as cast plates end
    lathe([[0, ya - 0.55], [0.05, ya - 0.48], [0.08, ya - 0.34], [0.05, ya - 0.2], [0.07, ya - 0.08], [0, ya]], 10, R(ya - 0.3) + 0.09),
    // where the bar and the brace come out of it
    bend(boss([[0, 0], [0.36, 0], [0.38, 0.06], [0.32, 0.14], [0.21, 0.22], [0.17, 0.34], [0, 0.34]], R(y + 0.12) + 0.1, y + 0.12), R, y + 0.12),
    bend(boss([[0, 0], [0.24, 0], [0.25, 0.05], [0.19, 0.12], [0.12, 0.18], [0, 0.18]], R(y - 1) + 0.1, y - 1), R, y - 1),
  ];
};

// The panes' radius at their foot and at their head: they flare a little.
const RB = 0.92, RT = 1.12;

// One lantern. `at`: the column's axis [x, z]; `ry`: the turn that carries the
// lantern's +x toward the room; `R(y)`: the shaft's radius at a height.
// Returns geometry already in the world: `bronze` for the bronze batch, `pane`
// an instance item for the globe material (lanternPaneGeometry), `wash` the
// light it lays on its own column, and where its halo hangs.
//
// Nothing stands out from the column below 23.3, and that only where the
// brace meets it: a reader's head is at FLOOR + 17 = 23. (The plate goes
// lower, flat on the stone.) `oldBand`: the band round the shaft instead.
export function pierLantern({ at, ry, R, oldBand = false }) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const world = (x, y, z = 0) => [at[0] + x * cs + z * sn, y, at[1] - x * sn + z * cs];
  const place = (g) => g.rotateY(ry).translate(at[0], 0, at[1]);
  const yg = 24.3, X = 5.2, y0 = 24.7, y1 = 27.7;
  const bronze = [];
  // the console: a bar out from the plate, an S-brace under it from low on
  // the plate, and a scroll hung in the corner between them
  bronze.push(...(oldBand ? girdle(R, yg, 0.8) : plate(R, yg)));
  bronze.push(sweep([[R(yg) + 0.25, yg + 0.12], [3.6, yg + 0.14], [4.6, yg + 0.16]], 0.15, 0.13, { segs: 8 }));
  bronze.push(sweep([[R(yg - 1) + 0.03, yg - 1.0], [2.6, yg - 0.95], [3.2, yg - 0.7], [3.8, yg - 0.3], [4.4, yg - 0.05], [4.85, yg + 0.02]], 0.1, 0.08));
  bronze.push(sweep(curl(2.62, yg - 0.38, 0.3, Math.PI * 0.5, Math.PI * 2.9), 0.07, 0.045, { segs: 50, radial: 8 }));
  // the base pan and the drop under it, the rings at the panes' foot and
  // head, a bar up every corner, the roof and its finial
  bronze.push(lathe([[0, y0 - 0.55], [0.14, y0 - 0.5], [0.4, y0 - 0.34], [0.78, y0 - 0.17], [1.04, y0 - 0.08], [1.08, y0], [1.0, y0 + 0.04]], 6, X, true));
  bronze.push(lathe([[0, y0 - 1.0], [0.1, y0 - 0.85], [0.12, y0 - 0.7], [0.08, y0 - 0.58], [0.16, y0 - 0.5]], 12, X));
  bronze.push(lathe([[RB - 0.06, y0 - 0.04], [RB + 0.08, y0 - 0.04], [RB + 0.08, y0 + 0.08], [RB - 0.06, y0 + 0.08]], 6, X, true));
  bronze.push(lathe([[RT - 0.06, y1 - 0.06], [RT + 0.1, y1 - 0.06], [RT + 0.1, y1 + 0.08], [RT - 0.06, y1 + 0.08]], 6, X, true));
  for (let k = 0; k < 6; k++) {
    const ph = (k * Math.PI) / 3, sx = Math.sin(ph), sz = Math.cos(ph);
    bronze.push(sweep([[X + sx * (RB + 0.02), y0, sz * (RB + 0.02)], [X + sx * (RT + 0.02), y1, sz * (RT + 0.02)]], 0.065, 0.065, { segs: 1, radial: 6 }));
  }
  bronze.push(lathe([[RT + 0.2, y1], [RT + 0.24, y1 + 0.1], [RT + 0.16, y1 + 0.2], [RT - 0.06, y1 + 0.34], [0.8, y1 + 0.58], [0.58, y1 + 0.88], [0.46, y1 + 1.18], [0.44, y1 + 1.33], [0.54, y1 + 1.43], [0.5, y1 + 1.53], [0.22, y1 + 1.65], [0, y1 + 1.68]], 6, X, true));
  bronze.push(lathe([[0, y1 + 1.62], [0.16, y1 + 1.7], [0.2, y1 + 1.84], [0.12, y1 + 2.0], [0.06, y1 + 2.16], [0.1, y1 + 2.26], [0, y1 + 2.48]], 12, X));
  const ym = (y0 + y1) / 2, mid = world(X, ym);

  // The light it lays on its own column: a scallop round the shaft's face,
  // taller than it is wide, centred a little over the panes' middle.
  const H = 15, th = (150 * Math.PI) / 180, washY = ym + 0.6;
  const wash = new THREE.CylinderGeometry(R(washY + H / 2) + 0.06, R(washY - H / 2) + 0.06, H, 28, 1, true, Math.PI / 2 - th / 2, th)
    .translate(0, washY, 0);

  return {
    bronze: bronze.map(place),
    pane: { p: mid, s: [1, (y1 - y0) / 2, 1], rot: [0, ry, 0], color: '#ffe8c8', k: 0.8 },
    wash: place(wash),
    halo: { p: [mid[0], mid[2]], y: ym },
  };
}

// The lantern's panes: a six-sided prism on the unit height (-1..1), wider at
// the top, for the globe material (its `position` is the glass's own frame).
// Its normals lean up above the middle and down below it, as if each pane
// bellied out a little: the globe material's hot spot is where the eye looks
// straight through, so the flame then shows at the middle of a pane, not as
// a stripe of light from top to bottom.
export const lanternPaneGeometry = () => {
  const g = new THREE.CylinderGeometry(RT, RB, 2, 6, 6, false);
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getY(i)) > 0.9) continue;   // (the caps, under the roof and the pan)
    v.set(n.getX(i), 0, n.getZ(i)).normalize();
    v.y = p.getY(i) * 0.7;
    v.normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
};
