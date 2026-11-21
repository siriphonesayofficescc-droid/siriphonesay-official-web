import { lazy, Suspense, useMemo } from 'react'
import { hasWebGL, isMobileDevice, performanceTier, prefersReducedMotion } from '../lib/device'
import OrbitFallback from './OrbitFallback'

const OrbitScene = lazy(() => import('./OrbitScene'))

/**
 * Fixed full-viewport stage behind the homepage. The WebGL scene is
 * code-split and lazy-loaded so text content paints first; rendering pauses
 * (frameloop "never") while the opaque middle sections cover it.
 */
export default function OrbitStage({ active }: { active: boolean }) {
  const env = useMemo(() => {
    if (typeof window === 'undefined') return null
    return {
      webgl: hasWebGL(),
      mobile: isMobileDevice(),
      tier: performanceTier(),
      reduced: prefersReducedMotion(),
    }
  }, [])

  return (
    <div className="pointer-events-auto fixed inset-0 z-0" style={{ visibility: active ? 'visible' : 'hidden' }}>
      {/* atmospheric backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,#1d1c1a_0%,#0e0e10_45%,#0A0A0B_75%)]" />
      <div className="bg-blueprint absolute inset-0 opacity-[0.35]" />
      {env?.webgl ? (
        <Suspense fallback={<OrbitFallback subtle />}>
          <OrbitScene active={active} tier={env.tier} mobile={env.mobile} reducedMotion={env.reduced} />
        </Suspense>
      ) : (
        <OrbitFallback />
      )}
    </div>
  )
}
