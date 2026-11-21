import { useSyncExternalStore } from 'react'
import type { Design } from './types'

/** Saved versions of one project (kept in this browser, per project reference) */
export interface DesignVersion {
  id: string
  name: string
  at: string
  design: Design
  thumb?: string
}

const KEY = (ref: string) => `scc.versions.${ref}`
const listeners = new Set<() => void>()
const cache = new Map<string, DesignVersion[]>()
const EMPTY: DesignVersion[] = []

function read(ref: string): DesignVersion[] {
  if (cache.has(ref)) return cache.get(ref)!
  let v: DesignVersion[] = EMPTY
  try {
    v = JSON.parse(localStorage.getItem(KEY(ref)) || '[]')
  } catch {
    v = EMPTY
  }
  cache.set(ref, v)
  return v
}
function write(ref: string, list: DesignVersion[]) {
  cache.set(ref, list)
  // keep storage bounded: drop thumbnails from older versions if needed
  for (let keep = list.length; keep >= 0; keep--) {
    try {
      localStorage.setItem(KEY(ref), JSON.stringify(list.map((x, i) => (i < keep ? x : { ...x, thumb: undefined }))))
      break
    } catch {
      /* quota — retry with fewer thumbnails */
    }
  }
  listeners.forEach((l) => l())
}

export const versions = {
  list: read,
  add(ref: string, name: string, design: Design, thumb?: string) {
    const v: DesignVersion = { id: `v${Date.now().toString(36)}`, name: name.trim() || `Version ${read(ref).length + 1}`, at: new Date().toISOString(), design: structuredClone(design), thumb }
    write(ref, [v, ...read(ref)].slice(0, 20))
    return v
  },
  rename(ref: string, id: string, name: string) {
    write(ref, read(ref).map((v) => (v.id === id ? { ...v, name } : v)))
  },
  remove(ref: string, id: string) {
    write(ref, read(ref).filter((v) => v.id !== id))
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export const useVersions = (ref: string) => useSyncExternalStore(versions.subscribe, () => read(ref))
