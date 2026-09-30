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
// the head — and standing is all the piece asks of the reader anywhere, so a
// vantage is how a room offers a second thing to look at.
//
// With `rooms` false (the plate tour) the flight ends at the room's painting
// and onArrive hands the reader on just before it lands.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, N8AO, ToneMapping, Noise, wrapEffect } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { buildWorld } from './buildWorld';
import { GradeEffect, gradePlace } from './Grade';
import { SanitizeEffect } from './Sanitize';
import { EdgeAAEffect } from './EdgeAA';
import { makeSky } from './sky';
import { makeEnvironment } from './effects';
import { probeClearance, probeRay } from './probe';
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
const MAP_FOG = new THREE.Color('#06080c');
const LIBRARY_FOG = new THREE.Color(OLD_PALETTE ? '#14171c' : '#15130f');
const GARDEN_FOG = new THREE.Color('#0b1318');
const PIT_FOG = new THREE.Color('#171009');
const logLerp = (a, b, t) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);

const TILT_ELEVATION = 52 * (Math.PI / 180);
const TILT_FOV = 30;
const EYE_FOV = 50;      // before a painting (the plate tour)
const ROOM_FOV = 58;     // standing in a room
const FLIGHT_S = 3.8;
const RISE_S = 3.4;
const FALL_S = 7.2;
const LEAN_FOV = 68;     // leaning out over the Vertigo's well
const FALL_FOV = 92;     // at full speed down it
// A reader is 18 units tall, so a unit is about 9.4 cm and this is 2.6 m/s: a
// walk with somewhere to be. It was 55 — 5 m/s, a sprint — and at that pace a
// gallery went by in four strides and there was no seeing it. The body takes a
// moment to gather the stride and to put it down (WALK_GATHER), and slows into
// the room over the last stretch (WALK_BRAKE) rather than stopping dead.
const WALK_SPEED = 28;
const WALK_GATHER = 0.7;   // seconds to reach a stride from standing, and back
const WALK_BRAKE = 26;     // units out from the end the body begins to slow
const STRIDE = 11;         // one step, in units — the head dips once a stride
const ARRIVE_AT = 0.9;
const FILL = 1.12;
// ── The key ──────────────────────────────────────────────────────────────────
// What the frame is printed to. The plates this world answers to measure:
// median luminance 0.21-0.30, saturation 0.34-0.52 (0.21-0.43 at the centre),
// the top 5% reaching 0.54-0.62, about 1% of the frame blown out at a lamp and
// 2-8% down in the dark. Every number here was swept against those.
const GRADE = OLD_PALETTE
  ? { saturation: 0.56, contrast: 1.1, lift: 0.03, exposure: 1.06, shadowTint: [0, 0, 0], gold: 0, shadowChroma: 1 }
  : { saturation: 0.7, contrast: 1.08, lift: 0.03, exposure: 1.2, shadowTint: [0, 0, 0], gold: 0.18, shadowChroma: 0.5 };
const BLOOM_THRESHOLD = 0.72;   // a lamp is a light, and light bleeds
const BLOOM_INTENSITY = 0.85;
// The fill: what light there is that no lamp accounts for. Held low down among
// the walls — the lamps have to do the modelling, or every room is one flat
// beige — and opened right up over the map, where the moon carries everything.
const FILL_MAP = { env: 0.75, hemi: 2.0, moon: 2.6 };
const FILL_EYE = { env: 0.84, hemi: 0.95, moon: 0.95 };
// Out in the garden there are no lamps to speak of and the moon is the whole
// light — it has to carry a scene the way six lamps carry a gallery.
const FILL_GARDEN = { env: 1.6, hemi: 1.9, moon: 3.0 };
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

const placeTilted = (cam, d, target) => {
  cam.position.set(target.x, target.y + Math.sin(TILT_ELEVATION) * d, target.z + Math.cos(TILT_ELEVATION) * d);
  cam.up.copy(WORLD_UP);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
};

// Everything the map has to show — every room, the walk, the garden's paths —
// framed inside the window with a margin, as close as the tilt allows. Past
// those points the honeycomb and the stars carry on to every edge.
// With the room card on the left of a wide window, the frame is shifted right
// by a lens offset (not by moving the camera, which would change the view).
const BOUNDS = { right: 0.92, top: 0.84, bottom: -0.86 };
const restPose = (aspect, points, reserveLeft) => {
  const cam = new THREE.PerspectiveCamera(TILT_FOV, aspect, 1, 1e6);
  const box = new THREE.Box3().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const target = box.getCenter(new THREE.Vector3());
  target.y = 40;
  const left = reserveLeft ? -0.5 : -0.9;
  const shift = (left + BOUNDS.right) / 4; // as a fraction of the width
  const fullW = 1000, fullH = 1000 / aspect;
  cam.setViewOffset(fullW, fullH, -shift * fullW, 0, fullW, fullH);
  const v = new THREE.Vector3();
  const fits = (d) => {
    placeTilted(cam, d, target);
    for (const [x, y, z] of points) {
      v.set(x, y, z).project(cam);
      if (v.z > 1 || v.x < left || v.x > BOUNDS.right || v.y > BOUNDS.top || v.y < BOUNDS.bottom) return false;
    }
    return true;
  };
  let lo = 300, hi = 60000;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid; else lo = mid;
  }
  placeTilted(cam, hi, target);
  return { position: cam.position.clone(), quaternion: cam.quaternion.clone(), distance: hi, camera: cam, shift };
};

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
// A walk wants points no two of which are on top of each other.
const asPoints = (pts) => pts
  .map((p) => new THREE.Vector3(...p))
  .filter((p, i, all) => i === 0 || p.distanceTo(all[i - 1]) > 0.5);

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

// A walk is the one move the reader can drive, so it is measured in DISTANCE,
// not in time: `at` takes how far along the way the body is, and the frame loop
// decides how fast that grows (held key, or the piece walking it for them).
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
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const Lp = curve.getLength();
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
const finaleMove = (world, rest) => {
  const f = world.finale;
  const T = f.timeline;
  const st = world.stands[f.room];
  const eyeY = st.eye[1];
  const inside = new THREE.Vector3(f.inside[0], eyeY, f.inside[1]);
  const heartAt = new THREE.Vector3(f.heart[0], eyeY + 4, f.heart[1]);
  const heartDown = new THREE.Vector3(f.heart[0], f.ground, f.heart[1]);
  const start = standPose(st);
  const atHeart = lookQuat(inside, heartAt);
  const walk = walkMove(asPoints([st.eye, inside.toArray()]), start.quaternion, atHeart);
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

function WorldContent({
  budgetRef,
  rooms = false, scenes, target = null, vantage = false, finale = null, reducedMotion = false, lookRef, walkRef, fadeRef, aoRef,
  onReady, onArrive, onSettle, onPace, onFinale, onLayout, reserveLeft = false,
}) {
  const { scene, camera, gl, size } = useThree();
  const world = useMemo(() => buildWorld({ light: LIGHT_MESH, paintings: !rooms }), [rooms]);
  // The one thing the governor reaches into the built world for (see GIVE).
  if (budgetRef) budgetRef.current = world.setLightBudget;

  const sky = useMemo(() => makeSky(), []);
  useEffect(() => {
    scene.add(world.root);
    scene.add(sky.mesh);
    scene.background = new THREE.Color('#03060a');
    scene.fog = new THREE.Fog(MAP_FOG.clone(), 1e4, 2e4);
    const environment = makeEnvironment(gl);
    scene.environment = environment.texture;
    return () => {
      scene.remove(world.root);
      scene.remove(sky.mesh);
      scene.fog = null;
      scene.environment = null;
      environment.dispose();
      world.dispose();
    };
  }, [scene, world, sky, gl]);
  useEffect(() => () => sky.dispose(), [sky]);

  // What the resting camera frames: every room, the walk and the garden paths.
  const framePoints = useMemo(() => [
    ...world.overlay.rooms.flat(), ...world.overlay.walk, ...world.overlay.gardenWalk, ...world.overlay.mazeLeg,
  ], [world]);

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
  useEffect(() => { targetRef.current = target; }, [target]);
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
  // Whose feet the walk is on: null when the piece is carrying the reader (a
  // flight, a fall, a leg walked from the buttons), else 'walking' or 'stopped'
  // — the reader is on a leg under their own steam, and the HUD, the head and
  // the hand all behave differently there.
  const pace = useRef(null);
  const scrubRef = useRef(null);   // DEV: a move held at a fraction of itself
  const eyeRef = useRef(null);     // DEV: the eye taken off the walk (__worldEye)
  const lastFade = useRef(-1);
  const shadowFrames = useRef(0);
  const readied = useRef(false);

  const zeroLook = () => {
    look.current.yaw = 0;
    look.current.pitch = 0;
    if (lookRef?.current) {
      lookRef.current.yaw = 0;
      lookRef.current.pitch = 0;
    }
  };

  // Is a walking key down right now? (A walk begun by the hand belongs to it.)
  const hand = () => (walkRef?.current?.hold ?? 0) !== 0;

  // `up`: where in the room this move is to leave the reader (see spotAt).
  // `off`: leaving for the next room from the room's vantage, not its floor.
  const startMove = (to, aspect, up = false, off = false) => {
    const from = placeRef.current;
    if (from === null) {
      const end = rooms ? standPose(spotAt(world, to, false)) : eyePose(world.mounts[to], aspect);
      return { ...flightMove(rest, end, rooms ? ROOM_FOV : EYE_FOV, false, FLIGHT_S), to };
    }
    if (to === from) {
      // Inside one room: the climb to its vantage, or the way back down — the
      // same steps either way round. The head is let go of for it like any
      // other walk, so it comes back level on the way.
      const v = vantageAt(world, from);
      const a = standPose(spotAt(world, from, !up)), b = standPose(spotAt(world, from, up));
      const points = asPoints(up ? v.points : [...v.points].reverse());
      // The climb is not paced: E asked for it, and E is a switch, not a pedal.
      return { ...walkMove(points, a.quaternion, b.quaternion), to, up, from, auto: 1 };
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
    if (lookRef?.current && !hand()) {
      lookRef.current.yaw = 0;
      lookRef.current.pitch = 0;
    }
    if (leg.kind === 'fall') {
      const top = standPose(world.stands[forward ? from : to]), bottom = standPose(world.stands[forward ? to : from]);
      return { ...fallMove(leg, top, bottom, !forward), to };
    }
    const way = forward ? leg.points : [...leg.points].reverse();
    const points = asPoints(v ? onFromVantage(v, way) : way);
    // Begun with the key down, the walk is the reader's to pace and to stop
    // anywhere along; begun from the buttons, the piece walks it for them.
    // (Walked all the way back, it leaves them where it began: `fromUp`.)
    return { ...walkMove(points, a.quaternion, b.quaternion), to, from, fromUp: !!v, auto: hand() ? 0 : 1 };
  };

  // For headless checks: stand in a room at once.
  useEffect(() => {
    if (!import.meta.env.DEV || !rooms) return undefined;
    window.__worldJump = (i, up = false) => {
      moveRef.current = null;
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
    window.__worldRay = (from, dir, far) => probeRay(scene, from, dir, far);
    // A whole leg felt out at once, without waiting on frames: where the walk
    // from room `from` to room `to` puts the eye, and what is within reach of
    // it there. (The headless clock is not to be trusted with pacing; this asks
    // the move itself.)
    // `from === to` sweeps the room's climb to its vantage instead of a leg.
    // (`down`: with from === to, the way back down from the vantage instead;
    // `off`: with from !== to, the way on set off from the vantage)
    window.__worldSweep = (from, to, n = 40, reach, { down = false, off = false } = {}) => {
      const was = placeRef.current;
      placeRef.current = from;
      const move = startMove(to, size.width / Math.max(1, size.height), from === to && !down, off);
      placeRef.current = was;
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
    // What the feet are doing: the move under way, how fast, and what the hand
    // is asking of it. A hand-paced walk has no clock to read it off.
    window.__worldWalk = () => ({
      hand: walkRef?.current?.hold ?? null,
      demand: walkRef?.current?.demand ?? null,
      pace: pace.current,
      move: moveRef.current && {
        kind: moveRef.current.kind,
        from: moveRef.current.from ?? null,
        to: moveRef.current.to,
        auto: moveRef.current.auto ?? null,
        drive: moveRef.current.drive ?? null,
        speed: +(moveRef.current.speed ?? 0).toFixed(2),
        distance: +(moveRef.current.distance ?? 0).toFixed(1),
        length: +(moveRef.current.length ?? 0).toFixed(1),
      },
    });
    // The pond on a dial: __water({ calm: 1.4, glint: 60, moon: 0 }) and look
    // again. Reading it back with no argument prints what it is set to now.
    window.__water = (next) => { Object.assign(WATER, next ?? {}); world.water.redial(); return { ...WATER, lamps: world.water.count() }; };
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
      delete window.__worldLook;
      delete window.__worldEye;
      delete window.__water;
      delete window.__worldScrub;
      delete window.__worldScene;
      delete window.__worldFinale;
      delete window.__setLightBudget;
      delete window.__worldProbe;
      delete window.__worldSweep;
      delete window.__worldBench;
      delete window.__worldRay;
    };
  });

  // Said once, when it changes: a React state update is not a per-frame thing.
  const tellPace = (next) => {
    if (next === pace.current) return;
    pace.current = next;
    onPace?.(next);
  };

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const aspect = size.width / Math.max(1, size.height);
    // (A headless check can hurry the moves: swiftshader draws a frame every few seconds.)
    const dt = Math.min(delta, 1 / 24) * ((import.meta.env.DEV && window.__worldSpeed) || 1);
    // seconds into the finale, while it plays (finaleMove)
    let film = null;

    // A room the reader is in can ask for two things at once — come down, then
    // walk on. The climb goes first, so a leg never starts from up at a vantage.
    const wishUp = wishUpRef.current && vantageAt(world, placeRef.current) !== null;
    // The map is asked for from anywhere, including halfway down a hallway: a
    // walk the reader has stopped would otherwise hold the camera for ever.
    if (moveRef.current?.kind === 'walk' && targetRef.current === null && placeRef.current !== null) {
      moveRef.current = null;   // (begin, below, tells the HUD the pause is over)
    }
    if (!moveRef.current) {
      const begin = (to, up, off = false) => {
        moveRef.current = {
          ...startMove(to, aspect, up, off),
          travelled: reducedMotion ? 1e9 : 0, distance: reducedMotion ? 1e9 : 0, speed: 0,
          drive: null, arrived: false, started: false,
        };
        tellPace(null);
      };
      const last = world.finale?.room;
      if (last !== undefined && finaleRef.current === 'play' && placeRef.current === last && targetRef.current === last && !upRef.current) {
        // Into the heart: the last room's way on.
        moveRef.current = {
          ...finaleMove(world, rest), to: null, from: last,
          travelled: reducedMotion ? 1e9 : 0, distance: 0, speed: 0, drive: null, arrived: false, started: false,
        };
        phaseRef.current = null;
        tellPace(null);
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
          // The reader's own pace: the key they are holding, until they hand it
          // back (the nav buttons, which finish the leg or bring them back).
          const asked = walkRef?.current?.demand;
          if (asked !== null && asked !== undefined) {
            move.auto = asked;
            walkRef.current.demand = null;
          }
          move.drive = move.auto || (walkRef?.current?.hold ?? 0);
          const ahead = move.drive < 0 ? move.distance : move.length - move.distance;
          const want = move.drive * WALK_SPEED * Math.max(0.16, smooth(ahead / WALK_BRAKE));
          move.speed += (want - move.speed) * (1 - Math.exp(-dt / WALK_GATHER));
          move.distance = Math.max(0, move.distance + move.speed * dt);
          move.setGait(clamp01(Math.abs(move.speed) / (WALK_SPEED * 0.4)));
          // Standing still on the way is a place to be, not a stalled move: the
          // HUD hands the reader their buttons back, and the head stays theirs.
          const held = Math.abs(move.speed) < 0.6 && move.distance > 0 && move.distance < move.length;
          tellPace(move.auto ? null : held ? 'stopped' : 'walking');
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
      // Arrived — or, having walked back to where this one started, arrived
      // there instead. (At distance 0 the walk's pose IS that room's stand, so
      // settling here is seamless.)
      const backAtTheStart = move.kind === 'walk' && move.drive !== null && move.drive <= 0 && move.distance <= 0;
      if (rooms && move.kind === 'finale' && u >= 1 && scrubRef.current === null) {
        // The end of the walk: on the map, with the walk drawn on it in light.
        moveRef.current = null;
        placeRef.current = null;
        // (ahead of React, or the next frame flies straight back down to the maze)
        targetRef.current = null;
        upRef.current = false;
        phaseRef.current = null;
        tellPace(null);
        onFinale?.('done');
        onSettle?.(null, false);
      } else if (rooms && move.kind !== 'finale' && (u >= 1 || backAtTheStart)) {
        moveRef.current = null;
        placeRef.current = backAtTheStart ? move.from : move.to;
        upRef.current = (backAtTheStart ? move.fromUp : move.up) ?? false;
        tellPace(null);
        onSettle?.(placeRef.current, upRef.current);
      }
    } else if (placeRef.current === null) {
      pose.position.copy(rest.position);
      pose.quaternion.copy(rest.quaternion);
      Object.assign(pose, { fov: TILT_FOV, shift: rest.shift, veil: 1, eye: 0, fade: 0, near: rest.distance * 0.05 });
    } else {
      const s = standPose(spotAt(world, placeRef.current, upRef.current));
      pose.position.copy(s.position);
      pose.quaternion.copy(s.quaternion);
      Object.assign(pose, { fov: ROOM_FOV, shift: 0, veil: 0, eye: 1, fade: 0, near: 0.5 });
    }

    // The head: turned by held keys and drags while standing — and while walking
    // under the reader's own steam, because looking about as you go is most of
    // what walking is for. Only a walk the PIECE is doing takes the head back,
    // so its arrival lands on the view the room was composed for.
    const wish = lookRef?.current;
    const standing = placeRef.current !== null && (!move || pace.current !== null);
    if (wish) {
      if (standing) {
        const k = wish.keys ?? {};
        wish.yaw += ((k.left ? 1 : 0) - (k.right ? 1 : 0)) * TURN_RATE * dt;
        wish.pitch += ((k.up ? 1 : 0) - (k.down ? 1 : 0)) * TILT_RATE * dt;
      } else {
        wish.yaw = 0;
        wish.pitch = 0;
      }
      wish.pitch = Math.min(PITCH_MAX, Math.max(-PITCH_MAX, wish.pitch));
      const ease = 1 - Math.exp(-dt * (standing ? 10 : 3));
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
    world.updateLights(pose.eye > 0.5 ? camera.position : null, dt);
    world.cull(pose.eye > 0.9 ? camera.position : null);
    world.setViewport((size.height * gl.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));

    const e = pose.eye;
    const garden = THREE.MathUtils.smoothstep((camera.position.x - 720) * 0.889 + 20 - camera.position.z, -60, 80);
    // In the Vertigo the air takes the colour of the light at the bottom of the
    // well, and thins enough to let the eye reach it 450 down.
    const pit = world.pit
      ? THREE.MathUtils.smoothstep(world.pit.r + 40 - Math.hypot(camera.position.x - world.pit.x, camera.position.z - world.pit.z), 0, 60)
      : 0;
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
    scene.environmentIntensity = THREE.MathUtils.lerp(FILL_MAP.env, eyeFill('env'), e) * FILL_DIAL;
    world.hemi.intensity = THREE.MathUtils.lerp(FILL_MAP.hemi, eyeFill('hemi'), e) * FILL_DIAL;
    world.hemi.color.lerpColors(MAP_SKY, LIBRARY_SKY, e).lerp(GARDEN_SKY, garden * e);
    world.hemi.groundColor.lerpColors(LIBRARY_BOUNCE, GARDEN_BOUNCE, garden * e);
    world.moon.intensity = THREE.MathUtils.lerp(FILL_MAP.moon, LIGHT_MESH ? 0.8 : eyeFill('moon'), e) * MOON_DIAL;
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
    if (fadeRef?.current && Math.abs(pose.fade - lastFade.current) > 0.002) {
      lastFade.current = pose.fade;
      fadeRef.current.style.opacity = pose.fade.toFixed(3);
    }

    if (import.meta.env.DEV) {
      window.__worldState = { place: placeRef.current, up: upRef.current, target: targetRef.current, move: moveRef.current ? moveRef.current.to : 'none' };
    }
    if (shadowFrames.current < 3) {
      gl.shadowMap.needsUpdate = true;
      shadowFrames.current += 1;
      // the moon's map is drawn in these first frames and never again, so a
      // lamp's shadow can be asked for later without redrawing the world's
      if (shadowFrames.current === 3) world.moon.shadow.autoUpdate = false;
    } else if (world.takeShadowRequest?.()) {
      gl.shadowMap.needsUpdate = true;
    }
    if (!readied.current && shadowFrames.current >= 3) {
      readied.current = true;
      requestAnimationFrame(() => onReady?.());
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
  return (
    <Canvas
      className="map-world"
      style={{ position: 'absolute', inset: 0 }}
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
      <WorldContent {...props} aoRef={aoRef} budgetRef={budgetRef} />
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
      <Governor onQuality={onQuality} />
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
        <EffectComposer multisampling={MSAA} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
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
