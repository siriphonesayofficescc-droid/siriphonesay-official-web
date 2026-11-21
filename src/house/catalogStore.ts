import { useMemo } from 'react'
import { company } from '../content/company'
import { FORM_ENDPOINT } from '../config/site'
import { houseCatalog, type CatalogHouse } from '../content/houseCatalog'
import { supabase, useAsync } from '../lib/backend'
import { money } from './estimate'
import { localQuotes, type LocalQuote, type QuoteRequest } from './storage'

/** Row in the Supabase table `house_catalog` (houses added through Admin) */
export interface CatalogRow {
  id: string
  code: string
  name: string
  name_lo: string | null
  tagline: string | null
  tagline_lo: string | null
  description: string | null
  description_lo: string | null
  floors: number
  gfa: number
  bedrooms: number
  bathrooms: number
  parking: number
  rooms: CatalogHouse['rooms'] | null
  features: string[] | null
  finish: CatalogHouse['finish']
  price_usd: number
  price_breakdown: string[] | null
  glb_url: string
  /** floor heights (m) when the model has an interior — enables Floor plans / Walk inside */
  levels: number[] | null
  poster_url: string | null
  published: boolean
  sort: number
}

export const rowToHouse = (r: CatalogRow): CatalogHouse => ({
  id: r.id,
  code: r.code,
  name: r.name,
  nameLo: r.name_lo || r.name,
  tagline: r.tagline ?? '',
  taglineLo: r.tagline_lo || r.tagline || '',
  description: r.description ?? '',
  descriptionLo: r.description_lo || r.description || '',
  floors: r.floors,
  gfa: r.gfa,
  bedrooms: r.bedrooms,
  bathrooms: r.bathrooms,
  parking: r.parking,
  rooms: r.rooms ?? [],
  features: r.features ?? [],
  finish: r.finish,
  priceUsd: r.price_usd,
  priceBreakdown: r.price_breakdown ?? undefined,
  glb: r.glb_url,
  levels: r.levels?.length ? r.levels.map((y, i) => levelName(i, r.levels!.length, y)) : undefined,
  poster: r.poster_url ?? '',
  published: r.published,
  remote: true,
})

const levelName = (i: number, total: number, y: number) =>
  i === 0
    ? { name: 'Ground floor', nameLo: 'ຊັ້ນລຸ່ມ', y }
    : total === 2
      ? { name: 'Upper floor', nameLo: 'ຊັ້ນເທິງ', y }
      : { name: `Floor ${i + 1}`, nameLo: `ຊັ້ນ ${i + 1}`, y }

/** Built-in catalogue + houses added through Admin (when Supabase is connected) */
export function useHouseCatalog(includeHidden = false) {
  const remote = useAsync(async () => {
    if (!supabase) return [] as CatalogRow[]
    let q = supabase.from('house_catalog').select('*').order('sort', { ascending: true })
    if (!includeHidden) q = q.eq('published', true)
    const { data } = await q
    return (data ?? []) as CatalogRow[]
  }, [includeHidden])
  const list = useMemo(() => [...houseCatalog.filter((h) => includeHidden || h.published), ...(remote.data ?? []).map(rowToHouse)], [remote.data, includeHidden])
  return { list, loading: remote.loading, reload: () => undefined }
}

export async function submitCatalogQuote(h: CatalogHouse, q: QuoteRequest): Promise<LocalQuote> {
  const ref = `Q-${h.code}-${Date.now().toString(36).slice(-4).toUpperCase()}`
  const specs = [
    `Catalogue house ${h.code} — ${h.name}`,
    `${h.floors} floor(s) · about ${h.gfa} m² · ${h.bedrooms} bedroom(s) · ${h.bathrooms} bathroom(s) · ${h.parking}-car parking`,
    `Estimated price shown: ${money(h.priceUsd, 'USD')} (${money(h.priceUsd, 'LAK')}) — ${h.finish} finish, indicative`,
  ].join('\n')
  const base: LocalQuote = { ...q, ref, designRef: h.code, designName: h.name, estimateUsd: h.priceUsd, createdAt: new Date().toISOString(), status: 'Submitted', channel: 'email', specs }
  if (supabase) {
    const { error } = await supabase.from('quotation_requests').insert({
      ref, design_ref: h.code, name: q.name, email: q.email, phone: q.phone, location: q.location, budget: q.budget, timeline: q.timeline, message: q.message,
      design: { catalog: h.id, code: h.code, name: h.name }, estimate_usd: h.priceUsd, specs, status: 'Submitted',
    })
    if (error) throw error
    localQuotes.add({ ...base, channel: 'database' })
    return { ...base, channel: 'database' }
  }
  const summary = [`Quotation request ${ref} for catalogue house ${h.code}`, `Name: ${q.name} · Email: ${q.email} · Phone/WhatsApp: ${q.phone}`, `Site: ${q.location} · Budget: ${q.budget} · Timeline: ${q.timeline}`, `Message: ${q.message}`, '', specs].join('\n')
  if (FORM_ENDPOINT) {
    const res = await fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...q, enquiryType: 'Catalogue house quotation', designRef: h.code, message: summary }) })
    if (!res.ok) throw new Error('Could not send the request.')
    localQuotes.add({ ...base, channel: 'form' })
    return { ...base, channel: 'form' }
  }
  window.location.href = `mailto:${company.contact.email}?subject=${encodeURIComponent(`Quotation request ${ref} — ${h.name}`)}&body=${encodeURIComponent(summary)}`
  localQuotes.add(base)
  return base
}
