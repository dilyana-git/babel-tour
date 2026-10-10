// ── The catalogue ────────────────────────────────────────────────────────────
// What hangs where: every gallery of the library and the garden, every variant
// of every gallery, and the rules for drawing one — at random on a first visit,
// unseen on a restock, pinned when ?variant= is asking a question about one
// particular painting.
//
// It is a catalogue and it reads like one: it grows when art lands, and it is
// the part of this piece most often edited by someone who is not thinking about
// the walk at all. That is the argument for it being here rather than in
// Tour.jsx, where its 550 lines sat between the tour's imports and the tour.
//
// The order of NODES is the order of the descent, and POOLS is the same list
// with its variants intact — the corridor reads NODES, a restock reads POOLS.
import { unseenFirst } from './memory';

// Draw one variant of a node at random — a stable seed would defeat the "world
// stirs on revisit" point.
//
// Pinning, for looking at ONE painting on demand instead of waiting for it:
// every pool is a random draw, so a given plate can be many revisits away. It
// takes a filename fragment; nodes that match it are left to the random draw as
// usual. Pair with ?node=<slug> (below) to land on the node holding it rather
// than walking there.
//   ?variant=01-moonlit-labyrinth-var0     — pin the painting
const pinParam = (key) => (typeof window === 'undefined'
  ? null
  : new URLSearchParams(window.location.search).get(key));
const PIN_VARIANT = pinParam('variant');

// A pin is meant to STAY pinned — the point of ?variant is to hold one painting
// still and look at it — so a pinned session never restocks.
export const PINNED = Boolean(PIN_VARIANT);

// The renderable half of a node: everything a chapter's slab stack and glow
// need, and the only half that changes when a gallery re-draws itself.
export const sceneOf = (node, variant) => ({
  color: variant.color,
  depth: variant.depth,
  glowAt: variant.glowAt,
  glowScale: variant.glowScale,
  fog: node.fog,
});

// Re-draw one gallery: a different version of the same room, for the restock in
// the tick below. Never the version just shown — with two variants that
// alternates, with four it wanders. Returns null when the node has nothing else
// to show, so the caller can drop it from the rotation rather than churn its
// textures for the same picture.
//
// A node with ONE variant can therefore never restock, and walking back to it
// is a literal rewind. That is the argument for every node fielding at least
// two plates; see the note on the Web of Time, which was the last node stuck at
// one and is the reason this is written down.
export const redrawScene = (nodeMap, slug, current) => {
  const node = nodeMap[slug];
  // Never the version just shown, and then — this is the part that reaches past
  // the end of the session — one this reader has never been shown at all. The
  // restock only ever guaranteed freshness within a visit; a returning reader
  // could walk the same corridor twice and be re-hung plates they had already
  // stood in front of.
  const others = unseenFirst(node.variants.filter((v) => v.color !== current.color));
  if (!others.length) return null;
  const variant = others[Math.floor(Math.random() * others.length)];
  // Fog is the node's mood, not the variant's, and `current` already carries the
  // right one even where a chapter is standing in for another (GARDEN_ART_READY).
  return { ...sceneOf(node, variant), fog: current.fog };
};

export const selectRandomVariant = (nodeMap, slug) => {
  const node = nodeMap[slug];
  const byVariant = PIN_VARIANT
    ? node.variants.find((v) => v.color.includes(PIN_VARIANT))
    : undefined;
  // The ones this reader has not been shown on a previous visit come first, so
  // the second walk down the corridor opens on paintings the first one never
  // hung. A pin is untouched by it: it exists to hold one thing still.
  const pool = unseenFirst(node.variants);
  // …and one node gets to name its own opening plate. See `opens` on the
  // Vestibule's arch: that gallery is the one the title card stands on, so
  // which version of it draws is not only a question about the gallery.
  //
  // It only wins while it is still UNSEEN — `pool` is the unseen-first list, so
  // a reader who has already had the arch gets the ordinary random draw and the
  // node keeps stirring across visits. A first visit is the only one this
  // decides, which is exactly the visit it is about.
  const opener = pool.find((v) => v.opens);
  const variant = byVariant ?? opener
    ?? pool[Math.floor(Math.random() * pool.length)];
  return {
    slug,
    title: node.title,
    subtitle: node.subtitle,
    summary: node.summary,
    accent: node.accent,
    scene: sceneOf(node, variant),
    folio: node.folio,
  };
};

// The 05-impossible-prison-staircases batch:
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
// deepest one opens a door onto the garden's four paths.
//
// Same shape as GARDEN_NODE_VARIANTS below: one Midjourney original per node
// plus a couple of the newer staircase renders, each a colour plate and the
// depth map the slab stack is cut from.
const LIBRARY_NODE_VARIANTS = {
  vestibule: {
    title: 'The Vestibule',
    subtitle: 'Threshold of the archive',
    summary: 'A bridge of stone carries a file of readers across the dark on its own arch, and two lamps keep the gap they cross.',
    accent: '#c9a24c',
    variants: [
      {
        // The room the tour opens in, and the artwork the title card stands
        // on — the card is transparent now, so this plate IS the first thing a
        // reader ever sees, and the withdrawal then draws back out of the very
        // frame they were reading the title over.
        //
        // Which is why it is marked `opens`: a first visit gets this one rather
        // than a coin flip with impossible_1 below. The two plates are not
        // interchangeable behind a title card. This is the arch — carved span,
        // the procession of figures crossing its balustrade, depth on both
        // sides of it — and it holds the type in the dark of its own vault.
        // impossible_1 is a dim vaulted hall, fogged almost flat at the opening
        // framing; measured against this plate it loses about a third of its
        // frame luminance and most of its highlights, and the card sits on mud.
        // It is still a good painting and it still hangs here — from the second
        // visit on, when there is no title over it.
        //
        // (The arch used to win this slot as a side effect of a rule about
        // clips: it was the only Vestibule plate with one, and the draw
        // preferred plates that could move. That rule went with the video, and
        // took this choice with it silently. `opens` is the same decision made
        // on its own terms.)
        //
        // Moved here from the Echo, where it was one of three.
        opens: true,
        color: '/nodes/descent/05-impossible-prison-staircases-var17.webp',
        depth: '/nodes/descent/05-impossible-prison-staircases-var17-depth.webp',
        glowAt: [0.69, 0.76], glowScale: 0.85,
      },
      // The original Vestibule plate — twin stairways, chains hanging like
      // plumb lines, one robed reader at the door of fire. It shares the node
      // with the arch above, so the two alternate across visits. (The old node
      // summary described THIS plate; the summary now describes the arch, which
      // is what a first visit is most likely to open on.)
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
          // The unused var16 assets were removed during archive cleanup.
          color: '/nodes/descent/05-impossible-prison-staircases-var9.webp',
          depth: '/nodes/descent/05-impossible-prison-staircases-var9-depth.webp',
          // Starting estimate from the plate's dominant warm source; the shrine
          // glow sits right of centre. Worth an eye — the automatic pick agrees
          // with the hand-tuned value on impossible_2 but not on plates with
          // several competing lamps, which this one has.
          glowAt: [0.73, 0.58], glowScale: 1.0,
        },
        // var17 (the procession crossing the bridge) used to hang here as a
        // third variant — thematically it belongs to the Echo, repetition made
        // literal. It now opens the tour at the Vestibule instead; see the note
        // in that node. Two plates were not worth showing the same bridge twice
        // in one walk.
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
    summary: 'Where the stairways stop crossing, a single lamp keeps the dark honest.',
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
          glowAt: [0.61, 0.54], glowScale: 0.7,
        },
        {
          // A single spiral winding down into a lit tunnel mouth.
          color: '/nodes/descent/05-impossible-prison-staircases-var11.webp',
          depth: '/nodes/descent/05-impossible-prison-staircases-var11-depth.webp',
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
// Each node offers several Midjourney variants; one is drawn per page load,
// and a node the reader walks back to re-hangs itself with one they have not
// seen (see redrawScene). Every variant is a colour plate plus the depth map
// its slab stack is cut from, and the two must be the same picture — a plate
// wearing another's depth reads as a room melting.
const GARDEN_NODE_VARIANTS = {
  door: {
    title: 'The Door',
    subtitle: 'One volume was a gate',
    summary: 'Between two shelves the stone gives way; beyond the jamb, wisteria and a lantern in the dark.',
    accent: '#9fc48a',
    variants: [
      {
        color: '/nodes/garden/04-gothic-library-var0.webp',
        depth: '/nodes/garden/04-gothic-library-var0-depth.webp',
        glowAt: [0.5, 0.45], glowScale: 1.1,
      },
      {
        // Cathedral-nave aisle, books and chains flanking a pointed arch that
        // floods green — the clearest "half library, half garden" read of any
        // variant so far, the figure standing right in the threshold light.
        color: '/nodes/garden/04-gothic-library-var1.webp',
        depth: '/nodes/garden/04-gothic-library-var1-depth.webp',
        glowAt: [0.505, 0.39], glowScale: 1.15,
      },
      {
        color: '/nodes/garden/04-gothic-library-var2.webp',
        depth: '/nodes/garden/04-gothic-library-var2-depth.webp',
        glowAt: [0.47, 0.7], glowScale: 0.9,
      },
      {
        color: '/nodes/garden/04-gothic-library-var3.webp',
        depth: '/nodes/garden/04-gothic-library-var3-depth.webp',
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
        glowAt: [0.68, 0.6], glowScale: 0.95,
      },
      {
        color: '/nodes/garden/01-moonlit-labyrinth-var1.webp',
        depth: '/nodes/garden/01-moonlit-labyrinth-var1-depth.webp',
        glowAt: [0.74, 0.55], glowScale: 0.85,
      },
      {
        color: '/nodes/garden/01-moonlit-labyrinth-var2.webp',
        depth: '/nodes/garden/01-moonlit-labyrinth-var2-depth.webp',
        glowAt: [0.585, 0.56], glowScale: 0.9,
      },
      {
        // Wisteria arcade under a night sky, a corridor of paper lanterns
        // receding to a lit gap, the small figure stopped at the mouth of the
        // hedge. It had been finished and left unhung: full 3376x1440 plate, a
        // matching depth map, and a baked backdrop at the same quarter-res as
        // every other garden plate — everything the slab stack asks for.
        color: '/nodes/garden/01-moonlit-labyrinth-var3.webp',
        depth: '/nodes/garden/01-moonlit-labyrinth-var3-depth.webp',
        // The big pendant lantern right of centre. Picked by the brightest
        // lamp-sized area of the plate, a measure that reproduces the
        // hand-tuned glowAt of all three variants above to within 0.06 — this
        // plate has one clearly dominant source, which is the case that measure
        // gets right.
        glowAt: [0.60, 0.47], glowScale: 0.95,
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
    summary: 'Over black water a single pavilion burns warm, and on its table a qin waits for whichever of your lives sits down to play.',
    accent: '#e0b45c',
    variants: [
      {
        color: '/nodes/garden/03-solitary-pavilion-var0.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var0-depth.webp',
        glowAt: [0.5, 0.55], glowScale: 1.15,
      },
      {
        color: '/nodes/garden/03-solitary-pavilion-var1.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var1-depth.webp',
        glowAt: [0.56, 0.55], glowScale: 1.1,
      },
      {
        color: '/nodes/garden/03-solitary-pavilion-var2.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var2-depth.webp',
        glowAt: [0.3, 0.52], glowScale: 1.0,
      },
      {
        color: '/nodes/garden/03-solitary-pavilion-var3.webp',
        depth: '/nodes/garden/03-solitary-pavilion-var3-depth.webp',
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
        glowAt: [0.48, 0.31], glowScale: 0.7,
      },
      {
        // The firefly maze under the Milky Way, one lamp burning at the vanishing
        // point of the hedges. Finished and left unhung like the labyrinth plate
        // above, and this node is the one that most needed it: the Web was the
        // last gallery in the tour standing on a SINGLE variant, so it could not
        // restock, and walking back to it was the literal rewind the restock
        // exists to prevent (see redrawScene, which returns null there).
        color: '/nodes/garden/02-endless-garden-starry-var3.webp',
        depth: '/nodes/garden/02-endless-garden-starry-var3-depth.webp',
        // BY EYE, not by measure. Both starry plates defeat the automatic pick
        // the same way — their star field and their firefly-lit hedges are each
        // brighter, over a lamp-sized area, than the lamp — which is why var1's
        // value above is hand-set too. This names the same thing var1's does:
        // the single warm lamp on the horizon. Worth an eye on real hardware.
        glowAt: [0.52, 0.33], glowScale: 0.7,
      },
      // Neither of these two hangs with a baked backdrop: the starry plates are
      // the only ones in the piece with no entry in BACKDROP_PLATES, so their
      // dis-occlusion gaps are filled by the runtime dilation smear instead of
      // an inpaint. Dropped deliberately, see the note in src/backdrops.js.
      // Unused starry drafts and their depth maps were removed during cleanup.
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
