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
// Vertigo's funnel, the pergola, the Pavilion bridge, the maze — which World.jsx
// walks. With `paintings` (the plate tour, ?plates) each room instead holds its
// Midjourney plate on its far wall, and the camera flies down to it.
//
// Units are pixels of the old overhead render's 1440 × 900 frame: x to the
// right, z down the frame (toward the camera), y up.
//
// The world is built a section at a time (assembleWorld, below): the
// Library's materials and its honeycomb first, then each room in the order of
// the walk (src/world/rooms/), then the garden's grounds, the light, and the
// ways a reader walks (src/world/build/). Each section is a function handed
// `ctx`, everything the sections before it made, and returns what the ones
// after it need, which is added to `ctx`. They run in the order they always
// did and draw from one random stream (`rnd`), so moving a call reorders the
// world: leave the order alone.

// (two modules change three.js's shader chunks when they are first evaluated,
// and the world's materials are compiled against what they leave: the
// Vertigo's well grade, then the light model — in that order)
import './vertigoFix';
import './lightModel';
import { paintNow } from './paint';
import { PAINTED } from './build/common';
import { buildKit } from './build/kit';
import { buildMaterials } from './build/materials';
import { buildHoneycomb, buildFlightDressing } from './build/honeycomb';
import { buildBooks, buildFurniture } from './build/shelves';
import { buildVestibule } from './rooms/vestibule';
import { buildEcho } from './rooms/echo';
import { buildSilence } from './rooms/silence';
import { buildVertigo } from './rooms/vertigo';
import { buildDoor, buildArch } from './rooms/door';
import { buildGarden, buildForkRaked, buildPergola, buildLanterns } from './rooms/garden';
import { buildFork } from './rooms/fork';
import { buildWeb } from './rooms/web';
import { buildTrees, buildMist } from './build/grounds';
import { buildLight, buildUnexplored, buildCulling, buildOverlay } from './build/light';
import { buildStands, buildCrossing, buildWornFloor, buildWaterView, buildEnding } from './build/walk';

export { FRAME, MASS_H, CAP, PAINTED } from './build/common';

// Built in one go, as it always was. World.jsx builds it a section at a time
// instead (assembleWorld below), so the page can breathe and say how far along
// it is while the Library goes up.
export function buildWorld(options) {
  const steps = assembleWorld(options);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

// The world, built section by section: it yields between them (the name of the
// one it is about to start) and returns the world. `painter` hands out the
// PAINTED surfaces (paint.js); without one they are painted here and now.
// `ahead`, if given, is handed whatever has been made to be drawn by the time
// of each yield — what the root holds by then, and a stand-in for each batch
// still being filled (build/materials.js, Batch) — so that its shaders can be
// started while the rest is built (assembly.js, makeWarmer).
export function* assembleWorld({ light = false, paintings = true, painter = paintNow(PAINTED), ahead = null } = {}) {
  const ctx = { light, paintings, painter, ahead };
  let offered = 0;
  const offer = () => {
    const kids = ctx.root?.children;
    if (!ahead || !kids) return;
    for (; offered < kids.length; offered++) ahead.push(kids[offered]);
  };
  Object.assign(ctx, buildKit(ctx));
  for (const [name, section] of SECTIONS) {
    offer();
    yield name;
    Object.assign(ctx, section(ctx));
  }
  offer();
  yield 'How the walk ends';
  return buildEnding(ctx);
}

// In the order they always ran (and the world's stream is drawn in): each
// section's name, and the section.
const SECTIONS = [
  ['Materials', buildMaterials],
  ['The honeycomb', buildHoneycomb],
  ['The dressing on a flight', buildFlightDressing],
  ['The books on a wall', buildBooks],
  ['Furniture', buildFurniture],
  ['The Vestibule', buildVestibule],
  ['The Echo', buildEcho],
  ['The Silence', buildSilence],
  ['The Vertigo', buildVertigo],
  ['The Door', buildDoor],
  ['The arch', buildArch],
  ['The garden', buildGarden],
  ['The fork, raked', buildForkRaked],
  ['The wisteria pergola, hung with lanterns', buildPergola],
  ['Lanterns', buildLanterns],
  ['The Fork', buildFork],
  ['The Web', buildWeb],
  ['Trees', buildTrees],
  ['Mist on the grass', buildMist],
  ['Light', buildLight],
  ['The unexplored', buildUnexplored],
  ['What a reader at eye level cannot see', buildCulling],
  ['What the camera and the overlay need', buildOverlay],
  ['Where a reader stands, and the ways on', buildStands],
  ['The crossing, over the middle of the Echo', buildCrossing],
  ['Where the walk has worn the floor', buildWornFloor],
  ['What the water has to look at', buildWaterView],
];
