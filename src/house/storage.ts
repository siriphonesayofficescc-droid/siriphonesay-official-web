import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/backend'
import { company } from '../content/company'
import { FORM_ENDPOINT } from '../config/site'
import { estimateDesign, money } from './estimate'
import { newRef } from './defaults'
import { floorMaterials, frameMaterials, furnitureDef, roofMaterials, roomSpec, styles, wallMaterials } from './catalog'
import { generateLayout } from './layout'
import type { Design } from './types'

/**
 * Design persistence:
 *  - local: browser localStorage (always available)
 *  - cloud: Supabase `designs` table when the visitor is signed in
 *  - share links: the whole design compressed into the URL (#d=…)
 */

const LS = 'scc.designs.v1'
const QS = 'scc.quotes.v1'

export interface SavedDesign {
  ref: string
  name: string
  style: string
  updatedAt: string
  data: Design
  thumb?: string
  cloudId?: string
  status?: string
}

let cache: SavedDesign[] = load()
const subs = new Set<() => void>()
function load(): SavedDesign[] {
  try {
    return JSON.parse(localStorage.getItem(LS) || '[]')
  } catch {
    return []
  }
}
function persist() {
  try {
    localStorage.setItem(LS, JSON.stringify(cache))
  } catch {
    // storage full — drop thumbnails and retry
    cache = cache.map((c) => ({ ...c, thumb: undefined }))
    try {
      localStorage.setItem(LS, JSON.stringify(cache))
    } catch {
      /* give up silently */
    }
  }
  subs.forEach((s) => s())
}

export const localDesigns = {
  list: () => cache,
  subscribe(cb: () => void) {
    subs.add(cb)
    return () => subs.delete(cb)
  },
  upsert(d: Design, thumb?: string) {
    const item: SavedDesign = { ref: d.ref, name: d.name, style: d.style, updatedAt: new Date().toISOString(), data: { ...d, updatedAt: new Date().toISOString() }, thumb: thumb ?? cache.find((c) => c.ref === d.ref)?.thumb }
    cache = [item, ...cache.filter((c) => c.ref !== d.ref)]
    persist()
    return item
  },
  remove(ref: string) {
    cache = cache.filter((c) => c.ref !== ref)
    persist()
  },
  duplicate(ref: string) {
    const src = cache.find((c) => c.ref === ref)
    if (!src) return null
    const d: Design = { ...structuredClone(src.data), ref: newRef(), name: `${src.name} (copy)`, createdAt: new Date().toISOString() }
    return this.upsert(d, src.thumb)
  },
  get: (ref: string) => cache.find((c) => c.ref === ref),
}
export const useLocalDesigns = () => useSyncExternalStore(localDesigns.subscribe, localDesigns.list)

/* ── cloud (Supabase) ─────────────────────────────────────────── */
export async function saveCloud(d: Design, userId: string, thumb?: string) {
  if (!supabase) return null
  const est = estimateDesign(d)
  const row = { ref: d.ref, owner: userId, name: d.name, style: d.style, data: d, estimate_usd: est.total, gfa: est.gfa, thumbnail: thumb ?? null, updated_at: new Date().toISOString() }
  const { data, error } = await supabase.from('designs').upsert(row, { onConflict: 'ref' }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function listCloud(userId: string): Promise<SavedDesign[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('designs').select('id, ref, name, style, data, thumbnail, updated_at, status').eq('owner', userId).order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({ ref: r.ref, name: r.name, style: r.style, updatedAt: r.updated_at, data: r.data as Design, thumb: r.thumbnail ?? undefined, cloudId: r.id, status: r.status }))
}

export async function deleteCloud(ref: string) {
  if (!supabase) return
  const { error } = await supabase.from('designs').delete().eq('ref', ref)
  if (error) throw error
}

/* ── share links ──────────────────────────────────────────────── */
export function shareUrl(d: Design) {
  const slim = { ...d, furniture: d.furniture.filter((f) => !f.auto) }
  const enc = compressToEncodedURIComponent(JSON.stringify(slim))
  return `${window.location.origin}/design-your-house#d=${enc}`
}
export function designFromHash(hash: string): Design | null {
  const m = hash.match(/d=([^&]+)/)
  if (!m) return null
  try {
    const json = decompressFromEncodedURIComponent(m[1])
    return json ? (JSON.parse(json) as Design) : null
  } catch {
    return null
  }
}

/* ── quotation requests ───────────────────────────────────────── */
export interface QuoteRequest {
  name: string
  email: string
  phone: string
  location: string
  budget: string
  timeline: string
  message: string
}

export interface LocalQuote extends QuoteRequest {
  ref: string
  designRef: string
  designName: string
  estimateUsd: number
  createdAt: string
  status: 'Submitted' | 'Under review' | 'Quoted' | 'Closed'
  channel: 'database' | 'form' | 'email'
  /** full specification text (rooms, materials, furniture, budget) */
  specs?: string
  /** small 3D screenshots (JPEG data URLs) */
  images?: string[]
  design?: Design
}

export const localQuotes = {
  list(): LocalQuote[] {
    try {
      return JSON.parse(localStorage.getItem(QS) || '[]')
    } catch {
      return []
    }
  },
  add(q: LocalQuote) {
    try {
      localStorage.setItem(QS, JSON.stringify([q, ...this.list()].slice(0, 30)))
    } catch {
      // storage full: keep the request without screenshots
      try {
        localStorage.setItem(QS, JSON.stringify([{ ...q, images: [] }, ...this.list().map((x) => ({ ...x, images: [] }))].slice(0, 30)))
      } catch {
        /* ignore */
      }
    }
  },
}

/** Human-readable specification sent to the company with every quotation request */
export function designSpecs(d: Design): string {
  const layout = generateLayout(d)
  const est = estimateDesign(d, undefined, layout)
  const name = (list: { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id
  const rooms = Array.from({ length: d.floors }, (_, f) => {
    const list = d.rooms.filter((r) => r.floor === f && r.qty > 0).map((r) => `${r.qty}× ${roomSpec(r.type)?.label ?? r.type}`)
    return `  Floor ${f + 1}: ${list.join(', ') || '—'}`
  })
  const furn = new Map<string, number>()
  d.furniture.forEach((it) => furn.set(it.kind, (furn.get(it.kind) ?? 0) + 1))
  return [
    `Design ${d.ref} — ${d.name} (${styles.find((s) => s.id === d.style)?.label ?? d.style})`,
    `Land ${d.land.w} × ${d.land.l} m · building ${d.building.w} × ${d.building.l} m · ${d.floors} floor(s) · ceiling ${d.ceiling} m`,
    `Total floor area ${est.gfa.toFixed(0)} m² · finish level ${d.finish}`,
    `Roof: ${d.roof.type}${d.roof.type !== 'flat' ? ` ${d.roof.pitch}°` : ''}, overhang ${d.roof.overhang} m · floor plan No. ${d.planSeed ?? 1} (${layout.variant})`,
    'Rooms:',
    ...rooms,
    `Parking ${d.parking} · balcony ${d.balcony.enabled ? `${d.balcony.depth} m` : 'no'} · terrace ${d.terrace.enabled ? 'yes' : 'no'} · garden ${d.extras.garden ? `yes (${d.extras.trees} trees)` : 'no'} · pool ${d.extras.pool ? `${d.extras.poolSize[0]} × ${d.extras.poolSize[1]} m` : 'no'}`,
    `Exterior: walls ${name(wallMaterials, d.exterior.wall)}${d.exterior.wallColor ? ` ${d.exterior.wallColor}` : ''}, accent ${name(wallMaterials, d.exterior.accent)}, roof ${name(roofMaterials, d.exterior.roof)}, frames ${name(frameMaterials, d.exterior.frame)}, glass ${d.exterior.glass}, door ${d.exterior.door}, fence ${d.exterior.fence}, gate ${d.exterior.gate}, lighting ${d.exterior.lights ? 'yes' : 'no'}`,
    `Interior: theme ${d.interior.theme}, living ${name(floorMaterials, d.interior.floorLiving)}, bedrooms ${name(floorMaterials, d.interior.floorBed)}, wet areas ${name(floorMaterials, d.interior.floorWet)}, feature wall ${d.interior.featureWall}, ceiling ${d.interior.ceiling}, stair ${d.interior.stairFinish}/${d.interior.handrail}, doors ${d.interior.doorFinish}, lights ${d.interior.lighting}, walls ${d.interior.wallColor}`,
    `Furniture (${d.furniture.length}): ${[...furn].map(([k, n]) => `${n}× ${furnitureDef(k)?.label ?? k}`).join(', ')}`,
    ...(d.aiModelUrl ? [`AI 3D model from the customer's photo (look only): ${d.aiModelUrl}`] : []),
    `Preliminary budget: ${money(est.total, 'USD')} — house ${money(est.houseTotal, 'USD')} (${money(est.perM2, 'USD')}/m²) + site, outdoor & furniture ${money(est.extrasTotal, 'USD')}`,
  ].join('\n')
}

export async function submitQuotation(d: Design, q: QuoteRequest, userId?: string, images: string[] = []): Promise<LocalQuote> {
  const est = estimateDesign(d)
  const link = shareUrl(d)
  const ref = `Q-${d.ref.slice(4)}`
  const specs = designSpecs(d)
  const base: LocalQuote = { ...q, ref, designRef: d.ref, designName: d.name, estimateUsd: est.total, createdAt: new Date().toISOString(), status: 'Submitted', channel: 'email', specs, images, design: d }
  if (supabase) {
    let designId: string | null = null
    if (userId) designId = await saveCloud(d, userId).catch(() => null)
    const { error } = await supabase.from('quotation_requests').insert({
      ref, design_ref: d.ref, design_id: designId, customer_id: userId ?? null, name: q.name, email: q.email, phone: q.phone, location: q.location,
      budget: q.budget, timeline: q.timeline, message: q.message, design: d, estimate_usd: est.total, share_link: link, status: 'Submitted', specs, images,
    })
    if (error) throw error
    const out = { ...base, channel: 'database' as const }
    localQuotes.add(out)
    return out
  }
  const summary = [
    `Quotation request ${ref} — design ${d.ref} "${d.name}"`,
    `Name: ${q.name} · Email: ${q.email} · Phone/WhatsApp: ${q.phone}`,
    `Site location: ${q.location} · Budget: ${q.budget} · Timeline: ${q.timeline}`,
    `House: ${d.floors} floor(s), building ${d.building.w}×${d.building.l} m on land ${d.land.w}×${d.land.l} m, GFA ${est.gfa.toFixed(0)} m²`,
    `Message: ${q.message}`,
    '',
    specs,
    '',
    `Preliminary estimate: ${money(est.total, 'USD')} (${money(est.total, 'LAK')}) — indicative only`,
    `Open the 3D design: ${link}`,
  ].join('\n')
  if (FORM_ENDPOINT) {
    const res = await fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...q, enquiryType: 'Design quotation', designRef: d.ref, message: summary }) })
    if (!res.ok) throw new Error('Could not send the request.')
    const out = { ...base, channel: 'form' as const }
    localQuotes.add(out)
    return out
  }
  window.location.href = `mailto:${company.contact.email}?subject=${encodeURIComponent(`Quotation request ${ref} — ${d.name}`)}&body=${encodeURIComponent(summary)}`
  localQuotes.add(base)
  return base
}
