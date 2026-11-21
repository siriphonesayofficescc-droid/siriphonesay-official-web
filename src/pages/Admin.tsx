import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { furnitureDefs, roofMaterials, styles, wallMaterials, floorMaterials } from '../house/catalog'
import { saveCatalog, useCatalogSettings } from '../house/catalogSettings'
import { DEFAULT_RATES, money, useRates, type Rates } from '../house/estimate'
import { localQuotes, shareUrl } from '../house/storage'
import CatalogAdmin from '../house/ui/CatalogAdmin'
import type { Design } from '../house/types'
import { backendEnabled, isStaff, RATE_EDITORS, ROLE_LABEL, saveRatesRemote, STAFF_ROLES, supabase, useAsync, useAuth, type Role } from '../lib/backend'
import { useDocumentMeta } from '../lib/useDocumentMeta'

type Tab = 'quotes' | 'designs' | 'rates' | 'prices' | 'templates' | 'models' | 'team'

const STATUSES = ['Submitted', 'Under review', 'Site visit', 'Quoted', 'Won', 'Closed']

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k])).join(','))].join('\n')
}
function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
}

/* ── quotations ───────────────────────────────────────────────── */
interface QRow {
  id: string
  ref: string
  design_ref: string
  name: string
  email: string
  phone: string
  location: string | null
  budget: string | null
  timeline: string | null
  message: string | null
  estimate_usd: number
  status: string
  assigned_to: string | null
  response: string | null
  design: Design
  created_at: string
  specs?: string | null
  images?: string[] | null
}

function Quotations({ staff }: { staff: { id: string; full_name: string | null; role: Role }[] }) {
  const [reload, setReload] = useState(0)
  const q = useAsync(async () => {
    if (!supabase) return localQuotes.list().map((l) => ({ id: l.ref, ref: l.ref, design_ref: l.designRef, name: l.name, email: l.email, phone: l.phone, location: l.location, budget: l.budget, timeline: l.timeline, message: l.message, estimate_usd: l.estimateUsd, status: l.status, assigned_to: null, response: null, design: (l.design ?? null) as unknown as Design, created_at: l.createdAt, specs: l.specs ?? null, images: l.images ?? [] }))
    const { data, error } = await supabase.from('quotation_requests').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data as QRow[]
  }, [reload])
  const [open, setOpen] = useState<string | null>(null)
  const upd = async (id: string, patch: Partial<QRow>) => {
    if (!supabase) return
    await supabase.from('quotation_requests').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    setReload((r) => r + 1)
  }
  if (q.loading) return <p className="text-steel">Loading…</p>
  if (q.error) return <p className="text-red-300">{q.error}</p>
  const rows = q.data ?? []
  return (
    <div>
      <div className="mb-4 flex justify-between">
        <span className="font-mono text-[11px] text-steel-light">{rows.length} request(s){!supabase && ' — local mode shows requests sent from this browser only'}</span>
        <button className="btn-ghost !px-3 !py-2" onClick={() => download('quotation-requests.csv', toCsv(rows.map(({ design: _d, images: _i, ...r }) => r)))}>Export CSV</button>
      </div>
      <ul className="divide-y divide-white/[0.06] border border-white/10">
        {rows.map((r) => (
          <li key={r.id} className="p-4">
            <div className="grid items-start gap-3 md:grid-cols-[1fr_auto]">
              <button className="text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <div className="font-mono text-[11px] text-gold">{r.ref} · {new Date(r.created_at).toLocaleString()}</div>
                <div className="mt-1 text-mist">{r.name} · <span className="text-steel-light">{r.phone} · {r.email}</span></div>
                <div className="text-[12px] text-steel-light">{r.location} · budget {r.budget || '—'} · {r.timeline} · est. {money(r.estimate_usd, 'USD')}</div>
              </button>
              <div className="flex flex-wrap gap-2">
                <select className="field !w-auto !py-2" value={r.status} disabled={!supabase} onChange={(e) => upd(r.id, { status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                {supabase && (
                  <select className="field !w-auto !py-2" value={r.assigned_to ?? ''} onChange={(e) => upd(r.id, { assigned_to: e.target.value || null })}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.id.slice(0, 6)} ({ROLE_LABEL[s.role]})</option>)}
                  </select>
                )}
              </div>
            </div>
            {open === r.id && (
              <div className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm">
                {r.message && <p className="text-steel-light">“{r.message}”</p>}
                {r.images && r.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.images.map((im, i) => (
                      <a key={i} href={im} target="_blank" rel="noreferrer" download={`${r.ref}-${i + 1}.jpg`}>
                        <img src={im} alt={`3D screenshot ${i + 1}`} className="h-24 border border-white/10 object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {r.specs && <pre className="max-h-72 overflow-auto whitespace-pre-wrap border border-white/10 bg-coal p-3 font-mono text-[11px] leading-relaxed text-steel-light">{r.specs}</pre>}
                {r.design && (
                  <div className="flex flex-wrap gap-2">
                    <a className="btn-gold !px-3 !py-2" href={shareUrl(r.design)} target="_blank" rel="noreferrer">Open design in 3D</a>
                    <span className="font-mono text-[11px] text-steel-light">{r.design.floors} floor(s) · {r.design.building.w}×{r.design.building.l} m · land {r.design.land.w}×{r.design.land.l} m</span>
                  </div>
                )}
                {supabase && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const v = new FormData(e.currentTarget).get('resp') as string
                      upd(r.id, { response: v })
                    }}
                    className="flex gap-2"
                  >
                    <textarea name="resp" defaultValue={r.response ?? ''} rows={2} className="field" placeholder="Reply visible to the customer in their account" />
                    <button className="btn-gold !px-4">Send</button>
                  </form>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Designs() {
  const q = useAsync(async () => {
    if (!supabase) return []
    const { data, error } = await supabase.from('designs').select('id, ref, name, style, gfa, estimate_usd, data, updated_at, owner, profiles(full_name)').order('updated_at', { ascending: false }).limit(200)
    if (error) throw error
    return data ?? []
  }, [])
  if (!supabase) return <p className="text-steel-light">Customer designs are stored in each visitor's browser in local mode. Connect Supabase to review all customer designs here.</p>
  if (q.loading) return <p className="text-steel">Loading…</p>
  const rows = (q.data ?? []) as unknown as { id: string; ref: string; name: string; style: string; gfa: number; estimate_usd: number; data: Design; updated_at: string; profiles: { full_name: string | null } | null }[]
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-ghost !px-3 !py-2" onClick={() => download('designs.csv', toCsv(rows.map((r) => ({ ref: r.ref, name: r.name, style: r.style, gfa: r.gfa, estimate_usd: r.estimate_usd, customer: r.profiles?.full_name, updated: r.updated_at }))))}>Export CSV</button>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="font-mono text-[10px] uppercase tracking-[0.18em] text-steel">
          <tr><th className="p-2">Ref</th><th>Name</th><th>Customer</th><th>Area</th><th>Estimate</th><th>Updated</th><th /></tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {rows.map((r) => (
            <tr key={r.id} className="text-steel-light">
              <td className="p-2 font-mono text-[11px] text-gold">{r.ref}</td>
              <td className="text-mist">{r.name}</td>
              <td>{r.profiles?.full_name ?? '—'}</td>
              <td>{Number(r.gfa).toFixed(0)} m²</td>
              <td>{money(r.estimate_usd, 'USD')}</td>
              <td>{new Date(r.updated_at).toLocaleDateString()}</td>
              <td><a className="text-gold underline" href={shareUrl(r.data)} target="_blank" rel="noreferrer">Open</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NumIn({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-steel">{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="field mt-1 !py-2 font-mono" />
    </label>
  )
}

function RatesEditor({ canEdit }: { canEdit: boolean }) {
  const current = useRates()
  const [r, setR] = useState<Rates>(current)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => setR(current), [current])
  const set = (p: Partial<Rates>) => setR((x) => ({ ...x, ...p }))
  const splitSum = Object.values(r.split).reduce((s, v) => s + v, 0)
  const save = async () => {
    try {
      await saveRatesRemote({ ...r, updatedAt: new Date().toISOString() })
      setMsg('Saved — new estimates use these rates.')
    } catch (e) {
      setMsg((e as Error).message)
    }
  }
  return (
    <fieldset disabled={!canEdit} className="space-y-8">
      {!canEdit && <p className="text-sm text-steel-light">Only the Managing Director, Administrator and Quantity Surveyor can change rates.</p>}
      <p className="border border-gold/40 bg-gold/5 p-3 text-xs text-gold-light">House rates are set to the company's range — Standard 420, Premium 510, Luxury 600 USD/m² (all-in building cost). Category proportions follow the company's cost records (≈55 % materials, 45 % labour). Unit rates for site works, pool and furniture are indicative — check them before launch.</p>
      <section>
        <h3 className="eyebrow mb-3">House rate — all-in building cost (USD per m² of floor area)</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {(['standard', 'premium', 'luxury'] as const).map((k) => <NumIn key={k} label={k} value={r.baseRate[k]} onChange={(v) => set({ baseRate: { ...r.baseRate, [k]: v } })} />)}
          <NumIn label="LAK per 1 USD" value={r.lakPerUsd} onChange={(v) => set({ lakPerUsd: v })} />
        </div>
      </section>
      <section>
        <h3 className="eyebrow mb-3">Split of base rate {Math.abs(splitSum - 1) > 0.001 && <span className="text-red-300">(total {Math.round(splitSum * 100)}% — should be 100%)</span>}</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {(Object.keys(r.split) as (keyof Rates['split'])[]).map((k) => <NumIn key={k} label={`${k} %`} step={1} value={Math.round(r.split[k] * 1000) / 10} onChange={(v) => set({ split: { ...r.split, [k]: v / 100 } })} />)}
        </div>
      </section>
      <section>
        <h3 className="eyebrow mb-3">Unit rates (USD)</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {(['flat', 'gable', 'hip', 'shed'] as const).map((k) => <NumIn key={k} label={`roof ${k} /m²`} value={r.roofRate[k]} onChange={(v) => set({ roofRate: { ...r.roofRate, [k]: v } })} />)}
          <NumIn label="windows /m² glazing" value={r.windowRate} onChange={(v) => set({ windowRate: v })} />
          {(['standard', 'premium', 'luxury'] as const).map((k) => <NumIn key={`b${k}`} label={`bathroom set ${k}`} value={r.bathroomSet[k]} onChange={(v) => set({ bathroomSet: { ...r.bathroomSet, [k]: v } })} />)}
          {(['standard', 'premium', 'luxury'] as const).map((k) => <NumIn key={`k${k}`} label={`kitchen set ${k}`} value={r.kitchenSet[k]} onChange={(v) => set({ kitchenSet: { ...r.kitchenSet, [k]: v } })} />)}
          {(['standard', 'premium', 'luxury'] as const).map((k) => <NumIn key={`d${k}`} label={`interior door ${k}`} value={r.interiorDoor[k]} onChange={(v) => set({ interiorDoor: { ...r.interiorDoor, [k]: v } })} />)}
          <NumIn label="site prep /m² land" value={r.sitePrep} onChange={(v) => set({ sitePrep: v })} />
          <NumIn label="balcony /m²" value={r.balcony} onChange={(v) => set({ balcony: v })} />
          <NumIn label="roof terrace /m²" value={r.terrace} onChange={(v) => set({ terrace: v })} />
          <NumIn label="carport /space" value={r.carport} onChange={(v) => set({ carport: v })} />
          <NumIn label="driveway /m²" value={r.driveway} onChange={(v) => set({ driveway: v })} />
          <NumIn label="pool /m²" value={r.pool} onChange={(v) => set({ pool: v })} />
          <NumIn label="landscaping /m²" value={r.landscaping} onChange={(v) => set({ landscaping: v })} />
          <NumIn label="tree each" value={r.tree} onChange={(v) => set({ tree: v })} />
          <NumIn label="exterior lighting (lump)" value={r.exteriorLighting} onChange={(v) => set({ exteriorLighting: v })} />
          <NumIn label="contingency % (site works)" value={Math.round(r.contingency * 1000) / 10} onChange={(v) => set({ contingency: v / 100 })} />
          <NumIn label="selections max −%" value={Math.round(r.adjustMin * 100)} onChange={(v) => set({ adjustMin: v / 100 })} />
          <NumIn label="selections max +%" value={Math.round(r.adjustMax * 100)} onChange={(v) => set({ adjustMax: v / 100 })} />
          {(['1', '2', '3'] as const).map((k) => <NumIn key={k} step={0.01} label={`${k}-floor structure factor`} value={r.floorFactor[k]} onChange={(v) => set({ floorFactor: { ...r.floorFactor, [k]: v } })} />)}
          {(['standard', 'premium', 'luxury'] as const).map((k) => <NumIn key={`f${k}`} step={0.1} label={`furniture factor ${k}`} value={r.furnitureFactor[k]} onChange={(v) => set({ furnitureFactor: { ...r.furnitureFactor, [k]: v } })} />)}
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-gold" onClick={save}>Save rates</button>
        <button type="button" className="btn-ghost" onClick={() => setR(DEFAULT_RATES)}>Load defaults</button>
        {msg && <span className="text-sm text-steel-light">{msg}</span>}
        {current.updatedAt && <span className="font-mono text-[10px] text-steel">Last updated {new Date(current.updatedAt).toLocaleString()}</span>}
      </div>
    </fieldset>
  )
}

function Prices({ canEdit }: { canEdit: boolean }) {
  const current = useRates()
  const [r, setR] = useState<Rates>(current)
  const [msg, setMsg] = useState<string | null>(null)
  const mats = [...wallMaterials, ...roofMaterials, ...floorMaterials]
  return (
    <fieldset disabled={!canEdit} className="space-y-8">
      <section>
        <h3 className="eyebrow mb-3">Material prices (USD per m² of surface)</h3>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {mats.map((m) => <NumIn key={m.id + m.tex} label={m.label} value={r.materialCost[m.id] ?? m.cost} onChange={(v) => setR({ ...r, materialCost: { ...r.materialCost, [m.id]: v } })} />)}
        </div>
      </section>
      <section>
        <h3 className="eyebrow mb-3">Furniture library prices (USD, standard grade)</h3>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {furnitureDefs.filter((f) => f.kind !== 'car').map((f) => <NumIn key={f.kind} label={f.label} value={r.furniturePrice[f.kind] ?? f.price} onChange={(v) => setR({ ...r, furniturePrice: { ...r.furniturePrice, [f.kind]: v } })} />)}
        </div>
      </section>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-gold" onClick={async () => { try { await saveRatesRemote(r); setMsg('Saved') } catch (e) { setMsg((e as Error).message) } }}>Save prices</button>
        {msg && <span className="text-sm text-steel-light">{msg}</span>}
      </div>
    </fieldset>
  )
}

function Templates({ canEdit }: { canEdit: boolean }) {
  const cat = useCatalogSettings()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <p className="text-sm text-steel-light">Choose which house templates customers can start from. New architectural styles are added as templates in <code className="text-gold">src/house/catalog.ts</code> (style presets) — see README.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {styles.map((s) => {
          const on = !cat.disabledStyles.includes(s.id)
          return (
            <li key={s.id}>
              <label className={`flex items-center justify-between border p-3 ${on ? 'border-gold/40' : 'border-white/10 opacity-60'}`}>
                <span className="text-sm text-mist">{s.label}</span>
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={on}
                  onChange={async (e) => {
                    const next = e.target.checked ? cat.disabledStyles.filter((x) => x !== s.id) : [...cat.disabledStyles, s.id]
                    try {
                      await saveCatalog({ ...cat, disabledStyles: next })
                      setMsg('Saved')
                    } catch (er) {
                      setMsg((er as Error).message)
                    }
                  }}
                />
              </label>
            </li>
          )
        })}
      </ul>
      {msg && <p className="text-sm text-steel-light">{msg}</p>}
    </div>
  )
}

function Team({ canEdit }: { canEdit: boolean }) {
  const [reload, setReload] = useState(0)
  const list = useAsync(async () => {
    if (!supabase) return []
    const { data } = await supabase.from('profiles').select('id, full_name, phone, role, created_at').order('created_at', { ascending: false })
    return data ?? []
  }, [reload])
  if (!supabase) return <p className="text-steel-light">Team roles need the Supabase backend.</p>
  return (
    <table className="w-full text-left text-sm">
      <thead className="font-mono text-[10px] uppercase tracking-[0.18em] text-steel"><tr><th className="p-2">Name</th><th>Phone</th><th>Role</th></tr></thead>
      <tbody className="divide-y divide-white/[0.06]">
        {(list.data ?? []).map((p: { id: string; full_name: string | null; phone: string | null; role: Role }) => (
          <tr key={p.id}>
            <td className="p-2 text-mist">{p.full_name ?? p.id.slice(0, 8)}</td>
            <td className="text-steel-light">{p.phone}</td>
            <td>
              <select className="field !w-auto !py-1.5" disabled={!canEdit} value={p.role} onChange={async (e) => { await supabase!.from('profiles').update({ role: e.target.value }).eq('id', p.id); setReload((r) => r + 1) }}>
                {(['customer', ...STAFF_ROLES] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Admin() {
  useDocumentMeta('Admin dashboard')
  const { user, profile, loading } = useAuth()
  const [tab, setTab] = useState<Tab>('quotes')
  const staffList = useAsync(async () => {
    if (!supabase || !isStaff(profile)) return []
    const { data } = await supabase.from('profiles').select('id, full_name, role').neq('role', 'customer')
    return (data ?? []) as { id: string; full_name: string | null; role: Role }[]
  }, [profile?.id])

  const local = !backendEnabled
  if (backendEnabled && loading) return <main className="min-h-screen bg-ink pt-32 text-center text-steel">Loading…</main>
  if (backendEnabled && (!user || !isStaff(profile)))
    return (
      <main className="min-h-[70vh] bg-ink px-6 pt-40 text-center">
        <h1 className="h-display text-4xl text-mist">Staff only</h1>
        <p className="mt-3 text-steel-light">Sign in with a staff account to use the dashboard.</p>
        <Link to="/account" className="btn-gold mt-6">Sign in</Link>
      </main>
    )
  const role: Role = local ? 'admin' : profile!.role
  const canRates = local || RATE_EDITORS.includes(role)
  const canTeam = local || role === 'md' || role === 'admin'
  const tabs: [Tab, string][] = [['quotes', 'Quotation requests'], ['designs', 'Customer designs'], ['rates', 'Construction rates'], ['prices', 'Material & furniture prices'], ['templates', 'House templates'], ['models', 'House catalogue'], ['team', 'Team & roles']]

  return (
    <main id="main" className="min-h-screen bg-ink pt-[76px]">
      <div className="container-site py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Siriphonesay Construction</span>
            <h1 className="h-display mt-3 text-4xl text-mist">Admin dashboard</h1>
            <p className="mt-2 text-sm text-steel-light">{local ? 'Local mode — changes are stored in this browser only. Connect Supabase for a shared, secure dashboard.' : `${profile?.full_name ?? user?.email} · ${ROLE_LABEL[role]}`}</p>
          </div>
        </div>
        <div role="tablist" className="mt-8 flex gap-1 overflow-x-auto border-b border-white/10">
          {tabs.map(([id, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] ${tab === id ? 'border-gold text-gold' : 'border-transparent text-steel hover:text-mist'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="mt-8">
          {tab === 'quotes' && <Quotations staff={staffList.data ?? []} />}
          {tab === 'designs' && <Designs />}
          {tab === 'rates' && <RatesEditor canEdit={canRates} />}
          {tab === 'prices' && <Prices canEdit={canRates} />}
          {tab === 'templates' && <Templates canEdit={canTeam} />}
          {tab === 'models' && <CatalogAdmin canEdit={local || ['md', 'admin', 'architect', 'engineer'].includes(role)} />}
          {tab === 'team' && <Team canEdit={canTeam} />}
        </div>
      </div>
    </main>
  )
}
