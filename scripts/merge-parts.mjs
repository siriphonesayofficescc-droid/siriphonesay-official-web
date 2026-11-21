// Join model parts written by the converter (huge SketchUp models) into one GLB.
// Usage: node scripts/merge-parts.mjs out.glb part0.glb part1.glb ...
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { mergeDocuments, unpartition, dedup, prune } from '@gltf-transform/functions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const [out, ...parts] = process.argv.slice(2)
const doc = await io.read(parts[0])
for (const p of parts.slice(1)) mergeDocuments(doc, await io.read(p))
const root = doc.getRoot(), scenes = root.listScenes()
for (const sc of scenes.slice(1)) {
  for (const n of sc.listChildren()) scenes[0].addChild(n)
  sc.dispose()
}
root.setDefaultScene(scenes[0])
await doc.transform(unpartition(), dedup(), prune())
await io.write(out, doc)
console.log('merged', parts.length, 'parts →', out)
