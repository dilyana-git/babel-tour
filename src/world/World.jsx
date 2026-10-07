// ── The world, live ──────────────────────────────────────────────────────────
// The carved honeycomb and the garden of buildWorld.js, lamps breathing, dust
// and fireflies drifting — first as the map, then as the place itself.
//
// At rest the camera is tilted down over the whole walk and framed to fill the
// window. The overlay (hit areas, the walk, the names) is projected through
// that same camera and handed to EntryMap as screen pixels (onLayout), so it
// stays on the stone at any window shape.
//
// `target` says where the camera should be: null for the map, or a room. The
// camera gets there by the way the place allows:
//   map → room    a flight down through the open roof to where a reader stands
//   room → room   a walk (buildWorld's `legs`) through the hallway, over the
//                 Echo's stair, along the pergola, across the bridge, into the
//                 maze — or, between the Vertigo and the Door, the fall down the
//                 funnel into light (and the climb back out of it)
//   inside a room a climb to its vantage and back down (`vantage`, buildWorld's
//                 VANTAGES: the crown of the Echo's crossing)
//   room → map    the flight back up
// and says so with onSettle(room, atVantage). While standing, `lookRef` turns
// the head.
//
// Those are the piece's walks, and the HUD's buttons ask for them. The keys
// are the reader's own: W commits a course and S steps back,
// over any floor the world has (body.js) — up the Echo's stair, round the
// pond, into the honeycomb's hallways — and the piece only reports where that
// has taken them (onRoam: the room, or the two rooms a hallway joins). Held
// Looking over the Vertigo's inner rail invites the fall; walked into the court at the
// heart of the maze, the finale (onGo). Ask for one of the piece's walks from
// out there and it sets off from wherever the reader has got to.
//
// With `rooms` false (the plate tour) the flight ends at the room's painting
// and onArrive hands the reader on just before it lands.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, N8AO, ToneMapping, Noise, wrapEffect } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { SPIRAL, spiralAt, railIntent } from './spiral';
import { assembleWorld, PAINTED } from './buildWorld';
import { makePainter } from './paint';
import { GradeEffect, gradePlace } from './Grade';
import { SanitizeEffect } from './Sanitize';
import { EdgeAAEffect } from './EdgeAA';
import { makeSky } from './sky';
import { TILT_FOV, framePointsOf, restPose } from './plan';
import { prepareEnvironment } from './effects';
import { probeClearance, probeRay } from './probe';
import { GLASS } from './mirror';
import { makeBody, EYE, ROOM_STAND } from './body';
import { makeWalkCurve, makeWalkPace } from './walkPath';
import { pendingFinale } from './finaleLifecycle';
import { WATER } from './water';
import { DPR_MAX, LIGHT_MESH } from '../capability';
import Governor from '../Governor';

const Grade = wrapEffect(GradeEffect);
const Sanitize = wrapEffect(SanitizeEffect);
const EdgeAA = wrapEffect(EdgeAAEffect);

// The air. Over the map, a long cool fall-off into the dark at the honeycomb's
// edges; down among the walls, a near haze that swallows the corridor of
// galleries beyond — cool, as the distance is in every one of the plates —
// and a bluer, longer one out in the garden.
// ── The palette ──────────────────────────────────────────────────────────────
// 2026-09-25 the Library was re-keyed to the isometric Midjourney batch the
// user named as its inspiration: gold lamplight rather than brown. The print
// before it was keyed to the painted plates (chroma held near 0.26 to 0.5) and
// measured against the new frames it read as brown light on black: warm hue
// ~16-29 where they sit at ~33-36, warm saturation 0.45 against 0.65, median
// luminance 0.10 against 0.20, 34% of the frame crushed against 5%.
//
// NO TEAL. The first cut also took the frames' teal shadow — an added tint in
// the dark, a teal fog, a cool sky fill, cool occlusion, sage stone — and the
// user rejected it the same day: "looks like an Instagram filter, unnatural".
// Indoors nothing casts blue; the warmth has to come from the lamps and the
// dark stays the dark. ?wpal=old prints the old way, for comparison.
const OLD_PALETTE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wpal') === 'old';
// ?wlight=old: the hard lamplight of before 2026-10-01 (see buildWorld's
// LAMP_DECAY) — and with it the lower fill and the brighter print it was
// graded under. (The print came down twice that day, 1.2 → 1.1 with the
// softer lamps and → 1.0 when the reader asked for it dimmer still.)
const HARD_LIGHT = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wlight') === 'old';
const MAP_FOG = new THREE.Color('#06080c');
const LIBRARY_FOG = new THREE.Color(OLD_PALETTE ? '#14171c' : '#15130f');
const GARDEN_FOG = new THREE.Color('#0b1318');
const PIT_FOG = new THREE.Color('#171009');
const logLerp = (a, b, t) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);

const EYE_FOV = 50;      // before a painting (the plate tour)
const ROOM_FOV = 58;     // standing in a room
const FLIGHT_S = 3.8;
const RISE_S = 3.4;
const FALL_S = 7.2;
const LEAN_FOV = 68;     // leaning out over the Vertigo's well
const FALL_FOV = 92;     // at full speed down it
// A reader is 18 units tall, so a unit is about 9.4 cm: 18 is a comfortable
// 1.7 m/s walk. The body takes a
// moment to gather the stride and to put it down (WALK_GATHER), and slows into
// the room over the last stretch (WALK_BRAKE) rather than stopping dead.
const WALK_SPEED = 18;
const WALK_GATHER = 0.7;   // seconds to reach a stride from standing, and back
const WALK_CHECK = 0.3;    // ...and to slow for a bend: a walker checks faster than they set off
const WALK_STOP = 0.2;
const WALK_BRAKE = 26;     // units out from the end the body begins to slow
const STRIDE = 7.5;        // about 70 cm per step
// Walking where the reader looks (the free walk, body.js) goes at the same
// pace as the piece's own walks, and backs away at half of it: a step back is
// a step back, not a reverse gear.
const BACK_SPEED = 9;
// Sustained looking inward and down near the rail commits the descent.
// A shorter peek can be cancelled by looking away.
const LEAN_S = 1.25;
// ── A guiding hand ───────────────────────────────────────────────────────────
// Walking on their own, a reader who is plainly about to walk into something
// is turned aside before they do: the body feels ahead along the way they face
// and either side of it (body.js, `clearance`), and if the way is shut within
// STEER_LOOK and a way a little to one side is open, the head is turned toward
// it — gently, harder the nearer the wall, never against the reader's own
// hand (a held A/D or a drag has the head to itself). A doorway steers itself:
// aimed at the jamb, the way through it is the open one. Where nothing is
// open the feet slow into the wall rather than walking into it at a stride.
// ?wassist=0 walks without it; ?wassist=2 doubles it.
const ASSIST = typeof window === 'undefined' ? 1
  : Math.max(0, Number(new URLSearchParams(window.location.search).get('wassist') ?? 1) || 0);
const STEER_LOOK = 34;       // how far ahead the way is felt (about three seconds' warning)
const STEER_NEAR = 8;        // this close, the hand is at its firmest
const STEER_TRIES = [0, 15, -15, 30, -30, 50, -50, 75, -75].map((a) => THREE.MathUtils.degToRad(a));
// What a turn costs, in units of open way per radian: a way has to be that
// much more open than straight on to be worth turning to, so of two open
// ways the nearer the reader's own wins.
const STEER_COST = 8;
const STEER_RATE = 0.7;      // rad/s at the firmest — a little under the keys' own 0.9
const STEER_GAIN = 2.5;      // rad/s per radian still to turn, so it eases onto the new line
const STEER_SLOW = 0.5;      // how much of the stride is taken back walking into a dead end
const UNGUIDED = Object.freeze({ turn: 0, keep: 1 });
// Walking on their own, a reader stands off what is in front of them rather
// than walking up until the stone fills the frame (body.js, `keepRoom`):
// ROOM_STAND units, about 85 cm. ?wroom=12 stands them 12 off; ?wroom=0 lets
// them walk right up to it, as far as the body's own RADIUS.
const ROOM = (() => {
  const v = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('wroom');
  return v === null ? ROOM_STAND : Math.max(0, Number(v) || 0);
})();
// Doorways that open somewhere else (doorway.js): the Vestibule's way in
// opens onto the Echo. ?wdoor=0 walks into the bare hexagon behind it instead.
const DOORS = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('wdoor') !== '0';
// ── The way, by default ──────────────────────────────────────────────────────
// Holding W, the reader is walked along the piece's own way (buildWorld's
// `legs`, as the buttons walk it) for as long as they do not deliberately
// leave it: the feet stay on its centreline, and the head remains free.
// Release W, look elsewhere and press W again to choose another course.
// Coming back onto the path, heading along it either way, resumes the walk.
// Crossing sideways remains independent.
// From a room's stand, a reader who has not turned away from the view the
// room was composed for is walking on. ?wfollow=0 walks without it.
const FOLLOW = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('wfollow') !== '0';
const ROUTE_STEP = 2;        // the way, sampled every this many units
const FOLLOW_AHEAD = 14;     // how far ahead along the way the head is turned to
const FOLLOW_STRAIGHT = 0.55; // keep the feet close to the centreline through corners
const FOLLOW_CAPTURE = 2;    // rejoin only when walking along the actual path
const FOLLOW_LOSE = 26;      // pushed this far off it, it lets them go
const FOLLOW_RISE = 7;       // and not a way above or below them (the Echo's crossing, over the floor)
const FOLLOW_CONE = THREE.MathUtils.degToRad(35);   // inside it, along the way; outside, off it
const FOLLOW_UNTURNED = THREE.MathUtils.degToRad(20); // turned less than this from a stand's view: walking on
const FOLLOW_RATE = 1.2;     // rad/s at most — the way turns the head a little faster than the keys
const FOLLOW_GAIN = 2.2;     // rad/s per radian still to turn
// A bend is seen coming. The way the head is turned to is not only the point
// the feet are making for but, blended in by FOLLOW_ANTICIPATE, the way the
// line runs further on (FOLLOW_SEE_FROM to FOLLOW_SEE_TO along it): the turn
// begins a good few strides before the corner and is spread round it, where
// aimed at a point fourteen on it began only when the corner was underfoot and
// then swung the head through it at full rate. (Not where that further way
// runs into a wall within FOLLOW_SEE_CLEAR: the zigzag's corners.)
const FOLLOW_ANTICIPATE = 0.6;
const FOLLOW_SEE_FROM = 10, FOLLOW_SEE_TO = 26, FOLLOW_SEE_CLEAR = 10;
// And the head does not snap from still to turning, or from turning one way to
// the other: how fast it turns eases toward what is asked over TURN_EASE (s).
// With FOLLOW_GAIN that settles a turn without swinging past it.
const TURN_EASE = 0.15;
// The feet keep their stride while the head is within FOLLOW_EASY of the way;
// past it they wait for the head, more the further it has to come round.
const FOLLOW_EASY = 0.35;
// And slow for a bend as a walker does: never faster than turns the head
// FOLLOW_COMFORT (rad/s) on the tightest of the way from a few steps back to
// FOLLOW_SLOW_AHEAD on — one slowing for a whole S-bend, not one for each half
// — and down to FOLLOW_SLOWEST of a stride at the foot of the Echo's stair,
// where the way turns a right angle in eight units. The head itself turns no
// faster than FOLLOW_COMFORT either, unless the way is well round behind it.
const FOLLOW_COMFORT = 0.8;
const FOLLOW_SLOW_AHEAD = 20;
const FOLLOW_SLOWEST = 0.22;
// ...slowing as a walker does, just enough and no sooner: from FOLLOW_BRAKE
// (units/s²) it reaches the bend's own pace exactly at the bend.
const FOLLOW_BRAKE = 22;
// The aim itself is let settle over FOLLOW_AIM_EASE (s), so a step of the way's
// sampling, or a bend coming into view, never jogs the head.
const FOLLOW_AIM_EASE = 0.15;
const FOLLOW_ROUND = THREE.MathUtils.degToRad(120);  // a turn this long keeps to the side it began on
const ARRIVE_AT = 0.9;
const FILL = 1.12;
// ── The key ──────────────────────────────────────────────────────────────────
// What the frame is printed to. The plates this world answers to measure:
// median luminance 0.21-0.30, saturation 0.34-0.52 (0.21-0.43 at the centre),
// the top 5% reaching 0.54-0.62, about 1% of the frame blown out at a lamp and
// 2-8% down in the dark. Every number here was swept against those.
const GRADE = OLD_PALETTE
  ? { saturation: 0.56, contrast: 1.1, lift: 0.03, exposure: 1.06, shadowTint: [0, 0, 0], gold: 0, shadowChroma: 1 }
  : { saturation: 0.7, contrast: 1.08, lift: 0.03, exposure: HARD_LIGHT ? 1.2 : 1.0, shadowTint: [0, 0, 0], gold: 0.18, shadowChroma: 0.5 };
const BLOOM_THRESHOLD = 0.72;   // a lamp is a light, and light bleeds
const BLOOM_INTENSITY = 0.85;
// The fill: what light there is that no lamp accounts for. Held low down among
// the walls — the lamps have to do the modelling, or every room is one flat
// beige — and opened right up over the map, where the moon carries everything.
// (Down among the walls it came up by 30% on 2026-10-01, when the lamps were
// softened: the lamps still model the rooms, but what they do not reach is
// no longer black beside what they do.)
const FILL_UP = HARD_LIGHT ? 1 : 1.3;
const FILL_MAP = { env: 0.75, hemi: 2.0, moon: 2.6 };
const FILL_EYE = { env: 0.84 * FILL_UP, hemi: 0.95 * FILL_UP, moon: 0.95 };
// Out in the garden there are no lamps to speak of and the moon is the whole
// light — it has to carry a scene the way six lamps carry a gallery.
const FILL_GARDEN = { env: 1.6 * FILL_UP, hemi: 1.9 * FILL_UP, moon: 3.0 };
// Over the map the sky is the moon's; down in a gallery, what comes down the
// shaft has bounced off warm stone all the way, and a cool sky colour there put
// a cold cast on every floor in the Library.
const MAP_SKY = new THREE.Color('#7f97a6');
const LIBRARY_SKY = new THREE.Color('#8e8880');
const GARDEN_SKY = new THREE.Color('#6d88b8');
// The bounce: warm off the Library's floors, cold off wet grass under a moon.
const LIBRARY_BOUNCE = new THREE.Color('#5b432f');
const GARDEN_BOUNCE = new THREE.Color('#25333f');
// How fast the head turns on a held key. Slowed from 1.6 (92 degrees a second)
// on 2026-09-22, for the "flickering around the edges when I move" that is the
// last of the blinking.
//
// The composer owns the render, so the canvas's own `antialias` is inert.
// EdgeAA now filters the finished frame; MSAA is affordable only on a machine
// that has frames to spare (?wmsaa=4; it costs 40-59% here). So every hard edge
// in the piece is a staircase, and a staircase CRAWLS by however far the image
// moves between one frame and the next. That distance is the whole of it, and
// it is the turn rate divided by the frame rate: measured on the reader's
// machine, the Echo settles at 23 fps while turning, and 1.6 rad/s there is
// four degrees — about 86 pixels — of the room jumping sideways every frame.
// At 0.9 it is 48. The edges are no better sampled; they simply have half as
// far to jump, and half a strobe is most of the difference between "this
// flickers" and "this is a slow look around a room".
//
// 0.9 rad/s is 51 degrees a second: a quarter-turn in a second and three
// quarters. It reads as deliberate rather than sluggish, and this is a piece
// about standing in rooms. If it feels slow, this is the number.
const TURN_RATE = 0.9;
const TILT_RATE = 0.62;
const PITCH_MAX = 0.8;

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const FILL_DIAL = typeof window === 'undefined' ? 1
  : Number(new URLSearchParams(window.location.search).get('wamb')) || 1;
const MOON_DIAL = typeof window === 'undefined' ? 1
  : Number(new URLSearchParams(window.location.search).get('wmoon')) || 1;
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const smoother = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_X = new THREE.Vector3(1, 0, 0);

// (the map's resting camera, restPose, is in plan.js: the opening draws with it too)

const lookQuat = (eye, look) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, look, WORLD_UP));

const eyePose = (mount, aspect) => {
  const v = THREE.MathUtils.degToRad(EYE_FOV);
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  const d = Math.min((mount.width / FILL) / (2 * Math.tan(h / 2)), (mount.height / FILL) / (2 * Math.tan(v / 2)));
  const [cx, cy, cz] = mount.center;
  const [nx, nz] = mount.normal;
  const position = new THREE.Vector3(cx + nx * d, cy, cz + nz * d);
  return { position, quaternion: lookQuat(position, new THREE.Vector3(cx, cy, cz)) };
};

const standPose = (stand) => {
  const position = new THREE.Vector3(...stand.eye);
  return { position, quaternion: lookQuat(position, new THREE.Vector3(...stand.look)) };
};

// Where the reader is standing in room i: the one place the walk puts them, or —
// once they have climbed to it — the room's vantage (buildWorld's VANTAGES: the
// Echo's crossing). A room without one has nowhere else to be.
const spotAt = (world, i, up) => (up && world.stands[i].vantage) || world.stands[i];
const vantageAt = (world, i) => (i === null ? null : world.stands[i].vantage ?? null);
// The way on to the next room, set off on from a vantage instead of from the
// room's floor. Up on the Echo's crossing the reader is standing ON the walk to
// the Silence, and used to be walked down the flight to the stand, turned round
// and walked back up it again. If the way passes over where they stand, it
// starts there; if it does not, it is the way down and the way on as one walk,
// with no stop at the foot to face the room first.
const onFromVantage = (v, way) => {
  const eye = new THREE.Vector3(...v.eye), seg = new THREE.Line3(), near = new THREE.Vector3();
  let best = Infinity, at = -1;
  for (let i = 0; i + 1 < way.length; i++) {
    seg.start.set(...way[i]);
    seg.end.set(...way[i + 1]);
    const d = seg.closestPointToPoint(eye, true, near).distanceTo(eye);
    if (d < best) { best = d; at = i; }
  }
  return best < 2 ? [v.eye, ...way.slice(at + 1)] : [...[...v.points].reverse(), ...way.slice(1)];
};
// A walk wants points no two of which are on top of each other — and at least
// two of them, so a walk that is already all but over is a step on the spot.
const asPoints = (pts) => {
  const out = pts
    .map((p) => new THREE.Vector3(...p))
    .filter((p, i, all) => i === 0 || p.distanceTo(all[i - 1]) > 0.5);
  if (out.length < 2) out.push(out[0].clone().add(new THREE.Vector3(0.6, 0, 0)));
  return out;
};
// Where a reader who has walked off on their own (the free walk) can step
// back onto a way the piece knows: the nearest point of any of `ways` (each a
// list of eye-height points ending where the walk is to end) that a straight
// walk from where they stand reaches without being turned aside or stopped
// (body.js, `clear`) — and that way on from there. If nothing can be reached
// straight, the nearest point regardless.
const JOIN_EVERY = 4;
const JOIN_TRIES = 48;
const joinWay = (feel, feet, eye, ways) => {
  const cands = [];
  ways.forEach((way, w) => {
    for (let i = 0; i + 1 < way.length; i++) {
      const a = new THREE.Vector3(...way[i]), b = new THREE.Vector3(...way[i + 1]);
      const n = Math.max(1, Math.ceil(a.distanceTo(b) / JOIN_EVERY));
      for (let k = 0; k < n; k++) cands.push({ p: a.clone().lerp(b, k / n), w, i });
    }
    cands.push({ p: new THREE.Vector3(...way.at(-1)), w, i: way.length - 1 });
  });
  for (const c of cands) c.d = Math.hypot(c.p.x - eye.x, c.p.z - eye.z) + Math.abs(c.p.y - eye.y) * 2;
  cands.sort((a, b) => a.d - b.d);
  const to = new THREE.Vector3();
  const join = cands.slice(0, JOIN_TRIES).find((c) => feel.clear(feet, to.set(c.p.x, c.p.y - EYE, c.p.z)));
  if (!join) return null;
  return [eye.toArray(), join.p.toArray(), ...ways[join.w].slice(join.i + 1)];
};

// ── Moves: each a duration and a pose for every u in [0, 1] ──────────────────
// A pose: position, quaternion, fov, shift (the lens offset, as a fraction of
// the width), veil (the unexplored dark), eye (0 over the map, 1 among the
// walls), fade (the whiteout of the fall), near.

const flightMove = (rest, to, endFov, reverse, duration) => {
  const ctrl = new THREE.Vector3(to.position.x, rest.position.y * 0.35, to.position.z + 180);
  return {
    kind: 'flight',
    duration,
    at(uRaw, out) {
      const u = reverse ? 1 - uRaw : uRaw;
      const e = smoother(u), a = 1 - e;
      out.position.set(0, 0, 0)
        .addScaledVector(rest.position, a * a)
        .addScaledVector(ctrl, 2 * a * e)
        .addScaledVector(to.position, e * e);
      out.quaternion.slerpQuaternions(rest.quaternion, to.quaternion, smooth((u - 0.2) / 0.8));
      out.fov = TILT_FOV + (endFov - TILT_FOV) * smooth((u - 0.3) / 0.7);
      out.shift = rest.shift * (1 - smooth(u / 0.6));
      out.veil = 1 - smooth(u / 0.45);
      out.eye = smooth((u - 0.55) / 0.45);
      out.fade = 0;
      out.near = Math.max(0.5, out.position.distanceTo(to.position) * 0.02);
      return u;
    },
  };
};

// A walk is measured in DISTANCE, not in time: `at` takes how far along the way
// the body is, and the frame loop decides how fast that grows — gathering the
// stride, slowing into the room — at the pace of the reader's own free walk.
// Everything else here — the flight, the fall — is a film and runs on a clock.
// Where the eyes go while the feet follow the path: not one point a few strides
// on, but a blend of three — near, middle and far — each counted by direction
// only. With a single point 26 ahead the gaze swung wherever the path bent, and
// at the foot of the Echo's stair, where the walk to the Silence steps sideways
// off the flight (heading 0° → -105° → -40° in a few strides), it swung
// straight into the pier beside the archway at nine units and back out again —
// "like I am crushing into the columns". A walker looks through the doorway
// before they reach it; the far point is what turns the head early, and the
// near one keeps it honest on a straight.
const LOOK_AHEAD = [[16, 0.45], [36, 0.35], [64, 0.2]];
const END_TURN = 22;
// Turned right round at either end of a walk, the body does not spin as it
// goes. Down from the Echo's crossing, the stand at the foot of the flight
// faces back UP it: the turn to that view ran over the last 22 units, which
// is the last three treads and the tall first step, so the reader came down
// them walking backwards while they spun — with the drop, "like I am jumping,
// not walking". Past PIVOT_TURN, the walk's own distance gets PIVOT more units
// at that end: the feet ease to a standstill across them and the turn happens
// in the last of it, nearly on the spot — the way a person stops, then turns
// round. (And the same at the start: turn, then go.)
const PIVOT = 16;
const PIVOT_TURN = 0.6 * Math.PI;   // 108°
const flat = (v) => { v.y = 0; return v.lengthSq() > 1e-8 ? v.normalize() : null; };
const walkMove = (points, fromQ, toQ) => {
  const curve = makeWalkCurve(points);
  const Lp = curve.getLength();
  const pace = makeWalkPace(curve, WALK_SPEED);
  const turned = (q, tangent) => {
    const face = flat(new THREE.Vector3(0, 0, -1).applyQuaternion(q)), way = flat(tangent);
    return face && way && face.angleTo(way) > PIVOT_TURN;
  };
  // (never more of a pivot than a quarter of the walk at each end)
  const pivotIn = turned(fromQ, curve.getTangentAt(0)) ? Math.min(PIVOT, Lp / 4) : 0;
  const pivotOut = turned(toQ, curve.getTangentAt(1)) ? Math.min(PIVOT, Lp / 4) : 0;
  const L = Lp + pivotIn + pivotOut;
  // Distance walked to distance along the path: one for one in the middle,
  // easing from and to a standstill across twice a pivot at either end
  // (quadratics that meet the straight with the same slope).
  const along = (d) => {
    if (pivotIn && d < 2 * pivotIn) { const t = d / (2 * pivotIn); return pivotIn * t * t; }
    if (pivotOut && d > L - 2 * pivotOut) { const t = (d - (L - 2 * pivotOut)) / (2 * pivotOut); return Lp - pivotOut + pivotOut * (2 * t - t * t); }
    return d - pivotIn;
  };
  const p = new THREE.Vector3(), ahead = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const probe = new THREE.Vector3(), aim = new THREE.Vector3();
  // How much of the step the body is taking: 1 at a stride, 0 standing still —
  // otherwise a reader who stops halfway is left with their head down mid-dip.
  let gait = 1;
  return {
    kind: 'walk',
    length: L,
    duration: L / WALK_SPEED,   // what it takes when the piece walks it
    pivot: [pivotIn, pivotOut],
    paceAt(d) { return pace(along(d)); },
    setGait(g) { gait = g; },
    at(s, out) {
      const d = clamp01(s) * L;
      const ps = clamp01(along(d) / Lp);
      curve.getPointAt(ps, p);
      aim.set(0, 0, 0);
      for (const [reach, weight] of LOOK_AHEAD) {
        curve.getPointAt(Math.min(1, ps + reach / Lp), probe);
        // A point past the end of the way is the end of the way, and looked
        // at level: at the foot of a stair the end is below the eye, and all
        // three points gathering on it tipped the head 24 degrees at the floor.
        if (ps + reach / Lp > 1) probe.y = p.y;
        probe.sub(p);
        const len = probe.length();
        if (len > 1e-3) aim.addScaledVector(probe, weight / len);
      }
      // half the climb or fall of the way ahead, as before: the eyes lead the
      // feet up a stair but do not stare at the treads
      ahead.copy(p).addScaledVector(aim.setY(aim.y * 0.5), 26);
      out.position.copy(p);
      // a step: the head dips and rises once a stride, and not while standing
      const env = smooth(d / 14) * smooth((L - d) / 14);
      out.position.y += (Math.sin((d / STRIDE) * Math.PI) ** 2 - 0.5) * 0.5 * env * gait;
      if (ahead.distanceToSquared(p) > 1) {
        m.lookAt(p, ahead, WORLD_UP);
        q.setFromRotationMatrix(m);
      } else {
        q.copy(toQ);
      }
      out.quaternion.slerpQuaternions(fromQ, q, smooth(pivotIn ? d / pivotIn : d / 22));
      // The turn to the stand's own view, over the last stretch. It was 34
      // units, and on the way into the Echo — whose stand is just outside the
      // ring of arcade piers — that began while the reader was still behind the
      // pier at 165°, and turned their face into its pedestal. Over 22 they keep
      // looking along the way until the way has cleared it; the brake over the
      // last WALK_BRAKE units is what keeps a shorter turn from being a snap.
      // Turning right round, it is the last three quarters of the pivot, by
      // when the feet have two units left to go.
      const endTurn = pivotOut ? pivotOut * 0.75 : END_TURN;
      out.quaternion.slerp(toQ, smooth((d - (L - endTurn)) / endTurn));
      out.fov = ROOM_FOV;
      out.shift = 0;
      out.veil = 0;
      out.eye = 1;
      out.fade = 0;
      out.near = 0.5;
      return s;
    },
  };
};

// The Vertigo into the Door. Down to where the rail has given way; a lean out
// over the well, the gaze dropping to the light at its bottom while the lens
// widens as the head moves in, so the shaft seems to stretch away (Hitchcock's
// trick, and the room's name); then the drop — gathering speed, turning, the
// lens opening and the body buffeted harder the faster it goes, lamps and
// chains and loose pages rushing up past it — into the light, and out of it
// standing in the Door. Backwards it is the climb: out of the light, up the
// funnel, back onto the stair.
const fallMove = (leg, from, to, reverse) => {
  const edge = new THREE.Vector3(...leg.edge);
  const inward = new THREE.Vector3(leg.center[0] - edge.x, 0, leg.center[1] - edge.z).normalize();
  const lean = edge.clone().addScaledVector(inward, 4.5);
  lean.y -= 2.5;
  const axis = new THREE.Vector3(leg.center[0], lean.y, leg.center[1]);
  const edgeQ = lookQuat(edge, new THREE.Vector3(leg.center[0], leg.bottom * 0.25, leg.center[1]));
  const leanQ = lookQuat(lean, new THREE.Vector3(leg.center[0], leg.bottom, leg.center[1]));
  // looking straight down from the lean, the top of the frame is toward the
  // middle of the well; the spin starts from there, so the drop does not snap round
  const roll0 = Math.atan2(inward.z, inward.x);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), jolt = new THREE.Quaternion(), e = new THREE.Euler();
  const below = new THREE.Vector3(), up = new THREE.Vector3();
  const buffet = (x) => Math.sin(x * 1.7) * 0.5 + Math.sin(x * 3.1 + 1.3) * 0.3 + Math.sin(x * 5.3 + 2.1) * 0.2;
  return {
    kind: 'fall',
    duration: FALL_S,
    at(uRaw, out) {
      const u = reverse ? 1 - uRaw : uRaw;
      out.shift = 0;
      out.veil = 0;
      out.eye = 1;
      out.near = 0.5;
      out.fade = 0;
      if (u < 0.16) {
        const w = smooth(u / 0.16);
        out.position.lerpVectors(from.position, edge, w);
        out.quaternion.slerpQuaternions(from.quaternion, edgeQ, w);
        out.fov = ROOM_FOV;
      } else if (u < 0.3) {
        const w = smooth((u - 0.16) / 0.14);
        out.position.lerpVectors(edge, lean, w);
        out.position.y += Math.sin(w * Math.PI) * 0.4;
        out.quaternion.slerpQuaternions(edgeQ, leanQ, w);
        out.fov = ROOM_FOV + (LEAN_FOV - ROOM_FOV) * w;
      } else if (u < 0.84) {
        const w = (u - 0.3) / 0.54;
        // off the edge and out over the well, then down its middle
        out.position.lerpVectors(lean, axis, smooth(w / 0.3));
        out.position.y = lean.y + (leg.bottom - lean.y) * w ** 2.4;
        // not quite straight down: the gaze wheels round the throat as the body turns
        const spin = roll0 + w * w * Math.PI * 2.2, tilt = 0.32 * Math.sin(w * Math.PI);
        below.copy(out.position);
        below.x += Math.cos(spin * 0.6 + 1) * tilt;
        below.z += Math.sin(spin * 0.6 + 1) * tilt;
        below.y -= 1;
        up.set(Math.cos(spin), 0, Math.sin(spin));
        q.setFromRotationMatrix(m.lookAt(out.position, below, up));
        out.quaternion.slerpQuaternions(leanQ, q, smooth(w / 0.28));
        const shake = w * w * 0.03, time = w * 40;
        out.quaternion.multiply(jolt.setFromEuler(e.set(buffet(time) * shake, buffet(time * 1.3 + 7) * shake, buffet(time * 0.8 + 3) * shake * 1.8)));
        out.fov = LEAN_FOV + (FALL_FOV - LEAN_FOV) * smooth(w / 0.75);
        out.fade = smooth((u - 0.68) / 0.16);
      } else {
        const w = smooth((u - 0.84) / 0.16);
        out.position.copy(to.position);
        out.position.y += 10 * (1 - w);
        out.quaternion.copy(to.quaternion);
        out.fov = ROOM_FOV;
        out.fade = 1 - w;
      }
      return u;
    },
  };
};

// The heart of the maze (buildWorld's `finale`, finale.js): the way on from the
// last room, and the one move nobody walks back along. Through the gate into
// the court; a look round it as the heart catches and the others come in,
// ending on the one standing in the gate the reader came in by; then up out of
// the maze looking down into it — a net of light by then — and on and back over
// the whole walk as the light runs along it, into the map's own pose, so the
// map takes over without a seam. A film on a clock, like the flight and the
// fall.
const NORTH = new THREE.Vector3(0, 0, -1);
// `from`: where the reader steps in from — the stand at the gate, or, walking
// on their own, wherever in the court they have got to (inCourt).
const finaleMove = (world, rest, from = null) => {
  const f = world.finale;
  const T = f.timeline;
  const st = world.stands[f.room];
  const eyeY = st.eye[1];
  const inside = new THREE.Vector3(f.inside[0], eyeY, f.inside[1]);
  const heartAt = new THREE.Vector3(f.heart[0], eyeY + 4, f.heart[1]);
  const heartDown = new THREE.Vector3(f.heart[0], f.ground, f.heart[1]);
  const start = from ?? standPose(st);
  const atHeart = lookQuat(inside, heartAt);
  const walk = walkMove(asPoints([start.position.toArray(), inside.toArray()]), start.quaternion, atHeart);
  // Where the eyes go round the court, as headings from where the reader
  // stops (0 is +x, a quarter turn is +z): the heart, the west gate where two
  // of the others come in, and the gate behind — each with how far off and how
  // high to look. Unwound so the head only ever turns the one way.
  const heading = ([x, z]) => Math.atan2(z - inside.z, x - inside.x);
  const marks = [
    { t: 6.8, a: heading(f.heart), r: inside.distanceTo(new THREE.Vector3(f.heart[0], eyeY, f.heart[1])), y: eyeY + 4 },
    { t: 10.4, hold: true },
    { t: 12.8, a: heading(f.gates.w), r: 40, y: eyeY - 3 },
    { t: 14.0, hold: true },
    { t: 16.6, a: heading(f.you), r: 29, y: eyeY },
  ];
  marks.forEach((m, i) => {
    if (m.hold) Object.assign(m, { a: marks[i - 1].a, r: marks[i - 1].r, y: marks[i - 1].y });
    while (i && m.a < marks[i - 1].a - 1e-6) m.a += Math.PI * 2;
  });
  const aim = new THREE.Vector3();
  const panQ = (t, q) => {
    let k = 0;
    while (k + 1 < marks.length && t > marks[k + 1].t) k++;
    const a = marks[k], b = marks[Math.min(k + 1, marks.length - 1)];
    const w = b === a ? 0 : smooth((t - a.t) / (b.t - a.t));
    const th = a.a + (b.a - a.a) * w, r = a.r + (b.r - a.r) * w;
    aim.set(inside.x + Math.cos(th) * r, a.y + (b.y - a.y) * w, inside.z + Math.sin(th) * r);
    return q.setFromRotationMatrix(new THREE.Matrix4().lookAt(inside, aim, WORLD_UP));
  };
  // The rise: straight up out of the court at first, turning to look down
  // into it, then out along a curve that comes into the map's pose from in
  // front of it, backing away down its line of sight.
  const [r0, r1] = T.rise;
  const turned = panQ(r0, new THREE.Quaternion());
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(rest.quaternion);
  const B = [inside.clone(), inside.clone().add(new THREE.Vector3(0, 300, 0)), rest.position.clone().addScaledVector(fwd, rest.distance * 0.45), rest.position.clone()];
  const bez = (e, out) => {
    const a = 1 - e;
    return out.set(0, 0, 0)
      .addScaledVector(B[0], a * a * a).addScaledVector(B[1], 3 * a * a * e)
      .addScaledVector(B[2], 3 * a * e * e).addScaledVector(B[3], e * e * e);
  };
  const down = new THREE.Quaternion();
  return {
    kind: 'finale',
    duration: T.end,
    at(u, out) {
      const t = u * T.end;
      if (t < T.walk) {
        walk.at(smoother(t / T.walk), out);
        return u;
      }
      out.fade = 0;
      if (t < r0) {
        out.position.copy(inside);
        panQ(t, out.quaternion);
        Object.assign(out, { fov: ROOM_FOV, shift: 0, veil: 0, eye: 1, near: 0.5 });
        return u;
      }
      const s = clamp01((t - r0) / (r1 - r0));
      bez(smoother(s), out.position);
      down.setFromRotationMatrix(new THREE.Matrix4().lookAt(out.position, heartDown, NORTH));
      out.quaternion.slerpQuaternions(turned, down, smooth(s / 0.28));
      out.quaternion.slerp(rest.quaternion, smooth((s - 0.3) / 0.7));
      out.fov = ROOM_FOV + (TILT_FOV - ROOM_FOV) * smooth(s / 0.85);
      out.shift = rest.shift * smooth((s - 0.55) / 0.45);
      out.veil = smooth((s - 0.4) / 0.6);
      out.eye = 1 - smooth((s - 0.02) / 0.45);
      out.near = THREE.MathUtils.lerp(Math.max(0.5, (out.position.y - 26) * 0.03), rest.distance * 0.05, smooth((s - 0.6) / 0.4));
      return u;
    },
  };
};

// The overlay, as screen pixels for this window and the resting camera.
const layoutFor = (overlay, width, height, points, reserveLeft) => {
  const { camera } = restPose(width / height, points, reserveLeft);
  const v = new THREE.Vector3();
  const px = ([x, y, z]) => {
    v.set(x, y, z).project(camera);
    return [+(((v.x + 1) / 2) * width).toFixed(1), +(((1 - v.y) / 2) * height).toFixed(1)];
  };
  const line = (pts) => pts.map(px);
  const rooms = overlay.rooms.map(line);
  const labels = rooms.map((poly) => {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...ys) + 16];
  });
  const walk = line(overlay.walk);
  const gardenWalk = line(overlay.gardenWalk);
  const mazeLeg = line(overlay.mazeLeg);
  const chevron = (pts, i) => {
    const [a, b] = [pts[i], pts[i + 1]];
    return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
  };
  return {
    w: width,
    h: height,
    rooms,
    labels,
    walk,
    gardenWalk,
    mazeLeg,
    notTaken: line(overlay.notTaken),
    fall: line(overlay.fall),
    pit: px(overlay.pit),
    entrance: { ...chevron(walk, 0), x: walk[0][0], y: walk[0][1] },
    chevronsLibrary: [0, 2, 4, 6].map((i) => chevron(walk, i)),
    chevronsGarden: [chevron(gardenWalk, 1), chevron(mazeLeg, 1), chevron(mazeLeg, 2)],
  };
};

const loadPlate = async (url) => {
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: LIGHT_MESH ? 1024 : 1600, resizeQuality: 'high', imageOrientation: 'flipY',
  });
  const texture = new THREE.Texture(bitmap);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

// ── Assembling ───────────────────────────────────────────────────────────────
// Before 2026-10-02 the world was built in one go inside a render, and the
// first frame then compiled every shader it drew, ONE AT A TIME, each waited
// for before the next: measured on the AMD integrated GPU this piece is made
// on, a first visit froze for about 35 seconds behind "Assembling the
// Library…" — six to build, twenty-six to compile 80 shaders. The same 80
// shaders started together and waited for without blocking take 7.6 seconds.
//
// So the assembly is a sequence that lets the page breathe between its steps:
//   1. the heavy surfaces start painting in workers (paint.js), and the sky,
//      the air and the environment light are made while they do;
//   2. the world is built a section at a time (assembleWorld's yields);
//   3. every shader the world needs is started at once and polled, never
//      waited on (KHR_parallel_shader_compile — renderer.compile, and
//      program.isReady() for how far along it is);
//   4. the paint arrives and is uploaded;
//   5. only then does the world go into the scene and LiveWorld start drawing.
// `onProgress` hears how far along it is, 0 to 1, for the status line.
// Each step is marked on the page's timeline (world:…), for the DevTools
// performance panel and for tools that read performance.getEntriesByType('mark').
const mark = (name) => performance.mark?.(`world:${name}`);
const breathe = () => new Promise((resolve) => { setTimeout(resolve, 0); });
const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
// How long the main thread works before it lets the page draw.
const SLICE_MS = 40;
// Where each step ends on the way to 1, roughly as long as each took (cold).
const SHARE = { setup: 0.12, build: 0.5, compile: 0.94, upload: 0.99 };
// How many times assembleWorld yields (one per section of buildWorld.js, and
// one per gallery of the Library and of the garden).
const BUILD_STEPS = 28;
// Past this, stop waiting for the shaders: the first frame finishes them.
const COMPILE_GIVE_UP_MS = 90000;

// Every shader the world will draw with, started now: compiled against the
// scene's fog, environment and lights exactly as a frame would, and into a
// render target, because that is where the composer draws the scene (and a
// target changes the program: no tone mapping, linear output). The world is
// compiled from outside the scene so that nothing draws it before it is ready.
// Returns the materials, or null if this renderer could not do it.
//
// renderer.compile works out a program for every OBJECT it finds, not for
// every material, and with a few thousand objects sharing their materials
// that alone was three seconds. So it is handed stand-ins: one per material
// and kind of object it is on (what three reads off an object to choose a
// program, `programShape`), each the real object seen through Object.create
// with no children of its own, and the world's lights as a frame would find
// them — visible all the way up.
const programShape = (o) => {
  const a = o.geometry?.attributes ?? {}, m = o.geometry?.morphAttributes ?? {};
  return [
    o.type, o.isInstancedMesh, !!o.instanceColor, !!o.morphTexture, o.isBatchedMesh, !!o._colorsTexture, o.isSkinnedMesh,
    Object.keys(a).sort().join(','), a.color?.itemSize, Object.keys(m).map((k) => `${k}${m[k].length}`).join(','),
  ].join('|');
};
const standIns = (root) => {
  const stand = new THREE.Group();
  const seen = new Set();
  const add = (o) => {
    const p = Object.create(o);
    p.children = [];
    stand.children.push(p);
  };
  root.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
    const key = `${(Array.isArray(o.material) ? o.material : [o.material]).map((m) => m.id).join('+')}#${programShape(o)}`;
    if (seen.has(key)) return;
    seen.add(key);
    add(o);
  });
  root.traverseVisible((o) => { if (o.isLight) add(o); });
  return stand;
};
const startShaders = (gl, root, camera, scene) => {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const was = gl.getRenderTarget();
  try {
    gl.setRenderTarget(target);
    return gl.compile(standIns(root), camera, scene);
  } catch (error) {
    console.warn('[world] could not start the shaders early; the first frame will compile them:', error);
    return null;
  } finally {
    gl.setRenderTarget(was);
    target.dispose();
  }
};
const shaderReady = (gl, material) => {
  const program = gl.properties.get(material).currentProgram;
  return !program || program.isReady();
};
// Every texture a material samples, its own maps and its shader's uniforms.
const texturesOf = (materials) => {
  const out = new Set();
  const take = (v) => { if (v?.isTexture && !v.isRenderTargetTexture && v.image) out.add(v); };
  for (const m of materials) {
    Object.values(m).forEach(take);
    if (m.uniforms) Object.values(m.uniforms).forEach((u) => take(u?.value));
  }
  return out;
};

// The painting starts the moment this module is loaded (EntryMap fetches it as
// soon as it can), not once the canvas has made its first frames: it needs
// nothing from them, and those first frames hold the main thread for a second
// compiling the composer. The first assembly takes this painter; any later one
// (the world remounted) starts its own.
let earlyPainter = typeof window !== 'undefined' && typeof document !== 'undefined' ? makePainter(PAINTED) : null;
const takePainter = () => {
  const painter = earlyPainter ?? makePainter(PAINTED);
  earlyPainter = null;
  return painter;
};

function WorldContent({ rooms = false, onProgress, onHold, onAssembled, onPlan, ...live }) {
  const { scene, camera, gl } = useThree();
  const [built, setBuilt] = useState(null);
  const [failed, setFailed] = useState(null);
  const progressRef = useRef(onProgress);
  const holdRef = useRef(onHold);
  const assembledRef = useRef(onAssembled);
  const planRef = useRef(onPlan);
  useEffect(() => {
    progressRef.current = onProgress;
    holdRef.current = onHold;
    assembledRef.current = onAssembled;
    planRef.current = onPlan;
  }, [onProgress, onHold, onAssembled, onPlan]);

  useEffect(() => {
    let alive = true;
    let said = -1;
    const say = (f) => {
      const pct = Math.floor(Math.min(f, 0.99) * 100);
      if (pct === said) return;
      said = pct;
      progressRef.current?.(pct / 100);
    };
    const made = { painter: null, sky: null, prepared: null, environment: null, steps: null, world: null, held: false };
    (async () => {
      say(0);
      mark('start');
      made.painter = takePainter();
      made.painter.done.then(() => mark('painted'));
      made.sky = makeSky();
      scene.add(made.sky.mesh);
      scene.background = new THREE.Color('#03060a');
      scene.fog = new THREE.Fog(MAP_FOG.clone(), 1e4, 2e4);
      // its shaders compile while the world is built; it is filtered after
      made.prepared = prepareEnvironment(gl);
      await breathe();
      if (!alive) return;
      say(SHARE.setup);

      made.steps = assembleWorld({ light: LIGHT_MESH, paintings: !rooms, painter: made.painter });
      let k = 0, since = performance.now();
      for (;;) {
        const step = made.steps.next();
        if (step.done) { made.world = step.value; break; }
        k += 1;
        say(SHARE.setup + (SHARE.build - SHARE.setup) * Math.min(1, k / BUILD_STEPS));
        if (performance.now() - since > SLICE_MS) {
          await breathe();
          if (!alive) return;
          since = performance.now();
        }
      }
      made.steps = null;
      mark('built');
      const { world } = made;
      // what the map will frame, for the opening's camera to come to rest on
      planRef.current?.(framePointsOf(world.overlay));
      // (before the world's shaders: which environment they light by is part of them)
      const environment = made.prepared.finish();
      made.prepared = null;
      made.environment = environment;
      scene.environment = environment.texture;
      mark('environment');

      const materials = startShaders(gl, world.root, camera, scene);
      mark('shaders-started');
      // No frames while the shaders compile. The canvas is not shown yet, and
      // every frame's calls queued behind the compiling on the GPU's side and
      // stood the page still for seconds at a time.
      holdRef.current?.(true);
      made.held = true;
      // Meanwhile, up to the GPU with every texture whose pixels are here (the
      // painted ones as they arrive), a slice at a time, rather than all of it
      // in the first frame.
      const textures = [...new Set([...(materials ? texturesOf(materials) : []), ...made.painter.textures()])];
      const uploaded = new Set();
      const upload = () => {
        const until = performance.now() + SLICE_MS;
        for (const t of textures) {
          if (uploaded.has(t) || (t.isPaintedTexture && !t.image.data)) continue;
          gl.initTexture(t);
          uploaded.add(t);
          if (performance.now() > until) break;
        }
        return uploaded.size === textures.length;
      };
      mark('textures-listed');
      const asked = performance.now();
      let compiled = !materials || !materials.size, sent = false;
      while (!compiled || !sent) {
        if (!compiled) {
          let ready = 0;
          for (const m of materials) if (shaderReady(gl, m)) ready += 1;
          compiled = ready === materials.size || performance.now() - asked > COMPILE_GIVE_UP_MS;
          if (compiled) mark('shaders-ready');
          say(SHARE.build + (SHARE.compile - SHARE.build) * (ready / materials.size));
        }
        sent = upload();
        if (compiled && sent) break;
        await pause(compiled ? 10 : 40);
        if (!alive) return;
      }
      mark('textures-sent');
      say(SHARE.upload);
      scene.add(world.root);
      setBuilt({ world, sky: made.sky });
      assembledRef.current?.(true);
      holdRef.current?.(false);
      made.held = false;
    })().catch((error) => { if (alive) setFailed(error); });

    return () => {
      alive = false;
      if (made.held) holdRef.current?.(false);
      made.steps?.return();
      made.painter?.dispose();
      if (made.world) {
        scene.remove(made.world.root);
        made.world.dispose();
      }
      if (made.sky) {
        scene.remove(made.sky.mesh);
        made.sky.dispose();
      }
      scene.fog = null;
      scene.environment = null;
      made.environment?.dispose();
      made.prepared?.dispose();
    };
  }, [scene, camera, gl, rooms]);

  // (thrown here, in a render, so that WorldBoundary keeps the still)
  if (failed) throw failed;
  return built ? <LiveWorld {...live} rooms={rooms} world={built.world} sky={built.sky} /> : null;
}

function LiveWorld({
  world, sky, budgetRef,
  rooms = false, scenes, target = null, vantage = false, finale = null, reducedMotion = false, lookRef, walkRef, fadeRef, aoRef,
  onReady, onArrive, onSettle, onRoam, onGo, onFinale, onLayout, reserveLeft = false,
}) {
  const { scene, camera, gl, size } = useThree();
  // The one thing the governor reaches into the built world for (see GIVE).
  if (budgetRef) budgetRef.current = world.setLightBudget;

  // What the resting camera frames: every room, the walk and the garden paths.
  const framePoints = useMemo(() => framePointsOf(world.overlay), [world]);

  // The overlay follows the window.
  useEffect(() => {
    if (!size.width || !size.height) return;
    onLayout?.(layoutFor(world.overlay, size.width, size.height, framePoints, reserveLeft));
  }, [size.width, size.height, world, onLayout, framePoints, reserveLeft]);

  const plates = rooms || !scenes ? '' : scenes.map((s) => s.color).join('|');
  useEffect(() => {
    if (!plates) return undefined;
    let alive = true;
    const made = [];
    plates.split('|').forEach((url, i) => {
      loadPlate(url)
        .then((texture) => {
          if (!alive) {
            texture.dispose();
            return;
          }
          made.push(texture);
          world.setPainting(i, texture);
        })
        .catch(() => { /* the frame stays dark; the room is still there */ });
    });
    return () => {
      alive = false;
      made.forEach((t) => t.dispose());
    };
  }, [plates, world]);

  const rest = useMemo(
    () => restPose(size.width / Math.max(1, size.height), framePoints, reserveLeft),
    [size.width, size.height, framePoints, reserveLeft],
  );

  // Taken from the prop only when the prop CHANGES. The canvas re-renders this
  // component on its own store updates with the last props it was handed, and
  // copying on every render let a stale target overwrite a newer one.
  const targetRef = useRef(target);
  // The rooms the reader's own walk has walked into, as told to EntryMap
  // (tellRoam), which sets its target to them and hands them back here. Back
  // here they are news already had — the walk set targetRef itself, ahead of
  // React — and they can arrive late: walked back and forth over the line
  // between the Pavilion and the Fork, the Fork came back after the walk was
  // in the Pavilion again, read as a walk asked for back to the Fork, and the
  // reader was taken off their own feet. Only a target that is not one of
  // these is a walk asked for.
  const echoes = useRef([]);
  useEffect(() => {
    const k = echoes.current.indexOf(target);
    if (k >= 0) {
      echoes.current.splice(0, k + 1);
      return;
    }
    targetRef.current = target;
  }, [target]);
  const placeRef = useRef(null);   // null: the map; else the room stood in
  // Whether the reader is up at the room's vantage, and whether they want to be.
  const upRef = useRef(false);
  const wishUpRef = useRef(vantage);
  useEffect(() => { wishUpRef.current = vantage; }, [vantage]);
  // The heart of the maze: null, 'play' (asked for, from the last room) or
  // 'skip' (M or Escape while it plays: straight to its end, on the map).
  const finaleRef = useRef(finale);
  useEffect(() => { finaleRef.current = finale; }, [finale]);
  const phaseRef = useRef(null);
  const moveRef = useRef(null);
  const look = useRef({ yaw: 0, pitch: 0 });
  const pose = useMemo(() => ({
    position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), fov: TILT_FOV, shift: 0, veil: 1, eye: 0, fade: 0, near: 1,
  }), []);
  const scratch = useMemo(() => ({ yaw: new THREE.Quaternion(), pitch: new THREE.Quaternion(), gaze: new THREE.Vector3() }), []);
  // The reader's own feet (body.js), once they have walked off where the piece
  // put them: null while they stand at a room's stand or vantage or the piece
  // is carrying them. `feet` is where they stand (y the floor), `eyeY` the eye
  // as it follows the floor up and down a stair, `base` which way the body
  // faced when it set off (the head turns on top of it, as it does standing),
  // `stride` how far it has walked, for the step of the head.
  const bodyRef = useRef(null);
  // What the reader's feet are allowed to touch: the world's solids, felt.
  // (Not in the plate tour, where nobody walks the world.)
  const feel = useMemo(() => (rooms ? makeBody(world.root) : null), [world, rooms]);
  useEffect(() => () => feel?.dispose(), [feel]);
  // The same solids tell a lamp's halo when stone stands between it and the
  // eye (buildWorld's `occlude`).
  useEffect(() => {
    world.setSight?.(feel ? feel.sight : null);
    return () => world.setSight?.(null);
  }, [world, feel]);
  const scrubRef = useRef(null);   // DEV: a move held at a fraction of itself
  const eyeRef = useRef(null);     // DEV: the eye taken off the walk (__worldEye)
  const lastFade = useRef(-1);
  const liveFrames = useRef(0);
  const readied = useRef(false);

  const zeroLook = () => {
    look.current.yaw = 0;
    look.current.pitch = 0;
    if (lookRef?.current) {
      lookRef.current.yaw = 0;
      lookRef.current.pitch = 0;
    }
  };

  // The ways that end at room i's stand: the leg in, and the leg out walked
  // backwards (not the fall, which is no way to walk).
  const homeWays = (i) => [
    i > 0 && world.legs[i - 1].kind === 'walk' ? world.legs[i - 1].points : null,
    // Explored past a stand, come back along that same continuation.
    i > 0 && world.legs[i - 1].followThrough
      ? [world.legs[i - 1].points.at(-1), ...world.legs[i - 1].followThrough].reverse() : null,
    i < world.legs.length && world.legs[i].kind === 'walk' ? [...world.legs[i].points].reverse() : null,
  ].filter(Boolean);

  // A move asked for while the reader is walking on their own (bodyRef): the
  // piece takes them from wherever they have got to. A walk on to the next
  // room, or up to a vantage and down again, joins its way at the nearest
  // point they can walk to straight (joinWay); the fall goes over the edge
  // from where they stand if they are at it. Anything else — the fall from
  // across the room, the climb back out of the Door, the step into the heart
  // of the maze — is made from the room's own stand, and the piece walks them
  // back to it first (`home`: on arrival nothing settles, and the move asked
  // for begins from there on the next frame).
  const moveFromBody = (body, to, up) => {
    const from = placeRef.current;
    const eye = new THREE.Vector3(body.feet.x, body.eyeY, body.feet.z);
    const q = body.base.clone();
    const walk = (ways, endQ) => {
      const joined = joinWay(feel, body.feet, eye, ways);
      return joined && walkMove(asPoints(joined), q, endQ);
    };
    const home = () => {
      const move = walk(homeWays(from), standPose(world.stands[from]).quaternion);
      return move && { ...move, to: from, from, home: true };
    };
    if (to === from) {
      const v = vantageAt(world, from);
      if (!v) return home();
      const move = walk([up ? v.points : [...v.points].reverse()], standPose(spotAt(world, from, up)).quaternion);
      return move && { ...move, to, up, from };
    }
    const forward = to > from;
    const leg = world.legs[forward ? from : to];
    if (leg.kind === 'walk') {
      const back = [...(leg.followThrough ?? [])].reverse().concat([...leg.points].reverse());
      const move = walk([forward ? leg.points : back], standPose(world.stands[to]).quaternion);
      return move && { ...move, to, from };
    }
    if (forward && from === 3) {
      const here = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
      zeroLook();
      const drop = { ...leg, edge: here.position.toArray(), bottom: Math.min(leg.bottom, eye.y - 400) };
      return { ...fallMove(drop, here, standPose(world.stands[to]), false), to };
    }
    return home();
  };
  // At the Vertigo's broken rail, where the fall goes over: the rail is gone
  // for about sixty units of the stair's edge either side of `leg.edge`.
  const nearTheBreak = (leg, p) => Math.hypot(p.x - leg.edge[0], p.z - leg.edge[2]) < 32 && Math.abs(p.y - leg.edge[1]) < 10;

  // ── The way, by default (see FOLLOW) ───────────────────────────────────────
  // The piece's walk as the few long lines it is — the walk legs end to end,
  // broken only by the fall — sampled every ROUTE_STEP along one curve through
  // them all. (One curve, not one a leg: where two legs met at a room's stand
  // the way turned there on the spot — into the Echo it came down the aisle
  // heading south and left up the stair heading east, a right angle walked at
  // a stride. Where a path goes straight back the way it came, it turns on
  // the spot: a curve through an about-turn loops.) `kappa`: how sharply it bends at each sample,
  // radians a unit.
  const route = useMemo(() => {
    // lines of runs: a run is one curve, a line the runs end to end
    const lines = [];
    let line = null;
    world.legs.forEach((leg) => {
      if (leg.kind !== 'walk') {
        line = null;
        return;
      }
      const pts = asPoints([...leg.points, ...(leg.followThrough ?? [])]);
      if (line) {
        const run = line[line.length - 1];
        const a = run[run.length - 2], m = run[run.length - 1], z = pts[1];
        const u = new THREE.Vector3(m.x - a.x, 0, m.z - a.z).normalize(), v = new THREE.Vector3(z.x - m.x, 0, z.z - m.z).normalize();
        if (u.dot(v) < -0.85) line.push([...pts]);
        else run.push(...pts.slice(1));   // (the stand the two legs share)
      } else lines.push(line = [[...pts]]);
    });
    // Continue on the court's axis past its arrival stand. W should carry
    // the reader through the gate without dropping guidance at the last bend.
    if (line && world.finale?.inside) {
      const run = line.at(-1), end = run.at(-1), inside = world.finale.inside;
      run.push(new THREE.Vector3(inside[0], end.y, inside[1]));
    }
    return lines.map((runs) => {
      const chain = [];
      runs.forEach((ctrl, r) => {
        const curve = makeWalkCurve(ctrl);
        const pts = curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / ROUTE_STEP)));
        chain.push(...(r ? pts.slice(1) : pts));
      });
      const n = chain.length, tan = chain.map((p, i) => {
        const a = chain[Math.max(0, i - 1)], b = chain[Math.min(n - 1, i + 1)];
        return Math.atan2(b.z - a.z, b.x - a.x);
      });
      chain.kappa = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const i0 = Math.max(0, i - 2), i1 = Math.min(n - 1, i + 2);
        const d = tan[i1] - tan[i0];
        chain.kappa[i] = i1 > i0 ? Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) / ((i1 - i0) * ROUTE_STEP) : 0;
      }
      return chain;
    });
  }, [world]);
  // The nearest sample of the way to the feet (on a level with them), within
  // `reach` — or, given `on` ({ c, i, dir }), the nearest a few samples on
  // from where it was last, and never back: the way over the Pavilion's bridges
  // and the way back from them lie on top of each other at the zigzag's corner,
  // and searched both ways the reader was flipped from one to the other there
  // and stood turning on the spot.
  const nearWay = (feet, reach, on = null, onward = null) => {
    let best = null, bestD = reach;
    const scan = (c, i0, i1) => {
      const pts = route[c];
      for (let i = Math.max(0, i0); i < Math.min(pts.length, i1); i++) {
        const p = pts[i];
        if (Math.abs(p.y - EYE - feet.y) > FOLLOW_RISE) continue;
        if (onward) {
          const a = pts[Math.max(0, i - 1)], z = pts[Math.min(pts.length - 1, i + 1)];
          const dx = z.x - a.x, dz = z.z - a.z, length = Math.hypot(dx, dz);
          if (!length || (dx * onward.x + dz * onward.z) / length < 0.5) continue;
        }
        const d = Math.hypot(p.x - feet.x, p.z - feet.z);
        if (d < bestD) {
          bestD = d;
          best = { c, i, d };
        }
      }
    };
    if (on) scan(on.c, on.dir > 0 ? on.i : on.i - 4, on.dir > 0 ? on.i + 5 : on.i + 1);
    else route.forEach((pts, c) => scan(c, 0, pts.length));
    return best;
  };
  // Along line c from sample i, `dir` (+1 on through the walk, -1 back), the
  // way to turn the head: toward a point up to FOLLOW_AHEAD further on, from
  // the feet — which brings a reader who is off to one side back onto the
  // line as it carries them along it. Only as far on as the way runs straight
  // from where they stand, though: at the foot of the zigzag bridge the way
  // turns back on itself along the shore, and a point fourteen on from there
  // was through the bridge's rail. Null at the line's end.
  // Only aim at a point the feet can walk to straight (`walkable`, body.js's
  // clearance), including the support on either side of the feet.
  const seg = new THREE.Line3(), onSeg = new THREE.Vector3(), q = new THREE.Vector3();
  const wayOn = (c, i, dir, feet, out, walkable = false) => {
    const pts = route[c];
    const last = dir > 0 ? pts.length - 1 : 0;
    const reach = Math.round(FOLLOW_AHEAD / ROUTE_STEP);
    let far = 0;
    seg.start.set(feet.x, 0, feet.z);
    for (let k = 1; k <= reach; k++) {
      const j = i + dir * k;
      if (dir > 0 ? j > last : j < last) break;
      seg.end.set(pts[j].x, 0, pts[j].z);
      let straight = true;
      for (let m = 1; m < k && straight; m++) {
        const s = pts[i + dir * m];
        q.set(s.x, 0, s.z);
        straight = seg.closestPointToPoint(q, true, onSeg).distanceTo(q) < FOLLOW_STRAIGHT;
      }
      if (!straight) break;
      far = k;
    }
    if (!far) {
      const p = pts[last];
      if (Math.hypot(p.x - feet.x, p.z - feet.z) < 4) return null;
      out.set(p.x - feet.x, 0, p.z - feet.z);
      const d = out.length();
      if (walkable && d > 1e-6 && feel.clearance(feet, out.x / d, out.z / d, d) < d - 0.25) return null;
      return out.lengthSq() > 1e-6 ? out.normalize() : null;
    }
    for (let k = far; k >= 1; k--) {
      const p = pts[i + dir * k];
      out.set(p.x - feet.x, 0, p.z - feet.z);
      const d = out.length();
      if (d < 1e-3) continue;
      out.divideScalar(d);
      if (!walkable || feel.clearance(feet, out.x, out.z, d) >= d - 0.25) return out;
      // The coarse look-ahead rays can reject the edge of a shallow tread.
      // For the nearest sample, ask the actual stepping body before giving
      // up the route. This still checks the whole foot and the shoulders.
      if (k === 1 && feel.clear(feet, q.set(p.x, p.y - EYE, p.z))) return out;
    }
    return null;
  };
  // The way line c runs further on from sample i, going `dir`: from
  // FOLLOW_SEE_FROM to FOLLOW_SEE_TO along it (as far as it goes), level, in
  // `out` — or false where too little of it is left to say.
  const further = new THREE.Vector3(), blend = new THREE.Vector3();
  const wayFurther = (c, i, dir, out) => {
    const pts = route[c], last = dir > 0 ? pts.length - 1 : 0;
    const clampJ = (j) => (dir > 0 ? Math.min(j, last) : Math.max(j, last));
    const a = pts[clampJ(i + dir * Math.round(FOLLOW_SEE_FROM / ROUTE_STEP))];
    const z = pts[clampJ(i + dir * Math.round(FOLLOW_SEE_TO / ROUTE_STEP))];
    out.set(z.x - a.x, 0, z.z - a.z);
    const L = out.length();
    if (L < FOLLOW_SEE_FROM * 0.5) return false;
    out.divideScalar(L);
    return true;
  };
  // The signed turn (radians, as the head's yaw counts it) from h to t.
  const turnTo = (h, t) => Math.atan2(h.z * t.x - h.x * t.z, h.x * t.x + h.z * t.z);
  const along = new THREE.Vector3();
  // Which way along which line a reader facing `h` is walking, if any: the
  // line within FOLLOW_CAPTURE, in whichever direction is inside FOLLOW_CONE
  // of the way they face (the nearer of the two). `onward`: from a room's
  // stand, not having turned from its view — on through the walk.
  const takeUp = (b, h, onward) => {
    if (placeRef.current === 3 && b.feet.y < -420 && world.spiral) {
      const center = [world.pit.x, world.pit.z];
      const st = spiralAt(center, (5.5 - b.feet.y) / SPIRAL.drop);
      const x = b.feet.x - center[0], z = b.feet.z - center[1], radius = Math.hypot(x, z);
      if (Math.abs(radius - st.radius) < FOLLOW_CAPTURE) {
        along.set(-z / radius, 0, x / radius);
        for (const dir of [1, -1]) if (Math.abs(turnTo(h, along.clone().multiplyScalar(dir))) < FOLLOW_CONE) {
          return { c: 0, i: 0, dir, spiral: true };
        }
      }
      return null;
    }
    // At a composed stand, use its outgoing leg to distinguish overlapping
    // paths. The Pavilion's return crossing is just as near as the way in.
    const leg = onward && world.legs[placeRef.current];
    const course = leg?.kind === 'walk' && leg.points.length > 1
      ? new THREE.Vector3(leg.points[1][0] - leg.points[0][0], 0, leg.points[1][2] - leg.points[0][2]).normalize() : null;
    const near = nearWay(b.feet, onward ? 14 : FOLLOW_CAPTURE, null, course);
    if (!near) return null;
    if (onward) return wayOn(near.c, near.i, 1, b.feet, along) ? { c: near.c, i: near.i, dir: 1 } : null;
    let best = null, bestA = FOLLOW_CONE;
    for (const dir of [1, -1]) {
      const pts = route[near.c];
      const a = pts[Math.max(0, near.i - 1)], z = pts[Math.min(pts.length - 1, near.i + 1)];
      along.set((z.x - a.x) * dir, 0, (z.z - a.z) * dir).normalize();
      const angle = Math.abs(turnTo(h, along));
      if (angle < bestA) {
        bestA = angle;
        best = { c: near.c, i: near.i, dir };
      }
    }
    return best;
  };
  // Route following turns the walking body and moderates its pace for bends.
  // Head input never releases the route or changes the pace of a held stride.
  const follow = (b, hold, pressed, dt) => {
    if (!FOLLOW) return null;
    if (hold <= 0) return null;
    const h = heading(b);
    if (pressed && !b.follow) b.follow = takeUp(b, h, b.fresh && Math.abs(look.current.yaw) < FOLLOW_UNTURNED);
    else if (!b.follow) b.follow = takeUp(b, h, false);
    b.fresh = false;
    const f = b.follow;
    if (!f) return null;
    if (placeRef.current === 3 && (f.spiral || b.feet.y < -420) && world.spiral) {
      f.spiral = b.feet.y < -420;
      if (f.spiral) {
        const at = world.spiral.aim(b.feet, f.dir);
        const direction = new THREE.Vector3(at.p[0] - b.feet.x, 0, at.p[1] - b.feet.z).normalize();
        const diff = turnTo(h, direction);
        return { direction, turn: THREE.MathUtils.clamp(diff * FOLLOW_GAIN, -FOLLOW_COMFORT, FOLLOW_COMFORT), keep: 0.62 };
      }
      b.follow = takeUp(b, h, false);
      return follow(b, hold, false, dt);
    }
    const near = nearWay(b.feet, FOLLOW_LOSE, f);
    const t = near && wayOn(near.c, near.i, f.dir, b.feet, along, true);
    if (!t) {
      const atEnd = near && (f.dir > 0 ? near.i >= route[f.c].length - 3 : near.i <= 2);
      if (near && !atEnd) {
        // Keep the route when an obstacle temporarily blocks the next step.
        // Releasing it here sent the feet straight on towards the shelves.
        return { turn: 0, keep: 0, direction: new THREE.Vector3() };
      }
      // the end of the line, or pushed off it
      b.follow = null;
      return null;
    }
    f.i = near.i;
    // The feet follow the centreline while the gaze anticipates a bend.
    const direction = t.clone();
    // the bend coming (FOLLOW_ANTICIPATE), less of it the nearer a wall it leads
    if (wayFurther(near.c, near.i, f.dir, further)) {
      blend.copy(t).addScaledVector(further, FOLLOW_ANTICIPATE).normalize();
      const open = THREE.MathUtils.smoothstep(feel.clearance(b.feet, blend.x, blend.z, FOLLOW_SEE_CLEAR), 4, FOLLOW_SEE_CLEAR - 0.5);
      t.addScaledVector(further, FOLLOW_ANTICIPATE * open).normalize();
    }
    // (eased: see FOLLOW_AIM_EASE)
    if (!f.aim || f.aim.dot(t) < 0) f.aim = t.clone();
    else f.aim.lerp(t, 1 - Math.exp(-dt / FOLLOW_AIM_EASE)).normalize();
    t.copy(f.aim);
    let diff = turnTo(h, t);
    // Turning round where the way goes back on itself, the way is straight
    // behind: the shorter way round flips from left to right with every
    // step, and the head swung back and forth on the spot for seconds. Once
    // a long turn has begun, it keeps to its side.
    if (Math.abs(diff) > FOLLOW_ROUND && b.round) diff = b.round * Math.abs(diff);
    b.round = Math.abs(diff) > FOLLOW_ROUND ? Math.sign(diff) : 0;
    // the tightest of the bend coming, and the pace it can be walked at
    const pts = route[f.c];
    let pace = WALK_SPEED;
    for (let k = -2, j = f.i - 2 * f.dir; k <= Math.round(FOLLOW_SLOW_AHEAD / ROUTE_STEP); k++, j += f.dir) {
      if (j < 0 || j >= pts.length) continue;
      const a = pts[Math.max(0, j - 1)], z = pts[Math.min(pts.length - 1, j + 1)];
      const slope = Math.abs(z.y - a.y) / Math.max(0.1, Math.hypot(z.x - a.x, z.z - a.z));
      const bend = Math.min(WALK_SPEED / (1 + slope * 1.5), Math.max(FOLLOW_SLOWEST * WALK_SPEED, FOLLOW_COMFORT / Math.max(1e-6, pts.kappa[j])));
      pace = Math.min(pace, Math.sqrt(bend * bend + 2 * FOLLOW_BRAKE * Math.max(0, k) * ROUTE_STEP));
    }
    const cap = FOLLOW_COMFORT + (FOLLOW_RATE - FOLLOW_COMFORT) * smooth((Math.abs(diff) - 0.8) / 0.8);
    return {
      direction,
      turn: THREE.MathUtils.clamp(diff * FOLLOW_GAIN, -cap, cap),
      keep: Math.min(
        Math.max(0, Math.cos(Math.min(Math.max(0, Math.abs(diff) - FOLLOW_EASY), Math.PI / 2))),
        pace / WALK_SPEED,
      ),
    };
  };
  // A held stride retains its course. A new press can commit a new course.
  const steer = (b, hold, dt) => {
    const press = walkRef?.current.press ?? 0;
    const pressed = hold > 0 && (!b.holding || b.press !== press);
    b.press = press;
    b.holding = hold > 0;
    // Commit gaze only on a new W press. Preserve the rendered view when
    // its yaw becomes the body's course, including any remaining look ease.
    if (pressed && Math.abs(look.current.yaw) > FOLLOW_UNTURNED) {
      const yaw = look.current.yaw;
      turnBody(b, yaw);
      look.current.yaw = 0;
      if (lookRef?.current) lookRef.current.yaw -= yaw;
      b.follow = null;
      b.fresh = false;
      b.omega = 0;
    }
    let g = follow(b, hold, pressed, dt);
    if (g) {
      b.clear = null;
      b.side = 0;
    } else g = guide(b, hold, true);
    // Ease the body's turns independently of the reader's look input.
    b.omega = (b.omega ?? 0) + (g.turn - (b.omega ?? 0)) * (1 - Math.exp(-dt / TURN_EASE));
    if (Math.abs(b.omega) < 1e-4 && !g.turn) b.omega = 0;
    return b.omega === g.turn ? g : { ...g, turn: b.omega };
  };

  // The guiding hand (see ASSIST): how fast to turn the head this frame, and
  // how much of the stride to keep.
  const guide = (b, hold, own) => {
    // (not at the Vertigo's broken rail: that edge is the way on, walked into on purpose)
    const leg = world.legs[placeRef.current];
    const atBreak = leg?.kind === 'fall' && nearTheBreak(leg, pose.position);
    if (!ASSIST || hold <= 0 || b.speed < WALK_SPEED * 0.25 || atBreak) {
      b.clear = null;
      b.side = 0;
      return UNGUIDED;
    }
    // Felt a little at a time: straight on every frame and two of the ways
    // either side by turns, so the whole fan is fresh every fourth frame and
    // no one frame pays for all nine (3 ms of them, shoulders and all, on the
    // machine this was measured on; a third of that a frame).
    const h = heading(b), hx = h.x, hz = h.z;
    const feelAt = (i) => {
      const c = Math.cos(STEER_TRIES[i]), s = Math.sin(STEER_TRIES[i]);
      b.clear[i] = feel.clearance(b.feet, hx * c + hz * s, -hx * s + hz * c, STEER_LOOK);
    };
    if (!b.clear) {
      b.clear = [];
      STEER_TRIES.forEach((_, i) => feelAt(i));
    } else {
      feelAt(0);
      for (let k = 0; k < 2; k++) {
        b.feltAt = (b.feltAt % (STEER_TRIES.length - 1)) + 1;
        feelAt(b.feltAt);
      }
    }
    const ahead = b.clear[0];
    if (ahead >= STEER_LOOK - 0.01) {
      b.side = 0;
      return UNGUIDED;
    }
    const urgency = smooth((STEER_LOOK - ahead) / (STEER_LOOK - STEER_NEAR));
    // Which way: the most open for the least turning — keeping to the side it
    // has already chosen, and, head-on to a wall, the side more open overall.
    let open = 0;
    STEER_TRIES.forEach((a, i) => { open += Math.sign(a) * b.clear[i]; });
    const lean = b.side || Math.sign(open);
    let best = 0, bestScore = ahead;
    STEER_TRIES.forEach((a, i) => {
      if (!i) return;
      const score = b.clear[i] - Math.abs(a) * STEER_COST + (Math.sign(a) === lean ? (b.side ? 2 : 0.5) : 0);
      if (score > bestScore + 1) {
        best = i;
        bestScore = score;
      }
    });
    const keep = 1 - STEER_SLOW * urgency * (best ? 0.3 : 1);
    if (!best || own || reducedMotion) {
      if (own) b.side = 0;
      return { turn: 0, keep };
    }
    const a = STEER_TRIES[best];
    b.side = Math.sign(a);
    return { turn: Math.sign(a) * Math.min(STEER_RATE, Math.abs(a) * STEER_GAIN) * urgency * ASSIST, keep };
  };
  // Natural path turns rotate the body, preserving the head's chosen offset.
  const turnBody = (b, by) => {
    turnQ.setFromAxisAngle(WORLD_UP, by);
    b.base.premultiply(turnQ);
  };

  // Walked up to a doorway that opens somewhere else (doorway.js), on the
  // step just taken from (fromX, fromZ): on into where it opens. Said true if so.
  const throughDoor = (b, fromX, fromZ) => {
    if (!DOORS) return false;
    for (const d of world.doorways ?? []) {
      if (!d.crossed(fromX, fromZ, b.feet.x, b.feet.z)) continue;
      b.feet.x += d.by[0];
      b.feet.z += d.by[1];
      // (the way, and what the guiding hand had felt, were where they stood)
      Object.assign(b, { follow: null, clear: null, side: 0, doorway: true });
      return true;
    }
    return false;
  };

  // A frame of the reader's own walk: the held key's pace, the way they face,
  // the world's say in where the feet can go (body.js), and the eye riding on
  // top of it all — following the floor up and down the treads, dipping once a
  // stride as the walks the piece makes do. Then where that has taken them.
  const stroll = (b, hold, dt) => {
    if (placeRef.current === 3 && world.spiral?.update(b.feet.y)) feel.refresh();
    const g = steer(b, hold, dt);
    if (g.turn) turnBody(b, g.turn * dt);
    const want = hold > 0 ? WALK_SPEED * g.keep : hold < 0 ? -BACK_SPEED : 0;
    const easing = !hold ? WALK_STOP : b.speed * want <= 0 || Math.abs(want) < Math.abs(b.speed) ? WALK_CHECK : WALK_GATHER;
    b.speed += (want - b.speed) * (1 - Math.exp(-dt / easing));
    if (!hold && Math.abs(b.speed) < 0.3) b.speed = 0;
    let moved = 0, stop = null;
    const fromX = b.feet.x, fromZ = b.feet.z;
    // The verified route already provides comfortable room. A second soft
    // wall correction cut its corners and stalled inside the maze's bends.
    // Hard collision and foot support checks still apply to every step.
    const comfort = g.direction && b.follow ? 0 : ROOM;
    if (b.speed) ({ moved, stop } = feel.step(b.feet, (g.direction ?? heading(b)).clone().multiplyScalar(b.speed * dt), comfort));
    if (moved) throughDoor(b, fromX, fromZ);
    // (DEV: who turned the head this frame, how much of the stride was kept, what held the feet)
    if (import.meta.env.DEV) b.dbg = { turn: +g.turn.toFixed(3), keep: +g.keep.toFixed(2), by: b.follow ? 'way' : g.turn ? 'hand' : '', stop: stop ? `${stop}: ${feel.why()}` : '' };
    b.stride += moved;
    b.gait += (clamp01(moved / Math.max(dt, 1e-3) / (WALK_SPEED * 0.4)) - b.gait) * (1 - Math.exp(-dt * 6));
    // Let the torso lift through a tread instead of jolting the eye up with
    // the instant foot contact, especially at the Echo's tall first riser.
    b.eyeY += (b.feet.y + EYE - b.eyeY) * (1 - Math.exp(-dt * 6.5));
    pose.position.set(b.feet.x, b.eyeY, b.feet.z);
    if (!reducedMotion) pose.position.y += (Math.sin((b.stride / STRIDE) * Math.PI) ** 2 - 0.5) * 0.5 * b.gait;
    pose.quaternion.copy(b.base);
    Object.assign(pose, { fov: ROOM_FOV, shift: 0, veil: 0, eye: 1, fade: 0, near: 0.5 });

    const room = roomAt(b.feet, placeRef.current);
    if (room !== null && room !== placeRef.current) {
      placeRef.current = room;
      targetRef.current = room;
    }
    const place = placeRef.current;
    // (through a doorway, the hallway on the far side is not one the reader
    // knows they are in: what they were last told stands until they are in a room)
    if (room !== null) b.doorway = false;
    tellRoam(b, place, room === null ? (b.doorway ? b.between : betweenAt(b.feet)) : null);
    // Looking inward and down near the rail invites a small, cancellable
    // lean. Only sustained intent commits the passage to the next room.
    camera.getWorldDirection(scratch.gaze);
    const leaning = place === 3 && railIntent(b.feet, scratch.gaze, [world.pit.x, world.pit.z]);
    b.lean = leaning ? b.lean + Math.min(dt, 0.1) : 0;
    b.leanAmount = (b.leanAmount ?? 0) + ((leaning ? smooth(b.lean / LEAN_S) : 0) - (b.leanAmount ?? 0)) * (1 - Math.exp(-dt * 6));
    if (!reducedMotion && b.leanAmount) {
      const inward = new THREE.Vector3(world.pit.x - b.feet.x, 0, world.pit.z - b.feet.z).normalize();
      pose.position.addScaledVector(inward, b.leanAmount * 2);
      pose.position.y -= b.leanAmount * 0.5;
    }
    if (b.lean >= LEAN_S) {
        targetRef.current = place + 1;
        onGo?.(place + 1);
    }
    // Into the court at the heart of the maze: the walk's end begins.
    if (place === world.finale?.room && finaleRef.current === null && inCourt(b.feet)) {
      finaleRef.current = 'play';
      onGo?.('heart');
    }
  };

  // `up`: where in the room this move is to leave the reader (see spotAt).
  // `off`: leaving for the next room from the room's vantage, not its floor.
  const startMove = (to, aspect, up = false, off = false) => {
    const from = placeRef.current;
    if (from === null) {
      const end = rooms ? standPose(spotAt(world, to, false)) : eyePose(world.mounts[to], aspect);
      return { ...flightMove(rest, end, rooms ? ROOM_FOV : EYE_FOV, false, FLIGHT_S), to };
    }
    if (bodyRef.current && to !== null && (to === from || Math.abs(to - from) === 1)) {
      if (lookRef?.current) {
        lookRef.current.yaw = 0;
        lookRef.current.pitch = 0;
      }
      return moveFromBody(bodyRef.current, to, up);
    }
    if (to === from) {
      // Inside one room: the climb to its vantage, or the way back down — the
      // same steps either way round. The head is let go of for it like any
      // other walk, so it comes back level on the way.
      const v = vantageAt(world, from);
      const a = standPose(spotAt(world, from, !up)), b = standPose(spotAt(world, from, up));
      const points = asPoints(up ? v.points : [...v.points].reverse());
      return { ...walkMove(points, a.quaternion, b.quaternion), to, up, from };
    }
    if (to === null || Math.abs(to - from) !== 1) {
      // Up to the map (and, for a room that is not next door, down again from there).
      const here = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
      zeroLook();
      return { ...flightMove(rest, here, ROOM_FOV, true, RISE_S), to: null };
    }
    const forward = to > from;
    const leg = world.legs[forward ? from : to];
    // A leg begins and ends at the rooms' own stands — unless the reader sets
    // off from a vantage (`off`), in which case it begins up there (onFromVantage).
    const v = off && leg.kind === 'walk' ? vantageAt(world, from) : null;
    const a = standPose(v ?? world.stands[from]), b = standPose(world.stands[to]);
    // The piece's walks take the head back, so they arrive on the view the
    // room was composed for.
    if (lookRef?.current) {
      lookRef.current.yaw = 0;
      lookRef.current.pitch = 0;
    }
    if (leg.kind === 'fall') {
      const top = standPose(world.stands[forward ? from : to]), bottom = standPose(world.stands[forward ? to : from]);
      return { ...fallMove(leg, top, bottom, !forward), to };
    }
    const way = forward ? leg.points : [...leg.points].reverse();
    const points = asPoints(v ? onFromVantage(v, way) : way);
    return { ...walkMove(points, a.quaternion, b.quaternion), to, from };
  };

  // Setting off on foot from wherever the camera is now (a stand, a vantage,
  // or partway along a walk the piece was doing): the reader's from here on.
  // Null where there is no floor under the eye to stand on.
  const setOff = () => {
    const floor = feel.floorUnder(pose.position);
    if (floor === null) return null;
    return {
      feet: new THREE.Vector3(pose.position.x, floor, pose.position.z),
      eyeY: pose.position.y,
      base: pose.quaternion.clone(),
      speed: 0,
      stride: 0,
      gait: 0,
      lean: 0,
      room: placeRef.current,
      between: null,
      unsaid: true,
      // the guiding hand: how open the way is at each of STEER_TRIES, which
      // of them was felt last, and which side it has chosen to turn to
      clear: null,
      feltAt: 0,
      side: 0,
      // the way, by default: which line and direction the reader is on, if
      // any; whether W was down last frame; whether the reader's own hand
      // was on the head; whether they have not moved from where the piece
      // stood them (from a stand, untouched, W is walking on)
      follow: null,
      holding: false,
      turned: false,
      fresh: !moveRef.current,
    };
  };

  // Which room the feet are in, by the map's own outlines of them, or null in
  // a hallway, on a garden path or out on the lawns.
  // A room other than the one the reader is in counts only ROOM_MARGIN past
  // its outline, so walking along the line between two (the shore between
  // the Fork and the Pavilion) does not flick the HUD from one to the other.
  const ROOM_MARGIN = 4;
  const edge = new THREE.Line3(), edgeAt = new THREE.Vector3(), flatP = new THREE.Vector3();
  // (Where two outlines overlap, the one the reader is in keeps them.)
  const inRoom = (i, need) => {
    const poly = world.overlay.rooms[i];
    let inside = false, margin = Infinity;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [xa, , za] = poly[a], [xb, , zb] = poly[b];
      if ((za > flatP.z) !== (zb > flatP.z) && flatP.x < ((xb - xa) * (flatP.z - za)) / (zb - za) + xa) inside = !inside;
      edge.start.set(xa, 0, za);
      edge.end.set(xb, 0, zb);
      margin = Math.min(margin, edge.closestPointToPoint(flatP, true, edgeAt).distanceTo(flatP));
    }
    return inside && margin >= need;
  };
  const roomAt = (p, current = null) => {
    flatP.set(p.x, 0, p.z);
    if (current !== null && inRoom(current, 0)) return current;
    for (let i = 0; i < world.overlay.rooms.length; i++) if (i !== current && inRoom(i, ROOM_MARGIN)) return i;
    return null;
  };
  // Out of every room: which two the nearest way between rooms joins, if one
  // runs near enough to say so.
  const betweenAt = (p) => {
    const seg = new THREE.Line3(), at = new THREE.Vector3(), q = new THREE.Vector3(p.x, 0, p.z);
    let best = 60, leg = -1;
    world.legs.forEach((l, k) => {
      if (l.kind !== 'walk') return;
      for (let i = 0; i + 1 < l.points.length; i++) {
        seg.start.set(l.points[i][0], 0, l.points[i][2]);
        seg.end.set(l.points[i + 1][0], 0, l.points[i + 1][2]);
        const d = seg.closestPointToPoint(q, true, at).distanceTo(q);
        if (d < best) { best = d; leg = k; }
      }
    });
    return leg < 0 ? null : [leg, leg + 1];
  };
  // The committed walking course. Looking and tilting do not change it.
  const facing = new THREE.Vector3(), turnQ = new THREE.Quaternion();
  const heading = (b) => {
    facing.set(0, 0, -1).applyQuaternion(b.base).setY(0);
    return facing.lengthSq() > 1e-6 ? facing.normalize() : facing.set(0, 0, 0);
  };
  // In the heart of the maze's court: the reader has walked into the finale.
  const inCourt = (p) => {
    const f = world.finale;
    return !!f?.court && Math.abs(p.x - f.heart[0]) < f.court - 3 && Math.abs(p.z - f.heart[1]) < f.court - 3;
  };

  // For headless checks: stand in a room at once.
  useEffect(() => {
    if (!import.meta.env.DEV || !rooms) return undefined;
    window.__worldJump = (i, up = false) => {
      moveRef.current = null;
      bodyRef.current = null;
      placeRef.current = i;
      // Ahead of React: a frame drawn before EntryMap re-renders must not read
      // the old target and fly straight back out.
      targetRef.current = i;
      upRef.current = up && vantageAt(world, i) !== null;
      wishUpRef.current = upRef.current;
      zeroLook();
      onSettle?.(i, upRef.current);
    };
    // Hold the move underway at fraction u of itself (null lets it run on), and
    // feel for the stone from wherever that leaves the eye. Together they are
    // how a walk is checked for what it passes through — see tools/wall-check.mjs.
    window.__worldScrub = (u) => {
      scrubRef.current = u === null || u === undefined ? null : Math.min(0.999, Math.max(0, u));
      const held = moveRef.current;
      if (held && scrubRef.current !== null) {
        held.travelled = scrubRef.current * held.duration;
        if (held.kind === 'walk') held.distance = scrubRef.current * held.length;
      }
    };
    window.__worldScene = scene;
    // (and the body's line of sight, which the halos ask: buildWorld's occlude)
    window.__worldSight = (a, b, short = 0) => feel?.sight(new THREE.Vector3(...a), new THREE.Vector3(...b), short);
    // the finale's numbers: how far its light runs, and where the others start
    window.__worldFinale = () => world.finale?.debug();
    // What a frame of the scene costs, without the rAF clock (a headless page
    // stops getting frames after half a minute): drawn `n` times from where
    // the eye is, each one waited for. The scene alone — no post, no mirror.
    window.__worldBench = (n = 20) => {
      const ctx = gl.getContext(), px = new Uint8Array(4);
      const once = () => { gl.render(scene, camera); ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px); };
      once();
      const t0 = performance.now();
      for (let i = 0; i < n; i++) once();
      return (performance.now() - t0) / n;
    };
    window.__setLightBudget = world.setLightBudget;
    window.__worldProbe = (reach) => probeClearance(scene, camera.position, reach);
    // the pier glasses: where each hangs, its reflection's size, and how many
    // were drawn last frame
    window.__mirrors = () => ({ drawn: world.mirrors?.drawn(), glasses: world.mirrors?.list() });
    // and their dials, live: __glass.budget = 2, __glass.quality = 0.4 ...
    window.__glass = GLASS;
    window.__worldRay = (from, dir, far) => probeRay(scene, from, dir, far);
    // A whole leg felt out at once, without waiting on frames: where the walk
    // from room `from` to room `to` puts the eye, and what is within reach of
    // it there. (The headless clock is not to be trusted with pacing; this asks
    // the move itself.)
    // `from === to` sweeps the room's climb to its vantage instead of a leg.
    // (`down`: with from === to, the way back down from the vantage instead;
    // `off`: with from !== to, the way on set off from the vantage)
    window.__worldSweep = (from, to, n = 40, reach, { down = false, off = false } = {}) => {
      const was = placeRef.current, walking = bodyRef.current;
      placeRef.current = from;
      bodyRef.current = null;
      const move = startMove(to, size.width / Math.max(1, size.height), from === to && !down, off);
      placeRef.current = was;
      bodyRef.current = walking;
      const at = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
      const out = [];
      const fwd = new THREE.Vector3();
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        move.at(u, at);
        // which way the eyes face there, for checking what a walk looks AT
        fwd.set(0, 0, -1).applyQuaternion(at.quaternion);
        out.push({ u: +u.toFixed(3), ...probeClearance(scene, at.position, reach), fwd: fwd.toArray().map((x) => +x.toFixed(3)) });
      }
      return { kind: move.kind, duration: +move.duration.toFixed(2), pivot: move.pivot ?? null, samples: out };
    };
    // Which rooms have somewhere else to stand, for the wall check to sweep the
    // climbs as well as the legs (tools/wall-check.mjs).
    window.__worldVantages = Object.fromEntries(world.stands
      .map((st, i) => [i, st.vantage?.name])
      .filter(([, name]) => name));
    // What the feet are doing: the move the piece is making, or the reader's
    // own walk (where they stand, how fast, which room the map says that is).
    const r1 = (x) => +x.toFixed(1);
    window.__worldWalk = () => ({
      hand: walkRef?.current?.hold ?? null,
      place: placeRef.current,
      target: targetRef.current,
      up: upRef.current,
      frame: liveFrames.current,
      look: {
        yaw: lookRef?.current?.yaw ?? look.current.yaw,
        pitch: lookRef?.current?.pitch ?? look.current.pitch,
        keys: { ...lookRef?.current?.keys },
      },
      camera: camera.position.toArray().map(r1),
      // Observational only: acceptance tests need the rendered gaze, not
      // merely the arrow input's desired yaw while the camera is easing.
      gaze: camera.getWorldDirection(new THREE.Vector3()).toArray().map(v => +v.toFixed(5)),
      origin: world.root.getWorldPosition(new THREE.Vector3()).toArray(),
      pit: world.pit ? { x: world.pit.x, z: world.pit.z, r: world.pit.r } : null,
      body: bodyRef.current && {
        feet: bodyRef.current.feet.toArray().map(r1),
        eyeY: r1(bodyRef.current.eyeY),
        // the body's current course, independent of its gaze
        base: (() => { const f = new THREE.Vector3(0, 0, -1).applyQuaternion(bodyRef.current.base); return [+f.x.toFixed(4), +f.z.toFixed(4)]; })(),
        speed: +bodyRef.current.speed.toFixed(2),
        distanceWalked: +bodyRef.current.stride.toFixed(4),
        // the committed way the feet go
        heading: (() => { const h = heading(bodyRef.current); return [+h.x.toFixed(3), +h.z.toFixed(3)]; })(),
        // how far off what is straight ahead at chest height the feet stand (the room kept, body.js)
        ahead: (() => { const h = heading(bodyRef.current), w = feel.wallAhead(bodyRef.current.feet, h.x, h.z, 60); return w && r1(w.d); })(),
        room: bodyRef.current.room,
        between: bodyRef.current.between,
        dbg: bodyRef.current.dbg ?? null,
      },
      move: moveRef.current && {
        kind: moveRef.current.kind,
        from: moveRef.current.from ?? null,
        to: moveRef.current.to,
        home: !!moveRef.current.home,
        speed: +(moveRef.current.speed ?? 0).toFixed(2),
        distance: r1(moveRef.current.distance ?? 0),
        length: r1(moveRef.current.length ?? 0),
      },
      colliders: feel.count,
      // the way, by default: which line, which sample of it, which way along
      follow: bodyRef.current?.follow ?? null,
    });
    // The way as the free walk follows it, every ROUTE_STEP (eye points).
    window.__worldRoute = () => route.map((pts) => pts.map((p, i) => [r1(p.x), r1(p.y), r1(p.z), +pts.kappa[i].toFixed(3)]));
    // The free walk without the frame clock: set off from where the eye is
    // (if not already walking), face `yaw` radians round from the way the body
    // set off, and take `n` steps of `len` units, as the frame loop would with
    // W held. Says where the feet went and what stopped them. With `guided`,
    // the guiding hand turns the head as it would at a stride (and the trace
    // says where the head ended up, in radians of yaw).
    window.__worldStroll = (yaw, n = 20, len = 2, { guided = false } = {}) => {
      if (!bodyRef.current) {
        moveRef.current = null;
        bodyRef.current = setOff();
        if (!bodyRef.current) return 'no floor under the eye';
      }
      const b = bodyRef.current;
      if (yaw !== null) {
        turnBody(b, yaw - (b.probeYaw ?? 0));
        b.probeYaw = yaw;
        zeroLook();
        b.follow = null;
        b.fresh = false;
        b.holding = false;
      }
      const trace = [];
      const dt = len / WALK_SPEED;
      for (let k = 0; k < n; k++) {
        let keep = 1;
        let g;
        if (guided) {
          b.speed = WALK_SPEED;
          g = steer(b, 1, dt);
          if (g.turn) turnBody(b, g.turn * dt);
          keep = g.keep;
        }
        const way = (g?.direction ?? heading(b)).clone().multiplyScalar(len * keep);
        const fromX = b.feet.x, fromZ = b.feet.z;
        let { moved, stop } = feel.step(b.feet, way, g?.direction && b.follow ? 0 : ROOM);
        if (moved && throughDoor(b, fromX, fromZ)) {
          stop = 'door';
          placeRef.current = roomAt(b.feet, placeRef.current) ?? placeRef.current;
        }
        trace.push([...b.feet.toArray().map(r1), r1(moved), stop && stop !== 'door' ? `${stop}: ${feel.why()}` : stop, +look.current.yaw.toFixed(3), b.follow ? b.follow.dir : 0, b.follow ? b.follow.i : -1]);
      }
      b.speed = 0;
      b.eyeY = b.feet.y + EYE;
      return trace;
    };
    // How open the way is from where the feet stand, at each of the guiding
    // hand's headings (degrees off the way the head faces now).
    // Everywhere a reader's feet can get to from `from` [x, z], a `step` at a
    // time in eight directions, the body's own way (body.js: walls, ledges,
    // water, the room it stands off), within `box` [x0, z0, x1, z1]. Says how
    // many places, and the places themselves as [x, z] — for finding a way out
    // of the dressed world that should not be there.
    window.__worldReach = ({ from, step = 8, box = [-1e9, -1e9, 1e9, 1e9], limit = 60000, room = ROOM }) => {
      const start = feel.floorUnder(new THREE.Vector3(from[0], from[2] ?? 22, from[1]));
      if (start === null) return 'no floor there';
      const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
      const seen = new Set([key(from[0], from[1])]);
      const queue = [[from[0], start, from[1], -1]], out = [], parent = [];
      const feet = new THREE.Vector3(), move = new THREE.Vector3();
      const dirs = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);
      while (queue.length && out.length < limit) {
        const [x, y, z, up] = queue.shift();
        const me = out.length;
        const under = feel.ground(x, y, z);
        // [x, z, the floor's height, what it is, how much of the foot is over nothing]
        out.push([Math.round(x), Math.round(z), +y.toFixed(1), under.what, feel.footing(x, y, z)]);
        parent.push(up);
        for (const [dx, dz] of dirs) {
          // walked, a stride of 2 at a time as the frames take it, not jumped
          // (a jump the width of a hedge lands on its far side)
          feet.set(x, y, z);
          let ok = true;
          for (let k = 0, n = Math.ceil(step / 2); k < n && ok; k++) {
            move.set((dx * step) / n, 0, (dz * step) / n);
            ok = feel.step(feet, move, room).moved >= (step / n) * 0.5;
          }
          if (!ok) continue;
          if (feet.x < box[0] || feet.z < box[1] || feet.x > box[2] || feet.z > box[3]) continue;
          const k = key(feet.x, feet.z);
          if (seen.has(k)) continue;
          seen.add(k);
          queue.push([feet.x, feet.y, feet.z, me]);
        }
      }
      // (`parent`: for each place, the one it was stepped to from — the way there)
      return { count: out.length, capped: out.length >= limit, places: out, parent };
    };
    window.__worldClear = () => {
      const b = bodyRef.current;
      if (!b) return null;
      const h = heading(b);
      return Object.fromEntries(STEER_TRIES.map((a) => {
        const c = Math.cos(a), s = Math.sin(a);
        return [Math.round(THREE.MathUtils.radToDeg(a)), r1(feel.clearance(b.feet, h.x * c + h.z * s, -h.x * s + h.z * c, STEER_LOOK))];
      }));
    };
    // The pond on a dial: __water({ calm: 1.4, glint: 60, moon: 0 }) and look
    // again. Reading it back with no argument prints what it is set to now.
    window.__water = (next) => { Object.assign(WATER, next ?? {}); world.water.redial(); return { ...WATER, lamps: world.water.count(), at: world.water.list() }; };
    window.__worldLook = (yaw, pitch) => {
      look.current.yaw = yaw;
      look.current.pitch = pitch;
      if (lookRef?.current) {
        lookRef.current.yaw = yaw;
        lookRef.current.pitch = pitch;
      }
    };
    // Off the walk altogether, to look AT a thing instead of from where the
    // piece stands: __worldEye({ from: [x, y, z], at: [x, y, z], fov }). Detail
    // work wants to see a stair side-on from across the well, which no stand
    // and no amount of yaw will do. Called with nothing, the eye is the walk's
    // again.
    window.__worldEye = (spec) => {
      eyeRef.current = spec ? { fov: ROOM_FOV, ...spec } : null;
      return eyeRef.current;
    };
    return () => {
      delete window.__worldJump;
      delete window.__worldVantages;
      delete window.__worldWalk;
      delete window.__worldStroll;
      delete window.__worldClear;
      delete window.__worldReach;
      delete window.__worldRoute;
      delete window.__worldLook;
      delete window.__worldEye;
      delete window.__water;
      delete window.__worldScrub;
      delete window.__worldScene;
      delete window.__worldSight;
      delete window.__worldFinale;
      delete window.__setLightBudget;
      delete window.__worldProbe;
      delete window.__mirrors;
      delete window.__glass;
      delete window.__worldSweep;
      delete window.__worldBench;
      delete window.__worldRay;
    };
  });

  // Where the reader's own walk has taken them, said to the HUD when it
  // changes (a React state update is not a per-frame thing): the room they are
  // in — the last one they walked into, out in a hallway — and, out of every
  // room, which two the way they are on runs between. `entered`: a room they
  // had not been standing in.
  const tellRoam = (b, room, between) => {
    const key = between ? between.join('-') : null;
    const was = b.between ? b.between.join('-') : null;
    if (room === b.room && key === was && !b.unsaid) return;
    const entered = room !== b.room;
    b.room = room;
    b.between = between;
    b.unsaid = false;
    if (entered) echoes.current.push(room);
    onRoam?.(room, between, entered);
  };

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const aspect = size.width / Math.max(1, size.height);
    // (A headless check can hurry the moves: swiftshader draws a frame every few seconds.)
    const dt = Math.min(delta, 1 / 24) * ((import.meta.env.DEV && window.__worldSpeed) || 1);
    // Keep a walking pace at ordinary low frame rates; body.step subdivides
    // the movement. A long stall still gets capped instead of jumping ahead.
    const walkDt = Math.min(delta, 0.1) * ((import.meta.env.DEV && window.__worldSpeed) || 1);
    // seconds into the finale, while it plays (finaleMove)
    let film = null;

    // A room the reader is in can ask for two things at once — come down, then
    // walk on. The climb goes first, so a leg never starts from up at a vantage.
    // W or S held — standing, or partway along a walk the piece is doing — and
    // the reader sets off on their own feet from wherever that is. (Not in the
    // air: the flights, the fall and the heart of the maze are films.)
    const hold = walkRef?.current?.hold ?? 0;
    if (rooms && placeRef.current === 3 && !bodyRef.current && !moveRef.current) {
      camera.getWorldDirection(scratch.gaze);
      const feet = new THREE.Vector3(camera.position.x, camera.position.y - EYE, camera.position.z);
      if (railIntent(feet, scratch.gaze, [world.pit.x, world.pit.z])) bodyRef.current = setOff();
    }
    const pieceWalking = moveRef.current?.kind === 'walk' && moveRef.current.started && scrubRef.current === null;
    if (rooms && hold && placeRef.current !== null && !bodyRef.current && finaleRef.current === null
      && (!moveRef.current || pieceWalking)) {
      const b = setOff();
      if (b) {
        bodyRef.current = b;
        moveRef.current = null;
        upRef.current = false;
        // Ahead of React, as __worldJump does: the next frame must not read the
        // old target (or the climb) and carry the reader off to it.
        targetRef.current = placeRef.current;
        wishUpRef.current = false;
      }
    }
    // Starting W from a vantage consumes its request above. Read it after
    // that handoff, or the old request starts another climb this frame and
    // the next W frame interrupts it without capturing the onward route.
    const wishUp = wishUpRef.current && vantageAt(world, placeRef.current) !== null;
    const endingIntent = pendingFinale(finaleRef.current, {
      place: placeRef.current, target: targetRef.current, last: world.finale?.room,
      up: upRef.current, moveKind: moveRef.current?.kind,
    });
    if (!moveRef.current || endingIntent === 'skip') {
      const begin = (to, up, off = false) => {
        const next = startMove(to, aspect, up, off);
        if (!next) {
          targetRef.current = placeRef.current;
          wishUpRef.current = upRef.current;
          onGo?.(placeRef.current);
          return;
        }
        moveRef.current = {
          ...next,
          travelled: reducedMotion ? 1e9 : 0, distance: reducedMotion ? 1e9 : 0, speed: 0,
          arrived: false, started: false,
        };
        bodyRef.current = null;
      };
      const last = world.finale?.room;
      if (endingIntent) {
        // Into the heart: the last room's way on — from the stand at the gate,
        // or from wherever in the court the reader has walked to. Elsewhere in
        // the maze, back to the gate first.
        const b = bodyRef.current;
        if (b && !inCourt(b.feet) && endingIntent !== 'skip') begin(last, false);
        else {
          const from = b && { position: new THREE.Vector3(b.feet.x, b.eyeY, b.feet.z), quaternion: b.base.clone() };
          moveRef.current = {
            ...finaleMove(world, rest, from), to: null, from: last,
            travelled: reducedMotion ? 1e9 : 0, distance: 0, speed: 0, arrived: false, started: false,
          };
          bodyRef.current = null;
          phaseRef.current = null;
        }
      } else if (placeRef.current !== null && wishUp !== upRef.current) {
        // Down off a vantage AND on to the next room: one walk from up there
        // (startMove, `off`), not down to the room's stand and away again.
        const on = targetRef.current;
        if (!wishUp && on !== null && Math.abs(on - placeRef.current) === 1) begin(on, false, true);
        else begin(placeRef.current, wishUp);
      } else if (targetRef.current !== placeRef.current) begin(targetRef.current, false);
    }
    const move = moveRef.current;
    if (move) {
      // Frame time, capped: a machine that drops frames sees the whole move
      // slower, rather than a long frame jumping it to the end.
      if (move.started && scrubRef.current === null) {
        if (move.kind === 'walk') {
          // The body gathers its stride, walks, and slows into the room.
          const want = Math.min(move.paceAt(move.distance), WALK_SPEED * Math.max(0.16, smooth((move.length - move.distance) / WALK_BRAKE)));
          move.speed += (want - move.speed) * (1 - Math.exp(-walkDt / (want < move.speed ? WALK_CHECK : WALK_GATHER)));
          move.distance += move.speed * walkDt;
          move.setGait(clamp01(move.speed / (WALK_SPEED * 0.4)));
        } else move.travelled += dt;
      }
      if (move.kind === 'finale' && finaleRef.current === 'skip') move.travelled = move.duration;
      move.started = true;
      const u = clamp01(scrubRef.current
        ?? (move.kind === 'walk' ? move.distance / move.length : move.travelled / move.duration));
      move.at(u, pose);
      if (move.kind === 'finale') {
        film = u * move.duration;
        const phase = world.finale.phaseAt(film);
        if (phase !== phaseRef.current) {
          phaseRef.current = phase;
          onFinale?.(phase);
        }
      }
      if (import.meta.env.DEV) window.__worldFlight = { u, index: move.to };
      if (!rooms && u >= ARRIVE_AT && !move.arrived) {
        move.arrived = true;
        onArrive?.(move.to);
      }
      if (rooms && move.kind === 'finale' && u >= 1 && scrubRef.current === null) {
        // The end of the walk: on the map, with the walk drawn on it in light.
        moveRef.current = null;
        placeRef.current = null;
        // (ahead of React, or the next frame flies straight back down to the maze)
        targetRef.current = null;
        upRef.current = false;
        phaseRef.current = null;
        onFinale?.('done');
        onSettle?.(null, false);
      } else if (rooms && move.kind !== 'finale' && u >= 1) {
        moveRef.current = null;
        upRef.current = move.up ?? false;
        // Walked back to the stand only so that the move asked for can begin
        // from there (`home`): it begins on the next frame, and nothing has
        // been arrived at.
        if (!move.home) {
          placeRef.current = move.to;
          onSettle?.(placeRef.current, upRef.current);
        }
      }
    } else if (placeRef.current === null) {
      pose.position.copy(rest.position);
      pose.quaternion.copy(rest.quaternion);
      Object.assign(pose, { fov: TILT_FOV, shift: rest.shift, veil: 1, eye: 0, fade: 0, near: rest.distance * 0.05 });
    } else if (bodyRef.current) {
      stroll(bodyRef.current, hold, walkDt);
    } else {
      const s = standPose(spotAt(world, placeRef.current, upRef.current));
      pose.position.copy(s.position);
      pose.quaternion.copy(s.quaternion);
      Object.assign(pose, { fov: ROOM_FOV, shift: 0, veil: 0, eye: 1, fade: 0, near: 0.5 });
    }

    // The head: turned by held keys and drags while standing — and while walking
    // under the reader's own steam, because looking about as you go is most of
    // what walking is for. Only a move
    // the PIECE is making takes the head back, so its arrival lands on the view
    // the room was composed for.
    const wish = lookRef?.current;
    const standing = placeRef.current !== null && !move;
    // Walking and the reader's turn use the same clock. At lower frame rates
    // the animation cap made A/D much weaker than the automatic stair turn.
    const headDt = bodyRef.current ? walkDt : dt;
    if (wish) {
      if (standing) {
        const k = wish.keys ?? {};
        wish.yaw += ((k.left ? 1 : 0) - (k.right ? 1 : 0)) * TURN_RATE * headDt;
        wish.pitch += ((k.up ? 1 : 0) - (k.down ? 1 : 0)) * TILT_RATE * headDt;
      } else {
        wish.yaw = 0;
        wish.pitch = 0;
      }
      wish.pitch = Math.min(PITCH_MAX, Math.max(-PITCH_MAX, wish.pitch));
      const ease = 1 - Math.exp(-headDt * (standing ? 10 : 3));
      look.current.yaw += (wish.yaw - look.current.yaw) * ease;
      look.current.pitch += (wish.pitch - look.current.pitch) * ease;
      // Finish the ease instead of moving by ever smaller fractions of a pixel.
      // Otherwise a released drag can keep thin edges crossing pixel boundaries.
      if (Math.abs(wish.yaw - look.current.yaw) < 1e-5) look.current.yaw = wish.yaw;
      if (Math.abs(wish.pitch - look.current.pitch) < 1e-5) look.current.pitch = wish.pitch;
    }

    camera.position.copy(pose.position);
    camera.quaternion.copy(pose.quaternion);
    if (import.meta.env.DEV && eyeRef.current) {
      const { from, at, fov } = eyeRef.current;
      pose.position.set(...from);
      camera.position.set(...from);
      camera.up.set(0, 1, 0);
      camera.lookAt(...at);
      pose.quaternion.copy(camera.quaternion);
      pose.fov = fov;
      look.current.yaw = 0;
      look.current.pitch = 0;
    }
    if (look.current.yaw || look.current.pitch) {
      scratch.yaw.setFromAxisAngle(WORLD_UP, look.current.yaw);
      scratch.pitch.setFromAxisAngle(LOCAL_X, look.current.pitch);
      camera.quaternion.premultiply(scratch.yaw).multiply(scratch.pitch);
    }
    camera.fov = pose.fov;
    camera.setViewOffset(size.width, size.height, -pose.shift * size.width, 0, size.width, size.height);
    camera.near = pose.near;
    camera.far = rest.distance * 5;
    camera.updateProjectionMatrix();

    world.setVeil(pose.veil);
    world.setEye(pose.eye);
    world.finale?.update(film, { eye: pose.eye, camera });
    // where the reader is looking, too: the Silence's vault is raised by it
    world.tick(t, pose.eye > 0 ? camera.position : null, camera.getWorldDirection(scratch.gaze));
    // ?wpoolshadow=1: the floor's lamp pools shadowed, baked a few lamps a
    // frame once the first seconds' compiling is over (lampPass.js)
    if (world.poolShadows && !world.poolShadows.done && t > 3) world.poolShadows.step(gl, scene);
    let farEye = null;
    for (const d of world.doorways ?? []) farEye = farEye ?? d.farEye();
    world.updateLights(pose.eye > 0.5 ? camera.position : null, dt, farEye);
    // (and the gallery walls near the eye, or near the far side of an open
    // doorway, shelved book by book; the rest painted — see buildWorld's cull)
    world.cull(pose.eye > 0.9 ? camera.position : null, farEye ? [camera.position, farEye] : [camera.position]);
    world.setViewport((size.height * gl.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));

    const e = pose.eye;
    const garden = THREE.MathUtils.smoothstep((camera.position.x - 720) * 0.889 + 20 - camera.position.z, -60, 80);
    // In the Vertigo the air takes the colour of the light at the bottom of the
    // well, and thins enough to let the eye reach it 450 down.
    const pit = world.pit
      ? THREE.MathUtils.smoothstep(world.pit.r + 40 - Math.hypot(camera.position.x - world.pit.x, camera.position.z - world.pit.z), 0, 60)
      : 0;
    // In the Silence the sky's fill, the bounce and the moon all go down by
    // a third, so that what one lamp does not reach falls into the dark
    // ("a single lamp keeps the dark honest"): evenly lit, its plain walls were
    // a third of the frame with nothing on them.
    const hush = world.hush && !dialOff('whush') && !(import.meta.env.DEV && window.__worldHushOff)
      ? THREE.MathUtils.smoothstep(world.hush.r + 10 - Math.hypot(camera.position.x - world.hush.x, camera.position.z - world.hush.z), 0, 60) * e
      : 0;
    const quiet = 1 - 0.35 * hush;
    // The print follows the place: warm and held-down among the walls, cool and
    // full-chroma out under the moon (Grade.js).
    gradePlace.cool = garden * e;
    if (scene.fog) {
      scene.fog.near = logLerp(rest.distance * 1.6, THREE.MathUtils.lerp(THREE.MathUtils.lerp(70, 85, garden), 120, pit), e);
      scene.fog.far = logLerp(rest.distance * 5, THREE.MathUtils.lerp(THREE.MathUtils.lerp(820, 880, garden), 1300, pit), e);
      scene.fog.color.copy(LIBRARY_FOG).lerp(GARDEN_FOG, garden).lerp(PIT_FOG, pit).lerp(MAP_FOG, 1 - e);
    }
    // Over the map the sky and the moon carry the whole honeycomb; down among
    // the walls it is the lamps' room, and the contact shadow can go deep; out
    // in the garden the moon takes it all back.
    const eyeFill = (k) => THREE.MathUtils.lerp(FILL_EYE[k], FILL_GARDEN[k], garden);
    scene.environmentIntensity = THREE.MathUtils.lerp(FILL_MAP.env, eyeFill('env'), e) * FILL_DIAL * quiet;
    world.hemi.intensity = THREE.MathUtils.lerp(FILL_MAP.hemi, eyeFill('hemi'), e) * FILL_DIAL * quiet;
    world.hemi.color.lerpColors(MAP_SKY, LIBRARY_SKY, e).lerp(GARDEN_SKY, garden * e);
    world.hemi.groundColor.lerpColors(LIBRARY_BOUNCE, GARDEN_BOUNCE, garden * e);
    world.moon.intensity = THREE.MathUtils.lerp(FILL_MAP.moon, LIGHT_MESH ? 0.8 : eyeFill('moon'), e) * MOON_DIAL * quiet;
    if (aoRef?.current?.configuration) aoRef.current.configuration.intensity = THREE.MathUtils.lerp(0.9, 2.4, e);
    sky.update(t, camera.position, THREE.MathUtils.smoothstep(e, 0.35, 1));
    // The mirror in the pond — the one second pass over the world this piece
    // has, so it draws only for a reader standing in the garden near enough to
    // water to see one, and never over the map. (The sky goes first: it is in
    // the reflection too.)
    if (!dialOff('wmirror')) {
      // The mirror turns the camera over in the surface, and to do that it
      // reads `camera.matrixWorld` — which r3f does not refresh until its own
      // render pass, AFTER every useFrame has run. Read here it is last frame's
      // camera, so the pond reflected where the reader WAS: a frame behind the
      // world above it, and at twenty frames a second that is fifty
      // milliseconds of the reflection sliding after the room. Fold the pose
      // that was just written into the matrix before handing it over.
      camera.updateMatrixWorld();
      world.water.reflect(gl, scene, camera, e > 0.9 && garden > 0.15 ? world.toWater(camera.position) : Infinity);
    }
    // What the doorways that open somewhere else show (doorway.js): drawn now
    // the eye is where it will be this frame, and only down among the walls.
    if (world.doorways?.length) {
      camera.updateMatrixWorld();
      for (const d of world.doorways) {
        if (DOORS && e > 0.9) d.render(gl, scene, camera, STENCIL, (at) => world.aimFar(at, camera.position));
        else d.hide();
      }
    }
    // What the pier glasses show (mirror.js): after the doorways, whose faces
    // are kept out of them, and only down among the walls.
    if (world.mirrors?.count() && e > 0.9) {
      camera.updateMatrixWorld();
      world.mirrors.render(gl, scene, camera, {
        // (DEV: window.__glassOff = true holds every glass, for an A/B in one sitting)
        live: !dialOff('wglass') && !(import.meta.env.DEV && window.__glassOff),
        hide: world.mirrorHide,
        aim: (at) => world.aimFar(at, camera.position),
      });
    }
    if (fadeRef?.current && Math.abs(pose.fade - lastFade.current) > 0.002) {
      lastFade.current = pose.fade;
      fadeRef.current.style.opacity = pose.fade.toFixed(3);
    }

    if (import.meta.env.DEV) {
      window.__worldState = { place: placeRef.current, up: upRef.current, target: targetRef.current, move: moveRef.current ? moveRef.current.to : 'none' };
    }
    // The moon's map is drawn on the first frame and never again, so a lamp's
    // shadow can be asked for later without redrawing the world's. (It was
    // drawn on the first two of three, from when the world could reach the
    // scene a frame late; the assembly puts it there before this ever runs,
    // and each drawing of the whole world at 4096² was a tenth of a second.)
    liveFrames.current += 1;
    if (liveFrames.current === 1) {
      gl.shadowMap.needsUpdate = true;
    } else {
      if (liveFrames.current === 2) world.moon.shadow.autoUpdate = false;
      if (world.takeShadowRequest?.()) gl.shadowMap.needsUpdate = true;
    }
    // ready once a frame has been drawn whole after the first
    if (!readied.current && liveFrames.current >= 2) {
      readied.current = true;
      requestAnimationFrame(() => {
        mark('ready');
        onReady?.();
      });
      // What the feet will need, built a slice at a time once the first
      // frames have been judged (Governor.jsx's warm-up), nearest the map's
      // first room first.
      if (rooms) feel.warm(new THREE.Vector3(...world.stands[0].eye), 6000);
    }
  });

  return null;
}

// Dials for measuring the frame on real hardware (?wpost=0 composer off,
// ?wshadow=0 no shadow map, ?wfx=0 no additive glows, ?wmirror=0 no reflection
// in the pond, ?wdpr=0.75 pinned ratio, ?wgrain=0 no film grain,
// ?wsieve=0 no NaN sieve, ?wbloom=on restores the bloom,
// ?wmsaa=4 multisampling — and read the
// note over the composer before trusting that last one).
const DIAL = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
const dialOff = (name) => DIAL.get(name) === '0';
const DPR_DIAL = Number(DIAL.get('wdpr')) || null;
// Where a walk STARTS: a ceiling guessed before a frame has been drawn.
// <Governor> measures what it was worth and steps down from here.
const DPR_RANGE = [1, Math.min(DPR_MAX, 1.5)];
// Off, and it has to stay off — see the composer. The dial is here so the next
// person to wonder can sweep every room in one sitting.
const MSAA = Number(DIAL.get('wmsaa')) || 0;
// A stencil in the composer's frame, for the doorways (doorway.js) to mark
// where they are seen and write the far room's depth there. ?wstencil=0: the
// doorway's own depth instead (and the contact shadow sees it as a wall).
const STENCIL = !dialOff('wstencil') && !dialOff('wpost');
// How deep the bloom's mipmap chain goes. FOUR, not the library's eight, and
// this is the fix for a blackout that has now bitten this project twice.
//
// At the reader's own buffer — 1920x912, a 1536x730 window at devicePixelRatio
// 1.25 — the ECHO rendered as a black canvas with the HUD floating over it.
// Only the Echo; every other room came out at its usual luminance. Only above
// a resolution: at 1254x707 the same room is fine. Bisected pass by pass, it is
// the BLOOM (drop it and the room comes back at 59.7 against 2.0), and it is
// not the amount of it — `?wbt=0.99`, which lets almost nothing through the
// luminance filter, and `?wbi=0`, which multiplies the result by zero, are both
// still black. It fails silently: no GL error, no shader error, no context
// loss, `isContextLost()` false, nothing in the console. That is the same
// signature as the multisampling blackout of 2026-08-06 (see Finish.jsx), in
// the same room, through the same pass — and it is why ?wmsaa is still off.
//
// What does fix it is the depth of the mip chain, monotonically: at 8 levels
// the frame is black, at 6 it is 43.5, at 5 it is 55.6, at 4 it is 58.9 and at
// 3 it is 59.6 against 59.7 with no bloom at all. A single unrepresentable
// value early in that chain would explain it — every level averages four of
// its parent's texels, so by the eighth halving one bad texel has reached the
// whole screen, and by the fourth it has not. That is a guess. The measurement
// is not.
//
// It costs almost nothing to look at: in a room that renders correctly at
// both, four levels against eight differ by 0.72% of pixels at more than 8
// levels of luminance and by NOTHING at more than 24. Bloom against no bloom,
// for comparison, is 2% and 0.55%. `?wblevels=8` to see it break again.
const BLOOM_LEVELS = Number(DIAL.get('wblevels')) || 4;
// ...and then: do not use the mip chain AT ALL. Reducing its depth from eight
// to four took the Echo back from a whole black frame, but the reader still saw
// "random black squares that flicker across the screen" — the same failure, in
// tiles rather than all at once. A chain of progressively halved render targets
// is the thing that is breaking on this driver, so the bloom is built the other
// way instead: one Kawase blur at a fixed kernel, no chain, nothing to halve.
// `?wbloom=mip` puts the old path back (with ?wblevels=N) to compare.
// OFF by default in the world tour, 2026-09-22, and this is a real loss taken
// on purpose.
//
// The reader reported black squares flickering across the screen for a week.
// Everything above was tried: the mip chain shortened, then dropped for a
// Kawase kernel, then a sieve put in front of the whole composer so that
// nothing non-finite could reach it (Sanitize.js), and every shader with a
// normalize in it guarded. On the machine this is made on the Kawase path now
// measures IDENTICALLY to having no bloom at all — 55,680 pixels flipping
// lit-to-black per frame against 55,361, which is the room's own dark corners
// sweeping past, and zero black frames in 67. On the reader's machine the
// squares survived all of it and merely got smaller as the kernel got smaller.
// Same GPU family, different driver, and nothing left that I can test from
// here.
//
// So it goes off, because a glow is not worth a hole. What is lost is small and
// was measured: against the Kawase bloom, no bloom differs on 1.53% of pixels
// by more than 8 levels and 0.33% by more than 48. What a lamp looks like is
// mostly NOT this pass — it is the hot core (makeGlowMaterial), the halo sprite
// and the cone of lit air, all of which are geometry and all of which stay.
// `?wbloom=on` restores it, `?wbloom=mip` restores the old mip-chain version.
const BLOOM_ON = ['on', 'mip'].includes(DIAL.get('wbloom'));
const BLOOM_MIPMAP = DIAL.get('wbloom') === 'mip';

// Which passes to leave OUT, for bisecting a composer that is drawing nothing:
// ?wpass=bloom,grade,tone,vignette,noise
const NOPASS = (DIAL.get('wpass') || '').split(',').filter(Boolean);
const passOff = (name) => NOPASS.includes(name);
// The print: every number the frame is graded and lit by, on a dial, so the
// look can be SWEPT against the plates' measured key (median luminance
// 0.21-0.30, saturation 0.34-0.52, the top 5% reaching 0.54-0.62 and under a
// tenth of the frame crushed) instead of nudged by eye. `?wsat=.6&wamb=1.4` etc.
const dial = (name, fallback) => (DIAL.has(name) ? Number(DIAL.get(name)) : fallback);

function Dials() {
  const { scene } = useThree();
  useEffect(() => {
    if (!dialOff('wfx')) return;
    scene.traverse((o) => {
      if (o.material && o.material.blending === THREE.AdditiveBlending) o.material.visible = false;
    });
  });
  return null;
}

export default function World(props) {
  const aoRef = useRef(null);
  const budgetRef = useRef(null);
  // What the governor has taken back, in the order it takes it (Governor.jsx's
  // GIVE). The contact shadow is a React thing because the composer owns it;
  // the lamps are not, because the world does.
  const [ao, setAo] = useState(true);
  const onQuality = (q) => {
    if (!q?.give || !q.acted) return;
    if (q.give === 'ao') setAo(false);
    if (q.give === 'lights') budgetRef.current?.(4);
  };
  // No frames while the assembly waits on the shaders (WorldContent).
  const [held, setHeld] = useState(false);
  // The governor starts with the world, not with the canvas: its warm-up
  // (Governor.jsx's WARMUP_MS) is there to let the first frames of the world
  // go unjudged, and the canvas draws an empty sky for seconds before then.
  const [assembled, setAssembled] = useState(false);
  return (
    <Canvas
      className="map-world"
      style={{ position: 'absolute', inset: 0 }}
      frameloop={held ? 'never' : 'always'}
      dpr={DPR_DIAL ?? DPR_RANGE}
      shadows={LIGHT_MESH || dialOff('wshadow') ? false : { type: THREE.PCFShadowMap }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: TILT_FOV, near: 50, far: 20000, position: [720, 2000, 2000] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = Number(DIAL.get('wexp')) || 1.2;
        gl.shadowMap.autoUpdate = false;
      }}
      aria-hidden="true"
    >
      <WorldContent {...props} aoRef={aoRef} budgetRef={budgetRef} onHold={setHeld} onAssembled={setAssembled} />
      <Dials />
      {/* The governor, which this tour did not have. It was written for the
          "flicker when I navigate" on the AMD integrated GPU this piece is made
          on, it says so at the top of its own file — and it was only ever
          mounted in DioramaScene, the PLATE tour. The world tour, which is the
          one a reader actually walks, started at the pixel ceiling
          capability.js guesses before a frame has been drawn and stayed there
          whatever the machine did.
          Measured here with the CPU throttled to that machine's pace: standing
          still the frame is steady to within a level, and turning runs at 84 ms
          — twelve frames a second, while the head turns at 92 degrees a second.
          That is nearly eight degrees, about 170 pixels, of the room jumping
          sideways every frame, and THAT is what reads as blinking. Fill rate is
          what this scene is short of, so pixels are the lever: see Governor.jsx
          for the three things it refuses to do, and ?governor=0 to watch
          without it. */}
      {assembled && <Governor onQuality={onQuality} />}
      {/* Multisampling OFF on the composer: on the AMD/D3D11 machine this
          piece is made on, bloom over a multisampled buffer draws nothing at
          all (see Finish.jsx).
          Re-tested 2026-09-21 and it STILL BITES, but it is worth knowing how
          it hides: it is ROOM-SPECIFIC. With ?wmsaa=4 the Vestibule, Silence,
          Vertigo, the Fork, the Pavilion and the Web of Time all render whole
          — mean luminance within 0.2 of the frame without it — and only the
          ECHO goes out, 62.2 down to 2.5 with 88% of the frame at black. So a
          check on one room, or on four, passes cleanly and says the bug is
          gone. It is not. Sweep every room before believing multisampling is
          safe again, and start with the Echo.
          The loss is real here, unlike in Finish.jsx, whose "MSAA is worth
          nothing on feathered planes" was about the PLATE tour: this room is
          books, balusters, rails and arches, which is nothing but the hard
          silhouettes MSAA exists for, and without it they crawl as the reader
          turns. SMAA is not the substitute — measured worse, twice, for the
          reason set out in Finish.jsx. */}
      {/* The finish, in order: contact shadow where stone meets stone and book
          meets shelf (screen-space, half resolution); light spilling off what
          is truly bright; the tone curve — without it the composer hands HDR
          straight to the screen and every lamp clips to a flat disc; the grade
          (Grade.js); grain, which gives the whole frame one skin and dithers
          the long gradients into dark; and the vignette. (?wao=0 drops the
          occlusion, ?wtm=aces swaps the curve, for judging on real hardware.) */}
      {dialOff('wpost') ? null : (
        <EffectComposer multisampling={MSAA} enableNormalPass={false} frameBufferType={THREE.HalfFloatType} stencilBuffer={STENCIL}>
          {/* FIRST, before anything reads the frame: the sieve (Sanitize.js).
              Nothing that is not a number gets as far as the bloom, because a
              blur spreads NaN as readily as light and paints the result black.
              ?wsieve=0 to watch the squares come back. */}
          {dialOff('wsieve') ? null : <Sanitize />}
          {LIGHT_MESH || dialOff('wao') || !ao ? null : (
            <N8AO ref={aoRef} halfRes screenSpaceRadius aoRadius={34} distanceFalloff={8} intensity={2.4} quality="performance" color="#0a0705" />
          )}
          {LIGHT_MESH || passOff('bloom') || !BLOOM_ON ? null : (
            <Bloom
              luminanceThreshold={dial('wbt', BLOOM_THRESHOLD)}
              luminanceSmoothing={0.28}
              intensity={dial('wbi', BLOOM_INTENSITY)}
              {...(BLOOM_MIPMAP
                ? { mipmapBlur: true, radius: 0.72, levels: BLOOM_LEVELS }
                : { mipmapBlur: false, kernelSize: KernelSize.LARGE })}
            />
          )}
          {/* ACES, not AGX. Measured against the plates AGX held the top 5% of
              the frame down at 0.48 where they reach 0.54-0.62, and left the
              Echo with a 0.28 spread and nothing whatever in the dark — a flat
              beige room. (?wtm=agx to see it again.) */}
          {passOff('tone') ? null : <ToneMapping mode={DIAL.get('wtm') === 'agx' ? ToneMappingMode.AGX : ToneMappingMode.ACES_FILMIC} />}
          {passOff('grade') ? null : <Grade
            saturation={dial('wsat', GRADE.saturation)}
            contrast={dial('wcon', GRADE.contrast)}
            lift={dial('wlift', GRADE.lift)}
            exposure={dial('wexpo', GRADE.exposure)}
            shadowTint={GRADE.shadowTint}
            gold={dial('wgold', GRADE.gold)}
            shadowChroma={dial('wdark', GRADE.shadowChroma)}
          />}
          {/* A separate pass over the graded image, before grain. ?waa=0 is
              the control for comparing the same walk without edge filtering. */}
          {dialOff('waa') ? null : <EdgeAA />}
          {/* Film grain — random every frame, and therefore the one thing in
              the piece that CHANGES while the reader stands perfectly still.
              On a big smooth evenly-lit surface (a gallery floor, most of all)
              that reads as a fine boil rather than as a skin. ?wgrain=0 to
              judge it against nothing. */}
          {props.reducedMotion || dialOff('wgrain') ? null
            : <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={dial('wgrain', 0.06)} />}
          {passOff('vignette') ? null : <Vignette offset={0.28} darkness={0.62} eskil={false} />}
        </EffectComposer>
      )}
    </Canvas>
  );
}
