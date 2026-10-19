// Picking keeps the instance number: the spine under the hand is the volume
// opened, even when its neighbours share one mesh and one material.
import * as THREE from 'three';
import { EYE } from './body.js';

const SLUGS = ['vestibule', 'echo', 'silence', 'vertigo', 'door'];
export const bookOf = (item) => ({ ...item.read, slug: SLUGS[item.read.room],
  id: `${item.read.room}:${item.p.join(',')}` });

// Every edge is walked by the same body probes as W. The aisle nodes allow a
// walk round a well; a blocked shelf never becomes a cut through its railing.
export function shelfRoute(feel, from, to, outline) {
  if (feel.clear(from, to)) return [from.clone(), to.clone()];
  const cx = outline.reduce((n, p) => n + p[0], 0) / outline.length;
  const cz = outline.reduce((n, p) => n + p[2], 0) / outline.length;
  const nodes = [from.clone(), to.clone()];
  for (const scale of [0.65, 0.82]) {
    for (let i = 0; i < outline.length; i += Math.max(1, Math.floor(outline.length / 12))) {
      for (const u of [0, 0.5]) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        const p = new THREE.Vector3(cx + (a[0] + (b[0] - a[0]) * u - cx) * scale, from.y + EYE, cz + (a[2] + (b[2] - a[2]) * u - cz) * scale);
        const y = feel.floorUnder(p);
        if (y === null || Math.abs(y - from.y) > 5.5) continue;
        p.y = y;
        nodes.push(p);
      }
    }
  }
  const distance = nodes.map(() => Infinity), previous = [], visited = new Set();
  distance[0] = 0;
  for (;;) {
    let i = -1;
    for (let k = 0; k < nodes.length; k++) if (!visited.has(k) && (i < 0 || distance[k] < distance[i])) i = k;
    if (i < 0 || !Number.isFinite(distance[i])) return null;
    if (i === 1) {
      const path = [];
      for (let k = 1; k !== undefined; k = previous[k]) path.unshift(nodes[k]);
      return path;
    }
    visited.add(i);
    for (let j = 1; j < nodes.length; j++) {
      const cost = distance[i] + nodes[i].distanceTo(nodes[j]);
      if (visited.has(j) || cost >= distance[j] || !feel.clear(nodes[i], nodes[j])) continue;
      distance[j] = cost;
      previous[j] = i;
    }
  }
}

export function makeShelfHand(root, feel) {
  const meshes = root.children.filter((o) => o.name === 'shelvedBooks' && o.userData.books);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), colour = new THREE.Color();
  const warm = new THREE.Color('#d5a060');
  const warming = new Map();
  let hot = null;
  const visible = (mesh) => {
    for (let o = mesh; o; o = o.parent) if (!o.visible) return false;
    return true;
  };
  return {
    pick(camera, x, y, bounds, room) {
      ndc.set((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2);
      ray.setFromCamera(ndc, camera);
      ray.far = 150;
      const candidates = meshes.filter((m) => visible(m) && m.userData.books[0]?.read?.room === room);
      const hit = ray.intersectObjects(candidates, false)[0];
      if (!hit || !feel.sight(camera.position, hit.point, 0.2)) return null;
      const item = hit.object.userData.books[hit.instanceId], read = item?.read;
      if (!read?.inward || !SLUGS[read.room]) return null;
      const at = new THREE.Vector3(...item.p);
      const end = new THREE.Vector3(at.x + read.inward[0] * 15, camera.position.y, at.z + read.inward[1] * 15);
      const floor = feel.floorUnder(end);
      if (floor === null || Math.abs(at.y - floor - 12) > 12) return null;
      end.y = floor;
      return { mesh: hit.object, instance: hit.instanceId, item, at, end, key: `${hit.object.id}:${hit.instanceId}` };
    },
    hover(next) {
      hot = next?.key ?? null;
      if (next && !warming.has(hot)) {
        const base = new THREE.Color();
        next.mesh.getColorAt(next.instance, base);
        warming.set(hot, { ...next, base, amount: 0 });
      }
    },
    tick(dt) {
      for (const [key, b] of warming) {
        const target = key === hot ? 1 : 0;
        b.amount += (target - b.amount) * (1 - Math.exp(-dt * 12));
        if (!target && b.amount < 0.002) { b.amount = 0; warming.delete(key); }
        colour.copy(b.base).lerp(warm, b.amount * 0.25).multiplyScalar(1 + b.amount * 0.3);
        b.mesh.setColorAt(b.instance, colour);
        b.mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      for (const b of warming.values()) { b.mesh.setColorAt(b.instance, b.base); b.mesh.instanceColor.needsUpdate = true; }
      warming.clear();
    },
  };
}
