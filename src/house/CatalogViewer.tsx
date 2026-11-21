import { Suspense, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls, Sky, useGLTF, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

/**
 * Viewer for company catalogue houses (GLB exported from SketchUp).
 * Shows the exact model: orbit, zoom inside, preset views, day/night, auto-rotate.
 */
export type CatView = 'perspective' | 'front' | 'right' | 'back' | 'left' | 'top'
/** outside = whole house · plan = cut-away floor plan of one level · walk = first-person walk inside */
export type CatMode = 'outside' | 'plan' | 'walk'
export interface CatalogViewerHandle {
  capture: () => string | null
}
/** buttons on the page that move the walker (held = true) */
export interface WalkKeys {
  fwd: boolean
  back: boolean
  left: boolean
  right: boolean
}
export interface WalkSpot {
  x: number
  y: number
  z: number
  /** bump to restart at the same spot */
  n: number
  /** facing, radians (optional) */
  yaw?: number
}
const EYE = 1.6
const PLAN_CUT = 1.5

/** loading bar drawn over the canvas (outside the 3D scene, so it never interferes with it) */
function LoadingOverlay() {
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="w-48 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-steel-light">
        Loading 3D model {Math.round(progress)}%
        <div className="mt-2 h-1 bg-white/10"><div className="h-1 bg-gold" style={{ width: `${progress}%` }} /></div>
      </div>
    </div>
  )
}

/**
 * Models packed as a script file (model.js → window.__SCC_MODELS[name] = base64 GLB) are parsed in memory.
 * Used by the single-page preview, whose hosting only serves html/js files and blocks fetching data: URLs.
 */
const scriptCache = new Map<string, { promise: Promise<void>; scene?: THREE.Group; error?: unknown }>()
function loadScriptModel(url: string) {
  let e = scriptCache.get(url)
  if (!e) {
    const entry: { promise: Promise<void>; scene?: THREE.Group; error?: unknown } = { promise: Promise.resolve() }
    // big models are split into several script files: model.js says how many, model.part<N>.js hold the pieces
    const w = window as unknown as { __SCC_MODELS?: Record<string, string | { parts: number }>; __SCC_CHUNKS?: Record<string, string[]> }
    const load = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const tag = document.createElement('script')
        tag.src = src
        tag.onload = () => resolve()
        tag.onerror = () => reject(new Error('model script failed to load'))
        document.head.appendChild(tag)
      })
    entry.promise = (async () => {
      if (!w.__SCC_MODELS?.[url]) await load(url)
      const v = w.__SCC_MODELS?.[url]
      if (!v) throw new Error('model script empty')
      if (typeof v === 'string') return v
      const base = url.replace(/\.js$/, '')
      await Promise.all(Array.from({ length: v.parts }, (_, i) => load(`${base}.part${i}.js`)))
      return (w.__SCC_CHUNKS?.[url] ?? []).join('')
    })()
      .then((b64) => {
        const bin = atob(b64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        // textures: make the loader use <img> (blob: images are allowed) instead of fetch(blob:),
        // which strict hosting policies block. The loader picks its texture loader when parsing starts.
        const w2 = window as unknown as { createImageBitmap?: unknown }
        const saved = w2.createImageBitmap
        w2.createImageBitmap = undefined
        try {
          return new GLTFLoader().parseAsync(bytes.buffer, '')
        } finally {
          w2.createImageBitmap = saved
        }
      })
      .then((g) => {
        entry.scene = g.scene
      })
      .catch((err) => {
        entry.error = err
      })
    scriptCache.set(url, entry)
    e = entry
  }
  if (e.error) throw e.error
  if (!e.scene) throw e.promise
  return e.scene
}

function useCatalogScene(url: string) {
  if (url.endsWith('.js')) return loadScriptModel(url)
  // plain GLB: no Draco/Meshopt decoders (they need WebAssembly, which strict hosting policies block)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useGLTF(url, false, false).scene
}

function Model({ url, onReady, clip }: { url: string; onReady: (obj: THREE.Object3D, b: THREE.Box3) => void; clip: number | null }) {
  const scene = useCatalogScene(url)
  const obj = useMemo(() => {
    const s = scene.clone(true)
    // centre on the ground
    const box = new THREE.Box3().setFromObject(s)
    const c = box.getCenter(new THREE.Vector3())
    s.position.set(-c.x, -box.min.y, -c.z)
    s.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
        // fast ray tests (not for instanced trees/cars: they keep three's own per-instance test)
        if (!(m as THREE.InstancedMesh).isInstancedMesh) m.raycast = acceleratedRaycast
        // materials are cloned so the cut-away plane never leaks into other houses
        m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone()
      }
    })
    s.updateMatrixWorld(true)
    return s
  }, [scene])
  // one shared cutting plane (floor plan mode): everything above it is hidden
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), [])
  useEffect(() => {
    obj.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        mat.clippingPlanes = clip == null ? null : [plane]
        mat.clipShadows = true
        mat.needsUpdate = true
      }
    })
    if (clip != null) plane.constant = clip
  }, [obj, clip, plane])
  useEffect(() => {
    onReady(obj, new THREE.Box3().setFromObject(obj))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj])
  return <primitive object={obj} />
}

/** remove zero-area triangles (left by model simplification) — they break ray tests */
function dropDegenerate(g: THREE.BufferGeometry) {
  const idx = g.index, pos = g.attributes.position
  if (!idx || !pos) return
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const keep: number[] = []
  for (let t = 0; t < idx.count; t += 3) {
    const i = idx.getX(t), j = idx.getX(t + 1), k = idx.getX(t + 2)
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, j)
    c.fromBufferAttribute(pos, k)
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-14) keep.push(i, j, k)
  }
  if (keep.length !== idx.count) {
    g.setIndex(keep)
    g.clearGroups()
  }
}

/** fast ray tests (walking, tapping the floor): build a search tree per mesh the first time it is needed */
function ensureBvh(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh
    const g = m.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }
    if (m.isMesh && g && !g.boundsTree) {
      try {
        if (!Array.isArray(m.material)) dropDegenerate(g)
        g.boundsTree = new MeshBVH(g)
      } catch {
        /* falls back to the normal (slower) ray test */
      }
    }
  })
}

const ray = new THREE.Raycaster()
/** ray test that never crashes the page on a bad triangle */
function hits(obj: THREE.Object3D) {
  try {
    return ray.intersectObject(obj, true)
  } catch {
    return []
  }
}
const DOWN = new THREE.Vector3(0, -1, 0)
/** height of the floor under (x, z), looking down from `from` (null if nothing) */
function floorAt(obj: THREE.Object3D, x: number, z: number, from: number, maxDrop = 2.4) {
  ray.set(new THREE.Vector3(x, from, z), DOWN)
  ray.far = maxDrop
  ray.firstHitOnly = true
  const hit = hits(obj)[0]
  return hit ? hit.point.y : null
}
/** distance to the nearest wall/furniture in a horizontal direction, at knee and chest height */
function clearance(obj: THREE.Object3D, p: THREE.Vector3, dir: THREE.Vector3, floor: number, far = 3) {
  let d = Infinity
  for (const h of [0.5, 1.2]) {
    ray.set(new THREE.Vector3(p.x, floor + h, p.z), dir)
    ray.far = far
    ray.firstHitOnly = true
    const hit = hits(obj)[0]
    if (hit) d = Math.min(d, hit.distance)
  }
  return d
}
/** an open spot on a floor near the middle of the house, to start walking when the visitor did not tap one */
function findOpenSpot(obj: THREE.Object3D, box: THREE.Box3, level: number) {
  const c = box.getCenter(new THREE.Vector3())
  const sx = (box.max.x - box.min.x) / 2, sz = (box.max.z - box.min.z) / 2
  let best: { p: THREE.Vector3; score: number } | null = null
  const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]
  for (let i = -4; i <= 4; i++)
    for (let j = -4; j <= 4; j++) {
      const x = c.x + (i / 5) * sx, z = c.z + (j / 5) * sz
      const f = floorAt(obj, x, z, level + 1.4, 1.9)
      if (f == null || Math.abs(f - level) > 0.35) continue
      // a roof over the head = indoors
      ray.set(new THREE.Vector3(x, f + 0.3, z), new THREE.Vector3(0, 1, 0))
      ray.far = 4
      if (!hits(obj)[0]) continue
      const p = new THREE.Vector3(x, f, z)
      // indoors = walls (or glass) found in all four directions; terraces open to the garden are skipped
      const far = dirs.map((d) => clearance(obj, p, d, f, 15))
      if (far.some((d) => !Number.isFinite(d))) continue
      const room = far.map((d) => Math.min(d, 6))
      // prefer the most open spot (living room), not a corridor or a corner
      const score = Math.min(Math.min(...room), 3) * 4 + room.reduce((a, b) => a + b, 0) - (Math.abs(i) + Math.abs(j)) * 0.05
      if (!best || score > best.score) best = { p, score }
    }
  return best?.p ?? new THREE.Vector3(c.x, level, c.z)
}

/**
 * First-person walking: drag to look around, WASD / arrow keys or the on-screen buttons to move,
 * tap the floor to walk there. Walls stop you; small steps are climbed; stairs via the floor buttons.
 */
function Walker({ obj, start, keysRef }: { obj: THREE.Object3D; start: WalkSpot; keysRef: React.MutableRefObject<WalkKeys> }) {
  const { camera, gl } = useThree()
  const st = useRef({ yaw: 0, pitch: -0.05, floor: start.y, pos: new THREE.Vector3(start.x, start.y, start.z), goal: null as THREE.Vector3 | null })
  const keys = useRef<Record<string, boolean>>({})
  useEffect(() => {
    ensureBvh(obj)
    const s = st.current
    s.pos.set(start.x, start.y, start.z)
    s.floor = start.y
    s.goal = null
    // face the given direction, else the most open one
    let bestYaw = start.yaw ?? 0, bestD = start.yaw != null ? Infinity : -1
    for (let k = 0; k < 16; k++) {
      const yaw = (k / 16) * Math.PI * 2
      const d = clearance(obj, s.pos, new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), s.floor, 25)
      if (Math.min(d, 25) > bestD) (bestD = Math.min(d, 25)), (bestYaw = yaw)
    }
    s.yaw = bestYaw
    s.pitch = -0.05
    const cam = camera as THREE.PerspectiveCamera
    const fov = cam.fov
    cam.fov = 70
    cam.near = 0.05
    cam.updateProjectionMatrix()
    return () => {
      cam.fov = fov
      cam.near = 0.1
      cam.updateProjectionMatrix()
    }
  }, [obj, start, camera])
  // look around with mouse / finger drag
  useEffect(() => {
    const el = gl.domElement
    let last: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => (last = { x: e.clientX, y: e.clientY })
    const move = (e: PointerEvent) => {
      if (!last) return
      const s = st.current
      s.yaw += ((e.clientX - last.x) / el.clientWidth) * 2.6
      s.pitch = Math.max(-1.2, Math.min(1.2, s.pitch + ((e.clientY - last.y) / el.clientHeight) * 1.8))
      last = { x: e.clientX, y: e.clientY }
    }
    const up = () => (last = null)
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return
      keys.current[e.key.toLowerCase()] = true
      if (e.key.startsWith('Arrow')) e.preventDefault()
    }
    const ku = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    el.style.cursor = 'grab'
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      el.style.cursor = ''
    }
  }, [gl])
  // tap the floor → walk there
  useEffect(() => {
    const el = gl.domElement
    let downAt: { x: number; y: number; t: number } | null = null
    const d = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY, t: performance.now() })
    const u = (e: PointerEvent) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6 || performance.now() - downAt.t > 400) return
      const r = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      ray.far = 30
      ray.firstHitOnly = true
      const hit = hits(obj)[0]
      const n = hit?.face?.normal.clone().transformDirection(hit.object.matrixWorld)
      if (hit && n && n.y > 0.7 && Math.abs(hit.point.y - st.current.floor) < 0.6) st.current.goal = hit.point.clone()
    }
    el.addEventListener('pointerdown', d)
    el.addEventListener('pointerup', u)
    return () => {
      el.removeEventListener('pointerdown', d)
      el.removeEventListener('pointerup', u)
    }
  }, [gl, camera, obj])
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = st.current
    const k = keys.current, b = keysRef.current
    const fwd = (k['w'] || k['arrowup'] || b.fwd ? 1 : 0) - (k['s'] || k['arrowdown'] || b.back ? 1 : 0)
    const turn = (k['a'] || k['arrowleft'] || b.left ? 1 : 0) - (k['d'] || k['arrowright'] || b.right ? 1 : 0)
    s.yaw += turn * dt * 1.6
    const dir = new THREE.Vector3(-Math.sin(s.yaw), 0, -Math.cos(s.yaw))
    let step = new THREE.Vector3()
    if (fwd) {
      step = dir.clone().multiplyScalar(fwd * dt * 1.6)
      s.goal = null
    } else if (s.goal) {
      const to = new THREE.Vector3(s.goal.x - s.pos.x, 0, s.goal.z - s.pos.z)
      const dist = to.length()
      if (dist < 0.08) s.goal = null
      else {
        step = to.normalize().multiplyScalar(Math.min(dist, dt * 1.8))
        // turn towards where we walk
        const target = Math.atan2(-step.x, -step.z)
        let dy = target - s.yaw
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        s.yaw += dy * Math.min(1, dt * 4)
      }
    }
    if (step.lengthSq() > 0) {
      const len = step.length()
      const free = clearance(obj, s.pos, step.clone().normalize(), s.floor)
      if (free > len + 0.3) {
        const nx = s.pos.x + step.x, nz = s.pos.z + step.z
        const f = floorAt(obj, nx, nz, s.floor + 0.5, 1.2)
        // climb small steps (≤ 45 cm), step down up to 60 cm, never walk off a balcony edge
        if (f != null && f - s.floor < 0.45 && s.floor - f < 0.6) {
          s.pos.set(nx, f, nz)
          s.floor = f
        } else s.goal = null
      } else s.goal = null
    }
    const eye = new THREE.Vector3(s.pos.x, s.floor + EYE, s.pos.z)
    camera.position.lerp(eye, 1 - Math.exp(-dt * 12))
    const look = new THREE.Vector3(-Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.cos(s.yaw) * Math.cos(s.pitch))
    camera.lookAt(camera.position.clone().add(look))
  })
  return null
}

/** soft light that follows the camera indoors, so rooms are never pitch dark */
function HeadLight({ night }: { night: boolean }) {
  const l = useRef<THREE.PointLight>(null)
  const { camera } = useThree()
  useFrame(() => l.current?.position.copy(camera.position))
  return <pointLight ref={l} intensity={night ? 6 : 9} distance={14} decay={1.6} color="#FFF4E2" />
}

/** floor-plan mode: tap a room to walk into it */
function PlanPicker({ obj, level, onPick }: { obj: THREE.Object3D; level: number; onPick: (p: THREE.Vector3) => void }) {
  const { camera, gl } = useThree()
  useEffect(() => {
    ensureBvh(obj)
    const el = gl.domElement
    let downAt: { x: number; y: number } | null = null
    const d = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY })
    const u = (e: PointerEvent) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return
      const r = el.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      ray.far = 400
      ray.firstHitOnly = false
      // ignore everything above the cut (it is invisible)
      const hit = hits(obj).find((h) => h.point.y <= level + PLAN_CUT + 0.01)
      if (!hit) return
      // tapped on furniture (bed, table, counter)? use the nearest open floor beside it
      for (const r of [0, 0.5, 0.9, 1.3]) {
        for (let k = 0; k < (r ? 8 : 1); k++) {
          const x = hit.point.x + r * Math.cos((k / 8) * Math.PI * 2), z = hit.point.z + r * Math.sin((k / 8) * Math.PI * 2)
          const f = floorAt(obj, x, z, level + 1.4, 1.9)
          if (f != null && Math.abs(f - level) < 0.3) return onPick(new THREE.Vector3(x, f, z))
        }
      }
    }
    el.addEventListener('pointerdown', d)
    el.addEventListener('pointerup', u)
    el.style.cursor = 'crosshair'
    return () => {
      el.removeEventListener('pointerdown', d)
      el.removeEventListener('pointerup', u)
      el.style.cursor = ''
    }
  }, [obj, level, onPick, camera, gl])
  return null
}

function Rig({ view, n, box, controls, plan, focus }: { view: CatView; n: number; box: THREE.Box3 | null; controls: React.RefObject<OrbitControlsImpl | null>; plan: number | null; focus?: [number, number, number] }) {
  const { camera } = useThree()
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  useEffect(() => {
    if (!box) return
    const size = box.getSize(new THREE.Vector3())
    // big sites (house + garden + street): frame the house and its garden, the rest stays around it
    const off = new THREE.Vector3(focus?.[0] ?? 0, 0, focus?.[1] ?? 0)
    if (focus) size.set(focus[2] * 2, size.y, focus[2] * 2)
    // distance that fits the whole model (incl. carport and site) in the 38° view
    const R = (Math.max(size.x, size.z, size.y * 1.6) / 2 / Math.tan((19 * Math.PI) / 180)) * 1.05
    const h = size.y
    const t = new THREE.Vector3(0, h * 0.4, 0)
    const map: Record<CatView, [number, number, number]> = {
      perspective: [R * 0.62, h * 0.8 + R * 0.28, R * 0.72],
      front: [0, h * 0.5 + 1, R],
      back: [0, h * 0.5 + 1, -R],
      right: [R, h * 0.5 + 1, 0],
      left: [-R, h * 0.5 + 1, 0],
      top: [0.01, R * 1.3, 0.01],
    }
    if (plan != null) {
      // floor plan: look down on the cut level (slightly tilted, like a dollhouse; straight down for "Top")
      const Rp = (Math.max(size.x, size.z) / 2 / Math.tan((19 * Math.PI) / 180)) * 1.02
      const tp = new THREE.Vector3(0, plan, 0)
      const pm: Record<CatView, [number, number, number]> = {
        perspective: [Rp * 0.35, plan + Rp * 0.85, Rp * 0.55],
        front: [0, plan + Rp * 0.8, Rp * 0.6],
        back: [0, plan + Rp * 0.8, -Rp * 0.6],
        right: [Rp * 0.6, plan + Rp * 0.8, 0],
        left: [-Rp * 0.6, plan + Rp * 0.8, 0],
        top: [0, plan + Rp * 1.05, 0.01],
      }
      goal.current = { pos: new THREE.Vector3(...pm[view]).add(off), target: tp.add(off) }
      return
    }
    goal.current = { pos: new THREE.Vector3(...map[view]).add(off), target: (view === 'top' ? new THREE.Vector3() : t).add(off) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, n, box, plan, focus?.[0], focus?.[1], focus?.[2]])
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const stop = () => (goal.current = null)
    c.addEventListener('start', stop)
    return () => c.removeEventListener('start', stop)
  }, [controls])
  useFrame((_, dt) => {
    const g = goal.current
    if (!g) return
    const k = 1 - Math.exp(-dt * 3.2)
    camera.position.lerp(g.pos, k)
    controls.current?.target.lerp(g.target, k)
    controls.current?.update()
    if (camera.position.distanceTo(g.pos) < 0.05) goal.current = null
  })
  return null
}

function Capture({ fn }: { fn: React.MutableRefObject<(() => string | null) | null> }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    fn.current = () => {
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/jpeg', 0.88)
    }
  }, [gl, scene, camera, fn])
  return null
}

const CatalogViewer = forwardRef<
  CatalogViewerHandle,
  {
    url: string
    view: CatView
    n: number
    night: boolean
    autoRotate: boolean
    className?: string
    lowPower?: boolean
    mode?: CatMode
    /** finished floor height of the chosen level (m above ground) */
    level?: number
    /** suggested start on this floor [x, z, facing°] */
    levelStart?: [number, number, number]
    walkStart?: WalkSpot | null
    walkKeys?: React.MutableRefObject<WalkKeys>
    /** big sites: [x, z, radius] (m, from the model centre) of the house + garden to frame */
    focus?: [number, number, number]
    /** floor plan: the visitor tapped a room */
    onPick?: (p: { x: number; y: number; z: number }) => void
  }
>(function CatalogViewer({ url, view, n, night, autoRotate, className, lowPower, mode = 'outside', level = 0, levelStart, walkStart, walkKeys, onPick, focus }, ref) {
  const controls = useRef<OrbitControlsImpl | null>(null)
  const [box, setBox] = useState<THREE.Box3 | null>(null)
  const [obj, setObj] = useState<THREE.Object3D | null>(null)
  const cap = useRef<(() => string | null) | null>(null)
  const noKeys = useRef<WalkKeys>({ fwd: false, back: false, left: false, right: false })
  useImperativeHandle(ref, () => ({ capture: () => cap.current?.() ?? null }))
  useEffect(() => {
    setBox(null)
    setObj(null)
  }, [url])
  const ext = box ? Math.max(box.max.x - box.min.x, box.max.z - box.min.z) : 30
  const clip = mode === 'plan' ? level + PLAN_CUT : null
  // walking: start where the visitor tapped, else find an open spot on that floor
  const start = useMemo<WalkSpot | null>(() => {
    if (mode !== 'walk' || !obj || !box) return null
    if (walkStart) return walkStart
    ensureBvh(obj)
    if (levelStart) {
      const [x, z, deg] = levelStart
      const f = floorAt(obj, x, z, level + 1.4, 1.9)
      return { x, y: f ?? level, z, n: 0, yaw: (deg * Math.PI) / 180 }
    }
    const p = findOpenSpot(obj, box, level)
    return { x: p.x, y: p.y, z: p.z, n: 0 }
  }, [mode, obj, box, walkStart, level, levelStart])
  const pick = useMemo(() => (p: THREE.Vector3) => onPick?.({ x: p.x, y: p.y, z: p.z }), [onPick])
  return (
    <div className={className?.includes('absolute') ? className : `relative ${className ?? ''}`}>
      <Canvas shadows={!lowPower} dpr={lowPower ? [1, 1.25] : [1, 2]} camera={{ position: [30, 18, 34], fov: 38, near: 0.1, far: 800 }} gl={{ antialias: true, preserveDrawingBuffer: true, localClippingEnabled: true } as unknown as THREE.WebGLRendererParameters} onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = night ? 0.8 : 1.0
        gl.localClippingEnabled = true
      }}>
        <color attach="background" args={[night ? '#070B14' : '#BFD3E2']} />
        {!night && <Sky distance={4500} sunPosition={[60, 40, 70]} turbidity={6} rayleigh={1.2} />}
        <hemisphereLight args={['#EAF2FF', '#6B6450', night ? 0.12 : mode === 'outside' ? 0.7 : 1.1]} />
        <directionalLight position={[ext * 0.8, ext * 1.4, ext]} intensity={night ? 0.15 : 2.4} castShadow={!lowPower} shadow-mapSize={[2048, 2048]} shadow-camera-left={-ext} shadow-camera-right={ext} shadow-camera-top={ext} shadow-camera-bottom={-ext} shadow-camera-far={ext * 5} shadow-bias={-0.0004} />
        {night && <pointLight position={[0, 3, 0]} intensity={40} distance={ext * 1.5} color="#FFC77A" />}
        {mode === 'walk' && <HeadLight night={night} />}
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={night ? 0.3 : 2} position={[5, 5, 5]} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={night ? 0.2 : 1} position={[-6, 3, -4]} scale={[4, 6, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Model
            url={url}
            clip={clip}
            onReady={(o, b) => {
              setObj(o)
              setBox(b)
            }}
          />
          {mode === 'outside' && <ContactShadows position={[0, 0.005, 0]} scale={ext * 2} opacity={night ? 0.2 : 0.45} blur={2.2} far={10} />}
        </Suspense>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <circleGeometry args={[ext * 3, 64]} />
          <meshStandardMaterial color={night ? '#1A2017' : '#7A8F5E'} roughness={1} />
        </mesh>
        {mode !== 'walk' && (
          <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={0.8} maxDistance={ext * 4} maxPolarAngle={mode === 'plan' ? Math.PI / 2.4 : Math.PI / 2.02} autoRotate={autoRotate && mode === 'outside'} autoRotateSpeed={0.5} target={[0, 3, 0]} />
        )}
        {mode !== 'walk' && <Rig key={mode} view={view} n={n} box={box} controls={controls} plan={mode === 'plan' ? level : null} focus={focus} />}
        {mode === 'plan' && obj && <PlanPicker obj={obj} level={level} onPick={pick} />}
        {mode === 'walk' && obj && start && <Walker obj={obj} start={start} keysRef={walkKeys ?? noKeys} />}
        <Capture fn={cap} />
      </Canvas>
      <LoadingOverlay />
    </div>
  )
})

export default CatalogViewer
