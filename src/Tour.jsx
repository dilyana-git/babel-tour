// TODO(beauty) — REMAINING PLAN (delete each item when done; see matching
// TODO(beauty-N) comments in DioramaScene.jsx):
//  13. DioramaScene: postprocessing pass — film grain, soft vignette, high-threshold
//      bloom. (@react-three/postprocessing installed.)
//  14. DioramaScene/Canvas: powerPreference 'high-performance', fewer plane segments
//      on coarse-pointer devices.
//  16. README: describe the actual project + how to add per-chapter artwork
//      (nodes/<slug>/ color+depth pairs — needs new art, stays documented).
import { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import * as THREE from 'three';
import { useProgress, useTexture } from '@react-three/drei';
import DioramaScene from './DioramaScene';
import AmbientSound from './ambientSound';
import { RITE_NAME } from './rites';
// A tiny seeded PRNG (mulberry32) for scattering the drifting quotes — the
// Library is fixed, so a given scatter is the same scatter forever.
const mulberry = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Per-clip playback rate. Every source .mp4 is ~5.05-5.21s; slowing a clip
// stretches its single awakening pass into a longer, more dreamlike drift
// (the still settles whenever the pass truly ends, so this just lengthens
// the motion). Clips omitted here fall back to VIDEO_RATE_DEFAULT. Declared
// up top because both LIBRARY and GARDEN variant pools read it.
const VIDEO_RATE_DEFAULT = 0.42; // → ~12s per pass

// The variant tables and the VIDEO_RATE keys stay on the canonical /video
// path — the swap to a super-resolved file happens once, in servedVideo, as
// the path leaves for the player. This is the floor under that swap: what a
// clip is served when no upscale of it exists anywhere.
//
// It is the SOURCE PIXELS now, not the /video-2x batch it used to be.
// /video-2x is animevideov3, an anime model, and on this footage it loses to
// the plain source: it melts stone granulation and figures into wax. Measured
// on 05-impossible-prison-staircases-var9-clip3, whose 832×354 source is
// magnified across the whole plate at the dwell — the anime 2× draws the
// staircases as smooth ridged ribbons with hard line-art edges, while the
// source, magnified by the GPU's own filtering, is softer but keeps the real
// texture. /video-2x is still on disk and still comparable, by hand: ?sr=2x.
//
// But it is NOT /video. The originals are unfit to serve to a browser: none of
// the 60 carries colour tags, and 16 of them have no faststart — the exact two
// faults this project has already been bitten by. Untagged, the browser reads
// the clip as BT.709 rather than sRGB and the woken surface renders with the
// wrong transfer; without faststart the whole file must arrive before
// readyState reaches HAVE_CURRENT_DATA, and DioramaScene only builds the
// VideoTexture then, so a 9-25 MB clip wakes late or not at all. /video-plain
// holds those clips remuxed — video bitstream copied, verified frame-for-frame
// identical by framemd5, tags and faststart written into the container:
//   ffmpeg -i in.mp4 -c copy -movflags +faststart -bsf:v h264_metadata=\
//     colour_primaries=1:transfer_characteristics=13:matrix_coefficients=1:\
//     video_full_range_flag=0 out.mp4
// This root must hold EVERY clip the tour references, not just the ones the
// shipped chain happens to drop here. It is the fallback of last resort for all
// of VIDEO_SR, so a gap in it is not a missing experiment, it is the silent
// never-wakes failure: the dev server answers a missing file with index.html at
// status 200, the <video> is handed HTML, never decodes, raises no error, and
// the gallery just stays a still. When this held only the two clips `best` drops
// here, the pure A/B keys were quietly dead for everything their own batch did
// not carry — 32 of 40 clips under ?sr=latest, 38 under any mistyped key — which
// makes an A/B a comparison against nothing. All 39 referenced clips with a
// surviving source now live here, remuxed and verified: iec61966-2-1, `moov`
// before `mdat`, and video bitstream identical to the source by framemd5.
//
// The 40th, 01-moonlit-labyrinth-var2-clip2, cannot: no source survives
// anywhere, so it exists only as its super-resolved copies. It is the one clip
// that still dies under a key whose batches do not carry it.
//
// ANY clip newly referenced by the tour must be remuxed to here as well, and any
// clip newly routed to this root must be remuxed the same way first.
const VIDEO_ROOT = '/video-plain';

// Per-file overrides of VIDEO_ROOT, one entry per super-resolution experiment,
// plus the composed default that ships (`best`). `?sr=<key>` picks which one
// is served; an unknown key falls all the way through to VIDEO_ROOT. Only the
// listed files exist in each folder — everything else drops to the key's own
// fallback root, or to VIDEO_ROOT where it names none.
//
// These exist because /video-2x was upscaled with realesr-animevideov3, an
// ANIME model: it flattens organic texture and hardens line art, which melts
// this footage's wisteria strands and hedge granulation into smooth blobs
// (measured — see the header of tools/upscale-videos.ps1). Both experiments
// below keep that texture; they differ in how they buy it. `best` chains them,
// so a clip is served from the best batch that carries it.
//   x4     — Real-ESRGAN realesrgan-x4plus, general purpose, run at 4× and
//            supersampled back down to 1888×800. ~2 h/clip locally on the iGPU,
//            ~2 min/clip on a cloud T4 — see tools/realesrgan_kaggle.ipynb.
//   latest — RealBasicVSR, TEMPORAL (detail aggregated across frames rather
//            than painted in per-frame). Needs a cloud GPU; see
//            tools/realbasicvsr_colab.ipynb.
//   x4i    — the x4 files again, motion-interpolated 24 -> 48 fps
//            (tools/interpolate-clips.ps1, or the .sh twin under Git Bash —
//            WSL's bash cannot see the Windows ffmpeg). Not a sharpness
//            experiment: the
//            surface plays at videoRate ~0.42, which presents 24 fps source as
//            about TEN effective frames per second, and small moving highlights
//            step visibly. Doubling the container rate halves the step; duration
//            is unchanged so every pacing constant keeps its meaning. Measured
//            against ground truth, the synthesised frames score 33-35 dB where
//            frame duplication — what the browser does now — scores 20-29 dB.
//
// An experiment arrives in delivery batches (one cloud session each), so a key
// holds a LIST of them, newest first — a filename in more than one batch
// resolves to the first entry that has it.
//
// ONLY list files that are actually on disk. The dev server answers a missing
// /video-x4/*.mp4 with index.html at status 200, so the <video> gets served
// HTML, never decodes, raises NO error, and the gallery just stays a still —
// indistinguishable from "the clip did not wake".
//
// x4 and x4i share this one list: interpolate-clips.ps1 runs over every file in
// /video-x4, so the two folders hold the same names by construction. Verified
// 1:1 on disk, and keeping it single-source means a later x4 delivery cannot
// leave x4i silently falling through to the source for the new files. It is
// also what `best` reads, so an x4 delivery ships the moment it is listed.
//
// The 42-clip keep-list minus two: var2-clip2 (no source survives anywhere)
// and var2-clip3 (its source is 2548x1080 — already larger than the 2x
// target, so it must be encoded, not upscaled). Plus var0-clip0, the local
// iGPU pilot, which is not on the keep-list at all.
//
// Every file verified as EXACTLY 2x its own source on both axes, 24/1,
// iec61966-2-1, faststart, frame count equal to the source. The size check
// matters: 14 staircases clips shipped at 1888x800 instead of 1664x708
// because the notebook's encode hardcoded the target, and the verify step
// only claimed to check it in a comment (tools/fix-x4-aspect.sh).
const X4_FILES = new Set([
  '01-moonlit-labyrinth-var0-clip0.mp4',
  '01-moonlit-labyrinth-var0-clip1.mp4',
  '01-moonlit-labyrinth-var1-clip0.mp4',
  '01-moonlit-labyrinth-var1-clip2.mp4',
  '01-moonlit-labyrinth-var1-clip3.mp4',
  '01-moonlit-labyrinth-var2-clip1.mp4',
  '01-moonlit-labyrinth-var2-clip4.mp4',
  '02-endless-garden-starry-var1-clip1.mp4',
  '02-endless-garden-starry-var1-clip2.mp4',
  '03-solitary-pavilion-var0-clip0.mp4',
  '03-solitary-pavilion-var0-clip1.mp4',
  '03-solitary-pavilion-var0-clip2.mp4',
  '03-solitary-pavilion-var3-clip0.mp4',
  '03-solitary-pavilion-var3-clip1.mp4',
  '03-solitary-pavilion-var3-clip3.mp4',
  '04-gothic-library-var0-clip0.mp4',
  '04-gothic-library-var0-clip1.mp4',
  '04-gothic-library-var0-clip2.mp4',
  '04-gothic-library-var1-clip0.mp4',
  '04-gothic-library-var1-clip1.mp4',
  '04-gothic-library-var2-clip0.mp4',
  '04-gothic-library-var2-clip1.mp4',
  '04-gothic-library-var2-clip2.mp4',
  '04-gothic-library-var3-clip0.mp4',
  '04-gothic-library-var3-clip1.mp4',
  '04-gothic-library-var3-clip2.mp4',
  '04-gothic-library-var3-clip3.mp4',
  '05-impossible-prison-staircases-var11-clip0.mp4',
  '05-impossible-prison-staircases-var11-clip1.mp4',
  '05-impossible-prison-staircases-var11-clip2.mp4',
  '05-impossible-prison-staircases-var16-clip0.mp4',
  '05-impossible-prison-staircases-var16-clip1.mp4',
  '05-impossible-prison-staircases-var16-clip2.mp4',
  '05-impossible-prison-staircases-var16-clip3.mp4',
  '05-impossible-prison-staircases-var17-clip0.mp4',
  '05-impossible-prison-staircases-var17-clip1.mp4',
  '05-impossible-prison-staircases-var17-clip3.mp4',
  '05-impossible-prison-staircases-var19-clip0.mp4',
  '05-impossible-prison-staircases-var19-clip3.mp4',
  '05-impossible-prison-staircases-var4-clip0.mp4',
  '05-impossible-prison-staircases-var4-clip3.mp4',
]);
const X4_BATCH = { root: '/video-x4', files: X4_FILES };
const LATEST_BATCHES = [
  {
    // Second RealBasicVSR pass. Unlike batch 1 these are all LIVE — each
    // one is drawn by a labyrinth variant pool below, so they show up on
    // an ordinary walk rather than only under ?clip=.
    root: '/video-latest2',
    files: new Set([
      '01-moonlit-labyrinth-var0-clip1.mp4',
      '01-moonlit-labyrinth-var1-clip0.mp4',
      '01-moonlit-labyrinth-var1-clip2.mp4',
      '01-moonlit-labyrinth-var1-clip3.mp4',
      '01-moonlit-labyrinth-var2-clip2.mp4',
    ]),
  },
  {
    root: '/video-latest',
    files: new Set([
      '01-moonlit-labyrinth-var0-clip0.mp4',
      // Both of these are ORPHANS — no variant in the tables below
      // references them, so they can only be reached by ?clip=.
      // starry-var2's still is pulled for being 1680×720; library-var4
      // has no still or depth at all.
      '02-endless-garden-starry-var2-clip1.mp4',
      '04-gothic-library-var4-clip1.mp4',
    ]),
  },
];
// The clips that could not be UPSCALED because they already exceed the 1888x800
// plate, so they were DOWN-encoded to it instead. Only one qualifies: var2-clip3,
// whose 2548x1080 source shipped at 38.6 Mbps / 25.1 MB — the heaviest file a
// walk can meet, on a plate no wider than 1888 anywhere it is drawn, i.e. paying
// for pixels the surface throws away. Re-encoded with lanczos at crf 17:
//   ffmpeg -i in.mp4 -vf scale=1888:800:flags=lanczos -c:v libx264 -profile:v \
//     high -preset slow -crf 17 -pix_fmt yuv420p -color_primaries bt709 \
//     -color_trc iec61966-2-1 -colorspace bt709 -color_range tv -an \
//     -movflags +faststart out.mp4
// 13.3 MB, same 125 frames, same 5.208 s, same 24/1 — verified by ffprobe.
//
// This is deliberately NOT filed under X4_FILES. That set is single-sourced for
// both /video-x4 and /video-x4-48 (interpolate-clips runs over the x4 folder, so
// the two hold the same names by construction), and a name listed there without
// a twin in /video-x4-48 would make ?sr=x4i request a file the dev server
// answers with index.html at status 200 — the silent never-wakes failure the
// header warns about. A separate root keeps that invariant true.
const FIT_BATCH = {
  root: '/video-fit',
  files: new Set(['01-moonlit-labyrinth-var2-clip3.mp4']),
};
const VIDEO_SR = {
  // What actually SHIPS. The experiment keys below each answer for their own
  // batch and nothing else — which is right for an A/B and wrong for a walk,
  // because every clip a key does not carry drops to VIDEO_ROOT. Under the old
  // default (`latest`) that meant the whole tour ran on the animevideov3 batch
  // apart from the six reachable RealBasicVSR clips — 32 of the 40 clips a walk
  // can meet, including every staircase in the library, while their x4plus twins
  // sat on disk better by every measure taken here, reachable only by ?sr=x4.
  //
  // So the default is a CHAIN across experiments rather than one of them:
  // newest RealBasicVSR pass, then the first, then x4plus, then (via `root`)
  // the untouched source. Each clip is served the best version that exists of
  // it, and adding a delivery to any experiment above lifts the default with
  // it. The pure keys stay pure, so an A/B is still an A/B.
  best: {
    batches: [...LATEST_BATCHES, X4_BATCH, FIT_BATCH],
    root: VIDEO_ROOT,
  },
  // The shipped-until-now anime batch, on its own, for comparing against what
  // replaced it. This is what `?sr=off` used to give by falling through.
  '2x': {
    batches: [],
    root: '/video-2x',
  },
  x4: {
    batches: [X4_BATCH],
  },
  // Interpolated to 48 fps. A/B against ?sr=x4 to judge the motion on its own —
  // the spatial detail is identical file for file, so any difference you see is
  // the frame rate and nothing else. Both keys now cover the same 41 clips, so
  // that comparison is clean everywhere rather than on a 12-clip subset.
  //
  // All 41 verified against their x4 source: same pixel dimensions, 48/1, sRGB
  // trc, faststart, 2x-1 frames, duration within 63 ms (minterpolate drops the
  // frames it cannot bracket at the tail — far under one frame of drift at the
  // ~0.42 videoRate, and no pacing constant reads fps anyway).
  x4i: {
    batches: [{ root: '/video-x4-48', files: X4_FILES }],
  },
  latest: {
    batches: LATEST_BATCHES,
  },
};
const SR_KEY = typeof window === 'undefined'
  ? 'best'
  : new URLSearchParams(window.location.search).get('sr') ?? 'best';
const servedVideo = (path) => {
  if (!path) return path;
  const file = path.slice('/video/'.length);
  const key = VIDEO_SR[SR_KEY];
  const batch = key?.batches.find((b) => b.files.has(file));
  // A key may name its own fallback for the clips its batches do not carry;
  // an experiment key that names none keeps dropping to VIDEO_ROOT, so the
  // one file under test is the only thing that differs between two keys.
  return batch
    ? `${batch.root}/${file}`
    : (key?.root ?? VIDEO_ROOT) + path.slice('/video'.length);
};
// A clip slowed below ~0.5 is not just slower, it is COARSER: the source is
// 24 fps, so 0.38 presents about NINE distinct frames per second, and every
// frame is held long enough to be read as a frame. On architecture that is
// invisible — stone does not move between them. On anything that deforms
// between frames rather than translating (i2v figures, drifting petals, birds)
// it is the opposite of a slow drift: it is a slideshow of slightly different
// creatures, and the eye reads the difference as morphing precisely because it
// has time to. The four clips that carry PEOPLE were the four dialled slowest,
// which put the coarsest cadence exactly where the subject could least afford
// it. They now run at 0.58 — ~9.0 s per pass, ~14 effective fps.
//
// The architecture clips keep their slower numbers. They were dialled for the
// length of the drift, and nothing in them deforms.
const VIDEO_RATE = {
  '/video/04-gothic-library-var2-clip1.mp4': 0.58,  // the lone reader before the far moon → ~8.7s
  '/video/04-gothic-library-var3-clip1.mp4': 0.42,  // grand candlelit hall reveal → ~12.4s
  '/video/04-gothic-library-var3-clip2.mp4': 0.42,
  '/video/02-endless-garden-starry-var2-clip1.mp4': 0.58,   // starry delta, ghost figures → ~9.0s
  '/video/02-endless-garden-starry-var1-clip1.mp4': 0.58,
  '/video/02-endless-garden-starry-var1-clip2.mp4': 0.58,   // figures drift; the worst of the four
  '/video/01-moonlit-labyrinth-var2-clip3.mp4': 0.42, // the wide 1080p labyrinth → ~12.4s
};

// Draw one variant of a node at random (stable seed would defeat the "world
// stirs on revisit" point) and, if it carries video clips, one clip from it.
// Pinning, for looking at ONE painting/clip pairing on demand instead of
// waiting for it — every pool is a random draw, so a given pairing can be
// many revisits away. Both take a filename fragment; nodes that match neither
// are drawn at random as usual. Pair with ?node=<slug> (below) to land on the
// node holding them rather than walking there.
//   ?variant=01-moonlit-labyrinth-var0     — pin the painting
//   ?clip=01-moonlit-labyrinth-var0-clip1  — pin the clip
// Given together they may name DIFFERENT variants, which deliberately plays
// one painting under another's clip — that cross-pairing is how a clip is
// judged against the still it is supposed to be animating.
const pinParam = (key) => (typeof window === 'undefined'
  ? null
  : new URLSearchParams(window.location.search).get(key));
const PIN_VARIANT = pinParam('variant');
const PIN_CLIP = pinParam('clip');

// Anything pinned is meant to STAY pinned — the point of ?variant/?clip is to
// hold one pairing still and look at it — so a pinned session never restocks.
const PINNED = Boolean(PIN_VARIANT || PIN_CLIP);

// The renderable half of a node: everything a chapter's slab stack and glow
// need, and the only half that changes when a gallery re-draws itself.
const sceneOf = (node, variant, video) => ({
  color: variant.color,
  depth: variant.depth,
  glowAt: variant.glowAt,
  glowScale: variant.glowScale,
  video: servedVideo(video),
  videoRate: video ? (VIDEO_RATE[video] ?? VIDEO_RATE_DEFAULT) : undefined,
  fog: node.fog,
});

// A gallery ought to be able to STIR. Several plates in the pools carry no
// clip — the mismatched i2v pairs that were pulled for animating a different
// painting (pavilion var1/var2), and the four original Midjourney descent
// plates, which have none — and while the draw treated every variant alike,
// each visit was a coin flip on whether the room could move at all: 1/3 at the
// Echo and the Vertigo, 1/2 at the Silence and the Pavilion, on load AND on
// every restock. So a living plate is always preferred, and a still-only one is
// hung only where its node has nothing living to offer. That is the Vestibule
// today and nowhere else: its lone plate has no clip, and the one staircase
// variant that could have filled the slot renders ghosted there (see the note
// on its variants). The still-only plates are not retired — they still hang
// wherever they are all a node has — they simply stop displacing a clip.
const livingFirst = (variants) => {
  const living = variants.filter((v) => v.videos?.length);
  return living.length ? living : variants;
};

// Re-draw one gallery: a different version of the same room, for the restock in
// the tick below. Never the version just shown — with two variants that
// alternates, with four it wanders — and where a node owns only one painting, a
// different clip of it still counts as a different version of the room. Returns
// null when the node has nothing else to show, so the caller can drop it from
// the rotation rather than churn its textures for the same picture.
const redrawScene = (nodeMap, slug, current) => {
  const node = nodeMap[slug];
  const others = livingFirst(node.variants.filter((v) => v.color !== current.color));
  const variant = others.length
    ? others[Math.floor(Math.random() * others.length)]
    : node.variants.find((v) => v.color === current.color) ?? node.variants[0];
  const clips = variant.videos ?? [];
  const unseen = clips.filter((p) => servedVideo(p) !== current.video);
  const pool = unseen.length ? unseen : clips;
  const video = pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;
  // Fog is the node's mood, not the variant's, and `current` already carries the
  // right one even where a chapter is standing in for another (GARDEN_ART_READY).
  const next = { ...sceneOf(node, variant, video), fog: current.fog };
  return (next.color === current.color && next.video === current.video) ? null : next;
};

const selectRandomVariant = (nodeMap, slug) => {
  const node = nodeMap[slug];
  const byVariant = PIN_VARIANT
    ? node.variants.find((v) => v.color.includes(PIN_VARIANT))
    : undefined;
  const byClip = PIN_CLIP
    ? node.variants.find((v) => v.videos?.some((p) => p.includes(PIN_CLIP)))
    : undefined;
  const pool = livingFirst(node.variants);
  const variant = byVariant ?? byClip
    ?? pool[Math.floor(Math.random() * pool.length)];
  // The pinned clip is looked for in the chosen variant first, then anywhere in
  // the node — so ?variant=A&clip=B lands B's video on A's painting.
  const pinnedVideo = PIN_CLIP
    ? (variant.videos?.find((p) => p.includes(PIN_CLIP))
      ?? node.variants.flatMap((v) => v.videos ?? []).find((p) => p.includes(PIN_CLIP)))
    : undefined;
  const video = pinnedVideo ?? (variant.videos
    ? variant.videos[Math.floor(Math.random() * variant.videos.length)]
    : undefined);
  return {
    slug,
    title: node.title,
    subtitle: node.subtitle,
    summary: node.summary,
    accent: node.accent,
    scene: sceneOf(node, variant, video),
    folio: node.folio,
  };
};

// The 05-impossible-prison-staircases batch (see source-assets/staircases/):
// cropped to 21:9 and installed as color .webp in public/nodes/descent/, but
// none has a depth map yet (Depth Anything V2 pass is a manual, external
// step — see the handoff note left in that folder). Flip this the moment the
// six matching `*-depth.webp` files land; until then every node's variants
// array collapses to just its original single image, so behaviour today is
// byte-for-byte what it was before this batch existed.
const STAIRCASE_READY = true;

// Two worlds on one corridor. Each node owns its relief (color + depth pair),
// the [u, v] anchor of its light source (where the lamp glow hangs), its fog
// mood, and its accent — so descending re-grades the whole world, not just
// the picture. The library's four galleries come first; dwelling in the
// deepest one opens a door onto the garden's four paths (see GARDEN.md).
//
// Same variants+video shape as GARDEN_NODE_VARIANTS below: one Midjourney
// original per node plus (once STAIRCASE_READY) a couple of the new
// staircase renders, each an image-to-video pair that breathes on dwell.
const LIBRARY_NODE_VARIANTS = {
  vestibule: {
    title: 'The Vestibule',
    subtitle: 'Threshold of the archive',
    summary: 'Twin stairways rise into the dark, chains hang like plumb lines, and one robed reader waits at the door of fire.',
    accent: '#c9a24c',
    variants: [
      {
        color: '/nodes/descent/impossible_1.webp',
        depth: '/nodes/descent/impossible_1_depth.webp',
        glowAt: [0.515, 0.84], glowScale: 0.85,
      },
      // var9 (twin curved staircases at a lit doorway) is PULLED. In this slot
      // it renders washed out and ghosted — the depth cards visibly draw the
      // same content offset from each other — while the original art above and
      // the other staircase plates render correctly in the very same build and
      // camera state. Its color image, depth pairing, luminance, depth
      // histogram, ramp-linearity, flat-region area and largest contiguous
      // near mass were all measured and all sit inside the range of the four
      // originals, so nothing about the asset explains it and the cause is
      // still unknown. Pulled rather than shipped broken; the files are still
      // in public/nodes/descent if someone wants another run at it.
    ],
    fog: '#16110a',
    folio: {
      eyebrow: 'NODE I — THE VESTIBULE',
      line: '"The universe (which others call the Library)…"',
      attr: 'J. L. BORGES — LA BIBLIOTECA DE BABEL, 1941',
      lineEs: '"El universo (que otros llaman la Biblioteca)…"',
      attrEs: 'J. L. BORGES — LA BIBLIOTECA DE BABEL, 1941',
    },
  },
  echo: {
    title: 'The Echo',
    subtitle: 'A corridor of repeated forms',
    summary: 'Stairs cross stairs and arcades answer arcades — every passage insists it has been walked before.',
    accent: '#d9b06a',
    variants: [
      {
        color: '/nodes/descent/impossible_2.webp',
        depth: '/nodes/descent/impossible_2_depth.webp',
        glowAt: [0.655, 0.72], glowScale: 1.0,
      },
      ...(STAIRCASE_READY ? [
        {
          // Two great flights winding past a lit shrine — the same stair arriving
          // at itself from both sides.
          //
          // Replaced var16 here (nested arches echoing toward a lit tunnel), which
          // read badly walked-in: its content is mostly large smooth vaulting, and
          // the still's unsharp mask taps at a fixed TEXTURE texel, so magnifying
          // the plate magnifies the halo into hard etching along every balustrade.
          // var16's plate and its four clips are all still on disk and verified —
          // put it back if the sharpen is ever reworked to tap in screen space.
          color: '/nodes/descent/05-impossible-prison-staircases-var9.webp',
          depth: '/nodes/descent/05-impossible-prison-staircases-var9-depth.webp',
          videos: [
            // The only clip for this plate, and one of just two reachable clips
            // with no super-resolved twin anywhere: it was left off the upscale
            // keep-list as an orphan, back when no variant referenced var9. So
            // it plays from its 832×354 source, which is honest but soft under
            // the walk-in's magnification — this is the gallery to look at when
            // judging whether a clip needs the x4plus pass. Add it to
            // tools/upscale-keeplist.txt on the next run.
            '/video/05-impossible-prison-staircases-var9-clip3.mp4',
          ],
          // Starting estimate from the plate's dominant warm source; the shrine
          // glow sits right of centre. Worth an eye — the automatic pick agrees
          // with the hand-tuned value on impossible_2 but not on plates with
          // several competing lamps, which this one has.
          glowAt: [0.73, 0.58], glowScale: 1.0,
        },
        {
          // A whole procession crossing the bridge — repetition made literal.
          color: '/nodes/descent/05-impossible-prison-staircases-var17.webp',
          depth: '/nodes/descent/05-impossible-prison-staircases-var17-depth.webp',
          videos: [
            '/video/05-impossible-prison-staircases-var17-clip0.mp4',
            '/video/05-impossible-prison-staircases-var17-clip1.mp4',
            '/video/05-impossible-prison-staircases-var17-clip3.mp4',
          ],
          glowAt: [0.69, 0.76], glowScale: 0.85,
        },
      ] : []),
    ],
    fog: '#141009',
    folio: {
      eyebrow: 'NODE II — THE ECHO',
      line: '"To speak is to fall into tautology."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
      lineEs: '"Hablar es incurrir en tautologías."',
      attrEs: 'J. L. BORGES — LA BIBLIOTECA DE BABEL',
    },
  },
  silence: {
    title: 'The Silence',
    subtitle: 'Where the lamps grow faint',
    summary: 'At the deepest reach the stairways still their crossing, and a single lamp keeps the dark honest.',
    accent: '#c98a3e',
    variants: [
      {
        color: '/nodes/descent/impossible_4.webp',
        depth: '/nodes/descent/impossible_4_depth.webp',
        glowAt: [0.57, 0.86], glowScale: 0.8,
      },
      ...(STAIRCASE_READY ? [{
        // Darkest of the batch: one hooded figure on a high landing, one
        // small flame keeping the dark honest below.
        color: '/nodes/descent/05-impossible-prison-staircases-var19.webp',
        depth: '/nodes/descent/05-impossible-prison-staircases-var19-depth.webp',
        videos: [
          '/video/05-impossible-prison-staircases-var19-clip0.mp4',
          '/video/05-impossible-prison-staircases-var19-clip3.mp4',
        ],
        glowAt: [0.49, 0.88], glowScale: 0.75,
      }] : []),
    ],
    fog: '#0f0d0b',
    folio: {
      eyebrow: 'NODE III — THE SILENCE',
      line: '"Light is provided by spherical fruit which bear the name of lamps."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
      lineEs: '"La luz procede de unas frutas esféricas que llevan el nombre de lámparas."',
      attrEs: 'J. L. BORGES — LA BIBLIOTECA DE BABEL',
    },
  },
  // The threshold. The vortex is the last gallery: dwell here and its warm
  // tunnel core kindles into a portal; descending then plunges the camera
  // down the spiral and out into the garden (see the dive in DioramaScene's
  // DescentRig). glowAt is pinned to that receding core on every variant.
  vertigo: {
    title: 'The Vertigo',
    subtitle: 'The stairwell that has no floor',
    summary: 'The galleries curl into a spiral pit that winds down toward a single warm light, and the count of the books refuses to close.',
    accent: '#c9a24c',
    variants: [
      {
        color: '/nodes/descent/impossible_3.webp',
        depth: '/nodes/descent/impossible_3_depth.webp',
        glowAt: [0.83, 0.82], glowScale: 1.3,
      },
      ...(STAIRCASE_READY ? [
        {
          // A true double-helix spiral — the most vertiginous still in the
          // batch, a distant warm point where the two stairs finally meet.
          color: '/nodes/descent/05-impossible-prison-staircases-var4.webp',
          depth: '/nodes/descent/05-impossible-prison-staircases-var4-depth.webp',
          videos: [
            '/video/05-impossible-prison-staircases-var4-clip0.mp4',
            '/video/05-impossible-prison-staircases-var4-clip3.mp4',
          ],
          glowAt: [0.61, 0.54], glowScale: 0.7,
        },
        {
          // A single spiral winding down into a lit tunnel mouth.
          color: '/nodes/descent/05-impossible-prison-staircases-var11.webp',
          depth: '/nodes/descent/05-impossible-prison-staircases-var11-depth.webp',
          videos: [
            '/video/05-impossible-prison-staircases-var11-clip0.mp4',
            '/video/05-impossible-prison-staircases-var11-clip1.mp4',
            '/video/05-impossible-prison-staircases-var11-clip2.mp4',
          ],
          glowAt: [0.49, 0.88], glowScale: 0.95,
        },
      ] : []),
    ],
    fog: '#0b0f15',
    folio: {
      eyebrow: 'NODE IV — THE VERTIGO',
      line: '"The certitude that everything has been written negates us or turns us into phantoms."',
      attr: 'J. L. BORGES — THE LIBRARY OF BABEL',
      lineEs: '"La certidumbre de que todo está escrito nos anula o nos afantasma."',
      attrEs: 'J. L. BORGES — LA BIBLIOTECA DE BABEL',
    },
  },
};

const LIBRARY_SLUGS = ['vestibule', 'echo', 'silence', 'vertigo'];
const LIBRARY_NODES = LIBRARY_SLUGS.map((slug) =>
  selectRandomVariant(LIBRARY_NODE_VARIANTS, slug));

// The garden — Borges' other 1941 labyrinth, from the collection that gave
// the Library its home. Warm amber cools into jade, flares gold once at the
// pavilion, then dissolves into moon-silver.
//
// Each node offers several Midjourney variants; one is drawn per page load.
// A variant's `videos` are image-to-video renders OF THAT EXACT ARTWORK —
// when the camera dwells at the node, DioramaScene crossfades the relief's
// surface from the still to its playing video, so the world itself stirs
// (matched by content, not filename: the "library_*.mp4" clips are all Door
// artwork and must never play elsewhere).
const GARDEN_NODE_VARIANTS = {
  door: {
    title: 'The Door',
    subtitle: 'One volume was a gate',
    summary: 'Between two shelves the stone gives way; beyond the jamb, hedges breathe under a green moon.',
    accent: '#9fc48a',
    variants: [
      {
        color: '/nodes/garden/04-gothic-library-var0.webp',
        depth: '/nodes/garden/04-gothic-library-var0-depth.webp',
        videos: ['/video/04-gothic-library-var0-clip0.mp4', '/video/04-gothic-library-var0-clip1.mp4', '/video/04-gothic-library-var0-clip2.mp4'],
        glowAt: [0.5, 0.45], glowScale: 1.1,
      },
      {
        // Cathedral-nave aisle, books and chains flanking a pointed arch that
        // floods green — the clearest "half library, half garden" read of any
        // variant so far, the figure standing right in the threshold light.
        color: '/nodes/garden/04-gothic-library-var1.webp',
        depth: '/nodes/garden/04-gothic-library-var1-depth.webp',
        videos: ['/video/04-gothic-library-var1-clip0.mp4', '/video/04-gothic-library-var1-clip1.mp4'],
        glowAt: [0.505, 0.39], glowScale: 1.15,
      },
      {
        color: '/nodes/garden/04-gothic-library-var2.webp',
        depth: '/nodes/garden/04-gothic-library-var2-depth.webp',
        videos: ['/video/04-gothic-library-var2-clip0.mp4', '/video/04-gothic-library-var2-clip1.mp4', '/video/04-gothic-library-var2-clip2.mp4'],
        glowAt: [0.47, 0.7], glowScale: 0.9,
      },
      {
        color: '/nodes/garden/04-gothic-library-var3.webp',
        depth: '/nodes/garden/04-gothic-library-var3-depth.webp',
        videos: ['/video/04-gothic-library-var3-clip0.mp4', '/video/04-gothic-library-var3-clip1.mp4', '/video/04-gothic-library-var3-clip2.mp4', '/video/04-gothic-library-var3-clip3.mp4'],
        glowAt: [0.49, 0.5], glowScale: 1.0,
      },
    ],
    fog: '#0b1209',
    folio: {
      eyebrow: 'NODE V — THE DOOR',
      line: '"I leave to the various futures (not to all) my garden of forking paths."',
      attr: 'J. L. BORGES — THE GARDEN OF FORKING PATHS, 1941',
      lineEs: '"Dejo a los varios porvenires (no a todos) mi jardín de senderos que se bifurcan."',
      attrEs: 'J. L. BORGES — EL JARDÍN DE SENDEROS QUE SE BIFURCAN, 1941',
    },
  },
  fork: {
    title: 'The Fork',
    subtitle: 'Every path taken at once',
    summary: 'The pale gravel divides and divides again, and each branch insists it is the one you chose.',
    accent: '#7fbf8e',
    variants: [
      {
        // Lantern-lined avenue, wisteria overhead, the robed figure walking
        // away down the centre line toward a warm box-lantern at right.
        color: '/nodes/garden/01-moonlit-labyrinth-var0.webp',
        depth: '/nodes/garden/01-moonlit-labyrinth-var0-depth.webp',
        // clip0 PULLED: it is not an animation of this painting at all — a
        // different composition in a different (cartoon/CGI) register, so waking
        // the gallery replaced the plate wholesale. SSIM of its first frame
        // against this still is 0.32, where every honest i2v pair in the pool
        // scores 0.90+ (an i2v render is seeded FROM the still, so frame 0 must
        // resemble it; later divergence is just the camera moving and is fine).
        videos: ['/video/01-moonlit-labyrinth-var0-clip1.mp4'],
        glowAt: [0.68, 0.6], glowScale: 0.95,
      },
      {
        color: '/nodes/garden/01-moonlit-labyrinth-var1.webp',
        depth: '/nodes/garden/01-moonlit-labyrinth-var1-depth.webp',
        videos: ['/video/01-moonlit-labyrinth-var1-clip0.mp4', '/video/01-moonlit-labyrinth-var1-clip2.mp4', '/video/01-moonlit-labyrinth-var1-clip3.mp4'],
        glowAt: [0.74, 0.55], glowScale: 0.85,
      },
      {
        color: '/nodes/garden/01-moonlit-labyrinth-var2.webp',
        depth: '/nodes/garden/01-moonlit-labyrinth-var2-depth.webp',
        videos: ['/video/01-moonlit-labyrinth-var2-clip1.mp4', '/video/01-moonlit-labyrinth-var2-clip2.mp4', '/video/01-moonlit-labyrinth-var2-clip3.mp4', '/video/01-moonlit-labyrinth-var2-clip4.mp4'],
        glowAt: [0.585, 0.56], glowScale: 0.9,
      },
    ],
    fog: '#0a140d',
    folio: {
      eyebrow: 'NODE VI — THE FORK',
      line: '"In the fiction of Ts\'ui Pên, he chooses — simultaneously — all of them."',
      attr: 'J. L. BORGES — THE GARDEN OF FORKING PATHS',
      lineEs: '"En la obra de Ts\'ui Pên, opta —simultáneamente— por todos."',
      attrEs: 'J. L. BORGES — EL JARDÍN DE SENDEROS QUE SE BIFURCAN',
    },
  },
  pavilion: {
    title: 'The Pavilion',
    subtitle: 'Where the lamp keeps every future',
    summary: 'Over black water a single pavilion burns warm, and its music seems to arrive from all your lives at once.',
    accent: '#e0b45c',
    variants: [
      {
        color: '/nodes/garden/03-solitary-pavilion-var0.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var0-depth.webp',
        videos: ['/video/03-solitary-pavilion-var0-clip0.mp4', '/video/03-solitary-pavilion-var0-clip1.mp4', '/video/03-solitary-pavilion-var0-clip2.mp4'],
        glowAt: [0.5, 0.55], glowScale: 1.15,
      },
      {
        color: '/nodes/garden/03-solitary-pavilion-var1.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var1-depth.webp',
        // clip0 PULLED (frame-0 SSIM 0.37 vs 0.90+ for every honest pair): it
        // renders a DIFFERENT gothic doorway — same register, not the same
        // painting. Still-only until a clip is generated from this plate.
        glowAt: [0.56, 0.55], glowScale: 1.1,
      },
      {
        color: '/nodes/garden/03-solitary-pavilion-var2.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var2-depth.webp',
        // BOTH clips PULLED (frame-0 SSIM 0.37): same story as var1 above —
        // a different doorway, differently framed. Still-only for now.
        glowAt: [0.3, 0.52], glowScale: 1.0,
      },
      {
        color: '/nodes/garden/03-solitary-pavilion-var3.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var3-depth.webp',
        videos: ['/video/03-solitary-pavilion-var3-clip0.mp4', '/video/03-solitary-pavilion-var3-clip1.mp4', '/video/03-solitary-pavilion-var3-clip3.mp4'],
        glowAt: [0.55, 0.55], glowScale: 1.1,
      },
    ],
    fog: '#0d1309',
    folio: {
      eyebrow: 'NODE VII — THE PAVILION',
      line: '"The Garden of Forking Paths is an enormous riddle, or parable, whose theme is time."',
      attr: 'J. L. BORGES — THE GARDEN OF FORKING PATHS',
      lineEs: '"El jardín de senderos que se bifurcan es una enorme adivinanza, o parábola, cuyo tema es el tiempo."',
      attrEs: 'J. L. BORGES — EL JARDÍN DE SENDEROS QUE SE BIFURCAN',
    },
  },
  web: {
    title: 'The Web of Time',
    subtitle: 'Strands that bifurcate and ignore each other',
    summary: 'The paths stop pretending to be paths: in every direction you are already walking, choosing otherwise.',
    accent: '#a9c9d8',
    variants: [
      {
        color: '/nodes/garden/02-endless-garden-starry-var1.webp',
        depth: '/nodes/garden/02-endless-garden-starry-var1-depth.webp',
        videos: ['/video/02-endless-garden-starry-var1-clip1.mp4', '/video/02-endless-garden-starry-var1-clip2.mp4'],
        glowAt: [0.48, 0.31], glowScale: 0.7,
      },
      // var2 pulled from rotation: the still is only 1680×720 (missed the MJ
      // upscale step). Restore once re-exported at 3376×1440 with a fresh depth map.
    ],
    fog: '#0c1114',
    folio: {
      eyebrow: 'NODE VIII — THE WEB OF TIME',
      line: '"This web of time — the strands of which approach one another, bifurcate, intersect or ignore each other — embraces every possibility."',
      attr: 'J. L. BORGES — THE GARDEN OF FORKING PATHS',
      lineEs: '"Esta trama de tiempos que se aproximan, se bifurcan, se cortan o que secularmente se ignoran, abarca todas las posibilidades."',
      attrEs: 'J. L. BORGES — EL JARDÍN DE SENDEROS QUE SE BIFURCAN',
    },
  },
};

const GARDEN_SLUGS = ['door', 'fork', 'pavilion', 'web'];
const GARDEN_NODES = GARDEN_SLUGS.map((slug) =>
  selectRandomVariant(GARDEN_NODE_VARIANTS, slug));

const GARDEN_ART_READY = true;

const NODES = [
  ...LIBRARY_NODES,
  ...GARDEN_NODES.map((node, i) => (GARDEN_ART_READY ? node : {
    ...node,
    scene: { ...LIBRARY_NODES[i].scene, fog: node.scene.fog },
  })),
];

// Which pool each chapter re-draws from when it restocks. While the garden is
// still running on the library's stand-in art, its chapters restock out of the
// library pool they borrowed, so a placeholder never re-hangs itself with a
// painting it has no depth map for.
const POOLS = [
  ...LIBRARY_SLUGS.map((slug) => ({ map: LIBRARY_NODE_VARIANTS, slug })),
  ...GARDEN_SLUGS.map((slug, i) => (GARDEN_ART_READY
    ? { map: GARDEN_NODE_VARIANTS, slug }
    : { map: LIBRARY_NODE_VARIANTS, slug: LIBRARY_SLUGS[i] })),
];

// ── The Fork ────────────────────────────────────────────────────────────────
// The garden is forking paths; the corridor was a line. Every gallery drew its
// variant at random on load, so WHICH of the Fork's gardens the reader walked
// into was settled before they arrived and by nothing they did — the one room
// in the piece whose whole subject is that a choice was made.
//
// So the crossing into it is a choice now. Two of its gardens are drawn as
// candidates, and which becomes real is decided by where the reader is LOOKING
// as they cross: yaw at the commit point, nothing else. The other never
// existed — or rather, it existed on the path not taken, which is what the
// whisper on the far side says.
const FORK_INDEX = LIBRARY_SLUGS.length + 1;  // VI, the second room of the garden
// How far into the V → VI crossing the choice is committed. Late enough that
// the reader has had the whole approach to turn, early enough that the arriving
// gallery is still buried in fog when it is swapped, so nothing pops.
const FORK_COMMIT = 0.42;
// How far the gaze must be off the corridor's axis to count as a turn. The yaw
// eases back toward centre on its own, so a turn has to be HELD through the
// commit rather than flicked. Under this the reader chose nothing, and the
// world draws for them — silently, because the whisper would be claiming they
// turned when they did not.
const FORK_YAW = 0.06;
const FORK_WHISPER_MS = 6600;
const forkWhisper = (missed) => `in another garden, you turned ${missed}.`;

// Two DIFFERENT gardens to hang either side of the path. Null where the node
// cannot offer two, in which case there is no fork and the crossing behaves as
// it always did. Drawn once per visit rather than per crossing: walking back up
// and down again must not re-roll a road already taken.
const forkCandidates = () => {
  const { map, slug } = POOLS[FORK_INDEX];
  const node = map[slug];
  const pool = livingFirst(node.variants);
  if (pool.length < 2) return null;
  const a = Math.floor(Math.random() * pool.length);
  // Draw the second from the remaining ones by index, so the two can never be
  // the same garden and neither is favoured.
  let b = Math.floor(Math.random() * (pool.length - 1));
  if (b >= a) b += 1;
  const hang = (variant) => {
    const clips = variant.videos ?? [];
    return sceneOf(node, variant,
      clips.length ? clips[Math.floor(Math.random() * clips.length)] : undefined);
  };
  return { left: hang(pool[a]), right: hang(pool[b]) };
};

// A gallery may only be re-hung while nobody can see it. Behind the camera
// DioramaScene's depth-ordered melt has swept clear of the whole plate by about
// half a chapter past it (`th` drops under the depth range at uFade ~0.71) and
// it stops being drawn at 0.96; ahead, it stays culled until 1.4 chapters out.
//
// Two thresholds, because arming a gallery and hanging it happen a moment apart.
// A gallery is only ARMED from a whole-number rest point — standing in a room,
// the one at your back qualifies, and that is exactly what lets the room you
// just left be a different room when you turn around. It is still HUNG if the
// reader has started walking since, as long as the plate is safely inside its
// dissolve: that slack is worth about a second and a half of the crossing's
// ease, so turning straight back does not cost you the fresh painting. Ahead
// there is no such slack — the melt runs behind the camera only — so the commit
// edge sits just past the cull.
const ARMED = { behind: 0.99, ahead: 1.6 };
const COMMIT = { behind: 0.72, ahead: 1.45 };
const outOfSight = (descent, index, edge) => {
  const behind = descent - index;
  return behind > edge.behind || behind < -edge.ahead;
};

// Decode a scene's plates before hanging them, so the swap itself costs nothing.
const decodePlates = (scene) => Promise.all([scene.color, scene.depth].map(
  (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
    if (img.decode) img.decode().then(resolve, resolve);
  }),
));

const LIBRARY_MAX = LIBRARY_NODES.length - 1;
const MAX = NODES.length - 1;
const clamp = (v, max) => Math.min(Math.max(v, 0), max);
const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// Pre-parse accent colors once for continuous interpolation between chapters.
const ACCENTS = NODES.map((n) => new THREE.Color(n.accent));

// The marginal hand names where you are in words rather than in a panel:
// "THE SILENCE — GALLERY III", "THE FORK — PATH II". A reader of the Library
// would number its rooms, not read a progress meter. The same numeral marks
// the node on the plumb line.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const NUMERAL = NODES.map((_, i) =>
  ROMAN[(i > LIBRARY_MAX ? i - LIBRARY_MAX : i + 1) - 1]);
const MARKS = NODES.map((node, i) =>
  `${node.title.toUpperCase()} — ${i > LIBRARY_MAX ? 'PATH' : 'GALLERY'} ${NUMERAL[i]}`);

// What the world says when it refuses a step. At the sealed vertigo the refusal
// is temporary and the whisper says so — the wait IS the key, so this is the
// same instruction the help panel gives, spoken at the moment it applies. At the
// far end of the garden nothing further opens, so it names the end instead.
// Timings are matched to .door-whisper.is-refusal's appear-hold-fade run.
const REFUSAL_WHISPER_MS = 5200;
const REFUSE_MS = 900; // one answer per bump; a scroll burst is still one bump
// At the path's end "turn back" is not only spoken — after it has hung long
// enough to be read, the world carries it out and walks the reader back itself.
const TURN_BACK_MS = 2600;
const SEALED_WHISPER = 'the stair ends in dark. wait.';
const PATH_END_WHISPER = 'the web closes here. turn back.';

// The quote hangs in the air rather than lying on a page (design: 3b). Each
// word sits at one of three depths — near words large and sharp, far ones
// small, dimmed and out of focus — so the sentence has volume.
//
// It breathes rather than being posted: words gather out of the air in no
// particular order, the sentence holds long enough to be read, then it
// dissolves word by word — in a different order again — and after a pause of
// empty air it begins over. Nothing arrives in reading order, so the sentence
// assembles itself in front of you rather than being typed out.
//
// Sizes are vw, so the field scales with the frame. That alone isn't enough
// across the range this app has to cover: the wide bands reproduce the
// design's 86/54/38px on a 1920 canvas, but the same numbers on a phone
// render the sentence at 17px. The narrow set trades depth contrast for
// legibility and packs wider rows, and the layout below is run once for each.
const LEAD_MS = 700;      // a beat of empty air before the first word
const APPEAR_MS = 2000;   // one word's gathering
const APPEAR_STEP = 230;  // …and the beat between them
// One word's dissolving is 2200ms — owned by `scatter-gone` in tour.css and no
// longer needed here, now that nothing has to know when the field goes empty.
const VANISH_STEP = 150;  // the beat between one word leaving and the next
// The dissolve's own length, matching `scatter-gone` in tour.css. Nothing in
// the layout needs it — a word's disappearance is entirely the CSS animation's
// business — but the drift does, to know when the last word is actually gone
// rather than merely started leaving. Keep in step with the stylesheet.
const SCATTER_GONE_MS = 2200;

// The drift's floor and ceiling. Between them it waits on the room itself: the
// quote's full cycle, and the surface's first pass.
//   MIN — even a room that says nothing gets long enough to be looked at, and
//         it covers the ~7 s crossing that precedes the dwell.
//   MAX — nothing may stall the drift forever. A gallery with no clip, one
//         whose clip fails to decode, or a tab throttled in the background all
//         land here, and the drift moves on rather than parking.
const DRIFT_MIN_DWELL = 9000;
const DRIFT_MAX_DWELL = 38000;

// How long the assembled sentence stands. Scaled to its length rather than
// fixed: the words are readable as they land, so this is only the tail after
// the last one arrives — but twenty-two of them still need longer to finish
// than seven. (7 → 2.2s, 12 → 2.7s, 22 → 3.6s.)
const holdFor = (count) => 1600 + count * 90;

// Fisher–Yates on the seeded PRNG: the same hand scatters it every visit.
const shuffled = (n, rand) => {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// The design's far band is 38px at 0.6 opacity under 3.2px of blur. Against
// its one quote that reads as atmosphere; across eight it loses whole words —
// the Silence's "fruit" and "lamps" simply weren't there. These bands keep the
// depth but hold every word legible: the sentence is the content, not texture.
const SCATTER_WIDE = {
  bands: [
    { size: 4.48, blur: 0, opacity: 1 },
    { size: 3.2, blur: 1.2, opacity: 0.9 },
    { size: 2.5, blur: 2.2, opacity: 0.72 },
  ],
  rowMax: 74,   // percent of viewport width a row may fill
  rowStep: 11.5, // percent of viewport height between rows
  centre: 50,   // the vertical line rows are centred on
  // The LAST row's centre line, not the field's middle. Anchoring the bottom
  // keeps every quote sitting low in the frame whatever its length — a long
  // one grows upward into empty air rather than down through the attribution.
  bottom: 72,
};

const SCATTER_NARROW = {
  bands: [
    { size: 6.5, blur: 0, opacity: 1 },
    { size: 5.4, blur: 0.9, opacity: 0.92 },
    { size: 4.7, blur: 1.6, opacity: 0.78 },
  ],
  // Narrower and pushed off-centre to the left: at this width the plumb line
  // owns the right sixth of the frame, and a viewport-centred row long enough
  // to fill 92% ran straight through it.
  rowMax: 78,
  rowStep: 6.2,
  centre: 42,
  bottom: 70,
};

// `lang` is the DIRECTION OF TRAVEL, not a locale: descending, the Library
// speaks to you in translation, exactly as it has all along; walking back up,
// the same sentence re-gathers in Borges' own Spanish. Both layouts are built
// here at load — the same seeded hand scatters each, so a quote you have
// already read reassembles in the shape you remember, in the other tongue.
const buildScatter = (node, n, cfg, lang) => {
  const rand = mulberry(n * 31 + 11);
  const line = lang === 'es' ? node.folio.lineEs : node.folio.line;
  const list = line.split(' ').filter(Boolean);
  const band = (i) => cfg.bands[i % cfg.bands.length];
  // Estimated width as a percent of the viewport, from the band's size and an
  // average italic-serif character width — enough to keep words from colliding.
  const wEst = list.map((w, i) => (w.length + 1) * band(i).size * 0.55);

  // The design scatters the words along a single zig-zagging line. That holds
  // for its twelve-word quote but not for the Web of Time's twenty-two, which
  // would pile onto each other, so words flow into rows once a row is full.
  const pack = (limit) => {
    const out = [];
    let row = [];
    let rowW = 0;
    wEst.forEach((w, i) => {
      if (row.length && rowW + 1.6 + w > limit) {
        out.push({ items: row, width: rowW });
        row = [];
        rowW = 0;
      }
      row.push(i);
      rowW += (row.length > 1 ? 1.6 : 0) + w;
    });
    if (row.length) out.push({ items: row, width: rowW });
    return out;
  };

  // Greedy packing strands the tail — the Silence's twelve words leave
  // `lamps."` alone on a line of its own. Once the row count is known, re-pack
  // to the average row width so the field sits as an even block.
  let rows = pack(cfg.rowMax);
  if (rows.length > 1) {
    const total = wEst.reduce((a, b) => a + b, 0) + 1.6 * (wEst.length - 1);
    const even = pack(Math.min((total / rows.length) * 1.06, cfg.rowMax));
    if (even.length === rows.length) rows = even;
  }

  // Two independent scatters: the order words gather in, and the order they
  // dissolve in. Both are shuffles of the word list rather than its sequence,
  // so neither the arrival nor the departure reads left-to-right.
  const count = list.length;
  const appearAt = [];
  shuffled(count, rand).forEach((wi, k) => { appearAt[wi] = LEAD_MS + k * APPEAR_STEP; });
  // Whole sentence present. The lead is inside the breath, so arriving in a
  // gallery opens on empty air before the first word condenses.
  const gathered = LEAD_MS + (count - 1) * APPEAR_STEP + APPEAR_MS;
  const outStart = gathered + holdFor(count);
  const vanishAt = [];
  shuffled(count, rand).forEach((wi, k) => { vanishAt[wi] = outStart + k * VANISH_STEP; });

  const top = cfg.bottom - (rows.length - 1) * cfg.rowStep;
  const words = [];
  rows.forEach((r, ri) => {
    let x = cfg.centre - r.width / 2; // each row rides centred on the field's line
    r.items.forEach((i) => {
      const b = band(i);
      words.push({
        t: list[i],
        x: +x.toFixed(2),
        // A wobble off the row's baseline, so it reads as scattered depth
        // rather than as a justified paragraph.
        // This is the row's CENTRE LINE, not the word's top edge: the bands
        // differ in size by more than 2×, so anchoring by top would leave a
        // small word floating a whole line below its neighbours and scramble
        // the reading order. CSS centres each word on it.
        y: +(top + ri * cfg.rowStep + Math.sin(i * 0.9) * 1.2 + (rand() - 0.5) * 1.4).toFixed(2),
        size: b.size,
        blur: b.blur,
        opacity: b.opacity,
        d: appearAt[i],
        od: vanishAt[i],
        fdur: +(3.4 + rand() * 2.4).toFixed(1),
        fd: +(-rand() * 5).toFixed(1),
      });
      x += wEst[i] + 1.6;
    });
  });
  return {
    words,
    // The attribution signs the sentence once it is whole, and is the last
    // thing to leave — it outlasts the words it belongs to by a breath.
    attrD: gathered + 200,
    attrOutD: outStart + (count - 1) * VANISH_STEP,
  };
};

const bothTongues = (cfg) => ({
  en: NODES.map((node, n) => buildScatter(node, n, cfg, 'en')),
  es: NODES.map((node, n) => buildScatter(node, n, cfg, 'es')),
});
const SCATTER = { wide: bothTongues(SCATTER_WIDE), narrow: bothTongues(SCATTER_NARROW) };
const NARROW_QUERY = '(max-width: 720px)';

// Renders `render(id)` and, when `id` changes, keeps the outgoing copy mounted
// briefly so it can drift up and out while the new one surfaces from below
// (the camera sinks, so the world moves upward). Layers carry their own id —
// tour.css owns the motion.
function FadeSwap({ id, render }) {
  const [layers, setLayers] = useState(() => [{ id, leaving: false }]);
  useEffect(() => {
    setLayers((prev) => {
      const current = prev.find((l) => !l.leaving);
      if (current && current.id === id) {
        return prev;
      }
      return [{ id, leaving: false }, ...(current ? [{ ...current, leaving: true }] : [])];
    });
    const timer = setTimeout(
      () => setLayers((prev) => prev.filter((l) => !l.leaving)),
      1200,
    );
    return () => clearTimeout(timer);
  }, [id]);
  return (
    <div className="swap-stage">
      {layers.map((l) => (
        <div key={l.id} className={l.leaving ? 'swap-leave' : 'swap-enter'}>
          {render(l.id)}
        </div>
      ))}
    </div>
  );
}

// The overture: a title card over black while textures stream in, then an
// invitation. The dismissing click doubles as the user gesture that unlocks audio.
function EntryVeil({ leaving, onEnter }) {
  const { active, progress } = useProgress();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    // Four galleries' worth of textures stream in behind the veil; give them a
    // generous window before letting an impatient reader through regardless.
    const timer = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(timer);
  }, []);
  const ready = timedOut || (!active && progress === 100);

  const enter = (event) => {
    event.stopPropagation();
    if (ready) {
      onEnter();
    }
  };
  return (
    <div
      className={`entry-veil${leaving ? ' is-leaving' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Enter the Library"
      onClick={enter}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          enter(event);
        }
      }}
    >
      <div className="entry-eyebrow">J. L. Borges — 1941</div>
      <h1 className="entry-title">La Biblioteca de Babel</h1>
      <div className="entry-rule" />
      <div className="entry-status">
        {ready
          ? 'Click to descend'
          : `The Library is assembling… ${Math.min(99, Math.round(progress))}%`}
      </div>
    </div>
  );
}

// After a MOUSE click on a HUD control, hand focus back to the page so Space
// keeps walking the corridor (a focused control claims Space for itself —
// see the keydown guard). Keyboard activation arrives with detail 0 and keeps
// its focus ring, so Tab users are untouched.
function releaseFocus(event) {
  if (event.detail > 0) {
    event.currentTarget.blur();
  }
}

export default function Tour() {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Live, render-free state driving the persistent canvas.
  const descentRef = useRef(0);   // current camera depth (float)
  const targetRef = useRef(0);    // where we're easing toward
  const velRef = useRef(0);       // descent velocity (spring integration)
  // Immersion: how far the camera has walked INTO the gallery it dwells before
  // (0 = at the mouth, 1 = pressed deep among its cards). Separate from descent,
  // so stepping in parallaxes the slab stack without dissolving the veil. The
  // forward gesture fills this first and only rolls on to the next chapter once
  // it tops out.
  const immersionRef = useRef(0);
  const immersionTargetRef = useRef(0);
  const accentRef = useRef(ACCENTS[0].clone());
  const bobRef = useRef(null);    // plumb bob, slid down its cord directly
  const settledRef = useRef(0);   // last chapter the camera settled on
  // The vortex dive: 0 while in the library, ramping 0→1 across the single
  // crossing from the vortex (deepest gallery) into the garden. It drives the
  // camera's spin + core-aim in DioramaScene and the warm whiteout that covers
  // the hand-off. flashRef is that overlay, opacity written straight to the DOM.
  const diveRef = useRef(0);
  const flashRef = useRef(null);
  const vignetteRef = useRef(null); // tunnel-vision framing during the fall
  // The dive is paced by its own clock, not the depth spring — a long, deliberate
  // fall you can watch, rather than a ~2s whoosh. Holds { start } while a plunge
  // is underway, then hands the camera back to the spring, settled in the garden.
  const diveAnimRef = useRef(null);
  const DIVE_MS = 5200; // wall-clock length of the plunge down the spiral
  // The climb: the same plunge run backwards, when the reader walks out of the
  // garden and back into the library. It was the one asymmetry left in the
  // tour — you FELL into the garden over five seconds and stepped back out
  // through an ordinary seven-second melt, as if the spiral only existed
  // downwards. Same machinery (diveAnimRef carries `up`), its own ref so
  // nothing that reads the fall has to learn about signs, and shorter: a way
  // you have already been is a shorter way.
  const climbRef = useRef(0);
  const CLIMB_MS = 4200;

  // The refusal: a forward step the corridor cannot take — the vertigo before
  // the door has kindled, or the last node of the garden. Walking into a sealed
  // way used to be SILENT (immersion tops out, the crossing clamps back to the
  // same chapter, nothing happens at all), which reads as a dead input rather
  // than as a locked door. The world answers instead: the body leans into it,
  // a dull thud, and a whisper naming the wait. This ref holds the timestamp of
  // the last refusal — DioramaScene reads it for the lean.
  const refuseRef = useRef(0);

  // React state only for the HUD chrome — updates rarely (on chapter change).
  const [chapter, setChapter] = useState(0);
  // The paintings currently hung in the corridor. Held in state rather than read
  // straight off NODES because a gallery re-draws itself while you are not
  // looking — see the restock below. The node's own half (title, folio, accent,
  // fog) never changes with it, so everything keyed off NODES stays valid.
  const [scenes, setScenes] = useState(() => NODES.map((n) => n.scene));
  const scenesRef = useRef(scenes);
  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  // Which tongue the gallery is speaking, set by the direction of the last
  // crossing: 'en' descending, 'es' climbing back.
  const [lang, setLang] = useState('en');
  const [autoplay, setAutoplay] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [veil, setVeil] = useState('shown'); // 'shown' | 'leaving' | 'gone'
  const [muted, setMuted] = useState(false);
  // True for the length of the vortex plunge: the beckon unmounts and the whole
  // HUD fades out, so nothing man-made rides along on the fall.
  const [isDiving, setIsDiving] = useState(false);
  // The whisper that answers a refused step: null when none, else the stamp of
  // the last refusal (a fresh key restarts its appear/fade run) and WHY the way
  // was shut. The reason is captured at the moment of refusal rather than read
  // off `chapter` at render — the step is refused on the TARGET chapter, which
  // mid-crossing is not the chapter the eased camera is showing yet.
  const [refusal, setRefusal] = useState(null);
  // The two gardens the Fork could be, drawn once for the whole visit; null
  // where the node has only one, and on a pinned session, which exists to hold
  // one pairing still and must not have a road chosen under it.
  // Held in a ref rather than a memo so the render-free tick can read it
  // without taking it as a dependency — the tick's effect must not re-run, and
  // the two candidates are drawn once and never change anyway.
  const forkRef = useRef(undefined);
  if (forkRef.current === undefined) {
    forkRef.current = PINNED ? null : forkCandidates();
  }
  const forkTakenRef = useRef(false);   // has the road been chosen yet
  const forkMissedRef = useRef(null);   // …and which garden it cost, or null
  // The echo of the road not taken, shown once on arriving in the Fork. Only
  // ever set when the reader actually turned — see FORK_YAW.
  const [forkEcho, setForkEcho] = useState(null);
  const forkEchoTimer = useRef(0);
  // Which scatter layout the frame can hold. Unlike `reduced`, this has to
  // keep listening: rotating a phone changes the answer mid-tour.
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches,
  );
  // Mirrors of the two above, for the drift's tick. It has to know which scatter
  // layout is running to know when the quote is finished, but reading the state
  // would put them in its dependency list — and re-running the effect restarts
  // the dwell, so a rotation or a turn back up the corridor would silently
  // reset the clock on the room the reader is standing in.
  const langRef = useRef('en');
  const narrowRef = useRef(false);
  langRef.current = lang;
  narrowRef.current = narrow;
  // Where each plate reports its awakening (see Painting's `passRef`), so the
  // drift can wait for the surface to have said itself once.
  const passRef = useRef({});
  // The door to the garden. Sealed until the reader has dwelled in The
  // Silence for a few breaths; once open it stays open. The ref mirrors the
  // state for the render-free tick and input callbacks.
  const [doorOpen, setDoorOpen] = useState(false);
  const doorOpenRef = useRef(false);
  // The reachable end of the corridor, eased — when the door opens, the
  // progress bar relaxes from "journey complete" back to "the road goes on".
  const unlockedEased = useRef(LIBRARY_MAX);

  const enteredRef = useRef(false);
  const audioRef = useRef(null);

  // If this component ever unmounts (dev HMR remounts, mostly), take the
  // ambience down with it. Without this, an orphaned AudioContext keeps the
  // drones running with no button left anywhere that can silence it — which
  // reads, from the outside, as "the mute button does not work".
  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.dispose();
      audioRef.current = null;
    }
  }, []);

  const pointerStart = useRef(null); // { x, y, yaw, pitch, swiped }

  // Free look-around. `yawRef`/`pitchRef` are the live gaze angles (radians);
  // the *Target refs are where we're panning toward. Yaw surveys left/right,
  // pitch tilts the gaze up/down — neither moves the body. The cards wrap
  // sideways and mirror vertically past their edges (with a fog dissolve), so
  // the ranges can be generous without ever swinging into raw dark.
  const yawRef = useRef(0);
  const yawTarget = useRef(0);
  const pitchRef = useRef(0);
  const pitchTarget = useRef(0);
  const YAW_MAX = 0.34;   // ~19deg either side
  const PITCH_MAX = 0.24; // ~14deg up or down

  const panGaze = useCallback((dYaw, dPitch = 0) => {
    yawTarget.current = Math.min(Math.max(yawTarget.current + dYaw, -YAW_MAX), YAW_MAX);
    pitchTarget.current = Math.min(Math.max(pitchTarget.current + dPitch, -PITCH_MAX), PITCH_MAX);
  }, []);

  // Commit the vortex dive: a slow, watchable plunge down the spiral toward the
  // core light, then a warm flood and out into the garden. Paced by its own clock
  // in the tick (diveAnimRef); the plunge/spin/aim + flash ride on top there.
  // `dest` is where the fall ultimately lands — the first garden node by default;
  // a deeper hex-jump lands there first, then springs on to its chosen node.
  const dive = useCallback((dest = LIBRARY_MAX + 1) => {
    if (diveAnimRef.current) return; // already falling
    immersionTargetRef.current = 0;
    immersionRef.current = 0;
    velRef.current = 0;
    targetRef.current = LIBRARY_MAX + 1;
    diveAnimRef.current = { start: performance.now(), then: dest };
    setIsDiving(true);
    if (!reduced && audioRef.current) {
      // The dive's rush: builds for most of the fall and crests with the
      // whiteout (~el 0.65 of DIVE_MS), then releases into the garden's air.
      audioRef.current.swell(3.4, 0.085, 1.3);
    }
  }, [reduced]);

  // …and the way back: the shaft hauls you up itself. Mirrors `dive` exactly —
  // same clock, same ghost hand-off, the camera work reversed in DioramaScene.
  // As with a deep dive from a shallow gallery, a jump that starts several
  // chapters into the garden is taken to the threshold first and climbs from
  // there; the spring carries it the rest of the way once the shaft lets go.
  const climb = useCallback((dest = LIBRARY_MAX) => {
    if (diveAnimRef.current) return; // already being carried
    immersionTargetRef.current = 0;
    immersionRef.current = 0;
    velRef.current = 0;
    targetRef.current = LIBRARY_MAX;
    diveAnimRef.current = { start: performance.now(), then: dest, up: true };
    setIsDiving(true);
    if (!reduced && audioRef.current) {
      audioRef.current.swell(2.6, 0.07, 1.5);
    }
  }, [reduced]);

  const setTarget = useCallback((next) => {
    const to = clamp(next, doorOpenRef.current ? MAX : LIBRARY_MAX);
    const from = targetRef.current;
    // Any downward crossing of the library→garden threshold is ALWAYS the
    // cinematic dive — whether it comes from the beckon, a scroll, an arrow, or
    // a hex-dot jump straight to a deep garden node — so you never merely slide
    // across that threshold.
    if (to > LIBRARY_MAX && Math.round(from) <= LIBRARY_MAX && !diveAnimRef.current) {
      dive(to);
      return;
    }
    // And any upward crossing of it is the climb, for the same reason: the two
    // worlds are joined by a shaft, not by a corridor, in both directions.
    if (to <= LIBRARY_MAX && Math.round(from) > LIBRARY_MAX && !diveAnimRef.current) {
      climb(to);
      return;
    }
    targetRef.current = to;
    // A new destination chapter: swell the ambience across the crossing and
    // reset immersion so you arrive at the mouth of the next room, not already
    // buried in it. Each threshold has its own rite and its own voice — the
    // reverberation, the hush, the whirl — so the crossing being entered names
    // the sound. Only single steps get one: a jump across several chapters is
    // not a passage through any one of them, so it keeps the plain swell.
    if (Math.round(to) !== Math.round(from)) {
      immersionTargetRef.current = 0;
      if (!reduced && audioRef.current) {
        const step = Math.round(to) - Math.round(from);
        const crossing = Math.min(Math.round(to), Math.round(from));
        audioRef.current.rite(Math.abs(step) === 1 ? RITE_NAME[crossing] : null);
      }
    }
  }, [reduced, dive, climb]);

  // Answer a step the world will not take: lean, thud, whisper. Rate-limited to
  // one answer per REFUSE_MS so a wheel burst is a single bump against the door
  // rather than a stutter of them.
  const refuseTimer = useRef(0);
  const turnBackTimer = useRef(0);
  const refuse = useCallback(() => {
    const now = performance.now();
    if (now - refuseRef.current < REFUSE_MS) {
      return;
    }
    refuseRef.current = now;
    if (audioRef.current) {
      audioRef.current.thud();
    }
    // Sealed vs. ended: the only way to be refused with the door still shut is
    // the vertigo, and the only way with it open is the last node of the path.
    setRefusal({ at: now, sealed: !doorOpenRef.current });
    window.clearTimeout(refuseTimer.current);
    refuseTimer.current = window.setTimeout(() => setRefusal(null), REFUSAL_WHISPER_MS);
    // The web has closed: the whisper's "turn back" is an instruction the world
    // itself carries out. Once it has hung long enough to be read, the walk
    // reverses on its own — out of the room and back into the previous gallery
    // (an ascent, so the tongue turns Spanish). Guarded at fire time so a
    // reader who has already moved on isn't wrestled with.
    if (doorOpenRef.current) {
      window.clearTimeout(turnBackTimer.current);
      turnBackTimer.current = window.setTimeout(() => {
        if (diveAnimRef.current) return;
        if (Math.round(targetRef.current) !== MAX) return;
        setTarget(MAX - 1);
      }, TURN_BACK_MS);
    }
  }, [setTarget]);

  useEffect(() => () => {
    window.clearTimeout(refuseTimer.current);
    window.clearTimeout(turnBackTimer.current);
  }, []);

  // The single forward/back axis. A positive step walks deeper INTO the current
  // gallery; once immersion tops out the next step crosses to the following
  // chapter. Backing out empties immersion first, then retreats a chapter.
  const advance = useCallback((step) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    // Taking the walk back stops the drift. It used to keep its own clock
    // running underneath a reader who had started steering, so the world would
    // pull them on mid-room a few seconds after they chose to stay — the two
    // were simply fighting. Panning the gaze deliberately does NOT stop it:
    // looking around while being carried is the whole appeal of the drift.
    setAutoplay(false);
    const next = immersionTargetRef.current + step;
    if (next > 1) {
      // Nowhere left to walk: the sealed vertigo (the door has not kindled yet)
      // or the last node of the garden. setTarget would clamp straight back to
      // this same chapter and the step would vanish — so refuse it out loud
      // instead, and hold immersion pinned at the far wall of the room.
      if (Math.round(targetRef.current) >= (doorOpenRef.current ? MAX : LIBRARY_MAX)) {
        immersionTargetRef.current = 1;
        refuse();
        return;
      }
      setTarget(Math.round(targetRef.current) + 1); // resets immersion to 0
    } else if (next < 0) {
      if (immersionTargetRef.current <= 0.001) {
        setTarget(Math.round(targetRef.current) - 1);
      } else {
        immersionTargetRef.current = 0;
      }
    } else {
      immersionTargetRef.current = next;
    }
  }, [setTarget, refuse]);

  const go = useCallback((dir) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    // Whole-chapter jump (used by autoplay / chapter dots): clear immersion so
    // the crossing reads cleanly, then step the target chapter.
    immersionTargetRef.current = 0;
    setTarget(Math.round(targetRef.current) + dir);
  }, [setTarget]);

  const jumpTo = useCallback((index) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    setAutoplay(false); // choosing a gallery is steering — see `advance`
    setTarget(index);
  }, [setTarget]);

  // ── The descent: the plumb ring is a grip, not a read-out ───────────────────
  // (design 1d.) The chain hanging down the right of the frame is the same brass
  // the galleries hang their lamps from, and its ring can be taken hold of: drag
  // it and the archive descends WITH you, station tags surfacing as they pass
  // under it. While a hand is on it the ring is written straight from the
  // pointer — the tick yields the bob for the length of the drag (see `dragRef`
  // in the tick) — so it tracks the finger exactly rather than chasing it.
  const spanRef = useRef(null);
  const dragRef = useRef(null);       // fraction of the cord under the hand, or null
  const [grip, setGrip] = useState(null); // station the ring would land on

  // Where on the cord a pointer is, 0 (top) → 1 (the reachable end).
  const cordFrac = useCallback((e) => {
    const el = spanRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  }, []);

  const stationAt = useCallback((frac) => {
    const end = doorOpenRef.current ? MAX : LIBRARY_MAX;
    return clamp(Math.round(frac * end), end);
  }, []);

  // Follow the ring with the camera as it travels, so the drag reads as the
  // archive moving rather than a marker sliding over a still picture. The one
  // crossing it will NOT make on its own is the threshold between the two
  // worlds — in EITHER direction: the fall and the climb are both committed
  // acts, so a drag across that band only arms it and the release lets it go.
  const seek = useCallback((station) => {
    const here = Math.round(targetRef.current);
    if (station > LIBRARY_MAX && here <= LIBRARY_MAX) return;
    if (station <= LIBRARY_MAX && here > LIBRARY_MAX) return;
    setTarget(station);
  }, [setTarget]);

  const ridePoint = useCallback((e) => {
    const frac = cordFrac(e);
    dragRef.current = frac;
    if (bobRef.current) {
      bobRef.current.style.top = `${frac * 100}%`;
    }
    const station = stationAt(frac);
    setGrip((g) => (g === station ? g : station));
    return station;
  }, [cordFrac, stationAt]);

  const chainDown = useCallback((e) => {
    if (diveAnimRef.current) return; // mid-fall: the plunge cannot be steered
    // A station tag was taken instead of the chain — let its own click land.
    if (e.target.closest && e.target.closest('.plumb-mark')) return;
    e.stopPropagation(); // not a look-around drag on the room behind it
    e.currentTarget.setPointerCapture(e.pointerId);
    seek(ridePoint(e));
  }, [ridePoint, seek]);

  const chainMove = useCallback((e) => {
    if (dragRef.current === null) return;
    e.stopPropagation();
    seek(ridePoint(e));
  }, [ridePoint, seek]);

  const chainUp = useCallback((e) => {
    if (dragRef.current === null) return;
    e.stopPropagation();
    const station = stationAt(dragRef.current);
    dragRef.current = null; // the tick has the bob back
    setGrip(null);
    jumpTo(station); // snap home — and, past the door, let the fall go
  }, [stationAt, jumpTo]);

  // ── The corridor restocks behind you ───────────────────────────────────────
  // Every gallery holds several Midjourney versions of its painting (and of the
  // clip that wakes it); one is drawn on arrival. A gallery you have stood in is
  // SPENT, and the moment it drops out of sight it quietly re-hangs itself with
  // a version you have not seen. So walking back up the corridor is not a rewind
  // of the descent — the same rooms, in the same order, under different pictures
  // — and revisiting is how the rest of the art gets seen at all. It is also the
  // honest behaviour for this world: it rearranges only what nobody is watching.
  //
  // `spent` holds the chapters owed a fresh painting. A chapter is marked on
  // arrival and cleared when it has been re-drawn (or when the node turns out to
  // have nothing else to offer, e.g. the Vestibule's single plate).
  const spentRef = useRef(new Set([0]));
  // At most one gallery re-draws at a time — two plate decodes at once is the
  // same load the video streamer already refuses to run concurrently.
  const restockingRef = useRef(false);

  const restock = useCallback((descent) => {
    if (PINNED || restockingRef.current) return;
    const spent = spentRef.current;
    // Nearest first: whichever spent gallery the reader could reach soonest is
    // the one worth re-hanging soonest.
    const queue = [...spent].sort(
      (a, b) => Math.abs(descent - a) - Math.abs(descent - b));
    for (const i of queue) {
      // A chosen road stays chosen. Every other gallery re-hangs itself with a
      // different version of the same room once it is out of sight, which is
      // exactly the wrong thing to do to the one gallery the reader picked:
      // the choice would be quietly undone the first time they looked away.
      if (i === FORK_INDEX && forkTakenRef.current) {
        spent.delete(i);
        continue;
      }
      if (!outOfSight(descent, i, ARMED)) continue;
      spent.delete(i);
      const pool = POOLS[i];
      const next = redrawScene(pool.map, pool.slug, scenesRef.current[i]);
      if (!next) continue; // a room with only one version of itself
      restockingRef.current = true;
      // Warm the loader's cache under the same key useTexture will ask for, so
      // the re-render finds the plates already decoded and never suspends.
      useTexture.preload([next.color, next.depth]);
      decodePlates(next).then(() => {
        restockingRef.current = false;
        // The reader may have turned around while it loaded. Never re-hang a
        // wall someone is looking at: put the gallery back in the queue and let
        // a later pass catch it out of sight again.
        if (!outOfSight(descentRef.current, i, COMMIT)) {
          spent.add(i);
          return;
        }
        // In a transition, so React holds the gallery that is up until the new
        // one is ready to replace it rather than blanking to a Suspense fallback.
        startTransition(() => {
          setScenes((prev) => {
            const out = prev.slice();
            out[i] = next;
            return out;
          });
        });
      });
      return;
    }
  }, []);

  const enter = useCallback(() => {
    enteredRef.current = true;
    if (!audioRef.current) {
      audioRef.current = new AmbientSound();
    }
    audioRef.current.setMuted(muted);
    audioRef.current.start();
    setVeil('leaving');
    setTimeout(() => setVeil('gone'), 1200);
  }, [muted]);

  // One footfall from the walking gait (DescentRig calls this mid-stride):
  // lay a soft step sound under it, scaled by how strongly the gait is swinging.
  const handleStep = useCallback((intensity) => {
    if (!reduced && audioRef.current) {
      audioRef.current.step(intensity);
    }
  }, [reduced]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (audioRef.current) {
        audioRef.current.setMuted(next);
      }
      return next;
    });
  }, []);

  // The single, persistent animation loop. Runs for the component's lifetime —
  // eases descent + accent, updates the progress bar, video flash, and ambience,
  // and only pokes React state when the settled chapter actually changes.
  useEffect(() => {
    let frame;
    let last = performance.now();
    let lastRestock = performance.now();
    const tick = (now) => {
      // Wall-clock easing so the glide keeps the same meditative pace on any
      // refresh rate (clamped so a background tab doesn't lurch on return).
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const diving = diveAnimRef.current !== null;
      if (diving) {
        // The vortex plunge runs on its own clock — a slow, watchable fall. Its
        // two motions are DECOUPLED: `el` drives how far the camera dives into
        // the vortex core (diveRef → the plunge/spin/aim in DioramaScene), which
        // stays deep late into the fall — so you actually travel THROUGH the
        // spiral, on screen the whole way. The descent crossover is held to the
        // very end and rides the GHOST window (DioramaScene fades the vortex
        // stack as a whole over el 0.8→0.96, both worlds lit): the crossing
        // depth-melt must never run — its shards read as abstract garbage at
        // the point-blank range the plunge reaches.
        //
        // The CLIMB is this same clock read the other way up: progress still
        // runs 0→1, but the crossover walks the descent back from the garden to
        // the vortex and it is the garden's plate that ghosts. Everything
        // between — the camera being hauled up the shaft, the counter-roll, the
        // lift of the gaze — is DioramaScene reading climbRef instead.
        const a = diveAnimRef.current;
        const up = a.up === true;
        // `frozen` holds the fall at a fixed progress — dev-capture only (the
        // ?dev hook below); a real dive never sets it.
        const el = a.frozen != null
          ? a.frozen
          : Math.min((now - a.start) / (up ? CLIMB_MS : DIVE_MS), 1);
        diveRef.current = up ? 0 : el;
        climbRef.current = up ? el : 0;
        descentRef.current = up
          ? LIBRARY_MAX + 1 - smoothstep(0.78, 0.97, el)
          : LIBRARY_MAX + smoothstep(0.78, 0.97, el);
        velRef.current = 0;
        if (a.frozen == null && el >= 1) {
          // Landed. Hand the camera back to the spring — aimed at the fall's
          // true destination, so a deep hex-jump glides on through the garden —
          // and let the HUD chrome fade back in.
          diveAnimRef.current = null;
          descentRef.current = up ? LIBRARY_MAX : LIBRARY_MAX + 1;
          diveRef.current = up ? 0 : 1;
          climbRef.current = up ? 1 : 0;
          targetRef.current = a.then ?? (up ? LIBRARY_MAX : LIBRARY_MAX + 1);
          setIsDiving(false);
        }
      } else {
        const d = descentRef.current;
        const t = targetRef.current;
        // Critically damped spring toward the target depth: the camera gathers
        // itself out of one gallery, crests mid-corridor, and brakes softly into
        // the next — one continuous breath instead of a lurch-and-crawl. A full
        // chapter crossing unfolds over roughly seven seconds.
        const K = 0.55;                 // stiffness — sets the crossing's tempo
        const C = 2 * Math.sqrt(K);     // critical damping — no overshoot
        let v = velRef.current;
        v += (K * (t - d) - C * v) * dt;
        let next = d + v * dt;
        if (Math.abs(t - next) < 0.0006 && Math.abs(v) < 0.002) {
          next = t;
          v = 0;
        }
        velRef.current = v;
        descentRef.current = Math.min(Math.max(next, 0), MAX);
      }
      const cur = descentRef.current;

      // Immersion moves toward its target, but only while the camera is settled
      // on a chapter — mid-crossing (and mid-fall, when descent briefly holds at
      // the vortex) it is pulled to 0 so the walk-in doesn't fight the crossing.
      const settled = Math.abs(cur - Math.round(cur)) < 0.02;
      if (settled && !diving) {
        // Walk-in: a clamped exponential. A pure exponential front-loads the
        // move — fastest the instant you scroll, then a seconds-long drifting
        // tail, which is exactly the velocity profile of floating, not walking.
        // Clamping the rate caps forward speed at a steady stride (~2.2 world
        // units/s over the 10-unit APPROACH) so a step-in moves at constant
        // walking tempo; near arrival the exponential takes over for the stop.
        // NB this is in IMMERSION units, so it has to track APPROACH: shortening
        // the walk-in without raising it would slow the stride to a crawl.
        const IMMERSION_WALK = 0.22; // immersion units per second
        const imm = immersionRef.current;
        const v = Math.max(
          -IMMERSION_WALK,
          Math.min(IMMERSION_WALK, (immersionTargetRef.current - imm) * 2.4)
        );
        immersionRef.current = imm + v * dt;
      } else {
        // Uncapped drain: the crossing's forward travel must absorb the
        // emptied immersion quickly or the two would fight.
        immersionRef.current *= Math.exp(-dt * 2.4);
      }

      // Look-around: gaze eases toward its target on both axes. The target
      // barely drifts back toward center — slow enough that the view stays
      // where the reader pointed it, yet over a long dwell it settles back to
      // facing down the corridor.
      yawTarget.current += (0 - yawTarget.current) * (1 - Math.exp(-dt * 0.05));
      yawRef.current += (yawTarget.current - yawRef.current) * (1 - Math.exp(-dt * 2.4));
      pitchTarget.current += (0 - pitchTarget.current) * (1 - Math.exp(-dt * 0.05));
      pitchRef.current += (pitchTarget.current - pitchRef.current) * (1 - Math.exp(-dt * 2.4));

      // Interpolate accent between the two bracketing chapters.
      const lo = Math.floor(cur);
      const hi = Math.min(lo + 1, MAX);
      accentRef.current.copy(ACCENTS[lo]).lerp(ACCENTS[hi], cur - lo);

      // The plumb bob, slid down its cord by direct DOM write (no React
      // render). Measured against the *reachable* end of the corridor, which
      // itself eases out when the door opens — the cord slowly lengthens from
      // "journey complete" back to "the road goes on", and the marks slide
      // apart under it. Because this tracks the eased descent rather than the
      // settled chapter, the bob travels continuously through a crossing.
      unlockedEased.current +=
        ((doorOpenRef.current ? MAX : LIBRARY_MAX) - unlockedEased.current) *
        (1 - Math.exp(-dt * 1.6));
      // While the ring is held, the hand owns it — the drag writes `top` from
      // the pointer and the camera chases the ring, not the other way round.
      if (bobRef.current && dragRef.current === null) {
        const frac = Math.min(cur / (unlockedEased.current || 1), 1);
        bobRef.current.style.top = `${frac * 100}%`;
      }

      // The soundscape darkens through the library, then the garden opens the
      // air back up: leaf-hiss in, drone weight out, across the crossing.
      if (audioRef.current) {
        audioRef.current.setDescent(Math.min(cur, LIBRARY_MAX) / (LIBRARY_MAX || 1));
        audioRef.current.setGarden(Math.min(Math.max(cur - LIBRARY_MAX, 0), 1));
      }

      // Update HUD chapter when we cross a rounded boundary — right at the
      // bridge's peak, so the card swap happens under the video's cover.
      const nearest = Math.round(cur);
      // ── The road chosen by looking ───────────────────────────────────────
      // ABOVE the arrival block on purpose: both can land in the same tick if a
      // single frame carries the camera across the commit point and into the
      // room (a long dt — a background tab coming back, one slow frame), and
      // the arrival is what says what the choice cost. Announced before it was
      // made, it has nothing to say and the road not taken goes unnamed.
      // Committed partway through the V → VI crossing, from the yaw alone. The
      // gallery ahead is still deep enough in fog here that swapping it is
      // invisible; a chapter later it would be a plate changing in front of the
      // reader's eyes. Descending only: climbing back up into the Fork walks
      // into the garden already chosen, because it is the one that exists now.
      if (forkRef.current && !forkTakenRef.current
          && cur > (FORK_INDEX - 1) + FORK_COMMIT && cur < FORK_INDEX) {
        forkTakenRef.current = true;
        const yaw = yawRef.current;
        const turned = yaw > FORK_YAW ? 'right' : yaw < -FORK_YAW ? 'left' : null;
        const side = turned ?? (Math.random() < 0.5 ? 'left' : 'right');
        forkMissedRef.current = turned ? (side === 'left' ? 'right' : 'left') : null;
        const chosen = forkRef.current[side];
        // The Fork is now settled for the rest of the visit: the restock is
        // told to leave it alone below, so walking away and back returns to the
        // garden that was chosen rather than re-rolling it.
        startTransition(() => {
          setScenes((prev) => {
            const out = prev.slice();
            out[FORK_INDEX] = chosen;
            return out;
          });
        });
      }

      if (nearest !== settledRef.current) {
        // The direction of the crossing decides the tongue the arriving gallery
        // speaks: down through the Library in translation, back up in the
        // original. Read here rather than in the render because this is the only
        // place both the old and the new chapter are known — and it makes the
        // ascent a second reading rather than a rewind of the first.
        const tongue = nearest < settledRef.current ? 'es' : 'en';
        settledRef.current = nearest;
        setLang(tongue);
        setChapter(nearest);
        // You have now been in this gallery: its painting is spent, and gets
        // re-drawn as soon as the room is out of sight behind you.
        spentRef.current.add(nearest);
        // Arriving in the Fork having actually turned on the way: say what the
        // turn cost. Only when the reader chose — the world drawing for someone
        // who walked straight through is not a road not taken, and claiming it
        // was would be the piece lying to them.
        if (nearest === FORK_INDEX && forkMissedRef.current) {
          setForkEcho({ at: now, missed: forkMissedRef.current });
          window.clearTimeout(forkEchoTimer.current);
          forkEchoTimer.current = window.setTimeout(
            () => setForkEcho(null), FORK_WHISPER_MS);
        }
      }

      // Re-hang one spent gallery, twice a second at most, and never mid-fall —
      // the plunge is the one stretch where the corridor's depths are all on
      // screen at once.
      if (!diving && now - lastRestock > 500) {
        lastRestock = now;
        restock(cur);
      }

      // The vortex dive drives a warm radial flash. While falling, `diveRef` is
      // the plunge clock (el); otherwise it just tracks the depth so idle/garden
      // states stay dark. The flash keeps the whole plunge into the vortex in the
      // clear (p up to ~0.5), then swells to cover the late crossover and the
      // camera righting, and clears onto the garden. Reduced motion softens it.
      // Off the dive, the plunge is fully at rest — so a normal crossing (or
      // ascending back out of the garden) never spuriously spins the camera.
      if (!diving) {
        diveRef.current = 0;
        climbRef.current = 0;
      }
      // Both directions of the shaft drive the same two overlays: whichever way
      // the body is being carried, the periphery closes in and the deep instant
      // takes a breath of dark.
      const p = Math.max(diveRef.current, climbRef.current);
      if (flashRef.current) {
        // No fade to black and no gold flood: the hand-off is a lit GHOST
        // crossfade (the vortex stack thins away via uGhost while the garden
        // materializes). This veil is only a faint dimming breath at the
        // deepest instant — atmosphere, never darkness. Reduced motion keeps
        // a fuller veil, having no plunge to carry the crossing.
        const bell = reduced
          ? 0.8 * smoothstep(0.45, 0.7, p) * (1 - smoothstep(0.92, 1.0, p))
          : 0.3 * smoothstep(0.8, 0.92, p) * (1 - smoothstep(0.95, 1.0, p));
        flashRef.current.style.opacity = `${bell}`;
      }
      if (vignetteRef.current) {
        // Tunnel vision: the frame's periphery closes in with the fall's
        // thrust — deliberate, symmetric framing (it reads as speed), whose
        // clear center stays on the spiral and its light. It also owns
        // whatever the banked corners reveal past the cards, uniformly.
        const tv = reduced ? 0 : Math.sin(Math.pow(p, 2) * Math.PI);
        vignetteRef.current.style.opacity = `${0.62 * tv}`;
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Dev-only capture rig (stripped from production builds by Vite): ?dev=1
  // jumps straight to the woken vortex — or to ?ch=<n> / ?node=<slug> when
  // given — and exposes window.__setDive(el) to freeze the dive at any
  // progress, so headless screenshots can inspect any instant of the fall.
  // See the capture recipe in the project memory.
  //
  // ?node= and ?ch= imply the jump on their own, so a pinned pairing
  // (?variant=/?clip=, see selectRandomVariant) can be landed on with one URL:
  //   ?node=fork&variant=01-moonlit-labyrinth-var0&clip=01-moonlit-labyrinth-var0-clip1
  // What actually got drawn is logged to the console — the pools are random,
  // so this is the only way to be sure you are looking at what you asked for.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('dev') && !params.has('ch') && !params.has('node')) return;
    setVeil('gone');
    enteredRef.current = true;
    doorOpenRef.current = true;
    setDoorOpen(true);
    const slug = params.get('node');
    const bySlug = slug ? NODES.findIndex((n) => n.slug === slug) : -1;
    if (slug && bySlug < 0) {
      console.warn('[pin] no node named %o — known slugs: %s', slug,
        NODES.map((n) => n.slug).join(', '));
    }
    const ch = Number(params.get('ch'));
    const at = bySlug >= 0
      ? bySlug
      : params.has('ch') && Number.isFinite(ch) ? clamp(Math.round(ch), MAX) : LIBRARY_MAX;
    descentRef.current = at;
    targetRef.current = at;
    settledRef.current = at;
    setChapter(at);
    // Landing here counts as having been here: without this the pinned chapter
    // is the one gallery that never restocks, since the tick's arrival never
    // fires for it.
    spentRef.current.add(at);
    const landed = NODES[at];
    console.info('[pin] %s — still %o, clip %o', landed.slug,
      landed.scene.color.split('/').pop(),
      landed.scene.video ? landed.scene.video.split('/').pop() : '(none)');
    window.__setDive = (el) => {
      diveAnimRef.current = { frozen: Math.max(0, Math.min(1, el)) };
      setIsDiving(true);
    };
    window.__nav = () => ({
      target: targetRef.current,
      descent: descentRef.current,
      immT: immersionTargetRef.current,
      diving: diveAnimRef.current !== null,
      // Where the gaze is pointed. The Fork reads exactly this at the commit
      // point, so a fork that lands the wrong way can be told apart from a yaw
      // that never got far enough off the axis to count (FORK_YAW).
      yaw: yawRef.current,
      fork: {
        taken: forkTakenRef.current,
        missed: forkMissedRef.current,
        // The two gardens on offer. Null means the node could not field two and
        // there is no fork at all — which is otherwise indistinguishable from a
        // fork that simply never fired.
        pair: forkRef.current
          ? [forkRef.current.left, forkRef.current.right]
            .map((s) => s.color.split('/').pop())
          : null,
      },
      // Which version of each gallery is hanging right now, and which are still
      // owed a fresh one — the restock happens by definition where it cannot be
      // seen, so this is the only way to watch it work.
      art: scenesRef.current.map((s) => s.color.split('/').pop()),
      spent: [...spentRef.current],
      // Which galleries have woken and finished a pass, which is one of the two
      // things the drift waits on. Reported because a gate that never fires is
      // indistinguishable from one that always passes: if this stays empty on a
      // gallery whose clip is plainly running, the drift is being paced by the
      // quote and DRIFT_MAX_DWELL alone.
      pass: Object.fromEntries(Object.entries(passRef.current)
        .map(([i, p]) => [i, `${p.done ? 'said' : 'waking'}/${p.by}`])),
    });
    // Walk the camera without the input layer, for scripted capture. Crossing
    // into the garden still dives, as it does for a reader.
    window.__to = (i) => {
      immersionTargetRef.current = 0;
      setTarget(clamp(Math.round(i), MAX));
    };
    // Teleport: put the camera at a depth outright, no ease. A crossing takes
    // about seven seconds, and headless GL gives out well before a round trip of
    // them finishes — so anything that has to be observed several chapters apart
    // is stepped with this instead. The tick still sees the chapter change, so
    // arrivals register (and galleries are marked spent) exactly as if walked.
    window.__at = (d) => {
      const to = clamp(d, MAX);
      descentRef.current = to;
      targetRef.current = to;
      velRef.current = 0;
      immersionRef.current = 0;
      immersionTargetRef.current = 0;
    };
    // Park the camera INSIDE a crossing and hold it there, which is the only
    // way to actually look at a rite: walked, each one is over in the ~1.5 s
    // its plate spends dissolving, and under headless GL it may never be
    // sampled at all. `p` is the crossing's own progress — 0 at the room you
    // are leaving, 1 at the one you are arriving in.
    //   __rite(1)        → halfway through the hush (II → III)
    //   __rite(5, 0.3)   → the flood, just as the water reaches the picture
    //   __rites(0)       → the same instant on the plain melt, to compare
    // Nothing eases: the teleport freezes the crossing rather than crossing it.
    window.__rite = (c, p = 0.5) => {
      const at = clamp(c + Math.min(Math.max(p, 0), 0.999), MAX);
      window.__at(at);
      console.info('[rite] crossing %d (%s) at %s', c,
        RITE_NAME[c] ?? 'plain', (at - c).toFixed(2));
      return at;
    };
    window.__climb = (el) => {
      diveAnimRef.current = { frozen: Math.max(0, Math.min(1, el)), up: true };
      setIsDiving(true);
    };
  }, [setTarget]);

  // The door: once the reader has settled in The Silence and dwelled for a
  // few breaths, a green light kindles between the shelves and the garden
  // unlocks. Leaving before the dwell completes keeps it sealed.
  useEffect(() => {
    if (doorOpen || chapter !== LIBRARY_MAX) {
      return undefined;
    }
    const timer = setTimeout(() => {
      doorOpenRef.current = true;
      setDoorOpen(true);
      // Whatever the wall was still whispering is answered now — drop it so the
      // refusal never overlaps the invitation that replaces it.
      setRefusal(null);
      if (audioRef.current) {
        audioRef.current.announce();
      }
    }, 4500);
    return () => clearTimeout(timer);
  }, [chapter, doorOpen]);

  // Both gardens are decoded while the reader stands at The Door, one chapter
  // short of the fork. The choice is committed mid-crossing and has to land on
  // an already-decoded plate: a Suspense fallback there would blank the gallery
  // being walked into, which is the one moment in the piece where the reader is
  // certain to be looking at it.
  useEffect(() => {
    const fork = forkRef.current;
    if (!fork || chapter !== FORK_INDEX - 1 || forkTakenRef.current) {
      return;
    }
    for (const side of [fork.left, fork.right]) {
      useTexture.preload([side.color, side.depth]);
      decodePlates(side);
    }
  }, [chapter]);

  // Autoplay: drift forward, loop back to the top at the reachable end.
  //
  // Paced by what the gallery is DOING, not by a stopwatch. On a 9 s interval
  // the drift saw neither of the two things a gallery says: a crossing alone
  // takes about seven seconds, leaving a ~2 s dwell, while the quote needs its
  // whole gather-hold-dissolve cycle (12 s for a twelve-word line) and the
  // surface needs to wake and run one pass. A drift that skips both is a slide
  // show of rooms nobody is inside. So: arrive, let the room finish speaking,
  // then move — which comes out around 25-30 s a gallery, the pace of a reading
  // rather than a carousel.
  useEffect(() => {
    if (!autoplay || NODES.length <= 1) {
      return undefined;
    }
    let arrivedAt = performance.now();
    let standingIn = Math.round(targetRef.current);
    const step = () => {
      const end = doorOpenRef.current ? MAX : LIBRARY_MAX;
      const atEnd = Math.round(targetRef.current) >= end;
      immersionTargetRef.current = 0;
      setTarget(atEnd ? 0 : Math.round(targetRef.current) + 1);
      arrivedAt = performance.now();
    };
    const tick = () => {
      const now = performance.now();
      const chapter = Math.round(targetRef.current);
      // A crossing is in flight (or the reader was carried somewhere): restart
      // the dwell against the room actually being stood in.
      if (chapter !== standingIn) {
        standingIn = chapter;
        arrivedAt = now;
        return;
      }
      if (diveAnimRef.current) {          // mid-fall: nothing is being read
        arrivedAt = now;
        return;
      }
      const waited = now - arrivedAt;
      if (waited > DRIFT_MAX_DWELL) {     // below, the reasons it may not fire
        step();
        return;
      }
      if (waited < DRIFT_MIN_DWELL) return;
      // The quote has to have finished dissolving. Its cycle is laid out per
      // chapter and per tongue at load, and the last word's dissolve is the
      // attribution's `attrOutD` plus the 2200 ms `scatter-gone` runs for.
      const layout = SCATTER[narrowRef.current ? 'narrow' : 'wide'][langRef.current];
      const quoteMs = (layout[chapter]?.attrOutD ?? 0) + SCATTER_GONE_MS;
      if (waited < quoteMs) return;
      // …and the surface has to have woken and said itself once. A gallery
      // with no clip, or one whose clip never reaches the DOM, has no record
      // here and is carried by DRIFT_MAX_DWELL instead of stalling the drift.
      const pass = passRef.current[chapter];
      if (pass && !pass.done) return;
      step();
    };
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [autoplay, setTarget]);

  // Keyboard: Up/Down + Space move deeper/shallower; Left/Right pan the gaze;
  // Shift+Up/Down tilt the gaze up and down instead of walking.
  useEffect(() => {
    const onKey = (event) => {
      if (!enteredRef.current) {
        return;
      }
      if (event.key.toLowerCase() === 'h' || event.key === '?') {
        event.preventDefault();
        setShowHelp((v) => !v);
        return;
      }
      if (event.key === 'Escape') {
        setShowHelp(false);
        return;
      }
      // A focused HUD control owns Space and Enter — let the browser's native
      // activation run instead of stealing the keys for navigation. (Stealing
      // Space here made a Tab-focused mute button walk the camera deeper
      // instead of toggling.) Mouse clicks release their focus on activation,
      // so reaching this path means the reader is driving by keyboard.
      if (event.target instanceof Element && event.target.closest('button, [role="button"]')) {
        return;
      }
      if (['ArrowDown', ' '].includes(event.key)) {
        event.preventDefault();
        if (event.shiftKey && event.key === 'ArrowDown') {
          panGaze(0, -0.06); // tilt the gaze down
        } else {
          advance(0.5); // step deeper into the room, then on to the next chapter
        }
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (event.shiftKey) {
          panGaze(0, 0.06); // tilt the gaze up
        } else {
          advance(-0.5); // step back out toward the mouth, then to the previous
        }
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        panGaze(0.08);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        panGaze(-0.08);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, panGaze]);

  // Scroll wheel walks the camera in and out in small, calm increments — deeper
  // into the current gallery first, rolling on to the next once fully immersed.
  useEffect(() => {
    const onWheel = (event) => {
      event.preventDefault();
      if (!enteredRef.current) {
        return;
      }
      advance(Math.sign(event.deltaY) * 0.14);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [advance]);

  // Pointer: a mouse/pen drag pans the gaze freely on both axes (grab the
  // world and pull it). On touch, horizontal drags look around while a clear
  // vertical swipe still walks in/out — that's the touch path to navigation.
  // A plain click drifts deeper.
  const dragMoved = useRef(false);
  const handlePointerDown = (event) => {
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      yaw: yawTarget.current,
      pitch: pitchTarget.current,
      swiped: false,
    };
    dragMoved.current = false;
  };
  const handlePointerMove = (event) => {
    const start = pointerStart.current;
    if (!start) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragMoved.current = true;
    }
    const isTouch = event.pointerType === 'touch';
    if (isTouch && !start.swiped && Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) {
      start.swiped = true;
      advance(dy < 0 ? 0.5 : -0.5); // swipe up = press deeper into the room
      return;
    }
    // Map a full-width/height drag to the full pan range, grab-the-world
    // style: pulling the scene right swings the gaze left, pulling it down
    // tips the gaze up.
    const yaw = start.yaw - (dx / window.innerWidth) * YAW_MAX * 2.2;
    yawTarget.current = Math.min(Math.max(yaw, -YAW_MAX), YAW_MAX);
    if (!isTouch) {
      const pitch = start.pitch + (dy / window.innerHeight) * PITCH_MAX * 2.2;
      pitchTarget.current = Math.min(Math.max(pitch, -PITCH_MAX), PITCH_MAX);
    }
  };
  const handlePointerUp = () => {
    pointerStart.current = null;
  };
  const handleClick = () => {
    // Only act if this was a click, not the end of a look-around drag.
    if (!enteredRef.current || dragMoved.current) {
      return;
    }
    advance(0.5); // a click steps you further into the room
  };

  const node = NODES[chapter];
  // The threshold whisper: shown while the reader stands at the open door.
  const whisperShown = doorOpen && chapter === LIBRARY_MAX && !isDiving;
  // The refusal whisper, from the last step the world turned back. Yields to
  // the threshold whisper — an open door outranks anything a wall has to say.
  const refusalShown = refusal !== null && !whisperShown && !isDiving;
  // The road not taken. Yields to both of the above: a refusal is the world
  // answering something the reader just did, and an open door is an invitation
  // — an echo of a garden that never was can wait its turn.
  const forkShown = forkEcho !== null && !whisperShown && !refusalShown && !isDiving;
  // How much of the cord is still chain. Until the door opens the library IS the
  // whole journey, so the chain runs the full drop; after, it ends at the
  // threshold and the lantern string takes the rest.
  const chainPct = doorOpen ? (LIBRARY_MAX / MAX) * 100 : 100;

  return (
    <div
      className={`tour-root${isDiving ? ' is-diving' : ''}`}
      style={{ '--accent': node.accent }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <DioramaScene
        scenes={scenes}
        descentRef={descentRef}
        immersionRef={immersionRef}
        accentRef={accentRef}
        yawRef={yawRef}
        pitchRef={pitchRef}
        diveRef={diveRef}
        climbRef={climbRef}
        refuseRef={refuseRef}
        portalRef={doorOpenRef}
        libraryMax={LIBRARY_MAX}
        reduced={reduced}
        onStep={handleStep}
        passRef={passRef}
      />

      {/* Frames the diorama and darkens the four margins the chrome is
          written into (see .frame-vignette). */}
      <div className="frame-vignette" aria-hidden="true" />

      {/* Where you are, written in the top margin — no card, no glass, no
          rectangle over the artwork. The gallery's number is spoken rather
          than metered. */}
      <div className="chapter-mark">
        <FadeSwap
          id={chapter}
          render={(i) => (
            <>
              <div className="chapter-eyebrow">{MARKS[i]}</div>
              <div className="chapter-title">{NODES[i].subtitle}</div>
            </>
          )}
        />
      </div>

      {/* The quote hangs in the air of the gallery (design: 3b). Words sit at
          three depths and drift on their own cycles; the attribution settles
          into the bottom margin once the last word has surfaced. */}
      {/* The quote hangs in the air of the gallery (design: 3b) and takes ONE
          breath per painting: words gather out of nowhere in scattered order,
          the sentence holds, then it dissolves in a different scattered order
          and the air stays empty for as long as you stand there. The words are
          an arrival, not a loop — this used to re-breathe on a per-chapter
          interval, which read as a caption nagging for attention rather than
          something the room said once.

          Nothing schedules that breath: it IS the mount. The field is keyed by
          arrival and gated on the veil, so it mounts once per arrival (a
          chapter you come back to gets a fresh one), every word's delay is
          baked into its own CSS animation, and `scatter-gone` is `forwards` so
          the dissolve leaves them gone with no timer and no state to keep. */}
      <div className="scatter">
        {/* Keyed by chapter AND tongue, not by chapter alone: on an ascent both
            change together, and a bare chapter key would re-render the leaving
            copy in the language it is being replaced BY — the outgoing quote
            would switch to Spanish halfway through its own dissolve. Carrying
            the tongue in the id lets each layer keep the reading it arrived
            with all the way out. */}
        <FadeSwap
          id={`${chapter}:${lang}`}
          render={(sid) => {
            const [ci, tongue] = sid.split(':');
            const i = Number(ci);
            const es = tongue === 'es';
            const { words, attrD, attrOutD } = SCATTER[narrow ? 'narrow' : 'wide'][tongue][i];
            return (
              <>
                {/* Outside the cycle: the sentence is always here for a
                    screen reader, however the visible words come and go. */}
                <span className="sr-only" lang={es ? 'es' : 'en'}>
                  {es ? NODES[i].folio.lineEs : NODES[i].folio.line}
                </span>
                {veil === 'gone' && (
                <div className="scatter-cycle" key={sid} lang={es ? 'es' : 'en'} aria-hidden="true">
                  {words.map((w, k) => (
                    <span
                      key={k}
                      className="scatter-word"
                      style={{
                        left: `${w.x}%`,
                        top: `${w.y}%`,
                        opacity: w.opacity,
                        filter: w.blur ? `blur(${w.blur}px)` : undefined,
                        animationDuration: `${w.fdur}s`,
                        animationDelay: `${w.fd}s`,
                      }}
                    >
                      <span
                        className="scatter-ink"
                        style={{
                          fontSize: `${w.size}vw`,
                          // Two animations, two delays: the gather, then the
                          // dissolve that takes over from it.
                          animationDelay: `${w.d}ms, ${w.od}ms`,
                        }}
                      >
                        {w.t}
                      </span>
                    </span>
                  ))}
                  <div
                    className="scatter-attr"
                    style={{ animationDelay: `${attrD}ms, ${attrOutD}ms` }}
                  >
                    {es ? NODES[i].folio.attrEs : NODES[i].folio.attr}
                  </div>
                </div>
                )}
              </>
            );
          }}
        />
      </div>

      {/* Ascend and descend now live on the plumb line, so only the stateful
          actions remain — set in the bottom margin (design: 3b). */}
      <nav className="air-acts" aria-label="Tour controls">
        <button
          type="button"
          className={`air-act${autoplay ? ' is-on' : ''}`}
          aria-label={autoplay ? 'Pause the drift' : 'Drift downward on its own'}
          aria-pressed={autoplay}
          onClick={(e) => { e.stopPropagation(); releaseFocus(e); setAutoplay((v) => !v); }}
        >
          {autoplay ? 'drifting…' : 'drift'}
        </button>
        <button
          type="button"
          className={`air-act${muted ? ' is-on' : ''}`}
          aria-label={muted ? 'Unmute the ambience' : 'Mute the ambience'}
          aria-pressed={muted}
          onClick={(e) => { e.stopPropagation(); releaseFocus(e); toggleMute(); }}
        >
          {muted ? 'unmute' : 'mute'}
        </button>
        <button
          type="button"
          className={`air-act${showHelp ? ' is-on' : ''}`}
          aria-label={showHelp ? 'Hide the navigation help' : 'Show the navigation help'}
          aria-pressed={showHelp}
          title="Navigation help (H)"
          onClick={(e) => { e.stopPropagation(); releaseFocus(e); setShowHelp((v) => !v); }}
        >
          help
        </button>
      </nav>

      {/* The plumb line — one cord, two instruments, because the two halves of
          the journey are not the same kind of travel.

          Down the LIBRARY it is a chain (design: 1d): the same brass the
          galleries hang their lamps from, with a plumb ring riding it. The ring
          shows the *live* eased descent rather than snapping between chapters,
          and it can be grabbed — drag it and the archive descends with you,
          station tags surfacing as they pass under it.

          Past the door the chain gives out and the cord becomes a LANTERN
          STRING (design: 2a): one paper lantern per stepping stone, kindling
          in turn as the path opens, lit behind you, burning where you stand.
          The garden is walked by lantern-light, not measured by plumb.

          ∧ and ∨ still step the depths one at a time. */}
      <div className="plumb">
        <button
          type="button"
          className="plumb-step"
          aria-label="Ascend one gallery"
          title="Ascend one gallery (↑)"
          onClick={(e) => { e.stopPropagation(); releaseFocus(e); go(-1); }}
          disabled={chapter === 0}
        >
          ∧
        </button>
        <div
          className={`plumb-span${grip !== null ? ' is-gripped' : ''}`}
          ref={spanRef}
          onPointerDown={chainDown}
          onPointerMove={chainMove}
          onPointerUp={chainUp}
          onPointerCancel={chainUp}
          /* The room behind reads a click as a step into it — the chain's does
             not travel that far. */
          onClick={(e) => e.stopPropagation()}
        >
          {/* The chain shortens to the library's share of the cord when the
              door opens; the same 1.5s ease the marks slide apart under. */}
          <div
            className="plumb-chain"
            aria-hidden="true"
            style={{ height: `${chainPct}%` }}
          />
          {doorOpen && (
            <div
              className="plumb-wire"
              aria-hidden="true"
              style={{ top: `${chainPct}%` }}
            />
          )}
          {NODES.map((n, index) => {
            const isGarden = index > LIBRARY_MAX;
            if (isGarden && !doorOpen) {
              return null;
            }
            const at = (index / (doorOpen ? MAX : LIBRARY_MAX)) * 100;
            const cls = ['plumb-mark'];
            if (index === chapter) cls.push('is-active');
            if (isGarden) cls.push('is-garden');
            // Lanterns you have already walked past keep burning, low.
            if (isGarden && index < chapter) cls.push('is-passed');
            // The station the ring would land on if the hand let go now.
            if (grip === index) cls.push('is-grip');
            return (
              <button
                key={n.slug}
                type="button"
                className={cls.join(' ')}
                style={{ top: `${at}%` }}
                onClick={(e) => { e.stopPropagation(); releaseFocus(e); jumpTo(index); }}
                aria-label={isGarden ? `Follow the path to ${n.title}` : `Descend to ${n.title}`}
                aria-current={index === chapter ? 'true' : undefined}
              >
                {/* The tag hangs off the cord to the left, ending in a small
                    rule that points back at the station it names. */}
                <span className="plumb-tag">
                  <span className="plumb-title">{n.title}</span>
                  <span className="plumb-numeral">{NUMERAL[index]}</span>
                  <span className="plumb-tick" aria-hidden="true" />
                </span>
                <span className={isGarden ? 'plumb-lantern' : 'plumb-node'} />
              </button>
            );
          })}
          {/* The ring itself, swaying on its chain. Position is written
              straight to the DOM by the tick — or by the hand holding it —
              never through React. */}
          <div className="plumb-bob" ref={bobRef} aria-hidden="true">
            <span className="plumb-ring" />
          </div>
        </div>
        <button
          type="button"
          className="plumb-step"
          aria-label="Descend one gallery"
          title="Descend one gallery (↓)"
          onClick={(e) => { e.stopPropagation(); releaseFocus(e); go(1); }}
          disabled={chapter === (doorOpen ? MAX : LIBRARY_MAX)}
        >
          ∨
        </button>
      </div>

      {/* No button at the threshold — the walk itself is the trigger (any
          forward step past the vortex becomes the dive, see setTarget). This
          whisper only names the change. */}
      {whisperShown && (
        <div className="door-whisper" role="status">
          the spiral has woken&ensp;—&ensp;keep walking
        </div>
      )}

      {/* The wall answering a step it will not take. Same pill, cooled off the
          garden's green — this one is a refusal, not an invitation. Keyed by
          the refusal's stamp so a later bump re-runs the appear rather than
          leaving a stale pill sitting there. */}
      {refusalShown && (
        <div className="door-whisper is-refusal" role="status" key={refusal.at}>
          {refusal.sealed ? SEALED_WHISPER : PATH_END_WHISPER}
        </div>
      )}

      {/* The garden the reader turned away from, named once on arriving in the
          one they turned toward. Same pill again, and deliberately NOT a
          refusal — nothing was denied here, something was chosen. */}
      {forkShown && (
        <div className="door-whisper is-fork" role="status" key={forkEcho.at}>
          {forkWhisper(forkEcho.missed)}
        </div>
      )}

      {showHelp && (
        <div className="help-overlay">
          <div className="help-panel">
            <div className="help-title">Navigation help</div>
            <div className="help-body">
              • Scroll, ↑ / ↓, or space walk into a gallery, then on to the next<br />
              • Drag with the mouse to look anywhere — left, right, up, below<br />
              • ← / → also look around; Shift + ↑ / ↓ tilt the gaze up and down<br />
              • Swipe up or down to walk in and move between galleries on touch<br />
              • Click to step further into the room<br />
              • Descend and the galleries speak in translation; climb back and
              they speak in Borges' own Spanish<br />
              • Press H or ? to open this guide, Esc to close it<br />
              • Take hold of the brass ring on the chain and drag: the archive
              descends with you, and lets go where you do<br />
              • Or click a station on the chain — a lantern, past the door — for
              a direct jump<br />
              • In the deepest gallery, wait — then keep walking
            </div>
            <button
              type="button"
              className="help-close"
              onClick={(e) => { e.stopPropagation(); releaseFocus(e); setShowHelp(false); }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Dive overlays, opacity driven straight from the tick: the faint dark
          breath over the ghost hand-off, and the tunnel-vision vignette that
          closes the periphery in with the fall's thrust. */}
      <div className="dive-vignette" ref={vignetteRef} aria-hidden="true" />
      <div className="vortex-flash" ref={flashRef} aria-hidden="true" />

      {veil !== 'gone' && <EntryVeil leaving={veil === 'leaving'} onEnter={enter} />}
    </div>
  );
}
