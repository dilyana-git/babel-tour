// The brass fillet round each Library floor (1) and ivy on the wall tops (2).
// ?waudit=old restores both earlier details; old:n selects either one.
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('waudit');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const auditOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);

// 1. The fillet: [outer, inner] radius off the room's rim (it was 72.9, 72.1),
// how far proud of the floor, and the brass it is made of.
export const FILLET = { outer: 72.95, inner: 71.85, proud: 0.16 };
export const FILLET_BRASS = { color: '#6b5634', roughness: 0.72, metalness: 0.35 };
