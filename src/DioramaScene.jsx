// TODO(beauty-12): descent grading — drive uExposure + fog color from descentRef so
// light genuinely dims/cools toward The Silence; shrink the lamp Glow to an ember.
// TODO(beauty-13): postprocessing — EffectComposer with Noise (film grain ~0.05,
// hides banding in the dark gradients), Vignette (offset ~0.3, darkness ~0.65),
// Bloom (high threshold so only the corridor core blooms), GodRays anchored to a
// small emissive disc at the glowing door (~[0.53, 0.55] of frame, just in front of
// the relief's deepest point), intensity rising as descent approaches max.
// TODO(beauty-14): gl powerPreference 'high-performance'; drop plane segments to
// ~[420, 236] on coarse-pointer devices.
// TODO(beauty-15): SCENE textures — switch to .webp once converted.
import { useRef, useMemo } from 'react';
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

const paintingVert = /* glsl */`
  uniform sampler2D depthMap;
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
    float d = texture2D(depthMap, uv).r;
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
  uniform sampler2D map;
  uniform float uTime;
  uniform float uBreath;
  uniform vec3 uFogColor;
  varying vec2 vUv;
  varying float vDepth;
  varying float vFog;
  void main() {
    vec4 tex = texture2D(map, vUv);
    float pulse = 0.5 + 0.5 * sin(uTime * 0.35 + vDepth * 3.14159);
    tex.rgb += tex.rgb * pulse * 0.05 * uBreath * smoothstep(0.2, 1.0, vDepth);
    float fog = vFog * vFog;
    tex.rgb = mix(tex.rgb, uFogColor, fog * 0.85);
    gl_FragColor = tex;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function Painting({ color, depth, aspect, relief, depthGamma, overscan, reduced }) {
  const ref = useRef();
  const [colorMap, depthMap] = useTexture([color, depth], (texes) => {
    texes[0].colorSpace = THREE.SRGBColorSpace;
    texes.forEach((t) => (t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping));
  });

  const { geo, mat } = useMemo(() => {
    const h = frustumH(PLANE_Z) * overscan;
    const w = h * aspect;
    return {
      geo: new THREE.PlaneGeometry(w, h, 700, 394),
      mat: new THREE.ShaderMaterial({
        uniforms: {
          map: { value: colorMap },
          depthMap: { value: depthMap },
          relief: { value: relief },
          depthGamma: { value: depthGamma },
          uTime: { value: 0 },
          uBreath: { value: reduced ? 0 : 1 },
          uFogNear: { value: PLANE_Z - relief * 0.5 },
          uFogFar: { value: PLANE_Z + relief * 1.6 },
          uFogColor: { value: new THREE.Color('#15120d') },
        },
        vertexShader: paintingVert,
        fragmentShader: paintingFrag,
      }),
    };
  }, [colorMap, depthMap, aspect, relief, depthGamma, overscan, reduced]);

  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.getElapsedTime();
  });

  return <mesh ref={ref} geometry={geo} material={mat} position={[0, 0, -PLANE_Z]} renderOrder={1} />;
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

export default function DioramaScene({
  color,
  depth,
  aspect = 2944 / 1648,
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
      <Painting
        color={color} depth={depth} aspect={aspect}
        relief={relief} depthGamma={depthGamma}
        overscan={overscan} reduced={reduced}
      />
      <Fog depth={PLANE_Z + 3} y={-0.58} opacity={0.14} scale={1.5} aspect={aspect} index={0} descentRef={descentRef} />
      <Fog depth={PLANE_Z - 6} y={-0.62} opacity={0.20} scale={1.2} aspect={aspect} index={1} descentRef={descentRef} />
      <LightShafts aspect={aspect} accentRef={accentRef} reduced={reduced} />
      <Motes aspect={aspect} reduced={reduced} descentRef={descentRef} />
      <Glow aspect={aspect} accentRef={accentRef} reduced={reduced} />
      <PortalRings accentRef={accentRef} descentRef={descentRef} chapters={chapters} />
      <DescentRig descentRef={descentRef} maxDescent={chapters - 1} yawRef={yawRef} parallax={parallax} reduced={reduced} />
    </Canvas>
  );
}

export { STEP_DEPTH };
