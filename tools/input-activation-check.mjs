import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionHandlers } from '../src/actionHandlers.js';

const event = (pointer = 'touch', overrides = {}) => ({ pointerType: pointer,
  clientX: 20, clientY: 20, nativeEvent: { pointerType: pointer }, preventDefault() {},
  currentTarget: { disabled: false, getBoundingClientRect: () => ({ left: 0, top: 0, right: 44, bottom: 44 }) }, ...overrides });

test('a touch release inside the control activates even if no click follows', () => {
  let calls = 0; const handlers = actionHandlers(() => calls++);
  handlers.onPointerUp(event()); assert.equal(calls, 1);
});
test('a synthesized touch click cannot activate the same action twice', () => {
  let calls = 0; const handlers = actionHandlers(() => calls++);
  handlers.onPointerUp(event()); handlers.onClick(event()); assert.equal(calls, 1);
});
test('mouse and keyboard retain ordinary click activation', () => {
  let calls = 0; const handlers = actionHandlers(() => calls++);
  handlers.onPointerUp(event('mouse')); assert.equal(calls, 0);
  handlers.onClick(event('mouse')); handlers.onClick(event(undefined, { nativeEvent: {} })); assert.equal(calls, 2);
});
test('releasing a touch outside the control does not activate', () => {
  let calls = 0; const handlers = actionHandlers(() => calls++);
  handlers.onPointerUp(event('touch', { clientX: 60 })); assert.equal(calls, 0);
});
test('disabled controls cannot activate through either event path', () => {
  let calls = 0; const handlers = actionHandlers(() => calls++), input = event(); input.currentTarget.disabled = true;
  handlers.onPointerUp(input); handlers.onClick(event('mouse', { currentTarget: input.currentTarget })); assert.equal(calls, 0);
});
