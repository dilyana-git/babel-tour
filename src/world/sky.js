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
import { propsOld, MOON } from './forkProps';
import { GLOW } from './webProps';

// The moon's radius in the sky (the sine of it: a degree and a half, six times
// the real one's, as it always was here) and its seas on the unit disc, north
// up: [x, y, half-width, half-height, depth].
const MOON_R = 0.0272;
const SEAS = [
  [-0.27, 0.52, 0.33, 0.3, 1], [0.27, 0.44, 0.2, 0.2, 0.95], [0.46, 0.13, 0.25, 0.2, 1], [0.79, 0.3, 0.09, 0.12, 0.9],
  [0.69, -0.1, 0.13, 0.18, 0.85], [0.47, -0.3, 0.1, 0.1, 0.8], [-0.62, 0.16, 0.3, 0.42, 0.9], [-0.53, -0.42, 0.12, 0.12, 0.85],
  [-0.2, -0.4, 0.25, 0.2, 0.8], [0.0, 0.84, 0.5, 0.06, 0.6], [0.08, 0.12, 0.12, 0.1, 0.55],
];

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
  uniform float uGlow;
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

    // Behind the cedars at the heart of the maze (webProps.js, 7): the sky
    // there and the spires in front of it were both at nothing, and a tree
    // with no outline is a hole. Low haze with the moon on it — the horizon's
    // own grey carried up the sky that way, thinning as it climbs, uneven as
    // haze is — and the belt cuts out against it.
    if (uGlow > 0.0) {
      float toward = dot(d.xz, vec2(${GLOW.dir[0].toFixed(3)}, ${GLOW.dir[1].toFixed(3)})) / max(length(d.xz), 0.001);
      float lobe = smoothstep(${(1 - 2 * GLOW.wide).toFixed(3)}, 0.85, toward);
      float rise = smoothstep(-0.05, ${GLOW.rise[0].toFixed(3)}, up) * (1.0 - smoothstep(${GLOW.rise[1].toFixed(3)}, ${GLOW.rise[2].toFixed(3)}, up));
      float drift = 0.82 + 0.36 * (noise(d * vec3(2.6, 7.0, 2.6) + 4.0) * 0.65 + noise(d * vec3(6.0, 15.0, 6.0)) * 0.35 - 0.5);
      col += haze * uGlow * lobe * rise * drift;
    }

    float sky = smoothstep(0.0, 0.18, up);
    col += (starLayer(d, 220.0, 0.972, 1.0) + starLayer(d, 520.0, 0.985, 0.55) + starLayer(d, 90.0, 0.994, 2.2)) * sky;

    // a low moon, and the wide pale corona round it
    float m = max(dot(d, uMoonDir), 0.0);
    ${propsOld(1) ? `col += vec3(1.0, 0.96, 0.88) * smoothstep(0.99955, 0.99972, m) * 3.2;
    col += vec3(0.16, 0.2, 0.26) * pow(m, 90.0) * 0.9 + vec3(0.05, 0.065, 0.085) * pow(m, 8.0) * 0.6;` : `
    // (forkProps.js, 1: an even white disc was a lamp. Its face now: the seas
    // where they lie, their shores broken by a little noise, two rayed craters,
    // the limb a little darker, ivory — and no brighter than keeps them.)
    vec3 mRight = normalize(cross(vec3(0.0, 1.0, 0.0), uMoonDir)), mUp = cross(uMoonDir, mRight);
    vec2 q = vec2(-dot(d, mRight), dot(d, mUp)) / ${MOON_R.toFixed(5)};
    float qr = length(q), qe = fwidth(qr) * 1.2 + 0.004;
    float disc = (1.0 - smoothstep(1.0 - qe, 1.0 + qe, qr)) * step(0.0, dot(d, uMoonDir));
    if (disc > 0.0) {
      // low in the sky it lies over on its side a little
      vec2 f = mat2(0.906, -0.423, 0.423, 0.906) * q;
      vec2 w = f + 0.16 * vec2(noise(vec3(f * 4.0, 1.7)) - 0.5, noise(vec3(f * 4.0, 8.3)) - 0.5)
        + 0.05 * vec2(noise(vec3(f * 11.0, 3.1)) - 0.5, noise(vec3(f * 11.0, 5.9)) - 0.5);
      float land = 1.0;
      ${SEAS.map(([x, y, rx, ry, k]) => `land *= 1.0 - ${k.toFixed(2)} * (1.0 - smoothstep(0.5, 1.45, length((w - vec2(${x.toFixed(3)}, ${y.toFixed(3)})) / vec2(${rx.toFixed(3)}, ${ry.toFixed(3)}))));`).join(' ')}
      float seas = 1.0 - land;
      float high = noise(vec3(f * 9.0, 4.4)) * 0.6 + noise(vec3(f * 23.0, 9.2)) * 0.4;
      float albedo = 1.0 - ${MOON.seas.toFixed(3)} * seas * (0.82 + 0.36 * high) - 0.07 * (high - 0.5);
      // Tycho and Copernicus: a bright point each, and Tycho's rays
      vec2 ty = f - vec2(-0.08, -0.69);
      albedo += 0.1 * (1.0 - smoothstep(0.0, 0.07, length(ty)))
        + 0.045 * (1.0 - smoothstep(0.1, 0.75, length(ty))) * smoothstep(0.55, 0.9, noise(vec3(atan(ty.y, ty.x) * 5.0, 0.0, 2.0)))
        + 0.07 * (1.0 - smoothstep(0.0, 0.05, length(f - vec2(-0.33, 0.16))));
      float mu = sqrt(max(0.0, 1.0 - qr * qr));
      albedo *= 1.0 - ${MOON.limb.toFixed(3)} * (1.0 - mu);
      col = mix(col, vec3(1.0, 0.925, 0.77) * albedo * ${MOON.k.toFixed(3)}, disc);
    }
    col += (vec3(0.16, 0.2, 0.26) * pow(m, 420.0) * 0.55 + vec3(0.12, 0.15, 0.2) * pow(m, 60.0) * 0.22 + vec3(0.05, 0.065, 0.085) * pow(m, 8.0) * 0.5)
      * ${MOON.halo.toFixed(3)} / 0.45 * (1.0 - disc);`}

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
      uGlow: { value: 0 },
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
      if (GLOW.on && eye) {
        const far = Math.hypot(eye.x - GLOW.heart[0], eye.z - GLOW.heart[1]);
        const near = Math.min(1, Math.max(0, (GLOW.far - far) / (GLOW.far - GLOW.near)));
        material.uniforms.uGlow.value = GLOW.k * near * near * (3 - 2 * near);
      }
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
