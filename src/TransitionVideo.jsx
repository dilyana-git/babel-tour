import { useEffect, useRef } from 'react';

// A single video overlay that dissolves in softly during a chapter change.
// Opacity blooms gently to a low peak (sin curve) and fades back out, blended
// over the scene so it reads as a faint atmospheric wash, never a bright pulse.
export default function TransitionVideo({
  src = '/clip.mp4',
  active = false,
  progress = 0,
  peakOpacity = 0.28,
  reduced = false,
}) {
  const ref = useRef(null);
  const wasActive = useRef(false);

  // Restart the clip from the top each time a new transition begins.
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (active && !wasActive.current) {
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    }
    if (!active && wasActive.current) {
      el.pause();
    }
    wasActive.current = active;
  }, [active]);

  // Swell in and out: 0 at the endpoints, peak at the midpoint.
  const opacity = active && !reduced ? Math.sin(progress * Math.PI) * peakOpacity : 0;

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="auto"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 20,
        pointerEvents: 'none',
        opacity,
        mixBlendMode: 'soft-light',
        transition: 'opacity 600ms ease',
      }}
    />
  );
}
