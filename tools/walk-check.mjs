// ── The walk, end to end ─────────────────────────────────────────────────────
// A smoke test, and deliberately not more than one: it teleports through all
// eight galleries with window.__at, reads back what the tour thinks it is
// showing, and fails if anything threw on the way.
//
// It exists because of what it caught the day it was written. Splitting the
// catalogue out of Tour.jsx left selectRandomVariant calling an unseenFirst
// that had stayed behind — the build was clean, the bundle resolved, oxlint was
// quiet, and every painting past the first was a black rectangle. A free
// variable is a RUNTIME error, so nothing that reads the source can see it, and
// the only check that could was one that walked.
//
// Deliberately NOT a pixel test. Under headless GL this scene draws at 130-700
// ms a frame and the swiftshader raster is its own artefact; what is asserted
// here is that the machinery runs, not that it is beautiful. Beauty is judged on
// the real GPU, by eye. See .claude/skills/visitor-tour for that, and
// tools/ux-review-agent.mjs for the layout.
//
// Start the app first (npm run dev), then: npm run check:walk

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
const arg = process.argv.slice(2).find((a) => a.startsWith('http'));
const URL_ = arg ?? 'http://localhost:5173/?dev=1';
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
const PORT = 9334
const b = spawn(EXE, [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run',
  '--no-default-browser-check', '--use-gl=angle', '--use-angle=swiftshader',
  '--window-size=400,300', '--user-data-dir=' + process.env.TEMP + '/walk-probe', 'about:blank'],
  { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let ver
for (let i = 0; i < 100; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { ver = await r.json(); break } } catch { /* still starting */ }
  await sleep(150)
}
if (!ver) {
  console.error('Chromium never exposed its debugging endpoint.')
  b.kill(); process.exit(1)
}
const ws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r, { once: true }))
let id = 0; const waiting = new Map(); const errs = []
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n').slice(0,2).join(' | '))
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    errs.push('console.error: ' + m.params.args.map(a => a.value || a.description).join(' ').slice(0, 160))
})
const send = (method, params = {}, sessionId) => new Promise(res => {
  const n = ++id; waiting.set(n, res)
  ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }))
})
const { result: t } = await send('Target.createTarget', { url: 'about:blank' })
const { result: s } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true })
const sid = s.sessionId
await send('Runtime.enable', {}, sid); await send('Page.enable', {}, sid)
await send('Page.navigate', { url: URL_ }, sid)
const ev = async (expr) => (await send('Runtime.evaluate',
  { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result?.result?.value
await sleep(4000)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/enter|begin|walk/i.test(x.textContent)); b&&b.click(); return !!b})()`)
await sleep(1500)
const hooks = await ev(`['__at','__nav','__quality'].filter(k=>typeof window[k]==='function').length`)
if (hooks < 3) {
  console.error(`the dev hooks are not there (${hooks}/3) — is the URL missing ?dev=1,`
    + ' or is this a production build? They are stripped from one.')
  ws.close(); b.kill(); process.exit(1)
}
console.log('hooks:', await ev(`['__at','__nav','__quality','__rite'].filter(k=>typeof window[k]==='function').join(' ')`))
for (let ch = 0; ch <= 7; ch++) {
  await ev(`window.__at(${ch})`)
  await sleep(1200)
  const n = await ev(`JSON.stringify(window.__nav && window.__nav())`)
  const cap = await ev(`(document.querySelector('#gallery-caption')||{}).textContent`)
  console.log(`ch ${ch}:`, (n||'').slice(0, 90), '|', (cap||'').slice(0, 50))
}
// the scatter field and the catalogue restock
console.log('scatter words:', await ev(`document.querySelectorAll('.scatter-word, [class*=scatter] span').length`))
console.log('canvas:', await ev(`(()=>{const c=document.querySelector('canvas'); return c? c.width+'x'+c.height : 'none'})()`))
const unique = [...new Set(errs)]
console.log('')
console.log(unique.length
  ? `FAILED — ${unique.length} distinct error(s) across the walk:`
  : 'clean — all eight galleries walked, nothing thrown')
for (const e of unique.slice(0, 8)) console.log('   ' + e)
ws.close(); b.kill()
process.exit(unique.length ? 1 : 0)
