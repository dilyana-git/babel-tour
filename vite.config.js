import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readdir, rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

// Everything under public/ is copied into dist verbatim, and this project keeps
// several PARALLEL copies of the same 40 clips there — one per super-resolution
// experiment — so that ?sr=<key> can A/B them against each other by hand. That
// is the right shape for the folder and the wrong shape for a deploy: the build
// came to 2.2 GB, of which a default walk requests about 590 MB. The rest is
// three experiment roots nothing reaches unless a query string asks for them.
//
// So the experiments stay in public/ (a dev server serves them, ?sr= keeps
// working while the comparison is still being made) and are dropped on the way
// out. Listed as a DENY list rather than an allow list on purpose: a new
// experiment delivery is a new root, and the failure mode of forgetting to list
// it here is a heavier build, while the failure mode of forgetting to add it to
// an allow list is a deployed clip that 404s and a gallery that silently never
// wakes. Heavier is the safer way to be wrong.
//
// Keep in step with VIDEO_SR in src/Tour.jsx: anything the `best` chain can
// serve MUST NOT be listed here. Today that chain is /video-latest2,
// /video-latest, /video-x4, /video-fit and /video-plain.
const UNSHIPPED_ROOTS = [
  'video',           // the untagged, no-faststart originals; nothing serves them
  'video-2x',        // the anime-model batch, kept only for ?sr=2x comparison
  'video-x4-48',     // the 48 fps interpolation, kept only for ?sr=x4i comparison
  'video-fit-1888',  // the one clip at the old 1888, kept only for ?sr=fit1888
]

// The roots the `best` chain resolves through, highest precedence first and
// ending in the fallback root of last resort. This is the deploy's copy of the
// table in src/Tour.jsx (VIDEO_SR.best: X4_FULL_BATCH, LATEST_BATCHES, X4_BATCH,
// FIT_BATCH, then VIDEO_ROOT) and has to be kept in step with it by hand — a
// build config cannot import a module that pulls in three and react.
const BEST_CHAIN = [
  'video-x4-full',
  'video-latest2',
  'video-latest',
  'video-x4',
  'video-fit',
  'video-plain',
]

// The chain serves each clip from the HIGHEST root that carries it and never
// looks further down, so every copy of that name below the winner is weight the
// deploy pays for and no walk can ever request. /video-plain was the obvious
// case — it holds all 39 clips so that no ?sr= key drops into a hole, of which
// `best` reaches one — but it is not the only one: /video-x4 carries 41 clips
// and loses 8 of them to the two RealBasicVSR batches above it, ~90 MB of files
// that ship to be shadowed. Both are the same rule, so it is now applied once,
// down the whole chain, rather than to the bottom root alone.
//
// Pruned by SUBTRACTION, derived from the folders themselves rather than from a
// list, so a new SR delivery prunes the copies it supersedes the moment it lands
// and no list can drift out of step. It errs the safe way at every level: a name
// no HIGHER root carries is kept, so the failure mode is a heavier build rather
// than a clip that 404s and a gallery that silently never wakes.
//
// The one invariant it rests on: a clip sitting in an SR root must be DECLARED
// by that root's batch. An undeclared stray would be read here as covering the
// name — the chain would skip past it at runtime and fetch a copy this prune had
// deleted underneath it. `npm run verify:assets` fails on exactly that, and is
// the check to run before a deploy rather than a thing to remember.
const pruneChain = async (distDir) => {
  const above = new Set()
  for (const root of BEST_CHAIN) {
    const dir = resolve(distDir, root)
    const here = await readdir(dir).catch(() => null)
    // A missing root is ordinary: the batch has not landed, or the deploy left
    // it out. It covers nothing, and nothing below it changes.
    if (here === null) continue
    const dead = here.filter((n) => above.has(n))
    for (const n of dead) await rm(resolve(dir, n), { force: true })
    for (const n of here) above.add(n)
    if (dead.length) {
      console.log(`  pruned dist/${root} to ${here.length - dead.length} clip(s)`
                + ` (${dead.length} already served from a root above it)`)
    }
  }
}

const dropUnshippedVideoRoots = (hostedElsewhere) => ({
  name: 'drop-unshipped-video-roots',
  apply: 'build',
  closeBundle: async () => {
    const dist = resolve(__dirname, 'dist')
    // With VITE_VIDEO_HOST set, every clip URL points at another origin (see
    // VIDEO_HOST in src/Tour.jsx) and NO root belongs in the build — not the
    // experiments, not the chain, not the fallback. Dropping the lot takes the
    // deploy from ~654 MB to ~70 MB. Upload public/video* to the bucket as it
    // stands: the chain still expects the same root//file layout underneath.
    if (hostedElsewhere) {
      const all = (await readdir(dist, { withFileTypes: true }))
        .filter((d) => d.isDirectory() && d.name.startsWith('video'))
      for (const d of all) {
        await rm(resolve(dist, d.name), { recursive: true, force: true })
        console.log(`  dropped dist/${d.name} (served from VITE_VIDEO_HOST)`)
      }
      return
    }
    await pruneChain(dist)
    for (const root of UNSHIPPED_ROOTS) {
      const dir = resolve(dist, root)
      // Only report roots that were actually there. A missing one is fine —
      // it means the experiment was cleaned out of public/ — but a silent
      // no-op across ALL of them would mean this plugin has stopped matching
      // the folder layout, and that is worth seeing in the build log.
      const bytes = await stat(dir).then(() => true).catch(() => false)
      if (!bytes) continue
      await rm(dir, { recursive: true, force: true })
      console.log(`  dropped dist/${root} (A/B only, not served by \`best\`)`)
    }
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Read with an empty prefix so the flag is visible here as well as in the
  // bundle; Vite only exposes VITE_* to the app, not to this file.
  const env = loadEnv(mode, __dirname, '')
  return {
    plugins: [react(), dropUnshippedVideoRoots(Boolean(env.VITE_VIDEO_HOST))],
  }
})
