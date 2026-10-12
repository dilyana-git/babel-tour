// The Vestibule's arrival frame, reviewed 2026-10-08: readers on arrival, the
// haze through the arch, the pier glasses, the ashlar and voussoirs, the
// bridge lamps' halo, the glow out of the well.
// What each point was, and why: docs/design-history.md.
//
// ?wvest=old puts all seven back as they were; ?wvest=old:3,6 only those.
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('wvest') : null;
const ONLY = Q && Q.startsWith('old:') ? new Set(Q.slice(4).split(',').map(Number)) : null;
export const vestOld = (n) => Q === 'old' || (ONLY ? ONLY.has(n) : false);
