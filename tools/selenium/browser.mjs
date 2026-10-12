import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Builder, Browser, By, until } from 'selenium-webdriver';
import edge from 'selenium-webdriver/edge.js';

export { assert, By, until };

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const freePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.on('error', reject);
  server.listen(0, 'localhost', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function startApp({ hmr = true } = {}) {
  if (process.env.BABEL_TEST_URL) {
    const url = process.env.BABEL_TEST_URL.replace(/\/$/, '');
    assert(await reachable(url), `Cannot reach BABEL_TEST_URL=${url}`);
    return { url, stop: async () => {} };
  }

  const port = await freePort();
  const url = `http://localhost:${port}`;
  const args = hmr
    ? ['node_modules/vite/bin/vite.js', '--host', 'localhost', '--port', String(port), '--strictPort']
    : ['--input-type=module', '--eval', `
      import { createServer } from 'vite';
      const server = await createServer({server: {
        host: 'localhost', port: Number(process.argv[1]), strictPort: true, hmr: false, watch: null,
      }});
      await server.listen(); server.printUrls();
    `, String(port)];
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  const logs = [];
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    logs.push(chunk.toString());
    if (logs.length > 100) logs.shift();
  });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && child.exitCode === null) {
    if (await reachable(url)) return { url, logs, stop: async () => child.kill() };
    await pause(250);
  }
  child.kill();
  throw new Error('Vite did not start. Run npm ci, or set BABEL_TEST_URL to an existing server.');
}

export async function startBrowser({ pageLoadStrategy = 'normal', reducedMotion = true, scriptTimeout = 30000 } = {}) {
  const graphics = process.env.BABEL_BROWSER_GRAPHICS ?? 'software';
  if (!['software', 'hardware'].includes(graphics)) throw new Error('BABEL_BROWSER_GRAPHICS must be software or hardware');
  const profile = await mkdtemp(join(tmpdir(), 'babel-selenium-'));
  const options = new edge.Options().addArguments(
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-component-extensions-with-background-pages',
    '--use-gl=angle',
    ...(graphics === 'software' ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
      : [process.platform === 'win32' ? '--use-angle=d3d11' : '--use-angle=default']),
    `--user-data-dir=${profile}`,
  );
  options.setPageLoadStrategy(pageLoadStrategy);
  if (process.env.BROWSER_PATH) options.setBinaryPath(process.env.BROWSER_PATH);
  let driver;
  try {
    const builder = new Builder().forBrowser(Browser.EDGE).setEdgeOptions(options);
    if (process.env.EDGE_DRIVER_PATH) {
      builder.setEdgeService(new edge.ServiceBuilder(process.env.EDGE_DRIVER_PATH));
    }
    driver = await builder.build();
    await driver.manage().setTimeouts({ pageLoad: 90000, script: scriptTimeout, implicit: 0 });
    await driver.sendDevToolsCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }],
    });
    return { driver, stop: async () => {
      try { await driver.quit(); } finally {
        await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
          .catch((error) => console.warn(`[selenium] Profile cleanup: ${error.message}`));
      }
    } };
  } catch (error) {
    await driver?.quit().catch(() => {});
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
    throw new Error(`Edge WebDriver could not start: ${error.message}`);
  }
}

export async function viewport(driver, width, height, { verify = true } = {}) {
  await driver.sendDevToolsCommand('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 600,
  });
  if (verify) {
    const actual = await driver.executeScript('return [innerWidth, innerHeight]');
    assert.equal(actual[0], width, `Expected ${width}px viewport`);
  }
}

export async function waitFor(driver, selector, timeout = 90000) {
  return driver.wait(until.elementLocated(By.css(selector)), timeout,
    `Timed out waiting for ${selector}`);
}

export async function waitForVisible(driver, selector, timeout = 90000) {
  const element = await waitFor(driver, selector, timeout);
  await driver.wait(until.elementIsVisible(element), timeout,
    `Timed out waiting for visible ${selector}`);
  return element;
}

export async function waitUntil(driver, test, message, timeout = 30000) {
  return driver.wait(test, timeout, message, 300);
}

export async function assertFitsViewport(driver, selectors = []) {
  const result = await driver.executeScript((selectors) => {
    const width = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - width;
    const controls = selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { selector, x: rect.x, right: rect.right, width: rect.width,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 };
    });
    return { width, overflow, controls };
  }, selectors);
  assert(result.overflow <= 2, `Horizontal overflow of ${result.overflow}px at ${result.width}px`);
  for (const item of result.controls) {
    assert(!item.missing, `Missing ${item.selector}`);
    assert(item.visible, `${item.selector} is hidden at ${result.width}px`);
    assert(item.x >= -2 && item.right <= result.width + 2,
      `${item.selector} is clipped at ${result.width}px (${Math.round(item.x)}..${Math.round(item.right)})`);
  }
}
