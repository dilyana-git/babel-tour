// ── The governor's rule, checked against numbers ─────────────────────────────
// The governor (src/Governor.jsx) is a frame loop, and a frame loop cannot be
// checked here: under headless GL this scene draws at 130-700 ms a frame, so a
// harness watching it act would be measuring swiftshader rather than the rule.
// So the rule lives apart (src/governorRule.js) and this hands it the numbers a
// real machine would have produced — including the ones measured on the AMD
// integrated GPU this was written for, a median of 83 ms.
//
// Run with: npm run check:governor
import { judge } from '../src/governorRule.js';

// The desktop ladder and budget, spelled out rather than imported: capability.js
// derives them from a browser this process does not have, and the numbers under
// test are these ones.
const DPR_LADDER = [1.5, 1.25, 1, 0.85, 0.75];
const BUDGET = 24;

let pass = 0, fail = 0
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`)
}
const run = (medians) => {
  const st = { rung: 0, late: 0, floored: false }, acts = []
  for (const m of medians) { const r = judge(st, m, DPR_LADDER, BUDGET); if (r) acts.push(r.dpr) }
  return { rung: st.rung, dpr: DPR_LADDER[st.rung], acts }
}

is('a fast machine is left alone', run([8, 9, 12, 7, 10]), { rung: 0, dpr: 1.5, acts: [] })
is('one late window is not enough', run([9, 40, 9]), { rung: 0, dpr: 1.5, acts: [] })
is('two in a row steps down once', run([40, 40]), { rung: 1, dpr: 1.25, acts: [1.25] })
is('a good window forgives the late one', run([40, 9, 40, 9, 40]), { rung: 0, dpr: 1.5, acts: [] })
// four steps down, then the floor said once and never again
is('a persistently late machine walks the ladder, then falls silent',
   run(Array(40).fill(83)), { rung: 4, dpr: 0.75, acts: [1.25, 1, 0.85, 0.75, 0.75] })
is('it never goes below the last rung',
   run(Array(60).fill(200)).rung, 4)
is('it never climbs back', run([...Array(4).fill(83), ...Array(20).fill(5)]).dpr, 1)
is('exactly at budget is not late', run([24, 24, 24, 24]), { rung: 0, dpr: 1.5, acts: [] })
is('the floor reports itself', (() => {
  const st = { rung: 4, late: 1, floored: false }; return judge(st, 99, DPR_LADDER, BUDGET)
})(), { dpr: 0.75, median: 99, floor: true })
is('a phone ladder starts and ends lower', (() => {
  const short = [1.25, 1, 0.85, 0.75], st = { rung: 0, late: 0, floored: false }
  for (let i = 0; i < 20; i++) judge(st, 83, short, BUDGET)
  return short[st.rung]
})(), 0.75)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
