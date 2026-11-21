import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'

/**
 * Presents an uploaded GLB/GLTF model of a completed project (exported from
 * Blender, SketchUp, Revit, etc.). Uploaded through Admin → 3D models.
 */
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url, false, false)
  scene.traverse((o) => {
    o.castShadow = true
    o.receiveShadow = true
  })
  return <primitive object={scene} />
}

export default function GlbViewer({ url, night, className }: { url: string; night?: boolean; className?: string }) {
  return (
    <div className={className}>
      <Canvas shadows camera={{ position: [20, 14, 24], fov: 38 }} gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={[night ? '#070B14' : '#BFD3E2']} />
        <hemisphereLight args={['#EAF2FF', '#6B6450', night ? 0.15 : 0.8]} />
        <directionalLight position={[15, 25, 18]} intensity={night ? 0.2 : 2.4} castShadow />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2} position={[5, 5, 5]} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={1} position={[-6, 3, -4]} scale={[4, 6, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <Model url={url} />
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.02} />
      </Canvas>
    </div>
  )
}
