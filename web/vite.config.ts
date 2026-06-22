import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plain Vite SPA build. Output goes to web/dist, which Vercel serves as a
// static site. No backend: everything talks to the public Modrinth API
// directly from the browser.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
