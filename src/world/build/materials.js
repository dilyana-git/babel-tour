// The world's materials (buildWorld.js, assembleWorld): the stone and its
// shading (`stoneShade`), the wood, the books, the lamps and halos, and the
// geometry helpers and batches the sections after it build with.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makePaperMaterial, makeFlameMaterial, waxGlowMaterial, LAMPS, floorPoolPatch, shadeLit, floorPools } from '../lampPass';
import { bayPlates, shelfEdge, FOLIAGE_KINDS, HANGING_KINDS } from '../textures';
import { makeBookMaterial, makeGlowMaterial, makeLampGlobeMaterial, makeFoliageMaterial, makeFoliagePrepass, makeHangingMaterial, GRAZE } from '../effects';
import { WATER_Y } from '../water';
import { makeFlowerMaterial } from '../pond';
import { drumUvGlsl } from '../echoFix';
import { LIP_COLOR } from '../vertigoFix';
import { silenceOld, ARCH_LIFT, deadGlassPatch } from '../silenceFix';
import { forkOld, RAKE, WAYMARK } from '../forkFix';
import { WILLOW_BROAD } from '../pavilionFix';
import { propsOld, HEDGE_SHEEN } from '../forkProps';
import { DARK_GILT, CAIHUA, pavPropsOld, WILLOW } from '../pavilionProps';
import { bladeLit } from '../lawn';
import { WALLS } from '../webFix';
import { FILLET_BRASS, deadOpal } from '../auditFix';
import { webPropsOld } from '../webProps';
import { FEATHER, signLit, SIGN, garden5Old, plinthLit, PLINTH } from '../gardenFix5';
import { mapOld } from '../mapFix';
import { map3Old, QUIET } from '../mapFix3';
import { map4Old } from '../mapFix4';
import { map5Old } from '../mapFix5';
import { TONE } from '../mapFix6';
import { lib3Old, ECHO_STONE, STRING, COLOUR } from '../libFix3';
import { doorPropsOld } from '../doorProps';
import { softGain } from '../lightModel';
import { WOOD_OLD, uvGrain } from '../woodGrain';
import { crackSize, CRACK_SLOPE } from '../cracks';
import { RUBBLE_TILE } from '../rubble';
import { shoreRockLit, bankLit } from '../shore';
import { backPaler, ivyLeafTexture } from '../ivy';
import { DOOR_CRACKS, stoneTint, HEDGE_DIAL, ROUTE_LIGHT, MASS_H, CAP, RIM_WARM, FLOOR_OLD, CRACK_OLD, deg } from './common';

export function buildMaterials(ctx) {
  const { light, rr, dir, add, unit2, dist, keep, grassTex, GRAVEL_COLOR, gravelTex, starTex,
    roofTex, radialTex, wisteriaTex, ivyTex, again, flag, crackMap, wall, pale, wood, whiteTex,
    timber, spines, titles, bookRowsSet, friezeTex, gilt, hedge, carveSet, rubbleSet, shoreRockSet,
    shoreBankSet, dressedSet, marbleSet, columnSet, hangTex, glowTex, lampHaloTex, wind, lilyPads,
    leaves, barkSet, gradTex, wornTex, dustFanTex, mossTex, leafTex, globeTex } = ctx;
  // ── Materials ─────────────────────────────────────────────────────────────
  const Std = (o) => keep(new THREE.MeshStandardMaterial(o));
  // the pond, for the stones' wet line (filled in where POND is laid out)
  const shorePond = { c: [0, 0], rx: 1, rz: 1 };
  // Walls are dirtiest where feet and smoke reach them: darker over the bottom
  // metre, where the floor is swept against them, and sooted toward the top,
  // where the lamps' heat has carried it for centuries. By height in the world
  // — the stone's texture tiles every 38 units, so no painted grime could know
  // where the floor is.
  //
  // And stone turned DOWN — the soffit of an arch, the underside of a bridge or
  // a stair — takes a little of the lamplit floor's light back up, warm. With
  // nothing to lift them those faces went flat black, which no lit room has.
  // By room (`bounceRooms`, filled once the honeycomb is laid out): strongest
  // in the Vestibule, least in the Silence.
  const bounceRooms = { value: [new THREE.Vector3(0, 0, 0)] };
  // the Echo: its middle, and how far its worked stone reaches (libFix3.js, 4)
  const workAt = { value: new THREE.Vector3(0, 0, -1) };
  // the Vestibule's string course, and the wall it washes (libFix3.js, 6):
  // `a` the middle of the wall's face (x, z), the ledge's height, how much;
  // `b` the way along the wall (x, z) and half its length
  const stringWash = { a: { value: new THREE.Vector4(0, 0, 0, 0) }, b: { value: new THREE.Vector4(1, 0, 1, 0) } };
  // And over the map, the coping round each of those rooms warmed from inside,
  // most at its inner edge (mapFix.js, 8): `mapWarm` is how much of the map
  // is showing — 1 over it, 0 among the walls (setVeil).
  const RIM = !mapOld(8);
  const mapWarm = { value: 1 };
  // (from each room's own inner wall: the Echo's stands further out, so its
  // coping is that much further out too — `echoDeep`, set once the rooms are
  // laid out — and its worked stone stops under the wall tops; mapFix5.js, 1)
  const ECHO_TOPS = !map5Old(1);
  const echoDeep = { value: 0 };
  // And the stone of every cell that is not a room of the walk, quiet over the
  // map (mapFix3.js, 3): `quiet` stone loses its blocks, its relief and some
  // of its light out past the walk's rooms, and `sink` stone — the balustrades
  // on the wall tops — is let down into the coping there. (How dark, and how
  // warm, is the hand-over's to say where one is picked: mapFix3.js, 2.)
  const QUIET_ON = !map3Old(3);
  const QUIET_TINT = TONE.quiet;
  // And the light on the wall tops over the map, the lamps' colour (mapFix4.js,
  // 2): what the moon's light on that stone is multiplied by to be the lamps'
  // at the same brightness — `ROUTE_TINT` — before `k` or `far` of it is left.
  const ROUTE_ON = !map4Old(2);
  const ROUTE_TINT = (() => {
    const lamp = new THREE.Color(ROUTE_LIGHT.color), sky = new THREE.Color(ROUTE_LIGHT.moon);
    const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const even = lum(sky) / lum(lamp);
    return [lamp.r / sky.r, lamp.g / sky.g, lamp.b / sky.b].map((x) => 1 + (x * even - 1) * ROUTE_LIGHT.warm);
  })();
  const walkNearGlsl = (at) => `
            float walkNear = 0.0;
            for (int i = 0; i < ${bounceRooms.value.length}; i++) {
              vec2 d = ${at}.xz - uBounceRooms[i].xy;
              float hex = max(abs(d.y), max(abs(dot(d, vec2(0.8660254, 0.5))), abs(dot(d, vec2(-0.8660254, 0.5)))));
              walkNear = max(walkNear, smoothstep(${QUIET.near[1].toFixed(1)}, ${QUIET.near[0].toFixed(1)}, hex));
            }`;
  // `drum` (the Echo's walls, echoFix.js point 6): the maps laid by the
  // fragment's own place on the wall, in courses that grow lower as it rises,
  // rather than by the projected uv — { tile, rep }: the tile's size in world
  // units and the maps' repeat.
  // `lift`: how much more of that bounce this stone takes, and `side` how much
  // of it a face standing upright takes too — it sees half the floor that a
  // soffit does (the Silence's arches over its well: silenceFix.js, 4)
  // `night`: the falloff into the night round the maze alone, without the
  // weathering by height (the copings on the walls, webFix.js 2).
  // `aged` (with `weather`; the galleries' walls, libFix3.js point 3): the
  // weathering by height made uneven, as it is — the dirt climbing higher in
  // some places than others, the soot hanging from the top of the wall in
  // tongues, and lime bloomed pale on the faces between, in slow patches.
  // `worked` (the Echo's carved stone, libFix3.js point 4; { polish, joints,
  // foot }): inside the Echo (`workAt`) the stone is not one flat value — its
  // tone uneven, what faces down sooted, what faces up a little paler and worn
  // to a soft polish (`polish`: how much of ECHO_STONE's this stone takes),
  // its joints darker (`joints`), and (`foot`) dark toward the floor where a
  // column stands on it.
  // `wash`: the stone the Vestibule's string course throws its lamp-rail's
  // light up (`stringWash`).
  // `route`: the stone of the wall tops and of the heads of the walls under
  // them, which over the map takes the lamps' light for the moon's
  // (mapFix4.js, 2).
  const stoneShade = (mat, { weather = false, night = false, drum = null, lift = 1, side = 0, quiet = false, sink = false, aged = false, worked = null, wash = false, route = false } = {}) => {
    wash = wash && !lib3Old(6);
    route = route && ROUTE_ON;
    quiet = quiet && QUIET_ON;
    sink = sink && QUIET_ON;
    aged = aged && weather && !lib3Old(3);
    worked = lib3Old(4) ? null : worked;
    // (where the stone stands, instance by instance)
    const placed = night || quiet || sink;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBounceRooms = bounceRooms;
      if (RIM || quiet || sink || route) sh.uniforms.uMapWarm = mapWarm;
      sh.uniforms.uStoneLift = { value: lift };
      if (worked) sh.uniforms.uWorkAt = workAt;
      if (wash) { sh.uniforms.uWashA = stringWash.a; sh.uniforms.uWashB = stringWash.b; }
      sh.uniforms.uStoneSide = { value: side };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vStoneW;
          varying float vStoneDown;
          varying float vStoneSide;
          ${sink ? `uniform vec3 uBounceRooms[${bounceRooms.value.length}];
          uniform float uMapWarm;` : ''}
          ${placed ? 'varying vec3 vStoneAt;' : ''}
          ${drum ? 'varying vec3 vStoneN;' : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vStoneW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          ${placed ? `
          // (where it stands, for the night: a post is an instance, and its
          // own vertices are a unit box at the origin — the balusters on the
          // wall tops stayed white over the cedars: webProps.js, 1)
          vec4 stoneAt = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            stoneAt = instanceMatrix * stoneAt;
          #endif
          vStoneAt = (modelMatrix * stoneAt).xyz;` : ''}
          ${sink ? `
          // the balustrade of a cell that is not a room of the walk, let down
          // into the coping it stands on while the map shows (a post is a unit
          // box about its own middle; a rail is laid where it stands)
          if (uMapWarm > 0.0) {${walkNearGlsl('vStoneAt')}
            float sunk = uMapWarm * (1.0 - walkNear);
            #ifdef USE_INSTANCING
              transformed.y = mix(transformed.y, -0.62, sunk);
            #else
              transformed.y = mix(transformed.y, ${(MASS_H + CAP - 1.2).toFixed(1)}, sunk);
            #endif
          }` : ''}`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vStoneDown = max(0.0, -normalize(mat3(modelMatrix) * objectNormal).y);
          vStoneSide = 1.0 - abs(normalize(mat3(modelMatrix) * objectNormal).y);
          ${drum ? 'vStoneN = mat3(modelMatrix) * objectNormal;' : ''}`);
      if (drum) {
        // (every map read in main() reads this uv instead of the vertex's)
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', `varying vec3 vStoneN;
          ${drumUvGlsl(drum.tile.toFixed(2), drum.rep.toFixed(6))}
          vec2 drumUv;
          #define vMapUv drumUv
          #define vNormalMapUv drumUv
          #define vRoughnessMapUv drumUv
          void main() {
            drumUv = drumUvOf(vStoneW, normalize(vStoneN));`);
      }
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uBounceRooms[${bounceRooms.value.length}];
          ${RIM || quiet || route ? 'uniform float uMapWarm;' : ''}
          uniform float uStoneLift;
          uniform float uStoneSide;
          varying vec3 vStoneW;
          varying float vStoneDown;
          varying float vStoneSide;
          ${placed ? 'varying vec3 vStoneAt;' : ''}
          ${worked ? 'uniform vec3 uWorkAt;' : ''}
          ${wash ? 'uniform vec4 uWashA, uWashB;' : ''}
          ${aged || worked ? `float stoneHash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
          float stoneNoise3(vec3 x) {
            vec3 i = floor(x), f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(stoneHash3(i), stoneHash3(i + vec3(1, 0, 0)), f.x), mix(stoneHash3(i + vec3(0, 1, 0)), stoneHash3(i + vec3(1, 1, 0)), f.x), f.y),
              mix(mix(stoneHash3(i + vec3(0, 0, 1)), stoneHash3(i + vec3(1, 0, 1)), f.x), mix(stoneHash3(i + vec3(0, 1, 1)), stoneHash3(i + vec3(1, 1, 1)), f.x), f.y),
              f.z);
          }` : ''}`)
        // (the unwalked cells' stone over the map: mapFix3.js, 3)
        .replace('#include <map_fragment>', `#include <map_fragment>
          float mapQuiet = 0.0;
          ${quiet ? `
          if (uMapWarm > 0.0) {${walkNearGlsl('vStoneAt')}
            mapQuiet = uMapWarm * (1.0 - walkNear);
            // its blocks: the stone in its one mean colour (the map's last mip)
            #ifdef USE_MAP
              vec3 stoneMean = texture2D(map, vMapUv, 12.0).rgb;
              diffuseColor.rgb *= mix(vec3(1.0), stoneMean / max(sampledDiffuseColor.rgb, vec3(0.04)), ${QUIET.flat.toFixed(2)} * mapQuiet);
            #endif
            diffuseColor.rgb *= mix(vec3(1.0), vec3(${QUIET_TINT.map((x) => x.toFixed(3)).join(', ')}), mapQuiet);
          }` : ''}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          ${quiet ? `normal = normalize(mix(normal, nonPerturbedNormal, ${QUIET.relief.toFixed(2)} * mapQuiet));` : ''}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          ${weather || night ? `
            ${night ? 'vec3 stoneP = vStoneAt;' : 'vec3 stoneP = vStoneW;'}
            // the honeycomb's walls standing round the maze, let fall into
            // the night: from the court at its heart they were blank brick
            // filling the sky behind the hedges, and the walk ended against a
            // warehouse. (The heart at 1315, 423; the Door's own cell, at
            // 1005, 339, kept as it was — its walls are a room from inside.)
            float stoneNight = (1.0 - 0.88 * smoothstep(290.0, 160.0, distance(stoneP.xz, vec2(1315.0, 423.0)))
              * smoothstep(100.0, 118.0, distance(stoneP.xz, vec2(1005.2, 338.6))))
            // and behind the maze, out past that reach, the stone the cedars
            // stand in front of (webFix.js, 2): what shows between their
            // spires is dark, not brick
              * (1.0 - ${WALLS.k.toFixed(3)} * smoothstep(${WALLS.z[0].toFixed(1)}, ${WALLS.z[1].toFixed(1)}, stoneP.z)
              * smoothstep(${WALLS.x[0].toFixed(1)}, ${WALLS.x[1].toFixed(1)}, stoneP.x));
            ${aged ? `
            // (ageA runs long down the wall, ageB is slow, ageC a block or two across)
            float ageA = stoneNoise3(vStoneW * vec3(0.085, 0.011, 0.085));
            float ageB = stoneNoise3(vStoneW * vec3(0.03, 0.022, 0.03) + 17.3);
            float ageC = stoneNoise3(vStoneW * 0.21 + 5.7);
            float ageFoot = smoothstep(6.0, 11.0 + 24.0 * ageB * (0.5 + ageA), vStoneW.y);
            float ageSoot = smoothstep(62.0 + 44.0 * ageA, 126.0, vStoneW.y) * (0.6 + 0.4 * ageB);
            float ageLime = smoothstep(0.56, 0.8, ageB * 0.65 + ageC * 0.35) * smoothstep(10.0, 26.0, vStoneW.y) * (1.0 - smoothstep(64.0, 96.0, vStoneW.y));
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + vec3(0.03, 0.029, 0.026), 0.55 * ageLime);
            diffuseColor.rgb *= mix(0.6, 1.0, ageFoot) * (1.0 - 0.42 * ageSoot) * (0.9 + 0.2 * ageC) * stoneNight;` : `
            diffuseColor.rgb *= ${weather ? `mix(0.66, 1.0, smoothstep(6.0, 17.0, vStoneW.y))
            * (1.0 - 0.3 * smoothstep(88.0, 124.0, vStoneW.y))
            *` : ''} stoneNight;`}` : ''}
          float stoneWork = 0.0;
          ${worked ? `
          stoneWork = uWorkAt.z > 0.0 ? smoothstep(uWorkAt.z + 10.0, uWorkAt.z - 2.0, distance(vStoneW.xz, uWorkAt.xy)) : 0.0;
          ${ECHO_TOPS ? `stoneWork *= 1.0 - smoothstep(${(MASS_H - 1).toFixed(1)}, ${(MASS_H - 0.2).toFixed(1)}, vStoneW.y);` : ''}
          if (stoneWork > 0.0) {
            float workA = stoneNoise3(vStoneW * 0.11 + 3.1), workB = stoneNoise3(vStoneW * 0.62 + 9.2);
            float workUp = max(0.0, 1.0 - vStoneSide - vStoneDown);
            float workTone = (1.0 + ${ECHO_STONE.tone.toFixed(3)} * (workA - 0.5) + ${(ECHO_STONE.tone * 0.45).toFixed(3)} * (workB - 0.5))
              * (1.0 - ${ECHO_STONE.soffit.toFixed(3)} * smoothstep(0.12, 0.8, vStoneDown)) * (1.0 + ${ECHO_STONE.up.toFixed(3)} * workUp);
            // (and what has run down its upright faces over the years, in streaks)
            workTone *= 1.0 - ${ECHO_STONE.streak.toFixed(3)} * vStoneSide * smoothstep(0.5, 0.85, stoneNoise3(vStoneW * vec3(0.8, 0.06, 0.8) + 2.9));
            ${worked.joints ? `#ifdef USE_MAP
              workTone *= 1.0 - ${(ECHO_STONE.joints * worked.joints).toFixed(3)} * (1.0 - smoothstep(0.05, 0.2, dot(sampledDiffuseColor.rgb, vec3(0.333))));
            #endif` : ''}
            ${worked.foot ? 'workTone *= mix(0.72, 1.0, smoothstep(6.0, 18.0 + 14.0 * workA, vStoneW.y));' : ''}
            diffuseColor.rgb *= mix(vec3(1.0), workTone * vec3(1.0 + 0.1 * (workA - 0.5), 1.0, 1.0 - 0.14 * (workA - 0.5)), stoneWork);
          }` : ''}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          ${worked?.polish ? `roughnessFactor = mix(roughnessFactor, ${ECHO_STONE.polish.toFixed(3)},
            stoneWork * ${worked.polish.toFixed(3)} * max(0.0, 1.0 - vStoneSide - vStoneDown) * (0.55 + 0.6 * stoneNoise3(vStoneW * 0.35 + 1.7)));` : ''}`)
        // (and its gloss with it, webFix.js 2: let fall in its colour alone,
        // the stone would keep the sky in its sheen and still read as brick)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
          ${(weather || night) && WALLS.spec ? `reflectedLight.directSpecular *= stoneNight;
          reflectedLight.indirectSpecular *= stoneNight;` : ''}
          ${route ? `
          // the wall tops over the map: the light on them the lamps' colour,
          // and less of it — most taken round the rooms of the walk, where
          // the paving was the brightest thing on the page (mapFix4.js, 2)
          if (uMapWarm > 0.0) {
            float paved = uMapWarm * smoothstep(${(MASS_H + ROUTE_LIGHT.from[0]).toFixed(1)}, ${(MASS_H + ROUTE_LIGHT.from[1]).toFixed(1)}, ${placed ? 'vStoneAt' : 'vStoneW'}.y);
            vec3 routeLight = mix(vec3(1.0), vec3(${ROUTE_TINT.map((x) => x.toFixed(3)).join(', ')})
              * mix(${ROUTE_LIGHT.k.toFixed(3)}, ${ROUTE_LIGHT.far.toFixed(3)}, mapQuiet / uMapWarm), paved);
            reflectedLight.directDiffuse *= routeLight;
            reflectedLight.indirectDiffuse *= routeLight;
            reflectedLight.directSpecular *= routeLight;
            reflectedLight.indirectSpecular *= routeLight;
          }` : ''}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float bounce = 0.0;
          for (int i = 0; i < ${bounceRooms.value.length}; i++) {
            bounce = max(bounce, uBounceRooms[i].z * smoothstep(130.0, 80.0, distance(vStoneW.xz, uBounceRooms[i].xy)));
          }
          ${wash ? `
          if (uWashA.w > 0.0) {
            // the lamp-rail on the string course's ledge: up the face over it,
            // strongest just above the ledge, let go toward the wall's ends
            vec2 washD = vStoneW.xz - uWashA.xy;
            float washUp = vStoneW.y - uWashA.z;
            float washOn = (1.0 - smoothstep(uWashB.z - 14.0, uWashB.z, abs(dot(washD, uWashB.xy))))
              * (1.0 - smoothstep(3.0, 5.0, abs(washD.x * uWashB.y - washD.y * uWashB.x)))
              * smoothstep(-4.4, -1.5, washUp) * exp(-max(washUp, 0.0) / ${STRING.fall.toFixed(1)});
            totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.72, 0.44) * uWashA.w * washOn;
          }` : ''}
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.72, 0.46) * 0.2 * bounce * uStoneLift * (vStoneDown + uStoneSide * 0.5 * vStoneSide)
            * smoothstep(60.0, 20.0, vStoneW.y);
          ${RIM ? `
          // the rims of the walk's rooms, over the map: by the flat (hexagon)
          // distance from the room's middle, warm from its inner wall out
          // across the coping, and only up at the wall tops
          if (uMapWarm > 0.0) {
            float rim = 0.0;
            for (int i = 0; i < ${bounceRooms.value.length}; i++) {
              vec2 d = vStoneW.xz - uBounceRooms[i].xy;
              float hex = max(abs(d.y), max(abs(dot(d, vec2(0.8660254, 0.5))), abs(dot(d, vec2(-0.8660254, 0.5)))));
              // (the Echo's inner wall further out, its outer edge where every cell's is)
              float rimIn = ${RIM_WARM.inner.toFixed(1)}${ECHO_TOPS ? ` + (i == 1 ? ${echoDeep.value.toFixed(2)} : 0.0)` : ''};
              rim = max(rim, smoothstep(${RIM_WARM.outer.toFixed(1)}, rimIn, hex));
            }
            totalEmissiveRadiance += diffuseColor.rgb * vec3(${RIM_WARM.color.map((x) => x.toFixed(2)).join(', ')})
              * ${RIM_WARM.k.toFixed(3)} * rim * uMapWarm * smoothstep(${(MASS_H - 14).toFixed(1)}, ${(MASS_H - 2).toFixed(1)}, vStoneW.y);
          }` : ''}`);
    };
    mat.customProgramCacheKey = () => `babel-stone-${weather ? 'w' : night ? 'n' : 'b'}${(weather || night) && WALLS.spec ? 's' : ''}${drum ? '-drum' : ''}-${bounceRooms.value.length}${RIM ? '-rim' : ''}${quiet ? '-quiet' : ''}${route ? '-route' : ''}${sink ? '-sink' : ''}${aged ? '-aged' : ''}${worked ? `-work${worked.polish ?? 0}${worked.joints ?? 0}${worked.foot ? 'f' : ''}` : ''}${wash ? '-wash' : ''}`;
    return mat;
  };
  // Less of the sky in a surface's gloss, `k` of it, and `direct` of the
  // lamps'. (three takes no envMapIntensity from a material while the scene
  // has an environment, so it is done after the lighting.)
  const skyDull = (mat, k, direct = 1) => {
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectSpecular *= ${k.toFixed(2)};
        reflectedLight.directSpecular *= ${direct.toFixed(2)};`);
    };
    mat.customProgramCacheKey = () => `babel-skydull-${k.toFixed(2)}-${direct.toFixed(2)}`;
    return mat;
  };
  // The rails' lacquer, worn (pavilionProps.js, 10). What a member carries in
  // its vertices' colour is not a colour: red is how clean the lacquer is
  // there, green how far it is rubbed through to the wood (`wornBar`). Both
  // are broken up by the place they are at — in patches a pace across, and
  // along the timber's own grain — so that a rail is rubbed through in
  // lengths and not in a stripe; and the lacquer between is never one red.
  // Where it is whole it is a little glossier than it was, a soft sheen;
  // where it is grimed or gone, matte.
  const wornLacquer = (mat) => {
    const wood = new THREE.Color('#654a33');
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWornAt;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vWornAt = position;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWornAt;
          float wornRub = 0.0;
          float wornClean = 1.0;
          float wornHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
          float wornNoise(vec3 x) {
            vec3 i = floor(x), f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(wornHash(i), wornHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(wornHash(i + vec3(0.0, 1.0, 0.0)), wornHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
              mix(mix(wornHash(i + vec3(0.0, 0.0, 1.0)), wornHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(wornHash(i + vec3(0.0, 1.0, 1.0)), wornHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
          }`)
        .replace('#include <color_fragment>', `
          {
            float wornPatch = wornNoise(vWornAt * 0.55) * 0.65 + wornNoise(vWornAt * 2.3) * 0.35;
            float wornGrain = 0.5;
            #ifdef USE_ROUGHNESSMAP
              wornGrain = texture2D(roughnessMap, vRoughnessMapUv).g;
            #endif
            wornClean = mix(1.0, vColor.r, 0.55 + 0.45 * wornPatch);
            wornRub = smoothstep(0.5, 0.82, vColor.g + (wornPatch - 0.5) * 0.4 + (wornGrain - 0.5) * 0.3);
            diffuseColor.rgb *= mix(0.88, 1.06, wornPatch);
            // (round what is rubbed through, the lacquer thinned to its dark ground)
            diffuseColor.rgb *= 1.0 - 0.45 * wornRub * (1.0 - wornRub) * 4.0;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${wood.r.toFixed(4)}, ${wood.g.toFixed(4)}, ${wood.b.toFixed(4)}) * (0.75 + 0.5 * wornGrain), wornRub);
            diffuseColor.rgb *= wornClean;
          }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor * 0.72, 0.92, wornRub);
          roughnessFactor = mix(roughnessFactor, 0.95, (1.0 - wornClean) * 0.9);`);
    };
    mat.customProgramCacheKey = () => 'babel-worn-lacquer';
    return mat;
  };
  // The moon on a hedge's shoulder and top, from across the garden only
  // (forkProps.js, 6). Close to there is none: a pale band along every top is
  // the first thing that looks wrong in a maze. Far off, without it, the hedge
  // that closes the garden is a stripe of black with nothing to say where its
  // top is. Laid on what the skyDull above left.
  const hedgeMoon = (mat) => {
    if (propsOld(6) || HEDGE_SHEEN.k <= 0) return mat;
    const inner = mat.onBeforeCompile, key = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, renderer) => {
      inner(sh, renderer);
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 hedgeN = inverseTransformDirection(normal, viewMatrix);
          float hedgeFar = smoothstep(${HEDGE_SHEEN.near.toFixed(1)}, ${HEDGE_SHEEN.far.toFixed(1)}, length(vViewPosition));
          totalEmissiveRadiance += diffuseColor.rgb * vec3(0.6, 0.74, 0.92) * ${HEDGE_SHEEN.k.toFixed(3)} * hedgeFar * smoothstep(0.2, 0.8, hedgeN.y);
        }`);
    };
    mat.customProgramCacheKey = () => `${key()}-moon-${HEDGE_SHEEN.k}`;
    return mat;
  };
  // The pavement, every slab its own. The painted tile is three metres of
  // floor, and a room is five of them across: the same slab, shade for shade,
  // came round again and again. `paving` (textures.js) writes into the
  // roughness map's spare channels which slab a pixel is (red) and which
  // repeat of the tile that slab began in (blue); with the repeat this pixel
  // is in, that names one slab of the whole floor, and each takes its own
  // shade, warmth, sheen and lie from it. Over that, the slow change of tone a
  // floor has across metres. (The slab's part fades out where a slab is down to
  // a few pixels — there the mips have mixed one slab's number with the next's.)
  const pave = { vary: { value: 1 } };
  if (import.meta.env?.DEV && typeof window !== 'undefined') window.__pave = (v) => { if (v !== undefined) pave.vary.value = v; return pave.vary.value; };
  // The cracks in the Door's pavement (cracks.js) are in the same stone, read
  // where the floor falls inside their map: their slope added to the slab's,
  // the open crack darkened and the flaked stone paler. The floor's uv is the
  // world's x and z (uvWorld) and the map lies in the breach's frame, so the
  // one is turned into the other here; off the cracks the map is neutral.
  const crackFrame = (() => {
    const { origin: o, along: t, into: n, a0, a1, b0, b1 } = DOOR_CRACKS;
    return {
      uCrackMap: { value: crackMap },
      uCrackO: { value: new THREE.Vector2(o[0] + t[0] * a0 + n[0] * b0, o[1] + t[1] * a0 + n[1] * b0) },
      uCrackAxes: { value: new THREE.Vector4(t[0] / (a1 - a0), t[1] / (a1 - a0), n[0] / (b1 - b0), n[1] / (b1 - b0)) },
      uCrackTexels: { value: new THREE.Vector2(crackSize(DOOR_CRACKS).w, crackSize(DOOR_CRACKS).h) },
    };
  })();
  const paveShade = (mat) => {
    if (FLOOR_OLD) return mat;
    const texels = (mat.roughnessMap.image?.width ?? 1024).toFixed(1);
    const tile = (1 / mat.roughnessMap.repeat.x).toFixed(4);
    // (sampled with its own gradients: a pixel's neighbours may be off the map)
    const cracks = CRACK_OLD ? '' : `
          vec2 crackW = vRoughnessMapUv * ${tile} - uCrackO;
          vec2 crackUv = vec2(dot(crackW, uCrackAxes.xy), 1.0 - dot(crackW, uCrackAxes.zw));
          vec2 crackDx = dFdx(crackUv), crackDy = dFdy(crackUv);
          if (all(greaterThan(crackUv, vec2(0.0))) && all(lessThan(crackUv, vec2(1.0)))) {
            vec3 ck = (textureGrad(uCrackMap, crackUv, crackDx, crackDy).rgb * 255.0 - 128.0) / 127.0;
            crackSlope = sign(ck.xy) * ck.xy * ck.xy * ${CRACK_SLOPE.toFixed(1)};
            // Up close a texel of the map spans several pixels, and the edge of
            // a crack would blur across them: its outline (where the dirt at its
            // edge, under 0.45, gives way to the gap, over it) is drawn crisp
            // instead, as broken stone's is, by as much as the map is magnified.
            float crackMag = max(1.0, 1.0 / max(length(crackDx * uCrackTexels), length(crackDy * uCrackTexels)));
            float crackRaw = max(-ck.z, 0.0), crackPale = max(ck.z, 0.0);
            float crackIn = clamp((crackRaw - 0.45) * (1.0 + 0.8 * (crackMag - 1.0)) + 0.5, 0.0, 1.0);
            float crackSharp = mix(min(crackRaw, 0.27), max(crackRaw, 0.6), crackIn);
            crackDark = mix(crackRaw, crackSharp, min(1.0, crackMag - 1.0));
            diffuseColor.rgb *= (1.0 - 0.94 * crackDark) * (1.0 + 0.7 * crackPale);
            roughnessFactor = clamp(roughnessFactor + 0.3 * crackDark, 0.0, 1.0);
          }`;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uPaveVary = pave.vary;
      if (!CRACK_OLD) Object.assign(sh.uniforms, crackFrame);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uPaveVary;
          uniform sampler2D uCrackMap;
          uniform vec2 uCrackO;
          uniform vec4 uCrackAxes;
          uniform vec2 uCrackTexels;
          vec3 paveHash(vec3 p) {
            p = fract(p * vec3(0.1031, 0.1030, 0.0973));
            p += dot(p, p.yxz + 33.33);
            return fract((p.xxy + p.yxx) * p.zyx);
          }
          float paveNoise(vec2 x) {
            vec2 i = floor(x), f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(paveHash(vec3(i, 3.7)).x, paveHash(vec3(i + vec2(1.0, 0.0), 3.7)).x, f.x),
              mix(paveHash(vec3(i + vec2(0.0, 1.0), 3.7)).x, paveHash(vec3(i + vec2(1.0, 1.0), 3.7)).x, f.x), f.y);
          }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          vec2 paveFw = fwidth(vRoughnessMapUv) * ${texels};
          float paveNear = uPaveVary * (1.0 - smoothstep(6.0, 28.0, max(paveFw.x, paveFw.y)));
          vec3 paveSlab = vec3(floor(vRoughnessMapUv) - vec2(floor(texelRoughness.b * 2.0 + 0.5) - 1.0, 0.0), floor(texelRoughness.r * 15.9375)) + vec3(0.37, 0.71, 0.13);
          vec3 paveH = paveHash(paveSlab) - 0.5;
          vec3 paveT = paveHash(paveSlab + 19.19) - 0.5;
          float paveMacro = paveNoise(vRoughnessMapUv * 0.45) * 0.65 + paveNoise(vRoughnessMapUv * 1.3 + 17.0) * 0.35;
          diffuseColor.rgb *= (1.0 + paveNear * 0.17 * paveH.x) * (1.0 + uPaveVary * 0.14 * (paveMacro - 0.5))
            * vec3(1.0 + paveNear * 0.06 * paveH.y, 1.0, 1.0 - paveNear * 0.08 * paveH.y);
          roughnessFactor = clamp(roughnessFactor + paveNear * 0.1 * paveH.z + uPaveVary * 0.08 * (paveMacro - 0.5), 0.0, 1.0);
          vec2 paveTilt = paveNear * 0.028 * paveT.xy;
          vec2 crackSlope = vec2(0.0);
          float crackDark = 0.0;${cracks}`)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
          reflectedLight.directSpecular *= 1.0 - 0.9 * crackDark;
          reflectedLight.indirectSpecular *= 1.0 - 0.9 * crackDark;`)
        .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale;\n\tmapN.xy += paveTilt + crackSlope;'));
    };
    mat.customProgramCacheKey = () => 'babel-pave';
    return mat;
  };
  // The lamps' pools read by the floor, not laid over it (lampPass.js)
  const lpPool = (mat) => (LAMPS.pool ? floorPoolPatch(mat) : mat);
  // The way, shown rather than explained: while the reader is on the piece's
  // own way (World.jsx, `follow`), the stone worn smooth along it catches a
  // little warm light a few strides ahead of them, and lets it go when they
  // leave the way. Only the worn strips take it (M.wornFloor, M.wornStep), and
  // they lie only along the way. World sets where the feet are, which way the
  // way runs on from them, and how much (`setWay`). ?wway=0: never.
  const WAY_SHOWN = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('wway') !== '0';
  // how much light it catches at the full of it (?wwaygain= to try another)
  const WAY_GAIN = (typeof window !== 'undefined' && Number(new URLSearchParams(window.location.search).get('wwaygain'))) || 0.9;
  const wayU = { uWay: { value: new THREE.Vector4(0, 0, 0, -1) }, uWayY: { value: 0 }, uWayOn: { value: 0 } };
  const wayLit = (mat, key) => {
    if (!WAY_SHOWN) return mat;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, wayU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWayW;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vWayW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec4 uWay;
          uniform float uWayY, uWayOn;
          varying vec3 vWayW;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            // from about two strides ahead (where the floor comes into view at
            // eye level) to about seven, fading either side of the way and where
            // the stone is well above or below the feet (another floor)
            vec2 wd = vWayW.xz - uWay.xy;
            float wAlong = dot(wd, uWay.zw);
            float wAcross = abs(wd.x * uWay.w - wd.y * uWay.z);
            float wRise = abs(vWayW.y - uWayY) - 0.6 * max(wAlong, 0.0);
            float wayGlow = uWayOn * smoothstep(8.0, 18.0, wAlong) * (1.0 - smoothstep(38.0, 66.0, wAlong))
              * (1.0 - smoothstep(7.0, 13.0, wAcross)) * (1.0 - smoothstep(6.0, 12.0, wRise));
            totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.76, 0.46) * ${WAY_GAIN.toFixed(3)} * wayGlow;
          }`);
    };
    mat.customProgramCacheKey = () => `babel-way-${key}`;
    return mat;
  };
  // where the feet are (x, y, z), the way on from them (dx, dz, level), how much
  const setWay = (amount, x = 0, y = 0, z = 0, dx = 0, dz = -1) => {
    wayU.uWayOn.value = amount;
    if (amount > 0) {
      wayU.uWay.value.set(x, z, dx, dz);
      wayU.uWayY.value = y;
    }
  };
  // What came down in the Door (rubble.js). Its grain is laid on from the
  // world's three axes at once, blended by which way a face looks: a rock is
  // turned every way, and projected along one axis per face its grain tore
  // into seams across every rough stone. RUBBLE_TILE units to the repeat, at
  // the stone's real scale on the smallest chip and the biggest block alike.
  // And the moon's fill (the emissive, as moonStone has it) comes in through
  // the breach — what faces it and the sky takes most, what is turned away a
  // third — where it lifted every face alike and flattened every stone.
  const rubbleFill = new THREE.Vector3(-DOOR_CRACKS.into[0] * 0.55, 0.8, -DOOR_CRACKS.into[1] * 0.55).normalize();
  const rubbleLit = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRubFill = { value: rubbleFill };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vRubW;
          varying vec3 vRubN;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vRubW = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vRubN = normalize(mat3(modelMatrix) * objectNormal);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uRubFill;
          varying vec3 vRubW;
          varying vec3 vRubN;`)
        .replace('#include <map_fragment>', `
          vec3 rubN = normalize(vRubN);
          vec3 rubB = pow(abs(rubN), vec3(4.0));
          rubB /= rubB.x + rubB.y + rubB.z;
          vec3 rubP = vRubW * ${(1 / RUBBLE_TILE).toFixed(5)};
          vec4 rubC = texture2D(map, rubP.zy) * rubB.x + texture2D(map, rubP.xz) * rubB.y + texture2D(map, rubP.xy) * rubB.z;
          diffuseColor *= rubC;`)
        .replace('#include <roughnessmap_fragment>', `
          float roughnessFactor = roughness * (texture2D(roughnessMap, rubP.zy).g * rubB.x + texture2D(roughnessMap, rubP.xz).g * rubB.y + texture2D(roughnessMap, rubP.xy).g * rubB.z);`)
        // (a projection's slope is the world's: x of the map along its u, y along its v)
        .replace('#include <normal_fragment_maps>', `
          vec3 rubTx = texture2D(normalMap, rubP.zy).xyz * 2.0 - 1.0;
          vec3 rubTy = texture2D(normalMap, rubP.xz).xyz * 2.0 - 1.0;
          vec3 rubTz = texture2D(normalMap, rubP.xy).xyz * 2.0 - 1.0;
          vec3 rubWN = normalize(rubN + (vec3(0.0, rubTx.y, rubTx.x) * rubB.x + vec3(rubTy.x, 0.0, rubTy.y) * rubB.y + vec3(rubTz.x, rubTz.y, 0.0) * rubB.z) * normalScale.x);
          normal = normalize((viewMatrix * vec4(rubWN, 0.0)).xyz);`)
        .replace('#include <emissivemap_fragment>', `
          totalEmissiveRadiance *= rubC.rgb * vColor.rgb * (0.33 + 0.67 * clamp(dot(rubWN, uRubFill) * 0.5 + 0.5, 0.0, 1.0));`);
    };
    mat.customProgramCacheKey = () => 'babel-rubble';
    return mat;
  };
  // Stone with a flame inside it. A lantern's light reaches its own stone
  // first — the jambs of its windows, the ledge under them, the underside of
  // its roof — and one real light per lantern would take the whole of the
  // light pool (see updateLights) to light a few square metres of stone. So
  // each vertex carries its lantern's flame (`aFlame`: where, and how strong;
  // 0 for a lantern that is out) and the way its windows face (`aFlameAxis`),
  // and the stone takes that light here as a lamp would give it: falling off
  // with distance, gone on any face turned away, strongest out of the windows.
  // It is also weathered as a garden lantern is — darker at the foot where
  // the rain splashes it, and moss on whatever faces the sky.
  const flameColor = new THREE.Color('#ffb46a');
  const flameLit = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uFlameColor = { value: flameColor };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aFlame;
          attribute vec2 aFlameAxis;
          varying vec4 vFlame;
          varying vec2 vFlameAxis;
          varying vec3 vFlameW;
          varying vec3 vFlameN;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vFlame = aFlame;
          vFlameAxis = aFlameAxis;
          vFlameW = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vFlameN = mat3(modelMatrix) * objectNormal;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uFlameColor;
          varying vec4 vFlame;
          varying vec2 vFlameAxis;
          varying vec3 vFlameW;
          varying vec3 vFlameN;
          float flameHash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }
          float flameNoise(vec3 x) {
            vec3 i = floor(x), f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(flameHash(i), flameHash(i + vec3(1, 0, 0)), f.x), mix(flameHash(i + vec3(0, 1, 0)), flameHash(i + vec3(1, 1, 0)), f.x), f.y),
              mix(mix(flameHash(i + vec3(0, 0, 1)), flameHash(i + vec3(1, 0, 1)), f.x), mix(flameHash(i + vec3(0, 1, 1)), flameHash(i + vec3(1, 1, 1)), f.x), f.y),
              f.z);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 flameN = normalize(vFlameN);
          float stoneLum = dot(diffuseColor.rgb, vec3(0.333));
          ${propsOld(4) ? `
          diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(5.2, 9.5, vFlameW.y)) * (0.8 + 0.4 * flameNoise(vFlameW * 0.42));
          float moss = smoothstep(0.4, 0.95, flameN.y)
            * smoothstep(0.42, 0.72, flameNoise(vFlameW * 0.8) * 0.65 + flameNoise(vFlameW * 2.9) * 0.35);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.062, 0.064, 0.026) * (0.7 + 2.0 * stoneLum), moss * 0.7);` : `
          // (forkProps.js, 4: it was porcelain — one pale tone, clean to the
          // ground. Granite that has stood out of doors: its grain, salt and
          // pepper; slow blotches of tone; the foot dark with damp, unevenly,
          // as high as the rain splashes; soot and wet under every ledge and
          // run down the faces below it in streaks; grey-green lichen in
          // patches where it has light; and moss on what faces the sky.)
          float gSlow = flameNoise(vFlameW * 0.42), gMid = flameNoise(vFlameW * 1.7 + 3.1), gFine = flameNoise(vFlameW * 11.0);
          float gPep = flameNoise(vFlameW * 23.0 + 7.7);
          diffuseColor.rgb *= (0.72 + 0.36 * gSlow) * (0.9 + 0.2 * gMid) * (0.84 + 0.3 * gFine) * (1.0 - 0.3 * smoothstep(0.66, 0.9, gPep));
          float damp = 1.0 - smoothstep(6.0 + 2.2 * gMid, 8.4 + 3.4 * gMid, vFlameW.y);
          diffuseColor.rgb *= mix(1.0, 0.46, damp);
          float under = smoothstep(0.1, 0.7, -flameN.y);
          float streak = smoothstep(0.5, 0.82, flameNoise(vec3(vFlameW.x * 2.6, vFlameW.y * 0.22, vFlameW.z * 2.6) + 1.3))
            * (1.0 - abs(flameN.y));
          diffuseColor.rgb *= (1.0 - 0.45 * under) * (1.0 - 0.34 * streak);
          float lichen = smoothstep(0.6, 0.76, flameNoise(vFlameW * 1.15 + 9.4) * 0.7 + flameNoise(vFlameW * 4.3) * 0.3)
            * smoothstep(-0.25, 0.3, flameN.y) * (1.0 - damp);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.21, 0.16) * (0.75 + 0.5 * gFine), lichen * 0.55);
          float moss = smoothstep(0.3, 0.9, flameN.y)
            * smoothstep(0.36, 0.62, flameNoise(vFlameW * 0.8) * 0.6 + flameNoise(vFlameW * 2.9) * 0.4);
          moss = max(moss, damp * smoothstep(0.55, 0.8, flameNoise(vFlameW * 1.9 + 5.0)) * smoothstep(-0.2, 0.5, flameN.y) * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.062, 0.022) * (0.75 + 0.6 * gFine), moss * 0.82);`}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec3 toFlame = vFlame.xyz - vFlameW;
          float flameD2 = max(dot(toFlame, toFlame), 0.01);
          float flameNdl = max(0.0, dot(flameN, toFlame * inversesqrt(flameD2)));
          float flameOut = length(toFlame.xz);
          float flameAim = flameOut > 0.3 ? abs(dot(-toFlame.xz / flameOut, vFlameAxis)) : 1.0;
          totalEmissiveRadiance += diffuseColor.rgb * uFlameColor * vFlame.w * flameNdl
            * mix(0.35, 1.0, flameAim * flameAim * flameAim) / (1.0 + 0.16 * flameD2);`);
    };
    mat.customProgramCacheKey = () => `babel-flame-stone${propsOld(4) ? '' : '-granite'}`;
    return mat;
  };
  const sprite = (map) => Std({ map, alphaTest: 0.32, roughness: 0.9, side: THREE.DoubleSide });
  // where the Fork's signpost's lantern hangs, and how strong (gardenFix5.js, 3)
  const signLamp = { value: new THREE.Vector4(0, -1e6, 0, 0) };
  const M = {
    floor: lpPool(paveShade(Std({ map: flag.map, normalMap: flag.normalMap, roughnessMap: flag.roughnessMap, color: stoneTint('#8d7f6e', '#8a857b'), roughness: 1, side: THREE.DoubleSide }))),
    mass: stoneShade(Std({ map: wall.map, normalMap: wall.normalMap, roughnessMap: wall.roughnessMap, color: stoneTint('#b6a897', '#ada89e'), roughness: 1, side: THREE.DoubleSide }), { weather: true, quiet: true, aged: true, wash: true, route: true }),
    // the Echo's: the same stone, coursed lower as it rises (echoFix.js, 6)
    drum: stoneShade(Std({ map: wall.map, normalMap: wall.normalMap, roughnessMap: wall.roughnessMap, color: stoneTint('#b6a897', '#ada89e'), roughness: 1, side: THREE.DoubleSide }), { weather: true, aged: true, drum: { tile: 1 / wall.map.repeat.x, rep: wall.map.repeat.x }, route: true }),
    cap: stoneShade(Std({ map: pale.map, normalMap: pale.normalMap, roughnessMap: pale.roughnessMap, color: stoneTint('#b3a894', '#b0aa9d'), roughness: 1, side: THREE.DoubleSide }), { night: WALLS.spec, quiet: true, worked: { polish: 0.3, joints: 1 }, wash: true, route: true }),
    // the same stone in the Silence's flights, where the lamp over the landing
    // reached in under it (no lamp casts a shadow) and drew a lit line along
    // every voussoir and string: a striped ziggurat in the quietest room
    // (its undersides lifted by the floor's bounce: silenceFix.js, 4)
    capShade: stoneShade(Std({ map: pale.map, normalMap: pale.normalMap, roughnessMap: pale.roughnessMap, color: stoneTint('#5e584d', '#5b5850'), roughness: 1, side: THREE.DoubleSide }), silenceOld(4) ? {} : ARCH_LIFT),
    shelf: Std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, roughness: 1 }),
    shelfBack: Std({ map: wood.map, color: '#7a6754', roughness: 1 }),
    // the Vertigo's shelves' moulded fronts, a darker walnut (vertigoFix.js, 3)
    shelfLip: Std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, color: LIP_COLOR, roughness: 0.92 }),
    books: keep(makeBookMaterial(spines, titles?.map)),
    bookRows: Std({ map: bookRowsSet.map, roughness: 0.85 }),
    // the same paint on a gallery's top two tiers: washed by its lamp-rail as
    // the books' shader washes them (aLit.x, the room's graze), and greyed in
    // the Silence (aLit.y) as its bindings are
    bookRowsLit: (() => {
      const m = Std({ map: bookRowsSet.map, roughness: 0.85 });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
          attribute vec2 aLit;
          varying vec2 vLit;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
          vLit = vec2(aLit.x * pow(smoothstep(78.0, 111.0, (modelMatrix * vec4(transformed, 1.0)).y), 1.6), aLit.y);`);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
          varying vec2 vLit;`)
          .replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), 0.6 * vLit.y) * (1.0 - 0.2 * vLit.y);`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.7, 0.42) * vLit.x * ${GRAZE.toFixed(3)};`);
      };
      m.customProgramCacheKey = () => 'babel-rows-lit';
      return m;
    })(),
    // the dressing of a bookcase (see shelfWall)
    frieze: Std({ map: friezeTex, roughness: 0.55, metalness: 0.25 }),
    plate: Std({ map: keep(bayPlates()), roughness: 0.35, metalness: 0.05 }),
    letters: Std({ map: gilt.map, roughness: 0.45, metalness: 0.35, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    // (in the gallery's own leather, where the Library's colour is carried by
    // its things too — libFix3.js, 1c: by which of the first three rooms the
    // edge hangs in)
    scallop: ((m) => {
      if (!COLOUR?.dress) return m;
      const base = new THREE.Color('#6a3c26');
      const tints = COLOUR.leathers.map((hex) => { const c = new THREE.Color(hex); return `vec3(${(c.r / base.r).toFixed(3)}, ${(c.g / base.g).toFixed(3)}, ${(c.b / base.b).toFixed(3)})`; });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uBounceRooms = bounceRooms;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
          varying vec3 vDressW;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
          vDressW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
          uniform vec3 uBounceRooms[${bounceRooms.value.length}];
          varying vec3 vDressW;`)
          .replace('#include <color_fragment>', `#include <color_fragment>
          ${tints.map((t, i) => `if (distance(vDressW.xz, uBounceRooms[${i}].xy) < 135.0) diffuseColor.rgb *= ${t};`).join(' ')}`);
      };
      m.customProgramCacheKey = () => `babel-scallop-${bounceRooms.value.length}`;
      return m;
    })(Std({ map: keep(shelfEdge()), color: '#6a3c26', alphaTest: 0.5, roughness: 0.8, side: THREE.DoubleSide })),
    railGlow: keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc07a').multiplyScalar(0.75), toneMapped: false })),
    // A darker stone for the band a floor keeps along its walls, so a room
    // has an edge to it and not one grid from wall to well.
    floorBand: lpPool(paveShade(Std({ map: flag.map, normalMap: flag.normalMap, roughnessMap: flag.roughnessMap, color: '#5a554c', roughness: 1, side: THREE.DoubleSide }))),
    // Bronze where hands go: the top of a handrail, a newel's cap. Rubbed
    // bright and smooth, where the rest has gone dark.
    bronzeWorn: Std({ color: '#86653b', roughness: 0.42, metalness: 0.8, side: THREE.DoubleSide }),
    // The ladders, the stools, the catalogue's drawer fronts: a paler wood than
    // the cases', grained (in one flat colour a ladder's rail lights up under a
    // lamp like a rod of orange plastic). The cases' walnut, tinted up in
    // linear light, so it shares their compiled program.
    oak: WOOD_OLD ? Std({ color: '#5e3f27', roughness: 0.55 })
      : Std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, color: new THREE.Color().setRGB(1.55, 1.36, 1.1), roughness: 1.1 }),
    shade: ((m) => (LAMPS.corner ? shadeLit(m, 6 + 7.6 + 3.75, 6 + 7.6 + 5.55) : m))(Std({ color: '#7a4a22', emissive: '#ff9a48', emissiveIntensity: 1.3, roughness: 0.7, side: THREE.DoubleSide })),
    shadeDead: Std({ color: '#4d3e32', roughness: 0.85, side: THREE.DoubleSide }),
    paper: Std({ color: '#cdbf9e', roughness: 0.9 }),
    // the front edge of a shelf where books have gone in and out for centuries
    shelfWorn: WOOD_OLD ? Std({ color: '#6e4d31', roughness: 0.45 })
      : Std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, color: new THREE.Color().setRGB(2.5, 2.3, 1.9), roughness: 0.8 }),
    dust: Std({ color: '#8b857a', roughness: 1 }),
    // the soft dark line where a case stands on the floor
    contact: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.5, alphaMap: gradTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
    // Stone walked smooth: the floor's and the stair's own stone, paler and
    // with a sheen, in a strip that fades out at both sides. Laid over the
    // stone in world units, so its joints are the stone's joints.
    // (No glossier: at a roughness of 0.35 a worn tread takes the lamp over it
    // as a hot spot the size of a footprint.)
    // (and catches the light a few strides on where the reader walks the way: `wayLit`)
    wornFloor: wayLit(Std({ map: flag.map, color: '#a8a295', roughness: 0.56, transparent: true, depthWrite: false, alphaMap: wornTex, polygonOffset: true, polygonOffsetFactor: -2 }), 'floor'),
    wornStep: wayLit(Std({ map: again(flag.map, 1 / 22), color: '#c6c0b2', roughness: 0.58, transparent: true, depthWrite: false, alphaMap: wornTex, polygonOffset: true, polygonOffsetFactor: -2 }), 'step'),
    // a stair's risers, in the shadow of the lip over them; the joints of a parapet
    riserShade: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
    // The Echo's stair read by its values (echoFix.js, 2): the lip the palest
    // stone on it, the riser only a shade under the tread — at 0.4 every riser
    // is a black slot and the flight a stack of separate slabs. (In the
    // balustrades' jointless limestone: the caps' ashlar puts a mortar joint
    // through the middle of every lip, a dark slot down the flight.)
    nosing: stoneShade(Std({ map: again(carveSet.map, 1 / 13), normalMap: again(carveSet.normalMap, 1 / 13), roughnessMap: again(carveSet.roughnessMap, 1 / 13), color: '#d6cfc0', roughness: 1, side: THREE.DoubleSide }), { worked: { polish: 1 } }),
    riserSoft: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
    joint: Std({ color: '#2a241e', roughness: 1 }),
    deadShards: Std({ color: '#3d3833', roughness: 0.22, metalness: 0, envMapIntensity: 0.8, side: THREE.DoubleSide }),
    dustFan: Std({ map: dustFanTex, color: '#bdb3a2', roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    moss: Std({ map: mossTex, roughness: 1, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3 }),
    leaf: Std({ map: leafTex, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide }),
    globeMap: Std({ map: globeTex, roughness: 0.55 }),
    // What came down with the Door's wall lies in the light that comes in
    // through it: no lamp reaches it, and unlit it read as black chips.
    moonRock: Std({ map: again(pale.map, 0.35), normalMap: again(pale.normalMap, 0.35), color: '#b3aa9c', roughness: 0.95, emissive: '#71897b', emissiveIntensity: 0.28, emissiveMap: again(pale.map, 0.35) }),
    moonStone: Std({ map: pale.map, normalMap: pale.normalMap, color: '#b0aa9d', roughness: 1, emissive: '#71897b', emissiveIntensity: 0.22, emissiveMap: pale.map }),
    // The same, for the stones of rubble.js, in a grain of their own (no
    // joints: the pale ashlar drew a little wall across every fallen block).
    // Each stone's tone is in its vertices — the room's face smoked, the break
    // fresh, dark in its hollows and at its foot, dust on top — and see
    // `rubbleLit` for how the grain is laid and the moon's fill comes in.
    rubble: rubbleSet && rubbleLit(Std({
      map: rubbleSet.map, normalMap: rubbleSet.normalMap, roughnessMap: rubbleSet.roughnessMap, normalScale: new THREE.Vector2(0.9, 0.9),
      vertexColors: true, color: '#b0aa9d', roughness: 1, emissive: '#71897b', emissiveIntensity: 0.22,
    })),
    // The garden's stones and the pond's bank (shore.js): each stone's tone,
    // moss and lichen in its vertices, its grain laid on from three sides,
    // wet from the water up; the bank the lawn's grass and the ways' gravel
    // where it meets them, pebbled earth at the water.
    shoreRock: shoreRockSet && shoreRockLit(Std({
      map: shoreRockSet.map, normalMap: shoreRockSet.normalMap, normalScale: new THREE.Vector2(0.85, 0.85),
      vertexColors: true, color: '#9a9389', roughness: 1,
    }), { waterY: WATER_Y, pond: shorePond }),
    pebble: shoreRockSet && shoreRockLit(Std({ map: shoreRockSet.map, vertexColors: true, color: '#9a9389', roughness: 1 }), { waterY: WATER_Y, pond: shorePond, lite: true }),
    bank: shoreBankSet && bankLit(Std({
      map: shoreBankSet.map, normalMap: shoreBankSet.normalMap, normalScale: new THREE.Vector2(1, 1),
      color: '#c4baa8', roughness: 1,
    }), { grass: grassTex, gravel: gravelTex, grassColor: '#5e6d63', gravelColor: GRAVEL_COLOR, grassRepeat: 1 / 46, gravelRepeat: 1 / 16 }),
    bronze: Std({ color: '#7d5d38', roughness: 0.46, metalness: 0.8, side: THREE.DoubleSide }),
    bronzeDim: Std({ color: '#4e3d2b', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
    inlay: Std({ color: '#9c7c3c', roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide }),
    // (the fillet round each floor, in its own duller brass: auditFix.js, 1)
    fillet: Std({ ...FILLET_BRASS, side: THREE.DoubleSide }),
    mirror: Std({ color: '#767c82', roughness: 0.34, metalness: 0.95, envMapIntensity: 2.4 }),
    liner: Std({ color: '#2a2219', roughness: 1, side: THREE.DoubleSide }),
    stars: keep(new THREE.MeshBasicMaterial({ map: starTex, color: '#ffffff', toneMapped: false, side: THREE.DoubleSide })),
    step: stoneShade(Std({ map: again(flag.map, 1 / 22), normalMap: again(flag.normalMap, 1 / 22), roughnessMap: again(flag.roughnessMap, 1 / 22), color: stoneTint('#b3a692', '#aea99b'), roughness: 1 })),
    glow: keep(makeGlowMaterial()),
    globe: keep(makeLampGlobeMaterial()),
    // (the lamp pass, lampPass.js: paper lit from its flame, the Pavilion's
    // table panels, candle flames and the wax under them)
    lpPaper: keep(makePaperMaterial()),
    lpPanel: keep(Object.assign(makePaperMaterial({ lattice: true, flame: [0, -0.15, 0], gain: 0.62, near: 0.4 }), { side: THREE.DoubleSide })),
    lpFlame: keep(makeFlameMaterial({ alive: !doorPropsOld(4) })),
    // (the Door's candles: wax, its tone in its vertices, the flame showing a little through it — doorProps.js, 4)
    wax: Std({ vertexColors: true, roughness: 0.42, emissive: '#3b2412', emissiveIntensity: 0.3 }),
    lpWax: keep(waxGlowMaterial()),
    // A globe that has gone out: the same opal glass with nothing behind it —
    // dull, dark and opaque, catching only a highlight of the lamp still lit.
    // (smoked and dulled: silenceFix.js, 3)
    deadGlass: deadOpal(deadGlassPatch(Std({ color: '#5c544a', roughness: LAMPS.glint ? 0.07 : 0.3, metalness: 0, envMapIntensity: 0.7 }))),
    // (gardenFix5.js, 11: across the garden its cut edge is drawn soft)
    foliage: keep(makeFoliageMaterial(leaves, wind, FOLIAGE_KINDS, { prepassed: true, feather: FEATHER.on ? FEATHER : null })),
    foliagePre: keep(makeFoliagePrepass(leaves, wind, FOLIAGE_KINDS, { feather: FEATHER.on ? FEATHER : null })),
    // the dead leaf a hedge stands in: its own leaf, browned, laid flat
    hedgeLitter: Std({
      name: 'hedge-litter', map: hedge.map, color: '#8c7556', roughness: 1, vertexColors: true,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    // the same again for the hedges' sprigs (one program with the trees', its
    // cut edge soft across the garden as theirs is; a material of their own so
    // they can be told apart — and switched off — by name)
    hedgeLeaf: keep(Object.assign(makeFoliageMaterial(leaves, wind, FOLIAGE_KINDS, { prepassed: true, feather: FEATHER.on ? FEATHER : null }), { name: 'hedge-leaf' })),
    hedgeLeafPre: keep(Object.assign(makeFoliagePrepass(leaves, wind, FOLIAGE_KINDS, { feather: FEATHER.on ? FEATHER : null }), { name: 'hedge-leaf-pre' })),
    // the trees' wood (trees.js): each tree's bark colour is in its vertices
    bark: Std({ map: barkSet.map, normalMap: barkSet.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), vertexColors: true, roughness: 0.95 }),
    glass: Std({ color: '#ffe2b8', transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0, envMapIntensity: 2.2, depthWrite: false }),
    iron: Std({ color: '#2a2520', roughness: 0.6, metalness: 0.6 }),
    grass: Std({ map: grassTex, color: '#5e6d63', roughness: 1, side: THREE.DoubleSide }),
    gravel: Std({ map: gravelTex, color: GRAVEL_COLOR, roughness: 1, side: THREE.DoubleSide }),
    mazeFloor: Std({ map: gravelTex, color: '#635f57', roughness: 1, side: THREE.DoubleSide }),
    wood: Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: '#9d7d5e', roughness: 0.85 }),
    plank: WOOD_OLD ? Std({ map: again(timber.map, 1 / 16), normalMap: again(timber.normalMap, 1 / 16), color: '#b59872', roughness: 0.85 })
      : Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: '#b59872', roughness: 0.85 }),
    // Red lacquer over wood: the colour is the lacquer's, but the board under
    // it shows in the gloss — the grain a faint relief, the sheen a little
    // uneven along it. (A white map so it compiles as the garden's wood does.)
    lacquer: WOOD_OLD ? Std({ color: '#5a2620', roughness: 0.45 })
      : Std({ map: whiteTex, normalMap: timber.normalMap, normalScale: new THREE.Vector2(0.22, 0.22), roughnessMap: timber.roughnessMap, color: '#5a2620', roughness: 0.55 }),
    roof: Std({ map: roofTex, roughness: 0.55, flatShading: true }),
    // Ridge tiles: the rolls and hips laid over the roof shell. Glazed the same
    // green but darker, because a ridge is a doubled course and sits in its own
    // shadow — one colour for both and the ridges vanish into the shell.
    ridge: Std({ color: '#222c2a', roughness: 0.5 }),
    gold: Std({ color: '#d6ae58', roughness: 0.25, metalness: 0.9 }),
    rock: Std({ map: again(pale.map, 0.35), normalMap: again(pale.normalMap, 0.35), color: '#9f9688', roughness: 0.95 }),
    // Clipped box (hedges.js): its shade is in its vertices, its gloss in the
    // leaf. Not for the sky: a face of glossy leaf seen at a grazing angle took
    // the moonlit sky as a pale grey band along every top. And only a fifth of
    // it for the lamps, as the sprigs on it have (effects.js): under the
    // maze's heart lamp every leaf-dome in the texture caught its own warm
    // highlight, and the face went mustard and leopard-spotted behind sprigs
    // that stayed green.
    hedge: hedgeMoon(skyDull(Std({
      name: 'hedge',
      map: hedge.map, normalMap: hedge.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: hedge.roughnessMap,
      color: '#d6dccb', roughness: 1, vertexColors: true,
    }), 0.1, HEDGE_DIAL === 'gloss' ? 1 : 0.2)),
    gardenStone: Std({ map: again(pale.map, 0.35), normalMap: again(pale.normalMap, 0.35), color: '#a39a8b', roughness: 0.95, vertexColors: true }),
    rakeDark: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
    // (unlit, like the furrow: one shader for both, and each new one costs the
    // world a fraction of a second more to compile before it can be shown)
    rakeLit: keep(new THREE.MeshBasicMaterial({ color: '#9a9284', transparent: true, opacity: forkOld(2) ? 0.13 : RAKE.lit, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
    // the Fork's furrows, fainter than the court's rings (forkFix.js, 2: the
    // same program, another opacity)
    forkRakeDark: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: forkOld(2) ? 0.3 : RAKE.dark, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
    // the Fork's waymark, a post of weathered timber (forkFix.js, 3)
    forkPost: Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: WAYMARK.color, roughness: 0.9 }),
    // the same post turned, in the pergola's timber, and its boards gone grey:
    // weathered, and lit by the lantern on its own arm (gardenFix5.js, 3)
    signPost: signLit(Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: SIGN.post, roughness: 0.85 }), signLamp),
    signBoard: signLit(Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: SIGN.board, roughness: 0.9 }), signLamp),
    // the caps shod on the Pavilion's bracket arms, dark bronze (pavilionFix.js, 2)
    pavBronze: Std({ color: '#5c4630', roughness: 0.5, metalness: 0.65 }),
    // the armillary's pedestal, turned from one stone: the garden stone's tint
    // on the lanterns' jointless carving, so no mortar joints run down the
    // lettered shaft (webFix.js, 7); and the paving's stone, weathered, lit by
    // the paving it stands on, since under its own lamp it takes only the sky
    // (gardenFix5.js, 8)
    pedestalStone: garden5Old(8) ? stoneShade(Std({ map: again(carveSet.map, 1 / 11), normalMap: again(carveSet.normalMap, 1 / 11), roughnessMap: again(carveSet.roughnessMap, 1 / 11), color: '#b9ae9f', roughness: 1 }))
      : plinthLit(Std({ map: again(pale.map, 1 / 26), normalMap: again(pale.normalMap, 1 / 26), roughnessMap: again(pale.roughnessMap, 1 / 26), color: PLINTH.color, roughness: 1 })),
    // the Pavilion's own (pavilionProps.js): the dark gilt of its columns'
    // collars (13); the green and the chalk line painted on its bracket arms
    // (3); the cloth under the qin (4) — none with a map, so all of them the
    // ridge's compiled program; and its rails' lacquer, worn (10)
    pavGilt: Std({ ...DARK_GILT }),
    pavGreen: Std({ color: CAIHUA.green, roughness: 0.82 }),
    pavChalk: Std({ color: CAIHUA.chalk, roughness: 0.88 }),
    brocade: Std({ color: '#39452e', roughness: 0.93 }),
    lacquerWorn: wornLacquer(WOOD_OLD ? Std({ color: '#5a2620', roughness: 0.45, vertexColors: true })
      : Std({ map: whiteTex, normalMap: timber.normalMap, normalScale: new THREE.Vector2(0.22, 0.22), roughnessMap: timber.roughnessMap, color: '#5a2620', roughness: 0.55, vertexColors: true })),
    blackLacquer: Std({ color: '#17110d', roughness: 0.32 }),
    silk: Std({ color: '#e2d6bc', roughness: 0.6 }),
    // The guqin player's cushion: cloth, not lacquer. In the lacquer it took
    // the table lamp as a near-white disc at the foot of the table, where the
    // table's own shade should be darkest. (No maps, so it shares the ridge's
    // compiled program.)
    cushion: Std({ color: '#4e231c', roughness: 0.92 }),
    newWood: Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: '#e3d2ae', roughness: 0.8 }),
    stone: stoneShade(Std({ map: again(pale.map, 1 / 26), normalMap: again(pale.normalMap, 1 / 26), roughnessMap: again(pale.roughnessMap, 1 / 26), color: '#b9ae9f', roughness: 1 })),
    // the same stone in the balustrades on the wall tops, let fall into the
    // night round the maze with the walls and copings under them (webProps.js,
    // 1: or over the cedars it is a pale lit strip, the one thing of the
    // Library left in the court's sky)
    wallTop: stoneShade(Std({ map: again(pale.map, 1 / 26), normalMap: again(pale.normalMap, 1 / 26), roughnessMap: again(pale.roughnessMap, 1 / 26), color: '#b9ae9f', roughness: 1 }), { night: !webPropsOld(1), quiet: true, sink: true, route: true }),
    frame: Std({ color: '#7a5a30', roughness: 0.4, metalness: 0.6 }),
    // water gilding on the pier glasses' carving (mirror.js), burnished and old
    gilt: Std({ color: '#c2994c', roughness: 0.34, metalness: 0.9 }),
    giltDeep: Std({ color: '#6f5128', roughness: 0.62, metalness: 0.75 }),
    // The garden's stone lanterns: cut stone with no joints in it (a lantern
    // is carved from five blocks, not laid in courses), lit from inside.
    lanternStone: flameLit(Std({ map: again(carveSet.map, 1 / 11), normalMap: again(carveSet.normalMap, 1 / 11), roughnessMap: again(carveSet.roughnessMap, 1 / 11), color: propsOld(4) ? '#b3ada2' : '#8d8a85', roughness: 1 })),
    // the paper of their windows, coloured by the flame behind it (litPaper)
    lanternPaper: keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })),
    paperDead: Std({ color: '#6f685c', roughness: 0.95, side: THREE.DoubleSide }),
    leather: Std({ color: '#4a2519', roughness: 0.62 }),
    tuft: Std({ color: '#4c5c33', roughness: 1, emissive: '#1f2b18', emissiveIntensity: 0.5 }),
    // the lawn's blades in a lantern's light (lawn.js; forkProps.js, 10)
    lawnBlade: bladeLit(Std({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })),
    petal: Std({ color: '#cdbfe0', roughness: 0.8, side: THREE.DoubleSide, emissive: '#3a3348', emissiveIntensity: 0.45 }),
    wisteria: sprite(wisteriaTex),
    ivy: sprite(ivyTex),
    // the Door's grown ivy, a leaf at a time (ivy.js): glossy, its veins pale,
    // its underside paler and duller; and the wisteria's leaflets
    ivyLeaf: backPaler(Std({ map: keep(ivyLeafTexture(7)), roughness: 0.42, side: THREE.DoubleSide }), 'babel-ivy-leaf'),
    vineLeaf: backPaler(Std({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide }), 'babel-vine-leaf'),
    carve: stoneShade(Std({ map: carveSet.map, normalMap: carveSet.normalMap, roughnessMap: carveSet.roughnessMap, color: stoneTint('#b3a894', '#b4aea1'), roughness: 1, side: THREE.DoubleSide }), { worked: { polish: 0.8 } }),
    // the same, in the Silence's shaded stone (capShade's tone): its stone
    // balustrade, which goes on from the flights' dark stone (one program
    // with `carve`)
    carveShade: stoneShade(Std({ map: carveSet.map, normalMap: carveSet.normalMap, roughnessMap: carveSet.roughnessMap, color: stoneTint('#5e584d', '#5b5850'), roughness: 1, side: THREE.DoubleSide })),
    dressed: stoneShade(Std({ map: dressedSet.map, normalMap: dressedSet.normalMap, roughnessMap: dressedSet.roughnessMap, color: stoneTint('#b3a894', '#aca699'), roughness: 1, side: THREE.DoubleSide }), { weather: true }),
    marble: Std({ map: marbleSet.map, roughness: 0.24, metalness: 0, envMapIntensity: 1.3 }),
    column: stoneShade(Std({ map: columnSet.map, normalMap: columnSet.normalMap, roughnessMap: columnSet.roughnessMap, color: stoneTint('#b3a894', '#bab3a6'), roughness: 1 }), { worked: { polish: 0.3, foot: true } }),
    hang: keep(makeHangingMaterial(hangTex, wind, HANGING_KINDS, { keepCoverage: WILLOW_BROAD, weep: pavPropsOld(6) ? null : WILLOW })),
    // the lilies of the pond (pond.js): four kinds of leaf in one atlas, and the flowers
    lily: keep(lilyPads.material),
    flower: keep(makeFlowerMaterial()),
  };

  const root = new THREE.Group();
  root.name = 'world';

  // Geometry is merged per material AND per patch of ground. From above the
  // whole honeycomb is in view and the patches cost nothing extra; but a reader
  // standing in one gallery sees two or three rooms, and one world-sized mesh
  // would have every book in the Library drawn behind the walls. A patch can be
  // culled (see `cull`), and sorted front to back.
  const CHUNK = 450;
  const chunkKey = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
  const centre = new THREE.Vector3();
  class Batch {
    // `project`: lay this batch's texture in world units rather than per face.
    constructor(mat, { cast = true, receive = true, project = false } = {}) { Object.assign(this, { mat, cast, receive, project, chunks: new Map() }); }
    // `uvAt`: lay it as it lies that far off ([x, z]) — the way in, dressed as
    // the hallway its doorway opens as (see WAY_IN).
    add(geo, uvAt = null) {
      const grain = geo.userData.grain;
      const flat = geo.index ? geo.toNonIndexed() : geo;
      if (flat !== geo) geo.dispose();
      // (`project: 'grain'`: wood, laid along each piece — see woodGrain.js)
      if (this.project === 'grain') uvGrain(flat, uvAt, grain);
      else if (this.project) uvWorld(flat, uvAt);
      flat.computeBoundingBox();
      flat.boundingBox.getCenter(centre);
      const k = chunkKey(centre.x, centre.z);
      if (!this.chunks.has(k)) this.chunks.set(k, []);
      this.chunks.get(k).push(flat);
      return this;
    }
    flush(name = '') {
      for (const geos of this.chunks.values()) {
        const geo = keep(mergeGeometries(geos, false));
        geos.forEach((g) => g.dispose());
        geo.computeBoundingSphere();
        const m = new THREE.Mesh(geo, this.mat);
        m.castShadow = this.cast;
        m.receiveShadow = this.receive;
        // Named so a probe can say WHAT the walk is standing in (see probe.js).
        m.name = name;
        root.add(m);
      }
      this.chunks.clear();
    }
  }
  // A hole must be drawn the opposite way round to the outline it is cut in, or
  // its walls come out inside out — and three only squares the two up when the
  // OUTLINE is the one it has to turn round (the `reverse` branch of its
  // ExtrudeGeometry). Every outline here is drawn clockwise, so that branch
  // never runs; a hole that kept the winding it arrived with would give the
  // stone no inner face, and a gallery's own walls would be culled from inside
  // it — the eye would look straight through them into the next room.
  const wound = (pts, clockwise) => {
    const v = pts.map(([x, z]) => new THREE.Vector2(x, -z));
    return THREE.ShapeUtils.isClockWise(v) === clockwise ? v : v.reverse();
  };
  const slabGeo = (pts, holes, depth, y0) => {
    const shape = new THREE.Shape(wound(pts, false));
    for (const h of holes) shape.holes.push(new THREE.Path(wound(h, true)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y0, 0);
    return geo;
  };
  const boxGeo = ([ax, az], [bx, bz], h, t, y0) => {
    const len = Math.max(0.5, Math.hypot(bx - ax, bz - az));
    const g = new THREE.BoxGeometry(len, h, t);
    g.rotateY(-Math.atan2(bz - az, bx - ax));
    g.translate((ax + bx) / 2, y0 + h / 2, (az + bz) / 2);
    return g;
  };
  const placed = (geo, [x, z], y, ry = 0) => { geo.rotateY(ry); geo.translate(x, y, z); return geo; };
  // A side profile — [along, height] — extruded across its own width and stood
  // where it belongs. What a flight of steps is: stepped along the top and, in
  // a room where you walk UNDER it, something on the underside that could hold
  // the stone up.
  const profileGeo = (pts, width, centre, ang) => {
    const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -width / 2);
    g.rotateY(-Math.atan2(Math.sin(ang * deg), Math.cos(ang * deg)));
    g.translate(centre[0], 0, centre[1]);
    return g;
  };
  // Texture at a real size, everywhere. Three lays UVs in world units on an
  // ExtrudeGeometry but 0..1 across every face of a BoxGeometry, so one stone
  // material drew 3-metre courses on a wall and a smear of half a block on a
  // step — the same ruled-cardboard reading the balcony pass measured, at five
  // times the scale. Projecting every batched surface from where it stands, on
  // whichever axis its face is turned to, puts one scale over all of it; after
  // this a texture's `repeat` means the size of the stone, and nothing else.
  const uvWorld = (geo, at = null) => {
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    if (!pos || !nor) return geo;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (at ? at[0] : 0), y = pos.getY(i), z = pos.getZ(i) + (at ? at[1] : 0);
      const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; }
      else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; }
      else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
  };
  const rodGeo = (a, b, r) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
    const mid = va.add(vb).multiplyScalar(0.5);
    g.translate(mid.x, mid.y, mid.z);
    return g;
  };
  const flatPlane = () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return keep(g); };
  // Stone walked smooth, as a strip laid along a line on a floor or a stair
  // (M.wornFloor / M.wornStep): `uv` is the world's x and z, so the stone's
  // joints run on through it; `uv1` is across the strip (0-1) and along it.
  // (`run0`, `moveBy`: a length of another ribbon, picked up and laid down
  // `moveBy` off, worn exactly as it was where it came from)
  const wornRibbon = (pts, width, y, { run0 = 0, moveBy = [0, 0] } = {}) => {
    const pos = [], uvw = [], uv1 = [], idx = [];
    let run = run0;
    pts.forEach((p, i) => {
      const t = unit2(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]), n = [-t[1], t[0]];
      if (i) run += dist(pts[i - 1], p);
      for (const side of [-1, 1]) {
        const q = add(p, n, (side * width) / 2);
        pos.push(q[0] + moveBy[0], y, q[1] + moveBy[1]);
        uvw.push(q[0], q[1]);
        uv1.push(side < 0 ? 0 : 1, run / 24);
      }
      if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvw, 2));
    g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
    g.setIndex(idx);
    return g;
  };
  // A rectangle lying flat, `len` along bearing `ang` and `wid` across it.
  const flatQuad = (centre, ang, len, wid, y) => {
    const a = dir(ang);
    return wornRibbon([add(centre, a, -len / 2), add(centre, a, len / 2)], wid, y);
  };
  // A rail from p to q at height y: round, or `squash`ed into an oval.
  const barGeo = (p, q, y, r, squash = 1) => {
    const g = new THREE.CylinderGeometry(r, r, dist(p, q), 18, 1, false);
    g.rotateZ(Math.PI / 2);
    g.scale(1, squash, 1);
    g.rotateY(-Math.atan2(q[1] - p[1], q[0] - p[0]));
    g.translate((p[0] + q[0]) / 2, y, (p[1] + q[1]) / 2);
    return g;
  };
  // `chunked`: one instanced mesh per patch of ground (see Batch), for anything
  // that never moves. Things that drift keep one mesh, whose matrices tick moves.
  // A weathered stone: a subdivided sphere pushed in and out by a smooth
  // function of direction (so shared vertices move together and the faces stay
  // closed), flattened a little, as stones settle. Twelve flat facets was a die.
  // A block of a wall as it came down: dressed on five faces and broken on the
  // sixth, the one it tore away from the course it was bedded in.
  const brokenBlock = (w, h, d, rng) => {
    const g = new THREE.BoxGeometry(w, h, d, 6, 4, 4);
    const p = g.attributes.position, ph = [rng() * 6, rng() * 6, rng() * 6];
    for (let i = 0; i < p.count; i++) {
      if (p.getX(i) < w / 2 - 1e-3) continue;
      const y = p.getY(i), z = p.getZ(i);
      const f = 0.55 + 0.45 * Math.sin(y * 1.7 + ph[0]) * Math.sin(z * 2.1 + ph[1]) + 0.22 * Math.sin(y * 4.3 + z * 3.7 + ph[2]);
      p.setX(i, w / 2 - w * 0.24 * Math.max(0, f));
    }
    g.computeVertexNormals();
    return g;
  };
  // A fragment of dressed stone: angular, flat-faced, not a pebble.
  const chunkGeo = () => {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * 1.15, p.getY(i) * 0.62, p.getZ(i) * 0.9);
    g.computeVertexNormals();
    return g;
  };
  // A garden stone: worn round, wider than it is tall, and green where rain and
  // the dark sit on it. (Not rockGeo: faceted and flat-shaded, from the Fork
  // those read as black chips cut out of the frame.)
  const stoneGeo = () => {
    const g = new THREE.IcosahedronGeometry(1, light ? 2 : 3);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    const m = mergeVertices(g);
    g.dispose();
    const p = m.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const bump = 1 + 0.16 * Math.sin(v.x * 2.6 + 1.3) * Math.sin(v.y * 2.2 + 0.4) * Math.sin(v.z * 2.9 + 2.1) + 0.05 * Math.sin(v.x * 6.1 + v.z * 4.7);
      v.multiplyScalar(bump);
      v.y *= 0.62;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    m.computeVertexNormals();
    const n = m.attributes.normal, col = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2);
    const moss = [0.5, 0.62, 0.36];
    for (let i = 0; i < p.count; i++) {
      const t = Math.min(1, Math.max(0, (n.getY(i) - 0.45) / 0.4)) * (0.7 + 0.3 * Math.sin(p.getX(i) * 9.1 + p.getZ(i) * 7.3));
      col.set([1 + (moss[0] - 1) * t, 1 + (moss[1] - 1) * t, 1 + (moss[2] - 1) * t], i * 3);
      uv.set([p.getX(i) * 0.5 + 0.5, p.getZ(i) * 0.5 + 0.5], i * 2);
    }
    m.setAttribute('color', new THREE.BufferAttribute(col, 3));
    m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return m;
  };
  const rockGeo = () => {
    const g = new THREE.IcosahedronGeometry(1, light ? 1 : 2);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const bump = 1
        + 0.22 * Math.sin(v.x * 3.1 + 1.3) * Math.sin(v.y * 2.7 + 0.4) * Math.sin(v.z * 3.3 + 2.1)
        + 0.09 * Math.sin(v.x * 7.9 + v.z * 5.3) + 0.05 * Math.sin(v.y * 11.7 - v.x * 9.1);
      v.multiplyScalar(bump);
      v.y *= 0.78;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  };

  // `attrs`: per-instance attributes, { name: (item) => number | number[] }.
  // `depth`: the material the shadow map draws them with, if not three's own.
  // `prepass`: a material to lay their depth with first, in a mesh of its own
  // drawn ahead of everything (see makeFoliagePrepass).
  // `group`: what an item is drawn with instead of its patch of ground (each
  // group a mesh of its own, culled on its own); `name` names the meshes.
  const instances = (geo, mat, items, { cast = true, receive = true, chunked = false, attrs = null, depth = null, prepass = null, group: groupOf = null, name = '', to = root, order = 0 } = {}) => {
    if (!items.length) return null;
    keep(geo);
    const groups = new Map();
    for (const it of items) {
      const k = groupOf ? groupOf(it) : chunked ? chunkKey(it.p[0], it.p[2]) : 'all';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), c = new THREE.Color();
    let first = null;
    for (const group of groups.values()) {
      // an instanced attribute lives on the geometry, so each group needs its own
      const g = attrs && groups.size > 1 ? keep(geo.clone()) : geo;
      if (attrs) {
        for (const [name, of] of Object.entries(attrs)) {
          const head = of(group[0]), size = Array.isArray(head) ? head.length : 1;
          g.setAttribute(name, new THREE.InstancedBufferAttribute(Float32Array.from(size > 1 ? group.flatMap(of) : group.map(of)), size));
        }
      }
      const inst = new THREE.InstancedMesh(g, mat, group.length);
      group.forEach((it, i) => {
        qt.setFromEuler(new THREE.Euler(...(it.rot ?? [0, 0, 0])));
        m4.compose(new THREE.Vector3(...it.p), qt, new THREE.Vector3(...(it.s ?? [1, 1, 1])));
        inst.setMatrixAt(i, m4);
        inst.setColorAt(i, c.set(it.color ?? '#ffffff').multiplyScalar(it.k ?? 1));
      });
      inst.castShadow = cast;
      inst.receiveShadow = receive;
      inst.name = name;
      inst.userData.group = groupOf ? groupOf(group[0]) : undefined;
      if (order) inst.renderOrder = order;
      if (depth) inst.customDepthMaterial = depth;
      inst.computeBoundingSphere();
      to.add(inst);
      if (prepass) {
        const pre = new THREE.InstancedMesh(g, prepass, group.length);
        pre.instanceMatrix = inst.instanceMatrix;
        pre.castShadow = false;
        pre.receiveShadow = false;
        pre.renderOrder = -1;
        pre.computeBoundingSphere();
        to.add(pre);
      }
      first ??= inst;
    }
    return first;
  };
  const pools = [];
  // A pool of lamplight is light coming back off a floor, and over a well
  // there is no floor: a pool laid flat across the shaft hung in the air over
  // it as a pale sheet, the well's dark gone. Floor-level pools are cut away
  // over every well and over the Vertigo's pit (`wells`, filled once the rooms
  // are laid out: x, z, flat radius, and 1 for a hexagon or 0 for a circle).
  const wells = { value: [new THREE.Vector4(0, 0, 0, 0)] };
  const offWells = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWells = wells;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec2 vPoolXZ;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vPoolXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec4 uWells[${wells.value.length}];
          varying vec2 vPoolXZ;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          for (int i = 0; i < ${wells.value.length}; i++) {
            vec2 d = vPoolXZ - uWells[i].xy;
            float hex = max(abs(d.y), max(abs(dot(d, vec2(0.8660254, 0.5))), abs(dot(d, vec2(-0.8660254, 0.5)))));
            float r = mix(length(d), hex, uWells[i].w);
            diffuseColor.a *= smoothstep(uWells[i].z - 0.5, uWells[i].z + 1.5, r);
          }`);
    };
    mat.customProgramCacheKey = () => `babel-pool-${wells.value.length}`;
    return mat;
  };
  // `src`: the light a pool comes from ([x, y, z, its globe's radius]), for its shadows
  const decal = ([x, z], sx, sz, color, opacity, y = 6.6, flicker = 0, src = null) => {
    // A pool on a Library floor goes into the floor's own light (lampPass.js;
    // the draw its breathing took is still taken)
    if (LAMPS.pool && y > 5.9 && y < 6.7) {
      floorPools.push({ x, z, sx, sz, c: new THREE.Color(color), o: opacity, src });
      if (flicker) rr(0, 100);
      return null;
    }
    const mat = keep(new THREE.MeshBasicMaterial({
      map: radialTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    if (y > 5 && y < 7) offWells(mat);   // (not the light hung in layers down the Vertigo)
    const m = new THREE.Mesh(flatPlane(), mat);
    m.scale.set(sx, 1, sz);
    m.position.set(x, y, z);
    // Under the water, not over it (see the Pavilion): a pool of lamplight is
    // light coming back off the GROUND, and where the ground is a pond the
    // surface stands between the two.
    m.renderOrder = 1;
    root.add(m);
    if (flicker) pools.push({ mat, base: opacity, phase: rr(0, 100), amount: flicker });
    return m;
  };
  // The halo round a lamp, always facing the eye.
  const haloMaterial = (color, opacity, map = glowTex) => keep(new THREE.SpriteMaterial({
    map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false,
  }));
  const halos = [];
  // (`phase`: given, the world's stream is not drawn on for it)
  const halo = ([x, z], y, size, color, opacity, map, phase = null) => {
    const mat = haloMaterial(color, opacity, map);
    const s = new THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    s.position.set(x, y, z);
    s.renderOrder = 4;
    root.add(s);
    // a hanging lamp's (see HALO_REACH): the only halos big enough to fill a room
    halos.push({ mat, base: opacity, phase: phase ?? rr(0, 100), sprite: s, size, lamp: map === lampHaloTex, seen: 1, seenTo: 1 });
  };
  const lightWishes = [];
  // The lamps' light falls away more gently than an inverse square from a hot
  // core, which floodlights whatever stands near a lamp — the court's paving
  // under the armillary, the waymark beside its lantern, the Pavilion's floor
  // and columns — while the rest of the frame goes black: stage light, not
  // lamplight. The lamps put 60% of the inverse square's light on what they
  // light (the lamps themselves, their globes and halos, burn at full
  // brightness), the warm pools painted under them are a little over half as
  // strong, and the fill comes up to meet them (World.jsx).
  //
  // A lamp is rescaled so that it lights a wall DECAY_AT away exactly as it
  // would at an inverse square; only nearer than that does the softer fall-off
  // soften it, and further off it carries. ?wlight=old puts the hard light
  // back; ?wdecay, ?wlamp and ?wpool dial each part of it.
  const Q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const qNum = (k, d) => (Q.get(k) !== null && Q.get(k) !== '' && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);
  const HARD_LIGHT = Q.get('wlight') === 'old';
  const LAMP_DECAY = qNum('wdecay', HARD_LIGHT ? 2 : 1.5), DECAY_AT = 32;
  const LAMP_DIAL = qNum('wlamp', HARD_LIGHT ? 1 : 0.6), POOL_DIAL = qNum('wpool', HARD_LIGHT ? 1 : 0.55);
  // (A lamp is a globe, not a point — lightModel.js — so it is given back what
  // the softer near field takes from it at DECAY_AT.)
  // `column` [x, z, radius]: whoever stands inside it keeps this light, however far off.
  const point = ([x, z], y, color, intensity, priority, decay = null, column = null) => {
    lightWishes.push({
      x, y, z, color, priority, column,
      // (a light that names its own fall-off keeps it, and its power: the one
      // at the bottom of the Vertigo is meant to be the brightest thing there)
      intensity: decay === null ? LAMP_DIAL * intensity * DECAY_AT ** (LAMP_DECAY - 2) * softGain(LAMP_DECAY, DECAY_AT) : intensity,
      decay: decay ?? LAMP_DECAY,
    });
  };
  return { Std, shorePond, bounceRooms, workAt, stringWash, mapWarm, echoDeep, ROUTE_ON, ROUTE_TINT,
    walkNearGlsl, stoneShade, skyDull, setWay, signLamp, M, root, chunkKey, centre, Batch, slabGeo,
    boxGeo, placed, profileGeo, rodGeo, flatPlane, wornRibbon, flatQuad, barGeo, brokenBlock,
    chunkGeo, stoneGeo, rockGeo, instances, pools, wells, decal, haloMaterial, halos, halo,
    lightWishes, Q, qNum, POOL_DIAL, point };
}
