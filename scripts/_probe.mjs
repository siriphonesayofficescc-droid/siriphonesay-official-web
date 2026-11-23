// load a catalogue GLB like the website (origin offset) and probe floor heights with rays
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
const [, , file, ox, oy, oz, ...pts] = process.argv
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(file)
for (const t of doc.getRoot().listTextures()) t.dispose()
const bin = await io.writeBinary(doc)
const g = await new GLTFLoader().parseAsync(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), '')
const s = g.scene
s.position.set(-ox, -oy, -oz)
s.updateMatrixWorld(true)
const ray = new THREE.Raycaster()
for (const p of pts) {
  const [x, z, from] = p.split(',').map(Number)
  ray.set(new THREE.Vector3(x, from, z), new THREE.Vector3(0, -1, 0))
  const down = ray.intersectObject(s, true)[0]
  ray.set(new THREE.Vector3(x, (down?.point.y ?? from) + 0.3, z), new THREE.Vector3(0, 1, 0))
  const up = ray.intersectObject(s, true)[0]
  console.log(`(${x}, ${z}) from ${from}: floor ${down ? down.point.y.toFixed(2) + ' [' + (down.object.material?.name ?? '') + ']' : 'none'} · ceiling ${up ? (up.point.y - (down?.point.y ?? 0)).toFixed(2) + ' m above' : 'open sky'}`)
}
