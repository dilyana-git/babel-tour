import { defineConfig } from 'vite'
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
  'video',        // the untagged, no-faststart originals; nothing serves them
  'video-2x',     // the anime-model batch, kept only for ?sr=2x comparison
  'video-x4-48',  // the 48 fps interpolation, kept only for ?sr=x4i comparison
]

// /video-plain is a different case: it is not an experiment, it is the fallback
// root of last resort, and on disk it has to hold EVERY clip the tour references
// so that no ?sr= key can drop into a hole (see VIDEO_ROOT in src/Tour.jsx). But
// `best` reaches only the handful the SR batches above it do not carry, so
// shipping the whole folder put 275 MB of never-requested clips in the deploy.
//
// Pruned by SUBTRACTION rather than by a list: a file in /video-plain is dead
// weight exactly when one of the shipped SR roots already carries that name,
// because the chain finds it there first and never falls this far. That is the
// same rule `best` resolves by, derived from the folders themselves, so a new SR
// delivery prunes its own fallback copy the moment it lands and no list can
// drift out of step. Erring the safe way too: a name NOT found above is kept,
// so the failure mode is a heavier build rather than a clip that 404s.
const SHIPPED_SR_ROOTS = ['video-latest2', 'video-latest', 'video-x4', 'video-fit']

const pruneFallbackRoot = async (distDir) => {
  const dir = resolve(distDir, 'video-plain')
  if (!(await stat(dir).catch(() => false))) return
  const covered = new Set()
  for (const root of SHIPPED_SR_ROOTS) {
    const names = await readdir(resolve(distDir, root)).catch(() => [])
    for (const n of names) covered.add(n)
  }
  const here = await readdir(dir)
  const dead = here.filter((n) => covered.has(n))
  for (const n of dead) await rm(resolve(dir, n), { force: true })
  console.log(`  pruned dist/video-plain to ${here.length - dead.length} fallback`
            + ` clip(s) (${dead.length} already served by an SR root)`)
}

const dropUnshippedVideoRoots = () => ({
  name: 'drop-unshipped-video-roots',
  apply: 'build',
  closeBundle: async () => {
    await pruneFallbackRoot(resolve(__dirname, 'dist'))
    for (const root of UNSHIPPED_ROOTS) {
      const dir = resolve(__dirname, 'dist', root)
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
export default defineConfig({
  plugins: [react(), dropUnshippedVideoRoots()],
})
