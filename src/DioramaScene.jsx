// TODO(beauty-13): postprocessing — EffectComposer with Noise (film grain ~0.05,
// hides banding in the dark gradients), Vignette (offset ~0.3, darkness ~0.65),
// Bloom (high threshold so only the lamp cores bloom).
// TODO(beauty-14): gl powerPreference 'high-performance'; drop plane segments to
// ~[420, 200] on coarse-pointer devices.
import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const FOV = 55;
const frustumH = (dist) => 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));

// ---------------------------------------------------------------------------
// Shared depth model — a descent through stacked galleries.
//
// Each chapter is its own relief painting (color + depth pair), hung one behind
// the other along -Z like veils in a theatre. The camera dwells PLANE_Z in
// front of the active gallery; descending pushes it toward that relief, which
// dissolves depth-first — near stone melting away with a glowing rim — while
// the next gallery surfaces out of the fog behind it. `descentRef.current` is
// a continuous float in [0, chapters-1]; scene i is the dwelling place at
// descent == i.
// ---------------------------------------------------------------------------

// Distance the camera keeps from the gallery it currently dwells before.
const PLANE_Z = 26;
// Gap between consecutive gallery planes — also how far the camera travels
// per chapter. Kept well short of PLANE_Z so the camera never reaches a relief:
// the veil dissolves long before contact.
const SCENE_SPACING = 14;
// Camera world-z for a continuous descent value.
const camZ = (descent) => -descent * SCENE_SPACING;
// World-z of gallery plane i.
const planeZ = (i) => -(PLANE_Z + i * SCENE_SPACING);

// Plane tessellation. Fine enough that the depth relief reads as smooth stone.
const SEG_X = 600;
const SEG_Y = 280;

const paintingVert = /* glsl */`
  uniform sampler2D depthMap;
  uniform float relief;
  uniform float depthGamma;
  uniform float uTime;
  uniform float uBreath;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uNearKnee;    // depth above which the nearest relief is eased off
  uniform float uNearSquash;  // how hard that nearest band is compressed (1 = off)
  varying vec2 vUv;
  varying float vDepth;
  varying float vFog;
  // Ease only the very nearest depths back toward the knee. Foreground rails,
  // rings and chains sit at a hard depth cliff against the far pit; left at full
  // relief they pop so far forward that the flat plane can only span the gap by
  // stretching a triangle edge-on toward the camera — the molten "rubber-sheet"
  // smear. Pulling the nearest band back shortens that span at the source. The
  // squash fades in smoothly from the knee to white (no crease where the relief
  // crosses the knee) and leaves the galleries' own depth, below the knee,
  // untouched — so the descent keeps its drama while the smears mostly close up.
  float relief_remap(float x) {
    float t = smoothstep(uNearKnee, 1.0, x);
    return mix(x, uNearKnee + (x - uNearKnee) * uNearSquash, t);
  }
  void main() {
    vUv = uv;
    float d = relief_remap(pow(texture2D(depthMap, uv).r, depthGamma));
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
  uniform sampler2D mapVideo;
  uniform float uLive;
  uniform float uTime;
  uniform float uBreath;
  uniform float uFade;
  uniform vec3 uAccent;
  uniform vec3 uFogColor;
  varying vec2 vUv;
  varying float vDepth;
  varying float vFog;
  void main() {
    vec4 tex = texture2D(map, vUv);
    // The living surface: while the camera dwells here, the still painting
    // exhales into its own image-to-video render — same artwork, in motion —
    // and inhales back to stillness as the camera leaves.
    if (uLive > 0.001) {
      tex = mix(tex, texture2D(mapVideo, vUv), uLive);
    }
    float pulse = 0.5 + 0.5 * sin(uTime * 0.35 + vDepth * 3.14159);
    tex.rgb += tex.rgb * pulse * 0.05 * uBreath * smoothstep(0.2, 1.0, vDepth);

    // Distance fog: deeper galleries sink into the corridor's darkness and
    // surface again as the camera nears them.
    float fog = pow(vFog, 1.6);
    tex.rgb = mix(tex.rgb, uFogColor, fog);

    // Depth-ordered dissolve. As uFade rises the threshold sweeps from the
    // nearest stone (depth 1) back into the image, so the gallery melts away
    // front-first — like pushing through a curtain of masonry. A thin rim at
    // the melt line catches the chapter accent, an ember edge on the stone.
    float th = 1.12 - uFade * 1.72;
    float alpha = 1.0 - smoothstep(th - 0.10, th + 0.10, vDepth);
    float envelope = smoothstep(0.0, 0.12, uFade) * (1.0 - smoothstep(0.82, 1.0, uFade));
    float rim = smoothstep(th - 0.14, th - 0.03, vDepth) * (1.0 - smoothstep(th - 0.03, th + 0.08, vDepth));
    tex.rgb += uAccent * rim * envelope * 0.3;

    gl_FragColor = vec4(tex.rgb, tex.a * alpha);
    if (gl_FragColor.a < 0.004) discard;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// One gallery relief. `index` fixes its station along the corridor; its own
// useFrame drives the dissolve as the camera crosses it and keeps its fog
// color in step with the graded background. If the artwork has a `video`
// (an image-to-video render of this exact image), the surface wakes into it
// while the camera is near and settles back to the still when it leaves.
function Painting({
  color, depth, video, videoRate = 1, index, chapters, aspect, relief, depthGamma, overscan,
  reduced, descentRef, accentRef, fogRef,
}) {
  const mesh = useRef();
  // el: the <video>; tex: its VideoTexture; playing: true while it is running
  // through its single pass; ended: true once that pass finished (the surface
  // holds on the last frame, then settles to the still); armed: whether a new
  // arrival is allowed to trigger a play (re-armed each time the camera leaves).
  const live = useRef({ el: null, tex: null, playing: false, ended: false, armed: true });
  const [colorMap, depthMap] = useTexture([color, depth], (texes) => {
    texes[0].colorSpace = THREE.SRGBColorSpace;
    texes.forEach((t) => (t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping));
  });

  const { geo, mat } = useMemo(() => {
    const h = frustumH(PLANE_Z) * overscan;
    const w = h * aspect;
    return {
      geo: new THREE.PlaneGeometry(w, h, SEG_X, SEG_Y),
      mat: new THREE.ShaderMaterial({
        uniforms: {
          map: { value: colorMap },
          // Placeholder until the video's first frame is decodable; uLive
          // stays 0 until then, so the sampler is never visibly wrong.
          mapVideo: { value: colorMap },
          uLive: { value: 0 },
          depthMap: { value: depthMap },
          relief: { value: relief },
          depthGamma: { value: depthGamma },
          uTime: { value: 0 },
          uBreath: { value: reduced ? 0 : 1 },
          uFade: { value: 0 },
          uAccent: { value: new THREE.Color('#c9a24c') },
          // Foreground-smear tamer: ease the nearest depths (rings, chains, near
          // rails) back toward the knee so their silhouettes tear into shorter
          // smears; below the knee the galleries keep full relief.
          uNearKnee: { value: 0.6 },
          uNearSquash: { value: 0.4 },
          uFogNear: { value: PLANE_Z - relief * 0.5 },
          // Far enough that the next gallery already breathes faintly through
          // the fog while you dwell — the corridor visibly continues, so a
          // crossing reads as approach rather than apparition.
          uFogFar: { value: PLANE_Z + SCENE_SPACING * 1.6 },
          uFogColor: { value: new THREE.Color('#15120d') },
        },
        vertexShader: paintingVert,
        fragmentShader: paintingFrag,
        transparent: true,
      }),
    };
  }, [colorMap, depthMap, aspect, relief, depthGamma, overscan, reduced]);

  // Release the video and its texture with the painting.
  useEffect(() => {
    const state = live.current;
    return () => {
      if (state.el) {
        state.el.pause();
        state.el.removeAttribute('src');
        state.el.load();
        state.el.remove();
      }
      if (state.tex) {
        state.tex.dispose();
      }
    };
  }, []);

  useFrame(({ clock }, delta) => {
    const descent = descentRef.current;
    // f > 0 once the camera has begun crossing this gallery.
    const f = descent - index;
    const fade = THREE.MathUtils.smoothstep(f, 0.05, 0.82);
    mat.uniforms.uTime.value = clock.getElapsedTime();
    mat.uniforms.uFade.value = fade;
    mat.uniforms.uAccent.value.copy(accentRef.current);
    mat.uniforms.uFogColor.value.copy(fogRef.current);
    // Skip galleries fully dissolved behind us or still buried in full fog
    // ahead — at most two or three reliefs render at once.
    mesh.current.visible = f < 0.96 && index - descent < 1.4;

    if (video && !reduced) {
      const dist = Math.abs(descent - index);
      const state = live.current;
      // Begin streaming while still a gallery away, so the surface is ready
      // to wake the moment the camera arrives.
      if (!state.el && dist < 1.8) {
        const el = document.createElement('video');
        el.src = video;
        el.muted = true;
        el.loop = false; // one pass only — the surface animates, then holds
        el.playsInline = true;
        el.preload = 'auto';
        el.playbackRate = videoRate; // <1 stretches the pass into a slow drift
        el.style.display = 'none';
        el.addEventListener('ended', () => {
          state.playing = false;
          state.ended = true;
        });
        document.body.appendChild(el);
        state.el = el;
      }
      if (state.el) {
        // On arrival, play the clip once. `armed` gates it to a single pass
        // per visit; leaving re-arms it so a return replays the awakening.
        if (state.armed && !state.playing && !state.ended && dist < 0.9) {
          state.armed = false;
          state.playing = true;
          state.el.currentTime = 0;
          state.el.playbackRate = videoRate; // reassert (load can reset it)
          const p = state.el.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => { state.playing = false; });
          }
        }
        // Once the camera has clearly left, reset to a still and re-arm so the
        // next arrival can wake it again from its first frame.
        if (dist > 1.1 && (state.playing || state.ended || !state.armed)) {
          state.playing = false;
          state.ended = false;
          state.armed = true;
          state.el.pause();
        }
        if (!state.tex && state.el.readyState >= state.el.HAVE_CURRENT_DATA) {
          state.tex = new THREE.VideoTexture(state.el);
          state.tex.colorSpace = THREE.SRGBColorSpace;
          state.tex.wrapS = state.tex.wrapT = THREE.ClampToEdgeWrapping;
          mat.uniforms.mapVideo.value = state.tex;
        }
      }
      // The still exhales into motion while the single pass runs; the moment
      // it ends (or the camera leaves) it settles gently back to the painting.
      const awake = state.tex && state.playing ? 1 : 0;
      const u = mat.uniforms.uLive;
      u.value += (awake - u.value) * Math.min(delta * 0.7, 1);
    }
  });

  return (
    <mesh
      ref={mesh}
      geometry={geo}
      material={mat}
      position={[0, 0, planeZ(index)]}
      // Painted back-to-front so a dissolving veil blends over the gallery
      // emerging behind it.
      renderOrder={1 + (chapters - index)}
    />
  );
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
// the more alive and thick the air becomes. Lives inside the atmosphere rig,
// so its coordinates are camera-relative.
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
    <mesh ref={ref} position={[0, y * h * 0.5, -depth]} renderOrder={7}>
      <planeGeometry args={[h * aspect * scale, h * 0.5 * scale]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity}
        blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

// Each gallery hangs its own lamp: an additive glow pinned to that image's
// light source (a doorway of fire, a lantern, a moonlit shaft…). It breathes
// and flickers while its chapter is current and dims away with distance.
function Glow({ scene, index, aspect, overscan, accentRef, descentRef, reduced }) {
  const ref = useRef();
  const { pointer } = useThree();
  const sprite = useMemo(
    () => radialTexture([
      [0, 'rgba(236,228,210,1)'],
      [0.3, 'rgba(201,162,76,0.85)'],
      [1, 'rgba(201,162,76,0)'],
    ]), []);
  const h = frustumH(PLANE_Z) * overscan;
  const w = h * aspect;
  const [u, v] = scene.glowAt;
  const restX = (u - 0.5) * w;
  const restY = (0.5 - v) * h;
  const base = frustumH(PLANE_Z) * 0.4;
  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(descentRef.current - index) * 1.5);
    ref.current.visible = proximity > 0.001;
    if (!ref.current.visible) {
      return;
    }
    const t = clock.getElapsedTime();
    const flicker =
      Math.sin(t * 0.5) * 0.06 +
      Math.sin(t * 1.7 + 1.1) * 0.03 +
      Math.sin(t * 4.3 + 0.4) * 0.015;
    const px = reduced ? restX : restX + pointer.x * w * 0.12;
    const py = reduced ? restY : restY + pointer.y * h * 0.12;
    ref.current.position.x += (px - ref.current.position.x) * 0.05;
    ref.current.position.y += (py - ref.current.position.y) * 0.05;
    const near = reduced ? 0 : Math.max(0, 0.12 - Math.abs(pointer.x) * 0.06 - Math.abs(pointer.y) * 0.06);
    ref.current.material.opacity = (0.27 + flicker + near) * proximity;
    const s = (1 + Math.sin(t * 0.9) * 0.04 + near * 0.8) * scene.glowScale;
    ref.current.scale.set(base * s, base * s, 1);
    ref.current.material.color.lerp(accentRef.current, 0.05);
  });
  return (
    <sprite
      ref={ref}
      position={[restX, restY, planeZ(index) + 2]}
      scale={[base, base, 1]}
      renderOrder={6}
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
    <group ref={group} renderOrder={6}>
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

// A ring of light suspended in each gap between galleries; the camera slips
// through one mid-transition, just as the dissolving veil clears — a hushed
// threshold between chapters. It stays dark while the camera dwells.
function PortalRings({ accentRef, descentRef, chapters }) {
  const group = useRef();
  // Ring i hangs a little past the midpoint of gap i; the camera crosses its
  // plane at this descent value.
  const passAt = (i) => i + 0.5 + 4 / SCENE_SPACING;
  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }
    const t = clock.getElapsedTime();
    const descent = descentRef.current;
    group.current.children.forEach((ring, i) => {
      ring.rotation.z = t * 0.08 + i;
      // Lights only around the crossing, fully out by the time the camera rests.
      const proximity = Math.max(0, 1 - Math.abs(descent - passAt(i)) * 2.8);
      ring.material.opacity = 0.03 + proximity * 0.32;
      ring.material.color.lerp(accentRef.current, 0.05);
      ring.scale.setScalar(1 + proximity * 0.12);
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: chapters - 1 }, (_, i) => (
        <mesh key={i} position={[0, 0, -(SCENE_SPACING * (i + 0.5) + 4)]} renderOrder={5}>
          <torusGeometry args={[3.4, 0.05, 16, 120]} />
          <meshBasicMaterial transparent opacity={0.08} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// Carries the ambient layers (dust, ground fog, light shafts) along with the
// camera so the air travels down the corridor with you.
function AtmosphereRig({ descentRef, children }) {
  const group = useRef();
  useFrame(() => {
    group.current.position.z = camZ(descentRef.current);
  });
  return <group ref={group}>{children}</group>;
}

// Grades the corridor's darkness itself: the background and the shared fog
// color drift between each chapter's mood — warm candle-brown at the threshold,
// cooling toward moonlit blue-black in the vertigo, settling to ash at the
// silence. Every painting fogs toward this same color, so distant galleries
// melt seamlessly into the void.
function GradeRig({ scenes, descentRef, fogRef }) {
  const { scene } = useThree();
  const fogs = useMemo(() => scenes.map((s) => new THREE.Color(s.fog)), [scenes]);
  useFrame(() => {
    const cur = descentRef.current;
    const lo = Math.max(0, Math.min(Math.floor(cur), fogs.length - 1));
    const hi = Math.min(lo + 1, fogs.length - 1);
    fogRef.current.copy(fogs[lo]).lerp(fogs[hi], cur - lo);
    if (scene.background && scene.background.isColor) {
      scene.background.copy(fogRef.current);
    } else {
      scene.background = fogRef.current.clone();
    }
  });
  return null;
}

// The camera rig: a slow, atmospheric dwell that presses deeper with each
// chapter. Gazes into the corridor and can pan left/right (yaw) to look
// around. Never rushes.
function DescentRig({ descentRef, yawRef, parallax, reduced }) {
  const { camera, pointer } = useThree();
  const lookAt = useRef(new THREE.Vector3(0, 0, -PLANE_Z));
  const scratch = useRef(new THREE.Vector3());
  useFrame(({ clock }, delta) => {
    const z = camZ(descentRef.current);
    const yaw = yawRef ? yawRef.current : 0;

    if (reduced) {
      camera.position.set(0, 0, z);
      camera.lookAt(0, 0, z - PLANE_Z);
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
    // Wall-clock based so the glide is identical on every refresh rate.
    const ease = 1 - Math.exp(-Math.min(delta, 0.1) * 1.2);
    camera.position.x += (targetX - camera.position.x) * ease;
    camera.position.y += (targetY - camera.position.y) * ease;
    camera.position.z += (targetZ - camera.position.z) * ease;

    // Gaze down the corridor, rotated horizontally by yaw to look left/right.
    // The active gallery always dwells ~PLANE_Z ahead, so a constant forward
    // reach keeps the gaze steady through every chapter.
    const lookX = camera.position.x + Math.sin(yaw) * PLANE_Z + pointer.x * 0.6;
    const lookZ = camera.position.z - Math.cos(yaw) * PLANE_Z;
    const lookY = camera.position.y * 0.25;
    scratch.current.set(lookX, lookY, lookZ);
    lookAt.current.lerp(scratch.current, 1 - Math.exp(-Math.min(delta, 0.1) * 3));
    camera.lookAt(lookAt.current);
  });
  return null;
}

export default function DioramaScene({
  scenes,
  aspect = 3376 / 1440,
  // Depth-displacement strength. The artwork already reads as deep, so the mesh
  // relief only adds parallax on top — and the smear a near silhouette drags
  // across the void grows directly with it. These plates hang thin dark chains
  // and rings against lit stone (the worst case), which streak into rubber-sheet
  // smears at any strong displacement, so this is kept gentle. Raise toward ~2
  // for more sculptural pop at the cost of those silhouettes smearing again.
  relief = 1.0,
  depthGamma = 1.0,
  // Overscan keeps the relief past the frame edges so panning the gaze never
  // reveals the dark border — but stays modest so each artwork's whole
  // composition (the fire door, the spiral pit, the far lamp) reads in frame.
  overscan = 1.35,
  parallax = { x: 0.9, y: 0.45 },
  descentRef,
  accentRef,
  yawRef,
  reduced = false,
}) {
  const chapters = scenes.length;
  // Shared, per-frame graded fog color (GradeRig writes, paintings read).
  const fogRef = useRef(new THREE.Color(scenes[0].fog));
  return (
    <Canvas
      camera={{ fov: FOV, position: [0, 0, 0], near: 0.1, far: 240 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[scenes[0].fog]} />
      <GradeRig scenes={scenes} descentRef={descentRef} fogRef={fogRef} />
      {scenes.map((scene, i) => (
        <Painting
          key={`painting-${i}`}
          color={scene.color} depth={scene.depth} video={scene.video}
          videoRate={scene.videoRate}
          index={i} chapters={chapters} aspect={aspect}
          relief={relief} depthGamma={depthGamma} overscan={overscan}
          reduced={reduced} descentRef={descentRef}
          accentRef={accentRef} fogRef={fogRef}
        />
      ))}
      {scenes.map((scene, i) => (
        <Glow
          key={`glow-${i}`}
          scene={scene} index={i} aspect={aspect} overscan={overscan}
          accentRef={accentRef} descentRef={descentRef} reduced={reduced}
        />
      ))}
      <PortalRings accentRef={accentRef} descentRef={descentRef} chapters={chapters} />
      <AtmosphereRig descentRef={descentRef}>
        <Fog depth={PLANE_Z + 3} y={-0.58} opacity={0.14} scale={1.5} aspect={aspect} index={0} descentRef={descentRef} />
        <Fog depth={PLANE_Z - 6} y={-0.62} opacity={0.20} scale={1.2} aspect={aspect} index={1} descentRef={descentRef} />
        <LightShafts aspect={aspect} accentRef={accentRef} reduced={reduced} />
        <Motes aspect={aspect} reduced={reduced} descentRef={descentRef} />
      </AtmosphereRig>
      <DescentRig descentRef={descentRef} yawRef={yawRef} parallax={parallax} reduced={reduced} />
    </Canvas>
  );
}
