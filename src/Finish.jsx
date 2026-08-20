// ── The finish on the glass ──────────────────────────────────────────────────
// The last open item of TODO(beauty-13). Three screen-space effects, chosen for
// what they do to THIS art rather than because a composer usually has them:
//
//   grain     The plates come from several Midjourney batches and the clips from
//             three different super-resolution models, each with its own noise
//             floor — one gallery is silky, the next is crunchy, and hanging
//             them along one corridor makes the difference legible as an
//             inconsistency. A single grain laid over everything at the very end
//             gives them all the same skin. It also does what grain has always
//             done for dark material: these are enormous unlit interiors full of
//             slow gradients into black, exactly where 8-bit banding shows, and
//             a little noise dithers the steps away.
//
//   vignette  The cards are extended past the artwork with a mirrored
//             continuation and dissolved into fog at the margins. That is the
//             machinery for never showing a hard edge, and the vignette is its
//             ally: it darkens the corners where that machinery lives, so the
//             eye is drawn to the painted middle and away from the seam.
//
//   bloom     Kept on a high threshold on purpose. Every lamp in these paintings
//             is already painted, and each gallery hangs its own Glow mesh at
//             the light source; a low threshold would bloom the whole plate and
//             turn a carefully graded dark room into haze. At 0.86 only the
//             true cores — lamp filaments, the vortex throat, candle flames —
//             are above it, so this reads as light spilling, not as a filter.
//
// Turn the whole thing off with ?finish=0. Worth doing side by side once on real
// hardware: the composer renders the scene through its own buffer, so it is the
// one change here that could shift the colour of a piece this deliberately
// graded, and it should be judged by eye rather than assumed harmless.
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { HalfFloatType } from 'three';
import { LIGHT_MESH } from './capability';

const params = () => (typeof window === 'undefined'
  ? new URLSearchParams()
  : new URLSearchParams(window.location.search));

const ON = params().get('finish') !== '0';

// Dials for bisecting this composer on real hardware, in the same spirit as
// capability.js: every guess here is a guess about a DRIVER, and a guess about a
// driver needs a way to be checked on the machine it was guessed for.
//
//   ?finish=0     the whole composer off — the scene draws straight to the canvas
//   ?msaa=N       multisampling on the composer's buffer (0 = off, and see MSAA)
//   ?fb=8         an 8-bit buffer instead of half-float
//   ?bloom=0      drop the bloom pass (the only one with its own blur chain)
//
// They exist because of what they found. See MSAA.
const num = (name, fallback) => {
  const v = params().get(name);
  const n = Number(v);
  return v === null || Number.isNaN(n) ? fallback : n;
};

// Multisampling on the composer's buffer. OFF, and this is not a performance
// decision — it is the whole reason this piece was rendering a BLACK SCREEN.
//
// Measured 2026-08-06 on ANGLE (AMD, AMD Radeon(TM) Graphics 0x00001636,
// Direct3D11), driving the real GPU rather than swiftshader, reading the
// drawing buffer back with gl.readPixels rather than trusting a screenshot
// (headless GPU captures can drop the WebGL layer and lie in the same
// direction as the bug):
//
//   msaa 4, bloom, half-float         mean 0      max 0     <- nothing at all
//   msaa 4, bloom, 8-bit (?fb=8)      mean 0      max 0
//   composer off (?finish=0)          mean 67.3   max 234
//   msaa 0, bloom, half-float         mean 65.7   max 255
//   msaa 4, NO bloom (?bloom=0)       mean 66.5   max 254
//
// So it is neither one alone: it is the bloom pass reading a MULTISAMPLED
// source. Bloom is the only effect with its own downsample chain — it binds the
// composer's buffer as a texture and mips it — and on this driver that comes
// back empty and takes the whole frame with it, in either buffer format. Which
// of the two to give up is then an easy call: bloom is the lamp cores, the
// vortex throat and the candle flames, and multisampling on this content is
// worth almost nothing (below).
//
// The frame is not dim, it is empty: the clear happens and nothing else reaches
// the canvas. And it fails SILENTLY — no GL error, no shader error, no
// exception, no context loss, the render loop ticking along at 20 fps drawing
// nothing. From the reader's chair the entire corridor is simply gone, HUD
// floating over black.
//
// Nothing in this project could have caught it. Every headless check runs under
// swiftshader, which composes the multisampled buffer perfectly (mean 36.8,
// litFraction 0.99 on the same frame) — the one class of bug where the software
// rasterizer is not a conservative stand-in for a GPU but an outright liar.
// When something looks wrong on real hardware and right in every check, come
// back and read this before doubting the reader.
//
// The loss is close to nothing. This scene is textured planes whose edges are
// feathered into fog by design (see the margin dissolve), so there is barely a
// hard silhouette for MSAA to soften — and the Canvas's own `antialias: true`
// is already inert while a composer owns the render. Turn it back on with
// ?msaa=4 to judge that claim on a machine where it works (?msaa=4&bloom=0
// renders even here).
const MSAA = num('msaa', 0);

export default function Finish({ reduced }) {
  if (!ON) return null;

  // Bloom is the only one of the three with a cost worth naming: grain and
  // vignette are arithmetic on a pixel the pass already has, and the library
  // merges them into a single fullscreen shader, while bloom needs its own
  // downsample-and-blur chain every frame. On the devices that got the reduced
  // mesh it is the first thing to go, and the two cheap effects — which are
  // also the two doing the most for this art — stay.
  const bloom = !LIGHT_MESH && num('bloom', 1) !== 0;

  return (
    <EffectComposer
      // Half-float keeps the composer's own buffer out of 8-bit, which matters
      // precisely because the material here is long gradients into darkness:
      // rounding those to 256 levels mid-chain would re-introduce the banding
      // the grain is being asked to hide. Skipped where the mesh was reduced —
      // it doubles the bandwidth of every pass, and bandwidth is what a phone
      // is short of.
      frameBufferType={LIGHT_MESH || num('fb', 16) === 8 ? undefined : HalfFloatType}
      multisampling={LIGHT_MESH ? 0 : MSAA}
      enableNormalPass={false}
    >
      {/* NO SMAA, AND IT WAS MEASURED, 2026-08-07. It is the obvious answer to
          the shimmer on the chains and balustrades — MSAA being unavailable
          here (see MSAA above), an edge-detecting pass over the finished image
          is what is left. It makes the shimmer WORSE. On a pinned plate, real
          GPU, frozen camera, one sub-pixel step: mean |Δluma| 0.194 and peak 46
          with SMAA against 0.184 and peak 11 without it.
          Which is the expected result once stated plainly: SMAA 1x re-detects
          its edges from scratch every frame, so a pattern that shifts by a
          fraction of a pixel gets classified differently and the pass adds its
          own instability on exactly the silhouettes it was brought in to calm.
          The temporal variants (SMAA T2x and friends) are what would help, and
          they need velocity buffers this scene does not draw. */}
      {bloom ? (
        <Bloom
          luminanceThreshold={0.86}
          // A hard cutoff makes a lamp pop into bloom as the grade drifts past
          // the threshold — and this scene re-grades continuously as the reader
          // descends. The smoothing is what keeps that a fade rather than a
          // switch.
          luminanceSmoothing={0.12}
          intensity={0.45}
          mipmapBlur
        />
      ) : null}
      {/* Animated per frame by construction, so it is the one effect a reader
          who asked for reduced motion must not be given: a full-screen shimmer
          is exactly the thing that setting exists to refuse. They keep the
          vignette, and the plates are static enough not to need the dither. */}
      {reduced ? null : (
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.055} />
      )}
      <Vignette offset={0.3} darkness={0.65} eskil={false} />
    </EffectComposer>
  );
}
