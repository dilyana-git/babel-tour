// One command for a picture of the world: starts its own Vite (no HMR, its own
// dep cache) and a headless Chromium-family browser, waits for the world to be
// built and drawn, puts the eye where it is asked, and writes PNGs. Works on
// Windows (Edge or Chrome, real GPU) and Linux (Chromium, software WebGL).
//
//   node tools/shot.mjs                          the map, to .ux-review/shots/map.png
//   node tools/shot.mjs --room=1                 stand in the Echo
//   node tools/shot.mjs --room=0,1,2 --up        several rooms, at their vantages
//   node tools/shot.mjs --room=3 --look=0.6,-0.3 turn the head (yaw, pitch; radians)
//   node tools/shot.mjs --eye=0,200,300:0,0,0    look from a point at a point
//   node tools/shot.mjs --ab=wmap5=old           the same frame without and with a
//                                                flag, in one browser session
//   node tools/shot.mjs --query=wechofix=old:3   any query string on every shot
//
// Options: --size=WxH (960x600; keep it small under software WebGL), --out=DIR,
// --name=PREFIX, --settle=MS (extra wait after the frames), --frames=N (frames
// drawn before a shot, 30), --motion (no reduced-motion emulation: the opening
// and flights play), --gpu / --software (graphics; default GPU on Windows and
// macOS, software on Linux), --browser=PATH (or BROWSER_PATH), --url=URL (reuse
// a running dev server; BABEL_TEST_URL works too), --strict (exit 1 on a page
// error or a console error, e.g. a shader that does not compile).
//
// It prints each file it wrote and any console errors the page logged.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as netServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`Unknown argument ${a}`);
  return [m[1], m[2] ?? true];
}));
if (args.help) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^\/\/ ?/gm, ''));
  process.exit(0);
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [W, H] = String(args.size ?? '960x600').split('x').map(Number);
const OUT = resolve(ROOT, args.out ?? '.ux-review/shots');
const FRAMES = Number(args.frames ?? 30);
const SETTLE = Number(args.settle ?? 1500);
const GPU = args.gpu ? true : args.software ? false : process.platform !== 'linux';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the browser ─────────────────────────────────────────────────────────────
function findBrowser() {
  const asked = args.browser ?? process.env.BROWSER_PATH;
  if (asked) return asked;
  const pf = process.env['PROGRAMFILES'] ?? 'C:\\Program Files', pf86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA ?? '';
  const known = {
    win32: [
      `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${local}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome', '/usr/bin/microsoft-edge', '/snap/bin/chromium',
    ],
  }[process.platform] ?? [];
  const found = known.find((p) => existsSync(p));
  if (!found) throw new Error('No Chromium-family browser found: pass --browser=PATH or set BROWSER_PATH.');
  return found;
}

async function startBrowser() {
  // A profile kept between runs: a cold one draws no frames on its first run.
  const profile = join(ROOT, 'node_modules', '.cache', `babel-shot-${GPU ? 'gpu' : 'sw'}`);
  mkdirSync(profile, { recursive: true });
  rmSync(join(profile, 'DevToolsActivePort'), { force: true });
  const graphics = GPU
    ? ['--ignore-gpu-blocklist', process.platform === 'win32' ? '--use-angle=d3d11' : '--use-angle=default']
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const child = spawn(findBrowser(), [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--hide-scrollbars', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    ...graphics, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 300 && !existsSync(portFile); i++) await pause(100);
  if (!existsSync(portFile)) { child.kill(); throw new Error('The browser did not open its debugging port.'); }
  const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n');
  const cdp = await connect(`ws://127.0.0.1:${port}${path}`);
  return { cdp, close: async () => { await cdp.send('Browser.close').catch(() => {}); cdp.ws.close(); setTimeout(() => child.kill(), 2000).unref(); } };
}

// A DevTools Protocol client on Node's own WebSocket: send(method, params,
// sessionId) and on(method, fn).
function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const waiting = new Map(), handlers = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && waiting.has(msg.id)) {
      const { ok, fail } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) fail(new Error(`${msg.error.message} ${msg.error.data ?? ''}`)); else ok(msg.result);
    } else if (msg.method) handlers.get(msg.method)?.forEach((fn) => fn(msg.params, msg.sessionId));
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const n = ++id;
    waiting.set(n, { ok, fail });
    ws.send(JSON.stringify({ id: n, method, params, sessionId }));
  });
  const on = (method, fn) => handlers.set(method, [...(handlers.get(method) ?? []), fn]);
  return new Promise((ok, fail) => { ws.onopen = () => ok({ ws, send, on }); ws.onerror = () => fail(new Error(`Cannot reach ${url}`)); });
}

// ── the app ─────────────────────────────────────────────────────────────────
const freePort = () => new Promise((ok, fail) => {
  const s = netServer();
  s.on('error', fail);
  s.listen(0, 'localhost', () => { const { port } = s.address(); s.close(() => ok(port)); });
});

async function startApp() {
  const given = args.url ?? process.env.BABEL_TEST_URL;
  if (given) return { url: String(given).replace(/\/$/, ''), close: async () => {} };
  const { createServer } = await import('vite');
  const port = await freePort();
  const server = await createServer({
    root: ROOT, logLevel: 'error', cacheDir: 'node_modules/.vite-shot',
    server: { host: 'localhost', port, strictPort: true, hmr: false, watch: null },
  });
  await server.listen();
  return { url: `http://localhost:${port}`, close: () => server.close() };
}

// ── a shot ──────────────────────────────────────────────────────────────────
async function run() {
  const rooms = args.room === undefined ? [null] : String(args.room).split(',').map(Number);
  const base = typeof args.query === 'string' ? args.query.replace(/^\?/, '') : '';
  const variants = typeof args.ab === 'string'
    ? [['a', base], ['b', [base, args.ab].filter(Boolean).join('&')]]
    : [['', base]];
  mkdirSync(OUT, { recursive: true });

  const app = await startApp();
  const browser = await startBrowser();
  const { cdp } = browser;
  const errors = [];
  cdp.on('Runtime.exceptionThrown', (p) => errors.push(`exception: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`));
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') errors.push(`console.error: ${p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400)}`);
  });
  const written = [];
  try {
    for (const [tag, query] of variants) {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId: s } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      const page = (method, params) => cdp.send(method, params, s);
      const evaluate = async (expression) => {
        const r = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(`${expression.slice(0, 80)}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
        return r.result.value;
      };
      await page('Runtime.enable');
      await page('Page.enable');
      await page('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 600 });
      if (W < 600) await page('Emulation.setTouchEmulationEnabled', { enabled: true });
      await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: args.motion ? 'no-preference' : 'reduce' }] });
      await page('Page.navigate', { url: `${app.url}/${query ? `?${query}` : ''}` });
      // (polled in the page: under software WebGL the world takes a while)
      const ready = await evaluate(`new Promise((ok) => { const t0 = performance.now(); const t = setInterval(() => {
        if (window.__worldJump && document.querySelector('.entry-map.is-world')) { clearInterval(t); ok(true); }
        else if (performance.now() - t0 > 300000) { clearInterval(t); ok(false); }
      }, 200); })`);
      if (!ready) throw new Error('The world never finished building (5 min).');
      const frames = () => evaluate(`new Promise((ok) => { let n = ${FRAMES}; const f = () => (--n > 0 ? requestAnimationFrame(f) : ok(true)); requestAnimationFrame(f); })`);
      await frames();
      for (const room of rooms) {
        if (room !== null) await evaluate(`window.__worldJump(${room}, ${!!args.up})`);
        if (typeof args.look === 'string') await evaluate(`window.__worldLook(${args.look})`);
        if (typeof args.eye === 'string') {
          const [from, at] = args.eye.split(':').map((v) => `[${v}]`);
          await evaluate(`window.__worldEye({ from: ${from}, at: ${at} })`);
        }
        await frames();
        await pause(SETTLE);
        const name = [args.name, room === null ? 'map' : `room${room}${args.up ? '-up' : ''}`, tag].filter(Boolean).join('-');
        const { data } = await page('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
        const file = join(OUT, `${name}.png`);
        writeFileSync(file, Buffer.from(data, 'base64'));
        written.push(file);
        console.log(`${file}${tag ? `  (${query || 'no flags'})` : ''}`);
      }
      await cdp.send('Target.closeTarget', { targetId });
    }
  } finally {
    await browser.close();
    await app.close();
  }
  if (errors.length) console.log(`\n${errors.length} page error(s):\n${[...new Set(errors)].join('\n')}`);
  return args.strict && errors.length ? 1 : 0;
}

run().then((code) => process.exit(code), (e) => { console.error(e.message); process.exit(1); });
