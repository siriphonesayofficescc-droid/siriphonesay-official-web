/**
 * Converts a 3D model exported from SketchUp into a web-ready GLB, in the browser.
 * Accepts:
 *   • .glb                      — used as is
 *   • .dae (Collada)            — SketchUp: File → Export → 3D Model → .dae
 *   • .zip with .dae + textures — the .dae and its texture folder zipped together (recommended)
 * Units and up-axis are taken from the file (SketchUp exports inches, Z-up).
 */
import * as THREE from 'three'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { unzipSync } from 'three/examples/jsm/libs/fflate.module.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
type Simplifier = typeof import('meshoptimizer').MeshoptSimplifier
let MeshoptSimplifier: Simplifier | null = null

/** colour to use when a texture image is missing, guessed from its file name */
function guessColour(file: string): string | null {
  const f = file.toLowerCase()
  const rules: [RegExp, string][] = [
    [/wood|timber|herringbone|parquet|oak|walnut|teak|木/, '#8B5E3C'],
    [/grass|lawn|turf|草/, '#6E8B4E'],
    [/gravel|pebble/, '#9C978C'],
    [/roof.*red|red.*roof|terracotta|clay/, '#8E3B2E'],
    [/roof|metal|steel|alumin/, '#55595E'],
    [/marble/, '#E6E2DA'],
    [/granite|stone|rock/, '#9A9286'],
    [/brick/, '#9A5B43'],
    [/cinder|block|concrete|cement|aggregate|plaster|stucco/, '#A9A7A2'],
    [/tile|ceramic/, '#D3CEC5'],
    [/glass|window/, '#9FB6C4'],
    [/water|pool/, '#4FA3C7'],
    [/fabric|carpet|rug|leather|sofa/, '#B9AE9C'],
  ]
  return rules.find(([re]) => re.test(f))?.[1] ?? null
}

/** sloppy simplification of dense, untextured meshes (lamps, handles, plants…); returns new triangle count */
function slim(g: THREE.BufferGeometry, uses: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  if (!pos) return g
  const tris = (g.index ? g.index.count : pos.count) / 3
  g.computeBoundingBox()
  const s = g.boundingBox!.getSize(new THREE.Vector3())
  const size = Math.max(s.x, s.y, s.z)
  const small = size < 0.5 && tris > 300
  if (!(small || tris > 15000 || (tris > 800 && tris * uses > 12000))) return g
  // keep texture coordinates, so textured objects (roof tiles, fabrics, cars) still show their texture after simplifying
  const p = new THREE.BufferGeometry()
  p.setAttribute('position', pos.clone())
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined
  if (uv) p.setAttribute('uv', uv.clone())
  if (g.index) p.setIndex(g.index.clone())
  const merged = mergeVertices(p, 1e-5)
  const idx = merged.index ? Uint32Array.from(merged.index.array as ArrayLike<number>) : Uint32Array.from({ length: merged.getAttribute('position').count }, (_, i) => i)
  const ratio = Math.max(Math.min(1, (small ? 120 : tris > 15000 ? 1500 : 800) / tris), 0.03)
  const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3)
  if (!MeshoptSimplifier) return g
  // error is relative to the object's size: keep big objects (roofs, curtains) within ~4 cm so their shape survives
  const res = MeshoptSimplifier.simplifySloppy(idx, merged.getAttribute('position').array as Float32Array, 3, null, target, small ? 1 : Math.min(0.08, 0.04 / Math.max(size, 0.01)))
  const out = (Array.isArray(res) ? res[0] : res) as Uint32Array
  merged.setIndex(new THREE.BufferAttribute(out, 1))
  merged.computeVertexNormals()
  merged.groups = []
  return merged
}

export interface ConvertResult {
  glb: Blob
  stats: { meshes: number; triangles: number; trianglesOut?: number; textures: number; missingTextures: string[]; size: [number, number, number]; levels?: number[] }
}

const norm = (p: string) => decodeURIComponent(p).replace(/\\/g, '/').split('/').pop()!.toLowerCase()

export async function convertToGlb(
  file: File,
  onProgress?: (msg: string) => void,
  /** tools only: receive huge models part by part (to be merged outside the browser) instead of one file */
  opts?: { onPart?: (i: number, bin: ArrayBuffer) => void | Promise<void>; forceParts?: boolean },
): Promise<ConvertResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.glb')) {
    return { glb: file, stats: { meshes: 0, triangles: 0, textures: 0, missingTextures: [], size: [0, 0, 0] } }
  }
  let daeText: string
  const textures = new Map<string, string>() // file name → blob URL
  if (name.endsWith('.zip')) {
    onProgress?.('Unzipping…')
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const daeName = Object.keys(files).find((n) => n.toLowerCase().endsWith('.dae'))
    if (!daeName) throw new Error('The zip has no .dae file inside.')
    daeText = new TextDecoder().decode(files[daeName])
    for (const [n, bytes] of Object.entries(files)) {
      if (/\.(jpe?g|png|bmp|tga|tif|webp)$/i.test(n)) {
        const type = /\.png$/i.test(n) ? 'image/png' : 'image/jpeg'
        textures.set(norm(n), URL.createObjectURL(new Blob([bytes as BlobPart], { type })))
      }
    }
  } else if (name.endsWith('.dae')) {
    daeText = await file.text()
  } else {
    throw new Error('Please upload a .glb, a .dae, or a .zip containing the .dae and its textures.')
  }

  onProgress?.('Reading the SketchUp model…')
  const missing = new Set<string>()
  // material name → texture file name (from the Collada XML), used to guess colours of missing textures
  const texMap = new Map<string, string>()
  try {
    const xml = new DOMParser().parseFromString(daeText, 'application/xml')
    const imgs = new Map<string, string>()
    xml.querySelectorAll('library_images > image').forEach((im) => imgs.set(im.id, im.querySelector('init_from')?.textContent ?? ''))
    const fx = new Map<string, string>()
    xml.querySelectorAll('library_effects > effect').forEach((ef) => {
      const ref = ef.querySelector('surface > init_from')?.textContent ?? ''
      if (ref && imgs.has(ref)) fx.set(ef.id, norm(imgs.get(ref)!))
    })
    xml.querySelectorAll('library_materials > material').forEach((mt) => {
      const url = mt.querySelector('instance_effect')?.getAttribute('url')?.replace('#', '') ?? ''
      if (fx.has(url)) texMap.set(mt.getAttribute('name') ?? mt.id, fx.get(url)!)
    })
  } catch {
    /* colours are only a fallback */
  }
  const manager = new THREE.LoadingManager()
  manager.setURLModifier((url) => {
    const hit = textures.get(norm(url))
    if (hit) return hit
    missing.add(norm(url))
    // 1×1 transparent pixel keeps the loader happy; the material colour is used instead
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  })
  const loader = new ColladaLoader(manager)
  const collada = loader.parse(daeText, '')
  if (!collada) throw new Error('The .dae file could not be read.')
  const scene = collada.scene
  // wait for textures to finish decoding
  await new Promise<void>((resolve) => {
    let done = false
    manager.onLoad = () => !done && ((done = true), resolve())
    setTimeout(() => !done && ((done = true), resolve()), 8000)
  })

  // drop SketchUp edges, guides and axes (lines/points) — only surfaces are shown
  const drop: THREE.Object3D[] = []
  scene.traverse((o) => {
    if ((o as THREE.Line).isLine || (o as THREE.Points).isPoints) drop.push(o)
  })
  drop.forEach((o) => o.parent?.remove(o))

  // geometry shared by repeated components (doors, lamps…) counts once per use
  const uses = new Map<string, number>()
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) uses.set(m.geometry.uuid, (uses.get(m.geometry.uuid) ?? 0) + 1)
  })
  try {
    const mo = await import('meshoptimizer')
    await mo.MeshoptSimplifier.ready
    MeshoptSimplifier = mo.MeshoptSimplifier
  } catch {
    MeshoptSimplifier = null // WebAssembly blocked: keep full detail
  }
  const slimmed = new Map<string, THREE.BufferGeometry>()

  // materials without a real texture: drop the placeholder map so the colour shows
  let meshes = 0
  let triangles = 0
  let trianglesOut = 0
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    meshes++
    const g = m.geometry as THREE.BufferGeometry
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    // SketchUp/Collada gives Phong/Lambert materials; the web viewer uses physically based (standard) materials
    const conv = mats.map((mat) => {
      const mm = mat as THREE.MeshPhongMaterial
      const hasTex = !!(mm.map && mm.map.image && (mm.map.image as HTMLImageElement).width > 1)
      const glassy = mm.transparent && mm.opacity < 0.9
      const guess = !hasTex ? guessColour(`${mm.name} ${texMap.get(mm.name) ?? ''}`) : null
      return new THREE.MeshStandardMaterial({
        name: mm.name,
        color: guess && (!mm.color || mm.color.getHexString() === 'ffffff') ? new THREE.Color(guess) : (mm.color ?? new THREE.Color('#cccccc')),
        map: hasTex ? mm.map : null,
        transparent: mm.transparent,
        opacity: mm.opacity,
        roughness: glassy ? 0.05 : 0.8,
        metalness: glassy ? 0.1 : 0,
        side: THREE.DoubleSide, // SketchUp faces are often one-sided
      })
    })
    m.material = Array.isArray(m.material) ? conv : conv[0]
    // simplify dense untextured geometry (keeps textured surfaces exact)
    if (!conv.some((c) => c.map)) {
      const key = m.geometry.uuid
      if (!slimmed.has(key)) slimmed.set(key, slim(m.geometry, uses.get(key) ?? 1))
      const ng = slimmed.get(key)!
      if (ng !== m.geometry) {
        m.geometry = ng
        if (Array.isArray(m.material)) m.material = m.material[0]
      }
    }
    const g2 = m.geometry as THREE.BufferGeometry
    trianglesOut += (g2.index ? g2.index.count : g2.attributes.position.count) / 3
  })
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(scene)
  const size = box.getSize(new THREE.Vector3())
  // stand the model on the ground, centred
  const centre = box.getCenter(new THREE.Vector3())
  const root = new THREE.Group()
  scene.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z))
  root.add(scene)
  root.updateMatrixWorld(true)
  const levels = detectLevels(root)

  onProgress?.('Writing the web 3D file…')
  const exportGlb = (obj: THREE.Object3D) =>
    new Promise<ArrayBuffer | null>((resolve) =>
      new GLTFExporter().parse(obj, (r) => resolve((r as ArrayBuffer) ?? null), () => resolve(null), { binary: true, onlyVisible: true, maxTextureSize: 2048 }),
    )
  let glb = opts?.forceParts ? null : await exportGlb(root)
  if (!glb || glb.byteLength < 100) {
    // very large models (big landscape + furnished interior) are too big to write in one go:
    // write them in parts and join the parts into one file
    onProgress?.('Large model — writing it in parts…')
    glb = await exportInParts(root, exportGlb, onProgress, 400_000, opts?.onPart)
  }
  textures.forEach((u) => URL.revokeObjectURL(u))
  return {
    glb: new Blob([glb], { type: 'model/gltf-binary' }),
    stats: { meshes, triangles: Math.round(triangles), trianglesOut: Math.round(trianglesOut), textures: textures.size, missingTextures: [...missing], size: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)], levels },
  }
}

/**
 * Guess the finished floor heights (m above ground) of each storey: heights where a lot of
 * upward-facing horizontal surface sits (floor slabs, tiles). The highest group is the roof and is left out.
 * Used to pre-fill "Floor levels" for Floor plans / Walk inside; staff can correct it.
 */
export function detectLevels(root: THREE.Object3D): number[] {
  const bins = new Map<number, number>()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const g = m.geometry as THREE.BufferGeometry
    const pos = g.attributes.position
    if (!pos) return
    const idx = g.index
    const count = idx ? idx.count : pos.count
    for (let t = 0; t < count; t += 3) {
      const i = idx ? idx.getX(t) : t, j = idx ? idx.getX(t + 1) : t + 1, k = idx ? idx.getX(t + 2) : t + 2
      a.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
      b.fromBufferAttribute(pos, j).applyMatrix4(m.matrixWorld)
      c.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld)
      n.subVectors(b, a).cross(c.clone().sub(a))
      const area = n.length() / 2
      if (area < 1e-4 || Math.abs(n.y) / (2 * area) < 0.98) continue
      const key = Math.round(a.y * 10) / 10
      bins.set(key, (bins.get(key) ?? 0) + area)
    }
  })
  const big = [...bins].filter(([, v]) => v > 25).map(([h]) => h).sort((x, y) => x - y)
  // group heights closer than 0.6 m (plinth + tiles, slab + finish); keep the top of each group
  const groups: number[] = []
  for (const h of big) {
    if (groups.length && h - groups[groups.length - 1] <= 0.6) groups[groups.length - 1] = h
    else groups.push(h)
  }
  // storeys are at least 2.4 m apart
  const levels: number[] = []
  for (const h of groups) if (!levels.length || h - levels[levels.length - 1] >= 2.4) levels.push(h)
  if (levels.length > 1) levels.pop() // roof
  return levels.map((h) => +h.toFixed(2))
}

/** split the scene into groups of roughly `limit` triangles, export each, then merge them into one GLB */
async function exportInParts(
  root: THREE.Object3D,
  exportGlb: (o: THREE.Object3D) => Promise<ArrayBuffer | null>,
  onProgress?: (msg: string) => void,
  limit = 400_000,
  onPart?: (i: number, bin: ArrayBuffer) => void | Promise<void>,
): Promise<ArrayBuffer> {
  const { WebIO } = await import('@gltf-transform/core')
  const { mergeDocuments, unpartition, dedup, prune } = await import('@gltf-transform/functions')
  const io = new WebIO()
  // break the tree into leaf meshes (with world transforms baked into their parent chain) and pack them
  const meshes: THREE.Mesh[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.visible) meshes.push(o as THREE.Mesh)
  })
  const tri = (m: THREE.Mesh) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3
  const groups: THREE.Mesh[][] = [[]]
  let n = 0
  for (const m of meshes) {
    if (n > limit && groups[groups.length - 1].length) (groups.push([]), (n = 0))
    groups[groups.length - 1].push(m)
    n += tri(m)
  }
  let out: Awaited<ReturnType<typeof io.readBinary>> | null = null
  for (let i = 0; i < groups.length; i++) {
    onProgress?.(`Writing part ${i + 1} of ${groups.length}…`)
    const part = new THREE.Group()
    for (const m of groups[i]) {
      const c = new THREE.Mesh(m.geometry, m.material)
      c.name = m.name
      m.matrixWorld.decompose(c.position, c.quaternion, c.scale)
      part.add(c)
    }
    const bin = await exportGlb(part)
    if (!bin) throw new Error('The model is too large to convert in the browser. Try exporting the landscape and the house separately.')
    if (onPart) {
      await onPart(i, bin)
      continue
    }
    const d = await io.readBinary(new Uint8Array(bin))
    if (!out) out = d
    else mergeDocuments(out, d)
  }
  if (onPart) return new ArrayBuffer(0)
  if (!out) throw new Error('Nothing to export.')
  // one scene, one buffer
  const root2 = out.getRoot()
  const scenes = root2.listScenes()
  for (const sc of scenes.slice(1)) {
    for (const node of sc.listChildren()) scenes[0].addChild(node)
    sc.dispose()
  }
  root2.setDefaultScene(scenes[0])
  await out.transform(unpartition(), dedup(), prune())
  const u8 = await io.writeBinary(out)
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}
