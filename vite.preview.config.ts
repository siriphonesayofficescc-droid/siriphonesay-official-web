// Builds a single self-contained index.html for sandboxed previews.
// Usage: npm run build:preview  →  dist-preview/index.html
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_PREVIEW_SINGLEFILE': JSON.stringify('true') },
  build: { outDir: 'dist-preview', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 5000 },
})
