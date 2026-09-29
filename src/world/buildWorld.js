// ── The world ────────────────────────────────────────────────────────────────
// The whole walk as one carved place, built in three.js and seen from a
// three-quarter height, after the first set of look frames: the Library a
// honeycomb of tall hexagonal galleries whose every wall is a bookshelf (five
// shelves to a wall, as Borges has it), arched hallways, glass sphere lamps
// hanging on chains, an air shaft in each gallery that opens onto stars and a
// starfield under the whole honeycomb; the Vertigo a funnel of books at the
// centre; the Door, whose sixth wall is a carved Gothic arch (portal.js) onto
// the garden of forking paths — the wisteria pergola, the teal pond and its
// pavilion, the maze.
//
// Standing in it: every room has a place for a reader at eye level (`stands`)
// and a way on to the next (`legs`) — the hallways, the Echo's stair, the
// Vertigo's funnel, the pergola, the zigzag bridge, the maze — which World.jsx
// walks. With `paintings` (the plate tour, ?plates) each room instead holds its
// Midjourney plate on its far wall, and the camera flies down to it.
//
// Units are pixels of the old overhead render's 1440 × 900 frame: x to the
// right, z down the frame (toward the camera), y up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ashlar, flagstones, walnut, CEDAR, spineAtlas, hedgeLeaves, foliageAtlas, FOLIAGE_KINDS, bark, glow as glowTexture, makeRng, SPINE_KINDS, friezeBand, bayPlates, PLATE_CELLS, giltLetters, shelfEdge, limestone, purbeck, hanging, HANGING_KINDS } from './textures';
import { makeBookMaterial, makeShaftMaterial, shaftVolume, makeSparkles, makeGlowMaterial, makeLampGlobeMaterial, makeFoliageMaterial, makeFoliageDepthMaterial, makeFoliagePrepass, makeHangingMaterial, crossedCards, spineAt } from './effects';
import { growTree, Wood } from './trees';
import { growHedge, rectUnionLoops, stripLoop } from './hedges';
import { buildPortal, PORTAL } from './portal';
import { makeWater, WATER_Y } from './water';
import { makeLilyPads, lilyFlowerGeometry, lilyBudGeometry, makeFlowerMaterial, makeKoi } from './pond';
import { buildFinale } from './finale';
import { lightPoolSize } from '../capability';
import { VANTAGES } from './vantages';

export const FRAME = [1440, 900];
// The palette (see World.jsx): the stone was a warm greige that stayed brown
// in the lamp's light and out of it. It is a neutral limestone grey now, so the
// lamps are what make it warm. (A cool sage was tried first and read, with the
// rest of that cut, as a filter.) ?wpal=old for the stone as it was.
const OLD_PALETTE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wpal') === 'old';
const stoneTint = (was, now) => (OLD_PALETTE ? was : now);
// ?wglare=old: the lamps and the moon's shaft as they were before 2026-09-26 —
// halos sized in the room, and light columns that stay whole with the eye
// inside them (the milky Echo crossing), to compare against.
const OLD_GLARE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wglare') === 'old';
// ?wtree=pine (DEV): every tree in the garden grown as the one kind, to judge
// it; ?wtree=none, no trees at all, to measure what they cost (__worldBench).
const ONE_TREE = import.meta.env?.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('wtree') : null;
// ?whedge=bare (DEV): the hedges without their sprigs; ?whedge=none, no hedges;
// ?whedge=gloss, the body's full lamp gloss as it was before 2026-09-28
// at all — what they cost, and what the sprigs do for the silhouette.
const HEDGE_DIAL = import.meta.env?.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('whedge') : null;
export const MASS_H = 120;   // how tall the galleries' walls stand
export const CAP = 3;        // the pale stone laid on top of them

// ── Somewhere else to stand ──────────────────────────────────────────────────
// `stands` (below) gives every room the one place the walk puts a reader. A
// vantage is a SECOND place in the same room, climbed to from the first and come
// back down from — somewhere the room only shows itself from, which the walk
// through it cannot stop at.
//
// The geometry hangs on the stand itself (`stands[i].vantage`); the names are
// out here because the HUD has to label the way up before the world is built.
const deg = Math.PI / 180;

export function buildWorld({ light = false, paintings = true } = {}) {
  let seed = 1941;
  const rnd = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const dir = (a) => [Math.cos(a * deg), Math.sin(a * deg)];
  const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s];
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const unit2 = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const hexPts = (c, r) => Array.from({ length: 6 }, (_, k) => add(c, dir(60 * k), r));
  const circlePts = (c, r, n = 48) => Array.from({ length: n }, (_, k) => add(c, dir((360 * k) / n), r));
  const rot3 = () => [rr(0, 3), rr(0, 3), rr(0, 3)];
  const detail = light ? 0.5 : 1;

  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // ── Painted textures ──────────────────────────────────────────────────────
  const paint = (w, h, fn) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    fn(c.getContext('2d'), w, h);
    return c;
  };
  const tex = (canvas, repeat = [1, 1], srgb = true) => {
    const t = keep(new THREE.CanvasTexture(canvas));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const withRepeat = (t, repeat) => {
    const c = keep(t.clone());
    c.repeat.set(repeat[0], repeat[1]);
    c.needsUpdate = true;
    return c;
  };
  const rgb = (r, g, b, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
  const speckle = (g, w, h, n, dark, alpha, size = [0.6, 2.2]) => {
    for (let k = 0; k < n * detail; k++) {
      g.fillStyle = dark ? `rgba(0,0,0,${rr(0, alpha)})` : `rgba(255,236,205,${rr(0, alpha)})`;
      const s = rr(...size);
      g.fillRect(rr(0, w), rr(0, h), s, s);
    }
  };
  const blob = (g, x, y, r, [hh, ss, ll], alpha = 1, lightOff = 0.3) => {
    const grd = g.createRadialGradient(x - r * lightOff, y - r * lightOff, r * 0.08, x, y, r);
    grd.addColorStop(0, `hsla(${hh},${ss}%,${Math.min(95, ll + 9)}%,${alpha})`);
    grd.addColorStop(0.62, `hsla(${hh},${ss}%,${ll}%,${alpha})`);
    grd.addColorStop(1, `hsla(${hh},${ss}%,${Math.max(2, ll - 8)}%,0)`);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };

  const grassTex = tex(paint(1024, 1024, (g, s) => {
    g.fillStyle = '#1a2c21';
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 800 * detail; k++) {
      g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${rr(0.03, 0.1)})` : `rgba(96,140,96,${rr(0.02, 0.06)})`;
      g.beginPath(); g.arc(rr(0, s), rr(0, s), rr(10, 70), 0, Math.PI * 2); g.fill();
    }
    for (let k = 0; k < 36000 * detail; k++) {
      g.strokeStyle = `hsla(${rr(95, 150)},${rr(20, 42)}%,${rr(12, 30)}%,${rr(0.4, 0.8)})`;
      g.lineWidth = rr(0.6, 1.4);
      const x = rr(0, s), y = rr(0, s), a = rr(0, Math.PI * 2), L = rr(2, 7);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
  }), [1 / 46, 1 / 46]);

  const gravelTex = tex(paint(512, 512, (g, s) => {
    g.fillStyle = '#6f685c';
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 8000 * detail; k++) {
      const l = rr(-30, 40);
      g.fillStyle = rgb(158 + l, 150 + l, 134 + l, rr(0.6, 1));
      g.beginPath(); g.ellipse(rr(0, s), rr(0, s), rr(0.8, 3.2), rr(0.6, 2.4), rr(0, 3), 0, Math.PI * 2); g.fill();
    }
    speckle(g, s, s, 8000, true, 0.35);
  }), [1 / 16, 1 / 16]);

  // Stars, for the shafts, the pools and the dark under everything.
  const starCanvas = paint(512, 512, (g, s) => {
    g.fillStyle = '#01040a';
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 16; k++) {
      const x = rr(0, s), y = rr(0, s), r = rr(50, 170);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${pick(['40,140,170', '70,90,160', '30,160,150'])},${rr(0.08, 0.2)})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    }
    for (let k = 0; k < 1100 * detail; k++) {
      const big = rnd() > 0.93;
      g.fillStyle = pick(['#ffffff', '#cfefff', '#ffe9c4', '#9fe3ff']);
      g.globalAlpha = rr(0.35, 1);
      g.beginPath();
      g.arc(rr(0, s), rr(0, s), big ? rr(1, 1.8) : rr(0.3, 0.8), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 14; k++) {
      const x = rr(0, s), y = rr(0, s);
      const grd = g.createRadialGradient(x, y, 0, x, y, 6);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(1, 'rgba(160,230,255,0)');
      g.fillStyle = grd;
      g.fillRect(x - 6, y - 6, 12, 12);
    }
  });
  const starTex = tex(starCanvas, [1 / 180, 1 / 180]);

  const roofTex = tex(paint(256, 256, (g, s) => {
    const rows = 12, rowH = s / rows;
    for (let r = 0; r < rows; r++) {
      g.fillStyle = r % 2 ? '#26302f' : '#1e2827';
      g.fillRect(0, r * rowH, s, rowH);
      g.fillStyle = 'rgba(150,178,170,0.42)';
      g.fillRect(0, r * rowH, s, 1.6);
    }
    for (let x = 0; x < s; x += 8) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, 0, 1.4, s); }
  }), [8, 1]);

  const radialTex = tex(paint(256, 256, (g) => {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.65, 'rgba(255,255,255,0.14)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  }), [1, 1], false);
  // Where a stone lantern's light lands: nothing right under it — its own
  // platform shades the ground there — a little all round from the sun and the
  // moon, and most of it out in front of each window. Laid with the windows
  // along x. (Painted without the world's stream: see the wisteria below.)
  const lanternPoolTex = tex(paint(256, 256, (g) => {
    const ring = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    ring.addColorStop(0, 'rgba(255,255,255,0)');
    ring.addColorStop(0.12, 'rgba(255,255,255,0.08)');
    ring.addColorStop(0.24, 'rgba(255,255,255,0.34)');
    ring.addColorStop(0.55, 'rgba(255,255,255,0.1)');
    ring.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ring;
    g.fillRect(0, 0, 256, 256);
    for (const s of [-1, 1]) {
      g.save();
      g.translate(128 + s * 46, 128);
      g.scale(1, 0.6);
      const lobe = g.createRadialGradient(0, 0, 0, 0, 0, 74);
      lobe.addColorStop(0, 'rgba(255,255,255,0.6)');
      lobe.addColorStop(0.5, 'rgba(255,255,255,0.22)');
      lobe.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lobe;
      g.fillRect(-128, -128, 256, 256);
      g.restore();
    }
    g.globalCompositeOperation = 'destination-out';
    const shade = g.createRadialGradient(128, 128, 0, 128, 128, 34);
    shade.addColorStop(0, 'rgba(0,0,0,1)');
    shade.addColorStop(0.55, 'rgba(0,0,0,0.85)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = shade;
    g.fillRect(0, 0, 256, 256);
  }), [1, 1], false);

  // (The pergola hangs its wisteria as racemes now — see the pergola — and no
  // longer lays this card over its top. It is still painted: painting it draws
  // on the world's stream, and the garden is laid out from the draws after.)
  const wisteriaTex = tex(paint(768, 300, (g, w, h) => {
    for (let k = 0; k < 700; k++) blob(g, rr(0, w), rr(16, h - 16), rr(3, 7), [rr(100, 130), rr(28, 38), rr(18, 30)], 1, 0.3);
    for (let k = 0; k < 420; k++) {
      const x = rr(8, w - 8), y = rr(18, h - 18);
      const edge = Math.abs(y - h / 2) / (h / 2);
      if (rnd() > 0.35 + edge * 0.8) continue;
      const ang = rr(0, 6.28), n = Math.floor(rr(10, 22));
      for (let m = 0; m < n; m++) {
        const t = m / n;
        blob(g, x + Math.cos(ang) * t * 17 + rr(-1.5, 1.5), y + Math.sin(ang) * t * 17 + rr(-1.5, 1.5), 4 * (1 - t * 0.65), [rr(262, 278), rr(38, 52), 44 + t * 36], 1, 0.25);
      }
    }
  }));
  const ivyTex = tex(paint(384, 192, (g, w, h) => {
    for (let k = 0; k < 520; k++) {
      const x = rr(0, w), y = rr(0, h);
      const edge = Math.max(Math.abs(x - w / 2) / (w / 2), Math.abs(y - h / 2) / (h / 2));
      if (rnd() < edge * 1.1) continue;
      blob(g, x, y, rr(4, 10), [rr(112, 140), rr(26, 40), rr(14, 28)], 1, 0.35);
    }
  }));
  // The koi were a card painted here, four blotches drawn from the world's
  // stream; they are solid fish now (pond.js), and the stream is spent as the
  // card spent it, so everything laid out after this lands where it did.
  for (let k = 0; k < 20; k++) rnd();

  // Surfaces with the maps that make light behave on them (see textures.js).
  const scaled = (set, repeat) => {
    Object.values(set).forEach((t) => { keep(t); t.repeat.set(repeat, repeat); });
    return set;
  };
  const again = (t, repeat) => {
    const c = keep(t.clone());
    c.repeat.set(repeat, repeat);
    c.needsUpdate = true;
    return c;
  };
  // A reader is 18 units tall, so a unit is 9.4 cm and these are sizes of stone:
  // a flagstone 1 m across, an ashlar course 45 cm high, the massive pale stone
  // of the caps and the drums laid 2 m by 1. (Everything they go on is projected
  // in world units — see uvWorld — so these numbers mean what they say.)
  const flag = scaled(flagstones(), 1 / 32);
  const wall = scaled(ashlar(), 1 / 38);
  const pale = scaled(ashlar({ seed: 9, courses: 4, blocks: 2, tone: [158, 150, 136], strength: 2 }), 1 / 42);
  const wood = scaled(walnut(), 1 / 7);
  const timber = scaled(walnut({ seed: 23, tone: CEDAR }), 1 / 12);
  const spines = spineAtlas();
  Object.values(spines).forEach(keep);
  // The frieze's key is laid in world units like the stone: seven units to a
  // pair of keys along the wall, and the board's own height (111.5 to 115) up
  // it — so the pattern sits on the board whatever length of wall it runs.
  const friezeTex = keep(friezeBand());
  friezeTex.repeat.set(1 / 7, 1 / 3.5);
  friezeTex.offset.set(0, 1 - ((111.5 / 3.5) % 1));
  const gilt = giltLetters();
  keep(gilt.map);
  const hedge =scaled(hedgeLeaves(), 1 / 12);
  // The Door's arch (portal.js): carved stone with no joints painted in it,
  // laid by the mouldings' own length (a unit of texture every nine units of
  // stone); the same pale ashlar as the caps at half the size of block, for
  // the plain faces of a doorway; the dark marble of its shafts; what hangs in it.
  const carveSet = limestone();
  Object.values(carveSet).forEach(keep);
  const dressedSet = scaled(ashlar({ seed: 9, courses: 4, blocks: 2, tone: [158, 150, 136], strength: 2 }), 1 / 20);
  const marbleSet = purbeck();
  Object.values(marbleSet).forEach(keep);
  const hangTex = keep(hanging());
  const glowTex = keep(glowTexture());
  const lampHaloTex = keep(glowTexture(256, 0.11));
  const water = makeWater({ mirror: !light });
  const wind = { value: 0 };
  const lilyPads = makeLilyPads(wind);
  lilyPads.textures.forEach(keep);
  const leaves = keep(foliageAtlas());
  const barkSet = bark();
  Object.values(barkSet).forEach(keep);
  const shaftMaterial = keep(makeShaftMaterial());

  // A gradient across a strip (black at v = 0, white at v = 1), and a worn
  // track: opaque down the middle, thinning irregularly to nothing at both
  // sides. Both are read as alpha (from green), on the second uv set.
  const gradTex = tex(paint(8, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, h, 0, 0);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.35, '#6a6a6a');
    grd.addColorStop(1, '#000000');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }), [1, 1], false);
  const wornTex = tex(paint(64, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const across = Math.abs(x / (w - 1) - 0.5) * 2;
      const v = Math.max(0, 1 - across ** 2.2);
      g.fillStyle = `rgb(${v * 200},${v * 200},${v * 200})`;
      g.fillRect(x, 0, 1, h);
    }
    // (its own stream: a draw on the world's would move the garden)
    const wr = makeRng(71), wrr = (a, b) => a + (b - a) * wr();
    for (let k = 0; k < 600; k++) {
      g.fillStyle = `rgba(0,0,0,${wrr(0.05, 0.25)})`;
      g.fillRect(wrr(0, w), wrr(0, h), wrr(1, 4), wrr(2, 10));
    }
  }), [1, 1], false);
  for (const t of [gradTex, wornTex]) { t.channel = 1; t.wrapS = THREE.ClampToEdgeWrapping; }
  // The Door's: pale dust thinning away from the breach (v runs into the
  // room); moss drawn along the joints of the flagstones' own layout (see
  // textures.js — four rows, three to a row, every other row offset half a
  // slab), laid in the same world units so it sits in them; one leaf; a globe.
  const dustFanTex = tex(paint(128, 128, (g, w, h) => {
    const dr = makeRng(303);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1), a = 0.55 * (1 - v) ** 1.6;
      for (let x = 0; x < w; x++) {
        const across = Math.abs(x / (w - 1) - 0.5) * 2;
        g.fillStyle = `rgba(255,255,255,${a * (1 - across ** 1.8) * (0.7 + dr() * 0.3)})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  }), [1, 1]);
  dustFanTex.wrapS = dustFanTex.wrapT = THREE.ClampToEdgeWrapping;
  const mossTex = tex(paint(1024, 1024, (g, S) => {
    const mr = makeRng(808), mrr = (a, b) => a + (b - a) * mr();
    const tuft = (x, y, r) => {
      g.fillStyle = `hsla(${mrr(72, 100)},${mrr(24, 42)}%,${mrr(12, 24)}%,${mrr(0.55, 0.9)})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    const sh = S / 4, sw = S / 3;
    for (let r = 0; r < 4; r++) {
      for (let x = 0; x < S; x += mrr(3, 7)) if (mr() < 0.75) tuft(x, r * sh + mrr(-3, 3), mrr(3, 9));
      const off = (r % 2) * sw * 0.5;
      for (let k = -1; k <= 3; k++) {
        const x0 = k * sw + off;
        for (let y = r * sh; y < (r + 1) * sh; y += mrr(3, 7)) if (mr() < 0.75) tuft(x0 + mrr(-3, 3), y, mrr(3, 9));
        for (let n = 0; n < 3; n++) tuft(x0 + mrr(-10, 10), r * sh + mrr(-10, 10), mrr(8, 18));
      }
    }
  }), [1 / 32, 1 / 32]);
  const leafTex = tex(paint(64, 40, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(2, h / 2);
    g.quadraticCurveTo(w * 0.45, -h * 0.15, w - 2, h / 2);
    g.quadraticCurveTo(w * 0.45, h * 1.15, 2, h / 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(4, h / 2); g.lineTo(w - 6, h / 2); g.stroke();
  }), [1, 1]);
  const globeTex = tex(paint(512, 256, (g, w, h) => {
    const gr = makeRng(404), grr = (a, b) => a + (b - a) * gr();
    g.fillStyle = '#b9a47c';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 16; k++) {
      const x = grr(0, w), y = grr(h * 0.15, h * 0.85);
      g.fillStyle = `rgba(${grr(96, 130)},${grr(78, 100)},${grr(48, 64)},0.9)`;
      g.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        const r = grr(14, 44) * (0.6 + 0.4 * Math.sin(a * 3 + k));
        g.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r);
      }
      g.fill();
    }
    g.strokeStyle = 'rgba(70,50,30,0.35)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += w / 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = h / 6; y < h; y += h / 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }), [1, 1]);

  // ── Materials ─────────────────────────────────────────────────────────────
  const Std = (o) => keep(new THREE.MeshStandardMaterial(o));
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
  const stoneShade = (mat, { weather = false } = {}) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBounceRooms = bounceRooms;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vStoneW;
          varying float vStoneDown;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vStoneW = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vStoneDown = max(0.0, -normalize(mat3(modelMatrix) * objectNormal).y);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uBounceRooms[${bounceRooms.value.length}];
          varying vec3 vStoneW;
          varying float vStoneDown;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          ${weather ? `diffuseColor.rgb *= mix(0.66, 1.0, smoothstep(6.0, 17.0, vStoneW.y))
            * (1.0 - 0.3 * smoothstep(88.0, 124.0, vStoneW.y));` : ''}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float bounce = 0.0;
          for (int i = 0; i < ${bounceRooms.value.length}; i++) {
            bounce = max(bounce, uBounceRooms[i].z * smoothstep(130.0, 80.0, distance(vStoneW.xz, uBounceRooms[i].xy)));
          }
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.72, 0.46) * 0.2 * bounce * vStoneDown
            * smoothstep(60.0, 20.0, vStoneW.y);`);
    };
    mat.customProgramCacheKey = () => `babel-stone-${weather ? 'w' : 'b'}-${bounceRooms.value.length}`;
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
          diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(5.2, 9.5, vFlameW.y)) * (0.8 + 0.4 * flameNoise(vFlameW * 0.42));
          float moss = smoothstep(0.4, 0.95, flameN.y)
            * smoothstep(0.42, 0.72, flameNoise(vFlameW * 0.8) * 0.65 + flameNoise(vFlameW * 2.9) * 0.35);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.062, 0.064, 0.026) * (0.7 + 2.0 * stoneLum), moss * 0.7);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec3 toFlame = vFlame.xyz - vFlameW;
          float flameD2 = max(dot(toFlame, toFlame), 0.01);
          float flameNdl = max(0.0, dot(flameN, toFlame * inversesqrt(flameD2)));
          float flameOut = length(toFlame.xz);
          float flameAim = flameOut > 0.3 ? abs(dot(-toFlame.xz / flameOut, vFlameAxis)) : 1.0;
          totalEmissiveRadiance += diffuseColor.rgb * uFlameColor * vFlame.w * flameNdl
            * mix(0.35, 1.0, flameAim * flameAim * flameAim) / (1.0 + 0.16 * flameD2);`);
    };
    mat.customProgramCacheKey = () => 'babel-flame-stone';
    return mat;
  };
  const sprite = (map) => Std({ map, alphaTest: 0.32, roughness: 0.9, side: THREE.DoubleSide });
  const M = {
    floor: Std({ map: flag.map, normalMap: flag.normalMap, roughnessMap: flag.roughnessMap, color: stoneTint('#8d7f6e', '#8a857b'), roughness: 1, side: THREE.DoubleSide }),
    mass: stoneShade(Std({ map: wall.map, normalMap: wall.normalMap, roughnessMap: wall.roughnessMap, color: stoneTint('#b6a897', '#ada89e'), roughness: 1, side: THREE.DoubleSide }), { weather: true }),
    cap: stoneShade(Std({ map: pale.map, normalMap: pale.normalMap, roughnessMap: pale.roughnessMap, color: stoneTint('#b3a894', '#b0aa9d'), roughness: 1, side: THREE.DoubleSide })),
    shelf: Std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, roughness: 1 }),
    shelfBack: Std({ map: wood.map, color: '#7a6754', roughness: 1 }),
    books: keep(makeBookMaterial(spines)),
    // the dressing of a bookcase (see shelfWall)
    frieze: Std({ map: friezeTex, roughness: 0.55, metalness: 0.25 }),
    plate: Std({ map: keep(bayPlates()), roughness: 0.35, metalness: 0.05 }),
    letters: Std({ map: gilt.map, roughness: 0.45, metalness: 0.35, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    scallop: Std({ map: keep(shelfEdge()), color: '#6a3c26', alphaTest: 0.5, roughness: 0.8, side: THREE.DoubleSide }),
    railGlow: keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc07a').multiplyScalar(0.75), toneMapped: false })),
    // A darker stone for the band a floor keeps along its walls, so a room
    // has an edge to it and not one grid from wall to well.
    floorBand: Std({ map: flag.map, normalMap: flag.normalMap, roughnessMap: flag.roughnessMap, color: '#5a554c', roughness: 1, side: THREE.DoubleSide }),
    // Bronze where hands go: the top of a handrail, a newel's cap. Rubbed
    // bright and smooth, where the rest has gone dark.
    bronzeWorn: Std({ color: '#86653b', roughness: 0.42, metalness: 0.8, side: THREE.DoubleSide }),
    oak: Std({ color: '#5e3f27', roughness: 0.55 }),
    shade: Std({ color: '#7a4a22', emissive: '#ff9a48', emissiveIntensity: 1.3, roughness: 0.7, side: THREE.DoubleSide }),
    shadeDead: Std({ color: '#4d3e32', roughness: 0.85, side: THREE.DoubleSide }),
    paper: Std({ color: '#cdbf9e', roughness: 0.9 }),
    // the front edge of a shelf where books have gone in and out for centuries
    shelfWorn: Std({ color: '#6e4d31', roughness: 0.45 }),
    dust: Std({ color: '#8b857a', roughness: 1 }),
    // the soft dark line where a case stands on the floor
    contact: keep(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.5, alphaMap: gradTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
    // Stone walked smooth: the floor's and the stair's own stone, paler and
    // with a sheen, in a strip that fades out at both sides. Laid over the
    // stone in world units, so its joints are the stone's joints.
    wornFloor: Std({ map: flag.map, color: '#a8a295', roughness: 0.34, transparent: true, depthWrite: false, alphaMap: wornTex, polygonOffset: true, polygonOffsetFactor: -2 }),
    wornStep: Std({ map: again(flag.map, 1 / 22), color: '#c6c0b2', roughness: 0.36, transparent: true, depthWrite: false, alphaMap: wornTex, polygonOffset: true, polygonOffsetFactor: -2 }),
    deadShards: Std({ color: '#6a625a', roughness: 0.25, metalness: 0, envMapIntensity: 0.8, side: THREE.DoubleSide }),
    dustFan: Std({ map: dustFanTex, color: '#bdb3a2', roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    moss: Std({ map: mossTex, roughness: 1, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3 }),
    leaf: Std({ map: leafTex, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide }),
    globeMap: Std({ map: globeTex, roughness: 0.55 }),
    // What came down with the Door's wall lies in the light that comes in
    // through it: no lamp reaches it, and unlit it read as black chips.
    moonRock: Std({ map: again(pale.map, 0.35), normalMap: again(pale.normalMap, 0.35), color: '#b3aa9c', roughness: 0.95, emissive: '#71897b', emissiveIntensity: 0.28, emissiveMap: again(pale.map, 0.35) }),
    moonStone: Std({ map: pale.map, normalMap: pale.normalMap, color: '#b0aa9d', roughness: 1, emissive: '#71897b', emissiveIntensity: 0.22, emissiveMap: pale.map }),
    bronze: Std({ color: '#7d5d38', roughness: 0.46, metalness: 0.8, side: THREE.DoubleSide }),
    bronzeDim: Std({ color: '#4e3d2b', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
    inlay: Std({ color: '#9c7c3c', roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide }),
    mirror: Std({ color: '#767c82', roughness: 0.34, metalness: 0.95, envMapIntensity: 2.4 }),
    liner: Std({ color: '#2a2219', roughness: 1, side: THREE.DoubleSide }),
    stars: keep(new THREE.MeshBasicMaterial({ map: starTex, color: '#ffffff', toneMapped: false, side: THREE.DoubleSide })),
    step: stoneShade(Std({ map: again(flag.map, 1 / 22), normalMap: again(flag.normalMap, 1 / 22), roughnessMap: again(flag.roughnessMap, 1 / 22), color: stoneTint('#b3a692', '#aea99b'), roughness: 1 })),
    robe: Std({ color: '#413428', roughness: 0.86 }),
    glow: keep(makeGlowMaterial()),
    globe: keep(makeLampGlobeMaterial()),
    // A globe that has gone out: the same opal glass with nothing behind it —
    // dull, dark and opaque, catching only a highlight of the lamp still lit.
    deadGlass: Std({ color: '#5c544a', roughness: 0.3, metalness: 0, envMapIntensity: 0.7 }),
    foliage: keep(makeFoliageMaterial(leaves, wind, FOLIAGE_KINDS, { prepassed: true })),
    foliagePre: keep(makeFoliagePrepass(leaves, wind, FOLIAGE_KINDS)),
    // the dead leaf a hedge stands in: its own leaf, browned, laid flat
    hedgeLitter: Std({
      name: 'hedge-litter', map: hedge.map, color: '#8c7556', roughness: 1, vertexColors: true,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    // the same again for the hedges' sprigs (one program with the trees'; a
    // material of their own so they can be told apart — and switched off —
    // by name)
    hedgeLeaf: keep(Object.assign(makeFoliageMaterial(leaves, wind, FOLIAGE_KINDS, { prepassed: true }), { name: 'hedge-leaf' })),
    hedgeLeafPre: keep(Object.assign(makeFoliagePrepass(leaves, wind, FOLIAGE_KINDS), { name: 'hedge-leaf-pre' })),
    // the trees' wood (trees.js): each tree's bark colour is in its vertices
    bark: Std({ map: barkSet.map, normalMap: barkSet.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), vertexColors: true, roughness: 0.95 }),
    glass: Std({ color: '#ffe2b8', transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0, envMapIntensity: 2.2, depthWrite: false }),
    iron: Std({ color: '#2a2520', roughness: 0.6, metalness: 0.6 }),
    grass: Std({ map: grassTex, color: '#5e6d63', roughness: 1, side: THREE.DoubleSide }),
    gravel: Std({ map: gravelTex, color: '#6f6c66', roughness: 1, side: THREE.DoubleSide }),
    mazeFloor: Std({ map: gravelTex, color: '#635f57', roughness: 1, side: THREE.DoubleSide }),
    wood: Std({ map: timber.map, normalMap: timber.normalMap, roughnessMap: timber.roughnessMap, color: '#9d7d5e', roughness: 0.85 }),
    plank: Std({ map: again(timber.map, 1 / 16), normalMap: again(timber.normalMap, 1 / 16), color: '#b59872', roughness: 0.85 }),
    lacquer: Std({ color: '#5a2620', roughness: 0.45 }),
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
    hedge: skyDull(Std({
      name: 'hedge',
      map: hedge.map, normalMap: hedge.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: hedge.roughnessMap,
      color: '#d6dccb', roughness: 1, vertexColors: true,
    }), 0.1, HEDGE_DIAL === 'gloss' ? 1 : 0.2),
    stone: stoneShade(Std({ map: again(pale.map, 1 / 26), normalMap: again(pale.normalMap, 1 / 26), roughnessMap: again(pale.roughnessMap, 1 / 26), color: '#b9ae9f', roughness: 1 })),
    frame: Std({ color: '#7a5a30', roughness: 0.4, metalness: 0.6 }),
    // The garden's stone lanterns: cut stone with no joints in it (a lantern
    // is carved from five blocks, not laid in courses), lit from inside.
    lanternStone: flameLit(Std({ map: again(carveSet.map, 1 / 11), normalMap: again(carveSet.normalMap, 1 / 11), roughnessMap: again(carveSet.roughnessMap, 1 / 11), color: '#b3ada2', roughness: 1 })),
    // the paper of their windows, coloured by the flame behind it (litPaper)
    lanternPaper: keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })),
    paperDead: Std({ color: '#6f685c', roughness: 0.95, side: THREE.DoubleSide }),
    wisteria: sprite(wisteriaTex),
    ivy: sprite(ivyTex),
    carve: stoneShade(Std({ map: carveSet.map, normalMap: carveSet.normalMap, roughnessMap: carveSet.roughnessMap, color: stoneTint('#b3a894', '#b4aea1'), roughness: 1, side: THREE.DoubleSide })),
    dressed: stoneShade(Std({ map: dressedSet.map, normalMap: dressedSet.normalMap, roughnessMap: dressedSet.roughnessMap, color: stoneTint('#b3a894', '#aca699'), roughness: 1, side: THREE.DoubleSide }), { weather: true }),
    marble: Std({ map: marbleSet.map, roughness: 0.24, metalness: 0, envMapIntensity: 1.3 }),
    hang: keep(makeHangingMaterial(hangTex, wind, HANGING_KINDS)),
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
    add(geo) {
      const flat = geo.index ? geo.toNonIndexed() : geo;
      if (flat !== geo) geo.dispose();
      if (this.project) uvWorld(flat);
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
  // OUTLINE is the one it had to turn round (the `reverse` branch of its
  // ExtrudeGeometry). Every outline here is drawn clockwise, so that branch
  // never ran and every hole kept the winding it arrived with: the stone had no
  // inner face at all. A gallery's own walls were culled from inside it — the
  // eye looked straight through them into the next room, which is what walking
  // the Library felt like.
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
  const uvWorld = (geo) => {
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    if (!pos || !nor) return geo;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
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
  const wornRibbon = (pts, width, y) => {
    const pos = [], uvw = [], uv1 = [], idx = [];
    let run = 0;
    pts.forEach((p, i) => {
      const t = unit2(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]), n = [-t[1], t[0]];
      if (i) run += dist(pts[i - 1], p);
      for (const side of [-1, 1]) {
        const q = add(p, n, (side * width) / 2);
        pos.push(q[0], y, q[1]);
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
  const instances = (geo, mat, items, { cast = true, receive = true, chunked = false, attrs = null, depth = null, prepass = null } = {}) => {
    if (!items.length) return null;
    keep(geo);
    const groups = new Map();
    for (const it of items) {
      const k = chunked ? chunkKey(it.p[0], it.p[2]) : 'all';
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
      if (depth) inst.customDepthMaterial = depth;
      inst.computeBoundingSphere();
      root.add(inst);
      if (prepass) {
        const pre = new THREE.InstancedMesh(g, prepass, group.length);
        pre.instanceMatrix = inst.instanceMatrix;
        pre.castShadow = false;
        pre.receiveShadow = false;
        pre.renderOrder = -1;
        pre.computeBoundingSphere();
        root.add(pre);
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
  const decal = ([x, z], sx, sz, color, opacity, y = 6.6, flicker = 0) => {
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
  const halo = ([x, z], y, size, color, opacity, map) => {
    const mat = haloMaterial(color, opacity, map);
    const s = new THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    s.position.set(x, y, z);
    s.renderOrder = 4;
    root.add(s);
    // a hanging lamp's (see HALO_REACH): the only halos big enough to fill a room
    halos.push({ mat, base: opacity, phase: rr(0, 100), sprite: s, size, lamp: map === lampHaloTex });
  };
  const lightWishes = [];
  // `column` [x, z, radius]: whoever stands inside it keeps this light, however far off.
  const point = ([x, z], y, color, intensity, priority, decay = 2, column = null) => {
    lightWishes.push({ x, y, z, color, intensity, priority, decay, column });
  };

  // ── The honeycomb ─────────────────────────────────────────────────────────
  const R = 100, A = R * Math.sqrt(3) / 2, GAP = 50, D = 2 * A + GAP, AC = D / 2, RC = AC * 2 / Math.sqrt(3);
  const HALL = 36;
  const ARCH_SPRING = 58, ARCH_R = HALL / 2; // hallways are arched, apex at 76
  const TIER_H = 21, TIER_BASE = 10, TIERS = 5;
  const O = [232, 785];
  const E0 = [D * Math.cos(30 * deg), D * Math.sin(30 * deg)], E1 = [0, D];
  const cellC = (i, j) => [O[0] + i * E0[0] + j * E1[0], O[1] + i * E0[1] + j * E1[1]];
  const key = (i, j) => `${i},${j}`;
  const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const ROUTE = { '0,0': 0, '1,-1': 1, '2,-2': 2, '3,-3': 3, '4,-4': 4 };
  const GARDEN = new Set();
  for (let i = 3; i <= 16; i++) {
    for (let j = -20; j <= -2; j++) {
      const [x, y] = cellC(i, j);
      if (y < (x - 720) * 0.889 + 20) GARDEN.add(key(i, j));
    }
  }
  GARDEN.add('5,-4');
  ['4,-4', '3,-3', '3,-4'].forEach((k) => GARDEN.delete(k));
  const cells = [];
  for (let i = -7; i <= 16; i++) {
    for (let j = -20; j <= 12; j++) {
      const c = cellC(i, j);
      if (c[0] < -620 || c[0] > 2100 || c[1] < -1000 || c[1] > 1400) continue;
      cells.push({ i, j, c, k: key(i, j), garden: GARDEN.has(key(i, j)), room: ROUTE[key(i, j)] });
    }
  }
  // (x, z, how much warm floor-light the room's stone soffits take back)
  bounceRooms.value = [[0, 0, 1], [1, -1, 0.8], [2, -2, 0.25], [3, -3, 0.5], [4, -4, 0.7]]
    .map(([i, j, k]) => { const q = cellC(i, j); return new THREE.Vector3(q[0], q[1], k); });
  // the wells of the three rooms that have one (hexagons: the flat radius of
  // `shaft` below), and the Vertigo's round pit
  wells.value = [[0, 0, 48, 1], [1, -1, 38, 1], [2, -2, 40, 1], [3, -3, 68, 0]]
    .map(([i, j, r, hex]) => { const q = cellC(i, j); return new THREE.Vector4(q[0], q[1], hex ? r * Math.sqrt(3) / 2 : r, hex); });
  const inFrame = (p) => p[0] > -160 && p[0] < 1600 && p[1] > -260 && p[1] < 1080;
  const isGardenAt = (i, j) => GARDEN.has(key(i, j));
  const nearestCell = (p) => cells.reduce((best, c) => (dist(c.c, p) < dist(best.c, p) ? c : best), cells[0]);
  const inGarden = (p) => nearestCell(p).garden;
  const routeCenters = Object.keys(ROUTE).map((k) => cellC(...k.split(',').map(Number)));
  const routeDist = (p) => Math.min(...routeCenters.map((c) => dist(c, p)));
  const hallway = (cell, k) => {
    if (cell.garden || (k !== 2 && k !== 5)) return false;
    if (isGardenAt(cell.i + NB[k][0], cell.j + NB[k][1])) return false;
    if (cell.k === '3,-3' && k === 5) return false;
    if (cell.k === '4,-4') return false;
    return true;
  };
  const edgeFrame = (c, k) => {
    const n = dir(60 * k + 30);
    const i0 = add(c, dir(60 * k), R), i1 = add(c, dir(60 * k + 60), R);
    const t = [(i1[0] - i0[0]) / R, (i1[1] - i0[1]) / R];
    return { n, t, i0, i1, mi: add(c, n, A) };
  };
  const hallMid = (i, j, k) => add(cellC(i, j), dir(60 * k + 30), AC);
  // A flight of steps as one piece of stone: stepped along the top, arched
  // underneath, and — with `from`/`to` inside [0, steps] — able to stop in mid
  // air, sheared off over the well with the arch broken away under it.
  const flightProfile = ({
    steps = 18, run = 8, lift = 2.4, base = 8, tread = 3, span = 72,
    from = 0, to = steps, spring = 47, arch = 21, ground = 3,
  }) => {
    const stepTop = (k) => base + (k < steps / 2 ? k : steps - 1 - k) * lift + tread;
    const soffit = (t) => { const r = Math.abs(t) / spring; return ground + (r < 1 ? arch * (1 - r * r) ** 0.62 : 0); };
    // The pitch line: the straight rake through the nosings, up one side and
    // down the other, level over the two middle treads. Everything the flight
    // wears — its string course, its arch ring, the height of its handrail —
    // is set off this one line, so none of it can drift out of step with the
    // stone. (The stepped top is where a tread IS; the pitch line is where the
    // eye reads the stair going.)
    const pitch = (u) => base + tread + lift * Math.min((u + span) / run, (span - u) / run, (steps - 2) / 2);
    const u0 = -span + from * run, u1 = -span + to * run;
    const top = [];
    for (let k = from; k < to; k++) {
      const t0 = -span + k * run;
      top.push([t0, stepTop(k)], [t0 + run, stepTop(k)]);
    }
    const under = [];
    for (let n = 24; n >= 0; n--) {
      const t = u0 + (n / 24) * (u1 - u0);
      under.push([t, soffit(t)]);
    }
    return {
      pts: [...top, ...under], top, u0, u1, soffit, pitch, stepTop,
      dims: { steps, run, span, spring, from, to },
    };
  };

  // ── The dressing on a flight ──────────────────────────────────────────────
  // A stepped block with a hole under it is not a bridge yet. This is what
  // makes it one. Almost none of it is written out in numbers of its own:
  // every line is asked of the profile the stone is cut from
  // (`flightProfile`), so a flight that is ever re-cut carries its ornament
  // with it.
  //
  //   nosings      a moulded lip over every riser. Without them a stair is a
  //                stack of blocks, and this is the part the reader climbs
  //                past at arm's length.
  //   the ring     the arch drawn as the voussoirs it would be built of: proud
  //                of both flanks AND carried on across the soffit, so the
  //                underside is coursed too instead of being one dark sheet,
  //                with a keystone at the crown.
  //   abutments    beyond the springing the flank comes down to the floor, and
  //                that is the only stone in the span standing on anything —
  //                so it is the part that should look like it. Coursed ashlar
  //                on a projecting plinth, joints broken course over course.
  //   the string   a band and a corona over it, riding just under the deck
  //                line from end to end. It is the line that hands the eye
  //                the whole span at once, and what the keystone breaks up
  //                through.
  //   balustrade   turned balusters on the coping, between newels, over the
  //                arch and no further — and BROKEN again at the crossing,
  //                where the other flight's deck arrives and a reader can
  //                step across. Both of those are measured, not chosen; the
  //                notes are where they are decided.
  const flightDress = (c, ang, f, halfW, { gap = null, ends = [true, true] } = {}) => {
    const { run, span, spring, steps, from, to } = f.dims;
    const { u0, u1, soffit, pitch, stepTop } = f;
    const ax = dir(ang), px = dir(ang + 90);
    const spot = (u, z) => add(add(c, ax, u), px, z);
    // A flight sheared off in mid air (the Silence) has no pitch line left
    // where it was cut, so the parapet would stand on past the broken deck in
    // the air. `shorn` holds it down to the stone that is really there.
    const shorn = Math.min(from > 0 ? stepTop(from) + 0.6 : Infinity,
      to < steps ? stepTop(to - 1) + 0.6 : Infinity);
    const deck = (u) => Math.min(pitch(u), shorn);
    // Everything on the flank is set off the deck line and RAKES with it —
    // the parapet, its coping, the string under it, the top of the arch ring.
    // Stepping the kerb with the treads instead (which is how this was built)
    // leaves a sawtooth of bare stone between it and every raking member, and
    // the foot of the stair came out looking like a slipped wall.
    //
    // The pitch line kinks over the crown, so a member drawn from end to end
    // has to be given those corners or it cuts across the top of the flight.
    const kinks = [-8, 8].filter((u) => u > u0 + 1e-6 && u < u1 - 1e-6);
    const rake = (dy, a = u0, b = u1) => [a, ...kinks.filter((k) => k > a + 1e-6 && k < b - 1e-6), b]
      .map((u) => [u, deck(u) + dy]);
    const bandPts = (lo, hi, a, b) => [...rake(hi, a, b), ...rake(lo, a, b).reverse()];
    // Over the crossing the parapet comes DOWN. The other flight's deck
    // arrives there, and a kerb standing across it is a kerb across the way
    // off — from the crown the landing was a lattice of four little walls with
    // the reader penned in the middle of it. Only the stone above the deck
    // goes; what is under it belongs to the arch and stays.
    // `gap` is one span for both flanks, or a function of the flank (-1, 1)
    // where the two differ — two flights meeting at a landing at 60 degrees
    // bury the inner flank in each other three times as far as the outer one.
    // A span may run off either end of the flight; it is clipped to it.
    const HIGH = 1.6, FLUSH = -0.45;
    const gapOf = (side) => (typeof gap === 'function' ? gap(side) : gap);
    const parapetTop = (side) => {
      const out = [];
      const leg = (a, b, dy) => { if (b > a + 1e-6) out.push(...rake(dy, a, b)); };
      const g = gapOf(side);
      if (g && g[1] > u0 && g[0] < u1) {
        const a = Math.max(u0, g[0]), b = Math.min(u1, g[1]);
        leg(u0, a, HIGH);   // each leg ends and the next begins at the
        leg(a, b, FLUSH);   // same u: the doubled point is the step down
        leg(b, u1, HIGH);
      } else leg(u0, u1, HIGH);
      return out;
    };
    // How far each member stands out past the flank the flight already has.
    // The order IS the hierarchy: courses recessed, the arch ring proud of
    // them, the string and the capping over the kerb proudest of all.
    const FACE = halfW + 0.8, COURSE = 0.3, RING = 0.78, BACK = 0.28, MOULD = 0.82, CORONA = 1.15;
    const FLOOR_Y = 6;
    const band = (pts, z0, z1, side) => LB.cap.add(profileGeo(pts, z1 - z0, spot(0, (side * (z0 + z1)) / 2), ang));

    // ── the flank ──
    // The kerb the flight carries its ornament on: one raking parapet a side,
    // from the soffit up past the deck, closing the stone at both flanks.
    for (const side of [-1, 1]) {
      LB.cap.add(profileGeo([...parapetTop(side), ...f.pts.slice(f.top.length)], 1.6,
        spot(0, side * halfW), ang));
    }

    // ── nosings ──
    // One over every riser, overhanging the step below it and chamfered under,
    // so the lip throws a line of shadow the length of the flight instead of
    // reading as another square edge.
    for (let k = from; k <= to; k++) {
      const e = -span + k * run;
      const hi = k > from ? stepTop(k - 1) : -1e9, lo = k < to ? stepTop(k) : -1e9;
      if (Math.abs(hi - lo) < 0.01) continue;
      // which way the lip hangs: out over the lower of the two steps it divides
      const d = hi > lo ? 1 : -1, h = Math.max(hi, lo);
      LB.step.add(profileGeo([
        [e, h], [e + d * 0.95, h], [e + d * 0.95, h - 0.5], [e + d * 0.3, h - 1.2], [e, h - 1.2],
      ], 2 * (halfW - 0.8), c, ang));
    }

    // ── the arch ring ──
    // Laid out from the springing rather than from the built ends, so the
    // middle bay falls on the crown and can be a keystone — and so a flight
    // sheared off in mid air (the Silence) keeps the coursing of the one that
    // is whole. Each voussoir is one piece right across the flight.
    const slope = (t) => {
      const h = 0.06, a = Math.max(-spring + 1e-4, t - h), b = Math.min(spring - 1e-4, t + h);
      return Math.max(-46, Math.min(46, (soffit(b) - soffit(a)) / (b - a)));
    };
    const normal = (t) => { const d = slope(t), L = Math.hypot(d, 1); return [-d / L, 1 / L]; };
    const ringTop = (t) => pitch(t) - 2.6;
    const t0R = Math.max(-spring, u0), t1R = Math.min(spring, u1);
    const BAYS = light ? 13 : 21;
    // The ring is laid in two thicknesses: a continuous course behind, and the
    // jointed voussoirs on top of it. Without the one behind, every joint is a
    // hole through to the flank — 0.4 wide and the best part of a unit deep,
    // and in this light that is a black slot. Backed, the joint has a lit
    // floor half a unit down and reads as a joint.
    {
      const low = [], high = [];
      for (let n = 0; n <= BAYS * 3; n++) {
        const t = t0R + ((t1R - t0R) * n) / (BAYS * 3), nn = normal(t);
        low.push([t - nn[0] * 0.25, soffit(t) - nn[1] * 0.25]);
        high.push([t, ringTop(t)]);
      }
      LB.cap.add(profileGeo([...high, ...low.reverse()], 2 * (FACE + BACK), c, ang));
    }
    for (let k = 0; k < BAYS; k++) {
      const a0 = -spring + (2 * spring * k) / BAYS, a1 = -spring + (2 * spring * (k + 1)) / BAYS;
      if (a1 <= t0R + 0.2 || a0 >= t1R - 0.2) continue;
      // The joint is a fixed width of ARC, not of span, or the bays close up
      // into one smooth curve again where the arch turns vertical.
      const jt = (t) => Math.min(0.3 / Math.hypot(1, slope(t)), (a1 - a0) * 0.3);
      const b0 = Math.max(t0R, a0 + jt(a0)), b1 = Math.min(t1R, a1 - jt(a1));
      if (b1 - b0 < 0.15) continue;
      const key = Math.abs((a0 + a1) / 2) < spring / BAYS;
      const low = [], high = [];
      for (let n = 0; n <= 4; n++) {
        const t = b0 + ((b1 - b0) * n) / 4, nn = normal(t);
        low.push([t - nn[0] * (key ? 0.9 : 0.55), soffit(t) - nn[1] * (key ? 0.9 : 0.55)]);
        // The keystone is longer than its neighbours at both ends and breaks
        // UP through the string course, which is the one stone in an arch that
        // is allowed to interrupt anything.
        high.push([t, key ? pitch(t) + 0.35 : ringTop(t)]);
      }
      const out = key ? RING + 0.5 : RING;
      LB.cap.add(profileGeo([...high, ...low.reverse()], 2 * (FACE + out), c, ang));
      // a boss on the keystone, one to a face: the same coin the arcade
      // overhead puts over every one of its own crowns
      if (key) {
        const y = (pitch(0) + soffit(0)) / 2 - 0.6;
        for (const side of [-1, 1]) {
          const q = spot((b0 + b1) / 2, side * (FACE + out));
          LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.15, 1.15, 0.5, 14).rotateX(Math.PI / 2), q, y, -ang * deg));
        }
      }
    }

    // ── the abutments ──
    if (!light) {
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
          const lo = end < 0 ? u0 : spring, hi = end < 0 ? -spring : u1;
          if (hi - lo < 3) continue;
          // the plinth: one course standing out further than any above it
          LB.cap.add(boxGeo(spot(lo, side * (FACE + BACK)), spot(hi, side * (FACE + BACK)), 2.2, BACK * 2, FLOOR_Y));
          // Courses of 1.6, not of 2.6: at the feet the abutment is barely
          // three units of stone between the floor and the string, and on a
          // coarser bed not one of them would fit.
          for (let row = 0; row < 8; row++) {
            const y0 = FLOOR_Y + 2.2 + row * 1.95, y1 = y0 + 1.6, step = 3.4;
            for (let m = -1; ; m++) {
              const ua = lo + (row % 2 ? step / 2 : 0) + m * step;
              if (ua >= hi) break;
              let a = Math.max(lo, ua), b = Math.min(hi, ua + step - 0.22);
              // The string rakes and the courses do not, so most stones in a
              // course run out under it partway along. Cut them back to where
              // they still have a course's worth of room, rather than dropping
              // whichever ones straddle the line — dropped, they left the foot
              // of the flight one blank face with a plinth under it; cut, each
              // course ends against the string the way cut stone does.
              while (a < b && ringTop(a) < y0 + 0.85) a += 0.3;
              while (b > a && ringTop(b) < y0 + 0.85) b -= 0.3;
              if (b - a < 1.1) continue;
              const cut = Math.min(y1, ringTop(a), ringTop(b));
              LB.cap.add(boxGeo(spot(a, side * (FACE + COURSE / 2)), spot(b, side * (FACE + COURSE / 2)), cut - y0, COURSE, y0));
            }
          }
        }
      }
    }

    // ── the springers ──
    // Where the arch comes down to the floor the ring simply dived into it,
    // and the coursed abutment beside it read as a different building. A
    // skewback block at each springing, standing out past everything around
    // it, is what the two are jointed by — and it says where the span begins,
    // which from the floor is the one thing about this stair worth knowing.
    for (const side of [-1, 1]) {
      for (const e of [-spring, spring]) {
        if (e < u0 + 1 || e > u1 - 1) continue;
        const d = e < 0 ? -3.2 : 3.2, top = ringTop(e) + 0.9;
        band([[e, top], [e + d, top], [e + d, FLOOR_Y], [e, FLOOR_Y]], FACE, FACE + RING + 0.22, side);
        band([[e - Math.sign(d) * 0.5, top + 1.1], [e + d * 1.16, top + 1.1],
          [e + d * 1.16, top], [e - Math.sign(d) * 0.5, top]], FACE, FACE + RING + 0.62, side);
      }
    }

    // ── the string course, and the coping over the parapet ──
    // The string is two members, not one: a plain band and a corona over it
    // that oversails it, so the moulding throws a shadow instead of being a
    // stripe. It runs just under the deck line, which is where a bridge's does
    // — it is the line that tells the eye where you would be walking.
    for (const side of [-1, 1]) {
      // The string runs straight through the crossing — it is below the deck,
      // on stone that is there whether or not the parapet over it is.
      band(bandPts(-2.45, -1.25), FACE, FACE + MOULD, side);
      band(bandPts(-1.25, -0.45), FACE, FACE + CORONA, side);
      // the coping, in as many pieces as the parapet under it has
      const g = gapOf(side);
      for (const [a, b] of g ? [[u0, Math.min(u1, g[0])], [Math.max(u0, g[1]), u1]] : [[u0, u1]]) {
        if (b - a > 2) band(bandPts(1.6, 2.45, a, b), halfW - 0.25, FACE + CORONA, side);
      }
      // a quoin closing the flank at each end it really ends at — and not at
      // one it was sheared off at, where the stone should look broken
      for (const [i, e] of [[0, u0], [1, u1]]) {
        if (!ends[i]) continue;
        const d = i ? -3.4 : 3.4;
        band([[e, deck(e) + 1.6], [e + d, deck(e + d) + 1.6], [e + d, FLOOR_Y], [e, FLOOR_Y]],
          FACE, FACE + CORONA, side);
      }
    }

    // ── the balustrade ──
    // The uprights plumb and the rail following the pitch line: that is what a
    // stair balustrade is, and what a rod on posts stepping with the treads is
    // not. Broken wherever `gap` says the other flight comes in.
    const railY = (u) => pitch(u) + 9;
    const copingTop = (u) => deck(u) + 2.45;
    const Z = FACE - 0.2;
    const newel = (u, side) => {
      const q = spot(u, side * Z), y = copingTop(u), r = -ang * deg;
      LB.cap.add(placed(new THREE.BoxGeometry(2.2, 0.9, 2.2), q, y + 0.45, r));
      LB.cap.add(placed(new THREE.BoxGeometry(1.75, 0.45, 1.75), q, y + 1.12, r));
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.72, 0.72, 0.42, 12), q, y + 1.56));
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.44, 0.58, 4.9, 12), q, y + 4.22));
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.78, 0.52, 0.7, 12), q, y + 7.02));
      LB.bronze.add(placed(new THREE.SphereGeometry(0.7, 14, 10), q, y + 7.85));
      LB.bronze.add(placed(new THREE.ConeGeometry(0.3, 0.85, 10), q, y + 8.7));
    };
    // The balustrade runs from springing to springing — over the WELL, and no
    // further. Past the springing the flight is a low ramp a few feet above a
    // stone floor, where a kerb is all it wants; and it is how a bridge reads
    // anyway, solid parapet on the approaches and balusters over the arch.
    //
    // It is also the only version of this the room has room for. Both feet of
    // both flights stand within a stride of the bookcases — there is no way
    // round the end of one — so a reader gets on and off over the parapet, and
    // a rail carried out to the feet is a rail they walk through. check:walls
    // measured the old thin one at 0.7 from the eye on the way out, and at 1.1
    // from it on the way in.
    const END = 5.5;
    const R0 = Math.max(u0 + END, -spring + 3), R1 = Math.min(u1 - END, spring - 3);
    for (const side of [-1, 1]) {
      const g = gapOf(side);
      for (const [ra, rb] of g ? [[R0, Math.min(R1, g[0])], [Math.max(R0, g[1]), R1]] : [[R0, R1]]) {
        if (rb - ra < 6) continue;
        // the pitch line kinks over the crown, so the rail is drawn in the
        // pieces it really has rather than one rod through the bend
        const knots = [ra, ...[-8, 8].filter((u) => u > ra + 0.5 && u < rb - 0.5), rb];
        for (let i = 1; i < knots.length; i++) {
          const a = spot(knots[i - 1], side * Z), b = spot(knots[i], side * Z);
          LB.bronze.add(rodGeo([a[0], railY(knots[i - 1]), a[1]], [b[0], railY(knots[i]), b[1]], 0.44));
        }
        newel(ra, side);
        newel(rb, side);
        // Two to a tread. One reads as a fence with its pickets missing; four
        // closes into a bronze band there is no seeing the room through.
        for (let u = ra + run / 2; u < rb - 1.2; u += run / 2) {
          const base = copingTop(u), h = railY(u) - 0.55 - base;
          if (h < 2) continue;
          const q = spot(u, side * Z);
          balusters.push({ p: [q[0], base, q[1]], s: [0.42, h / 6.2, 0.42] });
        }
      }
    }
  };

  // The stone of a gallery's walls: the ring between the room and the edge of
  // its cell, as the six trapezoids it really is — one to an edge, split where
  // a doorway opens — and not one slab with a room-shaped hole in it.
  //
  // A doorway cannot be a hole. A hole has to stop short of the outline it is
  // cut in, and what this one stopped short by — 0.05 of stone, half a
  // centimetre at a reader's scale — stood across every hallway, its full width
  // and its full height. That sliver is what the corridor visibly ended in, and
  // what the walk went through.
  //
  // `gaps(k)`: the doorways in edge k, as spans measured along the edge from
  // its middle. Where a span runs to the end of the edge the piece keeps the
  // cell's mitred corner; where a doorway cuts it, the piece ends square, and
  // that square end is the jamb of the doorway.
  const wallRing = (c, rIn, rOut, gaps) => {
    const pieces = [];
    for (let k = 0; k < 6; k++) {
      const n = dir(60 * k + 30), t = dir(60 * k + 120);
      const inner = (u) => add(add(c, n, (rIn * Math.sqrt(3)) / 2), t, u);
      const outer = (u) => add(add(c, n, (rOut * Math.sqrt(3)) / 2), t, u);
      const run = (a, b) => {
        if (b - a < 0.5) return;
        pieces.push([inner(a), inner(b),
          outer(b === rIn / 2 ? rOut / 2 : b), outer(a === -rIn / 2 ? -rOut / 2 : a)]);
      };
      let u = -rIn / 2;
      for (const [a, b] of gaps(k).sort((p, q) => p[0] - q[0])) { run(u, a); u = b; }
      run(u, rIn / 2);
    }
    return pieces;
  };

  const P = { project: true };
  const LB = {
    mass: new Batch(M.mass, P), cap: new Batch(M.cap, P), floor: new Batch(M.floor, { cast: false, ...P }),
    shelf: new Batch(M.shelf, P), shelfBack: new Batch(M.shelfBack, { cast: false, ...P }),
    bronze: new Batch(M.bronze), bronzeDim: new Batch(M.bronzeDim), inlay: new Batch(M.inlay, { cast: false }),
    liner: new Batch(M.liner, { cast: false }), stars: new Batch(M.stars, { cast: false, receive: false }),
    step: new Batch(M.step, P), robe: new Batch(M.robe), mirror: new Batch(M.mirror, { cast: false }), stone: new Batch(M.stone, P),
    frame: new Batch(M.frame), iron: new Batch(M.iron, { cast: false }), rail: new Batch(M.stone, P),
    shafts: new Batch(shaftMaterial, { cast: false, receive: false }),
    frieze: new Batch(M.frieze, P), plate: new Batch(M.plate), letters: new Batch(M.letters, { cast: false }), scallop: new Batch(M.scallop, { cast: false }),
    railGlow: new Batch(M.railGlow, { cast: false, receive: false }), floorBand: new Batch(M.floorBand, { cast: false, ...P }),
    bronzeWorn: new Batch(M.bronzeWorn), oak: new Batch(M.oak), shade: new Batch(M.shade, { cast: false }),
    shadeDead: new Batch(M.shadeDead), paper: new Batch(M.paper),
    shelfWorn: new Batch(M.shelfWorn, { cast: false }), dust: new Batch(M.dust, { cast: false }),
    contact: new Batch(M.contact, { cast: false, receive: false }), deadShards: new Batch(M.deadShards, { cast: false }),
    wornFloor: new Batch(M.wornFloor, { cast: false }), wornStep: new Batch(M.wornStep, { cast: false }),
    dustFan: new Batch(M.dustFan, { cast: false }), moonStone: new Batch(M.moonStone, P),
    carve: new Batch(M.carve), dressed: new Batch(M.dressed, P), marble: new Batch(M.marble),
  };
  const fallenLeaves = [], doorIvy = [], doorRubble = [], hangs = [];
  const posts = [], links = [], balusters = [];
  const books = [], lampCores = [], lampShells = [], globes = [], deadGlobes = [], rubble = [], dust = [];
  // Declared up here because the Library uses it too (the Echo's sconces), not
  // only the garden's lanterns.
  const glows = [];
  // Lights the pond may see that are not glows: a flame behind paper is drawn
  // as the paper (see the stone lanterns), but the water still wants a lamp.
  const waterLamps = [];
  // Old leather, not a paint chart (see textures.js): the gold on the spines is
  // what should catch the eye, not the bindings.
  const BOOKS = ['#4a3a2c', '#3e2f26', '#35382e', '#4f4130', '#383d40', '#4c392b', '#56372c', '#2f3830', '#3a3346', '#5e4b36', '#6b5a44', '#402a26', '#2e3a3c'];

  // ── The books on a wall ───────────────────────────────────────────────────
  // Shelved the way a library is, not the way a random number is: in RUNS — a
  // set of matching volumes, then something else — the big books low and the
  // small ones high, each run its own binding, height, tooling and depth. Drawn
  // book by book from one wide spread, every shelf in the Library came out the
  // same even noise of dark browns under the same gilt fleuron, and even noise
  // reads as wallpaper.
  //
  // Bindings by share of the runs. Still old leather and low in chroma (a
  // shelf of primaries measured as the thing that made a room read as a toy),
  // but not one family of brown: calf and tan, oxblood, bottle green, black,
  // vellum and faded cloth — the pale vellum is what lets the dark ones read
  // as dark. Colour in the Library lives on its objects, never in its light.
  const BINDINGS = [
    { share: 44, cols: ['#6f4c31', '#7d5738', '#5f422c', '#8a6341', '#523a28', '#76563a'] },
    { share: 15, cols: ['#5a2923', '#662e25', '#4f2420'] },
    { share: 12, cols: ['#2d3a2b', '#333d29', '#283426'], green: true },
    { share: 10, cols: ['#221d19', '#2a241f', '#1e1a17'] },
    { share: 8, cols: ['#8e8062', '#84775a', '#958868'], kind: 'vellum' },
    { share: 8, cols: ['#6f5f36', '#665243', '#61463f'], kind: 'cloth' },
  ];
  // Per room: the Silence is a room nobody reads in, and its bindings have gone
  // grey with it; the Door keeps green off its shelves, so that the only green
  // in the room is the moon's beyond the jamb.
  const tone = new THREE.Color();
  const toneHex = (hex, sat = 1, lum = 1) => {
    tone.set(hex);
    const hsl = tone.getHSL({});
    tone.setHSL(hsl.h, hsl.s * sat, Math.min(0.9, hsl.l * lum));
    return `#${tone.getHexString()}`;
  };
  const bindingsFor = (room) => BINDINGS
    .filter((b) => !(room === 4 && b.green))
    .map((b) => (room === 2
      ? { ...b, share: b.kind === 'vellum' ? 4 : b.share, cols: b.cols.map((h) => toneHex(h, 0.4, b.kind === 'vellum' ? 0.62 : 0.8)) }
      : b));
  // Folios low, octavos high: the heights and widths a run is drawn from, tier
  // by tier. The top shelf stops well short of the frieze board over it.
  const SIZES = [
    { h: [16.6, 19.4], w: [3.8, 6.0] },
    { h: [15.2, 18.4], w: [3.2, 5.2] },
    { h: [13.4, 16.6], w: [2.8, 4.5] },
    { h: [11.6, 14.6], w: [2.4, 3.9] },
    { h: [10.0, 13.0], w: [2.1, 3.5] },
  ];
  const kindCell = (kind, r) => { const [lo, hi] = SPINE_KINDS[kind]; return lo + Math.floor(r * (hi - lo)); };
  const LAID = 1000;   // aSpine for a book lying flat (see makeBookMaterial)
  const FRIEZE_Y = 111.5;
  // How much of the lamp-rails' wash each lit room has: none in the Silence,
  // "where the lamps grow faint".
  const GRAZE_BY_ROOM = { 0: 1, 1: 0.7, 2: 0, 4: 0.8 };
  // Numbered plates for the bays: a box whose every face shows cell `i`.
  const plateGeo = (i) => {
    const g = new THREE.BoxGeometry(3.4, 2.1, 0.3);
    const uv = g.attributes.uv;
    for (let v = 0; v < uv.count; v++) uv.setX(v, (i + uv.getX(v)) / PLATE_CELLS);
    return g;
  };
  // Borges numbers every hexagon and every wall of it, so the cornice carries
  // both: the hexagon's own number (from its place in the honeycomb, kept to
  // a numeral short enough to cut) and the wall's, I to VI round the room. A
  // doorway has no shelves and so no number; the gaps in the count are the
  // ways out.
  const NUMERALS = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  const roman = (n) => NUMERALS.reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
  const hexNumber = (i, j) => {
    let n = 100 + ((Math.imul(i + 37, 73856093) ^ Math.imul(j + 91, 19349663)) >>> 0) % 900;
    while (roman(n).length > 7) n++;
    return roman(n);
  };

  // A wall of shelves, tier above tier, from `from` to `to` (tier indexes).
  // `detail`: 0 for the far honeycomb, 1 near the walk (pilasters, the frieze
  // board, the ledge), 2 in the rooms themselves (flutes, dentils, numbered
  // plates, leather shelf-edges, the lamp-rail).
  const shelfWall = (a, b, inward, { from = 0, to = TIERS - 1, room, detail = 0, graze = 0, words = null } = {}) => {
    const len = dist(a, b);
    const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const s0 = 12, s1 = len - 12;
    const yBottom = TIER_BASE + from * TIER_H, yTop = TIER_BASE + (to + 1) * TIER_H;
    const face = -Math.atan2(t[1], t[0]), turn = face;
    const on = (u, z) => add(add(a, t, u), inward, z);
    LB.shelfBack.add(boxGeo(on(s0, 1.2), on(s1, 1.2), yTop - yBottom, 2, yBottom));
    // The world's random stream, drawn exactly as the old shelving drew it and
    // then thrown away. Everything built after the galleries — the garden above
    // all — is laid out off that stream, and shelving on it any other way would
    // have reshuffled the lot. The books themselves come from `br`, the wall's own.
    const ghost = [];
    for (let tier = from; tier <= to; tier++) {
      const y = TIER_BASE + tier * TIER_H;
      let u = s0;
      while (u < s1 - 2) {
        if (rnd() < 0.05) { u += rr(3, 9); continue; }
        if (rnd() < 0.045) {
          const w2 = rr(9, 15);
          for (let n = 0; n < 2 + Math.floor(rnd() * 3); n++) {
            const th = rr(1.5, 2.8);
            ghost.push([face + rr(-0.06, 0.06), w2 * rr(0.8, 1), th, rr(8, 10.5), pick(BOOKS), rr(0.75, 1.1)]);
          }
          u += w2 + rr(0.4, 1.6);
          continue;
        }
        const w = rr(2.3, 5.2), hh = rr(15.5, TIER_H - 2.2);
        ghost.push([y, rnd() < 0.05 ? rr(-0.3, 0.3) : 0, w, hh, rr(8, 11), pick(BOOKS), rr(0.75, 1.1)]);
        u += w + rr(0.15, 1);
      }
    }
    const br = makeRng((Math.round(a[0] * 131 + a[1] * 71 + b[0] * 37 + b[1] * 17) ^ (from * 7919)) | 0);
    // the Silence: nobody has taken a book down in a long time
    const dust = room === 2 ? 1 : 0;
    const within = ([lo, hi]) => lo + (hi - lo) * br();
    const bindings = bindingsFor(room);
    const shareSum = bindings.reduce((n, x) => n + x.share, 0);
    const pickBinding = () => { let r = br() * shareSum; for (const x of bindings) { r -= x.share; if (r <= 0) return x; } return bindings[0]; };
    const newRun = (tier) => {
      const B = pickBinding(), size = SIZES[tier], r = br();
      const kind = B.kind ?? (r < 0.25 ? 'rich' : r < 0.7 ? 'label' : 'plain');
      // the top shelf is nearest the lamps, and faded paler for it
      const top = tier === TIERS - 1;
      const d = 8 + br() * 2;
      const n = br() < 0.22 ? 1 : 2 + Math.floor(br() * br() * 8);
      return {
        n: kind === 'vellum' ? Math.min(n, 3) : n,
        color: toneHex(B.cols[Math.floor(br() * B.cols.length)], top ? 0.8 : 1, top ? 1.1 : 1),
        spine: kindCell(kind, br()),
        h: within(size.h), w: within(size.w) * (kind === 'vellum' ? 0.85 : 1),
        d, front: 9.4 + br() * 1.8, k: 0.86 + br() * 0.2,
      };
    };
    for (let tier = from; tier <= to; tier++) {
      const y = TIER_BASE + tier * TIER_H;
      LB.shelf.add(boxGeo(on(s0, 6), on(s1, 6), 2.4, 12, y - 2.4));
      let u = s0 + br() * 0.8, run = 0, R = null, lean = 0;
      while (u < s1 - 2) {
        if (run <= 0) {
          const x = br();
          // now and then a reader has taken one out, and its neighbour leans
          // into the gap it left
          if (x < 0.035 && u > s0 + 4) {
            // or a bronze bookend holds up what is left of the run
            if (br() < 0.4) {
              LB.bronzeDim.add(placed(new THREE.BoxGeometry(0.35, 6.4, 4.6), on(u + 0.2, 7.4), y + 3.2, turn));
              LB.bronzeDim.add(placed(new THREE.BoxGeometry(2.8, 0.25, 4.6), on(u + 1.5, 7.4), y + 0.13, turn));
              u += 0.6;
              lean = 0;
              continue;
            }
            const g = 2.4 + br() * 2.4; u += g; lean = g; continue;
          }
          // or a few are laid flat on the rest of the shelf
          if (x < 0.075) {
            const w2 = 9 + br() * 5;
            if (u + w2 > s1) break;
            const B = pickBinding();
            let lie = y;
            for (let n = 0, count = 2 + Math.floor(br() * 3); n < count; n++) {
              const th = 1.6 + br() * 1.1, wn = w2 * (0.84 + br() * 0.16), dn = 7.4 + br() * 2;
              if (lie + th > y + TIER_H - 3) break;
              const q = on(u + w2 / 2 + (br() - 0.5) * 0.8, 10.2 - dn / 2);
              books.push({
                p: [q[0], lie + th / 2, q[1]], rot: [0, face + (br() - 0.5) * 0.1, 0], s: [wn, th, dn],
                color: pickBinding().cols[0], k: 0.85 + br() * 0.2, spine: LAID + kindCell(B.kind === 'vellum' ? 'vellum' : 'label', br()), graze, dust,
              });
              lie += th;
            }
            u += w2 + 0.5 + br() * 1.2;
            lean = 0;
            continue;
          }
          R = newRun(tier);
          run = R.n;
        }
        const w = R.w * (1 + (br() - 0.5) * 0.06), hh = R.h * (1 + (br() - 0.5) * 0.025);
        if (u + w > s1) break;
        const inset = R.front - R.d / 2;
        const book = { color: R.color, k: R.k * (0.96 + br() * 0.08), spine: R.spine, graze, dust };
        if (lean) {
          // Pivoted on its foot at the edge of the gap and resting its head on
          // the book across it.
          const th = Math.min(0.36, Math.asin(Math.min(0.9, lean / hh)));
          const c2 = on(u + (w / 2) * Math.cos(th) - (hh / 2) * Math.sin(th), inset);
          books.push({ ...book, p: [c2[0], y + (w / 2) * Math.sin(th) + (hh / 2) * Math.cos(th), c2[1]], rot: [0, face, th], s: [w, hh, R.d] });
          u += w * Math.cos(th) + 0.3;
          lean = 0;
        } else {
          const p = on(u + w / 2, inset);
          books.push({ ...book, p: [p[0], y + hh / 2, p[1]], rot: [0, face, 0], s: [w, hh, R.d] });
          u += w + 0.12 + br() * 0.3;
        }
        run--;
      }
    }
    // The bays: uprights between them, and near the walk a pilaster on each —
    // a face board with a base and a capital, reeded in the rooms themselves —
    // so a wall of books is a piece of joinery and not a plane of spines.
    const bayEnds = [0, 1, 2, 3].map((i) => s0 + (i * (s1 - s0)) / 3);
    const capY = detail >= 1 ? FRIEZE_Y - 2.2 : yTop - 1.6;
    for (const u of bayEnds) {
      LB.shelf.add(placed(new THREE.BoxGeometry(2.6, yTop - yBottom, 12), on(u, 6), yBottom + (yTop - yBottom) / 2, turn));
      LB.shelf.add(placed(new THREE.BoxGeometry(4, 2.2, 13.4), on(u, 6.7), capY, turn));
      if (detail >= 1) {
        const lo = yBottom + (from === 0 ? 0 : 0.5), hi = capY - 1.1;
        LB.shelf.add(placed(new THREE.BoxGeometry(3.6, hi - lo, 0.7), on(u, 12.35), (lo + hi) / 2, turn));
        LB.shelf.add(placed(new THREE.BoxGeometry(4.4, 4.2, 1.3), on(u, 12.65), lo + 2.1, turn));
        LB.shelf.add(placed(new THREE.BoxGeometry(4.6, 1, 1.6), on(u, 12.8), capY - 0.6, turn));
        if (detail >= 2) {
          for (const dx of [-1.05, 0, 1.05]) {
            LB.shelf.add(placed(new THREE.BoxGeometry(0.42, hi - lo - 8, 0.34), on(u + dx, 12.87), (lo + 4.2 + hi - 3.8) / 2, turn));
          }
        }
      }
    }
    // A plinth on the floor — with a ledge at hand height to lay a book open on,
    // and a raised panel in each bay — and a stepped cornice along the top.
    LB.shelf.add(boxGeo(on(s0 - 1.5, 7), on(s1 + 1.5, 7), yBottom > 12 ? 2 : 4, 14, yBottom - (yBottom > 12 ? 2 : 4)));
    if (detail >= 1 && from === 0) {
      LB.shelf.add(boxGeo(on(s0 - 2, 7.7), on(s1 + 2, 7.7), 0.8, 15.4, yBottom - 0.8));
      if (detail >= 2) {
        for (let i = 0; i < 3; i++) LB.shelf.add(boxGeo(on(bayEnds[i] + 2.6, 14.15), on(bayEnds[i + 1] - 2.6, 14.15), 1.9, 0.3, 6.85));
      }
    }
    // The frieze: a board over the top shelf with a gilt key along it, a
    // numbered plate over the middle of each bay, dentils under the cornice.
    if (detail >= 1) {
      LB.frieze.add(boxGeo(on(s0 - 2, 12.6), on(s1 + 2, 12.6), yTop - FRIEZE_Y, 1.2, FRIEZE_Y));
      if (detail >= 2) {
        for (let i = 0; i < 3; i++) {
          LB.plate.add(placed(plateGeo(i), on((bayEnds[i] + bayEnds[i + 1]) / 2, 13.3), (FRIEZE_Y + yTop) / 2, turn));
        }
        for (let u = s0 - 1; u <= s1 + 1; u += 1.9) LB.shelf.add(placed(new THREE.BoxGeometry(0.9, 1.3, 0.8), on(u, 15.2), yTop + 0.75, turn));
      }
    }
    LB.shelf.add(boxGeo(on(s0 - 2, 7.4), on(s1 + 2, 7.4), 2, 14.8, yTop));
    LB.shelf.add(boxGeo(on(s0 - 3, 8.4), on(s1 + 3, 8.4), 2.4, 16.8, yTop + 2));
    // Over the dentils, in the face of the cornice, the wall's number in gilt
    // capitals: the first of `words` that goes at a readable size, centred on
    // the wall and read left to right from the room.
    if (detail >= 2 && words) {
      const track = 0.14, space = 0.5;
      const span = (s) => [...s].reduce((w, ch) => w + (ch === ' ' ? space : gilt.glyphs[ch].adv + track), -track);
      const fits = s1 - s0 - 6;
      const text = words.find((s) => span(s) * 1.1 <= fits) ?? words[words.length - 1];
      const cap = Math.min(1.5, fits / span(text));
      const right = [inward[1], -inward[0]], spin = Math.atan2(inward[0], inward[1]);
      const mid = on((s0 + s1) / 2, 16.85);
      let x = -span(text) / 2;
      for (const ch of text) {
        if (ch === ' ') { x += space; continue; }
        const G = gilt.glyphs[ch];
        const g = new THREE.PlaneGeometry(gilt.cellW * cap, gilt.cellH * cap);
        const uv = g.attributes.uv;
        for (let v = 0; v < uv.count; v++) uv.setXY(v, (G.col + uv.getX(v)) / gilt.cols, 1 - (G.row + 1 - uv.getY(v)) / gilt.rows);
        const p = add(mid, right, (x + G.adv / 2) * cap);
        LB.letters.add(g.rotateY(spin).translate(p[0], yTop + 3.2, p[1]));
        x += G.adv + track;
      }
    }
    if (detail >= 2) {
      // A leather dust-flap under the front of every shelf, bay by bay: a warm
      // scalloped line of shadow that reads from across the room.
      for (let tier = Math.max(1, from); tier <= to; tier++) {
        const y = TIER_BASE + tier * TIER_H - 2.4;
        for (let i = 0; i < 3; i++) {
          const ua = bayEnds[i] + 1.9, ub = bayEnds[i + 1] - 1.9, L = ub - ua;
          const g = new THREE.PlaneGeometry(L, 1.3);
          const uv = g.attributes.uv;
          for (let v = 0; v < uv.count; v++) uv.setX(v, (uv.getX(v) * L) / 2.4);
          g.rotateY(Math.atan2(inward[0], inward[1]));
          const q = on((ua + ub) / 2, 12.08);
          LB.scallop.add(g.translate(q[0], y - 0.65, q[1]));
        }
      }
      for (let tier = Math.max(1, from); tier <= to; tier++) {
        const y = TIER_BASE + tier * TIER_H;
        for (let i = 0; i < 3; i++) {
          const ua = bayEnds[i], ub = bayEnds[i + 1], L = ub - ua;
          if (dust) {
            // dust lying along the front of the shelf, in front of the books
            LB.dust.add(boxGeo(on(ua + 1.4, 11.55), on(ub - 1.4, 11.55), 0.06, 0.8, y));
          } else {
            // the front edge rubbed paler at the middle of the bay, where
            // books have gone in and out
            LB.shelfWorn.add(boxGeo(on(ua + L * 0.18, 11.8), on(ub - L * 0.18, 11.8), 0.3, 0.52, y - 0.3));
          }
        }
      }
      // where the case stands on the floor, a soft dark line
      if (from === 0) {
        const g = new THREE.PlaneGeometry(s1 - s0 + 5, 3.6);
        const uv = g.attributes.uv;
        g.setAttribute('uv1', new THREE.BufferAttribute(Float32Array.from({ length: uv.count * 2 }, (_, i) => (i % 2 ? 1 - uv.array[i] : uv.array[i])), 2));
        g.rotateX(-Math.PI / 2).rotateY(face);
        const q = on((s0 + s1) / 2, 15.8);
        LB.contact.add(g.translate(q[0], 6.14, q[1]));
      }
      // The lamp-rail: a bronze rod under the frieze on little arms, a line of
      // light along its underside washing down the top shelves (the wash is
      // in the books' own shader — see makeBookMaterial).
      if (graze > 0) {
        const r0 = on(s0, 14.4), r1 = on(s1, 14.4);
        LB.bronze.add(rodGeo([r0[0], FRIEZE_Y - 0.9, r0[1]], [r1[0], FRIEZE_Y - 0.9, r1[1]], 0.34));
        LB.railGlow.add(boxGeo(on(s0 + 0.5, 14.4), on(s1 - 0.5, 14.4), 0.22, 0.4, FRIEZE_Y - 1.5));
        for (const u of bayEnds.slice(0, 3).map((e, i) => (e + bayEnds[i + 1]) / 2)) {
          LB.bronze.add(placed(new THREE.BoxGeometry(0.4, 0.4, 1.6), on(u, 13.6), FRIEZE_Y - 0.9, turn));
        }
      }
    }
    // a brass rail for a ladder, along the full walls
    if (from === 0) {
      const ry = TIER_BASE + 2 * TIER_H + 7;
      const r0 = add(add(a, t, s0), inward, 14), r1 = add(add(a, t, s1), inward, 14);
      LB.bronze.add(rodGeo([r0[0], ry, r0[1]], [r1[0], ry, r1[1]], 0.45));
      for (const u of [s0 + 2, (s0 + s1) / 2, s1 - 2]) {
        const q = add(add(a, t, u), inward, 13);
        LB.bronze.add(placed(new THREE.BoxGeometry(0.8, 0.8, 3), q, ry, turn));
      }
    }
  };

  // ── Furniture ─────────────────────────────────────────────────────────────
  // What gives a person's scale back to a room whose every wall is eleven
  // metres of books: a gallery overhead that you are not on, a ladder left
  // where the last reader stood it, and one corner somebody was reading in.
  // Most of what filled a frame stood three to twelve metres up; these are
  // at the height the eye actually lives at. None of it draws on the world's
  // random stream (placing a chair must not move the garden).
  const alongWall = (c, k) => {
    const e = edgeFrame(c, k), inward = [-e.n[0], -e.n[1]];
    const on = (u, z) => add(add(e.mi, e.t, u), inward, z);
    return { e, inward, on, at3: (u, z, y) => { const q = on(u, z); return [q[0], y, q[1]]; }, turn: -Math.atan2(e.t[1], e.t[0]) };
  };
  // An iron walk along the tier-3 shelf: a deck on brackets, a bronze fascia,
  // bars and a handrail. The room reads as tall because it has a floor in it
  // that nobody is standing on.
  const GALLERY_Y = TIER_BASE + 3 * TIER_H;
  const gallery = (c, k) => {
    const { on, at3, turn } = alongWall(c, k);
    const u0 = -R / 2 + 11, u1 = R / 2 - 11, Y = GALLERY_Y;
    LB.iron.add(boxGeo(on(u0, 15.4), on(u1, 15.4), 1.1, 6.8, Y - 1.1));
    LB.bronzeDim.add(boxGeo(on(u0, 18.95), on(u1, 18.95), 1.5, 0.35, Y - 1.35));
    for (let i = 0; i <= 3; i++) {
      const u = -R / 2 + 12 + (i * (R - 24)) / 3;
      LB.iron.add(rodGeo(at3(u, 12.9, Y - 10), at3(u, 18.4, Y - 1.2), 0.42));
      LB.iron.add(boxGeo(on(u - 0.3, 15.6), on(u + 0.3, 15.6), 1.2, 6.2, Y - 2.3));
    }
    LB.bronze.add(rodGeo(at3(u0, 18.5, Y + 9.6), at3(u1, 18.5, Y + 9.6), 0.42));
    LB.iron.add(rodGeo(at3(u0, 18.5, Y + 1.1), at3(u1, 18.5, Y + 1.1), 0.3));
    for (let u = u0 + 1.2; u < u1 - 0.6; u += 2.3) LB.iron.add(placed(new THREE.BoxGeometry(0.26, 8.5, 0.26), on(u, 18.5), Y + 5.35, turn));
    for (const u of [u0, u1]) LB.iron.add(placed(new THREE.BoxGeometry(1, 10.4, 1), on(u, 18.5), Y + 5.2, turn));
  };
  // A library ladder hooked over the brass rail every full wall carries.
  const ladder = (c, k, u) => {
    const { e, inward, on, turn } = alongWall(c, k);
    const ry = TIER_BASE + 2 * TIER_H + 7;
    const top = 14.7, foot = 26.5, rise = ry + 0.4 - 6, run = foot - top;
    const L = Math.hypot(rise, run), tilt = Math.atan2(run, rise);
    const parts = [];
    for (const sx of [-3.1, 3.1]) parts.push(new THREE.BoxGeometry(0.8, L, 0.55).translate(sx, L / 2, 0));
    for (let y = 3.6; y < L - 1.5; y += 4.3) parts.push(new THREE.CylinderGeometry(0.28, 0.28, 6.2, 8).rotateZ(Math.PI / 2).translate(0, y, 0));
    const g = mergeGeometries(parts);
    parts.forEach((x) => x.dispose());
    g.rotateX(-tilt);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(e.t[0], 0, e.t[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(inward[0], 0, inward[1])));
    const f = on(u, foot);
    LB.oak.add(g.translate(f[0], 6, f[1]));
    for (const sx of [-3.1, 3.1]) LB.bronze.add(placed(new THREE.BoxGeometry(1, 1.3, 1.8), on(u + sx, top), ry + 0.3, turn));
  };
  // A table against the cases with its lamp, an open book, a closed one, a
  // stack on the floor by the leg and the chair pushed back from it. `lit`:
  // in the Silence the lamp is out and the chair was left turned away.
  const readingCorner = (c, k, u0, { lit = true } = {}) => {
    const { on, turn } = alongWall(c, k);
    const TOP = 6 + 7.6, Z = 22;
    LB.shelf.add(placed(new THREE.BoxGeometry(15, 0.7, 7.2), on(u0, Z), TOP - 0.35, turn));
    LB.shelf.add(placed(new THREE.BoxGeometry(13.6, 1.3, 6), on(u0, Z), TOP - 1.35, turn));
    for (const [du, dz] of [[-6.4, -2.6], [6.4, -2.6], [-6.4, 2.6], [6.4, 2.6]]) {
      LB.shelf.add(placed(new THREE.CylinderGeometry(0.42, 0.3, TOP - 6.7, 10), on(u0 + du, Z + dz), 6 + (TOP - 6.7) / 2, turn));
    }
    // the lamp: a brass foot and stem, and an amber shade with the bulb
    // glowing through it — light at the height of a reader's hands, which
    // nothing else in the Library gave
    const lp = on(u0 + 4.6, Z - 1.4);
    LB.bronze.add(placed(new THREE.CylinderGeometry(1.2, 1.4, 0.35, 18), lp, TOP + 0.17));
    LB.bronze.add(placed(new THREE.CylinderGeometry(0.16, 0.16, 5, 8), lp, TOP + 2.8));
    (lit ? LB.shade : LB.shadeDead).add(placed(new THREE.CylinderGeometry(0.95, 2.2, 2.1, 22, 1, true), lp, TOP + 5.6));
    if (lit) {
      glows.push({ p: [lp[0], TOP + 5.1, lp[1]], s: [0.6, 0.6, 0.6], color: '#ffd9a0', k: 1.25 });
      decal(lp, 8, 8, '#ffb060', 0.35, TOP + 0.04);
      decal(on(u0, Z + 5), 46, 46, '#ffb060', 0.1);
    }
    // the open book: its boards, and the two halves of the text block lifting
    // toward the spine
    const bp = on(u0 - 2.4, Z + 0.6), bt = turn + 0.14;
    LB.shelf.add(placed(new THREE.BoxGeometry(9.4, 0.22, 6.4), bp, TOP + 0.11, bt));
    for (const side of [-1, 1]) {
      LB.paper.add(placed(new THREE.BoxGeometry(4.4, 0.55, 5.9).translate(side * 2.3, 0.28, 0).rotateZ(-side * 0.07), bp, TOP + 0.22, bt));
    }
    const shut = on(u0 + 0.6, Z - 1.9);
    books.push({ p: [shut[0], TOP + 0.9, shut[1]], rot: [0, turn + 0.4, 0], s: [8.6, 1.8, 6.2], color: '#5a2923', k: 1, spine: LAID + SPINE_KINDS.label[0] + 3 });
    let lie = 6;
    [[11, 2.4, '#6f4c31'], [9.8, 2, '#2d3a2b'], [10.4, 2.6, '#221d19'], [8.8, 1.8, '#a89a7b']].forEach(([w, th, color], i) => {
      const q = on(u0 + 10.8, Z - 1.2);
      books.push({ p: [q[0], lie + th / 2, q[1]], rot: [0, turn + [0.05, -0.12, 0.2, -0.04][i], 0], s: [w, th, 7.6], color, k: 1, spine: LAID + SPINE_KINDS.label[0] + i * 3 });
      lie += th;
    });
    // the chair
    const cp = on(u0 - 3.5, Z + 8), ct = turn + (lit ? 0.35 : 1.1);
    const chair = [];
    chair.push(new THREE.BoxGeometry(5.2, 0.6, 5).translate(0, 4.6, 0));
    for (const [x, z] of [[-2.2, -2.1], [2.2, -2.1], [-2.2, 2.1], [2.2, 2.1]]) chair.push(new THREE.CylinderGeometry(0.28, 0.24, 4.3, 8).translate(x, 2.15, z));
    for (const x of [-2.2, 2.2]) chair.push(new THREE.BoxGeometry(0.5, 7, 0.5).translate(x, 8.3, 2.2));
    chair.push(new THREE.BoxGeometry(5, 1.1, 0.45).translate(0, 11.3, 2.2));
    chair.push(new THREE.BoxGeometry(4.4, 0.4, 0.35).translate(0, 8.4, 2.2));
    const cg = mergeGeometries(chair);
    chair.forEach((x) => x.dispose());
    LB.shelf.add(placed(cg, cp, 6, ct));
  };
  // A reader in a hooded robe, turned on a lathe: wide at the hem, narrow at
  // the waist, the shoulders, the hood drawn forward.
  // Tall and narrow, the shoulders sloping into a hood that ends in a point:
  // a round head on a round body is a chess pawn.
  const robeGeo = keep(new THREE.LatheGeometry([
    [0, 0], [3.5, 0], [3.4, 1], [2.9, 5], [2.4, 9.5], [2.3, 11.5], [2.7, 13.2], [2.3, 14.6], [1.5, 15.3],
    [1.8, 16.2], [1.9, 17.2], [1.5, 18.3], [0.8, 19.2], [0, 19.9],
  ].map(([x, yy]) => new THREE.Vector2(x, yy)), 14));
  const figure = (p, y) => {
    const g = robeGeo.clone();
    g.rotateX(0.13);
    g.rotateY(rr(0, Math.PI * 2));
    g.translate(p[0], y, p[1]);
    LB.robe.add(g);
  };
  // A glass sphere lamp hung on a chain from above the walls: a hot core, a
  // glass shell, a halo, and — for the lamps that matter — a real light.
  const LAMP_Y = 66;
  // `beam`: the cone of lit air to the floor under it (not for a lamp hung in the Vertigo's well).
  // `out`: a lamp that has gone out — the fitting, the chain and the cold glass,
  // and nothing else. "Where the lamps grow faint" needs lamps that ARE faint,
  // not one lamp turned down.
  // `haze`: how much halo it is allowed. A lamp's halo is a sprite drawn with
  // depthTest OFF so it can lie over the stone it lights; within about sixty
  // units of where a reader stands that becomes a hundred-unit disc of light in
  // FRONT of the room, and the gallery goes milky. Lamps near a stand turn it down.
  const lamp = (p, { y = LAMP_Y, light: power = 0, priority = 0, color = '#ffb466', strength = 1, pool = 0.3, poolSize = 200, poolY = 6.6, r = 9, beam = true, out = false, haze = 1, chain = Infinity } = {}) => {
    // One opal globe, the size the bright core used to be. There is no clear
    // shell round it any more: a lit globe is the light (makeLampGlobeMaterial),
    // a dead one is the same globe in cold, dull glass.
    const G = r * 0.55;
    (out ? deadGlobes : globes).push({ p: [p[0], y, p[1]], s: [G, G, G], ...(out ? {} : { color: '#fff3e2', k: 0.45 + strength * 0.5 }) });
    // The fitting sits ON the globe, outside it: a collar gripping its neck, a
    // bead of rim where the glass goes in, a cap, and a loop for the chain; a
    // small drop finishes the bottom of the glass.
    LB.bronze.add(placed(new THREE.CylinderGeometry(G * 0.34, G * 0.46, G * 0.26, 24), p, y + G * 0.99));
    LB.bronze.add(placed(new THREE.TorusGeometry(G * 0.47, G * 0.045, 8, 32).rotateX(Math.PI / 2), p, y + G * 0.87));
    LB.bronze.add(placed(new THREE.CylinderGeometry(G * 0.1, G * 0.34, G * 0.2, 20), p, y + G * 1.22));
    LB.bronze.add(placed(new THREE.TorusGeometry(G * 0.13, G * 0.035, 6, 16), p, y + G * 1.45));
    LB.bronze.add(placed(new THREE.ConeGeometry(G * 0.09, G * 0.3, 12).rotateX(Math.PI), p, y - G * 1.1));
    // `chain`: how far up the links are drawn before the dark is left to say
    // the rest. A lamp in a gallery hangs from the top of the wall and its
    // whole chain is part of the room. A lamp hung in the Vertigo's well hangs
    // four hundred units down, and drawing every link of that put a black cable
    // from the top of the frame to the bottom across the one thing the room is
    // for — the look down the funnel. The chain still rises out of the light;
    // it just stops being drawn once there is nothing left to light it.
    const chainTop = Math.min(MASS_H + 40, y + G * 1.58 + chain);
    for (let cy = y + G * 1.58, k = 0; cy < chainTop; cy += 1.55, k++) {
      links.push({ p: [p[0], cy, p[1]], rot: [0, k % 2 ? Math.PI / 2 : 0, 0], s: [1, 1, 1] });
    }
    if (out) return;
    // the cone of lit air beneath it
    if (beam && (power || strength >= 1)) {
      const h = y - r - 6, foot = Math.min(poolSize * 0.3, 62);
      LB.shafts.add(shaftVolume(
        new THREE.CylinderGeometry(r * 0.7, foot, h, 28, 1, true).translate(p[0], 6 + h / 2, p[1]),
        [p[0], 6, p[1]], foot, [p[0], 6 + h, p[1]], r * 0.7,
      ));
    }
    halo(p, y, r * 11 * (0.6 + strength * 0.4) * Math.sqrt(haze), '#ffc27a', (0.08 + strength * 0.52) * haze, lampHaloTex);
    // Every lamp may light its room; which ones do, at a given moment, is the
    // light pool's business (see updateLights).
    point(p, y - 4, color, power || 2400 * strength, power ? priority : -1);
    if (pool) decal(p, poolSize, poolSize, '#ffb060', pool, poolY, 0.1);
  };

  const mounts = [];
  const hangPainting = (index, [x, z], y, normal, width) => {
    if (!paintings) return;
    const height = width / (3376 / 1440);
    const angle = Math.atan2(normal[0], normal[1]);
    const frameGeo = new THREE.BoxGeometry(width + 5, height + 5, 2.2);
    frameGeo.rotateY(angle);
    frameGeo.translate(x, y, z);
    LB.frame.add(frameGeo);
    const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
    const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
    plane.position.set(x + normal[0] * 1.25, y, z + normal[1] * 1.25);
    plane.rotation.y = angle;
    root.add(plane);
    mounts[index] = { center: [x + normal[0] * 1.25, y, z + normal[1] * 1.25], normal, width, height, material: mat };
  };

  // An arch over a hallway: fills the opening above the arch through the
  // thickness of the stone, with a cap on top.
  const archGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(-HALL / 2, MASS_H);
    s.lineTo(HALL / 2, MASS_H);
    s.lineTo(HALL / 2, ARCH_SPRING);
    s.absarc(0, ARCH_SPRING, ARCH_R, 0, Math.PI, false);
    s.lineTo(-HALL / 2, MASS_H);
    const g = new THREE.ExtrudeGeometry(s, { depth: GAP + 0.2, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -(GAP + 0.2) / 2);
    return g;
  })();
  // Dressed stone on each face of the opening: an archivolt, a keystone, and a
  // pilaster up each jamb — a hole cut in a wall reads as a hole.
  const archivoltGeo = keep(new THREE.TorusGeometry(ARCH_R + 1.6, 1.6, 8, 28, Math.PI));
  const arch = (mid, n) => {
    const turn = Math.atan2(n[0], n[1]);
    const g = archGeo.clone();
    g.rotateY(turn);
    g.translate(mid[0], 0, mid[1]);
    LB.mass.add(g);
    LB.cap.add(boxGeo(add(mid, n, -GAP / 2), add(mid, n, GAP / 2), CAP, HALL, MASS_H));
    const across = [n[1], -n[0]];
    for (const side of [-1, 1]) {
      const face = add(mid, n, side * (GAP / 2 + 0.7));
      LB.cap.add(archivoltGeo.clone().rotateY(turn).translate(face[0], ARCH_SPRING, face[1]));
      LB.cap.add(new THREE.BoxGeometry(4.2, 6, 3.4).rotateY(turn).translate(face[0], ARCH_SPRING + ARCH_R + 2.4, face[1]));
      for (const s of [-1, 1]) {
        const j = add(face, across, s * (HALL / 2 + 1.6));
        LB.cap.add(new THREE.BoxGeometry(3.2, ARCH_SPRING - 6, 1.8).rotateY(turn).translate(j[0], 6 + (ARCH_SPRING - 6) / 2, j[1]));
        LB.cap.add(new THREE.BoxGeometry(4.4, 2, 2.6).rotateY(turn).translate(j[0], ARCH_SPRING - 1, j[1]));
      }
    }
  };

  // A stone balustrade along the rim of a gallery, on top of its walls: posts
  // and a rail, broken where a hallway or a fallen wall opens.
  const RAIL_H = 10;
  const railRun = (a, b) => {
    const len = dist(a, b);
    if (len < 6) return;
    const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    for (let u = 3; u <= len - 3; u += 8) {
      const p = add(a, t, u);
      posts.push({ p: [p[0], MASS_H + CAP + RAIL_H / 2, p[1]], s: [2, RAIL_H, 2] });
    }
    LB.rail.add(boxGeo(a, b, 2, 3.4, MASS_H + CAP + RAIL_H));
  };
  const balustrade = (cell, halls) => {
    for (let k = 0; k < 6; k++) {
      const e = edgeFrame(cell.c, k);
      const a = add(e.i0, e.n, 3.5), b = add(e.i1, e.n, 3.5);
      const opening = halls.includes(k)
        ? [0.5 - (HALL + 8) / (2 * R), 0.5 + (HALL + 8) / (2 * R)]
        : null;
      if (opening) {
        railRun(a, lerp2(a, b, opening[0]));
        railRun(lerp2(a, b, opening[1]), b);
      } else {
        railRun(a, b);
      }
    }
  };

  for (const cell of cells) {
    if (cell.garden || cell.k === '3,-3') continue;
    const { c } = cell;
    const room = cell.room;
    const lit = room !== undefined;
    const framed = inFrame(c);
    const near = Math.exp(-((routeDist(c) / 430) ** 2));
    const shaft = room === 0 ? 48 : room === 4 ? 0 : room === 2 ? 40 : room === 1 ? 38 : 36;
    const halls = [0, 1, 2, 3, 4, 5].filter((k) => hallway(cell, k));
    // The hallways, and the wall the Door has lost into the garden.
    const gaps = (k) => [
      ...(halls.includes(k) ? [[-HALL / 2, HALL / 2]] : []),
      ...(cell.k === '4,-4' && k === 5 ? [[(0.27 - 0.5) * R, (0.76 - 0.5) * R]] : []),
    ];
    LB.floor.add(slabGeo(hexPts(c, RC), shaft ? [hexPts(c, shaft)] : [], 6, 0));
    // A floor with a plan to it: a band of darker stone along the foot of the
    // cases with a brass fillet on its inner edge, and a ring of the pale stone
    // round the lip of the well. One grid from wall to well said nothing about
    // where the room's edge was, or its middle.
    if (lit) {
      LB.floorBand.add(slabGeo(hexPts(c, 83.8), [hexPts(c, 72.4)], 0.1, 6));
      LB.inlay.add(slabGeo(hexPts(c, 72.9), [hexPts(c, 72.1)], 0.16, 6));
      if (shaft) LB.cap.add(slabGeo(hexPts(c, shaft + 13), [hexPts(c, shaft + 2.6)], 0.08, 6));
    }
    for (const piece of wallRing(c, R, RC, gaps)) {
      LB.mass.add(slabGeo(piece, [], MASS_H, 0));
      LB.cap.add(slabGeo(piece, [], CAP, MASS_H));
    }
    if (hallway(cell, 5)) arch(hallMid(cell.i, cell.j, 5), dir(330));
    if (framed) balustrade(cell, halls);

    // Shelves: every tier in the lit galleries, fewer as the Library recedes.
    const topTier = lit ? TIERS - 1 : framed ? (light ? 1 : (near > 0.3 ? 4 : 2)) : 0;
    const fromTier = lit ? 0 : TIERS - 1 - topTier;
    const dress = { room, detail: lit ? 2 : near > 0.5 ? 1 : 0, graze: GRAZE_BY_ROOM[room] ?? 0 };
    const hexNo = lit ? hexNumber(cell.i, cell.j) : null;
    const wallWords = (k) => hexNo && [`HEXAGON ${hexNo} · WALL ${roman(k + 1)}`, `HEXAGON ${hexNo}`];
    for (let k = 0; k < 6; k++) {
      // "Between two shelves the stone gives way" — so the Door's broken wall
      // keeps its shelving either side of the breach, right up to the jamb.
      // It had none at all, which left the way out a bare slot in masonry.
      if (cell.k === '4,-4' && k === 5) {
        const e5 = edgeFrame(c, 5);
        const inward5 = [-e5.n[0], -e5.n[1]];
        const at5 = (t) => add(e5.mi, e5.t, t);
        // No number on this wall: between the corners and the portal's gable
        // block only a hand's breadth of either cornice shows. The wall that
        // gave way is the one missing from the count.
        shelfWall(at5(-62), at5(-11), inward5, { from: 0, to: TIERS - 1, ...dress });
        shelfWall(at5(14), at5(62), inward5, { from: 0, to: TIERS - 1, ...dress });
        continue;
      }
      const e = edgeFrame(c, k);
      const inward = [-e.n[0], -e.n[1]];
      if (halls.includes(k)) {
        // "In the hallway there is a mirror, which faithfully duplicates all
        // appearances." It was a slab: 44 tall, the whole length of the
        // passage, standing out from the wall and running through the jambs of
        // both doorways — from either room the way through looked half walled
        // up by something black. Now it is a glass hung ON the wall, in a
        // frame, stopping short of both openings so each doorway keeps its
        // jambs and reads as a door.
        if (k === 5 && (lit || (framed && rnd() < 0.4))) {
          const on = (along, z) => add(add(e.mi, e.n, along), e.t, z);
          const a0 = 8, a1 = GAP - 8, z = HALL / 2 - 0.3, y0 = 12, y1 = 44;
          LB.mirror.add(boxGeo(on(a0, z), on(a1, z), y1 - y0, 0.5, y0));
          const fz = HALL / 2 - 0.55, bar = 1.3;
          LB.frame.add(boxGeo(on(a0 - bar, fz), on(a1 + bar, fz), bar, 1, y0 - bar));
          LB.frame.add(boxGeo(on(a0 - bar, fz), on(a1 + bar, fz), bar, 1, y1));
          for (const a of [a0 - bar / 2, a1 + bar / 2]) {
            LB.frame.add(boxGeo(on(a - bar / 2, fz), on(a + bar / 2, fz), y1 - y0, 1, y0));
          }
        }
        continue;
      }
      if (lit && k === 4 && paintings) shelfWall(e.i0, e.i1, inward, { from: 3, to: TIERS - 1, ...dress, words: wallWords(k) });
      else shelfWall(e.i0, e.i1, inward, { from: fromTier, to: TIERS - 1, ...dress, words: wallWords(k) });
    }
    if (lit) hangPainting(room, [c[0], c[1] - A + 2.5], 38, [0, 1], 80);

    if (shaft) {
      LB.liner.add(slabGeo(hexPts(c, shaft + 3), [hexPts(c, shaft)], 236, -230));
      LB.stars.add(slabGeo(hexPts(c, shaft + 2), [], 1, -232));
      if (lit) {
        // a turned bronze balustrade round the well: base, balusters, rail
        LB.bronze.add(slabGeo(hexPts(c, shaft + 2.8), [hexPts(c, shaft)], 1.4, 6));
        LB.bronze.add(slabGeo(hexPts(c, shaft + 2.4), [hexPts(c, shaft + 0.4)], 0.7, 7.4));
        // The rail was three flat rings stacked into a plank, the nearest and
        // largest thing in most frames and the least interesting. Now a bead,
        // a neck, and a rounded handrail on them, rubbed bright on top where
        // hands have gone round it — six straight lengths, their joints closed
        // by a knuckle of the same section, and in the Vestibule (the one well
        // no stair crosses at a corner) a newel standing on each corner.
        //
        // And LOW. "The ventilation shafts are surrounded by very low railings",
        // Borges says, and at a man's hip the rail stood across the lower third
        // of every stand's view, two paces away and the largest thing in it.
        // At a reader's knee (the handrail tops at 12.5, 60 cm up) it lies along
        // the bottom edge of the frame and the room has its floor again.
        LB.bronzeDim.add(slabGeo(hexPts(c, shaft + 2.9), [hexPts(c, shaft - 0.1)], 0.6, 10.5));
        {
          const corners = hexPts(c, shaft + 1.4);
          corners.forEach((q, k) => {
            LB.bronzeWorn.add(barGeo(q, corners[(k + 1) % 6], 11.8, 1.3, 0.6));
            LB.bronzeWorn.add(placed(new THREE.SphereGeometry(1.3, 18, 12).scale(1, 0.6, 1), q, 11.8));
            if (room === 0) {
              LB.bronzeDim.add(placed(new THREE.CylinderGeometry(0.95, 1.25, 5.4, 14), q, 6 + 2.7));
              LB.bronzeWorn.add(placed(new THREE.SphereGeometry(1, 16, 12), q, 13.4));
            }
          });
        }
        const ringPts = hexPts(c, shaft + 1.4);
        ringPts.forEach((q, k) => {
          // One baluster every 6.4 rather than every 4.2. At the tighter
          // spacing the rail round the well was a picket fence: from a
          // reader's eye the turned shafts closed up into a solid bronze band
          // across the bottom of the frame, and the floor and the well behind
          // it were both lost. Spaced out you see between them, and the room
          // keeps its floor.
          const next = ringPts[(k + 1) % 6], n = Math.floor(dist(q, next) / 6.4);
          for (let s = 0; s < n; s++) {
            const b = lerp2(q, next, (s + 0.5) / n);
            balusters.push({ p: [b[0], 7.4, b[1]], s: [0.85, 0.5, 0.85] });
          }
        });
      } else {
        LB.bronzeDim.add(slabGeo(hexPts(c, shaft + 2.6), [hexPts(c, shaft)], 9, 6));
      }
      if (lit || near > 0.4) decal(c, shaft * 2.6, shaft * 2.6, '#79a8bd', lit ? 0.07 : 0.035, 6.8);
      if (lit && room !== 4) LB.inlay.add(slabGeo(hexPts(c, shaft + 18), [hexPts(c, shaft + 16.6)], 0.6, 6));
    }
    if (!lit && framed && rnd() < 0.14 + 0.5 * near) {
      const strength = 0.15 + 0.6 * near;
      lamp(add(c, dir(rr(0, 360)), shaft + 26), { strength, pool: near > 0.2 ? 0.05 + 0.16 * near : 0, poolSize: 180 });
      if (rnd() < 0.3) figure(add(c, dir(rr(0, 360)), shaft + 12), 6);
    }
    if (lit) {
      // Dust, not a snowstorm. At 26 a gallery of it read as sparkle rather than
      // air — and the eye goes to whatever moves, which was the wrong thing.
      for (let s = 0; s < (light ? 6 : 14); s++) {
        const p = add(c, dir(rr(0, 360)), rr(0, R * 0.8));
        dust.push({ p: [p[0], rr(12, MASS_H - 10), p[1]], s: Array(3).fill(rr(0.4, 0.9)), color: '#ffdca8', k: rr(0.16, 0.4), phase: rr(0, 100) });
      }
    }
  }

  // The rooms' furniture: a gallery on each of the two walls at the sides of a
  // stand's view, a ladder on another, and a reading corner on a wall the walk
  // does not pass (check:walls holds all of it off the legs).
  if (!paintings) {
    const V = cellC(0, 0), S = cellC(2, -2), Dr = cellC(4, -4);
    gallery(V, 1); gallery(V, 4); ladder(V, 3, 20); readingCorner(V, 4, -16);
    gallery(S, 0); gallery(S, 3); ladder(S, 4, -20); readingCorner(S, 3, 12, { lit: false });
    gallery(Dr, 1); gallery(Dr, 4); ladder(Dr, 0, 16); readingCorner(Dr, 3, -10);
  }

  let vault = null;   // the library over the Vestibule, raised by the reader's gaze in tick
  // I — the Vestibule: a bridge over a wide shaft, a file of readers on it.
  {
    const c = cellC(0, 0), ax = dir(30), px = dir(120);
    const a = add(c, ax, -55), b = add(c, ax, 55);
    // "A bridge of stone carries a file of readers across the dark on its own
    // arch" — so it has one. A segmental arch springing off the lip of the well
    // at ±44, two courses thick at the crown and eight at the springing, with
    // the deck laid over it. It was a flat slab 110 long and 6 thick, and being
    // the first thing seen in the first room it was a quarter of the frame of
    // untextured brown.
    const soffit = [];
    for (let k = 0; k <= 26; k++) {
      const u = 44 - (k / 26) * 88;
      soffit.push([u, 4 - 26 * (u / 44) ** 2]);
    }
    LB.step.add(profileGeo([[-55, -34], [-55, 12], [55, 12], [55, -34], [44, -34], ...soffit, [-44, -34]], 17, c, 30));
    // a moulded string course along each edge of the deck, and the keystone
    for (const side of [-1, 1]) {
      LB.cap.add(boxGeo(add(a, px, side * 8.6), add(b, px, side * 8.6), 1.6, 2.2, 10.4));
      LB.cap.add(boxGeo(add(a, px, side * 9.2), add(b, px, side * 9.2), 1.2, 1.4, 9.2));
    }
    for (const side of [-1, 1]) {
      LB.cap.add(placed(new THREE.BoxGeometry(5, 7, 2.6), add(c, px, side * 8.7), 6, 30 * deg));
    }
    // a bronze handrail on posts, rather than a bar floating in the air
    for (const side of [-1, 1]) {
      const rail0 = add(a, px, side * 8), rail1 = add(b, px, side * 8);
      LB.bronze.add(rodGeo([rail0[0], 20, rail0[1]], [rail1[0], 20, rail1[1]], 0.7));
      LB.bronze.add(rodGeo([rail0[0], 15.5, rail0[1]], [rail1[0], 15.5, rail1[1]], 0.35));
      for (let u = -52; u <= 52; u += 13) {
        const q = add(add(c, ax, u), px, side * 8);
        LB.bronze.add(placed(new THREE.CylinderGeometry(0.55, 0.7, 8.4, 8), q, 16.2));
        LB.bronze.add(placed(new THREE.SphereGeometry(0.95, 10, 8), q, 20.6));
      }
    }
    // A FILE of readers, not a queue. Seven at thirteen apart stood shoulder to
    // shoulder across the whole width of the frame — a row of near-identical
    // dark blobs with no gap to see the bridge, the arch or the far side
    // through. Four, spread down the length of it and set at different removes,
    // read as people crossing: the eye gets between them, and the bridge gets
    // to be a bridge.
    for (const [along, across] of [[-46, 2.5], [-9, -3.4], [22, 3.8], [51, -1.6]]) {
      figure(add(add(c, ax, along + rr(-2, 2)), px, across + rr(-1.2, 1.2)), 12);
    }
    // Low, and only these two: "two lamps keep the gap they cross". Hung at
    // lamp height with the rest they lit the whole hexagon evenly and the room
    // became the same room as the Echo — these sit just above the readers'
    // heads, so the bridge is an island of light and the gallery falls away.
    lamp(add(c, ax, -64), { y: 42, light: 9000, priority: 8, strength: 1.3, pool: 0.42, poolSize: 150 });
    lamp(add(c, ax, 64), { y: 42, light: 9000, priority: 5, strength: 1.3, pool: 0.42, poolSize: 150 });
    // The deck walked smooth down its middle: the file has been crossing it
    // for a very long time.
    LB.wornStep.add(wornRibbon([add(c, ax, -54), add(c, ax, 54)], 7, 12.03));
    // A reader who has stopped. Under the first lamp, where the bridge comes
    // down to the floor, a lectern with a folio open on it and one of the file
    // turned aside to read it: the readers were only ever walking past.
    {
      const at = add(c, ax, -67), ry = Math.atan2(ax[0], ax[1]), tilt = 0.42;
      const parts = [
        new THREE.BoxGeometry(4.2, 0.8, 4.2).translate(0, 6.4, 0),
        new THREE.CylinderGeometry(0.75, 0.95, 9, 12).translate(0, 11.3, 0),
        new THREE.BoxGeometry(3, 0.8, 2.4).translate(0, 16.2, 0),
        new THREE.BoxGeometry(6.6, 0.45, 4.8).rotateX(tilt).translate(0, 17.3, 0),
        new THREE.BoxGeometry(6.6, 0.6, 0.45).translate(0, 16.6, 2.1),
      ];
      LB.shelf.add(placed(mergeGeometries(parts), at, 0, ry));
      parts.forEach((g) => g.dispose());
      const folio = [-1, 1].map((side) => new THREE.BoxGeometry(3.1, 0.5, 4.1).translate(side * 1.62, 0.25, 0).rotateZ(-side * 0.07));
      LB.paper.add(placed(mergeGeometries(folio).rotateX(tilt).translate(0, 17.62, 0), at, 0, ry));
      folio.forEach((g) => g.dispose());
      const reader = robeGeo.clone();
      reader.rotateX(0.2);
      reader.rotateY(Math.atan2(-ax[0], -ax[1]));
      const rp = add(c, ax, -61.2);
      LB.robe.add(reader.translate(rp[0], 6, rp[1]));
    }
    // The card catalogue, at the other end of the wall with the reading table.
    {
      const { on, turn } = alongWall(c, 4);
      const W = 11, H = 10.5, DP = 5.4, Y0 = 6.9;
      const carcass = [new THREE.BoxGeometry(W, H, DP).translate(0, Y0 + H / 2, 0), new THREE.BoxGeometry(W + 0.9, 0.6, DP + 0.7).translate(0, Y0 + H + 0.3, 0)];
      for (const [x, z] of [[-W / 2 + 0.6, -DP / 2 + 0.6], [W / 2 - 0.6, -DP / 2 + 0.6], [-W / 2 + 0.6, DP / 2 - 0.6], [W / 2 - 0.6, DP / 2 - 0.6]]) {
        carcass.push(new THREE.BoxGeometry(0.8, Y0 - 6, 0.8).translate(x, 6 + (Y0 - 6) / 2, z));
      }
      const fronts = [], pulls = [], labels = [];
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 6; row++) {
          const x = -W / 2 + (col + 0.5) * (W / 4), y = Y0 + (row + 0.5) * (H / 6);
          fronts.push(new THREE.BoxGeometry(W / 4 - 0.35, H / 6 - 0.35, 0.3).translate(x, y, DP / 2 + 0.12));
          pulls.push(new THREE.BoxGeometry(0.7, 0.28, 0.35).translate(x, y - 0.35, DP / 2 + 0.4));
          labels.push(new THREE.BoxGeometry(1.1, 0.5, 0.05).translate(x, y + 0.35, DP / 2 + 0.3));
        }
      }
      const q = on(18, 18.8);
      for (const [batch, list] of [[LB.shelf, carcass], [LB.oak, fronts], [LB.bronze, pulls], [LB.paper, labels]]) {
        batch.add(placed(mergeGeometries(list), q, 0, turn));
        list.forEach((g) => g.dispose());
      }
    }
    // ── The library over the Vestibule ──
    // The room opens with nothing over it but the dark. Look up and the
    // library begins to climb out of it: a gallery of shelves spiralling up
    // from the wall tops, tread after tread, each turn a little further in
    // than the one below, so that looking up the eye goes round and round and
    // in, and the turns go on dimming into the dark until there is no telling
    // where they stop. It is built along the spiral: the treads, the shelves
    // and the rail first, then the books flying up out of the room onto them,
    // and all of it arriving as dark as it stays: nothing lights up as it
    // lands. Once begun it goes on by itself, and looking up hurries it.
    // Leave the room and it is gone again, so the Vestibule always opens on
    // the same empty dark.
    //
    // Its own random stream, not the world's: this is built in the middle of
    // the galleries, and every draw on the shared one would reshuffle
    // everything built after it (the garden with it).
    {
      let st = 0x5113ce;
      const vr = () => {
        st = (st + 0x6d2b79f5) | 0;
        let x = Math.imul(st ^ (st >>> 15), 1 | st);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
      const vrr = (a, b) => a + (b - a) * vr();
      const Y0 = MASS_H + CAP;
      // Nine turns, each 38 high and 12% narrower than the last: from the wall
      // tops to a throat a third as wide, 340 up. SEG treads to a turn.
      // Every turn is the turn below it made smaller: 12% narrower, 12% lower,
      // its shelves, books, rail and lamps all 12% smaller. So the turns do
      // not stop — they close in on a point 290 up, books to the last of them,
      // the way a picture of a library inside a picture of that library does.
      // (Built at one size and faded into black, the top of it was a dark lid,
      // and the reader could see where the library ended.)
      const TURNS = light ? 11 : 18, SEG = light ? 24 : 36, PITCH = 38, R0 = 97, SHRINK = 0.88;
      const SHELF = 8, WALK = 10, TREAD = 2.6;
      const N = TURNS * SEG, LN = -Math.log(SHRINK);
      const scale = (s) => SHRINK ** (TURNS * s);
      const radius = (s) => R0 * scale(s);
      // the height a tread is set at: each turn rises its own (shrunken) pitch
      const height = (s) => Y0 + (PITCH * (1 - scale(s))) / LN;
      const angle = (s) => 330 + 360 * TURNS * s;   // starts over the far wall, the one the stand faces
      // The hexagon's own edge along a bearing: where the first turn's treads
      // have to reach to close against the wall tops. The corners are at
      // 0, 60, 120… (hexPts) and the flats between them. (Measured from the
      // wrong one of the two, it reached out past the flats and fell short of
      // every corner, and the sky showed through at all six.)
      const edge = (a) => A / Math.cos(((((a % 60) + 60) % 60) - 30) * deg);
      // Dark from the first turn, darker going up, but never so dark that the
      // books go out: they have to be there to the end. (0.45 at the foot read
      // as a lit ceiling; this is under half of that, and the books are
      // dimmed through their gilt as well as their leather — see `bookMat`.)
      const fade = (s) => 0.07 + 0.13 * Math.exp(-1.8 * s);

      const UP = new THREE.Vector3(0, 1, 0);
      const pieces = { wood: [], stone: [], bronze: [], lamps: [], books: [] };
      // A piece: its place, where it comes from, and when in the build it
      // sets off. `inward` is the unit vector toward the axis at its bearing.
      const put = (kind, center, inward, size, color, order, { from = null, tilt = 0 } = {}) => {
        const z = inward.clone(), x = new THREE.Vector3().crossVectors(UP, z).normalize();
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, UP, z));
        if (tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
        const away = from ?? new THREE.Vector3(vrr(-10, 10), vrr(30, 55), vrr(-10, 10)).addScaledVector(inward, vrr(6, 16));
        const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(vrr(-2, 2), vrr(-2, 2), vrr(-2, 2)));
        pieces[kind].push({ p: center.clone(), q, s: new THREE.Vector3(...size), from: away, spin, color: new THREE.Color(color), order, t0: -1, state: 0 });
      };
      const at = (r, a, y) => new THREE.Vector3(c[0] + Math.cos(a * deg) * r, y, c[1] + Math.sin(a * deg) * r);
      const inwardAt = (a) => new THREE.Vector3(-Math.cos(a * deg), 0, -Math.sin(a * deg));
      const tint = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
      const chord = (r) => 2 * r * Math.sin((180 / SEG) * deg) * 1.02;
      // where the rail's top runs, at the start of tread `i`
      const railAt = (i) => {
        const s = i / N, f = scale(s);
        return at(radius((i + 0.5) / N) - (SHELF + WALK - 1.1) * f, angle(s), height(s) + 9 * f);
      };

      for (let i = 0; i < N; i++) {
        const s = i / N, sm = (i + 0.5) / N, a = angle(sm), r = radius(sm), k = fade(sm), f = scale(sm);
        const y = height(s);                       // the top of this tread
        const yUp = height(s + 1 / TURNS);         // the tread a turn above it
        const inn = inwardAt(a);
        const order = s;
        // the tread: from the rail out to the wall of the turn below it (or,
        // in the first turn, to the hexagon's own wall tops)
        const rIn = r - (SHELF + WALK) * f, rOut = i < SEG ? edge(a) + 3 : radius(sm - 1 / TURNS) + 1.5 * f;
        put('stone', at((rIn + rOut) / 2, a, y - (TREAD * f) / 2), inn, [chord(rOut), TREAD * f, rOut - rIn], tint('#4d443a', k), order);
        // its nosing: the pale edge that draws the spiral seen from below
        put('stone', at(rIn + 0.4 * f, a, y - 3.7 * f), inn, [chord(rIn) * 1.01, 2.2 * f, 1.6 * f], tint('#8a7c69', k), order);
        // and a bronze string under that: the one line that catches the
        // light all the way up, so the eye is handed the helix and not a
        // stack of rings
        put('bronze', at(rIn + 0.1 * f, a, y - 5.1 * f), inn, [0.55 * f, chord(rIn) * 1.02, 0.55 * f], tint('#ffffff', 0.25 + 0.6 * k), order, { tilt: Math.PI / 2 });
        // The back of the bookcase, up to the underside of the tread a turn
        // above — and in the first turn down behind the wall tops, so there is
        // no seeing past its foot.
        const low = i < SEG ? Y0 - 12 : y;
        put('wood', at(r + f, a, (low + yUp) / 2), inn, [chord(r + f), yUp - low, 2 * f], tint('#2a1d15', k), order + 0.0005);
        // two shelves, a cornice over them, and the uprights between the bays
        const PH = yUp - y;
        for (const [yy, t, deep] of [[y + 0.2 * f, 1.6, 0], [y + PH / 2, 1.4, 0], [yUp - (TREAD + 3) * f, 3, 1.6]]) {
          put('wood', at(r - (SHELF / 2 + deep / 2) * f, a, yy + (t * f) / 2), inn, [chord(r), t * f, (SHELF + deep) * f], tint('#4a3526', k), order + 0.001);
        }
        if (i % 3 === 0) {
          const ab = angle(s);
          put('wood', at(r - (SHELF / 2 + 0.4) * f, ab, (y + yUp) / 2), inwardAt(ab), [1.8 * f, PH - TREAD * f, (SHELF + 0.8) * f], tint('#3b2a1e', k), order + 0.001);
        }
        // the rail: a baluster at every tread, a rod from each to the next
        const p0 = railAt(i), p1 = railAt(i + 1);
        put('bronze', p0.clone().setY(p0.y - 4.5 * f), inwardAt(angle(s)), [0.55 * f, 9 * f, 0.55 * f], tint('#ffffff', 0.2 + 0.6 * k), order + 0.002);
        {
          const len = p0.distanceTo(p1), mid = p0.clone().add(p1).multiplyScalar(0.5);
          const along = p1.clone().sub(p0).normalize();
          pieces.bronze.push({
            p: mid, q: new THREE.Quaternion().setFromUnitVectors(UP, along), s: new THREE.Vector3(0.42 * f, len * 1.02, 0.42 * f),
            from: new THREE.Vector3(vrr(-8, 8), vrr(30, 50), vrr(-8, 8)), spin: new THREE.Quaternion(),
            color: tint('#ffffff', 0.2 + 0.6 * k), order: order + 0.002, t0: -1, state: 0,
          });
        }
        // a small lamp on every third post: a string of lights going round
        // and up and in, which is what draws the spiral the eye follows
        if (i % 3 === 1) {
          const g = Math.max(0.35, 0.9 * f);
          put('lamps', p0.clone().setY(p0.y + 1.2 * f), inwardAt(angle(s)), [g, g, g], tint('#ffc98e', 0.2 + 1.5 * k), order + 0.003);
        }
        // the books, both shelves, flying up out of the room onto them
        const rb = r - 4.2 * f, w = chord(rb) * 0.97;
        const along = new THREE.Vector3().crossVectors(UP, inn).normalize();
        const rows = [[y + 1.8 * f, PH * 0.5 - 2.6 * f], [y + PH * 0.5 + 1.4 * f, PH * 0.5 - TREAD * f - 4.8 * f]];
        // In the first turn the tread climbs away from the wall tops, and the
        // bookcase under it — down to the stone — was a bare dark board as
        // tall as the whole bay by the end of the turn. It gets shelves too.
        if (i < SEG) {
          const under = y - 6 * f - Y0;
          for (let b = Y0; b + 9 < Y0 + under; b += PH / 2) {
            const room = Math.min(PH / 2 - 2.4 * f, Y0 + under - b - 1.2);
            put('wood', at(r - (SHELF / 2) * f, a, b - 0.7 * f), inn, [chord(r), 1.4 * f, SHELF * f], tint('#4a3526', k), order + 0.001);
            rows.push([b + 0.1, room]);
          }
        }
        for (const [yb, room] of rows) {
          const base = yb - y;
          let u = -w / 2;
          let n = 0;
          while (u < w / 2 - 1.4 * f) {
            if (vr() < 0.04) { u += vrr(1.5, 4) * f; continue; }
            const bw = Math.min(vrr(1.3, 2.9) * f, w / 2 - u), bh = vrr(room * 0.7, room);
            const tilt = vr() < 0.05 ? vrr(-0.25, 0.25) : 0;
            // across the bay, not round it: a straight shelf in each bay
            const p = at(rb, a, y + base + bh / 2).addScaledVector(along, u + bw / 2);
            const from = inn.clone().multiplyScalar(vrr(28, 60)).add(new THREE.Vector3(vrr(-12, 12), -vrr(8, 30), vrr(-12, 12)));
            put('books', p, inn, [bw, bh, vrr(6, 7.4) * f], tint(BOOKS[Math.floor(vr() * BOOKS.length)], vrr(0.8, 1.15)),
              order + 0.003 + n * 0.00012, { from, tilt });
            pieces.books[pieces.books.length - 1].dim = k;
            u += bw + vrr(0.1, 0.5) * f;
            n++;
          }
        }
      }
      // What it closes in on: past the last turn the next would be a few
      // units across, so the throat is stopped with a dark disc rather than
      // left as a hole onto the stars.
      {
        const yTop = height(1 + 1 / TURNS), r = radius(1) + 2;
        pieces.stone.push({
          p: new THREE.Vector3(c[0], yTop, c[1]), q: new THREE.Quaternion(), s: new THREE.Vector3(r * 2, 1, r * 2),
          from: new THREE.Vector3(0, 60, 0), spin: new THREE.Quaternion(), color: new THREE.Color('#050404'), order: 1.0, t0: -1, state: 0,
        });
      }

      // ── drawing it ──
      const woodMat = Std({ color: '#ffffff', map: wood.map, roughness: 0.9 });
      const stoneMat = Std({ color: '#ffffff', roughness: 0.95 });
      // The room's own bindings, but dimmed whole. The book material paints
      // the gilt, the labels and the page edges in colours of their own, so an
      // instance colour only ever darkened the leather — and a spiral of dark
      // leather under bright gold lettering read as a lit library, however far
      // the leather went down. `aDim` takes the finished colour down with it,
      // gold and paper included.
      const bookMat = makeBookMaterial(spines);
      {
        const base = bookMat.onBeforeCompile;
        bookMat.onBeforeCompile = (sh, r) => {
          base.call(bookMat, sh, r);
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
        attribute float aDim;
        varying float vDim;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
        vDim = aDim;`);
          // after the bindings are painted (color_fragment), before anything
          // reads the colour — so the gilt's metal goes down with it too
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
        varying float vDim;`)
            .replace('#include <roughnessmap_fragment>', `diffuseColor.rgb *= vDim;
        #include <roughnessmap_fragment>`);
        };
        bookMat.customProgramCacheKey = () => 'babel-books-dimmed';
        keep(bookMat);
      }
      const lampMat = keep(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      const meshes = [];
      const make = (list, geo, mat, { spine = false } = {}) => {
        const g = keep(geo);
        if (spine) {
          g.setAttribute('aSpine', new THREE.InstancedBufferAttribute(Float32Array.from(list, (b) => spineAt([b.p.x, b.p.y, b.p.z])), 1));
          g.setAttribute('aDim', new THREE.InstancedBufferAttribute(Float32Array.from(list, (b) => b.dim ?? 1), 1));
          g.setAttribute('aGraze', new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1));
          g.setAttribute('aDust', new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1));
        }
        const mesh = new THREE.InstancedMesh(g, mat, list.length);
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        list.forEach((it, j) => mesh.setColorAt(j, it.color));
        root.add(mesh);
        meshes.push({ mesh, list });
      };
      make(pieces.stone, new THREE.BoxGeometry(1, 1, 1), stoneMat);
      make(pieces.wood, new THREE.BoxGeometry(1, 1, 1), woodMat);
      make(pieces.books, new THREE.BoxGeometry(1, 1, 1), bookMat, { spine: true });
      make(pieces.bronze, new THREE.CylinderGeometry(0.5, 0.5, 1, 8), M.bronze);
      make(pieces.lamps, new THREE.SphereGeometry(0.5, 12, 8), lampMat);

      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      const FLY = 1.3, LAST = 1.02;
      let built = 0, was = null, begun = false, held = false, dirty = false;
      // States: 0 not yet, 1 in the air, 3 set down. Only a piece in the air
      // costs anything a frame, so a finished library is free.
      const draw = (t) => {
        let busy = false;
        for (const { mesh, list } of meshes) {
          let touched = false;
          list.forEach((it, j) => {
            if (it.state === 3) return;
            if (it.state === 0) {
              if (built < it.order) return;
              it.state = 1;
              it.t0 = t;
            }
            const u = Math.min(1, (t - it.t0) / FLY);
            if (u < 1) {
              // lifted along an arc and set down, turning out of its tumble
              const e = 1 - (1 - u) ** 3;
              p.copy(it.p).addScaledVector(it.from, 1 - e);
              p.y += Math.sin(Math.PI * e) * 6;
              q.copy(it.spin).multiply(it.q).slerp(it.q, e);
              sc.copy(it.s).multiplyScalar(Math.min(1, u * 5));
            } else {
              p.copy(it.p);
              q.copy(it.q);
              sc.copy(it.s);
              it.state = 3;
            }
            mesh.setMatrixAt(j, m4.compose(p, q, sc));
            touched = true;
            busy = true;
          });
          if (touched) mesh.instanceMatrix.needsUpdate = true;
        }
        return busy;
      };
      const clear = () => {
        for (const { mesh, list } of meshes) {
          const zero = new THREE.Matrix4().makeScale(0, 0, 0);
          list.forEach((it, j) => { it.state = 0; mesh.setMatrixAt(j, zero); });
          mesh.instanceMatrix.needsUpdate = true;
          mesh.visible = false;
        }
      };
      clear();
      vault = (t, eye, gaze) => {
        const dt = was === null ? 0 : Math.min(0.1, Math.max(0, t - was));
        was = t;
        const far = eye ? Math.hypot(eye.x - c[0], eye.z - c[1]) : Infinity;
        if (far > R) {
          // Gone again once the reader is out of the room, so it is never
          // found half-built from the hallway.
          if (built > 0 && far > R + 20) { built = 0; begun = false; clear(); }
          return;
        }
        // Looking out level, or at the stair, does nothing: it wants the head
        // turned up, past where the room's composed view points.
        const up = gaze ? THREE.MathUtils.smoothstep(gaze.y, 0.3, 0.72) : 0;
        if (up > 0) begun = true;
        if (begun && !held && built < LAST) { built = Math.min(LAST, built + dt * (0.032 + 0.12 * up)); dirty = true; }
        if (built > 0) for (const { mesh } of meshes) mesh.visible = true;
        if (dirty) dirty = draw(t) || built < LAST;
      };
      if (import.meta.env.DEV) {
        window.__vault = (v, hold = false) => {
          if (v !== undefined) {
            // set down everything before `v` at once
            clear();
            built = v;
            begun = v > 0;
            held = hold;
            for (const { list } of meshes) for (const it of list) if (it.order <= v - 0.04) { it.state = 1; it.t0 = -1e3; }
            dirty = true;
          }
          return built;
        };
      }
    }
  }
  // II — the Echo: two flights crossing over the shaft, a colonnade answering itself.
  {
    const c = cellC(1, -1);
    // Each flight is ONE piece of stone: a stepped top, and under it the arc
    // that carries it over the shaft — springing off the floor at the well's
    // lip, thinnest at the crown. As 36 separate slabs hung in the air with a
    // gap under every one, this read as a stack of packing crates, which is the
    // single thing that made this room look built out of cardboard.
    // A real arch under each flight, springing wide of the well: end-on, a
    // flight is a wall across half the room, and the opening under it is what
    // makes it a bridge instead.
    for (const ang of [0, 60]) {
      const f = flightProfile({});
      LB.step.add(profileGeo(f.pts, 15, c, ang));
      // The two flights cross at the crown, so each one's balustrade stops a
      // little short of where the other's deck arrives: the landing is open on
      // all four sides, which is the only way "stairs cross stairs" can be
      // something a reader does rather than something they look at. 15 is
      // worked out rather than chosen — at 60 degrees a rail 8.7 off its own
      // axis cuts the other flight's 7.5 half-width between -13.2 and 13.2,
      // and the newels want to stand clear of that.
      flightDress(c, ang, f, 7.9, { gap: [-15, 15] });
    }
    // ── The crossing ─────────────────────────────────────────────────────
    // The one piece of floor in this room a reader is ever brought to a stop
    // on (VANTAGES), and it was two staircases overlapping. An inlaid rose
    // makes it a place: six rays for the six ways out of a hexagon, two of
    // which are the flights under your feet. Kept inside 8, because past 8.66
    // the landing is air — beyond that radius neither flight is under it.
    {
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
      // is: from the crown it was the whole frame gone pale (see shaftVolume).
      const beam = new THREE.Mesh(
        keep(shaftVolume(new THREE.CylinderGeometry(24, 40, 190, 30, 1, true),
          mid.clone().addScaledVector(up, -95).toArray(), 40, mid.clone().addScaledVector(up, 95).toArray(), 24)),
        keep(makeShaftMaterial('#c3cfd8', 0.12)),
      );
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      beam.position.copy(mid);
      beam.renderOrder = 2;
      root.add(beam);
      // Where it LANDS. From the floor the column hung in front of the stair
      // as a grey sheet, and light in the air is the weakest way to say light.
      // Laid on the treads it crosses, cut to the beam's own section at the
      // height of each tread, it comes down the stair in steps with a hard
      // edge — which is what moonlight through an opening does.
      const moonLand = keep(new THREE.ShaderMaterial({
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
            float r = 32.0 - 8.0 * t / 95.0;
            float d = distance(vW.xz, ctr);
            float m = (1.0 - smoothstep(r - 1.4, r + 0.3, d)) * (0.72 + 0.28 * (1.0 - d / r));
            gl_FragColor = vec4(uColor * m * uO, 1.0);
          }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }));
      const treads = [];
      const f = flightProfile({});
      for (const ang of [0, 60]) {
        for (let k = 0; k < f.dims.steps; k++) {
          const u = -f.dims.span + (k + 0.5) * f.dims.run, y = f.stepTop(k);
          if (ang === 60 && Math.abs(u) < 9) continue;   // the crown both flights share, lit once
          const q = add(c, dir(ang), u);
          const off = (y - 30) * Math.tan(tilt), ctr = add(c, dir(52), off), r = 32 - (8 * ((y - 30) / Math.cos(tilt))) / 95;
          if (dist(q, ctr) > r + 9) continue;
          treads.push(flatQuad(q, ang, f.dims.run, 14.6, y + 0.05));
        }
      }
      const land = new THREE.Mesh(keep(mergeGeometries(treads)), moonLand);
      treads.forEach((g) => g.dispose());
      land.renderOrder = 2;
      root.add(land);
    }
    // Every passage insists it has been walked before: a paler, smoother track
    // up the middle of every tread of both flights.
    {
      const f = flightProfile({});
      for (const ang of [0, 60]) {
        for (let k = 0; k < f.dims.steps; k++) {
          const u = -f.dims.span + (k + 0.5) * f.dims.run;
          LB.wornStep.add(flatQuad(add(c, dir(ang), u), ang, f.dims.run - 0.6, 6.4, f.stepTop(k) + 0.03));
        }
      }
    }
    LB.inlay.add(slabGeo(circlePts(c, 50.5, 60), [circlePts(c, 49, 60)], 0.5, 6));
    LB.inlay.add(slabGeo(circlePts(c, 79, 60), [circlePts(c, 77.2, 60)], 0.5, 6));
    // ── Arcades answering arcades ─────────────────────────────────────────
    // What the room is called after, and what it did not have: two storeys of
    // arcade round the well on twelve bays, so that from anywhere in the gallery
    // you are looking through one arch at another, and through that at a third.
    // Without it this was a hexagon of bookshelves with a lamp in it — which is
    // exactly what the Vestibule is, and the two rooms were interchangeable.
    const FLOOR = 6, BAYS = 12, RING = 64, HALF = RING * Math.sin((180 / BAYS) * deg);
    // An arcade storey: a colonnade carrying a run of arches and a cornice over.
    // What keeps it from being any arcade anywhere is entirely in the ornament —
    // a moulded ring round every arch, an impost for it to spring from, a
    // roundel over every crown and a course of dentils under every cornice. Bare,
    // twelve identical openings in one pale stone read as a default.
    const arcade = (base, shaft, capH, rad, span, rise, band) => {
      const top = base + shaft + capH;
      const depth = rad * 2.3;
      for (let k = 0; k < BAYS; k++) {
        const a = 15 + k * (360 / BAYS);
        const p = add(c, dir(a), RING);
        // pier: base mouldings, a fluted shaft, an impost the arch springs from
        LB.stone.add(placed(new THREE.CylinderGeometry(rad * 0.88, rad, shaft, 14), p, base + shaft / 2));
        for (let f = 0; f < 8; f++) {
          const q = add(p, dir(a + 180 + f * 45), rad * 0.9);
          LB.stone.add(placed(new THREE.CylinderGeometry(rad * 0.13, rad * 0.13, shaft * 0.96, 5), q, base + shaft / 2));
        }
        LB.stone.add(placed(new THREE.CylinderGeometry(rad * 1.3, rad * 1.5, capH * 0.6, 14), p, base - capH * 0.3));
        LB.cap.add(placed(new THREE.BoxGeometry(rad * 3.2, capH * 0.5, rad * 3.2), p, base - capH * 0.75));
        // The lower storey is raised to put its arches level with the crown,
        // and nothing carried it up there: every pier stood on air ten units
        // over the floor. A pedestal under each — a base block on the floor, a
        // die with a sunk panel on each face, a cornice under the plinth.
        const foot = base - capH;
        if (foot > FLOOR + 2) {
          const h = foot - FLOOR, die = rad * 2.8;
          LB.cap.add(placed(new THREE.BoxGeometry(rad * 3.6, 1.4, rad * 3.6), p, FLOOR + 0.7));
          LB.cap.add(placed(new THREE.BoxGeometry(rad * 3.3, 0.7, rad * 3.3), p, FLOOR + 1.75));
          LB.stone.add(placed(new THREE.BoxGeometry(die, h - 3.1, die), p, FLOOR + 2.1 + (h - 3.1) / 2));
          LB.cap.add(placed(new THREE.BoxGeometry(rad * 3.1, 0.6, rad * 3.1), p, foot - 0.7));
          LB.cap.add(placed(new THREE.BoxGeometry(rad * 3.4, 0.4, rad * 3.4), p, foot - 0.2));
          for (let s = 0; s < 4; s++) {
            const q = add(p, dir(90 * s), die / 2 + 0.1);
            LB.mass.add(placed(new THREE.BoxGeometry(0.4, h - 5.4, die * 0.64), q, FLOOR + 2.1 + (h - 3.1) / 2, -90 * s * deg));
          }
        }
        LB.stone.add(placed(new THREE.CylinderGeometry(rad * 1.45, rad * 1.05, capH * 0.7, 14), p, top - capH * 0.65));
        LB.cap.add(placed(new THREE.BoxGeometry(rad * 3.4, capH * 0.5, rad * 3.4), p, top - capH * 0.15));
        LB.cap.add(placed(new THREE.BoxGeometry(rad * 3.9, capH * 0.34, rad * 3.9), p, top + capH * 0.12));

        const mid = add(c, dir(a + 180 / BAYS), RING * Math.cos((180 / BAYS) * deg));
        const turn = a + 90 + 180 / BAYS;
        // the spandrel between this pier and the next: one closed outline, the
        // arch cut out of its underside (a hole would have to stop short of it)
        const arc = [];
        for (let n = 0; n <= 20; n++) {
          const th = Math.PI * (1 - n / 20);
          arc.push([Math.cos(th) * span, top + Math.sin(th) * rise]);
        }
        LB.mass.add(profileGeo(
          [[-HALF, top], [-span, top], ...arc, [span, top], [HALF, top], [HALF, top + rise + band], [-HALF, top + rise + band]],
          depth, mid, turn,
        ));
        // the archivolt: a moulded ring standing proud on each face of the arch
        for (const face of [-1, 1]) {
          const q = add(mid, dir(turn + 90), face * (depth / 2 + 0.55));
          const ring2 = new THREE.TorusGeometry(span + 1.15, 1.15, 6, 26, Math.PI);
          ring2.scale(1, rise / span, 1);
          LB.cap.add(placed(ring2.rotateY(-turn * deg), q, top));
          // and a keystone at the crown
          LB.cap.add(placed(new THREE.BoxGeometry(2.6, 5, 1.7), q, top + rise + 0.9, -turn * deg));
        }
        // a roundel over every crown, bronze in a pale surround
        const oc = add(mid, dir(turn + 90), depth / 2 + 0.4);
        LB.cap.add(placed(new THREE.CylinderGeometry(band * 0.36, band * 0.36, 0.9, 20).rotateX(Math.PI / 2), oc, top + rise + band * 0.52, -turn * deg));
        LB.bronzeDim.add(placed(new THREE.CylinderGeometry(band * 0.27, band * 0.27, 1.3, 20).rotateX(Math.PI / 2), oc, top + rise + band * 0.52, -turn * deg));
      }
      // a course of dentils under the cornice, the smallest repeat in the room
      for (let d = 0; d < BAYS * 7; d++) {
        const a = (360 / (BAYS * 7)) * d;
        posts.push({
          p: [c[0] + Math.cos(a * deg) * (RING - rad * 0.5), top + rise + band - 1.1, c[1] + Math.sin(a * deg) * (RING - rad * 0.5)],
          rot: [0, -a * deg, 0],
          s: [rad * 1.5, 1.5, rad * 0.62],
        });
      }
      // The cornice the storey carries, a ring right round the well — kept
      // narrow, because a deep one hangs over the reader's head as a black
      // soffit right across the top of the frame.
      // Round, not hexagonal: as a hexagon the ring's CORNERS reach out to
      // within a few units of where the reader stands and hang over their head
      // as a black soffit across the top of the frame.
      const ring = (r) => circlePts(c, r, 48);
      LB.cap.add(slabGeo(ring(RING + rad * 1.35), [ring(RING - rad * 1.35)], 2, top + rise + band));
      LB.cap.add(slabGeo(ring(RING + rad * 1.05), [ring(RING - rad * 1.05)], 1.4, top + rise + band + 2));
      return top + rise + band + 2.4;
    };
    const upper = arcade(20, 20, 3.5, 3.6, 13.2, 12, 8);
    arcade(upper + 3, 14, 3, 2.5, 13.2, 9, 6);
    // Books in the upper arcade. Its bays stood open on bare stone, so the
    // colonnade read as architecture that had forgotten it was in a library:
    // a low case in every one, books on both faces, stands on the cornice.
    {
      const er = makeRng(5150), bind = bindingsFor(1);
      for (let k = 0; k < BAYS; k++) {
        const p0 = add(c, dir(15 + k * 30), RING), p1 = add(c, dir(45 + k * 30), RING);
        const A0 = lerp2(p0, p1, 0.16), A1 = lerp2(p0, p1, 0.84), L = dist(A0, A1), t = unit2(A0, A1);
        const inw = [-t[1], t[0]], turnB = -Math.atan2(t[1], t[0]), Y = upper + 0.2;
        const on = (u, z) => add(add(A0, t, u), inw, z);
        LB.shelf.add(boxGeo(on(0, 0), on(L, 0), 0.6, 3.4, Y));
        LB.shelf.add(boxGeo(on(-0.3, 0), on(L + 0.3, 0), 0.7, 3.9, Y + 8.4));
        LB.shelf.add(boxGeo(on(0, 0), on(L, 0), 7.8, 0.5, Y + 0.6));
        for (const u of [0, L]) LB.shelf.add(placed(new THREE.BoxGeometry(0.7, 7.8, 3.4), on(u, 0), Y + 4.5, turnB));
        for (const side of [1, -1]) {
          let u = 0.6;
          while (u < L - 1.2) {
            const B = bind[Math.floor(er() * bind.length)], w = 1.3 + er() * 1.1, h = 5.2 + er() * 2;
            if (u + w > L - 0.5) break;
            const q = on(u + w / 2, side * 1.05);
            books.push({
              p: [q[0], Y + 0.6 + h / 2, q[1]], rot: [0, turnB + (side < 0 ? Math.PI : 0), 0], s: [w, h, 1.5],
              color: B.cols[Math.floor(er() * B.cols.length)], k: 0.85 + er() * 0.2,
              spine: kindCell(B.kind ?? (er() < 0.3 ? 'rich' : 'label'), er()),
            });
            u += w + 0.1 + er() * 0.25;
          }
        }
      }
    }
    // A sconce on every other pier, so the light repeats with the arches. Not
    // `lamp` — its halo is a sprite drawn with depthTest off, and at this size
    // and this close it hangs in front of the arcade as a pale disc.
    // Not on the two piers at the ends of the flight the walk climbs (165° and
    // 345°): the walk steps onto the stair beside one and off it beside the
    // other, a few units from the pier at the height of the eye, and a lit
    // lamp that close sweeping past the lens was most of what made going over
    // the crossing feel like walking into the columns.
    for (let k = 1; k < BAYS; k += 2) {
      const a = 15 + k * 30, p = add(c, dir(a), RING - 4.2);
      if (a === 165 || a === 345) continue;
      LB.bronze.add(placed(new THREE.CylinderGeometry(0.4, 0.4, 3.4, 6).rotateZ(Math.PI / 2), p, 26, -a * deg));
      LB.bronze.add(placed(new THREE.CylinderGeometry(1.9, 1.1, 0.8, 10), p, 28.4));
      glows.push({ p: [p[0], 26.6, p[1]], s: [1.5, 1.9, 1.5], color: '#ffc98e', k: 0.95 });
      halo(p, 26.6, 16, '#ffbe78', 0.16);
    }
    lamp(add(c, dir(150), 52), { light: 8500, priority: 7, strength: 1.2, pool: 0.32 });
    // In a little from the arcade and down in strength: at 52 it hung a dozen
    // units from the keystone and roundel over its bay and blew them out, and
    // with the moon the room had two brightest things. The moon wins now.
    lamp(add(c, dir(30), 45), { strength: 0.85, pool: 0.26 });
  }
  // III — the Silence: "at the deepest reach the stairways still their crossing,
  // and a single lamp keeps the dark honest". So the Echo's crossing is here
  // too — and stilled: two flights climb out over the well and, instead of
  // crossing, come to rest on one landing in the middle of it, under the one
  // lamp; five of the six lamps have gone out, and the one that has not is the
  // whole light in the room. (They used to be sheared off in the air a little
  // short of each other, and from the stand that read as a bridge into
  // nowhere, not as a stair that had stopped. Before that it was a lamp, a
  // reader and twelve boxes spiralling into the shaft — the Echo again with
  // the lights down.)
  {
    const c = cellC(2, -2);
    // Both flights climb from the floor to the middle and end on its axis,
    // the level crown of each running on into the landing. (`from: 9` builds
    // the half on the near side of the axis, which is the half the walk does
    // not cross — see `legs`.)
    //
    // Where they meet, each is buried in the other: the inner flank as far as
    // the V where the two inner parapets cross (13 puts both newels on the
    // bisector, one post), the outer flank only until it leaves the landing.
    // The parapet comes down over both, as it does over the Echo's crossing.
    const LAND = 9.5, INNER = 13, OUTER = 5.5;
    for (const ang of [240, 300]) {
      const f = flightProfile({ from: 9, to: 18 });
      LB.step.add(profileGeo(f.pts, 13, c, ang));
      const inner = ang === 240 ? 1 : -1;
      flightDress(c, ang, f, 6.9, { ends: [false, true], gap: (side) => [-1, side === inner ? INNER : OUTER] });
      // The rubble the broken ends used to shed onto the floor is gone with
      // them; its draws stay, because the world's random stream is shared and
      // everything built after this would otherwise be shuffled.
      for (let k = 0; k < 6; k++) { rr(-26, 26); rr(50, 74); rot3(); rr(2, 5.5); rr(1, 2.6); rr(2, 5.5); pick([0, 0, 0]); }
    }
    // ── The landing ──
    // A round floor at the height of the crowns, where the two flights come
    // in, carried on their arches. Everything round its free edge — the half
    // circle facing the room — is the flights' own dressing bent round it, the
    // same members at the same heights, so the stone reads as one stair that
    // arrives rather than two that were stopped: string and corona under the
    // deck, a kerb and its coping, balusters and a rail from the outer newel
    // of one flight to the outer newel of the other.
    {
      const f = flightProfile({ from: 9 });
      const TOP = f.pitch(0);
      // The free edge: from one flight's outer newel round to the other's. The
      // newels stand at u = OUTER, 7.5 off the axis (see flightDress).
      const RN = Math.hypot(OUTER, 7.5), half = Math.atan2(7.5, OUTER) / deg;
      const A0 = 300 + half, A1 = 360 + 240 - half;
      const arc = (r, n = 28) => Array.from({ length: n + 1 }, (_, k) => add(c, dir(A0 + ((A1 - A0) * k) / n), r));
      const band = (r0, r1, y0, h) => LB.cap.add(slabGeo([...arc(r1), ...arc(r0).reverse()], [], h, y0));
      // A slab, not a drum. As a solid disc down to the arches' soffit, with a
      // cone under it, the landing read as a font or a pulpit standing on the
      // well, and not as the place two flights came to rest. Thin, it is
      // carried out over the well on the flights' own stone.
      LB.step.add(slabGeo(circlePts(c, LAND, 48), [], 3.4, TOP - 3.4));
      band(LAND - 1.6, LAND, TOP, 1.6);                  // the kerb
      band(LAND - 1.05, LAND + 1.15, TOP + 1.6, 0.85);   // its coping
      band(LAND - 0.5, LAND + 0.82, TOP - 2.45, 1.2);    // the string
      band(LAND - 0.5, LAND + 1.15, TOP - 1.25, 0.8);    // its corona
      band(LAND - 0.5, LAND + 0.6, TOP - 4.3, 0.9);      // a fillet under the slab
      const railY = TOP + 9, base = TOP + 2.45;
      const rail = arc(RN, 24);
      for (let i = 1; i < rail.length; i++) {
        LB.bronze.add(rodGeo([rail[i - 1][0], railY, rail[i - 1][1]], [rail[i][0], railY, rail[i][1]], 0.44));
      }
      // at the flights' spacing of two to a tread, along the arc
      const n = Math.round(((A1 - A0) * deg * RN) / 4);
      for (let k = 1; k < n; k++) {
        const q = add(c, dir(A0 + ((A1 - A0) * k) / n), RN);
        balusters.push({ p: [q[0], base, q[1]], s: [0.42, (railY - 0.55 - base) / 6.2, 0.42] });
      }
      // a small boss under the middle, and no more
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.1, 0.7, 0.8, 16), c, TOP - 3.8));
    }
    // The one lamp still burning hangs over the landing, just off its middle
    // toward where the flights come in — so what it lights is the place where
    // the stairs stop. (Beyond them it only silhouetted them, and a dark shape
    // over a dark well is not a stair.)
    // (its pool on the landing, where it falls: the floor under it is a well)
    lamp(add(c, dir(270), 9), { y: 50, light: 7000, priority: 6, color: '#ffc98e', strength: 0.95, pool: 0.3, poolSize: 24, poolY: flightProfile({ from: 9 }).pitch(0) + 0.06, beam: false });
    for (const a of [15, 75, 150, 210, 330]) lamp(add(c, dir(a), rr(52, 64)), { out: true, r: rr(7.5, 9) });
    // More that have gone out, at other heights, so the dark globes are a
    // room's worth and not a row — and one that fell: its chain still hangs
    // where it was, and the glass lies broken on the floor under it.
    for (const [a, rad, y, r] of [[45, 30, 74, 8], [110, 44, 58, 7], [185, 30, 82, 8.5], [265, 60, 70, 7.5]]) {
      lamp(add(c, dir(a), rad), { out: true, y, r });
    }
    {
      const sr = makeRng(2262), at = add(c, dir(262), 50);
      for (let cy = 64, k = 0; cy < MASS_H + 40; cy += 1.55, k++) links.push({ p: [at[0], cy, at[1]], rot: [0, k % 2 ? Math.PI / 2 : 0, 0], s: [1, 1, 1] });
      LB.deadShards.add(new THREE.SphereGeometry(4.2, 24, 16, 0, Math.PI * 2, 0.75, 2.2).rotateZ(1.75).rotateY(0.6).translate(at[0], 6 + 3.1, at[1]));
      LB.bronzeDim.add(placed(new THREE.CylinderGeometry(1.4, 1.9, 1.1, 16).rotateZ(Math.PI / 2).rotateY(1.2), add(at, dir(20), 6), 6.9));
      for (let k = 0; k < 10; k++) {
        const q = add(at, dir(sr() * 360), 3 + sr() * 8);
        LB.deadShards.add(new THREE.IcosahedronGeometry(1, 0).scale(0.5 + sr(), 0.08 + sr() * 0.1, 0.4 + sr() * 0.8)
          .rotateY(sr() * 6.28).translate(q[0], 6.12, q[1]));
      }
    }
    figure(add(c, dir(200), 52), 6);
  }
  // Two of them turned down. The one hung in the Vestibule's arch was the
  // brightest thing in the view through it, so the eye stopped in the doorway
  // instead of going on into the Echo; the one past the Silence was warmer
  // than the Silence's own last lamp.
  for (const [i, j, k, strength] of [[0, 0, 2, 1], [0, 0, 5, 0.5], [1, -1, 5, 1], [2, -2, 5, 0.4]]) {
    lamp(hallMid(i, j, k), { y: 46, strength, pool: 0.34 * strength, poolSize: 130, r: 5 });
  }

  // IV — the Vertigo: a round pit, a stair winding down a funnel of books to one light.
  const PIT = cellC(3, -3);
  let pitCore = null;
  let stairAt = null;
  let drift = null;   // the loose pages falling down the well, moved by tick
  {
    const c = PIT, rWall = 101, rMouth = 68;
    // The face of the bookcase that lines the room, 12 in front of the wall.
    const rFace = rWall - 12;
    // The way in is a hallway like every other: stone to either hand, the
    // gallery's arch over it, and a dressed face where it meets the room. That
    // face stands where a gallery's inner wall does, `A` from the centre, which
    // is where the bookcase's front crosses the hallway's walls — so the
    // passage goes on through the depth of the shelves, and the bookcase stops
    // at a stone pier either side of it, cut radially at `jambA`.
    //
    // It stopped at the wall behind the books. Every ring of shelving ran
    // straight across the doorway — the lowest a wooden step at the shins, the
    // others planks barring the opening at head height and above — and the
    // arch, built as deep as a gallery's wall is thick, stood out past the
    // stone into the room with its pilasters free in front of the books.
    const jambA = Math.acos(A / rFace) / deg;
    // The wall round the pit, between its round mouth and the edge of the cell,
    // cut through by the one hallway in — so it is not a ring at all but a C,
    // and is built as one. (As a ring with a keyhole in it, the keyhole had to
    // stop short of the cell's edge, and the stone it stopped short by stood
    // across the hallway: see wallRing.)
    const pitWall = (() => {
      const axis = 150;
      const local = (along, across) => add(add(c, dir(axis), along), dir(axis + 90), across);
      const pts = [];
      for (let s = 0; s <= 80; s++) pts.push(add(c, dir(axis + jambA + ((360 - 2 * jambA) * s) / 80), rWall));
      pts.push(add(c, dir(axis - jambA), rFace));
      pts.push(local(A, -HALL / 2));
      pts.push(local(AC, -HALL / 2));
      for (let k = 0; k < 6; k++) pts.push(add(c, dir(axis - 30 - 60 * k), RC));
      pts.push(local(AC, HALL / 2));
      pts.push(local(A, HALL / 2));
      pts.push(add(c, dir(axis + jambA), rFace));
      return pts;
    })();
    // A ring of the bookcase, open across the doorway.
    const caseArc = (r) => Array.from({ length: 81 }, (_, s) => add(c, dir(150 + jambA + ((360 - 2 * jambA) * s) / 80), r));
    const caseRing = [...caseArc(rWall), ...caseArc(rFace).reverse()];
    LB.mass.add(slabGeo(pitWall, [], MASS_H, 0));
    LB.cap.add(slabGeo(pitWall, [], CAP, MASS_H));
    {
      const ring = [];
      for (let s = 0; s <= 72; s++) {
        const a = (360 * s) / 72;
        if (Math.abs(((a - 150 + 540) % 360) - 180) < 16) { ring.push(null); continue; }
        ring.push(add(c, dir(a), rWall + 3.5));
      }
      ring.forEach((p, s) => { if (p && ring[s + 1]) railRun(p, ring[s + 1]); });
    }
    LB.floor.add(slabGeo(hexPts(c, RC), [circlePts(c, rMouth, 80)], 6, 0));
    // the bronze rim, open where the stair begins its way down
    for (let s = 0; s < 80; s++) {
      const a0 = (360 * s) / 80, a1 = (360 * (s + 1)) / 80;
      if (a1 > 156 && a0 < 184) continue;
      LB.bronze.add(boxGeo(add(c, dir(a0), rMouth + 1.3), add(c, dir(a1), rMouth + 1.3), 9, 2.6, 6));
    }
    LB.inlay.add(slabGeo(circlePts(c, rMouth + 17, 80), [circlePts(c, rMouth + 14.5, 80)], 0.6, 6));
    // Pale vellum and calf near the rim, dark leather down the throat, so the
    // funnel falls away in value before any lamp says how deep it is. Chosen
    // by where a book stands rather than drawn: every draw here belongs to the
    // garden (see `resume`), and the draws the old colours made are still made.
    const funnelColor = (p, y) => {
      const h = Math.abs(Math.sin(p[0] * 12.9898 + p[1] * 78.233 + y * 3.137) * 43758.5453) % 1;
      const deep = Math.min(1, Math.max(0, (6 - y) / 240));
      const odds = [
        ['#a89a7b', '#9d8f70', '#b0a283', 0.26 * (1 - deep) ** 2],
        ['#8a6341', '#7d5738', '#6f4c31', 0.42 - 0.12 * deep],
        ['#5a2923', '#662e25', '#4f2420', 0.12 + 0.06 * deep],
        ['#2d3a2b', '#333d29', '#283426', 0.1 + 0.05 * deep],
        ['#221d19', '#2a241f', '#1e1a17', 0.1 + 0.25 * deep],
      ];
      const total = odds.reduce((n, o) => n + o[3], 0);
      let r = h * total;
      for (const o of odds) { r -= o[3]; if (r <= 0) return o[Math.floor(h * 997) % 3]; }
      return odds[1][0];
    };
    for (let tier = 0; tier < TIERS; tier++) {
      const y = TIER_BASE + tier * TIER_H;
      LB.shelf.add(slabGeo(caseRing, [], 2.4, y - 2.4));
      for (let s = 0; s < 170; s++) {
        const a = (360 * s) / 170, off = Math.abs(((a - 150 + 540) % 360) - 180);
        if (off < 12) continue;
        if (paintings && tier < 3 && Math.abs(((a - 270 + 540) % 360) - 180) < 26) continue;
        const p = add(c, dir(a), rWall - 5.5), hh = rr(12, TIER_H - 3), w = rr(2.6, 3.6), color = pick(BOOKS);
        // The books where the doorway's piers now stand are still drawn: the
        // garden is laid out from the same stream (see `resume`).
        if (off < jambA + 1.3) continue;
        books.push({ p: [p[0], y + hh / 2, p[1]], rot: [0, -(a + 90) * deg, 0], s: [w, hh, 9], color: color && funnelColor(p, y) });
      }
    }
    // ── The funnel ──
    // Below the floor the pit narrows 460 down to a throat of light, lined the
    // whole way with shelves set back into its stone. The stair winds down the
    // face of them on a carved carriage bracketed into the wall, its open side
    // railed in bronze — but for the one place, a few steps down, where the rail
    // has given way and the fall begins. Lamps hang in the well at every depth,
    // so that looking down there is something to measure the drop by, and loose
    // pages turn slowly all the way down it. (A smooth brown cone with a disc of
    // light at the bottom had nothing in it to say how far down the light was.)
    //
    // All of this draws on the world's random stream far more than the plainer
    // funnel did, and the garden is laid out from that same stream: `resume`
    // puts the stream back where the old funnel left it (see the end).
    const resume = seed;
    const DEPTH = 460, NECK = 10, RECESS = 12, DROP = 440;
    const STEPS = light ? 120 : 210, TURNS = 3.8;
    const GAP = [0.047, 0.078];   // where the rail is gone (the Vertigo's stand is at 0.06)
    const coneR = (y) => rMouth + (NECK - rMouth) * ((6 - y) / DEPTH);   // the face of the shelves at a height
    const treadW = (t) => 15 * (1 - t * 0.55);
    const bearing = (t) => 170 + t * TURNS * 360;
    const inner = (t) => coneR(4 - t * DROP) - treadW(t) - 1;           // the stair's open edge
    const facing = (a) => Math.PI / 2 - a * deg;                         // turns a box's +z out along bearing a
    // where the stair is, a fraction `t` of the way down: its tread, its bearing, its open edge
    stairAt = (t) => {
      const y = 4 - t * DROP, w = treadW(t);
      return { p: add(c, dir(bearing(t)), coneR(y) - w / 2 - 1), tread: y + 1.5, a: bearing(t), edge: inner(t) };
    };
    const carved = new Batch(Std({
      map: again(pale.map, 1), normalMap: again(pale.normalMap, 1), roughnessMap: again(pale.roughnessMap, 1),
      color: '#b3a796', roughness: 1, side: THREE.DoubleSide,
    }));

    // the dark wood at the back of the shelves
    const back = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(rMouth + RECESS, NECK + RECESS, DEPTH, light ? 48 : 96, 1, true)),
      Std({ map: withRepeat(wood.map, [36, 26]), color: '#4a3a2e', roughness: 1, side: THREE.BackSide }),
    );
    back.position.set(c[0], 6 - DEPTH / 2, c[1]);
    back.receiveShadow = true;
    root.add(back);
    // uprights down the slope of the funnel between the bays
    const UPRIGHTS = light ? 12 : 18, slope = Math.atan((rMouth - NECK) / DEPTH), uprightAt = [];
    for (let k = 0; k < UPRIGHTS; k++) {
      const a = (360 * k) / UPRIGHTS + 7, yMid = 6 - DEPTH / 2, p = add(c, dir(a), coneR(yMid) + RECESS / 2);
      uprightAt.push(a);
      LB.shelf.add(new THREE.BoxGeometry(2.6, DEPTH / Math.cos(slope), RECESS).rotateX(slope).rotateY(facing(a)).translate(p[0], yMid, p[1]));
    }
    // a shelf every tier, and its books
    for (let k = 0; (k + 1) * TIER_H < 6 + DROP; k++) {
      const y = 6 - (k + 1) * TIER_H, face = coneR(y), n = light ? 40 : 80;
      LB.shelf.add(slabGeo(circlePts(c, face + RECESS + 0.5, n), [circlePts(c, face - 0.6, n)], 2.4, y - 2.4));
      const rs = face + 5.3;
      for (let u = rr(0, 3); u < 2 * Math.PI * rs - 3;) {
        const w = rr(2.3, 4.4), a = (u + w / 2) / rs / deg;
        const clear = !uprightAt.some((ua) => Math.abs(((a - ua + 540) % 360) - 180) * deg * rs < 1.5 + w / 2);
        if (clear && rnd() > 0.035) {
          const hh = rr(11, k === 0 ? 13 : 17.5), p = add(c, dir(a), rs);
          books.push({ p: [p[0], y + hh / 2, p[1]], rot: [0, -(a + 90) * deg, rnd() < 0.05 ? rr(-0.25, 0.25) : 0], s: [w, hh, 9], color: pick(BOOKS) && funnelColor(p, y), k: rr(0.7, 1.05) });
        }
        u += w + rr(0.12, 0.8);
      }
    }

    // the treads, a sconce every so often on the wall string, books left on the steps
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS, y = 4 - t * DROP, rf = coneR(y), a = bearing(t), w = treadW(t);
      const len = ((2 * Math.PI * (rf - w / 2) * TURNS) / STEPS) * 1.08;
      LB.step.add(placed(new THREE.BoxGeometry(w, 3, Math.max(1.5, len)), add(c, dir(a), rf - w / 2 - 1), y, -a * deg));
      if (s % Math.round(STEPS / 12) === 5) {
        const la = a + 1, lp = add(c, dir(la), rf - 3.4), stem = add(c, dir(la), rf - 0.9);
        LB.bronze.add(rodGeo([stem[0], y + 5, stem[1]], [stem[0], y + 14.2, stem[1]], 0.32));
        LB.bronze.add(rodGeo([stem[0], y + 14, stem[1]], [lp[0], y + 13.4, lp[1]], 0.28));
        LB.bronze.add(placed(new THREE.CylinderGeometry(0.6, 1.25, 1, 12), lp, y + 13.2));
        globes.push({ p: [lp[0], y + 11.2, lp[1]], s: [1.5, 1.5, 1.5], color: '#fff3e2', k: 1.2 });
        halo(lp, y + 11, 28, '#ffb866', 0.34);
        point(lp, y + 11, '#ffb866', 3400, -1);
      }
      if (s > 2 && s % 7 === 3 && rnd() < 0.5) {
        const bp = add(c, dir(a + rr(-1, 1)), rf - 4.2 * (1 - t * 0.35)), yaw = -a * deg + rr(-0.35, 0.35);
        for (let n = 0, top = y + 1.5, count = 1 + Math.floor(rnd() * 3); n < count; n++) {
          const th = rr(1.1, 1.9);
          books.push({ p: [bp[0], top + th / 2, bp[1]], rot: [0, yaw + rr(-0.2, 0.2), Math.PI / 2], s: [th, rr(5, 7) * (1 - t * 0.3), rr(3.6, 4.6)],
            // lying down, a book shows its cover in the bindings' dark side tone:
            // shelf leather there read as a hole in the stair, so paler calf
            color: pick(['#8a6a48', '#7a5c40', '#6e5a44', '#5f6452', '#7a4a3a']), k: rr(0.9, 1.2) });
          top += th;
        }
      }
    }

    // A profile in (radius, height), swept down the stair from t0 to t1; `cap`
    // closes its top end, where the stair leaves the floor.
    const sweep = (profileAt, t0, t1, cap = false, uvScale = 36) => {
      const samples = Math.max(2, Math.ceil((t1 - t0) * STEPS * 3)), n = profileAt(t0).length;
      const pos = [], uv = [], index = [];
      let run = 0, last = null;
      for (let i = 0; i <= samples; i++) {
        const t = t0 + ((t1 - t0) * i) / samples, prof = profileAt(t), [ux, uz] = dir(bearing(t));
        const spot = [c[0] + ux * prof[0][0], prof[0][1], c[1] + uz * prof[0][0]];
        if (last) run += Math.hypot(spot[0] - last[0], spot[1] - last[1], spot[2] - last[2]);
        last = spot;
        for (let k = 0, around = 0; k < n; k++) {
          const [r0, y0] = prof[k], [r1, y1] = prof[(k + 1) % n], edgeLen = Math.hypot(r1 - r0, y1 - y0);
          pos.push(c[0] + ux * r0, y0, c[1] + uz * r0, c[0] + ux * r1, y1, c[1] + uz * r1);
          uv.push(run / uvScale, around / uvScale, run / uvScale, (around + edgeLen) / uvScale);
          around += edgeLen;
        }
      }
      for (let i = 0; i < samples; i++) {
        for (let k = 0; k < n; k++) {
          const a = (i * n + k) * 2, b = a + n * 2;
          index.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(index);
      g.computeVertexNormals();
      if (!cap) return g;
      const [ux, uz] = dir(bearing(t0));
      const end = new THREE.ShapeGeometry(new THREE.Shape(profileAt(t0).map(([r, y]) => new THREE.Vector2(r, y))));
      const ep = end.attributes.position, eu = end.attributes.uv;
      for (let i = 0; i < ep.count; i++) {
        const r = ep.getX(i), y = ep.getY(i);
        ep.setXYZ(i, c[0] + ux * r, y, c[1] + uz * r);
        eu.setXY(i, r / uvScale, y / uvScale);
      }
      end.computeVertexNormals();
      const merged = mergeGeometries([g.toNonIndexed(), end.toNonIndexed()], false);
      g.dispose();
      end.dispose();
      return merged;
    };
    const yAt = (t) => 4 - t * DROP;
    // the carriage: a closed string on the open side standing proud of the treads,
    // and a soffit under them sloping up into the wall
    carved.add(sweep((t) => {
      const y = yAt(t), rw = coneR(y), ri = inner(t);
      return [[ri - 1.8, y + 2.2], [ri - 1.8, y - 8], [ri + 3, y - 9], [rw - 0.4, y - 4.5], [rw - 0.4, y - 2.6], [ri + 0.6, y - 2.6], [ri + 0.6, y + 2.2]];
    }, 0, 1, true));
    // A roll moulding along the top of the open string and a fillet under it:
    // the edge the eye crosses first, looking down, was a plain square arris.
    carved.add(sweep((t) => {
      const y = yAt(t) + 2.3, rc = inner(t) - 1.25;
      return Array.from({ length: 10 }, (_, k) => [rc + Math.cos((k * Math.PI) / 5) * 1.15, y + Math.sin((k * Math.PI) / 5) * 1.0]);
    }, 0, 1));
    carved.add(sweep((t) => {
      const y = yAt(t), ri = inner(t);
      return [[ri - 2.35, y - 0.5], [ri - 2.35, y - 1.7], [ri - 1.8, y - 1.7], [ri - 1.8, y - 0.5]];
    }, 0, 1));
    // the wall string, where the treads meet the shelves
    carved.add(sweep((t) => {
      const y = yAt(t), rw = coneR(y);
      return [[rw - 1.5, y + 4.8], [rw - 1.5, y - 3.2], [rw + 0.9, y - 3.2], [rw + 0.9, y + 4.8]];
    }, 0, 1, true));
    // corbels under the carriage, into the wall
    for (let k = 1; k < (light ? 18 : 34); k++) {
      const t = k / (light ? 18 : 34), y = yAt(t), rw = coneR(y), a = bearing(t);
      for (const [depth, h, top, wide] of [[5, 6, -4.2, 3.2], [3, 4, -10, 2.6]]) {
        const p = add(c, dir(a), rw + 0.5 - depth / 2);
        carved.add(new THREE.BoxGeometry(wide, h, depth).rotateY(facing(a)).translate(p[0], y + top - h / 2, p[1]));
      }
    }
    // a newel where the stair leaves the floor
    {
      const p = add(c, dir(bearing(0)), inner(0) - 0.6);
      carved.add(placed(new THREE.CylinderGeometry(2, 2.6, 21, 12), p, 6.5));
      LB.bronze.add(placed(new THREE.SphereGeometry(2, 14, 10), p, 18.6));
    }
    // the handrail and its balusters, spaced by distance along the open edge
    const rail = (t) => Array.from({ length: 6 }, (_, k) => [inner(t) - 0.9 + Math.cos((k * Math.PI) / 3) * 0.6, yAt(t) + 12 + Math.sin((k * Math.PI) / 3) * 0.6]);
    LB.bronze.add(sweep(rail, 0, GAP[0]));
    LB.bronze.add(sweep(rail, GAP[1], 1));
    const railAt = (t, lift, inset = 0) => { const p = add(c, dir(bearing(t)), inner(t) - 0.9 - inset); return [p[0], yAt(t) + lift, p[1]]; };
    for (let s = 1, samples = STEPS * 4, since = 4.5; s <= samples; s++) {
      const t = s / samples, dt = 1 / samples;
      since += Math.hypot((2 * Math.PI * inner(t) * TURNS) * dt, DROP * dt);
      if (since < 4.5 || (t > GAP[0] && t < GAP[1])) continue;
      since = 0;
      balusters.push({ p: railAt(t, 2.2), s: [0.6, 1.55, 0.6] });
    }
    // Where it gave way the rail just stops, a knob on each end. (A rail torn
    // down into the gap, a baluster knocked askew and the sockets of the lost
    // ones, a stride from the reader's eye, stood in the frame like a bronze
    // bone and a row of black holes.)
    for (const t of GAP) {
      const p = railAt(t, 12);
      LB.bronze.add(new THREE.SphereGeometry(0.95, 12, 8).translate(p[0], p[1], p[2]));
    }

    // Lamps hung in the well at every depth, well clear of the stair and of the
    // line the fall takes down the middle, their chains running up into the dark.
    const hanging = light
      ? [[20, 30, -80, 7], [290, 14, -270, 5]]
      : [[20, 30, -70, 7], [140, 22, -170, 6], [290, 14, -270, 5], [65, 9, -345, 3.5]];
    hanging.forEach(([b, off, y, r], i) => lamp(add(c, dir(b), off), {
      y, r, light: i === 0 ? 6000 : 4200, priority: -1, strength: 1.1, pool: 0, beam: false, chain: 52,
    }));

    // The light at the bottom: a hot core in the throat, the funnel's floor
    // glowing round it, light standing up the well and hanging in its air in
    // thinning layers — each sized to fade out before it meets the shelves.
    const wellTex = tex(paint(256, 256, (g) => {
      const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, '#fffaf0');
      grd.addColorStop(0.35, '#ffe2a8');
      grd.addColorStop(0.72, '#e8984e');
      grd.addColorStop(1, '#5a2e12');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
    }), [1, 1]);
    pitCore = new THREE.Mesh(keep(new THREE.CircleGeometry(NECK + RECESS + 1, 48)), keep(new THREE.MeshBasicMaterial({ map: wellTex, color: '#ffe4b4', toneMapped: false })));
    pitCore.rotation.x = -Math.PI / 2;
    pitCore.position.set(c[0], 7 - DEPTH, c[1]);
    root.add(pitCore);
    lampCores.push({ p: [c[0], -447, c[1]], s: [7, 7, 7], color: '#ffe6b8', k: 2.2 });
    halo(c, -445, 150, '#ffc680', 0.55);
    halo(c, -395, 90, '#ffb060', 0.2);
    // (the one column that stays whole with the eye inside it: the fall is down it)
    LB.shafts.add(shaftVolume(new THREE.CylinderGeometry(9, 26, 300, 28, 1, true).rotateX(Math.PI).translate(c[0], -447 + 150, c[1])));
    for (const [y, o] of [[-110, 0.04], [-190, 0.06], [-260, 0.08], [-320, 0.11], [-370, 0.15], [-410, 0.22]]) {
      decal(c, coneR(y) * 1.9, coneR(y) * 1.9, '#ffb25a', o, y, 0.08);
    }
    point(c, -425, '#ffa64a', 14000, 10, 2, [c[0], c[1], rWall + 14]);

    // loose pages, turning slowly down the well
    {
      // A page, not a card: printed, curled at its corner as well as across,
      // and lit through — paper this thin holds the lamp's light in it. As a
      // plain pale quad it was the brightest thing in the well and read as a
      // sticker on the frame.
      const leaf = keep(new THREE.PlaneGeometry(4.2, 5.6, 8, 4));
      const lp = leaf.attributes.position;
      for (let i = 0; i < lp.count; i++) {
        const x = lp.getX(i), y = lp.getY(i);
        lp.setZ(i, x ** 2 * 0.14 + x * y * 0.025 + (x > 0.8 && y > 1.2 ? (x - 0.8) * (y - 1.2) * 0.35 : 0));
      }
      leaf.computeVertexNormals();
      const pageTex = tex(paint(256, 342, (g, w, h) => {
        const pr = makeRng(611);
        g.fillStyle = '#efe6d2';
        g.fillRect(0, 0, w, h);
        for (let k = 0; k < 40; k++) {
          const x = pr() * w, y = pr() * h, r = 2 + pr() * 10;
          const fox = g.createRadialGradient(x, y, 0, x, y, r);
          fox.addColorStop(0, `rgba(150,110,60,${0.05 + pr() * 0.1})`);
          fox.addColorStop(1, 'rgba(150,110,60,0)');
          g.fillStyle = fox;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        g.fillStyle = 'rgba(52,38,24,0.55)';
        g.fillRect(w / 2 - 30, 20, 60, 3);
        for (let y = 42; y < h - 40; y += 9) {
          const para = pr() < 0.12;
          let x = 26 + (para ? 14 : 0);
          const end = w - 26 - (pr() < 0.1 ? 60 + pr() * 60 : 0);
          while (x < end) {
            const ww = 6 + pr() * 22;
            g.fillStyle = `rgba(40,30,20,${0.5 + pr() * 0.25})`;
            g.fillRect(x, y, Math.min(ww, end - x), 3);
            x += ww + 4;
          }
        }
        g.fillStyle = 'rgba(52,38,24,0.6)';
        g.fillRect(w / 2 - 6, h - 22, 12, 3);
      }), [1, 1]);
      // Twenty-two, not forty-four. Loose pages are a lovely idea and at that
      // count they were a blizzard: white flecks over every part of the frame,
      // so the well had no quiet anywhere in it.
      const pages = Array.from({ length: light ? 10 : 22 }, () => ({
        phase: rnd(), frac: rr(0.25, 0.85), spin: rr(0.12, 0.3) * (rnd() < 0.5 ? -1 : 1), fall: rr(5, 9), a0: rr(0, Math.PI * 2), tumble: rr(0.6, 1.4),
      }));
      const mesh = new THREE.InstancedMesh(leaf, Std({
        map: pageTex, color: '#d6cab4', roughness: 0.95, side: THREE.DoubleSide,
        emissive: '#8a6c48', emissiveMap: pageTex, emissiveIntensity: 0.32,
      }), pages.length);
      mesh.frustumCulled = false;
      const TOP = -10, SPAN = 420;
      const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), eu = new THREE.Euler(), at = new THREE.Vector3(), sc = new THREE.Vector3();
      drift = (time) => {
        pages.forEach((pg, i) => {
          const down = (time * pg.fall + pg.phase * SPAN) % SPAN, y = TOP - down;
          const r = pg.frac * Math.max(2, inner(Math.min(1, Math.max(0, (4 - y) / DROP))) - 2.5);
          const ang = pg.a0 + time * pg.spin + Math.sin(time * 0.7 + pg.phase * 9) * 0.3;
          at.set(c[0] + Math.cos(ang) * r, y + Math.sin(time * 1.9 + pg.phase * 20) * 1.5, c[1] + Math.sin(ang) * r);
          eu.set(Math.sin(time * pg.tumble + pg.phase * 7) * 1.1, time * pg.tumble * 0.8 + pg.phase * 6, Math.cos(time * pg.tumble * 0.9 + pg.phase * 5) * 0.9);
          // grown in at the top and gone into the light at the bottom
          sc.setScalar(Math.max(0.001, Math.min(1, down / 20, (SPAN - down) / 20)));
          mesh.setMatrixAt(i, m4.compose(at, qt.setFromEuler(eu), sc));
        });
        mesh.instanceMatrix.needsUpdate = true;
      };
      drift(0);
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
    // dust in the well's air, lit by whatever lamp it drifts near
    for (let s = 0; s < (light ? 34 : 110); s++) {
      const y = rr(-430, 80), reach = y > 6 ? 90 : Math.max(4, inner(Math.min(1, Math.max(0, (4 - y) / DROP))) - 2);
      const p = add(c, dir(rr(0, 360)), Math.sqrt(rnd()) * reach);
      dust.push({ p: [p[0], y, p[1]], s: Array(3).fill(rr(0.4, 0.9)), color: '#ffdca8', k: 0, phase: rr(0, 100) });
    }
    carved.flush('carved');

    for (const a of [40, 320]) lamp(add(c, dir(a), 84), { light: a === 40 ? 7000 : 0, priority: 4, strength: 1.2, pool: 0.26 });
    hangPainting(3, [c[0], c[1] - rWall + 3.5], 38, [0, 1], 80);
    // The old funnel took two draws a step, one for each of its twelve lamps,
    // two for its haze and four for the rim lamps; every draw advances the seed
    // by the same constant, so this is exactly where it left the stream.
    seed = (resume + Math.imul(2 * STEPS + 18, 0x6D2B79F5)) | 0;
  }

  // V — the Door: shelves on five walls; on the sixth, a way out.
  const DOOR = cellC(4, -4);
  const GATE = add(DOOR, dir(330), A);
  // ── The arch ──────────────────────────────────────────────────────────────
  // What stands in the sixth wall (portal.js). It is built in a frame of its
  // own — x along the wall (dir 60) from the middle of the breach, y up, z
  // into the room (dir 150) — and set in the wall here.
  const PORTAL_AXIS = add(GATE, dir(60), 1.5);
  const portalFrame = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(dir(60)[0], 0, dir(60)[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir(150)[0], 0, dir(150)[1]),
  ).setPosition(PORTAL_AXIS[0], 0, PORTAL_AXIS[1]);
  // a point in the arch's frame, on the ground
  const inPortal = (x, z) => add(add(PORTAL_AXIS, dir(60), x), dir(150), z);
  {
    const into = { carve: LB.carve, dressed: LB.dressed, mass: LB.mass, marble: LB.marble, bronze: LB.bronze };
    for (const [name, list] of Object.entries(buildPortal({ light }))) for (const g of list) into[name].add(g.applyMatrix4(portalFrame));
  }
  {
    const e = edgeFrame(DOOR, 5);
    // Boulders at the foot of the wall on the garden side, either side of the
    // arch. (They were the fallen wall, lying in the breach; the draws are the
    // world's stream's, so they are all still made, and only where the stone
    // is laid has changed.)
    for (let s = 0; s < 60; s++) {
      const out = rr(-6, 40), along = rr(-46, 46);
      if (Math.abs(along) < 13) continue; // a way through, for the walk
      const off = 27 + ((out + 6) / 46) * 10, sideways = Math.sign(along) * (34 + ((Math.abs(along) - 13) / 33) * 15);
      const p = add(add(GATE, e.n, off), e.t, sideways);
      rubble.push({ p: [p[0], rr(5, 12), p[1]], rot: rot3(), s: Array(3).fill(rr(2.5, 9)), color: pick(['#8a8176', '#6f675c', '#9c948a']) });
    }
    // What fell when the stone that walled the arch up gave way ("between two
    // shelves the stone gives way"), lying where it came down. Without it the
    // Door's pavement was forty per cent of the frame with nothing whatever on
    // it.
    //
    // It was then a hundred-odd chips of one size spread evenly over the lot,
    // which read as confetti. Those draws are still made (the garden is laid
    // out from the same stream) and thrown away; what the floor gets instead
    // is below, from a stream of its own.
    const ghostRubble = [];
    for (let k = 0; k < (light ? 40 : 110); k++) {
      // Nothing big close to where the reader stands: a chunk of wall at eye
      // distance reads as a boulder in the room rather than as debris.
      const into = Math.sqrt(rnd()) * 88;
      const p = add(add(GATE, e.n, -into), e.t, rr(-60, 60) * (0.35 + into / 150));
      const grit = rnd() < 0.88 || into > 55;
      ghostRubble.push({
        p: [p[0], 6 + (grit ? rr(0.1, 0.45) : rr(0.9, 2.2)), p[1]],
        rot: rot3(),
        s: grit ? [rr(0.5, 1.7), rr(0.22, 0.6), rr(0.5, 1.7)] : [rr(2.4, 5), rr(1.1, 2.4), rr(2.4, 5)],
        color: pick(['#a49a8c', '#8a8176', '#b0a698', '#79716a']),
      });
    }
    // What a wall leaves when it comes down: a few of its own blocks out in
    // front of the arch, tilted where they fell; a fan of smaller stone thrown
    // out into the room from the threshold, thinning and getting smaller as it
    // goes; grit, and a tongue of pale dust. Big pieces keep off the way
    // through, and nothing lies on the arch's own footings.
    {
      const dr = makeRng(4404), within = (a, b) => a + (b - a) * dr();
      const at = (along, into) => add(add(GATE, e.n, -into), e.t, along);
      // nothing on the footing of the arch: its jambs and piers stand out to
      // about twenty-four units into the room, either side of the threshold
      const onArch = (along, into) => Math.abs(along - 1.5) > 11.5 && into < 25;
      const clear = (along, into, size) => !onArch(along, into) && (size < 0.8 || into > 90 || Math.abs(along - 6) > 10 + size);
      for (const [along, into, w, h, d] of [[-42, 31, 11, 5.4, 7], [-24, 38, 8, 4.4, 6], [40, 38, 10, 5, 7.5], [47, 50, 7, 4, 5.5], [-50, 46, 6, 3.4, 5], [25, 46, 6.5, 3.6, 5]]) {
        const q = at(along, into);
        const g = new THREE.BoxGeometry(w, h, d).rotateX(within(-0.22, 0.22)).rotateZ(within(-0.28, 0.28)).rotateY(within(0, Math.PI * 2));
        LB.moonStone.add(g.translate(q[0], 6 + h * 0.4, q[1]));
      }
      const stone = ['#b8ae9e', '#a89f91', '#c2b9aa', '#9d9486'];
      for (let k = 0; k < 48; k++) {
        const into = 5 + dr() ** 1.25 * 72, spread = 16 + into * 0.8, along = within(-spread, spread);
        const size = 2.9 * (1 - into / 100) * (0.45 + dr() * 0.75);
        if (!clear(along, into, size)) continue;
        const q = at(along, into);
        doorRubble.push({ p: [q[0], 6 + size * 0.28, q[1]], rot: [dr() * 3, dr() * 3, dr() * 3], s: [size, size * (0.45 + dr() * 0.3), size * (0.7 + dr() * 0.5)], color: stone[Math.floor(dr() * 4)] });
      }
      for (let k = 0; k < (light ? 30 : 80); k++) {
        const into = dr() ** 1.6 * 40, along = within(-24 - into * 0.6, 24 + into * 0.6);
        const q = at(along, into), g = 0.3 + dr() * 0.6;
        if (onArch(along, into)) continue;
        doorRubble.push({ p: [q[0], 6.1, q[1]], rot: [dr() * 3, dr() * 3, dr() * 3], s: [g, g * 0.4, g], color: stone[Math.floor(dr() * 4)] });
      }
      // the dust: pale, heaviest at the breach, a tongue into the room
      const fan = new THREE.PlaneGeometry(1, 1, 8, 12).rotateX(-Math.PI / 2);
      const fp = fan.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const u = fp.getX(i), v = fp.getZ(i) + 0.5;           // v: 0 at the breach, 1 in the room
        const q = at(1.5 + u * (22 + v * 66), v * 62 - 2);
        fp.setXYZ(i, q[0], 6.13, q[1]);
      }
      fan.computeVertexNormals();
      LB.dustFan.add(fan);
    }
    // and the cracks it ran through the pavement, spreading from the gap
    for (let k = 0; k < 9; k++) {
      let q = add(GATE, e.n, -rr(4, 14)), a = 150 + rr(-58, 58);
      for (let seg = 0; seg < 5 + Math.floor(rnd() * 4); seg++) {
        const len = rr(7, 22), nq = add(q, dir(a), len);
        LB.liner.add(boxGeo(q, nq, 0.5, rr(0.5, 1.5), 5.9));
        q = nq;
        a += rr(-34, 34);
      }
    }
    // ── One volume was a gate ─────────────────────────────────────────────
    // The title of the room: the way out of the Library is a bookcase. It hung
    // at the garden end of the arch's passage, closing it to twice a reader's
    // height, and it has swung back into the passage and stands folded
    // against its left side, its shelves still full and turned to whoever goes
    // through. (Anywhere out in the opening, or at the arch's full height,
    // from the room it stood across the arch as a dark post.) It stands clear
    // of the plinth and the impost that run along the reveal.
    {
      // The leaf it replaces drew its books from the world's stream, and the
      // garden is laid out from the stream after it: the same draws, thrown away.
      for (let shelf = 0; shelf < 3; shelf++) {
        for (let u = 2.6; u < 21 - 4;) { const w = rr(2.2, 4.6); rr(9.5, 12.6); rr(6, 7.4); pick(BOOKS); rr(0.75, 1.1); u += w + rr(0.2, 0.9); }
      }
      rr(0, 6.28); pick(BOOKS);

      const { HW: hw } = PORTAL;
      const lr = makeRng(4808), within = (lo, hi) => lo + (hi - lo) * lr();
      // in the arch's frame: its back at x0, its books facing +x at x1; it runs
      // from z0 (the garden end, where it hangs) toward the room
      const x0 = -hw + 1.9, T = 2.8, x1 = x0 + T, z0 = -PORTAL.WALL + 4.8, L = 12.2, z1 = z0 + L;
      const Y0 = 6.35, H = 36;
      const spot3 = (x, y, z) => { const q = inPortal(x, z); return [q[0], y, q[1]]; };
      const piece = (xa, xb, ya, yb, za, zb, batch = LB.shelf) => batch.add(new THREE.BoxGeometry(xb - xa, yb - ya, zb - za).translate((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2).applyMatrix4(portalFrame));
      piece(x0, x0 + 0.8, Y0, H, z0, z1);                       // the back
      piece(x0, x1 + 0.3, Y0, H, z0, z0 + 1.2);                 // a stile at each end
      piece(x0, x1 + 0.3, Y0, H, z1 - 1.2, z1);
      piece(x0, x1 + 0.45, H - 1.6, H, z0 - 0.15, z1 + 0.15);   // the rail over the head, moulded
      piece(x0, x1 + 0.7, H - 2.2, H - 1.6, z0 + 1.2, z1 - 1.2);
      piece(x0, x1 + 0.3, Y0, Y0 + 1.8, z0 + 1.2, z1 - 1.2);    // the plinth
      const shelves = [Y0 + 1.8, 20.4];
      const spines = 30 * deg;   // a book's spine faces +x in this frame
      shelves.forEach((y, i) => {
        if (i) piece(x0 + 0.8, x1, y - 0.8, y, z0 + 1.2, z1 - 1.2);
        const cap = (i < shelves.length - 1 ? shelves[i + 1] - 0.8 : H - 2.2) - 0.6;
        let z = z0 + 1.35, run = 0, col = '#5f422c', hh0 = 0;
        while (z < z1 - 1.6) {
          if (run <= 0) { run = 1 + Math.floor(lr() * 5); col = ['#6f4c31', '#5a2923', '#221d19', '#8e8062', '#7d5738', '#4f2420', '#6f5f36', '#523a28'][Math.floor(lr() * 8)]; hh0 = within(9, 12.4) - i * 0.6; }
          const w = within(1.8, 3.4);
          if (z + w > z1 - 1.3) break;
          const hh = Math.min(hh0 * within(0.97, 1.03), cap - y), d = within(1.8, 2.1);
          books.push({ p: spot3(x1 - d / 2 - 0.15, y + hh / 2, z + w / 2), rot: [0, spines, 0], s: [w, hh, d], color: col, k: within(0.8, 1.05) });
          z += w + within(0.08, 0.3);
          run--;
        }
      });
      // pivots at the garden end, where it hangs, and a bronze ring to pull it by
      for (const y of [11, 23, 33]) LB.bronze.add(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 12).translate(x0 + 0.4, y, z0 - 0.35).applyMatrix4(portalFrame));
      LB.bronze.add(new THREE.TorusGeometry(1.5, 0.24, 8, 20).rotateY(Math.PI / 2).translate(x1 + 0.5, 26, z1 - 2.6).applyMatrix4(portalFrame));
      LB.bronze.add(new THREE.CylinderGeometry(0.62, 0.62, 0.7, 12).rotateZ(Math.PI / 2).translate(x1 + 0.4, 27.3, z1 - 2.6).applyMatrix4(portalFrame));
      // and the one that opened it, on the floor where it fell
      const drop = inPortal(-4, 20);
      books.push({ p: [drop[0], 7.2, drop[1]], rot: [0, 2.1, 1.57], s: [5.4, 2.4, 7.6], color: '#5a2923', k: 1.05 });
    }
    // ── The garden comes in ──────────────────────────────────────────────
    // Moss in the joints of the pavement nearest the arch; leaves blown in
    // across the floor; ivy up the garden face of the arch. The only green in
    // the Library, and it has been earned.
    {
      const gr = makeRng(5505), within = (a, b) => a + (b - a) * gr();
      const at = (along, into) => add(add(GATE, e.n, -into), e.t, along);
      // Moss, laid on the pavement's own joints: the same world-projected
      // coordinates as the floor and a texture drawn to its slab layout, so the
      // green is IN the joints. Faded out with distance from the breach.
      {
        const g = new THREE.PlaneGeometry(1, 1, 24, 12).rotateX(-Math.PI / 2);
        const pos = g.attributes.position, uv = g.attributes.uv;
        const rgba = new Float32Array(pos.count * 4);
        for (let i = 0; i < pos.count; i++) {
          const along = pos.getX(i) * 110, into = (pos.getZ(i) + 0.5) * 54 - 12;
          const q = at(along, into);
          pos.setXYZ(i, q[0], 6.15, q[1]);
          uv.setXY(i, q[0], q[1]);
          const fall = Math.max(0, 1 - Math.max(0, into) / 40) * Math.max(0, 1 - Math.abs(along) / 52);
          rgba.set([1, 1, 1, Math.min(1, fall * 1.4)], i * 4);
        }
        g.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
        g.computeVertexNormals();
        const moss = new THREE.Mesh(keep(g), M.moss);
        moss.renderOrder = 1;
        root.add(moss);
      }
      // leaves, blown in and lying where they stopped
      for (let k = 0; k < 42; k++) {
        const into = -8 + gr() ** 1.4 * 60, along = within(-26 - into * 0.5, 26 + into * 0.5);
        const q = at(along, into);
        // on the threshold stone through the arch, and none on its footings
        const x = along - 1.5, sill = Math.abs(x) < 12.6 && into < 4;
        const leaf = { p: [q[0], (sill ? 6.4 : 6.18) + gr() * 0.05, q[1]], rot: [within(-0.15, 0.15), gr() * 6.28, within(-0.15, 0.15)], s: Array(3).fill(0.9 + gr() * 0.9),
          color: ['#6b5a2c', '#7a6234', '#556030', '#5f4a28', '#48552a'][Math.floor(gr() * 5)] };
        if (Math.abs(x) > 11.5 && into < 25) continue;
        fallenLeaves.push(leaf);
      }
      // Ivy up the garden face of the arch: up the quoins and round the ring of
      // voussoirs, thickest low down and on the left (the pergola's wisteria
      // has the right), and a little way in along the reveal, where the light
      // from the garden reaches.
      const faceYaw = Math.atan2(e.n[0], e.n[1]);
      for (let k = 0; k < (light ? 20 : 38); k++) {
        const left = gr() < 0.62, x = (left ? -1 : 1) * within(13.5, 31), y = PORTAL.FLOOR + 0.5 + gr() ** 1.6 * (left ? 72 : 50);
        const tilt = within(-0.5, 0.5), sx = within(7, 12), sy = within(5, 8), deep = gr();
        if (y > PORTAL.SPR - 3 && PORTAL.soffitAt(x, 4) > y - 3) continue;   // never across the opening
        const q = inPortal(x, -PORTAL.WALL - 0.9 - deep * 0.6);
        doorIvy.push({ p: [q[0], y, q[1]], rot: [0, faceYaw, tilt], s: [sx, sy, 1] });
      }
      // And the curtain the plates hang in that doorway: green trailing down
      // from the vault at the garden end of the passage, wisteria in it, lit
      // by the moon's light coming through. Hung high — the lowest tip is
      // twice a head's height over the way through.
      for (let z = -PORTAL.WALL + 5; z < -PORTAL.WALL + 11.5; z += within(1.3, 2)) {
        for (let x = -PORTAL.HW + 0.8 + gr() * 1.2; x < PORTAL.HW - 0.8; x += within(1.1, 2)) {
          const top = PORTAL.soffitAt(x) - 0.4, wisteria = gr() < 0.3;
          const len = Math.min(top - 38 - gr() * 3, within(8, 17) + (1 - Math.abs(x) / PORTAL.HW) * within(0, 8));
          const q = inPortal(x + within(-0.3, 0.3), z + within(-0.4, 0.4));
          const yaw = gr() * Math.PI, kind = wisteria ? Math.floor(gr() * 2) : 2 + Math.floor(gr() * 2), wide = within(2.6, 3.8);
          if (len < 4) continue;
          hangs.push({ p: [q[0], top, q[1]], rot: [0, yaw, 0], s: [wide, len, 1], kind, color: wisteria ? '#e6dcec' : '#c8d6c4', k: within(0.8, 1.05) });
        }
      }
      for (let k = 0; k < (light ? 4 : 9); k++) {
        const side = k % 2 ? 1 : -1, z = -PORTAL.WALL + 1 + gr() ** 1.3 * 9, y = PORTAL.FLOOR + 1 + gr() ** 1.5 * 24;
        const q = inPortal(side * (PORTAL.HW - 0.15), z), n = dir(side < 0 ? 60 : 240);
        doorIvy.push({ p: [q[0], y, q[1]], rot: [0, Math.atan2(n[0], n[1]), within(-0.5, 0.5)], s: [within(6, 10), within(4.5, 7), 1] });
      }
    }
    // ── The green moon, through the jamb ──────────────────────────────────
    // "Hedges breathe under a green moon": the light off the garden falls
    // through the breach and lands on the pavement, which is the only thing
    // that ever happens on forty per cent of this frame.
    {
      const mid = add(DOOR, dir(330), A);
      const top = new THREE.Vector3(mid[0] + dir(330)[0] * 16, 82, mid[1] + dir(330)[1] * 16);
      const foot = new THREE.Vector3(mid[0] + dir(150)[0] * 52, 6, mid[1] + dir(150)[1] * 52);
      const axis = top.clone().sub(foot);
      const len = axis.length();
      const g = new THREE.CylinderGeometry(1, 1.5, len, 26, 1, true);
      g.scale(13, 1, 5.5);
      const yv = axis.clone().normalize();
      const xv = new THREE.Vector3(dir(60)[0], 0, dir(60)[1]).projectOnPlane(yv).normalize();
      g.applyMatrix4(new THREE.Matrix4().makeBasis(xv, yv, xv.clone().cross(yv).normalize()));
      g.translate(...top.clone().add(foot).multiplyScalar(0.5).toArray());
      const shaft = new THREE.Mesh(keep(shaftVolume(g)), keep(makeShaftMaterial('#a6edc6', 0.12)));
      shaft.renderOrder = 2;
      root.add(shaft);
    }
    // One lamp behind the reader and one in view across the gallery: the green
    // belongs BEYOND the jamb, and with the gate's light at 8000 it owned the
    // whole room and the Library stopped being warm.
    // A globe on its stand beside the reading table: furniture that is not a
    // shelf. (Put near the reader as a dark shape at the edge of the frame it
    // sat in the corner under the room's caption, pale and enormous.)
    {
      const at = alongWall(DOOR, 3).on(11, 25);
      const legs = [0, 120, 240].map((a) => {
        const foot = add([0, 0], dir(a), 3.6);
        const v0 = new THREE.Vector3(foot[0], 6, foot[1]), v1 = new THREE.Vector3(0, 11.5, 0);
        const g = new THREE.CylinderGeometry(0.28, 0.4, v0.distanceTo(v1), 8);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v1.clone().sub(v0).normalize()));
        return g.translate((v0.x + v1.x) / 2, (v0.y + v1.y) / 2, (v0.z + v1.z) / 2);
      });
      legs.push(new THREE.CylinderGeometry(0.35, 0.45, 2.4, 10).translate(0, 12.6, 0));
      legs.push(new THREE.TorusGeometry(4.35, 0.32, 6, 40).rotateX(Math.PI / 2).translate(0, 16.2, 0));
      for (const a of [0, 120, 240]) legs.push(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 6).translate(Math.cos(a * deg) * 4.35, 14.5, Math.sin(a * deg) * 4.35));
      LB.shelf.add(placed(mergeGeometries(legs), at, 0, 0.4));
      legs.forEach((g) => g.dispose());
      LB.bronze.add(placed(new THREE.TorusGeometry(3.95, 0.16, 6, 40).rotateZ(23 * deg), at, 16.2, 0.4));
      const globe = new THREE.Mesh(keep(new THREE.SphereGeometry(3.6, 36, 24)), M.globeMap);
      globe.rotation.set(0, 1.1, 23 * deg);
      globe.position.set(at[0], 16.2, at[1]);
      globe.castShadow = true;
      root.add(globe);
    }
    lamp(add(DOOR, dir(214), 46), { light: 6500, priority: 3, strength: 1.2, pool: 0.12, poolSize: 140, haze: 0.18, beam: false });
    // ── Candles at the foot of the arch ──────────────────────────────────
    // A bronze candelabrum either side, standing before the piers, as every
    // plate of this room has them: the carving is lit from below, warm, the
    // way the stone was meant to be seen, and the green comes through between.
    // (Flames only — a halo would draw on the world's stream.)
    for (const side of [-1, 1]) {
      const at = inPortal(side * 29.5, 29);
      const put = (g) => LB.bronze.add(g.translate(at[0], 0, at[1]));
      const L = (pts, seg = 18) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
      put(L([[0, 6], [3.1, 6], [3.1, 6.45], [2.5, 6.9], [1.5, 7.4], [1.0, 8.2], [0.72, 9.4], [0, 9.4]]));
      put(L([[0, 9.2], [0.5, 9.2], [0.42, 12.4], [0.95, 13.1], [0.42, 13.8], [0.38, 18.2], [0.85, 18.9], [0.4, 19.6], [0.36, 23.6], [1.05, 24.3], [0.5, 24.9], [0, 24.9]], 14));
      const flames = [[0, 27.8, 0, 3.4]];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4, c = [Math.cos(a) * 3.3, Math.sin(a) * 3.3];
        const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 23.8, 0), new THREE.Vector3(c[0] * 0.45, 22.8, c[1] * 0.45), new THREE.Vector3(c[0] * 0.9, 23.4, c[1] * 0.9), new THREE.Vector3(c[0], 25.2, c[1])]);
        put(new THREE.TubeGeometry(arm, 12, 0.24, 6, false));
        flames.push([c[0], 25.6, c[1], 2.2 + ((k * 7) % 3) * 0.55]);
      }
      for (const [x, y, z, h] of flames) {
        put(L([[0, y - 0.4], [0.95, y - 0.35], [1.0, y - 0.15], [0.45, y], [0, y]], 14).translate(x, 0, z));
        LB.paper.add(new THREE.CylinderGeometry(0.34, 0.36, h, 12).translate(at[0] + x, y + h / 2, at[1] + z));
        glows.push({ p: [at[0] + x, y + h + 0.55, at[1] + z], s: [0.3, 0.62, 0.3], color: '#ffc47a', k: 1.5 });
      }
      point(at, 27, '#ffb466', 2600, 5);
    }
    // Hung to the left of the arch rather than in front of it, where it stood
    // across the springing, and high, level with the head of the hood: from
    // there its light rakes across the orders and the gable, and every roll,
    // hollow and foil reads by it. (Hung at the springing it lit the jambs,
    // and the carving over the arch was one flat tone.)
    lamp(inPortal(-44, 38), { y: 82, light: 5200, priority: 4, strength: 1.05, pool: 0.2, poolSize: 150, haze: 0.6 });
    point(add(GATE, e.n, 14), 40, '#8ff0d4', 3800, 9);
    decal(add(GATE, e.n, -22), 150, 140, '#7ee8c8', 0.17);
  }
  const ENTRANCE = hallMid(0, 0, 2);

  instances(new THREE.BoxGeometry(1, 1, 1), M.books, books, { chunked: true, attrs: { aSpine: (it) => it.spine ?? spineAt(it.p), aGraze: (it) => it.graze ?? 0, aDust: (it) => it.dust ?? 0 } });
  instances(new THREE.TorusGeometry(0.72, 0.2, 5, 10), M.iron, links, { cast: false, chunked: true });
  instances(new THREE.LatheGeometry([
    [0, 0], [0.95, 0], [0.95, 0.35], [0.5, 0.8], [0.36, 2], [0.78, 3.2], [0.84, 3.7], [0.38, 4.6], [0.42, 5.5], [0.85, 6], [0, 6.2],
  ].map(([x, yy]) => new THREE.Vector2(x, yy)), 10), M.bronze, balusters, { chunked: true });
  instances(new THREE.SphereGeometry(1, 16, 12), M.glow, lampCores, { cast: false, receive: false, chunked: true });
  instances(new THREE.SphereGeometry(1, 20, 14), M.glass, lampShells, { cast: false, receive: false, chunked: true });
  instances(new THREE.SphereGeometry(1, 32, 20), M.globe, globes, { cast: false, receive: false, chunked: true });
  instances(new THREE.SphereGeometry(1, 32, 20), M.deadGlass, deadGlobes, { cast: false, chunked: true });
  instances(rockGeo(), M.rock, rubble, { chunked: true });
  instances(rockGeo(), M.moonRock, doorRubble, { chunked: true });
  instances(new THREE.PlaneGeometry(2.2, 1.3).rotateX(-Math.PI / 2), M.leaf, fallenLeaves, { cast: false });
  instances(new THREE.PlaneGeometry(1, 1), M.ivy, doorIvy, { cast: false });
  instances(new THREE.BoxGeometry(1, 1, 1), M.stone, posts, { chunked: true });

  // ── The garden ────────────────────────────────────────────────────────────
  const GB = {
    grass: new Batch(M.grass, { cast: false, ...P }), gravel: new Batch(M.gravel, { cast: false, ...P }),
    mazeFloor: new Batch(M.mazeFloor, { cast: false, ...P }), wood: new Batch(M.wood, P), plank: new Batch(M.plank, P),
    // the bridge's boards, each with its grain laid along it rather than projected
    deck: new Batch(M.plank),
    lacquer: new Batch(M.lacquer), gold: new Batch(M.gold), ridge: new Batch(M.ridge), stone: new Batch(M.stone, P),
    lantern: new Batch(M.lanternStone, P), paperLit: new Batch(M.lanternPaper, { cast: false, receive: false }),
    paperDead: new Batch(M.paperDead, { cast: false }), iron: new Batch(M.iron),
  };
  const rocks = [], ivy = [], fireflies = [];
  // lily leaves by kind (pond.js, PAD_KINDS), and the flowers and buds among them
  const lilies = [[], [], [], []], blooms = { white: [], pink: [], whiteBud: [], pinkBud: [] };
  const foliage = [];
  const LEAF = ['#4a6b47', '#3f5c46', '#557a52', '#38503f', '#47664a'];
  const BLOSSOM = ['#9d7683', '#b39197', '#8e6a7a'];
  const mazeRoute = [];
  let armillary = null;
  // What the finale (finale.js) needs from the maze once it has grown.
  let mazeGrid = null, mazeRects = null;
  const heartParts = {};
  // A hedge grown over a footprint (hedges.js): its body, and its sprigs drawn
  // and shadowed as the trees' leaf is — those on top on the trees' crossed
  // cards, those on a face on the three upright cards alone.
  const topSprigs = [], faceSprigs = [];
  const plantHedge = (loops, opts) => {
    if (HEDGE_DIAL === 'none') return;
    const { geometry, sprigs, litter } = growHedge(loops, { detail: HEDGE_DIAL === 'bare' ? 0 : light ? 0.5 : 1, ...opts });
    const m = new THREE.Mesh(keep(geometry), M.hedge);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'hedge';
    root.add(m);
    const floor = new THREE.Mesh(keep(litter), M.hedgeLitter);
    floor.receiveShadow = true;
    floor.renderOrder = 1;
    floor.name = 'hedge-litter';
    root.add(floor);
    for (const s of sprigs) (s.flat ? topSprigs : faceSprigs).push(s);
  };
  for (const cell of cells) if (cell.garden) GB.grass.add(slabGeo(hexPts(cell.c, RC + 0.5), [], 4, 0));

  const PERGOLA0 = add(GATE, dir(150), 10);
  const J = [1186, 236];
  const POND = { c: [1300, 118], rx: 118, rz: 90 };
  const PV = [1305, 110];
  const SHORE = [1238, 196];
  const BRIDGE = [SHORE, [1262, 186], [1252, 166], [1276, 156], [1285, 137]];
  const MZ = { x0: 1180, z0: 318, cols: 8, rows: 7, cw: 30, ch: 30 };
  const MAZE_ENTRY = [MZ.x0 + 4.5 * MZ.cw, MZ.z0];
  const HEART = [MZ.x0 + 4.5 * MZ.cw, MZ.z0 + 3.5 * MZ.ch];
  // the nine cells round the heart, cleared into one court (the world tour only)
  const COURT = { c0: 3, c1: 5, r0: 2, r1: 4 };
  const COURT_HALF = 1.5 * MZ.cw;
  const POOLS = [{ c: [1088, 482], r: 26 }, { c: [955, 150], r: 22 }];
  const PATHS = [
    { pts: [PERGOLA0, J], w: 18 },
    { pts: [J, [1216, 218], SHORE], w: 16 },
    { pts: [[1315, 212], [1311, 266], [MAZE_ENTRY[0], MAZE_ENTRY[1] - 4]], w: 14 },
    { pts: [J, [1120, 160], [1000, 88], [890, 30], [840, -40]], w: 14, fading: true },
  ];
  const segDist = (p, a, b) => {
    const vx = b[0] - a[0], vz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (vx * vx + vz * vz)));
    return dist(p, [a[0] + vx * t, a[1] + vz * t]);
  };
  const pathDist = (p) => Math.min(...PATHS.flatMap((path) => path.pts.slice(1).map((b, i) => segDist(p, path.pts[i], b))));

  for (const path of PATHS) {
    path.pts.forEach((p, i) => {
      GB.gravel.add(slabGeo(circlePts(p, path.w / 2, 20), [], 1.2, 4));
      if (i === 0) return;
      const a = path.pts[i - 1], L = dist(a, p);
      const t = [(p[0] - a[0]) / L, (p[1] - a[1]) / L], n = [-t[1], t[0]];
      GB.gravel.add(slabGeo([add(a, n, path.w / 2), add(p, n, path.w / 2), add(p, n, -path.w / 2), add(a, n, -path.w / 2)], [], 1.2, 4));
      for (let u = 0; u < L; u += 7) {
        for (const side of [-1, 1]) {
          if (path.fading && rnd() < 0.5) continue;
          const rp = add(add(a, t, u + rr(-2, 2)), n, side * (path.w / 2 + rr(0, 1.5)));
          rocks.push({ p: [rp[0], 5, rp[1]], rot: rot3(), s: [rr(1.2, 2.3), rr(0.8, 1.6), rr(1.2, 2.3)], color: pick(['#5f5b55', '#4e4b46', '#6b665f']) });
        }
      }
    });
  }

  // ── The wisteria pergola, hung with lanterns ─────────────────────────────
  // What the arch opens onto, and what walks the reader from it to the Fork.
  // It was six-sided posts, square beams and a flat card of leaves laid over
  // the top — the rough frame that stood in the old breach as the Door's only
  // arch. Now joinery: each post an octagon on a stone base, a bearing block
  // on its head, a tie beam across with its ends cut to a cloud, curved
  // braces up to the beam and along to the purlins, rafters across the top
  // and battens along them — and the wisteria not painted on a card but
  // hanging, a raceme at a time, from the rafters it has taken over, with the
  // old vines it climbed by twisted up four of the posts. Four paper lanterns
  // in the bays, ribbed and capped.
  //
  // Laid out in its own frame — x across, y up, z along from the Door toward
  // the Fork — and set on the path here. None of it draws on the world's
  // stream but the four halos, which always did.
  {
    const a = PATHS[0].pts[0], b = J, L = dist(a, b);
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const frame = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(t[1], 0, -t[0]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(t[0], 0, t[1]),
    ).setPosition(a[0], 0, a[1]);
    const W3 = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(frame);
    const wood = (g) => GB.wood.add(g.applyMatrix4(frame));
    const stone = (g) => GB.stone.add(g.applyMatrix4(frame));
    const lacq = (g) => GB.lacquer.add(g.applyMatrix4(frame));
    const gold = (g) => GB.gold.add(g.applyMatrix4(frame));
    const bx = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    // a side profile [[across, y]] run along z for w, or [[along, y]] run across x for w
    const alongZ = (pts, z0, w) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: w, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, z0);
    const alongX = (pts, x0, w) => alongZ(pts.map(([u, y]) => [-u, y]), 0, w).rotateY(Math.PI / 2).translate(x0, 0, 0);
    const pr = makeRng(6606), within = (lo, hi) => lo + (hi - lo) * pr();
    const Z0 = 40, BAY = 22, FRAMES = [0, 1, 2, 3, 4].map((k) => Z0 + k * BAY).filter((z) => z < L + 1);
    const POST = 17, SPAN = 25, GROUND = 5.2;
    const TIE = [39.4, 42.8], PURLIN = [TIE[1], TIE[1] + 2.6], RAFTER = [PURLIN[1], PURLIN[1] + 1.3];
    const zA = Z0 - 6, zB = FRAMES[FRAMES.length - 1] + 6;
    // A curved brace from (u0, y0) — on the post — up to (u1, y1), under a
    // beam: a band of timber a quarter-circle round, drawn in its own plane.
    const braceShape = (u0, y0, u1, y1, w = 1.25) => {
      // a quarter ellipse about the open corner (u1, y0), and a second one w
      // further out; both ends run into the timber they join
      const rx = Math.abs(u1 - u0), ry = y1 - y0, s = Math.sign(u1 - u0), n = 12;
      const inner = [], outer = [];
      for (let k = 0; k <= n; k++) {
        const th = (k / n) * (Math.PI / 2);
        inner.push([u1 - s * rx * Math.cos(th), y0 + ry * Math.sin(th)]);
        outer.push([u1 - s * (rx + w) * Math.cos(th), y0 + (ry + w) * Math.sin(th)]);
      }
      return [...inner, ...outer.reverse()];
    };
    for (const z of FRAMES) {
      for (const side of [-1, 1]) {
        const x = side * POST;
        // the base: a stone plinth, chamfered, and a drum
        stone(bx(x - 2.5, x + 2.5, GROUND - 0.4, GROUND + 1.2, z - 2.5, z + 2.5));
        stone(bx(x - 2.1, x + 2.1, GROUND + 1.2, GROUND + 1.9, z - 2.1, z + 2.1));
        stone(new THREE.LatheGeometry([[0, 0], [1.95, 0], [1.95, 0.3], [1.7, 0.8], [1.62, 1.4], [0, 1.4]].map(([r, y]) => new THREE.Vector2(r, y)), 16).translate(x, GROUND + 1.9, z));
        // the post, an octagon, with a collar where the brackets take it
        wood(new THREE.CylinderGeometry(1.35, 1.45, TIE[0] - 1.3 - (GROUND + 3.3), 8).rotateY(Math.PI / 8).translate(x, (TIE[0] - 1.3 + GROUND + 3.3) / 2, z));
        wood(new THREE.CylinderGeometry(1.62, 1.62, 0.6, 8).rotateY(Math.PI / 8).translate(x, 31.2, z));
        wood(bx(x - 1.9, x + 1.9, TIE[0] - 1.3, TIE[0], z - 1.9, z + 1.9));
        // braces: along the pergola up to the purlin, both ways, and across up to the tie beam
        for (const way of [-1, 1]) {
          if ((way < 0 && z === FRAMES[0]) || (way > 0 && z === FRAMES[FRAMES.length - 1])) continue;
          wood(alongX(braceShape(z + way * 1.2, 31.6, z + way * 8.5, PURLIN[0]), x - 0.62, 1.25));
        }
        wood(alongZ(braceShape(x - side * 1.2, 32.4, x - side * 7.5, TIE[0]), z - 0.6, 1.2));
      }
      // the tie beam, its ends cut to a cloud beyond the posts
      const cloud = (s) => {
        const pts = [];
        for (let k = 0; k <= 12; k++) {
          const f = k / 12;
          pts.push([s * (POST + 1.6 + f * (SPAN - POST - 1.6)), TIE[0] + 1.9 * (0.5 - 0.5 * Math.cos(Math.PI * f)) - 0.35 * Math.sin(Math.PI * 2 * f)]);
        }
        return pts;
      };
      wood(alongZ([...cloud(-1).reverse(), ...cloud(1), [SPAN, TIE[1] - 0.5], [SPAN - 0.5, TIE[1]], [-SPAN + 0.5, TIE[1]], [-SPAN, TIE[1] - 0.5]], z - 1.25, 2.5));
    }
    // the purlins along the heads of the posts, their ends cut the same way
    for (const side of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 10; k++) { const f = k / 10; pts.push([zA + f * 5.5, PURLIN[0] + 1.6 * (0.5 + 0.5 * Math.cos(Math.PI * f))]); }
      for (let k = 0; k <= 10; k++) { const f = k / 10; pts.push([zB - 5.5 + f * 5.5, PURLIN[0] + 1.6 * (0.5 - 0.5 * Math.cos(Math.PI * f))]); }
      pts.push([zB, PURLIN[1]], [zA, PURLIN[1]]);
      wood(alongX(pts, side * POST - 1.1, 2.2));
    }
    // rafters across the top, their ends splayed, and battens along them
    const rafters = [];
    for (let z = zA + 1.5; z <= zB - 1; z += 3.3) {
      rafters.push(z);
      wood(alongZ([[-SPAN + 1.2, RAFTER[0]], [SPAN - 1.2, RAFTER[0]], [SPAN + 0.6, RAFTER[1]], [-SPAN - 0.6, RAFTER[1]]], z - 0.5, 1));
    }
    for (const x of [-20.5, -12, -4, 4, 12, 20.5]) wood(bx(x - 0.4, x + 0.4, RAFTER[1], RAFTER[1] + 0.7, zA + 0.5, zB - 0.5));
    // old vines up four of the posts, twisted round them and over onto the top
    for (const [x, z, turns] of [[-POST, FRAMES[0], 2.2], [POST, FRAMES[1], 1.8], [-POST, FRAMES[2], 2.5], [POST, FRAMES[3], 2]]) {
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const f = k / 40, ang = f * turns * Math.PI * 2 + x * 0.1, r = 1.9 + Math.sin(f * 9) * 0.2;
        pts.push(new THREE.Vector3(x + Math.cos(ang) * r, GROUND + 1 + f * (RAFTER[1] - GROUND - 0.4), z + Math.sin(ang) * r));
      }
      for (let k = 1; k <= 8; k++) pts.push(new THREE.Vector3(x + Math.sin(k) * 0.8, RAFTER[1] + 0.6 + Math.sin(k * 1.7) * 0.3, z + k * 2.6 * (x < 0 ? 1 : -1)));
      wood(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), light ? 40 : 90, 0.3, 6, false));
    }
    // The wisteria: a raceme from the rafters every couple of units, longest
    // at the sides and short over the path, so the way through is a tunnel of
    // flowers that clears the head; leaves in with them; and leaf over the top.
    for (const z of rafters) {
      for (let x = -SPAN + 2 + pr() * 1.5; x < SPAN - 2; x += within(1.6, 2.8)) {
        const edge = Math.min(1, Math.abs(x) / POST), green = pr() < 0.28;
        const len = (green ? within(6, 12) : within(5, 9)) + edge * edge * within(4, 9);
        const q = W3(x + within(-0.4, 0.4), RAFTER[0] + 0.1, z + within(-0.6, 0.6));
        const yaw = pr() * Math.PI, wide = green ? within(3, 4.2) : within(2.8, 3.8), kind = green ? 2 + Math.floor(pr() * 2) : Math.floor(pr() * 2), k = within(0.85, 1.1);
        if (RAFTER[0] - len < 30 + (1 - edge) * 4) continue;
        hangs.push({ p: [q.x, q.y, q.z], rot: [0, yaw, 0], s: [wide, len, 1], kind, color: green ? '#c4d0c0' : '#e6dcec', k });
      }
    }
    for (let z = zA + 2; z < zB - 2; z += within(3.5, 5)) {
      for (const x of [-18, -9, 0, 9, 18]) {
        const skip = pr() < 0.25;
        const q = W3(x + within(-3, 3), RAFTER[1] + within(1.2, 2.4), z);
        const item = { p: [q.x, q.y, q.z], rot: [within(-0.2, 0.2), pr() * 6.28, within(-0.2, 0.2)], s: Array(3).fill(within(6, 9.5)), color: LEAF[Math.floor(pr() * LEAF.length)], k: within(0.55, 0.8) };
        if (!skip) foliage.push(item);
      }
    }
    // The lanterns: round paper globes on cords, a fine bamboo rib every so
    // often round them, a lacquered cap and foot, and a short silk tassel.
    for (const z of [51, 73, 95, 117]) {
      const LY = 29.5, R = 2.6, H = 2.75, p = W3(0, LY, z);
      glows.push({ p: [p.x, p.y, p.z], s: [R, H, R], color: '#ffb86e', k: 1.15 });
      for (let k = -3; k <= 3; k++) {
        const yy = (k / 3.6) * H, r = R * Math.sqrt(Math.max(0, 1 - (yy / H) ** 2)) + 0.03;
        lacq(new THREE.TorusGeometry(r, 0.045, 4, 32).rotateX(Math.PI / 2).translate(0, LY + yy, z));
      }
      lacq(new THREE.CylinderGeometry(0.9, 1.25, 0.55, 18).translate(0, LY + H - 0.05, z));
      lacq(new THREE.CylinderGeometry(1.25, 0.95, 0.5, 18).translate(0, LY - H + 0.05, z));
      gold(new THREE.CylinderGeometry(0.28, 0.4, 0.45, 10).translate(0, LY + H + 0.45, z));
      wood(new THREE.CylinderGeometry(0.08, 0.08, RAFTER[0] - LY - H - 0.6, 5).translate(0, (RAFTER[0] + LY + H + 0.6) / 2, z));
      gold(new THREE.SphereGeometry(0.28, 10, 8).translate(0, LY - H - 0.55, z));
      lacq(new THREE.CylinderGeometry(0.18, 0.34, 2.1, 10).translate(0, LY - H - 1.8, z));
      halo([p.x, p.z], LY, 40, '#ffb866', 0.35);
    }
    point(add(a, t, 64), 25, '#ffb866', 4200, 6);
    decal(lerp2(a, b, 0.5), 220, 130, '#ffae5c', 0.24, 5.8, 0.12);
  }

  // ── Lanterns ─────────────────────────────────────────────────────────────
  // Tōrō of the Kasuga kind: a six-sided foot under a ring of lotus petals
  // turned down; a round post with a knot at its middle; a platform on petals
  // turned up; the fire box, a paper window front and back and the sun and the
  // moon cut through two more of its sides; a wide six-sided roof whose
  // corners curl up like young fern; and the jewel on top. They were a box, a
  // post and a pyramid, with a glowing egg sitting ON the roof and nothing but
  // air where the fire belongs — a lamp turned inside out. The light is inside
  // now, behind paper, and falls first on the lantern's own stone (flameLit).
  //
  // Each is built about its own axis (y is the world's) with face 0 of every
  // hexagon at 30° and a corner at 0°, as three's six-sided cylinders have
  // them, then turned and set down. None of it draws on the world's stream
  // but the halo and the pool, which always did.
  const HEX = Math.PI / 3;
  const V2 = (x, y) => new THREE.Vector2(x, y);
  // A sheet of quads from fn(u, v) → [x, y, z], u and v 0 to 1; `flip` turns it over.
  const sheet = (fn, nu, nv, flip = false) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { pos.push(...fn(i / nu, j / nv)); uv.push(i / nu, j / nv); }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = i * (nv + 1) + j, b = a + nv + 1;
        if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1);
        else idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const lathe = (prof, n) => new THREE.LatheGeometry(prof.map(([r, y]) => V2(r, y)), n);
  // Lotus petals turned on a lathe: `prof` is [r, y, w] from the bottom up, w
  // how far out toward the petals' free edge that ring lies (0 at the root),
  // so the petals part at their tips and are one stone at the root.
  const petalLathe = (prof, petals, depth, per = 6) => {
    const n = petals * Math.max(4, Math.round(per * detail));
    const g = lathe(prof, n), pos = g.attributes.position, np = prof.length;
    for (let i = 0; i <= n; i++) {
      const lobe = Math.sqrt(Math.abs(Math.cos((i / n) * Math.PI * petals)));
      for (let j = 0; j < np; j++) {
        const k = i * np + j, s = 1 - depth * prof[j][2] * (1 - lobe);
        pos.setX(k, pos.getX(k) * s);
        pos.setZ(k, pos.getZ(k) * s);
      }
    }
    g.computeVertexNormals();
    return g;
  };
  // A side of a six-sided box, `w` wide and `t` thick, with what is cut
  // through it; laid with its outer face at z = 0, for `onFace` to set on face k.
  const panel = (w, y0, y1, t, holes = []) => {
    const s = new THREE.Shape([V2(-w / 2, y0), V2(w / 2, y0), V2(w / 2, y1), V2(-w / 2, y1)]);
    s.holes.push(...holes);
    return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: light ? 8 : 16 }).translate(0, 0, -t);
  };
  const onFace = (g, k, R) => {
    const a = (k + 0.5) * HEX, apo = R * Math.cos(HEX / 2);
    return g.rotateY(a).translate(Math.sin(a) * apo, 0, Math.cos(a) * apo);
  };
  // The moon: a disc with a second, offset disc taken out of it.
  const crescent = (cx, cy, r1, ox, oy, r2, n = 18) => {
    const d = Math.hypot(ox, oy), beta = Math.atan2(oy, ox);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const g1 = Math.acos(a / r1), g2 = Math.acos((d - a) / r2);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const th = beta + g1 + (2 * Math.PI - 2 * g1) * (i / n);
      pts.push(V2(cx + r1 * Math.cos(th), cy + r1 * Math.sin(th)));
    }
    for (let i = 1; i < n; i++) {
      const th = beta + Math.PI + g2 - 2 * g2 * (i / n);
      pts.push(V2(cx + ox + r2 * Math.cos(th), cy + oy + r2 * Math.sin(th)));
    }
    return new THREE.Path(pts);
  };
  // A six-sided roof: R to its corners at the eave; the underside of the eave
  // at y0 mid-side, T thick there; rising H, hollowed, to a ring of radius
  // `top`; the corners lifted by `lift`, and the underside meeting the box it
  // sits on at `seat`. One sheet per slope, so the hips stay sharp.
  const hexRoof = ({ R, y0, T, H, lift, top, seat, nu = 10, nv = 8 }) => {
    const geos = [];
    for (let k = 0; k < 6; k++) {
      const at = (u) => {
        const phi = (k + u) * HEX;
        return { s: Math.sin(phi), c: Math.cos(phi), r: R * Math.cos(HEX / 2) / Math.cos((u - 0.5) * HEX), up: lift * Math.abs(2 * u - 1) ** 7 };
      };
      geos.push(sheet((u, t) => {
        const a = at(u), r = a.r + (top - a.r) * t;
        return [a.s * r, y0 + T + H * (0.45 * t + 0.55 * t * t) + a.up * (1 - t) ** 2.5, a.c * r];
      }, nu, nv));
      geos.push(sheet((u, v) => { const a = at(u); return [a.s * a.r, y0 + a.up + T * v, a.c * a.r]; }, nu, 1));
      geos.push(sheet((u, t) => {
        const a = at(u), r = a.r + (seat - a.r) * t;
        return [a.s * r, y0 + a.up * (1 - t) ** 2.5 + 0.25 * t, a.c * r];
      }, nu, 4, true));
    }
    return geos;
  };
  // Its hips: a rolled ridge down each, and at each corner the fern — a
  // scroll rising off the tip and rolling back in on itself, tighter as it
  // goes (a ring of even radius left a hole through it and read as a handle).
  const roofCorners = ({ R, y0, T, H, lift, top }, rho, tube, ridge) => {
    const geos = [];
    for (let k = 0; k < 6; k++) {
      const phi = k * HEX, s = Math.sin(phi), c = Math.cos(phi), pts = [];
      for (let j = 0; j <= 10; j++) {
        const t = 0.04 + 0.9 * (j / 10), r = R + (top - R) * t;
        pts.push(new THREE.Vector3(s * r, y0 + T + H * (0.45 * t + 0.55 * t * t) + lift * (1 - t) ** 2.5 + ridge * 0.5, c * r));
      }
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, ridge, 5, false));
      const out = R - rho * 0.6, curl = [];
      for (let j = 0; j <= 16; j++) {
        const f = j / 16, th = -Math.PI / 2 + f * Math.PI * 2.1, r = rho * (1 - 0.62 * f);
        curl.push(new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, 0));
      }
      const eye = [s * out, y0 + T + lift + rho * 0.55, c * out];
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curl), 20, tube, 6, false).rotateY(phi - Math.PI / 2).translate(...eye));
      geos.push(new THREE.SphereGeometry(tube * 0.9, 8, 6).translate(...eye));
    }
    return geos;
  };
  // Paper with a flame behind it: brightest and palest nearest the flame,
  // deepening to amber and dimming toward its edges, as a shōji does. In
  // vertex colours, so the sheet is cut fine enough to carry the fall-off.
  const paperHot = new THREE.Color('#ffd9a4'), paperEdge = new THREE.Color('#ff9f55'), paperC = new THREE.Color();
  const litPaper = (geo, flame, near, strength) => {
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const f = Math.min(1.25, ((near * near) / v.fromBufferAttribute(pos, i).distanceToSquared(flame)) ** 1.4);
      paperC.copy(paperEdge).lerp(paperHot, Math.min(1, f)).multiplyScalar(strength * (0.28 + 1.1 * f));
      col.set([paperC.r, paperC.g, paperC.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  };

  // `face`: what the windows look toward.
  const toro = (p, lit, face) => {
    const yaw = Math.atan2(face[0] - p[0], face[1] - p[1]) - HEX / 2;
    const flame = new THREE.Vector3(p[0], 20.5, p[1]), axis = [Math.sin(yaw + HEX / 2), Math.cos(yaw + HEX / 2)];
    const set = (g) => g.rotateY(yaw).translate(p[0], 0, p[1]);
    const stone = (g) => {
      set(g);
      const n = g.attributes.position.count, f = [flame.x, flame.y, flame.z, lit ? 13 : 0];
      g.setAttribute('aFlame', new THREE.BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => f[i % 4]), 4));
      g.setAttribute('aFlameAxis', new THREE.BufferAttribute(Float32Array.from({ length: n * 2 }, (_, i) => axis[i % 2]), 2));
      GB.lantern.add(g);
    };
    const round = Math.round(20 * detail);
    // the foot
    stone(new THREE.CylinderGeometry(4.0, 4.15, 2.9, 6).translate(0, 5.05, 0));
    stone(new THREE.CylinderGeometry(3.75, 3.95, 0.35, 6).translate(0, 6.675, 0));
    stone(petalLathe([[3.55, 6.8, 1], [3.5, 7.1, 0.95], [3.2, 7.55, 0.75], [2.65, 8.0, 0.45], [2.05, 8.35, 0.15], [1.7, 8.55, 0], [1.45, 8.6, 0]], 12, 0.2));
    // the post, with the knot at its middle
    stone(new THREE.CylinderGeometry(1.28, 1.42, 7.8, round).translate(0, 12.4, 0));
    stone(new THREE.CylinderGeometry(1.58, 1.58, 0.55, round).translate(0, 12.3, 0));
    for (const y of [11.8, 12.8]) stone(new THREE.TorusGeometry(1.45, 0.16, 6, round).rotateX(Math.PI / 2).translate(0, y, 0));
    // the platform, on petals turned up
    stone(petalLathe([[1.25, 16.1, 0], [1.6, 16.35, 0.1], [2.3, 16.8, 0.4], [2.95, 17.35, 0.75], [3.3, 17.85, 0.95], [3.25, 18.05, 1]], 12, 0.22));
    stone(new THREE.CylinderGeometry(3.45, 3.6, 0.85, 6).translate(0, 18.45, 0));
    stone(new THREE.CylinderGeometry(3.05, 3.3, 0.3, 6).translate(0, 19.0, 0));
    // The fire box. Windows on faces 0 and 3, the sun through face 1 and the
    // moon through face 4, and on the last two a panel carved in low relief.
    const FB = [19.15, 23.25], RB = 2.65, TH = 0.38, WIN = [-0.78, 0.78, 19.75, 22.6], SUN = 21.55;
    for (let k = 0; k < 6; k++) {
      const holes = k % 3 === 0 ? [new THREE.Path([V2(WIN[0], WIN[2]), V2(WIN[1], WIN[2]), V2(WIN[1], WIN[3]), V2(WIN[0], WIN[3])])]
        : k === 1 ? [new THREE.Path().absarc(0, SUN, 0.56, 0, Math.PI * 2, false)]
          : k === 4 ? [crescent(0, SUN, 0.6, 0.22, 0.12, 0.56)] : [];
      stone(onFace(panel(RB, FB[0], FB[1], TH, holes), k, RB));
      if (k === 2 || k === 5) {
        for (const g of [
          new THREE.BoxGeometry(0.16, 3.36, 0.1).translate(-0.86, 21.2, 0.05), new THREE.BoxGeometry(0.16, 3.36, 0.1).translate(0.86, 21.2, 0.05),
          new THREE.BoxGeometry(1.88, 0.16, 0.1).translate(0, 19.6, 0.05), new THREE.BoxGeometry(1.88, 0.16, 0.1).translate(0, 22.8, 0.05),
        ]) stone(onFace(g, k, RB));
      }
      stone(new THREE.CylinderGeometry(0.3, 0.3, FB[1] - FB[0], 8).translate(Math.sin(k * HEX) * RB, (FB[0] + FB[1]) / 2, Math.cos(k * HEX) * RB));
    }
    stone(new THREE.CylinderGeometry(RB + 0.28, RB + 0.2, 0.4, 6).translate(0, FB[1] + 0.2, 0));
    // what the light comes through: paper behind every opening, and a shōji
    // in each window — its frame, and the lattice across it
    const near = RB * Math.cos(HEX / 2) - TH - 0.02;
    const paper = (g, k) => {
      set(onFace(g.translate(0, 0, -TH - 0.02), k, RB));
      if (lit) GB.paperLit.add(litPaper(g, flame, near, 0.8));
      else GB.paperDead.add(g);
    };
    for (const k of [0, 3]) {
      paper(new THREE.PlaneGeometry(1.9, 3.1, 4, 8).translate(0, (WIN[2] + WIN[3]) / 2, 0), k);
      const mid = (WIN[2] + WIN[3]) / 2, h = WIN[3] - WIN[2], w = WIN[1] - WIN[0], z = -TH + 0.09;
      for (const g of [
        new THREE.BoxGeometry(0.13, h, 0.14).translate(WIN[0] + 0.065, mid, z), new THREE.BoxGeometry(0.13, h, 0.14).translate(WIN[1] - 0.065, mid, z),
        new THREE.BoxGeometry(w, 0.13, 0.14).translate(0, WIN[2] + 0.065, z), new THREE.BoxGeometry(w, 0.13, 0.14).translate(0, WIN[3] - 0.065, z),
        ...[-0.22, 0.22].map((u) => new THREE.BoxGeometry(0.06, h, 0.08).translate(u, mid, z)),
        ...[1, 2, 3].map((j) => new THREE.BoxGeometry(w, 0.06, 0.08).translate(0, WIN[2] + (h * j) / 4, z)),
      ]) GB.wood.add(set(onFace(g, k, RB)));
    }
    for (const k of [1, 4]) paper(new THREE.PlaneGeometry(1.5, 1.5, 3, 3).translate(0, SUN, 0), k);
    // the roof, and the jewel on it
    const roof = { R: 5.5, y0: 23.35, T: 0.72, H: 2.35, lift: 0.4, top: 1.15, seat: 2.95 };
    hexRoof({ ...roof, nu: light ? 5 : 10, nv: light ? 4 : 8 }).forEach(stone);
    roofCorners(roof, 0.32, 0.2, 0.2).forEach(stone);
    const yT = roof.y0 + roof.T + roof.H, b = yT + 0.95;
    stone(lathe([[0, yT - 0.35], [1.32, yT - 0.35], [1.38, yT + 0.05], [1.25, yT + 0.4], [0.95, yT + 0.55], [0, yT + 0.55]], round));
    stone(petalLathe([[0.55, yT + 0.5, 0], [0.8, yT + 0.72, 0.35], [1.02, yT + 1.0, 0.8], [1.05, yT + 1.12, 1]], 8, 0.25));
    stone(lathe([[0, b], [0.42, b], [0.72, b + 0.22], [0.9, b + 0.55], [0.88, b + 0.88], [0.72, b + 1.2], [0.48, b + 1.5], [0.26, b + 1.78], [0.1, b + 2.0], [0, b + 2.15]], round));
    if (lit) {
      waterLamps.push({ p: [p[0], 21, p[1]], color: '#ffcd86', k: 1.1 });
      halo(p, 21.2, 18, '#ffc070', 0.14, lampHaloTex);
      // the light it lays on the ground, out of its windows
      const pool = decal(p, 100, 76, '#ffb462', 0.3, 5.3, 0.14);
      pool.material.map = lanternPoolTex;
      pool.rotation.y = yaw + HEX / 2 - Math.PI / 2;
    }
  };
  toro([1206, 252], true, J);
  toro([1262, 222], true, SHORE);
  toro([1342, 262], true, [1311, 266]);
  toro([1290, 292], true, [1311, 266]);
  toro([1098, 140], false, J);
  toro([1030, 60], false, J);

  // Hedges either side of the way out, close enough to be seen through the
  // breach: "beyond the jamb, hedges breathe under a green moon".
  {
    const along = unit2(GATE, J), across = [along[1], -along[0]];
    for (const side of [-1, 1]) {
      const a = add(add(GATE, along, 20), across, side * 21);
      const b = add(add(GATE, along, 108), across, side * 21);
      plantHedge([stripLoop(a, b, 9)], { ground: 4, H: 17, seed: side < 0 ? 21 : 22 });
    }
  }

  // VI — the Fork: where the road divides, a stone waymark with a board for each
  // way (with `paintings`, a painted screen facing the pergola).
  if (!paintings) {
    // The waymark stands dead centre of the Fork's view and was the palest
    // thing in the garden: a bare post with two boards. It carries the lantern
    // now — a fork in a path at night is somewhere someone hung a light.
    const at = add(J, dir(279), 30);
    GB.stone.add(placed(new THREE.BoxGeometry(5.6, 3.2, 5.6), at, 4, 12 * deg));
    GB.stone.add(placed(new THREE.BoxGeometry(4.6, 1.6, 4.6), at, 6.4, 12 * deg));
    GB.stone.add(placed(new THREE.BoxGeometry(3.6, 22, 3.6), at, 4 + 11, 12 * deg));
    GB.stone.add(placed(new THREE.BoxGeometry(4.8, 1.4, 4.8), at, 25.5, 12 * deg));
    GB.stone.add(placed(new THREE.ConeGeometry(3.3, 3.4, 4), at, 27.9, 57 * deg));
    [[[1216, 218], 20.5], [[1120, 160], 16.5]].forEach(([to, y]) => {
      const u = [to[0] - at[0], to[1] - at[1]], L = Math.hypot(u[0], u[1]);
      GB.wood.add(boxGeo(add(at, u, 1.5 / L), add(at, u, 12 / L), 2.4, 0.6, y));
      GB.wood.add(boxGeo(add(at, u, 3 / L), add(at, u, 9 / L), 0.8, 0.5, y - 1.1));
    });
    // An iron bracket off the post, braced, and hung from it a tsuri-dōrō: a
    // six-sided iron lantern, a lattice round paper, under a roof of its own.
    // It was two gilt discs with a glowing egg between them.
    const arm = dir(196);
    GB.iron.add(boxGeo(add(at, arm, 1.6), add(at, arm, 8), 0.5, 0.5, 24.4));
    {
      const a = add(at, arm, 1.9), b = add(at, arm, 5.4);
      GB.iron.add(rodGeo([a[0], 20.6, a[1]], [b[0], 24.5, b[1]], 0.16));
    }
    {
      const lp = add(at, arm, 7.6), flame = new THREE.Vector3(lp[0], 20.6, lp[1]);
      const yaw = Math.atan2(arm[0], arm[1]);
      const iron = (g) => GB.iron.add(g.rotateY(yaw).translate(lp[0], 0, lp[1]));
      iron(new THREE.TorusGeometry(0.32, 0.07, 6, 14).translate(0, 24.1, 0));
      iron(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6).translate(0, 23.45, 0));
      const roof = { R: 1.75, y0: 22.05, T: 0.14, H: 0.8, lift: 0.26, top: 0.2, seat: 1.0 };
      hexRoof({ ...roof, nu: light ? 3 : 6, nv: 4 }).forEach(iron);
      roofCorners(roof, 0.13, 0.055, 0.06).forEach(iron);
      iron(new THREE.SphereGeometry(0.27, 10, 8).translate(0, roof.y0 + roof.T + roof.H + 0.1, 0));
      const RB = 1.1, Y = [19.3, 22.05], h = Y[1] - Y[0], mid = (Y[0] + Y[1]) / 2;
      iron(new THREE.CylinderGeometry(RB + 0.14, RB - 0.05, 0.28, 6).translate(0, Y[0] - 0.1, 0));
      iron(new THREE.CylinderGeometry(RB + 0.1, RB + 0.1, 0.16, 6).translate(0, Y[1] - 0.02, 0));
      iron(new THREE.ConeGeometry(0.22, 0.7, 6).rotateX(Math.PI).translate(0, Y[0] - 0.6, 0));
      for (let k = 0; k < 6; k++) {
        iron(new THREE.CylinderGeometry(0.07, 0.07, h, 5).translate(Math.sin(k * HEX) * RB, mid, Math.cos(k * HEX) * RB));
        for (const g of [
          ...[-0.18, 0.18].map((u) => new THREE.BoxGeometry(0.05, h, 0.05).translate(u, mid, 0.01)),
          ...[1, 2].map((j) => new THREE.BoxGeometry(RB, 0.05, 0.05).translate(0, Y[0] + (h * j) / 3, 0.01)),
        ]) iron(onFace(g, k, RB));
        const sheetG = onFace(new THREE.PlaneGeometry(RB - 0.06, h, 2, 6).translate(0, mid, -0.06), k, RB).rotateY(yaw).translate(lp[0], 0, lp[1]);
        GB.paperLit.add(litPaper(sheetG, flame, RB * Math.cos(HEX / 2) - 0.06, 0.75));
      }
      waterLamps.push({ p: [lp[0], 20.6, lp[1]], color: '#ffc077', k: 1.1 });
      halo(lp, 20.6, 16, '#ffbc70', 0.14, lampHaloTex);
      // (900 when it was an egg of light: it blew the post beside it out to white)
      point(lp, 20.4, '#ffb866', 180, 4);
      decal(lp, 62, 62, '#ffb462', 0.11, 5.3, 0.12);
    }
  } else {
    const at = add(J, dir(279), 30), facing = dir(151);
    const width = 58, height = width / (3376 / 1440);
    const angle = Math.atan2(facing[0], facing[1]);
    const side = dir(151 + 90);
    for (const s of [-1, 1]) GB.wood.add(placed(new THREE.CylinderGeometry(1.6, 1.8, height + 16, 6), add(at, side, s * (width / 2 + 2)), (height + 16) / 2 + 4));
    const panel = new THREE.BoxGeometry(width + 4, height + 4, 2);
    panel.rotateY(angle);
    panel.translate(at[0], 12 + height / 2, at[1]);
    GB.lacquer.add(panel);
    const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
    const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
    const front = add(at, facing, 1.1);
    plane.position.set(front[0], 12 + height / 2, front[1]);
    plane.rotation.y = angle;
    root.add(plane);
    mounts[5] = { center: [front[0], 12 + height / 2, front[1]], normal: facing, width, height, material: mat };
  }

  // pools of stars in the garden: the pond, and two small ones with stone rims
  const teal = [];
  {
    const { c, rx, rz } = POND;
    const edge = Array.from({ length: 110 }, (_, k) => {
      const a = (k / 110) * Math.PI * 2;
      const wob = 1 + Math.sin(a * 3 + 1) * 0.04 + Math.sin(a * 7) * 0.02;
      return [c[0] + Math.cos(a) * rx * wob, c[1] + Math.sin(a) * rz * wob];
    });
    const pond = water.surface(new THREE.Mesh(keep(slabGeo(edge, [], 0.3, WATER_Y - 0.3)), keep(water.material(POND))));
    pond.name = 'water';
    pond.receiveShadow = true;
    pond.renderOrder = 2;
    root.add(pond);
    edge.forEach((p, k) => {
      if (k % 2) return;
      rocks.push({ p: [p[0] + rr(-2, 2), 6, p[1] + rr(-2, 2)], rot: rot3(), s: [rr(3.5, 7.5), rr(2.5, 4.5), rr(3.5, 7.5)], color: pick(['#5e5952', '#504c46', '#68635b', '#46423d']) });
    });
    const inPond = (p, m = 1) => ((p[0] - c[0]) / (rx * m)) ** 2 + ((p[1] - c[1]) / (rz * m)) ** 2 < 1;
    const nearBridge = (p) => BRIDGE.slice(1).some((b, i) => segDist(p, BRIDGE[i], b) < 13);
    // The pads, flowers and fish used to be drawn here from the world's stream,
    // and the Pavilion, the mist and the maze are laid out from what they left
    // of it. They have a stream of their own now; this spends the world's
    // exactly as they did, so the maze is still the maze it was.
    {
      let pads = 0;
      for (let s = 0; s < 300 && pads < 20; s++) {
        const p = [c[0] + rr(-rx, rx), c[1] + rr(-rz, rz)];
        if (!inPond(p, 0.9) || inPond(p, 0.55) || dist(p, PV) < 48 || nearBridge(p)) continue;
        pads++;
        for (let k = 0; k < 3; k++) rnd();
        if (rnd() < 0.4) for (let k = 0; k < 6; k++) rnd();
      }
      let fish = 0;
      for (let s = 0; s < 300 && fish < 7; s++) {
        const p = [c[0] + rr(-rx, rx), c[1] + rr(-rz, rz)];
        if (!inPond(p, 0.8) || dist(p, PV) < 46 || nearBridge(p)) continue;
        fish++;
        rnd();
      }
    }
    // Lilies grow in colonies off one rhizome — a clump of big leaves with
    // young ones between them, a flower or two among them, a bud coming up —
    // never as an even scatter. A leaf is 17 to 60 cm across (a unit is 9.4 cm)
    // and lies ON the water, just clear of where the koi are drawn (pond.js).
    const lr = makeRng(7331), lrr = (a, b) => a + (b - a) * lr();
    const leaves = [];
    const colony = (at, spread, count, inside, flowers) => {
      let placed = 0;
      for (let s = 0; s < count * 40 && placed < count; s++) {
        const a = lrr(0, Math.PI * 2), d = spread * Math.sqrt(lr());
        const p = [at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d];
        const young = lr() < 0.3;
        const r = young ? lrr(0.9, 1.6) : lrr(1.8, 3.2);
        // crowded, but a leaf never lies across another
        if (!inside(p, r) || leaves.some((q) => dist(p, q.p) < (r + q.r) * 0.92)) continue;
        leaves.push({ p, r });
        const kind = young ? 0 : lr() < 0.22 ? 3 : lr() < 0.45 ? 2 : 1;
        lilies[kind].push({
          p: [p[0], WATER_Y + 0.12 + (placed % 4) * 0.025, p[1]], rot: [0, lrr(0, Math.PI * 2), 0], s: [r, r, r],
          color: ['#ffffff', '#eef2e2', '#e3e9d2', '#f5efdd'][Math.floor(lr() * 4)],
        });
        placed++;
      }
      const scheme = lr() < 0.5 ? 'white' : 'pink';
      for (let k = 0, s = 0; k < flowers && s < 40; s++) {
        const a = lrr(0, Math.PI * 2), d = spread * 0.75 * Math.sqrt(lr());
        const p = [at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d];
        if (!inside(p, 1.6)) continue;
        k++;
        if (lr() < 0.35) {
          const b = lrr(1.0, 1.4);
          blooms[`${scheme}Bud`].push({ p: [p[0], WATER_Y + 0.05, p[1]], rot: [lrr(-0.25, 0.25), lrr(0, Math.PI * 2), lrr(-0.25, 0.25)], s: [b, b, b] });
        } else {
          const b = lrr(1.1, 1.5);
          blooms[scheme].push({ p: [p[0], WATER_Y + 0.26, p[1]], rot: [lrr(-0.07, 0.07), lrr(0, Math.PI * 2), lrr(-0.07, 0.07)], s: [b, b, b], color: ['#ffffff', '#f1ede6'][Math.floor(lr() * 2)] });
        }
      }
    };
    const inOpen = (p, r) => inPond(p, 0.9) && dist(p, PV) > 50 + r && !nearBridge(p);
    const colonies = [];
    for (let s = 0; s < 400 && colonies.length < 8; s++) {
      const at = [c[0] + lrr(-rx, rx), c[1] + lrr(-rz, rz)];
      if (!inPond(at, 0.84) || inPond(at, 0.5) || dist(at, PV) < 58 || nearBridge(at) || colonies.some((q) => dist(at, q) < 34)) continue;
      colonies.push(at);
      colony(at, lrr(7, 13), Math.floor(lrr(7, 14)), inOpen, Math.floor(lrr(1, 3.99)));
    }
    // The fish, on loops round the Pavilion and in patches of their own.
    const school = makeKoi({ pond: POND, time: wind, gather: lerp2(BRIDGE[1], BRIDGE[2], 0.6), clear: (p) => inPond(p, 0.84) && dist(p, PV) > 52 });
    keep(school.geometry);
    keep(school.material);
    root.add(water.surface(school.mesh));
    for (const pool of POOLS) {
      // a small clump in each rimmed pool, off to one side of it
      const side = lrr(0, Math.PI * 2);
      colony([pool.c[0] + Math.cos(side) * pool.r * 0.4, pool.c[1] + Math.sin(side) * pool.r * 0.4], pool.r * 0.4, 5,
        (p, r) => dist(p, pool.c) < pool.r - r - 1.5, 1);
    }
    for (const pool of POOLS) {
      GB.stone.add(slabGeo(circlePts(pool.c, pool.r + 5, 40), [circlePts(pool.c, pool.r, 40)], 9, 0));
      // In the same surface as the pond, to the unit: one plane, one mirror.
      const w = water.surface(new THREE.Mesh(keep(slabGeo(circlePts(pool.c, pool.r, 40), [], 0.3, WATER_Y - 0.3)), keep(water.material({ c: pool.c, rx: pool.r, rz: pool.r }))));
      w.name = 'water';
      w.renderOrder = 2;
      root.add(w);
      teal.push(pool);
    }

    // ── VII — the Pavilion ────────────────────────────────────────────────
    // An octagon standing in the water. All of it is laid out from two numbers
    // — the angle of a bay and a radius — so the parts agree with each other
    // instead of each being placed by hand: the hips of both roofs run down the
    // column lines, the bracket sets stand over the columns and over the middle
    // of every bay, the rafters land on the purlins they cross, and the gap in
    // the balustrade is the bay the bridge actually arrives at.
    const DECK = 12, HEAD = 46, R_COL = 26;
    const bay = (k) => 22.5 + k * 45;
    const on = (a, r) => add(PV, dir(a), r);
    // A piece in a bay's own frame: +x runs out from the middle of the
    // pavilion, +z along the eave, and `out` is measured from the column line.
    // (rotateY carries +x to (cos, −sin), so the angle it wants is the negative
    // of the one everything else here is written in.)
    const inBay = (a, out, along, y, w, h, d) => placed(
      new THREE.BoxGeometry(w, h, d), add(on(a, R_COL + out), dir(a + 90), along), y, -a * deg,
    );
    // Both tiers of roof are lathes turned from one curve — flat at the eave,
    // lifting to the ridge — and `soffit` IS that curve. Everything that has to
    // fit under the roof asks it where the roof is rather than guessing, which
    // is how the old rafters came to hang five units below it in open air.
    const TIERS = [{ r: 52, h: 17, y: 44 }, { r: 29, h: 15, y: 58 }];
    const soffit = (t, r) => t.y + t.h * (1 - Math.min(1, Math.max(0, r) / t.r) ** 2.4);
    // and the way OUT of that surface at radius r, for laying a ridge along it
    const outward = (t, r) => {
      const y0 = soffit(t, r - 0.4), y1 = soffit(t, r + 0.4);
      const L = Math.hypot(0.8, y1 - y0) || 1;
      return [(y0 - y1) / L, 0.8 / L];
    };

    // ── The deck ──────────────────────────────────────────────────────────
    // A stone foot standing in the water, boards over it, and a moulded lip
    // between the two: a slab with one straight edge reads as a table top.
    GB.stone.add(placed(new THREE.CylinderGeometry(33.4, 35.2, 7.2, 8), PV, 5.4, 22.5 * deg));
    GB.wood.add(placed(new THREE.CylinderGeometry(31, 33, 6, 8), PV, 9, 22.5 * deg));
    GB.lacquer.add(placed(new THREE.CylinderGeometry(33.4, 32.1, 1.4, 8), PV, 11.4, 22.5 * deg));

    // ── Columns, balustrade, and the seat along it ────────────────────────
    // The bay the bridge lands in is left open — worked out from where the
    // bridge actually ends rather than written down, because it was written
    // down once and it was the wrong bay.
    const arrival = Math.floor((((Math.atan2(BRIDGE[4][1] - PV[1], BRIDGE[4][0] - PV[0]) / deg) + 337.5) % 360) / 45);
    for (let k = 0; k < 8; k++) {
      const a0 = bay(k), a1 = bay(k + 1), p = on(a0, R_COL);
      // a stone plinth, a shaft tapered the way a timber one is, a gilt collar
      GB.stone.add(placed(new THREE.CylinderGeometry(2.9, 3.5, 2.6, 8), p, DECK + 1.3));
      GB.lacquer.add(placed(new THREE.CylinderGeometry(1.45, 1.9, HEAD - DECK - 2.6, 12), p, (DECK + 2.6 + HEAD) / 2));
      GB.gold.add(placed(new THREE.CylinderGeometry(1.8, 1.8, 0.45, 12), p, HEAD - 4.4));

      if (k === arrival) continue;
      const c0 = on(a0, 30), c1 = on(a1, 30);
      GB.lacquer.add(boxGeo(c0, c1, 1.1, 2.1, DECK + 0.5));                 // bottom rail
      GB.lacquer.add(boxGeo(c0, c1, 1.5, 3.2, 16.4));                       // handrail
      for (let i = 1; i < 8; i++) {                                         // balusters
        GB.lacquer.add(placed(new THREE.BoxGeometry(0.75, 3.0, 0.75), lerp2(c0, c1, i / 8), 15.0, -a0 * deg));
      }
      // the seat that makes a pavilion somewhere to sit and not only to pass
      // through — a board inside the rail, on stubby brackets, stopping short
      // of the columns the way a bench between two posts has to
      const b0 = on(a0, 28.5), b1 = on(a1, 28.5);
      const s0 = lerp2(b0, b1, 0.13), s1 = lerp2(b0, b1, 0.87);
      GB.wood.add(boxGeo(s0, s1, 0.9, 5.4, 15.2));
      for (const t of [0.15, 0.5, 0.85]) {
        GB.wood.add(placed(new THREE.BoxGeometry(2.2, 2.6, 1.1), lerp2(s0, s1, t), 13.9, -((a0 + a1) / 2) * deg));
      }
    }
    // a low threshold board where the bridge comes aboard
    GB.plank.add(placed(new THREE.BoxGeometry(4, 1.2, 15), on(bay(arrival) + 22.5, 29.5), 12.4, -(bay(arrival) + 22.5) * deg));

    // ── The head of each bay: architrave, tie beam, openwork ──────────────
    for (let k = 0; k < 8; k++) {
      const a0 = bay(k), a1 = bay(k + 1), mid = (a0 + a1) / 2;
      const c0 = on(a0, R_COL), c1 = on(a1, R_COL);
      GB.lacquer.add(boxGeo(c0, c1, 3.0, 2.3, HEAD - 3.0));                 // the beam the brackets stand on
      GB.wood.add(boxGeo(c0, c1, 1.5, 1.9, HEAD - 9.2));                    // the tie under it
      // and hanging between the two, the openwork a pavilion of this kind
      // always carries: a comb of turned bars, a rail across them, and a brace
      // into each column, so that the top of a bay is not a rectangle of air.
      for (let i = 1; i < 9; i++) {
        GB.wood.add(placed(new THREE.BoxGeometry(0.6, 4.6, 0.6), lerp2(c0, c1, i / 9), HEAD - 5.5, -mid * deg));
      }
      GB.wood.add(boxGeo(c0, c1, 0.55, 0.55, HEAD - 5.2));
      for (const [from, to] of [[0.02, 0.16], [0.98, 0.84]]) {
        const f = lerp2(c0, c1, from), t = lerp2(c0, c1, to);
        GB.wood.add(rodGeo([f[0], HEAD - 3.6, f[1]], [t[0], HEAD - 7.6, t[1]], 0.6));
      }
    }

    // ── The bracket sets ──────────────────────────────────────────────────
    // Dougong: the stepped timber clusters that carry an eave out well past the
    // columns holding it up, and the one detail that says a roof of this kind
    // was built rather than draped over the top. Two tiers of crossed arms on
    // bearing blocks, over every column AND over the middle of every bay — and
    // each tier steps out only as far as the soffit above still has room for.
    const dougong = (a) => {
      GB.wood.add(inBay(a, 0, 0, HEAD + 0.9, 4.4, 1.8, 4.4));
      let y = HEAD + 1.8;
      // Sixteen clusters round a 26-unit circle leaves about ten units of arc
      // each at the first tier and thirteen at the second; arms longer than
      // that run into the neighbouring cluster and the whole band reads as
      // spilled bricks rather than as joinery.
      for (const [span, back, reach] of [[8.5, 3.0, 4.5], [12.0, 2.0, 8.0]]) {
        GB.wood.add(inBay(a, (reach - back) / 2, 0, y + 0.8, reach + back, 1.6, 2.2));
        GB.wood.add(inBay(a, reach - 3.0, 0, y + 0.8, 2.2, 1.6, span));
        for (const [out, along] of [[reach - 3.0, span / 2 - 1.5], [reach - 3.0, 1.5 - span / 2], [reach - 1.3, 0], [1.3 - back, 0]]) {
          GB.wood.add(inBay(a, out, along, y + 2.15, 2.3, 1.1, 2.3));
        }
        y += 2.7;
      }
      // the gilt eye on the front of the cluster, which is all a bracket ever
      // shows of itself from across the water
      GB.gold.add(inBay(a, 8.3, 0, HEAD + 5.3, 0.9, 1.7, 2.8));
    };
    for (let k = 0; k < 8; k++) { dougong(bay(k)); dougong(bay(k) + 22.5); }
    // the purlin the brackets were put there to hold, and the beam behind them
    for (let k = 0; k < 8; k++) {
      GB.wood.add(boxGeo(on(bay(k), 33), on(bay(k + 1), 33), 1.7, 2.0, HEAD + 6.6));
      GB.lacquer.add(boxGeo(on(bay(k), R_COL), on(bay(k + 1), R_COL), 1.5, 1.8, HEAD + 5.6));
    }

    // ── The ceiling and the eave ──────────────────────────────────────────
    // Rafters laid ON the soffit curve rather than chorded under it — sixteen
    // the whole way from the eave to the boss, and sixteen more that carry only
    // the eave, because an eave is where a roof of this kind is most closely
    // ribbed and the eave is the half of it a reader standing under it sees.
    for (let k = 0; k < 32; k++) {
      const a = 22.5 + k * 11.25, full = k % 2 === 0;
      let last = null;
      for (const r of full ? [50, 43, 36, 29, 21, 13, 6, 0] : [50, 44, 38, 33]) {
        const p = on(a, r), here = [p[0], soffit(TIERS[0], r) - 1.4, p[1]];
        if (last) GB.wood.add(rodGeo(last, here, full ? 0.85 : 0.6));
        last = here;
      }
    }
    for (const r of [33, 21]) {
      for (let k = 0; k < 16; k++) {
        GB.wood.add(boxGeo(on(22.5 + k * 22.5, r), on(45 + k * 22.5, r), 1.4, 1.6, soffit(TIERS[0], r) - 3.5));
      }
    }
    {
      const apex = soffit(TIERS[0], 0);
      GB.lacquer.add(placed(new THREE.CylinderGeometry(5.2, 3.2, 1.6, 16), PV, apex - 1.4));
      GB.gold.add(placed(new THREE.CylinderGeometry(2.6, 1.3, 1.3, 16), PV, apex - 2.8));
      GB.gold.add(placed(new THREE.SphereGeometry(1.1, 10, 8), PV, apex - 4.0));
    }

    // ── The eaves ─────────────────────────────────────────────────────────
    for (let k = 0; k < 8; k++) {
      const a = bay(k), lp = on(a, 52);
      // a paper lantern at the eave: lacquered cap and base round the light
      GB.gold.add(placed(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 6), lp, 45.6));
      glows.push({ p: [lp[0], 42, lp[1]], s: [1.8, 2.3, 1.8], color: '#ff9a4e', k: 1.1 });
      GB.lacquer.add(placed(new THREE.CylinderGeometry(1.1, 1.5, 0.7, 10), lp, 44.5));
      GB.lacquer.add(placed(new THREE.CylinderGeometry(1.5, 1.1, 0.6, 10), lp, 39.6));
      GB.gold.add(placed(new THREE.SphereGeometry(0.5, 8, 6), lp, 39.0));
      halo(lp, 42, 26, '#ffa050', 0.3);
    }

    // ── The roofs ─────────────────────────────────────────────────────────
    // Two tiers turned on a lathe: flat at the eave and lifting at the tip,
    // steepening to the ridge — tiles above, dark rafters beneath. A cone is a
    // hat; the curve is the whole character of the building. (The reversed
    // profile turns the lathe's faces inward: tiles on its back faces, rafters
    // on its front.) Both tiers are spun to the same 22.5°, so their corners
    // fall on the eight column lines and a hip runs the whole way up.
    M.roof.side = THREE.BackSide;
    const underside = Std({ color: '#2b1b12', roughness: 0.9, side: THREE.FrontSide });
    for (const tier of TIERS) {
      const { r, h, y } = tier;
      const profile = [new THREE.Vector2(r * 1.05, 2.2), new THREE.Vector2(r, 0)];
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        profile.push(new THREE.Vector2(r * (1 - t) + 0.01, h * (1 - (1 - t) ** 2.4)));
      }
      const geo = keep(new THREE.LatheGeometry(profile.reverse(), 8, 22.5 * deg));
      for (const material of [M.roof, underside]) {
        const roof = new THREE.Mesh(geo, material);
        roof.position.set(PV[0], y, PV[1]);
        roof.castShadow = material === M.roof;
        roof.receiveShadow = true;
        root.add(roof);
      }
      // Ridges laid ON that curve: eight hips down the corners and a thinner
      // roll of tile down the middle of each facet between them. A lathe on its
      // own gives a smooth shell, and a smooth shell is a lampshade.
      for (let k = 0; k < 16; k++) {
        const a = 22.5 + k * 22.5, hip = k % 2 === 0, lift = hip ? 1.0 : 0.6;
        let last = null;
        for (let i = 0; i <= 9; i++) {
          const rr0 = Math.min(r - 0.4, r * (1 - (i / 9) ** 1.3) + 0.6);
          const n = outward(tier, rr0), p = on(a, rr0 + n[0] * lift);
          const here = [p[0], soffit(tier, rr0) + n[1] * lift, p[1]];
          if (last) GB.ridge.add(rodGeo(last, here, hip ? 0.95 : 0.5));
          last = here;
        }
        if (!hip) continue;
        // and the flying tip, which at a hundred units is the whole of what
        // makes a roof of this kind read as a roof of this kind. It has to
        // CURVE, and it has to be short: laid out straight and long the eight
        // of them read as spears stuck through the building.
        let foot = null;
        for (const [ro, dy, rad] of [[1.05, 0.2, 1.0], [1.075, 1.4, 0.85], [1.09, 3.2, 0.6]]) {
          const q = on(a, r * ro), here = [q[0], y + 2.2 + dy, q[1]];
          if (foot) GB.ridge.add(rodGeo(foot, here, rad));
          foot = here;
        }
        GB.gold.add(placed(new THREE.SphereGeometry(0.95, 8, 6), on(a, r * 1.09), y + 6.0));
      }
      // the fascia along the eave: the course that closes the ends of the tiles
      // and, at night, the only line of the roof a lantern actually lights
      for (let k = 0; k < 8; k++) {
        GB.ridge.add(boxGeo(on(bay(k), r * 1.05), on(bay(k + 1), r * 1.05), 1.7, 1.3, y + 0.6));
      }
    }

    // ── The finial ────────────────────────────────────────────────────────
    // Not a ball. A lotus seat, three rings, the gourd and a spike: the one
    // piece of the building that is there only to be looked at.
    {
      const top = TIERS[1].y + TIERS[1].h;
      GB.lacquer.add(placed(new THREE.CylinderGeometry(3.0, 5.4, 2.6, 8), PV, top + 0.4));
      for (let i = 0; i < 3; i++) GB.gold.add(placed(new THREE.CylinderGeometry(2.5 - i * 0.35, 2.7 - i * 0.35, 0.7, 12), PV, top + 2.4 + i * 1.1));
      GB.gold.add(placed(new THREE.SphereGeometry(2.5, 12, 10), PV, top + 7.2));
      GB.gold.add(placed(new THREE.SphereGeometry(1.5, 12, 10), PV, top + 10.2));
      GB.gold.add(placed(new THREE.CylinderGeometry(0.16, 0.7, 4.4, 8), PV, top + 13.0));
    }

    point(PV, DECK + 12.2, '#ffb266', 5200, 7);
    // and NO pool of light on the ground. Every other lamp in the world lays
    // one — light scattered back off stone or gravel — but the ground under
    // this one is the pond, and water does not scatter light back, it reflects
    // it. A 210-by-190 additive quad of warm haze at y 6.9 is the whole reason
    // the pond read as a lawn: it lay over the water edge to edge, above it and
    // brighter than anything in it, and no amount of work on the surface
    // underneath could be seen through it. What a lamp does to this water is
    // the broken column it lays down towards the eye, and that is the water's
    // own business now (water.js).
    if (!paintings) {
      // ── The lamp at the heart of it ─────────────────────────────────────
      // "Where the lamp keeps every future." A low table on four legs with an
      // apron between them, and a standing lantern on it: a base, four corner
      // posts, a cap, and the light held inside a frame rather than loose in
      // the air the way it was.
      const TT = DECK + 6.6;
      for (let i = 0; i < 4; i++) {
        const q = add(PV, dir(45 + i * 90), 4.6);
        GB.wood.add(placed(new THREE.CylinderGeometry(0.75, 0.95, 6.6, 8), q, DECK + 3.3));
      }
      for (let i = 0; i < 4; i++) {
        GB.wood.add(boxGeo(add(PV, dir(45 + i * 90), 4.6), add(PV, dir(135 + i * 90), 4.6), 1.2, 0.7, TT - 2.4));
      }
      GB.wood.add(placed(new THREE.CylinderGeometry(8.0, 7.4, 1.3, 16), PV, TT + 0.65));
      GB.lacquer.add(placed(new THREE.CylinderGeometry(3.4, 4.0, 1.0, 8), PV, TT + 1.8, 22.5 * deg));
      for (let i = 0; i < 4; i++) {
        GB.lacquer.add(placed(new THREE.BoxGeometry(0.45, 7.2, 0.45), add(PV, dir(45 + i * 90), 2.4), TT + 5.9));
      }
      GB.lacquer.add(placed(new THREE.CylinderGeometry(4.4, 3.2, 0.9, 8), PV, TT + 9.9, 22.5 * deg));
      GB.gold.add(placed(new THREE.SphereGeometry(0.8, 8, 6), PV, TT + 10.9));
      glows.push({ p: [PV[0], TT + 5.6, PV[1]], s: [2.0, 2.7, 2.0], color: '#ffd08a', k: 1.15 });
      halo(PV, TT + 5.6, 26, '#ffbe70', 0.3);
    } else {
      const facing = dir(126.5), width = 40, height = width / (3376 / 1440);
      const at = add(PV, facing, -6), angle = Math.atan2(facing[0], facing[1]);
      const panel = new THREE.BoxGeometry(width + 3, height + 3, 1.6);
      panel.rotateY(angle);
      panel.translate(at[0], 14 + height / 2, at[1]);
      GB.lacquer.add(panel);
      const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
      const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
      const front = add(at, facing, 0.9);
      plane.position.set(front[0], 14 + height / 2, front[1]);
      plane.rotation.y = angle;
      root.add(plane);
      mounts[6] = { center: [front[0], 14 + height / 2, front[1]], normal: facing, width, height, material: mat };
    }
    // ── The bridge ────────────────────────────────────────────────────────
    // The zig-zag that crosses the water to it, built the way a garden's
    // zig-zag bridge is: boards laid ACROSS the way on bearers, and a rail on
    // each side that turns every corner with the deck. It was nine units wide
    // — 85 cm, the two rails closer together than a reader's elbows — and each
    // run was a box with rails of its own, so at every turn the rails of one
    // run went straight across the boards of the next and the walk went
    // through them: it read as walking along the handrails. Now the deck is one
    // outline — the walk's line offset to either side and mitred at every turn
    // — and everything else is laid along that outline.
    {
      const HW = 8.4;                  // half the deck: 1.6 m across
      const RW = HW - 0.9;             // the rails' line, just in from its edge
      const TOP = 8.6;                 // the boards, where the walk stands (DECK, below)
      const runs = BRIDGE.slice(1).map((b, i) => {
        const a = BRIDGE[i], t = unit2(a, b);
        return { a, L: dist(a, b), t, n: [-t[1], t[0]] };
      });
      // The far end is cut along the face of the bay it arrives at — the last
      // run meets that face 20° off square — instead of stopping square across it.
      const face = dir(bay(arrival) + 22.5);
      const reach = (p) => (p[0] - PV[0]) * face[0] + (p[1] - PV[1]) * face[1];
      // the walk's line offset by d (either side), from `back` behind the shore
      // to `cut` out from the middle of the pavilion, mitred at every turn
      const edge = (d, back = 3, cut = 31) => {
        const last = runs[runs.length - 1];
        const pts = [add(add(runs[0].a, runs[0].n, d), runs[0].t, -back)];
        for (let i = 1; i < runs.length; i++) {
          const n0 = runs[i - 1].n, n1 = runs[i].n;
          pts.push(add(runs[i].a, [n0[0] + n1[0], n0[1] + n1[1]], d / (1 + n0[0] * n1[0] + n0[1] * n1[1])));
        }
        const q = add(BRIDGE[BRIDGE.length - 1], last.n, d);
        pts.push(add(q, last.t, (cut - reach(q)) / (last.t[0] * face[0] + last.t[1] * face[1])));
        return pts;
      };
      // a member laid along a line of points, each piece lengthened at a turn
      // by just enough to close the outside of the mitre
      const along = (pts, h, t, y0, batch) => {
        const u = pts.slice(1).map((p, i) => unit2(pts[i], p));
        const over = (i) => {
          if (i <= 0 || i >= u.length) return 0;
          const c = Math.max(-0.99, u[i - 1][0] * u[i][0] + u[i - 1][1] * u[i][1]);
          return (t / 2) * Math.sqrt((1 - c) / (1 + c));
        };
        u.forEach((v, i) => batch.add(boxGeo(add(pts[i], v, -over(i)), add(pts[i + 1], v, over(i + 1)), h, t, y0)));
      };
      // a convex outline cut down to where f(p) >= 0
      const keepWhere = (poly, f) => {
        const out = [];
        poly.forEach((p, i) => {
          const q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
          if (fp >= 0) out.push(p);
          if ((fp >= 0) !== (fq >= 0)) out.push(lerp2(p, q, fp / (fp - fq)));
        });
        return out;
      };
      const area = (poly) => Math.abs(poly.reduce((s, p, i) => {
        const q = poly[(i + 1) % poly.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0)) / 2;

      const L = edge(HW), R = edge(-HW);
      // What the boards lie on: a bed under the whole outline, an edge beam
      // under the board ends, and bearers across — one under the middle of each
      // run and one along each mitre — whose ends show under the edge.
      GB.wood.add(slabGeo([...edge(HW - 0.4), ...edge(-(HW - 0.4)).reverse()], [], 1.0, TOP - 1.6));
      for (const s of [1, -1]) along(edge(s * (HW - 0.6)), 1.3, 1.2, TOP - 1.9, GB.wood);
      runs.forEach((r, i) => {
        const m = add(r.a, r.t, r.L / 2);
        GB.wood.add(boxGeo(add(m, r.n, -(HW + 0.7)), add(m, r.n, HW + 0.7), 0.9, 1.2, TOP - 1.8));
        if (i > 0) GB.wood.add(boxGeo(add(L[i], unit2(R[i], L[i]), 0.7), add(R[i], unit2(L[i], R[i]), 0.7), 0.9, 1.2, TOP - 1.8));
      });
      // The boards, each run's cut along the mitres where it meets the next.
      // The grain runs along a board (u, see walnut in textures.js), and each
      // is cut from a different stretch of the timber.
      runs.forEach((r, i) => {
        const quad = [L[i], L[i + 1], R[i + 1], R[i]];
        const u = (p) => (p[0] - r.a[0]) * r.t[0] + (p[1] - r.a[1]) * r.t[1];
        const hi = Math.max(...quad.map(u));
        for (let k = 0, u0 = Math.min(...quad.map(u)); u0 < hi; k++, u0 += 2.2) {
          const board = keepWhere(keepWhere(quad, (p) => u(p) - u0), (p) => u0 + 2.04 - u(p));
          if (board.length < 3 || area(board) < 0.5) continue;
          const g = slabGeo(board, [], 0.6, TOP - 0.6);
          const pos = g.attributes.position, uv = g.attributes.uv, shift = ((i * 13 + k) * 5.37) % 16;
          for (let v = 0; v < pos.count; v++) {
            const x = pos.getX(v), z = pos.getZ(v);
            uv.setXY(v, x * r.n[0] + z * r.n[1] + shift * 3.1, x * r.t[0] + z * r.t[1] + shift);
          }
          GB.deck.add(g);
        }
      });
      // Onto it from the gravel, 3.4 below the boards, by a stone step on a
      // stone abutment; and off it onto the pavilion, 3.5 above, by another.
      {
        const r = runs[0];
        const quad = (w, u0, u1) => [[w, u0], [w, u1], [-w, u1], [-w, u0]].map(([d, u]) => add(add(r.a, r.n, d), r.t, u));
        GB.stone.add(slabGeo(quad(HW + 0.6, -4.2, 2.5), [], 2.5, TOP - 4.4));
        GB.stone.add(slabGeo(quad(RW - 0.6, -7.2, -3.6), [], 2.2, TOP - 3.9));
        const n = L.length - 1, w = RW - 0.9;
        const band = [...edge(w, 3, 28.8).slice(n - 1), ...edge(-w, 3, 28.8).slice(n - 1).reverse()];
        GB.stone.add(slabGeo(keepWhere(band, (p) => 33.3 - reach(p)), [], 1.75, TOP));
        // At nine units wide the bridge cleared the rocks round the shore; at
        // this width some came up through its boards. Their draws are spent
        // already, so dropping them moves nothing else.
        const line = [add(r.a, r.t, -7.5), ...BRIDGE.slice(1)];
        for (let k = rocks.length - 1; k >= 0; k--) {
          const { p: [x, , z], s: [sx, , sz] } = rocks[k], room = HW + Math.max(sx, sz) * 0.75;
          if (line.slice(1).some((b, i) => segDist([x, z], line[i], b) < room)) rocks.splice(k, 1);
        }
      }
      // The rails: a post at every turn and never more than eight apart, and
      // the same members the pavilion's own rail has — posts with capped heads,
      // a handrail over them and a kick rail under, balusters between.
      const post = (q, v) => {
        const ang = -Math.atan2(v[1], v[0]);
        GB.lacquer.add(placed(new THREE.BoxGeometry(1.4, 4.4, 1.4), q, TOP + 2.2, ang));
        // A capped head, not a brass knob: the walk goes along this rail and
        // a gilt ball on every post came past the eye like a row of melons.
        GB.lacquer.add(placed(new THREE.CylinderGeometry(0.55, 1.05, 0.9, 4), q, 14.5, ang + Math.PI / 4));
        GB.gold.add(placed(new THREE.CylinderGeometry(0.85, 0.85, 0.22, 8), q, 13.95));
      };
      for (const s of [1, -1]) {
        const line = edge(s * RW, 2, 32);
        along(line, 1.0, 1.4, TOP, GB.wood);                               // curb
        along(line, 0.9, 1.5, 10.0, GB.lacquer);                           // kick rail
        along(line, 1.1, 2.0, 13.0, GB.lacquer);                           // handrail
        const u = line.slice(1).map((p, i) => unit2(line[i], p));
        line.forEach((p, i) => {
          // at a turn the post stands square to the line halfway between the two runs
          post(p, i === 0 ? u[0] : i === u.length ? u[i - 1] : unit2([0, 0], add(u[i - 1], u[i])));
          if (i === u.length) return;
          const bays = Math.max(1, Math.round(dist(p, line[i + 1]) / 8)), ang = -Math.atan2(u[i][1], u[i][0]);
          for (let j = 0; j < bays; j++) {
            const a = lerp2(p, line[i + 1], j / bays), b = lerp2(p, line[i + 1], (j + 1) / bays);
            if (j > 0) post(a, u[i]);
            for (const f of [0.33, 0.67]) GB.lacquer.add(placed(new THREE.BoxGeometry(0.6, 2.3, 0.6), lerp2(a, b, f), 11.95, ang));
          }
        });
      }
    }
  }

  // VIII — the Web of Time: the maze, fireflies, and its painting at the heart.
  {
    const { x0, z0, cols, rows, cw, ch } = MZ;
    GB.mazeFloor.add(slabGeo([[x0 - 6, z0 - 6], [x0 + cols * cw + 6, z0 - 6], [x0 + cols * cw + 6, z0 + rows * ch + 6], [x0 - 6, z0 + rows * ch + 6]], [], 1, 4));
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ n: 1, s: 1, e: 1, w: 1, v: 0 })));
    const stack = [[4, 3]];
    grid[3][4].v = 1;
    while (stack.length) {
      const [cc, r] = stack[stack.length - 1];
      const opts = [];
      if (r > 0 && !grid[r - 1][cc].v) opts.push(['n', cc, r - 1, 's']);
      if (r < rows - 1 && !grid[r + 1][cc].v) opts.push(['s', cc, r + 1, 'n']);
      if (cc < cols - 1 && !grid[r][cc + 1].v) opts.push(['e', cc + 1, r, 'w']);
      if (cc > 0 && !grid[r][cc - 1].v) opts.push(['w', cc - 1, r, 'e']);
      if (!opts.length) { stack.pop(); continue; }
      const [d, nc, nr, opp] = pick(opts);
      grid[r][cc][d] = 0;
      grid[nr][nc][opp] = 0;
      grid[nr][nc].v = 1;
      stack.push([nc, nr]);
    }
    grid[0][4].n = 0;
    grid[2][4].s = 0;
    grid[3][4].n = 0;
    // ── The heart: a court, not a cell ────────────────────────────────────
    // The heart was one cell of the grid, a corridor with a hedge on either
    // hand, and the walk ended in it facing a plinth, the way a dead end does.
    // It is the nine cells round it now, cleared into one court, with a way in
    // on each of its axes: the one the reader comes by, and three for the
    // others (finale.js). Any other way into the court is closed, where the
    // maze can spare it — every cell must still be reachable from the entrance.
    // (Knocked through after the maze is grown, so the world's stream is spent
    // exactly as before.)
    if (!paintings) {
      const side = { n: [0, -1, 's'], s: [0, 1, 'n'], e: [1, 0, 'w'], w: [-1, 0, 'e'] };
      const set = (c, r, d, v) => {
        const [dc, dr, opp] = side[d];
        grid[r][c][d] = v;
        if (grid[r + dr]?.[c + dc]) grid[r + dr][c + dc][opp] = v;
      };
      const { c0, c1, r0, r1 } = COURT;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (c < c1) set(c, r, 'e', 0);
          if (r < r1) set(c, r, 's', 0);
        }
      }
      const mc = (c0 + c1) / 2, mr = (r0 + r1) / 2;
      set(mc, r0, 'n', 0);
      set(mc, r1, 's', 0);
      set(c0, mr, 'w', 0);
      set(c1, mr, 'e', 0);
      const reachable = () => {
        const seen = new Set(['4,0']), queue = [[4, 0]];
        while (queue.length) {
          const [c, r] = queue.shift();
          for (const [d, [dc, dr]] of Object.entries(side)) {
            if (grid[r][c][d] || !grid[r + dr]?.[c + dc] || seen.has(`${c + dc},${r + dr}`)) continue;
            seen.add(`${c + dc},${r + dr}`);
            queue.push([c + dc, r + dr]);
          }
        }
        return seen.size === rows * cols;
      };
      const rim = [];
      for (let c = c0; c <= c1; c++) rim.push([c, r0, 'n'], [c, r1, 's']);
      for (let r = r0; r <= r1; r++) rim.push([c0, r, 'w'], [c1, r, 'e']);
      for (const [c, r, d] of rim) {
        if (grid[r][c][d] || (c === mc && (d === 'n' || d === 's')) || (r === mr && (d === 'w' || d === 'e'))) continue;
        set(c, r, d, 1);
        if (!reachable()) set(c, r, d, 0);
      }
    }
    // the one way through to the heart, for the walk
    {
      const from = new Map([['4,0', null]]), queue = [[4, 0]];
      while (queue.length) {
        const [cc, r] = queue.shift();
        if (cc === 4 && r === 3) break;
        const next = [];
        if (r > 0 && !grid[r][cc].n) next.push([cc, r - 1]);
        if (r < rows - 1 && !grid[r + 1][cc].n) next.push([cc, r + 1]);
        if (cc > 0 && !grid[r][cc].w) next.push([cc - 1, r]);
        if (cc < cols - 1 && !grid[r][cc + 1].w) next.push([cc + 1, r]);
        for (const n of next) {
          if (from.has(`${n}`)) continue;
          from.set(`${n}`, [cc, r]);
          queue.push(n);
        }
      }
      for (let at = [4, 3]; at; at = from.get(`${at}`)) mazeRoute.unshift([x0 + (at[0] + 0.5) * cw, z0 + (at[1] + 0.5) * ch]);
    }
    // every wall of the grid as the ground it stands on, and one hedge grown
    // over all of it (hedges.js)
    const T = 8.5, footprint = [];
    const wall = (a, b) => footprint.push([
      Math.min(a[0], b[0]) - T / 2, Math.min(a[1], b[1]) - T / 2, Math.max(a[0], b[0]) + T / 2, Math.max(a[1], b[1]) + T / 2,
    ]);
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        const X = x0 + cc * cw, Z = z0 + r * ch, g = grid[r][cc];
        if (g.n) wall([X, Z], [X + cw, Z]);
        if (g.w) wall([X, Z], [X, Z + ch]);
        if (r === rows - 1 && g.s) wall([X, Z + ch], [X + cw, Z + ch]);
        if (cc === cols - 1 && g.e) wall([X + cw, Z], [X + cw, Z + ch]);
      }
    }
    plantHedge(rectUnionLoops(footprint), { ground: 5, H: 20, seed: 11 });
    mazeGrid = grid;
    mazeRects = footprint;
    point(HEART, 28, '#ffc77e', 3800, 5);
    heartParts.wish = lightWishes[lightWishes.length - 1];
    decal(HEART, 160, 160, '#ffbd6c', 0.34, 5.4, 0.12);
    if (!paintings) {
      // The court's floor: a round of the pale stone laid in the gravel, kerbed,
      // for the plinth to stand in the middle of and the others at the edge of.
      GB.stone.add(slabGeo(circlePts(HEART, 34, 64), [], 0.3, 5));
      GB.stone.add(slabGeo(circlePts(HEART, 35.2, 64), [circlePts(HEART, 33.6, 64)], 0.6, 5));
      // An armillary of gold rings turning over a stone plinth — the size of a
      // thing a court is built round now, not of a thing on a desk: the rings
      // were 5 to 6.4 across and read, at the end of the walk, as a toy.
      GB.stone.add(placed(new THREE.CylinderGeometry(6.2, 6.6, 1.4, 20), HEART, 5 + 0.7));
      GB.stone.add(placed(new THREE.CylinderGeometry(3.2, 4.0, 8.6, 16), HEART, 6.4 + 4.3));
      GB.stone.add(placed(new THREE.CylinderGeometry(4.2, 3.4, 1.1, 16), HEART, 15 + 0.55));
      armillary = new THREE.Group();
      armillary.position.set(HEART[0], 26, HEART[1]);
      [[0, 0, 9.4], [Math.PI / 2, 0, 8.6], [Math.PI / 2, Math.PI / 3, 7.6]].forEach(([rx, rz, r]) => {
        const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(r, 0.36, 10, 88)), M.gold);
        ring.rotation.set(rx, 0, rz);
        armillary.add(ring);
      });
      heartParts.core = new THREE.Mesh(keep(new THREE.SphereGeometry(1.1, 20, 14)), keep(new THREE.MeshBasicMaterial({ color: '#ffcf8a', toneMapped: false })));
      armillary.add(heartParts.core);
      halo(HEART, 26, 34, '#ffd08a', 0.34);
      heartParts.halo = halos[halos.length - 1];
      heartParts.armillary = armillary;
      root.add(armillary);
    } else {
      const facing = [0, 1], width = 30, height = width / (3376 / 1440);
      const at = add(HEART, facing, -6), angle = Math.atan2(facing[0], facing[1]);
      const panel = new THREE.BoxGeometry(width + 3, height + 3, 1.6);
      panel.rotateY(angle);
      panel.translate(at[0], 10 + height / 2, at[1]);
      GB.stone.add(panel);
      const mat = keep(new THREE.MeshBasicMaterial({ color: '#15110c', toneMapped: false }));
      const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), mat);
      const front = add(at, facing, 0.9);
      plane.position.set(front[0], 10 + height / 2, front[1]);
      plane.rotation.y = angle;
      root.add(plane);
      mounts[7] = { center: [front[0], 10 + height / 2, front[1]], normal: facing, width, height, material: mat };
    }
    for (let s = 0; s < (light ? 70 : 160); s++) {
      const p = s < 100
        ? [rr(x0 - 12, x0 + cols * cw + 12), rr(z0 - 12, z0 + rows * ch + 12)]
        : [rr(900, 1500), rr(-40, 640)];
      if (s >= 100 && (!inGarden(p) || pathDist(p) > 80)) continue;
      fireflies.push({ p: [p[0], rr(12, 46), p[1]], s: Array(3).fill(rr(0.7, 1.35)), color: pick(['#f4ff9c', '#fff2a4', '#b8ffe6']), k: rr(0.8, 1.4), phase: rr(0, 100) });
    }
  }

  // ivy over the stone where the honeycomb meets the garden
  for (const cell of cells) {
    if (cell.garden) continue;
    for (let k = 0; k < 6; k++) {
      if (!isGardenAt(cell.i + NB[k][0], cell.j + NB[k][1]) || (cell.k === '4,-4' && k === 5)) continue;
      const e = edgeFrame(cell.c, k);
      const o0 = add(cell.c, dir(60 * k), RC), o1 = add(cell.c, dir(60 * k + 60), RC);
      for (let s = 0; s < 3; s++) {
        const p = add(lerp2(o0, o1, rr(0.1, 0.9)), e.n, rr(-10, 4));
        ivy.push({ p: [p[0], MASS_H + CAP + 0.6 + s * 0.3, p[1]], rot: [0, -Math.atan2(e.t[1], e.t[0]) + rr(-0.25, 0.25), 0], s: [rr(56, 90), 1, rr(22, 34)] });
      }
    }
  }
  {
    // Mats of it over the first bays of the pergola. (They lay across the old
    // breach at the height of the arch, where they floated in the opening as
    // loose leaves; same draws, laid out beyond the wall.)
    const e = edgeFrame(DOOR, 5);
    for (let s = 0; s < 6; s++) {
      const along = rr(-46, 46), out = rr(-16, 16);
      const p = add(add(GATE, e.t, along * 0.32), e.n, 48 + out * 1.2);
      const y = Math.abs(along) < 30 ? rr(46, 60) : rr(20, 60);
      ivy.push({ p: [p[0], 47 + (y - 20) * 0.04, p[1]], rot: [0, rr(0, 6.28), 0], s: [rr(40, 64) * 0.7, 1, rr(26, 40) * 0.7] });
    }
  }

  hangPainting(4, [DOOR[0], DOOR[1] - A + 2.5], 38, [0, 1], 80);

  // ── Trees (trees.js) ──────────────────────────────────────────────────────
  // Where they stand is where they always stood — drawn from the world's
  // stream, which this still spends to the draw exactly as it did, so the
  // shrubs, the mist and everything after are where they were. What each tree
  // IS comes from a stream of its own, and from where it stands: willows and
  // black pines on the pond's far bank, leaning out to the water; maples and
  // pines in the middle ground the walk looks across; cherries where the old
  // ones were in blossom; and beyond, broad trees and the tall cedars that
  // make the skyline. A tree never walked near is grown without twigs.
  {
    const blocked = (p, m = 0) => !inGarden(p)
      || pathDist(p) < 24 + m
      || ((p[0] - POND.c[0]) / (POND.rx + 22 + m)) ** 2 + ((p[1] - POND.c[1]) / (POND.rz + 22 + m)) ** 2 < 1
      || (p[0] > MZ.x0 - 16 - m && p[0] < MZ.x0 + MZ.cols * MZ.cw + 16 + m && p[1] > MZ.z0 - 16 - m && p[1] < MZ.z0 + MZ.rows * MZ.ch + 16 + m)
      || segDist(p, PATHS[0].pts[0], J) < 36 + m
      || dist(p, add(J, dir(279), 30)) < 40
      || POOLS.some((pool) => dist(p, pool.c) < pool.r + 24 + m);
    // the line the walk takes through the garden, and how far off it a place is
    const WALK = [
      [GATE, PERGOLA0, J, [1216, 218], SHORE, ...BRIDGE.slice(1), PV],
      [SHORE, [1256, 208], [1290, 216], [1315, 212], [1311, 266], MAZE_ENTRY],
    ];
    const walkDist = (p) => Math.min(...WALK.flatMap((pts) => pts.slice(1).map((b, i) => segDist(p, pts[i], b))));
    const pondGap = (p) => (Math.hypot((p[0] - POND.c[0]) / POND.rx, (p[1] - POND.c[1]) / POND.rz) - 1) * ((POND.rx + POND.rz) / 2);
    const tr = makeRng(5150), trr = (a, b) => a + (b - a) * tr(), tpick = (xs) => xs[Math.floor(tr() * xs.length)];
    // Leaf colours by kind. Greens toward olive — the moon cools them enough —
    // and the maples in their autumn reds, which the lanterns catch.
    const TINT = {
      broad: ['#56683f', '#4d6140', '#5d6c43', '#48593b', '#526542'],
      pine: ['#3e5034', '#445636', '#394a31'],
      maple: ['#a43424', '#b4452a', '#9a2a22', '#b85a2c', '#c07434'],
      mapleTurning: ['#8c7a36', '#9a6a30'],
      cherry: ['#cdaaaa', '#d6b6b2', '#c29ea4', '#d0aea8'],
      willow: ['#6e7a44', '#667240', '#737c46'],
      cedar: ['#3d4b31', '#37452e', '#434f30'],
    };
    const GROUND_T = 3.6;
    const woodChunks = new Map();
    const tone = new THREE.Color(), pickTone = new THREE.Color();
    const placedTrees = [];
    // (for a harness: root.userData.trees)
    const treeList = [];
    root.userData.trees = treeList;
    const TREES = light ? 70 : 150;
    for (let s = 0; s < 22000 && placedTrees.length < TREES; s++) {
      const near = placedTrees.length && rnd() < 0.45 ? pick(placedTrees) : null;
      const p = near
        ? [near[0] + rr(-52, 52), near[1] + rr(-52, 52)]
        : [rr(720, 2080), rr(-980, 760)];
      if (p[0] < 700 || p[0] > 2100 || p[1] < -1000 || p[1] > 780) continue;
      if (blocked(p) || placedTrees.some((o) => dist(o, p) < 21)) continue;
      placedTrees.push(p);
      const v = rnd() < 0.2 ? 3 + Math.floor(rnd() * 2) : Math.floor(rnd() * 3);
      const kind = rnd();
      // spreading | a tall narrow spire | a young one, half the height
      const [size, top, sprays] = kind < 0.58 ? [rr(40, 68), rr(46, 74), 10]
        : kind < 0.84 ? [rr(24, 36), rr(66, 104), 13]
          : [rr(18, 30), rr(22, 38), 6];
      // (what the old trees drew from it after that: a tint, 7 for each of
      // their sprays and 2 for the post they stood on)
      pick(v >= 3 ? BLOSSOM : LEAF);
      for (let k = 0; k < sprays * 7 + 2; k++) rnd();

      const gap = pondGap(p), walk = walkDist(p);
      // (The nearest any tree stands to the water is some sixty units, and to
      // the walk a hundred and forty: the pond and its paths are open lawn,
      // and the trees that matter from the Pavilion are the ring on the far
      // bank, standing behind it in the view.)
      let species;
      const blossom = v >= 3 && tr() < 0.8, roll = tr();
      if (gap < 135) species = gap < 70 ? 'pine' : blossom && roll < 0.3 ? 'cherry' : roll < 0.72 ? 'willow' : 'pine';
      else if (blossom) species = 'cherry';
      else if (walk < 320) species = roll < 0.35 ? 'maple' : roll < 0.62 ? 'pine' : 'broad';
      else if (kind < 0.58) species = 'broad';
      else if (kind < 0.84) species = 'cedar';
      else species = tr() < 0.5 ? 'maple' : 'broad';
      if (ONE_TREE === 'none') continue;
      if (ONE_TREE) species = ONE_TREE;
      const room = Math.max(10, walk - 12);
      const shape = {
        broad: kind < 0.84 ? { H: top, S: size * 0.5 } : { H: top * 1.25, S: size * 0.6 },
        cedar: { H: top * 1.3, S: size * 0.5 },
        pine: { H: Math.min(62, Math.max(38, top * 0.8)), S: 20 },
        maple: { H: trr(26, 40), S: 0 },
        cherry: { H: trr(30, 42), S: 0 },
        willow: { H: trr(54, 72), S: 0 },
      }[species];
      if (species === 'maple') shape.S = Math.min(shape.H * trr(0.6, 0.8), room);
      if (species === 'cherry') shape.S = Math.min(shape.H * trr(0.7, 0.9), room);
      if (species === 'willow') shape.S = shape.H * 0.5;
      // willows and pines by the water lean out over it
      const lean = gap < 135 ? Math.atan2(POND.c[1] - p[1], POND.c[0] - p[0]) + trr(-0.5, 0.5) : null;
      const wood = new Wood(7);
      const grown = growTree(species, tr, wood, { ...shape, lean, detail: !light && walk < 420 });
      treeList.push({ p, species, H: +shape.H.toFixed(1), gap: Math.round(gap), walk: Math.round(walk) });
      const g = wood.geometry().translate(p[0], GROUND_T, p[1]);
      const key = chunkKey(p[0], p[1]);
      if (!woodChunks.has(key)) woodChunks.set(key, []);
      woodChunks.get(key).push(g);

      const palette = species === 'maple' && tr() < 0.2 ? TINT.mapleTurning : TINT[species];
      const base = new THREE.Color(tpick(palette));
      for (const sp of grown.sprays) {
        const at = [sp.p[0] + p[0], sp.p[1] + GROUND_T, sp.p[2] + p[1]];
        // nothing in the walk's way at head height
        if (walkDist([at[0], at[2]]) < 8 + sp.s[0] * 0.5 && at[1] - sp.s[1] * 0.5 < 30) continue;
        tone.copy(base).lerp(pickTone.set(tpick(palette)), 0.3);
        foliage.push({
          p: at, rot: sp.rot, s: sp.s, color: tone.getHex(), k: sp.shade, kind: sp.kind,
          crown: [sp.crown[0] + p[0], sp.crown[1] + GROUND_T, sp.crown[2] + p[1], sp.crown[3]],
        });
      }
      for (const w of grown.whips) {
        const at = [w.p[0] + p[0], w.p[1] + GROUND_T, w.p[2] + p[1]];
        let len = w.len;
        if (walkDist([at[0], at[2]]) < 8 + w.wide) len = Math.min(len, at[1] - 30);
        if (len < 6) continue;
        hangs.push({ p: at, rot: [0, w.yaw, 0], s: [w.wide, len, 1], kind: w.kind, color: '#d6dac4', k: w.shade });
      }
    }
    for (const geos of woodChunks.values()) {
      const geo = keep(mergeGeometries(geos, false));
      geos.forEach((g) => g.dispose());
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, M.bark);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = 'trees';
      root.add(m);
    }
    let shrubs = 0;
    for (let s = 0; s < 6000 && shrubs < (light ? 60 : 140); s++) {
      const p = [rr(720, 2080), rr(-980, 760)];
      if (blocked(p, -14)) continue;
      shrubs++;
      const size = rr(14, 26);
      const tint = pick(LEAF);
      for (let s2 = 0; s2 < 3; s2++) {
        foliage.push({ p: [p[0] + rr(-4, 4), rr(7, 12), p[1] + rr(-4, 4)], rot: [0, rr(0, 6.28), 0], s: Array(3).fill(size * rr(0.55, 0.75)), color: tint, k: rr(0.6, 0.85), crown: [p[0], 4, p[1], size * 0.75] });
      }
    }
  }

  // ── Mist on the grass ─────────────────────────────────────────────────────
  // What a night garden has that a lit lawn has not: something between the eye
  // and the ground. Sheets of it lie low, thickest over the water and along the
  // pergola, and they drift. They are what puts distance between the near grass,
  // the pavilion and the tree line — without them the whole garden is one flat
  // field of one value, which is exactly how it read.
  const mist = [];
  {
    const near = [POND.c, [1150, 300], [1090, 400], [1240, 200], SHORE, J, [980, 520], [1350, 60],
      [1420, 250], [900, 430], [1180, 120], [1500, 380], [820, 300], [1600, 150]];
    // Faint, and kept well off the places a reader stands: a horizontal sheet
    // that passes through a post in front of you draws a razor-straight line
    // across it. At this strength it is the air between the middle distance and
    // the tree line, which is all it was ever wanted for.
    const mistMat = keep(new THREE.MeshBasicMaterial({
      map: radialTex, color: '#9fc0d8', transparent: true, opacity: 0.055,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    }));
    // And out of the Library. A sheet laid on the lawn beside the Door reached
    // in over the breach, and from inside the gallery its far edge met the
    // walls at eye height: a razor-straight line across both walls of shelves,
    // milky above and clear below. Over any room on the walk the mist thins to
    // nothing — in the shader, so every sheet keeps the size and place the
    // garden was composed with.
    {
      const rooms = cells.filter((cl) => cl.room !== undefined).map((cl) => new THREE.Vector2(cl.c[0], cl.c[1]));
      mistMat.onBeforeCompile = (sh) => {
        sh.uniforms.uRooms = { value: rooms };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
            varying vec2 vMistXZ;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vMistXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
            uniform vec2 uRooms[${rooms.length}];
            varying vec2 vMistXZ;`)
          .replace('#include <map_fragment>', `#include <map_fragment>
            for (int i = 0; i < ${rooms.length}; i++) diffuseColor.a *= smoothstep(${R.toFixed(1)}, ${(RC + 6).toFixed(1)}, distance(vMistXZ, uRooms[i]));`);
      };
      mistMat.customProgramCacheKey = () => 'babel-mist';
    }
    const sheet = keep(flatPlane());
    const stands = [J, lerp2(BRIDGE[1], BRIDGE[2], 0.6), HEART];
    for (let k = 0, tries = 0; k < (light ? 7 : 17) && tries < 400; tries++) {
      const base = near[tries % near.length];
      const p = [base[0] + rr(-110, 110), base[1] + rr(-90, 90)];
      if (stands.some((q) => dist(p, q) < 150)) continue;
      k++;
      const m = new THREE.Mesh(sheet, mistMat);
      const w = rr(260, 520);
      m.scale.set(w, 1, w * rr(0.6, 1));
      m.position.set(p[0], rr(11, 26), p[1]);
      m.renderOrder = 3;
      root.add(m);
      mist.push({ m, home: [p[0], p[1]], phase: rr(0, 100), speed: rr(0.02, 0.05), reach: rr(14, 34) });
    }
  }

  instances(rockGeo(), M.rock, rocks, { cast: false, chunked: true });
  instances(new THREE.SphereGeometry(1, 12, 8), M.glow, glows, { cast: false, receive: false, chunked: true });
  {
    lilyPads.geometries.forEach((geo, k) => instances(geo, M.lily, lilies[k], { cast: false, chunked: true }));
    instances(lilyFlowerGeometry('white', 5), M.flower, blooms.white, { cast: false, chunked: true });
    instances(lilyFlowerGeometry('pink', 6), M.flower, blooms.pink, { cast: false, chunked: true });
    instances(lilyBudGeometry('white', 7), M.flower, blooms.whiteBud, { cast: false, chunked: true });
    instances(lilyBudGeometry('pink', 8), M.flower, blooms.pinkBud, { cast: false, chunked: true });
    instances(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), M.ivy, ivy, { chunked: true });
    // Leaf casts the moon's shadow now (the map is drawn once, at the start,
    // so it costs nothing after): a tree without one stood on the lawn as if
    // pasted there.
    const foliageDepth = keep(makeFoliageDepthMaterial(FOLIAGE_KINDS));
    instances(crossedCards(), M.foliage, foliage, {
      chunked: true,
      depth: foliageDepth,
      prepass: M.foliagePre,
      attrs: { aKind: (it) => it.kind ?? 0, aCrown: (it) => it.crown ?? [it.p[0], it.p[1], it.p[2], 0] },
    });
    for (const [cards, sprigs] of [[crossedCards(), topSprigs], [crossedCards({ flat: false }), faceSprigs]]) {
      instances(cards, M.hedgeLeaf, sprigs, {
        chunked: true,
        depth: foliageDepth,
        prepass: M.hedgeLeafPre,
        attrs: { aKind: (it) => it.kind, aCrown: (it) => it.crown },
      });
    }
    // wisteria and trailing leaves, hung by the top edge (makeHangingMaterial)
    {
      const card = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
      const cards = mergeGeometries([card.clone(), card.clone().rotateY(Math.PI / 2)]);
      card.dispose();
      instances(cards, M.hang, hangs, { cast: false, chunked: true, attrs: { aKind: (it) => it.kind } });
    }
  }
  // Fireflies and dust are points of light drifting on the GPU (effects.js).
  // Dust is not luminous, it is LIT: each mote takes its brightness once, from
  // how near it hangs to a lamp, squared — evenly bright specks read as snow.
  for (const d of dust) {
    let lit = 0;
    for (const w of lightWishes) {
      const f = Math.max(0, 1 - Math.hypot(w.x - d.p[0], w.y - d.p[1], w.z - d.p[2]) / 95);
      lit = Math.max(lit, f * f * Math.min(1, w.intensity / 6000));
    }
    d.k = 0.05 + lit * 1.6;
  }
  // Motes hang in the air; they do not dart about it. A drift of 9 units is
  // most of a metre of wandering, which at speed reads as flies, and the tiny
  // additive points wink in and out as they cross a pixel.
  const sparkles = [
    fireflies.length && makeSparkles(fireflies, { drift: 5, rise: 0.5, pulse: 0.55, rate: 0.7, sizeOf: (f) => f.s[0] * 3.2 }),
    dust.length && makeSparkles(dust, { drift: 3.5, rise: 0.9, rate: 0.22, sizeOf: (d) => d.s[0] * 1.3 }),
  ].filter(Boolean);
  sparkles.forEach((points) => {
    keep(points.geometry);
    keep(points.material);
    root.add(points);
  });

  Object.entries(LB).forEach(([name, b]) => b.flush(name));
  Object.entries(GB).forEach(([name, b]) => b.flush(name));

  // The dark the honeycomb stands in: stars all the way down.
  {
    const abyss = new THREE.Mesh(keep(new THREE.PlaneGeometry(9000, 8000)), keep(new THREE.MeshBasicMaterial({
      map: withRepeat(starTex, [18, 16]), color: '#8fb4c8', toneMapped: false,
    })));
    abyss.rotation.x = -Math.PI / 2;
    abyss.position.set(720, -520, 300);
    root.add(abyss);
  }

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
  const updateLights = (eye, dt) => {
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
    const rank = (w) => near2(w, eye) * (lit.has(w) ? 0.55 : 1);
    const wanted = eye
      ? [...lightWishes].sort((a, b) => (owns(b) - owns(a)) || (rank(a) - rank(b))).slice(0, budget)
      : byPriority.slice(0, budget);
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
  };

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
  const setVeil = (amount) => {
    veilMat.opacity = 0.72 * amount;
    veil.visible = amount > 0.01;
  };

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
  const cull = (eye, reach = 1600) => {
    if (!eye) {
      if (culling) cullable.forEach(({ o }) => { o.visible = true; });
      culling = false;
      return;
    }
    culling = true;
    for (const { o, c, r } of cullable) o.visible = c.distanceTo(eye) - r < reach;
  };

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
  const overlay = {
    rooms: [
      hexPts(cellC(0, 0), R).map((p) => at(p, top)),
      hexPts(cellC(1, -1), R).map((p) => at(p, top)),
      hexPts(cellC(2, -2), R).map((p) => at(p, top)),
      circlePts(PIT, 101, 36).map((p) => at(p, top)),
      hexPts(DOOR, R).map((p) => at(p, top)),
      [[1085, 255], [1150, 180], [1240, 185], [1255, 275], [1175, 330], [1100, 335]].map((p) => at(p, 30)),
      Array.from({ length: 36 }, (_, k) => at([POND.c[0] + Math.cos((k / 36) * Math.PI * 2) * POND.rx, POND.c[1] + Math.sin((k / 36) * Math.PI * 2) * POND.rz], 8)),
      [[1170, 305], [1430, 305], [1430, 535], [1170, 535]].map((p) => at(p, 22)),
    ],
    walk: [ENTRANCE, cellC(0, 0), hallMid(0, 0, 5), cellC(1, -1), hallMid(1, -1, 5), cellC(2, -2), hallMid(2, -2, 5), PIT].map((p) => at(p, 8)),
    gardenWalk: [DOOR, GATE, J, [1216, 218], SHORE, ...BRIDGE.slice(1), PV].map((p) => at(p, 8)),
    mazeLeg: [[1315, 212], [1311, 266], MAZE_ENTRY, HEART].map((p) => at(p, 8)),
    notTaken: PATHS[3].pts.map((p) => at(p, 8)),
    fall: fallPts,
    pit: at(PIT, 8),
  };

  // ── Where a reader stands, and the ways on ────────────────────────────────
  // Eye height is a reader's (the figures stand 18 tall). The ground is 6 on
  // the Library's floors, 5.2 on the garden's gravel, 8.6 on the bridge, 5 in
  // the maze, and each tread's height on the Echo's stair.
  const EYE = 15, FLOOR = 6, GRAVEL = 5.2, DECK = 8.6, MAZE = 5;
  const C0 = cellC(0, 0), C1 = cellC(1, -1), C2 = cellC(2, -2);
  const ring = (c, a, r) => add(c, dir(a), r);
  const unit = (a, b) => { const L = dist(a, b) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const eye = (p, ground) => [p[0], ground + EYE, p[1]];
  const way = (ground, pts) => pts.map((p) => eye(p, ground));
  // a line that keeps to its corners (the bridge, the maze) instead of cutting them
  const hug = (ground, pts, r = 3) => pts.flatMap((p, i) => (i === 0 || i === pts.length - 1
    ? [eye(p, ground)]
    : [eye(add(p, unit(p, pts[i - 1]), r), ground), eye(p, ground), eye(add(p, unit(p, pts[i + 1]), r), ground)]));
  const pergola = unit(PERGOLA0, J);
  const heartFrom = unit(mazeRoute[mazeRoute.length - 2] ?? MAZE_ENTRY, HEART);
  const onStair = (t, lift = EYE) => { const st = stairAt(t); return [st.p[0], st.tread + lift, st.p[1]]; };
  // standing at the stair's open edge, just short of the drop
  const onEdge = (t) => { const st = stairAt(t); return at(add(PIT, dir(st.a), st.edge + 1.4), st.tread + EYE - 0.5); };
  const spot = [
    // How far out from the well a reader stands. Pushed back from 64/66/48:
    // at the old radii the balustrade round the shaft was a couple of paces
    // from the eye and filled the bottom third of every frame with turned
    // bronze, so the room had no floor to it and nowhere for the eye to rest.
    // A few paces further out and the same balustrade reads as a rail round a
    // well, with the gallery floor in front of it.
    // The Echo came IN, from 86 to 72, and it is the one that most needed to.
    // At 86 the eye stood 7.2 from a shelf of books and 10.8 from the wall,
    // where every other room in the piece has 11 to 23 (__worldProbe says so) —
    // the reader was pressed against a bookcase. Everything near the eye sweeps
    // across the frame far faster than anything far from it, so that stand made
    // the Echo the worst room in the walk for the strobing a low frame rate
    // gives you, which is exactly where it was reported. Moving OUT was tried
    // first and is what the old note here warned about; the room is a ring, and
    // the way out of the shelves is inward, toward the well.
    // The Silence keeps 66 for a subtler reason — moving it changes the LENGTH
    // of the walk into it, which re-lands check:walls' forty samples, and at
    // ~0.46 of that leg they come down on the Echo's crossing, where one
    // flight's rail passes 3.2 from the other's centreline. That near-miss is
    // in the world already at 160 samples with none of this changed; it is the
    // two staircases crossing, which is what the room IS. The Silence gets its
    // air from its balustrade instead (see `balustrade`).
    ring(C0, 150, 73), ring(C1, 178, 72), ring(C2, 90, 66), null,
    // The Web of Time: in the corridor a few paces short of the court's gate,
    // looking in at the heart. (It stood 22 from the heart, and the heart was a
    // corridor; the step into the court is the finale's.)
    ring(DOOR, 150, 56), add(J, pergola, -8), lerp2(BRIDGE[1], BRIDGE[2], 0.6), add(HEART, heartFrom, paintings ? -22 : -(COURT_HALF + 12)),
  ];
  // The Echo's stair, every tread of it, up over the well and down the other
  // side: the second leg walks it, and the climb to the crossing is its first
  // half.
  //
  // It used to leave out the ends. The climb went from the floor straight to
  // the third tread (and through a point at floor height INSIDE the first
  // two), so the eye rose ten units — about a metre — at 50 degrees in a
  // stride, where the stair itself is 17; coming down from the crossing, that
  // was the reader dropping off the bottom of the flight. And the walk on to
  // the Silence left the flight by its SIDE, over the parapet, and fell twelve
  // units to the floor beside it: "like I am jumping, not walking". Both ends
  // are walked tread by tread now. The first riser is the one tall step there
  // is (5 units off the floor, where the rest are 2.4), so the end treads are
  // stood on towards their upper riser, spreading it over the most ground.
  const echoStair = [];
  for (let s = 0; s < 18; s++) {
    const at0 = s === 0 ? 5.5 : s === 17 ? 2.5 : 3.7;
    echoStair.push(eye(add(C1, dir(0), -72 + s * 8 + at0), 11 + (s < 9 ? s : 17 - s) * 2.4));
  }
  // ── The crossing, over the middle of the Echo (VANTAGES) ───────────────────
  // The crown of a flight is its two middle treads, level over the well —
  // asked of flightProfile rather than written out again here, so a flight that
  // is ever re-cut takes this with it.
  const CROWN = Math.max(...flightProfile({}).top.map(([, h]) => h));
  const crossing = {
    ...VANTAGES[1],
    eye: at(C1, CROWN + EYE),
    // Along the OTHER flight — the one that cannot be seen from the floor. It
    // runs out from under the reader's feet and down to the gallery floor, with
    // the arcades over it and the shaft falling across both. Level would show
    // the arcades and no stair; much steeper cuts the arches off at the top of
    // the frame.
    look: at(add(C1, dir(60), 70), CROWN - 4),
    // Up the flight the walk to the Silence climbs, and no further: whatever
    // the climb is, it is the one the room already has.
    points: [eye(spot[1], FLOOR), ...echoStair.slice(0, 9), at(C1, CROWN + EYE)],
  };
  const stands = [
    { eye: eye(spot[0], FLOOR), look: at(ring(C0, 30, 16), 24) },
    // Along one flight, not across both: seen end-on the two crossing stairs
    // are a heap, and from the foot of one they are a stair you could climb.
    // The crossing itself is up there to be stood on (`vantage`), because from
    // the floor you can only ever see one of the two flights.
    { eye: eye(spot[1], FLOOR), look: at(add(C1, dir(0), 34), 34), vantage: crossing },
    // across the well at the two broken flights, with the one lamp behind them
    { eye: eye(spot[2], FLOOR), look: at(ring(C2, 285, 26), 37) },
    // a few steps down the Vertigo's stair, looking across the funnel and down it
    { eye: onStair(0.06), look: onStair(0.2, 10) },
    // Up at the arch, gable and pinnacles and all: level, the frame stopped at
    // the springing of its hood and the carving above it was cut off.
    { eye: eye(spot[4], FLOOR), look: at(add(GATE, dir(330), 40), 45) },
    // at the end of the pergola, the waymark ahead where the gravel divides
    { eye: eye(spot[5], GRAVEL), look: at(add(J, dir(285), 30), 13) },
    // on the bridge, the whole pavilion across the water
    { eye: eye(spot[6], DECK), look: at(PV, 26) },
    // at the gate of the court at the heart of the maze, looking in
    { eye: eye(spot[7], MAZE), look: at(HEART, paintings ? 21 : 23) },
  ];
  const legs = [
    // Into the Echo down the middle of the aisle between the arcade and the
    // wall, not grazing the pier at 165°: the straight line from the hall to the
    // stand passed its pedestal at under five units while the head turned in
    // toward the room. (Further out than 77 and it grazes the shelves instead —
    // the aisle is only about sixteen across.)
    { kind: 'walk', points: way(FLOOR, [spot[0], ring(C0, 110, 64), ring(C0, 70, 64), ring(C0, 30, 66), ring(C0, 350, 68), ring(C0, 330, 84), hallMid(0, 0, 5), ring(C1, 150, 86), ring(C1, 164, 77), spot[1]]) },
    { kind: 'walk', points: [
      eye(spot[1], FLOOR),
      // Down the far flight to its foot, and round it. This used to step off
      // the flank from the fourth tread and drop over the parapet (see
      // echoStair). The foot is out beyond the ring of arcade piers, in the
      // corner of the room, and the way round keeps close in to the ring: out
      // by the wall a moulding stood six units ahead at eye height, where in
      // by the piers the nearest stone is a pedestal's cap below the eye and
      // nothing at eye height comes within eight.
      ...echoStair,
      ...way(FLOOR, [add(C1, [75, -1]), add(C1, [75, -10]), add(C1, [73, -22]), ring(C1, 330, 84), hallMid(1, -1, 5), ring(C2, 150, 78), ring(C2, 120, 70), spot[2]]),
    ] },
    { kind: 'walk', points: [
      ...way(FLOOR, [spot[2], ring(C2, 60, 58), ring(C2, 15, 60), ring(C2, 338, 64), ring(C2, 330, 84), hallMid(2, -2, 5), ring(PIT, 150, 94), ring(PIT, 164, 78)]),
      onStair(0), onStair(0.02), onStair(0.04), stands[3].eye,
    ] },
    // off the stair where its rail has given way (0.06 is inside the Vertigo's GAP)
    { kind: 'fall', edge: onEdge(0.06), center: PIT, bottom: -430 },
    // Round the open bookcase, not through it: the leaf swings into the middle
    // of the breach, so the way out keeps to the far side of the opening.
    { kind: 'walk', points: [
      ...way(FLOOR, [spot[4], add(DOOR, dir(60), 4), add(add(DOOR, dir(330), 50), dir(60), 7)]),
      ...way(GRAVEL, [add(GATE, dir(60), 7), add(lerp2(PERGOLA0, J, 0.2), dir(60), 2.5), lerp2(PERGOLA0, J, 0.5), lerp2(PERGOLA0, J, 0.8), spot[5]]),
    ] },
    { kind: 'walk', points: [
      ...way(GRAVEL, [spot[5], J, [1216, 218]]),
      ...hug(DECK, [SHORE, BRIDGE[1], spot[6]]),
    ] },
    { kind: 'walk', points: [
      ...hug(DECK, [spot[6], BRIDGE[1], SHORE]),
      ...way(GRAVEL, [[1256, 208], [1290, 216], [1315, 212], [1311, 266], [1315, 300]]),
      // (no further in than the stand: the court is the finale's)
      ...hug(MAZE, [[MAZE_ENTRY[0], MAZE_ENTRY[1] - 6], ...mazeRoute.slice(0, -1).filter((p) => dist(p, HEART) > dist(spot[7], HEART) + 6), spot[7]], 4),
    ] },
  ];

  // ── Where the walk has worn the floor ─────────────────────────────────────
  // The walk's own line through the galleries, laid on the pavement as stone
  // walked smooth: every room had one grid from wall to well and nothing on it
  // to say where people go. Only where the walk is on a gallery floor — not on
  // a stair, not out on the gravel.
  {
    const runs = [];
    for (const leg of legs) {
      if (leg.kind !== 'walk') continue;
      let run = [];
      const flush = () => { if (run.length > 1) runs.push(run); run = []; };
      for (const q of leg.points) {
        if (Math.abs(q[1] - (FLOOR + EYE)) < 0.01 && !inGarden([q[0], q[2]])) run.push(new THREE.Vector3(q[0], 0, q[2]));
        else flush();
      }
      flush();
    }
    const geos = runs.map((pts) => {
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      return wornRibbon(curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / 2))).map((v) => [v.x, v.z]), 9, 6.12);
    });
    if (geos.length) {
      const m = new THREE.Mesh(keep(mergeGeometries(geos)), M.wornFloor);
      geos.forEach((g) => g.dispose());
      m.name = 'wornPath';
      m.renderOrder = 1;
      root.add(m);
    }
  }

  // ── What the water has to look at ─────────────────────────────────────────
  // Every lit thing in the world offers itself to the pond, and the few that
  // would actually show in it are the ones it keeps. A lamp in water is not a
  // point but a broken column of light running towards the eye (water.js), and
  // the eight lanterns round the Pavilion's eaves are the whole of that room —
  // so they are handed to the water directly rather than made into real lights,
  // which would cost the entire frame to light nothing else.
  {
    const bodies = [POND, ...POOLS.map((o) => ({ c: o.c, rx: o.r, rz: o.r }))];
    const reach = (g) => Math.max(...bodies.map((b) => {
      const flat = Math.max(0, dist([g.p[0], g.p[2]], b.c) - Math.max(b.rx, b.rz));
      return 1 / (1 + (flat * flat + (g.p[1] - 6.5) ** 2) * 0.00045);
    }));
    [...glows, ...waterLamps].map((g) => ({ g, seen: reach(g) }))
      .filter((e) => e.seen > 0.06)
      .sort((a, b) => b.seen - a.seen)
      .slice(0, 12)
      .forEach(({ g }) => water.addLamp([g.p[0], g.p[2]], g.p[1], g.color, g.k ?? 1));
  }

  // ── How the walk ends (finale.js) ─────────────────────────────────────────
  // The light at the heart runs back along the walk: every leg the reader
  // walked, backwards and on the ground, from the maze's mouth to the
  // Library's door — and between the Door and the Vertigo, where the walk is a
  // fall, along the arc the map draws for it — and out down the road not taken.
  let finale = null;
  if (!paintings && mazeGrid) {
    const ground = (p) => [p[0], p[1] - EYE + 1.2, p[2]];
    const back = (i) => [...legs[i].points].reverse().map(ground);
    // The leap from the Door back up to where the reader stood on the
    // Vertigo's stair, arched as the map arches the fall (the map's own arc
    // ends in the middle of the well, and the thread came out of it in a V).
    const door = back(4).at(-1), stair = back(2)[0];
    const ctrl = [(door[0] + stair[0]) / 2 + 40, 260, (door[2] + stair[2]) / 2 - 60];
    const leap = Array.from({ length: 33 }, (_, s) => {
      const t = s / 32, u = 1 - t;
      return [0, 1, 2].map((k) => u * u * door[k] + 2 * u * t * ctrl[k] + t * t * stair[k]);
    });
    finale = buildFinale({
      root, keep, light,
      maze: { MZ, grid: mazeGrid, rects: mazeRects, court: COURT, heart: HEART, ground: MAZE, entry: MAZE_ENTRY },
      stand: stands[7],
      // (far enough off the armillary to see it whole: at 16 its rings filled the frame)
      inside: add(HEART, heartFrom, -28),
      route: [
        at(MAZE_ENTRY, MAZE + 1.2),
        ...back(6).filter((p) => p[2] < MZ.z0 - 3),
        ...back(5), ...back(4),
        ...leap,
        ...back(2), ...back(1), ...back(0),
        at(ENTRANCE, FLOOR + 1.2),
      ],
      branch: { at: J, pts: PATHS[3].pts.slice(1).map((p) => at(p, GRAVEL + 1.2)) },
      glowTex,
      heartParts,
    });
    finale.room = stands.length - 1;
  }

  const coreColor = new THREE.Color('#ffe4b4');
  // The widest a halo may look from the walk: its full width over its distance,
  // so 0.73 is ±20° either side of the lamp.
  const HALO_REACH = OLD_GLARE ? Infinity : 2 * Math.tan(20 * deg);
  // `eye`, the camera's position: up close — walking under a lamp — a halo would
  // be a wash of light over everything, so it gives way.
  const tick = (t, eye, gaze) => {
    // A lamp breathes; it does not flicker. The fast terms in both of these —
    // 11 and 6 radians a second, about two a second — were what read as
    // blinking, and a pool of light on stone has no business doing that.
    for (const p of pools) {
      const n = Math.sin(t * 1.15 + p.phase) * 0.6 + Math.sin(t * 2.6 + p.phase * 1.7) * 0.4;
      p.mat.opacity = p.base * (1 + n * p.amount * 0.55);
    }
    for (const h of halos) {
      let o = h.base * (1 + Math.sin(t * 0.9 + h.phase) * 0.05);
      let size = h.size;
      if (eye) {
        const d = eye.distanceTo(h.sprite.position);
        // down among the walls the bloom already carries a lamp; the halo only helps
        o *= 0.55 * THREE.MathUtils.smoothstep(d, h.size * 0.2, h.size * 0.75);
        // A glow round a light is seen at an ANGLE, not measured in the room:
        // sized in world units, a gallery lamp's halo fifty units off spread
        // ±44° from it and washed a whole quarter of the frame from the Echo's
        // crossing. Held to HALO_REACH it stays a glow about the glass.
        if (h.lamp) size = Math.min(size, d * HALO_REACH);
      }
      h.mat.opacity = o;
      h.sprite.scale.set(size, size, 1);
    }
    if (armillary) {
      armillary.rotation.y = t * 0.22;
      armillary.children[1].rotation.y = t * 0.5;
    }
    // (after the armillary and the heart's halo: the finale's share laid over them)
    if (finale) finale.tick(light ? 0 : t);
    if (pitCore) pitCore.material.color.copy(coreColor).multiplyScalar(1.35 + Math.sin(t * 1.3) * 0.12);
    if (drift) drift(light ? 0 : t);
    if (vault) vault(t, eye, gaze);
    for (const f of mist) {
      f.m.position.x = f.home[0] + Math.sin(t * f.speed + f.phase) * f.reach;
      f.m.position.z = f.home[1] + Math.cos(t * f.speed * 0.73 + f.phase * 1.3) * f.reach * 0.6;
    }
    sparkles.forEach((points) => { points.material.uniforms.uTime.value = light ? 0 : t; });
    water.tick(t);
    wind.value = light ? 0 : t;
  };

  // Points are sized in world units; this is the pixels per unit at distance 1.
  const setViewport = (pixelsPerUnit) => {
    sparkles.forEach((points) => { points.material.uniforms.uScale.value = pixelsPerUnit; });
    water.setViewport(pixelsPerUnit);
    if (finale) finale.setViewport(pixelsPerUnit);
  };

  const setPainting = (index, texture) => {
    const mount = mounts[index];
    if (!mount) return;
    mount.material.map = texture;
    mount.material.color.set('#ffffff');
    mount.material.needsUpdate = true;
  };

  const dispose = () => {
    water.dispose();
    archGeo.dispose();
    disposables.forEach((d) => d.dispose?.());
    root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  };

  // From above, a halo is light laid over the stone and must not be cut by the
  // walls; down among the walls, it must be hidden by them.
  let eyeLevel = false;
  const setEye = (amount) => {
    const down = amount > 0.5;
    if (down === eyeLevel) return;
    eyeLevel = down;
    halos.forEach((h) => { h.mat.depthTest = down; });
    if (finale) finale.setEyeLevel(down);
  };

  // How far the eye is from the nearest open water — what tells the mirror
  // pass whether it is worth drawing the world a second time this frame.
  const ponds = [POND, ...POOLS.map((o) => ({ c: o.c, rx: o.r, rz: o.r }))];
  const toWater = (eye) => Math.min(...ponds.map((b) => Math.max(0,
    Math.hypot(eye.x - b.c[0], eye.z - b.c[1]) - Math.max(b.rx, b.rz))));

  const pit = { x: PIT[0], z: PIT[1], r: 101 };
  return { root, moon, hemi, mounts, stands, legs, overlay, pit, water, toWater, finale, tick, setPainting, setVeil, setEye, updateLights, setLightBudget, takeShadowRequest, cull, setViewport, dispose };
}
