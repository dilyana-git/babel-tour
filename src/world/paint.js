// ── Painting while the world is built ────────────────────────────────────────
// The heavy surfaces (paintJobs.js) are painted by a few workers at once, while
// the main thread builds the world. buildWorld asks for them by name (`take`)
// and gets textures straight away: the right size and sampling, with no pixels
// yet. Materials are made from them and their shaders compiled; the paint
// arrives (`done`) before the world is first drawn, and every copy taken of a
// texture in the meantime (buildWorld's `again`) is filled with it too.
//
// Where a browser has no module workers or no OffscreenCanvas, the same
// painters run here instead, a little later. Nothing is lost but the time.
import * as THREE from 'three';
import { PAINTERS, readMaps } from './paintJobs';

// A texture whose pixels are still being painted. Until they arrive it asks
// for no upload (a clone's needsUpdate waits too); when they do, `fill` gives
// them to every copy at once, since copies share one image.
class PaintedTexture extends THREE.DataTexture {
  constructor(spec) {
    super(null, spec?.w ?? 1, spec?.h ?? 1);
    this.isPaintedTexture = true;
    // sampled as toTexture (textures.js) samples a canvas
    this.minFilter = THREE.LinearMipmapLinearFilter;
    this.magFilter = THREE.LinearFilter;
    this.generateMipmaps = true;
    this.unpackAlignment = 4;
    this.wrapS = this.wrapT = THREE.RepeatWrapping;
    if (spec) {
      this.colorSpace = spec.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      this.anisotropy = spec.anisotropy;
      this.copies = new Set([this]);
    }
  }

  copy(source) {
    super.copy(source);
    this.copies = source.copies;
    this.copies?.add(this);
    return this;
  }

  set needsUpdate(value) {
    if (value === true && this.image?.data) super.needsUpdate = true;
  }

  fill({ data, w, h, srgb, anisotropy, wrapS, wrapT }) {
    if (w !== this.image.width || h !== this.image.height || srgb !== (this.colorSpace === THREE.SRGBColorSpace)
      || anisotropy !== this.anisotropy || wrapS !== this.wrapS || wrapT !== this.wrapT) {
      console.warn('[paint] a painted map came back unlike what paintJobs.js said it would be:', this.name || this, { w, h, srgb, anisotropy });
    }
    this.image = { data, width: w, height: h };
    for (const t of this.copies) t.version++;
    this.source.needsUpdate = true;
  }
}

// Two, not as many as the machine has threads: the painting is never what the
// world waits for (on the machine this is made on two painters finish in
// under three seconds, long before the shaders are ready), and every painter
// past that takes a core from the main thread while it builds the world.
const WORKERS = typeof navigator === 'undefined' ? 1 : Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1));
// Long enough for the slowest machine to paint everything; past it, whatever
// has not come back is painted here.
const GIVE_UP_MS = 30000;

// `jobs`: { key: [painter name, args] }. Painting starts at once; `take(key)`
// returns that set's textures (painted or not), and `done` resolves when every
// one of them has its pixels.
export function makePainter(jobs) {
  const sets = {}, waiting = new Map();
  Object.entries(jobs).forEach(([key, [name, args]]) => {
    const gives = PAINTERS[name].gives(args);
    sets[key] = Object.fromEntries(Object.entries(gives).map(([k, spec]) => {
      const t = new PaintedTexture(spec);
      t.name = `${key}.${k}`;
      return [k, t];
    }));
    waiting.set(key, { name, args });
  });

  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  const workers = [];
  const settle = () => {
    if (waiting.size) return;
    workers.forEach((w) => w.terminate());
    workers.length = 0;
    finish();
  };
  const arrive = (key, maps) => {
    if (!waiting.has(key)) return;
    waiting.delete(key);
    Object.entries(maps).forEach(([k, m]) => sets[key][k]?.fill(m));
    settle();
  };
  // Here, on the main thread: the way when workers cannot, and the way out
  // when one fails. A breath between sets keeps the page answering.
  let here = null;
  const paintHere = () => {
    if (here) return;
    here = (async () => {
      for (const [key, { name, args }] of [...waiting]) {
        await new Promise((r) => setTimeout(r, 0));
        if (!waiting.has(key)) continue;
        arrive(key, readMaps(PAINTERS[name].paint(args)).maps);
      }
      here = null;
      if (waiting.size) paintHere();
    })();
  };

  let canWork = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  if (canWork) {
    try {
      // The longest first, each to whichever painter has least to do.
      const load = Array.from({ length: WORKERS }, () => ({ ms: 0, keys: [] }));
      [...waiting.keys()]
        .sort((a, b) => PAINTERS[waiting.get(b).name].cost - PAINTERS[waiting.get(a).name].cost)
        .forEach((key) => {
          const least = load.reduce((a, b) => (b.ms < a.ms ? b : a));
          least.ms += PAINTERS[waiting.get(key).name].cost;
          least.keys.push(key);
        });
      for (const { keys } of load) {
        if (!keys.length) continue;
        const worker = new Worker(new URL('./paint.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => {
          if (data.error) {
            console.warn('[paint] a painter failed; painting here instead:', data.error);
            paintHere();
          } else arrive(data.id, data.maps);
        };
        worker.onerror = (e) => {
          console.warn('[paint] a painter could not start; painting here instead:', e.message ?? e);
          e.preventDefault?.();
          paintHere();
        };
        keys.forEach((key) => worker.postMessage({ id: key, ...waiting.get(key) }));
        workers.push(worker);
      }
      setTimeout(() => { if (waiting.size) paintHere(); }, GIVE_UP_MS);
    } catch (error) {
      console.warn('[paint] no painters; painting here instead:', error);
      canWork = false;
    }
  }
  if (!canWork) paintHere();

  return {
    take: (key) => sets[key],
    done,
    textures: () => Object.values(sets).flatMap((s) => Object.values(s)),
    dispose: () => {
      waiting.clear();
      workers.forEach((w) => w.terminate());
      workers.length = 0;
    },
  };
}

// Without workers at all — painted here and now, as the world always was.
// What buildWorld uses when it is handed no painter.
export const paintNow = (jobs) => ({
  take: (key) => {
    const [name, args] = jobs[key];
    return PAINTERS[name].paint(args);
  },
});
