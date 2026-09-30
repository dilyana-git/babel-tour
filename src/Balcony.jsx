import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { EYE_HEIGHT, START, PILLARS, moveVisitor, nearbyObject } from './balconyMovement';
import Finish from './Finish';
import { LIGHT_MESH } from './capability';
import './balcony.css';

// What hangs out past the ledge is whatever the reader is standing in. Tour
// hands over the plates of their own gallery (see balconyPlace there), minus
// the one it is already showing — "the archive continues beyond the stone"
// means MORE of this room, not the same wall a second time, and it means the
// garden when the reader is in the garden. This used to be three library
// staircases no matter where in the piece you were, which from the far end of
// the garden is not a different room, it is a different world.
//
// These two join the draw only in the library, because they are library art:
// staircase plates with no depth map, which bars them from a gallery's slab
// stack and means nothing at all to a plain colour card.
const BALCONY_EXTRA = [
  '/nodes/descent/05-impossible-prison-staircases-var7.webp',
  '/nodes/descent/05-impossible-prison-staircases-var13.webp',
];

function platesFor(place) {
  const own = (place?.plates ?? []).filter(Boolean);
  const inLibrary = own.some((p) => p.startsWith('/nodes/descent/'));
  const pool = inLibrary ? [...own, ...BALCONY_EXTRA] : own;
  // A node with a single variant, currently hanging, leaves nothing: fall back
  // to the library's own rather than to an empty window.
  return pool.length ? pool : BALCONY_EXTRA;
}

// Module scope, so it survives leaving and re-entering inside one visit: never
// the same view twice running.
let lastPlate = null;
function drawPlate(pool) {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // Built off an existing entry rather than written out as a path of its own:
    // verify:assets scans this file for plate URLs and a template literal here
    // reads to it as a real plate that does not exist. It was right to complain.
    const pick = new URLSearchParams(window.location.search).get('plate');
    if (pick) return BALCONY_EXTRA[0].replace(/var\d+/, pick);
  }
  const others = pool.filter((p) => p !== lastPlate);
  const from = others.length ? others : pool;
  lastPlate = from[Math.floor(Math.random() * from.length)];
  return lastPlate;
}

const clamp = THREE.MathUtils.clamp;

// Held at 1.5, and it was measured. A composer makes the Canvas's own
// `antialias: true` inert, and this room — unlike the corridor's fog-feathered
// planes — is all hard silhouette, so resolution is the only antialiasing left
// and 1.75 was worth looking at. It costs 36% more pixels in a scene that is
// fill-bound, and the grain in Finish already does most of what the extra
// resolution was being bought for. The room is richer than it was; the frame
// budget is not.
const DPR = [1, 1.5];

// This room stands inside a Midjourney plate — PLATES above are the paintings
// it looks out on, one of them the very plate the Vestibule hangs (see
// catalogue.js) — so it has to be built to those paintings' terms. Sampled across the three library originals:
//
//   lit stone        #524840    shadow stone  #34281d   (R−B  +18 … +45)
//   haze in the void #4f5f71    lamp halo     #694e38   (R−B  −23 … −34)
//   median luminance 0.21–0.30, mean 0.24–0.31
//
// One thing runs through all of it: the masonry stays WARM the whole way down
// into its shadows, and the only cool in the picture is the DISTANCE. The room
// as first built had that backwards — a near-neutral box at half the plates'
// luminance (median 0.11, mean R−B +2) with a hot orange lamp on the nearest
// pier — so it read as a lit stage set standing in front of a painting rather
// than as a ledge inside one.
//
// Hence: warm quarried stone; the cool arriving only as fog and as the light
// off the void; haze at every distance, because aerial perspective is the
// thing those plates have that a box of lit boxes does not; and the plates'
// own motifs — hung chains with forged rings, archivolts, a blind arcade,
// glass lamps — carved where the eye lands at standing height.
const WALL_H = 7.0;   // inner height of the box; the great arch needs 6.95 of it
const SPRING = 2.5;   // impost course — where the vault leaves the wall
const VAULT = (WALL_H - SPRING) / 5.35; // rib squash: outer apex meets the ceiling

// A reusable masonry material, drawn locally: mortar, worn edges and small
// mineral variations belong to the stone, never to a screen-space overlay.
function stoneTexture(joints = true) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  let seed = 812;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = joints ? '#463b2e' : '#7c7364'; ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; joints && row < 8; row++) {
    for (let col = -1; col < 5; col++) {
      const x = col * 128 + (row % 2) * 64;
      const y = row * 64;
      // Laid up warm — +24/+12/0 is the R−B the plates keep even in shadow.
      const v = Math.floor(92 + random() * 30);
      ctx.fillStyle = `rgb(${v + 24},${v + 12},${v})`;
      ctx.fillRect(x + 2, y + 2, 124, 60);
      // Every course is dirtier at its bed than at its top: dust settles on the
      // arris and washes down the face. Without this the blocks read as printed
      // rectangles, which is exactly what the first pass looked like.
      const wash = ctx.createLinearGradient(0, y + 2, 0, y + 62);
      wash.addColorStop(0, 'rgba(228,215,190,.11)');
      wash.addColorStop(0.5, 'rgba(0,0,0,0)');
      wash.addColorStop(1, 'rgba(22,16,10,.3)');
      ctx.fillStyle = wash; ctx.fillRect(x + 2, y + 2, 124, 60);
      ctx.strokeStyle = 'rgba(230,216,186,.1)';
      ctx.strokeRect(x + 3, y + 3, 122, 58);
      for (let j = 0; j < 110; j++) {
        ctx.fillStyle = random() > 0.5 ? 'rgba(238,228,206,.07)' : 'rgba(20,15,10,.09)';
        ctx.fillRect(x + random() * 124, y + random() * 60, 1 + random() * 12, 1);
      }
    }
  }
  // Long, low-contrast mineral seams on the slabs and mouldings.
  for (let i = 0; i < 18000; i++) {
    const alpha = random() * 0.065;
    ctx.fillStyle = random() > 0.5 ? `rgba(226,214,190,${alpha})` : `rgba(22,20,16,${alpha})`;
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 5, 1 + random() * 2);
  }
  if (!joints) {
    // Worn edges. This variant is one floor slab, and a slab whose face runs
    // flat to a hard border is a tile; the plates' floors are all rounded and
    // dirtied at the arris from being walked on for a few centuries.
    const edge = ctx.createRadialGradient(256, 256, 150, 256, 256, 380);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(24,18,12,.5)');
    ctx.fillStyle = edge; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      let x = random() * 512, y = random() * 512;
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += random() * 30; y += random() * 15 - 7; ctx.lineTo(x, y); }
      ctx.strokeStyle = 'rgba(30,26,20,.1)'; ctx.lineWidth = 0.6; ctx.stroke();
    }
  }
  // Soiling at ROOM scale. One 512 square is stretched across a whole pier or
  // wall, so detail at block scale alone still leaves a six-metre face reading
  // as one flat tone — which, lit, is what made the piers look like painted
  // cardboard. These blotches are the thing that breaks that up.
  for (let i = 0; i < 30; i++) {
    const x = random() * 512, y = random() * 512, r = 40 + random() * 150;
    const blot = ctx.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, random() > 0.4 ? 'rgba(26,20,14,.2)' : 'rgba(232,220,196,.09)');
    blot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blot; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

// A soft round falloff, drawn once and used twice: the glass lamps' own glow,
// and the veils of haze hung out in the void. It is the same falloff in both
// places because it is the same thing — light caught in the air.
function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.16, 'rgba(255,255,255,.6)');
  g.addColorStop(0.42, 'rgba(255,255,255,.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Bend a plane onto the inside of a cylinder centred on the room, so every
// point of it stands the same distance off the reader. The centre matters: the
// first version of this curved the plate about its own position thirty metres
// out, which pulls the far ends AWAY from the viewer and narrows what it
// covers — looking along the balustrade ran straight off the side of it into
// flat background. Curved about the room instead, 104 metres of artwork at a
// 30-metre radius is 198° of it, and there is no looking past the edge.
function curvedPlane(width, height, radius, segments = 72) {
  const g = new THREE.PlaneGeometry(width, height, segments, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const arc = p.getX(i) / radius;
    p.setX(i, Math.sin(arc) * radius);
    p.setZ(i, -Math.cos(arc) * radius);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// The far wall of the world: a graded dome, dark in the vault, hazy at the
// level of the light, dark again down the drop. Past the plate's edges — and
// above it, the moment a reader at the balustrade tips their head back — there
// was otherwise flat background, which is the one cue that says "picture on a
// card" no matter how well the rest of it is lit.
function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#232a33');
  g.addColorStop(0.42, '#3f4956');
  g.addColorStop(0.62, '#4b5361');
  g.addColorStop(1, '#1d1b19');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A candle is the one thing in a room that is never still, and a still one is
// uncanny in a way a static lamp is not — the eye knows what a flame does.
// Three sine terms at unrelated rates: a slow wander, a body flutter and a fast
// tremor, summed to roughly ±0.12 around full. Any more reads as a fault in the
// renderer rather than as a draught.
const flame = (t, seed) => 0.94
  + 0.06 * Math.sin(t * 8.3 + seed)
  + 0.04 * Math.sin(t * 3.1 + seed * 1.7)
  + 0.025 * Math.sin(t * 19.0 + seed * 0.4);

function Block({ at, size, material, children, ...rest }) {
  return <mesh position={at} material={material} castShadow receiveShadow {...rest}>
    <boxGeometry args={size} />
    {children}
  </mesh>;
}

function Arch({ radius, thickness = 0.23, depth = 0.34, at, material, ...rest }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius + thickness, 0, Math.PI, false);
    shape.absarc(0, 0, radius, Math.PI, 0, true);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelSegments: 2,
      steps: 1, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 40,
    });
    return g;
  }, [radius, thickness, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={at} material={material}
    castShadow receiveShadow {...rest} />;
}

// One draw call for a carved element that repeats. A chain long enough to read
// is fifty links, and fifty meshes is not what a walkable room should be
// spending its draw calls on.
function Repeated({ geometry, material, at, castShadow = false }) {
  const ref = useRef();
  const { gl } = useThree();
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const offset = new THREE.Vector3();
    const turn = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const size = new THREE.Vector3();
    at.forEach(([x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx], i) => {
      matrix.compose(offset.set(x, y, z), turn.setFromEuler(euler.set(rx, ry, rz)), size.set(sx, sy, sz));
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    // Room bakes its shadow map once and then stops; a batch whose matrices
    // land after that bake casts nothing until another one is asked for.
    gl.shadowMap.needsUpdate = true;
  }, [at, gl]);
  return <instancedMesh ref={ref} args={[geometry, material, at.length]}
    castShadow={castShadow} receiveShadow />;
}

// The motif no plate in the library leaves out: a chain out of the dark with a
// forged ring on the end of it, hung where it will cross the light. Hung high
// enough to walk under, so none of it is worth a collider.
function Chain({ x, z, from, to, iron, link, ring }) {
  const links = useMemo(() => {
    const rows = [];
    for (let y = from; y > to + 0.3; y -= 0.084) {
      rows.push([x, y, z, 0, rows.length % 2 ? Math.PI / 2 : 0, 0]);
    }
    return rows;
  }, [x, z, from, to]);
  return <>
    <Repeated geometry={link} material={iron} at={links} castShadow />
    <mesh geometry={ring} material={iron} position={[x, to, z]} castShadow />
  </>;
}

function Column({ x, material, trim }) {
  return <group position={[x, 0, -2.9]}>
    {[0.1, 0.25, 2.78, 2.95].map((y, i) =>
      <Block key={y} at={[0, y, 0]} size={[i % 2 ? 1.02 : 1.18, 0.15, i % 2 ? 1.02 : 1.18]} material={trim} />)}
    <mesh position={[0, 1.55, 0]} castShadow receiveShadow material={material}>
      <cylinderGeometry args={[0.38, 0.45, 2.5, 20]} />
    </mesh>
    {/* A clustered shaft, not a smooth drum. No pier in any of these plates is
        a plain cylinder — each is a bundle of colonnettes with a ringed base
        and a banded neck — and at standing height the two piers are a third of
        the frame, so this is where carving buys the most. */}
    {Array.from({ length: 12 }, (_, i) => {
      const a = i * Math.PI / 6;
      return <mesh key={i} position={[Math.cos(a) * 0.395, 1.54, Math.sin(a) * 0.395]} material={trim} castShadow>
        <cylinderGeometry args={[0.052, 0.062, 2.44, 8]} />
      </mesh>;
    })}
    {[0.42, 1.05, 2.05, 2.62].map(y => <mesh key={y} position={[0, y, 0]} material={trim}>
      <cylinderGeometry args={[0.475, 0.475, 0.05, 24]} />
    </mesh>)}
    {/* Foliate capital: a splayed bell under the abacus, with the leaves
        CROCKETED onto its face rather than stood off it. Eight cones on
        outstretched arms is what the first attempt drew, and at five metres
        eight cones read as spikes — a party hat, not a capital. Sixteen small
        ones lying back against the bell read as carving. */}
    <mesh position={[0, 2.45, 0]} material={material} castShadow receiveShadow>
      <cylinderGeometry args={[0.5, 0.4, 0.33, 20]} />
    </mesh>
    {Array.from({ length: 16 }, (_, i) => {
      const a = i * Math.PI / 8 + Math.PI / 16;
      return <mesh key={i} position={[Math.cos(a) * 0.425, 2.4, Math.sin(a) * 0.425]}
        rotation={[0, -a, 0.16]} material={trim} castShadow>
        <coneGeometry args={[0.062, 0.3, 5]} />
      </mesh>;
    })}
  </group>;
}

function Rail({ stone, trim }) {
  const baluster = useMemo(() => new THREE.LatheGeometry([
    [0.1, 0], [0.1, 0.07], [0.062, 0.11], [0.046, 0.22],
    [0.082, 0.36], [0.09, 0.43], [0.048, 0.55], [0.05, 0.63], [0.095, 0.69],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 12), []);
  // A dentil course under the coping. No balustrade in these plates is a plain
  // slab on sticks; every one carries a run of small carved shadow along the
  // top, and it is the cheapest detail in the room.
  const dentil = useMemo(() => new THREE.BoxGeometry(0.09, 0.09, 0.4), []);
  // What stands on the three balustrade posts. A plain cone put a traffic cone
  // in the dead centre of the opening; the plates only ever finish a post with
  // a turned urn, which is the same lathe the balusters already use.
  const finial = useMemo(() => new THREE.LatheGeometry([
    [0.13, 0], [0.13, 0.05], [0.07, 0.09], [0.13, 0.18],
    [0.16, 0.26], [0.1, 0.36], [0.05, 0.42], [0.075, 0.47], [0.03, 0.53], [0, 0.55],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 14), []);
  const dentils = useMemo(() => Array.from({ length: 51 }, (_, i) => [-5 + i * 0.2, 0.885, 0]), []);
  useEffect(() => () => { baluster.dispose(); dentil.dispose(); finial.dispose(); },
    [baluster, dentil, finial]);
  return <group position={[0, 0, -4.55]}>
    <Block at={[0, 0.13, 0]} size={[10.4, 0.26, 0.44]} material={stone} />
    <Block at={[0, 1.1, 0]} size={[10.4, 0.14, 0.5]} material={trim} />
    <Block at={[0, 1.0, 0]} size={[10.4, 0.07, 0.38]} material={stone} />
    <Repeated geometry={dentil} material={trim} at={dentils} />
    {Array.from({ length: 33 }, (_, i) => <mesh key={i} geometry={baluster}
      position={[-4.96 + i * 0.31, 0.26, 0]} material={trim} castShadow receiveShadow />)}
    {/* Newels. The urns go on the END posts only. The middle post stands at
        x = 0, which is exactly where a reader fetches up when they walk into
        the balustrade, and an urn there put half a metre of carved stone
        across the view at eye height — the one place in this room where
        nothing at all may stand. It takes a moulded cap instead, below the
        sight line. */}
    {[-5, 0, 5].map(x => <group key={x}>
      <Block at={[x, 0.6, 0]} size={[0.33, 1.2, 0.46]} material={stone} />
      <Block at={[x, 1.23, 0]} size={[0.47, 0.12, 0.56]} material={trim} />
      {x === 0
        ? <Block at={[x, 1.32, 0]} size={[0.36, 0.07, 0.44]} material={trim} />
        : <mesh geometry={finial} position={[x, 1.29, 0]} material={trim} castShadow />}
    </group>)}
  </group>;
}

function Shelves({ side, wood, brass }) {
  const books = useMemo(() => {
    // Bound leather, not a paint chart. These were mid blues, teals and reds,
    // which the room's exposure lifted into the only genuinely saturated colour
    // anywhere in the piece — the plates have nothing above a whisper of hue on
    // them, and a shelf of primaries beside that reads as a toy.
    const palettes = ['#3b332a', '#402f28', '#33372f', '#4e4132', '#343a3d', '#4a382b'];
    return palettes.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.88 }));
  }, []);
  // One unit-height spine scaled per book, so ninety volumes cost one draw call
  // per binding colour instead of one each. The two cases were 360 meshes —
  // most of the room's draw calls, spent on the furniture rather than on the
  // architecture — and a software rasteriser feels every one of them.
  const spine = useMemo(() => new THREE.BoxGeometry(0.13, 1, 0.32), []);
  const tag = useMemo(() => new THREE.BoxGeometry(0.1, 0.012, 0.008), []);
  const shelved = useMemo(() => {
    const byColour = books.map(() => []);
    const tags = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 19; col++) {
        if (col === 9) continue;
        const h = 0.39 + ((row * 7 + col * 3) % 5) * 0.035;
        const x = -1.65 + col * 0.178;
        const y = 0.22 + row * 0.7 + h / 2;
        byColour[(row + col) % books.length].push([x, y, -0.27, 0, 0, 0, 1, h, 1]);
        tags.push([x, y + h * 0.3, -0.435]);
      }
    }
    return { byColour, tags };
  }, [books]);
  useEffect(() => () => {
    books.forEach(m => m.dispose()); spine.dispose(); tag.dispose();
  }, [books, spine, tag]);
  return <group position={[side * 4.92, 0, 1.5]} rotation={[0, side * Math.PI / 2, 0]}>
    <Block at={[0, 1.8, 0]} size={[3.6, 3.6, 0.23]} material={wood} />
    {[-1.8, 0, 1.8].map(x => <Block key={x} at={[x, 1.8, -0.22]} size={[0.12, 3.7, 0.52]} material={wood} />)}
    {[0.15, 0.85, 1.55, 2.25, 2.95, 3.65].map(y => <Block key={y}
      at={[0, y, -0.22]} size={[3.75, 0.1, 0.58]} material={wood} />)}
    {shelved.byColour.map((at, i) => <Repeated key={i} geometry={spine} material={books[i]} at={at} />)}
    <Repeated geometry={tag} material={brass} at={shelved.tags} />
  </group>;
}

// Glass, not a bulb in a cage. A lamp in these plates is an ovoid of lit glass
// with a visible bloom around it and a warm pool under it, and the bloom is
// most of what sells it — a hot disc with no glow reads as a decal, which is
// what the first lamp in here looked like.
function Lantern({ at, brass, glow, shadow = false }) {
  const stem = WALL_H - at[1] - 0.42;
  // A blown teardrop of lit glass on a short brass cap. The first lamp in here
  // was a hot disc inside a six-bar cage, which at five metres is a paper
  // shade; every lamp in the plates is bare glass, wider below than above,
  // with its bloom doing most of the work and no cage on it at all.
  const glass = useMemo(() => new THREE.LatheGeometry([
    [0, 0.3], [0.045, 0.26], [0.085, 0.19], [0.12, 0.09],
    [0.132, -0.02], [0.125, -0.13], [0.095, -0.22], [0.05, -0.27], [0, -0.29],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 18), []);
  useEffect(() => () => glass.dispose(), [glass]);
  return <group position={at}>
    <mesh position={[0, 0.42 + stem / 2, 0]} material={brass}>
      <cylinderGeometry args={[0.014, 0.014, stem, 6]} />
    </mesh>
    <mesh geometry={glass}>
      <meshBasicMaterial color="#ffe0ad" toneMapped={false} fog={false} />
    </mesh>
    <sprite scale={[2.2, 2.2, 1]}>
      <spriteMaterial map={glow} color="#ffbe74" transparent opacity={0.55}
        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
    </sprite>
    <pointLight color="#ffdcb4" intensity={shadow ? 10 : 6.5} distance={15} decay={2}
      castShadow={shadow} shadow-mapSize={[1024, 1024]} shadow-radius={3}
      shadow-bias={-0.0012} shadow-normalBias={0.03} />
    <mesh position={[0, 0.36, 0]} material={brass} castShadow>
      <cylinderGeometry args={[0.032, 0.055, 0.12, 10]} />
    </mesh>
    <mesh position={[0, -0.33, 0]} material={brass} castShadow>
      <coneGeometry args={[0.055, 0.14, 8]} />
    </mesh>
  </group>;
}

function ReadingStand({ stone, wood, brass, opened }) {
  const cover = useRef();
  const { gl } = useThree();
  useFrame((_, dt) => {
    if (cover.current && Math.abs(cover.current.rotation.z - (opened ? 2.65 : 0)) > 0.001) {
      cover.current.rotation.z = THREE.MathUtils.damp(cover.current.rotation.z, opened ? 2.65 : 0, 8, dt);
      gl.shadowMap.needsUpdate = true;
    }
  });
  return <group position={[3.85, 0, -3.55]} rotation={[0, -0.35, 0]}>
    <Block at={[0, 0.1, 0]} size={[0.68, 0.2, 0.68]} material={stone} />
    <Block at={[0, 0.65, 0]} size={[0.25, 1.1, 0.25]} material={wood} />
    <group position={[0, 1.25, 0]} rotation={[0.22, 0, 0]}>
      <Block at={[0, 0, 0]} size={[0.82, 0.09, 0.63]} material={wood} />
      <Block at={[0, 0.09, 0]} size={[0.46, 0.11, 0.42]}>
        <meshStandardMaterial color="#c0ad81" roughness={1} />
      </Block>
      <group position={[-0.25, 0.16, 0]} ref={cover}>
        <Block at={[0.25, 0, 0]} size={[0.52, 0.035, 0.46]} material={wood} />
        <Block at={[0.25, 0.023, 0]} size={[0.3, 0.008, 0.26]} material={brass} />
        <Block at={[0.25, 0.03, 0]} size={[0.28, 0.008, 0.24]} material={wood} />
      </group>
    </group>
  </group>;
}

// The archive itself, seen out past the ledge — the same plate the Vestibule
// hangs. Two things put it in the same world as the room rather than behind a
// window onto another one.
//
// It is TONE MAPPED. Every plate in the corridor goes through the renderer's
// ACES curve (the diorama's shader ends on `tonemapping_fragment`); this one
// alone opted out, so the single painting a visitor can meet from both sides
// of the piece was being graded two different ways depending which side they
// were standing on.
//
// And it is BENT. A flat card at thirty metres slides as one rigid rectangle
// when the visitor walks the ledge, and that is the cue that gives a backdrop
// away. Curving it onto a cylinder about the room is the same move the
// corridor makes with SPHERE_WRAP, for the same reason.
function LibraryView({ plate }) {
  const map = useTexture(plate);
  // The card takes its shape from the ARTWORK rather than from a constant. The
  // height used to be hardcoded at 44.37 — correct for one 2.34:1 plate and
  // silently wrong, as a vertical stretch, for any other. The library's stills
  // are not all one aspect: the staircase batch is 16:9, which is 31% more
  // picture above and below exactly where a reader at the balustrade tips their
  // head back and runs off the top of it.
  const aspect = (map.image?.width || 2944) / (map.image?.height || 1256);
  const geometry = useMemo(() => curvedPlane(104, 104 / aspect, 30), [aspect]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  map.anisotropy = 8;
  return <mesh geometry={geometry} position={[0, 8.5, 0]}>
    <meshBasicMaterial map={map} color="#d5d2cc" fog={false} />
  </mesh>;
}

// Aerial perspective — the thing those plates have that a box of lit boxes
// does not. In every one of them the depth is a graded haze rather than a
// darkness, and without it the great arch reads as a hole cut in a wall with a
// picture behind it. Three veils, each further out and each a shade cooler,
// hung across the opening: cool, because in the plates the distance is the
// only cool thing there is.
function Haze({ glow, sky }) {
  // Shells, not flat cards, for the same reason the plate is bent: a card seen
  // at an angle ends somewhere, and a veil of air may not.
  //
  // Three of them on a capable machine, ONE where the mesh was reduced. Each is
  // a large transparent surface hung across the whole opening, so the three
  // together redraw the most expensive part of the frame three times over —
  // which is exactly the kind of cost a phone has nothing to give. The dome
  // stays in both cases: it is one opaque draw and it is what stands between
  // the reader and the edge of the world.
  const veils = useMemo(() => (LIGHT_MESH ? [19] : [12, 19, 26]).map((radius, i) => ({
    radius,
    color: LIGHT_MESH ? '#516480' : ['#4a5a6e', '#546987', '#5f7590'][i],
    opacity: LIGHT_MESH ? 0.28 : [0.2, 0.17, 0.15][i],
    geometry: curvedPlane(radius * 3.4, radius * 2.4, radius, 48),
  })), []);
  const dome = useMemo(() => new THREE.SphereGeometry(58, 24, 16), []);
  useEffect(() => () => {
    veils.forEach((v) => v.geometry.dispose()); dome.dispose();
  }, [veils, dome]);
  return <>
    <mesh geometry={dome}>
      <meshBasicMaterial map={sky} side={THREE.BackSide} fog={false} />
    </mesh>
    {veils.map(({ radius, geometry, color, opacity }) => (
      <mesh key={radius} geometry={geometry} position={[0, 5 + radius * 0.18, 0]} renderOrder={1}>
        <meshBasicMaterial map={glow} color={color} transparent opacity={opacity}
          depthWrite={false} fog={false} />
      </mesh>
    ))}
  </>;
}

// Dust in the lamplight. Nothing in these plates is ever an empty volume —
// there is always air in the room and something suspended in it — and a lit
// interior with nothing floating in it is the most reliable tell that a space
// was modelled rather than photographed.
//
// Each mote takes its brightness ONCE, from how near it was born to a lamp, and
// the falloff is squared: dust does not glow, it is lit, and a field of evenly
// bright specks reads as snow. The ones out in the middle of the floor are
// almost nothing; the handful inside the pool are bright enough to catch the
// bloom.
function Motes({ glow, lamps, reduced }) {
  const cloud = useRef();
  const { geometry, material, home, phase, count } = useMemo(() => {
    // Additive points with size attenuation: the near ones are large on screen
    // and every one of them is overdraw. Thinned rather than dropped where the
    // mesh was reduced — a room with no dust in it is the thing this was added
    // to fix, and a third of the dust still reads as air.
    const n = LIGHT_MESH ? 90 : 260;
    const position = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const origin = new Float32Array(n * 3);
    const drift = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 9.6;
      const y = 0.12 + Math.random() * 4.8;
      const z = (Math.random() - 0.5) * 8.6 - 0.4;
      origin[i * 3] = position[i * 3] = x;
      origin[i * 3 + 1] = position[i * 3 + 1] = y;
      origin[i * 3 + 2] = position[i * 3 + 2] = z;
      let near = Infinity;
      for (const [lx, ly, lz] of lamps) {
        near = Math.min(near, Math.hypot(x - lx, y - ly, z - lz));
      }
      const lit = Math.max(0, 1 - near / 4.4) ** 2;
      color[i * 3] = (0.05 + lit * 0.95);
      color[i * 3 + 1] = (0.05 + lit * 0.95) * 0.84;
      color[i * 3 + 2] = (0.05 + lit * 0.95) * 0.62;
      drift[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    const m = new THREE.PointsMaterial({
      size: 0.05, sizeAttenuation: true, vertexColors: true, map: glow,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      toneMapped: false, fog: false,
    });
    return { geometry: g, material: m, home: origin, phase: drift, count: n };
  }, [glow, lamps]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(({ clock }) => {
    // Slow enough to be air rather than weather. Held still for a reader who
    // asked for reduced motion — a field of moving specks is exactly what that
    // setting is there to refuse — but they keep the dust itself.
    if (reduced || !cloud.current) return;
    const t = clock.elapsedTime;
    const p = geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const d = phase[i];
      p[i3] = home[i3] + Math.sin(t * 0.12 + d) * 0.24;
      p[i3 + 1] = home[i3 + 1] + Math.sin(t * 0.08 + d * 1.7) * 0.15;
      p[i3 + 2] = home[i3 + 2] + Math.cos(t * 0.1 + d * 0.6) * 0.21;
    }
    geometry.attributes.position.needsUpdate = true;
  });
  return <points ref={cloud} geometry={geometry} material={material} frustumCulled={false} />;
}

// Light falling through the air out in the hall. Every plate in the library has
// at least one of these in it — it is how those pictures say how big the space
// is — and the balcony looks straight out into the place they happen. Kept
// weak, wide and off-axis: a beam that is too tight, too bright or aimed at the
// reader stops being architecture and becomes a lens flare.
function Shafts({ glow }) {
  const beams = useMemo(() => [
    { at: [-6.5, 15, -13], tilt: 0.27, size: [7, 34], opacity: 0.085 },
    { at: [3.5, 17, -17], tilt: -0.18, size: [9.5, 40], opacity: 0.07 },
    { at: [-1, 13, -23], tilt: 0.09, size: [15, 46], opacity: 0.05 },
  ], []);
  return <>{beams.map(({ at, tilt, size, opacity }) => (
    <mesh key={at[2]} position={at} rotation={[0, 0, tilt]} renderOrder={2}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={glow} color="#c6d8f0" transparent opacity={opacity}
        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  ))}</>;
}

// Candle-ends left along the coping by whoever reads here. They are the reason
// to walk to the balustrade rather than merely look at it: three small live
// flames at the edge of a drop, below the sight line, so a reader comes over
// the rail and finds them. Emissive only — the bloom in Finish does the work
// that a light would have cost.
function Candles({ wax, brass, glow, reduced }) {
  const halos = useRef([]);
  const pool = useRef();
  useFrame(({ clock }) => {
    // Held still for a reader who asked for reduced motion; they keep the
    // candles, the candles just do not gutter.
    if (reduced) return;
    const t = clock.elapsedTime;
    halos.current.forEach((halo, i) => {
      if (!halo) return;
      const f = flame(t, i * 2.4);
      halo.material.opacity = 0.55 * f;
      halo.scale.setScalar(0.42 * (0.93 + f * 0.09));
    });
    if (pool.current) pool.current.intensity = 2.6 * flame(t, 1.3);
  });
  return <>{[[-3.55, 0.19], [-1.15, 0.27], [2.75, 0.15]].map(([x, height], i) => (
    <group key={x} position={[x, 1.17, -4.52 + (i - 1) * 0.04]}>
      <mesh position={[0, 0.02, 0]} material={brass} castShadow>
        <cylinderGeometry args={[0.075, 0.085, 0.04, 12]} />
      </mesh>
      <mesh position={[0, 0.04 + height / 2, 0]} material={wax} castShadow>
        <cylinderGeometry args={[0.032, 0.038, height, 12]} />
      </mesh>
      <mesh position={[0, 0.08 + height, 0]}>
        <coneGeometry args={[0.016, 0.08, 8]} />
        <meshBasicMaterial color="#ffeccb" toneMapped={false} fog={false} />
      </mesh>
      <sprite ref={el => { halos.current[i] = el; }} position={[0, 0.08 + height, 0]} scale={[0.42, 0.42, 1]}>
        <spriteMaterial map={glow} color="#ffa347" transparent opacity={0.55}
          blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
      </sprite>
    </group>
  ))}
  {/* One light between the three of them, rather than three. */}
  <pointLight ref={pool} position={[-0.6, 1.5, -4.5]} intensity={2.6} color="#ffb765" distance={5} decay={2} />
  </>;
}

// Iron sconces flanking the entrance. The wall a reader turns round to face
// was the last blank surface in the room — six metres of lit ashlar with a door
// in it — and a blank lit surface is the one thing none of these plates has.
// Two small live flames on it do more than any amount of carving would: they
// give that wall its own warm source, so it stops being a grey backdrop and
// starts being the lit end of the room.
function Sconce({ x, iron, wax, glow, reduced }) {
  const halo = useRef();
  const wall = useRef();
  useFrame(({ clock }) => {
    if (reduced) return;
    const f = flame(clock.elapsedTime, x * 3.7);
    if (halo.current) halo.current.material.opacity = 0.6 * f;
    if (wall.current) {
      wall.current.material.opacity = 0.42 * f;
      wall.current.scale.set(2.4 * (0.96 + f * 0.05), 2.9 * (0.94 + f * 0.07), 1);
    }
  });
  return <group position={[x, 1.95, 4.6]}>
    <mesh position={[0, -0.12, 0.06]} material={iron} castShadow>
      <cylinderGeometry args={[0.028, 0.05, 0.26, 8]} />
    </mesh>
    <mesh position={[0, 0.02, 0.06]} rotation={[Math.PI, 0, 0]} material={iron} castShadow>
      <coneGeometry args={[0.13, 0.12, 10, 1, true]} />
    </mesh>
    <mesh position={[0, 0.12, 0.06]} material={wax} castShadow>
      <cylinderGeometry args={[0.03, 0.036, 0.16, 10]} />
    </mesh>
    <mesh position={[0, 0.25, 0.06]}>
      <coneGeometry args={[0.017, 0.085, 8]} />
      <meshBasicMaterial color="#ffeccb" toneMapped={false} fog={false} />
    </mesh>
    {/* The flame's own bloom, and under it the pool it throws on the wall.
        The pool is a sprite rather than a light: a point light here is paid for
        by every lit fragment on screen (see the entrance light in Room), while
        a additive quad costs the pixels it actually covers. It is the oldest
        trick there is and it is the right one — nothing in this room needs a
        sconce to cast a true shadow. */}
    <sprite ref={halo} position={[0, 0.25, 0.06]} scale={[0.55, 0.55, 1]}>
      <spriteMaterial map={glow} color="#ffa347" transparent opacity={0.6}
        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
    </sprite>
    <sprite ref={wall} position={[0, 0.22, -0.02]} scale={[2.4, 2.9, 1]}>
      <spriteMaterial map={glow} color="#c87a33" transparent opacity={0.42}
        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
    </sprite>
  </group>;
}

// A rose over the entrance. Turning round used to be the least rewarded thing a
// reader could do in here — a flat wall, a dark door — and every plate in the
// set puts its best carving on the surface you were not looking at. It is the
// one warm light in the room that is not a flame, and it holds the far end of
// the space against the cool of the void.
function Rose({ trim, iron, glow }) {
  const spoke = useMemo(() => new THREE.BoxGeometry(0.46, 0.05, 0.1), []);
  const foil = useMemo(() => new THREE.TorusGeometry(0.19, 0.033, 6, 20), []);
  useEffect(() => () => { spoke.dispose(); foil.dispose(); }, [spoke, foil]);
  const spokes = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6;
    return [Math.cos(a) * 0.6, Math.sin(a) * 0.6, -0.03, 0, 0, a];
  }), []);
  const foils = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6 + Math.PI / 12;
    return [Math.cos(a) * 0.64, Math.sin(a) * 0.64, -0.04];
  }), []);
  return <group position={[0, 5.45, 4.66]}>
    <mesh rotation={[0, Math.PI, 0]}>
      <circleGeometry args={[0.88, 40]} />
      <meshBasicMaterial map={glow} color="#ffc98a" side={THREE.DoubleSide}
        toneMapped={false} fog={false} />
    </mesh>
    {/* Tracery in IRON, not in stone. Lit stone in front of lit glass is the
        same value as the glass, so the whole thing came out a bright disc with
        bright lozenges on it — a clock face. A rose is legible because its
        tracery is a dark drawing held against the light. */}
    <mesh position={[0, 0, -0.03]} material={trim}>
      <torusGeometry args={[0.9, 0.08, 10, 44]} />
    </mesh>
    <mesh position={[0, 0, -0.04]} material={iron}>
      <torusGeometry args={[0.34, 0.05, 8, 30]} />
    </mesh>
    <Repeated geometry={spoke} material={iron} at={spokes} />
    <Repeated geometry={foil} material={iron} at={foils} />
  </group>;
}

// Where the two lamps hang. The dust reads its brightness off these, so they
// live here rather than inline in the two <Lantern> tags.
const LAMPS = [[-2.2, 2.65, -2.4], [3.7, 2.75, -3.4]];

function Room({ opened, reduced, place }) {
  const { gl } = useThree();
  useEffect(() => {
    // Architecture and lanterns are fixed. Reuse their shadow maps while the
    // visitor moves; only the opening book needs to refresh them. The map is
    // baked once, so it can afford to be soft and large — a hard-edged 512
    // shadow under a candle-lit arcade is the cheapest-looking thing a room
    // like this can do, and here it costs one frame at load rather than every
    // frame after it.
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.shadowMap.needsUpdate = true;
  }, [gl]);
  const materials = useMemo(() => {
    const map = stoneTexture();
    const slabMap = stoneTexture(false);
    const glow = glowTexture();
    const sky = skyTexture();
    // The long walls get their own copy of the masonry at a finer course. One
    // 512 square stretched over ten metres by seven lays courses 2.5 m long,
    // which is not a wall — it is a flat panel with lines ruled on it, and it
    // was the last thing in here still reading as cardboard.
    const wallMap = map.clone();
    wallMap.repeat.set(3.5, 2.4);
    wallMap.needsUpdate = true;
    return {
      map, slabMap, glow, sky, wallMap,
      stone: new THREE.MeshStandardMaterial({ map, color: '#a8a49c', roughness: 0.94, bumpMap: map, bumpScale: 0.045 }),
      wall: new THREE.MeshStandardMaterial({ map: wallMap, color: '#9d9587', roughness: 0.95, bumpMap: wallMap, bumpScale: 0.045 }),
      floor: new THREE.MeshStandardMaterial({ map: slabMap, color: '#968d7e', roughness: 0.9, bumpMap: slabMap, bumpScale: 0.05 }),
      trim: new THREE.MeshStandardMaterial({ map: slabMap, color: '#aaa396', roughness: 0.85, bumpMap: slabMap, bumpScale: 0.03 }),
      // The bed the floor slabs are laid on. It shows only in the joints, and
      // it is warm mortar rather than the shadowed wall stone it used to be —
      // black grout lines drawn dead straight across a whole floor were the
      // most computer-generated thing in the room.
      mortar: new THREE.MeshStandardMaterial({ map, color: '#6e6252', roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: '#2c2119', roughness: 0.78 }),
      // What sits BEHIND a boarded door and inside a blind niche. Ambient fill
      // reaches into a 60 mm gap perfectly well, so a joint between boards is
      // only a joint if there is something dark at the bottom of it; without
      // this the door was six planks drawn on one flat leaf.
      shade: new THREE.MeshStandardMaterial({ color: '#15110d', roughness: 1 }),
      // The back of a blind niche is in shadow, not in a void: black rectangles
      // behind the arcading read as holes punched in the wall.
      niche: new THREE.MeshStandardMaterial({ map, color: '#4a4034', roughness: 1 }),
      wax: new THREE.MeshStandardMaterial({ color: '#c6b795', roughness: 0.68 }),
      brass: new THREE.MeshStandardMaterial({ color: '#8b6938', metalness: 0.7, roughness: 0.38 }),
      iron: new THREE.MeshStandardMaterial({ color: '#3d352c', metalness: 0.55, roughness: 0.62 }),
    };
  }, []);
  useEffect(() => () => Object.values(materials).forEach(m => m.dispose()), [materials]);
  const { stone, wall, trim, wood, brass, floor, mortar, iron, glow, sky, wax, shade, niche } = materials;

  // Carved shapes shared across the room, built once and instanced below.
  const link = useMemo(() => new THREE.TorusGeometry(0.06, 0.018, 8, 14), []);
  const ring = useMemo(() => new THREE.TorusGeometry(0.26, 0.048, 14, 36), []);
  const corbel = useMemo(() => new THREE.BoxGeometry(0.24, 0.28, 0.34), []);
  const billet = useMemo(() => new THREE.BoxGeometry(0.13, 0.11, 0.26), []);
  useEffect(() => () => [link, ring, corbel, billet].forEach(g => g.dispose()),
    [link, ring, corbel, billet]);
  // A billet course running round the third order. The same trick as the rail's
  // dentils: a repeated small solid on a curve buys more carved shadow per draw
  // call than anything else in the room.
  const billets = useMemo(() => Array.from({ length: 29 }, (_, i) => {
    const a = 0.14 + i * (Math.PI - 0.28) / 28;
    return [Math.cos(a) * 3.53, 3.1 + Math.sin(a) * 3.53, -2.78, 0, 0, a];
  }), []);
  // A corbel table along the open span of each wall, at the impost course —
  // which is standing eye height, and is the stretch of wall the visitor
  // actually sees once they are out at the balustrade.
  // Drawn once per visit, lazily, so a re-render never re-rolls the view.
  const plateRef = useRef(null);
  if (!plateRef.current) plateRef.current = drawPlate(platesFor(place));
  const plate = plateRef.current;
  const corbels = useMemo(() => [-1, 1].flatMap(side =>
    Array.from({ length: 8 }, (_, i) => [side * 4.88, SPRING + 0.22, -4.35 + i * 0.5])), []);

  return <>
    <color attach="background" args={['#3b3229']} />
    {/* Fog that actually bites inside a ten-metre room. The old 16→52 could
        never touch anything in here, which is why the shadows sat at neutral
        black instead of sinking into warm dust the way the plates' do. It is
        doing two jobs at once: the far wall recedes, and — because every plate
        keeps its deepest shadow up at #32291f, luminance 0.16 — it is what
        stops an unlit corner of this room from going to nothing. */}
    <fog attach="fog" args={['#453a2c', 1.2, 26]} />
    {/* Warm above and warmer below. Nothing in this room goes neutral — in
        the plates even the sky-lit side of the stone is warm — but none of it
        goes CHROMATIC either. Lit stone in the plates measures #524840, which
        is a saturation of 0.22: a warm grey, not amber. The first pass at this
        relight used honest lamp colours (#c39a63, #6a5236 — saturation ~0.49)
        and drove the piers to 0.78, which is a room lit by a sodium bulb. */}
    <hemisphereLight args={['#bcb4a8', '#736759', 2.35]} />
    {/* The floor under the whole exposure. Sky-and-ground fill alone leaves a
        wall facing along the room lit by neither, and those were arriving at
        luminance 0.055 against the plates' 0.16 — the black-shadow habit the
        first build had, surviving in the corners. */}
    <ambientLight color="#948b7e" intensity={0.68} />
    {/* The void is the key light. It comes IN through the great arch, cool,
        from far out and high up, so the near masonry is rimmed against the
        distance exactly the way it is in the paintings. */}
    <directionalLight position={[-3, 9, -18]} color="#b8c6d8" intensity={2.6} />
    {/* …and the room answers with its own bounce off the floor and the stone,
        which is what keeps the camera-facing faces warm. */}
    <directionalLight position={[2, 3.5, 9]} color="#cfc1aa" intensity={3.0} />
    <directionalLight position={[-8, 2, 2]} color="#95887a" intensity={0.7} />
    {/* The lit threshold at the back: small and warm, and no longer the thing
        lighting the entire room orange from over the visitor's shoulder. */}
    {/* One light for the whole entrance wall: the two sconces, the threshold
        lamp and the rose all draw on this rather than each bringing their own. */}
    <pointLight position={[0, 2.5, 4.15]} intensity={9} color="#e9bd85" distance={8} decay={2} />
    <Suspense fallback={null}><LibraryView plate={plate} /></Suspense>
    <Haze glow={glow} sky={sky} />

    {/* ---- the ledge ------------------------------------------------------ */}
    <Block at={[0, -0.25, 0]} size={[10.5, 0.48, 10]} material={mortar} />
    {Array.from({ length: 10 }, (_, row) => Array.from({ length: 10 }, (_, col) =>
      <Block key={`${row}-${col}`} at={[-4.725 + col * 1.05, 0.004, -4.5 + row]}
        size={[1.042, 0.045, 0.992]} material={floor} rotation={[0, (row + col) % 2 * Math.PI, 0]} />))}
    {/* An inlaid rose in the pavement. A hundred identical squares is a floor
        that has no centre, and a reader walking in has nothing under their feet
        telling them where the room's middle is or which way it faces. */}
    <group position={[0, 0.031, -2.35]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh material={trim}><ringGeometry args={[1.42, 1.62, 48]} /></mesh>
      <mesh material={trim}><ringGeometry args={[1.28, 1.34, 48]} /></mesh>
      <mesh material={trim}><circleGeometry args={[0.34, 32]} /></mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = i * Math.PI / 4;
        return <mesh key={i} material={trim} position={[Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0]}
          rotation={[0, 0, a]}><planeGeometry args={[0.95, 0.12]} /></mesh>;
      })}
    </group>

    {/* ---- the two long walls --------------------------------------------- */}
    {[-1, 1].map(side => <group key={side}>
      <Block at={[side * 5.25, WALL_H / 2, 0]} size={[0.4, WALL_H, 10]} material={wall} />
      <Block at={[side * 5, 0.3, 0]} size={[0.2, 0.6, 10]} material={trim} />
      {/* Impost course where the vault leaves the wall, cornice above it. */}
      <Block at={[side * 5, SPRING, 0]} size={[0.26, 0.16, 10]} material={trim} />
      <Block at={[side * 5, 5.85, 0]} size={[0.3, 0.2, 10]} material={trim} />
      {/* A blind arcade over the shelves. Every plate fills its wall surface
          with repeated small openings; a flat dark rectangle is the one thing
          none of them contains — and at the frame's edges this is most of what
          a visitor ever sees of these two walls. */}
      {[-3.9, -2.5, -1.1, 0.3, 1.7, 3.1, 4.4].map(z => <group key={z}>
        <Block at={[side * 5.04, 3.94, z]} size={[0.03, 1.42, 1.24]} material={niche} />
        <Arch radius={0.6} thickness={0.11} depth={0.18} at={[side * 5.0, 3.95, z]}
          material={trim} rotation={[0, side * Math.PI / 2, 0]} />
      </group>)}
      <Shelves side={side} wood={wood} brass={brass} />
      {/* The back wall, full height now that the box is seven metres tall. */}
      <Block at={[side * 3.2, WALL_H / 2, 4.9]} size={[4, WALL_H, 0.45]} material={wall} />
      <Block at={[side * 1.12, 1.48, 4.63]} size={[0.22, 2.95, 0.3]} material={trim} />
      {/* …and the same blind arcade carried round onto it, at standing height
          rather than up in the vault, because this is the wall a reader meets
          face-on from the middle of the floor. */}
      {[2.2, 3.9].map(x => <group key={x}>
        {/* A blind arch needs something dark behind it or it is a hoop stuck
            on a wall, which is what these were: the arch is the frame, and the
            recessed panel inside it is the niche. */}
        <Block at={[side * x, 2.88, 4.66]} size={[1.16, 1.3, 0.03]} material={niche} />
        <Arch radius={0.55} thickness={0.1} depth={0.2} at={[side * x, 2.9, 4.55]} material={trim} />
        {[-0.6, 0.6].map(dx => <mesh key={dx} position={[side * x + dx, 2.5, 4.58]} material={trim} castShadow>
          <cylinderGeometry args={[0.055, 0.06, 1.9, 8]} />
        </mesh>)}
      </group>)}
      <Sconce x={side * 1.78} iron={iron} wax={wax} glow={glow} reduced={reduced} />
    </group>)}
    <Repeated geometry={corbel} material={trim} at={corbels} />

    {/* ---- the vault ------------------------------------------------------ */}
    <Block at={[0, WALL_H + 0.15, 0]} size={[10.5, 0.3, 10]} material={mortar} />
    {[-4.7, -1.5, 0.6, 2.7, 4.4].map(z =>
      <Arch key={z} radius={5.05} thickness={0.3} at={[0, SPRING, z]}
        scale={[1, VAULT, 1]} material={stone} />)}

    {/* ---- the entrance ---------------------------------------------------- */}
    <Block at={[0, 5.55, 4.9]} size={[2.7, 2.9, 0.45]} material={stone} />
    <Arch radius={1.02} at={[0, 2.9, 4.48]} material={trim} thickness={0.17} />
    {/* A dark, recessed entrance with a lit threshold: an actual rear landmark.
        The reveal is LINED — jambs, soffit and a threshold slab between the
        wall's back face and the leaf. Without them the recess was open at its
        sides, and once the void got a graded dome behind it the gap stopped
        being an unnoticed black margin and became a band of daylight running
        round three sides of the door, straight through six metres of wall. */}
    {[-1, 1].map(side => <Block key={side} at={[side * 1.29, 2.05, 5.36]}
      size={[0.18, 4.14, 0.5]} material={trim} />)}
    <Block at={[0, 4.02, 5.36]} size={[2.72, 0.24, 0.5]} material={trim} />
    <Block at={[0, 0.05, 5.36]} size={[2.72, 0.1, 0.5]} material={trim} />
    {/* The leaf: boarded, strapped and studded, rather than the flat plank with
        pinstripes it was. A door is the one thing in this room a reader walks
        right up to, and at arm's length the old one was a painted rectangle. */}
    <Block at={[0, 2.0, 5.66]} size={[2.42, 4.0, 0.1]} material={shade} />
    {[-0.98, -0.59, -0.2, 0.2, 0.59, 0.98].map(x =>
      <Block key={x} at={[x, 2.0, 5.57]} size={[0.33, 4.0, 0.1]} material={wood} />)}
    {[0.5, 1.95, 3.42].map(y => <group key={y}>
      <Block at={[0, y, 5.52]} size={[2.32, 0.13, 0.045]} material={iron} />
      {[-1.02, -0.62, -0.21, 0.21, 0.62, 1.02].map(x =>
        <mesh key={x} position={[x, y, 5.49]} material={iron}>
          <sphereGeometry args={[0.032, 8, 8]} />
        </mesh>)}
    </group>)}
    <mesh position={[0.72, 1.32, 5.5]} material={iron}>
      <torusGeometry args={[0.105, 0.019, 8, 22]} />
    </mesh>
    <mesh position={[0.72, 1.45, 5.5]} material={iron}>
      <sphereGeometry args={[0.045, 10, 10]} />
    </mesh>
    <Block at={[0, 0.04, 4.65]} size={[2, 0.08, 0.6]} material={trim} />
    {/* The threshold light itself, hung in the reveal under the soffit. */}
    <mesh position={[0, 3.72, 5.34]}><sphereGeometry args={[0.06, 12, 12]} />
      <meshBasicMaterial color="#ffdaa0" toneMapped={false} fog={false} /></mesh>
    <sprite position={[0, 3.72, 5.34]} scale={[1.1, 1.1, 1]}>
      <spriteMaterial map={glow} color="#ffb367" transparent opacity={0.5}
        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
    </sprite>

    {/* ---- the great arch onto the void ------------------------------------ */}
    {PILLARS.map(({ x }) => <Column key={x} x={x} material={stone} trim={trim} />)}
    {/* Four orders, STEPPED BACK IN Z as well as out in radius, so the way
        out is a splayed reveal nearly a metre deep rather than three rings
        stacked on one plane. That depth is most of what an archivolt is for:
        the orders shade each other, the opening gains a soffit, and the void
        arrives at the end of a short tunnel instead of behind a hoop. */}
    <Arch radius={3.05} at={[0, 3.1, -3.56]} material={stone} thickness={0.26} depth={0.32} />
    <Arch radius={3.22} at={[0, 3.1, -3.25]} material={trim} thickness={0.2} depth={0.32} />
    <Arch radius={3.42} at={[0, 3.1, -2.94]} material={stone} thickness={0.2} depth={0.32} />
    <Arch radius={3.64} at={[0, 3.1, -2.63]} material={trim} thickness={0.24} depth={0.32} />
    <Repeated geometry={billet} material={trim} at={billets} />
    <Block at={[0, 6.74, -2.99]} size={[0.44, 0.52, 1.0]} material={trim} />
    <Rail stone={stone} trim={trim} />

    {/* ---- what hangs in the opening --------------------------------------- */}
    <Chain x={-1.75} z={-3.85} from={6.9} to={2.55} iron={iron} link={link} ring={ring} />
    <Chain x={2.35} z={-3.7} from={6.9} to={3.2} iron={iron} link={link} ring={ring} />
    <Chain x={4.35} z={-4.1} from={6.9} to={4.3} iron={iron} link={link} ring={ring} />
    {/* One chain hung OUTSIDE the balustrade, over the drop. At the rail the
        reader stands 0.8 m off the ledge, which throws everything to either
        side past 50° and out of frame — so the only foreground that can
        survive that vantage is one hanging almost straight ahead. It also
        breaks the arrival view's dead symmetry, which was the last thing in
        here still composed like a diagram. */}
    <Chain x={-0.62} z={-4.86} from={6.9} to={2.34} iron={iron} link={link} ring={ring} />
    <Lantern at={LAMPS[0]} brass={brass} glow={glow} shadow />
    <Lantern at={LAMPS[1]} brass={brass} glow={glow} />
    <Candles wax={wax} brass={brass} glow={glow} reduced={reduced} />
    <ReadingStand stone={stone} wood={wood} brass={brass} opened={opened} />
    <Rose trim={trim} iron={iron} glow={glow} />
    {LIGHT_MESH ? null : <Shafts glow={glow} />}
    <Motes glow={glow} lamps={LAMPS} reduced={reduced} />
  </>;
}

function Visitor({ input, pose, onNear, onLock, onReady, interact }) {
  const { camera, gl } = useThree();
  const lastNear = useRef(null);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Walkable library balcony. W A S D to walk, arrow keys to look, E to interact.');
    let dragging = null;
    const look = (dx, dy) => {
      pose.current.yaw -= dx * 0.0025;
      pose.current.pitch = clamp(pose.current.pitch - dy * 0.0025, -1.25, 1.25);
    };
    const down = e => {
      if (e.button !== 0) return;
      canvas.focus({ preventScroll: true });
      dragging = { x: e.clientX, y: e.clientY };
      if (!document.pointerLockElement) canvas.setPointerCapture(e.pointerId);
    };
    const move = e => {
      if (document.pointerLockElement === canvas) look(e.movementX, e.movementY);
      else if (dragging && e.target === canvas) {
        look(e.clientX - dragging.x, e.clientY - dragging.y);
        dragging = { x: e.clientX, y: e.clientY };
      }
    };
    const up = () => { dragging = null; };
    const lock = () => { input.current.clear(); dragging = null; onLock(document.pointerLockElement === canvas); };
    const keyDown = e => {
      if (e.target instanceof Element && e.target.closest('input, [role="dialog"]')) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault(); input.current.add(e.code);
      }
      if (e.code === 'KeyE' && !e.repeat) interact();
    };
    const keyUp = e => input.current.delete(e.code);
    const reset = () => { input.current.clear(); dragging = null; };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    document.addEventListener('pointerlockchange', lock);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    onReady(canvas);
    return () => {
      reset(); onReady(null);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      document.removeEventListener('pointerlockchange', lock);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  }, [gl, input, pose, onLock, onReady, interact]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const p = pose.current;
    const keys = input.current;
    p.yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.3;
    p.pitch = clamp(p.pitch + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * dt, -1.25, 1.25);
    let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    let right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const length = Math.hypot(forward, right) || 1;
    forward /= length; right /= length;
    const speed = dt * 1.55;
    const next = moveVisitor(p,
      (right * Math.cos(p.yaw) - forward * Math.sin(p.yaw)) * speed,
      (-forward * Math.cos(p.yaw) - right * Math.sin(p.yaw)) * speed);
    Object.assign(p, next);
    camera.position.set(p.x, EYE_HEIGHT, p.z);
    camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
    const near = nearbyObject(p);
    if (near !== lastNear.current) { lastNear.current = near; onNear(near); }
  });
  return null;
}

class BalconyBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p className="balcony-failure" role="alert">The balcony could not be drawn. You can return to the tour below.</p>
      : this.props.children;
  }
}

export default function Balcony({ onClose, place = {}, reduced = false }) {
  // The same finish the corridor wears, and the reason the balcony read as
  // computer graphics standing next to a painting no matter how well it was
  // lit: every plate in this piece is grained Midjourney output seen through
  // Finish's bloom, grain and vignette, and this one view was going to the
  // screen raw. The grain is the biggest single part of it — it is what gives
  // the whole tour one skin — and the bloom is what lets the lamps and the
  // candle flames spill instead of merely being bright. Costs the composer's
  // MSAA, exactly as it does in the corridor (see the measurements in
  // Finish.jsx); the DPR ceiling below is raised a step to pay for it.
  //
  // `reduced` is the TOUR's answer, not a second reading of the media query
  // taken over here — one room in a piece must not be able to disagree with the
  // rest of it about whether the reader asked for stillness.
  const input = useRef(new Set());
  const pose = useRef({ ...START });
  const canvas = useRef(null);
  const nearRef = useRef(null);
  const [near, setNear] = useState(null);
  const [locked, setLocked] = useState(false);
  const [opened, setOpened] = useState(false);
  const [reading, setReading] = useState(false);
  const [lockError, setLockError] = useState('');
  const [contextLost, setContextLost] = useState(false);
  const lastUnlock = useRef(0);
  const readingRef = useRef(false);
  const closeButton = useRef(null);
  const noteButton = useRef(null);
  const ready = useCallback(el => { canvas.current = el; el?.focus({ preventScroll: true }); }, []);
  const updateLock = useCallback(value => {
    if (!value) lastUnlock.current = performance.now();
    setLocked(value);
  }, []);
  const updateNear = useCallback(value => { nearRef.current = value; setNear(value); }, []);
  // Arrival and departure. Every other threshold in this piece is a designed
  // crossing — seven of them, each with its own optical event (rites.js) — and
  // this one was a hard cut: the tour root took `display: none` and the balcony
  // simply existed, mid-blink. The veil is the cheapest honest answer, and it
  // is the tour's own: the same dissolve the entry veil makes, out of and back
  // into THIS chapter's fog rather than out of black, so the two rooms are
  // graded to each other across the join.
  const [veil, setVeil] = useState('in');
  const leaving = useRef(false);
  useEffect(() => {
    if (reduced) { setVeil('open'); return undefined; }
    const id = requestAnimationFrame(() => setVeil('open'));
    return () => cancelAnimationFrame(id);
  }, [reduced]);
  const leave = useCallback(() => {
    if (leaving.current) return;
    input.current.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    // A reader who asked for stillness gets the cut they asked for.
    if (reduced) { onClose(); return; }
    leaving.current = true;
    setVeil('out');
    window.setTimeout(onClose, 380);
  }, [onClose, reduced]);
  const interact = useCallback(() => {
    if (readingRef.current) return;
    if (nearRef.current === 'door') { leave(); return; }
    if (nearRef.current !== 'book') return;
    input.current.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    setOpened(true); readingRef.current = true; setReading(true);
  }, [leave]);
  const closeNote = useCallback(() => {
    readingRef.current = false; setReading(false);
    canvas.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
    const key = e => {
      if (e.key === 'Escape') {
        // The first Escape releases captured mouse-look; the next leaves.
        if (document.pointerLockElement) { document.exitPointerLock(); return; }
        if (performance.now() - lastUnlock.current < 200) return;
        if (readingRef.current) closeNote(); else leave();
      }
      if (e.key === 'Tab' && readingRef.current) {
        e.preventDefault(); noteButton.current?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [leave, closeNote]);
  useEffect(() => { if (reading) noteButton.current?.focus(); }, [reading]);
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    // Read-only state for rendered collision/input checks, not a second controller.
    window.__balcony = () => ({ ...pose.current, near: nearRef.current, keys: [...input.current], ready: Boolean(canvas.current) });
    return () => { delete window.__balcony; };
  }, []);

  const lockMouse = async () => {
    try {
      if (!canvas.current?.requestPointerLock) throw new Error('unavailable');
      await canvas.current.requestPointerLock();
      canvas.current.focus({ preventScroll: true });
      setLockError('');
    } catch { setLockError('Mouse capture unavailable. Drag the view or use the arrow keys.'); }
  };
  return <section className="balcony" aria-label="The reading balcony"
    // The chapter's own accent, the same one the corridor's HUD is wearing.
    // balcony.css reads it as --accent exactly as tour.css does.
    style={place.accent ? { '--accent': place.accent } : undefined}>
    <div className="balcony-world" inert={reading || contextLost}>
      <BalconyBoundary>
        <Canvas shadows dpr={DPR} camera={{ position: [START.x, EYE_HEIGHT, START.z], fov: 65, near: 0.08, far: 150 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', e => {
              if (!gl.domElement.isConnected) return;
              e.preventDefault(); input.current.clear(); setContextLost(true);
            });
            gl.domElement.addEventListener('webglcontextrestored', () => {
              if (gl.domElement.isConnected) { gl.shadowMap.needsUpdate = true; setContextLost(false); }
            });
          }}>
          <Room opened={opened} reduced={reduced} place={place} />
          <Visitor input={input} pose={pose} onNear={updateNear} onLock={updateLock} onReady={ready} interact={interact} />
          <Finish reduced={reduced} />
        </Canvas>
      </BalconyBoundary>
    </div>
    <header className="balcony-heading" aria-hidden={reading || undefined}>
      <span className="balcony-eyebrow">BABEL / A PLACE TO LINGER</span>
      <h1>The reading balcony</h1>
      <p>{place.title ? `${place.title} continues beyond the stone.` : 'The archive continues beyond the stone.'}</p>
    </header>
    {/* The reader's actual place. This said "Ⅰ VESTIBULE" whoever was
        standing here and wherever they had walked from. */}
    <div className="balcony-compass" aria-hidden="true">
      <span>{place.numeral ?? 'I'}</span><i />{(place.title ?? 'The archive').toUpperCase()}
    </div>
    {locked && <div className="balcony-reticle" aria-hidden="true" />}
    {contextLost && <p className="balcony-failure" role="status">Waiting for the light to return…</p>}
    <div className="balcony-controls" inert={reading} aria-hidden={reading || undefined}>
      <div className="balcony-context" aria-live="polite">
        {near === 'book' && <button onClick={interact}><kbd>E</kbd> Open the reader’s book <span>↗</span></button>}
        {near === 'door' && <button onClick={interact}><kbd>E</kbd> Through the entrance <span>↗</span></button>}
        {!near && <span>Walk to the balustrade. There is a book beyond the right column.</span>}
      </div>
      <footer className="balcony-footer">
        <button className="balcony-return" onClick={leave} ref={closeButton}>← <span>Return to tour</span></button>
        <p><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk</span><span>drag / arrows to look</span></p>
        <button className="balcony-mouse" onClick={lockMouse} disabled={locked}>{locked ? 'Esc to release mouse' : 'Enable mouse look'} <span>⤢</span></button>
        <span className="balcony-touch-hint">Drag to look · Hold arrows to walk</span>
      </footer>
      <div className="balcony-touch" aria-label="Walking controls">
        {[['KeyW', '↑', 'Walk forward'], ['KeyA', '←', 'Step left'], ['KeyS', '↓', 'Walk backward'], ['KeyD', '→', 'Step right']].map(([code, glyph, label]) =>
          <button key={code} aria-label={label} onPointerDown={e => {
            e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.current.add(code);
          }} onPointerUp={() => input.current.delete(code)} onPointerCancel={() => input.current.delete(code)}
          onLostPointerCapture={() => input.current.delete(code)}>{glyph}</button>)}
      </div>
      {lockError && <p className="balcony-lock-error" role="status">{lockError}</p>}
    </div>
    <div className={`balcony-veil is-${veil}`} aria-hidden="true"
      style={place.fog ? { background: place.fog } : undefined} />
    {reading && <div className="balcony-note" role="dialog" aria-modal="true" aria-labelledby="balcony-note-title">
      <span className="balcony-eyebrow">A READER’S MARGINALIA / I</span>
      <h2 id="balcony-note-title">Someone stood here before you.</h2>
      <p>I counted the bridges until the lantern burned low. When I turned back, the doorway was still there. For a moment, that was enough.</p>
      <span className="balcony-note-rule" />
      <button ref={noteButton} onClick={closeNote}>Leave the book open <span>↗</span></button>
    </div>}
  </section>;
}
