#!/usr/bin/env node
// ── Does every asset the tour asks for actually exist? ───────────────────────
//
// This project's worst bug is a SILENT one, and it has bitten more than once.
// The dev server answers a request for a missing /video/*.mp4 with index.html
// at status 200. The <video> element is therefore handed a page of HTML, never
// decodes it, and — this is the part that hurts — raises no error at all. The
// gallery simply stays a still. Nothing in the console, nothing on screen, and
// the only way to notice is to know what that painting was supposed to do.
//
// Tour.jsx guards against it with comments. There are several hundred words up
// there explaining that /video-plain must hold every clip the tour references,
// that a batch must list only files that are on disk, and that getting either
// wrong turns an A/B comparison into a comparison against nothing. All of it is
// true and none of it is CHECKED. This script is those comments, executable.
//
// Run it before a deploy, and after any change to the variant tables or any new
// clip delivery:
//
//     npm run verify:assets
//
// ── What it proves, and what it does not ────────────────────────────────────
// It reads the source as TEXT — collecting string literals with a small scanner
// that knows the difference between a path and a path mentioned in a comment —
// rather than importing the tables. Tour.jsx cannot be imported by node: it is
// JSX, and it pulls in react and three on the way. So this checks the invariants
// that can be established from literals plus the filesystem, which are the ones
// the silent failure actually turns on:
//
//   • every plate the tour names is on disk
//   • every clip the tour names is in the fallback root, so NO ?sr= key can
//     drop into a hole
//   • every clip a batch DECLARES is somewhere on disk, so a delivery that
//     never landed cannot masquerade as a working experiment
//
// What it cannot do is resolve a clip through the VIDEO_SR chain the way the app
// does and confirm the exact file each key serves — that logic lives inside a
// module this script cannot load. Making that exact would mean lifting the video
// tables out of Tour.jsx into a plain module both could import, which is worth
// doing and is the obvious next step, not a thing this script pretends to.

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

// ── 2. Referenced clips vs the fallback root ────────────────────────────────
// VIDEO_ROOT is the floor under every ?sr= key: a key whose batches do not carry
// some clip drops to it. So a clip that is referenced but absent from that root
// is not merely un-upscaled, it is unservable under any key that does not
// happen to carry it — the silent never-wakes failure, waiting for the reader
// who loads with the wrong query string.
// There are two different severities here, and collapsing them would make this
// check useless — it would fail forever on a case the source has already thought
// about, and a check that always fails is a check nobody runs.
//
//   NOT SERVABLE AT ALL — the clip is in no root anywhere. Whatever key the
//   reader loads with, that gallery can never wake. This is the bug.
//
//   ONLY IN AN SR ROOT — it is missing from the fallback but some batch carries
//   it, so it plays under any key that includes that batch (`best` does) and
//   dies under one that does not. Tour.jsx documents exactly one of these:
//   01-moonlit-labyrinth-var2-clip2, whose source no longer survives anywhere,
//   so it exists only as its super-resolved copies. That is a known, reasoned
//   fragility rather than a mistake, and it is reported as such — but it is
//   still reported, because a SECOND one appearing would mean a clip lost its
//   source without anyone noticing.
const FALLBACK = '/video-plain';
const clips = [...new Set(all.filter((s) => /^\/video\/.+\.mp4$/.test(s)))];
const fallbackDir = join(PUBLIC, FALLBACK);
const fragile = [];
if (!existsSync(fallbackDir)) {
  notes.push(`${FALLBACK} is not present — the clip batches are carried out of band`
    + ' (see .gitignore), so clip checks were skipped. Copy them in before a deploy.');
} else {
  for (const c of clips.sort()) {
    const file = c.slice('/video/'.length);
    if (existsSync(join(fallbackDir, file))) continue;
    // Deliberately deferred: `onDisk` is built in check 3 below, so ask the
    // filesystem directly rather than reorder two checks for one lookup.
    const elsewhere = readdirSync(PUBLIC, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('video'))
      .filter((d) => existsSync(join(PUBLIC, d.name, file)))
      .map((d) => d.name);
    if (elsewhere.length) {
      fragile.push(`${file} — absent from ${FALLBACK}, served only by ${elsewhere.join(', ')}`);
    } else {
      problems.push(`unservable clip ${file}  (referenced, present in NO video root)`);
    }
  }
}
if (fragile.length) {
  notes.push(`${fragile.length} clip(s) have no fallback copy and will not play under`
    + ' every ?sr= key:');
  for (const f of fragile) notes.push(`    ${f}`);
}

// ── 3. Declared batch files vs the disk ─────────────────────────────────────
// The bare '*.mp4' literals are the super-resolution batch manifests. Listing a
// name a batch does not actually have is the exact mistake the header warns
// about, and its symptom is again nothing at all. This does not attribute each
// name to its own root — that needs the table structure — but a declared file
// that exists in NO root at all cannot be a delivery that landed.
const roots = existsSync(PUBLIC)
  ? readdirSync(PUBLIC, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('video'))
    .map((d) => d.name)
  : [];
const onDisk = new Set(roots.flatMap((r) => readdirSync(join(PUBLIC, r))));
const declared = [...new Set(all.filter((s) => /^[\w-]+\.mp4$/.test(s)))];
if (roots.length === 0) {
  notes.push('no public/video* roots present — batch manifests were not checked.');
} else {
  for (const d of declared.sort()) {
    if (!onDisk.has(d)) {
      problems.push(`declared, absent ${d}  (listed in a batch, in none of: ${roots.join(', ')})`);
    }
  }
}

// ── 3b. Undeclared strays in a chain root ───────────────────────────────────
// The build prunes the clip roots by subtraction down the `best` chain: a copy
// is deleted when a root ABOVE it carries the same name, because the chain would
// never look that far down. That rule reads the folders, and it is only sound
// while every clip in an SR root is one its batch actually declares. A stray —
// a file copied into the wrong root, or left behind by a delivery that was
// renamed — reads as covering the name, so the prune deletes the copy below it
// while the chain, which goes by the manifests, walks straight past the stray
// and fetches the one that is now gone. A 404 the dev server hides (it answers
// a missing .mp4 with index.html at status 200) and production shows as a
// gallery that never wakes.
//
// So: anything in a chain root that no batch names at all. The fallback root is
// exempt — holding every clip regardless of what is declared is its whole job.
const CHAIN_ROOTS = ['video-x4-full', 'video-latest2', 'video-latest',
  'video-x4', 'video-fit'];
const declaredSet = new Set(declared);
for (const root of CHAIN_ROOTS) {
  const abs = join(PUBLIC, root);
  if (!existsSync(abs)) continue;
  const strays = readdirSync(abs)
    .filter((f) => f.endsWith('.mp4') && !declaredSet.has(f));
  for (const f of strays) {
    problems.push(`undeclared ${root}/${f}  (in a chain root, named by no batch`
      + ' — the build prune would delete the copy beneath it)');
  }
}

// ── 4. Orphan plates ────────────────────────────────────────────────────────
// Not a failure — art is kept deliberately after being pulled from rotation, and
// the tables say so. But everything in public/ is copied verbatim into the build
// and deployed, so an unreferenced plate is weight a reader pays for and never
// sees, and it is worth having the number in front of you.
for (const dir of ['nodes/descent', 'nodes/garden']) {
  const abs = join(PUBLIC, dir);
  if (!existsSync(abs)) continue;
  const referenced = new Set(plates.map((p) => p.split('/').pop()));
  const orphans = readdirSync(abs).filter((f) => !referenced.has(f));
  if (orphans.length) {
    notes.push(`${dir}: ${orphans.length} file(s) present but never referenced`
      + ` — ${orphans.slice(0, 4).join(', ')}${orphans.length > 4 ? ', …' : ''}`);
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`checked ${plates.length} plate reference(s), ${clips.length} clip reference(s),`
  + ` ${declared.length} batch declaration(s)`);
for (const n of notes) console.log(`  note:  ${n}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('all referenced assets resolve.');
