// world bounds exactly as the website computes them: three.js GLTFLoader + Box3.setFromObject (textures stripped)
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
for (const t of doc.getRoot().listTextures()) t.dispose()
for (const x of doc.getRoot().listExtensionsUsed()) if (x.extensionName === 'EXT_texture_webp') x.dispose()
const bin = await io.writeBinary(doc)
const gltf = await new GLTFLoader().parseAsync(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), '')
gltf.scene.updateMatrixWorld(true)
const box = new THREE.Box3().setFromObject(gltf.scene, true)
const f = (v) => v.toArray().map((x) => x.toFixed(2)).join(', ')
console.log(process.argv[2].split('/').slice(-2).join('/'), '| centre', f(box.getCenter(new THREE.Vector3())), '| size', f(box.getSize(new THREE.Vector3())), '| min', f(box.min), '| max', f(box.max))
