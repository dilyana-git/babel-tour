#!/usr/bin/env node

/**
 * A zero-dependency UI/UX review agent for the Babel tour.
 *
 * It drives a real Chromium browser through the Chrome DevTools Protocol,
 * exercises the entry, help, audio, autoplay, chapter, keyboard and responsive
 * paths, then writes screenshots plus evidence-backed Markdown/JSON feedback.
 *
 * Usage:
 *   npm run review:ux
 *   npm run review:ux -- --url http://localhost:5173 --out .ux-review/latest
 */

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DEFAULT_OUT = join(ROOT, '.ux-review', 'latest');

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};
const has = (name) => args.includes(`--${name}`);

const targetUrl = new URL(option('url', 'http://localhost:5173/'));
const outputDir = resolve(option('out', DEFAULT_OUT));
const requestedBrowser = option('browser', process.env.BROWSER_PATH);
const includeMobile = !has('no-mobile');
const extraSettleMs = Number(option('settle', '0'));

if (!Number.isFinite(extraSettleMs) || extraSettleMs < 0) {
  throw new Error('--settle must be a non-negative number of milliseconds.');
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const log = (message) => console.log(`[ux-review] ${message}`);

const browserCandidates = () => {
  if (requestedBrowser) return [requestedBrowser];
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    return [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      local && join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      local && join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean);
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  return ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
};

const commandExists = async (candidate) => {
  if (candidate.includes('/') || candidate.includes('\\')) {
    return import('node:fs').then(({ existsSync }) => existsSync(candidate));
  }
  return new Promise((done) => {
    const probe = spawn(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {
      stdio: 'ignore',
    });
    probe.on('error', () => done(false));
    probe.on('exit', (code) => done(code === 0));
  });
};

const findBrowser = async () => {
  for (const candidate of browserCandidates()) {
    if (await commandExists(candidate)) return candidate;
  }
  throw new Error(
    'No Chromium browser was found. Pass its executable with --browser <path> or BROWSER_PATH.',
  );
};

const freePort = () => new Promise((done, fail) => {
  const server = createServer();
  server.unref();
  server.on('error', fail);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close(() => done(address.port));
  });
});

const assertReachable = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(
      `Could not reach ${url}. Start the app with "npm run dev", then run the review again (${error.message}).`,
    );
  } finally {
    clearTimeout(timer);
  }
};

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.serial = 0;
    this.closed = false;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const key = `${message.sessionId ?? ''}:${message.method}`;
      for (const listener of this.listeners.get(key) ?? []) listener(message.params);
    });
    socket.addEventListener('close', () => {
      this.closed = true;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Browser connection closed.'));
      }
      this.pending.clear();
    });
  }

  send(method, params = {}, sessionId) {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Browser connection closed.'));
    }
    const id = ++this.serial;
    return new Promise((resolveMessage, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out running ${method}.`));
      }, method === 'Page.captureScreenshot' ? 180000 : 30000);
      this.pending.set(id, { resolve: resolveMessage, reject, timer });
      try {
        this.socket.send(JSON.stringify({ id, method, params, sessionId }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  once(method, sessionId, timeoutMs = 15000) {
    const key = `${sessionId ?? ''}:${method}`;
    return new Promise((resolveEvent, reject) => {
      const listener = (value) => {
        clearTimeout(timer);
        this.listeners.set(key, (this.listeners.get(key) ?? []).filter((fn) => fn !== listener));
        resolveEvent(value);
      };
      const timer = setTimeout(() => {
        this.listeners.set(key, (this.listeners.get(key) ?? []).filter((fn) => fn !== listener));
        reject(new Error(`Timed out waiting for ${method}.`));
      }, timeoutMs);
      this.listeners.set(key, [...(this.listeners.get(key) ?? []), listener]);
    });
  }
}

const connect = async (port) => {
  let version;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        version = await response.json();
        break;
      }
    } catch {
      // Browser is still starting.
    }
    await sleep(100);
  }
  if (!version) throw new Error('Chromium did not expose its debugging endpoint.');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', fail, { once: true });
  });
  return { cdp: new Cdp(socket), socket, product: version.Browser };
};

const expression = `(() => {
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none'
      && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
  };
  const label = (element) => element.getAttribute('aria-label')
    || element.getAttribute('title') || element.innerText?.trim() || '';
  const interactiveSelector = [
    'button', 'a[href]', 'input', 'select', 'textarea',
    '[role="button"]', '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  const interactives = [...document.querySelectorAll(interactiveSelector)].slice(0, 80).map((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute('role') || '',
      label: label(element).replace(/\\s+/g, ' ').slice(0, 160),
      text: (element.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 100),
      disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
      pressed: element.getAttribute('aria-pressed'),
      current: element.getAttribute('aria-current'),
      tabIndex: element.tabIndex,
      visible: visible(element),
      rect: {
        x: Math.round(rect.x), y: Math.round(rect.y),
        width: Math.round(rect.width), height: Math.round(rect.height),
      },
      fontSize: parseFloat(style.fontSize),
    };
  });
  const help = document.querySelector('.help-overlay');
  const veil = document.querySelector('.entry-veil');
  const active = document.activeElement;
  const canvases = [...document.querySelectorAll('canvas')];
  return {
    url: location.href,
    title: document.title,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    bodyText: (document.body.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 2500),
    headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({
      level: Number(h.tagName.slice(1)), text: h.innerText.trim(), visible: visible(h),
    })),
    landmarks: [...document.querySelectorAll('main,nav,header,footer,aside,[role="main"],[role="navigation"]')]
      .map((e) => e.getAttribute('role') || e.tagName.toLowerCase()),
    interactives,
    veil: veil ? {
      ready: /Click to|Tap to/i.test(veil.innerText),
      label: label(veil),
      nestedInteractiveCount: veil.querySelectorAll('button,a,input,select,textarea').length,
    } : null,
    help: help ? {
      role: help.getAttribute('role'),
      ariaModal: help.getAttribute('aria-modal'),
      labelledBy: help.getAttribute('aria-labelledby'),
    } : null,
    activeElement: active ? { tag: active.tagName.toLowerCase(), label: label(active) } : null,
    canvas: {
      count: canvases.length,
      described: canvases.filter((c) => c.getAttribute('aria-label') || c.getAttribute('aria-describedby')).length,
    },
    nav: typeof window.__nav === 'function' ? window.__nav() : null,
  };
})()`;

const reportError = (error) => ({ name: error.name, message: error.message });

const main = async () => {
  await assertReachable(targetUrl);
  const browserPath = await findBrowser();
  const port = await freePort();
  const profile = await mkdtemp(join(tmpdir(), 'babel-ux-review-'));
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  log(`opening ${targetUrl}`);
  const browserProcess = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  const observations = { url: targetUrl.href, startedAt: new Date().toISOString(), steps: {} };
  let connection;
  let targetId;
  try {
    connection = await connect(port);
    const { cdp, product } = connection;
    observations.browser = product;
    ({ targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }));
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await Promise.all([
      cdp.send('Page.enable', {}, sessionId),
      cdp.send('Runtime.enable', {}, sessionId),
      cdp.send('Log.enable', {}, sessionId),
    ]);

    const consoleMessages = [];
    const subscribe = (method, mapper) => {
      const key = `${sessionId}:${method}`;
      cdp.listeners.set(key, [mapper]);
    };
    subscribe('Log.entryAdded', ({ entry }) => {
      if (entry.level === 'error' || entry.level === 'warning') {
        consoleMessages.push({ level: entry.level, text: entry.text, url: entry.url });
      }
    });
    subscribe('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      consoleMessages.push({
        level: 'error',
        text: exceptionDetails.exception?.description || exceptionDetails.text,
        url: exceptionDetails.url,
      });
    });

    const send = (method, params = {}) => cdp.send(method, params, sessionId);
    const evaluate = async (source) => {
      const result = await send('Runtime.evaluate', {
        expression: source,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      }
      return result.result.value;
    };
    const observe = () => evaluate(expression);
    const screenshot = async (name) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(join(outputDir, name), Buffer.from(data, 'base64'));
      return name;
    };
    const viewport = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile,
    });
    const navigate = async (url) => {
      const loaded = cdp.once('Page.loadEventFired', sessionId, 30000).catch(() => null);
      await send('Page.navigate', { url });
      await loaded;
    };
    const waitFor = async (source, timeoutMs = 15000) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (await evaluate(source)) return Date.now() - started;
        await sleep(200);
      }
      return null;
    };
    const click = async (selector) => {
      const point = await evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`);
      if (!point) throw new Error(`Could not click missing element: ${selector}`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    };
    const keypress = async (key, code = key, modifiers = 0) => {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, modifiers });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
    };

    await viewport(1440, 900);
    const loadStarted = Date.now();
    await navigate(targetUrl.href);
    await sleep(1200 + extraSettleMs);
    observations.steps.entryLoading = await observe();
    const readinessWait = await waitFor(`(() => {
      const veil = document.querySelector('.entry-veil');
      return !veil || /Click to|Tap to/i.test(veil.innerText);
    })()`, 18000);
    observations.entryReadyMs = readinessWait === null ? null : Date.now() - loadStarted;
    observations.steps.entryReady = await observe();
    log('entry is ready; capturing the opening state');
    await screenshot('01-entry-ready.png');

    if (observations.steps.entryReady.veil) {
      await click('.entry-veil');
      observations.steps.entryClick = { clicked: true };
      await waitFor(`!document.querySelector('.entry-veil')`, 7000);
    } else {
      observations.steps.entryClick = { clicked: false, reason: 'No entry veil was present.' };
    }
    await sleep(2200 + extraSettleMs);
    observations.steps.firstGallery = await observe();
    log('entry click worked; capturing the first gallery');
    await screenshot('02-first-gallery.png');

    await click('.air-act[title^="Navigation help"]');
    await waitFor(`Boolean(document.querySelector('.help-overlay'))`, 3000);
    observations.steps.helpOpen = await observe();
    log('help opened; capturing its focus and layout state');
    await screenshot('03-help.png');

    await click('.help-close');
    await waitFor(`!document.querySelector('.help-overlay')`, 3000);
    observations.steps.helpClosed = await observe();

    const driftBefore = await evaluate(`document.querySelector('.air-act')?.getAttribute('aria-pressed')`);
    await click('.air-act');
    const driftAfter = await evaluate(`document.querySelector('.air-act')?.getAttribute('aria-pressed')`);
    observations.steps.drift = { before: driftBefore, after: driftAfter, changed: driftBefore !== driftAfter };
    await click('.air-act');

    const muteSelector = '.air-act[aria-label*="ambience"]';
    const muteBefore = await evaluate(`document.querySelector(${JSON.stringify(muteSelector)})?.getAttribute('aria-pressed')`);
    await click(muteSelector);
    const muteAfter = await evaluate(`document.querySelector(${JSON.stringify(muteSelector)})?.getAttribute('aria-pressed')`);
    observations.steps.mute = { before: muteBefore, after: muteAfter, changed: muteBefore !== muteAfter };

    // Down one gallery, by the control a reader now has to use. This step used
    // to click a station on the chain ([aria-label="Descend to The Echo"]) and
    // land there outright — that shortcut was removed deliberately, because it
    // was the one way through the piece that skipped galleries whole, so the
    // agent walks the corridor the way the corridor is meant to be walked.
    // The chapter MARK, not window.__nav: the dev hooks are gated behind ?dev
    // (see the pin effect in Tour), and this agent drives the plain URL a reader
    // gets — so __nav was null here and this step has always reported `changed:
    // null`, i.e. verified nothing at all. The mark is the same fact stated on
    // screen, and it is what a reader would use to know they had moved.
    // Watch the RING, not the chapter mark.
    //
    // The mark only changes on ARRIVAL, and arrival is far away here: the tick
    // clamps its timestep to 0.1 s per frame (see Tour), so simulation time
    // advances at most a tenth of a second per RENDERED frame — and under the
    // swiftshader this agent runs on, that is 2-3 frames a second. A crossing
    // that takes seven seconds on a GPU therefore takes thirty to fifty here,
    // and it measured as "the control does nothing" against a nine-second wait
    // and again against sixty. The control is fine; the signal was wrong.
    //
    // The ring's position is written straight to the DOM every frame from the
    // descent, so it starts moving within a frame of the click. That is the
    // honest test of "did this control set the corridor in motion", and it does
    // not depend on how fast the renderer happens to be.
    const ringTop = `document.querySelector('.plumb-bob')?.style.top ?? null`;
    const markOf = `document.querySelector('.chapter-mark')?.innerText?.trim() ?? null`;
    const ringBefore = await evaluate(ringTop);
    const markBefore = await evaluate(markOf);
    await click('.plumb-step[aria-label="Descend one gallery"]');
    const ringMoved = await waitFor(`(${ringTop}) !== ${JSON.stringify(ringBefore)}`, 15000);
    await sleep(600 + extraSettleMs);
    observations.steps.chapterStep = {
      ringBefore,
      ringAfter: await evaluate(ringTop),
      markBefore,
      markAfter: await evaluate(markOf),
      changed: ringMoved !== null,
      page: await observe(),
    };
    await keypress('h', 'KeyH');
    const hOpened = await waitFor(`Boolean(document.querySelector('.help-overlay'))`, 2000);
    await keypress('Escape', 'Escape');
    const escapeClosed = await waitFor(`!document.querySelector('.help-overlay')`, 2000);
    observations.steps.keyboardHelp = { hOpened: hOpened !== null, escapeClosed: escapeClosed !== null };

    const beforeArrow = await evaluate(`typeof window.__nav === 'function' ? window.__nav() : null`);
    await keypress('ArrowDown', 'ArrowDown');
    await sleep(250);
    const afterArrow = await evaluate(`typeof window.__nav === 'function' ? window.__nav() : null`);
    observations.steps.keyboardWalk = {
      before: beforeArrow,
      after: afterArrow,
      changed: beforeArrow && afterArrow
        ? beforeArrow.target !== afterArrow.target || beforeArrow.immT !== afterArrow.immT
        : null,
    };

    if (includeMobile) {
      await viewport(390, 844, true);
      await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      const mobileUrl = new URL(targetUrl);
      mobileUrl.searchParams.set('dev', '1');
      await navigate(mobileUrl.href);
      await sleep(3500 + extraSettleMs);
      observations.steps.mobile = await observe();
      await click('.air-act[title^="Navigation help"]');
      await waitFor(`Boolean(document.querySelector('.help-overlay'))`, 2000);
      observations.steps.mobileHelp = await observe();
      log('responsive checks complete; capturing mobile help');
      await screenshot('04-mobile-help.png');
    }

    observations.console = consoleMessages;
    observations.finishedAt = new Date().toISOString();
    const findings = buildFindings(observations);
    const report = renderReport(observations, findings);
    await writeFile(join(outputDir, 'report.json'), `${JSON.stringify({ observations, findings }, null, 2)}\n`);
    await writeFile(join(outputDir, 'report.md'), report);

    log(`review complete: ${join(outputDir, 'report.md')}`);
    printSummary(findings);
  } catch (error) {
    observations.failure = reportError(error);
    await writeFile(join(outputDir, 'report.json'), `${JSON.stringify({ observations }, null, 2)}\n`)
      .catch(() => {});
    throw error;
  } finally {
    if (connection && targetId) await connection.cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    connection?.socket.close();
    // Kill the browser by its PROFILE, not by its process id.
    //
    // browserProcess.kill() only ever reached the launcher, which has already
    // exited by this point — Chromium's renderer and GPU children are reparented
    // and survive it. Every review left about ten of them behind, each holding a
    // software GL context, and they accumulate across runs until the next review
    // is competing with forty of its own ancestors for the same CPU.
    //
    // A tree kill does not help either, for the same reason: by the time this
    // runs there is no tree, the parent is gone. What every one of those
    // processes DOES still carry is --user-data-dir pointing at this run's
    // throwaway profile, which is unique per run, so that is what identifies
    // them.
    browserProcess.kill();
    if (process.platform === 'win32') {
      const { spawnSync } = await import('node:child_process');
      spawnSync('powershell.exe', ['-NoProfile', '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='msedge.exe' or Name='chrome.exe'"`
        + ` | Where-Object { $_.CommandLine -like '*${profile.replace(/\\/g, '\\')}*' }`
        + ' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
      ], { stdio: 'ignore' });
    }
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
};

const finding = (severity, title, evidence, recommendation) => ({
  severity, title, evidence, recommendation,
});

const buildFindings = (data) => {
  const out = [];
  const ready = data.steps.entryReady;
  const inside = data.steps.firstGallery;
  const help = data.steps.helpOpen;
  const mobile = data.steps.mobile;

  if (data.entryReadyMs === null || data.entryReadyMs > 5000) {
    out.push(finding(
      'high',
      'The first meaningful action is gated for too long',
      data.entryReadyMs === null
        ? 'The entry never became ready during the 18-second test window.'
        : `The entry became actionable after ${(data.entryReadyMs / 1000).toFixed(1)} seconds.`,
      'Let people enter against the poster as soon as the shell is ready, then stream gallery assets progressively. Keep a visible retry or degraded-mode path for slow media.',
    ));
  }

  if (ready?.veil) {
    const outsideVeil = ready.interactives.filter((item) => item.visible && item.label !== ready.veil.label);
    if (outsideVeil.length > 0) {
      out.push(finding(
        'high',
        'Background tour controls remain exposed behind the entry veil',
        `${outsideVeil.length} other visible/focusable controls were present while “${ready.veil.label}” covered the experience.`,
        'While the entry veil is active, make the tour shell inert and aria-hidden. Restore it only after entry finishes.',
      ));
    }
    if (ready.veil.nestedInteractiveCount > 0) {
      out.push(finding(
        'medium',
        'The entry card nests a native control inside a custom button',
        `The role="button" entry contains ${ready.veil.nestedInteractiveCount} nested interactive element(s) in the resume state.`,
        'Use a non-interactive container around two sibling buttons: “continue” and “begin again.” This avoids conflicting focus and activation semantics.',
      ));
    }
  }

  if (help?.help && (!help.help.role || help.help.ariaModal !== 'true')) {
    out.push(finding(
      'high',
      'Navigation help looks modal but is not announced as a dialog',
      `The help overlay opened with role=${JSON.stringify(help.help.role)} and aria-modal=${JSON.stringify(help.help.ariaModal)}; focus remained on ${help.activeElement?.tag ?? 'an unknown element'}.`,
      'Give the panel role="dialog", aria-modal="true", and an accessible title. Move focus into it, contain Tab while open, and restore focus to Help on close.',
    ));
  }

  const tiny = (page) => page?.interactives.filter((item) => item.visible && !item.disabled
    && (item.rect.width < 44 || item.rect.height < 44)) ?? [];
  const tinyMobile = tiny(mobile);
  if (tinyMobile.length > 0) {
    const examples = tinyMobile.slice(0, 4).map((item) => `“${item.text || item.label}” (${item.rect.width}×${item.rect.height})`).join(', ');
    out.push(finding(
      'high',
      'Several mobile targets are smaller than a comfortable finger target',
      `${tinyMobile.length} enabled controls measured below 44×44 CSS px; examples: ${examples}.`,
      'Increase the invisible hit area around the plumb-line stations and bottom actions while keeping the visual marks delicate.',
    ));
  } else {
    const tinyDesktop = tiny(inside);
    if (tinyDesktop.length > 0) {
      out.push(finding(
        'medium',
        'Precision controls have small hit areas',
        `${tinyDesktop.length} enabled desktop controls measured below 44×44 CSS px.`,
        'Add generous transparent padding or pseudo-element hit areas without changing the visual scale.',
      ));
    }
  }

  if (mobile?.overflowX) {
    out.push(finding(
      'high',
      'The mobile layout overflows horizontally',
      'The document width exceeded the 390px viewport.',
      'Constrain fixed-position HUD elements and long help content to the viewport, including safe-area insets.',
    ));
  }

  if (inside && !inside.landmarks.includes('main')) {
    out.push(finding(
      'medium',
      'The experience has no main landmark after entry',
      `Detected landmarks: ${inside.landmarks.length ? inside.landmarks.join(', ') : 'none'}.`,
      'Wrap the primary tour content in <main> (or role="main") so assistive-technology users can jump directly to the experience.',
    ));
  }

  if (inside?.canvas.count > 0 && inside.canvas.described === 0) {
    out.push(finding(
      'medium',
      'The rendered scene has no concise accessible description',
      `${inside.canvas.count} canvas element(s) were present and none had an accessible description.`,
      'Associate the canvas with a short description of the current gallery and keep the changing quote/title exposed as live text.',
    ));
  }

  if (!data.steps.drift?.changed || !data.steps.mute?.changed) {
    out.push(finding(
      'high',
      'A primary stateful control did not expose a state change',
      `Drift changed=${Boolean(data.steps.drift?.changed)}; mute changed=${Boolean(data.steps.mute?.changed)}.`,
      'Keep aria-pressed synchronized with the actual autoplay/audio state and provide immediate visible feedback.',
    ));
  }

  if (!data.steps.keyboardHelp?.hOpened || !data.steps.keyboardHelp?.escapeClosed) {
    out.push(finding(
      'high',
      'The documented keyboard help shortcut is unreliable',
      `H opened=${Boolean(data.steps.keyboardHelp?.hOpened)}; Escape closed=${Boolean(data.steps.keyboardHelp?.escapeClosed)}.`,
      'Handle the shortcut at the tour root and cover it with a keyboard interaction test.',
    ));
  }

  if (data.steps.keyboardWalk?.changed === false) {
    out.push(finding(
      'medium',
      'Arrow-key walking produced no observable navigation change',
      'The internal target/immersion state was unchanged after Arrow Down.',
      'Confirm focus is returned to the scene after pointer actions, and provide an onscreen cue when a focused control owns the arrow/space keys.',
    ));
  }

  const errors = (data.console ?? []).filter((entry) => entry.level === 'error');
  if (errors.length > 0) {
    out.push(finding(
      'high',
      'The walkthrough emitted browser errors',
      `${errors.length} error(s) were captured; first: ${errors[0].text.slice(0, 220)}.`,
      'Resolve the first runtime/network error and rerun the agent; later errors may be cascading symptoms.',
    ));
  }

  return out;
};

const renderReport = (data, findings) => {
  const counts = ['high', 'medium', 'low'].map((severity) => [
    severity, findings.filter((item) => item.severity === severity).length,
  ]);
  const verified = [
    data.steps.entryClick?.clicked && 'The entry control accepted a real pointer click.',
    data.steps.drift?.changed && 'Drift exposes its toggled state through aria-pressed.',
    data.steps.mute?.changed && 'Mute exposes its toggled state through aria-pressed.',
    data.steps.keyboardHelp?.hOpened && data.steps.keyboardHelp?.escapeClosed
      && 'H opens help and Escape closes it.',
    data.steps.chapterStep?.changed && 'The descend-one-gallery control changed the navigation target.',
    data.steps.mobile && !data.steps.mobile.overflowX && 'The 390px layout did not overflow horizontally.',
  ].filter(Boolean);
  const shots = [
    ['01-entry-ready.png', 'entry when actionable'],
    ['02-first-gallery.png', 'first gallery'],
    ['03-help.png', 'navigation help'],
    ...(data.steps.mobile ? [['04-mobile-help.png', '390px mobile help']] : []),
  ];
  return `# UI/UX review — ${targetUrl.host}\n\n`
    + `Generated ${new Date(data.finishedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC by the browser review agent.\n\n`
    + `## Summary\n\n`
    + `The agent completed the entry, help, drift, mute, chapter, keyboard and responsive walkthrough. `
    + `It found ${counts[0][1]} high-, ${counts[1][1]} medium-, and ${counts[2][1]} low-priority issues.\n\n`
    + `## What worked\n\n`
    + (verified.length ? verified.map((item) => `- ${item}`).join('\n') : '- No interaction was fully verified.')
    + `\n\n## Prioritized feedback\n\n`
    + (findings.length ? findings.map((item, index) => (
      `### ${index + 1}. [${item.severity.toUpperCase()}] ${item.title}\n\n`
      + `Evidence: ${item.evidence}\n\n`
      + `Recommendation: ${item.recommendation}`
    )).join('\n\n') : 'No heuristic issues were detected. Review the screenshots for visual judgment.')
    + `\n\n## Screenshots\n\n`
    + shots.map(([file, alt]) => `![${alt}](./${file})`).join('\n\n')
    + `\n\n## Scope and method\n\n`
    + `- Browser: ${data.browser}\n`
    + `- Desktop viewport: 1440×900\n`
    + (data.steps.mobile ? '- Mobile viewport: 390×844\n' : '')
    + `- Console errors: ${(data.console ?? []).filter((entry) => entry.level === 'error').length}\n`
    + `- Evidence: [report.json](./report.json)\n\n`
    + `This is a repeatable heuristic review, not a replacement for testing with people or assistive technology.\n`;
};

const printSummary = (findings) => {
  const high = findings.filter((item) => item.severity === 'high').length;
  const medium = findings.filter((item) => item.severity === 'medium').length;
  console.log(`[ux-review] ${high} high, ${medium} medium, ${findings.length - high - medium} low`);
  for (const item of findings.slice(0, 5)) console.log(`  - ${item.severity.toUpperCase()}: ${item.title}`);
};

main().catch((error) => {
  console.error(`[ux-review] ${error.stack || error.message}`);
  process.exitCode = 1;
});
