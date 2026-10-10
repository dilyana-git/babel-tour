// The Vestibule's arrival frame, reviewed 2026-10-08 (the numbered points on
// the review board): 1 no reader cut by the frame's edge on arrival, 2 readers
// lit as cloth and not cut-outs, 3 the haze through the arch halved, 4 the
// pier glasses' silvering aged, 5 the ashlar coursed finer and the arches
// ringed with voussoirs, 6 the bridge lamps' halo turned down, 7 a warm glow
// rising out of the well.
//
// ?wvest=old puts all seven back as they were; ?wvest=old:3,6 only those.
const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('wvest') : null;
const ONLY = Q && Q.startsWith('old:') ? new Set(Q.slice(4).split(',').map(Number)) : null;
export const vestOld = (n) => Q === 'old' || (ONLY ? ONLY.has(n) : false);
