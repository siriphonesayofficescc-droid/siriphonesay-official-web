import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Sky, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import HouseModel, { levelY, PLINTH, type ViewOpts } from './HouseModel'
import { collisionBoxes, planFloor } from './geometry'
import { computeSite, inRect, stairHeight } from './layout'
import type { Design, FurnitureItem, Layout } from './types'

export type CameraPreset = 'perspective' | 'front' | 'rear' | 'left' | 'right' | 'top' | 'roof' | 'aerial' | 'photoFront' | 'photoBack'

export interface RenderShot {
  pos: [number, number, number]
  target: [number, number, number]
  fov?: number
  w: number
  h: number
}
export interface ViewerHandle {
  capture: (w?: number) => string | null
  renderShot: (s: RenderShot) => string | null
  teleport: (floor: number, x: number, z: number, lookX?: number, lookZ?: number) => void
  /** smoothly orbit-focus the camera on a point (radius = viewing distance) */
  focus: (x: number, y: number, z: number, r: number) => void
}

export interface HouseViewerProps {
  d: Design
  layout: Layout
  view: ViewOpts
  mode: 'orbit' | 'walk'
  preset: { name: CameraPreset; n: number }
  autoRotate?: boolean
  onRoomClick?: (id: string) => void
  editFurniture?: boolean
  onSelectFurniture?: (id: string | null) => void
  onMoveFurniture?: (id: string, x: number, z: number) => void
  lowPower?: boolean
  className?: string
}

/* ── lighting with smooth day ↔ night transition ───────────────── */
function Lighting({ night, evening, extent, lowPower, interior, sunBack }: { night: boolean; evening?: boolean; extent: number; lowPower?: boolean; interior?: boolean; sunBack?: boolean }) {
  const zs = sunBack ? -1 : 1 // light the side shown in the customer's reference photo
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const amb = useRef<THREE.AmbientLight>(null)
  const { scene } = useThree()
  const t = useRef(night ? 1 : 0)
  const dayBg = useMemo(() => new THREE.Color('#BFD3E2'), [])
  const nightBg = useMemo(() => new THREE.Color('#070B14'), [])
  const duskBg = useMemo(() => new THREE.Color('#C98E72'), [])
  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame((_, dt) => {
    const goal = night ? (evening ? 0.55 : 1) : 0
    t.current = THREE.MathUtils.damp(t.current, goal, 3, dt)
    const k = t.current
    // day → dusk (k≈0.55) → night: warm, low sun in between
    const dusk = 1 - Math.min(1, Math.abs(k - 0.55) / 0.45)
    if (sun.current) {
      sun.current.intensity = THREE.MathUtils.lerp(2.6, 0.12, k)
      sun.current.color.setRGB(1, THREE.MathUtils.lerp(0.95, 0.75, k) - dusk * 0.22, THREE.MathUtils.lerp(0.88, 0.95, k) - dusk * 0.4)
    }
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.lerp(0.75, 0.08, k)
    if (amb.current) amb.current.intensity = THREE.MathUtils.lerp(interior ? 0.9 : 0.25, interior ? 0.18 : 0.06, k)
    tmp.copy(dayBg).lerp(nightBg, k).lerp(duskBg, dusk * 0.6)
    if (scene.background instanceof THREE.Color) scene.background.copy(tmp)
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(tmp)
  })
  useEffect(() => {
    scene.background = new THREE.Color(night ? '#070B14' : '#BFD3E2')
    scene.fog = new THREE.Fog(night ? '#070B14' : '#BFD3E2', 60, 160)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])
  const e = extent
  return (
    <>
      <ambientLight ref={amb} intensity={0.25} />
      <hemisphereLight ref={hemi} args={['#EAF2FF', '#6B6450', 0.75]} />
      <directionalLight
        ref={sun}
        position={[e * 0.7, e * 1.2, e * 0.9 * zs]}
        intensity={2.6}
        castShadow={!lowPower}
        shadow-mapSize={[lowPower ? 1024 : 2048, lowPower ? 1024 : 2048]}
        shadow-camera-left={-e}
        shadow-camera-right={e}
        shadow-camera-top={e}
        shadow-camera-bottom={-e}
        shadow-camera-near={1}
        shadow-camera-far={e * 4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {!night && <Sky distance={4500} sunPosition={[e * 0.7, e * 0.5, e * 0.9 * zs]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} />}
      {night && evening && <Sky distance={4500} sunPosition={[e * 0.9, e * 0.02, e * 0.6]} turbidity={10} rayleigh={3} mieCoefficient={0.01} mieDirectionalG={0.9} />}
      {night && !evening && <Stars radius={120} depth={40} count={1500} factor={3} fade speed={0.3} />}
    </>
  )
}

/* ── camera presets (animated) ─────────────────────────────────── */
function CameraRig({ preset, focus, d, layout, controls }: { preset: { name: CameraPreset; n: number }; focus: { p: [number, number, number]; r: number; n: number } | null; d: Design; layout: Layout; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree()
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  useEffect(() => {
    if (!focus) return
    const target = new THREE.Vector3(...focus.p)
    // keep the current viewing direction, move closer; never go below a 35° look-down angle
    const dir = camera.position.clone().sub(controls.current?.target ?? new THREE.Vector3()).normalize()
    if (dir.y < 0.55) dir.y = 0.55
    dir.normalize()
    goal.current = { pos: target.clone().add(dir.multiplyScalar(focus.r)), target }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n])
  useEffect(() => {
    const { W, L } = layout
    const h = levelY(layout, d.floors - 1) + layout.floorH
    const midY = h / 2
    const R = Math.max(W, L) * 1.25 + 8
    const map: Record<CameraPreset, [number, number, number]> = {
      perspective: [R * 0.75, h * 0.9 + 3, R * 0.95],
      front: [0, midY + 1, L / 2 + R],
      rear: [0, midY + 1, -L / 2 - R],
      left: [-W / 2 - R, midY + 1, 0],
      right: [W / 2 + R, midY + 1, 0],
      top: [0.01, R * 2.2, 0.01],
      roof: [R * 0.4, h + R * 0.9, R * 0.5],
      aerial: [R * 1.3, R * 1.2, R * 1.4],
      // three-quarter views at about first-floor eye height, like a typical house photo
      photoFront: [R * 0.42, h * 0.5 + 1.2, L / 2 + R * 0.78],
      photoBack: [-R * 0.42, h * 0.5 + 1.2, -L / 2 - R * 0.78],
    }
    goal.current = { pos: new THREE.Vector3(...map[preset.name]), target: new THREE.Vector3(0, preset.name === 'top' ? 0 : preset.name.startsWith('photo') ? midY * 0.7 : midY * 0.8, 0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.n, preset.name])
  useFrame((_, dt) => {
    const g = goal.current
    if (!g) return
    camera.position.lerp(g.pos, 1 - Math.exp(-dt * 3.2))
    controls.current?.target.lerp(g.target, 1 - Math.exp(-dt * 3.2))
    controls.current?.update()
    if (camera.position.distanceTo(g.pos) < 0.05) goal.current = null
  })
  // user interaction cancels the animation
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const stop = () => (goal.current = null)
    c.addEventListener('start', stop)
    return () => c.removeEventListener('start', stop)
  }, [controls])
  return null
}

/* ── first-person walkthrough ──────────────────────────────────── */
export const walkInput = { f: 0, s: 0, turn: 0, look: 0 }

function Walker({ d, layout, teleportRef }: { d: Design; layout: Layout; teleportRef: React.MutableRefObject<((f: number, x: number, z: number, lx?: number, lz?: number) => void) | null> }) {
  const { camera, gl } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0) // 0 = facing -z (toward the house from the street)
  const pitch = useRef(0)
  const pos = useRef(new THREE.Vector3())
  const eye = 1.62
  const site = useMemo(() => computeSite(d), [d])
  const boxes = useMemo(() => layout.floors.map((_, f) => collisionBoxes(planFloor(d, layout, f))), [d, layout])
  const H = layout.floorH
  const s = layout.stair
  const flights = d.floors - 1 + (d.terrace.enabled && d.roof.type === 'flat' ? 1 : 0)

  useEffect(() => {
    const g = planFloor(d, layout, 0)
    const e = g.openings.find((o) => o.o.kind === 'entrance')
    const ex = e && e.side === 'front' ? (e.o.a + e.o.b) / 2 : 0
    pos.current.set(ex, 0, Math.min(site.land.z1 - 1, layout.L / 2 + 6))
    yaw.current = 0
    pitch.current = -0.05
    teleportRef.current = (f, x, z, lx, lz) => {
      pos.current.set(x, levelY(layout, f), z)
      if (lx !== undefined && lz !== undefined) yaw.current = Math.atan2(-(lx - x), -(lz - z))
      pitch.current = -0.08
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.ref, layout.W, layout.L])

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      keys.current[e.code] = true
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
    }
    const ku = (e: KeyboardEvent) => (keys.current[e.code] = false)
    // mouse / touch drag to look
    let dragging = false
    let lx = 0
    let ly = 0
    const pd = (e: PointerEvent) => {
      dragging = true
      lx = e.clientX
      ly = e.clientY
    }
    const pm = (e: PointerEvent) => {
      if (!dragging) return
      yaw.current -= (e.clientX - lx) * 0.004
      pitch.current = THREE.MathUtils.clamp(pitch.current - (e.clientY - ly) * 0.003, -1.1, 1.1)
      lx = e.clientX
      ly = e.clientY
    }
    const pu = () => (dragging = false)
    const el = gl.domElement
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    el.addEventListener('pointerdown', pd)
    window.addEventListener('pointermove', pm)
    window.addEventListener('pointerup', pu)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      el.removeEventListener('pointerdown', pd)
      window.removeEventListener('pointermove', pm)
      window.removeEventListener('pointerup', pu)
    }
  }, [gl])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const k = keys.current
    const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + walkInput.f
    const strafe = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + walkInput.s
    const turn = (k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0) + walkInput.turn
    yaw.current += turn * dt * 1.8
    pitch.current = THREE.MathUtils.clamp(pitch.current + walkInput.look * dt, -1.1, 1.1)
    const speed = (k.ShiftLeft ? 3.2 : 1.8) * dt
    const dir = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
    const right = new THREE.Vector3(-dir.z, 0, dir.x)
    const p = pos.current
    const move = dir.multiplyScalar(fwd * speed).add(right.multiplyScalar(strafe * speed))

    // current floor from height
    const f = THREE.MathUtils.clamp(Math.round((p.y - PLINTH) / H), 0, d.floors - 1)
    const insideBuilding = (x: number, z: number) => Math.abs(x) < layout.W / 2 && Math.abs(z) < layout.L / 2
    const blocked = (x: number, z: number) => {
      const R = 0.25
      if (x < site.land.x0 + R || x > site.land.x1 - R || z < site.land.z0 + R || z > site.land.z1 - R) return true
      const fl = p.y < PLINTH - 0.2 ? 0 : f
      return boxes[fl]?.some((b) => x + R > b.x0 && x - R < b.x1 && z + R > b.z0 && z - R < b.z1) ?? false
    }
    const nx = p.x + move.x
    const nz = p.z + move.z
    if (!blocked(nx, p.z)) p.x = nx
    if (!blocked(p.x, nz)) p.z = nz

    // vertical: ground, plinth step, stairs
    let targetY = insideBuilding(p.x, p.z) ? levelY(layout, f) : 0
    if (!insideBuilding(p.x, p.z) && Math.abs(p.x) < layout.W / 2 + 1.3 && p.z > layout.L / 2 && p.z < layout.L / 2 + 1.3) targetY = PLINTH * 0.5
    if (s && flights > 0 && inRect(s, p.x, p.z)) {
      const h = stairHeight(s, H, p.x, p.z)
      // pick the flight whose height here is closest to the current height (stepping on gradually)
      let best = levelY(layout, f)
      // on the ground floor you can also walk underneath flight 2
      let bd = f === 0 && p.y < PLINTH + 0.3 ? Math.abs(levelY(layout, 0) - p.y) : Infinity
      if (bd < Infinity) best = levelY(layout, 0)
      for (let fl = 0; fl < flights; fl++) {
        const y = levelY(layout, fl) + h
        const dd = Math.abs(y - p.y)
        if (dd < bd) {
          bd = dd
          best = y
        }
      }
      targetY = best
    }
    p.y = THREE.MathUtils.damp(p.y, targetY, 14, dt)
    camera.position.set(p.x, p.y + eye, p.z)
    const look = new THREE.Vector3(p.x - Math.sin(yaw.current) * Math.cos(pitch.current), p.y + eye + Math.sin(pitch.current), p.z - Math.cos(yaw.current) * Math.cos(pitch.current))
    camera.lookAt(look)
  })
  return null
}

/* ── furniture drag plane ──────────────────────────────────────── */
function DragPlane({ y, active, onMove, onEnd }: { y: number; active: boolean; onMove: (x: number, z: number) => void; onEnd: () => void }) {
  // a small dead-zone so a click (or double-click) on furniture never nudges it
  const start = useRef<{ x: number; y: number; moving: boolean } | null>(null)
  if (!active) {
    start.current = null
    return null
  }
  return (
    <mesh
      position={[0, y + 0.05, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={(e) => {
        e.stopPropagation()
        const st = start.current ?? (start.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, moving: false })
        if (!st.moving && Math.hypot(e.nativeEvent.clientX - st.x, e.nativeEvent.clientY - st.y) < 6) return
        st.moving = true
        onMove(e.point.x, e.point.z)
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        onEnd()
      }}
      onPointerLeave={onEnd}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function CaptureHelper({ handle, shot }: { handle: React.MutableRefObject<((w?: number) => string | null) | null>; shot: React.MutableRefObject<((s: RenderShot) => string | null) | null> }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    // high-resolution still: temporarily resize the drawing buffer, render once with a dedicated camera, restore
    shot.current = (o) => {
      const size = gl.getSize(new THREE.Vector2())
      const pr = gl.getPixelRatio()
      const cam = new THREE.PerspectiveCamera(o.fov ?? 40, o.w / o.h, 0.05, 600)
      cam.position.set(...o.pos)
      cam.lookAt(...o.target)
      let url: string | null = null
      try {
        gl.setPixelRatio(1)
        gl.setSize(o.w, o.h, false)
        gl.shadowMap.needsUpdate = true
        gl.render(scene, cam)
        url = gl.domElement.toDataURL('image/jpeg', 0.92)
      } catch {
        url = null
      } finally {
        gl.setPixelRatio(pr)
        gl.setSize(size.x, size.y, false)
        gl.render(scene, camera)
      }
      return url
    }
    handle.current = () => {
      gl.render(scene, camera)
      try {
        return gl.domElement.toDataURL('image/jpeg', 0.88)
      } catch {
        return null
      }
    }
  }, [gl, scene, camera, handle, shot])
  return null
}

const HouseViewer = forwardRef<ViewerHandle, HouseViewerProps>(function HouseViewer(
  { d, layout, view, mode, preset, autoRotate, onRoomClick, editFurniture, onSelectFurniture, onMoveFurniture, lowPower, className },
  ref,
) {
  const controls = useRef<OrbitControlsImpl | null>(null)
  const captureFn = useRef<((w?: number) => string | null) | null>(null)
  const shotFn = useRef<((s: RenderShot) => string | null) | null>(null)
  const teleportFn = useRef<((f: number, x: number, z: number, lx?: number, lz?: number) => void) | null>(null)
  const [drag, setDrag] = useState<{ id: string; floor: number; dx: number; dz: number } | null>(null)
  const [focus, setFocus] = useState<{ p: [number, number, number]; r: number; n: number } | null>(null)
  const focusOn = (x: number, y: number, z: number, r: number) => setFocus((f) => ({ p: [x, y, z], r, n: (f?.n ?? 0) + 1 }))
  const focusRoom = (id: string) => {
    const room = layout.floors.flat().find((r) => r.id === id)
    if (!room) return
    focusOn((room.x0 + room.x1) / 2, levelY(layout, room.floor, view.explode) + 0.8, (room.z0 + room.z1) / 2, Math.max(room.x1 - room.x0, room.z1 - room.z0) * 1.6 + 5)
  }
  const extent = Math.max(d.land.w, d.land.l) * 0.7 + 4

  useImperativeHandle(ref, () => ({
    capture: () => captureFn.current?.() ?? null,
    renderShot: (o) => shotFn.current?.(o) ?? null,
    teleport: (f, x, z, lx, lz) => teleportFn.current?.(f, x, z, lx, lz),
    focus: focusOn,
  }))

  const onFurnitureDown = editFurniture
    ? (item: FurnitureItem, e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onSelectFurniture?.(item.id)
        setDrag({ id: item.id, floor: item.floor, dx: item.x - e.point.x, dz: item.z - e.point.z })
      }
    : undefined

  return (
    <div className={className}>
      <Canvas
        shadows={!lowPower}
        dpr={lowPower ? [1, 1.25] : [1, 2]}
        camera={{ position: [30, 18, 34], fov: mode === 'walk' ? 70 : 38, near: 0.1, far: 400 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.shadowMap.type = THREE.PCFSoftShadowMap
        }}
        onPointerMissed={() => editFurniture && onSelectFurniture?.(null)}
      >
        <Lighting night={view.night} evening={view.evening} sunBack={d.facade?.side === 'back'} extent={extent} lowPower={lowPower} interior={mode === 'walk' || !!view.interiorLight} />
        <Suspense fallback={null}>
          <HouseModel
            d={d}
            layout={layout}
            view={view}
            onRoomClick={onRoomClick ? (id, e) => (e.stopPropagation(), onRoomClick(id)) : undefined}
            onRoomDoubleClick={mode === 'orbit' ? (id, e) => (e.stopPropagation(), focusRoom(id), onRoomClick?.(id)) : undefined}
            onFurnitureDown={onFurnitureDown}
          />
        </Suspense>
        {mode === 'orbit' ? (
          <>
            <OrbitControls
              ref={controls}
              makeDefault
              enableDamping
              dampingFactor={0.08}
              enabled={!drag}
              minDistance={3}
              maxDistance={140}
              maxPolarAngle={Math.PI / 2.02}
              autoRotate={autoRotate}
              autoRotateSpeed={0.6}
              target={[0, 3, 0]}
            />
            <CameraRig preset={preset} focus={focus} d={d} layout={layout} controls={controls} />
          </>
        ) : (
          <Walker d={d} layout={layout} teleportRef={teleportFn} />
        )}
        <DragPlane
          y={drag ? levelY(layout, drag.floor, view.explode) : 0}
          active={!!drag}
          onMove={(x, z) => {
            if (!drag) return
            const nx = THREE.MathUtils.clamp(x + drag.dx, -layout.W / 2 + 0.2, layout.W / 2 - 0.2)
            const nz = THREE.MathUtils.clamp(z + drag.dz, -layout.L / 2 + 0.2, layout.L / 2 - 0.2)
            onMoveFurniture?.(drag.id, Math.round(nx * 20) / 20, Math.round(nz * 20) / 20)
          }}
          onEnd={() => setDrag(null)}
        />
        <CaptureHelper handle={captureFn} shot={shotFn} />
      </Canvas>
    </div>
  )
})

export default HouseViewer
