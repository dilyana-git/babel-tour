// Rendered integration check: input, collision, book, return, and screenshots.
// Start Vite, then node tools/balcony-check.mjs. No extra dependencies.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { moveVisitor, nearbyObject, PILLARS } from '../src/balconyMovement.js';

// Exercise the geometry limits, including long frames and oblique wall travel.
let p = { x: 0, z: 1.5 };
p = moveVisitor(p, 0, -100);
assert(p.z >= -4.15 && p.z < -4.05, 'railing blocks forward travel');
p = moveVisitor({ x: 0, z: -1 }, 100, 0);
assert(p.x <= 4.75 && p.x > 4.6, 'side wall blocks lateral travel');
p = moveVisitor({ x: 3.15, z: 0 }, 0, -5);
assert(p.z > -2.03, 'column blocks straight approach');
for (const column of PILLARS) assert(Math.hypot(p.x - column.x, p.z - column.z) >= column.radius + 0.24);
assert.equal(nearbyObject({ x: 3.9, z: -2.1 }), 'book');
assert.equal(nearbyObject({ x: 0, z: 3.7 }), 'door');

const exe = [process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).find(existsSync);
assert(exe, 'Chromium must be available');
const port = 9336;
const graphics = process.env.BABEL_BROWSER_GRAPHICS ?? 'software';
assert(['software', 'hardware'].includes(graphics), 'BABEL_BROWSER_GRAPHICS must be software or hardware');
const browser = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`,
  // No extensions. This profile is a throwaway, but Edge installs its own
  // policy-managed ones into it anyway, and their content scripts log to the
  // same console this check asserts is clean — a run once failed on an ad
  // blocker's "Cannot read properties of undefined (reading 'useCache')",
  // which says nothing whatsoever about the balcony. The assertion is about
  // THIS app's errors; it should not be able to see anyone else's.
  '--disable-extensions', '--disable-component-extensions-with-background-pages',
  '--no-first-run', '--no-default-browser-check', '--use-gl=angle',
  ...(graphics === 'software' ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
    : [process.platform === 'win32' ? '--use-angle=d3d11' : '--use-angle=default']),
  `--user-data-dir=${resolve(tmpdir(), 'babel-balcony-check')}`, 'about:blank'],
{ stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = resolve('.ux-review/balcony'); mkdirSync(out, { recursive: true });
let ws;
try {
  let version;
  for (let i = 0; i < 100; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(150); }
  }
  assert(version, 'browser debugging endpoint');
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  // Errors from the PAGE, not from whatever the browser brought with it. Edge
  // installs policy-managed extensions into even a throwaway profile and
  // --disable-extensions does not override policy, so their content scripts throw
  // into the very console these checks collect: one run failed on an ad blocker's
  // "Cannot read properties of undefined (reading 'useCache')" plus the two
  // extension-messaging errors that always trail it. None of that is a thing the
  // tour did. Filtered by ORIGIN rather than by message, so it cannot quietly
  // swallow a real error that happens to read similarly.
  const fromPage = (d) => {
    const url = d?.url || d?.stackTrace?.callFrames?.[0]?.url || ''
    const text = (d?.exception?.description || d?.text || '')
    if (url.startsWith('chrome-extension://') || text.includes('chrome-extension://')) return false
    // The extension messaging API's own failures arrive with no URL at all.
    if (!url && /Receiving end does not exist|message channel closed/.test(text)) return false
    return true
  }
  let id = 0; const pending = new Map(); const errors = [];
  ws.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown' && fromPage(m.params.exceptionDetails)) errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
  });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); rej(new Error(`Timed out: ${method}`)); }, 30000);
    pending.set(requestId, m => { clearTimeout(timer); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); });
    ws.send(JSON.stringify({ id: requestId, method, params, sessionId }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const cmd = (method, params) => send(method, params, sessionId);
  const ev = async expression => {
    const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.exception?.description || r.exceptionDetails.text}; page: ${await ev('document.body.innerText.slice(-1000)')}; browser errors: ${errors.join('; ')}`);
    return r.result?.value;
  };
  // 90s, not 40. Walking is integrated per FRAME with dt clamped to 0.05, so
  // wall-clock walking time is inversely proportional to frame rate — under
  // swiftshader a scene 1.5x heavier takes 1.5x longer to cross the same room,
  // and the old budget was sized against a much barer version of it. The
  // timeout is harness plumbing, not the thing under test; what IS worth
  // watching is the frame rate itself, so the report carries it now (see
  // `fps` below) and a real cost regression shows up as a number rather than
  // as a mystery hang three assertions later.
  const until = async (expression, label, timeout = 90000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await ev(expression)) return; await sleep(160); }
    throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(await ev('window.__balcony?.()'))}`);
  };
  const key = (code, type) => cmd('Input.dispatchKeyEvent', { type, code,
    key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code,
    windowsVirtualKeyCode: code.startsWith('Key') ? code.charCodeAt(3) : ({ ArrowRight: 39, Escape: 27 }[code] || 0) });
  const walk = async (code, condition, label) => {
    await key(code, 'rawKeyDown');
    try { await until(condition, label); } finally { await key(code, 'keyUp'); }
  };
  const shot = async name => {
    await sleep(1200);
    const { data } = await cmd('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(out, `${name}.png`), Buffer.from(data, 'base64'));
  };
  await cmd('Runtime.enable'); await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const baseUrl = (process.env.BABEL_TEST_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  await cmd('Page.navigate', { url: `${baseUrl}/?plates&dev=1` }); // the balcony belongs to the plate tour
  await until('typeof window.__at === "function"', 'tour readiness');
  await ev('window.__at(0)');
  await until('document.querySelector(".air-act.is-explore") && !document.querySelector(".tour-root").inert', 'entry');
  await ev('document.querySelector(".air-act.is-explore").click()');
  await until('window.__balcony?.().ready', 'balcony readiness');
  await sleep(9000);
  // Median frame interval, measured from inside rAF. Swiftshader numbers do not
  // predict a GPU — see composer-msaa-blackout for how badly it can disagree —
  // but they are comparable RUN TO RUN on this machine, which is what makes
  // them useful as a regression signal.
  const fps = await ev(`new Promise(res => {
    const t = []; let last = performance.now(); const end = last + 5000;
    // A wall-clock escape, because requestAnimationFrame STOPS DEAD under
    // swiftshader — it is written down in this project's headless notes and it
    // is why nothing here may depend on rAF alone to finish. Without this the
    // probe simply never resolves, Runtime.evaluate hits its own 30s timeout,
    // and the whole check dies somewhere with no relation to what broke.
    const bail = setTimeout(() => res({ frames: t.length, medianMs: null, stalled: true }), 12000);
    const tick = (now) => { t.push(now - last); last = now;
      if (now < end) requestAnimationFrame(tick);
      else { clearTimeout(bail); t.sort((a, b) => a - b);
        res({ frames: t.length, medianMs: Math.round(t[t.length >> 1]) }); } };
    requestAnimationFrame(tick);
  })`);
  await shot('01-arrival');
  // A real click grants the user activation required for mouse capture.
  const mouseButton = await ev('(()=>{const r=document.querySelector(".balcony-mouse").getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', ...mouseButton, button: 'left', clickCount: 1 });
  await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mouseButton, button: 'left', clickCount: 1 });
  await until('!!document.pointerLockElement || !!document.querySelector(".balcony-lock-error")', 'mouse look response');
  const mouseCaptured = await ev('!!document.pointerLockElement');
  if (mouseCaptured) {
    await key('Escape', 'rawKeyDown'); await key('Escape', 'keyUp');
    // The native lock property can clear before pointerlockchange is delivered
    // to React. Wait for its control state too, before starting a new held key.
    await until('!document.pointerLockElement && !document.querySelector(".balcony-mouse").disabled', 'Escape releases mouse look');
    assert.equal(await ev('!!window.__balcony'), true, 'releasing mouse keeps balcony open');
  }
  const nav = await ev('JSON.stringify(window.__nav())');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  await walk('KeyW', 'window.__balcony().z < -4.08', 'walk to railing');
  const atRail = await ev('window.__balcony()');
  await key('KeyW', 'rawKeyDown'); await sleep(1000); await key('KeyW', 'keyUp');
  assert((await ev('window.__balcony().z')) >= -4.15, 'rendered railing collision');
  const stopped = await ev('window.__balcony().z'); await sleep(450);
  assert.equal(await ev('window.__balcony().z'), stopped, 'stops on key release');
  await shot('02-railing');
  assert.equal(await ev('JSON.stringify(window.__nav())'), nav, 'tour remains paused');
  await key('Escape', 'rawKeyDown'); await key('Escape', 'keyUp');
  await until('!window.__balcony', 'return to tour');
  assert.equal(await ev('document.activeElement.classList.contains("is-explore")'), true, 'focus restored');
  await ev('document.querySelector(".air-act.is-explore").click()');
  await until('window.__balcony?.().ready', 'reentry');
  await walk('KeyD', 'window.__balcony().x > 3.9', 'strafe to aisle');
  await walk('KeyW', 'window.__balcony().near === "book"', 'approach book');
  await key('KeyE', 'rawKeyDown'); await key('KeyE', 'keyUp');
  await until('!!document.querySelector(".balcony-note")', 'book interaction');
  assert.equal(await ev('document.activeElement.textContent.includes("Leave the book")'), true, 'reading focus');
  await shot('03-book');
  await key('KeyW', 'rawKeyDown'); await sleep(300); await key('KeyW', 'keyUp');
  assert.deepEqual(await ev('window.__balcony().keys'), [], 'book blocks walking');
  await ev('document.querySelector(".balcony-note button").click()');
  // Returning through the entrance is another interaction, with the same tour state.
  await ev('document.querySelector(".balcony-return").click()');
  await until('!window.__balcony', 'leave book room');
  await ev('document.querySelector(".air-act.is-explore").click()');
  await until('window.__balcony?.().ready', 'door reentry');
  await walk('KeyS', 'window.__balcony().near === "door"', 'find entrance');
  await walk('ArrowRight', 'window.__balcony().yaw < -3.05', 'turn around');
  await shot('04-entrance');
  await key('KeyE', 'rawKeyDown'); await key('KeyE', 'keyUp');
  await until('!window.__balcony', 'door returns to tour');
  // Touch layout, real pointer press/release, and drag looking.
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await ev('document.querySelector(".air-act.is-explore").click()');
  await until('window.__balcony?.().ready', 'mobile reentry');
  await sleep(1800); await shot('05-mobile');
  assert.equal(await ev('document.documentElement.scrollWidth <= innerWidth'), true, 'mobile fits viewport');
  assert.equal(await ev('getComputedStyle(document.querySelector(".balcony-touch")).display'), 'grid', 'touch pad visible');
  const touchForward = await ev('(()=>{const r=document.querySelector(".balcony-touch button").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:1}})()');
  const beforeTouch = await ev('window.__balcony().z');
  await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchForward] });
  await until(`window.__balcony().z < ${beforeTouch - 0.2}`, 'touch movement');
  await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await until('window.__balcony().keys.length === 0', 'touch release');
  const yawBefore = await ev('window.__balcony().yaw');
  await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 300, id: 2 }] });
  await cmd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 250, y: 320, id: 2 }] });
  await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(Math.abs(await ev('window.__balcony().yaw') - yawBefore) > 0.05, 'touch drag looks around');
  assert.deepEqual(errors, [], 'no browser errors');
  console.log(JSON.stringify({ passed: true, fps, atRail, mouseCaptured, checks: ['collision', 'stop on release', 'paused tour', 'focus restoration', 'strafe', 'book', 'door', 'mobile layout', 'touch walk and drag'], screenshots: out }, null, 2));
} finally {
  ws?.close(); browser.kill();
}
