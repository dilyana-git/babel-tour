// ── ?wperf: what a frame costs, on the machine in the reader's hands ─────────
// Frame rate is part of the picture (audit III, 8·5), and the figures the
// audits had were a headless browser's, on one laptop. This is a readout for
// any machine, in the built piece as well as the dev one: open the page with
// ?wperf and it writes, once a second, top left,
//
//   IV · 21.4 ms (47 fps) · dpr 1.25 · 2.3 M tris · 410 calls · 2.1 passes
//
// — the room stood in (or "map"), the MEDIAN frame of the last second (a
// median, as the governor judges: one late frame is not the frame rate), the
// pixel ratio the governor has it at, and what the renderer was handed for a
// frame: triangles and draw calls over every pass, and how many times the
// scene itself was drawn (the pond's reflection, a pier glass and the open
// doorway each draw it again). Triangles and calls do not depend on the
// machine; milliseconds are the machine's.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const PERF = Q.has('wperf');

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export default function Perf({ feetRef }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const box = useRef(null);
  const tally = useRef({ ms: [], tris: 0, calls: 0, passes: 0, frames: 0, at: 0 });

  useEffect(() => {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:10px;top:10px;z-index:99;padding:4px 8px;border-radius:4px;'
      + 'background:rgba(8,6,5,.78);color:#ece4d2;font:500 12px/1.4 ui-monospace,Consolas,monospace;'
      + 'pointer-events:none;white-space:nowrap';
    document.body.append(el);
    box.current = el;
    gl.info.autoReset = false;
    const was = scene.onBeforeRender;
    scene.onBeforeRender = (...args) => {
      tally.current.passes += 1;
      was?.apply(scene, args);
    };
    return () => {
      el.remove();
      gl.info.autoReset = true;
      scene.onBeforeRender = was;
    };
  }, [gl, scene]);

  // (before the frame is drawn: what the renderer counted is the frame before's)
  useFrame((_, delta) => {
    const t = tally.current, now = performance.now();
    t.ms.push(delta * 1000);
    t.tris += gl.info.render.triangles;
    t.calls += gl.info.render.calls;
    t.frames += 1;
    gl.info.reset();
    if (now - t.at < 1000) return;
    const ms = t.ms.sort((a, b) => a - b)[Math.floor(t.ms.length / 2)];
    const room = feetRef?.current?.room;
    const line = `${room === null || room === undefined ? 'map' : ROMAN[room] ?? room} · ${ms.toFixed(1)} ms (${Math.round(1000 / ms)} fps)`
      + ` · dpr ${gl.getPixelRatio().toFixed(2)} · ${(t.tris / t.frames / 1e6).toFixed(1)} M tris`
      + ` · ${Math.round(t.calls / t.frames)} calls · ${(t.passes / t.frames).toFixed(1)} passes`;
    if (box.current) box.current.textContent = line;
    window.__perf = line;
    Object.assign(t, { ms: [], tris: 0, calls: 0, passes: 0, frames: 0, at: now });
  });
  return null;
}
