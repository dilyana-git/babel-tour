import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Archived video lives under ignored source-assets/video-archive/, outside
// public/. The build no longer copies archival video at all.

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
