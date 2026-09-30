#!/usr/bin/env node
// ── Does every asset the tour asks for exist, and is every asset it HAS hung? ─
//
// Run before a deploy and after any change to the catalogue:
//
//     npm run verify:assets
//
// This began as a guard against a silent failure in the clip delivery: the dev
// server answers a request for a missing .mp4 with index.html at status 200, so
// a <video> was handed a page of HTML, never decoded it, and raised no error —
// the gallery just stayed a still, with nothing in the console. The clips are
// gone from the piece and those three checks went with them.
//
// What replaced them is the failure this project actually kept having instead,
// which is the opposite shape and just as quiet: art that was generated,
// depth-mapped, backdrop-baked, verified — and then never hung. Two finished
// garden plates sat in public/nodes that way, and one of them was the only thing
// standing between the Web of Time and a gallery that could not restock at all.
// Nothing failed. Nothing was missing. The work was simply not in the piece, and
// the only way to notice was to diff the folder against the catalogue by hand.
//
// So the orphan check is no longer a footnote about build weight. It is the
// point of this script, and it now sorts orphans by whether they are READY —
// see check 3.
//
// ── What it proves, and what it does not ────────────────────────────────────
// It reads the source as TEXT — collecting string literals with a small scanner
// that knows the difference between a path and a path mentioned in a comment —
// rather than importing the tables, which cannot be imported by node: they are
// JSX and pull in react and three on the way. So it checks what can be
// established from literals plus the filesystem:
//
//   • every plate and depth map the tour names is on disk
//   • every plate the tour hangs has a backdrop declared for it
//   • every plate on disk is either hung, or accounted for as not-yet-ready
//
// What it cannot tell you is whether a plate SHOULD hang — whether the art is
// any good, whether its glowAt points at the right lamp. Those are judgements
// for a person at a real screen. It can only tell you that the choice not to
// hang something was made, rather than forgotten.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PUBLIC = join(ROOT, 'public');

// ── Collect string literals, and only string literals ───────────────────────
// A regex over the raw file would also match the paths that appear in prose:
// Tour.jsx's header discusses /video-x4/*.mp4 and names specific clips while
// explaining why they are absent, and treating those as references would make
// this script fail on files it has just been told do not exist. So walk the
// source once, tracking whether we are in a string, a line comment, or a block
// comment, and keep only what is genuinely quoted.
const literals = (src) => {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      i++;
      let buf = '';
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') {
          buf += src[i + 1];
          i += 2;
        } else {
          buf += src[i];
          i++;
        }
      }
      i++;
      out.push(buf);
    } else {
      i++;
    }
  }
  return out;
};

const srcFiles = readdirSync(join(ROOT, 'src'))
  .filter((f) => /\.(jsx?|mjs)$/.test(f))
  .map((f) => join(ROOT, 'src', f));
const all = srcFiles.flatMap((f) => literals(readFileSync(f, 'utf8')));

// Which plates the catalogue actually HANGS, as distinct from which plates the
// source mentions anywhere. The two are not the same and check 3 turns on the
// difference: src/backdrops.js is keyed BY PLATE PATH and carries an entry for
// every plate on disk, hung or not — so measuring "referenced" against the whole
// of src/ made every orphan look referenced and the check silently reported
// nothing, which is the exact failure it was written to end. Only the catalogue
// decides what hangs.
const hung = new Set(
  literals(readFileSync(join(ROOT, 'src', 'catalogue.js'), 'utf8'))
    .filter((s) => /^\/nodes\/.+\.webp$/.test(s))
    .map((s) => s.split('/').pop()),
);

// …and which plates the BALCONY hangs, which is a different kind of hanging.
// Its window (Balcony.jsx's LibraryView) is a plain colour card: no slab stack,
// no depth map, no backdrop — a plate needs nothing there but itself. That is
// why plates barred from the corridor can still hang in it. Without this the
// script reported the balcony's plates twice and wrongly in both directions:
// once as hanging with "no backdrop declared" (a backdrop would do nothing on a
// surface that never dis-occludes) and once as unhung orphans still in the
// pipeline, when they are in the piece and finished.
const balcony = new Set(
  literals(readFileSync(join(ROOT, 'src', 'Balcony.jsx'), 'utf8'))
    .filter((s) => /^\/nodes\/.+\.webp$/.test(s))
    .map((s) => s.split('/').pop()),
);

const problems = [];
const notes = [];

// ── 1. Plates ───────────────────────────────────────────────────────────────
// Straightforward and exact: these are served from public/ by their literal
// path, so the literal either names a file or it does not. A missing one is a
// gallery that throws in useTexture — loud, unlike the video case, but caught
// here before a reader finds it.
const plates = [...new Set(all.filter((s) => /^\/nodes\/.+\.(webp|png|jpe?g)$/.test(s)))];
for (const p of plates.sort()) {
  if (!existsSync(join(PUBLIC, p))) problems.push(`missing plate   ${p}`);
}

// ── 2. Every hung plate has a backdrop ──────────────────────────────────────
// A plate with no declared backdrop falls back to the runtime dilation smear
// instead of the baked inpaint. It renders — this is not a crash — it just
// renders worse than its neighbours, in a way that is easy to miss on a plate
// you are not comparing against anything.
const backdropDecls = new Set(all.filter((s) => /-backdrop\.webp$/.test(s)));
for (const p of plates.sort()) {
  if (/(-backdrop|-backdrop-depth|-depth|_depth|-depth-snapped)\.webp$/.test(p)) continue;
  // The balcony's window has no backdrop to declare — see `balcony` above.
  if (balcony.has(p.split('/').pop()) && !hung.has(p.split('/').pop())) continue;
  const expected = p.replace(/\.webp$/, '-backdrop.webp');
  if (!backdropDecls.has(expected)) {
    notes.push(`${p.split('/').pop()} hangs with no backdrop declared`
      + ' — it will fall back to the runtime dilation smear');
  }
}

// ── 3. Art on disk that the catalogue never hangs ───────────────────────────
// The check this script now exists for. An orphan is not automatically a
// mistake — plates are deliberately kept after being pulled, and the catalogue
// says why in each case — but the two kinds are worth telling apart, because
// only one of them is ever a mistake:
//
//   READY   — a colour plate with a depth map AND a baked backdrop beside it.
//             Everything the slab stack needs. Somebody finished this and it is
//             not in the piece. Either hang it, or write down in the catalogue
//             why not.
//   PARTIAL — missing its depth map or its backdrop. Still in the pipeline, and
//             its absence from the catalogue explains itself.
//
// Plates the balcony hangs are neither: they are in the piece, they just are not
// in a gallery, and they need no depth map to be there.
//
// Reported as notes, not failures: "should this hang?" is a judgement, and this
// script does not get to make it. It only refuses to let it go unnoticed.
const isDerived = (f) => /(-backdrop|-backdrop-depth|-depth|-depth-snapped)\.webp$/.test(f)
  || /_depth\.webp$/.test(f) || /-depth-[ab]\.webp$/.test(f);
for (const dir of ['nodes/descent', 'nodes/garden']) {
  const abs = join(PUBLIC, dir);
  if (!existsSync(abs)) continue;
  const here = readdirSync(abs);
  const present = new Set(here);
  const ready = [];
  const partial = [];
  for (const f of here) {
    if (isDerived(f) || hung.has(f) || balcony.has(f)) continue;
    const stem = f.replace(/\.webp$/, '');
    // Two spellings of the depth map are in use: the original batch wrote
    // `impossible_1_depth.webp`, everything since writes `<stem>-depth.webp`.
    const hasDepth = present.has(`${stem}-depth.webp`) || present.has(`${stem}_depth.webp`);
    const hasBackdrop = present.has(`${stem}-backdrop.webp`)
      && present.has(`${stem}-backdrop-depth.webp`);
    (hasDepth && hasBackdrop ? ready : partial).push(f);
  }
  if (ready.length) {
    notes.push(`${dir}: ${ready.length} FINISHED plate(s) never hung — ${ready.join(', ')}`);
    notes.push('           depth map and baked backdrop both present, so these are'
      + ' ready to hang as they stand');
  }
  if (partial.length) {
    notes.push(`${dir}: ${partial.length} unhung plate(s) still incomplete`
      + ` — ${partial.slice(0, 4).join(', ')}${partial.length > 4 ? ', …' : ''}`);
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`checked ${plates.length} plate reference(s)`);
for (const n of notes) console.log(`  note:  ${n}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('all referenced assets resolve.');
