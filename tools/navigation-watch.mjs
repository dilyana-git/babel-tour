#!/usr/bin/env node
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { startApp } from './selenium/browser.mjs';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--dev' && !arg.startsWith('--tier='))) throw new Error('Use --dev and/or --tier=fast|smoke|full|contracts');
const tier = args.find(arg => arg.startsWith('--tier='))?.slice(7) ?? 'full';
if (!['fast', 'smoke', 'full', 'contracts'].includes(tier)) throw new Error('Unknown verification tier');
const quietMs = 15000;
const paths = ['src', 'tools', 'public', '.github'];
const rootFiles = new Set(['package.json', 'package-lock.json', 'vite.config.js', 'index.html', 'AGENTS.md']);
const watchers = [];
let timer;
let running = false;
let pending = false;
let stopping = false;
let child;
let app;
let lastChange = 0;

const runCommand = (args) => new Promise((resolveCommand, reject) => {
  child = spawn(process.execPath, args, {
    // A detached Windows child cannot reliably inherit a ConPTY console.
    // Explicit pipes keep node:test's output and exit status available.
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: process.env,
    // Ctrl+C is handled by this supervisor; the child gets to save its report.
    detached: process.platform === 'win32',
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.once('error', reject);
  child.once('exit', (code) => { child = null; resolveCommand(code ?? 1); });
});
const schedule = () => {
  clearTimeout(timer);
  if (!stopping) timer = setTimeout(run, Math.max(0, quietMs - (Date.now() - lastChange)));
};
const run = async () => {
  if (stopping || running) return;
  if (Date.now() - lastChange < quietMs) { schedule(); return; }
  running = true; pending = false;
  const revision = lastChange;
  console.log(`[navigation-watch] Running ${tier} checks for this batch of edits.`);
  try {
    let code = await runCommand(['--test', 'tools/navigation-check.mjs', 'tools/navigation-properties-check.mjs',
      'tools/navigation-runner-check.mjs', 'tools/navigation-observations-check.mjs', 'tools/finale-lifecycle-check.mjs',
      'tools/probe-check.mjs', 'tools/input-activation-check.mjs']);
    if (code === 0 && !stopping && tier !== 'fast') {
      code = await runCommand(['tools/navigation-browser-check.mjs', `--suite=${tier === 'full' ? 'baseline' : tier}`]);
    }
    if (lastChange !== revision) console.log('[navigation-watch] Files changed during the run; another check is queued.');
    else console.log(code === 0 ? `[navigation-watch] ${tier} checks passed${tier === 'fast' ? '; browser journeys have not run' : ''}.`
      : `[navigation-watch] Navigation FAILED (exit ${code}). Read the report above.`);
  } catch (error) { console.error(`[navigation-watch] ${error.message}`); }
  finally {
    running = false;
    if (pending && !stopping) schedule();
    if (stopping) { await app?.stop(); process.exit(0); }
  }
};
const changed = (path) => {
  if (stopping) return;
  lastChange = Date.now(); pending = true;
  console.log(`[navigation-watch] Changed ${path}; checking after edits settle.`);
  if (!running) schedule();
};
const stop = async () => {
  if (stopping) return;
  stopping = true; clearTimeout(timer); watchers.forEach(w => w.close());
  // Let an active browser check finish so it saves evidence and quits Edge.
  if (running) console.log('[navigation-watch] Finishing the active check before exiting.');
  else { await app?.stop(); process.exit(0); }
};
process.on('SIGINT', stop); process.on('SIGTERM', stop);

if (args.includes('--dev')) {
  app = await startApp();
  console.log(`[navigation-watch] App: ${app.url}`);
}
for (const path of paths) {
  watchers.push(watch(resolve(path), { recursive: true }, (_, filename) => {
    if (!filename || /\.(jsx?|mjs|css|json|ya?ml|webp|png|jpe?g|gltf|glb|ktx2|svg)$/i.test(filename)) changed(`${path}/${filename ?? '?'}`);
  }));
}
watchers.push(watch(process.cwd(), (_, filename) => { if (rootFiles.has(filename)) changed(filename); }));
for (const watcher of watchers) watcher.on('error', error => { console.error(`[navigation-watch] ${error.message}`); void stop(); });
console.log('[navigation-watch] Watching app, navigation tests, dependencies and CI; edits are grouped for 15 seconds.');
void run();
