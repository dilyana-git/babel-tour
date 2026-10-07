import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pendingFinale } from '../src/world/finaleLifecycle.js';

const atEnding = { place: 7, target: 7, last: 7, up: false, moveKind: null };

test('Escape before the first ending frame still commits the return to the map', () => {
  assert.equal(pendingFinale('play', atEnding), 'play');
  assert.equal(pendingFinale('skip', atEnding), 'skip');
});
test('skip interrupts an approach walk rather than waiting for a missing ending animation', () => {
  assert.equal(pendingFinale('play', { ...atEnding, moveKind: 'walk' }), null);
  assert.equal(pendingFinale('skip', { ...atEnding, moveKind: 'walk' }), 'skip');
});
test('an existing ending animation handles its own skip without restarting', () => {
  assert.equal(pendingFinale('skip', { ...atEnding, moveKind: 'finale' }), null);
});
test('ending intent cannot interrupt ordinary travel or start in another room', () => {
  for (const request of [null, 'play', 'skip']) {
    assert.equal(pendingFinale(request, { ...atEnding, place: 0, target: 1 }), null);
    assert.equal(pendingFinale(request, { ...atEnding, last: undefined }), null);
  }
  assert.equal(pendingFinale(null, atEnding), null);
  assert.equal(pendingFinale('play', { ...atEnding, up: true }), null);
});
test('after returning to the map, a stale skip request cannot restart the ending', () => {
  assert.equal(pendingFinale('skip', { ...atEnding, place: null, target: null }), null);
});
