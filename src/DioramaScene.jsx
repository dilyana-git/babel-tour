import { useRef, useMemo, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { RITE, RITES, crossingWeight } from './rites';
import { PlateBoundary } from './Failure';
import { LIGHT_MESH, DPR_MAX } from './capability';
import Governor from './Governor';
import Finish from './Finish';
import { BACKDROP_PLATES } from './backdrops';

const FOV = 55;
// Hoisted, and referentially stable on purpose. R3F re-applies the `dpr` prop
// whenever the value it is given changes identity, and a fresh [1, DPR_MAX]
// literal on every render of this component is a new identity every time — which
// would put the ratio back at the ceiling moments after the governor had stepped
// it down, on any re-render at all. One array, made once, changes never.
const DPR_RANGE = [1, DPR_MAX];
const frustumH = (dist) => 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));

// ---------------------------------------------------------------------------
// Shared depth model — a descent through stacked galleries.
//
// Each chapter is its own relief painting (color + depth pair), hung one behind
// the other along -Z like veils in a theatre. The camera dwells PLANE_Z in
// front of the active gallery; descending pushes it toward that relief, which
// dissolves depth-first — near stone melting away with a glowing rim — while
// the next gallery surfaces out of the fog behind it. `descentRef.current` is
// a continuous float in [0, chapters-1]; scene i is the dwelling place at
// descent == i.
// ---------------------------------------------------------------------------

// Distance the camera keeps from the gallery it currently dwells before.
const PLANE_Z = 26;
// Gap between consecutive gallery planes — also how far the camera travels
// per chapter. Kept well short of PLANE_Z so the camera never reaches a relief:
// the veil dissolves long before contact.
const SCENE_SPACING = 14;
// Camera world-z for a continuous descent value.
const camZ = (descent) => -descent * SCENE_SPACING;
// How far the camera can walk forward INTO the gallery it dwells before. This is
// the "immersion" travel — it presses the camera through the slab stack (the near
// cards sweep past) without advancing `descent`, so the veil never dissolves
// while you are stepping in. Kept short of the near slab so you approach, not clip.
// Also bounded by the SOURCE ART: at 15 the camera pressed so close that a card
// filled the frame well past 1:1 texel density and the painting went soft — the
// walk-in was magnifying the image, not revealing it. 10 keeps the deepest stand
// (PLANE_Z − APPROACH = 16) inside the range where the plates still read sharp.
const APPROACH = 10;
// Shared camera world-z: base descent position pressed forward by immersion.
const camZImmersed = (descent, immersion) => camZ(descent) - immersion * APPROACH;
// World-z of gallery plane i.
const planeZ = (i) => -(PLANE_Z + i * SCENE_SPACING);

// --- The opening withdrawal -------------------------------------------------
// The first thing the piece does once the title card lets go: the camera is
// standing IN the room — pressed close, on a long lens, its gaze off on the
// gallery's own lamp — and over seven seconds it draws back out to the dwell,
// squares up, and hands the room over. It is the establishing shot, and it is
// there so the reader's first frame of agency is the WIDEST one the corridor
// has: everything the withdrawal spends (the push, the lens, the swing) is
// ground the reader is then free to cover themselves.
//
// Which is also why every term below is a shape of `intro` that ends at ZERO,
// exactly like the dive's: nothing downstream has to know the opening happened,
// and the state it lands in is the state the tour has always started in.
//
// Tour owns the clock (INTRO_MS there) and eases `introRef` 1 → 0; here it is
// only ever read. The reader's first steer cuts it short — see cutIntro.
//
// This was 7 — inside APPROACH, so the shot opened no tighter than the reader
// could walk. Safe, and INVISIBLE: 7 units of dolly against 9° of lens is a
// 1.67× change in subject size spread over seven seconds, which on a machine
// running at twelve frames a second reads as a still frame. The user asked for
// a cinematic zoom-out and could not see one. 13 opens at 13 units from the
// plate — three nearer than the deepest stand — and with the lens below buys
// 2.6×, which is a reveal rather than a drift.
//
// It does cost some sharpness at the opening instant: past ~15 the plates
// magnify beyond their texel density and go soft (see APPROACH's note). 13 is
// short of that, it is the least important frame in the piece, and it resolves
// to the signed-off framing over the next few seconds — which is what a reveal
// IS. The defocus now riding on top (see DOF) helps rather than hurts here.
// Mutable, like GAIT and DOF, and for the sharpest version of the same reason:
// whether an establishing shot READS is not a thing that can be settled in a
// headless capture, and getting it wrong is invisible rather than broken — the
// first version of this was measured working, in numbers, and could not be seen
// at all on a real screen. From the console, then click through again:
//   __shot()                  → read the current values
//   __shot({ push: 17 })      → open deeper in; { push: 7 } → the timid first cut
//   __shot({ lens: 0.3 })     → a longer lens to open on
//   __intro()                 → re-run the shot without reloading
// Nothing persists: reload restores the constants here.
const SHOT = {
  push: 13,   // world units the camera opens pressed forward
  lens: 0.22, // …and the fraction of the 55° the long lens gives up. Only ever
              // NARROWS: the cards fill the frustum at the dwell, so a frame
              // wider than FOV reaches past the artwork into its mirror margin.
};
// Camera world-z with the opening's push folded in. The atmosphere rides this
// too, so the corridor's air keeps its distance from the eye through the
// withdrawal rather than swelling into frame as the body draws back out of it.
const camZOpening = (descent, immersion, intro) =>
  camZImmersed(descent, immersion) - intro * SHOT.push;
// The pan. The gaze opens turned toward this gallery's own light (the same
// `glowAt` the lamp hangs on) and unwinds to square — bounded to a fraction of
// the frame's width, because the aim is a lean toward the light, not a look
// straight at it: unclamped, a lamp near the plate's edge would swing the frame
// clean off the artwork.
const INTRO_AIM = 0.55;
const INTRO_SWING = 0.13;   // …in dwell-frame widths. Raised with the push: the
                            // opening stands nearer, so the card subtends more
                            // and the same swing has further to go before it
                            // could reach the mirror margin (~60° of 68°).
// …and a touch of the vault, given back as the eye comes down to level.
const INTRO_RISE = 0.05;    // …in dwell-frame heights
// The gaze squares up BEFORE the dolly finishes (it is spent by the time the
// withdrawal has this much left to give), so the shot lands level and then goes
// on opening. A pan that ended with the dolly would read as one mechanical move.
const INTRO_GAZE_SPENT = 0.28;

// --- Walking gait -----------------------------------------------------------
// Translation is the walk; on top of it rides a footstep rhythm so that moving
// through the corridor feels like a body carrying its weight, not a camera on a
// dolly. Each stride is TWO footfalls: the eye dips into every planted step (a
// softened cusp — smooth at the bottom, so it reads as weight, never a jolt)
// and rises through the middle of the stride, while the body sways onto each
// foot in turn with a slight matching roll. The gait is paced by DISTANCE
// travelled (not wall-clock), so it only stirs while you move and comes to rest
// the instant you stop — never a march in place. Crucially it is applied
// DOWNSTREAM of the camera's slow position ease (on its own fast follower):
// fed through the main ease, a ~2 Hz step rhythm gets low-pass-filtered back
// into the very float it is meant to break.
//
// The gait answers only HALF of "it feels like I am floating". The other half
// is vantage, not motion — see EYE_DROP.
// CADENCE IS THE WHOLE TELL, and it is a RATIO, not a speed. A body walking at
// a given pace has a specific step rate; if the stride covers more ground than
// the rhythm accounts for, the eye reads gliding no matter how good the bob is.
// The first pass had 2.8 units/stride at 2.2 u/s = 1.57 footfalls/s: SLOWER
// than a human step rate (~1.9/s, 108-115 steps/min) while travelling FASTER
// than a human walk. Both errors point the same way — too much ground per step
// — which is exactly the "it flies rather than walks" reading.
//
// Now 1.6 units/stride at 1.5 u/s = 1.88 footfalls/s, a real walking cadence,
// and a third less ground covered per second. Change one of these and you must
// re-check the other: the ratio is the thing, WALK.imm in Tour.jsx is the speed.
const STRIDE_LENGTH = 1.6;   // world units per full stride (two footfalls)
const GAIT_SPEED_CAP = 3.2;  // clamp so a fast step-in can't quicken into a jog
// Forward speed at which the gait reaches FULL swing. This has to sit at or
// below the cruising speed or slowing the walk quietly weakens the gait too —
// speedNorm never reaches 1, the bob shrinks, and the slower walk comes out
// MORE floaty rather than less. Kept just under WALK.imm x APPROACH (1.5).
const WALK_REF_SPEED = 1.35;
// Amplitudes, halved from the first pass ("I see too much shake"). The rhythm
// is what carries the walk; the SIZE of it only has to be felt, and past a
// point every unit of extra swing reads as an unsteady camera rather than a
// steady body. The roll came down hardest: rotation is read far more sharply
// than translation, so a head-tilt that measures a fifth of a degree still
// registers as the horizon rocking. `cusp` shapes the dip — higher is rounder
// and briefer at the bottom, so weight lands softly instead of ticking.
// Mutable so the dev hook below can dial them live; treat as constants.
//
// WHY THE NOD CARRIES THIS AND THE BOB CANNOT. Everything in this scene stands
// 16-26 world units away (PLANE_Z 26, less APPROACH 10 when walked in). Camera
// TRANSLATION against content that far off barely changes the view: measured
// live, the 0.05 bob moves the image 3.0 px peak-to-peak at 1080p walked in,
// 1.9 px at the dwell. A first-person walk cue is normally 1-2% of screen
// height — 10-21 px — so the bob was an order of magnitude below the threshold
// where the eye reads it as a body at all. Raising it is not the answer either;
// it would have to grow ~5x to be felt, and a 0.25-unit vertical lurch is a
// stumble, not a step.
//
// ROTATION does not care how far away anything is: 0.57 deg is ~11 px at any
// distance, which lands inside the usual 10-21 px band. It is also what a walking head actually does — the head pitches as
// each foot takes the weight. So the nod is the load-bearing cue here and the
// bob is a supporting detail, which is the reverse of the usual arrangement and
// entirely a consequence of this scene's depth.
const GAIT = {
  bob: 0.05,    // vertical dip into each footfall (subtle by necessity — see above)
  sway: 0.026,  // side-to-side weight shift, once per stride
  roll: 0.022,  // camera roll per unit of sway — the head tips with the weight
  pitch: 0.010, // radians (~0.57 deg) the head nods DOWN as weight lands.
                // ~11 px at 1080p, the low end of the 10-21 px a first-person
                // walk normally moves. Start here and dial with __gait.
  cusp: 1.7,    // exponent rounding the bottom of each dip
};

// --- Eye line ---------------------------------------------------------------
// The other half of "it feels like I am floating", and the half no gait can
// answer: WHERE THE EYE SITS in the picture. Measured across the plates, the
// artwork is consistently rendered from above head height — a standing figure's
// head (which, being distant, marks the render camera's own eye level) lands at
// v≈0.70 in the moonlit labyrinth and v≈0.79 in the gothic library, i.e. two
// to three tenths of the frame BELOW its center. Dwelling on the plate's
// geometric center therefore parks the viewer well above the scene's horizon,
// looking down at its floor.
//
// Moving in makes it worse, not better: the frustum shrinks around the optical
// axis, so the deeper you go the more the ground is cropped away — at full
// immersion the labyrinth's path leaves the frame entirely and there is nothing
// left underfoot. That is the hover in the screenshots.
//
// The fix slides the ARTWORK up on its card (a UV offset) rather than dropping
// the camera. Same framing, but: the sphere-wrap stays centered on the real
// eye, the atmosphere and fog planes stay put, the slabs keep their pixel
// registration (the offset is scaled by each card's `over`, so every layer
// shifts by the same ANGLE), and — the point — the axis now meets the plate at
// its eye line, so the zoom converges there instead of climbing. It is a
// constant: no vertical motion is introduced, at rest or in motion.
//
// Size: the vertical overscan budget is (1 − 1/overscan)/2 ≈ 0.13 of the art,
// the margin that currently sits unused above and below the frame. Spending
// nearly all of it downward is what's available without pushing the artwork's
// bottom edge into frame at the dwell; the resting mouse parallax (±0.7 world
// units) is left as cushion. It does not fully reach the eye line — the plates
// simply do not contain enough floor for that — but it moves the deep framing
// from "the ground is not in the picture" to roughly how the artist framed it.
// The cost is the top of the vault: the dwell now crops 26% off the top of the
// plate instead of 13%. Dial to 0 to see the old, hovering framing.
const OVERSCAN = 1.35;
const EYE_DROP = 0.11;
// The plates' own shape (3376x1440). Hoisted out of the prop default below
// because the turn's geometry has to be measured from it — see BAY_ANGLE.
const ART_ASPECT = 3376 / 1440;

// --- The refusal ------------------------------------------------------------
// A forward step with nowhere to go (the sealed vertigo, the end of the path)
// cannot move the body, but it must still ANSWER it — an input that changes
// nothing at all reads as a broken control. The weight leans into what will not
// open and rocks back: one damped half-swing forward, then a much smaller
// return. Deliberately tiny — a few pixels of apparent motion at the deepest
// stand — so it registers as resistance rather than as travel.
const REFUSE_PUSH = 0.14;    // world units at the crest of the lean
const REFUSE_PERIOD = 0.42;  // seconds for the press-and-return swing
const REFUSE_TIME = 0.9;     // after this the impulse has decayed to nothing

// Plane tessellation. The macro depth now comes from each slab's Z placement,
// not from vertex displacement, so the mesh only needs enough resolution for the
// gentle in-slab relief — far coarser than the old single heightfield.
//
// Halved on both axes for touch and thrift devices, which is a QUARTER of the
// vertices: six slab stacks are in flight at once, so the full figure is ~1.4 M
// quads a frame and a phone GPU does not have that to give. Because the relief
// carried here is gentle by construction, the reduction is very hard to see —
// check it on a desktop with ?coarse=1 rather than taking that on trust.
const SEG_X = LIGHT_MESH ? 120 : 240;
const SEG_Y = LIGHT_MESH ? 60 : 120;

// --- Vortex dive ------------------------------------------------------------
// The library→garden crossing doesn't cut to the garden — it flies the camera
// DOWN the vortex. Everything below rides on a shape of dive-progress that is
// zero at both ends (so the garden arrives upright, centered, at its normal
// dwell) but front-loaded to accelerate: a slow lean-in that gathers into a
// rush, released under the warm flash. Three forces move together so it reads
// as one plunge, not three tics:
//   • DIVE_PLUNGE — the camera actually dollies forward into the core, the
//     spiral walls looming and streaking past. This is what makes it *travel*.
//   • DIVE_AIM    — the gaze swings toward the painted glow so the tunnel mouth
//     rushes up to swallow the frame.
//   • DIVE_BANK   — the whole camera corkscrews into the right-hand spiral.
const DIVE_AIM = 0.78;    // how far the gaze swings to the core — kept where the
                          // banked frame corner still lands on the (3×) cards
const DIVE_PLUNGE = 17;   // world units — at peak the camera reaches the near
                          // band's cards (DEPTH_SPREAD/2 short of the plate),
                          // so the bowl's rim and chains sweep right past
const DIVE_LEAN = 0.3;    // how far the camera body also drifts toward the core
const DIVE_BANK = -0.66;  // ~38°, negative = roll clockwise into the right-hand spiral
// The corkscrew proper. DIVE_BANK is a lean that comes and goes; this is the
// shaft actually turning around the falling body — one whole revolution over
// the fall, in the same clockwise sense the plates all wind. A full turn IS
// upright, so the garden is arrived at level by arithmetic rather than by the
// camera visibly righting itself, and the roll never has to un-happen.
const DIVE_TURNS = 1;
// …paced so the turn is slow at the lip and whips through the deep middle,
// where the vignette owns the periphery and there is least to fix the eye on.
// Zero rate at both ends: the roll starts and lands without a snap.
const spinEase = (p) =>
  0.5 - 0.5 * Math.cos(Math.PI * Math.pow(Math.min(Math.max(p, 0), 1), 1.5));
// The vertigo zoom. The frustum OPENS as the body dives, so the walls streak
// outward past a core that barely changes size — the dolly-zoom, which is what
// the eye reads as falling when the inner ear reports nothing at all. The
// breath on top is the shaft dilating, slow enough to be felt before it is
// seen. Both are fractions of FOV, and both are shapes of the plunge, so the
// garden is always arrived at through the plate's own 55°.
const DIVE_FOV = 0.24;
const DIVE_FOV_BREATH = 0.05;
// Nothing stays where you put it in a fall. Two slow drifts on incommensurate
// periods (so the pattern never repeats and never settles), as fractions of the
// frame — small enough to read as the body failing to hold a line rather than
// as the camera wandering off.
const DIVE_SWIM_X = 0.05;
const DIVE_SWIM_Y = 0.055;
// The woken spiral's DRAW — live from the moment the door opens until the dive
// takes over (nothing announces it; see Tour). Instead of walking straight
// at the plate's center, the gaze turns to look INTO the spiral mouth and the
// walk-in carries the body toward it, so "keep walking" goes to the spiral
// itself, not merely to the front of the painting. DRAW_BASE is how much of
// that turn happens immediately on waking; stepping in (immersion) completes
// it. The lean matches the dive's own: it once ran stronger (0.55), but at
// full walk-in that pressed the camera so close to the right-hand near cards
// that the staircase smeared into a grazing-angle band and the chains tore —
// the AIM is what buries the gaze in the mouth; the body only drifts.
const DRAW_BASE = 0.4;
const DRAW_LEAN = 0.3;
// --- The climb ---------------------------------------------------------------
// The one crossing the tour used to take twice in two different ways: you FELL
// down the spiral into the garden over five seconds, and walked back up it with
// the same seven-second melt as any other corridor step. Going back up is now
// the fall mirrored — shorter, because a way you have already been is shorter.
// CLIMB_HAUL is how hard the shaft pulls the body backwards up itself (negative
// plunge: away from the plate being left), CLIMB_LIFT how far the gaze rises
// with it, as a fraction of the frame's height at the dwell.
const CLIMB_HAUL = 11;
const CLIMB_LIFT = 0.22;
// Fall-shape of dive-progress p∈[0,1]: slow gathering, peak deep past the
// middle, release at the very end. There is NO gold whiteout — the spiral
// stays on screen for the whole visible fall; what covers the plate hand-off
// is the tunnel's own darkness (a near-black veil in Tour that closes as the
// camera buries itself in the throat, ~p 0.7-0.95) — so the plunge must still
// be DEEP through that window and only unwind in the last instants, under the
// dark, with the crossover's forward travel absorbing the release.
//
// The exponent is not a taste dial, it PLACES the peak: sin(p^k·π) crests at
// p = 0.5^(1/k), and the crest has to land where the crossover begins (0.78 in
// Tour's tick) or the fall spends the gap between them travelling BACKWARD out
// of the throat with nothing to absorb it — a half-second of reverse that the
// old 5.2s dive got away with and a long one does not. k = 2.8 puts it exactly
// there, and buys a steeper build on the way: distance under a curve this far
// from linear reads as a body still speeding up when the dark takes the frame.
const diveThrust = (p) =>
  Math.sin(Math.pow(Math.min(Math.max(p, 0), 1), 2.8) * Math.PI);
// The warm gold the kindled vortex core heartbeats toward once the door opens —
// the lamp becoming a beacon, so the eye knows where the descent now leads.
const WARM_CORE = new THREE.Color('#ffc27a');

// The rites of passage — one transition per threshold, drawn from the two rooms
// it joins. The table and the reasoning live in rites.js; what follows is what
// the renderer needs to carry them out. The thresholds themselves are in
// paintingFrag (search "the rite, part").
//
// Master dial: 0 turns every threshold back into the plain depth-melt, which is
// the honest A/B for judging whether a rite earns its keep (__rites(0), live).
const RITE_AMT = 1;
// Where the two rites that reach outside the shader live, looked up rather than
// written twice: the roll belongs to the winding, the stillness to the hush.
const CROSS_WIND = RITES.indexOf(RITE.WIND);
const CROSS_HUSH = RITES.indexOf(RITE.HUSH);
// How far the camera rolls into the stairwell that has no floor, at the middle
// of the winding. Negative for the same reason DIVE_BANK is: the spirals in
// this batch of plates all wind to the right. ~4.5° now rather than ~7° — the
// roll used to accompany a spiral wipe turning the same way and had to be read
// as part of it; alone, it is the whole of the vertigo, and at 7° a slow roll
// with nothing to explain it announces itself as a camera move.
const WIND_ROLL = -0.078;
// Per-rite character for the ring of light hanging in each gap (PortalRings).
// `glow` scales what it gives off, `spin` how fast it turns. The spins are all
// but stopped now: a gate visibly whirling at the mouth of a crossing was the
// same flourish the thresholds themselves have given up, and the ring's job is
// to hang there and be a light. Only the dive still turns at all, because down
// there the whole world is turning.
const RITE_RING = {
  [RITE.ECHO]: { glow: 0.9, spin: 0.04 },
  [RITE.HUSH]: { glow: 0.0, spin: 0.01 }, // nothing lights the way into the Silence
  [RITE.WIND]: { glow: 0.8, spin: 0.06 },
  [RITE.PLUNGE]: { glow: 1.15, spin: 0.2 },
  [RITE.SPLIT]: { glow: 0.8, spin: 0.03 },
  [RITE.FLOOD]: { glow: 0.7, spin: 0.02 },
  [RITE.WEAVE]: { glow: 0.7, spin: 0.04 },
};

// ---------------------------------------------------------------------------
// Layered diorama model. Instead of one embossed billboard per chapter, each
// painting is rebuilt as a paper-theatre: a full-image BACKDROP behind a stack
// of depth-windowed SLABS. Each slab renders only the fragments whose depth
// falls in its band (everything else is discarded by the shader), and sits at a
// Z proportional to that band's depth. So a near chain and the far pit live on
// genuinely separate cards — walking the camera forward slides them past one
// another (real parallax), and a depth cliff no longer stretches one triangle
// across the void: the fragments in the gap simply aren't drawn. The backdrop
// catches whatever the parallax dis-occludes so a hole reveals stone, not fog.
// ---------------------------------------------------------------------------
// How many foreground slabs the depth range [0,1] is sliced into.
const LAYER_COUNT = 5;
// World-Z spread of the slab stack: the near band sits +DEPTH_SPREAD/2 toward
// the camera, the far band the same behind, so there is real room to walk into.
// This is THE depth dial — the parallax between cards (and so how deep the
// scene reads) grows directly with it. Two hard ceilings:
//   • walk-in: at full immersion the camera stands PLANE_Z − APPROACH = 16 in
//     front of the nominal plane, so the near band (+SPREAD/2) must stay
//     comfortably short of that;
//   • chapter interleave: the NEXT gallery's near band sits at
//     −SCENE_SPACING + 0.4·SPREAD and must stay clearly BEHIND this gallery's
//     far band at −0.4·SPREAD, i.e. 0.8·SPREAD < SCENE_SPACING (= 14) with
//     margin — at 18 the garden's candelabras poked through the vortex pit as
//     floating fragments. 16 keeps ~1.2 units of separation.
const DEPTH_SPREAD = 16;
// --- Depth of field ---------------------------------------------------------
// An eye focuses at a distance. Standing at the dwell that costs nothing — the
// whole composition is far enough away to be sharp at once, which is why this
// is scaled to exactly ZERO there and the resting frame is untouched, to the
// pixel. But WALKING IN carries the near band to within ten units of the face
// while the eye is still holding the far vault, and a foreground that stays
// razor-sharp at arm's length is the single loudest tell that this is a picture
// rather than a room: real foregrounds dissolve when you step past them.
//
// It is a MIP BIAS, not a filter — the same mechanism the backdrop and the
// margins already blur with (see blurBias in paintingFrag), which means it
// costs no extra taps at all. That matters more here than elegance would: the
// stack is fill-rate bound, and a multi-tap bokeh would have bought realism
// with exactly the frame rate that realism dies without.
//
// It also earns something back. The plates are magnified past 1:1 by the
// walk-in (see TEX_SHARPEN's note), so the near cards were ALREADY softening as
// the reader stepped in — as a defect, read as "the image got worse". The same
// softness, tied to distance and paired with a sharp background, reads instead
// as the eye doing what eyes do.
// How much is judgement, and judgement about softness cannot be settled on a
// software rasterizer at 1 fps — it needs a real GPU, a real screen and a real
// walk into a room. So it has a dial, in the same spirit as ?finish / ?msaa:
//   ?dof=0     off entirely — the A/B, and the first thing to try if the
//              walk-in ever looks muddy rather than deep
//   ?dof=1.5   halve it;  ?dof=5  overdo it, to see plainly what it is doing
// Mutable so the dev hook below can dial it live — treat as constants. Same
// arrangement, and the same reason, as GAIT.
const DOF = {
  gain: (() => {
    if (typeof window === 'undefined') return 3.0;
    const v = new URLSearchParams(window.location.search).get('dof');
    const n = Number(v);
    return v === null || Number.isNaN(n) ? 3.0 : n;
  })(),   // mip levels at the near band, walked fully in
  max: 2.2, // …and the ceiling, so a dive cannot melt the stack
};
// The backdrop's dis-occlusion fill. See the shader block of the same name.
//
// Mutable and dialled live by window.__fill, because a compile-time constant
// cannot be toggled inside ONE browser session and this has to be A/B'd inside
// one.
//
// CORRECTED 2026-08-18. This comment used to end "an A/B across two headless
// runs is worthless — swiftshader's exposure drifts between runs by more than
// the artifact does (fill on-vs-off differed on 62.6% of pixels, on-vs-on-again
// on 64.1%)". The measurement was right and the diagnosis was wrong. That noise
// is not swiftshader drifting: it is the scene legitimately MOVING — breath,
// drift, gait, a clip waking — so two shots of an unchanged scene differ almost
// everywhere. Send CDP
//     Emulation.setEmulatedMedia
//       { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }
// BEFORE Page.navigate (it sets `reduced`, which zeroes uBreath and keeps clips
// from waking) and the floor collapses from 98.4% of pixels >4/255 to 0.00%,
// max 3. A real change then measured 0.41% of pixels, max 44, localised exactly
// where it belonged. Shoot A / A-again / B and report the A-vs-A control beside
// the A-vs-B number — the control is what makes the number mean anything.
//
// `lo/hi` is the depth ramp dividing the vault from the things carried in front
// of it; `r1/r2` the reach of the two tap rings, as a fraction of plate height.
//   window.__fill({ hi: 0 })   → off (hi <= lo), which is the A/B
//   window.__fill({ r2: 0.2 }) → reach further, for a wider lantern
const FILL = { lo: 0.42, hi: 0.62, r1: 0.045, r2: 0.105 };

// The offline half of the fill above — which plates have an inpainted
// backdrop, and every file a gallery needs before it can be hung.
// See src/backdrops.js.

// Feather (in depth units) blended across each band edge, so neighbouring slabs
// cross-fade into one another instead of showing a hard cutout seam.
const LAYER_FEATHER = 0.07;
// TRIED AND REJECTED, 2026-08-07, so it is not tried again: opening this
// feather to fwidth(depth) — the standard cure for a threshold that snaps under
// a moving camera — to kill the shimmer that crawls along the chains and
// balustrades. The reasoning was that one pixel on a silhouette spans more depth
// than 0.07, making the slab window a hard cut exactly where the flicker is.
//
// The reasoning was wrong, and the measurement is the reason to believe it: on
// this art a pixel spans only ~0.014 of depth even on a cliff (the refined
// depth maps are smooth), so the feather already covers ~5 pixels and a
// derivative-sized feather changes nothing. Pushed to 6x the derivative, on a
// pinned plate, real GPU, frozen camera: the flicker was unchanged (mean 0.249
// against 0.253, peak 97 either way) while the picture AT REST moved by 0.253 —
// i.e. it bought nothing and cost a visible change to the layering. The blunt
// feather x4 test that looked promising was measured on an unpinned plate and
// did not survive pinning.
//
// The shimmer is ordinary temporal aliasing on thin high-contrast silhouettes,
// not a threshold artifact. It is treated where such things are treated: see
// SMAA in Finish.jsx.
// Extension of every card beyond the artwork. The plane is built this much
// wider/taller than the image, and the margins sample past [0,1] where the
// textures' wrap modes fill them. BOTH axes now MIRROR.
//
// X used to repeat (wrap-around: past the right edge you saw the picture's
// left side again, the gallery recurring sideways like the Library itself),
// which had the real virtue of opening the dark right vault back into lit
// arcades where a mirror only doubles the darkness. It was changed because a
// repeat butts the plate's right edge directly against its own left edge, and
// where those differ that joint reads as a hard vertical seam — measured at
// 7-21% mismatch on the original plates and up to 34% on the staircase batch.
// The seam lands at vMargin == 0, precisely the gap the fragment shader's
// margin fog (smoothstep below) does not cover, so it could not be fogged
// away. A mirror makes the discontinuity impossible by construction.
// The trade is the doubled darkness noted above; revert wrapS to
// RepeatWrapping (both the still and the video texture) to get it back.
//
// The artwork's own drawn size is unchanged; only the void beyond it is
// filled. X covers the dive's sideways swing toward the core; Y must be
// generous — the plates are wide but SHORT (2.35:1), and the dive pitches the
// gaze down toward the core, which swings the frame's top edge far past the
// artwork's top. Keep BOTH spans < 3 so neither mirror tiles.
const EXTEND_X = 3.0;
const EXTEND_Y = 2.9;

// --- Turning all the way around ---------------------------------------------
// The sideways extension is not only a cushion for parallax. Mirrored, it is the
// beginning of a PANORAMA: slide the sample window along it (uPan) and the
// reader can turn past the edge of the plate, through its mirrored bay, and
// round to the plate again — a full circle that closes on the room it opened in.
//
// Mirrored repeat lays the plate down in BAYS one artwork wide: bay k holds the
// picture, bay k+1 holds it reversed, and the joint between them is seamless by
// construction (the fold hands back the very edge texel it arrived on). The
// pattern therefore repeats every TWO bays, so a full turn has to span an EVEN
// number of them or the reader completes the circle facing the room's
// reflection rather than the room. Two is the largest even count that is not
// simply the same pair of views gone round twice.
export const TURN_BAYS = 2;
// The angle one bay subtends at the dwelling eye. The turn is split against it:
// near home the whole motion is real camera yaw — the body turning, with all the
// parallax and relief that carries — and the scroll only takes over as that yaw
// saturates. See YAW_SWING in Tour, which owns the split.
export const BAY_ANGLE = 2 * Math.atan(
  (frustumH(PLANE_Z) * OVERSCAN * ART_ASPECT * 0.5) / PLANE_Z
);
// How far the reader must turn off home before the margin fog opens out of the
// way. At rest the fog seals this gallery into its own lit island (that is what
// EXTEND_X's mirror is fogged FOR — an unfogged mirror reads as a duplicated
// room); but a reader who is deliberately turning has to have somewhere to turn
// INTO, and past the first fraction of a bay the mirror is no longer a thing
// that can be hidden. So it opens as they leave and closes as they come back.
const TURN_OPEN_LO = 0.03;
const TURN_OPEN_HI = 0.28;
// Bays are two wide and identical mod two, so the pan can always be carried in
// [-1, 1] — which is what keeps `dHome` below meaningful and stops the shift
// from growing without bound over a long visit.
const wrapBays = (p) => p - TURN_BAYS * Math.round(p / TURN_BAYS);
// Where a point of the ARTWORK (u in [0,1]) has got to on the card once the
// reader has turned `pan` bays away — the nearest of its mirrored copies to the
// gaze. The lamp is placed by this, so the glow keeps sitting on the light it
// belongs to however far round the reader has come.
const bayU = (u, pan) => {
  const centre = 0.5 + pan;             // texture coord the gaze is resting on
  let best = null;
  for (const s of [u, -u]) {            // mirrored repeat puts it at +-u + 2k
    const t = s + TURN_BAYS * Math.round((centre - s) / TURN_BAYS);
    if (best === null || Math.abs(t - centre) < Math.abs(best - centre)) best = t;
  }
  return best - pan;                    // …back into card coordinates
};
// Anisotropic filtering for the painting/video surfaces. Slabs are viewed at a
// grazing angle as the camera walks past and into them; without this the
// stretched samples smear. Three clamps this to the GPU's max at upload, so we
// request a value and let it settle to whatever the card offers.
//
// 16 on a desktop, 8 where the mesh is already reduced.
//
// It was 8 everywhere, and the argument for that is still on the table: the taps
// are a real cost across the whole stack, and 8x against 16x only shows at the
// most extreme grazing angles — which the margin fog-dissolve is already
// softening. Raised anyway, deliberately, as a quality call on the desktop
// where there is headroom for it: the cards ARE read obliquely, both as the
// walk-in sweeps the near ones past the eye and across the whole panorama once
// the reader turns.
//
// The phone path keeps 8. Texture bandwidth is exactly what it is shortest of,
// and the reduction it already accepts everywhere else makes this the wrong
// place to spend.
//
// UNMEASURED. Unlike most numbers in this file this one was not A/B'd on real
// hardware — it is one constant and it reverts cleanly, so if the corridor's
// frame rate is being fought, try it. But look elsewhere first: the fill cost of
// the stack itself dwarfs a filtering tap.
const TEX_ANISOTROPY = LIGHT_MESH ? 8 : 16;
// Unsharp-mask strength applied to the still painting in the fragment shader.
// The relief slabs show the texture overscanned and trilinearly filtered, which
// upscales and softens the already-painterly art; a light high-pass restores the
// edge definition (chains, carvings, balustrades) that filtering washed out.
// Faded out as the surface goes live — the video is low-res and would crunch.
// Keep this LOW. The taps are one texel of the 3376-wide plate apart, which is
// sub-pixel at the gallery mouth but several screen pixels once the walk-in
// magnifies the plate past 1:1 — so the mask's overshoot stops being a crisp
// edge and becomes a visible bright rim on the chains and an engraved-metal
// etch across the stonework. 0.4 rang; this still lifts the filtered softness.
const TEX_SHARPEN = 0.18;
// How much of the living surface replaces the still while a clip runs. This is
// 1.0 — the video takes the surface completely — and it must stay there.
//
// It was 0.82 for a while, keeping a sliver of the sharp 3376-wide painting
// mixed over the (then 944-wide) clip to lend it high-frequency detail. That
// only works while the clip still REGISTERS with the still, and a clip stops
// registering the moment it starts animating — which is its whole job.
// Measured over the batch, two ways it walks off:
//   • the camera dollies. Best-fit centre zoom, first frame vs last: 24 of the
//     45 clips reach 1.15 or more, 8 of them 1.30 or more.
//   • the SUBJECT moves even when the frame does not. 04-gothic-library-var3's
//     clips hold their framing (background registers with the plate at zoom
//     1.00, no offset) and the robed figure still walks out from under its
//     painted self — at 4 s the difference image carries two whole figures.
// So the retained 18% was a static copy of the painting sitting under a moving
// one, and every isolated high-contrast object — that figure above all — drew
// as a visible DOUBLE, one copy trailing the other by however far it had gone.
// (A handful of clips are also globally reframed from frame 0: moonlit-var0-clip0
// at 1.35, starry-var2-clip1 at 1.30, pavilion-var2 at 0.85. Those never
// registered at all, not even at the wake-up.)
//
// The detail that mix was buying is now bought honestly instead: nearly every
// clip is served 2x super-resolved (the `best` chain in Tour — x4plus or
// RealBasicVSR, whichever exists) and VIDEO_SHARPEN high-passes it at its own
// texel spacing. Raising this below 1.0 again brings the ghost back with it.
const LIVE_MAX = 1.0;
// Dev-only override of the still/clip mix, set by __grade({ live }). null =
// normal behaviour; 0 pins the painting, 1 pins the clip. This is the only
// honest way to compare the two surfaces — same scene, same fog, same reveal,
// same frame — because everything else about the render differs between a
// woken and an unwoken gallery, and a headless screenshot cannot be trusted
// to have finished revealing.
let liveOverride = null;
// The dwell keeps breathing. A clip runs one pass (~12 s at videoRate 0.42) and
// then rests on its last frame; after REPLAY_REST seconds of that rest it runs
// again, and goes on doing so for as long as the reader stands there. Without
// this a gallery was alive for twelve seconds of a dwell that can last minutes
// — and since the surface now HOLDS the last frame (see LIVE_MAX) rather than
// settling back to the painting, nothing about it changed again either.
//
// The return to frame 0 is a CUT, not a dissolve. uLive stays pinned at
// LIVE_MAX across it and only the video's own currentTime jumps. This is not a
// shortcut: 24 of the 45 clips end 1.15x or more zoomed from where they began,
// so the last frame and the first do not register, and crossfading two images
// that do not register is precisely the double exposure LIVE_MAX documents.
// Two images that cannot be dissolved can still be cut between.
//
// Raised from 6.0 when the four figure-bearing clips went from 0.38 to 0.58
// (see VIDEO_RATE in Tour). Their passes shortened by ~4.7 s, and since the cut
// is the thing this file already admits cannot be hidden — the end frame and the
// first do not register — shortening the pass without lengthening the rest would
// have bought smoother figures by showing the one unhideable seam ~30% more
// often. The number that matters is the CUT-TO-CUT period, not the rest: it was
// ~19.7 s at 0.38 + 6.0, and is ~19.5 s at 0.58 + 10.5. The seam keeps its
// rhythm; only the motion between seams got finer. Clips still on the slower
// rates simply rest longer, which is the harmless direction.
const REPLAY_REST = 10.5;
// A cut lands softest under the reader's own motion, so once the rest is up the
// replay waits for the next footfall to hide behind. Standing perfectly still
// there are no footfalls, so it gives up waiting after this long and cuts
// anyway — the rest is the rhythm, the footfall is only a bonus.
const REPLAY_GRACE = 2.5;
// How recently a foot must have landed for the cut to ride it (seconds).
const REPLAY_STEP_WINDOW = 0.18;

// ── When a clip does not arrive ─────────────────────────────────────────────
// The elements were created with no `error` listener, which made every way a
// clip can fail to load look identical from the outside AND from the console: a
// gallery that simply never wakes. The worst of them is silent by design — a
// dev server answers a request for a file that is not there with index.html at
// 200, so the element gets a perfectly successful response full of HTML, finds
// nothing it can decode in it, and gives up without a sound. It cost an
// afternoon once. One listener turns the whole class into a line of console.
const MEDIA_FAULT = {
  1: 'aborted',
  2: 'network',
  3: 'decode failed',
  4: 'source not supported',
};
const mediaFault = (el, src) => {
  const code = el.error?.code ?? 0;
  const what = MEDIA_FAULT[code] ?? 'unknown';
  // Code 4 on a path that ought to exist is nearly always the served-index.html
  // trap above, so it is named rather than left as a number to look up.
  const hint = code === 4
    ? ' — check the file is actually there: a dev server answers a missing one'
      + ' with index.html at 200, which decodes as nothing'
    : '';
  console.warn('[clip] %s did not load (%s)%s — the gallery keeps its painting',
    src, what, hint);
};

// ── …and stillness is the whole condition of it ─────────────────────────────
// The replay loop above is for a reader who is STANDING there. The moment they
// steer again — a step, a wheel, a look-around drag, a hand on the plumb ring
// — the gallery stops breathing and settles back to the painting, and it does
// not wake a second time on this visit. The film runs on stillness; moving is
// what ends it, and the painting is what you are left holding to leave on.
//
// "Steering" is deliberate navigation only (see `stir` in Tour): walking,
// panning the gaze, the chain, a chapter jump. A bare mouse MOVE is not
// steering — the pointer is half of what wakes a plate in the first place
// (WAKE_GAZE_RADIUS reads it as looking), so counting a hovering hand as an
// interruption would kill nearly every pass inside its first second.
//
// Leaving the gallery re-arms it as it always has (the dist > 1.1 reset), so
// "does not start again" is bounded by the visit — and since the corridor
// restocks a room that drops out of sight with an unseen variant, coming back
// is a different painting anyway, not the one that was cut short.
const LIVE_RISE = 0.7;
// The settle back to the still, per second, and deliberately far faster than
// the rise. Read LIVE_MAX: a clip ends as much as 1.3x zoomed from the plate
// it animates, so dissolving the two IS the double exposure, and every extra
// tenth of a second is another tenth with the figure drawn twice. It rides the
// reader's own motion — that is what triggered it — which is the same mask
// REPLAY_STEP_WINDOW hides the replay cut behind. At this rate it is done in
// about a fifth of a second: quick enough not to read as a crossfade, soft
// enough not to read as a cut.
const LIVE_SETTLE = 5.0;

// ── What wakes a painting ───────────────────────────────────────────────────
// Arriving in the room used to be enough: the surface woke on proximity alone,
// which meant it happened TO the reader rather than because of anything they
// did. Attention is the better trigger — the room answers being looked at — so
// the first pass now waits until the gaze has rested near the plate's own lamp
// (its glowAt, the point the light comes from and the rites collapse into).
//
// "Gaze" is whichever is nearer: the middle of the frame, or the mouse. Yaw and
// pitch move the camera, so looking around genuinely sweeps the lamp across the
// frame — and a reader driving with the mouse is pointing at what they are
// reading. Either counts; neither is required.
//
// Radius in normalised device coordinates, so it is a fraction of the frame
// rather than a distance in the world, and a lamp at the edge of a wide monitor
// is as reachable as one on a phone. Generous on purpose: this is "looking that
// way", not an aiming test.
let WAKE_GAZE_RADIUS = 0.42;
// How long the gaze must REST there. Long enough that sweeping past the lamp on
// the way to somewhere else does not trip it, short enough that the answer
// still feels like a response to having looked.
let WAKE_GAZE_DWELL = 1.4;
// The patience floor. Attention is the intended trigger, but a reader who walks
// in and simply stands — never moving the mouse, never centring the lamp —
// must not be silently denied the one thing the gallery does. After this long
// in the room the surface wakes anyway. Set it well past WAKE_GAZE_DWELL so
// that looking is still visibly what causes it, and the floor is the exception.
let WAKE_PATIENCE = 6.5;
// …and how long the reader must have been STILL for either clock to be allowed
// to fire (seconds since the last steering — see `stir` in Tour).
//
// Without this the two halves of the design work against each other: a plate
// gets one awakening per visit, and the first steer after it ends the film for
// good (LIVE_SETTLE), so a plate that wakes in the middle of someone walking
// through spends its whole visit on a second and a half of clip and is then
// finished. Better to not have woken: the reader keeps the painting, and the
// gallery still has its film to give if they stop. Set to the gaze dwell, so
// the same rest that counts as looking is the rest that counts as standing.
let WAKE_STILL = 1.4;
// Unsharp strength for the LIVE surface, applied at the video's own texel
// spacing rather than the still's. The still's mask (TEX_SHARPEN) is faded out
// while a clip runs because its taps are one 3376-wide texel apart — far
// sub-pixel on a 944-wide video, so it sharpened nothing and only rang. This
// one taps 1/944 instead, which is the actual scale of the softness you see.
//
// Higher than TEX_SHARPEN on purpose: the clips are encoded at 9-17 Mbps for
// 944x400 (1.0-1.9 bits/px, visually lossless), so there is no block noise or
// mosquito ringing for the high-pass to amplify — only the resampling blur of
// magnifying 944 px across a plate the camera walks into. Keep it under ~0.5;
// past that the overshoot starts drawing bright rims on the chains the same
// way TEX_SHARPEN did at 0.4.
//
// This number is quoted AT VIDEO_SHARPEN_REF WIDTH and scaled per clip (below).
//
// This mask is a difference of samples, so its overshoot scales with whatever
// space the samples are in: 0.34 was dialled against encoded values, and on a
// correctly linear surface the same number reads roughly half as strong (dlin
// /ds is ~0.5 around the midtones of this art). That is why the mask is taken
// in the space VIDEO_LIFT selects, taps and centre alike — at lift 1 the 0.34
// signed off on is the 0.34 being applied. Re-judge it if you ever dial the
// lift down; __grade({ sharpen }) moves it live.
const VIDEO_SHARPEN = 0.34;
// The clip width VIDEO_SHARPEN is quoted for: the super-resolved batch, which
// is what every clip was when it was dialled in.
//
// The mask's taps are one VIDEO texel apart, so on screen the halo is as wide
// as one texel is — and a clip served at half the width draws a halo twice as
// wide from the same number. That is not a subtlety: the two clips with no SR
// twin play from their 832x354 source, and at 0.34 the mask ruled every stair
// tread of the Echo with hard black-and-white etching. Sharpening is bounded by
// the resolution it is applied to, so the strength travels with it: an 832-wide
// clip gets 0.15, a 1664-wide one 0.30, and anything at or above the reference
// keeps the full value (clamped — an unusually large clip is already sharp and
// does not want more).
//
// Keeping strength x radius roughly constant is the usual unsharp trade, and it
// is why this is a scale rather than a per-clip override table: it holds for any
// future delivery at any size, without a list to maintain.
//
// RETUNE THIS WHEN A FULL-WIDTH CLIP LANDS (see X4_FULL_BATCH in Tour.jsx). The
// clamp above was written when nothing exceeded the reference, and it holds the
// strength at 0.34 however wide the clip gets. At 3376 that is the STILL's own
// texel spacing — the same radius TEX_SHARPEN works at — but at nearly twice
// the strength (0.34 against 0.18), so a plate-width clip would be sharpened
// harder than the painting it animates, which is where this mask rings. The
// number to try first is TEX_SHARPEN's 0.18, i.e. let the scale keep falling
// past the reference instead of clamping; judge it on real hardware with
// window.__grade({ sharpen }), which is live and needs no reload.
const VIDEO_SHARPEN_REF = 1888;
const videoSharpenScale = (vw) => Math.min(1, (vw || VIDEO_SHARPEN_REF) / VIDEO_SHARPEN_REF);
// Grade the live surface toward the still it animates, applied to the video
// sample only so the painting itself is untouched. 1.0 / 1.0 = grade off.
//
// BOTH ARE OFF NOW, because the premise they were built on does not survive
// measurement. They were added when the clips looked "pale", but on frame 60 of
// 01-moonlit-labyrinth-var0-clip1 the raw clip already matches its painting:
// mean RGB (29,71,73) against the still's (33,74,75), and signalstats
// YMIN/YLOW/YAVG of 0/12/54 against 0/15/57 — the blacks are not lifted, the
// clip is if anything a touch darker.
//
// What the grade actually did to teal night scenes was wreck their hue.
// Saturation-around-luma has nothing to push green and blue toward when both
// already dominate, so the entire effect lands on draining RED: 29 -> 20 at
// 1.28, then -> 12 once contrast-around-mid-grey pulls the (dark) red down
// further. An image with two thirds of its red removed is turquoise by
// definition, and that — not the codec, the upscale, or the color tags — is
// the cyan cast that kept showing up in screenshots.
//
// If some warmer clip genuinely does look pale, prefer a per-clip override
// (the way VIDEO_RATE already keys pacing per clip) over pushing these global
// numbers back up. Tune live with __grade({ sat, contrast }) in a dev build.
const VIDEO_SATURATION = 1.0;
const VIDEO_CONTRAST = 1.0;
// Exposure on the live surface, applied in the space VIDEO_LIFT selects and
// before the unsharp mask (1 = off, >1 darker). __grade({ gamma }) moves it.
//
// 1.31 was dialled by eye against a surface that was reaching the shader
// undecoded, so it is not exposure physics — it is half of a look, and the
// other half is VIDEO_LIFT. The two are only legible read together, so the
// whole story is told once, there.
const VIDEO_GAMMA = 1.31;
// How far the live sample is pushed back into the sRGB-ENCODED space this
// surface was actually graded in. 1 = the curve the piece was signed off on;
// 0 = the clip sitting physically on the still it animates.
//
// THE WHOLE HISTORY, because it is the only thing that makes this number
// legible — and because the obvious "cleanup" here is to delete it.
//
// For months the woken surface rendered brighter than the painting under it,
// nobody could explain it, and VIDEO_GAMMA was the standing correction (1.37
// by eye, then 1.31 when a darker batch arrived). The cause was finally
// measured in babel-tour/srgb-probe.html: a 0/64/128/192/255 ramp pushed
// through both texture paths and read back off a render target. The still came
// back on the sRGB->linear curve (3, 21, 64, 139, 232); the clip came back as
// the ramp itself (12, 67, 128, 188, 242), through tagged, untagged and
// full-range files alike. three drops the sRGB internal format on the VIDEO
// upload path however `colorSpace` is set, so the shader was handed encoded
// values for the clip and linear ones for the still and then mixed the two —
// 0.502 where 0.216 was meant. That decode is fixed at the source now (see the
// internalFormat line in the VideoTexture setup) and it STAYS fixed: it was a
// real bug and that is the real cure.
//
// But the look the bug produced is the look every clip in this piece was
// judged against, and it was never simply "brighter". Working in encoded
// values and calling them linear IS a tone curve, and the unsharp mask below
// laid another one on top of it: its centre sample had been through the gamma
// while its taps were raw, so on a flat field the mask contributed a constant
// rather than nothing. Measured end to end, the old live surface came out at
//
//     2.36 * s^1.31 - 1.36 * s        (s = the clip's sRGB-encoded value)
//
// — everything under linear 0.024 crushed to true black, everything over 0.06
// lifted 1.20x to 1.25x. On art this dark (these plates run a median linear
// luma of 0.046, measured over 05-impossible-prison-staircases-var16) that is
// the difference between a room with lamps in it and a grey room. Removing it
// did not reveal a better picture. It revealed that the grade had been living
// inside the bug, and took the grade with it: waking a painting stopped
// lighting it up, and the crossfade that used to bring a room to life read as
// the room going dim.
//
// So the curve is written down instead of inherited. At 1.0 this reproduces
// the signed-off surface exactly — the encode is the sRGB OETF, which is
// precisely what the missing decode used to leave behind — with the taps
// encoded alongside the centre, so the mask is the same mask in the same space
// rather than the accidental offset it used to carry. At 0 the clip sits
// physically on the still and the woken plate does not lift at all. Anywhere
// between is a real choice: __grade({ lift: 0.5 }) is live and needs no
// reload.
//
// Judge it on real hardware, one gallery at a time. Headless cannot judge it
// (swiftshader never finishes the reveal, so the still renders near-black and
// poisons every comparison), which is exactly what kept the original fault
// hidden for so long.
const VIDEO_LIFT = 1.0;
// How strongly every card wraps onto the INSIDE OF A SPHERE centered on the
// dwelling eye. Each vertex is pulled toward that eye by this fraction of how
// much farther it sits than the card's on-axis distance — i.e. 1.0 would put
// the whole card on a true sphere of radius uDwellDist around the viewer. The
// pull runs ALONG THE SIGHT LINE, so from the dwell point the image projects
// exactly as it always did (pixel registration between the stacked cards is
// untouched); the curvature reveals itself only through motion — walking in,
// panning the gaze, mouse parallax — as the frame's edges lean in around you
// and the world reads as a concave vault instead of a flat wall.
const SPHERE_WRAP = 0.82;
// Macro Z offset of a slab from the chapter's nominal plane, from its band center.
const macroZ = (center) => (center - 0.5) * DEPTH_SPREAD;
// The backdrop hangs just behind the farthest slab.
const BACKDROP_MACRO = -0.5 * DEPTH_SPREAD - 2;

const paintingVert = /* glsl */`
  // GLSL3 name for the explicit-LOD sampler (three compiles for WebGL2; an
  // identical redefinition is harmless if the prefix already provides it).
  #define texture2DLodEXT textureLod
  uniform sampler2D depthMap;
  uniform float relief;
  uniform float uLive;
  uniform float depthGamma;
  uniform float uTime;
  uniform float uBreath;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uNearKnee;    // depth above which the nearest relief is eased off
  uniform float uNearSquash;  // how hard that nearest band is compressed (1 = off)
  uniform float uBandCenter;  // this slab's band center — the pivot its relief wraps
  uniform float uCurve;       // spherical wrap strength (SPHERE_WRAP)
  uniform float uDwellDist;   // this card's on-axis distance from the dwelling eye
  uniform float uReveal;      // chapter arrival gate (shared with the fragment
                              // stage) — an unrevealed chapter's cards stay flat
  uniform vec2 uUvSpan;       // how far past the artwork the plane reaches; the
                              // margins sample outside [0,1] and the samplers'
                              // wrap modes fill them (sideways repeat, vertical
                              // mirror — see EXTEND_X/Y)
  uniform float uEyeShift;    // slides the artwork UP the card so the plate's
                              // own eye line, not its geometric center, sits on
                              // the camera axis (see EYE_DROP)
  uniform float uPan;         // how far round the reader has turned, in bays,
                              // already divided by this card's own scale-up
  uniform float uOpen;        // 0 at home, 1 once turning — see TURN_OPEN_LO
  varying vec2 vUv;
  varying float vDepth;
  varying float vFog;
  varying float vMargin;      // signed reach into the extension: negative inside
                              // the artwork, 0 at its edge, 1 at the card rim
  varying float vRim;         // reach across the CARD itself: 0 at its center,
                              // 1 at its geometric edge. Unlike vMargin this
                              // cannot travel with the picture, because the
                              // thing it has to keep hidden is the card's edge
  // Ease only the very nearest depths back toward the knee. Foreground rails,
  // rings and chains sit at a hard depth cliff against the far pit; left at full
  // relief they pop so far forward that the flat plane can only span the gap by
  // stretching a triangle edge-on toward the camera — the molten "rubber-sheet"
  // smear. Pulling the nearest band back shortens that span at the source. The
  // squash fades in smoothly from the knee to white (no crease where the relief
  // crosses the knee) and leaves the galleries' own depth, below the knee,
  // untouched — so the descent keeps its drama while the smears mostly close up.
  float relief_remap(float x) {
    float t = smoothstep(uNearKnee, 1.0, x);
    return mix(x, uNearKnee + (x - uNearKnee) * uNearSquash, t);
  }
  void main() {
    // Spread the plane's [0,1] UV across the extended card: the center maps
    // onto the artwork, the margins run past it and the samplers' wrap modes
    // fill them with the painting's own continuation. uEyeShift then slides the
    // sample window DOWN the image (so the picture rides up the card), putting
    // the artwork's eye line on the axis. Everything downstream — the relief
    // sample, the depth-band cutout, vMargin — reads the shifted coordinate, so
    // the sculpt and the silhouettes travel with the picture.
    // uPan then slides that window SIDEWAYS, which is the turn: the card holds
    // still and the panorama runs through it.
    vUv = (uv - 0.5) * uUvSpan + 0.5 + vec2(uPan, -uEyeShift);
    vRim = abs(uv.x - 0.5) * 2.0;
    // How deep into the extension this fragment lies. Two readings of that,
    // crossfaded by the turn. dHome measures from THE artwork — the reading
    // that fogs its mirror away and leaves one lit room standing in the dark.
    // That is right for a reader facing forward and wrong for one turning: it
    // fogs out everything they are turning toward, and never comes back, since
    // it grows without bound as the pan runs on. dBay measures from whichever
    // bay is nearest, so it is periodic — every bay gets the artwork's own
    // clear reading, the circle closes, and there is a world to turn into.
    float uc = vUv.x - 0.5;
    float dHome = abs(uc);
    float dBay = abs(uc - floor(uc + 0.5));
    float dx = mix(dHome, dBay, uOpen);
    vec2 extS = (vec2(dx, abs(vUv.y - 0.5)) - 0.5)
              / max(0.5 * (uUvSpan - 1.0), vec2(1e-4));
    vMargin = max(extS.x, extS.y);
    // The DISPLACEMENT reads the depth 4 mip levels down (~a vertex's worth of
    // texels). The 240x120 vertex grid cannot resolve a 20 px chain anyway: at
    // full resolution a lone vertex landing on the chain spiked the surface and
    // WARPED the painting around it into wavy doubled ghosts (worst around the
    // hanging lamps). Smoothed, thin features lie flat on their card — their
    // depth still places the card itself — while broad forms keep their sculpt.
    // The band cutout below stays on the full-resolution map: silhouettes keep
    // their pixel-sharp registration; only the geometry is low-passed.
    float d = relief_remap(pow(texture2DLodEXT(depthMap, vUv, 4.0).r, depthGamma));
    vDepth = d;
    float breath = 1.0 + sin(uTime * 0.5) * 0.06 * uBreath;
    float ripple = sin(d * 9.0 - uTime * 0.7) * 0.015 * uBreath;
    // Bright compact features that hang on a hard depth cliff — the lanterns,
    // white against the near-black gaps behind them — get sheared when relief
    // displaces the plane across that cliff, smearing a dark rim around them. On
    // the still it barely shows, but the video's soft, drifting edges no longer
    // register against the static depth window and the rim reads plainly. Ease
    // the sculpt off as the surface goes live so the video plays flat; the still
    // keeps its full relief, and it eases back as the camera leaves.
    float liveRelief = relief * (1.0 - clamp(uLive * 1.25, 0.0, 1.0));
    vec3 p = position;
    // Relief now wraps this slab's own band center, so each card carries only a
    // little surface sculpt around its plane; the depth between cards is the
    // slab's macro Z offset (set on the mesh), not this displacement. The
    // margins flatten to a plain card — the wrapped depth map jumps at the
    // repeat seam, and displaced geometry would crease there.
    //
    // Once the turn opens the margins out (vMargin stops reading them as margin
    // at all) the bays keep their sculpt, which is what makes turning into one
    // feel like turning into a room rather than onto a poster; the mirror folds
    // between them are a valley in the depth, not a jump, so nothing creases.
    // The card's own rim still has to lie flat — there is no continuation past
    // it to hold the displaced edge up.
    p.z += ((d - uBandCenter) * liveRelief * breath + ripple * liveRelief)
         * (1.0 - smoothstep(0.0, 0.3, vMargin))
         * (1.0 - smoothstep(0.86, 1.0, vRim));
    // Concave wrap — bend the card onto the inside of a sphere around the
    // dwelling eye (local (0,0,uDwellDist)). The pull is along each vertex's
    // own sight line from that eye, so at the dwell the projection (and the
    // stacked cards' pixel registration) is unchanged; only off-dwell motion
    // reads the curvature, as enclosure. Two gates keep it safe: uReveal holds
    // a chapter still down the corridor flat, so its curled near cards can
    // never lean forward through the gallery in front of them; and the
    // point-blank ease flattens whatever the camera is about to pass through
    // (the dive and the walk-in sweep right past the near cards — a curled
    // card there would bow into the lens).
    float vDist = -(modelViewMatrix * vec4(p, 1.0)).z;
    vec3 toEye = vec3(0.0, 0.0, uDwellDist) - p;
    float rayLen = length(toEye);
    float wrap = (rayLen - uDwellDist) * uCurve * uReveal
               * smoothstep(5.0, 12.0, vDist);
    p += (toEye / rayLen) * wrap;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFog = clamp((-mv.z - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const paintingFrag = /* glsl */`
  #define RITE_PLAIN 0
  #define RITE_ECHO  1
  #define RITE_HUSH  2
  #define RITE_WIND  3
  #define RITE_SPLIT 4
  #define RITE_FLOOD 5
  #define RITE_WEAVE 6
  uniform sampler2D map;
  uniform sampler2D mapVideo;
  uniform sampler2D depthMap;
  uniform float uLive;
  uniform float uTime;
  uniform float uBreath;
  uniform float uFade;
  uniform float depthGamma;
  uniform vec3 uAccent;
  uniform vec3 uFogColor;
  uniform float uDefocus;   // mip levels this card is out of focus by — 0 at the
                            // dwell, rising as the walk-in carries it past the
                            // eye. Per card and per frame; see DOF_GAIN.
  uniform vec2 uTexel;      // 1/imageSize, for the unsharp mask taps
  uniform vec2 uDepthTexel; // 1/depthSize — the depth map is its own resolution,
                            // and the silhouette matting below measures in ITS
                            // texels, not the painting's
  uniform float uSharpen;   // high-pass strength on the still surface
  uniform vec2 uVideoTexel; // 1/videoSize — ~3.6x coarser than uTexel
  uniform float uSharpenVideo; // high-pass strength on the live surface
  uniform float uVideoSat;     // chroma grade on the live surface (1 = off)
  uniform float uVideoContrast;// mid-grey contrast on the live surface (1 = off)
  uniform float uVideoGamma;   // exposure on the live surface (1 = off, >1 darker)
  uniform float uVideoLift;    // how far the live sample is pushed back into the
                               // encoded space it was graded in (1 = the
                               // signed-off curve, 0 = physically on the still)
  uniform float uBandLo;    // this slab only draws depths in (uBandLo, uBandHi);
  uniform float uBandHi;    // the backdrop passes everything (lo<0, hi>1).
  uniform float uFeather;   // soft cross-fade width at each band edge
  uniform float uBackdrop;  // 1 on the hole-filling backdrop card, 0 on the slabs
  uniform vec2 uUvSpan;     // card reach past the artwork (see vertex shader)
  uniform float uReveal;    // 0→1 as the camera crosses INTO this chapter;
                            // gates the near foreground's arrival (see below)
  uniform float uGhost;     // dive-only whole-stack fade: the deepest library
                            // plate GHOSTS out instead of depth-melting (the
                            // melt's shards read terribly at point-blank)
  uniform int uRite;        // which rite this plate's threshold is given (see
                            // the RITES table); 0 (or anything unknown) is the
                            // plain depth-ordered melt this scene shipped with
  uniform float uRiteAmt;   // master dial — 0 puts every crossing back on the melt
  uniform vec2 uGlowUV;     // the plate's own light, in artwork UV (v measured
                            // from the BOTTOM here, unlike scene.glowAt) — the
                            // point the hush collapses into and the wind spirals
                            // around, so each room goes out through its own lamp
  uniform float uArt;       // artwork aspect, so a radius drawn on a 2.35:1
                            // plate comes out round instead of an ellipse
  varying vec2 vUv;
  varying float vDepth;
  varying float vFog;
  varying float vMargin;    // signed reach into the extension (see vertex shader)
  varying float vRim;       // reach across the card itself (see vertex shader)

  // The backdrop's dis-occlusion fill — see FILL and the block that reads this.
  //   x = ramp low, y = ramp high  (y <= x switches the fill off outright)
  //   z, w = reach of the two tap rings, as a fraction of plate HEIGHT (the x
  //          offsets are divided by the aspect, so the rings come out round on
  //          a 2.35:1 plate). The outer ring must clear the widest thing being
  //          painted out or the fill finds no background to pull from.
  uniform vec4 uFill;

  // The live surface's own space. The clip arrives sRGB-DECODED now (the
  // internalFormat line in the VideoTexture setup), which is correct and which
  // is also not the space this surface was graded in — see VIDEO_LIFT for the
  // whole story. This is the sRGB OETF, i.e. exactly what the decode undoes,
  // mixed in by uVideoLift so the grade can be walked back toward physics
  // without touching anything else.
  //
  // EVERY read of mapVideo goes through here, the unsharp's taps included. Not
  // for tidiness: the taps and the centre have to be in the same space or the
  // mask stops being a difference and starts carrying a constant, and a
  // constant here is a black crush. The one asymmetry that remains — centre
  // through the gamma, taps not — is deliberate and load-bearing; it is the
  // crush that made these dark plates read as lit rather than grey, and it is
  // the second half of the curve VIDEO_LIFT documents.
  vec3 videoLift(vec3 c) {
    vec3 enc = clamp(1.055 * pow(c, vec3(0.41666)) - 0.055, 0.0, 1.0);
    return mix(c, enc, uVideoLift);
  }

  // This slab's slice of the depth range, feathered at both edges so
  // neighbouring cards cross-fade into one another instead of butting. The
  // backdrop's band swallows [0,1] whole, so this is 1 everywhere for it.
  float bandWindow(float d) {
    return smoothstep(uBandLo - uFeather, uBandLo + uFeather, d)
         * (1.0 - smoothstep(uBandHi - uFeather, uBandHi + uFeather, d));
  }

  // The same slice, but as the share this card must paint for the stack to
  // composite — back to front, one src-over per card — to a SOLID surface at
  // depth d. That is not the band weight: two cards each taking their honest
  // half of a feathered depth leave a quarter of the pixel unpainted, and what
  // shows through the gap is the backdrop. So the deepest card that owns the
  // depth fills it outright and every card in front of it lays its own share
  // over the top, which sums to exactly one however the feather divides them.
  // (Both are painting the same texel of the same painting, so the result is
  // that texel; only the alpha bookkeeping differs.)
  // What is BEHIND the thing at this UV. Eight taps on a ring pair, each
  // weighted by how FAR it lands: a tap that stays on the near feature counts
  // for nothing, a tap that clears it onto the wall counts fully, so the result
  // converges on the surface the feature stands in front of. Rings rather than
  // a box — a box's corners are its longest reach and dilate into a square
  // bloom. Where nothing within reach is background (deep inside a wide
  // object), fall back to a very high mip: no structure left, but the right
  // tone, which is all a hole filler is ever asked for.
  //
  // Two callers, both filling a hole they must not fill with its own occluder:
  // the backdrop under a dis-occlusion, and a far slab taking its share of a
  // silhouette's cliff.
  vec3 dilateFar(vec2 uv, float bias, float lo, float hi) {
    vec2 rad = vec2(1.0 / uArt, 1.0);   // round on a 2.35:1 plate
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 4; i++) {
      float a = float(i) * 1.5707963;                 // 90°
      for (int k = 0; k < 2; k++) {
        float r   = k == 0 ? uFill.z : uFill.w;
        float ang = a + (k == 0 ? 0.0 : 0.7853982);   // outer ring at 45°
        vec2 o = vec2(cos(ang), sin(ang)) * r * rad;
        float dt = pow(texture2D(depthMap, uv + o).r, depthGamma);
        float w  = 1.0 - smoothstep(lo, hi, dt);
        acc  += texture2D(map, uv + o, bias).rgb * w;
        wsum += w;
      }
    }
    return wsum > 0.08 ? acc / wsum : texture2D(map, uv, bias + 3.5).rgb;
  }

  float fillWindow(float d) {
    float ahead = smoothstep(uBandHi - uFeather, uBandHi + uFeather, d);
    return smoothstep(uBandLo - uFeather, uBandLo + uFeather, d)
         * (1.0 - step(0.999, ahead));
  }

  void main() {
    // How far this fragment sits into the extension margins: 0 across the true
    // artwork, 1 at the card's geometric rim. Hoisted to the top because every
    // rite needs it — the periphery of the world must give way before the
    // picture does, exactly as it does under the plain melt's own e term.
    float e = max(vMargin, 0.0);
    // The crossing's own progress, and the rite governing it. uFade is 0
    // while the plate is at rest and sweeps to 1 as the camera crosses it (in
    // either direction), so this is the one clock every rite runs on.
    float rp = clamp(uFade, 0.0, 1.0);
    int rite = uRiteAmt > 0.001 ? uRite : RITE_PLAIN;
    // Standing on the artwork's own envelope: nothing a rite does may be
    // visible at either rest point, only through the body of the crossing.
    float env = smoothstep(0.0, 0.12, rp) * (1.0 - smoothstep(0.82, 1.0, rp));

    // Radial reach from the plate's own light, normalised so the artwork spans
    // roughly 0..1 and every margin fragment sits at 0.5 or beyond — so the two
    // rites that collapse a room inward take its periphery first. It is what
    // the hush and the winding bend their melt with (part three), and what the
    // hush drains the light along (part two).
    //
    // Behind a uniform branch: this is a length() on every fragment of every
    // card in the stack, and only two of the seven thresholds ever read it.
    vec2 gd = vec2(0.0);
    float reach = 0.0;
    float drainFront = 0.0;
    if (rite == RITE_HUSH || rite == RITE_WIND) {
      gd = (vUv - uGlowUV) * vec2(uArt, 1.0);
      reach = max(clamp(length(gd) / 1.25, 0.0, 1.0), min(1.0, 0.5 + e * 0.8));
      // The line the light goes out along. Paced on pow(rp, 0.8): the outer
      // third of this reach is margin, off-frame, so a linear front would
      // spend a quarter of the crossing draining scenery nobody can see.
      drainFront = 1.08 - 1.30 * pow(rp, 0.8);
    }

    // ── The rite, part one: what the crossing asks of the eye ───────────────
    // NO RITE MOVES THE PICTURE, and none of them draws a shape over it. That
    // is the whole of the second pass at these thresholds. The first gave each
    // crossing a gesture on the picture plane — the room torn down the middle
    // and drawn aside, mirrored under a rippling waterline, quantised into
    // forty sliding threads, superimposed on scaled copies of itself, wiped by
    // a rotating vane — and each was carefully made, but laid side by side the
    // seven of them are the transition menu of a video editor, and nothing
    // else in this piece ever draws ON the artwork. The corridor's own
    // language is light: lamps, fog, focus, the dark between galleries. So a
    // rite is now an OPTICAL event in a lit room — where the light goes out
    // first, how far it still reaches, what it costs the eye to hold the room
    // — and the seven differ in WHICH PART OF THE PICTURE GOES FIRST and how
    // long the light in it outlives the stone. Nothing is painted on.
    //
    // Two scalars are all the geometry any of them needs.
    float sink = 0.0;    // FLOOD: how far under the falling light this fragment lies
    float across = 0.0;  // SPLIT: which side of the room this fragment stands on
    if (rite == RITE_FLOOD) {
      // The Pavilion stands over water and you enter it by letting the room
      // behind you go under. Not a waterline and not a reflection — no surface
      // is drawn at all: a level climbs the plate, and below it the picture
      // loses its focus and its light together, which is what a foot of water
      // does to anything under it. Margin fragments ride LOWER than they are
      // drawn, so the periphery goes under first and the painting itself is
      // the last thing taken; the sink eases in with the crossing, or the
      // whole lower margin would drop out in the first instant.
      float level = -0.15 + rp * 1.35;
      sink = level - (vUv.y - e * 1.9 * smoothstep(0.0, 0.25, rp));
    } else if (rite == RITE_SPLIT) {
      // Two futures, told as a change of light across the room rather than as
      // a cut through it: the lamplight leaves one side as the moon arrives on
      // the other. Feathered across the middle third — never an edge, because
      // an edge is a graphic, and the first pass at this (a literal tear, with
      // the two halves drawn aside and the garden's green poured through the
      // gap) was the most obviously applied thing in the file.
      across = smoothstep(0.26, 0.74, vUv.x);
    }

    // Sample depth per fragment for every visibility decision. vDepth is
    // sampled at the much coarser mesh vertices and interpolated across each
    // triangle; on hairline depth cliffs such as the hanging chains, one white
    // vertex used to spread the foreground slab across the whole triangle and
    // expose it as a broad grey polygon. The direct sample keeps the slab cutout
    // registered to the artwork's actual pixel silhouette.
    float fragmentDepth = pow(texture2D(depthMap, vUv).r, depthGamma);
    // Peripheral focus. The extension margins fall progressively OUT OF FOCUS
    // (mipmap bias), and the defocus begins just INSIDE the artwork's edge —
    // so the wrap/mirror seams land where the image is already soft, and a
    // blurred join has no line to read. The eye reads it as the periphery of
    // vision during the fall; it also hides the fill's repetition.
    // The backdrop is a HOLE FILLER, not a second painting. It passes every
    // depth, so each feature it carries is also drawn — sharp, at full relief —
    // by whichever slab owns that depth. At the dwell point the two copies
    // register pixel-for-pixel and the doubling is invisible; walking in pulls
    // them apart by parallax, and the backdrop's offset copy of a bright thin
    // feature (the chains, above all, against a near-black pit) reads as a ghost
    // outline hugging every high-contrast edge. So the backdrop is blurred
    // hard and sunk toward the fog: what shows through a dis-occlusion is still
    // stone rather than void, but it carries no high frequencies to ring with.
    // The flood adds to it: what has gone under is carried out of focus, and
    // because this is a mip bias rather than a filter it costs nothing and
    // reaches the clip too (see the VideoTexture setup for why that took work).
    // …and the fourth term is the eye's own focus: this card's distance from
    // the reader, spent as blur once they have walked in past it. Zero at the
    // dwell, so the resting frame is exactly the frame it always was.
    float blurBias = smoothstep(-0.08, 0.4, vMargin) * 5.0 + uBackdrop * 3.5
                   + 3.4 * smoothstep(0.0, 0.30, sink)
                   + uDefocus;
    vec4 tex = texture2D(map, vUv, blurBias);

    // ── The backdrop's dis-occlusion fill ───────────────────────────────────
    // MEASURED, on the Vestibule's var17 plate, at the hanging lamp the reader
    // reported as doubled: the lamp's glass globe carries depth 0.674 and every
    // pixel around and below it carries 0.176 — a 0.5 cliff with no transition,
    // so the globe hangs on band 3 while its own housing and the whole vault
    // behind it hang on band 0, the farthest card of five. At the dwell the two
    // register pixel-for-pixel and nothing shows. Walking in slides them apart,
    // and the gap that opens beside the globe is filled by the BACKDROP —
    // which, passing every depth, is carrying its own copy of that same lamp.
    // Blurred by 3.5 mips and sunk 0.35 toward the fog, that copy is precisely
    // the dark lamp-shaped twin standing beside the lit one.
    //
    // (Confirmed by painting the backdrop magenta and walking in: the magenta
    // lands in exactly the twin's silhouette. Worth the two minutes — the same
    // artifact had already been blamed on a fat depth halo and on slab-vs-slab
    // duplication, and both readings were wrong.)
    //
    // Blur was treating frequencies when the fault is CONTENT: a lamp blurred
    // is still lamp-shaped. A hole filler must not contain the thing it is
    // filling the hole behind. So on the backdrop alone the foreground is
    // painted out and the surround painted in over it — a depth-weighted
    // dilation, the real-time half of the inpaint an offline pass would do
    // properly. Eight taps ride a ring pair, each weighted by how FAR it lands:
    // a tap that stays on the lamp contributes nothing, a tap that clears it
    // onto the vault contributes fully, so the fill converges on the stone the
    // lamp stands in front of. Rings rather than a box, because a box's corners
    // are its longest reach and dilate into a square bloom.
    //
    // Only foreground fragments pay for it — on this plate the depth histogram
    // puts 87% of pixels below 0.4, so the ramp catches barely a tenth of one
    // card — and at the dwell it is invisible by construction, the slabs
    // covering their own silhouettes. It only ever changes what parallax has
    // just uncovered.
    if (uBackdrop > 0.5 && uFill.y > uFill.x) {
      float fgHere = smoothstep(uFill.x, uFill.y, fragmentDepth);
      if (fgHere > 0.004) {
        tex.rgb = mix(tex.rgb,
                      dilateFar(vUv, blurBias + 1.5, uFill.x, uFill.y), fgHere);
      }
    }

    // Unsharp mask: subtract a 4-tap neighbourhood blur to restore the crisp
    // edges that overscan + trilinear filtering softened. Only on the still —
    // scaled to zero as the (soft, low-res) video takes over so it never
    // crunches, and held off the defocused margins entirely.
    // …and off a card the eye is no longer focused on. Restoring "the crisp
    // edges overscan softened" is exactly the wrong job on a foreground that is
    // MEANT to be soft — it would spend four taps per fragment fighting the
    // defocus, and win enough to leave the card looking sharpened AND blurred,
    // which is what a bad print looks like rather than what a near object does.
    float sharpen = uSharpen * (1.0 - clamp(uLive, 0.0, 1.0))
                  * (1.0 - smoothstep(-0.08, 0.0, vMargin))
                  * (1.0 - uBackdrop)
                  * (1.0 - smoothstep(0.15, 1.0, uDefocus));
    if (sharpen > 0.001) {
      vec3 blur = texture2D(map, vUv + vec2(uTexel.x, 0.0)).rgb
                + texture2D(map, vUv - vec2(uTexel.x, 0.0)).rgb
                + texture2D(map, vUv + vec2(0.0, uTexel.y)).rgb
                + texture2D(map, vUv - vec2(0.0, uTexel.y)).rgb;
      tex.rgb += (tex.rgb * 4.0 - blur) * sharpen;
    }
    // The living surface: while the camera dwells here, the still painting
    // exhales into its own image-to-video render — same artwork, in motion —
    // and inhales back to stillness as the camera leaves.
    //
    // THE BACKDROP NEVER WAKES, and this is now a choice rather than a repair.
    // It is a hole filler: still and clip are the same artwork, and what has to
    // show through a dis-occlusion is tone, not readable content — so it holds
    // the properly blurred, properly fogged still and costs nothing to run.
    //
    // It used to be the only thing standing between a woken gallery and a
    // razor-sharp parallax-offset ghost of the clip, because mapVideo had no mip
    // chain and so DISCARDED the LOD bias of every sample below. That is fixed
    // at the source now (see the VideoTexture setup: generateMipmaps and a
    // mipmap min filter, set explicitly against three's defaults), so blurBias
    // reaches the clip everywhere it reaches the still — the backdrop's 3.5, and
    // the margin's 5.0 on the slabs, which was the same defect one card forward:
    // the mirrored extension came back sharp on a woken plate while the still
    // behind it was defocused. Waking the backdrop would be correct again if you
    // ever want it; it is held here for the reason in the paragraph above.
    float live = uLive * (1.0 - uBackdrop);
    if (live > 0.001) {
      vec4 vid = texture2D(mapVideo, vUv, blurBias);
      // Exposure FIRST, before the unsharp — this ordering matters. Darkening
      // after the high-pass leaves the mask's overshoot at full amplitude on a
      // darkened image, so the halos gain contrast against their surroundings
      // and the surface reads as hard white etching along every balustrade and
      // chain (which is exactly how the first attempt at this failed). Applied
      // to the sample, the halos are computed from already-darkened values and
      // scale down with everything else.
      vid.rgb = pow(videoLift(vid.rgb), vec3(uVideoGamma));
      // The live surface gets its OWN unsharp mask, tapped at the video's texel
      // spacing. The clip is a ~944-wide render magnified across a 3376-wide
      // plate, so what softens it is pure resampling blur — a high-pass at the
      // right scale is the only thing that touches it. Same margin/backdrop
      // gates as the still's mask: never ring into the mirrored extension, and
      // never re-introduce high frequencies on the hole-filling backdrop.
      // …and the same defocus gate the still's mask carries, for a reason that
      // bites harder here. THE TAPS BELOW ARE UNBIASED — they read level 0
      // whatever blurBias is — so the moment the centre sample comes from a
      // higher mip the two are no longer the same image at two scales, and
      // (vid*4 - liveBlur) stops being a local high-pass and becomes the
      // difference between a blurred picture and a sharp one. That residual is
      // enormous and structured, and it lands on the surface as blocking and
      // ringing: the clip visibly breaks up. It never showed before depth of
      // field because every other term in blurBias is already gated out of this
      // mask (margins and backdrop, just above) — defocus was the first one
      // that could reach a lit foreground card with the sharpen still running.
      float liveSharpen = uSharpenVideo
                        * (1.0 - smoothstep(-0.08, 0.0, vMargin))
                        * (1.0 - uBackdrop)
                        * (1.0 - smoothstep(0.15, 1.0, uDefocus));
      if (liveSharpen > 0.001) {
        // Through videoLift, like the centre — see the note on that function
        // for why the two have to agree, and for the one difference between
        // them that is meant.
        vec3 liveBlur = videoLift(texture2D(mapVideo, vUv + vec2(uVideoTexel.x, 0.0)).rgb)
                      + videoLift(texture2D(mapVideo, vUv - vec2(uVideoTexel.x, 0.0)).rgb)
                      + videoLift(texture2D(mapVideo, vUv + vec2(0.0, uVideoTexel.y)).rgb)
                      + videoLift(texture2D(mapVideo, vUv - vec2(0.0, uVideoTexel.y)).rgb);
        vid.rgb += (vid.rgb * 4.0 - liveBlur) * liveSharpen;
      }
      // Pull the flat clip back toward the still's body: saturation around
      // luma, then contrast around mid-grey. Clamped so the sharpen's
      // overshoot can't be driven out of gamut by the grade.
      float vidLuma = dot(vid.rgb, vec3(0.2126, 0.7152, 0.0722));
      vid.rgb = mix(vec3(vidLuma), vid.rgb, uVideoSat);
      vid.rgb = clamp((vid.rgb - 0.5) * uVideoContrast + 0.5, 0.0, 1.0);
      tex = mix(tex, vid, live);
    }
    float pulse = 0.5 + 0.5 * sin(uTime * 0.35 + vDepth * 3.14159);
    tex.rgb += tex.rgb * pulse * 0.05 * uBreath * smoothstep(0.2, 1.0, fragmentDepth);

    // The room's own light, read ONCE and before any rite has touched the
    // colour: three of the crossings are sorted by it — what is lit leaves
    // last, or lingers a moment after the stone holding it has gone — and none
    // of them may read it back after it has been graded or fogged, or a rite
    // would be sorting the room by what it had itself just done to it.
    float lumRite = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));

    // ── The rite, part two: what the room LOOKS like as it goes ─────────────
    // Colour work only, laid over the finished surface (still or clip) and
    // before the distance fog, so a room that is halfway down the corridor
    // still sinks into the dark the same way it always did. Everything here is
    // inside a uniform branch that is only ever taken by the ONE plate a
    // crossing is dissolving, so the cost never lands on the stack as a whole.
    //
    // Note what is NOT here any more: no second tap of the surface, anywhere.
    // Every rite that used to draw the room twice (the echo's receding copies,
    // the split's ghost of the path not taken) has been cut. Two offset copies
    // of one image are read as blur and never as two of anything — that was
    // known — but even where the doubling read correctly it read as an EFFECT,
    // and one tap is now the whole budget: what a rite may change is the light
    // on the room, not how many rooms there are.
    if (rite == RITE_ECHO) {
      // Tautology: the passage insists it has been walked before. What says it
      // again is the LIGHT — as the front reaches a lit part of the room that
      // light swells a little before it goes, and (in part three) hangs a beat
      // in the air after the stone that carried it has gone. So the gallery
      // leaves in the order lamp-last, and its afterimage is its own lamps.
      float lit = smoothstep(0.20, 0.62, lumRite);
      tex.rgb += tex.rgb * lit * 0.40 * env * (1.0 - uBackdrop);
    } else if (rite == RITE_SPLIT) {
      // Two futures. Not two pictures — one room, with the weather changing
      // across it: the library's lamplight draining out of the side you came
      // from while the moon the Fork opens onto arrives on the other, and the
      // moonward side losing the lamp's body along with its colour, so one
      // half of the room is already the next chapter's light.
      float graded = smoothstep(0.02, 0.35, rp) * (1.0 - uBackdrop);
      tex.rgb *= mix(vec3(1.0), mix(vec3(1.10, 1.00, 0.88),
                                    vec3(0.88, 0.97, 1.12), across), graded);
      tex.rgb = mix(tex.rgb, uFogColor, across * graded * 0.22);
    } else if (rite == RITE_WIND) {
      // The floor is lost by the room losing its DEPTH: the far architecture
      // sinks into the corridor's own darkness first, so the distance walks in
      // toward you and what is left at the end is a shallow face and its lamp.
      // The camera's slow roll (WIND_ROLL) is the other half of it, and is
      // where the vertigo actually lives — this only takes the ground away.
      // It runs on the fragment's depth rather than on any figure drawn over
      // the plate, so it cannot be seen as a pattern: it is aerial perspective,
      // the one thing this corridor already does everywhere else.
      float far = 1.0 - smoothstep(0.10, 0.62, fragmentDepth);
      tex.rgb = mix(tex.rgb, uFogColor, far * smoothstep(0.0, 0.55, rp) * 0.85);
    } else if (rite == RITE_FLOOD && sink > 0.0) {
      // Under: what has gone below the level loses its light and takes the
      // corridor's colour, and part one has already carried it out of focus.
      // Between them that is water without a drop of water being drawn — no
      // surface, no ripple, no mirrored copy of the room hanging upside down.
      float deep = smoothstep(0.0, 0.45, sink);
      tex.rgb = mix(tex.rgb, uFogColor, deep * 0.72) * (1.0 - 0.45 * deep);
    } else if (rite == RITE_HUSH) {
      // The light leaves before the room does. Illumination collapses inward
      // toward the plate's own lamp — everything the front has reached goes
      // grey and then goes to the colour of the corridor — so what you walk
      // into the Silence with is one small light in the dark, and then not
      // even that.
      // Leads the cut rather than following it: a fragment is dark well before
      // the front reaches it, so the room goes out and only then goes away.
      float drained = smoothstep(0.0, 0.7, rp)
                    * smoothstep(drainFront - 0.55, drainFront - 0.05, reach);
      tex.rgb = mix(tex.rgb, vec3(dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722))),
                    drained * 0.7);
      tex.rgb = mix(tex.rgb, uFogColor, drained * 0.8);
    }

    // Distance fog: deeper galleries sink into the corridor's darkness and
    // surface again as the camera nears them.
    float fog = pow(vFog, 1.6);
    tex.rgb = mix(tex.rgb, uFogColor, fog);
    // Sink the backdrop toward the fog as well, so its blurred copy sits clearly
    // BEHIND the slabs in tone and can never compete with them for an edge.
    tex.rgb = mix(tex.rgb, uFogColor, uBackdrop * 0.35);

    // ── The rite, part three: HOW the room gives way ────────────────────────
    // Depth-ordered dissolve — the plain rite, and the one every other is
    // measured against. As uFade rises the threshold sweeps from the nearest
    // stone (depth 1) back into the image, so the gallery melts away
    // front-first — like pushing through a curtain of masonry. A thin rim at
    // the melt line brightens what is already there, a catch of light along the
    // stone. The extension margins melt AHEAD of the artwork (the periphery
    // burns off first, narrowing the world to the true spiral before it gives
    // way), and the rim stays off them — mid-melt margin content is viewed at
    // grazing angles where it traces ugly blocky contours.
    //
    // EVERY RITE KEEPS THIS SWEEP. That was learned the hard way: the first
    // pass had each rite REPLACE the threshold with its own — radial, water,
    // threads — and the crossings went black. On this art the near depth band
    // is unlit foreground standing in front of the lit middle distance (the
    // lamp, the arcade, the avenue), so half of what the depth melt does for
    // this scene is not dissolving but UNCOVERING: peel the near stone and the
    // picture lights up. Measured at one instant of the Pavilion's crossing,
    // the plain melt showed a lit hall and the thread rite showed an empty
    // frame — with identical thread alpha, identical everything else.
    //
    // So a rite does not get its own threshold. It gets to BEND this one, and
    // the bend is now the whole of a rite's threshold work — the difference
    // between the seven is nothing but WHICH FRAGMENTS THE FRONT REACHES FIRST:
    //   • the bias sends the front ahead of itself for some fragments — with
    //     radius, and the room collapses toward its own lamp; with luminance,
    //     and the light in it outlives the stone that carried it; with the
    //     side of the frame, and one half of the room gives way before the
    //     other. No figure, no pattern, no wipe: a picture-shaped ordering.
    //   • the rate slows the whole front where a rite needs the plate to stand
    //     long enough for something to happen to its light.
    //
    // AND EVERY BIAS RUNS THE SAME WAY ROUND. The sign matters more than it
    // looks: a positive bias melts a fragment EARLY, and biasing the LIT parts
    // early is the same mistake the first pass made with its threads — it
    // strips the lamp and the arcade and leaves the unlit near stone standing,
    // which is the black frame described above. So where a rite sorts the room
    // by its light, the dark always goes first and the light goes last. That
    // is also the truer image: a room does not stop being lit, it stops being
    // a room, and the last of it is the lamp.
    float rate = 1.72;
    float bias = 0.0;
    if (rite == RITE_HUSH) {
      bias = reach * 1.55;
    } else if (rite == RITE_WIND) {
      // The same collapse toward the lamp, shallower: here the room is closing
      // rather than going out, and part two's recession does most of the
      // telling. (This replaces a rotating spiral vane, which drew a turning
      // arm of light across the plate — legible, and unmistakably a wipe.)
      bias = reach * 0.95;
    } else if (rite == RITE_WEAVE) {
      // The web is what is left when everything that is not a thread of light
      // has gone. The dark of the room goes first and steadily, so the picture
      // thins down to a lacework of its own lit edges — balustrades, the rims
      // of arches, the lamp — and only then lets go of those. Nothing is cut
      // into strands; the strands are the ones the painting already has.
      bias = (1.0 - smoothstep(0.16, 0.60, lumRite)) * 0.85;
      rate = 1.45;   // a long tail, so the last filaments are seen to go
    } else if (rite == RITE_ECHO) {
      rate = 1.55;   // a shade slower: the lingering light needs room to be seen
    } else if (rite == RITE_SPLIT) {
      // One side gives way before the other — by little enough to be felt as
      // the room going unevenly rather than seen as a line down the middle.
      rate = 1.20;
      bias = (across - 0.5) * 0.50;
    } else if (rite == RITE_FLOOD) {
      // The room must stand while it goes under, so its sweep runs well behind
      // the plain one.
      rate = 1.20;
    }
    float th = 1.12 - rp * (rate + e * 4.0 + bias);
    float alpha = 1.0 - smoothstep(th - 0.10, th + 0.10, fragmentDepth);
    float rim = smoothstep(th - 0.14, th - 0.03, fragmentDepth)
              * (1.0 - smoothstep(th - 0.03, th + 0.08, fragmentDepth));
    // How much the front is allowed to brighten what it is passing over. This
    // is no longer an ember: see the lift at the end of this section for what
    // changed and why. The Silence is still given none.
    float rimGain = 0.55;

    if (rite == RITE_ECHO) {
      // The light does not quite go with the stone. A band behind the front
      // holds on — but only where the room was LIT, so what hangs in the air a
      // beat after the masonry has gone is the room's own lamps and lit edges,
      // not a second grey copy of the wall. (That is what it used to be: a flat
      // 0.24 of everything the front had passed, which is a ghost image, plus
      // three ember waves. A ghost image of stone is a video effect; a light
      // outlasting the thing it fell on is what a room does.)
      float g1 = th + 0.30;
      float lag = (1.0 - smoothstep(g1 - 0.12, g1 + 0.12, fragmentDepth))
                * smoothstep(0.20, 0.62, lumRite);
      alpha = max(alpha, lag * 0.55 * env);
    } else if (rite == RITE_HUSH) {
      // An extinguishing rather than an announcement. The radial bias above
      // has already turned the sweep inside-out — it runs fastest where the
      // room is darkest and slowest at the lamp, so the last thing standing
      // is the light itself — and this rite's real work is the draining of
      // the colour in part two. All it asks for here is silence.
      rimGain = 0.0; // nothing announces itself on the way into the Silence
    } else if (rite == RITE_FLOOD) {
      // What has gone under goes, once it is deep enough to have lost its
      // light — no seam is drawn at the level itself. A lit line across the
      // frame was the whole reason the old flood read as a waterline effect
      // rather than as a room going under: water at this scale, in this light,
      // has no highlight on it.
      alpha = min(alpha, 1.0 - smoothstep(0.10, 0.75, sink));
      rimGain = 0.40;
    }
    // No rite may lurch: whatever it takes on top of the melt, at rest the
    // plate is whole. (The flood's level in particular starts under the card's
    // bottom margin, which would otherwise drop out on the first frame of the
    // crossing.) Held to the rites alone: the plain melt's own behaviour at
    // rest — where the very nearest fragments already sit a little under 1 —
    // is long since tuned around, and is not this change's business to alter.
    if (rite != RITE_PLAIN) {
      alpha = mix(1.0, alpha, smoothstep(0.0, 0.05, rp));
    }

    // What the front does to the light it is passing over. This used to be an
    // EMBER: the chapter's accent ADDED along the melt line, at full colour,
    // on every threshold in the corridor. It is the single thing that made the
    // crossings look bought rather than built — a glowing coloured edge
    // travelling across a frame is the oldest transition in video, and because
    // every rite carried it, the family resemblance between the seven
    // thresholds was their cheapest element.
    //
    // It is now a LIFT: the front brightens whatever is already there, by a
    // fraction of itself. The whole difference is that it MULTIPLIES. Added
    // light draws its own shape and is at its most obvious over the dark parts
    // of a plate — which is where most of a melt front lies, so the old rim
    // literally drew a bright line across unlit stone. A multiply is zero
    // wherever the picture is dark, so it can never draw a line: it can only
    // catch on what the room already has to catch on, and it reads as a lamp
    // brightening rather than as an edge sweeping past. The chapter's accent
    // survives as a tilt in the colour of that lift (normalised by its own
    // largest channel, so it changes the hue and not the exposure), which is
    // as much as a colour should ever say here.
    float lift = rim * rimGain * env * (1.0 - smoothstep(0.05, 0.3, e));
    if (lift > 0.001) {
      vec3 tint = uAccent / max(max(uAccent.r, max(uAccent.g, uAccent.b)), 0.001);
      tex.rgb += tex.rgb * lift * mix(vec3(1.0), tint, 0.35);
    }

    // Arrival gate. The plate's FAR architecture is always allowed (it is the
    // room seen down the corridor), but its NEAR foreground only fades in as
    // the camera actually crosses into this chapter (uReveal 0→1 across the
    // previous crossing). Without this, the dive's deep plunge outruns the
    // distance fog and the next room's foreground pops out as raw unlit
    // fragments while the current room is still melting.
    alpha *= mix(1.0, uReveal, smoothstep(0.45, 0.75, fragmentDepth));

    // Depth-band window: keep only this slab's slice of the image, feathered so
    // it dissolves into its neighbours rather than cutting a hard silhouette.
    //
    // Matted at silhouettes, because a depth cliff is not a step in the map —
    // it is a two-or-three-texel RAMP (the estimator's own softness, plus
    // whatever the walk-in's magnification adds once the plate is blown up past
    // 1:1). Handed to the window raw, those in-between values belong to the
    // slabs BETWEEN the two surfaces, which have no business drawing the pixel
    // at all: each cuts the same silhouette out of its own card and draws a thin
    // arc of it, and since every card sits at its own depth the walk-in fans
    // those arcs out sideways. That is the ring of bright squiggles around the
    // lanterns, with the dis-occluded gap behind them widened to the union of
    // every card's hole.
    //
    // So read the two surfaces the ramp actually runs between — the local
    // extremes a couple of texels either side — and hand the pixel to THOSE two
    // cards only. A boundary pixel is a mix of the lantern and the vault behind
    // it, and they are the only two entitled to a share of it. At the dwell the
    // two shares recompose into exactly the old image (the cards register
    // pixel-for-pixel there); the matting only ever withholds the in-between
    // copies, which are all that separates under parallax.
    //
    // The far side takes its share as a FILL rather than as its band weight
    // (see fillWindow): the stack composites back to front, and a pair of
    // honest partial alphas leaves a gap for the backdrop to leak through —
    // a dark halo threaded along every silhouette, at rest as much as walked
    // in, with the lanterns' painted glow rims visibly dimmed by it.
    //
    // It is still weighted by how much of the pixel is background, though, and
    // that is not fussiness: a hanging chain or a lantern's spire is thinner
    // than these taps are wide, so EVERY one of its pixels reads the vault as
    // its far extreme. Let the far card fill those outright and it paints a
    // solid copy of the chain — bright, and free to fly off on its own card,
    // which is the artifact this whole passage exists to remove.
    //
    // Four taps, and behind the backdrop's own uniform: its band swallows the
    // whole range, so every window here would come back 1 and the taps would be
    // spent on a card that is deliberately blurred past the point of having
    // silhouettes at all. The stack is fill-rate bound; the one card that
    // cannot use this does not pay for it.
    float win = 1.0;
    if (uBackdrop < 0.5) {
      vec2 dt = uDepthTexel * 2.0;
      float dA = pow(texture2D(depthMap, vUv + vec2( dt.x,  dt.y)).r, depthGamma);
      float dB = pow(texture2D(depthMap, vUv + vec2(-dt.x,  dt.y)).r, depthGamma);
      float dC = pow(texture2D(depthMap, vUv + vec2( dt.x, -dt.y)).r, depthGamma);
      float dD = pow(texture2D(depthMap, vUv + vec2(-dt.x, -dt.y)).r, depthGamma);
      float dFar  = min(min(min(dA, dB), min(dC, dD)), fragmentDepth);
      float dNear = max(max(max(dA, dB), max(dC, dD)), fragmentDepth);
      float span  = dNear - dFar;
      // How much of this pixel belongs to the near surface, and how much of a
      // silhouette this is at all — ordinary modelling gradients keep the plain
      // window, where in any case the two agree, span being small.
      float cover = clamp((fragmentDepth - dFar) / max(span, 1e-4), 0.0, 1.0);
      float cliff = smoothstep(0.04, 0.12, span);
      float wFill = fillWindow(dFar);
      float wNear = bandWindow(dNear);
      win = mix(bandWindow(fragmentDepth), mix(wFill, wNear, cover), cliff);

      // …and what that far card FILLS with. Owning the far side of a cliff but
      // not the near one means standing in for what is BEHIND a silhouette —
      // but the texel at this UV is the silhouette's own rim, a blend of
      // occluder and background that on a lamp is BRIGHT. Painting it at far Z
      // hangs a bright crescent of the globe's edge on a card six bands back,
      // and walking in slides it across the glass as a seam. (Measured on
      // var17: the globe's rim ramps down through the 0.6 band edge, and 24%
      // of its painted pixels lie inside the 0.07 feather there.)
      //
      // So fill with what is behind it, not with it. Same dilation the backdrop
      // uses; only silhouette fragments reach it, and the weight is exactly the
      // share this card was about to paint wrongly.
      float behind = cliff * wFill * (1.0 - wNear) * (1.0 - cover);
      if (behind > 0.01 && uFill.y > uFill.x) {
        tex.rgb = mix(tex.rgb, dilateFar(vUv, blurBias + 1.5, uFill.x, uFill.y),
                      behind);
      }
    }

    // The extension margins carry the painting's wrap-around continuation (the
    // next bay of the endless gallery): clear near the artwork, then a LONG
    // sink all the way to EXACTLY the fog color — fully converged before the
    // rim's alpha fade even begins. This is what makes an edge impossible in
    // principle: every card's margin (near slab, mid slabs, backdrop — all
    // overlapping at different screen scales) arrives at the same color as the
    // graded canvas background, so their rims and overlaps blend over equal
    // color and nothing can read as a boundary or a band.
    //
    // A turning reader has that fog opened out of the way, so the card's own rim
    // takes the job over: the same sink and the same fade, measured across the
    // card instead of the picture. At rest it changes nothing — everything past
    // vRim 0.86 is already deep in the margin's own fog — and once the panorama
    // is open it is the only thing standing between the reader and a plain cut
    // edge at the end of the plate.
    tex.rgb = mix(tex.rgb, uFogColor,
                  max(smoothstep(0.12, 0.7, e), smoothstep(0.86, 1.0, vRim)));
    float rimFade = (1.0 - smoothstep(0.8, 1.0, e))
                  * (1.0 - smoothstep(0.93, 1.0, vRim));

    gl_FragColor = vec4(tex.rgb, tex.a * alpha * win * rimFade * (1.0 - uGhost));
    if (gl_FragColor.a < 0.004) discard;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// One gallery relief. `index` fixes its station along the corridor; its own
// useFrame drives the dissolve as the camera crosses it and keeps its fog
// color in step with the graded background. If the artwork has a `video`
// (an image-to-video render of this exact image), the surface wakes into it
// while the camera is near and settles back to the still when it leaves.
function Painting({
  color, depth, video, videoRate = 1, index, chapters, aspect, relief, depthGamma, overscan,
  reduced, descentRef, accentRef, fogRef, diveRef, climbRef, libraryMax, stepRef,
  // Timestamp (performance.now()) of the last time the reader STEERED — walked,
  // panned the gaze, took the chain. A stamp newer than the one taken at the
  // wake ends the film for this visit; see LIVE_SETTLE for what counts and why.
  stirRef,
  // False until the reader has clicked through the entry veil.
  //
  // A gallery gets ONE awakening per visit, and standing at the title card is
  // the stillest the reader is ever going to be — so both wake clocks below run
  // out behind the veil, and the opening gallery spends its whole film to an
  // empty room. Nobody noticed while the Vestibule was the one node with no clip
  // to spend; it now opens the tour with one, which is what surfaced this.
  //
  // Gating the wake alone is not enough: the clocks would bank the whole time
  // the overture was up and the plate would go live the instant the veil
  // cleared, which is the same bug wearing a hat. So the clocks do not start
  // either — the room begins measuring attention when there is someone in it.
  enteredRef,
  // Where this plate reports its awakening, so the drift can be paced by what
  // the gallery is actually doing rather than by a stopwatch: `{ woke, done }`
  // under this plate's index, cleared when the camera leaves. `done` is stamped
  // by the FIRST pass to finish — the clip keeps replaying for as long as the
  // reader stands here (see REPLAY_REST), so "has stopped" never arrives and
  // "has said itself once" is the only meaningful signal.
  passRef,
  // The rite this plate's own threshold is given (RITES[index]), and the point
  // in the artwork two of them collapse the room into — the plate's light.
  rite = RITE.PLAIN, glowAt,
  // How far round the reader has turned, in bays. See TURN_BAYS.
  panRef,
}) {
  const mesh = useRef();
  // el: the <video>; tex: its VideoTexture; playing: true while it is running
  // through a pass; ended: true once a pass finished (the surface keeps holding
  // its last frame — it settles back to the still only after the camera has
  // left); endedAt: when that pass finished, which paces the replay rest;
  // armed: whether a new arrival is allowed to trigger the first play (re-armed
  // each time the camera leaves).
  // gaze: seconds the reader's attention has RESTED on this plate's lamp;
  // inRoom: seconds spent standing in this gallery. The two clocks the first
  // awakening waits on (see WAKE_GAZE_DWELL / WAKE_PATIENCE); both are wound
  // back to zero each time the camera leaves, along with `armed`.
  // stopped: the reader steered while it was running, so it settled back to the
  // painting and is finished for this visit; stirMark: the steering stamp as it
  // stood at the wake, which is what "again" is measured against (see
  // LIVE_SETTLE). Both are cleared on leaving with the rest.
  // failed: this clip cannot be played at all — see the error listener on the
  // element below. Held for the life of the element so a broken source is not
  // re-attempted every frame, and cleared with the element on teardown, which
  // gives a clip that failed on a bad connection one fresh try per return.
  const live = useRef({
    el: null, tex: null, playing: false, ended: false, endedAt: 0, armed: true,
    gaze: 0, inRoom: 0, stopped: false, stirMark: 0, failed: false,
  });
  // Scratch for the lamp's projection, so measuring attention allocates nothing
  // per frame.
  const lamp = useMemo(() => new THREE.Vector3(), []);
  // The offline backdrop for this plate, if it has one. useTexture suspends,
  // so the array has to keep a STABLE LENGTH across renders — a plate without
  // a backdrop passes its own urls again rather than shortening the list.
  // useLoader caches per url, so those repeats resolve to the very same
  // texture objects and cost nothing.
  const backdropPlate = BACKDROP_PLATES[color] ?? null;
  const [colorMap, depthMap, backdropMap, backdropDepthMap] = useTexture(
    [color, depth, backdropPlate?.color ?? color, backdropPlate?.depth ?? depth],
    (texes) => {
      // 0 and 2 are pictures and must decode as sRGB; 1 and 3 are depth and
      // must stay linear. When there is no backdrop plate, 2 IS 0 and 3 IS 1,
      // so this assigns each of them the space it already had.
      texes[0].colorSpace = THREE.SRGBColorSpace;
      texes[2].colorSpace = THREE.SRGBColorSpace;
      texes.forEach((t) => {
      // Both axes mirror. Horizontal was a wrap-around until the butt-joint
      // between the plate's right and left edges started showing as a hard
      // vertical seam (see EXTEND_X for the measurements and the trade-off);
      // vertical has always mirrored, since wrapping would hang the floor
      // above the vault. Keep this in step with the video texture below —
      // if the two disagree the seam returns the moment a clip wakes.
        t.wrapS = THREE.MirroredRepeatWrapping;
        t.wrapT = THREE.MirroredRepeatWrapping;
        t.anisotropy = TEX_ANISOTROPY;
      });
    });

  // The slab stack: one full-image backdrop (index 0) behind LAYER_COUNT
  // depth-windowed foreground cards, near-band last so it draws over the rest.
  const layers = useMemo(() => {
    const defs = [
      { backdrop: true, lo: -1, hi: 2, center: 0.5, macro: BACKDROP_MACRO, reliefScale: 0.4, over: 1.5 },
    ];
    for (let j = 0; j < LAYER_COUNT; j++) {
      const lo = j / LAYER_COUNT;
      const hi = (j + 1) / LAYER_COUNT;
      const center = (lo + hi) / 2;
      defs.push({ backdrop: false, lo, hi, center, macro: macroZ(center), reliefScale: 1, over: 1 });
    }
    return defs;
  }, []);

  // Each slab fills the frustum at its own depth, so at the dwell distance every
  // card covers the same screen region and the image registers pixel-for-pixel;
  // only when the camera moves do the cards' different depths pull them apart.
  const geos = useMemo(() => layers.map((L) => {
    const dist = PLANE_Z - L.macro;
    const h = frustumH(dist) * overscan * L.over;
    // The card is built wider than the artwork by the mirror-extension; the
    // shader's uUvSpan puts the image in the center at its normal size and
    // fills the margins with its mirrored continuation.
    return new THREE.PlaneGeometry(h * aspect * EXTEND_X, h * EXTEND_Y, SEG_X, SEG_Y);
  }), [layers, aspect, overscan]);

  // Texel size of the still, for the fragment unsharp mask. useTexture suspends
  // until the image is decoded, so colorMap.image is present here; fall back to
  // the known plate size just in case.
  const texel = useMemo(() => new THREE.Vector2(
    1 / (colorMap.image?.width || 3376),
    1 / (colorMap.image?.height || 1440),
  ), [colorMap]);

  // The same for the depth map, which is not always the plate's own size — the
  // silhouette matting steps in ITS texels, a texel being the width the depth
  // estimator's soft cliffs are measured in.
  const depthTexel = useMemo(() => new THREE.Vector2(
    1 / (depthMap.image?.width || 3376),
    1 / (depthMap.image?.height || 1440),
  ), [depthMap]);

  const materials = useMemo(() => layers.map((L) => {
    // Layer 0 takes the offline backdrop where one exists. Every other card
    // keeps the painting itself — the foreground has to stay in the picture
    // for the slab that owns its depth to draw it.
    const painted = L.backdrop && backdropPlate;
    return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: painted ? backdropMap : colorMap },
      uTexel: { value: texel },
      uDepthTexel: { value: depthTexel },
      uSharpen: { value: TEX_SHARPEN },
      // Placeholder until the video's first frame is decodable; uLive stays 0
      // until then, so the sampler is never visibly wrong.
      mapVideo: { value: colorMap },
      // Overwritten with the clip's true 1/size the moment its first frame is
      // decodable; the placeholder matches the still so the taps are never
      // wildly off-scale if a clip is missing.
      uVideoTexel: { value: texel.clone() },
      // Likewise rewritten per clip, scaled to the width that clip turns out to
      // be (see VIDEO_SHARPEN_REF).
      uSharpenVideo: { value: VIDEO_SHARPEN },
      uVideoSat: { value: VIDEO_SATURATION },
      uVideoContrast: { value: VIDEO_CONTRAST },
      uVideoGamma: { value: VIDEO_GAMMA },
      uVideoLift: { value: VIDEO_LIFT },
      uLive: { value: 0 },
      // The offline backdrop gets the matching offline DEPTH. Handing it the
      // painting's depth would displace the filled-in stone into the shape of
      // the chain that is no longer there — damped by reliefScale 0.4, but
      // relief in the shape of a removed object is exactly the ghost this is
      // meant to end.
      depthMap: { value: painted ? backdropDepthMap : depthMap },
      relief: { value: relief * L.reliefScale },
      depthGamma: { value: depthGamma },
      uTime: { value: 0 },
      uBreath: { value: reduced ? 0 : 1 },
      uFade: { value: 0 },
      uAccent: { value: new THREE.Color('#c9a24c') },
      // The near-knee squash was a single-plane smear tamer; slabs can't smear
      // (out-of-band fragments are discarded), so it is switched off here.
      uNearKnee: { value: 1.0 },
      uNearSquash: { value: 1.0 },
      uBandCenter: { value: L.center },
      // Every card in the stack (backdrop included) wraps around the SAME eye
      // point with the same strength, so the layers curve as one vault and
      // their registration from the dwell holds.
      uCurve: { value: SPHERE_WRAP },
      uDwellDist: { value: PLANE_Z - L.macro },
      uDefocus: { value: 0 },
      uBandLo: { value: L.lo },
      uBandHi: { value: L.hi },
      uFeather: { value: LAYER_FEATHER },
      uBackdrop: { value: L.backdrop ? 1 : 0 },
      // hi <= lo switches the runtime dilation off, which is what a plate that
      // has already been inpainted properly wants: dilating an image the
      // occluder has been removed from would smear the stone that replaced it.
      // Note this only silences it on THIS card — the far-side-of-a-cliff fill
      // that ordinary slabs run (see the `behind` block) is untouched.
      uFill: {
        value: painted
          ? new THREE.Vector4(0, 0, FILL.r1, FILL.r2)
          : new THREE.Vector4(FILL.lo, FILL.hi, FILL.r1, FILL.r2),
      },
      uUvSpan: { value: new THREE.Vector2(EXTEND_X, EXTEND_Y) },
      // Divided by this card's own scale-up: the backdrop draws the image 1.5×
      // larger than the foreground cards, so an equal UV shift would slide it
      // 1.5× further on screen and break the registration the stack depends on.
      // Divided, every layer's picture rises by the same ANGLE.
      uEyeShift: { value: EYE_DROP / L.over },
      // Divided for exactly the reason uEyeShift is — an equal UV shift would
      // slide the 1.5x backdrop 1.5x further and break the stack's
      // registration. Divided, every layer's picture turns by the same ANGLE.
      uPan: { value: 0 },
      uOpen: { value: 0 },
      uReveal: { value: 1 },
      uGhost: { value: 0 },
      uRite: { value: rite },
      uRiteAmt: { value: RITE_AMT },
      // glowAt names the light with v measured DOWN from the top of the
      // artwork (that is the convention the Glow sprite reads it in); the
      // shader's vUv has v running up from the bottom, so it is flipped once,
      // here, rather than in every place the shader reaches for it.
      uGlowUV: { value: new THREE.Vector2(glowAt ? glowAt[0] : 0.5,
                                          glowAt ? 1 - glowAt[1] : 0.5) },
      uArt: { value: aspect },
      // Keep the dwelt gallery clear of fog; only the true far corridor and the
      // next chapter's cards sink into it.
      uFogNear: { value: PLANE_Z + 3 },
      uFogFar: { value: PLANE_Z + SCENE_SPACING * 1.6 },
      uFogColor: { value: new THREE.Color('#15120d') },
    },
    vertexShader: paintingVert,
    fragmentShader: paintingFrag,
    transparent: true,
    });
  }), [layers, colorMap, depthMap, backdropMap, backdropDepthMap, backdropPlate,
       relief, depthGamma, reduced, texel, depthTexel, rite, glowAt, aspect]);

  // Release the video/texture with the painting, and the per-layer GPU
  // resources when they are rebuilt (HMR, prop changes).
  //
  // Keyed on `video` rather than mount, because a gallery can be handed a
  // different artwork mid-tour (Tour's restock) without unmounting. The frame
  // loop below only ever creates the element once — `if (!state.el)` — so a
  // clip left standing here would go on playing over the painting that replaced
  // it. The whole live state resets with it, so the new surface is armed to wake
  // from its own first frame.
  useEffect(() => {
    const state = live.current;
    return () => {
      if (state.el) {
        state.el.pause();
        state.el.removeAttribute('src');
        state.el.load();
        state.el.remove();
      }
      if (state.tex) {
        state.tex.dispose();
      }
      state.el = null;
      state.tex = null;
      state.playing = false;
      state.ended = false;
      state.endedAt = 0;
      state.armed = true;
    };
  }, [video]);

  // The still's plates go with the artwork too. Nothing else in the corridor
  // draws this pair — every gallery owns its own files — so when a restock
  // replaces them the GPU copies are freed rather than accumulating one set per
  // version seen. The loader's cache entry is dropped in the same breath, so a
  // later revisit to this same version loads it again instead of reaching for a
  // texture that has been disposed.
  useEffect(() => () => {
    useTexture.clear([color, depth]);
    colorMap.dispose();
    depthMap.dispose();
    // The backdrop pair goes the same way. Guarded, because a plate WITHOUT an
    // offline backdrop was handed its own urls twice — those are the very same
    // texture objects, already disposed on the two lines above, and clearing a
    // url the cache no longer holds would be the second free of one entry.
    if (backdropPlate) {
      useTexture.clear([backdropPlate.color, backdropPlate.depth]);
      backdropMap.dispose();
      backdropDepthMap.dispose();
    }
  }, [color, depth, colorMap, depthMap, backdropPlate, backdropMap,
      backdropDepthMap]);
  useEffect(() => () => {
    geos.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }, [geos, materials]);

  useFrame(({ clock, camera, pointer }, delta) => {
    const descent = descentRef.current;
    // f > 0 once the camera has begun crossing this gallery.
    const f = descent - index;
    let fade = THREE.MathUtils.smoothstep(f, 0.05, 0.82);
    const t = clock.getElapsedTime();
    // How far the camera has crossed INTO this chapter from the previous one:
    // 0 while still a full chapter away, 1 on arrival. Gates the plate's near
    // foreground in the shader (its far architecture is always allowed).
    const reveal = THREE.MathUtils.clamp(f + 1, 0, 1);
    // During the dive the deepest library plate must NOT depth-melt — the
    // camera is buried inside its slab stack by then and the melt's shards
    // read as abstract garbage at point-blank. Instead the whole stack GHOSTS:
    // a plain fade across the last stretch of the fall, so the spiral simply
    // thins away around the camera while the garden materializes ahead. No
    // darkness in between — both worlds stay lit through the crossfade.
    //
    // The CLIMB back out of the garden is the same hand-off mirrored: there it
    // is the garden's own first plate (libraryMax + 1) that thins away while
    // the vortex re-forms ahead, so each direction ghosts the plate it is
    // leaving and neither one ever melts at point-blank.
    const dp = diveRef ? diveRef.current : 0;
    const cp = climbRef ? climbRef.current : 0;
    const fall = index === libraryMax ? dp : index === libraryMax + 1 ? cp : 0;
    const ghosting = fall > 0.001 && fall < 0.999;
    const ghost = ghosting ? THREE.MathUtils.smoothstep(fall, 0.8, 0.96) : 0;
    if (ghosting) {
      fade = 0;
    }
    // How far round the reader has turned, in bays, carried in [-1, 1].
    const pan = panRef ? wrapBays(panRef.current) : 0;
    const open = THREE.MathUtils.smoothstep(Math.abs(pan), TURN_OPEN_LO, TURN_OPEN_HI);
    // ── Where the eye is focused ──────────────────────────────────────────────
    // On the artwork's own plane, always: it is the thing being looked at, and
    // it is also where the whole stack registers, so focusing there is what
    // keeps the PICTURE sharp while the room around it softens.
    //
    // `eye` is the reader's true distance from that plane, read off the camera
    // rather than off immersion — so this answers to every way the body can be
    // carried forward at once (the walk-in, the opening withdrawal, the dive)
    // without any of them having to know depth of field exists.
    const eye = camera.position.z - planeZ(index);
    // How far in they have come, as a fraction of the walk-in. 0 at the dwell
    // and 1 at the deepest stand a reader can reach; a dive goes further still,
    // and is let a little past 1 before the ceiling takes over.
    // …and NOT on a plate that is dissolving. A crossing is already the muddiest
    // moment the corridor has — the room being left is melting (and the melt
    // carries its own defocus, the `sink` term in blurBias) while the room being
    // arrived at is still gated and still in fog — and the reader is walked in,
    // so this would pile a third blur onto the one plate still carrying the
    // picture. Measured at 0.9 mips on the departing near band mid-crossing,
    // which is exactly where the frame reads as empty. Focus is for standing in
    // a room, not for leaving one.
    const held = 1 - THREE.MathUtils.clamp(fade, 0, 1);
    const inness = THREE.MathUtils.clamp((PLANE_Z - eye) / APPROACH, 0, 1.2) * held;
    materials.forEach((m, li) => {
      // Only what is NEARER than the plate defocuses. The far bands and the
      // backdrop are behind the focus and stay sharp — which is the half of
      // this that sells it: blur everywhere is a smeared frame, blur in front
      // of a crisp background is depth.
      if (inness > 0.001) {
        const macro = layers[li].macro;
        const ahead = Math.max(macro, 0);
        // Guarded: the dive can put the camera level with a card, and 1/0 would
        // hand the sampler a NaN mip level.
        const cardDist = Math.max(eye - macro, 1);
        m.uniforms.uDefocus.value =
          Math.min(DOF.max, DOF.gain * inness * (ahead / cardDist));
      } else if (m.uniforms.uDefocus.value !== 0) {
        m.uniforms.uDefocus.value = 0;
      }
      m.uniforms.uTime.value = t;
      m.uniforms.uFade.value = fade;
      m.uniforms.uReveal.value = reveal;
      m.uniforms.uGhost.value = ghost;
      m.uniforms.uPan.value = pan / layers[li].over;
      m.uniforms.uOpen.value = open;
      m.uniforms.uAccent.value.copy(accentRef.current);
      m.uniforms.uFogColor.value.copy(fogRef.current);
      // Constant in a shipped build; carried per-frame only so window.__fill can
      // dial it live, which is the one way to A/B it inside a single session.
      // …except on a card already carrying an inpainted plate, which has no
      // dilation to dial. Without this guard window.__fill would switch the
      // runtime smear back on over the offline fill and the A/B would compare
      // two versions of "on".
      if (import.meta.env.DEV && !(layers[li].backdrop && backdropPlate)) {
        m.uniforms.uFill.value.set(FILL.lo, FILL.hi, FILL.r1, FILL.r2);
      }
    });
    // Skip galleries fully dissolved behind us or still buried in full fog
    // ahead — at most two or three galleries' stacks render at once.
    if (mesh.current) {
      mesh.current.visible = f < 0.96 && index - descent < 1.4;
    }

    if (video && !reduced) {
      const dist = Math.abs(descent - index);
      const state = live.current;
      // Begin streaming shortly before arrival, so the surface is ready to wake
      // the moment the camera gets there. This radius costs nothing extra on a
      // forward walk — the element a gallery gets on approach survives until it
      // is a full two chapters behind (the teardown below), so the only time
      // this gate fires at all is for a gallery whose element has already been
      // torn down, i.e. one being approached from more than two chapters away.
      //
      // It was forward-only (`ahead > -0.25`) for a while, to stop two
      // neighbours decoding at once. It did not: on a forward walk the gallery
      // behind is still holding its element from before regardless. All the
      // asymmetry did was leave a gallery approached from BELOW — the whole of
      // walking back up the corridor — with no lead time at all, so play() ran
      // against a readyState-0 element and the clip woke seconds into the dwell
      // or not at all.
      // Undefined for anything that never passes the ref (the isolated
      // reliefcheck harness, and any future caller) — those should behave as
      // they always did, so treat "not told" as "inside".
      const entered = enteredRef ? enteredRef.current : true;
      // The element is still CREATED and preloaded behind the veil: only the
      // waking is held back. Streaming it early is the whole point of the 1.15
      // lead (see above), and it costs nothing to have it ready and paused.
      if (!state.el && dist < 1.15) {
        const el = document.createElement('video');
        el.src = video;
        el.muted = true;
        el.loop = false; // one pass only — the surface animates, then holds
        el.playsInline = true;
        el.preload = 'auto';
        el.playbackRate = videoRate; // <1 stretches the pass into a slow drift
        el.style.display = 'none';
        // performance.now(), not the frame clock: this fires from the media
        // element's own thread, long after the frame that created it, so a
        // captured `t` would freeze at the moment of creation.
        el.addEventListener('ended', () => {
          state.playing = false;
          state.ended = true;
          state.endedAt = performance.now() / 1000;
          // First completed pass wins: later replays leave it standing, so the
          // drift reads "this gallery has woken and said itself once".
          const rec = passRef?.current?.[index];
          if (rec && !rec.done) rec.done = performance.now();
        });
        // The clip is not coming. Say so once, put the surface beyond the wake
        // gates for as long as this element lives, and — if it had already been
        // woken — release the drift, which is otherwise left waiting for a pass
        // that can never finish.
        el.addEventListener('error', () => {
          mediaFault(el, video);
          state.failed = true;
          state.playing = false;
          state.ended = false;
          state.endedAt = 0;
          const rec = passRef?.current?.[index];
          if (rec && !rec.done) rec.done = performance.now();
        });
        // Not a failure — the bytes are late, not absent. Worth exactly one
        // line, because a clip that wakes seconds into the dwell and a clip
        // that never wakes look the same from the reader's chair, and this is
        // what tells them apart.
        el.addEventListener('stalled', () => {
          if (state.stalled) return;
          state.stalled = true;
          console.info('[clip] %s is stalled — the surface will wake late or '
            + 'not at all', video);
        }, { once: true });
        document.body.appendChild(el);
        state.el = el;
      }
      if (state.el) {
        // Is the reader looking at this room's lamp? Measured only while the
        // plate is still waiting to wake — once it has, none of this matters,
        // and it is a projection per plate per frame. And only once they are
        // actually inside: see `enteredRef`.
        if (state.armed && dist < 0.9 && entered) {
          // The lamp in world space, from the same numbers the Glow itself is
          // placed by: glowAt is a point in the ARTWORK, and the artwork rides
          // EYE_DROP higher on its card than the card's own centre — and slides
          // along it as the reader turns, so the light this waits to be looked
          // at is wherever the turn has carried it.
          const gh = frustumH(PLANE_Z) * overscan;
          const [gu, gv] = glowAt ?? [0.5, 0.5];
          lamp.set((bayU(gu, pan) - 0.5) * gh * aspect,
                   (0.5 - gv + EYE_DROP) * gh,
                   planeZ(index));
          lamp.project(camera);
          // Nearest of the two things that can count as looking. Behind the
          // camera (z > 1 after projection) is never looking, whatever the
          // x/y say — without that check a lamp directly at your back reads as
          // dead centre.
          const behind = lamp.z > 1;
          const toCentre = Math.hypot(lamp.x, lamp.y);
          const toPointer = Math.hypot(lamp.x - pointer.x, lamp.y - pointer.y);
          const resting = !behind && Math.min(toCentre, toPointer) < WAKE_GAZE_RADIUS;
          // Rests, not merely touches: the gaze has to stay there. Looking away
          // spends the count rather than zeroing it, so a hand that wobbles off
          // the lamp for a frame does not start the reader over.
          state.gaze = Math.max(0, state.gaze + (resting ? delta : -delta * 1.5));
          state.inRoom += delta;
        }
        // The first pass waits on attention, then on patience. `armed` gates it
        // to a single awakening per visit; leaving re-arms it so a return
        // replays the whole thing from its first frame.
        if (state.armed && !state.stopped && !state.failed
            && !state.playing && !state.ended
            && dist < 0.9 && entered
            && (state.gaze >= WAKE_GAZE_DWELL || state.inRoom >= WAKE_PATIENCE)
            && (performance.now() - (stirRef?.current ?? 0)) / 1000 > WAKE_STILL) {
          state.armed = false;
          state.playing = true;
          // Everything the reader did up to this moment is what BROUGHT them
          // here — the walk in, the turn toward the lamp. Only steering from
          // here on counts as interrupting.
          state.stirMark = stirRef?.current ?? 0;
          // `by` records which of the two clocks ran out first, so it is
          // visible whether attention is actually what wakes the galleries or
          // whether the patience floor is quietly doing all the work.
          if (passRef) {
            passRef.current[index] = {
              woke: performance.now(),
              done: 0,
              by: state.gaze >= WAKE_GAZE_DWELL ? 'gaze' : 'patience',
            };
          }
          state.el.currentTime = 0;
          state.el.playbackRate = videoRate; // reassert (load can reset it)
          const p = state.el.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => { state.playing = false; });
          }
        }
        // The reader steers again: the film is over. Whether it was mid-pass or
        // resting between passes, the surface lets go of the clip here and the
        // painting comes back — and `stopped` keeps it back for the rest of
        // this visit, so nothing starts up again behind a shoulder that has
        // already turned. See LIVE_SETTLE.
        if (!state.stopped && (state.playing || state.ended) && dist < 0.9
            && stirRef && stirRef.current > state.stirMark) {
          state.stopped = true;
          state.playing = false;
          state.ended = false;
          state.endedAt = 0;
          state.el.pause();
          // The drift waits on this gallery having said itself once (passRef).
          // A pass cut short never fires its `ended`, so stamp it here: the
          // surface has finished speaking either way, and without this every
          // room the reader walks out of would stall the drift until
          // DRIFT_MAX_DWELL instead of the pass it is actually pacing to.
          const rec = passRef?.current?.[index];
          if (rec && !rec.done) rec.done = performance.now();
        }
        // The dwell breathes on. A pass rests on its last frame, then runs
        // again — for as long as the reader stands here. See REPLAY_REST for
        // why the return to frame 0 is a cut and not a dissolve; uLive is
        // untouched across it (`awake` below reads the same whether the clip is
        // playing or resting), so nothing crossfades, the video's own time just
        // jumps back. The cut rides the next footfall if one lands soon enough,
        // and goes ahead unmasked if the reader is standing perfectly still.
        if (state.ended && dist < 0.9) {
          const rested = performance.now() / 1000 - state.endedAt;
          const onFoot = stepRef
            && performance.now() / 1000 - stepRef.current < REPLAY_STEP_WINDOW;
          if (rested > REPLAY_REST
              && (onFoot || rested > REPLAY_REST + REPLAY_GRACE)) {
            state.ended = false;
            state.playing = true;
            state.el.currentTime = 0;
            state.el.playbackRate = videoRate;
            const p = state.el.play();
            if (p && typeof p.catch === 'function') {
              // Back to resting rather than to the still, so a refused replay
              // costs one rest and tries again instead of dropping uLive and
              // dissolving the end frame into the painting.
              p.catch(() => {
                state.playing = false;
                state.ended = true;
                state.endedAt = performance.now() / 1000;
              });
            }
          }
        }
        // Once the camera has clearly left, reset to a still and re-arm so the
        // next arrival can wake it again from its first frame.
        if (dist > 1.1 && (state.playing || state.ended || !state.armed)) {
          state.playing = false;
          state.ended = false;
          state.endedAt = 0;
          state.armed = true;
          state.stopped = false;
          state.stirMark = 0;
          state.gaze = 0;
          state.inRoom = 0;
          state.el.pause();
          // Re-armed: the next arrival is a fresh awakening, so the drift must
          // wait for it again rather than reading the last visit's pass.
          if (passRef) delete passRef.current[index];
        }
        // Well out of range: tear the element down rather than leaving it
        // parked in the DOM. Paused clips still hold their decoded buffers, so
        // walking the whole corridor used to accumulate one per gallery and the
        // heap climbed the further you went. It is recreated (from its first
        // frame, still armed) whenever the camera comes back within range.
        if (dist > 2.0) {
          for (const m of materials) {
            m.uniforms.mapVideo.value = null;
            // The sampler is going away, so the surface must already be back on
            // the still. It is, by dist 1.1 — but the ease is asymptotic, and
            // sampling a null map with any uLive left would show as a dark wash.
            m.uniforms.uLive.value = 0;
          }
          if (state.tex) {
            state.tex.dispose();
            state.tex = null;
          }
          state.el.pause();
          state.el.removeAttribute('src');
          state.el.load();
          state.el.remove();
          state.el = null;
          state.playing = false;
          state.ended = false;
          state.endedAt = 0;
          state.armed = true;
          state.stopped = false;
          state.stirMark = 0;
          // A new element gets a clean slate: a clip that failed on a bad
          // connection is worth one more try when the reader comes back, and a
          // clip that is genuinely missing costs one more line of console.
          state.failed = false;
          state.stalled = false;
        }
        if (state.el && !state.tex
            && state.el.readyState >= state.el.HAVE_CURRENT_DATA) {
          state.tex = new THREE.VideoTexture(state.el);
          state.tex.colorSpace = THREE.SRGBColorSpace;
          // …AND THE INTERNAL FORMAT TO GO WITH IT. `colorSpace` alone is a
          // promise three keeps for an image texture and drops for a video one:
          // it is what makes three ask for an SRGB8_ALPHA8 texture, which is
          // what makes the SAMPLER do the sRGB->linear decode in hardware. On
          // the video upload path that selection does not happen, and since the
          // painting's fragment shader samples with a raw texture2D() — no
          // decode injected, by design — the shader was handed sRGB-encoded
          // values for the clip and linear ones for the still, then mixed the
          // two together with uLive. At mid-grey that is 0.502 where 0.216 was
          // meant: the woken surface came up 2.3x too bright, and every attempt
          // to correct it with exposure (see VIDEO_GAMMA) was chasing a decode
          // with a curve that cannot be it.
          //
          // Measured in babel-tour/srgb-probe.html, which pushes a known ramp
          // through both paths and reads the values back: with this line the
          // clip lands on the still's numbers exactly, and the same clip drawn
          // via a canvas already did — so this is three's video path, not the
          // driver's. Harmless where a driver would have done it anyway.
          //
          // Fixing it also removed a grade nobody knew was a grade: this
          // surface had been dialled for months against undecoded values, and
          // with them gone the woken plate stopped lifting and every gallery
          // read grey. That look is reconstructed explicitly in the shader now
          // — see VIDEO_LIFT — so the decode can be right and the piece can
          // still look like itself.
          state.tex.internalFormat = 'SRGB8_ALPHA8';
          // Same wrap scheme as the still (mirrored on both axes), so the
          // living surface continues into the margins identically — and so the
          // seam the mirror removes does not reappear when the clip wakes.
          state.tex.wrapS = THREE.MirroredRepeatWrapping;
          state.tex.wrapT = THREE.MirroredRepeatWrapping;
          state.tex.anisotropy = TEX_ANISOTROPY;
          // A MIP CHAIN, explicitly — three's VideoTexture ships with
          // generateMipmaps false and a plain LINEAR min filter, and a texture
          // with no mip chain does not fail an LOD-biased sample, it silently
          // serves level 0 and throws the bias away. Three separate blurs in the
          // fragment shader are expressed as nothing but a bias on mapVideo (the
          // hole-filling backdrop, the defocused extension margins, and what the
          // flood carries under its level), so all three came back at full
          // sharpness the moment a clip woke, while their still counterparts
          // blurred correctly — the doubling was on the moving surface only,
          // which is why it read as a clip problem.
          //
          // The cost is a glGenerateMipmap per uploaded frame, on the one or two
          // clips awake at a time. Cheap next to what it buys, but it IS per
          // frame: if a profile ever shows it, the answer is a fixed small blur
          // in the shader, not dropping back to level 0 everywhere.
          state.tex.generateMipmaps = true;
          state.tex.minFilter = THREE.LinearMipmapLinearFilter;
          // videoWidth/Height are only populated once metadata has loaded,
          // which HAVE_CURRENT_DATA guarantees. The clips are not all one size
          // (1888x800 super-resolved, 1664x708 for the staircases, and the two
          // with no SR twin at their 832x354 source), so BOTH the live unsharp's
          // tap spacing and its strength have to be read per clip.
          const vw = state.el.videoWidth || 944;
          const vh = state.el.videoHeight || 400;
          for (const m of materials) {
            m.uniforms.mapVideo.value = state.tex;
            m.uniforms.uVideoTexel.value.set(1 / vw, 1 / vh);
            m.uniforms.uSharpenVideo.value = VIDEO_SHARPEN * videoSharpenScale(vw);
          }
        }
      }
      // The still exhales into motion when you arrive and settles back to the
      // painting when you move on — either by steering, which ends the film
      // where you stand (LIVE_SETTLE), or by simply leaving, which lets it go a
      // whole chapter back in the fog. In between, whether the clip is running
      // or resting between passes (REPLAY_REST), the surface is the clip's —
      // which is what lets a pass restart as a cut with nothing dissolving.
      //
      // It used to settle the instant the pass ended, and that dissolve was the
      // worst double in the scene: a clip ends as far as 1.3x zoomed from the
      // plate it animates, and its figures have walked regardless (see
      // LIVE_MAX), so crossing back to the still ran a ~1.4 s double exposure —
      // the robed figure of the gothic-library plates plainly drawn twice at
      // full strength, not at the 18% the old mix leaked. Two images that
      // do not register cannot be crossfaded in front of the reader; the fade is
      // therefore pushed out to dist > 1.1 below, a whole chapter away, where
      // the plate is deep in fog and already melting.
      const awake = state.tex && (state.playing || state.ended)
        ? (liveOverride ?? LIVE_MAX)
        : 0;
      // Two rates, not one: an interrupted clip has to be off the surface
      // before its own last frame can be read against the painting it doubles,
      // while the leaving fade stays slow because a chapter of fog is already
      // doing the work.
      const step = Math.min(delta * (state.stopped ? LIVE_SETTLE : LIVE_RISE), 1);
      for (const m of materials) {
        const u = m.uniforms.uLive;
        u.value += (awake - u.value) * step;
      }
    }
  });

  return (
    <group ref={mesh}>
      {layers.map((L, li) => (
        <mesh
          key={li}
          geometry={geos[li]}
          material={materials[li]}
          position={[0, 0, planeZ(index) + L.macro]}
          // Backdrop first, then slabs far-to-near, so translucent card edges
          // blend over what is already behind them; deeper chapters draw first.
          renderOrder={(chapters - index) * 20 + li}
        />
      ))}
    </group>
  );
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Dust field. Density/energy swell as `descentRef` grows, so the deeper you go
// the more alive and thick the air becomes. Lives inside the atmosphere rig,
// so its coordinates are camera-relative.
function Motes({ count = 320, aspect, reduced, descentRef }) {
  const ref = useRef();
  const { pointer } = useThree();
  const sprite = useMemo(
    () => radialTexture([
      [0, 'rgba(236,228,210,1)'],
      [0.3, 'rgba(201,162,76,0.85)'],
      [1, 'rgba(201,162,76,0)'],
    ]), []);
  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const d = 6 + Math.random() * 26;
      const h = frustumH(d);
      positions[i * 3] = (Math.random() - 0.5) * h * aspect * 0.9;
      positions[i * 3 + 1] = (Math.random() - 0.5) * h * 0.9;
      positions[i * 3 + 2] = -d;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    return { positions, seeds };
  }, [count, aspect]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const descent = descentRef.current;
    // The hush (II → III) stills the air along with the light: crossing into
    // the Silence, the dust stops drifting and all but goes out. It is the one
    // crossing where the world does LESS rather than more, and the motes are
    // the only thing in frame still moving by then.
    const hush = crossingWeight(descent, CROSS_HUSH);
    const energy = (1 + descent * 0.35) * (1 - 0.88 * hush);
    const p = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      const swirl = Math.sin(t * 0.4 + s) * 0.0006 + Math.sin(t * 1.3 + s * 1.7) * 0.00025;
      p.array[i * 3 + 1] += (0.0016 + swirl) * energy;
      p.array[i * 3] +=
        (Math.sin(t * 0.22 + s) * 0.0009 + Math.cos(t * 0.9 + s * 2.3) * 0.0004) * energy;
      p.array[i * 3 + 2] += Math.sin(t * 0.3 + s * 0.6) * 0.0008;
      const d = -p.array[i * 3 + 2];
      const h = frustumH(d);
      if (!reduced) {
        const px = pointer.x * h * aspect * 0.5;
        const py = pointer.y * h * 0.5;
        const dx = p.array[i * 3] - px;
        const dy = p.array[i * 3 + 1] - py;
        const dist2 = dx * dx + dy * dy;
        const reach = h * 0.16;
        if (dist2 < reach * reach) {
          const push = (1 - Math.sqrt(dist2) / reach) * 0.012;
          const inv = 1 / (Math.sqrt(dist2) + 0.001);
          p.array[i * 3] += dx * inv * push;
          p.array[i * 3 + 1] += dy * inv * push;
        }
      }
      if (p.array[i * 3 + 1] > h * 0.5) p.array[i * 3 + 1] = -h * 0.5;
    }
    p.needsUpdate = true;
    ref.current.material.opacity =
      (0.6 + Math.min(0.3, descent * 0.12)) * (1 - 0.75 * hush);
  });

  return (
    <points ref={ref} renderOrder={8}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite} size={0.16} transparent opacity={0.75}
        blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation
      />
    </points>
  );
}

function Fog({ depth, y, opacity, scale, aspect, index, descentRef }) {
  const ref = useRef();
  const tex = useMemo(
    () => radialTexture([
      [0, 'rgba(201,162,76,0.55)'],
      [0.5, 'rgba(160,120,60,0.18)'],
      [1, 'rgba(0,0,0,0)'],
    ]), []);
  const h = frustumH(depth);
  useFrame(({ clock }) => {
    ref.current.position.x =
      Math.sin(clock.getElapsedTime() * 0.05 + index * 2.1) * 1.6 * (index + 1);
    // Fog thickens with descent.
    ref.current.material.opacity = opacity * (1 + descentRef.current * 0.28);
  });
  return (
    <mesh ref={ref} position={[0, y * h * 0.5, -depth]} renderOrder={7}>
      <planeGeometry args={[h * aspect * scale, h * 0.5 * scale]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity}
        blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

// Each gallery hangs its own lamp: an additive glow pinned to that image's
// light source (a doorway of fire, a lantern, a moonlit shaft…). It breathes
// and flickers while its chapter is current and dims away with distance.
function Glow({ scene, index, aspect, overscan, accentRef, descentRef, portalRef, libraryMax, diveRef, climbRef, reduced, panRef }) {
  const ref = useRef();
  const { pointer } = useThree();
  const sprite = useMemo(
    () => radialTexture([
      [0, 'rgba(236,228,210,1)'],
      [0.3, 'rgba(201,162,76,0.85)'],
      [1, 'rgba(201,162,76,0)'],
    ]), []);
  const h = frustumH(PLANE_Z) * overscan;
  const w = h * aspect;
  const [u, v] = scene.glowAt;
  // + EYE_DROP: glowAt names a point in the ARTWORK, and the artwork now rides
  // that much higher on its card, so the glow has to travel with the lamp it
  // belongs to or it detaches and floats below it.
  const restY = (0.5 - v + EYE_DROP) * h;
  // Where the lamp hangs before a single frame has run. Its resting X is now a
  // per-frame quantity (the turn walks it to whichever mirrored copy of the
  // artwork the gaze is on), so this is only the seed the first useFrame
  // overwrites — the home bay, which is bayU(u, 0) = u.
  const homeX = (u - 0.5) * w;
  const base = frustumH(PLANE_Z) * 0.4;
  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(descentRef.current - index) * 1.5);
    ref.current.visible = proximity > 0.001;
    if (!ref.current.visible) {
      return;
    }
    const t = clock.getElapsedTime();
    const flicker =
      Math.sin(t * 0.5) * 0.06 +
      Math.sin(t * 1.7 + 1.1) * 0.03 +
      Math.sin(t * 4.3 + 0.4) * 0.015;
    // The turn carries the lamp along the card with the picture it belongs to —
    // to the nearest of its mirrored copies, so every bay the reader turns into
    // is lit by its own light rather than by a glow left behind at home.
    const restX = (bayU(u, panRef ? wrapBays(panRef.current) : 0) - 0.5) * w;
    const px = reduced ? restX : restX + pointer.x * w * 0.12;
    const py = reduced ? restY : restY + pointer.y * h * 0.12;
    // A turn can hand the glow a copy a whole bay away; easing across that gap
    // would drag a light across the room. Cut to it instead — it is a different
    // lamp, and the one it left is behind the reader.
    const jump = Math.abs(px - ref.current.position.x) > w * 0.5;
    ref.current.position.x = jump ? px : ref.current.position.x + (px - ref.current.position.x) * 0.05;
    ref.current.position.y += (py - ref.current.position.y) * 0.05;
    const near = reduced ? 0 : Math.max(0, 0.12 - Math.abs(pointer.x) * 0.06 - Math.abs(pointer.y) * 0.06);
    ref.current.material.opacity = (0.27 + flicker + near) * proximity;
    let s = (1 + Math.sin(t * 0.9) * 0.04 + near * 0.8) * scene.glowScale;
    ref.current.material.color.lerp(accentRef.current, 0.05);

    // The kindled portal: once the door has opened at the vortex, its core stops
    // being a lamp and becomes a beacon — a brighter, quicker heartbeat that
    // warms toward gold, so the reader can see where the descent now leads.
    if (portalRef && portalRef.current && index === libraryMax) {
      const kindle = 0.5 + Math.sin(t * 1.6) * 0.14 + Math.sin(t * 3.1 + 0.7) * 0.05;
      ref.current.material.opacity = Math.max(
        ref.current.material.opacity,
        (0.34 + kindle * 0.4) * proximity,
      );
      s = (1.28 + Math.sin(t * 1.1) * 0.1) * scene.glowScale;
      ref.current.material.color.lerp(WARM_CORE, 0.06);
    }

    // The dive falls INTO this light — but the spiral stays the show. The core
    // only warms and leans forward a little as the camera plunges: enough that
    // the throat reads as a lit destination, never a gold flood over the walls.
    // On the climb the same thing happens to the doorway you are being drawn
    // back out through, so the hand-off is lit from both sides either way.
    const rising = climbRef && index === libraryMax + 1;
    if ((diveRef && index === libraryMax) || rising) {
      const dp = Math.min(Math.max((rising ? climbRef : diveRef).current, 0), 1);
      if (dp > 0.001) {
        const surge = diveThrust(dp);
        ref.current.material.opacity = Math.min(
          1,
          ref.current.material.opacity + surge * 0.22 * proximity,
        );
        // The throat throbs as it is fallen into — a slow swell out of phase
        // with the kindle above it, so the light the fall aims at is never
        // quite the size it was a moment ago. It is a small thing that does a
        // lot of work: it is the only part of the frame the swim never moves
        // off, so if it held still it would be a fixed point in a fall.
        s *= 1 + surge * (0.62 + Math.sin(t * 1.7) * 0.14);
        ref.current.material.color.lerp(WARM_CORE, 0.12);
      }
    }
    ref.current.scale.set(base * s, base * s, 1);
  });
  return (
    <sprite
      ref={ref}
      position={[homeX, restY, planeZ(index) + 2]}
      scale={[base, base, 1]}
      renderOrder={6}
    >
      <spriteMaterial map={sprite} transparent opacity={0.3}
        blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
    </sprite>
  );
}

function shaftTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 256;
  const g = c.getContext('2d');
  const vert = g.createLinearGradient(0, 0, 0, 256);
  vert.addColorStop(0, 'rgba(236,228,210,0)');
  vert.addColorStop(0.5, 'rgba(236,228,210,0.9)');
  vert.addColorStop(1, 'rgba(236,228,210,0)');
  g.fillStyle = vert;
  g.fillRect(0, 0, 32, 256);
  const horiz = g.createLinearGradient(0, 0, 32, 0);
  horiz.addColorStop(0, 'rgba(0,0,0,1)');
  horiz.addColorStop(0.5, 'rgba(0,0,0,0)');
  horiz.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = horiz;
  g.fillRect(0, 0, 32, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function LightShafts({ aspect, accentRef, count = 4, reduced }) {
  const group = useRef();
  const { pointer } = useThree();
  const tex = useMemo(shaftTexture, []);
  const shafts = useMemo(() => {
    const d = PLANE_Z - 2;
    const h = frustumH(d);
    const w = h * aspect;
    return Array.from({ length: count }, (_, i) => ({
      x: (i / (count - 1) - 0.5) * w * 0.75,
      z: -d,
      w: w * (0.08 + Math.random() * 0.05),
      h: h * 1.4,
      seed: Math.random() * Math.PI * 2,
      tilt: (Math.random() - 0.5) * 0.25,
    }));
  }, [aspect, count]);

  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }
    const t = clock.getElapsedTime();
    const lean = reduced ? 0 : -pointer.x * 0.22;
    group.current.children.forEach((mesh, i) => {
      const s = shafts[i];
      const target = s.tilt + lean + Math.sin(t * 0.12 + s.seed) * 0.06;
      mesh.rotation.z += (target - mesh.rotation.z) * 0.06;
      mesh.material.opacity =
        reduced ? 0.05 : 0.06 + Math.max(0, Math.sin(t * 0.35 + s.seed)) * 0.09;
      mesh.material.color.lerp(accentRef.current, 0.05);
    });
  });

  return (
    <group ref={group} renderOrder={6}>
      {shafts.map((s, i) => (
        <mesh key={i} position={[s.x, s.h * 0.12, s.z]} rotation={[0, 0, s.tilt]}>
          <planeGeometry args={[s.w, s.h]} />
          <meshBasicMaterial
            map={tex} transparent opacity={0.08}
            blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// A ring of light suspended in each gap between galleries; the camera slips
// through one mid-transition, just as the dissolving veil clears — a hushed
// threshold between chapters. It stays dark while the camera dwells.
function PortalRings({ accentRef, descentRef, chapters }) {
  const group = useRef();
  // Ring i hangs a little past the midpoint of gap i; the camera crosses its
  // plane at this descent value.
  const passAt = (i) => i + 0.5 + 4 / SCENE_SPACING;
  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }
    const t = clock.getElapsedTime();
    const descent = descentRef.current;
    group.current.children.forEach((ring, i) => {
      // Each gate now keeps the character of the rite it stands in: the
      // winding's turns visibly, the weave's turns quicker and gives less, and
      // the one on the way into the Silence does not light at all.
      const kind = RITE_RING[RITES[i] ?? RITE.PLAIN] ?? { glow: 1, spin: 0.08 };
      ring.rotation.z = t * kind.spin + i;
      // Lights only around the crossing, fully out by the time the camera rests.
      const proximity = Math.max(0, 1 - Math.abs(descent - passAt(i)) * 2.8);
      ring.material.opacity = (0.03 + proximity * 0.32) * kind.glow;
      ring.material.color.lerp(accentRef.current, 0.05);
      ring.scale.setScalar(1 + proximity * 0.12);
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: chapters - 1 }, (_, i) => (
        <mesh key={i} position={[0, 0, -(SCENE_SPACING * (i + 0.5) + 4)]} renderOrder={5}>
          <torusGeometry args={[3.4, 0.05, 16, 120]} />
          <meshBasicMaterial transparent opacity={0.08} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// Carries the ambient layers (dust, ground fog, light shafts) along with the
// camera so the air travels down the corridor with you.
function AtmosphereRig({ descentRef, immersionRef, introRef, children }) {
  const group = useRef();
  useFrame(() => {
    group.current.position.z = camZOpening(
      descentRef.current,
      immersionRef ? immersionRef.current : 0,
      introRef ? introRef.current : 0,
    );
  });
  return <group ref={group}>{children}</group>;
}

// Grades the corridor's darkness itself: the background and the shared fog
// color drift between each chapter's mood — warm candle-brown at the threshold,
// cooling toward moonlit blue-black in the vertigo, settling to ash at the
// silence. Every painting fogs toward this same color, so distant galleries
// melt seamlessly into the void.
function GradeRig({ scenes, descentRef, fogRef }) {
  const { scene } = useThree();
  const fogs = useMemo(() => scenes.map((s) => new THREE.Color(s.fog)), [scenes]);
  // Dev-only live tuner for the video grade (stripped from production builds).
  // These four were tuned against soft 400p clips and a different complaint
  // ("the clips look pale"), and were still on the retune-on-real-hardware
  // list — swiftshader can't judge them, so they have to be dialled by eye in
  // a real browser. From the console:
  //   __grade()                  → read the current values
  //   __grade({ sat: 1.1 })      → set one, live, across every card on screen
  // Nothing here persists: reload restores the module constants above. `sharpen`
  // is additionally rewritten whenever a clip wakes, to VIDEO_SHARPEN scaled to
  // that clip's width — so read it back after a wake, and judge it on one
  // gallery at a time rather than expecting a value to hold across the corridor.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const KEYS = {
      sat: 'uVideoSat',
      contrast: 'uVideoContrast',
      sharpen: 'uSharpenVideo',
      gamma: 'uVideoGamma',
      // The one to reach for if the woken surface is ever accused of exposure
      // again: 1 is the curve the piece was signed off on, 0 is the clip
      // sitting physically on its still, and the whole argument for both is in
      // VIDEO_LIFT. Walk it, don't re-dial `gamma` — gamma only means anything
      // in the space this selects.
      lift: 'uVideoLift',
    };
    // The scene itself, for A/Bs that have to reach a texture rather than a
    // uniform. The one this exists for is the video mip chain: whether the clip
    // can be blurred at all is a property of the TEXTURE, so __grade can report
    // it (videoMip, below) but not toggle it. With this you can flip it live and
    // judge the difference on real hardware — which is the only place it can be
    // judged, since headless swiftshader's own frame-to-frame motion measures
    // larger than the change being looked at. From the console:
    //   const mip = (on) => window.__scene.traverse((o) => {
    //     const t = o.material?.uniforms?.mapVideo?.value; if (!t) return;
    //     t.generateMipmaps = on;
    //     t.minFilter = on ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    //     t.needsUpdate = true;
    //   });
    // mip(false) is the old behaviour; mip(true) is what ships. Walk into a
    // gallery and let the clip wake first, or nothing will differ.
    window.__scene = scene;
    window.__grade = (next) => {
      // `live` is not a uniform — it pins the still/clip mix at its source, so
      // the per-frame ease cannot immediately overwrite it. null restores normal.
      if (next && next.live !== undefined) liveOverride = next.live;
      const seen = { live: liveOverride ?? `auto (${LIVE_MAX})` };
      // Read back the DISTINCT values, not the last card traversed. `sharpen`
      // is per-clip now (VIDEO_SHARPEN_REF), so the corridor legitimately holds
      // several at once — reporting one of them at random hid whether the
      // per-clip write had happened at all.
      const found = Object.fromEntries(Object.keys(KEYS).map((k) => [k, new Set()]));
      scene.traverse((obj) => {
        const u = obj.material?.uniforms;
        if (!u?.uVideoSat) return;
        for (const [name, uniform] of Object.entries(KEYS)) {
          if (next && next[name] !== undefined) u[uniform].value = next[name];
          found[name].add(Math.round(u[uniform].value * 1e4) / 1e4);
        }
      });
      for (const [name, values] of Object.entries(found)) {
        const all = [...values].sort((a, b) => a - b);
        seen[name] = all.length === 1 ? all[0] : all;
      }
      // Whether the woken clip can actually be blurred. Reported because the
      // failure it guards against is INVISIBLE at the API: sampling an LOD bias
      // on a texture with no mip chain is not an error, it silently returns
      // level 0 — so the margins, the backdrop and the echo's receding copies
      // all came back sharp with nothing anywhere saying why (see the
      // VideoTexture setup). If this ever reads NO MIP CHAIN while a clip is
      // awake, every blurBias in the fragment shader is being thrown away.
      // `isVideoTexture`, not merely non-null: mapVideo is INITIALISED to the
      // still (see the uniform), which stands in until a clip wakes. Reporting
      // on that placeholder answered for the painting while claiming to answer
      // for the film — and the still, being an ordinary image texture, gives
      // the opposite verdict on both counts.
      const mip = new Set();
      scene.traverse((obj) => {
        const t = obj.material?.uniforms?.mapVideo?.value;
        if (!t?.isVideoTexture) return;
        mip.add(t.generateMipmaps && t.minFilter !== THREE.LinearFilter
          && t.minFilter !== THREE.NearestFilter
          ? `mip (minFilter ${t.minFilter})` : 'NO MIP CHAIN — blurBias ignored');
      });
      seen.videoMip = mip.size === 0 ? 'no clip awake' : [...mip];
      // …and whether the clip is being sRGB DECODED, reported for exactly the
      // same reason: nothing anywhere says when it is not. three drops the sRGB
      // internal format on the video upload path however the colourSpace is
      // set, and the only symptom is a woken surface 2.3x too bright in the
      // midtones — which for months was read as "the clips are pale" and
      // answered with exposure. If this ever reads RAW sRGB, the live half of
      // every mix is in the wrong space again.
      const fmt = new Set();
      scene.traverse((obj) => {
        const t = obj.material?.uniforms?.mapVideo?.value;
        if (!t?.isVideoTexture) return;
        fmt.add(t.internalFormat === 'SRGB8_ALPHA8'
          ? 'SRGB8_ALPHA8 (decoded)'
          : `RAW sRGB — internalFormat ${t.internalFormat} — live surface too bright`);
      });
      seen.videoFormat = fmt.size === 0 ? 'no clip awake' : [...fmt];
      return seen;
    };
    // Live tuner for the eye line (see EYE_DROP), same reason: how high the
    // viewer sits in a painting is a judgement only a real screen can make.
    //   __eye()        → current shift, in fractions of the artwork's height
    //   __eye(0)       → the old framing, dwelling on the plate's center
    //   __eye(0.15)    → lower still; past ~0.13 the plate's bottom edge lifts
    //                    into frame at the dwell and the mirrored margin shows
    // Only the paintings follow this: the glow sprites and the dive's aim take
    // EYE_DROP at construction, so they hold their old anchors until you set
    // the constant and reload. Judge the framing here, then commit it there.
    const overs = new WeakMap();
    window.__eye = (v) => {
      let seen = null;
      scene.traverse((obj) => {
        const u = obj.material?.uniforms;
        if (!u?.uEyeShift) return;
        // Recover this card's scale-up from its default shift the first time we
        // meet it, so every layer keeps moving by a common angle as you dial.
        if (!overs.has(obj.material)) {
          overs.set(obj.material, EYE_DROP / (u.uEyeShift.value || EYE_DROP));
        }
        const over = overs.get(obj.material);
        if (v !== undefined) u.uEyeShift.value = v / over;
        seen = u.uEyeShift.value * over;
      });
      return seen;
    };
    // Live dial for the rites of passage. A threshold is only judgeable
    // against the plain melt it replaced, and the two cannot be seen minutes
    // apart on a corridor whose crossings take seven seconds each:
    //   __rites()      → the master strength (1 = the rites, 0 = the old melt)
    //   __rites(0)     → every crossing back on the plain depth-melt
    //   __rites(1)     → back on
    // Pair with Tour's __rite(c, p), which parks the camera partway through
    // crossing c so a threshold can be looked at instead of caught.
    window.__rites = (amt) => {
      let seen = null;
      scene.traverse((obj) => {
        const u = obj.material?.uniforms;
        if (!u?.uRiteAmt) return;
        if (amt !== undefined) u.uRiteAmt.value = amt;
        seen = u.uRiteAmt.value;
      });
      return seen;
    };
    // What it takes to wake a painting. How wide "looking at the lamp" should
    // be, and how long it must last, are judgements about feel that only a real
    // screen and a real hand can make — the same reason __grade and __gait
    // exist. Takes effect on the next gallery to wake; galleries already awake
    // keep their pass.
    //   __attention()                  → read the current values
    //   __attention({ radius: 0.3 })   → tighter: the lamp must be nearer centre
    //   __attention({ patience: 1e9 }) → attention ONLY, to feel it unaided
    //   __attention({ still: 0 })      → let a plate wake mid-stride again
    // Which clock actually fired is in Tour's __nav().pass, as gaze/patience.
    window.__attention = (next) => {
      if (next?.radius !== undefined) WAKE_GAZE_RADIUS = next.radius;
      if (next?.dwell !== undefined) WAKE_GAZE_DWELL = next.dwell;
      if (next?.patience !== undefined) WAKE_PATIENCE = next.patience;
      if (next?.still !== undefined) WAKE_STILL = next.still;
      return {
        radius: WAKE_GAZE_RADIUS, dwell: WAKE_GAZE_DWELL, patience: WAKE_PATIENCE,
        still: WAKE_STILL,
      };
    };
    return () => {
      delete window.__grade; delete window.__eye; delete window.__rites;
      delete window.__scene; delete window.__attention;
    };
  }, [scene]);
  useFrame(() => {
    const cur = descentRef.current;
    const lo = Math.max(0, Math.min(Math.floor(cur), fogs.length - 1));
    const hi = Math.min(lo + 1, fogs.length - 1);
    fogRef.current.copy(fogs[lo]).lerp(fogs[hi], cur - lo);
    if (scene.background && scene.background.isColor) {
      scene.background.copy(fogRef.current);
    } else {
      scene.background = fogRef.current.clone();
    }
  });
  return null;
}

// The camera rig: a slow, atmospheric dwell that presses deeper with each
// chapter. Gazes into the corridor and can pan left/right (yaw) and tilt
// up/down (pitch) to look around. Never rushes, and never gains height by
// moving: the walk-in is pure translation along z (the footfall bob aside).
function DescentRig({ descentRef, immersionRef, introRef, lamps, yawRef, pitchRef, diveRef, climbRef, refuseRef, coreUV, portalRef, libraryMax, aspect, parallax, reduced, onStep, tiltRef }) {
  const { camera, pointer } = useThree();
  const lookAt = useRef(new THREE.Vector3(0, 0, -PLANE_Z));
  const scratch = useRef(new THREE.Vector3());
  // The camera's eased base position; the gait offsets ride on top of it each
  // frame (they must not feed back into the ease, or they'd accumulate).
  const basePos = useRef(new THREE.Vector3(0, 0, 0));
  // The gait's running state: distance-paced phase, swing strength, smoothed
  // bob/sway offsets, the last footfall index (for the step sounds), and the
  // eased spiral draw.
  const walk = useRef({ prevZ: null, phase: 0, intensity: 0, bob: 0, sway: 0, nod: 0, lastStep: 0, draw: 0, seeded: false });
  // Dev-only live tuner for the gait (stripped from production builds). How
  // much step a body should feel is pure judgement and needs a real screen and
  // a real walk down the corridor; from the console, mid-walk:
  //   __gait()                    → read the current values
  //   __gait({ bob: 0.03 })       → set one, live, no reload
  //   __gait({ bob: 0, sway: 0, roll: 0 })  → the gait off entirely
  // Nothing persists: reload restores the GAIT constants above.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__gait = (next) => Object.assign(GAIT, next);
    // The same, for the eye's focus — how much softness a near foreground
    // should carry is pure judgement, and judgement needs a real screen and a
    // real walk in. Live, no reload, so it can be A/B'd against ITSELF without
    // the per-load random draw changing the artwork underneath the comparison:
    //   __dof()              → read the current values
    //   __dof({ gain: 0 })   → off; __dof({ gain: 6 }) → plainly overdone
    window.__dof = (next) => Object.assign(DOF, next ?? {});
    // …and the opening shot's reach. See SHOT.
    window.__shot = (next) => Object.assign(SHOT, next ?? {});
    // …and the backdrop's dis-occlusion fill. See FILL. The A/B this exists for
    // is __fill({ hi: 0 }), and it MUST be shot inside one session.
    window.__fill = (next) => Object.assign(FILL, next ?? {});
    // Stand the body on its mark NOW, skipping the follower — the seeding path
    // below, reopened. The follower is wall-clock eased but its dt is clamped
    // to 0.1 s a frame, so under headless GL's handful of frames per second it
    // takes the better part of two minutes to cover ground it covers in one
    // second on a real screen. Worse, a poll that watches for it to stop moving
    // cannot tell "arrived" from "has not drawn a frame yet", which is how a
    // capture ends up reporting a framing nobody is looking at.
    //   __intro(1); __reseat()   → the opening framing, on the next frame
    // Nothing about the tour needs this; it exists so a framing can be shot.
    window.__reseat = () => { walk.current.seeded = false; };
    return () => {
      delete window.__gait; delete window.__dof;
      delete window.__shot; delete window.__reseat; delete window.__fill;
    };
  }, []);
  useFrame(({ clock }, delta) => {
    const immersion = immersionRef ? immersionRef.current : 0;
    const z = camZImmersed(descentRef.current, immersion);
    const yaw = yawRef ? yawRef.current : 0;
    const pitch = pitchRef ? pitchRef.current : 0;
    // How much of the opening withdrawal is still standing in the room. 1 the
    // instant the title card lets go, 0 once the shot has handed the corridor
    // over — and 0 for the whole of the rest of the tour.
    const intro = introRef ? Math.min(Math.max(introRef.current, 0), 1) : 0;

    // Where the body actually ended up. R3F keeps its camera OUT of the scene
    // graph, so __scene.traverse cannot find it and there is otherwise no way
    // to ask "did that gesture move me, or only turn my head?" from the console
    // or from a headless check. Set BEFORE the reduced-motion return, not after
    // it: a still frame — no clip, no gait, no breath — is the one a capture
    // most wants to compare against itself, and reduced motion is how you get
    // one, so having the hook vanish in exactly that mode was backwards.
    if (import.meta.env.DEV) window.__cam = camera;

    if (reduced) {
      camera.position.set(0, 0, z);
      camera.lookAt(0, 0, z - PLANE_Z);
      return;
    }

    const dt = Math.min(delta, 0.1);
    const t = clock.getElapsedTime();
    const w = walk.current;

    // Vortex dive progress, needed early: a fall has no footsteps, so the gait
    // is silenced for its whole duration — and so is the climb back up it.
    const dive = diveRef ? Math.min(Math.max(diveRef.current, 0), 1) : 0;
    const climb = climbRef ? Math.min(Math.max(climbRef.current, 0), 1) : 0;
    const borne = Math.max(dive, climb);

    // --- Walking gait, paced by ground ACTUALLY covered ----------------------
    // Paced by the eased base position (still last frame's value at this point;
    // it updates below), not the raw target z. The target leads the visible
    // camera by the ease's whole lag — pacing from it fired the footsteps early
    // and left the tail of every move gliding steplessly, i.e. floating.
    const zEased = basePos.current.z;
    if (w.prevZ === null) w.prevZ = zEased;
    const travelled = Math.abs(zEased - w.prevZ);
    w.prevZ = zEased;
    // …and nor does the opening withdrawal: the establishing shot is a CAMERA
    // drawing back, not a body walking backwards out of the room. Left to the
    // gait it laid a full stride's worth of footfalls under the one stretch of
    // the piece where nobody has taken a step yet.
    const speed = (borne > 0.001 || intro > 0.002)
      ? 0
      : travelled / Math.max(delta, 1e-4);
    // Advance the gait phase by (capped) distance covered, so it only stirs
    // while you move and never quickens into a jog on a fast step-in.
    const gaitStep = Math.min(speed, GAIT_SPEED_CAP) * dt;
    w.phase += (gaitStep / STRIDE_LENGTH) * Math.PI * 2;
    if (w.phase > Math.PI * 1000) {
      // Rewind by an even multiple of π: sin and footfall parity both survive.
      w.phase -= Math.PI * 1000;
      w.lastStep = Math.floor(w.phase / Math.PI);
    }
    // How strongly it swings — rises while walking, eases back to nothing the
    // moment forward motion stops. Smooth onset so it never snaps in.
    const speedNorm = Math.min(speed / WALK_REF_SPEED, 1);
    w.intensity += (speedNorm - w.intensity) * (1 - Math.exp(-dt * 4));
    const gI = w.intensity;
    // Two footfalls per stride: |sin| dips at every half-turn of phase — each
    // planted foot — and the 1.35 exponent rounds the cusp so the drop lands
    // softly (weight, not impact). The sway shifts onto each foot in turn at
    // half that frequency, and below it also rolls the head slightly.
    const dip = Math.pow(Math.abs(Math.sin(w.phase)), GAIT.cusp);
    const bobTarget = (dip - 0.6) * GAIT.bob * gI;
    const swayTarget = Math.sin(w.phase) * GAIT.sway * gI;
    // The nod rides the SAME dip as the bob — head down as the foot plants,
    // up through the middle of the stride — so the two read as one movement
    // rather than two rhythms beating against each other.
    const nodTarget = (dip - 0.6) * GAIT.pitch * gI;
    // A fast follower — enough smoothing to round any residual edge without
    // flattening the ~2 Hz step rhythm the way the main position ease would.
    const gaitEase = 1 - Math.exp(-dt * 14);
    w.bob += (bobTarget - w.bob) * gaitEase;
    w.sway += (swayTarget - w.sway) * gaitEase;
    w.nod += (nodTarget - w.nod) * gaitEase;
    // Each half-stride boundary while genuinely walking is a footfall — let the
    // soundscape place a soft step under it.
    const stepIndex = Math.floor(w.phase / Math.PI);
    if (stepIndex !== w.lastStep) {
      w.lastStep = stepIndex;
      if (gI > 0.28 && onStep) {
        onStep(gI);
      }
    }

    // --- Idle: the faint life of standing still. Kept to a breath — a slow
    // rise-and-fall and the barest lateral drift — so waiting reads as a body
    // at rest, not something adrift on water.
    //
    // IT MUST YIELD COMPLETELY WHILE WALKING, and used not to: at (1 - gI*0.7)
    // a full walk still carried 30% of it, which is ~0.033 units of lateral
    // drift on a ~126-second period. That is the same order as the entire
    // footfall bob (0.047 p-p) but SLOW and CONTINUOUS — and a slow continuous
    // sideways drift is not a detail underneath a walk, it IS the sensation of
    // floating. It was quietly outweighing the rhythm it was meant to sit
    // under. Now it goes to nothing as the gait comes up.
    const calm = 1 - immersion * 0.6;
    const idle = (1 - gI) * calm;
    const swayX = (Math.sin(t * 0.05) * 0.07 + Math.sin(t * 0.021) * 0.04) * idle;
    const swayY = (Math.sin(t * 1.1) * 0.022 + Math.cos(t * 0.04) * 0.04) * idle;

    // Vortex dive. `thrust` is the front-loaded fall-shape; while it is alive the
    // camera doesn't just re-aim, it dollies bodily toward the painted core —
    // plungeZ drives it forward down the tunnel, leanX/leanY drift its body after
    // the light, and coreX/coreY swing the gaze so the spiral mouth rushes up to
    // swallow the frame. All are shapes of dive-progress (0 at both ends), so the
    // garden still arrives centered at its normal dwell once the flash clears.
    const thrust = dive > 0.001 ? diveThrust(dive) : 0;

    // The woken spiral's draw. Once the portal has kindled, dwelling at the
    // vortex stops facing the plate head-on: part of the turn happens the
    // moment the whisper appears, and walking in completes it. It eases in
    // slowly (a deliberate turn of the head, never a snap), holds through the
    // fall (the dive counts as full commitment, so the throat stays in the
    // gaze the whole way down), and gates out across the dive's back half so
    // the garden still arrives upright and centered at its normal dwell.
    let drawTarget = 0;
    if (portalRef && portalRef.current && libraryMax != null && coreUV) {
      const nearVortex = Math.max(0, 1 - Math.abs(descentRef.current - libraryMax) * 2);
      const committed = dive > 0.001 ? 1 : immersion;
      drawTarget = nearVortex * (DRAW_BASE + (1 - DRAW_BASE) * committed);
    }
    w.draw += (drawTarget - w.draw) * (1 - Math.exp(-dt * 0.9));
    const draw = w.draw * (1 - THREE.MathUtils.smoothstep(dive, 0.55, 0.9));

    let coreX = 0;
    let coreY = 0;
    let leanX = 0;
    let leanY = 0;
    let plungeZ = 0;
    if ((thrust > 0.0001 || draw > 0.0001) && coreUV) {
      const fh = frustumH(PLANE_Z);
      const dx = (coreUV[0] - 0.5) * fh * aspect;
      // Same correction as the glow: the spiral's mouth sits EYE_DROP of the
      // art height higher on the plate than it used to, and the gaze has to
      // find it there or the dive aims below the throat it is falling into.
      const dy = (0.5 - coreUV[1]) * fh + EYE_DROP * fh * OVERSCAN;
      // Aim and lean each take whichever pull is stronger — the standing draw
      // or the dive's own shape — so the hand-off from staring into the mouth
      // to falling through it is continuous in both.
      const aim = Math.max(thrust, draw);
      const leanFall = DIVE_LEAN * thrust;
      const lean = Math.max(leanFall, DRAW_LEAN * draw);
      coreX = dx * DIVE_AIM * aim;
      coreY = dy * DIVE_AIM * aim;
      leanX = dx * lean;
      // The body drifts vertically toward the core only while actually
      // FALLING. The standing draw leans sideways alone: the vortex core sits
      // low in its plate, and letting the draw pull on y meant stepping in
      // there sank the eye — an elevation change bought by walking forward,
      // which is precisely what the walk-in must never do.
      leanY = dy * leanFall;
      // The fall is measured from the DWELL, not from wherever the body is
      // standing when it commits: the ground the walk-in already covered is
      // ground the plunge starts FROM rather than covers twice. Subtracting it
      // live is what lets Tour hold the immersion through the fall instead of
      // zeroing it — with the old flat `DIVE_PLUNGE * thrust`, holding it would
      // have driven the camera a full APPROACH past the near cards at the
      // crest, and zeroing it opened every dive with the body being hauled ten
      // units back out of the mouth it had just walked into. This way the total
      // travel from the dwell is immersion·APPROACH at p=0 (continuous with the
      // walk, no yank), exactly DIVE_PLUNGE at the crest whatever the reader
      // did on the way in, and 0 on landing as Tour releases the immersion.
      plungeZ = (DIVE_PLUNGE - immersion * APPROACH) * thrust;
      // The swim. Rides on thrust², so it is absent at both lips of the fall
      // and strongest in the deep, where it turns a straight plunge into
      // vertigo — the eye keeps losing the throat and finding it again.
      const swim = thrust * thrust;
      coreX += Math.sin(t * 0.77) * fh * aspect * DIVE_SWIM_X * swim;
      coreY += Math.cos(t * 0.53) * fh * DIVE_SWIM_Y * swim;
    }

    // The opening's pan. The shot starts turned toward the lamp this gallery
    // hangs — its doorway of fire, its lantern, its moonlit shaft — and unwinds
    // to square as the body draws back, so the room is arrived at head-on. The
    // aim is CLAMPED to a fraction of the frame: a lamp sitting near the plate's
    // edge would otherwise swing the frame off the artwork and onto the fogged
    // mirror margin, which at rest is meant never to be seen.
    if (intro > 0.0001) {
      // Spent while the withdrawal still has INTRO_GAZE_SPENT left to run, so
      // the frame squares up first and then goes on opening.
      // …and yields to the spiral's draw. A reader can resume standing AT the
      // vortex with the door already earned (both the position and the door
      // survive the visit), and there the gaze is being turned toward that same
      // light by something with a great deal more to say about it. Summed, the
      // two swings would carry the frame further off the plate than either was
      // ever measured against; handed over, the opening's pan simply gives way
      // as the draw rises.
      const g = THREE.MathUtils.smoothstep(intro, INTRO_GAZE_SPENT, 1) * (1 - draw);
      if (g > 0.0001) {
        const fh = frustumH(PLANE_Z);
        const lamp = lamps?.[Math.round(descentRef.current)];
        const cap = INTRO_SWING * fh * aspect;
        const dx = lamp ? (lamp[0] - 0.5) * fh * aspect * INTRO_AIM : 0;
        coreX += Math.min(Math.max(dx, -cap), cap) * g;
        // The vault, given back. Flat rather than aimed at the lamp: the plates
        // are painted from above head height and the eye line already rides on
        // the axis (EYE_DROP), so a vertical aim here would spend the opening
        // re-hoisting the vantage the framing exists to have brought down.
        coreY += INTRO_RISE * fh * g;
      }
    }

    // The climb: the same fall run backwards. The shaft hauls the body back up
    // it (a NEGATIVE plunge — the camera travels away from the plate it is
    // leaving, which on this corridor is the direction of the library), the
    // gaze lifts the way it is being carried, and the corkscrew unwinds the
    // other way. Same fall-shape as the dive, so it peaks just before the
    // ghost hand-off and is spent by the time the vortex is standing there.
    const haul = climb > 0.001 ? diveThrust(climb) : 0;
    if (haul > 0.0001) {
      plungeZ -= CLIMB_HAUL * haul;
      coreY += CLIMB_LIFT * frustumH(PLANE_Z) * haul;
    }

    // The look-around offset: the mouse where there is one, the handset's own
    // tilt where there is not. They ADD rather than switch, so a touch laptop
    // (which has both) gets each without a mode to choose between, and a device
    // with no tilt sensor simply contributes zero here.
    const tilt = tiltRef?.current;
    const aimX = pointer.x + (tilt?.x ?? 0);
    const aimY = pointer.y + (tilt?.y ?? 0);
    const targetX = aimX * parallax.x + swayX + leanX;
    // No term here scales with immersion: moving in changes z and nothing else,
    // so the eye holds its level from the gallery mouth to the deepest stand.
    // (The footfall bob is added after the ease, below — that is a stride, not
    // a change of vantage.)
    const targetY = aimY * parallax.y + swayY + leanY;
    // …and the opening's dolly, which is the whole of the withdrawal's travel:
    // the shot opens SHOT.push deep in the room and draws back out to the
    // dwell. Folded into the target rather than added after the ease, so the
    // body carries the same inertia into and out of it that it carries
    // everywhere else — the crane has weight.
    const targetZ = z - plungeZ - intro * SHOT.push;

    // Very soft easing of the BASE position — the body glides, it never snaps.
    // Wall-clock based so the glide is identical on every refresh rate. During
    // the dive the plunge is baked into the target, so this same ease lends the
    // fall a little inertia — the body lags the target, then is hauled in.
    // The gait offsets are added on top AFTER the ease (from their own fast
    // follower above): step rhythm survives, and it can't feed back into the
    // ease and accumulate.
    //
    // The one exception is being CARRIED. A body in free fall is not a camera
    // being dolly-dragged toward a mark, and at the walk's 1.2/s the follower's
    // near-second of lag low-passed the plunge's acceleration into a glide —
    // the fall's whole build got smoothed off. So the follower tightens with
    // the fall and lets the body go where the shaft takes it.
    const ease = 1 - Math.exp(-dt * (1.2 + borne * 2.4));
    const bp = basePos.current;
    // First frame: STAND the body where it belongs rather than easing in to it
    // from the world origin. The follower needs a couple of seconds to cover
    // any distance, and there are two ways that distance is not zero — a walk
    // resumed deep in the corridor (camZ of a chapter several galleries down),
    // and the opening withdrawal, which starts the camera pressed into the
    // room. Both would otherwise open on the body being flown to its mark.
    let seated = false;
    if (!walk.current.seeded) {
      walk.current.seeded = true;
      seated = true;
      bp.set(targetX, targetY, targetZ);
      walk.current.prevZ = targetZ;   // …and no phantom stride to show for it
    }
    bp.x += (targetX - bp.x) * ease;
    bp.y += (targetY - bp.y) * ease;
    bp.z += (targetZ - bp.z) * ease;
    // The refusal lean, from the timestamp Tour stamps on a blocked step. Rides
    // AFTER the ease with the gait offsets, and for the same reason: the base
    // follower (1.2/s) would low-pass a shove this brief down to nothing. A
    // damped sine — forward hard, back softly, still by REFUSE_TIME.
    let refuseZ = 0;
    if (refuseRef && refuseRef.current) {
      const age = (performance.now() - refuseRef.current) / 1000;
      if (age >= 0 && age < REFUSE_TIME) {
        refuseZ = -REFUSE_PUSH
          * Math.sin((age / REFUSE_PERIOD) * Math.PI * 2)
          * Math.exp(-age * 4.6);
      }
    }
    camera.position.set(bp.x + w.sway, bp.y + w.bob, bp.z + refuseZ);

    // Gaze down the corridor, rotated by yaw to look left/right and by pitch
    // to look up/down (a simple spherical aim). The active gallery always
    // dwells ~PLANE_Z ahead, so a constant forward reach keeps the gaze
    // steady through every chapter.
    const cosPitch = Math.cos(pitch);
    const lookX = camera.position.x + Math.sin(yaw) * cosPitch * PLANE_Z + pointer.x * 0.6 + coreX;
    const lookZ = camera.position.z - Math.cos(yaw) * cosPitch * PLANE_Z;
    const lookY = camera.position.y * 0.25 + Math.sin(pitch) * PLANE_Z + coreY;
    scratch.current.set(lookX, lookY, lookZ);
    // The aim eases like the body does — except on the frame the body was
    // seated, where there is nothing to ease FROM: the gaze would otherwise
    // start at the origin's straight-ahead and swing to its mark over the first
    // second, which is the same wrong-first-second the seeding exists to
    // remove. (It is also what lets __reseat stand the whole camera on its mark
    // for a capture, rather than the position alone.)
    if (seated) {
      lookAt.current.copy(scratch.current);
    } else {
      lookAt.current.lerp(scratch.current, 1 - Math.exp(-Math.min(delta, 0.1) * 3));
    }
    camera.lookAt(lookAt.current);

    // The gait's weight-shift roll: the head tips a fraction toward the planted
    // foot. lookAt has just set the orientation fresh, so this rolls on top —
    // and it scales with the smoothed sway, so it fades out with the walk.
    camera.rotateZ(-w.sway * GAIT.roll);
    // …and the footfall nod, on the camera's own X after lookAt for the same
    // reason the roll is here: lookAt has just set the orientation fresh, so
    // these ride on top of the aim instead of fighting it.
    camera.rotateX(w.nod);

    // …and corkscrew the whole camera into the spiral. lookAt has just set the
    // orientation fresh, so this rolls on top. It is deliberately NOT a lean
    // that comes back: the body turns a whole revolution as it falls, which is
    // what makes the shaft read as winding AROUND the reader rather than as a
    // tilted dolly — and a full turn lands upright on its own, so the fall can
    // end mid-roll without the camera ever being seen to right itself. The bank
    // bell rides on top so the corkscrew arrives and leaves off-square rather
    // than turning like a metronome.
    if (dive > 0.0001) {
      camera.rotateZ(-Math.PI * 2 * DIVE_TURNS * spinEase(dive) + thrust * DIVE_BANK);
    }
    // …and unwind it the other way on the climb: the same revolution given back.
    if (climb > 0.0001) {
      camera.rotateZ(Math.PI * 2 * DIVE_TURNS * spinEase(climb) + haul * -DIVE_BANK * 0.7);
    }

    // The vertigo zoom, last: the frustum opens as the body is carried, so the
    // walls streak outward past a core that barely grows. The plunge alone is
    // only seven units once the walk-in is counted against it (see plungeZ) —
    // this is what makes those seven units read as a fall rather than a lean.
    // The climb gets a shallower one; being hauled up a shaft you have already
    // fallen down should not be the same event twice.
    const gape = Math.max(thrust, haul * 0.55);
    const opened = gape > 0.0001
      ? 1 + gape * (DIVE_FOV + Math.sin(t * 0.9) * DIVE_FOV_BREATH)
      : 1;
    // …and the opening's zoom-out, which is the other half of its withdrawal:
    // the long lens gives its 16° back as the body draws away, so the room
    // opens faster than the dolly alone could open it. Multiplied against the
    // fall's own gape rather than branched with it — they never overlap today
    // (the shot is spent long before any crossing), and one product means they
    // could without either having to know about the other.
    const fovWant = FOV * opened * (1 - intro * SHOT.lens);
    if (Math.abs(camera.fov - fovWant) > 0.002) {
      camera.fov = fovWant;
      camera.updateProjectionMatrix();
    }

    // The winding (III → IV): the crossing into the stairwell that has no floor
    // takes the horizon with it. One slow roll into the spiral that is zero at
    // both rest points, so the Vertigo is arrived at upright — the tilt exists
    // only for the length of the crossing, which is the only place the reader
    // can feel it as losing their footing rather than as a crooked camera.
    const winding = crossingWeight(descentRef.current, CROSS_WIND);
    if (winding > 0.0001) {
      camera.rotateZ(winding * WIND_ROLL);
    }
  });
  return null;
}

// A gallery whose plates have not arrived yet. It draws nothing — there is
// nothing to draw — and exists only to SAY that, for the whole time it stands in
// for the room. Mount and unmount are the two edges of the wait, so the report
// is exact: no polling, and no guessing from a global loader that is also busy
// with everything the restock is quietly warming up behind the reader.
function Arriving({ index, onArriving }) {
  useEffect(() => {
    if (!onArriving) return undefined;
    onArriving(index, true);
    return () => onArriving(index, false);
  }, [index, onArriving]);
  return null;
}

export default function DioramaScene({
  scenes,
  aspect = ART_ASPECT,
  // In-slab depth-displacement strength. The macro depth lives in the slab
  // stack's Z placement (DEPTH_SPREAD); relief only curves each card around its
  // own band center, so features inside one band lean toward or away from you.
  // The old single-plane smear ceiling no longer applies — out-of-band fragments
  // are discarded, and a higher relief actually narrows the seam gap between
  // neighbouring cards — but the backdrop is still a single full-range plane,
  // so keep relief × its 0.4 reliefScale at or below ~1 (the proven smear-free
  // strength for an undiscarded heightfield).
  relief = 2.2,
  depthGamma = 1.0,
  // Overscan keeps the relief past the frame edges so panning the gaze never
  // reveals the dark border — but stays modest so each artwork's whole
  // composition (the fire door, the spiral pit, the far lamp) reads in frame.
  overscan = OVERSCAN,
  // How far the camera body translates with the pointer. This is what slides
  // the depth-sliced cards past one another when the reader moves the mouse —
  // the strongest everyday depth cue the scene has.
  parallax = { x: 1.4, y: 0.7 },
  // A phone's stand-in for the mouse: {x, y} in the same -1..1 the pointer uses,
  // fed by the device's own tilt so the cards slide as the reader leans the
  // handset. Without it a touch reader gets NO parallax at all — `pointer` never
  // leaves the origin when nothing hovers — and the strongest depth cue in the
  // piece is simply absent on half the devices it runs on. See Tour's tiltRef.
  tiltRef,
  descentRef,
  immersionRef,
  // The opening withdrawal, 1 → 0 across the establishing shot Tour runs the
  // moment the title card lets go. See SHOT and the block above it.
  introRef,
  accentRef,
  yawRef,
  pitchRef,
  // How far round the reader has turned, in bays — the part of the turn the
  // camera's own yaw could not carry. See TURN_BAYS here and YAW_SWING in Tour.
  panRef,
  diveRef,
  // 0→1 across the CLIMB back out of the garden — the dive mirrored. Kept as
  // its own ref rather than a sign on diveRef so that every place reading the
  // fall goes on reading a plain 0..1 and only the handful of places that care
  // which way the body is being carried have to know.
  climbRef,
  // Timestamp (performance.now()) of the last forward step the world refused —
  // the camera answers it with a brief lean into the sealed way.
  refuseRef,
  portalRef,
  libraryMax,
  reduced = false,
  // Called once per footfall while the camera is walking (with the gait's
  // current strength) — Tour lays a soft step sound under each one.
  onStep,
  // Where each plate reports its awakening, for the drift's pacing. See the
  // `passRef` note on Painting.
  passRef,
  // When the reader last steered the world themselves (Tour's `stir`). A woken
  // gallery reads it to know it has been walked out on — see LIVE_SETTLE.
  stirRef,
  // False until the reader clicks through the entry veil. See the note on
  // Painting's copy: nothing may wake while the overture is still up.
  enteredRef,
  // The GPU taking its context back, and (if we are lucky) handing it over
  // again. Tour covers the gap — see `glLost` there — because the canvas keeps
  // showing its last frame and then simply stops, which is indistinguishable
  // from a piece that has quietly died.
  onContextLost,
  onContextRestored,
  // Called `(index, true)` while a gallery's plates are still loading and
  // `(index, false)` the moment they land. The Suspense below renders NOTHING
  // in the meantime, which off screen is right and on screen is a lit HUD
  // wrapped around an empty black box — see Tour's `arriving` whisper.
  onArriving,
  // Each time the governor has judged a window of frames. Tour uses it for the
  // one thing a reader should ever learn from it: nothing, unless they asked.
  onQuality,
}) {
  const chapters = scenes.length;
  // The vortex is the deepest library gallery; its glow anchor is the warm
  // tunnel core the dive plunges toward (Vertigo's lower-right light).
  const coreUV = libraryMax != null ? scenes[libraryMax]?.glowAt : undefined;
  // Every gallery's lamp, in the order they hang — the opening shot turns its
  // gaze onto whichever one belongs to the room it is withdrawing out of. Held
  // apart from `scenes` so a restock (which re-hangs the art, lamp and all)
  // cannot hand the rig a stale anchor.
  const lamps = useMemo(() => scenes.map((s) => s.glowAt), [scenes]);
  // Shared, per-frame graded fog color (GradeRig writes, paintings read).
  const fogRef = useRef(new THREE.Color(scenes[0].fog));
  // When the last foot landed (performance.now()/1000). The gait owns the
  // footfalls; the paintings read them to hide a clip's replay cut under the
  // reader's own motion (see REPLAY_STEP_WINDOW).
  const stepRef = useRef(0);
  const onFootfall = useCallback((intensity) => {
    stepRef.current = performance.now() / 1000;
    if (onStep) onStep(intensity);
  }, [onStep]);
  return (
    <Canvas
      camera={{ fov: FOV, position: [0, 0, 0], near: 0.1, far: 240 }}
      // Capped below 2: the slab stack is fill-rate bound (a million displaced
      // vertices, each fragment doing relief + unsharp work), so on a high-DPI
      // screen the full 2x costs roughly twice the frame for detail the soft,
      // fogged surfaces do not show. 1.5 keeps the painting crisp — and a phone,
      // whose 3x screen is exactly where that hurts most, is capped lower again
      // (see DPR_MAX; the figures there are reasoned, not yet measured).
      // Where a walk STARTS. The ceiling is a guess made before a frame has
      // been drawn (see capability.js); <Governor> below measures what it was
      // worth and steps down from here if the frames are late.
      dpr={DPR_RANGE}
      // On a laptop with switchable graphics the default lets the browser pick
      // the integrated GPU, which cannot keep up with a million displaced
      // vertices and a video texture. Ask for the discrete one explicitly.
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      // Six slab stacks of 29k segments each, a video texture or two, and a
      // driver that may be running a game in another tab: losing the context is
      // not an exotic case here, it is the likeliest way this piece breaks on a
      // machine it was working on a minute ago. preventDefault is what makes
      // the loss RECOVERABLE — without it the browser never attempts a restore
      // and the canvas is dead for good. three rebuilds its own state and
      // re-uploads the textures on the way back; all Tour has to do is say what
      // is happening in the meantime.
      onCreated={({ gl }) => {
        const canvas = gl.domElement;
        // The diorama is a PICTURE, and to a screen reader it was an unlabelled
        // rectangle — the one element on the page carrying everything the piece
        // is. It cannot be described once and for all, because what it shows
        // changes with every gallery, so the name is fixed and the description
        // is a line Tour keeps current (see #gallery-caption there).
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'The gallery, drawn in depth');
        canvas.setAttribute('aria-describedby', 'gallery-caption');
        canvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          console.warn('[gl] the graphics context was lost — waiting for it back');
          onContextLost?.();
        });
        canvas.addEventListener('webglcontextrestored', () => {
          console.info('[gl] the graphics context came back');
          onContextRestored?.();
        });
      }}
    >
      <color attach="background" args={[scenes[0].fog]} />
      <Governor onQuality={onQuality} />
      <GradeRig scenes={scenes} descentRef={descentRef} fogRef={fogRef} />
      {scenes.map((scene, i) => (
        // One boundary per gallery. Canvas has a single Suspense of its own, so
        // without these a gallery re-hung mid-tour (Tour's restock) would drop
        // the whole corridor while its plates loaded. The restock preloads them
        // and commits in a transition, so this should never actually show —
        // it is here so that if it ever does, it costs one gallery, off screen.
        // …and one error boundary around each, for the other way a gallery can
        // fail to arrive: useTexture THROWS on a plate that 404s or will not
        // decode, and a throw with no boundary anywhere between here and the
        // root takes the entire corridor down with it. Caught here it costs the
        // one room, which goes dark and is walked through.
        <PlateBoundary key={`painting-${i}`} name={scene.color.split('/').pop()}>
          <Suspense fallback={<Arriving index={i} onArriving={onArriving} />}>
            <Painting
              color={scene.color} depth={scene.depth} video={scene.video}
              videoRate={scene.videoRate}
              index={i} chapters={chapters} aspect={aspect}
              relief={relief} depthGamma={depthGamma} overscan={overscan}
              reduced={reduced} descentRef={descentRef}
              accentRef={accentRef} fogRef={fogRef}
              diveRef={diveRef} climbRef={climbRef}
              libraryMax={libraryMax} stepRef={stepRef}
              passRef={passRef} stirRef={stirRef} panRef={panRef}
              enteredRef={enteredRef}
              // The rite belongs to the crossing that DEPARTS this chapter, and
              // the plate that dissolves across it is this one.
              rite={RITES[i] ?? RITE.PLAIN} glowAt={scene.glowAt}
            />
          </Suspense>
        </PlateBoundary>
      ))}
      {scenes.map((scene, i) => (
        <Glow
          key={`glow-${i}`}
          scene={scene} index={i} aspect={aspect} overscan={overscan}
          accentRef={accentRef} descentRef={descentRef} reduced={reduced}
          panRef={panRef}
          portalRef={portalRef} libraryMax={libraryMax}
          diveRef={diveRef} climbRef={climbRef}
        />
      ))}
      <PortalRings accentRef={accentRef} descentRef={descentRef} chapters={chapters} />
      <AtmosphereRig descentRef={descentRef} immersionRef={immersionRef} introRef={introRef}>
        <Fog depth={PLANE_Z + 3} y={-0.58} opacity={0.14} scale={1.5} aspect={aspect} index={0} descentRef={descentRef} />
        <Fog depth={PLANE_Z - 6} y={-0.62} opacity={0.20} scale={1.2} aspect={aspect} index={1} descentRef={descentRef} />
        <LightShafts aspect={aspect} accentRef={accentRef} reduced={reduced} />
        <Motes aspect={aspect} reduced={reduced} descentRef={descentRef} />
      </AtmosphereRig>
      <DescentRig
        descentRef={descentRef} immersionRef={immersionRef} yawRef={yawRef}
        introRef={introRef} lamps={lamps}
        pitchRef={pitchRef} diveRef={diveRef} climbRef={climbRef}
        refuseRef={refuseRef}
        coreUV={coreUV} aspect={aspect}
        portalRef={portalRef} libraryMax={libraryMax}
        parallax={parallax} reduced={reduced} onStep={onFootfall}
        tiltRef={tiltRef}
      />
      {/* Last, and outside every boundary above: the finish is applied to
          whatever the corridor managed to draw. A gallery that failed to load
          its plate still gets the same grain and vignette as its neighbours, so
          a dark room reads as a dark room rather than as a hole in the film. */}
      <Finish reduced={reduced} />
    </Canvas>
  );
}
