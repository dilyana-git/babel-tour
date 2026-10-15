// ── The world's sound ────────────────────────────────────────────────────────
// The world tour was silent: the sound was the plate tour's, and stayed with
// it. This drives the same engine (ambientSound.js — made, not recorded; no
// audio files) from the world:
//
//   the room     each gallery rests on its own low note, the Library's falling
//                to the Vertigo and the garden's climbing out of it, and the
//                air opens with leaves beyond the Door; on a walk between two
//                rooms the one slides into the other.
//   the feet     a footfall every stride the eye actually travels (World says
//                where the eye is; nothing here knows why it moved), on what
//                the body says is under it: stone, the Pavilion's timber, the
//                Fork's gravel, grass. Heard in the room: the Echo answers,
//                the Silence is quieter than quiet, the garden has no walls.
//   the qin      at the Pavilion's table, a string plucked now and then — "a
//                high-pitched, almost syllabic music approached and receded
//                in the shifting of the wind, dimmed by leaves and distance."
//                Louder the nearer the reader stands, to the side it is on,
//                and coming and going on a slow wind of its own.
//
// Nothing sounds until the reader has touched something (a browser will not
// start sound before that), so the opening draws in silence. ?wsound=off: none.
import { useCallback, useEffect, useRef, useState } from 'react';
import AmbientSound from './ambientSound';
import { NODES } from './catalogue';
import { PAVILION } from './world/gardenPlan';
import { PavilionMusic } from './pavilionMusic';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const SOUND_OFF = Q.get('wsound') === 'off'
  || typeof window === 'undefined' || !(window.AudioContext || window.webkitAudioContext);

const MUTE_KEY = 'babel.mute';
// World.jsx's own: a stride is 7.5 (about 70 cm), a walk 18 a second.
const STRIDE = 7.5;
const WALK = 18;
const LIBRARY_LAST = 3;

// What the body calls the floor (the collider's mesh, body.js) → what it
// sounds like. Anything not named here is stone, which nearly all of it is.
const GROUND = {
  grass: 'grass', bank: 'grass',
  gravel: 'gravel', mazeFloor: 'gravel',
  deck: 'timber', wood: 'timber', lacquer: 'timber', pavilionThreshold: 'timber', pavilionStep: 'timber',
  water: null,
};

// The qin carries across the pond from the Pavilion itself.
const QIN_NEAR = 120;

export function useWorldSound({ on, place, target, finale, finalePhase, feetRef }) {
  const [muted, setMuted] = useState(() => {
    try { return window.sessionStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
  });
  const engineRef = useRef(null);
  const now = useRef({ place, target, finale, finalePhase, muted });
  useEffect(() => {
    now.current = { place, target, finale, finalePhase, muted };
  }, [place, target, finale, finalePhase, muted]);

  // Started by the reader's first touch of anything.
  useEffect(() => {
    if (!on || SOUND_OFF) return undefined;
    const start = () => {
      if (engineRef.current) return;
      const engine = new AmbientSound();
      engine.setMuted(now.current.muted);
      engine.start();
      engineRef.current = engine;
      if (import.meta.env.DEV) window.__sound = engine;
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [on]);

  useEffect(() => {
    if (!on || SOUND_OFF) return undefined;
    let raf = 0, last = performance.now();
    let station = null, was = null, walked = 0, said = {};
    const music = new PavilionMusic();
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const engine = engineRef.current;
      if (!engine?.ctx || dt <= 0) return;
      const s = now.current, f = feetRef.current;

      // The room: the one stood in, sliding toward the one walked to.
      const want = s.target ?? s.place;
      if (want !== null && want !== undefined) station = station === null ? want : station + (want - station) * (1 - Math.exp(-dt / 2.2));
      if (station !== null) {
        engine.setStation(station);
        engine.setDescent(Math.min(station, LIBRARY_LAST) / LIBRARY_LAST);
        engine.setGarden(Math.min(Math.max(station - LIBRARY_LAST, 0), 1));
        engine.setRoom(NODES[Math.round(station)].slug);
      }
      engine.setPresence(f?.eye ?? 0);

      // The crossings that are not walks: the fall down the Vertigo's well is
      // a long rush of air, and the heart of the maze opens on a breath and,
      // as the eye rises over the lit walk, a quiet bloom.
      const falling = s.place === LIBRARY_LAST && s.target === LIBRARY_LAST + 1;
      if (falling && !said.fall) engine.swell(6.2, 0.09, 1.6);
      if (s.finale === 'play' && !said.finale) engine.swell(3, 0.05, 2);
      if (s.finalePhase === 'rise' && said.phase !== 'rise') engine.announce();
      said = { fall: falling, finale: s.finale === 'play', phase: s.finalePhase };

      // The feet: a footfall each stride the eye travels along the ground,
      // down among the walls — not over the map, not falling, not carried
      // round by the film.
      const afoot = f && f.eye > 0.98 && !falling && (s.finale === null || s.finalePhase === 'walk' || s.finalePhase === null);
      if (afoot && was) {
        const along = Math.hypot(f.x - was.x, f.z - was.z), drop = Math.abs(f.y - was.y);
        const speed = along / dt;
        if (along < 6 && drop < along + 0.6 && speed > 2) {
          walked += along;
          if (walked >= STRIDE) {
            walked -= STRIDE;
            const what = f.feel?.ground(f.x, f.y, f.z).what ?? '';
            const surface = what in GROUND ? GROUND[what] : 'stone';
            if (surface) engine.step(Math.min(1, 0.55 + 0.45 * (speed / WALK)), surface);
          }
        } else if (along >= 6) walked = 0;
      }
      was = afoot ? { x: f.x, y: f.y, z: f.z } : null;

      // The composed passage remains in one place while the listener moves.
      // Its gain and bearing follow the listener even during a ringing note.
      let level = 0, pan = 0;
      if (station !== null && station > LIBRARY_LAST + 0.5 && f && f.eye > 0.98 && s.finale === null) {
        const tx = PAVILION[0] - f.x, tz = PAVILION[1] - f.z, far = Math.hypot(tx, tz);
        const near = 1 / (1 + (far / QIN_NEAR) ** 2);
        const wind = 0.85 + 0.15 * Math.sin(t * 0.00021) * Math.sin(t * 0.000083 + 1.7);
        level = near * wind;
        pan = Math.max(-0.7, Math.min(0.7, ((f.fx * tz - f.fz * tx) / (far || 1)) * 0.7));
      }
      music.update(engine, { level, pan, dt });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, feetRef]);

  const toggle = useCallback(() => {
    const next = !now.current.muted;
    now.current.muted = next;
    engineRef.current?.setMuted(next);
    try { window.sessionStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* this visit only */ }
    setMuted(next);
  }, []);

  return { muted, toggle, off: SOUND_OFF };
}
