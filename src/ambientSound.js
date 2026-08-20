// Procedural room tone for the tour — no audio assets. Brown noise breathed
// through a low-pass filter reads as air moving through the stacks; two low,
// slightly detuned sines beat slowly against each other underneath. Descent
// darkens the filter and leans on the drones, so the deep chapters *sound*
// deeper. Crossing into the garden opens the air back up: a band-passed hush
// of leaves gusts in while the stone drones recede. Everything stays very
// quiet: this is atmosphere, not soundtrack.

const NOISE_SECONDS = 8;

// ── The root of each room ────────────────────────────────────────────────────
// The drone used to sit on one fixed pair of sines for the whole tour, so every
// gallery rested on the same note and the only thing that changed with depth was
// how dark the filter was. That makes the descent a change of BRIGHTNESS and
// nothing else — the ear has no way to tell the Echo from the Vertigo, only that
// one is muddier. Giving each room its own root is what lets a reader know where
// they are with their eyes shut, which is the whole argument for having sound.
//
// Read as a line rather than as eight numbers. The library falls — A, G, F, and
// then a drop of a minor third to D for the stairwell with no floor, the lowest
// and least resolved note here. Coming through the door the garden climbs back
// out of it: G, A, B, D, ending a full octave above where the Vertigo left off.
// The descent is felt going down and the garden is felt as release, which is
// exactly what the picture and the filter are already doing.
//
// All eight are degrees of A natural minor, chosen so the rites' own tones (96,
// 147, 62 Hz, and the weave's C-major triad up top) stay consonant against every
// root they can be heard over.
const ROOTS = [
  55.00, // I    The Vestibule    A1
  49.00, // II   The Echo         G1
  43.65, // III  The Silence      F1
  36.71, // IV   The Vertigo      D1  — the floor of the piece
  49.00, // V    The Door         G1  — the climb out begins
  55.00, // VI   The Fork         A1
  61.74, // VII  The Pavilion     B1
  73.42, // VIII The Web of Time   D2
];
// The second sine sits this much above the first, so the two beat against each
// other. Proportional rather than a fixed offset in Hz, which means the beat
// slows as the rooms get lower — about one every three seconds in the Vestibule,
// one every five in the Vertigo. Deep rooms breathe more slowly; that falls out
// of the arithmetic rather than needing a table of its own.
const DETUNE = 1 + 0.3 / 55;

function brownNoiseBuffer(ctx) {
  const length = ctx.sampleRate * NOISE_SECONDS;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  // Taper both ends into silence so the loop seam never clicks.
  const taper = Math.floor(ctx.sampleRate * 0.25);
  for (let i = 0; i < taper; i++) {
    const g = i / taper;
    data[i] *= g;
    data[length - 1 - i] *= g;
  }
  return buffer;
}

// White noise for the garden's leaves — brown noise has no energy left up
// where leaf-hiss lives. Same loop taper; the brief dip every eight seconds
// reads as the wind drawing breath.
function whiteNoiseBuffer(ctx) {
  const length = ctx.sampleRate * NOISE_SECONDS;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const taper = Math.floor(ctx.sampleRate * 0.25);
  for (let i = 0; i < taper; i++) {
    const g = i / taper;
    data[i] *= g;
    data[length - 1 - i] *= g;
  }
  return buffer;
}

export default class AmbientSound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.descent = 0; // 0 at the threshold, 1 in The Silence
    this.garden = 0;  // 0 in the library, 1 once through the door
    this.stepFoot = false;   // which foot lands next — alternates per step()
    this.scuffBuffer = null; // white noise shared with the footsteps' scuff
  }

  // Must be called from a user gesture (the entry-veil click).
  start() {
    if (this.ctx) {
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return;
    }
    const ctx = new Ctx();
    this.ctx = ctx;
    // Some browsers (iOS Safari in particular) hand back a suspended context
    // even from inside a click handler; without this there is no sound at all.
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Everything passes through `dip` on its way out. It exists for the hush:
    // the one rite whose sound is the room getting QUIETER, which cannot be
    // done on master (setMuted owns that curve) and cannot be done on the
    // individual gains either, since applyTone rewrites their .value every
    // frame and would fight any automation scheduled on them.
    this.dip = ctx.createGain();
    this.dip.gain.value = 1;
    this.dip.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 1, now + 5);
    this.master.connect(this.dip);

    // Air: looping brown noise, filtered dark, gain slowly breathing via LFO.
    const noise = ctx.createBufferSource();
    noise.buffer = brownNoiseBuffer(ctx);
    noise.loop = true;
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'lowpass';
    this.noiseFilter.frequency.setValueAtTime(320, now);
    this.noiseFilter.Q.value = 0.5;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.05;
    noise.connect(this.noiseFilter).connect(this.noiseGain).connect(this.master);
    noise.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.016;
    lfo.connect(lfoDepth).connect(this.noiseGain.gain);
    lfo.start();

    // Ground: two low sines a hair apart, beating slowly against each other.
    // Their pitch is not fixed — setStation slides it between the ROOTS above as
    // the reader walks, so each gallery rests on its own note.
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.018;
    this.droneGain.connect(this.master);
    this.droneOsc = [ROOTS[0], ROOTS[0] * DETUNE].map((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g).connect(this.droneGain);
      osc.start();
      return osc;
    });

    // A dedicated channel for chapter-change swells: the same air, one octave
    // of filter brighter, silent until swell() opens it.
    this.swellGain = ctx.createGain();
    this.swellGain.gain.value = 0;
    const swellFilter = ctx.createBiquadFilter();
    swellFilter.type = 'lowpass';
    swellFilter.frequency.value = 700;
    this.swellFilter = swellFilter; // swept open across long swells (the dive's rush)
    const swellNoise = ctx.createBufferSource();
    swellNoise.buffer = noise.buffer;
    swellNoise.loop = true;
    swellNoise.start();
    swellNoise.connect(swellFilter).connect(this.swellGain).connect(this.master);

    // Leaves: white noise band-passed to a high hush, silent until the reader
    // crosses into the garden. A very slow LFO gusts it; the gust depth is
    // scaled with the garden blend in applyTone so the library stays still.
    this.gardenGain = ctx.createGain();
    this.gardenGain.gain.value = 0;
    const leaves = ctx.createBufferSource();
    leaves.buffer = whiteNoiseBuffer(ctx);
    // Kept for the footsteps' scuff component (brown noise has no energy left
    // up where a sole brushing stone lives).
    this.scuffBuffer = leaves.buffer;
    leaves.loop = true;
    const leafFilter = ctx.createBiquadFilter();
    leafFilter.type = 'bandpass';
    leafFilter.frequency.value = 1350;
    leafFilter.Q.value = 0.7;
    leaves.connect(leafFilter).connect(this.gardenGain).connect(this.master);
    leaves.start();
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.07;
    this.gustDepth = ctx.createGain();
    this.gustDepth.gain.value = 0;
    gust.connect(this.gustDepth).connect(this.gardenGain.gain);
    gust.start();
  }

  // Both blend inputs write through one mixer so their per-frame updates
  // never fight over the same nodes.
  applyTone() {
    const d = this.descent;
    const g = this.garden;
    // The library darkens with depth; the garden opens the air back up and
    // trades the stone drones for leaf-hiss.
    this.noiseFilter.frequency.value = 320 - d * 190 + g * 320;
    this.droneGain.gain.value = (0.018 + d * 0.014) * (1 - g * 0.55);
    this.gardenGain.gain.value = g * 0.02;
    this.gustDepth.gain.value = g * 0.007;
  }

  // p in [0,1]: 0 at the threshold, 1 in The Silence. Called every frame; cheap.
  setDescent(p) {
    if (!this.ctx) {
      return;
    }
    this.descent = p;
    this.applyTone();
  }

  // p in [0,1]: 0 in the library, 1 once through the door. Called every frame.
  setGarden(p) {
    if (!this.ctx) {
      return;
    }
    this.garden = p;
    this.applyTone();
  }

  // Where the reader is standing, as the tour's own continuous descent float —
  // 0 in the Vestibule, 7 in the Web of Time, and every fraction between while a
  // crossing is under way. The drone is slid along ROOTS by it.
  //
  // Interpolated in LOG space, because pitch is logarithmic: a linear ramp
  // between two notes spends most of its time near the top and arrives with a
  // lurch, while this glides evenly and lands exactly on the next root. The
  // crossing takes about seven seconds, which is slow enough that the slide is
  // felt as the room changing rather than heard as a portamento.
  //
  // Written every frame like the tone above, and for the same reason: the
  // per-frame change is minute, so the parameter moves smoothly without any
  // scheduled automation that the next frame would only have to cancel.
  setStation(d) {
    if (!this.ctx || !this.droneOsc) {
      return;
    }
    const top = ROOTS.length - 1;
    const at = Math.min(Math.max(d, 0), top);
    const i = Math.min(Math.floor(at), top - 1);
    const f = at - i;
    const root = ROOTS[i] * Math.pow(ROOTS[i + 1] / ROOTS[i], f);
    this.droneOsc[0].frequency.value = root;
    this.droneOsc[1].frequency.value = root * DETUNE;
  }

  // A single soft footfall on stone: a low, pitch-dropping thump and a brief
  // brush of scuff, both very quiet — felt under the room tone more than heard.
  // Alternating feet land a shade apart (and every step varies a little) so a
  // walk never turns into a metronome. `intensity` is the gait's strength.
  //
  // The feet also land on opposite SIDES. Everything in this soundscape was mono
  // — one signal, dead centre, identical in both ears — and a walk rendered that
  // way is a rhythm rather than a body: two footfalls in the same place is
  // something tapping, not someone walking. Left and right are the cheapest
  // possible cue that the sound has a person in it, and they cost one node.
  // Kept narrow (the feet are directly below the listener, not out to the side)
  // and slightly varied, so it reads as gait rather than as ping-pong.
  step(intensity = 1) {
    if (!this.ctx || this.muted) {
      return;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.stepFoot = !this.stepFoot;
    const vary = 0.9 + Math.random() * 0.2;
    // Both halves of the footfall go through one panner, so the thump and its
    // scuff are the same foot in the same place rather than two events that
    // happen to coincide. Older Safari has no StereoPannerNode; there the step
    // falls back to the master bus and is simply centred, as it was before.
    const foot = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (foot) {
      foot.pan.value = (this.stepFoot ? 1 : -1) * (0.16 + Math.random() * 0.1);
      foot.connect(this.master);
    }
    const out = foot ?? this.master;

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    const f0 = (this.stepFoot ? 84 : 74) * vary;
    thump.frequency.setValueAtTime(f0, t);
    thump.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.12);
    const tg = ctx.createGain();
    const peak = 0.016 * intensity * (this.stepFoot ? 1 : 0.85);
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.012);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    thump.connect(tg).connect(out);
    thump.start(t);
    thump.stop(t + 0.22);

    if (this.scuffBuffer) {
      const scuff = ctx.createBufferSource();
      scuff.buffer = this.scuffBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 500 + Math.random() * 260;
      bp.Q.value = 0.9;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.exponentialRampToValueAtTime(Math.max(0.006 * intensity, 0.0002), t + 0.008);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      scuff.connect(bp).connect(sg).connect(out);
      scuff.start(t, Math.random() * (NOISE_SECONDS - 1));
      scuff.stop(t + 0.12);
    }
  }

  // A step into something that will not open. Deliberately NOT a footfall: it
  // starts lower, falls further, and lasts twice as long, with its noise burst
  // filtered down to a dull knock instead of the step's brighter scuff — so the
  // ear reads mass meeting stone, not another stride landing.
  thud() {
    if (!this.ctx || this.muted) {
      return;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(56, t);
    body.frequency.exponentialRampToValueAtTime(30, t + 0.34);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
    body.connect(bg).connect(this.master);
    body.start(t);
    body.stop(t + 0.48);

    if (this.scuffBuffer) {
      const knock = ctx.createBufferSource();
      knock.buffer = this.scuffBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 190;
      lp.Q.value = 0.7;
      const kg = ctx.createGain();
      kg.gain.setValueAtTime(0.0001, t);
      kg.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
      kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      knock.connect(lp).connect(kg).connect(this.master);
      knock.start(t, Math.random() * (NOISE_SECONDS - 1));
      knock.stop(t + 0.24);
    }
  }

  // The door opening: a soft, quiet major bloom rising out of the room tone
  // over a couple of seconds — an announcement, not a fanfare.
  announce() {
    if (!this.ctx || this.muted) {
      return;
    }
    const t = this.ctx.currentTime;
    [196, 294, 392].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.022 / (i + 1), t + 1.2 + i * 0.35);
      g.gain.setTargetAtTime(0, t + 2.2 + i * 0.35, 1.6);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 10);
    });
  }

  // A soft breath that rises and settles, fired alongside the visual transition
  // bloom. `build` is the rise to the crest, `level` the crest gain, `release`
  // the settle time-constant. Defaults are the chapter-crossing breath; the
  // vortex dive asks for a longer, deeper rush that crests with the whiteout.
  swell(build = 1.5, level = 0.05, release = 1.1) {
    if (!this.ctx || this.muted) {
      return;
    }
    const t = this.ctx.currentTime;
    const g = this.swellGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(level, t + build);
    g.setTargetAtTime(0, t + build + 0.1, release);
    // The hush brightens as it builds — barely at chapter scale, but across the
    // dive's long build the filter opens until the air genuinely rushes.
    const f = this.swellFilter.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(f.value, t);
    f.linearRampToValueAtTime(700 + build * 500, t + build);
    f.setTargetAtTime(700, t + build + 0.1, release);
  }

  // A bare tone, used by the rites below: one sine that rises out of the room
  // tone and settles back into it, optionally sliding in pitch as it goes.
  // Everything here is a fraction of the swell's own level — the rites are
  // meant to be recognised rather than heard, the way you recognise a room by
  // its echo without listening for one.
  tone(freq, { at = 0, level = 0.012, rise = 0.9, hold = 0.6, fall = 1.4, to = null } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (to !== null) {
      osc.frequency.exponentialRampToValueAtTime(to, t + rise + hold + fall);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + rise);
    g.gain.setValueAtTime(level, t + rise + hold);
    g.gain.linearRampToValueAtTime(0, t + rise + hold + fall);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + rise + hold + fall + 0.05);
  }

  // A run of breaths on the swell channel, one after another. swell() cancels
  // whatever is scheduled each time it is called, so a rite that wants three
  // of them has to write the whole sequence in one pass.
  breaths(steps) {
    const t0 = this.ctx.currentTime;
    const g = this.swellGain.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(g.value, t0);
    steps.forEach(({ at, level, build }) => {
      g.linearRampToValueAtTime(level, t0 + at + build);
      g.linearRampToValueAtTime(0.0008, t0 + at + build * 2.2);
    });
  }

  // The voice of a threshold. Each crossing has its own rite (see rites.js) and
  // its own sound; anything unnamed keeps the plain chapter swell, so a jump
  // across several chapters — which passes through no one threshold — still
  // sounds like travel.
  rite(kind) {
    if (!this.ctx || this.muted) {
      return;
    }
    switch (kind) {
      // Tautology: one breath answered by two fainter ones, at the pace the
      // three ember waves cross the plate.
      case 'echo':
        this.breaths([
          { at: 0, level: 0.05, build: 0.9 },
          { at: 2.3, level: 0.028, build: 0.7 },
          { at: 4.1, level: 0.014, build: 0.6 },
        ]);
        break;
      // The Silence, which is announced by nothing: the whole room tone ducks
      // away instead and comes back changed. No swell at all.
      case 'hush': {
        const t = this.ctx.currentTime;
        const g = this.dip.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0.38, t + 1.6);
        g.setValueAtTime(0.38, t + 3.0);
        g.linearRampToValueAtTime(1, t + 6.2);
        break;
      }
      // The floor goes: the swell is joined by a tone that slides a fifth down
      // and keeps going, so the ear falls with the picture.
      case 'wind':
        this.swell(2.4, 0.06, 1.6);
        this.tone(96, { level: 0.02, rise: 1.4, hold: 0.4, fall: 2.6, to: 38 });
        break;
      // Two futures: the same note twice, a beat apart and slightly out with
      // itself, one of them cut short.
      case 'split':
        this.swell(1.6, 0.045, 1.2);
        this.tone(147, { at: 0.15, level: 0.014, rise: 1.1, hold: 0.5, fall: 1.8 });
        this.tone(148.4, { at: 0.55, level: 0.011, rise: 1.0, hold: 0.2, fall: 1.1 });
        break;
      // Going under: the hush closes down instead of opening up as it builds,
      // which is what a filter sweeping the wrong way sounds like.
      case 'flood': {
        this.swell(1.8, 0.055, 1.9);
        const t = this.ctx.currentTime;
        const f = this.swellFilter.frequency;
        f.cancelScheduledValues(t);
        f.setValueAtTime(900, t);
        f.linearRampToValueAtTime(170, t + 2.4);
        f.setTargetAtTime(700, t + 3.2, 1.8);
        this.tone(62, { level: 0.016, rise: 1.6, hold: 0.6, fall: 2.2, to: 49 });
        break;
      }
      // Threads: three high, thin tones let go one after another, none of them
      // resolving into the others.
      case 'weave':
        this.swell(1.4, 0.03, 1.4);
        [1046.5, 1318.5, 1568].forEach((f, i) => {
          this.tone(f, {
            at: i * 0.5, level: 0.006 - i * 0.0012, rise: 0.8, hold: 0.3, fall: 2.4,
          });
        });
        break;
      default:
        this.swell();
    }
  }

  // Tear the whole soundscape down (owner unmounting). Every method guards on
  // this.ctx, so the instance is safely inert afterwards.
  dispose() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) {
      return;
    }
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.8);
  }
}
