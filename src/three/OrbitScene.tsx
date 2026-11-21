import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Billboard, Environment, Html, Lightformer, Line, useTexture } from '@react-three/drei'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { projects } from '../content/projects'
import { services } from '../content/services'
import { orbitStore, useOrbit } from '../lib/orbitStore'

/* ───────────────────────── constants ───────────────────────── */
const GOLD = new THREE.Color('#C9A96E')
const GOLD_LIGHT = new THREE.Color('#E4D2A6')
const STEEL = new THREE.Color('#8B9099')
const SERVICE_R = 2.65
const PROJECT_R = 4.15
const SPHERE_R = 1.55

const damp = THREE.MathUtils.damp
const clamp = THREE.MathUtils.clamp

export interface OrbitSceneProps {
  active: boolean
  tier: 'high' | 'low'
  mobile: boolean
  reducedMotion: boolean
}

/* Shared scroll / pointer state read inside useFrame (no React re-renders) */
const input = { px: 0, py: 0 }
/** The cinematic intro plays once per visit; returning to Home restores the orbit instantly */
let introPlayed = false

function useScrollState() {
  let contact: HTMLElement | null = null
  return () => {
    const vh = window.innerHeight
    const heroP = clamp(window.scrollY / vh, 0, 1.4)
    if (!contact || !contact.isConnected) contact = document.getElementById('contact')
    const top = contact ? contact.getBoundingClientRect().top : vh * 10
    const closeP = 1 - clamp(top / vh, 0, 1)
    return { heroP, closeP }
  }
}

/* ───────────────────────── core sphere ───────────────────────── */
const fresnelVert = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position,1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`
const fresnelFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uPower; uniform float uIntensity;
  varying vec3 vN; varying vec3 vV;
  void main(){
    float f = pow(1.0 - max(dot(vN, vV), 0.0), uPower);
    gl_FragColor = vec4(uColor * f * uIntensity, f * uIntensity);
  }`

function Core({ reducedMotion }: { reducedMotion: boolean }) {
  const lattice = useRef<THREE.Group>(null)
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(SPHERE_R * 1.04, 2)), [])
  const vertices = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(SPHERE_R * 1.04, 1)
    const pos = g.attributes.position
    const seen = new Map<string, THREE.Vector3>()
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i)
      seen.set(v.toArray().map((n) => n.toFixed(3)).join(','), v)
    }
    return [...seen.values()]
  }, [])
  const vertexMesh = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4()
    vertices.forEach((v, i) => vertexMesh.current?.setMatrixAt(i, m.makeTranslation(v.x, v.y, v.z)))
    if (vertexMesh.current) vertexMesh.current.instanceMatrix.needsUpdate = true
  }, [vertices])

  // survey-globe latitude / meridian lines
  const latLines = useMemo(
    () =>
      [-60, -30, 0, 30, 60].map((lat) => {
        const r = SPHERE_R * 1.12 * Math.cos((lat * Math.PI) / 180)
        const y = SPHERE_R * 1.12 * Math.sin((lat * Math.PI) / 180)
        return Array.from({ length: 129 }, (_, i) => {
          const a = (i / 128) * Math.PI * 2
          return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
        })
      }),
    [],
  )
  const meridians = useMemo(
    () =>
      [0, 30, 60, 90, 120, 150].map((lon) => {
        const a0 = (lon * Math.PI) / 180
        return Array.from({ length: 129 }, (_, i) => {
          const t = (i / 128) * Math.PI * 2
          const r = SPHERE_R * 1.12
          return new THREE.Vector3(Math.cos(t) * r * Math.cos(a0), Math.sin(t) * r, Math.cos(t) * r * Math.sin(a0))
        })
      }),
    [],
  )

  useFrame((_, dt) => {
    if (!lattice.current) return
    lattice.current.rotation.y += dt * (reducedMotion ? 0.02 : 0.06)
  })

  return (
    <group>
      {/* metallic engineered core */}
      <mesh>
        <sphereGeometry args={[SPHERE_R, 96, 96]} />
        <meshPhysicalMaterial color="#16171A" metalness={0.92} roughness={0.3} clearcoat={1} clearcoatRoughness={0.25} envMapIntensity={1.15} />
      </mesh>
      <group ref={lattice}>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={GOLD} transparent opacity={0.42} />
        </lineSegments>
        <instancedMesh ref={vertexMesh} args={[undefined, undefined, vertices.length]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color={GOLD_LIGHT} toneMapped={false} />
        </instancedMesh>
      </group>
      {latLines.map((pts, i) => (
        <Line key={`lat${i}`} points={pts} color={STEEL} lineWidth={0.6} transparent opacity={i === 2 ? 0.55 : 0.22} />
      ))}
      {meridians.map((pts, i) => (
        <Line key={`mer${i}`} points={pts} color={STEEL} lineWidth={0.6} transparent opacity={0.18} />
      ))}
      {/* glass shell */}
      <mesh>
        <sphereGeometry args={[SPHERE_R * 1.22, 64, 64]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.05} roughness={0.05} metalness={0} clearcoat={1} depthWrite={false} />
      </mesh>
      {/* fresnel rim glow */}
      <mesh scale={1.24}>
        <sphereGeometry args={[SPHERE_R, 64, 64]} />
        <shaderMaterial
          vertexShader={fresnelVert}
          fragmentShader={fresnelFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{ uColor: { value: GOLD }, uPower: { value: 3.2 }, uIntensity: { value: 0.85 } }}
        />
      </mesh>
    </group>
  )
}

/* ───────────────────────── rings ───────────────────────── */
function TickRing({ radius, count, color, opacity }: { radius: number; count: number; color: THREE.Color; opacity: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const major = i % 10 === 0
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a)
      s.set(major ? 0.14 : 0.06, 0.004, 0.004)
      m.compose(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius), q, s)
      ref.current?.setMatrixAt(i, m)
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true
  }, [radius, count])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </instancedMesh>
  )
}

function RingTorus({ radius, opacity = 0.6, color = GOLD, thickness = 0.005 }: { radius: number; opacity?: number; color?: THREE.Color; thickness?: number }) {
  return (
    <mesh rotation-x={Math.PI / 2}>
      <torusGeometry args={[radius, thickness, 6, 360]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
    </mesh>
  )
}

function DashedRing({ radius }: { radius: number }) {
  const pts = useMemo(
    () => Array.from({ length: 257 }, (_, i) => {
      const a = (i / 256) * Math.PI * 2
      return new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)
    }),
    [radius],
  )
  return <Line points={pts} color={STEEL} lineWidth={0.8} dashed dashSize={0.08} gapSize={0.1} transparent opacity={0.4} />
}

/* ───────────────────────── service nodes ───────────────────────── */
function ServiceNode({ slug, title, index, angle, mobile }: { slug: string; title: string; index: string; angle: number; mobile: boolean }) {
  const id = `s:${slug}`
  const hovered = useOrbit((s) => s.hovered === id)
  const navigate = useNavigate()
  const outer = useRef<THREE.Mesh>(null)
  const grp = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (outer.current) {
      outer.current.rotation.y += dt * 0.8
      outer.current.rotation.x += dt * 0.4
    }
    if (grp.current) {
      const s = damp(grp.current.scale.x, hovered ? 1.7 : 1, 8, dt)
      grp.current.scale.setScalar(s)
    }
  })
  return (
    <group position={[Math.cos(angle) * SERVICE_R, 0, Math.sin(angle) * SERVICE_R]}>
      <group
        ref={grp}
        onPointerOver={(e) => {
          e.stopPropagation()
          orbitStore.set({ hovered: id })
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          if (orbitStore.get().hovered === id) orbitStore.set({ hovered: null })
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          document.body.style.cursor = ''
          navigate(`/services/${slug}`)
        }}
      >
        <mesh>
          <octahedronGeometry args={[0.085, 0]} />
          <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} emissive={GOLD} emissiveIntensity={hovered ? 0.6 : 0.15} />
        </mesh>
        <mesh ref={outer}>
          <octahedronGeometry args={[0.17, 0]} />
          <meshBasicMaterial color={GOLD_LIGHT} wireframe transparent opacity={hovered ? 0.9 : 0.35} />
        </mesh>
        {/* larger invisible hit area */}
        <mesh visible={false}>
          <sphereGeometry args={[mobile ? 0.4 : 0.26, 8, 8]} />
        </mesh>
      </group>
      {hovered && (
        <Html center position={[0, 0.42, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap border border-gold/40 bg-ink/85 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-mist backdrop-blur">
            <span className="text-gold">S{index}</span> · {title} <span className="text-gold">→</span>
          </div>
        </Html>
      )}
    </group>
  )
}

/* ───────────────────────── project nodes ───────────────────────── */
type OrbitProject = (typeof projects)[number]

function ProjectNode({ p, angle, texture }: { p: OrbitProject; angle: number; texture: THREE.Texture }) {
  const id = `p:${p.slug}`
  const hovered = useOrbit((s) => s.hovered === id)
  const navigate = useNavigate()
  const card = useRef<THREE.Group>(null)
  const frameMat = useRef<THREE.MeshBasicMaterial>(null)
  const x = Math.cos(angle) * PROJECT_R
  const z = Math.sin(angle) * PROJECT_R
  const inner = useMemo(
    () => [new THREE.Vector3(Math.cos(angle) * (SPHERE_R * 1.25), 0, Math.sin(angle) * (SPHERE_R * 1.25)), new THREE.Vector3(x * 0.93, 0, z * 0.93)],
    [angle, x, z],
  )
  useFrame((_, dt) => {
    if (card.current) card.current.scale.setScalar(damp(card.current.scale.x, hovered ? 1.35 : 1, 8, dt))
    if (frameMat.current) frameMat.current.opacity = damp(frameMat.current.opacity, hovered ? 1 : 0.55, 8, dt)
  })
  return (
    <group>
      <Line points={inner} color={GOLD} lineWidth={0.7} transparent opacity={hovered ? 0.8 : 0.18} dashed={!hovered} dashSize={0.06} gapSize={0.06} />
      <group position={[x, 0, z]}>
        <mesh>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshBasicMaterial color={GOLD_LIGHT} toneMapped={false} />
        </mesh>
        <Billboard position={[0, 0.48, 0]}>
          <group
            ref={card}
            onPointerOver={(e) => {
              e.stopPropagation()
              orbitStore.set({ hovered: id })
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              if (orbitStore.get().hovered === id) orbitStore.set({ hovered: null })
              document.body.style.cursor = ''
            }}
            onClick={(e) => {
              e.stopPropagation()
              document.body.style.cursor = ''
              navigate(`/projects/${p.slug}`)
            }}
          >
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[0.92, 0.5]} />
              <meshBasicMaterial ref={frameMat} color={GOLD} transparent opacity={0.55} toneMapped={false} />
            </mesh>
            <mesh>
              <planeGeometry args={[0.89, 0.47]} />
              <meshBasicMaterial map={texture} toneMapped={false} />
            </mesh>
          </group>
          {hovered && (
            <Html center position={[0, -0.5, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div className="w-56 border border-gold/40 bg-ink/90 px-3 py-2 text-left backdrop-blur">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Project · {p.status}</div>
                <div className="mt-1 font-display text-sm font-semibold leading-tight text-mist">{p.title}</div>
                <div className="mt-1 text-[11px] text-steel-light">{p.location}</div>
              </div>
            </Html>
          )}
        </Billboard>
      </group>
    </group>
  )
}

function ProjectRing({ mobile, reducedMotion }: { mobile: boolean; reducedMotion: boolean }) {
  const list = useMemo(() => projects.filter((p) => p.featuredInOrbit).slice(0, mobile ? 6 : 11), [mobile])
  const textures = useTexture(list.map((p) => p.image))
  useEffect(() => {
    const planeAspect = 0.89 / 0.47
    textures.forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      // "object-fit: cover" so portrait photos are cropped, not stretched
      const img = t.image as { width: number; height: number } | undefined
      if (img?.width && img?.height) {
        const imgAspect = img.width / img.height
        if (imgAspect < planeAspect) {
          t.repeat.set(1, imgAspect / planeAspect)
          t.offset.set(0, (1 - t.repeat.y) / 2)
        } else {
          t.repeat.set(planeAspect / imgAspect, 1)
          t.offset.set((1 - t.repeat.x) / 2, 0)
        }
        t.needsUpdate = true
      }
    })
  }, [textures])
  const ring = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const paused = orbitStore.get().hovered?.startsWith('p:')
    if (ring.current && !paused) ring.current.rotation.y += dt * (reducedMotion ? 0.01 : 0.045)
  })
  return (
    <group ref={ring}>
      {list.map((p, i) => (
        <ProjectNode key={p.slug} p={p} angle={(i / list.length) * Math.PI * 2} texture={textures[i]} />
      ))}
    </group>
  )
}

/* ───────────────────────── geometric fragments ───────────────────────── */
function Fragments({ count }: { count: number }) {
  const items = useMemo(() => {
    const geos = [
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.35, 0.35, 0.35)),
      new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(0.28)),
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.08, 0.08)), // beam
      new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.22)),
    ]
    const rnd = mulberry32(7)
    return Array.from({ length: count }, (_, i) => {
      const a = rnd() * Math.PI * 2
      const r = 6.4 + rnd() * 3
      return {
        geo: geos[i % geos.length],
        pos: new THREE.Vector3(Math.cos(a) * r, (rnd() - 0.5) * 5, Math.sin(a) * r - 1),
        spin: 0.1 + rnd() * 0.25,
        phase: rnd() * 10,
      }
    })
  }, [count])
  const refs = useRef<(THREE.LineSegments | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const it = items[i]
      m.rotation.set(t * it.spin, t * it.spin * 0.7, 0)
      m.position.y = it.pos.y + Math.sin(t * 0.4 + it.phase) * 0.15
    })
  })
  return (
    <group>
      {items.map((it, i) => (
        <lineSegments key={i} ref={(el) => { refs.current[i] = el }} geometry={it.geo} position={it.pos}>
          <lineBasicMaterial color={i % 3 === 0 ? GOLD : STEEL} transparent opacity={0.16} />
        </lineSegments>
      ))}
    </group>
  )
}

function Dust({ count }: { count: number }) {
  const geo = useMemo(() => {
    const rnd = mulberry32(3)
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 3 + rnd() * 10
      const th = rnd() * Math.PI * 2
      const ph = Math.acos(2 * rnd() - 1)
      arr.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th)], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return g
  }, [count])
  const ref = useRef<THREE.Points>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.01
  })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={GOLD_LIGHT} size={0.02} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
    </points>
  )
}

function SurveyGrid() {
  return (
    <gridHelper args={[40, 80, '#3a3c41', '#1d1e21']} position={[0, -3.4, 0]}>
      <meshBasicMaterial attach="material" transparent opacity={0.5} />
    </gridHelper>
  )
}

/* ───────────────────────── rig: intro, scroll, pointer ───────────────────────── */
function Rig({ mobile, reducedMotion }: { mobile: boolean; reducedMotion: boolean }) {
  const world = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const ringA = useRef<THREE.Group>(null)
  const ringB = useRef<THREE.Group>(null)
  const ringC = useRef<THREE.Group>(null)
  const ringD = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const readScroll = useScrollState()
  const start = useRef<number | null>(null)

  const base = useMemo(
    () => ({
      a: new THREE.Euler(1.05, 0, -0.35),
      b: new THREE.Euler(0.16, 0, -0.08),
      c: new THREE.Euler(-0.85, 0, 0.55),
      d: new THREE.Euler(0.4, 0, 0.9),
    }),
    [],
  )

  useFrame(({ clock }, dt) => {
    if (start.current === null) start.current = clock.elapsedTime - (introPlayed ? 10 : 0)
    const t = clock.elapsedTime - start.current
    if (t > 3) introPlayed = true
    const intro = reducedMotion ? 1 : easeOutCubic(clamp(t / 2.8, 0, 1))
    const { heroP, closeP } = readScroll()

    // camera: cinematic dolly-in, then scroll dolly
    const camZ = THREE.MathUtils.lerp(24, mobile ? 14.5 : 12, intro) + heroP * 2.5 - closeP * 1.2
    const camY = THREE.MathUtils.lerp(4, 0.6, intro) + heroP * 1.2
    camera.position.z = damp(camera.position.z, camZ, 4, dt)
    camera.position.y = damp(camera.position.y, camY, 4, dt)
    camera.position.x = damp(camera.position.x, input.px * 0.6, 2, dt)
    camera.lookAt(0, 0, 0)

    if (world.current) {
      // hero: sphere right of headline · scroll: drift away · closing: re-centre
      const hx = mobile ? 0 : 3.5
      const hy = mobile ? 2.3 : 0
      const x = THREE.MathUtils.lerp(hx + heroP * 1.8, mobile ? 0 : 3.3, closeP)
      const y = THREE.MathUtils.lerp(hy + heroP * 1.2, mobile ? 2.3 : 0.1, closeP)
      const s = (mobile ? 0.5 : 0.92) * THREE.MathUtils.lerp(0.55, 1, intro) * (1 - closeP * 0.1)
      world.current.position.x = damp(world.current.position.x, x, 3, dt)
      world.current.position.y = damp(world.current.position.y, y, 3, dt)
      world.current.scale.setScalar(damp(world.current.scale.x, s, 3, dt))
      world.current.rotation.y = damp(world.current.rotation.y, heroP * 0.9 + closeP * 0.5 + (1 - intro) * -1.2, 3, dt)
    }
    if (tilt.current) {
      tilt.current.rotation.x = damp(tilt.current.rotation.x, input.py * 0.18, 3, dt)
      tilt.current.rotation.z = damp(tilt.current.rotation.z, -input.px * 0.12, 3, dt)
    }
    // rings unfold on intro and flatten into a blueprint plane on closing
    const unfold = (r: THREE.Group | null, e: THREE.Euler, delay: number, spin: number) => {
      if (!r) return
      const k = reducedMotion ? 1 : easeOutCubic(clamp((t - delay) / 1.6, 0, 1))
      const flat = 1 - closeP * 0.85
      r.rotation.x = e.x * flat
      r.rotation.z = e.z * flat
      r.scale.setScalar(THREE.MathUtils.lerp(0.001, 1, k))
      r.children[0].rotation.y += dt * spin * (reducedMotion ? 0.3 : 1)
    }
    unfold(ringA.current, base.a, 0.5, 0.08)
    unfold(ringB.current, base.b, 0.8, 0)
    unfold(ringC.current, base.c, 1.0, -0.05)
    unfold(ringD.current, base.d, 1.2, 0.03)
  })

  return (
    <group ref={world}>
      <group ref={tilt}>
        <Core reducedMotion={reducedMotion} />
        {/* Ring A — services */}
        <group ref={ringA}>
          <group>
            <RingTorus radius={SERVICE_R} opacity={0.7} />
            <TickRing radius={SERVICE_R} count={120} color={GOLD} opacity={0.5} />
            {services.map((s, i) => (
              <ServiceNode key={s.slug} slug={s.slug} title={s.title} index={s.index} angle={(i / services.length) * Math.PI * 2} mobile={mobile} />
            ))}
          </group>
        </group>
        {/* Ring B — projects */}
        <group ref={ringB}>
          <group>
            <RingTorus radius={PROJECT_R} opacity={0.35} color={STEEL} thickness={0.004} />
            <TickRing radius={PROJECT_R} count={mobile ? 90 : 180} color={STEEL} opacity={0.35} />
            <Suspense fallback={null}>
              <ProjectRing mobile={mobile} reducedMotion={reducedMotion} />
            </Suspense>
          </group>
        </group>
        {/* Ring C / D — decorative */}
        <group ref={ringC}>
          <group>
            <DashedRing radius={3.3} />
          </group>
        </group>
        <group ref={ringD}>
          <group>
            <RingTorus radius={5.3} opacity={0.14} color={GOLD} thickness={0.003} />
          </group>
        </group>
      </group>
      {!mobile && <Fragments count={9} />}
    </group>
  )
}

/* ───────────────────────── canvas ───────────────────────── */
export default function OrbitScene({ active, tier, mobile, reducedMotion }: OrbitSceneProps) {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      input.px = (e.clientX / window.innerWidth) * 2 - 1
      input.py = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <Canvas
      dpr={tier === 'high' ? [1, 2] : [1, 1.5]}
      camera={{ position: [0, 4, 24], fov: 34, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop={active ? 'always' : 'never'}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        orbitStore.set({ ready: true })
      }}
      onPointerMissed={() => orbitStore.set({ hovered: null })}
      aria-hidden
    >
      <fog attach="fog" args={['#0A0A0B', 11, 30]} />
      <ambientLight intensity={0.12} />
      <directionalLight position={[6, 7, 5]} intensity={1.8} color="#FFF1D6" />
      <pointLight position={[-6, -2, -3]} intensity={40} color="#C9A96E" distance={20} />
      <Environment resolution={tier === 'high' ? 256 : 128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#FFF4E0" position={[4, 4, 3]} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#C9A96E" position={[-5, 1, -2]} scale={[3, 6, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[0, -4, 4]} scale={3} />
      </Environment>
      <Rig mobile={mobile} reducedMotion={reducedMotion} />
      <Dust count={tier === 'high' ? 700 : 220} />
      <SurveyGrid />
    </Canvas>
  )
}

/* ───────────────────────── utils ───────────────────────── */
function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3)
}
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
