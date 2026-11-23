import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const root = doc.getRoot()
let img = 0
for (const t of root.listTextures()) img += t.getImage()?.byteLength ?? 0
let acc = 0
for (const a of root.listAccessors()) acc += a.getByteLength()
console.log('textures MB', (img/1e6).toFixed(1), 'count', root.listTextures().length, '| accessors MB', (acc/1e6).toFixed(1))
const rows = []
for (const n of root.listNodes()) {
  const m = n.getMesh(); if (!m) continue
  const inst = n.getExtension('EXT_mesh_gpu_instancing')
  const count = inst ? inst.listAttributes()[0].getCount() : 1
  let tris = 0, bytes = 0
  for (const p of m.listPrimitives()) { tris += (p.getIndices()?.getCount() ?? 0)/3; for (const a of p.listAttributes()) bytes += a.getByteLength(); bytes += p.getIndices()?.getByteLength() ?? 0 }
  const mats = [...new Set(m.listPrimitives().map(p=>p.getMaterial()?.getName()))].slice(0,3).join(',')
  rows.push({ name: n.getName(), tris, count, render: tris*count, kb: bytes/1e3, mats })
}
const by = (k) => [...rows].sort((a,b)=>b[k]-a[k]).slice(0,25)
console.log('nodes', rows.length, 'instanced', rows.filter(r=>r.count>1).length, 'total render tris', rows.reduce((s,r)=>s+r.render,0).toLocaleString())
console.log('--- top by bytes'); for (const r of by('kb')) console.log(r.kb.toFixed(0)+'KB', r.tris, 'x'+r.count, r.name, '|', r.mats)
console.log('--- top by render tris'); for (const r of by('render')) console.log(r.render, r.tris, 'x'+r.count, r.name, '|', r.mats)
// bytes by attribute semantic
const sem = {}
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  for (const s of p.listSemantics()) { const a = p.getAttribute(s); sem[s+':'+a.getComponentType()] = (sem[s+':'+a.getComponentType()]??0) + a.getByteLength() }
  const i = p.getIndices(); if (i) sem['INDICES:'+i.getComponentType()] = (sem['INDICES:'+i.getComponentType()]??0) + i.getByteLength()
}
console.log('bytes by attribute (MB):', Object.fromEntries(Object.entries(sem).map(([k,v])=>[k,(v/1e6).toFixed(1)])))
