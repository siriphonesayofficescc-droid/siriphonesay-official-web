/**
 * High-fidelity SketchUp COLLADA (.dae) → GLB converter for the 3D house catalogue.
 *
 *   node --max-old-space-size=6144 scripts/dae-to-glb.mjs "<model.dae>" public/catalog/<id>/model.glb [--tex 1024]
 *
 * Unlike the old browser pipeline it keeps everything the SketchUp model has:
 *  - all geometry (no lossy simplification) with SketchUp's own face normals
 *  - texture coordinates + the texture images (from the "<model name>" folder next to the .dae)
 *  - material colours, transparency (glass), names
 *  - component instancing (repeated chairs, lamps, plants… are stored once → GPU instancing)
 * Output is a plain GLB (no Draco / Meshopt — no WebAssembly decoder needed), quantized, textures as WebP.
 * The XML is parsed as a stream, so 150 MB+ exports convert with modest memory.
 */
import fs from 'node:fs'
import path from 'node:path'
import { SaxesParser } from 'saxes'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, instance, quantize, textureCompress, flatten, join, weld, simplifyPrimitive } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const [, , inPath, outPath, ...rest] = process.argv
if (!inPath || !outPath) {
  console.error('usage: node scripts/dae-to-glb.mjs in.dae out.glb [--tex 1024] [--no-join]')
  process.exit(1)
}
const opt = (k, d) => (rest.includes(k) ? Number(rest[rest.indexOf(k) + 1]) : d)
const texSize = opt('--tex', 1024)
/** objects denser than this many triangles get error-bounded simplification */
const DENSE = opt('--dense', 1500)
/** max geometric deviation allowed by simplification, in metres (absolute, so small objects keep their detail) */
const ERROR_M = opt('--error', 0.01)
const doJoin = !rest.includes('--no-join')
const doInstance = !rest.includes('--no-instance')
const t0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a)

/* ───────────── 1. stream-parse the COLLADA file into a light structure ───────────── */
const images = new Map() // id → file
const effects = new Map() // id → { color, tex (surface/sampler sid or image id), transparent, transparency, opaque }
const materials = new Map() // id → { name, effect }
const geometries = new Map() // id → { sources: Map, vertices: Map, prims: [] }
const libNodes = new Map() // id → node
let unitMeter = 0.0254
let upAxis = 'Z_UP'
const sceneRoots = []

const stack = [] // element names
let text = ''
let cur = {} // current objects being built
const nodeStack = []

function parseFloats(str, count) {
  const out = new Float32Array(count)
  let i = 0, j = 0
  const n = str.length
  while (i < n && j < count) {
    while (i < n && str.charCodeAt(i) <= 32) i++
    let k = i
    while (k < n && str.charCodeAt(k) > 32) k++
    if (k > i) out[j++] = +str.slice(i, k)
    i = k
  }
  return out
}
function parseInts(str) {
  const arr = []
  let v = 0, inNum = false
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c >= 48 && c <= 57) {
      v = v * 10 + (c - 48)
      inNum = true
    } else if (inNum) {
      arr.push(v)
      v = 0
      inNum = false
    }
  }
  if (inNum) arr.push(v)
  return Uint32Array.from(arr)
}
const strip = (u) => (u && u.startsWith('#') ? u.slice(1) : u)

const parser = new SaxesParser({ xmlns: false })
parser.on('opentag', (tag) => {
  const name = tag.name
  const a = tag.attributes
  const parent = stack[stack.length - 1]
  stack.push(name)
  text = ''
  switch (name) {
    case 'unit':
      unitMeter = +a.meter || unitMeter
      break
    case 'image':
      cur.image = a.id
      break
    case 'effect':
      cur.effect = { id: a.id, color: [0.8, 0.8, 0.8, 1], params: {}, tex: null, transparency: 1, transparent: null, opaque: 'A_ONE' }
      break
    case 'newparam':
      cur.newparam = a.sid
      break
    case 'texture':
      if (cur.effect && stack.includes('diffuse')) cur.effect.tex = a.texture
      break
    case 'transparent':
      if (cur.effect) cur.effect.opaque = a.opaque || 'A_ONE'
      break
    case 'material':
      if (stack.includes('library_materials')) cur.material = { id: a.id, name: a.name || a.id, effect: null }
      break
    case 'instance_effect':
      if (cur.material) cur.material.effect = strip(a.url)
      break
    case 'geometry':
      cur.geo = { id: a.id, sources: new Map(), vertices: new Map(), prims: [] }
      break
    case 'source':
      if (cur.geo) cur.source = { id: a.id, data: null, stride: 3 }
      break
    case 'float_array':
      if (cur.source) cur.floatCount = +a.count
      break
    case 'accessor':
      if (cur.source) cur.source.stride = +a.stride || 3
      break
    case 'vertices':
      if (cur.geo) cur.vertices = { id: a.id, inputs: {} }
      break
    case 'triangles':
    case 'polylist':
      if (cur.geo) cur.prim = { kind: name, material: a.material, count: +a.count, inputs: [], p: null, vcount: null }
      break
    case 'lines':
      cur.skipLines = true
      break
    case 'input':
      if (cur.vertices && parent === 'vertices') cur.vertices.inputs[a.semantic] = strip(a.source)
      else if (cur.prim && !cur.skipLines) cur.prim.inputs.push({ semantic: a.semantic, source: strip(a.source), offset: +a.offset || 0, set: +a.set || 0 })
      break
    case 'node': {
      const node = { id: a.id, name: a.name || '', matrix: null, children: [], geoms: [], insts: [], camera: false }
      const p = nodeStack[nodeStack.length - 1]
      if (p) p.children.push(node)
      else if (stack.includes('library_nodes')) libNodes.set(a.id, node)
      else if (stack.includes('visual_scene')) sceneRoots.push(node)
      nodeStack.push(node)
      break
    }
    case 'instance_geometry':
      cur.ig = { url: strip(a.url), bind: {} }
      nodeStack[nodeStack.length - 1]?.geoms.push(cur.ig)
      break
    case 'instance_material':
      if (cur.ig) cur.ig.bind[a.symbol] = strip(a.target)
      break
    case 'instance_node':
      nodeStack[nodeStack.length - 1]?.insts.push(strip(a.url))
      if (libNodes.has(strip(a.url)) === false && !nodeStack.length) break
      break
    case 'instance_camera':
      if (nodeStack.length) nodeStack[nodeStack.length - 1].camera = true
      break
  }
})
parser.on('text', (t) => {
  // only keep text for the elements whose content we need
  const top = stack[stack.length - 1]
  if (top === 'float_array' || top === 'p' || top === 'vcount' || top === 'matrix' || top === 'color' || top === 'float' || top === 'init_from' || top === 'up_axis' || top === 'source')
    text += t
})
parser.on('closetag', (tag) => {
  const name = tag.name
  stack.pop()
  const parent = stack[stack.length - 1]
  switch (name) {
    case 'up_axis':
      upAxis = text.trim()
      break
    case 'init_from':
      if (cur.image && parent === 'image') images.set(cur.image, decodeURIComponent(text.trim()))
      else if (cur.effect && cur.newparam) cur.effect.params[cur.newparam] = { surface: text.trim() }
      break
    case 'source':
      if (cur.effect && cur.newparam && parent === 'sampler2D') cur.effect.params[cur.newparam] = { sampler: text.trim() }
      else if (cur.source && cur.geo) {
        cur.geo.sources.set(cur.source.id, cur.source)
        cur.source = null
      }
      break
    case 'image':
      cur.image = null
      break
    case 'newparam':
      cur.newparam = null
      break
    case 'color':
      if (cur.effect && parent === 'diffuse') cur.effect.color = text.trim().split(/\s+/).map(Number)
      else if (cur.effect && parent === 'transparent') cur.effect.transparent = text.trim().split(/\s+/).map(Number)
      break
    case 'float':
      if (cur.effect && stack.includes('transparency')) cur.effect.transparency = +text.trim()
      break
    case 'effect':
      effects.set(cur.effect.id, cur.effect)
      cur.effect = null
      break
    case 'material':
      if (cur.material) materials.set(cur.material.id, cur.material)
      cur.material = null
      break
    case 'float_array':
      if (cur.source) cur.source.data = parseFloats(text, cur.floatCount)
      break
    case 'vertices':
      if (cur.vertices) cur.geo.vertices.set(cur.vertices.id, cur.vertices.inputs)
      cur.vertices = null
      break
    case 'vcount':
      if (cur.prim) cur.prim.vcount = parseInts(text)
      break
    case 'p':
      if (cur.prim) cur.prim.p = parseInts(text)
      break
    case 'triangles':
    case 'polylist':
      if (cur.prim && cur.prim.p) cur.geo.prims.push(cur.prim)
      cur.prim = null
      break
    case 'lines':
      cur.skipLines = false
      break
    case 'geometry':
      geometries.set(cur.geo.id, cur.geo)
      cur.geo = null
      break
    case 'matrix':
      if (nodeStack.length) nodeStack[nodeStack.length - 1].matrix = text.trim().split(/\s+/).map(Number)
      break
    case 'instance_geometry':
      cur.ig = null
      break
    case 'node':
      nodeStack.pop()
      break
  }
  text = ''
})
parser.on('error', (e) => {
  throw e
})

log('parsing', inPath)
await new Promise((resolve, reject) => {
  const rs = fs.createReadStream(inPath, { encoding: 'utf8', highWaterMark: 1 << 20 })
  rs.on('data', (chunk) => {
    try {
      parser.write(chunk)
    } catch (e) {
      rs.destroy()
      reject(e)
    }
  })
  rs.on('end', () => {
    parser.close()
    resolve()
  })
  rs.on('error', reject)
})
log(`parsed: ${geometries.size} geometries, ${materials.size} materials, ${images.size} images, ${libNodes.size} components, unit ${unitMeter} m, ${upAxis}`)

/* ───────────── 2. build the glTF document ───────────── */
await MeshoptSimplifier.ready
const doc = new Document()
const buffer = doc.createBuffer()
const scene = doc.createScene('Scene')
const daeDir = path.dirname(inPath)

// textures
const textureCache = new Map()
function textureFor(imageId) {
  if (textureCache.has(imageId)) return textureCache.get(imageId)
  const rel = images.get(imageId)
  let tex = null
  if (rel) {
    const file = path.resolve(daeDir, rel.replace(/^file:\/\//, ''))
    if (fs.existsSync(file)) {
      const ext = path.extname(file).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
      tex = doc.createTexture(path.basename(file)).setImage(fs.readFileSync(file)).setMimeType(mime).setURI(path.basename(file))
    } else console.warn('  missing texture:', file)
  }
  textureCache.set(imageId, tex)
  return tex
}

const rough = (n) => {
  const s = n.toLowerCase()
  if (/glass|mirror|kính|translucent/.test(s)) return [0.05, 0.0]
  if (/chrome|steel|stainless|metal|alum|silver|gold|brass|inox/.test(s)) return [0.35, 0.65]
  if (/marble|granite|polish|ceramic|porcelain|tile|gloss|lacquer|water/.test(s)) return [0.25, 0]
  if (/wood|timber|veneer|oak|walnut|parquet|floor/.test(s)) return [0.55, 0]
  if (/fabric|carpet|rug|cloth|leather|velvet|grass|cushion|sofa/.test(s)) return [0.95, 0]
  return [0.8, 0]
}

const matCache = new Map()
function materialFor(matId) {
  const key = matId ?? '__default'
  if (matCache.has(key)) return matCache.get(key)
  const m = matId ? materials.get(matId) : null
  const eff = m ? effects.get(m.effect) : null
  const name = m?.name ?? 'default'
  const mat = doc.createMaterial(name).setDoubleSided(true)
  let color = eff?.color ?? [0.8, 0.8, 0.8, 1]
  let alpha = 1
  if (eff) {
    // COLLADA transparency (same rules as three.js ColladaLoader)
    const tr = eff.transparent
    if (tr || eff.transparency !== 1) {
      const c = tr ?? [1, 1, 1, 1]
      alpha = eff.opaque === 'RGB_ZERO' ? 1 - c[0] * eff.transparency : (c[3] ?? 1) * eff.transparency
      if (eff.opaque === 'A_ZERO') alpha = 1 - (c[3] ?? 1) * eff.transparency
    }
    // texture: <texture texture="sampler"> → sampler → surface → image
    if (eff.tex) {
      let imgId = eff.tex
      const smp = eff.params[eff.tex]
      if (smp?.sampler) {
        const surf = eff.params[smp.sampler]
        if (surf?.surface) imgId = surf.surface
      }
      const tex = textureFor(imgId)
      if (tex) {
        mat.setBaseColorTexture(tex)
        color = [1, 1, 1, 1]
        if (tex.getMimeType() === 'image/png') mat.setAlphaMode('MASK').setAlphaCutoff(0.5)
      }
    }
  }
  alpha = Math.max(0, Math.min(1, alpha))
  const [r, metal] = rough(name)
  mat.setBaseColorFactor([color[0], color[1], color[2], alpha]).setRoughnessFactor(r).setMetallicFactor(metal)
  if (alpha < 0.98) mat.setAlphaMode('BLEND')
  matCache.set(key, mat)
  return mat
}

// meshes, one per (geometry, material binding)
/**
 * Dense, faceted SketchUp objects (decor, plants, fabric, curtains): weld by position (+UV), simplify with a strict
 * error bound (relative to the object's size), then rebuild normals with a 40° crease so hard edges stay sharp
 * and curved surfaces stay smooth.
 */
const reduced = [0, 0]
const CREASE = Math.cos((40 * Math.PI) / 180)
function reduceDense(P0, T0, idx0, o = {}) {
  const hasUV = T0.length > 0
  // 1. weld identical positions (+ identical UVs)
  const wmap = new Map()
  const WP = [], WT = []
  const remap = new Uint32Array(P0.length / 3)
  for (let v = 0; v < P0.length / 3; v++) {
    const x = P0[v * 3], y = P0[v * 3 + 1], z = P0[v * 3 + 2]
    let k = Math.round(x * 1000) + ',' + Math.round(y * 1000) + ',' + Math.round(z * 1000)
    if (hasUV) k += '|' + Math.round(T0[v * 2] * 4096) + ',' + Math.round(T0[v * 2 + 1] * 4096)
    let w = wmap.get(k)
    if (w === undefined) {
      w = WP.length / 3
      wmap.set(k, w)
      WP.push(x, y, z)
      if (hasUV) WT.push(T0[v * 2], T0[v * 2 + 1])
    }
    remap[v] = w
  }
  const widx = new Uint32Array(idx0.length)
  for (let i = 0; i < idx0.length; i++) widx[i] = remap[idx0[i]]
  // 2. error-bounded simplification
  const pos = new Float32Array(WP)
  const tris = idx0.length / 3
  const ratio = o.ratio ?? Math.max(0.12, Math.min(0.5, DENSE / tris))
  if (process.env.DEBUG_VEG && o.errorScale) console.log('  reduce', tris, 'ratio', ratio, 'scale', o.errorScale)
  const target = Math.max(3, Math.floor(ratio * tris) * 3)
  const errAbs = (ERROR_M * (o.errorScale ?? 1)) / unitMeter // model units
  // Permissive: SketchUp maps textures face by face, so every edge is a UV seam; allow collapses across seams
  const flags = ['ErrorAbsolute', ...(o.prune ? ['Prune'] : []), ...(hasUV ? ['Permissive'] : [])]
  const [sidx] = MeshoptSimplifier.simplify(widx, pos, 3, target, errAbs, flags)
  // 3. crease-angle normals, output faceted where needed
  const nt = sidx.length / 3
  const fn = new Float32Array(nt * 3)
  const vf = new Map() // welded vertex → faces (by position only, so smoothing crosses UV seams)
  const posKey = (w) => Math.round(WP[w * 3] * 1000) + ',' + Math.round(WP[w * 3 + 1] * 1000) + ',' + Math.round(WP[w * 3 + 2] * 1000)
  const keys = new Array(WP.length / 3)
  for (let f = 0; f < nt; f++) {
    const a = sidx[f * 3], b = sidx[f * 3 + 1], c = sidx[f * 3 + 2]
    const ux = WP[b * 3] - WP[a * 3], uy = WP[b * 3 + 1] - WP[a * 3 + 1], uz = WP[b * 3 + 2] - WP[a * 3 + 2]
    const vx = WP[c * 3] - WP[a * 3], vy = WP[c * 3 + 1] - WP[a * 3 + 1], vz = WP[c * 3 + 2] - WP[a * 3 + 2]
    fn[f * 3] = uy * vz - uz * vy
    fn[f * 3 + 1] = uz * vx - ux * vz
    fn[f * 3 + 2] = ux * vy - uy * vx
    for (const w of [a, b, c]) {
      const k = (keys[w] ??= posKey(w))
      let l = vf.get(k)
      if (!l) vf.set(k, (l = []))
      l.push(f)
    }
  }
  const unit = (f) => {
    const l = Math.hypot(fn[f * 3], fn[f * 3 + 1], fn[f * 3 + 2]) || 1
    return [fn[f * 3] / l, fn[f * 3 + 1] / l, fn[f * 3 + 2] / l]
  }
  const out = new Map()
  const P = [], N = [], T = []
  const idx = new Uint32Array(sidx.length)
  for (let f = 0; f < nt; f++) {
    const nf = unit(f)
    for (let k = 0; k < 3; k++) {
      const w = sidx[f * 3 + k]
      let sx = 0, sy = 0, sz = 0
      for (const g of vf.get(keys[w])) {
        const ng = unit(g)
        if (ng[0] * nf[0] + ng[1] * nf[1] + ng[2] * nf[2] >= CREASE) (sx += fn[g * 3]), (sy += fn[g * 3 + 1]), (sz += fn[g * 3 + 2])
      }
      const l = Math.hypot(sx, sy, sz) || 1
      const n = [sx / l, sy / l, sz / l]
      const key = w + ':' + Math.round(n[0] * 127) + ',' + Math.round(n[1] * 127) + ',' + Math.round(n[2] * 127)
      let v = out.get(key)
      if (v === undefined) {
        v = P.length / 3
        out.set(key, v)
        P.push(WP[w * 3], WP[w * 3 + 1], WP[w * 3 + 2])
        N.push(n[0], n[1], n[2])
        if (hasUV) T.push(WT[w * 2], WT[w * 2 + 1])
      }
      idx[f * 3 + k] = v
    }
  }
  return { P, N, T, idx }
}

const meshCache = new Map()
const uses = new Map()
const byMat = new Map()
let triTotal = 0
function meshFor(ig) {
  const key = ig.url + '|' + JSON.stringify(ig.bind)
  if (meshCache.has(key)) return meshCache.get(key)
  const g = geometries.get(ig.url)
  if (!g || !g.prims.length) return meshCache.set(key, null), null
  const mesh = doc.createMesh()
  const geoTris = g.prims.reduce((sum, pr) => sum + pr.p.length / Math.max(1, Math.max(...pr.inputs.map((i) => i.offset)) + 1) / 3, 0)
  const copies = uses.get(ig.url) ?? 1
  const denseGeo = geoTris > DENSE || geoTris * copies > DENSE * 3
  for (const pr of g.prims) {
    const stride = Math.max(...pr.inputs.map((i) => i.offset)) + 1
    let posSrc, nrmSrc, uvSrc, posOff = 0, nrmOff = -1, uvOff = -1
    for (const inp of pr.inputs) {
      if (inp.semantic === 'VERTEX') {
        const v = g.vertices.get(inp.source) ?? {}
        posSrc = g.sources.get(v.POSITION)
        posOff = inp.offset
        if (v.NORMAL) (nrmSrc = g.sources.get(v.NORMAL)), (nrmOff = inp.offset)
        if (v.TEXCOORD) (uvSrc = g.sources.get(v.TEXCOORD)), (uvOff = inp.offset)
      } else if (inp.semantic === 'NORMAL') (nrmSrc = g.sources.get(inp.source)), (nrmOff = inp.offset)
      else if (inp.semantic === 'TEXCOORD' && inp.set === 0) (uvSrc = g.sources.get(inp.source)), (uvOff = inp.offset)
    }
    if (!posSrc?.data) continue
    // corner list (polylist is fanned into triangles)
    let corners = pr.p
    if (pr.kind === 'polylist' && pr.vcount) {
      const tri = []
      let base = 0
      for (const vc of pr.vcount) {
        for (let k = 1; k < vc - 1; k++) for (const c of [0, k, k + 1]) for (let s = 0; s < stride; s++) tri.push(pr.p[(base + c) * stride + s])
        base += vc
      }
      corners = Uint32Array.from(tri)
    }
    const nCorners = corners.length / stride
    const map = new Map()
    let P = [], N = [], T = []
    let idx = new Uint32Array(nCorners)
    for (let c = 0; c < nCorners; c++) {
      const pi = corners[c * stride + posOff]
      const ni = nrmOff >= 0 ? corners[c * stride + nrmOff] : -1
      const ti = uvOff >= 0 ? corners[c * stride + uvOff] : -1
      const k = pi + ',' + ni + ',' + ti
      let v = map.get(k)
      if (v === undefined) {
        v = P.length / 3
        map.set(k, v)
        const ps = posSrc.stride
        P.push(posSrc.data[pi * ps], posSrc.data[pi * ps + 1], posSrc.data[pi * ps + 2])
        if (nrmSrc) {
          const ns = nrmSrc.stride
          N.push(nrmSrc.data[ni * ns], nrmSrc.data[ni * ns + 1], nrmSrc.data[ni * ns + 2])
        }
        if (uvSrc) {
          const ts = uvSrc.stride
          // COLLADA v points up, glTF v points down
          T.push(uvSrc.data[ti * ts], 1 - uvSrc.data[ti * ts + 1])
        }
      }
      idx[c] = v
    }
    triTotal += nCorners / 3
    if (denseGeo && nCorners / 3 > 60) {
      const r = reduceDense(P, T, idx)
      reduced[0] += nCorners / 3
      reduced[1] += r.idx.length / 3
      ;({ P, N, T, idx } = r)
    }
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(P.length / 3 > 65535 ? idx : Uint16Array.from(idx)).setBuffer(buffer))
      .setMaterial(materialFor(ig.bind[pr.material]))
    if (N.length) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(N)).setBuffer(buffer))
    const mat = prim.getMaterial()
    if (T.length && mat.getBaseColorTexture()) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(T)).setBuffer(buffer))
    mesh.addPrimitive(prim)
  }
  meshCache.set(key, mesh)
  return mesh
}

/* very heavy components (e.g. a 285k-triangle dining set made of thousands of tiny parts) are baked into one mesh
   per material and simplified as a whole, with the error measured against the whole object */
const COMP = opt('--comp', 20000)
const expCache = new Map()
function expandedTris(n, d = 0) {
  if (d > 40) return 0
  if (n.id && expCache.has(n.id)) return expCache.get(n.id)
  let t = 0
  for (const ig of n.geoms) for (const pr of geometries.get(ig.url)?.prims ?? []) t += pr.p.length / 3 / Math.max(1, Math.max(...pr.inputs.map((i) => i.offset)) + 1)
  for (const c of n.children) t += expandedTris(c, d + 1)
  for (const u of n.insts) if (libNodes.get(u)) t += expandedTris(libNodes.get(u), d + 1)
  if (n.id) expCache.set(n.id, t)
  return t
}
const mul = (a, b) => {
  const r = new Array(16)
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) r[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + a[i * 4 + 3] * b[12 + j]
  return r
}
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const geoBoxCache = new Map()
/** local bounding box of a geometry's positions [minx, miny, minz, maxx, maxy, maxz] (model units) */
function geoBox(id) {
  if (geoBoxCache.has(id)) return geoBoxCache.get(id)
  const g = geometries.get(id)
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  const posIds = new Set([...(g?.vertices.values() ?? [])].map((v) => v.POSITION))
  for (const src of g?.sources.values() ?? []) {
    if (src.stride !== 3 || !src.data || !posIds.has(src.id)) continue
    for (let i = 0; i < src.data.length; i += 3) for (let k = 0; k < 3; k++) (b[k] = Math.min(b[k], src.data[i + k])), (b[k + 3] = Math.max(b[k + 3], src.data[i + k]))
  }
  geoBoxCache.set(id, b)
  return b
}
/** world bounding box of a node and everything inside it (model units, SketchUp axes) */
function subtreeBox(n, M, d = 0) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  if (!n || n.camera || d > 40) return b
  const W = n.matrix ? mul(M, n.matrix) : M
  const grow = (x, y, z) => {
    const c = [W[0] * x + W[1] * y + W[2] * z + W[3], W[4] * x + W[5] * y + W[6] * z + W[7], W[8] * x + W[9] * y + W[10] * z + W[11]]
    for (let k = 0; k < 3; k++) (b[k] = Math.min(b[k], c[k])), (b[k + 3] = Math.max(b[k + 3], c[k]))
  }
  for (const ig of n.geoms) {
    const g = geoBox(ig.url)
    if (!isFinite(g[0])) continue
    for (const x of [g[0], g[3]]) for (const y of [g[1], g[4]]) for (const z of [g[2], g[5]]) grow(x, y, z)
  }
  for (const c of [...n.children, ...n.insts.map((u) => libNodes.get(u))]) {
    const cb = subtreeBox(c, W, d + 1)
    if (!isFinite(cb[0])) continue
    for (let k = 0; k < 3; k++) (b[k] = Math.min(b[k], cb[k])), (b[k + 3] = Math.max(b[k + 3], cb[k + 3]))
  }
  return b
}
const bakeCache = new Map()
let bakedBefore = 0, bakedAfter = 0
function bakedMeshFor(libId) {
  if (bakeCache.has(libId)) return bakeCache.get(libId)
  const buckets = new Map() // material id → { P, T, idx }
  const visit = (n, M, d = 0) => {
    if (n.camera || d > 40) return
    const W = n.matrix ? mul(M, n.matrix) : M
    for (const ig of n.geoms) {
      const g = geometries.get(ig.url)
      if (!g) continue
      for (const pr of g.prims) {
        const stride = Math.max(...pr.inputs.map((i) => i.offset)) + 1
        let posSrc, uvSrc, posOff = 0, uvOff = -1
        for (const inp of pr.inputs) {
          if (inp.semantic === 'VERTEX') {
            const v = g.vertices.get(inp.source) ?? {}
            posSrc = g.sources.get(v.POSITION)
            posOff = inp.offset
            if (v.TEXCOORD) (uvSrc = g.sources.get(v.TEXCOORD)), (uvOff = inp.offset)
          } else if (inp.semantic === 'TEXCOORD' && inp.set === 0) (uvSrc = g.sources.get(inp.source)), (uvOff = inp.offset)
        }
        if (!posSrc?.data || pr.kind !== 'triangles') continue
        const matId = ig.bind[pr.material] ?? '__default'
        const textured = !!materialFor(ig.bind[pr.material]).getBaseColorTexture()
        let b = buckets.get(matId)
        if (!b) buckets.set(matId, (b = { P: [], T: [], idx: [], textured }))
        const ps = posSrc.stride
        for (let c = 0; c < pr.p.length / stride; c++) {
          const pi = pr.p[c * stride + posOff]
          const x = posSrc.data[pi * ps], y = posSrc.data[pi * ps + 1], z = posSrc.data[pi * ps + 2]
          b.idx.push(b.P.length / 3)
          b.P.push(W[0] * x + W[1] * y + W[2] * z + W[3], W[4] * x + W[5] * y + W[6] * z + W[7], W[8] * x + W[9] * y + W[10] * z + W[11])
          if (textured) {
            const ti = uvOff >= 0 ? pr.p[c * stride + uvOff] : 0
            b.T.push(uvSrc ? uvSrc.data[ti * uvSrc.stride] : 0, uvSrc ? 1 - uvSrc.data[ti * uvSrc.stride + 1] : 0)
          }
        }
      }
    }
    for (const c of n.children) visit(c, W, d + 1)
    for (const u of n.insts) if (libNodes.get(u)) visit(libNodes.get(u), W, d + 1)
  }
  visit(libNodes.get(libId), I4)
  const mesh = doc.createMesh(libNodes.get(libId).name)
  // very detailed objects (light fittings, decor) that stay heavy at 1 cm get a looser tolerance
  // trees, palms and shrubs are seen from the garden: thousands of separate leaves may use a looser tolerance
  const VEG = /tree|palm|plant|bush|shrub|leaf|leaves|foliage|flower|hedge|coconut|grass|bamboo|fern|ต้นไม้|ຕົ້ນໄມ້/i
  const names = [libNodes.get(libId).name, ...[...buckets.keys()].map((m) => materials.get(m)?.name ?? '')].join(' ')
  const veg = VEG.test(names)
  const reduceAll = (errorScale) =>
    [...buckets].map(([matId, b]) => [matId, b, b.idx.length / 3 > 400 ? reduceDense(b.P, b.T, Uint32Array.from(b.idx), { ratio: veg ? 0.01 : 0.05, prune: true, errorScale }) : reduceDense(b.P, b.T, Uint32Array.from(b.idx), { ratio: 1 })])
  let results = reduceAll(1)
  const steps = veg ? [2.5, 5, 10, 15] : [2.5, 5]
  for (const scale of steps) {
    if (results.reduce((n, [, , r]) => n + r.idx.length / 3, 0) <= 40000) break
    results = reduceAll(scale)
  }
  if (process.env.DEBUG_BAKE) {
    const top = results.map(([m, b, r]) => [materials.get(m)?.name ?? m, b.idx.length / 3, r.idx.length / 3, b.textured]).sort((a, b) => b[2] - a[2]).slice(0, 6)
    console.log('BAKE', libNodes.get(libId).name, top.map((t) => `${t[0]}${t[3] ? '(tex)' : ''}: ${t[1]}→${t[2]}`).join(' | '))
  }
  for (const [matId, b, r] of results) {
    bakedBefore += b.idx.length / 3
    bakedAfter += r.idx.length / 3
    if (!r.idx.length) continue
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(r.P)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(r.N)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(r.P.length / 3 > 65535 ? r.idx : Uint16Array.from(r.idx)).setBuffer(buffer))
      .setMaterial(materialFor(matId === '__default' ? undefined : matId))
    if (b.textured && r.T.length) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(r.T)).setBuffer(buffer))
    mesh.addPrimitive(prim)
  }
  bakeCache.set(libId, mesh)
  return mesh
}

// node tree (component instances are expanded as new nodes that share the same meshes)
const toMat = (m) => (m ? [m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]] : null)
/** helper objects for render plug-ins (D5, Enscape, V-Ray light emitters, section planes) are not part of the house */
const EXCLUDE = rest.includes('--exclude') ? new RegExp(rest[rest.indexOf('--exclude') + 1], 'i') : null
/** imported CAD drawings (AutoCAD .dwg plans used for modelling) are reference lines, not part of the house */
const CAD = /\.dwg(_\d+)?$/i
/** objects entirely below this depth (m) are underground (septic tanks, foundations) and never visible */
const UNDERGROUND = -1
const skipped = []
const HELPER = /^(D5RenderLight|D5_?Light|Enscape|VRay(Light|Sun|Plane|Sphere|Mesh)?Light|V-?Ray\s*Light|LightProxy|Section\s*Plane)/i
function skipNode(n, M) {
  if (HELPER.test(n.name) || CAD.test(n.name) || (EXCLUDE && EXCLUDE.test(n.name))) return 'helper/CAD/excluded'
  const b = subtreeBox(n, M)
  if (isFinite(b[5]) && b[5] * unitMeter < UNDERGROUND) return 'underground'
  return null
}
function build(n, depth = 0, M = I4) {
  if (n.camera || depth > 40) return null
  const why = skipNode(n, M)
  if (why) {
    skipped.push(`${n.name || '(unnamed)'} — ${why}`)
    return null
  }
  const W = n.matrix ? mul(M, n.matrix) : M
  const gn = doc.createNode(n.name)
  if (n.matrix) gn.setMatrix(toMat(n.matrix))
  for (const ig of n.geoms) {
    const mesh = meshFor(ig)
    if (!mesh) continue
    if (!gn.getMesh()) gn.setMesh(mesh)
    else gn.addChild(doc.createNode().setMesh(mesh))
  }
  for (const c of n.children) {
    const cn = build(c, depth + 1, W)
    if (cn) gn.addChild(cn)
  }
  for (const url of n.insts) {
    const lib = libNodes.get(url)
    if (!lib) continue
    const why = skipNode(lib, W)
    if (why) {
      skipped.push(`${lib.name || '(unnamed)'} — ${why}`)
      continue
    }
    if (expandedTris(lib) > COMP) {
      gn.addChild(doc.createNode(lib.name).setMesh(bakedMeshFor(url)))
      continue
    }
    const cn = build(lib, depth + 1, W)
    if (cn) gn.addChild(cn)
  }
  return gn
}
// how often each geometry is used (component copies), to decide which objects are worth simplifying
function countUses(n, mult, depth = 0) {
  if (n.camera || depth > 40 || HELPER.test(n.name) || CAD.test(n.name) || (EXCLUDE && EXCLUDE.test(n.name))) return
  for (const ig of n.geoms) {
    uses.set(ig.url, (uses.get(ig.url) ?? 0) + mult)
    const g = geometries.get(ig.url)
    if (g) for (const pr of g.prims) {
      const st = Math.max(1, Math.max(...pr.inputs.map((i) => i.offset)) + 1)
      const mn = materials.get(ig.bind[pr.material])?.name ?? 'default'
      const e = (byMat.get(mn) ?? { tris: 0, geos: new Map() })
      e.tris += pr.p.length / st / 3
      e.geos.set(ig.url, (e.geos.get(ig.url) ?? 0) + 1)
      byMat.set(mn, e)
    }
  }
  for (const c of n.children) countUses(c, mult, depth + 1)
  for (const url of n.insts) {
    const lib = libNodes.get(url)
    if (lib) countUses(lib, mult, depth + 1)
  }
}
for (const n of sceneRoots) countUses(n, 1)
if (rest.includes('--bounds')) {
  // world bounds (metres, Z-up as in SketchUp) of each object, to find stray geometry far from the house
  const geoBox = new Map()
  const gbox = (id) => {
    if (geoBox.has(id)) return geoBox.get(id)
    const g = geometries.get(id)
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    for (const src of g?.sources.values() ?? []) {
      if (src.stride !== 3 || !src.data) continue
      const isPos = [...g.vertices.values()].some((v) => v.POSITION === src.id)
      if (!isPos) continue
      for (let i = 0; i < src.data.length; i += 3) for (let k = 0; k < 3; k++) (b[k] = Math.min(b[k], src.data[i + k])), (b[k + 3] = Math.max(b[k + 3], src.data[i + k]))
    }
    geoBox.set(id, b)
    return b
  }
  const rows = []
  const visit = (n, M, pathName, d = 0) => {
    if (n.camera || d > 40) return null
    const W = n.matrix ? mul(M, n.matrix) : M
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    const grow = (c) => { for (let k = 0; k < 3; k++) (b[k] = Math.min(b[k], c[k])), (b[k + 3] = Math.max(b[k + 3], c[k])) }
    for (const ig of n.geoms) {
      const gb = gbox(ig.url)
      if (!isFinite(gb[0])) continue
      for (const x of [gb[0], gb[3]]) for (const y of [gb[1], gb[4]]) for (const z of [gb[2], gb[5]])
        grow([W[0] * x + W[1] * y + W[2] * z + W[3], W[4] * x + W[5] * y + W[6] * z + W[7], W[8] * x + W[9] * y + W[10] * z + W[11]])
    }
    const kids = [...n.children.map((c) => [c, c.name]), ...n.insts.map((u) => [libNodes.get(u), libNodes.get(u)?.name])].filter(([c]) => c)
    for (const [c, nm] of kids) {
      const cb = visit(c, W, pathName + '/' + nm, d + 1)
      if (cb) { grow(cb.slice(0, 3)); grow(cb.slice(3)) }
    }
    if (!isFinite(b[0])) return null
    if (d <= (process.env.DEPTH ? +process.env.DEPTH : 2)) rows.push([pathName, b.map((v) => +(v * unitMeter).toFixed(1))])
    return b
  }
  for (const n of sceneRoots) visit(n, I4, n.name)
  for (const [p, b] of rows) console.log(b.slice(0, 3).join(','), '..', b.slice(3).join(','), ' size', (b[3] - b[0]).toFixed(1), (b[4] - b[1]).toFixed(1), (b[5] - b[2]).toFixed(1), p)
  process.exit(0)
}
if (rest.includes('--report')) {
  const rows = []
  for (const [id, g] of geometries) {
    const tris = g.prims.reduce((sum, pr) => sum + pr.p.length / Math.max(1, Math.max(...pr.inputs.map((i) => i.offset)) + 1) / 3, 0)
    const u = uses.get(id) ?? 0
    const mats = [...new Set(g.prims.map((pr) => pr.material))].join(',')
    rows.push({ id, tris, u, total: tris * u, prims: g.prims.length, mats })
  }
  rows.sort((a, b) => b.total - a.total)
  for (const r of rows.slice(0, 12)) console.log(r.total, '=', r.tris, 'x', r.u, r.id, 'prims', r.prims)
  const velvet = (n, d = 0) => {
    if (d > 40) return 0
    let c = 0
    for (const ig of n.geoms) for (const pr of geometries.get(ig.url)?.prims ?? []) if ((materials.get(ig.bind[pr.material])?.name ?? '') === (process.env.MAT || 'Velvet_Green')) c += pr.p.length / 3 / Math.max(1, Math.max(...pr.inputs.map((i) => i.offset)) + 1)
    for (const ch of n.children) c += velvet(ch, d + 1)
    for (const u of n.insts) if (libNodes.get(u)) c += velvet(libNodes.get(u), d + 1)
    return c
  }
  const top = []
  const walk = (n, pathName, d = 0) => {
    if (d > 6) return
    const v = velvet(n)
    if (v > 2000) top.push([Math.round(v), pathName + '/' + n.name])
    for (const ch of n.children) walk(ch, pathName + '/' + n.name, d + 1)
  }
  for (const n of sceneRoots) walk(n, '')
  for (const t of top.sort((a, b) => b[0] - a[0]).slice(0, 15)) console.log(t[0], t[1])
  console.log('--- by material (rendered triangles)')
  for (const [m, e] of [...byMat].sort((a, b) => b[1].tris - a[1].tris).slice(0, 15)) console.log(Math.round(e.tris), m, 'geometries:', e.geos.size, 'uses:', [...e.geos.values()].reduce((a, b) => a + b, 0))
  process.exit(0)
}
const root = doc.createNode('model')
const s = unitMeter
if (upAxis === 'Z_UP') root.setRotation([-Math.SQRT1_2, 0, 0, Math.SQRT1_2])
else if (upAxis === 'X_UP') root.setRotation([0, 0, Math.SQRT1_2, Math.SQRT1_2])
root.setScale([s, s, s])
for (const n of sceneRoots) {
  const gn = build(n)
  if (gn) root.addChild(gn)
}
scene.addChild(root)
if (skipped.length) {
  const c = new Map()
  for (const k of skipped) c.set(k, (c.get(k) ?? 0) + 1)
  log(`left out: ${[...c].map(([k, n]) => (n > 1 ? `${n}× ${k}` : k)).join('; ')}`)
}
log(`built: ${meshCache.size} meshes, ${matCache.size} materials, ${[...textureCache.values()].filter(Boolean).length} textures, ${Math.round(triTotal).toLocaleString()} unique triangles`)

/* ───────────── 3. optimise (lossless for shape) ───────────── */
await doc.transform(dedup(), prune(), weld())
log(`heavy components baked & simplified: ${Math.round(bakedBefore).toLocaleString()} → ${Math.round(bakedAfter).toLocaleString()} triangles`)
log(`dense objects simplified: ${Math.round(reduced[0]).toLocaleString()} → ${Math.round(reduced[1]).toLocaleString()} triangles`)
if (doInstance) await doc.transform(instance({ min: 3 }))
// merge near-identical materials (SketchUp often has dozens of copies like Color_A06 / Color_A06_3 with the same look)
{
  const q = (v, k = 24) => Math.round(v * k)
  const groups = new Map()
  for (const m of doc.getRoot().listMaterials()) {
    const c = m.getBaseColorFactor()
    const tex = m.getBaseColorTexture()
    const key = [tex ? doc.getRoot().listTextures().indexOf(tex) : -1, q(c[0]), q(c[1]), q(c[2]), q(c[3], 10), m.getAlphaMode(), q(m.getRoughnessFactor(), 10), q(m.getMetallicFactor(), 10)].join('|')
    const keep = groups.get(key)
    if (!keep) groups.set(key, m)
    else for (const parent of m.listParents()) if (parent.propertyType === 'Primitive') parent.setMaterial(keep)
  }
  const n0 = doc.getRoot().listMaterials().length
  await doc.transform(prune())
  log(`materials merged: ${n0} → ${doc.getRoot().listMaterials().length}`)
}
if (doJoin) await doc.transform(flatten(), join({ keepNamed: false }), prune())
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 82 }),
  quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14 }),
  prune(),
)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
fs.mkdirSync(path.dirname(outPath), { recursive: true })
await io.write(outPath, doc)
log(`wrote ${outPath} — ${(fs.statSync(outPath).size / 1e6).toFixed(1)} MB`)
