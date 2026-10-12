// Design audit II (2026-10-09), in the world: the brass fillet round each
// Library floor (1), the ivy mats on the wall tops (2), the Silence's dead
// globes (3).
// What each point was, and why: docs/design-history.md.
//
// ?waudit=old puts all of them back as they were; ?waudit=old:2,3 only those.
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('waudit');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const auditOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);

// 1. The fillet: [outer, inner] radius off the room's rim (it was 72.9, 72.1),
// how far proud of the floor, and the brass it is made of.
export const FILLET = { outer: 72.95, inner: 71.85, proud: 0.16 };
export const FILLET_BRASS = { color: '#6b5634', roughness: 0.72, metalness: 0.35 };

// 3. The dead glass: what deadGlassPatch (silenceFix.js) is given to soot.
export function deadOpal(mat) {
  if (auditOld(3)) return mat;
  mat.color.set('#857d70');
  mat.roughness = 0.62;
  mat.envMapIntensity = 0.1;
  return mat;
}
