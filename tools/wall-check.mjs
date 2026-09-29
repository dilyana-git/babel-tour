// ── What the walk passes through ─────────────────────────────────────────────
// Every leg of the world tour, and every climb to a vantage inside a room, felt
// out from the inside: at forty points along each one it stands where the camera
// will stand and asks the geometry what is within reach (src/world/probe.js). It
// fails if the eye is ever inside the stone, or closer to it than a shoulder.
//
// It exists because of what it caught the day it was written. Every hallway in
// the Library was plugged: a gallery's walls were a slab with a room-shaped
// hole in it, the hole had to stop 0.05 short of the slab's outline, and that
// sliver stood across the doorway at full height and full width. You walked up
// a corridor that ended in stone, and then you went through it. Underneath that
// the holes were wound the same way round as their outlines, so every wall in
// the world was missing its inner face and a gallery was see-through from
// inside. Neither is visible in a screenshot of a still room, and neither is a
// thing any linter, build or smoke test can see: the walk is what sees them.
//
// Deliberately NOT a pixel test — see tools/walk-check.mjs on why beauty is
// judged on the real GPU by eye. This asks a question with a number for an
// answer: how close, and to what.
//
// Start the app first (npm run dev), then: npm run check:walls

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const URL_ = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://localhost:5173/?dev=1';
const SAMPLES = Number(process.env.SAMPLES || 40);
// A reader is 18 units tall, so 1 unit is about 9 cm.
const SHOULDER = 4;
const BURIED = 0.2;

const EXE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find(existsSync);
if (!EXE) {
  console.error('No Chromium found. Set BROWSER_PATH to one.');
  process.exit(1);
}
const PORT = 9337;
// A throwaway profile, thrown away: a probe profile that survives a killed run
// comes back up with an empty page and no error, which reads as a broken app.
const PROFILE = (process.env.TEMP || '/tmp') + '/wall-probe';
rmSync(PROFILE, { recursive: true, force: true });
const b = spawn(EXE, [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run',
  '--disable-extensions', '--disable-component-extensions-with-background-pages',
  '--no-default-browser-check', '--use-gl=angle', '--use-angle=swiftshader',
  '--window-size=520,360', '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver;
for (let i = 0; i < 100; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { ver = await r.json(); break; } } catch { /* still starting */ }
  await sleep(150);
}
if (!ver) {
  console.error('Chromium never exposed its debugging endpoint.');
  b.kill();
  process.exit(1);
}
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const waiting = new Map();
const errs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    const url = d?.url || d?.stackTrace?.callFrames?.[0]?.url || '';
    const text = d?.exception?.description || d?.text || '';
    // The browser's own policy-managed extensions throw into this console too.
    if (!url.startsWith('chrome-extension://') && !text.includes('chrome-extension://')) errs.push(text.split('\n')[0]);
  }
});
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const n = ++id;
  waiting.set(n, res);
  ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const { result: t } = await send('Target.createTarget', { url: 'about:blank' });
const { result: s } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
const sid = s.sessionId;
await send('Runtime.enable', {}, sid);
await send('Page.enable', {}, sid);
await send('Page.navigate', { url: URL_ }, sid);
const ev = async (expr) => (await send('Runtime.evaluate',
  { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result?.result?.value;
const waitFor = async (expr, timeout = 120000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await ev(expr)) return true; await sleep(400); }
  return false;
};
await waitFor(`document.readyState === 'complete'`, 30000);
if (!await waitFor(`typeof window.__worldSweep === 'function'`)) {
  console.error('__worldSweep never appeared. The dev hooks are stripped from a production build;'
    + ' this needs ?dev=1 and the world tour (not ?plates).');
  if (!await ev(`document.getElementById('root').innerHTML.length`)) console.error('The page is empty — nothing rendered at all.');
  for (const e of [...new Set(errs)].slice(0, 5)) console.error('   ' + e);
  ws.close(); b.kill(); process.exit(1);
}

const NAMES = ['Vestibule', 'Echo', 'Silence', 'Vertigo', 'Door', 'Pergola', 'Bridge', 'Maze'];
// Every leg of the walk, then the climbs INSIDE a room to its vantage
// (buildWorld's VANTAGES — the Echo's crossing), which `__worldSweep` gives back
// when it is asked for a room to itself, and then the ways on to the rooms
// either side set off from up there (`off`), which are walks of their own.
const VANTAGES = JSON.parse(await ev('JSON.stringify(Object.keys(window.__worldVantages ?? {}).map(Number))') ?? '[]');
const RUNS = [
  ...NAMES.slice(1).map((_, k) => [k, k + 1]),
  ...VANTAGES.map((i) => [i, i]),
  ...VANTAGES.flatMap((i) => [i - 1, i + 1].filter((j) => j >= 0 && j < NAMES.length).map((j) => [i, j, true])),
];
let failed = 0;
for (const [from, to, off = false] of RUNS) {
  const climb = from === to;
  const raw = await ev(`JSON.stringify(window.__worldSweep(${from}, ${to}, ${SAMPLES}, undefined, { off: ${off} }))`);
  if (typeof raw !== 'string') {
    console.log(`${from}→${to}: the sweep itself failed`);
    failed += 1;
    continue;
  }
  const { kind, duration, samples } = JSON.parse(raw);
  const bad = samples.filter((x) => x.nearest && (x.nearest.d < SHOULDER || x.inside > BURIED));
  const worst = samples.reduce((a, x) => (x.nearest && (!a || x.nearest.d < a.nearest.d) ? x : a), null);
  console.log(climb
    ? `${from}↑     ${NAMES[from]} → its vantage  (climb, ${duration}s)`
    : off
      ? `${from}↑→${to} ${NAMES[from]}'s vantage → ${NAMES[to]}  (${kind}, ${duration}s)`
      : `${from}→${to}  ${NAMES[from]} → ${NAMES[to]}  (${kind}, ${duration}s)`);
  console.log(`   nearest the walk comes: ${worst ? `${worst.nearest.d} to the ${worst.nearest.what} at u=${worst.u}` : 'nothing within reach'}`);
  if (!bad.length) continue;
  failed += 1;
  console.log(`   THROUGH OR TOO CLOSE at ${bad.length} of ${samples.length} points:`);
  for (const x of bad.slice(0, 10)) {
    console.log(`     u=${String(x.u).padEnd(5)} ${x.nearest.d} to the ${x.nearest.what}`
      + `${x.nearest.back ? ' (from INSIDE it)' : ''}, ${Math.round(x.inside * 100)}% of the fan buried`
      + `   [${Object.entries(x.touching).map(([k, v]) => `${k}:${v.d}`).join(' ')}]`);
  }
  if (bad.length > 10) console.log(`     … and ${bad.length - 10} more`);
}
console.log('');
console.log(failed
  ? `FAILED — ${failed} of the ${RUNS.length} ways through passes through something, or shaves it closer than ${SHOULDER} (about 40 cm).`
  : `clean — all ${RUNS.length} ways through walked, nothing closer than a shoulder (${SHOULDER}, about 40 cm) and never inside anything`);
for (const e of [...new Set(errs)].slice(0, 5)) console.log('   page error: ' + e);
ws.close();
b.kill();
process.exit(failed ? 1 : 0);
