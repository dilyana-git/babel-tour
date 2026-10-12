// What every section of the world starts from (buildWorld.js, assembleWorld):
// the random stream the whole world is laid out from, the small geometry helpers,
// and the painted textures.

import * as THREE from 'three';
import { friezeBand, giltLetters, purbeck, hanging, glow as glowTexture, foliageAtlas, makeRng, bookRowsLayout, pavingLayout } from '../textures';
import { BOOKS_TITLED, makeShaftMaterial } from '../effects';
import { makeWater } from '../water';
import { makeLilyPads } from '../pond';
import { WILLOW_BROAD } from '../pavilionFix';
import { propsOld } from '../forkProps';
import { WOOD_OLD, WALNUT_TILE, CEDAR_TILE } from '../woodGrain';
import { CRACK_OLD, RUBBLE_OLD, SHORE_OLD, deg, BOOK_ROWS, FLOOR_OLD } from './common';

export function buildKit(ctx) {
  const { light, painter } = ctx;
  let seed = 1941;
  const rnd = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // (where the stream is: the Vertigo picks it up and sets it on, see `resume`)
  const stream = { get seed() { return seed; }, set seed(s) { seed = s; } };
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

  const gravelOldTex = tex(paint(512, 512, (g, s) => {
    g.fillStyle = '#6f685c';
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 8000 * detail; k++) {
      const l = rr(-30, 40);
      g.fillStyle = rgb(158 + l, 150 + l, 134 + l, rr(0.6, 1));
      g.beginPath(); g.ellipse(rr(0, s), rr(0, s), rr(0.8, 3.2), rr(0.6, 2.4), rr(0, 3), 0, Math.PI * 2); g.fill();
    }
    speckle(g, s, s, 8000, true, 0.35);
  }), [1 / 16, 1 / 16]);
  // (forkProps.js, 8: pebbles, each a few millimetres to a centimetre and a
  // half, rounded, lit a little on one side, a dozen shades apart, a little
  // warm; and the bed they lie on shows dark only between them. A grain a pixel
  // or two across, forty shades from the next, reads as white speckle on grey.
  // Painted from its own stream — the old gravel is still painted above, for
  // the draws it takes from the world's.)
  const GRAVEL_COLOR = propsOld(8) ? '#6f6c66' : '#7b7367';
  const gravelTex = propsOld(8) ? gravelOldTex : tex(paint(1024, 1024, (g, s) => {
    const r = makeRng(8808), R = (a, b) => a + (b - a) * r();
    g.fillStyle = '#6c6458';
    g.fillRect(0, 0, s, s);
    const grain = (x, y, rx, ry, rot, l, warm) => {
      const c = [150 + l + warm, 140 + l, 121 + l - warm];
      // (and again across the tile's edge, where it lies over one)
      const xs = x < 8 ? [0, s] : x > s - 8 ? [0, -s] : [0], ys = y < 8 ? [0, s] : y > s - 8 ? [0, -s] : [0];
      for (const ox of xs) for (const oy of ys) {
        g.save();
        g.translate(x + ox, y + oy);
        g.rotate(rot);
        g.scale(1, ry / rx);
        const grd = g.createRadialGradient(-rx * 0.3, -rx * 0.3, rx * 0.1, 0, 0, rx);
        grd.addColorStop(0, rgb(c[0] + 9, c[1] + 9, c[2] + 8));
        grd.addColorStop(0.7, rgb(c[0], c[1], c[2]));
        grd.addColorStop(1, rgb(c[0] - 16, c[1] - 16, c[2] - 15, 0.85));
        g.fillStyle = grd;
        g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    };
    // a bed of small ones, then the pebbles over it
    for (let k = 0; k < 16000 * detail; k++) grain(R(0, s), R(0, s), R(1.6, 3), R(1.3, 2.6), R(0, 3.14), R(-16, 6), R(-3, 5));
    for (let k = 0; k < 9000 * detail; k++) grain(R(0, s), R(0, s), R(3, 6.5), R(2.4, 5), R(0, 3.14), R(-11, 13), R(-3, 6));
    // and the slow change of tone a raked bed has across a pace
    for (let k = 0; k < 60; k++) {
      const x = R(0, s), y = R(0, s), rad = R(60, 170), dark = r() < 0.5;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        if (x + ox + rad < 0 || x + ox - rad > s || y + oy + rad < 0 || y + oy - rad > s) continue;
        const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        grd.addColorStop(0, dark ? 'rgba(40,34,26,0.07)' : 'rgba(214,200,176,0.06)');
        grd.addColorStop(1, dark ? 'rgba(40,34,26,0)' : 'rgba(214,200,176,0)');
        g.fillStyle = grd;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
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
  // The koi are solid fish (pond.js); the four draws a painted card of them
  // took from the world's stream are still spent, so everything laid out after
  // this lands where it always has.
  for (let k = 0; k < 20; k++) rnd();

  // Surfaces with the maps that make light behave on them (see textures.js).
  const scaled = (set, repeat, repeatV = repeat) => {
    Object.values(set).forEach((t) => { keep(t); t.repeat.set(repeat, repeatV); });
    return set;
  };
  const again = (t, repeat, repeatV = repeat) => {
    const c = keep(t.clone());
    c.repeat.set(repeat, repeatV);
    c.needsUpdate = true;
    return c;
  };
  // A reader is 18 units tall, so a unit is 9.4 cm and these are sizes of stone:
  // a flagstone 1 m across, an ashlar course 45 cm high, the massive pale stone
  // of the caps and the drums laid 2 m by 1. (Everything they go on is projected
  // in world units — see uvWorld — so these numbers mean what they say.)
  const flag = scaled(painter.take('flag'), 1 / 32);
  // the Door's cracks, over the breach's frame (cracks.js; read by paveShade)
  const crackMap = CRACK_OLD ? null : keep(painter.take('cracks').map);
  const wall = scaled(painter.take('wall'), 1 / 38);
  const pale = scaled(painter.take('pale'), 1 / 42);
  // (the wood is a board's length of timber along u and its width across v:
  // WALNUT_TILE and CEDAR_TILE, laid by uvGrain along each piece)
  const wood = WOOD_OLD ? scaled(painter.take('wood'), 1 / 7) : scaled(painter.take('wood'), 1 / WALNUT_TILE[0], 1 / WALNUT_TILE[1]);
  const whiteTex = keep(new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1));
  whiteTex.colorSpace = THREE.SRGBColorSpace;
  whiteTex.needsUpdate = true;
  const timber = WOOD_OLD ? scaled(painter.take('timber'), 1 / 12) : scaled(painter.take('timber'), 1 / CEDAR_TILE[0], 1 / CEDAR_TILE[1]);
  const spines = painter.take('spines');
  Object.values(spines).forEach(keep);
  const titles = BOOKS_TITLED ? painter.take('titles') : null;
  // the far shelves' painted rows, and where on the strip each row lies (v
  // runs up the texture, the canvas down)
  const bookRowsSet = painter.take('bookRows');
  keep(bookRowsSet.map);
  const rowV = (() => { const L = bookRowsLayout(BOOK_ROWS); return L.at.map(({ y, h }) => ({ top: 1 - y / L.h, base: 1 - (y + h) / L.h })); })();
  if (titles) Object.values(titles).forEach(keep);
  // The frieze's key is laid in world units like the stone: seven units to a
  // pair of keys along the wall, and the board's own height (111.5 to 115) up
  // it — so the pattern sits on the board whatever length of wall it runs.
  const friezeTex = keep(friezeBand());
  friezeTex.repeat.set(1 / 7, 1 / 3.5);
  friezeTex.offset.set(0, 1 - ((111.5 / 3.5) % 1));
  const gilt = giltLetters();
  keep(gilt.map);
  const hedge = scaled(painter.take('hedge'), 1 / 12);
  // The Door's arch (portal.js): carved stone with no joints painted in it,
  // laid by the mouldings' own length (a unit of texture every nine units of
  // stone); the same pale ashlar as the caps at half the size of block, for
  // the plain faces of a doorway; the dark marble of its shafts; what hangs in it.
  const carveSet = painter.take('carve');
  Object.values(carveSet).forEach(keep);
  // the grain of what came down in the Door (rubble.js; laid on by M.rubble)
  const rubbleSet = RUBBLE_OLD ? null : painter.take('rubble');
  // the garden's granite and the pond's bank (shore.js; laid on by M.shoreRock, M.bank)
  const shoreRockSet = SHORE_OLD ? null : painter.take('shoreRock');
  const shoreBankSet = SHORE_OLD ? null : painter.take('shoreBank');
  for (const set of [shoreRockSet, shoreBankSet]) if (set) Object.values(set).forEach(keep);
  if (rubbleSet) Object.values(rubbleSet).forEach(keep);
  // (painted once: the caps' stone, laid at another size)
  const dressedSet = { map: again(pale.map, 1 / 20), normalMap: again(pale.normalMap, 1 / 20), roughnessMap: again(pale.roughnessMap, 1 / 20) };
  const marbleSet = purbeck();
  Object.values(marbleSet).forEach(keep);
  // The Echo's columns: the carving's oolite again, honed, each shaft one
  // stone with its bed running up it. Everything it goes on carries its uv in
  // world units (colLathe, or projected), so a unit of texture is 9 of stone.
  const columnSet = scaled(painter.take('column'), 1 / 9);
  const hangTex = keep(hanging({ broadWillow: WILLOW_BROAD }));
  const glowTex = keep(glowTexture());
  const lampHaloTex = keep(glowTexture(256, 0.11));
  const water = makeWater({ mirror: !light });
  const wind = { value: 0 };
  const lilyPads = makeLilyPads(wind);
  lilyPads.textures.forEach(keep);
  const leaves = keep(foliageAtlas());
  const barkSet = painter.take('bark');
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
  // room); moss drawn along the joints of the floor's own layout (textures.js,
  // `pavingLayout` — or the old tiles' four rows, three to a row, every other
  // row offset half a slab), laid in the same world units so it sits in them;
  // one leaf; a globe.
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
    if (!FLOOR_OLD) {
      // (a slab's end joint is drawn again a canvas to either side, so a
      // tuft on the edge comes back in at the other)
      for (const row of pavingLayout({ size: S })) {
        for (let x = 0; x < S; x += mrr(3, 7)) if (mr() < 0.75) tuft(x, row.y + mrr(-3, 3), mrr(3, 9));
        for (const J of row.joints.slice(0, -1)) {
          const x0 = (row.x0 + J) % S;
          for (let y = row.y; y < row.y + row.h; y += mrr(3, 7)) {
            if (mr() < 0.75) { const x = x0 + mrr(-3, 3), r = mrr(3, 9); for (const dx of [-S, 0, S]) tuft(x + dx, y, r); }
          }
          for (let n = 0; n < 3; n++) { const x = x0 + mrr(-10, 10), y = row.y + mrr(-10, 10), r = mrr(8, 18); for (const dx of [-S, 0, S]) tuft(x + dx, y, r); }
        }
      }
    } else {
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
  return { rnd, stream, rr, pick, dir, add, lerp2, unit2, dist, hexPts, circlePts, rot3, detail,
    disposables, keep, paint, tex, withRepeat, grassTex, GRAVEL_COLOR, gravelTex, starTex, roofTex,
    radialTex, lanternPoolTex, wisteriaTex, ivyTex, again, flag, crackMap, wall, pale, wood,
    whiteTex, timber, spines, titles, bookRowsSet, rowV, friezeTex, gilt, hedge, carveSet,
    rubbleSet, shoreRockSet, shoreBankSet, dressedSet, marbleSet, columnSet, hangTex, glowTex,
    lampHaloTex, water, wind, lilyPads, leaves, barkSet, shaftMaterial, gradTex, wornTex,
    dustFanTex, mossTex, leafTex, globeTex };
}
