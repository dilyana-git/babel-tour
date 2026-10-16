// The world's first load as WorldContent (src/world/World.jsx) makes it, step
// by step, measured and never drawn: what each section of the build takes on
// the main thread, how many shader programs the world asks the GPU for, and
// how many texels it sends. Run by tools/load-bench.mjs, which reads
// window.__bench when it is set.
import * as THREE from 'three';
import { assembleWorld, PAINTED } from '../src/world/buildWorld';
import { makePainter } from '../src/world/paint';
import { makeSky } from '../src/world/sky';
import { prepareEnvironment } from '../src/world/effects';
import { startShaders, texturesOf, makeWarmer } from '../src/world/assembly';
import { makeLights } from '../src/world/build/light';
import { LIGHT_MESH } from '../src/capability';

const Q = new URLSearchParams(location.search);

// Every shader source handed to the GL. The browser keeps compiled shaders on
// disk by their source, so a source that differs from one load to the next is
// compiled again on every visit.
const sources = new Set();
for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
  if (!C) continue;
  const was = C.prototype.shaderSource;
  C.prototype.shaderSource = function (shader, source) { sources.add(source); return was.call(this, shader, source); };
}
const now = () => performance.now();

// FNV-1a over bytes, for a fingerprint of what was built
const fnv = (bytes, h = 2166136261) => {
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619) >>> 0; }
  return h;
};
const fingerprint = (root) => {
  let h = 2166136261, vertices = 0, meshes = 0;
  const text = new TextEncoder();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.geometry) return;
    meshes += 1;
    for (const name of Object.keys(o.geometry.attributes).sort()) {
      const a = o.geometry.attributes[name];
      h = fnv(text.encode(name), h);
      h = fnv(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength), h);
      if (name === 'position') vertices += a.count;
    }
    if (o.geometry.index) h = fnv(new Uint8Array(o.geometry.index.array.buffer, o.geometry.index.array.byteOffset, o.geometry.index.array.byteLength), h);
    h = fnv(new Uint8Array(Float32Array.from(o.matrixWorld.elements).buffer), h);
    if (o.isInstancedMesh) h = fnv(new Uint8Array(o.instanceMatrix.array.buffer, 0, o.count * 64), h);
  });
  return { hash: h.toString(16), meshes, vertices };
};

async function bench() {
  const out = { steps: [] };
  const t0 = now();
  const painter = makePainter(PAINTED);
  const painted = painter.done.then(() => { out.paintedMs = Math.round(now() - t0); });
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFShadowMap;
  gl.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 10, 50, 20000);
  camera.position.set(720, 2000, 2000);
  const sky = makeSky();
  scene.add(sky.mesh);
  scene.background = new THREE.Color('#03060a');
  scene.fog = new THREE.Fog(new THREE.Color('#06080c'), 1e4, 2e4);
  const prepared = prepareEnvironment(gl);
  out.setupMs = Math.round(now() - t0);

  // as WorldContent does: the shaders for what has been built started at
  // every breath (40 ms of building), unless ?nowarm
  let environment = null;
  const finishEnvironment = () => {
    if (environment) return;
    const e0 = now();
    environment = prepared.finish();
    scene.environment = environment.texture;
    out.environmentMs = Math.round(now() - e0);
  };
  const ahead = Q.has('nowarm') ? null : [];
  const { hemi, moon, pool } = makeLights({ light: LIGHT_MESH });
  const warm = makeWarmer(gl, camera, scene, { lights: [hemi, moon, ...pool], environment: finishEnvironment });
  let since = now();
  out.warmMs = 0;
  // (what each material's program key was when its shader was started early,
  // to find any changed after: that program was made for nothing)
  const warmedKey = new Map();
  const keyOf = (m) => `${m.type}|${m.side}|${m.transparent}|${m.vertexColors}|${!!m.map}|${m.customProgramCacheKey?.() ?? ''}`
    + `|${m.vertexShader?.length ?? ''}|${m.fragmentShader?.length ?? ''}`;
  const steps = assembleWorld({ light: LIGHT_MESH, paintings: false, painter, ahead });
  let name = 'The kit', t = now(), world = null;
  const b0 = t;
  // (with ?sections: the section in which each material is first put on
  // something drawn, for when its programs could first be started)
  const firstIn = new Map();
  let section = 0;
  if (Q.has('sections')) {
    const add = THREE.Object3D.prototype.add;
    THREE.Object3D.prototype.add = function (...objects) {
      for (const o of objects) {
        o.traverse?.((x) => {
          for (const m of Array.isArray(x.material) ? x.material : x.material ? [x.material] : []) if (!firstIn.has(m)) firstIn.set(m, section);
        });
      }
      return add.apply(this, objects);
    };
  }
  for (;;) {
    const step = steps.next();
    out.steps.push([name, Math.round(now() - t)]);
    if (step.done) { world = step.value; break; }
    if (ahead && now() - since > 40) {
      const w0 = now();
      for (const o of ahead) o.traverse((x) => { for (const m of [x.material].flat()) if (m && !warmedKey.has(m)) warmedKey.set(m, keyOf(m)); });
      warm(ahead.splice(0));
      out.warmMs += now() - w0;
      since = now();
    }
    name = step.value;
    section += 1;
    t = now();
  }
  out.buildMs = Math.round(now() - b0);
  out.warmMs = Math.round(out.warmMs);
  out.programsDuringBuild = gl.info.programs?.length ?? 0;
  out.changedAfterWarm = [...warmedKey].filter(([m, k]) => keyOf(m) !== k).map(([m, k]) => `${m.name || m.type}: ${k.slice(0, 90)} -> ${keyOf(m).slice(0, 90)}`);
  // (before anything is set for the map: the veil, for one, scales the cedars)
  if (!Q.has('nofingerprint')) out.fingerprint = fingerprint(world.root);
  finishEnvironment();

  t = now();
  const materials = startShaders(gl, world.root, camera, scene);
  out.compileCallMs = Math.round(now() - t);
  out.materials = materials ? materials.size : 0;
  const programs = gl.info.programs ?? [];
  if (firstIn.size) {
    const earliest = new Map();
    for (const m of materials ?? []) {
      for (const p of gl.properties.get(m).programs?.values() ?? []) earliest.set(p, Math.min(earliest.get(p) ?? Infinity, firstIn.get(m) ?? Infinity));
    }
    out.programsBySection = out.steps.map(([n], i) => [n, [...earliest.values()].filter((k) => k === i).length]);
  }
  out.programs = programs.length;
  // each program by what made it: its material's name or type, and its own key
  if (Q.has('keys')) out.programKeys = programs.map((p) => p.cacheKey);
  out.programList = programs.map((p) => {
    const parts = p.cacheKey.split(',');
    return `${p.name || '?'} | ${parts[parts.length - 1] || '-'} | ${(fnv(new TextEncoder().encode(p.cacheKey)) >>> 0).toString(16)}`;
  }).sort();

  // What the map's first frame draws: the world as LiveWorld sets it over the
  // map (the veil up, the eye off, nothing culled for a reader), visible all
  // the way up. The programs its materials need are the ones the map waits on.
  world.setVeil?.(1);
  world.setEye?.(0);
  world.cull?.(null, [camera.position]);
  const drawn = new Set();
  world.root.traverseVisible((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) drawn.add(m);
  });
  const programsOf = (m) => [...(gl.properties.get(m).programs?.values() ?? [])];
  const needed = new Set([...drawn].flatMap(programsOf));
  out.mapMaterials = [...drawn].filter((m) => materials?.has(m)).length;
  out.mapPrograms = needed.size;
  out.offMap = [...(materials ?? [])].filter((m) => !drawn.has(m))
    .map((m) => `${m.name || m.type} | ${m.customProgramCacheKey?.() ?? ''}`.slice(0, 120)).sort();

  const text = new TextEncoder();
  out.sources = [...sources].map((x) => fnv(text.encode(x)).toString(16)).sort();
  window.__sources = [...sources];

  await painted;
  const textures = [...new Set([...(materials ? texturesOf(materials) : []), ...painter.textures()])];
  // (counted by image: copies of a texture share one, and one upload)
  const images = new Map();
  for (const x of textures) {
    const key = x.source ?? x.image;
    if (!images.has(key)) images.set(key, { w: x.image?.width ?? 0, h: x.image?.height ?? 0, names: new Set(), mips: x.generateMipmaps && x.minFilter !== THREE.LinearFilter && x.minFilter !== THREE.NearestFilter });
    images.get(key).names.add(x.name || x.constructor.name);
  }
  const bytes = (im) => im.w * im.h * 4 * (im.mips ? 4 / 3 : 1);
  out.textures = images.size;
  out.textureMB = Math.round([...images.values()].reduce((a, im) => a + bytes(im), 0) / 1e5) / 10;
  out.textureList = [...images.values()].sort((a, b) => bytes(b) - bytes(a))
    .map((im) => `${(bytes(im) / 1e6).toFixed(1).padStart(6)} MB  ${im.w}x${im.h}  ${[...im.names].join(', ')}`);
  out.totalMs = Math.round(now() - t0);
  return out;
}

bench().then((r) => { window.__bench = r; }, (e) => { window.__bench = { error: String(e?.stack ?? e) }; });
