// The world's shaders and textures, sent ahead of its first frame (World.jsx,
// WorldContent; and tools/load-bench.mjs, which counts what they cost).
import * as THREE from 'three';

// Every shader the world will draw with, started now: compiled against the
// scene's fog, environment and lights exactly as a frame would, and into a
// render target, because that is where the composer draws the scene (and a
// target changes the program: no tone mapping, linear output). The world is
// compiled from outside the scene so that nothing draws it before it is ready.
// Returns the materials, or null if this renderer could not do it.
//
// renderer.compile works out a program for every OBJECT it finds, not for
// every material, and with a few thousand objects sharing their materials
// that alone was three seconds. So it is handed stand-ins: one per material
// and kind of object it is on (what three reads off an object to choose a
// program, `programShape`), each the real object seen through Object.create
// with no children of its own, and the world's lights as a frame would find
// them — visible all the way up.
export const programShape = (o) => {
  const a = o.geometry?.attributes ?? {}, m = o.geometry?.morphAttributes ?? {};
  return [
    o.type, o.isInstancedMesh, !!o.instanceColor, !!o.morphTexture, o.isBatchedMesh, !!o._colorsTexture, o.isSkinnedMesh,
    Object.keys(a).sort().join(','), a.color?.itemSize, Object.keys(m).map((k) => `${k}${m[k].length}`).join(','),
  ].join('|');
};
// (`lights`: the lights to compile against — the root's own, visible all the
// way up, unless others are given; `seen`: stand-ins already made, kept from
// one call to the next)
export const standIns = (roots, { lights = null, seen = new Set() } = {}) => {
  const stand = new THREE.Group();
  const add = (o) => {
    const p = Object.create(o);
    p.children = [];
    stand.children.push(p);
  };
  for (const root of [roots].flat()) {
    root.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
      const key = `${(Array.isArray(o.material) ? o.material : [o.material]).map((m) => m.id).join('+')}#${programShape(o)}`;
      if (seen.has(key)) return;
      seen.add(key);
      add(o);
    });
    if (!lights) root.traverseVisible((o) => { if (o.isLight) add(o); });
  }
  for (const light of lights ?? []) add(light);
  return stand;
};
const compileInto = (gl, stand, camera, scene) => {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const was = gl.getRenderTarget();
  try {
    gl.setRenderTarget(target);
    return gl.compile(stand, camera, scene);
  } catch (error) {
    console.warn('[world] could not start the shaders early; the first frame will compile them:', error);
    return null;
  } finally {
    gl.setRenderTarget(was);
    target.dispose();
  }
};
export const startShaders = (gl, root, camera, scene) => compileInto(gl, standIns(root), camera, scene);

// The same, started while the world is still being built: the shaders take
// as long to compile as the world takes to build, and compiled in parallel
// (KHR_parallel_shader_compile) they need not wait for it. `warm(objects)`
// starts the programs for what has been made so far (assembleWorld's
// `ahead`), compiled against stand-in lights made as the world's are
// (`lights`: build/light.js, makeLights) and the finished environment
// (`environment()`, asked for once, before the first of them) — a program is
// compiled for so many lights of each kind and that environment, and these
// must be the ones the world will have, or the programs are made for nothing.
// Whatever is made after the last call, startShaders starts at the end; what
// was started here it finds already made. (A material whose shader is patched
// after it is first put in the world — the pit's fade and the route light,
// build/light.js — has its first program made for nothing; its key changes
// with the patch, so the right one is still made, at the end. tools/
// load-bench.mjs --warmcheck shows that the shaders started either way are
// the same.)
export const makeWarmer = (gl, camera, scene, { lights, environment }) => {
  const seen = new Set();
  let ready = false;
  return (objects) => {
    if (!objects.length) return;
    if (!ready) {
      environment();
      ready = true;
    }
    compileInto(gl, standIns(objects, { lights, seen }), camera, scene);
  };
};
export const shaderReady = (gl, material) => {
  const program = gl.properties.get(material).currentProgram;
  return !program || program.isReady();
};
// Every texture a material samples, its own maps and its shader's uniforms.
export const texturesOf = (materials) => {
  const out = new Set();
  const take = (v) => { if (v?.isTexture && !v.isRenderTargetTexture && v.image) out.add(v); };
  for (const m of materials) {
    Object.values(m).forEach(take);
    if (m.uniforms) Object.values(m.uniforms).forEach((u) => take(u?.value));
  }
  return out;
};
