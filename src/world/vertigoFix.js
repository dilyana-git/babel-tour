// The Vertigo's arrival frame, reviewed 2026-10-09 (the numbered points on the
// review board): 1 the stand turned in toward the well and looking further
// down, so the first frame is half books, half drop, and the drop is what the
// room is named for; 4 the well lit from below — the light at the bottom
// climbing the funnel warm, and the shelves going dark as they rise — instead
// of evenly from edge to edge; 2 the near bindings' tooling varied, compartment
// by compartment (a gilt "+" in every panel of every volume read as a grid of
// plus signs), and a few books gone from the near shelves, their neighbours
// leaning into the room they left; 3 a moulded walnut lip on the front of
// every shelf, darker than the boards, where the bare board fronts were pale
// flat strips like plywood. (8, the near books too big and soft, went with 1
// and 2: the turn puts the near wall at the frame's edge and the tooling no
// longer repeats; 7, the copy, is kept — the frame now shows what it says.)
//
// ?wvfix=old puts all of them back as they were; ?wvfix=old:2,4 only those.
import * as THREE from 'three';

const Q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const V = Q.get('wvfix');
const ONLY = V && V.startsWith('old:') ? new Set(V.slice(4).split(',').map(Number)) : null;
export const vertigoOld = (n) => V === 'old' || (ONLY ? ONLY.has(n) : false);
const qn = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);

// 1. The stand's look: from the stair's tangent (where it looked, down the
// next treads into the wall of books) turned in toward the well by STAND_TURN
// degrees, and pitched down to STAND_PITCH. Turned further or pitched lower and
// the look is the one World.jsx reads as a reader leaning out over the gap
// (railIntent: gaze more than 33° down and within 45° of the well's middle),
// and the arrival would tip them over; at 25° the well's middle is still 47°
// off the gaze.
export const STAND_TURN = qn('wvyaw', 25);
export const STAND_PITCH = qn('wvpitch', -29);

// 4. The well's light, graded by height. What the lamps (and the room's fill)
// give a surface is taken down as it rises, from all of it at WELL.dark0 to
// WELL.top of it at WELL.dark1 (over the floor) — and the light at the bottom
// is laid on warm from below, coming in from WELL.warmFrom (the floor) to full
// by WELL.warmTo, from the throat:
// wrapped round, so the faces turned up the well and in to its middle take it
// most. Inside the Vertigo's drum only (WELL.r round the pit, out to the wall
// behind its books), in every standard material, as lightModel.js changes the
// lamps' falloff: patched into three's chunks once, here, on import, before
// anything has compiled.
export const WELL = {
  // the pit's middle (buildWorld's PIT, cellC(3, -3): checked against it there)
  c: (() => { const D = 100 * Math.sqrt(3) + 50; return [232 + 3 * D * Math.cos(Math.PI / 6), 785 + 3 * D * 0.5 - 3 * D]; })(),
  r: 104, edge: 8,
  top: qn('wvtop', 0.5), dark0: qn('wvd0', -200), dark1: qn('wvd1', 80),
  warm: qn('wvwarm', 70), warmFrom: qn('wvwf', 0), warmTo: qn('wvwt', -260), warmPow: qn('wvwp', 1.6), throat: -440,
};
const f = (x) => (Number.isInteger(x) ? `${x}.0` : `${x}`);
if (!vertigoOld(4) && !THREE.ShaderChunk.lights_fragment_end.includes('wellGrade')) {
  THREE.ShaderChunk.lights_fragment_end += `
#ifdef STANDARD
	{
		// (the Vertigo's well: vertigoFix.js, 4)
		vec3 wellP = cameraPosition + transpose( mat3( viewMatrix ) ) * ( - vViewPosition );
		float wellIn = 1.0 - smoothstep( ${f(WELL.r)}, ${f(WELL.r + WELL.edge)}, length( wellP.xz - vec2( ${f(WELL.c[0])}, ${f(WELL.c[1])} ) ) );
		if ( wellIn > 0.0 ) {
			float wellGrade = mix( 1.0, mix( 1.0, ${f(WELL.top)}, smoothstep( ${f(WELL.dark0)}, ${f(WELL.dark1)}, wellP.y ) ), wellIn );
			reflectedLight.directDiffuse *= wellGrade;
			reflectedLight.directSpecular *= wellGrade;
			reflectedLight.indirectDiffuse *= wellGrade;
			reflectedLight.indirectSpecular *= wellGrade;
			vec3 wellN = normalize( transpose( mat3( viewMatrix ) ) * geometryNormal );
			vec3 wellL = normalize( vec3( ${f(WELL.c[0])}, ${f(WELL.throat)}, ${f(WELL.c[1])} ) - wellP );
			float wellNL = saturate( ( dot( wellN, wellL ) + 0.55 ) / 1.55 );
			float wellUp = pow( smoothstep( ${f(WELL.warmFrom)}, ${f(WELL.warmTo)}, wellP.y ), ${f(WELL.warmPow)} ) * wellIn;
			reflectedLight.indirectDiffuse += ${f(WELL.warm)} * wellUp * wellNL * vec3( 1.0, 0.55, 0.25 ) * BRDF_Lambert( material.diffuseContribution );
		}
	}
#endif
`;
}

// 3. The lip on a shelf's front: a walnut nosing a little proud of the board,
// standing a fraction over its top (the edge that keeps a book from walking
// off), rounded over to the front and chamfered under. A profile in (out from
// the board's front toward the well — negative — and height), swept round the
// ring of the shelf from bearing a0 to a1 (degrees) at radius `r` (the board's
// front) round `c`. Each face of the profile its own strip, so the light
// breaks at the arrises and rounds over the nosing.
export function shelfLip(c, r, top, bottom, a0, a1, step = 2.25) {
  const prof = [
    [0.05, top + 0.16], [-0.16, top + 0.16], [-0.3, top + 0.08], [-0.38, top - 0.06],
    [-0.4, top - 0.2], [-0.4, bottom + 0.14], [-0.3, bottom], [0.05, bottom],
  ];
  const n = Math.max(2, Math.ceil((a1 - a0) / step));
  // each face's normal in (radial, up), turned from its run: facing the well
  const faceN = prof.slice(0, -1).map(([d0, y0], e) => {
    const [d1, y1] = prof[e + 1], L = Math.hypot(d1 - d0, y1 - y0) || 1;
    return [(y1 - y0) / L, -(d1 - d0) / L];
  });
  // (rounded over from the top to the front: the joints from 1 to 4 shared)
  const normalAt = (e, k) => {
    if (k < 1 || k > 4) return faceN[e];
    const [p, q] = [faceN[k - 1], faceN[k]], m = Math.hypot(p[0] + q[0], p[1] + q[1]) || 1;
    return [(p[0] + q[0]) / m, (p[1] + q[1]) / m];
  };
  const pos = [], nor = [], uv = [], idx = [];
  let base = 0;
  for (let e = 0; e < prof.length - 1; e++) {
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180, ux = Math.cos(a), uz = Math.sin(a);
      const s = (a - (a0 * Math.PI) / 180) * r;
      for (const k of [e, e + 1]) {
        const [d, y] = prof[k], [mr, my] = normalAt(e, k);
        pos.push(c[0] + ux * (r + d), y, c[1] + uz * (r + d));
        nor.push(ux * mr, my, uz * mr);
        uv.push(s / 13, (y - bottom) / 13);
      }
    }
    for (let i = 0; i < n; i++) {
      const k = base + i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    base += (n + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
export const LIP_COLOR = Q.get('wvlip') ? `#${Q.get('wvlip')}` : '#5e4636';

// 2. Books gone from the shelves: where bookHash (of where the book would
// stand) is under MISSING it is not shelved, and the next leans into the gap —
// wherever the Vertigo's books are boxes (shelveRing). Dials for 4 and 1:
// ?wvtop ?wvd0 ?wvd1 ?wvwarm ?wvwf ?wvwt ?wvwp, ?wvyaw ?wvpitch; ?wvlip=hex.
export const MISSING = 0.05;
export const bookHash = (a, y) => Math.abs(Math.sin(a * 12.9898 + y * 78.233) * 43758.5453) % 1;
