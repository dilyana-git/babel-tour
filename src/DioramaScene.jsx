// TODO(beauty-13): postprocessing — EffectComposer with Noise (film grain ~0.05,
// hides banding in the dark gradients), Vignette (offset ~0.3, darkness ~0.65),
// Bloom (high threshold so only the lamp cores bloom).
// TODO(beauty-14): DONE for the gl hint — powerPreference is 'high-performance',
// dpr capped at 1.5 and anisotropy at 8 (see each for why). Still open: drop
// plane segments on coarse-pointer devices; SEG_X/SEG_Y are still 240/120 for
// every device, which is the largest remaining per-frame cost.
import { useRef, useMemo, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { RITE, RITES, crossingWeight } from './rites';

const FOV = 55;
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
const STRIDE_LENGTH = 2.8;   // world units per full stride (two footfalls) — at
                             // the walk-in's steady ~2.2 u/s this lands ~1.6
                             // footfalls/s, an unhurried but clearly stepped pace
const GAIT_SPEED_CAP = 3.2;  // clamp so a fast step-in can't quicken into a jog
const WALK_REF_SPEED = 1.6;  // forward speed at which the gait reaches full swing
// Amplitudes, halved from the first pass ("I see too much shake"). The rhythm
// is what carries the walk; the SIZE of it only has to be felt, and past a
// point every unit of extra swing reads as an unsteady camera rather than a
// steady body. The roll came down hardest: rotation is read far more sharply
// than translation, so a head-tilt that measures a fifth of a degree still
// registers as the horizon rocking. `cusp` shapes the dip — higher is rounder
// and briefer at the bottom, so weight lands softly instead of ticking.
// Mutable so the dev hook below can dial them live; treat as constants.
const GAIT = {
  bob: 0.05,   // vertical dip into each footfall
  sway: 0.026, // side-to-side weight shift, once per stride
  roll: 0.022, // camera roll per unit of sway — the head tips with the weight
  cusp: 1.7,   // exponent rounding the bottom of each dip
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
const SEG_X = 240;
const SEG_Y = 120;

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
// The woken spiral's DRAW — live from the moment the door opens (the "spiral
// has woken" whisper) until the dive takes over. Instead of walking straight
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
const diveThrust = (p) =>
  Math.sin(Math.pow(Math.min(Math.max(p, 0), 1), 2.0) * Math.PI);
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
// of the winding. ~7°, and negative for the same reason DIVE_BANK is: the
// spirals in this batch of plates all wind to the right.
const WIND_ROLL = -0.125;
// Per-rite character for the ring of light hanging in each gap (PortalRings).
// `glow` scales what it gives off, `spin` how fast it turns.
const RITE_RING = {
  [RITE.ECHO]: { glow: 1.0, spin: 0.08 },
  [RITE.HUSH]: { glow: 0.0, spin: 0.02 }, // nothing lights the way into the Silence
  [RITE.WIND]: { glow: 0.95, spin: 0.85 }, // the gate itself is turning
  [RITE.PLUNGE]: { glow: 1.15, spin: 0.2 },
  [RITE.SPLIT]: { glow: 0.85, spin: 0.05 },
  [RITE.FLOOD]: { glow: 0.7, spin: 0.03 },
  [RITE.WEAVE]: { glow: 0.6, spin: 0.45 },
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
// Feather (in depth units) blended across each band edge, so neighbouring slabs
// cross-fade into one another instead of showing a hard cutout seam.
const LAYER_FEATHER = 0.07;
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
// Anisotropic filtering for the painting/video surfaces. Slabs are viewed at a
// grazing angle as the camera walks past and into them; without this the
// stretched samples smear. Three clamps this to the GPU's max at upload, so we
// request a value and let it settle to whatever the card offers.
//
// 8 rather than the common ceiling of 16: every one of these surfaces is a
// large texture sampled per fragment, so the taps are a real cost across the
// whole stack, and the difference between 8x and 16x only shows at the most
// extreme grazing angles — which the margin fog-dissolve is already softening.
const TEX_ANISOTROPY = 8;
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
// Exposure on the live surface, applied last (1 = off, >1 darker). The i2v
// clips read consistently LIGHTER than the stills they animate — measured on
// 01-moonlit-labyrinth-var0, the painting means (33,74,75) while its clips
// come back at or above that and clip0 reaches (49,94,96) — so a gallery used
// to brighten as it woke, which reads backwards for night scenes. Gamma, not a
// multiply: it sinks the ambient without touching the lanterns near white.
// Tune live with __grade({ gamma }) in a dev build.
//
// Confirmed by eye with __grade({ live }): the clip really does render brighter
// than the painting it animates, even with saturation/contrast off and even
// though the two files measure nearly identically as flat images. So the woken
// surface needs pulling down to sit in the same night as the still.
//
// A first attempt at 1.3 looked WORSE — but that version applied the curve
// after the unsharp mask, which left the halos at full amplitude over a
// darkened image and etched every edge. It now runs before the mask (see the
// fragment shader), so the two scale together. Turning the mask off instead is
// not the answer either: at sharpen 0 the surface goes to mush, which is the
// worst of the options tried.
//
// 1.37 was the user's own value, dialled by eye on real hardware with
// __grade({ gamma }) — headless cannot judge this (swiftshader never finishes
// the reveal, so the still renders near-black and every comparison is poisoned).
//
// 1.31 is that same judgement, carried onto a different batch rather than
// re-made. 1.37 was dialled while every clip came from /video-2x, and the
// x4plus files that replaced them are measurably DARKER: across all 32 clips
// that changed, median linear luminance falls by enough that preserving what
// was on screen needs an exponent of 1.291-1.356 (median 1.314). Leaving 1.37
// in place silently darkened the woken surface everywhere — small per clip,
// but it applies to every gallery at once and it compounds with a batch that
// already crushes its own shadows. Re-dial by eye if it still sits wrong; what
// must not happen is a change of batch quietly moving an exposure nobody
// re-checked.
const VIDEO_GAMMA = 1.31;
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
  varying vec2 vUv;
  varying float vDepth;
  varying float vFog;
  varying float vMargin;      // signed reach into the extension: negative inside
                              // the artwork, 0 at its edge, 1 at the card rim
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
    vUv = (uv - 0.5) * uUvSpan + 0.5 - vec2(0.0, uEyeShift);
    vec2 extS = (abs(vUv - 0.5) - 0.5) / max(0.5 * (uUvSpan - 1.0), vec2(1e-4));
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
    p.z += ((d - uBandCenter) * liveRelief * breath + ripple * liveRelief)
         * (1.0 - smoothstep(0.0, 0.3, vMargin));
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
  uniform vec2 uTexel;      // 1/imageSize, for the unsharp mask taps
  uniform float uSharpen;   // high-pass strength on the still surface
  uniform vec2 uVideoTexel; // 1/videoSize — ~3.6x coarser than uTexel
  uniform float uSharpenVideo; // high-pass strength on the live surface
  uniform float uVideoSat;     // chroma grade on the live surface (1 = off)
  uniform float uVideoContrast;// mid-grey contrast on the live surface (1 = off)
  uniform float uVideoGamma;   // exposure on the live surface (1 = off, >1 darker)
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

  // A secondary tap of the gallery's SURFACE — the still, or the clip if one is
  // awake — for the two rites that draw the room more than once. Deliberately
  // unsharpened and ungraded past the exposure: these are ghosts of the room,
  // and the unsharp masks are tuned for the one true copy (see TEX_SHARPEN).
  vec3 surfaceAt(vec2 uv, float bias) {
    vec3 s = texture2D(map, uv, bias).rgb;
    // Same gate as the main surface: the backdrop holds the still (see the note
    // in main), so its ghosts read the still too. The bias these ghosts
    // recede on now reaches the clip as well — mapVideo carries a mip chain
    // (see the VideoTexture setup), without which the +0.4 / +0.8 the echo
    // passes here were silently dropped and all three copies came back equally
    // sharp, which reads as bad registration rather than as a recession.
    float live = uLive * (1.0 - uBackdrop);
    if (live > 0.001) {
      s = mix(s, pow(texture2D(mapVideo, uv, bias).rgb, vec3(uVideoGamma)), live);
    }
    return s;
  }

  // Cheap per-strand randomness for the weave. Two decorrelated draws from one
  // strand index: which way the thread drifts, and when it lets go.
  float threadHash(float i, float salt) {
    return fract(sin(i * 12.9898 + salt) * 43758.5453);
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
    // card in the stack, and only two of the eight thresholds ever read it.
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

    // ── The rite, part one: where this fragment reads its picture from ──────
    // Only the two rites that MOVE the image touch the sample coordinate; the
    // rest read the plate square-on as always. Everything downstream — the
    // depth sample, the band window, the relief pulse — follows the moved
    // coordinate, so a thread carries its own silhouette away with it.
    vec2 sUv = vUv;
    float below = -9.0;   // FLOOD: how far under the rising water this fragment lies
    float thread = 0.0;   // WEAVE: when this strand lets go
    float threadEdge = 0.0;
    float part = 0.0;     // SPLIT: how far each half has drawn back from the tear
    if (rite == RITE_SPLIT) {
      // The room parts down its middle and the two halves draw away from each
      // other, so the way ahead opens between them rather than melting: at the
      // Fork the arriving plate IS an avenue running off down the centre, and
      // this hands it to the reader through a widening gap.
      part = 0.42 * smoothstep(0.0, 0.95, rp);
      sUv.x += vUv.x < 0.5 ? -part : part;
    } else if (rite == RITE_FLOOD) {
      // The water climbs the plate. Margin fragments ride LOWER than they are
      // drawn (the e term sinks them), so the periphery goes under first and
      // the painting itself is the last thing the water takes — and that sink
      // eases in with the crossing, or the whole lower margin would drop out
      // in the first instant.
      float line = -0.15 + rp * 1.45;
      below = line - (vUv.y - e * 1.9 * smoothstep(0.0, 0.25, rp));
      if (below > 0.0) {
        float rip = sin(below * 34.0 - uTime * 1.7) * 0.007
                  * smoothstep(0.0, 0.05, below);
        // Mirrored about the surface: what stood above the line lies under it.
        sUv = vec2(vUv.x + rip, 2.0 * line - vUv.y + rip * 0.5);
      }
    } else if (rite == RITE_WEAVE) {
      // The picture comes apart into threads. The strand coordinate is warped
      // before it is quantised, so the filaments wander down the frame instead
      // of ruling it into bars.
      // 40 strands, not 26: across the visible frame that is the difference
      // between threads and planks. The slide is under half an image height,
      // which keeps each thread's content recognisable as it goes out of true.
      float wob = vUv.x + 0.035 * sin(vUv.y * 5.2 + 1.3);
      float sIdx = floor(wob * 40.0);
      float drift = threadHash(sIdx, 0.0);
      float when = threadHash(sIdx, 3.7);
      sUv.y += (drift - 0.5) * 0.42 * rp;   // each thread slides its own way
      sUv.x += (when - 0.5) * 0.05 * rp;    // and the weave fans apart
      // When this thread lets go. Spread across the middle of the crossing
      // rather than starting at once: the first pass had threads dropping from
      // rp 0.06 and the whole weave was gone by a third of the way over, which
      // read as the picture being deleted rather than coming undone.
      thread = 0.20 + when * 0.42 + e * 0.14;
      float f = fract(wob * 40.0);
      threadEdge = (1.0 - smoothstep(0.0, 0.16, f))
                 + (1.0 - smoothstep(0.0, 0.16, 1.0 - f));
    }

    // Sample depth per fragment for every visibility decision. vDepth is
    // sampled at the much coarser mesh vertices and interpolated across each
    // triangle; on hairline depth cliffs such as the hanging chains, one white
    // vertex used to spread the foreground slab across the whole triangle and
    // expose it as a broad grey polygon. The direct sample keeps the slab cutout
    // registered to the artwork's actual pixel silhouette.
    float fragmentDepth = pow(texture2D(depthMap, sUv).r, depthGamma);
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
    float blurBias = smoothstep(-0.08, 0.4, vMargin) * 5.0 + uBackdrop * 3.5;
    // Every sample below reads sUv, which is vUv except where a rite has moved
    // this fragment's picture (the flood's reflection, the weave's threads).
    vec4 tex = texture2D(map, sUv, blurBias);
    // Unsharp mask: subtract a 4-tap neighbourhood blur to restore the crisp
    // edges that overscan + trilinear filtering softened. Only on the still —
    // scaled to zero as the (soft, low-res) video takes over so it never
    // crunches, and held off the defocused margins entirely.
    float sharpen = uSharpen * (1.0 - clamp(uLive, 0.0, 1.0))
                  * (1.0 - smoothstep(-0.08, 0.0, vMargin))
                  * (1.0 - uBackdrop);
    if (sharpen > 0.001) {
      vec3 blur = texture2D(map, sUv + vec2(uTexel.x, 0.0)).rgb
                + texture2D(map, sUv - vec2(uTexel.x, 0.0)).rgb
                + texture2D(map, sUv + vec2(0.0, uTexel.y)).rgb
                + texture2D(map, sUv - vec2(0.0, uTexel.y)).rgb;
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
      vec4 vid = texture2D(mapVideo, sUv, blurBias);
      // Exposure FIRST, before the unsharp — this ordering matters. Darkening
      // after the high-pass leaves the mask's overshoot at full amplitude on a
      // darkened image, so the halos gain contrast against their surroundings
      // and the surface reads as hard white etching along every balustrade and
      // chain (which is exactly how the first attempt at this failed). Applied
      // to the sample, the halos are computed from already-darkened values and
      // scale down with everything else.
      vid.rgb = pow(vid.rgb, vec3(uVideoGamma));
      // The live surface gets its OWN unsharp mask, tapped at the video's texel
      // spacing. The clip is a ~944-wide render magnified across a 3376-wide
      // plate, so what softens it is pure resampling blur — a high-pass at the
      // right scale is the only thing that touches it. Same margin/backdrop
      // gates as the still's mask: never ring into the mirrored extension, and
      // never re-introduce high frequencies on the hole-filling backdrop.
      float liveSharpen = uSharpenVideo
                        * (1.0 - smoothstep(-0.08, 0.0, vMargin))
                        * (1.0 - uBackdrop);
      if (liveSharpen > 0.001) {
        vec3 liveBlur = texture2D(mapVideo, sUv + vec2(uVideoTexel.x, 0.0)).rgb
                      + texture2D(mapVideo, sUv - vec2(uVideoTexel.x, 0.0)).rgb
                      + texture2D(mapVideo, sUv + vec2(0.0, uVideoTexel.y)).rgb
                      + texture2D(mapVideo, sUv - vec2(0.0, uVideoTexel.y)).rgb;
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

    // ── The rite, part two: what the room LOOKS like as it goes ─────────────
    // Colour work only, laid over the finished surface (still or clip) and
    // before the distance fog, so a room that is halfway down the corridor
    // still sinks into the dark the same way it always did. The extra taps
    // here are inside a uniform branch that is only ever taken by the ONE
    // plate a crossing is dissolving, so the cost never lands on the stack
    // as a whole.
    if (rite == RITE_ECHO) {
      // Tautology: the passage insists it has been walked before. The room is
      // superimposed on ITSELF, twice, each copy smaller and dimmer and
      // receding toward the same lamp — a gallery reflected down a corridor of
      // its own copies. Two things earn their keep here:
      //   • they converge on the plate's LIGHT, not on the middle of the frame,
      //     so the recession runs along the room's own perspective;
      //   • they arrive in BEATS rather than sitting there. A constant overlay
      //     of a 90%-scale copy is not read as a repetition at all, only as a
      //     softness over the plate — which is what the first pass at this
      //     looked like. Pulsed, and clearly smaller, they read as the room
      //     saying itself again.
      // The scale factors are ABOVE one on purpose: sampling a wider range of
      // the image across the same card draws it SMALLER. (Below one magnifies,
      // which is the opposite of a copy receding, and looked like a badly
      // focused zoom.) 1.4 and 2.0 put the two copies a room and two rooms
      // further off.
      float beat1 = sin(clamp((rp - 0.05) / 0.55, 0.0, 1.0) * 3.14159);
      float beat2 = sin(clamp((rp - 0.32) / 0.55, 0.0, 1.0) * 3.14159);
      vec3 once = surfaceAt((vUv - uGlowUV) * 1.40 + uGlowUV, blurBias + 0.4) * 0.88;
      vec3 twice = surfaceAt((vUv - uGlowUV) * 2.00 + uGlowUV, blurBias + 0.8) * 0.76;
      float back = 1.0 - uBackdrop;
      tex.rgb = mix(tex.rgb, once, 0.30 * beat1 * back);
      tex.rgb = mix(tex.rgb, twice, 0.20 * beat2 * back);
    } else if (rite == RITE_SPLIT) {
      // Two futures. The picture has already been TORN down its middle in part
      // one and drawn back to either side; here each half is graded away from
      // the other — one keeping the library's lamplight, one cooled toward the
      // moon it is walking into — and each carries a faint ghost of the
      // content the other half took with it, so what you are looking at is the
      // path you chose with the one you didn't still showing through it.
      //
      // This began as two whole copies of the room superimposed and diverging.
      // It did not read as a fork: two offset copies of one image are read as
      // BLUR — bad registration, a shaken camera — and never as two of
      // anything. A tear cannot be misread.
      float part = smoothstep(0.02, 0.3, rp) * (1.0 - uBackdrop);
      vec3 other = surfaceAt(vUv - (sUv - vUv), blurBias + 0.8);
      tex.rgb = mix(tex.rgb, other, 0.2 * part);
      tex.rgb *= mix(vec3(1.0), vUv.x < 0.5 ? vec3(1.07, 1.0, 0.93)
                                            : vec3(0.93, 1.0, 1.08), part);
    } else if (rite == RITE_FLOOD && below > 0.0) {
      // Under the surface: the reflection loses its light with depth and takes
      // the corridor's own colour, so the water reads as water and not as an
      // upside-down copy of the room hanging in the air.
      float deep = smoothstep(0.0, 0.5, below);
      tex.rgb = mix(tex.rgb, uFogColor, deep * 0.62) * (1.0 - 0.55 * deep);
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
    // the melt line catches the chapter accent, an ember edge on the stone.
    // The extension margins melt AHEAD of the artwork (the periphery burns off
    // first, narrowing the world to the true spiral before it gives way), and
    // the ember rim stays off them — mid-melt margin content is viewed at
    // grazing angles where the rim traces ugly blocky contours.
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
    // So a rite does not get its own threshold. It gets to BEND this one:
    //   • the bias sends the front ahead of itself for some fragments — with
    //     radius, and the room collapses toward its lamp; with a whirling
    //     radius, and it drains down its own throat;
    //   • the rate slows the whole front where a rite needs the plate to stand
    //     long enough for something else to happen to it;
    // and then a rite may take MORE away on top (the water, the tear, the
    // threads) — never less.
    float rate = 1.72;
    float bias = 0.0;
    float whirl = 0.0;
    if (rite == RITE_HUSH) {
      bias = reach * 1.55;
    } else if (rite == RITE_WIND) {
      // A rotating vane rather than a ring: the front runs ahead of itself in
      // a spiral arm that turns as it closes. It unwinds at the end so the
      // last of the plate still clears on the melt's own schedule.
      whirl = 0.30 * sin(atan(gd.y, gd.x) + length(gd) * 5.5 - rp * 7.5)
            * (1.0 - smoothstep(0.62, 0.96, rp));
      bias = (reach + whirl) * 1.55;
    } else if (rite == RITE_SPLIT || rite == RITE_FLOOD) {
      // Both of these need the room to stand while something is done to it —
      // parted, or drowned — so their sweep runs well behind the plain one.
      rate = 1.20;
    }
    float th = 1.12 - rp * (rate + e * 4.0 + bias);
    float alpha = 1.0 - smoothstep(th - 0.10, th + 0.10, fragmentDepth);
    float rim = smoothstep(th - 0.14, th - 0.03, fragmentDepth)
              * (1.0 - smoothstep(th - 0.03, th + 0.08, fragmentDepth));
    // How much ember this threshold is allowed. Most rites keep the melt's own
    // 0.3; the Silence is given none, and the waterline is given more, being a
    // single thin seam rather than a broad front.
    float rimGain = 0.3;

    if (rite == RITE_ECHO) {
      // What has melted does not quite go. A fainter copy of the stone lingers
      // a beat behind the front, and the ember arrives three times, each wave
      // weaker — the room answering itself down a corridor of its own copies.
      float g1 = th + 0.34;
      float g2 = th + 0.62;
      alpha = max(alpha,
        (1.0 - smoothstep(g1 - 0.10, g1 + 0.10, fragmentDepth)) * 0.24 * env);
      rim += 0.5 * smoothstep(g1 - 0.12, g1 - 0.02, fragmentDepth)
                 * (1.0 - smoothstep(g1 - 0.02, g1 + 0.07, fragmentDepth))
           + 0.25 * smoothstep(g2 - 0.12, g2 - 0.02, fragmentDepth)
                  * (1.0 - smoothstep(g2 - 0.02, g2 + 0.07, fragmentDepth));
    } else if (rite == RITE_HUSH) {
      // An extinguishing rather than an announcement. The radial bias above
      // has already turned the sweep inside-out — it runs fastest where the
      // room is darkest and slowest at the lamp, so the last thing standing
      // is the light itself — and this rite's real work is the draining of
      // the colour in part two. All it asks for here is silence.
      rimGain = 0.0; // nothing announces itself on the way into the Silence
    } else if (rite == RITE_WIND) {
      // The whirling bias is applied above; here the ember simply rides the
      // vane, which is what makes the turn legible — a rotating arm of light
      // closing on the pit.
      rimGain = 0.34;
    } else if (rite == RITE_SPLIT) {
      // The tear: a gap down the middle that the two halves draw back from,
      // opening until they are all but off the sides. It takes MORE than the
      // melt behind it, never less — the halves both part and go.
      float fromTear = abs(vUv.x - 0.5);
      alpha *= smoothstep(part * 0.9, part * 1.04 + 0.0015, fromTear);
      // The ember catches along both parting edges — which is exactly where
      // the light of the room ahead is arriving from.
      rim = max(rim, (1.0 - smoothstep(part, part * 1.35 + 0.03, fromTear))
                   * step(part * 0.95, fromTear));
      rimGain = 0.42;
      // …and the opening itself is LIT. Left transparent, the tear was a black
      // slot in the middle of the frame: the room it opens onto is still a
      // chapter away, deep in the corridor's fog, and has nothing to put there
      // yet. So the crack pours the garden's own green through it — brightest
      // while it is still a crack, spent by the time it has opened wide enough
      // to be a view. Only the BACKDROP card carries it: the six cards of a
      // stack tear at the same UV but at six different screen positions, and
      // six stacked glows would read as banding rather than as light.
      if (uBackdrop > 0.5) {
        float spill = (1.0 - smoothstep(part * 0.7, part * 1.05, fromTear))
                    * env * (1.0 - smoothstep(0.16, 0.42, part));
        tex.rgb = mix(tex.rgb, uAccent, spill * 0.85);
        alpha = max(alpha, spill * 0.7);
      }
    } else if (rite == RITE_FLOOD) {
      // The water takes what it passes, and the ember becomes the surface
      // itself: one bright seam where the world is being cut in half. The
      // alpha reaches further down than the reflection's own dimming does, so
      // there is a real band of water to see rather than a lit line over black.
      alpha = min(alpha, 1.0 - smoothstep(0.06, 0.62, below));
      rim = max(rim * 0.5, exp(-abs(below) * 70.0));
      rimGain = 0.5;
    } else if (rite == RITE_WEAVE) {
      // Thread by thread, in no particular order, each in its own time — and
      // each one LIT along its length, brightest in the moment it lets go.
      // Without that the unravelling was dark threads over a dark room (the
      // web this is opening onto is still a chapter away and has nothing to
      // show through the gaps yet); with it, the picture comes apart into
      // filaments of light, which is what the arriving room is about.
      alpha *= 1.0 - smoothstep(thread, thread + 0.30, rp);
      float letting = smoothstep(thread - 0.26, thread - 0.04, rp)
                    * (1.0 - smoothstep(thread - 0.04, thread + 0.22, rp));
      rim = max(rim, threadEdge * (0.3 + 1.1 * letting)
                   * smoothstep(0.04, 0.22, rp));
      rimGain = 0.4;
    }
    // No rite may lurch: whatever it takes on top of the melt, at rest the
    // plate is whole. (The flood's waterline in particular starts under the
    // card's bottom margin, which would otherwise drop out on the first frame
    // of the crossing.) Held to the rites alone: the plain melt's own
    // behaviour at rest — where the very nearest fragments already sit a
    // little under 1 — is long since tuned around, and is not this change's
    // business to alter.
    if (rite != RITE_PLAIN) {
      alpha = mix(1.0, alpha, smoothstep(0.0, 0.05, rp));
    }
    tex.rgb += uAccent * rim * rimGain * env * (1.0 - smoothstep(0.05, 0.3, e));

    // Arrival gate. The plate's FAR architecture is always allowed (it is the
    // room seen down the corridor), but its NEAR foreground only fades in as
    // the camera actually crosses into this chapter (uReveal 0→1 across the
    // previous crossing). Without this, the dive's deep plunge outruns the
    // distance fog and the next room's foreground pops out as raw unlit
    // fragments while the current room is still melting.
    alpha *= mix(1.0, uReveal, smoothstep(0.45, 0.75, fragmentDepth));

    // Depth-band window: keep only this slab's slice of the image, feathered so
    // it dissolves into its neighbours rather than cutting a hard silhouette.
    float win = smoothstep(uBandLo - uFeather, uBandLo + uFeather, fragmentDepth)
              * (1.0 - smoothstep(uBandHi - uFeather, uBandHi + uFeather, fragmentDepth));

    // The extension margins carry the painting's wrap-around continuation (the
    // next bay of the endless gallery): clear near the artwork, then a LONG
    // sink all the way to EXACTLY the fog color — fully converged before the
    // rim's alpha fade even begins. This is what makes an edge impossible in
    // principle: every card's margin (near slab, mid slabs, backdrop — all
    // overlapping at different screen scales) arrives at the same color as the
    // graded canvas background, so their rims and overlaps blend over equal
    // color and nothing can read as a boundary or a band.
    tex.rgb = mix(tex.rgb, uFogColor, smoothstep(0.12, 0.7, e));
    float rimFade = 1.0 - smoothstep(0.8, 1.0, e);

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
  // The rite this plate's own threshold is given (RITES[index]), and the point
  // in the artwork two of them collapse the room into — the plate's light.
  rite = RITE.PLAIN, glowAt,
}) {
  const mesh = useRef();
  // el: the <video>; tex: its VideoTexture; playing: true while it is running
  // through a pass; ended: true once a pass finished (the surface keeps holding
  // its last frame — it settles back to the still only after the camera has
  // left); endedAt: when that pass finished, which paces the replay rest;
  // armed: whether a new arrival is allowed to trigger the first play (re-armed
  // each time the camera leaves).
  const live = useRef({
    el: null, tex: null, playing: false, ended: false, endedAt: 0, armed: true,
  });
  const [colorMap, depthMap] = useTexture([color, depth], (texes) => {
    texes[0].colorSpace = THREE.SRGBColorSpace;
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

  const materials = useMemo(() => layers.map((L) => new THREE.ShaderMaterial({
    uniforms: {
      map: { value: colorMap },
      uTexel: { value: texel },
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
      uLive: { value: 0 },
      depthMap: { value: depthMap },
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
      uBandLo: { value: L.lo },
      uBandHi: { value: L.hi },
      uFeather: { value: LAYER_FEATHER },
      uBackdrop: { value: L.backdrop ? 1 : 0 },
      uUvSpan: { value: new THREE.Vector2(EXTEND_X, EXTEND_Y) },
      // Divided by this card's own scale-up: the backdrop draws the image 1.5×
      // larger than the foreground cards, so an equal UV shift would slide it
      // 1.5× further on screen and break the registration the stack depends on.
      // Divided, every layer's picture rises by the same ANGLE.
      uEyeShift: { value: EYE_DROP / L.over },
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
  })), [layers, colorMap, depthMap, relief, depthGamma, reduced, texel, rite, glowAt, aspect]);

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
  }, [color, depth, colorMap, depthMap]);
  useEffect(() => () => {
    geos.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }, [geos, materials]);

  useFrame(({ clock }, delta) => {
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
    for (const m of materials) {
      m.uniforms.uTime.value = t;
      m.uniforms.uFade.value = fade;
      m.uniforms.uReveal.value = reveal;
      m.uniforms.uGhost.value = ghost;
      m.uniforms.uAccent.value.copy(accentRef.current);
      m.uniforms.uFogColor.value.copy(fogRef.current);
    }
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
        });
        document.body.appendChild(el);
        state.el = el;
      }
      if (state.el) {
        // On arrival, play the clip once. `armed` gates it to a single pass
        // per visit; leaving re-arms it so a return replays the awakening.
        if (state.armed && !state.playing && !state.ended && dist < 0.9) {
          state.armed = false;
          state.playing = true;
          state.el.currentTime = 0;
          state.el.playbackRate = videoRate; // reassert (load can reset it)
          const p = state.el.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => { state.playing = false; });
          }
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
          state.el.pause();
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
        }
        if (state.el && !state.tex
            && state.el.readyState >= state.el.HAVE_CURRENT_DATA) {
          state.tex = new THREE.VideoTexture(state.el);
          state.tex.colorSpace = THREE.SRGBColorSpace;
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
          // hole-filling backdrop, the defocused extension margins, and the
          // receding copies the echo and split rites draw through surfaceAt), so
          // all three came back at full sharpness the moment a clip woke, while
          // their still counterparts blurred correctly — the doubling was on the
          // moving surface only, which is why it read as a clip problem.
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
      // painting only once you have LEFT. In between, whether the clip is
      // running or resting between passes (REPLAY_REST), the surface is the
      // clip's — which is what lets a pass restart as a cut with nothing
      // dissolving.
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
      const step = Math.min(delta * 0.7, 1);
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
function Glow({ scene, index, aspect, overscan, accentRef, descentRef, portalRef, libraryMax, diveRef, climbRef, reduced }) {
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
  const restX = (u - 0.5) * w;
  // + EYE_DROP: glowAt names a point in the ARTWORK, and the artwork now rides
  // that much higher on its card, so the glow has to travel with the lamp it
  // belongs to or it detaches and floats below it.
  const restY = (0.5 - v + EYE_DROP) * h;
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
    const px = reduced ? restX : restX + pointer.x * w * 0.12;
    const py = reduced ? restY : restY + pointer.y * h * 0.12;
    ref.current.position.x += (px - ref.current.position.x) * 0.05;
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
          ref.current.material.opacity + surge * 0.18 * proximity,
        );
        s *= 1 + surge * 0.5;
        ref.current.material.color.lerp(WARM_CORE, 0.12);
      }
    }
    ref.current.scale.set(base * s, base * s, 1);
  });
  return (
    <sprite
      ref={ref}
      position={[restX, restY, planeZ(index) + 2]}
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
function AtmosphereRig({ descentRef, immersionRef, children }) {
  const group = useRef();
  useFrame(() => {
    group.current.position.z = camZImmersed(descentRef.current, immersionRef ? immersionRef.current : 0);
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
      const mip = new Set();
      scene.traverse((obj) => {
        const t = obj.material?.uniforms?.mapVideo?.value;
        if (!t) return;
        mip.add(t.generateMipmaps && t.minFilter !== THREE.LinearFilter
          && t.minFilter !== THREE.NearestFilter
          ? `mip (minFilter ${t.minFilter})` : 'NO MIP CHAIN — blurBias ignored');
      });
      seen.videoMip = mip.size === 0 ? 'no clip awake' : [...mip];
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
    return () => { delete window.__grade; delete window.__eye; delete window.__rites; };
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
function DescentRig({ descentRef, immersionRef, yawRef, pitchRef, diveRef, climbRef, refuseRef, coreUV, portalRef, libraryMax, aspect, parallax, reduced, onStep }) {
  const { camera, pointer } = useThree();
  const lookAt = useRef(new THREE.Vector3(0, 0, -PLANE_Z));
  const scratch = useRef(new THREE.Vector3());
  // The camera's eased base position; the gait offsets ride on top of it each
  // frame (they must not feed back into the ease, or they'd accumulate).
  const basePos = useRef(new THREE.Vector3(0, 0, 0));
  // The gait's running state: distance-paced phase, swing strength, smoothed
  // bob/sway offsets, the last footfall index (for the step sounds), and the
  // eased spiral draw.
  const walk = useRef({ prevZ: null, phase: 0, intensity: 0, bob: 0, sway: 0, lastStep: 0, draw: 0 });
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
    return () => { delete window.__gait; };
  }, []);
  useFrame(({ clock }, delta) => {
    const immersion = immersionRef ? immersionRef.current : 0;
    const z = camZImmersed(descentRef.current, immersion);
    const yaw = yawRef ? yawRef.current : 0;
    const pitch = pitchRef ? pitchRef.current : 0;

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
    const speed = borne > 0.001 ? 0 : travelled / Math.max(delta, 1e-4);
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
    // A fast follower — enough smoothing to round any residual edge without
    // flattening the ~2 Hz step rhythm the way the main position ease would.
    const gaitEase = 1 - Math.exp(-dt * 14);
    w.bob += (bobTarget - w.bob) * gaitEase;
    w.sway += (swayTarget - w.sway) * gaitEase;
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
    // at rest, not something adrift on water. Yields to the gait while walking.
    const calm = 1 - immersion * 0.6;
    const idle = (1 - gI * 0.7) * calm;
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
      plungeZ = DIVE_PLUNGE * thrust;
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

    const targetX = pointer.x * parallax.x + swayX + leanX;
    // No term here scales with immersion: moving in changes z and nothing else,
    // so the eye holds its level from the gallery mouth to the deepest stand.
    // (The footfall bob is added after the ease, below — that is a stride, not
    // a change of vantage.)
    const targetY = pointer.y * parallax.y + swayY + leanY;
    const targetZ = z - plungeZ;

    // Very soft easing of the BASE position — the body glides, it never snaps.
    // Wall-clock based so the glide is identical on every refresh rate. During
    // the dive the plunge is baked into the target, so this same ease lends the
    // fall a little inertia — the body lags the target, then is hauled in.
    // The gait offsets are added on top AFTER the ease (from their own fast
    // follower above): step rhythm survives, and it can't feed back into the
    // ease and accumulate.
    const ease = 1 - Math.exp(-dt * 1.2);
    const bp = basePos.current;
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
    lookAt.current.lerp(scratch.current, 1 - Math.exp(-Math.min(delta, 0.1) * 3));
    camera.lookAt(lookAt.current);

    // The gait's weight-shift roll: the head tips a fraction toward the planted
    // foot. lookAt has just set the orientation fresh, so this rolls on top —
    // and it scales with the smoothed sway, so it fades out with the walk.
    camera.rotateZ(-w.sway * GAIT.roll);

    // …and corkscrew the whole camera into the spiral, hardest where the plunge
    // is fastest. lookAt has just set the orientation fresh, so this rolls on top;
    // sharing the fall-shape means the roll accelerates with the dive and unwinds
    // to upright by the time the garden is reached (under cover of the warm flash).
    if (thrust > 0.0001) {
      camera.rotateZ(thrust * DIVE_BANK);
    }
    // …and unwind it the other way, more gently, on the way back up.
    if (haul > 0.0001) {
      camera.rotateZ(haul * -DIVE_BANK * 0.7);
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

export default function DioramaScene({
  scenes,
  aspect = 3376 / 1440,
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
  descentRef,
  immersionRef,
  accentRef,
  yawRef,
  pitchRef,
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
}) {
  const chapters = scenes.length;
  // The vortex is the deepest library gallery; its glow anchor is the warm
  // tunnel core the dive plunges toward (Vertigo's lower-right light).
  const coreUV = libraryMax != null ? scenes[libraryMax]?.glowAt : undefined;
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
      // fogged surfaces do not show. 1.5 keeps the painting crisp.
      dpr={[1, 1.5]}
      // On a laptop with switchable graphics the default lets the browser pick
      // the integrated GPU, which cannot keep up with a million displaced
      // vertices and a video texture. Ask for the discrete one explicitly.
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[scenes[0].fog]} />
      <GradeRig scenes={scenes} descentRef={descentRef} fogRef={fogRef} />
      {scenes.map((scene, i) => (
        // One boundary per gallery. Canvas has a single Suspense of its own, so
        // without these a gallery re-hung mid-tour (Tour's restock) would drop
        // the whole corridor while its plates loaded. The restock preloads them
        // and commits in a transition, so this should never actually show —
        // it is here so that if it ever does, it costs one gallery, off screen.
        <Suspense key={`painting-${i}`} fallback={null}>
          <Painting
            color={scene.color} depth={scene.depth} video={scene.video}
            videoRate={scene.videoRate}
            index={i} chapters={chapters} aspect={aspect}
            relief={relief} depthGamma={depthGamma} overscan={overscan}
            reduced={reduced} descentRef={descentRef}
            accentRef={accentRef} fogRef={fogRef}
            diveRef={diveRef} climbRef={climbRef}
            libraryMax={libraryMax} stepRef={stepRef}
            // The rite belongs to the crossing that DEPARTS this chapter, and
            // the plate that dissolves across it is this one.
            rite={RITES[i] ?? RITE.PLAIN} glowAt={scene.glowAt}
          />
        </Suspense>
      ))}
      {scenes.map((scene, i) => (
        <Glow
          key={`glow-${i}`}
          scene={scene} index={i} aspect={aspect} overscan={overscan}
          accentRef={accentRef} descentRef={descentRef} reduced={reduced}
          portalRef={portalRef} libraryMax={libraryMax}
          diveRef={diveRef} climbRef={climbRef}
        />
      ))}
      <PortalRings accentRef={accentRef} descentRef={descentRef} chapters={chapters} />
      <AtmosphereRig descentRef={descentRef} immersionRef={immersionRef}>
        <Fog depth={PLANE_Z + 3} y={-0.58} opacity={0.14} scale={1.5} aspect={aspect} index={0} descentRef={descentRef} />
        <Fog depth={PLANE_Z - 6} y={-0.62} opacity={0.20} scale={1.2} aspect={aspect} index={1} descentRef={descentRef} />
        <LightShafts aspect={aspect} accentRef={accentRef} reduced={reduced} />
        <Motes aspect={aspect} reduced={reduced} descentRef={descentRef} />
      </AtmosphereRig>
      <DescentRig
        descentRef={descentRef} immersionRef={immersionRef} yawRef={yawRef}
        pitchRef={pitchRef} diveRef={diveRef} climbRef={climbRef}
        refuseRef={refuseRef}
        coreUV={coreUV} aspect={aspect}
        portalRef={portalRef} libraryMax={libraryMax}
        parallax={parallax} reduced={reduced} onStep={onFootfall}
      />
    </Canvas>
  );
}
