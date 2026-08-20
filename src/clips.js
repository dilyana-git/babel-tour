// ── Clip delivery ────────────────────────────────────────────────────────────
// Which file a painting's awakening actually fetches, and how fast it plays.
//
// One choke point, and every decision that ends in a clip URL passes through
// it: the super-resolution ladder, the data-saver walk, and the host the clips
// are served from. Held apart from the tour itself because none of it is about
// the walk — it is a delivery table, it changes when a batch lands rather than
// when the piece does, and these ~360 lines of reasoning about why one upscale
// beat another were ~360 lines standing between a reader of Tour.jsx and the
// first line of the tour.
import { STILLS_ONLY } from './capability';

// Per-clip playback rate. Every source .mp4 is ~5.05-5.21s; slowing a clip
// stretches its single awakening pass into a longer, more dreamlike drift
// (the still settles whenever the pass truly ends, so this just lengthens
// the motion). Clips omitted here fall back to VIDEO_RATE_DEFAULT. Declared
// up top because both LIBRARY and GARDEN variant pools read it.
export const VIDEO_RATE_DEFAULT = 0.42; // → ~12s per pass

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
// The one clip whose source is already bigger than the SR batch: var2-clip3, at
// a native 2548x1080. It used to be DOWN-encoded to 1888x800 to match the rest,
// on the reasoning that it sat "on a plate no wider than 1888 anywhere it is
// drawn, i.e. paying for pixels the surface throws away".
//
// THAT REASONING WAS WRONG, and the arithmetic is worth keeping because it sets
// the target for every batch. A card is built to the frustum at its own depth
// (DioramaScene: h = frustumH(dist) * OVERSCAN * over) and the artwork occupies
// h * ART_ASPECT of it, so the distance cancels and the artwork always spans
//   OVERSCAN(1.35) * ART_ASPECT(2.344) / viewport aspect
// viewport widths — 1.98 of them at 16:10, and more once you walk in. Only
// about half the plate's width is ever on screen, so a 1888-wide clip lands
// ~955 of its pixels on the 2160 device pixels a 1440 CSS window has at
// DPR_MAX 1.5: a 2.3x magnification, against 1.26x for the 3376-wide still.
// The surface was not throwing those pixels away — it was short of them, and
// that gap is most of why a woken clip reads softer than the painting it
// animates.
//
// So this one is served at its native width, re-encoded only to carry the three
// things a clip must have (see the header): crf 17, sRGB tags, faststart.
// 20.6 MB, same 125 frames, same 5.208 s, same 24/1 — verified by ffprobe.
// NOTE the tags do NOT survive an encode whose INPUT is an mp4 — ffmpeg writes
// colorspace and range but leaves primaries and transfer unknown, which is the
// blown-out failure mode — so they went on afterwards with the h264_metadata
// bitstream filter. Encoding from PNG (the upscale script's path) is the case
// that gets them for free.
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
// The same clip at the old 1888, kept solely so the paragraph above can be
// checked rather than believed: ?sr=fit1888 is the ONLY difference from the
// default, on the only clip in the tour that has real detail above 1888. If a
// walk cannot tell them apart on this one, no amount of super-resolution on the
// other 38 will show either, and the GPU days are not worth spending.
const FIT_1888_BATCH = {
  root: '/video-fit-1888',
  files: new Set(['01-moonlit-labyrinth-var2-clip3.mp4']),
};
// Where a full-width Real-ESRGAN batch lands. The model already renders 4x
// (944 -> 3776, 832 -> 3328); the encode used to throw half of that away to
// land on 1888, which is the shortfall the FIT_BATCH note measures. Runs made
// with tools/upscale-videos.ps1 -OutWidth 3376 (its default now) keep it, and
// arrive here.
//
// The set is empty until clips actually exist in public/video-x4-full — a name
// listed here without a file on disk is the silent never-wakes failure the
// header warns about, because the dev server answers a missing .mp4 with
// index.html at status 200. Add each basename as it lands; `best` picks it up
// ahead of /video-x4 automatically.
const X4_FULL_BATCH = {
  root: '/video-x4-full',
  files: new Set([]),
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
    // Full-width first: where a clip exists at the plate's own resolution it
    // outranks the same clip halved to 1888 (see FIT_BATCH's arithmetic).
    batches: [X4_FULL_BATCH, ...LATEST_BATCHES, X4_BATCH, FIT_BATCH],
    root: VIDEO_ROOT,
  },
  // The default with the full-width batch taken out — the A/B for a clip that
  // has landed in /video-x4-full, against whatever used to serve it.
  half: {
    batches: [...LATEST_BATCHES, X4_BATCH, FIT_BATCH],
    root: VIDEO_ROOT,
  },
  // The 2548 native clip at the old 1888. See FIT_1888_BATCH.
  fit1888: {
    batches: [FIT_1888_BATCH, ...LATEST_BATCHES, X4_BATCH],
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
// Where the clips are actually hosted. Empty by default: they sit under public/
// and ship inside the build, which is the right shape for developing against and
// an increasingly wrong one for a deploy — 38 clips at ~11 MB each is 434 MB of
// the 654 MB build, so the artefact that carries a 1.3 MB bundle and 54 MB of
// paintings is 90% video, and every host that might serve it has an opinion
// about that.
//
// Set VITE_VIDEO_HOST to a bucket or CDN origin at build time and every clip URL
// is rewritten to it, the build drops the clip roots entirely (see
// vite.config.js), and the deploy becomes small enough to be ordinary. Nothing
// else changes: the SR chain still resolves which root a clip comes from, this
// only decides which HOST that root hangs off. Clips are fetched by <video>, so
// the bucket needs CORS for the origin the tour is served from.
//
// Trailing slash tolerated and stripped — a base that ends in one would produce
// a double slash, which most origins forgive and some sign differently.
const VIDEO_HOST = (import.meta.env?.VITE_VIDEO_HOST ?? '').replace(/\/+$/, '');
const SR_KEY = typeof window === 'undefined'
  ? 'best'
  : new URLSearchParams(window.location.search).get('sr') ?? 'best';
export const servedVideo = (path) => {
  if (!path) return path;
  // The thrift walk stops here, at the same one choke point every other video
  // decision passes through. A clip is 9-25 MB and a full walk pulls ~590 MB of
  // them; a reader who has switched their browser's data saver on has said
  // plainly that they do not want that spent. Returning undefined rather than
  // muting or pausing means the <video> is never CREATED, so nothing is
  // requested at all — pausing a clip still downloads it.
  //
  // What is left is not a broken tour. The paintings hang, keep their full
  // depth relief, and can still be walked into; they only never wake. That is
  // the same state every still-only plate in the pools is already in, so it is
  // a mode the piece has always known how to be in.
  if (STILLS_ONLY) return undefined;
  const file = path.slice('/video/'.length);
  const key = VIDEO_SR[SR_KEY];
  const batch = key?.batches.find((b) => b.files.has(file));
  // A key may name its own fallback for the clips its batches do not carry;
  // an experiment key that names none keeps dropping to VIDEO_ROOT, so the
  // one file under test is the only thing that differs between two keys.
  const local = batch
    ? `${batch.root}/${file}`
    : (key?.root ?? VIDEO_ROOT) + path.slice('/video'.length);
  return VIDEO_HOST + local;
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
export const VIDEO_RATE = {
  '/video/04-gothic-library-var2-clip1.mp4': 0.58,  // the lone reader before the far moon → ~8.7s
  '/video/04-gothic-library-var3-clip1.mp4': 0.42,  // grand candlelit hall reveal → ~12.4s
  '/video/04-gothic-library-var3-clip2.mp4': 0.42,
  '/video/02-endless-garden-starry-var2-clip1.mp4': 0.58,   // starry delta, ghost figures → ~9.0s
  '/video/02-endless-garden-starry-var1-clip1.mp4': 0.58,
  '/video/02-endless-garden-starry-var1-clip2.mp4': 0.58,   // figures drift; the worst of the four
  '/video/01-moonlit-labyrinth-var2-clip3.mp4': 0.42, // the wide 1080p labyrinth → ~12.4s
};
