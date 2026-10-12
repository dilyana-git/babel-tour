// The world's first load, measured without a GPU and without drawing a frame
// (a frame under software WebGL takes minutes; this takes under a minute).
// It builds the world in a headless page exactly as WorldContent does
// (tools/load-bench.page.js) and reports:
//   - each section of the build, in milliseconds on the main thread
//   - the shader programs the world asks for, which on a GPU is most of the
//     wait after the build (compiled in parallel, but each one costs)
//   - the textures it uploads, and their size
//   - a fingerprint of what was built (every geometry, transform and
//     instance): a change meant only to make the build faster must leave it
//     the same
//
//   npm run bench                     one run
//   npm run bench -- --runs=3         the median of three
//   npm run bench -- --programs       and every program, by material and key
//   npm run bench -- --textures       and every texture image, largest first
//   npm run bench -- --profile        and where the build's time goes, by function
//   npm run bench -- --query=wmap5=old   with a query string
//   npm run bench -- --warmcheck      once with the shaders started at the end
//                                     only, and once as the world starts them
//                                     (while it is built): the two must make
//                                     the same shader sources
//
// Options: --browser=PATH (or BROWSER_PATH), --out=FILE (the last run as JSON).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as netServer } from 'node:net';
import { join } from 'node:path';
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
const RUNS = args.warmcheck ? 2 : Number(args.runs ?? 1);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const asked = args.browser ?? process.env.BROWSER_PATH;
  if (asked) return asked;
  const pf = process.env.PROGRAMFILES ?? 'C:\\Program Files', pf86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
  const known = [
    '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const found = known.find((p) => existsSync(p));
  if (!found) throw new Error('No Chromium-family browser found: pass --browser=PATH or set BROWSER_PATH.');
  return found;
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const waiting = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && waiting.has(msg.id)) {
      const { ok, fail } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) fail(new Error(`${msg.error.message} ${msg.error.data ?? ''}`)); else ok(msg.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const n = ++id;
    waiting.set(n, { ok, fail });
    ws.send(JSON.stringify({ id: n, method, params, sessionId }));
  });
  return new Promise((ok, fail) => { ws.onopen = () => ok({ ws, send }); ws.onerror = () => fail(new Error(`Cannot reach ${url}`)); });
}

async function startBrowser() {
  const profile = join(ROOT, 'node_modules', '.cache', 'babel-bench');
  mkdirSync(profile, { recursive: true });
  for (const f of ['DevToolsActivePort', 'SingletonLock', 'SingletonSocket', 'SingletonCookie']) rmSync(join(profile, f), { force: true });
  const child = spawn(findBrowser(), [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    // (nothing is drawn: software GL is enough to make the programs)
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 300 && !existsSync(portFile); i++) await pause(100);
  if (!existsSync(portFile)) { child.kill(); throw new Error('The browser did not open its debugging port.'); }
  const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n');
  const cdp = await connect(`ws://127.0.0.1:${port}${path}`);
  const exited = new Promise((ok) => child.once('exit', ok));
  return { cdp, close: async () => {
    await cdp.send('Browser.close').catch(() => {});
    cdp.ws.close();
    if (await Promise.race([exited.then(() => true), pause(10000).then(() => false)])) return;
    child.kill();
  } };
}

const freePort = () => new Promise((ok, fail) => {
  const s = netServer();
  s.on('error', fail);
  s.listen(0, 'localhost', () => { const { port } = s.address(); s.close(() => ok(port)); });
});

// Self time of a CPU profile, by function, inside [from, to] (ms into it).
function hotspots(prof, n = 30) {
  const byId = new Map(prof.nodes.map((x) => [x.id, x]));
  const self = new Map();
  for (let i = 0; i < prof.samples.length; i++) self.set(prof.samples[i], (self.get(prof.samples[i]) ?? 0) + (prof.timeDeltas[i + 1] ?? 0));
  const fn = new Map();
  for (const [id, us] of self) {
    const cf = byId.get(id).callFrame;
    const k = `${cf.functionName || '(anon)'}  ${cf.url.split('?')[0].split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`;
    fn.set(k, (fn.get(k) ?? 0) + us);
  }
  // and inclusive, for the world's own functions (each counted once a stack)
  const parent = new Map();
  for (const x of prof.nodes) for (const c of x.children ?? []) parent.set(c, x.id);
  const incl = new Map();
  for (const [id, us] of self) {
    const seen = new Set();
    for (let p = id; p !== undefined; p = parent.get(p)) {
      const cf = byId.get(p).callFrame;
      if (!/\/src\//.test(cf.url)) continue;
      const k = `${cf.functionName || '(anon)'}  ${cf.url.split('?')[0].split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`;
      if (seen.has(k)) continue;
      seen.add(k);
      incl.set(k, (incl.get(k) ?? 0) + us);
    }
  }
  const list = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => `${(us / 1000).toFixed(0).padStart(6)} ms  ${k}`).join('\n');
  // and for each of the costliest, the nearest of the world's own functions
  // it was called from
  const label = (id) => { const cf = byId.get(id).callFrame; return `${cf.functionName || '(anon)'}  ${cf.url.split('?')[0].split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`; };
  const callers = new Map();
  for (const [id, us] of self) {
    let p = parent.get(id);
    while (p !== undefined && !/\/src\//.test(byId.get(p).callFrame.url)) p = parent.get(p);
    if (p === undefined) continue;
    const k = label(id), c = callers.get(k) ?? new Map();
    c.set(label(p), (c.get(label(p)) ?? 0) + us);
    callers.set(k, c);
  }
  const top = [...fn].sort((a, b) => b[1] - a[1]).slice(0, 12).filter(([k]) => callers.has(k))
    .map(([k]) => `  ${k}\n${[...callers.get(k)].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, us]) => `    ${(us / 1000).toFixed(0).padStart(6)} ms from ${c}`).join('\n')}`).join('\n');
  return `${list(fn)}\n\n  inclusive, the world's own functions:\n${list(incl)}\n\n  the costliest, by where in the world they were called from:\n${top}`;
}

async function main() {
  const { createServer } = await import('vite');
  const port = await freePort();
  const server = await createServer({
    root: ROOT, logLevel: 'error', cacheDir: 'node_modules/.vite-bench',
    server: { host: 'localhost', port, strictPort: true, hmr: false, watch: null },
  });
  await server.listen();
  const browser = await startBrowser();
  const { cdp } = browser;
  const runs = [];
  try {
    // (a first page, thrown away: Vite transforms every module on its first request)
    for (let r = -1; r < RUNS; r++) {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId: s } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      const page = (m, p) => cdp.send(m, p, s);
      await page('Runtime.enable');
      const profile = args.profile && r === RUNS - 1;
      if (profile) {
        await page('Profiler.enable');
        await page('Profiler.setSamplingInterval', { interval: 500 });
        await page('Profiler.start');
      }
      const query = [typeof args.query === 'string' ? args.query : '', r < 0 ? 'nofingerprint' : '', args.sections ? 'sections' : '',
        args.warmcheck && r === 0 ? 'nowarm' : '', args.keys ? 'keys' : ''].filter(Boolean).join('&');
      await page('Page.navigate', { url: `http://localhost:${port}/tools/load-bench.html${query ? `?${query}` : ''}` });
      const { result, exceptionDetails } = await page('Runtime.evaluate', {
        expression: `new Promise((ok) => { const t = setInterval(() => { if (window.__bench) { clearInterval(t); ok(window.__bench); } }, 100); })`,
        awaitPromise: true, returnByValue: true,
      });
      if (exceptionDetails) throw new Error(exceptionDetails.text);
      const out = result.value;
      if (out.error) throw new Error(out.error);
      if (profile) out.profile = hotspots((await page('Profiler.stop')).profile, 40);
      if (r >= 0) runs.push(out);
      await cdp.send('Target.closeTarget', { targetId });
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const last = runs[runs.length - 1];
  const steps = last.steps.map(([name], i) => [name, median(runs.map((x) => x.steps[i][1]))]);
  const width = Math.max(...steps.map(([n]) => n.length));
  console.log(`The world's first load${RUNS > 1 ? ` (median of ${RUNS})` : ''}, main thread:\n`);
  for (const [name, ms] of [...steps].sort((a, b) => b[1] - a[1])) console.log(`  ${name.padEnd(width)}  ${String(ms).padStart(6)} ms`);
  console.log(`\n  setup ${median(runs.map((x) => x.setupMs))} ms, build ${median(runs.map((x) => x.buildMs))} ms, environment ${median(runs.map((x) => x.environmentMs))} ms, `
    + `starting the shaders ${median(runs.map((x) => x.compileCallMs))} ms; painted at ${median(runs.map((x) => x.paintedMs))} ms`);
  console.log(`  ${last.programsDuringBuild} shader programs started while the world was built (${last.warmMs} ms of it), ${last.programs - last.programsDuringBuild} at the end`);
  console.log(`  ${last.programs} shader programs for ${last.materials} materials; ${last.textures} texture images, ${last.textureMB} MB with their mips`);
  if (last.fingerprint) console.log(`  built: ${last.fingerprint.meshes} meshes, ${last.fingerprint.vertices} vertices, fingerprint ${last.fingerprint.hash}`);
  const prints = new Set(runs.map((x) => x.fingerprint?.hash));
  if (prints.size > 1) console.log(`  (the fingerprint differed between runs: ${[...prints].join(', ')})`);
  // the shader sources, run against run: what the browser's shader cache can keep
  const sourceSets = runs.map((x) => new Set(x.sources));
  const stable = runs[0].sources.filter((h) => sourceSets.every((set) => set.has(h))).length;
  console.log(`  ${last.sources.length} shader sources${runs.length > 1 ? `, ${stable} of them the same in every run (the rest are compiled again on every visit)` : ''}`);
  console.log(`  the map's first frame draws ${last.mapMaterials} of the materials, which need ${last.mapPrograms} of the programs`);
  if (last.programsBySection) {
    let sum = 0;
    console.log('\nprograms by the section whose objects first need them (running total):');
    for (const [n, k] of last.programsBySection) { sum += k; if (k) console.log(`  ${n.padEnd(width)}  ${String(k).padStart(3)}  ${String(sum).padStart(3)}`); }
  }
  if (args.offmap) console.log(`\nmaterials not drawn over the map:\n  ${last.offMap.join('\n  ')}`);
  if (args.textures) console.log(`\ntextures, largest first:\n  ${last.textureList.join('\n  ')}`);
  if (args.warmcheck) {
    const [late, early] = runs.map((x) => new Set(x.sources));
    const lost = [...late].filter((h) => !early.has(h)), extra = [...early].filter((h) => !late.has(h));
    console.log(`\nwarm check: started at the end, ${late.size} sources and ${runs[0].programs} programs; started while building, ${early.size} and ${runs[1].programs}.`);
    console.log(lost.length || extra.length
      ? `  DIFFERENT: ${lost.length} sources only at the end, ${extra.length} only while building — a shader started early saw something the build changed after`
      : '  the same sources, the same programs');
    if (lost.length || extra.length) process.exitCode = 1;
    for (const c of runs[1].changedAfterWarm ?? []) console.log(`  changed after its shader was started: ${c.replace(/\s+/g, ' ')}`);
    const [a, b] = runs.map((x) => new Set(x.programList));
    for (const p of [...b].filter((x) => !a.has(x))) console.log(`  only while building: ${p.replace(/\s+/g, ' ').slice(-160)}`);
    for (const p of [...a].filter((x) => !b.has(x))) console.log(`  only at the end:     ${p.replace(/\s+/g, ' ').slice(-160)}`);
  }
  if (args.programs) console.log(`\nprograms:\n  ${last.programList.join('\n  ')}`);
  if (last.profile) console.log(`\nwhere the last run's time went, by function (self time):\n${last.profile}`);
  if (typeof args.out === 'string') writeFileSync(args.out, JSON.stringify(args.warmcheck ? runs : last, null, 1));
}

main().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
