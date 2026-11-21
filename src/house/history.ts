import { useCallback, useEffect, useRef, useState } from 'react'
import type { Design } from './types'

/**
 * Undo / redo for the design. Changes made within ~0.6 s are merged into one step
 * (so dragging a slider is a single undo). Derived updates (auto-furnishing after a
 * layout change, comparison previews) are applied "silently" and never break the redo chain.
 */
export function useDesignHistory(initial: () => Design) {
  const [d, setDRaw] = useState<Design>(initial)
  const past = useRef<Design[]>([])
  const future = useRef<Design[]>([])
  const committed = useRef<Design>(d)
  const silent = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, bump] = useState(0)

  const commit = useCallback((cur: Design) => {
    if (cur === committed.current) return
    past.current = [...past.current.slice(-79), committed.current]
    future.current = []
    committed.current = cur
    bump((n) => n + 1)
  }, [])

  useEffect(() => {
    if (silent.current) {
      silent.current = false
      committed.current = d
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(d), 600)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [d, commit])

  const setD = setDRaw
  /** apply a change that should not be recorded as a user step */
  const setSilent = useCallback((u: Design | ((p: Design) => Design)) => {
    silent.current = true
    setDRaw(u)
  }, [])

  const curRef = useRef(d)
  curRef.current = d
  const undo = useCallback(() => {
    const cur = curRef.current
    if (timer.current) clearTimeout(timer.current)
    if (cur !== committed.current) {
      past.current = [...past.current, committed.current]
      committed.current = cur
    }
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(committed.current)
    committed.current = prev
    silent.current = true
    setDRaw(prev)
    bump((n) => n + 1)
  }, [])
  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    if (timer.current) clearTimeout(timer.current)
    past.current.push(committed.current)
    committed.current = next
    silent.current = true
    setDRaw(next)
    bump((n) => n + 1)
  }, [])
  /** replace the design and start a fresh history (new project / restore) */
  const load = useCallback((next: Design) => {
    past.current.push(committed.current)
    future.current = []
    committed.current = next
    silent.current = true
    setDRaw(next)
    bump((n) => n + 1)
  }, [])

  return { d, setD, setSilent, undo, redo, load, canUndo: past.current.length > 0 || d !== committed.current, canRedo: future.current.length > 0 }
}
