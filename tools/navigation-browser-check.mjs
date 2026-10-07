#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { startApp, startBrowser } from './selenium/browser.mjs';
import { navigationScenarios } from './selenium/navigation.mjs';
import { navigationContracts } from './selenium/navigation-contracts.mjs';
import { sourceFingerprint } from './selenium/source.mjs';
import { runScenarios, scenarioId, selectScenarios } from './navigation-runner.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const mutation = option('mutation');
if (mutation && mutation !== 'drop-forward') throw new Error('Unknown navigation mutation');
if (args.some(a => !['--out=', '--mutation=', '--scenario=', '--suite='].some(prefix => a.startsWith(prefix)))) {
  throw new Error('Use --out=<path>, --scenario=<name>, --suite=baseline|smoke|contracts|all, or --mutation=drop-forward');
}
const suite = option('suite') ?? 'baseline';
const filter = option('scenario');
const graphics = process.env.BABEL_BROWSER_GRAPHICS ?? 'software';
const smokeNames = new Set(['normal entry and first-room boundary', 'combined walking and looking releases both inputs safely',
  'walk interrupt, stop, and recovery to the destination', 'finale can be skipped with Escape',
  'finale can be skipped with M immediately after requesting it']);
const cases = (driver, url, options) => [
  ...navigationScenarios(driver, url, options).map(([name, run]) => ({ id: scenarioId(name), name, run, suite: 'baseline', smoke: smokeNames.has(name) })),
  ...navigationContracts(driver, url, options).map(([name, run]) => ({ id: scenarioId(name), name, run, suite: 'contracts' })),
];
const catalogue = cases(null, '');
const selectedIds = new Set(selectScenarios(catalogue, { suite, filter }).map(s => s.id));
const startedAt = new Date().toISOString();
const out = resolve(option('out') ?? `.ux-review/navigation/${startedAt.replace(/[:.]/g, '-')}`);
const result = {
  startedAt, status: 'running', mutation: mutation ?? null,
  scope: { suite, filter: filter ?? null, fullBaseline: !filter && ['baseline', 'all'].includes(suite) },
  method: `Real browser input; dev clock accelerated 12×, raster DPR 0.5; ${graphics} graphics profile; geometry sweep separate from input journeys.`,
  limitations: [`Headless Edge; requested ${graphics} graphics profile.`, 'No real-device performance or visual-quality claim.',
    'Default world tour; retained plate tour and balcony use their separate checks.'],
  scenarios: catalogue.map(({ id, name, suite }) => ({ id, name, suite, status: selectedIds.has(id) ? 'not run' : 'not selected' })),
  trace: [], errors: [], browserLog: [],
};
let app;
let browser;
let active;
await mkdir(out, { recursive: true });
const save = async () => {
  await writeFile(join(out, 'report.json'), `${JSON.stringify(result, null, 2)}\n`);
  const row = s => `| ${s.name} | ${s.status} | ${(s.error?.message ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')} |`;
  const report = `# Navigation regression check\n\nStatus: **${result.status}**. Started ${startedAt}.\n\n`
    + (result.stale ? '**Source changed during this run. These results do not verify the latest files; rerun the checks.**\n\n' : '')
    + `Scope: ${result.scope.fullBaseline ? 'complete baseline' : `targeted ${suite} run${filter ? ` (${filter})` : ''}; does not replace the major-change gate`}.\n\n`
    + `${result.method}\n\n| Scenario | Result | Failure |\n| --- | --- | --- |\n${result.scenarios.map(row).join('\n')}\n\n`
    + (result.failure ? `Failure: ${result.failure.message}\n\n` : '')
    + `Evidence: [report.json](./report.json). Failed-state screenshot is saved when available.\n\n`
    + result.limitations.map(v => `- ${v}`).join('\n') + '\n';
  await writeFile(join(out, 'report.md'), report);
};
const snapshot = async () => {
  if (!browser) return null;
  return browser.driver.executeScript(() => ({
    url: location.href,
    readyState: document.readyState,
    timeOrigin: performance.timeOrigin,
    focus: document.hasFocus(),
    visibility: document.visibilityState,
    focusEvents: window.__navigationFocusEvents ?? [],
    root: document.querySelector('#root')?.innerHTML.slice(0, 1500),
    bodyText: document.body?.innerText.slice(0, 1500),
    title: document.querySelector('#room-title')?.textContent.trim(),
    status: document.querySelector('.map-status')?.textContent,
    walk: window.__worldWalk?.(),
    errors: window.__navigationErrors ?? [],
    inputEvents: window.__navigationInputEvents ?? [],
    viewport: { width: innerWidth, height: innerHeight, scale: visualViewport?.scale },
    mapControl: (() => {
      const el = document.querySelector('.room-map');
      if (!el) return null;
      const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { disabled: el.disabled, x, y, hit: hit?.tagName, hitClass: hit?.getAttribute('class'),
        hitButton: hit?.closest('button')?.getAttribute('aria-label') };
    })(),
  })).catch(error => ({ snapshotFailure: error.message }));
};

try {
  await save();
  result.sourceBefore = await sourceFingerprint();
  app = await startApp({ hmr: false }); result.url = app.url;
  browser = await startBrowser({ pageLoadStrategy: 'none', reducedMotion: false,
    scriptTimeout: suite === 'contracts' || suite === 'all' ? 900000 : 90000 });
  result.browser = (await browser.driver.getCapabilities()).get('browserVersion');
  const cdp = await browser.driver.createCDPConnection('page');
  const log = event => {
    if (result.browserLog.length < 200) result.browserLog.push(event);
  };
  await browser.driver.onLogEvent(cdp, log);
  await browser.driver.onLogException(cdp, log);
  await cdp.send('Log.enable', {});
  await browser.driver.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      window.__navigationErrors = [];
      window.__navigationFocusEvents = [];
      window.__navigationInputEvents = [];
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click', 'lostpointercapture']) {
        addEventListener(type, event => {
          const button = event.target?.closest?.('button');
          window.__navigationInputEvents.push({ type, at: performance.now(), pointer: event.pointerType,
            x: event.clientX, y: event.clientY, target: event.target?.tagName,
            button: button?.getAttribute('aria-label'), className: button?.className });
          if (window.__navigationInputEvents.length > 200) window.__navigationInputEvents.shift();
        }, true);
      }
      for (const type of ['focus', 'blur']) addEventListener(type, () => {
        window.__navigationFocusEvents.push({type, at:performance.now()});
      });
      const record = (kind, message) => {
        if (window.__navigationErrors.length < 100) window.__navigationErrors.push({kind, message: String(message)});
      };
      window.addEventListener('webglcontextlost', () => record('webgl', 'Rendering context lost'), true);
      const describe = value => value?.stack || value?.message || String(value);
      addEventListener('error', event => {
        const url = event.filename || event.target?.src || event.target?.href || '';
        if (url.startsWith('chrome-extension://')) return;
        record(event.message ? 'exception' : 'resource', event.message || url || event.target?.tagName);
      }, true);
      addEventListener('unhandledrejection', event => record('unhandledrejection', describe(event.reason)));
      const original = console.error;
      console.error = (...values) => { record('console.error', values.map(describe).join(' ')); original.apply(console, values); };
    })();`,
  });
  const scenarios = selectScenarios(cases(browser.driver, app.url, { mutation,
    onStep: async step => {
      result.trace.push({ scenario: active.name, step, observed: await snapshot() });
      await save();
    },
  }), { suite, filter });
  const checked = scenarios.map(scenario => ({ ...scenario, run: async () => {
    await scenario.run();
    const observed = await snapshot();
    if (observed?.errors?.length) throw new Error(`Browser errors: ${JSON.stringify(observed.errors)}`);
  } }));
  const batch = await runScenarios(checked, {
    onStart: async record => {
      active = record;
      result.scenarios[result.scenarios.findIndex(s => s.id === record.id)] = record;
      console.log(`[navigation] ${record.name} ...`);
      await browser.driver.executeScript('if (window.__navigationErrors) window.__navigationErrors.length = 0; if (window.__navigationInputEvents) window.__navigationInputEvents.length = 0');
      await save();
    },
    onResult: async record => {
      result.renderer ??= await browser.driver.executeScript(() => {
        const gl = document.querySelector('canvas')?.getContext('webgl2');
        if (!gl) return null;
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      }).catch(() => null);
      result.trace.push({ scenario: record.name, observed: await snapshot() });
      if (record.status === 'failed') {
        result.failure ??= record.error;
        try {
          record.screenshot = `failure-${record.id}.png`;
          await writeFile(join(out, record.screenshot), Buffer.from(await browser.driver.takeScreenshot(), 'base64'));
        } catch (error) { record.screenshotFailure = error.message; }
        console.error(`[navigation] FAILED: ${record.error.message}`);
      } else {
        if (record.id.includes('staircase-keeps-descending') || record.id.includes('crosses-the-pavilion-bridge')) {
          record.screenshot = `passed-${record.id}.png`;
          await writeFile(join(out, record.screenshot), Buffer.from(await browser.driver.takeScreenshot(), 'base64'));
        }
        console.log(`[navigation] passed (${(record.durationMs / 1000).toFixed(1)}s)`);
      }
      await save();
    },
  });
  result.status = batch.status;
  if (batch.status !== 'passed') process.exitCode = 1;
} catch (error) {
  result.status = 'failed';
  result.failure = { message: error.message, stack: error.stack };
  if (active) { active.status = 'failed'; active.error = result.failure; }
  const observed = await snapshot();
  result.trace.push({ scenario: active?.name ?? 'setup', observed });
  result.errors = observed?.errors ?? [];
  if (browser) {
    try { await writeFile(join(out, 'failure.png'), Buffer.from(await browser.driver.takeScreenshot(), 'base64')); }
    catch (captureError) { result.screenshotFailure = captureError.message; }
  }
  console.error(`[navigation] ${error.stack ?? error}`);
  process.exitCode = 1;
} finally {
  result.finishedAt = new Date().toISOString();
  result.serverLog = app?.logs ?? [];
  try {
    result.sourceAfter = await sourceFingerprint();
    result.stale = result.sourceBefore && result.sourceBefore.hash !== result.sourceAfter.hash;
    if (result.stale) {
      result.status = 'failed'; process.exitCode = 1;
      result.failure ??= { message: 'Source changed during verification; rerun the latest files.' };
      console.error('[navigation] Source changed during verification; this result is stale.');
    }
  } catch (error) {
    result.freshnessError = error.message;
    result.failure ??= { message: `Could not verify source freshness: ${error.message}` };
    result.status = 'failed'; process.exitCode = 1;
  }
  await save();
  try { if (browser) await browser.stop(); }
  catch (error) { result.cleanupError = error.message; process.exitCode = 1; }
  finally { if (app) await app.stop(); }
  if (result.cleanupError) { result.status = 'failed'; await save(); }
  console.log(`[navigation] ${result.status}: ${join(out, 'report.md')}`);
}
