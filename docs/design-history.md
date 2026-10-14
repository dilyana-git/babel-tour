# Design history

### Shorter startup stalls

*2026-10-14* · Further loading profiling found large uninterrupted arch,
geometry-merge and visibility-bound construction passes, followed by buffer
uploads in the first visible frame. Assembly now yields between those batches,
and small offscreen renders prepare geometry and instance buffers beforehand.
Shared geometry is prepared once, with shadows deferred to the real scene.
The library geometry, random layout and material code match the prior scene
fingerprint; animated uniforms and transforms naturally differ between loads.
On the local Radeon GPU, the paired profile's first-frame block fell from
2.12 seconds to 0.45 seconds. Total construction and shader preparation still
take about 15 seconds; this change addresses freezes rather than promising an
instant load. Reports and inspected pictures are in `.ux-review/shots/` under
`map-polish-loading-reference` and `map-polish-loading-final`.

### Stone inside the Library's wells

*2026-10-13* · `src/world/build/materials.js`, `honeycomb.js`, `shelves.js`.

The Vestibule's first-load view showed a textured bridge beside a blank brown
well wall. This was the well's untextured lining, made more visible by a smooth
additive glow sheet, rather than a texture still loading. All hexagonal well
linings now share the gallery walls' ashlar colour, normal and roughness maps,
projected at the same world-space scale. Their light fades with depth; the
Vestibule's warmth from below is shaded on the masonry itself, so mortar stays
dark and the stone retains its detail. The separate glow sheet is removed.
The paving, bridge, rails and random layout are unchanged. The existing
`?wvest=old:7` switch still disables the warmth from below.

What the design boards asked for, what was tried, and what was picked. The
code keeps what is built and why; the story of how it got there lives here
and in git history.

A look's alternatives are removed once one is picked (see "Variants of a look"
in `AGENTS.md`). To try one again, the values recorded here are enough to put
it back, and the commits named hold the code that drew it.

Most boards' changes can still be undone in the browser: each `src/world/*Fix*.js`
or `*Props.js` module reads a `?w…=old` flag that puts its points back as they
were, all of them or (`old:2,4`) only some. The flag is named with each board
below. Points are numbered as on the board, and the code refers to them that
way (for example "echoFix.js, 6").

## The boards, by date

### The Vestibule's arrival frame

*2026-10-08* · `src/world/vestFix.js` · `?wvest=old` puts all seven back as they were; `?wvest=old:3`,6 only those.

The Vestibule's arrival frame, reviewed 2026-10-08 (the numbered points on the review board): 1 no reader cut by the frame's edge on arrival, 2 readers lit as cloth and not cut-outs, 3 the haze through the arch halved, 4 the pier glasses' silvering aged, 5 the ashlar coursed finer and the arches ringed with voussoirs, 6 the bridge lamps' halo turned down, 7 a warm glow rising out of the well.

### The Echo's arrival frame

*2026-10-08* · `src/world/echoFix.js` · `?wechofix=old` puts all of them back as they were; `?wechofix=old:3`,6 only those. (`?wecho=old` is the flights' old tread, and is its own.)

The Echo's arrival frame, reviewed 2026-10-08 (the numbered points on the review board): 1 the stand a few strides further in, so the two column shafts frame the stair instead of walling a quarter of the frame off; 2 the stair read by its values — the nosing the palest line, the riser a shade under the tread, a string run up both flanks; 3 carved keystones over the arches instead of the bronze roundels that hung over them like knockers; 4 the moon's column of light begun above the lower storey's cornice, its edge warmed; 5 (the bright sliver between two balusters, which is the Silence's lamp seen through the hallway — moved out of line by 1); 6 the drum's ashlar coursed finer as it rises and no longer one tile repeated; 7 books over the ways out, so every bay of the upper storey shows shelves.

### Design audit II: the brass fillet, the ivy mats, the dead globes

*2026-10-09* · `src/world/auditFix.js` · `?waudit=old` puts all of them back as they were; `?waudit=old:2`,3 only those.

What design audit II (2026-10-09) marked FIX, in the world itself — the numbered points:
- **1** the brass fillet round each Library floor, on the inner edge of the dark band at the foot of the cases, read from every stand as a lit seam: 0.8 wide, polished (metal 0.7, rough 0.4), narrower than a pixel at the distance the stands see it from, and it caught each lamp as a hot thread (the Door's "glowing line along the floor" at the right-hand case). It is antique brass now, dull, a little wider, so it reads as a line laid in the stone and not as light coming through it.
- **2** the ivy "where the honeycomb meets the garden" was mats — flat leaf cards, 56–90 long, laid along the wall tops — and from the Web of Time's stand, over the cedars, they printed as a row of dark green discs on the Library's coping (the same blob mats that hung over the pergola as green balls). They are not laid any more; their draws are still spent.
- **3** the Silence's dead globes were a dark bronze-brown, glossy low on the bowl: the one hung in the stand's frame read as a polished iron ball. A lamp gone out is opal glass that has gone grey — pale under its soot, matt, holding no pin of light.

### The Door's arrival frame

*2026-10-09* · `src/world/doorFix.js` · `?wdoorfix=old` puts all of them back as they were; `?wdoorfix=old:2`,4 only those.

The Door's arrival frame, reviewed 2026-10-09 (the numbered points on the review board): 2 the fallen blocks were clean bevelled boxes of a size, spread evenly over the floor like props — they lie in two heaps now under the breach they came out of, most of them broken to wedges, bedded into the floor where they struck it, with big spalls round them and more dust; 4 the garden in the arch was a milky grey haze, its wisteria and lantern drained — that was the "green moon" shaft, a pale sheet seen face on across the whole opening, and the pergola's three lantern halos stacked on one another down its axis; 3 the portal's jambs, reveals and soffits were one warm grey — the reveals and undersides of each order go dark now, the deeper the darker, so the arch is a funnel; 5 the cracks were lines of an even width — they start wide, taper all the way out, branch and chip more, and here and there a slab has sunk and tipped; 8 the lamp left of the portal hung where the frame's top edge cut its globe in half — it hangs lower. (7, the copy, is catalogue.js: it said a green moon, which nothing shows; it says what the arch shows.)

### The ending (audit II, board 13)

*2026-10-09* · `src/world/finaleFix.js` · `?wfin=old` puts all of them back as they were; `?wfin=old:2`,4 only those.

The ending, reviewed 2026-10-09 (board 13 of the second audit; the numbers are the board's own). The idea was right and the armillary waking (1) is kept as it was; the pictures on the way were less sure than the idea:
- **2** the flood was a screensaver: hundreds of round dots of one size and one yellow-green, spread evenly over the frame. A third as many now; each as large as its distance makes it, and more than that — the near ones wide and soft, out of focus, the far ones points; gold by the armillary and paling outward; of uneven brightness; and over the heart they rise in a slow column, where they had hung everywhere at once (finale.js).
- **3** as the others gathered, half the frame was hedge: the film is watched from wherever the reader stood when it began, and from the stand that is a corridor, the court seen through its mouth — turned toward the west gate, the eye looked at the corridor's own wall. The reader takes the step in that the caption says they take, as far as the mouth of the gate, and the eye is turned only until the armillary stands on the left third, the others to its right and the hedge a wing at the frame's edge (World.jsx, finaleMove). The one behind is brought as far forward, so it is as near as it was.
- **4** the other's hood was plastic: one smooth even tan with a soft sheen, the inside of its edge a pale band round the opening like a tyre, and the opening one flat black. The others' wool is woven now, and matt but for its fuzz at the edges; the cowl hangs in folds to its hem; the hem is thin, turned in, and frayed; and inside the hood there is a low warm light, as from the reader's own lamp, on the brow and the nose and the chin of whoever is in it (readers.js, `close`, and clothShader).
- **5** the rise over the lit maze was right, and snowed on: the glitter over it was twice too dense and of one brightness. It is halved (2), and it goes out as the eye rises, so that the last thing seen is the lit path.

### The Fork's arrival frame

*2026-10-09* · `src/world/forkFix.js` · `?wforkfix=old` puts all of them back as they were; `?wforkfix=old:2`,4 only those.

The Fork's arrival frame, reviewed 2026-10-09 (the numbered points on the review board): 1 the room named for a choice showed no choice — the stand was eight paces short of the stone the ways part at, which lay under the reader's feet, and it looked down the way to the bridge, which runs on the pergola's own line; it stands back at the pergola's end now and a little left, and looks across the stone at both ways leaving it, the Pavilion under the moon down the one and the lanterns of the maze's mouth down the other (and the moon, 6, is whole in the sky, not cut by the frame's top); 2 the raked gravel was ruled white stripes, evenly spaced, at a hard contrast — a crossing or a record's grooves: the furrows are much fainter now, run in passes of a rake that wander and drift apart, and break where a stone sits; 3 the waymark was the largest thing in the frame, a pale stone pillar dead ahead, its boards blank (their names faced into the wood): a slim post of weathered timber now, out on the lawn between the ways where they have parted, its boards' names facing out; 4 the stones along the ways were beads on a string, one size every seven paces — they are set in groups now, a big one with smaller ones against it, gaps between, some sunk to half their height; 7 the pebbled bank round the pond was one even pale stroke — it comes and goes and widens and narrows. (The copy — "the pale gravel divides and divides again" — is left as it was: from the stand it is true now.)

### The opening and the map (board 2)

*2026-10-09* · `src/world/mapFix.js` · `?wmapfix=old` puts all of them back as they were; `?wmapfix=old:L2`,7 only those.

What the design board on the opening and the map (2026-10-09, board 2) marked REFINE, where it is in the world and its camera — the points by the board's own numbers:
- **L2** the opening's first frame was lopsided: looking down the walk, the ink's camera put the Vestibule in the middle of the frame and the Echo over its top edge, cut off, with the left half of the screen holding only the epigraph. Its lens now starts shifted down and toward the title, and the shift is gone by the time the camera rests (ink.js, START).
- **4** the garden was squeezed into the map's top right corner, and the frame rested against its left and bottom bounds only. The map's camera is turned 9° off north (plan.js, TILT_YAW), so the walk runs flatter, from the bottom left into the centre right, and its aim is panned until the rooms sit centred between the left and right bounds and down on the bottom one (clear of the title and caption) before it is fitted: the frame is larger and the garden is given the right of it.
- **7** seen from the map, the Vertigo had a floor: the cone of lit air under the lamp hung in the drum, seen down its axis as a lit round foot, and the stair's pale treads under it, turned down the funnel as one beige disc — in the room whose line is "the stairwell that has no floor". Over the map that cone goes, the floor round the mouth darkens, and the stair and the shelves darken with depth below it; the books do not, so the warm light the bottom throws up them is what is left to see. All of it is gone before a flight reaches the rooms. (Dark layers across the shaft were tried first: they put out that glow too.)
- **8** the wall tops were one cold grey everywhere: the lit rooms glowed, but their rims were as cold as the dark ones'. Over the map, the coping round each room of the walk takes a faint warm bounce from inside, strongest at its inner edge.

### The Pavilion's arrival frame

*2026-10-09* · `src/world/pavilionFix.js` · `?wpavfix=old` puts all of them back as they were; `?wpavfix=old:2`,4 only those.

The Pavilion's arrival frame, reviewed 2026-10-09 (the numbered points on the review board): 8 the roof's underside filled the top third of the frame — the stand was most of the way along the bridge, under the eave's reach, and looked level at the deck; it stands back on the bridge's first run now, near the shore, and looks up a little, so the roof is a silhouette against the sky with its finial whole, and (5) the eight paper lanterns along the eave are all inside the frame, where two were cut by its edges; 2 under the eave the bracket sets read as stacked lumber — two tiers of plain boxes over every column, the rafters and two purlins at one radius run through them, and a bright gilt cube on the front of each: one clean set to a column now (block, arm, block, arm, in a stepped cross, the arms' ends rounded off underneath the way a bracket arm's are), the arms laid along the beams they carry, and a small cap of dark bronze where the gilt was; 3 the rail posts' finials were eggs, and the nearest, out of focus at the bottom of the frame, an acorn: small lotus buds, petals carved in; 4 the willows' whips shimmered as vertical scan lines (three hair-fine whips to a card, under a pixel across from the bridge, alpha-tested): one or two broader strands to a card, thinning to the tip, and a card keeps its coverage as its texture shrinks; 6 the copy promised music in a world that has no sound — it speaks of the qin on the table instead (catalogue.js).

### The phone (board 14, "In the hand")

*2026-10-09* · `src/world/phoneFix.js` · `?wphone=old` puts both back as they were; `?wphone=old:3` only that one.

What the design board on the phone (2026-10-09, board 14, "In the hand") marked REFINE, where it is in the world and its camera — the points by the board's own numbers (the rest of that board is the page's: EntryMap.jsx, Assembly.jsx and map.css, under `.is-tall`):
- **3** the map was a thumbnail. Its stage was a 1440 × 900 strip (244 px tall on a 390 × 844 screen) and the walk lay nearly flat across it, so the width was all it used: rooms 46 px across, the garden's three in one knot. The stage is half the screen now (map.css), and on it the map's camera is turned to look along the walk (plan.js, yawFor), which then climbs from the bottom left corner to the garden in the top right and is fitted to the stage's diagonal: half as large again.
- **8** standing in a room, a tall screen saw a slot of it. The lens is set by its height (58°), so upright a phone was given 29° across where a laptop has 89°: in the Pavilion, two columns and the lantern, and none of the water or the bridge that make it the Pavilion. A tall screen's lens opens until it sees TALL_VIEW.across from side to side (and no wider than TALL_VIEW.most from top to bottom) — the step back the board asked for, taken with the lens, since behind most stands there is a wall.

### The Silence's arrival frame

*2026-10-09* · `src/world/silenceFix.js` · `?wsilfix=old` puts all of them back as they were; `?wsilfix=old:2`,4 only those.

The Silence's arrival frame, reviewed 2026-10-09 (the numbered points on the review board): 1 the reader's hood no longer over the lamp — the lamp hung a body-width to the side, so the head is drawn against its glow and not on it; 2 the reader lit from below by the lamp's own pool on the terrace, so the one figure is not the darkest thing in the frame and the balusters stand out against it; 3 the dead globes smoked and dulled, no longer clear bubbles, and two of them hung out of the stand's frame; 4 the arches under the flights lit from below, so their voussoirs — what the stand sees of the stair under the terrace — read course by course instead of going to black; 5 the moonlit sky between the posts on the Vertigo's far crown, seen through the hallway, closed behind them. (6, the key-cap hint over the cornice, went with the hint's move to the foot of the frame; 9, the copy, is in catalogue.js.)

### The Vertigo's arrival frame

*2026-10-09* · `src/world/vertigoFix.js` · `?wvfix=old` puts all of them back as they were; `?wvfix=old:2`,4 only those.

The Vertigo's arrival frame, reviewed 2026-10-09 (the numbered points on the review board): 1 the stand turned in toward the well and looking further down, so the first frame is half books, half drop, and the drop is what the room is named for; 4 the well lit from below — the light at the bottom climbing the funnel warm, and the shelves going dark as they rise — instead of evenly from edge to edge; 2 the near bindings' tooling varied, compartment by compartment (a gilt "+" in every panel of every volume read as a grid of plus signs), and a few books gone from the near shelves, their neighbours leaning into the room they left; 3 a moulded walnut lip on the front of every shelf, darker than the boards, where the bare board fronts were pale flat strips like plywood. (8, the near books too big and soft, went with 1 and 2: the turn puts the near wall at the frame's edge and the tooling no longer repeats; 7, the copy, is kept — the frame now shows what it says.)

### The Web of Time's arrival frame

*2026-10-09* · `src/world/webFix.js` · `?wwebfix=old` puts all of them back as they were; `?wwebfix=old:2`,5 only those.

The Web of Time's arrival frame, reviewed 2026-10-09 (the numbered points on the review board): 2 over the hedges, the top half of the frame was a wall of the Library's blue-grey ashlar — the honeycomb's garden faces stand three paces behind the maze's far hedge and ten metres tall, so the heart of a garden maze read as a walled yard: a belt of cedars is planted between the maze and the garden's hedge now, two and three deep, tall enough that from the stand their spires are the skyline and the stone is behind them; 3 the summary says that in every direction you are already walking, and no way left the court in view — its fourth gate is straight behind the armillary, and the hedges round it read as solid blocks: the court's south rim is opened a cell to the left of the armillary, onto a straight run of hedge two cells long that goes away from the lamp into the dark; 5 the fireflies were few and large and steady, dust on the lens: all of them are flown now and more besides, half the size, and each one flashes on its own beat and goes dark between, the way a firefly does (effects.js, makeSparkles `blink`); 7 the pedestal was three plain cylinders under a richly made sphere: a carved stand now — a stepped plinth, a moulded base, a shaft reeded at foot and head with two rings of gilt capitals between, and an ovolo capital under a square-edged abacus. The sentence is the one the map says at the end; 6 is in EntryMap.jsx (the way on says it is the ending, and the film has a Skip on screen for its whole length).

### The Fork's props (audit II, board 10)

*2026-10-09* · `src/world/forkProps.js` · `?wprops=old` puts all of them back as they were; `?wprops=old:3`,8 only those. `?wroof=green|bark:` the roof's two other dressings (green-glazed tile; bark shingle, without rolls), for looking at beside the grey.

The Fork's props, reviewed 2026-10-09 (board 10 of the second audit; the numbers are the board's own). The frame was right and the things in it were new from the factory: 1 the moon was an even white disc in a wide halo, a lamp in the sky — it has its seas now, a little darker at the limb, ivory, and a closer halo; 2 the Pavilion's roof was navy panes between black ribs, a conservatory's — it is tiled: grey tile in rolls down every slope, a round tile-end on each roll at the eave, the hips rolled, and the corners swept up (and 11: they ended in gold balls on black posts, bedknobs; they end in the sweep's own curl); 3 the stone the ways part at was a sawn disc — a low boulder, weathered, the rake's rings going round its own outline; 4 the tōrō were porcelain — granite, grimed under every ledge, damp at the foot, lichened; 6 the hedge behind the lanterns was one black stripe — its top takes the moon, and clipped finials stand out of it; 7 the cherries were the most saturated thing in the night — greyer, fewer flowers, lit from above only; 8 the gravel was white speckle on grey — larger, softer grains, a little warm; 10 the lawn in the lanterns' light was brown mud — it has blades there.

### The Pavilion's own things (audit II, board 11)

*2026-10-09* · `src/world/pavilionProps.js` · `?wpavprops=old` puts all of them back as they were; `?wpavprops=old:4`,10 only those.

The Pavilion's own things, reviewed 2026-10-09 (board 11 of the second audit; the numbers are the board's own). The stand was right and showed what stood in it: 3 up close the bracket arms were lengths of timber with flat ends, and a gilt cup and ball hung from the middle of the ceiling like a bell — the arms' edges are eased and their ends rolled under, their faces carry a band of green inside a chalk line (cǎihuà, the paint a bracket of this kind is always given), and the boss is a plain lacquered one; 4 the qin the caption sends the reader to was a board with a pale stripe — it has a qin's outline now (the head, the neck cut in, the shoulders, the waist), an arched top, seven strings from the bridge to the tail, thirteen studs of pearl where the harmonics are, its head over the table's edge with the pegs and their tassels hanging from it, and a cloth under its tail let down over the rim; 6 the willows were umbrella pines — tufts on bare limbs, and thin bright strings hung from them like rain on glass: a full round crown that droops at its shoulders, and a curtain that starts inside it and darkens to its tips; 10 the rails were one red-brown from end to end, plastic — the lacquer is deeper where two members meet and under every rail, rubbed through to the wood along the top of the handrail where hands go, and its top is eased; 13 gilt collars on every column and gilt balls under every lantern, with the finial, were a casino's — the collars are dark gilt, the small fittings bronze, and the one bright gold thing is the finial. (1 and 2, the roof and its corners: forkProps.js, 2 and 11. 9, the caption's last two words alone on a line: map.css, `.room-voice-line`.)

### The Web of Time's own things (audit II, board 12)

*2026-10-09* · `src/world/webProps.js` · `?wwebprops=old` puts all of them back as they were; `?wwebprops=old:2`,7 only those.

The Web of Time's own things, reviewed 2026-10-09 (board 12 of the second audit; the numbers are the board's own). The court was right — the lettered pedestal, the paving and its gold paths, the fireflies, the hedges in the near field — and what stood round and over it was not:
- **1** over the cedars the Library's wall top still showed, a pale lit strip on the night (the green discs along it were auditFix.js, 2). The balustrade on the wall tops is the garden's pale stone, and nothing let it fall into the night with the wall and the coping under it; and its balusters are instances, which the night's falloff placed at the world's origin, so they stayed white whatever the rail did. Both fall now (buildWorld.js, M.wallTop and stoneShade's `vStoneAt`) — and the belt, below, is closed in front of all of it, so that from the stand none of the stone shows.
- **2** the cedars were telegraph poles: a straight bare stem with a tuft every nine units up it, all of a height and evenly spaced, a palisade — and only twenty-five of them stood, with the wall between. They are grown as spires (trees.js, `spire`): leaf from the grass to the leader, in whorls set as close as their own reach, hanging low down and lifting toward the top; of heights from 68 to 200; stood unevenly, in rows where there is ground for a row, and then one more wherever from the stand the stone still showed between two (closeBelt).
- **3** the armillary was a saw blade: its degrees and hours were blocks of gilt stood out from the rims of round hoops, teeth on a gear. The rings are flat bands now, as an instrument's are, and the graduations are let into their faces in gilt, every fifth longer and every tenth longest, between two scribed lines. The lit band with its signs is as it was.
- **6** the caption's last words ran out over the pale court, the brightest floor on the walk, and its name sat a line lower than in every other room: map.css — the pool of shadow under it reaches further in this room (`.room-hud[data-room='web']`), and the voice's cell is as tall in every room (`.room-voice`). (No switch: it is not the world's.)
- **7** the top of the frame was a black void — sky and cedars both at nothing, the trees without an outline, the court afloat in black. The night behind the belt is lifted a few levels, low down, as haze with the moon on it (sky.js), and the belt's own leaf gives back enough of the night to have a shape (`BELT.moon`): over the upper three fifths of the stand's frame the median luminance went from 0.0006 to 0.0019.

### The Door (audit II, board 9)

*2026-10-10* · `src/world/doorProps.js` · `?wdoorprops=old` puts all of them back as they were; `?wdoorprops=old:2`,7 only those.

The Door, design audit II's board 9 (2026-10-10) — the numbered points:
- **1** the gable's apex touched the frame's top edge and its finial was cut off: the stand is further back and looks higher, so the whole gable, its finial and a strip of the night over the wall are in the frame;
- **2** the pavement had gone olive-green right across the room — the garden's light was a pool a hundred and fifty units wide laid 22 into the room and a green lamp outside the arch that no wall stopped — it is a tongue now, in the passage and a slab or so beyond the jambs, and the near floor has the lamps' warmth;
- **3** (the lit seam along the right-hand case's foot was the floor's brass fillet: auditFix.js, 1);
- **4** the candles were clean cylinders: they have burnt down unevenly, with a melted crown, runs of wax down their sides and on the pans, a soft halo round each flame, the flames' light on the piers behind, and a flicker;
- **5** the fallen books lay shut, plain and dark, and read as tiles: one lies splayed open with its pale leaves lifting, one has fallen open on its face with its lettered spine up, and one of the shut ones is in vellum;
- **7** the lamp to the left of the portal hung large and bright and took the eye from the doorway: a smaller globe, burning lower, with less halo — its light on the carving is what it was;
- **8** the fallen blocks had rounded arrises all round, like foam: where a block broke fresh its arrises are sharp now, and only its old faces are worn (rubble.js, `crisp`);
- **9** the ladder was cut by the frame's right edge: it stands further along its rail.

### The ending (audit III, board 6)

*2026-10-11* · `src/world/finaleFix6.js` · `?wfin6=old` puts all of them back as they were; `?wfin6=old:1`,4 only those. `?wfinclose=a|b|c:` which way out of the close-up (1).

The ending, reviewed 2026-10-11 (board 6 of the third audit; the numbers are the board's own). The film has the right shape — gather, recognise, rise — and the rise (2) is kept as it was. What was not right:
- **1** the close-up was the weakest image, at the film's peak: for several seconds a smooth orange hood round a black void with a chin in it, a hand's breadth from the lens. Three ways out of it, all built (CLOSE, below): (the user chose a, 2026-10-12; b and c are kept behind ?wfinclose) a never head-on — the one who is the reader comes to stand beside them, a little ahead, looking where they look, the page lit in its hands and the face only the hood's edge against the heart's light; b the angle kept, from further off, so that the book is in the frame and it is the page that lights the mouth and the jaw from below; c cut — the eye stays on the others gathered, and rises from there.
- **3** there was no ending: the film came down on the map, with the card it had before ("Enter The Web of Time") and one small status line. Now the lit walk is held under one line; then a quiet colophon; then "Walk it again" (EntryMap.jsx, map.css).
- **4** the others were figurines: robes of one cut and one height, set at even intervals round the court, every one turned to the reader. They are of different heights now and stand where people stand, nearer and further; one reads on and does not look up; one is turned to the armillary, its back to the reader (finale.js). (One more was the reader who had stopped on the Silence's terrace, sitting on the same stool: not liked, 2026-10-12, and taken out.)
- **5** "Skip to the map" stood in the corner of every frame for thirty-four seconds, the rise included. It sinks to a trace after three, and comes back when the pointer moves or the screen is touched (EntryMap.jsx).

### The garden's props (audit III, board 5)

*2026-10-11* · `src/world/gardenFix5.js` · `?wgarden5=old` puts all of them back as they were; `?wgarden5=old:3`,8 only those.

The garden's props, reviewed 2026-10-11 (board 5 of the third audit; the numbers are the board's own). The Fork and the Pavilion are the two best arrivals in the piece (1, kept), and what was left was a handful of things that had not caught up with their neighbours:
- **3** the signpost stood at the centre of the Fork's composition and was the least made thing in it, a square black stick with two boards: it is the pergola's timber now, turned — a foot, a shaft that swells and tapers, a collar under each board, an onion cap — its boards weathered grey, housed through the post, their names cut into them and gilt in the cut; and it takes the light of the lantern on its own arm (`signLit`).
- **4** the wisteria's trunk was a grey ribbon, smooth, of one width from the plinth to the beam: three stems now, unequal, sinewed, roped on each other, turning on each other faster as they climb; thick at the foot and a third of that at the head; grey-brown, not grey.
- **5** the grass round the lanterns was single pale blades scattered on dark ground, needles: the blades stand in clumps (thick here, bare there), each broader and bent over, their tips a mid green and not a pale one; and under them a mown sward the lantern's light falls on (`swardLit`).
- **6** the curled ends of the Pavilion's hips were the roll tiles' pale grey against dark tile and the night, horns: dark bronze, and the gold finial is the roof's one bright note.
- **7** "over black water a single pavilion burns warm", and the water round it gave nothing back. From the bridge every lantern's mirror image falls below the frame (the eye is too high over the water for anything taller than a rail to show in it), so what the frame can have is what a painter gives it: the lit Pavilion lying on the water round its own foot, on every facet of the chop that leans toward it — the lacquer's red, the lanterns' orange — and thinning with distance (water.js, `glow`). The lamps are also reflected a second time off a steeper chop (`shatter`), which from this stand gives a few glints by the bridge and no more. From the Fork the same glow lies under the Pavilion as its reflection.
- **8** the armillary's plinth stood in its own lamp's shadow — the light is over its head — and so took only the sky: smooth blue-grey, with gold bands. It takes the paving's light back off the floor now, is the paving's stone with the lanterns' weather on it (grain, damp at the foot, streaks under every moulding, lichen, moss), and its two gilt bands are dulled; and the rings have a section: a bead at each edge of each face, the scale cut between them.
- **10** the Web of Time's stand had a blank leaf wall on either hand: a niche is clipped into each, with a small iron lantern hung in it on a crook, lit — the pair of them a gate before the court — and in the wider one a stone seat beside its lantern.
- **11** the trees across the garden had hard, stepped outlines: beyond `FEATHER` units a spray's cut edge is a ramp a couple of pixels across (effects.js, `feather`). The trees' crowns only: a willow's hanging strands are drawn in one pass, writing their own depth, and are left as they were.

### The HUD and its type (audit III, board 2)

*2026-10-11* · `src/world/hudFix3.js` · `?whud3=old` puts 2, 3, 5 and 6 back as they were; `?whud3=old:3`,6 only those. `?whudsub=b|c|d` puts one of the other three subtitles (1) in a's place; `off` is the script as it was.

What the design board on the HUD and its type (2026-10-11, audit III, board 2) marked FIX and REFINE — the points by the board's own numbers:
- **1** the room's subtitle is set in Tangerine at about 26 px: hairlines a pixel wide over a moving scene, a swash capital that takes a beat to decode, and the one face here that says stationery, not library. The board asked for options first, and there were four (SUBS, below). The user chose a: the name's own italic, Cormorant Garamond, at half the name's size.
- **2** four families for forty words. The mono is right in the opening, where "HEXAGON 967,168 · SHELF 2" is the catalogue speaking; over every room, as the kicker and the caption's source, it was a 2017 corporate face in a 1941 library. Those are set in Cormorant SC, letterspaced — the title's voice — and the mono is left to the opening (map.css, `--caps`).
- **3** the Vertigo is the one room whose brightest area is bottom right: the corner's pool of shadow ran out before it reached "fall into", set small at 72 per cent ink over lit spines. The pool reaches further left in that room and holds more of its dark, and the verb is in full ink there.
- **4** one ink in thirteen strengths, ten warm whites, three darks at eight alphas: drift, not decisions. map.css names four steps of ink, three shades and three lamp whites beside the gold and the jade, and nothing else. (No flag: it is the same page.)
- **5** fourteen durations, nearly all on the browser's default curve. One curve for what arrives (a long settle, a lamp coming up), one for what leaves, three durations (map.css, `--arrive`, `--leave`, `--t-*`). `old` puts the default curve back; the durations stay.
- **6** the first room's name was set over a reader: one of the file on the Vestibule's bridge, stopped at the rail in the corner of the frame the caption is in, half out of it. The corner the caption stands in is kept like the frame's edges are (walkers.js): nobody in it on arrival, and nobody stops in it, or across an edge, at any time.

### The Vestibule and the Echo (audit III, board 3)

*2026-10-11* · `src/world/libFix3.js` · `?wlib3=old` puts all of them back as they were; `?wlib3=old:3`,5 only those.

What the design board on the Vestibule and the Echo (2026-10-11, audit III, board 3) marked FIX and REFINE — the points by the board's own numbers:
- **1** the Library is one colour: four galleries a single brown-grey, the Echo a single beige. At arm's length the bindings are oxblood, bottle green, tan and gilt; from any stand they average to mud. Not a grade: the leather keeps its colour at a distance, and each gallery has one local colour of its own. The board asked for options first (COLOURS, below): there were three, and the user chose c — the bindings weighted to the gallery's leather, and the leather on its shelf-edges in that colour.
- **2** the readers on the bridge were cut-outs: the subject of the room, flat black, no rim from the lit arch behind them and nothing off the page. Their wool is an umber that can take light, the arch rims the shoulder turned to it, and the open page warms the hood and the chest (walkers.js, readers.js).
- **3** brick with a wood grain: every block of the gallery walls bevelled like a cushion and scored at a slant, all one size and one value — stacked timber, bars of chocolate. The ashlar is dressed as stone is (a narrow arris, a punched face), laid in courses of more than one height with blocks of more than one length and tone, and it has aged: lime bloom under its joints, soot hanging from the top of the wall in tongues, dirt climbing unevenly from the foot (textures.js `ashlar`, stoneShade).
- **4** the Echo's stone was modelling clay: one flat beige on stair, baluster, pier and column, the balusters turned in ten flats. In the Echo the carved stone is uneven in tone, dark in its soffits and its necks, polished where feet and hands have gone (the nosings, the handrail); the joints are darker; a baluster is turned in twice the segments.
- **5** the pier glasses reflected a smear: the room drawn fifty pixels wide and stretched over the glass. Drawn at the glass's own size and more, with no softening; the glass darker, a little green, foxed toward the frame.
- **6** the top third of the Vestibule's arrival was dead: flat block going to black over the arch. A string course over the keystone, in the pale stone, with a lamp-rail under it as the cases have under their cornices.

### The opening and the map (audit III, board 1)

*2026-10-11* · `src/world/mapFix3.js` · `?wmap3=old` puts all of them back as they were; `?wmap3=old:3`,5 only those. `?wmapink=b|c` puts one of the other two hand-overs (2) in a's place; `off` is the stone of point 3 with nothing of the options on it.

What the design board on the opening and the map (2026-10-11, audit III, board 1) marked FIX and REFINE — the points by the board's own numbers:
- **2** the hand-over was a let-down: a gold drawing, made by a hand, turned into neutral grey masonry round black pits, and that is the picture the reader comes back to after every room. The board asked for options first, and there were three, each a set of the same three dials (LOOKS, below): what is left of the ink once the stone is under it, how warm and how dark the stone of the unwalked cells is, and how far the lantern dims them. The user chose a: the ink never fully leaves — the unwalked cells stay as a faint drawing over darker stone.
- **3** sixty cells competed with eight. Every cell had the same coping, the same balustrade and the same contrast as the rooms of the walk, and the coping's blocks repeated at a size that read as a tiled texture. Over the map, the stone of every cell that is not a room of the walk loses its blocks (it is drawn in the stone's one mean colour), its relief and some of its light, and its balustrade is let down into the coping.
- **4** the garden had no colour from above: the most coloured place in the piece was navy on black, its pavilion a grey disc. Over the map it is given what it has on the ground — a warm pool at the pavilion, the pergola's violet, the lanterns' amber, moonlight on the pond (buildWorld.js, "The garden, seen from the map").
- **5** the numerals sat off their rooms: VI on black water left of the pond, VIII at the maze's mouth with the court it names lit a long way under it. The garden's places give the map a mark to set their numeral over (overlay `marks`): the fork itself, and the court. (A hairline ring round each of the garden's places at rest was tried with it, and taken out the same day: circles drawn on the garden, the user did not like them.)
- **6** two voices shared a line: the byline in serif italic and "CHOOSE A ROOM TO BEGIN" in gold mono capitals, so the instruction read as the byline's tail. The caption's own "Enter The Vestibule" gives the instruction: once a caption is showing, the line is the byline's alone (EntryMap.jsx).

### The phone (audit III, board 7)

*2026-10-11* · `src/world/phoneFix7.js` · `?wphone7=old` puts all four back as they were; `?wphone7=old:2`,4 only those.

What the design board on the phone (2026-10-11, audit III, board 7) marked FIX and REFINE, at 390 × 844 with a thumb — the points by the board's own numbers (1, the tall layout itself, it marked KEEP):
- **2** the walk button sat on the subject. The ringed arrow and "Drag to look · Hold to walk" stood centred two thirds of the way down the screen: on the Door's opening, on the Pavilion's lamp and table, on the Echo's stair — where each picture has its point. The button is on the bottom edge now, in the walk's own line between the way back and the seal, where a thumb rests (the way on has the line above to itself, and the way back says only where to: "the Vertigo"). The sentence is there until the first walk and does not come back when the reader stands still: the button it explained is under their thumb.
- **3** half the writing was missing. On a phone the room's line and every quotation were not shown at all: there for a screen reader, absent for the eye, and the words are half of this piece. They surface in the caption's own place, one at a time, in place of the room's name — a few seconds after arriving, and again each time the reader has stood still a while — and the name comes back between them. Nothing moves to make room for them. On the way between two rooms the road's line is there as it is on a wide screen.
- **4** the map was nearly black. The board left it to what was decided for the hand-over (mapFix3.js, 2: the ink is kept, faint, on the unwalked cells), and that decision is carried to this size: a cell 80 px across is drawn in hairlines, which hold half the ink a 200 px cell's lines do, so the kept drawing is stronger where its lines are fine; and the lantern lights more of the stone round the walk, which at this size was a seam.
- **5** the bottom quarter was permanent text. Kicker, name, subtitle and two ways, for as long as the reader stood there. The kicker and the subtitle are there on arriving and sink away after a few seconds, leaving the name and the ways. A touch on the name brings them back; another turns to the room's next line.

### The opening and the map (audit IV, board 1)

*2026-10-12* · `src/world/mapFix4.js` · `?wmap4=old` puts it back as it was; `?wmap4=old:2` only that point.

What the design board on the opening and the map (2026-10-12, audit IV, board 1) marked, where it is in the world — the points by the board's own numbers:
- **2** the paving was neutral grey, and most of the picture. The wall tops between and round the cells take about two fifths of the frame, and what lit them along the walk was the map's moon alone — a cool grey-white on pale stone — while every lamp inside the rooms is warm: "moonlit concrete" before "library". Over the map the light that falls on the wall tops is the lamps' own colour, and less of it, so the lit rooms are the brightest things on the page. It is the colour of the light on that stone (buildWorld.js, stoneShade): the moon is as it was on the garden and down in the rooms, and nothing is laid over the picture.

### The Echo's wall tops on the map

*2026-10-12* · `src/world/mapFix5.js` · `?wmap5=old` puts it back as it was; `?wmap5=old:1` only that point.

What the design board on the map (2026-10-12) marked, where it is in the world:
- **1** the Echo was the coldest, brightest cell: its wall tops read as wide pale blue-grey slabs with a checker of two tones on them, a different material library beside the warm Vestibule. Two things made it. The Echo's carved stone (libFix3.js, 4; stoneShade's `worked`) reached out over its coping — the paving's blocks toned one by one, their joints darkened, the faces that look up paled and polished, so the sky lay in them — and the warm bounce on the rims of the walk's rooms (mapFix.js, 8) was measured from a standard room's inner wall, so on the Echo's wider rim most of its coping was out past the warm. Now the worked stone stops under the wall tops, and the rim's warmth starts at each room's own inner wall: the same stone as the other cells' wall tops, at the same value.

### The map: the unwalked cells

*2026-10-13* · `src/world/build/light.js`, `CASE_HEADS`. The comparison is preserved in commit `26cee89`; the quieter heads became the sole behavior when the recovered fixes were audited for main on 2026-10-14 (`moon: 0`, `tint: TONE.quiet`).

What the review of the map (2026-10-13) marked REFINE:
- **1** every unwalked cell was the same cell: the same pale plank lying along the same two walls, lit the same way, thirty copies in one frame, and brighter than the ink outlines meant to be the quiet layer. The plank was the cornice along the top of each bookcase, just under the coping (shelves.js, `shelfWall`), seen from the map on the two shelved walls that face the camera. The stone round it had been made quiet over the map (mapFix3.js, 3; mapFix6.js `quiet`), but the wood had only taken the lamps' colour on the wall tops (mapFix4.js, 2) and kept the moon's full light, so it stood out more as the stone went down. The review offered two ways: drop the plank from the unwalked cells, or turn the cells by multiples of 60° so the repeat does not line up. Turning cannot help here: every cell's two hallways run along the walk, so the only turn that keeps them is 180°, and that puts the shelved walls back where they were. So over the map, in every cell off the walk, the heads of the cases (from 105 up, fading out by 96: the band the wall tops' lamplight already uses) keep none of the moon's light and take the unwalked stone's colour (`CASE_HEADS`): they go into the cell's dark. Nothing is taken out of the world, so the cells are as they were at eye level, and the change comes and goes with the rest of the map's look on the way down; the walk's own rooms keep their cornices as they were.

### Garden framing proposals retired after the audit

*2026-10-14* · The two earlier options are preserved together in commit `b2ec839`.
The question was how to fill the empty upper-right map area:

- `tilt`: change the wide-screen yaw from 9° to −6°. This changed the camera framing, with no change to the garden's positions.
- `trees`: retain the 9° yaw, extend the dotted road through `[[1150,176],[1132,100],[1140,15],[1175,-70],[1230,-190],[1300,-340],[1380,-520],[1460,-720],[1530,-900]]`, fade its opacity from 0.55 to 0, lift the veil from 0.75 to 0.3, with a reach of 230 world units.

The user rejected the dotted road and asked to spread the Pavilion, lake and labyrinth away from the library walls. Neither camera/road option was migrated to main.

The small recovered fixes retained on main are the nearest-cell construction optimization, the distant roof normals, quieter wall coping and bookcase heads, and the foliage comments and cloud-session instructions. The lookup uses unique coordinate keys to preserve its outside-world fallback; its results were compared with the original lookup across 21,184 sample points, including boundaries and ties.

### The garden spread into the map's upper right

*2026-10-14* · `src/world/gardenPlan.js`. The user chose **A** from three generated screenshot concepts: A put the lake and Pavilion above the maze, B used a wider lake beside the maze, and C put the maze above the lake. These were image mockups, not alternate code paths. Their previews are retained locally under `.ux-review/layout-options/`.

The chosen layout moves actual geometry while retaining the wide map's 9° yaw and the library's positions. The pond moved from centre `[1300,118]`, radii `[118,90]`, to `[1300,-174]`, radii `[148,112]`; the Pavilion moved from `[1305,110]` to `[1305,-182]`. The maze moved from origin `[1180,318]` to `[1240,195]`, keeping its 8 × 7 cells at 30 units each. The enlarged pond is separated from the maze by ground for the shore walk, and both bridge landings extend to dry banks.

The shared plan supplies the physical paths, walking legs, light positions, camera hit areas, opening drawing and still-map outlines. The Fork's arrival yaw is 315°, with its waymark at bearing 306° and distance 40 from the fork, so the relocated Pavilion and paths can be seen. The dotted road overlay was removed. The earlier `wshoreway` comparison was retired; commit `fc82316` retains the prior approach code and scene.

The original maze's random-stream state at its construction was measured as `-923889612` in that reference scene. Its corridors now use a separate stream at that seed, preserving the maze and its arrival direction when pond density or path lengths change. The actual arrival eye moved from `[1315,20,366]` to `[1375,20,243]`, exactly the maze's translation. New path edging uses separate streams, retaining the shared path-dressing draw budget.

Checks cover dry route centre lines, separation of pond and maze, and nonzero planting-route segments; the bridge clearance, turning and landing assertions retain their existing limits. Rendered map, phone and room pictures accompany real-input garden journeys and the navigation smoke suite under `.ux-review/`.

## Planting around the relocated garden

*2026-10-14* · The chosen concept had groves and small planting details that the relocated scene lacked. Nine clusters now put compact broad trees, pines and flowering cherries around the pond and maze, with shrubs and small granite stones beneath them. A separate random stream keeps the established planting and later sections unchanged. Roots and low crowns clear the real walking corridors, water banks and boundary hedges. The existing foliage and stone batches carry the additions.

The default desktop scene adds 34 grove trees. The map gives tree foliage a diffuse fill that fades away as the camera descends. Its response is limited by the leaf's brightness so pale blossom keeps its tone. Strict desktop, phone, Fork and Pavilion pictures were inspected; actual held-W garden walking and the Back controls passed.

## Reading the Silence and Vertigo

*2026-10-14* · Rooms III and IV were too dark. Warm diffuse bounce now reveals the Silence's stairs and shelving and the Vertigo's upper rim, fading at the doorways. Their stone bounce factors are 0.5 and 0.65. The well keeps 0.68 of its upper light rather than 0.5; its map fade takes 0.35 at the rim and 0.72 below, rather than 0.55 and 0.85. Lamp intensity and the glow at the bottom stay as they were. Strict room, desktop-map and phone pictures were inspected, and the navigation smoke test passed all five selected scenarios.

## Preparing shaders during construction

*2026-10-14* · The user reported a pause around 70%, when the garden's green drawing begins. Startup profiling placed this in shader preparation, followed by texture uploads. The world now creates its final lights before construction and submits shaders in short batches while sections are built, using the final environment. Construction order and random draws are unchanged.

A repeated GPU profile measured the post-build shader wait at 2.2 seconds, compared with 2.8 seconds for the original loader; total startup in those repeat runs was about 14 seconds. The first, colder reference was 26 seconds, so that difference is not treated as the optimization's gain. Scene fingerprints retain identical geometry, light configuration and material shader code; animated transforms/uniforms differ with time, and early compilation retains two superseded shader sources in the cache. Profiles and reference pictures are under `.ux-review/shots/loading-*`.

## Keeping the opening's frame cadence

*2026-10-14* · The opening's worker spent only a few milliseconds drawing each frame, but its timer restarted at the actual frame time. Slight lateness at the 30 FPS boundary then skipped a whole browser frame. The timer now keeps its phase and advances past missed deadlines, while still using the real elapsed time for movement and the slower cadence during the first world frames.

Matched GPU profiles measured roughly 19 updates per second before and 27 afterward during construction. Total startup remained about 14 seconds, so the measured gain is animation smoothness. Additional batch/foliage shader warm-up experiments did not improve repeated loads consistently and were discarded. The five-scenario smoke test and strict rendered view passed; profiles are `.ux-review/shots/opening-timing-startup.json` and `opening-cadence-startup.json`.

## The map's tone (2026-10-12)

The user said of the map: "it looks too reddish". Measured on their
screenshot, the stone round the walk sat at hue ~23 (a quarter of it under 17:
red-brown), where the palette the Library was re-keyed to puts its lamplight
at ~33-36 (World.jsx, "The palette"). Three things put it there, all over the
map only:

- the wall tops lit in the lamps' own orange (mapFix4.js, 2), which against the
  moon it replaced is 2.2x the red and a fifth of the blue, on stone that is
  warm already — and ACES carries a saturated orange on toward red
- the warm bounce on the walk's rooms' rims (mapFix.js, 8), as orange
- the grade's gold (Grade.js), which turns brown light amber, but only where a
  pixel is lit: the paving round the rooms is too dark for it to reach

The user asked for options. Four, from the warmest to the most neutral, each a
set of the same dials (`TONE` in `src/world/mapFix6.js` explains each dial):

| look | | route (wall-top light) | rim (bounce) | quiet (unwalked stone) | bounce (hemisphere ground) | grade (map only) |
|---|---|---|---|---|---|---|
| a | amber: the same warmth, its hue moved from copper to amber | `#ffc985`, warm 1 | `[1.0, 0.74, 0.42]` | as `LOOK.a` | `#5b432f` | gold 0.3, deep 1, chroma 0.92 |
| b | old gold: yellower and a little brighter, brass lamplight on the stone | `#ffd796`, warm 1, k 0.5 | `[1.0, 0.8, 0.48]`, k 0.85 | `[0.41, 0.385, 0.33]` | `#5a4c36` | gold 0.42, deep 1 |
| **c** | **parchment: half the colour, pale warm limestone, the lit rooms warmest (picked)** | `#ffd8a0`, warm 0.55 | `[1.0, 0.78, 0.5]`, k 0.55 | `[0.4, 0.38, 0.355]` | `#4e463c` | gold 0.3, deep 1, chroma 0.62 |
| d | ash: the stone near grey, the warmth left to the rooms and their rims | `#e9e2d6`, warm 1 | `[1.0, 0.8, 0.52]`, k 0.5 | `[0.38, 0.375, 0.37]` | `#3f3c38` | gold 0.25, deep 1, chroma 0.3 |
| old | the map before this board | `#ffb466`, warm 1 | `[1.0, 0.62, 0.3]`, k 0.75 | `[0.4, 0.37, 0.33]` | `#5b432f` | gold 0.18, deep 0, chroma 1 |

The user picked c. The code with all four behind `?wmaptone=a|b|c|d|old` is
commit `e2222d8`.

## Notes moved out of the code (2026-10-12)

When the world builder was split into `src/world/build/` and `src/world/rooms/`, its comments were cut back to what the code does and why. What they also said — how a thing used to look, what was tried, when it changed, what was said of it — is kept here, word for word, under the file and the line of code it sat over. The code that drew the old versions is in git history (and behind the `?w…=old` flags where they still exist).

### `src/world/build/common.js`

Over `export const OLD_PALETTE = typeof window !== 'undefined' && new URLSearc…`:

> The palette (see World.jsx): the stone was a warm greige that stayed brown in the lamp's light and out of it. It is a neutral limestone grey now, so the lamps are what make it warm. (A cool sage was tried first and read, with the rest of that cut, as a filter.) ?wpal=old for the stone as it was.

Over `export const FLOOR_OLD = typeof window !== 'undefined' && new URLSearchP…`:

> The Library's floor as it was before 2026-10-06 — twelve slabs of one size in a brick bond (`flagstones`) — not the pavement (`paving`) that replaced it.

Over `export const CRACK_OLD = FLOOR_OLD || (typeof window !== 'undefined' &&…`:

> ?wcrack=old: the Door's cracks as they were before 2026-10-07 — dark strips laid on the pavement, a pale lip beside each and knobs of moss along them — not the cracks painted into it (cracks.js). (With the old floor, the old cracks: the painted ones follow the pavement's joints.)

Over `export const RUBBLE_OLD = typeof window !== 'undefined' && new URLSearch…`:

> ?wrubble=old: what came down with the Door's wall as it was before 2026-10-07 (boxes with a dented end and one twenty-faced chip, turned every way) — not the stones of rubble.js and the shade at their feet.

Over `export const SHORE_OLD = typeof window !== 'undefined' && new URLSearchP…`:

> ?wshore=old: the pond's edge as it was before 2026-10-07 — the water cut to an ellipse over the lawn with a smooth stone at every other point of it, and the Pavilion's bridge coming down onto two boxes of ashlar — not the bank, the set stones and the granite pier and step of shore.js.

Over `export const IVY_OLD = typeof window !== 'undefined' && new URLSearchPar…`:

> ?wivy=old: the Door's ivy as it was before 2026-10-09 — cards of painted green blots on the arch's garden face and the passage walls — and the pergola's vines as one plain tube of timber, not the grown ivy and twined, barked, leaved wisteria of ivy.js.

Over `export const OLD_GLARE = typeof window !== 'undefined' && new URLSearchP…`:

> ?wglare=old: the lamps and the moon's shaft as they were before 2026-09-26 — halos sized in the room, and light columns that stay whole with the eye inside them (the milky Echo crossing), to compare against.

Over `export const HEDGE_DIAL = import.meta.env?.DEV && typeof window !== 'und…`:

> ?whedge=bare (DEV): the hedges without their sprigs; ?whedge=none, no hedges; ?whedge=gloss, the body's full lamp gloss as it was before 2026-09-28 at all — what they cost, and what the sprigs do for the silhouette.

Over `export const FORK_OLD = typeof window !== 'undefined' && new URLSearchPa…`:

> ?wfork=old: the garden's ways as they were before 2026-10-07 — the road not taken leaving the Fork through the pergola's last post and going round the north of the pond to the second bridge, and only lawn between the Pavilion's bridge and the way to the maze.

Over `export const PERGOLA_OLD = typeof window !== 'undefined' && new URLSearc…`:

> ?wpergola=old: the pergola as it was before 2026-10-07, five frames running on to three paces short of the Fork's stone, a lantern in each of four bays.

Over `export const SHELVES = [`:

> Those were giants: folios of 1.6-1.8 m, taller than the readers walking past them, a shelf to a tier. A tier is now a bay of real shelves — three of folios at the foot, four of quartos, five each of octavos and of the small books at the top — and its books are the size books are: a folio 38-50 cm, a quarto 28-37, an octavo 21-27 (a unit is 9.4 cm). Thin boards between the tier's own heavy ones, and a back to the case 4.6 deep, not the 12 a giant folio needed. (?wbookscale=old for the giants.)

Over `export const DOOR_FALLEN = doorOld(2)`:

> (since 2026-10-09 in two heaps under the breach, wedged and bedded in the floor: doorFix.js, 2; ?wdoorfix=old:2 for the six spread over the floor)

Over `flag: FLOOR_OLD ? ['flagstones'] : ['paving'],`:

> the floor: a mason's pavement (`paving`, 2026-10-06) or the tiles it replaced

Over `wall: vestOld(5) ? ['ashlar'] : ['ashlar', { courses: 12, blocks: 5, spr…`:

> Twelve courses to the tile, not eight: a course about 30 cm, a block about 70 cm long, each a little further from the next in tone. At eight they were a torso high, and over an arch every block looked the same; at sixteen (22 cm) the wall read as small brick, not dressed stone (the review of 2026-10-08, point 5; ?wvest=old:5 lays the old). (dressed with the punch, in courses and blocks of more than one size, with lime under its joints: libFix3.js, 3 — it had read as stacked timber)

Over `wood: WOOD_OLD ? ['walnut'] : ['timber'],`:

> The wood: boards sawn from the log, grain along u (`timber`, 2026-10-05), or the striped walnut it replaced (?wwood=old, see woodGrain.js).

### `src/world/build/grounds.js`

Over `{`:

> Where they stand is where they always stood — drawn from the world's stream, which this still spends to the draw exactly as it did, so the shrubs, the mist and everything after are where they were. What each tree IS comes from a stream of its own, and from where it stands: willows and black pines on the pond's far bank, leaning out to the water; maples and pines in the middle ground the walk looks across; cherries where the old ones were in blossom; and beyond, broad trees and the tall cedars that make the skyline. A tree never walked near is grown without twigs.

Over `const night = species === 'cherry' && !propsOld(7);`:

> (forkProps.js, 7: a cherry in flower at night. Its sprays were the palest pink in the garden and lit all round, and from across the water each tree was a puff of the one saturated colour in the frame. Greyer now and deeper; a third of its sprays left off, so the dark limbs show through; and a spray under the crown's middle is in the crown's own shade — the moon is on its top. No draws are spent on any of it: the stream does not move.)

Over `for (const sp of grown.was ?? []) {`:

> (A weeping willow has more sprays than the willow it was, and every spray stood up draws its tint from the trees' stream: that stream is spent on the sprays it HAD, to the draw, and the ones it has take theirs from its own. Drawn for the new ones, every tree after the first willow was another tree.)

Over `if (!webOld(2) && !paintings) {`:

> Behind the maze, a belt of cedars (webFix.js, 2). The Library's garden faces stand three paces past the maze's far hedge and ten metres tall, and from the heart they were the top half of the frame: a garden maze in a walled yard. Two and three deep, the back rows taller, their spires are the skyline from the court and the stone is behind them. (Their own stream: nothing above moves.)

Over `{`:

> And out of the Library. A sheet laid on the lawn beside the Door reached in over the breach, and from inside the gallery its far edge met the walls at eye height: a razor-straight line across both walls of shelves, milky above and clear below. Over any room on the walk the mist thins to nothing — in the shader, so every sheet keeps the size and place the garden was composed with.

Over `const BANK = [1.3, 0.85, 0.6, 0.42, 0.34];`:

> The garden's stones half sunk in the ground, the way a set stone sits; and round the pond, set as stones are set — a big one and two smaller beside it, then a gap of low ones — rather than one of a size every few paces. (Same places, same draws: only the size each is given.) (And paler: the near-black greys they were given read as holes at night.)

Over `const clump = garden5Old(5) ? null : GRASS;`:

> (gardenFix5.js, 5: they were needles — clumped now, broader, their tips a mid green; and under them a mown sward for the lantern to fall on)

Over `const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b…`:

> ── The pond's edge (shore.js) ────────────────────────────────────────── A bank the water lies in, its stones set along it, and pebbles; the stones that stood round it before (`bank`) are left out — their draws were spent where they were made, so nothing else moves.

Over `fireflies.length && (webOld(5)`:

> A third of them, half the size, mostly low over the hedge tops, of uneven brightness and blinking slowly: big and even, at head height in front of everything, they read as dots on the lens, not as insects. (All still drawn from the stream; only these are shown. No mint ones: the garden takes no teal.) (webFix.js, 5: and still they read as dust — few, large and steady. All of them now, and more over the maze, half the size, each flashing on a beat of its own and dark between.)

### `src/world/build/honeycomb.js`

Over `const ECHO_R = qNum('wechor', Q.get('wechoroom') === 'old' ? R : 112), E…`:

> The Echo is wider than the other galleries. With its colonnade out at 62 (clear of the stair coping) the aisle between a column's plinth and the bookcases was under a metre, and the reader squeezed past every pier. Growing R for every room moves every cell and the garden with them (see the honeycomb's spacing above), so only this room grows, into its own walls: they stand 25 deep on each side of a hallway, and the Echo takes ten of its twenty-five. Every cell stays where it was, and so does every other room; the hallways into the Echo are shorter by what it took. ?wechoroom=old is the Echo at 100 again; ?wechor dials it.

Over `const RAIL_OLD = Q.get('wrail') === 'old';`:

> ── Stone balustrades ── What a stone bridge carries over the dark: a plinth, turned stone balusters, a moulded handrail, and a pedestal wherever the run starts, stops or is met by another. The Vestibule's bridge had two bronze pipes on round posts and the flights a thin rod over metal spindles — a ship's rail and an office stair's, in rooms of ashlar, Doric columns and walnut. It all goes in the stone of the coping it stands on, in batches of its own: `balustrade` is not one of body.js's STAIRS, so no tall step is ever taken up onto it, as none was onto the bronze. ?wrail=old is the bronze.

Over `const BRIDGE_LEVEL = !RAIL_OLD && Q.get('wbridge') !== 'old';`:

> The Vestibule's bridge level with the floor, the well's rail run round it (vestibuleBridge.js, 2026-10-06). ?wbridge=old: the raised bridge with the stone balustrade above, ?wrail=old the bronze before that.

Over `const kinks = [-crown, crown].filter((u) => u > u0 + 1e-6 && u < u1 - 1e…`:

> Everything on the flank is set off the deck line and RAKES with it — the parapet, its coping, the string under it, the top of the arch ring. Stepping the kerb with the treads instead (which is how this was built) leaves a sawtooth of bare stone between it and every raking member, and the foot of the stair came out looking like a slipped wall.
>
> The pitch line kinks over the crown, so a member drawn from end to end has to be given those corners or it cuts across the top of the flight.

Over `const HIGH = 1.6, FLUSH = -0.45;`:

> Over the crossing the parapet comes DOWN. The other flight's deck arrives there, and a kerb standing across it is a kerb across the way off — from the crown the landing was a lattice of four little walls with the reader penned in the middle of it. Only the stone above the deck goes; what is under it belongs to the arch and stays. `gap` is one span for both flanks, or a function of the flank (-1, 1) where the two differ — two flights meeting at a landing at 60 degrees bury the inner flank in each other three times as far as the outer one. A span may run off either end of the flight; it is clipped to it.

Over `const crossTop = (p) => {`:

> ── where another flight crosses this one ── `cross` is a flight crossing this one at its middle, the same width (the Echo's two): { c, ang, f, half }, `half` the half-width of its treads. Each flight's flank ran straight on through the other, and the flank is set off the PITCH line, which rakes through the nosings and so stands a whole riser over the back of every tread. Under the crown that is buried; one tread down it is not. The parapet "flush" with the pitch line, the string and corona, the keystone all stood up out of the other flight's lower treads as slabs and sloping kerbs lying across its stair, up to three units proud ("this weird shape", 2026-10-06). So, crossed: - no member of the flank stands higher than the other flight's tread where it passes under it (`crossTop`, `roof`, `cutTo`); - over the crossing the flank comes down to its own TREADS, not to the pitch line, so the landing is stone flush to the outer face; - the parapet opens only where the other's deck really comes in, a different stretch on each flank, and the two balustrades meet at a newel at each of the four corners (the old one span for both left each flank open over the well for ten units past the other flight). ?wcross=old is the crossing as it was.

Over `const lean = (line) => {`:

> A point in a straight run says nothing, so it goes — but straight measured from the last point KEPT, not from its neighbours. Sampled a thousandth apart, every point of a curve lies "in line" with the two either side of it, and tested that way the whole soffit went, point by point, and its two ends were joined by a chord: the arch's backing course and the flank over it hung down across the opening under both flights as one flat wall, from the crossing nearly to the floor ("the two bridge parts do not mesh together", 2026-10-06). A point goes only if every point dropped since the last one kept still lies within a hundredth of the line that stands for them.

Over `const FLOOR_Y = 6;`:

> (`face`: the stone of the flanks — kerb, ring, abutments, string, coping — where `stone` is the nosings', which are walked on and so a stair to body.js. The Echo's flanks are the flights' own stone: the caps' ashlar, laid in world units, ran ONE bed joint dead level across both flights at the same height, and with the darker block over it that was the line that cut the bridge in two, 2026-10-07)

Over `const TREAD_W = 2 * (halfW - 0.8);`:

> ── nosings ── One over every riser, overhanging the step below it and chamfered under, so the lip throws a line of shadow the length of the flight instead of reading as another square edge.
>
> And a stair is read by its values, not its shape: the lip pale, the riser under it dark, the tread between. Cut from the treads' own stone and lit by lamps that cast no shadow, all three were one flat brown and the flight was a stack of slabs. So the lip is the parapet's paler stone, the riser is laid in the shadow the lip would throw, and each tread is walked paler down its middle where feet have gone.

Over `const parts = [[-LIFT - 1.1, 0.6, D]];`:

> One plain band, a hair proud of the flank. (With a fillet along its top it was a second bright line beside the coping, and from the stand the flank read as three rails running down to the floor; ?wechofix=old:2 is without any string.)

Over `for (const side of [-1, 1]) {`:

> ── the springers ── Where the arch comes down to the floor the ring simply dived into it, and the coursed abutment beside it read as a different building. A skewback block at each springing, standing out past everything around it, is what the two are jointed by — and it says where the span begins, which from the floor is the one thing about this stair worth knowing.

Over `if (plane) {`:

> `plane` (the Echo): no string. Its corona's shadow ran the length of the flight just under the deck, on top of the arch ring, and cut the bridge in two along it — a balustraded wall standing on an arch, "a large line that splits the bridge in two horizontally" (2026-10-07). Instead the flank comes out flush with the ring's face from the ring to the coping, so arch and parapet are one face of one stone, broken only by the keystone and the springers. (?wline=old: the string.)

Over `for (const side of plane ? [] : [-1, 1]) {`:

> ── the parapet's joints ── The parapet and its coping were each one smooth stone the length of the flight: from the foot of it, a plain plane along the side of the frame. Cut into blocks a little over a stride long, joint by joint, inside face and out, it is built. (Not on the Echo's flanks — `plane` — whose stone has joints of its own; these were black slits through them, read as cracks.)

Over `LB.bronze.add(placed(new THREE.CylinderGeometry(0.62, 0.8, 0.32, 14), q,…`:

> a plain turned cap: the ball and spike it had were the sharpest, brightest thing in the Echo's frame, and pulled the eye off the arches

Over `const END = 5.5;`:

> The balustrade runs from springing to springing — over the WELL, and no further. Past the springing the flight is a low ramp a few feet above a stone floor, where a kerb is all it wants; and it is how a bridge reads anyway, solid parapet on the approaches and balusters over the arch.
>
> (A rail carried out to the feet was also one the walk went through: when the feet stood within a stride of the bookcases and a reader got on and off over the parapet, check:walls measured the old thin one at 0.7 from the eye on the way out, and at 1.1 from it on the way in.)

Over `if (cross && gapNewels) {`:

> ── the corners ── Where two flights' balustrades meet, each parapet and coping ends square under the newel they share, and on the side a reader stands the corner between the two ends was left open: a bite out of the wall the height of the kerb, three units deep at the sharp corners. Filled to where the two inner faces meet, they meet in one mitre. (One flight lays them, with the newels.)

Over `flank: new Batch(M.step, P),`:

> The Echo's flights' flanks, in the stone the flights themselves are cut from (their steps and the arch under them): one stone, its joints running every way, so no single course runs level across both flights. Its own batch, because body.js reads `step` as a stair and a flank is not one. (It was the carving's limestone, jointless, and on a face this big its soft mottle read as glossed plaster, 2026-10-07.)

### `src/world/build/kit.js`

Over `const GRAVEL_COLOR = propsOld(8) ? '#6f6c66' : '#7b7367';`:

> (forkProps.js, 8: that was white speckle on grey — a grain a pixel or two across, forty shades apart from the next. Pebbles now: each a few millimetres to a centimetre and a half, rounded, lit a little on one side, a dozen shades apart, a little warm; and the bed they lie on shows dark only between them. Painted from its own stream — the old one is still painted above, for the draws it took from the world's.)

Over `for (let k = 0; k < 20; k++) rnd();`:

> The koi were a card painted here, four blotches drawn from the world's stream; they are solid fish now (pond.js), and the stream is spent as the card spent it, so everything laid out after this lands where it did.

Over `const dressedSet = { map: again(pale.map, 1 / 20), normalMap: again(pale…`:

> (painted once: the caps' stone, laid at another size — it was painted twice)

### `src/world/build/light.js`

Over `const LAMP_SHADOWS = !light && typeof window !== 'undefined' && new URLS…`:

> ?wlampshadow=1: the first two of them cast shadows — the rails, the balusters, the readers and the stairs laid across the lamplight on the stone. A lamp never moves, so its shadow would be drawn ONCE, when it is handed to a light, and kept (World.jsx renders shadows only when asked; see takeShadowRequest). Off unless asked for: two shadowed point lights put a cube-map lookup for each into every lit material, and on the AMD integrated GPU this piece is made on, ANGLE's shader compiler never came back from the programs that made — the frame stopped dead (2026-09-27).

Over `const live = lightPool.slice(0, budget);`:

> A lamp already lit keeps its place until another is CLEARLY nearer. Sorted on raw distance, two lamps a reader walks between swap back and forth across the tie, and a whole gallery's light flickers with their footsteps. Only the slots inside the budget count for any of this. A slot the governor has switched off still REMEMBERS the lamp it was lighting, and if that memory is allowed to count as "held" then no live slot will ever take that lamp on — it simply goes dark and stays dark. (That is exactly what happened the first time the budget came down mid-walk: the garden lost the light under its armillary and never got it back.) A slot that falls outside the budget fades out like any other and then lets go.

Over `const gardenGlows = [];`:

> ── The garden, seen from the map ───────────────────────────────────────── On the ground it is the most coloured place in the piece — red lacquer, violet wisteria, amber lanterns, a blue roof under the moon. From the map it was navy on black: the pavilion a grey disc, the pergola a dark mat of leaves (the racemes hang under it), the lanterns four dim dots, and the pond, which takes the sky only at a grazing angle, as dark as the lawn (mapFix3.js, 4). None of its lamps is among the few the map's light pool carries. So over the map it is given what the rooms have, as light laid on it and gone by the time a flight comes down among it (setVeil): the pavilion's lamplight pooled on the water and the bridge round it, the moon's road across the pond, the wisteria's violet along the pergola, and the stone lanterns' amber.

Over `{`:

> the wisteria: its racemes hang under the pergola's rafters, and from above there was only the mat of leaves over them

Over `const routeLit = (mat) => {`:

> And the tops of the bookcases, which stand to the head of the wall: from the map each was a pale band inside its cell's rim, timber gone grey under the moon, and the brightest cold thing left once the coping round it had the lamps' light (mapFix4.js, 2). They take it too. (Chained on, as the pit's is.)

### `src/world/build/materials.js`

Over `.replace('#include <aomap_fragment>', '#include <aomap_fragment>`:

> (and its gloss with it, webFix.js 2: let fall in its colour alone, the stone kept the sky in its sheen — blank brick, painted black, was still brick in the moonlit sky's reflection)

Over `const hedgeMoon = (mat) => {`:

> The moon on a hedge's shoulder and top, from across the garden only (forkProps.js, 6). Close to, a pale band along every top was the first thing wrong with the maze, and there is none; far off, the hedge that closes the garden was a stripe of black with nothing to say where its top was. Laid on what the skyDull above left.

Over `oak: WOOD_OLD ? Std({ color: '#5e3f27', roughness: 0.55 })`:

> The ladders, the stools, the catalogue's drawer fronts: a paler wood than the cases'. (One flat colour until 2026-10-05, and under a lamp a ladder's rail lit up like a rod of orange plastic.) The cases' walnut, tinted up in linear light, so it shares their compiled program.

Over `wornFloor: wayLit(Std({ map: flag.map, color: '#a8a295', roughness: 0.56…`:

> (Roughness 0.34 and 0.36 until 2026-10-05: a tread worn that glossy took the lamp over it as a hot spot the size of a footprint.)

Over `nosing: stoneShade(Std({ map: again(carveSet.map, 1 / 13), normalMap: ag…`:

> The Echo's stair read by its values (echoFix.js, 2): the lip the palest stone on it, the riser only a shade under the tread — at 0.4 every riser was a black slot and the flight a stack of separate slabs. (in the balustrades' jointless limestone: the caps' ashlar put a mortar joint through the middle of every lip, a dark slot down the flight)

Over `pedestalStone: garden5Old(8) ? stoneShade(Std({ map: again(carveSet.map,…`:

> the armillary's pedestal, turned from one stone: the garden stone's tint on the lanterns' jointless carving (webFix.js, 7 — the ashlar's mortar ran in joints down the lettered shaft) (gardenFix5.js, 8: under its own lamp it took only the sky and was smooth blue-grey — the paving's stone now, weathered, and lit by the paving it stands on)

Over `wallTop: stoneShade(Std({ map: again(pale.map, 1 / 26), normalMap: again…`:

> the same stone in the balustrades on the wall tops, let fall into the night round the maze with the walls and copings under them (webProps.js, 1: over the cedars it was a pale lit strip, the one thing of the Library left in the court's sky)

Over `const wound = (pts, clockwise) => {`:

> A hole must be drawn the opposite way round to the outline it is cut in, or its walls come out inside out — and three only squares the two up when the OUTLINE is the one it had to turn round (the `reverse` branch of its ExtrudeGeometry). Every outline here is drawn clockwise, so that branch never ran and every hole kept the winding it arrived with: the stone had no inner face at all. A gallery's own walls were culled from inside it — the eye looked straight through them into the next room, which is what walking the Library felt like.

Over `const stoneGeo = () => {`:

> A garden stone: worn round, wider than it is tall, and green where rain and the dark sit on it. (The garden's stones were rockGeo, faceted and flat-shaded: from the Fork they read as black chips cut out of the frame.)

Over `const Q = new URLSearchParams(typeof window !== 'undefined' ? window.loc…`:

> The lamps' light, softened 2026-10-01, when the reader found the piece "almost aggressively lit". It fell off at an inverse square from a hot core, so whatever stood near a lamp — the court's paving under the armillary, the waymark beside its lantern, the Pavilion's floor and columns — was floodlit while the rest of the frame went black: stage light, not lamplight. Now it falls away more gently, the lamps put 60% of the light they did on what they light (the lamps themselves, their globes and halos, burn as bright as ever), the warm pools painted under them are a little over half as strong, and the fill comes up to meet them (World.jsx). The middle of the frame holds its brightness; the top 1% came down by 0.1-0.15.
>
> A lamp is rescaled so that it lights a wall DECAY_AT away exactly as it did at an inverse square; only nearer than that does the softer fall-off soften it, and further off it carries. ?wlight=old puts the hard light back; ?wdecay, ?wlamp and ?wpool dial each part of it.

Over `const point = ([x, z], y, color, intensity, priority, decay = null, colu…`:

> (And since 2026-10-05 a lamp is a globe, not a point — lightModel.js — so it is given back what the softer near field takes from it at DECAY_AT.)

### `src/world/build/shelves.js`

Over `if (real) LB.shelfBack.add(boxGeo(on(s0, CASE_BACK - 0.5), on(s1, CASE_B…`:

> The case's back, brought forward to stand behind the books: a giant folio was 9 deep, a real one is 3.

Over `const ledge = detail >= 1 && from === 0;`:

> A plinth on the floor — with a ledge at hand height to lay a book open on, and a raised panel in each bay — and a stepped cornice along the top.
>
> One top at the height the books stand on, never two or three. The lowest shelf board, the plinth and the ledge all used to end level there, and since each piece of wood took its own stretch of grain the three fought for every pixel of it: streaks of one board's figure and another's that reshuffled with every step. So the lowest tier has no board (the plinth is its shelf; 2.4 tall at least, so it holds all the board did), and under a ledge the plinth stops at the ledge's foot.

Over `const windsorChair = () => {`:

> A bow-back Windsor, the chair a reading room actually had: a thick rounded seat, four splayed legs turned with a ring where an H of turned stretchers enters them, and a bent hoop raked back over seven spindles. (It was a box on four sticks with a ladder of two rails for a back, and a hand's breadth taller than a chair.) Built facing -z, the way the old one sat; a unit is 9.4 cm, so the seat is at 45 cm and the hoop at 95.

Over `const readingCorner = (c, k, u0, { lit = true } = {}) => {`:

> A table against the cases with its lamp, an open book, a closed one with a smaller one on it, a stack on the floor by the leg and the chair pushed back from it. `lit`: in the Silence the lamp is out and the chair was left turned away.
>
> The books are the size of books a person reads at a table: folios of 35-46 cm. (They were drawn at the shelves' size, and the shelves are eleven metres of giants: the shut one was 80 cm long, the stack on the floor was a metre wide and stood higher than the table, and it stood round the table's leg.)

Over `const lp = on(u0 + 5, Z - 1.5);`:

> the lamp: a brass foot and stem, and an amber shade with the bulb glowing through it — light at the height of a reader's hands, which nothing else in the Library gave. A desk lamp's size, 50 cm with a 36 cm shade: once the books were cut to the size of books it had become the biggest thing on the table.

Over `const distantReaders = [];`:

> A reader standing far off in a gallery the walk only looks into. They were a robe turned on a lathe — a profile spun round an axis, wide at the hem and pointed at the hood — and from anywhere near that was a pawn, the same from every side, with no shoulders and no arms. They are the walking readers' own figure now (readers.js), cut coarser than a near one needs and all gathered into one mesh once the galleries are built (below).

Over `const G = r * 0.55;`:

> One opal globe, the size the bright core used to be. There is no clear shell round it any more: a lit globe is the light (makeLampGlobeMaterial), a dead one is the same globe in cold, dull glass.

Over `const chainTop = Math.min(MASS_H + 40, y + G * 1.58 + chain);`:

> `chain`: how far up the links are drawn before the dark is left to say the rest. A lamp in a gallery hangs from the top of the wall and its whole chain is part of the room. A lamp hung in the Vertigo's well hangs four hundred units down, and drawing every link of that put a black cable from the top of the frame to the bottom across the one thing the room is for — the look down the funnel. The chain still rises out of the light; it just stops being drawn once there is nothing left to light it.

Over `const wellGlowMat = keep(new THREE.ShaderMaterial({`:

> ── Light from far down the Vestibule's well ───────────────────────────── From the stand, under the bridge, the well was a flat black slab beside it: nothing said it went down. Now its walls are lit from somewhere far below, warmly and faintly — none at the lip, more the further down the eye goes — so the dark under the bridge reads as depth (review 2026-10-08, point 7; ?wvest=old:7). A sheet of lit air laid just inside the liner, as the light columns are: no lamp, nothing to cost.

Over `const VOUSSOIRS = 13, V_DEEP = 3.4, V_JOINT = 0.012;`:

> The ring as it would be built: thirteen voussoirs, each cut to the arch's centre, the keystone longer and standing out further, set a little proud of the wall on a bed of mortar that shows in their joints. (It was a smooth round moulding with a box for a keystone; with the wall's blocks a torso high every face of every arch looked the same — review 2026-10-08, point 5; ?wvest=old:5 puts the moulding back.) Built in the arch's own frame, x across, y up, z out of the face: `z0`..`z1`.

Over `beds.push(ringBlock(a0, a1, ARCH_R - 0.03, ARCH_R + V_DEEP - 0.1, zFace…`:

> and the mortar behind it, set back from its face, filling its joints (a piece to each stone: cut by the quarter, its straight edges were two dark beams across the opening)

Over `const rim = rimAt(c), wider = rim - R;`:

> A floor with a plan to it: a band of darker stone along the foot of the cases with a brass fillet on its inner edge, and a ring of the pale stone round the lip of the well. One grid from wall to well said nothing about where the room's edge was, or its middle. (the band follows the cases out in a wider room; the ring round the well stays with the well)

Over `if (k === 5 && (lit || (framed && rnd() < 0.4) || cell.k === WAY_IN.to)…`:

> "In the hallway there is a mirror, which faithfully duplicates all appearances." It was a slab: 44 tall, the whole length of the passage, standing out from the wall and running through the jambs of both doorways — from either room the way through looked half walled up by something black. Now it is a glass hung ON the wall, in a frame, stopping short of both openings so each doorway keeps its jambs and reads as a door. (2026-10-06: it still read as a blackboard — a panel of rough metal showing a blur of the environment and nothing of the room — and the Library's mirrors hang now as pier glasses either side of a gallery's way out, below. The stream is drawn here exactly as it was; ?wglass=old hangs these again.)

Over `if (k === 5 && lit && room === 0 && !lib3Old(6)) {`:

> A string course over the Vestibule's way out (libFix3.js, 6): the wall over the arch was flat block going to black, the top third of the room's first frame. A moulded course in the pale stone three units over the keystone, from corner case to corner case — a bed fillet, a cove, a fascia and a weathered top — and a lamp-rail lying on its ledge, out of sight from the floor, washing the stone over it as the cases' rails wash their top shelves.

Over `if (room === 1 && lit && !echoOld(7)) {`:

> Books over the Echo's ways out (echoFix.js, 7). The room is named for repetition, and through the upper arcade every bay showed shelves but these two, which were bare ashlar from the arch to the cornice. The top tier runs right across over the arch (its apex is at 76, the tier begins at 94); the two below it stand on the piers either side, over the pier glasses (whose heads are under 50), from the corner to a few units clear of the arch's voussoirs. Drawing nothing from the world's stream (`stream: 0`): the books are the walls' own.

Over `const ring = hexPts(c, shaft + 1.4), mid = lerp2(ring[5], ring[0], 0.5);`:

> The Echo's well is the one its bridge stands over, and the bronze rail round it ran under both flights' arches a hand's breadth below their soffits: a turned rail of another metal and another shape, at the height of a parapet, under the stone one — "like a bridge over a bridge" (2026-10-07). So a kerb instead, in the balustrades' stone: a plinth, a plain die and a rounded coping, 46 cm high, the well's lip and no kind of rail. (Carved stone, not a stair: body.js takes no step up onto it, and no crest.)

Over `LB.bronzeDim.add(slabGeo(hexPts(c, shaft + 2.9), [hexPts(c, shaft - 0.1)…`:

> The rail was three flat rings stacked into a plank, the nearest and largest thing in most frames and the least interesting. Now a bead, a neck, and a rounded handrail on them, rubbed bright on top where hands have gone round it — six straight lengths, their joints closed by a knuckle of the same section, and in the Vestibule (the one well no stair crosses at a corner) a newel standing on each corner.
>
> And LOW. "The ventilation shafts are surrounded by very low railings", Borges says, and at a man's hip the rail stood across the lower third of every stand's view, two paces away and the largest thing in it. At a reader's knee (the handrail tops at 12.5, 60 cm up) it lies along the bottom edge of the frame and the room has its floor again.

Over `LB.bronzeWorn.add(placed(new THREE.CylinderGeometry(1.15, 0.95, 0.55, 16…`:

> capped low and moulded: the ball it wore was the nearest, brightest round thing in the Vestibule's first frame

Over `const next = ringPts[(k + 1) % 6], n = Math.floor(dist(q, next) / 6.4);`:

> One baluster every 6.4 rather than every 4.2. At the tighter spacing the rail round the well was a picket fence: from a reader's eye the turned shafts closed up into a solid bronze band across the bottom of the frame, and the floor and the well behind it were both lost. Spaced out you see between them, and the room keeps its floor.

Over `for (let s = 0; s < (light ? 6 : 14); s++) {`:

> Dust, not a snowstorm. At 26 a gallery of it read as sparkle rather than air — and the eye goes to whatever moves, which was the wrong thing.

### `src/world/build/walk.js`

Over `const hug = (ground, pts, r = 3) => pts.flatMap((p, i) => (i === 0 || i…`:

> a line that keeps to its corners (the bridge, the maze) instead of cutting them (never further along a side than half of it: the way into the maze ends three units past its last corner, and four along it from that corner was a point BEYOND the end — the walk overshot its stand by a pace and came back, and the eyes, which look along the way, turned right round in one frame)

Over `doorLane(doorPropsOld(1) ? -38 : -38 - DOOR_STAND.back), forkOld(1) ? ad…`:

> The Web of Time: in the corridor a few paces short of the court's gate, looking in at the heart. (It stood 22 from the heart, and the heart was a corridor; the step into the court is the finale's.)

Over `const echoFlight = flightProfile(ECHO_FLIGHT);`:

> The Echo's stair, every tread of it, up over the well and down the other side: the second leg walks it, and the climb to the crossing is its first half.
>
> It used to leave out the ends. The climb went from the floor straight to the third tread (and through a point at floor height INSIDE the first two), so the eye rose ten units — about a metre — at 50 degrees in a stride, where the stair itself is 17; coming down from the crossing, that was the reader dropping off the bottom of the flight. And the walk on to the Silence left the flight by its SIDE, over the parapet, and fell twelve units to the floor beside it: "like I am jumping, not walking". Both ends are walked tread by tread now. The first riser is the one tall step there is (5 units off the floor, where the rest are 2.4), so the end treads are stood on towards their upper riser, spreading it over the most ground. (Read off the flight itself, so a re-cut stair — ECHO_FLIGHT — is walked as it is built.)

Over `const footU = -ECHO_SPAN - 1.5;`:

> The floor just short of the first nosing. The stand is back from the foot now, and without this the eye began to rise the moment it left the stand, up a ramp that is not there. (Only where the foot IS in front of the stand: on the old tread it was behind it, and the walk set off backwards.)

Over `{ eye: eye(spot[4], FLOOR), look: at(add(GATE, dir(330), 40), doorPropsO…`:

> Up at the arch, gable and pinnacles and all: level, the frame stopped at the springing of its hood and the carving above it was cut off.

Over `{ eye: eye(spot[5], GRAVEL), look: forkOld(1) ? at(turnAbout(spot[5], ad…`:

> at the end of the pergola, the waymark ahead where the gravel divides — turned a few degrees right of it, so the pergola's last post is out of the frame (it stood down the whole left edge, the nearest, darkest thing in it, and read as a tree trunk; since 2026-10-07 the pergola ends a bay short of here and that post is gone, but the turn still keeps the waymark off the middle)
>
> It showed no fork: the stone the ways part at was eight paces off, under the frame's bottom edge, and the look was down the way to the bridge — which runs on the pergola's own line — with the road to the Heart out of the frame to the right. Back from the stone and a little left, both ways leave it across the frame now: to the Pavilion, under the moon, and to the maze's mouth and its two lanterns. (Level enough that the moon over the Pavilion is whole: forkFix.js, 1 and 6.)

Over `const pavilionThrough = paintings ? [] : Q.get('wpavway') !== 'old' ? [`:

> The way on from the Pavilion went through the room, out over its second bridge to the landing that bridge comes down on — a few paces of gravel and a hedge — turned round there, and came all the way back before it set off for the maze: twenty-five seconds of a fifty-six second walk spent going to a dead end and returning from it. It goes in, once round the table, and out again by the bridge it came over; the second bridge is there to be found. (?wpavway=old: over it and back.)

Over `...(SHORE_WALK_OLD`:

> Off the deck by its steps and round onto the shore. The way used to turn straight back from the deck's end toward the maze, which floated the eye out over the bridge's rail and the strip of water beside it; a reader walking it on their own feet (World.jsx's free walk follows this way by default) stood at the rail and could go no further. (Out onto the middle of the shore's own gravel, SHORE_WAY, and round with it: that way ran a pace and a half from the end of the bridge's stone step, whose corner a reader's foot came up onto and stood on — "on a crest" — and went no further; and it met the way to the maze at a right angle and more, walked at a crawl. ?wshoreway=old)

Over `const one = [];`:

> One lamp, once. The Pavilion's table lamp is both a glow and a water lamp, and handed over as both it laid a column twice as bright as any other lamp's — a sheet of gold on the water in front of the Fork's stand (2026-10-05). The stronger of the two stands for it.

Over `const portalThin = (eye) => {`:

> How much of its haze the room through the Vestibule's way in is drawn with, for a reader whose eye is at `eye`. Through the arch the Echo was the brightest and the greyest thing in the Vestibule's first frame: its moon shaft and its fog, seen down the length of the room, lifted its blacks to milk. Seen from across the room it keeps half of them; walking up to the arch it gets them all back, so that by the step through — where the doorway has to be the room itself — it is the room itself (review 2026-10-08, point 3; ?wvest=old:3).

Over `let sight = null;`:

> ── A halo hidden by what stands in front of its lamp ─────────────────────── A halo is drawn with depthTest off, so that it lies over the stone its lamp lights; and so a lamp behind a column, a wall or a flight of stairs laid its glow over them as if nothing were there. Each halo in front of the eye is asked whether its lamp can be seen — one line a frame, to its middle and then either side of it in turn, so a post takes a third of it and not all — four halos a frame, and none again from where the eye already asked them all three; each fades to what can be seen (`seen`). A line costs a fifth of a millisecond here. `sight`: the body's line of sight (body.js), handed in by World.jsx. ?wlampsoff=occlude: as it was.

Over `for (const p of pools) {`:

> A lamp breathes; it does not flicker. The fast terms in both of these — 11 and 6 radians a second, about two a second — were what read as blinking, and a pool of light on stone has no business doing that.

### `src/world/rooms/door.js`

Over `for (let s = 0; s < 60; s++) {`:

> Boulders at the foot of the wall on the garden side, either side of the arch. (They were the fallen wall, lying in the breach; the draws are the world's stream's, so they are all still made, and only where the stone is laid has changed.)

Over `const ghostRubble = [];`:

> What fell when the stone that walled the arch up gave way ("between two shelves the stone gives way"), lying where it came down. Without it the Door's pavement was forty per cent of the frame with nothing whatever on it.
>
> It was then a hundred-odd chips of one size spread evenly over the lot, which read as confetti. Those draws are still made (the garden is laid out from the same stream) and thrown away; what the floor gets instead is below, from a stream of its own.

Over `const fk = BOOKS_GIANT ? 1 : 0.46;`:

> (folios, 41-47 cm, since 2026-10-06: they were 90 cm-1.2 m across)

Over `const strewn = !doorPropsOld(5);`:

> (They lay shut, plain and dark, and from the stand read as tiles. One of the shut ones is in vellum now; and where a giant's two boards lay nearly flat on their face, a dark slab, a folio lies splayed open on its back with its leaves lifting, and another has fallen open on its face, a tent with its lettered spine up: doorProps.js, 5.)

Over `for (let k = 0; k < 9; k++) {`:

> and the cracks it ran through the pavement, spreading from the gap. Since 2026-10-07 they are painted into the floor itself (cracks.js, read by paveShade), breaking slab by slab, from the breach and from under the blocks that fell. What is laid here is what they were before (?wcrack=old): a dark groove flush with the paving, a lip the moon catches on its side toward the breach, each crack narrowing as it runs out, and moss in the widest — still strips laid on the floor, crossing its joints as if they were not there. Their draws are the world's stream's, and the garden is laid out from the stream after them, so they are made either way.

Over `{`:

> ── One volume was a gate ───────────────────────────────────────────── The title of the room: the way out of the Library is a bookcase. It hung at the garden end of the arch's passage, closing it to twice a reader's height, and it has swung back into the passage and stands folded against its left side, its shelves still full and turned to whoever goes through. (Anywhere out in the opening, or at the arch's full height, from the room it stood across the arch as a dark post.) It stands clear of the plinth and the impost that run along the reveal.

Over `const shelves = BOOKS_GIANT ? [Y0 + 1.8, 20.4] : Array.from({ length: 6…`:

> (two shelves of giants 85 cm-1.2 m tall until 2026-10-06; six of quartos now, ?wbookscale=old for the two)

Over `const worn = !doorPropsOld(4), cr = makeRng(side < 0 ? 4411 : 4412);`:

> (They were five clean cylinders of a size. Burnt down now, each as far as it has, its crown melted and its wax run down it and onto the pan, a glow round each flame — its own sprite: `halo()` draws on the world's stream — and the flames moving a little: doorProps.js, 4.)

Over `point(at, 27, '#ffb466', 2600, 5, null, doorPropsOld(1) ? null : [DOOR[0…`:

> (theirs to keep from anywhere in the room: the stand is further back since 2026-10-10 — doorProps.js, 1 — and from there two lamps out in the Vertigo were nearer than these, and the arch stood unlit)

Over `lamp(inPortal(-44, 38), {`:

> Hung to the left of the arch rather than in front of it, where it stood across the springing, and high, level with the head of the hood: from there its light rakes across the orders and the gable, and every roll, hollow and foil reads by it. (Hung at the springing it lit the jambs, and the carving over the arch was one flat tone.) (no beam: its cone was a hard pale wedge down the cases to the left of the arch, and the breach is the one shaft of light this room wants) (lower since 2026-10-09: at 82 the frame's top edge cut its globe in half — doorFix.js, 8) (a smaller globe burning lower since 2026-10-10, so the doorway and not the lamp is what the eye goes to; its light is what it was — doorProps.js, 7)

Over `if (doorPropsOld(2)) {`:

> The garden's light: a lamp outside the arch and its pool on the floor. (The pool was a hundred and fifty wide and laid 22 into the room, and the lamp, which no wall stops, hung close outside: the whole pavement was olive. A tongue now, in the passage and a slab beyond — doorProps.js, 2)

### `src/world/rooms/echo.js`

Over `const ECHO_FLIGHT = { run: qNum('wechorun', Q.get('wecho') === 'old' ? 8…`:

> The Echo's flights are cut on a tread of 7, not 8. At 8 each one ran 144 long, and its feet came down at 72 from the middle of the room: in the corners, a stride from the bookcases, so the reader stepped onto the stair out of the shelves with the case at their back — "too little space when ascending". At 7 every foot stands 9 further in, with the floor clear in front of it (the parapet's corner 16 from the case, where it was 8), and the crown is where it was: only the going is shorter, not the rise. ?wecho=old cuts them on the old 8 again; ?wechorun dials it.

Over `const ROSE_OLD = Q.get('wrose') === 'old';`:

> Each flight is ONE piece of stone: a stepped top, and under it the arc that carries it over the shaft — springing off the floor at the well's lip, thinnest at the crown. As 36 separate slabs hung in the air with a gap under every one, this read as a stack of packing crates, which is the single thing that made this room look built out of cardboard. A real arch under each flight, springing wide of the well: end-on, a flight is a wall across half the room, and the opening under it is what makes it a bridge instead.
>
> The crown both flights share is where the rose is laid (see the crossing), so its two treads are not worn: the rose is what the feet have worn there. ?wrose=old is the rose as it was.

Over `if (!ROSE_OLD) {`:

> ── The crossing ───────────────────────────────────────────────────── The one piece of floor in this room a reader is ever brought to a stop on (VANTAGES), and it was two staircases overlapping. An inlaid rose makes it a place: six points for the six ways out of a hexagon, two of which are the flights under your feet. Kept inside 7.1, which is where the flanks of both flights stand: a wider ring runs into them at four bearings and reads as a broken circle (and past 8.66 the landing is air — beyond that radius neither flight is under it).
>
> It was laid as hoops and spokes of brass standing half a unit proud of the crown round a dark hub, and from the stair it read as a cartwheel left lying on the bridge ("very unnatural", 2026-10-05). An inlay is LEVEL with what it is let into, and told from it by colour and sheen, never by height. And a rose is points, not spokes: shapes with an area, each lit on one half and shaded on the other, so that they read as facets in a floor that is flat. So: a roundel of the dark polished Purbeck (the Door's shafts) let into the crown; a twelve-point star of brass and pale stone on it, with a brass dial round the star; a ring with a sentence of the Library's cut in gilt between that and the rim; and at the middle, rubbed bright, a hexagon — "the Library is a sphere whose exact center is any one of its hexagons", and this is the one the reader is standing in.
>
> Each piece is a few hundredths proud of what it lies on: enough to keep the two surfaces out of each other's depth (see the well rings), too little for the eye or a foot to find. No two pieces at one height overlap.

Over `const marble = (g) => {`:

> (the marble's figure finer than on the Door's shafts: at their size the shell in it read as terrazzo from the stair)

Over `const beam = new THREE.Mesh(`:

> The crossing stands in the middle of this, so it has to know where it is: from the crown it was the whole frame gone pale (see shaftVolume).

Over `const moonOld = Q.get('wmoon') === 'old';`:

> Where it LANDS. From the floor the column hung in front of the stair as a grey sheet, and light in the air is the weakest way to say light. Laid on the treads it crosses, cut to the beam's own section at the height of each tread, it comes down the stair in steps.
>
> ADDED, a flat grey laid on top of the stone, it was the harshest thing on the bridge ("too harsh and unnatural", 2026-10-05): each tread under the crown a sheet of white paper with a hard outline, the joints between its flags turned blue-grey, because added light lights the mortar exactly as much as the stone. Light MULTIPLIES what it falls on. So it brightens the stone it lands on in proportion to the stone (dst·(1 + k)): the joints stay dark, the stone keeps its warmth, and the edge is a penumbra several units wide, not a cut line. ?wmoon=old is the added sheet.

Over `uColor: { value: new THREE.Color().setRGB(0.84, 0.92, 1.0) },`:

> What it multiplies is stone already lit by the lamps, so a neutral moon would only be more lamplight. Leaning a little cool, it takes the lamp's amber partly back out where it falls: the patch reads as a different light, nearer the stone's own colour. Only a little: a stronger cool cast on warm stone reads as a filter, the teal grade that was turned down.

Over `uK: { value: qNum('wmoonk', echoOld(4) ? 0.8 : 1.3) },`:

> Since the column was begun over the lower arcade (echoFix.js, 4) the light is what it lays on the stair, and the stair has to be the brightest thing in the room: stronger where it falls, and a fainter spill of it carried on down the flight to the floor, which the stand looks up (the lower treads lay outside the column's section, and from the floor the moon lit nothing seen).

Over `const FLOOR = 6, BAYS = 12;`:

> ── Arcades answering arcades ───────────────────────────────────────── What the room is called after, and what it did not have: two storeys of arcade round the well on twelve bays, so that from anywhere in the gallery you are looking through one arch at another, and through that at a third. Without it this was a hexagon of bookshelves with a lamp in it — which is exactly what the Vestibule is, and the two rooms were interchangeable.

Over `const upper = arcade({ foot: FLOOR, top: 43.5, rad: 2.1, rise: 12, band:…`:

> The lower storey springs its arches where the old one did (43.5), level with the crown; the columns are 4.2 across and 8 diameters tall, where the piers were 7.2 across on 10-unit pedestals.

Over `const SCONCE_OLD = Q.get('wsconce') === 'old';`:

> The upper arcade's bays stand open. They once held a low case of books each, on the cornice between the columns; looked up at from the floor they read as cabinets left out in a loggia, not as library. A sconce on every other pier, so the light repeats with the arches. Not `lamp` — its halo is a sprite drawn with depthTest off, and at this size and this close it hangs in front of the arcade as a pale disc. Not on the two piers at the ends of the flight the walk climbs (165° and 345°): the walk steps onto the stair beside one and off it beside the other, a few units from the pier at the height of the eye, and a lit lamp that close sweeping past the lens was most of what made going over the crossing feel like walking into the columns. Since 2026-10-07 a lantern on a console (sconce.js), fixed to a cast plate on the shaft's face; ?wmount=old: held by a band round the shaft instead; ?wsconce=old: the sconce as it was, a rod run through its globe under a pan. The shaft's radius at the plate is the lower storey's, entasis and all: arcade({ foot: FLOOR, top: 43.5, rad: 2.1 }).

Over `globes.push({ p: [p[0], 26.5, p[1]], s: [1.55, 1.55, 1.55], color: '#ffe…`:

> A small opal globe, the hanging lamps' glass (makeLampGlobeMaterial): it was a glow-core, bright nearly to its rim, and from the stand it printed as a flat cream plate stuck on the pier. (And the lamps' hollow halo, which leaves the glass to be seen.)

Over `lamp(add(c, dir(150), 44), { light: 8500, priority: 7, strength: 1.2, po…`:

> (Both with their halos turned down: between them and the moon the upper middle of the stand's frame — the arcade, the room's subject — was milk.) (At 44 since the colonnade came in to 56: at 52 its globe stood in the upper storey's arches.)

### `src/world/rooms/fork.js`

Over `const slim = !forkOld(3);`:

> The waymark stands dead centre of the Fork's view and was the palest thing in the garden: a bare post with two boards. It carries the lantern now — a fork in a path at night is somewhere someone hung a light.
>
> And it said nothing: a plain square pillar under a pyramid, with two blank boards. Now a post that tapers, a moulded cap and a knob on its roof; and boards shaped to point, with the ways cut into them and gilded — THE PAVILION, and under it THE HEART, which is beyond it — and one board newer and paler than the rest, pointing down the road not taken, with nothing written on it. (Since the road not taken goes to the Heart, THE HEART points down it, toward the maze's mouth, and there is no third way to leave blank: ?wfork=old for the three boards.)
>
> (2026-10-09, forkFix.js 3: that pillar was the biggest and palest thing in the Fork's frame, dead ahead, and its boards were blank from both sides — the names faced into the wood. A slim post of weathered timber now, standing back in the lawn between the ways, the names facing out.)

Over `const turned = slim && !garden5Old(3);`:

> (gardenFix5.js, 3: that post was a square black stick. Turned now, in the pergola's timber, under an onion cap; its boards weathered, housed through it, their names cut in.)

Over `plate.rotation.y = (side > 0) === slim ? -a * deg : -a * deg + Math.PI;`:

> (each plate faces OUT of its side of the board: turned the other way, as they were till forkFix.js 3, both faced into the wood and neither side of a board showed its name)

Over `const arm = dir(slim ? WAYMARK.arm : 196), a0 = slim ? 0.5 : 1.6;`:

> An iron bracket off the post, braced, and hung from it a tsuri-dōrō: a six-sided iron lantern, a lattice round paper, under a roof of its own. It was two gilt discs with a glowing egg between them.

Over `point(lp, 20.4, '#ffb866', 180, 4);`:

> (900 when it was an egg of light: it blew the post beside it out to white)

Over `{`:

> The pads, flowers and fish used to be drawn here from the world's stream, and the Pavilion, the mist and the maze are laid out from what they left of it. They have a stream of their own now; this spends the world's exactly as they did, so the maze is still the maze it was.

Over `const FITTING = pavPropsOld(13) ? GB.gold : GB.pavBronze;`:

> (pavilionProps.js, 13: gilt on every column, under every lantern and on the table's lamp, with the finial, was a casino's. The small fittings are bronze; the one bright gold thing here is the finial.)

Over `const ROOF_OLD = propsOld(2);`:

> Both tiers of roof are lathes turned from one curve — flat at the eave, lifting to the ridge — and `soffit` IS that curve. Everything that has to fit under the roof asks it where the roof is rather than guessing, which is how the old rafters came to hang five units below it in open air. (forkProps.js, 2: that curve was a dome's — level at the top, steepest at the eave — and the roof it made was a conservatory's. The roof is tiled now, pavilionRoof.js, on a hollow curve with its corners swept up, and `soffit` asks that roof where it is: `a`, the bearing, because a facet between two hips is lower at its middle than a lathe's ring.)

Over `const arrivalOf = (BR) => {`:

> ── Columns, balustrade, and the seat along it ──────────────────────── The bay the bridge lands in is left open — worked out from where the bridge actually ends rather than written down, because it was written down once and it was the wrong bay.

Over `const PAV_BRACKETS = !pavOld(2);`:

> Over the columns only. With a cluster over the middle of every bay too, seen from below on the bridge the sixteen ran into one another and the band under the eave was a heap of loose blocks; eight, one to a column, repeat, and repetition is what makes joinery read as made. (With the room that leaves, each tier's arms reach further along the eave.) (2026-10-09, pavilionFix.js 2: from the bridge those two tiers of plain boxes, the rafters and a second purlin running through them, and a gilt cube on the front of each, read as stacked lumber. One set to a column now, block and arm in a stepped cross, its arms along the beams.)

Over `for (let k = 0; k < 8; k++) {`:

> the purlin the brackets were put there to hold, and the beam behind them (each on the top blocks of the sets now, where they had floated a little over them and the purlin sat inside the ring of rafter purlins below)

Over `FITTING.add(placed(new THREE.CylinderGeometry(0.18, 0.18, 2.6, 6), lp, 4…`:

> A paper lantern at the eave: lacquered cap and base round the light — small, and burning low. As big as a head and nearly as bright as the lamp on the table they were eight lamps against its one, and "a single pavilion burns warm" is a building lit from inside.

Over `const roof = tiledRoof({ at: PV, kind, light, bronze: !garden5Old(6) });`:

> (gardenFix5.js, 6: the hips' curled ends were the rolls' pale grey on the night, horns — dark bronze now)

Over `if (!paintings) {`:

> and NO pool of light on the ground. Every other lamp in the world lays one — light scattered back off stone or gravel — but the ground under this one is the pond, and water does not scatter light back, it reflects it. A 210-by-190 additive quad of warm haze at y 6.9 is the whole reason the pond read as a lawn: it lay over the water edge to edge, above it and brighter than anything in it, and no amount of work on the surface underneath could be seen through it. What a lamp does to this water is the broken column it lays down towards the eye, and that is the water's own business now (water.js).

Over `const TT = DECK + 6.6;`:

> ── The lamp at the heart of it ───────────────────────────────────── "Where the lamp keeps every future." A low table on four legs with an apron between them, and a standing lantern on it: a base, four corner posts, a cap, and the light held inside a frame rather than loose in the air the way it was.

Over `const shadeTex = tex(paint(128, 128, (g) => {`:

> The table's shade. A lamp stood on a table lights the room above it; the floor round the table is in the table's own shadow, out to about 8 × 12.2 / 4.3 ≈ 23 (its top's radius, by the lamp's height over the floor and over the top). The lamps cast no shadows here, so the brightest thing on the deck was the floor directly UNDER the table, a cream disc round its foot (2026-10-05). Laid as a shade, not drawn as a shadow: a flat core and a penumbra as wide as the lantern is, and not black, because the deck and the columns light it back a little.

Over `if (!pavPropsOld(4)) {`:

> "Its music seems to arrive from all your lives at once" — and nothing in it could make a sound. (Nor can the world: it has none. The copy speaks of the qin waiting instead, since pavilionFix.js 6.) A guqin on the table beside the lamp, on the side the bridge comes from: a long zither in black lacquer, seven silk strings, the thirteen studs of mother-of-pearl along its near edge; on the boards before it, the cushion someone sits on to play it. (pavilionProps.js, 4: from the stand that was a board with a pale stripe. A qin's outline and arched top, its strings and studs where a qin's are, the head out over the table's edge with its pegs and tassels, and a cloth under its tail let down over the rim.)

Over `const foot = bridgeFoot({`:

> (shore.js) a pier of coursed granite under the deck's end, on the footprint and to the top of the slab it replaces, and one broad stone to step up from, its top where the old step's was

Over `FITTING.add(placed(new THREE.CylinderGeometry(0.85, 0.85, 0.22, 8), q, 1…`:

> A capped head, not a brass knob: the walk goes along this rail and a gilt ball on every post came past the eye like a row of melons. (And not a squat pyramid either, which was the nearest, heaviest shape in the Pavilion's frame: a small lacquered bud on a collar.)

### `src/world/rooms/garden.js`

Over `const finial = (p, { r, up }, ground, H, seed) => {`:

> A clipped finial (forkProps.js, 6): a drum of the same hedge, domed by the shears, grown through a hedge's line at `p` and standing `up` over its top `H`. From across the garden a hedge was one level stripe of black from edge to edge of the frame; these are what stands out of it.

Over `const N_SHORE = [1310, 10];`:

> ── The road not taken, taken ──────────────────────────────────────────── It used to fade out across the lawn to the north-west and lead nowhere: a reader walking it on their own came out on bare grass under the Library's blank outer wall. Then it bent round the north of the pond and came down to the far shore, where a second, shorter bridge went out to the Pavilion's north bay. (PATHS keeps the oldest road: the world's stream was spent along it, and still is — the trees, the rocks and the mist stand where they stood, and what a newer road would have stood on is taken up off it.)
>
> Round the pond, it set off from the Fork through the pergola's last post (the pergola runs on to three paces short of the Fork's stone) and went to the Pavilion, where the other way already goes — while from the Pavilion to the maze there was no way at all, only lawn between the bridge's foot and a path that began in the bank. Now the Fork parts the two ways a reader has: the Pavilion straight on, and to the right of it, clear of the post, the road to the Heart, down to where the way from the water turns into the maze, under the two lanterns that stand there facing it. And the bridge's foot has its own way on along the shore (SHORE_WAY). Whichever way the reader takes at the Fork, the Heart is where it goes. (?wfork=old: the road round the pond, and no way along the shore. The second bridge stays, and comes down onto a landing of its own.)

Over `const LANDING = FORK_OLD || !NORTH_OPEN ? null : (() => {`:

> and where the road no longer comes to it, the second bridge's foot stands on gravel all the same: a few paces of it, out past the step to the lawn

Over `const BOUNDARY = [[865, 140], [985, 70], [1030, -20], [1100, -80], [1210…`:

> And the lawn beyond the dressed garden closed off by a hedge, from the Library's wall west of the Fork round the north of the road and the pond and down past the maze to its wall again: outside it there was nothing but grass going on into the dark, and a reader could walk out into it. (Both ends stand in the Library's stone. The trees beyond it are the skyline they always were.)

Over `const old = path === PATHS[3], edging = old ? [] : rocks;`:

> (the old road not taken: its draws, and nothing laid — ROAD is laid below)

Over `if (forkOld(4)) edging.push(stone);`:

> (in groups since 2026-10-09, laid below: these draws spent as they were)

Over `for (const [way, seed, sparse] of [[ROAD, 9127, true], [SHORE_WAY, 9131,…`:

> The road not taken, laid: gravel the width of the old one, edged with stones as it was (half of them gone, a way less walked), from a stream of its own — and the way along the shore beside it, edged all along as the walked ways are, from another. Neither leaves a stone lying on another way's gravel or down the bank into the water (all of each stone drawn first, so the ones after it are the same whether it is laid or not).

Over `{`:

> ── The fork, raked ────────────────────────────────────────────────────── "Every path taken at once" — and the gravel was one flat grey, nothing at the reader's feet saying that the way divides. So it is raked, as a temple garden's gravel is: grooves running the length of each way, and where the ways part, a flat stone with the grooves going round it in rings and leaving by every road at once. A groove is a dark furrow with the gravel it threw up pale beside it.

Over `const offWays = (ways) => (p) => ways.every((o) => lineDist(p, o.pts) >…`:

> The road to the Heart leaves the way to the bridge at a narrower angle than the old road did, and their gravels run together for a few paces past the rings: there its grooves give way to the bridge way's, and it peels off that way's edge rather than crossing it. It is raked to where it meets the way from the water, as far as the old road was raked.

Over `const way = fine(fromStone(pts));`:

> Ruled, they read as a crossing: in passes of a four-tined rake now, each pass wandering and the passes drifting apart and together, and a furrow broken where a stone sits and here and there scuffed out.

Over `const g = gardenRock({ ...FORK_STONE.rock, flatTop: true, detail: light…`:

> (forkProps.js, 3: that was a sawn disc with a groove ruled across it — a puck. A stone now, the garden's granite (shore.js): wider than it is tall, most of it in the ground, cleft and worn and lichened, its top level enough to stand on and no higher over the gravel than a foot goes up without thinking. And the rake goes round the stone it has, not round a compass point: the first ring a hand off its outline, each one rounder, the last the circle the ways' furrows start from.)

Over `{`:

> ── The wisteria pergola, hung with lanterns ───────────────────────────── What the arch opens onto, and what walks the reader from it to the Fork. It was six-sided posts, square beams and a flat card of leaves laid over the top — the rough frame that stood in the old breach as the Door's only arch. Now joinery: each post an octagon on a stone base, a bearing block on its head, a tie beam across with its ends cut to a cloud, curved braces up to the beam and along to the purlins, rafters across the top and battens along them — and the wisteria not painted on a card but hanging, a raceme at a time, from the rafters it has taken over, with the old vines it climbed by twisted up four of the posts. Four paper lanterns in the bays, ribbed and capped.
>
> Laid out in its own frame — x across, y up, z along from the Door toward the Fork — and set on the path here. None of it draws on the world's stream but the four halos, which always did.

Over `const Z0 = 40, BAY = 22, FRAMES = [0, 1, 2, 3, 4].map((k) => Z0 + k * BA…`:

> Four frames. A fifth stood three paces short of the Fork's stone, and from where the reader stops at the Fork its left post stood exactly in front of the stone lantern beyond it (they were at one bearing from there, to within a fraction of a degree); and it was the post the road not taken went through, and the one turned out of the stand's frame because it read as a tree trunk. So the pergola ends a bay sooner, and the Fork is open ground. (?wpergola=old)

Over `rope: garden5Old(4) ? null : VINE,`:

> (gardenFix5.js, 4: it was a grey ribbon of one width)

Over `const HEX = Math.PI / 3;`:

> ── Lanterns ───────────────────────────────────────────────────────────── Tōrō of the Kasuga kind: a six-sided foot under a ring of lotus petals turned down; a round post with a knot at its middle; a platform on petals turned up; the fire box, a paper window front and back and the sun and the moon cut through two more of its sides; a wide six-sided roof whose corners curl up like young fern; and the jewel on top. They were a box, a post and a pyramid, with a glowing egg sitting ON the roof and nothing but air where the fire belongs — a lamp turned inside out. The light is inside now, behind paper, and falls first on the lantern's own stone (flameLit).
>
> Each is built about its own axis (y is the world's) with face 0 of every hexagon at 30° and a corner at 0°, as three's six-sided cylinders have them, then turned and set down. None of it draws on the world's stream but the halo and the pool, which always did.

Over `const roofCorners = ({ R, y0, T, H, lift, top }, rho, tube, ridge) => {`:

> Its hips: a rolled ridge down each, and at each corner the fern — a scroll rising off the tip and rolling back in on itself, tighter as it goes (a ring of even radius left a hole through it and read as a handle).

### `src/world/rooms/silence.js`

Over `{`:

> III — the Silence: "where the stairways stop crossing, a single lamp keeps the dark honest". So the Echo's crossing is here too — and stilled: two flights climb out over the well and, instead of crossing, come to rest on one landing in the middle of it, under the one lamp; five of the six lamps have gone out, and the one that has not is the whole light in the room. (They used to be sheared off in the air a little short of each other, and from the stand that read as a bridge into nowhere, not as a stair that had stopped. Before that it was a lamp, a reader and twelve boxes spiralling into the shaft — the Echo again with the lights down.)

Over `for (let k = 0; k < 6; k++) { rr(-26, 26); rr(50, 74); rot3(); rr(2, 5.5…`:

> The rubble the broken ends used to shed onto the floor is gone with them; its draws stay, because the world's random stream is shared and everything built after this would otherwise be shuffled.

Over `{`:

> And it is a TERRACE: the free edge is carried out toward the room, so there is somewhere up there to stand and look from. As a round floor no wider than the flights' crowns it was a pulpit — the reader on the stool filled it, both flights arrived straight at the stool, and nobody who climbed up could get round it to the rail (between it and either outer newel there was five units, and a reader is eight across). Now the edge is a wider arc whose middle is pushed TERRACE_OUT toward the room; it still springs from the same two newels, so the flights, their dressing and the back of the landing (over the crowns) are as they were — but for the two keystones, which broke up through the paving in an X where the stool used to hide them (`keyThrough`). ?wterrace=old puts the round landing, the reader and the lamp back.

Over `const back = Array.from({ length: 21 }, (_, k) => add(c, dir(A1 + ((A0 +…`:

> A slab, not a drum. As a solid disc down to the arches' soffit, with a cone under it, the landing read as a font or a pulpit standing on the well, and not as the place two flights came to rest. Thin, it is carried out over the well on the flights' own stone. (Behind the newels — over the crowns, between the flights — it keeps the round.)

Over `if (!TERRACE) band(LF - 0.5, LF + 0.6, TOP - 4.3, 0.9, LB.cap);`:

> a fillet under the slab — on the round landing only. The terrace's wider arc turns the ends of its underside to the floor, and from the stand they were two pale lenses hung under it, in the pale stone or the dark (or the slab's own, paler still); without it the slab ends in its string.

Over `const LAMP = silenceOld(1) ? [258, 9, 54] : LAMP_AT;`:

> The one lamp still burning hangs over the landing, just off its middle toward where the flights come in — so what it lights is the place where the stairs stop. (Beyond them it only silhouetted them, and a dark shape over a dark well is not a stair.) With the terrace it hangs HIGHER: at 50 its globe was at the eye of anyone standing up there, nine units off, and filled a third of the view with blown white. At 54 it is out of a level look from anywhere on the terrace, and from the floor it still stands behind the reader's head. (its pool on the landing, where it falls: the floor under it is a well — and on the terrace's middle, not on the lamp's: a pool laid round the lamp itself ran off the back of the landing and hung over the treads) Its globe is the hallway lamps' size, not the galleries' (r 9 is a globe nearly ten units across, made to hang sixty up in a room's air): over a terrace, a head or two above the reader, that size read as a second moon. (hung a body-width clear of the reader's head as the stand sees it: silenceFix.js, 1)

Over `for (const [a, rad, y, r] of [[45, 30, 74, 8], [110, 44, 58, 7], [185, 3…`:

> (the one at 235 hung at 265 until the terrace: from the stand it was straight behind the lit globe and just under it, so through the balusters the two read as one lamp twice the height)

Over `rr(0, Math.PI * 2);`:

> ── The one who has stopped ── A reader on a stool in the middle of the landing, in the one lamp's light, a book open in the lap and the head bowed over it; on the stone beside the stool a second book laid face down, and a candle burnt to a stub in its dish. The only person in the piece who has stopped, in the room that is about stopping. (One used to stand down on the floor by the rail, out of the lamp's reach, where only the top of the hood caught any light: from the stand, a pale egg on the rail. Its draw is kept: the world's random stream is shared.)

Over `const seat = TERRACE ? add(add(c, dir(64), 11.5), dir(253), 3) : c;`:

> On the terrace, out toward its rail, between the lamp and the room: in the middle, where both flights arrive, the stool was the first thing anyone who climbed up walked into, and the rail was behind it. A little to one side, so from the floor the lamp burns beside the head instead of behind it (straight behind, the reader was a black cut-out with a halo), and the rest of the rail is free to stand at. (Drawn back three units from where it was first put, at dir(64)·11.5: there, the feet and the hem of the robe ran on through the kerb and stood out of the terrace's face, a shoe and a dark patch in the stone.)

Over `for (const [i, j, k, strength] of [[0, 0, 2, 1], [0, 0, 5, 0.5], [1, -1,…`:

> Two of them turned down. The one hung in the Vestibule's arch was the brightest thing in the view through it, so the eye stopped in the doorway instead of going on into the Echo; the one past the Silence was warmer than the Silence's own last lamp.

### `src/world/rooms/vertigo.js`

Over `const warmed = new THREE.Color(), litFrom = new THREE.Color('#c88a4c');`:

> Pale vellum and calf near the rim, dark leather down the throat, so the funnel falls away in value before any lamp says how deep it is. Chosen by where a book stands rather than drawn: every draw here belongs to the garden (see `resume`), and the draws the old colours made are still made.
>
> Pushed further than it was: more vellum at the rim and black sooner, so the fall in value is the first thing the funnel says — and then, in the last turns, the books warmed again by the light they stand over.

Over `const vr = makeRng(0x7e5d1);`:

> Real books round the rings (2026-10-06): the giants here were 12-18 tall and 9 deep. A ring is shelved bay by bay, from bearing `from` to `to` (degrees), in sets of a binding's volumes standing on `sy` with `clear` over them, their spines a finger's breadth behind the shelf's face at radius `rf`; coloured where a set starts, as the giants were where they stood. On a stream of their own: every draw on the world's here belongs to the garden (see `resume`).

Over `const resume = stream.seed;`:

> ── The funnel ── Below the floor the pit narrows 460 down to a throat of light, lined the whole way with shelves set back into its stone. The stair winds down the face of them on a carved carriage bracketed into the wall, its open side railed in bronze — but for the one place, a few steps down, where the rail has given way and the fall begins (and, since 2026-10-08, the same place on every turn below it: spiral.js GAPS). Lamps hang in the well at every depth, so that looking down there is something to measure the drop by, and loose pages turn slowly all the way down it. (A smooth brown cone with a disc of light at the bottom had nothing in it to say how far down the light was.)
>
> All of this draws on the world's random stream far more than the plainer funnel did, and the garden is laid out from that same stream: `resume` puts the stream back where the old funnel left it (see the end).

Over `const h = k < 4 ? Math.abs(Math.sin(p[0] * 39.346 + p[1] * 11.135 + y *…`:

> On the four shelves nearest the head of the stair, shelved by hand: one taken out here and there, others leaning into the room it left, some pushed to the back. Every book stood upright at one depth read as rings of bricks. Decided by where the book stands — the draws above are the garden's (see `resume`), all still made.

Over `const wall = shelvedWalls.n++;`:

> Real books: four shelves of quartos to the giants' one, each a little wider round than the one below it as the funnel opens upward, between the uprights. Boxes in the seven rings the stair's head looks across and down into; deeper, where the funnel is only ever looked down into from far above, painted, and taken down in value and warmed by the light below as the giants' colours were.

Over `const trial = LAMPS.sconce && stairSconce({ wall: add(c, dir(la), rf - 0…`:

> a small lantern on a wall bracket (lampPass.js; ?wlampsoff=sconce: as it was)

Over `const pk = BOOKS_GIANT ? 1 : 0.42, pl = BOOKS_GIANT ? 1 : 0.76;`:

> (folios of 47-66 cm by 34-43, 10-18 thick, as the giants were; at their real size since 2026-10-06, the draws as they were)

Over `color: pick(['#8a6a48', '#7a5c40', '#6e5a44', '#5f6452', '#7a4a3a']), k:…`:

> lying down, a book shows its cover in the bindings' dark side tone: shelf leather there read as a hole in the stair, so paler calf

Over `const roll = (t) => {`:

> A roll moulding along the top of the open string and a fillet under it: the edge the eye crosses first, looking down, was a plain square arris.

Over `const LAND0 = 153;   // where the rim stops: a corner of the floor's 80-…`:

> The stair's head (2026-10-07: "the staircase has a weird hole that makes it look unsafe"). The stair's first tread begins at 166.5°, but the rim round the mouth stopped at 153°: for a stride beside the newel the floor just ended over the drop, nothing to stand on, nothing to hold. The floor now runs on over the pit to the first tread as a landing, carried on the stair's own carriage swept back level under it, and the rim turns in along the landing's end and runs on along its open edge to the newel. (?wvland=old: the head as it was.)

Over `hanging.forEach(([b, off, y, r], i) => lamp(add(c, dir(b), off), {`:

> (The nearest a step down from the rest — the brightest thing in the frame should be the light at the bottom — and all of them on a chain of half the gauge: from the stand the old one was the heaviest line in the picture, cutting it from the corner to the middle.)

Over `const sink = BRINK_OLD ? null : { halos: [], shaft: null, glow: null, wi…`:

> The light is never reached on foot. Walked down toward it, the disc in the throat keeps 420 below the eye (`tick`) — and since 2026-10-08 the rest of the light goes down with it, the hot core, the glow over it, the column standing up from it and the light it throws: before, only the disc went, and a reader walking on down the endless turns passed the glow, hanging in the well at the depth the light had been, and looked back up at it. However far down they walk, the light below looks as it did from the stair's head. (?wbrink=old: as it was.)

Over `const leaf = keep(new THREE.PlaneGeometry(4.2, 5.6, 8, 4));`:

> A page, not a card: printed, curled at its corner as well as across, and lit through — paper this thin holds the lamp's light in it. As a plain pale quad it was the brightest thing in the well and read as a sticker on the frame.

Over `const pages = Array.from({ length: light ? 10 : 22 }, () => ({`:

> Twenty-two, not forty-four. Loose pages are a lovely idea and at that count they were a blizzard: white flecks over every part of the frame, so the well had no quiet anywhere in it.
>
> And seven, not twenty-two: fewer, half as large again, falling and turning at a little over half the pace — a page drifting down, not flecks of white crossing the frame. (Twenty-two are still drawn from the stream: the garden is laid out from it, see `resume`.)

### `src/world/rooms/vestibule.js`

Over `const soffit = [];`:

> "A bridge of stone carries a file of readers across the dark on its own arch" — so it has one. A segmental arch springing off the lip of the well at ±44, two courses thick at the crown and eight at the springing, with the deck laid over it. It was a flat slab 110 long and 6 thick, and being the first thing seen in the first room it was a quarter of the frame of untextured brown.

Over `if (Math.abs(u) === 52) LB.bronze.add(placed(new THREE.SphereGeometry(0.…`:

> A ball only where the rail ends. One on every post was a row of knobs along the bridge, a toy's rail; between, a collar where the rail passes over the post.

Over `for (let k = 0; k < 4; k++) { rr(-2, 2); rr(-1.2, 1.2); rr(0, Math.PI *…`:

> A FILE of readers, not a queue. Seven at thirteen apart stood shoulder to shoulder across the whole width of the frame — a row of near-identical dark blobs with no gap to see the bridge, the arch or the far side through. Four, spread down the length of it, read as people crossing: the eye gets between them, and the bridge gets to be a bridge. They walk it now (walkers.js, built under the lectern below). Their old places' draws stay: the world's random stream is shared, and everything built after this would otherwise be shuffled.

Over `const BRIDGE_HAZE = vestOld(6) ? 1 : 0.45;`:

> Low, and only these two: "two lamps keep the gap they cross". Hung at lamp height with the rest they lit the whole hexagon evenly and the room became the same room as the Echo — these sit just above the readers' heads, so the bridge is an island of light and the gallery falls away. (their pools laid on the floor, as the reading corner's is: at the default 6.6 they drew a pale sock round the foot of every leg in the room) (their halos turned down as the lamps by the other stands are: at the full 111 units across, the near one's laid a pale band down the whole bay of shelves behind it, from the top of the frame to the rail, which read as a smear on the lens — review 2026-10-08, point 6)

Over `{`:

> The card catalogue, at the other end of the wall with the reading table: six drawers across and seven high, each the size a drawer of index cards is (15 × 11 cm), with a brass frame for its card and a pull under it, the case on a stand with the reference slide drawn out. (It had four drawers across and six high, 26 cm wide, with 10 cm labels: from the floor it read as a chest of drawers, and the labels as pale tiles.)

Over `const TURNS = light ? 11 : 18, SEG = light ? 24 : 36, PITCH = 38, R0 = 9…`:

> Nine turns, each 38 high and 12% narrower than the last: from the wall tops to a throat a third as wide, 340 up. SEG treads to a turn. Every turn is the turn below it made smaller: 12% narrower, 12% lower, its shelves, books, rail and lamps all 12% smaller. So the turns do not stop — they close in on a point 290 up, books to the last of them, the way a picture of a library inside a picture of that library does. (Built at one size and faded into black, the top of it was a dark lid, and the reader could see where the library ended.)

Over `if (i < SEG) {`:

> In the first turn the tread climbs away from the wall tops, and the bookcase under it — down to the stone — was a bare dark board as tall as the whole bay by the end of the turn. It gets shelves too.

Over `const n = Math.max(1, Math.round(room / (4.1 * f))), pitch = room / n, r…`:

> Real books (2026-10-06): a giant's shelf here is three or four of quartos, each a painted row of them (bookRows) set down whole. Seen from the floor, a hundred and more below, a book is a pixel or two across; boxes for them all were tens of thousands.

Over `put('rows', at(rf, a, sy + clear / 2), inn, [wr, clear, 1], tint('#fffff…`:

> (twice the fade the boxes took: the boxes' labels, lift and gilt in the books' shader carried them, and the bare paint at the same fade read as half as bright)

### `src/world/rooms/web.js`

Over `if (!paintings) {`:

> ── The heart: a court, not a cell ──────────────────────────────────── The heart was one cell of the grid, a corridor with a hedge on either hand, and the walk ended in it facing a plinth, the way a dead end does. It is the nine cells round it now, cleared into one court, with a way in on each of its axes: the one the reader comes by, and three for the others (finale.js). Any other way into the court is closed, where the maze can spare it — every cell must still be reachable from the entrance. (Knocked through after the maze is grown, so the world's stream is spent exactly as before.)

Over `const niches = [];`:

> (gardenFix5.js, 10) Either side of where the reader stops for the Web of Time — the cell before the court's way in — the hedge was a blank leaf wall a pace off. A niche is clipped into each, with a small iron lantern hung in it on a crook, lit — the two of them a gate before the court — and in the wider one a stone seat beside its lantern.

Over `point(HEART, 28, '#ffc77e', 2600, 5);`:

> (3800 and a pool of 0.34 until 2026-10-05: the pale paving printed as one even cream stage against black hedges — the middle of it so far up the tone curve that the fall-off toward the kerb was squeezed out of it. Down a third, the light is seen to come FROM the armillary and fade.)

Over `{`:

> And in it, the garden of forking paths: brass let into the paving, three lines out from the plinth that divide at every ring of stones, and divide again, twenty-four ways to the kerb. It was bright, even paving with nothing drawn on it, under the one place the finale's light floods; now the flood has the paths to run along.

Over `if (webOld(7)) {`:

> An armillary of gold rings turning over a stone plinth — the size of a thing a court is built round now, not of a thing on a desk: the rings were 5 to 6.4 across and read, at the end of the walk, as a toy.

Over `const { stone, gold } = pedestalGeometry();`:

> A carved stand (webFix.js, 7): three plain cylinders under the most richly made thing in the garden read as a drainpipe under a clock. A stepped plinth, a moulded base, a shaft reeded at foot and head, an ovolo capital; and between the reeds, in two rings of gilt capitals, the sentence the map says when the walk is over — its middle turned to the way in.

Over `armillary = new THREE.Group();`:

> An instrument, not three hoops. Three plain gold rings on a stalk had less to them than a lamp, and they were the last thing the walk shows. Now: the meridian, standing, its rim cut in degrees, with the polar axis through it at the latitude of the place; the equator, ticked in hours; and the ecliptic, a broad band with the twelve signs let into it — dark bronze, and the gilt only in what is cut into it. A seed of light where the axis crosses. (Each ring is still the child it was: the turning in tick and the finale's spin ask for them by place.)

Over `const ringed = (group, which, hoop, teeth, opts) => {`:

> (webProps.js, 3: the degrees and the hours were those `ticks`, gilt blocks stood out from the rims of round hoops, and the rings read as gears. Flat bands now, the scale let into their faces.)

Over `const e = edgeFrame(DOOR, 5);`:

> Mats of it over the first bays of the pergola. (They lay across the old breach at the height of the arch, where they floated in the opening as loose leaves; same draws, laid out beyond the wall.)
