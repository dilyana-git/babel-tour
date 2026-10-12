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
// Two in a row, and it steps to the rung that would actually have FIT: from
// 1.5, a 40 ms window wants sqrt(24/40) of the ratio, which is 1.16 — so 1.25
// is not far enough (it would still run 27.8 ms) and 1 is the answer.
is('two in a row steps to where the numbers point', run([40, 40]), { rung: 2, dpr: 1, acts: [1] })
is('a good window forgives the late one', run([40, 9, 40, 9, 40]), { rung: 0, dpr: 1.5, acts: [] })
// A miss of twice the budget or more is not a room arriving, so it does not
// have to prove itself twice — and it goes where the arithmetic points rather
// than one rung at a time. 83 ms against a budget of 24 wants the ratio down by
// sqrt(24/83), which is past the bottom of the ladder; REACH holds it to two
// rungs a decision, so it arrives in two and then says the floor once.
is('a machine that is nowhere near goes straight there, then falls silent',
   run(Array(40).fill(83)), { rung: 4, dpr: 0.75, acts: [1, 0.75, 0.75] })
is('a gross miss acts on the FIRST window', run([83]), { rung: 2, dpr: 1, acts: [1] })
is('a merely late one still has to say it twice', run([40]), { rung: 0, dpr: 1.5, acts: [] })
// One decision may not cross the whole ladder however bad the number is.
is('never more than two rungs in one decision', run([9999]), { rung: 2, dpr: 1, acts: [1] })
// A miss just over budget steps ONE rung: the arithmetic asks for very little
// and the first rung below already covers it. This is what keeps the reach from
// being a stampede.
is('a small miss steps one rung', run([26, 26]), { rung: 1, dpr: 1.25, acts: [1.25] })
is('it never goes below the last rung',
   run(Array(60).fill(200)).rung, 4)
// The point is that good windows never take it back UP, wherever it fell to.
is('it never climbs back', (() => {
  const fell = run(Array(4).fill(83)).dpr
  return { fell, after: run([...Array(4).fill(83), ...Array(20).fill(5)]).dpr }
})(), { fell: 0.75, after: 0.75 })
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
