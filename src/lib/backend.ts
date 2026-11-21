import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { DEFAULT_RATES, ratesStore, type Rates } from '../house/estimate'

/**
 * Optional Supabase backend (auth, database, storage).
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable accounts,
 * cloud-saved designs, quotation tracking and the admin dashboard.
 * Without them the site runs in "local mode": designs are kept in the
 * visitor's browser and quotation requests are sent by email/form endpoint.
 * Database schema & security policies: supabase/schema.sql
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const backendEnabled = !!supabase

export type Role = 'customer' | 'md' | 'admin' | 'architect' | 'engineer' | 'qs' | 'sales'
export const STAFF_ROLES: Role[] = ['md', 'admin', 'architect', 'engineer', 'qs', 'sales']
export const RATE_EDITORS: Role[] = ['md', 'admin', 'qs']
export const ROLE_LABEL: Record<Role, string> = {
  customer: 'Customer',
  md: 'Managing Director',
  admin: 'Administrator',
  architect: 'Architect / Designer',
  engineer: 'Engineer',
  qs: 'Quantity Surveyor / Estimator',
  sales: 'Sales & Marketing',
}

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  role: Role
}

/* ── auth state ───────────────────────────────────────────────── */
type AuthState = { user: User | null; profile: Profile | null; loading: boolean }
let auth: AuthState = { user: null, profile: null, loading: !!supabase }
const subs = new Set<() => void>()
const setAuth = (p: Partial<AuthState>) => {
  auth = { ...auth, ...p }
  subs.forEach((s) => s())
}

async function loadProfile(user: User | null) {
  if (!supabase || !user) return setAuth({ user, profile: null, loading: false })
  const { data } = await supabase.from('profiles').select('id, full_name, phone, role').eq('id', user.id).maybeSingle()
  setAuth({ user, profile: (data as Profile) ?? { id: user.id, full_name: null, phone: null, role: 'customer' }, loading: false })
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => loadProfile(data.session?.user ?? null))
  supabase.auth.onAuthStateChange((_e, session) => loadProfile(session?.user ?? null))
  // company rates from the database override local defaults
  supabase
    .from('settings')
    .select('value')
    .eq('key', 'rates')
    .maybeSingle()
    .then(({ data }) => {
      if (data?.value) ratesStore.set({ ...DEFAULT_RATES, ...(data.value as Partial<Rates>) }, false)
    })
}

export const useAuth = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => auth,
  )

export const isStaff = (p: Profile | null) => !!p && STAFF_ROLES.includes(p.role)

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Accounts are not enabled yet.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}
export async function signUp(email: string, password: string, fullName: string, phone: string) {
  if (!supabase) throw new Error('Accounts are not enabled yet.')
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone } } })
  if (error) throw error
}
export async function signOut() {
  await supabase?.auth.signOut()
}

export async function saveRatesRemote(r: Rates) {
  if (!supabase) return ratesStore.set(r)
  const { error } = await supabase.from('settings').upsert({ key: 'rates', value: { ...r, updatedAt: new Date().toISOString() } })
  if (error) throw error
  ratesStore.set(r, false)
}

/** Small hook for one-off async loads */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  useEffect(() => {
    let live = true
    setState({ loading: true })
    fn()
      .then((data) => live && setState({ data, loading: false }))
      .catch((e: Error) => live && setState({ error: e.message, loading: false }))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
