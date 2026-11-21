import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, dedup, prune, getBounds, compactPrimitive, normals } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const STRONG = process.env.STRONG === '1'
const LIGHT = process.env.LIGHT === '1'
// LIGHT=1 (huge sites with landscape): also thin out every object above ~500 triangles
// dense textured objects (cars, beds, sofas): drop their faceted normals first so welding joins
// the vertices inside each texture island; they are simplified seam-aware and get smooth normals back
const isTexturedDense = (p) => {
  const mat = p.getMaterial()
  return !!mat?.getBaseColorTexture() && !!p.getAttribute('TEXCOORD_0') && mat.getAlphaMode() === 'OPAQUE' && tri(p) > 1500
}
const tri = (p) => { const i = p.getIndices(); return (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3 }
if (STRONG) for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) if (isTexturedDense(p)) p.setAttribute('NORMAL', null)
await doc.transform(dedup(), weld())
let before = 0, after = 0
for (const m of doc.getRoot().listMeshes()) {
  const prims = m.listPrimitives()
  const t = prims.reduce((s, p) => s + tri(p), 0)
  before += t
  // dense objects (light fittings, plants, furniture, cars): simplify hard; plain walls are untouched
  const uses = Math.max(1, m.listParents().filter((x) => x.propertyType === 'Node').length)
  // simplify dense objects, counting how often they are repeated (lamps, chairs, plants…)
  const node = m.listParents().find((x) => x.propertyType === 'Node')
  const b = node ? getBounds(node) : null
  const size = b ? Math.max(...b.max.map((v, i) => v - b.min[i])) : 9
  // tiny details (handles, locks, switches) → ~120 triangles; repeated or dense objects → ~800–1500
  const small = size < 0.5 && t > 300
  // STRONG=1 (big furnished interiors): also thin out medium-detail objects (sofas, beds, decor)
  const medium = STRONG && !small && t > (LIGHT ? 500 : 2500)
  if (small || medium || t > 15000 || (t > 800 && t * uses > 12000)) {
    const ratio = medium && t <= 15000 && !(t * uses > 12000)
      ? Math.max(LIGHT ? 0.4 : 0.35, (LIGHT ? 500 : 1200) / t)
      : Math.max(Math.min(1, (small ? 120 : t > 15000 ? (STRONG && size > 1.2 ? 4000 : 1500) : 800) / t), 0.03)
    for (const p of prims) {
      if (tri(p) < 12) continue
      // textured surfaces (roof tiles, fabrics, car paint, wood): sloppy simplification mixes up the
      // texture coordinates across seams and the texture turns into a 'camouflage' mess — use the
      // seam-aware simplifier there, and only on dense objects
      const mat = p.getMaterial()
      // leaves/grass (see-through textures) can be thinned freely; other textured objects are kept as they are
      const textured = !!mat?.getBaseColorTexture() && !!p.getAttribute('TEXCOORD_0') && mat.getAlphaMode() === 'OPAQUE'
      const pos = p.getAttribute('POSITION')
      let idx = p.getIndices()?.getArray()
      if (!idx) idx = Uint32Array.from({ length: pos.getCount() }, (_, i) => i)
      const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3)
      // sloppy simplification ignores attribute seams (needed for faceted SketchUp meshes)
      let out
      if (textured) {
        if (!STRONG || p.getAttribute('NORMAL') || tri(p) < 1500) continue
        // seam-aware: vertices split by texture seams stay put, so the texture keeps its place
        out = MeshoptSimplifier.simplify(Uint32Array.from(idx), Float32Array.from(pos.getArray()), 3, Math.max(target, Math.floor((idx.length * 0.3) / 3) * 3), 0.03, [])
      } else out = MeshoptSimplifier.simplifySloppy(Uint32Array.from(idx), pos.getArray(), 3, null, target, small ? 1 : Math.min(0.08, (size > 3 ? 0.12 : 0.04) / Math.max(size, 0.01)))
      const acc = p.getIndices() ?? doc.createAccessor().setType('SCALAR').setBuffer(pos.getBuffer())
      acc.setArray(new Uint32Array(out[0] ?? out))
      p.setIndices(acc)
      // drop the vertices the simpler mesh no longer uses (otherwise the file stays as big)
      compactPrimitive(p)
    }
  }
  after += m.listPrimitives().reduce((s, p) => s + tri(p), 0)
}
await doc.transform(normals({ overwrite: false }), prune())
console.log('unique tris', Math.round(before), '→', Math.round(after))
await io.write(process.argv[3], doc)
