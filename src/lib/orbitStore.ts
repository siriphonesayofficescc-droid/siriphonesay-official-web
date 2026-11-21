import { useSyncExternalStore } from 'react'

/**
 * Tiny shared store linking the 3D orbit with the DOM (legend, sections).
 * hovered: id of the node currently highlighted ("p:slug" or "s:slug").
 */
type State = { hovered: string | null; ready: boolean }

let state: State = { hovered: null, ready: false }
const listeners = new Set<() => void>()

export const orbitStore = {
  get: () => state,
  set(patch: Partial<State>) {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function useOrbit<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(orbitStore.subscribe, () => selector(orbitStore.get()))
}
