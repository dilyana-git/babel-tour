// ── How close the walk passes to the stone ───────────────────────────────────
// DEV only (World.jsx hangs it on window.__worldProbe and window.__worldSweep),
// and the answer to a question a screenshot cannot settle: when the walk "feels
// like moving through walls", WHICH wall, and by how much?
//
// It stands where the camera stands and feels outward in a fan of rays. For
// each it takes the first solid face:
//   · how far, and what it belongs to (the batch names of buildWorld.js)
//   · whether that face is turned AWAY from the eye, which on closed geometry
//     means the eye is already inside the thing
// Lit air, halos, stars, pools and the veil are not solids and are skipped —
// they are meant to be walked through. Nor are the instanced fields (books,
// chain links, balusters, dust): a book is only ever as deep as the shelf that
// holds it, and its wall is in the batches already.
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

// A reader is 18 units tall, so 1 unit ≈ 9.4 cm: a shoulder wants ~4 units.
export const SHOULDER = 4;

const solid = (o) => {
  if (!o.isMesh || o.isInstancedMesh || !o.visible) return false;
  if (['doorway', 'stars', 'sky'].includes(o.name)) return false;
  const m = o.material;
  if (!m || Array.isArray(m)) return false;
  if (m.blending === THREE.AdditiveBlending) return false;   // lit air, glows, stars
  if (m.side === THREE.BackSide) return false;               // shaft liners, the sky
  if (m.transparent && !m.alphaTest && m.opacity < 0.9) return false; // pools, water, the veil
  return true;
};

const fan = (() => {
  const dirs = [];
  for (const lift of [0, 0.42, -0.42]) {
    const n = lift === 0 ? 16 : 8;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      dirs.push({
        v: new THREE.Vector3(Math.cos(a) * Math.cos(lift), Math.sin(lift), Math.sin(a) * Math.cos(lift)),
        deg: Math.round((a * 180) / Math.PI),
        lift: Math.round((lift * 180) / Math.PI),
      });
    }
  }
  return dirs;
})();

const ray = new THREE.Raycaster();
const normal = new THREE.Vector3();
const sphere = new THREE.Sphere();
const geometries = new WeakMap();
const meshes = new WeakMap();

// Private probe proxies accelerate the exact same triangles without changing
// rendered vertices, indices, mesh raycast methods, or the collision policy.
const probeMesh = (object) => {
  if (object.isSkinnedMesh || object.isBatchedMesh || object.geometry.morphAttributes.position?.length) return object;
  const source = object.geometry;
  let cached = geometries.get(source);
  if (!cached || cached.positionVersion !== source.attributes.position.version || cached.indexVersion !== source.index?.version) {
    const geometry = Object.create(source);
    geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
    cached = { geometry, positionVersion: source.attributes.position.version, indexVersion: source.index?.version };
    geometries.set(source, cached);
  }
  let mesh = meshes.get(object);
  if (!mesh || mesh.geometry !== cached.geometry) {
    mesh = new THREE.Mesh(cached.geometry, object.material);
    mesh.raycast = acceleratedRaycast;
    meshes.set(object, mesh);
  }
  mesh.matrixWorld.copy(object.matrixWorld);
  mesh.material = object.material;
  mesh.name = object.name;
  mesh.layers.mask = object.layers.mask;
  return mesh;
};

// Three tests a mesh's bounding sphere before its triangles but ignores
// ray.far doing it, so a chunk half the Library away is still walked triangle
// by triangle. Nothing past `reach` can be in the way: drop it here instead.
const nearby = (scene, eye, reach) => {
  const out = [];
  scene.traverse((o) => {
    if (!solid(o)) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
    if (sphere.center.distanceTo(eye) - sphere.radius < reach) out.push(probeMesh(o));
  });
  return out;
};

// Every solid face along one ray, in order: the section a walk cuts through.
export function probeRay(scene, from, dir, far = 400) {
  const eye = new THREE.Vector3(...from);
  const v = new THREE.Vector3(...dir).normalize();
  ray.near = 0;
  ray.far = far;
  ray.firstHitOnly = false;
  ray.set(eye, v);
  return ray.intersectObjects(nearby(scene, eye, far), false).map((hit) => ({
    d: +hit.distance.toFixed(3),
    what: hit.object.name || 'unnamed',
    facing: hit.face ? +normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).dot(v).toFixed(2) : null,
  }));
}

// `reach`: how far to bother looking. Anything past it is not in the way.
export function probeClearance(scene, eye, reach = 30) {
  const meshes = nearby(scene, eye, reach);
  ray.near = 0;
  ray.far = reach;
  ray.firstHitOnly = true;
  let nearest = null;
  let inside = 0;
  const touching = new Map();
  for (const d of fan) {
    ray.set(eye, d.v);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) continue;
    const back = hit.face
      ? normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).dot(d.v) > 0
      : false;
    if (back) inside += 1;
    const what = hit.object.name || 'unnamed';
    if (!touching.has(what) || touching.get(what).d > hit.distance) {
      touching.set(what, { d: +hit.distance.toFixed(2), deg: d.deg, lift: d.lift, back });
    }
    if (!nearest || hit.distance < nearest.d) {
      nearest = { d: +hit.distance.toFixed(2), what, deg: d.deg, lift: d.lift, back };
    }
  }
  return {
    eye: [+eye.x.toFixed(1), +eye.y.toFixed(1), +eye.z.toFixed(1)],
    nearest,
    // The share of the fan that meets a face turned away: 1 is buried.
    inside: +(inside / fan.length).toFixed(2),
    touching: Object.fromEntries([...touching].filter(([, t]) => t.d < reach)),
  };
}
