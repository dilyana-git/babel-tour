import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runScenarios, selectScenarios, scenarioId } from './navigation-runner.mjs';

const scenario = (name, run = async () => {}, suite = 'baseline') => ({ id: scenarioId(name), name, run, suite });

test('a failed scenario keeps its evidence and later independent scenarios still execute', async () => {
  const events = [];
  const result = await runScenarios([
    scenario('first fails', async () => { events.push('first'); throw new Error('arrival failed'); }),
    scenario('second passes', async () => { events.push('second'); }),
  ], { onResult: async record => events.push(record.status) });
  assert.equal(result.status, 'failed');
  assert.deepEqual(events, ['first', 'failed', 'second', 'passed']);
  assert.match(result.records[0].error.message, /arrival failed/);
  assert.equal(result.records[1].status, 'passed');
});

test('success requires every selected scenario to pass', async () => {
  const result = await runScenarios([scenario('entry'), scenario('return')]);
  assert.equal(result.status, 'passed');
  assert(result.records.every(r => r.status === 'passed' && Number.isFinite(r.durationMs)));
});

test('an empty run cannot be reported as passing', async () => {
  await assert.rejects(runScenarios([]), /No scenarios to execute/);
});

test('smoke selection remains a subset of baseline and never includes future contracts', () => {
  const cases = [{ ...scenario('entry'), smoke: true }, scenario('full tour'), scenario('new controls', undefined, 'contracts')];
  assert.deepEqual(selectScenarios(cases, { suite: 'smoke' }).map(s => s.name), ['entry']);
});

test('setup failure is a failed scenario and does not hide the following checks', async () => {
  const result = await runScenarios([
    scenario('cannot enter', async () => { throw new Error('setup failed'); }),
    scenario('can reload'),
  ]);
  assert.deepEqual(result.records.map(r => r.status), ['failed', 'passed']);
});

test('targeted selection is explicit, and unknown filters cannot give a false green result', () => {
  const cases = [scenario('ending Escape'), scenario('walk look', undefined, 'contracts')];
  assert.deepEqual(selectScenarios(cases).map(s => s.name), ['ending Escape']);
  assert.deepEqual(selectScenarios(cases, { suite: 'contracts' }).map(s => s.name), ['walk look']);
  assert.deepEqual(selectScenarios(cases, { suite: 'all', filter: 'escape' }).map(s => s.name), ['ending Escape']);
  assert.throws(() => selectScenarios(cases, { filter: 'missing' }), /No navigation scenarios/);
  assert.throws(() => selectScenarios(cases, { suite: 'missing' }), /Unknown suite/);
});

test('unfinished infrastructure reporting aborts instead of being reported as a pass', async () => {
  await assert.rejects(runScenarios([scenario('entry')], {
    onResult: async () => { throw new Error('report could not be saved'); },
  }), /report could not be saved/);
});
