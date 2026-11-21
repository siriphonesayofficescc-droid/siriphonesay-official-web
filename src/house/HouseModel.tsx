import { memo, useMemo } from 'react'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
  doorFinishes, doorTypes, featureWalls, findMat, floorMaterials, frameMaterials, garageDoors, glassTypes, handrails,
  roofMaterials, roomSpec, stairFinishes, styles, wallMaterials, type MaterialDef,
} from './catalog'
import { FurnitureMesh } from './Furniture'
import { planFloor, type Box, type FloorGeometry } from './geometry'
import { computeSite, EXT_T, roomLabel } from './layout'
const computeSiteCached = computeSite
import { boxGeo, flatMaterial, material, worldUV } from './textures'
import type { Design, FurnitureItem, Layout, PlacedRoom } from './types'
import Site from './Site'

export const PLINTH = 0.45

export interface ViewOpts {
  floorsShown: number
  roof: boolean
  explode: number
  wallCut: boolean
  hideFront: boolean
  labels: boolean
  night: boolean
  interior: boolean
  /** brighter ambient for interior stills */
  interiorLight?: boolean
  /** evening light (dusk sky, lamps on) — used together with night */
  evening?: boolean
  /** see-through walls */
  xray?: boolean
  selectedRoom?: string | null
  selectedFurniture?: string | null
  lang?: 'en' | 'lo'
}

export const levelY = (layout: Layout, f: number, explode = 0) => PLINTH + f * (layout.floorH + explode)

const matOf = (def: MaterialDef, color?: string, override?: Partial<MaterialDef>) =>
  material({ tex: def.tex, color: color || def.color, roughness: def.roughness, metalness: def.metalness, tile: def.tile, ...(override ?? {}) })

function useMaterials(d: Design, xray = false) {
  return useMemo(() => {
    const see = <T extends THREE.Material>(m: T): T => {
      if (!xray) return m
      const c = m.clone() as T
      c.transparent = true
      c.opacity = 0.18
      c.depthWrite = false
      return c
    }
    const wallDef = findMat(wallMaterials, d.exterior.wall)
    const accentDef = findMat(wallMaterials, d.exterior.accent)
    const roofDef = findMat(roofMaterials, d.exterior.roof)
    const frameDef = findMat(frameMaterials, d.exterior.frame)
    const glassDef = glassTypes.find((g) => g.id === d.exterior.glass) ?? glassTypes[0]
    const paint = see(material({ tex: 'plaster', color: d.interior.wallColor, roughness: 0.92, tile: 2 }))
    const ext = see(matOf(wallDef, d.exterior.wall === 'paint' ? d.exterior.wallColor : undefined))
    return {
      ext,
      accent: see(matOf(accentDef, d.exterior.accent === 'paint' ? d.exterior.accentColor : undefined)),
      roof: matOf(roofDef, d.exterior.roofColor || undefined, { tile: roofDef.tile }),
      roofDouble: matOf(roofDef, d.exterior.roofColor || undefined, { tile: roofDef.tile, side: THREE.DoubleSide } as Partial<MaterialDef>),
      fascia: flatMaterial(d.exterior.roof === 'flat' ? '#D9D7D2' : '#2B2C2F', 0.7),
      frame: frameDef.tex === 'wood' ? matOf(frameDef) : flatMaterial(frameDef.color, frameDef.roughness, frameDef.metalness ?? 0),
      glassDay: flatMaterial(glassDef.color, 0.04, 0.4, { transparent: true, opacity: glassDef.opacity, depthWrite: false }),
      glassNight: flatMaterial('#FFD9A3', 0.2, 0, { transparent: true, opacity: 0.85, emissive: new THREE.Color('#FFB866'), emissiveIntensity: 0.55, depthWrite: false }),
      paint,
      plinth: material({ tex: 'concrete', color: '#8E8C88', roughness: 0.9, tile: 2 }),
      slabEdge: flatMaterial('#CFCDC8', 0.85),
      ceiling: flatMaterial('#F6F5F2', 0.95),
      door: (() => {
        const dt = doorTypes.find((x) => x.id === d.exterior.door) ?? doorTypes[0]
        return material({ tex: dt.tex, color: dt.color, roughness: 0.55, tile: 1.2 })
      })(),
      garage: (() => {
        const g = garageDoors.find((x) => x.id === d.exterior.garageDoor) ?? garageDoors[0]
        return material({ tex: g.tex, color: g.color, roughness: 0.5, tile: 0.6 })
      })(),
      innerDoor: flatMaterial((doorFinishes.find((x) => x.id === d.interior.doorFinish) ?? doorFinishes[0]).color, 0.6),
      stair: (() => {
        const s = stairFinishes.find((x) => x.id === d.interior.stairFinish) ?? stairFinishes[0]
        return material({ tex: s.tex, color: s.color, roughness: 0.5, tile: 1.2 })
      })(),
      rail:
        d.interior.handrail === 'glass'
          ? flatMaterial('#BFD3DB', 0.05, 0.2, { transparent: true, opacity: 0.35, depthWrite: false })
          : flatMaterial(d.interior.handrail === 'wood' ? '#6B4429' : '#1E1F21', 0.5, d.interior.handrail === 'wood' ? 0 : 0.7),
      floorFor: (r: PlacedRoom) => {
        const ov = d.roomOverrides[r.id]?.floorMat
        const spec = r.type === 'stair' ? null : roomSpec(r.type)
        const id = ov ?? (spec?.wet ? d.interior.floorWet : spec?.group === 'bedrooms' ? d.interior.floorBed : r.type === 'garage' ? 'polished' : d.interior.floorLiving)
        return matOf(findMat(floorMaterials, id))
      },
      feature: (() => {
        const f = featureWalls.find((x) => x.id === d.interior.featureWall) ?? featureWalls[0]
        return f.id === 'none' ? null : see(material({ tex: f.tex, color: f.color, roughness: 0.5, tile: f.tex === 'marble' ? 1.6 : 1.2 }))
      })(),
      balcony: material({ tex: 'porcelain', color: '#CFCBC4', roughness: 0.4, tile: 1.2 }),
      hasWoodFrame: frameDef.id === 'wood',
    }
  }, [d.exterior, d.interior, d.roomOverrides, xray])
}

type Mats = ReturnType<typeof useMaterials>

/* exterior wall: outward face gets façade material, the rest interior paint */
const FACE: Record<string, number> = { right: 0, left: 1, front: 4, back: 5 }
function ExtWall({ b, mats, cut }: { b: Box; mats: Mats; cut: number | null }) {
  let { cy, sy } = b
  if (cut !== null) {
    const y0 = cy - sy / 2
    if (y0 >= cut) return null
    const y1 = Math.min(cy + sy / 2, cut)
    sy = y1 - y0
    cy = (y0 + y1) / 2
  }
  const arr = useMemo(() => {
    const a: THREE.Material[] = [mats.paint, mats.paint, mats.ext, mats.ext, mats.paint, mats.paint]
    a[FACE[b.side ?? 'front']] = mats.ext
    return a
  }, [mats, b.side])
  const geo = useMemo(() => boxGeo(b.sx, sy, b.sz, [b.cx, cy, b.cz]), [b.sx, sy, b.sz, b.cx, cy, b.cz])
  return <mesh geometry={geo} position={[b.cx, cy, b.cz]} material={arr} castShadow receiveShadow />
}

function Part({ b, mat, cut }: { b: Box; mat: THREE.Material; cut: number | null }) {
  let { cy, sy } = b
  if (cut !== null) {
    const y0 = cy - sy / 2
    if (y0 >= cut) return null
    const y1 = Math.min(cy + sy / 2, cut)
    sy = y1 - y0
    cy = (y0 + y1) / 2
  }
  const geo = useMemo(() => boxGeo(b.sx, sy, b.sz, [b.cx, cy, b.cz]), [b.sx, sy, b.sz, b.cx, cy, b.cz])
  return <mesh geometry={geo} position={[b.cx, cy, b.cz]} material={mat} castShadow receiveShadow />
}

function Slab({ x0, x1, z0, z1, y0, y1, mat }: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; mat: THREE.Material | THREE.Material[] }) {
  const sx = x1 - x0
  const sz = z1 - z0
  const sy = y1 - y0
  const p: [number, number, number] = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]
  const geo = useMemo(() => boxGeo(sx, sy, sz, p), [sx, sy, sz, p[0], p[1], p[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  if (sx <= 0.001 || sz <= 0.001) return null
  return <mesh geometry={geo} position={p} material={mat} castShadow receiveShadow />
}

/* windows, doors and frames in the exterior openings */
function Openings({ g, mats, night, d, cut, hideFront }: { g: FloorGeometry; mats: Mats; night: boolean; d: Design; cut: number | null; hideFront: boolean }) {
  return (
    <>
      {g.openings.map(({ side, o, axisPos }, i) => {
        if (hideFront && side === 'front') return null
        if (cut !== null && o.sill > cut) return null
        const along = side === 'front' || side === 'back'
        const out = side === 'front' || side === 'right' ? 1 : -1
        const fixed = axisPos - out * (EXT_T / 2)
        const w = o.b - o.a
        const head = cut !== null ? Math.min(o.head, cut) : o.head
        const h = head - o.sill
        const c = (o.a + o.b) / 2
        const pos = (offset: number, y: number): [number, number, number] => (along ? [c, y, fixed + out * offset] : [fixed + out * offset, y, c])
        const sz = (a: number, b: number, t: number): [number, number, number] => (along ? [a, b, t] : [t, b, a])
        const frameBars = (inset = 0) => (
          <>
            <mesh position={pos(inset, head - 0.03)} material={mats.frame}><boxGeometry args={sz(w, 0.06, 0.08)} /></mesh>
            <mesh position={pos(inset, o.sill + 0.03)} material={mats.frame}><boxGeometry args={sz(w, 0.06, 0.08)} /></mesh>
            <mesh position={along ? [o.a + 0.03, o.sill + h / 2, fixed + out * inset] : [fixed + out * inset, o.sill + h / 2, o.a + 0.03]} material={mats.frame}><boxGeometry args={sz(0.06, h, 0.08)} /></mesh>
            <mesh position={along ? [o.b - 0.03, o.sill + h / 2, fixed + out * inset] : [fixed + out * inset, o.sill + h / 2, o.b - 0.03]} material={mats.frame}><boxGeometry args={sz(0.06, h, 0.08)} /></mesh>
          </>
        )
        if (o.kind === 'entrance' || o.kind === 'door') {
          const leafW = o.kind === 'entrance' ? w : w
          const hinge = along ? [o.a, 0, fixed] : [fixed, 0, o.a]
          return (
            <group key={i}>
              {frameBars(0)}
              <group position={hinge as [number, number, number]} rotation={[0, along ? out * 1.15 : -Math.PI / 2 - out * 1.15, 0]}>
                <mesh position={[leafW / 2, h / 2, 0]} material={mats.door} castShadow>
                  <boxGeometry args={[leafW - 0.04, h - 0.04, 0.06]} />
                </mesh>
              </group>
              {d.exterior.lights && o.kind === 'entrance' && (
                <>
                  <mesh position={along ? [o.a - 0.35, 2.1, fixed + out * 0.16] : [fixed + out * 0.16, 2.1, o.a - 0.35]} material={flatMaterial('#E8DCC0', 0.4, 0, { emissive: new THREE.Color(night ? '#FFC77A' : '#000'), emissiveIntensity: 2 })}>
                    <boxGeometry args={[0.12, 0.3, 0.12]} />
                  </mesh>
                  {night && <pointLight position={along ? [c, 2.6, fixed + out * 1.2] : [fixed + out * 1.2, 2.6, c]} intensity={6} distance={7} color="#FFC77A" />}
                </>
              )}
            </group>
          )
        }
        if (o.kind === 'garage') {
          return (
            <mesh key={i} position={pos(-0.02, o.sill + h / 2)} material={mats.garage} castShadow>
              <boxGeometry args={sz(w, h, 0.06)} />
            </mesh>
          )
        }
        // glazing (window / small / slider / strip)
        const mullions = o.grid ? Math.max(1, Math.round(w / 1.1) - 1) : o.kind === 'window' && w > 1.8 ? Math.round(w / 1.2) - 1 : o.kind === 'slider' ? 1 : 0
        return (
          <group key={i}>
            <mesh position={pos(0, o.sill + h / 2)} material={night ? mats.glassNight : mats.glassDay}>
              <boxGeometry args={sz(w, h, 0.02)} />
            </mesh>
            {frameBars(0)}
            {Array.from({ length: mullions }, (_, k) => {
              const x = o.a + (w / (mullions + 1)) * (k + 1)
              return (
                <mesh key={k} position={along ? [x, o.sill + h / 2, fixed] : [fixed, o.sill + h / 2, x]} material={mats.frame}>
                  <boxGeometry args={sz(0.05, h, 0.07)} />
                </mesh>
              )
            })}
            {o.kind === 'window' && o.sill > 0.3 && (
              <mesh position={pos(0.1, o.sill - 0.03)} material={mats.slabEdge}>
                <boxGeometry args={sz(w + 0.1, 0.06, 0.22)} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}

/* interior doorways: frame + open leaf */
function InteriorDoors({ g, mats, cut }: { g: FloorGeometry; mats: Mats; cut: number | null }) {
  if (cut !== null && cut < 1) return null
  return (
    <>
      {g.doors.map((dr, i) => {
        const w = dr.b - dr.a
        if (w > 1.2) return null // wide opening — no leaf
        const along = dr.axis === 'x'
        return (
          <group key={i} position={along ? [dr.a, 0, dr.c] : [dr.c, 0, dr.a]} rotation={[0, along ? -1.35 : Math.PI / 2 - 1.35, 0]}>
            <mesh position={[w / 2 - 0.02, 1.02, 0.03]} material={mats.innerDoor} castShadow>
              <boxGeometry args={[w - 0.06, 2.04, 0.04]} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

/* U-turn (dog-leg) stair from this level to the next, built in the stair's local frame */
function StairFlight({ layout, mats, d }: { layout: Layout; mats: Mats; d: Design }) {
  const s = layout.stair!
  const H = layout.floorH
  const per = s.n / 2
  const rh = H / s.n
  const tread = s.run / per
  const fw = s.flightW
  const W2 = s.width
  // local frame: X = u (along flight 1), Z = v (across). Mirror Z if the basis is left-handed.
  const theta = Math.atan2(-s.uz, s.ux)
  const vRot = [Math.sin(theta), Math.cos(theta)]
  const mirror = vRot[0] * s.vx + vRot[1] * s.vz < 0
  const glass = d.interior.handrail === 'glass'
  const slope = Math.atan2(H / 2, s.run)
  const len = Math.hypot(H / 2, s.run)
  return (
    <group position={[s.ox, 0, s.oz]} rotation={[0, theta, 0]} scale={[1, 1, mirror ? -1 : 1]}>
      {/* flight 1: v ∈ [0, fw], rising along +u */}
      {Array.from({ length: per }, (_, i) => (
        <mesh key={`a${i}`} position={[tread * (i + 0.5), (rh * (i + 1)) / 2, fw / 2]} material={mats.stair} castShadow receiveShadow>
          <boxGeometry args={[tread, rh * (i + 1), fw]} />
        </mesh>
      ))}
      {/* landing */}
      <mesh position={[s.run + s.landing / 2, H / 2 - 0.1, W2 / 2]} material={mats.stair} castShadow receiveShadow>
        <boxGeometry args={[s.landing, 0.2, W2]} />
      </mesh>
      {/* flight 2: v ∈ [W2 − fw, W2], rising back along −u */}
      {Array.from({ length: per }, (_, i) => (
        <mesh key={`b${i}`} position={[s.run - tread * (i + 0.5), H / 2 + rh * (i + 0.5), W2 - fw / 2]} material={mats.stair} castShadow receiveShadow>
          <boxGeometry args={[tread, rh, fw]} />
        </mesh>
      ))}
      {/* inclined slab under flight 2 */}
      <mesh position={[s.run / 2, H * 0.75 - 0.18, W2 - fw / 2]} rotation={[0, 0, -slope]} material={mats.slabEdge}>
        <boxGeometry args={[len, 0.16, fw]} />
      </mesh>
      {/* central balustrade between flights */}
      {glass ? (
        <>
          <mesh position={[s.run / 2, H / 4 + 0.5, fw + 0.03]} rotation={[0, 0, slope]} material={mats.rail}>
            <boxGeometry args={[len, 0.9, 0.02]} />
          </mesh>
          <mesh position={[s.run / 2, (H * 3) / 4 + 0.5, W2 - fw - 0.03]} rotation={[0, 0, -slope]} material={mats.rail}>
            <boxGeometry args={[len, 0.9, 0.02]} />
          </mesh>
        </>
      ) : (
        <mesh position={[s.run / 2, H / 2 + 0.2, W2 / 2]} material={mats.rail}>
          <boxGeometry args={[s.run, H * 0.55, 0.06]} />
        </mesh>
      )}
      {/* handrails */}
      <mesh position={[s.run / 2, H / 4 + 0.95, fw + 0.03]} rotation={[0, 0, slope]} material={glass ? flatMaterial('#A9ADB2', 0.3, 0.8) : mats.rail}>
        <boxGeometry args={[len, 0.05, 0.05]} />
      </mesh>
      <mesh position={[s.run / 2, (H * 3) / 4 + 0.95, W2 - fw - 0.03]} rotation={[0, 0, -slope]} material={glass ? flatMaterial('#A9ADB2', 0.3, 0.8) : mats.rail}>
        <boxGeometry args={[len, 0.05, 0.05]} />
      </mesh>
    </group>
  )
}

function RoomLights({ rooms, ceiling, night, lighting, chandeliers }: { rooms: PlacedRoom[]; ceiling: number; night: boolean; lighting: string; chandeliers: FurnitureItem[] }) {
  const glow = flatMaterial('#FFF4E0', 0.4, 0, { emissive: new THREE.Color(night ? '#FFD9A0' : '#000'), emissiveIntensity: night ? 2.2 : 0 })
  const gold = flatMaterial('#C9A96E', 0.3, 0.9, { emissive: new THREE.Color(night ? '#FFC77A' : '#000'), emissiveIntensity: night ? 0.8 : 0 })
  return (
    <>
      {rooms.map((r) => {
        const cx = (r.x0 + r.x1) / 2
        const cz = (r.z0 + r.z1) / 2
        const area = (r.x1 - r.x0) * (r.z1 - r.z0)
        return (
          <group key={r.id}>
            {lighting === 'pendant' && area > 9 && r.type !== 'stair' ? (
              <group position={[cx, ceiling, cz]}>
                <mesh position={[0, -0.35, 0]} material={flatMaterial('#1E1F21', 0.5)}>
                  <cylinderGeometry args={[0.005, 0.005, 0.7]} />
                </mesh>
                <mesh position={[0, -0.75, 0]} material={glow}>
                  <cylinderGeometry args={[0.12, 0.22, 0.2, 18]} />
                </mesh>
              </group>
            ) : (
              <mesh position={[cx, ceiling - 0.01, cz]} rotation={[Math.PI / 2, 0, 0]} material={glow}>
                <circleGeometry args={[0.12, 16]} />
              </mesh>
            )}
            {night && area > 4 && <pointLight position={[cx, ceiling - 0.4, cz]} intensity={Math.min(14, area * 0.6)} distance={Math.max(4, Math.sqrt(area) * 2.2)} decay={1.6} color="#FFD7A0" />}
          </group>
        )
      })}
      {chandeliers.map((c) => (
        <group key={c.id} position={[c.x, ceiling, c.z]} scale={c.scale}>
          <mesh position={[0, -0.25, 0]} material={gold}>
            <cylinderGeometry args={[0.01, 0.01, 0.5]} />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
            <mesh key={k} position={[Math.cos((k / 8) * Math.PI * 2) * 0.42, -0.75 + (k % 2) * 0.12, Math.sin((k / 8) * Math.PI * 2) * 0.42]} material={glow}>
              <sphereGeometry args={[0.06, 10, 10]} />
            </mesh>
          ))}
          <mesh position={[0, -0.7, 0]} rotation={[Math.PI / 2, 0, 0]} material={gold}>
            <torusGeometry args={[0.42, 0.015, 8, 40]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/* ── roof ─────────────────────────────────────────────────────── */
function triGeo(base: number, rise: number, depth = 0.2, quad = false) {
  const s = new THREE.Shape()
  if (quad) {
    s.moveTo(-base / 2, 0)
    s.lineTo(base / 2, 0)
    s.lineTo(base / 2, rise)
  } else {
    s.moveTo(-base / 2, 0)
    s.lineTo(base / 2, 0)
    s.lineTo(0, rise)
  }
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false })
  return worldUV(g)
}

function hipGeo(W: number, L: number, o: number, pitch: number) {
  const ex = W / 2 + o
  const ez = L / 2 + o
  const t = Math.tan((pitch * Math.PI) / 180)
  const alongX = ex >= ez
  const rise = (alongX ? ez : ex) * t
  const r = alongX ? ex - ez : ez - ex // half ridge length
  const A = new THREE.Vector3(-ex, 0, ez)
  const Bv = new THREE.Vector3(ex, 0, ez)
  const C = new THREE.Vector3(ex, 0, -ez)
  const D = new THREE.Vector3(-ex, 0, -ez)
  const R1 = alongX ? new THREE.Vector3(-r, rise, 0) : new THREE.Vector3(0, rise, r)
  const R2 = alongX ? new THREE.Vector3(r, rise, 0) : new THREE.Vector3(0, rise, -r)
  const tris: THREE.Vector3[] = alongX
    ? [A, Bv, R2, A, R2, R1, C, D, R1, C, R1, R2, D, A, R1, Bv, C, R2]
    : [A, Bv, R1, Bv, C, R2, Bv, R2, R1, C, D, R2, D, A, R1, D, R1, R2]
  const g = new THREE.BufferGeometry().setFromPoints(tris)
  g.computeVertexNormals()
  return { geo: worldUV(g), rise }
}

function Roof({ d, layout, mats, yTop }: { d: Design; layout: Layout; mats: Mats; yTop: number }) {
  const { W, L } = layout
  const o = d.roof.overhang
  const p = (d.roof.pitch * Math.PI) / 180
  const style = styles.find((s) => s.id === d.style)
  if (d.roof.type === 'flat') {
    const parapet = o <= 0.35
    const terrace = d.terrace.enabled
    return (
      <group position={[0, yTop, 0]}>
        <Slab x0={-W / 2 - o} x1={W / 2 + o} z0={-L / 2 - o} z1={L / 2 + o} y0={0} y1={0.3} mat={[mats.fascia, mats.fascia, mats.roof, mats.fascia, mats.fascia, mats.fascia]} />
        {parapet && !terrace &&
          [
            [-W / 2, W / 2, L / 2 - 0.2, L / 2],
            [-W / 2, W / 2, -L / 2, -L / 2 + 0.2],
            [-W / 2, -W / 2 + 0.2, -L / 2, L / 2],
            [W / 2 - 0.2, W / 2, -L / 2, L / 2],
          ].map(([x0, x1, z0, z1], i) => <Slab key={i} x0={x0} x1={x1} z0={z0} z1={z1} y0={0.3} y1={1.0} mat={mats.ext} />)}
        {terrace && (
          <>
            {[
              [-W / 2 - o, W / 2 + o, L / 2 + o - 0.02, L / 2 + o],
              [-W / 2 - o, W / 2 + o, -L / 2 - o, -L / 2 - o + 0.02],
              [-W / 2 - o, -W / 2 - o + 0.02, -L / 2 - o, L / 2 + o],
              [W / 2 + o - 0.02, W / 2 + o, -L / 2 - o, L / 2 + o],
            ].map(([x0, x1, z0, z1], i) => (
              <Slab key={i} x0={x0} x1={x1} z0={z0} z1={z1} y0={0.3} y1={1.4} mat={flatMaterial('#BFD3DB', 0.05, 0.2, { transparent: true, opacity: 0.3, depthWrite: false })} />
            ))}
            {/* pergola */}
            <group position={[0, 0.3, -L / 4]}>
              {[[-2, -1.8], [2, -1.8], [-2, 1.8], [2, 1.8]].map(([x, z], i) => (
                <mesh key={i} position={[x, 1.3, z]} material={mats.accent} castShadow>
                  <boxGeometry args={[0.15, 2.6, 0.15]} />
                </mesh>
              ))}
              {Array.from({ length: 12 }, (_, i) => (
                <mesh key={i} position={[-2.1 + i * 0.38, 2.65, 0]} material={mats.accent} castShadow>
                  <boxGeometry args={[0.08, 0.15, 4.0]} />
                </mesh>
              ))}
            </group>
          </>
        )}
      </group>
    )
  }
  if (d.roof.type === 'gable') {
    const alongX = W >= L
    const span = (alongX ? L : W) / 2 + o
    const len = (alongX ? W : L) + 2 * o
    const rise = span * Math.tan(p)
    const eaveDrop = o * Math.tan(p)
    const slope = span / Math.cos(p)
    const riseWall = (alongX ? L : W) / 2 * Math.tan(p)
    return (
      <group position={[0, yTop, 0]}>
        {[1, -1].map((sgn) =>
          alongX ? (
            <mesh key={sgn} position={[0, -eaveDrop + rise / 2 + 0.06, (sgn * span) / 2]} rotation={[sgn * p, 0, 0]} material={mats.roof} castShadow receiveShadow>
              <primitive object={worldUV(new THREE.BoxGeometry(len, 0.12, slope))} attach="geometry" />
            </mesh>
          ) : (
            <mesh key={sgn} position={[(sgn * span) / 2, -eaveDrop + rise / 2 + 0.06, 0]} rotation={[0, 0, -sgn * p]} material={mats.roof} castShadow receiveShadow>
              <primitive object={worldUV(new THREE.BoxGeometry(slope, 0.12, len))} attach="geometry" />
            </mesh>
          ),
        )}
        {/* gable-end infill */}
        {[1, -1].map((sgn) =>
          alongX ? (
            <mesh key={`g${sgn}`} geometry={triGeo(L, riseWall)} rotation={[0, Math.PI / 2, 0]} position={[sgn > 0 ? W / 2 - 0.2 : -W / 2, 0, 0]} material={mats.ext} castShadow />
          ) : (
            <mesh key={`g${sgn}`} geometry={triGeo(W, riseWall)} position={[0, 0, sgn > 0 ? L / 2 - 0.2 : -L / 2]} material={mats.ext} castShadow />
          ),
        )}
        {style?.features.finials &&
          [1, -1].map((sgn) => (
            <mesh key={`f${sgn}`} position={alongX ? [(sgn * len) / 2, rise - eaveDrop + 0.45, 0] : [0, rise - eaveDrop + 0.45, (sgn * len) / 2]} rotation={alongX ? [0, 0, -sgn * 0.5] : [sgn * 0.5, 0, 0]} material={flatMaterial('#C9A96E', 0.3, 0.9)}>
              <coneGeometry args={[0.12, 0.9, 8]} />
            </mesh>
          ))}
      </group>
    )
  }
  if (d.roof.type === 'hip') {
    const { geo } = hipGeo(W, L, o, d.roof.pitch)
    const eaveDrop = o * Math.tan(p)
    return (
      <group position={[0, yTop - eaveDrop, 0]}>
        <mesh geometry={geo} material={mats.roofDouble} castShadow receiveShadow />
        {/* fascia */}
        {[
          [-W / 2 - o, W / 2 + o, L / 2 + o - 0.05, L / 2 + o],
          [-W / 2 - o, W / 2 + o, -L / 2 - o, -L / 2 - o + 0.05],
          [-W / 2 - o, -W / 2 - o + 0.05, -L / 2 - o, L / 2 + o],
          [W / 2 + o - 0.05, W / 2 + o, -L / 2 - o, L / 2 + o],
        ].map(([x0, x1, z0, z1], i) => (
          <Slab key={i} x0={x0} x1={x1} z0={z0} z1={z1} y0={-0.22} y1={0.02} mat={mats.fascia} />
        ))}
        {/* soffit */}
        <Slab x0={-W / 2 - o} x1={W / 2 + o} z0={-L / 2 - o} z1={L / 2 + o} y0={-0.04} y1={0} mat={flatMaterial('#E6E3DD', 0.9)} />
      </group>
    )
  }
  // shed
  const riseW = L * Math.tan(p)
  const slope = (L + 2 * o) / Math.cos(p)
  return (
    <group position={[0, yTop, 0]}>
      <mesh position={[0, riseW / 2 + 0.06, 0]} rotation={[p, 0, 0]} material={mats.roof} castShadow receiveShadow>
        <primitive object={worldUV(new THREE.BoxGeometry(W + 2 * o, 0.12, slope))} attach="geometry" />
      </mesh>
      {[1, -1].map((sgn) => (
        <mesh key={sgn} geometry={triGeo(L, riseW, 0.2, true)} rotation={[0, Math.PI / 2, 0]} position={[sgn > 0 ? W / 2 - 0.2 : -W / 2, 0, 0]} material={mats.ext} castShadow />
      ))}
      <Slab x0={-W / 2} x1={W / 2} z0={-L / 2} z1={-L / 2 + 0.2} y0={0} y1={riseW} mat={mats.ext} />
    </group>
  )
}

/* ── façade features ──────────────────────────────────────────── */
function Facade({ d, layout, mats, explode }: { d: Design; layout: Layout; mats: Mats; explode: number }) {
  const { W, L, floorH: H } = layout
  const style = styles.find((s) => s.id === d.style)
  const f = style?.features ?? {}
  const top = levelY(layout, d.floors - 1, explode) + H
  const entO = useMemo(() => planFloor(d, layout, 0).openings.find((o) => o.o.kind === 'entrance' && o.side === 'front'), [d, layout])
  const block = entO ? { x0: Math.max(-W / 2, entO.o.a - 0.7), x1: Math.min(W / 2, entO.o.b + 0.7) } : null
  const els: React.ReactNode[] = []
  // accent cladding: stair-hall front strip above the entrance, else left side wall
  if (d.exterior.accent !== d.exterior.wall || d.exterior.accentColor) {
    if (block && d.floors > 1) {
      els.push(<Slab key="acc" x0={block.x0} x1={block.x1} z0={L / 2} z1={L / 2 + 0.06} y0={PLINTH + 2.9} y1={top + (d.roof.type === 'flat' ? 0.9 : 0)} mat={mats.accent} />)
    } else {
      els.push(<Slab key="acc" x0={-W / 2 - 0.06} x1={-W / 2} z0={-L / 2} z1={L / 2} y0={PLINTH} y1={top} mat={mats.accent} />)
    }
  }
  // entrance canopy (modern) or portico with columns (classic)
  const ent = d.entrance === 'front'
  const ex0 = block ? block.x0 : -1.5
  const ex1 = block ? block.x1 : 1.5
  if (ent && f.columns) {
    const xs = [ex0 - 0.6, ex1 + 0.6]
    els.push(
      <group key="portico">
        {xs.map((x, i) => (
          <group key={i} position={[x, 0, L / 2 + 2.0]}>
            <mesh position={[0, PLINTH + H / 2, 0]} material={mats.ext} castShadow>
              <cylinderGeometry args={[0.2, 0.22, H, 20]} />
            </mesh>
            <mesh position={[0, PLINTH + 0.1, 0]} material={mats.accent}>
              <boxGeometry args={[0.55, 0.2, 0.55]} />
            </mesh>
            <mesh position={[0, PLINTH + H - 0.1, 0]} material={mats.accent}>
              <boxGeometry args={[0.55, 0.2, 0.55]} />
            </mesh>
          </group>
        ))}
        <Slab x0={xs[0] - 0.4} x1={xs[1] + 0.4} z0={L / 2} z1={L / 2 + 2.4} y0={PLINTH + H - 0.1} y1={PLINTH + H + 0.15} mat={mats.accent} />
        <Slab x0={xs[0] - 0.4} x1={xs[1] + 0.4} z0={L / 2} z1={L / 2 + 2.4} y0={0} y1={PLINTH} mat={mats.balcony} />
      </group>,
    )
  } else if (ent) {
    const ez = entO?.axisPos ?? L / 2
    if (ez > L / 2 - 0.05) els.push(<Slab key="canopy" x0={ex0 - 0.3} x1={ex1 + 0.3} z0={L / 2} z1={L / 2 + 1.8} y0={PLINTH + 2.75} y1={PLINTH + 2.9} mat={mats.fascia} />)
    els.push(<Slab key="steps" x0={ex0 - 0.3} x1={ex1 + 0.3} z0={ez} z1={Math.max(ez + 1.2, L / 2 + 0.6)} y0={0} y1={PLINTH - 0.15} mat={mats.balcony} />)
  }
  // cornices
  if (f.cornice) {
    for (let k = 1; k <= d.floors; k++) {
      const y = levelY(layout, k, explode) - (k === d.floors ? 0 : 0.05)
      els.push(<Slab key={`c${k}`} x0={-W / 2 - 0.15} x1={W / 2 + 0.15} z0={-L / 2 - 0.15} z1={L / 2 + 0.15} y0={y - 0.2} y1={y} mat={mats.slabEdge} />)
    }
  }
  // contemporary frame around the top floor
  if (f.frame && d.floors > 1) {
    const y0 = levelY(layout, d.floors - 1, explode) - 0.35
    const y1 = top + 0.35
    const fx0 = -W / 2
    const fx1 = W / 2
    const z0 = L / 2 - 0.1
    const z1 = L / 2 + 1.1
    els.push(
      <group key="frame">
        <Slab x0={fx0} x1={fx1} z0={z0} z1={z1} y0={y1 - 0.35} y1={y1} mat={mats.accent} />
        <Slab x0={fx0} x1={fx1} z0={z0} z1={z1} y0={y0} y1={y0 + 0.35} mat={mats.accent} />
        <Slab x0={fx0} x1={fx0 + 0.35} z0={z0} z1={z1} y0={y0} y1={y1} mat={mats.accent} />
        <Slab x0={fx1 - 0.35} x1={fx1} z0={z0} z1={z1} y0={y0} y1={y1} mat={mats.accent} />
      </group>,
    )
  }
  // vertical timber slats in front of the upper hall
  if (f.slats && block && d.floors > 1) {
    const y0 = levelY(layout, 1, explode)
    const n = Math.floor((block.x1 - block.x0) / 0.14)
    els.push(
      <group key="slats">
        {Array.from({ length: n }, (_, i) => (
          <Slab key={i} x0={block.x0 + i * 0.14 + 0.04} x1={block.x0 + i * 0.14 + 0.1} z0={L / 2 + 0.12} z1={L / 2 + 0.2} y0={y0} y1={top} mat={material({ tex: 'woodv', color: '#8B5E3C', roughness: 0.7, tile: 1.2 })} />
        ))}
      </group>,
    )
  }
  return <>{els}</>
}

/* ── photo-matched façade features: overhang columns, frame, bands, fins, pergola, deck ── */
function FacadeFeatures({ d, layout, mats, explode }: { d: Design; layout: Layout; mats: Mats; explode: number }) {
  const fac = d.facade
  const parts = useMemo(() => {
    if (!fac) return null
    const fm = (id: string, color: string) => {
      const def = findMat(wallMaterials, id)
      return matOf(def, id === 'paint' ? color : undefined, def.tex === 'woodv' ? { tile: 0.8 } : undefined)
    }
    return { frame: fm(fac.frameMat, fac.frameColor), band: fm(fac.bandMat, fac.bandColor), fins: fm(fac.finsMat, fac.finsColor), wood: material({ tex: 'woodv', color: '#8B5E3C', roughness: 0.7, tile: 1 }), deck: material({ tex: 'parquet', color: '#9A6B45', roughness: 0.75, tile: 1.4 }) }
  }, [fac])
  if (!fac || !parts) return null
  const { W, L, floorH: H } = layout
  const s = fac.side === 'front' ? 1 : -1
  const face = (s * L) / 2
  const z = (a: number, b: number) => (s > 0 ? { z0: face + a, z1: face + b } : { z0: face - b, z1: face - a })
  const top = levelY(layout, d.floors - 1, explode) + H
  const y1 = levelY(layout, 1, explode)
  const els: React.ReactNode[] = []
  const multi = d.floors > 1
  // columns under the overhanging upper floor
  const rows = layout.floors[0] ?? []
  const groundFace = rows.length ? (s > 0 ? Math.max(...rows.map((r) => r.z1)) : Math.min(...rows.map((r) => r.z0))) : face
  const rec = Math.abs(face - groundFace)
  if (multi && rec > 0.3) {
    const n = Math.max(2, Math.round(W / 4.5) + 1)
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 0.2 + ((W - 0.4) * i) / (n - 1)
      els.push(<Slab key={`col${i}`} x0={x - 0.18} x1={x + 0.18} {...z(-0.42, -0.06)} y0={0} y1={y1} mat={parts.frame} />)
    }
    // covered terrace floor
    els.push(<Slab key="terr" x0={-W / 2} x1={W / 2} {...(s > 0 ? { z0: groundFace, z1: face } : { z0: face, z1: groundFace })} y0={PLINTH - 0.02} y1={PLINTH} mat={mats.balcony} />)
  }
  // thick frame around the upper floor(s) or the whole façade
  if (fac.frame !== 'none' && (multi || fac.frame === 'whole')) {
    const T = 0.45
    const dp = fac.frameDepth
    const fy0 = fac.frame === 'upper' && multi ? y1 - 0.4 : 0
    const fy1 = top + (d.roof.type === 'flat' ? 0.55 : 0.15)
    const zz = z(-0.1, dp)
    els.push(
      <group key="frame">
        <Slab x0={-W / 2 - 0.05} x1={W / 2 + 0.05} {...zz} y0={fy1 - T} y1={fy1} mat={parts.frame} />
        {fac.frame === 'upper' && <Slab x0={-W / 2 - 0.05} x1={W / 2 + 0.05} {...zz} y0={fy0} y1={fy0 + T} mat={parts.frame} />}
        <Slab x0={-W / 2 - 0.05} x1={-W / 2 - 0.05 + T} {...zz} y0={fy0} y1={fy1} mat={parts.frame} />
        <Slab x0={W / 2 + 0.05 - T} x1={W / 2 + 0.05} {...zz} y0={fy0} y1={fy1} mat={parts.frame} />
      </group>,
    )
  }
  // thick band at each upper floor level (and roof edge for flat roofs)
  if (fac.band && multi) {
    const levels = Array.from({ length: d.floors - 1 }, (_, k) => levelY(layout, k + 1, explode))
    if (d.roof.type === 'flat') levels.push(top + 0.45)
    levels.forEach((y, k) =>
      els.push(
        <group key={`band${k}`}>
          <Slab x0={-W / 2 - 0.35} x1={W / 2 + 0.35} {...z(-0.1, 1.0)} y0={y - 0.45} y1={y} mat={parts.band} />
          <Slab x0={-W / 2 - 0.35} x1={-W / 2} {...(s > 0 ? { z0: -L / 2, z1: face } : { z0: face, z1: L / 2 })} y0={y - 0.45} y1={y} mat={parts.band} />
          <Slab x0={W / 2} x1={W / 2 + 0.35} {...(s > 0 ? { z0: -L / 2, z1: face } : { z0: face, z1: L / 2 })} y0={y - 0.45} y1={y} mat={parts.band} />
        </group>,
      ),
    )
  }
  // vertical fins on the upper floor
  if (fac.fins !== 'none' && multi) {
    const span = Math.min(3.2, W * 0.3)
    const x0 = fac.fins === 'left' ? -W / 2 + 0.5 : fac.fins === 'right' ? W / 2 - 0.5 - span : -span / 2
    const n = Math.max(3, Math.floor(span / 0.5))
    for (let i = 0; i <= n; i++) {
      const x = x0 + (span * i) / n
      els.push(<Slab key={`fin${i}`} x0={x - 0.07} x1={x + 0.07} {...z(0.05, 0.6)} y0={y1} y1={top} mat={parts.fins} />)
    }
  }
  // pergola over the terrace on the main side (beyond any overhang)
  if (fac.pergola) {
    const px0 = -W * 0.35
    const px1 = W * 0.35
    const zd = 3.2
    const py = PLINTH + 2.85
    const posts = [px0, px1]
    posts.forEach((x, i) => els.push(<Slab key={`pp${i}`} x0={x - 0.08} x1={x + 0.08} {...z(zd - 0.2, zd - 0.04)} y0={0} y1={py} mat={parts.wood} />))
    els.push(<Slab key="pbeam" x0={px0 - 0.2} x1={px1 + 0.2} {...z(zd - 0.24, zd)} y0={py - 0.2} y1={py} mat={parts.wood} />)
    const nb = Math.floor((px1 - px0) / 0.45)
    for (let i = 0; i <= nb; i++) {
      const x = px0 + ((px1 - px0) * i) / nb
      els.push(<Slab key={`pb${i}`} x0={x - 0.04} x1={x + 0.04} {...z(0, zd + 0.2)} y0={py} y1={py + 0.18} mat={parts.wood} />)
    }
  }
  // wood deck in front of the main façade (kept clear of the pool)
  if (fac.deck) {
    const site = computeSiteCached(d)
    const poolSide = site.pool ? (site.pool.z1 > 0 ? 1 : -1) : 0
    const depth = poolSide === s ? Math.min(1.1, Math.abs(Math.abs(s > 0 ? site.pool!.z0 : site.pool!.z1) - L / 2)) : 3.6
    els.push(<Slab key="deck" x0={-W / 2 - 0.3} x1={W / 2 + 0.3} {...z(0, depth)} y0={0} y1={PLINTH - 0.05} mat={parts.deck} />)
  }
  return <>{els}</>
}

/* ── one floor ────────────────────────────────────────────────── */
const FloorModel = memo(function FloorModel({
  d, layout, f, g, mats, view, furniture, onRoomClick, onRoomDoubleClick, onFurnitureDown,
}: {
  d: Design
  layout: Layout
  f: number
  g: FloorGeometry
  mats: Mats
  view: ViewOpts
  furniture: FurnitureItem[]
  onRoomClick?: (id: string, e: ThreeEvent<MouseEvent>) => void
  onRoomDoubleClick?: (id: string, e: ThreeEvent<MouseEvent>) => void
  onFurnitureDown?: (item: FurnitureItem, e: ThreeEvent<PointerEvent>) => void
}) {
  const { W, L } = layout
  const rooms = layout.floors[f]
  const cut = view.wallCut ? 1.25 : null
  const isTop = f === d.floors - 1
  const s = layout.stair
  const hole = f > 0 && s ? s : null
  const chandeliers = furniture.filter((x) => x.kind === 'chandelier')
  const living = rooms.find((r) => r.type === 'living') ?? rooms.find((r) => r.type === 'family' || r.type === 'lounge')

  return (
    <group>
      {/* structure: plinth / slab with stair void */}
      {f === 0 ? (
        <Slab x0={-W / 2} x1={W / 2} z0={-L / 2} z1={L / 2} y0={-PLINTH} y1={0} mat={mats.plinth} />
      ) : hole ? (
        <>
          <Slab x0={-W / 2} x1={hole.x0} z0={-L / 2} z1={L / 2} y0={-0.3} y1={0} mat={mats.slabEdge} />
          <Slab x0={hole.x1} x1={W / 2} z0={-L / 2} z1={L / 2} y0={-0.3} y1={0} mat={mats.slabEdge} />
          <Slab x0={hole.x0} x1={hole.x1} z0={-L / 2} z1={hole.z0} y0={-0.3} y1={0} mat={mats.slabEdge} />
          <Slab x0={hole.x0} x1={hole.x1} z0={hole.z1} z1={L / 2} y0={-0.3} y1={0} mat={mats.slabEdge} />
        </>
      ) : (
        <Slab x0={-W / 2} x1={W / 2} z0={-L / 2} z1={L / 2} y0={-0.3} y1={0} mat={mats.slabEdge} />
      )}

      {/* finished floors — clickable rooms */}
      {rooms.map((r) => {
        const sel = view.selectedRoom === r.id
        const isVoid = hole && r.type === 'stair'
        return (
          <group key={r.id}>
            {isVoid ? (
              <>
                <Slab x0={r.x0} x1={hole.x0} z0={r.z0} z1={r.z1} y0={0} y1={0.02} mat={mats.floorFor(r)} />
                <Slab x0={hole.x1} x1={r.x1} z0={r.z0} z1={r.z1} y0={0} y1={0.02} mat={mats.floorFor(r)} />
                <Slab x0={hole.x0} x1={hole.x1} z0={r.z0} z1={hole.z0} y0={0} y1={0.02} mat={mats.floorFor(r)} />
                <Slab x0={hole.x0} x1={hole.x1} z0={hole.z1} z1={r.z1} y0={0} y1={0.02} mat={mats.floorFor(r)} />
              </>
            ) : (
              <RoomFloor r={r} mat={mats.floorFor(r)} onClick={onRoomClick} onDbl={onRoomDoubleClick} />
            )}
            {sel && (
              <mesh position={[(r.x0 + r.x1) / 2, 0.03, (r.z0 + r.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[r.x1 - r.x0 - 0.1, r.z1 - r.z0 - 0.1]} />
                <meshBasicMaterial color="#C9A96E" transparent opacity={0.28} depthWrite={false} />
              </mesh>
            )}
            {d.roomOverrides[r.id]?.wallColor && !view.xray && (
              <RoomSkin r={r} color={d.roomOverrides[r.id]!.wallColor!} h={cut ?? d.ceiling} />
            )}
            {view.labels && (
              <Html position={[(r.x0 + r.x1) / 2, (cut ?? 1.4) + 0.2, (r.z0 + r.z1) / 2]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                <div className="whitespace-nowrap border border-white/15 bg-ink/80 px-2 py-1 text-center backdrop-blur">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-mist">{d.roomOverrides[r.id]?.name || roomLabel(r.type, view.lang)}</div>
                  <div className="font-mono text-[9px] text-gold">
                    {(r.x1 - r.x0).toFixed(1)} × {(r.z1 - r.z0).toFixed(1)} m · {((r.x1 - r.x0) * (r.z1 - r.z0)).toFixed(0)} m²
                  </div>
                </div>
              </Html>
            )}
          </group>
        )
      })}

      {/* walls */}
      {g.walls.map((b, i) => (view.hideFront && b.side === 'front' ? null : <ExtWall key={i} b={b} mats={mats} cut={cut} />))}
      {g.partitions.map((b, i) => (
        <Part key={i} b={b} mat={mats.paint} cut={cut} />
      ))}
      <Openings g={g} mats={mats} night={view.night} d={d} cut={cut} hideFront={view.hideFront} />
      <InteriorDoors g={g} mats={mats} cut={cut} />

      {/* feature wall behind the TV in the main living room */}
      {mats.feature && living && <FeatureWall r={living} W={W} L={L} h={cut ?? d.ceiling} mat={mats.feature} />}

      {/* stairs */}
      {s && (f < d.floors - 1 || (isTop && d.terrace.enabled && d.roof.type === 'flat')) && <StairFlight layout={layout} mats={mats} d={d} />}


      {/* balcony */}
      {f > 0 && d.balcony.enabled && (
        <group>
          <Slab x0={-W / 2 + 0.3} x1={W / 2 - 0.3} z0={L / 2} z1={L / 2 + d.balcony.depth} y0={-0.25} y1={0} mat={[mats.slabEdge, mats.slabEdge, mats.balcony, mats.slabEdge, mats.slabEdge, mats.slabEdge]} />
          <Slab x0={-W / 2 + 0.3} x1={W / 2 - 0.3} z0={L / 2 + d.balcony.depth - 0.02} z1={L / 2 + d.balcony.depth} y0={0} y1={1.1} mat={flatMaterial('#BFD3DB', 0.05, 0.2, { transparent: true, opacity: 0.3, depthWrite: false })} />
          <Slab x0={-W / 2 + 0.3} x1={W / 2 - 0.3} z0={L / 2 + d.balcony.depth - 0.04} z1={L / 2 + d.balcony.depth} y0={1.08} y1={1.13} mat={mats.frame} />
        </group>
      )}

      {/* ceilings for interior views */}
      {view.interior && <CeilingPlanes rooms={rooms} ceiling={d.ceiling} type={d.interior.ceiling} hole={hole && f < d.floors ? null : null} mats={mats} />}

      {/* lighting & furniture */}
      {(!view.wallCut || view.night) && <RoomLights rooms={rooms} ceiling={d.ceiling} night={view.night} lighting={d.interior.lighting} chandeliers={view.wallCut ? [] : chandeliers} />}
      {furniture
        .filter((it) => it.kind !== 'chandelier')
        .map((it) => (
          <group
            key={it.id}
            onPointerDown={onFurnitureDown ? (e) => onFurnitureDown(it, e) : undefined}
          >
            <FurnitureMesh item={it} night={view.night} selected={view.selectedFurniture === it.id} />
          </group>
        ))}
    </group>
  )
})

function RoomFloor({ r, mat, onClick, onDbl }: { r: PlacedRoom; mat: THREE.Material; onClick?: (id: string, e: ThreeEvent<MouseEvent>) => void; onDbl?: (id: string, e: ThreeEvent<MouseEvent>) => void }) {
  const p: [number, number, number] = [(r.x0 + r.x1) / 2, 0.01, (r.z0 + r.z1) / 2]
  const geo = useMemo(() => boxGeo(r.x1 - r.x0, 0.02, r.z1 - r.z0, p), [r.x0, r.x1, r.z0, r.z1]) // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={geo} position={p} material={mat} receiveShadow onClick={onClick ? (e) => onClick(r.id, e) : undefined} onDoubleClick={onDbl ? (e) => onDbl(r.id, e) : undefined} />
}

function RoomSkin({ r, color, h }: { r: PlacedRoom; color: string; h: number }) {
  const m = material({ tex: 'plaster', color, roughness: 0.92, tile: 2 })
  const t = 0.06
  const i = 0.055
  return (
    <>
      <Slab x0={r.x0 + i} x1={r.x1 - i} z0={r.z0 + i} z1={r.z0 + i + 0.004} y0={0} y1={h} mat={m} />
      <Slab x0={r.x0 + i} x1={r.x1 - i} z0={r.z1 - i - 0.004} z1={r.z1 - i} y0={0} y1={h} mat={m} />
      <Slab x0={r.x0 + i} x1={r.x0 + i + 0.004} z0={r.z0 + i} z1={r.z1 - i} y0={0} y1={h} mat={m} />
      <Slab x0={r.x1 - i - 0.004} x1={r.x1 - i} z0={r.z0 + i} z1={r.z1 - i} y0={0} y1={h} mat={m} />
      {void t}
    </>
  )
}

function FeatureWall({ r, W, L, h, mat }: { r: PlacedRoom; W: number; L: number; h: number; mat: THREE.Material }) {
  const longX = r.x1 - r.x0 >= r.z1 - r.z0
  const onBoundary = (v: number, lim: number) => Math.abs(Math.abs(v) - lim) < 0.05
  const width = longX ? r.x1 - r.x0 : r.z1 - r.z0
  const w = Math.min(width - 0.6, 4.2)
  if (longX) {
    const z = onBoundary(r.z1, L / 2) ? (onBoundary(r.z0, L / 2) ? null : r.z0 + 0.12) : r.z1 - 0.12
    if (z === null) return null
    const cx = (r.x0 + r.x1) / 2
    return <Slab x0={cx - w / 2} x1={cx + w / 2} z0={z - 0.03} z1={z + 0.03} y0={0} y1={h} mat={mat} />
  }
  const x = onBoundary(r.x1, W / 2) ? (onBoundary(r.x0, W / 2) ? null : r.x0 + 0.12) : r.x1 - 0.12
  if (x === null) return null
  const cz = (r.z0 + r.z1) / 2
  return <Slab x0={x - 0.03} x1={x + 0.03} z0={cz - w / 2} z1={cz + w / 2} y0={0} y1={h} mat={mat} />
}

function CeilingPlanes({ rooms, ceiling, type, mats }: { rooms: PlacedRoom[]; ceiling: number; type: string; hole: unknown; mats: Mats }) {
  const wood = material({ tex: 'woodv', color: '#A87B52', roughness: 0.7, tile: 1.2 })
  const coveGlow = flatMaterial('#FFF4E0', 0.5, 0, { emissive: new THREE.Color('#FFD9A0'), emissiveIntensity: 0.8 })
  return (
    <>
      {rooms.map((r) => {
        if (r.type === 'stair') return null
        const m = type === 'wood' && roomSpec(r.type)?.group === 'living' ? wood : mats.ceiling
        return (
          <group key={r.id}>
            <Slab x0={r.x0} x1={r.x1} z0={r.z0} z1={r.z1} y0={ceiling} y1={ceiling + 0.05} mat={m} />
            {type === 'cove' && r.x1 - r.x0 > 3 && r.z1 - r.z0 > 3 && (
              <>
                <Slab x0={r.x0} x1={r.x1} z0={r.z0} z1={r.z0 + 0.5} y0={ceiling - 0.2} y1={ceiling} mat={mats.ceiling} />
                <Slab x0={r.x0} x1={r.x1} z0={r.z1 - 0.5} z1={r.z1} y0={ceiling - 0.2} y1={ceiling} mat={mats.ceiling} />
                <Slab x0={r.x0 + 0.5} x1={r.x1 - 0.5} z0={r.z0 + 0.5} z1={r.z0 + 0.52} y0={ceiling - 0.05} y1={ceiling - 0.02} mat={coveGlow} />
              </>
            )}
          </group>
        )
      })}
    </>
  )
}

/* ── whole house ──────────────────────────────────────────────── */
export interface HouseModelProps {
  d: Design
  layout: Layout
  view: ViewOpts
  onRoomClick?: (id: string, e: ThreeEvent<MouseEvent>) => void
  onRoomDoubleClick?: (id: string, e: ThreeEvent<MouseEvent>) => void
  onFurnitureDown?: (item: FurnitureItem, e: ThreeEvent<PointerEvent>) => void
  showSite?: boolean
}

export function useFloorPlans(d: Design, layout: Layout) {
  return useMemo(() => layout.floors.map((_, f) => planFloor(d, layout, f)), [d, layout])
}

export default function HouseModel({ d, layout, view, onRoomClick, onRoomDoubleClick, onFurnitureDown, showSite = true }: HouseModelProps) {
  const mats = useMaterials(d, !!view.xray)
  const plans = useFloorPlans(d, layout)
  const shown = Math.min(view.floorsShown, d.floors)
  const yTop = levelY(layout, d.floors - 1, view.explode) + layout.floorH
  const showRoof = view.roof && shown >= d.floors && !view.wallCut
  void handrails
  return (
    <group>
      {plans.slice(0, shown).map((g, f) => (
        <group key={f} position={[0, levelY(layout, f, view.explode), 0]}>
          <FloorModel
            d={d}
            layout={layout}
            f={f}
            g={g}
            mats={mats}
            view={view}
            furniture={d.furniture.filter((x) => x.floor === f)}
            onRoomClick={onRoomClick}
            onRoomDoubleClick={onRoomDoubleClick}
            onFurnitureDown={onFurnitureDown}
          />
        </group>
      ))}
      {showRoof && <Roof d={d} layout={layout} mats={mats} yTop={yTop} />}
      {shown >= d.floors && !view.wallCut && <Facade d={d} layout={layout} mats={mats} explode={view.explode} />}
      {(shown >= d.floors || (d.facade?.recess ?? 0) > 0) && !view.wallCut && <FacadeFeatures d={d} layout={layout} mats={mats} explode={view.explode} />}
      {showSite && <Site d={d} layout={layout} night={view.night} />}
    </group>
  )
}
