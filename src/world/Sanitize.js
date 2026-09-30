// ── The sieve ────────────────────────────────────────────────────────────────
// One job: nothing that is not a number gets past here.
//
// The reader spent a week reporting "blinking", then "random black squares that
// flicker across the screen", and the squares were the whole of it. A single
// fragment somewhere in this world comes out NaN or infinite — at a silhouette,
// where a screen-space derivative goes to zero and a normalize divides by it, or
// anywhere else a shader is one bad frame from 0/0. On its own that is one
// wrong pixel and nobody would ever see it. Then it reaches the BLOOM, whose
// whole purpose is to take bright things and spread them, and a blur spreads
// NaN exactly as happily as light: every texel the kernel touches becomes NaN,
// every one of those is drawn as black, and the shape of the hole is the shape
// of the kernel. Which is why they were square, why they wandered about
// (a different fragment goes bad every frame), why they were worst in the Echo
// (the most geometry, the most chances), and why swapping the bloom's mipmap
// chain for a smaller kernel made them SMALLER instead of making them go away.
//
// It also explains the two blackouts this project has chased for a year and
// blamed on other things: a mipmap chain halves the frame eight times, so by
// the last level one bad texel has reached every pixel and the whole frame goes
// black. That was read as "bloom cannot cope with a multisampled buffer"
// (2026-08-06) and then as "the mip chain is broken on this driver"
// (2026-09-22). Both were the same NaN, seen through different amounts of blur.
//
// Guarding each shader is still worth doing and has been done where the traps
// were found, but it cannot be relied on: any future shader is one careless
// normalize from bringing the squares back. This sits first in the chain, costs
// one comparison per pixel, and makes the failure impossible rather than
// unlikely.
//
// `x != x` is true only for NaN, and is the portable way to ask — `isnan()`
// needs GLSL ES 3.0 and is optimised away by some drivers under fast-math.
// Infinities are caught by the magnitude test, which also keeps the bloom's
// input inside what a half-float can carry.
import { Effect } from 'postprocessing';

const fragmentShader = /* glsl */ `
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    bvec3 bad = bvec3(c.r != c.r, c.g != c.g, c.b != c.b);
    c = mix(c, vec3(0.0), vec3(bad));
    // and a ceiling: a half-float carries to 65504, and anything past about a
    // thousand here is not light, it is an accident with a divide.
    c = clamp(c, vec3(0.0), vec3(1024.0));
    outputColor = vec4(c, inputColor.a);
  }
`;

export class SanitizeEffect extends Effect {
  constructor() {
    super('Sanitize', fragmentShader);
  }
}
