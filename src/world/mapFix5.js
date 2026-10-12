// The map (2026-10-12): the Echo's wall tops the same stone, at the same
// value, as every other cell's (1).
// What each point was, and why: docs/design-history.md.
//
// ?wmap5=old puts it back as it was; ?wmap5=old:1 only that point.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const V = Q.get('wmap5');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map((s) => s.trim())) : null;
export const map5Old = (n) => V === 'old' || (ONLY ? ONLY.has(String(n)) : false);
