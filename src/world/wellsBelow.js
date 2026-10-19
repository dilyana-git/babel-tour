// The galleries below (2026-10-16). Borges: the air shafts are "surrounded by
// very low railings, through which one can see, interminably, the floors
// above and below". The Silence's and the Vestibule's wells were a stone liner
// going down to a few stars, and from a stand a reader saw only its top
// courses: a hole showing nothing. Chosen from a canvas of five (A, the
// galleries below; lamps let down the well; a well of books; black water;
// pages on the draught): under each of the two, the same hexagon again, and
// again, each a little further into the dark, its own well opening onto the
// next.
//
// How. Each room's own triangles are lifted out of the world's batches (and
// its instances out of the instanced meshes) once, at assembly, and laid
// LEVELS times in one mesh per material. The vertices keep the room's own
// coordinates: only where they are DRAWN moves, `aBelow` storeys down, in the
// vertex shader after everything else has run. So every patch on every
// material (the light model, the room's colour, the lamps' flicker) shades a
// storey below exactly as it shades the room above, without a light more or a
// program rebuilt as the reader walks; each storey is darkened by DIM in the
// fragment shader. The materials are not copied but viewed (`Object.create`):
// a tint or a uniform changed on the room's own material is changed below.
//
// What is left out: the well's own liner and stars (the hole goes through),
// the shelved books' painted rows (their boxes go down instead, every storey:
// looked down on, a shelf of painted rows is a bare board), anything walking,
// the lit air, the mirrors' glass and every shader material. Nothing below is felt (body.js)
// or culled by distance: the storeys are drawn only while the eye is near
// their room (`show`), and hung in only once their shaders are ready
// (`attach`, from World.jsx), after the opening.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The wells that open onto the storeys below, by cell, and their shafts (shelves.js)
export const OPEN_WELLS = { '0,0': 48, '2,-2': 40 };
export const BELOW_STEP = 128;           // a storey: walls to 123, a gap of 5 under the floor above
const DIM = 0.62;                         // each storey's light, of the one above it's
const SKIP = /^(well|wellGlow|stars|liner|shafts|sky|dust|dustFan|shelvedRows|bridge-reader|distant-readers|finale|map-|doorway|mirror-glass|moonLand|below)/;
// (the room's own triangles: centroid within REACH of the well, and between
// the bridge's soffit and the tops of the walls). A storey under the first is
// only ever seen through the well of the one above it, so only its middle
// (FAR) is drawn; the carved and the seated, the costliest things in a room,
// only on the first, and the gilt frames on its walls not at all.
const REACH = 132, FAR = 80, Y0 = -40, Y1 = 124;
const FIRST_ONLY = /reader|balustradeShade/;
const NEAR_ONLY = /^(gilt|giltDeep)$/;

let ids = 0;
const viewed = new Map();
// The room's material, seen from below: its own in every respect but where the
// vertex lands and how much light reaches it.
const below = (mat) => {
  if (viewed.has(mat)) return viewed.get(mat);
  const m = Object.create(mat);
  Object.defineProperty(m, 'id', { value: 1e7 + ids++ });
  m.uuid = THREE.MathUtils.generateUUID();
  m._listeners = {};
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey.call(mat);
  // (at the very end of each main, after every other patch has had its say,
  // so it holds for three's own shaders and for the globes' alike)
  const last = (src, code) => { const i = src.lastIndexOf('}'); return `${src.slice(0, i)}${code}\n${src.slice(i)}`; };
  m.onBeforeCompile = function (sh, r) {
    base?.call(this, sh, r);
    sh.vertexShader = last(`attribute float aBelow;\nvarying float vBelow;\n${sh.vertexShader}`, `
      vBelow = aBelow;
      gl_Position -= projectionMatrix * (viewMatrix * vec4(0.0, aBelow * ${BELOW_STEP.toFixed(1)}, 0.0, 0.0));`);
    sh.fragmentShader = last(`varying float vBelow;\n${sh.fragmentShader}`, `
      gl_FragColor.rgb *= pow(${DIM.toFixed(3)}, vBelow);`);
  };
  m.customProgramCacheKey = () => `${key}|below`;
  viewed.set(mat, m);
  return m;
};

// The triangles of `geo` (world space through `matrix`) whose centroids lie in
// the room, as a non-indexed geometry with the same attributes; null if none.
const cut = (geo, matrix, c, reach) => {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  const pos = flat.attributes.position, n = pos.count;
  const p = new THREE.Vector3(), keep = [];
  const ident = matrix.equals(IDENT);
  for (let t = 0; t < n; t += 3) {
    let x = 0, y = 0, z = 0;
    for (let v = 0; v < 3; v++) {
      p.fromBufferAttribute(pos, t + v);
      if (!ident) p.applyMatrix4(matrix);
      x += p.x / 3; y += p.y / 3; z += p.z / 3;
    }
    if (y > Y0 && y < Y1 && Math.hypot(x - c[0], z - c[1]) < reach) keep.push(t);
  }
  if (!keep.length) { if (flat !== geo) flat.dispose(); return null; }
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(flat.attributes)) {
    const k = a.itemSize, src = a.isInterleavedBufferAttribute ? null : a.array;
    const arr = new (src ? src.constructor : Float32Array)(keep.length * 3 * k);
    let o = 0;
    for (const t of keep) {
      for (let v = 0; v < 3; v++) {
        for (let j = 0; j < k; j++) arr[o++] = a.getComponent(t + v, j);
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, k, a.normalized));
  }
  if (flat !== geo) flat.dispose();
  if (!ident) {
    out.applyMatrix4(matrix);
  }
  return out;
};
const IDENT = new THREE.Matrix4();
const signature = (geo) => Object.keys(geo.attributes).sort().map((k) => `${k}${geo.attributes[k].itemSize}`).join(',');

// Storey 1 from `near`, storeys 2…levels from `far` (either may be null),
// storey k at aBelow = k; bounded where it is drawn.
const storeys = (near, far, levels) => {
  const all = [];
  for (let k = 1; k <= levels; k++) {
    const src = k === 1 ? near : far;
    if (!src) continue;
    const g = src.clone();
    g.setAttribute('aBelow', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(k), 1));
    all.push(g);
  }
  if (!all.length) return null;
  const out = all.length > 1 ? mergeGeometries(all, false) : all[0];
  if (all.length > 1) all.forEach((g) => g.dispose());
  near?.dispose(); far?.dispose();
  out.computeBoundingBox();
  out.boundingBox.min.y -= BELOW_STEP * levels;
  out.boundingBox.max.y -= BELOW_STEP;
  out.boundingSphere = out.boundingBox.getBoundingSphere(new THREE.Sphere());
  return out;
};

// `wells`: [{ c: [x, z], shaft }]; returns `show(eye)`, to be called each frame.
// (a generator, pausing every few pieces so the assembly's drawing goes on)
export function* buildWellsBelow({ root, wells, levels = 3, keep = (x) => x }) {
  root.updateMatrixWorld(true);
  const sources = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || SKIP.test(o.name || '')) return;
    const m = o.material;
    // (three's own materials; of the shader materials only instanced ones,
    // which in a gallery are its lamps' globes)
    if (!m || Array.isArray(m) || !(m.isMeshStandardMaterial || m.isMeshBasicMaterial || (m.isShaderMaterial && o.isInstancedMesh))) return;
    if (o.geometry.morphAttributes?.position || o.geometry.groups.length > 1) return;
    sources.push(o);
  });
  const groups = [], hold = new THREE.Group();
  hold.name = 'below';
  for (const { c, shaft } of wells) {
    const group = new THREE.Group();
    group.name = 'below';
    group.visible = false;
    const lots = new Map();
    const box = new THREE.Box3(new THREE.Vector3(c[0] - REACH, Y0, c[1] - REACH), new THREE.Vector3(c[0] + REACH, Y1, c[1] + REACH));
    const seen = new THREE.Box3();
    let n = 0;
    for (const o of sources) {
      if (++n % 24 === 0) yield;
      if (o.isInstancedMesh) {
        const at = new THREE.Matrix4(), list = [];
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, at);
          at.premultiply(o.matrixWorld);
          const x = at.elements[12], y = at.elements[13], z = at.elements[14];
          if (!(y > Y0 && y < Y1)) continue;
          const d = Math.hypot(x - c[0], z - c[1]);
          if (d < REACH) list.push({ i, m: at.clone(), d, col: o.instanceColor ? new THREE.Color().fromBufferAttribute(o.instanceColor, i) : null });
        }
        const placed = [];
        for (let k = 1; k <= levels; k++) {
          const reach = k === 1 ? REACH : FAR;
          if (k > 1 && FIRST_ONLY.test(o.name)) break;
          for (const it of list) if (it.d < reach) placed.push({ ...it, k });
        }
        if (!placed.length) continue;
        const count = placed.length;
        const geo = o.geometry.clone();
        // (each instance's own attributes, a book's spine, title and dust,
        // taken with it: the source's are laid out by the source's instances)
        for (const [name, a] of Object.entries(geo.attributes)) {
          if (!a.isInstancedBufferAttribute) continue;
          const k = a.itemSize, arr = new a.array.constructor(count * k);
          placed.forEach((it, j) => { for (let q = 0; q < k; q++) arr[j * k + q] = a.getComponent(it.i, q); });
          geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, k, a.normalized));
        }
        const lift = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
        geo.setAttribute('aBelow', lift);
        const mesh = new THREE.InstancedMesh(keep(geo), keep(below(o.material)), count);
        placed.forEach((it, i) => {
          mesh.setMatrixAt(i, it.m);
          lift.setX(i, it.k);
          if (it.col) mesh.setColorAt(i, it.col);
        });
        mesh.computeBoundingSphere();
        const s = mesh.boundingSphere;
        s.center.y -= BELOW_STEP * (levels + 1) / 2;
        s.radius += BELOW_STEP * levels / 2;
        Object.assign(mesh, { name: 'below', castShadow: false, receiveShadow: o.receiveShadow, renderOrder: o.renderOrder, frustumCulled: o.frustumCulled });
        group.add(mesh);
        continue;
      }
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      seen.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      if (!seen.intersectsBox(box)) continue;
      const near = cut(o.geometry, o.matrixWorld, c, NEAR_ONLY.test(o.name) ? FAR : REACH);
      if (!near) continue;
      const far = levels > 1 && !FIRST_ONLY.test(o.name) ? cut(o.geometry, o.matrixWorld, c, FAR) : null;
      const k = `${o.material.id}|${signature(near)}|${o.renderOrder}|${o.receiveShadow}`;
      if (!lots.has(k)) lots.set(k, { o, near: [], far: [] });
      lots.get(k).near.push(near);
      if (far) lots.get(k).far.push(far);
    }
    const join = (parts) => {
      if (!parts.length) return null;
      if (parts.length === 1) return parts[0];
      const one = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      return one;
    };
    for (const { o, near, far } of lots.values()) {
      const geo = storeys(join(near), join(far), levels);
      if (!geo) continue;
      const mesh = new THREE.Mesh(keep(geo), keep(below(o.material)));
      Object.assign(mesh, { name: 'below', castShadow: false, receiveShadow: o.receiveShadow, renderOrder: o.renderOrder });
      group.add(mesh);
    }
    // the dark under the last storey's well
    const pit = new THREE.Mesh(keep(new THREE.CircleGeometry(shaft + 1, 6).rotateX(-Math.PI / 2)),
      keep(new THREE.MeshBasicMaterial({ color: '#000000' })));
    pit.position.set(c[0], 6 - BELOW_STEP * levels - 1, c[1]);
    pit.name = 'below';
    group.add(pit);
    hold.add(group);
    groups.push({ group, c });
  }
  // Drawn only while the eye is within reach of the room (from above, never).
  const NEAR = 190;
  const show = (eye) => {
    for (const { group, c } of groups) group.visible = !!eye && Math.hypot(eye.x - c[0], eye.z - c[1]) < NEAR && eye.y < 140;
  };
  // (not in the world until `attach`: World.jsx compiles and sends them once
  // the world is up, so the opening does not wait on a few dozen programs)
  return { root: hold, show, attach: () => root.add(hold) };
}
