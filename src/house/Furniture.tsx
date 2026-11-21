import { memo } from 'react'
import * as THREE from 'three'
import { furnitureDef } from './catalog'
import { flatMaterial } from './textures'
import type { FurnitureItem } from './types'

/** Low-poly, real-scale furniture assembled from primitives. Front faces +z. */

type P = { w: number; h: number; d: number; c: string }

const B = ({ p, s, c, r = 0.6, m = 0, e }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; m?: number; e?: string }) => (
  <mesh position={p} castShadow receiveShadow material={flatMaterial(c, r, m, e ? { emissive: new THREE.Color(e), emissiveIntensity: 1.4 } : {})}>
    <boxGeometry args={s} />
  </mesh>
)
const Cyl = ({ p, r, h, c, rough = 0.5, metal = 0 }: { p: [number, number, number]; r: number; h: number; c: string; rough?: number; metal?: number }) => (
  <mesh position={p} castShadow material={flatMaterial(c, rough, metal)}>
    <cylinderGeometry args={[r, r, h, 16]} />
  </mesh>
)

const shade = (hex: string, l: number) => {
  const c = new THREE.Color(hex)
  c.offsetHSL(0, 0, l)
  return `#${c.getHexString()}`
}

function shape(kind: string, { w, h, d, c }: P, night: boolean) {
  const dark = shade(c, -0.25)
  switch (kind) {
    case 'sofa':
      return (
        <>
          <B p={[0, 0.22, 0.05]} s={[w, 0.24, d - 0.1]} c={c} r={0.9} />
          <B p={[0, 0.52, -d / 2 + 0.12]} s={[w, 0.6, 0.24]} c={c} r={0.9} />
          <B p={[-w / 2 + 0.1, 0.38, 0]} s={[0.2, 0.42, d]} c={c} r={0.9} />
          <B p={[w / 2 - 0.1, 0.38, 0]} s={[0.2, 0.42, d]} c={c} r={0.9} />
          <B p={[0, 0.05, 0]} s={[w - 0.1, 0.1, d - 0.1]} c="#2A2B2D" />
        </>
      )
    case 'lsofa':
      return (
        <>
          <B p={[0, 0.22, -d / 2 + 0.5]} s={[w, 0.26, 0.95]} c={c} r={0.9} />
          <B p={[0, 0.55, -d / 2 + 0.12]} s={[w, 0.6, 0.24]} c={c} r={0.9} />
          <B p={[w / 2 - 0.475, 0.22, 0.25]} s={[0.95, 0.26, d - 0.5]} c={c} r={0.9} />
          <B p={[w / 2 - 0.12, 0.55, 0.1]} s={[0.24, 0.6, d - 0.2]} c={c} r={0.9} />
        </>
      )
    case 'armchair':
      return (
        <>
          <B p={[0, 0.25, 0.05]} s={[w - 0.1, 0.22, d - 0.15]} c={c} r={0.9} />
          <B p={[0, 0.55, -d / 2 + 0.1]} s={[w, 0.6, 0.2]} c={c} r={0.9} />
          <B p={[-w / 2 + 0.07, 0.4, 0]} s={[0.14, 0.4, d]} c={c} r={0.9} />
          <B p={[w / 2 - 0.07, 0.4, 0]} s={[0.14, 0.4, d]} c={c} r={0.9} />
        </>
      )
    case 'coffee':
      return (
        <>
          <B p={[0, h - 0.03, 0]} s={[w, 0.06, d]} c={c} r={0.4} />
          <B p={[0, (h - 0.06) / 2, 0]} s={[w * 0.6, h - 0.06, d * 0.6]} c={dark} />
        </>
      )
    case 'tv':
      return (
        <>
          <B p={[0, 0.25, 0]} s={[w, 0.5, d]} c={c} r={0.5} />
          <B p={[0, 0.95, -d / 2 + 0.05]} s={[1.45, 0.82, 0.05]} c="#0B0C0E" r={0.2} e={night ? '#1d2b3a' : undefined} />
        </>
      )
    case 'bookshelf':
      return (
        <>
          <B p={[0, h / 2, -d / 2 + 0.02]} s={[w, h, 0.04]} c={dark} />
          {[0, 0.4, 0.8, 1.2, 1.6, 1.98].map((y) => (
            <B key={y} p={[0, y + 0.02, 0]} s={[w, 0.03, d]} c={c} />
          ))}
          <B p={[-w / 2 + 0.02, h / 2, 0]} s={[0.04, h, d]} c={c} />
          <B p={[w / 2 - 0.02, h / 2, 0]} s={[0.04, h, d]} c={c} />
          {[0.2, 0.6, 1.0, 1.4].map((y, i) => (
            <B key={i} p={[(i % 2 ? 0.2 : -0.25), y + 0.15, 0]} s={[0.4, 0.26, d * 0.7]} c={['#7B4B3A', '#3D5A6C', '#A8874E', '#5F6F4E'][i]} r={0.8} />
          ))}
        </>
      )
    case 'rug':
      return <B p={[0, 0.012, 0]} s={[w, 0.02, d]} c={c} r={1} />
    case 'dining6':
    case 'dining4': {
      const seats = kind === 'dining6' ? 3 : 2
      return (
        <>
          <B p={[0, h - 0.025, 0]} s={[w, 0.05, d]} c={c} r={0.4} />
          {[-1, 1].map((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * (w / 2 - 0.08), (h - 0.05) / 2, sz * (d / 2 - 0.08)]} s={[0.06, h - 0.05, 0.06]} c={dark} />))}
          {[-1, 1].map((side) =>
            Array.from({ length: seats }, (_, i) => {
              const x = (i - (seats - 1) / 2) * (w / seats)
              return (
                <group key={`${side}${i}`} position={[x, 0, side * (d / 2 + 0.3)]} rotation={[0, side > 0 ? Math.PI : 0, 0]}>
                  <B p={[0, 0.45, 0]} s={[0.45, 0.06, 0.45]} c="#D9D6CF" r={0.9} />
                  <B p={[0, 0.72, 0.2]} s={[0.45, 0.5, 0.05]} c="#D9D6CF" r={0.9} />
                  <B p={[0, 0.22, 0]} s={[0.4, 0.44, 0.4]} c={dark} />
                </group>
              )
            }),
          )}
        </>
      )
    }
    case 'bed-king':
    case 'bed-queen':
    case 'bed-single':
      return (
        <>
          <B p={[0, 0.17, 0.05]} s={[w, 0.34, d - 0.1]} c={shade(c, -0.35)} r={0.8} />
          <B p={[0, 0.44, 0.08]} s={[w - 0.06, 0.2, d - 0.2]} c="#F3F1EC" r={0.95} />
          <B p={[0, 0.52, 0.45]} s={[w - 0.02, 0.06, d * 0.55]} c={c} r={0.95} />
          <B p={[0, h / 2 + 0.1, -d / 2 + 0.05]} s={[w + 0.1, h + 0.2, 0.1]} c={shade(c, -0.3)} r={0.9} />
          {(w > 1.2 ? [-w / 4, w / 4] : [0]).map((x) => (
            <B key={x} p={[x, 0.6, -d / 2 + 0.35]} s={[w > 1.2 ? w / 2 - 0.15 : w - 0.2, 0.14, 0.35]} c="#FFFFFF" r={0.95} />
          ))}
        </>
      )
    case 'wardrobe':
      return (
        <>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.5} />
          {[-w / 4, w / 4].map((x) => (
            <B key={x} p={[x + (x > 0 ? -0.05 : 0.05), h / 2, d / 2 + 0.01]} s={[0.02, 0.4, 0.02]} c="#C9A96E" m={0.8} r={0.3} />
          ))}
          <B p={[0, h / 2, d / 2 + 0.003]} s={[0.01, h - 0.05, 0.005]} c={dark} />
        </>
      )
    case 'nightstand':
      return (
        <>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} />
          <Cyl p={[0, h + 0.18, 0]} r={0.09} h={0.3} c="#F2E7CF" />
          {night && <pointLight position={[0, h + 0.4, 0]} intensity={0.6} distance={2.2} color="#FFD7A0" />}
        </>
      )
    case 'desk':
      return (
        <>
          <B p={[0, h - 0.02, 0]} s={[w, 0.04, d]} c={c} r={0.5} />
          <B p={[-w / 2 + 0.03, (h - 0.04) / 2, 0]} s={[0.04, h - 0.04, d]} c={dark} />
          <B p={[w / 2 - 0.03, (h - 0.04) / 2, 0]} s={[0.04, h - 0.04, d]} c={dark} />
          <B p={[0, h + 0.2, -d / 2 + 0.1]} s={[0.6, 0.38, 0.03]} c="#111214" e={night ? '#20344a' : undefined} />
          <B p={[0, 0.45, d / 2 + 0.25]} s={[0.5, 0.08, 0.5]} c="#2F3236" r={0.9} />
          <B p={[0, 0.78, d / 2 + 0.47]} s={[0.5, 0.6, 0.06]} c="#2F3236" r={0.9} />
        </>
      )
    case 'counter':
      return (
        <>
          <B p={[0, 0.43, 0]} s={[w, 0.86, d]} c={c} r={0.5} />
          <B p={[0, 0.88, 0.01]} s={[w + 0.02, 0.04, d + 0.03]} c="#2F3133" r={0.25} />
          <B p={[0, 1.85, -d / 2 + 0.18]} s={[w, 0.7, 0.35]} c={c} r={0.5} />
          <B p={[-w * 0.2, 0.905, 0]} s={[0.6, 0.01, 0.45]} c="#9DA1A6" m={0.8} r={0.25} />
          <B p={[w * 0.2, 0.91, 0]} s={[0.55, 0.02, 0.45]} c="#151618" r={0.2} />
        </>
      )
    case 'island':
      return (
        <>
          <B p={[0, 0.43, 0]} s={[w, 0.86, d]} c={c} r={0.4} />
          <B p={[0, 0.89, 0]} s={[w + 0.1, 0.04, d + 0.1]} c="#E8E5DF" r={0.2} />
          {[-0.5, 0, 0.5].map((x) => (
            <Cyl key={x} p={[x, 0.33, d / 2 + 0.35]} r={0.18} h={0.66} c="#3A3530" />
          ))}
        </>
      )
    case 'fridge':
    case 'oven':
    case 'washer':
      return (
        <>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.3} m={kind === 'fridge' ? 0.5 : 0.2} />
          <B p={[0, h * 0.6, d / 2 + 0.005]} s={[w - 0.04, 0.005, 0.005]} c={dark} />
          {kind === 'washer' && [-w / 4, w / 4].map((x) => <Cyl key={x} p={[x, h * 0.45, d / 2 + 0.01]} r={0.2} h={0.02} c="#9AA4AA" />)}
        </>
      )
    case 'bathtub':
      return (
        <>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.2} />
          <B p={[0, h - 0.04, 0]} s={[w - 0.16, 0.06, d - 0.16]} c="#BFD3DB" r={0.05} />
        </>
      )
    case 'shower':
      return (
        <>
          <B p={[0, 0.03, 0]} s={[w, 0.06, d]} c="#E6E6E3" r={0.3} />
          <mesh position={[0, 1.0, d / 2]} material={flatMaterial('#BFD3DB', 0.05, 0.1, { transparent: true, opacity: 0.3 })}>
            <boxGeometry args={[w, 2, 0.01]} />
          </mesh>
          <Cyl p={[0, 2.0, -d / 2 + 0.2]} r={0.1} h={0.02} c="#A9ADB2" metal={0.8} />
        </>
      )
    case 'toilet':
      return (
        <>
          <B p={[0, 0.2, 0.05]} s={[0.38, 0.4, 0.5]} c={c} r={0.15} />
          <B p={[0, 0.42, 0.07]} s={[0.4, 0.04, 0.48]} c={c} r={0.15} />
          <B p={[0, 0.6, -0.27]} s={[0.4, 0.4, 0.16]} c={c} r={0.15} />
        </>
      )
    case 'basin':
      return (
        <>
          <B p={[0, 0.42, 0]} s={[w, 0.5, d]} c={shade(c, -0.4)} r={0.5} />
          <B p={[0, 0.82, 0.02]} s={[w * 0.6, 0.14, d * 0.7]} c="#FFFFFF" r={0.1} />
          <B p={[0, 1.5, -d / 2 + 0.02]} s={[w * 0.8, 0.8, 0.02]} c="#C9D6DC" r={0.02} m={0.9} />
        </>
      )
    case 'curtain':
      return <B p={[0, h / 2, 0]} s={[w, h, 0.05]} c={c} r={1} />
    case 'lamp':
      return (
        <>
          <Cyl p={[0, h / 2, 0]} r={0.02} h={h} c="#2A2C2F" metal={0.6} />
          <Cyl p={[0, 0.02, 0]} r={0.16} h={0.04} c="#2A2C2F" />
          <mesh position={[0, h, 0]} material={flatMaterial(c, 0.5, 0, { emissive: new THREE.Color(night ? '#FFD7A0' : '#000000'), emissiveIntensity: 1.2 })}>
            <cylinderGeometry args={[0.12, 0.2, 0.25, 16]} />
          </mesh>
        </>
      )
    case 'chandelier':
      return null // rendered by the ceiling-light system (needs room ceiling height)
    case 'plant':
      return (
        <>
          <Cyl p={[0, 0.2, 0]} r={0.18} h={0.4} c="#3A3530" />
          <mesh position={[0, 0.85, 0]} castShadow material={flatMaterial(c, 0.9)}>
            <icosahedronGeometry args={[0.32, 0]} />
          </mesh>
          <mesh position={[0.08, 1.15, 0.05]} castShadow material={flatMaterial(shade(c, 0.08), 0.9)}>
            <icosahedronGeometry args={[0.22, 0]} />
          </mesh>
        </>
      )
    case 'outdoor-set':
      return (
        <>
          <B p={[0, 0.2, -0.4]} s={[w, 0.4, 0.8]} c={c} r={0.9} />
          <B p={[0, 0.5, -0.75]} s={[w, 0.5, 0.15]} c={c} r={0.9} />
          <B p={[0, 0.2, 0.45]} s={[0.9, 0.4, 0.5]} c="#4B4743" />
        </>
      )
    case 'car':
      return (
        <>
          <B p={[0, 0.5, 0]} s={[w, 0.6, d]} c={c} r={0.25} m={0.6} />
          <B p={[0, 1.05, -0.2]} s={[w - 0.2, 0.5, d * 0.5]} c="#1C2329" r={0.1} m={0.4} />
          {[-1, 1].map((sx) => [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.05), 0.33, sz * (d / 2 - 0.75)]} rotation={[0, 0, Math.PI / 2]} material={flatMaterial('#141516', 0.9)}>
              <cylinderGeometry args={[0.33, 0.33, 0.24, 18]} />
            </mesh>
          )))}
          {night && <B p={[0, 0.6, d / 2]} s={[w - 0.4, 0.08, 0.02]} c="#FFF" e="#FFF6E0" />}
        </>
      )
    case 'treadmill':
      return (
        <>
          <B p={[0, 0.12, 0]} s={[w, 0.24, d]} c={c} r={0.5} />
          <B p={[0, 0.9, -d / 2 + 0.1]} s={[w, 1.0, 0.08]} c={c} />
        </>
      )
    default:
      return <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} />
  }
}

export const FurnitureMesh = memo(function FurnitureMesh({ item, night, selected }: { item: FurnitureItem; night: boolean; selected?: boolean }) {
  const def = furnitureDef(item.kind)
  if (!def) return null
  const [w, h, d] = def.size
  const c = item.color ?? def.color
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rot, 0]} scale={item.scale}>
      {shape(item.kind, { w, h, d, c }, night)}
      {selected && (
        <mesh position={[0, h / 2 + 0.02, 0]}>
          <boxGeometry args={[w + 0.08, h + 0.08, d + 0.08]} />
          <meshBasicMaterial color="#C9A96E" wireframe transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  )
})
