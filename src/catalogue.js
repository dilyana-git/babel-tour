// ── The catalogue ────────────────────────────────────────────────────────────
// What hangs where: every gallery of the library and the garden, every variant
// of every gallery, the clip each variant wakes into, and the rules for drawing
// one — at random on a first visit, unseen on a restock, pinned when ?variant=
// or ?clip= is asking a question about one particular pairing.
//
// It is a catalogue and it reads like one: it grows when art lands, and it is
// the part of this piece most often edited by someone who is not thinking about
// the walk at all. That is the argument for it being here rather than in
// Tour.jsx, where its 550 lines sat between the tour's imports and the tour.
//
// The order of NODES is the order of the descent, and POOLS is the same list
// with its variants intact — the corridor reads NODES, a restock reads POOLS.
import { STILLS_ONLY } from './capability';
import { servedVideo, VIDEO_RATE, VIDEO_RATE_DEFAULT } from './clips';
import { unseenFirst } from './memory';

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
export const PINNED = Boolean(PIN_VARIANT || PIN_CLIP);

// The renderable half of a node: everything a chapter's slab stack and glow
// need, and the only half that changes when a gallery re-draws itself.
export const sceneOf = (node, variant, video) => ({
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
export const livingFirst = (variants) => {
  // With the video off no plate can move, so "living" names nothing and
  // preferring it would only narrow the draw for a distinction that has stopped
  // existing — pinning the reader to the handful of plates that carry clips
  // they will never be served. With the preference lifted the whole pool is in
  // play, and the unseen-first draw underneath gets the widest choice of
  // paintings.
  if (STILLS_ONLY) return variants;
  const living = variants.filter((v) => v.videos?.length);
  return living.length ? living : variants;
};

// Re-draw one gallery: a different version of the same room, for the restock in
// the tick below. Never the version just shown — with two variants that
// alternates, with four it wanders — and where a node owns only one painting, a
// different clip of it still counts as a different version of the room. Returns
// null when the node has nothing else to show, so the caller can drop it from
// the rotation rather than churn its textures for the same picture.
export const redrawScene = (nodeMap, slug, current) => {
  const node = nodeMap[slug];
  // Never the version just shown, then a living one over a still one, then —
  // and this is the part that reaches past the end of the session — one this
  // reader has never been shown at all. The restock only ever guaranteed
  // freshness within a visit; a returning reader could walk the same corridor
  // twice and be re-hung plates they had already stood in front of.
  const others = unseenFirst(
    livingFirst(node.variants.filter((v) => v.color !== current.color)));
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

export const selectRandomVariant = (nodeMap, slug) => {
  const node = nodeMap[slug];
  const byVariant = PIN_VARIANT
    ? node.variants.find((v) => v.color.includes(PIN_VARIANT))
    : undefined;
  const byClip = PIN_CLIP
    ? node.variants.find((v) => v.videos?.some((p) => p.includes(PIN_CLIP)))
    : undefined;
  // A living plate first, and among those the ones this reader has not been
  // shown on a previous visit — so the second walk down the corridor opens on
  // paintings the first one never hung. Pins are untouched by any of it: they
  // exist to hold one thing still.
  const pool = unseenFirst(livingFirst(node.variants));
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
    summary: 'A bridge of stone carries a file of readers across the dark on its own arch, and two lamps keep the gap they cross.',
    accent: '#c9a24c',
    variants: [
      {
        // The room the tour opens in, and the same artwork the overture plays
        // over (OVERTURE_CLIP) — so the title card does not merely dissolve
        // into node I, it dissolves into the very arch it was showing, and the
        // first thing the reader does is walk into the picture they were just
        // looking at.
        //
        // Moved here from the Echo, where it was one of three. The Vestibule
        // was the only node in the library that could not STIR — see
        // livingFirst above, whose comment named this slot as the sole place a
        // still-only plate still had to hang, because impossible_1 has no clip
        // and the one staircase variant that could have filled it (var9)
        // renders ghosted here. That gap sat on the first gallery a visitor
        // ever sees. This plate closes it: depth-mapped, verified, and with
        // three content-matched clips.
        //
        // livingFirst now prefers this over impossible_1 below on load AND on
        // restock, so node I is reliably the one that moves rather than a coin
        // flip. The Echo keeps impossible_2 + var9 and still lives.
        color: '/nodes/descent/05-impossible-prison-staircases-var17.webp',
        depth: '/nodes/descent/05-impossible-prison-staircases-var17-depth.webp',
        videos: [
          '/video/05-impossible-prison-staircases-var17-clip0.mp4',
          '/video/05-impossible-prison-staircases-var17-clip1.mp4',
          '/video/05-impossible-prison-staircases-var17-clip3.mp4',
        ],
        glowAt: [0.69, 0.76], glowScale: 0.85,
      },
      // The original Vestibule plate — twin stairways, chains hanging like
      // plumb lines, one robed reader at the door of fire. It has no clip, so
      // livingFirst filters it out of the draw entirely while the plate above
      // is present, and it is kept rather than deleted: it is the node's
      // original artwork and putting it back is a matter of removing the
      // variant above. (The old node summary described THIS plate; the summary
      // now describes the one that actually hangs.)
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
        // var17 (the procession crossing the bridge) used to hang here as a
        // third variant — thematically it belongs to the Echo, repetition made
        // literal. It now opens the tour at the Vestibule instead, which had no
        // moving plate at all; see the note in that node. Two plates were not
        // worth showing the same bridge twice in one walk, and with var9 above
        // the Echo still has something that stirs.
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
        //
        // HANGS AS A STILL. Both of its clips (clip0, clip3) are pulled: this
        // is the plate whose i2v renders read worst of any in the tour. They
        // are near-identical slow dollies into the bridge, and the push is
        // exactly what the render cannot pay for — the far vault flattens to
        // untextured grey, the balconies over it slump into drooping tongues
        // of stone, and the whole plate turns to smoothed plaster while the
        // painting beside it stays cut. It reads as damage rather than as
        // motion, and at this size the walk-in magnifies it further.
        //
        // Dropping both matters, not just the worse one: a woken gallery draws
        // an UNSEEN clip each visit (see the pool in useClip), so leaving one
        // in only delays the same deformation to the next pass through III.
        // Both files stay on disk and stay listed in X4_FILES above, so ?clip=
        // still reaches them at full super-resolution if they are ever worth
        // another look — nothing here needs re-upscaling to restore them.
        color: '/nodes/descent/05-impossible-prison-staircases-var19.webp',
        depth: '/nodes/descent/05-impossible-prison-staircases-var19-depth.webp',
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

export const LIBRARY_SLUGS = ['vestibule', 'echo', 'silence', 'vertigo'];
export const LIBRARY_NODES = LIBRARY_SLUGS.map((slug) =>
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

export const NODES = [
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
export const POOLS = [
  ...LIBRARY_SLUGS.map((slug) => ({ map: LIBRARY_NODE_VARIANTS, slug })),
  ...GARDEN_SLUGS.map((slug, i) => (GARDEN_ART_READY
    ? { map: GARDEN_NODE_VARIANTS, slug }
    : { map: LIBRARY_NODE_VARIANTS, slug: LIBRARY_SLUGS[i] })),
];
