import { EffectAttribute, FXAAEffect } from 'postprocessing';

// Filter the finished image, including shaded floor seams and thin rails.
// FXAA samples inputBuffer directly: it must get its own pass AFTER the tone
// curve and grade, otherwise effect merging lets it read the ungraded scene.
// This avoids the multisampled-buffer path that has failed on AMD with bloom.
export class EdgeAAEffect extends FXAAEffect {
  constructor() {
    super();
    this.setAttributes(EffectAttribute.CONVOLUTION);
  }
}
