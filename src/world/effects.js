// ── Light in the air, and on the books ───────────────────────────────────────
// The shader pieces of the world that a stock material cannot do:
//
//   the bindings     one instanced box per book, bound in leather by an atlas
//                    of spines — raised bands that catch the lamp, tooled gold
//                    that is actually metal, paper labels — and seen from above,
//                    a page block inside a leather rim
//   the shafts       the cone of lit air under a lamp; faint, soft at its
//                    edges, gone when you walk into it
//   the motes        dust and fireflies as points of light that drift on the
//                    GPU, with a hot core and a soft falloff — solid spheres
//                    read as snow, or as beads
//   the environment  what polished things reflect: a warm band of lamplit
//                    shelves round a dark vault, with a few hot lamps in it
import * as THREE from 'three';
import { LAMPS } from './lampPass';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SPINE_COLS, SPINE_ROWS, SPINE_KINDS, HIDE_TILE, HIDE_SIZE, spineLayout, TITLE_COLS, TITLE_ROWS, TITLE_ASPECT, TITLE_COUNT, NUMERALS } from './textures';

// ?wbook=old: the bindings as they were before 2026-10-01 — a spine and
// nothing else, the boards one flat tone (see makeBookMaterial).
// ?wbook=untitled: as they were before 2026-10-05 — the hide on every face,
// but no titles (a label was a pale box with bars on it), the spine flat, the
// leather matt, and the old 64 × 256 atlas.
const WBOOK = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('wbook') : null;
const OLD_BOOKS = WBOOK === 'old';
export const BOOKS_TITLED = WBOOK !== 'old' && WBOOK !== 'untitled';
// ?wbookscale=old: the books as big as they were before 2026-10-06, taller
// than the readers who walk past them (folios of 1.6-1.8 m on shelves 2 m
// apart). A real book is about a quarter of that, and every detail a binding
// is drawn with — the fillets, the joint, the hide's grain, a label's margins —
// was laid out in the giants' units; so a book's size is read in those
// (BOOK_UNIT of a unit to one of them), and a real folio is tooled as the giant
// was, at its own size.
export const BOOKS_GIANT = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wbookscale') === 'old';
const BOOK_UNIT = BOOKS_GIANT ? 1 : 0.25;
// ?wglare=old: the globes and the light columns as they were before 2026-09-26
// (see makeLampGlobeMaterial and shaftVolume), to compare against.
const OLD_GLARE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wglare') === 'old';
// A lamp globe's glass glazed, since 2026-10-07 — see makeLampGlobeMaterial
// (?wglaze=old: matte, as it was)
const GLAZE = !(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wglaze') === 'old');
// Since the lamp pass of 2026-10-07 (lampPass.js; ?wlampsoff=glint: as it
// was) the glaze's glint is taken from the lamps really round a globe —
// `glintLights`, filled by buildWorld with the lit globes nearest the walk
// (xyz, and the globe's radius) — not from a light fixed in the sky, which put
// the same glint on every globe in the world.
const LP_GLINT = LAMPS.glint;
export const GLINT_N = 40;
export const glintLights = { value: Array.from({ length: GLINT_N }, () => new THREE.Vector4(0, -1e6, 0, 0)) };
// ?wgraze=0..: how strongly the lamp-rails under the cornices wash the top
// shelves (see makeBookMaterial); 0 turns the wash off to compare.
export const GRAZE = (() => {
  const v = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wgraze');
  return v !== null && v !== false && v !== '' && Number.isFinite(+v) ? +v : 0.75;
})();

// ── The bindings ──────────────────────────────────────────────────────────────

// The faces of a binding, painted in the book material's colour pass. Each
// leaves `spineMask` (r: gilt, for the metal), `bumpH` (the height the bump is
// taken from), `bumpOn` and `polish` for the passes after it.
const OLD_FACES = `
        vec3 leather = diffuseColor.rgb;
        vec3 spineMask = vec3(0.0, 0.0, 0.43);
        if (vFace > 0.5 && vFace < 1.5) {
          float detail = texture2D(uSpineDetail, vSpineUv).r;
          spineMask = texture2D(uSpineMask, vSpineUv).rgb;
          vec3 col = leather * (0.2 + detail * 1.3);
          col = mix(col, vec3(0.6, 0.53, 0.4) * (0.5 + detail * 0.55), spineMask.g);
          col = mix(col, vec3(0.8, 0.6, 0.28), spineMask.r * 0.92);
          diffuseColor.rgb = col;
        } else if (vFace > 2.5 && vFace < 3.5) {
          // the cover of a book lying flat: its own leather, a shade darker
          // toward the edges where the boards are rubbed
          vec2 e = min(vUv, 1.0 - vUv);
          diffuseColor.rgb = leather * (0.62 + 0.16 * smoothstep(0.0, 0.12, min(e.x, e.y)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.4, 0.37), vDust * 0.5);
        } else if (vFace > 1.5) {
          // the top of the page block inside a rim of the binding: the edges of
          // the leaves as fine lines, browning toward one edge, each book its
          // own shade of old paper. One flat paper tone on every book read, from
          // above (down the Vertigo's well, most of all), as a floor of pale tiles.
          vec2 pagePixel = max(fwidth(vUv), vec2(1e-5));
          vec2 pageRim = smoothstep(vec2(0.1, 0.08) - pagePixel, vec2(0.1, 0.08) + pagePixel, vUv)
            * (1.0 - smoothstep(vec2(0.9, 0.94) - pagePixel, vec2(0.9, 0.94) + pagePixel, vUv));
          float inner = pageRim.x * pageRim.y;
          float age = fract(sin(dot(leather, vec3(12.9898, 78.233, 37.719)) * 91.7) * 43758.5453);
          // Fade page lines into their average before they become smaller than
          // two pixels; unfiltered procedural stripes have no texture mipmaps.
          float pagePhase = vUv.x * 190.0 + age * 40.0;
          float pageDetail = 1.0 - smoothstep(1.0, 3.14159, fwidth(pagePhase));
          float leaves = 0.86 + 0.14 * sin(pagePhase) * pageDetail;
          vec3 paper = vec3(0.46, 0.4, 0.31) * (0.5 + 0.32 * age) * leaves * mix(1.0, 0.72, smoothstep(0.35, 0.94, vUv.y));
          diffuseColor.rgb = mix(leather * 0.7, paper, inner);
          // a room nobody reads in: the tops gone grey under dust
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.4, 0.37), vDust * 0.6);
        } else {
          diffuseColor.rgb = leather * 0.55;
        }
        float bumpH = spineMask.b, polish = 0.0;
        float bumpOn = vFace > 0.5 && vFace < 1.5 ? 1.0 : 0.0;`;
// The lettering of a spine, inside the spine's branch of FACES (lettered
// books only). spineLayout (textures.js) says, for the spine's atlas cell,
// which compartments hold the title and the volume number and how they are
// lettered; the book says which title (vBook.w: the title, plus 1000 × its
// volume in a set). Everything is laid out in the spine's own units, so a
// label is a label's size on a folio and on an octavo alike, and a letter
// keeps its shape however wide the book.
//   paper    a slip pasted on, a little askew, frayed at its edge; inked
//   morocco  a thin leather label, red, black, green or tan, a gilt fillet
//            just inside its edge; the number on a label of another colour
//   gilt     tooled straight into the leather; blind, the same with no gold
//   vellum   written up the spine by hand
//   cloth    blocked in gold at the head
// Gilt is metal (spineMask.r) and has rubbed away where the leather has
// flaked, leaving the tool's impression; the impression shows round every
// tooled letter, as a slightly wider dark bed (the same letters a few mips
// coarser).
const LETTERING = `
          int cellI = int(vBook.x + 0.5);
          vec4 lay = texelFetch(uSpineLayout, ivec2(cellI, 0), 0);
          float style = texelFetch(uSpineLayout, ivec2(cellI, 1), 0).x;
          float title = mod(vBook.w, 1000.0), vol = floor(vBook.w / 1000.0 + 0.001);
          float sw = vCover.z, sh = vCover.w;
          float lpx = max(max(length(spDx), length(spDy)), 1e-4);
          // a book with a number gives up the ornament in the number's compartment
          float inVol = step(lay.z * sh, spPos.y) * step(spPos.y, lay.w * sh) * step(0.5, vol);
          spineMask.r *= 1.0 - inVol;
          col = mix(col, vec3(0.8, 0.6, 0.28), spineMask.r * 0.92);
          float letterFlat = 0.0, gold = 0.0, pressed = 0.0;
          // where the grain has flaked, the gold went with it
          float lost = smoothstep(0.56, 0.7, hide.r + 0.3 * (fineH - 0.5));
          float pick = fract(title * 0.6180339 + 0.13);
          bool paper = style > 0.5 && style < 1.5, morocco = style > 1.5 && style < 2.5;
          bool inked = paper || (style > 4.5 && style < 5.5), blindT = style > 3.5 && style < 4.5;
          // (most of a spine is neither compartment, and goes no further)
          bool here = style > 0.5 && (abs(spPos.y - 0.5 * (lay.x + lay.y) * sh) < 0.5 * (lay.y - lay.x) * sh + 0.1
            || (vol > 0.5 && abs(spPos.y - 0.5 * (lay.z + lay.w) * sh) < 0.5 * (lay.w - lay.z) * sh + 0.1));
          for (int k = 0; k < 2; k++) {
            if (!here || (k == 1 && vol < 0.5)) break;
            float y0 = (k == 0 ? lay.x : lay.z) * sh, y1 = (k == 0 ? lay.y : lay.w) * sh;
            if (y1 - y0 < 0.05) continue;
            bool vert = k == 0 && style > 4.5 && style < 5.5;
            bool label = paper || morocco;
            vec2 c = vec2(0.5 * sw, 0.5 * (y0 + y1));
            vec2 hs = vec2(0.5 * sw * (paper ? 0.74 : morocco ? 0.84 : 0.8), 0.5 * (y1 - y0) - (paper ? 0.12 : 0.03));
            if (k == 1 && paper) hs.x *= 0.6;
            float tilt = paper ? (vBook.y - 0.5) * 0.06 : 0.0;
            mat2 R = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt));
            vec2 q = R * (spPos - c), qx = R * spDx, qy = R * spDy;
            vec2 ed = abs(q) - hs;
            float edge = max(ed.x, ed.y);
            if (paper) edge += (fineH - 0.5) * 0.1 + (hide.b - 0.5) * 0.05;
            float lab = 0.0;
            if (label) {
              lab = 1.0 - smoothstep(-lpx, lpx, edge);
              // a hair of shadow round its edge, where it stands off the leather
              col *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.06 + lpx, edge)) * step(0.0, edge);
              vec3 mor = pick < 0.42 ? vec3(0.19, 0.032, 0.022) : pick < 0.64 ? vec3(0.028, 0.024, 0.02) : pick < 0.84 ? vec3(0.034, 0.064, 0.036) : vec3(0.19, 0.1, 0.045);
              if (k == 1) mor = pick < 0.42 ? vec3(0.028, 0.024, 0.02) : vec3(0.19, 0.032, 0.022);
              vec3 face = paper
                ? vec3(0.6, 0.53, 0.4) * (0.55 + detail * 0.5) * (0.8 + 0.4 * hide.r) * (1.0 - 0.3 * smoothstep(-0.35, 0.0, edge))
                : mor * (0.7 + 0.6 * hide.r) * mix(1.0, 1.6, smoothstep(-0.1, 0.0, edge));
              col = mix(col, face, lab);
              letterFlat = max(letterFlat, lab);
              bookRough = mix(bookRough, paper ? 0.93 : 0.5, lab);
              if (morocco) gold = max(gold, bookLine(edge + 0.1, 0.02, lpx) * lab * (1.0 - 0.8 * lost));
            }
            // The cell, two of its heights wide, as large as the label holds
            // less a margin (a number smaller than a title).
            vec2 room = hs - (0.07 + 0.08 * min(hs.x, hs.y));
            float s = (vert ? min(2.0 * room.x, 2.0 * room.y / ${TITLE_ASPECT}.0) : min(2.0 * room.x / ${TITLE_ASPECT}.0, 2.0 * room.y)) * (k == 1 ? 0.85 : 1.0);
            if (s <= 0.0) continue;
            float slot = k == 0 ? ${NUMERALS}.0 + title : vol - 1.0;
            float ink = letterInk(slot, q, qx, qy, s, vert, 1.0, lpx);
            if (inked) {
              vec3 inkCol = paper ? vec3(0.04, 0.03, 0.022) : vec3(0.12, 0.065, 0.03);
              col = mix(col, inkCol, ink * (paper ? 0.9 * lab : 0.78 * (0.75 + 0.5 * hide.r)));
            } else {
              float bed = s > lpx * 10.0 ? mix(ink, letterInk(slot, q, qx, qy, s, vert, 5.0, lpx), smoothstep(10.0, 18.0, s / lpx)) : ink;
              pressed = max(pressed, clamp(bed * 1.6 - ink, 0.0, 1.0) + (blindT ? ink : ink * lost));
              if (!blindT) gold = max(gold, ink * (1.0 - 0.85 * lost));
              else bookRough = mix(bookRough, 0.45, ink);
              letterFlat = max(letterFlat, ink);
            }
          }
          col *= 1.0 - 0.38 * clamp(pressed, 0.0, 1.0);
          col = mix(col, vec3(0.8, 0.6, 0.28) * (0.85 + 0.3 * hide.r), gold * 0.92);
          spineMask.r = max(spineMask.r, gold);`;
const FACES = `
        // A set is one binding, but no two of its volumes have aged alike: each
        // a little lighter or darker, warmer or cooler, than its neighbours.
        float warmth = fract(vBook.y * 31.7 + vBook.z * 7.3) - 0.5;
        vec3 leather = diffuseColor.rgb * (0.9 + 0.2 * vBook.y) * vec3(1.0 + 0.06 * warmth, 1.0, 1.0 - 0.08 * warmth);
        vec3 spineMask = vec3(0.0, 0.0, 0.43);
        vec3 hide = texture2D(uHide, vHideUv).rgb;
        float vellum = step(55.5, vBook.x), cloth = step(47.5, vBook.x) * (1.0 - vellum);
        float rich = 1.0 - step(15.5, vBook.x);
        // calf shows all of its hide; cloth and vellum far less of it
        float grain = 1.0 - 0.6 * (vellum + cloth);
        vec3 calf = leather * (1.0 + (hide.r - 0.5) * 1.35 * grain);
        // The relief: creases and scuffs at the hide's own scale, and the
        // pebble of the grain from the same tile laid nearly four times finer.
        // (At the hide's scale it read as stucco.) Each fades out as its
        // texels shrink below a pixel: a bump taken from screen derivatives of
        // detail finer than that is noise, and across a room the lit folios
        // sparkled with it like sandstone. Never on gilt or paper: pressed
        // gold under the lamps threw a glint off every bump, and the wall of
        // books glittered.
        float hidePx = max(length(dFdx(vHideUv)), length(dFdy(vHideUv))) * ${HIDE_SIZE}.0;
        float fineH = texture2D(uHide, vHideUv * 3.7 + vec2(0.37, 0.71)).g;
        float grainH = ((hide.g - 0.5) * 0.05 * (1.0 - smoothstep(0.35, 0.8, hidePx))
          + (fineH - 0.5) * 0.07 * (1.0 - smoothstep(0.35, 0.8, hidePx * 3.7))) * grain;
        float bumpH = 0.43 + grainH;
        float bumpOn = 0.0, polish = 0.0;
        // The raised bands' slope, read off the atlas a texel either side
        // rather than from screen derivatives of their height. A band is a
        // hard step in the height, and the derivative of a step is a spike a
        // pixel or two wide that snaps to the 2x2 blocks derivatives are taken
        // over: as the reader moved, every band's lit and shadowed edge jumped
        // a row at a time, and the runs of identical volumes lined the jumps up
        // into the "flickering lines of the bookshelf". Taken from the texture
        // the slope glides with the book, and the mip chain fades it as the
        // bands shrink below a pixel.
        vec2 spineDx = dFdx(vSpineUv), spineDy = dFdy(vSpineUv);
        vec2 bandDh = vec2(0.0);
        ${BOOKS_TITLED ? `// where on a spine, in units (across from its left joint, down from
        // its head), and how far that moves a pixel: taken out here, where every
        // fragment of the quad takes it, for the lettering in the branch below
        vec2 spPos = vec2(vCover.x, vCover.w - vCover.y);
        vec2 spDx = vec2(dFdx(vCover.x), -dFdx(vCover.y)), spDy = vec2(dFdy(vCover.x), -dFdy(vCover.y));
        // Leather has a sheen: at 0.8 everywhere a binding was matt as card,
        // and a wall of them read as stone. Calf takes the light softly where
        // its grain is whole and goes dull where it has flaked; cloth is dull,
        // vellum waxy. (Never glossy enough for a lamp to glint off the grain.)
        float bookRough = mix(mix(0.6, 0.86, smoothstep(0.55, 0.7, hide.r)), cloth > 0.5 ? 0.9 : 0.58, vellum + cloth);` : ''}
        if (vFace > 0.5 && vFace < 1.5) {
          ${BOOKS_TITLED ? `vec4 atlasTexel = texture2D(uSpineMask, vSpineUv);
          // (the leather's grey is kept sRGB-coded in G: decoded here as the
          // old atlas's own map was by the sampler)
          float detail = pow(atlasTexel.g, 2.2);
          spineMask = vec3(atlasTexel.r, 0.0, atlasTexel.b);` : `float detail = texture2D(uSpineDetail, vSpineUv).r;
          spineMask = texture2D(uSpineMask, vSpineUv).rgb;`}
          vec2 e = max(uSpineTexel, max(abs(spineDx), abs(spineDy)));
          vec2 slope = vec2(
            textureGrad(uSpineMask, vSpineUv + vec2(e.x, 0.0), spineDx, spineDy).b - textureGrad(uSpineMask, vSpineUv - vec2(e.x, 0.0), spineDx, spineDy).b,
            textureGrad(uSpineMask, vSpineUv + vec2(0.0, e.y), spineDx, spineDy).b - textureGrad(uSpineMask, vSpineUv - vec2(0.0, e.y), spineDx, spineDy).b) / (2.0 * e);
          bandDh = vec2(dot(spineDx, slope), dot(spineDy, slope));
          vec3 col = calf * (0.2 + detail * 1.3);
          // the crowns of the raised bands rubbed pale in places, where a
          // finger hooks a book off the shelf
          float crown = smoothstep(0.9, 0.99, spineMask.b) * smoothstep(0.5, 0.62, hide.r + 0.25 * (fineH - 0.5));
          col = mix(col, col * 1.6 + vec3(0.02, 0.015, 0.01), crown * 0.7 * grain);
          ${BOOKS_TITLED ? LETTERING : `// (the label foxed, as old paper is)
          col = mix(col, vec3(0.6, 0.53, 0.4) * (0.5 + detail * 0.55) * (0.8 + 0.4 * hide.r), spineMask.g);
          col = mix(col, vec3(0.8, 0.6, 0.28), spineMask.r * 0.92);`}
          diffuseColor.rgb = col;
          // (the bands are in bandDh; the spine's own height stays at the
          // ground every face starts from, so its edges meet the boards flat)
          bumpH = 0.43 + grainH * (1.0 - ${BOOKS_TITLED ? 'max(spineMask.r, letterFlat)' : 'max(spineMask.r, spineMask.g)'});
          bumpOn = 1.0;
        } else if (vFace > 2.5 && vFace < 3.5) {
          // A board, in units: from the spine, along it, and its size.
          float bs = vCover.x, ba = vCover.y, bD = vCover.z, bL = vCover.w;
          float px = max(fwidth(bs) + fwidth(ba), 1e-4) * 0.7;
          float ends = min(ba, bL - ba);
          vec3 col = calf * 0.62;
          // rubbed: the board's edges paler, its corners at the fore-edge most,
          // and at the very tip worn through to the grey board under the leather
          float rub = 1.0 - smoothstep(0.0, 0.3, min(ends, bD - bs));
          float corner = (1.0 - smoothstep(0.0, 1.5, bD - bs)) * (1.0 - smoothstep(0.0, 1.5, ends));
          float wear = clamp(rub * 0.5 + corner * (0.4 + hide.r), 0.0, 1.0) * (1.0 - 0.6 * cloth);
          col = mix(col, col * 1.55 + vec3(0.02, 0.015, 0.01), wear * 0.6);
          col = mix(col, vec3(0.11, 0.095, 0.08), smoothstep(0.7, 1.0, corner * (0.5 + hide.r)) * (1.0 - vellum));
          polish = wear * 0.12;
          // A third of the calf is half-bound: the sides papered with marbling,
          // the leather only down the spine and over the corners.
          float tooled = 1.0 - vellum;
          if (vBook.z > 0.66 && vellum + cloth < 0.5) {
            float strip = bD * 0.24;
            float tip = (bD - bs) + ends - bD * 0.34;     // > 0 past the corner's leather
            float paper = smoothstep(-px, px, bs - strip) * smoothstep(-px, px, tip);
            float pick = fract(vBook.y * 7.0);
            vec3 p0 = pick < 0.34 ? vec3(0.044, 0.023, 0.014) : pick < 0.67 ? vec3(0.11, 0.023, 0.016) : vec3(0.06, 0.045, 0.03);
            vec3 p1 = pick < 0.34 ? vec3(0.32, 0.17, 0.058) : pick < 0.67 ? vec3(0.26, 0.08, 0.032) : vec3(0.22, 0.15, 0.075);
            vec3 p2 = pick < 0.34 ? vec3(0.61, 0.46, 0.25) : pick < 0.67 ? vec3(0.49, 0.35, 0.19) : vec3(0.55, 0.47, 0.33);
            vec3 marble = mix(p0 * 0.7, p0, smoothstep(0.1, 0.2, hide.b));
            marble = mix(marble, p1, smoothstep(0.42, 0.52, hide.b));
            // (the palest drops held toward the middle: cream spots under a
            // lamp leapt off the board)
            marble = mix(marble, mix(p1, p2, 0.55), smoothstep(0.72, 0.82, hide.b));
            // browned with age, and rubbed at the edges with the leather
            marble *= 0.5 * (0.85 + 0.3 * hide.r) * (1.0 - 0.3 * rub);
            col = mix(col, marble, paper);
            // the edge of the leather where it is turned over the paper
            float lip = max(bookLine(bs - strip, 0.035, px) * step(0.0, tip), bookLine(tip * 0.7071, 0.035, px) * step(strip, bs));
            col *= 1.0 - 0.45 * lip;
            bumpH -= 0.06 * paper;
            tooled = 0.0;
          }
          // the joint: the groove the board hinges in, just off the spine
          float joint = bookLine(bs - 0.6, 0.07, px);
          col *= 1.0 - 0.5 * joint;
          bumpH -= 0.18 * joint;
          // a frame of fillets inset from the edges: gold on the rich bindings,
          // pressed in blind on the rest, none on vellum or a papered side
          float fd = min(min(ba - 0.85, bL - 0.85 - ba), min(bD - 0.85 - bs, bs - 1.1));
          float fillet = (bookLine(fd, 0.045, px) + rich * bookLine(fd - 0.26, 0.03, px)) * tooled;
          float gold = rich * fillet;
          col *= 1.0 - 0.35 * (1.0 - rich) * fillet;
          bumpH -= 0.1 * fillet + grainH * gold;
          col = mix(col, vec3(0.8, 0.6, 0.28) * (0.75 + 0.35 * hide.r), gold * 0.9);
          spineMask.r = gold;
          diffuseColor.rgb = mix(col, vec3(0.42, 0.4, 0.37), vDust * 0.35);
          bumpOn = 1.0;
        } else if (vFace > 1.5) {
          // The leaves, inside a rim of the binding: their edges as fine lines
          // gathered in the sections they were sewn in, browning toward one
          // edge, each book its own shade of old paper. One flat paper tone on
          // every book read, from above (down the Vertigo's well, most of all),
          // as a floor of pale tiles.
          vec2 lv = vLeaf;
          vec2 pagePixel = max(fwidth(lv), vec2(1e-5));
          vec2 pageRim = smoothstep(vec2(0.1, 0.08) - pagePixel, vec2(0.1, 0.08) + pagePixel, lv)
            * (1.0 - smoothstep(vec2(0.9, 0.94) - pagePixel, vec2(0.9, 0.94) + pagePixel, lv));
          float inner = pageRim.x * pageRim.y;
          float age = fract(sin(dot(leather, vec3(12.9898, 78.233, 37.719)) * 91.7) * 43758.5453);
          // Fade page lines into their average before they become smaller than
          // two pixels; unfiltered procedural stripes have no texture mipmaps.
          float pagePhase = lv.x * 190.0 + age * 40.0;
          float pageDetail = 1.0 - smoothstep(1.0, 3.14159, fwidth(pagePhase));
          float leaves = (0.86 + 0.14 * sin(pagePhase) * pageDetail) * (0.94 + 0.06 * sin(lv.x * 31.0 + age * 9.0));
          vec3 paper = vec3(0.46, 0.4, 0.31) * (0.5 + 0.32 * age) * leaves * mix(1.0, 0.72, smoothstep(0.35, 0.94, lv.y));
          // foxed, and dirtied by hands
          paper *= 0.86 + 0.28 * hide.r;
          // the edges as the binder finished them: gilt on half the rich
          // bindings, sprinkled red on a fifth of the rest
          float gilt = rich * step(vBook.z, 0.5);
          float red = (1.0 - rich) * (1.0 - vellum) * step(vBook.z, 0.2);
          paper = mix(paper, paper * vec3(1.2, 0.6, 0.42) * (0.55 + 0.9 * hide.r), red * 0.85);
          paper = mix(paper, vec3(0.6, 0.44, 0.2) * (0.7 + 0.5 * hide.r), gilt * 0.8);
          spineMask.r = gilt * 0.6 * inner;
          diffuseColor.rgb = mix(leather * 0.7, paper, inner);
          // the headband at head and tail, where the spine meets the leaves
          float band = step(vFace, 2.5) * pageRim.x
            * smoothstep(0.08 - pagePixel.y, 0.08 + pagePixel.y, lv.y) * (1.0 - smoothstep(0.125 - pagePixel.y, 0.125 + pagePixel.y, lv.y));
          float stripe = mix(step(0.5, fract(lv.x * 14.0 + age)), 0.5, smoothstep(0.3, 0.6, fwidth(lv.x * 14.0)));
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.42, 0.33, 0.2), vec3(0.22, 0.04, 0.03), stripe), band * 0.9);
          // a room nobody reads in: the tops gone grey under dust
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.4, 0.37), vDust * 0.6);
        } else {
          diffuseColor.rgb = leather * 0.55;
        }`;

// spineLayout as the lettering reads it: one texel per atlas cell, row 0 the
// title's and the number's compartments (fractions of the spine from its
// head), row 1 the style. Made once; both book materials share it.
let layoutTexture = null;
const spineLayoutTexture = () => {
  if (layoutTexture) return layoutTexture;
  const cells = spineLayout(), n = SPINE_COLS * SPINE_ROWS;
  const data = new Float32Array(n * 2 * 4);
  cells.forEach((c, i) => {
    data.set([c.title[0], c.title[1], c.vol[0], c.vol[1]], i * 4);
    data.set([c.style, 0, 0, 0], (n + i) * 4);
  });
  layoutTexture = new THREE.DataTexture(data, n, 2, THREE.RGBAFormat, THREE.FloatType);
  layoutTexture.needsUpdate = true;
  return layoutTexture;
};

// A title for a book that is not shelved in a set: from where it stands, so
// it keeps it (buildWorld's walls give theirs to each set, and number it).
export const titleAt = ([x, y, z]) => {
  const h = Math.sin(x * 41.17 + z * 13.71 + y * 7.13) * 24634.6345;
  return Math.floor((h - Math.floor(h)) * TITLE_COUNT);
};

// `titles`: spineTitles's map, for the lettered books (BOOKS_TITLED).
export function makeBookMaterial(atlas, titles = null) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  material.defines = { USE_UV: '' };
  material.onBeforeCompile = (shader) => {
    if (BOOKS_TITLED) {
      shader.uniforms.uSpineLayout = { value: spineLayoutTexture() };
      shader.uniforms.uTitles = { value: titles };
    } else shader.uniforms.uSpineDetail = { value: atlas.detail };
    shader.uniforms.uSpineMask = { value: atlas.mask };
    shader.uniforms.uHide = { value: atlas.hide };
    shader.uniforms.uSpineTexel = { value: new THREE.Vector2(1 / atlas.mask.image.width, 1 / atlas.mask.image.height) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSpine;
        attribute float aGraze;
        attribute float aDust;
        varying vec2 vSpineUv;
        varying float vFace;
        varying float vGraze;
        varying float vDust;
        varying float vDeep;
        varying vec2 vHideUv;
        varying vec4 vCover;
        varying vec2 vLeaf;
        ${BOOKS_TITLED ? `attribute float aTitle;
        varying vec4 vBook;
        varying vec3 vAcross;` : 'varying vec3 vBook;'}`)
      // aSpine is the atlas cell, plus 1000 for a book LAID FLAT. A laid book
      // shows its spine turned through a right angle, its cover on top and
      // the ends of its leaves at either side. Drawn as if it stood, the tall
      // spine was squeezed into a strip two units high and the stack read as
      // a grey radiator grille.
      //   vFace  1 spine   2 the leaves at head or tail   3 a cover (a board)
      //          4 the leaves at the fore-edge
      // (Before 2026-10-01 only a standing book's top and a laid book's ends
      // had leaves, and only a laid book had a cover: a board seen side on,
      // where a lean or a taller neighbour shows it, was one flat tone.)
      //
      // The box is the book: its spine at +z, and its boards the faces across
      // x (or across y, laid flat). `bq` is where on it a point is, 0 to 1.
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float laid = step(999.5, aSpine);
        float cell = aSpine - 1000.0 * laid;
        vec2 cellAt = vec2(mod(cell, ${SPINE_COLS}.0), ${SPINE_ROWS - 1}.0 - floor(cell / ${SPINE_COLS}.0));
        vec2 suv = laid > 0.5 ? vec2(uv.y, uv.x) : uv;
        vSpineUv = (cellAt + vec2(0.04 + suv.x * 0.92, 0.01 + suv.y * 0.98)) / vec2(${SPINE_COLS}.0, ${SPINE_ROWS}.0);
        ${OLD_BOOKS ? `vFace = normal.z > 0.5 ? 1.0
          : normal.y > 0.5 ? (laid > 0.5 ? 3.0 : 2.0)
          : (laid > 0.5 && abs(normal.x) > 0.5 ? 4.0 : 0.0);` : `vFace = normal.z > 0.5 ? 1.0
          : normal.z < -0.5 ? 4.0
          : (laid > 0.5 ? abs(normal.y) : abs(normal.x)) > 0.5 ? 3.0 : 2.0;`}
        #ifdef USE_INSTANCING
          mat4 bookM = instanceMatrix;
        #else
          mat4 bookM = mat4(1.0);
        #endif
        vec3 bookSize = vec3(length(bookM[0].xyz), length(bookM[1].xyz), length(bookM[2].xyz)) / ${BOOK_UNIT.toFixed(3)};
        vec3 bookAt = bookM[3].xyz;
        vec2 bookHash = fract(sin(vec2(dot(bookAt, vec3(12.9898, 78.233, 37.719)), dot(bookAt, vec3(39.346, 11.135, 83.155)))) * 43758.5453);
        ${BOOKS_TITLED ? 'vBook = vec4(cell, bookHash, aTitle);' : 'vBook = vec3(cell, bookHash);'}
        vec3 bq = position + 0.5;
        float fromSpine = 1.0 - bq.z;
        float across = laid > 0.5 ? bq.y : bq.x;     // through the leaves, board to board
        float along = laid > 0.5 ? bq.x : bq.y;      // tail to head
        float boardLen = laid > 0.5 ? bookSize.x : bookSize.y;
        // a board, in units: from the spine, along it, and its size
        vCover = vec4(fromSpine * bookSize.z, along * boardLen, bookSize.z, boardLen);
        ${BOOKS_TITLED ? `// (on the spine itself: across it from the left joint, and its width —
        // the lettering's units — and the way across it, to round it by)
        float spineW = laid > 0.5 ? bookSize.y : bookSize.x;
        if (normal.z > 0.5) vCover.xz = vec2(across * spineW, spineW);
        vAcross = normalize(mat3(modelViewMatrix) * mat3(bookM) * (laid > 0.5 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));` : ''}
        // the leaves: across them, and toward the fore-edge (or, on the
        // fore-edge itself, from tail to head)
        vLeaf = vec2(across, normal.z < -0.5 ? along : fromSpine);
        // the hide at the book's own scale, and from its own place in the tile
        vec3 faceN = abs(normal);
        vec2 faceSize = faceN.x > 0.5 ? bookSize.zy : faceN.y > 0.5 ? bookSize.xz : bookSize.xy;
        vHideUv = uv * faceSize / ${HIDE_TILE}.0 + bookHash;
        // The wash from a lamp-rail under the cornice: strongest on the top
        // shelf, gone by the middle of the wall. aGraze says how much of it a
        // book's room has (none in the Silence).
        #ifdef USE_INSTANCING
          float grazeY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
        #else
          float grazeY = (modelMatrix * vec4(transformed, 1.0)).y;
        #endif
        vGraze = aGraze * pow(smoothstep(78.0, 111.0, grazeY), 1.6);
        vDust = aDust;
        // Only the Vertigo's books go this far down: the light at the bottom
        // of the funnel climbing its last few turns (see the Vertigo).
        vDeep = pow(smoothstep(-150.0, -440.0, grazeY), 1.5);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uSpineDetail;
        uniform sampler2D uSpineMask;
        uniform sampler2D uHide;
        uniform vec2 uSpineTexel;
        varying vec2 vSpineUv;
        varying float vFace;
        varying float vGraze;
        varying float vDust;
        varying float vDeep;
        varying vec2 vHideUv;
        varying vec4 vCover;
        varying vec2 vLeaf;
        ${BOOKS_TITLED ? 'varying vec4 vBook;' : 'varying vec3 vBook;'}
        // a line |d| < w at a pixel's size px, faded toward its average as it
        // grows thinner than one
        float bookLine(float d, float w, float px) {
          return (1.0 - smoothstep(w, w + px, abs(d))) * min(1.0, 2.0 * w / px);
        }${BOOKS_TITLED ? `
        uniform sampler2D uSpineLayout;
        uniform sampler2D uTitles;
        varying vec3 vAcross;
        // How much of title-atlas slot \`slot\`'s lettering covers the point q
        // (units from the middle of its rect; qx, qy how far it moves a pixel),
        // its cell \`s\` units tall, run up the spine if \`vert\` — read as a
        // binder reads it there, bottom to top. \`blur\` widens the footprint.
        // A cell under three pixels tall is lettering too small to be letters:
        // a tone (about what the letters average), and no sample; from three
        // to six pixels the letters come in out of it, so a label does not
        // change its tone at one step as the reader walks toward it.
        float letterInk(float slot, vec2 q, vec2 qx, vec2 qy, float s, bool vert, float blur, float px) {
          const float A = ${TITLE_ASPECT}.0, COLS = ${TITLE_COLS}.0, ROWS = ${TITLE_ROWS}.0;
          vec2 t = q / s, tx = qx / s, ty = qy / s;
          vec2 uv = vert ? vec2(-t.y / A, -t.x) : vec2(t.x / A, -t.y);
          if (abs(uv.x) > 0.5 || abs(uv.y) > 0.5) return 0.0;
          if (s < px * 3.0) return 0.15;
          vec2 gx = vert ? vec2(-tx.y / A, -tx.x) : vec2(tx.x / A, -tx.y);
          vec2 gy = vert ? vec2(-ty.y / A, -ty.x) : vec2(ty.x / A, -ty.y);
          float page = floor(slot / (COLS * ROWS)), cell = slot - page * COLS * ROWS;
          vec2 at = (vec2(mod(cell, COLS), ROWS - 1.0 - floor(cell / COLS)) + uv + 0.5) / vec2(COLS, ROWS);
          vec2 sc = blur / vec2(COLS, ROWS);
          vec3 v = textureGrad(uTitles, at, gx * sc, gy * sc).rgb;
          return mix(0.15, page < 0.5 ? v.r : page < 1.5 ? v.g : v.b, smoothstep(3.0, 6.0, s / px));
        }` : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${OLD_BOOKS ? OLD_FACES : FACES}`)
      // The tooled gold is metal, but not a mirror. At 0.28/0.92 every letter on
      // every spine in the room threw a highlight small enough to sit inside a
      // pixel and bright enough to cross the bloom threshold — so a wall of
      // books glittered as the reader moved, and a library is not a chandelier.
      // (And calf takes a little polish where hands have rubbed it.)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(${BOOKS_TITLED ? '(abs(vFace - 1.0) < 0.5 || abs(vFace - 3.0) < 0.5) ? bookRough : roughnessFactor' : 'roughnessFactor'}, 0.42, spineMask.r) - polish;`)
      // Light raking down from the rail: returned by what it lands on, so it
      // is the binding's own colour (and the gilt's) that brightens, on the
      // spines far more than on the tops of the pages it barely reaches.
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.7, 0.42) * vGraze * ${GRAZE.toFixed(3)}
          * ((vFace > 0.5 && vFace < 1.5) ? 1.0 + spineMask.r * 0.8 : 0.25);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.62, 0.32) * vDeep * 0.9;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.78, spineMask.r);`)
      // The raised bands, the grain and the tooling, as a bump taken from the
      // height they paint (bumpH). The guard on the normalize is not defensive
      // tidiness — it is the whole of the black squares the reader spent a
      // week reporting.
      //
      // `det` is the scalar triple product of the two screen derivatives and
      // the normal, and it is ZERO wherever those three are coplanar: a
      // silhouette fragment, an edge-on spine, a degenerate quad. There,
      // `abs(det)` is 0 and `sign(det)` is 0, so the whole expression is
      // vec3(0.0) and `normalize` of that is 0/0 — **NaN**. A NaN normal makes
      // a NaN fragment, and a NaN fragment goes into the bloom, where the blur
      // spreads it over everything it touches. That is why the black patches
      // were SQUARE (a blur footprint is), why they moved about at random (a
      // different book is edge-on every frame), why they were worst in the
      // Echo (the most books in view), and why they got SMALLER rather than
      // going away when the bloom stopped using a mip chain — a smaller kernel
      // spreads one bad texel less far. It is also why raising the bloom's
      // threshold to 0.99 and dropping its intensity to zero changed nothing:
      // NaN fails every comparison and survives being multiplied by nothing.
      //
      // (The derivatives are taken outside the branch, and every face's height
      // starts from the spine's ground of 0.43, so a quad that straddles two
      // faces finds no step between them to draw.)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        ${BOOKS_TITLED ? `// A spine is round, not a board: its normal turned across it, up to
        // 40 degrees at the joints, so the lamps light down the crown and the
        // joints fall away, and the sheen slides over it as the reader moves.
        // (Painted into the atlas, the round was the same whichever side the
        // lamp was on, and up close a spine was a flat slab.)
        if (vFace > 0.5 && vFace < 1.5) {
          float roundA = (clamp(vCover.x / max(vCover.z, 1e-3), 0.0, 1.0) * 2.0 - 1.0) * 0.7;
          normal = normalize(normal * cos(roundA) + normalize(vAcross) * sin(roundA));
        }` : ''}
        vec2 dh = (vec2(dFdx(bumpH), dFdy(bumpH))${OLD_BOOKS ? '' : ' + bandDh'}) * 2.2;
        vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
        if (bumpOn > 0.5) {
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1);
          vec3 bumped = abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2);
          float bumpLen = dot(bumped, bumped);
          normal = bumpLen > 1e-12 ? bumped * inversesqrt(bumpLen) : normal;
        }`);
  };
  material.customProgramCacheKey = () => `babel-books-${GRAZE}-${BOOK_UNIT}${OLD_BOOKS ? '-old' : BOOKS_TITLED ? '-titled' : ''}`;
  return material;
}

// A stable binding for a book at a place: no draw on the world's random stream.
export const spineAt = ([x, y, z]) => {
  const h = Math.sin(x * 12.9898 + z * 78.233 + y * 37.719) * 43758.5453;
  // any binding but vellum: a pale vellum spine is a choice (shelfWall makes
  // it), not something to scatter over the funnel and the vault
  return Math.floor((h - Math.floor(h)) * SPINE_KINDS.vellum[0]);
};

// ── The glowing cores ─────────────────────────────────────────────────────────
// A lamp's core, a lantern's paper: light seen THROUGH a round thing is hottest
// where the eye looks straight through it and falls off toward the rim. A flat
// emissive sphere is the same brightness edge to edge, and reads as a disc cut
// out of paper.
export function makeGlowMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vC;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vec4 mv = modelViewMatrix * local;
        vN = normalMatrix * n;
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vC;
      void main() {
        // safeNormalize: same NaN trap as the bindings above — a zero-length
        // view or normal vector turns the whole fragment, and then whatever
        // the bloom smears it across, into nothing.
        float nLen = dot(vN, vN), vLen = dot(vV, vV);
        float through = (nLen > 1e-12 && vLen > 1e-12)
          ? abs(dot(vN * inversesqrt(nLen), vV * inversesqrt(vLen))) : 1.0;
        gl_FragColor = vec4(vC * (0.07 + 1.55 * pow(through, 2.8)), 1.0);
      }
    `,
  });
}

// ── A lamp's globe ────────────────────────────────────────────────────────────
// "Light is provided by some spherical fruits which bear the name of lamps."
// The glass IS the lamp: one opal globe lit from inside, not a bright ball in a
// clear bubble (which read as a ping-pong ball in a soap bubble, with the
// fitting drowned inside it). Opal glass lit from its middle is hottest where
// you look straight through it and goes amber toward the limb, where the light
// has crossed more glass; under the bronze collar the cap shades it. It never
// reaches white — the light is "insufficient, incessant" — so it keeps its
// colour through the tone curve and the bloom does the rest. Built on the unit
// sphere: `position` is the globe's own coordinates, instance colour × k is its
// strength.
export function makeLampGlobeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: LP_GLINT ? { uGlint: glintLights } : {},
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vC;
      varying vec3 vL;
      ${LP_GLINT ? 'varying vec3 vW; varying vec3 vNW;' : ''}
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vL = position;
        vec4 mv = modelViewMatrix * local;
        vN = normalMatrix * n;
        vV = -mv.xyz;
        ${LP_GLINT ? 'vW = (modelMatrix * local).xyz; vNW = mat3(modelMatrix) * n;' : ''}
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vC;
      varying vec3 vL;
      ${LP_GLINT ? `varying vec3 vW; varying vec3 vNW;
      uniform vec4 uGlint[${GLINT_N}];` : ''}
      void main() {
        float nLen = dot(vN, vN), vLen = dot(vV, vV);
        float through = (nLen > 1e-12 && vLen > 1e-12)
          ? abs(dot(vN * inversesqrt(nLen), vV * inversesqrt(vLen))) : 1.0;
        vec3 hot = vec3(1.0, 0.9, 0.74);
        vec3 limb = vec3(0.78, 0.4, 0.14);
        // Only the middle may pass the bloom threshold (0.72): the rest of the
        // globe stays under it so the amber toward the limb survives the grade.
        // The tone curve and the exposure squeeze everything above ~0.4 into
        // the top of the range, so the hot spot has to be TIGHT (through^12 is
        // half-strength under a third of the way out) and the limb well down, or
        // the globe prints as one flat cream disc. At ^8 and 1.05 it still did
        // from the Echo's crossing, fifty units off: a white plate a fifth of
        // the frame wide (2026-09-26).
        vec3 col = limb * 0.24 + hot * 0.07 + hot * ${OLD_GLARE ? '1.05 * pow(through, 8.0)' : '0.9 * pow(through, 12.0)'};
        // the collar's shade over the crown of the globe
        col *= mix(1.0, 0.3, smoothstep(0.42, 0.9, vL.y));
        // hand-blown: the wall is never quite even
        float w = sin(vL.x * 21.0 + sin(vL.y * 13.0) * 2.0) * sin(vL.z * 17.0 + vL.y * 9.0);
        col *= 1.0 + ${GLAZE ? '0.025' : '0.05'} * w;
        gl_FragColor = vec4(vC * col, 1.0);
        ${GLAZE ? `
        // Glazed: the glass is shiny outside — a small sharp window of the
        // light above caught on it, and toward the limb, where it is seen at a
        // slant, it gives back more of the dark room and lets less of the light
        // through. Matte, it read as felt or paper with a light behind it.
        // (The same on the Echo's lantern panes, which are this material.)
        if (nLen > 1e-12 && vLen > 1e-12) {
          vec3 n = vN * inversesqrt(nLen), v = vV * inversesqrt(vLen);
          vec3 r = reflect(-v, n);
          vec3 key = normalize((viewMatrix * vec4(0.35, 1.0, 0.25, 0.0)).xyz);
          vec3 fill = normalize((viewMatrix * vec4(-0.6, 0.35, -0.5, 0.0)).xyz);
          float spec = pow(max(dot(r, key), 0.0), 140.0) * 0.85 + pow(max(dot(r, fill), 0.0), 40.0) * 0.12;
          ${LP_GLINT ? `
          // each lamp near enough a pin of light, as sharp as the lamp is small
          // from here (its radius over its distance), and the fixed key kept
          // as a faint sky over them
          float pins = 0.0;
          vec3 nw = normalize(vNW), vw = normalize(cameraPosition - vW), rw = reflect(-vw, nw);
          for (int i = 0; i < ${GLINT_N}; i++) {
            vec3 L = uGlint[i].xyz - vW;
            float d2 = dot(L, L), gr = uGlint[i].w;
            if (gr <= 0.0 || d2 < 4.0 * gr * gr || d2 > 90000.0) continue;
            float sharp = clamp(1.4 * d2 / (gr * gr), 30.0, 6000.0);
            pins += pow(max(dot(rw, L * inversesqrt(d2)), 0.0), sharp);
          }
          spec = spec * 0.3 + min(pins, 1.5) * 0.9;` : ''}
          float fres = pow(1.0 - through, 3.0);
          gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - 0.3 * fres) + vec3(0.14, 0.1, 0.065) * fres * 0.6 + vec3(1.0, 0.94, 0.84) * spec;
        }` : ''}
      }
    `,
  });
}

// ── Foliage ───────────────────────────────────────────────────────────────────
// A tree's crown is a cloud of leaf sprays — crossed cards, alpha-cut — that
// sway on a slow wind, each spray a little out of step with its neighbours.
//
// Per spray: `aKind`, the column of the atlas it shows (textures.js,
// foliageAtlas), and `aCrown`, the clump it belongs to — centre and radius, 0
// for none. A card lit by its own normal is a flat plane catching the light
// its own way, and a crown of them read as a heap of planes, with bright
// streaks wherever one lay edge-on. Turned out from the clump's centre instead,
// the normals light the clump as the billow it is meant to be — bright on its
// moonward shoulder, dark underneath — and both faces of a card agree, so
// there is no front and back to flip between (three's DOUBLE_SIDED flip is
// taken out for that reason). Deeper in the clump is darker too: the rest of
// it stands between a spray there and the sky.
//
// And a spray keeps its leaf when it is far off. Mip levels average alpha, so
// the coverage of an alpha-cut card thins with distance until a crown across
// the garden is a pale ghost of itself; the alpha is scaled back up by how far
// down the chain the sample comes from.
//
// Drawn twice (makeFoliagePrepass): once for depth alone and then lit, only
// where the first pass left the nearest leaf. A crown is cards over cards, and
// lit in one pass every one of them paid for the whole of the lighting —
// the moon and its shadow, the lamps, the sky — wherever it lay behind
// another: 9 ms a frame from the Pavilion, where the same cards drawn unlit
// cost nothing measurable. So both passes must cut a card identically: the
// same atlas column, the same sway, the same alpha.
const foliageVertex = (kinds, sway = false) => (shader) => shader.vertexShader
  .replace('#include <common>', `#include <common>
    attribute float aKind;
    attribute vec4 aCrown;
    ${sway ? 'uniform float uWind;' : ''}`)
  .replace('#include <uv_vertex>', `#include <uv_vertex>
    #if defined(USE_INSTANCING) && defined(USE_MAP)
      vMapUv.x = (vMapUv.x + aKind) / ${kinds.toFixed(1)};
    #endif`)
  .replace('#include <begin_vertex>', `#include <begin_vertex>
    #if defined(USE_INSTANCING) && ${sway ? 1 : 0}
      vec3 anchor = instanceMatrix[3].xyz;
      float sway = sin(uWind * 0.8 + anchor.x * 0.045 + anchor.z * 0.03) * 0.07
        + sin(uWind * 2.1 + anchor.z * 0.21 + anchor.y * 0.1) * 0.025;
      transformed.x += sway * (position.y + 0.5);
      transformed.z += sway * 0.6 * (position.y + 0.5);
    #endif`);
const foliageAlpha = (shader) => shader.fragmentShader
  .replace('#include <map_fragment>', `#include <map_fragment>
    #ifdef USE_MAP
      {
        vec2 texel = vMapUv * vec2(textureSize(map, 0));
        vec2 dx = dFdx(texel), dy = dFdy(texel);
        float mip = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
        diffuseColor.a *= 1.0 + 0.3 * mip;
      }
    #endif`);

// `prepassed`: drawn after makeFoliagePrepass has laid the depth, so it
// writes none of its own — and with no depth to write, a card that fails the
// depth test is thrown away before its lighting is ever run.
export function makeFoliageMaterial(map, wind, kinds = 1, { prepassed = false } = {}) {
  const material = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.86, depthWrite: !prepassed });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = foliageVertex(kinds, true)(shader)
      .replace('#include <common>', `#include <common>
        varying float vDeep;
        varying float vCrowned;`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        vDeep = 1.0;
        vCrowned = 0.0;
        #ifdef USE_INSTANCING
          if (aCrown.w > 0.0) {
            vCrowned = 1.0;
            vec3 cardW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
            vec3 outward = cardW - aCrown.xyz;
            float reach = length(outward);
            outward = reach > 1e-3 ? outward / reach : vec3(0.0, 1.0, 0.0);
            vec3 flatN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
            flatN *= sign(dot(flatN, outward) + 1e-4);
            transformedNormal = normalize(mat3(viewMatrix) * normalize(mix(flatN, outward, 0.78)));
            vDeep = clamp(reach / aCrown.w, 0.0, 1.0);
          }
        #endif`);
    shader.fragmentShader = foliageAlpha(shader)
      .replace('#include <common>', `#include <common>
        varying float vDeep;
        varying float vCrowned;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(0.42, 1.0, smoothstep(0.1, 0.95, vDeep));`)
      .replace('#include <normal_fragment_begin>', `
        float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
        vec3 normal = normalize(vNormal);
        // (a spray in no clump — the leaf over the pergola, lit from under
        // by its lanterns — keeps its card's two faces, as three draws them)
        if (vCrowned < 0.5) normal *= faceDirection;
        vec3 nonPerturbedNormal = normal;
        // The far side of a clump, seen through it or from under it, is its
        // inside: the side of it turned away from the eye is lit only for
        // someone standing over there.
        diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(-0.5, 0.35, dot(normal, normalize(vViewPosition))));`)
      // No sheen. A normal turned out from a clump is, over half of it,
      // turned away from the eye, where three's Fresnel is at its grazing
      // peak — and it mirrored the moonlit sky: pines from below were
      // snow-covered, and a willow's crown shone like palm fronds.
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectSpecular *= 0.0;
        reflectedLight.directSpecular *= 0.2;`);
  };
  material.customProgramCacheKey = () => `babel-foliage-${kinds}-${prepassed ? 'p' : 's'}`;
  return material;
}

// The depth of the nearest leaf, and nothing else. Pushed back a hair
// (polygonOffset), so the lit pass that follows passes the depth test on the
// very card that laid it and on no card behind.
export function makeFoliagePrepass(map, wind, kinds = 1) {
  const material = new THREE.MeshBasicMaterial({
    map, alphaTest: 0.42, side: THREE.DoubleSide, colorWrite: false,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = foliageVertex(kinds, true)(shader);
    shader.fragmentShader = foliageAlpha(shader);
  };
  material.customProgramCacheKey = () => `babel-foliage-pre-${kinds}`;
  return material;
}

// The same sprays for a wood that is only ever a backdrop (the cedars behind
// the maze: webProps.js, 2). There the belt is the upper half of the frame,
// every pixel of it leaf, and lit as the garden's trees are it cost a third of
// the frame — the moon and its shadow, six lamps and the sky, run for a wall
// of trees two hundred units off in the dark. Lit here once per corner of a
// card instead, by the same three things the others take their light from
// (`light`: the moon's colour and the way to it, the sky's and the ground's,
// and the scene's own fill — the caller keeps them at the world's) and
// shaded the same way: turned out from its clump, darker inside it, darker on
// its far side. No shadow falls on it and it writes its own depth, so it is
// drawn once.
export function makeBackdropFoliage(map, wind, kinds, light) {
  const material = new THREE.MeshBasicMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    Object.assign(shader.uniforms, light);
    shader.vertexShader = foliageVertex(kinds, true)(shader)
      .replace('#include <common>', `#include <common>
        uniform vec3 uBackMoon;
        uniform vec3 uBackMoonDir;
        uniform vec3 uBackSky;
        uniform vec3 uBackGround;
        uniform vec3 uBackFill;
        varying vec3 vBackLit;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vBackLit = vec3(1.0);
        #ifdef USE_INSTANCING
          {
            vec3 cardW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
            vec3 outward = cardW - aCrown.xyz;
            float reach = length(outward);
            outward = reach > 1e-3 ? outward / reach : vec3(0.0, 1.0, 0.0);
            vec3 flatN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
            flatN *= sign(dot(flatN, outward) + 1e-4);
            vec3 n = normalize(mix(flatN, outward, 0.78));
            vec3 lit = uBackMoon * max(dot(n, uBackMoonDir), 0.0) + mix(uBackGround, uBackSky, 0.5 + 0.5 * n.y) + uBackFill;
            float deep = aCrown.w > 0.0 ? clamp(reach / aCrown.w, 0.0, 1.0) : 1.0;
            vec3 toEye = normalize(cameraPosition - cardW);
            vBackLit = lit * 0.3183 * mix(0.42, 1.0, smoothstep(0.1, 0.95, deep)) * mix(0.5, 1.0, smoothstep(-0.5, 0.35, dot(n, toEye)));
          }
        #endif`);
    shader.fragmentShader = foliageAlpha(shader)
      .replace('#include <common>', `#include <common>
        varying vec3 vBackLit;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= vBackLit;`);
  };
  material.customProgramCacheKey = () => `babel-foliage-back-${kinds}`;
  return material;
}

// The same sprays, as the moon's shadow map sees them: cut by the same column
// of the atlas, so a crown's shadow on the grass has the holes its leaves have.
// (The map and the alpha test are handed over by three at render time.)
export function makeFoliageDepthMaterial(kinds) {
  const material = new THREE.MeshDepthMaterial();
  material.onBeforeCompile = (shader) => { shader.vertexShader = foliageVertex(kinds)(shader); };
  material.customProgramCacheKey = () => `babel-foliage-depth-${kinds}`;
  return material;
}

// Things that hang — wisteria racemes, trailing strands — from the top edge of
// their card, and swing from it: nothing at the stalk, the most at the tip.
// (The foliage above sways from the foot of its card, which is a spray
// growing up from a branch.) `aKind` picks the column of `map` a card shows
// (see textures.js, `hanging`); a card is PlaneGeometry(1, 1) moved down so its
// top edge is on the anchor.
//
// `keepCoverage` (pavilionFix.js, 4): a willow's card (kinds 4 and 5) keeps its
// coverage down the mip chain. Averaged into smaller mips a strand's alpha
// falls under the alpha test and the strand breaks into dashes that come and
// go as it sways; its alpha is raised a little for every level the texture
// has shrunk by (0.15), so it stays a strand as it goes small.
// `weep` (pavilionProps.js, 6): a willow's strand darkens to its tip (`tip`,
// beside its top), gives back less of its own colour (`glow` of what the rest
// do, and none of it at the tip — lit all the way down, the curtain was
// bright strings on the night), and moves `sway` times as far in the wind.
export function makeHangingMaterial(map, wind, kinds, { keepCoverage = false, weep = null } = {}) {
  const material = new THREE.MeshStandardMaterial({
    map, alphaTest: 0.38, side: THREE.DoubleSide, roughness: 0.82,
    // Seen against the moonlit garden from a lamplit room, a strand lit only
    // by what falls on it is a black cut-out; a little of its own colour back.
    emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.16,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uWind;
        attribute float aKind;
        varying float vHangKind;
        varying float vHangDown;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vHangKind = 0.0;
        vHangDown = clamp(-position.y, 0.0, 1.0);
        #ifdef USE_INSTANCING
          vHangKind = aKind;
          vMapUv.x = (vMapUv.x + aKind) / ${kinds.toFixed(1)};
          vEmissiveMapUv.x = (vEmissiveMapUv.x + aKind) / ${kinds.toFixed(1)};
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 anchor = instanceMatrix[3].xyz;
          float hang = clamp(-position.y, 0.0, 1.0);
          float sway = sin(uWind * 0.9 + anchor.x * 0.07 + anchor.z * 0.05) * 0.22
            + sin(uWind * 2.3 + anchor.z * 0.19 + anchor.y * 0.13) * 0.07;
          ${weep ? `sway *= mix(1.0, ${weep.sway.toFixed(2)}, step(3.5, aKind));` : ''}
          transformed.x += sway * hang * hang;
          transformed.z += sway * 0.8 * hang * hang;
        #endif`);
    if (keepCoverage || weep) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying float vHangKind;
        varying float vHangDown;`);
    }
    if (weep) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (vHangKind > 3.5) diffuseColor.rgb *= mix(1.0, ${weep.tip.toFixed(3)}, smoothstep(0.1, 0.95, vHangDown));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          if (vHangKind > 3.5) totalEmissiveRadiance *= ${weep.glow.toFixed(3)} * (1.0 - vHangDown);`);
    }
    if (keepCoverage) {
      const size = map.image ? [map.image.width, map.image.height] : [128 * kinds, 512];
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          if (vHangKind > 3.5) {
            vec2 texels = max(abs(dFdx(vMapUv)), abs(dFdy(vMapUv))) * vec2(${size[0].toFixed(1)}, ${size[1].toFixed(1)});
            diffuseColor.a *= 1.0 + max(0.0, log2(max(texels.x, texels.y))) * 0.15;
          }`);
    }
  };
  material.customProgramCacheKey = () => `babel-hanging${keepCoverage ? '-cover' : ''}${weep ? `-weep-${weep.tip}-${weep.glow}` : ''}`;
  return material;
}

// Three upright cards at 60° and one lying flat: full from any side, and from
// above as well. (`flat` false: the upright three alone — a sprig on the face
// of a hedge, whose flat card would lie on the leaf and half sink into it.)
export function crossedCards({ flat = true } = {}) {
  const parts = [0, 60, 120].map((d) => new THREE.PlaneGeometry(1, 1).rotateY((d * Math.PI) / 180));
  if (flat) parts.push(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

// ── The shafts ────────────────────────────────────────────────────────────────
// A column of lit air is something you see from OUTSIDE it: from inside, every
// way you look runs out through its wall, and the wall is facing you square —
// its brightest angle — so the whole frame goes behind one pale veil. Standing
// on the Echo's crossing, inside the moon's shaft, that veil was 62% of what
// made the room milky. So each column carries its own axis (`shaftVolume`) and
// gives way while the eye is in it.

// World-space axis of a column, bottom and top, each with its radius there:
// every vertex carries it, so columns batched into one mesh still know which
// one they belong to. `null` for a column that must not give way (one the
// reader falls down on purpose).
export function shaftVolume(geo, bottom = null, rBottom = 0, top = null, rTop = 0) {
  if (OLD_GLARE) bottom = null;
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 4), b = new Float32Array(n * 4);
  if (bottom) {
    for (let i = 0; i < n; i++) {
      a.set([bottom[0], bottom[1], bottom[2], rBottom], i * 4);
      b.set([top[0], top[1], top[2], rTop], i * 4);
    }
  }
  geo.setAttribute('aShaftA', new THREE.BufferAttribute(a, 4));
  geo.setAttribute('aShaftB', new THREE.BufferAttribute(b, 4));
  return geo;
}

export function makeShaftMaterial(color = '#ffc88a', strength = 0.17) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
      uSceneDepth: { value: null },
      uDepthSize: { value: new THREE.Vector2(1, 1) },
      uDepthViewport: { value: new THREE.Vector4(0, 0, 1, 1) },
      uInverseProjection: { value: new THREE.Matrix4() },
      uSoft: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aShaftA;
      attribute vec4 aShaftB;
      varying vec3 vN;
      varying vec3 vView;
      varying float vT;
      varying float vOpen;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        vN = normalMatrix * normal;
        vT = 1.0 - uv.y;
        // How far out of this column the eye stands, in its own radii at that
        // height: gone inside it, whole again half a radius out.
        vOpen = 1.0;
        if (aShaftA.w > 0.0) {
          vec3 ab = aShaftB.xyz - aShaftA.xyz;
          float t = clamp(dot(cameraPosition - aShaftA.xyz, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
          float r = mix(aShaftA.w, aShaftB.w, t);
          float d = length(cameraPosition - (aShaftA.xyz + ab * t));
          vOpen = smoothstep(r * 0.9, r * 1.5, d);
        }
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      uniform sampler2D uSceneDepth;
      uniform vec2 uDepthSize;
      uniform vec4 uDepthViewport;
      uniform mat4 uInverseProjection;
      uniform float uSoft;
      varying vec3 vN;
      varying vec3 vView;
      varying float vT;
      varying float vOpen;
      void main() {
        float nLen = dot(vN, vN), vLen = dot(vView, vView);
        float facing = (nLen > 1e-12 && vLen > 1e-12)
          ? abs(dot(vN * inversesqrt(nLen), vView * inversesqrt(vLen))) : 0.0;
        float body = pow(facing, 2.4);
        float along = smoothstep(0.0, 0.1, vT) * (1.0 - smoothstep(0.5, 1.0, vT));
        float near = smoothstep(8.0, 50.0, length(vView));
        float intersection = 1.0;
        if (uSoft > 0.5) {
          vec2 uv = gl_FragCoord.xy / uDepthSize;
          float depth = texture2D(uSceneDepth, uv).r;
          vec2 ndc = (gl_FragCoord.xy - uDepthViewport.xy) / uDepthViewport.zw * 2.0 - 1.0;
          vec4 surface = uInverseProjection * vec4(ndc, depth * 2.0 - 1.0, 1.0);
          // The inverse projection also handles the doorway's oblique lens.
          float gap = abs(surface.w) > 1e-6 ? -surface.z / surface.w - vView.z : 10.0;
          intersection = smoothstep(0.0, 10.0, gap);
        }
        gl_FragColor = vec4(uColor, uStrength * body * along * near * vOpen * intersection);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  // A cone is a sheet of light, so a depth test alone cuts a hard arc where
  // it enters a wall. Fade against the solids' depth instead. Copy it once
  // per scene render, after the solids and before these transparent sheets;
  // sampling the active depth attachment would create a feedback loop.
  // Each target keeps its own copy: the doorway and the pond render other
  // cameras, and their depth must never be mistaken for the reader's.
  const copies = new Map();
  material.onBeforeRender = (renderer, scene, camera) => {
    const source = renderer.getRenderTarget();
    material.uniforms.uSoft.value = 0;
    material.uniformsNeedUpdate = true;
    if (!source || !source.depthBuffer || source.samples > 0 || renderer.capabilities.reverseDepthBuffer) return;
    let copy = copies.get(source);
    if (!copy) {
      const depth = new THREE.DepthTexture(source.width, source.height,
        source.depthTexture?.type ?? (source.stencilBuffer ? THREE.UnsignedInt248Type : THREE.UnsignedIntType));
      depth.format = source.depthTexture?.format ?? (source.stencilBuffer ? THREE.DepthStencilFormat : THREE.DepthFormat);
      copy = { target: new THREE.WebGLRenderTarget(source.width, source.height, {
        depthTexture: depth, stencilBuffer: source.stencilBuffer,
      }), frame: -1 };
      copies.set(source, copy);
    }
    const target = copy.target;
    if (target.width !== source.width || target.height !== source.height) {
      target.setSize(source.width, source.height);
      copy.frame = -1;
    }
    if (copy.frame !== renderer.info.render.frame) {
      renderer.initRenderTarget(target);
      const gl = renderer.getContext();
      try {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, renderer.properties.get(source).__webglFramebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, renderer.properties.get(target).__webglFramebuffer);
        gl.blitFramebuffer(0, 0, source.width, source.height, 0, 0, target.width, target.height,
          gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      } finally {
        // Restore both framebuffer bindings as well as three's cached state.
        gl.bindFramebuffer(gl.FRAMEBUFFER, renderer.properties.get(source).__webglFramebuffer);
        renderer.setRenderTarget(source);
      }
      copy.frame = renderer.info.render.frame;
    }
    material.uniforms.uSceneDepth.value = target.depthTexture;
    material.uniforms.uDepthSize.value.set(source.width, source.height);
    renderer.getCurrentViewport(material.uniforms.uDepthViewport.value);
    material.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
    material.uniforms.uSoft.value = 1;
  };
  material.addEventListener('dispose', () => {
    for (const { target } of copies.values()) target.dispose();
    copies.clear();
  });
  return material;
}

// ── The motes ─────────────────────────────────────────────────────────────────

const sparkVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uDrift;
  uniform float uRise;
  uniform float uPulse;
  uniform float uRate;
  uniform float uBlink;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aSize;
  varying vec3 vColor;
  void main() {
    float t = uTime * uRate;
    vec3 p = position + vec3(sin(t * 0.6 + aPhase), sin(t * 0.9 + aPhase * 1.3) * uRise, cos(t * 0.5 + aPhase)) * uDrift;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // A firefly's own light, coming up and going down — slowly. At 1.7 rad/s
    // with a full swing they strobed; the mix with 1.0 (uPulse) is how much of
    // the mote's brightness is allowed to swing at all.
    float pulse = mix(1.0, 0.45 + 0.55 * max(0.0, sin(uTime * 0.95 + aPhase * 3.0)), uPulse);
    // Or a firefly's flash (uBlink, webFix.js 5): each on a beat of its own,
    // 2.4 to 6.4 s, at its own moment in it — a quick rise, a fade over most
    // of a second, and between flashes only an ember. Glowing steadily they read
    // as dust on the lens; flashing out of step they read as things alive.
    float period = 2.4 + fract(aPhase * 0.618) * 4.0;
    float since = fract(uTime / period + fract(aPhase * 0.377)) * period;
    float flash = smoothstep(0.0, 0.12, since) * (1.0 - smoothstep(0.12, 0.9, since));
    pulse = mix(pulse, 0.1 + 1.5 * flash, uBlink);
    vColor = aColor * pulse;
    gl_PointSize = clamp(aSize * uScale / max(1.0, -mv.z), 1.0, 64.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const sparkFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float soft = 1.0 - smoothstep(0.0, 1.0, r);
    float core = 1.0 - smoothstep(0.0, 0.3, r);
    gl_FragColor = vec4(vColor * (soft * soft * 0.55 + core * 1.3), 1.0);
  }
`;

export function makeSparkles(items, { drift = 6, rise = 0.5, pulse = 0, rate = 1, blink = 0, sizeOf = (it) => it.s[0] * 2 } = {}) {
  const n = items.length;
  const position = new Float32Array(n * 3), color = new Float32Array(n * 3), phase = new Float32Array(n), size = new Float32Array(n);
  const c = new THREE.Color();
  items.forEach((it, i) => {
    position.set(it.p, i * 3);
    c.set(it.color ?? '#ffffff').multiplyScalar(it.k ?? 1);
    color.set([c.r, c.g, c.b], i * 3);
    phase[i] = it.phase ?? i * 1.618;
    size[i] = sizeOf(it);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += drift * 2;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uScale: { value: 500 }, uDrift: { value: drift },
      uRise: { value: rise }, uPulse: { value: pulse }, uRate: { value: rate }, uBlink: { value: blink },
    },
    vertexShader: sparkVertex,
    fragmentShader: sparkFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 6;
  return points;
}

// ── The environment ───────────────────────────────────────────────────────────

export function makeEnvironment(renderer) {
  return prepareEnvironment(renderer).finish();
}

// The same in two halves: `prepareEnvironment` builds the dome and starts every
// shader the filtering will use, and `finish()` filters it. Between the two the
// shaders compile on the GPU's side while the page gets on with other things;
// made in one go, the filtering compiled its GGX convolution as it first drew
// with it and stood the page still for over a second (World.jsx's assembly).
const ENV_SIZE = 256;   // PMREMGenerator.fromScene's own default
export function prepareEnvironment(renderer) {
  const scene = new THREE.Scene();
  const dome = new THREE.SphereGeometry(50, 48, 24);
  const vault = new THREE.Color(0.012, 0.016, 0.028);
  const band = new THREE.Color(0.3, 0.2, 0.12);
  const floor = new THREE.Color(0.07, 0.055, 0.04);
  const tone = [];
  const c = new THREE.Color();
  const p = dome.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50;
    if (y > 0.4) c.copy(vault);
    else if (y > -0.08) c.lerpColors(band, vault, (y + 0.08) / 0.48);
    else c.lerpColors(band, floor, Math.min(1, (-0.08 - y) * 4));
    tone.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(tone, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 4.6, 2.4) });
  const bulb = new THREE.SphereGeometry(2.2, 12, 8);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const m = new THREE.Mesh(bulb, hot);
    m.position.set(Math.cos(a) * 28, 10 + (k % 3) * 7, Math.sin(a) * 28);
    scene.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  startEnvironmentShaders(renderer, pmrem, scene);
  const dispose = () => {
    pmrem.dispose();
    dome.dispose();
    bulb.dispose();
    hot.dispose();
  };
  return {
    finish() {
      const target = pmrem.fromScene(scene, 0.03, 0.1, 100, { size: ENV_SIZE });
      dispose();
      return target;
    },
    // (never filtered after all)
    dispose,
  };
}

// Everything is compiled into a render target, as fromScene draws it (a target
// takes tone mapping and the output transfer out of the program), and the
// filter's materials on its own planes: whether a mesh has a position is part
// of a program's key, so PMREMGenerator's own warm-up, which uses an empty
// geometry, compiles a program the filtering never uses. This reaches into
// PMREMGenerator's private interface; where three has changed it, it does
// nothing and fromScene compiles as it always did.
function startEnvironmentShaders(renderer, pmrem, scene) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const was = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.compile(scene, new THREE.PerspectiveCamera(90, 1, 0.1, 100));
    if (typeof pmrem._setSize !== 'function' || typeof pmrem._allocateTargets !== 'function') return;
    pmrem._setSize(ENV_SIZE);
    pmrem._allocateTargets().dispose();
    const plane = pmrem._lodMeshes?.[0]?.geometry;
    const filters = [pmrem._ggxMaterial, pmrem._blurMaterial].filter(Boolean);
    if (!plane || !filters.length) return;
    const camera = new THREE.OrthographicCamera();
    filters.forEach((m) => renderer.compile(new THREE.Mesh(plane, m), camera));
  } catch (error) {
    console.warn('[world] could not start the environment\'s shaders early:', error);
  } finally {
    renderer.setRenderTarget(was);
    target.dispose();
  }
}
