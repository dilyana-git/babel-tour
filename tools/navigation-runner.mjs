// Reporting and selection are kept browser-independent so the test harness
// itself can be checked quickly, including its behaviour after a failure.
export const scenarioId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function selectScenarios(scenarios, { suite = 'baseline', filter } = {}) {
  if (!['baseline', 'smoke', 'contracts', 'all'].includes(suite)) throw new Error(`Unknown suite: ${suite}`);
  const selected = scenarios.filter(s => (suite === 'all' || (suite === 'smoke' ? s.smoke : s.suite === suite))
    && (!filter || s.id.includes(filter) || s.name.toLowerCase().includes(filter.toLowerCase())));
  if (!selected.length) throw new Error(`No navigation scenarios match suite=${suite}${filter ? ` scenario=${filter}` : ''}`);
  return selected;
}

export async function runScenarios(scenarios, { onStart = async () => {}, onResult = async () => {} } = {}) {
  if (!scenarios.length) throw new Error('No scenarios to execute');
  const records = [];
  for (const scenario of scenarios) {
    const record = { id: scenario.id, name: scenario.name, suite: scenario.suite, status: 'running' };
    records.push(record);
    await onStart(record);
    const started = Date.now();
    try {
      await scenario.run();
      record.status = 'passed';
    } catch (error) {
      record.status = 'failed';
      record.error = { message: error.message, stack: error.stack };
    }
    record.durationMs = Date.now() - started;
    await onResult(record);
  }
  return { status: records.every(r => r.status === 'passed') ? 'passed' : 'failed', records };
}
