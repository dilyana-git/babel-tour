// A minute in E minor: the same four-note question returns over changing
// open strings, then settles on E. Times include the player's breaths.
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const phrases = [
  { at: 1, notes: [
    [0, 64, 0.9], [1.65, 67, 0.72, 28], [3.45, 66, 0.7],
    [5.8, 71, 0.52, 0, true], [8.1, 64, 0.45],
  ] },
  { at: 13, notes: [
    [0, 62, 0.7], [1.75, 59, 0.85], [4.15, 64, 1, 65],
    [6.4, 66, 0.56], [7.25, 67, 0.68], [9.65, 64, 0.6],
  ] },
  { at: 26, notes: [
    [0, 64, 0.85], [2, 67, 0.72, 32], [4.2, 66, 0.64],
    [6.9, 71, 0.57, 0, true], [8.2, 69, 0.43], [9.9, 67, 0.64],
  ] },
  { at: 39, notes: [
    [0, 67, 0.65], [1.55, 66, 0.7], [4, 64, 0.8, 40],
    [6.3, 59, 0.65], [7.5, 62, 0.5],
  ] },
  { at: 51, notes: [
    [0, 64, 0.85], [1.8, 67, 0.6, 25], [3.9, 66, 0.65],
    [7, 64, 0.85],
  ] },
];

export const PAVILION_CYCLE = 68;
export const PAVILION_SCORE = [
  ...phrases.flatMap(({ at, notes }) => notes.map(([offset, midi, touch, slide = 0, harmonic = false]) => ({
    at: at + offset, freq: hz(midi), level: 0.065 * touch, slide, harmonic,
  }))),
  ...[
    [0, [52, 59, 66]], [12, [48, 55, 64]], [25, [43, 50, 59]],
    [38, [50, 57, 64]], [50, [52, 59, 67]],
  ].map(([at, notes]) => ({ at, chord: notes.map(hz), duration: 11.5, level: 0.005 })),
].sort((a, b) => a.at - b.at);

// Schedule against the audio clock, a little ahead of the drawing loop.
// Leaving, muting or suspending cancels the passage; a return begins afresh.
export class PavilionMusic {
  constructor() {
    this.start = null;
    this.next = 0;
  }

  update(engine, { level = 0, pan = 0, dt = 0 } = {}) {
    const audible = level > 0.04 && !engine.muted && engine.ctx?.state === 'running';
    engine.setQinPresence(audible ? level : 0, pan, dt);
    if (!audible) {
      if (this.start !== null) engine.stopQin();
      this.start = null;
      this.next = 0;
      return;
    }
    const clock = engine.ctx.currentTime;
    if (this.start === null) this.start = clock + 0.55;
    const cycles = Math.floor((clock - this.start) / PAVILION_CYCLE);
    if (cycles > 0) {
      this.start += cycles * PAVILION_CYCLE;
      this.next = 0;
    }
    while (this.next < PAVILION_SCORE.length) {
      const event = PAVILION_SCORE[this.next];
      const when = this.start + event.at;
      if (when > clock + 0.45) break;
      this.next++;
      // A stalled/background tab must not dump its missed notes on return.
      if (when < clock - 0.12) continue;
      const options = { ...event, at: Math.max(0, when - clock) };
      if (event.chord) engine.resonate(event.chord, options);
      else engine.pluck(event.freq, options);
    }
  }
}
