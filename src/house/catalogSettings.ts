import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/backend'
import type { StyleId } from './types'

/** Admin-managed catalogue switches (which house templates are offered). */
export interface CatalogSettings {
  disabledStyles: StyleId[]
}
const LS = 'scc.catalog.v1'
let state: CatalogSettings = (() => {
  try {
    return { disabledStyles: [], ...JSON.parse(localStorage.getItem(LS) || '{}') }
  } catch {
    return { disabledStyles: [] }
  }
})()
const subs = new Set<() => void>()
export const catalogStore = {
  get: () => state,
  set(s: CatalogSettings, local = true) {
    state = s
    if (local) {
      try {
        localStorage.setItem(LS, JSON.stringify(s))
      } catch {
        /* ignore */
      }
    }
    subs.forEach((f) => f())
  },
  subscribe(cb: () => void) {
    subs.add(cb)
    return () => subs.delete(cb)
  },
}
export const useCatalogSettings = () => useSyncExternalStore(catalogStore.subscribe, catalogStore.get)

if (supabase) {
  supabase
    .from('settings')
    .select('value')
    .eq('key', 'catalog')
    .maybeSingle()
    .then(({ data }) => data?.value && catalogStore.set(Object.assign({ disabledStyles: [] }, data.value as CatalogSettings), false))
}

export async function saveCatalog(s: CatalogSettings) {
  if (supabase) {
    const { error } = await supabase.from('settings').upsert({ key: 'catalog', value: s })
    if (error) throw error
    catalogStore.set(s, false)
  } else catalogStore.set(s)
}
