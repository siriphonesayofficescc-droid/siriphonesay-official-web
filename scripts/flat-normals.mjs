// Drop normals from faceted meshes (walls, slabs, boxes: every triangle flat) and weld their vertices.
// three.js then shades them flat, which looks identical but needs ~4x fewer vertices.
// Usage: node scripts/flat-normals.mjs in.glb out.glb
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, prune, dedup } from '@gltf-transform/functions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
let flat = 0, smooth = 0
for (const m of doc.getRoot().listMeshes())
  for (const p of m.listPrimitives()) {
    const n = p.getAttribute('NORMAL'), pos = p.getAttribute('POSITION')
    if (!n || (p.getAttribute('TEXCOORD_0') && process.env.ALL !== '1')) { smooth++; continue }
    const idx = p.getIndices()?.getArray() ?? Uint32Array.from({ length: pos.getCount() }, (_, i) => i)
    const P = pos.getArray(), N = n.getArray()
    let ok = true
    for (let t = 0; t < idx.length && ok; t += 3) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]]
      const ux = P[b*3]-P[a*3], uy = P[b*3+1]-P[a*3+1], uz = P[b*3+2]-P[a*3+2]
      const vx = P[c*3]-P[a*3], vy = P[c*3+1]-P[a*3+1], vz = P[c*3+2]-P[a*3+2]
      let fx = uy*vz-uz*vy, fy = uz*vx-ux*vz, fz = ux*vy-uy*vx
      const l = Math.hypot(fx, fy, fz); if (l < 1e-12) continue
      fx/=l; fy/=l; fz/=l
      for (const v of [a, b, c]) if (Math.abs(N[v*3]*fx + N[v*3+1]*fy + N[v*3+2]*fz) < 0.995) { ok = false; break }
    }
    if (ok || process.env.ALL === '1') { p.setAttribute('NORMAL', null); flat++ } else smooth++
  }
console.log('flat primitives', flat, 'smooth kept', smooth)
await doc.transform(weld(), dedup(), prune())
await io.write(process.argv[3], doc)
