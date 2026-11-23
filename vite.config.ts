import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Content fingerprints of the catalogue house files (3D models and cover images) in public/catalog.
 * The site adds them to the file addresses (model.glb?v=…), so after a model is replaced, browsers fetch the
 * new file at once instead of showing their 30-day cached copy; unchanged files stay cached.
 */
function catalogVersions() {
  const dir = path.resolve(__dirname, 'public/catalog')
  const out: Record<string, string> = {}
  if (!fs.existsSync(dir)) return out
  for (const id of fs.readdirSync(dir)) {
    const sub = path.join(dir, id)
    if (!fs.statSync(sub).isDirectory()) continue
    for (const f of fs.readdirSync(sub)) {
      if (!/\.(glb|jpe?g|png|webp)$/i.test(f)) continue
      out[`catalog/${id}/${f}`] = createHash('sha1').update(fs.readFileSync(path.join(sub, f))).digest('hex').slice(0, 10)
    }
  }
  return out
}

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  define: {
    __CATALOG_VERSIONS__: JSON.stringify(catalogVersions()),
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
})
