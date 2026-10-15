import assert from 'node:assert/strict';
import test from 'node:test';
import { PavilionMusic, PAVILION_CYCLE, PAVILION_SCORE } from '../src/pavilionMusic.js';

function fixture() {
  const played = [];
  const engine = {
    ctx: { currentTime: 0, state: 'running' }, muted: false, stopped: 0,
    setQinPresence(level, pan) { this.level = level; this.pan = pan; },
    stopQin() { this.stopped++; },
    pluck(freq, options) { played.push({ freq, when: this.ctx.currentTime + options.at }); },
    resonate(chord, options) { played.push({ chord, when: this.ctx.currentTime + options.at }); },
  };
  const music = new PavilionMusic();
  const tick = (clock, level = 0.85) => {
    engine.ctx.currentTime = clock;
    music.update(engine, { level, pan: -0.3, dt: 1 / 60 });
  };
  return { engine, music, played, tick };
}

test('a minute of playing leaves time for the last string to decay before repeating', () => {
  const notes = PAVILION_SCORE.filter(event => !event.chord);
  assert(notes.at(-1).at >= 55 && notes.at(-1).at <= 60);
  assert(notes.at(-1).at + 7 < PAVILION_CYCLE);
  assert(PAVILION_SCORE.every(event => Number.isFinite(event.at) && event.at >= 0));
});

test('the opening question returns with the same pitches and a changed ending', () => {
  const notes = PAVILION_SCORE.filter(event => !event.chord);
  const opening = notes.slice(0, 4).map(note => note.freq);
  const returnPhrase = notes.filter(note => note.at >= 26 && note.at < 38).slice(0, 4).map(note => note.freq);
  assert.deepEqual(returnPhrase, opening);
  assert.equal(notes.at(-1).freq, opening[0]);
  assert.notEqual(opening.at(-1), opening[0]);
});

test('ordinary frames schedule each event once, within the audio lookahead', () => {
  const { played, tick } = fixture();
  for (let t = 0; t < PAVILION_CYCLE; t += 1 / 30) tick(t);
  assert.equal(played.length, PAVILION_SCORE.length);
  assert.deepEqual(played.map(event => event.when), PAVILION_SCORE.map(event => event.at + 0.55));
});

test('a long drawing stall skips missed notes instead of playing a burst', () => {
  const { played, tick } = fixture();
  tick(0);
  tick(28.3);
  assert.equal(played.length, 1);
  assert(played[0].when > 28.3 && played[0].when <= 28.75);
  const count = played.length;
  tick(28.32);
  assert.equal(played.length, count);
});

test('leaving cancels ringing and queued voices; returning restarts the opening', () => {
  const { engine, played, tick } = fixture();
  tick(0);
  tick(1.2);
  assert(played.some(event => event.freq));
  tick(1.3, 0);
  assert.equal(engine.stopped, 1);
  assert.equal(engine.level, 0);
  tick(100, 0);
  assert.equal(engine.stopped, 1);
  played.length = 0;
  tick(101);
  tick(102.2);
  assert.equal(played.find(event => event.freq).freq, PAVILION_SCORE.find(event => event.freq).freq);
  assert.equal(played.find(event => event.freq).when, 102.55);
});

test('muting and context suspension cancel the passage without a catch-up on resume', () => {
  const { engine, played, tick } = fixture();
  tick(0);
  tick(1.2);
  engine.muted = true;
  tick(1.3);
  assert.equal(engine.stopped, 1);
  const count = played.length;
  tick(20);
  assert.equal(played.length, count);
  engine.muted = false;
  tick(21);
  engine.ctx.state = 'suspended';
  tick(21.2);
  assert.equal(engine.stopped, 2);
  engine.ctx.state = 'running';
  tick(60);
  assert.equal(played.length, count);
});

test('missing several cycles resumes only the current phrase', () => {
  const { played, tick } = fixture();
  tick(0);
  tick(PAVILION_CYCLE * 5 + 28.3);
  assert.equal(played.length, 1);
  assert.equal(played[0].when, PAVILION_CYCLE * 5 + 28.55);
});
