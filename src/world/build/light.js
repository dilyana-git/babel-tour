// The world's light, the unexplored Library seen from the map, what is culled
// at eye level, and what the camera and the map's overlay need
// (buildWorld.js, assembleWorld).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LAMPS, bakeFloorPools, POOL_SHADOW, makePoolShadowBake } from '../lampPass';
import { makeRng } from '../textures';
import { GLINT_N, glintLights } from '../effects';
import { WATER_Y } from '../water';
import { readerMaterial } from '../walkers';
import { BELT } from '../webProps';
import { mapOld, PIT_FADE } from '../mapFix';
import { map3Old, GARDEN_MAP } from '../mapFix3';
import { readerGeometry, ROBES } from '../readers';
import { lightPoolSize } from '../../capability';
import { MASS_H, ROUTE_LIGHT, CAP } from './common';

export function buildLight(ctx) {
  const { light, M, root, lightWishes, globes } = ctx;
  // ── Light ───────────────────────────────────────────────────────────────
  // The ground half of it is the bounce: warm light coming back UP off a stone
  // floor the lamps are standing on. Left near-black, every surface a lamp did
  // not reach went to nothing — a third of some rooms and three-quarters of the
  // map sat below 0.06, where the plates it answers to hold 2-8%.
  const hemi = new THREE.HemisphereLight('#7f97a6', '#4a3728', 0.32);
  root.add(hemi);
  const moon = new THREE.DirectionalLight('#c8dcea', light ? 0.8 : 0.95);
  moon.position.set(720 - 700, 1600, 450 - 900);
  moon.target.position.set(720, 0, 450);
  moon.castShadow = !light;
  moon.shadow.mapSize.set(light ? 1024 : 4096, light ? 1024 : 4096);
  Object.assign(moon.shadow.camera, { left: -1500, right: 1500, top: 1500, bottom: -1500, near: 10, far: 6000 });
  moon.shadow.bias = -0.0003;
  moon.shadow.normalBias = 0.5;
  root.add(moon, moon.target);
  // A pool of real lights, handed to the lamps that matter from where the camera
  // is: over the map, the walk's own lamps by priority; down among the walls,
  // the nearest — so every lamp a reader walks under lights the stone round it,
  // and the frame pays for a handful of lights, never for all of them (a point
  // light is a per-fragment cost across the whole screen). A light changes lamp
  // only once it has faded out, so nothing pops.
  // (lampPass.js) the floor's pools summed into its map, and the lit globes
  // nearest the walk handed to the glass to glint with
  if (LAMPS.pool) bakeFloorPools();
  // ?wpoolshadow=1: and shadowed, once the world is up (World.jsx steps it)
  const poolShadows = POOL_SHADOW ? makePoolShadowBake({ root, exclude: [M.floor, M.floorBand], floorY: 6.05 }) : null;
  if (LAMPS.glint) {
    const mid = [520, 640];
    [...globes].sort((a, b) => Math.hypot(a.p[0] - mid[0], a.p[2] - mid[1]) - Math.hypot(b.p[0] - mid[0], b.p[2] - mid[1]))
      .slice(0, GLINT_N).forEach((g, i) => glintLights.value[i].set(g.p[0], g.p[1], g.p[2], g.s[0]));
  }
  const POOL = lightPoolSize();
  const byPriority = [...lightWishes].sort((a, b) => b.priority - a.priority);
  // ?wlampshadow=1: the first two of them cast shadows — the rails, the
  // balusters, the readers and the stairs laid across the lamplight on the
  // stone. A lamp never moves, so its shadow would be drawn ONCE, when it is
  // handed to a light, and kept (World.jsx renders shadows only when asked;
  // see takeShadowRequest). Off unless asked for: two shadowed point lights
  // put a cube-map lookup for each into every lit material, and on the AMD
  // integrated GPU this piece is made on, ANGLE's shader compiler never came
  // back from the programs that made — the frame stopped dead (2026-09-27).
  const LAMP_SHADOWS = !light && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wlampshadow') === '1';
  let shadowRequest = false;
  const lightPool = Array.from({ length: POOL }, (_, i) => {
    const l = new THREE.PointLight('#ffffff', 0, 0, 2);
    if (LAMP_SHADOWS && i < 2) {
      l.castShadow = true;
      l.shadow.mapSize.set(512, 512);
      l.shadow.camera.near = 2;
      l.shadow.camera.far = 240;
      l.shadow.bias = -0.004;
      l.shadow.normalBias = 0.25;
      l.shadow.autoUpdate = false;
    }
    root.add(l);
    return { light: l, wish: null, level: 0 };
  });
  const takeShadowRequest = () => { const r = shadowRequest; shadowRequest = false; return r; };
  // How many of the pool may be lit at once. A point light is per-fragment work
  // across the whole screen, so on a machine that cannot hold the frame this is
  // one of the few things that buys time WITHOUT costing resolution — which is
  // the trade that matters here (see Governor.jsx). Hiding a light rather than
  // dimming it is the point: three.js compiles the light count into the
  // program, so an unlit light still costs, and an invisible one does not.
  let budget = POOL;
  const setLightBudget = (n) => {
    budget = Math.max(1, Math.min(POOL, n));
    return budget;
  };
  const near2 = (w, p) => (w.x - p.x) ** 2 + (w.y - p.y) ** 2 + (w.z - p.z) ** 2;
  // `far`: where the eye stands that a doorway opening somewhere else
  // (doorway.js) is drawing the far room from, while the reader is walking up
  // to it. The lamps are then the far eye's, so the room in the doorway is lit
  // as it will be when the reader is moved there, and nothing comes on as
  // they step through. The reader's own hallway keeps its light, because the
  // far hallway's lamp has a twin in it (`twins`) and stands there for the
  // reader's own view (`placeLights`). (The room behind them goes without
  // until they turn back.)
  const twins = new Map();
  let twinning = false;
  const placeLights = (twinned) => {
    for (const s of lightPool) {
      if (!s.wish) continue;
      const w = (twinned && twins.get(s.wish)) || s.wish;
      s.light.position.set(w.x, w.y, w.z);
    }
  };
  const updateLights = (eye, dt, far = null) => {
    if (far) eye = far;
    // (the light at the bottom of the Vertigo is 450 down: never among the
    // nearest, and the whole of the well's colour)
    const owns = (w) => (w.column && (w.column[0] - eye.x) ** 2 + (w.column[1] - eye.z) ** 2 < w.column[2] ** 2 ? 1 : 0);
    // A lamp already lit keeps its place until another is CLEARLY nearer. Sorted
    // on raw distance, two lamps a reader walks between swap back and forth
    // across the tie, and a whole gallery's light flickers with their footsteps.
    // Only the slots inside the budget count for any of this. A slot the
    // governor has switched off still REMEMBERS the lamp it was lighting, and
    // if that memory is allowed to count as "held" then no live slot will ever
    // take that lamp on — it simply goes dark and stays dark. (That is exactly
    // what happened the first time the budget came down mid-walk: the garden
    // lost the light under its armillary and never got it back.) A slot that
    // falls outside the budget fades out like any other and then lets go.
    const live = lightPool.slice(0, budget);
    const lit = new Set(live.filter((s) => s.level > 0.05).map((s) => s.wish));
    const rank = (w) => Math.min(near2(w, eye), far ? near2(w, far) : Infinity) * (lit.has(w) ? 0.55 : 1);
    const wanted = eye
      ? [...lightWishes].sort((a, b) => (owns(b) - owns(a)) || (rank(a) - rank(b))).slice(0, budget)
      : byPriority.slice(0, budget);
    // A lamp and its twin are one light seen from either side of a doorway:
    // a light carrying the one is handed the other at once, where it stands,
    // rather than going out for it to come on again.
    for (const s of live) {
      const w = s.wish && wanted.find((o) => o !== s.wish && (twins.get(o) === s.wish || twins.get(s.wish) === o));
      if (w && !live.some((o) => o.wish === w)) s.wish = w;
    }
    const held = new Set(live.map((s) => s.wish));
    const waiting = wanted.filter((w) => !held.has(w));
    lightPool.forEach((slot, i) => {
      if (i >= budget) {
        // Faded right out before it is taken out of the scene, so the lamp it
        // was carrying dims rather than snapping off — and once it is invisible
        // three.js stops compiling it into the shader, which is the whole point
        // of doing this at all.
        slot.level = Math.max(0, slot.level - dt * 4);
        slot.light.intensity = slot.wish ? slot.wish.intensity * 0.9 * slot.level : 0;
        if (slot.level <= 0.001) { slot.wish = null; slot.light.visible = false; }
        return;
      }
      slot.light.visible = true;
      if (!(slot.wish && wanted.includes(slot.wish)) && slot.level <= 0.001 && waiting.length) {
        slot.wish = waiting.shift();
        slot.light.position.set(slot.wish.x, slot.wish.y, slot.wish.z);
        slot.light.color.set(slot.wish.color);
        slot.light.decay = slot.wish.decay;
        if (slot.light.castShadow) { slot.light.shadow.needsUpdate = true; shadowRequest = true; }
      }
      const on = slot.wish && wanted.includes(slot.wish);
      slot.level = on ? Math.min(1, slot.level + dt * 2.5) : Math.max(0, slot.level - dt * 4);
      slot.light.intensity = slot.wish ? slot.wish.intensity * 0.9 * slot.level : 0;
    });
    twinning = !!far;
    placeLights(twinning);
  };
  const isTwinning = () => twinning;
  return { hemi, moon, poolShadows, takeShadowRequest, setLightBudget, twins, placeLights,
    updateLights, isTwinning };
}

export function buildUnexplored(ctx) {
  const { add, dist, keep, paint, shaftMaterial, bounceRooms, mapWarm, ROUTE_ON, ROUTE_TINT,
    walkNearGlsl, M, root, flatPlane, cells, inFrame, routeCenters, hallMid, distantReaders, PIT,
    pitCarved, J, POND, PV, PATHS, beltGroup } = ctx;
  // ── The unexplored ────────────────────────────────────────────────────────
  const VEIL = { x0: -900, z0: -1200, w: 3400, h: 2900, scale: 0.28 };
  const veilCanvas = paint(Math.round(VEIL.w * VEIL.scale), Math.round(VEIL.h * VEIL.scale), (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const clear = ([x, z], r, strength = 1) => {
      const X = (x - VEIL.x0) * VEIL.scale, Z = (z - VEIL.z0) * VEIL.scale, RR = r * VEIL.scale;
      const grd = g.createRadialGradient(X, Z, 0, X, Z, RR);
      grd.addColorStop(0, `rgba(0,0,0,${strength})`);
      grd.addColorStop(0.5, `rgba(0,0,0,${strength * 0.75})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(X, Z, RR, 0, Math.PI * 2);
      g.fill();
    };
    routeCenters.forEach((c) => clear(c, 320));
    [[0, 0, 2], [0, 0, 5], [1, -1, 5], [2, -2, 5]].forEach(([i, j, k]) => clear(hallMid(i, j, k), 230));
    cells.filter((c) => c.garden && inFrame(c.c)).forEach((c) => clear(c.c, 300));
  });
  const veilMat = keep(new THREE.MeshBasicMaterial({
    map: keep(new THREE.CanvasTexture(veilCanvas)), transparent: true, opacity: 0.72, depthWrite: false, toneMapped: false,
  }));
  const veil = new THREE.Mesh(flatPlane(), veilMat);
  veil.scale.set(VEIL.w, 1, VEIL.h);
  veil.position.set(VEIL.x0 + VEIL.w / 2, MASS_H + 50, VEIL.z0 + VEIL.h / 2);
  veil.renderOrder = 5;
  root.add(veil);

  // ── The garden, seen from the map ─────────────────────────────────────────
  // On the ground it is the most coloured place in the piece — red lacquer,
  // violet wisteria, amber lanterns, a blue roof under the moon. From the map
  // it was navy on black: the pavilion a grey disc, the pergola a dark mat of
  // leaves (the racemes hang under it), the lanterns four dim dots, and the
  // pond, which takes the sky only at a grazing angle, as dark as the lawn
  // (mapFix3.js, 4). None of its lamps is among the few the map's light pool
  // carries. So over the map it is given what the rooms have, as light laid
  // on it and gone by the time a flight comes down among it (setVeil): the
  // pavilion's lamplight pooled on the water and the bridge round it, the
  // moon's road across the pond, the wisteria's violet along the pergola, and
  // the stone lanterns' amber.
  const gardenGlows = [];
  if (!map3Old(4)) {
    const rngG = makeRng(1104), gr = (a, b) => a + (b - a) * rngG();
    const glow = (canvas, [x, z], [w, h], y, k, turn = 0) => {
      const mat = keep(new THREE.MeshBasicMaterial({
        map: keep(Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace })),
        transparent: true, opacity: k, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
      }));
      const m = new THREE.Mesh(flatPlane(), mat);
      m.scale.set(w, 1, h);
      m.rotation.y = turn;
      m.position.set(x, y, z);
      m.renderOrder = 6;
      m.name = 'map-garden-glow';
      m.userData.k = k;
      root.add(m);
      gardenGlows.push(m);
    };
    const pool = (rgb, stops) => paint(128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      stops.forEach(([at, a]) => grd.addColorStop(at, `rgba(${rgb},${a})`));
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    });
    // the pavilion's lamplight, on the water and the bridge's deck (under the
    // roof, which hides the middle of it)
    glow(pool('255,160,84', [[0, 1], [0.5, 0.82], [0.66, 0.4], [0.84, 0.1], [1, 0]]), PV, [GARDEN_MAP.pavilion.r * 2, GARDEN_MAP.pavilion.r * 2], WATER_Y + 2.4, GARDEN_MAP.pavilion.k);
    // the moon on the pond: a wash of it over the whole water, and its road —
    // broken lengths of silver, lying across the way the map looks
    glow(paint(256, 196, (g, w, h) => {
      // (strongest toward the far shore, and gone short of the bank all round)
      g.save();
      g.translate(w / 2, h / 2);
      g.scale(1, h / w);
      const wash = g.createRadialGradient(0, -w * 0.16, 0, 0, 0, w / 2);
      wash.addColorStop(0, `rgba(120,152,212,${GARDEN_MAP.moon.wash})`);
      wash.addColorStop(0.7, `rgba(104,136,200,${GARDEN_MAP.moon.wash * 0.55})`);
      wash.addColorStop(0.93, 'rgba(96,128,190,0)');
      g.fillStyle = wash;
      g.fillRect(-w / 2, -w / 2, w, w);
      g.restore();
      g.lineCap = 'round';
      const road = GARDEN_MAP.moon.road * w;
      const inside = (x, y) => ((x - w / 2) / (w / 2 - 12)) ** 2 + ((y - h / 2) / (h / 2 - 12)) ** 2 < 1;
      for (let k = 0; k < 110; k++) {
        const y = gr(0.06, 0.94) * h, off = gr(-1, 1), half = (0.05 + 0.08 * (y / h)) * w;
        const x = road + off * Math.abs(off) * half, len = gr(3, 13) * (1 - 0.5 * Math.abs(off));
        if (!inside(x - len / 2, y) || !inside(x + len / 2, y)) continue;
        g.strokeStyle = `rgba(214,228,255,${(gr(0.25, 0.9) * (1 - 0.6 * Math.abs(off))).toFixed(3)})`;
        g.lineWidth = gr(0.8, 1.7);
        g.beginPath();
        g.moveTo(x - len / 2, y);
        g.lineTo(x + len / 2, y);
        g.stroke();
      }
    }), POND.c, [POND.rx * 2, POND.rz * 2], WATER_Y + 0.45, GARDEN_MAP.moon.k);
    // the wisteria: its racemes hang under the pergola's rafters, and from
    // above there was only the mat of leaves over them
    {
      const a = PATHS[0].pts[0], L = dist(a, J), t = [(J[0] - a[0]) / L, (J[1] - a[1]) / L];
      const [z0, z1] = GARDEN_MAP.wisteria.along, mid = add(a, t, (z0 + z1) / 2);
      glow(paint(96, 256, (g, w, h) => {
        for (let k = 0; k < 420; k++) {
          const u = gr(-1, 1), v = gr(-1, 1);
          const edge = (1 - Math.abs(u) ** 3) * (1 - Math.abs(v) ** 6);
          const x = (0.5 + 0.44 * u) * w, y = (0.5 + 0.47 * v) * h, r = gr(3, 9);
          const [cr, cg, cb] = [[178, 134, 255], [150, 110, 236], [206, 170, 255], [226, 196, 255]][Math.floor(gr(0, 4))];
          const grd = g.createRadialGradient(x, y, 0, x, y, r);
          grd.addColorStop(0, `rgba(${cr},${cg},${cb},${(gr(0.2, 0.55) * edge).toFixed(3)})`);
          grd.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          g.fillStyle = grd;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
      }), mid, [GARDEN_MAP.wisteria.across, z1 - z0], GARDEN_MAP.wisteria.y, GARDEN_MAP.wisteria.k, Math.atan2(t[0], t[1]));
    }
    // and the four stone lanterns that are lit
    const amber = pool('255,176,84', [[0, 1], [0.25, 0.6], [0.6, 0.16], [1, 0]]);
    for (const p of GARDEN_MAP.lanterns.at) glow(amber, p, [GARDEN_MAP.lanterns.r * 2, GARDEN_MAP.lanterns.r * 2], GARDEN_MAP.lanterns.y, GARDEN_MAP.lanterns.k);
  }
  const setVeil = (amount) => {
    veilMat.opacity = 0.72 * amount;
    veil.visible = amount > 0.01;
    for (const m of gardenGlows) {
      m.material.opacity = m.userData.k * amount;
      m.visible = amount > 0.01;
    }
    // (and what is there only over the map: mapFix.js, 7 and 8)
    mapWarm.value = amount;
    // (and the belt of cedars, drawn down out of the map's way: webProps.js, 2)
    if (beltGroup) {
      const t = Math.min(1, Math.max(0, (amount - BELT.sink[0]) / (BELT.sink[1] - BELT.sink[0])));
      beltGroup.scale.y = 1 - (1 - BELT.map) * t * t * (3 - 2 * t);
    }
  };

  // Over the map, the Vertigo has no floor (mapFix.js, 7). Seen from up there
  // the stair's pale treads and carriage, the shelves and their lips at the
  // head of the well, and the ring of floor round its mouth, lit by the lamps
  // hanging in it, turned down the funnel as one beige disc. Inside the pit, below its floor, they darken
  // with depth while the map shows; the books keep their colour, and the
  // light at the bottom warms them as it always did, so what is left to see
  // down there is the glow. (Chained onto whatever the material already does,
  // last, so nothing laid on it later takes its place.)
  const pitFade = (mat) => {
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, renderer) => {
      prev?.call(mat, sh, renderer);
      sh.uniforms.uPitMap = mapWarm;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vPitW;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vPitW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vPitW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uPitMap;
          varying vec3 vPitW;`)
        // (the lamplight it takes, not its own glow: the books' warmth from
        // the light below is emissive, and stays)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          float pitFade = 1.0 - uPitMap
            * mix(${PIT_FADE.floor.toFixed(2)}, ${PIT_FADE.k.toFixed(2)}, smoothstep(${PIT_FADE.from.toFixed(1)}, ${PIT_FADE.to.toFixed(1)}, vPitW.y))
            * step(vPitW.y, 7.5)
            * step(distance(vPitW.xz, vec2(${PIT[0].toFixed(2)}, ${PIT[1].toFixed(2)})), 104.0);
          reflectedLight.directDiffuse *= pitFade;
          reflectedLight.indirectDiffuse *= pitFade;
          reflectedLight.directSpecular *= pitFade;
          reflectedLight.indirectSpecular *= pitFade;`);
    };
    mat.customProgramCacheKey = () => `${prevKey.call(mat)}-pitfade`;
  };
  if (!mapOld(7)) [M.step, M.shelf, M.shelfLip, M.floor, M.inlay, pitCarved].forEach((m) => m && pitFade(m));
  // And the tops of the bookcases, which stand to the head of the wall: from
  // the map each was a pale band inside its cell's rim, timber gone grey under
  // the moon, and the brightest cold thing left once the coping round it had
  // the lamps' light (mapFix4.js, 2). They take it too. (Chained on, as the
  // pit's is.)
  const routeLit = (mat) => {
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, renderer) => {
      prev?.call(mat, sh, renderer);
      sh.uniforms.uRouteMap = mapWarm;
      sh.uniforms.uRouteRooms = bounceRooms;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vRouteW;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vRouteW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vRouteW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uRouteMap;
          uniform vec3 uRouteRooms[${bounceRooms.value.length}];
          varying vec3 vRouteW;`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          if (uRouteMap > 0.0) {${walkNearGlsl('vRouteW').replaceAll('uBounceRooms', 'uRouteRooms')}
            float paved = uRouteMap * smoothstep(${(MASS_H + ROUTE_LIGHT.from[0]).toFixed(1)}, ${(MASS_H + ROUTE_LIGHT.from[1]).toFixed(1)}, vRouteW.y);
            vec3 routeLight = mix(vec3(1.0), vec3(${ROUTE_TINT.map((x) => x.toFixed(3)).join(', ')})
              * mix(${ROUTE_LIGHT.far.toFixed(3)}, ${ROUTE_LIGHT.k.toFixed(3)}, walkNear), paved);
            reflectedLight.directDiffuse *= routeLight;
            reflectedLight.indirectDiffuse *= routeLight;
            reflectedLight.directSpecular *= routeLight;
            reflectedLight.indirectSpecular *= routeLight;
          }`);
    };
    mat.customProgramCacheKey = () => `${prevKey.call(mat)}-route${bounceRooms.value.length}`;
  };
  if (ROUTE_ON) [M.shelf, M.shelfLip].forEach((m) => m && routeLit(m));
  // And the cone of lit air under the lamp hung in the drum, which was most of
  // that disc: looked down along its axis from the map it is a lit round foot
  // on the floor. Over the map it goes, inside the drum only and above the
  // well's own light (the column standing up from the bottom stays).
  if (!mapOld(7)) {
    const sh = shaftMaterial;
    sh.uniforms.uPitMap = mapWarm;
    const vert = sh.vertexShader
      .replace('varying float vOpen;', `varying float vOpen;
      varying vec3 vShaftW;`)
      .replace('gl_Position = projectionMatrix * mv;', `vShaftW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;`);
    const frag = sh.fragmentShader
      .replace('varying float vOpen;', `varying float vOpen;
      uniform float uPitMap;
      varying vec3 vShaftW;`)
      .replace('gl_FragColor = vec4(uColor, uStrength', `float pitOff = 1.0 - ${PIT_FADE.shaft.toFixed(2)} * uPitMap * step(-100.0, vShaftW.y)
          * step(distance(vShaftW.xz, vec2(${PIT[0].toFixed(2)}, ${PIT[1].toFixed(2)})), 104.0);
        gl_FragColor = vec4(uColor, pitOff * uStrength`);
    if (vert === sh.vertexShader || frag === sh.fragmentShader) console.warn('mapFix 7: the shaft shader has changed; the cone in the drum is left lit');
    else Object.assign(sh, { vertexShader: vert, fragmentShader: frag, needsUpdate: true });
  }

  // The readers far off in the galleries (`figure`), all one mesh.
  if (distantReaders.length) {
    const parts = distantReaders.map(({ p, y, ry }, i) => readerGeometry({
      seed: 101 + i * 17, color: ROBES[i % ROBES.length], book: i % 3 === 1, detail: 0.5,
    }).rotateY(ry).translate(p[0], y, p[1]));
    const mesh = new THREE.Mesh(keep(mergeGeometries(parts, false)), readerMaterial(keep).mat);
    parts.forEach((g) => g.dispose());
    mesh.name = 'distant-readers';
    root.add(mesh);
  }
  return { veil, setVeil };
}

export function buildCulling(ctx) {
  const { root, lodGroups, veil } = ctx;
  // ── What a reader at eye level cannot see ─────────────────────────────────
  // Everything past `reach` from the eye, by bounding sphere. From above,
  // nothing is culled.
  root.updateMatrixWorld(true);
  const cullable = (() => {
    const box = new THREE.Box3(), sphere = new THREE.Sphere();
    return root.children
      .filter((o) => (o.isMesh || o.isSprite) && o !== veil)
      .map((o) => {
        box.setFromObject(o);
        box.getBoundingSphere(sphere);
        return { o, c: sphere.center.clone(), r: sphere.radius };
      });
  })();
  let culling = false;
  // `near`: the eyes a gallery wall's books are drawn as boxes for, within
  // LOD_NEAR of its bounds (the reader's, and the far side of a doorway's);
  // past that, as its painted rows (`lodGroups`). With none, all are painted.
  const LOD_NEAR = 150;
  const cull = (eye, near = [], reach = 1600) => {
    if (!eye) {
      if (culling) cullable.forEach(({ o }) => { o.visible = true; });
      culling = false;
    } else {
      culling = true;
      for (const { o, c, r } of cullable) o.visible = c.distanceTo(eye) - r < reach;
    }
    for (const g of lodGroups) {
      const close = near.some((e) => g.c.distanceTo(e) - g.r < LOD_NEAR), shown = !culling || g.boxes.visible;
      g.boxes.visible = shown && close;
      g.rows.visible = shown && !close;
    }
  };
  return { cull };
}

export function buildOverlay(ctx) {
  const { hexPts, circlePts, R, cellC, ECHO_R, hallMid, PIT, DOOR, GATE, ENTRANCE, J, POND, PV,
    SHORE, BRIDGE, MAZE_ENTRY, HEART, ROAD } = ctx;
  // ── What the camera and the overlay need ─────────────────────────────────
  const top = MASS_H + CAP;
  const at = (p, y) => [p[0], y, p[1]];
  const fallPts = [];
  for (let s = 0; s <= 24; s++) {
    const t = s / 24, u = 1 - t;
    const ctrl = [(PIT[0] + DOOR[0]) / 2 + 40, 260, (PIT[1] + DOOR[1]) / 2 - 60];
    fallPts.push([
      u * u * PIT[0] + 2 * u * t * ctrl[0] + t * t * DOOR[0],
      u * u * 8 + 2 * u * t * ctrl[1] + t * t * 8,
      u * u * PIT[1] + 2 * u * t * ctrl[2] + t * t * DOOR[1],
    ]);
  }
  const FORK_MARK = 22, COURT_MARK = 46;
  const overlay = {
    rooms: [
      hexPts(cellC(0, 0), R).map((p) => at(p, top)),
      hexPts(cellC(1, -1), ECHO_R).map((p) => at(p, top)),
      hexPts(cellC(2, -2), R).map((p) => at(p, top)),
      circlePts(PIT, 101, 36).map((p) => at(p, top)),
      hexPts(DOOR, R).map((p) => at(p, top)),
      [[1085, 255], [1150, 180], [1240, 185], [1255, 275], [1175, 330], [1100, 335]].map((p) => at(p, 30)),
      Array.from({ length: 36 }, (_, k) => at([POND.c[0] + Math.cos((k / 36) * Math.PI * 2) * POND.rx, POND.c[1] + Math.sin((k / 36) * Math.PI * 2) * POND.rz], 8)),
      [[1170, 305], [1430, 305], [1430, 535], [1170, 535]].map((p) => at(p, 22)),
    ],
    // What the map stands a room's numeral over, where that is not the top
    // of everything a reader may point at (mapFix3.js, 5): the Fork is the
    // place the gravel divides, and the Web of Time the court at the maze's
    // heart. (The Fork's numeral stood over the top of its ground, on dark
    // lawn left of the pond; the Web's at the maze's mouth.) Nothing is
    // drawn of them: a round of ground about the place, for its top.
    marks: map3Old(5) ? [] : [
      null, null, null, null, null,
      circlePts(J, FORK_MARK, 24).map((p) => at(p, 8)),
      null,
      circlePts(HEART, COURT_MARK, 24).map((p) => at(p, 8)),
    ],
    walk: [ENTRANCE, cellC(0, 0), hallMid(0, 0, 5), cellC(1, -1), hallMid(1, -1, 5), cellC(2, -2), hallMid(2, -2, 5), PIT].map((p) => at(p, 8)),
    gardenWalk: [DOOR, GATE, J, [1216, 218], SHORE, ...BRIDGE.slice(1), PV].map((p) => at(p, 8)),
    mazeLeg: [[1315, 212], [1311, 266], MAZE_ENTRY, HEART].map((p) => at(p, 8)),
    notTaken: ROAD.pts.map((p) => at(p, 8)),
    fall: fallPts,
    pit: at(PIT, 8),
  };
  return { at, overlay };
}
