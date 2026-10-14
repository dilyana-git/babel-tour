// II — the Echo (buildWorld.js, assembleWorld): the round room, its two
// flights and the crossing over its middle.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pierLantern, lanternPaneGeometry } from '../sconce';
import { shaftVolume, makeShaftMaterial } from '../effects';
import { echoOld, moonBeamPatch } from '../echoFix';
import { deg } from '../build/common';

export function buildEcho(ctx) {
  const { dir, add, dist, hexPts, circlePts, keep, radialTex, gilt, lampHaloTex, M, root, slabGeo,
    placed, profileGeo, flatQuad, instances, halo, Q, qNum, R, cellC, ECHO_R, ECHO_ONE_FACE,
    flightProfile, flightDress, LB, posts, globes, lamp } = ctx;
  // II — the Echo: two flights crossing over the shaft, a colonnade answering itself.
  //
  // The Echo's flights are cut on a tread of 7, not 8. At 8 each one runs 144
  // long, and its feet come down at 72 from the middle of the room: in the
  // corners, a stride from the bookcases, so the reader steps onto the stair
  // out of the shelves with the case at their back — "too little space when
  // ascending". At 7 every foot stands 9 further in, with the floor clear in
  // front of it (the parapet's corner 16 from the case, not 8), and the crown
  // is where 8 puts it: only the going is shorter, not the rise. ?wecho=old
  // cuts them on 8; ?wechorun dials it.
  const ECHO_FLIGHT = { run: qNum('wechorun', Q.get('wecho') === 'old' ? 8 : 7) };
  // Keep the arcade and the walk on the same ring. Six units outward gives
  // the column bases about 23 cm clear of the stair coping (formerly 9 cm),
  // while leaving about a metre between their plinths and the bookcases.
  const ECHO_RING = qNum('wechoring', 62);
  {
    const c = cellC(1, -1);
    // Each flight is ONE piece of stone: a stepped top, and under it the arc
    // that carries it over the shaft — springing off the floor at the well's
    // lip, thinnest at the crown. (As 36 separate slabs hung in the air with a
    // gap under every one, it reads as a stack of packing crates: a room built
    // out of cardboard.) A real arch under each flight, springing wide of the
    // well: end-on, a flight is a wall across half the room, and the opening
    // under it is what makes it a bridge instead.
    //
    // The crown both flights share is where the rose is laid (see the
    // crossing), so its two treads are not worn: the rose is what the feet have
    // worn there. ?wrose=old is the old rose.
    const ROSE_OLD = Q.get('wrose') === 'old';
    const echoF = flightProfile(ECHO_FLIGHT);
    const CROWN_Y = Math.max(...echoF.top.map(([, h]) => h));
    const ROSE_R = 6.9;
    const notCrown = (k) => echoF.stepTop(k) < CROWN_Y;
    const CROSS_OLD = Q.get('wcross') === 'old';
    for (const ang of [0, 60]) {
      const f = flightProfile(ECHO_FLIGHT);
      LB.step.add(profileGeo(f.pts, 15, c, ang));
      // The two flights cross at the crown, so each one's balustrade stops a
      // little short of where the other's deck arrives: the landing is open on
      // all four sides, which is the only way "stairs cross stairs" can be
      // something a reader does rather than something they look at. Each
      // flank opens only as far as the other deck really comes in over it, and
      // the balustrades meet at the four corners on one newel (`cross`; the
      // flight at 0 sets the newels). ?wcross=old is one span of ±15 for both
      // flanks, with each flight's flank standing up out of the other's treads.
      // (The keystones stop under the deck, as the Silence's do under its
      // terrace: standing up through the crown they crossed as a raised X of
      // stone under the rose, and the rose had to float over them.)
      // (the lips paler, the risers' shade lighter and a string up both
      // flanks: echoFix.js, 2)
      const VALUES = echoOld(2) ? {} : { nosing: LB.nosing, riser: LB.riserSoft, string: true };
      flightDress(c, ang, f, 7.9, CROSS_OLD
        ? { gap: [-15, 15], worn: ROSE_OLD || notCrown, keyThrough: ROSE_OLD, plane: ECHO_ONE_FACE, face: ECHO_ONE_FACE ? LB.flank : LB.cap, ...VALUES }
        // (the other flight is cut on the same profile as this one)
        : { cross: { c, ang: 60 - ang, f, half: 7.5 }, gapNewels: ang === 0, worn: ROSE_OLD || notCrown, keyThrough: ROSE_OLD, plane: ECHO_ONE_FACE, face: ECHO_ONE_FACE ? LB.flank : LB.cap, ...VALUES });
    }
    // ── The crossing ─────────────────────────────────────────────────────
    // The one piece of floor in this room a reader is ever brought to a stop on
    // (VANTAGES), and without the rose it is two staircases overlapping. An
    // inlaid rose makes it a place: six points for the six ways out of a
    // hexagon, two of which are the flights under your feet. Kept inside 7.1,
    // which is where the flanks of both flights stand: a wider ring runs into
    // them at four bearings and reads as a broken circle (and past 8.66 the
    // landing is air — beyond that radius neither flight is under it).
    //
    // An inlay is LEVEL with what it is let into, and told from it by colour
    // and sheen, never by height: hoops and spokes of brass standing proud of
    // the crown read from the stair as a cartwheel left lying on the bridge.
    // And a rose is points, not spokes: shapes with an area, each lit on one
    // half and shaded on the other, so that they read as facets in a floor that
    // is flat. So: a roundel of the dark polished Purbeck (the Door's shafts)
    // let into the crown; a twelve-point star of brass and pale stone on it,
    // with a brass dial round the star; a ring with a sentence of the Library's
    // cut in gilt between that and the rim; and at the middle, rubbed bright, a
    // hexagon — "the Library is a sphere whose exact center is any one of its
    // hexagons", and this is the one the reader is standing in.
    //
    // Each piece is a few hundredths proud of what it lies on: enough to keep
    // the two surfaces out of each other's depth (see the well rings), too
    // little for the eye or a foot to find. No two pieces at one height
    // overlap.
    if (!ROSE_OLD) {
      const Y = CROWN_Y;
      const FIELD = Y + 0.06, METAL = Y + 0.1, HEX_IN = Y + 0.13, HEX = Y + 0.16;
      const at = (a, r) => add(c, dir(a), r);
      const piece = (batch, pts) => batch.add(slabGeo(pts, [], METAL - (FIELD - 0.03), FIELD - 0.03));
      // (the marble's figure finer than on the Door's shafts: at their size the
      // shell in it reads as terrazzo from the stair)
      const marble = (g) => {
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
        return LB.marble.add(g);
      };
      marble(slabGeo(circlePts(c, ROSE_R, 96), [], FIELD - (Y - 0.3), Y - 0.3));
      const ring = (r0, r1) => LB.inlay.add(slabGeo(circlePts(c, r1, 96), [circlePts(c, r0, 96)], METAL - FIELD + 0.03, FIELD - 0.03));
      ring(6.55, 6.82);
      ring(5.46, 5.6);
      // The star. The six great points run out to the ring, along the
      // flights and the four other ways out; the six between them stop short,
      // and twelve small ones stand in the angles. Every point is halved down
      // its length, the half the rose turns towards lit and the other shaded,
      // all the same way round: that is what makes a flat star read as cut.
      const V = 1.2;
      for (let k = 0; k < 12; k++) {
        const a = 30 * k, great = k % 2 === 0, tip = at(a, great ? 5.44 : 3.6);
        piece(great ? LB.inlay : LB.stone, [c, at(a + 15, V), tip]);
        piece(great ? LB.bronzeDim : LB.capShade, [c, tip, at(a - 15, V)]);
        const b = a + 15;
        piece(LB.inlay, [at(b, 1.45), at(b + 3.5, 1.85), at(b, 2.7)]);
        piece(LB.bronzeDim, [at(b, 1.45), at(b, 2.7), at(b - 3.5, 1.85)]);
      }
      // the dial: a tick to every seven and a half degrees, longer at the
      // small points' bearings, and none where a great point meets the ring
      for (let k = 0; k < 48; k++) {
        if (k % 8 === 0) continue;
        const a = 7.5 * k, r0 = k % 4 === 0 ? 4.75 : k % 2 === 0 ? 4.98 : 5.14, w = dir(a + 90);
        piece(LB.inlay, [add(at(a, r0), w, -0.045), add(at(a, 5.38), w, -0.045), add(at(a, 5.38), w, 0.045), add(at(a, r0), w, 0.045)]);
      }
      // the hexagon at the middle: worn brass, with the marble for its floor
      LB.bronzeWorn.add(slabGeo(hexPts(c, 1.05), [hexPts(c, 0.62)], HEX - (METAL - 0.03), METAL - 0.03));
      marble(slabGeo(hexPts(c, 0.6), [], HEX_IN - (METAL - 0.03), METAL - 0.03));
      // The sentence round the rim, gilt cut in the marble. Read from the
      // middle of the rose, a letter's head to the rim, so it reads for the
      // one reader who stops here; its two ends meet behind that reader, at
      // a small hexagon, and the middle of it lies in front of them, along
      // the far flight (the vantage looks out along 60 degrees).
      const TEXT = 'THE LIBRARY IS A SPHERE WHOSE EXACT CENTER IS ANY ONE OF ITS HEXAGONS';
      const BAND = 6.075, SEAM = 240, track = 0.14, space = 0.5;
      const span = [...TEXT].reduce((w, ch) => w + (ch === ' ' ? space : gilt.glyphs[ch].adv + track), -track);
      const cap = Math.min(0.54, (2 * Math.PI * BAND - 1.3) / span);
      piece(LB.bronzeWorn, hexPts(at(SEAM, BAND), 0.2));
      let s = -span / 2;
      for (const ch of TEXT) {
        if (ch === ' ') { s += space; continue; }
        const G = gilt.glyphs[ch];
        const a = (SEAM + 180) * deg + ((s + G.adv / 2) * cap) / BAND;
        const g = new THREE.PlaneGeometry(gilt.cellW * cap, gilt.cellH * cap);
        const uv = g.attributes.uv;
        for (let v = 0; v < uv.count; v++) uv.setXY(v, (G.col + uv.getX(v)) / gilt.cols, 1 - (G.row + 1 - uv.getY(v)) / gilt.rows);
        const p = add(c, [Math.cos(a), Math.sin(a)], BAND);
        // laid flat, the head out along the radius and the line running on
        // round the ring
        LB.letters.add(g.rotateX(-Math.PI / 2).rotateY(-(a + Math.PI / 2)).translate(p[0], FIELD + 0.02, p[1]));
        s += G.adv + track;
      }
    } else {
      const y = 30.2 + 0.45;
      // Inside 7.1, which is where the flanks of both flights stand: a wider
      // ring runs into them at four bearings and reads as a broken circle.
      LB.inlay.add(slabGeo(circlePts(c, 6.6, 40), [circlePts(c, 5.8, 40)], 0.5, y));
      LB.inlay.add(slabGeo(circlePts(c, 5.2, 40), [circlePts(c, 4.95, 40)], 0.5, y));
      for (let k = 0; k < 6; k++) {
        const a = 60 * k;
        LB.inlay.add(slabGeo([add(c, dir(a - 3), 1.4), add(c, dir(a), 4.8), add(c, dir(a + 3), 1.4)], [], 0.5, y));
      }
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 20), c, y));
    }
    // ── The light down the well ───────────────────────────────────────────
    // The gallery stands open to the sky, and nothing in the room said so. A
    // cool shaft falls the whole height of the rotunda, crosses both flights
    // and goes on down the well — the one thing in here that is not stone, and
    // the only light in the piece that is not a lamp.
    {
      // Leaning the way the moon does, so it falls across the room instead of
      // standing in the middle of it like a pillar.
      const tilt = 15 * deg, bear = 52 * deg;
      const up = new THREE.Vector3(Math.sin(tilt) * Math.cos(bear), Math.cos(tilt), Math.sin(tilt) * Math.sin(bear));
      const mid = new THREE.Vector3(c[0], 30, c[1]);
      // The crossing stands in the middle of this, so it has to know where it
      // is: from the crown it would be the whole frame gone pale (see
      // shaftVolume).
      const beam = new THREE.Mesh(
        keep(shaftVolume(new THREE.CylinderGeometry(21, 35, 190, 30, 1, true),
          mid.clone().addScaledVector(up, -95).toArray(), 35, mid.clone().addScaledVector(up, 95).toArray(), 21)),
        // (begun over the lower arcade and warmed at its edge: echoFix.js, 4)
        keep(moonBeamPatch(makeShaftMaterial('#c3cfd8', 0.09))),
      );
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      beam.position.copy(mid);
      beam.renderOrder = 2;
      root.add(beam);
      // Where it LANDS. From the floor the column alone hangs in front of the
      // stair as a grey sheet, and light in the air is the weakest way to say
      // light. Laid on the treads it crosses, cut to the beam's own section at
      // the height of each tread, it comes down the stair in steps.
      //
      // Light MULTIPLIES what it falls on. ADDED, a flat grey laid on top of
      // the stone is the harshest thing on the bridge: each tread under the
      // crown a sheet of white paper with a hard outline, the joints between
      // its flags turned blue-grey, because added light lights the mortar
      // exactly as much as the stone. So it brightens the stone it lands on in
      // proportion to the stone (dst·(1 + k)): the joints stay dark, the stone
      // keeps its warmth, and the edge is a penumbra several units wide, not a
      // cut line. ?wmoon=old is the added sheet.
      const moonOld = Q.get('wmoon') === 'old';
      const moonLand = keep(moonOld ? new THREE.ShaderMaterial({
        uniforms: {
          uC: { value: new THREE.Vector2(c[0], c[1]) },
          uD: { value: new THREE.Vector2(Math.cos(bear), Math.sin(bear)) },
          uColor: { value: new THREE.Color('#e7ebee') },
          uO: { value: 0.18 },
        },
        vertexShader: `varying vec3 vW;
          void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform vec2 uC; uniform vec2 uD; uniform vec3 uColor; uniform float uO; varying vec3 vW;
          void main() {
            float t = (vW.y - 30.0) / ${Math.cos(tilt).toFixed(5)};
            vec2 ctr = uC + uD * (t * ${Math.sin(tilt).toFixed(5)});
            float r = 28.0 - 7.0 * t / 95.0;
            float d = distance(vW.xz, ctr);
            float m = (1.0 - smoothstep(r - 1.4, r + 0.3, d)) * (0.72 + 0.28 * (1.0 - d / r));
            gl_FragColor = vec4(uColor * m * uO, 1.0);
          }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }) : new THREE.ShaderMaterial({
        uniforms: {
          uC: { value: new THREE.Vector2(c[0], c[1]) },
          uD: { value: new THREE.Vector2(Math.cos(bear), Math.sin(bear)) },
          // What it multiplies is stone already lit by the lamps, so a neutral
          // moon would only be more lamplight. Leaning a little cool, it takes
          // the lamp's amber partly back out where it falls: the patch reads as
          // a different light, nearer the stone's own colour. Only a little: a
          // stronger cool cast on warm stone reads as a filter.
          uColor: { value: new THREE.Color().setRGB(0.84, 0.92, 1.0) },
          // With the column begun over the lower arcade (echoFix.js, 4) the
          // light is what it lays on the stair, and the stair has to be the
          // brightest thing in the room: stronger where it falls, and a fainter
          // spill of it carried on down the flight to the floor, which the
          // stand looks up (the lower treads lie outside the column's section,
          // and from the floor the moon would light nothing seen).
          uK: { value: qNum('wmoonk', echoOld(4) ? 0.8 : 1.3) },
          uSoft: { value: qNum('wmoonsoft', 6) },
          uSpill: { value: qNum('wmoonspill', echoOld(4) ? 0 : 0.8) },
        },
        vertexShader: `varying vec3 vW;
          void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform vec2 uC; uniform vec2 uD; uniform vec3 uColor; uniform float uK; uniform float uSoft; uniform float uSpill; varying vec3 vW;
          void main() {
            float t = (vW.y - 30.0) / ${Math.cos(tilt).toFixed(5)};
            vec2 ctr = uC + uD * (t * ${Math.sin(tilt).toFixed(5)});
            float r = 28.0 - 7.0 * t / 95.0;
            float d = distance(vW.xz, ctr);
            float m = 1.0 - smoothstep(r - uSoft, r + 0.5 * uSoft, d);
            m *= 0.8 + 0.2 * clamp(1.0 - d / r, 0.0, 1.0);
            m = max(m, uSpill * (1.0 - smoothstep(0.7 * r, 3.2 * r, d)));
            gl_FragColor = vec4(uColor * (m * uK), 1.0);
          }`,
        // out = src·dst + dst, and the target's alpha left as it was
        transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.DstColorFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }));
      const treads = [];
      const f = flightProfile(ECHO_FLIGHT);
      for (const ang of [0, 60]) {
        for (let k = 0; k < f.dims.steps; k++) {
          const u = -f.dims.span + (k + 0.5) * f.dims.run, y = f.stepTop(k);
          if (ang === 60 && Math.abs(u) < 9) continue;   // the crown both flights share, lit once
          const q = add(c, dir(ang), u);
          const off = (y - 30) * Math.tan(tilt), ctr = add(c, dir(52), off), r = 32 - (8 * ((y - 30) / Math.cos(tilt))) / 95;
          if (dist(q, ctr) > (echoOld(4) ? r + 9 : 3.2 * r + 9)) continue;
          if (!ROSE_OLD && y >= CROWN_Y) continue;   // (the crown: below)
          treads.push(flatQuad(q, ang, f.dims.run, 14.6, y + 0.05));
        }
      }
      // The crown, with the rose let into it. Laid flat across it as the
      // other treads are, the light would lie UNDER the inlay it falls on —
      // so it is laid round the rose at the crown's height, and over the rose
      // a little above the highest piece of it.
      if (!ROSE_OLD) {
        const sheet = (pts, holes, y) => {
          const v2 = (p) => p.map(([x, z]) => new THREE.Vector2(x, -z));
          const shape = new THREE.Shape(v2(pts));
          holes.forEach((h) => shape.holes.push(new THREE.Path(v2(h))));
          const g = new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2).translate(0, y, 0);
          g.setAttribute('uv1', g.attributes.uv.clone());
          return g;
        };
        const R = f.dims.run, rim = circlePts(c, ROSE_R + 0.05, 96);
        treads.push(sheet([[-R, -7.3], [R, -7.3], [R, 7.3], [-R, 7.3]].map(([u, z]) => add(c, [u, z])), [rim], CROWN_Y + 0.05));
        treads.push(sheet(rim, [], CROWN_Y + 0.22));
      }
      const land = new THREE.Mesh(keep(mergeGeometries(treads)), moonLand);
      treads.forEach((g) => g.dispose());
      // (named, so the walking body takes it for light on the stone and not a
      // floor of its own: body.js AIR)
      land.name = 'moonLand';
      land.renderOrder = 2;
      root.add(land);
    }
    // Every passage insists it has been walked before: a paler, smoother track
    // up the middle of every tread of both flights.
    {
      const f = flightProfile(ECHO_FLIGHT);
      for (const ang of [0, 60]) {
        for (let k = 0; k < f.dims.steps; k++) {
          if (!ROSE_OLD && !notCrown(k)) continue;
          const u = -f.dims.span + (k + 0.5) * f.dims.run;
          LB.wornStep.add(flatQuad(add(c, dir(ang), u), ang, f.dims.run - 0.6, 6.4, f.stepTop(k) + 0.03));
        }
      }
    }
    LB.inlay.add(slabGeo(circlePts(c, 50.5, 60), [circlePts(c, 49, 60)], 0.5, 6));
    LB.inlay.add(slabGeo(circlePts(c, 79 + ECHO_R - R, 60), [circlePts(c, 77.2 + ECHO_R - R, 60)], 0.5, 6));
    // ── Arcades answering arcades ─────────────────────────────────────────
    // What the room is called after: two storeys of arcade round the well on
    // twelve bays, so that from anywhere in the gallery you are looking through
    // one arch at another, and through that at a third. Without it this is a
    // hexagon of bookshelves with a lamp in it — which is exactly what the
    // Vestibule is.
    const FLOOR = 6, BAYS = 12;
    // The slender columns still stand directly on the floor. Their ring is
    // set back from the flights so the plinths and coping read as separate
    // stonework; the twelve bays and both storeys keep their rhythm.
    const RING = ECHO_RING, HALF = RING * Math.sin((180 / BAYS) * deg);
    // A turned profile, [radius, height] from the bottom up, with its uv in
    // world units: along the profile, and round it. (That way round, so the
    // stone's bed runs up a column as it does in a monolith, not round it.)
    const colLathe = (prof, segs = 40) => {
      const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs);
      const along = [0];
      for (let i = 1; i < prof.length; i++) along.push(along[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
      const rMax = Math.max(...prof.map(([r]) => r)), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, along[Math.round(uv.getY(i) * (prof.length - 1))], uv.getX(i) * Math.PI * 2 * rMax);
      }
      return g;
    };
    // A fluted shaft with entasis: straight for its lower third, then drawn in
    // to `top` of its foot at the neck. Twenty flutes with a fillet between
    // them, each a shallow hollow — the light finds every one, and they are
    // what makes a shaft read as cut stone rather than a pipe. The uv is world
    // units, up the shaft and round it, as colLathe's.
    const flutedShaft = (rad, h, { flutes = 20, rows = 6, top = 0.84, depth = 0.075, fillet = 0.2, fine = true } = {}) => {
      const E = fillet / 2;
      // where round one flute the vertices fall: on both arrises of the fillet,
      // and three across the hollow (one, for a column only seen from afar)
      const STOPS = fine ? [0, E, E + (1 - fillet) * 0.25, 0.5, E + (1 - fillet) * 0.75, 1 - E] : [0, E, 0.5, 1 - E];
      const cols = flutes * STOPS.length;
      const thAt = (i) => ((Math.floor(i / STOPS.length) + STOPS[i % STOPS.length]) / flutes) * Math.PI * 2;
      const R = (t) => rad * (t < 1 / 3 ? 1 : 1 - (1 - top) * ((t - 1 / 3) / (2 / 3)) ** 1.6);
      const hollow = (th) => {
        const f = ((th / (Math.PI * 2)) * flutes) % 1;
        return f < E || f > 1 - E ? 0 : Math.sin((Math.PI * (f - E)) / (1 - fillet));
      };
      const r = (th, t) => R(t) * (1 - depth * hollow(th));
      const pos = [], nor = [], uv = [], idx = [];
      const d = 1e-4;
      for (let j = 0; j <= rows; j++) {
        const t = j / rows, y = t * h;
        for (let i = 0; i <= cols; i++) {
          const th = i === cols ? Math.PI * 2 : thAt(i);
          const rr = r(th, t);
          const cs = Math.cos(th), sn = Math.sin(th);
          pos.push(cs * rr, y, sn * rr);
          // the normal from the surface's own derivatives (central, so an
          // arris shades as the mean of the faces either side of it)
          const rTh = (r(th + d, t) - r(th - d, t)) / (2 * d);
          const rY = (r(th, Math.min(1, t + d)) - r(th, Math.max(0, t - d))) / ((Math.min(1, t + d) - Math.max(0, t - d)) * h);
          const pTh = new THREE.Vector3(rTh * cs - rr * sn, 0, rTh * sn + rr * cs);
          const pY = new THREE.Vector3(rY * cs, 1, rY * sn);
          const n = new THREE.Vector3().crossVectors(pY, pTh).normalize();
          nor.push(n.x, n.y, n.z);
          uv.push(y, th * rad);
        }
      }
      const W = cols + 1;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const a = j * W + i, b = a + 1, c2 = a + W, e = c2 + 1;
          idx.push(a, c2, b, b, c2, e);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      return g;
    };
    // The orders' mouldings, as profiles in units of the shaft's radius. The
    // base is an Attic one — a torus, a hollow between two fillets, a smaller
    // torus — and the capital a Roman Doric: an astragal where the shaft ends,
    // a plain necking, three annulets, the echinus swelling out to carry the
    // abacus. (Each moulding is a few points: a lathe smooths its normals, and
    // a doubled point, which would sharpen one, makes a NaN of it.)
    const BASE = [
      [1.22, 0], [1.33, 0.06], [1.32, 0.19], [1.2, 0.27], [1.07, 0.32], [1.04, 0.42], [1.13, 0.49],
      [1.16, 0.56], [1.12, 0.63], [1.04, 0.68], [1.0, 0.75],
    ];
    const CAP = [
      [0.83, -0.02], [0.9, 0.03], [0.9, 0.1], [0.845, 0.14], [0.845, 0.4], [0.885, 0.43], [0.865, 0.46], [0.9, 0.5],
      ...[0.2, 0.45, 0.7, 0.9, 1].map((s) => [0.9 + 0.34 * (1 - (1 - s) ** 2), 0.53 + 0.34 * s]),
    ];
    // An arcade storey: a colonnade carrying a run of arches and a cornice over.
    // What keeps it from being any arcade anywhere is entirely in the ornament —
    // a moulded ring round every arch, an impost for it to spring from, a
    // roundel over every crown and a course of dentils under every cornice. Bare,
    // twelve identical openings in one pale stone read as a default.
    //
    // A column from the floor up: a square plinth, the base, the shaft, the
    // capital and its abacus, and over that an impost block — a little piece
    // of entablature, as in a Florentine loggia — for the arch to spring from,
    // so the arches can stand on columns no thicker than a column should be.
    // (`ped`: a pedestal first, for a storey standing on a cornice.)
    const KEY_OLD = echoOld(3);
    const arcade = ({ foot, ped = 0, top, rad, rise, band, wall }) => {
      const plinthH = rad * 0.55, baseH = rad * 0.75, capH = rad * 1.15, impH = rad * 1.3;
      const y0 = foot + ped, shaftY = y0 + plinthH + baseH, capY = top - impH - capH;
      const shaftH = capY - shaftY + rad * 0.02;
      const span = HALF - rad * 1.3;
      // (Turned as finely as they are seen: the upper storey is never nearer
      // than the crossing, and every column here is drawn into the shadow map
      // as well. At forty segments and twelve rows the two storeys came to
      // 125k triangles, a quarter of the world.)
      const near = rad > 1.5;
      const baseGeo = colLathe(BASE.map(([q, y]) => [q * rad, y * rad]), near ? 20 : 14);
      const capGeo = colLathe(CAP.map(([q, y]) => [q * rad, y * rad]), near ? 20 : 14);
      const shaftGeo = flutedShaft(rad, shaftH, near ? {} : { flutes: 16, rows: 4, fine: false });
      for (let k = 0; k < BAYS; k++) {
        const a = 15 + k * (360 / BAYS);
        const p = add(c, dir(a), RING), ry = -a * deg;
        if (ped) {
          // a pedestal: a base slab, a plain die, a cap
          LB.columnBox.add(placed(new THREE.BoxGeometry(rad * 3.2, 0.5, rad * 3.2), p, foot + 0.25, ry));
          LB.columnBox.add(placed(new THREE.BoxGeometry(rad * 2.8, ped - 0.9, rad * 2.8), p, foot + 0.5 + (ped - 0.9) / 2, ry));
          LB.columnBox.add(placed(new THREE.BoxGeometry(rad * 3.15, 0.4, rad * 3.15), p, foot + ped - 0.2, ry));
        }
        LB.columnBox.add(placed(new THREE.BoxGeometry(rad * 2.9, plinthH, rad * 2.9), p, y0 + plinthH / 2, ry));
        LB.column.add(placed(baseGeo.clone(), p, y0 + plinthH, ry));
        LB.column.add(placed(shaftGeo.clone(), p, shaftY, ry));
        LB.column.add(placed(capGeo.clone(), p, capY, ry));
        // the abacus, square to the ring
        LB.columnBox.add(placed(new THREE.BoxGeometry(rad * 2.75, capH - rad * 0.87, rad * 2.75), p, capY + (capH + rad * 0.87) / 2, ry));
        // the impost: a block the depth of the arcade's wall, and a cornice
        // over it a little wider each way
        LB.columnBox.add(placed(new THREE.BoxGeometry(wall + 0.4, impH * 0.72, rad * 2.7), p, capY + capH + impH * 0.36, ry));
        LB.columnBox.add(placed(new THREE.BoxGeometry(wall + 1.1, impH * 0.28, rad * 3.05), p, top - impH * 0.14, ry));

        const mid = add(c, dir(a + 180 / BAYS), RING * Math.cos((180 / BAYS) * deg));
        const turn = a + 90 + 180 / BAYS;
        // the spandrel between this column and the next: one closed outline,
        // the arch cut out of its underside (a hole would have to stop short)
        const arc = [];
        for (let n = 0; n <= 24; n++) {
          const th = Math.PI * (1 - n / 24);
          arc.push([Math.cos(th) * span, top + Math.sin(th) * rise]);
        }
        LB.mass.add(profileGeo(
          [[-HALF, top], [-span, top], ...arc, [span, top], [HALF, top], [HALF, top + rise + band], [-HALF, top + rise + band]],
          wall, mid, turn,
        ));
        // the archivolt: a moulded ring standing proud on each face of the arch
        const t = rad * 0.27;
        for (const face of [-1, 1]) {
          const q = add(mid, dir(turn + 90), face * (wall / 2 + t * 0.45));
          const ring2 = new THREE.TorusGeometry(span + t, t, 8, 36, Math.PI);
          ring2.scale(1, (rise + t) / (span + t), 1);
          LB.cap.add(placed(ring2.rotateY(-turn * deg), q, top));
          // and a keystone at the crown
          if (KEY_OLD) LB.cap.add(placed(new THREE.BoxGeometry(rad * 0.95, rad * 1.9, t * 2.2), q, top + rise + rad * 0.45, -turn * deg));
        }
        // A carved keystone (echoFix.js, 3): a wedge through the archivolt
        // that runs on up the spandrel as a console under the cornice, with a
        // sunk panel down its face and a cap moulding where it meets the
        // dentils. The short block with a bronze roundel standing on it read
        // from the floor as a ring hung over every arch, a door's knocker.
        if (!KEY_OLD) {
          const capH = rad * 0.35, y0 = top + rise - rad * 0.35, y1 = top + rise + band - 1.45 - capH;
          const wb = rad * 0.42, wt = rad * 0.66, D = t * 1.9 + 0.15;
          const wedge = (w0, w1, a, b) => [[-w0, a], [w0, a], [w1, b], [-w1, b]];
          const at = (z) => y0 + (y1 - y0) * z, wAt = (z) => wb + (wt - wb) * z;
          for (const face of [-1, 1]) {
            const off = (d) => add(mid, dir(turn + 90), face * (wall / 2 - 0.15 + d / 2));
            LB.cap.add(profileGeo(wedge(wb, wt, y0, y1), D, off(D), turn));
            // the panel, sunk: a raised margin each side of it, the field between
            for (const s of [-1, 1]) {
              LB.cap.add(profileGeo([[s * wAt(0.16) * 0.58, at(0.16)], [s * wAt(0.16) * 0.9, at(0.16)], [s * wAt(0.84) * 0.9, at(0.84)], [s * wAt(0.84) * 0.58, at(0.84)]], D + 0.3, off(D + 0.3), turn));
            }
            LB.cap.add(profileGeo([[-wAt(0.16) * 0.9, at(0.1)], [wAt(0.16) * 0.9, at(0.1)], [wAt(0.16) * 0.9, at(0.16)], [-wAt(0.16) * 0.9, at(0.16)]], D + 0.3, off(D + 0.3), turn));
            LB.cap.add(profileGeo([[-wAt(0.84) * 0.9, at(0.84)], [wAt(0.84) * 0.9, at(0.84)], [wAt(0.84) * 0.9, at(0.9)], [-wAt(0.84) * 0.9, at(0.9)]], D + 0.3, off(D + 0.3), turn));
            // the cap: a fillet, and a wider abacus over it
            LB.cap.add(placed(new THREE.BoxGeometry(wt * 2 + rad * 0.12, capH * 0.4, D + 0.25), off(D + 0.25), y1 + capH * 0.2, -turn * deg));
            LB.cap.add(placed(new THREE.BoxGeometry(wt * 2 + rad * 0.34, capH * 0.6, D + 0.5), off(D + 0.5), y1 + capH * 0.7, -turn * deg));
          }
          continue;
        }
        // a roundel over every crown, bronze in a pale surround
        for (const face of [-1, 1]) {
          const oc = add(mid, dir(turn + 90), face * (wall / 2 + 0.2));
          LB.cap.add(placed(new THREE.CylinderGeometry(band * 0.34, band * 0.34, 0.6, 24).rotateX(Math.PI / 2), oc, top + rise + band * 0.5, -turn * deg));
          LB.bronzeDim.add(placed(new THREE.CylinderGeometry(band * 0.25, band * 0.25, 0.9, 24).rotateX(Math.PI / 2), oc, top + rise + band * 0.5, -turn * deg));
        }
      }
      [baseGeo, capGeo, shaftGeo].forEach((g) => g.dispose());
      // a course of dentils under the cornice on both faces, the smallest
      // repeat in the room
      for (const face of [-1, 1]) {
        const rr = RING + face * (wall / 2 + 0.35);
        for (let d = 0; d < BAYS * 16; d++) {
          const a = (360 / (BAYS * 16)) * d;
          posts.push({
            p: [c[0] + Math.cos(a * deg) * rr, top + rise + band - 0.75, c[1] + Math.sin(a * deg) * rr],
            rot: [0, -a * deg, 0],
            s: [0.8, 1.3, 1.1],
          });
        }
      }
      // The cornice the storey carries, a ring right round the well — kept
      // narrow, because a deep one hangs over the reader's head as a black
      // soffit right across the top of the frame.
      // Round, not hexagonal: as a hexagon the ring's CORNERS reach out to
      // within a few units of where the reader stands and hang over their head
      // as a black soffit across the top of the frame.
      const ring = (r) => circlePts(c, r, 48);
      LB.cap.add(slabGeo(ring(RING + wall / 2 + 1.5), [ring(RING - wall / 2 - 1.5)], 2, top + rise + band));
      LB.cap.add(slabGeo(ring(RING + wall / 2 + 0.9), [ring(RING - wall / 2 - 0.9)], 1.4, top + rise + band + 2));
      return top + rise + band + 2.4;
    };
    // The lower storey springs its arches at 43.5, level with the crown; the
    // columns are 4.2 across and 8 diameters tall.
    const upper = arcade({ foot: FLOOR, top: 43.5, rad: 2.1, rise: 12, band: 8, wall: 4.6 });
    arcade({ foot: upper, ped: 3, top: upper + 20, rad: 1.15, rise: 10, band: 6, wall: 3.2 });
    // The upper arcade's bays stand open: a low case of books in each, on the
    // cornice between the columns, looked up at from the floor reads as
    // cabinets left out in a loggia, not as library. A sconce on every other
    // pier, so the light repeats with the arches. Not `lamp` — its halo is a
    // sprite drawn with depthTest off, and at this size and this close it hangs
    // in front of the arcade as a pale disc. Not on the two piers at the ends
    // of the flight the walk climbs (165° and 345°): the walk steps onto the
    // stair beside one and off it beside the other, a few units from the pier
    // at the height of the eye, and a lit lamp that close sweeping past the
    // lens is most of what makes going over the crossing feel like walking into
    // the columns. A lantern on a console (sconce.js), fixed to a cast plate on
    // the shaft's face; ?wmount=old: held by a band round the shaft instead;
    // ?wsconce=old: the old sconce, a rod run through its globe under a pan.
    // The shaft's radius at the plate is the lower storey's, entasis and all:
    // arcade({ foot: FLOOR, top: 43.5, rad: 2.1 }).
    const SCONCE_OLD = Q.get('wsconce') === 'old';
    const shaftR = (y) => {
      const rad = 2.1, from = FLOOR + rad * 1.3, h = 43.5 - rad * 2.45 - from + rad * 0.02, t = (y - from) / h;
      return rad * (t < 1 / 3 ? 1 : 1 - 0.16 * ((t - 1 / 3) / (2 / 3)) ** 1.6);
    };
    const lanternWash = [], lanternPanes = [];
    for (let k = 1; k < BAYS; k += 2) {
      const a = 15 + k * 30, p = add(c, dir(a), RING - 2.1 - 1.5);
      if (a === 165 || a === 345) continue;
      if (!SCONCE_OLD) {
        const s = pierLantern({ at: add(c, dir(a), RING), ry: (180 - a) * deg, R: shaftR, oldBand: Q.get('wmount') === 'old' });
        s.bronze.forEach((g) => LB.bronze.add(g));
        lanternPanes.push(s.pane);
        lanternWash.push(s.wash);
        halo(s.halo.p, s.halo.y, 16, '#ffbe78', 0.16, lampHaloTex);
        continue;
      }
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.4, 0.4, 3.4, 6).rotateZ(Math.PI / 2), p, 26, -a * deg));
      LB.bronze.add(placed(new THREE.CylinderGeometry(1.9, 1.1, 0.8, 10), p, 28.4));
      // A small opal globe, the hanging lamps' glass (makeLampGlobeMaterial): a
      // glow-core, bright nearly to its rim, prints from the stand as a flat
      // cream plate stuck on the pier. (And the lamps' hollow halo, which
      // leaves the glass to be seen.)
      globes.push({ p: [p[0], 26.5, p[1]], s: [1.55, 1.55, 1.55], color: '#ffe8c8', k: 0.85 });
      halo(p, 26.6, 16, '#ffbe78', 0.16, lampHaloTex);
    }
    if (!SCONCE_OLD) {
      // the panes, in the globes' own opal glass
      instances(lanternPaneGeometry(), M.globe, lanternPanes, { cast: false, receive: false, chunked: true, name: 'lantern-panes' });
      // the light each lays on its own column
      const wash = new THREE.Mesh(keep(mergeGeometries(lanternWash, false)), keep(new THREE.MeshBasicMaterial({
        map: radialTex, color: '#ffb466', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })));
      wash.name = 'lantern-wash';
      wash.renderOrder = 1;
      root.add(wash);
    }
    // (Both with their halos turned down: between them and the moon the upper
    // middle of the stand's frame — the arcade, the room's subject — would be
    // milk.) (At 44, inside the colonnade at 56: at 52 its globe stands in the
    // upper storey's arches.)
    lamp(add(c, dir(150), 44), { light: 8500, priority: 7, strength: 1.2, pool: 0.32, haze: 0.45 });
    // In a little from the arcade and down in strength: at 52 it hung a dozen
    // units from the keystone and roundel over its bay and blew them out, and
    // with the moon the room had two brightest things. The moon wins now.
    lamp(add(c, dir(30), 45), { strength: 0.85, pool: 0.26, haze: 0.45 });
  }
  return { ECHO_FLIGHT, ECHO_RING };
}
