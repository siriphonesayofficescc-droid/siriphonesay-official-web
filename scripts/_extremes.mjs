// list meshes (per material after merging) whose world bounds go below / above given heights
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import * as THREE from 'three'
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2])
const lo = +(process.argv[3] ?? -1), hi = +(process.argv[4] ?? 10)
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh()
  if (!m) continue
  const W = new THREE.Matrix4().fromArray(n.getWorldMatrix())
  for (const p of m.listPrimitives()) {
    const a = p.getAttribute('POSITION')
    const k = a.getNormalized() ? ({ 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 })[a.getComponentType()] : 1
    const v = new THREE.Vector3(), e = []
    let mn = Infinity, mx = -Infinity, cnt = 0
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, e)
      v.set(e[0] / k, e[1] / k, e[2] / k).applyMatrix4(W)
      mn = Math.min(mn, v.y), mx = Math.max(mx, v.y)
      if (v.y < lo || v.y > hi) cnt++
    }
    if (cnt) console.log(`${p.getMaterial()?.getName()}: y ${mn.toFixed(2)}..${mx.toFixed(2)}, ${cnt}/${a.getCount()} vertices outside`)
  }
}
