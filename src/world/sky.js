// ── The night over the world ─────────────────────────────────────────────────
// Seen only from inside it. Over the map the camera looks down and never meets
// it; standing in a gallery a reader who tips their head back looks up a well
// of shelves at a strip of it, and in the garden it is half of every view. A
// flat colour there is the one cue that says "a model on a table"; this says
// "outside, at night".
//
// Drawn procedurally rather than as a texture, so a star is a point at any
// resolution: a graded vault (near-black blue overhead, a cool haze low down —
// the distance in the plates is the only cool thing in them), a faint band of
// the galaxy, two layers of stars that breathe slightly, and a low moon with a
// wide soft corona. Written in linear light for the composer, bright enough in
// its cores for the bloom to take them.
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // on the far plane, whatever the dome's size
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmount;
  uniform vec3 uMoonDir;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }

  vec3 starLayer(vec3 d, float scale, float threshold, float gain) {
    vec3 p = d * scale;
    vec3 cell = floor(p);
    float h = hash(cell);
    if (h < threshold) return vec3(0.0);
    vec3 at = vec3(hash(cell + 11.0), hash(cell + 23.0), hash(cell + 37.0)) - 0.5;
    float r = length(fract(p) - 0.5 - at * 0.7);
    float twinkle = 0.8 + 0.2 * sin(uTime * (0.6 + h * 2.3) + h * 91.0);
    float core = smoothstep(0.1, 0.0, r) * twinkle * gain * (h - threshold) / (1.0 - threshold) * 3.0;
    vec3 tint = mix(vec3(1.0, 0.86, 0.72), vec3(0.72, 0.84, 1.0), hash(cell + 5.0));
    return tint * core;
  }

  void main() {
    vec3 d = normalize(vDir);
    float up = d.y;
    vec3 zenith = vec3(0.004, 0.007, 0.016);
    vec3 haze = vec3(0.05, 0.062, 0.078);
    vec3 below = vec3(0.012, 0.011, 0.010);
    vec3 col = up >= 0.0
      ? mix(haze, zenith, pow(clamp(up, 0.0, 1.0), 0.4))
      : mix(haze, below, clamp(-up * 5.0, 0.0, 1.0));

    // the galaxy: a soft band, broken by dust
    vec3 axis = normalize(vec3(0.35, 0.52, -0.78));
    float band = exp(-pow(dot(d, axis) * 3.4, 2.0));
    float dust = noise(d * 7.0) * 0.6 + noise(d * 19.0) * 0.4;
    col += vec3(0.034, 0.038, 0.05) * band * smoothstep(0.35, 0.75, dust) * smoothstep(-0.02, 0.25, up);

    float sky = smoothstep(0.0, 0.18, up);
    col += (starLayer(d, 220.0, 0.972, 1.0) + starLayer(d, 520.0, 0.985, 0.55) + starLayer(d, 90.0, 0.994, 2.2)) * sky;

    // a low moon, and the wide pale corona round it
    float m = max(dot(d, uMoonDir), 0.0);
    col += vec3(1.0, 0.96, 0.88) * smoothstep(0.99955, 0.99972, m) * 3.2;
    col += vec3(0.16, 0.2, 0.26) * pow(m, 90.0) * 0.9 + vec3(0.05, 0.065, 0.085) * pow(m, 8.0) * 0.6;

    gl_FragColor = vec4(col * uAmount, 1.0);
  }
`;

export function makeSky() {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uAmount: { value: 1 },
      uMoonDir: { value: new THREE.Vector3(0.62, 0.3, -0.72).normalize() },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';
  return {
    mesh,
    update(t, eye, amount) {
      material.uniforms.uTime.value = t;
      material.uniforms.uAmount.value = amount;
      mesh.visible = amount > 0.001;
      if (eye) mesh.position.copy(eye);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
