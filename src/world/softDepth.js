import * as THREE from 'three';

// Transparent air must sample a copy of the solids' depth, never the active
// attachment. Each material keeps one copy per target so reflections and
// doorway cameras cannot lend their depth to the reader's view.
export function bindSceneDepth(material, uniforms) {
  const copies = new Map();
  material.onBeforeRender = (renderer, scene, camera) => {
    const source = renderer.getRenderTarget();
    uniforms.uSoft.value = 0;
    material.uniformsNeedUpdate = true;
    if (!source || !source.depthBuffer || source.samples > 0 || renderer.capabilities.reverseDepthBuffer) return;
    let copy = copies.get(source);
    if (!copy) {
      const depth = new THREE.DepthTexture(source.width, source.height,
        source.depthTexture?.type ?? (source.stencilBuffer ? THREE.UnsignedInt248Type : THREE.UnsignedIntType));
      depth.format = source.depthTexture?.format ?? (source.stencilBuffer ? THREE.DepthStencilFormat : THREE.DepthFormat);
      copy = { target: new THREE.WebGLRenderTarget(source.width, source.height, {
        depthTexture: depth, stencilBuffer: source.stencilBuffer,
      }), frame: -1 };
      copies.set(source, copy);
    }
    const target = copy.target;
    if (target.width !== source.width || target.height !== source.height) {
      target.setSize(source.width, source.height);
      copy.frame = -1;
    }
    if (copy.frame !== renderer.info.render.frame) {
      renderer.initRenderTarget(target);
      const gl = renderer.getContext();
      try {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, renderer.properties.get(source).__webglFramebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, renderer.properties.get(target).__webglFramebuffer);
        gl.blitFramebuffer(0, 0, source.width, source.height, 0, 0, target.width, target.height,
          gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      } finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, renderer.properties.get(source).__webglFramebuffer);
        renderer.setRenderTarget(source);
      }
      copy.frame = renderer.info.render.frame;
    }
    uniforms.uSceneDepth.value = target.depthTexture;
    uniforms.uDepthSize.value.set(source.width, source.height);
    renderer.getCurrentViewport(uniforms.uDepthViewport.value);
    uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.uCameraWorld?.value.copy(camera.matrixWorld);
    uniforms.uSoft.value = 1;
  };
  material.addEventListener('dispose', () => {
    for (const { target } of copies.values()) target.dispose();
    copies.clear();
  });
  return material;
}
