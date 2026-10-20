# Design history

What was asked for, what was tried, and what was picked. The code says what
is built and why; how it got there lives here and in git history.

A look's alternatives are removed once one is picked (see "Variants of a
look" in `AGENTS.md`). The values recorded here are enough to put one back,
and the commits named hold the code that drew it.

**Before 2026-10-16** every design board left a `src/world/*Fix*.js` module
behind a `?w…=old` switch, and this file carried the full prose of each board
and the comments cut from the code on 2026-10-12. All of that is on the
branch `archive/before-old-fold` (commit `0857f2a`): the code of every old
path, and this document in full (`git show 0857f2a:docs/design-history.md`).

## Still open

- **Desktop captions** (2026-10-15). Can the room's writing leave more of the
  architecture visible? Default: the 27rem caption, title
  `clamp(2rem, 3.2vw, 3.1rem)`, a reserved quotation block. `?wcaption=quiet`:
  a 25rem caption, title `clamp(1.65rem, 2.2vw, 2.05rem)`, 1rem subtitle, a
  smaller shadow; name and passage alternate in one corner on the phone's
  timing (4.5 s, then every 12 s, 5 s after stopping); passages recede while
  walking. Pending the user's look: `.ux-review/qa/2026-10-15-caption/`
  (`*-a.png` default, `*-b.png` quiet). On a pick, remove the other path and
  the flag in the same commit, and record the commit here.

## 2026-10-20

- **Unequal cherry leaders instead of paired Vs.** Beside one another, the
  flowering trees repeated the same low crotch and two spreading arms. One
  existing stem now continues upward, while the other boughs attach at
  staggered heights with unequal reach and irregular bearings. Each bough's
  smaller branches move with it, keeping the joints and flowers connected.
  The shape uses the existing cherry seed XOR `0x6272616e`; the planting and
  original tint budgets stay unchanged. Commit `0c20835` holds the previous
  shape. An initial leader at .56–.67 of tree height made a narrow column;
  .36–.43 with spreading upper branches gives a broader crown. Fine twig
  bases also taper with their parent branches. Saved garden,
  neighbouring-tree and bare-branch views are in
  `.ux-review/qa/cherry-shape/`.

- **An illuminated labyrinth favicon.** The two concentric gold hexagons
  become a continuous hexagonal passage around a lit doorway. A shaded
  bronze edge and a pale upper rim give the gold walls depth against the
  existing dark ground. The broad passage keeps its silhouette at tab size;
  gradients and the doorway's pool of light add detail at larger sizes.
  The previous mark is in commit `0c20835`. The focused before/after and
  16, 32 and 48 px previews are in `.ux-review/qa/favicon/`.

- **Connected crowns, substantial shrubs and matte turf.** The garden still
  read as bare boughs carrying isolated clumps, hollow shrubs and grey lawn.
  Broad trees, maples and cherries now carry adjoining leaf or blossom
  billows at four stations along their spreading boughs. This fills the
  middle and lower crown without moving trunks or changing the established
  growth and tint budgets; the fixtures still assert those original budgets.

  Shrubs have irregular hemispherical bodies rooted below the turf, with
  dense small leaves over the surface and a low skirt at the foot. Three
  body shapes use seed `0x62757368`; their leaf detail keeps the independent
  planting seeds. Leaf texture, soft diffuse fill and greens shared with the
  tree planting keep the body and outer shoots together. Companion stones
  sit beside the shrubs rather than underneath their leaf skirts.
  The core is tucked inside a dense ground-level skirt: exposed, its warm
  lantern lighting read as a stone pedestal under the green shoots.

  The grass's persistent grey cast came from sky reflection overwhelming its
  dark albedo at grazing angles. Turf and grass blades now keep no sky gloss
  and only .08 of direct specular light; the grassy share of the pond bank
  receives the same treatment. The lawn uses linear RGB .032, .055, .015,
  gain .42, softer fine variation and more neutral moonlight. Short bent
  blades now cover the lawn in irregular patches, instanced from seed
  `0x626c6164` and placed with seed `0x73776172`; taller growth remains at the
  edges. Commit `9af9ef1` holds the previous planting. Close tree, shrub and
  turf comparisons are in `.ux-review/qa/garden-forms/`, including the red
  surface check that confirmed the grass's albedo patch was active.

## 2026-10-19

- **A fuller, more coherent garden.** Sparse tip-only crowns, pale mottled
  turf and oversized shrub sprays made the planting feel artificial. All six
  tree species now carry layered inner foliage and small leafy side shoots.
  Pines also grow 9–12 unequal boughs through the upper crown, with needle
  sprays along each bough rather than only at its tip. Broad and maple leaf
  textures have smaller leaves with independently seeded fine growth;
  flowering cherries retain blossom layers above their green branchlets.
  Softer crown occlusion and a small diffuse fill keep shaded leaf readable.
  Existing trunks, placement and the clipped growth/tint budgets are kept;
  the fixtures retain hashes of those original budgets alongside the new
  foliage. New canopy detail uses seed `0x4c555348`, combined with each
  specimen's dimensions and existing foliage position.

  Shrubs are overlapping mounds of 11–18 small box-leaf sprays per original
  sprig, rooted at the turf and coloured from the broad trees' palette. Their
  detail uses independent seed `0x73687262` and planting coordinates. The
  lawn's base is a deeper green (linear RGB .046, .048, .004; gain .28), with
  subdued, warped patches, fine directional nap and slight blade relief.
  Cooler moonlight on the turf is reduced; tips and straw at the paths are
  darker. Short grass grows in irregular runs beyond the taller path fringe,
  with seed `0x74757266`. Commit `97d96d9` holds the previous garden. Review
  images are in `.ux-review/qa/garden-lush/`: `before-*`, the intermediate
  `after-*` and `final-*`, the `polished-*` views, and the settled
  `settled-*` ground and path views.

- **Pines without a cross silhouette.** The green tree behind the blossoms
  had opposing boughs at almost the same height. Pine boughs now occupy
  staggered tiers from .29 to .86 of the trunk, with a little of their
  original height variation. Their reaches scale to .78–.94 and their tips
  rise by .10–.18 of their horizontal reach. Forks and needle pads move with
  each bough; trunks and planting stay in place. Original sprays retain the
  clipped tint budget, with revised needle tints on an independent stream
  seeded by `0x70696e65` and the specimen's existing trunk measurements.
  Commit `e031dc2` holds the previous silhouette. Before/after garden views:
  `.ux-review/qa/pine-staggered/` (`*-pine-garden`, `*-pond-back`).

- **Trees with curved, tapering wood.** Long limbs still looked like straight
  spokes. All six species now refine their established growth skeleton into
  continuous curves, with daughters following their parent's tangent before
  opening out. The forks follow the parent's curved centre line so branches
  stay joined. Broad trees lift, pine and cedar boughs bow with rising tips,
  cherries spread under their blossom, and willows carry heavier arches.
  Thick wood has 10–12 sides, thinner limbs 5–8, with closer rings, soft
  collars, fine tapered tips and unequal terminal twigs. Trunk flares shade
  along their slope and buttresses. The bow factors, as fractions of limb
  length, are broad .05, pine −.06, maple −.015, cherry −.05, willow −.075,
  cedar −.045. Detail uses seed `0x68bc21eb` combined with each limb's
  existing geometry. Growth and colour draws, foliage positions and planting
  remain unchanged; no seed migration or comparison flags. Commit `93bae0c`
  holds the previous trees. Bare-wood specimens use seeds 12031, 12043,
  12049, 12071, 12073 and 12097 in species order. Their before/after images
  and garden views are in `.ux-review/qa/trees-2026-10-19/` (`before-wood-*`,
  `final-wood-*`, `final-*-garden`). `check:trees`, included in the quick
  check, covers attachment, curvature, valid geometry, deterministic detail,
  and the established growth/foliage outputs, including weeping and spire forms.

- **The Library already open to the garden.** The user liked the revealed
  arcade but disliked watching the wall crumble. The arcade and its gallery
  lanterns now appear from the start and stay when the reader looks away or
  returns. Removed the gaze timer, cracks, falling stones, dust, reassembly
  and `wface` bypass; the walking boundary is preserved. Commit `8cd741d`
  retains the former effect (25 seconds looking to open, 40 looking away to
  close, 1 back inside). Before/after garden views are in
  `.ux-review/shots/library-face/`: `before-*` holds the former effect at its
  completed state; `after-*` shows the permanent arcade without an override.

- **Chosen looks made permanent.** Removed `wflora`, `wendin`, `wnear`,
  `wroof` and their losing code paths. Commit `1483bc8` retains every option.
  The desktop caption comparison remains open. Before/after room views are
  `.ux-review/shots/cleanup/before-*.png` and `after-*.png`.
  - Door ivy: a had no room face, reveal 14, no case growth or hanging
    strands; **b, picked**, face left/right 42/30, budget 1500, reveal 25,
    no case growth, five strands; c face 104/80, budget 3600, reveal 25,
    case growth to 62, nine strands. The floor greenery had already gone.
  - Ending: a faded in turn (line complete at 4500 ms), b found letters
    (6400 ms; search from 2600 over 2600, tick 110, glow 520), **c, picked**,
    lit each word (5000 ms), d drew back (4700 ms). The line stands alone
    for another 4500 ms in every option.
  - Near readers: a oatmeal twill, weave [22, .32, 0, .1], wool
    [[1, .82, .6], .25, .62], face [-.32, .14, .03, .32], skin .45;
    **b, picked**, fulled moorit, weave [30, .32, 1, .12], wool
    [[.95, .72, .52], .35, .42], face [-.62, .1, .02, .12], skin .55;
    c homespun greige, weave [12, .3, 2, .1], wool
    [[1, .84, .66], .38, .55], face [-.02, .035, .04, .42], skin .5.
    The `old` bypass and live option switches are removed too.
  - Roof: **grey tile, picked**, pan/roll RGB [58,62,66]/[88,92,95],
    roughness/sky/direct .88/.3/.6; green glazed tile
    [26,50,40]/[42,82,62], .5/.45/.8; bark shingle [58,47,39],
    .96/.15/.3, without tile rolls and with a 2.4 rather than 1.5 eave board.

- **Deferred preparation waits for a still room.** The map froze briefly
  and entry flights stuttered when the lower galleries prepared immediately
  after opening. Their compilation and buffer uploads now wait for 1500 ms
  without camera movement in a room and pause again during movement. Busy
  governor windows are discarded. Collision-tree warming stays independent
  because distant lamp occlusion needs it during entry.

- **Room identity before mobile guidance** (audit VI·11·2). The phone's
  hint stood above the room's name, and passages hid the whole heading.
  The hint now follows the caption in the HUD, above the navigation. The
  numbered kicker stays visible while the name and passage alternate; only
  the subtitle recedes after arrival. The active passage sizes the rows
  below the kicker so longer quotations cannot cover it. Desktop captions
  and hint placement retain their existing layout. Phone previews (390 × 844):
  `.ux-review/shots/mobile-room-identity/` (`echo-arrival`, `echo-passage`,
  `echo-quotation`, `door-passage`).

- **Tall-map numerals belong inside their rooms** (audit VI·11·1). Above
  the upper rim, each number read as the room above it on the phone's
  steeper map; VII also crowded the byline. Tall layouts now centre every
  numeral in its projected room or landmark, with a centred text baseline.
  The Fork and Web retain their gravel junction and court marks. Wide maps
  keep the raised rim placement. Before/after at 390 × 844:
  `.ux-review/shots/numerals-tall/numerals-phone-before-map.png` and
  `.ux-review/shots/numerals-tall/numerals-phone-after-map.png`.

- **A book taken by hand** (third audit, picked 2026-10-12). The chosen
  treatment is a shelf spine picked directly, a walk over to it, and the
  volume itself open at two facing pages. The built spread was only reachable
  through `?wread` (`57aab0b`); the flag and its room-only catalogue are now
  removed. An instance carries its actual hexagon, wall, shelf and volume,
  and its position seeds repeatable contents. Hover warms that spine; an
  approach uses the walking body's floor and clearance probes, including a
  route round a well when needed. R takes the spine at the centre of the
  view for keyboard use. The shelf-mark is said once, below the book; the
  running head names the story. Pointer/touch opening focuses the return
  control without a ring; keyboard opening or Tab shows it. The garden's
  placeholder "Path VII · the novel" was removed: this interaction is with
  physical Library shelves. Before/after: `.ux-review/shots/book-before-room0.png`
  and `.ux-review/book-qa/book-pointer.png`.

- **The way's "tape" was the brass** (audit V·2·2, "the way glow is still
  tape: a crisp gold band of constant width, turning square at a corner").
  Measured from a walking eye: the band stayed with the glow off and went
  with the brass hidden. It was the inlay ring round each well (hexagon,
  `shaft + 16.6…18`, 0.5 proud), whose apothem (~57) is the line the worn way
  follows, so it ran down the middle of the way; and the fillet at the cases'
  foot. The glow alone was a soft even wash, edged by the worn strip. Options
  canvas: https://claude.ai/artifact/64LP4HSHm2k4uYyurpbLNv. **Picked A + G2**
  (my recommendation).
  - Brass. Was: inlay `#9c7c3c` rough 0.4 metal 0.7; fillet `#6b5634` rough
    0.72 metal 0.35. **A** (picked): both `#4d3f2b` rough 0.85 metal 0.25
    (`OLD_BRASS`). The rings round the wells (Vestibule/Silence hexagons, the
    Echo's two circles, the Vertigo's mouth) are their own batch,
    `inlayWorn`; the Echo rose keeps `M.inlay`. C: no brass at all (floor
    reads bare by the cases). Tried, dropped: the ring moved in to the
    well's lip (the way hugs the well, so it still ran along it); a pale
    stone strip in its place (read as white tape).
  - Glow, all on the old window and gain. Was: even across the strip.
    **G2** (picked): each slab its own half-width (0.32–0.9 of the strip),
    profile `1 − smoothstep(0.45h, h, across + 0.18·noise)`, strength
    0.55–1.05, nothing in the joints (roughness G > 0.8–0.92), ×1.2; an even
    0.45 where a pixel spans 6–28 texels. G1 feathered:
    `exp(−6.5·a²)`, a = across + 0.32·noise(0.22) + 0.12·noise(0.9), joints
    ×0.45, ×1.25. G3 hollows: a 32-tap same-slab share (radii 14–104
    texels), `smoothstep(0.35, 0.95, s)²`, `exp(−3.5·a²)`, ×1.7. The
    options were in-page mock-ups only, never committed.

- **Cherry blossom: a soft cloud on rounded limbs** (audit V·8·3, "blossom
  as popcorn, on sticks": hard-edged flat pink cards, evenly bright, and
  few-sided straight limbs that read as sticks beside the new lawn). Options
  first, on a canvas (https://claude.ai/artifact/2tSh9a6fpMGRnXWRJqiFFv:
  the Fork stand, a grove cherry ~7 m off, under it looking up, the
  Pavilion stand). All three shared the new wood and the soft cut. **The
  user picked A.**
  - Shared: the cherry's limbs (still grown from the trees' stream, draw
    for draw) are redrawn by `bloomCherry` from its own stream: Catmull-Rom
    through the old nodes, a node every 2 units, 6 to 12 sides, a sag of
    0.07 (limbs) and 0.05 (branches) of their length, radius ∝ t^0.6. Two
    or three twigs per branch end carry the flower. One crown per tree,
    centred on the tips, so the underside goes dark. The foliage shader's
    feather ramp for the blossom column is never narrower than `soft` in
    alpha. The atlas column is repainted after the loop as one puff of
    clusters over radial halos.
  - **A haze** (picked): tints `#c6b2aa #bfaca6 #cab4ab #bba8a4`, soft
    0.34; 30 clusters of 14–19 florets, sat 6–16 %, L 62 + 18·out; per twig
    two tip sprays (rc S·0.14–0.18, sizes rc·1.7–2.1 and 1.5–1.8) and a mid
    one (rc·1.3–1.5), plus one inner spray per branch (S·0.2–0.26 ·1.4).
    Shade tip 1, mid 0.8, inner 0.55.
  - B dusty rose: tints `#b89a9a #ac8f90 #bca2a0 #a8908f`, soft 0.30; 17
    clusters of 4–6 larger flowers (petal 3–4.2 px, sat 8–18 %, L 58); tips
    only (rc S·0.12–0.15), three twigs always. Open and quiet; nearly gone
    from the Fork stand.
  - C tiers: A's atlas and tints `#cab4a8 #c2aea4 #ceb8aa`; level shelves
    at the twig tips (w S·0.24–0.3, height 0.38) over a darker underside
    pulled 60 % to `#6a4c50`, each shelf its own crown.
  - Gone with it: BLOSSOM_NIGHT (forkProps.js: grey tints, a third of the
    sprays dropped, underside darkened) and its `?wblossomdrop`,
    `?wblossomunder` dials. B and C were never committed; their values are
    above.

- **The ways lie in the lawn** ("the paths in the Fork are still
  boardwalks", after V·8·2). The gravel was a slab from the lawn's top (4) to
  5.2 with a sheer side, and the edge stones were centred at 5 on its rim.
  Now `GRAVEL_TOP` (gardenPlan.js, 4.06) is the gravel's top everywhere: the
  slabs (3.9 up to it), the rake, the walk's `GRAVEL`, the shore's `floorAt`
  and the bridge feet (whose step is now halfway between gravel and deck,
  two even risers). The stones are a kerb (forkProps.js `KERB`): bedded at
  the lawn's top with a third to a half showing, long side along the way,
  inner side just over the gravel. The edge tufts root from the gravel's
  edge and stop at a kerb stone's outline. Knock-ons: the pergola's plinths
  go down into the lawn (they had floated 0.8 over it); the way into the
  maze, now a stone's height under the maze floor (5), ends at a dressed
  sill flush with that floor. Still a slab: the maze floor's own margin
  outside its hedges, 1 proud of the lawn.

## 2026-10-18

- **The Vertigo globe is glass again** (audit VI·6·1, "still a white egg").
  The 10-14 diffused opal spread the light evenly to the rim and printed
  white edge to edge. The well's hanging lamps are back in the shared globe
  batch with the Echo's and the Vestibule's opal (hot middle, amber rim,
  glazed), with two new `lamp()` options for a room that keeps its own flame:
  `glow: 1.6` (brightness) and `glass: '#ffd9b0'` (the Vestibule's tint, since
  roomColour.js leaves the Vertigo's globes untinted). At glow 2 in the old
  near-white glass the rim still printed grey-cream. The diffused branch of
  `makeLampGlobeMaterial` is gone. `public/og-card.jpg` was re-shot from the
  stand (VI·12·3) with every overlay hidden.

## 2026-10-17

- **The shelves climb on** (audit VI·4·3, "the Library still has a sky").
  Canvas of four, mocked in the page from the stands
  (claude.ai/artifact/TCGLvsVqKsPUkckCr8ciKW): A the Vestibule's spiral over
  every room; B the floors above (wellsBelow turned upward, ribbed ceilings);
  C the walls stacked up into the dark; D a black lid. The user picked C,
  "but I want all of the shelves to be filled in", and nothing on the Door.
  The mock had copied the rooms' triangles, so it brought the doorways, the
  pier glasses and the far view's bare boards up with them. Now
  `shelvesAbove.js` draws shelfWall again (detail 1, `stream: 0`) along all
  six edges of the Echo and the Silence, 8 storeys of 123 (3 when `light`),
  a whole wall of books on every edge, with the stone behind, a cap course
  at each storey's head and a black lid at the top. They are meshes of their
  own on the world's materials (no new programs), shown only within 300 /
  170 of the room and under 140, so the map still looks into open hexagons.
  The lamp chains there are drawn to `CHAIN_ABOVE` (489). Cost: 0.20 M
  vertices, 23 meshes. Found while mocking: the pale patch over the
  Vestibule's arch on arrival is mostly the Echo's moon column (additive,
  to y 134), not the sky. The shelves take the blue out of it; the grey glow
  stays with the column.
- **The Echo's arch, close up** (audit VI·4·1). "The soffit reads as
  timber; the joints are pencil lines; the tool marks ignore the stones."
  The voussoirs were in `cap` (the pale ashlar, projected on world axes)
  with ECHO_STONE's streaks running the curve, and a 0.1 slot over the
  black `joint`. Now each voussoir is its own extrusion with its arrises
  chamfered (0.07) and its own uv: v out along its joint line on its faces,
  through the wall on its soffit, in a jointless painted face tooled along
  v (`tooled`, textures.js; `M.voussoir`), a patch and a shade of its own
  from a hash of its number. The streaks keep to the faces (`worked.ring`).
  The lime is `M.archMortar` (#6f685d), 0.12 in. The hallway arches
  (shelves.js) still take `cap` and `joint`.
- **Readers under a lamp** (audit VI). "This reader, about 2 m away by eye
  and lit full on by the pier glass's lamp, prints as a pale tan felt: the
  hood one moulded shell, the shoulders without a seam." The reader was
  5 to 7 m off, on the bridge's end under its globe, so the near look was
  half to wholly let go (30 → 70 units). From the stand a doorway holds the
  real lights for the Echo, so the bridge's readers get ~0.25 of lamplight
  and the lift is all they have. On the bridge its two globes take real
  lights, 2 to 5 on a reader, and the lift came on top of them. Now the
  darkening also holds wherever the lamplight at the chest is over 1.6 (none
  under 0.6: `NEAR_LIT`, readerNear.js). Robe value (sRGB luma, mean, one
  mask per distance) under the globe at 5 / 7 m: 52 / 63 → 41 / 39, against
  20 at 2 m and 31 at 3 m, where nothing changed (what rise is left is the
  room's haze and the figure's edges at that size). The stand frame is
  unchanged. The bridge readers'
  hood now lies on the cape with a rolled lip, its cape in shade under it
  (readers.js, `heavyWool`).

## 2026-10-16

- **The others' bodies, and the court from above.** "The hood is right. The
  body under it is a sack … no shoulders: the cloth falls from the hood to
  the ground as one rounded mass, with the arms merged into it … the court's
  paving is so bright it clips to white." The empty hood stays as it was. For
  the finale's figures (`close` in readers.js; dials `ARMS` in
  finaleLook.js): the robe ×0.82 narrower from the hips up; the mantle a short
  cape (hem 12.65 where it was 11.55) cut with a shoulder line, out from the
  neck at about 25° and round the shoulder at 2.95; the sleeves, unless on a
  book, hang from under it past the body and bell at the cuff (radius 0.6 →
  0.66 → 1.05), clear of the waist, the cuff longer in front so its dark mouth
  faces down and back (hanging longer behind, every hand read as a black
  mitt). The twill went from 26 ribs a unit at depth 0.5 (smoothed to clay at
  the close-up) to 9 at 1, each rib a ridge with a groove and threads across
  it. The paving: a multiply disc over the court (`PAVING`, finale.js) takes
  it down a stop as the eye rises from 28 to 70 above the ground; from where
  the reader stands it is as it was.
- **The galleries below.** "There are holes like that in 2 of the rooms, but
  they show nothing … a lost opportunity." The Vestibule's and the Silence's
  wells were a liner 236 deep onto a disc of stars, and from a stand only its
  top courses showed. A canvas of five, each mocked in the engine
  (claude.ai/artifact/QNCkmXd7aB8DMjgqSsQpix): A the galleries below, B lamps
  let down the well on one chain, C a well of books (the room's cases ring
  under ring), D black water at the brim with the room upside down in it, E
  loose pages on the shaft's draught. Picked **A** for both. `wellsBelow.js`:
  each room's own triangles and instances, laid three storeys down (128 each,
  one on the phone), shaded as the room above and darkened ×0.62 a storey;
  under the first only the middle of the room (80) and no readers or carved
  balustrades; the frames' gilt not at all. The two liners now stop under the
  slab (−5), with no stars. Compiled and sent after the world is up (about 7 s
  later), so the opening is no slower; ~1.2M vertices for both, drawn only
  near their room.
- **Door ivy off the floor.** "Those branches look very 2D and they still end
  in nowhere … maybe they should stay on the wall, not on the floor." The ivy
  runners along the floor cracks (`crackRunners`, FLORAS `runners` reach
  14/44/84) and their leads across the threshold (`leadRunners`,
  `leadFaceRoots`) are gone. Instead `wallRunners` (doorFlora.js): 4 stems
  left and 3 right come out of the ground among the hedges at the garden
  face's foot, climb it, turn into the passage, wander its walls (never below
  floor + 2.5) with leafy shoots off them, and come round onto the first
  order's face, where the room face's ivy now grows from their ends (it used
  to start at the floor by the plinths). The floor stays bare.
- **Garden grass darker, closer.** "Too light and sparse": edge tufts' green
  [0.046, 0.058, 0.014] → [0.019, 0.04, 0.011], straw share 0.1 → 0.04, k
  0.68 → 0.52, tip 1.35 → 1.4, blades [14, 26] → [16, 28] and finer (wide
  [0.05, 0.09] → [0.035, 0.065]), gaps (`bare`) 0.3 → 0.22, and set 1.7× closer
  along the ways only (`TUFTS.ways`). The lanterns' sward sheet 0.35 → 0.24.
  Grass triangles 452k → 607k.
- **Old paths removed.** Every `?w…=old` switch and its code went, and the
  board modules were folded into one per room or subject: `mapLook.js`
  (mapFix, 3, 4, 5, 6), `mapMotion.js` (mapFix7), `phone.js` (phoneFix, 7),
  `finaleLook.js` (finaleFix, 6), `libraryProps.js` (libFix3, auditFix,
  vestFix), `silenceProps.js`, `vertigoProps.js`, `gardenProps.js`
  (gardenFix5, groundFix), and doorFix, forkFix, pavilionFix and webFix into
  the existing `*Props.js`; drumFix and echoFix into their rooms; hudFix3's one
  constant into `walkers.js`. Decided variants went with them: the subtitle
  (`whudsub`, a), the map's hand-over (`wmapink`, a), the Library's colour
  (`wlibcol`, c), the map in motion (`wmapmove`, c), the ending's close-up
  (`wfinclose`, none) and hood (`wfhood`, d), the untitled books (`wbook`) and
  the lamp pass's parts (`wlampsoff`). Draws the old paths made from the
  world's stream are still made. Scene fingerprints before and after match:
  the same objects, geometry and materials, and the same shader programs
  once comments are set aside.
- **Echo columns: one stone with the arches.** The white veined marble
  (`echoMarble`, ground [0.5, 0.48, 0.44] linear, veins [0.3, 0.29, 0.275],
  scale 0.05, polish 0.32) was "very unnatural"; the columns go from
  `#a89f90` to the arch rings' `#d9d6c9`, in the carving's oolite, so shafts,
  capitals, plinths and imposts read as one limestone with the arches.
- **Silence flights' flanks** take the Echo's one-face dressing (`7b34385`).

## 2026-10-15

- **The garden's ground: a sward, not a blue-grey sheet.** The lawn (#5e6d63
  over a near-black green; measured sRGB (6, 18, 31), hue 211) read as wet
  tarmac. Now: its own dark yellow-green (`SWARD`; the print pushes darks
  blue, ×0.53 red, ×1.34 blue), tone patches at 7, 23 and 71 units, uncut
  tufts clumped along edges, path sides and feet of things (lawn.js
  `edgeTufts`), and the moon's light on the ground warmed where it is cool;
  mist #9fc0d8 → #b6b8b0. Measures (28, 36, 32), hue 147. Dials: `?wswr/g/b`,
  `wswgain`, `wswdetail`, `wswmacro`, `wswlamp`, `wmglr`, `wmglb`, `wmgfog`,
  `wtuftstep`, `wtuftbare`, `wtufth`, `wtuftk`; `__ground({...})` in dev.
- **The Silence's dead globes: glass gone out, not cannonballs.** They printed
  at 10–19 against a wall at 22, iron balls with a pin. Now a shell: the far
  wall's inside lit where it faces the lamp, mottled, dust pooled in the
  bottom; a rim on the lit limb; the pin at about half. Three are dying
  (`DEAD_EMBERS`: 0.45 at 110°, 0.3 at 330°, 0.1 at 185°), an ember and a
  halo a tenth of a lamp's. Dying 45–82, dead 20–35, against the lamp's 168.
- **Pavilion qin** (`cb217e2`). Sixty-eight seconds of phrases in E minor
  (E–G–F♯–B over E, C, G, D), silk-string decay, soundboard, slides and
  harmonics; follows the listener; stalls skip notes rather than burst.
- **Vertigo approach** (`c3ee7bf`, `a68a85c`). One cubic from 110 units out
  along the corridor onto the stair at 190° (controls 28 ahead, 14 back); the
  landing's rail curves from the mouth to the newel (radius 69.3 easing in
  over 153°–170°), with no corner posts. Evidence in
  `.ux-review/navigation/2026-10-15-vertigo-approach/` and
  `.ux-review/qa/2026-10-15-vertigo-entry/`.
- **Map recovery** (`553075c`). Map, M and Escape work during travel; walking
  input is released before returning.
- **Patchwork ashlar** (audit V, board 3·1). Blocks spread 76–148 sRGB, a
  quilt. Tone spread 18 → 6 (hue with it), the shader's unevenness a third
  (the Echo's `worked` 0.44 → 0.15), arrises weathered from a stream of their
  own, beds darker under projecting courses (34%, a third gone in 3.6), soot
  over lamps that burn against stone. `ashlarSurface.js`.
- **The map in motion** (audit V, board 2·1). During flights the map went
  cold grey: its warmth rode the veil, gone by 45%. Three looks — a: warm
  light by eye height (MASS_H + 140 → + 6); b: moon and sky to the lamps'
  amber; c: a, and the unexplored dark by height too (MASS_H + 420 → + 70).
  Picked **c**.
- **Readers at arm's length** (audit V, board 3·3). Cream hoods and an orange
  face up close. a: oatmeal twill; b: fulled moorit wool, the hood empty but
  an edge of chin; c: greige homespun. Picked **b**; the darkening holds
  within 30 units, gone by 70. `readerNear.js`.
- **The Door: green and the garden coming in.** The cloth bindings' sage
  printed mint; of the ivy's own green, the hedges' olive, and ivy on a third
  of the shelves, picked **the ivy's greens** at the same share. The garden
  stopped at the wall line; of a (grass in the cracks), b (ivy along the
  cracks, up the jambs and piers, hanging from the arch, through the passage)
  and c (b, up to the gable and over the cases), picked **b**, grown on the
  arch's stone along the floor's own cracks. (10-16: all green taken off the
  floor — runners, grass in the cracks, moss in the joints, fallen leaves;
  the ivy keeps to the walls.)

## 2026-10-14

- **Silence railing.** Options (`?wsilrail=a|b|c`, `e726a93`): a kerb across
  the front with newels; b a continuous balustrade lowered to 5.8; c bronze
  handrail on three posts. Refined (`ec0837e`, central arc 75°): a rails down
  9.5 → 7.2; b 5.4 at the front; c bronze at 6.6 on five posts. All rejected.
  Kept the original continuous balustrade, 8.4 high (was 9.5), handrail 15%
  narrower and 1.0 high, base 10% narrower and 0.72, balusters 0.56; lamp by
  the reader at power 2600; reader wrap 1.2, page bounce 1.6.
- **The Silence's reader in the one lamp's light.** Lamp at `[-3, 20]` from
  the centre, 10.2 up, glass 1.65, power 1100, halo 0.3; book nearly flat
  (0.12 rad); dead glass smoked `#39312b` reflecting only the burning lamp.
  Earlier looks: `175d724`.
- **Echo.** Masonry `#77736c`, limestone treads and balustrades `#cbc8ba`,
  `#dedbce`; tread centres `#eee7d6`, nosings `#e5dfd0`; full-depth voussoirs
  and moulded arcades (reveals 3.2 and 3.0); the stand from radius 72 to the
  third tread at 45.8. Earlier stand, stair and keystone looks: `6d0c9e5`.
  Columns `#919f99` (`8bbb57a`) → taupe `#a89f90`. Newels carved: plinth and
  ogee, an 18 mm sunk panel, a moulded cornice.
- **Wall stone.** The Vestibule at 36 courses per 38-unit tile read as thin
  brick. `?wveststone`: a 24 (15 cm), b 18 (20 cm), c 12 (30 cm). Picked
  **c**, then the same texture everywhere: seed 107, five blocks a tile,
  joint 1, normal 0.65, repeat 1/38. Options in `c5cb551`. Views:
  `tools/views/vestibule-stone.json`.
- **Vestibule readers and sightlines.** Robe folds and wool weave (18 ribs a
  unit, 0.18 strength, dye 0.13, specular cut 0.9, sheen 0.65); the rail's
  balusters at 58% width every 5.8; paper labels down 30% in value. Views:
  `tools/views/vestibule.json`.
- **Door, Echo and Vestibule cornices.** The luminous strip read as LED tape:
  gone, with its rods and wash; the inscriptions in gilt (bump 0.12, rough
  0.34, metal 0.6) catch the lamps.
- **Vertigo.** Lamps lit opal, collar shadow, no hard glint; the first spiral's
  treads with rounded nosings (0.68 strip); W from the stand takes the stair.
- **Red maples** curve, fork and taper to twigs on their own streams (earlier
  code `8f0bc89`, compared in `.ux-review/` only).
- **Mist** fades over 8 units where it meets a trunk or post (depth copy).
- **Light in the dark rooms.** The Silence's fill 0.85 → 1.15, the Door's 0.75
  (fading between radii 78 and 105); map fills 1.0 and 1.05; the Vertigo's
  upper bounce 0.6 and a warm map fill 2.2, its well fade 0.12 at the rim and
  0.32 below (shaft 0.65). Earlier: the Silence's stone bounce 0.5 and the
  Vertigo's 0.65, the well keeping 0.68 of its upper light.
- **The Door's bright strip** was two pale cap pieces over the portal: gone.
- **The garden spread into the map's upper right.** From three mockups (a
  lake and Pavilion above the maze, b a wider lake beside it, c the maze
  above the lake) the user picked **a**: pond `[1300,118]` r `[118,90]` →
  `[1300,-174]` r `[148,112]`; Pavilion `[1305,110]` → `[1305,-182]`; maze
  origin `[1180,318]` → `[1240,195]`, its corridors on a stream of their own
  at seed `-923889612`; the Fork looks at 315°, waymark at 306°, 40 out.
  Earlier shore way: `fc82316`. Rejected framings (`b2ec839`): `tilt`, the
  wide map's yaw 9° → −6°; `trees`, a dotted road faded 0.55 → 0.
- **Woodland.** 24 planting areas (167 trees: 271 → 438) on seed 94263, and
  nine groves round the pond and maze (34 trees), clear of the ways, water
  and hedges; tree foliage takes a diffuse fill over the map.
- **Loading.** Shaders submitted in short batches during construction; the
  opening's timer keeps its phase (19 → 27 updates a second); construction
  yields between batches and prepares buffers offscreen (first-frame block
  2.12 s → 0.45 s); program interfaces and shadow programs warmed in slices
  (0.90 s → 0.56 s). Total load is still about 14–25 s. Profiles under
  `.ux-review/shots/`; see also `docs/startup-performance.md`.

## 2026-10-13

- **Stone inside the Library's wells.** The well linings were untextured brown
  under a glow sheet: they take the gallery ashlar now, its light fading with
  depth; the glow sheet is gone.
- **The map's unwalked cells.** Thirty identical pale planks (the case
  cornices) stood out once the stone went quiet. Over the map, off the walk,
  the case heads (105 down to 96) keep none of the moon and take the quiet
  stone's colour (`CASE_HEADS`). Turning cells by 60° was considered and could
  not help. Comparison: `26cee89`.

## 2026-10-12

- **The map's tone** ("too reddish": hue ~23 against the palette's 33–36).
  Four looks behind `?wmaptone` (`e2222d8`); the user picked **c**:

  | look | route (wall-top light) | rim (bounce) | quiet (unwalked stone) | bounce | grade (map only) |
  |---|---|---|---|---|---|
  | a amber | `#ffc985`, warm 1 | `[1.0, 0.74, 0.42]` | as the hand-over's | `#5b432f` | gold 0.3, deep 1, chroma 0.92 |
  | b old gold | `#ffd796`, warm 1, k 0.5 | `[1.0, 0.8, 0.48]`, k 0.85 | `[0.41, 0.385, 0.33]` | `#5a4c36` | gold 0.42, deep 1 |
  | **c parchment** | `#ffd8a0`, warm 0.55 | `[1.0, 0.78, 0.5]`, k 0.55 | `[0.4, 0.38, 0.355]` | `#4e463c` | gold 0.3, deep 1, chroma 0.62 |
  | d ash | `#e9e2d6`, warm 1 | `[1.0, 0.8, 0.52]`, k 0.5 | `[0.38, 0.375, 0.37]` | `#3f3c38` | gold 0.25, deep 1, chroma 0.3 |
  | before | `#ffb466`, warm 1 | `[1.0, 0.62, 0.3]`, k 0.75 | `[0.4, 0.37, 0.33]` | `#5b432f` | gold 0.18, deep 0, chroma 1 |

- **The map** (audit IV, board 1). The wall tops lit by the lamps' colour, not
  the moon's, and less of it; the Echo's wall tops the same stone as the rest
  (its worked stone stops under them; the rim's warmth starts at each room's
  own wall).
- **The ending, again.** The close-up's a was not liked (one standing too
  close, its hands "horrific"), nor a face modelled in the hood. Of four
  hoods (a the smooth head and book, b empty, c empty and bowed, d empty, from
  further off, between the lanterns) the user picked **d**. The reader on the
  Silence's stool among the others was taken out. The ending's words: four
  entrances (a in turn, b found among the letters, c lit along the hairline,
  d drawn back); picked **c**.

## The design boards, 2026-10-08 to 10-11

One line per point. The code for each is on `archive/before-old-fold`.

**Vestibule arrival (10-08).** 1 no reader cut by the frame's edge; 2 readers
lit as cloth; 3 haze through the arch halved; 4 the pier glasses' silvering
aged; 5 finer ashlar, voussoirs round the arches; 6 the bridge lamps' halo
down; 7 a warm glow out of the well.

**Echo arrival (10-08).** 1 the stand further in, the shafts framing the
stair; 2 the stair read by value (palest nosing, a string up the flanks); 3
carved keystones for the bronze roundels; 4 the moon's column begun above the
lower cornice, warmed at its edge; 6 the drum's ashlar finer as it rises; 7
books over the ways out.

**Audit II, the world (10-09).** The floor's brass fillet dull antique brass,
not a lit seam; the ivy mats on the wall tops not laid (their draws spent);
the dead globes grey opal under soot, not polished iron.

**Door arrival (10-09).** 2 the fallen blocks in two heaps under the breach,
broken and bedded; 3 the portal's reveals darkening with depth; 4 the green
moon's shaft a quarter as strong, the pergola's halos 22 across at 0.24; 5
cracks wide at the start, tapering, branching, a slab sunk here and there; 8
the lamp left of the portal lower (82 → 72).

**Fork arrival (10-09).** 1 the stand back at the pergola's end, both ways in
view; 2 the rake's furrows faint, wandering, broken by stones; 3 the waymark a
slim weathered post, names out; 4 edge stones in groups; 7 the pebbled bank
uneven.

**The map (10-09, board 2).** L2 the opening's first frame lensed down toward
the title; 4 the map turned 9° off north and centred; 7 the Vertigo floorless
from above (its lit cone gone, the well darkening down); 8 a warm bounce on
the walk's rims.

**Pavilion arrival (10-09).** 8 the stand on the bridge's first run, the roof
a silhouette; 2 one bracket set to a column, bronze caps; 3 lotus-bud finials;
4 the willows' whips broader strands, keeping coverage.

**Silence arrival (10-09).** 1 the hood clear of the lamp; 2 the reader lit
from the lamp's pool; 3 dead globes smoked, two moved out of frame; 4 the
arches under the flights lit from below; 5 the sky through the Vertigo's far
crown closed.

**Vertigo arrival (10-09).** 1 the stand turned to the well, half books half
drop; 4 the well lit from below; 2 the near bindings' tooling varied, a few
books gone and their neighbours leaning; 3 walnut lips on the shelves.

**Web of Time arrival (10-09).** 2 a belt of cedars hiding the Library's
wall; 3 the court's south rim opened onto a way out; 5 more, smaller
fireflies, each blinking on its own beat; 7 a carved pedestal.

**The phone (10-09, board 14).** 3 the map's stage half the screen, the
camera turned along the walk; 8 a tall screen's lens opened to show 40°
across (at most 76° up).

**The ending (10-09, board 13).** 2 a third of the fireflies, sized by
distance, out of focus near, gold by the armillary, rising in a column; 3 the
step in to the gate's mouth (40 from the heart); 4 the others' wool woven,
folds to the hem, a frayed turned-in edge, a low light in the hood; 5 the
glitter over the rise halved and fading out.

**Fork props (10-10, board 10).** The moon with seas and a close halo; the
Pavilion's roof tiled in grey rolls (green-glazed and bark shingle shown
beside it, `?wroof`); a weathered boulder at the fork; granite tōrō; the
hedge's top lit, finials; greyer cherries; softer warm gravel; blades in the
lanterns' light.

**Pavilion props (10-10, board 11).** Bracket arms eased and painted; a real
qin (seven strings, thirteen studs); full drooping willows; lacquer worn at
joins and handrail; dark gilt collars, the finial the one bright gold.

**Web props (10-10, board 12).** The wall top falls into the night behind the
cedar belt; cedars grown as spires, 68–200 tall; the armillary's rings flat
bands with the scale let in; the night behind the belt lifted as haze.

**Door props (10-10, board 9).** The stand further back, the gable whole; the
garden's light a tongue in the passage; candles burnt down, flames lit; books
fallen open; a smaller lamp left of the portal; sharp arrises where blocks
broke fresh; the ladder further along.

**The ending (10-11, audit III, board 6).** 1 the close-up (see 10-12); 3 an
ending on the map: the walk held under one line, a colophon, "Walk it again";
4 the others of different heights, standing where people stand; 5 Skip sinks
to a trace after three seconds.

**Garden props (10-11, audit III, board 5).** 3 a turned signpost, its boards
cut and gilt, lit by its lantern; 4 the wisteria three roped stems; 5 grass in
clumps on a mown sward; 6 bronze hip ends; 7 the lit Pavilion lying on the
water (`glow`, `shatter`); 8 the armillary's plinth weathered and lit from the
floor; 10 lit niches by the Web's stand; 11 tree crowns feathered at the edge.

**HUD (10-11, audit III, board 2).** 1 the subtitle in the name's own italic
(of a Cormorant italic, b Tangerine bold, c Quintessential, d IM Fell; picked
a); 2 kickers in Cormorant SC, the mono left to the opening; 3 the Vertigo's
corner darker; 4 four inks, three shades, three lamp whites; 5 one arriving
and one leaving curve, three durations; 6 nobody in the caption's corner.

**Vestibule and Echo (10-11, audit III, board 3).** 1 the Library's colour
(of a bindings weighted to the gallery's leather, b whole bays in one
binding, c a and the shelf-edges' leather; picked c: weight 3.2, keep 1.25,
leathers `#742a22`, `#2f4d36`, `#8f8263`); 2 the bridge readers' wool takes
light, rimmed by the arch; 3 ashlar dressed and aged; 4 the Echo's carved
stone uneven, polished where worn; 5 the pier glasses drawn at their own
size, darker, foxed; 6 a string course over the Vestibule's way out.

**The map (10-11, audit III, board 1).** 2 the hand-over (of a the ink kept
faint over darker stone, b no ink and warm stone, c stone only inside the
eight; picked a: lines 0.42, tint [0.4, 0.37, 0.33], veil 0.62); 3 the
unwalked cells' stone quiet; 4 the garden's colour from above; 5 the
numerals over their places; 6 the byline alone on its line.

**The phone (10-11, audit III, board 7).** 2 the walk button on the bottom
edge; 3 the room's lines surface in the caption's place, one at a time; 4 the
kept ink stronger at phone size; 5 kicker and subtitle sink after a few
seconds.
