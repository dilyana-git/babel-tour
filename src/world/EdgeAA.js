import { EffectAttribute, FXAAEffect } from 'postprocessing';
import { Uniform } from 'three';
import { gradePlace } from './Grade';

// Filter the finished image, including shaded floor seams and thin rails.
// FXAA samples inputBuffer directly: it must get its own pass AFTER the tone
// curve and grade, otherwise effect merging lets it read the ungraded scene.
// This avoids the multisampled-buffer path that has failed on AMD with bloom.
export class EdgeAAEffect extends FXAAEffect {
  constructor() {
    super();
    this.setAttributes(EffectAttribute.CONVOLUTION);
    // Dark map edges need a lower contrast threshold than the room views.
    this.uniforms.set('uMapEdges', new Uniform(0));
    this.setFragmentShader(`uniform float uMapEdges;\n${this.getFragmentShader()
      .replaceAll('EDGE_THRESHOLD_MIN', 'mix(0.0312, 0.006, uMapEdges)')}`);
  }

  update(renderer, inputBuffer, deltaTime) {
    super.update(renderer, inputBuffer, deltaTime);
    this.uniforms.get('uMapEdges').value = gradePlace.map;
  }
}
