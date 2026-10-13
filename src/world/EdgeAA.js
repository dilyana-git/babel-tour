import { EffectAttribute, FXAAEffect } from 'postprocessing';

// Filter the finished image, including shaded floor seams and thin rails.
// FXAA samples inputBuffer directly: it must get its own pass AFTER the tone
// curve and grade, otherwise effect merging lets it read the ungraded scene.
// This avoids the multisampled-buffer path that has failed on AMD with bloom.
//
// FXAA finds edges by their contrast in luma, and its thresholds are set for
// luma as the eye sees it. The composer's buffers are linear light, where
// every edge darker than about a fifth of white is under the 0.0312 floor: a
// dark hedge against a darker lawn or a shore against black water would keep
// its whole staircase while the pale wall tops are smoothed. So the edges are
// found in a perceptual luma (the square root of the linear one, near enough a
// display's 2.2); what is filtered, and how, is FXAA's own.
export class EdgeAAEffect extends FXAAEffect {
  constructor() {
    super();
    this.setAttributes(EffectAttribute.CONVOLUTION);
    this.setFragmentShader(`float edgeLuma(const in vec3 rgb) { return sqrt(max(luminance(rgb), 0.0)); }
${this.getFragmentShader().replace(/\bluminance\(/g, 'edgeLuma(')}`);
  }
}
