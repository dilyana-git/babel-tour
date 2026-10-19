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
import {  } from './vertigoProps';
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
import { lightRooms, tintRooms } from './roomColour';
import { buildWellsBelow, OPEN_WELLS } from './wellsBelow';
import { buildShelvesAbove } from './shelvesAbove';
import { buildLibraryFace } from './libraryFace';

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

// The world, built section by section: named yields announce each section,
// unnamed yields let its longer loops pause, and the return value is the world.
// `painter` hands out the
// PAINTED surfaces (paint.js); without one they are painted here and now.
export function* assembleWorld({ light = false, paintings = true, painter = paintNow(PAINTED), lights = null, onRoot = null } = {}) {
  const ctx = { light, paintings, painter, lights };
  Object.assign(ctx, yield* buildKit(ctx));
  yield 'Materials';
  Object.assign(ctx, buildMaterials(ctx));
  onRoot?.(ctx.root);
  yield 'The honeycomb';
  Object.assign(ctx, buildHoneycomb(ctx));
  yield 'The dressing on a flight';
  Object.assign(ctx, buildFlightDressing(ctx));
  yield 'The books on a wall';
  Object.assign(ctx, buildBooks(ctx));
  yield 'Furniture';
  Object.assign(ctx, yield* buildFurniture(ctx));
  yield 'The Vestibule';
  Object.assign(ctx, buildVestibule(ctx));
  yield 'The Echo';
  Object.assign(ctx, buildEcho(ctx));
  yield 'The Silence';
  buildSilence(ctx);
  yield 'The Vertigo';
  Object.assign(ctx, yield* buildVertigo(ctx));
  // (each gallery's flame on its lamps, once the four are up and before the
  // globes are instanced with the Door's: roomColour.js)
  lightRooms(ctx);
  // (the galleries' face on the garden, and the lanterns behind it: before the
  // Door, whose globes the lanterns' panes are instanced with — libraryFace.js)
  Object.assign(ctx, buildLibraryFace(ctx));
  yield 'The Door';
  Object.assign(ctx, buildDoor(ctx));
  yield 'The arch';
  Object.assign(ctx, yield* buildArch(ctx));
  yield 'The garden';
  Object.assign(ctx, buildGarden(ctx));
  yield 'The fork, raked';
  buildForkRaked(ctx);
  yield 'The wisteria pergola, hung with lanterns';
  buildPergola(ctx);
  yield 'Lanterns';
  Object.assign(ctx, buildLanterns(ctx));
  yield 'The Fork';
  Object.assign(ctx, yield* buildFork(ctx));
  yield 'The Web';
  Object.assign(ctx, buildWeb(ctx));
  yield 'Trees';
  Object.assign(ctx, yield* buildTrees(ctx));
  yield 'Mist on the grass';
  Object.assign(ctx, yield* buildMist(ctx));
  yield 'Light';
  Object.assign(ctx, yield* buildLight(ctx));
  yield 'The unexplored';
  Object.assign(ctx, yield* buildUnexplored(ctx));
  yield 'What a reader at eye level cannot see';
  Object.assign(ctx, yield* buildCulling(ctx));
  yield 'What the camera and the overlay need';
  Object.assign(ctx, buildOverlay(ctx));
  yield 'Where a reader stands, and the ways on';
  Object.assign(ctx, buildStands(ctx));
  yield 'The crossing, over the middle of the Echo';
  Object.assign(ctx, buildCrossing(ctx));
  yield 'Where the walk has worn the floor';
  buildWornFloor(ctx);
  yield 'What the water has to look at';
  buildWaterView(ctx);
  yield 'How the walk ends';
  const world = yield* buildEnding(ctx);
  // (each gallery's stone, wood and metal, on top of every other patch: roomColour.js)
  tintRooms(ctx);
  // (the face that goes when it is looked at: libraryFace.js)
  const tick = world.tick;
  world.tick = (t, eye, gaze, ...rest) => { ctx.libraryFace.tick(t, eye, gaze); return tick(t, eye, gaze, ...rest); };
  world.face = ctx.libraryFace;
  yield 'The galleries below';
  // (the storeys under the Vestibule's and the Silence's wells, last, so they
  // see every patch on every material: wellsBelow.js)
  const below = yield* buildWellsBelow({ root: ctx.root, keep: ctx.keep, levels: light ? 1 : 3,
    wells: Object.entries(OPEN_WELLS).map(([cell, shaft]) => ({ c: ctx.cellC(...cell.split(',').map(Number)), shaft })) });
  yield 'The shelves above';
  // (over the Echo and the Silence their walls go on up, every shelf full:
  // shelvesAbove.js; after the storeys below, which are not to copy them)
  const above = yield* buildShelvesAbove(ctx, { levels: light ? 3 : 8 });
  const cull = world.cull;
  world.cull = (eye, ...rest) => { below.show(eye); above.show(eye); return cull(eye, ...rest); };
  world.below = below;
  return world;
}
