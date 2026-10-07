// ── A door into a room somewhere else ────────────────────────────────────────
// The Library is a honeycomb, and only a handful of its hexagons are dressed:
// out of the Vestibule by the way in, a reader walking on their own came into a
// hexagon with nothing in it but shelving. Here the far end of that hallway
// opens instead onto a room that IS dressed — the Echo, through its far door —
// and the reader walks into it.
//
// The doorway is a window onto the world drawn a second time, from where the
// reader's eye would be if their hallway were the one that does lead into that
// room (`by`: every hallway is the same stone, so that eye is the reader's own
// moved along the honeycomb). And a step short of the doorway, where the two
// hallways cannot be told apart, the reader IS moved there (World.jsx), so
// they walk on into the real room. Nothing is cut and nothing goes dark.
//
// What the window shows has the far room's depth as well as its colour, so
// everything that reads the depth afterwards — the contact shadow above all —
// sees the room and not a flat sheet across the doorway. The same quad is
// drawn three times:
//   `seal`, first of everything and in depth alone, so that nothing behind the
//      doorway (the bare hexagon it really opens onto) is ever shaded;
//   `face`, last of the solids, where the seal is still what is seen: the far
//      room's colour, and a mark in the stencil;
//   `deep`, on the marked pixels only, the far room's depth.
// Without a stencil (?wpost=0, ?wstencil=0) `deep` is not drawn, and the
// doorway's depth is the doorway's.
//
// The second drawing is only of the doorway's own patch of the screen, through
// a frustum cut down to it and starting at the far doorway — so it draws only
// what can be seen through the opening, and stops being drawn at all when the
// doorway is out of view.
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uDepth;
  uniform vec2 uSize;         // the frame, in pixels
  uniform vec4 uPatch;        // the doorway's patch of it: x, y, width, height
  uniform mat4 uFarInverse;   // the far eye's projection (cut down and skewed), inverted
  uniform mat4 uNear;         // the reader's own projection
  uniform float uDeep;        // 1: write the far room's depth
  void main() {
    gl_FragColor = vec4(texture2D(uMap, gl_FragCoord.xy / uSize).rgb, 1.0);
    if (uDeep > 0.5) {
      // The far eye looks the same way as the reader's and stands the same
      // distance from everything it sees, so a point's place in its view IS
      // that point's place in the reader's: un-project through its frustum,
      // project through the reader's.
      float d = texture2D(uDepth, gl_FragCoord.xy / uSize).x;
      vec2 ndc = (gl_FragCoord.xy - uPatch.xy) / uPatch.zw * 2.0 - 1.0;
      vec4 v = uFarInverse * vec4(ndc, d * 2.0 - 1.0, 1.0);
      v /= v.w;
      vec4 c = uNear * vec4(v.xyz, 1.0);
      gl_FragDepth = clamp(c.z / c.w * 0.5 + 0.5, 0.0, 1.0);
    } else {
      gl_FragDepth = gl_FragCoord.z;
    }
  }
`;

// `at`: the middle of the doorway on the floor, [x, z]; `out`: the way a
// reader walks through it; `half`, `floor`, `top`: the opening, a little
// over-size (what lies outside the opening is behind its own jambs); `by`:
// from this doorway to the one it opens as.
export function makeDoorway({ root, keep, at, out, half, floor, top, by }) {
  const size = new THREE.Vector2(16, 16);
  const target = new THREE.WebGLRenderTarget(16, 16, {
    // Linear light, half float, like the frame it is pasted into: a byte
    // target would band the dark and clip every lamp.
    type: THREE.HalfFloatType,
    colorSpace: THREE.LinearSRGBColorSpace,
    depthBuffer: true,
    depthTexture: new THREE.DepthTexture(16, 16, THREE.FloatType),
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  const uniforms = {
    uMap: { value: target.texture },
    uDepth: { value: target.depthTexture },
    uSize: { value: new THREE.Vector2(1, 1) },
    uPatch: { value: new THREE.Vector4(0, 0, 1, 1) },
    uFarInverse: { value: new THREE.Matrix4() },
    uNear: { value: new THREE.Matrix4() },
  };
  const material = (deep) => keep(new THREE.ShaderMaterial({
    // (the two share the matrices and the target; only uDeep is their own)
    uniforms: { ...uniforms, uDeep: { value: deep ? 1 : 0 } },
    vertexShader,
    fragmentShader,
    toneMapped: false,
    fog: false,
    stencilWrite: true,
    stencilRef: 1,
    ...(deep ? {
      depthFunc: THREE.AlwaysDepth,
      stencilFunc: THREE.EqualStencilFunc,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp,
    } : {
      depthFunc: THREE.LessEqualDepth,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    }),
  }));
  const quad = keep(new THREE.PlaneGeometry(2 * half, top - floor));
  const place = (m, order) => {
    m.name = 'doorway';
    m.position.set(at[0], (floor + top) / 2, at[1]);
    m.rotation.y = Math.atan2(-out[0], -out[1]);
    m.renderOrder = order;
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    m.visible = false;
    root.add(m);
    return m;
  };
  // (pushed a hair back, so the face — the same quad — always passes over it)
  const seal = place(new THREE.Mesh(quad, keep(new THREE.MeshBasicMaterial({
    colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4,
  }))), -1e6);
  const face = place(new THREE.Mesh(quad, material(false)), 1e6);
  const deep = place(new THREE.Mesh(quad, material(true)), 1e6 + 1);

  // The far eye, and the corners of the opening, for asking where it is on the screen.
  const eye = new THREE.PerspectiveCamera();
  const corners = [-1, 1].flatMap((s) => [floor, top].map((y) => new THREE.Vector3(at[0] - out[1] * half * s, y, at[1] + out[0] * half * s)));
  const p = new THREE.Vector3(), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const cut = new THREE.Matrix4();
  const normal = new THREE.Vector3(out[0], 0, out[1]);
  const through = new THREE.Vector3();
  const farEye = new THREE.Vector3();
  let open = false, near = false;

  // How far `point` (x, z) is past the doorway, along `out` (negative: short of it).
  const past = (x, z) => (x - at[0]) * out[0] + (z - at[1]) * out[1];
  const across = (x, z) => Math.abs((x - at[0]) * -out[1] + (z - at[1]) * out[0]);

  const show = (on, stencil = false) => {
    seal.visible = on;
    face.visible = on;
    deep.visible = on && stencil;
    open = on;
    return on;
  };

  // Draws what the doorway shows, if it is in view at all; `stencil`: the frame
  // has one, so the far room's depth can be written; `aim(eye)`: set what is
  // drawn for an eye (the halos) for the far one, and `aim(null)` back for
  // the reader's. Call after the camera's matrix is up to date and before the
  // frame is drawn.
  const render = (renderer, scene, camera, stencil, aim = null) => {
    const ahead = -past(camera.position.x, camera.position.z);
    near = ahead < 70 && across(camera.position.x, camera.position.z) < half + 40;
    // Only from this side, and near enough for the doorway to be more than a speck.
    if (ahead <= 0 || ahead > 900) return show(false);
    // Its patch of the screen, from its corners (all of it, if any corner is
    // behind the eye); none, if it is off the screen.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of corners) {
      p.copy(c).applyMatrix4(camera.matrixWorldInverse);
      if (p.z > -camera.near) { x0 = -1; y0 = -1; x1 = 1; y1 = 1; break; }
      p.applyMatrix4(camera.projectionMatrix);
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    if (x1 < -1 || y1 < -1 || x0 > 1 || y0 > 1) return show(false);
    renderer.getDrawingBufferSize(size);
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
    uniforms.uSize.value.copy(size);
    // in whole pixels, a pixel's margin round it, inside the frame
    const sx = Math.max(0, Math.floor(((Math.max(x0, -1) + 1) / 2) * size.x) - 1);
    const sy = Math.max(0, Math.floor(((Math.max(y0, -1) + 1) / 2) * size.y) - 1);
    const ex = Math.min(size.x, Math.ceil(((Math.min(x1, 1) + 1) / 2) * size.x) + 1);
    const ey = Math.min(size.y, Math.ceil(((Math.min(y1, 1) + 1) / 2) * size.y) + 1);
    if (ex - sx < 1 || ey - sy < 1) return show(false);
    target.viewport.set(sx, sy, ex - sx, ey - sy);
    target.scissor.set(sx, sy, ex - sx, ey - sy);
    target.scissorTest = true;
    uniforms.uPatch.value.set(sx, sy, ex - sx, ey - sy);

    // The far eye: the reader's, moved along the honeycomb (set as a place and
    // a turn, not a matrix: the renderer rebuilds a camera's matrix from those).
    camera.matrixWorld.decompose(eye.position, eye.quaternion, eye.scale);
    eye.position.x += by[0];
    eye.position.z += by[1];
    eye.updateMatrixWorld();
    // Its lens: the reader's, cut down to the doorway's patch (a view offset,
    // in effect) ...
    const ax = (2 * sx) / size.x - 1, bx = (2 * ex) / size.x - 1;
    const ay = (2 * sy) / size.y - 1, byy = (2 * ey) / size.y - 1;
    cut.set(
      2 / (bx - ax), 0, 0, -(bx + ax) / (bx - ax),
      0, 2 / (byy - ay), 0, -(byy + ay) / (byy - ay),
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
    eye.projectionMatrix.multiplyMatrices(cut, camera.projectionMatrix);
    // ... and its near plane skewed onto the far doorway (Lengyel's oblique
    // frustum, as the pond's mirror does): the hallway the far eye stands in
    // is not drawn — nor culled in, nor anything behind it — only the room
    // beyond, so nothing of the far hallway can stand in the doorway.
    plane.setFromNormalAndCoplanarPoint(normal, through.set(at[0] + by[0], floor, at[1] + by[1]).addScaledVector(normal, -0.3));
    plane.applyMatrix4(eye.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const P = eye.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + P[8]) / P[0], (Math.sign(clip.y) + P[9]) / P[5], -1, (1 + P[10]) / P[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    P[2] = clip.x;
    P[6] = clip.y;
    P[10] = clip.z + 1;
    P[14] = clip.w;
    eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert();
    uniforms.uFarInverse.value.copy(eye.projectionMatrixInverse);
    uniforms.uNear.value.copy(camera.projectionMatrix);

    const was = renderer.getRenderTarget();
    const wasShadow = renderer.shadowMap.autoUpdate;
    show(false);
    try {
      renderer.shadowMap.autoUpdate = false;
      aim?.(eye.position);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, eye);
    } finally {
      renderer.setRenderTarget(was);
      renderer.shadowMap.autoUpdate = wasShadow;
      aim?.(null);
    }
    farEye.copy(eye.position);
    return show(true, stencil);
  };

  // A reader's feet that have come this far toward the doorway, from `from`:
  // whether they are now to be moved through it. A step short of it, where the
  // reader's hallway and the far one are the same stone, so that the doorway
  // itself is never nearer the eye than the camera's near plane.
  const SHORT = 1;
  const crossed = (fromX, fromZ, x, z) => past(fromX, fromZ) < -SHORT && past(x, z) >= -SHORT && across(x, z) < half;

  return {
    render,
    hide: () => show(false),
    crossed,
    by,
    // Where the far eye stands, while the reader is walking up to the doorway
    // (World.jsx lights the lamps as if the reader stood there too, so the
    // room is lit as it will be when they are moved there). Not from further
    // off: across the Vestibule the doorway is a small arch, and lighting the
    // far room then took lamps off the room the reader was standing in.
    farEye: () => (open && near ? farEye : null),
    dispose: () => { target.depthTexture?.dispose(); target.dispose(); },
  };
}
