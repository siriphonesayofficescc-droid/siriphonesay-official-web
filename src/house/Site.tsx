import { useMemo } from 'react'
import * as THREE from 'three'
import { computeSite } from './layout'
import { planFloor } from './geometry'
import { boxGeo, flatMaterial, material } from './textures'
import type { Design, Layout, Rect } from './types'

/** Land plot, driveway, carports, fence & gate, pool, trees and exterior lights. */

function Box({ x0, x1, z0, z1, y0, y1, mat, cast = true }: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; mat: THREE.Material; cast?: boolean }) {
  const p: [number, number, number] = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]
  const geo = useMemo(() => boxGeo(x1 - x0, y1 - y0, z1 - z0, p), [x0, x1, z0, z1, y0, y1]) // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={geo} position={p} material={mat} castShadow={cast} receiveShadow />
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function Tree({ x, z, s, kind }: { x: number; z: number; s: number; kind: number }) {
  const leaf = flatMaterial(kind ? '#4E6B3A' : '#5C7A41', 0.95)
  const trunk = flatMaterial('#5A4433', 0.9)
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 1.1, 0]} material={trunk} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 2.2, 8]} />
      </mesh>
      <mesh position={[0, 2.8, 0]} material={leaf} castShadow>
        <icosahedronGeometry args={[1.25, 1]} />
      </mesh>
      <mesh position={[0.5, 2.3, 0.3]} material={leaf} castShadow>
        <icosahedronGeometry args={[0.8, 1]} />
      </mesh>
      <mesh position={[-0.5, 3.4, -0.2]} material={leaf} castShadow>
        <icosahedronGeometry args={[0.75, 1]} />
      </mesh>
    </group>
  )
}

const overlaps = (r: Rect, x: number, z: number, pad: number) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad

export default function Site({ d, layout, night }: { d: Design; layout: Layout; night: boolean }) {
  const site = useMemo(() => computeSite(d), [d])
  const { W, L } = layout
  const { land } = site
  const entranceX = useMemo(() => {
    const g = planFloor(d, layout, 0)
    const e = g.openings.find((o) => o.o.kind === 'entrance' && o.side === 'front')
    return e ? (e.o.a + e.o.b) / 2 : 0
  }, [d, layout])

  const mats = useMemo(
    () => ({
      grass: material({ tex: 'plaster', color: '#6A8150', roughness: 1, tile: 3 }),
      lawn: material({ tex: 'plaster', color: '#77905A', roughness: 1, tile: 3 }),
      paving: material({ tex: 'tile', color: '#C4BEB3', roughness: 0.85, tile: 1.2 }),
      drive: material({ tex: 'concrete', color: '#A8A49C', roughness: 0.9, tile: 3 }),
      wood: material({ tex: 'wood', color: '#7A5236', roughness: 0.7, tile: 1.2 }),
      wall: material({ tex: 'plaster', color: d.exterior.wallColor || '#E6E3DD', roughness: 0.9, tile: 2 }),
      steel: flatMaterial('#1E1F21', 0.4, 0.7),
      glass: flatMaterial('#BFD3DB', 0.05, 0.2, { transparent: true, opacity: 0.3, depthWrite: false }),
      water: flatMaterial('#3B8FB3', 0.05, 0.3, { transparent: true, opacity: 0.88, emissive: new THREE.Color(night ? '#1E6F96' : '#0E3D52'), emissiveIntensity: night ? 0.9 : 0.25 }),
      coping: material({ tex: 'porcelain', color: '#E2DED6', roughness: 0.5, tile: 1.2 }),
      roof: flatMaterial('#8A8D91', 0.5, 0.5),
      bollard: flatMaterial('#2A2C2F', 0.5, 0.5, { emissive: new THREE.Color(night ? '#FFC77A' : '#000'), emissiveIntensity: night ? 1.5 : 0 }),
    }),
    [d.exterior.wallColor, night],
  )

  // gaps in the front fence for the driveway and the footpath
  const gaps: [number, number][] = []
  if (site.driveway) gaps.push([site.driveway.x0, site.driveway.x1])
  gaps.push([entranceX - 0.7, entranceX + 0.7])
  gaps.sort((a, b) => a[0] - b[0])

  const trees = useMemo(() => {
    const r = rng(d.ref.length * 13 + d.extras.trees)
    const out: { x: number; z: number; s: number; k: number }[] = []
    const avoid: Rect[] = [{ x0: -W / 2 - 2, x1: W / 2 + 2, z0: -L / 2 - 2, z1: L / 2 + 3 }, ...site.carports, ...(site.driveway ? [site.driveway] : []), ...(site.pool ? [site.pool] : [])]
    let tries = 0
    while (out.length < d.extras.trees && tries < 400) {
      tries++
      const x = land.x0 + 1 + r() * (land.x1 - land.x0 - 2)
      const z = land.z0 + 1 + r() * (land.z1 - land.z0 - 2)
      if (avoid.some((a) => overlaps(a, x, z, 0.8))) continue
      if (Math.abs(x - entranceX) < 1.5 && z > L / 2) continue
      if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 3)) continue
      out.push({ x, z, s: 0.8 + r() * 0.5, k: Math.round(r()) })
    }
    return out
  }, [d.ref, d.extras.trees, land, W, L, site, entranceX])

  const fenceH = d.exterior.fence === 'wall' ? 2.0 : d.exterior.fence === 'glass' ? 1.3 : 1.7
  const fenceRun = (x0: number, x1: number, z0: number, z1: number, key: string) => {
    const f = d.exterior.fence
    if (f === 'none') return null
    const alongX = Math.abs(z1 - z0) < 0.01
    const len = alongX ? x1 - x0 : z1 - z0
    if (len < 0.1) return null
    const T = 0.15
    const bx = alongX ? { x0, x1, z0: z0 - T / 2, z1: z0 + T / 2 } : { x0: x0 - T / 2, x1: x0 + T / 2, z0, z1 }
    if (f === 'wall') return <Box key={key} {...bx} y0={0} y1={fenceH} mat={mats.wall} />
    if (f === 'slat') return <Box key={key} {...bx} y0={0} y1={fenceH} mat={mats.wood} />
    if (f === 'glass')
      return (
        <group key={key}>
          <Box {...bx} y0={0} y1={0.3} mat={mats.wall} />
          <Box {...bx} y0={0.3} y1={fenceH} mat={mats.glass} cast={false} />
        </group>
      )
    // masonry / classic: low wall + posts + rail
    const posts = Math.floor(len / 0.25)
    return (
      <group key={key}>
        <Box {...bx} y0={0} y1={f === 'classic' ? 0.6 : 0.8} mat={mats.wall} />
        <Box {...bx} y0={fenceH - 0.06} y1={fenceH} mat={mats.steel} />
        {Array.from({ length: posts }, (_, i) => {
          const t = (i + 0.5) * (len / posts)
          const px = alongX ? x0 + t : x0
          const pz = alongX ? z0 : z0 + t
          return (
            <mesh key={i} position={[px, (fenceH + 0.7) / 2, pz]} material={mats.steel}>
              <boxGeometry args={[0.03, fenceH - 0.7, 0.03]} />
            </mesh>
          )
        })}
      </group>
    )
  }

  const front: React.ReactNode[] = []
  let cur = land.x0
  gaps.forEach(([a, b], i) => {
    front.push(fenceRun(cur, Math.max(cur, a), land.z1, land.z1, `ff${i}`))
    cur = Math.max(cur, b)
  })
  front.push(fenceRun(cur, land.x1, land.z1, land.z1, 'ffe'))

  return (
    <group>
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} material={mats.grass} receiveShadow>
        <planeGeometry args={[160, 160]} />
      </mesh>
      <Box x0={land.x0} x1={land.x1} z0={land.z0} z1={land.z1} y0={-0.02} y1={0.005} mat={d.extras.garden ? mats.lawn : mats.drive} cast={false} />
      {/* path from gate to entrance */}
      <Box x0={entranceX - 0.75} x1={entranceX + 0.75} z0={L / 2} z1={land.z1} y0={0} y1={0.03} mat={mats.paving} cast={false} />
      {/* perimeter paving */}
      <Box x0={-W / 2 - 0.9} x1={W / 2 + 0.9} z0={-L / 2 - 0.9} z1={L / 2 + 0.9} y0={0} y1={0.02} mat={mats.paving} cast={false} />
      {site.driveway && <Box {...site.driveway} y0={0} y1={0.03} mat={mats.drive} cast={false} />}
      {site.carports.map((c, i) => (
        <group key={i}>
          <Box {...c} y0={0} y1={0.04} mat={mats.drive} cast={false} />
          {[[c.x0 + 0.1, c.z1 - 0.1], [c.x1 - 0.1, c.z1 - 0.1], [c.x0 + 0.1, c.z0 + 0.1], [c.x1 - 0.1, c.z0 + 0.1]].map(([x, z], k) => (
            <Box key={k} x0={x - 0.08} x1={x + 0.08} z0={z - 0.08} z1={z + 0.08} y0={0} y1={2.6} mat={mats.steel} />
          ))}
          <Box x0={c.x0 - 0.1} x1={c.x1 + 0.1} z0={c.z0 - 0.1} z1={c.z1 + 0.3} y0={2.6} y1={2.75} mat={mats.roof} />
          {/* car for scale */}
          <group position={[(c.x0 + c.x1) / 2, 0.04, (c.z0 + c.z1) / 2]}>
            <mesh position={[0, 0.5, 0]} material={flatMaterial(i % 2 ? '#8E959A' : '#2F3236', 0.25, 0.6)} castShadow>
              <boxGeometry args={[1.8, 0.6, 4.5]} />
            </mesh>
            <mesh position={[0, 1.05, -0.2]} material={flatMaterial('#1C2329', 0.1, 0.4)} castShadow>
              <boxGeometry args={[1.6, 0.5, 2.3]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* pool */}
      {site.pool && (
        <group>
          <Box x0={site.pool.x0 - 0.8} x1={site.pool.x1 + 0.8} z0={site.pool.z0 - 0.8} z1={site.pool.z1 + 0.8} y0={0} y1={0.06} mat={mats.coping} cast={false} />
          <Box x0={site.pool.x0} x1={site.pool.x1} z0={site.pool.z0} z1={site.pool.z1} y0={0.0} y1={0.07} mat={mats.water} cast={false} />
          {night && <pointLight position={[(site.pool.x0 + site.pool.x1) / 2, 0.6, (site.pool.z0 + site.pool.z1) / 2]} color="#5EC4E8" intensity={8} distance={8} />}
        </group>
      )}
      {/* fence */}
      {front}
      {fenceRun(land.x0, land.x1, land.z0, land.z0, 'fb')}
      {fenceRun(land.x0, land.x0, land.z0, land.z1, 'fl')}
      {fenceRun(land.x1, land.x1, land.z0, land.z1, 'fr')}
      {/* gate */}
      {site.driveway && d.exterior.fence !== 'none' && (
        <Box x0={site.driveway.x0} x1={site.driveway.x0 + (site.driveway.x1 - site.driveway.x0) * 0.35} z0={land.z1 + 0.05} z1={land.z1 + 0.12} y0={0.05} y1={fenceH - 0.1} mat={d.exterior.gate === 'wood' ? mats.wood : mats.steel} />
      )}
      {/* trees */}
      {d.extras.garden && trees.map((t, i) => <Tree key={i} x={t.x} z={t.z} s={t.s} kind={t.k} />)}
      {/* bollard lights along the path */}
      {d.exterior.lights &&
        Array.from({ length: Math.max(0, Math.floor((land.z1 - L / 2) / 2.5)) }, (_, i) => {
          const z = L / 2 + 1.5 + i * 2.5
          return (
            <group key={i}>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[entranceX + s * 1.0, 0.35, z]} material={mats.bollard}>
                  <cylinderGeometry args={[0.07, 0.07, 0.7, 10]} />
                </mesh>
              ))}
              {night && i % 2 === 0 && <pointLight position={[entranceX, 0.8, z]} intensity={2} distance={4} color="#FFC77A" />}
            </group>
          )
        })}
      {/* façade uplights */}
      {d.exterior.lights && night && [-W / 2 + 0.6, W / 2 - 0.6].map((x) => <pointLight key={x} position={[x, 0.6, L / 2 + 0.9]} intensity={10} distance={9} color="#FFD29A" />)}
    </group>
  )
}
