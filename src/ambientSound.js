// Procedural room tone for the tour — no audio assets. Brown noise breathed
// through a low-pass filter reads as air moving through the stacks; two low,
// slightly detuned sines beat slowly against each other underneath. Descent
// darkens the filter and leans on the drones, so the deep chapters *sound*
// deeper. Crossing into the garden opens the air back up: a band-passed hush
// of leaves gusts in while the stone drones recede. Everything stays very
// quiet: this is atmosphere, not soundtrack.

const NOISE_SECONDS = 8;

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
    const now = ctx.currentTime;

    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 1, now + 5);
    this.master.connect(ctx.destination);

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

    // Ground: two low sines a hair apart, beating roughly every three seconds.
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.018;
    this.droneGain.connect(this.master);
    [55, 55.3].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g).connect(this.droneGain);
      osc.start();
    });

    // A dedicated channel for chapter-change swells: the same air, one octave
    // of filter brighter, silent until swell() opens it.
    this.swellGain = ctx.createGain();
    this.swellGain.gain.value = 0;
    const swellFilter = ctx.createBiquadFilter();
    swellFilter.type = 'lowpass';
    swellFilter.frequency.value = 700;
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

  // A soft breath rising over ~1.5s and settling back over ~3s, fired alongside
  // the visual transition bloom.
  swell() {
    if (!this.ctx || this.muted) {
      return;
    }
    const t = this.ctx.currentTime;
    const g = this.swellGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.05, t + 1.5);
    g.setTargetAtTime(0, t + 1.6, 1.1);
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
