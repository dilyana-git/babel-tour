import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readdir, rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

// Everything under public/ is copied into dist verbatim, and this project still
// has ~2.4 GB of video sitting there: eight parallel roots of the same 40
// image-to-video clips, one per super-resolution experiment, plus the overture
// film and a stray clip.mp4.
//
// The tour no longer plays any of it. The clips are gone from the piece —
// nothing in src/ names a .mp4, the paintings hang as paintings, and the entry
// veil shows the live scene through itself rather than a film of it. What is
// left on disk is an archive: the source renders, the upscale experiments, and
// the roots that would be needed to put any of it back. They are deliberately
// NOT deleted (several clips survive nowhere else), and they are just as
// deliberately not shipped.
//
// So this drops them on the way out. It is the whole difference between a
// ~2.4 GB deploy and a ~55 MB one.
//
// A DENY list would rot the moment a new folder landed; this matches by prefix
// instead, because the rule is not "these particular roots" but "no video ships
// at all", and that rule has no exceptions to keep in step with any more.
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)$/i

const dropVideo = () => ({
  name: 'drop-video',
  apply: 'build',
  closeBundle: async () => {
    const dist = resolve(__dirname, 'dist')
    const entries = await readdir(dist, { withFileTypes: true }).catch(() => [])
    let dropped = 0
    for (const d of entries) {
      const hit = d.isDirectory() ? d.name.startsWith('video') : VIDEO_FILE.test(d.name)
      if (!hit) continue
      const path = resolve(dist, d.name)
      const bytes = await stat(path).catch(() => null)
      if (!bytes) continue
      await rm(path, { recursive: true, force: true })
      console.log(`  dropped dist/${d.name}`)
      dropped += 1
    }
    // Silence here would mean this plugin has stopped matching the folder
    // layout — which is not an error (a clean public/ has nothing to drop) but
    // is worth being able to see in a build log rather than guess at.
    if (!dropped) console.log('  no video in dist — nothing to drop')
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dropVideo()],
})
