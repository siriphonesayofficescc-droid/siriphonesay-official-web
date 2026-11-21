export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch {
    return false
  }
}

export const isMobileDevice = () =>
  window.matchMedia('(max-width: 767px)').matches || window.matchMedia('(pointer: coarse)').matches

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Rough GPU budget: low on small screens, few cores or data-saver */
export function performanceTier(): 'high' | 'low' {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  if (isMobileDevice()) return 'low'
  if ((nav.hardwareConcurrency ?? 8) <= 4) return 'low'
  if ((nav.deviceMemory ?? 8) <= 4) return 'low'
  if (nav.connection?.saveData) return 'low'
  return 'high'
}
