// TODO(beauty-12): descent grading — drive uExposure + fog color from descentRef so
// light genuinely dims/cools toward The Silence; shrink the lamp Glow to an ember.
// TODO(beauty-13): postprocessing — EffectComposer with Noise (film grain ~0.05,
// hides banding in the dark gradients), Vignette (offset ~0.3, darkness ~0.65),
// Bloom (high threshold so only the corridor core blooms), GodRays anchored to a
// small emissive disc at the glowing door (~[0.53, 0.55] of frame, just in front of
// the relief's deepest point), intensity rising as descent approaches max.
// TODO(beauty-14): gl powerPreference 'high-performance'; drop plane segments to
// ~[420, 236] on coarse-pointer devices.
// TODO(beauty-15): SCENE textures — switch to .webp once converted. Now that every
// chapter carries its own pair this matters much more: six 8MB PNGs is ~43MB of
// download and ~200MB of GPU memory once decoded.
import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const FOV = 55;
const frustumH = (dist) => 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));

// ---------------------------------------------------------------------------
// Shared depth model — a slow, atmospheric dwell.
//
// `descentRef.current` is a continuous float in [0, chapters-1]. The camera drifts
// gently INWARD along -Z, sinking a little deeper into the same corridor with each
// chapter, but always staying well in front of the relief — you dwell in the place
// rather than travel through it. No punch-through, no whip turns, no remounts.
// ---------------------------------------------------------------------------

// The relief plane sits here; the camera lives in the space in front of it.
const PLANE_Z = 26;
// Total inward drift from the entry (z=0) to the deepest dwell point. Kept modest
// and always short of the plane so the camera never reaches or clips the relief.
// Scales with chapter count so each step keeps a similar sense of movement.
// Stays safely short of PLANE_Z (26) minus the relief displacement so the camera
// never clips into the nearest relief bumps.
const MAX_INWARD = 19;
// Camera world-z as a function of descent phase p in [0,1].
const camZ = (p) => -MAX_INWARD * p;
// Spacing of the suspended light rings along the corridor.
const STEP_DEPTH = 5;

// Both shaders carry two slots — the chapter we're leaving (A) and the one we're
// arriving at (B) — blended by `uMix`. Because the blend happens inside a single
// material, the relief *morphs* between the two scenes on one plane rather than
// cross-fading two overlapping displaced meshes (which would z-fight and interleave
// where their depths disagree). One draw call, no sorting, continuous geometry.
const paintingVert = /* glsl */`
  uniform sampler2D depthA;
  uniform sampler2D depthB;
  uniform float uMix;
  uniform float relief;
  uniform float depthGamma;
  uniform float uTime;
  uniform float uBreath;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec2 vUv;
  varying float vDepth;
  varying float vFog;
  void main() {
    vUv = uv;
    float d = mix(texture2D(depthA, uv).r, texture2D(depthB, uv).r, uMix);
    d = pow(d, depthGamma);
    vDepth = d;
    float breath = 1.0 + sin(uTime * 0.5) * 0.06 * uBreath;
    float ripple = sin(d * 9.0 - uTime * 0.7) * 0.015 * uBreath;
    vec3 p = position;
    p.z += (d - 0.5) * relief * breath + ripple * relief;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFog = clamp((-mv.z - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const paintingFrag = /* glsl */`
  uniform sampler2D mapA;
  uniform sampler2D mapB;
  uniform float uMix;
  uniform float uTime;
  uniform float uBreath;
  uniform vec3 uFogColor;
  varying vec2 vUv;
  varying float vDepth;
  varying float vFog;
  void main() {
    vec4 tex = mix(texture2D(mapA, vUv), texture2D(mapB, vUv), uMix);
    float pulse = 0.5 + 0.5 * sin(uTime * 0.35 + vDepth * 3.14159);
    tex.rgb += tex.rgb * pulse * 0.05 * uBreath * smoothstep(0.2, 1.0, vDepth);
    float fog = vFog * vFog;
    tex.rgb = mix(tex.rgb, uFogColor, fog * 0.85);
    gl_FragColor = tex;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// The relief plane. Holds every chapter's (color, depth) pair and blends the two
// that bracket the current descent, so moving between chapters morphs the terrain
// continuously rather than swapping it out.
function Relief({ pairs, reliefs, gammas, aspect, overscan, reduced, descentRef }) {
  // The frame loop reads the artwork through a ref rather than closing over the prop.
  // Tour re-renders on every frame of a transition (the video envelope is React
  // state), so anything the geometry memo depends on has to be a primitive — one
  // unstable array reference here would rebuild a 275k-vertex plane 60 times a second.
  const live = useRef({ pairs, reliefs, gammas });
  live.current = { pairs, reliefs, gammas };

  // Built once. Chapter artwork arrives through uniforms every frame, so changing
  // chapter never rebuilds the plane.
  const { geo, mat } = useMemo(() => {
    const h = frustumH(PLANE_Z) * overscan;
    const w = h * aspect;
    // Segment counts follow the plane's proportions so triangles stay near-square
    // at any aspect — a 16:9 split on a 21:9 plane stretches them badly.
    const segY = 344;
    const segX = Math.round(segY * aspect);
    return {
      geo: new THREE.PlaneGeometry(w, h, segX, segY),
      mat: new THREE.ShaderMaterial({
        // Seeded null; the first useFrame fills them before anything is drawn.
        uniforms: {
          mapA: { value: null },
          mapB: { value: null },
          depthA: { value: null },
          depthB: { value: null },
          uMix: { value: 0 },
          relief: { value: 0 },
          depthGamma: { value: 1 },
          uTime: { value: 0 },
          uBreath: { value: reduced ? 0 : 1 },
          uFogNear: { value: PLANE_Z },
          uFogFar: { value: PLANE_Z },
          uFogColor: { value: new THREE.Color('#15120d') },
        },
        vertexShader: paintingVert,
        fragmentShader: paintingFrag,
      }),
    };
  }, [aspect, overscan, reduced]);

  useFrame(({ clock }) => {
    const u = mat.uniforms;
    const { pairs: art, reliefs: rs, gammas: gs } = live.current;
    u.uTime.value = clock.getElapsedTime();

    // Bracket the continuous descent with the chapters either side of it.
    const last = art.length - 1;
    const d = Math.min(Math.max(descentRef.current, 0), last);
    const lo = Math.floor(d);
    const hi = Math.min(lo + 1, last);
    const f = d - lo;

    u.mapA.value = art[lo].color;
    u.depthA.value = art[lo].depth;
    u.mapB.value = art[hi].color;
    u.depthB.value = art[hi].depth;
    // Smoothstep the crossfade. A linear mix lingers at 50/50, where two different
    // scenes read as a double exposure; this eases out of each chapter and crosses
    // the muddy middle half again as fast, without hurrying the arrival.
    u.uMix.value = f * f * (3 - 2 * f);

    // Relief height and depth gamma are per-chapter knobs — depth maps from
    // different images need different shaping — so they travel with the artwork.
    // Fog follows the relief so the haze band keeps sitting inside the geometry.
    const r = rs[lo] + (rs[hi] - rs[lo]) * f;
    u.relief.value = r;
    u.depthGamma.value = gs[lo] + (gs[hi] - gs[lo]) * f;
    u.uFogNear.value = PLANE_Z - r * 0.5;
    u.uFogFar.value = PLANE_Z + r * 1.6;
  });

  return <mesh geometry={geo} material={mat} position={[0, 0, -PLANE_Z]} renderOrder={1} />;
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
// the more alive and thick the air becomes.
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
    const energy = 1 + descent * 0.35;
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
    ref.current.material.opacity = 0.6 + Math.min(0.3, descent * 0.12);
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
    <mesh ref={ref} position={[0, y * h * 0.5, -depth]} renderOrder={5}>
      <planeGeometry args={[h * aspect * scale, h * 0.5 * scale]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity}
        blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

// The lamp glow; its color eases toward the current chapter's accent.
function Glow({ aspect, at = [0.5, 0.55], accentRef, reduced }) {
  const ref = useRef();
  const { pointer } = useThree();
  const sprite = useMemo(
    () => radialTexture([
      [0, 'rgba(236,228,210,1)'],
      [0.3, 'rgba(201,162,76,0.85)'],
      [1, 'rgba(201,162,76,0)'],
    ]), []);
  const d = PLANE_Z + 2;
  const h = frustumH(d);
  const w = h * aspect;
  const restX = (at[0] - 0.5) * w;
  const restY = (0.5 - at[1]) * h;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const flicker =
      Math.sin(t * 0.5) * 0.06 +
      Math.sin(t * 1.7 + 1.1) * 0.03 +
      Math.sin(t * 4.3 + 0.4) * 0.015;
    const px = reduced ? restX : restX + pointer.x * w * 0.28;
    const py = reduced ? restY : restY + pointer.y * h * 0.28;
    ref.current.position.x += (px - ref.current.position.x) * 0.05;
    ref.current.position.y += (py - ref.current.position.y) * 0.05;
    const near = reduced ? 0 : Math.max(0, 0.12 - Math.abs(pointer.x) * 0.06 - Math.abs(pointer.y) * 0.06);
    ref.current.material.opacity = 0.27 + flicker + near;
    const s = 1 + Math.sin(t * 0.9) * 0.04 + near * 0.8;
    ref.current.scale.set(h * 0.4 * s, h * 0.4 * s, 1);
    ref.current.material.color.lerp(accentRef.current, 0.05);
  });
  return (
    <sprite
      ref={ref}
      position={[(at[0] - 0.5) * w, (0.5 - at[1]) * h, -d]}
      scale={[h * 0.4, h * 0.4, 1]}
      renderOrder={3}
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
    <group ref={group} renderOrder={4}>
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

// A ring of light suspended ahead in the dark; the camera passes through one
// each chapter, reinforcing the sense of descending gallery to gallery.
function PortalRings({ accentRef, descentRef, chapters }) {
  const group = useRef();
  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }
    const t = clock.getElapsedTime();
    const descent = descentRef.current;
    group.current.children.forEach((ring, i) => {
      ring.rotation.z = t * 0.08 + i;
      // Brightest as the camera nears this ring's chapter, faint otherwise.
      const proximity = Math.max(0, 1 - Math.abs(descent - i) * 1.4);
      ring.material.opacity = 0.05 + proximity * 0.4;
      ring.material.color.lerp(accentRef.current, 0.05);
      ring.scale.setScalar(1 + proximity * 0.12);
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: chapters }, (_, i) => (
        <mesh key={i} position={[0, 0, -(PLANE_Z - 1.5) + i * STEP_DEPTH]} renderOrder={2}>
          <torusGeometry args={[3.4, 0.05, 16, 120]} />
          <meshBasicMaterial transparent opacity={0.08} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// The camera rig: a slow, atmospheric dwell. Drifts gently inward with descent,
// gazes into the corridor, and can pan left/right (yaw) to look around. Never rushes.
function DescentRig({ descentRef, maxDescent, yawRef, parallax, reduced }) {
  const { camera, pointer } = useThree();
  const lookAt = useRef(new THREE.Vector3(0, 0, -PLANE_Z));
  const scratch = useRef(new THREE.Vector3());
  useFrame(({ clock }) => {
    const descent = descentRef.current;
    const p = maxDescent > 0 ? descent / maxDescent : 0; // 0..1 phase
    const z = camZ(p);
    const yaw = yawRef ? yawRef.current : 0;

    if (reduced) {
      camera.position.set(0, 0, z);
      camera.lookAt(0, 0, -PLANE_Z);
      return;
    }

    const t = clock.getElapsedTime();
    // Slow, small breathing sway — a gentle sense of hovering in the space, not
    // motion sickness. Constant amplitude so deeper chapters feel just as calm.
    const swayX = Math.sin(t * 0.05) * 0.35 + Math.sin(t * 0.021) * 0.2;
    const swayY = Math.cos(t * 0.04) * 0.18;
    const bob = Math.sin(t * 0.045) * 0.5;

    const targetX = pointer.x * parallax.x + swayX;
    const targetY = pointer.y * parallax.y + swayY;
    const targetZ = z + bob;

    // Very soft easing — the camera glides, it never snaps to position.
    camera.position.x += (targetX - camera.position.x) * 0.02;
    camera.position.y += (targetY - camera.position.y) * 0.02;
    camera.position.z += (targetZ - camera.position.z) * 0.02;

    // Gaze into the corridor, rotated horizontally by yaw to look left/right.
    // `forward` is the positive distance ahead to the plane; we swing that vector
    // about the camera by yaw. (Camera z is >= plane z, so this stays positive.)
    const forward = camera.position.z + PLANE_Z;
    const lookX = camera.position.x + Math.sin(yaw) * forward + pointer.x * 0.6;
    const lookZ = camera.position.z - Math.cos(yaw) * forward;
    const lookY = camera.position.y * 0.25;
    scratch.current.set(lookX, lookY, lookZ);
    lookAt.current.lerp(scratch.current, 0.05);
    camera.lookAt(lookAt.current);
  });
  return null;
}

// Everything that needs the artwork, or the aspect derived from it. Loading every
// chapter's pair up front means chapter changes never hitch mid-tour, and the entry
// veil's useProgress gate covers the whole descent rather than just the first scene.
function Diorama({
  art, relief, depthGamma, overscan, chapters, descentRef, accentRef, reduced, aspect: aspectOverride,
}) {
  const paths = useMemo(() => art.flatMap((a) => [a.color, a.depth]), [art]);
  const textures = useTexture(paths);

  const pairs = useMemo(() => {
    const out = [];
    for (let i = 0; i < textures.length; i += 2) {
      const color = textures[i];
      const depth = textures[i + 1];
      color.colorSpace = THREE.SRGBColorSpace;
      color.wrapS = color.wrapT = THREE.ClampToEdgeWrapping;
      depth.wrapS = depth.wrapT = THREE.ClampToEdgeWrapping;
      out.push({ color, depth });
    }
    return out;
  }, [textures]);

  // Per-chapter overrides fall back to the scene defaults.
  const reliefs = useMemo(() => art.map((a) => a.relief ?? relief), [art, relief]);
  const gammas = useMemo(() => art.map((a) => a.depthGamma ?? depthGamma), [art, depthGamma]);

  // Take the plane's proportions from the artwork itself. Hardcoding this is how the
  // scene ended up rendering 21:9 art on a 16:9 plane, squashed to ~77% width.
  const aspect = useMemo(() => {
    if (aspectOverride) {
      return aspectOverride;
    }
    const img = pairs[0]?.color?.image;
    return img?.height ? img.width / img.height : 3360 / 1440;
  }, [pairs, aspectOverride]);

  return (
    <>
      <Relief
        pairs={pairs} reliefs={reliefs} gammas={gammas} aspect={aspect}
        overscan={overscan} reduced={reduced} descentRef={descentRef}
      />
      <Fog depth={PLANE_Z + 3} y={-0.58} opacity={0.14} scale={1.5} aspect={aspect} index={0} descentRef={descentRef} />
      <Fog depth={PLANE_Z - 6} y={-0.62} opacity={0.20} scale={1.2} aspect={aspect} index={1} descentRef={descentRef} />
      <LightShafts aspect={aspect} accentRef={accentRef} reduced={reduced} />
      <Motes aspect={aspect} reduced={reduced} descentRef={descentRef} />
      <Glow aspect={aspect} accentRef={accentRef} reduced={reduced} />
      <PortalRings accentRef={accentRef} descentRef={descentRef} chapters={chapters} />
    </>
  );
}

export default function DioramaScene({
  // One { color, depth } pair per chapter, in descent order. Each may also carry its
  // own `relief` / `depthGamma` when its depth map wants different shaping.
  art,
  // Optional. Left unset, the plane takes its proportions from the artwork.
  aspect,
  relief = 4.8,
  depthGamma = 1.0,
  // Generous overscan so the relief extends well beyond the frame edges — this is
  // what gives room to pan the gaze left/right without revealing the dark border.
  overscan = 1.9,
  parallax = { x: 0.9, y: 0.45 },
  chapters = 4,
  descentRef,
  accentRef,
  yawRef,
  reduced = false,
}) {
  return (
    <Canvas
      camera={{ fov: FOV, position: [0, 0, 0], near: 0.1, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#15120d']} />
      {/* The rig needs no artwork, so the camera keeps drifting while textures stream. */}
      <DescentRig descentRef={descentRef} maxDescent={chapters - 1} yawRef={yawRef} parallax={parallax} reduced={reduced} />
      <Suspense fallback={null}>
        <Diorama
          art={art} aspect={aspect} relief={relief} depthGamma={depthGamma}
          overscan={overscan} chapters={chapters}
          descentRef={descentRef} accentRef={accentRef} reduced={reduced}
        />
      </Suspense>
    </Canvas>
  );
}

export { STEP_DEPTH };
