// What design audit II (2026-10-09) marked FIX, in the world itself — the
// numbered points:
// 1 the brass fillet round each Library floor, on the inner edge of the dark
//   band at the foot of the cases, read from every stand as a lit seam: 0.8
//   wide, polished (metal 0.7, rough 0.4), narrower than a pixel at the
//   distance the stands see it from, and it caught each lamp as a hot thread
//   (the Door's "glowing line along the floor" at the right-hand case). It is
//   antique brass now, dull, a little wider, so it reads as a line laid in
//   the stone and not as light coming through it.
// 2 the ivy "where the honeycomb meets the garden" was mats — flat leaf
//   cards, 56–90 long, laid along the wall tops — and from the Web of Time's
//   stand, over the cedars, they printed as a row of dark green discs on the
//   Library's coping (the same blob mats that hung over the pergola as green
//   balls). They are not laid any more; their draws are still spent.
// 3 the Silence's dead globes were a dark bronze-brown, glossy low on the
//   bowl: the one hung in the stand's frame read as a polished iron ball. A
//   lamp gone out is opal glass that has gone grey — pale under its soot,
//   matt, holding no pin of light.
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
