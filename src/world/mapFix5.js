// What the design board on the map (2026-10-12) marked, where it is in the
// world:
// 1  the Echo was the coldest, brightest cell: its wall tops read as wide
//    pale blue-grey slabs with a checker of two tones on them, a different
//    material library beside the warm Vestibule. Two things made it. The
//    Echo's carved stone (libFix3.js, 4; stoneShade's `worked`) reached
//    out over its coping — the paving's blocks toned one by one, their joints
//    darkened, the faces that look up paled and polished, so the sky lay in
//    them — and the warm bounce on the rims of the walk's rooms (mapFix.js,
//    8) was measured from a standard room's inner wall, so on the Echo's
//    wider rim most of its coping was out past the warm. Now the worked
//    stone stops under the wall tops, and the rim's warmth starts at each
//    room's own inner wall: the same stone as the other cells' wall tops, at
//    the same value.
//
// ?wmap5=old puts it back as it was; ?wmap5=old:1 only that point.
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const V = Q.get('wmap5');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map((s) => s.trim())) : null;
export const map5Old = (n) => V === 'old' || (ONLY ? ONLY.has(String(n)) : false);
